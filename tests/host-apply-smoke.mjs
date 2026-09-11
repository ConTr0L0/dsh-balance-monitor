/**
 * Host-half integration smoke test: `apply(ctx)` must register the live
 * observer, and the observer must fold real session events into the ledger and
 * persist them.
 *
 * The host half has no build step, so this exercises the exact module the
 * running profile loads through its junction — including the 3s debounced
 * atomic write, which the test waits for. `DSH_HOME` is redirected to a
 * throwaway directory BEFORE the plugin module is imported, so the test can
 * never touch the real ledger (and the periodic log scan finds no sessions).
 *
 * Run from the plugin root:
 *   node --preserve-symlinks tests/host-apply-smoke.mjs
 * (`--preserve-symlinks` keeps @deepseek-ai/* resolving inside the profile.)
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SANDBOX_HOME = mkdtempSync(join(tmpdir(), "bm-smoke-"));
process.env.DSH_HOME = SANDBOX_HOME;

/** Import through the profile junction so the plugin and the test share one module instance per specifier. */
const PROFILE_DIR = "C:\\Users\\ConTr0L\\.dsh\\profiles\\web\\node_modules\\dsh-balance-monitor";
const fromProfile = (relative) => pathToFileURL(join(PROFILE_DIR, relative)).href;

const listeners = new Map();
const logs = [];
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
  inject() {
    return () => {};
  },
  effect() {
    return () => {};
  },
};

const { apply } = await import(fromProfile("lib/index.js"));
if (typeof apply !== "function") throw new Error("host half does not export apply()");
apply(ctx, {});

const { loadState, statePath, STATE_VERSION } = await import(fromProfile("lib/store.js"));
const readLedger = () => loadState(SANDBOX_HOME).sessions["session-smoke-live"];

const checks = [];
checks.push(["registers exactly one session/event observer", (listeners.get("session/event") ?? []).length === 1]);
checks.push(["registers the llm/stream limiter", (listeners.get("llm/stream") ?? []).length === 1]);

const MESSAGE_ID = "smoke-message-id-0001";
const session = { id: "session-smoke-live" };
const emit = (event) => {
  for (const observer of listeners.get("session/event") ?? []) observer(session, event);
};
const completion = (turn, step, id, usage) => ({ type: "assistant/message", time: Date.now(), data: { turn, step, message: { id }, usage } });
const one = { inputTokens: 2000, cacheReadTokens: 8000, outputTokens: 1000 };

// A session lifecycle, including one event type the observer deliberately ignores.
emit({ type: "turn/start", data: { turn: 1 } });
emit({ type: "session/title", data: { title: "smoke session" } });
emit({ type: "request/header", data: { header: { config: { provider: "deepseek-official", model: "deepseek-v4" } } } });
emit(completion(1, 1, MESSAGE_ID, one));
emit(completion(1, 1, MESSAGE_ID, one)); // duplicate session copy / later log scan
emit(completion(1, 2, "smoke-message-id-0002", { inputTokens: 100, cacheReadTokens: 0, outputTokens: 50 }));

// The persisted document is written on a 3s debounce; wait for it.
const deadline = Date.now() + 10_000;
let persisted = null;
while (Date.now() < deadline) {
  persisted = readLedger();
  if (persisted?.requests === 2) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}

checks.push(["completion created a session accumulator", persisted !== undefined]);
checks.push(["counted two requests (duplicate suppressed)", persisted?.requests === 2]);
checks.push([
  "summed the disjoint buckets",
  persisted?.tokens.uncached === 2100 && persisted?.tokens.cacheRead === 8000 && persisted?.tokens.output === 1050,
]);
checks.push([
  "attributed the completion to the request/header model",
  persisted?.currentModel === "deepseek-v4" && persisted?.currentProvider === "deepseek-official",
]);
checks.push(["kept the session title from the live event", persisted?.title === "smoke session"]);
checks.push(["accumulated a positive cost", (persisted?.cost ?? 0) > 0]);
checks.push(["global totals followed the session", loadState(SANDBOX_HOME).totals.requests === 2]);
checks.push(["state.json exists and parses", (() => {
  try {
    return loadState(SANDBOX_HOME).version === STATE_VERSION;
  } catch {
    return false;
  }
})()]);

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed += 1;
}
console.log(`\nsandbox home: ${SANDBOX_HOME}`);
console.log(`state path:   ${statePath(SANDBOX_HOME)}`);
console.log(`ledger:       ${JSON.stringify(persisted)}`);
if (logs.length > 0) console.log("plugin logs:", JSON.stringify(logs));
rmSync(SANDBOX_HOME, { recursive: true, force: true });
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
