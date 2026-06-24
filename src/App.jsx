import { HashRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Home from './pages/Home.jsx'
import PizzaGame from './pages/PizzaGame.jsx'
import RedBeadGame from './pages/RedBeadGame.tsx'
import HerbieHikeGame from './pages/HerbieHikeGame.tsx'

export default function App() {
  return (
    <HashRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pizza" element={<PizzaGame />} />
        <Route path="/red-bead" element={<RedBeadGame />} />
        <Route path="/herbie-hike" element={<HerbieHikeGame />} />
      </Routes>
    </HashRouter>
  )
}
