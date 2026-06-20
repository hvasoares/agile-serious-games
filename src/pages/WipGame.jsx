import { useEffect, useRef, useState } from 'react'
import GameLayout from '../components/GameLayout.jsx'
import { WipScene } from '../scenes/wipScene'

const COL_COLORS = ['#475569', '#6366f1', '#f59e0b', '#10b981']
const COL_NAMES = ['Backlog', 'In Progress', 'Review', 'Done']
const DEFAULT_LIMITS = [99, 3, 2, 99]

export default function WipGame() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)

  const [limits, setLimits] = useState([...DEFAULT_LIMITS])
  const [speed, setSpeed] = useState(1)
  const [metrics, setMetrics] = useState({ wip: 0, completed: 0, avgCycle: '—', colCounts: [0,0,0,0] })

  useEffect(() => {
    if (!mountRef.current) return
    const s = new WipScene(mountRef.current, { onUpdate: setMetrics })
    sceneRef.current = s

    const onResize = () => s.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      s.dispose()
    }
  }, [])

  const setLimit = (colIdx, val) => {
    const next = [...limits]
    next[colIdx] = val
    setLimits(next)
    sceneRef.current?.setWipLimits(next)
  }

  const setSimSpeed = (s) => {
    setSpeed(s)
    sceneRef.current?.setSpeed(s)
  }

  const sidebar = (
    <>
      <div className="sidebar-block">
        <h3>Live Metrics</h3>
        <div className="metrics-2col">
          <div className="metric-box">
            <span className="metric-box-value">{metrics.wip}</span>
            <span className="metric-box-label">WIP Count</span>
          </div>
          <div className="metric-box">
            <span className="metric-box-value">{metrics.completed}</span>
            <span className="metric-box-label">Completed</span>
          </div>
          <div className="metric-box" style={{ gridColumn: 'span 2' }}>
            <span className="metric-box-value">{metrics.avgCycle}s</span>
            <span className="metric-box-label">Avg Cycle Time</span>
          </div>
        </div>
      </div>

      <div className="sidebar-block">
        <h3>WIP Limits</h3>
        {[1, 2].map((colIdx) => {
          const lim = limits[colIdx]
          const display = lim >= 99 ? '∞' : lim
          return (
            <div key={colIdx} className="control-row">
              <div className="control-label-row">
                <span style={{ color: COL_COLORS[colIdx] }}>{COL_NAMES[colIdx]}</span>
                <span className="control-val">{display}</span>
              </div>
              <input
                type="range" min={1} max={8} value={lim >= 99 ? 8 : lim}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  setLimit(colIdx, v >= 8 ? 99 : v)
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="sidebar-block">
        <h3>Simulation Speed</h3>
        <div className="speed-row">
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              className={`speed-btn ${speed === s ? 'active' : ''}`}
              onClick={() => setSimSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-block">
        <h3>Column Status</h3>
        {COL_NAMES.map((name, i) => {
          const cnt = metrics.colCounts?.[i] ?? 0
          const lim = limits[i]
          const over = lim < 99 && cnt > lim
          const atLim = lim < 99 && cnt === lim
          return (
            <div key={name} className="col-stat-row">
              <span>
                <span className="col-dot" style={{ background: COL_COLORS[i] }} />
                {name}
              </span>
              <span>
                <span className={`wip-count ${over ? 'over' : atLim ? 'warn' : 'ok'}`}>{cnt}</span>
                {lim < 99 && <span className="wip-limit-tag"> / {lim}</span>}
              </span>
            </div>
          )
        })}
      </div>

      <div className="sidebar-block">
        <div className="info-box">
          <strong>💡 Key Insight</strong>
          Try setting In Progress WIP to 2. Watch how cards stop piling up and
          cycle time drops — this is Little's Law: CT = WIP ÷ Throughput.
        </div>
      </div>
    </>
  )

  return (
    <GameLayout
      title="The Flow Lab"
      subtitle="Adjust WIP limits and observe the effect on cycle time and throughput"
      sidebar={sidebar}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </GameLayout>
  )
}
