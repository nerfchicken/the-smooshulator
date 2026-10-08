# Smooshulator — implementation research

*2026-10-07. Companion to `superpowers/specs/2026-10-07-smooshulator-design.md`. Each section ends with a decision; implementers should not need to re-research.*

## 1. Game-design lessons (Little Alchemy 2, Infinite Craft, Doodle God)

- **Never a null result.** LA2's biggest friction is "items vibrate, nothing happens" plus inconsistent feedback on repeats (https://ixd.prattsi.org/2024/02/design-critique-little-alchemy-2-ios-app/). We already guarantee output; keep the *repeat* path consistent too: same bounce every time, confetti only on first discovery.
- **Per-card "more to find" count.** LA2 marks "final" items that combine with nothing and hides them from the library (https://help.littlealchemy2.com/general/item-types). Invert it: each tray card shows a small badge = number of *curated* recipes involving it not yet discovered; at 0 the badge disappears. That is the whole "what to try next" system.
- **One-input hints.** LA2 sells hints; Infinite Craft has none and people stall. A free "Hint" button reveals *one* input of a random undiscovered curated recipe ("Try something with 🐉").
- **Newest-first chaining.** Infinite Craft's sidebar sorts newest discoveries first so the latest result is always one tap away (https://debarghyadas.com/writes/infinite-craft/). Do the same: tray order = newest discovered first, then base cards sorted by remaining-recipe count desc (easy wins up top).
- **First-discovery ceremony is the loop.** Infinite Craft's "First Discovery" tag is the entire reward. Keep NEW! loud and show `★ 12 / 250` so progress is visible without a checklist.
- **Rarity as the collection goal.** LA2's "hidden gems" give completionists targets. Tag ~10% of curated recipes `rare` and give those cards a gold border in the Smooshopedia.
- **Smooshopedia cards must be actionable.** LA2's search closes and loses the item. Tapping any Smooshopedia card fills a slot and closes the modal.

**Recommendation:** adopt all seven; the remaining-count badge and newest-first tray are the two that matter most.

## 2. Kid UX (ages 7–10) on touch

- **Targets:** 7–10-year-olds miss 7 mm targets ~30% of the time (https://init.cise.ufl.edu/wp-content/uploads/sites/378/2017/12/Woodward-et-al-ICMI2017.pdf); NN/g says 2 cm × 2 cm for under-9s (https://www.nngroup.com/articles/children-ux-physical-development/). Spec's 56 px floor is OK for tray cards (≈15 mm); make slots and `=` ≥ 80 px, with 8 px gaps.
- **Tap over drag.** Simple drags work, precise drops don't. Tap-to-fill is primary; drag is a desktop bonus (§3b). Drop zone = whole slot plus 16 px margin.
- **Feedback timing:** press state within 100 ms (`:active` transform, no JS), transitions 150–300 ms, discovery celebration ≤ 1.5 s and interruptible by the next tap.
- **Reading:** a 9-year-old reads at roughly grade 3–4. Body/card labels ≥ 18 px Nunito 700; flavor lines ≤ 8 words; Press Start 2P only for the title, counter, and the `=` button, uppercase, ≥ 16 px (pixel font: use multiples of 8 px). Never set a sentence in it.
- **Zoom/scroll on iOS:** Safari ignores `user-scalable=no`; use `touch-action: manipulation` on `html` (kills double-tap zoom, keeps pinch for accessibility) (https://dev.to/jasperreddin/disabling-viewport-zoom-on-ios-14-web-browsers-l13). Inputs need `font-size ≥ 16px` or focus zooms. Layout height = `100dvh` with `min-height: 100vh` fallback; `viewport-fit=cover` + `env(safe-area-inset-bottom)` for standalone mode. `overscroll-behavior: none` on `body`; only the tray gets `overflow-y: auto`.
- **Audio:** every AudioContext starts suspended; `resume()` only works synchronously inside a trusted gesture (`pointerdown`/`touchend`/`click`/`keydown`) (https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos). Re-resume on `visibilitychange`. iOS ring/silent switch mutes WebAudio; put a one-line "flip the ring switch" tip under the mute toggle.
- **Persistence:** Safari evicts all script storage after 7 days without interaction, *except* for home-screen-installed apps, which also get their own storage silo (https://www.browser-storage.com/browser-storage-fundamentals-quotas/storage-quotas-eviction-policies/ios-safari-7-day-storage-eviction-workaround/). So installing does not carry over Safari progress. Show a one-time "Add to Home Screen to keep your Smooshopedia safe" tip after the 3rd discovery.

**Recommendation:** 56/80 px targets, tap-first, `touch-action: manipulation`, `100dvh`, gesture-unlocked audio, install nudge.

## 3. Library picks

**(a) Confetti.** `canvas-confetti` is ~6 kB gz, zero deps, framework-agnostic, has `disableForReducedMotion: true` (https://bundlephobia.com/package/canvas-confetti). A hand-rolled burst is ~60 lines plus reduced-motion and cleanup handling. **Recommendation:** `canvas-confetti`, loaded via `import('canvas-confetti')` on first discovery; call `confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true })`.

**(b) Drag-and-drop.** `@dnd-kit/core` is ~6 kB gz but requires sensors, activation constraints (250 ms hold on touch to not fight scrolling), and a DndContext tree (https://dndkit.com/react/guides/sensors/). Ours is cards → two slots, no sorting. **Recommendation:** hand-rolled Pointer Events, desktop-only: on `pointerdown` with `pointerType !== 'touch'`, `setPointerCapture`, start after 8 px movement, move a cloned card with `transform`, drop via `document.elementFromPoint` hitting `[data-slot]`. Touch devices get tap-only (no scroll conflict, no `touch-action: none` needed on the tray). ~50 lines, zero deps.

**(c) Sound.** Hand-rolled WebAudio, `src/audio/sounds.ts`:

```ts
let ctx: AudioContext | null = null; export let muted = false;
export function unlockAudio() {           // wire to document pointerdown+touchend+keydown, once
  ctx ??= new (window.AudioContext ?? (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) unlockAudio(); });
const ready = () => !!ctx && ctx.state === 'running' && !muted;
function tone(freq: number, dur: number, type: OscillatorType, at = 0, vol = 0.2) {
  if (!ready()) return; const t = ctx!.currentTime + at;
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + dur);
}
export const blip = () => tone(880, 0.08, 'square');
export function crunch() {                 // filtered noise burst, 250 ms
  if (!ready()) return; const n = ctx!.sampleRate * 0.25;
  const buf = ctx!.createBuffer(1, n, ctx!.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  s.buffer = buf; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.5;
  s.connect(f).connect(g).connect(ctx!.destination); s.start();
}
export const arpeggio = () =>
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', i * 0.09, 0.25));
```

**(d) Fonts.** Google Fonts: `https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&family=Press+Start+2P&display=swap`. The pairing is right (pixel display + rounded humanist body); don't swap. For offline/no-tracking, self-host: `npm i @fontsource/press-start-2p @fontsource-variable/nunito` and `import '@fontsource/press-start-2p'; import '@fontsource-variable/nunito';` (https://fontsource.org/fonts/press-start-2p/install, https://www.npmjs.com/package/@fontsource/nunito). Set `font-display: swap` is already in the package CSS. **Recommendation:** self-host via fontsource; no Google Fonts link.

**(e) CRT overlay** — one fixed pseudo-element, a repeating gradient, no animation, no `backdrop-filter`:

```css
body::after { content: ""; position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px),
              radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.35) 100%); }
```

## 4. Emoji rendering

Composite = two absolutely positioned glyphs, second one smaller and offset, with a dark drop-shadow for separation:

```css
.art { position: relative; width: 1.6em; height: 1.2em; font-size: 40px; line-height: 1;
  font-family: "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif; }
.art span { position: absolute; top: 0; left: 0; }
.art span + span { left: .55em; top: .25em; font-size: .8em; filter: drop-shadow(0 0 2px #000); }
```

Apple, Noto, and Segoe draw the same code point differently (🐉, 🛏️ vary a lot); fine for a toy, but choose emoji ≤ Emoji 13 (2020) and avoid ZWJ sequences and skin-tone modifiers, which fall apart on older fonts. Append U+FE0F to text-default symbols (☀️ ❤️ ✨) so they render in color. Noto Color Emoji is multi-MB and Safari needs the SVG build while Chromium needs COLRv1 (https://github.com/infolektuell/noto-color-emoji) — two files, no payoff. For Playwright screenshots in Docker, the official image ships Noto Color Emoji; if screenshots show tofu, `apt-get install fonts-noto-color-emoji`.

**Recommendation:** system emoji stack, no shipped emoji font; composite via the CSS above; test the full card set on one Apple and one Chromium screenshot.

## 5. Portmanteau algorithm

Normalize: lowercase, NFD + strip diacritics, keep `[a-z]` only. Vowels = `aeiou`, plus `y` when not word-initial. A *vowel group* is a maximal vowel run.

1. **Silent e:** if A ends in consonant+`e` and has ≥ 2 vowel groups, drop the `e` before splitting (`cake` → `cak`).
2. **Head(A):** if A has ≥ 2 vowel groups, A up to the start of its *last* vowel group (`blanket` → `blank`, `pizza` → `pizz`, `dragon` → `drag`). If 1 vowel group or none, head = whole A (`cat`, `poop`, `brr`).
3. **Tail(B):** if head ends in a consonant, B from its *first* vowel group (`daddy` → `addy`, `rocket` → `ocket`). If head ends in a vowel, B from the first consonant after its first vowel group (`cat` → `t`); if none exists (`bee`), tail = B minus its first consonant cluster and head drops its trailing vowel group.
4. **Guards:** words < 3 letters are used whole on both sides; no vowels → whole word; collapse triple letters; if result equals A or B or is < 4 letters, fall back to `A + B` concatenated. Same card twice never reaches here (doubling rule); the same *typed* word twice → "Double X".
5. **Order:** head is slot 1. Swapping slots gives a different word — it's a feature; key portmanteau discoveries by ordered pair.
6. Capitalize first letter; display `"Blankaddy (a Blanket Daddy)"`.

Worked: blanket+daddy → **Blankaddy**; cat+rocket → **Catocket**; pizza+unicorn → **Pizzunicorn**; poop+princess → **Poopincess**; sun+moon → **Sunoon**; cat+dog → **Catog**; dragon+toothbrush → **Dragoothbrush**; zoo+cat → **Zoot**; cake+monkey → **Cakonkey**; robot+banana → **Robanana**.

**Recommendation:** implement exactly this in `src/engine/portmanteau.ts`; the ten examples above are the unit-test fixtures.

## 6. GitHub Pages gotchas (Vite SPA, `base: '/the-smooshulator/'`)

- Use `import.meta.env.BASE_URL` for any runtime asset URL; never hardcode `/`.
- Vite rewrites root-absolute `href`/`src` in `index.html` but **not** inside `manifest.webmanifest`. Put the manifest in `public/`, link it as `<link rel="manifest" href="/manifest.webmanifest">` (gets rewritten), and inside it use relative paths: `"start_url": "./"`, `"scope": "./"`, `"icons": [{ "src": "icons/icon-192.png", ... }, { "src": "icons/icon-512.png", ... }]` — these resolve against the manifest's URL (https://github.com/cncf/endusers/issues/302).
- iOS home screen: still wants `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180×180, opaque PNG) plus `<meta name="apple-mobile-web-app-capable" content="yes">` and `mobile-web-app-capable`; `display: "standalone"`, `theme-color`, `background_color` in the manifest.
- Standalone mode has no browser chrome: needs `viewport-fit=cover`, safe-area insets, and an in-app Reset.
- Deploy with `actions/configure-pages` → `actions/upload-pages-artifact` (`path: dist`) → `actions/deploy-pages`; set repo Settings → Pages → Source: *GitHub Actions*. No `.nojekyll` needed on that path. Pages caches `index.html` ~10 min; hashed assets are fine. Filenames are case-sensitive.
- No router, so no 404.html trick needed.
- **Spec gap:** "works offline after first load" requires a service worker; without one, offline works only while the tab/standalone app stays alive. Either add `vite-plugin-pwa` (`registerType: 'autoUpdate'`, honours `base`; ~5 min) or soften the claim.

**Recommendation:** relative manifest paths, apple-touch-icon in `index.html`, Actions-based deploy, and add `vite-plugin-pwa` rather than drop the offline promise.
