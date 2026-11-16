import type { KPIData } from '@/types';
import { formatCurrency, formatPct, formatRunway } from '@/lib/cashFlowEngine';
import { DollarSign, TrendingDown, CalendarClock, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function KPICards({ kpis }: { kpis: KPIData }) {
  const runway = kpis.projectedRunwayDays;
  const cards = [
    {
      label: 'Net Cash Balance', value: formatCurrency(kpis.netCashBalance, true), icon: DollarSign, iconBg: 'bg-brand-100', iconColor: 'text-brand-600',
      change: kpis.cashChangePct === null ? null : formatPct(kpis.cashChangePct), good: (kpis.cashChangePct ?? 0) >= 0, sub: 'vs. previous month-end',
    },
    {
      label: 'Monthly Burn Rate', value: formatCurrency(kpis.monthlyBurnRate, true), icon: TrendingDown, iconBg: 'bg-navy-100', iconColor: 'text-navy-600',
      change: kpis.burnChangePct === null ? null : formatPct(kpis.burnChangePct), good: (kpis.burnChangePct ?? 0) <= 0,
      sub: kpis.netBurnRate > 0 ? `net burn ${formatCurrency(kpis.netBurnRate, true)}/mo` : 'covered by revenue',
    },
    {
      label: 'Projected Runway', value: formatRunway(runway), icon: CalendarClock, iconBg: 'bg-success-100', iconColor: 'text-success-600',
      change: runway >= 9999 ? 'Profitable' : runway >= 180 ? 'Healthy' : runway >= 90 ? 'Watch' : 'Critical', good: runway >= 180, sub: 'at the 3-month average rate',
    },
    {
      label: 'Detected Financial Leaks', value: formatCurrency(kpis.detectedLeaks, true), icon: AlertTriangle, iconBg: 'bg-danger-100', iconColor: 'text-danger-600',
      change: kpis.leakCount === 0 ? 'All clear' : `${kpis.leakCount} open`, good: kpis.leakCount === 0, sub: 'recoverable in open anomalies',
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="card p-5 rounded-2xl hover:shadow-glass-lg animate-slide-up">
            <div className="flex items-start justify-between mb-3">
              <div className={`h-10 w-10 rounded-xl ${c.iconBg} flex items-center justify-center`}><Icon className={`h-5 w-5 ${c.iconColor}`} /></div>
              {c.change && (
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${c.good ? 'text-success-600' : 'text-danger-600'}`}>
                  {c.change.startsWith('+') || c.change.startsWith('-') ? (c.change.startsWith('-') ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />) : <Minus className="h-3.5 w-3.5" />}
                  {c.change}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-navy-400 uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-2xl font-extrabold text-navy-900">{c.value}</p>
            <p className="text-xs text-navy-400 mt-1">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
