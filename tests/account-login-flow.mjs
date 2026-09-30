/**
 * Account-login balance integration test (DSH 0.2 account service).
 *
 * The pure logic lives in `tests/account-balance.mjs`; this test proves the real
 * host half wires it up: `apply(ctx)` must pick up the `deepseekAccount` service,
 * read the Platform wallets through `getBalance(client)`, publish the normalized
 * figure over its RPC route with `source: "account"`, and fall back to the API
 * key exactly when the preference and the login state say so.
 *
 * The harness fakes the host context (`inject()` callbacks are captured and
 * driven by hand) and `fetch` (`api.deepseek.com` requests are counted and
 * answered from a script), so nothing here touches the network and the API-key
 * route is provably NOT used whenever the account answers.
 *
 * Run from the plugin root:
 *   node tests/account-login-flow.mjs
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SANDBOX_HOME = mkdtempSync(join(tmpdir(), "bm-account-"));
process.env.DSH_HOME = SANDBOX_HOME;

// ---------------------------------------------------------------------------
// Scripted world: the account service, the DSH credential, the provider API.
// ---------------------------------------------------------------------------
/** "ready" | "signed-out" | "failed" — what the account login answers. */
let accountMode = "ready";
/** Whether the DSH credential store holds DEEPSEEK_API_KEY. */
let keyAvailable = true;
const accountCalls = [];
const balanceCalls = [];

const PLATFORM_WALLETS = [{ currency: "CNY", balance: "8.9255904400000000", token_estimation: "0" }];
const PLATFORM_BONUSES = [{ currency: "CNY", balance: "1.9273626400000000", token_estimation: "0" }];

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes("api-docs.deepseek.com")) throw new Error("pricing sync disabled in this test");
  balanceCalls.push({ target, authorization: options.headers?.authorization ?? null });
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        is_available: true,
        balance_infos: [{ currency: "CNY", total_balance: "7.77", granted_balance: "0.27", topped_up_balance: "7.50" }],
      }),
  };
};

const listeners = new Map();
const logs = [];
const injections = [];
const ctx = {
  logger: {
    info: (...a) => logs.push(["info", ...a]),
    warn: (...a) => logs.push(["warn", ...a]),
    error: (...a) => logs.push(["error", ...a]),
  },
  on(name, handler) {
    const list = listeners.get(name) ?? [];
    list.push(handler);
    listeners.set(name, list);
    return () => {};
  },
  inject(services, callback) {
    injections.push([services, callback]);
    return () => {};
  },
  effect(callback) {
    const disposer = callback();
    return typeof disposer === "function" ? disposer : () => {};
  },
};

const accountService = {
  async getBalance(client) {
    accountCalls.push(client);
    if (accountMode === "signed-out") return null;
    if (accountMode === "failed") return { status: "failed" };
    return { status: "ready", value: PLATFORM_WALLETS, bonusWallets: PLATFORM_BONUSES };
  },
};

const { apply } = await import(pathToFileURL(join(ROOT, "lib", "index.js")).href);
apply(ctx, {});

// Drive every injected service by hand, like the real host would.
const entryFor = (name) => injections.find(([services]) => services.includes(name));
for (const [services, callback] of injections) {
  if (services.includes("credentials")) callback({ credentials: { resolve: async () => (keyAvailable ? { value: "sk-dsh" } : undefined) } });
  if (services.includes("deepseekAccount")) callback({ deepseekAccount: accountService });
}
const webServerEntry = entryFor("webServer");
if (!webServerEntry) throw new Error("apply() did not inject webServer");

let route = null;
webServerEntry[1]({
  webServer: {
    register(candidate) {
      route = candidate;
      return () => {};
    },
  },
});
if (route === null) throw new Error("apply() did not register its web route");

const CHANNEL = "/dsh-balance-monitor";
/** Drive the real route handler once; returns the parsed envelope. */
const rpc = async (endpoint, payload) => {
  const body = JSON.stringify(payload ?? {});
  const req = {
    method: "POST",
    url: `${CHANNEL}/${endpoint}`,
    headers: { host: "127.0.0.1:19560", "content-type": "application/json" },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body);
    },
  };
  let raw = "";
  const res = { writeHead() {}, end(chunk) { raw = chunk ?? ""; } };
  await route.handler(req, res);
  return JSON.parse(raw);
};

/** Force a fresh poll and return the DeepSeek entry from the next overview. */
const deepseekAfterRefresh = async () => {
  // A preference write re-arms the poll loop; let that non-forced pass settle so
  // the forced refresh below is not joined by it (the shared in-flight promise
  // would otherwise be the one that skipped the provider on the min-interval).
  await new Promise((resolve) => setTimeout(resolve, 80));
  await rpc("refresh", {});
  const overview = await rpc("overview", {});
  if (!overview.ok) throw new Error(`overview failed: ${JSON.stringify(overview.error)}`);
  return overview.value.providers.deepseek;
};

/** Set one preference through the real config/patch endpoint. */
const setPref = async (patch) => {
  const current = await rpc("config/get", {});
  const written = await rpc("config/patch", { patch, revision: current.value.revision });
  if (!written.ok) throw new Error(`config/patch failed: ${JSON.stringify(written.error)}`);
};

