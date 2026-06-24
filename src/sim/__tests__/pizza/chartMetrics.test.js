import { describe, it, expect } from 'vitest'
import { sampleChartPoint } from '../chartMetrics.js'

function makeStation({ occupants = 0, buffer = 0 } = {}) {
  return {
    occupants: Array.from({ length: occupants }, (_, i) => ({ i, stage: 1, state: 'working' })),
    buffer:    Array.from({ length: buffer    }, (_, i) => ({ i, stage: 0, state: 'queue'   })),
  }
}

function makeState({ stations = [], pizzas = [], delivered = 0, leadSum = 0 } = {}) {
  return { stations, pizzas, delivered, leadSum }
}

function makePizza(stage) {
  return { i: 0, stage, state: 'queue', born: 0, reached: 0, prog: 0 }
}

// ---------------------------------------------------------------------------
// t field
// ---------------------------------------------------------------------------

describe('sampleChartPoint — t', () => {
  it('includes the given t in the returned point', () => {
    const point = sampleChartPoint(42.5, makeState())
    expect(point.t).toBe(42.5)
  })
})

// ---------------------------------------------------------------------------
// avgLeadTime
// ---------------------------------------------------------------------------

describe('sampleChartPoint — avgLeadTime', () => {
  it('returns 0 when delivered is 0 (no divide-by-zero)', () => {
    const point = sampleChartPoint(0, makeState({ delivered: 0, leadSum: 0 }))
    expect(point.avgLeadTime).toBe(0)
  })

  it('returns 0 when delivered is 0 even with a non-zero leadSum', () => {
    const point = sampleChartPoint(0, makeState({ delivered: 0, leadSum: 99 }))
    expect(point.avgLeadTime).toBe(0)
  })

  it('returns leadSum / delivered when delivered > 0', () => {
    const point = sampleChartPoint(0, makeState({ delivered: 3, leadSum: 30 }))
    expect(point.avgLeadTime).toBe(10)
  })

  it('returns a fractional average', () => {
    const point = sampleChartPoint(0, makeState({ delivered: 2, leadSum: 7 }))
    expect(point.avgLeadTime).toBeCloseTo(3.5)
  })
})

// ---------------------------------------------------------------------------
// wip
// ---------------------------------------------------------------------------

describe('sampleChartPoint — wip', () => {
  it('returns 0 when all stations are empty', () => {
    const point = sampleChartPoint(0, makeState({ stations: [makeStation(), makeStation()] }))
    expect(point.wip).toBe(0)
  })

  it('counts only occupants, not buffer items', () => {
    const station = makeStation({ occupants: 1, buffer: 3 })
    const point = sampleChartPoint(0, makeState({ stations: [station] }))
    expect(point.wip).toBe(1)
  })

  it('sums occupants across all stations', () => {
    const stations = [
      makeStation({ occupants: 2 }),
      makeStation({ occupants: 0 }),
      makeStation({ occupants: 3 }),
    ]
    const point = sampleChartPoint(0, makeState({ stations }))
    expect(point.wip).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// score / profit / wipCost
// ---------------------------------------------------------------------------

describe('sampleChartPoint — score / profit / wipCost', () => {
  it('returns zero profit and zero wipCost when nothing has happened', () => {
    const point = sampleChartPoint(0, makeState())
    expect(point.profit).toBe(0)
    expect(point.wipCost).toBe(0)
    expect(point.score).toBe(0)
  })

  it('returns 10 profit per delivered slice', () => {
    const point = sampleChartPoint(0, makeState({ delivered: 4 }))
    expect(point.profit).toBe(40)
  })

  it('returns positive score when profit exceeds wipCost', () => {
    const point = sampleChartPoint(0, makeState({ pizzas: [makePizza(1)], delivered: 2 }))
    // profit = 20, wipCost = 4 → score = 16
    expect(point.score).toBe(16)
  })

  it('returns negative score when wipCost exceeds profit', () => {
    const pizzas = [makePizza(3), makePizza(3)]  // wipCost = 12
    const point = sampleChartPoint(0, makeState({ pizzas, delivered: 0 }))
    expect(point.score).toBe(-12)
  })

  it.each([
    [1, 4],
    [2, 5],
    [3, 6],
  ])('returns wipCost = %i for a single stage-%i slice', (stage, expectedCost) => {
    const point = sampleChartPoint(0, makeState({ pizzas: [makePizza(stage)] }))
    expect(point.wipCost).toBe(expectedCost)
  })

  it('exposes delivered on the returned point', () => {
    const point = sampleChartPoint(0, makeState({ delivered: 7 }))
    expect(point.delivered).toBe(7)
  })
})
