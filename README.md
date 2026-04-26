# Web Research Harness

Local-first research harness for Echo. The goal is a disciplined web research pipeline that's cheap to run and produces structured, citation-friendly, agent-consumable output.

## Commands

```bash
npm install
npm run research -- search "valet trash competitors" -n 5
npm run research -- fetch https://example.com --max-chars 5000
npm run research -- render https://example.com --screenshot output/example.png
npm run research -- pipeline "firecrawl web agent github" -n 3 --format markdown --chunk
npm run research -- compare "solana defi" "base defi" --per-query 3 --format summary
npm run research -- crawl https://example.com --depth 1 --max-pages 10 --chunk
npm run research -- cache stats
npm run research -- cache purge
npm test
```

## Architecture

```
search → fetch → extract → score → dedupe → citations → output
   │        │        │                       ↑
   │        │        └─ chunks (optional)    │
   │        └─ links/headings/metadata       │
   └─ compare/multi-query                    │
                                            cache (1h TTL)

crawl: seed URL → BFS links → fetch pages → chunks/citations
```

### Modules

| Module | Purpose |
|---|---|
| `search.mjs` | Search discovery (Brave API or DuckDuckGo HTML fallback) |
| `fetch-url.mjs` | Cheap HTTP fetch with Readability text, headings, links, metadata, JS-gating detection |
| `render.mjs` | Playwright-rendered extraction for JS-heavy pages |
| `extractors.mjs` | Extraction strategies: Readability, structural (headings/links/meta), JS-gate detection |
| `pipeline.mjs` | Composable pipelines: `researchPipeline` (single query) and `comparePipeline` (multi-query) |
| `crawl.mjs` | Breadth-first crawler with depth/page caps, same-domain restriction, URL filters |
| `chunking.mjs` | Citation-ready text chunks + citation ledger |
| `url-utils.mjs` | URL normalization, host matching, tracking-param stripping, file-type filtering |
| `formatters.mjs` | Output formats: JSON, Markdown report, compact summary, JSON Feed |
| `cache.mjs` | Disk-based cache with TTL, purge, stats |

## What v0.3 borrows from other research/crawl systems

A quick scan of open-source deep research and crawler projects suggested the following patterns:

- **dzhng/deep-research:** breadth/depth controls, iterative search, comprehensive markdown reports with sources.
- **Firecrawl/Web Agent:** layered primitives (search/scrape/crawl/extract), structured output, citations/audit trails, scheduled refresh jobs.
- **Crawl4AI:** local-first, LLM-ready markdown, multiple extraction strategies, semantic/chunk-oriented processing.
- **ScrapeGraphAI:** crawl as graph traversal with depth/max-page controls, same-domain options, schema-oriented extraction.
- **LangChain Open Deep Research:** separate phases/models for search summarization, research, compression, final report; parallel researchers for bigger jobs.

This harness keeps the implementation small but now has the right primitives for those ideas: depth/page-limited crawling, chunks, citation ledgers, domain filters, scoring, markdown reports, and importable modules.

## Extraction Strategies

- **readability** — Mozilla Readability article extraction. Best for blogs, news, docs.
- **structural** — Headings, links, images, OG metadata. Works on any HTML.
- **render** (via `render` command) — Full Playwright render. Last resort for JS-gated pages.
- **crawl** — Follows links breadth-first for site/domain exploration.

## Crawl

```bash
# Crawl a site locally, same-domain only by default
npm run research -- crawl https://docs.example.com --depth 2 --max-pages 25 --chunk

# Focus on docs pages and skip blog/changelog noise
npm run research -- crawl https://example.com --include '/docs/' --exclude '/blog/,/changelog/'

# Allow off-domain links when mapping an ecosystem
npm run research -- crawl https://example.com --cross-domain --depth 1 --max-pages 20
```

Crawl output includes each page's URL, parent URL, depth, title, status, headings, links, text preview, and optional citation chunks.

## Chunks + citations

Use `--chunk` with `pipeline`, `compare`, or `crawl` to emit chunks like:

```json
{
  "index": 0,
  "content": "...",
  "source": {
    "url": "https://example.com",
    "finalUrl": "https://example.com/",
    "title": "Example Domain",
    "retrievedAt": "2026-04-26T...Z",
    "chunkId": "https://example.com#chunk-0"
  }
}
```

Pipeline and compare outputs also include a `citations` ledger with URL/title/timestamp/status/source/score for audit trails.

## Scoring

Results are scored 0–100 based on:

- Content depth (bytes, text length)
- Snippet quality
- Readability/structural extraction success
- JS-gating penalty (−20)
- HTTPS bonus, status code, content type

## Output Formats

- `json` — Full structured JSON (default)
- `markdown` / `md` — Markdown report with headings, snippets, scores
- `summary` — Compact titles + URLs
- `jsonfeed` — JSON Feed v1.1 format

## Domain Filtering

```bash
# Only search specific domains
npm run research -- pipeline "react hooks" --domains react.dev,github.com

# Exclude noise
npm run research -- pipeline "solana tutorial" --exclude-domains medium.com,dev.to
```

## Cache

- Default TTL: 1 hour
- Stored in `.cache/` (gitignored)
- Cache keys are SHA-256 hashed
- Commands: `cache stats`, `cache purge` (expired only), `cache clear`

## API keys

Optional:

- `BRAVE_API_KEY` — improves search discovery (Brave API)
- Without it, falls back to DuckDuckGo HTML scraping

## Design principles

- **Cheap first.** Static fetch + Readability before Playwright.
- **Structured output.** Everything is JSON-parseable; other agents can consume it.
- **Citation-aware.** Every chunk can carry URL/title/retrieval timestamp.
- **Cache aggressively.** Re-running the same query within an hour is free.
- **Composable.** Pipeline functions are importable as ES modules.
- **Local-first.** No hard dependencies on paid scraping APIs.
- **Never store API keys in this repo.**