# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Production image for the Codely Next.js app (standalone output).
# The Yjs collaboration server is built separately — see Dockerfile.yjs.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# ── deps ──────────────────────────────────────────────────────────────────────
# Install ALL dependencies (dev deps are required to build Next + bundle the
# Monaco workers). Skip lifecycle scripts here: the postinstall hooks copy the
# Pyodide runtime and bundle the Monaco workers, and they need the full source
# tree (scripts/, public/) which isn't present at this layer yet.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# must be provided now — not just at runtime. Passed as build args from compose.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_YJS_WEBSOCKET_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_YJS_WEBSOCKET_URL=$NEXT_PUBLIC_YJS_WEBSOCKET_URL

# Regenerate the gitignored, self-hosted runtime assets that postinstall
# normally produces (public/pyodide + public/monaco) from node_modules.
RUN node scripts/copy-pyodide.mjs && node scripts/build-monaco-workers.mjs
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
# Minimal image: just the standalone server + static + public assets.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Prerender cache dir owned by the runtime user
RUN mkdir .next && chown nextjs:nodejs .next

# Leverage Next output file tracing to keep the image small
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3005
ENV PORT=3005
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
