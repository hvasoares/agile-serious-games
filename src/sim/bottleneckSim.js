export function effectiveTime(baseTime, upgradeLevel) {
  return baseTime * Math.pow(0.6, upgradeLevel)
}

export function processStations(stations, delta, getEffectiveTime) {
  let newlyCompleted = 0
  stations.forEach((st, i) => {
    if (!st.current && st.queue.length > 0) {
      st.current = st.queue.shift()
      st.timer = 0
    }
    if (st.current) {
      st.timer += delta
      const needed = getEffectiveTime(i)
      if (st.timer >= needed) {
        if (i === stations.length - 1) {
          newlyCompleted++
          st.current = null
        } else {
          const next = stations[i + 1]
          if (next.queue.length < 20) {
            next.queue.push(st.current)
            st.current = null
          }
        }
      }
    }
  })
  return newlyCompleted
}
