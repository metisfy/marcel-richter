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
# Optionale Besucherstatistik (leer = aus), siehe src/lib/analytics.ts
ARG UMAMI_SRC=""
ARG UMAMI_WEBSITE_ID=""
ARG GOOGLE_SITE_VERIFICATION=""
ARG BING_SITE_VERIFICATION=""
# BVV_SNAPSHOT_WRITE: frisch abgerufene Spielplandaten als „letzten bekannten
# Stand“ ins Image legen (content/saison/<saison>.bvv.json, src/lib/season.ts)
ENV NODE_ENV=production \
    BVV_SNAPSHOT_WRITE=1 \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=${GOOGLE_SITE_VERIFICATION} \
    NEXT_PUBLIC_BING_SITE_VERIFICATION=${BING_SITE_VERIFICATION} \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=${SITE_URL} \
    NEXT_PUBLIC_UMAMI_SRC=${UMAMI_SRC} \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=${UMAMI_WEBSITE_ID} \
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
# /app/data: Ablage des Admin-Bereichs (App-Geheimnis, DB-Verbindung) – im
# Betrieb das Volume marcel-richter-daten. Ein leeres Volume übernimmt beim
# ersten Einhängen Besitzer und Rechte dieses Ordners.
RUN mkdir .next data && chown node:node .next data && chmod 700 data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# Fragt nur ab, ob der Prozess lebt – kein Rendern, keine Inhalte.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
