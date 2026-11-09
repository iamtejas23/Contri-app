import { ArrowDownRight, ArrowUpDown, ArrowUpRight, DollarSign, HandCoins, Receipt, Users, Wallet } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { formatCurrency } from '../../lib/currency'
import { EmptyState } from '../ui/EmptyState'
import { StatCard } from '../ui/StatCard'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

const COLORS = ['#0D9488', '#F97316', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981']

const chartStyle = {
  contentStyle: {
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 4px 6px -1px rgb(0 0 0/0.06)',
    fontSize: '13px',
    backgroundColor: 'var(--surface-color)',
    color: 'var(--text-primary)',
  },
}

export const TripDashboard = ({ trip, metrics, onAddExpense }) => {
  if (!metrics.totalSpent) {
    return (
      <EmptyState
        actionLabel="Add first expense"
        description="Log the first diesel, toll, meal, or hotel bill. Totals and the hisab show up right after."
        icon={Receipt}
        onAction={onAddExpense}
        title="No kharcha yet"
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Total expenses" tone="coral"
          value={formatCurrency(metrics.totalSpent, trip.currency)}
          helper="Recorded expenses; settlements excluded" />
        <StatCard icon={Wallet} label="Paid by you" tone="blue"
          value={formatCurrency(metrics.yourPaid, trip.currency)}
          helper="Upfront payments you made" />
        <StatCard icon={Users} label="Your expense share" tone="teal"
          value={formatCurrency(metrics.yourShare, trip.currency)}
          helper="Your allocated part of expenses" />
        <StatCard icon={ArrowDownRight} label="You owe" tone="coral"
          value={formatCurrency(metrics.yourOwed, trip.currency)}
          helper="Your remaining amount to pay" />
        <StatCard icon={ArrowUpRight} label="Owed to you" tone="mint"
          value={formatCurrency(metrics.yourReceivable, trip.currency)}
          helper="Others’ remaining amount to pay you" />
        <StatCard icon={HandCoins} label="Settled" tone="teal"
          value={formatCurrency(metrics.settledAmount, trip.currency)}
          helper="Recorded transfers, not expenses" />
        <StatCard icon={ArrowUpDown} label="Trip outstanding" tone="blue"
          value={formatCurrency(metrics.outstandingAmount, trip.currency)}
          helper="Unsettled amount across the group" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Highlights */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Highlights</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-ink">Who led the ledger?</h3>
            </div>
            <Badge>{trip.currency}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Paid most upfront</p>
              <p className="mt-2 font-display text-lg font-bold text-ink">
                {metrics.topSpender?.name || '—'}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-coral">
                {formatCurrency(metrics.topSpender?.amount || 0, trip.currency)}
              </p>
            </div>
            <div className="rounded-xl bg-teal-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">Most owed</p>
              <p className="mt-2 font-display text-lg font-bold text-ink">
                {metrics.mostOwed?.name || '—'}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-teal">
                {formatCurrency(metrics.mostOwed?.net || 0, trip.currency)}
              </p>
            </div>
          </div>
        </Card>

        {/* Category pie */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Category breakdown</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">Where the money went</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie data={metrics.categoryData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {metrics.categoryData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v, trip.currency)} {...chartStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2">
            {metrics.categoryData.map((entry, i) => (
              <span key={entry.name} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-dusk">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {entry.name}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Daily timeline */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Daily spend</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">Peaks across the trip</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={metrics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip formatter={(v) => formatCurrency(v, trip.currency)} {...chartStyle} />
                <Bar dataKey="value" fill="#0D9488" radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2" aria-label="Member financial summaries">
            {metrics.contributionsData.map((member) => (
              <div key={member.uid} className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm sm:grid-cols-4">
                <p className="col-span-2 truncate font-semibold text-ink sm:col-span-4" title={member.name}>{member.name}</p>
                <p className="min-w-0 text-dusk"><span className="block text-[11px] uppercase tracking-wide">Paid</span><span className="block truncate font-medium text-ink">{formatCurrency(member.paid || 0, trip.currency)}</span></p>
                <p className="min-w-0 text-dusk"><span className="block text-[11px] uppercase tracking-wide">Share</span><span className="block truncate font-medium text-ink">{formatCurrency(member.share || 0, trip.currency)}</span></p>
                <p className="min-w-0 text-dusk"><span className="block text-[11px] uppercase tracking-wide">Settled sent / received</span><span className="block truncate font-medium text-ink">{formatCurrency(member.settledOut || 0, trip.currency)} / {formatCurrency(member.settledIn || 0, trip.currency)}</span></p>
                <p className="min-w-0 text-dusk"><span className="block text-[11px] uppercase tracking-wide">Net balance</span><span className={`block truncate font-semibold ${(member.net || 0) >= 0 ? 'text-teal' : 'text-coral'}`}>{formatCurrency(member.net || 0, trip.currency)}</span></p>
              </div>
            ))}
          </div>
        </Card>

        {/* Member contributions */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Contributions</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">Who paid the most upfront</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={metrics.contributionsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip formatter={(v) => formatCurrency(v, trip.currency)} {...chartStyle} />
                <Bar dataKey="amount" fill="#F97316" radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
