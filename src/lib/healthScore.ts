import type { Anomaly, KPIData, MonthlyData, Transaction } from '@/types';
import { totalLeakAmount } from '@/lib/anomalyDetector';

export interface HealthComponent {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
}

export interface HealthScore {
  score: number;
  grade: 'Excellent' | 'Healthy' | 'Watch' | 'At risk';
  components: HealthComponent[];
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const lerp = (v: number, a: number, b: number) => clamp(((v - a) / (b - a)) * 100);

export function computeHealthScore(
  transactions: Transaction[],
  monthly: MonthlyData[],
  anomalies: Anomaly[],
  kpis: KPIData
): HealthScore {
  const full = monthly.filter((m) => !m.partial);
  const recent = (full.length ? full : monthly).slice(-3);
  const revenue = recent.reduce((s, m) => s + m.revenue, 0);
  const expenses = recent.reduce((s, m) => s + m.expenses, 0);

  // 1. runway
  const runwayScore = kpis.projectedRunwayDays >= 9999 ? 100 : lerp(kpis.projectedRunwayDays, 30, 365);
  const runwayDetail = kpis.projectedRunwayDays >= 9999 ? 'Cash flow positive — no burn' : `${kpis.projectedRunwayDays} days of runway`;

  // 2. profitability
  const margin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : expenses > 0 ? -100 : 0;
  const marginScore = lerp(margin, -30, 20);

  // 3. revenue trend
  let trendScore = 50;
  let trendDetail = 'Not enough history';
  if (full.length >= 2) {
    const last = full[full.length - 1].revenue;
    const priorSlice = full.slice(Math.max(0, full.length - 4), full.length - 1);
    const prior = priorSlice.reduce((s, m) => s + m.revenue, 0) / priorSlice.length;
    if (prior > 0) {
      const growth = ((last - prior) / prior) * 100;
      trendScore = lerp(growth, -20, 10);
      trendDetail = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs prior months`;
    }
  }

  // 4. leakage
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const leakRatio = totalExpenses > 0 ? (totalLeakAmount(anomalies) / totalExpenses) * 100 : 0;
  const leakScore = 100 - lerp(leakRatio, 0, 5);

  // 5. customer concentration
  const byClient = new Map<string, number>();
  let totalRevenue = 0;
  for (const t of transactions) {
    if (t.type !== 'income') continue;
    byClient.set(t.vendor, (byClient.get(t.vendor) ?? 0) + t.amount);
    totalRevenue += t.amount;
  }
  const topShare = totalRevenue > 0 ? (Math.max(...byClient.values()) / totalRevenue) * 100 : null;
  const concScore = topShare === null ? 50 : 100 - lerp(topShare, 20, 60);

  const components: HealthComponent[] = [
    { key: 'runway', label: 'Cash runway', score: runwayScore, weight: 0.3, detail: runwayDetail },
    { key: 'margin', label: 'Profitability', score: marginScore, weight: 0.25, detail: `${margin.toFixed(1)}% net margin (last ${recent.length || 0} mo)` },
    { key: 'trend', label: 'Revenue momentum', score: trendScore, weight: 0.15, detail: trendDetail },
    { key: 'leaks', label: 'Spend hygiene', score: leakScore, weight: 0.15, detail: `${leakRatio.toFixed(1)}% of expenses flagged as leaks` },
    {
      key: 'concentration',
      label: 'Revenue diversification',
      score: concScore,
      weight: 0.15,
      detail: topShare === null ? 'No revenue data' : `Top client = ${topShare.toFixed(0)}% of revenue`,
    },
  ].map((c) => ({ ...c, score: Math.round(c.score) }));

  const score = monthly.length === 0 ? 0 : Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));
  const grade = score >= 80 ? 'Excellent' : score >= 60 ? 'Healthy' : score >= 40 ? 'Watch' : 'At risk';
  return { score, grade, components };
}
