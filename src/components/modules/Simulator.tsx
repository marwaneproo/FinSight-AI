import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Megaphone, RotateCcw, Scissors, ShieldCheck, TrendingUp, type LucideIcon } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import { FeatureGate } from '@/components/FeatureGate';
import { NEUTRAL_SCENARIO, formatCurrency, formatRunway, lastTransactionDate, projectCash } from '@/lib/cashFlowEngine';
import type { ScenarioState } from '@/types';

function Slider({ label, icon: Icon, value, min, max, suffix = '%', color, onChange, hint }: { label: string; icon: LucideIcon; value: number; min: number; max: number; suffix?: string; color: string; onChange: (v: number) => void; hint: string }) {
  return (
    <div className="rounded-xl border border-navy-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${color}22` }}><Icon className="h-4 w-4" style={{ color }} /></div><span className="text-sm font-semibold text-navy-800">{label}</span></div>
        <span className="text-sm font-extrabold" style={{ color }}>{value > 0 && min < 0 ? '+' : ''}{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-600" aria-label={label} />
      <div className="flex justify-between text-[10px] text-navy-400"><span>{min}{suffix}</span><span>{hint}</span><span>{max}{suffix}</span></div>
    </div>
  );
}

const PRESETS: { name: string; s: ScenarioState }[] = [
  { name: 'Growth push', s: { revenueChange: 20, marketingChange: 30, costCut: 0, leakElimination: 0 } },
  { name: 'Lean mode', s: { revenueChange: 0, marketingChange: -30, costCut: 15, leakElimination: 100 } },
  { name: 'Downturn', s: { revenueChange: -25, marketingChange: 0, costCut: 5, leakElimination: 50 } },
  { name: 'Fix leaks only', s: { revenueChange: 0, marketingChange: 0, costCut: 0, leakElimination: 100 } },
];

function SimulatorBody() {
  const { transactions, analysis, activeDataset } = useWorkspace();
  const [s, setS] = useState<ScenarioState>(NEUTRAL_SCENARIO);
  const startDate = lastTransactionDate(transactions);
  const last = analysis.monthly[analysis.monthly.length - 1];

  const proj = useMemo(
    () => (startDate && last ? projectCash({ startBalance: last.cumulativeCash, startDate, baseline: analysis.baseline, scenario: s, days: 90 }) : null),
    [startDate, last, analysis.baseline, s]
  );
  if (!proj) return null;

  const set = (patch: Partial<ScenarioState>) => setS((cur) => ({ ...cur, ...patch }));
  const netMonthly = proj.scenarioRate.revenue - proj.scenarioRate.expenses;
  const runway = netMonthly >= 0 ? null : proj.startBalance > 0 ? Math.round((proj.startBalance / -netMonthly) * 30) : 0;
  const changed = JSON.stringify(s) !== JSON.stringify(NEUTRAL_SCENARIO);

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="space-y-3">
        <div className="card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-navy-900">What-if levers</h3>
            <button onClick={() => setS(NEUTRAL_SCENARIO)} disabled={!changed} className="btn-ghost !py-1 !px-2 text-xs disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Reset</button></div>
          <div className="flex flex-wrap gap-1.5 mb-3">{PRESETS.map((p) => <button key={p.name} onClick={() => setS(p.s)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100">{p.name}</button>)}</div>
          <div className="space-y-3">
            <Slider label="Revenue change" icon={TrendingUp} value={s.revenueChange} min={-50} max={100} color="#10B981" hint="vs. run-rate" onChange={(v) => set({ revenueChange: v })} />
            <Slider label="Marketing spend" icon={Megaphone} value={s.marketingChange} min={-60} max={60} color="#8B5CF6" hint={`base ${formatCurrency(analysis.baseline.marketingMonthly, true)}/mo`} onChange={(v) => set({ marketingChange: v })} />
            <Slider label="Cut other costs" icon={Scissors} value={s.costCut} min={0} max={40} color="#F59E0B" hint="non-marketing opex" onChange={(v) => set({ costCut: v })} />
            <Slider label="Eliminate leakage" icon={ShieldCheck} value={s.leakElimination} min={0} max={100} color="#2563EB" hint={`${formatCurrency(analysis.baseline.leakMonthly, true)}/mo at stake`} onChange={(v) => set({ leakElimination: v })} />
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-5">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { l: 'Cash in 90 days', v: formatCurrency(proj.scenarioEnd), sub: `baseline ${formatCurrency(proj.baselineEnd)}`, tone: 'text-navy-900' },
            { l: 'Impact vs baseline', v: `${proj.delta >= 0 ? '+' : ''}${formatCurrency(proj.delta)}`, sub: 'over 90 days', tone: proj.delta >= 0 ? 'text-success-600' : 'text-danger-600' },
            { l: 'Scenario runway', v: runway === null ? '∞' : formatRunway(runway), sub: `net ${netMonthly >= 0 ? '+' : ''}${formatCurrency(netMonthly, true)}/mo`, tone: runway !== null && runway < 90 ? 'text-danger-600' : 'text-navy-900' },
          ].map((k) => <div key={k.l} className="card p-4 rounded-2xl"><p className="text-[11px] font-medium text-navy-400 uppercase tracking-wide">{k.l}</p><p className={`text-2xl font-extrabold mt-1 ${k.tone}`}>{k.v}</p><p className="text-xs text-navy-400">{k.sub}</p></div>)}
        </div>
        <div className="card p-5 rounded-2xl">
          <h3 className="text-sm font-bold text-navy-900">90-day cash projection</h3>
          <p className="text-xs text-navy-400 mb-3">From {proj.startDate} · baseline = {analysis.baseline.basis} · recalculates as you drag</p>
          <ResponsiveContainer width="100%" height={330}>
            <LineChart data={proj.daily}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} interval={14} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={65} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Legend /><ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" />
              <Line dataKey="baseline" name="Baseline" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
              <Line dataKey="scenario" name="Scenario" stroke="#2563EB" strokeWidth={3} dot={false} isAnimationActive={false} /></LineChart>
          </ResponsiveContainer>
          {proj.scenarioZeroDay !== null && <p className="text-xs font-semibold text-danger-600 mt-2">⚠ In this scenario cash reaches zero on day {proj.scenarioZeroDay}.</p>}
          <p className="text-[11px] text-navy-400 mt-2">{activeDataset?.name}: revenue {formatCurrency(proj.baselineRate.revenue, true)}/mo and expenses {formatCurrency(proj.baselineRate.expenses, true)}/mo are the baseline. Leakage savings = detected leaks spread over the observed months.</p>
        </div>
      </div>
    </div>
  );
}

export function Simulator() {
  const { activeDataset } = useWorkspace();
  if (!activeDataset) return <EmptyWorkspace module="the Scenario Simulator" />;
  return <div className="animate-fade-in"><FeatureGate feature="scenario_simulator" description="Drag revenue, marketing, cost-cutting and leak-elimination levers and watch the 90-day cash curve move in real time."><SimulatorBody /></FeatureGate></div>;
}
