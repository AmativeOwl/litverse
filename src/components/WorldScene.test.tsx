import { describe, expect, it } from 'vitest'

// Full WebGL <Canvas> rendering isn't practical in jsdom (no real GL
// context), so this is deliberately just a smoke check that the module graph
// (WorldScene.tsx + everything under components/world/) imports and
// constructs without throwing -- the pure-logic pieces (beatMath,
// cameraMath, seededRandom, fixtureBeats) get real behavioral coverage in
// their own test files.
describe('WorldScene module', () => {
  it('imports without throwing and exports a component function', async () => {
    const mod = await import('./WorldScene')
    expect(typeof mod.default).toBe('function')
  })
})
