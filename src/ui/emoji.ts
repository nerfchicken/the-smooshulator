/** Split a string into user-perceived characters (grapheme clusters). */
export function graphemes(text: string): string[] {
  type Segmenter = { segment(s: string): Iterable<{ segment: string }> };
  const Ctor = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => Segmenter }).Segmenter;
  let parts: string[];
  if (typeof Ctor === 'function') {
    parts = Array.from(new Ctor(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  } else {
    // Code-point fallback: drop lone variation selectors / joiners / skin tones.
    parts = Array.from(text).filter((g) => !/^[︎️‍\u{1F3FB}-\u{1F3FF}]$/u.test(g));
  }
  return parts.filter((g) => g.trim().length > 0);
}

/** Title-case a slug/id like "typed:ice-cream" -> "Ice Cream". */
export function wordFromId(id: string): string {
  return id
    .replace(/^typed:/, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
