# Litverse

Immersive two-pane reading experience for *The Great Gatsby* (Chapter 3 party scene). Left pane: book text with Speechify-style word/sentence highlighting synced to narration. Right pane: a reactive, game-like 3D "world" (Journey/Gris-style minimal atmospheric visuals) that shifts mood as the reader progresses. 48-hour solo build; must be deployed with zero bugs.

## Design constraints (do not violate)

- **No rigged/animated 3D characters.** Crowd/characters are rendered abstractly (instanced silhouettes + particles + lighting), not modeled/rigged figures.
- **No live AI generation at runtime.** AI (Anthropic/OpenAI key) is used only in an offline build-time script (`scripts/generate-scene-beats.ts`) to help segment text and draft scene-beat metadata; the narration voice similarly comes from an offline build-time script (`scripts/generate-narration-audio.ts`, a local open-weight TTS model — no API key, no network calls at generation time either). Never call an LLM/image-gen/TTS API from the deployed client. Keep any keys out of any bundled module; the deployed app makes zero AI-inference calls of any kind.
- **No free-roam 3D exploration.** The default view uses a scripted camera rig, not `OrbitControls`. The one exception is the fullscreen mode (phase 3 stretch), which uses `OrbitControls` with tight distance/angle constraints and panning disabled — never true free flight.
- **Word-level state never reaches the three.js subtree as a React prop.** Only sentence/beat-level state (`activeSceneBeatId`, `activeSpeakerId`) may trigger R3F re-renders. Per-frame interpolation (beat lerp, silhouette sway, echo-text fade) belongs in `useFrame`, not `useState` — otherwise React reconciliation fights the WebGL render loop and causes jank exactly when both are busiest.
- **Text is pre-segmented, never parsed live.** `Passage → Paragraph → Sentence → Word` structures are authored/generated ahead of time, not derived from raw prose at runtime — this sidesteps punctuation/quote-parsing edge cases entirely.
- **Always demo-ready.** Every milestone must end in a deployed, complete, non-broken state for whatever scope it currently covers — never leave `main` mid-feature.

## Tech stack

- **Vite + React + TypeScript** (not Next.js) — everything here (Web Speech API, WebGL, DOM highlighting) is client-only; SSR buys nothing and adds hydration risk.
- **@react-three/fiber + drei + @react-three/postprocessing** — declarative R3F scene graph; `Sparkles`, `Float`, `Bloom` for most of the visual payoff with minimal code.
- **Zustand** — single `readingStore`, the one source of truth for narration position, subscribed to via selectors.
- **Tailwind CSS** + a serif typeface (Lora/EB Garamond) for the text pane — type quality matters here.
- **TypeScript strict mode** (`strict: true`, `noUncheckedIndexedAccess: true`) — the primary bug-catching net in place of a test suite.
- **Vercel**, static Vite build — no SSR, no runtime env vars.

## Data model

```ts
interface Word { id: string; text: string; normalized: string }
interface Sentence { id: string; words: Word[]; sceneBeatId: string; speakerId?: string }
interface Paragraph { id: string; sentences: Sentence[] }
interface Passage { id: string; title: string; paragraphs: Paragraph[] }

interface SceneBeat {
  id: string;
  palette: { background: string; primary: string; accent: string; fog: string };
  lighting: { ambientIntensity: number; keyLightIntensity: number; keyLightColor: string; bloomStrength: number };
  particles: { type: "bokeh" | "confetti" | "embers" | "dust" | "none"; density: number; speed: number; sizeRange: [number, number] };
  camera: { behavior: "slow-orbit" | "static-drift" | "push-in" | "pull-back"; speed: number; fov: number };
  silhouettes?: { count: number; animation: "sway" | "still"; namedSlots?: { characterId: string; instanceIndex: number }[] };
  transitionDurationMs: number;
}
```

The 3D engine (`WorldScene.tsx`) only ever reads `SceneBeat` objects, never sentence text — this is what makes it mood-agnostic and reusable across scenes via data, not code changes. `namedSlots` maps a `speakerId` to a silhouette instance for the echo-phrase feature (that silhouette pulses + shows a floating dialogue fragment when its character speaks).

## Narration sync architecture

