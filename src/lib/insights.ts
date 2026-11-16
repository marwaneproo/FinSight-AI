import type { Anomaly, KPIData, MonthlyData, Transaction } from '@/types';
import { formatCurrency, formatPct, formatRunway, groupTotals } from '@/lib/cashFlowEngine';

export interface Insight { tone: 'good' | 'warn' | 'bad' | 'info'; text: string }

export function buildInsights(transactions: Transaction[], monthly: MonthlyData[], anomalies: Anomaly[], kpis: KPIData): Insight[] {
  if (transactions.length === 0) return [];
  const out: Insight[] = [];
  const full = monthly.filter((m) => !m.partial);

  if (kpis.projectedRunwayDays >= 9999) out.push({ tone: 'good', text: `Cash-flow positive on a 3-month basis: balance ${formatCurrency(kpis.netCashBalance)} with no net burn.` });
  else if (kpis.projectedRunwayDays < 90) out.push({ tone: 'bad', text: `Runway is only ${kpis.projectedRunwayDays} days at a net burn of ${formatCurrency(kpis.netBurnRate)}/month — act now on revenue or costs.` });
  else out.push({ tone: 'warn', text: `Net burn of ${formatCurrency(kpis.netBurnRate)}/month gives ${formatRunway(kpis.projectedRunwayDays)} of runway from ${formatCurrency(kpis.netCashBalance)}.` });

  if (full.length >= 2) {
    const a = full[full.length - 2];
    const b = full[full.length - 1];
    if (a.revenue > 0) {
      const g = ((b.revenue - a.revenue) / a.revenue) * 100;
      out.push({ tone: g >= 0 ? 'good' : 'warn', text: `Revenue in ${b.month} was ${formatCurrency(b.revenue)} (${formatPct(g)} vs ${a.month}).` });
    }
    if (kpis.burnChangePct !== null && Math.abs(kpis.burnChangePct) >= 5)
      out.push({ tone: kpis.burnChangePct > 0 ? 'warn' : 'good', text: `Expenses ${kpis.burnChangePct > 0 ? 'rose' : 'fell'} ${Math.abs(kpis.burnChangePct).toFixed(1)}% month-over-month to ${formatCurrency(b.expenses)}.` });
  }

  const cats = groupTotals(transactions, 'expense', 'category');
  const totalExp = cats.reduce((s, c) => s + c.value, 0);
  if (cats[0] && totalExp > 0) out.push({ tone: 'info', text: `${cats[0].name} is your largest cost line at ${((cats[0].value / totalExp) * 100).toFixed(0)}% of all spending (${formatCurrency(cats[0].value)}).` });

  const clients = groupTotals(transactions, 'income', 'vendor');
  const totalRev = clients.reduce((s, c) => s + c.value, 0);
  if (clients[0] && totalRev > 0) {
    const share = (clients[0].value / totalRev) * 100;
    if (share > 40) out.push({ tone: 'warn', text: `${clients[0].name} accounts for ${share.toFixed(0)}% of revenue — concentration risk.` });
  }

  if (kpis.leakCount > 0) out.push({ tone: 'bad', text: `${kpis.leakCount} open leak${kpis.leakCount === 1 ? '' : 's'} worth ${formatCurrency(kpis.detectedLeaks)} are waiting for action (refund, dispute or renegotiation).` });
  else if (anomalies.length === 0) out.push({ tone: 'good', text: 'No duplicate charges, price hikes or unusual spending detected under your current rules.' });
  return out;
}
