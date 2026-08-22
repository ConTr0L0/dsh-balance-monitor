/**
 * Pure SVG chart components for dsh-balance-monitor: a 7-day bar chart and a
 * monthly calendar heatmap. Both are dependency-free and theme-adaptive via
 * CSS variables.
 */
import type { ReactNode } from "react";

/** Format a CNY amount compactly (0.0234 → "0.023"; 1234 → "1,234"). */
export function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1000) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}

function dayLabel(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Last-N-days bar chart.
 * @param daily - daily cost map from the host.
 * @param days - number of days to show (default 7).
 */
export function BarChart({ daily, days = 7 }: { daily: Record<string, { cost: number; requests: number }>; days?: number }) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  const buckets: { key: string; label: string; cost: number; isToday: boolean }[] = [];
  let max = 0;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(date);
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
          <div className="bm-chart-col" key={bucket.key} title={`${bucket.label} ${fmtMoney(bucket.cost)}`}>
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
 * that day's cost relative to the month maximum.
 * @param daily - cost map.
 * @param year - calendar year.
 * @param month - 0-based calendar month.
 */
export function MonthHeatmap({
  daily,
  year,
  month,
}: {
  daily: Record<string, { cost: number; requests: number }>;
  year: number;
  month: number;
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // 0 = Sunday
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
    const key = dayKey(date);
    const entry = daily[key];
    const cost = entry?.cost ?? 0;
    const ratio = max > 0 ? cost / max : 0;
    const isToday = isThisMonth && day === today.getDate();
    const style = cost > 0
      ? { background: `color-mix(in srgb, var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary)) ${Math.round(12 + ratio * 88)}%, transparent)` }
      : undefined;
    cells.push(
      <span
        className="bm-heat-cell"
        data-spent={cost > 0 || undefined}
        data-today={isToday || undefined}
        key={key}
        style={style}
        title={`${key}  ${fmtMoney(cost)}${entry ? ` · ${entry.requests} req` : ""}`}
      >
        {day}
      </span>,
    );
  }
  return <div className="bm-heat">{cells}</div>;
}
