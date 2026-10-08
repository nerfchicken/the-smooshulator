# The Smooshulator — design spec

*2026-10-07. Decisions made by dice roll where Adam would normally be asked.*

## What it is

A whimsical web toy for a 9-year-old: a calculator that adds **two words/pictures
together** and outputs a brand-new compound word or phrase with its own picture.
`blanket + daddy = Snuggle Daddy`. Results become new cards you can smoosh again,
so the game is Little-Alchemy-style **discovery**: how many things can you make?

No accounts, no server, no AI API. Works offline after first load. Runs on a
phone, a tablet, or a laptop. Published to the web at
`https://nerfchicken.github.io/the-smooshulator/`.

## Dice-rolled decisions

| Decision | Roll | Result |
|---|---|---|
| Name | d6=6 | **The Smooshulator** |
| Theme | d6=4 | **Retro arcade** — CRT glow, chunky pixel-ish type, neon on dark, coin-op "INSERT WORD" energy. Kid-friendly, not grim. |
| Mascot | d6=3 | **A dragon** (Smoosh the Dragon) who lives in the calculator and reacts |
| 💩 card | d6=3 | Included |
| Quests | d6=2 | **Free play only** — no goal list. Discovery count + "Smooshopedia" is the progression. |

## Core loop

1. Player sees a **tray of cards** (emoji + word). Starts with ~40 base cards.
2. Player picks two cards (tap/click one then the other, or drag onto the two
   calculator slots). Or types any word into a slot.
3. Player hits the big **`=`** button (or it auto-fires). The Smooshulator
   rattles, the dragon reacts, and a **result card** pops out: new phrase + new
   picture + a one-line "flavor" sentence.
4. First-time discoveries get confetti + a sound + "NEW!" badge and go into the
   tray and the **Smooshopedia** (collection). Repeat results just show the card.
5. Result cards are combinable, so chains happen: `Snuggle Daddy + Dragon`.

Nothing is ever a dead end: every pair produces *something* fun.

## Combination engine (the heart)

Pure TypeScript module `src/engine/`, no DOM, fully unit-tested, deterministic
(same two inputs always produce the same output — kids compare notes).

### Card data model

```ts
type Card = {
  id: string;            // "blanket"
  word: string;          // "Blanket"
  emoji: string;         // "🛏️"  (one or two emoji; composite rendered by UI)
  tags: string[];        // ["soft", "warm", "bedtime"]
  modifiers: string[];   // words this card contributes when it modifies another:
                         // blanket -> ["Snuggle", "Cozy", "Snuggly"]
  nounForms?: string[];  // optional alt nouns: daddy -> ["Daddy", "Dad"]
  flavor?: string;       // one-liner shown on the card
  base: boolean;         // starting card vs discovered
};
type Recipe = {
  inputs: [string, string];   // card ids, order-independent
  result: { word: string; emoji: string; flavor: string; tags?: string[]; modifiers?: string[] };
};
```

### Resolution order

1. **Curated recipe** — if `(a,b)` has a hand-written recipe, use it. These are
   the jokes and the delight (`toothbrush + dragon = Fire-Breathing Flosser`).
   Target: 250+ curated recipes over the base set, every base card in ≥6.
2. **Modifier mash** — otherwise, pick a modifier from one card and a noun from
   the other: `Snuggle Daddy`. Direction and which modifier are chosen by a
   seeded hash of the pair so it is stable. Emoji = composite `[a.emoji, b.emoji]`.
   Tags = union. Modifiers = union (so chains stay expressive). Phrase length is
   capped at 3 words: when a discovered card is an input, only its *last* noun
   is used as the noun, and its own modifiers remain available.
3. **Portmanteau** — for a typed word the game doesn't know: blend syllables
   (`blanket + daddy -> Blankaddy`) using a vowel-boundary split, and give it a
   generic emoji from a small keyword→emoji map (fallback ✨). Shown as the
   phrase *and* the portmanteau: "Blankaddy (a Blanket Daddy)". Unknown typed
   words get `modifiers: [Word]` and `tags: []` so they can still mash.

Same card twice (`cat + cat`) → "Double Cat" style doubling rule with a doubled
emoji, curated where funny.

### Content guardrails

Everything a 9-year-old and their parent would both laugh at. Potty humor yes
(💩, stinky socks, burps). No violence beyond cartoon (dragon fire is fine),
nothing scary-scary, nothing romantic, no brand names.

## UI / UX

Single page, mobile-first, big touch targets (≥56px), no scrolling needed on a
phone in portrait for the calculator itself; the tray scrolls.

Layout (portrait):

