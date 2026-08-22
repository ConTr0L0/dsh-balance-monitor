window.__ModuleLoader__.load({
	id: "dsh-balance-monitor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/api.ts
var RpcError = class extends Error {
};
function createRpc(connection) {
  const call = async (endpoint, payload) => {
    const response = await connection.rpc.call(
      "/dsh-balance-monitor",
      endpoint,
      payload ?? {}
    );
    if (!response.ok) {
      const error = new RpcError(response.error?.message ?? `RPC ${endpoint} failed`);
      throw error;
    }
    return response.value;
  };
  return call;
}

// src/client/styles.ts
var CSS = `
/* ---- sidebar oval floating pill (full row, above Settings) ---- */
.bm-widget{display:flex;align-items:center;gap:10px;width:100%;height:42px;padding:0 12px;border-radius:999px;cursor:pointer;color:var(--dsw-alias-label-secondary);min-width:0;user-select:none;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 2px 10px color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);transition:background .14s,border-color .14s,color .14s,box-shadow .14s}
.bm-widget:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
.bm-widget[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}
.bm-widget-rail{height:36px;padding:0 8px;justify-content:center;gap:6px}
.bm-pill-badge{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--dsw-alias-bg-layer-3);background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary))}
.bm-pill-main{flex:1;min-width:0;display:flex;align-items:center;gap:8px;overflow:hidden}
.bm-primary{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;letter-spacing:.01em}
.bm-secondary{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.bm-primary[data-warn="true"],.bm-secondary[data-warn="true"]{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-primary[data-critical="true"],.bm-critical{color:var(--dsw-alias-state-error-primary)!important}
.bm-progress{flex:none;width:34px;height:3px;border-radius:99px;background:var(--dsw-alias-border-l2);overflow:hidden}
.bm-progress>i{display:block;height:100%;background:var(--dsw-alias-label-primary);border-radius:99px}
.bm-progress[data-warn="true"]>i{background:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-progress[data-critical="true"]>i{background:var(--dsw-alias-state-error-primary)}
.bm-peak{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);opacity:.8}
.bm-peak[data-status="off-peak"]{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-tertiary))}
.bm-peak-label{font-size:11px;color:var(--dsw-alias-label-secondary);padding:3px 9px;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.bm-peak-label[data-status="off-peak"]{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary))}
.bm-iconbtn{appearance:none;border:0;background:0;color:var(--dsw-alias-label-tertiary);width:22px;height:22px;padding:0;display:grid;place-items:center;border-radius:8px;cursor:pointer;flex:none}
.bm-iconbtn:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.bm-iconbtn:disabled{opacity:.4;cursor:default}
.bm-iconbtn svg{width:13px;height:13px}
/* ---- popover ---- */
.bm-popover{position:fixed;z-index:50;width:360px;max-height:78vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:18px;box-shadow:0 16px 40px color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent);overflow:hidden}
.bm-pop-header{flex:none;display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.bm-pop-select{appearance:none;border:1px solid var(--dsw-alias-border-l2);height:32px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font:inherit;font-size:12px;border-radius:999px;outline:none;padding:0 26px 0 12px;cursor:pointer}
.bm-pop-body{overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:14px;min-height:0}
.bm-card{border:1px solid var(--dsw-alias-border-l2);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.bm-card-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.bm-big{font-size:26px;font-weight:600;color:var(--dsw-alias-label-primary);letter-spacing:.01em;line-height:1.1}
.bm-big[data-warn="true"]{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
.bm-row>span:first-child{color:var(--dsw-alias-label-tertiary);font-size:11px;flex:none}
.bm-row>span:last-child{color:var(--dsw-alias-label-primary);font-size:12px;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bm-chart{display:flex;align-items:flex-end;gap:6px;height:88px;padding-top:4px}
.bm-chart-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
.bm-chart-bar{width:100%;max-width:26px;border-radius:6px 6px 3px 3px;background:var(--dsw-alias-label-primary);opacity:.85;min-height:2px}
.bm-chart-bar[data-active="true"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary))}
.bm-chart-label{font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.bm-chart-value{font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.bm-heat{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.bm-heat-cell{aspect-ratio:1;border-radius:8px;display:grid;place-items:center;font-size:10px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);cursor:default;position:relative;overflow:hidden}
.bm-heat-cell[data-spent="true"]{color:var(--dsw-alias-bg-layer-3)}
.bm-heat-cell[data-today="true"]{box-shadow:0 0 0 1px var(--dsw-alias-border-l1)}
.bm-heat-empty{visibility:hidden}
.bm-months{display:flex;align-items:center;justify-content:space-between;gap:8px}
.bm-months>span{font-size:12px;color:var(--dsw-alias-label-primary);font-weight:500}
.bm-cal-title{font-size:12px;color:var(--dsw-alias-label-secondary);margin:2px 0 0}
.bm-list{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto}
.bm-list-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;min-width:0;background:var(--dsw-alias-bg-layer-2)}
.bm-list-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bm-list-title{font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-list-sub{font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-list-cost{font-size:12px;color:var(--dsw-alias-label-primary);flex:none}
.bm-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);text-align:center;padding:12px 0}
.bm-note{font-size:10px;color:var(--dsw-alias-label-tertiary);line-height:16px}
.bm-progress-lg{height:6px;flex:none;width:100%;border-radius:99px;background:var(--dsw-alias-border-l2);overflow:hidden}
.bm-progress-lg>i{display:block;height:100%;background:var(--dsw-alias-label-primary);border-radius:99px}
.bm-progress-lg[data-warn="true"]>i{background:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-progress-lg[data-critical="true"]>i{background:var(--dsw-alias-state-error-primary)}
.bm-spin{animation:bm-spin .8s linear infinite}
@keyframes bm-spin{to{transform:rotate(360deg)}}
/* ---- settings card (soft rounded) ---- */
.bm-settings{display:flex;flex-direction:column;gap:20px}
.bm-group{border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-layer-2);padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.bm-group-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.bm-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.bm-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.bm-field>label{font-size:11px;color:var(--dsw-alias-label-secondary)}
.bm-input,.bm-select{appearance:none;border:1px solid var(--dsw-alias-border-l2);height:36px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:12px;border-radius:12px;outline:none;padding:0 12px;min-width:0;width:100%}
.bm-input:focus-visible,.bm-select:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.bm-secret{position:relative;display:flex;gap:6px}
.bm-secret-grow{flex:1;min-width:0}
.bm-key-row{display:flex;align-items:center;gap:12px;min-width:0}
.bm-key-name{flex:none;width:110px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.bm-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px}
.bm-toggle>span{font-size:12px;color:var(--dsw-alias-label-secondary)}
.bm-switch{position:relative;display:inline-block;width:36px;height:21px;flex:none}
.bm-switch>input{clip:rect(0 0 0 0);clip-path:inset(50%);width:1px;height:1px;position:absolute;overflow:hidden}
.bm-switch>i{display:block;height:100%;background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);border-radius:999px;transition:background .14s;position:relative}
.bm-switch>i::after{content:"";display:block;width:15px;height:15px;background:var(--dsw-alias-bg-layer-3);box-shadow:0 1px 3px color-mix(in srgb,var(--dsw-alias-label-primary) 22%,transparent);border-radius:50%;transition:transform .14s;position:absolute;top:3px;left:3px}
.bm-switch>input:checked+i{background:var(--dsw-alias-label-primary);box-shadow:none}
.bm-switch>input:checked+i::after{transform:translate(15px)}
.bm-limit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.bm-limit-card{border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-3);padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.bm-limit-name{font-size:12px;font-weight:500;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;gap:8px}
.bm-advanced{border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-layer-2);padding:0 16px;overflow:hidden}
.bm-advanced>summary{cursor:pointer;list-style:none;font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary);padding:14px 0;display:flex;align-items:center;gap:8px;user-select:none}
.bm-advanced>summary::-webkit-details-marker{display:none}
.bm-advanced>summary::after{content:"›";margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:16px;transition:transform .16s;transform:rotate(90deg)}
.bm-advanced[open]>summary::after{transform:rotate(-90deg)}
.bm-advanced[open]>summary{border-bottom:1px solid var(--dsw-alias-border-l2)}
.bm-advanced-body{display:flex;flex-direction:column;gap:12px;padding:12px 0 16px}
.bm-pricing-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2)}
.bm-pricing-state{font-size:12px;color:var(--dsw-alias-label-primary)}
.bm-pricing-ago{font-size:10px;color:var(--dsw-alias-label-tertiary);flex:none}
.bm-save{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 0}
.bm-save-hint{font-size:11px;color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-tertiary))}
.bm-dashed{appearance:none;border:1px dashed var(--dsw-alias-border-l2);min-height:34px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:none;border-radius:12px;font-size:11px;padding:0 12px}
.bm-dashed:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.bm-pill-button{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;background:var(--dsw-alias-bg-layer-2);padding:0 16px;font-size:12px}
.bm-pill-button:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
`;
var injected = false;
function injectStyles() {
  if (injected || typeof document === "undefined") return;
  const tagId = "dsh-balance-monitor/styles.css";
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-balance-monitor";
  tag.dataset.pluginCss = tagId;
  tag.textContent = CSS;
  document.head.appendChild(tag);
  injected = true;
}

// src/client/settings.tsx
var import_react = require("react");

// src/client/locales.ts
var NS = "balance";
var zh = {
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
  settingsHint: "在 DSH 设置 → 余额监控 中配置 API Key、上限与显示项",
  loading: "加载中…",
  enable: "启用插件",
  refreshInterval: "余额刷新频率",
  providerKeys: "平台 API Key",
  apiKey: "API Key",
  keySet: "已设置（输入新值替换）",
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
  advanced: "高级",
  advancedHint: "以下设置适用于进阶场景",
  baseURLs: "平台接口地址（Base URL）",
  pricingStatus: "计费规则",
  pricingBuiltin: "使用内置默认价目（官方同步未完成）",
  pricingSynced: "已自动同步 DeepSeek 官方价目（{n} 个模型）",
  pricingUnknown: "未同步（保持上次结果）",
  pricingNote: "计费规则由插件自动从 DeepSeek 官方文档查证，无需手动配置",
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
  saveNow: "立即保存"
};
var en = {
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
  settingsHint: "Configure API keys, limits and display in DSH Settings → Balance Monitor",
  loading: "Loading…",
  enable: "Enable plugin",
  refreshInterval: "Balance refresh interval",
  providerKeys: "Provider API keys",
  apiKey: "API Key",
  keySet: "Set (type a new value to replace)",
  keyUnset: "Not set",
  deepseekAutoKey: "DeepSeek reuses the DSH credential DEEPSEEK_API_KEY when left empty",
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
  advanced: "Advanced",
  advancedHint: "Settings below are for advanced scenarios",
  baseURLs: "Provider base URLs",
  pricingStatus: "Billing rules",
  pricingBuiltin: "Using the built-in default price table (official sync pending)",
  pricingSynced: "Auto-synced from official DeepSeek docs ({n} models)",
  pricingUnknown: "Not synced (keeping the last result)",
  pricingNote: "Billing rules are verified automatically from the official DeepSeek docs — nothing to configure",
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
  saveNow: "Save now"
};
var localeService = null;
function attachLocale(service) {
  localeService = service;
}
function activeLocale() {
  return localeService?.getSnapshot().active ?? (typeof navigator !== "undefined" ? navigator.language : "en") ?? "en";
}
function t(key, params) {
  const dict = activeLocale().toLowerCase().startsWith("zh") ? zh : en;
  let text = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

// src/client/settings.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var LIMIT_KEYS = ["daily", "total", "requests"];
var PROVIDERS = ["deepseek", "zhipu", "openrouter", "tavily"];
var PROVIDER_LABELS = {
  deepseek: "DeepSeek",
  zhipu: "Zhipu GLM",
  openrouter: "OpenRouter",
  tavily: "Tavily"
};
function toDraft(value) {
  const providersIn = value.providers ?? {};
  const limitsIn = value.limits ?? {};
  const displayIn = value.display ?? {};
  return {
    enabled: Boolean(value.enabled),
    refreshInterval: value.refreshInterval ?? 60,
    providers: Object.fromEntries(
      PROVIDERS.map((id) => [id, { baseURL: providersIn[id]?.baseURL ?? "" }])
    ),
    display: {
      provider: String(displayIn.provider ?? "deepseek"),
      field: displayIn.field === "available" ? "available" : "total",
      showBalance: displayIn.showBalance !== false,
      showToday: displayIn.showToday !== false,
      showRemaining: displayIn.showRemaining !== false,
      showPeak: displayIn.showPeak !== false,
      showRefresh: displayIn.showRefresh !== false
    },
    limits: Object.fromEntries(
      LIMIT_KEYS.map((key) => [
        key,
        {
          enabled: Boolean(limitsIn[key]?.enabled),
          value: String(limitsIn[key]?.value ?? 10),
          action: limitsIn[key]?.action === "block" ? "block" : "warn",
          showInSidebar: Boolean(limitsIn[key]?.showInSidebar)
        }
      ])
    )
  };
}
function toPatch(draft) {
  return {
    enabled: draft.enabled,
    refreshInterval: draft.refreshInterval,
    providers: Object.fromEntries(
      Object.entries(draft.providers).map(([id, entry]) => [id, { baseURL: entry.baseURL }])
    ),
    display: draft.display,
    limits: Object.fromEntries(
      LIMIT_KEYS.map((key) => [
        key,
        {
          enabled: draft.limits[key].enabled,
          value: Number(draft.limits[key].value) || 0,
          action: draft.limits[key].action,
          showInSidebar: draft.limits[key].showInSidebar
        }
      ])
    )
  };
}
function statusLabel(overview) {
  const pricing = overview?.pricing;
  if (!pricing) return t("pricingUnknown");
  if (pricing.source !== "deepseek-docs") return t("pricingBuiltin");
  return t("pricingSynced", { n: pricing.modelCount });
}
function syncAgo(overview) {
  const fetchedAt = overview?.pricing?.fetchedAt ?? 0;
  if (!fetchedAt) return "—";
  const hours = Math.floor((Date.now() - fetchedAt) / 36e5);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
function SettingsCard({ rpc }) {
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [secrets, setSecrets] = (0, import_react.useState)([]);
  const [revision, setRevision] = (0, import_react.useState)(0);
  const [saveState, setSaveState] = (0, import_react.useState)("idle");
  const [overview, setOverview] = (0, import_react.useState)(null);
  const saveTimer = (0, import_react.useRef)(null);
  const load = async () => {
    try {
      const config = await rpc("config/get");
      setDraft(toDraft(config.value ?? {}));
      setSecrets(config.secrets ?? []);
      setRevision(config.revision);
      setSaveState("idle");
      const overviewData = await rpc("overview");
      setOverview(overviewData);
    } catch {
      setSaveState("error");
    }
  };
  (0, import_react.useEffect)(() => {
    void load();
    return () => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    };
  }, [rpc]);
  const mutate = (updater) => {
    setDraft((current) => current ? updater(current) : current);
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
  const saveSecret = async (provider, value) => {
    setSaveState("saving");
    try {
      await rpc("config/setSecret", { path: ["providers", provider, "apiKey"], value, revision });
      await load();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };
  const secretSet = (provider) => {
    const slot = secrets.find((entry) => entry.path.join(".") === `providers.${provider}.apiKey`);
    return Boolean(slot?.set);
  };
  if (!draft) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bm-empty", children: t("loading") });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-settings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("enable") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bm-switch", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: draft.enabled, onChange: (event) => mutate((c) => ({ ...c, enabled: event.target.checked })) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bm-grid2", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("refreshInterval") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "select",
          {
            className: "bm-select",
            value: draft.refreshInterval,
            onChange: (event) => mutate((c) => ({ ...c, refreshInterval: Number(event.target.value) })),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 5, children: "5s" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 30, children: "30s" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: 60, children: "60s" })
            ]
          }
        )
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-group bm-keys-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-group-title", children: t("providerKeys") }),
      PROVIDERS.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-key-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-key-name", children: PROVIDER_LABELS[id] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bm-secret bm-secret-grow", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            className: "bm-input",
            type: "password",
            autoComplete: "off",
            placeholder: secretSet(id) ? t("keySet") : t("keyUnset"),
            value: "",
            onChange: (event) => {
              if (event.target.value) void saveSecret(id, event.target.value);
              event.target.value = "";
            }
          }
        ) })
      ] }, id)),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-note", children: t("deepseekAutoKey") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-group-title", children: t("displayTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-grid2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("defaultProvider") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "select",
            {
              className: "bm-select",
              value: draft.display.provider,
              onChange: (event) => mutate((c) => ({ ...c, display: { ...c.display, provider: event.target.value } })),
              children: PROVIDERS.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: id, children: PROVIDER_LABELS[id] }, id))
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("balanceField") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "select",
            {
              className: "bm-select",
              value: draft.display.field,
              onChange: (event) => mutate((c) => ({ ...c, display: { ...c.display, field: event.target.value } })),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "total", children: t("fieldTotal") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "available", children: t("fieldAvailable") })
              ]
            }
          )
        ] })
      ] }),
      [
        ["showBalance", "setShowBalance"],
        ["showToday", "setShowToday"],
        ["showRemaining", "setShowRemaining"],
        ["showPeak", "setShowPeak"],
        ["showRefresh", "setShowRefresh"]
      ].map(([key, labelKey]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-toggle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(labelKey) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bm-switch", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: draft.display[key],
              onChange: (event) => mutate((c) => ({ ...c, display: { ...c.display, [key]: event.target.checked } }))
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
        ] })
      ] }, key))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-group-title", children: t("limitsTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bm-limit-grid", children: LIMIT_KEYS.map((key) => {
        const limit = draft.limits[key];
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-limit-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-limit-name", children: [
            t(`limit.${key}`),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bm-switch", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: limit.enabled, onChange: (event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], enabled: event.target.checked } } })) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("limitValue") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: "bm-input",
                value: limit.value,
                disabled: !limit.enabled,
                onChange: (event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], value: event.target.value } } }))
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("limitAction") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "select",
              {
                className: "bm-select",
                value: limit.action,
                disabled: !limit.enabled,
                onChange: (event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], action: event.target.value } } })),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "warn", children: t("actionWarn") }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "block", children: t("actionBlock") })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-toggle", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("showInSidebar") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bm-switch", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: limit.showInSidebar, disabled: !limit.enabled, onChange: (event) => mutate((c) => ({ ...c, limits: { ...c.limits, [key]: { ...c.limits[key], showInSidebar: event.target.checked } } })) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
            ] })
          ] })
        ] }, key);
      }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "bm-advanced", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("advanced") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-advanced-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-note", children: t("advancedHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("pricingStatus") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-pricing-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-pricing-state", children: statusLabel(overview) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-pricing-ago", children: syncAgo(overview) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-note", children: t("pricingNote") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bm-grid2", children: PROVIDERS.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            PROVIDER_LABELS[id],
            " Base URL"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: "bm-input",
              value: draft.providers[id]?.baseURL ?? "",
              onChange: (event) => mutate((c) => ({
                ...c,
                providers: { ...c.providers, [id]: { baseURL: event.target.value } }
              }))
            }
          )
        ] }, id)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bm-save", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bm-save-hint", children: saveState === "saving" ? t("saving") : saveState === "saved" ? t("saved") : saveState === "error" ? t("saveError") : "" }),
      saveState === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bm-dashed", style: { borderStyle: "solid" }, onClick: () => void save(), children: t("retry") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bm-pill-button", onClick: () => void save(), children: t("saveNow") })
    ] })
  ] });
}

