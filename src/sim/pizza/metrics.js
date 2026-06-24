// Cost of a single live (non-delivered) slice.
// Stages: 0=Cut Base, 1=Sauce, 2=Top, 3=Bake, 4=Deliver
// Costs are incurred once each operation completes (i.e. slice moved past that stage).
export function sliceCost(pizza) {
  if (pizza.stage < 1) return 0
  let cost = 4                      // cut completed
  if (pizza.stage >= 2) cost += 1  // sauce applied
  if (pizza.stage >= 3) cost += 1  // toppings applied
  return cost
}

// Compute the real-time profit/waste breakdown from simulation state.
// Delivered slices are already removed from pizzas[] — they contribute via the counter.
// @param {object[]} pizzas    - simState.pizzas (live, non-delivered slices)
// @param {number}   delivered - simState.delivered
// @returns {{ profit: number, wipCost: number, net: number }}
export function computeScore(pizzas, delivered) {
  const profit = delivered * 10
  const wipCost = pizzas.reduce((sum, p) => sum + sliceCost(p), 0)
  return { profit, wipCost, net: profit - wipCost }
}
