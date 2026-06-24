import {
  N, SPREAD_LIMIT, TMIN, TMAX, VMAX, VMIN,
  TRAIL_GAP_OPEN, TRAIL_GAP_REGROUP,
} from './herbieSim.types';
import type { ScoutState, HikeState, HikeStats, HikeToggles, Rng } from './herbieSim.types';

export type { ScoutState, HikeState, HikeStats, HikeToggles, Rng };
export { N, SPREAD_LIMIT, TMIN, TMAX, VMAX, VMIN, TRAIL_GAP_OPEN, TRAIL_GAP_REGROUP };
export { SCOUT_SHIRTS, SCOUT_SKIN, TRAIL_CONTROL_POINTS } from './herbieSim.types';
export type { HikeSceneHandle } from './herbieSim.types';

// velocity from total weight — extracted from HTML velFromTotal
export function velFromTotal(totalKg: number): number {
  return VMAX - Math.min(1, Math.max(0, (totalKg - TMIN) / (TMAX - TMIN))) * (VMAX - VMIN);
}

// Fisher-Yates shuffle on an array of ids — extracted from HTML shuffle()
export function shuffleIds(ids: number[], rng: Rng): number[] {
  const out = ids.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Assign random body/pack weights to N scouts — extracted from HTML rollWeights()
export function rollWeights(rng: Rng): { scouts: ScoutState[]; herbieId: number; pool: number } {
  const bodies = Array.from({ length: N }, () => 26 + rng() * 26);
  const herbieId = (rng() * N) | 0;

  let maxOther = 0;
  const packs0 = bodies.map((body, i) => {
    if (i === herbieId) return 0; // placeholder replaced below
    const p = 3 + rng() * 11;
    maxOther = Math.max(maxOther, body + p);
    return p;
  });
  // Herbie carries the most → heaviest → slowest
  packs0[herbieId] = Math.max(8, maxOther + 12 - bodies[herbieId]);

  const pool = packs0.reduce((a, p) => a + p, 0);
  const lats = Array.from({ length: N }, () => (rng() * 2 - 1) * 0.6);

  const scouts: ScoutState[] = bodies.map((body, id) => ({
    id,
    dist: 0,
    body,
    pack0: packs0[id],
    pack: packs0[id],
    vel: velFromTotal(body + packs0[id]),
    arrivedAt: null,
    slot: -1,
    lat: lats[id],
  }));

  return { scouts, herbieId, pool };
}

// Recompute effective pack weights from shareLoad toggle (water-fill) — extracted from HTML applyWeights()
export function applyWeights(
  scouts: readonly ScoutState[],
  pool: number,
  toggles: Pick<HikeToggles, 'shareLoad'>,
): { scouts: ScoutState[]; theSlowestId: number } {
  let next: ScoutState[];

  if (toggles.shareLoad) {
    const bodies = scouts.map(s => s.body);
    let lo = Math.min(...bodies);
    let hi = Math.max(...bodies) + pool;
    for (let it = 0; it < 60; it++) {
      const W = (lo + hi) / 2;
      const sum = bodies.reduce((a, b) => a + Math.max(0, W - b), 0);
      if (sum > pool) hi = W; else lo = W;
    }
    const W = (lo + hi) / 2;
    next = scouts.map(s => {
      const pack = Math.max(0, W - s.body);
      return { ...s, pack, vel: velFromTotal(s.body + pack) };
    });
  } else {
    next = scouts.map(s => ({ ...s, pack: s.pack0, vel: velFromTotal(s.body + s.pack0) }));
  }

  const theSlowest = next.reduce((m, s) => (s.vel < m.vel ? s : m), next[0]);
  return { scouts: next, theSlowestId: theSlowest.id };
}

// Determine march order — extracted from HTML buildLine()
export function buildLine(
  baseOrder: readonly number[],
  toggles: Pick<HikeToggles, 'slowestFront'>,
  theSlowestId: number,
): number[] {
  if (!toggles.slowestFront) return baseOrder.slice();
  return [theSlowestId, ...baseOrder.filter(id => id !== theSlowestId)];
}

// Spread info for scouts still on trail — extracted from HTML trailInfo()
export function trailInfo(
  scouts: readonly ScoutState[],
  line: readonly number[],
  trailLength: number,
): { spread: number; cnt: number; frontIdx: number } {
  let mn = Infinity, mx = -Infinity, cnt = 0, frontIdx = -1;
  for (let i = 0; i < line.length; i++) {
    const s = scouts[line[i]];
    if (s.dist >= trailLength) continue;
    cnt++;
    if (frontIdx < 0) frontIdx = i;
    if (s.dist < mn) mn = s.dist;
    if (s.dist > mx) mx = s.dist;
  }
  return { spread: cnt ? mx - mn : 0, cnt, frontIdx };
}

// Reset all scout positions and counters, re-apply weights and line order — extracted from HTML startRun()
export function startRun(state: HikeState): HikeState {
  const { scouts: reweighted, theSlowestId } = applyWeights(state.scouts, state.pool, state.toggles);
  const line = buildLine(state.baseOrder, state.toggles, theSlowestId);
  const scouts = reweighted.map(s => ({ ...s, dist: 0, arrivedAt: null, slot: -1 }));
  return { ...state, scouts, line, theSlowestId, elapsed: 0, arrivedCount: 0, waiting: false, halts: 0 };
}

// Advance simulation one tick — extracted from HTML step(dt)
export function step(state: HikeState, dt: number): HikeState {
  if (!state.playing) return state;

  const { scouts, line, toggles, trailLength: L } = state;
  const GAP = toggles.regroup ? TRAIL_GAP_REGROUP : TRAIL_GAP_OPEN;

  // Mutable draft (each ScoutState is a new object from scouts.map(s=>({...s})))
  const draft = scouts.map(s => ({ ...s }));
  let elapsed = state.elapsed;
  let arrivedCount = state.arrivedCount;
  let waiting = state.waiting;
  let halts = state.halts;

  const info = trailInfo(scouts, line, L);

  // regroup rule — extracted from HTML step()
  if (toggles.regroup) {
    if (!waiting && info.cnt > 1 && info.spread > SPREAD_LIMIT) {
      waiting = true;
      halts++;
    }
    if (waiting && (info.cnt <= 1 || info.spread <= (info.cnt - 1) * GAP + 0.25)) {
      waiting = false;
    }
  } else {
    waiting = false;
  }

  if (toggles.slowestFront) {
    // single file behind the constraint — no passing
    let blockAhead = Infinity;
    for (let i = 0; i < N; i++) {
      const id = line[i];
      const s = draft[id];
      if (s.dist >= L) continue;
      let cap = blockAhead === Infinity ? L : Math.min(L, blockAhead - GAP);
      if (waiting && i === info.frontIdx) cap = Math.min(cap, s.dist);
      s.dist = Math.max(s.dist, Math.min(s.dist + s.vel * dt, cap));
      if (s.dist >= L) {
        s.dist = L; s.arrivedAt = elapsed; s.slot = arrivedCount++;
      } else {
        blockAhead = s.dist;
      }
    }
  } else if (waiting) {
    // open trail, holding to regroup: stragglers close up behind frozen leader
    const on = scouts
      .filter(s => s.dist < L)
      .sort((a, b) => b.dist - a.dist);
    const lead = on.length ? on[0].dist : 0;
    for (let r = 0; r < on.length; r++) {
      const orig = on[r];
      const s = draft[orig.id];
      const cap = Math.max(0, lead - r * GAP);
      s.dist = Math.min(r === 0 ? orig.dist : orig.dist + orig.vel * dt, cap);
      if (s.dist >= L) {
        s.dist = L; s.arrivedAt = elapsed; s.slot = arrivedCount++;
      }
    }
  } else {
    // open trail: each scout walks at own pace, faster ones pass
    for (const orig of scouts) {
      if (orig.dist >= L) continue;
      const s = draft[orig.id];
      s.dist = orig.dist + orig.vel * dt;
      if (s.dist >= L) {
        s.dist = L; s.arrivedAt = elapsed; s.slot = arrivedCount++;
      }
    }
  }

  const allIn = draft.every(s => s.dist >= L);
  if (!allIn) elapsed += dt;

  return { ...state, scouts: draft, elapsed, arrivedCount, waiting, halts };
}

// Derive HUD stats from current state — extracted from HTML refreshHUD() logic
export function computeStats(state: HikeState): HikeStats {
  let velMin = Infinity, velMax = -Infinity;
  for (const s of state.scouts) {
    if (s.vel < velMin) velMin = s.vel;
    if (s.vel > velMax) velMax = s.vel;
  }
  const { spread } = trailInfo(state.scouts, state.line, state.trailLength);
  return {
    arrivedCount: state.arrivedCount,
    spread,
    velMin,
    velMax,
    elapsed: state.elapsed,
    halts: state.halts,
    waiting: state.waiting,
  };
}

// Full new game: roll weights, shuffle order, reset all toggles — extracted from HTML newTroop()
export function newTroop(rng: Rng, trailLength: number): HikeState {
  const { scouts, herbieId, pool } = rollWeights(rng);
  const baseOrder = shuffleIds(scouts.map(s => s.id), rng);
  const toggles: HikeToggles = {
    highlight: false, slowestFront: false, inspect: false, shareLoad: false, regroup: false,
  };
  const { scouts: weighted, theSlowestId } = applyWeights(scouts, pool, toggles);
  const line = buildLine(baseOrder, toggles, theSlowestId);
  return {
    scouts: weighted.map(s => ({ ...s, dist: 0, arrivedAt: null, slot: -1 })),
    baseOrder,
    line,
    herbieId,
    pool,
    theSlowestId,
    toggles,
    elapsed: 0,
    arrivedCount: 0,
    waiting: false,
    halts: 0,
    playing: true,
    trailLength,
  };
}

// Apply a toggle change, restarting the run for active mechanics — extracted from HTML tFront/tShare/tRegroup handlers
export function setToggle(
  state: HikeState,
  key: keyof HikeToggles,
  value: boolean,
  rng: Rng,
): HikeState {
  // view-only toggles: just flip the flag, no run restart
  if (key === 'highlight' || key === 'inspect') {
    return { ...state, toggles: { ...state.toggles, [key]: value } };
  }
  // active mechanic toggles: flip flag and restart run
  const next = { ...state, toggles: { ...state.toggles, [key]: value } };
  // rng is unused here but kept in signature for consistent interface
  void rng;
  return startRun(next);
}
