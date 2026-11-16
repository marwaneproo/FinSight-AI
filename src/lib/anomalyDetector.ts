import type { Anomaly, DetectionRules, Transaction } from '@/types';
import { DEFAULT_RULES } from '@/lib/defaults';
import { getPartialMonthKey, addMonths } from '@/lib/dateUtils';

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function isWeekend(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function mk(date: string): string {
  return date.substring(0, 7);
}

/** Anomaly types that represent recoverable money. Category spikes are informational only. */
export function isLeak(a: Anomaly): boolean {
  return a.type !== 'category_spike';
}

export function detectAnomalies(transactions: Transaction[], rules: DetectionRules = DEFAULT_RULES): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const flagged = new Set<string>();
  const add = (a: Anomaly) => {
    if (flagged.has(a.transactionId)) return;
    flagged.add(a.transactionId);
    anomalies.push(a);
  };

  const expenses = transactions.filter((t) => t.type === 'expense');
  if (expenses.length === 0) return anomalies;

  /* 1 ── duplicates: same vendor + same amount close together ─────────────── */
  if (rules.duplicates) {
    const groups = new Map<string, Transaction[]>();
    for (const t of expenses) {
      if (t.amount < rules.duplicateMinAmount) continue;
      const key = `${t.vendor.toLowerCase()}|${t.amount.toFixed(2)}`;
      const g = groups.get(key) ?? [];
      g.push(t);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      for (let i = 1; i < g.length; i++) {
        const prev = g[i - 1];
        const cur = g[i];
        const gap = dayNumber(cur.date) - dayNumber(prev.date);
        if (gap > rules.duplicateWindowDays) continue;

        // a perfectly regular cadence (e.g. weekly payments) is a schedule, not a duplicate
        if (gap >= 1) {
          const before = i >= 2 ? dayNumber(prev.date) - dayNumber(g[i - 2].date) : null;
          const after = i + 1 < g.length ? dayNumber(g[i + 1].date) - dayNumber(cur.date) : null;
          if ((before !== null && Math.abs(before - gap) <= 1) || (after !== null && Math.abs(after - gap) <= 1)) continue;
        }

        const sameDay = gap === 0;
        add({
          id: `anom-dup-${cur.id}`,
          transactionId: cur.id,
          type: sameDay ? 'duplicate_invoice' : 'duplicate_subscription',
          severity: 'high',
          title: `${sameDay ? 'Duplicate Invoice' : 'Duplicate Charge'} — ${cur.vendor}`,
          description: sameDay
            ? `Two identical charges of ${money(cur.amount)} from ${cur.vendor} were posted on ${cur.date}.`
            : `${money(cur.amount)} was charged by ${cur.vendor} on ${cur.date}, only ${gap} day${gap === 1 ? '' : 's'} after an identical charge on ${prev.date}.`,
          detectedAmount: cur.amount,
          suggestion: `Ask ${cur.vendor} (or your accounts-payable team) to confirm the charge and request a refund or credit note for the duplicate.`,
          status: 'flagged',
        });
      }
    }
  }

  /* 2 ── price hikes: a vendor's per-charge average jumps vs the previous month ── */
  if (rules.priceHikes) {
    type Agg = { total: number; count: number; txs: Transaction[] };
    const agg = new Map<string, Map<string, Agg>>();
    for (const t of expenses) {
      const key = `${t.vendor}||${t.category}`;
      const months = agg.get(key) ?? new Map<string, Agg>();
      const cur = months.get(mk(t.date)) ?? { total: 0, count: 0, txs: [] };
      cur.total += t.amount;
      cur.count += 1;
      cur.txs.push(t);
      months.set(mk(t.date), cur);
      agg.set(key, months);
    }
    for (const [key, months] of agg) {
      const vendor = key.split('||')[0];
      for (const [month, curr] of months) {
        const prev = months.get(addMonths(month, -1));
        // recurring-bill vendors only: a handful of charges per month, otherwise averages are just noise
        if (!prev || prev.count > 5 || curr.count > 5) continue;
        const prevAvg = prev.total / prev.count;
        const currAvg = curr.total / curr.count;
        if (prevAvg < rules.priceHikeMinBase) continue;
        const pct = ((currAvg - prevAvg) / prevAvg) * 100;
        if (pct < rules.priceHikePct) continue;
        // a *step change*: the new level must also beat every earlier month, otherwise it is just normal variance
        let historicMax = 0;
        for (const [m, a] of months) if (m < month) historicMax = Math.max(historicMax, a.total / a.count);
        if (currAvg < historicMax * 1.1) continue;
        const target = [...curr.txs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        add({
          id: `anom-hike-${target.id}`,
          transactionId: target.id,
          type: 'price_hike',
          severity: pct >= 50 ? 'high' : 'medium',
          title: `Price Hike — ${vendor} (+${pct.toFixed(0)}%)`,
          description: `${vendor} charges rose ${pct.toFixed(0)}% month-over-month (avg ${money(prevAvg)} → ${money(currAvg)}). Latest charge: ${money(target.amount)} on ${target.date}.`,
          detectedAmount: (currAvg - prevAvg) * curr.count,
          suggestion: `Review your ${vendor} plan or usage. Negotiate, downgrade, or compare alternatives before the next billing cycle.`,
          status: 'flagged',
        });
      }
    }
  }

  /* 3 ── unusual amounts: one charge far above the vendor's normal ──────────── */
  if (rules.unusualAmounts) {
    const byVendor = new Map<string, Transaction[]>();
    for (const t of expenses) {
      const g = byVendor.get(t.vendor) ?? [];
      g.push(t);
      byVendor.set(t.vendor, g);
    }
    for (const [vendor, list] of byVendor) {
      if (list.length < 4) continue;
      for (const t of list) {
        if (t.amount < rules.unusualAmountMin) continue;
        const typical = median(list.filter((o) => o.id !== t.id).map((o) => o.amount));
        if (typical <= 0 || t.amount < typical * rules.unusualAmountMultiple) continue;
        add({
          id: `anom-amount-${t.id}`,
          transactionId: t.id,
          type: 'unusual_amount',
          severity: 'high',
          title: `Unusual Amount — ${vendor}`,
          description: `${money(t.amount)} on ${t.date} is ${(t.amount / typical).toFixed(1)}× ${vendor}'s typical charge of ${money(typical)}.`,
          detectedAmount: t.amount - typical,
          suggestion: `Verify this charge with ${vendor}. It may be an annual renewal, a one-off fee, or a billing error worth disputing.`,
          status: 'flagged',
        });
      }
    }
  }

  /* 4 ── weekend charges (skipped when weekends are normal for this business) ─ */
  if (rules.weekend) {
    const weekendShare = expenses.filter((t) => isWeekend(t.date)).length / expenses.length;
    if (weekendShare < 0.25) {
      for (const t of expenses) {
        if (t.amount < rules.weekendMin || !isWeekend(t.date)) continue;
        add({
          id: `anom-weekend-${t.id}`,
          transactionId: t.id,
          type: 'unusual_weekend',
          severity: 'medium',
          title: `Unusual Weekend Charge — ${t.vendor}`,
          description: `${money(t.amount)} from ${t.vendor} posted on a weekend (${t.date}); only ${(weekendShare * 100).toFixed(0)}% of your expenses land on weekends.`,
          detectedAmount: t.amount,
          suggestion: 'Confirm the charge was authorised. Off-hours charges from business vendors can indicate an unauthorised auto-renewal or fraud.',
          status: 'flagged',
        });
      }
    }
  }

  /* 5 ── category spikes: a category's monthly spend far above its recent norm ─ */
  if (rules.categorySpikes) {
    const partial = getPartialMonthKey(transactions);
    const catMonth = new Map<string, Map<string, { total: number; txs: Transaction[] }>>();
    for (const t of expenses) {
      const months = catMonth.get(t.category) ?? new Map();
      const cur = months.get(mk(t.date)) ?? { total: 0, txs: [] };
      cur.total += t.amount;
      cur.txs.push(t);
      months.set(mk(t.date), cur);
      catMonth.set(t.category, months);
    }
    const allMonths = [...new Set(expenses.map((t) => mk(t.date)))].filter((m) => m !== partial).sort();
    const recent = allMonths.slice(-3);
    for (const [category, months] of catMonth) {
      for (const month of recent) {
        const curr = months.get(month);
        if (!curr) continue;
        const priors = [1, 2, 3].map((n) => months.get(addMonths(month, -n))?.total).filter((v): v is number => v !== undefined && v > 0);
        if (priors.length < 2) continue;
        const avg = priors.reduce((s, v) => s + v, 0) / priors.length;
        const extra = curr.total - avg;
        const pct = (extra / avg) * 100;
        if (pct < rules.categorySpikePct || extra < rules.categorySpikeMin) continue;
        // already explained by price-hike / duplicate findings in the same category-month? then don't double count
        const monthTxIds = new Set(curr.txs.map((t) => t.id));
        const explained = anomalies
          .filter((a) => monthTxIds.has(a.transactionId))
          .reduce((s, a) => s + a.detectedAmount, 0);
        if (explained >= extra * 0.6) continue;
        const target = [...curr.txs].sort((a, b) => b.amount - a.amount)[0];
        anomalies.push({
          id: `anom-spike-${target.id}`,
          transactionId: target.id,
          type: 'category_spike',
          severity: pct >= 100 ? 'high' : 'medium',
          title: `Spending Spike — ${category} (+${pct.toFixed(0)}%)`,
          description: `${category} spend in ${month} was ${money(curr.total)} vs a ${priors.length}-month average of ${money(avg)}. Largest item: ${target.vendor} (${money(target.amount)}).`,
          detectedAmount: extra,
          suggestion: `Review the ${category} transactions for ${month}. If the spike is planned, ignore it; otherwise tighten approvals for this category.`,
          status: 'flagged',
        });
      }
    }
  }

  const rank = { high: 0, medium: 1 } as const;
  return anomalies.sort((a, b) => rank[a.severity] - rank[b.severity] || b.detectedAmount - a.detectedAmount);
}

/** Money still at risk: only flagged, recoverable anomalies count. */
export function totalLeakAmount(anomalies: Anomaly[]): number {
  return anomalies.filter((a) => a.status === 'flagged' && isLeak(a)).reduce((sum, a) => sum + a.detectedAmount, 0);
}

export function leakCountOf(anomalies: Anomaly[]): number {
  return anomalies.filter((a) => a.status === 'flagged' && isLeak(a)).length;
}

export function recoveredAmount(anomalies: Anomaly[]): number {
  return anomalies.filter((a) => a.status === 'refunded').reduce((sum, a) => sum + a.detectedAmount, 0);
}
