import fs from 'fs';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const version = pkg.version;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
const platform = 'windows-x86_64';

// Tauri 2.0 编译产物可能在不同子目录，我们递归查找一下
function findBundleFile(dir, extensions) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir, { recursive: true });
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (extensions.some(ext => file.endsWith(ext)) && !file.endsWith('.sig')) {
      return filePath;
    }
  }
  return null;
}

const bundleRoot = './src-tauri/target/release/bundle';
// 优先找 exe (nsis)，其次才是 msi 和 zip
const assetPath = findBundleFile(bundleRoot, ['.exe', '.exe.zip', '.msi.zip', '.msi']);

if (!assetPath) {
  console.error('未找到安装包文件，请检查编译产物目录。');
  process.exit(1);
}

const assetName = path.basename(assetPath);
const sigPath = assetPath + '.sig';
const signature = fs.existsSync(sigPath) ? fs.readFileSync(sigPath, 'utf-8').trim() : '';

const updateData = {
  version: version,
  notes: `九月进销存系统 v${version} 自动发布`,
  pub_date: new Date().toISOString(),
  platforms: {
    [platform]: {
      signature: signature,
      url: `https://github.com/${owner}/${repo}/releases/download/v${version}/${assetName}`
    }
  }
};

fs.writeFileSync('./latest.json', JSON.stringify(updateData, null, 2));
console.log(`成功生成 latest.json (版本: ${version}, 文件: ${assetName})`);
