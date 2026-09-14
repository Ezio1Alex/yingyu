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

#### 已经部署过、要升级到本次改动

`schema.sql` 里的语句都是 `IF NOT EXISTS`，重跑一遍是安全且幂等的。线上库需要补上新增的覆盖索引：

```bash
npx wrangler d1 execute vocab-db --remote --file=functions/_db/schema.sql
```

另外这次改动让 **`DELETE /api/users` 也需要家长 PIN**，升级后前端会自动带上（PIN 在家长验证时留在内存里）。
如果你之前把 `PARENT_PIN` 留空用了默认值 `7777`，现在默认值换成了 14 位随机串，
**请到 Pages 环境变量里自己设一个**，否则家长端要用 `functions/_config.js` 里那个值登录。

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

**Settings → Environment variables → 添加**：`PARENT_PIN`（**强烈建议自己设一个**；不设则用代码里的默认值，
见 `functions/_config.js` 的 `DEFAULT_PARENT_PIN`，是一个 14 位随机串）。

> ⚠️ 本仓库是公开的，所以代码里的默认 PIN 等同于公开的，只挡得住「盲猜 0000-9999」的脚本。
> 真正的防护是你在 Pages 环境变量里设的那个值。

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
- **家长 PIN 码**：后端校验（`/api/parent/verify-pin`），PIN 存环境变量 `PARENT_PIN`，
  兜底默认值在 `functions/_config.js`（14 位随机串），部署时在 Cloudflare Pages 设置环境变量覆盖，真实 PIN 不进仓库。
  校验用常量时间比较，避免靠响应时间逐位猜。
- **破坏性操作要 PIN**：创建用户、**删除用户**（会级联清空该孩子全部学习数据）都需要家长 PIN。
  `user_id` 可以通过 `GET /api/users` 枚举出来，所以不能只靠「知道 id」来授权。
- **索引**：`review_log` 上有覆盖索引 `(user_id, date(reviewed_at), word_id)`，
  让「今天学过几个词」这类聚合直接 seek 到当天那几行，而不是扫该用户全部历史。
  实测 1.5 万行数据下从 3.2ms 降到 0.014ms（约 227 倍），D1 的 `rows_read` 从上万行降到几十行。
- **发音**：点击喇叭走有道词典在线发音（浏览器直连），失败时回退浏览器 TTS。

## API 防护

D1 免费额度是 **500 万行读/天**，一度被扫描器刷 `/api/*` 打光。根因有两个：

1. **`/api/words` 单次请求要读 3709 行**（整个高考词库），约 1350 次请求就能打光一天额度。
2. **所有接口零鉴权**，`user_id` 只是个随便传的参数。

现在有四层防护，从外到内：

### 第 1 层：Cloudflare WAF 限流规则（需手动配置一次）

> 性价比最高的一层——流量在到达 Functions 之前就被掐掉，不消耗任何额度。

**Dashboard → Security → WAF → Rate limiting rules → Create rule**：

| 项 | 值 |
|---|---|
| 名称 | `api-flood` |
| 表达式 | `http.request.uri.path starts_with "/api/"` |
| 计数特征 | `IP`（免费套餐只支持这个） |
| 阈值 | 10 秒内超过 **20** 次 |
| 缓解期 | 10 秒 |
| 动作 | Block |

免费套餐只能建 **1 条**规则、周期和缓解期都只能是 **10 秒**，够用但拦不住分布式攻击（见下方"局限"）。

### 第 2 层：`functions/api/_middleware.js`（只作用于 `/api/*`）

按「便宜 → 昂贵」顺序执行，任一环节拦下就**完全不碰 D1**：

```
紧急开关 → 路由白名单 → 共享密钥(默认关) → 每 IP 限流 → 边缘缓存命中? → handler
```

- **路由白名单**：未登记的路径/方法直接 404。实测拒绝一次 0 次 D1 读取。
- **每 IP 限流**：读 60 次/分、写 15 次/分，`/api/parent/verify-pin` 单独限到 5 次/分。
  超限返回 `429` + `Retry-After`。计数器用 Cache API 存（不占 D1 读、不占 KV 写额度）。
