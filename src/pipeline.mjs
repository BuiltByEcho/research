/**
 * Pipeline: composable research workflows.
 * Pipelines chain search → fetch → extract → filter → dedupe → output.
 */

import { searchWeb } from './search.mjs';
import { fetchUrl } from './fetch-url.mjs';
import { renderExtract } from './render.mjs';
import { readabilityExtract, structuralExtract, detectJsGating } from './extractors.mjs';
import { Cache } from './cache.mjs';
import { buildCitationLedger, chunkText, attachCitationMetadata } from './chunking.mjs';
import { buildResearchPlan } from './query-plan.mjs';
import { assessSourceQuality, diversifyByHost } from './source-quality.mjs';
import { auditResearchRun } from './research-audit.mjs';
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

  // 1. Search. Optional expansion mirrors successful deep-research systems:
  // plan first, search multiple angles, then dedupe/rerank.
  const plan = opts.expand ? buildResearchPlan(query, { maxQueries: opts.maxQueries ?? 4 }) : null;
  const querySpecs = plan?.queries?.length ? plan.queries : [{ angle: 'direct', query }];
  const searchResults = [];
  for (const spec of querySpecs) {
    const batch = await searchWeb(spec.query, { count: Math.max(count, opts.perQuery ?? count) });
    searchResults.push(...batch.map(r => ({ ...r, searchQuery: spec.query, angle: spec.angle })));
  }

  // 2. Domain filter
  let candidates = searchResults.map(r => ({ ...r, url: normalizeUrl(r.url) || r.url })).filter(r => r.url);
  if (domainFilter) candidates = candidates.filter(r => domainFilter.has(hostname(r.url)));
  if (excludeDomains) candidates = candidates.filter(r => !excludeDomains.has(hostname(r.url)));
  candidates = dedupeByUrl(candidates);
  candidates = candidates.slice(0, opts.candidateCount ?? count * 3);

  // 3. Fetch + extract each
  const enriched = [];
  for (const r of candidates) {
    const cacheKey = `pipeline:${r.url}:${strategies.join(',')}:v5`;
    const cached = useCache ? cache.get(cacheKey) : null;
    if (cached) { enriched.push(cached); continue; }

    try {
      let fetched = await fetchUrl(r.url, { previewChars: maxChars, maxChars: 100_000, includeHtml: true });
      let html = fetched.html ?? '';
      let jsGate = detectJsGating(html, fetched.textPreview || '');
      let rendered = null;
      if (shouldRenderEscalate(fetched, jsGate, opts)) {
        rendered = await renderExtract(r.url, {
          timeoutMs: opts.renderTimeoutMs ?? 25000,
          headless: opts.headless ?? true,
          profile: opts.profile,
          profileBaseDir: opts.profileBaseDir,
          snapshot: opts.snapshot !== false,
          settleMs: opts.settleMs ?? 750,
        });
        html = rendered.html ?? html;
        fetched = {
          ...fetched,
          finalUrl: rendered.url || fetched.finalUrl,
          title: rendered.title || fetched.title,
          textPreview: (rendered.text || fetched.textPreview || '').slice(0, maxChars),
          markdownish: rendered.text || fetched.markdownish,
          html,
          bytes: Math.max(fetched.bytes || 0, Buffer.byteLength(html || rendered.text || '')),
          rendered: true,
        };
        jsGate = detectJsGating(html, fetched.textPreview || '');
      }

      const extractions = {};
      for (const strat of strategies) {
        if (strat === 'readability' && html) extractions.readability = readabilityExtract(html, fetched.finalUrl || r.url);
        if (strat === 'structural' && html) extractions.structural = structuralExtract(html, fetched.finalUrl || r.url);
      }

      const text = (extractions.readability?.textContent || fetched.markdownish || fetched.textPreview || '').slice(0, maxChars);
      const sourceQuality = assessSourceQuality(r, fetched);
      const entry = {
        ...r,
        fetch: {
          finalUrl: fetched.finalUrl,
          retrievedAt: fetched.retrievedAt,
          status: fetched.status,
          contentType: fetched.contentType,
          bytes: fetched.bytes,
          publishedAt: fetched.publishedAt,
          modifiedAt: fetched.modifiedAt,
          jsGated: jsGate.jsGated || fetched.jsGated,
          jsGatedSignals: jsGate.signals,
          rendered: Boolean(rendered),
          renderEngine: rendered?.render?.engine,
        },
        accessibility: rendered?.accessibility,
        sourceQuality,
        extractions,
        textPreview: text,
        chunks: opts.chunk ? attachCitationMetadata(chunkText(text, {
          chunkChars: opts.chunkChars ?? 1200,
          overlapChars: opts.overlapChars ?? 150,
        }), { url: r.url, finalUrl: fetched.finalUrl, title: r.title || fetched.title, retrievedAt: fetched.retrievedAt }) : undefined,
        score: scoreResult(r, fetched, jsGate, extractions, sourceQuality),
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
  const diversified = opts.diverse === false ? deduped.slice(0, count) : diversifyByHost(deduped, { domainCap: opts.domainCap ?? 2, maxResults: count });

  const output = { query, plan, count: diversified.length, results: diversified, citations: buildCitationLedger(diversified) };
  output.audit = auditResearchRun(output, opts.audit ?? {});
  return output;
}

export async function iterativeResearchPipeline(query, opts = {}) {
  const maxRounds = opts.rounds ?? 2;
  let current = await researchPipeline(query, { ...opts, expand: opts.expand ?? true });
  const rounds = [{ round: 1, query, audit: current.audit, resultCount: current.results.length }];
  const seen = new Set(current.results.map(r => normalizeUrl(r.url) || r.url));

  for (let round = 2; round <= maxRounds; round++) {
    const followUps = current.audit?.followUpQueries?.slice(0, opts.followUpsPerRound ?? 3) ?? [];
    if (!followUps.length || current.audit?.grade === 'strong') break;
    const batches = [];
    for (const q of followUps) batches.push(await researchPipeline(q, { ...opts, expand: false, count: opts.perFollowUp ?? 3 }));
    for (const batch of batches) {
      for (const r of batch.results) {
        const key = normalizeUrl(r.url) || r.url;
        if (key && !seen.has(key)) { seen.add(key); current.results.push(r); }
      }
    }
    current.results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    current.results = opts.diverse === false ? current.results.slice(0, opts.count ?? 8) : diversifyByHost(current.results, { domainCap: opts.domainCap ?? 2, maxResults: opts.count ?? 8 });
    current.count = current.results.length;
    current.citations = buildCitationLedger(current.results);
    current.audit = auditResearchRun(current, opts.audit ?? {});
    rounds.push({ round, followUps, audit: current.audit, resultCount: current.results.length });
  }
  current.rounds = rounds;
  return current;
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
  const output = { queries, totalResults: results.length, results, citations: buildCitationLedger(results) };
  output.audit = auditResearchRun({ query: queries.join(' vs '), results }, opts.audit ?? {});
  return output;
}

/**
 * Simple scoring heuristic.
 * Higher = more likely to be useful.
 */
export function shouldRenderEscalate(fetched, jsGate, opts = {}) {
  if (opts.autoRender === false) return false;
  if (opts.render === true) return true;
  const textLen = (fetched.textPreview || fetched.markdownish || '').length;
  const html = fetched.html || '';
  const scriptCount = (html.match(/<script[\s>]/gi) || []).length;
  return Boolean(jsGate.jsGated || fetched.jsGated || textLen < (opts.minTextChars ?? 700) || (textLen < 1600 && scriptCount > 12));
}

function scoreResult(searchResult, fetched, jsGate, extractions = {}, sourceQuality = null) {
  let score = 45; // base
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
  // Blend in credibility/freshness so citation-worthy sources rise.
  if (sourceQuality?.score != null) score = (score * 0.72) + (sourceQuality.score * 0.28);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function dedupeByUrl(results) {
  const seen = new Set();
  return results.filter(r => {
    const key = normalizeUrl(r.url) || r.url?.replace(/\/$/, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}