// orderSorting.js — Pure order categorisation for the Kanban Pizza overlay and 3D pile.
// No React, no Three.js imports.

function sliceProgress(id, pizzas) {
  const p = pizzas.find(px => px.i === id)
  if (!p) return 5  // not found = delivered
  return p.stage + (p.state === 'working' ? 0.5 : 0)
}

function orderScore(order, pizzas) {
  const total = order.sliceIds.reduce((s, id) => s + sliceProgress(id, pizzas), 0)
  return total / (order.size * 5)
}

/**
 * Orders waiting to start — all assigned slices still at Cut (stage 0).
 * Excludes the forming currentOrder (shown separately as a dashed card in the overlay).
 * @param {object[]} orders
 * @param {object[]} pizzas  - simState.pizzas (non-delivered slices only)
 * @param {object|null} currentOrder
 * @param {Set<number>} dismissedIds
 * @returns {object[]} sorted ascending by id (oldest first)
 */
export function getBacklogOrders(orders, pizzas, currentOrder, dismissedIds) {
  return orders
    .filter(o => {
      if (dismissedIds.has(o.id) || o.fulfilled >= o.size || o.fulfilled > 0) return false
      if (currentOrder && o.id === currentOrder.id) return false
      return o.sliceIds.every(id => {
        const p = pizzas.find(px => px.i === id)
        return p && p.stage === 0 && p.state === 'queue'
      })
    })
    .sort((a, b) => a.id - b.id)
}

/**
 * Orders with at least one slice past Cut — not backlog, not done.
 * @param {object[]} orders
 * @param {object[]} pizzas
 * @param {Set<number>} backlogIds  - id set from getBacklogOrders result
 * @param {Set<number>} dismissedIds
 * @returns {object[]} sorted least→most progressed (least critical first)
 */
export function getDoingOrders(orders, pizzas, backlogIds, dismissedIds) {
  return orders
    .filter(o =>
      !dismissedIds.has(o.id) &&
      o.fulfilled < o.size &&
      !backlogIds.has(o.id)
    )
    .sort((a, b) => orderScore(b, pizzas) - orderScore(a, pizzas))
}

/**
 * Orders fully delivered (fulfilled >= size), not yet dismissed from view.
 * @param {object[]} orders
 * @param {Set<number>} dismissedIds
 * @returns {object[]} sorted ascending by id
 */
export function getDoneOrders(orders, dismissedIds) {
  return orders
    .filter(o => !dismissedIds.has(o.id) && o.fulfilled >= o.size)
    .sort((a, b) => a.id - b.id)
}
