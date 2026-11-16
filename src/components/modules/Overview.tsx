import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, Lock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useWorkspace } from '@/hooks/useWorkspace';
import { KPICards } from '@/components/KPICards';
import { CashFlowChart } from '@/components/CashFlowChart';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import { NEUTRAL_SCENARIO, formatCurrency, generateForecast, groupTotals } from '@/lib/cashFlowEngine';
import { buildInsights } from '@/lib/insights';
import type { DashboardTab } from '@/types';

export const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#64748B'];

export function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#2563EB' : score >= 40 ? '#F59E0B' : '#EF4444';
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 mx-auto">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E2E8F0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-navy-900">{score}</span>
        <span className="text-xs font-semibold" style={{ color }}>{grade}</span>
      </div>
    </div>
  );
}

const toneIcon = { good: CheckCircle2, warn: AlertTriangle, bad: AlertTriangle, info: Info } as const;
const toneColor = { good: 'text-success-600', warn: 'text-warning-500', bad: 'text-danger-600', info: 'text-brand-600' } as const;

export function Overview({ onNavigate }: { onNavigate: (t: DashboardTab) => void }) {
  const { transactions, activeDataset, analysis, can, openUpgrade, loadingTransactions } = useWorkspace();
  const horizon = can('scenario_simulator') ? 90 : 30;
  const forecast = useMemo(
    () => generateForecast(transactions, analysis.monthly, analysis.anomalies, NEUTRAL_SCENARIO, activeDataset?.openingBalance ?? 0, horizon),
    [transactions, analysis.monthly, analysis.anomalies, activeDataset, horizon]
  );
  const insights = useMemo(() => buildInsights(transactions, analysis.monthly, analysis.anomalies, analysis.kpis), [transactions, analysis]);
  const cats = useMemo(() => groupTotals(transactions, 'expense', 'category').slice(0, 6), [transactions]);

  if (!activeDataset) return <EmptyWorkspace module="the executive overview" />;
  if (loadingTransactions && transactions.length === 0) return <p className="text-sm text-navy-400 p-8">Loading dataset…</p>;
  const open = analysis.anomalies.filter((a) => a.status === 'flagged');

  return (
    <div className="space-y-5 animate-fade-in">
      <KPICards kpis={analysis.kpis} />

      {analysis.hiddenAnomalyCount > 0 && (
        <button onClick={() => openUpgrade({ feature: 'advanced_anomalies' })} className="w-full card p-4 flex items-center gap-3 text-left border-warning-200 bg-warning-50/60 hover:shadow-glass-lg">
          <Lock className="h-5 w-5 text-warning-600 flex-shrink-0" />
          <p className="text-sm text-navy-700 flex-1"><b>{analysis.hiddenAnomalyCount} more leaks worth {formatCurrency(analysis.hiddenAnomalyAmount)}</b> were detected (price hikes, unusual amounts, weekend charges) but are hidden on Starter.</p>
          <span className="btn-primary !py-1.5 text-xs">Unlock</span>
        </button>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><CashFlowChart data={forecast} /></div>
        <div className="card p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-brand-600" /><h3 className="text-base font-bold text-navy-900">Financial Health Score</h3></div>
          <HealthGauge score={analysis.health.score} grade={analysis.health.grade} />
          <div className="mt-4 space-y-2">
            {analysis.health.components.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-[11px] text-navy-500"><span>{c.label}</span><span className="font-semibold text-navy-700">{c.score}</span></div>
                <div className="h-1.5 rounded-full bg-navy-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${c.score}%`, background: c.score >= 60 ? '#10B981' : c.score >= 40 ? '#F59E0B' : '#EF4444' }} /></div>
                <p className="text-[10px] text-navy-400 mt-0.5">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card p-6 rounded-2xl lg:col-span-2">
          <div className="flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4 text-brand-600" /><h3 className="text-base font-bold text-navy-900">Executive Summary</h3><span className="text-xs text-navy-400">· {activeDataset.name}</span></div>
          <ul className="space-y-2.5">
            {insights.map((i, idx) => {
              const Icon = toneIcon[i.tone];
              return <li key={idx} className="flex gap-2.5 text-sm text-navy-700"><Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${toneColor[i.tone]}`} />{i.text}</li>;
            })}
          </ul>
          {open.length > 0 && (
            <div className="mt-4 pt-4 border-t border-navy-100">
              <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-2">Top open anomalies</p>
              {open.slice(0, 3).map((a) => (
                <div key={a.id} className="flex justify-between text-sm py-1"><span className="text-navy-700 truncate pr-3">{a.title}</span><span className="font-bold text-navy-900">{formatCurrency(a.detectedAmount)}</span></div>
              ))}
              <button onClick={() => onNavigate('anomalies')} className="btn-primary text-xs mt-2">Review all {open.length}</button>
            </div>
          )}
        </div>
        <div className="card p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-brand-600" /><h3 className="text-base font-bold text-navy-900">Where the money goes</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cats} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} cursor={{ fill: '#F1F5F9' }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>{cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
