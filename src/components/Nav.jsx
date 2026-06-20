import { Link, NavLink } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <div className="nav-logo-mark">⬡</div>
        Agile Games
      </Link>
      <div className="nav-links">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/wip">WIP Limits</NavLink>
        <NavLink to="/bottleneck">Bottleneck</NavLink>
        <NavLink to="/flow">Flow</NavLink>
      </div>
    </nav>
  )
}
