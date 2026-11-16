import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Download, FileSpreadsheet, FileText, Printer, Receipt } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import { FeatureGate } from '@/components/FeatureGate';
import { Logo } from '@/components/Logo';
import { HealthGauge } from '@/components/modules/Overview';
import { formatCurrency, formatCurrencyDetailed, formatRunway, groupTotals } from '@/lib/cashFlowEngine';
import { buildInsights } from '@/lib/insights';
import { computeVat, exportERPJournal, exportExcelReport } from '@/lib/exportReport';
import { exportAnomalyReportCSV } from '@/lib/csvExport';
import type { FeatureKey } from '@/lib/plans';

export function Reports() {
  const { activeDataset, transactions, analysis, settings, updateSettings, can, openUpgrade } = useWorkspace();
  const insights = useMemo(() => buildInsights(transactions, analysis.monthly, analysis.anomalies, analysis.kpis), [transactions, analysis]);
  const cats = useMemo(() => groupTotals(transactions, 'expense', 'category').slice(0, 8), [transactions]);
  const vendors = useMemo(() => groupTotals(transactions, 'expense', 'vendor').slice(0, 8), [transactions]);
  const vat = useMemo(() => computeVat(transactions, settings.vatRate), [transactions, settings.vatRate]);
  if (!activeDataset) return <EmptyWorkspace module="Executive Reports" />;

  const { kpis, monthly, health } = analysis;
  const gated = (f: FeatureKey, fn: () => void) => () => (can(f) ? fn() : openUpgrade({ feature: f }));
  const open = analysis.anomalies.filter((a) => a.status === 'flagged');
  const totalExp = cats.reduce((s, c) => s + c.value, 0);
  const period = `${activeDataset.dateFrom} → ${activeDataset.dateTo}`;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="no-print card p-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto"><h2 className="text-base font-bold text-navy-900">Executive Reports</h2><p className="text-xs text-navy-400">One-click board / accountant pack for {activeDataset.name}</p></div>
        <button className="btn-primary" onClick={gated('report_export', () => window.print())}><Printer className="h-4 w-4" />PDF report</button>
        <button className="btn-secondary" onClick={gated('report_export', () => exportExcelReport({ datasetName: activeDataset.name, transactions, monthly, anomalies: analysis.anomalies, kpis, health, vatRate: can('vat_split') ? settings.vatRate : undefined }))}><FileSpreadsheet className="h-4 w-4" />Excel workbook</button>
        <button className="btn-secondary" onClick={() => exportAnomalyReportCSV(analysis.anomalies, transactions)}><Download className="h-4 w-4" />Anomalies CSV</button>
        <button className="btn-secondary" onClick={gated('erp_export', () => exportERPJournal(transactions, activeDataset.name))}><FileText className="h-4 w-4" />ERP journal</button>
      </div>

      <div id="report" className="card p-8 rounded-2xl space-y-7 bg-white">
        <header className="flex items-start justify-between border-b border-navy-200 pb-5">
          <div><Logo size="sm" /><h1 className="text-2xl font-extrabold text-navy-900 mt-3">Executive Financial Report</h1><p className="text-sm text-navy-500">{activeDataset.name} · {period} · {activeDataset.rowCount.toLocaleString()} transactions</p></div>
          <p className="text-xs text-navy-400 text-right">Generated {new Date().toLocaleDateString()}<br />Source: {activeDataset.fileName}</p>
        </header>

        <section className="grid grid-cols-4 gap-4">
          {[['Net cash balance', formatCurrency(kpis.netCashBalance)], ['Monthly burn', formatCurrency(kpis.monthlyBurnRate)], ['Runway', kpis.projectedRunwayDays >= 9999 ? 'Unlimited' : formatRunway(kpis.projectedRunwayDays)], ['Open leaks', formatCurrency(kpis.detectedLeaks)]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-navy-200 p-4"><p className="text-[11px] uppercase tracking-wide text-navy-400 font-medium">{l}</p><p className="text-xl font-extrabold text-navy-900 mt-1">{v}</p></div>
          ))}
        </section>

        <section className="grid grid-cols-3 gap-6 items-center">
          <div><HealthGauge score={health.score} grade={health.grade} /><p className="text-center text-xs text-navy-400 mt-1">Financial health score</p></div>
          <div className="col-span-2"><h3 className="text-sm font-bold text-navy-900 mb-2">Key findings</h3><ul className="space-y-1.5 list-disc pl-4 text-sm text-navy-700">{insights.map((i, k) => <li key={k}>{i.text}</li>)}</ul></div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-navy-900 mb-2">Cash balance by month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} axisLine={false} tickLine={false} width={55} /><Area dataKey="cumulativeCash" stroke="#2563EB" fill="#DBEAFE" isAnimationActive={false} /></AreaChart>
          </ResponsiveContainer>
          <table className="w-full text-xs mt-3"><thead><tr className="text-navy-400 uppercase text-left"><th className="py-1">Month</th><th className="text-right">Revenue</th><th className="text-right">Expenses</th><th className="text-right">Net</th><th className="text-right">Cash</th></tr></thead>
            <tbody>{monthly.map((m) => <tr key={m.monthKey} className="border-t border-navy-100"><td className="py-1">{m.month}{m.partial ? ' (partial)' : ''}</td><td className="text-right">{formatCurrency(m.revenue)}</td><td className="text-right">{formatCurrency(m.expenses)}</td><td className={`text-right ${m.netCashFlow < 0 ? 'text-danger-600' : ''}`}>{formatCurrency(m.netCashFlow)}</td><td className="text-right font-semibold">{formatCurrency(m.cumulativeCash)}</td></tr>)}</tbody></table>
        </section>

        <section className="grid grid-cols-2 gap-6">
          <div><h3 className="text-sm font-bold text-navy-900 mb-2">Expenses by category</h3><table className="w-full text-xs"><tbody>{cats.map((c) => <tr key={c.name} className="border-t border-navy-100"><td className="py-1">{c.name}</td><td className="text-right">{formatCurrency(c.value)}</td><td className="text-right text-navy-400 w-12">{((c.value / totalExp) * 100).toFixed(0)}%</td></tr>)}</tbody></table></div>
          <div><h3 className="text-sm font-bold text-navy-900 mb-2">Top vendors</h3><table className="w-full text-xs"><tbody>{vendors.map((c) => <tr key={c.name} className="border-t border-navy-100"><td className="py-1">{c.name}</td><td className="text-right">{formatCurrency(c.value)}</td><td className="text-right text-navy-400 w-12">{c.count}×</td></tr>)}</tbody></table></div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-navy-900 mb-2">Open anomalies &amp; recommended actions</h3>
          {open.length === 0 ? <p className="text-sm text-navy-500">No open anomalies.</p> : (
            <table className="w-full text-xs"><thead><tr className="text-navy-400 uppercase text-left"><th className="py-1">Finding</th><th>Recommended action</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{open.slice(0, 10).map((a) => <tr key={a.id} className="border-t border-navy-100 align-top"><td className="py-1.5 pr-3 font-semibold">{a.title}</td><td className="pr-3 text-navy-600">{a.suggestion}</td><td className="text-right font-bold">{formatCurrencyDetailed(a.detectedAmount)}</td></tr>)}</tbody></table>
          )}
        </section>

        {can('vat_split') && (
          <section>
            <h3 className="text-sm font-bold text-navy-900 mb-2 flex items-center gap-2"><Receipt className="h-4 w-4" />VAT / tax split @ {settings.vatRate}% (amounts treated as VAT-inclusive)</h3>
            <p className="text-sm text-navy-700">Collected {formatCurrency(vat.collected)} · Deductible {formatCurrency(vat.deductible)} · <b>Net payable {formatCurrency(vat.payable)}</b></p>
          </section>
        )}
        <footer className="text-[10px] text-navy-400 border-t border-navy-100 pt-3">Prepared by FinSight AI from the uploaded file. Figures reflect the data provided and are not audited.</footer>
      </div>

      <div className="no-print">
        <FeatureGate feature="vat_split" description="Split VAT collected vs. deductible per month and include it in the board pack." compact>
          <div className="card p-5 rounded-2xl flex flex-wrap items-center gap-3"><Receipt className="h-5 w-5 text-brand-600" /><span className="text-sm font-semibold text-navy-800">VAT rate</span>
            <input type="number" min={0} max={50} step={0.5} className="input-field !w-24" value={settings.vatRate} onChange={(e) => updateSettings({ vatRate: Math.max(0, Math.min(50, Number(e.target.value))) })} /><span className="text-sm text-navy-500">% — report above updates live.</span></div>
        </FeatureGate>
      </div>
    </div>
  );
}
