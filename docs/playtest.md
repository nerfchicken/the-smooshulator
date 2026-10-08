# Smooshulator playtest panel (simulated) — 2026-10-08

Four role-played panelists, 15 pairs each. Curated results are quoted from `src/data/recipes.ts`. Mash/portmanteau results were computed with the real engine (temp copy of `src/` under node; no project changes), so the hash-seeded outputs shown are exact. Pair ids use the engine key `a+b`.

---

## Maya, 9 — cats, unicorns, gross jokes, wants to win

| Pair | Result | Her line | Rating |
|---|---|---|---|
| cat+unicorn | Caticorn, "uses it to knock things over" | "THAT'S SO TRUE" | 😂 |
| cat+poop | Litter Box, "It knows you have not." | reads it twice | 😂 |
| unicorn+poop | Rainbow Nuggets | screams, shows dad | 😂 |
| princess+unicorn | Sparkle Royalty | "pretty" | 🙂 |
| cat+cat | Catastrophe | gets the pun after 2 s, delighted | 😂 |
| daddy+poop | Toilet Humor 🚽👨 | side-eyes dad | 🙂 |
| cat+princess | Princess Whiskers, "tuna on a golden plate" | "that's Mittens" | 🙂 |
| poop+poop | Double Dookie, "Open all the windows." | 😂 | 😂 |
| unicorn+pickle | Dillicorn | "ew but ok" | 🙂 |
| cat+pizza | Purr-peroni, "Licks it." | 😂 | 😂 |
| unicorn+banana *(mash)* | Sparkly Banana, "Equal parts Banana and Unicorn. Zero parts sensible." | "that's just two words" | 😐 |
| typed **butt**+cat | Catutt — "A Cat Butt. Obviously." 🐱🍑 | shows dad immediately | 😂 |
| typed **slime**+unicorn | Slimunicorn 🟢🦄 | "ok that's cool" | 🙂 |
| typed **Minecraft**+dragon | Draginecraft — "A Dragon Minecraft." 🐉✨ | "it's backwards. and no picture" | 🙄 |
| typed **Ava**+unicorn | Avunicorn — "A Ava Unicorn." | "that's not even a word" | 😐 |

- **10-minute test: passes.** Cat/unicorn/poop coverage is dense (cat 41, poop 41 curated); NEW! + confetti carries it. She stalls once unicorn runs into mashes (18 of its 42 pairs).
- **Typed path:** gross words win (butt, poop, fart, slime get emoji, and "A Cat Butt. Obviously." saves the blend). Friends' names and Minecraft/Roblox fail: ✨ fallback, "A Ava", and the typed word is forced into the noun slot so it reads backwards.
- "Winning" = the ★ counter. `0/562` reads as impossible; she wants ★ 12 going up.

## Theo, 8 — iPad, taps fast, mashes Random

| Pair | Result | Reaction |
|---|---|---|
| rocket+rocket | Rocket Race, "Three, two, one, GO." | reads it all, cheers |
| dinosaur+robot | Robosaurus, "Still tiny arms." | 😂 |
| dog+pizza | Crust Hound | fine |
| dinosaur+poop | Fossil Dookie, "Museums keep it. Really." | "REALLY?" (asks dad) |
| fire+car | Fire Truck 🚒, "Woo woo woo." | best one, makes the noise |
| rocket+monster | Alien 👽 | taps it again immediately |
| robot+sun *(mash)* | Beeping Sun, "Looks like Robot. Acts like Sun." | "what does it do?" |
| thunder+pickle *(mash)* | Sour Thunder | shrugs, hits Random |
| dinosaur+bubble *(mash)* | Jurassic Bubble | can't read "Jurassic", skips |
| tree+rocket *(mash)* | Turbo Tree | "ok" |
| ghost+snow *(mash)* | Ghost Snow, "Part Ghost, part Snow, all trouble." | nothing |
| robot+pirate *(mash)* | Mechanical Pirate | can't read "Mechanical" |
| monster+car | Car Muncher, "Burps hubcaps." | "what's a hubcap" |
| dragon+dinosaur | Dragosaurus, "Cannot reach its own fire." | 😂 |
| bear+pickle | Sour Grizzly | fine |

