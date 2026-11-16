import type { ParseReport, ParseResult, Transaction, TransactionType } from '@/types';

/**
 * Universal bank-statement / ledger ingestion.
 *
 * CSV (PapaParse) and Excel (SheetJS) both reduce to a plain matrix of cells, which then goes through
 * one pipeline: header-row detection → column detection (by header name, then by content) →
 * direction (income/expense) inference → date-order inference → normalisation.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type Matrix = Cell[][];

const MAX_ROWS = 100_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/* ───────────── small helpers ───────────── */

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

function cellText(c: Cell): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return isoFromDate(c);
  return String(c).replace(/﻿/g, '').trim();
}

function isEmptyCell(c: Cell): boolean {
  return cellText(c) === '';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** SheetJS dates can land a few seconds before local midnight; +12h makes the local calendar day safe. */
function isoFromDate(d: Date): string {
  const t = new Date(d.getTime() + 12 * 3600 * 1000);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function fromExcelSerial(n: number): string | null {
  if (n < 20000 || n > 80000) return null; // ~1954–2119
  const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/* ───────────── number parsing ───────────── */

/** Parses "$1,234.56", "1.234,56 €", "(450.00)", "450.00-", "120 DR", "MAD 3 400,00" … */
export function parseNumber(value: Cell): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date || typeof value === 'boolean') return null;

  let s = String(value).replace(/﻿/g, '').trim();
  if (!s) return null;

  let negative = false;
  let positiveMark = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\b(dr|debit)\b/i.test(s)) negative = true;
  if (/\b(cr|credit)\b/i.test(s)) positiveMark = true;
  if (/-\s*$/.test(s)) negative = true;
  if (/^\s*[-−–]/.test(s)) negative = true;

  s = s.replace(/[^\d.,]/g, '');
  if (!s || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // the later separator is the decimal mark
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    const decimals = s.length - lastComma - 1;
    const commaCount = (s.match(/,/g) ?? []).length;
    if (commaCount === 1 && decimals !== 3) s = s.replace(',', '.'); // "12,50"
    else s = s.replace(/,/g, ''); // "1,234" / "1,234,567"
  } else if (lastDot !== -1) {
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount > 1) s = s.replace(/\./g, ''); // "1.234.567"
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (positiveMark && !negative) return n;
  return negative ? -n : n;
}

/* ───────────── date parsing ───────────── */

type DateOrder = 'MDY' | 'DMY';

const SLASH_DATE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:[ T].*)?$/;
const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/;

function inferDateOrder(values: Cell[]): DateOrder | 'ISO' {
  let aOver12 = 0; // first part > 12  → must be day first
  let bOver12 = 0; // second part > 12 → must be month first
  let iso = 0;
  let slash = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (ISO_DATE.test(s)) {
      iso++;
      continue;
    }
    const m = s.match(SLASH_DATE);
    if (!m) continue;
    slash++;
    if (Number(m[1]) > 12) aOver12++;
    if (Number(m[2]) > 12) bOver12++;
  }
  if (iso > 0 && slash === 0) return 'ISO';
  if (aOver12 > 0 && bOver12 === 0) return 'DMY';
  if (bOver12 > 0 && aOver12 === 0) return 'MDY';
  return 'MDY';
}

