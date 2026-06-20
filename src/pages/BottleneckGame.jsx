import { useEffect, useRef, useState } from 'react'
import GameLayout from '../components/GameLayout.jsx'
import { BottleneckScene } from '../scenes/bottleneckScene'

const STATIONS = [
  { name: 'Design',   color: '#6366f1' },
  { name: 'Dev',      color: '#22d3ee' },
  { name: 'QA Test',  color: '#ef4444' },
  { name: 'Review',   color: '#f59e0b' },
  { name: 'Deploy',   color: '#10b981' },
]
const UPGRADE_COST = 25

export default function BottleneckGame() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)

  const [budget, setBudget] = useState(75)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null)
  const [metrics, setMetrics] = useState({
    queues: [0,0,0,0,0],
    busy: [false,false,false,false,false],
    throughput: 0,
    completed: 0,
    upgradeLevels: [0,0,0,0,0],
    effectiveTimes: [2,4,9,3,1.5],
  })

  useEffect(() => {
    if (!mountRef.current) return
    const s = new BottleneckScene(mountRef.current, { onUpdate: setMetrics })
    sceneRef.current = s

    const onResize = () => s.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      s.dispose()
    }
  }, [])

  const doUpgrade = (idx) => {
    if (budget < UPGRADE_COST) return
    if (metrics.upgradeLevels[idx] >= 2) return
    setBudget(b => b - UPGRADE_COST)
    sceneRef.current?.upgrade(idx)
  }

  const setSimSpeed = (s) => {
    setSpeed(s)
    sceneRef.current?.setSpeed(s)
  }

  const isBottleneck = (idx) => {
    const maxQ = Math.max(...metrics.queues)
    return metrics.queues[idx] === maxQ && maxQ > 2
  }

  const sidebar = (
    <>
      <div className="sidebar-block">
        <h3>Performance</h3>
        <div className="metrics-2col">
          <div className="metric-box">
            <span className="metric-box-value">{metrics.throughput}</span>
            <span className="metric-box-label">Cards / 10s</span>
          </div>
          <div className="metric-box">
            <span className="metric-box-value">{metrics.completed}</span>
            <span className="metric-box-label">Total Done</span>
          </div>
        </div>
      </div>

      <div className="sidebar-block">
        <h3>Budget</h3>
        <div className="budget-box">
          <span className="budget-amount">${budget}</span>
          <div className="budget-label">Available · ${UPGRADE_COST} per upgrade</div>
        </div>
      </div>

      <div className="sidebar-block">
        <h3>Pipeline Stations</h3>
        <div className="station-list">
          {STATIONS.map((st, i) => {
            const qLen = metrics.queues[i] ?? 0
            const lvl = metrics.upgradeLevels[i] ?? 0
            const time = metrics.effectiveTimes[i] ?? 0
            const fillPct = Math.min(100, (qLen / 14) * 100)
            const fillCls = fillPct > 70 ? 'crit' : fillPct > 40 ? 'warn' : ''
            const bottle = isBottleneck(i)
            return (
              <div
                key={st.name}
                className={`station-item ${selected === i ? 'selected' : ''} ${bottle ? 'is-bottleneck' : ''}`}
                onClick={() => setSelected(i === selected ? null : i)}
              >
                <div className="station-row">
                  <span className="station-name" style={{ color: st.color }}>{st.name}</span>
                  <span className="station-time">{time}s · Lv{lvl}</span>
                </div>
                <div className="station-queue-bar">
                  <div className={`station-queue-fill ${fillCls}`} style={{ width: `${fillPct}%` }} />
                </div>
                <div className="station-queue-label">Queue: {qLen}</div>
                {selected === i && (
                  <button
                    className="upgrade-btn"
                    disabled={budget < UPGRADE_COST || lvl >= 2}
                    onClick={(e) => { e.stopPropagation(); doUpgrade(i) }}
                  >
                    {lvl >= 2 ? '✓ Max Level' : `Upgrade (-$${UPGRADE_COST}) → ${(time * 0.6).toFixed(1)}s`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="sidebar-block">
        <h3>Simulation Speed</h3>
        <div className="speed-row">
          {[0.5, 1, 2, 4].map((s) => (
            <button key={s} className={`speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSimSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-block">
        <div className="info-box">
          <strong>💡 Theory of Constraints</strong>
          The red station is your bottleneck. Upgrading anything else won't
          improve overall throughput — only the constraint limits the system.
        </div>
      </div>
    </>
  )

  return (
    <GameLayout
      title="Bottleneck Buster"
      subtitle="Find the constraint throttling your pipeline · Click a station to upgrade"
      sidebar={sidebar}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </GameLayout>
  )
}
