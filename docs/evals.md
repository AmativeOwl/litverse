# Evals in Litverse

Phase A's eval gate was human review: every AI draft (scene beats, plate
specs) was hand-tuned before commit, and the shipped data modules are the
approved outputs. The eval harness exists to remove that human from the loop
safely — which is exactly what Phase B's unattended server compiles require.

## The layers

**Golden dataset** — the four shipped texts (gatsby-ch3, masque, alice,
leagues) are hand-approved compiler output: raw excerpts in `scripts/input/`,
approved finals in `src/data/` (segmentation, beats, plate/card specs). No
new authoring was needed; the reference set is what production already runs.

**Deterministic eval layer** (`scripts/evals/validators.ts`, exercised over
the goldens by `scripts/evals/golden.test.ts`, which runs in vitest with
everything else — no API key, no LLM):

- **Schema validity** — drafts parse into the frozen `SceneBeat` / `CardSpec`
  shapes (runtime validators mirroring the TypeScript contracts).
- **Closed-lexicon adherence** — every noun one of the 19, every motion verb
  one of the 17, poses only on figures, color roles from the fixed set. The
  lexicon lists are typed against the source unions (compile-time
  exhaustiveness guards) *and* probed against the real `composeCard()` at
  test time, so the eval layer cannot drift from the grammar it polices.
- **Compiler laws as assertions** — table-driven, self-bound to the prose by
  regex (not hand-copied sentence ids): numeric fidelity ("two crystal
  plates" → exactly 2 doors; "eight servants" → exactly 8 figures) and
  negation ("no thin five-piece affair" → never exactly 5 figures, and ≥ 8 —
  a card depicting what the sentence denies is a compile error).
- **Palette sanity** — hex validity. (A background/fog luminance ceiling was
  drafted and the golden gate **rejected it**: gatsby's approved
  daytime-leisure beat ships fog at luminance 0.788, so "dark enough for
  fog/bloom" is not a real property of valid beats. The golden set corrected
  the check twice on first contact — it also fixed a miscounted law case —
  which is precisely the sanity-anchor role it exists to play.)
- **Cross-references** — every sentence's `sceneBeatId` exists, every beat is
  used, every plate's `memberBeatIds` and window `sentenceIds` resolve.

**Regression harness** (`scripts/evals/run-compiler-evals.ts`) — keyed and
offline like the generator it measures. Reruns `generate-plate-specs.ts` over
the golden gatsby input N times with `--retries 0` (raw failure observable,
not hidden behind retries) and reports, per draft: structural pass
(the generator's own coverage/beat-consistency gate), grammar violations,
law pass/fail/N-A, and proximity to the approved finals — recall of the
sentences the human chose to draw, plus extra windows proposed (a proxy for
hand-tuning burden). Run it whenever the prompt or model changes.

**LLM-judge layer** — deliberately not built. For arc-mood fuzziness the
deterministic properties are the credible gate; vibes-based judging can come
later if a concrete need appears.

## Evals this repo had already done (without the label)

- **Speech-rate correlation measurement** → closed-loop control: measured
  syllable rate vs sentence length across shipped manifests (Pearson
  r = 0.66 gatsby, r = 0.83 masque; extremes 3.9–10.1 syll/s against a 5.3
  median — Poe's 138-word clock sentence spoke nearly 2× fast). Drove the
  closed-loop rate normalization in `generate-narration-audio.ts`
  (synthesize → measure → correct until within 4% of target). Post-fix
  spread: 5.2–6.0 (gatsby) and 5.1–6.3 (masque).
- **Timing-drift measurement** → calibration pass: HeadTTS's timeline
  under-counts Kokoro's rendered pauses; measured drift reached **+2.4s**
  (gatsby's longest sentence) and **+3.3s** (Poe's clock sentence), audible
  as "the voice lags the highlight". `calibrate-narration-timings.ts`
  re-aligns every manifest against the WAVs' real silence structure
  (RMS scan; shipped manifests verified within 10ms per pause).
- **Fail-loudly G2P policy** → the Misaki bridge treats any word it cannot
  phonemize as a hard, named failure (never a silent mispronunciation);
  a pre-flight run over a new excerpt surfaces the full override list in one
  pass (the leagues excerpt needed exactly two: "Nemo", "Ned").
- **A/B and N-way listening trials** → the voice/speed trial harness
  (`--voice/--speed/--trial`) has gated every prosody decision: base speed
  1.1, af_sky over af_bella, then af_heart over an 11-voice field.

## First measured results (2026-07-25, gpt-4o, gatsby golden input)

Baseline (3 runs): structural 2/3; grammar violations 11 and 2 in the
survivors (dominant mode: `pose` on non-figure nouns, plus an invented
"dance" motion verb); laws: eight-servants drew 4 and 6 figures, two-
motorboats drew 1 boat; recall metric returned 0% — diagnosed as a harness
bug (shipped windows sat in the excluded [ALREADY COVERED] set), fixed with
the generator's new `--ignore-covered` from-scratch mode.

One eval-loop iteration (prompt: explicit GRAMMAR STRICTNESS block; harness:
recall fixed) and re-measure (3 runs): structural 2/3; best draft down to
**1 grammar violation with 90% recall** of the human's window choices;
grammar variance across drafts remains high. Stable finding across all six
drafts: **numeric fidelity does not survive gpt-4o drafting** ("eight
servants" → 1–6 figures, "two motorboats" → 1 boat, the pitful → 1 figure).
Conclusion: the closed lexicon is teachable in-prompt; stated counts are
not — Phase B needs either a stronger drafting model, a mechanical repair
pass (the laws are checkable, so counts are FIXABLE post-hoc), or the human
gate stays for law-bearing sentences. Fully clean drafts: 0/6 — the
hand-review gate earns its place, now with numbers.

## Running

```sh
# deterministic layer (runs with the normal suite)
npx vitest run scripts/evals

# regression harness (needs the gitignored .env key; costs real API calls)
npx tsx scripts/evals/run-compiler-evals.ts --runs 3 [--model <id>] [--keep]
```
