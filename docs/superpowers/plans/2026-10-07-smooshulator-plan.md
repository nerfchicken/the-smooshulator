# Smooshulator — implementation plan

Spec: `docs/superpowers/specs/2026-10-07-smooshulator-design.md`. All commands run
through Docker: `docker compose run --rm app <cmd>`.

## Wave 1 (parallel, no code deps)
- [x] Spec
- [ ] Scaffold: Vite/React/TS, Vitest, Playwright, Docker, Pages workflow
- [ ] Content: `src/data/cards.ts`, `src/data/recipes.ts`, `src/data/emojiMap.ts`
- [ ] Research: `docs/research.md`
- [ ] Visual: `src/styles/tokens.css`, `src/styles/app.css`, `src/ui/DragonSvg.tsx`, `public/icon.svg`, `docs/mockup.html`

## Wave 2 (parallel, after scaffold)
- [ ] **Engine** (TDD, vitest) `src/engine/`: `hash.ts` (fnv1a seeded picks),
      `portmanteau.ts`, `combine.ts` (`combine(a: Card, b: Card, ctx: {recipes, cards}) => Card`),
      `normalize.ts` (typed word → Card via emojiMap), `index.ts`.
      Data tests in `tests/data/*.test.ts` (recipe integrity, coverage, banned words).
- [ ] **State + audio** `src/state/store.ts` (reducer: slots, discovered, log, mute;
      localStorage `smooshulator.v1`; migration-safe), `src/audio/sounds.ts`
      (WebAudio blip/crunch/arpeggio/ew, unlock on first gesture).
- [ ] **UI** `src/ui/*`: App, Calculator, Slot, CardView, Tray, Smooshopedia,
      Dragon (wraps DragonSvg + mood logic), Confetti (canvas, hand-rolled).
      Built against the CSS class contract from the visual agent and the engine's
      public API (stub until engine lands, then wire).

## Wave 3 (sequential-ish)
- [ ] Integration: wire engine ↔ state ↔ UI; e2e tests (tap-tap-smoosh,
      persistence across reload, typed word, random, Smooshopedia, mute).
- [ ] Screenshot run (phone + desktop) → playtest panel: 3 simulated 9-year-olds
      + 1 parent read screenshots and sample 40 recipes; produce ranked feedback.
- [ ] Polish pass from feedback. Code review pass (correctness + simplification).
- [ ] Create GitHub repo (public), push, enable Pages, verify live URL on phone
      viewport via Playwright against the live site.
- [ ] README + morning handoff note.
