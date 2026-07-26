import type { Paragraph, Passage, SceneBeat, Sentence, Word } from '../types'
import type { CardSpec, ScenePlateSet } from '../types-plates'
import type { LibraryEntry, StylePackId } from '../data/library'
import { composeCard } from '../components/world/decoCardComposer'
import { darkenHex, drawBandedSky, lightenHex, mixHex } from '../components/world/decoPlateKit'

/**
 * Reader-added books: the mechanical half of the compiler, run in the
 * browser ONCE at add time, then persisted pre-segmented to localStorage.
 *
 * Constraint audit (CLAUDE.md): segmentation here is the same deterministic
 * paragraph/sentence/word splitting as scripts/segment-passage.ts -- plain
 * code, ZERO AI, no network. The result is stored as a compiled `Passage`,
 * so the READER still never parses prose at runtime (the pre-segmented rule
 * is about the reading path; add-time is this book's compile time). Beats
 * and plates are a fixed generic six-mood arc composed through the card
 * grammar -- hand-authored vocabulary, data-only assembly. What a
 * client-side add CANNOT produce is narration (TTS is offline-only), so
 * these books read silently: the store's `narrationAvailable` flag disables
 * Play honestly and click-to-seek drives the painted world.
 */

export const USER_CATEGORY = 'Your additions'
const STORAGE_KEY = 'litverse-user-library-v1'
const MAX_TEXT_CHARS = 200_000

export interface UserBookRecord {
  id: string
  title: string
  author: string
  passage: Passage
  addedAt: string
  /**
   * Style pack chosen by the reader at add time (the picker on the add-a-book
   * desk). Optional because records predate the picker; loadUserBooks
   * backfills those once via the deterministic title heuristic below.
   */
  stylePackId?: StylePackId
}

/**
 * One-time backfill for books added before the style picker existed: a
 * deterministic keyword table (zero AI -- the same closed-pack bet as
 * everywhere else; the picker is the real mechanism going forward).
 */
function inferStylePack(title: string, author: string): StylePackId {
  const haystack = `${title} ${author}`.toLowerCase()
  if (/wonderland|alice|looking-glass|fairy|grimm|andersen|peter pan|willows|carroll/.test(haystack)) {
    return 'storybook'
  }
  if (/poe|usher|raven|dracula|frankenstein|gothic|ghost|vampire|shelley|stoker/.test(haystack)) {
    return 'gothic'
  }
  return 'deco'
}

// ---------------------------------------------------------------------------
// Mechanical segmentation (ported from scripts/segment-passage.ts -- scripts
// are build-only and never imported by client code, so the mechanical rules
// are duplicated here with the same shapes: abbreviation-guarded sentence
// ends, em/en-dash splitting, punctuation-stripped normalized forms).
// ---------------------------------------------------------------------------

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'mme', 'mlle', 'prof', 'rev', 'col', 'gen', 'etc'])

