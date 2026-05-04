# BuiltByEcho Research

<p align="center">
  <img src="assets/brand/builtbyecho-logo-256.png" alt="BuiltByEcho logo" width="128" height="128">
</p>

> Local-first web research for agents: plan, search, fetch, render, rank, audit, trace, and report.

[![CI](https://github.com/BuiltByEcho/research/actions/workflows/ci.yml/badge.svg)](https://github.com/BuiltByEcho/research/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-0ea5e9.svg)](package.json)

**BuiltByEcho Research** is a practical research harness for agents and developers who need reliable source discovery, citation-backed reports, and browser-aware extraction — without depending on paid scraping APIs.

It starts cheap with plain HTTP fetches, escalates to Playwright only when a page needs rendering, scores source quality, audits evidence coverage, and saves traceable JSON artifacts so every research run can be inspected later.

```
┌─────────┐   ┌────────┐   ┌───────────┐   ┌──────────────────────┐
│  Plan   │──▶│ Search │──▶│   Fetch   │──▶│  Render?             │
│         │   │        │   │ (cheap)   │   │  ┌─ JS-gated?        │
│ multi-  │   │ Brave  │   │          │   │  ├─ thin text?        │
│ angle   │   │ or DDG │   │ Readabil.│   │  └─ auto-escalate    │
└─────────┘   └────────┘   └───────────┘   └──────────┬───────────┘
                                                      │
                    ┌─────────────────────────────────┘
                    ▼
             ┌────────────┐   ┌────────────┐   ┌──────────┐   ┌──────────┐
             │   Score &   │──▶│   Diversify │──▶│  Audit   │──▶│  Report  │
             │   Rank     │   │  by Host   │   │          │   │  + Trace │
             └────────────┘   └────────────┘   └──────────┘   └──────────┘
```

## Table of contents

- [Why this exists](#why-this-exists)
- [Current status](#current-status)
- [Installation](#installation)
- [Optional setup](#optional-setup)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Output formats](#output-formats)
- [Research audits](#research-audits)
- [Traces](#traces)
- [Browser escalation](#browser-escalation)
- [Structured extraction](#structured-extraction)
- [Crawling](#crawling)
- [Library API](#library-api)
- [Architecture](#architecture)
- [Package contents](#package-contents)
- [Development](#development)
- [CI](#ci)
- [Design principles](#design-principles)
- [Brand](#brand)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

## Why this exists

Most "research agents" fail in boring ways: one search query, shallow snippets, no source quality checks, no audit trail, no repeatability, and no clear path when evidence is weak.

BuiltByEcho Research is designed around the opposite workflow:

- **Plan first** — generate multiple search angles before fetching.
- **Fetch cheap first** — use static HTTP + Readability before opening a browser.
- **Render when needed** — use Playwright for JS-gated or thin pages.
- **Read pages semantically** — capture ARIA/accessibility snapshots, not just raw HTML.
- **Rank evidence** — source quality, freshness, host diversity, and extraction success all matter.
- **Audit the run** — mark weak research, missing coverage, and suggested follow-ups.
- **Leave a trace** — write reproducible JSON traces for debugging and review.
- **Write usable reports** — generate a readable brief with findings, caveats, and sources.

## Current status

**Version:** `0.5.2`

Good for:

- Landscape and competitive research
- Technical and source discovery
- Citation-backed first drafts
- Browser-rendered extraction from JS-heavy pages
- Structured page extraction (emails, phones, pricing, links)
- Agent pipelines that need JSON outputs with audit trails

Not a replacement for human judgment. Treat generated prose as a strong first draft and review it before high-stakes use.

## Installation

### Option 1: Install from GitHub

```bash
npm install -g github:BuiltByEcho/research
builtbyecho-research --help
```

Alias:

```bash
echo-research --help
```

### Option 2: Clone locally

```bash
git clone https://github.com/BuiltByEcho/research.git
cd research
npm install
npx playwright install chromium
npm test
node src/cli.mjs --help
```

### Option 3: npm package

```bash
npm install -g @builtbyecho/research
builtbyecho-research --help
```

### OpenClaw / Agent skill

This repo includes an OpenClaw-compatible skill at [`skills/builtbyecho-research/SKILL.md`](skills/builtbyecho-research/SKILL.md).

Agents can use that file as their install and usage guide for `@builtbyecho/research`, including `npx`, global npm install, browser setup, and common research commands.

## Optional setup

No API key is required. Everything runs locally.

Optional Scrapling backend for adaptive/stealthier Python fetching:

```bash
python3 -m pip install 'scrapling[fetchers]'
builtbyecho-research fetch https://example.com --backend scrapling
builtbyecho-research fetch https://example.com --backend scrapling-dynamic
builtbyecho-research fetch https://example.com --backend scrapling-stealth
```

If Scrapling lives in a virtualenv, pass `--scrapling-python /path/to/venv/bin/python` or set `SCRAPLING_PYTHON`.

For better search discovery, add a Brave API key:

```bash
cp .env.example .env
# edit .env and set BRAVE_API_KEY=...
```

Without `BRAVE_API_KEY`, search falls back to DuckDuckGo HTML scraping. Fetch, render, crawl, extraction, reports, audits, chunking, and traces all work without it.

## Quick start

### Search and fetch

```bash
builtbyecho-research search "browser automation accessibility snapshots" -n 5
builtbyecho-research fetch https://example.com --max-chars 5000
builtbyecho-research fetch https://example.com --backend scrapling --max-chars 5000
```

### Render a JavaScript-heavy page

```bash
builtbyecho-research render https://example.com
```

The render command returns page text, links, HTML, and a compact ARIA/accessibility snapshot.

### Use a persistent browser profile

Useful for logged-in sites or pages that need cookies:

```bash
builtbyecho-research render https://app.example.com --profile default --headed
```

Profiles are stored under `.profiles/` by default and are gitignored.

### Run a multi-angle research pipeline

```bash
builtbyecho-research pipeline "research agent architecture" \
  --expand \
  --rounds 2 \
  -n 8 \
  --format markdown \
  --trace
```

### Generate a citation-backed report

```bash
builtbyecho-research report "Playwright MCP browser automation best practices" \
  -n 6 \
  --rounds 2 \
  --trace
```

### Run a brief (multi-angle research pass)

```bash
builtbyecho-research brief "AI agent orchestration frameworks" \
  -n 8 \
  --rounds 2 \
  --format markdown \
  --trace
```

### Compare multiple topics side-by-side

```bash
builtbyecho-research compare "LangChain" "LlamaIndex" "CrewAI" \
  --per-query 3 \
  --format report
```

### Extract structured fields from a page

```bash
builtbyecho-research extract https://example.com --schema links,headings
builtbyecho-research extract https://example.com --schema emails,phones,pricing,contact_links,socials
```

### Crawl a site

```bash
builtbyecho-research crawl https://docs.example.com \
  --depth 2 \
  --max-pages 25 \
  --chunk
```

## Commands

| Command | Purpose |
|---|---|
| `search <query>` | Search discovery using Brave API or DuckDuckGo fallback |
| `fetch <url>` | Cheap HTTP fetch + Readability/metadata extraction |
| `render <url>` | Playwright render + HTML/text/links + ARIA snapshot |
| `crawl <url>` | Depth/page-limited BFS crawl with optional chunks |
| `plan <objective>` | Deterministic multi-angle query plan |
| `pipeline <query>` | Search → fetch/render → rank → audit → output |
| `brief <objective>` | Multi-angle, citation-aware research pass (expand + iterative) |
| `report <objective>` | Executive markdown report with findings/caveats/sources |
| `extract <url>` | Local heuristic structured extraction |
| `compare <queries...>` | Multi-query research comparison |
| `cache` | Cache stats/purge/clear |

### Key flags

**Pipeline, brief, report, compare:**

| Flag | Default | Purpose |
|---|---|---|
| `-n, --count` | 5–8 | Number of results to return |
| `--rounds` | 1–2 | Iterative follow-up rounds (more rounds = deeper research) |
| `--expand` | off | Expand query into multiple search angles |
| `--max-queries` | 4–5 | Number of query angles when expanding |
| `--chunk` | off | Include citation-ready chunks in output |
| `--trace` | off | Write trace JSON under `output/traces/` |
| `-f, --format` | json | Output format: `json`, `markdown`, `summary`, `jsonfeed`, `report` |
| `--no-cache` | off | Bypass cache for fresh results |

**Pipeline only:**

| Flag | Default | Purpose |
|---|---|---|
| `--domains <list>` | all | Comma-separated domain allowlist |
| `--exclude-domains <list>` | none | Comma-separated domain blocklist |
| `--domain-cap` | 2 | Max results per host after reranking |
| `--no-diverse` | off | Disable host diversity reranking |
| `--no-auto-render` | off | Disable Playwright escalation for JS-gated/thin pages |
| `--profile <name>` | none | Persistent Playwright browser profile |
| `--profile-dir <dir>` | `.profiles` | Base directory for profiles |

**Crawl:**

| Flag | Default | Purpose |
|---|---|---|
| `--depth` | 1 | Link depth to follow |
| `--max-pages` | 20 | Maximum pages to fetch |
| `--same-domain` | on | Stay on the same domain |
| `--cross-domain` | off | Allow off-domain links |
| `--include <regexes>` | none | Comma-separated URL include patterns |
| `--exclude <regexes>` | none | Comma-separated URL exclude patterns |
| `--chunk` | off | Include citation-ready chunks |
| `--chunk-chars` | 1200 | Chunk size in characters |
| `--overlap-chars` | 150 | Chunk overlap in characters |

**Cache subcommands:**

```bash
builtbyecho-research cache stats     # show cache stats
builtbyecho-research cache purge     # remove expired entries
builtbyecho-research cache clear     # clear everything
```

## Output formats

Use `--format` with `pipeline`, `brief`, or `compare`:

| Format | Description |
|---|---|
| `json` | Full structured output (default) |
| `markdown` / `md` | Source-by-source research report |
| `report` | Executive report with findings and sources |
| `summary` | Compact titles and URLs |
| `jsonfeed` | JSON Feed v1.1 |

Example:

```bash
builtbyecho-research pipeline "open source deep research agents" --expand -n 8 --format report
```

## Research audits

Every pipeline, brief, and report run includes an audit:

```json
{
  "grade": "strong",
  "resultCount": 6,
  "uniqueHosts": 5,
  "highQualitySources": 6,
  "warnings": [],
  "followUpQueries": [
    "... architecture implementation patterns",
    "... limitations failure modes criticism"
  ]
}
```

Grades:

- **`strong`** — enough source diversity and high-quality evidence
- **`needs-review`** — useful but has gaps worth checking
- **`weak`** — not enough evidence; run follow-ups or change query

## Traces

Add `--trace` to save the full run under `output/traces/`:

```bash
builtbyecho-research report "AI browser automation tools" --trace
```

A trace includes:

- Research plan
- Search queries issued
- Fetched URLs
- Source quality scores
- Audit result
- Citations
- Final selected sources

Traces are useful for debugging agents, reproducing results, and explaining where a report came from.

## Browser escalation

The pipeline auto-renders when cheap fetch looks weak:

- "enable JavaScript" / "just a moment" / CAPTCHA-like signals
- Very low visible text
- Script-heavy page with thin text
- Explicit `render: true` in library usage

Disable it for fetch-only behavior:

```bash
builtbyecho-research pipeline "topic" --no-auto-render
```

Use a persistent profile for sites requiring login:

```bash
builtbyecho-research pipeline "topic" --profile default --headed
```

## Structured extraction

`extract` uses local heuristics — no model calls, no API keys:

| Schema field | What it finds |
|---|---|
| `emails` | Email addresses |
| `phones` | Phone numbers |
| `pricing` | Price patterns ($99, €49/mo, etc.) |
| `links` | All links with text and URLs |
| `contact_links` | Links containing "contact", "about", "support", etc. |
| `socials` | Social media profile links |
| `companies` | Company/organization names (from headings, meta) |
| `headings` | Page heading hierarchy (h1–h6) |

Plus arbitrary keyword fields, returned as relevant sentences.

```bash
builtbyecho-research extract https://company.example --schema emails,phones,pricing,contact_links,socials
```

Add `--render` for pages that need Playwright:

```bash
builtbyecho-research extract https://spa.example --schema links --render
```

## Crawling

`crawl` does breadth-first traversal with depth and page limits:

```bash
# Basic crawl
builtbyecho-research crawl https://docs.example.com --depth 2 --max-pages 25

# With citation-ready chunks
builtbyecho-research crawl https://docs.example.com --depth 2 --max-pages 25 --chunk

# Filter URLs with patterns
builtbyecho-research crawl https://blog.example.com --include "/post/,/article/" --exclude "/tag/,/page/"

# Allow cross-domain links
builtbyecho-research crawl https://example.com --cross-domain --depth 2
```

## Library API

```js
import {
  // Core pipeline
  researchPipeline,
  iterativeResearchPipeline,
  comparePipeline,

  // Search & fetch
  searchWeb,
  fetchUrl,

  // Browser rendering
  renderExtract,
  compactAccessibilitySnapshot,

  // Crawling
  crawlSite,

  // Planning & audit
  buildResearchPlan,
  auditResearchRun,

  // Scoring & diversity
  assessSourceQuality,
  diversifyByHost,
  shouldRenderEscalate,

  // Structured extraction
  extractSchema,
  extractSchemaFromUrl,
  parseSchema,

  // Output formatting
  toMarkdown,
  toSummary,
  toJsonFeed,
  toResearchReport,

  // Chunking & citations
  chunkText,
  attachCitationMetadata,
  buildCitationLedger,

  // Tracing
  writeTrace,
} from '@builtbyecho/research';
```

### Quick examples

**Run an iterative pipeline:**

```js
const result = await iterativeResearchPipeline('Playwright MCP best practices', {
  expand: true,
  count: 6,
  rounds: 2,
});

console.log(toResearchReport(result));
```

**Extract structured data from a URL:**

```js
const extracted = await extractSchemaFromUrl('https://example.com', 'links,headings');
console.log(extracted.data);
```

**Fetch and chunk with citations:**

```js
const { text, metadata } = await fetchUrl('https://example.com');
const chunks = chunkText(text, { chunkChars: 1200, overlapChars: 150 });
const cited = attachCitationMetadata(chunks, metadata);
```

**Render a JS-heavy page and get its ARIA tree:**

```js
const { text, links, snapshot } = await renderExtract('https://spa.example.com');
const aria = compactAccessibilitySnapshot(snapshot);
```

## Architecture

```
src/
├── cli.mjs              # Commander CLI — all commands and flags
├── index.mjs            # Public ES module exports
├── search.mjs           # Brave API + DuckDuckGo fallback
├── fetch-url.mjs        # HTTP fetch + Readability + metadata
├── render.mjs           # Playwright render + ARIA snapshots
├── crawl.mjs            # BFS crawl with depth/page limits
├── pipeline.mjs         # Full research pipeline + escalation logic
├── query-plan.mjs       # Deterministic multi-angle query planner
├── source-quality.mjs   # Source scoring + host diversity reranking
├── research-audit.mjs   # Post-run audit (grade, warnings, follow-ups)
├── report.mjs           # Citation-backed markdown report writer
├── schema-extract.mjs   # Local heuristic structured extraction
├── extractors.mjs       # Individual field extractors (email, phone, etc.)
├── chunking.mjs         # Text chunking + citation metadata
├── formatters.mjs       # Markdown, summary, JSON Feed output
├── traces.mjs           # Reproducible JSON trace writer
├── cache.mjs            # In-memory cache with TTL + stats
└── url-utils.mjs        # URL normalization and domain helpers
```

**Data flow:**

1. `search.mjs` discovers URLs via Brave or DuckDuckGo
2. `fetch-url.mjs` does cheap HTTP + Readability extraction
3. `render.mjs` escalates to Playwright when needed
4. `source-quality.mjs` scores and reranks by quality + diversity
5. `research-audit.mjs` grades the run and suggests follow-ups
6. `report.mjs` or `formatters.mjs` writes the final output
7. `traces.mjs` saves the full artifact for reproducibility

## Package contents

The package intentionally includes only what users need:

- `src/` — all source modules
- `examples/` — quickstart examples
- `assets/brand/` — logo assets
- `README.md`
- `LICENSE`
- `.env.example`

It excludes local caches, traces, browser profiles, screenshots, tests, and development output.

## Development

```bash
npm install
npx playwright install chromium
npm test
npm run pack:check
```

Run from source:

```bash
node src/cli.mjs report "open source research agents" -n 6 --rounds 2
```

## CI

GitHub Actions runs:

- `npm ci`
- Playwright Chromium install
- Smoke tests
- `npm pack --dry-run`

## Design principles

- **Built by agents, for agents** — CLI-first, JSON-first, traceable.
- **Cheap first** — static fetch before Playwright.
- **Local-first** — no required paid scraping API.
- **Citation-aware** — sources and chunks carry URLs and timestamps.
- **Auditable** — plans, scores, warnings, follow-ups, and traces are first-class.
- **Composable** — works as a CLI or ES module library.
- **Practical over magical** — deterministic heuristics where they beat opaque model calls.

## Brand

BuiltByEcho tools are meant to feel sharp, local-first, useful, and agent-native.

This is the first public research tool in that line: a small, inspectable harness that does real work and leaves receipts.

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-thing`)
3. Make your changes
4. Run `npm test` and `npm run pack:check`
5. Open a pull request

Bug reports and feature requests welcome at [GitHub Issues](https://github.com/BuiltByEcho/research/issues).

**Feedback & Questions**

- **[Open an issue](https://github.com/BuiltByEcho/research/issues/new)** — bug reports, feature requests, questions
- **[Discussions](https://github.com/BuiltByEcho/research/discussions)** — ideas, Q&A, show & tell
- **[Discord](https://discord.com/invite/clawd)** — community chat

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT © BuiltByEcho