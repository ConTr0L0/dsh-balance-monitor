// Run: node tests/usage-accounting-smoke.mjs. Retains its isolated ledger.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

const sandbox = mkdtempSync(join(tmpdir(), "dsh-usage-smoke-"));
process.env.DSH_HOME = sandbox;
globalThis.fetch = async () => { throw new Error("network disabled in smoke test"); };
const { apply } = await import("../lib/index.js");
const { loadState } = await import("../lib/store.js");
const { foldEvent, createSessionState } = await import("../lib/sessions.js");
const { emptyState } = await import("../lib/store.js");
const listeners = new Map();
let route;
apply({
  logger: { info() {}, warn() {}, error() {} },
  on(name, handler, options) { listeners.set(name, { handler, options }); },
  inject(names, callback) {
    if (names.includes("webServer")) callback({ webServer: { register(value) { route = value; } } });
  },
  effect() {},
});
const emit = (event) => listeners.get("session/event").handler({ id: "real-session" }, event);
const usage = { inputTokens: 100, cacheReadTokens: 200, outputTokens: 50 };
const source = { provider: "deepseek-official", model: "deepseek-flash" };
const invoke = async (options, chunks) => {
  const upstream = (async function* () { yield* chunks; })();
  const observed = [];
  for await (const chunk of listeners.get("llm/stream").handler(options, () => upstream)) observed.push(chunk);
  assert.deepEqual(observed, chunks, "middleware must preserve every stream chunk");
};
const overview = async () => {
  let result;
  const req = Object.assign(Readable.from(["{}"]), {
    headers: { host: "localhost" }, method: "POST", url: "/dsh-balance-monitor/overview",
  });
  await route.handler(req, { writeHead() {}, end(body) { result = JSON.parse(body); } });
  assert.equal(result.ok, true);
  return result.value;
};

emit({ type: "request/header", data: { header: { config: source } } });
// Main requests are counted from the durable event, not again from the stream.
await invoke({ ...source, sessionId: "real-session" }, [{ type: "usage", usage }]);
assert.equal((await overview()).totals.requests, 0);
const completed = { type: "assistant/message", time: Date.now(), data: { message: { id: "main-1", source }, usage } };
emit(completed);
emit(completed);
assert.equal((await overview()).totals.requests, 1);

// Title/compaction use their own route; duplicate usage in one stream counts once.
const finish = { type: "finish", reason: { kind: "error" } };
await invoke({ ...source, purpose: "session-title", sessionId: "real-session" }, [
  { type: "usage", usage }, { type: "usage", usage }, finish,
]);
await invoke({ provider: "deepseek-account", model: "deepseek-flash", purpose: "compaction", sessionId: "real-session" }, [
  { type: "usage", usage }, finish,
]);
// A billed failed attempt has its usage nested in the compact stream record.
const attempt = { type: "assistant/attempt", time: Date.now() + 1, data: {
  stream: [{ type: "chunk", time: Date.now(), chunk: { type: "usage", usage } }],
} };
emit(attempt);
emit(attempt);
emit({ type: "assistant/attempt", data: { stream: [] } });

// A foreign provider stays token-only, and a call without a session invents no session.
await invoke({ provider: "other", model: "foreign", purpose: "compaction", sessionId: "real-session" }, [{ type: "usage", usage }]);
await invoke({ ...source, purpose: "session-title" }, [{ type: "usage", usage }]);
const result = await overview();
assert.equal(result.totals.requests, 5);
assert.equal(result.sessionCount, 1);
assert.equal(result.models["other/foreign"].cost, 0);
assert.equal(result.models["deepseek-flash"].requests, 4);
assert.equal(result.models["deepseek-account/deepseek-flash"].requests, 1);
assert.equal(listeners.get("llm/stream").options.global, true);

// Invalid money inputs and malformed logs must neither count nor throw.
const state = emptyState(), session = createSessionState("invalid", "");
for (const invalid of [-1, NaN, Infinity, "100"]) {
  assert.equal(foldEvent(session, state, { type: "assistant/message", data: { usage: { inputTokens: invalid } } }, {}), false);
}
assert.equal(foldEvent(session, state, { type: "assistant/attempt", data: { stream: {} } }, {}), false);
assert.equal(foldEvent(session, state, { type: "assistant/attempt", data: { stream: [null] } }, {}), false);

await new Promise((resolve) => setTimeout(resolve, 3300));
const persisted = loadState(sandbox);
assert.equal(persisted.totals.requests, 5);
assert.equal(persisted.sessions["real-session"].requests, 5);
assert.equal(persisted.sessions["real-session"].currentProvider, source.provider);
assert.equal(persisted.sessions["real-session"].currentModel, source.model);
assert.deepEqual(persisted.sessions["real-session"].tokens, { uncached: 500, cacheRead: 1000, output: 250 });
assert.ok(persisted.totals.cost > 0);
console.log("PASS: auxiliary usage, durable attempt usage, dedupe, RPC session count, routes, validation and persisted ledger");
console.log(`Retained isolated ledger: ${sandbox}`);
process.exit(0);
