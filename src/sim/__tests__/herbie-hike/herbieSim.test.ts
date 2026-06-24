import { describe, it, expect } from 'vitest';
import {
  velFromTotal,
  shuffleIds,
  rollWeights,
  applyWeights,
  buildLine,
  trailInfo,
  step,
  computeStats,
  newTroop,
  setToggle,
  startRun,
  N, SPREAD_LIMIT, TMIN, TMAX, VMAX, VMIN, TRAIL_GAP_OPEN, TRAIL_GAP_REGROUP,
} from '../../herbie-hike/herbieSim';
import type { HikeState, Rng } from '../../herbie-hike/herbieSim';

const always = (v: number): Rng => () => v;
const seq = (vals: number[]): Rng => { let i = 0; return () => vals[i++ % vals.length]; };

const TRAIL_L = 118; // approximate, used for tests requiring a length

function freshState(rng: Rng = always(0.5)): HikeState {
  return newTroop(rng, TRAIL_L);
}

describe('velFromTotal', () => {
  it('returns VMAX at TMIN', () => {
    expect(velFromTotal(TMIN)).toBeCloseTo(VMAX);
  });

  it('returns VMIN at TMAX', () => {
    expect(velFromTotal(TMAX)).toBeCloseTo(VMIN);
  });

  it('returns midpoint velocity at mid weight', () => {
    const mid = (TMIN + TMAX) / 2;
    expect(velFromTotal(mid)).toBeCloseTo((VMAX + VMIN) / 2);
  });

  it('clamps to VMAX below TMIN', () => {
    expect(velFromTotal(TMIN - 10)).toBeCloseTo(VMAX);
  });

  it('clamps to VMIN above TMAX', () => {
    expect(velFromTotal(TMAX + 10)).toBeCloseTo(VMIN);
  });
});

describe('shuffleIds', () => {
  it('returns same elements in different order', () => {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7];
    const shuffled = shuffleIds(ids, seq([0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4]));
    expect(shuffled).toHaveLength(ids.length);
    expect(shuffled.sort((a, b) => a - b)).toEqual(ids);
  });

  it('does not mutate the input array', () => {
    const ids = [0, 1, 2, 3];
    const copy = [...ids];
    shuffleIds(ids, always(0.5));
    expect(ids).toEqual(copy);
  });
});

describe('rollWeights', () => {
  it('creates N scouts', () => {
    const { scouts } = rollWeights(always(0.5));
    expect(scouts).toHaveLength(N);
  });

  it('Herbie has the highest total weight in the troop', () => {
    const { scouts, herbieId } = rollWeights(seq([
      // body weights (N calls): 0.5 each → body = 26 + 0.5*26 = 39
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
      // herbieId pick (1 call): 0.0 → index 0
      0.0,
      // pack weights for non-herbie (N-1 calls): 0.5 each → pack0 = 3 + 0.5*11 = 8.5
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
      // lat (N calls): ignored for this test
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
    ]));
    const herbieTotal = scouts[herbieId].body + scouts[herbieId].pack0;
    for (const s of scouts) {
      if (s.id !== herbieId) {
        expect(herbieTotal).toBeGreaterThanOrEqual(s.body + s.pack0);
      }
    }
  });

  it('pool equals sum of all pack0 values', () => {
    const { scouts, pool } = rollWeights(always(0.5));
    const expected = scouts.reduce((a, s) => a + s.pack0, 0);
    expect(pool).toBeCloseTo(expected);
  });

  it('all scouts have body weight in [26, 52]', () => {
    const { scouts } = rollWeights(always(0.5));
    for (const s of scouts) {
      expect(s.body).toBeGreaterThanOrEqual(26);
      expect(s.body).toBeLessThanOrEqual(52);
    }
  });
});

describe('applyWeights without shareLoad', () => {
  it('pack equals pack0 for each scout', () => {
    const { scouts, pool } = rollWeights(always(0.5));
    const { scouts: result } = applyWeights(scouts, pool, { shareLoad: false });
    for (const s of result) {
      expect(s.pack).toBeCloseTo(scouts[s.id].pack0);
    }
  });

  it('velocity matches velFromTotal(body + pack0)', () => {
    const { scouts, pool } = rollWeights(always(0.5));
    const { scouts: result } = applyWeights(scouts, pool, { shareLoad: false });
    for (const s of result) {
      expect(s.vel).toBeCloseTo(velFromTotal(s.body + s.pack));
    }
  });
});

