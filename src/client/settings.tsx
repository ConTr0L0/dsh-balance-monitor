/**
 * Settings page for dsh-balance-monitor (DSH Settings → 余额监控).
 *
 * Top: consumption dashboard (month heatmap + daily per-model stacked token
 * bars with 7/14/30-day ranges + model-usage donut). Below: configuration —
 * auto-saves (debounced); secret fields are write-only through
 * config/setSecret so values never cross the wire. Billing rules are NOT
 * exposed — verified automatically from the official docs and reported only
 * as a sync status; provider keys are one merged column; rare settings
 * (base URLs) live in a collapsible "Advanced" group.
 */
import { useEffect, useRef, useState } from "react";
import type { ConfigValue, DayStat, History, ModelStat, Overview, RpcCall, SecretSlot } from "./api";
import { t as i18n } from "./locales";
import { MonthHeatmap, StackedBarChart, DonutChart, modelColor } from "./charts";

interface LimitDraft {
  enabled: boolean;
  value: string;
  action: "warn" | "block";
  showInSidebar: boolean;
}

interface Draft {
  enabled: boolean;
  refreshInterval: number;
  providers: Record<string, { baseURL: string }>;
  display: {
    provider: string;
    field: "total" | "available";
    visibleModels: string[];
    showBalance: boolean;
    showToday: boolean;
    showRemaining: boolean;
    showPeak: boolean;
    showRefresh: boolean;
  };
  limits: Record<"daily" | "total" | "requests", LimitDraft>;
}

const LIMIT_KEYS = ["daily", "total", "requests"] as const;
const PROVIDERS = ["deepseek", "zhipu", "openrouter", "tavily"] as const;
const PROVIDER_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  zhipu: "Zhipu GLM",
  openrouter: "OpenRouter",
  tavily: "Tavily",
};

function toDraft(value: Record<string, unknown>): Draft {
  const providersIn = (value.providers ?? {}) as Record<string, { baseURL?: string }>;
  const limitsIn = (value.limits ?? {}) as Record<string, { enabled?: boolean; value?: number; action?: string; showInSidebar?: boolean }>;
  const displayIn = (value.display ?? {}) as Record<string, unknown>;
  return {
    enabled: Boolean(value.enabled),
    refreshInterval: (value.refreshInterval as number) ?? 60,
    providers: Object.fromEntries(
      PROVIDERS.map((id) => [id, { baseURL: providersIn[id]?.baseURL ?? "" }]),
    ),
    display: {
      provider: String(displayIn.provider ?? "deepseek"),
      field: displayIn.field === "available" ? "available" : "total",
      visibleModels: Array.isArray(displayIn.visibleModels) ? displayIn.visibleModels.map(String) : [],
      showBalance: displayIn.showBalance !== false,
      showToday: displayIn.showToday !== false,
      showRemaining: displayIn.showRemaining !== false,
      showPeak: displayIn.showPeak !== false,
      showRefresh: displayIn.showRefresh !== false,
    },
    limits: Object.fromEntries(
      LIMIT_KEYS.map((key) => [
        key,
        {
          enabled: Boolean(limitsIn[key]?.enabled),
          value: String(limitsIn[key]?.value ?? 10),
          action: limitsIn[key]?.action === "block" ? "block" : "warn",
          showInSidebar: Boolean(limitsIn[key]?.showInSidebar),
        },
      ]),
    ) as Draft["limits"],
  };
}

/** Build the wire patch for config/patch (secrets excluded). */
function toPatch(draft: Draft): Record<string, unknown> {
  return {
    enabled: draft.enabled,
    refreshInterval: draft.refreshInterval,
    providers: Object.fromEntries(
      Object.entries(draft.providers).map(([id, entry]) => [id, { baseURL: entry.baseURL }]),
    ),
    display: draft.display,
    limits: Object.fromEntries(
      LIMIT_KEYS.map((key) => [
        key,
        {
          enabled: draft.limits[key].enabled,
          value: Number(draft.limits[key].value) || 0,
          action: draft.limits[key].action,
          showInSidebar: draft.limits[key].showInSidebar,
        },
      ]),
    ),
  };
}

function statusLabel(overview: Overview | null): string {
  const pricing = overview?.pricing;
  if (!pricing) return i18n("pricingUnknown");
  if (pricing.source !== "deepseek-docs") return i18n("pricingBuiltin");
  return i18n("pricingSynced", { n: pricing.modelCount });
}

