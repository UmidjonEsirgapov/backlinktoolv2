# Backlink Tool — .uz Domain Hunter

Production-grade web crawler that:
1. Crawls a list of source sites (your `saytlar.json`)
2. Discovers all external outbound links on every page
3. Filters for `.uz` domains
4. Checks each `.uz` domain: available, for sale, or not for sale
5. Shows results in a live dashboard — ready for export

---

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- npm

### Setup

```bash
# 1. Clone / open project
cd "Backlink tool"

# 2. Install dependencies
npm install

# 3. Create .env
cp .env.example .env

# 4. Create data directory & run migrations
mkdir -p data
npx prisma migrate deploy

# 5. Start development (web + worker concurrently)
npm run dev
```

Open http://localhost:3000

### Dev commands

```bash
npm run dev          # Web + worker together (recommended)
npm run dev:web      # Only Next.js web app
npm run dev:worker   # Only background worker
npm run db:studio    # Prisma Studio (database UI)
npm test             # Run unit tests
```

---

## Usage

1. **Import sites**: Click "📥 Import" → paste domain list or upload `saytlar.json`
2. **Start crawling**: Click "▶ Start All"
3. **Watch progress**: Sites tab shows per-site crawl progress
4. **View results**: Domains tab (filtered to `.uz` + For Sale by default)
5. **Export**: "📤 Export" → CSV or JSON

### saytlar.json format

Any of these work:

```json
["kun.uz", "daryo.uz", "spot.uz"]
```

```json
{"sites": ["kun.uz", "daryo.uz"]}
```

```json
{"domains": ["kun.uz", "daryo.uz"]}
```

Or plain text (one per line):
```
kun.uz
daryo.uz
spot.uz
```

---

## Deploy to Coolify (VPS)

### Option 1: Docker Compose (Recommended)

1. Push this repo to GitHub/GitLab

2. In Coolify:
   - New Resource → Docker Compose
   - Connect your repo
   - Coolify auto-detects `docker-compose.yml`
   - Set environment variables (see below)
   - Deploy

3. Environment variables to set in Coolify:
   ```
   DATABASE_URL=file:/data/backlink.db
   NODE_ENV=production
   WORKER_CRAWL_CONCURRENCY=3
   CRAWLER_MAX_PAGES_PER_SITE=500
   ```
   
   Optional (for DA scores):
   ```
   OPENPAGERANK_API_KEY=your_key_here
   ```

4. The `db_data` volume is created automatically. Your SQLite database persists across deployments.

### Option 2: Dockerfile only (single container)

If you want a single container, use a process manager. Add this to `docker-compose.yml`:

```yaml
# Single container mode: runs web + worker in one container
app:
  build: .
  command: sh -c "node server.js & node dist/worker/index.js"
  ...
```

### Ports
- Web: `3000` (map to whatever you like in Coolify)

### Volumes
- `db_data:/data` — SQLite database persisted here

### Resource recommendations (VPS)
| Sites | RAM | CPU |
|-------|-----|-----|
| ≤100  | 1GB | 1   |
| 400   | 2GB | 2   |
| 1000+ | 4GB | 4   |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Docker Compose                              │
│                                              │
│  ┌──────────┐     ┌──────────────────────┐  │
│  │   web    │     │       worker         │  │
│  │ Next.js  │     │   Node.js process    │  │
│  │ :3000    │     │                      │  │
│  │          │     │  ┌─────────────────┐ │  │
│  │ Dashboard│     │  │ CRAWL_SITE jobs │ │  │
│  │ REST API │     │  │ CHECK_DOMAIN    │ │  │
│  └────┬─────┘     └──────────┬──────────┘  │
│       │                      │              │
│       └──────────┬───────────┘              │
│                  │                          │
│         ┌────────▼────────┐                 │
│         │  SQLite DB      │                 │
│         │  /data/backlink │                 │
│         │  .db (WAL mode) │                 │
│         └─────────────────┘                 │
│                                              │
│  (shared Docker volume: db_data)             │
└─────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | SQLite + Prisma | No external service, file-based, WAL mode handles concurrent access |
| Queue | DB-backed (JobQueue table) | No Redis needed, crash-safe, resume on restart |
| HTTP | undici + cheerio | Fast, lightweight, no browser needed for most sites |
| Domain check | DNS + HTTP parking detection + RDAP | Free, no API keys required |
| DA score | OpenPageRank API (optional) | Free API key available, graceful skip if absent |
| Frontend | Next.js App Router | Single repo, SSR + client polling |
| Worker | Separate Node.js process | Doesn't block web requests, Coolify restarts independently |

