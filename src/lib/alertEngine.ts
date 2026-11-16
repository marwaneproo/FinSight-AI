import type { CustomAlertRule, KPIData, MonthlyData, Transaction } from '@/types';
import { formatCurrency } from '@/lib/cashFlowEngine';

export interface TriggeredAlert {
  ruleId: string;
  severity: 'high' | 'medium';
  title: string;
  detail: string;
}

export const ALERT_KIND_LABEL: Record<CustomAlertRule['kind'], string> = {
  category_monthly_cap: 'Category monthly spend cap',
  single_transaction_cap: 'Single transaction cap',
  min_cash_balance: 'Minimum cash balance',
  min_runway_days: 'Minimum runway (days)',
};

export function describeRule(r: CustomAlertRule): string {
  switch (r.kind) {
    case 'category_monthly_cap':
      return `Alert when "${r.category || 'any category'}" spend in a month exceeds ${formatCurrency(r.threshold)}`;
    case 'single_transaction_cap':
      return `Alert when any single expense exceeds ${formatCurrency(r.threshold)}`;
    case 'min_cash_balance':
      return `Alert when cash balance falls below ${formatCurrency(r.threshold)}`;
    case 'min_runway_days':
      return `Alert when runway drops below ${r.threshold} days`;
  }
}

export function evaluateAlerts(
  rules: CustomAlertRule[],
  transactions: Transaction[],
  monthly: MonthlyData[],
  kpis: KPIData
): TriggeredAlert[] {
  const out: TriggeredAlert[] = [];
  const expenses = transactions.filter((t) => t.type === 'expense');
  const latest = monthly[monthly.length - 1];

  for (const r of rules) {
    if (!r.enabled || monthly.length === 0) continue;

    if (r.kind === 'category_monthly_cap' && latest) {
      const wanted = (r.category ?? '').trim().toLowerCase();
      const byCategory = new Map<string, number>();
      for (const t of expenses) {
        if (t.date.slice(0, 7) !== latest.monthKey) continue;
        if (wanted && t.category.toLowerCase() !== wanted) continue;
        byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
      }
      for (const [cat, total] of byCategory) {
        if (total > r.threshold) {
          out.push({
            ruleId: r.id,
            severity: total > r.threshold * 1.25 ? 'high' : 'medium',
            title: `${cat} spend over cap`,
            detail: `${formatCurrency(total)} in ${latest.month} vs a cap of ${formatCurrency(r.threshold)} (+${formatCurrency(total - r.threshold)}).`,
          });
        }
      }
    }

    if (r.kind === 'single_transaction_cap') {
      const over = expenses.filter((t) => t.amount > r.threshold).sort((a, b) => b.amount - a.amount);
      if (over.length > 0) {
        out.push({
          ruleId: r.id,
          severity: 'medium',
          title: `${over.length} expense${over.length === 1 ? '' : 's'} above ${formatCurrency(r.threshold)}`,
          detail: `Largest: ${over[0].vendor} — ${formatCurrency(over[0].amount)} on ${over[0].date}.`,
        });
      }
    }

    if (r.kind === 'min_cash_balance' && kpis.netCashBalance < r.threshold) {
      out.push({
        ruleId: r.id,
        severity: 'high',
        title: 'Cash balance below minimum',
        detail: `Balance is ${formatCurrency(kpis.netCashBalance)}, ${formatCurrency(r.threshold - kpis.netCashBalance)} under your ${formatCurrency(r.threshold)} floor.`,
      });
    }

    if (r.kind === 'min_runway_days' && kpis.projectedRunwayDays < r.threshold) {
      out.push({
        ruleId: r.id,
        severity: 'high',
        title: 'Runway below minimum',
        detail: `Projected runway is ${kpis.projectedRunwayDays} days, under your ${r.threshold}-day threshold.`,
      });
    }
  }
  return out;
}
