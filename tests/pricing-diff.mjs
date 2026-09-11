/**
 * Unit tests for diffPricing — the pure change detector that powers the
 * pricing-change popup. The host queues a notice ONLY when diffPricing says
 * `any: true`, so this must be exact in both directions: no notice for
 * identical tables, no silence for real changes.
 *
 * Run from the plugin root: node tests/pricing-diff.mjs
 */
import { diffPricing } from "../lib/pricing.js";

const checks = [];
const check = (label, ok, detail) => { checks.push([label, ok, detail]); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const flash = { input: 2, cacheHit: 0.04, output: 8 };
const pro = { input: 9, cacheHit: 0.3, output: 27 };
const base = () => ({
  source: "deepseek-docs",
  fetchedAt: 1,
  models: { "deepseek-flash": { ...flash }, "deepseek-v4-pro": { ...pro } },
  peakWindows: [["09:00", "12:00"], ["14:00", "18:00"]],
  offPeakFactor: 0.5,
  weekendOffPeak: true,
});

// 1) identical tables → no change
{
  const d = diffPricing(base(), base());
  check("identical tables → any=false", d.any === false, JSON.stringify(d));
  check("identical tables → all rows unchanged", d.models.every((m) => m.status === "unchanged") && d.rules.every((r) => !r.changed), JSON.stringify(d));
}

// 2) price change detected with old + new values
{
  const next = base();
  next.models["deepseek-flash"] = { input: 2.5, cacheHit: 0.04, output: 8 };
  const d = diffPricing(base(), next);
  const row = d.models.find((m) => m.id === "deepseek-flash");
  check("price change → any=true", d.any === true, JSON.stringify(d));
  check("price change → row status changed", row?.status === "changed", JSON.stringify(row));
  check("price change → row keeps old and new values", eq(row?.prev, flash) && eq(row?.next, { input: 2.5, cacheHit: 0.04, output: 8 }), JSON.stringify(row));
  check("price change → other model unchanged", d.models.find((m) => m.id === "deepseek-v4-pro")?.status === "unchanged");
}

// 3) added / removed models
{
  const next = base();
  delete next.models["deepseek-v4-pro"];
  next.models["deepseek-v4.1-pro"] = { input: 12, cacheHit: 0.4, output: 36 };
  const d = diffPricing(base(), next);
  check("removed model flagged", d.models.find((m) => m.id === "deepseek-v4-pro")?.status === "removed");
  check("added model flagged", d.models.find((m) => m.id === "deepseek-v4.1-pro")?.status === "added");
  check("add/remove → any=true", d.any === true);
}

// 4) rule changes: peak windows, factor, weekend
{
  const next = base();
  next.peakWindows = [["09:00", "11:00"], ["14:00", "18:00"]];
  const d = diffPricing(base(), next);
  check("peak window change → any=true", d.any === true);
  check("peak window row changed", d.rules.find((r) => r.key === "peakWindows")?.changed === true);
}
{
  const next = base();
  next.offPeakFactor = 0.4;
  check("off-peak factor change detected", diffPricing(base(), next).any === true);
}
{
  const next = base();
  next.weekendOffPeak = false;
  const d = diffPricing(base(), next);
  check("weekend rule change detected", d.any === true && d.rules.find((r) => r.key === "weekendOffPeak")?.changed === true);
}

// 5) tolerance: garbage / missing sides never crash, never claim a change
{
  check("null prev → any=false", diffPricing(null, base()).any === false);
  check("undefined next → any=false", diffPricing(base(), undefined).any === false);
  check("garbage inputs → any=false", diffPricing("x", 42).any === false);
  const half = { source: "deepseek-docs", fetchedAt: 1, models: { "deepseek-flash": { ...flash } } };
  const d = diffPricing(half, base());
  check("missing rule fields tolerated", d.any === true || d.models.every((m) => m.status === "unchanged"), JSON.stringify(d));
}

// 6) floating-point noise must not fire a notice (0.04 vs 0.040000001 from a re-parse)
{
  const next = base();
  next.models["deepseek-flash"] = { ...flash, cacheHit: 0.04 + 1e-12 };
  check("float noise → any=false", diffPricing(base(), next).any === false, JSON.stringify(diffPricing(base(), next)));
}

let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
