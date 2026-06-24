import { describe, it, expect } from 'vitest'
import { getBacklogOrders, getDoingOrders, getDoneOrders } from '../../pizza/orderSorting.js'

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makeOrder(id, size, sliceIds, fulfilled = 0) {
  return { id, size, sliceIds, fulfilled }
}

function makePizza(id, stage, state = 'queue') {
  return { i: id, stage, state, born: 0, reached: 0, prog: 0 }
}

const NO_DISMISSED = new Set()

// ---------------------------------------------------------------------------
// getBacklogOrders
// ---------------------------------------------------------------------------

describe('getBacklogOrders', () => {
  it('returns an order whose slices are all at stage 0', () => {
    const orders = [makeOrder(0, 1, [0])]
    const pizzas = [makePizza(0, 0)]

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(0)
  })

  it('excludes an order with a slice at stage 1 (past Cut)', () => {
    const orders = [makeOrder(0, 2, [0, 1])]
    const pizzas = [makePizza(0, 0), makePizza(1, 1)]

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('excludes an order whose slice is being worked on by the Cut cooker (state=working)', () => {
    const orders = [makeOrder(0, 1, [0])]
    const pizzas = [makePizza(0, 0, 'working')]  // picked up by Cut worker — no longer untouched

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('excludes a fully delivered order (fulfilled >= size)', () => {
    const orders = [makeOrder(0, 1, [0], 1)]
    const pizzas = []  // slice was removed after delivery

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('excludes the forming currentOrder', () => {
    const forming = makeOrder(0, 2, [0])
    const orders = [forming]
    const pizzas = [makePizza(0, 0)]

    const result = getBacklogOrders(orders, pizzas, forming, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('excludes dismissed orders', () => {
    const orders = [makeOrder(0, 1, [0])]
    const pizzas = [makePizza(0, 0)]

    const result = getBacklogOrders(orders, pizzas, null, new Set([0]))

    expect(result).toHaveLength(0)
  })

  it('sorts by id ascending (oldest first)', () => {
    const orders = [makeOrder(2, 1, [2]), makeOrder(0, 1, [0]), makeOrder(1, 1, [1])]
    const pizzas = [makePizza(0, 0), makePizza(1, 0), makePizza(2, 0)]

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result.map(o => o.id)).toEqual([0, 1, 2])
  })

  it('includes multi-slice orders where all slices are at stage 0', () => {
    const orders = [makeOrder(0, 3, [0, 1, 2])]
    const pizzas = [makePizza(0, 0), makePizza(1, 0), makePizza(2, 0)]

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result).toHaveLength(1)
  })

  it('excludes a multi-slice order where one slice has moved past Cut', () => {
    const orders = [makeOrder(0, 3, [0, 1, 2])]
    const pizzas = [makePizza(0, 0), makePizza(1, 0), makePizza(2, 1)]

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('excludes a multi-slice order where one slice is being cut (state=working)', () => {
    const orders = [makeOrder(0, 3, [0, 1, 2])]
    const pizzas = [makePizza(0, 0, 'queue'), makePizza(1, 0, 'queue'), makePizza(2, 0, 'working')]

    const result = getBacklogOrders(orders, pizzas, null, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// getDoingOrders
// ---------------------------------------------------------------------------

describe('getDoingOrders', () => {
  it('returns an order with a slice past Cut', () => {
    const orders = [makeOrder(0, 2, [0, 1])]
    const pizzas = [makePizza(0, 0), makePizza(1, 1)]
    const backlogIds = new Set()

    const result = getDoingOrders(orders, pizzas, backlogIds, NO_DISMISSED)

    expect(result).toHaveLength(1)
  })

  it('excludes orders present in backlogIds', () => {
    const orders = [makeOrder(0, 1, [0])]
    const pizzas = [makePizza(0, 0)]
    const backlogIds = new Set([0])

    const result = getDoingOrders(orders, pizzas, backlogIds, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('excludes dismissed orders', () => {
    const orders = [makeOrder(0, 2, [0, 1])]
    const pizzas = [makePizza(0, 1), makePizza(1, 2)]

    const result = getDoingOrders(orders, pizzas, new Set(), new Set([0]))

    expect(result).toHaveLength(0)
  })

  it('excludes fully fulfilled orders', () => {
    const orders = [makeOrder(0, 1, [0], 1)]
    const pizzas = []

    const result = getDoingOrders(orders, pizzas, new Set(), NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('sorts most-progressed first (closest to delivery = highest priority)', () => {
    // order 0: slice at sauce (stage 1) — less done
    // order 1: slice at top   (stage 2) — more done, higher priority
    const orders = [makeOrder(0, 1, [0]), makeOrder(1, 1, [1])]
    const pizzas = [makePizza(0, 1), makePizza(1, 2)]

    const result = getDoingOrders(orders, pizzas, new Set(), NO_DISMISSED)

    expect(result.map(o => o.id)).toEqual([1, 0])
  })
})

// ---------------------------------------------------------------------------
// getDoneOrders
// ---------------------------------------------------------------------------

describe('getDoneOrders', () => {
  it('returns a fully fulfilled order', () => {
    const orders = [makeOrder(0, 1, [0], 1)]

    const result = getDoneOrders(orders, NO_DISMISSED)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(0)
  })

  it('excludes unfulfilled orders', () => {
    const orders = [makeOrder(0, 2, [0, 1], 1)]  // 1 of 2 done

    const result = getDoneOrders(orders, NO_DISMISSED)

    expect(result).toHaveLength(0)
  })

  it('excludes dismissed orders', () => {
    const orders = [makeOrder(0, 1, [0], 1)]

    const result = getDoneOrders(orders, new Set([0]))

    expect(result).toHaveLength(0)
  })

  it('sorts by id ascending', () => {
    const orders = [makeOrder(2, 1, [2], 1), makeOrder(0, 1, [0], 1), makeOrder(1, 1, [1], 1)]

    const result = getDoneOrders(orders, NO_DISMISSED)

    expect(result.map(o => o.id)).toEqual([0, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// Integration — three lists are mutually exclusive and collectively exhaustive
// ---------------------------------------------------------------------------

describe('getBacklogOrders + getDoingOrders + getDoneOrders together', () => {
  it('partitions all non-dismissed orders without overlap or gaps', () => {
    const currentOrder = makeOrder(3, 2, [3])  // forming — excluded from backlog

    const orders = [
      makeOrder(0, 1, [0]),         // all slices at stage 0 → backlog
      makeOrder(1, 2, [1, 2], 0),   // one slice at stage 1 → doing
      makeOrder(2, 1, [5], 1),      // delivered → done
      currentOrder,                  // forming → excluded from backlog, included in doing
    ]

    const pizzas = [
      makePizza(0, 0),   // order 0 — in cut buffer
      makePizza(1, 0),   // order 1 — slice 1 in cut buffer
      makePizza(2, 1),   // order 1 — slice 2 past cut → order 1 goes to doing
      makePizza(3, 0),   // currentOrder — still at cut
      // pizza 5 (order 2) not present — delivered
    ]

    const backlog = getBacklogOrders(orders, pizzas, currentOrder, NO_DISMISSED)
    const backlogIds = new Set(backlog.map(o => o.id))
    const doing = getDoingOrders(orders, pizzas, backlogIds, NO_DISMISSED)
    const done = getDoneOrders(orders, NO_DISMISSED)

    const allIds = [...backlog, ...doing, ...done].map(o => o.id).sort((a, b) => a - b)
    // order 3 (currentOrder) is excluded from backlog but included in doing
    expect(allIds).toEqual([0, 1, 2, 3])

    // no order appears in more than one list
    const backlogSet = new Set(backlog.map(o => o.id))
    const doingSet = new Set(doing.map(o => o.id))
    const doneSet = new Set(done.map(o => o.id))
    expect([...backlogSet].some(id => doingSet.has(id))).toBe(false)
    expect([...backlogSet].some(id => doneSet.has(id))).toBe(false)
    expect([...doingSet].some(id => doneSet.has(id))).toBe(false)
  })
})
