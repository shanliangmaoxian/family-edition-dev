import Database from '@tauri-apps/plugin-sql';

// 懒加载 DB 实例
let db: Database | null = null;

export async function getTauriDB() {
  if (db) return db;
  
  // 连接本地数据库文件 (位于应用数据目录)
  db = await Database.load('sqlite:inventory.db');
  
  // 初始化数据库表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      spec TEXT,
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
      remark TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
  
  // --- 数据库自动迁移：检查并添加 bill_no 字段 ---
  try {
    const columns = await db.select<any[]>('PRAGMA table_info(transactions)');
    const hasBillNo = columns.some(c => c.name === 'bill_no');
    if (!hasBillNo) {
      console.log('检测到旧版数据库，正在升级：添加 bill_no 字段...');
      await db.execute('ALTER TABLE transactions ADD COLUMN bill_no TEXT');
    }
  } catch (e) {
    console.error('数据库升级检查失败:', e);
  }
  
  return db;
}

// --- 批量记录交易 ---
export async function recordBatchTransaction(data: {
  type: 'in' | 'out';
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
      'INSERT INTO transactions (product_id, bill_no, type, quantity, price) VALUES (?, ?, ?, ?, ?)',
      [item.productId, billNo, data.type, item.quantity, item.price]
    );
    
    await conn.execute(
      'UPDATE products SET stock = stock + ?, price = ? WHERE id = ?',
      [delta, item.price, item.productId]
    );
  }
  return billNo;
}

// --- 获取单据历史 ---
export async function getTransactionHistory() {
  const conn = await getTauriDB();
  return conn.select<any[]>(`
    SELECT 
      bill_no, 
      type, 
      datetime(timestamp, 'localtime') as time,
      SUM(quantity * price) as total_amount,
      COUNT(*) as item_count
    FROM transactions 
    GROUP BY bill_no 
    ORDER BY timestamp DESC
    LIMIT 50
  `);
}

// --- 获取单据详情 ---
export async function getBillDetails(billNo: string) {
  const conn = await getTauriDB();
  return conn.select<any[]>(`
    SELECT 
      t.quantity, 
      t.price, 
      p.name, 
      p.unit, 
      p.spec
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    WHERE t.bill_no = ?
  `, [billNo]);
}

// --- 删除商品 ---
export async function deleteProduct(id: number) {
  const conn = await getTauriDB();
  
  // 检查是否有交易记录
  const transactions = await conn.select<any[]>('SELECT id FROM transactions WHERE product_id = ? LIMIT 1', [id]);
  if (transactions.length > 0) {
    throw new Error('该商品已有出入库记录，无法删除以保护历史数据。');
  }
  
  return conn.execute('DELETE FROM products WHERE id = ?', [id]);
}

// --- 搜索功能 ---
export async function searchProducts(query: string) {
  const conn = await getTauriDB();
  return conn.select<any[]>(
    'SELECT * FROM products WHERE name LIKE ? OR spec LIKE ? ORDER BY name ASC',
    [`%${query}%`, `%${query}%`]
  );
}

// --- 记录交易 ---
export async function recordTransaction(data: {
  productId: number;
  type: 'in' | 'out';
  quantity: number;
  price: number;
}) {
  const conn = await getTauriDB();
  const delta = data.type === 'in' ? data.quantity : -data.quantity;

  // Tauri 插件不支持事务链式调用，需手动处理
  await conn.execute(
    'INSERT INTO transactions (product_id, type, quantity, price) VALUES (?, ?, ?, ?)',
    [data.productId, data.type, data.quantity, data.price]
  );
  
  await conn.execute(
    'UPDATE products SET stock = stock + ?, price = ? WHERE id = ?',
    [delta, data.price, data.productId]
  );
}

// --- 添加产品 ---
export async function addProduct(data: {
  name: string;
  spec: string;
  unit: string;
  price: number;
  initialStock: number;
}) {
  const conn = await getTauriDB();
  return conn.execute(
    'INSERT INTO products (name, spec, unit, price, stock) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.spec, data.unit, data.price, data.initialStock]
  );
}