```
┌──────────────────────────────┐
│  THE SMOOSHULATOR   [🐉]  ★12 │  ← title, dragon, discovery count
│  ┌────────┐  +  ┌────────┐   │  ← two input slots (cards or typed)
│  │  🛏️    │     │  👨    │   │
│  │ Blanket│     │ Daddy  │   │
│  └────────┘     └────────┘   │
│        [  =  SMOOSH!  ]      │  ← giant button
│  ┌──────────────────────┐    │  ← result card slides/pops in
│  │   🛏️👨  Snuggle Daddy │    │
│  │   "Warm. Snoring."   │    │
│  └──────────────────────┘    │
│ ─ TRAY ───────────────────── │
│  [🐱 Cat][🐶 Dog][🍕 Pizza]… │  ← scrollable grid of cards; tap to fill slot
│  [📖 Smooshopedia] [🔀 Random]│
└──────────────────────────────┘
```

Interactions:
- Tap a tray card → fills the first empty slot (or replaces slot 2 if both full).
  Tap a slot → clears it. Drag-and-drop also supported on pointer devices.
- Type into a slot (there's a keyboard icon); Enter fills it.
- **Random** button fills both slots with random tray cards (great for kids who
  stall). **Smoosh the result again**: tapping the result card puts it in slot 1.
- Smooshopedia: modal grid of everything discovered, with recipe shown
  ("Blanket + Daddy"). Count of discovered / curated total shown as "★ 12".
- Share: "Copy" button copies `🛏️ + 👨 = Snuggle Daddy` text for texting dad.

Feel:
- Retro arcade: dark background, neon accents (pink/cyan/yellow), chunky
  display font (Google Fonts "Press Start 2P" for headings only — body uses a
  readable rounded sans like "Nunito"), subtle scanline overlay, cards with
  thick borders and hard drop shadows.
- The `=` press: calculator shakes, slot cards slam together, result pops with
  a squash-and-stretch. New discovery → confetti burst + arpeggio. Dragon
  (an SVG/emoji character in the corner) has idle blink, "thinking", "WOW!",
  and "ew" reactions driven by result tags.
- Sound via WebAudio synthesized tones (no audio files): tap blip, smoosh
  crunch, discovery arpeggio. Mute toggle persisted.
- `prefers-reduced-motion` respected.

## Persistence

`localStorage` key `smooshulator.v1`: discovered cards (full card objects, since
generated ones can't be re-derived without the recipe), discovery log with
inputs, mute setting. Reset button hidden in the Smooshopedia footer ("Start
over" with confirm).

## Tech stack

- **Vite + React 18 + TypeScript**, no UI framework; CSS modules or plain CSS
  with custom properties. Keep bundle small.
- **Vitest** for engine unit tests. **Playwright** for e2e + screenshots used by
  the playtest agents.
- **Docker**: `Dockerfile` based on the official Playwright image (Node
  included) so unit tests, e2e and the dev server all run through
  `docker compose run --rm app <cmd>` / `docker compose up`. No host installs.
- **Deploy**: GitHub Actions workflow builds and publishes `dist/` to GitHub
  Pages on push to `main`. `vite.config.ts` sets `base: '/the-smooshulator/'`.
- PWA-lite: `manifest.webmanifest` + icons so it can be added to a home screen.
  (Service worker is a stretch goal; skip if time is short.)

## Project layout

```
src/
  engine/        combine.ts, portmanteau.ts, hash.ts, types.ts, index.ts
  data/          cards.ts (base cards), recipes.ts (curated), emojiMap.ts
  ui/            App.tsx, Calculator.tsx, Slot.tsx, CardView.tsx, Tray.tsx,
                 Smooshopedia.tsx, Dragon.tsx, Confetti.tsx
  audio/         sounds.ts (WebAudio)
  state/         store.ts (useReducer + localStorage)
  styles/        tokens.css, app.css
tests/
  engine/*.test.ts     (vitest)
  e2e/*.spec.ts        (playwright)
```

## Testing

- Engine: TDD. Determinism, recipe precedence, modifier mash rules, 3-word cap,
  portmanteau edge cases (short words, no vowels, unicode), doubling rule,
  "every pair of base cards yields a non-empty result" property test.
- Data: test that every curated recipe references existing card ids, no
  duplicate pairs, every base card appears in ≥6 recipes, no banned words.
- E2E: load → tap two cards → smoosh → result visible → reload → still
  discovered. Screenshots at phone and desktop sizes for playtesters.
- Playtest: subagents role-play 9-year-olds (and one parent) reading
  screenshots and the recipe list; their feedback drives a polish pass.

## Out of scope (tonight)

Multiplayer, accounts, LLM-generated combos, real image generation, quests,
a physical card game printout (fun later: the data model supports it).
