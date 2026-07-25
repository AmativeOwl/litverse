// The golden-dataset gate: every SHIPPED text -- four hand-approved compiler
// outputs -- must pass the full deterministic eval layer. This is the
// harness's sanity anchor (if an approved final fails a check, the check is
// wrong) and the regression net for future hand-edits to the data modules.
//
// Deliberately runs in vitest alongside the app's own tests: the eval layer
// is plain property checking, no API key, no LLM anywhere.

import { describe, expect, it } from 'vitest'
import { LIBRARY } from '../../src/data/library'
import { ALICE_CARD_SPECS } from '../../src/data/plates/alice'
import { LEAGUES_CARD_SPECS } from '../../src/data/plates/leagues'
import { composeCard } from '../../src/components/world/decoCardComposer'
import type { CardSpec } from '../../src/types-plates'
import { MOTION_VERBS, OBJECT_NOUNS } from './lexicon'
import {
  applyLaw,
  findSentenceIdByText,
  validateCardSpec,
  validatePlateSetRefs,
  validateSceneBeats,
  type CompilerLaw,
} from './validators'

describe('golden dataset — every shipped text passes the deterministic eval layer', () => {
  for (const entry of LIBRARY) {
    describe(entry.id, () => {
      it('beats pass schema + palette checks', () => {
        expect(validateSceneBeats(entry.beats)).toEqual([])
      })
      it('plate registry cross-references resolve', () => {
        expect(validatePlateSetRefs(entry.plateSet, entry.beats, entry.passage)).toEqual([])
      })
    })
  }
})

describe('golden dataset — inspectable CardSpecs obey the grammar', () => {
  const specSets: [string, Record<string, CardSpec>][] = [
    ['alice', ALICE_CARD_SPECS],
    ['leagues', LEAGUES_CARD_SPECS],
  ]
  for (const [scene, specs] of specSets) {
    it(`${scene}: every card passes schema + closed-lexicon checks`, () => {
      for (const [name, spec] of Object.entries(specs)) {
        expect(validateCardSpec(spec, `${scene}/${name}`)).toEqual([])
      }
    })
  }
})

describe('golden dataset — compiler laws hold in the shipped data', () => {
  interface GoldenLawCase {
    scene: string
    card: CardSpec
    where: string
    law: CompilerLaw
    /** The prose the law derives from -- asserts the sentence really exists. */
    source?: { passageId: string; pattern: RegExp }
  }

  const cases: GoldenLawCase[] = [
    // "two oblong openings" / "Two crystal plates separated us from the sea"
    {
      scene: 'leagues',
      card: LEAGUES_CARD_SPECS['panels']!,
      where: 'leagues/panels',
      law: { kind: 'exact-count', noun: 'door', n: 2 },
      source: { passageId: 'leagues', pattern: /two oblong openings/i },
    },
    {
      scene: 'leagues',
      card: LEAGUES_CARD_SPECS['crystal-plates']!,
      where: 'leagues/crystal-plates',
      law: { kind: 'exact-count', noun: 'door', n: 2 },
      source: { passageId: 'leagues', pattern: /Two crystal plates/i },
    },
    // "a White Rabbit with pink eyes ran close by her" -- TWO beings in the
    // scene: Alice (standing) and the one rabbit (crossing). An earlier
    // draft of this case said 1 and the golden gate corrected it.
    {
      scene: 'alice',
      card: ALICE_CARD_SPECS['white-rabbit']!,
      where: 'alice/white-rabbit',
      law: { kind: 'exact-count', noun: 'figure', n: 2 },
      source: { passageId: 'alice', pattern: /White Rabbit with pink eyes/i },
    },
    // Alice and her sister on the bank -- exactly two figures
    {
      scene: 'alice',
      card: ALICE_CARD_SPECS['riverbank']!,
      where: 'alice/riverbank',
      law: { kind: 'exact-count', noun: 'figure', n: 2 },
      source: { passageId: 'alice', pattern: /sitting by her sister on the bank/i },
    },
  ]

  for (const testCase of cases) {
    it(`${testCase.where}: ${testCase.law.kind} ${('noun' in testCase.law && testCase.law.noun) || ''}`, () => {
      expect(applyLaw(testCase.law, testCase.card, testCase.where)).toEqual([])
      if (testCase.source) {
        const entry = LIBRARY.find((e) => e.id === testCase.source!.passageId)
        expect(entry, `passage ${testCase.source.passageId}`).toBeDefined()
        expect(
          findSentenceIdByText(entry!.passage, testCase.source.pattern),
          `law's source prose ${testCase.source.pattern} not found in ${testCase.source.passageId}`,
        ).not.toBeNull()
      }
    })
  }
})

describe('lexicon runtime probe — composeCard accepts every listed noun and verb', () => {
  // esbuild strips the compile-time exhaustiveness guards, so probe the real
  // composer: a spec using each lexicon entry must compose without throwing.
  it('every ObjectNoun composes', () => {
    for (const noun of OBJECT_NOUNS) {
      const spec: CardSpec = { elements: [{ noun, at: [0.5, 0.8], size: 0.2 }] }
      expect(typeof composeCard(spec)).toBe('function')
    }
  })
  it('every MotionVerb composes on a figure', () => {
    for (const verb of MOTION_VERBS) {
      const spec: CardSpec = { elements: [{ noun: 'figure', at: [0.5, 0.9], size: 0.2, motion: { verb } }] }
      expect(typeof composeCard(spec)).toBe('function')
    }
  })
})
