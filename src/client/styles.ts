/**
 * CSS injection for dsh-balance-monitor.
 *
 * Themed exclusively through the DSH alias variables (--dsw-alias-*) so the
 * widget follows the active theme on web and desktop builds. Injected once
 * per document through the same <style data-plugin-css> convention the
 * official client bundles use.
 */

const CSS = `
/* ---- sidebar oval floating plate (full row, above Settings) ---- */
.bm-widget{display:flex;align-items:center;gap:7px;width:100%;height:44px;padding:0 12px;border-radius:999px;cursor:pointer;color:var(--dsw-alias-label-primary);min-width:0;user-select:none;box-sizing:border-box;position:relative;overflow:hidden;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 3px 14px color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);transition:background .14s,border-color .14s,box-shadow .14s}
.bm-widget:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1);box-shadow:0 5px 18px color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent)}
.bm-widget[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}
.bm-widget-rail{height:36px;padding:0 8px;gap:6px;justify-content:center}
.bm-pill-badge{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:600;color:var(--dsw-alias-bg-layer-3);background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary))}
.bm-pill-main{flex:1;min-width:0;display:flex;align-items:center;gap:8px;overflow:hidden}
.bm-primary{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;letter-spacing:.01em}
.bm-secondary{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.bm-primary[data-warn="true"],.bm-secondary[data-warn="true"]{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-primary[data-critical="true"],.bm-critical{color:var(--dsw-alias-state-error-primary)!important}
/* peak/off-peak oval tag (left of the plate) */
.bm-trend{flex:none;display:inline-flex;align-items:center;gap:4px;font-size:10px;line-height:1;padding:4px 8px;border-radius:999px;white-space:nowrap}
.bm-trend>i{width:5px;height:5px;border-radius:50%;background:currentColor}
.bm-trend[data-status="off-peak"]{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary));background:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-label-secondary)) 12%,transparent)}
.bm-trend[data-status="peak"]{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary));background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary)) 16%,transparent)}
/* bottom quota strip inside the plate */
.bm-strip{position:absolute;left:14px;right:14px;bottom:5px;height:3px;border-radius:99px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);overflow:hidden;pointer-events:none}
.bm-strip>i{display:block;height:100%;background:var(--dsw-alias-label-primary);border-radius:99px}
.bm-strip[data-warn="true"]{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-primary)) 22%,transparent)}
.bm-strip[data-warn="true"]>i{background:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-strip[data-critical="true"]>i{background:var(--dsw-alias-state-error-primary)}
.bm-iconbtn{appearance:none;border:0;background:0;color:var(--dsw-alias-label-secondary);width:24px;height:24px;padding:0;display:grid;place-items:center;border-radius:8px;cursor:pointer;flex:none}
.bm-iconbtn:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.bm-iconbtn:disabled{opacity:.4;cursor:default}
.bm-iconbtn svg{width:14px;height:14px}
/* ---- frosted-glass floating window ---- */
.bm-popover{position:fixed;z-index:50;display:flex;flex-direction:column;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 42%,transparent);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);border-radius:24px;box-shadow:0 18px 48px color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent);overflow:hidden}
.bm-pop-header{flex:none;display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);cursor:grab;user-select:none}
.bm-pop-header:active{cursor:grabbing}
.bm-popover[data-dragging],.bm-popover[data-resizing]{user-select:none}
.bm-popover[data-resizing]{pointer-events:none}
.bm-popover[data-resizing] .bm-pop-resize{pointer-events:auto}
.bm-pop-resize{position:absolute;right:3px;bottom:3px;width:22px;height:22px;cursor:nwse-resize;z-index:7;display:grid;place-items:end}
.bm-pop-resize::after{content:"";width:11px;height:11px;border-right:2.5px solid color-mix(in srgb,var(--dsw-alias-label-primary) 60%,transparent);border-bottom:2.5px solid color-mix(in srgb,var(--dsw-alias-label-primary) 60%,transparent);border-radius:2px}
.bm-pop-resize::before{content:"";position:absolute;right:6px;bottom:6px;width:7px;height:7px;border-right:2px solid color-mix(in srgb,var(--dsw-alias-label-primary) 35%,transparent);border-bottom:2px solid color-mix(in srgb,var(--dsw-alias-label-primary) 35%,transparent);border-radius:2px}
.bm-popover[data-size="narrow"] .bm-quota-grid{grid-template-columns:1fr}
.bm-popover[data-size="narrow"] .bm-big{font-size:24px}
.bm-popover[data-size="narrow"] .bm-model-chips{gap:4px}
.bm-popover[data-size="narrow"] .bm-model-chip{font-size:10px}
.bm-popover[data-size="narrow"] .bm-trend{font-size:9px;padding:3px 6px}
.bm-provider-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent)}
.bm-pop-select{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:500;outline:none;padding:2px 4px;cursor:pointer;border-radius:8px}
.bm-pop-select option{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3)}
.bm-pop-body{overflow-y:auto;flex:1;min-height:0;padding:14px;display:flex;flex-direction:column;gap:12px}
.bm-card{border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent);border-radius:18px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,transparent);padding:12px 14px;display:flex;flex-direction:column;gap:7px;min-width:0}
.bm-card-label{font-size:11px;color:var(--dsw-alias-label-secondary)}
.bm-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
.bm-card-meta{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.bm-card-meta-row{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:var(--dsw-alias-label-secondary)}
.bm-big{font-size:28px;font-weight:600;color:var(--dsw-alias-label-primary);letter-spacing:.01em;line-height:1.15}
.bm-big-mid{font-size:22px}
.bm-big[data-warn="true"]{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-quota-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bm-quota-grid>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.bm-quota-grid span{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.bm-quota-grid strong{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-quota-track{height:6px;border-radius:99px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);overflow:hidden}
.bm-quota-track>i{display:block;height:100%;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary));border-radius:99px}
.bm-model-chips{display:flex;flex-wrap:wrap;gap:6px}
.bm-model-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-secondary);padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 70%,transparent);white-space:nowrap}
.bm-model-chip>i,.bm-model-name>i{width:7px;height:7px;border-radius:50%;flex:none}
.bm-model-name{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--dsw-alias-label-primary);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-model-tag{font-size:9px;color:var(--dsw-alias-label-secondary);padding:2px 7px;border-radius:999px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);flex:none}
.bm-models{display:flex;flex-direction:column;gap:8px}
.bm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
.bm-row>span:first-child{color:var(--dsw-alias-label-secondary);font-size:11px;flex:none}
.bm-row>span:last-child{color:var(--dsw-alias-label-primary);font-size:12px;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* charts + heatmap */
.bm-chart{display:flex;align-items:flex-end;gap:6px;height:96px;padding-top:4px;position:relative}
.bm-chart-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end;position:relative}
.bm-chart-bar{width:100%;max-width:26px;border-radius:6px 6px 3px 3px;background:var(--dsw-alias-label-primary);opacity:.85;min-height:2px}
.bm-chart-bar[data-active="true"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-label-primary))}
.bm-chart-label{font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.bm-chart-value{font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.bm-stack{width:100%;max-width:26px;display:flex;flex-direction:column-reverse;border-radius:6px 6px 3px 3px;overflow:hidden;min-height:2px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.bm-stack>i{display:block;width:100%;min-height:2px}
.bm-legend{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:8px;position:static}
.bm-legend span{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--dsw-alias-label-secondary)}
.bm-legend i{width:7px;height:7px;border-radius:50%}
.bm-legend-col{flex-direction:column;gap:6px;flex:1;min-width:0}
.bm-legend-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
.bm-legend-name{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bm-legend-num{font-size:11px;color:var(--dsw-alias-label-primary);white-space:nowrap}
.bm-legend-num small{color:var(--dsw-alias-label-tertiary);margin-left:4px;font-size:10px}
.bm-donut-wrap{display:flex;align-items:center;gap:16px;min-width:0}
.bm-donut{width:132px;height:132px;flex:none}
.bm-donut-total{font-size:14px;font-weight:600;fill:var(--dsw-alias-label-primary)}
.bm-donut-sub{font-size:7px;fill:var(--dsw-alias-label-tertiary)}
.bm-heat{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.bm-heat-cell{aspect-ratio:1;border-radius:8px;display:grid;place-items:center;font-size:10px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);cursor:default;position:relative;overflow:visible}
.bm-heat-cell[data-spent="true"]{color:var(--dsw-alias-bg-layer-3)}
.bm-heat-cell[data-today="true"]{box-shadow:0 0 0 1px var(--dsw-alias-border-l1)}
.bm-heat-empty{visibility:hidden}
.bm-heat-cell[data-tip]:hover::after,.bm-chart-col[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:4px 9px;font-size:10px;white-space:nowrap;z-index:6;box-shadow:0 6px 16px color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);pointer-events:none}
.bm-heat-cell[data-side="left"]:hover::after{left:auto;right:-4px;transform:none}
.bm-months{display:flex;align-items:center;justify-content:space-between;gap:8px}
.bm-months>span{font-size:12px;color:var(--dsw-alias-label-primary);font-weight:500}
.bm-cal-title{font-size:12px;color:var(--dsw-alias-label-secondary);margin:2px 0 0}
.bm-list{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto}
.bm-list-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;min-width:0;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent)}
.bm-list-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bm-list-title{font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-list-sub{font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-list-cost{font-size:12px;color:var(--dsw-alias-label-primary);flex:none}
.bm-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);text-align:center;padding:12px 0}
.bm-note{font-size:10px;color:var(--dsw-alias-label-tertiary);line-height:16px}
.bm-progress-lg{height:6px;flex:none;width:100%;border-radius:99px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);overflow:hidden}
.bm-progress-lg>i{display:block;height:100%;background:var(--dsw-alias-label-primary);border-radius:99px}
.bm-progress-lg[data-warn="true"]>i{background:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}
.bm-progress-lg[data-critical="true"]>i{background:var(--dsw-alias-state-error-primary)}
.bm-spin{animation:bm-spin .8s linear infinite}
@keyframes bm-spin{to{transform:rotate(360deg)}}
/* ---- settings page (soft rounded) ---- */
.bm-settings{display:flex;flex-direction:column;gap:18px}
.bm-group{border:1px solid var(--dsw-alias-border-l2);border-radius:20px;background:var(--dsw-alias-bg-layer-2);padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.bm-group-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.bm-stats-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.bm-tabs{display:inline-flex;gap:4px;padding:3px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2)}
.bm-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;border-radius:999px;padding:3px 10px;cursor:pointer}
.bm-tab[data-active]{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.bm-stacked-card{min-height:150px;display:flex;align-items:flex-end}
.bm-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.bm-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.bm-field>label{font-size:11px;color:var(--dsw-alias-label-secondary)}
.bm-input,.bm-select{appearance:none;border:1px solid var(--dsw-alias-border-l2);height:36px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:12px;border-radius:12px;outline:none;padding:0 12px;min-width:0;width:100%}
.bm-input:focus-visible,.bm-select:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.bm-input:disabled,.bm-select:disabled{opacity:.45;cursor:default}
.bm-limit-card .bm-input,.bm-limit-card .bm-select{height:34px;font-size:12px}
/* session tree */
.bm-session-group{display:flex;flex-direction:column;gap:4px;min-width:0}
.bm-session-chevron{flex:none;width:14px;height:14px;color:var(--dsw-alias-label-tertiary);transition:transform .14s}
.bm-session-chevron[data-open]{transform:rotate(90deg)}
.bm-session-leaf{display:block}
.bm-session-children{display:flex;flex-direction:column;gap:4px;margin-left:16px;padding-left:8px;border-left:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent)}
.bm-session-detail{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 60%,transparent);margin-left:24px}
.bm-session-detail-row{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.bm-session-detail-row span:last-child{color:var(--dsw-alias-label-primary)}
.bm-session-chips{display:flex;flex-wrap:wrap;gap:5px}
.bm-session-chips span{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--dsw-alias-label-secondary);padding:2px 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 70%,transparent)}
.bm-session-chips i{width:6px;height:6px;border-radius:50%}
/* model filter chips */
.bm-model-filter{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.bm-filter-chip{appearance:none;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;border-radius:999px;padding:4px 9px;cursor:pointer;opacity:.6}
.bm-filter-chip>i{width:6px;height:6px;border-radius:50%}
.bm-filter-chip[data-on]{color:var(--dsw-alias-label-primary);opacity:1;border-color:var(--dsw-alias-border-l1)}
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
.bm-advanced{border:1px solid var(--dsw-alias-border-l2);border-radius:20px;background:var(--dsw-alias-bg-layer-2);padding:0 16px;overflow:hidden}
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
.bm-save-hint[data-error]{color:var(--dsw-alias-state-error-primary)}
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
