import { describe, expect, it } from 'vitest'
import { DEFAULT_BEAT_ID, FIXTURE_BEATS, resolveFixtureBeat } from './fixtureBeats'

describe('resolveFixtureBeat', () => {
  it('resolves a known beat id to its fixture', () => {
    expect(resolveFixtureBeat('peak-revelry')).toBe(FIXTURE_BEATS['peak-revelry'])
  })

  it('falls back to the default beat when given null', () => {
    expect(resolveFixtureBeat(null)).toBe(FIXTURE_BEATS[DEFAULT_BEAT_ID])
  })

  it('falls back to the default beat for an unknown id', () => {
    expect(resolveFixtureBeat('not-a-real-beat')).toBe(FIXTURE_BEATS[DEFAULT_BEAT_ID])
  })

  it('has at least two distinct fixtures for testing beat-to-beat lerp', () => {
    expect(Object.keys(FIXTURE_BEATS).length).toBeGreaterThanOrEqual(2)
  })
})
