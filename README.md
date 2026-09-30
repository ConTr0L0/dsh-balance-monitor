# dsh-balance-monitor

[English](README_EN.md) | 中文

DSH（DeepSeek Harness）插件：在左侧任务栏实时显示 API 账户余额，支持多平台余额检测、峰谷计价、会话/每日消耗统计与可配置的消耗上限。同时适配 Web 端与桌面端（两者运行同一份代码）。

> **兼容性**：0.4.0 起适配 **DSH 0.2.0-rc.2**（0.2.0 移除了 settings 命名空间注册表）。仍在 0.1.x 上请用 0.3.1。

## 0.4.0 变更（DSH 0.2.0-rc.2 适配）

- **偏好改挂插件自身 Config**：不再 `settingsNamespace()` + `settings.register()`，改为按 **profile 条目 id**（`balance-monitor`）读写，写入走 `settings.update(ns, patch, revision)`，落盘进 profile patch，重启保留；密钥仍由 DSH 按 `role("secret")` 脱敏后再出网。
- **客户端 inject 修正**：删掉 0.2.0 已不存在的 `@deepseek-ai/dsh-client-runtime`（这是插件在插件页显示「异常 / 这个插件包不包含任何组件」的原因），peer 依赖同步到 `^0.2.0-rc.2`。
- 新增 `tests/settings-020-port.mjs`：14 项断言覆盖 settings 投影、写入、`SETTINGS_CONFLICT` 重试与密钥脱敏。

## 功能

- **侧边栏小组件**（设置按钮上方）：实时显示账户余额（醒目）、今日消耗、上限进度、峰谷状态小点；展开时带手动刷新按钮。显示内容可逐项开关。
- **Popover 详情面板**：点击余额打开。
  - 平台下拉切换：DeepSeek 官方 / 智谱 GLM / OpenRouter / Tavily，各自余额明细（总余额/可用/赠送/充值等）
  - 今日消耗、累计消耗、各上限进度
  - 近 7 天消耗柱状图
  - 月度日历热力图（每格一天，颜色越深当日消耗越多，历史全部保留，可翻月）
  - 全部会话消耗列表（按最近排序）
- **峰谷计价**：内置 DeepSeek 官方规则（北京时间**周一至周五** 9:00–12:00、14:00–18:00 为高峰，**周末与中国法定节假日全天为谷时**，谷时半价），**价目由插件自动从 DeepSeek 官方文档页查证并每日同步**（用户无需也不可手填），成本按每个请求的实际发生时间与模型精确计算。同步失败时回退到内置默认价目。
- **三类消耗上限**：每日金额 / 累计金额 / LLM 请求次数，各自可设数值、超限行为（仅提醒 / 提醒并终止）、是否在侧边栏显示。选择「提醒并终止」时，服务端会拦截后续 LLM 请求并返回明确报错。
- **Key 配置**：在 DSH 设置 → 余额监控 中填写各平台 API Key（掩码、写入式，值不过客户端），DeepSeek 留空时自动复用 DSH 凭据 `DEEPSEEK_API_KEY`。
- **刷新频率**：5s / 30s / 60s 可选。

## 已支持平台

| 平台 | 接口 | 说明 |
|---|---|---|
| DeepSeek 官方 | `GET /user/balance` | CNY / USD，含赠送与充值余额 |
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

安装后**完全退出并重启 DSH**（桌面端从托盘 Quit；浏览器版刷新页面），设置页会多出「余额监控」一项。

> `dsh plugin add` 会自动把插件追加进 profile 的 `dsh.profile.bundles`；若 bundle 未更新，补跑 `dsh plugin --profile web install`。

> **桌面端注意**：DeepSeek Harness.exe 跑的是保留 profile `desktop`，CLI 拒绝管理它（报 `profile "desktop" is managed exclusively by the Electron application`）。装到桌面端请走应用内 **插件页 → Add plugin → 填本地目录路径**（如 `C:/DS/dsh-balance-monitor`）。

## 成本计算说明

- 数据来源：DSH 会话日志（`$DSH_HOME/sessions/.../session.jsonl.zstd`），按次增量解析。DSH 会把同一会话内容写入多个 session 文件（父/子会话副本），插件按 `assistant/message` 的唯一 `message.id` 去重后再计费。
- 每次 LLM 请求：未命中输入按 `input` 单价、缓存命中按 `cacheHit` 单价、输出按 `output` 单价（均为高峰价，每百万 token）。现行官方价（2026-09-10 价目页）：`deepseek-flash` 命中 0.04 / 未命中 2 / 输出 8，`deepseek-v4-pro` 命中 0.30 / 未命中 9 / 输出 27。该口径已与 DeepSeek 平台每日账单逐项对账验证（2026-08-22：flash 误差 0.3%，总量误差约 5%，残差来自失败/中断请求的不可见计费）。
- 官方公告：北京时间 2026-09-14 12:00 起至 V4.1 Pro 上线前，`deepseek-v4-pro` 请求全部路由到 V4.1 Flash 并按 Flash 价格计费——插件按请求时间自动跟随该切换，旧模型名（`deepseek-v4-flash` 等）与临时 id（如 `deepseek-v4.1-flash-expires-on-0910`）一律按 Flash 价计费。
- 请求发生在高峰窗口内按价目表原价，否则乘以「谷时折扣」（0.5）。**现行官方规则（2026-09 起）：高峰时段为北京时间周一至周五（不含中国法定节假日）9:00–12:00、14:00–18:00；其余时段，包括周末与中国法定节假日全天均为低谷价。**调休上班的周末仍按周末计谷时（规则看日历周末，不看调休工作日表）。节假日日期表内置在 `lib/holidays.js`（2026 年国办放假安排，每年更新一次）；规则本身仍随每日价目同步自动解析。
- **价目表由插件每日自动验证**（`lib/pricing.js`，源：DeepSeek 官方文档页），未知模型走内置默认价（flash 价），无需手动配置。

## 开发

```bash
npm install --ignore-scripts   # 仅 esbuild 构建依赖
node build.mjs                 # 打包 src/client → lib/client.js
```

测试（无需 DSH 运行）：

```bash
node tests/settings-020-port.mjs    # 0.2 settings 投影 / 写入 / 冲突重试
node --preserve-symlinks tests/host-apply-smoke.mjs   # host 半 + 会话计费
```

- 服务端（host 半）：`lib/*.js`，无构建步骤，改完即生效（重启 DSH）。
- 客户端：`src/client/*`（React + TSX），改完需 `node build.mjs` 重新打包再重启。

## 架构

- `cordis.patch.yml`：bundle 挂载声明（`insert` 插件行），由 `dsh plugin add` 自动同步。
- `lib/index.js`：服务端——会话日志折叠计费、多平台余额轮询、上限拦截（`llm/stream` waterfall）、RPC 通道 `/dsh-balance-monitor`。
- `lib/client.js`：客户端 bundle——`sidebar.footer.action`（侧边栏组件）与 `settings.section`（设置卡片）两个插槽注册。
- 数据存于 `$DSH_HOME/storages/dsh-balance-monitor/state.json`（原子写入）；**偏好即本插件的 Config**（profile 条目 `balance-monitor`，由 DSH settings 投影成表单，密钥脱敏）。

## License

MIT
