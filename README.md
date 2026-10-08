# The Smooshulator

A calculator that adds two things together and gets a third thing. It started
as a tooth-brushing conversation: "what do you get if you smoosh a blanket and
a daddy?" The answer, obviously, was Snuggle Daddy ("Warm. Snoring. Will not
move until morning."), and the app is just that question, repeated 577 times,
with confetti. Pick two cards or type two words, press SMOOSH!, and the result
is a new card with its own picture and a one-line joke. Every result can be
smooshed again, so it plays like a discovery game: a dragon mascot reacts, new
finds go into your Smooshopedia, and the star count climbs. No accounts, no
server, nothing to install; it runs in the browser on a phone, tablet or
laptop, and your Smooshopedia is saved on the device.

Play it here: **<https://nerfchicken.github.io/the-smooshulator/>**

## How to play

- Tap two cards from the tray (or tap an empty slot and type any word, even a
  friend's name), then press **= SMOOSH!**
- Tap the result to drop it back into the calculator and smoosh it with
  something else. Chains get silly fast.
- Cards wearing a little ★ still have secret recipes. Open the **Smooshopedia**
  to see everything you've found, how you made it, and how many are left.

## Running it

Everything runs inside Docker (the official Playwright image, so the e2e
browsers come preinstalled). Nothing is installed on the host.

```sh
docker compose up                              # dev server at http://localhost:5173/the-smooshulator/
docker compose run --rm app npm test           # unit tests (engine, store, UI logic)
docker compose run --rm app npm run e2e        # Playwright, phone + desktop
```

`npm run typecheck` and `npm run build` work the same way. Pushing to `main`
publishes `dist/` to GitHub Pages.

## How the content works

All the hand-written results live in
[`src/data/recipes.ts`](src/data/recipes.ts). Each one is a single `r(...)`
call: the two input card ids, the result's name, its emoji, the flavor line,
some tags (they drive the dragon's mood and the sound), and a couple of
modifier words the engine can borrow when this card gets smooshed with
something that has no recipe. Adding a new one is two lines:

```ts
// in RECIPES, under whichever input comes first in BASE_CARDS order
r('cat', 'rocket', 'Astrocat', '🐱🚀', 'First cat on the moon. Knocked the flag over.', ['space', 'silly'], ['Orbiting', 'Zooming']),
```

Pairs are order-independent (cat + rocket is the same as rocket + cat), and
self-pairs like cat + cat are allowed. The base cards are in
[`src/data/cards.ts`](src/data/cards.ts); typed words get an emoji from
[`src/data/emojiMap.ts`](src/data/emojiMap.ts), which also maps synonyms
(kitty, dad, t-rex) onto real cards.

## How a smoosh is resolved

The engine (`src/engine/`) tries these in order and takes the first that applies:

1. **Recipe** — the pair has a curated entry in `recipes.ts`; that's the result.
2. **Double** — both inputs are the same card and nothing is curated for it: Double Snuggle Daddy, then Triple, then Mega.
3. **Portmanteau** — one input was typed: the typed word leads ("Minecraft Dragon") and the blended word shows up in the flavor line.
4. **Mash** — anything else: one card lends a modifier, the other lends its noun ("Frosty Robot"), with a hash-seeded flavor line so the same pair always gives the same answer.

Results are deterministic, so a discovery you share is the one your friend gets.

---

Made overnight with [Claude Code](https://claude.com/claude-code).
