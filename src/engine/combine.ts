import type { Card, Recipe } from './types';
import { fnv1a, pick } from './hash';
import { firstGlyph, glyphs, lastGlyph } from './emoji';
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
const sameWord = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'An' : 'A');

/** Own-property lookup so a typed "constructor" never hits Object.prototype. */
const own = (obj: Record<string, string>, key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

/**
 * Capitalise each word's first letter. A word with capitals after its first
 * letter ("iPhone", "LEGO") is kept exactly as typed.
 */
const typedCase = (text: string): string =>
  splitWords(text)
    .map((w) => {
      const chars = Array.from(w);
      if (chars.slice(1).some((c) => c !== c.toLowerCase())) return w;
      return (chars[0] ?? '').toUpperCase() + chars.slice(1).join('');
    })
    .join(' ');

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
/** Strip variation selectors so 🛏 and 🛏️ compare equal. */
const bareEmoji = (e: string): string => e.replace(/\uFE0F/g, '');
/** "u1f3f4-200d-2620-fe0f": a stable id fragment for text that slugifies to nothing. */
const codepointId = (text: string): string =>
  'u' + Array.from(text, (c) => c.codePointAt(0)!.toString(16)).join('-');

/** The picture a card contributes to a composite: noun side (last glyph) for discovered cards. */
const glyphFor = (card: Card): string => (card.base ? firstGlyph(card.emoji) : lastGlyph(card.emoji));

/** The noun phrase a card contributes: its whole word if ≤ 2 words, else just the last word. */
function nounPhrase(card: Card): string {
  const ws = splitWords(card.word);
  return ws.length <= 2 ? card.word : ws[ws.length - 1];
}

/** Drop consecutive case-insensitive duplicates ("Snuggle Snuggle Daddy"). */
function dedupeAdjacent(ws: string[]): string[] {
  return ws.filter((w, i) => i === 0 || w.toLowerCase() !== ws[i - 1].toLowerCase());
}

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

/**
 * "<Typed> <Noun>" for a typed card and a known one, capped at 3 words. The
 * typed words are kept whole; the known card's noun phrase loses leading
 * words first. Falls back to the blend if that would just echo an input.
 */
function typedPhrase(typed: Card, known: Card, blend: string): string {
  const t = splitWords(typed.word);
  const n = splitWords(nounPhrase(known));
  while (t.length + n.length > MAX_PHRASE_WORDS) {
    if (n.length > 1) n.shift();
    else t.pop();
  }
  const ws = dedupeAdjacent([...t, ...n]);
  const phrase = ws.join(' ');
  if (ws.length < 2 || sameWord(phrase, typed.word) || sameWord(phrase, known.word)) return blend;
  return phrase;
}

function fromPortmanteau(first: Card, second: Card, key: string): Card {
  const id = 'p:' + key;
  if (isTyped(first) && isTyped(second)) {
    let word = makePortmanteau(first.word, second.word);
    // An emoji-only side blends to the other word verbatim; show both instead.
    if (sameWord(word, first.word) || sameWord(word, second.word)) {
      word = dedupeAdjacent(splitWords(`${first.word} ${second.word}`)).slice(0, MAX_PHRASE_WORDS).join(' ');
    }
    return {
      id,
      word,
      emoji: glyphFor(first) + glyphFor(second),
      flavor: `${article(first.word)} ${first.word} ${second.word}. Obviously.`,
      tags: union(first.tags, second.tags),
      modifiers: union(first.modifiers, second.modifiers, MAX_MODIFIERS),
      base: false,
    };
  }
  // Exactly one typed card: it leads, regardless of id order.
  const [typed, known] = isTyped(first) ? [first, second] : [second, first];
  const blend = makePortmanteau(typed.word, known.word);
  const flavor = sameWord(blend, known.word)
    ? `${article(known.word)} ${known.word.toLowerCase()}, but ${typed.word}. Obviously.`
    : `Aka ${blend}. Obviously.`;
  return {
    id,
    word: typedPhrase(typed, known, blend),
    emoji: glyphFor(typed) + glyphFor(known),
    flavor,
    tags: union(typed.tags, known.tags),
    modifiers: union(typed.modifiers, known.modifiers, MAX_MODIFIERS),
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
    emoji: glyphFor(first) + glyphFor(second),
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

/** Naive singular forms of a lowercase word ("kitties" -> kitty, "boxes" -> box, "cats" -> cat). */
function singulars(word: string): string[] {
  const out: string[] = [];
  if (word.endsWith('ies') && word.length > 4) out.push(word.slice(0, -3) + 'y');
  if (word.endsWith('es') && word.length > 3) out.push(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 2) out.push(word.slice(0, -1));
  return out;
}

/**
 * Emoji for a typed word: exact key, then singular/plural forms, then the
 * longest key (4+ letters) contained in the word, else sparkles.
 */
function emojiFor(word: string, emojiMap: Record<string, string>): string {
  const lower = word.toLowerCase();
  for (const v of [lower, ...singulars(lower), lower + 's', lower + 'es']) {
    const hit = own(emojiMap, v);
    if (hit) return hit;
  }
  let best: string | undefined;
  let bestLen = 0;
  for (const k of Object.keys(emojiMap)) {
    const kl = k.toLowerCase();
    if (kl.length >= 4 && kl.length > bestLen && lower.includes(kl)) {
      best = emojiMap[k];
      bestLen = kl.length;
    }
  }
  return best ?? FALLBACK_EMOJI;
}

/** Exact match on word / id / slug / nounForm, then an alias pointing at a known id. */
function findKnown(lower: string, known: readonly Card[], aliases?: Record<string, string>): Card | undefined {
  const slug = slugify(lower);
  const direct = known.find(
    (c) =>
      c.word.toLowerCase() === lower ||
      c.id.toLowerCase() === lower ||
      (slug !== '' && c.id === slug) ||
      (c.nounForms ?? []).some((n) => n.toLowerCase() === lower),
  );
  if (direct) return direct;
  if (!aliases) return undefined;
  const aliasId = own(aliases, lower) ?? (slug !== '' ? own(aliases, slug) : undefined);
  return aliasId ? known.find((c) => c.id === aliasId) : undefined;
}

/** findKnown over the word as typed, then its naive singular forms. */
function resolveKnown(lower: string, known: readonly Card[], aliases?: Record<string, string>): Card | undefined {
  for (const candidate of [lower, ...singulars(lower)]) {
    const hit = findKnown(candidate, known, aliases);
    if (hit) return hit;
  }
  return undefined;
}

/** A single typed emoji: the known card drawn with it, a keyword-map reverse lookup, else an emoji card. */
function cardFromEmoji(glyph: string, emojiMap: Record<string, string>, known: readonly Card[], aliases?: Record<string, string>): Card {
  const bare = bareEmoji(glyph);
  const drawn = known.find((c) => bareEmoji(c.emoji) === bare);
  if (drawn) return drawn;
  for (const [name, value] of Object.entries(emojiMap)) {
    if (bareEmoji(value) !== bare) continue;
    const hit = resolveKnown(name.toLowerCase(), known, aliases);
    if (hit) return hit;
  }
  return { id: TYPED_PREFIX + codepointId(glyph), word: glyph, emoji: glyph, tags: [], modifiers: [glyph], base: false };
}

/**
 * Turn free text from a slot into a card, or `null` when there is nothing to
 * work with (empty / punctuation only). If the text names a known card (by
 * word, id, nounForm, alias or naive singular, case-insensitively) that card
 * is returned so curated recipes still fire. A single emoji resolves to the
 * card drawn with it when there is one. Otherwise a typed card
 * (`id: "typed:<slug>"`, or `typed:u<codepoints>` for non-Latin text) is built.
 */
export function cardFromTypedWord(
  text: string,
  emojiMap: Record<string, string>,
  known: Card[],
  aliases?: Record<string, string>,
): Card | null {
  const cleaned = splitWords(text).join(' ');
  if (!WORD_CHAR_RE.test(cleaned) && !EMOJI_RE.test(cleaned)) return null;
  const lower = cleaned.toLowerCase();

  const match = resolveKnown(lower, known, aliases);
  if (match) return match;

  const g = glyphs(cleaned);
  if (g.length === 1 && EMOJI_RE.test(g[0])) return cardFromEmoji(g[0], emojiMap, known, aliases);

  const word = typedCase(g.slice(0, MAX_TYPED_WORD_LENGTH).join('').trim());
  const slug = slugify(word);
  const typedEmoji = glyphs(word).find((x) => EMOJI_RE.test(x));
  return {
    id: TYPED_PREFIX + (slug || codepointId(word)),
    word,
    emoji: typedEmoji ?? emojiFor(word, emojiMap),
    tags: [],
    modifiers: [word],
    base: false,
  };
}
