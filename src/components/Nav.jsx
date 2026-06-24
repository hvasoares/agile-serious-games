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
        <NavLink to="/pizza">Pizzeria</NavLink>
        <NavLink to="/red-bead">Red Bead</NavLink>
        <NavLink to="/herbie-hike">Scout Hike</NavLink>
      </div>
    </nav>
  )
}
