import type { Card, Recipe } from './types';
import { fnv1a, pick } from './hash';
import { composite, firstGlyph } from './emoji';
import { makePortmanteau } from './portmanteau';

export type EngineContext = {
  recipes: Recipe[];
  /** Every known card (base + discovered), used for id lookup. */
  cards: Card[];
};

export type CombineSource = 'recipe' | 'double' | 'mash' | 'portmanteau';

export type CombineResult = {
  card: Card;
  source: CombineSource;
  key: string;
  inputs: [string, string];
};

const TYPED_PREFIX = 'typed:';
const MAX_MODIFIERS = 6;
const MAX_PHRASE_WORDS = 3;
const MAX_TYPED_WORD_LENGTH = 24;
const FALLBACK_EMOJI = '✨';

/** Flavor templates for mashed cards. {a} / {b} are the input words. */
const MASH_FLAVORS = [
  'Part {a}, part {b}, all trouble.',
  'What happens when {a} meets {b}.',
  'Half {a}. Half {b}. Fully weird.',
  'A {a} and a {b} walked into a smoosher.',
  'Looks like {a}. Acts like {b}.',
  'Nobody asked for this. Everybody loves it.',
  '{a} + {b}. Science has gone too far.',
  'Equal parts {a} and {b}. Zero parts sensible.',
];

/** Last-resort modifiers when every real modifier collides with the noun. */
const FALLBACK_MODIFIERS = ['Mega', 'Super', 'Ultra', 'Giant'];

// ---------------------------------------------------------------------------
// Small string helpers
// ---------------------------------------------------------------------------

/** lowercase, strip diacritics, non-alphanumerics -> "-", trimmed. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Order-independent key for a pair of card ids: "blanket+daddy". */
export function pairKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('+');
}

const splitWords = (text: string): string[] => text.split(/\s+/).filter(Boolean);
const lastWord = (text: string): string => splitWords(text).pop() ?? text;
const titleCase = (text: string): string =>
  splitWords(text)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

