import * as THREE from 'three'
import { getBacklogOrders } from '../../sim/pizza/orderSorting.js'
import { computeScore } from '../../sim/pizza/metrics.js'

// ═══ STATION LAYOUT (matches reference: SPAN=22, 5 stations) ═══

const SPAN = 22
const xAt = i => -SPAN / 2 + (i + 0.5) * (SPAN / 5)
const STATION_X = [0, 1, 2, 3, 4].map(xAt)

const STATION_DEFS_SCENE = [
  { key: 'cut',     name: 'Cut base', sub: 'slice the crust',   color: 0xe0a24b },
  { key: 'sauce',   name: 'Sauce',    sub: 'spread tomato',     color: 0xd8442a },
  { key: 'top',     name: 'Top',      sub: 'ham + pineapple',   color: 0xe58aa6 },
  { key: 'bake',    name: 'Oven',     sub: 'max 3 · slow bake', color: 0xcaa05a },
  { key: 'deliver', name: 'Deliver',  sub: 'fulfil the order',  color: 0x7cb342 },
]

const WORKER_Z = -1.6
const STATION_W = SPAN / 5  // ~4.4 units between station centers

// ═══ POSITIONING HELPERS ═══

// Buffer slot: compact heap on the LEFT side of the station — visible input queue
// Pizzas arriving from station i-1 pile up left of station i
function bufferSlot(stIdx, idx) {
  const col = idx % 3
  const layer = Math.floor(idx / 3)
  const jx = ((idx * 37) % 7 - 3) * 0.05
  const jz = ((idx * 53) % 5 - 2) * 0.05
  const x = xAt(stIdx) - STATION_W * 0.44 + col * 0.44 + jx  // left of pad
  const y = 0.42 + layer * 0.15                                 // grows upward
  const z = 0.6 + Math.min(layer, 3) * 0.18 + jz               // slight forward lean
  return new THREE.Vector3(x, y, z)
}

// Work slot: center/front of station pad — cooker is visible behind, pizza in front
function workSlot(stIdx, idx) {
  const off = [[0.3, 0.1], [0.3, 0.7], [-0.2, 0.4], [0.7, 0.4]][idx % 4] || [0, 0]
  return new THREE.Vector3(xAt(stIdx) + off[0], 0.42, off[1])
}

// ═══ LABEL HELPERS ═══

function makeLabel(name, sub) {
  const cv = document.createElement('canvas')
  cv.width = 256; cv.height = 96
  const c = cv.getContext('2d')
  c.font = 'bold 34px -apple-system,sans-serif'
  c.fillStyle = '#f4ecdd'; c.textAlign = 'center'; c.fillText(name, 128, 40)
  c.font = '22px -apple-system,sans-serif'
  c.fillStyle = '#b6a98f'; c.fillText(sub, 128, 72)
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sp.scale.set(4.2, 1.6, 1)
  return sp
}

function makeCapLabel(capText) {
  const cv = document.createElement('canvas')
  cv.width = 160; cv.height = 40
  const c = cv.getContext('2d')
  c.fillStyle = '#8a8073'; c.font = '18px -apple-system,sans-serif'; c.textAlign = 'center'
  c.fillText(capText, 80, 28)
  const tex = new THREE.CanvasTexture(cv)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sp.scale.set(2.6, 0.65, 1)
  return sp
}

// ═══ SLICE SHAPE (triangular wedge, laid flat — the actual game piece) ═══
function makeSliceGeo() {
  const sh = new THREE.Shape()
  sh.moveTo(0, 0); sh.lineTo(1.0, 0.42); sh.lineTo(1.0, -0.42); sh.lineTo(0, 0)
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  geo.center()
  return geo
}

// ═══ PIZZA SCENE CLASS ═══

// Where the order pile sits: between order-taker and Cut worker, at worker-row depth
const ORDER_PILE_X = xAt(0) - STATION_W * 0.40  // left of Cut pad, still in scene
const ORDER_PILE_Z = WORKER_Z + 0.6              // in front of doll row, easily visible
const ORDER_TAKER_X = xAt(0) - STATION_W * 0.72 // left of pile, same row

