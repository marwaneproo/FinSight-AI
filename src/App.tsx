import { useCallback, useState } from 'react';
import type { AppView, DashboardTab } from '@/types';
import { useWorkspace } from '@/hooks/useWorkspace';
import { LandingPage } from '@/components/LandingPage';
import { Sidebar } from '@/components/Sidebar';
import { DatasetSwitcher } from '@/components/DatasetSwitcher';
import { UpgradeModal } from '@/components/UpgradeModal';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import { TransactionLedger } from '@/components/TransactionLedger';
import { Overview } from '@/components/modules/Overview';
import { DataManager } from '@/components/modules/DataManager';
import { Analytics } from '@/components/modules/Analytics';
import { Anomalies } from '@/components/modules/Anomalies';
import { Simulator } from '@/components/modules/Simulator';
import { Copilot } from '@/components/Copilot';
import { Reports } from '@/components/modules/Reports';
import { AlertsSettings } from '@/components/modules/AlertsSettings';
import { Bell, Cloud, HardDrive, Home, Loader2 } from 'lucide-react';

const TITLES: Record<DashboardTab, string> = {
  overview: 'Dashboard Overview',
  data: 'Data Manager & Uploads',
  analytics: 'Live BI Analytics',
  anomalies: 'Anomaly & Leak Detector',
  simulator: 'Scenario Simulator',
  copilot: 'AI Financial Copilot',
  reports: 'Executive Reports',
  alerts: 'Alert Rules & Settings',
  ledger: 'Transaction Ledger',
};

function App() {
  const [view, setView] = useState<AppView>('landing');
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const { booting, syncMode, syncNote, analysis, transactions, activeDataset, plan } = useWorkspace();

  const enter = useCallback(() => { setView('dashboard'); setTab('overview'); }, []);

  if (view === 'landing') return <><LandingPage onEnterApp={enter} /><UpgradeModal /></>;

  if (booting) {
    return <div className="h-screen flex items-center justify-center bg-navy-50"><Loader2 className="h-8 w-8 text-brand-600 animate-spin" /></div>;
  }

  return (
    <div className="app-shell flex h-screen bg-navy-50 overflow-hidden">
      <Sidebar activeTab={tab} onTabChange={setTab} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="no-print app-topbar h-16 glass-nav flex items-center justify-between px-6 flex-shrink-0 gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => setView('landing')} className="btn-ghost text-xs"><Home className="h-4 w-4" />Home</button>
            <div className="h-5 w-px bg-navy-200" />
            <span className="text-sm font-semibold text-navy-900 truncate">{TITLES[tab]}</span>
          </div>
          <div className="flex items-center gap-3">
            <span title={syncNote} className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${syncMode === 'supabase' ? 'bg-success-50 border-success-100 text-success-700' : 'bg-navy-100 border-navy-200 text-navy-600'}`}>
              {syncMode === 'supabase' ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}{syncMode === 'supabase' ? 'Supabase synced' : 'Local storage'}
            </span>
            <button onClick={() => setTab('alerts')} className="relative p-2 rounded-xl hover:bg-navy-100" aria-label="Alerts"><Bell className="h-5 w-5 text-navy-600" />
              {analysis.alerts.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center">{analysis.alerts.length}</span>}</button>
            <DatasetSwitcher onManage={() => setTab('data')} />
          </div>
        </header>

        <main className="app-main flex-1 overflow-y-auto p-6" data-plan={plan}>
          {tab === 'overview' && <Overview onNavigate={setTab} />}
          {tab === 'data' && <DataManager />}
          {tab === 'analytics' && <Analytics />}
          {tab === 'anomalies' && <Anomalies />}
          {tab === 'simulator' && <Simulator />}
          {tab === 'copilot' && <Copilot />}
          {tab === 'reports' && <Reports />}
          {tab === 'alerts' && <AlertsSettings />}
          {tab === 'ledger' && (activeDataset ? <div className="animate-fade-in"><TransactionLedger transactions={transactions} /></div> : <EmptyWorkspace module="the Transaction Ledger" />)}
        </main>
      </div>
      <UpgradeModal />
    </div>
  );
}

export default App;
