/**
 * Settings card for dsh-balance-monitor (DSH Settings → 余额监控).
 * Auto-saves (debounced); secret fields are write-only through
 * config/setSecret so values never cross the wire.
 */
import { useEffect, useRef, useState } from "react";
import type { ConfigValue, RpcCall, SecretSlot } from "./api";
import type { TranslateNS } from "@deepseek-ai/dsh-client-ui-slots";

type T = TranslateNS<"balance">;

interface LimitDraft {
  enabled: boolean;
  value: string;
  action: "warn" | "block";
  showInSidebar: boolean;
}

interface ModelDraft {
  id: string;
  input: string;
  cacheHit: string;
  output: string;
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
  prices: {
    peakWindows: [string, string][];
    offPeakFactor: string;
    models: ModelDraft[];
  };
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
  const pricesIn = (value.prices ?? {}) as Record<string, unknown>;
  const modelsIn = (pricesIn.models ?? {}) as Record<string, { input?: number; cacheHit?: number; output?: number }>;
  const displayIn = (value.display ?? {}) as Record<string, unknown>;
  const models: ModelDraft[] = Object.entries(modelsIn)
    .filter(([id]) => id !== "__default")
    .map(([id, entry]) => ({
      id,
      input: String(entry.input ?? 0),
      cacheHit: String(entry.cacheHit ?? 0),
      output: String(entry.output ?? 0),
    }));
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
    prices: {
      peakWindows: ((pricesIn.peakWindows as [string, string][]) ?? [["09:00", "12:00"], ["14:00", "18:00"]]),
      offPeakFactor: String(pricesIn.offPeakFactor ?? 0.5),
      models,
    },
  };
}

/** Build the wire patch for config/patch (secrets excluded; removed models
 *  are sent as `null` so the host deletes them from the price table). */
function toPatch(draft: Draft, baselineModels: Set<string>): Record<string, unknown> {
  const models: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const model of draft.prices.models) {
    const id = model.id.trim();
    if (!id) continue;
    seen.add(id);
    models[id] = {
      input: Number(model.input) || 0,
      cacheHit: Number(model.cacheHit) || 0,
      output: Number(model.output) || 0,
    };
  }
  for (const id of baselineModels) {
    if (!seen.has(id)) models[id] = null;
  }
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
    prices: {
      peakWindows: draft.prices.peakWindows,
      offPeakFactor: Number(draft.prices.offPeakFactor) || 0,
      models,
    },
  };
}

