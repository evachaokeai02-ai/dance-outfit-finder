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
| `/api/outfit-profile` | `GET` / `POST` | 输入用户搜索，输出可直接喂给推荐引擎的结构化 `finalInfo` | 本地规则 fallback，可替换模型 |
| `/api/outfit-events` | `POST` | 记录 query、generated profile、products、selected looks 到数据库 | Supabase 可选配置 |
| `/api/pdd-products` | `POST` | 前端商品推荐接口；服务端调用 PDD `goods.search` 并生成推广链接 | 生产接口；前端正在使用 |
| `/api/outfit-keywords` | `GET` / `POST` | 根据 `danceName`、`style`、`color`、`scene`、`body`、`budget` 生成商品搜索关键词 | 生产工具接口；当前前端未直接调用 |
| `/api/pdd-search` | `GET` / `POST` | 根据 `keyword` 搜索商品并尝试生成多多进宝推广链接 | 生产工具接口；当前前端未直接调用 |
| `/api/pdd-link` | `GET` / `POST` | 根据 `goodsId` / `goodsSign` 生成推广 / 跳转链接 | 生产工具接口；当前前端未直接调用 |
| `/api/pdd-debug` | `POST` | 管理员调试多多进宝，使用 `body.action` 区分 `pid-query` / `authority-query` / `authority-url` | 受保护调试接口；必须配置并传入 `x-admin-token` |


### API 清理状态

- 已删除接入阶段临时调试函数：`/api/pdd-authority-query`、`/api/pdd-authority-url`；`/api/pdd-pid`、`/api/pdd-pid-query` 当前不存在。
- 当前 `api/` 下保留 7 个 Vercel API 文件：`outfit-profile.js`、`outfit-events.js`、`pdd-products.js`、`pdd-debug.js`、`outfit-keywords.ts`、`pdd-search.ts`、`pdd-link.ts`。
- 当前前端真实调用的核心生产接口是 `/api/outfit-profile`、`/api/outfit-events`、`/api/pdd-products`。
- 所有后续 PDD 临时调试能力统一走 `/api/pdd-debug` 的 `body.action`，不要新增独立 `api/` 文件。

### 示例请求

```bash
curl "http://localhost:3000/api/outfit-profile?query=Super%20Shy"
curl "http://localhost:3000/api/outfit-keywords?danceName=Super%20Shy&style=甜酷&color=粉色&scene=舞台"
curl "http://localhost:3000/api/pdd-search?keyword=甜酷短上衣"
curl "http://localhost:3000/api/pdd-link?goodsId=123456789"
curl -X POST "http://localhost:3000/api/pdd-debug" -H "Content-Type: application/json" -H "x-admin-token: $ADMIN_TOKEN" -d '{"action":"authority-query"}'
```

> 注意：`npm run dev` 只启动 Vite 前端开发服务器。要在本地同时调试 Vercel Functions，建议使用 Vercel CLI：`vercel dev`。

## 拼多多 / 多多进宝密钥配置

不要把任何 `client_secret`、`app_secret`、`access_token` 写进前端代码、提交到 Git，或放进以 `VITE_` 开头的前端环境变量。

后续真实接入时，通过服务端环境变量读取：

```bash
PDD_CLIENT_ID=your_client_id
PDD_CLIENT_SECRET=your_client_secret
PDD_PID=your_pid
# 可选；仅用于安全诊断 pid 前缀是否匹配 duo_id，不会输出完整 PID
PDD_DUO_ID=your_duo_id
# 必填；未配置时 /api/pdd-debug 默认不可用
ADMIN_TOKEN=your_admin_token
```

如果要把用户搜索、模型生成标签、商品和 Look 持久化到数据库，可选配置 Supabase：

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_OUTFIT_EVENTS_TABLE=outfit_events
```

### 本地环境变量

可以在本地使用 `.env.local` 保存服务端变量，并确保不要提交该文件：

```bash
PDD_CLIENT_ID=your_client_id
PDD_CLIENT_SECRET=your_client_secret
PDD_PID=your_pid
# 可选；仅用于安全诊断 pid 前缀是否匹配 duo_id，不会输出完整 PID
PDD_DUO_ID=your_duo_id
# 必填；未配置时 /api/pdd-debug 默认不可用
ADMIN_TOKEN=your_admin_token
```

如果要把用户搜索、模型生成标签、商品和 Look 持久化到数据库，可选配置 Supabase：

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_OUTFIT_EVENTS_TABLE=outfit_events
```

使用 `vercel dev` 时，Serverless Functions 可以读取这些环境变量。

### Vercel 环境变量

在 Vercel Dashboard 中进入项目：

1. 打开 **Settings**。
2. 打开 **Environment Variables**。
3. 新增 `PDD_CLIENT_ID`、`PDD_CLIENT_SECRET`、`PDD_PID`。
4. 如需使用 `/api/pdd-debug`，必须新增 `ADMIN_TOKEN`，并在请求头传入匹配的 `x-admin-token`；未配置时该接口默认不可用。
5. 如需持久化搜索和生成结果，新增 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_OUTFIT_EVENTS_TABLE`。
6. 如需把本地 fallback 替换为真实模型，新增 `OPENAI_API_KEY`。
7. 按需选择 Production / Preview / Development 环境。
8. 重新部署项目。

## 安全原则

- 前端当前只直接调用 `/api/outfit-profile`、`/api/outfit-events`、`/api/pdd-products`；PDD 临时调试统一走受 `ADMIN_TOKEN` 保护的 `/api/pdd-debug`，不要新增独立调试函数。
- PDD 签名、推广位 PID、推广链接生成等逻辑放在 Serverless Functions 里；共享 PDD 代码放在根目录 `lib/`，避免被 Vercel 识别成额外 API 函数。
- `/api/pdd-products` 会在服务端环境变量齐全时调用 PDD 官方搜索接口，并在返回给前端前批量调用推广链接生成接口；推广链接生成失败时不会回退到任意占位或搜索 URL，商品卡片保持不可跳转并显示“链接生成失败/暂不可跳转”。
