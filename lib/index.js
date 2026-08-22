/**
 * dsh-balance-monitor — host half.
 *
 * Responsibilities:
 *  - track provider-reported LLM usage from persisted session logs and price
 *    it with the official DeepSeek price table, synchronized automatically
 *    from the vendor docs page (billing rules are plugin-managed, never
 *    user-entered);
 *  - poll provider balance/usage endpoints (DeepSeek, Zhipu GLM, OpenRouter,
 *    Tavily) and cache the results;
 *  - evaluate daily / total / request-count limits, optionally blocking new
 *    LLM requests through the `llm/stream` waterfall;
 *  - expose an RPC channel to the client half.
 *
 * @module dsh-balance-monitor
 */
import { join } from "node:path";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { PrefsSchema, PREFS_NS, dayKey, peakStatus } from "./config.js";
import { listSessionFiles, syncSessionFile, createSessionState } from "./sessions.js";
import { fetchProviderBalance } from "./balance.js";
import { emptyState, loadState, saveState } from "./store.js";
import { defaultPricing, fetchOfficialPricing, sanitizePricing } from "./pricing.js";

const CHANNEL = "/dsh-balance-monitor";
/** Official-pricing re-verification interval (24h). */
const PRICING_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** DeepSeek credential reference used by the llm-deepseek adapter. */
const DEEPSEEK_KEY_REF = "DEEPSEEK_API_KEY";

/** Deep merge JSON-compatible plain objects (later wins; arrays replaced;
 *  a literal `null` value deletes the key — the patch deletion convention). */
function deepMerge(base, patch) {
  if (patch === null) return undefined;
  if (patch === undefined || typeof patch !== "object" || Array.isArray(patch)) return patch;
  if (base === null || typeof base !== "object" || Array.isArray(base)) base = {};
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
    } else {
      next[key] = deepMerge(base[key], value);
    }
  }
  return next;
}

/** Wrap an error into the RPC error branch (catch-all 'internal' code). */
function rpcError(error) {
  return {
    ok: false,
    error: { code: "internal", message: error instanceof Error ? error.message : String(error) },
  };
}

/** RPC success branch. */
function rpcOk(value) {
  return { ok: true, value };
}

/**
 * Plugin apply body.
 * @param ctx - plugin context.
 * @param _config - composition config (none supported; user prefs live in settings).
 */