- Flavor lines are mostly 3–6 word sentences — right for him. Too-wordy: **Jurassic, Mechanical, Abominable, Constellation, Hibernation, Tardigrade, Meringue, Operatic, Indestructible, Her Royal Cheesiness**.
- Random lands on a mash ~38% of the time (341 of 903 base pairs); the mash templates ("Zero parts sensible", "Science has gone too far") are adult-register and give him nothing.
- **"42 more" badge:** "more what?" Per-card curated-pairs-remaining is not something an 8-year-old infers; on every card it is noise.
- 🫧 (Bubble card + 9 recipes) is Emoji 14: a tofu box on iPads still on iOS ≤15.3.

## Priya, 10 — the strategist, chains everything

| Pair | Result | Her take |
|---|---|---|
| blanket+daddy | Snuggle Daddy 🛏️👨 | baseline |
| Snuggle Daddy+dragon | Snoring Dragon 🐉🛏️ | "it forgot Daddy" — emoji dropped 👨 |
| …+cat | Fire-Breathing Cat 🐱🐉 | fun, but the chain has no memory |
| …+poop | Poopy Cat | 3 smooshes deep, result is 2 plain words |
| Dadzilla+mommy | Dadzilla Mommy | "should be Parentzilla" |
| Catastrophe+dog | Chaotic Dog | fine |
| Dragicorn+princess | Fire-Breathing Princess | 🙂 |
| Caticorn+Dragicorn | Fire-Breathing Caticorn | best chain — keeps the made-up word |
| Her Royal Cheesiness+cat | Whiskery Cheesiness | 🙄 noun truncated to last word |
| Snuggle Daddy+Snuggle Daddy | Double Snuggle Daddy 🛏️🛏️ | emoji lost dad again |
| mommy+dinosaur *(mash)* | Jurassic Mom | notices Daddy has 42 recipes, Mommy 31 |
| mommy+thunder *(mash)* | Thunder Mom | "fine" |
| water+cloud *(mash)* | Fluffy Water | "that should be Fog" |
| bed+tree *(mash)* | Woody Bed | "that should be Hammock or Treehouse" |
| typed **kitty**+dog | Dogitty, "A Dog Kitty." | synonym bypasses Frenemies |

- **Chaining is the weak loop.** Mash always yields exactly `Modifier + lastWord`, so depth never shows in the name; only the flavor line remembers ("What happens when Fire-Breathing Cat meets Poop."). It rewards only when the noun is a coined word (Caticorn, Dadzilla, Purrito → "Stinky Purrito").
- **Mash vs curated:** filler whenever the picked modifier is the card's own noun ("Ghost Snow", "Star Music", "Pickle Cloud"). 20 cards list their own word as modifier #1.
- **Dead cards** (noun-ish modifiers, low curated count): **tree** (18), **bed** (19), **book** (18), **pickle** (16), **bubble** (17), **rocket** (18), plus **water, star, cloud, ghost, frog** whose modifiers are their own name. **mommy** has 11 uncurated base pairs; daddy has 0.

## Dad — content and UI audit