// src/client/widget.tsx
var import_react2 = require("react");
var import_react_dom = require("react-dom");

// src/client/charts.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function fmtMoney(value) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "—";
  if (value >= 1e3) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}
function dayLabel(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function BarChart({ daily, days = 7 }) {
  const today = /* @__PURE__ */ new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  const buckets = [];
  let max = 0;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(date);
    const cost = daily[key]?.cost ?? 0;
    max = Math.max(max, cost);
    buckets.push({ key, label: dayLabel(date), cost, isToday: i === days - 1 });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bm-chart", children: buckets.map((bucket) => {
    const ratio = max > 0 ? bucket.cost / max : 0;
    const heightPct = ratio <= 0 ? 2 : Math.max(6, ratio * 100);
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bm-chart-col", title: `${bucket.label} ${fmtMoney(bucket.cost)}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bm-chart-value", children: bucket.cost > 0 ? fmtMoney(bucket.cost) : "" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bm-chart-bar", "data-active": bucket.isToday || void 0, style: { height: `${heightPct}%` } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bm-chart-label", children: bucket.label })
    ] }, bucket.key);
  }) });
}
function MonthHeatmap({
  daily,
  year,
  month
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const today = /* @__PURE__ */ new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;
  let max = 0;
  for (const key of Object.keys(daily)) {
    if (key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)) max = Math.max(max, daily[key].cost);
  }
  const cells = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(/* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bm-heat-cell bm-heat-empty" }, `empty-${i}`));
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = dayKey(date);
    const entry = daily[key];
    const cost = entry?.cost ?? 0;
    const ratio = max > 0 ? cost / max : 0;
    const isToday = isThisMonth && day === today.getDate();
    const style = cost > 0 ? { background: `color-mix(in srgb, var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary)) ${Math.round(12 + ratio * 88)}%, transparent)` } : void 0;
    cells.push(
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "span",
        {
          className: "bm-heat-cell",
          "data-spent": cost > 0 || void 0,
          "data-today": isToday || void 0,
          style,
          title: `${key}  ${fmtMoney(cost)}${entry ? ` · ${entry.requests} req` : ""}`,
          children: day
        },
        key
      )
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bm-heat", children: cells });
}

// src/client/store.ts
var listeners = /* @__PURE__ */ new Set();
var state = {
  overview: null,
  history: null,
  sessions: [],
  loading: true,
  error: null,
  refreshedAt: 0
};
function notify() {
  for (const listener of [...listeners]) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getSnapshot() {
  return state;
}
var inflight = null;
async function refreshAll(rpc, includeSessions = false) {
  if (inflight !== null) return inflight;
  inflight = (async () => {
    try {
      const [overview, history, sessionPage] = await Promise.all([
        rpc("overview"),
        rpc("history"),
        includeSessions ? rpc("sessions", { limit: 200 }) : Promise.resolve(null)
      ]);
      state.overview = overview;
      state.history = history;
      if (sessionPage) state.sessions = sessionPage.rows;
      state.error = null;
      state.refreshedAt = Date.now();
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      notify();
    }
  })();
  await inflight;
  inflight = null;
}
async function manualRefresh(rpc) {
  try {
    await rpc("refresh");
  } catch {
  }
  await refreshAll(rpc, true);
}

// src/client/widget.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var PROVIDER_LABELS2 = {
  deepseek: "DeepSeek",
  zhipu: "Zhipu GLM",
  openrouter: "OpenRouter",
  tavily: "Tavily"
};
function currencySymbol(currency) {
  return currency === "USD" ? "$" : "¥";
}
function providerPrimary(provider, field) {
  if (!provider) return null;
  const value = field === "available" ? provider.available : provider.total;
  return typeof value === "number" ? value : null;
}
function providerAvailable(provider) {
  if (!provider) return null;
  const value = provider.available;
  return typeof value === "number" ? value : null;
}
function timeAgo(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1e3));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
var SafeBoundary = class extends import_react2.Component {
  constructor() {
    super(...arguments);
    __publicField(this, "state", { failed: false });
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
};
function RefreshIcon({ spinning }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { className: spinning ? "bm-spin" : void 0, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M13.7 1.8v3.4h-3.4" })
  ] });
}
function CloseIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 4l8 8M12 4l-8 8" }) });
}
function SidebarWidget({ wide, rpc }) {
  const snapshot = (0, import_react2.useSyncExternalStore)(subscribe, getSnapshot);
  const { overview, error } = snapshot;
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [anchor, setAnchor] = (0, import_react2.useState)(null);
  const buttonRef = (0, import_react2.useRef)(null);
  const [spinning, setSpinning] = (0, import_react2.useState)(false);
  const display = overview?.display;
  const providerId = display?.provider ?? "deepseek";
  const provider = overview?.providers?.[providerId];
  const primary = providerPrimary(provider, display?.field ?? "total");
  const currency = currencySymbol(provider?.currency);
  const peak = overview?.peak?.status ?? "off-peak";
  const todayCost = overview?.today.cost ?? 0;
  const dailyLimit = overview?.limits?.find((row) => row.key === "daily");
  const anyLimitExceeded = overview?.limits?.some((row) => row.enabled && row.exceeded) ?? false;
  const anyBlocked = overview?.limits?.some((row) => row.enabled && row.exceeded && row.action === "block") ?? false;
  const showRemaining = display?.showRemaining && dailyLimit?.enabled && !(dailyLimit.value <= 0);
  (0, import_react2.useEffect)(() => {
    if (!rpc) return;
    void refreshAll(rpc);
    const timer = setInterval(() => void refreshAll(rpc), (overview?.refreshInterval ?? 60) * 1e3);
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
  const balanceLabel = provider?.ok === false && provider?.error === "no-api-key" ? t("noKey") : `${currency}${fmtMoney(primary)}`;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(SafeBoundary, { fallback: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-empty", children: "—" }), children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        ref: buttonRef,
        className: `bm-widget${wide ? "" : " bm-widget-rail"}`,
        "data-active": open || void 0,
        role: "button",
        tabIndex: 0,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        onClick: openPanel,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPanel();
          }
        },
        title: t("name"),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-pill-badge", "aria-hidden": true, children: "¥" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-pill-main", children: [
            display?.showBalance !== false && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "span",
              {
                className: "bm-primary",
                "data-warn": anyLimitExceeded || void 0,
                "data-critical": anyBlocked || void 0,
                children: balanceLabel
              }
            ),
            wide && display?.showToday !== false && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-secondary", children: [
              t("today"),
              " ",
              currency,
              fmtMoney(todayCost),
              showRemaining ? ` · ${fmtMoney(dailyLimit.remaining)} / ${fmtMoney(dailyLimit.value)}` : ""
            ] })
          ] }),
          wide && showRemaining && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "span",
            {
              className: "bm-progress",
              "data-warn": dailyLimit?.exceeded || void 0,
              "data-critical": dailyLimit?.action === "block" && dailyLimit.exceeded || void 0,
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", { style: { width: `${Math.min(100, Math.round(dailyLimit.progress * 100))}%` } })
            }
          ),
          display?.showPeak !== false && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-peak", "data-status": peak, title: peak === "peak" ? t("peak") : t("offpeak") }),
          wide && display?.showRefresh !== false && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "bm-iconbtn",
              disabled: spinning,
              "aria-label": t("refresh"),
              title: t("refresh"),
              onClick: (event) => {
                event.stopPropagation();
                void doRefresh();
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RefreshIcon, { spinning })
            }
          )
        ]
      }
    ),
    open && anchor && overview && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SafeBoundary, { fallback: null, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      Popover,
      {
        anchor,
        onClose: () => setOpen(false),
        rpc,
        providerId
      }
    ) }),
    open && !overview && error && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "bm-empty", children: error })
  ] });
}
function Popover({
  anchor,
  onClose,
  rpc,
  providerId
}) {
  const snapshot = (0, import_react2.useSyncExternalStore)(subscribe, getSnapshot);
  const { overview, history, sessions } = snapshot;
  const [provider, setProvider] = (0, import_react2.useState)(providerId);
  const [year, setYear] = (0, import_react2.useState)((/* @__PURE__ */ new Date()).getFullYear());
  const [month, setMonth] = (0, import_react2.useState)((/* @__PURE__ */ new Date()).getMonth());
  const [spinning, setSpinning] = (0, import_react2.useState)(false);
  const [showAllSessions, setShowAllSessions] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!overview) return null;
  const prov = overview.providers[provider];
  const field = overview.display?.field ?? "total";
  const primary = providerPrimary(prov, field);
  const currency = currencySymbol(prov?.currency);
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
  const shiftMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };
  const shownSessions = showAllSessions ? sessions : sessions.slice(0, 8);
  const now = /* @__PURE__ */ new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        className: "bm-popover",
        style: anchor.top ? { left: anchor.x + 8, bottom: Math.max(8, window.innerHeight - anchor.y + 8) } : { left: anchor.x + 8, top: anchor.y + 8 },
        role: "dialog",
        "aria-label": t("name"),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-pop-header", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "select",
              {
                className: "bm-pop-select",
                value: provider,
                onChange: (event) => {
                  setProvider(event.target.value);
                  void refreshAll(rpc);
                },
                children: displayOptions.map((id) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: id, children: PROVIDER_LABELS2[id] ?? id }, id))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-peak-label", "data-status": peak, children: peak === "peak" ? t("peak") : t("offpeak") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { flex: 1 } }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "bm-iconbtn", onClick: () => void doRefresh(), disabled: spinning, "aria-label": t("refresh"), title: t("refresh"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RefreshIcon, { spinning }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "bm-iconbtn", onClick: onClose, "aria-label": "close", title: "close", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CloseIcon, {}) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-pop-body", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-card-label", children: PROVIDER_LABELS2[provider] ?? provider }),
              prov?.ok === false ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-big", "data-warn": true, children: "—" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-note", children: prov.error === "no-api-key" ? t("noKey") : prov.error })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-big", children: [
                  currency,
                  fmtMoney(primary)
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-note", children: [
                  t("available"),
                  " ",
                  currency,
                  fmtMoney(providerAvailable(prov)),
                  typeof prov?.used === "number" ? ` · ${t("used")} ${currency}${fmtMoney(prov.used ?? 0)}` : "",
                  typeof prov?.limit === "number" ? ` / ${currency}${fmtMoney(prov.limit ?? 0)}` : "",
                  typeof prov?.granted === "number" ? ` · ${t("granted")} ${currency}${fmtMoney(prov.granted ?? 0)}` : "",
                  typeof prov?.toppedUp === "number" ? ` · ${t("toppedUp")} ${currency}${fmtMoney(prov.toppedUp ?? 0)}` : ""
                ] }),
                prov?.fetchedAt ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-note", children: [
                  t("updated"),
                  " ",
                  timeAgo(prov.fetchedAt)
                ] }) : null
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("today") }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
                  currency,
                  fmtMoney(daily.cost),
                  " · ",
                  daily.requests,
                  " ",
                  t("req")
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("totalCost") }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
                  currency,
                  fmtMoney(overview.totals.cost),
                  " · ",
                  overview.totals.requests,
                  " ",
                  t("req")
                ] })
              ] }),
              enabledLimits.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t(row.labelKey) ?? row.key }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { "data-warn": row.exceeded || void 0, children: [
                  fmtMoney(row.current),
                  " / ",
                  row.key === "requests" ? `${row.value} ${t("req")}` : `${currency}${fmtMoney(row.value)}`
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "div",
                  {
                    className: "bm-progress-lg",
                    "data-warn": row.exceeded || void 0,
                    "data-critical": row.action === "block" && row.exceeded || void 0,
                    style: { flex: "none", width: 72 },
                    children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", { style: { width: `${Math.round(row.progress * 100)}%` } })
                  }
                )
              ] }, row.key))
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-cal-title", children: t("history7") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BarChart, { daily: history?.daily ?? {}, days: 7 })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-months", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "bm-iconbtn", onClick: () => shiftMonth(-1), "aria-label": "previous", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M10 3.5L5.5 8l4.5 4.5" }) }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
                  year,
                  " / ",
                  String(month + 1).padStart(2, "0")
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "bm-iconbtn", onClick: () => shiftMonth(1), disabled: isCurrentMonth, "aria-label": "next", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M6 3.5l4.5 4.5L6 12.5" }) }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(MonthHeatmap, { daily: history?.daily ?? {}, year, month }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-note", children: t("heatNote") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-cal-title", children: [
                  t("sessions"),
                  " (",
                  sessions.length,
                  ")"
                ] }),
                sessions.length > 8 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "bm-iconbtn",
                    onClick: () => setShowAllSessions((value) => !value),
                    title: showAllSessions ? t("collapse") : t("showAll"),
                    children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: showAllSessions ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 10l4-4 4 4" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 6l4 4 4-4" }) })
                  }
                )
              ] }),
              shownSessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-empty", children: t("noSessions") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "bm-list", children: shownSessions.map((session) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-list-row", title: session.id, children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "bm-list-row-main", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-list-title", children: session.title || session.id.slice(0, 8) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-list-sub", children: [
                    session.lastEvent ? new Date(session.lastEvent).toLocaleString() : "",
                    " · ",
                    session.requests,
                    " ",
                    t("req")
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "bm-list-cost", children: [
                  currency,
                  fmtMoney(session.cost)
                ] })
              ] }, session.id)) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "bm-note", children: t("settingsHint") })
          ] })
        ]
      }
    ),
    document.body
  );
}

// src/client/index.tsx
function apply(ctx) {
  injectStyles();
  attachLocale(ctx.locale);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-balance-monitor: dictionaries");
  const rpc = createRpc(ctx.connection);
  ctx.effect(() => {
    const disposer = ctx.slots.inject(
      "sidebar.footer.action",
      () => ctx.slots.register(
        {
          name: "sidebar.footer.action",
          id: "dsh-balance-monitor",
          order: 0,
          label: () => t("name"),
          inject: () => ({ rpc })
        },
        SidebarWidget
      )
    );
    return disposer;
  }, "dsh-balance-monitor: sidebar widget");
  ctx.effect(() => {
    const disposer = ctx.slots.inject(
      "settings.section",
      () => ctx.slots.register(
        {
          name: "settings.section",
          id: "balance-monitor",
          order: 500,
          label: () => t("settingsNav"),
          inject: () => ({ rpc })
        },
        SettingsCard
      )
    );
    return disposer;
  }, "dsh-balance-monitor: settings section");
  void refreshAll(rpc, true);
}
var inject = ["slots", "locale", "connection"];

		return module.exports;
	}
});