export function parseDate(value: Cell, order: DateOrder): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : isoFromDate(value);
  if (typeof value === 'number') return fromExcelSerial(value);
  if (typeof value === 'boolean') return null;

  const s = value.trim();
  if (!s) return null;

  const iso = s.match(ISO_DATE);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isValidYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }

  const sl = s.match(SLASH_DATE);
  if (sl) {
    let [a, b, y] = [Number(sl[1]), Number(sl[2]), Number(sl[3])];
    if (y < 100) y += 2000;
    let [mo, d] = order === 'DMY' ? [b, a] : [a, b];
    if (!isValidYmd(y, mo, d)) [mo, d] = [d, mo]; // last-resort swap when the inferred order is impossible
    return isValidYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // "15 Mar 2026", "March 15, 2026"
  if (/[a-z]{3}/i.test(s)) {
    const t = Date.parse(`${s} UTC`);
    const parsed = Number.isNaN(t) ? Date.parse(s) : t;
    if (!Number.isNaN(parsed)) {
      const dt = new Date(parsed + 12 * 3600 * 1000);
      const y = dt.getFullYear();
      if (y >= 1990 && y <= 2100) return `${y}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }
  }

  if (/^\d{5}(\.\d+)?$/.test(s)) return fromExcelSerial(Number(s));
  return null;
}

/* ───────────── header / column detection ───────────── */

const HEADER_WORDS = [
  'date', 'description', 'details', 'memo', 'narration', 'amount', 'debit', 'credit', 'vendor', 'merchant',
  'payee', 'category', 'type', 'balance', 'reference', 'name', 'value', 'particulars', 'withdrawal',
  'deposit', 'counterparty', 'supplier', 'customer', 'client', 'transaction',
];

function normHeader(s: string): string {
  return s.toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/[^\p{L}\p{N} /]/gu, '').trim();
}

function headerScore(row: Cell[]): number {
  let score = 0;
  for (const c of row) {
    if (typeof c !== 'string') continue;
    const h = normHeader(c);
    if (!h || /^\d+([.,]\d+)?$/.test(h)) continue;
    if (HEADER_WORDS.some((w) => h === w || h.split(' ').includes(w))) score++;
  }
  return score;
}

function detectHeaderRow(matrix: Matrix): number {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 25);
  for (let i = 0; i < limit; i++) {
    const nonEmpty = matrix[i].filter((c) => !isEmptyCell(c)).length;
    if (nonEmpty < 2) continue;
    const s = headerScore(matrix[i]);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  }
  return bestScore >= 2 ? best : 0;
}

interface ColumnSpec {
  exact: string[];
  tokens?: string[];
}

const COLUMN_SPECS: Record<string, ColumnSpec> = {
  date: {
    exact: ['date', 'transaction date', 'posted date', 'post date', 'posting date', 'booking date', 'value date', 'trans date', 'txn date', 'date posted'],
    tokens: ['date', 'datum', 'fecha'],
  },
  description: {
    exact: ['description', 'transaction description', 'details', 'memo', 'narration', 'particulars', 'remarks', 'note', 'notes', 'reference', 'item', 'label', 'libelle', 'libellé'],
    tokens: ['description', 'details', 'memo', 'narration', 'particulars', 'remarks', 'reference'],
  },
  vendor: {
    exact: ['vendor', 'merchant', 'payee', 'counterparty', 'supplier', 'client', 'customer', 'beneficiary', 'name', 'party', 'payer', 'account name'],
    tokens: ['vendor', 'merchant', 'payee', 'counterparty', 'supplier', 'beneficiary'],
  },
  category: {
    exact: ['category', 'tag', 'class', 'expense type', 'expense category', 'ledger', 'account', 'group', 'categorie', 'catégorie'],
    tokens: ['category', 'categorie'],
  },
  amount: {
    exact: ['amount', 'transaction amount', 'value', 'sum', 'total', 'net amount', 'montant', 'amount usd', 'amount eur'],
    tokens: ['amount', 'montant'],
  },
  debit: {
    exact: ['debit', 'debits', 'withdrawal', 'withdrawals', 'paid out', 'money out', 'outflow', 'dr', 'debit amount', 'expense'],
    tokens: ['debit', 'withdrawal', 'withdrawals'],
  },
  credit: {
    exact: ['credit', 'credits', 'deposit', 'deposits', 'paid in', 'money in', 'inflow', 'cr', 'credit amount', 'income', 'revenue'],
    tokens: ['credit', 'deposit', 'deposits'],
  },
  direction: {
    exact: ['transaction type', 'type', 'direction', 'dr/cr', 'cr/dr', 'debit/credit', 'credit/debit', 'flow', 'txn type', 'in/out'],
    tokens: ['direction'],
  },
};

function findColumn(headers: string[], key: string, used: Set<number>): number {
  const spec = COLUMN_SPECS[key];
  const norm = headers.map(normHeader);
  for (const candidate of spec.exact) {
    const idx = norm.findIndex((h, i) => !used.has(i) && h === candidate);
    if (idx !== -1) return idx;
  }
  for (const token of spec.tokens ?? []) {
    const idx = norm.findIndex((h, i) => !used.has(i) && h.split(' ').includes(token));
    if (idx !== -1) return idx;
  }
  return -1;
}

const INCOME_WORDS = /^(cr|credit|credits|income|deposit|deposits|revenue|inflow|in|sale|sales|received|receipt|refund|crédit)$/i;
const EXPENSE_WORDS = /^(dr|debit|debits|expense|expenses|withdrawal|withdrawals|outflow|out|purchase|payment|fee|charge|cost|spend|débit)$/i;

function directionFromWord(v: Cell): TransactionType | null {
  const s = cellText(v).toLowerCase();
  if (!s) return null;
  if (INCOME_WORDS.test(s)) return 'income';
  if (EXPENSE_WORDS.test(s)) return 'expense';
  if (/\b(income|credit|deposit|revenue|inflow)\b/.test(s)) return 'income';
  if (/\b(expense|debit|withdrawal|outflow)\b/.test(s)) return 'expense';
  return null;
}

/* ───────────── semantic inference ───────────── */

const REVENUE_HINT = /invoice paid|payment received|client payment|customer payment|deposit|revenue|sales|payout|stripe|paypal payout|income|refund received|interest earned/i;

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/salary|payroll|gusto|wage|compensation|adp|paychex|bonus|contractor payment/i, 'Payroll'],
  [/\baws\b|amazon web|azure|gcp|google cloud|digitalocean|heroku|vercel|cloudflare|hosting|server|infrastructure|cloud/i, 'Cloud'],
  [/ads\b|advert|adwords|marketing|campaign|facebook|meta ads|linkedin|\bseo\b|promo|sponsor|ad spend/i, 'Marketing'],
  [/slack|notion|figma|zoom|github|atlassian|jira|zapier|dropbox|microsoft 365|office 365|workspace|subscription|saas|openai|hubspot|salesforce|mailchimp/i, 'SaaS'],
  [/adobe|software|license|licence|app store|jetbrains/i, 'Software'],
  [/rent|lease|wework|office|furniture|coworking|regus/i, 'Office'],
  [/electric|water|\bgas\b|internet|utility|utilities|comcast|telecom|phone|verizon|vodafone|orange/i, 'Utilities'],
  [/legal|attorney|lawyer|law firm|consult|accounting|accountant|audit|bookkeep|advisory/i, 'Professional Services'],
  [/laptop|hardware|monitor|keyboard|equipment|apple store|dell\b|lenovo/i, 'Hardware'],
  [/flight|airline|hotel|uber|lyft|travel|airbnb|taxi|train|booking\.com/i, 'Travel'],
  [/restaurant|cafe|coffee|lunch|dinner|meal|doordash|catering/i, 'Meals'],
  [/insurance|insurer/i, 'Insurance'],
  [/bank fee|bank charge|service charge|interest|commission|wire fee|\bfee\b/i, 'Bank Fees'],
  [/\bvat\b|\btax\b|irs|hmrc|duty/i, 'Taxes'],
];

function inferCategory(description: string, vendor: string, type: TransactionType): string {
  const text = `${description} ${vendor}`;
  if (type === 'income') return 'Revenue';
  for (const [re, cat] of CATEGORY_RULES) if (re.test(text)) return cat;
  return 'Uncategorized';
}

function deriveVendor(description: string): string {
  const cleaned = description
    .replace(/\b(payment|invoice|purchase|pos|card|debit|credit|ach|wire|transfer|monthly|annual)\b/gi, ' ')
    .replace(/[#*\d]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 2).join(' ');
  return words || description.split(' ')[0] || 'Unknown';
}

/* ───────────── core pipeline ───────────── */

const SUMMARY_CELL = /^(total|totals|subtotal|grand total|closing balance|opening balance|balance b\/f|balance c\/f|balance brought forward|balance carried forward)$/i;

function looksLikeSummaryRow(texts: string[]): boolean {
  return texts.some((t) => SUMMARY_CELL.test(t.trim()));
}

export function parseMatrix(matrix: Matrix, sheetName?: string): ParseResult {
  const warnings: string[] = [];
  const rows = matrix.filter((r) => r && r.some((c) => !isEmptyCell(c)));
  if (rows.length < 2) {
    return emptyResult(sheetName, 0, 'The sheet has fewer than two non-empty rows.');
  }

  const headerRowIdx = detectHeaderRow(rows);
  const rawHeaders = rows[headerRowIdx].map((c, i) => cellText(c) || `Column ${i + 1}`);
  const body = rows.slice(headerRowIdx + 1);
  const width = Math.max(rawHeaders.length, ...body.slice(0, 200).map((r) => r.length));
  while (rawHeaders.length < width) rawHeaders.push(`Column ${rawHeaders.length + 1}`);

  const used = new Set<number>();
  const pick = (key: string): number => {
    const idx = findColumn(rawHeaders, key, used);
    if (idx !== -1) used.add(idx);
    return idx;
  };

  let dateCol = pick('date');
  let amountCol = pick('amount');
  const debitCol = pick('debit');
  const creditCol = pick('credit');
  let descCol = pick('description');
  let vendorCol = pick('vendor');
  const categoryCol = pick('category');
  let directionCol = pick('direction');

  const sample = body.slice(0, 500);
  const colValues = (i: number) => sample.map((r) => r[i]);
  const ratio = (i: number, test: (v: Cell) => boolean): number => {
    const vals = colValues(i).filter((v) => !isEmptyCell(v));
    return vals.length === 0 ? 0 : vals.filter(test).length / vals.length;
  };

  // content-based fallbacks
  if (dateCol === -1) {
    let best = -1;
    let bestRatio = 0.7;
    for (let i = 0; i < width; i++) {
      if (used.has(i)) continue;
      const r = ratio(i, (v) => parseDate(v, 'MDY') !== null && !(typeof v === 'number' && v < 20000));
      if (r > bestRatio) {
        best = i;
        bestRatio = r;
      }
    }
    dateCol = best;
    if (dateCol !== -1) {
      used.add(dateCol);
      warnings.push(`No "date" header found — used column "${rawHeaders[dateCol]}" because its values look like dates.`);
    }
  }
  if (amountCol === -1 && debitCol === -1 && creditCol === -1) {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < width; i++) {
      if (used.has(i)) continue;
      const r = ratio(i, (v) => parseNumber(v) !== null);
      if (/balance/i.test(rawHeaders[i])) continue;
      if (r > 0.7 && r >= bestScore) {
        best = i;
        bestScore = r;
      }
    }
    amountCol = best;
    if (amountCol !== -1) {
      used.add(amountCol);
      warnings.push(`No "amount" header found — used numeric column "${rawHeaders[amountCol]}".`);
    }
  }
  if (descCol === -1 && vendorCol === -1) {
    for (let i = 0; i < width; i++) {
      if (used.has(i) || i === categoryCol) continue;
      if (ratio(i, (v) => typeof v === 'string' && isNaN(Number(v))) > 0.7) {
        descCol = i;
        used.add(i);
        break;
      }
    }
  }

  // a "type" column only counts if it holds income/expense words, not categories
  if (directionCol !== -1 && ratio(directionCol, (v) => directionFromWord(v) !== null) < 0.6) {
    // the column is probably a category list — reuse it as category if none exists
    const asCategory = directionCol;
    directionCol = -1;
    if (categoryCol === -1) {
      warnings.push(`Column "${rawHeaders[asCategory]}" holds category-like values; it was used as the category.`);
      return finishWithCategory(asCategory);
    }
  }

  return finish(categoryCol);

  function finishWithCategory(catCol: number): ParseResult {
    return finish(catCol);
  }

  function finish(catCol: number): ParseResult {
    const hasSplitColumns = debitCol !== -1 || creditCol !== -1;
    if (dateCol === -1 || (amountCol === -1 && !hasSplitColumns)) {
      const missing = [dateCol === -1 ? 'a date column' : null, amountCol === -1 && !hasSplitColumns ? 'an amount (or debit/credit) column' : null]
        .filter(Boolean)
        .join(' and ');
      return emptyResult(sheetName, headerRowIdx + 1, `Could not find ${missing}.`, rawHeaders);
    }

    const dateOrder = inferDateOrder(body.slice(0, 2000).map((r) => r[dateCol]));
    const order: DateOrder = dateOrder === 'DMY' ? 'DMY' : 'MDY';

    // file-level sign statistics decide how single-amount files are read
    let pos = 0;
    let neg = 0;
    if (amountCol !== -1) {
      for (const r of body.slice(0, 5000)) {
        const n = parseNumber(r[amountCol]);
        if (n === null || n === 0) continue;
        if (n > 0) pos++;
        else neg++;
      }
    }
    const signed = pos > 0 && neg > 0;
    let directionMode: string;
    if (hasSplitColumns) directionMode = 'separate debit / credit columns';
    else if (directionCol !== -1) directionMode = `"${rawHeaders[directionCol]}" column`;
    else if (signed) directionMode = 'sign of amount (negative = expense)';
    else if (neg > 0 && pos === 0) directionMode = 'negative amounts = expenses';
    else {
      directionMode = 'keyword inference (all amounts positive)';
      warnings.push('The file has no debit/credit, type or negative amounts, so income vs. expense was inferred from keywords. Rows not recognised as revenue are treated as expenses.');
    }

    const canon = new Map<string, string>();
    const canonical = (v: string): string => {
      const k = v.toLowerCase();
      const hit = canon.get(k);
      if (hit) return hit;
      canon.set(k, v);
      return v;
    };

    const out: Transaction[] = [];
    let skipped = 0;
    const skipReasons: Record<string, number> = {};
    const skip = (reason: string) => {
      skipped++;
      skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
    };

    for (const r of body) {
      if (out.length >= MAX_ROWS) {
        warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} valid rows were imported.`);
        break;
      }
      const texts = r.map(cellText);
      if (texts.every((t) => t === '')) continue;
      if (looksLikeSummaryRow(texts.filter(Boolean))) {
        skip('summary/total rows');
        continue;
      }

      const date = parseDate(r[dateCol], order);
      if (!date) {
        skip('missing or invalid date');
        continue;
      }

      let amount = 0;
      let type: TransactionType | null = null;

      if (hasSplitColumns) {
        const debit = debitCol !== -1 ? parseNumber(r[debitCol]) : null;
        const credit = creditCol !== -1 ? parseNumber(r[creditCol]) : null;
        if (credit !== null && Math.abs(credit) > 0 && !(debit !== null && Math.abs(debit) > 0)) {
          amount = Math.abs(credit);
          type = 'income';
        } else if (debit !== null && Math.abs(debit) > 0) {
          amount = Math.abs(debit);
          type = 'expense';
        } else if (amountCol !== -1) {
          const n = parseNumber(r[amountCol]);
          if (n !== null && n !== 0) {
            amount = Math.abs(n);
            type = n < 0 ? 'expense' : 'income';
          }
        }
        if (type === null) {
          skip('no amount');
          continue;
        }
      } else {
        const n = parseNumber(r[amountCol]);
        if (n === null || n === 0) {
          skip('missing or zero amount');
          continue;
        }
        amount = Math.abs(n);
        if (directionCol !== -1) type = directionFromWord(r[directionCol]);
        if (type === null) {
          if (signed || (neg > 0 && pos === 0)) type = n < 0 ? 'expense' : 'income';
        }
        if (type === null) {
          const probe = `${descCol !== -1 ? cellText(r[descCol]) : ''} ${vendorCol !== -1 ? cellText(r[vendorCol]) : ''} ${catCol !== -1 ? cellText(r[catCol]) : ''}`;
          type = REVENUE_HINT.test(probe) || /^revenue$|^income$|^sales$/i.test(catCol !== -1 ? cellText(r[catCol]) : '') ? 'income' : 'expense';
        }
        // a negative value inside an explicit "income" row (e.g. refund) still counts as the stated direction
      }

      const description = descCol !== -1 ? cellText(r[descCol]) : '';
      let vendor = vendorCol !== -1 ? cellText(r[vendorCol]) : '';
      if (!vendor) vendor = description ? deriveVendor(description) : 'Unknown';
      vendor = canonical(vendor.replace(/\s+/g, ' '));

      const categoryRaw = catCol !== -1 ? cellText(r[catCol]) : '';
      const category = categoryRaw ? canonical(categoryRaw.replace(/\s+/g, ' ')) : inferCategory(description, vendor, type);

      out.push({
        id: newId(),
        date,
        description: description || vendor || 'Untitled transaction',
        vendor,
        category,
        amount: Math.round(amount * 100) / 100,
        type,
      });
    }

    const reasons = Object.entries(skipReasons).map(([k, v]) => `${v} × ${k}`);
    if (skipped > 0) warnings.push(`Skipped ${skipped} row${skipped === 1 ? '' : 's'}: ${reasons.join(', ')}.`);
    if (catCol === -1 && out.length > 0) warnings.push('No category column found — categories were inferred from descriptions and vendors.');

    const report: ParseReport = {
      sheetName,
      headerRow: headerRowIdx + 1,
      totalRows: body.length,
      importedRows: out.length,
      skippedRows: skipped,
      mapping: {
        date: dateCol !== -1 ? rawHeaders[dateCol] : null,
        amount: amountCol !== -1 ? rawHeaders[amountCol] : null,
        debit: debitCol !== -1 ? rawHeaders[debitCol] : null,
        credit: creditCol !== -1 ? rawHeaders[creditCol] : null,
        description: descCol !== -1 ? rawHeaders[descCol] : null,
        vendor: vendorCol !== -1 ? rawHeaders[vendorCol] : null,
        category: catCol !== -1 ? rawHeaders[catCol] : null,
        direction: directionCol !== -1 ? rawHeaders[directionCol] : null,
      },
      directionMode,
      dateOrder: dateOrder === 'ISO' ? 'ISO' : order,
      warnings,
    };
    return { transactions: out, report };
  }
}

