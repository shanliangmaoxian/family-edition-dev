'use client';

// 检查是否在浏览器且在 Tauri 环境中
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

import * as tauriDb from './tauri-db';
import { save, confirm, message } from '@tauri-apps/plugin-dialog';
import { writeFile, BaseDirectory, readFile } from '@tauri-apps/plugin-fs';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// 统一导出
export const searchProducts = async (q: string) => isTauri ? tauriDb.searchProducts(q) : [];
export const recordBatchTransaction = async (t: any) => isTauri ? tauriDb.recordBatchTransaction(t) : null;
export const getTransactionHistory = async () => isTauri ? tauriDb.getTransactionHistory() : [];
export const getBillDetails = async (b: string) => isTauri ? tauriDb.getBillDetails(b) : [];
export const deleteProduct = async (id: number) => isTauri ? tauriDb.deleteProduct(id) : null;
export const addProduct = async (p: any) => isTauri ? tauriDb.addProduct(p) : null;

// --- 导出 CSV (Excel 可读) ---
export async function exportInventoryToExcel() {
  if (!isTauri) return;
  try {
    const data = await tauriDb.getAllInventoryForExport();
    if (!data || data.length === 0) throw new Error('没有可导出的数据');

    // 1. 构建 CSV 字符串 (带 BOM 头以支持 Excel 中文)
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n');
    const csvContent = '\uFEFF' + headers + '\n' + rows;

    // 2. 选择保存路径
    const filePath = await save({
      filters: [{ name: 'Excel CSV', extensions: ['csv'] }],
      defaultPath: `九月进销存_库存清单_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`
    });

    if (filePath) {
      await writeFile(filePath, new TextEncoder().encode(csvContent));
      return { success: true, path: filePath };
    }
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// --- 对话框辅助 ---
export async function askConfirm(messageStr: string, title: string = '确认') {
  if (!isTauri) return window.confirm(messageStr);
  return confirm(messageStr, { title, kind: 'warning' });
}

export async function showMessage(messageStr: string, title: string = '提示') {
  if (!isTauri) return window.alert(messageStr);
  return message(messageStr, { title, kind: 'info' });
}

// --- 桌面版备份实现 ---
export async function backupDatabase() {
  if (!isTauri) return { success: false, message: '非桌面环境无法备份' };
  try {
    const filePath = await save({
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      defaultPath: `inventory_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    });

    if (filePath) {
      // 显式读取原始数据库
      const dbContent = await readFile('inventory.db', { baseDir: BaseDirectory.AppLocalData });
      
      if (!dbContent || dbContent.length === 0) {
        throw new Error('数据库文件为空，请先添加一些数据再备份。');
      }

      await writeFile(filePath, dbContent);
      console.log(`备份成功，文件大小: ${dbContent.length} 字节`);
      return { success: true, path: filePath };
    }
    return { success: false, message: '用户取消了备份' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// --- 在线更新实现 ---
export async function checkForUpdates() {
  if (!isTauri) return { hasUpdate: false };
  try {
    const update = await check();
    if (update) {
      console.log(`正在更新到版本 ${update.version}...`);
      await update.downloadAndInstall();
      await relaunch();
      return { hasUpdate: true };
    }
    return { hasUpdate: false };
  } catch (error) {
    console.error('检查更新失败:', error);
    return { hasUpdate: false, error };
  }
}
