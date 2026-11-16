import { useCallback, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Sparkles, Upload } from 'lucide-react';
import { PlanLimitError, useWorkspace } from '@/hooks/useWorkspace';
import type { ParseReport } from '@/types';

/** Drag-and-drop ingestion: parse → persist (Supabase or local) → every module recalculates. */
export function UploadPanel({ compact = false }: { compact?: boolean }) {
  const { ingestFile, loadDemo, busy, openUpgrade, plan, uploadsRemaining } = useWorkspace();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ name: string; report: ParseReport } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (job: () => ReturnType<typeof loadDemo>, label: string) => {
      setError(null);
      setReport(null);
      try {
        const res = await job();
        if (res.report) setReport({ name: label, report: res.report });
      } catch (e) {
        if (e instanceof PlanLimitError) openUpgrade({ reason: 'Upload limit reached on Starter', feature: 'full_analytics' });
        setError(e instanceof Error ? e.message : 'Upload failed');
      }
    },
    [openUpgrade]
  );

  const onFile = (file?: File) => file && run(() => ingestFile(file), file.name);

  return (
    <div className="space-y-4">
      <div
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !busy && input.current?.click()}
        className={`card border-2 border-dashed text-center cursor-pointer ${compact ? 'p-7' : 'p-12'} ${dragging ? 'border-brand-500 bg-brand-50/50' : 'border-navy-300 hover:border-brand-400'}`}
      >
        <input ref={input} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-brand-600 animate-spin" />
            <p className="text-sm font-medium text-navy-700">{busy.label}</p>
            <div className="w-56 h-1.5 rounded-full bg-navy-100 overflow-hidden"><div className="h-full bg-brand-600 transition-all" style={{ width: `${busy.progress}%` }} /></div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${dragging ? 'bg-brand-600' : 'bg-brand-100'}`}>
              <Upload className={`h-6 w-6 ${dragging ? 'text-white' : 'text-brand-600'}`} />
            </div>
            <p className="text-base font-bold text-navy-900">{dragging ? 'Drop to analyse' : 'Drop any bank statement or ledger'}</p>
            <p className="text-sm text-navy-400">or <span className="text-brand-600 font-semibold">browse</span> — CSV, XLSX, XLS · any column layout</p>
            {plan === 'starter' && <p className="text-xs text-navy-400 mt-1">{uploadsRemaining} of 2 free uploads left this month</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between card p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-100 flex items-center justify-center"><Sparkles className="h-4 w-4 text-brand-600" /></div>
          <div>
            <p className="text-sm font-bold text-navy-900">No file handy?</p>
            <p className="text-xs text-navy-400">Generate a synthetic company statement and run it through the same pipeline.</p>
          </div>
        </div>
        <button disabled={!!busy} onClick={() => run(loadDemo, 'Demo dataset')} className="btn-secondary">Generate demo data</button>
      </div>

      {error && (
        <div className="card p-4 border-danger-200 bg-danger-50/50 flex gap-3"><AlertCircle className="h-5 w-5 text-danger-600 flex-shrink-0" />
          <div><p className="text-sm font-semibold text-danger-700">Could not import</p><p className="text-xs text-danger-600 mt-0.5">{error}</p></div></div>
      )}
      {report && (
        <div className="card p-4 border-success-200 bg-success-50/40">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-success-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-success-700">Imported {report.report.importedRows.toLocaleString()} transactions from {report.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(report.report.mapping).filter(([, v]) => v).map(([k, v]) => (
                  <span key={k} className="badge-neutral"><FileSpreadsheet className="h-3 w-3" />{k}: {v}</span>
                ))}
                <span className="badge-brand">direction: {report.report.directionMode}</span>
                <span className="badge-brand">dates: {report.report.dateOrder}</span>
              </div>
              {report.report.warnings.length > 0 && (
                <ul className="mt-2 text-xs text-warning-600 list-disc pl-4 space-y-0.5">{report.report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
