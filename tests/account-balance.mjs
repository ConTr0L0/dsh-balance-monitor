/**
 * Account-login balance tests (DSH 0.2 account service).
 *
 * Context: DSH 0.2 ships a DeepSeek account login (`ctx.deepseekAccount`, the
 * `deepseek-account` row of the base bundle). Its `getBalance(client)` reads the
 * Platform wallets over `GET /api/v0/users/get_user_summary` and needs no API
 * key, so the plugin has two credential paths for DeepSeek.
 *
 * Two contracts must hold, and both are pure logic — no network, no host:
 *
 *  1. Wallet normalization. Platform reports `normal_wallets` (recharge) and
 *     `bonus_wallets` (granted) as decimal STRINGS; the API-key route reports
 *     total / granted / topped-up for one entry. The two must normalize to the
 *     same shape (total = recharge + granted) so the UI needs no special case.
 *  2. Source selection. "auto" prefers a signed-in account and falls back to the
 *     key; an explicit choice is never silently overridden; and when neither
 *     path can answer the plugin reports a reason instead of a zero balance.
 *
 * Run from the plugin root:
 *   node tests/account-balance.mjs
 */
import { normalizeAccountWallets, planBalanceSource } from "../lib/balance.js";

const checks = [];
const check = (label, ok, detail = "") => checks.push([label, ok, detail]);
const near = (label, got, want) => check(label, Math.abs(got - want) < 1e-9, `got ${got} want ${want}`);

// ---------------------------------------------------------------------------
// 1) Real Platform payload shape (captured 2026-10-01 from get_user_summary)
// ---------------------------------------------------------------------------
const wallets = [{ currency: "CNY", balance: "8.9255904400000000", token_estimation: "0" }];
const bonuses = [{ currency: "CNY", balance: "1.9273626400000000", token_estimation: "0" }];
const live = normalizeAccountWallets(wallets, bonuses);
check("live payload normalizes", live.ok === true, JSON.stringify(live));
near("live total = recharge + granted", live.total, 10.85295308);
near("live topped-up kept separate", live.toppedUp, 8.92559044);
near("live granted kept separate", live.granted, 1.92736264);
check("live available mirrors total", live.available === live.total, String(live.available));
check("live currency follows the wallet", live.currency === "CNY", String(live.currency));
check("live entry is marked available", live.isAvailable === true, String(live.isAvailable));

// ---------------------------------------------------------------------------
// 2) Never invent an amount
// ---------------------------------------------------------------------------
const noBonus = normalizeAccountWallets(wallets, []);
check("no granted wallet still normalizes", noBonus.ok === true && noBonus.granted === 0, JSON.stringify(noBonus));
near("recharge-only total", noBonus.total, 8.92559044);

const noRecharge = normalizeAccountWallets([], bonuses);
near("granted-only total", noRecharge.total, 1.92736264);
near("granted-only topped-up is 0", noRecharge.toppedUp, 0);

const empty = normalizeAccountWallets([], []);
check("no wallet at all is a failure, not 0", empty.ok === false && empty.total === undefined, JSON.stringify(empty));
const malformed = normalizeAccountWallets([{ currency: "CNY" }], []);
check("a wallet without a balance string is not a 0", malformed.ok === false, JSON.stringify(malformed));

// ---------------------------------------------------------------------------
// 3) Currency handling
// ---------------------------------------------------------------------------
const mixed = normalizeAccountWallets(
  [{ currency: "USD", balance: "5.00" }, { currency: "CNY", balance: "1.00" }],
  [],
);
check("CNY is preferred over another currency", mixed.currency === "CNY", String(mixed.currency));
near("only the chosen currency is summed", mixed.total, 1);

const otherCurrencyBonus = normalizeAccountWallets(
  [{ currency: "CNY", balance: "2" }],
  [{ currency: "USD", balance: "9" }],
);
near("a bonus in another currency is not mixed in", otherCurrencyBonus.total, 2);
near("...and is not reported as granted", otherCurrencyBonus.granted, 0);

const exponent = normalizeAccountWallets([{ currency: "CNY", balance: "5.0000000000000000" }], []);
near("trailing-zero decimals parse", exponent.total, 5);

// ---------------------------------------------------------------------------
// 4) Source selection
// ---------------------------------------------------------------------------
const use = (source, status, hasKey) => planBalanceSource(source, status, hasKey);

check("auto uses the signed-in account", use("auto", "ready", false).use === "account");
check("auto uses the account even with a key present", use("auto", "ready", true).use === "account");
check("auto falls back to the key when signed out", use("auto", "signed-out", true).use === "key");
check("auto falls back to the key when the account query fails", use("auto", "failed", true).use === "key");
const autoNoKey = use("auto", "signed-out", false);
check(
  "auto without an account or key reports no-api-key",
  autoNoKey.use === null && autoNoKey.error === "no-api-key" && autoNoKey.configured === false,
  JSON.stringify(autoNoKey),
);
const autoFailedNoKey = use("auto", "failed", false);
check(
  "auto reports the account failure when there is no key either",
  autoFailedNoKey.use === null && autoFailedNoKey.error === "account-failed" && autoFailedNoKey.configured === true,
  JSON.stringify(autoFailedNoKey),
);

check("account-only uses the login", use("account", "ready", false).use === "account");
const accountSignedOut = use("account", "signed-out", true);
check(
  "account-only never silently falls back to the key",
  accountSignedOut.use === null && accountSignedOut.error === "account-signed-out",
  JSON.stringify(accountSignedOut),
);
const accountFailed = use("account", "failed", false);
check(
  "account-only reports a failed query",
  accountFailed.use === null && accountFailed.error === "account-failed" && accountFailed.configured === true,
  JSON.stringify(accountFailed),
);

check("key-only ignores a signed-in account", use("key", "ready", true).use === "key");
const keyOnlyUnset = use("key", "ready", false);
check(
  "key-only without a key reports no-api-key",
  keyOnlyUnset.use === null && keyOnlyUnset.error === "no-api-key",
  JSON.stringify(keyOnlyUnset),
);

// A host without the account provider (older DSH): unchanged key behaviour.
check("unsupported account service falls back to the key", use("auto", "unsupported", true).use === "key");
const unsupportedNoKey = use("auto", "unsupported", false);
check(
  "unsupported account service without a key reports no-api-key",
  unsupportedNoKey.use === null && unsupportedNoKey.error === "no-api-key",
  JSON.stringify(unsupportedNoKey),
);

// ---------------------------------------------------------------------------
let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? `\nALL ${checks.length} CHECKS PASSED` : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
