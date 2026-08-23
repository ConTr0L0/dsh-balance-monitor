/**
 * Shared preferences vocabulary + pricing/cost helpers for
 * dsh-balance-monitor.
 *
 * The host registers the schemastery schema (config.ts) under the settings
 * namespace; the client reads/writes through the plugin's own RPC channel.
 * This module is host-only (schemastery runtime is not browser bundled).
 *
 * @module dsh-balance-monitor/config
 */
import z from "schemastery";

/** The user-settings namespace holding all balance-monitor preferences. */
export const PREFS_NS = "dsh-balance-monitor";

/** Supported balance providers (id → display identity). */
export const PROVIDERS = {
  deepseek: "DeepSeek",
  zhipu: "Zhipu GLM",
  openrouter: "OpenRouter",
  tavily: "Tavily",
};

/** Default peak-price table (CNY per 1M tokens). Peak windows are Beijing
 * time (UTC+8): Mon–Fri 09:00–12:00 and 14:00–18:00; weekends are all-day
 * off-peak; off-peak prices are half. */
export const DEFAULT_MODELS = {
  "deepseek-v4-flash": { input: 3.0, cacheHit: 0.1, output: 9.0 },
  "deepseek-v4-flash-vision-exp": { input: 3.0, cacheHit: 0.1, output: 9.0 },
  "deepseek-v4-pro": { input: 9.0, cacheHit: 0.3, output: 27.0 },
};

/** Fallback pricing for any model not present in the table. */
export const DEFAULT_MODEL_PRICE = { input: 3.0, cacheHit: 0.1, output: 9.0 };

/** Schemastery schema for the limit block (duplicated per limit kind). */
const LimitSchema = z.object({
  enabled: z.boolean().default(false),
  value: z.number().min(0).default(10),
  action: z.union([z.const("warn"), z.const("block")]).default("warn"),
  showInSidebar: z.boolean().default(false),
});

/** Schemastery schema for user-facing preferences. */
export const PrefsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Balance poll interval in seconds (5 / 30 / 60). */
  refreshInterval: z.union([z.const(5), z.const(30), z.const(60)]).default(60),
  providers: z.object({
    deepseek: z.object({
      /** Optional override; empty means "reuse the DSH credentials". */
      apiKey: z.string().role("secret").default(""),
      baseURL: z.string().default("https://api.deepseek.com"),
    }),
    zhipu: z.object({
      apiKey: z.string().role("secret").default(""),
      baseURL: z.string().default("https://open.bigmodel.cn/api/paas/v4"),
    }),
    openrouter: z.object({
      apiKey: z.string().role("secret").default(""),
      baseURL: z.string().default("https://openrouter.ai/api/v1"),
    }),
    tavily: z.object({
      apiKey: z.string().role("secret").default(""),
      baseURL: z.string().default("https://api.tavily.com"),
    }),
  }),
  display: z.object({
    /** Provider id shown in the sidebar / opened by default in the panel. */
    provider: z.string().default("deepseek"),
    /** Which balance figure the sidebar shows: "total" or "available". */
    field: z.union([z.const("total"), z.const("available")]).default("total"),
    /** Model ids shown in the stats charts (empty = all). */
    visibleModels: z.array(z.string()).default([]),
    showBalance: z.boolean().default(true),
    showToday: z.boolean().default(true),
    showRemaining: z.boolean().default(true),
    showPeak: z.boolean().default(true),
    showRefresh: z.boolean().default(true),
  }),
  limits: z.object({
    daily: LimitSchema,
    total: LimitSchema,
    requests: LimitSchema,
  }),
});
/**
 * NOTE: billing rules (model prices, peak windows, off-peak factor) are NOT
 * part of the user settings — the plugin verifies them from the official
 * DeepSeek docs page automatically (lib/pricing.js) and keeps them internal.
 */

/** Apply defaults for direct callers that bypass the Loader. */
export function resolvePrefs(config) {
  return PrefsSchema(config);
}

