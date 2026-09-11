/**
 * Exact ledger recomputation under two price tables, over the full dual-format
 * corpus via the production scan path (read-only; nothing is persisted).
 *  A) current defaults (official 2026-09-10 table) → expect 115.6068 元
 *  B) the frozen 2026-09-09 snapshot the plugin actually ran on → expect
 *     171.1209 元 (flash-family at 3/0.1/9, unknown ids at the old default)
 */
import { listSessionFiles, createSessionState, syncSessionFile } from "../lib/sessions.js";
import { emptyState } from "../lib/store.js";
import { defaultPricing } from "../lib/pricing.js";

const root = "C:\\Users\\ConTr0L\\.dsh\\sessions";
const EXPECT_A = 115.6068;
const EXPECT_B = 171.1209;

function scanAll(state, prices) {
  for (const entry of listSessionFiles(root)) {
    const session = state.sessions[entry.id] ?? (state.sessions[entry.id] = createSessionState(entry.id, entry.workspace));
    syncSessionFile(session, state, prices, entry.file, entry.fileName);
  }
}

// B replicates the frozen 2026-09-09 snapshot the plugin priced with until now
// (unknown ids — deepseek-flash, temp ids — fell to the then-default 3/0.1/9).
const legacy = defaultPricing();
legacy.models = {
  "deepseek-v4-flash": { input: 3.0, cacheHit: 0.1, output: 9.0 },
  "deepseek-v4-flash-vision-exp": { input: 3.0, cacheHit: 0.1, output: 9.0 },
  "deepseek-v4.1-flash-expires-on-0910": { input: 3.0, cacheHit: 0.1, output: 9.0 },
  "deepseek-flash": { input: 3.0, cacheHit: 0.1, output: 9.0 },
  "deepseek-v4-pro": { input: 9.0, cacheHit: 0.3, output: 27.0 },
};

const stateA = emptyState();
scanAll(stateA, defaultPricing());
const stateB = emptyState();
scanAll(stateB, legacy);

const fmt = (state) => ({
  cost: +state.totals.cost.toFixed(4),
  requests: state.totals.requests,
  tokensM: +(Object.values(state.models).reduce((a, m) => a + m.input + m.cacheRead + m.output, 0) / 1e6).toFixed(1),
});
const perModel = (state) =>
  Object.fromEntries(Object.entries(state.models).map(([id, m]) => [id, {
    requests: m.requests,
    cost: +m.cost.toFixed(2),
  }]));

console.log("A 官方 2026-09-10 新价（修复后面板应显示）:", JSON.stringify(fmt(stateA)));
console.log("B 冻结的 2026-09-09 旧价（修复前显示）:  ", JSON.stringify(fmt(stateB)));
console.log("A per-model:", JSON.stringify(perModel(stateA)));
console.log("");
const okA = Math.abs(stateA.totals.cost - EXPECT_A) < 5e-4 && stateA.totals.requests === 6508;
const okB = Math.abs(stateB.totals.cost - EXPECT_B) < 5e-4 && stateB.totals.requests === 6508;
console.log(`${okA ? "PASS" : "FAIL"}  A == ${EXPECT_A} (got ${stateA.totals.cost.toFixed(6)})`);
console.log(`${okB ? "PASS" : "FAIL"}  B == ${EXPECT_B} (got ${stateB.totals.cost.toFixed(6)})`);
console.log(`高估幅度: ${(stateB.totals.cost - stateA.totals.cost).toFixed(2)} 元`);
process.exit(okA && okB ? 0 : 1);
