import type { StylePackId } from '../../data/library'
import type { CoverPaint, StylePack } from './types'
import { DECO_PACK, paintDecoCover } from './deco'
import { GOTHIC_PACK, paintGothicCover } from './gothic'
import { STORYBOOK_PACK, paintStorybookCover } from './storybook'
import { VICTORIAN_PACK, paintVictorianCover } from './victorian'
import { WATER_PACK, paintWaterCover } from './water'

export type { CoverPaint, StylePack } from './types'

/** Title-card packs, keyed by LibraryEntry.stylePackId (LandingPage carousel). */
export const PACKS: Record<StylePackId, StylePack> = {
  deco: DECO_PACK,
  gothic: GOTHIC_PACK,
  storybook: STORYBOOK_PACK,
  victorian: VICTORIAN_PACK,
  water: WATER_PACK,
}

export function packFor(entry: { stylePackId: StylePackId }): StylePack {
  return PACKS[entry.stylePackId] ?? DECO_PACK
}

/** Bookcase-cover painters, keyed the same way (BookcasePage shelves). */
export const COVER_PAINTERS: Record<StylePackId, CoverPaint> = {
  deco: paintDecoCover,
  gothic: paintGothicCover,
  storybook: paintStorybookCover,
  victorian: paintVictorianCover,
  water: paintWaterCover,
}
