# Official Playwright image: Ubuntu 24.04 (noble) + Node + Chromium/Firefox/WebKit
# with all OS deps preinstalled. Tag MUST match the @playwright/test version in
# package.json (browser binaries are version-locked). Bump both together.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

# Install deps first so the layer is cached unless package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173 4173

# Dev server. Override with `docker compose run --rm app <cmd>` for tests/build.
CMD ["npm", "run", "dev"]
