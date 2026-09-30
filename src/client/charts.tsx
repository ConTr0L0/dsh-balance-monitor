/**
 * Chart components for dsh-balance-monitor: month heatmap with hover tips,
 * per-model stacked daily bars, and a model-usage donut. Dependency-free and
 * theme-adaptive via CSS variables.
 */
import type { CSSProperties, ReactNode } from "react";
import { t as i18n } from "./locales";
import type { DayStat, ModelStat } from "./api";

/** Format a CNY amount compactly (0.0234 → "0.023"; 1234 → "1,234"). */
export function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1000) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}

/** Compact token counts using the requested Chinese units. */
export function fmtTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  for (const [scale, unit] of [[100_000_000, "亿"], [10_000_000, "千万"], [1_000_000, "百万"], [10_000, "万"], [100, "百"]] as const) {
    if (value >= scale) return String(Number((value / scale).toFixed(2))) + unit;
  }
  return String(Math.round(value));
}

/** Compact chart labels use standard Latin suffixes; heatmap tips keep Chinese units. */
function fmtChartTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  for (const [scale, unit] of [[1_000_000_000, "B"], [1_000_000, "M"], [1_000, "K"]] as const) {
    if (value >= scale) return String(Number((value / scale).toFixed(2))) + unit;
  }
  return String(Math.round(value));
}

/** Deterministic per-model color (stable hash → palette). */
const MODEL_COLORS = ["#4D6BFE", "#8B5CF6", "#06B6D4", "#F59E0B", "#EC4899", "#10B981", "#94A3B8", "#F97316", "#14B8A6", "#A855F7"];
export function modelColor(model: string): string {
  let hash = 0;
  for (let i = 0; i < model.length; i += 1) hash = (hash * 31 + model.charCodeAt(i)) >>> 0;
  return MODEL_COLORS[hash % MODEL_COLORS.length];
}

/**
 * Token totals as reported by the official dashboard: cache-hit input +
 * uncached input + output (the platform's "Tokens" card sums all three
 * component columns).
 */
export function modelTokens(stat: ModelStat | undefined): number {
  if (!stat) return 0;
  return (stat.input ?? 0) + (stat.cacheRead ?? 0) + (stat.output ?? 0);
}

