import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatCurrency } from '../../lib/currency'
import { EmptyState } from '../ui/EmptyState'
import { StatCard } from '../ui/StatCard'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

const chartColors = ['#ee6c4d', '#2a9d8f', '#f4a261', '#264653', '#8ecae6', '#95d5b2']

export const TripDashboard = ({ trip, metrics, onAddExpense }) => {
  if (!metrics.totalSpent) {
    return (
      <EmptyState
        actionLabel="Add first expense"
        description="Once a bill lands here, Contri-app will start tracking totals, daily spend, and who is owed what."
        onAction={onAddExpense}
        title="The dashboard wakes up after the first expense"
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          helper="The full trip spend so far."
          label="Total spent"
          tone="coral"
          value={formatCurrency(metrics.totalSpent, trip.currency)}
        />
        <StatCard
          helper="Average expense share per traveler."
          label="Per-person average"
          tone="teal"
          value={formatCurrency(metrics.averagePerPerson, trip.currency)}
        />
        <StatCard
          helper="Your allocated share from all recorded expenses."
          label="Your share"
          tone="mint"
          value={formatCurrency(metrics.yourShare, trip.currency)}
        />
        <StatCard
          helper="Positive means you should receive money back."
          label="Your net"
          tone="teal"
          value={formatCurrency(metrics.yourNet, trip.currency)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-dusk/60">
                Trip highlights
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold text-ink">
                Who is leading the ledger?
              </h3>
            </div>
            <Badge>{trip.currency}</Badge>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-sand/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk/60">
                Top spender
              </p>
              <p className="mt-3 font-display text-xl font-bold text-ink">
                {metrics.topSpender?.name || '—'}
              </p>
              <p className="mt-1 text-sm text-dusk/70">
                {formatCurrency(metrics.topSpender?.amount || 0, trip.currency)}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-sand/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk/60">
                Most owed
              </p>
              <p className="mt-3 font-display text-xl font-bold text-ink">
                {metrics.mostOwed?.name || '—'}
              </p>
              <p className="mt-1 text-sm text-dusk/70">
                {formatCurrency(metrics.mostOwed?.net || 0, trip.currency)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-dusk/60">
            Category breakdown
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">
            Where the money went
          </h3>
          <div className="mt-4 h-72 min-w-0">
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <PieChart>
                <Pie
                  data={metrics.categoryData}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {metrics.categoryData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value, trip.currency)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {metrics.categoryData.map((entry, index) => (
              <span
                key={entry.name}
                className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-2 text-sm text-dusk"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                />
                {entry.name}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-dusk/60">
            Daily spending timeline
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">
            Peaks across the trip
          </h3>
          <div className="mt-4 h-80 min-w-0">
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <BarChart data={metrics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5d7d1" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `${value}`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(value, trip.currency)} />
                <Bar dataKey="value" fill="#2a9d8f" radius={[12, 12, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-dusk/60">
            Member contribution
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">
            Who paid the most upfront
          </h3>
          <div className="mt-4 h-80 min-w-0">
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <BarChart data={metrics.contributionsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5d7d1" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(value, trip.currency)} />
                <Bar dataKey="amount" fill="#ee6c4d" radius={[12, 12, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
