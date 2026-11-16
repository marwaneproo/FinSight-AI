/** Categories are free-form: they come straight from whatever the user uploads. */
export type TransactionCategory = string;

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  vendor: string;
  category: TransactionCategory;
  amount: number; // always positive; direction is in `type`
  type: TransactionType;
}

export type AnomalyType =
  | 'duplicate_subscription'
  | 'price_hike'
  | 'unusual_weekend'
  | 'duplicate_invoice'
  | 'unusual_amount'
  | 'category_spike';

export type AnomalySeverity = 'high' | 'medium';
export type AnomalyStatus = 'flagged' | 'ignored' | 'refunded';

export interface Anomaly {
  id: string;
  transactionId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  detectedAmount: number;
  suggestion: string;
  status: AnomalyStatus;
}

export interface MonthlyData {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  netCashFlow: number;
  cumulativeCash: number;
  /** Last month of the file, and the file ends well before month-end. */
  partial?: boolean;
}

export interface ForecastPoint {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  netCashFlow: number;
  cumulativeCash: number;
  isForecast: boolean;
}

export interface ScenarioState {
  /** % change applied to monthly revenue (-50..+100). */
  revenueChange: number;
  /** % change applied to marketing / advertising spend (-60..+60). */
  marketingChange: number;
  /** % reduction applied to all non-marketing operating costs (0..40). */
  costCut: number;
  /** % of detected recurring leakage that gets eliminated (0..100). */
  leakElimination: number;
}

export interface DailyProjectionPoint {
  day: number;
  date: string;
  label: string;
  baseline: number;
  scenario: number;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type AppView = 'landing' | 'dashboard';

export type DashboardTab =
  | 'overview'
  | 'data'
  | 'analytics'
  | 'anomalies'
  | 'simulator'
  | 'copilot'
  | 'reports'
  | 'alerts'
  | 'ledger';

export type BillingCycle = 'monthly' | 'yearly';

export type PlanTier = 'starter' | 'pro' | 'business';

export interface PricingPlan {
  name: string;
  tier: PlanTier;
  price: number;
  tagline: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
  yearlyPrice: number;
}

export interface KPIData {
  netCashBalance: number;
  monthlyBurnRate: number;
  netBurnRate: number;
  projectedRunwayDays: number;
  detectedLeaks: number;
  leakCount: number;
  /** % change of month-end cash vs previous month-end (null when not computable). */
  cashChangePct: number | null;
  /** % change of expenses, latest full month vs the one before (null when not computable). */
  burnChangePct: number | null;
}

/* ───────────── Persistence models ───────────── */

export interface WorkspaceRecord {
  id: string;
  name: string;
  sessionId: string;
  plan: PlanTier;
  settings: WorkspaceSettings;
  createdAt: string;
}

export interface DatasetRecord {
  id: string;
  workspaceId: string;
  name: string;
  fileName: string;
  sessionId: string;
  source: 'upload' | 'demo' | 'consolidated';
  rowCount: number;
  openingBalance: number;
  dateFrom: string | null;
  dateTo: string | null;
  totalIncome: number;
  totalExpenses: number;
  createdAt: string;
}

export interface CustomAlertRule {
  id: string;
  kind: 'category_monthly_cap' | 'single_transaction_cap' | 'min_cash_balance' | 'min_runway_days';
  /** Category name for `category_monthly_cap`, ignored otherwise. */
  category?: string;
  threshold: number;
  enabled: boolean;
}

export interface DetectionRules {
  duplicates: boolean;
  duplicateWindowDays: number;
  duplicateMinAmount: number;
  priceHikes: boolean;
  priceHikePct: number;
  priceHikeMinBase: number;
  unusualAmounts: boolean;
  unusualAmountMultiple: number;
  unusualAmountMin: number;
  weekend: boolean;
  weekendMin: number;
  categorySpikes: boolean;
  categorySpikePct: number;
  categorySpikeMin: number;
}

export interface WorkspaceSettings {
  rules: DetectionRules;
  customAlerts: CustomAlertRule[];
  vatRate: number;
  copilotUsage: { month: string; count: number };
  aiProvider: 'openai' | 'groq';
  /** datasetId → anomalyId → status chosen by the user (synced with the workspace). */
  anomalyStatus: Record<string, Record<string, AnomalyStatus>>;
}

export interface ParseReport {
  sheetName?: string;
  headerRow: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  mapping: Record<string, string | null>;
  directionMode: string;
  dateOrder: 'MDY' | 'DMY' | 'ISO';
  warnings: string[];
}

export interface ParseResult {
  transactions: Transaction[];
  report: ParseReport;
}

export type SyncMode = 'supabase' | 'local';
