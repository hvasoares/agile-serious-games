import { describe, it, expect } from 'vitest'
import { effectiveTime, processStations } from '../bottleneckSim.js'

describe('effectiveTime', () => {
  it('returns base time unchanged at level 0', () => {
    expect(effectiveTime(4, 0)).toBe(4)
  })

  it('reduces by 40% at upgrade level 1', () => {
    expect(effectiveTime(4, 1)).toBeCloseTo(2.4)
  })

  it('reduces by 64% at upgrade level 2', () => {
    expect(effectiveTime(4, 2)).toBeCloseTo(1.44)
  })

  it('applies compound reduction across levels', () => {
    expect(effectiveTime(10, 2)).toBeCloseTo(3.6)
  })
})

describe('processStations', () => {
  const makeStations = (count) =>
    Array.from({ length: count }, () => ({ queue: [], current: null, timer: 0 }))

  const constantTime = () => 5

  it('picks up work from queue when station is idle', () => {
    const stations = makeStations(2)
    stations[0].queue.push({ id: 1 })
    processStations(stations, 0.1, constantTime)
    expect(stations[0].current).toEqual({ id: 1 })
  })

  it('moves completed work from one station to the next', () => {
    const stations = makeStations(2)
    stations[0].current = { id: 1 }
    stations[0].timer = 4.9
    processStations(stations, 0.2, constantTime)
    expect(stations[0].current).toBeNull()
    expect(stations[1].current).toEqual({ id: 1 })
  })

  it('completes work at the last station and returns count', () => {
    const stations = makeStations(2)
    stations[1].current = { id: 1 }
    stations[1].timer = 4.9
    const completed = processStations(stations, 0.2, constantTime)
    expect(completed).toBe(1)
    expect(stations[1].current).toBeNull()
  })

  it('returns 0 when no work finishes this tick', () => {
    const stations = makeStations(2)
    stations[0].current = { id: 1 }
    stations[0].timer = 1.0
    const completed = processStations(stations, 0.1, constantTime)
    expect(completed).toBe(0)
  })

  it('blocks advance when next station queue is at capacity', () => {
    const stations = makeStations(2)
    stations[0].current = { id: 99 }
    stations[0].timer = 5
    stations[1].current = { id: 0 }
    stations[1].queue = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }))
    processStations(stations, 0.1, constantTime)
    expect(stations[0].current).toEqual({ id: 99 })
    expect(stations[1].queue).toHaveLength(20)
  })

  it('uses the getEffectiveTime callback for each station index', () => {
    const stations = makeStations(2)
    stations[0].current = { id: 1 }
    stations[0].timer = 1.9
    const perStation = (i) => (i === 0 ? 2 : 5)
    processStations(stations, 0.2, perStation)
    expect(stations[0].current).toBeNull()
  })
})
