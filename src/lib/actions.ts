'use server';

import getDB from './db';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { revalidatePath } from 'next/cache';

const db = getDB;

// --- 搜索功能 ---
export async function searchProducts(query: string) {
  const stmt = db.prepare(`
    SELECT * FROM products 
    WHERE name LIKE ? OR spec LIKE ?
    ORDER BY name ASC
  `);
  return stmt.all(`%${query}%`, `%${query}%`) as any[];
}

// --- 入库/出库逻辑 ---
export async function recordTransaction(data: {
  productId: number;
  type: 'in' | 'out';
  quantity: number;
  price: number;
  remark?: string;
}) {
  const { productId, type, quantity, price, remark } = data;

  const transaction = db.transaction(() => {
    // 1. 插入交易记录
    const insertTx = db.prepare(`
      INSERT INTO transactions (product_id, type, quantity, price, remark)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertTx.run(productId, type, quantity, price, remark);

    // 2. 更新产品库存和最后价格
    const delta = type === 'in' ? quantity : -quantity;
    const updateProduct = db.prepare(`
      UPDATE products 
      SET stock = stock + ?, price = ?
      WHERE id = ?
    `);
    updateProduct.run(delta, price, productId);
  });

  transaction();
  revalidatePath('/');
}

// --- 添加新产品 ---
export async function addProduct(data: {
  name: string;
  spec: string;
  unit: string;
  price: number;
  initialStock: number;
}) {
  const insert = db.prepare(`
    INSERT INTO products (name, spec, unit, price, stock)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = insert.run(data.name, data.spec, data.unit, data.price, data.initialStock);
  revalidatePath('/');
  return result.lastInsertRowid;
}

// --- 一键备份功能 ---
export async function backupDatabase() {
  try {
    const dbPath = path.join(process.cwd(), 'inventory.db');
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const backupName = `inventory_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const destPath = path.join(desktopPath, backupName);

    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, destPath);
      return { success: true, path: destPath };
    } else {
      throw new Error('数据库文件不存在');
    }
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
