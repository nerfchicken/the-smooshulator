import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { combine, type Card, type EngineContext } from '../../src/engine';

const dataDir = resolve(__dirname, '../../src/data');
const hasData = existsSync(resolve(dataDir, 'cards.ts')) && existsSync(resolve(dataDir, 'recipes.ts'));

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const hasAdjacentDupe = (s: string) => words(s).some((w, i, arr) => i > 0 && w.toLowerCase() === arr[i - 1].toLowerCase());

describe.skipIf(!hasData)('property: every pair of base cards smooshes into something', () => {
  let cards: Card[] = [];
  let ctx: EngineContext;

  beforeAll(async () => {
    const cardsMod = await import(/* @vite-ignore */ resolve(dataDir, 'cards.ts'));
    const recipesMod = await import(/* @vite-ignore */ resolve(dataDir, 'recipes.ts'));
    cards = cardsMod.BASE_CARDS as Card[];
    ctx = { recipes: recipesMod.RECIPES, cards };
  });

  it('has a usable base set', () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it('yields a non-empty word, non-empty emoji, no adjacent repeats, ≤ 3 words unless curated', () => {
    const failures: string[] = [];
    for (let i = 0; i < cards.length; i++) {
      for (let j = i; j < cards.length; j++) {
        const r = combine(cards[i], cards[j], ctx);
        const label = `${cards[i].id}+${cards[j].id} -> "${r.card.word}" (${r.source})`;
        if (!r.card.word.trim()) failures.push(`${label}: empty word`);
        if (!r.card.emoji.trim()) failures.push(`${label}: empty emoji`);
        if (hasAdjacentDupe(r.card.word)) failures.push(`${label}: adjacent duplicate word`);
        if (r.source !== 'recipe' && words(r.card.word).length > 3) failures.push(`${label}: more than 3 words`);
        if (!r.card.flavor?.trim()) failures.push(`${label}: empty flavor`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('is symmetric and repeatable for every pair', () => {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const r1 = combine(cards[i], cards[j], ctx);
        const r2 = combine(cards[j], cards[i], ctx);
        expect(r1, `${cards[i].id}+${cards[j].id}`).toEqual(r2);
      }
    }
  });

  it('chained results (discovered + base) still stay within 3 words', () => {
    const discovered = combine(cards[0], cards[1], ctx).card;
    for (const c of cards) {
      const r = combine(discovered, c, ctx);
      expect(words(r.card.word).length, `${discovered.word}+${c.word} -> ${r.card.word}`).toBeLessThanOrEqual(3);
      expect(hasAdjacentDupe(r.card.word)).toBe(false);
    }
  });
});
