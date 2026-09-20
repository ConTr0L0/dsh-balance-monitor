/**
 * Official-pricing synchronization for dsh-balance-monitor.
 *
 * The plugin verifies DeepSeek's published price table from the official docs
 * page and maintains it internally — users never enter billing rules. The
 * parse is LABEL-DRIVEN, not positional: each price slot is addressed by
 * (metric 缓存命中/缓存未命中/输出) × (period 空闲/高峰) and every model column
 * must be present, so cosmetic relayouts resolve while a genuinely changed
 * page fails loud (null → keep the last good snapshot) instead of silently
 * mispricing. Verified against the 2026-09-10 page layout (rows carry one
 * metric label, then 空闲/高峰 rows with one value per model column).
 *
 * @module dsh-balance-monitor/pricing
 */
import { DEFAULT_MODEL_PRICE, DEFAULT_MODELS } from "./config.js";

export const OFFICIAL_PRICING_URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";

/** Built-in fallback pricing (used only until the first successful sync). */
export function defaultPricing() {
  return {
    source: "built-in",
    fetchedAt: 0,
    models: { ...DEFAULT_MODELS },
    peakWindows: [
      ["09:00", "12:00"],
      ["14:00", "18:00"],
    ],
    offPeakFactor: 0.5,
    // Official rule since 2026-08-23: weekends (Sat/Sun) are all-day off-peak.
    weekendOffPeak: true,
    // Official rule since 2026-09: Chinese statutory holidays are off-peak too.
    holidayOffPeak: true,
  };
}

/** Extract numeric values of the shape "0.10元" from a cell. */
function priceOf(cell) {
  const match = /([0-9]+(?:\.[0-9]+)?)元/.exec(cell);
  return match === null ? null : Number(match[1]);
}

/** Extract "HH:MM" pairs from the footnote text. */
function windowsFrom(text) {
  const pairs = [];
  for (const match of text.matchAll(/([0-9]{1,2}):([0-9]{2})/g)) {
    const hour = Number(match[1]);
    if (hour > 24) continue;
    pairs.push(`${String(hour).padStart(2, "0")}:${match[2]}`);
  }
  const windows = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) windows.push([pairs[i], pairs[i + 1]]);
  return windows.length > 0 ? windows : null;
}

/** Metric keyword → slot key. 未命中 must be tested before 命中 (substring). */
function metricOf(text) {
  if (/缓存未命中/.test(text)) return "miss";
  if (/缓存命中/.test(text)) return "hit";
  if (/tokens输出/.test(text)) return "out";
  return null;
}

function periodOf(text) {
  if (/空闲时段/.test(text)) return "off";
  if (/高峰时段/.test(text)) return "peak";
  return null;
}

/**
 * Parse the official pricing page.
 * @returns the pricing structure, or null when the page layout changed.
 */
export function parsePricingHtml(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => {
    const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
      cell[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    );
    return cells;
  });

  // Header row: ["模型", "<id-1>(fn)", "<id-2>(fn)", …]. Any deepseek-* id is
  // accepted (the 2026-09-10 page renamed deepseek-v4-flash → deepseek-flash);
  // trailing footnote markers like "(1)" are not part of the id.
  const modelRow = rows.find((cells) => cells[0] === "模型");
  if (!modelRow) return null;
  const modelIds = modelRow
    .slice(1)
    .map((cell) => cell.match(/deepseek-[\w.-]*/g)?.[0] ?? null)
    .filter((id) => id !== null);
  if (modelIds.length === 0) return null;

  const priceIndex = rows.findIndex((cells) => cells.some((cell) => cell.startsWith("价格")));
  if (priceIndex === -1) return null;

  // Label-driven slots: metric persists across the 空闲/高峰 rows of one
  // metric group and resets when the metric changes; every values row must
  // carry its own period label. Values map positionally onto modelIds.
  const slots = {};
  let metric = null;
  let period = null;
  for (const cells of rows.slice(priceIndex)) {
    if (cells.some((cell) => cell.startsWith("并发"))) break;
    const text = cells.join(" ");
    const nextMetric = metricOf(text);
    if (nextMetric !== null && nextMetric !== metric) {
      metric = nextMetric;
      period = null;
    }
    const nextPeriod = periodOf(text);
    if (nextPeriod !== null) period = nextPeriod;
    if (metric === null || period === null) continue;
    const values = cells.map(priceOf).filter((value) => value !== null);
    if (values.length === 0) continue;
    if (values.length !== modelIds.length) return null; // column misalignment: fail loud
    slots[`${metric}:${period}`] = values;
  }

  // Every model needs all six slots — a partial table must not price anything.
  const models = {};
  for (let i = 0; i < modelIds.length; i += 1) {
    const hitOff = slots["hit:off"]?.[i];
    const hitPeak = slots["hit:peak"]?.[i];
    const missOff = slots["miss:off"]?.[i];
    const missPeak = slots["miss:peak"]?.[i];
    const outOff = slots["out:off"]?.[i];
    const outPeak = slots["out:peak"]?.[i];
    if ([hitOff, hitPeak, missOff, missPeak, outOff, outPeak].some((value) => typeof value !== "number")) return null;
    models[modelIds[i]] = { input: missPeak, cacheHit: hitPeak, output: outPeak };
  }

  /**
   * Footnote: peak windows, the off-peak factor and the holiday exemption.
   * Anchored on the rules' lead sentence ("空闲时段价格为高峰时段价格的一半"),
   * which survived the 2026-09 reword to "北京时间周一至周五（不含中国法定节假日）
   * 9:00 - 12:00、14:00 - 18:00 为高峰时段；其余时段，包括周末及中国法定节假日
   * 全天均为空闲时段". If even that sentence disappears, scan the whole page:
   * degrading to "no exemption" would silently overcharge every weekend.
   */
  const footnote = html.match(/空闲时段价格为高峰时段价格的一半[\s\S]{0,400}/)?.[0] ?? html;
  const peakWindows = windowsFrom(footnote) ?? [
    ["09:00", "12:00"],
    ["14:00", "18:00"],
  ];
  const offPeakFactor = /空闲时段价格为高峰时段价格的一半/.test(html) ? 0.5 : 0.5;
  // Official rule since 2026-08-23: peak windows apply Mon–Fri only; weekends
  // (and any 周末/周六/周日 wording in the footnote) are all-day off-peak.
  const weekendOffPeak = /周一至周五|周六|周日|周末/.test(footnote);
  // Official rule since 2026-09: "（不含中国法定节假日）…中国法定节假日全天均为空闲时段".
  const holidayOffPeak = /法定节假日/.test(footnote);

  return {
    source: "deepseek-docs",
    fetchedAt: Date.now(),
    models,
    peakWindows,
    offPeakFactor,
    weekendOffPeak,
    holidayOffPeak,
  };
}

