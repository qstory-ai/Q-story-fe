/**
 * The on-demand TTS backend (NarrationContractValidator) rejects any control character in `text`,
 * including a literal newline - but multi-sentence fallback/branch lines carry '\n' between
 * sentences by design (see the story package's manifest tests, which do the same flattening to
 * compare against pre-recorded audio transcripts). Flatten at the network boundary, right before
 * building a /v1/narrations(/stream) request body, so on-screen captions can keep their line
 * breaks while only the wire payload is squashed to what the backend actually accepts. Every
 * caller of that endpoint (narrate-story and route-question's narration clients) must run its
 * `text` through this first.
 */
export function sanitizeNarrationText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
