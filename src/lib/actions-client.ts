'use client';

import * as tauriDb from './tauri-db';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, BaseDirectory, readBinaryFile } from '@tauri-apps/plugin-fs';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// 统一导出与之前一致的接口名，但内部实现换成 Tauri 调用
export const searchProducts = tauriDb.searchProducts;
export const recordTransaction = tauriDb.recordTransaction;
export const addProduct = tauriDb.addProduct;

// --- 桌面版备份实现 ---
export async function backupDatabase() {
  try {
    const filePath = await save({
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      defaultPath: `inventory_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    });

    if (filePath) {
      // 在 Tauri 中，数据库默认存在应用数据目录 (AppLocalData)
      const dbContent = await readBinaryFile('inventory.db', { baseDir: BaseDirectory.AppLocalData });
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
