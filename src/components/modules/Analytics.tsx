import { useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWorkspace } from '@/hooks/useWorkspace';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import { FeatureGate } from '@/components/FeatureGate';
import { CHART_COLORS } from '@/components/modules/Overview';
import { formatCurrency, groupTotals } from '@/lib/cashFlowEngine';

const axis = { fontSize: 11, fill: '#94A3B8' };
const money = (v: number) => formatCurrency(v, true);

function ChartCard({ title, sub, children, className = '' }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card p-5 rounded-2xl ${className}`}>
      <h3 className="text-sm font-bold text-navy-900">{title}</h3>
      {sub && <p className="text-xs text-navy-400 mb-3">{sub}</p>}
      <div className={sub ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

const PERIODS = [{ k: 0, l: 'All time' }, { k: 3, l: 'Last 3 months' }, { k: 6, l: 'Last 6 months' }, { k: 12, l: 'Last 12 months' }];

export function Analytics() {
  const { transactions, analysis, activeDataset } = useWorkspace();
  const [period, setPeriod] = useState(0);

  const monthly = useMemo(() => (period ? analysis.monthly.slice(-period) : analysis.monthly), [analysis.monthly, period]);
  const keys = useMemo(() => new Set(monthly.map((m) => m.monthKey)), [monthly]);
  const tx = useMemo(() => transactions.filter((t) => keys.has(t.date.slice(0, 7))), [transactions, keys]);

  const cats = useMemo(() => groupTotals(tx, 'expense', 'category'), [tx]);
  const vendors = useMemo(() => groupTotals(tx, 'expense', 'vendor').slice(0, 10), [tx]);
  const clients = useMemo(() => groupTotals(tx, 'income', 'vendor').slice(0, 8), [tx]);
  const topCats = cats.slice(0, 5).map((c) => c.name);
  const stacked = useMemo(
    () => monthly.map((m) => {
      const row: Record<string, number | string> = { month: m.month };
      let other = 0;
      for (const t of tx) {
        if (t.type !== 'expense' || t.date.slice(0, 7) !== m.monthKey) continue;
        if (topCats.includes(t.category)) row[t.category] = ((row[t.category] as number) ?? 0) + t.amount;
        else other += t.amount;
      }
      row.Other = other;
      return row;
    }),
    [monthly, tx, topCats.join('|')] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const weekdays = useMemo(() => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sums = new Array(7).fill(0) as number[];
    for (const t of tx) {
      if (t.type !== 'expense') continue;
      const [y, m, d] = t.date.split('-').map(Number);
      sums[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] += t.amount;
    }
    return names.map((n, i) => ({ name: n, value: Math.round(sums[i]) }));
  }, [tx]);

  if (!activeDataset) return <EmptyWorkspace module="Live BI Analytics" />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-navy-900">Live BI Analytics</h2><p className="text-xs text-navy-400">{tx.length.toLocaleString()} transactions in range · {activeDataset.name}</p></div>
        <div className="inline-flex rounded-xl bg-white border border-navy-200 p-1">
          {PERIODS.map((p) => <button key={p.k} onClick={() => setPeriod(p.k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${period === p.k ? 'bg-brand-600 text-white' : 'text-navy-500 hover:text-navy-900'}`}>{p.l}</button>)}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Revenue vs. Burn" sub="Monthly revenue, expenses and net cash flow">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} /><XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={money} axisLine={false} tickLine={false} width={55} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} /><Line dataKey="netCashFlow" name="Net" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} /></ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cash balance trend" sub="Opening balance plus cumulative net cash flow">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthly}><defs><linearGradient id="cashG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} /><XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={money} axisLine={false} tickLine={false} width={55} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Area dataKey="cumulativeCash" name="Cash" stroke="#2563EB" strokeWidth={2.5} fill="url(#cashG)" /></AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Expense breakdown by category" className="lg:col-span-2">
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart><Pie data={cats.slice(0, 8)} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} paddingAngle={2}>{cats.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => formatCurrency(Number(v))} /></PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2">
              {cats.slice(0, 8).map((c, i) => {
                const total = cats.reduce((s, x) => s + x.value, 0);
                return <li key={c.name} className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="flex-1 text-navy-700">{c.name}</span><span className="text-navy-400 text-xs">{((c.value / total) * 100).toFixed(0)}%</span><span className="font-bold text-navy-900 w-20 text-right">{formatCurrency(c.value)}</span></li>;
              })}
            </ul>
          </div>
        </ChartCard>
      </div>

      <FeatureGate feature="full_analytics" description="Vendor rankings, category trends, client mix and weekday spending patterns.">
        <div className="grid lg:grid-cols-2 gap-5">
          <ChartCard title="Top vendors by spend">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vendors} layout="vertical" margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} /><XAxis type="number" tick={axis} tickFormatter={money} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Bar dataKey="value" name="Spend" fill="#2563EB" radius={[0, 6, 6, 0]} /></BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Category trend by month" sub="Top 5 categories, stacked">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stacked}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} /><XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={money} axisLine={false} tickLine={false} width={55} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Legend />
                {[...topCats, 'Other'].map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Revenue by client">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart><Pie data={clients} dataKey="value" nameKey="name" outerRadius={100} label={(e) => e.name}>{clients.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => formatCurrency(Number(v))} /></PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Spending by weekday">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekdays}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} /><XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={money} axisLine={false} tickLine={false} width={55} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Bar dataKey="value" name="Spend" fill="#8B5CF6" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </FeatureGate>
    </div>
  );
}
