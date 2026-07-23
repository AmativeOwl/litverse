// Plain TS module, zero React/three.js knowledge — sole owner of the
// SpeechSynthesisUtterance lifecycle. No-op stub; Track A (feat/narration) implements this.

export function play(): void {}

export function pause(): void {}

export function seekToSentence(_sentenceIndex: number): void {}
