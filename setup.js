const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.cwd(), 'inventory.db');

console.log('正在初始化数据库...');

try {
  const db = new Database(DB_PATH);
  
  db.exec(`
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
  
  console.log('✅ 数据库初始化成功！');
  console.log('数据库位置:', DB_PATH);
  
  // 插入一些示例数据（可选）
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (count === 0) {
    console.log('正在插入示例数据...');
    const insert = db.prepare('INSERT INTO products (name, spec, unit, stock, price) VALUES (?, ?, ?, ?, ?)');
    insert.run('示例商品-大米', '5kg/袋', '袋', 10, 50);
    insert.run('示例商品-食用油', '5L/桶', '桶', 5, 80);
    console.log('✅ 示例数据插入完成。');
  }

} catch (err) {
  console.error('❌ 数据库初始化失败:', err);
  process.exit(1);
}
