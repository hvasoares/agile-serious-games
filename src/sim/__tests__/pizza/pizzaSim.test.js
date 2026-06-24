import { describe, it, expect } from 'vitest'
import {
  freshSim,
  resetSimData,
  step,
  detectConstraint,
  wasteCount,
  wipCount,
  applyTocAction,
  revertTocAction,
  STATION_DEFS,
  ROUND_DEFS,
  TOC_STEPS,
} from '../pizzaSim.js'
import { SPAWN_INTERVAL } from '../simConfig.js'

// ---------------------------------------------------------------------------
// Helper — build minimal station arrays for unit testing detectConstraint,
// wasteCount, and wipCount without requiring a full sim state.
// ---------------------------------------------------------------------------
function makeStations(bufferDepths, occupantDepths = []) {
  return STATION_DEFS.map((def, i) => ({
    ...def,
    cap: 99,
    buffer: Array(bufferDepths[i] || 0)
      .fill(null)
      .map((_, j) => ({ i: j, stage: i, state: 'queue', born: 0, reached: 0, prog: 0 })),
    occupants: Array(occupantDepths[i] || 0)
      .fill(null)
      .map((_, j) => ({ i: j + 100, stage: i, state: 'working', born: 0, reached: 0, prog: 0 })),
  }))
}

// ---------------------------------------------------------------------------
// freshSim
// ---------------------------------------------------------------------------
describe('freshSim', () => {
  describe('round 1 (push mode, unconstrained caps)', () => {
    it('returns mode push', () => {
      // Arrange / Act
      const state = freshSim(1)
      // Assert
      expect(state.mode).toBe('push')
    })

    it('starts with t=0', () => {
      const state = freshSim(1)
      expect(state.t).toBe(0)
    })

    it('starts with delivered=0', () => {
      const state = freshSim(1)
      expect(state.delivered).toBe(0)
    })

    it('starts with an empty pizzas array', () => {
      const state = freshSim(1)
      expect(state.pizzas).toEqual([])
    })

    it('starts with toc=false', () => {
      const state = freshSim(1)
      expect(state.toc).toBe(false)
    })

    it('sets all station caps to 99 (unlimited) in push mode', () => {
      // Arrange
      const state = freshSim(1)
      // Assert
      state.stations.forEach((st) => {
        expect(st.cap).toBe(99)
      })
    })

    it('station[3] has fixedCap === true (oven cannot be expanded)', () => {
      const state = freshSim(1)
      expect(state.stations[3].fixedCap).toBe(true)
    })

    it('every station has the required keys from STATION_DEFS', () => {
      const state = freshSim(1)
      state.stations.forEach((st, i) => {
        const def = STATION_DEFS[i]
        expect(st).toHaveProperty('dur', def.dur)
        expect(st).toHaveProperty('slots')
        expect(st).toHaveProperty('buffer')
        expect(st).toHaveProperty('occupants')
      })
    })
  })

  describe('round 2 (pull mode, caps=[2,2,2,3,2])', () => {
    it('returns mode pull', () => {
      const state = freshSim(2)
      expect(state.mode).toBe('pull')
    })

    it('sets station caps to [2,2,2,3,6]', () => {
      // Arrange
      const expected = [2, 2, 2, 3, 6]
      // Act
      const state = freshSim(2)
      // Assert
      state.stations.forEach((st, i) => {
        expect(st.cap).toBe(expected[i])
      })
    })
  })

  describe('round 3 (pull mode, caps=[2,2,1,3,6])', () => {
    it('returns mode pull', () => {
      const state = freshSim(3)
      expect(state.mode).toBe('pull')
    })

    it('sets station caps to [2,2,1,3,6]', () => {
      // Arrange
      const expected = [2, 2, 1, 3, 6]
      // Act
      const state = freshSim(3)
      // Assert
      state.stations.forEach((st, i) => {
        expect(st.cap).toBe(expected[i])
      })
    })
  })
})

