import { computeScore } from './metrics.js'

/**
 * Compute a single time-series sample point from the current sim state.
 * Pure — no side effects, no React/Three.js deps.
 *
 * @param {number} t
 * @param {{ stations: object[], pizzas: object[], delivered: number, leadSum: number }} state
 * @returns {{ t: number, avgLeadTime: number, wip: number, delivered: number,
 *             profit: number, wipCost: number, score: number }}
 */
export function sampleChartPoint(t, { stations, pizzas, delivered, leadSum }) {
  const wip = stations.reduce((s, st) => s + st.occupants.length, 0)
  const avgLeadTime = delivered > 0 ? leadSum / delivered : 0
  const { profit, wipCost, net } = computeScore(pizzas, delivered)
  return { t, avgLeadTime, wip, delivered, profit, wipCost, score: net }
}
