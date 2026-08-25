# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* vars in at build time, not runtime - default these to the same-origin proxy
# paths from .env.example so the standalone container works out of the box. Override at build
# (--build-arg) only if this container talks to a different backend/analytics setup than Vercel.
ARG VITE_QSTORY_API_URL=/api/qstory
ARG VITE_QSTORY_ANALYTICS_URL=/api/qstory/v1/beta-events
ARG VITE_QSTORY_VOICE_RESEARCH_URL=/api/qstory/v1/voice-research
ARG VITE_QSTORY_LANDING_URL=https://qstory.ai.kr
ENV VITE_QSTORY_API_URL=$VITE_QSTORY_API_URL \
    VITE_QSTORY_ANALYTICS_URL=$VITE_QSTORY_ANALYTICS_URL \
    VITE_QSTORY_VOICE_RESEARCH_URL=$VITE_QSTORY_VOICE_RESEARCH_URL \
    VITE_QSTORY_LANDING_URL=$VITE_QSTORY_LANDING_URL

# Regenerate (not check) - the build context here doesn't include the sibling be/ repo that
# scripts/generate-story-package.mjs optionally reads for Supabase audio URLs, so a plain
# `npm run build`'s content:check would always see the committed (host-generated, Supabase-URL)
# files as stale against this container's local-asset-URL regeneration and fail every build.
RUN npm run build:docker

# ---- Runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S qstory && adduser -S qstory -G qstory

COPY --from=build /app/dist ./dist
COPY --from=build /app/api ./api
COPY container-server.mjs ./

USER qstory

EXPOSE 8080
ENV PORT=8080
# Server-side only (never baked into the browser bundle) - the actual deployed backend URL, e.g.
# https://your-backend.up.railway.app. Same variable api/_qstory-proxy-core.mjs already reads.
ENV QSTORY_API_UPSTREAM_URL=""
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O- "http://localhost:${PORT}/" || exit 1

CMD ["node", "container-server.mjs"]
