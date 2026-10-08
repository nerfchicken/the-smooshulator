import { describe, expect, it } from 'vitest';
import { composite, firstGlyph, glyphs, glyphsFallback, lastGlyph } from '../../src/engine/emoji';

describe('glyphs (Intl.Segmenter path)', () => {
  it('keeps variation selectors, ZWJ sequences and skin tones together', () => {
    expect(glyphs('🛏️👨')).toEqual(['🛏️', '👨']);
    expect(glyphs('🏴‍☠️🐉')).toEqual(['🏴‍☠️', '🐉']);
    expect(glyphs('👍🏽a')).toEqual(['👍🏽', 'a']);
  });

  it('firstGlyph / lastGlyph / composite', () => {
    expect(firstGlyph('🛏️👨')).toBe('🛏️');
    expect(lastGlyph('🛏️👨')).toBe('👨');
    expect(lastGlyph('🐉')).toBe('🐉');
    expect(lastGlyph('')).toBe('');
    expect(composite('🛏️👨', '🐉🦑')).toBe('🛏️🐉');
  });
});

describe('glyphsFallback (no Intl.Segmenter)', () => {
  it('matches the segmenter for the emoji the game uses', () => {
    for (const s of ['🛏️👨', '🏴‍☠️🐉', '👍🏽a', '☀️', '🌧️x', '🐻‍❄️', '1️⃣2️⃣', 'cat', '', '🐱🐱']) {
      expect(glyphsFallback(s), JSON.stringify(s)).toEqual(glyphs(s));
    }
  });

  it('never splits a surrogate pair', () => {
    for (const g of glyphsFallback('a🐱b🦑')) expect(g).not.toMatch(/[\ud800-\udfff]/u);
  });
});
