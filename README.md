# dsh-balance-monitor

[English](README_EN.md) | 中文

DSH（DeepSeek Harness）插件：在左侧任务栏实时显示 API 账户余额，支持多平台余额检测、峰谷计价、会话/每日消耗统计与可配置的消耗上限。同时适配 Web 端与桌面端（两者运行同一份代码）。

> **兼容性**：0.6.0 起在左侧工作栏提供整页面板，仍需 **DSH 0.2.0-rc.2**。仍在 0.1.x 上请用 0.3.1。

## 0.6.0 变更（左侧工作栏整页面板）

- **入口搬家**：余额监控从 DSH 设置移到左侧工作栏——新增 `sidebar.panellist` 行（「余额监控」，排在插件 / 使用统计等入口之间），同一 id 的 `main` 键位插槽把面板**整页**渲染在主区，行为与官方「插件」页一致（`ctx.layout.selectPanel(id)` 选中、带返回按钮）。
- **不再重复挂载**：设置里的「余额监控」一项已移除；页面本体复用同一份 `SettingsCard`，两处不会各自漂移。
- **面板位置**：`order: 40` —— 官方 插件(0) / 任务(10)、已装的 使用统计(30) 之后。
- 新增 `tests/client-registration.mjs`：24 项断言，按浏览器的 `window.__ModuleLoader__` 方式加载真正打好的 `lib/client.js`，断言行/键配对、注入的 `rpc`/`goBack`、返回控件导航（含记住项的插槽已注销时回退会话页）与两个组件的实际渲染。

## 0.5.0 变更（账号登录余额）

- **余额来源**：DeepSeek 余额新增账号登录通道——`ctx.deepseekAccount.getBalance()` 读取 Platform 钱包（充值 `normal_wallets` + 赠金 `bonus_wallets`），已登录账号无需 API Key。
- **来源偏好**：设置页新增「DeepSeek 余额来源」= 自动（账号优先，未登录回退 API Key）/ 仅账号登录 / 仅 API Key；默认自动，原有 Key 用户行为不变。
- **不伪造金额**：账号未登录返回 `null`、查询失败返回 `failed`，两者都保持「查不到」而不是 0 余额；账号路径失败不触发密集重试（Platform 查询默认 30s 超时）。
- 新增 `tests/account-balance.mjs`（钱包归一化 + 来源决策，31 项）与 `tests/account-login-flow.mjs`（真实 host 半驱动 RPC，验证账号/API Key 两条路径与回退，21 项）。
- 修复 0.4.0 遗留在旧 `connection` RPC 上的两个测试（`tests/balance-resilience.mjs`、`tests/pricing-notice-flow.mjs`），改为驱动 0.2 的前缀路由——余额重试 / 陈旧快照 / 非重试 401 的覆盖随之恢复。

## 0.4.0 变更（DSH 0.2.0-rc.2 适配）

0.2.0 拆掉了插件用到的三样东西，逐条替换：

- **客户端通道**：0.2.0 不再把 `connection` 服务交给 profile 插件，`connection.rpc.handle()` 静默失效（浏览器看到的是静态处理的 **HTTP 405**）。改为宿主用 `ctx.webServer.register()` 挂一条带 Host/Origin + loopback 围栏的 `POST /dsh-balance-monitor/<endpoint>` 前缀路由，客户端同源 `fetch` 调用（`lib/rpc.js`）。
- **偏好存储**：0.2.0 的 settings 只投影它自己的 config editor 认可的条目，profile 装的外部 bundle 行不在其中（实测 `settings.describe()` 不返回本插件行、写入会抛错）。改为插件自己持久化到 `$DSH_HOME/storages/dsh-balance-monitor/prefs.json`（原子写 + revision 乐观锁），设置页交互不变。
- **客户端 inject**：去掉 0.2.0 已不存在的 `@deepseek-ai/dsh-client-runtime`（这正是插件页显示「异常 / 这个插件包不包含任何组件」的原因），peer 依赖同步到 `^0.2.0-rc.2`。
- 新增 `tests/rpc-prefs-020.mjs`：15 项断言覆盖路由围栏、偏好读写、revision 冲突重试与密钥脱敏。

