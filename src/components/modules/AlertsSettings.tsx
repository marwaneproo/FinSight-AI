import { useState } from 'react';
import { BellRing, Cloud, HardDrive, Plus, RotateCcw, SlidersHorizontal, Trash2, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { FeatureGate } from '@/components/FeatureGate';
import { ALERT_KIND_LABEL, describeRule } from '@/lib/alertEngine';
import { DEFAULT_RULES } from '@/lib/defaults';
import { newUuid } from '@/lib/dataService';
import { PLAN_NAME } from '@/lib/plans';
import type { CustomAlertRule, DetectionRules } from '@/types';

type NumKey = { [K in keyof DetectionRules]: DetectionRules[K] extends number ? K : never }[keyof DetectionRules];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`h-6 w-11 rounded-full transition-colors relative flex-shrink-0 ${on ? 'bg-brand-600' : 'bg-navy-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></button>;
}

export function AlertsSettings() {
  const { settings, updateSettings, analysis, syncMode, syncNote, plan, openUpgrade, resetWorkspace, activeDataset } = useWorkspace();
  const rules = settings.rules;
  const setRule = (patch: Partial<DetectionRules>) => updateSettings({ rules: { ...rules, ...patch } });
  const [draft, setDraft] = useState<{ kind: CustomAlertRule['kind']; category: string; threshold: number }>({ kind: 'category_monthly_cap', category: '', threshold: 5000 });

  const num = (k: NumKey, label: string, suffix = '') => (
    <label className="flex items-center justify-between gap-3 text-xs text-navy-600">{label}
      <span className="flex items-center gap-1"><input type="number" className="input-field !py-1 !w-24 text-right" value={rules[k]} min={0} onChange={(e) => setRule({ [k]: Math.max(0, Number(e.target.value)) } as Partial<DetectionRules>)} />{suffix}</span></label>
  );
  const detectors: { key: keyof DetectionRules; title: string; desc: string; fields: React.ReactNode }[] = [
    { key: 'duplicates', title: 'Duplicate charges', desc: 'Same vendor and amount posted close together.', fields: <>{num('duplicateWindowDays', 'Window', 'days')}{num('duplicateMinAmount', 'Ignore below', '$')}</> },
    { key: 'priceHikes', title: 'Vendor price hikes', desc: 'Per-charge average jumps vs the previous month and beats all history.', fields: <>{num('priceHikePct', 'Hike threshold', '%')}{num('priceHikeMinBase', 'Min prior charge', '$')}</> },
    { key: 'unusualAmounts', title: 'Unusual amounts', desc: 'A single charge far above the vendor’s median.', fields: <>{num('unusualAmountMultiple', 'Multiple of median', '×')}{num('unusualAmountMin', 'Min amount', '$')}</> },
    { key: 'weekend', title: 'Weekend charges', desc: 'Large expenses on weekends (auto-skipped when weekends are normal).', fields: num('weekendMin', 'Min amount', '$') },
    { key: 'categorySpikes', title: 'Category spend spikes', desc: 'Monthly category spend far above its 3-month norm.', fields: <>{num('categorySpikePct', 'Spike threshold', '%')}{num('categorySpikeMin', 'Min excess', '$')}</> },
  ];
  const customs = settings.customAlerts;
  const setCustoms = (c: CustomAlertRule[]) => updateSettings({ customAlerts: c });

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="card p-5 rounded-2xl flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-brand-100 flex items-center justify-center"><BellRing className="h-5 w-5 text-brand-600" /></div>
        <div><h2 className="text-lg font-bold text-navy-900">Alert Rules &amp; Settings</h2><p className="text-sm text-navy-400">Changes re-run detection on <b>{activeDataset?.name ?? 'the active dataset'}</b> immediately.</p></div></div>

      <FeatureGate feature="alert_rules" description="Tune every detector’s sensitivity and switch rules on or off.">
        <div className="card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand-600" /><h3 className="text-base font-bold text-navy-900">Detection sensitivity</h3></div>
            <div className="flex items-center gap-3"><span className="badge-brand">{analysis.allAnomalies.length} findings now</span><button className="btn-ghost !py-1 text-xs" onClick={() => setRule(DEFAULT_RULES)}><RotateCcw className="h-3.5 w-3.5" />Defaults</button></div></div>
          <div className="grid md:grid-cols-2 gap-4">
            {detectors.map((d) => (
              <div key={d.key} className={`rounded-xl border p-4 space-y-2 ${rules[d.key] ? 'border-navy-200' : 'border-navy-100 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-navy-900">{d.title}</p><p className="text-xs text-navy-400">{d.desc}</p></div><Toggle on={rules[d.key] as boolean} onChange={(v) => setRule({ [d.key]: v } as Partial<DetectionRules>)} /></div>
                {rules[d.key] && d.fields}
              </div>
            ))}
          </div>
        </div>
      </FeatureGate>

      <FeatureGate feature="custom_alerts" description="Create your own thresholds: category caps, single-transaction limits, minimum cash and runway.">
        <div className="card p-6 rounded-2xl">
          <h3 className="text-base font-bold text-navy-900 mb-3">Custom threshold alerts</h3>
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <label className="text-xs text-navy-500">Rule<select className="input-field !py-1.5 block" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CustomAlertRule['kind'] })}>{Object.entries(ALERT_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            {draft.kind === 'category_monthly_cap' && <label className="text-xs text-navy-500">Category<input className="input-field !py-1.5 block" placeholder="e.g. Marketing" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label>}
            <label className="text-xs text-navy-500">Threshold<input type="number" className="input-field !py-1.5 block !w-32" value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })} /></label>
            <button className="btn-primary" onClick={() => setCustoms([...customs, { id: newUuid(), enabled: true, kind: draft.kind, category: draft.category.trim() || undefined, threshold: draft.threshold }])}><Plus className="h-4 w-4" />Add rule</button>
          </div>
          {customs.length === 0 ? <p className="text-sm text-navy-400">No custom rules yet.</p> : (
            <ul className="divide-y divide-navy-100">{customs.map((r) => (
              <li key={r.id} className="py-2.5 flex items-center gap-3"><Toggle on={r.enabled} onChange={(v) => setCustoms(customs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)))} /><span className="text-sm text-navy-700 flex-1">{describeRule(r)}</span><button className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-500" aria-label="Delete rule" onClick={() => setCustoms(customs.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></button></li>
            ))}</ul>
          )}
          <h4 className="text-sm font-bold text-navy-900 mt-5 mb-2">Live alert feed</h4>
          {analysis.alerts.length === 0 ? <p className="flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" />No rule is currently triggered.</p> : (
            <ul className="space-y-2">{analysis.alerts.map((a, i) => <li key={i} className={`rounded-xl border p-3 ${a.severity === 'high' ? 'border-danger-200 bg-danger-50/60' : 'border-warning-200 bg-warning-50/60'}`}><p className="text-sm font-bold text-navy-900">{a.title}</p><p className="text-xs text-navy-600">{a.detail}</p></li>)}</ul>
          )}
        </div>
      </FeatureGate>

      <div className="card p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-navy-900">Workspace</h3>
        <div className="flex items-start gap-3 text-sm">{syncMode === 'supabase' ? <Cloud className="h-5 w-5 text-success-600" /> : <HardDrive className="h-5 w-5 text-navy-500" />}
          <div><p className="font-semibold text-navy-800">{syncMode === 'supabase' ? 'Synced to Supabase' : 'Stored locally in this browser'}</p>{syncNote && <p className="text-xs text-navy-400 mt-0.5">{syncNote}</p>}</div></div>
        <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-navy-600">Current plan: <b>{PLAN_NAME[plan]}</b></span><button className="btn-secondary !py-1.5 text-xs" onClick={() => openUpgrade()}>Change plan</button></div>
        <button className="btn-ghost text-danger-600 hover:text-danger-700 !px-0" onClick={() => window.confirm('Delete ALL datasets and reset settings and plan?') && resetWorkspace()}><Trash2 className="h-4 w-4" />Reset workspace (delete all data)</button>
      </div>
    </div>
  );
}
