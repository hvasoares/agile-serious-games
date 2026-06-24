export const UNIT   = 2    // 1 unit = 2 000 ms = 2 seconds
export const TIME_LIMIT = 60  // seconds per run
export const BAKE_X = 3

export const SPAWN_INTERVAL = UNIT / 5

export const STATION_DURATIONS = {
  cut:     3 * UNIT / 20,
  sauce:   3 * UNIT / 10,
  top:     UNIT / 2,
  bake:    UNIT * BAKE_X,
  deliver: 0,           // instantaneous — gated by isOrderReadyToDeliver
}

/**
 * Returns true when every slice of the order is at the deliver stage (stage >= 4)
 * or has already been delivered (absent from the pizzas array).
 * Used as the gate before a slice may enter the deliver cooker.
 *
 * @param {number}   orderId
 * @param {object[]} orders  - array of { id, sliceIds: number[] }
 * @param {object[]} pizzas  - live slices with up-to-date stage values
 * @returns {boolean}
 */
export function isOrderReadyToDeliver(orderId, orders, pizzas) {
  const order = orders.find(o => o.id === orderId)
  if (!order) return false
  return order.sliceIds.every(sliceId => {
    const p = pizzas.find(px => px.i === sliceId)
    return !p || p.stage >= 4  // absent = already delivered; present = must be at deliver
  })
}
