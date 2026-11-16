import type { Anomaly, CopilotMessage, KPIData, MonthlyData, Transaction } from '@/types';
import { formatCurrency, formatCurrencyDetailed, formatRunway, groupTotals, getMonthLabel, isMarketingCategory } from '@/lib/cashFlowEngine';
import { isLeak } from '@/lib/anomalyDetector';
import type { TriggeredAlert } from '@/lib/alertEngine';

export interface CopilotContext {
  datasetName: string;
  transactions: Transaction[];
  anomalies: Anomaly[];
  kpis: KPIData;
  monthly: MonthlyData[];
  alerts: TriggeredAlert[];
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function createMessage(role: 'user' | 'assistant', content: string): CopilotMessage {
  return { id: generateId(), role, content, timestamp: Date.now() };
}

/** Suggestions are built from the active dataset, so they always work. */
export function getSuggestedQueries(ctx: Pick<CopilotContext, 'transactions' | 'anomalies'>): string[] {
  const cats = groupTotals(ctx.transactions, 'expense', 'category');
  const vendors = groupTotals(ctx.transactions, 'expense', 'vendor');
  const out = ['What are my top 3 expense categories?', 'What is my monthly burn rate and runway?'];
  if (cats[0]) out.push(`How much did I spend on ${cats[0].name}?`);
  if (vendors[0]) out.push(`Show all transactions for ${vendors[0].name}`);
  if (ctx.anomalies.length > 0) out.push('Explain my anomalies and leaks');
  out.push('Compare the last two months');
  return out.slice(0, 6);
}

/* ───────────── query understanding ───────────── */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

interface TimeFilter {
  keys: Set<string> | null;
  label: string;
}

function parseTime(q: string, ctx: CopilotContext): TimeFilter {
  const keys = ctx.monthly.map((m) => m.monthKey);
  const all: TimeFilter = {
    keys: null,
    label: keys.length ? `across all data (${getMonthLabel(keys[0])} – ${getMonthLabel(keys[keys.length - 1])})` : 'across all data',
  };
  if (keys.length === 0) return all;
  const latest = keys[keys.length - 1];
  const latestFull = [...ctx.monthly].reverse().find((m) => !m.partial)?.monthKey ?? latest;

  const lastN = q.match(/(?:last|past|previous)\s+(\d+|one|two|three|four|five|six|twelve)\s+months?/);
  if (lastN) {
    const n = NUM_WORDS[lastN[1]] ?? (lastN[1] === 'twelve' ? 12 : Number(lastN[1]));
    const set = new Set(keys.slice(-n));
    return { keys: set, label: `over the last ${set.size} month${set.size === 1 ? '' : 's'} of data` };
  }
  const quarter = q.match(/\bq([1-4])\b(?:\s*(20\d{2}))?/);
  if (quarter) {
    const qn = Number(quarter[1]);
    const year = quarter[2] ?? latest.slice(0, 4);
    const set = new Set(keys.filter((k) => k.startsWith(year) && Math.ceil(Number(k.slice(5)) / 3) === qn));
    return { keys: set, label: `in Q${qn} ${year}` };
  }
  const monthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b(?:\s*,?\s*(20\d{2}))?/;
  const mm = q.match(monthRe);
  if (mm && (mm[1] !== 'may' || /\bin may\b|\bmay (20\d{2}|spend|revenue|expenses?)\b|\bfor may\b|\bof may\b/.test(q))) {
    const num = MONTHS.indexOf(mm[1].slice(0, 3)) + 1;
    const candidates = keys.filter((k) => Number(k.slice(5)) === num && (!mm[2] || k.startsWith(mm[2])));
    if (candidates.length) {
      const k = candidates[candidates.length - 1];
      return { keys: new Set([k]), label: `in ${getMonthLabel(k)}` };
    }
    return { keys: new Set(), label: `in ${mm[1].toUpperCase()} (no data for that month)` };
  }
  const year = q.match(/\b(20\d{2})\b/);
  if (year) return { keys: new Set(keys.filter((k) => k.startsWith(year[1]))), label: `in ${year[1]}` };
  if (/\b(last|previous) month\b/.test(q)) return { keys: new Set([latestFull]), label: `in ${getMonthLabel(latestFull)} (latest full month)` };
  if (/\b(this|current|latest) month\b/.test(q)) return { keys: new Set([latest]), label: `in ${getMonthLabel(latest)} (latest month in data)` };
  if (/\bthis year\b|\bytd\b|\byear to date\b/.test(q)) return { keys: new Set(keys.filter((k) => k.startsWith(latest.slice(0, 4)))), label: `in ${latest.slice(0, 4)}` };
  return all;
}

interface Entities {
  categories: string[];
  vendors: string[];
}

function findEntities(q: string, ctx: CopilotContext): Entities {
  const match = (names: string[]): string[] => {
    const hits = names
      .filter((n) => n.length >= 3 && q.includes(n.toLowerCase()))
      .sort((a, b) => b.length - a.length);
    const kept: string[] = [];
    for (const h of hits) if (!kept.some((k) => k.toLowerCase().includes(h.toLowerCase()))) kept.push(h);
    return kept;
  };
  const categories = match([...new Set(ctx.transactions.map((t) => t.category))]);
  const vendors = match([...new Set(ctx.transactions.map((t) => t.vendor))]).filter(
    (v) => !categories.some((c) => c.toLowerCase() === v.toLowerCase())
  );
  if (categories.length === 0 && /\bmarketing\b|\badvertis|\bads\b/.test(q)) {
    const marketing = [...new Set(ctx.transactions.map((t) => t.category))].filter(isMarketingCategory);
    return { categories: marketing, vendors };
  }
  return { categories, vendors };
}

function topN(q: string, fallback: number): number {
  const digit = q.match(/\btop\s+(\d+)/);
  if (digit) return Math.min(25, Math.max(1, Number(digit[1])));
  const word = q.match(/\btop\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (word) return NUM_WORDS[word[1]];
  return fallback;
}

const bullets = (lines: string[]) => lines.map((l) => `• ${l}`).join('\n');

/* ───────────── local analyst ───────────── */

export function processLocalQuery(query: string, ctx: CopilotContext): string {
  const q = query.toLowerCase().trim().replace(/[?!.]+$/g, '');
  const { transactions, anomalies, kpis, monthly } = ctx;

  if (transactions.length === 0) return 'The active dataset has no transactions yet. Upload a file in **Data Manager** and I can analyse it.';
  if (!q || /^(hi|hello|hey|help|what can you do)\b/.test(q)) return helpText(ctx);

  const time = parseTime(q, ctx);
  const ents = findEntities(q, ctx);
  const wantsIncome = /\b(revenue|income|sales|earn(?:ed|ings)?|received|inflow|clients?|customers?)\b/.test(q);
  const wantsExpense = /\b(expenses?|spend|spent|spending|costs?|paid|outflow|burn)\b/.test(q);
  const type: 'income' | 'expense' = wantsIncome && !wantsExpense ? 'income' : 'expense';

  const filtered = (t: 'income' | 'expense' | 'both' = type): Transaction[] =>
    transactions.filter(
      (x) =>
        (t === 'both' || x.type === t) &&
        (!time.keys || time.keys.has(x.date.slice(0, 7))) &&
        (ents.categories.length === 0 || ents.categories.includes(x.category)) &&
        (ents.vendors.length === 0 || ents.vendors.includes(x.vendor))
    );
  const scopeLabel = [...ents.categories, ...ents.vendors].join(', ');
  const sum = (list: Transaction[]) => list.reduce((s, t) => s + t.amount, 0);

  /* anomalies, leaks, duplicates, price hikes */
  if (/anomal|suspicious|duplicate|double[- ]?charg|price (hike|increase|rise|jump)|overcharg|leak|waste|flagged|unusual|spike/.test(q)) {
    let list = anomalies;
    let focus = 'anomalies';
    if (/duplicate|double/.test(q)) {
      list = list.filter((a) => a.type === 'duplicate_invoice' || a.type === 'duplicate_subscription');
      focus = 'duplicate charges';
    } else if (/price/.test(q)) {
      list = list.filter((a) => a.type === 'price_hike');
      focus = 'price hikes';
    } else if (/weekend/.test(q)) {
      list = list.filter((a) => a.type === 'unusual_weekend');
      focus = 'weekend charges';
    } else if (/spike/.test(q)) {
      list = list.filter((a) => a.type === 'category_spike');
      focus = 'spending spikes';
    }
    if (ents.vendors.length) {
      const ids = new Set(transactions.filter((t) => ents.vendors.includes(t.vendor)).map((t) => t.id));
      list = list.filter((a) => ids.has(a.transactionId));
      focus += ` for ${ents.vendors.join(', ')}`;
    }
    if (list.length === 0) return `I found no ${focus} in **${ctx.datasetName}** with your current alert rules.`;
    const active = list.filter((a) => a.status === 'flagged');
    const total = list.filter((a) => a.status === 'flagged' && isLeak(a)).reduce((s, a) => s + a.detectedAmount, 0);
    const explain = /why|explain|detail|what is|what are/.test(q);
    const lines = list.slice(0, 8).map(
      (a) =>
        `**${a.title}** — ${formatCurrencyDetailed(a.detectedAmount)} (${a.severity}, ${a.status})\n  ${a.description}${explain ? `\n  → ${a.suggestion}` : ''}`
    );
    return `I found **${list.length} ${focus}** (${active.length} still open), worth **${formatCurrencyDetailed(total)}** in recoverable leaks.\n\n${bullets(lines)}${
      list.length > 8 ? `\n\n…and ${list.length - 8} more in the Anomaly Detector.` : ''
    }`;
  }

  /* runway, burn, balance */
  if (/runway|burn|cash balance|cash position|cash on hand|how long|\bbalance\b/.test(q)) {
    const runway = kpis.projectedRunwayDays >= 9999 ? 'unlimited (you are cash-flow positive)' : formatRunway(kpis.projectedRunwayDays);
    const recent = monthly.slice(-4).map((m) => `${m.month}: spent ${formatCurrency(m.expenses)}, earned ${formatCurrency(m.revenue)}${m.partial ? ' (partial)' : ''}`);
    return `**Cash position for ${ctx.datasetName}**\n\n${bullets([
      `Net cash balance: **${formatCurrency(kpis.netCashBalance)}**`,
      `Monthly burn (gross expenses): **${formatCurrency(kpis.monthlyBurnRate)}**`,
      `Net burn (expenses − revenue): **${formatCurrency(kpis.netBurnRate)}**/month`,
      `Runway: **${runway}**`,
    ])}\n\nRecent months:\n${bullets(recent)}`;
  }

  /* month-over-month comparison */
  if (/compare|versus|\bvs\b|month over month|\bmom\b|trend|growth|grew|how (has|have|did).*change/.test(q)) {
    const full = monthly.filter((m) => !m.partial);
    if (full.length < 2) return 'I need at least two full months of data to compare periods.';
    const a = full[full.length - 2];
    const b = full[full.length - 1];
    const pct = (x: number, y: number) => (x === 0 ? 'n/a' : `${y >= x ? '+' : ''}${(((y - x) / x) * 100).toFixed(1)}%`);
    const catNow = new Map(groupTotals(transactions.filter((t) => t.date.startsWith(b.monthKey)), 'expense', 'category').map((s) => [s.name, s.value]));
    const catPrev = new Map(groupTotals(transactions.filter((t) => t.date.startsWith(a.monthKey)), 'expense', 'category').map((s) => [s.name, s.value]));
    const deltas = [...new Set([...catNow.keys(), ...catPrev.keys()])]
      .map((c) => ({ c, d: (catNow.get(c) ?? 0) - (catPrev.get(c) ?? 0) }))
      .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
      .slice(0, 3);
    return `**${a.month} → ${b.month}**\n\n${bullets([
      `Revenue: ${formatCurrency(a.revenue)} → ${formatCurrency(b.revenue)} (${pct(a.revenue, b.revenue)})`,
      `Expenses: ${formatCurrency(a.expenses)} → ${formatCurrency(b.expenses)} (${pct(a.expenses, b.expenses)})`,
      `Net cash flow: ${formatCurrency(a.netCashFlow)} → ${formatCurrency(b.netCashFlow)}`,
    ])}\n\nBiggest category movers:\n${bullets(deltas.map((x) => `${x.c}: ${x.d >= 0 ? '+' : '-'}${formatCurrency(Math.abs(x.d))}`))}`;
  }

  /* net / profit */
  if (/\bnet\b|profit|margin|cash ?flow|surplus|deficit/.test(q)) {
    const inc = sum(filtered('income'));
    const exp = sum(filtered('expense'));
    const net = inc - exp;
    return `Net cash flow ${time.label}${scopeLabel ? ` for ${scopeLabel}` : ''} is **${formatCurrency(net)}**.\n\n${bullets([
      `Income: ${formatCurrency(inc)}`,
      `Expenses: ${formatCurrency(exp)}`,
      inc > 0 ? `Net margin: ${((net / inc) * 100).toFixed(1)}%` : 'Net margin: n/a (no income in scope)',
    ])}\n\n${net >= 0 ? 'You are cash-flow positive in this scope.' : 'You are running at a deficit in this scope.'}`;
  }

  /* rankings */
  if (/\btop\b|biggest|largest|highest|most expensive|costliest|\bbest\b/.test(q)) {
    const n = topN(q, /\btop\b/.test(q) ? 5 : 5);
    const kind = /vendor|supplier|merchant|payee|client|customer/.test(q)
      ? 'vendor'
      : /categor/.test(q)
        ? 'category'
        : /transaction|charge|payment|invoice|purchase|single|biggest|largest|highest|most expensive/.test(q) && !/\btop\b.*(expenses|spend)/.test(q)
          ? 'transaction'
          : 'category';
    const list = filtered();
    if (list.length === 0) return `No ${type} transactions match that scope (${time.label}).`;
    const noun = type === 'income' ? 'revenue' : 'expense';
    if (kind === 'transaction') {
      const rows = [...list].sort((a, b) => b.amount - a.amount).slice(0, n);
      return `Top ${rows.length} ${noun} transactions ${time.label}${scopeLabel ? ` (${scopeLabel})` : ''}:\n\n${bullets(
        rows.map((t) => `**${formatCurrency(t.amount)}** — ${t.vendor} · ${t.category} · ${t.date}`)
      )}`;
    }
    const slices = groupTotals(list, type, kind).slice(0, n);
    const total = sum(list);
    return `Top ${slices.length} ${noun} ${kind === 'vendor' ? (type === 'income' ? 'clients' : 'vendors') : 'categories'} ${time.label}:\n\n${bullets(
      slices.map((s, i) => `**${i + 1}. ${s.name}** — ${formatCurrency(s.value)} (${((s.value / total) * 100).toFixed(1)}%, ${s.count} transactions)`)
    )}\n\nTotal ${noun}: **${formatCurrency(total)}**.`;
  }

  /* counts */
  if (/how many|count|number of/.test(q)) {
    const list = filtered(wantsIncome || wantsExpense ? type : 'both');
    return `There ${list.length === 1 ? 'is' : 'are'} **${list.length.toLocaleString()}** matching transactions ${time.label}${scopeLabel ? ` for ${scopeLabel}` : ''}, totalling **${formatCurrency(sum(list))}**.`;
  }

  /* averages */
  if (/average|\bavg\b|\bmean\b/.test(q)) {
    const list = filtered();
    if (list.length === 0) return 'No transactions match that scope.';
    const monthsInScope = new Set(list.map((t) => t.date.slice(0, 7))).size;
    return `Average ${type} ${time.label}${scopeLabel ? ` for ${scopeLabel}` : ''}:\n\n${bullets([
      `Per transaction: **${formatCurrencyDetailed(sum(list) / list.length)}**`,
      `Per month: **${formatCurrency(sum(list) / monthsInScope)}** (over ${monthsInScope} month${monthsInScope === 1 ? '' : 's'})`,
    ])}`;
  }

  /* totals (also catches "how much did I spend on X", "revenue in March", or a bare vendor/category name) */
  const hasScope = ents.categories.length > 0 || ents.vendors.length > 0;
  if (/total|how much|sum|spend|spent|revenue|income|sales|cost|paid|earn/.test(q) || hasScope) {
    const list = filtered(hasScope && !wantsIncome && !wantsExpense ? 'both' : type);
    if (list.length === 0) return `I found no matching transactions ${time.label}${scopeLabel ? ` for ${scopeLabel}` : ''}.`;
    const inc = sum(list.filter((t) => t.type === 'income'));
    const exp = sum(list.filter((t) => t.type === 'expense'));
    const mixed = inc > 0 && exp > 0;
    const total = mixed ? exp : inc || exp;
    const noun = mixed ? 'spending' : inc > 0 ? 'revenue' : 'spending';
    let breakdown: string;
    if (ents.categories.length > 0) {
      breakdown = `By ${inc > 0 && !mixed ? 'client' : 'vendor'}:\n${bullets(groupTotals(list, inc > 0 && !mixed ? 'income' : 'expense', 'vendor').slice(0, 6).map((s) => `${s.name}: ${formatCurrency(s.value)} (${s.count}×)`))}`;
    } else if (ents.vendors.length > 0) {
      const byMonth = new Map<string, number>();
      for (const t of list) byMonth.set(t.date.slice(0, 7), (byMonth.get(t.date.slice(0, 7)) ?? 0) + t.amount);
      breakdown = `By month:\n${bullets([...byMonth.entries()].sort().map(([k, v]) => `${getMonthLabel(k)}: ${formatCurrency(v)}`))}`;
    } else {
      const g = groupTotals(list, inc > 0 && !mixed ? 'income' : 'expense', 'category').slice(0, 6);
      breakdown = `By category:\n${bullets(g.map((s) => `${s.name}: ${formatCurrency(s.value)} (${((s.value / total) * 100).toFixed(0)}%)`))}`;
    }
    return `Total ${noun} ${time.label}${scopeLabel ? ` for **${scopeLabel}**` : ''}: **${formatCurrency(total)}** across ${list.length} transactions.${
      mixed ? ` (Income in the same scope: ${formatCurrency(inc)}.)` : ''
    }\n\n${breakdown}`;
  }

  return helpText(ctx);
}

function helpText(ctx: CopilotContext): string {
  const sugg = getSuggestedQueries(ctx);
  return `I'm connected to **${ctx.datasetName}** (${ctx.transactions.length.toLocaleString()} transactions). I can answer things like:\n\n${bullets([
    'Totals and breakdowns — "How much did I spend on Marketing in March?"',
    'Rankings — "Top 5 vendors", "largest transactions last 3 months"',
    'Cash position — "What is my runway?"',
    'Anomalies — "Explain my duplicate charges" or "Any price hikes?"',
    'Comparisons — "Compare the last two months"',
  ])}\n\nTry: ${sugg.slice(0, 3).map((s) => `"${s}"`).join(', ')}.`;
}

/* ───────────── optional LLM mode ───────────── */

/** Compact, aggregate-only context: far better than dumping the first 50 rows, and never leaks row-level data beyond need. */
function buildDataContext(ctx: CopilotContext): string {
  const exp = groupTotals(ctx.transactions, 'expense', 'category');
  const inc = groupTotals(ctx.transactions, 'income', 'category');
  const vendors = groupTotals(ctx.transactions, 'expense', 'vendor').slice(0, 25);
  const clients = groupTotals(ctx.transactions, 'income', 'vendor').slice(0, 15);
  return JSON.stringify(
    {
      dataset: ctx.datasetName,
      transactionCount: ctx.transactions.length,
      kpis: ctx.kpis,
      monthly: ctx.monthly.map((m) => ({ month: m.monthKey, revenue: m.revenue, expenses: m.expenses, net: m.netCashFlow, cash: m.cumulativeCash, partial: m.partial ?? false })),
      expenseByCategory: exp.map((s) => ({ name: s.name, total: Math.round(s.value), count: s.count })),
      revenueByCategory: inc.map((s) => ({ name: s.name, total: Math.round(s.value), count: s.count })),
      topVendors: vendors.map((s) => ({ name: s.name, total: Math.round(s.value), count: s.count })),
      topClients: clients.map((s) => ({ name: s.name, total: Math.round(s.value), count: s.count })),
      anomalies: ctx.anomalies.slice(0, 30).map((a) => ({ type: a.type, title: a.title, amount: Math.round(a.detectedAmount), severity: a.severity, status: a.status })),
      triggeredAlerts: ctx.alerts.map((a) => a.title),
    },
    null,
    1
  );
}

export async function processLLMQuery(query: string, ctx: CopilotContext, apiKey: string, provider: 'openai' | 'groq'): Promise<string> {
  const systemPrompt = `You are FinSight AI, a financial analyst copilot. Answer ONLY from the dataset summary below; if the answer is not derivable from it, say so. Be concise, quantitative and actionable. Use **bold** for key figures and "• " bullets for lists. Do not use HTML.\n\nDATASET SUMMARY:\n${buildDataContext(ctx)}`;
  const endpoints = { openai: 'https://api.openai.com/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions' };
  const models = { openai: 'gpt-4o-mini', groq: 'llama-3.3-70b-versatile' };

  const response = await fetch(endpoints[provider], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: models[provider],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      max_tokens: 900,
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'No response received from the AI.';
}
