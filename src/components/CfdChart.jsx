import { useRef, useEffect, useCallback } from 'react'

const HEIGHT = 200

const BANDS = [
  { label: 'Done',    color: '#2f8fd6' },
  { label: 'Deliver', color: '#7cb342' },
  { label: 'Oven',    color: '#caa05a' },
  { label: 'Top',     color: '#e58aa6' },
  { label: 'Sauce',   color: '#d8442a' },
  { label: 'Cut',     color: '#e0a24b' },
]

function bandTops(d) {
  const done = d.done
  const seq = [
    done,
    Math.max(0, d.reached[4] - done),
    Math.max(0, d.reached[3] - d.reached[4]),
    Math.max(0, d.reached[2] - d.reached[3]),
    Math.max(0, d.reached[1] - d.reached[2]),
    Math.max(0, d.reached[0] - d.reached[1]),
  ]
  let acc = 0
  return seq.map(v => { acc += v; return acc })
}

function paint(canvas, cfd) {
  const dpr = Math.min(window.devicePixelRatio, 2)
  const W = canvas.clientWidth || 600
  const H = HEIGHT

  canvas.width = W * dpr
  canvas.height = H * dpr

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#14110d'
  ctx.fillRect(0, 0, W, H)

  if (cfd.length < 2) return

  const padL = 38, padR = 52, padT = 12, padB = 22
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const tMin = cfd[0].t
  const tMax = Math.max(cfd[cfd.length - 1].t, tMin + 1)
  let yMax = 4
  cfd.forEach(d => { if (d.reached[0] > yMax) yMax = d.reached[0] })
  yMax = Math.ceil(yMax / 5) * 5 || 5

  const X = t => padL + (t - tMin) / (tMax - tMin) * plotW
  const Y = v => padT + plotH - v / yMax * plotH

  // Grid lines
  ctx.strokeStyle = 'rgba(244,236,221,0.08)'
  ctx.lineWidth = 1
  ctx.fillStyle = '#8a8073'
  ctx.font = '10px -apple-system,sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const yStep = Math.max(5, Math.round(yMax / 5 / 5) * 5) || 5
  for (let v = 0; v <= yMax; v += yStep) {
    const y = Y(v)
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
    ctx.fillText(v, padL - 6, y)
  }

  // X-axis labels
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let k = 0; k <= 5; k++) {
    const tt = tMin + (tMax - tMin) * k / 5
    ctx.fillText(Math.round(tt) + 's', X(tt), H - padB + 5)
  }

  // Stacked bands
  for (let b = BANDS.length - 1; b >= 0; b--) {
    ctx.beginPath()
    cfd.forEach((d, idx) => {
      const c = bandTops(d)
      idx === 0 ? ctx.moveTo(X(d.t), Y(c[b])) : ctx.lineTo(X(d.t), Y(c[b]))
    })
    for (let idx = cfd.length - 1; idx >= 0; idx--) {
      const d = cfd[idx]
      const c = bandTops(d)
      ctx.lineTo(X(d.t), Y(b === 0 ? 0 : c[b - 1]))
    }
    ctx.closePath()
    ctx.fillStyle = BANDS[b].color
    ctx.fill()
  }

  // Band labels — drawn at the right edge, vertically centred on each band at the last tick
  const lastCfd = cfd[cfd.length - 1]
  const lastTops = bandTops(lastCfd)
  ctx.font = '9px -apple-system,sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let b = 0; b < BANDS.length; b++) {
    const topY = Y(lastTops[b])
    const botY = Y(b === 0 ? 0 : lastTops[b - 1])
    const bandH = botY - topY
    if (bandH < 9) continue
    const midY = (topY + botY) / 2
    const lx = W - padR + 4
    ctx.fillStyle = BANDS[b].color
    ctx.fillRect(lx, midY - 4, 7, 7)
    ctx.fillStyle = 'rgba(244,236,221,0.82)'
    ctx.fillText(BANDS[b].label, lx + 10, midY)
  }

  // Title
  ctx.fillStyle = '#8a8073'
  ctx.font = '10px -apple-system,sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('CFD — band thickness = WIP · horizontal gap = lead time', padL + 4, padT)
}

/**
 * Cumulative Flow Diagram rendered on a canvas.
 * @param {{ cfd: Array, height?: number }} props
 *   cfd — array of { t, reached: number[5], done: number } samples from pizzaSim
 */
export default function CfdChart({ cfd, height = HEIGHT }) {
  const canvasRef = useRef(null)

  const redraw = useCallback(() => {
    if (canvasRef.current) paint(canvasRef.current, cfd)
  }, [cfd])

  useEffect(() => {
    redraw()
    const ro = new ResizeObserver(redraw)
    ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [redraw])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height }}
    />
  )
}