export function apply(ctx, _config = {}) {
  const home = resolveDshHome();
  const initialPricingState = loadState(home); // one load; reused for pricing
  const monitor = {
    home,
    state: initialPricingState,
    prefs: PrefsSchema({}),
    settingsScope: null,
    settingsSctx: null,
    credentials: null,
    balanceCache: new Map(),
    syncing: false,
    saveTimer: null,
    /** Official pricing (auto-synced; billing rules are plugin-managed). */
    pricing: sanitizePricing(initialPricingState.pricing) ?? defaultPricing(),
  };

  // -------------------------------------------------------------------------
  // Pricing / limits helpers (pure over monitor state)
  // -------------------------------------------------------------------------

  function currentPrices() {
    return monitor.pricing;
  }

  function todayKey() {
    return dayKey(Date.now());
  }

  function evaluateLimits(now = Date.now()) {
    const limits = monitor.prefs.limits ?? {};
    const today = monitor.state.daily[todayKey()] ?? { cost: 0, requests: 0 };
    const rows = [
      {
        key: "daily",
        labelKey: "limit.daily",
        enabled: Boolean(limits.daily?.enabled),
        value: limits.daily?.value ?? 0,
        action: limits.daily?.action ?? "warn",
        current: today.cost,
      },
      {
        key: "total",
        labelKey: "limit.total",
        enabled: Boolean(limits.total?.enabled),
        value: limits.total?.value ?? 0,
        action: limits.total?.action ?? "warn",
        current: monitor.state.totals.cost,
      },
      {
        key: "requests",
        labelKey: "limit.requests",
        enabled: Boolean(limits.requests?.enabled),
        value: limits.requests?.value ?? 0,
        action: limits.requests?.action ?? "warn",
        current: monitor.state.totals.requests,
      },
    ];
    return rows.map((row) => ({
      ...row,
      exceeded: row.enabled && row.value > 0 && row.current >= row.value,
      remaining: row.enabled && row.value > 0 ? Math.max(0, row.value - row.current) : null,
      progress: row.enabled && row.value > 0 ? Math.min(1, row.current / row.value) : 0,
    }));
  }

  /** First blocking limit, or null when the next request may proceed. */
  function blockedReason() {
    for (const row of evaluateLimits()) {
      if (row.enabled && row.exceeded && row.action === "block") {
        return row.key === "requests"
          ? `dsh-balance-monitor: request limit reached (${row.value})`
          : `dsh-balance-monitor: spending limit reached (${row.key}, ${row.value})`;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Stats sync (incremental session-log replay)
  // -------------------------------------------------------------------------

  function persistSoon() {
    if (monitor.saveTimer !== null) return;
    monitor.saveTimer = setTimeout(() => {
      monitor.saveTimer = null;
      try {
        saveState(monitor.home, monitor.state);
      } catch (error) {
        ctx.logger.warn("dsh-balance-monitor: state save failed: %s", error?.message ?? error);
      }
    }, 3000);
    if (monitor.saveTimer.unref) monitor.saveTimer.unref();
  }

  async function syncStats() {
    if (monitor.syncing) return;
    monitor.syncing = true;
    try {
      const files = listSessionFiles(join(monitor.home, "sessions"));
      let changed = false;
      for (const entry of files) {
        let session = monitor.state.sessions[entry.id];
        if (!session) {
          session = createSessionState(entry.id, entry.workspace);
          monitor.state.sessions[entry.id] = session;
          changed = true;
        }
        if (syncSessionFile(session, monitor.state, currentPrices(), entry.file)) changed = true;
      }
      if (changed) persistSoon();
    } catch (error) {
      ctx.logger.warn("dsh-balance-monitor: stats sync failed: %s", error?.message ?? error);
    } finally {
      monitor.syncing = false;
    }
  }

  // -------------------------------------------------------------------------
  // Official pricing sync (billing rules are plugin-managed, never user-set)
  // -------------------------------------------------------------------------

  /** Verify the published price table against the official docs page. */
  async function refreshOfficialPricing() {
    const result = await fetchOfficialPricing();
    if (result.ok) {
      monitor.pricing = result.pricing;
      monitor.state.pricing = result.pricing;
      persistSoon();
      ctx.logger.info("dsh-balance-monitor: official pricing synced (%d models)", Object.keys(result.pricing.models).length);
    } else {
      ctx.logger.warn("dsh-balance-monitor: official pricing sync failed: %s", result.error);
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Balance polling
  // -------------------------------------------------------------------------

  /** Resolve one provider's credentials (DeepSeek falls back to DSH creds). */
  async function providerKey(provider) {
    const config = monitor.prefs.providers?.[provider];
    if (provider === "deepseek") {
      if (config?.apiKey) return config.apiKey;
      try {
        const resolved = await monitor.credentials?.resolve(DEEPSEEK_KEY_REF);
        if (resolved?.value) return resolved.value;
      } catch {
        /* credentials unavailable */
      }
      return "";
    }
    return config?.apiKey ?? "";
  }

  async function refreshBalance(force = false) {
    for (const provider of Object.keys(monitor.prefs.providers ?? {})) {
      const cached = monitor.balanceCache.get(provider);
      if (!force && cached?.fetchedAt && Date.now() - cached.fetchedAt < 4000) continue;
      const key = await providerKey(provider);
      if (!key) {
        monitor.balanceCache.set(provider, {
          ok: false,
          fetchedAt: Date.now(),
          error: "no-api-key",
          configured: false,
        });
        continue;
      }
      const config = monitor.prefs.providers[provider] ?? {};
      try {
        const result = await fetchProviderBalance(provider, config.baseURL, key);
        monitor.balanceCache.set(provider, { ...result, fetchedAt: Date.now(), configured: true });
      } catch (error) {
        monitor.balanceCache.set(provider, {
          ok: false,
          fetchedAt: Date.now(),
          configured: true,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // LLM request interception (spending-limit enforcement)
  // -------------------------------------------------------------------------

  ctx.on("llm/stream", (options, next) => {
    if (!monitor.prefs.enabled) return next();
    const reason = blockedReason();
    if (reason !== null) {
      const error = new Error(reason);
      error.name = "BalanceLimitExceeded";
      throw error;
    }
    return next();
  });

  // -------------------------------------------------------------------------
  // Settings wiring
  // -------------------------------------------------------------------------

  ctx.inject(["settings", "credentials"], (sctx) => {
    monitor.settingsSctx = sctx;
    monitor.credentials = sctx.credentials;
    const ns = settingsNamespace(PREFS_NS);
    const scope = sctx.settings.register(ns, PrefsSchema);
    monitor.settingsScope = scope;
    monitor.prefs = scope.get();

    // Poll loop: re-arms when refreshInterval changes; also driven by settings
    // changes so new limits/prices apply live.
    let timer = null;
    const arm = () => {
      if (timer !== null) clearInterval(timer);
      const seconds = monitor.prefs.refreshInterval ?? 60;
      timer = setInterval(() => {
        void refreshBalance(false);
        void syncStats();
      }, seconds * 1000);
      if (timer.unref) timer.unref();
      void refreshBalance(false);
      void syncStats();
    };
    const disposeWatcher = scope.watch(() => {
      monitor.prefs = scope.get();
      arm();
    });
    arm();
    // Official pricing verification: on boot, then daily.
    void refreshOfficialPricing();
    const pricingTimer = setInterval(() => void refreshOfficialPricing(), PRICING_SYNC_INTERVAL_MS);
    if (pricingTimer.unref) pricingTimer.unref();
    return () => {
      if (timer !== null) clearInterval(timer);
      clearInterval(pricingTimer);
      disposeWatcher?.();
      void refreshBalance(true);
      void syncStats();
      persistSoon();
    };
  });

  // -------------------------------------------------------------------------
  // RPC channel
  // -------------------------------------------------------------------------

  ctx.inject(["connection"], (sctx) => {
    const handler = async (endpoint, payload) => {
      try {
        switch (endpoint) {
          case "overview": {
            return rpcOk({
              enabled: monitor.prefs.enabled,
              refreshInterval: monitor.prefs.refreshInterval,
              providers: Object.fromEntries(monitor.balanceCache.entries()),
              display: monitor.prefs.display,
              today: monitor.state.daily[todayKey()] ?? { cost: 0, requests: 0 },
              totals: monitor.state.totals,
              lastEventAt: monitor.state.lastEventAt,
              limits: evaluateLimits(),
              peak: {
                status: peakStatus(Date.now(), currentPrices().peakWindows),
                windows: currentPrices().peakWindows,
                offPeakFactor: currentPrices().offPeakFactor,
              },
              pricing: {
                source: monitor.pricing.source,
                fetchedAt: monitor.pricing.fetchedAt,
                modelCount: Object.keys(monitor.pricing.models).length,
              },
              savedAt: monitor.state.savedAt,
            });
          }
          case "refresh": {
            await refreshBalance(true);
            return rpcOk({ refreshedAt: Date.now() });
          }
          case "sessions": {
            const limit = typeof payload?.limit === "number" ? payload.limit : 200;
            const rows = Object.values(monitor.state.sessions)
              .filter((session) => session.cost > 0 || session.requests > 0)
              .sort((a, b) => (b.lastEvent ?? 0) - (a.lastEvent ?? 0))
              .slice(0, limit)
              .map((session) => ({
                id: session.id,
                title: session.title,
                workspace: session.workspace,
                cost: session.cost,
                requests: session.requests,
                firstEvent: session.firstEvent,
                lastEvent: session.lastEvent,
                tokens: session.tokens,
                models: session.requestsByModel,
              }));
            return rpcOk({ rows, total: Object.keys(monitor.state.sessions).length });
          }
          case "history": {
            return rpcOk({
              daily: monitor.state.daily,
              totals: monitor.state.totals,
            });
          }
          case "config/get": {
            const ns = settingsNamespace(PREFS_NS);
            const descriptor = monitor.settingsSctx?.settings
              .describe({ redactSecrets: true })
              .find((candidate) => candidate.ns === ns);
            if (!descriptor) return rpcOk({ value: monitor.prefs, secrets: [], revision: 0 });
            return rpcOk({
              value: descriptor.value,
              secrets: descriptor.secrets ?? [],
              revision: descriptor.revision ?? 0,
            });
          }
          case "config/patch": {
            const patch = payload?.patch;
            if (!patch || typeof patch !== "object") throw new TypeError("patch must be an object");
            const merged = deepMerge(monitor.prefs, patch);
            await monitor.settingsSctx.settings.replace(ns, merged, payload?.revision);
            return rpcOk({ ok: true });
          }
          case "config/setSecret": {
            const path = payload?.path;
            if (!Array.isArray(path) || path.length === 0) throw new TypeError("path must be a non-empty array");
            const value = typeof payload?.value === "string" ? payload.value : "";
            const merged = deepMerge(monitor.prefs, setPath({}, path, value));
            await monitor.settingsSctx.settings.replace(ns, merged, payload?.revision);
            return rpcOk({ ok: true });
          }
          case "stats/reset": {
            monitor.state = emptyState();
            monitor.balanceCache.clear();
            persistSoon();
            return rpcOk({ ok: true });
          }
          default:
            return rpcError(new Error(`unknown endpoint: ${endpoint}`));
        }
      } catch (error) {
        return rpcError(error);
      }
    };
    const disposer = sctx.connection.rpc.handle(CHANNEL, handler, { authority: "trusted-host" });
    return disposer;
  });
}

/** Build a nested {path[0]: {path[1]: ... value}} object for a dotted path. */
function setPath(root, path, value) {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    root[head] = value;
  } else {
    root[head] = setPath({}, rest, value);
  }
  return root;
}

export { PrefsSchema };
