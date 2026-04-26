import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function fetchUrl(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': opts.userAgent ?? 'Mozilla/5.0 web-research-harness/0.1',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    const result = {
      url,
      finalUrl: res.url,
      status: res.status,
      ok: res.ok,
      contentType,
      bytes: Buffer.byteLength(text),
      title: null,
      metaDescription: null,
      textPreview: '',
      markdownish: '',
      jsGated: false,
      jsGatedReason: null,
    };

    if (contentType.includes('html') || text.trim().startsWith('<')) {
      const dom = new JSDOM(text, { url: res.url });
      const doc = dom.window.document;
      result.title = doc.querySelector('title')?.textContent?.trim() || null;
      result.metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
      doc.querySelectorAll('script,style,noscript,svg').forEach((n) => n.remove());
      const bodyText = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
      result.textPreview = bodyText.slice(0, opts.previewChars ?? 2000);
      const article = new Readability(doc).parse();
      result.markdownish = (article?.textContent || bodyText).replace(/\s+/g, ' ').trim().slice(0, opts.maxChars ?? 20000);
      const lower = bodyText.toLowerCase();
      if (bodyText.length < 300 && /enable javascript|checking your browser|just a moment|captcha|cloudflare|please wait/.test(lower)) {
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
