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
import { Suspense, lazy, useMemo, useRef, useState } from 'react'
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
import { TripMembersIndicator } from '../components/trips/TripMembersIndicator'
import { MemberAvatar } from '../components/ui/MemberAvatar'
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
import { validateSettlementForWrite } from '../lib/financialValidation.js'
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
  const settlementSubmitLock = useRef(false)

  const actor = buildActor(user, profile)
  const members = trip?.members ?? EMPTY_MEMBERS
  const displayMembers = useMemo(() => members.map((member) => (
    member.uid === user?.uid
      ? {
          ...member,
          name: profile?.name || user?.displayName || member.name,
          photoURL: profile?.photoURL || user?.photoURL || member.photoURL || '',
        }
      : member
  )), [members, profile?.name, profile?.photoURL, user?.displayName, user?.photoURL, user?.uid])

  const membersMap = useMemo(() => buildMembersMap(displayMembers), [displayMembers])
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

    if (values.currency !== trip.currency && (expenses.length || settlements.length)) {
      toast.error('Trip currency cannot be changed after financial records exist. Existing amounts have no saved conversion rate.')
      return false
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
        memberIds: trip.memberIds || members.map((member) => member.uid),
        currency: trip.currency,
      })
      toast.success('Expense updated.')
      setEditingExpense(null)
      return
    }

    await createExpense({
      tripId: trip.id,
      tripName: trip.name,
      memberIds: trip.memberIds || members.map((member) => member.uid),
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
    if (settlementSubmitLock.current) return
    const tripMemberIds = trip.memberIds || members.map((member) => member.uid)
    const validation = validateSettlementForWrite({ values, currency: trip.currency, memberIds: tripMemberIds })
    if (!validation.valid) {
      toast.error(validation.message)
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

    settlementSubmitLock.current = true
    try {
      await createSettlement({
        tripId: trip.id,
        values,
        actor,
        memberIds: tripMemberIds,
        currency: trip.currency,
      })
      toast.success('Settlement recorded.')
    } finally {
      settlementSubmitLock.current = false
    }
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

  if (error && !loading) {
    return (
      <ErrorState
        description={error}
        onRetry={retry}
        title={trip ? 'Some trip data did not load' : 'This trip did not load'}
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
    <div className="min-w-0 space-y-5 pb-16 sm:pb-0">
      {/* Trip header */}
      <Card className="p-0 overflow-hidden">
        <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:items-center sm:gap-4 sm:px-6 sm:py-5">
          {trip.emoji === 'shivneri-fort' ? (
            <img alt="Shivneri Fort" className="h-12 w-12 object-contain" src="/shivneri-fort.png" />
          ) : (
            <span className="text-4xl">{trip.emoji}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words font-display text-2xl font-bold text-ink [overflow-wrap:anywhere]">{trip.name}</h1>
              <Badge>{trip.currency}</Badge>
              {isAdmin ? <Badge tone="teal">Admin</Badge> : null}
            </div>
            <p className="mt-1 truncate text-sm text-dusk">
              {trip.description || 'No description yet.'}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Members row */}
          <div className="flex flex-wrap items-center gap-2">
            <TripMembersIndicator className="bg-slate-50" members={displayMembers} maxVisible={5} size="regular" />
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
      <div aria-label="Trip sections" className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:flex sm:flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all min-[400px]:px-3 sm:flex-shrink-0 sm:px-4 sm:text-sm ${
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
                {metrics.yourNet === 0
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
          activity={activity}
          currency={trip.currency}
          expenses={expenses}
          membersMap={membersMap}
          currentUserId={user?.uid}
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
          members={displayMembers}
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
              {displayMembers.map((member) => {
                const finances = metrics.balances.find((entry) => entry.uid === member.uid)
                return (
                <div
                  key={member.uid}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar member={member} name={member.name} size="sm" src={member.photoURL} uid={member.uid} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{member.name || 'Traveler'}</p>
                      <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-dusk">
                        <span>Paid {formatCurrency(finances?.paid || 0, trip.currency)}</span>
                        <span>Share {formatCurrency(finances?.share || 0, trip.currency)}</span>
                        <span>Settled: {formatCurrency(finances?.settledOut || 0, trip.currency)} paid / {formatCurrency(finances?.settledIn || 0, trip.currency)} received</span>
                        <span>Net {formatCurrency(finances?.net || 0, trip.currency)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
                    <Badge tone={member.role === 'admin' ? 'teal' : 'default'}>{member.role || 'member'}</Badge>
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
              )})}
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
          className="trip-expense-fab fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-20 inline-flex h-14 items-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-white shadow-elevated transition active:scale-95"
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
          members={displayMembers}
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
          currentUserId={user?.uid}
          initialExpense={editingExpense || expensePrefill}
          members={displayMembers}
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
          currencyLocked={Boolean(expenses.length || settlements.length)}
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
