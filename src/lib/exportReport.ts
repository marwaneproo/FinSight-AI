import type { Anomaly, KPIData, MonthlyData, Transaction } from '@/types';
import { groupTotals } from '@/lib/cashFlowEngine';
import { csvSafe, downloadCSV } from '@/lib/csvExport';
import type { HealthScore } from '@/lib/healthScore';

export interface VatLine { month: string; vatCollected: number; vatDeductible: number; vatPayable: number }

/** Amounts are treated as VAT-inclusive (gross). */
export function computeVat(transactions: Transaction[], ratePct: number): { lines: VatLine[]; collected: number; deductible: number; payable: number } {
  const r = ratePct / 100;
  const by = new Map<string, { c: number; d: number }>();
  for (const t of transactions) {
    const mk = t.date.slice(0, 7);
    const vat = t.amount - t.amount / (1 + r);
    const cur = by.get(mk) ?? { c: 0, d: 0 };
    if (t.type === 'income') cur.c += vat; else cur.d += vat;
    by.set(mk, cur);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const lines = [...by.entries()].sort().map(([month, v]) => ({ month, vatCollected: round(v.c), vatDeductible: round(v.d), vatPayable: round(v.c - v.d) }));
  const collected = round(lines.reduce((s, l) => s + l.vatCollected, 0));
  const deductible = round(lines.reduce((s, l) => s + l.vatDeductible, 0));
  return { lines, collected, deductible, payable: round(collected - deductible) };
}

export async function exportExcelReport(o: { datasetName: string; transactions: Transaction[]; monthly: MonthlyData[]; anomalies: Anomaly[]; kpis: KPIData; health: HealthScore; vatRate?: number }): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: 'no data' }]), name);

  add('Summary', [
    { Metric: 'Dataset', Value: o.datasetName },
    { Metric: 'Generated', Value: new Date().toISOString().slice(0, 10) },
    { Metric: 'Net cash balance', Value: o.kpis.netCashBalance },
    { Metric: 'Monthly burn (gross)', Value: o.kpis.monthlyBurnRate },
    { Metric: 'Net burn', Value: o.kpis.netBurnRate },
    { Metric: 'Runway (days)', Value: o.kpis.projectedRunwayDays >= 9999 ? 'Unlimited' : o.kpis.projectedRunwayDays },
    { Metric: 'Open leaks (USD)', Value: o.kpis.detectedLeaks },
    { Metric: 'Health score', Value: `${o.health.score} (${o.health.grade})` },
  ]);
  add('Monthly', o.monthly.map((m) => ({ Month: m.monthKey, Revenue: m.revenue, Expenses: m.expenses, Net: m.netCashFlow, 'Cash balance': m.cumulativeCash, Partial: m.partial ? 'yes' : '' })));
  add('Expenses by category', groupTotals(o.transactions, 'expense', 'category').map((s) => ({ Category: s.name, Total: Math.round(s.value * 100) / 100, Transactions: s.count })));
  add('Top vendors', groupTotals(o.transactions, 'expense', 'vendor').slice(0, 50).map((s) => ({ Vendor: s.name, Total: Math.round(s.value * 100) / 100, Transactions: s.count })));
  add('Anomalies', o.anomalies.map((a) => ({ Type: a.type, Severity: a.severity, Status: a.status, Title: a.title, Amount: Math.round(a.detectedAmount * 100) / 100, Detail: a.description, Action: a.suggestion })));
  add('Transactions', o.transactions.map((t) => ({ Date: t.date, Description: t.description, Vendor: t.vendor, Category: t.category, Type: t.type, Amount: t.amount })));
  if (o.vatRate !== undefined) {
    const v = computeVat(o.transactions, o.vatRate);
    add('VAT split', [...v.lines.map((l) => ({ Month: l.month, 'VAT collected': l.vatCollected, 'VAT deductible': l.vatDeductible, 'VAT payable': l.vatPayable })), { Month: `TOTAL @ ${o.vatRate}%`, 'VAT collected': v.collected, 'VAT deductible': v.deductible, 'VAT payable': v.payable }]);
  }
  XLSX.writeFile(wb, `FinSight_Board_Report_${o.datasetName.replace(/[^\w-]+/g, '_')}.xlsx`);
}

/** Generic double-entry journal that most ERPs / accounting packages can import. */
export function exportERPJournal(transactions: Transaction[], datasetName: string): void {
  const cats = [...new Set(transactions.filter((t) => t.type === 'expense').map((t) => t.category))].sort();
  const code = (t: Transaction) => (t.type === 'income' ? 4000 : 6000 + (cats.indexOf(t.category) + 1) * 10);
  const q = (s: string) => `"${csvSafe(s).replace(/"/g, '""')}"`;
  const rows: string[] = ['Date,Reference,Account Code,Account Name,Debit,Credit,Memo'];
  transactions.forEach((t, i) => {
    const ref = `FS-${String(i + 1).padStart(6, '0')}`;
    const acct = t.type === 'income' ? 'Sales Revenue' : `Expense - ${t.category}`;
    if (t.type === 'income') {
      rows.push(`${t.date},${ref},1000,Bank,${t.amount.toFixed(2)},0.00,${q(t.description)}`);
      rows.push(`${t.date},${ref},${code(t)},${q(acct)},0.00,${t.amount.toFixed(2)},${q(t.vendor)}`);
    } else {
      rows.push(`${t.date},${ref},${code(t)},${q(acct)},${t.amount.toFixed(2)},0.00,${q(`${t.vendor} — ${t.description}`)}`);
      rows.push(`${t.date},${ref},1000,Bank,0.00,${t.amount.toFixed(2)},${q(t.vendor)}`);
    }
  });
  downloadCSV(rows.join('\n'), `FinSight_ERP_Journal_${datasetName.replace(/[^\w-]+/g, '_')}.csv`);
}
