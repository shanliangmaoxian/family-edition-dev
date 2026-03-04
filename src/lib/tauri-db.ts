import Database from '@tauri-apps/plugin-sql';

// 懒加载 DB 实例
let db: Database | null = null;

export async function getTauriDB() {
  if (db) return db;
  
  db = await Database.load('sqlite:inventory.db');
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      spec TEXT,
      category TEXT DEFAULT '未分类',
      unit TEXT DEFAULT '个',
      stock REAL DEFAULT 0,
      price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      bill_no TEXT,
      type TEXT CHECK(type IN ('in', 'out')),
      quantity REAL NOT NULL,
      price REAL,
      actual_amount REAL,
      remark TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
  
  try {
    const tCols = await db.select<any[]>('PRAGMA table_info(transactions)');
    if (!tCols.some(c => c.name === 'bill_no')) {
      await db.execute('ALTER TABLE transactions ADD COLUMN bill_no TEXT');
    }
    if (!tCols.some(c => c.name === 'actual_amount')) {
      await db.execute('ALTER TABLE transactions ADD COLUMN actual_amount REAL');
    }
    
    const pCols = await db.select<any[]>('PRAGMA table_info(products)');
    if (!pCols.some(c => c.name === 'category')) {
      await db.execute('ALTER TABLE products ADD COLUMN category TEXT DEFAULT "未分类"');
    }
  } catch (e) {
    console.error('数据库升级失败:', e);
  }
  
  return db;
}

export async function recordBatchTransaction(data: {
  type: 'in' | 'out';
  remark?: string;
  actualAmount?: number;
  items: Array<{
    productId: number;
    quantity: number;
    price: number;
  }>;
}) {
  const conn = await getTauriDB();
  const billNo = `${data.type === 'in' ? 'IN' : 'OUT'}${Date.now()}`;

  for (const item of data.items) {
    const delta = data.type === 'in' ? item.quantity : -item.quantity;
    await conn.execute(
      'INSERT INTO transactions (product_id, bill_no, type, quantity, price, remark, actual_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item.productId, billNo, data.type, item.quantity, item.price, data.remark || '', data.actualAmount || 0]
    );
    await conn.execute(
      'UPDATE products SET stock = stock + ?, price = ? WHERE id = ?',
      [delta, item.price, item.productId]
    );
  }
  return billNo;
}

export async function getTransactionHistory() {
  const conn = await getTauriDB();
  return conn.select<any[]>(`
    SELECT 
      bill_no, 
      type, 
      MAX(remark) as remark,
      MAX(actual_amount) as actual_amount,
      datetime(timestamp, 'localtime') as time,
      SUM(quantity * price) as total_amount,
      COUNT(*) as item_count
    FROM transactions 
    GROUP BY bill_no 
    ORDER BY timestamp DESC
    LIMIT 50
  `);
}

export async function getBillDetails(billNo: string) {
  const conn = await getTauriDB();
  return conn.select<any[]>(`
    SELECT 
      t.quantity, 
      t.price, 
      t.actual_amount,
      t.remark as bill_remark,
      p.name, 
      p.unit, 
      p.spec,
      p.category
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    WHERE t.bill_no = ?
  `, [billNo]);
}

// --- 导出完整库存数据 ---
export async function getAllInventoryForExport() {
  const conn = await getTauriDB();
  return conn.select<any[]>(`
    SELECT 
      category as '分类', 
      name as '商品名称', 
      spec as '规格', 
      unit as '单位', 
      stock as '当前库存', 
      price as '参考单价',
      (stock * price) as '库存总市值'
    FROM products 
    ORDER BY category ASC, name ASC
  `);
}

export async function deleteProduct(id: number) {
  const conn = await getTauriDB();
  const transactions = await conn.select<any[]>('SELECT id FROM transactions WHERE product_id = ? LIMIT 1', [id]);
  if (transactions.length > 0) {
    throw new Error('该商品已有出入库记录，无法删除以保护历史数据。');
  }
  return conn.execute('DELETE FROM products WHERE id = ?', [id]);
}

export async function searchProducts(query: string) {
  const conn = await getTauriDB();
  return conn.select<any[]>(
    'SELECT * FROM products WHERE (name LIKE ? OR spec LIKE ? OR category LIKE ?) ORDER BY category ASC, name ASC',
    [`%${query}%`, `%${query}%`, `%${query}%`]
  );
}

export async function addProduct(data: {
  name: string;
  spec: string;
  category: string;
  unit: string;
  price: number;
  initialStock: number;
}) {
  const conn = await getTauriDB();
  return conn.execute(
    'INSERT INTO products (name, spec, category, unit, price, stock) VALUES (?, ?, ?, ?, ?, ?)',
    [data.name, data.spec, data.category, data.unit, data.price, data.initialStock]
  );
}
