import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { combine, pairKey, type Card, type Recipe } from '../../src/engine';

const dataDir = resolve(__dirname, '../../src/data');
const hasData = existsSync(resolve(dataDir, 'cards.ts')) && existsSync(resolve(dataDir, 'recipes.ts'));

const BANNED = ['kill', 'dead', 'gun', 'sexy', 'damn', 'hell', 'stupid', 'shut up', 'drugs', 'beer'];
const MIN_RECIPES = 280;
const MIN_RECIPES_PER_CARD = 6;

/** Whole-word, case-insensitive match so "shell" doesn't trip "hell". */
const bannedIn = (text: string): string[] =>
  BANNED.filter((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'i').test(text));

describe.skipIf(!hasData)('data integrity: cards + recipes', () => {
  let cards: Card[] = [];
  let recipes: Recipe[] = [];
  let ids: Set<string>;

  beforeAll(async () => {
    const cardsMod = await import(/* @vite-ignore */ resolve(dataDir, 'cards.ts'));
    const recipesMod = await import(/* @vite-ignore */ resolve(dataDir, 'recipes.ts'));
    cards = cardsMod.BASE_CARDS as Card[];
    recipes = recipesMod.RECIPES as Recipe[];
    ids = new Set(cards.map((c) => c.id));
  });

  it('exports non-empty BASE_CARDS and RECIPES', () => {
    expect(cards.length).toBeGreaterThan(0);
    expect(recipes.length).toBeGreaterThan(0);
  });

  it('base card ids are unique, slug-like and marked base', () => {
    const seen = new Set<string>();
    const problems: string[] = [];
    for (const c of cards) {
      if (seen.has(c.id)) problems.push(`duplicate id ${c.id}`);
      seen.add(c.id);
      if (!/^[a-z0-9-]+$/.test(c.id)) problems.push(`non-slug id ${c.id}`);
      if (!c.base) problems.push(`${c.id} not base`);
      if (!c.word.trim()) problems.push(`${c.id} empty word`);
      if (!c.emoji.trim()) problems.push(`${c.id} empty emoji`);
    }
    expect(problems).toEqual([]);
  });

  it('every recipe input id exists in BASE_CARDS', () => {
    const missing = recipes.flatMap((r) => r.inputs.filter((id) => !ids.has(id)).map((id) => `${r.result.word}: ${id}`));
    expect(missing).toEqual([]);
  });

  it('has no duplicate pair keys', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const r of recipes) {
      const key = pairKey(r.inputs[0], r.inputs[1]);
      if (seen.has(key)) dupes.push(`${key} ("${seen.get(key)}" and "${r.result.word}")`);
      seen.set(key, r.result.word);
    }
    expect(dupes).toEqual([]);
  });

  it(`has at least ${MIN_RECIPES} recipes`, () => {
    expect(recipes.length).toBeGreaterThanOrEqual(MIN_RECIPES);
  });

  it(`every base card appears in at least ${MIN_RECIPES_PER_CARD} recipes`, () => {
    const counts = new Map<string, number>();
    for (const r of recipes) for (const id of new Set(r.inputs)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const thin = cards.filter((c) => (counts.get(c.id) ?? 0) < MIN_RECIPES_PER_CARD).map((c) => `${c.id} (${counts.get(c.id) ?? 0})`);
    expect(thin).toEqual([]);
  });

  it('every card has 2-4 modifiers', () => {
    const bad = cards.filter((c) => c.modifiers.length < 2 || c.modifiers.length > 4).map((c) => `${c.id} (${c.modifiers.length})`);
    expect(bad).toEqual([]);
  });

  it('every recipe result has a word, emoji and flavor', () => {
    const bad = recipes
      .filter((r) => !r.result.word.trim() || !r.result.emoji.trim() || !r.result.flavor.trim())
      .map((r) => pairKey(r.inputs[0], r.inputs[1]));
    expect(bad).toEqual([]);
  });

  it('contains no banned words in card words, flavor, modifiers or recipe results', () => {
    const hits: string[] = [];
    for (const c of cards) {
      for (const text of [c.word, c.flavor ?? '', ...c.modifiers, ...(c.nounForms ?? [])]) {
        for (const w of bannedIn(text)) hits.push(`card ${c.id}: "${w}" in "${text}"`);
      }
    }
    for (const r of recipes) {
      for (const text of [r.result.word, r.result.flavor, ...(r.result.modifiers ?? [])]) {
        for (const w of bannedIn(text)) hits.push(`recipe ${pairKey(r.inputs[0], r.inputs[1])}: "${w}" in "${text}"`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('flagship: blanket + daddy = Snuggle Daddy', () => {
    const blanket = cards.find((c) => c.id === 'blanket');
    const daddy = cards.find((c) => c.id === 'daddy');
    expect(blanket, 'blanket card').toBeDefined();
    expect(daddy, 'daddy card').toBeDefined();
    const r = combine(blanket!, daddy!, { recipes, cards });
    expect(r.source).toBe('recipe');
    expect(r.key).toBe(pairKey('blanket', 'daddy'));
    expect(r.card.word).toBe('Snuggle Daddy');
  });
});
