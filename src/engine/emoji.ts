/**
 * Emoji glyph helpers. A card's `emoji` is one or two grapheme clusters; the
 * UI renders a two-glyph string as a composite picture.
 */

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** Split a string into grapheme clusters (keeps 🛏️'s variation selector attached). */
export function glyphs(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

/** First glyph of an emoji string (so composites don't grow past two). */
export function firstGlyph(emoji: string): string {
  return glyphs(emoji)[0] ?? '';
}

/** Two-glyph composite of two cards' emoji. */
export function composite(a: string, b: string): string {
  return firstGlyph(a) + firstGlyph(b);
}