- **边缘缓存**：`/api/words` 按 `bank_id` 缓存 10 分钟（**全站只有 2 个缓存条目**，
  攻击者拿随机 `user_id` 刷也只会命中缓存，产生 0 次 D1 读）；`/api/home`、`/api/stats/summary`、
  `/api/words/state`、`/api/users` 用 15-60 秒短 TTL，写请求后按 `user_id` 精确失效。
- **紧急开关**：`functions/_guard/config.js` 里 `API_DISABLED` 改成 `true` 重新部署，整个 API 返回 503。
  想**秒级**止血用 Dashboard 的 WAF 自定义规则（`http.request.uri.path contains "/api/"` → Block）。

### 第 3 层：前端对限流的处理

被限流时前端会显示「请求过于频繁，请等 N 秒后再试」并给重试入口，而不是把 429 当成
「数据出错」或「没有账号」（登录页尤其重要：以前拉不到用户列表会直接弹出"新建孩子"表单）。

### 调参

所有阈值集中在 **`functions/_guard/config.js`** 一个文件：

```js
export const API_DISABLED = false          // 紧急开关
export const RATE_LIMIT = { read: {...}, write: {...} }   // 读写分桶
export const RATE_LIMIT_BY_PATH = { '/api/parent/verify-pin': {...} }
export const CACHE_TTL = { words: 600, home: 15, ... }
```

> 家里多台设备共用同一个出口 IP 导致误伤时，把 `RATE_LIMIT.read.max` 调大即可。

### 已知局限（重要的，别指望它扛住一切）

- **Cache API 按数据中心隔离，不是全局的。** 所以单源攻击（一个 IP）拦得干净，
  **分布式攻击（大量 IP / IPv6 轮换）每个数据中心各算各的**，限流拦不住——那种情况靠边缘缓存兜底
  （无论多少请求，一个 TTL 周期内只读一次 D1）。
- **写后失效同样只清本数据中心**，真正兜底的是短 TTL。
- **限流是"近似"的**：Cache API 没有原子自增，并发下实际放行量可能是阈值的几倍。
- **WAF 那条规则只能减缓、不能保额度**：10 次/秒 × 86400 秒 × 3709 行 远超免费额度。
  它的价值是掐掉突发式扫描，别把它当保险。

### 本地验证

`scripts/dev-api.mjs` 直接复用了生产那份 `_guard` 代码（并注入了一个内存版 Cache API 垫片），
所以**本地和线上跑的是同一套限流逻辑**：

```bash
npm run dev:api

# 连打 65 次，预期前 60 次 200、之后 429
for i in $(seq 1 65); do curl -s -o /dev/null -w "%{http_code} " http://127.0.0.1:8788/api/users; done

# 带 API_DEBUG=1 启动，每个请求会打印实际执行的 SQL 条数，用来确认缓存真的命中
API_DEBUG=1 npm run dev:api
```

### 后续可补强（本次未做）

- **`PUT /api/users/bank` 和 `PUT /api/settings` 仍然没有鉴权**（改词库、改每日目标）。
  它们不像删除那样会丢数据，但理论上任何人都能改。要给它们加 PIN 的话，
  注意 `SettingsView` 是孩子自己用的页面，直接加校验会挡住孩子改每日目标 ——
  更好的做法是这两个端点只允许改「当前登录用户」，这需要一套真正的会话/token。
- **没有真正的鉴权**：`user_id` 依然是唯一凭据，知道 id 就能读写别人的数据。
  限流和缓存只保护**额度**，不保护**数据**。要做的话需要一个签发 token 的流程
  （登录时后端签 token、前端存起来、middleware 校验签名）。

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
| GET/POST/DELETE | /api/users | 用户列表 / 创建（需 PIN）/ 删除（需 PIN，级联清数据） |
| PUT | /api/users/bank | 切换词库 |
| GET | /api/home | 首页聚合（统计 + 待复习 + 剩余新词） |
| GET | /api/today | 今日复习列表（round 参数） |
| GET | /api/review/new | 今日新学回顾（只读） |
| GET | /api/stats | 学习报告聚合 |
| GET | /api/stats/summary | 统计页聚合（本周/上周/上上周三周数据） |
| GET | /api/words | 词库全量（按 `bank_id` 拉取，可边缘缓存；旧客户端传 `user_id` 仍兼容但不缓存） |
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
