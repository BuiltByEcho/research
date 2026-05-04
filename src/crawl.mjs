import { fetchUrl } from './fetch-url.mjs';
import { Cache } from './cache.mjs';
import { hostname, isProbablyHtmlUrl, matchesAny, normalizeUrl, sameRegistrableHost } from './url-utils.mjs';
import { chunkText, attachCitationMetadata } from './chunking.mjs';

const cache = new Cache();

/**
 * Small local-first crawler: breadth-first, depth-limited, citation-aware.
 * Inspired by Crawl4AI/Firecrawl/ScrapeGraphAI patterns but intentionally simple.
 */
export async function crawlSite(startUrl, opts = {}) {
  const root = normalizeUrl(startUrl);
  if (!root) throw new Error(`Invalid URL: ${startUrl}`);

  const maxPages = opts.maxPages ?? 20;
  const maxDepth = opts.depth ?? 1;
  const sameDomainOnly = opts.sameDomainOnly !== false;
  const includePatterns = opts.includePatterns ?? [];
  const excludePatterns = opts.excludePatterns ?? [];
  const useCache = opts.useCache !== false;
  const chunk = opts.chunk ?? false;

  const queue = [{ url: root, depth: 0, parent: null }];
  const seen = new Set([root]);
  const pages = [];
  const errors = [];

  while (queue.length && pages.length < maxPages) {
    const item = queue.shift();
    if (!isProbablyHtmlUrl(item.url)) continue;
    if (includePatterns.length && !matchesAny(item.url, includePatterns)) continue;
    if (excludePatterns.length && matchesAny(item.url, excludePatterns)) continue;

    try {
      const cacheKey = `crawl:fetch:${item.url}:${opts.backend || 'native'}`;
      let fetched = useCache ? cache.get(cacheKey) : null;
      if (!fetched) {
        fetched = await fetchUrl(item.url, { maxChars: opts.maxChars ?? 20_000, previewChars: opts.previewChars ?? 800, maxLinks: opts.maxLinks ?? 200, backend: opts.backend, scraplingPython: opts.scraplingPython, headless: opts.headless, waitSelector: opts.waitSelector });
        if (useCache) cache.set(cacheKey, fetched);
      }

      const page = {
        url: item.url,
        finalUrl: fetched.finalUrl,
        parent: item.parent,
        depth: item.depth,
        title: fetched.title,
        status: fetched.status,
        ok: fetched.ok,
        contentType: fetched.contentType,
        bytes: fetched.bytes,
        retrievedAt: fetched.retrievedAt,
        jsGated: fetched.jsGated,
        jsGatedReason: fetched.jsGatedReason,
        backend: fetched.backend,
        headings: fetched.headings,
        textPreview: fetched.markdownish?.slice(0, opts.maxChars ?? 20_000) || fetched.textPreview,
        links: fetched.links,
      };
      if (chunk) {
        page.chunks = attachCitationMetadata(chunkText(page.textPreview, {
          chunkChars: opts.chunkChars ?? 1200,
          overlapChars: opts.overlapChars ?? 150,
        }), { url: page.url, finalUrl: page.finalUrl, title: page.title, retrievedAt: page.retrievedAt });
      }
      pages.push(page);

      if (item.depth < maxDepth) {
        for (const link of fetched.links ?? []) {
          const href = normalizeUrl(link.href, item.url);
          if (!href || seen.has(href) || !isProbablyHtmlUrl(href)) continue;
          if (sameDomainOnly && !sameRegistrableHost(root, href)) continue;
          if (excludePatterns.length && matchesAny(href, excludePatterns)) continue;
          if (includePatterns.length && !matchesAny(href, includePatterns)) continue;
          seen.add(href);
          queue.push({ url: href, depth: item.depth + 1, parent: item.url });
          if (seen.size > maxPages * 20) break; // guard against pathological menus/calendars
        }
      }
    } catch (e) {
      errors.push({ url: item.url, depth: item.depth, error: e.message });
    }
  }

  return {
    startUrl: root,
    host: hostname(root),
    options: { maxPages, depth: maxDepth, sameDomainOnly, chunk },
    pagesFetched: pages.length,
    pages,
    errors,
  };
}
