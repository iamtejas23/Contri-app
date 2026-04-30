import {
  FileSpreadsheet,
  FileText,
  Link2,
  MailPlus,
  PencilLine,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Suspense, lazy, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

import { ActivityFeed } from '../components/feed/ActivityFeed'
import { ExpenseFormModal } from '../components/expenses/ExpenseFormModal'
import { ExpenseList } from '../components/expenses/ExpenseList'
import { SettlementPanel } from '../components/settlements/SettlementPanel'
import { TripFormModal } from '../components/trips/TripFormModal'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { useAuth } from '../context/useAuth'
import { buildDashboardMetrics, buildMembersMap } from '../lib/balances'
import { isDateOutsideRange } from '../lib/date'
import { copyToClipboard, getDisplayName } from '../lib/utils'
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
  { value: 'overview', label: 'Overview' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'settlements', label: 'Settlements' },
  { value: 'activity', label: 'Activity' },
  { value: 'settings', label: 'Settings' },
]
const EMPTY_MEMBERS = []

export const TripPage = () => {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { trip, expenses, settlements, activity, loading, notFound } = useTripData(tripId)
  const { user, profile } = useAuth()

  const [activeTab, setActiveTab] = useState('overview')
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [showTripModal, setShowTripModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  const actor = {
    uid: user?.uid,
    name: getDisplayName(profile || user),
    email: profile?.email || user?.email || '',
  }
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
  const inviteLink = trip ? `${window.location.origin}/join?tripId=${trip.id}` : ''

  const handlePdfExport = async () => {
    const { exportTripSummaryPdf } = await import('../lib/exports')

    exportTripSummaryPdf({
      trip,
      expenses,
      balances: metrics.balances,
      suggestions: metrics.suggestions,
      membersMap,
    })
  }

  const handleCsvExport = async () => {
    const { exportExpensesCsv } = await import('../lib/exports')
    exportExpensesCsv({ trip, expenses, membersMap })
  }

  const handleCopyInvite = async () => {
    await copyToClipboard(inviteLink)
    toast.success('Invite link copied.')
  }

  const handleInviteMember = async (event) => {
    event.preventDefault()

    if (!canManageTrip) {
      toast.error('Only trip admins can invite members.')
      return
    }

    const invitedUser = await findUserByEmail(inviteEmail)

    if (!invitedUser) {
      toast.error('That email is not registered in Contri-app yet.')
      return
    }

    if (trip.memberIds.includes(invitedUser.uid)) {
      toast.error('That traveler is already in the trip.')
      return
    }

    await inviteMemberToTrip({
      tripId: trip.id,
      member: invitedUser,
    })

    toast.success('Member invited to the trip.')
    setInviteEmail('')
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
    if (!canManageTrip) {
      toast.error('Only trip admins can manage expenses.')
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
    if (!canManageTrip) {
      toast.error('Only trip admins can record settlements.')
      return
    }

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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-[2rem]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-[2rem]" />
          ))}
        </div>
        <Skeleton className="h-[480px] rounded-[2rem]" />
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
    <div className="space-y-6">
      <Card className="overflow-hidden bg-gradient-to-br from-cream to-white/80 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-5xl">{trip.emoji}</span>
              <Badge>{trip.currency}</Badge>
              {isAdmin ? <Badge className="bg-teal/15 text-teal">Admin</Badge> : null}
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold text-ink sm:text-5xl">
              {trip.name}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-dusk/72">
              {trip.description || 'No description yet. Add some context for the crew.'}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {members.map((member) => (
                <div
                  key={member.uid}
                  className="flex items-center gap-3 rounded-full bg-white/80 px-3 py-2"
                >
                  <Avatar name={member.name} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{member.name}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-dusk/55">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {canManageTrip ? (
              <Button onClick={() => setShowExpenseModal(true)} type="button">
                <Plus className="h-4 w-4" />
                Add expense
              </Button>
            ) : null}
            {canManageTrip ? (
              <Button onClick={handleCopyInvite} type="button" variant="secondary">
                <Link2 className="h-4 w-4" />
                Invite link
              </Button>
            ) : null}
            <Button
              onClick={handlePdfExport}
              type="button"
              variant="secondary"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              onClick={handleCsvExport}
              type="button"
              variant="secondary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </Button>
            {canManageTrip ? (
              <Button onClick={() => setShowTripModal(true)} type="button" variant="secondary">
                <PencilLine className="h-4 w-4" />
                Edit trip
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.value ? 'bg-ink text-white' : 'bg-white/70 text-dusk'
            }`}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <Suspense fallback={<Skeleton className="h-[540px] rounded-[2rem]" />}>
          <TripDashboard
            metrics={metrics}
            onAddExpense={canManageTrip ? () => setShowExpenseModal(true) : undefined}
            trip={trip}
          />
        </Suspense>
      ) : null}

      {activeTab === 'expenses' ? (
        <ExpenseList
          currency={trip.currency}
          expenses={expenses}
          membersMap={membersMap}
          onCreate={canManageTrip ? () => setShowExpenseModal(true) : undefined}
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
          canManage={canManageTrip}
          settlements={settlements}
          suggestions={metrics.suggestions}
          trip={trip}
        />
      ) : null}

      {activeTab === 'activity' ? (
        <ActivityFeed activity={activity} currency={trip.currency} membersMap={membersMap} />
      ) : null}

      {activeTab === 'settings' ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">Membership</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink">
              Keep the crew in sync
            </h2>

            <div className="mt-6 space-y-3">
              {members.map((member) => (
                <div
                  key={member.uid}
                  className="flex items-center justify-between rounded-[1.5rem] bg-sand/75 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={member.name} size="sm" src={member.photoURL} />
                    <div>
                      <p className="font-semibold text-ink">{member.name}</p>
                      <p className="text-sm text-dusk/65">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{member.role}</Badge>
                    {canManageTrip ? (
                      member.role === 'admin' ? (
                        <Button
                          disabled={(trip.adminIds?.length || 0) <= 1}
                          onClick={() => handleRoleChange(member, 'member')}
                          type="button"
                          variant="secondary"
                        >
                          Member
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleRoleChange(member, 'admin')}
                          type="button"
                          variant="secondary"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Admin
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-sm uppercase tracking-[0.18em] text-dusk/55">Admin tools</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink">
              Invite members and control the trip
            </h2>

            {canManageTrip ? (
              <>
                <form className="mt-6 space-y-4" onSubmit={handleInviteMember}>
                  <Input
                    label="Invite by email"
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="friend@example.com"
                    type="email"
                    value={inviteEmail}
                  />
                  <Button type="submit" variant="secondary">
                    <MailPlus className="h-4 w-4" />
                    Add member
                  </Button>
                </form>

                <div className="mt-8 rounded-[1.75rem] border border-dashed border-coral/30 bg-coral/8 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-coral">
                    Danger zone
                  </p>
                  <p className="mt-2 text-sm text-dusk/70">
                    Deleting a trip removes its expenses, settlements, and activity feed.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={handleTripDelete}
                    type="button"
                    variant="danger"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete trip
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-6 rounded-[1.75rem] bg-sand/75 px-4 py-4 text-sm text-dusk/70">
                Only trip admins can invite members or delete the trip.
              </p>
            )}
          </Card>
        </div>
      ) : null}

      {showExpenseModal ? (
        <ExpenseFormModal
          currency={trip.currency}
          initialExpense={editingExpense}
          members={members}
          onClose={() => {
            setShowExpenseModal(false)
            setEditingExpense(null)
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
