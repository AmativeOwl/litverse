#!/usr/bin/env python3
"""
scripts/misaki_g2p.py

OFFLINE, BUILD-TIME ONLY. Companion to generate-narration-audio.ts.

HeadTTS's own text->phoneme step (see language.mjs's addToDictionary) only
ever reads a word's *first* listed pronunciation, so every occurrence of a
word like "was" comes out in its emphatic/standalone form even when it's
just a passing function word in a sentence ("There was music..."). Real
contextual G2P is what actually solves this, so this script runs Misaki
(github.com/hexgrad/misaki) -- the G2P engine Kokoro itself was trained
against -- to get correct per-word phonemes, which generate-narration-audio.ts
then feeds to HeadTTS's synthesis worker directly via its `phonetic` input
type, bypassing HeadTTS's weaker dictionary lookup entirely while still
using its (already-correct) audio synthesis and word-timing extraction.

Deliberately installed WITHOUT the `misaki[en]` extra: that extra pulls in
`phonemizer`, a GPL-licensed wrapper around the espeak-ng binary, used only
as an optional fallback for out-of-dictionary words. This project avoids
GPL dependencies (see HeadTTS's own README rationale for the same reason),
so this script constructs `en.G2P(fallback=None)` and never imports
`misaki.espeak`. Setup: `pip install misaki spacy num2words` (the small
`en_core_web_sm` spacy model, ~13MB, downloads once on first run, same
one-time-asset pattern as the Kokoro ONNX weights and voice .bin files).

Any word Misaki can't resolve without the espeak fallback (phonemes=None)
is a hard failure, not silently skipped -- printed to stderr and reported
as null in the output so the caller can catch it, mirroring
generate-narration-audio.ts's own "hard failure over silent mis-map" rule
for word-alignment mismatches.

Known dictionary gap: Misaki's US-English lexicon doesn't cover a class of
British spellings ("colour", "favour", "honour", "humour", "labour", ...;
note some -our words it DOES have, e.g. "neighbour", "harbour"). Worse,
unlike a normal out-of-dictionary word, these make `en.G2P.__call__` raise
a raw TypeError internally instead of returning phonemes=None, because its
final `''.join(t.phonemes + t.whitespace for t in tokens)` step doesn't
expect a None. SPELLING_OVERRIDES below maps specific known-bad words (found
by running this script over the actual passage, not guessed) to their
already-dictionary-resolvable American spelling; the override is substituted
into the text sent to Misaki, but the *original* spelling is kept in the
output's "text" field, so the manifest and subtitles are unaffected.

A second class of gaps -- genuinely out-of-dictionary words with no
respelling shortcut (a rare compound like "pulpless", an archaic one like
"pitful", or a proper noun like "Gilda") -- gets PHONEME_OVERRIDES instead:
a literal, hand-verified phoneme string (built from real dictionary hits for
the word's parts or close analogues, e.g. "pulpless" = "pulp" (pˈʌlp, in
dict) + the same unstressed "-less" suffix reduction seen in "careless" ->
kˈɛɹləs), used only as a last resort after the whole-sentence and per-word
Misaki attempts both fail.

Usage: reads {"sentences": [{"id": str, "text": str}, ...]} as JSON on
stdin, writes {"sentences": {id: [{"text": str, "phonemes": str|null}, ...]}}
as JSON (UTF-8) on stdout. Never imported by client code, never part of the
Vite build/CI.
"""

import json
import re
import sys

# British spelling -> already-dictionary-resolvable American spelling.
# Found by running this script over the real Gatsby ch.3 passage; add more
# here (never guess a blanket "-our -> -or" rule, since plenty of English
# words that end in "our" -- hour, flour, your, tour, sour -- are NOT this
# British/American pair and would be mangled by a suffix-strip heuristic).
SPELLING_OVERRIDES = {
    "coloured": "colored",
    "colours": "colors",
    "colour": "color",
}
_REVERSE_OVERRIDES = {american: british for british, american in SPELLING_OVERRIDES.items()}
_OVERRIDE_PATTERN = re.compile(r"[A-Za-z']+")

# word (lowercase, no punctuation) -> literal Kokoro/Misaki-alphabet phoneme string.
PHONEME_OVERRIDES = {
    "pulpless": "pˈʌlpləs",
    "pitful": "pˈɪtfəl",
    "gilda": "ɡˈɪldə",
}
_WORD_CORE_PATTERN = re.compile(r"^([^A-Za-z']*)([A-Za-z']+)([^A-Za-z']*)$")