## 功能

- **左侧工作栏整页面板**：左侧栏新增「余额监控」行（排在插件 / 使用统计等入口之间），点击即在主区**整页打开**完整面板（余额、消耗统计、图表、上限与全部设置），带返回按钮；设置里不再重复挂一项。
- **侧边栏小组件**（设置按钮上方）：实时显示账户余额（醒目）、今日消耗、上限进度、峰谷状态小点；展开时带手动刷新按钮。显示内容可逐项开关。
- **Popover 详情面板**：点击余额打开。
  - 平台下拉切换：DeepSeek 官方 / 智谱 GLM / OpenRouter / Tavily，各自余额明细（总余额/可用/赠送/充值等）
  - 今日消耗、累计消耗、各上限进度
  - 近 7 天消耗柱状图
  - 每日 Token 堆叠图（7 / 14 / 30 天，可按模型筛选，覆盖 DSH 日志中的各供应商）
  - 消耗热力图（30 天 / 90 天 / 一年；按 DeepSeek 已计价金额着色，悬停查看金额与 Token）
  - 全部会话消耗列表（按最近排序）
- **峰谷计价**：内置 DeepSeek 官方规则（北京时间**周一至周五** 9:00–12:00、14:00–18:00 为高峰，**周末与中国法定节假日全天为谷时**，谷时半价），**价目由插件自动从 DeepSeek 官方文档页查证并每日同步**（用户无需也不可手填），成本按每个请求的实际发生时间与模型精确计算。同步失败时回退到内置默认价目。
- **三类消耗上限**：每日金额 / 累计金额 / LLM 请求次数，各自可设数值、超限行为（仅提醒 / 提醒并终止）、是否在侧边栏显示。选择「提醒并终止」时，服务端会拦截后续 LLM 请求并返回明确报错。
- **Key 配置**：在左侧栏「余额监控」页中填写各平台 API Key（掩码、写入式，值不过客户端）。
- **账号登录免 Key**（DeepSeek）：已登录 DSH 的 DeepSeek 账号时，余额直接读账号服务 `ctx.deepseekAccount.getBalance()`（Platform 钱包：充值 + 赠金），无需 API Key。设置中可选「自动（已登录账号优先）/ 仅账号登录 / 仅 API Key」，默认自动——未登录时自动复用 DSH 凭据 `DEEPSEEK_API_KEY`。
- **刷新频率**：5s / 30s / 60s 可选。

## 已支持平台

| 平台 | 接口 | 说明 |
|---|---|---|
| DeepSeek 官方（账号登录） | Platform `GET /api/v0/users/get_user_summary`（经 `ctx.deepseekAccount.getBalance()`） | CNY / USD，充值 + 赠金；已登录账号无需 API Key |
| DeepSeek 官方（API Key） | `GET /user/balance` | CNY / USD，含赠送与充值余额 |
| 智谱 GLM | `GET /api/paas/v4/users/me/balance` | CNY，含可用/代金券/现金 |
| OpenRouter | `GET /api/v1/credits` | USD 额度（总额/已用/剩余） |
| Tavily | `GET /usage` | 本月用量与限额（搜索/抽取等分类用量） |

首版不包含：OpenAI（无官方余额接口）、小米 MiMo（无公开余额 API）——两者仅能在各自控制台查看。

## 安装

### 方式一：从 GitHub（推荐）

```bash
dsh plugin --profile web add github:ConTr0L0/dsh-balance-monitor
```

### 方式二：本地开发（link）

```bash
dsh plugin --profile web add link:C:/你的路径/dsh-balance-monitor
```

### 方式三：npm（发布后）

```bash
dsh plugin --profile web add dsh-balance-monitor
```

安装后**完全退出并重启 DSH**（桌面端从托盘 Quit；浏览器版刷新页面），左侧工作栏会多出「余额监控」一行，点击在主区整页打开。

> `dsh plugin add` 会自动把插件追加进 profile 的 `dsh.profile.bundles`；若 bundle 未更新，补跑 `dsh plugin --profile web install`。

