This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 命令

###  修改执行
  每次发布前，你需要执行以下步骤：
   1. 修改版本号：同时修改 src-tauri/tauri.conf.json、src-tauri/Cargo.toml 和 package.json 中的 version 字段（例如都改为 0.1.1）。
   2. 提交代码：git commit -am "chore: release v0.1.1"
   3. 推送 Tag：git tag v0.1.1 且 git push origin v0.1.1


### 提交部署

```shell
git add .
git commit -m "feat: 集成 tauri 和自动更新"
git tag v0.0.2
git push origin main --tags
```

### 删除tag 
```shell
git tag -d v0.0.1;git push origin :refs/tags/v0.0.1
```


### 其他
