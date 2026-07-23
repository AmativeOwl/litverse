/**
 * Deterministic pseudo-random number generator (mulberry32). The same seed
 * always produces the same sequence, so silhouette scatter layouts and
 * particle attribute assignment are reproducible instead of reshuffling on
 * every render/remount.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hashes a string into a 32-bit unsigned integer, so string ids (e.g. a beat id) can seed `createSeededRandom`. */
export function hashStringToSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
