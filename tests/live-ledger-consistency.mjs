/**
 * Consistency test for dsh-balance-monitor's live event observer.
 *
 * Validates the claim that the two ledger paths cannot double count:
 *  A) file scan only            → baseline aggregates
 *  B) event stream fed from the SAME real events, after A → must add nothing
 *  C) event stream only, fresh state → must equal A exactly
 *  D) live-then-rescan           → must not double count either
 * Uses the real plugin modules, real pricing table, and real session logs.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import { foldEvent, createSessionState, syncSessionFile, listSessionFiles } from "../lib/sessions.js";
import { emptyState } from "../lib/store.js";
import { defaultPricing } from "../lib/pricing.js";

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const root = "C:\\Users\\ConTr0L\\.dsh\\sessions";
const prices = defaultPricing();

function events(file) {
  const buf = readFileSync(file);
  const pos = [];
  let i = 0;
  for (;;) { const f = buf.indexOf(MAGIC, i); if (f === -1) break; pos.push(f); i = f + 4; }
  const out = [];
  for (let k = 0; k < pos.length; k += 1) {
    let text;
    try { text = zstdDecompressSync(buf.subarray(pos[k], pos[k + 1] ?? buf.length)).toString("utf8"); } catch { continue; }
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      try { const ev = JSON.parse(line); if (ev && typeof ev.type === "string") out.push(ev); } catch {}
    }
  }
  return out;
}

/** Path A: the periodic cursor scan, exactly as the host runs it. */
function scanAll(state) {
  for (const entry of listSessionFiles(root)) {
    const session = state.sessions[entry.id] ?? (state.sessions[entry.id] = createSessionState(entry.id, entry.workspace));
    syncSessionFile(session, state, prices, entry.file);
  }
}

/** Path B: the live observer's fold, one event at a time, in append order. */
function feedLive(state, file, id) {
  const session = state.sessions[id] ?? (state.sessions[id] = createSessionState(id, ""));
  for (const ev of events(file)) foldEvent(session, state, ev, prices);
}

const files = [];
for (const ws of readdirSync(root, { withFileTypes: true })) {
  if (!ws.isDirectory()) continue;
  for (const s of readdirSync(join(root, ws.name), { withFileTypes: true })) {
    if (!s.isDirectory()) continue;
    const f = join(root, ws.name, s.name, "session.jsonl.zstd");
    try { statSync(f); files.push({ id: s.name, file: f }); } catch {}
  }
}

const snap = (state) => ({
  cost: +state.totals.cost.toFixed(6),
  requests: state.totals.requests,
  tokens: Object.values(state.sessions).reduce((a, s) => a + s.tokens.uncached + s.tokens.cacheRead + s.tokens.output, 0),
  seen: Object.keys(state.seenIds).length,
});

// A) baseline by scanning
const scanned = emptyState();
scanAll(scanned);
const A = snap(scanned);

// B) same events replayed live on top of the scanned state — must be a no-op
const afterLive = structuredClone(scanned);
for (const entry of files) feedLive(afterLive, entry.file, entry.id);
const B = snap(afterLive);

// C) live only, from an empty state
const live = emptyState();
for (const entry of files) feedLive(live, entry.file, entry.id);
const C = snap(live);

// D) live first, then a fresh full scan over the same logs
const liveThenScan = emptyState();
for (const entry of files) feedLive(liveThenScan, entry.file, entry.id);
scanAll(liveThenScan);
const D = snap(liveThenScan);

const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const checks = [
  ["B == A (live adds nothing after scan: dedupe holds)", same(B, A), B, A],
  ["C == A (live-only equals scan-only)", same(C, A), C, A],
  ["D == A (live-then-scan equals scan-only)", same(D, A), D, A],
];
console.log("A baseline (scan):        ", JSON.stringify(A));
console.log("B scan + live replay:     ", JSON.stringify(B));
console.log("C live only:              ", JSON.stringify(C));
console.log("D live then scan:         ", JSON.stringify(D));
console.log("");
let failed = 0;
for (const [label, ok, got, want] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) { failed += 1; console.log("   got ", JSON.stringify(got), "\n   want", JSON.stringify(want)); }
}

// E) real-time delta: a brand-new completion on a live session must move the
// aggregates through the observer path alone (simulating a running session).
const synthetic = emptyState();
const s = createSessionState("session-live-test", "");
synthetic.sessions["session-live-test"] = s;
foldEvent(s, synthetic, { type: "request/header", data: { header: { config: { provider: "deepseek-official", model: "deepseek-v4" } } } }, prices);
const before = synthetic.totals.cost;
const moved = foldEvent(s, synthetic, {
  type: "assistant/message",
  time: Date.now(),
  data: { turn: 1, step: 1, message: { id: "live-test-msg-1" }, usage: { inputTokens: 1000, cacheReadTokens: 9000, outputTokens: 500 } },
}, prices);
const after = synthetic.totals.cost;
const dup = foldEvent(s, synthetic, {
  type: "assistant/message",
  time: Date.now(),
  data: { turn: 1, step: 1, message: { id: "live-test-msg-1" }, usage: { inputTokens: 1000, cacheReadTokens: 9000, outputTokens: 500 } },
}, prices);
console.log("");
console.log(`${moved && after > before ? "PASS" : "FAIL"}  E1 live completion moves the ledger in real time (Δcost=${(after - before).toFixed(6)})`);
console.log(`${dup === false && Math.abs(synthetic.totals.cost - after) < 1e-12 ? "PASS" : "FAIL"}  E2 same message.id replayed is suppressed`);

process.exit(failed === 0 ? 0 : 1);
