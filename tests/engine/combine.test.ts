import { describe, expect, it } from 'vitest';
import {
  cardFromTypedWord,
  combine,
  pairKey,
  slugify,
  type Card,
  type EngineContext,
  type Recipe,
} from '../../src/engine';

const card = (partial: Partial<Card> & Pick<Card, 'id' | 'word' | 'emoji'>): Card => ({
  tags: [],
  modifiers: [],
  base: true,
  ...partial,
});

const blanket = card({ id: 'blanket', word: 'Blanket', emoji: '🛏️', tags: ['soft', 'warm'], modifiers: ['Snuggle', 'Cozy'] });
const daddy = card({ id: 'daddy', word: 'Daddy', emoji: '👨', tags: ['family', 'big'], modifiers: ['Dad', 'Big'], nounForms: ['Daddy', 'Dad'] });
const dragon = card({ id: 'dragon', word: 'Dragon', emoji: '🐉', tags: ['fire', 'scaly'], modifiers: ['Fire', 'Scaly'] });
const cat = card({ id: 'cat', word: 'Cat', emoji: '🐱', tags: ['pet', 'fluffy'], modifiers: ['Kitty', 'Fluffy'] });
const toothbrush = card({ id: 'toothbrush', word: 'Toothbrush', emoji: '🪥', tags: ['clean'], modifiers: ['Minty', 'Scrubby'] });

const recipes: Recipe[] = [
  { inputs: ['daddy', 'blanket'], result: { word: 'Snuggle Daddy', emoji: '🛏️👨', flavor: 'Warm. Snoring.' } },
  {
    inputs: ['toothbrush', 'dragon'],
    result: { word: 'Fire-Breathing Flosser', emoji: '🐉🪥', flavor: 'Minty fresh flames.', tags: ['fire', 'clean', 'minty'], modifiers: ['Flossy', 'Fiery'] },
  },
];

const ctx: EngineContext = { recipes, cards: [blanket, daddy, dragon, cat, toothbrush] };

const words = (s: string) => s.split(' ');
const hasAdjacentDupe = (s: string) => words(s).some((w, i, arr) => i > 0 && w.toLowerCase() === arr[i - 1].toLowerCase());

describe('pairKey', () => {
  it('is order-independent and stable', () => {
    expect(pairKey('blanket', 'daddy')).toBe('blanket+daddy');
    expect(pairKey('daddy', 'blanket')).toBe('blanket+daddy');
    expect(pairKey('cat', 'cat')).toBe('cat+cat');
  });
});

describe('slugify', () => {
  it('lowercases, strips diacritics and punctuation, hyphenates spaces', () => {
    expect(slugify('  Snuggle   Daddy! ')).toBe('snuggle-daddy');
    expect(slugify('Café-Crème')).toBe('cafe-creme');
    expect(slugify('💩')).toBe('');
  });
});

describe('combine — recipe precedence', () => {
  it('uses the curated recipe regardless of input order', () => {
    const r1 = combine(blanket, daddy, ctx);
    const r2 = combine(daddy, blanket, ctx);
    expect(r1.source).toBe('recipe');
    expect(r1.key).toBe('blanket+daddy');
    expect(r1.inputs).toEqual(['blanket', 'daddy']);
    expect(r1.card.id).toBe('r:blanket+daddy');
    expect(r1.card.word).toBe('Snuggle Daddy');
    expect(r1.card.emoji).toBe('🛏️👨');
    expect(r1.card.flavor).toBe('Warm. Snoring.');
    expect(r1.card.base).toBe(false);
    expect(r1).toEqual(r2);
  });

  it('defaults tags to the union of inputs and modifiers to the first word of the result', () => {
    const { card: c } = combine(blanket, daddy, ctx);
    expect(c.tags).toEqual(['soft', 'warm', 'family', 'big']);
    expect(c.modifiers).toEqual(['Snuggle']);
  });

  it('keeps explicit tags and modifiers from the recipe', () => {
    const { card: c } = combine(dragon, toothbrush, ctx);
    expect(c.word).toBe('Fire-Breathing Flosser');
    expect(c.tags).toEqual(['fire', 'clean', 'minty']);
    expect(c.modifiers).toEqual(['Flossy', 'Fiery']);
  });

  it('does not mutate the recipe result or the input cards', () => {
    const before = JSON.stringify({ recipes, blanket, daddy });
    const { card: c } = combine(blanket, daddy, ctx);
    c.tags.push('mutated');
    c.modifiers.push('Mutated');
    expect(JSON.stringify({ recipes, blanket, daddy })).toBe(before);
  });
});

