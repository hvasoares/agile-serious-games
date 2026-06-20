import { useEffect, useRef, useState } from 'react'
import GameLayout from '../components/GameLayout.jsx'
import { FlowScene } from '../scenes/flowScene'

export default function FlowGame() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [speed, setSpeed] = useState(1)
  const [metrics, setMetrics] = useState({
    pushQueue: 0, pullQueue: 0,
    pushCompleted: 0, pullCompleted: 0,
    pushThroughput: 0, pullThroughput: 0,
  })

  useEffect(() => {
    if (!mountRef.current) return
    const s = new FlowScene(mountRef.current, { onUpdate: setMetrics })
    sceneRef.current = s

    const onResize = () => s.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      s.dispose()
    }
  }, [])

  const setSimSpeed = (s) => {
    setSpeed(s)
    sceneRef.current?.setSpeed(s)
  }

  const sidebar = (
    <>
      <div className="sidebar-block">
        <h3>Push System</h3>
        <div className="flow-system-box">
          <div className="flow-system-title push">⬆ Push</div>
          <div className="flow-stat-line">
            <span>Total Queue</span>
            <strong style={{ color: 'var(--red)' }}>{metrics.pushQueue}</strong>
          </div>
          <div className="flow-stat-line">
            <span>Completed</span>
            <strong>{metrics.pushCompleted}</strong>
          </div>
          {metrics.pushThroughput !== null && (
            <div className="flow-stat-line">
              <span>Throughput</span>
              <strong>{metrics.pushThroughput}/10s</strong>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-block">
        <h3>Pull System</h3>
        <div className="flow-system-box">
          <div className="flow-system-title pull">⬇ Pull</div>
          <div className="flow-stat-line">
            <span>Total Queue</span>
            <strong style={{ color: 'var(--green)' }}>{metrics.pullQueue}</strong>
          </div>
          <div className="flow-stat-line">
            <span>Completed</span>
            <strong>{metrics.pullCompleted}</strong>
          </div>
          {metrics.pullThroughput !== null && (
            <div className="flow-stat-line">
              <span>Throughput</span>
              <strong>{metrics.pullThroughput}/10s</strong>
            </div>
          )}
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
          <strong>💡 Pull Principle</strong>
          Push floods stages regardless of capacity. Pull only sends work when
          downstream is ready — smaller queues, lower stress, similar throughput.
        </div>
        <div className="info-box" style={{ marginTop: 10 }}>
          <strong>🔑 What to Watch</strong>
          Notice how the Push queue (top) keeps growing while Pull (bottom)
          stays controlled. Both eventually complete similar work.
        </div>
      </div>
    </>
  )

  return (
    <GameLayout
      title="Push vs Pull"
      subtitle="See why pull-based flow creates smaller queues and less waste in real time"
      sidebar={sidebar}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </GameLayout>
  )
}
