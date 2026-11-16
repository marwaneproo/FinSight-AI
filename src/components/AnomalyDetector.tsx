import { useState } from 'react';
import type { Anomaly, Transaction } from '@/types';
import { formatCurrencyDetailed, formatCurrency } from '@/lib/cashFlowEngine';
import { exportAnomalyReportCSV, generateDisputeEmail } from '@/lib/csvExport';
import { totalLeakAmount } from '@/lib/anomalyDetector';
import {
  AlertTriangle,
  Flag,
  X,
  Mail,
  Download,
  CheckCircle2,
  Copy,
  Copy as CopyIcon,
  ShieldAlert,
  TrendingUp,
  Calendar,
  DollarSign,
} from 'lucide-react';

interface AnomalyDetectorProps {
  anomalies: Anomaly[];
  transactions: Transaction[];
  onStatusChange: (anomalyId: string, status: 'flagged' | 'ignored' | 'refunded') => void;
}

const anomalyIcons: Record<string, typeof ShieldAlert> = {
  duplicate_subscription: Copy,
  duplicate_invoice: CopyIcon,
  price_hike: TrendingUp,
  unusual_weekend: Calendar,
  unusual_amount: DollarSign,
  category_spike: TrendingUp,
};

const anomalyTypeLabels: Record<string, string> = {
  duplicate_subscription: 'Duplicate Subscription',
  duplicate_invoice: 'Duplicate Invoice',
  price_hike: 'Price Hike',
  unusual_weekend: 'Weekend Charge',
  unusual_amount: 'Unusual Amount',
  category_spike: 'Spending Spike',
};

export function AnomalyDetector({ anomalies, transactions, onStatusChange }: AnomalyDetectorProps) {
  const [emailModal, setEmailModal] = useState<Anomaly | null>(null);
  const [emailContent, setEmailContent] = useState('');
  const [copied, setCopied] = useState(false);

  const handleExportEmail = (anomaly: Anomaly) => {
    const transaction = transactions.find((t) => t.id === anomaly.transactionId);
    const email = generateDisputeEmail(anomaly, transaction);
    setEmailContent(email);
    setEmailModal(anomaly);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(emailContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportReport = () => {
    exportAnomalyReportCSV(anomalies, transactions);
  };

  const totalLeaks = totalLeakAmount(anomalies);
  const flaggedCount = anomalies.filter((a) => a.status === 'flagged').length;
  const refundedCount = anomalies.filter((a) => a.status === 'refunded').length;

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="card p-5 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-danger-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900">Anomaly & Financial Leak Detector</h2>
              <p className="text-sm text-navy-400">
                {flaggedCount} flagged · {refundedCount} refunded · {formatCurrencyDetailed(totalLeaks)} in open leaks
              </p>
            </div>
          </div>
          <button onClick={handleExportReport} className="btn-secondary">
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Anomaly table */}
      <div className="card rounded-2xl overflow-hidden">
        {anomalies.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-14 w-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-success-600" />
            </div>
            <h3 className="text-lg font-bold text-navy-900 mb-1">No anomalies detected</h3>
            <p className="text-sm text-navy-400">Your transactions look clean. Upload more statements to continue monitoring.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 bg-navy-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wide">Anomaly</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wide hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wide">Severity</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((anomaly) => {
                  const Icon = anomalyIcons[anomaly.type] ?? ShieldAlert;
                  const transaction = transactions.find((t) => t.id === anomaly.transactionId);
                  return (
                    <tr
                      key={anomaly.id}
                      className={`border-b border-navy-100 hover:bg-navy-50/30 transition-colors ${
                        anomaly.status === 'ignored' ? 'opacity-40' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            anomaly.severity === 'high' ? 'bg-danger-100' : 'bg-warning-100'
                          }`}>
                            <Icon className={`h-4 w-4 ${anomaly.severity === 'high' ? 'text-danger-600' : 'text-warning-600'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-navy-900 text-sm">{anomaly.title}</p>
                            <p className="text-xs text-navy-400 mt-0.5 line-clamp-1">{anomaly.description}</p>
                            {anomaly.status === 'refunded' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success-600 mt-1">
                                <CheckCircle2 className="h-3 w-3" /> REFUNDED
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="badge-neutral">{anomalyTypeLabels[anomaly.type]}</span>
                      </td>
                      <td className="px-4 py-4">
                        {anomaly.severity === 'high' ? (
                          <span className="badge-high">High</span>
                        ) : (
                          <span className="badge-medium">Medium</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold text-navy-900">{formatCurrency(anomaly.detectedAmount)}</span>
                        {transaction && (
                          <p className="text-[10px] text-navy-400 mt-0.5">{transaction.date}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {anomaly.status !== 'refunded' && (
                            <>
                              <button
                                onClick={() => onStatusChange(anomaly.id, 'refunded')}
                                className="px-2.5 py-1.5 rounded-lg bg-danger-50 text-danger-600 hover:bg-danger-100 transition-colors text-xs font-semibold flex items-center gap-1"
                                title="Flag for refund"
                              >
                                <Flag className="h-3.5 w-3.5" />
                                Refund
                              </button>
                              <button
                                onClick={() => handleExportEmail(anomaly)}
                                className="px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors text-xs font-semibold flex items-center gap-1"
                                title="Generate dispute email"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Dispute
                              </button>
                              {anomaly.status !== 'ignored' && (
                                <button
                                  onClick={() => onStatusChange(anomaly.id, 'ignored')}
                                  className="px-2.5 py-1.5 rounded-lg text-navy-400 hover:bg-navy-100 transition-colors text-xs font-semibold flex items-center gap-1"
                                  title="Ignore"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          )}
                          {anomaly.status === 'refunded' && (
                            <button
                              onClick={() => handleExportEmail(anomaly)}
                              className="px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors text-xs font-semibold flex items-center gap-1"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Email
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispute Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-md animate-fade-in"
            onClick={() => setEmailModal(null)}
          />
          <div className="relative w-full max-w-2xl card shadow-glass-lg animate-scale-in overflow-hidden flex flex-col max-h-[80vh]">
            <div className="gradient-brand px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <h2 className="text-lg font-bold">Dispute Email — {emailModal.title}</h2>
              </div>
              <button onClick={() => setEmailModal(null)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <p className="text-xs text-navy-400 mb-3">Ready-to-send refund request email. Copy and paste into your email client:</p>
              <pre className="text-sm text-navy-700 whitespace-pre-wrap font-sans leading-relaxed bg-navy-50/50 rounded-xl p-4 border border-navy-200">
                {emailContent}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-navy-200 flex items-center justify-end gap-3">
              <button onClick={() => setEmailModal(null)} className="btn-ghost">
                Close
              </button>
              <button onClick={handleCopyEmail} className="btn-primary">
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