/** Local-date key (host timezone) for one epoch-millis timestamp. */
export function dayKey(timeMs) {
  const d = new Date(timeMs);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Minutes since midnight in UTC+8 (Beijing) for one epoch-millis timestamp. */
export function beijingMinutes(timeMs) {
  const d = new Date(timeMs + 8 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Parse "HH:MM" into minutes since midnight (validates loosely). */
function hhmm(value) {
  const parts = String(value).split(":");
  return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
}

/**
 * Whether a timestamp falls inside any peak window (Beijing time).
 * Windows are [start, end) minutes; a window with end <= start crosses
 * midnight.
 */
/**
 * Beijing-time weekday (0=Sunday .. 6=Saturday) of a timestamp.
 */
function beijingDay(timeMs) {
  return new Date(timeMs + 8 * 3600_000).getUTCDay();
}

/** Whether the timestamp falls on a Beijing-time weekend (Sat/Sun). */
export function isWeekend(timeMs) {
  const day = beijingDay(timeMs);
  return day === 0 || day === 6;
}

/**
 * Peak-window check (Beijing time). Since 2026-08-23 the official rule is:
 * peak windows 09:00–12:00 & 14:00–18:00 apply MONDAY–FRIDAY only; weekends
 * are all-day off-peak. `weekendOffPeak` gates the weekend exemption.
 */
export function isPeak(timeMs, peakWindows, weekendOffPeak) {
  if (weekendOffPeak && isWeekend(timeMs)) return false;
  const minutes = beijingMinutes(timeMs);
  for (const [startRaw, endRaw] of peakWindows ?? []) {
    const start = hhmm(startRaw);
    const end = hhmm(endRaw);
    if (end > start ? minutes >= start && minutes < end : minutes >= start || minutes < end) return true;
  }
  return false;
}

/** Peak status string for display: "peak" | "off-peak". */
export function peakStatus(timeMs, peakWindows, weekendOffPeak) {
  return isPeak(timeMs, peakWindows, weekendOffPeak) ? "peak" : "off-peak";
}

/**
 * Internal billing calibration.
 *
 * DSH normalizes provider usage with DISJOINT fields: `inputTokens` is the
 * UNCACHED input (it never includes cache reads — cache reads can exceed it),
 * `cacheReadTokens` is the cache-hit part. Charge therefore uses:
 *   cost = input × miss-rate + cacheRead × hit-rate + output × out-rate.
 *
 * Verified against the platform dashboard (2026-08-22, after deduplicating
 * the duplicated session copies): today's official consumption ¥28.41
 * matches this formula with the published hit rate (0.10/M) applied —
 * deduped (miss×3 + hit×0.1 + out×9) × peak factor = ¥27.6. The earlier
 * "cache-hit rate effectively zero" calibration was an artifact of counting
 * the same completions six times and is superseded.
 */
const CACHE_HIT_CHARGED = true;

/**
 * Cost (CNY) of one provider usage record.
 * @param usage - provider usage: inputTokens (uncached), cacheReadTokens
 *   (cache hits), outputTokens — the DSH normalization is disjoint.
 * @param model - model id used for the request.
 * @param timeMs - request timestamp (decides peak/off-peak).
 * @param prices - resolved prices block (peakWindows, offPeakFactor, models).
 */
export function requestCost(usage, model, timeMs, prices) {
  const input = typeof usage.inputTokens === "number" ? usage.inputTokens : 0;
  const cacheRead = typeof usage.cacheReadTokens === "number" ? usage.cacheReadTokens : 0;
  const output = typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
  const table = prices?.models ?? {};
  const entry = (model && table[model]) || DEFAULT_MODEL_PRICE;
  const factor = isPeak(timeMs, prices?.peakWindows, prices?.weekendOffPeak) ? 1 : (prices?.offPeakFactor ?? 0.5);
  const hitRate = CACHE_HIT_CHARGED ? entry.cacheHit : 0;
  const cost = ((input * entry.input + cacheRead * hitRate + output * entry.output) / 1_000_000) * factor;
  return {
    cost,
    peak: factor === 1,
    tokens: { uncached: input, cacheRead, output },
  };
}

/** Format a CNY amount for display (keep 4 decimals for tiny costs). */
export function formatCost(value) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1) return `¥${value.toFixed(2)}`;
  if (value >= 0.01) return `¥${value.toFixed(3)}`;
  return `¥${value.toFixed(5)}`;
}
