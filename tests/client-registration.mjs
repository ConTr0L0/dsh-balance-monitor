/**
 * Client-registration test for the left-rail panel.
 *
 * The panel is a pair of slot registrations, and getting either half wrong is
 * silent in the browser: a row with no `main` entry throws when clicked, a
 * `main` entry with the wrong key is never selected, and a row registered under
 * a foreign seat simply never appears. So this test loads the REAL built bundle
 * (`lib/client.js`) the way the browser does — through `window.__ModuleLoader__`
 * — drives `apply(ctx)` against a fake host, and asserts the pair, the injected
 * props, the back control's navigation, and that both components render.
 *
 * React comes from the plugin's own dev dependencies; nothing here touches the
 * network (the primed refresh is answered by a stub `fetch`).
 *
 * Run from the plugin root:
 *   node tests/client-registration.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require_ = createRequire(join(ROOT, "package.json"));

const checks = [];
const check = (label, ok, detail = "") => checks.push([label, ok, detail]);

// ---------------------------------------------------------------------------
// Fake host: effect() runs inline, slots/inject are captured, layout is a stub.
// ---------------------------------------------------------------------------
const registrations = [];
const injectedKeys = [];
const selectedPanels = [];
const panelListeners = [];
let activePanelId = null;

const ctx = {
  effect(fn) {
    const disposer = fn();
    return typeof disposer === "function" ? disposer : () => {};
  },
  locale: {
    register: () => () => {},
    getSnapshot: () => ({ active: "zh-CN" }),
  },
  slots: {
    inject(key, factory) {
      injectedKeys.push(key);
      const disposer = factory();
      return typeof disposer === "function" ? disposer : () => {};
    },
    register(options, component) {
      registrations.push({ options, component });
      return () => {};
    },
  },
  layout: {
    selectPanel(id) {
      selectedPanels.push(id);
      activePanelId = id;
    },
    panelInfo: {
      getSnapshot: () => ({ activePanelId }),
      subscribe(listener) {
        panelListeners.push(listener);
        return () => {};
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Load the classic-script bundle exactly as the browser does.
// ---------------------------------------------------------------------------
const fetched = [];
globalThis.fetch = async (url) => {
  const target = String(url);
  fetched.push(target);
  const value = target.endsWith("/history")
    ? { daily: {}, totals: { cost: 0, requests: 0 } }
    : target.endsWith("/sessions")
      ? { rows: [], total: 0 }
      : {
          providers: {},
          display: {},
          today: { cost: 0, requests: 0, models: {} },
          totals: { cost: 0, requests: 0 },
          models: {},
          limits: [],
          peak: { status: "off-peak", windows: [], offPeakFactor: 0.5 },
          pricing: { source: "test", fetchedAt: 0, modelCount: 0 },
          pricingNotice: null,
          savedAt: 0,
        };
  return { ok: true, status: 200, json: async () => ({ ok: true, value }) };
};

const requireShim = (spec) => {
  if (spec === "react") return require_("react");
  if (spec === "react/jsx-runtime") return require_("react/jsx-runtime");
  if (spec === "react-dom") return require_("react-dom");
  if (spec === "react-dom/client") return require_("react-dom/client");
  throw new Error(`unexpected external require: ${spec}`);
};

let loadedId = null;
let clientExports = null;
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      loadedId = id;
      clientExports = factory(requireShim);
    },
  },
};
(0, eval)(readFileSync(join(ROOT, "lib", "client.js"), "utf8"));

check("bundle registers itself under the plugin id", loadedId === "dsh-balance-monitor", String(loadedId));
check("bundle exports apply()", typeof clientExports?.apply === "function", String(typeof clientExports?.apply));
check(
  "client waits for slots, locale and layout",
  JSON.stringify(clientExports?.inject) === JSON.stringify(["slots", "locale", "layout"]),
  JSON.stringify(clientExports?.inject),
);

clientExports.apply(ctx);
await new Promise((resolve) => setTimeout(resolve, 30));

const byName = (name) => registrations.filter((entry) => entry.options.name === name);
const railRow = byName("sidebar.panellist")[0];
const mainPanel = byName("main")[0];

check("registers exactly one rail row", byName("sidebar.panellist").length === 1, String(byName("sidebar.panellist").length));
check("the rail row uses the shared panel id", railRow?.options.id === "balance-monitor", JSON.stringify(railRow?.options));
check("the rail row sits after the shipped and installed panels", railRow?.options.order === 40, String(railRow?.options.order));
check("the rail row label is the plugin name", railRow?.options.label?.() === "余额监控", String(railRow?.options.label?.()));
check("registers exactly one main panel", byName("main").length === 1, String(byName("main").length));
check("the main panel key matches the rail row id", mainPanel?.options.key === "balance-monitor", JSON.stringify(mainPanel?.options));
check("the Settings section is gone (moved, not duplicated)", byName("settings.section").length === 0);
check("the footer widget is still registered", byName("sidebar.footer.action").length === 1);
check(
  "injects exactly the three seats it fills",
  JSON.stringify([...injectedKeys].sort()) === JSON.stringify(["main", "sidebar.footer.action", "sidebar.panellist"]),
  JSON.stringify(injectedKeys),
);
check("the panel primed its data on activation", fetched.some((url) => url.endsWith("/overview")), JSON.stringify(fetched));

// ---------------------------------------------------------------------------
// Injected props + the back control's navigation.
// ---------------------------------------------------------------------------
const pageProps = mainPanel.options.inject();
check("the main panel receives its rpc caller", typeof pageProps?.rpc === "function", String(typeof pageProps?.rpc));
check("the main panel receives a back control", typeof pageProps?.goBack === "function", String(typeof pageProps?.goBack));

const walk = (panelId) => {
  activePanelId = panelId;
  for (const listener of panelListeners) listener();
};

walk("plugins");
walk("balance-monitor");
selectedPanels.length = 0;
pageProps.goBack();
check("back returns to the panel the reader came from", selectedPanels.at(-1) === "plugins", JSON.stringify(selectedPanels));

walk(null);
walk("balance-monitor");
selectedPanels.length = 0;
pageProps.goBack();
check("back falls back to the Conversation", selectedPanels.at(-1) === null, JSON.stringify(selectedPanels));

walk("vanished");
walk("balance-monitor");
const realSelectPanel = ctx.layout.selectPanel;
ctx.layout.selectPanel = (id) => {
  if (id === "vanished") throw new Error('layout.selectPanel: main panel "vanished" is not registered');
  selectedPanels.push(id);
  activePanelId = id;
};
selectedPanels.length = 0;
pageProps.goBack();
check("back survives a remembered panel that is no longer registered", selectedPanels.at(-1) === null, JSON.stringify(selectedPanels));
ctx.layout.selectPanel = realSelectPanel;

// ---------------------------------------------------------------------------
// Both components render.
// ---------------------------------------------------------------------------
const { renderToStaticMarkup } = require_("react-dom/server");

const icon = renderToStaticMarkup(railRow.component({ size: 16 }));
check("the rail glyph renders an svg at the seat's size", icon.includes("<svg") && icon.includes('width="16"'), icon.slice(0, 90));

const page = renderToStaticMarkup(mainPanel.component({ rpc: pageProps.rpc, goBack: pageProps.goBack }));
check("the page renders its frame", page.includes('class="bm-page"'), page.slice(0, 120));
check("the page renders its title", page.includes("余额监控"), page.slice(0, 160));
check("the page renders its intro", page.includes("消耗统计"), page.slice(0, 220));
check("the page renders the back control", page.includes("返回"), page.slice(0, 260));
check("the page mounts the shared settings body", page.includes("bm-empty"), page.slice(-260));

// ---------------------------------------------------------------------------
let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? `\nALL ${checks.length} CHECKS PASSED` : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
