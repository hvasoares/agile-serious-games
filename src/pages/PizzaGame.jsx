import { useEffect, useRef, useState, useMemo } from 'react'
import GameLayout from '../components/GameLayout.jsx'
import { PizzaScene } from '../scenes/pizzaScene.js'
import { usePizzaSim, getCoachingMessage } from '../hooks/usePizzaSim.js'
import { ROUND_DEFS, TOC_STEPS, STATION_DEFS, findIdlestDonor } from '../sim/pizzaSim.js'
import { getBacklogOrders, getDoingOrders, getDoneOrders } from '../sim/orderSorting.js'
import CfdChart from '../components/CfdChart.jsx'
import LineChart from '../components/LineChart.jsx'
import { computeScore } from '../sim/metrics.js'

const STATION_COLORS = ['#e0a24b', '#d8442a', '#e58aa6', '#caa05a', '#7cb342']

const MAX_VISIBLE = 10

// Thin column-divider with a label
function Divider({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, margin: '0 2px' }}>
      <span style={{ fontSize: 8, color: '#5a4a3a', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ width: 1, height: 30, background: '#3a2e1e' }} />
    </div>
  )
}

// Small chip showing how many cards are hidden
function HiddenHint({ count, label }) {
  if (count <= 0) return null
  return (
    <div style={{
      flexShrink: 0,
      background: 'rgba(25,18,10,0.9)',
      border: '1px dashed #4a3a28',
      borderRadius: 6,
      padding: '5px 8px',
      fontSize: 9,
      color: '#7a6a58',
      fontStyle: 'italic',
      whiteSpace: 'nowrap',
      lineHeight: 1.3,
      textAlign: 'center',
    }}>
      +{count}<br />{label}
    </div>
  )
}

function SliceIndicator({ sliceId, pizzas }) {
  const p = pizzas.find(px => px.i === sliceId)
  if (!p) {
    // Delivered
    return (
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: '#4caf50', border: '1px solid #66bb6a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, color: '#fff', lineHeight: 1,
      }}>✓</div>
    )
  }
  const color = STATION_COLORS[p.stage]
  const isWorking = p.state === 'working'
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      background: isWorking ? color : 'transparent',
      border: `1.5px solid ${color}`,
      opacity: isWorking ? 1 : 0.55,
    }} />
  )
}

function OrderCard({ order, pizzas, forming, animatingOut }) {
  const isDone = animatingOut || order.fulfilled >= order.size
  const anyWorking = !isDone && order.sliceIds.some(id => {
    const p = pizzas.find(px => px.i === id)
    return p && p.state === 'working'
  })
  const anyMoving = !isDone && order.sliceIds.some(id => {
    const p = pizzas.find(px => px.i === id)
    return p && p.stage > 0
  })

  let borderColor = '#3a2e20'
  if (forming) borderColor = '#555'
  else if (isDone) borderColor = '#4caf50'
  else if (anyWorking || anyMoving) borderColor = '#ff8c00'

  let bg = 'rgba(20,14,8,0.82)'
  if (isDone) bg = 'rgba(30,70,30,0.82)'
  else if (anyWorking) bg = 'rgba(50,30,10,0.82)'

  return (
    <div
      className={animatingOut ? 'order-card-done' : ''}
      style={{
        flexShrink: 0,
        background: bg,
        border: `1px solid ${borderColor}`,
        borderStyle: forming ? 'dashed' : 'solid',
        borderRadius: 6,
        padding: '4px 7px',
        minWidth: 52,
      }}
    >
      <div style={{ fontSize: 8, color: isDone ? '#66bb6a' : '#7a6a5a', marginBottom: 4, lineHeight: 1 }}>
        #{order.id + 1}{forming ? ' …' : ''}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {order.sliceIds.map(id => (
          <SliceIndicator key={id} sliceId={id} pizzas={pizzas} />
        ))}
        {/* Ghost slots for forming orders not yet pushed */}
        {forming && Array.from({ length: order.size - order.sliceIds.length }).map((_, i) => (
          <div key={`ghost-${i}`} style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '1.5px dashed #444',
          }} />
        ))}
      </div>
    </div>
  )
}

