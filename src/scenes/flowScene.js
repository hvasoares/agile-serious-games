import * as THREE from 'three'
import { pipelineQueueTotal, spawnWork, processStages } from '../sim/flowSim.js'

// 3-stage pipeline: Develop → Test → Deploy
// Two rows: Push (top, y=3) vs Pull (bottom, y=-3)
const STAGE_NAMES = ['Develop', 'Test', 'Deploy']
const STAGE_TIMES = [3, 5, 2]
const STAGE_X = [-6, 0, 6]
const SYSTEM_Y = { push: 3.2, pull: -3.2 }
const SYSTEM_COLORS = { push: 0xef4444, pull: 0x10b981 }

function systemLabel(text, color) {
  const cv = document.createElement('canvas')
  cv.width = 180; cv.height = 48
  const ctx = cv.getContext('2d')
  ctx.fillStyle = color
  ctx.font = 'bold 24px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(text, 90, 30)
  return new THREE.CanvasTexture(cv)
}

function stageBox(color, emissive) {
  const geo = new THREE.BoxGeometry(2.8, 1.8, 1.2)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d1627, roughness: 0.7,
    emissive, emissiveIntensity: 0.06,
  })
  return new THREE.Mesh(geo, mat)
}

class Pipeline {
  constructor(scene, systemY, colorHex, colorInt, kind) {
    this.scene = scene
    this.systemY = systemY
    this.colorHex = colorHex
    this.colorInt = colorInt
    this.kind = kind

    this.stages = STAGE_NAMES.map((name, i) => ({
      name, baseTime: STAGE_TIMES[i],
      queue: [], current: null, timer: 0,
    }))

    this.completed = 0
    this.recentCompleted = 0
    this.spawnTimer = 0
    this.spawnInterval = kind === 'push' ? 1.8 : 3.5

    this.meshes = []
    this.queueMeshes = []
    this.workItemMeshes = []

    this._buildPipeline(scene)
  }

  _buildPipeline(scene) {
    // System label
    const tex = systemLabel(this.kind.toUpperCase(), this.colorHex)
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.65),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    )
    lbl.position.set(-10.5, this.systemY, 0.3)
    scene.add(lbl)

    STAGE_X.forEach((x, i) => {
      const box = stageBox(this.colorInt, this.colorInt)
      box.position.set(x, this.systemY, 0)
      box.castShadow = true; box.receiveShadow = true
      scene.add(box)
      this.meshes.push(box)

      // Stage roof accent
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.08, 1.2),
        new THREE.MeshStandardMaterial({ color: this.colorInt, emissive: this.colorInt, emissiveIntensity: 0.7 })
      )
      roof.position.set(x, this.systemY + 0.95, 0)
      scene.add(roof)

      // Stage name label
      const cv = document.createElement('canvas')
      cv.width = 180; cv.height = 48
      const ctx = cv.getContext('2d')
      ctx.fillStyle = this.colorHex; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'
      ctx.fillText(STAGE_NAMES[i], 90, 26)
      const stTex = new THREE.CanvasTexture(cv)
      const stLbl = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.5),
        new THREE.MeshBasicMaterial({ map: stTex, transparent: true })
      )
      stLbl.position.set(x, this.systemY - 0.1, 0.65)
      scene.add(stLbl)

      // Arrow connector
      if (i < STAGE_X.length - 1) {
        const arrow = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.04, 0.15),
          new THREE.MeshStandardMaterial({ color: this.colorInt, emissive: this.colorInt, emissiveIntensity: 0.5 })
        )
        arrow.position.set((x + STAGE_X[i + 1]) / 2, this.systemY, 0)
        scene.add(arrow)
      }
    })
  }

  _getQueueX(stageIdx) {
    return STAGE_X[stageIdx] - 0.4
  }

  update(delta, elapsed) {
    this.spawnTimer += delta
    const spawn = spawnWork(this.stages, this.spawnTimer, this.spawnInterval, this.kind)
    this.spawnTimer = spawn.timer

    const newlyCompleted = processStages(this.stages, delta, this.kind)
    this.completed += newlyCompleted
    this.recentCompleted += newlyCompleted

    this.meshes.forEach((box, i) => {
      const st = this.stages[i]
      box.material.emissiveIntensity = st.current ? 0.06 + 0.06 * Math.sin(elapsed * 3) : 0.02
    })
  }

  get queueTotal() {
    return pipelineQueueTotal(this.stages)
  }

  dispose() {
    this.meshes.forEach(m => { m.geometry.dispose(); m.material.dispose() })
  }
}

