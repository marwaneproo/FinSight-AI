import { Database } from 'lucide-react';
import { UploadPanel } from '@/components/UploadPanel';

export function EmptyWorkspace({ module }: { module: string }) {
  return (
    <div className="max-w-2xl mx-auto py-10 animate-fade-in">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-3"><Database className="h-6 w-6 text-brand-600" /></div>
        <h2 className="text-xl font-bold text-navy-900">Load a dataset to power {module}</h2>
        <p className="text-sm text-navy-500 mt-1">Everything on this screen is computed live from the active dataset — upload a file to begin.</p>
      </div>
      <UploadPanel compact />
    </div>
  );
}
