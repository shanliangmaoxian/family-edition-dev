import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 确保在项目根目录创建数据库文件
const DB_PATH = path.join(process.cwd(), 'inventory.db');

// 初始化数据库
export const initDB = () => {
  const db = new Database(DB_PATH);
  
  // 启用外键
  db.pragma('foreign_keys = ON');

  // 创建产品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      spec TEXT,
      unit TEXT DEFAULT '个',
      stock REAL DEFAULT 0,
      price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建交易记录表 (入库/出库)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      type TEXT CHECK(type IN ('in', 'out')),
      quantity REAL NOT NULL,
      price REAL,
      remark TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  return db;
};

// 单例模式获取 DB 实例
let db: ReturnType<typeof initDB>;

export const getDB = () => {
  if (!db) {
    db = initDB();
  }
  return db;
};

export default getDB();
