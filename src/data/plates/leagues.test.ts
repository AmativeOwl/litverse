import { describe, expect, it } from 'vitest'
import { LEAGUES_BEATS } from '../beats/leagues'
import { twentyThousandLeagues } from '../leagues'
import { LEAGUES_PLATES } from './leagues'

const BEAT_IDS = new Set(LEAGUES_BEATS.map((beat) => beat.id))

describe('LEAGUES_PLATES registry', () => {
  it('provides a camera azimuth for every scene beat, and no strays', () => {
    const mapped = Object.keys(LEAGUES_PLATES.cameraAzimuthDeg)
    expect(new Set(mapped)).toEqual(BEAT_IDS)
    for (const deg of Object.values(LEAGUES_PLATES.cameraAzimuthDeg)) {
      expect(deg).toBeGreaterThanOrEqual(0)
      expect(deg).toBeLessThan(360)
    }
  })

  it('every passage sentence references a beat that exists', () => {
    for (const paragraph of twentyThousandLeagues.paragraphs) {
      for (const sentence of paragraph.sentences) {
        expect(BEAT_IDS.has(sentence.sceneBeatId), `sentence ${sentence.id} -> ${sentence.sceneBeatId}`).toBe(true)
      }
    }
  })

  it('every plate references only real beats and matches its beats camera sector', () => {
    for (const plate of LEAGUES_PLATES.plates) {
      expect(plate.memberBeatIds.length).toBeGreaterThan(0)
      for (const beatId of plate.memberBeatIds) {
        expect(BEAT_IDS.has(beatId)).toBe(true)
        expect(plate.azimuthDeg).toBe(LEAGUES_PLATES.cameraAzimuthDeg[beatId])
      }
    }
  })

  it('every beat is covered by at least one mid plate and one far plate', () => {
    for (const beatId of BEAT_IDS) {
      const mids = LEAGUES_PLATES.plates.filter((p) => p.layer === 'mid' && p.memberBeatIds.includes(beatId))
      const fars = LEAGUES_PLATES.plates.filter((p) => p.layer === 'far' && p.memberBeatIds.includes(beatId))
      expect(mids.length, `beat ${beatId} has no mid plate`).toBeGreaterThan(0)
      expect(fars.length, `beat ${beatId} has no far plate`).toBeGreaterThan(0)
    }
  })

  it('plate ids are unique, including window plates, and carry the lg- prefix', () => {
    const ids = [
      ...LEAGUES_PLATES.plates.map((plate) => plate.id),
      ...(LEAGUES_PLATES.windows ?? []).map((window) => window.plate.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id.startsWith('lg-'), `plate id ${id} should carry the lg- scene prefix`).toBe(true)
    }
  })

  it('explicit sizes/radii stay within sane frustum bounds', () => {
    for (const plate of LEAGUES_PLATES.plates) {
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
      twentyThousandLeagues.paragraphs.flatMap((paragraph) =>
        paragraph.sentences.map((sentence) => [sentence.id, sentence] as const),
      ),
    )
    const seen = new Set<string>()
    for (const window of LEAGUES_PLATES.windows ?? []) {
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
      twentyThousandLeagues.paragraphs.flatMap((paragraph) =>
        paragraph.sentences.map((sentence) => [sentence.id, sentence.sceneBeatId] as const),
      ),
    )
    for (const window of LEAGUES_PLATES.windows ?? []) {
      for (const sentenceId of window.sentenceIds) {
        const beatId = beatBySentenceId.get(sentenceId)
        expect(beatId).toBeDefined()
        if (!beatId) continue
        expect(
          window.plate.azimuthDeg,
          `window ${window.id} sentence ${sentenceId} (beat ${beatId})`,
        ).toBe(LEAGUES_PLATES.cameraAzimuthDeg[beatId])
      }
    }
  })
})
