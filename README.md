# ⚡ 英语背单词 (Yingyu)

> 面向中学生的智能背单词工具，基于 SM-2 间隔重复算法
> 附加家长督导端，支持分层抽查背诵情况
> 全部运行在 **Cloudflare 免费套餐** | 零成本 | 移动端优先

## 核心功能

- **SM-2 自适应间隔**：每个单词独立节奏，科学记忆
- **学新词 + 智能复习**：英译中评分 + 中译英拼写强化（拼写只加强记忆，不计入成果）
- **今日新学回顾**：当天新词独立入口巩固，纯本地练习、不影响算法
- **多轮次复习**：当天可二轮复习，本地乱序重排，不重复计分、零额外请求
- **家长督导端**：PIN 码保护 + 分层抽查 + 标记加强 + 按月日历 + 按日详情
- **多孩子支持**：独立进度，统一管理
- **⭐ 收藏单词**：词库页星标收藏，服务端持久化
- **📚 词库切换**：中考/高考词库一键切换
- **📊 统计页周视图**：本周/上周/上上周三周切换（一次拉取，切换零请求）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Pinia + Vue Router |
| 样式 | Tailwind CSS 4 |
| 后端 API | Cloudflare Pages Functions |
| 数据库 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Pages (免费套餐) |

**免费套餐额度**：
- Pages Functions: 10 万次请求/天
- D1: 5GB 存储（总量），500 万行读取/天，10 万行写入/天（每天 00:00 UTC 重置）
- 一个小家庭日常使用绰绰有余

## 目录结构

```
├── src/                     # 前端 Vue 3 源码
│   ├── components/          #   组件（common / learn / review / parent）
│   ├── views/               #   页面
│   ├── stores/              #   Pinia 状态（appStore / bankStore）
│   ├── api/                 #   API 客户端
│   ├── utils/               #   工具函数
│   └── router/              #   路由配置
├── functions/               # Cloudflare Pages Functions（部署用）
│   ├── api/                 #   路由文件（自动映射为 API 端点）
│   ├── _db/                 #   数据库查询 + schema（_前缀 = 私有模块）
│   └── _srs/                #   SM-2 算法
├── data/                    # 词库数据（zhongkao.sql / gaokao.sql）
├── public/                  # 静态资源 + _redirects（SPA 路由 fallback）
├── scripts/                 # 开发工具 / 测试
├── package.json
├── vite.config.js           # Vite 配置（/api proxy → :8788）
└── wrangler.toml            # Cloudflare 部署配置
```

## 本地开发

### 前置条件

- Node.js 22+
- npm
- 已登录 wrangler (`npx wrangler login`)

### 1. 初始化环境

```bash
# 安装依赖 + 初始化本地 D1 + 导入词库（data/ 下有完整词库则导入，否则回退 30 个测试词）
bash scripts/setup-local.sh
```

### 2. 启动（两个终端）

```bash
# 终端 1: 前端
npm run dev              # → http://localhost:5173

# 终端 2: 后端 API
npm run dev:api          # → http://localhost:8788
```

前端 Vite 已配 proxy，`/api/*` 请求自动发送到后端 8788 端口。
浏览器打开 `http://localhost:5173` 即可完整使用。

> 本地 API 服务器用 Node.js 22 内置 `node:sqlite` 直接读 wrangler 的 D1 文件，无需额外依赖。
> 线上部署后自动切换为 Cloudflare D1，代码完全一致。

### 3. 运行测试

```bash
node scripts/test-flow.mjs     # 全流程断言测试（SM2/复习/统计/抽查/词库等 50+ 项）
```

## 部署到 Cloudflare

> 采用 **Cloudflare Pages 原生 Git 集成**：连接 GitHub 仓库后，每次 `git push` 到 main，
> Cloudflare 自动拉取代码 → 构建 → 部署。无需任何 workflow / GitHub Actions。
> 词库数据、家长 PIN 不进仓库；D1 的 `database_id` 只是 UUID 标识（非凭据），公开无安全风险。

### 0. 前置：代码先推到 GitHub

把项目推到 GitHub（公开仓库即可，词库数据已被 `.gitignore` 排除，不会一起发布）。
本地先登录 wrangler：

```bash
npx wrangler login
```

### 1. 创建远程 D1 数据库并导入数据（一次性）

```bash
npx wrangler d1 create vocab-db     # 记下输出的 database_id
```

把输出的 `database_id` 填入 `wrangler.toml` 的 `database_id` 字段并提交
（它只是数据库标识 UUID，非访问凭据，公开无安全风险）：

