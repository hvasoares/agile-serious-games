import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeroScene } from '../scenes/heroScene'

export default function Home() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [wip, setWip] = useState(4)

  useEffect(() => {
    if (!mountRef.current) return
    const s = new HeroScene(mountRef.current)
    s.onStats(({ wip }) => setWip(wip))
    sceneRef.current = s

    const onResize = () => s.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      s.dispose()
    }
  }, [])

  return (
    <>
      {/* ── HERO ── */}
      <section className="hero" style={{ paddingTop: 0 }}>
        <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
        <div className="hero-gradient" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Interactive Learning
          </div>
          <h1>
            Learn Kanban<br />
            <span className="gradient-text">Through Play</span>
          </h1>
          <p>
            Master Agile flow, WIP limits, and bottleneck theory through
            hands-on 3D simulations — no slides, just games.
          </p>
          <div className="hero-btns">
            <Link to="/pizza" className="btn btn-primary">Start Playing →</Link>
            <a href="#concepts" className="btn btn-ghost">Learn Concepts</a>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value" id="wip-stat">{wip}</span>
            <span className="hero-stat-label">WIP Count</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">3</span>
            <span className="hero-stat-label">Games</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">Live</span>
            <span className="hero-stat-label">Simulation</span>
          </div>
        </div>
      </section>

      {/* ── GAMES ── */}
      <section id="games" className="games-section">
        <div className="section-header">
          <span className="section-tag">Interactive Games</span>
          <h2>Choose Your Learning Path</h2>
          <p>Each simulation teaches a core Kanban principle through live experimentation.</p>
        </div>

        <div className="games-grid">
          {/* Pizza */}
          <div className="game-card">
            <div className="game-preview">
              <div className="pizza-preview">
                {['Cut', 'Sauce', 'Top', 'Bake', 'Deliver'].map((s, i) => (
                  <div key={s} className="pizza-station-preview">
                    <div className="pizza-disc" style={{ background: ['#f5f5dc','#cc2200','#ff8800','#8B4513','#228B22'][i] }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="game-info">
              <div className="game-tag">Concept: Kanban + Theory of Constraints</div>
              <h3>Kanban Pizzeria</h3>
              <p>
                Run a 5-stage pizza production line. Experience push chaos, apply pull discipline,
                then use the Theory of Constraints to find and fix your bottleneck.
              </p>
              <div className="game-meta">
                <span>🕐 10–15 min</span>
                <span>⭐⭐ Intermediate</span>
              </div>
              <Link to="/pizza" className="btn-play">Play Now →</Link>
            </div>
          </div>

          {/* Red Bead Experiment */}
          <div className="game-card">
            <div className="game-preview">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: i < 4 ? 'var(--rb-red, #e0473d)' : 'var(--text-muted, #64748b)',
                    opacity: 0.85
                  }} />
                ))}
              </div>
            </div>
            <div className="game-info">
              <div className="game-tag">Concept: System Variation</div>
              <h3>Red Bead Experiment</h3>
              <p>
                Deming's classic experiment: workers pull beads from a bin, but the system — not the
                worker — determines outcomes. Proves that variation is in the system, not the people.
              </p>
              <div className="game-meta">
                <span>🕐 10–20 min</span>
                <span>⭐⭐ Intermediate</span>
              </div>
              <Link to="/red-bead" className="btn-play">Play Now →</Link>
            </div>
          </div>

          {/* Scout Hike */}
          <div className="game-card">
            <div className="game-preview">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ECE7D7', opacity: 0.9 }} />
                    <div style={{ width: 8, height: 14, borderRadius: 3, background: ['#C2A878','#9FB08A','#B7986A','#8FA7B0','#CBB488','#A98E5E','#B0826B','#97A36F'][i], opacity: 0.9 }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="game-info">
              <div className="game-tag">Concept: Theory of Constraints · The Goal</div>
              <h3>The Scout Hike</h3>
              <p>
                Pack weight sets the pace. The troop is only as fast as its slowest hiker —
                share the load, manage the constraint, and subordinate everything else to the bottleneck.
              </p>
              <div className="game-meta">
                <span>🕐 5–10 min</span>
                <span>⭐ Beginner</span>
              </div>
              <Link to="/herbie-hike" className="btn-play">Play Now →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONCEPTS ── */}
      <section id="concepts" style={{ padding: '96px 32px' }}>
        <div className="section-header" style={{ maxWidth: 680, margin: '0 auto 56px' }}>
          <span className="section-tag">Core Concepts</span>
          <h2>Kanban Fundamentals</h2>
          <p>The principles behind the simulations — each game lets you feel these rather than just read them.</p>
        </div>
        <div className="concepts-grid" style={{ maxWidth: 1160, margin: '0 auto' }}>
          {[
            { icon: '🌊', title: 'Flow', desc: 'Work flows through stages like water. Smooth, uninterrupted flow means faster delivery with less stress on the team.' },
            { icon: '🎯', title: 'WIP Limits', desc: "Capping work-in-progress forces focus, exposes bottlenecks, and dramatically improves cycle time through Little's Law." },
            { icon: '⛓', title: 'Bottlenecks', desc: 'Every system has one constraint that limits throughput. Improving elsewhere does nothing until the real bottleneck is addressed.' },
            { icon: '⬅', title: 'Pull Principle', desc: 'Work is pulled by downstream demand, not pushed by upstream supply. This prevents queue buildup and overloading stages.' },
            { icon: '📐', title: "Little's Law", desc: 'CT = WIP / Throughput. A deceptively simple equation with profound implications: reduce WIP to reduce cycle time.' },
            { icon: '🔄', title: 'Kaizen', desc: 'Kanban is a continuous improvement system. Small, incremental changes compound into dramatically better flow over time.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="concept-card">
              <span className="concept-icon">{icon}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-brand">
          <span>⬡</span> Agile Serious Games
        </div>
        <p>Interactive Kanban simulations built with React + Three.js · Open source on GitHub</p>
      </footer>
    </>
  )
}
