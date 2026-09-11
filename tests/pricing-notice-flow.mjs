/**
 * Integration flow test for the pricing-change popup (host half).
 *
 * Exercises the real plugin module (through the profile junction) with a
 * controllable official-page fetch and a minimal settings stub:
 *
 *   1. first-ever sync (no previous official pricing) → NO notice
 *   2. sync with a changed price                      → notice queued with
 *      correct old/new snapshots; `overview` RPC exposes it
 *   3. `pricing-notice/ack` RPC                       → notice cleared in
 *      memory AND in the persisted state
 *   4. re-sync with unchanged page                    → still no notice
 *
 * DSH_HOME is redirected to a throwaway directory before import, so the real
 * ledger is never touched. Run from the plugin root:
 *   node --preserve-symlinks tests/pricing-notice-flow.mjs
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SANDBOX_HOME = mkdtempSync(join(tmpdir(), "bm-notice-"));
process.env.DSH_HOME = SANDBOX_HOME;

const PLUGIN_DIR = "C:\\DS\\dsh-balance-monitor";
const fromPlugin = (relative) => pathToFileURL(join(PLUGIN_DIR, relative)).href;

const { apply } = await import(fromPlugin("lib/index.js"));
const { loadState } = await import(fromPlugin("lib/store.js"));
const { PrefsSchema } = await import(fromPlugin("lib/config.js"));

const fixtureA = readFileSync(join(PLUGIN_DIR, "tests", "fixtures", "official-pricing-2026-09-10.html"), "utf8");
if (!fixtureA.includes("0.04元")) throw new Error("fixture A does not contain the expected 0.04元 price cell");
const fixtureB = fixtureA.replaceAll("0.04元", "0.05元"); // flash cache-hit peak: 0.04 → 0.05

const realFetch = globalThis.fetch;
const setFetch = (html) => {
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => html });
};

/** Minimal host services: settings with live PrefsSchema values; connection RPC captured for direct calls. */
function makeCtx() {
  const handlers = new Map();
  const scope = { get: () => PrefsSchema({}), watch: () => () => {} };
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    on: () => () => {},
    inject(deps, callback) {
      const services = {};
      if (deps.includes("settings")) services.settings = { register: () => scope };
      if (deps.includes("credentials")) services.credentials = null;
      if (deps.includes("connection")) services.connection = { rpc: { handle: (channel, handler) => { handlers.set(channel, handler); return () => {}; } } };
      callback(services);
      return () => {};
    },
    effect: () => () => {},
  };
  return { ctx, call: async (endpoint, payload) => handlers.get("/dsh-balance-monitor")(endpoint, payload) };
}

async function waitFor(label, probe, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timeout waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const persisted = () => loadState(SANDBOX_HOME);

const checks = [];
const check = (label, ok, detail) => { checks.push([label, ok, detail]); };

try {
  // ---- 1) first-ever sync: no previous official pricing → no notice ----------
  setFetch(fixtureA);
  apply(makeCtx().ctx);
  await waitFor("pricing persisted after sync #1", () => (persisted().pricing?.fetchedAt ?? 0) > 0);
  check("sync #1 queued no notice (nothing to compare)", persisted().pricingNotice == null, JSON.stringify(persisted().pricingNotice));

  // ---- 2) price changed → notice with correct old/new ------------------------
  setFetch(fixtureB);
  const second = makeCtx();
  apply(second.ctx);
  const notice = await waitFor("pricingNotice after sync #2", () => persisted().pricingNotice ?? null);
  check("sync #2 queued a notice", notice !== null);
  check("notice.old.flash.cacheHit = 0.04", notice?.old?.models?.["deepseek-flash"]?.cacheHit === 0.04, JSON.stringify(notice?.old?.models?.["deepseek-flash"]));
  check("notice.new.flash.cacheHit = 0.05", notice?.new?.models?.["deepseek-flash"]?.cacheHit === 0.05, JSON.stringify(notice?.new?.models?.["deepseek-flash"]));
  check("notice.new carries the full new table (pro unchanged)", notice?.new?.models?.["deepseek-v4-pro"]?.input === 9, JSON.stringify(notice?.new?.models?.["deepseek-v4-pro"]));
  check("notice snapshots are officially sourced", notice?.old?.source === "deepseek-docs" && notice?.new?.source === "deepseek-docs");

  const overviewBefore = await second.call("overview", {});
  check("overview exposes the pending notice", overviewBefore.ok === true && overviewBefore.value?.pricingNotice?.new?.models?.["deepseek-flash"]?.cacheHit === 0.05, JSON.stringify(overviewBefore.value?.pricingNotice));

  // ---- 3) ack clears memory + persistence ------------------------------------
  const acked = await second.call("pricing-notice/ack", {});
  check("ack returns ok", acked.ok === true, JSON.stringify(acked));
  const overviewAfter = await second.call("overview", {});
  check("overview clears the notice after ack", overviewAfter.value?.pricingNotice == null, JSON.stringify(overviewAfter.value?.pricingNotice));
  const persistedAfterAck = await waitFor("ack persisted to disk", () => persisted().pricingNotice == null && persisted().savedAt > 0);
  check("persisted state has no notice after ack", persistedAfterAck.pricingNotice == null);

  // ---- 4) unchanged page → no new notice -------------------------------------
  const third = makeCtx();
  apply(third.ctx);
  await new Promise((resolve) => setTimeout(resolve, 1200)); // sync #3 is fetch-instant; give the debounce a beat
  check("sync #3 (unchanged page) queued no notice", persisted().pricingNotice == null, JSON.stringify(persisted().pricingNotice));
} finally {
  globalThis.fetch = realFetch;
  rmSync(SANDBOX_HOME, { recursive: true, force: true });
}

let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
