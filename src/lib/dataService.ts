import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatasetRecord, PlanTier, SyncMode, Transaction, WorkspaceRecord, WorkspaceSettings } from '@/types';
import { defaultSettings, mergeSettings } from '@/lib/defaults';
import { supabase } from '@/lib/supabase';

/* ───────────── contract ───────────── */

export interface NewDataset {
  name: string;
  fileName: string;
  source: DatasetRecord['source'];
  openingBalance: number;
}

export interface DataService {
  mode: SyncMode;
  /** Why we fell back to local mode (shown in the UI). */
  note?: string;
  init(): Promise<{ workspace: WorkspaceRecord; datasets: DatasetRecord[] }>;
  createDataset(input: NewDataset, transactions: Transaction[], onProgress?: (pct: number) => void): Promise<DatasetRecord>;
  loadTransactions(datasetId: string): Promise<Transaction[]>;
  updateDataset(id: string, patch: Partial<Pick<DatasetRecord, 'name' | 'openingBalance'>>): Promise<DatasetRecord>;
  deleteDataset(id: string): Promise<void>;
  saveWorkspace(patch: { plan?: PlanTier; settings?: WorkspaceSettings; name?: string }): Promise<void>;
  resetAll(): Promise<void>;
}

export function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function summarize(transactions: Transaction[]) {
  let from: string | null = null;
  let to: string | null = null;
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (!from || t.date < from) from = t.date;
    if (!to || t.date > to) to = t.date;
    if (t.type === 'income') income += t.amount;
    else expenses += t.amount;
  }
  return {
    rowCount: transactions.length,
    dateFrom: from,
    dateTo: to,
    totalIncome: Math.round(income * 100) / 100,
    totalExpenses: Math.round(expenses * 100) / 100,
  };
}

/* ───────────── local implementation (IndexedDB + localStorage) ───────────── */

const LS_WORKSPACE = 'finsight:v2:workspace';
const LS_DATASETS = 'finsight:v2:datasets';
const IDB_NAME = 'finsight';
const IDB_STORE = 'transactions';

const memoryFallback = new Map<string, Transaction[]>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbRun<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, mode);
      const req = fn(tx.objectStore(IDB_STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

async function txGet(id: string): Promise<Transaction[] | undefined> {
  try {
    return (await idbRun<Transaction[] | undefined>('readonly', (s) => s.get(id))) ?? memoryFallback.get(id);
  } catch {
    return memoryFallback.get(id);
  }
}

async function txSet(id: string, rows: Transaction[]): Promise<void> {
  try {
    await idbRun('readwrite', (s) => s.put(rows, id));
  } catch {
    memoryFallback.set(id, rows);
  }
}

async function txDelete(id: string): Promise<void> {
  memoryFallback.delete(id);
  try {
    await idbRun('readwrite', (s) => s.delete(id));
  } catch {
    /* nothing persisted */
  }
}

function lsRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked — state still lives in memory for this session */
  }
}

