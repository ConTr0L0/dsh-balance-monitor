/**
 * Sidebar entry widget + popover detail panel for dsh-balance-monitor.
 *
 * The widget is a full-row oval "floating pill" above the Settings control
 * in the left sidebar. The popover renders through a portal into document
 * body; an inner error boundary keeps any panel-side failure from retiring
 * the sidebar entry.
 */
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t as i18n } from "./locales";
import { fmtMoney, BarChart, MonthHeatmap } from "./charts";
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

/** Primary figure of one provider per the display field setting. */
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
  const anyLimitExceeded = overview?.limits?.some((row) => row.enabled && row.exceeded) ?? false;
  const anyBlocked = overview?.limits?.some((row) => row.enabled && row.exceeded && row.action === "block") ?? false;
  const showRemaining = display?.showRemaining && dailyLimit?.enabled && !(dailyLimit.value <= 0);

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
      const placeAbove = rect.bottom + 540 > viewportHeight && rect.top > 540;
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
        <span className="bm-pill-badge" aria-hidden>
          ¥
        </span>
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
              {showRemaining ? ` · ${fmtMoney(dailyLimit!.remaining)} / ${fmtMoney(dailyLimit!.value)}` : ""}
            </span>
          )}
        </span>
        {wide && showRemaining && (
          <span
            className="bm-progress"
            data-warn={dailyLimit?.exceeded || undefined}
            data-critical={(dailyLimit?.action === "block" && dailyLimit.exceeded) || undefined}
          >
            <i style={{ width: `${Math.min(100, Math.round(dailyLimit!.progress * 100))}%` }} />
          </span>
        )}
        {display?.showPeak !== false && (
          <span className="bm-peak" data-status={peak} title={peak === "peak" ? i18n("peak") : i18n("offpeak")} />
        )}
        {wide && display?.showRefresh !== false && (
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
  const daily = overview.today ?? { cost: 0, requests: 0 };
  const limits = overview.limits ?? [];
  const enabledLimits = limits.filter((row) => row.enabled);
  const displayOptions = Object.keys(overview.providers);

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

  const shownSessions = showAllSessions ? sessions : sessions.slice(0, 8);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return createPortal(
    <div
      className="bm-popover"
      style={
        anchor.top
          ? { left: anchor.x + 8, bottom: Math.max(8, window.innerHeight - anchor.y + 8) }
          : { left: anchor.x + 8, top: anchor.y + 8 }
      }
      role="dialog"
      aria-label={i18n("name")}
    >
      <div className="bm-pop-header">
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
        <span className="bm-peak-label" data-status={peak}>
          {peak === "peak" ? i18n("peak") : i18n("offpeak")}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="bm-iconbtn" onClick={() => void doRefresh()} disabled={spinning} aria-label={i18n("refresh")} title={i18n("refresh")}>
          <RefreshIcon spinning={spinning} />
        </button>
        <button type="button" className="bm-iconbtn" onClick={onClose} aria-label="close" title="close">
          <CloseIcon />
        </button>
      </div>

      <div className="bm-pop-body">
        <div className="bm-card">
          <span className="bm-card-label">{PROVIDER_LABELS[provider] ?? provider}</span>
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
              <span className="bm-note">
                {i18n("available")} {currency}{fmtMoney(providerAvailable(prov))}
                {typeof (prov as { used?: number })?.used === "number"
                  ? ` · ${i18n("used")} ${currency}${fmtMoney((prov as { used?: number }).used ?? 0)}`
                  : ""}
                {typeof (prov as { limit?: number | null })?.limit === "number"
                  ? ` / ${currency}${fmtMoney((prov as { limit?: number | null }).limit ?? 0)}`
                  : ""}
                {typeof (prov as { granted?: number })?.granted === "number"
                  ? ` · ${i18n("granted")} ${currency}${fmtMoney((prov as { granted?: number }).granted ?? 0)}`
                  : ""}
                {typeof (prov as { toppedUp?: number })?.toppedUp === "number"
                  ? ` · ${i18n("toppedUp")} ${currency}${fmtMoney((prov as { toppedUp?: number }).toppedUp ?? 0)}`
                  : ""}
              </span>
              {(prov as { fetchedAt?: number })?.fetchedAt ? (
                <span className="bm-note">{i18n("updated")} {timeAgo((prov as { fetchedAt: number }).fetchedAt)}</span>
              ) : null}
            </>
          )}
        </div>

        <div className="bm-card">
          <div className="bm-row">
            <span>{i18n("today")}</span>
            <span>{currency}{fmtMoney(daily.cost)} · {daily.requests} {i18n("req")}</span>
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
            {sessions.length > 8 && (
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
