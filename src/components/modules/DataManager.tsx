import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Check, GitCompare, Layers, Pencil, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { UploadPanel } from '@/components/UploadPanel';
import { FeatureGate } from '@/components/FeatureGate';
import { detectAnomalies } from '@/lib/anomalyDetector';
import { formatCurrency, formatPct, groupTotals } from '@/lib/cashFlowEngine';
import type { Transaction } from '@/types';

interface Summary { label: string; income: number; expenses: number; net: number; count: number; anomalies: number; cats: Map<string, number> }

function summarize(label: string, tx: Transaction[], rules: Parameters<typeof detectAnomalies>[1]): Summary {
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { label, income, expenses, net: income - expenses, count: tx.length, anomalies: detectAnomalies(tx, rules).length, cats: new Map(groupTotals(tx, 'expense', 'category').map((c) => [c.name, c.value])) };
}

function CompareView() {
  const { datasets, activeDataset, transactions, analysis, getTransactions, settings } = useWorkspace();
  const [mode, setMode] = useState<'datasets' | 'periods'>('periods');
  const months = analysis.monthly.map((m) => m.monthKey);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [dsA, setDsA] = useState('');
  const [dsB, setDsB] = useState('');
  const [rows, setRows] = useState<{ A: Transaction[]; B: Transaction[] } | null>(null);

  useEffect(() => { setA(months[months.length - 2] ?? months[0] ?? ''); setB(months[months.length - 1] ?? ''); }, [activeDataset?.id, months.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dsA && datasets[0]) setDsA(datasets[0].id);
    if (!dsB && datasets[1]) setDsB(datasets[1].id);
  }, [datasets, dsA, dsB]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode === 'periods') {
        setRows({ A: transactions.filter((t) => t.date.startsWith(a)), B: transactions.filter((t) => t.date.startsWith(b)) });
      } else if (dsA && dsB) {
        const [x, y] = await Promise.all([getTransactions(dsA), getTransactions(dsB)]);
        if (!cancelled) setRows({ A: x, B: y });
      }
    })();
    return () => { cancelled = true; };
  }, [mode, a, b, dsA, dsB, transactions, getTransactions]);

  const labelA = mode === 'periods' ? a : datasets.find((d) => d.id === dsA)?.name ?? 'A';
  const labelB = mode === 'periods' ? b : datasets.find((d) => d.id === dsB)?.name ?? 'B';
  const sA = useMemo(() => (rows ? summarize(labelA, rows.A, settings.rules) : null), [rows, labelA, settings.rules]);
  const sB = useMemo(() => (rows ? summarize(labelB, rows.B, settings.rules) : null), [rows, labelB, settings.rules]);

  const catData = useMemo(() => {
    if (!sA || !sB) return [];
    return [...new Set([...sA.cats.keys(), ...sB.cats.keys()])]
      .map((c) => ({ name: c, A: Math.round(sA.cats.get(c) ?? 0), B: Math.round(sB.cats.get(c) ?? 0) }))
      .sort((x, y) => y.A + y.B - (x.A + x.B)).slice(0, 8);
  }, [sA, sB]);

  const sel = 'input-field !py-1.5 !w-auto';
  const metric = (name: string, x: number, y: number, money = true, invertGood = false) => {
    const pct = x === 0 ? null : ((y - x) / Math.abs(x)) * 100;
    const good = pct === null ? true : invertGood ? pct <= 0 : pct >= 0;
    return (
      <tr key={name} className="border-t border-navy-100">
        <td className="py-2 text-navy-600">{name}</td>
        <td className="py-2 text-right font-semibold">{money ? formatCurrency(x) : x}</td>
        <td className="py-2 text-right font-semibold">{money ? formatCurrency(y) : y}</td>
        <td className={`py-2 text-right font-bold ${good ? 'text-success-600' : 'text-danger-600'}`}>{formatPct(pct)}</td>
      </tr>
    );
  };

  return (
    <div className="card p-6 rounded-2xl">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <GitCompare className="h-5 w-5 text-brand-600" /><h3 className="text-base font-bold text-navy-900">Period comparison</h3>
        <div className="inline-flex rounded-lg bg-navy-100 p-0.5 text-xs font-semibold">
          {(['periods', 'datasets'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md capitalize ${mode === m ? 'bg-white shadow' : 'text-navy-500'}`}>{m === 'periods' ? 'Months in this dataset' : 'Two datasets'}</button>)}
        </div>
        {mode === 'periods' ? (
          <div className="flex items-center gap-2 text-sm"><select className={sel} value={a} onChange={(e) => setA(e.target.value)}>{months.map((m) => <option key={m}>{m}</option>)}</select>vs<select className={sel} value={b} onChange={(e) => setB(e.target.value)}>{months.map((m) => <option key={m}>{m}</option>)}</select></div>
        ) : (
          <div className="flex items-center gap-2 text-sm"><select className={sel} value={dsA} onChange={(e) => setDsA(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>vs<select className={sel} value={dsB} onChange={(e) => setDsB(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        )}
      </div>
      {sA && sB && (
        <div className="grid lg:grid-cols-2 gap-6">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-navy-400 uppercase"><th className="text-left pb-2">Metric</th><th className="text-right pb-2">{labelA}</th><th className="text-right pb-2">{labelB}</th><th className="text-right pb-2">Change</th></tr></thead>
            <tbody>
              {metric('Revenue', sA.income, sB.income)}
              {metric('Expenses', sA.expenses, sB.expenses, true, true)}
              {metric('Net cash flow', sA.net, sB.net)}
              {metric('Transactions', sA.count, sB.count, false)}
              {metric('Anomalies', sA.anomalies, sB.anomalies, false, true)}
            </tbody>
          </table>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={catData}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} /><YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fontSize: 10 }} width={55} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Legend /><Bar dataKey="A" name={labelA} fill="#94A3B8" radius={[4, 4, 0, 0]} /><Bar dataKey="B" name={labelB} fill="#2563EB" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Consolidate() {
  const { datasets, consolidate } = useWorkspace();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('Consolidated group');
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card p-6 rounded-2xl">
      <div className="flex items-center gap-2 mb-3"><Layers className="h-5 w-5 text-brand-600" /><h3 className="text-base font-bold text-navy-900">Multi-entity consolidation</h3></div>
      <p className="text-xs text-navy-500 mb-3">Merge several entities / accounts into one dataset; opening balances are summed.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {datasets.filter((d) => d.source !== 'consolidated').map((d) => (
          <button key={d.id} onClick={() => setPicked((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${picked.includes(d.id) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-navy-200 text-navy-600'}`}>{picked.includes(d.id) && <Check className="inline h-3 w-3 mr-1" />}{d.name}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input-field max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
        <button disabled={picked.length < 2} className="btn-primary disabled:opacity-40" onClick={() => consolidate(picked, name).then(() => setPicked([])).catch((e) => setErr(e.message))}>Consolidate {picked.length || ''}</button>
      </div>
      {err && <p className="text-xs text-danger-600 mt-2">{err}</p>}
    </div>
  );
}

export function DataManager() {
  const { datasets, activeDataset, switchDataset, deleteDataset, renameDataset, setOpeningBalance, syncMode } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="space-y-5 animate-fade-in">
      <UploadPanel />

      <div className="card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-navy-100 flex items-center justify-between">
          <div><h3 className="text-base font-bold text-navy-900">Upload history</h3><p className="text-xs text-navy-400">Click a dataset to make it active — every module recalculates instantly. Stored in {syncMode === 'supabase' ? 'Supabase' : 'this browser'}.</p></div>
          <span className="badge-brand">{datasets.length} datasets</span>
        </div>
        {datasets.length === 0 ? <p className="p-8 text-center text-sm text-navy-400">Nothing uploaded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-navy-50/60 text-xs text-navy-400 uppercase"><th className="text-left px-5 py-3">Dataset</th><th className="text-left px-3">Period</th><th className="text-right px-3">Rows</th><th className="text-right px-3">Income</th><th className="text-right px-3">Expenses</th><th className="text-right px-3">Opening cash</th><th className="px-3 text-left">Uploaded</th><th className="px-3" /></tr></thead>
              <tbody>
                {datasets.map((d) => {
                  const active = d.id === activeDataset?.id;
                  return (
                    <tr key={d.id} onClick={() => switchDataset(d.id)} className={`border-t border-navy-100 cursor-pointer ${active ? 'bg-brand-50/60' : 'hover:bg-navy-50/50'}`}>
                      <td className="px-5 py-3">
                        {editing === d.id ? (
                          <input autoFocus className="input-field !py-1" value={draft} onClick={(e) => e.stopPropagation()} onChange={(e) => setDraft(e.target.value)} onBlur={() => { renameDataset(d.id, draft); setEditing(null); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                        ) : (
                          <div className="flex items-center gap-2"><span className="font-semibold text-navy-900">{d.name}</span>{active && <span className="badge-brand">Active</span>}{d.source !== 'upload' && <span className="badge-neutral">{d.source}</span>}</div>
                        )}
                        <p className="text-[11px] text-navy-400">{d.fileName}</p>
                      </td>
                      <td className="px-3 text-navy-600 whitespace-nowrap">{d.dateFrom} → {d.dateTo}</td>
                      <td className="px-3 text-right">{d.rowCount.toLocaleString()}</td>
                      <td className="px-3 text-right text-success-700 font-semibold">{formatCurrency(d.totalIncome, true)}</td>
                      <td className="px-3 text-right text-danger-600 font-semibold">{formatCurrency(d.totalExpenses, true)}</td>
                      <td className="px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <input type="number" defaultValue={d.openingBalance} key={`${d.id}-${d.openingBalance}`} onBlur={(e) => Number(e.target.value) !== d.openingBalance && setOpeningBalance(d.id, Number(e.target.value))} className="input-field !py-1 !w-28 text-right" aria-label="Opening balance" />
                      </td>
                      <td className="px-3 text-xs text-navy-400 whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 rounded-lg hover:bg-navy-100 text-navy-500" title="Rename" onClick={() => { setEditing(d.id); setDraft(d.name); }}><Pencil className="h-4 w-4" /></button>
                        <button className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-500" title="Delete" onClick={() => window.confirm(`Delete "${d.name}" and its ${d.rowCount} transactions?`) && deleteDataset(d.id)}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeDataset && <FeatureGate feature="period_comparison" description="Compare months or whole datasets side by side with category-level deltas."><CompareView /></FeatureGate>}
      {datasets.length > 1 && <FeatureGate feature="consolidation" description="Merge multiple entities or bank accounts into one consolidated view."><Consolidate /></FeatureGate>}
    </div>
  );
}
