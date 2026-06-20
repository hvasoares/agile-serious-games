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
            <Link to="/wip" className="btn btn-primary">Start Playing →</Link>
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
          {/* WIP Limits */}
          <div className="game-card" onClick={() => {}}>
            <div className="game-preview">
              <div className="wip-board-preview">
                <div className="wip-col-preview col-backlog">
                  <div className="wip-col-label-preview">Backlog</div>
                  <div className="mini-card c-purple" />
                  <div className="mini-card c-cyan" />
                  <div className="mini-card" />
                </div>
                <div className="wip-col-preview col-overload">
                  <div className="wip-col-label-preview">In Progress</div>
                  <div className="mini-card c-red" />
                  <div className="mini-card c-red" />
                  <div className="mini-card c-red" />
                  <div className="mini-card c-red" />
                </div>
                <div className="wip-col-preview col-review">
                  <div className="wip-col-label-preview">Review</div>
                  <div className="mini-card c-amber" />
                </div>
                <div className="wip-col-preview col-done">
                  <div className="wip-col-label-preview">Done</div>
                  <div className="mini-card c-done" />
                  <div className="mini-card c-done" />
                </div>
              </div>
            </div>
            <div className="game-info">
              <div className="game-tag">Concept: WIP Limits</div>
              <h3>The Flow Lab</h3>
              <p>
                Adjust WIP limits per column and watch how restricting work-in-progress
                dramatically improves cycle time and throughput — Little's Law in action.
              </p>
              <div className="game-meta">
                <span>🕐 5–10 min</span>
                <span>⭐ Beginner</span>
              </div>
              <Link to="/wip" className="btn-play">Play Now →</Link>
            </div>
          </div>

          {/* Bottleneck */}
          <div className="game-card">
            <div className="game-preview">
              <div className="pipeline-preview">
                {['Design', 'Dev', 'QA', 'Review', 'Deploy'].map((name, i) => (
                  <span key={name} style={{ display: 'contents' }}>
                    <div className={`pipe-stage ${i === 2 ? 'is-bottleneck' : ''}`}>
                      {name}
                    </div>
                    {i < 4 && <div className="pipe-arrow">›</div>}
                  </span>
                ))}
              </div>
            </div>
            <div className="game-info">
              <div className="game-tag">Concept: Theory of Constraints</div>
              <h3>Bottleneck Buster</h3>
              <p>
                Identify which stage throttles your team's output. Spend your budget
                wisely on upgrades — but beware, improving a non-bottleneck changes nothing.
              </p>
              <div className="game-meta">
                <span>🕐 10–15 min</span>
                <span>⭐⭐ Intermediate</span>
              </div>
              <Link to="/bottleneck" className="btn-play">Play Now →</Link>
            </div>
          </div>

          {/* Flow */}
          <div className="game-card">
            <div className="game-preview">
              <div className="flow-preview-wrap">
                <div className="flow-lane-preview">
                  <span className="flow-lane-label push">Push</span>
                  <div className="flow-bar-track">
                    <div className="flow-bar-fill push" />
                  </div>
                  <span className="flow-stat-preview">Q: 14</span>
                </div>
                <div className="flow-lane-preview">
                  <span className="flow-lane-label pull">Pull</span>
                  <div className="flow-bar-track">
                    <div className="flow-bar-fill pull" />
                  </div>
                  <span className="flow-stat-preview">Q: 4</span>
                </div>
              </div>
            </div>
            <div className="game-info">
              <div className="game-tag">Concept: Pull Principle</div>
              <h3>Push vs Pull</h3>
              <p>
                Race a push-based delivery system against a pull-based one. See in real time
                why pull creates smoother flow, smaller queues, and less waste.
              </p>
              <div className="game-meta">
                <span>🕐 5–10 min</span>
                <span>⭐ Beginner</span>
              </div>
              <Link to="/flow" className="btn-play">Play Now →</Link>
            </div>
          </div>

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
