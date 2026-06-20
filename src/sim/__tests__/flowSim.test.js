import { describe, it, expect } from 'vitest'
import { pipelineQueueTotal, spawnWork, processStages } from '../flowSim.js'

describe('pipelineQueueTotal', () => {
  it('sums queued and in-flight items across all stages', () => {
    const stages = [
      { queue: [1, 2], current: { id: 0 } },
      { queue: [], current: null },
      { queue: [1], current: { id: 3 } },
    ]
    expect(pipelineQueueTotal(stages)).toBe(5)
  })

  it('returns 0 for an empty pipeline', () => {
    const stages = [
      { queue: [], current: null },
      { queue: [], current: null },
    ]
    expect(pipelineQueueTotal(stages)).toBe(0)
  })

  it('counts in-flight item without queue items', () => {
    const stages = [{ queue: [], current: {} }]
    expect(pipelineQueueTotal(stages)).toBe(1)
  })
})

describe('spawnWork', () => {
  const makeStage = (qLen = 0, hasCurrent = false) => ({
    queue: Array.from({ length: qLen }, (_, i) => ({ id: i })),
    current: hasCurrent ? {} : null,
  })

  it('does not spawn before interval elapses', () => {
    const stages = [makeStage()]
    const result = spawnWork(stages, 1.0, 2.0, 'push')
    expect(result.spawned).toBe(false)
    expect(result.timer).toBe(1.0)
    expect(stages[0].queue).toHaveLength(0)
  })

  it('spawns push work when interval elapses', () => {
    const stages = [makeStage()]
    const result = spawnWork(stages, 2.1, 2.0, 'push')
    expect(result.spawned).toBe(true)
    expect(result.timer).toBe(0)
    expect(stages[0].queue).toHaveLength(1)
  })

  it('push skips spawn when queue is at capacity (>= 12)', () => {
    const stages = [makeStage(12)]
    const result = spawnWork(stages, 2.1, 2.0, 'push')
    expect(result.spawned).toBe(false)
    expect(result.timer).toBe(0)
    expect(stages[0].queue).toHaveLength(12)
  })

  it('pull spawns when stage 0 has capacity', () => {
    const stages = [makeStage(0, false)]
    const result = spawnWork(stages, 3.6, 3.5, 'pull')
    expect(result.spawned).toBe(true)
    expect(result.timer).toBe(0)
    expect(stages[0].queue).toHaveLength(1)
  })

  it('pull applies back-pressure when stage 0 queue is full', () => {
    const stages = [makeStage(3, false)]
    const result = spawnWork(stages, 3.6, 3.5, 'pull')
    expect(result.spawned).toBe(false)
    expect(result.timer).toBeCloseTo(3.5 * 0.6)
  })

  it('pull applies back-pressure when stage 0 is busy', () => {
    const stages = [makeStage(0, true)]
    const result = spawnWork(stages, 3.6, 3.5, 'pull')
    expect(result.spawned).toBe(false)
    expect(result.timer).toBeCloseTo(3.5 * 0.6)
  })
})

describe('processStages', () => {
  const makeStages = (count) =>
    Array.from({ length: count }, () => ({ queue: [], current: null, timer: 0, baseTime: 5 }))

  it('completes work at the last stage', () => {
    const stages = makeStages(3)
    stages[2].current = {}
    stages[2].timer = 4.9
    const completed = processStages(stages, 0.2, 'push')
    expect(completed).toBe(1)
    expect(stages[2].current).toBeNull()
  })

  it('returns 0 when no work finishes this tick', () => {
    const stages = makeStages(3)
    stages[0].current = {}
    stages[0].timer = 1.0
    const completed = processStages(stages, 0.1, 'push')
    expect(completed).toBe(0)
  })

  it('pull blocks inter-stage advance when next queue is at limit (4)', () => {
    const stages = makeStages(3)
    stages[0].current = {}
    stages[0].timer = 5
    stages[1].current = {}
    stages[1].queue = Array.from({ length: 4 }, () => ({}))
    processStages(stages, 0.1, 'pull')
    expect(stages[0].current).not.toBeNull()
  })

  it('push allows inter-stage advance when next queue is below 20', () => {
    const stages = makeStages(3)
    stages[0].current = {}
    stages[0].timer = 5
    stages[1].current = {}
    stages[1].queue = Array.from({ length: 4 }, () => ({}))
    processStages(stages, 0.1, 'push')
    expect(stages[0].current).toBeNull()
    expect(stages[1].queue).toHaveLength(5)
  })

  it('picks up queued work immediately when station becomes free', () => {
    const stages = makeStages(2)
    stages[0].queue.push({ id: 1 })
    processStages(stages, 0.1, 'push')
    expect(stages[0].current).toEqual({ id: 1 })
    expect(stages[0].queue).toHaveLength(0)
  })
})
