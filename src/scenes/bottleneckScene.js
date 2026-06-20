import * as THREE from 'three'
import { effectiveTime, processStations } from '../sim/bottleneckSim.js'

const STATIONS = [
  { name: 'Design',  baseTime: 2,  color: 0x6366f1, colorHex: '#6366f1' },
  { name: 'Dev',     baseTime: 4,  color: 0x22d3ee, colorHex: '#22d3ee' },
  { name: 'QA Test', baseTime: 9,  color: 0xef4444, colorHex: '#ef4444' }, // bottleneck
  { name: 'Review',  baseTime: 3,  color: 0xf59e0b, colorHex: '#f59e0b' },
  { name: 'Deploy',  baseTime: 1.5,color: 0x10b981, colorHex: '#10b981' },
]

function stationLabel(text, hex) {
  const cv = document.createElement('canvas')
  cv.width = 200; cv.height = 120
  const c = cv.getContext('2d')
  c.fillStyle = hex; c.font = 'bold 18px Arial'; c.textAlign = 'center'
  c.fillText(text, 100, 30)
  c.fillStyle = '#475569'; c.font = '12px Arial'
  c.fillText('station', 100, 52)
  return new THREE.CanvasTexture(cv)
}

function queueLabel(count, _hex) {
  const cv = document.createElement('canvas')
  cv.width = 128; cv.height = 56
  const c = cv.getContext('2d')
  c.fillStyle = count > 5 ? '#ef4444' : count > 2 ? '#f59e0b' : '#64748b'
  c.font = 'bold 20px Arial'; c.textAlign = 'center'
  c.fillText(`Q:${count}`, 64, 36)
  return new THREE.CanvasTexture(cv)
}

export class BottleneckScene {
  constructor(container, { onUpdate } = {}) {
    this.container = container
    this.onUpdate = onUpdate
    this.simSpeed = 1
    this.animId = null
    this.clock = new THREE.Clock()
    this.elapsedSim = 0
    this.throughput = 0
    this.completed = 0
    this.upgradeLevels = STATIONS.map(() => 0)

    this.stations = STATIONS.map((s, i) => ({
      ...s,
      queue: [],
      current: null,
      timer: 0,
      x: (i - 2) * 4.5,
    }))

    this.cardPool = []
    this.spawnTimer = 0
    this.throughputTimer = 0
    this.recentCompleted = 0
    this._cardId = 0

    this._init()
    this._buildScene()
    this._animate()
  }

  _init() {
    const w = this.container.clientWidth, h = this.container.clientHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x080817)
    this.scene.fog = new THREE.FogExp2(0x080817, 0.012)

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)
    this.camera.position.set(0, 10, 18)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0x223355, 2.2))
    const dir = new THREE.DirectionalLight(0xffffff, 2.8)
    dir.position.set(5, 14, 8); dir.castShadow = true
    dir.shadow.mapSize.set(1024, 1024)
    this.scene.add(dir)

    this.stationLights = this.stations.map((s) => {
      const pt = new THREE.PointLight(s.color, 0.8, 8)
      pt.position.set(s.x, 4, 0)
      this.scene.add(pt)
      return pt
    })
  }

  _buildScene() {
    // Conveyor belt base
    const beltGeo = new THREE.BoxGeometry(22, 0.2, 2.4)
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f1a2e, roughness: 0.8 })
    const belt = new THREE.Mesh(beltGeo, beltMat)
    belt.position.set(0, -0.6, 0); belt.receiveShadow = true
    this.scene.add(belt)

    // Belt segments
    for (let i = -10; i <= 10; i += 1.5) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.06, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: 0.7 })
      )
      seg.position.set(i, -0.48, 0)
      this.scene.add(seg)
    }

    // Station meshes
    this.stationMeshes = this.stations.map((s, i) => {
      const isBottleneck = i === 2 && this.upgradeLevels[i] === 0

      // Station body
      const geo = new THREE.BoxGeometry(3.2, 2.8, 2.4)
      const mat = new THREE.MeshStandardMaterial({
        color: isBottleneck ? 0x1a0808 : 0x0d1627,
        roughness: 0.7,
        emissive: isBottleneck ? 0xef4444 : s.color,
        emissiveIntensity: isBottleneck ? 0.08 : 0.04,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(s.x, 0.8, 0)
      mesh.castShadow = true; mesh.receiveShadow = true
      this.scene.add(mesh)

      // Roof accent
      const roofMat = new THREE.MeshStandardMaterial({
        color: s.color, emissive: s.color, emissiveIntensity: isBottleneck ? 0.5 : 0.6,
      })
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 2.4), roofMat)
      roof.position.set(s.x, 2.25, 0)
      this.scene.add(roof)

      // Label sprite
      const labelTex = stationLabel(s.name, s.colorHex)
      const lblGeo = new THREE.PlaneGeometry(2, 1.2)
      const lblMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide })
      const lbl = new THREE.Mesh(lblGeo, lblMat)
      lbl.position.set(s.x, 0.6, 1.3)
      lbl.rotation.x = -0.1
      this.scene.add(lbl)

      // Queue label (above station)
      const qTex = queueLabel(0, s.colorHex)
      const qGeo = new THREE.PlaneGeometry(1.2, 0.55)
      const qMat = new THREE.MeshBasicMaterial({ map: qTex, transparent: true })
      const qLbl = new THREE.Mesh(qGeo, qMat)
      qLbl.position.set(s.x, 3.2, 1.3)
      this.scene.add(qLbl)

      // Progress ring (circle)
      const ringGeo = new THREE.RingGeometry(0.5, 0.62, 32)
      const ringMat = new THREE.MeshBasicMaterial({
        color: s.color, transparent: true, opacity: 0, side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.set(s.x, 0.8, 1.25)
      this.scene.add(ring)

      return { mesh, roof, qLbl, qMat, qTex, ring, ringMat }
    })
  }

  _effectiveTime(idx) {
    return effectiveTime(this.stations[idx].baseTime, this.upgradeLevels[idx])
  }

  _spawnWork() {
    if (this.stations[0].queue.length > 10) return
    this.stations[0].queue.push({ id: this._cardId++, color: 0x6366f1 })
  }

