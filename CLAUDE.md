# Litverse

Immersive two-pane reading experience for *The Great Gatsby* (Chapter 3 party scene). Left pane: book text with Speechify-style word/sentence highlighting synced to narration. Right pane: a reactive, game-like 3D "world" (Journey/Gris-style minimal atmospheric visuals) that shifts mood as the reader progresses. 48-hour solo build; must be deployed with zero bugs.

## Design constraints (do not violate)

- **No rigged/animated 3D characters.** Crowd/characters are rendered abstractly (instanced silhouettes + particles + lighting), not modeled/rigged figures.
- **No live AI generation at runtime.** AI (Anthropic/OpenAI key) is used only in an offline build-time script (`scripts/generate-scene-beats.ts`) to help segment text and draft scene-beat metadata. Never call an LLM/image-gen API from the deployed client. Keep the key out of any bundled module.
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

- `src/lib/narrationController.ts` — plain TS module, **zero React/three.js knowledge**, sole owner of the `SpeechSynthesisUtterance` lifecycle. Speaks **one sentence per utterance**, chained via `onend` (not one utterance for a whole paragraph) — bounds the damage of a missed boundary event to a single sentence and makes pause/resume/seek robust. Sole writer to narration-position state in the store; this isolation is what prevents race conditions.
- Word-boundary mapping: build each utterance's text from the sentence's concatenated normalized words, keep a parallel `[{wordId, charStart, charEnd}]` offset table, and binary-search it (tolerant range match, not exact equality) against `onboundary`'s `charIndex`.
- **Cross-browser handling**: feature-detect whether boundary events fire at a per-word rate; if not (Safari, some voices), fall back to a synthetic WPM-based timer that advances `currentWordId`, resyncing at every sentence boundary regardless. Firefox may have no speech synthesis — degrade to silent manual-reading mode, never crash. Always wait for `voiceschanged` (with timeout) before first `speak()`; pick voices from a preference-ordered fallback list, never a hardcoded name.
- **Pause/resume**: prefer `speechSynthesis.pause()`, but on Safari (unreliable) fall back to `cancel()` + remember sentence index, resuming at sentence start rather than exact word — an accepted, explicit tradeoff.
- **Seek**: clicking a sentence in the text pane cancels the current utterance and speaks from the clicked sentence.
- **Tab backgrounding**: listen for `visibilitychange`; on return-to-visible, verify `speechSynthesis.speaking` matches the store's `playbackState` and resync rather than silently drifting.
- Always `speechSynthesis.cancel()` defensively before any critical operation (start/seek/pause/unmount) — the speech queue is a shared global and stale pending utterances will otherwise cause silent no-ops.

`src/store/readingStore.ts` (Zustand) holds `currentSentenceIndex`, `currentWordId`, `activeSceneBeatId`, `activeSpeakerId`, `playbackState`. Left pane (`TextPane.tsx`) subscribes to word/sentence-level fields for highlighting + debounced auto-scroll (backs off if the user is manually scrolling). Right pane subscribes only to beat/speaker-level fields.

## Three.js world (`src/components/WorldScene.tsx`)

- Fog + gradient background driven by `palette`.
- One large low-poly floor plane, subtle reflective material, catches bokeh light.
- **Crowd abstraction**: `InstancedMesh` of low-poly capsule/cone silhouettes (one draw call regardless of count), deterministic seeded scatter layout, slow per-instance sine sway in `useFrame`.
- **Particles**: `drei`'s `<Sparkles>` reused for all particle types by varying color/size/speed/count per beat.
- **Lighting**: one warm key light + ambient, both parameterized; `<Bloom>` for the glow.
- **Camera**: `useFrame`-driven rig with named scripted behaviors (`slow-orbit`, `static-drift`, `push-in`/`pull-back`).
- **Beat transitions**: `useLerpedSceneBeat` hook interpolates every numeric/color field each frame on beat change rather than snapping.
- **Echo-phrase feature**: when `activeSpeakerId` matches a `namedSlots` entry, that silhouette pulses (emissive/scale) and a short floating text fragment (drei `<Text>`/`<Html>`) fades in/out near it.
- **Fullscreen constrained-orbit mode** (phase 3 stretch): toggle expands the pane to fullscreen and swaps in `OrbitControls` with tight distance/angle constraints, panning disabled. Narration keeps playing in the background.

## Build-time content generation

`scripts/generate-scene-beats.ts` — offline Node script using the Anthropic/OpenAI key (local `.env`, gitignored) to help segment the Gatsby chapter text into `Passage`/`Sentence`/`Word` JSON and draft first-pass `SceneBeat` values. Treat AI output as a first draft — hand-tune lighting/color/timing by eye afterward. This script is fully isolated from `src/` and never imported by client code.

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

## QA approach

No automated test suite (Jest/Vitest/RTL) — deliberately cut given the 48h budget and low bug-catching yield for a browser-API/WebGL-heavy UI relative to manual testing; TypeScript strict mode is the substitute. Manual checklist before every milestone deploy: fresh load in Chrome/Edge/Safari with no console errors; pause/resume with no overlapping audio; seek cancels cleanly; tab-backgrounding doesn't desync; resize doesn't break layout/canvas; text selection doesn't break highlighting; reload mid-passage resets cleanly; FPS stays smooth during word-boundary churn; Safari fallback-timer path actually engages; empty `getVoices()` handled without throwing; production build (`vite build && vite preview`) tested locally before trusting the live deploy.