---

## Crawler behavior

- **robots.txt**: Always respected (fetched and cached per domain)
- **sitemap.xml**: Auto-discovered from robots.txt and default paths
- **Depth limit**: Default 5 (configurable via `CRAWLER_MAX_DEPTH`)
- **Page limit**: Default 500 per site (`CRAWLER_MAX_PAGES_PER_SITE`)
- **Rate limit**: 500ms between requests to same domain (`CRAWLER_RATE_LIMIT_MS`)
- **Retry**: 3 attempts with exponential backoff (500ms, 1s, 2s)
- **Timeout**: 15s per request (`CRAWLER_REQUEST_TIMEOUT_MS`)
- **Concurrency**: 5 pages simultaneously per site (`CRAWLER_PAGE_CONCURRENCY`)
- **Deduplication**: URL normalized (fragment removed, tracking params stripped, sorted params)
- **Pause/Resume**: Site-level and system-level pause support

## Domain availability detection

| Signal | Method |
|--------|--------|
| DNS NXDOMAIN | Node.js `dns.resolve4/6` — fastest indicator |
| Parking page | HTTP fetch + pattern matching (GoDaddy, Sedo, Afternic, Dan.com, etc.) |
| RDAP status | Free IANA RDAP bootstrap — detects redemption/pending-delete states |
| DA score | OpenPageRank free API (optional, set `OPENPAGERANK_API_KEY`) |

Sale statuses:
- **AVAILABLE** — DNS NXDOMAIN, domain can be registered
- **FOR_SALE** — Parking page detected, or RDAP shows redemption/expired state
- **NOT_FOR_SALE** — Domain resolves, no sale signals detected
- **UNKNOWN** — Not checked yet
- **CHECKING** — Currently being checked

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./data/backlink.db` | SQLite file path |
| `WORKER_CRAWL_CONCURRENCY` | `3` | Concurrent site crawls |
| `WORKER_DOMAIN_CHECK_CONCURRENCY` | `10` | Concurrent domain checks |
| `CRAWLER_MAX_DEPTH` | `5` | Max link depth per site |
| `CRAWLER_MAX_PAGES_PER_SITE` | `500` | Max pages per site |
| `CRAWLER_PAGE_CONCURRENCY` | `5` | Concurrent page fetches per site |
| `CRAWLER_REQUEST_TIMEOUT_MS` | `15000` | HTTP request timeout |
| `CRAWLER_RATE_LIMIT_MS` | `500` | Delay between requests |
| `OPENPAGERANK_API_KEY` | *(empty)* | Optional DA score API key |

---

## Database schema

Tables:
- `Site` — source domains with crawl status and progress
- `Page` — individual pages discovered during crawl
- `ExternalDomain` — unique external domains found (with sale status)
- `SiteExternalDomain` — junction: which site found which domain (+ frequency)
- `DomainLink` — specific outbound links (source URL, target URL, anchor, rel)
- `CrawlLog` — timestamped logs per site
- `JobQueue` — DB-backed job queue (no Redis)
- `AppSetting` — key-value settings (pause state, worker status)

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/sites?page&limit&q&status` | List sites |
| POST | `/api/sites` | Add sites `{domains: ["..."]}` |
| GET | `/api/sites/:id` | Site detail + external domains |
| PATCH | `/api/sites/:id` | Update status |
| DELETE | `/api/sites/:id` | Delete site |
| GET | `/api/sites/:id/logs` | Site crawl logs |
| GET | `/api/domains?uz=1&status&q` | List domains |
| POST | `/api/domains/:id/recheck` | Re-queue domain check |
| POST | `/api/control` | `{action: start\|pause\|resume\|stop_one\|recheck_uz}` |
| POST | `/api/import` | Import JSON/text domain list |
| GET | `/api/export?type=sale&format=csv` | Export results |

---

## Tests

```bash
npm test               # Run all unit tests
npm run test:watch     # Watch mode
```

Test coverage:
- URL normalization and deduplication
- HTML link extraction and classification
- Sitemap XML parsing
- Parking detection patterns

---

## License

MIT
