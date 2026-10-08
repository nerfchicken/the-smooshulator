# Engine / state / audio / data review

2026-10-08. Scope: `src/engine`, `src/state/store.ts`, `src/audio/sounds.ts`, `src/data/*`, `tests/`. `src/ui` excluded (only read to calibrate severity). Numbers below come from running the real engine against the real data (42 base cards, 562 recipes, 903 level-1 results, 1722 "discovered + own input" chains) under Node with type stripping; nothing was edited.

## Critical

### C1. Typed emoji / punctuation / non-Latin text collapses to `typed:nothing` and echoes the other input

`src/engine/combine.ts:244-268`, `src/engine/portmanteau.ts:16-21,121-123`

Scenario: kid on an iPhone taps the emoji keyboard and types `🐱`, then adds Cat. Result: `Cat` (word identical to the input, emoji `🐱✨`). `💩💩`, `!!!`, `日本` and an empty string all get the same id `typed:nothing`, so `🐱 + Cat` and `!!! + Cat` share discovery key `cat+typed:nothing` (second one shows as "already found"), and `🐱 + !!!` is treated as the same card twice and yields `Double 🐱`. Root cause: `slugify` strips everything non-ASCII, so the id falls through to `'nothing'`, and `makePortmanteau` returns the other side verbatim when one side normalizes to no letters.

Fix (in `cardFromTypedWord`, before the known-card match; `firstGlyph` is already exported from `./emoji`):

```ts
const glyph = firstGlyph(cleaned);
if (!/[a-z0-9]/.test(slug) && glyph) {
  // Emoji typed: reverse-lookup the keyword map so 🐱 becomes the Cat card.
  const name = Object.entries(emojiMap).find(([, v]) => v === glyph)?.[0];
  if (name) return cardFromTypedWord(name, emojiMap, known);
  const isEmoji = /\p{Extended_Pictographic}/u.test(glyph);
  return {
    id: TYPED_PREFIX + 'u' + [...cleaned].map((c) => c.codePointAt(0)!.toString(16)).join('-'),
    word: 'Mystery',
    emoji: isEmoji ? glyph : FALLBACK_EMOJI,
    tags: [], modifiers: ['Mystery'], base: false,
  };
}
```

And guard the echo in `makePortmanteau` (lines 122-123): when one side has no letters, return `'Mystery ' + <other side>` instead of the other side alone.

### C2. Chains echo their own input: "Cozy Dragon + Blanket = Cozy Dragon"

`src/engine/combine.ts:147-175`

108 of 1722 (6%) "discovered card + one of its own inputs" smooshes return a word identical to the discovered card (`Pizza Soup + Pizza = Pizza Soup`, `Purring Cookie + Cat = Purring Cookie`, `Star Mom + Star = Star Mom`). This is the most natural chain a kid tries ("add MORE blanket") and it produces nothing new, violating the no-dead-ends guarantee. `phraseOk` only rejects adjacent duplicates and modifier == noun; it never compares the whole phrase against the input words.

Fix: thread a banned set through `mashPhrase` / `tryMash`:

```ts
function mashPhrase(first: Card, second: Card, seed: number): string {
  const banned = new Set([first.word, second.word].map((w) => w.toLowerCase()));
  const ok = (m: string, n: string) => phraseOk(m, n) && !banned.has(`${m} ${n}`.toLowerCase());
  // use `ok` in tryMash and in the FALLBACK_MODIFIERS.find(...)
```

(`tryMash` needs an `ok` parameter or closure; the fallback line already iterates `FALLBACK_MODIFIERS`, so a banned phrase there just steps to the next one.)

## Should-fix

### S1. `fromDouble` breaks the 3-word cap

`src/engine/combine.ts:111-122`

17 level-1 cards double into 4 words (`Double Road Trip Dad`, `Double Ice Cream Sandwich`, `Double Five More Minutes`), and repeated doubling grows without bound (`Double Double Double Catastrophe`). The property test only checks base pairs, so this is untested.

