/**
 * DSH 0.2 settings port test: the host half must read its preferences from the
 * plugin's own Config (addressed by profile entry id) and write them through
 * `settings.update()` — the namespace registry this plugin used on 0.1.x no
 * longer exists.
 *
 * The harness context is faked, so the test runs anywhere: `inject()` callbacks
 * are captured and invoked with a stub Settings service that mimics the real
 * revision/conflict contract. One background HTTPS pricing sync is fired by the
 * settings wiring; it never blocks an assertion.
 *
 * Run from the plugin root:
 *   node tests/settings-020-port.mjs
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SANDBOX_HOME = mkdtempSync(join(tmpdir(), "bm-020-"));
process.env.DSH_HOME = SANDBOX_HOME;

const ENTRY_ID = "balance-monitor";
const listeners = new Map();
const logs = [];
const injections = [];
const ctx = {
  fiber: { entry: { options: { id: ENTRY_ID } } },
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
};

const { apply } = await import(pathToFileURL(join(ROOT, "lib", "index.js")).href);
apply(ctx, { enabled: true, refreshInterval: 60 });

// ---- stub Settings service (0.2 contract: revisions + update-by-entry-id) ----
let prefs = { enabled: true, refreshInterval: 60 };
let revision = 0;
const writes = [];
let conflictOnce = false;
const settings = {
  describe(options) {
    const row = { autoGenerate: false, ns: ENTRY_ID, revision, value: structuredClone(prefs), applies: "live" };
    if (options?.redactSecrets) {
      row.value.providers ??= {};
      row.secrets = [{ path: ["providers", "deepseek", "apiKey"], set: true }];
    }
    return [row];
  },
  async update(ns, patch, expectedRevision) {
    if (conflictOnce) {
      conflictOnce = false;
      revision += 1; // another writer landed first
      const error = new Error("stale revision");
      error.code = "SETTINGS_CONFLICT";
      throw error;
    }
    if (expectedRevision !== revision) throw new Error(`unexpected revision ${expectedRevision} != ${revision}`);
    prefs = { ...prefs, ...patch };
    writes.push({ ns, patch, expectedRevision, revisionAtCall: revision });
    revision += 1;
  },
};

const settingsEntry = injections.find(([services]) => services.includes("settings"));
const connectionEntry = injections.find(([services]) => services.includes("connection"));
if (!settingsEntry || !connectionEntry) throw new Error("apply() did not inject settings + connection");

const disposable = settingsEntry[1]({
  settings,
  credentials: { resolve: async () => ({ value: "sk-from-dsh" }) },
});

let channel = null;
let handler = null;
connectionEntry[1]({
  connection: {
    rpc: {
      handle(name, fn) {
        channel = name;
        handler = fn;
        return () => {};
      },
    },
  },
});
if (handler === null) throw new Error("apply() did not register its RPC channel");

const rpc = (endpoint, payload) => handler(endpoint, payload);
const checks = [];

checks.push(["registers one session/event observer", (listeners.get("session/event") ?? []).length === 1]);
checks.push(["registers the llm/stream limiter", (listeners.get("llm/stream") ?? []).length === 1]);
checks.push(["exposes its own RPC channel", channel === "/dsh-balance-monitor"]);

const got = await rpc("config/get", {});
checks.push(["config/get targets the profile entry id", settings.describe({ redactSecrets: true })[0].ns === ENTRY_ID]);
checks.push(["config/get passes the revision through", got.ok === true && got.value.revision === revision]);
checks.push(["config/get redacts secrets but reports the slot", got.value.value.providers?.deepseek?.apiKey === undefined && got.value.secrets?.[0]?.path.join(".") === "providers.deepseek.apiKey"]);

const patched = await rpc("config/patch", { patch: { display: { showPeak: false } }, revision });
checks.push(["config/patch merges through settings.update()", patched.ok === true && writes.at(-1)?.patch.display.showPeak === false]);
checks.push(["config/patch writes to the entry id", writes.at(-1)?.ns === ENTRY_ID]);
checks.push(["config/patch re-arms the poll loop with the new prefs", (await rpc("overview", {})).value.display.showPeak === false]);

// A racing writer bumps the revision; the plugin must retry once with the fresh one.
conflictOnce = true;
const stale = await rpc("config/patch", { patch: { enabled: false }, revision });
checks.push(["a SETTINGS_CONFLICT retries with the refreshed revision", stale.ok === true && writes.at(-1)?.expectedRevision === writes.at(-1)?.revisionAtCall]);
checks.push(["the retried write is visible to the next overview", (await rpc("overview", {})).value.enabled === false]);

const secret = await rpc("config/setSecret", { path: ["providers", "zhipu", "apiKey"], value: "sk-typed", revision });
checks.push(["config/setSecret nests the path", secret.ok === true && writes.at(-1)?.patch.providers.zhipu.apiKey === "sk-typed"]);

const unknown = await rpc("nope", {});
checks.push(["unknown endpoints report the error branch", unknown.ok === false && unknown.error.code === "internal"]);

checks.push(["settings service is read from the Config, not a namespace", !JSON.stringify(logs).includes("settingsNamespace")]);

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed += 1;
}
console.log(`\nentry id:   ${ENTRY_ID}`);
console.log(`writes:     ${JSON.stringify(writes)}`);
if (logs.length > 0) console.log("plugin logs:", JSON.stringify(logs));
disposable();
rmSync(SANDBOX_HOME, { recursive: true, force: true });
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
