import {
  FileSpreadsheet,
  FileText,
  Link2,
  MailPlus,
  MessageCircle,
  PencilLine,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Suspense, lazy, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

import { ActivityFeed } from '../components/feed/ActivityFeed'
import { ExpenseFormModal } from '../components/expenses/ExpenseFormModal'
import { ExpenseList } from '../components/expenses/ExpenseList'
import { QuickAddSheet } from '../components/expenses/QuickAddSheet'
import { SettlementPanel } from '../components/settlements/SettlementPanel'
import { WhoOwesWhom } from '../components/settlements/WhoOwesWhom'
import { TripFormModal } from '../components/trips/TripFormModal'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { BudgetBar } from '../components/ui/BudgetBar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { ErrorState } from '../components/ui/ErrorState'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { useAuth } from '../context/useAuth'
import { buildDashboardMetrics, buildMembersMap } from '../lib/balances'
import { formatCurrency } from '../lib/currency'
import { isDateOutsideRange } from '../lib/date'
import { buildHisabMessage, buildInviteMessage, openWhatsApp } from '../lib/share'
import { buildActor, copyToClipboard } from '../lib/utils'
import { useTripData } from '../hooks/useTripData'
import { createExpense, deleteExpense, updateExpense } from '../services/expenses'
import { createSettlement } from '../services/settlements'
import { findUserByEmail } from '../services/users'
import { deleteTrip, inviteMemberToTrip, updateTrip, updateTripMemberRole } from '../services/trips'

const TripDashboard = lazy(() =>
  import('../components/dashboard/TripDashboard').then((module) => ({
    default: module.TripDashboard,
  })),
)

const tabs = [
  { value: 'overview', label: 'Hisab', emoji: '💸' },
  { value: 'expenses', label: 'Kharcha', emoji: '🧾' },
  { value: 'settlements', label: 'Settle', emoji: '🤝' },
  { value: 'activity', label: 'Activity', emoji: '📋' },
  { value: 'settings', label: 'Group', emoji: '👥' },
]
const EMPTY_MEMBERS = []

export const TripPage = () => {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { trip, expenses, settlements, activity, loading, notFound, error, retry } = useTripData(tripId)
  const { user, profile } = useAuth()

  const [activeTab, setActiveTab] = useState('overview')
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [expensePrefill, setExpensePrefill] = useState(null)
  const [editingExpense, setEditingExpense] = useState(null)
  const [showTripModal, setShowTripModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  const actor = buildActor(user, profile)
  const members = trip?.members ?? EMPTY_MEMBERS

  const membersMap = useMemo(() => buildMembersMap(members), [members])
  const metrics = useMemo(
    () =>
      buildDashboardMetrics({
        trip,
        expenses,
        settlements,
        currentUserId: user?.uid,
      }),
    [expenses, settlements, trip, user?.uid],
  )
  const isAdmin = trip?.adminIds?.includes(user?.uid)
  const canManageTrip = Boolean(isAdmin)
  const inviteOrigin = Capacitor.isNativePlatform()
    ? (import.meta.env.VITE_MOBILE_AUTH_URL || 'https://contri-app.vercel.app')
    : window.location.origin
  const inviteLink = trip ? `${inviteOrigin}/join?tripId=${trip.id}` : ''

  const handlePdfExport = async () => {
    const { exportTripSummaryPdf } = await import('../lib/exports')

    await exportTripSummaryPdf({
      trip,
      expenses,
      balances: metrics.balances,
      suggestions: metrics.suggestions,
      membersMap,
    })
  }

  const handleCsvExport = async () => {
    const { exportExpensesCsv } = await import('../lib/exports')
    await exportExpensesCsv({ trip, expenses, membersMap })
  }

  const handleCopyInvite = async () => {
    await copyToClipboard(inviteLink)
    toast.success('Invite link copied.')
  }

  const handleShareInvite = () => {
    openWhatsApp(buildInviteMessage({ tripName: trip.name, inviteLink }))
  }

  const handleShareHisab = () => {
    openWhatsApp(
      buildHisabMessage({
        trip,
        suggestions: metrics.suggestions,
        membersMap,
        totalSpent: metrics.totalSpent,
        budget: metrics.budget,
      }),
    )
  }

  const settleSuggestion = async (item) => {
    const today = new Date().toISOString().slice(0, 10)
    let settledAt = today
    if (trip?.startDate && settledAt < trip.startDate) settledAt = trip.startDate
    if (trip?.endDate && settledAt > trip.endDate) settledAt = trip.endDate

    await handleSettlementSubmit({
      from: item.from,
      to: item.to,
      amount: String(item.amount),
      method: trip.currency === 'INR' ? 'upi' : 'online',
      settledAt,
      note: 'Marked from who owes whom',
    })
  }

  const handleInviteMember = async (event) => {
    event.preventDefault()
    if (inviteLoading) return

    if (!canManageTrip) {
      toast.error('Only trip admins can invite members.')
      return
    }

    setInviteLoading(true)
    try {
      const invitedUser = await findUserByEmail(inviteEmail)

      if (!invitedUser) {
        toast.error('That email is not registered in Contri-app yet.')
        return
      }

      if (trip.memberIds.includes(invitedUser.uid)) {
        toast.error('That traveler is already in the trip.')
        return
      }

      await inviteMemberToTrip({ tripId: trip.id, member: invitedUser })
      toast.success('Member invited to the trip.')
      setInviteEmail('')
    } catch {
      toast.error('Could not invite this traveler. Check your connection and try again.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleTripUpdate = async (values) => {
    if (!canManageTrip) {
      toast.error('Only trip admins can edit trip details.')
      return
    }

    await updateTrip(trip.id, values)
    toast.success('Trip updated.')
  }

  const handleTripDelete = async () => {
    if (!canManageTrip) {
      toast.error('Only trip admins can delete this trip.')
      return
    }

    if (!window.confirm('Delete this trip and all of its expenses, settlements, and activity?')) {
      return
    }

    await deleteTrip(trip.id)
    toast.success('Trip deleted.')
    navigate('/')
  }

  const handleExpenseSubmit = async (values) => {
    if (editingExpense && !canManageTrip) {
      toast.error('Only trip admins can edit expenses.')
      return
    }

    if (editingExpense) {
      await updateExpense({
        tripId: trip.id,
        expenseId: editingExpense.id,
        values,
        actor,
        existingExpense: editingExpense,
      })
      toast.success('Expense updated.')
      setEditingExpense(null)
      return
    }

    await createExpense({
      tripId: trip.id,
      tripName: trip.name,
      memberIds: trip.memberIds,
      currency: trip.currency,
      values,
      actor,
    })
    toast.success('Expense added.')
  }

  const handleExpenseDelete = async (expense) => {
    if (!canManageTrip) {
      toast.error('Only trip admins can delete expenses.')
      return
    }

    if (!window.confirm(`Delete "${expense.title}"?`)) {
      return
    }

    await deleteExpense({
      tripId: trip.id,
      expense,
      actor,
    })
    toast.success('Expense deleted.')
  }

  const handleSettlementSubmit = async (values) => {
    if (!values.from || !values.to || values.from === values.to || Number(values.amount) <= 0) {
      toast.error('Enter a valid settlement with different payer and receiver.')
      return
    }

    if (
      isDateOutsideRange(values.settledAt, {
        min: trip.startDate,
        max: trip.endDate,
      })
    ) {
      toast.error('Settlement date must fall within the trip dates.')
      return
    }

    await createSettlement({
      tripId: trip.id,
      values,
      actor,
    })
    toast.success('Settlement recorded.')
  }

  const handleRoleChange = async (member, role) => {
    if (!canManageTrip) {
      toast.error('Only trip admins can manage roles.')
      return
    }

    const adminCount = trip.adminIds?.length || 0

    if (member.role === 'admin' && role !== 'admin' && adminCount <= 1) {
      toast.error('A trip needs at least one admin.')
      return
    }

    await updateTripMemberRole({
      tripId: trip.id,
      members,
      memberId: member.uid,
      role,
    })
    toast.success(`${member.name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`)
  }

  if (error && !trip && !loading) {
    return (
      <ErrorState
        description={error}
        onRetry={retry}
        title="This trip did not load"
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (notFound || !trip) {
    return (
      <EmptyState
        actionLabel="Back to trips"
        description="This trip could not be found, or your account is not part of it yet."
        onAction={() => navigate('/')}
        title="Trip unavailable"
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Trip header */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5">
          {trip.emoji === 'shivneri-fort' ? (
            <img alt="Shivneri Fort" className="h-12 w-12 object-contain" src="/shivneri-fort.png" />
          ) : (
            <span className="text-4xl">{trip.emoji}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink">{trip.name}</h1>
              <Badge>{trip.currency}</Badge>
              {isAdmin ? <Badge tone="teal">Admin</Badge> : null}
            </div>
            <p className="mt-1 truncate text-sm text-dusk">
              {trip.description || 'No description yet.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Members row */}
          <div className="flex flex-wrap items-center gap-2">
            {members.map((member) => (
              <div key={member.uid} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                <Avatar name={member.name} size="sm" />
                <div>
                  <p className="text-xs font-semibold text-ink">{member.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-dusk">
                    {member.role}{member.isGuest ? ' · guest' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowQuickAdd(true)} size="sm" type="button">
              <Plus className="h-4 w-4" />
              Add kharcha
            </Button>
            <Button onClick={handleShareHisab} size="sm" type="button" variant="secondary">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            {canManageTrip ? (
              <Button onClick={handleShareInvite} size="sm" type="button" variant="secondary">
                <Link2 className="h-4 w-4" />
                Invite
              </Button>
            ) : null}
            <Button onClick={handlePdfExport} size="sm" type="button" variant="secondary">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={handleCsvExport} size="sm" type="button" variant="secondary">
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </Button>
            {canManageTrip ? (
              <Button onClick={() => setShowTripModal(true)} size="sm" type="button" variant="secondary">
                <PencilLine className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.value
                ? 'bg-teal text-white shadow-sm'
                : 'text-dusk hover:bg-slate-100 hover:text-ink'
            }`}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            <span className="text-sm leading-none">{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-5">
          <BudgetBar budget={metrics.budget} currency={trip.currency} spent={metrics.totalSpent} />
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-dusk">Settle up</p>
                <h2 className="font-display text-xl font-bold text-ink">Who owes whom</h2>
              </div>
              <p className="text-right text-sm font-medium text-dusk">
                {Math.abs(metrics.yourNet) < 0.01
                  ? 'You are settled'
                  : metrics.yourNet > 0
                    ? `You get ${formatCurrency(metrics.yourNet, trip.currency)}`
                    : `You owe ${formatCurrency(Math.abs(metrics.yourNet), trip.currency)}`}
              </p>
            </div>
            <WhoOwesWhom
              currency={trip.currency}
              currentUserId={user?.uid}
              membersMap={membersMap}
              onMarkPaid={settleSuggestion}
              suggestions={metrics.suggestions}
              tripName={trip.name}
            />
          </section>
          <ErrorBoundary title="Charts failed to load">
            <Suspense fallback={<Skeleton className="h-[540px] rounded-[2rem]" />}>
              <TripDashboard
                metrics={metrics}
                onAddExpense={() => setShowQuickAdd(true)}
                trip={trip}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : null}

      {activeTab === 'expenses' ? (
        <ExpenseList
          currency={trip.currency}
          expenses={expenses}
          membersMap={membersMap}
          onCreate={() => setShowQuickAdd(true)}
          onDelete={handleExpenseDelete}
          onEdit={(expense) => {
            setEditingExpense(expense)
            setShowExpenseModal(true)
          }}
          canManage={canManageTrip}
        />
      ) : null}

      {activeTab === 'settlements' ? (
        <SettlementPanel
          balances={metrics.balances}
          members={members}
          membersMap={membersMap}
          onSubmit={handleSettlementSubmit}
          canManage
          currentUserId={user?.uid}
          settlements={settlements}
          suggestions={metrics.suggestions}
          trip={trip}
        />
      ) : null}

      {activeTab === 'activity' ? (
        <ActivityFeed activity={activity} currency={trip.currency} membersMap={membersMap} />
      ) : null}

      {activeTab === 'settings' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="font-display text-lg font-semibold text-ink">Members</h2>
            <p className="mt-1 text-sm text-dusk">Manage roles for everyone in this trip.</p>
            <div className="mt-5 space-y-2">
              {members.map((member) => (
                <div
                  key={member.uid}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={member.name} size="sm" src={member.photoURL} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{member.name}</p>
                      <p className="text-xs text-dusk">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={member.role === 'admin' ? 'teal' : 'default'}>{member.role}</Badge>
                    {member.isGuest ? <Badge tone="amber">Guest</Badge> : null}
                    {canManageTrip ? (
                      member.role === 'admin' ? (
                        <Button
                          disabled={(trip.adminIds?.length || 0) <= 1}
                          onClick={() => handleRoleChange(member, 'member')}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Demote
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleRoleChange(member, 'admin')}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Make admin
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold text-ink">Admin tools</h2>
            <p className="mt-1 text-sm text-dusk">Invite members and manage the trip.</p>

            {canManageTrip ? (
              <>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={handleCopyInvite} size="sm" type="button" variant="secondary">
                    <Link2 className="h-4 w-4" />
                    Copy link
                  </Button>
                  <Button onClick={handleShareInvite} size="sm" type="button" variant="secondary">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp invite
                  </Button>
                </div>

                <form className="mt-5 space-y-3" onSubmit={handleInviteMember}>
                  <Input
                    label="Invite by email"
                    onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteLoading}
                    placeholder="friend@example.com"
                    type="email"
                    value={inviteEmail}
                  />
                  <Button loading={inviteLoading} size="sm" type="submit">
                    <MailPlus className="h-4 w-4" />
                    Send invite
                  </Button>
                </form>

                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-600">Danger zone</p>
                  <p className="mt-1 text-xs text-red-500">
                    Permanently removes all expenses, settlements, and activity.
                  </p>
                  <Button className="mt-3" onClick={handleTripDelete} size="sm" type="button" variant="danger">
                    <Trash2 className="h-4 w-4" />
                    Delete trip
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-4 text-sm text-dusk">
                Only trip admins can invite members or delete the trip.
              </div>
            )}
          </Card>
        </div>
      ) : null}

      <div className="sm:hidden">
        <button
          className="fixed bottom-20 right-4 z-20 inline-flex h-14 items-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-white shadow-elevated transition active:scale-95"
          onClick={() => setShowQuickAdd(true)}
          type="button"
        >
          <Plus className="h-5 w-5" />
          Add kharcha
        </button>
      </div>

      {showQuickAdd ? (
        <QuickAddSheet
          currency={trip.currency}
          currentUserId={user?.uid}
          members={members}
          onAdvanced={(values) => {
            setEditingExpense(null)
            setExpensePrefill(values)
            setShowExpenseModal(true)
          }}
          onClose={() => setShowQuickAdd(false)}
          onSubmit={handleExpenseSubmit}
          open={showQuickAdd}
          trip={trip}
        />
      ) : null}

      {showExpenseModal ? (
        <ExpenseFormModal
          currency={trip.currency}
          initialExpense={editingExpense || expensePrefill}
          members={members}
          onClose={() => {
            setShowExpenseModal(false)
            setEditingExpense(null)
            setExpensePrefill(null)
          }}
          onSubmit={handleExpenseSubmit}
          open={showExpenseModal}
          trip={trip}
        />
      ) : null}

      {showTripModal ? (
        <TripFormModal
          initialValues={trip}
          onClose={() => setShowTripModal(false)}
          onSubmit={handleTripUpdate}
          open={showTripModal}
          submitLabel="Save trip"
          title="Edit trip"
        />
      ) : null}
    </div>
  )
}