export class PizzaScene {
  constructor(mountElement, opts = {}) {
    this._mount = mountElement
    this._onUpdate = opts.onUpdate || null
    this._pizzaMeshes = new Map()   // pizza.i → THREE.Group
    this._geometries = []
    this._materials = []
    this._resizeObserver = null
    this._labelSprites = []         // for disposal
    this._ovenGlow = null
    this._constraintRing = null
    this._constraintMat = null
    this._stationPads = []          // refs for emissive glow updates
    this._workers = []              // refs for arm animation
    this._capSprites = []
    this._orderPileCards = []       // pre-pooled flat card meshes
    this._orderPileCount = 0        // last known pile size (for delta detection)
    this._orderTakerArm = null      // ref for arm animation
    this._lastStationSlots = []     // track slot counts for cap label refresh

    // Shared slice geometry (all slices reuse this)
    this._sliceGeo = makeSliceGeo()

    // Three.js setup
    const w = this._mount.clientWidth || 900
    const h = this._mount.clientHeight || 520

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mountElement.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;'

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x14110d)
    this.scene.fog = new THREE.Fog(0x14110d, 28, 55)

    // Camera — slightly elevated angle
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200)
    this._camAngle = 0.0
    this._camDist = 23
    this._camHeight = 12
    this._updateCamera()

    // Orbit via pointer events
    this._setupOrbit()

    // Lighting (warm kitchen tone, like reference)
    const key = new THREE.DirectionalLight(0xfff1d6, 1.05)
    key.position.set(8, 17, 11); key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -22; key.shadow.camera.right = 22
    key.shadow.camera.top = 22; key.shadow.camera.bottom = -22
    key.shadow.bias = -0.0004
    this.scene.add(key)
    this.scene.add(new THREE.HemisphereLight(0xfff0d8, 0x1a140c, 0.55))
    this.scene.add(new THREE.AmbientLight(0x403420, 0.4))

    // Build static scene
    this._buildCounter()
    this._buildStations()
    this._buildWorkers()
    this._buildOrderTaker()
    this._buildConstraintRing()

    // Resize observer
    this._resizeObserver = new ResizeObserver(() => this.resize())
    this._resizeObserver.observe(this._mount)
  }

  // ═══ SCENE CONSTRUCTION ═══

  _buildCounter() {
    // Kitchen counter / table surface
    const cGeo = new THREE.BoxGeometry(30, 1, 9)
    const cMat = new THREE.MeshStandardMaterial({ color: 0x2a2117, roughness: 0.9 })
    this._geometries.push(cGeo); this._materials.push(cMat)
    const counter = new THREE.Mesh(cGeo, cMat)
    counter.position.y = -0.5; counter.receiveShadow = true
    this.scene.add(counter)

    // Belt
    const bGeo = new THREE.BoxGeometry(24, 0.12, 2.4)
    const bMat = new THREE.MeshStandardMaterial({ color: 0x1a1610, roughness: 1 })
    this._geometries.push(bGeo); this._materials.push(bMat)
    const belt = new THREE.Mesh(bGeo, bMat)
    belt.position.set(0, 0.07, 0); belt.receiveShadow = true
    this.scene.add(belt)
  }

  _buildStations() {
    this._stationPads = []
    this._capSprites = []

    STATION_DEFS_SCENE.forEach((def, i) => {
      // Circular pad (like the reference)
      const padGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.18, 40)
      const padMat = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: 0.55, metalness: 0.1,
        emissive: def.color, emissiveIntensity: 0.06,
      })
      this._geometries.push(padGeo); this._materials.push(padMat)
      const pad = new THREE.Mesh(padGeo, padMat)
      pad.position.set(xAt(i), 0.16, 0)
      pad.receiveShadow = true; pad.castShadow = true
      this.scene.add(pad)
      this._stationPads.push({ pad, mat: padMat })

      // Oven station: dark box body + orange glow plane
      if (def.key === 'bake') {
        // Oven sits at the BACK of the station so workers+pizzas are visible in front
        const ovenGeo = new THREE.BoxGeometry(3.2, 2.4, 2.8)
        const ovenMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.7, metalness: 0.3 })
        this._geometries.push(ovenGeo); this._materials.push(ovenMat)
        const oven = new THREE.Mesh(ovenGeo, ovenMat)
        oven.position.set(xAt(i), 1.2, -2.0)  // behind the work area
        oven.castShadow = true; oven.receiveShadow = true
        this.scene.add(oven)

        // Glow plane at oven mouth (facing forward)
        const glowGeo = new THREE.PlaneGeometry(2.4, 1.6)
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7b30, transparent: true, opacity: 0.12 })
        this._geometries.push(glowGeo); this._materials.push(glowMat)
        const glow = new THREE.Mesh(glowGeo, glowMat)
        glow.position.set(xAt(i), 1.05, -0.55)  // mouth of oven, faces camera
        this.scene.add(glow)
        this._ovenGlow = glow
        this._ovenGlowMat = glowMat

        // Oven point light (warm orange)
        const ovenLight = new THREE.PointLight(0xff6600, 2.0, 10)
        ovenLight.position.set(xAt(i), 1.5, 1)
        this.scene.add(ovenLight)
        this._ovenLight = ovenLight
      }

      // Station label (Sprite, always faces camera)
      const lab = makeLabel(def.name, def.sub)
      lab.position.set(xAt(i), 3.2, 0)
      this.scene.add(lab)
      this._labelSprites.push(lab)
    })

    // Cap labels (rebuilt on loadRound)
    this._buildCapLabels(null)
  }

  _buildCapLabels(initialState) {
    this._capSprites.forEach(sp => {
      this.scene.remove(sp)
      sp.material.map?.dispose()
      sp.material.dispose()
    })
    this._capSprites = []

    STATION_DEFS_SCENE.forEach((_, i) => {
      const st = initialState?.stations[i]
      const cap = st?.cap ?? 99
      const fixed = st?.fixedCap ?? false
      const slots = st?.slots ?? 3
      // fixedCap stations (oven) always show their slot count, never ∞
      const str = fixed ? `cap: ${slots}` : (cap >= 99 ? 'cap: ∞' : `cap: ${cap}`)
      const sp = makeCapLabel(str)
      sp.position.set(xAt(i), 2.4, 0)
      this.scene.add(sp)
      this._capSprites.push(sp)
    })
  }

  _buildWorkers() {
    this._workers = []
    STATION_DEFS_SCENE.forEach((def, i) => {
      const g = new THREE.Group()

      const bodyGeo = new THREE.CylinderGeometry(0.42, 0.55, 1.2, 16)
      const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 })
      this._geometries.push(bodyGeo); this._materials.push(bodyMat)
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.y = 1.0; body.castShadow = true; g.add(body)

      const headGeo = new THREE.SphereGeometry(0.34, 20, 20)
      const headMat = new THREE.MeshStandardMaterial({ color: 0xe8b98c, roughness: 0.8 })
      this._geometries.push(headGeo); this._materials.push(headMat)
      const head = new THREE.Mesh(headGeo, headMat)
      head.position.y = 1.95; head.castShadow = true; g.add(head)

      // Chef hat (white cylinder — makes oven workers recognizable)
      const hatGeo = new THREE.CylinderGeometry(0.3, 0.26, 0.42, 16)
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xf4ecdd, roughness: 0.9 })
      this._geometries.push(hatGeo); this._materials.push(hatMat)
      const hat = new THREE.Mesh(hatGeo, hatMat)
      hat.position.y = 2.35; hat.castShadow = true; g.add(hat)

      // Working arm
      const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8)
      const armMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 })
      this._geometries.push(armGeo); this._materials.push(armMat)
      const arm = new THREE.Mesh(armGeo, armMat)
      arm.position.set(0.5, 1.1, 0.25); arm.rotation.z = 0.5; arm.castShadow = true; g.add(arm)

      g.userData = { arm }
      g.position.set(xAt(i), 0, WORKER_Z)
      this.scene.add(g)
      this._workers.push({ group: g, homeX: xAt(i), arm })
    })
  }

  _buildOrderTaker() {
    // ── Order-taker doll (waiter / front-of-house — distinct dark uniform) ──
    const g = new THREE.Group()
    const uniColor = 0x2d3a4f  // navy, distinct from coloured chef tunics

    const bodyGeo = new THREE.CylinderGeometry(0.42, 0.55, 1.2, 16)
    const bodyMat = new THREE.MeshStandardMaterial({ color: uniColor, roughness: 0.7 })
    this._geometries.push(bodyGeo); this._materials.push(bodyMat)
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 1.0; body.castShadow = true; g.add(body)

    const headGeo = new THREE.SphereGeometry(0.34, 20, 20)
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8b98c, roughness: 0.8 })
    this._geometries.push(headGeo); this._materials.push(headMat)
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.95; head.castShadow = true; g.add(head)

    // Glasses — visually distinguishes this doll from the chef workers
    const glassGeo = new THREE.TorusGeometry(0.09, 0.022, 6, 14)
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 })
    this._geometries.push(glassGeo); this._materials.push(glassMat)
    const glassL = new THREE.Mesh(glassGeo, glassMat)
    glassL.position.set(-0.12, 2.0, 0.29); glassL.rotation.y = Math.PI / 2; g.add(glassL)
    const glassR = glassL.clone()
    glassR.position.set(0.12, 2.0, 0.29); g.add(glassR)

    // Arm that swings when handing over an order
    const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.78, 8)
    const armMat = new THREE.MeshStandardMaterial({ color: uniColor, roughness: 0.7 })
    this._geometries.push(armGeo); this._materials.push(armMat)
    const arm = new THREE.Mesh(armGeo, armMat)
    arm.position.set(0.48, 1.1, 0.22); arm.rotation.z = 0.5; arm.castShadow = true; g.add(arm)
    this._orderTakerArm = arm

    // Notepad in hand
    const padGeo = new THREE.BoxGeometry(0.38, 0.48, 0.05)
    const padMat = new THREE.MeshStandardMaterial({ color: 0xf8f4e8, roughness: 0.95 })
    this._geometries.push(padGeo); this._materials.push(padMat)
    const notepad = new THREE.Mesh(padGeo, padMat)
    notepad.position.set(0.88, 1.22, 0.42); notepad.rotation.z = 0.5; g.add(notepad)

    g.position.set(ORDER_TAKER_X, 0, WORKER_Z)
    g.rotation.y = -Math.PI / 10  // faces slightly right toward the Cut station
    this.scene.add(g)
    this._orderTakerGroup = g
    this._orderTakerHead = head

    // ── Pre-pooled order card meshes (shown/hidden to represent the pile) ──
    const MAX_PILE = 24
    const cardGeo = new THREE.BoxGeometry(0.92, 0.09, 0.66)  // thick enough to see
    this._geometries.push(cardGeo)

    for (let i = 0; i < MAX_PILE; i++) {
      const cardMat = new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0xf7f2e4 : i % 3 === 1 ? 0xfff8dc : 0xfde9c8,
        roughness: 0.85,
        emissive: 0xffeedd,
        emissiveIntensity: 0.04,
      })
      this._materials.push(cardMat)
      const card = new THREE.Mesh(cardGeo, cardMat)

      // Stacked pile: each card slightly higher with small jitter for natural look
      const jx = ((i * 17) % 9 - 4) * 0.022
      const jz = ((i * 31) % 7 - 3) * 0.018
      card.position.set(
        ORDER_PILE_X + jx,
        0.38 + i * 0.10,
        ORDER_PILE_Z + jz,
      )
      card.rotation.y = ((i * 23) % 11 - 5) * 0.06  // slight angular spread
      card.castShadow = true; card.receiveShadow = true
      card.visible = false
      this.scene.add(card)
      this._orderPileCards.push(card)
    }
  }

  _buildConstraintRing() {
    const geo = new THREE.TorusGeometry(1.5, 0.06, 8, 48)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.8,
    })
    this._geometries.push(geo); this._materials.push(mat)
    this._constraintRing = new THREE.Mesh(geo, mat)
    this._constraintRing.rotation.x = Math.PI / 2
    this._constraintRing.visible = false
    this.scene.add(this._constraintRing)
    this._constraintMat = mat
  }

  // ═══ ORBIT CONTROLS (pointer drag) ═══

  _setupOrbit() {
    let dragging = false, lastX = 0
    const el = this.renderer.domElement

    const onDown = e => { dragging = true; lastX = e.clientX }
    const onMove = e => {
      if (!dragging) return
      this._camAngle += (e.clientX - lastX) * 0.008
      lastX = e.clientX
      this._updateCamera()
    }
    const onUp = () => { dragging = false }
    const onWheel = e => {
      this._camDist = Math.max(10, Math.min(40, this._camDist + e.deltaY * 0.04))
      this._updateCamera()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onUp)
    el.addEventListener('wheel', onWheel, { passive: true })

    this._disposeOrbit = () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }

  _updateCamera() {
    const x = Math.sin(this._camAngle) * this._camDist
    const z = Math.cos(this._camAngle) * this._camDist
    this.camera.position.set(x, this._camHeight, z)
    this.camera.lookAt(0, 0.5, 0)
  }

  // ═══ PUBLIC API ═══

  loadRound(_roundNum, initialState) {
    // Remove all pizza meshes (uses targeted disposal — shared sliceGeo not freed here)
    this._pizzaMeshes.forEach(group => this._disposePizzaGroup(group))
    this._pizzaMeshes.clear()

    // Reset oven glow
    if (this._ovenGlowMat) this._ovenGlowMat.opacity = 0.12

    // Hide constraint ring
    this._constraintRing.visible = false

    // Clear order pile
    this._orderPileCards.forEach(c => { c.visible = false })
    this._orderPileCount = 0

    // Rebuild cap labels with WIP caps for this round
    this._buildCapLabels(initialState)
  }

  // Backlog orders only — all slices still at Cut (stage 0). Matches the overlay backlog.
  _piledOrderCount(simState) {
    const backlog = getBacklogOrders(
      simState.orders ?? [],
      simState.pizzas ?? [],
      simState.currentOrder,
      new Set()  // dismissed state lives in React; backlog orders are never dismissed
    )
    return backlog.length + (simState.currentOrder ? 1 : 0)
  }

  _syncOrderPile(simState, t) {
    const newCount = this._piledOrderCount(simState)
    const showCount = Math.min(newCount, this._orderPileCards.length)

    // Show/hide cards to match pile height
    this._orderPileCards.forEach((card, i) => {
      card.visible = i < showCount
    })

    if (this._orderTakerArm) {
      const isPush = simState.mode === 'push'
      const cutBuf = simState.stations?.[0]?.buffer?.length ?? 0
      const cutCap = simState.stations?.[0]?.cap ?? 99
      // In pull mode, blocked = Cut buffer is at its WIP limit
      const isBlocked = !isPush && cutBuf >= cutCap

      if (newCount > this._orderPileCount) {
        // New order just placed — punch arm forward
        this._orderTakerArm.rotation.x = isPush ? -1.7 : -1.1
      }

      let targetX, targetZ, decayRate
      if (isPush) {
        // Round 1 — manic local optimizer: no regard for downstream, just push push push
        targetX = -0.5 + Math.sin(t * 13) * 1.0   // frenetic scribbling
        targetZ = 0.35 + Math.sin(t * 9) * 0.35    // wild lateral flail
        decayRate = 0.38  // very snappy — zero hesitation
      } else if (isBlocked) {
        // Pull mode, Cut buffer full — order taker is idle/blocked, arm hangs
        targetX = 0
        targetZ = 0.9   // arm droops to side
        decayRate = 0.06
      } else {
        // Pull mode, room available — calm measured pace
        targetX = -0.1 + Math.sin(t * 2.5) * 0.2
        targetZ = 0.5
        decayRate = 0.09
      }

      this._orderTakerArm.rotation.x += (targetX - this._orderTakerArm.rotation.x) * decayRate
      this._orderTakerArm.rotation.z += (targetZ - this._orderTakerArm.rotation.z) * decayRate
    }

    // Head bob: fast nod in push mode, slow in pull, still when blocked
    if (this._orderTakerHead) {
      const isPush = simState.mode === 'push'
      const cutBuf = simState.stations?.[0]?.buffer?.length ?? 0
      const cutCap = simState.stations?.[0]?.cap ?? 99
      const isBlocked = !isPush && cutBuf >= cutCap

      if (isPush) {
        // Manic head bob — local optimizer, oblivious to system pain downstream
        this._orderTakerHead.position.y = 1.95 + Math.sin(t * 13) * 0.10
        this._orderTakerHead.rotation.x = Math.sin(t * 13) * 0.28
        this._orderTakerHead.rotation.z = Math.sin(t * 7) * 0.10  // frantic side tilt
      } else if (isBlocked) {
        // Blocked: subtle dejected tilt downward
        this._orderTakerHead.rotation.x += (0.22 - this._orderTakerHead.rotation.x) * 0.05
        this._orderTakerHead.position.y += (1.88 - this._orderTakerHead.position.y) * 0.05
      } else {
        // Pull, not blocked: gentle idle
        this._orderTakerHead.position.y = 1.95 + Math.sin(t * 2) * 0.012
        this._orderTakerHead.rotation.x += (0 - this._orderTakerHead.rotation.x) * 0.05
      }
    }

    // Torso sway: whole body rocks in push mode, still in pull
    if (this._orderTakerGroup) {
      const isPush = simState.mode === 'push'
      if (isPush) {
        this._orderTakerGroup.rotation.z = Math.sin(t * 6.5) * 0.07
        this._orderTakerGroup.position.x = ORDER_TAKER_X + Math.sin(t * 5) * 0.05
      } else {
        this._orderTakerGroup.rotation.z += (0 - this._orderTakerGroup.rotation.z) * 0.04
        this._orderTakerGroup.position.x += (ORDER_TAKER_X - this._orderTakerGroup.position.x) * 0.04
      }
    }

    this._orderPileCount = newCount
  }

  syncState(simState, dt) {
    const seenIds = new Set()

    for (const pizza of simState.pizzas) {
      seenIds.add(pizza.i)

      let group = this._pizzaMeshes.get(pizza.i)
      if (!group) {
        group = this._createPizzaMesh()
        this.scene.add(group)
        this._pizzaMeshes.set(pizza.i, group)
        group.position.copy(this._slotPos(pizza, simState))
      }

      // Lerp toward target position
      const target = this._slotPos(pizza, simState)
      group.position.lerp(target, 0.12)

      // Spin while working
      if (pizza.state === 'working') {
        group.rotation.y += (dt || 0.016) * 0.7
      }

      // Progressive visual reveals
      this._applyVisual(group, pizza, simState)
    }

    // Remove meshes for delivered/gone pizzas
    this._pizzaMeshes.forEach((group, id) => {
      if (!seenIds.has(id)) {
        this._disposePizzaGroup(group)
        this._pizzaMeshes.delete(id)
      }
    })

    // Station pad emissive glow when buffer is piling
    simState.stations.forEach((st, i) => {
      const piling = st.buffer.length >= 3
      const busy = st.occupants.length > 0
      const entry = this._stationPads[i]
      if (entry) {
        entry.mat.emissiveIntensity = piling ? 0.34 : (busy ? 0.14 : 0.06)
      }
    })

    // Refresh cap labels when any station's slot count changes (e.g. after Elevate)
    const slotsNow = simState.stations.map(s => s.slots)
    const slotsChanged = slotsNow.some((s, i) => s !== this._lastStationSlots[i])
    if (slotsChanged) {
      this._lastStationSlots = slotsNow
      this._buildCapLabels(simState)
    }

    // Order pile + order taker animation
    const t = simState.t
    this._syncOrderPile(simState, t)

    // Worker arm animation
    this._workers.forEach((w, i) => {
      const st = simState.stations[i]
      const busy = st.occupants.some(p => p.state === 'working')
      if (i === 0 && busy) {
        w.arm.rotation.x = Math.sin(t * 7) * 0.5
        w.arm.rotation.z = -0.4 + Math.sin(t * 3.5) * 0.25
      } else if (busy) {
        w.arm.rotation.x = Math.sin(t * 8 + i) * 0.7
        w.arm.rotation.z += (0.5 - w.arm.rotation.z) * 0.1
      } else {
        w.arm.rotation.x += (0 - w.arm.rotation.x) * 0.1
        w.arm.rotation.z += (0.5 - w.arm.rotation.z) * 0.1
      }
    })

    // Constraint ring
    if (simState.constraint >= 0) {
      const cx = STATION_X[simState.constraint]
      this._constraintRing.position.set(cx, 2.5, 0)
      this._constraintRing.visible = true
      this._constraintMat.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 4)
    } else {
      this._constraintRing.visible = false
    }

    // Metrics callback
    if (this._onUpdate) {
      const wip = simState.stations.reduce((a, st) => a + st.occupants.length, 0)
      const { profit, wipCost, net } = computeScore(simState.pizzas ?? [], simState.delivered ?? 0)
      this._onUpdate({
        delivered: simState.delivered,
        wip,
        profit,
        wipCost,
        net,
        avgLeadTime: simState.delivered > 0 ? simState.leadSum / simState.delivered : null,
        elapsed: simState.t,
        stationStats: simState.stations.map(s => ({
          key: s.key,
          bufferLen: s.buffer.length,
          occupantLen: s.occupants.length,
          slots: s.slots,
          cap: s.cap,
        })),
      })
    }

    this.renderer.render(this.scene, this.camera)
  }

  resize() {
    const w = this._mount.clientWidth || 900
    const h = this._mount.clientHeight || 520
    if (w < 1 || h < 1) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose() {
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null }
    if (this._disposeOrbit) this._disposeOrbit()

    this._pizzaMeshes.forEach(group => this._disposePizzaGroup(group))
    this._pizzaMeshes.clear()

    this._labelSprites.forEach(sp => { sp.material.map?.dispose(); sp.material.dispose() })
    this._capSprites.forEach(sp => { sp.material.map?.dispose(); sp.material.dispose() })

    this._sliceGeo.dispose()

    this.scene.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach(m => { m.map?.dispose(); m.dispose() })
        else { obj.material.map?.dispose(); obj.material.dispose() }
      }
    })

    this._geometries.forEach(g => g.dispose())
    this._materials.forEach(m => { m.map?.dispose(); m.dispose() })

    this.renderer.dispose()
    if (this._mount.contains(this.renderer.domElement)) this._mount.removeChild(this.renderer.domElement)
  }

  // ═══ PRIVATE HELPERS ═══

  _createPizzaMesh() {
    const g = new THREE.Group()

    // Crust layer — shared slice geometry, per-pizza material (NOT in shared arrays)
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xe0a24b, roughness: 0.8 })
    const crust = new THREE.Mesh(this._sliceGeo, crustMat)
    crust.castShadow = true; g.add(crust)

    // Sauce overlay — shared geometry, per-pizza material, starts transparent
    const sauceMat = new THREE.MeshStandardMaterial({
      color: 0xd8442a, roughness: 0.6, transparent: true, opacity: 0,
    })
    const sauce = new THREE.Mesh(this._sliceGeo, sauceMat)
    sauce.scale.set(0.82, 1.4, 0.82); sauce.position.y = 0.07; g.add(sauce)

    // Toppings — unique BoxGeometry per pizza, tracked in userData for targeted disposal
    const tops = new THREE.Group()
    const hamMat = new THREE.MeshStandardMaterial({ color: 0xe58aa6, roughness: 0.7 })
    const pineMat = new THREE.MeshStandardMaterial({ color: 0xf2c84b, roughness: 0.7 })
    const toppingGeos = []
    ;[[-0.25, 0.05], [0.15, 0.18], [0.32, -0.16], [-0.05, -0.12]].forEach((p, idx) => {
      const tGeo = new THREE.BoxGeometry(0.18, 0.06, 0.18)
      toppingGeos.push(tGeo)
      const m = new THREE.Mesh(tGeo, idx % 2 ? pineMat : hamMat)
      m.position.set(p[0], 0.16, p[1]); m.castShadow = true; tops.add(m)
    })
    tops.visible = false; g.add(tops)

    g.userData = { crustMat, sauceMat, hamMat, pineMat, toppingGeos, tops }
    g.scale.setScalar(0.85)
    return g
  }

  _disposePizzaGroup(group) {
    this.scene.remove(group)
    const { crustMat, sauceMat, hamMat, pineMat, toppingGeos } = group.userData
    crustMat?.dispose(); sauceMat?.dispose(); hamMat?.dispose(); pineMat?.dispose()
    toppingGeos?.forEach(g => g.dispose())
  }

  _slotPos(pizza, simState) {
    const st = simState.stations[pizza.stage]
    if (!st) return new THREE.Vector3(xAt(pizza.stage), 0.42, 0)

    if (pizza.state === 'working') {
      const idx = st.occupants.findIndex(p => p.i === pizza.i)
      return workSlot(pizza.stage, idx >= 0 ? idx : 0)
    } else {
      const idx = st.buffer.findIndex(p => p.i === pizza.i)
      return bufferSlot(pizza.stage, idx >= 0 ? idx : 0)
    }
  }

  _applyVisual(group, pizza, simState) {
    const { stage, prog } = pizza
    const st = simState.stations[stage]
    const r = (st && st.dur > 0) ? prog / st.dur : 0
    const { crustMat, sauceMat, tops } = group.userData

    // Stage 1 (Sauce): fade sauce in while working
    if (stage >= 1) {
      sauceMat.opacity = stage === 1 ? Math.min(1, r) : 1
    }

    // Stage 2 (Top): scale toppings in
    if (stage >= 2) {
      tops.visible = true
      tops.scale.setScalar(stage === 2 ? Math.min(1, 0.3 + r) : 1)
    }

    // Stage 3 (Oven): darken crust + strengthen oven glow
    if (stage === 3) {
      const h = Math.min(0.35, r * 0.35)
      crustMat.color.setRGB(0.878 - h * 0.5, 0.635 - h * 0.3, 0.294 - h * 0.1)
      if (this._ovenGlowMat) this._ovenGlowMat.opacity = 0.12 + 0.43 * r
    }
  }

}