// ---------------------------------------------------------------------------
// step
// ---------------------------------------------------------------------------
describe('step', () => {
  it('returns a new object (does not return the same reference)', () => {
    // Arrange
    const state = freshSim(1)
    // Act
    const result = step(state, 0.1)
    // Assert
    expect(result).not.toBe(state)
  })

  it('does NOT mutate the input state', () => {
    // Arrange
    const state = freshSim(1)
    const frozen = JSON.stringify(state)
    // Act
    step(state, 0.7)
    // Assert
    expect(JSON.stringify(state)).toBe(frozen)
  })

  it('does NOT mutate the input state across multiple steps', () => {
    // Arrange
    let state = freshSim(1)
    const frozen = JSON.stringify(state)
    // Act — advance time through three ticks with the original reference
    step(state, 0.7)
    step(state, 0.7)
    step(state, 0.7)
    // Assert — original unchanged
    expect(JSON.stringify(state)).toBe(frozen)
  })

  it('creates at least one pizza in buffer or occupants of station[0] after enough spawn ticks', () => {
    // Arrange
    let state = freshSim(1)
    // Act — two steps of dt=0.22: first step no spawn (0.22 < 0.4),
    // second step fires a spawn (0.44 >= 0.4) and the slice stays in station[0]
    // because prog (0.22) < Cut duration (0.3).
    state = step(state, 0.22)
    state = step(state, 0.22)
    // Assert
    const station0 = state.stations[0]
    const total = station0.buffer.length + station0.occupants.length
    expect(total).toBeGreaterThanOrEqual(1)
  })

  it('delivers at least one pizza after 200 steps of dt=0.1 in push mode', () => {
    // Arrange
    let state = freshSim(1)
    // Act
    for (let i = 0; i < 200; i++) {
      state = step(state, 0.1)
    }
    // Assert
    expect(state.delivered).toBeGreaterThanOrEqual(1)
  })

  it('no station buffer ever exceeds its cap after 100 steps in pull mode (round 2)', () => {
    // Arrange
    let state = freshSim(2)
    // Act
    for (let i = 0; i < 100; i++) {
      state = step(state, 0.1)
    }
    // Assert
    state.stations.forEach((st) => {
      expect(st.buffer.length).toBeLessThanOrEqual(st.cap)
    })
  })

  it('advances t by dt each step', () => {
    // Arrange
    const state = freshSim(1)
    // Act
    const result = step(state, 0.5)
    // Assert
    expect(result.t).toBeCloseTo(0.5)
  })
})

