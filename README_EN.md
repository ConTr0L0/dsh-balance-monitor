# dsh-balance-monitor

English | [中文](README.md)

A DeepSeek Harness plugin that shows your API account balance in real time in the left sidebar, with multi-provider balance detection, peak/off-peak pricing, per-session and daily cost tracking, and configurable spending limits. Works on both the web GUI and the desktop app (they run the same code).

## Features

- **Sidebar widget** (above Settings): live balance (prominent), today's spend, limit progress, a subtle peak/off-peak dot, plus a manual refresh button when expanded. Each element is individually toggleable. When the sidebar is collapsed, the widget becomes a vertical capsule showing only the peak/off-peak status dot and the balance.
- **Popover panel** (click the balance to open):
  - Provider switcher: DeepSeek / Zhipu GLM / OpenRouter / Tavily, with per-provider balance details (total / available / granted / topped-up …)
  - Today's spend, all-time spend, and per-limit progress bars
  - A 7-day spend bar chart
  - A monthly calendar heatmap (one cell per day, darker = more spent; full history kept, month navigation)
  - A per-session spend list (most recent first, with expandable details)
- **Peak/off-peak pricing**: DeepSeek rules are built in — Beijing-time peak windows 09:00–12:00 and 14:00–18:00, off-peak at half price. **The price table is verified automatically from the official DeepSeek docs page and synced daily** (billing rules are plugin-managed, never user-entered); cost is computed per request using the exact model and request time. A built-in default table is used when the sync fails.
- **Three spending limits**: daily amount / total amount / LLM request count — each with its own value, behavior when exceeded (warn only / warn and block), and an optional sidebar display. "Warn and block" intercepts subsequent LLM requests server-side through the `llm/stream` waterfall.
- **API key management**: fill provider keys in DSH Settings → Balance Monitor (masked, write-only; values never reach the client); DeepSeek automatically reuses the DSH credential `DEEPSEEK_API_KEY` when left empty.
- **Refresh interval**: 5s / 30s / 60s.

## Supported providers

| Provider | Endpoint | Notes |
|---|---|---|
| DeepSeek | `GET /user/balance` | CNY / USD, granted & topped-up shown |
| Zhipu GLM | `GET /api/paas/v4/users/me/balance` | CNY, available / voucher / cash |
| OpenRouter | `GET /api/v1/credits` | USD credit (total / used / remaining) |
| Tavily | `GET /usage` | Monthly usage & limits per endpoint class |

Not included: OpenAI (no official balance endpoint), Xiaomi MiMo (no public balance API).

## Install

### Option 1: from GitHub (recommended)

```bash
dsh plugin --profile web add github:ConTr0L0/dsh-balance-monitor
```

### Option 2: local development (link)

```bash
dsh plugin --profile web add link:C:/your/path/dsh-balance-monitor
```

### Option 3: npm (after publishing)

```bash
dsh plugin --profile web add dsh-balance-monitor
```

After installing, **fully restart DSH** (Quit from the tray on desktop; refresh the page in the browser). A "Balance Monitor" section appears in DSH Settings.

> `dsh plugin add` automatically appends the plugin to `dsh.profile.bundles`; if the bundle list was not updated, run `dsh plugin --profile web install`.

## Cost model

- Source: DSH session logs (`$DSH_HOME/sessions/.../session.jsonl.zstd`), parsed incrementally. DSH writes the same session content into several session files (parent / child-session copies), so the plugin **deduplicates by the unique `assistant/message` `message.id`** before billing — without this, every completion is counted up to 6×.
- Per LLM request: uncached input at the `input` rate, cache-hit input at the `cacheHit` rate (0.10 CNY / 1M), output at the `output` rate (per 1M tokens). The usage fields are disjoint (`inputTokens` is the uncached part; `cacheReadTokens` is the cache-hit part).
- This billing rule was verified item-by-item against the DeepSeek platform daily bill (2026-08-22): flash within 0.3%, total within ~5% — the residual comes from failed/interrupted requests that are billed but never written to the session logs.
- Requests inside a peak window are priced at the table rate; otherwise multiplied by the off-peak factor (0.5).
- Only `deepseek-official` traffic is counted (other gateways such as Aliyun/Zhipu/Xiaomi are excluded).
- The price table is auto-verified daily from the official DeepSeek docs; unknown models fall back to built-in defaults (flash rates). No manual configuration needed.

## Development

```bash
npm install --ignore-scripts   # just the esbuild build dependency
node build.mjs                 # bundles src/client → lib/client.js
```

- Host half: `lib/*.js` — no build step; restart DSH after changes.
- Client: `src/client/*` (React + TSX) — rebuild with `node build.mjs`, then restart.

## Architecture

- `cordis.patch.yml`: bundle mount declaration (`insert` plugin row), kept in sync automatically by `dsh plugin add`.
- `lib/index.js`: host half — session-log folding & billing, multi-provider balance polling, limit enforcement (`llm/stream` waterfall), RPC channel `/dsh-balance-monitor`.
- `lib/client.js`: client bundle — registers the `sidebar.footer.action` (sidebar widget) and `settings.section` (settings card) slots.
- State is stored at `$DSH_HOME/storages/dsh-balance-monitor/state.json` (atomic writes); preferences live in the DSH settings namespace `dsh-balance-monitor` (secrets masked).

## License

MIT