/** Union of lists, deduped case-insensitively, first occurrence wins. */
function union(a: readonly string[], b: readonly string[], max = Infinity): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a, ...b]) {
    const k = item.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function hasAdjacentDuplicate(phrase: string): boolean {
  const ws = splitWords(phrase).map((w) => w.toLowerCase());
  return ws.some((w, i) => i > 0 && w === ws[i - 1]);
}

const isTyped = (card: Card): boolean => card.id.startsWith(TYPED_PREFIX);

// ---------------------------------------------------------------------------
// Resolution paths
// ---------------------------------------------------------------------------

function findRecipe(key: string, recipes: readonly Recipe[]): Recipe | undefined {
  return recipes.find((r) => pairKey(r.inputs[0], r.inputs[1]) === key);
}

function fromRecipe(recipe: Recipe, key: string, first: Card, second: Card): Card {
  const { result } = recipe;
  const modifiers = result.modifiers?.length ? [...result.modifiers] : [splitWords(result.word)[0] ?? result.word];
  return {
    id: 'r:' + key,
    word: result.word,
    emoji: result.emoji,
    flavor: result.flavor,
    tags: result.tags ? [...result.tags] : union(first.tags, second.tags),
    modifiers,
    base: false,
  };
}

function fromDouble(card: Card, key: string): Card {
  const glyph = firstGlyph(card.emoji);
  return {
    id: 'd:' + key,
    word: `Double ${card.word}`,
    emoji: glyph + glyph,
    flavor: `Twice the ${card.word.toLowerCase()}. Twice the trouble.`,
    tags: [...card.tags],
    modifiers: union(['Double'], card.modifiers),
    base: false,
  };
}

function fromPortmanteau(first: Card, second: Card, key: string): Card {
  return {
    id: 'p:' + key,
    word: makePortmanteau(first.word, second.word),
    emoji: composite(first.emoji, second.emoji),
    flavor: `A ${first.word} ${second.word}. Obviously.`,
    tags: union(first.tags, second.tags),
    modifiers: union(first.modifiers, second.modifiers, MAX_MODIFIERS),
    base: false,
  };
}

/** The noun a card contributes: a nounForm if it has any, else its last word. */
function nounOf(card: Card, seed: number): string {
  if (card.nounForms?.length) return pick(card.nounForms, seed);
  return lastWord(card.word);
}

/** Modifiers a card can contribute; a card with none falls back to its last word. */
function modifiersOf(card: Card): string[] {
  return card.modifiers.length ? card.modifiers : [lastWord(card.word)];
}

function phraseOk(modifier: string, noun: string): boolean {
  const phrase = `${modifier} ${noun}`;
  if (hasAdjacentDuplicate(phrase)) return false;
  if (splitWords(phrase).length > MAX_PHRASE_WORDS) return false;
  const mod = modifier.toLowerCase();
  return !splitWords(noun).some((w) => w.toLowerCase() === mod);
}

/** Try every modifier of `from` (starting at the seeded pick) against `noun`. */
function tryMash(from: Card, noun: string, seed: number): string | undefined {
  const mods = modifiersOf(from);
  for (let offset = 0; offset < mods.length; offset++) {
    const modifier = pick(mods, seed, offset);
    if (phraseOk(modifier, noun)) return `${modifier} ${noun}`;
  }
  return undefined;
}

function mashPhrase(first: Card, second: Card, seed: number): string {
  const nounSeed = fnv1a(`${seed}:noun`);
  const [x, y] = seed & 1 ? [second, first] : [first, second];
  const nounY = lastWord(nounOf(y, nounSeed));
  const nounX = lastWord(nounOf(x, nounSeed));
  return (
    tryMash(x, nounY, seed) ??
    tryMash(y, nounX, seed) ??
    `${FALLBACK_MODIFIERS.find((m) => phraseOk(m, nounY)) ?? FALLBACK_MODIFIERS[0]} ${nounY}`
  );
}

function fromMash(first: Card, second: Card, key: string): Card {
  const seed = fnv1a(key);
  const template = pick(MASH_FLAVORS, fnv1a(`${key}:flavor`));
  return {
    id: 'm:' + key,
    word: mashPhrase(first, second, seed),
    emoji: composite(first.emoji, second.emoji),
    flavor: template.replace('{a}', first.word).replace('{b}', second.word),
    tags: union(first.tags, second.tags),
    modifiers: union(first.modifiers, second.modifiers, MAX_MODIFIERS),
    base: false,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Smoosh two cards. Deterministic and order-independent: `combine(a, b)`
 * deep-equals `combine(b, a)`. Resolution order: curated recipe, doubling
 * (same id), portmanteau (either card was typed), modifier mash.
 */
export function combine(a: Card, b: Card, ctx: EngineContext): CombineResult {
  const [first, second] = a.id <= b.id ? [a, b] : [b, a];
  const key = pairKey(first.id, second.id);
  const inputs: [string, string] = [first.id, second.id];
  const done = (card: Card, source: CombineSource): CombineResult => ({ card, source, key, inputs });

  const recipe = findRecipe(key, ctx.recipes);
  if (recipe) return done(fromRecipe(recipe, key, first, second), 'recipe');
  if (first.id === second.id) return done(fromDouble(first, key), 'double');
  if (isTyped(first) || isTyped(second)) return done(fromPortmanteau(first, second, key), 'portmanteau');
  return done(fromMash(first, second, key), 'mash');
}

/** Singular/plural variants of a lowercase word, most likely first. */
function wordVariants(word: string): string[] {
  const out = [word];
  if (word.endsWith('ies')) out.push(word.slice(0, -3) + 'y');
  if (word.endsWith('es')) out.push(word.slice(0, -2));
  if (word.endsWith('s')) out.push(word.slice(0, -1));
  out.push(word + 's', word + 'es');
  return out;
}

function emojiFor(word: string, emojiMap: Record<string, string>): string {
  const lower = word.toLowerCase();
  const lookup = (k: string): string | undefined => emojiMap[k] ?? emojiMap[k.toLowerCase()];
  for (const variant of wordVariants(lower)) {
    const hit = lookup(variant);
    if (hit) return hit;
  }
  const keys = Object.keys(emojiMap)
    .filter((k) => k.length > 0)
    .sort((p, q) => q.length - p.length || (p < q ? -1 : 1));
  for (const k of keys) {
    if (lower.includes(k.toLowerCase())) return emojiMap[k];
  }
  return FALLBACK_EMOJI;
}

/**
 * Turn free text from a slot into a card. If it names a known card (by word,
 * id or nounForm, case-insensitively) that card is returned, so curated
 * recipes still fire. Otherwise a typed card (`id: "typed:<slug>"`) is built.
 */
export function cardFromTypedWord(text: string, emojiMap: Record<string, string>, known: Card[]): Card {
  const cleaned = splitWords(text).join(' ');
  const lower = cleaned.toLowerCase();
  const slug = slugify(cleaned);

  if (lower) {
    const match = known.find(
      (c) =>
        c.word.toLowerCase() === lower ||
        c.id.toLowerCase() === lower ||
        c.id === slug ||
        (c.nounForms ?? []).some((n) => n.toLowerCase() === lower),
    );
    if (match) return match;
  }

  const word = titleCase(cleaned.slice(0, MAX_TYPED_WORD_LENGTH).trim()) || 'Nothing';
  return {
    id: TYPED_PREFIX + (slugify(word) || 'nothing'),
    word,
    emoji: emojiFor(word, emojiMap),
    tags: [],
    modifiers: [word],
    base: false,
  };
}
