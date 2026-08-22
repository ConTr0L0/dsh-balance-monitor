/**
 * Sidebar entry widget + glass popover detail panel for dsh-balance-monitor.
 *
 * The widget is a full-row oval "floating plate" above the Settings control;
 * the popover is a transparent frosted-glass panel (TokenEye style) with a
 * settings gear that deep-links into the DSH settings page. An inner error
 * boundary keeps any panel-side failure from retiring the sidebar entry.
 */
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t as i18n } from "./locales";
import { fmtMoney, fmtTokens, modelTokens, modelColor, BarChart, MonthHeatmap } from "./charts";
import { getSnapshot, manualRefresh, refreshAll, subscribe } from "./store";
import type { ProviderId, RpcCall } from "./api";

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  zhipu: "Zhipu GLM",
  openrouter: "OpenRouter",
  tavily: "Tavily",
};

function currencySymbol(currency?: string) {
  return currency === "USD" ? "$" : "¥";
}

function providerPrimary(provider: Record<string, unknown> | undefined, field: string): number | null {
  if (!provider) return null;
  const value = field === "available" ? (provider.available as number) : (provider.total as number);
  return typeof value === "number" ? value : null;
}

function providerAvailable(provider: Record<string, unknown> | undefined): number | null {
  if (!provider) return null;
  const value = provider.available;
  return typeof value === "number" ? value : null;
}

function timeAgo(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Deep-link into the DSH settings dialog and select the plugin section. */
function openSettingsSection() {
  const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'));
  const trigger = triggers.find((button) => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left < 340;
  });
  if (!trigger) return;
  trigger.click();
  window.setTimeout(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const rows = Array.from(dialog.querySelectorAll("nav button"));
    const row = rows.find((button) => (button.textContent ?? "").trim() === i18n("settingsNav"));
    (row as HTMLButtonElement | undefined)?.click();
  }, 600);
}

/** Inner error boundary: renders a fallback instead of abdicating the entry. */
class SafeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg className={spinning ? "bm-spin" : undefined} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.7 1.8v3.4h-3.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.6l.9 1.6 1.8.2 1.3-1.1 1.3 1.3-1.1 1.3.2 1.8 1.6.9-1.6.9-.2 1.8 1.1 1.3-1.3 1.3-1.3-1.1-1.8.2-.9 1.6-.9-1.6-1.8-.2-1.3 1.1L2.7 9.8l1.1-1.3-.2-1.8L2 5.8l1.6-.9.2-1.8L2.7 1.8 4 .5l1.3 1.1 1.8-.2z" />
    </svg>
  );
}