```ts
const ws = splitWords(card.word);
const steps = ['Double', 'Triple', 'Quadruple'];
const i = steps.indexOf(ws[0]);
const prefix = i === -1 ? 'Double' : steps[i + 1] ?? 'Mega';
const rest = (i === -1 ? ws : ws.slice(1)).slice(-(MAX_PHRASE_WORDS - 1));
const word = `${prefix} ${rest.join(' ')}`;
```

### S2. 24-char truncation can split a surrogate pair

`src/engine/combine.ts:260`

`cleaned.slice(0, 24)` is a UTF-16 slice. `aaaaaaaaaaaaaaaaaaaaaaa🐱zz` produces a `word` ending in a lone `\ud83d` (renders as a replacement box) and the same lone surrogate is copied into `modifiers`, then persisted. Fix: `Array.from(cleaned).slice(0, MAX_TYPED_WORD_LENGTH).join('').trim()` (or `glyphs(cleaned)` from `./emoji`).

### S3. `play()` never resumes from iOS's `interrupted` state

`src/audio/sounds.ts:88` (and the comment at `:5-7`)

iOS sets `AudioContext.state` to `'interrupted'` (not `'suspended'`) after a phone/FaceTime call, Siri, or an app switch. `unlockAudio` handles it (`!== 'running'`) but the `visibilitychange` call to it runs outside a user gesture and is not guaranteed to succeed; afterwards every `play()` sees `'interrupted'`, skips its nudge, and the game is silent until reload. Fix: `if (c.state !== 'running') void c.resume().catch(() => undefined);`.

Related, lower confidence: the doc comment recommends `pointerdown` (and `App.tsx` uses it). Per the HTML spec, `pointerdown` from a touch pointer is not an activation-triggering event (`pointerup`, `touchend`, `click`, `keydown` are), so the first unlock attempt on iOS may be rejected. Today it self-heals because `crunch()`/`blip()` run synchronously inside click handlers and `play()` re-nudges, so the practical cost is at most a silent first tap. Still, change the recommendation to `pointerup` + `keydown`. Verify on an iPhone: the first tray tap should blip.

### S4. iPhone ringer switch silences all sound

`src/audio/sounds.ts` (design-level)

Pure WebAudio runs in iOS's "ambient" audio session, which the hardware mute switch silences. A kid whose phone lives on silent hears nothing, and there is no in-app clue why. The standard workaround needs no audio file: on `unlockAudio`, create a looping `<audio>` element with a tiny silent data-URI WAV and `play()` it; this flips the session to "playback" and WebAudio follows. ~10 lines. Judgment call whether to honour the switch instead; verify by flipping the switch and tapping a card.

### S5. Safari's 7-day storage purge wipes progress

`src/state/store.ts` (persistence as a whole)

WebKit deletes all script-writable storage (localStorage included) for a site the user has not interacted with during 7 days of Safari use, unless the app was launched from the Home Screen. Kid plays, goes on a two-week holiday, comes back: Smooshopedia is empty. There is no code fix inside `store.ts`; options are (a) surface an "Add to Home Screen" hint on iOS (the manifest already exists), and/or (b) a "copy progress code" / paste-to-restore pair in the Smooshopedia footer (the `Persisted` JSON is already the right payload). Verify: WebKit blog "Full Third-Party Cookie Blocking and More", section "7-Day Cap on All Script-Writable Storage".

### S6. Same word reachable from different pairs looks like a duplicate discovery

`src/engine/combine.ts:177-189`, `src/state/store.ts:85-97`

2 level-1 mash words duplicate each other (`Frosty Robot` from ice-cream+robot and robot+snow; `Frosty Rocket` likewise), and 150 of 8400 sampled chains land on a word that already exists elsewhere (`Fetch Daddy + Blanket = Snuggle Daddy`, which collides with the curated card). The tray then shows two `Snuggle Daddy` cards with different pictures. The engine cannot know the discovered set, so dedupe in the store: in `smooshed`, if a discovered card already has the same `word` (case-insensitive), reuse that card as the result with `isNew: false` and log the new key against the existing `cardId`. Tray/Pedia already dedupe by card id.

### S7. Typed plurals skip curated recipes

`src/engine/combine.ts:249-258`

