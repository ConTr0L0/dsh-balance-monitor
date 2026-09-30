/**
 * dsh-balance-monitor — client half.
 *
 * Registers two seats, both fed by the same data:
 *  - a global main panel: the left rail's "余额监控" row (`sidebar.panellist`)
 *    plus the `main` keyed-slot page it selects — DSH renders a plugin page in
 *    place of the Conversation, exactly like the shipped Plugins page;
 *  - the sidebar footer widget (an oval floating pill above the Settings
 *    control) for the at-a-glance balance.
 *
 * The panel used to be a `settings.section`; it was moved out of Settings when
 * the rail row arrived, so the rail is now the single entry point and the
 * settings dialog no longer carries a duplicate.
 *
 * Works identically in the web GUI and the desktop shell (both run the same web
 * client). Theming is fully variable-driven (--dsw-alias-*), so the widget and
 * the page adapt to any UI theme or skin plugin.
 */
import { createRpc } from "./api";
import { injectStyles } from "./styles";
import { BalanceMonitorPage, BalancePanelIcon } from "./page";
import { SidebarWidget } from "./widget";
import { refreshAll } from "./store";
import { NS, attachLocale, en, t, zh } from "./locales";

/** The id shared by the rail row and the main panel it selects. */
const PANEL_ID = "balance-monitor";
/**
 * Where the row sits among the global panels. The shipped ones are plugins (0)
 * and the task manager (10), and the installed usage-statistics panel is 30, so
 * 40 keeps this row after all of them and before nothing.
 */
const PANEL_ORDER = 40;

interface PanelInfo {
  getSnapshot: () => { activePanelId: string | null };
  subscribe: (listener: () => void) => () => void;
}

/** Client entry. */
function apply(ctx: {
  effect: (fn: () => void, label?: string) => void;
  locale: {
    register: (ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }) => () => void;
    getSnapshot: () => { active: string };
  };
  slots: {
    inject: (key: string, factory: () => () => void) => () => void;
    register: (options: Record<string, unknown>, component: unknown) => () => void;
  };
  layout: {
    selectPanel: (id: string | null) => void;
    panelInfo: PanelInfo;
  };
  logger?: { warn: (...args: unknown[]) => void };
}) {
  injectStyles();
  attachLocale(ctx.locale);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-balance-monitor: dictionaries");

  // The host half serves its own fenced route (lib/rpc.js); no client service is
  // needed beyond the same-origin fetch the caller performs.
  const rpc = createRpc();

  // Where the reader came from, for the page's back control. The shell keeps no
  // navigation history (selectPanel only writes a selection), so this bundle
  // remembers the previous panel itself; subscribing is what makes the target
  // right even when the reader arrives from another panel.
  let previousPanelId: string | null = null;
  let lastPanelId = ctx.layout.panelInfo.getSnapshot().activePanelId;
  ctx.effect(
    () =>
      ctx.layout.panelInfo.subscribe(() => {
        const next = ctx.layout.panelInfo.getSnapshot().activePanelId;
        if (next === PANEL_ID && lastPanelId !== PANEL_ID) previousPanelId = lastPanelId;
        lastPanelId = next;
      }),
    "dsh-balance-monitor: panel history",
  );

  // Go back to the remembered panel, or to the Conversation. A remembered key
  // may have been unregistered since, and selectPanel throws on an unknown key,
  // so the fallback is always the (always legal) Conversation.
  const goBack = () => {
    if (previousPanelId === null || previousPanelId === PANEL_ID) {
      ctx.layout.selectPanel(null);
      return;
    }
    try {
      ctx.layout.selectPanel(previousPanelId);
    } catch {
      ctx.layout.selectPanel(null);
    }
  };

  ctx.effect(() => {
    const disposer = ctx.slots.inject(
      "main",
      () =>
        ctx.slots.register(
          {
            name: "main",
            key: PANEL_ID,
            inject: () => ({ rpc, goBack }),
          },
          BalanceMonitorPage,
        ),
    );
    return disposer;
  }, "dsh-balance-monitor: main panel");

  ctx.effect(() => {
    const disposer = ctx.slots.inject(
      "sidebar.panellist",
      () =>
        ctx.slots.register(
          {
            name: "sidebar.panellist",
            id: PANEL_ID,
            order: PANEL_ORDER,
            label: () => t("name"),
          },
          BalancePanelIcon,
        ),
    );
    return disposer;
  }, "dsh-balance-monitor: sidebar panel row");

  ctx.effect(() => {
    const disposer = ctx.slots.inject(
      "sidebar.footer.action",
      () =>
        ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "dsh-balance-monitor",
            order: 0,
            label: () => t("name"),
            inject: () => ({ rpc }),
          },
          SidebarWidget,
        ),
    );
    return disposer;
  }, "dsh-balance-monitor: sidebar widget");

  // Prime the widget (and the page, through the shared store) as soon as the host
  // is reachable.
  void refreshAll(rpc, true);
}

/** Services the client entry requires (order-independent fiber waiting). */
const inject = ["slots", "locale", "layout"];

export { apply, inject };