function syncAgo(overview: Overview | null): string {
  const fetchedAt = overview?.pricing?.fetchedAt ?? 0;
  if (!fetchedAt) return "—";
  const hours = Math.floor((Date.now() - fetchedAt) / 3_600_000);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function SettingsCard({ rpc }: { rpc: RpcCall }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [secrets, setSecrets] = useState<SecretSlot[]>([]);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [statMonthYear, setStatMonthYear] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(7);
  const [errorDetail, setErrorDetail] = useState("");
  const saveTimer = useRef<number | null>(null);
  const secretTimer = useRef<number | null>(null);
  const secretQueue = useRef<Promise<void>>(Promise.resolve());

  const showError = (error: unknown) => {
    setErrorDetail(error instanceof Error ? error.message : String(error));
    setSaveState("error");
  };

  /** Full draft refresh — initial mount and explicit reload only. */
  const load = async () => {
    try {
      const config = await rpc<ConfigValue>("config/get");
      setDraft(toDraft((config.value ?? {}) as Record<string, unknown>));
      setSecrets(config.secrets ?? []);
      setRevision(config.revision);
      const overviewData = await rpc<Overview>("overview");
      setOverview(overviewData);
      const historyData = await rpc<History>("history");
      setHistory(historyData);
      setSaveState("idle");
    } catch (error) {
      showError(error);
    }
  };

  /** Lightweight refresh after a write: revision/secrets/stats only —
   *  the draft KEEPS the user's optimistic values. A read-back race or a
   *  re-render can therefore never visually "revert" a just-saved toggle.
   *  (The server write itself is authoritative and verified separately.) */
  const refreshAfterWrite = async () => {
    try {
      const config = await rpc<ConfigValue>("config/get");
      setSecrets(config.secrets ?? []);
      setRevision(config.revision);
      const overviewData = await rpc<Overview>("overview");
      setOverview(overviewData);
      const historyData = await rpc<History>("history");
      setHistory(historyData);
    } catch (error) {
      showError(error);
    }
  };

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void refreshAfterWrite(), 60_000);
    return () => {
      window.clearInterval(poll);
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      if (secretTimer.current !== null) clearTimeout(secretTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc]);

  const mutate = (updater: (current: Draft) => Draft) => {
    setDraft((current) => (current ? updater(current) : current));
    scheduleSave();
  };

  const scheduleSave = () => {
    setSaveState("saving");
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void save(), 800);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await rpc("config/patch", { patch: toPatch(draft), revision });
      await refreshAfterWrite();
      setSaveState("saved");
    } catch (error) {
      // A conflict or validation failure: re-sync the draft with the server.
      showError(error);
      void load();
    }
  };

  /** Secret writes are debounced and serialized: typing fires one onChange
   *  per keystroke and concurrent setSecret calls raced each other's
   *  revision → SettingsConflictError ("保存失败"). */
  const queueSecret = (provider: string, value: string) => {
    if (secretTimer.current !== null) clearTimeout(secretTimer.current);
    secretTimer.current = window.setTimeout(() => {
      secretTimer.current = null;
      secretQueue.current = secretQueue.current
        .then(async () => {
          setSaveState("saving");
          await rpc("config/setSecret", { path: ["providers", provider, "apiKey"], value, revision });
          await refreshAfterWrite();
          setSaveState("saved");
        })
        .catch((error) => showError(error));
    }, 600);
  };

  const secretSet = (provider: string) => {
    const slot = secrets.find((entry) => entry.path.join(".") === `providers.${provider}.apiKey`);
    return Boolean(slot?.set);
  };

  if (!draft) {
    return <div className="bm-empty">{i18n("loading")}</div>;
  }

  const shiftStatMonth = (delta: number) => {
    const next = new Date(statMonthYear.year, statMonthYear.month + delta, 1);
    setStatMonthYear({ year: next.getFullYear(), month: next.getMonth() });
  };
  const now = new Date();
  const statIsCurrent = statMonthYear.year === now.getFullYear() && statMonthYear.month === now.getMonth();

  const allModelIds = Object.keys(overview?.models ?? {});
  const visibleModels = draft.display.visibleModels;
  const filteredModels = visibleModels.length > 0 ? visibleModels : allModelIds;
  const toggleModel = (modelId: string) => {
    mutate((c) => {
      const current = c.display.visibleModels;
      const nextSet = new Set(current.length > 0 ? current : allModelIds);
      if (nextSet.has(modelId)) nextSet.delete(modelId);
      else nextSet.add(modelId);
      return { ...c, display: { ...c.display, visibleModels: [...nextSet] } };
    });
  };

  return (
    <div className="bm-settings">
      <div className="bm-group bm-stats-group">
        <span className="bm-group-title">{i18n("consumptionStats")}</span>
        <div className="bm-months">
          <button type="button" className="bm-iconbtn" onClick={() => shiftStatMonth(-1)} aria-label="previous">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
          </button>
          <span>{statMonthYear.year} / {String(statMonthYear.month + 1).padStart(2, "0")}</span>
          <button type="button" className="bm-iconbtn" onClick={() => shiftStatMonth(1)} disabled={statIsCurrent} aria-label="next">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5l4.5 4.5L6 12.5" /></svg>
          </button>
        </div>
        <MonthHeatmap daily={(history?.daily ?? {}) as Record<string, DayStat>} year={statMonthYear.year} month={statMonthYear.month} />
        <span className="bm-note">{i18n("heatNote")}</span>
      </div>

      <div className="bm-group">
        <div className="bm-stats-head">
          <span className="bm-group-title">{i18n("dailyTokens")}</span>
          <span className="bm-tabs">
            {([7, 14, 30] as const).map((days) => (
              <button
                type="button"
                key={days}
                className="bm-tab"
                data-active={rangeDays === days || undefined}
                onClick={() => setRangeDays(days)}
              >
                {days} {i18n("daysUnit")}
              </button>
            ))}
          </span>
        </div>
        <div className="bm-model-filter">
          <span className="bm-card-label">{i18n("modelFilter")}</span>
          {allModelIds.map((id) => (
            <button
              type="button"
              key={id}
              className="bm-filter-chip"
              data-on={filteredModels.includes(id) || undefined}
              onClick={() => toggleModel(id)}
            >
              <i style={{ background: modelColor(id) }} />{id}
            </button>
          ))}
        </div>
        <div className="bm-stacked-card">
          <StackedBarChart daily={(history?.daily ?? {}) as Record<string, DayStat>} days={rangeDays} visibleModels={filteredModels} />
        </div>
      </div>

      <div className="bm-group">
        <span className="bm-group-title">{i18n("modelUsage")}</span>
        <DonutChart models={(overview?.models ?? {}) as Record<string, ModelStat>} visibleModels={filteredModels} />
      </div>

      <div className="bm-group">
        <div className="bm-toggle">
          <span>{i18n("enable")}</span>
          <label className="bm-switch">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => mutate((c) => ({ ...c, enabled: event.target.checked }))} />
            <i />
          </label>
        </div>
        <div className="bm-grid2">
          <div className="bm-field">
            <label>{i18n("refreshInterval")}</label>
            <select
              className="bm-select"
              value={draft.refreshInterval}
              onChange={(event) => mutate((c) => ({ ...c, refreshInterval: Number(event.target.value) }))}
            >
              <option value={5}>5s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bm-group bm-keys-card">
        <span className="bm-group-title">{i18n("providerKeys")}</span>
        {PROVIDERS.map((id) => (
          <div className="bm-key-row" key={id}>
            <span className="bm-key-name">{PROVIDER_LABELS[id]}</span>
            <div className="bm-secret bm-secret-grow">
              <input
                className="bm-input"
                type="password"
                autoComplete="off"
                placeholder={secretSet(id) ? i18n("keySet") : i18n("keyUnset")}
                value=""
                onChange={(event) => {
                  if (event.target.value) queueSecret(id, event.target.value);
                  event.target.value = "";
                }}
              />
            </div>
          </div>
        ))}
        <span className="bm-note">{i18n("deepseekAutoKey")}</span>
      </div>

      <div className="bm-group">
        <span className="bm-group-title">{i18n("displayTitle")}</span>
        <div className="bm-grid2">
          <div className="bm-field">
            <label>{i18n("defaultProvider")}</label>
            <select
              className="bm-select"
              value={draft.display.provider}
              onChange={(event) => mutate((c) => ({ ...c, display: { ...c.display, provider: event.target.value } }))}
            >
              {PROVIDERS.map((id) => (
                <option key={id} value={id}>{PROVIDER_LABELS[id]}</option>
              ))}
            </select>
          </div>
          <div className="bm-field">
            <label>{i18n("balanceField")}</label>
            <select
              className="bm-select"
              value={draft.display.field}
              onChange={(event) =>
                mutate((c) => ({ ...c, display: { ...c.display, field: event.target.value as "total" | "available" } }))
              }
            >
              <option value="total">{i18n("fieldTotal")}</option>
              <option value="available">{i18n("fieldAvailable")}</option>
            </select>
          </div>
        </div>
        {([
          ["showBalance", "setShowBalance"],
          ["showToday", "setShowToday"],
          ["showRemaining", "setShowRemaining"],
          ["showPeak", "setShowPeak"],
          ["showRefresh", "setShowRefresh"],
        ] as const).map(([key, labelKey]) => (
          <div className="bm-toggle" key={key}>
            <span>{i18n(labelKey)}</span>
            <label className="bm-switch">
              <input
                type="checkbox"
                checked={draft.display[key]}
                onChange={(event) => mutate((c) => ({ ...c, display: { ...c.display, [key]: event.target.checked } }))}
              />
              <i />
            </label>
          </div>
        ))}
      </div>

      <div className="bm-group">
        <span className="bm-group-title">{i18n("limitsTitle")}</span>
        <div className="bm-limit-grid">
          {LIMIT_KEYS.map((key) => {
            const limit = draft.limits[key];
            return (
              <div className="bm-limit-card" key={key}>
                <div className="bm-limit-name">
                  {i18n(`limit.${key}`)}
                  <label className="bm-switch">
                    <input type="checkbox" checked={limit.enabled} onChange={(event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], enabled: event.target.checked } } }))} />
                    <i />
                  </label>
                </div>
                <div className="bm-field">
                  <label>{i18n("limitValue")}</label>
                  <input
                    className="bm-input"
                    value={limit.value}
                    disabled={!limit.enabled}
                    onChange={(event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], value: event.target.value } } }))}
                  />
                </div>
                <div className="bm-field">
                  <label>{i18n("limitAction")}</label>
                  <select
                    className="bm-select"
                    value={limit.action}
                    disabled={!limit.enabled}
                    onChange={(event) =>
                      mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], action: event.target.value as "warn" | "block" } } }))
                    }
                  >
                    <option value="warn">{i18n("actionWarn")}</option>
                    <option value="block">{i18n("actionBlock")}</option>
                  </select>
                </div>
                <div className="bm-toggle">
                  <span>{i18n("showInSidebar")}</span>
                  <label className="bm-switch">
                    <input type="checkbox" checked={limit.showInSidebar} disabled={!limit.enabled} onChange={(event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], showInSidebar: event.target.checked } } }))} />
                    <i />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <details className="bm-advanced">
        <summary>{i18n("advanced")}</summary>
        <div className="bm-advanced-body">
          <span className="bm-note">{i18n("advancedHint")}</span>

          <div className="bm-field">
            <label>{i18n("pricingStatus")}</label>
            <div className="bm-pricing-row">
              <span className="bm-pricing-state">{statusLabel(overview)}</span>
              <span className="bm-pricing-ago">{syncAgo(overview)}</span>
            </div>
            <span className="bm-note">{i18n("pricingNote")}</span>
          </div>

          <div className="bm-grid2">
            {PROVIDERS.map((id) => (
              <div className="bm-field" key={id}>
                <label>{PROVIDER_LABELS[id]} Base URL</label>
                <input
                  className="bm-input"
                  value={draft.providers[id]?.baseURL ?? ""}
                  onChange={(event) =>
                    mutate((c) => ({
                      ...c,
                      providers: { ...c.providers, [id]: { baseURL: event.target.value } },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </details>

      <div className="bm-save">
        <span className="bm-save-hint" data-error={saveState === "error" || undefined}>
          {saveState === "saving"
            ? i18n("saving")
            : saveState === "saved"
              ? i18n("saved")
              : saveState === "error"
                ? `${i18n("saveError")}${errorDetail ? ` · ${errorDetail}` : ""}`
                : ""}
        </span>
        {saveState === "error" ? (
          <button type="button" className="bm-dashed" style={{ borderStyle: "solid" }} onClick={() => void save()}>
            {i18n("retry")}
          </button>
        ) : (
          <button type="button" className="bm-pill-button" onClick={() => void save()}>
            {i18n("saveNow")}
          </button>
        )}
      </div>
    </div>
  );
}
