import { HashRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Home from './pages/Home.jsx'
import WipGame from './pages/WipGame.jsx'
import BottleneckGame from './pages/BottleneckGame.jsx'
import FlowGame from './pages/FlowGame.jsx'
import PizzaGame from './pages/PizzaGame.jsx'

export default function App() {
  return (
    <HashRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wip" element={<WipGame />} />
        <Route path="/bottleneck" element={<BottleneckGame />} />
        <Route path="/flow" element={<FlowGame />} />
        <Route path="/pizza" element={<PizzaGame />} />
      </Routes>
    </HashRouter>
  )
}
