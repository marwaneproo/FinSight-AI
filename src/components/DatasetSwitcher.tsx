import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FileSpreadsheet, Plus } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';

export function DatasetSwitcher({ onManage }: { onManage: () => void }) {
  const { datasets, activeDataset, switchDataset } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl border border-navy-200 bg-white hover:border-brand-400 text-sm max-w-[260px]">
        <FileSpreadsheet className="h-4 w-4 text-brand-600 flex-shrink-0" />
        <span className="truncate font-semibold text-navy-800">{activeDataset?.name ?? 'No dataset'}</span>
        <ChevronDown className="h-4 w-4 text-navy-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 card shadow-glass-lg z-50 overflow-hidden animate-scale-in">
          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-navy-400">Switch dataset</p>
          <div className="max-h-72 overflow-y-auto py-1">
            {datasets.length === 0 && <p className="px-4 py-3 text-xs text-navy-400">No datasets yet.</p>}
            {datasets.map((d) => (
              <button key={d.id} onClick={() => { switchDataset(d.id); setOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-navy-50 text-left">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy-800 truncate">{d.name}</p>
                  <p className="text-[11px] text-navy-400">{d.rowCount.toLocaleString()} rows · {d.dateFrom} → {d.dateTo}</p>
                </div>
                {d.id === activeDataset?.id && <Check className="h-4 w-4 text-brand-600" />}
              </button>
            ))}
          </div>
          <button onClick={() => { setOpen(false); onManage(); }} className="w-full flex items-center gap-2 px-4 py-3 border-t border-navy-100 text-sm font-semibold text-brand-600 hover:bg-brand-50">
            <Plus className="h-4 w-4" /> Upload or manage datasets
          </button>
        </div>
      )}
    </div>
  );
}
