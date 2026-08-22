/**
 * dsh-balance-monitor — client half.
 *
 * Registers the sidebar widget (above the Settings control) and the DSH
 * settings section. Works identically in the web GUI and the desktop shell
 * (both run the same web client). Theming is fully variable-driven
 * (--dsw-alias-*), so the widget adapts to any active UI theme.
 */
import { createRpc } from "./api";
import { injectStyles } from "./styles";
import { SettingsCard } from "./settings";
import { SidebarWidget } from "./widget";
import { refreshAll } from "./store";

const NS = "balance";

/** Simplified Chinese dictionary (the key-set source of truth). */
const zh: Record<string, string> = {
  name: "余额监控",
  settingsNav: "余额监控",
  noKey: "未配置",
  today: "今日",
  refresh: "刷新",
  peak: "高峰",
  offpeak: "谷时",
  available: "可用",
  used: "已用",
  granted: "赠送",
  toppedUp: "充值",
  updated: "更新于",
  req: "次",
  totalCost: "累计消耗",
  history7: "近 7 天消耗",
  heatNote: "颜色越深，当日消耗越多",
  sessions: "会话消耗",
  noSessions: "暂无消耗数据",
  showAll: "全部",
  collapse: "收起",
  settingsHint: "在 DSH 设置 → 余额监控 中配置 API Key、价格、上限与显示项",
  loading: "加载中…",
  enable: "启用插件",
  refreshInterval: "余额刷新频率",
  providerKeys: "平台 API Key",
  apiKey: "API Key",
  keySet: "已设置（输入新值替换，清空即删除）",
  keyUnset: "未设置",
  deepseekAutoKey: "DeepSeek 留空时自动复用 DSH 凭据中的 DEEPSEEK_API_KEY",
  displayTitle: "侧边栏显示",
  defaultProvider: "默认平台",
  balanceField: "余额口径",
  fieldTotal: "账户余额",
  fieldAvailable: "可用余额",
  setShowBalance: "显示余额",
  setShowToday: "显示今日消耗",
  setShowRemaining: "显示上限进度",
  setShowPeak: "显示峰谷状态",
  setShowRefresh: "显示刷新按钮",
  pricesTitle: "价格与峰谷",
  peakWindows: "高峰时段 (北京时间)",
  offPeakFactor: "谷时折扣 (如 0.5 = 半价)",
  addModel: "添加模型",
  remove: "移除",
  limitsTitle: "消耗上限",
  "limit.daily": "每日金额上限",
  "limit.total": "累计金额上限",
  "limit.requests": "请求次数上限",
  limitValue: "上限值",
  limitAction: "超限行为",
  actionWarn: "仅提醒",
  actionBlock: "提醒并终止",
  showInSidebar: "侧边栏显示",
  saving: "保存中…",
  saved: "已保存",
  saveError: "保存失败",
  retry: "重试",
  saveNow: "立即保存",
};

/** English dictionary, checked complete against the zh key set. */
const en: Record<string, string> = {
  name: "Balance Monitor",
  settingsNav: "Balance Monitor",
  noKey: "No key",
  today: "Today",
  refresh: "Refresh",
  peak: "Peak",
  offpeak: "Off-peak",
  available: "available",
  used: "used",
  granted: "granted",
  toppedUp: "top-up",
  updated: "updated",
  req: "req",
  totalCost: "Total spend",
  history7: "Last 7 days",
  heatNote: "Darker = more spent that day",
  sessions: "Sessions",
  noSessions: "No usage data yet",
  showAll: "all",
  collapse: "collapse",
  settingsHint: "Configure API keys, pricing, limits and display in DSH Settings → Balance Monitor",
  loading: "Loading…",
  enable: "Enable plugin",
  refreshInterval: "Balance refresh interval",
  providerKeys: "Provider API keys",
  apiKey: "API Key",
  keySet: "Set (type a new value to replace; clear to remove)",
  keyUnset: "Not set",
  deepseekAutoKey: "DeepSeek: reuse the DSH credential DEEPSEEK_API_KEY when left empty",
  displayTitle: "Sidebar display",
  defaultProvider: "Default provider",
  balanceField: "Balance figure",
  fieldTotal: "Account balance",
  fieldAvailable: "Available balance",
  setShowBalance: "Show balance",
  setShowToday: "Show today's spend",
  setShowRemaining: "Show limit progress",
  setShowPeak: "Show peak/off-peak",
  setShowRefresh: "Show refresh button",
  pricesTitle: "Pricing & peak windows",
  peakWindows: "Peak windows (Beijing time)",
  offPeakFactor: "Off-peak factor (0.5 = half price)",
  addModel: "Add model",
  remove: "Remove",
  limitsTitle: "Spending limits",
  "limit.daily": "Daily amount",
  "limit.total": "Total amount",
  "limit.requests": "Request count",
  limitValue: "Limit",
  limitAction: "When exceeded",
  actionWarn: "Warn only",
  actionBlock: "Warn and block",
  showInSidebar: "Show in sidebar",
  saving: "Saving…",
  saved: "Saved",
  saveError: "Save failed",
  retry: "Retry",
  saveNow: "Save now",
};

/** Module-level locale handle for label thunks (registered in apply). */
let localeService: { getSnapshot: () => { active: string } } | null = null;

/** Translate a copy key outside React (nav labels, list labels). */
function t(key: string, params?: Record<string, unknown>): string {
  const active = localeService?.getSnapshot().active ?? (typeof navigator !== "undefined" ? navigator.language : "en");
  const dict = active.toLowerCase().startsWith("zh") ? zh : en;
  let text = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** Client entry. */
function apply(ctx: {
  effect: (fn: () => void, label?: string) => void;
  locale: {
    register: (ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }) => () => void;
  };
  connection: { rpc: { call: (...args: unknown[]) => Promise<unknown> } };
  slots: {
    inject: (key: string, factory: () => () => void) => () => void;
  };
  logger?: { warn: (...args: unknown[]) => void };
}) {
  injectStyles();
  localeService = ctx.locale;
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
            locale: NS,
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
            locale: NS,
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