export function SidebarWidget({ wide, rpc }: { wide: boolean; rpc: RpcCall }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const { overview, error } = snapshot;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; top: boolean } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);

  const display = overview?.display;
  const providerId = (display?.provider ?? "deepseek") as ProviderId;
  const provider = overview?.providers?.[providerId];
  const primary = providerPrimary(provider, display?.field ?? "total");
  const currency = currencySymbol(provider?.currency);
  const peak = overview?.peak?.status ?? "off-peak";
  const todayCost = overview?.today.cost ?? 0;
  const dailyLimit = overview?.limits?.find((row) => row.key === "daily");
  const totalLimit = overview?.limits?.find((row) => row.key === "total");
  const anyLimitExceeded = overview?.limits?.some((row) => row.enabled && row.exceeded) ?? false;
  const anyBlocked = overview?.limits?.some((row) => row.enabled && row.exceeded && row.action === "block") ?? false;
  const showRemaining = display?.showRemaining && (dailyLimit?.enabled || totalLimit?.enabled);
  const limitRow = dailyLimit?.enabled ? dailyLimit : totalLimit;

  useEffect(() => {
    if (!rpc) return;
    void refreshAll(rpc);
    const timer = setInterval(() => void refreshAll(rpc), (overview?.refreshInterval ?? 60) * 1000);
    return () => clearInterval(timer);
  }, [rpc, overview?.refreshInterval]);

  const openPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const viewportHeight = window.innerHeight;
      const placeAbove = rect.bottom + 620 > viewportHeight && rect.top > 620;
      setAnchor({ x: rect.right, y: placeAbove ? rect.top : rect.bottom, top: placeAbove });
    }
    setOpen((previous) => !previous);
    if (!open) void refreshAll(rpc, true);
  };

  const doRefresh = async () => {
    setSpinning(true);
    try {
      await manualRefresh(rpc);
    } finally {
      setSpinning(false);
    }
  };

  const balanceLabel =
    provider?.ok === false && provider?.error === "no-api-key"
      ? i18n("noKey")
      : `${currency}${fmtMoney(primary)}`;

  return (
    <SafeBoundary fallback={<span className="bm-empty">—</span>}>
      <div
        ref={buttonRef}
        className={`bm-widget${wide ? "" : " bm-widget-rail"}`}
        data-active={open || undefined}
        style={{ borderRadius: 999 }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPanel}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPanel();
          }
        }}
        title={i18n("name")}
      >
        {display?.showPeak !== false && (
          <span className="bm-trend" data-status={peak} data-tip={peak === "peak" ? i18n("peak") : i18n("offpeak")}>
            <i />{peak === "peak" ? i18n("peakShort") : i18n("offpeakShort")}
          </span>
        )}
        <span className="bm-pill-badge" aria-hidden>¥</span>
        <span className="bm-pill-main">
          {display?.showBalance !== false && (
            <span
              className="bm-primary"
              data-warn={anyLimitExceeded || undefined}
              data-critical={anyBlocked || undefined}
            >
              {balanceLabel}
            </span>
          )}
          {wide && display?.showToday !== false && (
            <span className="bm-secondary">
              {i18n("today")} {currency}{fmtMoney(todayCost)}
              {showRemaining && limitRow ? ` · ${fmtMoney(limitRow.remaining)} / ${fmtMoney(limitRow.value)}` : ""}
            </span>
          )}
        </span>
        {display?.showRefresh !== false && (
          <button
            type="button"
            className="bm-iconbtn"
            disabled={spinning}
            aria-label={i18n("refresh")}
            title={i18n("refresh")}
            onClick={(event) => {
              event.stopPropagation();
              void doRefresh();
            }}
          >
            <RefreshIcon spinning={spinning} />
          </button>
        )}
        {showRemaining && limitRow && (
          <span className="bm-strip" data-warn={limitRow.exceeded || undefined} data-critical={(limitRow.action === "block" && limitRow.exceeded) || undefined}>
            <i style={{ width: `${Math.min(100, Math.round(limitRow.progress * 100))}%` }} />
          </span>
        )}
      </div>
      {open && anchor && overview && (
        <SafeBoundary fallback={null}>
          <Popover
            anchor={anchor}
            onClose={() => setOpen(false)}
            rpc={rpc}
            providerId={providerId}
          />
        </SafeBoundary>
      )}
      {open && !overview && error && <div className="bm-empty">{error}</div>}
    </SafeBoundary>
  );
}