describe('applyWeights with shareLoad', () => {
  it('sum of all packs equals pool', () => {
    const { scouts, pool } = rollWeights(always(0.5));
    const { scouts: result } = applyWeights(scouts, pool, { shareLoad: true });
    const total = result.reduce((a, s) => a + s.pack, 0);
    expect(total).toBeCloseTo(pool, 3);
  });

  it('all total weights are within 1 kg of each other (water-fill property)', () => {
    const { scouts, pool } = rollWeights(seq([0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    const { scouts: result } = applyWeights(scouts, pool, { shareLoad: true });
    const totals = result.map(s => s.body + s.pack);
    const mx = Math.max(...totals), mn = Math.min(...totals);
    expect(mx - mn).toBeLessThan(1);
  });

  it('theSlowestId has the minimum velocity', () => {
    const { scouts, pool } = rollWeights(always(0.5));
    const { scouts: result, theSlowestId } = applyWeights(scouts, pool, { shareLoad: true });
    const slowestVel = result[theSlowestId].vel;
    for (const s of result) {
      expect(s.vel).toBeGreaterThanOrEqual(slowestVel);
    }
  });
});

describe('buildLine', () => {
  it('without slowestFront returns all N scout ids', () => {
    const baseOrder = [0, 1, 2, 3, 4, 5, 6, 7];
    const line = buildLine(baseOrder, { slowestFront: false }, 3);
    expect(line).toEqual(baseOrder);
  });

  it('with slowestFront puts slowest first', () => {
    const baseOrder = [0, 1, 2, 3, 4, 5, 6, 7];
    const theSlowestId = 5;
    const line = buildLine(baseOrder, { slowestFront: true }, theSlowestId);
    expect(line[0]).toBe(theSlowestId);
    expect(line).toHaveLength(N);
    expect(line.slice().sort((a, b) => a - b)).toEqual(baseOrder.slice().sort((a, b) => a - b));
  });
});

describe('trailInfo', () => {
  it('returns spread 0 when all scouts have arrived', () => {
    const state = freshState();
    const arrived = state.scouts.map(s => ({ ...s, dist: TRAIL_L }));
    const { spread, cnt } = trailInfo(arrived, state.line, TRAIL_L);
    expect(spread).toBe(0);
    expect(cnt).toBe(0);
  });

  it('computes spread correctly for known positions', () => {
    const state = freshState();
    const scouts = state.scouts.map((s, i) => ({ ...s, dist: i * 5 }));
    const { spread } = trailInfo(scouts, state.line, TRAIL_L);
    // min=0, max=(N-1)*5=35
    expect(spread).toBeCloseTo((N - 1) * 5);
  });
});

describe('step', () => {
  it('advances scouts by vel * dt in free walk', () => {
    const state = freshState();
    const orig0 = state.scouts[state.line[0]];
    const next = step(state, 1.0);
    // In free walk the scout advances by their velocity
    expect(next.scouts[orig0.id].dist).toBeCloseTo(orig0.dist + orig0.vel * 1.0);
  });

  it('does not advance when playing is false', () => {
    const state = { ...freshState(), playing: false };
    const next = step(state, 1.0);
    expect(next.scouts).toEqual(state.scouts);
    expect(next.elapsed).toBe(state.elapsed);
  });

  it('marks scout as arrived when dist reaches trailLength', () => {
    const state = freshState();
    // Put first scout near the end
    const nearEnd = state.scouts.map((s, i) =>
      i === state.line[0] ? { ...s, dist: TRAIL_L - 0.1 } : s,
    );
    const nearState = { ...state, scouts: nearEnd };
    const next = step(nearState, 1.0);
    expect(next.scouts[state.line[0]].arrivedAt).not.toBeNull();
    expect(next.arrivedCount).toBe(1);
  });

  it('elapsed only advances while scouts are still on trail', () => {
    const state = freshState();
    const allArrived = state.scouts.map(s => ({ ...s, dist: TRAIL_L, arrivedAt: 10, slot: 0 }));
    const done = { ...state, scouts: allArrived, arrivedCount: N, elapsed: 30 };
    const next = step(done, 1.0);
    expect(next.elapsed).toBeCloseTo(30); // no change since all in
  });

  it('with slowestFront, faster scout behind cannot advance past front scout', () => {
    const state = freshState();
    // front scout (line[0]) is slow at 10m; back scout (line[1]) is fast at 8m (behind)
    const frontId = state.line[0];
    const backId = state.line[1];
    const scouts = state.scouts.map(s => {
      if (s.id === frontId) return { ...s, dist: 10, vel: 1.0 };
      if (s.id === backId) return { ...s, dist: 8, vel: 4.0 };
      return { ...s, dist: 0 };
    });
    const withToggle = {
      ...state,
      toggles: { ...state.toggles, slowestFront: true },
      scouts,
    };
    const next = step(withToggle, 1.0);
    // Back scout must not exceed the front scout's new position
    expect(next.scouts[backId].dist).toBeLessThanOrEqual(next.scouts[frontId].dist + 0.001);
  });

  it('with regroup, triggers halt when spread exceeds SPREAD_LIMIT', () => {
    const state = freshState();
    const scouts = state.scouts.map((s, i) => ({
      ...s,
      dist: i === 0 ? SPREAD_LIMIT + 5 : 0,
    }));
    const regroupState = {
      ...state,
      scouts,
      toggles: { ...state.toggles, regroup: true },
      waiting: false,
    };
    const next = step(regroupState, 0.01);
    expect(next.waiting).toBe(true);
    expect(next.halts).toBe(1);
  });
});

describe('computeStats', () => {
  it('arrivedCount matches scouts with non-null arrivedAt', () => {
    const state = { ...freshState(), arrivedCount: 3 };
    const stats = computeStats(state);
    expect(stats.arrivedCount).toBe(3);
  });

  it('velMin and velMax bracket scout velocities', () => {
    const state = freshState();
    const stats = computeStats(state);
    for (const s of state.scouts) {
      expect(s.vel).toBeGreaterThanOrEqual(stats.velMin);
      expect(s.vel).toBeLessThanOrEqual(stats.velMax);
    }
  });

  it('spread matches trailInfo spread', () => {
    const state = freshState();
    const stats = computeStats(state);
    const { spread } = trailInfo(state.scouts, state.line, state.trailLength);
    expect(stats.spread).toBeCloseTo(spread);
  });
});

describe('newTroop', () => {
  it('returns playing true', () => {
    expect(freshState().playing).toBe(true);
  });

  it('returns all toggles false', () => {
    const { toggles } = freshState();
    expect(toggles.highlight).toBe(false);
    expect(toggles.slowestFront).toBe(false);
    expect(toggles.inspect).toBe(false);
    expect(toggles.shareLoad).toBe(false);
    expect(toggles.regroup).toBe(false);
  });

  it('scouts start staggered behind the gate — front scout at 0, rest at negative dist', () => {
    const { scouts, line } = freshState();
    for (let i = 0; i < line.length; i++) {
      expect(scouts[line[i]].dist).toBeCloseTo(-i * TRAIL_GAP_OPEN);
    }
  });

  it('trailLength is set from the argument', () => {
    const state = newTroop(always(0.5), 120);
    expect(state.trailLength).toBe(120);
  });
});

describe('setToggle', () => {
  it('highlight toggle flips without resetting scout positions', () => {
    const state = { ...freshState(), scouts: freshState().scouts.map(s => ({ ...s, dist: 10 })) };
    const next = setToggle(state, 'highlight', true, always(0.5));
    expect(next.toggles.highlight).toBe(true);
    for (const s of next.scouts) expect(s.dist).toBeCloseTo(10);
  });

  it('inspect toggle flips without resetting scout positions', () => {
    const state = { ...freshState(), scouts: freshState().scouts.map(s => ({ ...s, dist: 15 })) };
    const next = setToggle(state, 'inspect', true, always(0.5));
    expect(next.toggles.inspect).toBe(true);
    for (const s of next.scouts) expect(s.dist).toBeCloseTo(15);
  });

  it('slowestFront toggle resets scouts to staggered starts (all ≤ 0)', () => {
    const state = { ...freshState(), scouts: freshState().scouts.map(s => ({ ...s, dist: 20 })) };
    const next = setToggle(state, 'slowestFront', true, always(0.5));
    expect(next.toggles.slowestFront).toBe(true);
    for (const s of next.scouts) expect(s.dist).toBeLessThanOrEqual(0);
    expect(next.scouts[next.line[0]].dist).toBeCloseTo(0);
  });

  it('shareLoad toggle resets scouts to staggered starts (all ≤ 0)', () => {
    const state = { ...freshState(), scouts: freshState().scouts.map(s => ({ ...s, dist: 30 })) };
    const next = setToggle(state, 'shareLoad', true, always(0.5));
    expect(next.toggles.shareLoad).toBe(true);
    for (const s of next.scouts) expect(s.dist).toBeLessThanOrEqual(0);
    expect(next.scouts[next.line[0]].dist).toBeCloseTo(0);
  });

  it('regroup toggle resets scouts to staggered starts (all ≤ 0)', () => {
    const state = { ...freshState(), scouts: freshState().scouts.map(s => ({ ...s, dist: 25 })) };
    const next = setToggle(state, 'regroup', true, always(0.5));
    expect(next.toggles.regroup).toBe(true);
    for (const s of next.scouts) expect(s.dist).toBeLessThanOrEqual(0);
    expect(next.scouts[next.line[0]].dist).toBeCloseTo(0);
  });
});

describe('startRun', () => {
  it('resets elapsed and halts to 0', () => {
    const state = { ...freshState(), elapsed: 42, halts: 3 };
    const next = startRun(state);
    expect(next.elapsed).toBe(0);
    expect(next.halts).toBe(0);
  });

  it('resets scouts to staggered starts (all ≤ 0, front of line at 0)', () => {
    const state = { ...freshState(), scouts: freshState().scouts.map(s => ({ ...s, dist: 50 })) };
    const next = startRun(state);
    for (const s of next.scouts) expect(s.dist).toBeLessThanOrEqual(0);
    expect(next.scouts[next.line[0]].dist).toBeCloseTo(0);
  });
});
