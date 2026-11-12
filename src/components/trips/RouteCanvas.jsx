import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Flag, LocateFixed, Map, MapPin, Maximize2, Play, ZoomIn, ZoomOut } from 'lucide-react'
import {
  buildRouteCanvasSegments,
  getRouteCanvasCoordinates,
  getRouteStopProgress,
  getRouteTimelineSegments,
  getTripRouteCanvasPoints,
  isInsideMaharashtra,
} from '../../lib/tripRoute.js'
import { MAHARASHTRA_POLYGONS, MAHARASHTRA_VIEWBOX } from '../../data/maharashtraBoundary.js'

const statusColor = { completed: '#34d399', in_progress: '#60a5fa', upcoming: '#a78bfa' }
const statusText = { completed: 'Completed', in_progress: 'In progress', upcoming: 'Upcoming' }
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const shortened = (value) => value.length > 18 ? `${value.slice(0, 17)}…` : value
const displayDate = (value) => {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
const mapWidth = MAHARASHTRA_VIEWBOX.width
const mapHeight = MAHARASHTRA_VIEWBOX.height

const polygonPath = (rings) => rings.map((ring) => (
  `M ${ring.map(([x, y]) => `${x} ${(y / 100) * mapHeight}`).join(' L ')} Z`
)).join(' ')

export const RouteCanvas = ({ route, canManage, onEditPoint, onPositionChange }) => {
  const svgRef = useRef(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState(null)
  const [panDrag, setPanDrag] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const timelineRef = useRef(null)
  const activeTimelinePointRef = useRef(null)
  const routePoints = useMemo(() => getTripRouteCanvasPoints(route), [route])
  const stopProgress = useMemo(() => getRouteStopProgress(route), [route])
  const timelineSegments = useMemo(() => getRouteTimelineSegments(routePoints), [routePoints])
  const activePointId = routePoints.find((point) => point.status === 'in_progress')?.id
    || routePoints.find((point) => point.status === 'upcoming')?.id
    || routePoints.at(-1)?.id
  const visibleWidth = mapWidth / zoom
  const visibleHeight = mapHeight / zoom
  const viewX = (mapWidth - visibleWidth) / 2 + pan.x
  const viewY = (mapHeight - visibleHeight) / 2 + pan.y
  const viewBox = `${viewX} ${viewY} ${visibleWidth} ${visibleHeight}`
  const displayedPoints = routePoints.map((point) => drag?.id === point.id ? { ...point, canvasPosition: drag.position } : point)
  const routeSegments = buildRouteCanvasSegments(displayedPoints)
  const polygonPaths = useMemo(() => MAHARASHTRA_POLYGONS.map(polygonPath), [])

  const svgPosition = (event) => {
    const svg = svgRef.current
    if (!svg) return null
    const matrix = svg.getScreenCTM?.()
    if (matrix && svg.createSVGPoint) {
      const point = svg.createSVGPoint()
      point.x = event.clientX
      point.y = event.clientY
      const local = point.matrixTransform(matrix.inverse())
      return { x: local.x, y: local.y }
    }
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: viewX + ((event.clientX - rect.left) / rect.width) * visibleWidth,
      y: viewY + ((event.clientY - rect.top) / rect.height) * visibleHeight,
    }
  }

  const positionFromPointer = (event) => {
    const local = svgPosition(event)
    if (!local) return null
    return { x: local.x, y: (local.y / mapHeight) * 100 }
  }

  const handlePointerDown = (event, point) => {
    if (!canManage || !svgRef.current) return
    event.preventDefault()
    event.stopPropagation()
    svgRef.current.setPointerCapture?.(event.pointerId)
    const position = positionFromPointer(event) || point.canvasPosition
    setDrag({ id: point.id, pointerId: event.pointerId, position: point.canvasPosition, start: position, moved: false })
  }

  const handleBackgroundPointerDown = (event) => {
    if (!canManage || event.target.closest?.('[data-route-point]')) return
    event.preventDefault()
    svgRef.current?.setPointerCapture?.(event.pointerId)
    setPanDrag({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, pan })
  }

  const handlePointerMove = (event) => {
    if (drag?.pointerId === event.pointerId) {
      const position = positionFromPointer(event)
      if (!position) return
      const moved = drag.moved || Math.hypot(position.x - drag.start.x, position.y - drag.start.y) > 1
      // Pins freeze at the boundary if a gesture attempts to cross it.
      const bounded = isInsideMaharashtra(position) ? position : drag.position
      setDrag((current) => current?.pointerId === event.pointerId ? { ...current, position: bounded, moved } : current)
      return
    }
    if (panDrag?.pointerId !== event.pointerId) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return
    const maxPanX = (mapWidth - visibleWidth) / 2
    const maxPanY = (mapHeight - visibleHeight) / 2
    setPan({
      x: clamp(panDrag.pan.x - ((event.clientX - panDrag.clientX) / rect.width) * visibleWidth, -maxPanX, maxPanX),
      y: clamp(panDrag.pan.y - ((event.clientY - panDrag.clientY) / rect.height) * visibleHeight, -maxPanY, maxPanY),
    })
  }

  const handlePointerUp = (event) => {
    if (drag?.pointerId === event.pointerId) {
      const position = positionFromPointer(event)
      const finalPosition = position && isInsideMaharashtra(position) ? position : drag.position
      const shouldSave = drag.moved && (finalPosition.x !== routePoints.find((point) => point.id === drag.id)?.canvasPosition.x || finalPosition.y !== routePoints.find((point) => point.id === drag.id)?.canvasPosition.y)
      const pointId = drag.id
      setDrag(null)
      if (shouldSave) {
        suppressClick.current = true
        window.setTimeout(() => { suppressClick.current = false }, 0)
        onPositionChange(pointId, finalPosition)
      }
      return
    }
    if (panDrag?.pointerId === event.pointerId) setPanDrag(null)
  }

  const handlePointerCancel = (event) => {
    if (drag?.pointerId === event.pointerId) setDrag(null)
    if (panDrag?.pointerId === event.pointerId) setPanDrag(null)
  }

  const handleClick = (point) => {
    if (!suppressClick.current && canManage) onEditPoint(point)
  }

  const resetViewport = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const fitRoute = () => {
    if (!routePoints.length) return resetViewport()
    const xs = routePoints.map((point) => point.canvasPosition.x)
    const ys = routePoints.map((point) => (point.canvasPosition.y / 100) * mapHeight)
    const spanX = Math.max(20, Math.max(...xs) - Math.min(...xs) + 14)
    const spanY = Math.max(20, Math.max(...ys) - Math.min(...ys) + 14)
    const nextZoom = Math.min(mapWidth / spanX, mapHeight / spanY, 2.2)
    setZoom(Math.max(1, nextZoom))
    setPan({
      x: ((Math.max(...xs) + Math.min(...xs)) / 2) - (mapWidth / 2),
      y: ((Math.max(...ys) + Math.min(...ys)) / 2) - (mapHeight / 2),
    })
  }

  useEffect(() => {
    if (!drag && !panDrag) return undefined
    const preventTouchScroll = (event) => event.preventDefault()
    window.addEventListener('touchmove', preventTouchScroll, { passive: false })
    return () => window.removeEventListener('touchmove', preventTouchScroll)
  }, [drag, panDrag])

  useEffect(() => {
    const viewport = timelineRef.current
    const activePointElement = activeTimelinePointRef.current
    if (!viewport || !activePointElement || !activePointId) return
    const viewportRect = viewport.getBoundingClientRect()
    const pointRect = activePointElement.getBoundingClientRect()
    const nextScrollLeft = viewport.scrollLeft + pointRect.left - viewportRect.left - (viewport.clientWidth - pointRect.width) / 2
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    viewport.scrollTo({ left: Math.max(0, nextScrollLeft), behavior })
  }, [activePointId])

  return (
    <section aria-label="Interactive Maharashtra route map" className="route-canvas-card">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dusk">Maharashtra route map</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">Shared journey</h3>
          <p className="mt-1 text-xs leading-5 text-dusk">{canManage ? 'Drag pins inside the state. Drag the map to pan; use the directions below to reorder stops.' : 'A shared route plotted on the Maharashtra state outline.'}</p>
        </div>
        <div aria-label="Map controls" className="flex shrink-0 flex-wrap items-center gap-1">
          <button aria-label="Zoom out" className="route-canvas-control" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, Math.round((value - .2) * 10) / 10))} type="button"><ZoomOut aria-hidden="true" className="h-4 w-4" /></button>
          <span className="min-w-10 text-center text-xs tabular-nums text-dusk">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" className="route-canvas-control" disabled={zoom >= 2.2} onClick={() => setZoom((value) => Math.min(2.2, Math.round((value + .2) * 10) / 10))} type="button"><ZoomIn aria-hidden="true" className="h-4 w-4" /></button>
          <button aria-label="Fit route markers" className="route-canvas-control" onClick={fitRoute} type="button"><LocateFixed aria-hidden="true" className="h-4 w-4" /></button>
          <button aria-label="Fit Maharashtra map" className="route-canvas-control" disabled={zoom === 1 && pan.x === 0 && pan.y === 0} onClick={resetViewport} type="button"><Map aria-hidden="true" className="h-4 w-4" /></button>
          <button aria-label="Reset map view" className="route-canvas-control" disabled={zoom === 1 && pan.x === 0 && pan.y === 0} onClick={resetViewport} type="button"><Maximize2 aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>
      <svg
        aria-label={`${routePoints.length} route locations on a Maharashtra state map`}
        className={`route-canvas${canManage ? ' route-canvas--editable' : ''}`}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        role="group"
        viewBox={viewBox}
      >
        <defs>
          <linearGradient id="maharashtraFill" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#dbeafe" /><stop offset="100%" stopColor="#ccfbf1" /></linearGradient>
          <clipPath id="maharashtraBoundaryClip">{polygonPaths.map((path, index) => <path d={path} key={index} />)}</clipPath>
        </defs>
        <rect className="route-canvas-backdrop" height={mapHeight} width={mapWidth} x="0" y="0" />
        <g className="maharashtra-state-map">
          {polygonPaths.map((path, index) => <path className="maharashtra-state-shape" d={path} key={index} />)}
          <path className="maharashtra-state-outline" d={polygonPaths.join(' ')} />
        </g>
        <g clipPath="url(#maharashtraBoundaryClip)">
          <path className="maharashtra-map-grid" d={`M 0 ${mapHeight * .25} H ${mapWidth} M 0 ${mapHeight * .5} H ${mapWidth} M 0 ${mapHeight * .75} H ${mapWidth} M ${mapWidth * .25} 0 V ${mapHeight} M ${mapWidth * .5} 0 V ${mapHeight} M ${mapWidth * .75} 0 V ${mapHeight}`} />
          {routeSegments.map((segment) => <path
            className={`route-canvas-connection route-canvas-connection--${segment.status}`}
            d={segment.d}
            key={`${segment.fromId}-${segment.toId}`}
            vectorEffect="non-scaling-stroke"
          />)}
        </g>
        {displayedPoints.map((point, index) => {
          const { x, y } = getRouteCanvasCoordinates(point.canvasPosition)
          const isNext = point.status === 'upcoming' && !displayedPoints.slice(0, index).some((before) => before.status === 'upcoming')
          const color = statusColor[point.status]
          const number = String(index + 1).padStart(2, '0')
          return <g
            aria-label={`${point.type === 'start' ? 'Origin' : point.type === 'destination' ? 'Destination' : `Stop ${number}`}: ${point.name}, ${statusText[point.status]}`}
            className={`route-canvas-marker${drag?.id === point.id ? ' route-canvas-marker--dragging' : ''}`}
            data-route-point={point.id}
            key={point.id}
            onClick={() => handleClick(point)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleClick(point) } }}
            onPointerDown={(event) => handlePointerDown(event, point)}
            role={canManage ? 'button' : 'img'}
            tabIndex={canManage ? 0 : undefined}
            transform={`translate(${x} ${y})`}
          >
            <circle className="route-canvas-marker-hitarea" r="6.4" />
            {isNext && !drag ? <><circle className="route-canvas-ripple route-canvas-ripple--outer" r="5.6" /><circle className="route-canvas-ripple route-canvas-ripple--inner" r="4.4" /></> : null}
            <circle className="route-canvas-marker-halo" r="3.2" />
            <circle className="route-canvas-marker-core" fill={color} r="2.2" />
            <text className="route-canvas-marker-number" dy=".85" textAnchor="middle">{number}</text>
            <text className="route-canvas-marker-name" dy="5.5" textAnchor="middle">{shortened(point.name)}</text>
            <text className="route-canvas-marker-status" dy="8.3" textAnchor="middle">{statusText[point.status]}</text>
          </g>
        })}
      </svg>
      <section aria-label="Journey progress timeline" className="route-journey">
        <div className="route-journey__summary">
          <span>{stopProgress.completed} of {stopProgress.total} stops completed · {stopProgress.remaining} remaining</span>
          <span className="route-journey__percent">{stopProgress.percent}%</span>
        </div>
        <div aria-label="Journey locations; scroll horizontally to see all locations" className="route-journey__viewport" ref={timelineRef} role="region" tabIndex={0}>
          <ol className="route-journey__track">
            {routePoints.map((point, index) => {
              const isNext = point.status === 'upcoming' && !routePoints.slice(0, index).some((before) => before.status === 'upcoming')
              const isActive = point.id === activePointId
              const TypeIcon = point.type === 'start' ? Play : point.type === 'destination' ? Flag : MapPin
              return <li className="route-journey__item" key={point.id} ref={isActive ? activeTimelinePointRef : null}>
                {index < routePoints.length - 1 ? <span aria-hidden="true" className={`route-journey__connector route-journey__connector--${timelineSegments[index]?.status || 'upcoming'}`} /> : null}
                <button
                  aria-label={`${point.type === 'start' ? 'Starting location' : point.type === 'destination' ? 'Final destination' : `Stop ${index}`}: ${point.name}. ${statusText[point.status]}. ${canManage ? 'Edit details' : 'View details'}`}
                  className={`route-journey__point${isActive ? ' route-journey__point--active' : ''}`}
                  onClick={() => onEditPoint(point)}
                  type="button"
                >
                  <span className={`route-journey__marker route-journey__marker--${point.status}${isNext ? ' route-journey__marker--next' : ''}`}>
                    {isNext ? <><span aria-hidden="true" className="route-journey__ripple route-journey__ripple--outer" /><span aria-hidden="true" className="route-journey__ripple route-journey__ripple--inner" /></> : null}
                    {point.type === 'stop' && point.status === 'completed' ? <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} /> : point.type === 'stop' ? <span>{String(index).padStart(2, '0')}</span> : <TypeIcon aria-hidden="true" className="h-4 w-4" />}
                    {point.type !== 'stop' && point.status === 'completed' ? <span aria-hidden="true" className="route-journey__completion"><Check className="h-2.5 w-2.5" /></span> : null}
                  </span>
                  <span className="route-journey__copy">
                    <span className="route-journey__kind">{point.type === 'start' ? 'Starting location' : point.type === 'destination' ? 'Final destination' : `Stop ${index}`}</span>
                    <span className="route-journey__name">{point.name}</span>
                    <span className={`route-journey__status route-journey__status--${point.status}`}>{statusText[point.status]}{isNext ? ' · Next up' : ''}</span>
                    {point.plannedArrivalDate ? <span className="route-journey__date">Planned · {displayDate(point.plannedArrivalDate)}</span> : null}
                  </span>
                </button>
              </li>
            })}
          </ol>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-dusk">
        <span>{canManage ? 'Pins stay inside the state boundary. Use the directions list to change stop order.' : 'Shared Maharashtra map · locations shown in trip order.'}</span>
        <a className="opacity-75 underline-offset-2 hover:underline" href="https://www.geoboundaries.org/" rel="noreferrer" target="_blank">Boundary: geoBoundaries · DataMeet India · CC BY 2.5 IN</a>
      </div>
    </section>
  )
}
