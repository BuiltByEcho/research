import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { normalizeUrl } from './url-utils.mjs';

export async function fetchUrl(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': opts.userAgent ?? 'Mozilla/5.0 web-research-harness/0.2',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    const retrievedAt = new Date().toISOString();
    const result = {
      url,
      finalUrl: res.url,
      retrievedAt,
      status: res.status,
      ok: res.ok,
      contentType,
      bytes: Buffer.byteLength(text),
      title: null,
      metaDescription: null,
      textPreview: '',
      markdownish: '',
      headings: [],
      links: [],
      jsGated: false,
      jsGatedReason: null,
    };

    if (contentType.includes('html') || text.trim().startsWith('<')) {
      if (opts.includeHtml) result.html = text;
      const dom = new JSDOM(text, { url: res.url });
      const doc = dom.window.document;
      result.title = doc.querySelector('title')?.textContent?.trim() || null;
      result.metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
      result.headings = Array.from(doc.querySelectorAll('h1,h2,h3'))
        .map(h => ({ level: Number(h.tagName[1]), text: h.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) }))
        .filter(h => h.text)
        .slice(0, opts.maxLinks ?? 100);
      result.links = Array.from(doc.querySelectorAll('a[href]'))
        .map(a => ({ text: a.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120), href: normalizeUrl(a.getAttribute('href'), res.url) }))
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
  } finally {
    clearTimeout(timer);
  }
}