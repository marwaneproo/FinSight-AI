import { Logo } from '@/components/Logo';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PLAN_LIMITS, PLAN_NAME, type FeatureKey } from '@/lib/plans';
import type { DashboardTab } from '@/types';
import {
  LayoutDashboard, Database, BarChart3, ShieldAlert, SlidersHorizontal, Brain, FileText, Table2, BellRing,
  ChevronLeft, ChevronRight, Lock, Crown,
} from 'lucide-react';

interface Props {
  activeTab: DashboardTab;
  onTabChange: (t: DashboardTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface Item { id: DashboardTab; label: string; icon: typeof LayoutDashboard; gate?: FeatureKey; badge?: number }

export function Sidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }: Props) {
  const { analysis, plan, openUpgrade, uploadsRemaining, copilotRemaining, can } = useWorkspace();
  const openLeaks = analysis.anomalies.filter((a) => a.status === 'flagged').length;

  const groups: { title: string; items: Item[] }[] = [
    { title: 'Command center', items: [
      { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
      { id: 'data', label: 'Data Manager', icon: Database },
      { id: 'analytics', label: 'Live BI Analytics', icon: BarChart3 },
    ] },
    { title: 'Intelligence', items: [
      { id: 'anomalies', label: 'Anomaly & Leak Detector', icon: ShieldAlert, badge: openLeaks },
      { id: 'simulator', label: 'Scenario Simulator', icon: SlidersHorizontal, gate: 'scenario_simulator' },
      { id: 'copilot', label: 'AI Financial Copilot', icon: Brain },
    ] },
    { title: 'Reporting & control', items: [
      { id: 'reports', label: 'Executive Reports', icon: FileText, gate: 'report_export' },
      { id: 'ledger', label: 'Transaction Ledger', icon: Table2 },
      { id: 'alerts', label: 'Alert Rules & Settings', icon: BellRing, badge: analysis.alerts.length },
    ] },
  ];

  return (
    <aside className={`no-print relative flex flex-col bg-navy-900 border-r border-navy-800 transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}>
      <div className="h-16 flex items-center px-4 border-b border-navy-800 flex-shrink-0">
        {collapsed ? (
          <div className="flex items-center justify-center w-full"><div className="h-9 w-9 rounded-xl gradient-brand flex items-center justify-center shadow-glow-brand"><span className="text-white font-extrabold text-sm">FS</span></div></div>
        ) : (
          <div className="scale-90 origin-left"><Logo variant="light" size="sm" /></div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            {!collapsed && <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-navy-500">{g.title}</p>}
            <div className="flex flex-col gap-1">
              {g.items.map((item) => {
                const active = activeTab === item.id;
                const Icon = item.icon;
                const locked = item.gate ? !can(item.gate) : false;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? 'bg-brand-600 text-white shadow-glow-brand' : 'text-navy-300 hover:bg-navy-800 hover:text-white'} ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                    {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
                    {!collapsed && locked && <Lock className="ml-auto h-3.5 w-3.5 text-warning-400" />}
                    {!collapsed && !locked && item.badge !== undefined && item.badge > 0 && (
                      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-danger-500 text-white'}`}>{item.badge}</span>
                    )}
                    {collapsed && ((item.badge ?? 0) > 0 || locked) && <span className={`absolute top-1 right-1 h-2 w-2 rounded-full ${locked ? 'bg-warning-400' : 'bg-danger-500'}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="rounded-2xl bg-navy-800/70 border border-navy-700 p-3.5">
            <div className="flex items-center gap-2 mb-1"><Crown className="h-4 w-4 text-warning-400" /><span className="text-sm font-bold text-white">{PLAN_NAME[plan]}</span></div>
            {plan === 'starter' ? (
              <>
                <p className="text-[11px] text-navy-300">{uploadsRemaining}/{PLAN_LIMITS.starter.uploadsPerMonth} uploads · {copilotRemaining}/{PLAN_LIMITS.starter.copilotPerMonth} Copilot queries left</p>
                <button onClick={() => openUpgrade()} className="btn-primary w-full mt-2.5 !py-2 text-xs">Upgrade plan</button>
              </>
            ) : (
              <>
                <p className="text-[11px] text-navy-300">All {plan === 'business' ? 'Business' : 'Pro'} features unlocked.</p>
                {plan === 'pro' && <button onClick={() => openUpgrade()} className="btn-secondary w-full mt-2.5 !py-2 text-xs">See Business / CFO</button>}
              </>
            )}
          </div>
        </div>
      )}

      <button onClick={onToggleCollapse} className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-white border border-navy-200 shadow-glass flex items-center justify-center text-navy-600 hover:text-brand-600 z-30" aria-label="Toggle sidebar">
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}
