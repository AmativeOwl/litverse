import { describe, expect, it } from 'vitest'
import { gatsbyCh3 } from './gatsby-ch3'
import sceneBeatsRaw from './scene-beats.json'
import type { Paragraph, Passage, SceneBeat, Sentence, Word } from '../types'

const sceneBeats = sceneBeatsRaw as SceneBeat[]

// ---------------------------------------------------------------------------
// Generic structural helpers. These are intentionally shape-driven (they
// walk whatever Passage/SceneBeat[] data they're given) rather than
// hardcoded against specific sentence text, so they keep validating
// correctly once the placeholder fixture is replaced with the real,
// hand-authored Chapter 3 excerpt.
// ---------------------------------------------------------------------------

function allWords(passage: Passage): Word[] {
  return passage.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.words))
}

function allSentences(passage: Passage): Sentence[] {
  return passage.paragraphs.flatMap((p) => p.sentences)
}

function allParagraphs(passage: Passage): Paragraph[] {
  return passage.paragraphs
}

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id)
    seen.add(id)
  }
  return [...dupes]
}

// Lowercase, letters/digits only, with optional internal apostrophes for
// contractions/possessives (e.g. "gatsby's" -> "gatsbys" is also fine, but
// we allow either normalization style as long as it's punctuation-free
// apart from a permitted internal apostrophe and contains no whitespace).
const NORMALIZED_WORD_RE = /^[a-z0-9]+('[a-z0-9]+)*$/

describe('gatsbyCh3 passage — structural validity', () => {
  it('has a non-empty paragraphs array', () => {
    expect(gatsbyCh3.paragraphs.length).toBeGreaterThan(0)
  })

  it('has no empty paragraphs (every paragraph has at least one sentence)', () => {
    for (const paragraph of allParagraphs(gatsbyCh3)) {
      expect(
        paragraph.sentences.length,
        `paragraph ${paragraph.id} has no sentences`,
      ).toBeGreaterThan(0)
    }
  })

  it('has no empty sentences (every sentence has at least one word)', () => {
    for (const sentence of allSentences(gatsbyCh3)) {
      expect(sentence.words.length, `sentence ${sentence.id} has no words`).toBeGreaterThan(0)
    }
  })

  it('has unique paragraph ids', () => {
    const ids = allParagraphs(gatsbyCh3).map((p) => p.id)
    expect(findDuplicates(ids), 'duplicate paragraph ids found').toEqual([])
  })

  it('has unique sentence ids', () => {
    const ids = allSentences(gatsbyCh3).map((s) => s.id)
    expect(findDuplicates(ids), 'duplicate sentence ids found').toEqual([])
  })

  it('has unique word ids', () => {
    const ids = allWords(gatsbyCh3).map((w) => w.id)
    expect(findDuplicates(ids), 'duplicate word ids found').toEqual([])
  })

  it('has a passage id and non-empty title', () => {
    expect(gatsbyCh3.id.length).toBeGreaterThan(0)
    expect(gatsbyCh3.title.length).toBeGreaterThan(0)
  })
})

describe('gatsbyCh3 passage — word normalization', () => {
  it('every word has non-empty text', () => {
    for (const word of allWords(gatsbyCh3)) {
      expect(word.text.length, `word ${word.id} has empty text`).toBeGreaterThan(0)
    }
  })

  it('every word.normalized is lowercase with no stray punctuation/whitespace', () => {
    for (const word of allWords(gatsbyCh3)) {
      expect(
        word.normalized,
        `word ${word.id} ("${word.text}") has normalized "${word.normalized}" that fails the expected shape`,
      ).toMatch(NORMALIZED_WORD_RE)
    }
  })

  it('every word.normalized has no uppercase characters', () => {
    for (const word of allWords(gatsbyCh3)) {
      expect(word.normalized).toBe(word.normalized.toLowerCase())
    }
  })
})

describe('gatsbyCh3 passage — sceneBeatId cross-references', () => {
  const beatIds = new Set(sceneBeats.map((b) => b.id))

  it('scene-beats.json defines at least one beat', () => {
    expect(sceneBeats.length).toBeGreaterThan(0)
  })

  it('every sentence.sceneBeatId matches a real entry in scene-beats.json', () => {
    for (const sentence of allSentences(gatsbyCh3)) {
      expect(
        beatIds.has(sentence.sceneBeatId),
        `sentence ${sentence.id} references unknown sceneBeatId "${sentence.sceneBeatId}"`,
      ).toBe(true)
    }
  })
})
