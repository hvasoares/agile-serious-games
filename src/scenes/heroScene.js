import * as THREE from 'three'

const COLUMNS = [
  { name: 'BACKLOG',      x: -8,  color: 0x475569, hex: '#475569' },
  { name: 'IN PROGRESS',  x: -2.5,color: 0x6366f1, hex: '#6366f1' },
  { name: 'REVIEW',       x: 3,   color: 0xf59e0b, hex: '#f59e0b' },
  { name: 'DONE',         x: 8,   color: 0x10b981, hex: '#10b981' },
]

const TASKS = [
  'User Auth', 'Dark Mode', 'API Gateway', 'Mobile Nav',
  'Dashboard v2', 'Search Index', 'Email Service', 'Analytics',
  'CI/CD Pipeline', 'Data Export', 'Onboarding', 'Notifications',
  'Profile Page', 'Cache Layer', 'A11y Audit', 'Feature Flags',
]

const CARD_COLORS = [0x6366f1, 0xef4444, 0xf59e0b, 0x10b981, 0x22d3ee, 0xec4899]

let _taskIdx = 0
let _colorIdx = 0
let _ptIdx = 0
const POINTS = [1, 2, 3, 5, 8, 13]

function nextTask() { return TASKS[_taskIdx++ % TASKS.length] }
function nextColor() { return CARD_COLORS[_colorIdx++ % CARD_COLORS.length] }
function nextPts() { return POINTS[_ptIdx++ % POINTS.length] }

function makeCardTexture(title, accentColor, pts) {
  const w = 320, h = 180
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#0d1525'
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 10)
  ctx.fill()

  ctx.fillStyle = accentColor
  ctx.fillRect(0, 0, w, 6)

  ctx.fillStyle = '#e2e8f0'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillText(title, 16, 42)

  ctx.fillStyle = accentColor + '33'
  ctx.fillRect(16, 54, 64, 20)
  ctx.fillStyle = accentColor
  ctx.font = '11px Arial, sans-serif'
  ctx.fillText('feature', 22, 68)

  ctx.fillStyle = '#475569'
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText(`${pts} pts`, 16, 104)

  const avatarColors = ['#6366f1', '#22d3ee', '#f59e0b']
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = avatarColors[i]
    ctx.beginPath()
    ctx.arc(w - 20 - i * 24, h - 20, 9, 0, Math.PI * 2)
    ctx.fill()
  }

  return new THREE.CanvasTexture(canvas)
}

function makeColumnLabelTexture(text, color) {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 48
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 256, 48)
  ctx.fillStyle = color
  ctx.font = 'bold 18px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(text, 128, 30)
  return new THREE.CanvasTexture(canvas)
}

class KanbanCard {
  constructor(scene, colIndex) {
    this.colIndex = colIndex
    this.rowIndex = 0
    this.color = nextColor()
    this.accentHex = '#' + this.color.toString(16).padStart(6, '0')
    this.pts = nextPts()
    this.title = nextTask()

    const texture = makeCardTexture(this.title, this.accentHex, this.pts)
    const geo = new THREE.BoxGeometry(3.2, 1.8, 0.09)
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1220 }),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x060e18 }),
    ]
    this.mesh = new THREE.Mesh(geo, mats)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    scene.add(this.mesh)

    this.targetPos = new THREE.Vector3()
    this.animOffset = Math.random() * Math.PI * 2
    this.state = 'idle'
    this.stateTimer = 0
    this.workDuration = 3 + Math.random() * 5
    this.moveProgress = 1
    this.fromPos = new THREE.Vector3()
  }

  setColumnRow(colIndex, rowIndex) {
    this.colIndex = colIndex
    this.rowIndex = rowIndex
    const col = COLUMNS[colIndex]
    this.targetPos.set(col.x + (Math.random() - 0.5) * 0.3, rowIndex * -2.1 + 4, 0.2)
  }

  startMove(fromPos) {
    this.fromPos.copy(fromPos)
    this.moveProgress = 0
  }

  dispose(scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.forEach(m => m.dispose())
  }
}

export class HeroScene {
  constructor(container) {
    this.container = container
    this.cards = []
    this.particles = []
    this.animId = null
    this.clock = new THREE.Clock()
    this.autoMoveTimer = 0
    this.statsCallback = null

    this._init()
    this._populate()
    this._animate()
  }

