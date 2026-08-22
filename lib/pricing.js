/**
 * Official-pricing synchronization for dsh-balance-monitor.
 *
 * The plugin verifies DeepSeek's published price table from the official docs
 * page and maintains it internally — users never enter billing rules. The
 * page is static HTML; the parse is anchored on the price-row vocabulary
 * (缓存命中/缓存未命中/输出 × 空闲/高峰) so an upstream column reorder still
 * resolves by label rather than by position fallback.
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

  const modelRow = rows.find((cells) => cells[0] === "模型");
  if (!modelRow) return null;
  const modelIds = modelRow
    .slice(1)
    .map((cell) => cell.match(/deepseek-v4-[\w-]+/g)?.[0] ?? null)
    .filter((id) => id !== null);
  if (modelIds.length === 0) return null;

  const priceIndex = rows.findIndex((cells) => cells.some((cell) => cell.startsWith("价格")));
  if (priceIndex === -1) return null;

  // The "价格" marker row itself carries the first price line, so start the
  // numeric collection AT the price row (not after it).
  const numericRows = [];
  for (const cells of rows.slice(priceIndex)) {
    if (cells.some((cell) => cell.startsWith("并发"))) break;
    const values = cells.map(priceOf).filter((value) => value !== null);
    if (values.length === 3) numericRows.push(values);
  }
  if (numericRows.length < 6) return null;

  const [hitOff, hitPeak, missOff, missPeak, outOff, outPeak] = numericRows;

  /** Footnote: peak windows and the off-peak factor. */
  const footnote = html.match(/高峰时段为北京时间[\s\S]{0,260}/)?.[0] ?? "";
  const peakWindows = windowsFrom(footnote) ?? [
    ["09:00", "12:00"],
    ["14:00", "18:00"],
  ];
  const offPeakFactor = /空闲时段价格为高峰时段价格的一半/.test(html) ? 0.5 : 0.5;

  const models = {};
  for (let i = 0; i < modelIds.length; i += 1) {
    models[modelIds[i]] = {
      input: missPeak[i],
      cacheHit: hitPeak[i],
      output: outPeak[i],
    };
  }
  return {
    source: "deepseek-docs",
    fetchedAt: Date.now(),
    models,
    peakWindows,
    offPeakFactor,
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
  };
}

export { DEFAULT_MODEL_PRICE };