const checks = [];
const check = (label, ok, detail = "") => checks.push([label, ok, detail]);
const near = (label, got, want) => check(label, typeof got === "number" && Math.abs(got - want) < 1e-9, `got ${got} want ${want}`);

// ---------------------------------------------------------------------------
// 1) Signed in: the account answers, the API key is never touched
// ---------------------------------------------------------------------------
let entry = await deepseekAfterRefresh();
check("signed-in account produces a balance", entry.ok === true, JSON.stringify(entry));
near("account total = recharge + granted", entry.total, 10.85295308);
near("account recharge published as topped-up", entry.toppedUp, 8.92559044);
near("account grant published as granted", entry.granted, 1.92736264);
check("entry is tagged with its source", entry.source === "account", String(entry.source));
check("currency follows the Platform wallet", entry.currency === "CNY", String(entry.currency));
check("the API-key endpoint was never called", balanceCalls.length === 0, JSON.stringify(balanceCalls));
check("account metadata carries the client identity", (() => {
  const client = accountCalls.at(-1) ?? {};
  return (
    typeof client.version === "string" &&
    client.version.length > 0 &&
    typeof client.locale === "string" &&
    typeof client.timezoneOffsetSeconds === "number"
  );
})(), JSON.stringify(accountCalls.at(-1)));

// ---------------------------------------------------------------------------
// 2) auto + signed out: the API key still answers
// ---------------------------------------------------------------------------
accountMode = "signed-out";
entry = await deepseekAfterRefresh();
check("auto falls back to the API key when signed out", entry.ok === true && entry.source === "key", JSON.stringify(entry));
near("API-key figure is published", entry.total, 7.77);
check("the fallback really called the provider", balanceCalls.length === 1 && balanceCalls[0].target.endsWith("/user/balance"), JSON.stringify(balanceCalls));
check("the fallback carried the DSH key", balanceCalls[0]?.authorization === "Bearer sk-dsh", String(balanceCalls[0]?.authorization));

// ---------------------------------------------------------------------------
// 3) auto + signed out + no key: a reason, never a zero balance
// ---------------------------------------------------------------------------
keyAvailable = false;
entry = await deepseekAfterRefresh();
check(
  "auto without an account or key reports no-api-key",
  entry.ok === false && entry.error === "no-api-key" && entry.configured === false,
  JSON.stringify(entry),
);
check("no balance figure is invented", entry.total === undefined, String(entry.total));

// ---------------------------------------------------------------------------
// 4) account-only: pinned to the login, never the key
// ---------------------------------------------------------------------------
keyAvailable = true;
await setPref({ providers: { deepseek: { source: "account" } } });
entry = await deepseekAfterRefresh();
check(
  "account-only reports the signed-out login instead of using the key",
  entry.ok === false && entry.error === "account-signed-out",
  JSON.stringify(entry),
);
const callsBeforeAccountOnly = balanceCalls.length;
await deepseekAfterRefresh();
check("account-only never calls the provider", balanceCalls.length === callsBeforeAccountOnly, String(balanceCalls.length));

// ---------------------------------------------------------------------------
// 5) key-only: pinned to the API key even while signed in
// ---------------------------------------------------------------------------
accountMode = "ready";
await setPref({ providers: { deepseek: { source: "key" } } });
entry = await deepseekAfterRefresh();
check("key-only ignores a signed-in account", entry.ok === true && entry.source === "key", JSON.stringify(entry));
near("key-only publishes the API figure", entry.total, 7.77);

// ---------------------------------------------------------------------------
// 6) A failed account query keeps the outcomes distinct
// ---------------------------------------------------------------------------
accountMode = "failed";
await setPref({ providers: { deepseek: { source: "auto" } } });
entry = await deepseekAfterRefresh();
check("auto falls back to the key when the account query fails", entry.ok === true && entry.source === "key", JSON.stringify(entry));
await setPref({ providers: { deepseek: { source: "account" } } });
entry = await deepseekAfterRefresh();
check(
  "account-only reports a failed query",
  entry.ok === false && entry.error === "account-failed" && entry.configured === true,
  JSON.stringify(entry),
);

// ---------------------------------------------------------------------------
// 7) A host without the account service (older DSH) keeps working
// ---------------------------------------------------------------------------
accountMode = "ready";
await setPref({ providers: { deepseek: { source: "auto" } } });
for (const [services, callback] of injections) {
  if (services.includes("deepseekAccount")) callback({ deepseekAccount: null });
}
entry = await deepseekAfterRefresh();
check("no account service falls back to the key", entry.ok === true && entry.source === "key", JSON.stringify(entry));

// ---------------------------------------------------------------------------
let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failed += 1;
}
if (logs.length > 0) console.log("\nplugin logs:", JSON.stringify(logs.slice(0, 6)));
rmSync(SANDBOX_HOME, { recursive: true, force: true });
console.log(failed === 0 ? `\nALL ${checks.length} CHECKS PASSED` : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
