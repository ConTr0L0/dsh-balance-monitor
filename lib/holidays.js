/**
 * Chinese statutory holidays for the peak/off-peak price rule.
 *
 * Official DeepSeek rule (pricing-page footnote, re-verified live 2026-09-20):
 * peak = Beijing Monday-Friday EXCLUDING Chinese statutory holidays,
 * 09:00-12:00 and 14:00-18:00; everything else - weekends, and statutory
 * holidays all day - is off-peak. A weekend the State Council turns into a
 * workday (调休上班) therefore stays off-peak: the rule keys on the calendar
 * weekend, never on the Chinese work roster.
 *
 * The arrangement is published once a year by the State Council; add the next
 * year to HOLIDAY_RANGES when it appears. An unknown year simply has no holiday
 * exemption (the host logs a warning at each pricing sync).
 *
 * Source: 国办发明电〔2025〕7号《国务院办公厅关于2026年部分节假日安排的通知》
 * (captured 2026-09-20) - 元旦 1/1-1/3, 春节 2/15-2/23, 清明 4/4-4/6,
 * 劳动节 5/1-5/5, 端午 6/19-6/21, 中秋 9/25-9/27, 国庆 10/1-10/7.
 *
 * @module dsh-balance-monitor/holidays
 */

/** Holiday ranges per year: [first day, day after the last], Beijing dates. */
const HOLIDAY_RANGES = {
  2026: [
    ["2026-01-01", "2026-01-04"], // 元旦 1/1-1/3（1/4 周日上班，仍按周末空闲）
    ["2026-02-15", "2026-02-24"], // 春节 2/15-2/23
    ["2026-04-04", "2026-04-07"], // 清明节 4/4-4/6
    ["2026-05-01", "2026-05-06"], // 劳动节 5/1-5/5
    ["2026-06-19", "2026-06-22"], // 端午节 6/19-6/21
    ["2026-09-25", "2026-09-28"], // 中秋节 9/25-9/27
    ["2026-10-01", "2026-10-08"], // 国庆节 10/1-10/7
  ],
};

/** Beijing-time calendar date ("YYYY-MM-DD") of an epoch-millis timestamp. */
function beijingDate(timeMs) {
  return new Date(timeMs + 8 * 3600_000).toISOString().slice(0, 10);
}

/** year -> Set of "YYYY-MM-DD" (expanded once, then cached). */
const daysCache = new Map();
function holidayDays(year) {
  if (daysCache.has(year)) return daysCache.get(year);
  const days = new Set();
  for (const [start, end] of HOLIDAY_RANGES[year] ?? []) {
    for (let t = Date.parse(start + "T00:00:00Z"); t < Date.parse(end + "T00:00:00Z"); t += 86_400_000) {
      days.add(new Date(t).toISOString().slice(0, 10));
    }
  }
  daysCache.set(year, days);
  return days;
}

/** Whether a timestamp falls on a Chinese statutory holiday (Beijing date). */
export function isCnHoliday(timeMs) {
  const date = beijingDate(timeMs);
  return holidayDays(Number(date.slice(0, 4))).has(date);
}

/** Years with a known holiday arrangement (the host warns when one is missing). */
export function holidayYears() {
  return Object.keys(HOLIDAY_RANGES).map(Number);
}
