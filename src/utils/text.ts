/** Collapse whitespace and trim for cleaner JD text. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Simple hash for deduping / short storage keys (not crypto). */
export function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/** First N chars of text for previews / stored excerpts. */
export function excerpt(text: string, max = 2000): string {
  const t = normalizeWhitespace(text);
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}
