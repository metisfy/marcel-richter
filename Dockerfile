# syntax=docker/dockerfile:1
#
# Multi-Stage-Build für das Next.js-Standalone-Bundle.
#
#   deps    → installiert exakt die Abhängigkeiten aus package-lock.json
#   builder → baut die Seite (alle Seiten werden dabei statisch erzeugt)
#   runner  → schlankes Laufzeit-Image: nur server.js, .next/static, public
#
# Gebaut wird ausschließlich in GitHub Actions (.github/workflows/deploy.yml).
# Lokal testen:
#   docker build --build-arg SITE_URL=http://localhost:3100 -t marcel-richter:local .
#   docker run --rm -p 3100:3000 marcel-richter:local

# Node.js LTS auf Alpine. Beim nächsten LTS-Wechsel hier, in .nvmrc und in
# den Workflows (node-version-file: .nvmrc) anheben.
ARG NODE_VERSION=24-alpine

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
# libc6-compat: manche vorkompilierten Binaries erwarten glibc-Symbole.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Öffentliche URL (Canonical, hreflang, OG-Bilder, Sitemap) und Commit-SHA
# (Footer + /api/health). Kommen als Build-Args aus der Pipeline.
ARG SITE_URL=""
ARG GIT_SHA="dev"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=${SITE_URL} \
    GIT_SHA=${GIT_SHA}

RUN npm run build

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ARG GIT_SHA="dev"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=${GIT_SHA}

COPY --from=builder --chown=node:node /app/public ./public
# Schreibbar für den Bildoptimierungs-Cache (.next/cache/images).
RUN mkdir .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# Fragt nur ab, ob der Prozess lebt – kein Rendern, keine Inhalte.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
