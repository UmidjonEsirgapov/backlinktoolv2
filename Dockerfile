# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# Compile worker to JS
RUN npx tsc -p tsconfig.worker.json

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output (includes its own node_modules subset)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Worker compiled output
COPY --from=builder /app/dist ./dist

# Prisma schema + generated client + native engine binary
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Worker runtime dependencies (not bundled in standalone)
COPY --from=builder /app/node_modules/undici ./node_modules/undici
COPY --from=builder /app/node_modules/cheerio ./node_modules/cheerio
COPY --from=builder /app/node_modules/tldts ./node_modules/tldts
COPY --from=builder /app/node_modules/robots-parser ./node_modules/robots-parser
COPY --from=builder /app/node_modules/parse5 ./node_modules/parse5
COPY --from=builder /app/node_modules/htmlparser2 ./node_modules/htmlparser2
COPY --from=builder /app/node_modules/dom-serializer ./node_modules/dom-serializer
COPY --from=builder /app/node_modules/domhandler ./node_modules/domhandler
COPY --from=builder /app/node_modules/domutils ./node_modules/domutils
COPY --from=builder /app/node_modules/css-select ./node_modules/css-select
COPY --from=builder /app/node_modules/css-what ./node_modules/css-what
COPY --from=builder /app/node_modules/boolbase ./node_modules/boolbase
COPY --from=builder /app/node_modules/entities ./node_modules/entities

# Data directory (will be overridden by volume mount)
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

# Default: start web server
# Override CMD to run worker: node dist/worker/index.js
CMD ["node", "server.js"]