function emptyResult(sheetName: string | undefined, headerRow: number, reason: string, headers?: string[]): ParseResult {
  return {
    transactions: [],
    report: {
      sheetName,
      headerRow,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      mapping: {},
      directionMode: 'n/a',
      dateOrder: 'ISO',
      warnings: [reason, ...(headers ? [`Columns seen: ${headers.slice(0, 12).join(', ')}`] : [])],
    },
  };
}

/* ───────────── file entry points ───────────── */

async function parseCSV(file: File): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;
  const matrix = await new Promise<Matrix>((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (res) => resolve(res.data as Matrix),
      error: (err: Error) => reject(err),
    });
  });
  return parseMatrix(matrix);
}

async function parseExcel(file: File): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  let best: ParseResult | null = null;
  const failures: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const matrix = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const res = parseMatrix(matrix, name);
    if (res.transactions.length === 0) failures.push(`${name}: ${res.report.warnings[0] ?? 'no rows'}`);
    if (!best || res.transactions.length > best.transactions.length) best = res;
  }
  if (!best || best.transactions.length === 0) {
    throw new Error(failures.length ? `No usable transactions found. ${failures.join(' | ')}` : 'The workbook has no readable sheets.');
  }
  if (wb.SheetNames.length > 1) {
    best.report.warnings.unshift(`Workbook has ${wb.SheetNames.length} sheets — imported "${best.report.sheetName}" (the one with the most valid rows).`);
  }
  return best;
}

export async function parseFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_BYTES) throw new Error('File is larger than 25 MB. Split it by period and upload the parts.');
  if (file.size === 0) throw new Error('The file is empty.');
  const ext = file.name.toLowerCase().split('.').pop();
  let result: ParseResult;
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') result = await parseCSV(file);
  else if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') result = await parseExcel(file);
  else throw new Error(`Unsupported file format ".${ext}". Upload a .csv, .xlsx or .xls file.`);

  if (result.transactions.length === 0) {
    throw new Error(result.report.warnings.join(' ') || 'No transactions found in the file.');
  }
  return result;
}
