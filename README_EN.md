# dsh-balance-monitor

A DeepSeek Harness plugin that shows real-time API account balance in the left sidebar, with multi-provider balance detection, peak/off-peak pricing, per-session & daily cost tracking, and configurable spending limits. Works on both the web GUI and the desktop app (they run the same code).

## Features

- **Sidebar widget** (above Settings): live balance (prominent), today's spend, limit progress, a subtle peak/off-peak dot, plus a manual refresh button when expanded. Each element is individually toggleable.
- **Popover panel**: provider switcher (DeepSeek / Zhipu GLM / OpenRouter / Tavily) with per-provider balance details; today & total spend; limit progress bars; a 7-day bar chart; a monthly calendar heatmap (one cell per day, darker = more spent, full history, month navigation); and a per-session spend list.
- **Peak/off-peak pricing**: DeepSeek rules built in (Beijing-time peak windows 09:00–12:00 & 14:00–18:00, off-peak = half price); editable price table pre-filled with current official V4 rates; costs are computed per request using the exact model and request time.
- **Three spending limits**: daily amount / total amount / LLM request count — each with its own value, behavior when exceeded (warn only / warn and block), and optional sidebar display. "Warn and block" intercepts subsequent LLM requests server-side via the `llm/stream` waterfall.
- **Key management**: fill provider keys in DSH Settings → Balance Monitor (masked, write-only; values never reach the client); DeepSeek reuses the DSH credential `DEEPSEEK_API_KEY` when left empty.
- **Refresh interval**: 5s / 30s / 60s.

## Supported providers

| Provider | Endpoint | Notes |
|---|---|---|
| DeepSeek | `GET /user/balance` | CNY / USD, granted & topped-up shown |
| Zhipu GLM | `GET /api/paas/v4/users/me/balance` | CNY, available/voucher/cash |
| OpenRouter | `GET /api/v1/credits` | USD credit usage |
| Tavily | `GET /usage` | monthly usage & limits per endpoint class |

Not included in v1: OpenAI (no official balance endpoint), Xiaomi MiMo (no public balance API).

## Install

```bash
# from GitHub
dsh plugin --profile web add github:you/dsh-balance-monitor
# local dev
dsh plugin --profile web add link:C:/your/path/dsh-balance-monitor
# npm (after publish)
dsh plugin --profile web add dsh-balance-monitor
```

Then **fully restart DSH** (Quit from the tray on desktop; refresh in the browser). A "Balance Monitor" section appears in DSH Settings.

> `dsh plugin add` appends the plugin to `dsh.profile.bundles` automatically; if the bundle list was not updated, run `dsh plugin --profile web install`.

## Cost model

- Source: DSH session logs (`$DSH_HOME/sessions/.../session.jsonl.zstd`), incrementally parsed — never double-counted.
- Per LLM request: uncached input = `inputTokens − cacheReadTokens` at the `input` rate; cache hits at `cacheHit`; output at `output` (per 1M tokens).
- Requests inside a peak window are priced at the table rate; otherwise multiplied by the off-peak factor (default 0.5).
- Unknown models fall back to the default entry (flash rates) — editable in settings.

## Development

```bash
npm install --ignore-scripts   # just the esbuild build dependency
node build.mjs                 # bundles src/client → lib/client.js
```

Host half: `lib/*.js` — no build step. Client: `src/client/*` (React + TSX) — rebuild with `node build.mjs` and restart.

## License

MIT