export function createLocalService(note?: string): DataService {
  let workspace: WorkspaceRecord | null = null;
  let datasets: DatasetRecord[] = [];

  const persist = () => {
    if (workspace) lsWrite(LS_WORKSPACE, workspace);
    lsWrite(LS_DATASETS, datasets);
  };

  return {
    mode: 'local',
    note,
    async init() {
      const stored = lsRead<WorkspaceRecord>(LS_WORKSPACE);
      workspace = stored
        ? { ...stored, settings: mergeSettings(stored.settings) }
        : {
            id: newUuid(),
            name: 'My Workspace',
            sessionId: newUuid(),
            plan: 'starter',
            settings: defaultSettings(),
            createdAt: new Date().toISOString(),
          };
      datasets = lsRead<DatasetRecord[]>(LS_DATASETS) ?? [];
      persist();
      return { workspace, datasets: [...datasets] };
    },
    async createDataset(input, transactions, onProgress) {
      if (!workspace) throw new Error('Workspace not initialised');
      const record: DatasetRecord = {
        id: newUuid(),
        workspaceId: workspace.id,
        name: input.name,
        fileName: input.fileName,
        sessionId: newUuid(),
        source: input.source,
        openingBalance: input.openingBalance,
        createdAt: new Date().toISOString(),
        ...summarize(transactions),
      };
      onProgress?.(30);
      await txSet(record.id, transactions);
      onProgress?.(100);
      datasets = [record, ...datasets];
      persist();
      return record;
    },
    async loadTransactions(datasetId) {
      return (await txGet(datasetId)) ?? [];
    },
    async updateDataset(id, patch) {
      const idx = datasets.findIndex((d) => d.id === id);
      if (idx === -1) throw new Error('Dataset not found');
      datasets[idx] = { ...datasets[idx], ...patch };
      persist();
      return datasets[idx];
    },
    async deleteDataset(id) {
      datasets = datasets.filter((d) => d.id !== id);
      await txDelete(id);
      persist();
    },
    async saveWorkspace(patch) {
      if (!workspace) return;
      workspace = { ...workspace, ...patch };
      persist();
    },
    async resetAll() {
      for (const d of datasets) await txDelete(d.id);
      datasets = [];
      if (workspace) workspace = { ...workspace, settings: defaultSettings(), plan: 'starter' };
      persist();
    },
  };
}

/* ───────────── Supabase implementation ───────────── */

interface WorkspaceRow {
  id: string;
  name: string;
  session_id: string;
  plan: PlanTier;
  settings: unknown;
  created_at: string;
}

interface DatasetRow {
  id: string;
  workspace_id: string;
  name: string;
  file_name: string;
  session_id: string;
  source: DatasetRecord['source'];
  row_count: number;
  opening_balance: number | string;
  date_from: string | null;
  date_to: string | null;
  total_income: number | string;
  total_expenses: number | string;
  created_at: string;
}

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  vendor: string;
  category: string;
  amount: number | string;
  type: 'income' | 'expense';
}

const toWorkspace = (r: WorkspaceRow): WorkspaceRecord => ({
  id: r.id,
  name: r.name,
  sessionId: r.session_id,
  plan: r.plan,
  settings: mergeSettings(r.settings),
  createdAt: r.created_at,
});

const toDataset = (r: DatasetRow): DatasetRecord => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  fileName: r.file_name,
  sessionId: r.session_id,
  source: r.source,
  rowCount: r.row_count,
  openingBalance: Number(r.opening_balance),
  dateFrom: r.date_from,
  dateTo: r.date_to,
  totalIncome: Number(r.total_income),
  totalExpenses: Number(r.total_expenses),
  createdAt: r.created_at,
});

const CHUNK = 1000;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown error'}`);
}

