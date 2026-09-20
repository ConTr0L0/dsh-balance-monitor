/**
 * Balance-fetch resilience tests.
 *
 * Context (diagnosed 2026-09-11): on this machine Kaspersky's HTTPS scanning
 * re-signs api.deepseek.com with a locally issued root; Node's bundled CA store
 * rejects that chain, so a *fresh* connection — which a 60s balance poll always
 * makes — failed ~70% of the time (SELF_SIGNED_CERT_IN_CHAIN). The plugin used
 * to answer with a single attempt and overwrite its cache with the error, so a
 * transient TLS failure blanked the sidebar balance (¥—) until the next 60s
 * tick happened to succeed.
 *
 * Asserts the contract that fixes it:
 *  1. transport failures are retried with backoff before a poll reports failure
 *  2. a cold failure (nothing shown yet) re-arms on its own, seconds later,
 *     instead of waiting out the refresh interval
 *  3. a failed poll keeps the last successful balance and flags it `stale`
 *  4. HTTP errors (401) are never retried, yet still keep the last balance
 *  5. a later successful poll clears the staleness
 *
 * `fetch` is stubbed, so the test is hermetic and never touches the network.
 * DSH_HOME is redirected before the plugin module is imported.
 *
 * Run from the plugin root:
 *   node --preserve-symlinks tests/balance-resilience.mjs
 */
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SANDBOX_HOME = process.env.BM_TEST_HOME ?? join(process.cwd(), ".bm-test-home");
rmSync(SANDBOX_HOME, { recursive: true, force: true });
mkdirSync(SANDBOX_HOME, { recursive: true });
process.env.DSH_HOME = SANDBOX_HOME;

const PROFILE_DIR = "C:\\Users\\ConTr0L\\.dsh\\profiles\\web\\node_modules\\dsh-balance-monitor";
const fromProfile = (relative) => pathToFileURL(join(PROFILE_DIR, relative)).href;

const checks = [];
const check = (label, ok, detail) => checks.push([label, ok, detail]);

// ---------------------------------------------------------------------------
// Scripted transport: `policy` drives every balance request.
// ---------------------------------------------------------------------------
let policy = "throw"; // cold boot: the provider is unreachable
let okTotal = "19.41";
const calls = [];
const totalCalls = () => calls.length;

globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.includes("api-docs.deepseek.com")) throw new Error("pricing sync disabled in this test");
  calls.push({ target, at: Date.now() });
  if (policy === "throw") {
    const error = new TypeError("fetch failed");
    error.cause = { code: "SELF_SIGNED_CERT_IN_CHAIN" };
    throw error;
  }
  if (policy === "http401") {
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: { message: "Authentication Fails" } }) };
  }
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        is_available: true,
        balance_infos: [
          { currency: "CNY", total_balance: okTotal, granted_balance: "0.00", topped_up_balance: okTotal },
        ],
      }),
  };
};

// ---------------------------------------------------------------------------
// Fake host context: inject() really invokes the plugin's callbacks so the
// balance poller, the settings scope and the RPC channel all go live.
// ---------------------------------------------------------------------------
const prefs = {
  enabled: true,
  refreshInterval: 60,
  providers: { deepseek: { apiKey: "", baseURL: "https://api.deepseek.com" } },
  display: { provider: "deepseek", field: "total" },
  limits: {},
};
const logs = [];
let rpcHandler = null;

const settingsSctx = {
  settings: {
    register: () => ({ get: () => prefs, watch: () => () => {} }),
    describe: () => [],
    replace: async () => {},
  },
  credentials: { resolve: async () => ({ value: "test-key" }) },
};

const ctx = {
  logger: {
    info: (...args) => logs.push(["info", ...args]),
    warn: (...args) => logs.push(["warn", ...args]),
    error: (...args) => logs.push(["error", ...args]),
  },
  on: () => () => {},
  effect: () => () => {},
  inject: (services, callback) => {
    if (services.includes("connection")) {
      return callback({
        connection: {
          rpc: {
            handle: (channel, handler) => {
              rpcHandler = handler;
              return () => {};
            },
          },
        },
      });
    }
    return callback(settingsSctx);
  },
};

const { apply } = await import(fromProfile("lib/index.js"));
const balance = await import(fromProfile("lib/balance.js"));
const { fetchProviderBalanceWithRetry } = balance;

check("host exposes a retrying balance fetch", typeof fetchProviderBalanceWithRetry === "function");
check("host exposes the retry budget", typeof balance.BALANCE_ATTEMPTS === "number");

apply(ctx, {});
check("rpc channel registered", typeof rpcHandler === "function");

const overview = async () => {
  const response = await rpcHandler("overview", {});
  if (!response.ok) throw new Error(`overview failed: ${JSON.stringify(response.error)}`);
  return response.value;
};