// ---------------------------------------------------------------------------
// detectConstraint
// ---------------------------------------------------------------------------
describe('detectConstraint', () => {
  it('never returns 0 (station 0 is never the constraint)', () => {
    // Arrange — give station 0 a massive buffer
    const stations = makeStations([999, 0, 0, 0, 0])
    // Act
    const idx = detectConstraint(stations)
    // Assert
    expect(idx).not.toBe(0)
  })

  it('returns 1 when station 1 has the deepest buffer [0,3,1,0,0]', () => {
    // Arrange
    const stations = makeStations([0, 3, 1, 0, 0])
    // Act
    const idx = detectConstraint(stations)
    // Assert
    expect(idx).toBe(1)
  })

  it('returns 3 when station 3 has the deepest buffer [0,1,1,5,0]', () => {
    // Arrange
    const stations = makeStations([0, 1, 1, 5, 0])
    // Act
    const idx = detectConstraint(stations)
    // Assert
    expect(idx).toBe(3)
  })

  it('returns a value in range 1..3 when all buffers are empty (never returns deliver)', () => {
    // Arrange
    const stations = makeStations([0, 0, 0, 0, 0])
    // Act
    const idx = detectConstraint(stations)
    // Assert — deliver (index 4) is excluded; result is always 1–3
    expect(idx).toBeGreaterThanOrEqual(1)
    expect(idx).toBeLessThanOrEqual(3)
  })

  it('never returns deliver (index 4) even when deliver has the deepest buffer', () => {
    // Arrange — give deliver a massive buffer to verify it is excluded
    const stations = makeStations([0, 0, 0, 0, 999])
    // Act
    const idx = detectConstraint(stations)
    // Assert
    expect(idx).not.toBe(4)
  })

  it('returns 1 as the default when all buffers are empty', () => {
    // Arrange
    const stations = makeStations([0, 0, 0, 0, 0])
    // Act
    const idx = detectConstraint(stations)
    // Assert
    expect(idx).toBe(1)
  })

  it('returns an integer index', () => {
    // Arrange
    const stations = makeStations([0, 2, 4, 1, 0])
    // Act
    const idx = detectConstraint(stations)
    // Assert
    expect(Number.isInteger(idx)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// wasteCount
// ---------------------------------------------------------------------------
describe('wasteCount', () => {
  it('returns the sum of all buffer lengths', () => {
    // Arrange
    const stations = makeStations([2, 3, 0, 1, 0])
    // Act
    const count = wasteCount(stations)
    // Assert
    expect(count).toBe(6)
  })

  it('returns 0 when all buffers are empty', () => {
    // Arrange
    const stations = makeStations([0, 0, 0, 0, 0])
    // Act
    const count = wasteCount(stations)
    // Assert
    expect(count).toBe(0)
  })

  it('counts only buffers, ignoring occupants', () => {
    // Arrange — 2 occupants at station 0, 3 in buffer at station 1
    const stations = makeStations([0, 3, 0, 0, 0], [2, 0, 0, 0, 0])
    // Act
    const count = wasteCount(stations)
    // Assert
    expect(count).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// wipCount
// ---------------------------------------------------------------------------
describe('wipCount', () => {
  it('returns the sum of all occupant lengths', () => {
    // Arrange
    const stations = makeStations([0, 0, 0, 0, 0], [1, 2, 0, 0, 0])
    // Act
    const count = wipCount(stations)
    // Assert
    expect(count).toBe(3)
  })

  it('returns 0 when all occupants are empty', () => {
    // Arrange
    const stations = makeStations([0, 0, 0, 0, 0], [0, 0, 0, 0, 0])
    // Act
    const count = wipCount(stations)
    // Assert
    expect(count).toBe(0)
  })

  it('counts only occupants, ignoring buffers', () => {
    // Arrange — 5 items in buffers, 2 occupants at station 2
    const stations = makeStations([3, 2, 0, 0, 0], [0, 0, 2, 0, 0])
    // Act
    const count = wipCount(stations)
    // Assert
    expect(count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// applyTocAction
// ---------------------------------------------------------------------------
describe('applyTocAction', () => {
  it('does NOT mutate the input state', () => {
    // Arrange
    const state = freshSim(1)
    const frozen = JSON.stringify(state)
    // Act
    applyTocAction(state, 0)
    // Assert
    expect(JSON.stringify(state)).toBe(frozen)
  })

  describe('step 0 — Identify constraint', () => {
    it('sets result.constraint to detectConstraint(state.stations)', () => {
      // Arrange
      const state = freshSim(1)
      const expected = detectConstraint(state.stations)
      // Act
      const result = applyTocAction(state, 0)
      // Assert
      expect(result.constraint).toBe(expected)
    })

    it('sets result.tocStep to 0', () => {
      // Arrange
      const state = freshSim(1)
      // Act
      const result = applyTocAction(state, 0)
      // Assert
      expect(result.tocStep).toBe(0)
    })
  })

  describe('step 1 — Exploit constraint', () => {
    it('sets result.exploit to true', () => {
      // Arrange
      const state = freshSim(1)
      // Act
      const result = applyTocAction(state, 1)
      // Assert
      expect(result.exploit).toBe(true)
    })

    it('sets result.tocStep to 1', () => {
      // Arrange
      const state = freshSim(1)
      // Act
      const result = applyTocAction(state, 1)
      // Assert
      expect(result.tocStep).toBe(1)
    })
  })

  describe('step 2 — Subordinate everything to the constraint', () => {
    it('sets station[0].cap to 1 (throttle intake)', () => {
      // Arrange
      const state = freshSim(1)
      // Act
      const result = applyTocAction(state, 2)
      // Assert
      expect(result.stations[0].cap).toBe(1)
    })

    it('sets spawnInterval to match constraint throughput when constraint is known', () => {
      // Arrange — constraint = bake (index 3): dur=6, slots=3 → spawnInterval = 6/3 = 2.0s
      const state = { ...freshSim(3), constraint: 3 }
      // Act
      const result = applyTocAction(state, 2)
      // Assert
      expect(result.spawnInterval).toBeCloseTo(2.0)
    })

    it('leaves spawnInterval unchanged when no constraint is identified', () => {
      // Arrange
      const state = { ...freshSim(1), constraint: -1 }
      // Act
      const result = applyTocAction(state, 2)
      // Assert
      expect(result.spawnInterval).toBe(state.spawnInterval ?? SPAWN_INTERVAL)
    })

    it('sets result.tocStep to 2', () => {
      // Arrange
      const state = freshSim(1)
      // Act
      const result = applyTocAction(state, 2)
      // Assert
      expect(result.tocStep).toBe(2)
    })
  })

  describe('step 3 — Elevate the constraint', () => {
    it('increases the constraint station slots by 1', () => {
      // Arrange
      const base = freshSim(3)
      const afterIdentify = applyTocAction(base, 0)
      const constraint = afterIdentify.constraint
      const originalSlots = afterIdentify.stations[constraint].slots

      // Act
      const result = applyTocAction(afterIdentify, 3)

      // Assert — elevation always applies, including fixedCap stations (ToC overrides the slider guard)
      expect(result.stations[constraint].slots).toBe(originalSlots + 1)
    })

    it('elevates bake (fixedCap station) when it is the identified constraint', () => {
      // Arrange — force constraint to bake (index 3, fixedCap: true)
      const base = freshSim(3)
      const stateWithBakeConstraint = { ...base, constraint: 3 }
      const originalSlots = base.stations[3].slots

      // Act
      const result = applyTocAction(stateWithBakeConstraint, 3)

      // Assert — fixedCap no longer blocks ToC Elevate
      expect(result.stations[3].slots).toBe(originalSlots + 1)
      expect(result.stations[3].cap).toBe(base.stations[3].cap + 1)
    })

    it('sets result.elevated to true', () => {
      // Arrange
      const state = { ...freshSim(3), constraint: 3 }
      // Act
      const result = applyTocAction(state, 3)
      // Assert
      expect(result.elevated).toBe(true)
    })

    it('sets result.tocStep to 3', () => {
      // Arrange
      const state = freshSim(1)
      // Act
      const result = applyTocAction(state, 3)
      // Assert
      expect(result.tocStep).toBe(3)
    })

    it('updates spawnInterval to match elevated throughput when Subordinate is active', () => {
      // Arrange — Sub sets spawnInterval = 6/3 = 2.0s; Elevate should raise it to 6/4 = 1.5s
      const afterSub = applyTocAction({ ...freshSim(3), constraint: 3 }, 2)
      expect(afterSub.spawnInterval).toBeCloseTo(2.0) // Subordinate set this
      // Act
      const result = applyTocAction({ ...afterSub, subordinate: true }, 3)
      // Assert — bake now has 4 slots (dur=6), so spawnInterval = 6/4 = 1.5s
      expect(result.spawnInterval).toBeCloseTo(1.5)
    })

    it('does NOT change spawnInterval when Subordinate is not active', () => {
      // Arrange — subordinate is false (default)
      const state = { ...freshSim(3), constraint: 3 }
      const originalInterval = state.spawnInterval
      // Act
      const result = applyTocAction(state, 3)
      // Assert — spawnInterval unchanged
      expect(result.spawnInterval).toBe(originalInterval)
    })
  })

  describe('step 4 — Repeat (go back to identify)', () => {
    it('updates result.constraint to a new detectConstraint call', () => {
      // Arrange
      const state = freshSim(1)
      const expected = detectConstraint(state.stations)
      // Act
      const result = applyTocAction(state, 4)
      // Assert
      expect(result.constraint).toBe(expected)
    })

    it('resets result.exploit to false', () => {
      // Arrange — start from a state where exploit was true
      const state = { ...freshSim(1), exploit: true }
      // Act
      const result = applyTocAction(state, 4)
      // Assert
      expect(result.exploit).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Exported constants smoke tests
// ---------------------------------------------------------------------------
describe('STATION_DEFS', () => {
  it('has exactly 5 stations', () => {
    expect(STATION_DEFS).toHaveLength(5)
  })

  it('every station def has dur and slots properties', () => {
    STATION_DEFS.forEach((def) => {
      expect(def).toHaveProperty('dur')
      expect(def).toHaveProperty('slots')
    })
  })
})

describe('ROUND_DEFS', () => {
  it('has at least 3 rounds', () => {
    expect(ROUND_DEFS.length).toBeGreaterThanOrEqual(3)
  })
})

describe('TOC_STEPS', () => {
  it('has at least 5 entries (Identify, Exploit, Subordinate, Elevate, Repeat)', () => {
    expect(TOC_STEPS.length).toBeGreaterThanOrEqual(5)
  })
})

// ---------------------------------------------------------------------------
// revertTocAction
// ---------------------------------------------------------------------------
describe('revertTocAction', () => {
  it('does NOT mutate the input state', () => {
    // Arrange
    const state = applyTocAction({ ...freshSim(3), constraint: 3 }, 2)
    const frozen = JSON.stringify(state)
    // Act
    revertTocAction(state, 2)
    // Assert
    expect(JSON.stringify(state)).toBe(frozen)
  })

  describe('step 2 — undo Subordinate', () => {
    it('restores spawnInterval to SPAWN_INTERVAL', () => {
      // Arrange — apply Subordinate so spawnInterval changes
      const afterSub = applyTocAction({ ...freshSim(3), constraint: 3 }, 2)
      expect(afterSub.spawnInterval).not.toBe(SPAWN_INTERVAL) // ensure it was changed

      // Act
      const reverted = revertTocAction(afterSub, 2)

      // Assert
      expect(reverted.spawnInterval).toBe(SPAWN_INTERVAL)
    })

    it('restores station[0].cap to the round default', () => {
      // Arrange — Round 3 default cap[0] = 2
      const afterSub = applyTocAction({ ...freshSim(3), constraint: 3 }, 2)
      expect(afterSub.stations[0].cap).toBe(1) // was reduced to 1

      // Act
      const reverted = revertTocAction(afterSub, 2)

      // Assert
      expect(reverted.stations[0].cap).toBe(ROUND_DEFS[2].caps[0]) // back to 2
    })

    it('sets subordinate to false', () => {
      // Arrange
      const afterSub = applyTocAction({ ...freshSim(3), constraint: 3 }, 2)
      // Act
      const reverted = revertTocAction(afterSub, 2)
      // Assert
      expect(reverted.subordinate).toBe(false)
    })
  })

  describe('step 3 — undo Elevate', () => {
    it('decrements constraint station slots by 1', () => {
      // Arrange — elevate bake (index 3)
      const afterElev = applyTocAction({ ...freshSim(3), constraint: 3 }, 3)
      const elevatedSlots = afterElev.stations[3].slots

      // Act
      const reverted = revertTocAction(afterElev, 3)

      // Assert
      expect(reverted.stations[3].slots).toBe(elevatedSlots - 1)
    })

    it('decrements constraint station cap by 1', () => {
      // Arrange
      const afterElev = applyTocAction({ ...freshSim(3), constraint: 3 }, 3)
      const elevatedCap = afterElev.stations[3].cap

      // Act
      const reverted = revertTocAction(afterElev, 3)

      // Assert
      expect(reverted.stations[3].cap).toBe(elevatedCap - 1)
    })

    it('sets elevated to false', () => {
      // Arrange
      const afterElev = applyTocAction({ ...freshSim(3), constraint: 3 }, 3)
      // Act
      const reverted = revertTocAction(afterElev, 3)
      // Assert
      expect(reverted.elevated).toBe(false)
    })

    it('never drops slots below 1', () => {
      // Arrange — state with constraint station at minimum slots
      const base = freshSim(1)
      const stateAtMin = { ...base, constraint: 1, stations: base.stations.map((s, i) => i === 1 ? { ...s, slots: 1 } : s) }
      // Act
      const reverted = revertTocAction(stateAtMin, 3)
      // Assert
      expect(reverted.stations[1].slots).toBeGreaterThanOrEqual(1)
    })

    it('restores spawnInterval to pre-elevation rate when Subordinate is still active', () => {
      // Arrange — Sub (spawnInterval=2.0s) → Elevate (spawnInterval=1.5s)
      const afterSub = applyTocAction({ ...freshSim(3), constraint: 3 }, 2)
      const afterElev = applyTocAction({ ...afterSub, subordinate: true }, 3)
      expect(afterElev.spawnInterval).toBeCloseTo(1.5) // elevated rate

      // Act — revert Elevate while Subordinate is still on
      const reverted = revertTocAction({ ...afterElev, subordinate: true }, 3)

      // Assert — spawnInterval goes back to 3-slot bake rate: 6/3 = 2.0s
      expect(reverted.spawnInterval).toBeCloseTo(2.0)
    })
  })

  it('returns state unchanged for an unknown step index', () => {
    // Arrange
    const state = freshSim(3)
    // Act
    const result = revertTocAction(state, 99)
    // Assert — same shape (no mutation)
    expect(result.spawnInterval).toBe(state.spawnInterval)
    expect(result.subordinate).toBe(state.subordinate)
  })
})

// ---------------------------------------------------------------------------
// step — dynamic spawnInterval
// ---------------------------------------------------------------------------
describe('step — dynamic spawnInterval', () => {
  it('respects a custom spawnInterval faster than the default', () => {
    // Arrange — very fast spawn (0.01s) should fire immediately
    let state = { ...freshSim(1), spawnInterval: 0.01 }
    // Act
    state = step(state, 0.05)
    // Assert — station[0] should have at least 1 pizza after a single step
    const st0 = state.stations[0]
    expect(st0.buffer.length + st0.occupants.length).toBeGreaterThanOrEqual(1)
  })

  it('respects a custom spawnInterval much slower than the default (no spawn in short time)', () => {
    // Arrange — very slow spawn (60s), run for 1s — nothing should spawn
    let state = { ...freshSim(1), spawnInterval: 60 }
    for (let i = 0; i < 10; i++) state = step(state, 0.1)
    // Assert — no pizzas in the system
    const total = state.stations.reduce((s, st) => s + st.buffer.length + st.occupants.length, 0)
    expect(total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// step — station utilization tracking
// ---------------------------------------------------------------------------
describe('step — station utilization (busyTime / totalTime)', () => {
  it('accumulates totalTime on every station each tick', () => {
    // Arrange
    let state = freshSim(1)
    // Act — run 5 steps of dt=0.1
    for (let i = 0; i < 5; i++) state = step(state, 0.1)
    // Assert — every station has totalTime ≈ 0.5
    state.stations.forEach(st => {
      expect(st.totalTime).toBeCloseTo(0.5, 1)
    })
  })

  it('accumulates busyTime only for stations with active occupants', () => {
    // Arrange — fast spawn so a pizza gets picked up quickly
    let state = { ...freshSim(1), spawnInterval: 0.01 }
    // Run enough steps for at least one pizza to enter a station occupant slot
    for (let i = 0; i < 20; i++) state = step(state, 0.05)
    // Assert — station[0] (Cut) should have busyTime > 0
    expect(state.stations[0].busyTime).toBeGreaterThan(0)
  })

  it('busyTime never exceeds totalTime for any station', () => {
    // Arrange
    let state = freshSim(1)
    for (let i = 0; i < 100; i++) state = step(state, 0.05)
    // Assert
    state.stations.forEach(st => {
      expect(st.busyTime ?? 0).toBeLessThanOrEqual(st.totalTime ?? 0)
    })
  })
})

// ---------------------------------------------------------------------------
// step — time limit / finished flag
// ---------------------------------------------------------------------------
describe('step — time limit', () => {
  it('finished is false before the time limit', () => {
    let state = freshSim(1)
    // Run for 50s (below 60s limit)
    for (let i = 0; i < 500; i++) state = step(state, 0.1)
    expect(state.finished).toBe(false)
  })

  it('finished becomes true once t reaches timeLimit', () => {
    let state = { ...freshSim(1), timeLimit: 5 }
    for (let i = 0; i < 60; i++) state = step(state, 0.1)
    expect(state.t).toBeGreaterThanOrEqual(5)
    expect(state.finished).toBe(true)
  })

  it('freshSim initialises finished to false', () => {
    expect(freshSim(1).finished).toBe(false)
    expect(freshSim(2).finished).toBe(false)
    expect(freshSim(3).finished).toBe(false)
  })

  it('timeLimit defaults to TIME_LIMIT (60s)', () => {
    const state = freshSim(1)
    expect(state.timeLimit).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// resetSimData
// ---------------------------------------------------------------------------
describe('resetSimData', () => {
  it('resets t, delivered, pizzas, and history to zero/empty', () => {
    // Arrange — run the sim a bit to get non-zero state
    let state = freshSim(3)
    for (let i = 0; i < 50; i++) state = step(state, 0.1)
    // Act
    const r = resetSimData(state)
    // Assert
    expect(r.t).toBe(0)
    expect(r.delivered).toBe(0)
    expect(r.pizzas).toEqual([])
    expect(r.cfd).toEqual([])
    expect(r.chartHistory).toEqual([])
    expect(r.finished).toBe(false)
  })

  it('preserves toc, tocStep, constraint, and constraintHistory', () => {
    const state = { ...freshSim(3), tocStep: 2, constraint: 3, constraintHistory: [{ stationKey: 'top', at: 10 }] }
    const r = resetSimData(state)
    expect(r.toc).toBe(true)
    expect(r.tocStep).toBe(2)
    expect(r.constraint).toBe(3)
    expect(r.constraintHistory).toHaveLength(1)
  })

  it('preserves spawnInterval when subordinate is active', () => {
    const state = { ...freshSim(3), subordinate: true, spawnInterval: 2.0 }
    const r = resetSimData(state)
    expect(r.spawnInterval).toBe(2.0)
  })

  it('re-applies subordinate cap on station[0]', () => {
    const state = { ...freshSim(3), subordinate: true }
    const r = resetSimData(state)
    expect(r.stations[0].cap).toBe(1)
  })

  it('re-applies elevated slot on constraint station', () => {
    const state = { ...freshSim(3), elevated: true, constraint: 3 }
    const r = resetSimData(state)
    expect(r.stations[3].slots).toBe(STATION_DEFS[3].slots + 1)
  })

  it('all station occupants and buffers are empty after reset', () => {
    let state = freshSim(3)
    for (let i = 0; i < 100; i++) state = step(state, 0.1)
    const r = resetSimData(state)
    r.stations.forEach(st => {
      expect(st.occupants).toHaveLength(0)
      expect(st.buffer).toHaveLength(0)
    })
  })
})
