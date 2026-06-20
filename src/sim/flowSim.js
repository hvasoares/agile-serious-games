export function pipelineQueueTotal(stages) {
  return stages.reduce((s, st) => s + st.queue.length + (st.current ? 1 : 0), 0)
}

export function spawnWork(stages, spawnTimer, spawnInterval, kind) {
  if (spawnTimer < spawnInterval) return { spawned: false, timer: spawnTimer }

  const stage0 = stages[0]
  if (kind === 'pull') {
    const canAccept = stage0.queue.length < 3 && !stage0.current
    if (!canAccept) return { spawned: false, timer: spawnInterval * 0.6 }
    stage0.queue.push({})
    return { spawned: true, timer: 0 }
  }

  if (stage0.queue.length < 12) {
    stage0.queue.push({})
    return { spawned: true, timer: 0 }
  }
  return { spawned: false, timer: 0 }
}

export function processStages(stages, delta, kind) {
  const limit = kind === 'pull' ? 4 : 20
  let newlyCompleted = 0
  stages.forEach((st, i) => {
    if (!st.current && st.queue.length > 0) {
      st.current = st.queue.shift()
      st.timer = 0
    }
    if (st.current) {
      st.timer += delta
      if (st.timer >= st.baseTime) {
        if (i === stages.length - 1) {
          newlyCompleted++
          st.current = null
        } else {
          const next = stages[i + 1]
          if (next.queue.length < limit) {
            next.queue.push(st.current)
            st.current = null
          }
        }
      }
    }
  })
  return newlyCompleted
}
