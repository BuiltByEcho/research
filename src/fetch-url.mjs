import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { normalizeUrl } from './url-utils.mjs';
import { fetchWithScrapling } from './scrapling.mjs';

export async function fetchUrl(url, opts = {}) {
  const retries = opts.retries ?? 1;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchUrlOnce(url, { ...opts, attempt });
    } catch (e) {
      lastError = e;
      if (attempt >= retries) break;
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function fetchUrlOnce(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  if (isScraplingBackend(opts.backend)) {
    const scraped = await fetchWithScrapling(url, {
      backend: opts.backend,
      timeoutMs,
      headless: opts.headless,
      waitSelector: opts.waitSelector,
      python: opts.scraplingPython,
    });
    return buildFetchResult({
      url,
      finalUrl: scraped.finalUrl || url,
      status: scraped.status ?? 200,
      ok: (scraped.status ?? 200) >= 200 && (scraped.status ?? 200) < 400,
      contentType: scraped.contentType || headerValue(scraped.headers, 'content-type') || 'text/html',
      text: scraped.html || scraped.text || '',
      headers: scraped.headers || {},
      opts,
      backend: { name: 'scrapling', engine: scraped.engine },
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': opts.userAgent ?? 'Mozilla/5.0 web-research-harness/0.3',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    const retrievedAt = new Date().toISOString();
    return buildFetchResult({ url, finalUrl: res.url, retrievedAt, status: res.status, ok: res.ok, contentType, text, headers: res.headers, opts });
  } finally {
    clearTimeout(timer);
  }
}

function buildFetchResult({ url, finalUrl, retrievedAt = new Date().toISOString(), status, ok, contentType = '', text = '', headers = {}, opts = {}, backend = null }) {
  const result = {
    url,
    finalUrl,
    retrievedAt,
    status,
    ok,
    contentType,
    bytes: Buffer.byteLength(text),
    title: null,
    metaDescription: null,
    publishedAt: null,
    modifiedAt: parseHttpDate(headerValue(headers, 'last-modified')),
    textPreview: '',
    markdownish: '',
    headings: [],
    links: [],
    jsGated: false,
    jsGatedReason: null,
  };
  if (backend) result.backend = backend;

  if (contentType.includes('html') || text.trim().startsWith('<')) {
    if (opts.includeHtml) result.html = text;
    const dom = new JSDOM(text, { url: finalUrl });
    const doc = dom.window.document;
    result.title = doc.querySelector('title')?.textContent?.trim() || null;
    result.metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
    result.publishedAt = firstMetaDate(doc, ['article:published_time', 'og:published_time', 'datePublished', 'pubdate', 'publish_date', 'date']);
    result.modifiedAt = firstMetaDate(doc, ['article:modified_time', 'og:updated_time', 'dateModified', 'lastmod', 'last-modified']) || result.modifiedAt;
    result.headings = Array.from(doc.querySelectorAll('h1,h2,h3'))
      .map(h => ({ level: Number(h.tagName[1]), text: h.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) }))
      .filter(h => h.text)
      .slice(0, opts.maxLinks ?? 100);
    result.links = Array.from(doc.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120), href: normalizeUrl(a.getAttribute('href'), finalUrl) }))
      .filter(l => l.href)
      .slice(0, opts.maxLinks ?? 200);
    doc.querySelectorAll('script,style,noscript,svg').forEach((n) => n.remove());
    const bodyText = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
    result.textPreview = bodyText.slice(0, opts.previewChars ?? 2000);
    const article = new Readability(doc).parse();
    result.markdownish = (article?.textContent || bodyText).replace(/\s+/g, ' ').trim().slice(0, opts.maxChars ?? 20000);
    const lower = bodyText.toLowerCase();
    if (bodyText.length < 300 && /enable javascript|checking your browser|just a moment|captcha|cloudflare|please wait|access denied/.test(lower)) {
      result.jsGated = true;
      result.jsGatedReason = 'low visible text with bot/js/captcha wording';
    }
  } else {
    result.textPreview = text.slice(0, opts.previewChars ?? 2000);
    result.markdownish = text.slice(0, opts.maxChars ?? 20000);
  }
  return result;
}

function isScraplingBackend(value) {
  return typeof value === 'string' && value.startsWith('scrapling');
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const lower = name.toLowerCase();
  return headers[name] ?? headers[lower] ?? Object.entries(headers).find(([k]) => k.toLowerCase() === lower)?.[1] ?? null;
}

function firstMetaDate(doc, names) {
  for (const name of names) {
    const value = doc.querySelector(`meta[property="${cssEscape(name)}"]`)?.getAttribute('content')
      || doc.querySelector(`meta[name="${cssEscape(name)}"]`)?.getAttribute('content')
      || doc.querySelector('time[datetime]')?.getAttribute('datetime');
    const parsed = parseHttpDate(value);
    if (parsed) return parsed;
  }
  return null;
}

function parseHttpDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cssEscape(value) {
  return String(value).replace(/"/g, '\\"');
}
