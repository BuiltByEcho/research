# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.2] — 2026-05-03

### Added

- Optional Scrapling backend for fetch, crawl, pipeline, brief, report, and compare commands.
- `--backend scrapling`, `--backend scrapling-dynamic`, and `--backend scrapling-stealth` modes.
- `--scrapling-python` / `SCRAPLING_PYTHON` support for virtualenv-based Scrapling installs.
- Public `fetchWithScrapling()` and `isScraplingAvailable()` library exports.

### Changed

- Fetch/crawl/pipeline cache keys now include backend identity so native and Scrapling results do not collide.

## [0.5.0] — 2026-04-26

### Added

- Full research pipeline: search → fetch/render → score → diversify → audit → report
- `brief` command for multi-angle, citation-aware research passes
- `compare` command for side-by-side multi-query research
- `report` command for executive markdown reports with findings, caveats, and sources
- `crawl` command with depth/page limits, URL filtering, and citation-ready chunking
- `extract` command for local heuristic structured extraction (emails, phones, pricing, links, contact_links, socials, companies, headings)
- `plan` command for deterministic multi-angle query planning
- `render` command with Playwright browser rendering and ARIA/accessibility snapshots
- Persistent browser profiles (`--profile`, `--profile-dir`, `--headed`)
- Browser auto-escalation for JS-gated and thin pages
- Source quality scoring and host diversity reranking
- Research audit with grades (strong/needs-review/weak), warnings, and follow-up queries
- Reproducible JSON traces (`--trace`)
- Output formats: JSON, Markdown, summary, JSON Feed, report
- Citation-ready text chunking with metadata attachment
- Domain allowlist/blocklist filtering on pipeline
- In-memory cache with TTL, stats, purge, and clear
- OpenClaw agent skill at `skills/builtbyecho-rearch/SKILL.md`
- Quickstart example at `examples/quickstart.mjs`
- CI via GitHub Actions (npm ci, Playwright install, smoke tests, pack check)

### Search

- Brave Search API (with `BRAVE_API_KEY`)
- DuckDuckGo HTML scraping fallback (no key required)

[0.5.0]: https://github.com/BuiltByEcho/research/releases/tag/v0.5.0