export default function PizzaGame() {
  const mountRef = useRef(null)
  const [showCharts, setShowCharts] = useState(false)

  // Track orders that are animating out (blink) or fully dismissed
  const [dismissedOrders, setDismissedOrders] = useState(() => new Set())
  const scheduledRef = useRef(new Set())

  const {
    simState,
    round,
    running,
    showCfd,
    sceneRef,
    setRound,
    start,
    pause,
    reset,
    setWipLimit,
    tocNext,
    tocPrev,
    setToc,
    setShowCfd,
    applyTocStep,
    revertToc,
    applyRedeploy,
    revertRedeploy,
  } = usePizzaSim(1)

  const metrics = useMemo(() => {
    const st = simState?.stations ?? []
    const wip = st.reduce((a, s) => a + s.occupants.length, 0)
    const { profit, wipCost, net } = computeScore(simState?.pizzas ?? [], simState?.delivered ?? 0)
    return {
      delivered: simState?.delivered ?? 0,
      wip,
      profit,
      wipCost,
      net,
      avgLeadTime: (simState?.delivered ?? 0) > 0 ? simState.leadSum / simState.delivered : null,
      elapsed: simState?.t ?? 0,
    }
  }, [simState])

  useEffect(() => {
    if (!mountRef.current) return
    const scene = new PizzaScene(mountRef.current)
    sceneRef.current = scene  // registers with the hook's RAF loop
    scene.loadRound(1, simState)  // initialize cap labels with correct values

    const onResize = () => scene.resize?.()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      scene.dispose?.()
    }
  }, [])

  // Detect newly completed orders → blink then remove
  useEffect(() => {
    for (const order of (simState?.orders ?? [])) {
      if (order.fulfilled >= order.size && !scheduledRef.current.has(order.id)) {
        scheduledRef.current.add(order.id)
        setTimeout(() => {
          setDismissedOrders(prev => new Set([...prev, order.id]))
        }, 950)
      }
    }
  }, [simState?.orders])

  // Clear dismissed state when sim resets (orderCounter back to 0)
  useEffect(() => {
    if ((simState?.orderCounter ?? 0) === 0 && (simState?._nextId ?? 0) === 0) {
      setDismissedOrders(new Set())
      scheduledRef.current = new Set()
    }
  }, [simState?.orderCounter, simState?._nextId])

  // ── Order categorisation for overlay (left=backlog, middle=doing, right=done) ──
  const _pizzas = simState?.pizzas ?? []
  const _allOrders = simState?.orders ?? []

  const backlogOrders = getBacklogOrders(_allOrders, _pizzas, simState?.currentOrder ?? null, dismissedOrders)
  const backlogIds = new Set(backlogOrders.map(o => o.id))
  const doingOrders = getDoingOrders(_allOrders, _pizzas, backlogIds, dismissedOrders)
  const doneOrders = getDoneOrders(_allOrders, dismissedOrders)

  const coaching = getCoachingMessage(simState)

  const formatElapsed = (secs) => {
    if (typeof secs !== 'number') return '—'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const stations = simState?.stations ?? []

  const chartHistory = simState?.chartHistory ?? []
  const leadTimeSeries = [{ data: chartHistory.map(p => ({ t: p.t, value: p.avgLeadTime })), color: '#2f8fd6', label: 'Avg Lead Time (s)' }]
  const wipSeries      = [{ data: chartHistory.map(p => ({ t: p.t, value: p.wip })),         color: '#e0a24b', label: 'WIP' }]
  const delivSeries    = [{ data: chartHistory.map(p => ({ t: p.t, value: p.delivered })),    color: '#7cb342', label: 'Delivered' }]
  const scoreSeries    = [
    { data: chartHistory.map(p => ({ t: p.t, value: p.profit  })), color: '#7cb342', label: 'Profit'   },
    { data: chartHistory.map(p => ({ t: p.t, value: p.wipCost })), color: '#d8442a', label: 'WIP Cost' },
    { data: chartHistory.map(p => ({ t: p.t, value: p.score   })), color: '#f4ecdd', label: 'Score'    },
  ]

  const sidebar = (
    <>
      {/* Section 1 – Round Selector */}
      <div className="sidebar-block">
        <h3>Round</h3>
        <div className="speed-row">
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              className={`speed-btn ${round === num ? 'active' : ''}`}
              onClick={() => setRound(num)}
            >
              {num}
            </button>
          ))}
        </div>
        {ROUND_DEFS?.[round - 1] && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            {ROUND_DEFS[round - 1].label ?? ROUND_DEFS[round - 1].name ?? ''}
          </p>
        )}
      </div>

      {/* Section 2 – Controls */}
      <div className="sidebar-block">
        <h3>Controls</h3>
        <div className="control-row">
          <button onClick={start} disabled={running || simState?.finished}>Start</button>
          <button onClick={pause} disabled={!running}>Pause</button>
          <button onClick={reset}>Reset</button>
        </div>
        {(() => {
          const tLimit = simState?.timeLimit ?? 60
          const elapsed = simState?.t ?? 0
          const timeLeft = Math.max(0, tLimit - elapsed)
          const pct = Math.min(100, (elapsed / tLimit) * 100)
          const finished = simState?.finished
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: finished ? '#d8442a' : '#8a8073' }}>
                  {finished ? 'Time\'s up!' : `${Math.ceil(timeLeft)}s remaining`}
                </span>
                <span style={{ fontSize: 10, color: '#5a4a3a' }}>{tLimit}s</span>
              </div>
              <div style={{ height: 4, background: '#2a201a', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: finished ? '#d8442a' : timeLeft < 15 ? '#e0a24b' : '#2f8fd6',
                  borderRadius: 2,
                  transition: 'width 0.2s linear',
                }} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Section 3 – Live Metrics */}
      <div className="sidebar-block">
        <h3>Live Metrics</h3>
        <div className="metrics-2col">
          <div className="metric-box">
            <span className="metric-box-value">{metrics.delivered ?? 0}</span>
            <span className="metric-box-label">Delivered</span>
          </div>
          <div className="metric-box">
            <span className="metric-box-value">{metrics.wip ?? 0}</span>
            <span className="metric-box-label">WIP</span>
          </div>
          <div className="metric-box">
            <span className="metric-box-value">
              {typeof metrics.avgLeadTime === 'number'
                ? `${metrics.avgLeadTime.toFixed(1)}s`
                : metrics.avgLeadTime ?? '—'}
            </span>
            <span className="metric-box-label">Avg Lead Time</span>
          </div>
          <div className="metric-box">
            <span className="metric-box-value">{formatElapsed(metrics.elapsed)}</span>
            <span className="metric-box-label">Elapsed</span>
          </div>
          <div className="metric-box">
            <span className="metric-box-value" style={{ color: '#7cb342' }}>+{metrics.profit ?? 0}</span>
            <span className="metric-box-label">Profit</span>
          </div>
          <div className="metric-box">
            <span className="metric-box-value" style={{ color: '#d8442a' }}>-{metrics.wipCost ?? 0}</span>
            <span className="metric-box-label">WIP Cost</span>
          </div>
          <div className="metric-box">
            <span
              className="metric-box-value"
              style={{ color: (metrics.net ?? 0) >= 0 ? '#7cb342' : '#d8442a' }}
            >
              {(metrics.net ?? 0) >= 0 ? '+' : ''}{metrics.net ?? 0}
            </span>
            <span className="metric-box-label">Score</span>
          </div>
        </div>
      </div>

      {/* Section 4 – Station Status */}
      {stations.length > 0 && (
        <div className="sidebar-block">
          <h3>Station Status</h3>
          {stations.map((station, i) => {
            const key = station.key ?? STATION_DEFS?.[i]?.key ?? `station${i}`
            const name = key.charAt(0).toUpperCase() + key.slice(1)
            const bufferCount = station.bufferLen ?? (Array.isArray(station.buffer) ? station.buffer.length : 0)
            const bufferCap = station.cap ?? 99
            const occupantCount = station.occupantLen ?? (Array.isArray(station.occupants) ? station.occupants.length : 0)
            const slots = station.slots ?? 1
            const atCap = bufferCap < 99 && bufferCount >= bufferCap
            const isConstraint = round === 3 && simState?.constraint === i
            const utilPct = round === 3 && simState?.tocStep >= 1 && station.totalTime > 0
              ? Math.round((station.busyTime ?? 0) / station.totalTime * 100)
              : null
            return (
              <div key={name} className="col-stat-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{name}</span>
                  {isConstraint && (
                    <span style={{ fontSize: 9, color: '#e0a24b', fontWeight: 700 }}>◆ CONSTRAINT</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>
                    Buffer:{' '}
                    <span className={`wip-count ${atCap ? 'over' : 'ok'}`}>{bufferCount}</span>
                    {typeof bufferCap === 'number' && (
                      <span className="wip-limit-tag"> / {bufferCap}</span>
                    )}
                  </span>
                  <span>Working: {occupantCount}/{slots}</span>
                  {utilPct !== null && (
                    <span style={{ color: utilPct >= 90 ? '#7cb342' : utilPct >= 60 ? '#e0a24b' : '#d8442a' }}>
                      {utilPct}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Section 5 – WIP Limit Sliders (pull mode only) */}
      {simState?.mode === 'pull' && (
        <div className="sidebar-block">
          <h3>WIP Limits</h3>
          {(simState?.stations ?? []).map((station, i) => {
            const name = station.name ?? STATION_DEFS?.[i]?.name ?? `Station ${i + 1}`
            const cap = station.cap ?? 3
            const fixed = station.fixedCap ?? false
            return (
              <div key={i} className="control-row" style={{ flexDirection: 'column', gap: 4 }}>
                <div className="control-label-row">
                  <span style={{ fontSize: 12 }}>{name}</span>
                  <span className="control-val">{cap}</span>
                </div>
                {fixed ? (
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={cap}
                    disabled
                    title="Oven capacity fixed"
                    style={{ opacity: 0.4, cursor: 'not-allowed' }}
                  />
                ) : (
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={cap}
                    onChange={(e) => setWipLimit(i, parseInt(e.target.value))}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Section 7 – ToC Panel (round 3 only) */}
      {round === 3 && (
        <div className="sidebar-block">
          <h3>Theory of Constraints</h3>
          <button
            className={`speed-btn ${simState?.toc ? 'active' : ''}`}
            onClick={() => setToc(!simState?.toc)}
            style={{ width: '100%', marginBottom: 8 }}
          >
            {simState?.toc ? 'Guided Mode ON' : 'Guided Mode'}
          </button>

          {simState?.toc && (() => {
            const toc = simState
            const constraintKey = toc.constraint >= 0 ? STATION_DEFS[toc.constraint]?.key : null
            const spawnSec = (toc.spawnInterval ?? 0.4).toFixed(1)

            return (
              <div>
                {/* Demand + constraint summary */}
                <div style={{ fontSize: 10, color: '#8a8073', marginBottom: 10, lineHeight: 1.7 }}>
                  {constraintKey
                    ? <>Constraint: <strong style={{ color: '#e0a24b' }}>{constraintKey}</strong> · demand every {spawnSec}s</>
                    : 'Start sim and identify the constraint.'}
                </div>

                {/* Per-step rows */}
                {TOC_STEPS.map((s, i) => {
                  const reached = toc.tocStep >= i
                  let actionBtn = null

                  if (i === 0) {
                    actionBtn = (
                      <button onClick={() => applyTocStep(0)} style={{ fontSize: 10, padding: '2px 8px' }}>
                        {constraintKey ? '↺ Re-identify' : 'Find'}
                      </button>
                    )
                  } else if (i === 1) {
                    // Exploit: purely metric visibility, active once Identify done
                    actionBtn = reached
                      ? <span style={{ fontSize: 9, color: '#2f8fd6' }}>Monitoring</span>
                      : null
                  } else if (i === 2) {
                    actionBtn = toc.subordinate
                      ? <button onClick={() => revertToc(2)} className="speed-btn active" style={{ fontSize: 10, padding: '2px 8px' }}>✓ Revert</button>
                      : <button onClick={() => applyTocStep(2)} disabled={!constraintKey} style={{ fontSize: 10, padding: '2px 8px' }}>Apply</button>
                  } else if (i === 3) {
                    const donorIdx = constraintKey ? findIdlestDonor(toc) : -1
                    const donorKey = donorIdx >= 0 ? STATION_DEFS[donorIdx]?.key : null
                    actionBtn = (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: '#8a8073' }}>+1 oven slot</span>
                          {toc.elevated
                            ? <button onClick={() => revertToc(3)} className="speed-btn active" style={{ fontSize: 10, padding: '2px 8px' }}>✓ Revert</button>
                            : <button onClick={() => applyTocStep(3)} disabled={!constraintKey} style={{ fontSize: 10, padding: '2px 8px' }}>Apply</button>
                          }
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: '#8a8073' }}>
                            {toc.redeployed
                              ? `${STATION_DEFS[toc.elevatedFrom]?.key ?? '?'} → ${constraintKey}`
                              : donorKey ? `move ${donorKey}` : 'move cooker'}
                          </span>
                          {toc.redeployed
                            ? <button onClick={() => revertRedeploy()} className="speed-btn active" style={{ fontSize: 10, padding: '2px 8px' }}>✓ Revert</button>
                            : <button onClick={() => applyRedeploy()} disabled={!constraintKey} style={{ fontSize: 10, padding: '2px 8px' }}>Apply</button>
                          }
                        </div>
                      </div>
                    )
                  } else if (i === 4) {
                    actionBtn = (
                      <button onClick={() => applyTocStep(4)} disabled={!constraintKey} style={{ fontSize: 10, padding: '2px 8px' }}>Repeat</button>
                    )
                  }

                  return (
                    <div key={i} style={{
                      marginBottom: 8,
                      opacity: reached || constraintKey ? 1 : 0.45,
                      borderLeft: `2px solid ${reached ? '#e0a24b' : '#2a201a'}`,
                      paddingLeft: 8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                        <div style={{ flex: 1 }}>
                          <span className="game-tag" style={{ fontSize: 9 }}>{s.tag}</span>
                          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{s.title}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{s.body}</div>
                        </div>
                        {actionBtn && <div style={{ flexShrink: 0, marginTop: 2 }}>{actionBtn}</div>}
                      </div>
                    </div>
                  )
                })}

                {/* Constraint history trail */}
                {(toc.constraintHistory ?? []).length > 0 && (
                  <div style={{ fontSize: 9, color: '#5a4a3a', marginTop: 6, lineHeight: 1.6 }}>
                    History: {toc.constraintHistory.map(h => h.stationKey).join(' → ')}
                    {constraintKey ? ` → ${constraintKey}` : ''}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Section 8 – Chart Toggles */}
      <div className="sidebar-block">
        <button
          className={`speed-btn ${showCfd ? 'active' : ''}`}
          style={{ width: '100%', marginBottom: 6 }}
          onClick={() => setShowCfd(!showCfd)}
        >
          {showCfd ? 'Hide CFD' : 'Show CFD'}
        </button>
        <button
          className={`speed-btn ${showCharts ? 'active' : ''}`}
          style={{ width: '100%' }}
          onClick={() => setShowCharts(v => !v)}
        >
          {showCharts ? 'Hide Charts' : 'Show Charts'}
        </button>
      </div>

      {/* Section 9 – Coaching Panel */}
      <div className={`sidebar-block info-box ${coaching.level ?? 'info'}`}>
        <strong>💡 Coaching</strong>
        <p style={{ marginTop: 4, fontSize: 12 }}>{coaching.text}</p>
      </div>
    </>
  )

  return (
    <GameLayout
      title="Kanban Pizzeria"
      subtitle="Push, pull, and constraints — learn Kanban through pizza delivery"
      sidebar={sidebar}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* 3D canvas */}
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {/* Order Cards Overlay — kanban flow: backlog | doing | done */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          overflowX: 'auto',
          overflowY: 'hidden',
          pointerEvents: 'none',
          zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(10,6,2,0.9) 60%, transparent 100%)',
          scrollbarWidth: 'none',
          minHeight: 56,
        }}>

          {/* ── BACKLOG (untouched) ── */}
          <span style={{ fontSize: 8, color: '#5a4a3a', fontWeight: 700, letterSpacing: '0.07em', flexShrink: 0, textTransform: 'uppercase' }}>
            Backlog
          </span>
          {/* Forming card: show in backlog only if all its existing slices are untouched (Cut queue) */}
          {simState?.currentOrder && simState.currentOrder.sliceIds.every(id => {
            const p = _pizzas.find(px => px.i === id); return p && p.stage === 0 && p.state === 'queue'
          }) && (
            <OrderCard order={simState.currentOrder} pizzas={_pizzas} forming />
          )}
          {/* Oldest MAX_VISIBLE backlog orders (FIFO priority) */}
          {backlogOrders.slice(0, MAX_VISIBLE).map(o => (
            <OrderCard key={o.id} order={o} pizzas={_pizzas} />
          ))}
          {/* Overflow hint — newer arrivals hidden behind */}
          <HiddenHint count={backlogOrders.length - MAX_VISIBLE} label="waiting" />
          {!simState?.currentOrder && backlogOrders.length === 0 && (
            <span style={{ fontSize: 10, color: '#3a2e1e', fontStyle: 'italic', flexShrink: 0 }}>—</span>
          )}

          <Divider label="Doing →" />

          {/* ── DOING (in-progress, least→most progressed left→right) ── */}
          {/* Forming card goes here if any of its slices have moved past Cut */}
          {simState?.currentOrder && simState.currentOrder.sliceIds.some(id => {
            const p = _pizzas.find(px => px.i === id); return !p || p.stage > 0 || p.state === 'working'
          }) && (
            <OrderCard order={simState.currentOrder} pizzas={_pizzas} forming />
          )}
          {/* Less-progressed overflow shown as hint on left so the most critical stay visible */}
          {(() => {
            const visible = doingOrders.slice(0, MAX_VISIBLE).reverse()
            const hiddenCount = doingOrders.length - MAX_VISIBLE
            return (
              <>
                <HiddenHint count={hiddenCount} label="less done" />
                {visible.map(o => <OrderCard key={o.id} order={o} pizzas={_pizzas} />)}
                {doingOrders.length === 0 && !simState?.currentOrder?.sliceIds.some(id => {
                  const p = _pizzas.find(px => px.i === id); return !p || p.stage > 0
                }) && (
                  <span style={{ fontSize: 10, color: '#3a2e1e', fontStyle: 'italic', flexShrink: 0 }}>—</span>
                )}
              </>
            )
          })()}

          <Divider label="Done →" />

          {/* ── DONE (blinking out, rightmost) ── */}
          {doneOrders.map(o => (
            <OrderCard key={o.id} order={o} pizzas={_pizzas} animatingOut />
          ))}
          {doneOrders.length === 0 && !simState?.currentOrder && _allOrders.length === 0 && (
            <span style={{ fontSize: 10, color: '#3a2e1e', fontStyle: 'italic', flexShrink: 0 }}>
              Press Start
            </span>
          )}

        </div>

        {/* Bottom overlays — CFD and/or line charts, stacked in a flex column */}
        {(showCfd || showCharts) && (
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(20,17,13,0.88)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {showCharts && (
              <div style={{ display: 'flex' }}>
                {[
                  [leadTimeSeries, 'Avg Lead Time'],
                  [wipSeries,      'WIP'],
                  [delivSeries,    'Delivered'],
                  [scoreSeries,    'Profit / WIP Cost / Score'],
                ].map(([s, t]) => (
                  <div key={t} style={{ flex: 1, minWidth: 0, borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                    <LineChart series={s} title={t} height={160} />
                  </div>
                ))}
              </div>
            )}
            {showCfd && <CfdChart cfd={simState?.cfd ?? []} />}
          </div>
        )}
      </div>
    </GameLayout>
  )
}
