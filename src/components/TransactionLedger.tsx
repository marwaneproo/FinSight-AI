import { useState, useMemo } from 'react';
import type { Transaction, TransactionCategory } from '@/types';
import { formatCurrencyDetailed, formatCurrency } from '@/lib/cashFlowEngine';
import { exportTransactionsCSV } from '@/lib/csvExport';
import { Search, Download, ArrowUpDown, Filter, Table2 } from 'lucide-react';

interface TransactionLedgerProps {
  transactions: Transaction[];
}

type SortField = 'date' | 'amount' | 'vendor';
type SortDir = 'asc' | 'desc';

const categoryColors: Record<TransactionCategory, string> = {
  'SaaS': 'bg-brand-100 text-brand-700',
  'Marketing': 'bg-warning-100 text-warning-600',
  'Payroll': 'bg-navy-100 text-navy-600',
  'Revenue': 'bg-success-100 text-success-700',
  'Cloud': 'bg-brand-100 text-brand-700',
  'Office': 'bg-navy-100 text-navy-600',
  'Utilities': 'bg-warning-100 text-warning-600',
  'Professional Services': 'bg-navy-100 text-navy-600',
  'Software': 'bg-brand-100 text-brand-700',
  'Hardware': 'bg-navy-100 text-navy-600',
};

export function TransactionLedger({ transactions }: TransactionLedgerProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const categories = useMemo(() => {
    return [...new Set(transactions.map((t) => t.category))].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    let result = [...transactions];
    

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.vendor.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((t) => t.type === typeFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'vendor') cmp = a.vendor.localeCompare(b.vendor);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [transactions, search, categoryFilter, typeFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-navy-100 flex items-center justify-center">
              <Table2 className="h-5 w-5 text-navy-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900">Transaction Ledger</h2>
              <p className="text-sm text-navy-400">
                {filtered.length} transactions · Income: {formatCurrency(totalIncome)} · Expenses: {formatCurrency(totalExpenses)}
              </p>
            </div>
          </div>
          <button onClick={() => exportTransactionsCSV(filtered)} className="btn-primary">
            <Download className="h-4 w-4" />
            Download Cleaned CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 rounded-2xl">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by description, vendor, or category..."
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-navy-400 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value as TransactionCategory | 'all'); setCurrentPage(1); }}
                className="input-field pl-9 pr-8 appearance-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as 'all' | 'income' | 'expense'); setCurrentPage(1); }}
              className="input-field pr-8 appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-200 bg-navy-50/50">
                <th className="text-left px-5 py-3">
                  <button onClick={() => handleSort('date')} className="text-xs font-semibold text-navy-400 uppercase tracking-wide flex items-center gap-1 hover:text-navy-700">
                    Date <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => handleSort('vendor')} className="text-xs font-semibold text-navy-400 uppercase tracking-wide flex items-center gap-1 hover:text-navy-700">
                    Vendor <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-400 uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3">
                  <button onClick={() => handleSort('amount')} className="text-xs font-semibold text-navy-400 uppercase tracking-wide flex items-center gap-1 hover:text-navy-700 ml-auto">
                    Amount <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((t) => (
                <tr key={t.id} className="border-b border-navy-100 hover:bg-navy-50/30 transition-colors">
                  <td className="px-5 py-3 text-navy-500 font-mono text-xs">{t.date}</td>
                  <td className="px-4 py-3 font-medium text-navy-900">{t.vendor}</td>
                  <td className="px-4 py-3 text-navy-500 hidden md:table-cell max-w-xs truncate">{t.description}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${categoryColors[t.category] ?? 'badge-neutral'}`}>{t.category}</span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${t.type === 'income' ? 'text-success-600' : 'text-navy-900'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrencyDetailed(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-navy-200">
            <p className="text-xs text-navy-400">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-navy-600 hover:bg-navy-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-navy-400 px-2">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-navy-600 hover:bg-navy-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