export function SettingsCard({ rpc, t }: { rpc: RpcCall; t: T }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [secrets, setSecrets] = useState<SecretSlot[]>([]);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<number | null>(null);
  const baselineModels = useRef<Set<string>>(new Set());

  const load = async () => {
    try {
      const config = await rpc<ConfigValue>("config/get");
      const next = toDraft((config.value ?? {}) as Record<string, unknown>);
      baselineModels.current = new Set(next.prices.models.map((model) => model.id.trim()).filter(Boolean));
      setDraft(next);
      setSecrets(config.secrets ?? []);
      setRevision(config.revision);
      setSaveState("idle");
    } catch (error) {
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
      await rpc("config/patch", { patch: toPatch(draft, baselineModels.current), revision });
      await load();
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
    }
  };

  const saveSecret = async (provider: string, value: string) => {
    setSaveState("saving");
    try {
      await rpc("config/setSecret", { path: ["providers", provider, "apiKey"], value, revision });
      await load();
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
    }
  };

  const secretSet = (provider: string) => {
    const slot = secrets.find((entry) => entry.path.join(".") === `providers.${provider}.apiKey`);
    return Boolean(slot?.set);
  };

  if (!draft) {
    return <div className="bm-empty">{t("loading")}</div>;
  }

  return (
    <div className="bm-settings">
      <div className="bm-group">
        <div className="bm-toggle">
          <span>{t("enable")}</span>
          <label className="bm-switch">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => mutate((c) => ({ ...c, enabled: event.target.checked }))} />
            <i />
          </label>
        </div>
        <div className="bm-grid2">
          <div className="bm-field">
            <label>{t("refreshInterval")}</label>
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

      <div className="bm-group">
        <span className="bm-group-title">{t("providerKeys")}</span>
        {PROVIDERS.map((id) => (
          <div className="bm-grid2" key={id}>
            <div className="bm-field">
              <label>{PROVIDER_LABELS[id]} · {t("apiKey")}</label>
              <div className="bm-secret">
                <input
                  className="bm-input"
                  type="password"
                  autoComplete="off"
                  placeholder={secretSet(id) ? t("keySet") : t("keyUnset")}
                  value=""
                  onFocus={(event) => (event.target.value = "")}
                  onChange={(event) => {
                    if (event.target.value) void saveSecret(id, event.target.value);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="bm-field">
              <label>Base URL</label>
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
          </div>
        ))}
        <span className="bm-note">{t("deepseekAutoKey")}</span>
      </div>

      <div className="bm-group">
        <span className="bm-group-title">{t("displayTitle")}</span>
        <div className="bm-grid2">
          <div className="bm-field">
            <label>{t("defaultProvider")}</label>
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
            <label>{t("balanceField")}</label>
            <select
              className="bm-select"
              value={draft.display.field}
              onChange={(event) =>
                mutate((c) => ({ ...c, display: { ...c.display, field: event.target.value as "total" | "available" } }))
              }
            >
              <option value="total">{t("fieldTotal")}</option>
              <option value="available">{t("fieldAvailable")}</option>
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
            <span>{t(labelKey as never)}</span>
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
        <span className="bm-group-title">{t("pricesTitle")}</span>
        <div className="bm-grid2">
          <div className="bm-field">
            <label>{t("peakWindows")} (UTC+8)</label>
            {draft.prices.peakWindows.map((window, index) => (
              <div className="bm-secret" key={index} style={{ marginBottom: 6 }}>
                <input
                  className="bm-input"
                  value={window[0]}
                  onChange={(event) =>
                    mutate((c) => {
                      const next = c.prices.peakWindows.map((entry) => [...entry] as [string, string]);
                      next[index][0] = event.target.value;
                      return { ...c, prices: { ...c.prices, peakWindows: next } };
                    })
                  }
                />
                <input
                  className="bm-input"
                  value={window[1]}
                  onChange={(event) =>
                    mutate((c) => {
                      const next = c.prices.peakWindows.map((entry) => [...entry] as [string, string]);
                      next[index][1] = event.target.value;
                      return { ...c, prices: { ...c.prices, peakWindows: next } };
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="bm-dashed"
              onClick={() =>
                mutate((c) => ({
                  ...c,
                  prices: { ...c.prices, peakWindows: [...c.prices.peakWindows, ["09:00", "12:00"]] },
                }))
              }
            >
              +
            </button>
          </div>
          <div className="bm-field">
            <label>{t("offPeakFactor")}</label>
            <input
              className="bm-input"
              value={draft.prices.offPeakFactor}
              onChange={(event) => mutate((c) => ({ ...c, prices: { ...c.prices, offPeakFactor: event.target.value } }))}
            />
          </div>
        </div>
        <div className="bm-group">
          {draft.prices.models.map((model, index) => (
            <div className="bm-grid2" key={`${model.id}-${index}`}>
              <div className="bm-field">
                <label>Model</label>
                <input
                  className="bm-input"
                  value={model.id}
                  onChange={(event) =>
                    mutate((c) => {
                      const next = c.prices.models.map((entry) => ({ ...entry }));
                      next[index].id = event.target.value;
                      return { ...c, prices: { ...c.prices, models: next } };
                    })
                  }
                />
              </div>
              <div className="bm-grid2">
                <div className="bm-field">
                  <label>input ¥/M</label>
                  <input className="bm-input" value={model.input} onChange={(event) => mutate((c) => { const next = c.prices.models.map((entry) => ({ ...entry })); next[index].input = event.target.value; return { ...c, prices: { ...c.prices, models: next } }; })} />
                </div>
                <div className="bm-field">
                  <label>cache ¥/M</label>
                  <input className="bm-input" value={model.cacheHit} onChange={(event) => mutate((c) => { const next = c.prices.models.map((entry) => ({ ...entry })); next[index].cacheHit = event.target.value; return { ...c, prices: { ...c.prices, models: next } }; })} />
                </div>
                <div className="bm-field">
                  <label>output ¥/M</label>
                  <input className="bm-input" value={model.output} onChange={(event) => mutate((c) => { const next = c.prices.models.map((entry) => ({ ...entry })); next[index].output = event.target.value; return { ...c, prices: { ...c.prices, models: next } }; })} />
                </div>
                <div className="bm-field" style={{ justifyContent: "flex-end", display: "flex" }}>
                  <button
                    type="button"
                    className="bm-dashed"
                    style={{ width: "100%" }}
                    onClick={() =>
                      mutate((c) => ({
                        ...c,
                        prices: { ...c.prices, models: c.prices.models.filter((_, i) => i !== index) },
                      }))
                    }
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="bm-dashed"
            onClick={() =>
              mutate((c) => ({
                ...c,
                prices: { ...c.prices, models: [...c.prices.models, { id: "", input: "3.0", cacheHit: "0.1", output: "9.0" }] },
              }))
            }
          >
            + {t("addModel")}
          </button>
        </div>
      </div>

      <div className="bm-group">
        <span className="bm-group-title">{t("limitsTitle")}</span>
        <div className="bm-limit-grid">
          {LIMIT_KEYS.map((key) => {
            const limit = draft.limits[key];
            return (
              <div className="bm-limit-card" key={key}>
                <div className="bm-limit-name">
                  {t(`limit.${key}` as never)}
                  <label className="bm-switch">
                    <input type="checkbox" checked={limit.enabled} onChange={(event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], enabled: event.target.checked } } }))} />
                    <i />
                  </label>
                </div>
                <div className="bm-field">
                  <label>{t("limitValue")}</label>
                  <input
                    className="bm-input"
                    value={limit.value}
                    disabled={!limit.enabled}
                    onChange={(event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], value: event.target.value } } }))}
                  />
                </div>
                <div className="bm-field">
                  <label>{t("limitAction")}</label>
                  <select
                    className="bm-select"
                    value={limit.action}
                    disabled={!limit.enabled}
                    onChange={(event) =>
                      mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], action: event.target.value as "warn" | "block" } } }))
                    }
                  >
                    <option value="warn">{t("actionWarn")}</option>
                    <option value="block">{t("actionBlock")}</option>
                  </select>
                </div>
                <div className="bm-toggle">
                  <span>{t("showInSidebar")}</span>
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

      <div className="bm-save">
        <span className="bm-save-hint">
          {saveState === "saving" ? t("saving") : saveState === "saved" ? t("saved") : saveState === "error" ? t("saveError") : ""}
        </span>
        {saveState === "error" ? (
          <button type="button" className="bm-dashed" style={{ borderStyle: "solid" }} onClick={() => void save()}>
            {t("retry")}
          </button>
        ) : (
          <button type="button" className="bm-dashed" style={{ borderStyle: "solid" }} onClick={() => void save()}>
            {t("saveNow")}
          </button>
        )}
      </div>
    </div>
  );
}
