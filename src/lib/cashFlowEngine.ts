import type {
  Anomaly,
  DailyProjectionPoint,
  ForecastPoint,
  KPIData,
  MonthlyData,
  ScenarioState,
  Transaction,
} from '@/types';
import { leakCountOf, totalLeakAmount } from '@/lib/anomalyDetector';

import {
  addDays,
  addMonths,
  getMonthKey,
  getMonthLabel,
  getPartialMonthKey,
  lastTransactionDate,
  shortDateLabel,
} from '@/lib/dateUtils';

export { addDays, addMonths, getMonthKey, getMonthLabel, getPartialMonthKey, lastTransactionDate, shortDateLabel };

/* ───────────── monthly aggregation ───────────── */

export function computeMonthlyData(transactions: Transaction[], openingBalance = 0): MonthlyData[] {
  if (transactions.length === 0) return [];
  const byMonth = new Map<string, { revenue: number; expenses: number }>();
  for (const t of transactions) {
    const mk = getMonthKey(t.date);
    const cur = byMonth.get(mk) ?? { revenue: 0, expenses: 0 };
    if (t.type === 'income') cur.revenue += t.amount;
    else cur.expenses += t.amount;
    byMonth.set(mk, cur);
  }
  const keys = [...byMonth.keys()].sort();
  const partialKey = getPartialMonthKey(transactions);

  // fill calendar gaps so charts and averages treat an empty month as zero activity
  const all: string[] = [];
  for (let k = keys[0]; k <= keys[keys.length - 1]; k = addMonths(k, 1)) all.push(k);

  let cumulative = openingBalance;
  return all.map((mk) => {
    const d = byMonth.get(mk) ?? { revenue: 0, expenses: 0 };
    const net = d.revenue - d.expenses;
    cumulative += net;
    return {
      month: getMonthLabel(mk),
      monthKey: mk,
      revenue: Math.round(d.revenue),
      expenses: Math.round(d.expenses),
      netCashFlow: Math.round(net),
      cumulativeCash: Math.round(cumulative),
      partial: mk === partialKey,
    };
  });
}

/* ───────────── baseline (what "business as usual" looks like) ───────────── */

export interface Baseline {
  avgRevenue: number;
  avgExpenses: number;
  marketingMonthly: number;
  /** estimated recurring leakage per month (detected leaks spread over the observed months) */
  leakMonthly: number;
  monthsUsed: number;
  basis: string;
}

const MARKETING_RE = /market|advert|\bads?\b|promo|campaign|seo|sponsor/i;

export function isMarketingCategory(category: string): boolean {
  return MARKETING_RE.test(category);
}

export function computeBaseline(transactions: Transaction[], monthly: MonthlyData[], anomalies: Anomaly[]): Baseline {
  const empty: Baseline = { avgRevenue: 0, avgExpenses: 0, marketingMonthly: 0, leakMonthly: 0, monthsUsed: 0, basis: 'no data' };
  if (monthly.length === 0) return empty;

  const full = monthly.filter((m) => !m.partial);
  let months: MonthlyData[];
  let scale = 1;
  let basis: string;
  if (full.length > 0) {
    months = full.slice(-3);
    basis = `last ${months.length} full month${months.length === 1 ? '' : 's'}`;
  } else {
    // a single partial month — extrapolate to 30 days using the days actually covered
    months = monthly;
    const last = lastTransactionDate(transactions);
    const day = last ? Math.max(1, Number(last.slice(8, 10))) : 30;
    scale = 30 / day;
    basis = `${day} days of data, extrapolated to a month`;
  }

  const keys = new Set(months.map((m) => m.monthKey));
  const avgRevenue = (months.reduce((s, m) => s + m.revenue, 0) / months.length) * scale;
  const avgExpenses = (months.reduce((s, m) => s + m.expenses, 0) / months.length) * scale;

  let marketing = 0;
  for (const t of transactions) {
    if (t.type === 'expense' && keys.has(getMonthKey(t.date)) && isMarketingCategory(t.category)) marketing += t.amount;
  }
  const marketingMonthly = (marketing / months.length) * scale;

  const observedMonths = Math.max(1, full.length || monthly.length);
  const leakMonthly = totalLeakAmount(anomalies) / observedMonths;

  return { avgRevenue, avgExpenses, marketingMonthly: Math.min(marketingMonthly, avgExpenses), leakMonthly, monthsUsed: months.length, basis };
}

/* ───────────── KPIs ───────────── */

function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function computeKPIs(
  transactions: Transaction[],
  monthly: MonthlyData[],
  anomalies: Anomaly[],
  openingBalance = 0
): KPIData {
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const netCashBalance = last ? last.cumulativeCash : openingBalance;
  const baseline = computeBaseline(transactions, monthly, anomalies);

  const netBurnRate = Math.max(0, baseline.avgExpenses - baseline.avgRevenue);
  let projectedRunwayDays: number;
  if (monthly.length === 0) projectedRunwayDays = 0;
  else if (netBurnRate === 0) projectedRunwayDays = 9999;
  else if (netCashBalance <= 0) projectedRunwayDays = 0;
  else projectedRunwayDays = Math.round((netCashBalance / netBurnRate) * 30);

  const full = monthly.filter((m) => !m.partial);
  const burnChangePct = full.length >= 2 ? pctChange(full[full.length - 1].expenses, full[full.length - 2].expenses) : null;

  return {
    netCashBalance: Math.round(netCashBalance),
    monthlyBurnRate: Math.round(baseline.avgExpenses),
    netBurnRate: Math.round(netBurnRate),
    projectedRunwayDays,
    detectedLeaks: Math.round(totalLeakAmount(anomalies)),
    leakCount: leakCountOf(anomalies),
    cashChangePct: last && prev ? pctChange(last.cumulativeCash, prev.cumulativeCash) : null,
    burnChangePct,
  };
}

