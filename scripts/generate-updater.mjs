import fs from 'fs';
import path from 'path';

// 从 package.json 获取版本号
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

// 配置你的 GitHub 信息 (可以从环境变量获取)
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY.split('/')[1];

// 这里的文件名需要匹配你打包生成的实际文件名，通常是 x64 的 msi 或 nsis
// 注意：Tauri 2.0 默认在 Windows 上生成 .msi.zip 或 .exe
const platform = 'windows-x86_64';
const bundleDir = './src-tauri/target/release/bundle/msi'; // 如果你用的是 nsis，请改为 nsis

function getSignature(filePath) {
  if (fs.existsSync(filePath + '.sig')) {
    return fs.readFileSync(filePath + '.sig', 'utf-8');
  }
  return '';
}

// 查找安装包文件 (示例匹配 .msi)
const files = fs.readdirSync(bundleDir);
const assetFile = files.find(f => f.endsWith('.msi') && !f.endsWith('.sig'));

if (!assetFile) {
  console.error('未找到安装包文件，请检查 bundleDir 路径。');
  process.exit(1);
}

const signature = getSignature(path.join(bundleDir, assetFile));

const updateData = {
  version: version,
  notes: `Release v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    [platform]: {
      signature: signature,
      url: `https://github.com/${owner}/${repo}/releases/download/v${version}/${assetFile}`
    }
  }
};

fs.writeFileSync('./latest.json', JSON.stringify(updateData, null, 2));
console.log('成功生成 latest.json:');
console.log(updateData);
