'use client';

// 检查是否在浏览器且在 Tauri 环境中
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

import * as tauriDb from './tauri-db';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, BaseDirectory, readFile } from '@tauri-apps/plugin-fs';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// 统一导出与之前一致的接口名，但内部实现换成 Tauri 调用
export const searchProducts = async (q: string) => isTauri ? tauriDb.searchProducts(q) : [];
export const recordTransaction = async (t: any) => isTauri ? tauriDb.recordTransaction(t) : null;
export const addProduct = async (p: any) => isTauri ? tauriDb.addProduct(p) : null;

// --- 桌面版备份实现 ---
export async function backupDatabase() {
  if (!isTauri) return { success: false, message: '非桌面环境无法备份' };
  try {
    const filePath = await save({
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      defaultPath: `inventory_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    });

    if (filePath) {
      // 在 Tauri 中，数据库默认存在应用数据目录 (AppLocalData)
      const dbContent = await readFile('inventory.db', { baseDir: BaseDirectory.AppLocalData });
      await writeFile(filePath, dbContent);
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
      // 安装后重启应用
      await relaunch();
      return { hasUpdate: true };
    }
    return { hasUpdate: false };
  } catch (error) {
    console.error('检查更新失败:', error);
    return { hasUpdate: false, error };
  }
}
