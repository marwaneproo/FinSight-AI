import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';

const previewData = [
  { month: 'Jan', revenue: 48000, expenses: 43000 },
  { month: 'Feb', revenue: 51000, expenses: 45000 },
  { month: 'Mar', revenue: 49000, expenses: 47000 },
  { month: 'Apr', revenue: 55000, expenses: 48000 },
  { month: 'May', revenue: 58000, expenses: 46000 },
  { month: 'Jun', revenue: 62000, expenses: 49000 },
];

export function HeroPreview() {
  return (
    <div className="card !p-0 overflow-hidden shadow-glass-lg animate-slide-up">
      {/* Browser chrome */}
      <div className="h-9 bg-navy-50 border-b border-navy-200 flex items-center gap-2 px-4">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-danger-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-success-500" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1 rounded-md bg-white border border-navy-200 text-xs text-navy-400 font-medium">
            app.finsight.ai/dashboard
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Mini KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-navy-50 border border-navy-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-brand-600" />
              <span className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide">Net Balance</span>
            </div>
            <p className="text-lg font-extrabold text-navy-900">$158K</p>
            <span className="text-[10px] text-success-600 font-semibold flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> +12.3%
            </span>
          </div>
          <div className="rounded-xl bg-navy-50 border border-navy-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-danger-500" />
              <span className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide">Burn Rate</span>
            </div>
            <p className="text-lg font-extrabold text-navy-900">$47K</p>
            <span className="text-[10px] text-navy-400 font-semibold">per month</span>
          </div>
          <div className="rounded-xl bg-danger-50 border border-danger-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-danger-500" />
              <span className="text-[10px] font-semibold text-danger-600 uppercase tracking-wide">Leaks Found</span>
            </div>
            <p className="text-lg font-extrabold text-danger-700">$1,546</p>
            <span className="text-[10px] text-danger-600 font-semibold">3 anomalies</span>
          </div>
        </div>

        {/* Mini chart */}
        <div className="rounded-xl border border-navy-100 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-navy-700">Cash Flow</span>
            <div className="flex items-center gap-3 text-[10px] font-medium">
              <span className="flex items-center gap-1 text-success-600"><span className="h-2 w-2 rounded-full bg-success-500" />Revenue</span>
              <span className="flex items-center gap-1 text-danger-500"><span className="h-2 w-2 rounded-full bg-danger-400" />Expenses</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={previewData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="previewRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="previewExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  fontSize: 11,
                  padding: '6px 10px',
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fill="url(#previewRev)" />
              <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#previewExp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
