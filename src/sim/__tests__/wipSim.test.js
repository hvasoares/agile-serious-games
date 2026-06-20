import { describe, it, expect } from 'vitest'
import { canAdvance, isOverLimit, avgCycleTime } from '../wipSim.js'

describe('canAdvance', () => {
  it('allows advance when count is below limit', () => {
    expect(canAdvance([Infinity, 3, 2, Infinity], 1, 2)).toBe(true)
  })

  it('blocks advance when count equals limit', () => {
    expect(canAdvance([Infinity, 3, 2, Infinity], 1, 3)).toBe(false)
  })

  it('blocks advance when count exceeds limit', () => {
    expect(canAdvance([Infinity, 3, 2, Infinity], 1, 5)).toBe(false)
  })

  it('always allows advance when limit is Infinity', () => {
    expect(canAdvance([Infinity, 3, 2, Infinity], 0, 100)).toBe(true)
  })

  it('allows advance when limit is exactly one above count', () => {
    expect(canAdvance([Infinity, 3, 2, Infinity], 2, 1)).toBe(true)
  })
})

describe('isOverLimit', () => {
  it('returns true when count exceeds limit', () => {
    expect(isOverLimit([Infinity, 3, 2, Infinity], 1, 4)).toBe(true)
  })

  it('returns false when count equals limit', () => {
    expect(isOverLimit([Infinity, 3, 2, Infinity], 1, 3)).toBe(false)
  })

  it('returns false when count is below limit', () => {
    expect(isOverLimit([Infinity, 3, 2, Infinity], 1, 2)).toBe(false)
  })

  it('returns false when limit is Infinity', () => {
    expect(isOverLimit([Infinity, 3, 2, Infinity], 0, 999)).toBe(false)
  })
})

describe('avgCycleTime', () => {
  it('returns dash when no completions', () => {
    expect(avgCycleTime(0, 0)).toBe('—')
  })

  it('computes average to one decimal place', () => {
    expect(avgCycleTime(30, 3)).toBe('10.0')
  })

  it('rounds fractional averages correctly', () => {
    expect(avgCycleTime(10, 3)).toBe('3.3')
  })

  it('handles a single completion', () => {
    expect(avgCycleTime(7.5, 1)).toBe('7.5')
  })
})
