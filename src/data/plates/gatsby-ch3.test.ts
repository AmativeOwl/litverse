import { describe, expect, it } from 'vitest'
import sceneBeatsData from '../scene-beats.json'
import type { SceneBeat } from '../../types'
import { GATSBY_PLATES } from './gatsby-ch3'

const BEATS = sceneBeatsData as SceneBeat[]
const BEAT_IDS = new Set(BEATS.map((beat) => beat.id))

describe('GATSBY_PLATES registry', () => {
  it('provides a camera azimuth for every scene beat, and no strays', () => {
    const mapped = Object.keys(GATSBY_PLATES.cameraAzimuthDeg)
    expect(new Set(mapped)).toEqual(BEAT_IDS)
    for (const deg of Object.values(GATSBY_PLATES.cameraAzimuthDeg)) {
      expect(deg).toBeGreaterThanOrEqual(0)
      expect(deg).toBeLessThan(360)
    }
  })

  it('every plate references only real beats and matches its beats camera sector', () => {
    for (const plate of GATSBY_PLATES.plates) {
      expect(plate.memberBeatIds.length).toBeGreaterThan(0)
      for (const beatId of plate.memberBeatIds) {
        expect(BEAT_IDS.has(beatId)).toBe(true)
        // a plate must hang in the sector the camera faces during its beats
        expect(plate.azimuthDeg).toBe(GATSBY_PLATES.cameraAzimuthDeg[beatId])
      }
    }
  })

  it('plate ids are unique', () => {
    const ids = GATSBY_PLATES.plates.map((plate) => plate.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('explicit sizes/radii stay within sane frustum bounds', () => {
    for (const plate of GATSBY_PLATES.plates) {
      if (plate.radius !== undefined) {
        expect(plate.radius).toBeGreaterThan(10)
        expect(plate.radius).toBeLessThanOrEqual(30)
      }
      if (plate.size) {
        const [width, height] = plate.size
        expect(width).toBeGreaterThan(0)
        expect(height).toBeGreaterThan(0)
      }
    }
  })

  it('window sentence ids are non-empty and unique across windows', () => {
    const seen = new Set<string>()
    for (const window of GATSBY_PLATES.windows ?? []) {
      expect(window.sentenceIds.length).toBeGreaterThan(0)
      for (const sentenceId of window.sentenceIds) {
        expect(seen.has(sentenceId)).toBe(false)
        seen.add(sentenceId)
      }
    }
  })
})
