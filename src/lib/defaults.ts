import type { DetectionRules, WorkspaceSettings } from '@/types';

export const DEFAULT_RULES: DetectionRules = {
  duplicates: true,
  duplicateWindowDays: 7,
  duplicateMinAmount: 20,
  priceHikes: true,
  priceHikePct: 25,
  priceHikeMinBase: 100,
  unusualAmounts: true,
  unusualAmountMultiple: 3,
  unusualAmountMin: 500,
  weekend: true,
  weekendMin: 200,
  categorySpikes: true,
  categorySpikePct: 50,
  categorySpikeMin: 500,
};

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultSettings(): WorkspaceSettings {
  return {
    rules: { ...DEFAULT_RULES },
    customAlerts: [],
    vatRate: 20,
    copilotUsage: { month: currentMonthKey(), count: 0 },
    aiProvider: 'openai',
    anomalyStatus: {},
  };
}

/** Merge a possibly partial / older persisted settings blob with the current defaults. */
export function mergeSettings(raw: unknown): WorkspaceSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<WorkspaceSettings>;
  return {
    rules: { ...base.rules, ...(r.rules ?? {}) },
    customAlerts: Array.isArray(r.customAlerts) ? r.customAlerts : base.customAlerts,
    vatRate: typeof r.vatRate === 'number' ? r.vatRate : base.vatRate,
    copilotUsage:
      r.copilotUsage && typeof r.copilotUsage.count === 'number' && typeof r.copilotUsage.month === 'string'
        ? r.copilotUsage
        : base.copilotUsage,
    aiProvider: r.aiProvider === 'groq' ? 'groq' : 'openai',
    anomalyStatus: r.anomalyStatus && typeof r.anomalyStatus === 'object' ? r.anomalyStatus : {},
  };
}
