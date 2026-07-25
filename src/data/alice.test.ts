import { describe, expect, it } from 'vitest'
import { aliceWonderland } from './alice'
import { ALICE_BEATS } from './beats/alice'
import type { Paragraph, Passage, Sentence, Word } from '../types'

// Structural validation for the Alice excerpt, mirroring gatsby-ch3.test.ts:
// shape-driven walks over the passage rather than hardcoded sentence text.

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

const NORMALIZED_WORD_RE = /^[a-z0-9]+('[a-z0-9]+)*$/

describe('aliceWonderland passage — structural validity', () => {
  it('has the curated excerpt shape (8 paragraphs, 18 sentences)', () => {
    expect(aliceWonderland.paragraphs.length).toBe(8)
    expect(allSentences(aliceWonderland).length).toBe(18)
  })

  it('has no empty paragraphs or sentences', () => {
    for (const paragraph of allParagraphs(aliceWonderland)) {
      expect(paragraph.sentences.length, `paragraph ${paragraph.id} has no sentences`).toBeGreaterThan(0)
    }
    for (const sentence of allSentences(aliceWonderland)) {
      expect(sentence.words.length, `sentence ${sentence.id} has no words`).toBeGreaterThan(0)
    }
  })

  it('has unique paragraph, sentence, and word ids with the al- prefix', () => {
    expect(findDuplicates(allParagraphs(aliceWonderland).map((p) => p.id))).toEqual([])
    expect(findDuplicates(allSentences(aliceWonderland).map((s) => s.id))).toEqual([])
    expect(findDuplicates(allWords(aliceWonderland).map((w) => w.id))).toEqual([])
    for (const paragraph of allParagraphs(aliceWonderland)) {
      expect(paragraph.id.startsWith('al-p')).toBe(true)
    }
  })

  it('has a passage id and non-empty title', () => {
    expect(aliceWonderland.id).toBe('alice')
    expect(aliceWonderland.title.length).toBeGreaterThan(0)
  })
})

describe('aliceWonderland passage — word normalization', () => {
  it('every word has non-empty text and a well-formed normalized form', () => {
    for (const word of allWords(aliceWonderland)) {
      expect(word.text.length, `word ${word.id} has empty text`).toBeGreaterThan(0)
      expect(
        word.normalized,
        `word ${word.id} ("${word.text}") has normalized "${word.normalized}" that fails the expected shape`,
      ).toMatch(NORMALIZED_WORD_RE)
      expect(word.normalized).toBe(word.normalized.toLowerCase())
    }
  })
})

describe('aliceWonderland passage — sceneBeatId cross-references', () => {
  const beatIds = new Set(ALICE_BEATS.map((b) => b.id))

  it('defines six beats', () => {
    expect(ALICE_BEATS.length).toBe(6)
  })

  it('every sentence.sceneBeatId matches a real ALICE_BEATS entry', () => {
    for (const sentence of allSentences(aliceWonderland)) {
      expect(
        beatIds.has(sentence.sceneBeatId),
        `sentence ${sentence.id} references unknown sceneBeatId "${sentence.sceneBeatId}"`,
      ).toBe(true)
    }
  })

  it('every beat is used by at least one sentence', () => {
    const used = new Set(allSentences(aliceWonderland).map((s) => s.sceneBeatId))
    for (const beat of ALICE_BEATS) {
      expect(used.has(beat.id), `beat ${beat.id} is never assigned`).toBe(true)
    }
  })
})