function splitParagraphs(raw: string): string[] {
  return raw
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function splitSentences(paragraph: string): string[] {
  const tokens = paragraph.split(/(\s+)/)
  const sentences: string[] = []
  let current = ''
  for (const token of tokens) {
    current += token
    if (/[.!?]["'”’)]*$/.test(token.trim())) {
      const wordCore = token.trim().replace(/[^A-Za-z]/g, '').toLowerCase()
      if (!ABBREVIATIONS.has(wordCore)) {
        const trimmed = current.trim()
        if (trimmed) sentences.push(trimmed)
        current = ''
      }
    }
  }
  const tail = current.trim()
  if (tail) sentences.push(tail)
  return sentences
}

function splitWords(sentence: string): Array<Pick<Word, 'text' | 'normalized'>> {
  const raw = sentence
    .split(/\s+/)
    .flatMap((token) => token.split(/(?<=[—–])(?=[^\s])/))
    .filter(Boolean)
  const words: Array<Pick<Word, 'text' | 'normalized'>> = []
  for (const text of raw) {
    const normalized = text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9']/g, '')
      .replace(/^'+|'+$/g, '')
    if (!normalized) continue
    words.push({ text, normalized })
  }
  return words
}

// ---------------------------------------------------------------------------
// The generic mood arc: six hand-authored beats every reader-added book
// cycles through per paragraph. Deliberately book-agnostic -- description
// mining is the offline compiler's job; this is the dignified default.
// ---------------------------------------------------------------------------

export const GENERIC_BEATS: readonly SceneBeat[] = [
  beat('ug-dawn', '#2a2338', '#7a5a6a', '#e8b87a', '#1e1a2a', 'dust'),
  beat('ug-day', '#274b63', '#5f8ca8', '#f2d98c', '#1d3a4e', 'bokeh'),
  beat('ug-dusk', '#33253f', '#7a4a62', '#e89a5e', '#251b2e', 'dust'),
  beat('ug-night', '#131a2e', '#3a4a72', '#9ab8e8', '#0e1422', 'bokeh'),
  beat('ug-candle', '#241812', '#6a4326', '#ffb86a', '#1a110c', 'embers'),
  beat('ug-hush', '#1b2126', '#46565e', '#a8c8c0', '#141a1e', 'dust'),
]

function beat(
  id: string,
  background: string,
  primary: string,
  accent: string,
  fog: string,
  particles: 'dust' | 'bokeh' | 'embers',
): SceneBeat {
  return {
    id,
    palette: { background, primary, accent, fog },
    lighting: { ambientIntensity: 0.6, keyLightIntensity: 1.7, keyLightColor: accent, bloomStrength: 0.7 },
    particles: { type: particles, density: 45, speed: 0.2, sizeRange: [0.06, 0.22] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 50 },
    transitionDurationMs: 1100,
  }
}

/** Generic frameless far painter: banded sky over a dim ground band, plus sparse stars for the darker moods. */
function paintGenericFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: SceneBeat['palette']): void {
  drawBandedSky(ctx, 0, w, h * 0.74, [
    p.background,
    mixHex(p.background, p.primary, 0.35),
    mixHex(p.background, p.primary, 0.6),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.4)
  ctx.fillRect(0, h * 0.74, w, h * 0.26)
  ctx.fillStyle = lightenHex(p.accent, 0.35)
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.15 + ((i * 37) % 10) / 20
    ctx.fillRect((i * 149) % w, (i * 61) % (h * 0.5), 1.5, 1.5)
  }
  ctx.globalAlpha = 1
}

const GENERIC_CARDS: readonly CardSpec[] = [
  // dawn: the sun lifting over water
  { skyBands: 4, groundY: 0.7, frame: false, elements: [
    { noun: 'sun', at: [0.5, 0.34], size: 0.16, motion: { verb: 'breathe', amplitude: 0.3, speed: 0.4 } },
    { noun: 'waves', at: [0.5, 0.76], size: 0.2 },
    { noun: 'figure', at: [0.18, 0.94], size: 0.2, pose: 'stand', colorRole: 'shadow' },
  ]},
  // day: open water, a boat crossing
  { skyBands: 3, groundY: 0.62, frame: false, elements: [
    { noun: 'sun', at: [0.76, 0.24], size: 0.13 },
    { noun: 'waves', at: [0.5, 0.7], size: 0.22 },
    { noun: 'boat', at: [0.3, 0.66], size: 0.1, colorRole: 'shadow', motion: { verb: 'cross', loopSeconds: 26, amplitude: 0.5 } },
  ]},
  // dusk: a skyline lighting up
  { skyBands: 4, groundY: 0.72, frame: false, elements: [
    { noun: 'ziggurat', at: [0.24, 0.72], size: 0.24, colorRole: 'shadow', mirror: true },
    { noun: 'ziggurat', at: [0.42, 0.72], size: 0.17, colorRole: 'primary', mirror: true },
    { noun: 'lights-strand', at: [0.5, 0.34], size: 0.1, colorRole: 'accent', motion: { verb: 'twinkle' } },
    { noun: 'figure', at: [0.5, 0.94], size: 0.2, pose: 'stand', colorRole: 'shadow' },
  ]},
  // night: dancing under stars
  { skyBands: 3, groundY: 0.76, frame: false, elements: [
    { noun: 'stars', at: [0.5, 0.42], size: 0.3 },
    { noun: 'figure', at: [0.36, 0.93], size: 0.22, pose: 'dance', colorRole: 'accent', motion: { verb: 'glide', amplitude: 0.4, loopSeconds: 10 } },
    { noun: 'figure', at: [0.64, 0.93], size: 0.2, pose: 'dance', colorRole: 'primary-light', motion: { verb: 'glide', amplitude: 0.4, loopSeconds: 12, phase: 0.5 } },
  ]},
  // candlelit interior
  { skyBands: 3, groundY: 0.74, frame: false, elements: [
    { noun: 'gothic-arch', at: [0.3, 0.7], size: 0.44, colorRole: 'accent', mirror: true },
    { noun: 'brazier', at: [0.5, 0.94], size: 0.24 },
    { noun: 'figure', at: [0.7, 0.94], size: 0.2, pose: 'stand', colorRole: 'shadow' },
  ]},
  // hush: a still, watchful pair
  { skyBands: 4, groundY: 0.74, frame: false, elements: [
    { noun: 'stars', at: [0.5, 0.4], size: 0.24 },
    { noun: 'figure', at: [0.42, 0.94], size: 0.22, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.58, 0.94], size: 0.19, pose: 'stand', colorRole: 'primary-light' },
  ]},
]

