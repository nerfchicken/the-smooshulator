import { describe, expect, it } from 'vitest';
import {
  cardFromTypedWord,
  combine,
  isBanned,
  pairKey,
  renderFlavor,
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

  it('doubles the noun-side glyph of a discovered card (never more than 2 glyphs)', () => {
    const snuggle = combine(blanket, daddy, ctx).card; // 🛏️👨
    const r = combine(snuggle, snuggle, ctx);
    expect(r.card.word).toBe('Double Snuggle Daddy');
    expect(r.card.emoji).toBe('👨👨');
  });

  it('steps Double -> Triple -> Mega instead of stacking prefixes', () => {
    const double = combine(cat, cat, ctx).card;
    const triple = combine(double, double, ctx).card;
    expect(triple.word).toBe('Triple Cat');
    expect(triple.emoji).toBe('🐱🐱');
    expect(triple.modifiers).toEqual(['Triple', 'Kitty', 'Fluffy']);
    expect(triple.flavor).toBeTruthy();
    const mega = combine(triple, triple, ctx).card;
    expect(mega.word).toBe('Mega Cat');
    expect(combine(mega, mega, ctx).card.word).toBe('Mega Cat');
    expect([...mega.emoji].length).toBeLessThanOrEqual(4); // two glyphs, allowing surrogates/VS16
  });

  it('keeps a doubled word within 3 words', () => {
    const royal: Recipe = { inputs: ['cat', 'cheese'], result: { word: 'Her Royal Cheesiness', emoji: '🐱🧀', flavor: 'Bow.' } };
    const cheese = card({ id: 'cheese', word: 'Cheese', emoji: '🧀', modifiers: ['Cheesy'] });
    const her = combine(cat, cheese, { ...ctx, recipes: [royal] }).card;
    const r = combine(her, her, ctx);
    expect(words(r.card.word).length).toBeLessThanOrEqual(3);
    expect(r.card.word).toBe('Double Cheesiness');
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

  it('keeps a 2-word discovered name whole as the noun ("Fire Snuggle Daddy")', () => {
    const snuggle = combine(blanket, daddy, ctx).card; // "Snuggle Daddy"
    const r = combine(snuggle, dragon, ctx);
    expect(r.source).toBe('mash');
    expect(words(r.card.word).length).toBeLessThanOrEqual(3);
    expect(['Fire Snuggle Daddy', 'Scaly Snuggle Daddy', 'Snuggle Dragon']).toContain(r.card.word);
  });

  it('uses only the last word of a 3-word discovered name as the noun', () => {
    const royal = card({ id: 'r:x', word: 'Her Royal Cheesiness', emoji: '🐱🧀', modifiers: ['Royal'], base: false });
    const r = combine(royal, dragon, ctx);
    expect(words(r.card.word).length).toBeLessThanOrEqual(3);
    expect(['Fire Cheesiness', 'Scaly Cheesiness', 'Royal Dragon']).toContain(r.card.word);
  });

  it('uses the noun-side glyph of a discovered card in the composite', () => {
    const snuggle = combine(blanket, daddy, ctx).card; // 🛏️👨
    const r = combine(snuggle, dragon, ctx);
    expect(r.card.emoji).toBe('🐉👨');
  });

  it('never echoes an input word ("Pizza Soup + Pizza" is not "Pizza Soup")', () => {
    const pizza = card({ id: 'pizza', word: 'Pizza', emoji: '🍕', modifiers: ['Cheesy', 'Saucy'] });
    const soup = card({ id: 'r:pizza+soup', word: 'Pizza Soup', emoji: '🍕🍲', modifiers: ['Pizza'], base: false });
    const r = combine(soup, pizza, ctx);
    expect(r.card.word.toLowerCase()).not.toBe('pizza soup');
    expect(r.card.word.toLowerCase()).not.toBe('pizza');
    expect(['Cheesy Pizza Soup', 'Saucy Pizza Soup']).toContain(r.card.word);
  });

  it('treats a reordering of an input as an echo too', () => {
    const fireDragon = card({ id: 'r:fd', word: 'Fire Dragon', emoji: '🔥🐉', modifiers: ['Dragon'], base: false });
    const fire = card({ id: 'fire', word: 'Fire', emoji: '🔥', modifiers: ['Spicy'] });
    const r = combine(fireDragon, fire, ctx);
    expect(r.card.word.toLowerCase()).not.toBe('dragon fire');
    expect(r.card.word).toBe('Spicy Fire Dragon');
  });

  it('treats hyphen parts of a modifier as words for the echo check ("Fire-Breathing Fire")', () => {
    const captain = card({ id: 'r:cf', word: 'Dragon', emoji: '🐉', modifiers: ['Fire-Breathing'], base: false });
    const fire = card({ id: 'fire', word: 'Fire', emoji: '🔥', modifiers: ['Hot'] });
    expect(combine(captain, fire, ctx).card.word).toBe('Hot Dragon');
  });

  it('skips modifiers that spell something banned (typed words leak into chains)', () => {
    const zorb = card({ id: 'p:x', word: 'Zorb', emoji: '✨', modifiers: ['Sexy', 'Zorb'], base: false });
    const r = combine(zorb, cat, ctx);
    expect(isBanned(r.card.word)).toBe(false);
    expect(r.card.word.length).toBeGreaterThan(0);
  });

  it('falls back to an "Extra" prefix when nothing else works', () => {
    const a = card({ id: 'a', word: 'Cat', emoji: '🐱', modifiers: ['Cat'] });
    const b = card({ id: 'b', word: 'Cat', emoji: '🐈', modifiers: ['Cat'] });
    const r = combine(a, b, ctx);
    expect(hasAdjacentDupe(r.card.word)).toBe(false);
    expect(r.card.word.toLowerCase()).not.toBe('cat');
    expect(words(r.card.word).length).toBeLessThanOrEqual(3);
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

  it('generates a kid-level flavor line from a template', () => {
    const r = combine(cat, dragon, ctx);
    expect(r.card.flavor).toBeTruthy();
    expect(r.card.flavor!.length).toBeGreaterThan(5);
    expect(r.card.flavor).not.toMatch(/Science|sensible|Nobody asked/);
    // Placeholders are filled with the lowercase input words.
    expect(r.card.flavor).not.toMatch(/\{a\}|\{b\}/);
    if (/cat|dragon/i.test(r.card.flavor!)) expect(r.card.flavor).toMatch(/\bcat\b|\bdragon\b/i);
  });

  it('renderFlavor lowercases the words but capitalises sentence starts', () => {
    expect(renderFlavor('A {b}. But {a}-flavored.', 'Cat', 'Dragon')).toBe('A dragon. But cat-flavored.');
    expect(renderFlavor('{a}. {b}. Both at once. Oh no.', 'Cat', 'Dragon')).toBe('Cat. Dragon. Both at once. Oh no.');
    expect(renderFlavor('Smooshed. No refunds.', 'Cat', 'Dragon')).toBe('Smooshed. No refunds.');
    expect(renderFlavor('Half {a}. Half {b}. All yours.', 'Ice Cream', 'Dog')).toBe('Half ice cream. Half dog. All yours.');
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
  const typed = (t: string, known: Card[] = ctx.cards) => cardFromTypedWord(t, emojiMap, known)!;

  it('typed word leads: "<Typed> <Base>" with the portmanteau kept in the flavor', () => {
    const blorp = typed('blorp');
    const r = combine(blorp, dragon, ctx);
    expect(r.source).toBe('portmanteau');
    expect(r.card.id).toBe('p:' + pairKey('typed:blorp', 'dragon'));
    expect(r.card.word).toBe('Blorp Dragon');
    expect(r.card.flavor).toBe('Aka Blorpagon. Obviously.');
    expect(r.card.emoji).toBe('✨🐉');
    expect(r.card.modifiers).toEqual(['Blorp', 'Fire', 'Scaly']);
    expect(r.card.base).toBe(false);
  });

  it('the typed card leads regardless of id sort order', () => {
    const ava = typed('Ava'); // "typed:ava" sorts after "cat" but before "dragon"? Irrelevant: typed leads.
    expect(combine(ava, cat, ctx).card.word).toBe('Ava Cat');
    expect(combine(cat, ava, ctx).card.word).toBe('Ava Cat');
    expect(combine(typed('zorb'), cat, ctx).card.word).toBe('Zorb Cat');
    expect(combine(typed('Minecraft'), dragon, ctx).card.word).toBe('Minecraft Dragon');
  });

  it('keeps a short discovered word whole as the noun and caps at 3 words', () => {
    const snuggle = combine(blanket, daddy, ctx).card; // "Snuggle Daddy"
    expect(combine(typed('blorp'), snuggle, ctx).card.word).toBe('Blorp Snuggle Daddy');
    expect(combine(typed('space rocket'), snuggle, ctx).card.word).toBe('Space Rocket Daddy');
    expect(combine(typed('big red dog'), dragon, ctx).card.word).toBe('Big Red Dragon');
  });

  it('never echoes an input word even when the typed word overlaps the noun', () => {
    const snuggle = combine(blanket, daddy, ctx).card;
    const r = combine(typed('snuggle'), snuggle, ctx);
    expect(r.card.word.toLowerCase()).not.toBe('snuggle daddy');
    expect(r.card.word.toLowerCase()).not.toBe('snuggle');
    expect(words(r.card.word).length).toBeLessThanOrEqual(3);
  });

  it('a typed emoji still gets a readable flavor', () => {
    const squid = typed('🦑', []);
    const r = combine(squid, dragon, ctx);
    expect(r.card.word).toBe('🦑 Dragon');
    expect(r.card.flavor).not.toBe('Aka Dragon. Obviously.');
    expect(r.card.flavor).toContain('🦑');
  });

  it('blends two typed words', () => {
    const a = typed('blanket', []);
    const b = typed('daddy', []);
    const r = combine(a, b, ctx);
    expect(r.source).toBe('portmanteau');
    expect(r.card.word).toBe('Blankaddy');
    expect(r.card.flavor).toBe('A Blanket Daddy. Obviously.');
  });

  it('uses "An" before a vowel for two typed words', () => {
    const r = combine(typed('apple', []), typed('dragon', []), ctx);
    expect(r.card.flavor).toBe('An Apple Dragon. Obviously.');
  });

  it('two typed words never collapse to one of them', () => {
    const r = combine(typed('🦑', []), typed('blorp', []), ctx);
    expect(r.card.word.toLowerCase()).not.toBe('blorp');
    expect(r.card.word).toContain('Blorp');
  });

  it('doubles a typed word combined with itself', () => {
    const a = typed('blorp', []);
    const r = combine(a, typed('Blorp', []), ctx);
    expect(r.source).toBe('double');
    expect(r.card.word).toBe('Double Blorp');
  });

  it('a typed word matching a known card resolves to that card (so recipes still fire)', () => {
    const t = typed('BLANKET');
    expect(t).toBe(blanket);
    expect(combine(t, daddy, ctx).source).toBe('recipe');
  });
});

describe('cardFromTypedWord', () => {
  const emojiMap = { rocket: '🚀', cat: '🐱', dog: '🐶', pig: '🐷', fire: '🔥', firetruck: '🚒' };

  it('matches known cards by word, id or nounForm, case-insensitively', () => {
    expect(cardFromTypedWord(' daddy ', emojiMap, ctx.cards)).toBe(daddy);
    expect(cardFromTypedWord('Dad', emojiMap, ctx.cards)).toBe(daddy);
    const iceCream = card({ id: 'ice-cream', word: 'Ice Cream', emoji: '🍦' });
    expect(cardFromTypedWord('ice cream', emojiMap, [iceCream])).toBe(iceCream);
    expect(cardFromTypedWord('ICE-CREAM', emojiMap, [iceCream])).toBe(iceCream);
  });

  it('builds a typed card with Title Case word, slug id, and [Word] modifiers', () => {
    const c = cardFromTypedWord('  space   rocket ', emojiMap, ctx.cards)!;
    expect(c.id).toBe('typed:space-rocket');
    expect(c.word).toBe('Space Rocket');
    expect(c.tags).toEqual([]);
    expect(c.modifiers).toEqual(['Space Rocket']);
    expect(c.base).toBe(false);
  });

  it('keeps inner capitals as typed, otherwise capitalises the first letter only', () => {
    expect(cardFromTypedWord('iPhone', emojiMap, [])!.word).toBe('iPhone');
    expect(cardFromTypedWord('LEGO', emojiMap, [])!.word).toBe('LEGO');
    expect(cardFromTypedWord('minecraft', emojiMap, [])!.word).toBe('Minecraft');
    expect(cardFromTypedWord('big RED dog', emojiMap, [])!.word).toBe('Big RED Dog');
  });

  it('truncates the word to 24 characters', () => {
    const c = cardFromTypedWord('supercalifragilisticexpialidocious', emojiMap, [])!;
    expect(c.word.length).toBeLessThanOrEqual(24);
    expect(c.word).toBe('Supercalifragilisticexpi');
  });

  it('truncates on grapheme boundaries, never splitting an emoji', () => {
    const c = cardFromTypedWord('a'.repeat(23) + '🐱zz', emojiMap, [])!;
    expect(c.word).toBe('A' + 'a'.repeat(22) + '🐱');
    expect(c.word).not.toMatch(/[\ud800-\udfff]/u); // no lone surrogate
    expect(c.modifiers[0]).toBe(c.word);
  });

  it('returns null for empty or punctuation-only input', () => {
    expect(cardFromTypedWord('', emojiMap, [])).toBeNull();
    expect(cardFromTypedWord('   ', emojiMap, [])).toBeNull();
    expect(cardFromTypedWord('!!!', emojiMap, [])).toBeNull();
    expect(cardFromTypedWord(' ... --- ', emojiMap, [])).toBeNull();
  });

  it('a single typed emoji resolves to the known card with that emoji', () => {
    expect(cardFromTypedWord('🐱', emojiMap, ctx.cards)).toBe(cat);
    expect(cardFromTypedWord(' 🛏️ ', emojiMap, ctx.cards)).toBe(blanket);
  });

  it('a single typed emoji in the map but not in the known cards becomes an emoji card', () => {
    const c = cardFromTypedWord('🚀', emojiMap, ctx.cards)!;
    expect(c.id).toBe('typed:u1f680');
    expect(c.word).toBe('🚀');
    expect(c.emoji).toBe('🚀');
    expect(c.modifiers).toEqual(['🚀']);
  });

  it('an unknown emoji (including multi-codepoint ones) gets a codepoint id and itself as picture', () => {
    const squid = cardFromTypedWord('🦑', emojiMap, ctx.cards)!;
    expect(squid.id).toBe('typed:u1f991');
    expect(squid.emoji).toBe('🦑');
    const pirate = cardFromTypedWord('🏴‍☠️', emojiMap, [])!;
    expect(pirate.id).toBe('typed:u1f3f4-200d-2620-fe0f');
    expect(pirate.emoji).toBe('🏴‍☠️');
  });

  it('several emoji or non-Latin text get distinct ids and do not collapse', () => {
    const poo2 = cardFromTypedWord('💩💩', emojiMap, [])!;
    expect(poo2.id).toBe('typed:u1f4a9-1f4a9');
    expect(poo2.word).toBe('💩💩');
    expect(poo2.emoji).toBe('💩');
    const jp = cardFromTypedWord('日本', emojiMap, [])!;
    expect(jp.id).toBe('typed:u65e5-672c');
    expect(jp.word).toBe('日本');
    expect(jp.id).not.toBe(poo2.id);
  });

  it('resolves aliases (typed form -> card id) when given', () => {
    const aliases = { kitty: 'cat', 'fire breather': 'dragon', nobody: 'no-such-card' };
    expect(cardFromTypedWord('Kitty', emojiMap, ctx.cards, aliases)).toBe(cat);
    expect(cardFromTypedWord('fire breather', emojiMap, ctx.cards, aliases)).toBe(dragon);
    // Alias pointing at an unknown id falls through to a typed card.
    expect(cardFromTypedWord('nobody', emojiMap, ctx.cards, aliases)!.id).toBe('typed:nobody');
    // Aliases are optional and absent by default.
    expect(cardFromTypedWord('kitty', emojiMap, ctx.cards)!.id).toBe('typed:kitty');
  });

  it('resolves naive plurals against known cards and aliases', () => {
    expect(cardFromTypedWord('cats', emojiMap, ctx.cards)).toBe(cat);
    expect(cardFromTypedWord('DRAGONS', emojiMap, ctx.cards)).toBe(dragon);
    expect(cardFromTypedWord('dads', emojiMap, ctx.cards)).toBe(daddy);
    expect(cardFromTypedWord('toothbrushes', emojiMap, ctx.cards)).toBe(toothbrush);
    expect(cardFromTypedWord('kitties', emojiMap, ctx.cards, { kitty: 'cat' })).toBe(cat);
    expect(cardFromTypedWord('puppies', emojiMap, ctx.cards)!.id).toBe('typed:puppies');
  });

  it('looks up emoji by exact word, then singular/plural, then longest substring key (4+ letters), else sparkles', () => {
    expect(cardFromTypedWord('rocket', emojiMap, [])!.emoji).toBe('🚀');
    expect(cardFromTypedWord('rockets', emojiMap, [])!.emoji).toBe('🚀');
    expect(cardFromTypedWord('rocketship', emojiMap, [])!.emoji).toBe('🚀');
    expect(cardFromTypedWord('superfiretrucks', emojiMap, [])!.emoji).toBe('🚒');
    // Short keys (< 4 letters) never match as substrings: no 🐷 for pigeon, no 🐶 for hotdog.
    expect(cardFromTypedWord('pigeon', emojiMap, [])!.emoji).toBe('✨');
    expect(cardFromTypedWord('hotdog', emojiMap, [])!.emoji).toBe('✨');
    expect(cardFromTypedWord('blorp', emojiMap, [])!.emoji).toBe('✨');
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
    const a = cardFromTypedWord('blorp', {}, [])!;
    expect(combine(a, dragon, ctx)).toEqual(combine(dragon, a, ctx));
    const ava = cardFromTypedWord('ava', {}, [])!;
    expect(combine(ava, cat, ctx)).toEqual(combine(cat, ava, ctx));
  });
});
