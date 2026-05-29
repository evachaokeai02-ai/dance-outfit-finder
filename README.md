# 舞搭一下

一个本地优先的舞蹈穿搭推荐 MVP。当前前端会基于本地舞蹈库和示例商品库生成 3 套 Look；项目同时预留了轻量 Vercel Serverless Functions，用于后续安全接入拼多多 / 多多进宝商品 API。

## 本地开发

```bash
npm install
npm run dev
```

前端入口是 `src/main.jsx`，主页面逻辑在 `src/App.jsx`。

## 构建

```bash
npm run build
```

## 轻量后端 API

项目根目录的 `api/` 目录用于 Vercel Serverless Functions。前端后续如需接入拼多多 / 多多进宝，应该只调用自己的 `/api/...` 接口，不要在浏览器里直接请求拼多多接口。

当前已有接口：

| Endpoint | Method | 用途 | 当前状态 |
| --- | --- | --- | --- |
| `/api/outfit-keywords` | `GET` / `POST` | 根据 `danceName`、`style`、`color`、`scene`、`body`、`budget` 生成商品搜索关键词 | 本地规则生成 |
| `/api/pdd-search` | `GET` / `POST` | 根据 `keyword` 搜索商品 | 暂时返回 mock 商品 |
| `/api/pdd-link` | `GET` / `POST` | 根据 `goodsId` 生成推广 / 跳转链接 | 暂时返回 mock link |

### 示例请求

```bash
curl "http://localhost:3000/api/outfit-keywords?danceName=Super%20Shy&style=甜酷&color=粉色&scene=舞台"
curl "http://localhost:3000/api/pdd-search?keyword=甜酷短上衣"
curl "http://localhost:3000/api/pdd-link?goodsId=mock-top-001"
```

> 注意：`npm run dev` 只启动 Vite 前端开发服务器。要在本地同时调试 Vercel Functions，建议使用 Vercel CLI：`vercel dev`。

## 拼多多 / 多多进宝密钥配置

不要把任何 `client_secret`、`app_secret`、`access_token` 写进前端代码、提交到 Git，或放进以 `VITE_` 开头的前端环境变量。

后续真实接入时，通过服务端环境变量读取：

```bash
PDD_CLIENT_ID=your_client_id
PDD_CLIENT_SECRET=your_client_secret
PDD_ACCESS_TOKEN=your_access_token
```

### 本地环境变量

可以在本地使用 `.env.local` 保存服务端变量，并确保不要提交该文件：

```bash
PDD_CLIENT_ID=your_client_id
PDD_CLIENT_SECRET=your_client_secret
PDD_ACCESS_TOKEN=your_access_token
```

使用 `vercel dev` 时，Serverless Functions 可以读取这些环境变量。

### Vercel 环境变量

在 Vercel Dashboard 中进入项目：

1. 打开 **Settings**。
2. 打开 **Environment Variables**。
3. 新增 `PDD_CLIENT_ID`、`PDD_CLIENT_SECRET`、`PDD_ACCESS_TOKEN`。
4. 按需选择 Production / Preview / Development 环境。
5. 重新部署项目。

## 安全原则

- 前端只调用 `/api/outfit-keywords`、`/api/pdd-search`、`/api/pdd-link` 等自有接口。
- PDD 签名、access token、推广链接生成等逻辑放在 Serverless Functions 里。
- API 当前返回 mock 数据，等拿到真实凭证后再替换为 PDD 官方接口调用。
