import { describe, it, expect } from 'vitest'
import {
  freshSim,
  step,
  detectConstraint,
  wasteCount,
  wipCount,
  applyTocAction,
  STATION_DEFS,
  ROUND_DEFS,
  TOC_STEPS,
} from '../pizzaSim.js'

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

    it('sets station caps to [2,2,2,3,2]', () => {
      // Arrange
      const expected = [2, 2, 2, 3, 2]
      // Act
      const state = freshSim(2)
      // Assert
      state.stations.forEach((st, i) => {
        expect(st.cap).toBe(expected[i])
      })
    })
  })

  describe('round 3 (pull mode, caps=[2,2,3,3,2])', () => {
    it('returns mode pull', () => {
      const state = freshSim(3)
      expect(state.mode).toBe('pull')
    })

    it('sets station caps to [2,2,3,3,2]', () => {
      // Arrange
      const expected = [2, 2, 3, 3, 2]
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
    // Act — three steps of dt=0.7 should accumulate enough spawn timer to trigger a spawn
    state = step(state, 0.7)
    state = step(state, 0.7)
    state = step(state, 0.7)
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

  it('returns a value in range 1..4 when all buffers are empty (defaults to first downstream)', () => {
    // Arrange
    const stations = makeStations([0, 0, 0, 0, 0])
    // Act
    const idx = detectConstraint(stations)
    // Assert
    expect(idx).toBeGreaterThanOrEqual(1)
    expect(idx).toBeLessThanOrEqual(4)
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
    it('increases the constraint station slots by 1 for a non-fixedCap station', () => {
      // Arrange — build a state where the constraint is NOT station 3 (fixed)
      // Force constraint to station 1 by giving it a deep buffer
      const base = freshSim(1)
      // We'll test by placing state with a known constraint (non-fixed)
      // Use applyTocAction step 0 to identify it first, then check elevate
      const afterIdentify = applyTocAction(base, 0)
      const constraint = afterIdentify.constraint
      const originalSlots = base.stations[constraint].slots

      // Act
      const result = applyTocAction(afterIdentify, 3)

      // Assert — if the constraint is not fixedCap, slots should increase
      if (!base.stations[constraint].fixedCap) {
        expect(result.stations[constraint].slots).toBe(originalSlots + 1)
      }
    })

    it('does NOT elevate a fixedCap station (oven stays at original slots)', () => {
      // Arrange — manufacture a state where constraint === 3 (fixedCap station)
      const base = freshSim(1)
      const stateWithFixedConstraint = { ...base, constraint: 3 }
      const originalSlots = base.stations[3].slots
      // Act
      const result = applyTocAction(stateWithFixedConstraint, 3)
      // Assert
      expect(result.stations[3].slots).toBe(originalSlots)
    })

    it('sets result.tocStep to 3', () => {
      // Arrange
      const state = freshSim(1)
      // Act
      const result = applyTocAction(state, 3)
      // Assert
      expect(result.tocStep).toBe(3)
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
