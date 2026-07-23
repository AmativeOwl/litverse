import { describe, expect, it } from 'vitest'
import { createSeededRandom, hashStringToSeed } from './seededRandom'

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(42)
    const sequenceA = Array.from({ length: 10 }, () => a())
    const sequenceB = Array.from({ length: 10 }, () => b())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('produces a different sequence for a different seed', () => {
    const a = createSeededRandom(1)
    const b = createSeededRandom(2)
    const sequenceA = Array.from({ length: 10 }, () => a())
    const sequenceB = Array.from({ length: 10 }, () => b())
    expect(sequenceA).not.toEqual(sequenceB)
  })

  it('stays within [0, 1)', () => {
    const random = createSeededRandom(7)
    for (let i = 0; i < 1000; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('advances state between calls rather than returning a constant', () => {
    const random = createSeededRandom(123)
    const first = random()
    const second = random()
    expect(first).not.toBe(second)
  })
})

describe('hashStringToSeed', () => {
  it('is deterministic for the same input', () => {
    expect(hashStringToSeed('arrival')).toBe(hashStringToSeed('arrival'))
  })

  it('differs across different inputs', () => {
    expect(hashStringToSeed('arrival')).not.toBe(hashStringToSeed('peak-revelry'))
  })

  it('always returns a non-negative 32-bit integer', () => {
    for (const input of ['', 'a', 'litverse-crowd-layout', 'x'.repeat(200)]) {
      const hash = hashStringToSeed(input)
      expect(Number.isInteger(hash)).toBe(true)
      expect(hash).toBeGreaterThanOrEqual(0)
      expect(hash).toBeLessThanOrEqual(0xffffffff)
    }
  })
})
