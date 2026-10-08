/**
 * Emoji glyph helpers. A card's `emoji` is one or two grapheme clusters; the
 * UI renders a two-glyph string as a composite picture.
 */

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * Grapheme-ish clusters without Intl.Segmenter (Safari < 14.1, Firefox < 125):
 * keycaps (1️⃣), flags (🇳🇿), pictographs with VS16 / skin tone / ZWJ chains
 * (🛏️ 👍🏽 🏴‍☠️ 🐻‍❄️), then any code point with its combining marks.
 */
const GLYPH_RE =
  /[0-9#*]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*|.\p{M}*/gsu;

export function glyphsFallback(text: string): string[] {
  return text.match(GLYPH_RE) ?? [];
}

/** Split a string into grapheme clusters (keeps 🛏️'s variation selector attached). */
export function glyphs(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return glyphsFallback(text);
}

/** First glyph of an emoji string (so composites don't grow past two). */
export function firstGlyph(emoji: string): string {
  return glyphs(emoji)[0] ?? '';
}

/** Last glyph of an emoji string (the noun side of a discovered card's composite). */
export function lastGlyph(emoji: string): string {
  const g = glyphs(emoji);
  return g[g.length - 1] ?? '';
}

/** Two-glyph composite of two cards' emoji. */
export function composite(a: string, b: string): string {
  return firstGlyph(a) + firstGlyph(b);
}
