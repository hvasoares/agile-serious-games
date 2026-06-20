import * as THREE from 'three'
import { canAdvance, isOverLimit, avgCycleTime } from '../sim/wipSim.js'

const COLS = [
  { name: 'BACKLOG',      x: -8,   color: 0x475569, hex: '#475569', defaultWip: Infinity },
  { name: 'IN PROGRESS',  x: -2.5, color: 0x6366f1, hex: '#6366f1', defaultWip: 3 },
  { name: 'REVIEW',       x: 3,    color: 0xf59e0b, hex: '#f59e0b', defaultWip: 2 },
  { name: 'DONE',         x: 8.5,  color: 0x10b981, hex: '#10b981', defaultWip: Infinity },
]

const TASKS = [
  'User Auth', 'Dark Mode', 'API Gateway', 'Mobile Nav',
  'Dashboard', 'Search', 'Email', 'Analytics',
  'CI/CD', 'Export', 'Onboarding', 'Notifications',
  'Profile', 'Cache', 'A11y', 'Feature Flags',
]

const CARD_PALETTE = [0x6366f1, 0xef4444, 0xf59e0b, 0x10b981, 0x22d3ee, 0xec4899]

let _ti = 0, _ci = 0, _pi = 0
const PTS = [1, 2, 3, 5, 8]

function card_texture(title, accentHex) {
  const cv = document.createElement('canvas')
  cv.width = 300; cv.height = 160
  const c = cv.getContext('2d')
  c.fillStyle = '#0d1525'; c.fillRect(0, 0, 300, 160)
  c.fillStyle = accentHex; c.fillRect(0, 0, 300, 5)
  c.fillStyle = '#e2e8f0'; c.font = 'bold 20px Arial'; c.fillText(title, 14, 36)
  c.fillStyle = accentHex + '44'; c.fillRect(14, 48, 56, 18)
  c.fillStyle = accentHex; c.font = '10px Arial'; c.fillText('feature', 19, 61)
  c.fillStyle = '#475569'; c.font = '13px Arial'
  c.fillText(`${PTS[_pi++ % PTS.length]} pts`, 14, 90)
  return new THREE.CanvasTexture(cv)
}

function label_texture(text, color) {
  const cv = document.createElement('canvas')
  cv.width = 240; cv.height = 40
  const c = cv.getContext('2d')
  c.fillStyle = color; c.font = 'bold 16px Arial'; c.textAlign = 'center'
  c.fillText(text, 120, 26)
  return new THREE.CanvasTexture(cv)
}

class SimCard {
  constructor(scene, colIdx) {
    const color = CARD_PALETTE[_ci++ % CARD_PALETTE.length]
    const hex = '#' + color.toString(16).padStart(6, '0')
    const tex = card_texture(TASKS[_ti++ % TASKS.length], hex)

    const geo = new THREE.BoxGeometry(3.0, 1.65, 0.08)
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x060e18 }),
    ]
    this.mesh = new THREE.Mesh(geo, mats)
    this.mesh.castShadow = true
    scene.add(this.mesh)

    this.colIdx = colIdx
    this.rowIdx = 0
    this.color = color
    this.targetPos = new THREE.Vector3()
    this.fromPos = new THREE.Vector3()
    this.moveT = 1
    this.animOff = Math.random() * Math.PI * 2
    this.workTimer = 0
    this.workNeeded = 3 + Math.random() * 4
    this.spawnTime = 0
    this.state = 'idle'
    this.overloadGlow = 0
  }

  dispose(scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.forEach(m => { m.map?.dispose(); m.dispose() })
  }
}

export class WipScene {
  constructor(container, { onUpdate } = {}) {
    this.container = container
    this.onUpdate = onUpdate
    this.wipLimits = [Infinity, 3, 2, Infinity]
    this.simSpeed = 1
    this.cards = []
    this.animId = null
    this.clock = new THREE.Clock()
    this.spawnTimer = 0
    this.throughputLog = []
    this.completedCount = 0
    this.totalCycleTime = 0
    this.elapsedSim = 0

    this._init()
    this._buildBoard()
    for (let i = 0; i < 6; i++) this._spawnCard()
    this._animate()
  }