function buildGenericPlateSet(): ScenePlateSet {
  const count = GENERIC_BEATS.length
  const step = 360 / count
  return {
    sceneId: 'user-generic',
    cameraAzimuthDeg: Object.fromEntries(GENERIC_BEATS.map((b, i) => [b.id, i * step])),
    plates: GENERIC_BEATS.flatMap((b, i) => [
      {
        id: `ug-far-${b.id}`,
        layer: 'far' as const,
        azimuthDeg: i * step,
        memberBeatIds: [b.id],
        source: { kind: 'paint' as const, paint: paintGenericFar },
      },
      {
        id: `ug-mid-${b.id}`,
        layer: 'mid' as const,
        azimuthDeg: i * step,
        memberBeatIds: [b.id],
        animated: true,
        source: { kind: 'paint' as const, paint: composeCard(GENERIC_CARDS[i % GENERIC_CARDS.length] ?? GENERIC_CARDS[0]!) },
      },
    ]),
  }
}

/** Built once; every reader-added book shares the generic painted world. */
const GENERIC_PLATESET: ScenePlateSet = buildGenericPlateSet()

// ---------------------------------------------------------------------------
// Compile + persist
// ---------------------------------------------------------------------------

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'untitled'
  )
}

export function compilePassage(id: string, title: string, rawText: string): Passage {
  const paragraphs: Paragraph[] = splitParagraphs(rawText).map((paragraphText, pIndex) => {
    const sentences: Sentence[] = splitSentences(paragraphText).map((sentenceText, sIndex) => {
      const words: Word[] = splitWords(sentenceText).map((word, wIndex) => ({
        id: `${id}-p${pIndex + 1}-s${sIndex + 1}-w${wIndex + 1}`,
        ...word,
      }))
      return {
        id: `${id}-p${pIndex + 1}-s${sIndex + 1}`,
        sceneBeatId: GENERIC_BEATS[pIndex % GENERIC_BEATS.length]?.id ?? 'ug-dawn',
        words,
      }
    })
    return { id: `${id}-p${pIndex + 1}`, sentences: sentences.filter((s) => s.words.length > 0) }
  })
  return { id, title, paragraphs: paragraphs.filter((p) => p.sentences.length > 0) }
}

export function loadUserBooks(): UserBookRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as UserBookRecord[]
    if (!Array.isArray(parsed)) return []
    const books = parsed.filter((b) => b && b.id && b.passage)
    // Backfill pre-picker records with an inferred pack, persisted so the
    // inference runs once per book, not on every load.
    let migrated = false
    for (const book of books) {
      if (!book.stylePackId) {
        book.stylePackId = inferStylePack(book.title, book.author)
        migrated = true
      }
    }
    if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
    return books
  } catch {
    return []
  }
}

export function addUserBook(input: {
  title: string
  author: string
  text: string
  stylePackId?: StylePackId
}): UserBookRecord {
  const title = input.title.trim()
  const author = input.author.trim() || 'Unknown'
  const text = input.text.trim()
  if (!title) throw new Error('Give the book a title.')
  if (!text) throw new Error('Paste the text to shelve.')
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(`That text is too long for a browser-side compile (max ${MAX_TEXT_CHARS.toLocaleString()} characters).`)
  }
  const id = `user-${slugify(title)}-${Date.now().toString(36)}`
  const passage = compilePassage(id, title, text)
  if (passage.paragraphs.length === 0) throw new Error('No readable sentences found in that text.')
  const record: UserBookRecord = {
    id,
    title,
    author,
    passage,
    addedAt: new Date().toISOString(),
    stylePackId: input.stylePackId ?? inferStylePack(title, author),
  }
  const books = [...loadUserBooks(), record]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
  return record
}

export function removeUserBook(id: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadUserBooks().filter((b) => b.id !== id)))
}

/**
 * Edit a shelved book's DETAILS (title/author/style pack). Deliberately not
 * the text: the passage was compiled once at add time and the raw prose
 * isn't retained, so a text change is remove + re-add. The id stays stable
 * so nothing downstream re-keys.
 */
export function updateUserBook(
  id: string,
  changes: { title?: string; author?: string; stylePackId?: StylePackId },
): UserBookRecord | null {
  const books = loadUserBooks()
  const book = books.find((b) => b.id === id)
  if (!book) return null
  const title = changes.title?.trim()
  if (title !== undefined && !title) throw new Error('Give the book a title.')
  if (title) book.title = title
  if (changes.author !== undefined) book.author = changes.author.trim() || 'Unknown'
  if (changes.stylePackId) book.stylePackId = changes.stylePackId
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
  return book
}

export function toLibraryEntry(record: UserBookRecord): LibraryEntry {
  const opening = record.passage.paragraphs[0]?.sentences[0]?.words.map((w) => w.text).join(' ') ?? ''
  return {
    id: record.id,
    title: record.title,
    author: record.author,
    chapter: 'Reader’s edition',
    stylePackId: record.stylePackId ?? 'deco',
    tagline: 'Compiled in your browser — silent reading',
    openingLine: opening,
    category: USER_CATEGORY,
    passage: record.passage,
    beats: GENERIC_BEATS,
    plateSet: GENERIC_PLATESET,
  }
}
