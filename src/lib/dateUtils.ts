import type { Transaction } from '@/types';

/* ───────────── date helpers ───────────── */

export function getMonthKey(date: string): string {
  return date.substring(0, 7);
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shortDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function lastTransactionDate(transactions: Transaction[]): string | null {
  let max: string | null = null;
  for (const t of transactions) if (!max || t.date > max) max = t.date;
  return max;
}

/**
 * The last month is "partial" when the data stops well before month-end (e.g. a statement cut on the 12th).
 * Partial months are excluded from averages/forecast baselines so they don't understate burn.
 */
export function getPartialMonthKey(transactions: Transaction[]): string | null {
  const last = lastTransactionDate(transactions);
  if (!last) return null;
  const months = new Set(transactions.map((t) => getMonthKey(t.date)));
  if (months.size < 2) return null;
  const mk = getMonthKey(last);
  const day = Number(last.slice(8, 10));
  return day < daysInMonth(mk) * 0.8 ? mk : null;
}

