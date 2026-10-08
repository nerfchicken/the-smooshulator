import { describe, expect, it } from 'vitest';
import { isBanned } from '../../src/engine/banned';

describe('isBanned', () => {
  it('flags words containing a banned substring, case-insensitively', () => {
    expect(isBanned('Dinosex')).toBe(true);
    expect(isBanned('SHIT')).toBe(true);
    expect(isBanned('Fuksock')).toBe(true);
    expect(isBanned('Nazi Dragon')).toBe(true);
  });

  it('checks every word of a phrase', () => {
    expect(isBanned('Fluffy Poonicorn')).toBe(true);
    expect(isBanned('Fluffy Unicorn')).toBe(false);
  });

  it('allows ordinary kid words that happen to contain a banned root', () => {
    for (const w of ['Night', 'Knight', 'Midnight', 'Jurassic', 'Glass', 'Grassy', 'Classy', 'Cucumber', 'Title', 'Compass', 'Massive']) {
      expect(isBanned(w), w).toBe(false);
    }
  });

  it('is false for empty text', () => {
    expect(isBanned('')).toBe(false);
  });
});