  _init() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x080817)
    this.scene.fog = new THREE.FogExp2(0x080817, 0.018)

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)
    this.camera.position.set(0, 4, 20)
    this.camera.lookAt(0, 1, 0)

    // Lighting
    const ambient = new THREE.AmbientLight(0x223355, 1.8)
    this.scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5)
    dirLight.position.set(10, 18, 12)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 60
    this.scene.add(dirLight)

    // Column glow lights
    COLUMNS.forEach((col) => {
      const pt = new THREE.PointLight(col.color, 1.2, 10)
      pt.position.set(col.x, 5, 2)
      this.scene.add(pt)
    })

    // Board background
    const boardGeo = new THREE.BoxGeometry(20, 13, 0.15)
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x0d1627, roughness: 0.9 })
    const board = new THREE.Mesh(boardGeo, boardMat)
    board.position.set(0, 0.5, 0)
    board.receiveShadow = true
    this.scene.add(board)

    // Column separators
    COLUMNS.forEach((col, i) => {
      if (i === 0) return
      const sepGeo = new THREE.BoxGeometry(0.06, 11, 0.1)
      const sepMat = new THREE.MeshStandardMaterial({
        color: col.color,
        emissive: col.color,
        emissiveIntensity: 0.25,
      })
      const sep = new THREE.Mesh(sepGeo, sepMat)
      sep.position.set((COLUMNS[i - 1].x + col.x) / 2, 0.5, 0.15)
      this.scene.add(sep)
    })

    // Column header bars
    COLUMNS.forEach((col) => {
      const barGeo = new THREE.BoxGeometry(4.5, 0.1, 0.12)
      const barMat = new THREE.MeshStandardMaterial({
        color: col.color,
        emissive: col.color,
        emissiveIntensity: 0.8,
      })
      const bar = new THREE.Mesh(barGeo, barMat)
      bar.position.set(col.x, 6.6, 0.18)
      this.scene.add(bar)

      // Label
      const labelTex = makeColumnLabelTexture(col.name, col.hex)
      const labelGeo = new THREE.PlaneGeometry(3.6, 0.7)
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
      const label = new THREE.Mesh(labelGeo, labelMat)
      label.position.set(col.x, 7.2, 0.2)
      this.scene.add(label)
    })
  }

  _populate() {
    const layout = [[3, 1], [2, 2], [1, 3], [2, 0]]
    layout.forEach(([count, colIndex]) => {
      for (let r = 0; r < count; r++) {
        const card = new KanbanCard(this.scene, colIndex)
        card.setColumnRow(colIndex, r)
        card.mesh.position.copy(card.targetPos)
        card.stateTimer = Math.random() * card.workDuration
        this.cards.push(card)
      }
    })
  }

  _getColumnCards(colIndex) {
    return this.cards.filter(c => c.colIndex === colIndex && c.state !== 'completing')
  }

  _restack(colIndex) {
    const col = this._getColumnCards(colIndex)
    col.forEach((card, r) => {
      const prev = card.mesh.position.clone()
      card.rowIndex = r
      const c = COLUMNS[colIndex]
      card.targetPos.set(c.x + (Math.random() - 0.5) * 0.2, r * -2.1 + 4, 0.2)
      card.startMove(prev)
    })
  }

  _moveCard(card) {
    if (card.colIndex >= COLUMNS.length - 1) {
      card.state = 'completing'
      card.stateTimer = 0
      return
    }
    const prev = card.mesh.position.clone()
    card.colIndex++
    card.state = 'idle'
    card.stateTimer = 0
    card.workDuration = 3 + Math.random() * 5
    this._restack(card.colIndex - 1)
    this._restack(card.colIndex)
    card.startMove(prev)
  }

  _spawnCard() {
    const card = new KanbanCard(this.scene, 0)
    const rowIndex = this._getColumnCards(0).length
    card.setColumnRow(0, rowIndex)
    card.mesh.position.set(COLUMNS[0].x, 8, 0.2)
    card.startMove(card.mesh.position.clone())
    this.cards.push(card)
  }

  _spawnParticles(pos, color) {
    const count = 20
    const positions = new Float32Array(count * 3)
    const vels = []
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z
      vels.push((Math.random() - 0.5) * 3, Math.random() * 4 + 1, (Math.random() - 0.5) * 1.5)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color, size: 0.14, transparent: true, opacity: 1 })
    const pts = new THREE.Points(geo, mat)
    this.scene.add(pts)
    this.particles.push({ pts, vels, life: 1.2 })
  }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate())
    const delta = this.clock.getDelta()
    const elapsed = this.clock.elapsedTime

    // Gentle camera sway
    this.camera.position.x = Math.sin(elapsed * 0.08) * 1.5
    this.camera.position.y = 4 + Math.sin(elapsed * 0.05) * 0.4
    this.camera.lookAt(0, 1, 0)

    // Auto-move timer
    this.autoMoveTimer -= delta
    if (this.autoMoveTimer <= 0) {
      this.autoMoveTimer = 2.2 + Math.random() * 1.8
      const eligible = this.cards.filter(c => c.state === 'idle' && c.colIndex < COLUMNS.length - 1)
      if (eligible.length > 0) {
        const pick = eligible[Math.floor(Math.random() * eligible.length)]
        this._moveCard(pick)
      }
      if (this.cards.filter(c => c.colIndex === 0).length < 4) {
        this._spawnCard()
      }
    }

    // Update cards
    const toRemove = []
    this.cards.forEach((card) => {
      card.stateTimer += delta

      // Bob animation
      card.mesh.rotation.z = Math.sin(elapsed * 0.4 + card.animOffset) * 0.012
      card.mesh.rotation.x = Math.sin(elapsed * 0.3 + card.animOffset * 1.3) * 0.008

      // Smooth movement
      if (card.moveProgress < 1) {
        card.moveProgress = Math.min(1, card.moveProgress + delta * 2.5)
        const t = 1 - Math.pow(1 - card.moveProgress, 3)
        card.mesh.position.lerpVectors(card.fromPos, card.targetPos, t)
        const arcHeight = Math.sin(card.moveProgress * Math.PI) * 1.5
        card.mesh.position.z = 0.2 + arcHeight
      } else {
        card.mesh.position.lerp(card.targetPos, delta * 6)
      }

      if (card.state === 'completing') {
        card.stateTimer += delta
        card.mesh.position.y += delta * 3
        card.mesh.material.forEach(m => {
          if (m.opacity !== undefined) m.opacity = Math.max(0, 1 - card.stateTimer)
          m.transparent = true
        })
        card.mesh.scale.setScalar(Math.max(0.01, 1 - card.stateTimer * 0.5))
        if (card.stateTimer > 0.3 && !card._sparked) {
          card._sparked = true
          this._spawnParticles(card.mesh.position.clone(), card.color)
        }
        if (card.stateTimer > 1.5) {
          toRemove.push(card)
        }
      }
    })

    toRemove.forEach(card => {
      card.dispose(this.scene)
      this.cards = this.cards.filter(c => c !== card)
    })

    // Update particles
    const deadPts = []
    this.particles.forEach((p) => {
      p.life -= delta
      if (p.life <= 0) { deadPts.push(p); return }
      p.pts.material.opacity = p.life / 1.2
      const pos = p.pts.geometry.attributes.position.array
      for (let i = 0; i < p.vels.length / 3; i++) {
        pos[i * 3] += p.vels[i * 3] * delta
        pos[i * 3 + 1] += p.vels[i * 3 + 1] * delta
        pos[i * 3 + 2] += p.vels[i * 3 + 2] * delta
        p.vels[i * 3 + 1] -= 4 * delta
      }
      p.pts.geometry.attributes.position.needsUpdate = true
    })
    deadPts.forEach(p => {
      this.scene.remove(p.pts)
      p.pts.geometry.dispose()
      p.pts.material.dispose()
      this.particles = this.particles.filter(x => x !== p)
    })

    // Update stats callback
    if (this.statsCallback) {
      const wip = this.cards.filter(c => c.colIndex === 1 || c.colIndex === 2).length
      this.statsCallback({ wip })
    }

    this.renderer.render(this.scene, this.camera)
  }

  onStats(cb) { this.statsCallback = cb }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
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