/** Fetch and parse the official pricing page. */
export async function fetchOfficialPricing(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(OFFICIAL_PRICING_URL, {
      headers: {
        "user-agent": "Mozilla/5.0 (dsh-balance-monitor pricing sync)",
        accept: "text/html",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const html = await response.text();
    const pricing = parsePricingHtml(html);
    if (!pricing) return { ok: false, error: "unrecognized pricing page layout" };
    return { ok: true, pricing };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Validate a persisted pricing object (defensive against old state shapes). */
export function sanitizePricing(value) {
  if (!value || typeof value !== "object") return null;
  const models = value.models ?? {};
  const validModels = {};
  for (const [id, entry] of Object.entries(models)) {
    if (!entry || typeof entry !== "object") continue;
    const input = Number(entry.input);
    const cacheHit = Number(entry.cacheHit);
    const output = Number(entry.output);
    if ([input, cacheHit, output].every((n) => Number.isFinite(n) && n >= 0)) {
      validModels[id] = { input, cacheHit, output };
    }
  }
  if (Object.keys(validModels).length === 0) return null;
  const windows = Array.isArray(value.peakWindows) ? value.peakWindows : [["09:00", "12:00"], ["14:00", "18:00"]];
  return {
    source: value.source === "deepseek-docs" ? "deepseek-docs" : "built-in",
    fetchedAt: typeof value.fetchedAt === "number" ? value.fetchedAt : 0,
    models: validModels,
    peakWindows: windows,
    offPeakFactor: typeof value.offPeakFactor === "number" ? value.offPeakFactor : 0.5,
    weekendOffPeak: value.weekendOffPeak !== false,
    holidayOffPeak: value.holidayOffPeak !== false,
  };
}

/** Compare one price triple with float tolerance (re-parses of the same page
 *  must never produce 0.04 vs 0.040000001 noise notices). */
function samePrice(a, b) {
  return Math.abs(a.input - b.input) < 1e-9 && Math.abs(a.cacheHit - b.cacheHit) < 1e-9 && Math.abs(a.output - b.output) < 1e-9;
}

/**
 * Diff two pricing snapshots into a popup-ready change report.
 * @returns `{ any, models, rules }` — `any` is true when at least one model
 *   price or billing rule (peak windows / off-peak factor / weekend rule)
 *   differs. Nullish or malformed sides yield `any: false` (nothing to claim).
 */
export function diffPricing(prev, next) {
  const p = sanitizePricing(prev);
  const n = sanitizePricing(next);
  if (!p || !n) return { any: false, models: [], rules: [] };

  const models = [];
  for (const id of [...new Set([...Object.keys(p.models), ...Object.keys(n.models)])]) {
    const a = p.models[id] ?? null;
    const b = n.models[id] ?? null;
    const status = a === null ? "added" : b === null ? "removed" : samePrice(a, b) ? "unchanged" : "changed";
    models.push({ id, prev: a, next: b, status });
  }

  const sameJson = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const rules = [
    { key: "peakWindows", prev: p.peakWindows, next: n.peakWindows, changed: !sameJson(p.peakWindows, n.peakWindows) },
    { key: "offPeakFactor", prev: p.offPeakFactor, next: n.offPeakFactor, changed: !sameJson(p.offPeakFactor, n.offPeakFactor) },
    { key: "weekendOffPeak", prev: p.weekendOffPeak, next: n.weekendOffPeak, changed: !sameJson(p.weekendOffPeak, n.weekendOffPeak) },
    { key: "holidayOffPeak", prev: p.holidayOffPeak, next: n.holidayOffPeak, changed: !sameJson(p.holidayOffPeak, n.holidayOffPeak) },
  ];

  return {
    any: models.some((m) => m.status !== "unchanged") || rules.some((r) => r.changed),
    models,
    rules,
  };
}

export { DEFAULT_MODEL_PRICE };