describe('combine — double', () => {
  it('doubles a card combined with itself', () => {
    const r = combine(cat, cat, ctx);
    expect(r.source).toBe('double');
    expect(r.card.word).toBe('Double Cat');
    expect(r.card.emoji).toBe('🐱🐱');
    expect(r.card.flavor).toBe('Twice the cat. Twice the trouble.');
    expect(r.card.tags).toEqual(['pet', 'fluffy']);
    expect(r.card.modifiers).toEqual(['Double', 'Kitty', 'Fluffy']);
    expect(r.card.base).toBe(false);
    expect(r.card.id).toBe('d:cat+cat');
  });

  it('prefers a curated recipe for a self-pair', () => {
    const selfRecipe: Recipe = { inputs: ['cat', 'cat'], result: { word: 'Catnip Party', emoji: '🐱🎉', flavor: 'Two cats. One box.' } };
    const r = combine(cat, cat, { ...ctx, recipes: [selfRecipe] });
    expect(r.source).toBe('recipe');
    expect(r.card.word).toBe('Catnip Party');
  });

  it('only doubles the first glyph of a composite emoji', () => {
    const snuggle = combine(blanket, daddy, ctx).card;
    const r = combine(snuggle, snuggle, ctx);
    expect(r.card.word).toBe('Double Snuggle Daddy');
    expect(r.card.emoji).toBe('🛏️🛏️');
  });
});