  _init() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x080817)
    this.scene.fog = new THREE.FogExp2(0x080817, 0.014)

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 100)
    this.camera.position.set(0, 3.5, 21)
    this.camera.lookAt(0, 0.5, 0)

    const ambient = new THREE.AmbientLight(0x223355, 2)
    this.scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 2.5)
    dir.position.set(8, 15, 10); dir.castShadow = true
    dir.shadow.mapSize.set(1024, 1024)
    this.scene.add(dir)

    this.colLights = COLS.map((col) => {
      const pt = new THREE.PointLight(col.color, 1.0, 12)
      pt.position.set(col.x, 4, 3)
      this.scene.add(pt)
      return pt
    })
  }

  _buildBoard() {
    // Board backing
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(21, 13, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x0d1627, roughness: 0.9 })
    )
    board.receiveShadow = true
    this.scene.add(board)

    // Column separators + headers
    this.colHeaderMeshes = []
    COLS.forEach((col, i) => {
      if (i > 0) {
        const midX = (COLS[i - 1].x + col.x) / 2
        const sep = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 11, 0.12),
          new THREE.MeshStandardMaterial({ color: col.color, emissive: col.color, emissiveIntensity: 0.3 })
        )
        sep.position.set(midX, 0, 0.1)
        this.scene.add(sep)
      }

      // Top accent bar
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(4.3, 0.08, 0.13),
        new THREE.MeshStandardMaterial({ color: col.color, emissive: col.color, emissiveIntensity: 0.9 })
      )
      bar.position.set(col.x, 6.5, 0.14)
      this.scene.add(bar)

      // Label plane
      const tex = label_texture(col.name, col.hex)
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.6),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      )
      lbl.position.set(col.x, 7.1, 0.18)
      this.scene.add(lbl)

      // WIP limit indicator bar
      const limitBar = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 0.04, 0.13),
        new THREE.MeshStandardMaterial({ color: col.color, emissive: col.color, emissiveIntensity: 0.5 })
      )
      limitBar.position.set(col.x, 5.8, 0.15)
      this.scene.add(limitBar)
      this.colHeaderMeshes.push({ bar, limitBar })
    })
  }

  _getColCards(idx) {
    return this.cards.filter(c => c.colIdx === idx && c.state !== 'completing')
  }

  _restack(colIdx) {
    this._getColCards(colIdx).forEach((card, r) => {
      const prev = card.mesh.position.clone()
      card.rowIdx = r
      card.targetPos.set(
        COLS[colIdx].x + (Math.random() - 0.5) * 0.18,
        r * -1.95 + 4.2,
        0.18 + r * 0.01
      )
      card.fromPos.copy(prev)
      card.moveT = 0
    })
  }

  _spawnCard() {
    if (this._getColCards(0).length >= 8) return
    const card = new SimCard(this.scene, 0)
    card.spawnTime = this.elapsedSim
    const row = this._getColCards(0).length
    card.mesh.position.set(COLS[0].x, 8, 0.18)
    card.fromPos.copy(card.mesh.position)
    card.targetPos.set(COLS[0].x, row * -1.95 + 4.2, 0.18)
    card.moveT = 0
    this.cards.push(card)
  }

  _tryAdvance(card) {
    const next = card.colIdx + 1
    if (next >= COLS.length) {
      card.state = 'completing'
      card.workTimer = 0
      return
    }
    const nextCount = this._getColCards(next).length
    if (!canAdvance(this.wipLimits, next, nextCount)) return

    const prevPos = card.mesh.position.clone()
    card.colIdx = next
    card.workTimer = 0
    card.workNeeded = 2.5 + Math.random() * 4
    card.state = 'idle'
    this._restack(card.colIdx - 1)
    this._restack(card.colIdx)
    card.fromPos.copy(prevPos)
    card.moveT = 0
  }

  setWipLimits(limits) { this.wipLimits = limits }
  setSpeed(s) { this.simSpeed = s }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate())
    const raw = this.clock.getDelta()
    const delta = raw * this.simSpeed
    this.elapsedSim += delta
    const elapsed = this.clock.elapsedTime

    this.spawnTimer += delta
    if (this.spawnTimer > 3.5 / this.simSpeed) {
      this.spawnTimer = 0
      this._spawnCard()
    }

    // Update column overload lights
    COLS.forEach((col, i) => {
      const cnt = this._getColCards(i).length
      const overloaded = isOverLimit(this.wipLimits, i, cnt)
      this.colLights[i].color.setHex(overloaded ? 0xef4444 : col.color)
      this.colLights[i].intensity = overloaded ? 2.0 : 1.0
    })

    const toRemove = []
    this.cards.forEach((card) => {
      // Smooth movement
      if (card.moveT < 1) {
        card.moveT = Math.min(1, card.moveT + raw * 2.8)
        const t = 1 - Math.pow(1 - card.moveT, 3)
        card.mesh.position.lerpVectors(card.fromPos, card.targetPos, t)
        card.mesh.position.z = 0.18 + Math.sin(card.moveT * Math.PI) * 1.2
      } else {
        card.mesh.position.lerp(card.targetPos, raw * 7)
      }

      card.mesh.rotation.z = Math.sin(elapsed * 0.35 + card.animOff) * 0.01
      card.mesh.rotation.x = Math.sin(elapsed * 0.25 + card.animOff * 1.5) * 0.007

      // Overload glow
      const colCards = this._getColCards(card.colIdx).length
      const over = isOverLimit(this.wipLimits, card.colIdx, colCards)
      card.overloadGlow = over
        ? Math.min(1, card.overloadGlow + raw * 2)
        : Math.max(0, card.overloadGlow - raw * 2)
      const front = card.mesh.material[4]
      if (front) {
        front.emissive = new THREE.Color(0xef4444)
        front.emissiveIntensity = card.overloadGlow * 0.4
      }

      // Work progress in non-backlog, non-done columns
      if (card.colIdx > 0 && card.colIdx < COLS.length - 1 && card.state === 'idle') {
        card.workTimer += delta
        if (card.workTimer >= card.workNeeded) {
          this._tryAdvance(card)
        }
      }

      // Completing animation
      if (card.state === 'completing') {
        card.workTimer += raw
        card.mesh.position.y += raw * 3.5
        const fade = Math.max(0, 1 - card.workTimer * 1.2)
        card.mesh.material.forEach(m => { m.opacity = fade; m.transparent = true })
        card.mesh.scale.setScalar(Math.max(0.01, 1 - card.workTimer * 0.6))
        if (card.workTimer > 1.4) {
          const cycleTime = this.elapsedSim - card.spawnTime
          this.totalCycleTime += cycleTime
          this.completedCount++
          toRemove.push(card)
        }
      }
    })

    toRemove.forEach(card => {
      card.dispose(this.scene)
      this.cards = this.cards.filter(c => c !== card)
    })

    // Emit metrics
    if (this.onUpdate) {
      const wip = this._getColCards(1).length + this._getColCards(2).length
      const avgCycle = avgCycleTime(this.totalCycleTime, this.completedCount)
      this.onUpdate({
        wip,
        completed: this.completedCount,
        avgCycle,
        colCounts: COLS.map((_, i) => this._getColCards(i).length),
      })
    }

    this.renderer.render(this.scene, this.camera)
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose() {
    cancelAnimationFrame(this.animId)
    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
