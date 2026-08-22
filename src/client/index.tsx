/**
 * dsh-balance-monitor — client half.
 *
 * Registers the sidebar widget (an oval floating pill above the Settings
 * control) and the DSH settings section. Works identically in the web GUI
 * and the desktop shell (both run the same web client). Theming is fully
 * variable-driven (--dsw-alias-*), so the widget adapts to any UI theme or
 * skin plugin.
 */
import { createRpc } from "./api";
import { injectStyles } from "./styles";
import { SettingsCard } from "./settings";
import { SidebarWidget } from "./widget";
import { refreshAll } from "./store";
import { NS, attachLocale, en, t, zh } from "./locales";

/** Client entry. */
function apply(ctx: {
  effect: (fn: () => void, label?: string) => void;
  locale: {
    register: (ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }) => () => void;
    getSnapshot: () => { active: string };
  };
  connection: { rpc: { call: (...args: unknown[]) => Promise<unknown> } };
  slots: {
    inject: (key: string, factory: () => () => void) => () => void;
  };
  logger?: { warn: (...args: unknown[]) => void };
}) {
  injectStyles();
  attachLocale(ctx.locale);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-balance-monitor: dictionaries");

  const rpc = createRpc(ctx.connection);

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

  ctx.effect(() => {
    const disposer = ctx.slots.inject(
      "settings.section",
      () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "balance-monitor",
            order: 500,
            label: () => t("settingsNav"),
            inject: () => ({ rpc }),
          },
          SettingsCard,
        ),
    );
    return disposer;
  }, "dsh-balance-monitor: settings section");

  // Prime the widget with data as soon as the host is reachable.
  void refreshAll(rpc, true);
}

/** Services the client entry requires (order-independent fiber waiting). */
const inject = ["slots", "locale", "connection"];

export { apply, inject };
