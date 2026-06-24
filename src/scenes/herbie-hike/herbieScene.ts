import * as THREE from 'three';
import {
  N, SCOUT_SHIRTS, SCOUT_SKIN, TRAIL_CONTROL_POINTS,
} from '../../sim/herbie-hike/herbieSim.types';
import type { HikeState, HikeSceneHandle } from '../../sim/herbie-hike/herbieSim.types';

interface SceneOpts {
  onHover?: (scoutId: number | null, x: number, y: number) => void;
}

export function createHerbieScene(
  canvas: HTMLCanvasElement,
  opts: SceneOpts = {},
): HikeSceneHandle {
  // ── renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xBcd3d6);
  scene.fog = new THREE.Fog(0xBcd3d6, 110, 300);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 700);

  // ── lights ────────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x4a5238, 0.85));
  const sun = new THREE.DirectionalLight(0xfff2da, 1.05);
  sun.position.set(40, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -100; sc.right = 100; sc.top = 100; sc.bottom = -100;
  sc.near = 1; sc.far = 280;
  scene.add(sun);

  // ── resource tracking ─────────────────────────────────────────────────────
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  function geo<T extends THREE.BufferGeometry>(g: T): T { geos.push(g); return g; }
  function mat<T extends THREE.Material>(m: T): T { mats.push(m); return m; }

  // ── ground ────────────────────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(500, 500)),
    mat(new THREE.MeshStandardMaterial({ color: 0x7c8a55, roughness: 1 })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── trail ─────────────────────────────────────────────────────────────────
  const pts = TRAIL_CONTROL_POINTS.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const trailCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const trailLength = trailCurve.getLength();

  const trailMesh = new THREE.Mesh(
    geo(new THREE.TubeGeometry(trailCurve, 260, 1.5, 10, false)),
    mat(new THREE.MeshStandardMaterial({ color: 0x9c7c52, roughness: 1 })),
  );
  trailMesh.scale.set(1, 0.05, 1);
  trailMesh.position.y = 0.05;
  trailMesh.receiveShadow = true;
  scene.add(trailMesh);

  const UP = new THREE.Vector3(0, 1, 0);
  const startP = trailCurve.getPointAt(0);
  const startT = trailCurve.getTangentAt(0);
  const endP = trailCurve.getPointAt(1);
  const endT = trailCurve.getTangentAt(1);
  const endRight = new THREE.Vector3().crossVectors(endT, UP).normalize();

  // ── gate label helper ─────────────────────────────────────────────────────
  function makeLabel(text: string, bg: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 110;
    const x = c.getContext('2d')!;
    const r = 22;
    x.fillStyle = bg; x.beginPath();
    x.moveTo(r, 3); x.arcTo(253, 3, 253, 107, r); x.arcTo(253, 107, 3, 107, r);
    x.arcTo(3, 107, 3, 3, r); x.arcTo(3, 3, 253, 3, r); x.closePath(); x.fill();
    x.fillStyle = '#fff';
    x.font = 'bold 52px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 58);
    const tex = mat(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      depthTest: false,
      transparent: true,
    })) as THREE.SpriteMaterial;
    const spr = new THREE.Sprite(tex);
    spr.scale.set(8.5, 3.6, 1);
    return spr;
  }

  function buildGate(P: THREE.Vector3, T: THREE.Vector3, color: number, label: string): void {
    const right = new THREE.Vector3().crossVectors(T, UP).normalize();
    const wood = mat(new THREE.MeshStandardMaterial({ color: 0x6b4d33, roughness: 1 }));
    const pg = geo(new THREE.CylinderGeometry(0.18, 0.18, 5, 8));
    const pL = new THREE.Mesh(pg, wood); const pR = new THREE.Mesh(pg, wood);
    pL.position.copy(P).addScaledVector(right, 2.6); pL.position.y = 2.5;
    pR.position.copy(P).addScaledVector(right, -2.6); pR.position.y = 2.5;
    pL.castShadow = pR.castShadow = true;
    const barMat = mat(new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    const bar = new THREE.Mesh(geo(new THREE.BoxGeometry(0.45, 1.05, 5.6)), barMat);
    bar.position.copy(P); bar.position.y = 5;
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), right);
    bar.castShadow = true;
    scene.add(pL, pR, bar);
    const lab = makeLabel(label, `#${color.toString(16).padStart(6, '0')}`);
    lab.position.copy(P); lab.position.y = 7.4;
    scene.add(lab);
  }

  buildGate(startP, startT, 0x5FA87C, 'START · A');
  buildGate(endP, endT, 0xE2643B, 'FINISH · B');

  // ── environment: trees + rocks ────────────────────────────────────────────
  function addTree(x: number, z: number, s: number): void {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(
      geo(new THREE.CylinderGeometry(0.25 * s, 0.32 * s, 1.6 * s, 6)),
      mat(new THREE.MeshStandardMaterial({ color: 0x6b4d33, roughness: 1 })),
    );
    tr.position.y = 0.8 * s; tr.castShadow = true;
    const fo = new THREE.Mesh(
      geo(new THREE.ConeGeometry(1.5 * s, 3.6 * s, 8)),
      mat(new THREE.MeshStandardMaterial({ color: 0x3f5e3f, roughness: 1 })),
    );
    fo.position.y = 3.0 * s; fo.castShadow = true;
    g.add(tr, fo); g.position.set(x, 0, z); scene.add(g);
  }

  ((): void => {
    let seed = 11;
    const rnd = (): number => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 60; i++) {
      const x = -70 + rnd() * 140;
      const z = (rnd() < 0.5 ? -1 : 1) * (16 + rnd() * 50);
      addTree(x, z, 0.7 + rnd() * 0.9);
    }
    const rockMat = mat(new THREE.MeshStandardMaterial({ color: 0x8b8b80, roughness: 1 }));
    for (let i = 0; i < 22; i++) {
      const x = -60 + rnd() * 120;
      const z = (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 40);
      const rk = new THREE.Mesh(geo(new THREE.DodecahedronGeometry(0.5 + rnd() * 0.9)), rockMat);
      rk.position.set(x, 0.2, z); rk.castShadow = rk.receiveShadow = true; scene.add(rk);
    }
  })();

  // ── scouts ────────────────────────────────────────────────────────────────
  interface ScoutParts { legL: THREE.Mesh; legR: THREE.Mesh }
  const scoutGroups: THREE.Group[] = [];
  const scoutParts: ScoutParts[] = [];

  function makeScout(shirt: number, skin: number): { group: THREE.Group; parts: ScoutParts } {
    const g = new THREE.Group();
    const matSkin = mat(new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 }));
    const matShirt = mat(new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
    const matPack = mat(new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 1 }));
    const matHat = mat(new THREE.MeshStandardMaterial({ color: 0x7a6a3c, roughness: 1 }));

    const torso = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.42, 0.5, 1.25, 10)), matShirt);
    torso.position.y = 1.55; torso.castShadow = true;
    const head = new THREE.Mesh(geo(new THREE.SphereGeometry(0.42, 16, 12)), matSkin);
    head.position.y = 2.5; head.castShadow = true;
    const hat = new THREE.Mesh(geo(new THREE.ConeGeometry(0.5, 0.45, 10)), matHat);
    hat.position.y = 2.82; hat.castShadow = true;
    const legGeo = geo(new THREE.CylinderGeometry(0.17, 0.15, 1.0, 8));
    const legL = new THREE.Mesh(legGeo, matSkin);
    const legR = new THREE.Mesh(legGeo, matSkin);
    legL.position.set(-0.2, 0.5, 0); legR.position.set(0.2, 0.5, 0);
    legL.castShadow = legR.castShadow = true;
    const pack = new THREE.Mesh(geo(new THREE.BoxGeometry(0.7, 0.9, 0.45)), matPack);
    pack.position.set(0, 1.6, -0.5); pack.castShadow = true;
    g.add(torso, head, hat, legL, legR, pack);
    g.scale.setScalar(0.8);
    return { group: g, parts: { legL, legR } };
  }

  for (let i = 0; i < N; i++) {
    const { group, parts } = makeScout(
      SCOUT_SHIRTS[i % SCOUT_SHIRTS.length],
      SCOUT_SKIN[i % SCOUT_SKIN.length],
    );
    scene.add(group);
    scoutGroups.push(group);
    scoutParts.push(parts);
  }

  // ── highlight ring ────────────────────────────────────────────────────────
  const hiGroup = new THREE.Group();
  const ring = new THREE.Mesh(
    geo(new THREE.TorusGeometry(1.15, 0.12, 8, 28)),
    mat(new THREE.MeshStandardMaterial({ color: 0xE2643B, emissive: 0x6e2a12, roughness: 0.5 })),
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.12;
  const cone = new THREE.Mesh(
    geo(new THREE.ConeGeometry(0.5, 1.0, 12)),
    mat(new THREE.MeshStandardMaterial({ color: 0xE2643B, emissive: 0x803016, roughness: 0.5 })),
  );
  cone.rotation.x = Math.PI; cone.position.y = 3.7;
  hiGroup.add(ring, cone);
  hiGroup.visible = false;
  scene.add(hiGroup);

  // ── camera orbit (private state) ──────────────────────────────────────────
  const centroid = new THREE.Vector3();
  pts.forEach(p => centroid.add(p));
  centroid.multiplyScalar(1 / pts.length);
  centroid.y = 1;

  let theta = 1.42, phi = 0.8, radius = 90;
  let dragging = false, px = 0, py = 0;

  function updateCamera(): void {
    camera.position.set(
      centroid.x + radius * Math.sin(phi) * Math.cos(theta),
      centroid.y + radius * Math.cos(phi),
      centroid.z + radius * Math.sin(phi) * Math.sin(theta),
    );
    camera.lookAt(centroid);
  }

  // ── inspect raycasting ────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let currentState: HikeState | null = null;

  // ── event handlers (same as HTML) ─────────────────────────────────────────
  function onPointerDown(e: PointerEvent): void {
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  }
  function onPointerUp(): void { dragging = false; }
  function onPointerLeave(): void { opts.onHover?.(null, 0, 0); }
  function onPointerMove(e: PointerEvent): void {
    if (dragging) {
      theta -= (e.clientX - px) * 0.006;
      phi = Math.max(0.2, Math.min(1.45, phi - (e.clientY - py) * 0.006));
      px = e.clientX; py = e.clientY;
      return;
    }
    if (!currentState?.toggles.inspect || !opts.onHover) return;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(scoutGroups, true);
    if (hits.length) {
      let o: THREE.Object3D | null = hits[0].object;
      // walk up to find the scout group
      while (o && !scoutGroups.includes(o as THREE.Group)) o = o.parent;
      if (o) {
        const idx = scoutGroups.indexOf(o as THREE.Group);
        opts.onHover(idx, e.clientX, e.clientY);
        return;
      }
    }
    opts.onHover(null, 0, 0);
  }
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    radius = Math.max(20, Math.min(170, radius * (1 + e.deltaY * 0.0012)));
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ── resize ────────────────────────────────────────────────────────────────
  const container = canvas.parentElement ?? canvas;
  const ro = new ResizeObserver(() => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const pr = renderer.getPixelRatio();
    if (
      canvas.width !== Math.floor(w * pr) ||
      canvas.height !== Math.floor(h * pr)
    ) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  });
  ro.observe(container);

  // ── scout placement helper — extracted from HTML place(s) ─────────────────
  const tmpP = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function placeScout(
    idx: number,
    dist: number,
    arrivedAt: number | null,
    slot: number,
    lat: number,
    slowestFront: boolean,
  ): void {
    const m = scoutGroups[idx];
    const { legL, legR } = scoutParts[idx];
    const L = trailLength;

    if (dist < 0) {
      // Scout is queued behind the start gate — walk up the trail approach
      const effectiveLat = lat * (slowestFront ? 0.22 : 1);
      m.position.copy(startP).addScaledVector(startT, dist);
      const rx = startT.z, rz = -startT.x, rl = Math.hypot(rx, rz) || 1;
      m.position.x += (rx / rl) * effectiveLat;
      m.position.z += (rz / rl) * effectiveLat;
      m.position.y = 0;
      m.lookAt(startP.x + startT.x * 10, 0, startP.z + startT.z * 10);
      const ph = dist * 1.5;
      const sw = Math.sin(ph) * 0.5;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      m.position.y = Math.abs(Math.sin(ph)) * 0.06;
      return;
    }

    if (dist >= L && arrivedAt !== null) {
      const col = slot % 4, row = (slot / 4) | 0;
      m.position
        .copy(endP)
        .addScaledVector(endRight, (col - 1.5) * 1.7)
        .addScaledVector(endT, 1.5 + row * 1.8);
      m.position.y = 0;
      m.lookAt(endP.x - endT.x, 0, endP.z - endT.z);
      legL.rotation.x = 0; legR.rotation.x = 0;
      return;
    }

    const u = dist / L;
    trailCurve.getPointAt(u, tmpP);
    trailCurve.getTangentAt(u, tmpT);
    const rx = tmpT.z, rz = -tmpT.x, rl = Math.hypot(rx, rz) || 1;
    const effectiveLat = lat * (slowestFront ? 0.22 : 1);
    m.position.set(tmpP.x + (rx / rl) * effectiveLat, 0, tmpP.z + (rz / rl) * effectiveLat);
    tmpLook.copy(tmpP).add(tmpT);
    m.lookAt(tmpLook.x, 0, tmpLook.z);
    const ph = dist * 1.5;
    const sw = Math.sin(ph) * 0.5;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    m.position.y = Math.abs(Math.sin(ph)) * 0.06;
  }

  // ── setState — called every RAF tick from the hook ─────────────────────────
  function setState(state: HikeState): void {
    currentState = state;
    const { scouts, toggles, theSlowestId } = state;
    const L = state.trailLength;

    for (let i = 0; i < N; i++) {
      const s = scouts[i];
      placeScout(i, s.dist, s.arrivedAt, s.slot, s.lat, toggles.slowestFront);
    }

    if (toggles.highlight) {
      hiGroup.visible = true;
      hiGroup.position.copy(scoutGroups[theSlowestId].position);
      const p = 1 + Math.sin(performance.now() * 0.005) * 0.06;
      hiGroup.scale.set(p, p, p);
      cone.position.y = 3.7 + Math.sin(performance.now() * 0.004) * 0.18;
    } else {
      hiGroup.visible = false;
    }

    void L; // trailLength used by placeScout via closure
    updateCamera();
    renderer.render(scene, camera);
  }

  // ── initial render ────────────────────────────────────────────────────────
  updateCamera();
  renderer.render(scene, camera);

  return {
    setState,
    getTrailLength: () => trailLength,
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      ro.disconnect();
      geos.forEach(g => g.dispose());
      mats.forEach(m => m.dispose());
      renderer.dispose();
    },
  };
}