function dayLabel(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Last-N-days cost bar chart.
 */
export function BarChart({ daily, days = 7 }: { daily: Record<string, DayStat>; days?: number }) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  const buckets: { key: string; label: string; cost: number; isToday: boolean }[] = [];
  let max = 0;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKeyOf(date);
    const cost = daily[key]?.cost ?? 0;
    max = Math.max(max, cost);
    buckets.push({ key, label: dayLabel(date), cost, isToday: i === days - 1 });
  }
  return (
    <div className="bm-chart">
      {buckets.map((bucket) => {
        const ratio = max > 0 ? bucket.cost / max : 0;
        const heightPct = ratio <= 0 ? 2 : Math.max(6, ratio * 100);
        return (
          <div className="bm-chart-col" key={bucket.key} data-tip={`${bucket.label}  ¥${fmtMoney(bucket.cost)}`}>
            <span className="bm-chart-value">{bucket.cost > 0 ? fmtMoney(bucket.cost) : ""}</span>
            <span className="bm-chart-bar" data-active={bucket.isToday || undefined} style={{ height: `${heightPct}%` }} />
            <span className="bm-chart-label">{bucket.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Short ranges end today in the current month, or at the selected month end. */
export function heatmapRange(year: number, month: number, months = 1, days?: 30 | 90) {
  const now = new Date();
  const end = days && year === now.getFullYear() && month === now.getMonth()
    ? new Date(year, month, now.getDate())
    : new Date(year, month + 1, 0);
  const first = days
    ? new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1)
    : new Date(year, month - months + 1, 1);
  return { first, end };
}

/** Calendar activity grid: weekdays run vertically, weeks horizontally. */
export function MonthHeatmap({ daily, year, month, months = 1, days }: {
  daily: Record<string, DayStat>;
  year: number;
  month: number;
  months?: number;
  days?: 30 | 90;
}) {
  const { first, end } = heatmapRange(year, month, months, days);
  const rows = days ? days / 30 : 7;
  const start = days ? first : new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
  const labelMonths = (end.getFullYear() - first.getFullYear()) * 12 + end.getMonth() - first.getMonth() + 1;
  const dates: Date[] = [];
  // Advance by calendar days so daylight-saving changes cannot shift cells.
  for (let i = 0; ; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (date > end && (days || i % 7 === 0)) break;
    dates.push(date);
  }
  const weeks = dates.length / rows;
  const todayKey = dayKeyOf(new Date());
  const inRange = dates.filter(date => date >= first && date <= end);
  const maxCost = Math.max(0, ...inRange.map(date => daily[dayKeyOf(date)]?.cost ?? 0));
  const cells: ReactNode[] = dates.map((date, index) => {
    const key = dayKeyOf(date);
    if (date < first || date > end) return <span className="bm-heat-cell bm-heat-empty" key={key} />;
    const entry = daily[key];
    const cost = entry?.cost ?? 0;
    const tokens = Object.values(entry?.models ?? {}).reduce((sum, stat) => sum + modelTokens(stat), 0);
    const unpriced = cost <= 0 && tokens > 0;
    const tip = key + " · " + i18n("consumption") + " " + (unpriced ? i18n("unpriced") : "¥" + fmtMoney(cost)) + " · Token " + fmtTokens(tokens);
    return (
      <span className="bm-heat-cell" key={key}
        data-spent={cost > 0 || undefined}
        data-today={key === todayKey || undefined}
        data-side={Math.floor(index / rows) >= weeks / 2 ? "left" : undefined}
        data-tip={tip} aria-label={tip} tabIndex={0}
        style={cost > 0 ? { background: "color-mix(in srgb, var(--bm-heat-accent, #008cff) " + Math.round(25 + cost / maxCost * 75) + "%, var(--dsw-alias-bg-layer-3))" } : undefined}
      />
    );
  });
  return (
    <div className="bm-heat-scroll" data-year={!days && months > 1 || undefined} data-days={days}>
      <div className="bm-heat-wrap" style={{ "--bm-heat-weeks": weeks, "--bm-heat-rows": rows } as CSSProperties}>
        <div className="bm-heat">{cells}</div>
        <div className="bm-heat-months">
          {Array.from({ length: labelMonths }, (_, index) => {
            const date = index === 0 ? first : new Date(first.getFullYear(), first.getMonth() + index, 1);
            const column = Math.floor(dates.findIndex(day => dayKeyOf(day) === dayKeyOf(date)) / rows) + 1;
            return <span key={dayKeyOf(date)} style={{ gridColumn: column }} title={dayKeyOf(date).slice(0, 7)}>{i18n("heatMonth", { n: date.getMonth() + 1 })}</span>;
          })}
        </div>
      </div>
    </div>
  );
}

/** Daily model stacks with a matching token axis and cache-hit-rate line. */
export function StackedBarChart({ daily, days, visibleModels }: {
  daily: Record<string, DayStat>;
  days: number;
  visibleModels?: string[];
}) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  const modelIds = [...new Set(Object.values(daily).flatMap(entry => Object.keys(entry.models ?? {})))]
    .filter(id => visibleModels === undefined || visibleModels.includes(id));
  const buckets: { key: string; label: string; values: number[]; total: number; rate: number | null }[] = [];
  let max = 0;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKeyOf(date);
    const entry = daily[key];
    const values = modelIds.map(id => modelTokens(entry?.models?.[id]));
    const total = values.reduce((sum, value) => sum + value, 0);
    const cached = modelIds.reduce((sum, id) => sum + (entry?.models?.[id]?.cacheRead ?? 0), 0);
    max = Math.max(max, total);
    buckets.push({ key, label: dayLabel(date), values, total, rate: total > 0 ? Math.min(1, cached / total) : null });
  }
  const labelEvery = days > 14 ? 3 : 1;
  const labelAnchor = (days - 1) % labelEvery;
  const linePath = buckets.reduce((path, bucket, index) => {
    if (bucket.rate === null) return path;
    const point = (index * 100 + 50) + "," + (100 - bucket.rate * 100);
    return path + (path.endsWith("M") || !path ? "M" : " L") + point;
  }, "");
  const ticks = [1, 0.75, 0.5, 0.25, 0].map(fraction => ({ fraction, tokens: max * fraction }));
  return (
    <div className="bm-stacked-chart">
      <div className="bm-stacked-main">
        <div className="bm-stacked-axis bm-stacked-axis-left">
          {ticks.map(tick => <span key={tick.fraction}>{fmtChartTokens(tick.tokens)}</span>)}
        </div>
        <div className="bm-stacked-plot">
          <svg className="bm-stacked-overlay" viewBox={`0 0 ${days * 100} 100`} preserveAspectRatio="none" aria-hidden="true">
            {[0, 25, 50, 75, 100].map(y => <line key={y} x1="0" y1={y} x2={days * 100} y2={y} className="bm-chart-gridline" />)}
            {linePath && <path d={linePath} className="bm-cache-line" />}
          </svg>
          <div className="bm-chart bm-stacked">
            {buckets.map((bucket, index) => {
              const height = max > 0 ? bucket.total / max * 100 : 0;
              return (
                <div className="bm-chart-col" key={bucket.key} data-tip={`${bucket.key} · ${fmtChartTokens(bucket.total)} tokens · ${i18n("cacheHitRate")} ${bucket.rate === null ? "—" : Math.round(bucket.rate * 100) + "%"}`}>
                  <div className="bm-stack-area">
                    {bucket.total > 0 && <span className="bm-stack" style={{ height: `${height}%` }}>
                      {bucket.values.map((value, modelIndex) => value > 0 ? <i key={modelIds[modelIndex]} style={{ height: `${value / bucket.total * 100}%`, background: modelColor(modelIds[modelIndex]) }} /> : null)}
                    </span>}
                    {days <= 14 && bucket.total > 0 && <span className="bm-chart-value" style={{ bottom: `calc(${height}% + 3px)` }}>{fmtChartTokens(bucket.total)}</span>}
                  </div>
                  <span className="bm-chart-label">{index % labelEvery === labelAnchor ? bucket.label : " "}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bm-stacked-axis bm-stacked-axis-right">
          {[100, 75, 50, 25, 0].map((value, index) => <span key={value}>{value}%</span>)}
        </div>
      </div>
      <div className="bm-legend bm-stacked-legend">
        {modelIds.map(id => <span key={id}><i style={{ background: modelColor(id) }} />{id}</span>)}
        <span><i className="bm-cache-key" />{i18n("cacheHitRate")}</span>
      </div>
    </div>
  );
}

/**
 * All-time model-usage donut with legend (tokens + share).
 * @param visibleModels - optional model-id whitelist (empty = all).
 */
export function DonutChart({ models, visibleModels }: { models: Record<string, ModelStat>; visibleModels?: string[] }) {
  const rows = Object.entries(models)
    .map(([id, stat]) => ({ id, tokens: modelTokens(stat), cost: stat.cost }))
    .filter((row) => row.tokens > 0)
    .filter((row) => visibleModels === undefined || visibleModels.length === 0 || visibleModels.includes(row.id))
    .sort((a, b) => b.tokens - a.tokens);
  const total = rows.reduce((sum, row) => sum + row.tokens, 0);
  if (total <= 0 || rows.length === 0) {
    return <div className="bm-empty">暂无数据</div>;
  }
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segments = rows.map((row) => {
    const length = (row.tokens / total) * C;
    const seg = { id: row.id, length, offset, color: modelColor(row.id) };
    offset += length;
    return seg;
  });
  return (
    <div className="bm-donut-wrap">
      <svg className="bm-donut" viewBox="0 0 100 100" role="img">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--dsw-alias-bg-layer-2)" strokeWidth="12" />
        {segments.map((seg) => (
          <circle
            key={seg.id}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={`${seg.length} ${C - seg.length}`}
            strokeDashoffset={-seg.offset}
          />
        ))}
        <text x="50" y="48" textAnchor="middle" className="bm-donut-total">{fmtTokens(total)}</text>
        <text x="50" y="60" textAnchor="middle" className="bm-donut-sub">tokens</text>
      </svg>
      <div className="bm-legend bm-legend-col">
        {rows.map((row) => (
          <div className="bm-legend-row" key={row.id}>
            <span className="bm-legend-name"><i style={{ background: modelColor(row.id) }} />{row.id}</span>
            <span className="bm-legend-num">{fmtTokens(row.tokens)} <small>{total > 0 ? ((row.tokens / total) * 100).toFixed(1) : 0}%</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}
