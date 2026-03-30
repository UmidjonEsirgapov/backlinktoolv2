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

RUN mkdir -p public
RUN npx prisma generate
RUN npm run build
RUN npx tsc -p tsconfig.worker.json

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p ./public
COPY --from=builder /app/public ./public

# Worker compiled output
COPY --from=builder /app/dist ./dist

# Prisma: schema + client + engine binary + CLI
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Worker runtime dependencies
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

RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

# Default CMD — overridden by docker-compose per service
CMD ["node", "server.js"]