export function createSupabaseService(sb: SupabaseClient): DataService {
  let workspaceId = '';

  return {
    mode: 'supabase',
    async init() {
      const { data: sessionData } = await sb.auth.getSession();
      let user = sessionData.session?.user ?? null;
      if (!user) {
        const { data, error } = await sb.auth.signInAnonymously();
        if (error || !data.user) fail('Anonymous sign-in failed (enable it under Authentication → Providers)', error);
        user = data.user;
      }

      const fetchWorkspace = async () =>
        sb.from('workspaces').select('*').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle<WorkspaceRow>();

      let { data: ws, error } = await fetchWorkspace();
      if (error) fail('Could not load workspace', error);
      if (!ws) {
        const ins = await sb
          .from('workspaces')
          .insert({ owner_id: user.id, name: 'My Workspace', session_id: newUuid(), plan: 'starter', settings: defaultSettings() })
          .select('*')
          .single<WorkspaceRow>();
        if (ins.error) {
          // another tab may have created it first (unique owner index) — re-read before giving up
          const again = await fetchWorkspace();
          if (again.error || !again.data) fail('Could not create workspace', ins.error);
          ws = again.data;
        } else {
          ws = ins.data;
        }
      }
      if (!ws) throw new Error('Could not load workspace');
      workspaceId = ws.id;

      const dsRes = await sb.from('datasets').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
      if (dsRes.error) fail('Could not load datasets', dsRes.error);
      return { workspace: toWorkspace(ws), datasets: ((dsRes.data ?? []) as DatasetRow[]).map(toDataset) };
    },

    async createDataset(input, transactions, onProgress) {
      const stats = summarize(transactions);
      const { data, error } = await sb
        .from('datasets')
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          file_name: input.fileName,
          session_id: newUuid(),
          source: input.source,
          row_count: stats.rowCount,
          opening_balance: input.openingBalance,
          date_from: stats.dateFrom,
          date_to: stats.dateTo,
          total_income: stats.totalIncome,
          total_expenses: stats.totalExpenses,
        })
        .select('*')
        .single<DatasetRow>();
      if (error || !data) fail('Could not create dataset', error);

      for (let i = 0; i < transactions.length; i += CHUNK) {
        const rows = transactions.slice(i, i + CHUNK).map((t) => ({
          id: t.id,
          dataset_id: data.id,
          workspace_id: workspaceId,
          date: t.date,
          description: t.description,
          vendor: t.vendor,
          category: t.category,
          amount: t.amount,
          type: t.type,
        }));
        const res = await sb.from('transactions').insert(rows);
        if (res.error) {
          await sb.from('datasets').delete().eq('id', data.id); // roll back the half-written dataset
          fail('Could not save transactions', res.error);
        }
        onProgress?.(Math.min(100, Math.round(((i + rows.length) / transactions.length) * 100)));
      }
      return toDataset(data);
    },

    async loadTransactions(datasetId) {
      const out: Transaction[] = [];
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await sb
          .from('transactions')
          .select('id,date,description,vendor,category,amount,type')
          .eq('dataset_id', datasetId)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + CHUNK - 1);
        if (error) fail('Could not load transactions', error);
        const rows = (data ?? []) as TransactionRow[];
        for (const r of rows) out.push({ ...r, amount: Number(r.amount) });
        if (rows.length < CHUNK) break;
      }
      return out;
    },

    async updateDataset(id, patch) {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.openingBalance !== undefined) body.opening_balance = patch.openingBalance;
      const { data, error } = await sb.from('datasets').update(body).eq('id', id).select('*').single<DatasetRow>();
      if (error || !data) fail('Could not update dataset', error);
      return toDataset(data);
    },

    async deleteDataset(id) {
      const { error } = await sb.from('datasets').delete().eq('id', id);
      if (error) fail('Could not delete dataset', error);
    },

    async saveWorkspace(patch) {
      const body: Record<string, unknown> = {};
      if (patch.plan) body.plan = patch.plan;
      if (patch.settings) body.settings = patch.settings;
      if (patch.name) body.name = patch.name;
      const { error } = await sb.from('workspaces').update(body).eq('id', workspaceId);
      if (error) fail('Could not save workspace', error);
    },

    async resetAll() {
      const { error } = await sb.from('datasets').delete().eq('workspace_id', workspaceId);
      if (error) fail('Could not reset workspace', error);
      await sb.from('workspaces').update({ settings: defaultSettings(), plan: 'starter' }).eq('id', workspaceId);
    },
  };
}

/** Prefer Supabase; if it is not configured or unreachable, degrade to local mode and say why. */
export async function bootDataService(): Promise<{ service: DataService; workspace: WorkspaceRecord; datasets: DatasetRecord[] }> {
  if (supabase) {
    try {
      const service = createSupabaseService(supabase);
      const state = await service.init();
      return { service, ...state };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Supabase unavailable';
      const service = createLocalService(`Supabase unavailable — running in local mode. ${reason}`);
      const state = await service.init();
      return { service, ...state };
    }
  }
  const service = createLocalService('Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY). Data is stored in this browser.');
  const state = await service.init();
  return { service, ...state };
}