/** Poll a predicate until it holds; returns elapsed ms, or 0 on timeout. */
const waitUntil = async (predicate, budgetMs, stepMs = 150) => {
  const startedAt = Date.now();
  for (;;) {
    if (await predicate()) return Date.now() - startedAt;
    if (Date.now() - startedAt > budgetMs) return 0;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
};

// 0) Cold start: the boot poll fails on transport, and the host must re-arm on
//    its own (3s, not the 60s refresh interval) so the plate fills unattended.
const bootAttempts = await waitUntil(() => totalCalls() >= 5, 6000);
check("cold boot poll spent the full attempt budget", bootAttempts > 0 && totalCalls() === 5, `calls=${totalCalls()}`);
policy = "ok";
okTotal = "19.41";
const coldRecoveryMs = await waitUntil(async () => (await overview()).providers.deepseek?.ok === true, 9000);
check(
  "cold failure re-arms on its own and fills the plate",
  coldRecoveryMs > 0,
  "no automatic recovery within 9s (a warm-only 10s re-arm or a 60s interval would look like this)",
);
check("cold recovery lands well before the next scheduled poll", coldRecoveryMs > 0 && coldRecoveryMs < 9000, `${coldRecoveryMs}ms`);

// 1) A successful poll publishes the balance cleanly.
await rpcHandler("refresh", {});
let prov = (await overview()).providers.deepseek;
check("success publishes the balance", prov?.ok === true && prov?.total === 19.41, JSON.stringify(prov));
check("success needs a single attempt", prov?.attempts === 1, String(prov?.attempts));
check("success is not stale", prov?.stale !== true, String(prov?.stale));
const goodFetchedAt = prov?.fetchedAt ?? 0;

// 2) A transport failure retries with backoff, then keeps the last balance.
policy = "throw";
const callsBeforeFailure = totalCalls();
const startedAt = Date.now();
await rpcHandler("refresh", {});
const failureElapsed = Date.now() - startedAt;
prov = (await overview()).providers.deepseek;

check("failed poll retried the full attempt budget", totalCalls() - callsBeforeFailure === 5, `calls=${totalCalls() - callsBeforeFailure}`);
check("retries were spaced by the backoff gaps", failureElapsed >= 2000, `${failureElapsed}ms`);
check("failure keeps the last successful balance", prov?.total === 19.41, JSON.stringify(prov));
check("failure marks the snapshot stale", prov?.stale === true && prov?.ok === false, JSON.stringify(prov));
check("failure carries the transport error", /fetch failed/.test(String(prov?.error)), String(prov?.error));
check(
  "stale snapshot keeps the last good fetch time",
  prov?.fetchedAt === goodFetchedAt && (prov?.attemptedAt ?? 0) > goodFetchedAt,
  `fetchedAt=${prov?.fetchedAt} attemptedAt=${prov?.attemptedAt} good=${goodFetchedAt}`,
);
check("failure records when it happened", (prov?.failedAt ?? 0) >= startedAt, String(prov?.failedAt));

// 3) HTTP errors stay non-retryable but still never blank the plate.
policy = "http401";
const callsBefore401 = totalCalls();
const refreshed = await rpcHandler("refresh", {});
prov = refreshed.ok ? (await overview()).providers.deepseek : null;
check("non-retryable failure makes a single request", totalCalls() - callsBefore401 === 1, `calls=${totalCalls() - callsBefore401}`);
check("401 result is flagged non-retryable", prov?.retryable === false, String(prov?.retryable));
check("401 still keeps the last successful balance", prov?.total === 19.41, JSON.stringify(prov));

// 4) Recovery clears staleness.
policy = "ok";
okTotal = "18.02";
await rpcHandler("refresh", {});
prov = (await overview()).providers.deepseek;
check("recovery republishes the fresh balance", prov?.ok === true && prov?.total === 18.02, JSON.stringify(prov));
check("recovery clears the stale flag", prov?.stale !== true, String(prov?.stale));

// 5) The retry budget is a real retry loop, not a single call.
let attempts = 0;
const stubbed = globalThis.fetch;
globalThis.fetch = async (url) => {
  attempts += 1;
  if (attempts < 3) throw new TypeError("fetch failed");
  return stubbed(url);
};
const recovered = typeof fetchProviderBalanceWithRetry === "function"
  ? await fetchProviderBalanceWithRetry("deepseek", "https://api.deepseek.com", "k")
  : { ok: false, error: "fetchProviderBalanceWithRetry is not exported yet" };
globalThis.fetch = stubbed;
check("returns ok after transient throws", recovered.ok === true && recovered.attempts === 3, JSON.stringify(recovered));
check("reports the attempt count on success", recovered.total === 18.02, String(recovered.total));

let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failed += 1;
}
if (logs.length > 0) console.log("\nplugin logs:", JSON.stringify(logs.slice(0, 6)));
rmSync(SANDBOX_HOME, { recursive: true, force: true });
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
