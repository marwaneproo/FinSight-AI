import { Lock } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { AnomalyDetector } from '@/components/AnomalyDetector';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import { formatCurrency } from '@/lib/cashFlowEngine';

export function Anomalies() {
  const { activeDataset, analysis, transactions, setAnomalyStatus, openUpgrade } = useWorkspace();
  if (!activeDataset) return <EmptyWorkspace module="the Anomaly & Leak Detector" />;
  return (
    <div className="space-y-4 animate-fade-in">
      {analysis.hiddenAnomalyCount > 0 && (
        <button onClick={() => openUpgrade({ feature: 'advanced_anomalies' })} className="w-full card p-4 flex items-center gap-3 text-left border-warning-200 bg-warning-50/60 hover:shadow-glass-lg">
          <Lock className="h-5 w-5 text-warning-600 flex-shrink-0" />
          <p className="text-sm text-navy-700 flex-1">Starter shows duplicate-charge detection only. <b>{analysis.hiddenAnomalyCount} additional leaks worth {formatCurrency(analysis.hiddenAnomalyAmount)}</b> (price hikes, unusual amounts, weekend charges) are hidden.</p>
          <span className="btn-primary !py-1.5 text-xs">Unlock all</span>
        </button>
      )}
      <AnomalyDetector anomalies={analysis.anomalies} transactions={transactions} onStatusChange={setAnomalyStatus} />
    </div>
  );
}
