import * as THREE from 'three';
import type { PaddleSize } from '../../sim/red-bead/redBeadSim.types';

export interface RedBeadSceneState {
  binFrac: number;
  paddleSize: PaddleSize;
  lastTrueReds: number | null;
  animating: boolean;
}

export interface RedBeadSceneHandle {
  setState(state: RedBeadSceneState): void;
  triggerPull(trueReds: number, onComplete: () => void): void;
  dispose(): void;
}

const BIN_W = 14, BIN_D = 9, BIN_H = 5;
const GRID: Record<PaddleSize, [number, number]> = { 50: [5, 10], 25: [5, 5], 10: [2, 5] };

export function createRedBeadScene(canvas: HTMLCanvasElement): RedBeadSceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f15);
  scene.fog = new THREE.Fog(0x0a0f15, 34, 64);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  // ── Orbit ─────────────────────────────────────────────────────────────────
  const target = new THREE.Vector3(0, 2.2, 0);
  let azimuth = 0.7, polar = 0.95, radius = 26;
  let autoSpin = true, dragging = false;

  function updateCamera() {
    camera.position.set(
      target.x + radius * Math.sin(polar) * Math.cos(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * Math.sin(polar) * Math.sin(azimuth),
    );
    camera.lookAt(target);
  }
  updateCamera();

  // ── Lights ────────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
  keyLight.position.set(9, 18, 11);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x8fb4ff, 0.3);
  fillLight.position.set(-12, 7, -9);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffd9a0, 0.25);
  rimLight.position.set(0, 5, -14);
  scene.add(rimLight);

  // ── Disposable tracking ───────────────────────────────────────────────────
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  function geo<G extends THREE.BufferGeometry>(g: G): G { geometries.push(g); return g; }
  function mat<M extends THREE.Material>(m: M): M { materials.push(m); return m; }

  // ── Table ─────────────────────────────────────────────────────────────────
  const table = new THREE.Mesh(
    geo(new THREE.BoxGeometry(60, 0.5, 60)),
    mat(new THREE.MeshStandardMaterial({ color: 0x0c1219, roughness: 0.95 })),
  );
  table.position.y = -0.45;
  scene.add(table);

  // ── Bin ───────────────────────────────────────────────────────────────────
  const binGroup = new THREE.Group();
  const binFloor = new THREE.Mesh(
    geo(new THREE.BoxGeometry(BIN_W, 0.4, BIN_D)),
    mat(new THREE.MeshStandardMaterial({ color: 0x16222e, roughness: 0.7, metalness: 0.1 })),
  );
  binFloor.position.y = -0.2;
  binGroup.add(binFloor);

  const wallMat = mat(new THREE.MeshStandardMaterial({
    color: 0x3a5d7a, transparent: true, opacity: 0.18,
    roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide,
  }));
  const WALL_T = 0.25;

  function addWall(w: number, h: number, d: number, x: number, y: number, z: number) {
    const m = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), wallMat);
    m.position.set(x, y, z);
    binGroup.add(m);
  }
  addWall(BIN_W, BIN_H, WALL_T, 0, BIN_H / 2, -BIN_D / 2);
  addWall(BIN_W, BIN_H, WALL_T, 0, BIN_H / 2, BIN_D / 2);
  addWall(WALL_T, BIN_H, BIN_D, -BIN_W / 2, BIN_H / 2, 0);
  addWall(WALL_T, BIN_H, BIN_D, BIN_W / 2, BIN_H / 2, 0);

  const rimMat = mat(new THREE.MeshStandardMaterial({ color: 0x9a7c46, roughness: 0.4, metalness: 0.4 }));

  function addRim(w: number, d: number, x: number, z: number) {
    const m = new THREE.Mesh(geo(new THREE.BoxGeometry(w, 0.18, d)), rimMat);
    m.position.set(x, BIN_H, z);
    binGroup.add(m);
  }
  addRim(BIN_W + WALL_T, WALL_T, 0, -BIN_D / 2);
  addRim(BIN_W + WALL_T, WALL_T, 0, BIN_D / 2);
  addRim(WALL_T, BIN_D + WALL_T, -BIN_W / 2, 0);
  addRim(WALL_T, BIN_D + WALL_T, BIN_W / 2, 0);

  scene.add(binGroup);

  // ── Bead pool ─────────────────────────────────────────────────────────────
  const POOL_COUNT = 1700;
  const BEAD_R = 0.30;
  const poolGeo = geo(new THREE.SphereGeometry(BEAD_R, 10, 10));
  const poolMat = mat(new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 }));
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, POOL_COUNT);

  const cRed = new THREE.Color(0xd83a36);
  const cWhite = new THREE.Color(0xece4d4);
  const poolRedList: number[] = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < POOL_COUNT; i++) {
    dummy.position.set(
      (Math.random() - 0.5) * (BIN_W - 1.2),
      BEAD_R + Math.random() * 3.2,
      (Math.random() - 0.5) * (BIN_D - 1.2),
    );
    dummy.scale.setScalar(0.9 + Math.random() * 0.25);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poolMesh.setMatrixAt(i, dummy.matrix);
    const isRed = Math.random() < 0.2;
    if (isRed) poolRedList.push(i);
    poolMesh.setColorAt(i, isRed ? cRed : cWhite);
  }

  const R0 = poolRedList.length;
  poolMesh.instanceMatrix.needsUpdate = true;
  if (poolMesh.instanceColor) poolMesh.instanceColor.needsUpdate = true;
  scene.add(poolMesh);

  function syncPool(frac: number) {
    const tgt = Math.max(0, Math.min(R0, Math.round(R0 * (frac / 0.20))));
    for (let i = 0; i < R0; i++) {
      poolMesh.setColorAt(poolRedList[i], i < tgt ? cRed : cWhite);
    }
    if (poolMesh.instanceColor) poolMesh.instanceColor.needsUpdate = true;
  }

  // ── Paddle ────────────────────────────────────────────────────────────────
  const paddle = new THREE.Group();

  const boardMat = mat(new THREE.MeshStandardMaterial({ color: 0xc6a15b, roughness: 0.5, metalness: 0.15 }));
  const hndlMat = mat(new THREE.MeshStandardMaterial({ color: 0xa9853f, roughness: 0.5, metalness: 0.2 }));
  const capMat = mat(new THREE.MeshStandardMaterial({ color: 0x8a6c32, roughness: 0.5, metalness: 0.2 }));
  const sockMat = mat(new THREE.MeshStandardMaterial({ color: 0x9a7c46, roughness: 0.6, metalness: 0.2 }));

  // Board
  paddle.add(new THREE.Mesh(geo(new THREE.BoxGeometry(6.4, 0.3, 3.8)), boardMat));

  // Handle (horizontal, extends to +X like the original HTML)
  const handleMesh = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 16)), hndlMat);
  handleMesh.rotation.z = Math.PI / 2;
  handleMesh.position.set(4.6, 0, 0);
  paddle.add(handleMesh);

  // Cap
  const capMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.36, 16, 16)), capMat);
  capMesh.position.set(6.3, 0, 0);
  paddle.add(capMesh);

  // Sockets + sample beads
  const sampleSockets: THREE.Mesh[] = [];
  const sampleBeads: THREE.Mesh[] = [];
  const sampleBeadMats: THREE.MeshStandardMaterial[] = [];

  for (let i = 0; i < 50; i++) {
    const sock = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 16)), sockMat);
    paddle.add(sock);
    sampleSockets.push(sock);

    const bm = mat(new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: 0.35 }));
    sampleBeadMats.push(bm);
    const bead = new THREE.Mesh(geo(new THREE.SphereGeometry(0.30, 12, 12)), bm);
    bead.visible = false;
    paddle.add(bead);
    sampleBeads.push(bead);
  }

  let currentPaddleSize: PaddleSize = 50;
  let sampleShown = false;

  function layoutSample(size: PaddleSize) {
    currentPaddleSize = size;
    const [rows, cols] = GRID[size];
    const xSpan = Math.min(5.2, (cols - 1) * 1.05);
    const zSpan = Math.min(2.7, (rows - 1) * 0.65);
    for (let i = 0; i < 50; i++) {
      const use = i < size;
      sampleSockets[i].visible = use;
      sampleBeads[i].visible = use && sampleShown;
      if (use) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = cols > 1 ? -xSpan / 2 + (col / (cols - 1)) * xSpan : 0;
        const z = rows > 1 ? -zSpan / 2 + (row / (rows - 1)) * zSpan : 0;
        sampleSockets[i].position.set(x, 0.16, z);
        sampleBeads[i].position.set(x, 0.32, z);
      }
    }
  }
  layoutSample(50);

  function assignSampleColors(reds: number) {
    const arr: boolean[] = [];
    for (let i = 0; i < currentPaddleSize; i++) arr.push(i < reds);
    for (let j = currentPaddleSize - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
    for (let m = 0; m < currentPaddleSize; m++) {
      sampleBeadMats[m].color.setHex(arr[m] ? 0xd83a36 : 0xece4d4);
    }
  }

  function showSample(reds: number) {
    sampleShown = true;
    assignSampleColors(Math.min(reds, currentPaddleSize));
    for (let i = 0; i < currentPaddleSize; i++) sampleBeads[i].visible = true;
  }

  function hideSample() {
    sampleShown = false;
    for (let i = 0; i < 50; i++) sampleBeads[i].visible = false;
  }

  // Rest position matches the original HTML
  paddle.position.set(0, 8.5, 6.5);
  paddle.rotation.x = -0.5;
  scene.add(paddle);

  // ── Tween (step-based, from original HTML) ────────────────────────────────
  interface TweenStep {
    pos: THREE.Vector3;
    rx: number;
    dur: number;
    onArrive?: () => void;
  }
  interface Tween {
    steps: TweenStep[];
    i: number;
    t0: number;
    from: { pos: THREE.Vector3; rx: number };
  }

  let tween: Tween | null = null;

  function startTween(steps: TweenStep[]) {
    tween = {
      steps,
      i: 0,
      t0: performance.now(),
      from: { pos: paddle.position.clone(), rx: paddle.rotation.x },
    };
  }

  function updateTween(now: number) {
    if (!tween) return;
    const step = tween.steps[tween.i];
    let k = (now - tween.t0) / step.dur;
    if (k > 1) k = 1;
    const e = k * k * (3 - 2 * k); // smoothstep
    paddle.position.lerpVectors(tween.from.pos, step.pos, e);
    paddle.rotation.x = tween.from.rx + (step.rx - tween.from.rx) * e;
    if (k >= 1) {
      if (step.onArrive) step.onArrive();
      tween.i++;
      if (tween.i >= tween.steps.length) {
        tween = null;
        return;
      }
      tween.t0 = now;
      tween.from = { pos: paddle.position.clone(), rx: paddle.rotation.x };
    }
  }

  // ── Camera shake ──────────────────────────────────────────────────────────
  const shake = { mag: 0, t: 0 };

  // ── Pointer / wheel controls ──────────────────────────────────────────────
  let px = 0, py = 0;

  const onPointerDown = (e: PointerEvent) => {
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerUp = () => { dragging = false; };
  const onPointerCancel = () => { dragging = false; };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    azimuth -= (e.clientX - px) * 0.006;
    polar = Math.max(0.2, Math.min(1.45, polar - (e.clientY - py) * 0.006));
    px = e.clientX; py = e.clientY;
    updateCamera();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    radius = Math.max(14, Math.min(42, radius * (1 + Math.sign(e.deltaY) * 0.08)));
    updateCamera();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement || canvas);
  window.addEventListener('resize', resize);

  // ── RAF loop ──────────────────────────────────────────────────────────────
  let rafId = 0;
  let disposed = false;

  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const now = performance.now();
    updateTween(now);
    if (autoSpin && !dragging && !tween) azimuth += 0.0016;
    updateCamera();
    if (shake.mag > 0) {
      const el = now - shake.t;
      if (el < 430) {
        const m = shake.mag * (1 - el / 430);
        camera.position.x += (Math.random() - 0.5) * m * 2;
        camera.position.y += (Math.random() - 0.5) * m;
        camera.position.z += (Math.random() - 0.5) * m * 2;
      } else {
        shake.mag = 0;
      }
    }
    renderer.render(scene, camera);
  }

  animate();

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    setState(s: RedBeadSceneState) {
      syncPool(s.binFrac);
      if (s.paddleSize !== currentPaddleSize) layoutSample(s.paddleSize);
    },

    // Step 1 (420ms): lift up | Step 2 (560ms): dip into bin, show beads on arrive
    // Step 3 (680ms): tilt away, call onComplete on arrive  — total ≈ 1660ms
    triggerPull(trueReds: number, onComplete: () => void) {
      shake.mag = Math.min(2.4, 0.7 + 0.22 * Math.abs(trueReds));
      shake.t = performance.now();
      hideSample();
      startTween([
        { pos: new THREE.Vector3(0, 7, 0), rx: 0, dur: 420 },
        { pos: new THREE.Vector3(0, 1.7, 0), rx: 0, dur: 560, onArrive: () => showSample(trueReds) },
        { pos: new THREE.Vector3(0, 6.6, 5), rx: -0.95, dur: 680, onArrive: onComplete },
      ]);
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      renderer.dispose();
    },
  };
}