/* ───────────── projection / scenarios ───────────── */

export const NEUTRAL_SCENARIO: ScenarioState = { revenueChange: 0, marketingChange: 0, costCut: 0, leakElimination: 0 };

export function monthlyRunRate(baseline: Baseline, s: ScenarioState): { revenue: number; expenses: number } {
  const marketing = baseline.marketingMonthly;
  const other = Math.max(0, baseline.avgExpenses - marketing);
  const revenue = baseline.avgRevenue * (1 + s.revenueChange / 100);
  const expenses = Math.max(
    0,
    other * (1 - s.costCut / 100) + marketing * (1 + s.marketingChange / 100) - baseline.leakMonthly * (s.leakElimination / 100)
  );
  return { revenue, expenses };
}

export interface ProjectionResult {
  daily: DailyProjectionPoint[];
  startBalance: number;
  startDate: string;
  baselineEnd: number;
  scenarioEnd: number;
  delta: number;
  baselineRate: { revenue: number; expenses: number };
  scenarioRate: { revenue: number; expenses: number };
  /** days until the scenario's cash hits zero within the horizon, or null if it never does */
  scenarioZeroDay: number | null;
  baselineZeroDay: number | null;
}

export function projectCash(args: {
  startBalance: number;
  startDate: string;
  baseline: Baseline;
  scenario: ScenarioState;
  days?: number;
}): ProjectionResult {
  const days = args.days ?? 90;
  const base = monthlyRunRate(args.baseline, NEUTRAL_SCENARIO);
  const scen = monthlyRunRate(args.baseline, args.scenario);
  const baseNetPerDay = (base.revenue - base.expenses) / 30;
  const scenNetPerDay = (scen.revenue - scen.expenses) / 30;

  const daily: DailyProjectionPoint[] = [];
  let baseZero: number | null = null;
  let scenZero: number | null = null;
  for (let d = 0; d <= days; d++) {
    const baseline = args.startBalance + baseNetPerDay * d;
    const scenario = args.startBalance + scenNetPerDay * d;
    if (baseZero === null && baseline <= 0) baseZero = d;
    if (scenZero === null && scenario <= 0) scenZero = d;
    const date = addDays(args.startDate, d);
    daily.push({ day: d, date, label: shortDateLabel(date), baseline: Math.round(baseline), scenario: Math.round(scenario) });
  }
  const end = daily[daily.length - 1];
  return {
    daily,
    startBalance: args.startBalance,
    startDate: args.startDate,
    baselineEnd: end.baseline,
    scenarioEnd: end.scenario,
    delta: end.scenario - end.baseline,
    baselineRate: base,
    scenarioRate: scen,
    scenarioZeroDay: scenZero,
    baselineZeroDay: baseZero,
  };
}

/** Historical monthly points followed by 30/60/90-day forecast points (30 only when `horizonDays` = 30). */
export function generateForecast(
  transactions: Transaction[],
  monthly: MonthlyData[],
  anomalies: Anomaly[],
  scenario: ScenarioState,
  openingBalance = 0,
  horizonDays = 90
): ForecastPoint[] {
  if (monthly.length === 0) return [];
  const historical: ForecastPoint[] = monthly.map((m) => ({ ...m, isForecast: false }));
  const startDate = lastTransactionDate(transactions);
  if (!startDate) return historical;

  const last = monthly[monthly.length - 1];
  const baseline = computeBaseline(transactions, monthly, anomalies);
  const proj = projectCash({
    startBalance: last.cumulativeCash ?? openingBalance,
    startDate,
    baseline,
    scenario,
    days: horizonDays,
  });
  const rate = proj.scenarioRate;

  const blocks: ForecastPoint[] = [];
  for (let day = 30; day <= horizonDays; day += 30) {
    const p = proj.daily[day];
    blocks.push({
      month: `+${day}d`,
      monthKey: p.date.slice(0, 7),
      revenue: Math.round(rate.revenue),
      expenses: Math.round(rate.expenses),
      netCashFlow: Math.round(rate.revenue - rate.expenses),
      cumulativeCash: p.scenario,
      isForecast: true,
    });
  }
  return [...historical, ...blocks];
}

/* ───────────── breakdown helpers shared by analytics, reports, copilot ───────────── */

export interface Slice {
  name: string;
  value: number;
  count: number;
}

export function groupTotals(transactions: Transaction[], type: 'income' | 'expense', key: 'category' | 'vendor'): Slice[] {
  const map = new Map<string, Slice>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    const name = t[key] || 'Unknown';
    const cur = map.get(name) ?? { name, value: 0, count: 0 };
    cur.value += t.amount;
    cur.count += 1;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/* ───────────── formatting ───────────── */

export function formatCurrency(amount: number, compact = false): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (compact && abs >= 1000) {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    return `${sign}$${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs)}`;
}

export function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Human runway: avoids absurd figures like "4805 days" when burn is negligible. */
export function formatRunway(days: number): string {
  if (days >= 9999) return '∞';
  if (days > 1825) return '5+ years';
  if (days > 365) return `${(days / 365).toFixed(1)} yrs`;
  return `${days} days`;
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}
