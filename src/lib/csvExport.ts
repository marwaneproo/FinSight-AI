import type { Transaction } from '@/types';
import type { Anomaly } from '@/types';

export function exportTransactionsCSV(transactions: Transaction[]): void {
  const headers = ['Date', 'Description', 'Vendor', 'Category', 'Amount', 'Type', 'Status'];
  const rows = transactions.map((t) => [
    t.date,
    `"${csvSafe(t.description).replace(/"/g, '""')}"`,
    `"${csvSafe(t.vendor).replace(/"/g, '""')}"`,
    t.category,
    t.amount.toFixed(2),
    t.type,
    'Categorized',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadCSV(csv, 'FinSight_Cleaned_Transactions.csv');
}

export function exportAnomalyReportCSV(anomalies: Anomaly[], transactions: Transaction[]): void {
  const headers = ['Date', 'Vendor', 'Category', 'Amount', 'Anomaly Type', 'Severity', 'Description', 'Suggestion', 'Status'];
  const rows = anomalies.map((a) => {
    const t = transactions.find((tx) => tx.id === a.transactionId);
    return [
      t?.date ?? '',
      `"${csvSafe(t?.vendor ?? 'Unknown').replace(/"/g, '""')}"`,
      t?.category ?? '',
      (t?.amount ?? 0).toFixed(2),
      a.type,
      a.severity,
      `"${a.description.replace(/"/g, '""')}"`,
      `"${a.suggestion.replace(/"/g, '""')}"`,
      a.status,
    ];
  });

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadCSV(csv, 'FinSight_Anomaly_Report.csv');
}

export function csvSafe(v: string): string {
  // neutralise spreadsheet formula injection from uploaded text (=, +, -, @)
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateDisputeEmail(anomaly: Anomaly, transaction: Transaction | undefined): string {
  const vendor = transaction?.vendor ?? 'the vendor';
  const amount = transaction ? `$${transaction.amount.toFixed(2)}` : `$${anomaly.detectedAmount.toFixed(2)}`;
  const date = transaction?.date ?? 'the date in question';

  return `Subject: Dispute Request — Duplicate/Erroneous Charge of ${amount}

Dear ${vendor} Billing Team,

I am writing to dispute a charge that appeared on my account:

• Date: ${date}
• Amount: ${amount}
• Description: ${transaction?.description ?? anomaly.title}
• Issue: ${anomaly.description}

${anomaly.suggestion}

Please review this charge and process a refund of ${amount} to my original payment method. I have been a loyal customer and would appreciate your prompt attention to this matter.

If you require additional information, please do not hesitate to contact me.

Thank you for your time and assistance.

Best regards,
[Your Name]
[Your Company]
[Your Email]
[Your Phone]`;
}
