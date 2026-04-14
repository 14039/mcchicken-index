// ── McChicken Index ──────────────────────────────────────────────
// Historical McChicken prices (avg US, yearly) sourced from
// FinanceBuzz / VisualCapitalist analysis + extrapolation.

export const MCCHICKEN_YEARLY: Record<number, number> = {
  2014: 1.0,
  2015: 1.0,
  2016: 1.19,
  2017: 1.29,
  2018: 1.39,
  2019: 1.49,
  2020: 1.59,
  2021: 1.79,
  2022: 2.19,
  2023: 2.59,
  2024: 2.99,
  2025: 3.29,
  2026: 3.49,
};

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = ((h >>> 0) ^ (h >>> 16)) >>> 0;
  return (h % 10000) / 10000;
}

/** Get the McChicken Index value for a given date. */
export function getMcChickenPrice(date: Date): number {
  const year = date.getFullYear();
  const yearStart = MCCHICKEN_YEARLY[year] ?? 3.49;
  const yearEnd = MCCHICKEN_YEARLY[year + 1] ?? yearStart * 1.06;

  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / 86400000
  );
  const yearProgress = dayOfYear / 365;

  const basePrice = yearStart + (yearEnd - yearStart) * yearProgress;

  const seed = `mcchicken-${year}-${date.getMonth()}-${date.getDate()}`;
  const noise = (seededRandom(seed) - 0.5) * 0.05;

  return Math.round((basePrice * (1 + noise)) * 100) / 100;
}

/** Daily change from yesterday. */
export function getDailyChange(date: Date): {
  price: number;
  prevPrice: number;
  change: number;
  changePercent: number;
} {
  const price = getMcChickenPrice(date);
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const prevPrice = getMcChickenPrice(yesterday);
  const change = Math.round((price - prevPrice) * 100) / 100;
  const changePercent =
    Math.round(((price - prevPrice) / prevPrice) * 10000) / 100;

  return { price, prevPrice, change, changePercent };
}

/** Generate sparkline data for the last N days. */
export function getSparkline(endDate: Date, days: number = 30): number[] {
  const data: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    data.push(getMcChickenPrice(d));
  }
  return data;
}

/** YTD change. */
export function getYTDChange(date: Date): {
  startPrice: number;
  currentPrice: number;
  changePercent: number;
} {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const startPrice = getMcChickenPrice(startOfYear);
  const currentPrice = getMcChickenPrice(date);
  const changePercent =
    Math.round(((currentPrice - startPrice) / startPrice) * 10000) / 100;
  return { startPrice, currentPrice, changePercent };
}

/** Multi-year chart data. */
export function getYearlyChartData(): { year: number; price: number }[] {
  return Object.entries(MCCHICKEN_YEARLY).map(([year, price]) => ({
    year: parseInt(year),
    price,
  }));
}
