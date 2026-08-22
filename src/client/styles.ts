/**
 * CSS injection for dsh-balance-monitor.
 *
 * Themed exclusively through the DSH alias variables (--dsw-alias-*) so the
 * widget follows the active theme on web and desktop builds. Injected once
 * per document through the same <style data-plugin-css> convention the
 * official client bundles use.
 */

const CSS = `
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

let injected = false;

/** Inject the plugin stylesheet once. Call from the client apply body. */
export function injectStyles() {
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
