/**
 * Sidebar entry widget + floating glass window for dsh-balance-monitor.
 *
 * The widget is a full-row oval "floating plate" above the Settings control.
 * The window is draggable (header) and resizable (corner handle) with a hard
 * minimum size and size-adaptive layout. It only closes via the ✕ button —
 * data refreshes, re-renders, or per-card errors never dismiss it (each card
 * is isolated by its own error boundary).
 */
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t as i18n } from "./locales";
import { fmtMoney, fmtTokens, modelTokens, modelColor, BarChart, MonthHeatmap } from "./charts";
import { getSnapshot, manualRefresh, refreshAll, subscribe } from "./store";
import type { ProviderId, RpcCall, SessionRow } from "./api";

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  zhipu: "Zhipu GLM",
  openrouter: "OpenRouter",
  tavily: "Tavily",
};

const WIN_KEY = "dsh-balance-monitor.window";
const MIN_W = 320;
const MIN_H = 420;

function currencySymbol(currency?: string) {
  return currency === "USD" ? "$" : "¥";
}

function providerPrimary(provider: Record<string, unknown> | undefined, field: string): number | null {
  if (!provider) return null;
  const value = field === "available" ? (provider.available as number) : (provider.total as number);
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

/** Inner error boundary: a failed card renders a fallback, never unmounts the window. */
class SafeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Card({ children }: { children: ReactNode }) {
  return (
    <SafeBoundary fallback={<div className="bm-empty">—</div>}>
      <div className="bm-card">{children}</div>
    </SafeBoundary>
  );
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

function loadWindowPrefs() {
  try {
    const raw = localStorage.getItem(WIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number" && typeof parsed?.w === "number" && typeof parsed?.h === "number") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function SidebarWidget({ wide, rpc }: { wide: boolean; rpc: RpcCall }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const { overview, error } = snapshot;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; top: boolean } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);
  const openedAt = useRef(0);

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
    const now = Date.now();
    // Rapid double-click guard: a second toggle within 350ms keeps the window open.
    if (open && now - openedAt.current < 350) return;
    openedAt.current = now;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const viewportHeight = window.innerHeight;
      const placeAbove = rect.bottom + 480 > viewportHeight && rect.top > 480;
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
        {!wide && <span className="bm-pill-badge" aria-hidden>¥</span>}
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
        {showRemaining && limitRow && (
          <span className="bm-strip" data-warn={limitRow.exceeded || undefined} data-critical={(limitRow.action === "block" && limitRow.exceeded) || undefined}>
            <i style={{ width: `${Math.min(100, Math.round(limitRow.progress * 100))}%` }} />
          </span>
        )}
      </div>
      {open && anchor && overview && (
        <FloatWindow anchor={anchor} onClose={() => setOpen(false)} rpc={rpc} providerId={providerId} />
      )}
      {open && !overview && error && <div className="bm-empty">{error}</div>}
    </SafeBoundary>
  );
}

function FloatWindow({
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadWindowPrefs();
    if (saved) return { x: saved.x, y: saved.y };
    const viewportHeight = window.innerHeight;
    return anchor.top
      ? { x: anchor.x + 10, y: Math.max(12, anchor.y - 420) }
      : { x: anchor.x + 10, y: Math.min(viewportHeight - 460, anchor.y + 10) };
  });
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    const saved = loadWindowPrefs();
    return {
      w: saved?.w ?? 380,
      h: saved?.h ?? Math.min(640, Math.max(480, window.innerHeight - 120)),
    };
  });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragState = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(WIN_KEY, JSON.stringify({ x: pos.x, y: pos.y, w: size.w, h: size.h }));
    } catch {
      /* ignore */
    }
  }, [pos, size]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    dragState.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y };
    setDragging(true);
    event.preventDefault();
  };
  const startResize = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    // Anchor on the CURRENT size: new size = start size + pointer delta.
    dragState.current = { dx: event.clientX, dy: event.clientY, w0: size.w, h0: size.h };
    setResizing(true);
    event.preventDefault();
  };
  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (event: PointerEvent) => {
      if (!dragState.current) return;
      if (dragging) {
        setPos({
          x: Math.min(Math.max(8, event.clientX - dragState.current.dx), window.innerWidth - 120),
          y: Math.min(Math.max(8, event.clientY - dragState.current.dy), window.innerHeight - 80),
        });
      } else {
        const w = Math.max(MIN_W, Math.min(window.innerWidth - 20, dragState.current.w0 + (event.clientX - dragState.current.dx)));
        const h = Math.max(MIN_H, Math.min(window.innerHeight - 20, dragState.current.h0 + (event.clientY - dragState.current.dy)));
        setSize({ w, h });
      }
    };
    const onUp = () => {
      setDragging(false);
      setResizing(false);
      dragState.current = null;
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [dragging, resizing]);

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

  const byId = new Map(sessions.map((session) => [session.id, session]));
  const childrenOf = (id: string) =>
    sessions
      .filter((session) => session.parentSession === id)
      .sort((a, b) => (b.lastEvent ?? 0) - (a.lastEvent ?? 0));
  const toggleExpand = (key: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /**
   * "Same session" grouping: DSH auto-titles each session from its first
   * message, so repeated runs of one topic share one title. Root sessions
   * are grouped BY TITLE (sum shown on the group row; expand to see each
   * session's spend); sessions carrying a parentSession stay nested under
   * their lineage instead.
   */
  const UNTITLED = i18n("untitled");
  const groupMap = new Map<string, SessionRow[]>();
  for (const session of sessions) {
    if (session.parentSession && byId.has(session.parentSession)) continue;
    const key = session.title || UNTITLED;
    const list = groupMap.get(key) ?? [];
    list.push(session);
    groupMap.set(key, list);
  }
  const titleGroups = [...groupMap.entries()]
    .map(([title, list]) => {
      const sorted = [...list].sort((a, b) => (b.lastEvent ?? 0) - (a.lastEvent ?? 0));
      const cost = sorted.reduce((sum, s) => sum + s.cost, 0);
      const requests = sorted.reduce((sum, s) => sum + s.requests, 0);
      return { key: `title:${title}`, title, list: sorted, cost, requests, lastEvent: sorted[0]?.lastEvent ?? 0 };
    })
    .sort((a, b) => b.lastEvent - a.lastEvent);
  const visibleGroups = showAllSessions ? titleGroups : titleGroups.slice(0, 6);
  const totalGroups = titleGroups.length;
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const renderSessionDetail = (session: SessionRow) => (
    <div className="bm-session-detail">
      <div className="bm-session-detail-row">
        <span>{session.id.slice(0, 8)}</span>
        <span>{currency}{fmtMoney(session.cost)}</span>
      </div>
      <div className="bm-session-detail-row">
        <span>{i18n("reqLabel")} {session.requests} {i18n("req")}</span>
        <span>{fmtTokens(session.tokens.uncached + session.tokens.cacheRead + session.tokens.output)} tokens</span>
      </div>
      <div className="bm-session-chips">
        {Object.entries(session.models).map(([id, count]) => (
          <span key={id}><i style={{ background: modelColor(id) }} />{id} ×{count}</span>
        ))}
      </div>
    </div>
  );

  /** One session row; expands to its detail + lineage children. */
  const renderSessionRow = (session: SessionRow) => {
    const children = childrenOf(session.id);
    const isOpen = expanded.has(session.id);
    return (
      <div className="bm-session-group" key={session.id}>
        <div
          className="bm-list-row"
          role="button"
          tabIndex={0}
          onClick={() => toggleExpand(session.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter") toggleExpand(session.id);
          }}
        >
          {children.length > 0 ? (
            <svg className="bm-session-chevron" data-open={isOpen || undefined} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3.5l4.5 4.5L6 12.5" />
            </svg>
          ) : (
            <span className="bm-session-chevron bm-session-leaf" />
          )}
          <div className="bm-list-row-main">
            <span className="bm-list-sub">
              {session.lastEvent ? new Date(session.lastEvent).toLocaleString() : ""} · {i18n("reqLabel")} {session.requests} {i18n("req")}
            </span>
          </div>
          <span className="bm-list-cost">{currency}{fmtMoney(session.cost)}</span>
        </div>
        {isOpen && (
          <div className="bm-session-children">
            {renderSessionDetail(session)}
            {children.map((child) => renderSessionRow(child))}
          </div>
        )}
      </div>
    );
  };

  /** One title group row; expands to every session in the group. */
  const renderTitleGroup = (group: { key: string; title: string; list: SessionRow[]; cost: number; requests: number }) => {
    const isOpen = expanded.has(group.key);
    const multiple = group.list.length > 1;
    return (
      <div className="bm-session-group" key={group.key}>
        <div
          className="bm-list-row"
          role="button"
          tabIndex={0}
          onClick={() => (multiple ? toggleExpand(group.key) : void renderSessionRow(group.list[0]))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && multiple) toggleExpand(group.key);
          }}
        >
          {multiple ? (
            <svg className="bm-session-chevron" data-open={isOpen || undefined} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3.5l4.5 4.5L6 12.5" />
            </svg>
          ) : (
            <span className="bm-session-chevron bm-session-leaf" />
          )}
          <div className="bm-list-row-main">
            <span className="bm-list-title">{group.title}</span>
            <span className="bm-list-sub">
              {i18n("reqLabel")} {group.requests} {i18n("req")}
              {multiple ? ` · ${group.list.length} ${i18n("sessionCount")}` : ""}
            </span>
          </div>
          <span className="bm-list-cost">{currency}{fmtMoney(group.cost)}</span>
        </div>
        {isOpen && (
          <div className="bm-session-children">
            {group.list.map((session) => renderSessionRow(session))}
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      className="bm-popover"
      data-size={size.w < 350 ? "narrow" : size.w < 460 ? "mid" : "wide"}
      data-dragging={dragging || undefined}
      data-resizing={resizing || undefined}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      role="dialog"
      aria-label={i18n("name")}
    >
      <div className="bm-pop-header" onPointerDown={startDrag} title={i18n("dragHint")}>
        <span className="bm-provider-chip">
          <select
            className="bm-pop-select"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              void refreshAll(rpc);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {displayOptions.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_LABELS[id] ?? id}
              </option>
            ))}
          </select>
        </span>
        <span className="bm-trend" data-status={peak} data-tip={peak === "peak" ? i18n("peak") : i18n("offpeak")}>
          <i />{peak === "peak" ? i18n("peakFull") : i18n("offpeakFull")}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="bm-iconbtn" onClick={() => void doRefresh()} disabled={spinning} aria-label={i18n("refresh")} title={i18n("refresh")} onPointerDown={(event) => event.stopPropagation()}>
          <RefreshIcon spinning={spinning} />
        </button>
        <button type="button" className="bm-iconbtn" onClick={openSettingsSection} aria-label={i18n("openSettings")} title={i18n("openSettings")} onPointerDown={(event) => event.stopPropagation()}>
          <GearIcon />
        </button>
        <button type="button" className="bm-iconbtn" onClick={onClose} aria-label="close" title="close" onPointerDown={(event) => event.stopPropagation()}>
          <CloseIcon />
        </button>
      </div>

      <div className="bm-pop-body">
        <Card>
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
              <div className="bm-row">
                <span>{i18n("totalCost")}</span>
                <span>{currency}{fmtMoney(overview.totals.cost)} · {i18n("reqLabel")} {overview.totals.requests} {i18n("req")}</span>
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
        </Card>

        <Card>
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
        </Card>

        {todayModels.length > 0 && (
          <div className="bm-models">
            {todayModels.map(({ id, stat }) => {
              const tokens = modelTokens(stat);
              const share = overview.totals.cost > 0 ? Math.min(1, stat.cost / overview.totals.cost) : 0;
              const cacheRate = tokens > 0 ? (stat.cacheRead ?? 0) / tokens : 0;
              return (
                <Card key={id}>
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
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <div className="bm-row">
            <span>{i18n("today")}</span>
            <span>{currency}{fmtMoney(today.cost)} · {i18n("reqLabel")} {today.requests} {i18n("req")}</span>
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
        </Card>

        <Card>
          <span className="bm-cal-title">{i18n("history7")}</span>
          <BarChart daily={history?.daily ?? {}} days={7} />
        </Card>

        <Card>
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
        </Card>

        <Card>
          <div className="bm-row">
            <span className="bm-cal-title">{i18n("sessions")} ({totalGroups} {i18n("groupsUnit")} · {sessions.length})</span>
            {totalGroups > 6 && (
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
          {visibleGroups.length === 0 ? (
            <span className="bm-empty">{i18n("noSessions")}</span>
          ) : (
            <div className="bm-list">
              {visibleGroups.map((group) => renderTitleGroup(group))}
            </div>
          )}
        </Card>

        <span className="bm-note">{i18n("settingsHint")}</span>
      </div>

      <span className="bm-pop-resize" onPointerDown={startResize} title={i18n("resizeHint")} />
    </div>,
    document.body,
  );
}
