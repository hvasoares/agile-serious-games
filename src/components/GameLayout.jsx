import { Link } from 'react-router-dom'

export default function GameLayout({ title, subtitle, sidebar, children }) {
  return (
    <div className="game-layout">
      <div className="game-header">
        <Link to="/" className="back-link">← Back</Link>
        <div className="game-title-wrap">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="game-body">
        <div className="game-canvas-area">{children}</div>
        {sidebar && <aside className="game-sidebar">{sidebar}</aside>}
      </div>
    </div>
  )
}
