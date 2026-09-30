/**
 * DSH 0.2 port test. Three breaking changes are covered:
 *
 *  1. the client channel is a fenced prefix route mounted through
 *     `ctx.webServer.register()` — 0.2 no longer hands profile plugins the
 *     `connection` service (the 0.1.x registration silently never ran and the
 *     browser saw HTTP 405);
 *  2. DSH's settings projection does not admit an out-of-tree bundle's row, so
 *     preferences are persisted by the plugin itself (lib/prefs.js) instead of
 *     a settings namespace;
 *  3. a save carries a revision and a stale one is refused, then retried against
 *     the live revision.
 *
 * The harness context is faked, so the test runs anywhere: `inject()` callbacks
 * are captured, the real route handler is driven with fake req/res objects, and
 * the preference document is read back from disk. One background HTTPS pricing
 * sync is fired by apply(); it never blocks an assertion.
 *
 * Run from the plugin root:
 *   node tests/rpc-prefs-020.mjs
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SANDBOX_HOME = mkdtempSync(join(tmpdir(), "bm-020-"));
process.env.DSH_HOME = SANDBOX_HOME;

const CHANNEL = "/dsh-balance-monitor";
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
  effect(callback, label) {
    const disposer = callback();
    return typeof disposer === "function" ? disposer : () => {};
  },
};

const { apply } = await import(pathToFileURL(join(ROOT, "lib", "index.js")).href);
apply(ctx, {});

if (injections.some(([services]) => services.includes("settings"))) {
  throw new Error("apply() still waits for the 0.2 settings service");
}
if (injections.some(([services]) => services.includes("connection"))) {
  throw new Error("apply() still waits for the 0.2-removed `connection` service");
}

const webServerEntry = injections.find(([services]) => services.includes("webServer"));
const credentialsEntry = injections.find(([services]) => services.includes("credentials"));
if (!webServerEntry || !credentialsEntry) throw new Error("apply() did not inject webServer + credentials");

credentialsEntry[1]({ credentials: { resolve: async () => ({ value: "sk-from-dsh" }) } });

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

const PREFS_FILE = join(SANDBOX_HOME, "storages", "dsh-balance-monitor", "prefs.json");
const storedPrefs = () => JSON.parse(readFileSync(PREFS_FILE, "utf8"));

/** Drive the real route handler once; returns {status, body}. */
const request = async (endpoint, payload, { method = "POST", host = "127.0.0.1:19560", headers = {} } = {}) => {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const req = {
    method,
    url: `${CHANNEL}/${endpoint}`,
    headers: { host, "content-type": "application/json", ...headers },
    async *[Symbol.asyncIterator]() {
      if (body !== "") yield Buffer.from(body);
    },
  };
  let status = 0;
  let raw = "";
  const res = {
    writeHead(code) {
      status = code;
    },
    end(chunk) {
      raw = chunk ?? "";
    },
  };
  await route.handler(req, res);
  return { status, body: raw === "" ? undefined : JSON.parse(raw) };
};

const rpc = async (endpoint, payload) => (await request(endpoint, payload ?? {})).body;
const checks = [];

checks.push(["registers one session/event observer", (listeners.get("session/event") ?? []).length === 1]);
checks.push(["registers the llm/stream limiter", (listeners.get("llm/stream") ?? []).length === 1]);
checks.push(["mounts a prefix route on its own channel", route.kind === "prefix" && route.path === CHANNEL]);

const foreign = await request("overview", {}, { headers: { origin: "https://evil.example" } });
checks.push(["the Host/Origin fence rejects a foreign origin", foreign.status === 403]);

const nonPost = await request("overview", {}, { method: "GET" });
checks.push(["a non-POST request is refused", nonPost.status === 404]);

const got = await rpc("config/get", {});
checks.push(["config/get reports revision 0 on a fresh document", got.ok === true && got.value.revision === 0]);
checks.push([
  "config/get hides every apiKey but reports its slot",
  got.value.value.providers.deepseek.apiKey === undefined &&
    got.value.secrets.length === 4 &&
    got.value.secrets.every((slot) => slot.path.at(-1) === "apiKey" && slot.set === false),
]);

const patched = await rpc("config/patch", { patch: { display: { showPeak: false } }, revision: 0 });
checks.push(["config/patch applies the merge", patched.ok === true && (await rpc("overview", {})).value.display.showPeak === false]);
checks.push(["config/patch persists to the preference document", storedPrefs().value.display.showPeak === false]);
checks.push(["config/patch advances the revision", storedPrefs().revision === 1 && (await rpc("config/get", {})).value.revision === 1]);

// A stale revision must be refused, then retried against the live one.
const stale = await rpc("config/patch", { patch: { enabled: false }, revision: 0 });
checks.push(["a stale revision is retried against the live one", stale.ok === true && (await rpc("config/get", {})).value.revision === 2]);
checks.push(["the retried write is visible to the next overview", (await rpc("overview", {})).value.enabled === false]);

const secret = await rpc("config/setSecret", { path: ["providers", "zhipu", "apiKey"], value: "sk-typed", revision: 2 });
checks.push(["config/setSecret nests the path", secret.ok === true && storedPrefs().value.providers.zhipu.apiKey === "sk-typed"]);
const afterSecret = await rpc("config/get", {});
checks.push([
  "a stored secret is never echoed back",
  afterSecret.value.value.providers.zhipu.apiKey === undefined &&
    afterSecret.value.secrets.find((slot) => slot.path.join(".") === "providers.zhipu.apiKey")?.set === true,
]);

const unknown = await rpc("nope", {});
checks.push(["unknown endpoints report the error branch", unknown.ok === false && unknown.error.code === "internal"]);

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed += 1;
}
console.log(`\nroute:  ${route.kind} ${route.path}`);
console.log(`prefs:  ${PREFS_FILE}`);
if (logs.length > 0) console.log("plugin logs:", JSON.stringify(logs));
rmSync(SANDBOX_HOME, { recursive: true, force: true });
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