> **桌面端注意**：DeepSeek Harness.exe 跑的是保留 profile `desktop`，CLI 拒绝管理它（报 `profile "desktop" is managed exclusively by the Electron application`）。装到桌面端请走应用内 **插件页 → Add plugin → 填本地目录路径**（如 `C:/DS/dsh-balance-monitor`）。

## 成本计算说明

- 数据来源：DSH 会话日志（`session.jsonl.zstd`、`session.v3.jsonl.zstd`、`session.v4.jsonl.zstd`），按次增量解析。DSH 会把同一会话内容写入多个 session 文件（父/子会话副本），插件按 `assistant/message` 的唯一 `message.id` 去重后再计费。
- 每次 LLM 请求：未命中输入按 `input` 单价、缓存命中按 `cacheHit` 单价、输出按 `output` 单价（均为高峰价，每百万 token）。现行官方价（2026-09-10 价目页）：`deepseek-flash` 命中 0.04 / 未命中 2 / 输出 8，`deepseek-v4-pro` 命中 0.30 / 未命中 9 / 输出 27。该口径已与 DeepSeek 平台每日账单逐项对账验证（2026-08-22：flash 误差 0.3%，总量误差约 5%，残差来自失败/中断请求的不可见计费）。
- 官方公告：北京时间 2026-09-14 12:00 起至 V4.1 Pro 上线前，`deepseek-v4-pro` 请求全部路由到 V4.1 Flash 并按 Flash 价格计费——插件按请求时间自动跟随该切换，旧模型名（`deepseek-v4-flash` 等）与临时 id（如 `deepseek-v4.1-flash-expires-on-0910`）一律按 Flash 价计费。
- **模型 / Token 统计**：收录 DSH 会话日志中所有供应商的 usage；DeepSeek 官方 API 与 DeepSeek 账号线路按 DeepSeek 官方价目计费，其他供应商显示为「供应商/模型」并只统计 Token。升级后会从现有会话日志补扫历史模型并补算 DeepSeek 账号线路费用。
- 请求发生在高峰窗口内按价目表原价，否则乘以「谷时折扣」（0.5）。**现行官方规则（2026-09 起）：高峰时段为北京时间周一至周五（不含中国法定节假日）9:00–12:00、14:00–18:00；其余时段，包括周末与中国法定节假日全天均为低谷价。**调休上班的周末仍按周末计谷时（规则看日历周末，不看调休工作日表）。节假日日期表内置在 `lib/holidays.js`（2026 年国办放假安排，每年更新一次）；规则本身仍随每日价目同步自动解析。
- **价目表由插件每日自动验证**（`lib/pricing.js`，源：DeepSeek 官方文档页），DeepSeek 官方未知模型走内置默认价（flash 价），无需手动配置。

## 开发

```bash
npm install --ignore-scripts   # 仅 esbuild 构建依赖
node build.mjs                 # 打包 src/client → lib/client.js
```

测试（无需 DSH 运行）：

```bash
node tests/rpc-prefs-020.mjs    # 围栏路由 + 偏好读写 + revision 冲突
node --preserve-symlinks tests/host-apply-smoke.mjs   # host 半 + 会话计费
```

- 服务端（host 半）：`lib/*.js`，无构建步骤，改完即生效（重启 DSH）。
- 客户端：`src/client/*`（React + TSX），改完需 `node build.mjs` 重新打包再重启。

## 架构

- `cordis.patch.yml`：bundle 挂载声明（`insert` 插件行），由 `dsh plugin add` 自动同步。
- `lib/index.js`：服务端——会话日志折叠计费、多平台余额轮询、上限拦截（`llm/stream` waterfall）。
- `lib/rpc.js`：围栏前缀路由（`POST /dsh-balance-monitor/<endpoint>`，Host/Origin + loopback 校验）。
- `lib/client.js`：客户端 bundle——`sidebar.panellist`（左侧栏「余额监控」行）+ `main`（该行选中的整页面板）+ `sidebar.footer.action`（侧边栏小组件）三个插槽注册。
- 数据：账本 `$DSH_HOME/storages/dsh-balance-monitor/state.json`，偏好 `.../prefs.json`（均为原子写入；密钥只存本地，出网前由 `config/get` 脱敏）。

## License

MIT
