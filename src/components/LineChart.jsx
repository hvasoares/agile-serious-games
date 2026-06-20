import { useRef, useEffect, useCallback } from 'react'

const DEFAULT_HEIGHT = 160

function niceStep(raw) {
  if (!raw || !isFinite(raw)) return 1
  const m = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / m
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * m
}

function paint(canvas, series, title) {
  const dpr = Math.min(window.devicePixelRatio, 2)
  const W = canvas.clientWidth || 600
  const H = canvas.clientHeight || DEFAULT_HEIGHT

  canvas.width = W * dpr
  canvas.height = H * dpr

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#14110d'
  ctx.fillRect(0, 0, W, H)

  // Title
  ctx.fillStyle = '#8a8073'
  ctx.font = '10px -apple-system,sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(title, 4, 14)

  const allData = series.flatMap(s => s.data)
  if (allData.length < 2) return

  const padL = 42, padR = 72, padT = 18, padB = 22
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  // x-range
  let tMin = Infinity, tMax = -Infinity
  for (const { t } of allData) {
    if (t < tMin) tMin = t
    if (t > tMax) tMax = t
  }
  tMax = Math.max(tMax, tMin + 1)

  // y-range
  let yMin = Infinity, yMax = -Infinity
  for (const { value } of allData) {
    if (value < yMin) yMin = value
    if (value > yMax) yMax = value
  }
  const pad = (yMax - yMin) * 0.10 || 1
  yMin -= pad
  yMax += pad
  if (yMin > 0) yMin = 0
  if (yMax < 0) yMax = 0

  const X = t => padL + (t - tMin) / (tMax - tMin) * plotW
  const Y = v => padT + plotH - (v - yMin) / (yMax - yMin) * plotH

  // Grid — horizontal
  ctx.font = '10px -apple-system,sans-serif'
  ctx.fillStyle = '#8a8073'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const yRange = yMax - yMin
  const yStep = niceStep(yRange / 5)
  const yStart = Math.floor(yMin / yStep) * yStep

  for (let v = yStart; v <= yMax + yStep * 0.01; v += yStep) {
    if (v < yMin - yStep * 0.01) continue
    const y = Y(v)
    const isZero = Math.abs(v) < yStep * 0.01
    ctx.strokeStyle = isZero
      ? 'rgba(244,236,221,0.35)'
      : 'rgba(244,236,221,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
    ctx.fillText(Math.round(v * 10) / 10, padL - 4, y)
  }

  // Grid — vertical
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let k = 0; k <= 5; k++) {
    const tt = tMin + (tMax - tMin) * k / 5
    ctx.fillText(Math.round(tt) + 's', X(tt), H - padB + 4)
  }

  // Series lines
  for (const s of series) {
    if (s.data.length < 2) continue
    ctx.beginPath()
    s.data.forEach(({ t, value }, i) => {
      i === 0 ? ctx.moveTo(X(t), Y(value)) : ctx.lineTo(X(t), Y(value))
    })
    ctx.strokeStyle = s.color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // Legend — fixed vertical stack in right padding
  ctx.font = '9px -apple-system,sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const lx = W - padR + 6
  series.forEach((s, i) => {
    const ly = padT + 4 + i * 14
    ctx.fillStyle = s.color
    ctx.fillRect(lx, ly - 3, 7, 7)
    ctx.fillStyle = 'rgba(244,236,221,0.75)'
    ctx.fillText(s.label, lx + 10, ly)
  })
}

/**
 * Generic canvas line chart. Reusable across games.
 *
 * @param {{
 *   series: Array<{ data: Array<{t: number, value: number}>, color: string, label: string }>,
 *   title: string,
 *   height?: number
 * }} props
 */
export default function LineChart({ series, title, height = DEFAULT_HEIGHT }) {
  const canvasRef = useRef(null)

  const redraw = useCallback(() => {
    if (canvasRef.current) paint(canvasRef.current, series, title)
  }, [series, title])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    redraw()
    const ro = new ResizeObserver(redraw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [redraw])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height }}
    />
  )
}
