import { ArrowUpDown, DollarSign, Receipt, TrendingUp, Users } from 'lucide-react'
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
    border: '1px solid #E2E8F0',
    boxShadow: '0 4px 6px -1px rgb(0 0 0/0.06)',
    fontSize: '13px',
  },
}

export const TripDashboard = ({ trip, metrics, onAddExpense }) => {
  if (!metrics.totalSpent) {
    return (
      <EmptyState
        actionLabel="Add first expense"
        description="Log the first petrol, toll, meal, or hotel bill. Totals and the hisab show up right after."
        icon={Receipt}
        onAction={onAddExpense}
        title="No kharcha yet"
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Total spent" tone="coral"
          value={formatCurrency(metrics.totalSpent, trip.currency)}
          helper="Full trip spend so far" />
        <StatCard icon={Users} label="Per-person avg" tone="teal"
          value={formatCurrency(metrics.averagePerPerson, trip.currency)}
          helper="Average share per traveler" />
        <StatCard icon={TrendingUp} label="Your share" tone="mint"
          value={formatCurrency(metrics.yourShare, trip.currency)}
          helper="Your allocated portion" />
        <StatCard icon={ArrowUpDown} label="Your net" tone="blue"
          value={formatCurrency(metrics.yourNet, trip.currency)}
          helper={metrics.yourNet >= 0 ? 'You are owed this' : 'You still owe this'} />
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
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Top spender</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(v) => formatCurrency(v, trip.currency)} {...chartStyle} />
                <Bar dataKey="value" fill="#0D9488" radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Member contributions */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Contributions</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">Who paid the most upfront</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={metrics.contributionsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
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
