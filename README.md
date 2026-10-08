# The Smooshulator

A whimsical web toy for a 9-year-old: a calculator that adds two words or
pictures together and spits out a brand-new compound thing with its own
picture (`blanket + daddy = Snuggle Daddy`). Results are cards you can smoosh
again, so it plays like Little-Alchemy-style discovery. No accounts, no server,
no AI; works offline after first load; runs on a phone, tablet or laptop.
Design spec: [`docs/superpowers/specs/2026-10-07-smooshulator-design.md`](docs/superpowers/specs/2026-10-07-smooshulator-design.md).

## Running it

Everything runs in Docker (the official Playwright image, so browsers for e2e
are preinstalled). Nothing needs to be installed on the host.

```sh
docker compose up                          # dev server -> http://localhost:5173/the-smooshulator/
docker compose run --rm app npm test       # Vitest unit tests (engine)
docker compose run --rm app npm run e2e    # Playwright e2e at phone + desktop sizes
```

Also: `docker compose build` after changing `package.json`, and
`docker compose run --rm app npm run typecheck` / `npm run build`.

## Deploy

Pushing to `main` builds and publishes `dist/` to GitHub Pages via
`.github/workflows/deploy.yml`. Live at
<https://nerfchicken.github.io/the-smooshulator/>.
