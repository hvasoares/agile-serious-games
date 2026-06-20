export function canAdvance(wipLimits, nextColIdx, nextColCount) {
  const limit = wipLimits[nextColIdx]
  return !Number.isFinite(limit) || nextColCount < limit
}

export function isOverLimit(wipLimits, colIdx, count) {
  const limit = wipLimits[colIdx]
  return Number.isFinite(limit) && count > limit
}

export function avgCycleTime(totalCycleTime, completedCount) {
  if (completedCount === 0) return '—'
  return (totalCycleTime / completedCount).toFixed(1)
}
