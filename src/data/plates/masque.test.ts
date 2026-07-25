import { describe, expect, it } from 'vitest'
import { MASQUE_BEATS } from '../beats/masque'
import { masqueRedDeath } from '../masque'
import { MASQUE_PLATES } from './masque'

const BEAT_IDS = new Set(MASQUE_BEATS.map((beat) => beat.id))

describe('MASQUE_PLATES registry', () => {
  it('provides a camera azimuth for every scene beat, and no strays', () => {
    const mapped = Object.keys(MASQUE_PLATES.cameraAzimuthDeg)
    expect(new Set(mapped)).toEqual(BEAT_IDS)
    for (const deg of Object.values(MASQUE_PLATES.cameraAzimuthDeg)) {
      expect(deg).toBeGreaterThanOrEqual(0)
      expect(deg).toBeLessThan(360)
    }
  })

  it('every passage sentence references a beat that exists', () => {
    for (const paragraph of masqueRedDeath.paragraphs) {
      for (const sentence of paragraph.sentences) {
        expect(BEAT_IDS.has(sentence.sceneBeatId), `sentence ${sentence.id} -> ${sentence.sceneBeatId}`).toBe(true)
      }
    }
  })

  it('every plate references only real beats and matches its beats camera sector', () => {
    for (const plate of MASQUE_PLATES.plates) {
      expect(plate.memberBeatIds.length).toBeGreaterThan(0)
      for (const beatId of plate.memberBeatIds) {
        expect(BEAT_IDS.has(beatId)).toBe(true)
        // a plate must hang in the sector the camera faces during its beats
        expect(plate.azimuthDeg).toBe(MASQUE_PLATES.cameraAzimuthDeg[beatId])
      }
    }
  })

  it('every beat is covered by at least one mid plate', () => {
    for (const beatId of BEAT_IDS) {
      const midPlates = MASQUE_PLATES.plates.filter(
        (plate) => plate.layer === 'mid' && plate.memberBeatIds.includes(beatId),
      )
      expect(midPlates.length, `beat ${beatId} has no mid plate`).toBeGreaterThan(0)
    }
  })

  it('plate ids are unique, including window plates, and disjoint from gatsby-style ids', () => {
    const ids = [
      ...MASQUE_PLATES.plates.map((plate) => plate.id),
      ...(MASQUE_PLATES.windows ?? []).map((window) => window.plate.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id.startsWith('mq-'), `plate id ${id} should carry the mq- scene prefix`).toBe(true)
    }
  })

  it('explicit sizes/radii stay within sane frustum bounds', () => {
    for (const plate of MASQUE_PLATES.plates) {
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
    for (const window of MASQUE_PLATES.windows ?? []) {
      expect(window.sentenceIds.length).toBeGreaterThan(0)
      for (const sentenceId of window.sentenceIds) {
        expect(seen.has(sentenceId)).toBe(false)
        seen.add(sentenceId)
      }
    }
  })

  it('window sentence ids reference real passage sentences', () => {
    const sentenceById = new Map(
      masqueRedDeath.paragraphs.flatMap((paragraph) =>
        paragraph.sentences.map((sentence) => [sentence.id, sentence] as const),
      ),
    )
    for (const window of MASQUE_PLATES.windows ?? []) {
      for (const sentenceId of window.sentenceIds) {
        expect(sentenceById.has(sentenceId), `unknown sentence ${sentenceId}`).toBe(true)
      }
    }
  })

  it('each window hangs in the camera sector of its sentences beats', () => {
    const beatBySentenceId = new Map(
      masqueRedDeath.paragraphs.flatMap((paragraph) =>
        paragraph.sentences.map((sentence) => [sentence.id, sentence.sceneBeatId] as const),
      ),
    )
    for (const window of MASQUE_PLATES.windows ?? []) {
      for (const sentenceId of window.sentenceIds) {
        const beatId = beatBySentenceId.get(sentenceId)
        expect(beatId).toBeDefined()
        if (!beatId) continue
        // while these sentences narrate, the camera faces this azimuth --
        // the window plate must hang there or it plays offscreen
        expect(
          window.plate.azimuthDeg,
          `window ${window.id} sentence ${sentenceId} (beat ${beatId})`,
        ).toBe(MASQUE_PLATES.cameraAzimuthDeg[beatId])
      }
    }
  })
})
