import type { Passage, SceneBeat } from '../types'
import type { ScenePlateSet } from '../types-plates'
import { gatsbyCh3 } from './gatsby-ch3'
import { GATSBY_PLATES } from './plates/gatsby-ch3'
import sceneBeatsData from './scene-beats.json'

/**
 * The compiled-text library: every entry here has been through the full
 * offline compiler (segmentation, beats, painted plates, narration TTS) and
 * ships as static data -- see CLAUDE.md "Reading compiler + landing page",
 * Phase A. The landing page renders whatever this list contains, so adding
 * a future compiled text is one entry + its data modules, no UI changes.
 */
export interface LibraryEntry {
  id: string
  title: string
  author: string
  chapter: string
  /** One-line description shown under the chapter. */
  tagline: string
  /** The text's own first sentence, quoted on the card. */
  openingLine: string
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
    tagline: 'The party at West Egg',
    openingLine: 'There was music from my neighbour’s house through the summer nights.',
    passage: gatsbyCh3,
    beats: sceneBeatsData as SceneBeat[],
    plateSet: GATSBY_PLATES,
  },
]

export function sentenceCountOf(entry: LibraryEntry): number {
  return entry.passage.paragraphs.reduce((sum, paragraph) => sum + paragraph.sentences.length, 0)
}