| Pair / input | Result | Verdict |
|---|---|---|
| blanket+poop | Dutch Oven | laughs; she asks what it means; fine |
| daddy+poop / mommy+poop | Toilet Humor / Diaper Duty | fine, fair |
| cat+fire | Toasted Kitty, "Slightly crispy." | **wince** — crispy cat for a cat kid |
| snow+poop | Yellow Snow, "You know why." | fine (she won't know why) |
| dog+fire | Hot Dog, "No, not the dog. Relax." | fine |
| mommy modifier "Bossy" → "Bossy Pirate", "Bossy Dinosaur" | mash | **wince** — gendered; Dad gets "Snoring" |
| rainbow+rainbow | "Whoa. WHOA. What does it mean?" | 2010 meme; confusing not funny |
| banana+book | Yellow Pages | she has never seen a phone book |
| sock+music | Sock Hop | 1950s |
| daddy+music | Dad Dance, "Please stop." | accurate |
| ghost+tree | Spooky Woods, "a branch or a hand? A branch." | borderline, resolves; OK |
| typed **belly** | 🫃 (pregnant man emoji) | **fix** |
| typed **dinosaur**+**trex** | **"Dinosex"** 🦖🦖 | **must fix before morning** |
| typed **icecream**+cat | Caticecream 🐱🧊 | wrong emoji (substring "ice"), misses Ice Cream card |
| emojiMap `lego` | brand name | minor, spec says none |

- Nothing romantic; violence stays cartoon; scary is fine except Toasted Kitty.
- **Emoji render risk:** 🫧 and 🫃 are Emoji 14 (iOS 15.4+). 🪥, 🐻‍❄️, 🪱, 🪆, 🪄, 🪨, 🪙, 🥷 are Emoji 13 (iOS 14.2+). ZWJ sequences: 🏴‍☠️ (fine), 🐻‍❄️, and the profession keys in emojiMap. Look-alikes: blanket+ghost is `👻`, same as the Ghost card; rain+thunder and cloud+thunder are both `⛈️`; cat+baby `🐈` reads as Cat.
- **UI (screenshots):** good enough to show other parents — neon, dragon, confetti and NEW! all land. Unfinished: (1) phone Smooshopedia header wraps to "1 // 562"; (2) disabled SMOOSH! is a khaki slab that reads as broken; (3) phone tray shows three oversized cards each wearing a green "N more" pill, so the first impression is "there are 3 cards".

---

## Ranked fix list

1. **[engine] Profanity guard on portmanteau.** `dinosaur+trex → Dinosex`. In `blendWords`, reject blends containing a banned substring (sex, ass, tit, cum, dick, cock, fag, nig, poon…) and fall back to plain concatenation or `"{A} {B}"`.
2. **[engine] Typed word leads, not trails.** Sorting by id puts `typed:` after most base ids, so Minecraft+dragon = "A Dragon Minecraft". Treat the typed card as the modifier: word `"{Typed} {Base}"` ("Minecraft Dragon", "Ava Unicorn"), portmanteau as subtitle, `An` before vowels.
3. **[content] Curate Mommy's 11 missing pairs** (cloud, thunder, banana, bubble, rocket, dinosaur, pirate, frog, star, snow, tree). E.g. `mommy+dinosaur` "Momasaurus — Roars at bedtime. Hugs right after."; `mommy+rocket` "Launch Mom — Three, two, one, SHOES ON, go."; `mommy+pirate` "Captain Mom — Arrr. Pick up your socks, matey."; `mommy+snow` "Snow Day Mom — Hot cocoa ready before you asked."
4. **[content] Fix modifiers.** `mommy`: replace `Bossy` with `Speedy`. Remove the plain-noun first modifier from ghost, star, music, tree, water, cloud, pickle, rainbow, frog, bubble, banana, sock, rocket, car, monster, bear, baby, snow, fire, thunder (replace with an adjective: Floating, Shooting, Humming, Climbing, Drippy, Puffy…). Kills "Ghost Snow"-style filler.
5. **[engine] Keep the noun's picture in chains.** `composite()` takes the *first* glyph of each input; Snuggle Daddy 🛏️👨 + dragon → 🐉🛏️. For discovered cards use the *last* glyph (the noun side).
6. **[engine] Chains should keep coined words.** Use the whole recipe word as noun when it is ≤2 words or a single coined token ("Whiskery Snuggle Daddy", not "Whiskery Cheesiness"); never truncate "Her Royal Cheesiness" to "Cheesiness".
7. **[ui] Smooshopedia header on phone** wraps and renders "//". Put the count in a pill under the title; use "1 of 562".
8. **[ui] Disabled SMOOSH!** → dim outline button labelled "pick 2 cards"; keep yellow only when armed.
9. **[ui] "N more" badges** → hide by default; show a small ★ dot on cards that still have secrets, with the number only in the Smooshopedia. Main counter shows ★ 12, not 0/562.
10. **[content] Replace `belly: '🫃'`** with `'🎈'` (or drop the key); replace `'🫧'` on the Bubble card and its 9 recipes with `'🧼'`, or feature-detect Emoji 14 once and swap at load.
11. **[engine] Typed aliases** before portmanteau: kitty/kitten→cat, puppy→dog, mum/mama→mommy, papa→daddy, dino/t-rex/trex→dinosaur, icecream→ice-cream, poo→poop, so curated recipes fire. Fix `emojiFor` substring order (`icecream` → 🧊).
12. **[content] Rewrite dated/adult references.** `rainbow+rainbow` flavor → "Two rainbows. The sky is showing off."; `banana+book` word → "Banana Book", flavor "Every page peels. Chapter two is mushy."; `sock+music` flavor → "Dancing in socks. Slide. Whee. Thud."
13. **[content] Soften `cat+fire`.** Toasted Kitty → "Fireside Kitty — Too close to the fire. Fur slightly warm. Totally fine."
14. **[content] De-dupe emoji.** `blanket+ghost` → `🛏️👻`; `cloud+thunder` → `☁️⚡`; `cat+baby` → `👶🐱`.
15. **[engine] Kid-level mash flavor templates.** Replace "Zero parts sensible" / "Science has gone too far" / "Nobody asked for this" with "A {b}. But {a}-flavored.", "What if {a} was also {b}? This.", "Smooshed. No refunds.", "{a}. {b}. Both at once. Oh no."

## Top 10 funniest

1. `cat+cat` Catastrophe — "Two cats, one sunbeam. Chaos."
2. `blanket+cat` Purrito — "Do not unwrap."
3. `dog+book` Homework Eater — "The teacher will not believe you."
4. `daddy+monster` Tickle Monster — "Ten fingers. No mercy. Run."
5. `mommy+book` Story Mom — "Skips a page. You notice. She knows you noticed."
6. `robot+sock` Sock Finder — "Error. Socks not found."
7. `daddy+car` Road Trip Dad — "Knows a shortcut. It is not a shortcut."
8. `dragon+book` Dragon Tale — "Once upon a time... FIRE. The end."
9. `ice-cream+music` Ice Cream Truck — "That song. From three streets away. RUN."
10. `baby+poop` Diaper Blowout — "Up the back. Up the FRONT. How? HOW?"

## Top 10 flattest (with rewrites)

1. `cloud+cloud` Overcast — "The sky is one big gray blanket today." → "The sky forgot to turn on. Nap weather."
2. `book+book` Library — "Shhh. Books everywhere. Smells like paper." → "Shhh. A thousand stories. One librarian with a look."
3. `moon+star` Night Sky — "Count them. Asleep by twelve." → "Counted 400 stars. Lost count. Started over. Asleep."
4. `frog+water` Pond — "Lily pads. Ribbits. Mud between your toes." → "Ribbit. Splash. Something just touched your foot."
5. `mommy+cheese` Mac and Mom — "Cheesy, warm, the best thing at dinner." → "Cheesy. Warm. Broccoli hidden at the bottom."
6. `cookie+bear` Honey Cookie — "Bear-shaped. Honey-flavored. Bear-approved." → "The bear ate the whole box. Then the box."
7. `dragon+fire` Inferno — "Dragon plus fire. Maximum toastiness." → "So hot the marshmallows gave up."
8. `star+tree` Treetop Star — "Someone climbed up there." → "Dad climbed up there. Dad is still up there."
9. `star+snow` Snowflake Star — "A star that melts." → "Catch it on your tongue. Gone. Catch another."
10. `sun+star` Big Star — "Surprise: the sun IS a star. Mind blown." → "The sun is a star. Yes. Really. Ask a teacher."

Worth curating (currently mash): `water+cloud` "Fog — Cannot see the dog. The dog is right there."; `bed+tree` "Hammock — A bed that swings. Fell out. Got back in."; `ghost+snow` "Chilly Boo — A ghost made of snow. Boo. Brrr."; `sun+poop` "Steaming Pile — Fresh. Warm. Do not look directly at it."
