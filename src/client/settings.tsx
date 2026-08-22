/**
 * Settings card for dsh-balance-monitor (DSH Settings → 余额监控).
 *
 * Auto-saves (debounced); secret fields are write-only through
 * config/setSecret so values never cross the wire. Billing rules are NOT
 * exposed — they are verified automatically from the official docs and only
 * reported as a sync status; provider keys are one merged column; rare
 * settings (base URLs) live in a collapsible "Advanced" group.
 */
import { useEffect, useRef, useState } from "react";
import type { ConfigValue, Overview, RpcCall, SecretSlot } from "./api";
import { t as i18n } from "./locales";

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
  const saveTimer = useRef<number | null>(null);

  const load = async () => {
    try {
      const config = await rpc<ConfigValue>("config/get");
      setDraft(toDraft((config.value ?? {}) as Record<string, unknown>));
      setSecrets(config.secrets ?? []);
      setRevision(config.revision);
      setSaveState("idle");
      const overviewData = await rpc<Overview>("overview");
      setOverview(overviewData);
    } catch {
      setSaveState("error");
    }
  };

  useEffect(() => {
    void load();
    return () => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
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
      await load();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const saveSecret = async (provider: string, value: string) => {
    setSaveState("saving");
    try {
      await rpc("config/setSecret", { path: ["providers", provider, "apiKey"], value, revision });
      await load();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const secretSet = (provider: string) => {
    const slot = secrets.find((entry) => entry.path.join(".") === `providers.${provider}.apiKey`);
    return Boolean(slot?.set);
  };

  if (!draft) {
    return <div className="bm-empty">{i18n("loading")}</div>;
  }

  return (
    <div className="bm-settings">
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
                  if (event.target.value) void saveSecret(id, event.target.value);
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
        <span className="bm-save-hint">
          {saveState === "saving" ? i18n("saving") : saveState === "saved" ? i18n("saved") : saveState === "error" ? i18n("saveError") : ""}
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
