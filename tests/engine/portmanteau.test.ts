import { describe, expect, it } from 'vitest';
import { makePortmanteau } from '../../src/engine/portmanteau';

describe('makePortmanteau — research.md §5 fixtures', () => {
  it.each([
    ['blanket', 'daddy', 'Blankaddy'],
    ['cat', 'rocket', 'Catocket'],
    ['pizza', 'unicorn', 'Pizzunicorn'],
    ['poop', 'princess', 'Poopincess'],
    ['sun', 'moon', 'Sunoon'],
    ['cat', 'dog', 'Catog'],
    ['dragon', 'toothbrush', 'Dragoothbrush'],
    ['zoo', 'cat', 'Zoot'],
    ['cake', 'monkey', 'Cakonkey'],
    ['robot', 'banana', 'Robanana'],
  ])('%s + %s -> %s', (a, b, expected) => {
    expect(makePortmanteau(a, b)).toBe(expected);
  });
});

describe('makePortmanteau — edge cases', () => {
  const titleCase = /^[A-Z][a-z]*( [A-Z][a-z]*)*$/;

  it('words with no vowels are used whole', () => {
    expect(makePortmanteau('xyz', 'brr')).toBe('Xyzbrr');
    expect(makePortmanteau('brr', 'cat')).toBe('Brrat');
  });

  it('treats y as a vowel when not word-initial', () => {
    // "xyz" has one vowel group (y); "abc" starts with a vowel group
    expect(makePortmanteau('xyz', 'abc')).toBe('Xyzabc');
  });

  it('1-2 letter words are used whole and fall back to plain concatenation', () => {
    expect(makePortmanteau('a', 'b')).toBe('Ab');
    expect(makePortmanteau('ox', 'cat')).toBe('Oxat');
    expect(makePortmanteau('cat', 'ox')).toBe('Catox');
  });

  it('identical words still produce a non-empty blend', () => {
    const out = makePortmanteau('cat', 'cat');
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(titleCase);
  });

  it('never returns a word identical to either input (falls back to A+B)', () => {
    // "bee" as tail: no consonant after its first vowel group
    expect(makePortmanteau('zoo', 'bee')).toBe('Zoobee');
  });

  it('collapses triple letters', () => {
    expect(makePortmanteau('zoo', 'ox')).toBe('Zoox');
  });

  it('multi-word inputs blend the last word of A with the first word of B', () => {
    expect(makePortmanteau('Snuggle Daddy', 'Dragon')).toBe('Snuggle Daddagon');
    expect(makePortmanteau('Dragon', 'Ice Cream')).toBe('Dragice Cream');
  });

  it('treats hyphens like spaces', () => {
    expect(makePortmanteau('fire-breathing', 'cat')).toBe('Fire Breathat');
  });

  it('strips diacritics and non-letters, ignores surrounding whitespace', () => {
    // (café + dragon would be "Cafagon", which trips the profanity guard.)
    expect(makePortmanteau('  café! ', 'rocket')).toBe('Cafocket');
  });

  it('returns Title Case', () => {
    expect(makePortmanteau('BLANKET', 'DADDY')).toBe('Blankaddy');
    expect(makePortmanteau('blanket', 'daddy')).toMatch(titleCase);
  });

  it('is non-empty when one or both inputs are empty', () => {
    expect(makePortmanteau('', 'cat')).toBe('Cat');
    expect(makePortmanteau('cat', '')).toBe('Cat');
    expect(makePortmanteau('', '')).not.toBe('');
  });

  it('caps the result at 3 words', () => {
    const out = makePortmanteau('big red snuggle daddy', 'ice cream sandwich');
    expect(out.split(' ').length).toBeLessThanOrEqual(3);
  });
});

describe('makePortmanteau — profanity guard', () => {
  it('skips a blend containing a banned substring and uses plain concatenation', () => {
    // dinosaur + trex would blend into "Dinosex".
    expect(makePortmanteau('dinosaur', 'trex')).toBe('Dinosaurrex');
  });

  it('falls back to the two words side by side when concatenation is banned too', () => {
    expect(makePortmanteau('na', 'azi')).toBe('Na Azi');
  });

  it('still blends clean words normally', () => {
    expect(makePortmanteau('blanket', 'daddy')).toBe('Blankaddy');
  });
});