**Superseded the original Web Speech API design** (kept only as a historical note below) — browser TTS voices sounded noticeably robotic. Narration now plays **pre-rendered audio** generated offline by `scripts/generate-narration-audio.ts` using Kokoro (an open-weight neural TTS model, via `@met4citizen/headtts`'s synthesis pipeline run once, CPU-only, no GPU, no account/API key). This keeps the "no live AI generation at runtime" rule fully intact — the deployed app makes zero AI-inference or network-TTS calls, only `fetch`es a small JSON manifest and plays `<audio>` elements, the same risk profile as loading an image.

- `src/lib/narrationController.ts` — plain TS module, **zero React/three.js knowledge**, sole owner of narration playback. Plays **one `<audio>` element per sentence**, chained via `onended` (not one clip for a whole paragraph) — bounds the damage of a playback error to a single sentence and makes pause/resume/seek robust. Sole writer to narration-position state in the store; this isolation is what prevents race conditions.
- **Word-boundary mapping**: each pre-rendered sentence has a matching entry in `public/narration/<passageId>/manifest.json` — `{ audioUrl, durationMs, words: [{ wordId, startMs, endMs }] }`, generated by the offline script alongside the audio itself (real timestamps from the TTS model, not inferred at runtime). `audio.ontimeupdate` binary-searches that array (`findWordIdAtTime`, "most recently started word") against `audio.currentTime`.
- **Cross-browser handling** is far simpler than the Web Speech API version: `<audio>` playback of a standard WAV file works consistently in every real browser, so there is no per-browser feature-detection, no voice-selection/fallback-list, and no synthetic WPM timer — the pre-rendered clip always has real, complete timing data.
- **Pause/resume**: `audio.pause()` / `audio.play()` — reliable and symmetric on every browser (no Safari-specific workaround needed, unlike `speechSynthesis.pause()`).
- **Seek**: clicking a sentence in the text pane cancels the current clip and plays the clicked sentence's clip from the start.
- **Tab backgrounding**: listen for `visibilitychange`; on return-to-visible, if the store says `'playing'` but the audio element reports `paused`, call `.play()` again to resync (some mobile browsers throttle background `<audio>`) — much lighter-weight than the old `speechSynthesis.speaking` cross-check, since `<audio>` doesn't have Web Speech API's history of silently dying in background tabs.
- **Missing/failed audio**: if a sentence has no manifest entry (manifest failed to load, or a future passage has no pre-rendered audio yet) or its `audio.play()`/`onerror` fails, warn once and skip to the next sentence — never crash, mirrors the old "Firefox has no speech synthesis → silent mode" graceful-degradation guarantee for a different failure cause.
- Always stop/detach the current audio element defensively before any critical operation (start/seek/pause/unmount) — same rationale as the old `speechSynthesis.cancel()` rule, adapted to `<audio>`.

`src/store/readingStore.ts` (Zustand) holds `currentSentenceIndex`, `currentWordId`, `activeSceneBeatId`, `activeSpeakerId`, `playbackState`. Left pane (`TextPane.tsx`) subscribes to word/sentence-level fields for highlighting + debounced auto-scroll (backs off if the user is manually scrolling). Right pane subscribes only to beat/speaker-level fields.

<details>
<summary>Historical: original Web Speech API design (superseded, kept for context)</summary>

Spoke one sentence per `SpeechSynthesisUtterance`, chained via `onend`. Word-boundary mapping built each utterance's text from the sentence's concatenated normalized words, kept a parallel `[{wordId, charStart, charEnd}]` offset table, and binary-searched it (tolerant range match) against `onboundary`'s `charIndex`. Cross-browser handling had to feature-detect whether boundary events fired at a per-word rate and fall back to a synthetic WPM-based timer when not (Safari, some voices), wait for `voiceschanged` before the first `speak()`, and pick voices from a preference-ordered fallback list. `speechSynthesis.pause()` was unreliable on Safari, requiring a `cancel()` + resume-at-sentence-start fallback. All of this complexity is what pre-rendering the audio offline eliminated.
</details>

## Three.js world (`src/components/WorldScene.tsx`)

- Fog + gradient background driven by `palette`.
- One large low-poly floor plane, subtle reflective material, catches bokeh light.
- **Crowd abstraction**: `InstancedMesh` of low-poly capsule/cone silhouettes (one draw call regardless of count), deterministic seeded scatter layout, slow per-instance sine sway in `useFrame`.
- **Particles**: `drei`'s `<Sparkles>` reused for all particle types by varying color/size/speed/count per beat.
- **Lighting**: one warm key light + ambient, both parameterized; `<Bloom>` for the glow.
- **Camera**: `useFrame`-driven rig with named scripted behaviors (`slow-orbit`, `static-drift`, `push-in`/`pull-back`).
- **Beat transitions**: `useLerpedSceneBeat` hook interpolates every numeric/color field each frame on beat change rather than snapping.
- **Echo-phrase feature**: when `activeSpeakerId` matches a `namedSlots` entry, that silhouette pulses (emissive/scale) and a short floating text fragment (drei `<Text>`/`<Html>`) fades in/out near it.
- **Deco skyline** (`world/DecoSkyline.tsx`): a ring of stepped "wedding cake" Art Deco ziggurat towers scattered on a fixed seed beyond the crowd's scatter radius, evoking the black-cutout-skyline-against-a-colored-sky painted backdrops of mid-century animated shorts. Each tower variant is a stack of tapered boxes merged into one geometry and instanced (one draw call per variant, four variants total); buildings are unlit flat silhouettes tinted per-beat from the palette's fog/background tones (never lit or swayed, only the tint lerps), plus a sparse points-based layer of gold window-lights colored from the palette's accent.
- **Deco paint grade** (`world/DecoPaintEffect.ts`, chained after `<Bloom>` in `PostProcessing.tsx`): a custom `postprocessing` `Effect` layering posterize color-banding, a soft edge-bleed blur, procedural canvas grain, a warm/cool split-tone grade, and a gold sunburst-ray + scalloped-vignette Deco ornament overlay — blending Gris's painterly softness with the flat-gouache backdrop art of golden-age (Tom & Jerry-style) animated shorts and Art Deco ornament motifs, tuned subtle so the scene still reads as itself, just painted.
- **Fullscreen constrained-orbit mode** (phase 3 stretch): toggle expands the pane to fullscreen and swaps in `OrbitControls` with tight distance/angle constraints, panning disabled. Narration keeps playing in the background.

## Build-time content generation

- `scripts/generate-scene-beats.ts` — offline Node script using the Anthropic/OpenAI key (local `.env`, gitignored) to help segment the Gatsby chapter text into `Passage`/`Sentence`/`Word` JSON and draft first-pass `SceneBeat` values. Treat AI output as a first draft — hand-tune lighting/color/timing by eye afterward. In practice the actual `gatsby-ch3.ts` data was produced by the simpler, deterministic `scripts/segment-passage.ts` instead (mechanical paragraph/sentence/word splitting doesn't benefit from an LLM call and can't truncate or fail the way an API call can) — `generate-scene-beats.ts` remains available for future books/excerpts.
- `scripts/generate-narration-audio.ts` — offline Node script, **no API key, no GPU, no network calls to any AI service**. Pre-renders one WAV file + a word-level timing manifest per sentence via Kokoro (an open-weight TTS model) run locally through `@met4citizen/headtts`'s synthesis worker. Output: `public/narration/<passageId>/{sentenceId}.wav` + `manifest.json`, committed to the repo (these are real deployed static assets, unlike the intermediate drafts below) and served by Vite/Vercel like any other static file.
  - Text→phoneme step is **not** HeadTTS's own dictionary lookup — that only ever reads a word's first listed pronunciation, so context-dependent words (e.g. "was") always come out in their emphatic/standalone form even mid-sentence. Instead, `scripts/misaki_g2p.py` (a small offline, build-time-only Python script — `pip install -r scripts/requirements-narration.txt`, see that file and the script's own header for the GPL-avoidance rationale) runs Misaki, the actual G2P engine Kokoro was trained against, and its output is fed to HeadTTS's worker directly via the `phonetic` input-item type, bypassing HeadTTS's phonemizer entirely while still using its (already-correct) audio synthesis and word-timing extraction. `generate-narration-audio.ts` shells out to it once per run (`PYTHON_BIN` env var to override which interpreter, default `python3`) — this is the one place in the build pipeline that isn't pure Node/TS.
  - Default voice is `af_sky` (Kokoro voice, preferred over `af_bella` after an A/B listen). A handful of words in the actual passage aren't in Misaki's dictionary and have hand-verified overrides in `misaki_g2p.py` (`SPELLING_OVERRIDES` for British spellings like "colour"/"coloured", `PHONEME_OVERRIDES` for the rest, e.g. the proper noun "Gilda") — if a future passage adds new out-of-dictionary words, the script fails loudly (non-zero exit, word named in stderr) rather than silently mispronouncing or skipping them.

Both scripts are fully isolated from `src/` and never imported by client code.

## Build Plan — today's prototype (~4–5h, parallelized via git worktrees)

Goal: a working, deployed vertical slice by end of day. Split into three phases so independent tracks can run in parallel worktrees without touching each other's files.

### Phase 0 — Foundation (sequential, ~30–45 min, on `main`)

Blocks everyone below — do this first, in one pass, on `main` directly:

1. Vite + React + TS (strict) + Tailwind scaffold; ESLint/Prettier minimal config.
2. `src/types.ts` — **frozen contract**: `Word`, `Sentence`, `Paragraph`, `Passage`, `SceneBeat` interfaces exactly as specified above. Do not change the shape once Phase 1 starts without re-syncing all tracks.
3. `src/store/readingStore.ts` — full Zustand store per the sync-architecture spec above (`currentSentenceIndex`, `currentWordId`, `activeSceneBeatId`, `activeSpeakerId`, `playbackState`, plus `play`/`pause`/`jumpToSentence` action signatures). Actions can be thin (state transitions only) — Track A wires real narration behavior into them later, but their *signatures* are frozen now.
4. `src/App.tsx` — final two-pane layout, already importing and rendering `<TextPane />` and `<WorldScene />` side by side. This file should not need to change again after Phase 0.
5. Stub component files so imports resolve immediately: `src/components/TextPane.tsx`, `src/components/WorldScene.tsx` (each just renders a placeholder), `src/lib/narrationController.ts` (no-op export), `src/data/gatsby-ch3.ts` + `src/data/scene-beats.json` (one trivial fixture entry each) — these are the exac
t files each Phase 1 track will own and overwrite.
6. GitHub → Vercel auto-deploy connected and verified with this placeholder state.
7. Commit and push to `main`. Create the four Phase 1 branches/worktrees from this commit.

```
git worktree add .worktrees/narration   -b feat/narration
git worktree add .worktrees/text-pane   -b feat/text-pane
git worktree add .worktrees/world-scene -b feat/world-scene
git worktree add .worktrees/content     -b feat/content
```

(add `.worktrees/` to `.gitignore`)

### Phase 1 — Parallel tracks (~2–2.5h, run simultaneously in separate worktrees)

Each track **only edits the files it owns** — this is what keeps merges conflict-free. Each track should test against a small local fixture (a hardcoded 2–3 sentence `Passage` / one `SceneBeat`) rather than waiting on another track's output, and swap to the real thing at integration.

| Track | Branch | Owns (only touches) | Depends on from Phase 0 | Done when |
|---|---|---|---|---|
| **Narration** | `feat/narration` | `src/lib/narrationController.ts` | `types.ts`, `readingStore.ts` action signatures | Given any fixture `Passage`, calling `play()` speaks sentence-by-sentence, `currentWordId`/`currentSentenceIndex` update in the store in step with a manual `console.log` or the store devtools, pause/resume/seek work, Safari fallback timer engages when boundary events are sparse |
| **Text pane / UI** | `feat/text-pane` | `src/components/TextPane.tsx`, its styles | `types.ts`, `readingStore.ts` (read-only) | Given fixture store state (settable via store devtools or a temporary debug button), the correct word/sentence highlight renders, auto-scroll works and backs off on manual scroll, layout is polished (serif type, spacing) |
| **World scene** | `feat/world-scene` | `src/components/WorldScene.tsx` and any sub-components/hooks it needs (camera rig, silhouettes, beat-lerp) | `types.ts`, `readingStore.ts` (read-only) | Given a fixture `activeSceneBeatId`, the scene renders fog/floor/silhouettes/particles/bloom/camera per that beat's params, and changing the fixture beat smoothly lerps between two beats |
| **Content** | `feat/content` | `src/data/gatsby-ch3.ts`, `src/data/scene-beats.json`, `scripts/generate-scene-beats.ts` | `types.ts` only | The Gatsby Ch.3 opening passage is segmented into valid `Passage` JSON conforming to `types.ts`, with 2–3 authored `SceneBeat`s (arrival / peak revelry) and `sceneBeatId`s assigned per paragraph |

### Phase 2 — Integration (sequential, ~1–1.5h, back on `main`)

1. Merge all four branches into `main` (low conflict risk since file ownership didn't overlap).
2. Swap every track's fixture data for the real thing: `App.tsx`'s children already point at the real components; `narrationController` now drives the store from `data/gatsby-ch3.ts`; `WorldScene` now reads beats from `data/scene-beats.json` via the store.
3. Run the manual QA checklist (see below) end-to-end.
4. Deploy, verify on the live Vercel URL in an incognito window.

### Beyond today's prototype (remaining 48h budget)

Once the above is deployed and solid, continue per the original scope-expansion plan: full party excerpt across more paragraphs, speaker attribution + echo-phrase feature, click-to-seek polish, fullscreen constrained-orbit mode, lighting/camera tuning pass, fallback states for unsupported browsers, and — only if the core is rock solid — a second scene to demonstrate engine reusability. Feature-freeze with time for a full QA pass and a recorded fallback demo before the 48h limit.

**Additional consideration — per-speaker narration voices.** To avoid the whole passage reading in one monotonous voice, map `speakerId` (already present on `Sentence`) to a distinct voice so named characters (e.g. Nick, Gatsby) sound audibly different from each other and from the unattributed narrator voice. With the pre-rendered-audio architecture, this means passing a different Kokoro voice name per speaker to `scripts/generate-narration-audio.ts` at generation time (Kokoro ships several distinct voices) rather than a runtime `SpeechSynthesisVoice` selection — still fully offline, still zero network/AI calls at runtime, so it doesn't touch the "no live AI generation at runtime" constraint. (Considered and rejected: a live-generation voice/avatar service like Lemonslice — that's a talking-head video pipeline, not a multi-voice narration tool, and it would violate the no-live-AI-at-runtime rule and the offline-reliability design of the narration architecture.)

## QA approach

Later added a Vitest + Testing Library baseline after all (see `src/**/*.test.ts(x)`) — genuinely useful for the pure/injectable-deps modules (`narrationController`, `beatMath`/`cameraMath`/`seededRandom`, data validation) once the codebase grew past a single afternoon's fixture. Still primarily relying on TypeScript strict mode + manual testing for the browser-API/WebGL-heavy UI itself. Manual checklist before every milestone deploy: fresh load in Chrome/Edge/Safari with no console errors; pause/resume with no overlapping audio; seek cancels cleanly; tab-backgrounding doesn't desync; resize doesn't break layout/canvas; text selection doesn't break highlighting; reload mid-passage resets cleanly; FPS stays smooth during word-boundary churn; narration audio actually plays on first click (autoplay-policy edge case) and word highlighting stays in sync with audible speech; a sentence with no manifest entry / a 404'd audio file is skipped without breaking playback; production build (`vite build && vite preview`) tested locally before trusting the live deploy.

---

## Working plan (temporary — doc agents will fold this into the permanent sections above once each track lands): Audio engagement + context-reactive visuals

### Context

The previous round of polish (narration prosody via a Misaki G2P bridge, the painted Deco post-process pass, and the Deco skyline backdrop — all merged into `main` at `17ba167`) fixed *pronunciation accuracy* and added a *first pass* at a painted identity, but two gaps remain that the user wants addressed now, as two separate workflows:

1. **Audio**: word-highlighting visibly lags the audio (a real latency bug, not a perception issue), the narrator voice still reads as monotonous/mechanical even though pronunciation is now correct, and the text-pane highlighting itself should be more visually interesting.
2. **Visual**: the world only shifts mood twice (a single `arrival` → `peak-revelry` cutover) despite the prose describing many distinct party "moments," and the Deco/Gris/Journey blend should go deeper than the existing post-process-only treatment (previously deliberately scoped out, now being revisited).

Investigation (3 parallel Explore passes + direct reads of `narrationController.ts`, `TextPane.tsx`, `generate-narration-audio.ts`, `misaki_g2p.py`, `beatMath.ts`, `WorldScene.tsx` and its `world/*` siblings) confirmed concrete, low-risk fixes exist for all of these — details below. User decisions locked in:
- Visual: full combo — expanded scene beats + material-level toon/gradient shading + a new foreground Deco motif.
- Audio: include mid-sentence pause insertion (in addition to the rAF latency fix and a voice/speed retrial), confirmed low-risk after reading the actual current pipeline (see Track A, item 2).

These two tracks touch **fully disjoint files**, so they're built as two separate git worktrees/branches (`feat/audio-engagement`, `feat/context-reactive-world`), matching this project's own established parallel-track convention, and merged back into `main` once each is independently verified.

### Track A — Audio engagement (branch: `feat/audio-engagement`)

#### A1. Fix word-highlight latency

**File**: `src/lib/narrationController.ts`.

Confirmed root cause: word-position updates are driven *purely* by `audio.ontimeupdate` (`narrationController.ts:332-339`), which is a real `<audio>` element event that only fires at a browser-throttled rate — not every frame — so `findWordIdAtTime` is working off stale `audio.currentTime` reads. This is the sole source of the lag (no debounce, no React-render bottleneck).

Fix: replace the `ontimeupdate`-driven update with a `requestAnimationFrame` loop that reads `audio.currentTime` every frame while a sentence is actively playing:
- Add `requestFrame`/`cancelFrame` to `NarrationControllerDeps` (default to `requestAnimationFrame`/`cancelAnimationFrame`, overridable in tests with a manually-steppable fake — same override pattern already used for `createAudio`/`fetchManifest`/`getDocument`).
- Add `rafId: number | null` and `currentEntry: NarrationManifestEntry | null` to `ControllerState` (the latter needed so `pause()`/resume can restart tracking on the same audio element without re-deriving `entry`).
- Add `startWordTracking(audio, entry, myEpoch)` / `stopWordTracking()` helpers: the tick function reads `audio.currentTime`, calls `findWordIdAtTime`, and only calls `store.setState({ currentWordId })` (+ `maybeFireMotif`) when the resolved id actually *changes* from the last-applied value (avoid redundant re-renders every frame).
- Call `startWordTracking` right after `audio.play()` is issued in `playCurrentSentence()` (`narrationController.ts:367-376`); call `stopWordTracking()` inside `detachCurrentAudio()` (`:235-243`, covers start/seek/destroy paths for free) and explicitly in `pause()` (`:484-489`, which doesn't call `detachCurrentAudio()` since it wants to resume the same element); restart tracking in `play()`'s resume branch (`:443-457`) using `state.currentAudio`/`state.currentEntry`.
- Remove the `ontimeupdate` handler entirely (superseded, not kept as a fallback — one driver, not two racing).

**Test updates**: `src/lib/narrationController.test.ts` uses a fake `AudioLike` harness — extend it with fake `requestFrame`/`cancelFrame` overrides that capture the callback so tests can manually "step" frames deterministically (no real timers), updating any test that currently asserts on `ontimeupdate`-driven word updates.

#### A2. Reduce voice monotony (regenerate `public/narration/gatsby-ch3/*`)

**Files**: `scripts/generate-narration-audio.ts` only (Python bridge `misaki_g2p.py` untouched — the pause insertion below is pure post-processing on the already-returned phonetic items, no G2P changes needed).

Confirmed current state (re-read the *actual* current file, not the stale version from before the Misaki G2P work landed): a voice/speed A/B trial harness *already exists* (`--voice`/`--speed`/`--trial` CLI flags, `scripts/generate-narration-audio.ts:70-114`, output to `scripts/output/voice-trials/<voice>-<speed>/`) and was already used once to pick `af_sky` over `af_bella` (recorded in memory). What was **never** pushed past the default is `speed` (`SPEED = cliArgs.speed ?? 1`, line 106) — the exact lever the earlier investigation identified as most directly addressing "pronouncing every syllable" (higher speed compresses inter-syllable gaps). Three concrete additions:

1. **Re-run the existing trial harness** at `af_sky` speed `~1.08-1.15` (a couple of values), listen, pick a winner. No new tooling needed — just use what's there (`npx tsx scripts/generate-narration-audio.ts --voice af_sky --speed 1.1`).
2. **Deterministic per-sentence speed micro-jitter**: a small self-contained hash function (can't import `src/`'s `seededRandom.ts` — scripts stay isolated from `src/` per this doc's own rule) mapping each `sentence.id` to a small ±0.03-0.05 offset from the winning base speed, so cadence isn't perfectly metronomic sentence-to-sentence.
3. **Mid-sentence pause insertion**: confirmed low-risk after reading the current pipeline —
   - `buildPhoneticInputItems` (`generate-narration-audio.ts:272-303`) already returns an **array** of one `PhoneticInputItem` per word (not a single string — this changed when the Misaki bridge landed), so inserting a new item type between existing entries is a natural fit, not a restructuring.
   - Confirmed via `node_modules/@met4citizen/headtts/modules/language.mjs:255-258` and `worker-tts.mjs:332,377,383` that a `{type: 'break', value: ms}` item produces **no entry** in `metadata.words`/`wtimes`/`wdurations` (it only contributes to a separate `silences` array consumed by `updateTimestamps`/`insertSilences`) — so inserting breaks cannot desync `alignWordTimings`'s strict word-count/text matching against `sentence.words`.
   - Add `insertPauseBreaks(items: PhoneticInputItem[], sentence: Sentence): (PhoneticInputItem | BreakInputItem)[]`: walks each word's original `.text` (trailing punctuation intact) and inserts a `{type: 'break', value: N}` after words ending in `,`/`;`/`:`/`—`/`–` (regex-detected), with duration varying by punctuation weight (commas shorter ~90-140ms, semicolons/colons/dashes longer ~150-220ms — mirrors how a human reader actually paces these differently). Add a `BreakInputItem` interface alongside `PhoneticInputItem` and widen `synthesizeSentence`'s `input` parameter type to the union array.
   - Call this after `buildPhoneticInputItems` succeeds, before `synthesizeSentence`.
4. Re-run the full (non-trial) `npm run generate:narration`, re-verify 19/19 sentences with no `NaN`/failed alignments (same check every prior narration commit has done), listen through the full passage end-to-end before committing.

#### A3. Richer dual-level highlight UI

**File**: `src/components/TextPane.tsx`.

Confirmed current state: both levels **already** render distinctly (`TextPane.tsx:252-254` sentence gets a soft `bg-amber-400/10` wash with a 300ms transition; `:260-263` the active word gets a solid `bg-amber-400/80` block, no transition) — so this is enrichment, not building dual-highlighting from scratch. Two concrete additions:
1. Add a transition on the word highlight itself (currently instant on/off) — a quick fade/glow-in (`transition-colors` + a subtle `box-shadow`/text-glow) so the word doesn't hard-cut.
2. Tie the sentence-level wash's tint to the *currently active scene beat's* palette accent color (subscribe `activeSceneBeatId` from the store, look up its `palette.accent` from `src/data/scene-beats.json` — import it the same way `MotifEffects.tsx` imports `motifs.json`, build an `id -> accent` map via `Object.fromEntries`), applied as an inline CSS custom property on the active sentence's wrapper so the highlight hue shifts with the world's mood instead of staying fixed amber. This is a nice free synergy with Track B's expanded beats (more beats = more visible hue variety in the text pane too) and stays entirely within `TextPane.tsx` — no R3F/store-shape changes, doesn't touch the "word-level state never reaches three.js" rule.

**Test updates**: re-run `src/components/TextPane.test.tsx` (15 existing tests check word/sentence text content, click-to-seek, and accessible names — none assert on exact highlight styling, so this should be additive-safe, but verify after the change).

### Track B — Context-reactive visuals (branch: `feat/context-reactive-world`)

#### B1. Expand scene beats to match the prose's actual party "moments"

**Files**: `src/data/scene-beats.json`, `src/data/gatsby-ch3.ts` (reassign `sceneBeatId` per sentence only — word/sentence/paragraph structure itself is untouched).

Confirmed current state: `sceneBeatId` already lives on `Sentence` (not `Paragraph`), so per-sentence granularity is already the contract; it's just that only **2** `SceneBeat`s exist (`scene-beats.json`) and all 19 sentences get one hard binary split at `p4-s3` (12 sentences `arrival`, 7 `peak-revelry`). Confirmed distinct "moments" currently flattened into one bucket: `p1-s3` (daytime diving/motorboats), `p1-s4` (weekend Rolls-Royce/cars), `p3-s3` (bar setup), `p4-s1` (orchestra tuning up, still tagged `arrival`), `p4-s3` (bar in full swing — first `peak-revelry` sentence), `p5-s1` (orchestra playing/dancing). Confirmed the lerp architecture (`beatMath.ts`'s `lerpSceneBeat`, `useLerpedSceneBeat`'s `snapshotAsBeat`) already generalizes to any number of beats and handles rapid/interrupted transitions gracefully (blends onward from current on-screen state rather than jumping) — **no code changes needed there**, only data.

Plan:
1. Author ~6-8 `SceneBeat`s covering the confirmed distinct moments above plus whatever else the full text describes (read `gatsby-ch3.ts` in full at implementation time to place the remaining sentences — this is a hand-authored creative pass, same as the original 2-beat authoring was, not something to guess from partial quotes). Aim for a coherent day-progressing-to-night mood arc (e.g. dusk arrival → bright daytime leisure → busy weekend traffic → quiet Monday-after lull → evening bar setup → orchestra tuning → full-swing cocktails → dancing under lights), varying palette/lighting/particles/camera/silhouette-count per beat, reusing the existing 4 `camera.behavior` values (`slow-orbit`/`static-drift`/`push-in`/`pull-back` — adding a 5th would require a new `cameraMath.ts` switch case; stay within the existing 4 to keep scope contained).
2. Shorten `transitionDurationMs` from the current 1500-2000ms to roughly 900-1300ms given much more frequent switching (per-sentence rather than twice-total).
3. Reassign every sentence's `sceneBeatId` in `gatsby-ch3.ts` to the new ids.
4. Optional/low-priority: update `scripts/generate-scene-beats.ts`'s LLM prompt (currently explicitly says "propose 2-3 beats total") to reflect the richer granularity, for future reuse on other passages — doc-consistency only, this script isn't in the actual authoring path.

#### B2. Material-level painterly (Gris/Deco) treatment

**Files**: `src/components/world/Floor.tsx`, `src/components/world/Silhouettes.tsx`, new `src/components/world/toonGradientTexture.ts`.

Confirmed current state: both currently use flat `MeshStandardMaterial` with no texture maps at all — the only "painted" quality today comes from the global post-process pass, nothing at the geometry/material level. This was explicitly deferred in the prior round; now revisited.

- New `toonGradientTexture.ts`: builds a small (e.g. 4-step) grayscale `THREE.DataTexture` once (module-scope singleton, lazily created) with `minFilter`/`magFilter = THREE.NearestFilter` (critical — smooth filtering would defeat the discrete-band toon look) — the standard three.js toon-shading gradient-map recipe, no external image asset.
- `Floor.tsx`: swap `meshStandardMaterial` → `meshToonMaterial`, drop `metalness`/`roughness` (not applicable to `MeshToonMaterial`), add the shared `gradientMap`. Keep the existing per-frame `color.set(...)` mutation unchanged.
- `Silhouettes.tsx`: same material swap. `MeshToonMaterial` supports `emissive`/`emissiveIntensity` the same as `MeshStandardMaterial`, so the existing emissive-rim lerp logic (`Silhouettes.tsx:133-142`) needs no changes beyond the material tag + `gradientMap`.
- This gives the crowd/floor actual cel-shaded lighting *response* (discrete light/shadow bands), complementing the existing post-process posterize at the geometry level instead of relying on it alone — directly what "more developed" painterly blending means.

#### B3. Foreground Deco motif (fountain + wrought-iron railing)

**File**: new `src/components/world/DecoFountain.tsx`, wired into `WorldScene.tsx`'s `WorldSceneContents` alongside `DecoSkyline` etc.

Directly inspired by user-supplied reference images (gouache Deco fountain + scalloped fan canopy + wrought-iron railing night scene). Reuses `DecoSkyline.tsx`'s proven pattern (seeded/fixed placement, merge-many-geometries-once via `mergeGeometries`, tint from `lerped.palette`/`lighting` in `useFrame`, no per-frame geometry recompute):
- A stepped circular fountain basin: 2-3 tapering `CylinderGeometry` rings merged into one shape, placed at a fixed mid-ground position (inside the crowd's radius, offset to one side so it doesn't block the camera rig's typical framing).
- A simple water-spray suggestion (a couple of thin cones or tubes) with a very cheap upward-drift `useFrame` animation (not a rigged character, so no conflict with the "no rigged/animated characters" rule).
- A short wrought-iron-scroll railing silhouette in the near-foreground (simple repeating flat post-and-rail shapes, unlit `MeshBasicMaterial` matching `DecoSkyline`'s silhouette treatment) — evokes the reference images' ironwork without needing complex curve extrusion.
- Tinted per-beat like `DecoSkyline` (dark silhouette + accent highlights); static geometry, cheap `useFrame` (color lerp only, plus the small spray drift).
- **Priority note**: sequence this after B1 and B2 — if time runs short, the scene-beat expansion and material treatment are the higher-value, lower-risk deliverables; this is the stretch item.

### Execution strategy

Two git worktrees/branches (`feat/audio-engagement`, `feat/context-reactive-world`) created from `main`, matching this project's established parallel-track convention. File ownership is fully disjoint between the two tracks (Track A touches `scripts/generate-narration-audio.ts`, `src/lib/narrationController.ts`(+test), `src/components/TextPane.tsx`(+test), and regenerated `public/narration/gatsby-ch3/*`; Track B touches `src/data/scene-beats.json`, `src/data/gatsby-ch3.ts`, `src/components/world/Floor.tsx`, `src/components/world/Silhouettes.tsx`, new `toonGradientTexture.ts` + `DecoFountain.tsx`, `src/components/WorldScene.tsx`), so both run concurrently and are reviewed/merged into `main` sequentially once each is independently verified — never leaving `main` mid-feature.

### Verification

- Each track independently: `npm run lint && npm run test && npm run build` clean before merge.
- Track A: listen through the full passage post-regeneration (subjective call on monotony/pacing), confirm word-highlight visually tracks the audio tighter than before (manual browser check), confirm no overlapping-audio/pause-resume regressions per the existing manual QA checklist.
- Track B: manual playthrough via `npm run dev` across the new beat sequence — confirm the mood arc reads as a coherent progression, confirm the toon material swap doesn't tank FPS or look broken against existing lighting, confirm the new fountain/railing sit correctly in the frame across camera behaviors and don't clip through the crowd/skyline, confirm the already-shipped `MotifEffects`/`DecoPaintEffect`/`DecoSkyline` still render correctly alongside all of this (no regressions).
- After each merge into `main`: full lint/test/build once more on `main`, then a final combined manual playthrough with both tracks merged together before considering the session's work demo-ready.
