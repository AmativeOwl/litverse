import { describe, expect, it } from 'vitest'
import { LEAGUES_BEATS } from './beats/leagues'
import { twentyThousandLeagues } from './leagues'
import type { Paragraph, Passage, Sentence, Word } from '../types'

// Structural validation for the Leagues passage -- same shape-driven checks
// as gatsby-ch3.test.ts / the masque plates suite.

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

describe('twentyThousandLeagues passage — structural validity', () => {
  it('has the curated excerpt shape: 9 paragraphs, 38 sentences', () => {
    expect(twentyThousandLeagues.paragraphs.length).toBe(9)
    expect(allSentences(twentyThousandLeagues).length).toBe(38)
  })

  it('has no empty paragraphs or sentences', () => {
    for (const paragraph of allParagraphs(twentyThousandLeagues)) {
      expect(paragraph.sentences.length, `paragraph ${paragraph.id}`).toBeGreaterThan(0)
    }
    for (const sentence of allSentences(twentyThousandLeagues)) {
      expect(sentence.words.length, `sentence ${sentence.id}`).toBeGreaterThan(0)
    }
  })

  it('has unique paragraph/sentence/word ids with the lg- prefix', () => {
    const pids = allParagraphs(twentyThousandLeagues).map((p) => p.id)
    const sids = allSentences(twentyThousandLeagues).map((s) => s.id)
    const wids = allWords(twentyThousandLeagues).map((w) => w.id)
    expect(findDuplicates(pids)).toEqual([])
    expect(findDuplicates(sids)).toEqual([])
    expect(findDuplicates(wids)).toEqual([])
    for (const id of [...pids, ...sids, ...wids]) {
      expect(id.startsWith('lg-'), `id ${id} should carry the lg- scene prefix`).toBe(true)
    }
  })

  it('has a passage id and non-empty title', () => {
    expect(twentyThousandLeagues.id).toBe('leagues')
    expect(twentyThousandLeagues.title.length).toBeGreaterThan(0)
  })
})

describe('twentyThousandLeagues passage — word normalization', () => {
  it('every word has non-empty text and a clean normalized form', () => {
    for (const word of allWords(twentyThousandLeagues)) {
      expect(word.text.length, `word ${word.id} has empty text`).toBeGreaterThan(0)
      expect(
        word.normalized,
        `word ${word.id} ("${word.text}") normalized "${word.normalized}"`,
      ).toMatch(NORMALIZED_WORD_RE)
      expect(word.normalized).toBe(word.normalized.toLowerCase())
    }
  })
})

describe('twentyThousandLeagues passage — sceneBeatId cross-references', () => {
  const beatIds = new Set(LEAGUES_BEATS.map((b) => b.id))

  it('defines seven beats', () => {
    expect(LEAGUES_BEATS.length).toBe(7)
  })

  it('every sentence.sceneBeatId matches a real beat', () => {
    for (const sentence of allSentences(twentyThousandLeagues)) {
      expect(
        beatIds.has(sentence.sceneBeatId),
        `sentence ${sentence.id} references unknown sceneBeatId "${sentence.sceneBeatId}"`,
      ).toBe(true)
    }
  })

  it('every beat is actually used by at least one sentence', () => {
    const used = new Set(allSentences(twentyThousandLeagues).map((s) => s.sceneBeatId))
    for (const beat of LEAGUES_BEATS) {
      expect(used.has(beat.id), `beat ${beat.id} is never assigned`).toBe(true)
    }
  })
})
