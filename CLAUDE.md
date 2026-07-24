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