```bash
npx wrangler d1 execute vocab-db --remote --file=functions/_db/schema.sql
npx wrangler d1 execute vocab-db --remote --file=data/zhongkao.sql   # 中考 1544 词
npx wrangler d1 execute vocab-db --remote --file=data/gaokao.sql     # 高考 3709 词
```

> 词库数据只在你手里（`.gitignore` 排除了 `data/`），所以导入这一步**必须手动执行一次**；
> 开源使用者同理，需要按「词库数据」章节自己生成并导入。

### 2. 创建 Pages 项目并连接 GitHub

Cloudflare 后台 → **Workers & Pages → 创建 → Pages → 连接到 Git** → 选择你的仓库，填写：

| 配置项 | 值 |
|---|---|
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |

保存后 Cloudflare 自动完成首次构建部署。

### 3. 设置家长 PIN

D1 绑定已写在 `wrangler.toml`（构建时自动生效），无需在后台重复配置。

**Settings → Environment variables → 添加**：`PARENT_PIN`（如 `8888`；不设则用代码默认 `7777`）。

### 4. 完成：之后每次 push 自动部署

```bash
git push origin main
```

Cloudflare 自动重新构建部署。以后改代码只需 push，无需任何其他操作。

### 部署说明

- **SPA 路由**：路由使用 history 模式，`functions/[[path]].js` 做兜底——不存在的路径
  （如 `/home`、`/stats`）返回 index.html 交给前端路由；`/api/*` 走具体 Functions，404 不兜底。
- **词库总词数**：`schema.sql` 自带 `banks` 表，首次请求时自动统计词库总词数并缓存，
  之后统计查询不再全表扫描 words。
- **家长 PIN 码**：后端校验（`/api/parent/verify-pin`），PIN 存环境变量 `PARENT_PIN`（默认 `7777`），
  部署时在 Cloudflare Pages 设置环境变量覆盖，真实 PIN 不进仓库。
- **发音**：点击喇叭走有道词典在线发音（浏览器直连），失败时回退浏览器 TTS。

## 词库数据

`data/` 保存了转换好的完整词库（中考 1544 词、高考 3709 词，含英式/美式音标与例句），
但已被 `.gitignore` 排除，**不随仓库发布**——词库数据归你所有，开源使用者需自行生成。

词库来源：[lilinji/English](https://github.com/lilinji/English) — 涵盖多版本教材、最新考纲词汇。
更新词库后记得把 `src/stores/bankStore.js` 里的 `VERSION` +1，客户端会自动重拉词条缓存。

转换工具（从 xlsx 重新生成）：

```bash
python3 scripts/convert_vocab.py --xlsx data/中考大纲词汇.xlsx --bank 1 --youdao data/ChuZhong_2.json --output data/zhongkao.sql
python3 scripts/convert_vocab.py --xlsx data/高考大纲词汇表.xlsx --bank 2 --youdao data/GaoZhong_2.json --output data/gaokao.sql
```

## API 总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | /api/users | 用户列表 / 创建 |
| PUT | /api/users/bank | 切换词库 |
| GET | /api/home | 首页聚合（统计 + 待复习 + 剩余新词） |
| GET | /api/today | 今日复习列表（round 参数） |
| GET | /api/review/new | 今日新学回顾（只读） |
| GET | /api/stats | 学习报告聚合 |
| GET | /api/stats/summary | 统计页聚合（本周/上周/上上周三周数据） |
| GET | /api/words | 词库全量（含学习/收藏状态） |
| GET | /api/words/state | 学习状态小接口（已学/收藏列表） |
| GET | /api/words/new | 未学新词（前端本地挑词的兜底） |
| POST | /api/learn/batch | 批量学新词 |
| POST | /api/review/batch | 批量复习提交（评分 + 拼写强化） |
| PUT | /api/settings | 更新每日目标 |
| GET/POST/DELETE | /api/bookmarks | 收藏管理 |
| GET | /api/parent/dashboard | 家长看板聚合（按月） |
| GET | /api/parent/day | 某天学习详情 |
| POST | /api/parent/verify-pin | 家长 PIN 校验 |
| POST | /api/parent/spot-check | 发起分层抽查 |
| POST | /api/parent/spot-check/submit | 提交抽查结果 |
| POST | /api/parent/reinforce | 标记单词加强 |

> 设计原则：每页加载 1 个聚合端点、批量写走一次 batch、词库词条本地缓存，
> 把每天请求数和 D1 读写压到免费额度以内。

## 许可

Apache 2.0
