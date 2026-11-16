import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  Anomaly,
  AnomalyStatus,
  DatasetRecord,
  KPIData,
  MonthlyData,
  ParseReport,
  PlanTier,
  SyncMode,
  Transaction,
  WorkspaceRecord,
  WorkspaceSettings,
} from '@/types';
import { bootDataService, newUuid, type DataService } from '@/lib/dataService';
import { parseFile } from '@/lib/fileParser';
import { generateDemoFile, DEMO_OPENING_BALANCE } from '@/lib/demoData';
import { detectAnomalies } from '@/lib/anomalyDetector';
import { computeBaseline, computeKPIs, computeMonthlyData, type Baseline } from '@/lib/cashFlowEngine';
import { computeHealthScore, type HealthScore } from '@/lib/healthScore';
import { evaluateAlerts, type TriggeredAlert } from '@/lib/alertEngine';
import { can, PLAN_LIMITS, STARTER_ANOMALY_TYPES, type FeatureKey } from '@/lib/plans';
import { currentMonthKey } from '@/lib/defaults';

const ACTIVE_KEY = 'finsight:v2:active';

export class PlanLimitError extends Error {
  kind: 'uploads' | 'copilot';
  constructor(kind: 'uploads' | 'copilot', message: string) {
    super(message);
    this.kind = kind;
    this.name = 'PlanLimitError';
  }
}

export interface IngestResult {
  dataset: DatasetRecord;
  report: ParseReport | null;
}

export interface UpgradePrompt {
  feature?: FeatureKey;
  reason?: string;
}

export interface Analysis {
  monthly: MonthlyData[];
  /** every anomaly the detectors found (with user status applied) */
  allAnomalies: Anomaly[];
  /** anomalies visible on the current plan */
  anomalies: Anomaly[];
  hiddenAnomalyCount: number;
  hiddenAnomalyAmount: number;
  kpis: KPIData;
  baseline: Baseline;
  health: HealthScore;
  alerts: TriggeredAlert[];
}

interface WorkspaceContextValue {
  booting: boolean;
  syncMode: SyncMode;
  syncNote?: string;
  busy: { label: string; progress: number } | null;
  workspace: WorkspaceRecord | null;
  plan: PlanTier;
  settings: WorkspaceSettings;
  datasets: DatasetRecord[];
  activeDataset: DatasetRecord | null;
  transactions: Transaction[];
  loadingTransactions: boolean;
  analysis: Analysis;

  ingestFile: (file: File, opts?: { source?: DatasetRecord['source']; openingBalance?: number; name?: string }) => Promise<IngestResult>;
  loadDemo: () => Promise<IngestResult>;
  switchDataset: (id: string) => void;
  deleteDataset: (id: string) => Promise<void>;
  renameDataset: (id: string, name: string) => Promise<void>;
  setOpeningBalance: (id: string, value: number) => Promise<void>;
  getTransactions: (id: string) => Promise<Transaction[]>;
  consolidate: (ids: string[], name: string) => Promise<DatasetRecord>;

  setPlan: (plan: PlanTier) => void;
  updateSettings: (patch: Partial<WorkspaceSettings>) => void;
  setAnomalyStatus: (anomalyId: string, status: AnomalyStatus) => void;
  /** Counts one copilot question against the plan quota. Throws PlanLimitError when exhausted. */
  consumeCopilotQuery: () => void;
  copilotRemaining: number;
  uploadsRemaining: number;
  resetWorkspace: () => Promise<void>;

  can: (feature: FeatureKey) => boolean;
  upgradePrompt: UpgradePrompt | null;
  openUpgrade: (prompt?: UpgradePrompt) => void;
  closeUpgrade: () => void;
}

const Ctx = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return v;
}

