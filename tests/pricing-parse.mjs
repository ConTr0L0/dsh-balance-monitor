/**
 * Pricing parser + billing-rule tests.
 *
 * The fixture is the REAL official page captured 2026-09-11 (the 2026-09-10
 * relayout that broke the old positional parser). Asserts:
 *  1. the live-layout fixture parses to exactly the official table
 *  2. unknown layouts fail loud (null), never misprice
 *  3. the announced deepseek-v4-pro → Flash reroute (Beijing 2026-09-14 12:00)
 *     bills pro requests at Flash prices from the cutoff on
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePricingHtml } from "../lib/pricing.js";
import { requestCost, DEFAULT_MODEL_PRICE } from "../lib/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "fixtures", "official-pricing-2026-09-10.html"), "utf8");

const checks = [];
const check = (label, ok, detail) => { checks.push([label, ok, detail]); };

// 1) real page → official table
const pricing = parsePricingHtml(fixture);
check("fixture parses", pricing !== null, pricing === null ? "parsePricingHtml returned null" : "");
if (pricing) {
  check("model ids", JSON.stringify(Object.keys(pricing.models)) === JSON.stringify(["deepseek-flash", "deepseek-v4-pro"]), JSON.stringify(Object.keys(pricing.models)));
  check("deepseek-flash = 2 / 0.04 / 8 (peak)", JSON.stringify(pricing.models["deepseek-flash"]) === JSON.stringify({ input: 2, cacheHit: 0.04, output: 8 }), JSON.stringify(pricing.models["deepseek-flash"]));
  check("deepseek-v4-pro = 9 / 0.3 / 27 (peak, unchanged)", JSON.stringify(pricing.models["deepseek-v4-pro"]) === JSON.stringify({ input: 9, cacheHit: 0.3, output: 27 }), JSON.stringify(pricing.models["deepseek-v4-pro"]));
  check("peak windows 09-12 / 14-18", JSON.stringify(pricing.peakWindows) === JSON.stringify([["09:00", "12:00"], ["14:00", "18:00"]]), JSON.stringify(pricing.peakWindows));
  check("off-peak factor 0.5", pricing.offPeakFactor === 0.5, String(pricing.offPeakFactor));
  check("weekends all-day off-peak", pricing.weekendOffPeak === true, String(pricing.weekendOffPeak));
  check("source deepseek-docs", pricing.source === "deepseek-docs", pricing.source);
}

// 2) fail loud on unknown layouts
check("empty html → null", parsePricingHtml("") === null);
check("page without a 模型 row → null", parsePricingHtml("<html><body><p>hello</p></body></html>") === null);
const noMetric = fixture.replaceAll("缓存未命中", "缓存X命中");
check("missing a metric slot → null (no silent mispricing)", parsePricingHtml(noMetric) === null);
const fewerModels = fixture.replace("0.15元", "0.15"); // drops one value cell → 1 value for 2 columns
check("value/model column mismatch → null", parsePricingHtml(fewerModels) === null);

// 3) reroute: deepseek-v4-pro bills at Flash prices from Beijing 2026-09-14 12:00
const usage = { inputTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 0 };
const beforeCutoff = Date.parse("2026-09-11T15:00:00+08:00"); // Friday peak
const afterCutoff = Date.parse("2026-09-14T15:00:00+08:00");  // Monday peak
const costBefore = requestCost(usage, "deepseek-v4-pro", beforeCutoff, pricing).cost;
const costAfter = requestCost(usage, "deepseek-v4-pro", afterCutoff, pricing).cost;
check("pro before cutoff → 9.0 元/M (peak)", Math.abs(costBefore - 9.0) < 1e-9, String(costBefore));
check("pro after cutoff → 2.0 元/M (flash peak)", Math.abs(costAfter - 2.0) < 1e-9, String(costAfter));
check("legacy flash id falls to Flash default", DEFAULT_MODEL_PRICE.input === 2 && DEFAULT_MODEL_PRICE.cacheHit === 0.04 && DEFAULT_MODEL_PRICE.output === 8, JSON.stringify(DEFAULT_MODEL_PRICE));
const legacyCost = requestCost(usage, "deepseek-v4.1-flash-expires-on-0910", beforeCutoff, pricing).cost;
check("temp id v4.1-flash-expires-on-0910 → Flash price", Math.abs(legacyCost - 2.0) < 1e-9, String(legacyCost));

let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