`cats`, `DOGS` build typed cards (`typed:cats`) and go down the portmanteau path, so `cats + dragon` gives `Catragon` instead of the curated cat+dragon joke. `emojiFor` already has `wordVariants`; run the known-card match over `wordVariants(lower)` too.

## Nit

### N1. Substring emoji lookup with 2-3 letter keys misfires

`src/engine/combine.ts:230-235`, `src/data/emojiMap.ts` (keys `ant bat cat dog key pig sky zoo ball ...`)

`pigeon` -> 🐷, `antelope` -> 🐜, `catalog` / `education` -> 🐱, `zoom` -> 🦁, `keyboard` -> 🔑, `skyscraper` -> 🌤️, `eyeball` -> ⚽, `television` -> ✨ (`tv` is a key but not `television`). Some are funny, some just wrong. Fix: allow keys shorter than 4 letters to match only at a word boundary (`new RegExp('\\b' + k)`), keep the "longest key first" ordering. `hotdog -> 🐶` in the tests still passes (`dog` is 3 letters but matches at the end; use `(^|\\b)k|k$` if you want to keep it).

### N2. Hyphenated modifier echoes the noun

`src/engine/combine.ts:147-153`

`Captain Fire + Dragon = Fire-Breathing Fire`, `Honey Cookie + Bear = Bear-Shaped Bear` (2 cases). `phraseOk` compares the whole modifier to the noun; also compare its hyphen parts: `mod.split('-').some((p) => nounWords.includes(p))`.

### N3. Noun-only recipe modifiers read badly when chained

`src/data/recipes.ts` (result `modifiers`)

The mash engine prepends a modifier to a noun, so bare nouns chain into "Jar Daddy"-class phrases. Worst offenders (recipe -> example chain phrase): `Jar` (Cookie Jar, Pickle Jar -> "Jar Daddy"), `Toe` (Toe Socks, Toe Brush -> "Toe Cat"), `Bunch` (Bunch), `Crew` (Pirate Crew), `Herd` (Unicorn Herd), `Cub` (Cub), `Full` (Full Moon -> "Full Daddy"), `Split` (Banana Split), `Manual` (Instruction Manual), `Mapped` (Treasure Map), `Recipe` (Cookbook), `Sheet` (Bedsheet Ghost), `Siren` (Fire Truck), `Mustard` (Hot Dog), `Hallway` (Boo Mama), `Diaper` (Diaper Duty), `Kitten`/`Hatchling`/`Lobster`/`Monkey`/`Squirrel`/`Puppet`/`Rover`/`Starfish`/`Yeti`, `Dadzilla`/`Mamazilla`. Swap for adjectival forms (`Cookie-Filled`, `Stinky-Toed`, `Bunched`, `Swashbuckling`, `Stampeding`, `Cuddly`, `Full-Moon`, `Banana-Split`, `Instructional`, `Treasure-Mapped`, `Cookbook`, `Bedsheet`, `Wailing`, `Mustardy`, ...). `Arrr`, `Yo-Ho`, `Ribbit` are fine as jokes. Everything else in the data checks out: no duplicate ids, no duplicate pairs, no unknown ids, every base card in >= 6 recipes, no result over 3 words, no duplicate result words, all recipe tags inside the card tag set, no multi-word modifiers, every card emoji is one grapheme and every result emoji is one or two.

### N4. Emoji that need a recent iOS, and a weak `Intl.Segmenter` fallback

`src/data/cards.ts` (`bubble` 🫧, `toothbrush` 🪥), `src/data/recipes.ts` (19 results use 🫧, 🐻‍❄️ for snow+bear), `src/engine/emoji.ts:6-15`

🫧 is Emoji 14 (iOS 15.4+), 🪥 and 🐻‍❄️ are Emoji 13 (iOS 14.2+); on an older hand-me-down iPad (Air 1 / mini 2-3 stuck on 12.5) they render as boxes. Judgment call: swap 🫧 -> 🧼 if the target device is old; otherwise ignore. Separately, the `Array.from(text)` fallback used when `Intl.Segmenter` is missing (Safari < 14.1, Firefox < 125) splits ZWJ sequences and drops VS16, so `firstGlyph('🏴‍☠️')` becomes 🏴 and `🛏️`/`☀️`/`🌧️`/`🗺️`/`⛈️`/`🌦️` lose their emoji presentation in composites and doubles (monochrome glyphs on Windows). Replace the fallback with a regex: `text.match(/\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*)*|./gsu) ?? []`.

