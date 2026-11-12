import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Flag, Map, MapPin, PencilLine, Play, Plus, RotateCcw, Route as RouteIcon, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { getNextUpcomingRoutePointId, getRouteProgress, getTripRoutePoints, createEmptyTripRoute, reorderTripRouteStop, setTripRoutePointStatus } from '../../lib/tripRoute.js'
import { subscribeTripRoute, updateTripRoute } from '../../services/tripRoutes.js'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { MemberAvatar } from '../ui/MemberAvatar'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'

const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const displayDate = (value) => {
  if (!value) return 'Not set'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const statusLabels = { upcoming: 'Upcoming', in_progress: 'In progress', completed: 'Completed' }
const statusStyles = {
  upcoming: 'trip-route-status--upcoming',
  in_progress: 'trip-route-status--current',
  completed: 'trip-route-status--completed',
}

const blankLocationForm = (point) => ({
  name: point?.name || '',
  description: point?.description || '',
  plannedArrivalDate: point?.plannedArrivalDate || '',
})

const blankStopForm = (stop) => ({
  id: stop?.id || '',
  name: stop?.name || '',
  description: stop?.description || '',
  plannedArrivalDate: stop?.plannedArrivalDate || '',
  actualCompletionDate: stop?.actualCompletionDate || '',
  status: stop?.status || 'upcoming',
})

const PointMarker = ({ point, number, isNext }) => {
  return (
    <div className={`trip-route-marker ${point.status === 'completed' ? 'trip-route-marker--completed' : point.status === 'in_progress' ? 'trip-route-marker--current' : isNext ? 'trip-route-marker--next' : 'trip-route-marker--upcoming'}`} role="img" aria-label={`${statusLabels[point.status]} location ${number}: ${point.name}`}>
      {isNext ? <><span className="trip-route-ripple trip-route-ripple--outer" /><span className="trip-route-ripple trip-route-ripple--inner" /></> : null}
      {point.status === 'completed' ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <span className={`trip-route-marker-dot ${point.status === 'in_progress' ? 'trip-route-marker-dot--current' : ''}`} />}
      <span className="trip-route-number">{String(number).padStart(2, '0')}</span>
    </div>
  )
}

export const TripRoute = ({ trip, tripId, members = [], actorUid, canManage = false }) => {
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [setupOpen, setSetupOpen] = useState(false)
  const [locationForm, setLocationForm] = useState({ start: blankLocationForm(), destination: blankLocationForm() })
  const [stopOpen, setStopOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [editingStop, setEditingStop] = useState(null)
  const [stopForm, setStopForm] = useState(blankStopForm())
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!tripId) return undefined
    return subscribeTripRoute(tripId, (value) => {
      setRoute(value)
      setLoading(false)
      setError('')
    }, (loadError) => {
      setLoading(false)
      setError(loadError?.code === 'permission-denied' ? 'You no longer have access to this trip route.' : 'The shared route could not be loaded. Check your connection and try again.')
    })
  }, [retryKey, tripId])

  const points = useMemo(() => getTripRoutePoints(route), [route])
  const nextUpcomingId = useMemo(() => getNextUpcomingRoutePointId(route), [route])
  const progress = useMemo(() => getRouteProgress(route), [route])
  const isRouteReady = Boolean(route?.start?.name?.trim() && route?.destination?.name?.trim())

  const persist = async (transform, successMessage) => {
    if (!canManage || saving) return
    setSaving(true)
    try {
      await updateTripRoute({ tripId, actorUid, transform })
      if (successMessage) toast.success(successMessage)
      return true
    } catch (saveError) {
      toast.error(saveError?.message || 'The route could not be saved.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const openSetup = () => {
    const value = route || createEmptyTripRoute(tripId)
    setFormError('')
    setLocationForm({ start: blankLocationForm(value.start), destination: blankLocationForm(value.destination) })
    setSetupOpen(true)
  }

  const saveSetup = async (event) => {
    event.preventDefault()
    setFormError('')
    const success = await persist((current) => ({
      ...current,
      start: { ...current.start, ...locationForm.start },
      destination: { ...current.destination, ...locationForm.destination },
    }), 'Route details saved.')
    if (success) setSetupOpen(false)
  }

  const openStop = (stop = null) => {
    setEditingStop(stop)
    setStopForm(blankStopForm(stop))
    setFormError('')
    setStopOpen(true)
  }

  const saveStop = async (event) => {
    event.preventDefault()
    setFormError('')
    const value = { ...stopForm, name: stopForm.name.trim(), description: stopForm.description.trim() }
    if (!value.name) { setFormError('Enter a name for this stop.'); return }
    if (value.status === 'completed' && !value.actualCompletionDate) { setFormError('Set the actual completion date for a completed stop.'); return }
    if (value.status !== 'completed' && value.actualCompletionDate) { setFormError('An actual completion date is only valid for a completed stop.'); return }
    const nextStop = { ...value, id: editingStop?.id || value.id || globalThis.crypto?.randomUUID?.() || `stop-${Date.now()}` }
    const success = await persist((current) => {
      const stops = [...(current.stops || [])]
      const index = stops.findIndex((stop) => stop.id === nextStop.id)
      if (index >= 0) stops[index] = nextStop
      else stops.push(nextStop)
      return { ...current, stops }
    }, editingStop ? 'Stop updated.' : 'Stop added to the route.')
    if (success) setStopOpen(false)
  }

  const changeStatus = (point, status) => persist((current) => (
    setTripRoutePointStatus(current, point.id, status, status === 'completed' ? localToday() : '')
  ), status === 'completed' ? 'Stop marked completed.' : status === 'in_progress' ? 'Current stop updated.' : 'Stop reopened.')

  const removeStop = (stop) => {
    setRemoveTarget(stop)
  }

  const confirmRemoveStop = async () => {
    if (!removeTarget) return
    const target = removeTarget
    const success = await persist((current) => ({ ...current, stops: current.stops.filter((item) => item.id !== target.id) }), 'Stop removed.')
    if (success) setRemoveTarget(null)
  }

  const moveStop = (stop, offset) => persist((current) => reorderTripRouteStop(current, stop.id, offset), 'Route order updated.')
  const retry = () => {
    setError('')
    setLoading(true)
    setRetryKey((value) => value + 1)
  }

  if (loading) return <Card className="min-h-40 animate-pulse"><p className="text-sm text-dusk">Loading shared trip route…</p></Card>
  if (error) return <Card role="alert" className="space-y-3"><p className="text-sm text-red-600">{error}</p><Button onClick={retry} type="button" variant="secondary">Try again</Button></Card>

  return (
    <section className="min-w-0 space-y-4" aria-label="Trip route">
      <Card className="overflow-hidden border-slate-700/50 bg-gradient-to-br from-[#111827] via-[#111827] to-[#17223b] p-0 text-white shadow-[0_20px_55px_rgba(37,99,235,0.10)] dark:border-white/10">
        <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-300"><RouteIcon aria-hidden="true" className="h-4 w-4" /> Shared journey</p>
            <h2 className="mt-2 break-words font-display text-2xl font-bold tracking-tight sm:text-3xl">Trip route</h2>
            <p className="mt-1 text-sm text-slate-300">A shared plan for every stop along the way.</p>
          </div>
          {canManage ? <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={saving} onClick={openSetup} type="button" variant="secondary"><PencilLine aria-hidden="true" className="h-4 w-4" /> {isRouteReady ? 'Edit endpoints' : 'Set up route'}</Button>
            {isRouteReady ? <Button className="min-h-11" disabled={saving} onClick={() => openStop()} type="button"><Plus aria-hidden="true" className="h-4 w-4" /> Add stop</Button> : null}
          </div> : <span className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-300">Shared with trip members</span>}
        </div>
        {isRouteReady ? <div className="border-t border-white/10 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-200">Journey progress</span><span className="tabular-nums text-slate-300">{progress.completed} of {progress.total} locations · {progress.percent}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-[width] duration-500" style={{ width: `${progress.percent}%` }} /></div>
        </div> : null}
      </Card>

      {!isRouteReady ? (
        <Card className="p-3 sm:p-5">
          <EmptyState description={canManage ? 'Set the starting location and destination to create a shared route. Add intermediate stops and dates whenever you are ready.' : 'The trip admin has not added a route yet.'} icon={Map} title="No route has been planned" />
          {canManage ? <div className="mt-3 flex justify-center"><Button className="min-h-11" onClick={openSetup} type="button"><Map aria-hidden="true" className="h-4 w-4" /> Set up route</Button></div> : null}
        </Card>
      ) : <>
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-dusk">In order</p><h3 className="mt-1 font-display text-lg font-semibold text-ink">Journey timeline</h3></div>
            {canManage ? <span className="hidden text-xs text-dusk sm:block">Only trip admins can edit this route.</span> : null}
          </div>
          <ol className="trip-route-timeline">
            {points.map((point, index) => {
              const isNext = point.id === nextUpcomingId
              const isStop = point.type === 'stop'
              const stopIndex = isStop ? route.stops.findIndex((stop) => stop.id === point.id) : -1
              const isLast = index === points.length - 1
              const TypeIcon = point.type === 'start' ? Play : point.type === 'destination' ? Flag : MapPin
              return <li className="trip-route-item" key={point.id}>
                {!isLast ? <span className={`trip-route-line ${point.status === 'completed' ? 'trip-route-line--done' : ''}`} aria-hidden="true" /> : null}
                <div className="trip-route-marker-column"><PointMarker isNext={isNext} number={index + 1} point={point} /></div>
                <div className="min-w-0 pb-6">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.13em] text-dusk"><TypeIcon aria-hidden="true" className="h-3 w-3" />{point.type === 'start' ? 'Starting point' : point.type === 'destination' ? 'Destination' : 'Stop'}</span>
                        <span className={`trip-route-status rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[point.status]}`}>{statusLabels[point.status]}</span>
                        {isNext ? <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-300">Next up</span> : null}
                      </div>
                      <h4 className="mt-1 break-words font-display text-base font-semibold text-ink [overflow-wrap:anywhere]">{point.name}</h4>
                      {point.description ? <p className="mt-1 break-words text-sm leading-5 text-dusk [overflow-wrap:anywhere]">{point.description}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dusk">
                        <span><span className="font-medium text-ink/80">Planned:</span> {displayDate(point.plannedArrivalDate)}</span>
                        {point.status === 'completed' ? <span><span className="font-medium text-ink/80">Completed:</span> {displayDate(point.actualCompletionDate)}</span> : null}
                      </div>
                    </div>
                    {canManage ? <div className="flex min-w-0 flex-wrap items-center gap-1 sm:justify-end">
                      {isStop ? <>
                        <button aria-label={`Move ${point.name} earlier`} className="trip-route-action" disabled={saving || stopIndex === 0} onClick={() => moveStop(point, -1)} type="button"><ArrowUp aria-hidden="true" className="h-4 w-4" /></button>
                        <button aria-label={`Move ${point.name} later`} className="trip-route-action" disabled={saving || stopIndex === route.stops.length - 1} onClick={() => moveStop(point, 1)} type="button"><ArrowDown aria-hidden="true" className="h-4 w-4" /></button>
                      </> : null}
                      <button aria-label={`Edit ${point.name}`} className="trip-route-action" disabled={saving} onClick={() => isStop ? openStop(point) : openSetup()} type="button"><PencilLine aria-hidden="true" className="h-4 w-4" /></button>
                      {isStop ? <button aria-label={`Remove ${point.name}`} className="trip-route-action trip-route-action--danger" disabled={saving} onClick={() => removeStop(point)} type="button"><Trash2 aria-hidden="true" className="h-4 w-4" /></button> : null}
                      {point.status === 'upcoming' && !points.slice(0, index).some((item) => item.status !== 'completed') ? <button className="min-h-10 rounded-lg px-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/60" disabled={saving} onClick={() => changeStatus(point, 'in_progress')} type="button"><Play aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Start</button> : null}
                      {point.status === 'in_progress' ? <button className="min-h-10 rounded-lg px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/60" disabled={saving} onClick={() => changeStatus(point, 'completed')} type="button"><Check aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Complete</button> : null}
                      {point.status === 'completed' ? <button aria-label={`Reopen ${point.name}`} className="trip-route-action" disabled={saving || points.slice(index + 1).some((item) => item.status === 'completed')} onClick={() => changeStatus(point, 'upcoming')} type="button"><RotateCcw aria-hidden="true" className="h-4 w-4" /></button> : null}
                    </div> : null}
                  </div>
                </div>
              </li>
            })}
          </ol>
          {!route.stops.length && canManage ? <p className="ml-12 -mt-2 pb-1 text-xs text-dusk">Add stops between the start and destination to show the full journey.</p> : null}
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <div className="flex items-center gap-2"><Map aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" /><h3 className="font-display text-base font-semibold text-ink">Trip summary</h3></div>
          <p className="mt-1 break-words text-sm text-dusk [overflow-wrap:anywhere]">{trip.name || trip.tripName || 'Shared trip'}</p>
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryItem label="From" value={route.start.name} />
            <SummaryItem label="To" value={route.destination.name} />
            <SummaryItem label="Trip dates" value={`${displayDate(trip.startDate)} – ${displayDate(trip.endDate)}`} />
            <SummaryItem label="Stops" value={`${progress.total} total · ${progress.completed} done · ${progress.remaining} left`} />
          </div>
          <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-2"><span className="text-xs font-medium text-dusk">{members.length} trip {members.length === 1 ? 'member' : 'members'}</span><div className="flex -space-x-2">{members.slice(0, 5).map((member) => <MemberAvatar className="ring-2 ring-white dark:ring-[#111827]" key={member.uid} label={`${member.name || 'Member'} profile photo`} member={member} name={member.name} size="xs" src={member.photoURL} uid={member.uid} />)}{members.length > 5 ? <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-700 dark:text-white dark:ring-[#111827]">+{members.length - 5}</span> : null}</div></div>
            <div className="min-w-[130px] flex-1 sm:max-w-48"><div className="mb-1 flex justify-between text-[10px] text-dusk"><span>Journey completion</span><span>{progress.percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} /></div></div>
          </div>
        </Card>
      </>}

      <Modal description="Starting point and final destination for the shared journey." footer={<div className="flex justify-end gap-2"><Button disabled={saving} onClick={() => setSetupOpen(false)} type="button" variant="secondary">Cancel</Button><Button disabled={saving} form="trip-route-endpoints" type="submit">{saving ? 'Saving…' : 'Save route'}</Button></div>} onClose={() => setSetupOpen(false)} open={setupOpen} title="Route endpoints" size="compact">
        <form className="space-y-4" id="trip-route-endpoints" onSubmit={saveSetup}>
          {['start', 'destination'].map((key) => <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-white/10" key={key}>
            <legend className="px-1 text-sm font-semibold text-ink">{key === 'start' ? 'Starting location' : 'Final destination'}</legend>
            <Input autoComplete="off" label="Location name" maxLength={120} onChange={(event) => setLocationForm((current) => ({ ...current, [key]: { ...current[key], name: event.target.value } }))} required value={locationForm[key].name} />
            <Textarea label="Description (optional)" maxLength={240} onChange={(event) => setLocationForm((current) => ({ ...current, [key]: { ...current[key], description: event.target.value } }))} rows={2} value={locationForm[key].description} />
            <Input label="Planned arrival" onChange={(event) => setLocationForm((current) => ({ ...current, [key]: { ...current[key], plannedArrivalDate: event.target.value } }))} type="date" value={locationForm[key].plannedArrivalDate} />
          </fieldset>)}
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
        </form>
      </Modal>

      <Modal description="Add a place between the starting point and final destination." footer={<div className="flex justify-end gap-2"><Button disabled={saving} onClick={() => setStopOpen(false)} type="button" variant="secondary">Cancel</Button><Button disabled={saving} form="trip-route-stop" type="submit">{saving ? 'Saving…' : editingStop ? 'Save stop' : 'Add stop'}</Button></div>} onClose={() => setStopOpen(false)} open={stopOpen} title={editingStop ? 'Edit route stop' : 'Add route stop'} size="compact">
        <form className="space-y-4" id="trip-route-stop" onSubmit={saveStop}>
          <Input autoComplete="off" label="Stop name" maxLength={120} onChange={(event) => setStopForm((current) => ({ ...current, name: event.target.value }))} required value={stopForm.name} />
          <Textarea label="Description (optional)" maxLength={240} onChange={(event) => setStopForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={stopForm.description} />
          <Input label="Planned arrival" onChange={(event) => setStopForm((current) => ({ ...current, plannedArrivalDate: event.target.value }))} type="date" value={stopForm.plannedArrivalDate} />
          {editingStop?.status === 'completed' ? <Input label="Actual completion date" onChange={(event) => setStopForm((current) => ({ ...current, actualCompletionDate: event.target.value }))} required type="date" value={stopForm.actualCompletionDate} /> : null}
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
        </form>
      </Modal>

      <Modal description="This removes only the selected location from the shared route. Trip records and finances are unchanged." footer={<div className="flex justify-end gap-2"><Button disabled={saving} onClick={() => setRemoveTarget(null)} type="button" variant="secondary">Cancel</Button><Button className="bg-red-600 hover:bg-red-700" disabled={saving} onClick={confirmRemoveStop} type="button">{saving ? 'Removing…' : 'Remove stop'}</Button></div>} onClose={() => setRemoveTarget(null)} open={Boolean(removeTarget)} title="Remove route stop" size="compact">
        <p className="break-words text-sm text-dusk [overflow-wrap:anywhere]">Remove <strong className="text-ink">{removeTarget?.name}</strong> from this journey?</p>
      </Modal>
    </section>
  )
}

const SummaryItem = ({ label, value }) => <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5"><p className="text-[10px] font-semibold uppercase tracking-wider text-dusk">{label}</p><p className="mt-1 break-words text-xs font-semibold text-ink [overflow-wrap:anywhere]">{value}</p></div>