const EMPTY_KPIS: KPIData = {
  netCashBalance: 0,
  monthlyBurnRate: 0,
  netBurnRate: 0,
  projectedRunwayDays: 0,
  detectedLeaks: 0,
  leakCount: 0,
  cashChangePct: null,
  burnChangePct: null,
};

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActive(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const serviceRef = useRef<DataService | null>(null);
  const [booting, setBooting] = useState(true);
  const [syncMode, setSyncMode] = useState<SyncMode>('local');
  const [syncNote, setSyncNote] = useState<string | undefined>();
  const [busy, setBusy] = useState<{ label: string; progress: number } | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [txCache, setTxCache] = useState<Record<string, Transaction[]>>({});
  const [loadingTx, setLoadingTx] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const txCacheRef = useRef(txCache);
  txCacheRef.current = txCache;

  /* ── boot ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const boot = await bootDataService();
      if (cancelled) return;
      serviceRef.current = boot.service;
      setSyncMode(boot.service.mode);
      setSyncNote(boot.service.note);
      setWorkspace(boot.workspace);
      setDatasets(boot.datasets);
      const stored = readActive();
      const initial = boot.datasets.find((d) => d.id === stored)?.id ?? boot.datasets[0]?.id ?? null;
      setActiveId(initial);
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── lazy-load transactions for the active dataset ── */
  useEffect(() => {
    if (!activeId || txCache[activeId] || !serviceRef.current) return;
    let cancelled = false;
    setLoadingTx(true);
    serviceRef.current
      .loadTransactions(activeId)
      .then((rows) => {
        if (!cancelled) setTxCache((c) => ({ ...c, [activeId]: rows }));
      })
      .catch(() => {
        if (!cancelled) setTxCache((c) => ({ ...c, [activeId]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingTx(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, txCache]);

  const plan: PlanTier = workspace?.plan ?? 'starter';
  const settings = workspace?.settings ?? ({} as WorkspaceSettings);
  const activeDataset = useMemo(() => datasets.find((d) => d.id === activeId) ?? null, [datasets, activeId]);
  const transactions = useMemo(() => (activeId ? txCache[activeId] ?? [] : []), [activeId, txCache]);

  /* ── the real-time engine: everything below recomputes whenever the dataset, rules, statuses or plan change ── */
  const analysis = useMemo<Analysis>(() => {
    const opening = activeDataset?.openingBalance ?? 0;
    const monthly = computeMonthlyData(transactions, opening);
    const detected = workspace ? detectAnomalies(transactions, settings.rules) : [];
    const statuses = (activeId && settings.anomalyStatus?.[activeId]) || {};
    const allAnomalies = detected.map((a) => (statuses[a.id] ? { ...a, status: statuses[a.id] } : a));
    const full = can(plan, 'advanced_anomalies');
    const anomalies = full ? allAnomalies : allAnomalies.filter((a) => STARTER_ANOMALY_TYPES.has(a.type));
    const hidden = full ? [] : allAnomalies.filter((a) => !STARTER_ANOMALY_TYPES.has(a.type) && a.status === 'flagged' && a.type !== 'category_spike');
    const kpis = transactions.length ? computeKPIs(transactions, monthly, anomalies, opening) : EMPTY_KPIS;
    const baseline = computeBaseline(transactions, monthly, anomalies);
    const health = computeHealthScore(transactions, monthly, anomalies, kpis);
    const alerts = workspace ? evaluateAlerts(settings.customAlerts ?? [], transactions, monthly, kpis) : [];
    return {
      monthly,
      allAnomalies,
      anomalies,
      hiddenAnomalyCount: hidden.length,
      hiddenAnomalyAmount: hidden.reduce((s, a) => s + a.detectedAmount, 0),
      kpis,
      baseline,
      health,
      alerts,
    };
  }, [transactions, activeDataset, workspace, settings, activeId, plan]);

  /* ── persistence helpers ── */
  const persistWorkspace = useCallback((next: WorkspaceRecord, immediate: boolean) => {
    window.clearTimeout(saveTimer.current);
    const run = () => {
      serviceRef.current?.saveWorkspace({ plan: next.plan, settings: next.settings }).catch(() => {
        /* a transient failure keeps the in-memory state; the next change retries */
      });
    };
    if (immediate) run();
    else saveTimer.current = window.setTimeout(run, 600);
  }, []);

  const workspaceRef = useRef<WorkspaceRecord | null>(null);
  workspaceRef.current = workspace;

  const mutateWorkspace = useCallback(
    (fn: (w: WorkspaceRecord) => WorkspaceRecord, immediate = false) => {
      const cur = workspaceRef.current;
      if (!cur) return;
      const next = fn(cur);
      workspaceRef.current = next;
      setWorkspace(next);
      persistWorkspace(next, immediate);
    },
    [persistWorkspace]
  );

  const uploadsThisMonth = useMemo(() => {
    const mk = currentMonthKey();
    return datasets.filter((d) => d.source === 'upload' && d.createdAt.slice(0, 7) === mk).length;
  }, [datasets]);
  const uploadsRemaining = Math.max(0, PLAN_LIMITS[plan].uploadsPerMonth - uploadsThisMonth);

  const usage = settings.copilotUsage;
  const usedCopilot = usage && usage.month === currentMonthKey() ? usage.count : 0;
  const copilotRemaining = Math.max(0, PLAN_LIMITS[plan].copilotPerMonth - usedCopilot);

  /* ── actions ── */
  const registerDataset = useCallback((record: DatasetRecord, rows: Transaction[]) => {
    setTxCache((c) => ({ ...c, [record.id]: rows }));
    setDatasets((d) => [record, ...d]);
    setActiveId(record.id);
    writeActive(record.id);
  }, []);

  const ingestFile = useCallback<WorkspaceContextValue['ingestFile']>(
    async (file, opts) => {
      const service = serviceRef.current;
      if (!service) throw new Error('Workspace is still starting up');
      const source = opts?.source ?? 'upload';
      if (source === 'upload' && uploadsRemaining <= 0) {
        throw new PlanLimitError('uploads', `The Starter plan includes ${PLAN_LIMITS.starter.uploadsPerMonth} uploads per month.`);
      }
      setBusy({ label: `Parsing ${file.name}…`, progress: 10 });
      try {
        const { transactions: rows, report } = await parseFile(file);
        setBusy({ label: `Saving ${rows.length.toLocaleString()} transactions…`, progress: 40 });
        const record = await service.createDataset(
          {
            name: opts?.name ?? file.name.replace(/\.[^.]+$/, ''),
            fileName: file.name,
            source,
            openingBalance: opts?.openingBalance ?? 0,
          },
          rows,
          (pct) => setBusy({ label: `Saving ${rows.length.toLocaleString()} transactions…`, progress: 40 + Math.round(pct * 0.6) })
        );
        registerDataset(record, rows);
        return { dataset: record, report };
      } finally {
        setBusy(null);
      }
    },
    [registerDataset, uploadsRemaining]
  );

  const loadDemo = useCallback(
    () => ingestFile(generateDemoFile(), { source: 'demo', openingBalance: DEMO_OPENING_BALANCE, name: 'Demo Company (synthetic)' }),
    [ingestFile]
  );

  const switchDataset = useCallback((id: string) => {
    setActiveId(id);
    writeActive(id);
  }, []);

  const getTransactions = useCallback(async (id: string): Promise<Transaction[]> => {
    const cached = txCacheRef.current[id];
    if (cached) return cached;
    const rows = (await serviceRef.current?.loadTransactions(id)) ?? [];
    setTxCache((c) => ({ ...c, [id]: rows }));
    return rows;
  }, []);

  const deleteDataset = useCallback(
    async (id: string) => {
      await serviceRef.current?.deleteDataset(id);
      const rest = datasets.filter((d) => d.id !== id);
      setDatasets(rest);
      if (activeId === id) {
        const next = rest[0]?.id ?? null;
        setActiveId(next);
        writeActive(next);
      }
      setTxCache((c) => {
        const copy = { ...c };
        delete copy[id];
        return copy;
      });
      mutateWorkspace((w) => {
        const statuses = { ...w.settings.anomalyStatus };
        delete statuses[id];
        return { ...w, settings: { ...w.settings, anomalyStatus: statuses } };
      });
    },
    [datasets, activeId, mutateWorkspace]
  );

  const patchDataset = useCallback(async (id: string, patch: Partial<Pick<DatasetRecord, 'name' | 'openingBalance'>>) => {
    const updated = await serviceRef.current?.updateDataset(id, patch);
    if (updated) setDatasets((list) => list.map((d) => (d.id === id ? updated : d)));
  }, []);

  const renameDataset = useCallback((id: string, name: string) => patchDataset(id, { name: name.trim() || 'Untitled dataset' }), [patchDataset]);
  const setOpeningBalance = useCallback((id: string, value: number) => patchDataset(id, { openingBalance: Number.isFinite(value) ? value : 0 }), [patchDataset]);

  const consolidate = useCallback(
    async (ids: string[], name: string) => {
      const service = serviceRef.current;
      if (!service) throw new Error('Workspace is still starting up');
      setBusy({ label: 'Consolidating datasets…', progress: 20 });
      try {
        const sources = datasets.filter((d) => ids.includes(d.id));
        const merged: Transaction[] = [];
        for (const d of sources) {
          const rows = await getTransactions(d.id);
          for (const t of rows) merged.push({ ...t, id: newUuid() });
        }
        merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        const record = await service.createDataset(
          { name, fileName: `${sources.length} datasets merged`, source: 'consolidated', openingBalance: sources.reduce((s, d) => s + d.openingBalance, 0) },
          merged,
          (pct) => setBusy({ label: 'Consolidating datasets…', progress: 20 + Math.round(pct * 0.8) })
        );
        registerDataset(record, merged);
        return record;
      } finally {
        setBusy(null);
      }
    },
    [datasets, getTransactions, registerDataset]
  );

  const setPlan = useCallback((next: PlanTier) => mutateWorkspace((w) => ({ ...w, plan: next }), true), [mutateWorkspace]);

  const updateSettings = useCallback(
    (patch: Partial<WorkspaceSettings>) => mutateWorkspace((w) => ({ ...w, settings: { ...w.settings, ...patch } })),
    [mutateWorkspace]
  );

  const setAnomalyStatus = useCallback(
    (anomalyId: string, status: AnomalyStatus) => {
      if (!activeId) return;
      mutateWorkspace((w) => ({
        ...w,
        settings: {
          ...w.settings,
          anomalyStatus: { ...w.settings.anomalyStatus, [activeId]: { ...(w.settings.anomalyStatus[activeId] ?? {}), [anomalyId]: status } },
        },
      }));
    },
    [activeId, mutateWorkspace]
  );

  const consumeCopilotQuery = useCallback(() => {
    if (copilotRemaining <= 0) {
      throw new PlanLimitError('copilot', `The Starter plan includes ${PLAN_LIMITS.starter.copilotPerMonth} Copilot questions per month.`);
    }
    mutateWorkspace((w) => {
      const mk = currentMonthKey();
      const cur = w.settings.copilotUsage.month === mk ? w.settings.copilotUsage.count : 0;
      return { ...w, settings: { ...w.settings, copilotUsage: { month: mk, count: cur + 1 } } };
    });
  }, [copilotRemaining, mutateWorkspace]);

  const resetWorkspace = useCallback(async () => {
    await serviceRef.current?.resetAll();
    const fresh = await serviceRef.current?.init();
    setDatasets([]);
    setTxCache({});
    setActiveId(null);
    writeActive(null);
    if (fresh) setWorkspace(fresh.workspace);
  }, []);

  const value: WorkspaceContextValue = {
    booting,
    syncMode,
    syncNote,
    busy,
    workspace,
    plan,
    settings,
    datasets,
    activeDataset,
    transactions,
    loadingTransactions: loadingTx,
    analysis,
    ingestFile,
    loadDemo,
    switchDataset,
    deleteDataset,
    renameDataset,
    setOpeningBalance,
    getTransactions,
    consolidate,
    setPlan,
    updateSettings,
    setAnomalyStatus,
    consumeCopilotQuery,
    copilotRemaining,
    uploadsRemaining,
    resetWorkspace,
    can: (f) => can(plan, f),
    upgradePrompt,
    openUpgrade: (p) => setUpgradePrompt(p ?? {}),
    closeUpgrade: () => setUpgradePrompt(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