### N5. Store validation accepts broken cards and keeps orphaned log entries

`src/state/store.ts:154-164,189-194`

`isCard` accepts `emoji: ''` and arrays of non-strings; `modifiers: [null]` makes `phraseOk` throw inside `combine` (crashes the smoosh handler). Cards that fail `isCard` are dropped but their log entries stay, so `discoveryCount` ("★ 12") counts cards the Tray/Pedia silently hide. Only reachable via corrupted/hand-edited storage, so low likelihood. Fix:

```ts
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
// in isCard: strs(v.tags) && strs(v.modifiers) && v.emoji.trim() !== '' && (v.nounForms === undefined || strs(v.nounForms))
const log = data.log.filter(isDiscovery).filter((d) => d.cardId in discovered);
```

### N6. Small text nits

- `src/engine/combine.ts:129`: portmanteau flavor is `A ${first.word} ...` -> "A Apple Dragon". Drop the article or pick A/An.
- `src/engine/combine.ts:63-66`: `titleCase` lowercases the tail, so `iPhone` -> `Iphone`, `LEGO` -> `Lego`. Only upper-case the first letter.

## Checked, no issue found

- `pairKey` grammar: 0 collisions across 408,156 pairs of base + level-1 ids (ids embedding `+`/`:` are unambiguous in practice). Result ids use distinct prefixes (`r:` `d:` `p:` `m:`), so recipe vs mash ids never collide.
- 3-word cap holds for mash chains: 0 of 1722 discovered+input mashes exceed 3 words; typed multi-word modifiers (`Big Red Dog`) are rejected by `phraseOk` and fall through to the other side. Modifier dedupe prevents "Snuggle Snuggle Daddy".
- Typed `Snuggle Daddy` resolves to the discovered card when `known` includes discovered cards (`App.tsx` passes base + discovered). `dad`/`mom` match via `nounForms`. Lower-casing is fine for Unicode (`ñandú` -> `typed:nandu`).
- Typed + typed -> portmanteau; typed + same typed -> `Double Zorb`; both deterministic and symmetric.
- Store: lazy `useReducer` initializer runs `load()` before first render, so the mount-time save writes the loaded state, not `initialState`. `random` with 0/1 cards is safe; the n-1 + skip trick never picks the same index twice. `smooshed` on a repeat key sets `isNew: false` and does not duplicate the log.
- `pick` throws only on an empty list, and every caller guarantees a non-empty list; index is always `< length`.
- `visibilitychange` handler is only registered after a context exists and `unlockAudio` null-checks anyway; nothing throws. `resume()` rejections are swallowed.

## Spec guarantees with no test

- Typed non-alphabetic input (emoji, punctuation, CJK): distinct ids, no echo of the other input (C1).
- Chain property over every level-1 card `D = (a, b)`: `combine(D, a)` and `combine(D, b)` are not equal to `D.word` or the input word (C2); `combine(D, D)` is <= 3 words (S1). `tests/engine/property.test.ts:54-61` only chains `cards[0] + cards[1]`.
- `cardFromTypedWord` truncation at grapheme boundaries (S2).
- Data: result emoji <= 2 graphemes; recipe tags subset of the card tag set; modifiers single-word; result word <= 3 words; result words unique. (All currently true, none enforced.)
- Store: partially valid saves (missing `modifiers`, empty `emoji`, non-string array elements, orphaned log entries) and a save containing `typed:` inputs round-tripping (N5).
- Sounds: `play()` nudges `resume()` from `interrupted`, not just `suspended` (S3).
- E2E reload persistence exists (`tests/e2e/play.spec.ts:29,73`) and the base-pair determinism/symmetry property is covered; nothing missing there.
