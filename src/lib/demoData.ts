/**
 * Generates a realistic synthetic company bank export (CSV) on demand.
 * It is NOT stored anywhere: the file goes through the exact same upload → parse → persist pipeline as a
 * real user file, ending at the last complete month before today. Deterministic seed → reproducible demos.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Row {
  date: string;
  description: string;
  vendor: string;
  category: string;
  amount: number; // signed: negative = money out
}

const pad = (n: number) => String(n).padStart(2, '0');

function isoUTC(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Push weekend dates to the following Monday, as banks settle on business days. */
function businessDay(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m, d));
  const dow = dt.getUTCDay();
  if (dow === 6) dt.setUTCDate(dt.getUTCDate() + 2);
  if (dow === 0) dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export const DEMO_OPENING_BALANCE = 120_000;
export const DEMO_FILE_NAME = 'FinSight_Demo_Company_Statement.csv';

export function generateDemoFile(now = new Date()): File {
  const rand = mulberry32(20260615);
  const jitter = (base: number, pct: number) => Math.round(base * (1 + (rand() - 0.5) * 2 * pct));
  const MONTHS = 8;
  const rows: Row[] = [];

  // last complete month before `now`
  const endIdx = now.getFullYear() * 12 + now.getMonth() - 1;
  for (let i = 0; i < MONTHS; i++) {
    const idx = endIdx - (MONTHS - 1 - i);
    const y = Math.floor(idx / 12);
    const m = idx % 12;
    const last = i === MONTHS - 1;
    const growth = 1 + i * 0.018;

    // revenue
    rows.push({ date: businessDay(y, m, 3), description: 'Invoice paid — Retainer', vendor: 'Acme Corp', category: 'Revenue', amount: Math.round(18500 * growth) });
    rows.push({ date: businessDay(y, m, 10), description: 'Invoice paid — Platform licence', vendor: 'TechFlow Inc', category: 'Revenue', amount: jitter(12500 * growth, 0.04) });
    rows.push({ date: businessDay(y, m, 15), description: 'Invoice paid — Analytics project', vendor: 'Globex', category: 'Revenue', amount: jitter(10200 * growth, 0.08) });
    rows.push({ date: businessDay(y, m, 25), description: 'Invoice paid — Support plan', vendor: 'Initech', category: 'Revenue', amount: jitter(7300 * growth, 0.05) });
    if (i % 2 === 1) rows.push({ date: businessDay(y, m, 19), description: 'Invoice paid — Implementation', vendor: 'Umbrella Ltd', category: 'Revenue', amount: jitter(5200, 0.1) });

    // fixed costs
    rows.push({ date: businessDay(y, m, 5), description: 'Monthly payroll — Engineering', vendor: 'Gusto', category: 'Payroll', amount: -(i < 4 ? 32000 : 34000) });
    rows.push({ date: businessDay(y, m, 20), description: 'Office lease', vendor: 'WeWork', category: 'Office', amount: -3800 });
    rows.push({ date: businessDay(y, m, 7), description: 'Google Workspace', vendor: 'Google Workspace', category: 'SaaS', amount: -180 });
    rows.push({ date: businessDay(y, m, 12), description: 'Figma organisation plan', vendor: 'Figma', category: 'SaaS', amount: -75 });
    rows.push({ date: businessDay(y, m, 14), description: 'Slack Pro', vendor: 'Slack', category: 'SaaS', amount: -96 });
    rows.push({ date: businessDay(y, m, 28), description: 'Notion team plan', vendor: 'Notion', category: 'SaaS', amount: -48 });
    rows.push({ date: businessDay(y, m, 22), description: 'Adobe Creative Cloud', vendor: 'Adobe', category: 'Software', amount: -240 });
    rows.push({ date: businessDay(y, m, 16), description: 'Zapier automation', vendor: 'Zapier', category: 'SaaS', amount: -49 });

    // variable costs
    const awsBase = 2400 + i * 90;
    rows.push({ date: businessDay(y, m, 6), description: 'AWS infrastructure', vendor: 'Amazon Web Services', category: 'Cloud', amount: -(last ? Math.round(awsBase * 1.42) : jitter(awsBase, 0.04)) });
    const linkedin = last ? 5400 : jitter(3500 + i * 40, 0.04);
    rows.push({ date: businessDay(y, m, 8), description: 'LinkedIn Ads campaign', vendor: 'LinkedIn', category: 'Marketing', amount: -linkedin });
    rows.push({ date: businessDay(y, m, 18), description: 'Google Ads — search', vendor: 'Google Ads', category: 'Marketing', amount: -jitter(4600, 0.05) });
    rows.push({ date: businessDay(y, m, 11), description: 'Client lunch & meals', vendor: 'Local Bistro', category: 'Meals', amount: -jitter(260, 0.12) });
    rows.push({ date: businessDay(y, m, 21), description: 'Team travel', vendor: 'Delta Airlines', category: 'Travel', amount: -(last ? 4800 : jitter(620, 0.3)) });
    if (i % 3 === 0) rows.push({ date: businessDay(y, m, 14), description: 'Legal consultation', vendor: 'Smith & Associates', category: 'Professional Services', amount: -jitter(1200, 0.15) });
    if (i % 3 === 2) rows.push({ date: businessDay(y, m, 9), description: 'Business insurance premium', vendor: 'Hiscox', category: 'Insurance', amount: -1350 });

    // injected leaks so the detectors have something real to find
    if (i === MONTHS - 3) rows.push({ date: businessDay(y, m, 15), description: 'Slack Pro (duplicate charge)', vendor: 'Slack', category: 'SaaS', amount: -96 });
    if (i === MONTHS - 2) rows.push({ date: businessDay(y, m, 22), description: 'Adobe Creative Cloud (second invoice)', vendor: 'Adobe', category: 'Software', amount: -240 });
    if (i === MONTHS - 4) {
      // a Saturday charge from an unfamiliar vendor
      const dt = new Date(Date.UTC(y, m, 1));
      while (dt.getUTCDay() !== 6) dt.setUTCDate(dt.getUTCDate() + 1);
      rows.push({ date: isoUTC(y, m, dt.getUTCDate() + 7), description: 'Cloud backup add-on', vendor: 'BackupHub', category: 'Cloud', amount: -450 });
    }
    if (last) rows.push({ date: businessDay(y, m, 9), description: 'Conference sponsorship package', vendor: 'TechSummit Events', category: 'Marketing', amount: -9000 });
    if (last) rows.push({ date: businessDay(y, m, 17), description: 'Zapier annual auto-renewal', vendor: 'Zapier', category: 'SaaS', amount: -720 });
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [
    'Date,Description,Vendor,Category,Amount',
    ...rows.map((r) => `${r.date},${esc(r.description)},${esc(r.vendor)},${esc(r.category)},${r.amount.toFixed(2)}`),
  ].join('\n');
  return new File([csv], DEMO_FILE_NAME, { type: 'text/csv' });
}
