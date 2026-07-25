import { describe, expect, it } from 'vitest'
import { ALICE_BEATS } from '../beats/alice'
import { aliceWonderland } from '../alice'
import { ALICE_PLATES } from './alice'

const BEAT_IDS = new Set(ALICE_BEATS.map((beat) => beat.id))

describe('ALICE_PLATES registry', () => {
  it('provides a camera azimuth for every scene beat, and no strays', () => {
    const mapped = Object.keys(ALICE_PLATES.cameraAzimuthDeg)
    expect(new Set(mapped)).toEqual(BEAT_IDS)
    for (const deg of Object.values(ALICE_PLATES.cameraAzimuthDeg)) {
      expect(deg).toBeGreaterThanOrEqual(0)
      expect(deg).toBeLessThan(360)
    }
  })

  it('every passage sentence references a beat that exists', () => {
    for (const paragraph of aliceWonderland.paragraphs) {
      for (const sentence of paragraph.sentences) {
        expect(BEAT_IDS.has(sentence.sceneBeatId), `sentence ${sentence.id} -> ${sentence.sceneBeatId}`).toBe(true)
      }
    }
  })

  it('every plate references only real beats and matches its beats camera sector', () => {
    for (const plate of ALICE_PLATES.plates) {
      expect(plate.memberBeatIds.length).toBeGreaterThan(0)
      for (const beatId of plate.memberBeatIds) {
        expect(BEAT_IDS.has(beatId)).toBe(true)
        expect(plate.azimuthDeg).toBe(ALICE_PLATES.cameraAzimuthDeg[beatId])
      }
    }
  })

  it('every beat is covered by at least one mid plate', () => {
    for (const beatId of BEAT_IDS) {
      const midPlates = ALICE_PLATES.plates.filter(
        (plate) => plate.layer === 'mid' && plate.memberBeatIds.includes(beatId),
      )
      expect(midPlates.length, `beat ${beatId} has no mid plate`).toBeGreaterThan(0)
    }
  })

  it('plate ids are unique, including window plates, and carry the al- scene prefix', () => {
    const ids = [
      ...ALICE_PLATES.plates.map((plate) => plate.id),
      ...(ALICE_PLATES.windows ?? []).map((window) => window.plate.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id.startsWith('al-'), `plate id ${id} should carry the al- scene prefix`).toBe(true)
    }
  })

  it('explicit sizes/radii stay within sane frustum bounds', () => {
    for (const plate of ALICE_PLATES.plates) {
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

  it('window sentence ids are non-empty, unique, and reference real sentences', () => {
    const sentenceById = new Map(
      aliceWonderland.paragraphs.flatMap((paragraph) =>
        paragraph.sentences.map((sentence) => [sentence.id, sentence] as const),
      ),
    )
    const seen = new Set<string>()
    for (const window of ALICE_PLATES.windows ?? []) {
      expect(window.sentenceIds.length).toBeGreaterThan(0)
      for (const sentenceId of window.sentenceIds) {
        expect(seen.has(sentenceId)).toBe(false)
        seen.add(sentenceId)
        expect(sentenceById.has(sentenceId), `unknown sentence ${sentenceId}`).toBe(true)
      }
    }
  })

  it('each window hangs in the camera sector of its sentences beats', () => {
    const beatBySentenceId = new Map(
      aliceWonderland.paragraphs.flatMap((paragraph) =>
        paragraph.sentences.map((sentence) => [sentence.id, sentence.sceneBeatId] as const),
      ),
    )
    for (const window of ALICE_PLATES.windows ?? []) {
      for (const sentenceId of window.sentenceIds) {
        const beatId = beatBySentenceId.get(sentenceId)
        expect(beatId).toBeDefined()
        if (!beatId) continue
        expect(
          window.plate.azimuthDeg,
          `window ${window.id} sentence ${sentenceId} (beat ${beatId})`,
        ).toBe(ALICE_PLATES.cameraAzimuthDeg[beatId])
      }
    }
  })
})
