/**
 * Chart components for dsh-balance-monitor: month heatmap with hover tips,
 * per-model stacked daily bars, and a model-usage donut. Dependency-free and
 * theme-adaptive via CSS variables.
 */
import type { ReactNode } from "react";
import type { DayStat, ModelStat } from "./api";

/** Format a CNY amount compactly (0.0234 → "0.023"; 1234 → "1,234"). */
export function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1000) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}

/** Format a token count in 万/亿 (922774083 → "9.23亿"; 56638 → "5.7万"). */
export function fmtTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return Math.round(value).toLocaleString("en-US");
}

/** Deterministic per-model color (stable hash → palette). */
const MODEL_COLORS = ["#4D6BFE", "#8B5CF6", "#06B6D4", "#F59E0B", "#EC4899", "#10B981", "#94A3B8", "#F97316", "#14B8A6", "#A855F7"];
export function modelColor(model: string): string {
  let hash = 0;
  for (let i = 0; i < model.length; i += 1) hash = (hash * 31 + model.charCodeAt(i)) >>> 0;
  return MODEL_COLORS[hash % MODEL_COLORS.length];
}

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

/**
 * Monthly calendar heatmap. One cell per day; color intensity scales with
 * that day's cost relative to the month maximum; hover shows a tooltip.
 */
export function MonthHeatmap({
  daily,
  year,
  month,
}: {
  daily: Record<string, DayStat>;
  year: number;
  month: number;
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  let max = 0;
  for (const key of Object.keys(daily)) {
    if (key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)) max = Math.max(max, daily[key].cost);
  }

  const cells: ReactNode[] = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(<span className="bm-heat-cell bm-heat-empty" key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = dayKeyOf(date);
    const entry = daily[key];
    const cost = entry?.cost ?? 0;
    const ratio = max > 0 ? cost / max : 0;
    const isToday = isThisMonth && day === today.getDate();
    const column = (leading + day - 1) % 7;
    const style = cost > 0
      ? { background: `color-mix(in srgb, var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary)) ${Math.round(12 + ratio * 88)}%, transparent)` }
      : undefined;
    cells.push(
      <span
        className="bm-heat-cell"
        data-spent={cost > 0 || undefined}
        data-today={isToday || undefined}
        data-side={column >= 4 ? "left" : undefined}
        data-tip={`${key}  ¥${fmtMoney(cost)}${entry ? ` · ${entry.requests} req` : ""}`}
        key={key}
        style={style}
      >
        {day}
      </span>,
    );
  }
  return <div className="bm-heat">{cells}</div>;
}

/**
 * Per-day stacked token-usage bars (segments = models).
 * @param visibleModels - optional model-id whitelist (empty = all).
 */
export function StackedBarChart({
  daily,
  days,
  visibleModels,
}: {
  daily: Record<string, DayStat>;
  days: number;
  visibleModels?: string[];
}) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  const modelIdsSet = new Set<string>();
  for (const entry of Object.values(daily)) {
    for (const id of Object.keys(entry.models ?? {})) modelIdsSet.add(id);
  }
  const modelIds = [...modelIdsSet].filter((id) => visibleModels === undefined || visibleModels.includes(id));
  const buckets: { key: string; label: string; values: number[]; total: number }[] = [];
  let max = 0;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKeyOf(date);
    const entry = daily[key];
    const values = modelIds.map((id) => modelTokens(entry?.models?.[id]));
    const total = values.reduce((a, b) => a + b, 0);
    max = Math.max(max, total);
    buckets.push({ key, label: dayLabel(date), values, total });
  }
  return (
    <div className="bm-chart bm-stacked">
      {buckets.map((bucket) => (
        <div
          className="bm-chart-col"
          key={bucket.key}
          data-tip={`${bucket.label}  ${fmtTokens(bucket.total)} tokens`}
        >
          <span className="bm-chart-value">{bucket.total > 0 ? fmtTokens(bucket.total) : ""}</span>
          <span className="bm-stack" style={{ height: `${max > 0 ? Math.max(4, (bucket.total / max) * 100) : 2}%` }}>
            {bucket.values.map((value, index) =>
              value > 0 ? (
                <i
                  key={modelIds[index]}
                  style={{ height: `${(value / Math.max(1, bucket.total)) * 100}%`, background: modelColor(modelIds[index]) }}
                />
              ) : null,
            )}
          </span>
          <span className="bm-chart-label">{bucket.label}</span>
        </div>
      ))}
      {modelIds.length > 0 && (
        <div className="bm-legend">
          {modelIds.map((id) => (
            <span key={id}><i style={{ background: modelColor(id) }} />{id}</span>
          ))}
        </div>
      )}
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