export class FlowScene {
  constructor(container, { onUpdate } = {}) {
    this.container = container
    this.onUpdate = onUpdate
    this.simSpeed = 1
    this.animId = null
    this.clock = new THREE.Clock()
    this.throughputTimer = 0

    this._init()
    this._buildDivider()

    this.push = new Pipeline(this.scene, SYSTEM_Y.push, '#ef4444', SYSTEM_COLORS.push, 'push')
    this.pull = new Pipeline(this.scene, SYSTEM_Y.pull, '#10b981', SYSTEM_COLORS.pull, 'pull')

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
    this.scene.fog = new THREE.FogExp2(0x080817, 0.014)

    this.camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 100)
    this.camera.position.set(0, 4, 18)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0x223355, 2.2))
    const dir = new THREE.DirectionalLight(0xffffff, 2.5)
    dir.position.set(8, 14, 10); dir.castShadow = true
    dir.shadow.mapSize.set(1024, 1024)
    this.scene.add(dir)

    const ptPush = new THREE.PointLight(SYSTEM_COLORS.push, 1.0, 18)
    ptPush.position.set(0, SYSTEM_Y.push + 3, 3)
    this.scene.add(ptPush)

    const ptPull = new THREE.PointLight(SYSTEM_COLORS.pull, 1.0, 18)
    ptPull.position.set(0, SYSTEM_Y.pull - 1, 3)
    this.scene.add(ptPull)
  }

  _buildDivider() {
    const div = new THREE.Mesh(
      new THREE.BoxGeometry(19, 0.04, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x334155, emissiveIntensity: 0.5 })
    )
    div.position.set(0, 0, 0)
    this.scene.add(div)

    // Labels: PUSH / PULL
    const colors = ['#ef4444', '#10b981']
    const labels = ['PUSH SYSTEM', 'PULL SYSTEM']
    const ys = [SYSTEM_Y.push + 1.6, SYSTEM_Y.pull - 1.6]

    labels.forEach((txt, i) => {
      const cv = document.createElement('canvas')
      cv.width = 320; cv.height = 52
      const ctx = cv.getContext('2d')
      ctx.fillStyle = colors[i]; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center'
      ctx.fillText(txt, 160, 36)
      const tex = new THREE.CanvasTexture(cv)
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 0.8),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      )
      lbl.position.set(-8, ys[i], 0.3)
      this.scene.add(lbl)
    })
  }

  setSpeed(s) { this.simSpeed = s }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate())
    const raw = this.clock.getDelta()
    const delta = raw * this.simSpeed
    const elapsed = this.clock.elapsedTime

    this.push.update(delta, elapsed)
    this.pull.update(delta, elapsed)

    this.throughputTimer += delta
    if (this.throughputTimer >= 10) {
      this.throughputTimer = 0
      if (this.onUpdate) {
        this.onUpdate({
          pushQueue: this.push.queueTotal,
          pullQueue: this.pull.queueTotal,
          pushCompleted: this.push.completed,
          pullCompleted: this.pull.completed,
          pushThroughput: +(this.push.recentCompleted / 10).toFixed(1),
          pullThroughput: +(this.pull.recentCompleted / 10).toFixed(1),
        })
        this.push.recentCompleted = 0
        this.pull.recentCompleted = 0
      }
    } else if (this.onUpdate) {
      this.onUpdate({
        pushQueue: this.push.queueTotal,
        pullQueue: this.pull.queueTotal,
        pushCompleted: this.push.completed,
        pullCompleted: this.pull.completed,
        pushThroughput: null,
        pullThroughput: null,
      })
    }

    // Camera gentle sway
    this.camera.position.x = Math.sin(elapsed * 0.07) * 0.8
    this.camera.lookAt(0, 0, 0)

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
    this.push.dispose()
    this.pull.dispose()
    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
