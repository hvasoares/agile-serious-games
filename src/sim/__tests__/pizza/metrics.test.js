import { describe, it, expect } from 'vitest'
import { sliceCost, computeScore } from '../metrics.js'

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makePizza(stage, state = 'queue') {
  return { i: 0, stage, state, born: 0, reached: 0, prog: 0 }
}

// ---------------------------------------------------------------------------
// sliceCost
// ---------------------------------------------------------------------------

describe('sliceCost', () => {
  it('returns 0 for a slice at stage 0 (not yet cut)', () => {
    expect(sliceCost(makePizza(0))).toBe(0)
  })

  it('returns 0 for a stage-0 slice being worked on by the Cut cooker', () => {
    expect(sliceCost(makePizza(0, 'working'))).toBe(0)
  })

  it('returns 4 for a slice at stage 1 (cut done, in Sauce queue)', () => {
    expect(sliceCost(makePizza(1))).toBe(4)
  })

  it('returns 5 for a slice at stage 2 (sauce applied, in Top queue)', () => {
    expect(sliceCost(makePizza(2))).toBe(5)
  })

  it('returns 6 for a slice at stage 3 (toppings applied, baking)', () => {
    expect(sliceCost(makePizza(3))).toBe(6)
  })

  it('returns 6 for a slice at stage 4 (baked, waiting to be delivered)', () => {
    expect(sliceCost(makePizza(4))).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// computeScore
// ---------------------------------------------------------------------------

describe('computeScore', () => {
  it('returns zero profit and zero cost when nothing has happened', () => {
    const { profit, wipCost, net } = computeScore([], 0)

    expect(profit).toBe(0)
    expect(wipCost).toBe(0)
    expect(net).toBe(0)
  })

  it('adds 10 profit per delivered slice', () => {
    const { profit } = computeScore([], 3)

    expect(profit).toBe(30)
  })

  it('accumulates WIP cost across multiple live slices', () => {
    const pizzas = [
      makePizza(1),  // cut: 4
      makePizza(2),  // cut + sauce: 5
      makePizza(3),  // cut + sauce + top: 6
    ]

    const { wipCost } = computeScore(pizzas, 0)

    expect(wipCost).toBe(15)
  })

  it('net = profit - wipCost', () => {
    const pizzas = [makePizza(2)]  // wipCost = 5

    const { profit, wipCost, net } = computeScore(pizzas, 2)  // profit = 20

    expect(profit).toBe(20)
    expect(wipCost).toBe(5)
    expect(net).toBe(15)
  })

  it('net is negative when WIP cost exceeds delivered profit', () => {
    const pizzas = [makePizza(3), makePizza(3)]  // wipCost = 12

    const { net } = computeScore(pizzas, 0)

    expect(net).toBe(-12)
  })

  it('stage-0 slices do not contribute to wipCost', () => {
    const pizzas = [makePizza(0), makePizza(0, 'working')]

    const { wipCost } = computeScore(pizzas, 0)

    expect(wipCost).toBe(0)
  })

  it('mixed state: some delivered, some WIP at various stages', () => {
    const pizzas = [
      makePizza(0),  // 0
      makePizza(1),  // 4
      makePizza(3),  // 6
    ]

    const { profit, wipCost, net } = computeScore(pizzas, 4)  // 40 profit

    expect(profit).toBe(40)
    expect(wipCost).toBe(10)
    expect(net).toBe(30)
  })
})