describe('combine — modifier mash', () => {
  it('builds "<Modifier from one> <Noun from other>" with a composite emoji', () => {
    const r = combine(cat, dragon, ctx);
    expect(r.source).toBe('mash');
    expect(r.card.id).toBe('m:cat+dragon');
    const [mod, noun, ...rest] = words(r.card.word);
    expect(rest).toEqual([]);
    const fromCat = cat.modifiers.includes(mod) && noun === 'Dragon';
    const fromDragon = dragon.modifiers.includes(mod) && noun === 'Cat';
    expect(fromCat || fromDragon).toBe(true);
    expect([...r.card.emoji].length).toBeGreaterThan(1);
    expect(r.card.emoji).toMatch(/🐱|🐉/);
    expect(r.card.emoji).toContain('🐱');
    expect(r.card.emoji).toContain('🐉');
    expect(r.card.base).toBe(false);
  });

  it('unions tags and modifiers (deduped, max 6)', () => {
    const r = combine(cat, dragon, ctx);
    expect(r.card.tags).toEqual(['pet', 'fluffy', 'fire', 'scaly']);
    expect(r.card.modifiers).toEqual(['Kitty', 'Fluffy', 'Fire', 'Scaly']);

    const many1 = card({ id: 'm1', word: 'One', emoji: '1️⃣', modifiers: ['A', 'B', 'C', 'D'] });
    const many2 = card({ id: 'm2', word: 'Two', emoji: '2️⃣', modifiers: ['C', 'D', 'E', 'F', 'G'] });
    expect(combine(many1, many2, ctx).card.modifiers).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('uses nounForms when the noun card has them', () => {
    const r = combine(cat, daddy, ctx);
    const [mod, noun] = words(r.card.word);
    const fromCat = cat.modifiers.includes(mod) && daddy.nounForms!.includes(noun);
    const fromDaddy = daddy.modifiers.includes(mod) && noun === 'Cat';
    expect(fromCat || fromDaddy).toBe(true);
  });

  it('uses only the last word of a discovered card as the noun (3-word cap)', () => {
    const snuggle = combine(blanket, daddy, ctx).card; // "Snuggle Daddy"
    const r = combine(snuggle, dragon, ctx);
    expect(r.source).toBe('mash');
    expect(words(r.card.word).length).toBeLessThanOrEqual(3);
    const [mod, noun] = words(r.card.word);
    const a = snuggle.modifiers.includes(mod) && noun === 'Dragon';
    const b = dragon.modifiers.includes(mod) && noun === 'Daddy';
    expect(a || b).toBe(true);
  });

  it('skips a modifier that already appears in the noun phrase', () => {
    const spiky = card({ id: 'spiky', word: 'Dragon', emoji: '🦎', modifiers: ['Dragon', 'Spiky'] });
    const scaly = card({ id: 'scaly', word: 'Dragon', emoji: '🐲', modifiers: ['Dragon', 'Scaly'] });
    for (let i = 0; i < 1; i++) {
      const r = combine(spiky, scaly, ctx);
      expect(['Spiky Dragon', 'Scaly Dragon']).toContain(r.card.word);
    }
  });

  it('never produces an adjacent duplicate even when every modifier collides', () => {
    const d1 = card({ id: 'd1', word: 'Dragon', emoji: '🐉', modifiers: ['Dragon'] });
    const d2 = card({ id: 'd2', word: 'Dragon', emoji: '🐲', modifiers: ['Dragon'] });
    const r = combine(d1, d2, ctx);
    expect(hasAdjacentDupe(r.card.word)).toBe(false);
    expect(words(r.card.word).length).toBeLessThanOrEqual(3);
    expect(words(r.card.word).pop()).toBe('Dragon');
  });

  it('copes with cards that have no modifiers at all', () => {
    const bare1 = card({ id: 'b1', word: 'Rock', emoji: '🪨' });
    const bare2 = card({ id: 'b2', word: 'Sock', emoji: '🧦' });
    const r = combine(bare1, bare2, ctx);
    expect(r.card.word.length).toBeGreaterThan(0);
    expect(hasAdjacentDupe(r.card.word)).toBe(false);
  });

  it('generates a flavor line from a template', () => {
    const r = combine(cat, dragon, ctx);
    expect(r.card.flavor).toBeTruthy();
    expect(r.card.flavor!.length).toBeGreaterThan(5);
  });

  it('varies direction/modifier/flavor across pairs', () => {
    const others = [dragon, daddy, toothbrush, blanket];
    const results = others.map((o) => combine(cat, o, ctx));
    const wordsSeen = new Set(results.map((r) => r.card.word));
    expect(wordsSeen.size).toBe(others.length);
  });
});

describe('combine — portmanteau for typed words', () => {
  const emojiMap = { rocket: '🚀', cat: '🐱' };

  it('blends a typed word with a known card and stores the phrase in flavor', () => {
    const blorp = cardFromTypedWord('blorp', emojiMap, ctx.cards);
    const r = combine(blorp, dragon, ctx);
    expect(r.source).toBe('portmanteau');
    expect(r.card.id).toBe('p:' + pairKey('typed:blorp', 'dragon'));
    expect(r.card.word).toBe('Dragorp');
    expect(r.card.flavor).toBe('A Dragon Blorp. Obviously.');
    expect(r.card.emoji).toBe('🐉✨');
    expect(r.card.modifiers).toEqual(['Fire', 'Scaly', 'Blorp']);
    expect(r.card.base).toBe(false);
  });

  it('blends two typed words', () => {
    const a = cardFromTypedWord('blanket', emojiMap, []);
    const b = cardFromTypedWord('daddy', emojiMap, []);
    const r = combine(a, b, ctx);
    expect(r.source).toBe('portmanteau');
    expect(r.card.word).toBe('Blankaddy');
    expect(r.card.flavor).toBe('A Blanket Daddy. Obviously.');
  });

  it('doubles a typed word combined with itself', () => {
    const a = cardFromTypedWord('blorp', emojiMap, []);
    const r = combine(a, cardFromTypedWord('Blorp', emojiMap, []), ctx);
    expect(r.source).toBe('double');
    expect(r.card.word).toBe('Double Blorp');
  });

  it('a typed word matching a known card resolves to that card (so recipes still fire)', () => {
    const typed = cardFromTypedWord('BLANKET', emojiMap, ctx.cards);
    expect(typed).toBe(blanket);
    expect(combine(typed, daddy, ctx).source).toBe('recipe');
  });
});

describe('cardFromTypedWord', () => {
  const emojiMap = { rocket: '🚀', cat: '🐱', dog: '🐶' };

  it('matches known cards by word, id or nounForm, case-insensitively', () => {
    expect(cardFromTypedWord(' daddy ', emojiMap, ctx.cards)).toBe(daddy);
    expect(cardFromTypedWord('Dad', emojiMap, ctx.cards)).toBe(daddy);
    const iceCream = card({ id: 'ice-cream', word: 'Ice Cream', emoji: '🍦' });
    expect(cardFromTypedWord('ice cream', emojiMap, [iceCream])).toBe(iceCream);
    expect(cardFromTypedWord('ICE-CREAM', emojiMap, [iceCream])).toBe(iceCream);
  });

  it('builds a typed card with Title Case word, slug id, and [Word] modifiers', () => {
    const c = cardFromTypedWord('  space   rocket ', emojiMap, ctx.cards);
    expect(c.id).toBe('typed:space-rocket');
    expect(c.word).toBe('Space Rocket');
    expect(c.tags).toEqual([]);
    expect(c.modifiers).toEqual(['Space Rocket']);
    expect(c.base).toBe(false);
  });

  it('truncates the word to 24 characters', () => {
    const c = cardFromTypedWord('supercalifragilisticexpialidocious', emojiMap, []);
    expect(c.word.length).toBeLessThanOrEqual(24);
    expect(c.word).toBe('Supercalifragilisticexpi');
  });

  it('looks up emoji by exact word, then singular/plural, then substring, else sparkles', () => {
    expect(cardFromTypedWord('rocket', emojiMap, []).emoji).toBe('🚀');
    expect(cardFromTypedWord('rockets', emojiMap, []).emoji).toBe('🚀');
    expect(cardFromTypedWord('cats', emojiMap, []).emoji).toBe('🐱');
    expect(cardFromTypedWord('hotdog', emojiMap, []).emoji).toBe('🐶');
    expect(cardFromTypedWord('blorp', emojiMap, []).emoji).toBe('✨');
  });

  it('handles empty input without throwing', () => {
    const c = cardFromTypedWord('   ', emojiMap, []);
    expect(c.word.length).toBeGreaterThan(0);
    expect(c.id.startsWith('typed:')).toBe(true);
  });
});

describe('combine — determinism', () => {
  const pairs: [Card, Card][] = [
    [cat, dragon],
    [cat, daddy],
    [blanket, dragon],
    [toothbrush, cat],
    [cat, cat],
    [blanket, daddy],
  ];

  it.each(pairs.map(([a, b]) => [a.id, b.id, a, b]))('%s + %s is symmetric and repeatable', (_a, _b, a, b) => {
    const r1 = combine(a as Card, b as Card, ctx);
    const r2 = combine(b as Card, a as Card, ctx);
    const r3 = combine(a as Card, b as Card, ctx);
    expect(r1).toEqual(r2);
    expect(r1).toEqual(r3);
  });

  it('typed-word portmanteaus are symmetric too', () => {
    const a = cardFromTypedWord('blorp', {}, []);
    expect(combine(a, dragon, ctx)).toEqual(combine(dragon, a, ctx));
  });
});
