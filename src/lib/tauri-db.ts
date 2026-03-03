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
      type TEXT CHECK(type IN ('in', 'out')),
      quantity REAL NOT NULL,
      price REAL,
      remark TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
  
  return db;
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
