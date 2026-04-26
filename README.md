# BuiltByEcho Research

<p align="center">
  <img src="assets/brand/builtbyecho-logo-256.png" alt="BuiltByEcho logo" width="128" height="128">
</p>

> Local-first web research for agents: plan, search, fetch, render, rank, audit, trace, and report.

[![CI](https://github.com/BuiltByEcho/research/actions/workflows/ci.yml/badge.svg)](https://github.com/BuiltByEcho/research/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-0ea5e9.svg)](package.json)

**BuiltByEcho Research** is a practical research harness for agents and developers who need reliable source discovery, citation-backed reports, and browser-aware extraction without depending on paid scraping APIs.

It starts cheap with normal HTTP fetches, escalates to Playwright only when a page needs rendering, scores source quality, audits evidence coverage, and saves traceable JSON artifacts so every research run can be inspected later.

```text
plan → search → fetch → maybe render → extract → score → diversify → audit → follow up → report/trace
```

## Why this exists

Most “research agents” fail in boring ways: one search query, shallow snippets, no source quality checks, no audit trail, no repeatability, and no clear path when evidence is weak.

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

**Version:** `0.5.0`

Good for:

- landscape research
- technical/source discovery
- competitive scans
- citation-backed first drafts
- browser-rendered extraction
- structured page extraction
- agent pipelines that need JSON outputs

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

Once published to npm:

```bash
npm install -g @builtbyecho/research
builtbyecho-research --help
```

## Optional setup

No API key is required.

For better search discovery, add a Brave API key:

```bash
cp .env.example .env
# edit .env and set BRAVE_API_KEY=...
```

Without `BRAVE_API_KEY`, search falls back to DuckDuckGo HTML scraping. Fetch, render, crawl, extraction, reports, audits, chunking, and traces all run locally.

## Quick start

### Search and fetch

```bash
builtbyecho-research search "browser automation accessibility snapshots" -n 5
builtbyecho-research fetch https://example.com --max-chars 5000
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

### Generate a report

```bash
builtbyecho-research report "Playwright MCP browser automation best practices" \
  -n 6 \
  --rounds 2 \
  --trace
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
| `brief <objective>` | Multi-angle citation-aware research pass |
| `report <objective>` | Executive markdown report with findings/caveats/sources |
| `extract <url>` | Local heuristic structured extraction |
| `compare <queries...>` | Multi-query research comparison |
| `cache` | Cache stats/purge/clear |

## Output formats

Use `--format` with `pipeline`, `brief`, or `compare`:

- `json` — full structured output
- `markdown` / `md` — source-by-source research report
- `report` — executive report with findings and sources
- `summary` — compact titles and URLs
- `jsonfeed` — JSON Feed v1.1

Example:

```bash
builtbyecho-research pipeline "open source deep research agents" --expand -n 8 --format report
```

## Research audits

Every pipeline/report run includes an audit:

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

- `strong` — enough source diversity and high-quality evidence
- `needs-review` — useful but has gaps worth checking
- `weak` — not enough evidence; run follow-ups or change query

## Traces

Add `--trace` to save the full run under `output/traces/`:

```bash
builtbyecho-research report "AI browser automation tools" --trace
```

A trace includes:

- research plan
- search queries
- fetched URLs
- source quality scores
- audit result
- citations
- final selected sources

This is useful for debugging agents, reproducing results, and explaining where a report came from.

## Browser escalation

The pipeline auto-renders when cheap fetch looks weak:

- “enable JavaScript” / “just a moment” / CAPTCHA-like signals
- very low visible text
- script-heavy page with thin text
- explicit `render: true` in library usage

Disable it when you want fetch-only behavior:

```bash
builtbyecho-research pipeline "topic" --no-auto-render
```

## Structured extraction schemas

`extract` currently supports practical local heuristics:

- `emails`
- `phones`
- `pricing`
- `links`
- `contact_links`
- `socials`
- `companies`
- `headings`
- arbitrary keyword fields, returned as relevant sentences

Example:

```bash
builtbyecho-research extract https://company.example --schema emails,phones,pricing,contact_links,socials
```

## Library API

```js
import {
  researchPipeline,
  iterativeResearchPipeline,
  toResearchReport,
  extractSchemaFromUrl,
} from '@builtbyecho/research';

const result = await iterativeResearchPipeline('Playwright MCP best practices', {
  expand: true,
  count: 6,
  rounds: 2,
});

console.log(toResearchReport(result));

const extracted = await extractSchemaFromUrl('https://example.com', 'links,headings');
console.log(extracted.data);
```

## Package contents

The package intentionally includes only what users need:

- `src/`
- `examples/`
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
- smoke tests
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

## License

MIT © BuiltByEcho
