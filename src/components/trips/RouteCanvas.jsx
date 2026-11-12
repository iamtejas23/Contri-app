import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { buildRouteCanvasPath, getRouteCanvasCoordinates, getTripRouteCanvasPoints } from '../../lib/tripRoute.js'

const statusColor = { completed: '#34d399', in_progress: '#60a5fa', upcoming: '#fb7185' }
const statusText = { completed: 'Completed', in_progress: 'In progress', upcoming: 'Upcoming' }
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const shortened = (value) => value.length > 17 ? `${value.slice(0, 16)}…` : value

export const RouteCanvas = ({ route, canManage, onEditPoint, onPositionChange }) => {
  const svgRef = useRef(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [viewport, setViewport] = useState({ width: 640, height: 300 })
  const routePoints = useMemo(() => getTripRouteCanvasPoints(route), [route])
  const aspect = viewport.width / viewport.height
  const viewWidth = Math.max(100, aspect * 100)
  const viewBox = `${viewWidth / 2 - viewWidth / (2 * zoom)} ${50 - 50 / zoom} ${viewWidth / zoom} ${100 / zoom}`
  const displayedPoints = routePoints.map((point) => drag?.id === point.id ? { ...point, canvasPosition: drag.position } : point)
  const routePath = buildRouteCanvasPath(displayedPoints, viewWidth)

  useEffect(() => {
    if (!svgRef.current || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width || 640, height: entry.contentRect.height || 300 })
    })
    observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [])

  const positionFromPointer = (event) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return null
    const coords = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    }
    const [, , visibleWidth, visibleHeight] = viewBox.split(' ').map(Number)
    const viewStartX = viewWidth / 2 - visibleWidth / 2
    const viewStartY = 50 - visibleHeight / 2
    const svgX = viewStartX + coords.x * visibleWidth
    const svgY = viewStartY + coords.y * visibleHeight
    return {
      x: clamp(((svgX - 8) / (viewWidth - 16)) * 100, 0, 100),
      y: clamp(((svgY - 18) / 64) * 100, 0, 100),
    }
  }

  const handlePointerDown = (event, point) => {
    if (!canManage || !svgRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const initial = positionFromPointer(event) || point.canvasPosition
    svgRef.current.setPointerCapture?.(event.pointerId)
    setDrag({ id: point.id, pointerId: event.pointerId, position: point.canvasPosition, start: initial, moved: false })
  }

  const handlePointerMove = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    const position = positionFromPointer(event)
    if (!position) return
    const moved = drag.moved || Math.hypot(position.x - drag.start.x, position.y - drag.start.y) > 2
    setDrag((current) => current?.pointerId === event.pointerId ? { ...current, position, moved } : current)
  }

  const handlePointerUp = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    const position = positionFromPointer(event) || drag.position
    const shouldSave = drag.moved
    const pointId = drag.id
    setDrag(null)
    if (!shouldSave) return
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
    onPositionChange(pointId, position)
  }

  const handlePointerCancel = (event) => {
    if (drag?.pointerId === event.pointerId) setDrag(null)
  }

  const handleClick = (point) => {
    if (suppressClick.current) return
    if (canManage) onEditPoint(point)
  }

  return (
    <section aria-label="Interactive route canvas" className="route-canvas-card">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dusk">Route canvas</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">Shared journey</h3>
          <p className="mt-1 text-xs leading-5 text-dusk">{canManage ? 'Drag any marker to reposition it; stops reorder from left to right.' : 'A shared schematic of the trip locations.'}</p>
        </div>
        <div aria-label="Canvas zoom controls" className="flex shrink-0 items-center gap-1">
          <button aria-label="Zoom out" className="route-canvas-control" disabled={zoom <= 0.8} onClick={() => setZoom((value) => Math.max(.8, Math.round((value - .2) * 10) / 10))} type="button"><ZoomOut aria-hidden="true" className="h-4 w-4" /></button>
          <span className="min-w-10 text-center text-xs tabular-nums text-dusk">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" className="route-canvas-control" disabled={zoom >= 1.8} onClick={() => setZoom((value) => Math.min(1.8, Math.round((value + .2) * 10) / 10))} type="button"><ZoomIn aria-hidden="true" className="h-4 w-4" /></button>
          <button aria-label="Fit route" className="route-canvas-control" disabled={zoom === 1} onClick={() => setZoom(1)} type="button"><Maximize2 aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>
      <svg
        aria-label={`${routePoints.length} trip locations connected by a schematic route`}
        className={`route-canvas${canManage ? ' route-canvas--editable' : ''}`}
        onPointerCancel={handlePointerCancel}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        preserveAspectRatio="none"
        ref={svgRef}
        role="group"
        viewBox={viewBox}
      >
        <defs>
          <linearGradient id="routeCanvasSurface" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#0c1630" /><stop offset="52%" stopColor="#111c33" /><stop offset="100%" stopColor="#102820" /></linearGradient>
          <pattern height="8" id="routeCanvasGrid" patternUnits="userSpaceOnUse" width="8"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(148,163,184,.11)" strokeWidth=".22" /></pattern>
          <linearGradient id="routeCanvasRoad" x1="0" x2="1"><stop offset="0%" stopColor="#60a5fa" /><stop offset="50%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
        </defs>
        <rect className="route-canvas-surface" height="100" rx="4" width={viewWidth} />
        <rect fill="url(#routeCanvasGrid)" height="100" rx="4" width={viewWidth} />
        <path className="route-canvas-landmark" d={`M 0 72 C ${viewWidth * .15} 55, ${viewWidth * .2} 88, ${viewWidth * .35} 76 S ${viewWidth * .58} 55, ${viewWidth * .73} 73 S ${viewWidth * .9} 88, ${viewWidth} 66`} />
        <path className="route-canvas-road-shadow" d={routePath} />
        <path className="route-canvas-road" d={routePath} />
        <path className="route-canvas-road-center" d={routePath} />
        {displayedPoints.map((point, index) => {
          const { x, y } = getRouteCanvasCoordinates(point.canvasPosition, viewWidth)
          const isEndpoint = point.type !== 'stop'
          const isNext = point.status === 'upcoming' && !displayedPoints.slice(0, index).some((before) => before.status === 'upcoming')
          const color = point.type === 'start' ? '#34d399' : point.type === 'destination' ? '#fbbf24' : statusColor[point.status]
          return <g
            aria-label={`${point.type === 'start' ? 'Origin' : point.type === 'destination' ? 'Destination' : `Stop ${displayedPoints.slice(1, index).filter((item) => item.type === 'stop').length + 1}`}: ${point.name}, ${statusText[point.status]}`}
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
            {isNext && !drag ? <><circle className="route-canvas-ripple route-canvas-ripple--outer" r="7.2" /><circle className="route-canvas-ripple route-canvas-ripple--inner" r="5.6" /></> : null}
            <circle className="route-canvas-marker-halo" r="5.1" />
            <circle className="route-canvas-marker-core" fill={color} r="3.55" />
            <text className="route-canvas-marker-number" dy="1.15" textAnchor="middle">{point.type === 'start' ? 'S' : point.type === 'destination' ? 'F' : String(displayedPoints.slice(1, index + 1).filter((item) => item.type === 'stop').length).padStart(2, '0')}</text>
            <text className="route-canvas-marker-name" dy="9.5" textAnchor="middle">{shortened(point.name)}</text>
            <text className="route-canvas-marker-status" dy="14" textAnchor="middle">{statusText[point.status]}</text>
            {isEndpoint ? <circle className="route-canvas-endpoint-ring" r="4.3" /> : null}
          </g>
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-dusk">
        <span>{canManage ? 'Tap a marker to edit it. Drag to reposition and reorder stops.' : 'Route position is a shared schematic, not a geographic map.'}</span>
        <span>Origin → {route.stops?.length || 0} {route.stops?.length === 1 ? 'stop' : 'stops'} → destination</span>
      </div>
    </section>
  )
}
