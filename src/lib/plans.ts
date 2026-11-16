import type { PlanTier } from '@/types';

export type FeatureKey =
  | 'full_analytics'
  | 'advanced_anomalies'
  | 'scenario_simulator'
  | 'report_export'
  | 'alert_rules'
  | 'period_comparison'
  | 'consolidation'
  | 'custom_alerts'
  | 'vat_split'
  | 'erp_export';

const RANK: Record<PlanTier, number> = { starter: 0, pro: 1, business: 2 };

export const FEATURE_MIN_PLAN: Record<FeatureKey, PlanTier> = {
  full_analytics: 'pro',
  advanced_anomalies: 'pro',
  scenario_simulator: 'pro',
  report_export: 'pro',
  alert_rules: 'pro',
  period_comparison: 'pro',
  consolidation: 'business',
  custom_alerts: 'business',
  vat_split: 'business',
  erp_export: 'business',
};

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  full_analytics: 'Full BI analytics',
  advanced_anomalies: 'Advanced leak detection',
  scenario_simulator: '90-day scenario simulator',
  report_export: 'PDF / Excel executive export',
  alert_rules: 'Advanced alert rules',
  period_comparison: 'Period comparison',
  consolidation: 'Multi-entity consolidation',
  custom_alerts: 'Custom alert rules',
  vat_split: 'Automated VAT / tax split',
  erp_export: 'ERP journal export',
};

export const PLAN_LIMITS: Record<PlanTier, { uploadsPerMonth: number; copilotPerMonth: number }> = {
  starter: { uploadsPerMonth: 2, copilotPerMonth: 5 },
  pro: { uploadsPerMonth: Infinity, copilotPerMonth: Infinity },
  business: { uploadsPerMonth: Infinity, copilotPerMonth: Infinity },
};

export const PLAN_NAME: Record<PlanTier, string> = {
  starter: 'Starter',
  pro: 'Pro Growth',
  business: 'Business / CFO',
};

export function can(plan: PlanTier, feature: FeatureKey): boolean {
  return RANK[plan] >= RANK[FEATURE_MIN_PLAN[feature]];
}

export function requiredPlanFor(feature: FeatureKey): PlanTier {
  return FEATURE_MIN_PLAN[feature];
}

/** Anomaly types included in the free tier (duplicate detection only). */
export const STARTER_ANOMALY_TYPES = new Set(['duplicate_subscription', 'duplicate_invoice']);
