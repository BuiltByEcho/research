/**
 * Pipeline: composable research workflows.
 * Pipelines chain search → fetch → extract → filter → dedupe → output.
 */

import { searchWeb } from './search.mjs';
import { fetchUrl } from './fetch-url.mjs';
import { readabilityExtract, structuralExtract, detectJsGating } from './extractors.mjs';
import { Cache } from './cache.mjs';
import { buildCitationLedger, chunkText, attachCitationMetadata } from './chunking.mjs';
import { hostname, normalizeUrl } from './url-utils.mjs';

const cache = new Cache();

/**
 * Full pipeline: search → fetch → extract → score.
 * Returns ranked results with extracted content and citation ledger.
 */
export async function researchPipeline(query, opts = {}) {
  const count = opts.count ?? 5;
  const maxChars = opts.maxChars ?? 4000;
  const strategies = opts.strategies ?? ['readability', 'structural'];
  const useCache = opts.useCache !== false;
  const domainFilter = opts.domains ? new Set(opts.domains.map(d => d.replace(/^www\./, '').toLowerCase())) : null;
  const excludeDomains = opts.excludeDomains ? new Set(opts.excludeDomains.map(d => d.replace(/^www\./, '').toLowerCase())) : null;

  // 1. Search
  const searchResults = await searchWeb(query, { count: count * 2 }); // over-fetch for filtering

  // 2. Domain filter
  let candidates = searchResults.map(r => ({ ...r, url: normalizeUrl(r.url) || r.url })).filter(r => r.url);
  if (domainFilter) candidates = candidates.filter(r => domainFilter.has(hostname(r.url)));
  if (excludeDomains) candidates = candidates.filter(r => !excludeDomains.has(hostname(r.url)));
  candidates = candidates.slice(0, count);

  // 3. Fetch + extract each
  const enriched = [];
  for (const r of candidates) {
    const cacheKey = `pipeline:${r.url}:${strategies.join(',')}:v3`;
    const cached = useCache ? cache.get(cacheKey) : null;
    if (cached) { enriched.push(cached); continue; }

    try {
      const fetched = await fetchUrl(r.url, { previewChars: maxChars, maxChars: 100_000, includeHtml: true });
      const html = fetched.html ?? '';
      const jsGate = detectJsGating(html, fetched.textPreview || '');

      const extractions = {};
      for (const strat of strategies) {
        if (strat === 'readability' && html) extractions.readability = readabilityExtract(html, fetched.finalUrl || r.url);
        if (strat === 'structural' && html) extractions.structural = structuralExtract(html, fetched.finalUrl || r.url);
      }

      const text = (extractions.readability?.textContent || fetched.markdownish || fetched.textPreview || '').slice(0, maxChars);
      const entry = {
        ...r,
        fetch: {
          finalUrl: fetched.finalUrl,
          retrievedAt: fetched.retrievedAt,
          status: fetched.status,
          contentType: fetched.contentType,
          bytes: fetched.bytes,
          jsGated: jsGate.jsGated || fetched.jsGated,
          jsGatedSignals: jsGate.signals,
        },
        extractions,
        textPreview: text,
        chunks: opts.chunk ? attachCitationMetadata(chunkText(text, {
          chunkChars: opts.chunkChars ?? 1200,
          overlapChars: opts.overlapChars ?? 150,
        }), { url: r.url, finalUrl: fetched.finalUrl, title: r.title || fetched.title, retrievedAt: fetched.retrievedAt }) : undefined,
        score: scoreResult(r, fetched, jsGate, extractions),
      };

      if (useCache) cache.set(cacheKey, entry);
      enriched.push(entry);
    } catch (e) {
      enriched.push({ ...r, error: e.message, score: 0 });
    }
  }

  // 4. Sort by score
  enriched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // 5. Dedupe by URL
  const seen = new Set();
  const deduped = enriched.filter(r => {
    const key = normalizeUrl(r.url) || r.url?.replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { query, count: deduped.length, results: deduped, citations: buildCitationLedger(deduped) };
}

/**
 * Compare pipeline: research a topic across multiple queries.
 * Useful for getting broad coverage.
 */
export async function comparePipeline(queries, opts = {}) {
  const allResults = [];
  for (const q of queries) {
    const res = await researchPipeline(q, { ...opts, count: opts.perQuery ?? 3 });
    allResults.push({ query: q, ...res });
  }
  // Cross-deduplicate
  const seen = new Set();
  const unified = [];
  for (const batch of allResults) {
    for (const r of batch.results) {
      const key = normalizeUrl(r.url) || r.url?.replace(/\/$/, '');
      if (!seen.has(key)) { seen.add(key); unified.push(r); }
    }
  }
  unified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const results = unified.slice(0, opts.maxResults ?? 15);
  return { queries, totalResults: results.length, results, citations: buildCitationLedger(results) };
}

/**
 * Simple scoring heuristic.
 * Higher = more likely to be useful.
 */
function scoreResult(searchResult, fetched, jsGate, extractions = {}) {
  let score = 50; // base
  // Snippet length = relevance signal
  if (searchResult.snippet?.length > 100) score += 10;
  // Content length = depth signal
  if (fetched.bytes > 5000) score += 10;
  if (fetched.bytes > 20000) score += 10;
  // Readability success = article quality signal
  if (extractions.readability?.textContent?.length > 500 || fetched.textPreview?.length > 500) score += 10;
  // Structural metadata indicates a parseable page
  if (extractions.structural?.headings?.length) score += 5;
  // JS gating penalty
  if (jsGate.jsGated || fetched.jsGated) score -= 20;
  // Status bonus
  if (fetched.status === 200) score += 5;
  // HTTPS bonus
  try { if (new URL(fetched.finalUrl || fetched.url).protocol === 'https:') score += 3; } catch {}
  // Non-html penalty (PDFs, binaries aren't great for text research)
  if (fetched.contentType && !fetched.contentType.includes('html') && !fetched.contentType.includes('text')) score -= 15;
  return Math.max(0, Math.min(100, score));
}