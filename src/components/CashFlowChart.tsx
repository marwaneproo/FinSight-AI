import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ForecastPoint } from '@/types';
import { formatCurrency } from '@/lib/cashFlowEngine';
import { TrendingUp, Activity } from 'lucide-react';

interface CashFlowChartProps {
  data: ForecastPoint[];
}

interface ChartTooltipEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload?: { isForecast?: boolean };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const isForecast = payload[0]?.payload?.isForecast;

  return (
    <div className="card !rounded-xl p-3 shadow-glass-lg border-navy-200">
      <p className="text-xs font-semibold text-navy-400 mb-2 flex items-center gap-1.5">
        {label}
        {isForecast && (
          <span className="px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 text-[10px] font-bold">FORECAST</span>
        )}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-navy-600 flex items-center gap-1.5 capitalize">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.dataKey === 'cumulativeCash' ? 'Cash Balance' : entry.dataKey}
            </span>
            <span className="text-xs font-bold text-navy-900">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const forecastStart = data.find((d) => d.isForecast);
  const forecastStartLabel = forecastStart?.month;

  return (
    <div className="card p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-brand-100 flex items-center justify-center">
              <Activity className="h-4 w-4 text-brand-600" />
            </div>
            <h3 className="text-base font-bold text-navy-900">Cash Flow & 90-Day Forecast</h3>
          </div>
          <p className="text-xs text-navy-400 ml-10">Historical revenue vs. expenses with AI-projected forecast</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-success-600">
            <span className="h-2.5 w-2.5 rounded-full bg-success-500" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5 text-danger-500">
            <span className="h-2.5 w-2.5 rounded-full bg-danger-400" />
            Expenses
          </span>
          <span className="flex items-center gap-1.5 text-brand-600">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-brand-600" />
            Forecast
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#94A3B8', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, true)}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          {forecastStartLabel && (
            <ReferenceLine
              x={forecastStartLabel}
              stroke="#2563EB"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: 'Forecast →', position: 'top', fill: '#2563EB', fontSize: 10, fontWeight: 600 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10B981"
            strokeWidth={2.5}
            fill="url(#revGradient)"
            dot={{ r: 3, fill: '#10B981' }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="#EF4444"
            strokeWidth={2.5}
            fill="url(#expGradient)"
            dot={{ r: 3, fill: '#EF4444' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeCash"
            stroke="#2563EB"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-2 mt-3 text-xs text-navy-400">
        <TrendingUp className="h-3.5 w-3.5 text-brand-600" />
        Dotted line shows cash balance; points after the divider are projected from your recent run-rate.
      </div>
    </div>
  );
}