def _apply_overrides(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        word = match.group(0)
        american = SPELLING_OVERRIDES.get(word.lower())
        if american is None:
            return word
        return american.capitalize() if word[:1].isupper() else american

    return _OVERRIDE_PATTERN.sub(replace, text)


def _restore_overridden_spelling(token_text: str) -> str:
    british = _REVERSE_OVERRIDES.get(token_text.lower())
    if british is None:
        return token_text
    return british.capitalize() if token_text[:1].isupper() else british


def _phonemize_word_with_overrides(g2p, word: str) -> list["_LiteralToken"]:
    """
    Handles a single whitespace-delimited word during the per-word fallback.
    If its letters-only core matches PHONEME_OVERRIDES, returns that literal
    phoneme directly (skipping Misaki, which would just crash on it again),
    with any attached leading/trailing punctuation passed through as its own
    literal-phoneme token (punctuation characters are their own phonemes in
    this alphabet, same as elsewhere in this pipeline). Otherwise defers to
    Misaki as usual and lets any remaining failure propagate to the caller.
    """
    match = _WORD_CORE_PATTERN.match(word)
    if match:
        prefix, core, suffix = match.groups()
        override = PHONEME_OVERRIDES.get(core.lower())
        if override is not None:
            tokens = []
            if prefix:
                tokens.append(_LiteralToken(prefix, prefix))
            tokens.append(_LiteralToken(core, override))
            if suffix:
                tokens.append(_LiteralToken(suffix, suffix))
            return tokens

    _, word_tokens = g2p(_apply_overrides(word))
    for token in word_tokens:
        token.text = _restore_overridden_spelling(token.text)
    return word_tokens


def _phonemize_sentence(g2p, text: str):
    """
    Phonemizes a full sentence in one call for correct cross-word context
    (weak forms, stress). Misaki's G2P raises a raw TypeError (rather than
    returning phonemes=None) for certain out-of-dictionary words -- e.g. a
    class of British spellings not in its US lexicon (see SPELLING_OVERRIDES)
    -- which would otherwise take down phonemization for the whole sentence.
    On such a crash, falls back to phonemizing word-by-word (losing
    cross-word context only for this one sentence) so the *other* words
    still get real phonemes and any still-unresolvable word is reported
    individually instead of masking the rest of the sentence.
    """
    try:
        _, tokens = g2p(_apply_overrides(text))
        for token in tokens:
            token.text = _restore_overridden_spelling(token.text)
        return tokens, False
    except Exception as error:
        print(f'  -- whole-sentence G2P failed ({error!r}), retrying word-by-word', file=sys.stderr)
        tokens = []
        degraded = False
        for word in text.split():
            try:
                tokens.extend(_phonemize_word_with_overrides(g2p, word))
            except Exception as word_error:
                print(f'  -- no phonemes for "{word}": {word_error!r}', file=sys.stderr)
                tokens.append(_LiteralToken(word, None))
            degraded = True
        return tokens, degraded


class _LiteralToken:
    def __init__(self, text: str, phonemes: str | None) -> None:
        self.text = text
        self.phonemes = phonemes


def main() -> int:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    from misaki import en

    payload = json.load(sys.stdin)
    sentences = payload["sentences"]

    print(f"Loading Misaki English G2P ({len(sentences)} sentence(s))...", file=sys.stderr)
    g2p = en.G2P(trf=False, british=False, fallback=None)

    result = {}
    had_failure = False
    for sentence in sentences:
        sentence_id = sentence["id"]
        text = sentence["text"]
        tokens, degraded = _phonemize_sentence(g2p, text)
        entries = []
        for token in tokens:
            if token.phonemes is None:
                had_failure = True
                print(
                    f'{sentence_id}: no phonemes for "{token.text}" (out of Misaki\'s dictionary, '
                    f"and no espeak fallback is wired up -- add a manual override).",
                    file=sys.stderr,
                )
            entries.append({"text": token.text, "phonemes": token.phonemes})
        result[sentence_id] = entries
        status = "OK (word-by-word fallback, degraded prosody)" if degraded else "OK"
        print(f"  {sentence_id}: {status} ({len(entries)} tokens)", file=sys.stderr)

    json.dump({"sentences": result}, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")

    return 1 if had_failure else 0


if __name__ == "__main__":
    sys.exit(main())
