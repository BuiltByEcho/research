# Web Research Harness

Local-first research harness for Echo. The goal is a disciplined web research pipeline that's cheap to run and produces structured, agent-consumable output.

## Commands

```bash
npm install
npm run research -- search "valet trash competitors" -n 5
npm run research -- fetch https://example.com --max-chars 5000
npm run research -- render https://example.com --screenshot output/example.png
npm run research -- pipeline "firecrawl web agent github" -n 3 --format markdown
npm run research -- compare "solana defi" "base defi" --per-query 3 --format summary
npm run research -- cache stats
npm run research -- cache purge
npm test
```

## Architecture

```
search → fetch → extract → score → dedupe → output
                                    ↑
                                 cache (1h TTL)
```

### Modules

| Module | Purpose |
|---|---|
| `search.mjs` | Search discovery (Brave API or DuckDuckGo HTML fallback) |
| `fetch-url.mjs` | Cheap HTTP fetch with Readability extraction + JS-gating detection |
| `render.mjs` | Playwright-rendered extraction for JS-heavy pages |
| `extractors.mjs` | Extraction strategies: Readability, structural (headings/links/meta), JS-gate detection |
| `pipeline.mjs` | Composable pipelines: `researchPipeline` (single query) and `comparePipeline` (multi-query) |
| `formatters.mjs` | Output formats: JSON, Markdown report, compact summary, JSON Feed |
| `cache.mjs` | Disk-based cache with TTL, purge, stats |

### Extraction Strategies

- **readability** — Mozilla Readability article extraction. Best for blogs, news, docs.
- **structural** — Headings, links, images, OG metadata. Works on any HTML.
- **render** (via `render` command) — Full Playwright render. Last resort for JS-gated pages.

### Scoring

Results are scored 0–100 based on:
- Content depth (bytes, text length)
- Snippet quality
- JS-gating penalty (−20)
- HTTPS bonus, status code, content type

### Output Formats

- `json` — Full structured JSON (default)
- `markdown` / `md` — Markdown report with headings, snippets, scores
- `summary` — Compact titles + URLs
- `jsonfeed` — JSON Feed v1.1 format

### Domain Filtering

```bash
# Only search specific domains
npm run research -- pipeline "react hooks" --domains react.dev,github.com

# Exclude noise
npm run research -- pipeline "solana tutorial" --exclude-domains medium.com,dev.to
```

### Cache

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
- **Cache aggressively.** Re-running the same query within an hour is free.
- **Composable.** Pipeline functions are importable as ES modules.
- **No hard dependencies on paid APIs.** Brave is optional; Firecrawl stays optional.
- **Never store API keys in this repo.**