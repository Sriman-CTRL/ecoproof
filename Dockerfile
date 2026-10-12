# EcoProof API for Render (free web service). The Playwright image ships Chromium for the PDF renderer;
# its tag must match the installed playwright version (apps/api/package.json).
FROM node:24-bookworm-slim AS node24

FROM mcr.microsoft.com/playwright:v1.64.0-noble
# The repo needs Node >= 24; take it from the official Node image whatever the Playwright image ships.
COPY --from=node24 /usr/local/bin/node /usr/local/bin/node
RUN npm install -g pnpm@10.33.0

WORKDIR /app
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @ecoproof/shared --filter @ecoproof/calc run build \
  && pnpm --filter @ecoproof/api exec prisma generate \
  && pnpm --filter @ecoproof/api run build

ENV NODE_ENV=production
WORKDIR /app/apps/api
# Render sets PORT. Migrations are run from the owner's machine, never on start.
CMD ["node", "--conditions=ecoproof-dist", "dist/server.js"]