function Popover({
  anchor,
  onClose,
  rpc,
  providerId,
}: {
  anchor: { x: number; y: number; top: boolean };
  onClose: () => void;
  rpc: RpcCall;
  providerId: string;
}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const { overview, history, sessions } = snapshot;
  const [provider, setProvider] = useState<string>(providerId);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [spinning, setSpinning] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!overview) return null;

  const prov = overview.providers[provider] as Record<string, unknown> | undefined;
  const field = overview.display?.field ?? "total";
  const primary = providerPrimary(prov, field);
  const currency = currencySymbol(prov?.currency as string | undefined);
  const peak = overview.peak?.status ?? "off-peak";
  const today = overview.today ?? { cost: 0, requests: 0, models: {} };
  const limits = overview.limits ?? [];
  const enabledLimits = limits.filter((row) => row.enabled);
  const displayOptions = Object.keys(overview.providers);
  const totalTokens = Object.values(overview.models ?? {}).reduce((sum, stat) => sum + modelTokens(stat), 0);
  const topModels = Object.entries(overview.models ?? {})
    .map(([id, stat]) => ({ id, tokens: modelTokens(stat) }))
    .filter((row) => row.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 3);
  const providerTotal = providerPrimary(prov, "total");
  const quotaProgress = providerTotal && providerTotal > 0 ? Math.min(1, overview.totals.cost / providerTotal) : 0;
  const todayModels = Object.entries(today.models ?? {})
    .map(([id, stat]) => ({ id, stat }))
    .filter((row) => row.stat.cost > 0 || modelTokens(row.stat) > 0)
    .sort((a, b) => modelTokens(b.stat) - modelTokens(a.stat));

  const doRefresh = async () => {
    setSpinning(true);
    try {
      await manualRefresh(rpc);
    } finally {
      setSpinning(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const shownSessions = showAllSessions ? sessions : sessions.slice(0, 6);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return createPortal(
    <div
      className="bm-popover"
      style={
        anchor.top
          ? { left: anchor.x + 10, bottom: Math.max(8, window.innerHeight - anchor.y + 10) }
          : { left: anchor.x + 10, top: anchor.y + 10 }
      }
      role="dialog"
      aria-label={i18n("name")}
    >
      <div className="bm-pop-header">
        <span className="bm-provider-chip">
          <select
            className="bm-pop-select"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              void refreshAll(rpc);
            }}
          >
            {displayOptions.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_LABELS[id] ?? id}
              </option>
            ))}
          </select>
          <span className="bm-title-dot" />
          <span className="bm-title-status">{i18n("running")}</span>
        </span>
        <span className="bm-trend" data-status={peak} data-tip={peak === "peak" ? i18n("peak") : i18n("offpeak")}>
          <i />{peak === "peak" ? i18n("peakFull") : i18n("offpeakFull")}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="bm-iconbtn" onClick={() => void doRefresh()} disabled={spinning} aria-label={i18n("refresh")} title={i18n("refresh")}>
          <RefreshIcon spinning={spinning} />
        </button>
        <button type="button" className="bm-iconbtn" onClick={openSettingsSection} aria-label={i18n("openSettings")} title={i18n("openSettings")}>
          <GearIcon />
        </button>
        <button type="button" className="bm-iconbtn" onClick={onClose} aria-label="close" title="close">
          <CloseIcon />
        </button>
      </div>

      <div className="bm-pop-body">
        <div className="bm-card">
          <div className="bm-card-head">
            <span className="bm-card-label">{PROVIDER_LABELS[provider] ?? provider}</span>
            {(prov as { fetchedAt?: number })?.fetchedAt ? (
              <span className="bm-card-meta">{i18n("updated")} {timeAgo((prov as { fetchedAt: number }).fetchedAt)}</span>
            ) : null}
          </div>
          {prov?.ok === false ? (
            <>
              <span className="bm-big" data-warn>—</span>
              <span className="bm-note">
                {(prov as { error?: string }).error === "no-api-key" ? i18n("noKey") : (prov as { error?: string }).error}
              </span>
            </>
          ) : (
            <>
              <span className="bm-big">{currency}{fmtMoney(primary)}</span>
              <div className="bm-quota-grid">
                <div><span>{i18n("quotaTotal")}</span><strong>{currency}{fmtMoney(providerTotal)}</strong></div>
                <div><span>{i18n("quotaSpent")}</span><strong>{currency}{fmtMoney(overview.totals.cost)}</strong></div>
              </div>
              <div className="bm-quota-track">
                <i style={{ width: `${Math.round(quotaProgress * 100)}%` }} />
              </div>
              <span className="bm-note">
                {i18n("quotaUsed")} {Math.round(quotaProgress * 100)}%
                {typeof (prov as { granted?: number })?.granted === "number" ? ` · ${i18n("granted")} ${currency}${fmtMoney((prov as { granted?: number }).granted ?? 0)} · ${i18n("toppedUp")} ${currency}${fmtMoney((prov as { toppedUp?: number }).toppedUp ?? 0)}` : ""}
              </span>
            </>
          )}
        </div>

        <div className="bm-card">
          <span className="bm-card-label">{i18n("tokensTotal")}</span>
          <span className="bm-big bm-big-mid">{fmtTokens(totalTokens)}</span>
          <span className="bm-model-chips">
            {topModels.map((row) => (
              <span className="bm-model-chip" key={row.id}>
                <i style={{ background: modelColor(row.id) }} />
                {row.id} {fmtTokens(row.tokens)}
              </span>
            ))}
          </span>
        </div>

        {todayModels.length > 0 && (
          <div className="bm-models">
            {todayModels.map(({ id, stat }) => {
              const tokens = modelTokens(stat);
              const share = overview.totals.cost > 0 ? Math.min(1, stat.cost / overview.totals.cost) : 0;
              const cacheRate = tokens > 0 ? (stat.cacheRead ?? 0) / tokens : 0;
              return (
                <div className="bm-card" key={id}>
                  <div className="bm-card-head">
                    <span className="bm-model-name"><i style={{ background: modelColor(id) }} />{id}</span>
                    <span className="bm-model-tag">{i18n("today")}</span>
                  </div>
                  <div className="bm-quota-grid">
                    <div><span>Token {i18n("consumption")}</span><strong>{fmtTokens(tokens)}</strong></div>
                    <div><span>{i18n("consumption")}</span><strong>{currency}{fmtMoney(stat.cost)}</strong></div>
                  </div>
                  <div className="bm-quota-track"><i style={{ width: `${Math.round(share * 100)}%` }} /></div>
                  <div className="bm-card-meta-row">
                    <span>{i18n("quotaShare")} {Math.round(share * 100)}%</span>
                    <span>{i18n("cacheHitRate")} {Math.round(cacheRate * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bm-card">
          <div className="bm-row">
            <span>{i18n("today")}</span>
            <span>{currency}{fmtMoney(today.cost)} · {today.requests} {i18n("req")}</span>
          </div>
          <div className="bm-row">
            <span>{i18n("totalCost")}</span>
            <span>{currency}{fmtMoney(overview.totals.cost)} · {overview.totals.requests} {i18n("req")}</span>
          </div>
          {enabledLimits.map((row) => (
            <div key={row.key} className="bm-row">
              <span>{i18n(row.labelKey) ?? row.key}</span>
              <span data-warn={row.exceeded || undefined}>
                {fmtMoney(row.current)} / {row.key === "requests" ? `${row.value} ${i18n("req")}` : `${currency}${fmtMoney(row.value)}`}
              </span>
              <div
                className="bm-progress-lg"
                data-warn={row.exceeded || undefined}
                data-critical={(row.action === "block" && row.exceeded) || undefined}
                style={{ flex: "none", width: 72 }}
              >
                <i style={{ width: `${Math.round(row.progress * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="bm-card">
          <span className="bm-cal-title">{i18n("history7")}</span>
          <BarChart daily={history?.daily ?? {}} days={7} />
        </div>

        <div className="bm-card">
          <div className="bm-months">
            <button type="button" className="bm-iconbtn" onClick={() => shiftMonth(-1)} aria-label="previous">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
            </button>
            <span>{year} / {String(month + 1).padStart(2, "0")}</span>
            <button type="button" className="bm-iconbtn" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="next">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5l4.5 4.5L6 12.5" /></svg>
            </button>
          </div>
          <MonthHeatmap daily={history?.daily ?? {}} year={year} month={month} />
          <span className="bm-note">{i18n("heatNote")}</span>
        </div>

        <div className="bm-card">
          <div className="bm-row">
            <span className="bm-cal-title">{i18n("sessions")} ({sessions.length})</span>
            {sessions.length > 6 && (
              <button
                type="button"
                className="bm-iconbtn"
                onClick={() => setShowAllSessions((value) => !value)}
                title={showAllSessions ? i18n("collapse") : i18n("showAll")}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {showAllSessions ? <path d="M4 10l4-4 4 4" /> : <path d="M4 6l4 4 4-4" />}
                </svg>
              </button>
            )}
          </div>
          {shownSessions.length === 0 ? (
            <span className="bm-empty">{i18n("noSessions")}</span>
          ) : (
            <div className="bm-list">
              {shownSessions.map((session) => (
                <div className="bm-list-row" key={session.id} title={session.id}>
                  <div className="bm-list-row-main">
                    <span className="bm-list-title">{session.title || session.id.slice(0, 8)}</span>
                    <span className="bm-list-sub">
                      {session.lastEvent ? new Date(session.lastEvent).toLocaleString() : ""} · {session.requests} {i18n("req")}
                    </span>
                  </div>
                  <span className="bm-list-cost">{currency}{fmtMoney(session.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <span className="bm-note">{i18n("settingsHint")}</span>
      </div>
    </div>,
    document.body,
  );
}
