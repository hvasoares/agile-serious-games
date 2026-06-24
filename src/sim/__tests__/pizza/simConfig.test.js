import { describe, it, expect } from 'vitest'
import {
  UNIT,
  BAKE_X,
  SPAWN_INTERVAL,
  STATION_DURATIONS,
  isOrderReadyToDeliver,
} from '../../pizza/simConfig.js'

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

describe('UNIT', () => {
  it('is 2 seconds (2 000 ms)', () => {
    expect(UNIT).toBe(2)
  })
})

describe('BAKE_X', () => {
  it('is 3', () => {
    expect(BAKE_X).toBe(3)
  })
})

describe('SPAWN_INTERVAL', () => {
  it('equals UNIT / 5 = 0.4 s (UNIT = 2)', () => {
    expect(SPAWN_INTERVAL).toBeCloseTo(0.4)
  })
})

describe('STATION_DURATIONS', () => {
  it('cut = 3·UNIT/20 = 0.3 s', () => {
    expect(STATION_DURATIONS.cut).toBeCloseTo(0.3)
  })

  it('sauce = 3·UNIT/10 = 0.6 s — a little bit slower than cut', () => {
    expect(STATION_DURATIONS.sauce).toBeCloseTo(0.6)
  })

  it('top = UNIT / 2 = 1.0 s', () => {
    expect(STATION_DURATIONS.top).toBeCloseTo(1.0)
  })

  it('bake = UNIT × BAKE_X = 6 s', () => {
    expect(STATION_DURATIONS.bake).toBeCloseTo(6)
  })

  it('deliver = 0 (instantaneous)', () => {
    expect(STATION_DURATIONS.deliver).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// isOrderReadyToDeliver
// ---------------------------------------------------------------------------

function makeOrder(id, sliceIds) {
  return { id, sliceIds, size: sliceIds.length, fulfilled: 0 }
}

function makePizza(i, stage) {
  return { i, stage, state: 'queue', born: 0, reached: 0, prog: 0 }
}

describe('isOrderReadyToDeliver', () => {
  it('returns true when all slices are at stage 4', () => {
    const orders = [makeOrder(0, [0, 1])]
    const pizzas = [makePizza(0, 4), makePizza(1, 4)]

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(true)
  })

  it('returns true when all slices have already been delivered (absent from pizzas)', () => {
    const orders = [makeOrder(0, [0, 1])]
    const pizzas = []  // both delivered

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(true)
  })

  it('returns true for a mixed order: one delivered + one at stage 4', () => {
    const orders = [makeOrder(0, [0, 1])]
    const pizzas = [makePizza(1, 4)]  // slice 0 delivered, slice 1 at deliver stage

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(true)
  })

  it('returns false when one slice is still at stage 3 (baking)', () => {
    const orders = [makeOrder(0, [0, 1])]
    const pizzas = [makePizza(0, 4), makePizza(1, 3)]

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(false)
  })

  it('returns false when one slice is at stage 0 (not yet cut)', () => {
    const orders = [makeOrder(0, [0, 1])]
    const pizzas = [makePizza(0, 4), makePizza(1, 0)]

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(false)
  })

  it('returns false when the order id is not found', () => {
    const orders = [makeOrder(0, [0])]
    const pizzas = [makePizza(0, 4)]

    expect(isOrderReadyToDeliver(99, orders, pizzas)).toBe(false)
  })

  it('returns true for an order with no slices (empty sliceIds)', () => {
    const orders = [makeOrder(0, [])]
    const pizzas = []

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(true)
  })

  it('handles a single-slice order at stage 4', () => {
    const orders = [makeOrder(0, [0])]
    const pizzas = [makePizza(0, 4)]

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(true)
  })

  it('handles a single-slice order not yet at deliver', () => {
    const orders = [makeOrder(0, [0])]
    const pizzas = [makePizza(0, 2)]

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(false)
  })

  it('unrelated pizzas in the array do not affect the result', () => {
    const orders = [makeOrder(0, [0])]
    const pizzas = [makePizza(0, 4), makePizza(99, 1)]  // pizza 99 belongs to another order

    expect(isOrderReadyToDeliver(0, orders, pizzas)).toBe(true)
  })
})
