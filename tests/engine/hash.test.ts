import { describe, expect, it } from 'vitest';
import { fnv1a, pick } from '../../src/engine/hash';

describe('fnv1a', () => {
  it('matches known FNV-1a 32-bit vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('is deterministic and differs across inputs', () => {
    expect(fnv1a('blanket+daddy')).toBe(fnv1a('blanket+daddy'));
    expect(fnv1a('blanket+daddy')).not.toBe(fnv1a('daddy+blanket'));
  });

  it('handles non-ASCII input without throwing', () => {
    expect(typeof fnv1a('🐉+🛏️')).toBe('number');
    expect(fnv1a('🐉')).not.toBe(fnv1a('🐱'));
  });
});

describe('pick', () => {
  it('returns an element of the list, stable for a seed', () => {
    const list = ['a', 'b', 'c', 'd'];
    const first = pick(list, 12345);
    expect(list).toContain(first);
    expect(pick(list, 12345)).toBe(first);
  });

  it('spreads across the list for different seeds', () => {
    const list = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let s = 0; s < 64; s++) seen.add(pick(list, fnv1a(String(s))));
    expect(seen.size).toBe(4);
  });

  it('accepts an offset to step to the next choice', () => {
    const list = ['a', 'b', 'c'];
    const i0 = list.indexOf(pick(list, 7));
    const i1 = list.indexOf(pick(list, 7, 1));
    expect(i1).toBe((i0 + 1) % 3);
  });

  it('throws on an empty list', () => {
    expect(() => pick([], 1)).toThrow();
  });
});
