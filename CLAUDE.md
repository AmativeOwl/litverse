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

## Milestones (48h)

- **M0 (h0–2)** — Vite/Tailwind/R3F/Zustand scaffold, placeholder two-pane layout, GitHub → Vercel auto-deploy verified working.
- **M1 (h2–14)** — Vertical slice: one hand-authored paragraph fully working end-to-end (narration, highlighting, one tuned `SceneBeat`). Deploy. Do not proceed until bug-free per QA checklist.
- **M2 (h14–30)** — Full party excerpt, 2–3 more scene beats, speaker attribution + echo-phrase feature, click-to-seek. Deploy after every meaningful chunk.
- **M3 (h30–46)** — Polish pass (lighting/camera/timing tuning), fallback states, fullscreen constrained-orbit mode, optional second scene if M1–M2 are solid.
- **M4 (h46–48)** — Feature freeze, full QA pass on the actual demo machine, final deploy verification, recorded fallback demo.

## QA approach

No automated test suite (Jest/Vitest/RTL) — deliberately cut given the 48h budget and low bug-catching yield for a browser-API/WebGL-heavy UI relative to manual testing; TypeScript strict mode is the substitute. Manual checklist before every milestone deploy: fresh load in Chrome/Edge/Safari with no console errors; pause/resume with no overlapping audio; seek cancels cleanly; tab-backgrounding doesn't desync; resize doesn't break layout/canvas; text selection doesn't break highlighting; reload mid-passage resets cleanly; FPS stays smooth during word-boundary churn; Safari fallback-timer path actually engages; empty `getVoices()` handled without throwing; production build (`vite build && vite preview`) tested locally before trusting the live deploy.