_updateVisuals() {
    const elapsed = this.clock.elapsedTime

    this.stations.forEach((st, i) => {
      const sm = this.stationMeshes[i]
      const q = st.queue.length
      const isBottleneck = i === 2 && this.upgradeLevels[i] < 2
      const isBusy = st.current !== null

      // Queue label
      if (sm.qTex) sm.qTex.dispose()
      sm.qTex = queueLabel(q, st.colorHex)
      sm.qMat.map = sm.qTex
      sm.qMat.needsUpdate = true

      // Station light
      this.stationLights[i].intensity = isBusy
        ? (isBottleneck ? 1.5 : 1.0)
        : 0.3
      this.stationLights[i].color.setHex(
        isBottleneck && q > 3 ? 0xef4444 : st.color
      )

      // Progress ring
      if (isBusy) {
        sm.ringMat.opacity = 0.8
        sm.ring.rotation.z = -Math.PI / 2 + elapsed * 0.5
        sm.ring.scale.setScalar(0.9 + 0.12 * Math.sin(elapsed * 3))
      } else {
        sm.ringMat.opacity = 0
      }

      // Bottleneck pulse on mesh
      const mat = sm.mesh.material
      if (isBottleneck && q > 0) {
        mat.emissiveIntensity = 0.05 + 0.04 * Math.sin(elapsed * 2.5)
      } else {
        mat.emissiveIntensity = 0.04
      }
    })
  }

  upgrade(stationIdx) {
    if (this.upgradeLevels[stationIdx] >= 2) return
    this.upgradeLevels[stationIdx]++
    // Re-style station mesh
    const s = this.stations[stationIdx]
    const sm = this.stationMeshes[stationIdx]
    const lvl = this.upgradeLevels[stationIdx]
    sm.mesh.material.color.setHex(0x0d1627)
    sm.mesh.material.emissive.setHex(s.color)
    sm.mesh.material.emissiveIntensity = 0.04
    sm.roof.material.emissiveIntensity = 0.6 + lvl * 0.2
  }

  setSpeed(s) { this.simSpeed = s }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate())
    const raw = this.clock.getDelta()
    const delta = raw * this.simSpeed

    this.spawnTimer += delta
    if (this.spawnTimer > 2) {
      this.spawnTimer = 0
      this._spawnWork()
    }

    this.throughputTimer += delta
    if (this.throughputTimer >= 10) {
      this.throughput = +(this.recentCompleted / 10).toFixed(1)
      this.recentCompleted = 0
      this.throughputTimer = 0
    }

    const newlyCompleted = processStations(this.stations, delta, i => this._effectiveTime(i))
    this.completed += newlyCompleted
    this.recentCompleted += newlyCompleted
    this._updateVisuals()

    if (this.onUpdate) {
      this.onUpdate({
        queues: this.stations.map(s => s.queue.length),
        busy: this.stations.map(s => !!s.current),
        throughput: this.throughput,
        completed: this.completed,
        upgradeLevels: [...this.upgradeLevels],
        effectiveTimes: this.stations.map((_, i) => +this._effectiveTime(i).toFixed(1)),
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
