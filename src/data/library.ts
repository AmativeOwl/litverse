import type { Passage, SceneBeat } from '../types'
import type { ScenePlateSet } from '../types-plates'
import { aliceWonderland } from './alice'
import { ALICE_BEATS } from './beats/alice'
import { LEAGUES_BEATS } from './beats/leagues'
import { MASQUE_BEATS } from './beats/masque'
import { gatsbyCh3 } from './gatsby-ch3'
import { twentyThousandLeagues } from './leagues'
import { masqueRedDeath } from './masque'
import { ALICE_PLATES } from './plates/alice'
import { GATSBY_PLATES } from './plates/gatsby-ch3'
import { LEAGUES_PLATES } from './plates/leagues'
import { MASQUE_PLATES } from './plates/masque'
import sceneBeatsData from './scene-beats.json'

/**
 * The compiled-text library: every entry here has been through the full
 * offline compiler (segmentation, beats, painted plates, narration TTS) and
 * ships as static data -- see CLAUDE.md "Reading compiler + landing page",
 * Phase A. The landing page renders whatever this list contains, so adding
 * a future compiled text is one entry + its data modules, no UI changes.
 */
/**
 * The closed set of hand-built rendering vocabularies (see the style-packs
 * concept board): each pack is a cover painter + title-card painter + type
 * treatment. Data picks which one a book wears; packs are never generated.
 */
export type StylePackId = 'deco' | 'gothic' | 'storybook' | 'victorian' | 'water'

export interface LibraryEntry {
  id: string
  title: string
  author: string
  chapter: string
  /** Which style pack paints this book's cover and title card. */
  stylePackId: StylePackId
  /** One-line description shown under the chapter. */
  tagline: string
  /** The text's own first sentence, quoted on the card. */
  openingLine: string
  /** Bookcase shelf this text sits on (display grouping, e.g. "The Jazz Age"). */
  category: string
  passage: Passage
  /** This scene's compiled mood beats (palettes/lighting/camera per SceneBeat id). */
  beats: readonly SceneBeat[]
  /** This scene's painted-plate registry (camera azimuths + all plate/window definitions). */
  plateSet: ScenePlateSet
}

export const LIBRARY: readonly LibraryEntry[] = [
  {
    id: 'gatsby-ch3',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    chapter: 'Chapter III',
    stylePackId: 'deco',
    tagline: 'The party at West Egg',
    openingLine: 'There was music from my neighbour’s house through the summer nights.',
    category: 'The Jazz Age',
    passage: gatsbyCh3,
    beats: sceneBeatsData as SceneBeat[],
    plateSet: GATSBY_PLATES,
  },
  {
    id: 'masque',
    title: 'The Masque of the Red Death',
    author: 'Edgar Allan Poe',
    chapter: 'The Imperial Suite',
    stylePackId: 'gothic',
    tagline: 'Prince Prospero’s masked ball',
    openingLine: 'It was a voluptuous scene, that masquerade.',
    category: 'Gothic & Macabre',
    passage: masqueRedDeath,
    beats: MASQUE_BEATS,
    plateSet: MASQUE_PLATES,
  },
  {
    id: 'alice',
    title: 'Alice’s Adventures in Wonderland',
    author: 'Lewis Carroll',
    chapter: 'Down the Rabbit-Hole',
    stylePackId: 'storybook',
    tagline: 'The White Rabbit and the long fall',
    openingLine: 'Alice was beginning to get very tired of sitting by her sister on the bank.',
    category: 'Storybook & Whimsy',
    passage: aliceWonderland,
    beats: ALICE_BEATS,
    plateSet: ALICE_PLATES,
  },
  {
    id: 'leagues',
    title: 'Twenty Thousand Leagues Under the Seas',
    author: 'Jules Verne',
    chapter: 'The Man of the Seas',
    stylePackId: 'victorian',
    tagline: 'Nemo’s hymn to the sea, and liquid light',
    openingLine: '“You like the sea, Captain?”',
    category: 'Voyages & Adventure',
    passage: twentyThousandLeagues,
    beats: LEAGUES_BEATS,
    plateSet: LEAGUES_PLATES,
  },
]

export function sentenceCountOf(entry: LibraryEntry): number {
  return entry.passage.paragraphs.reduce((sum, paragraph) => sum + paragraph.sentences.length, 0)
}
