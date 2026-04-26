/**
 * Content extraction strategies.
 * Each strategy takes HTML + URL and returns structured extract data.
 * Ordered from cheap to expensive; pipeline tries them in sequence.
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Cheap: Readability article extraction from static HTML.
 * Good for blogs, news, documentation. Fails on JS-gated pages.
 */
export function readabilityExtract(html, url) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  doc.querySelectorAll('script,style,noscript,svg').forEach(n => n.remove());
  const article = new Readability(doc).parse();
  if (!article) return null;
  return {
    strategy: 'readability',
    title: article.title || null,
    byline: article.byline || null,
    excerpt: article.excerpt || null,
    textContent: article.textContent?.replace(/\s+/g, ' ').trim() || null,
    siteName: article.siteName || null,
  };
}

/**
 * Structural: extract headings, links, images, and key metadata.
 * Works on any HTML, JS-gated or not (if you already have the rendered HTML).
 */
export function structuralExtract(html, url) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const headings = Array.from(doc.querySelectorAll('h1,h2,h3'))
    .map(h => ({ level: parseInt(h.tagName[1]), text: h.textContent?.trim().slice(0, 200) }))
    .filter(h => h.text);
  const links = Array.from(doc.querySelectorAll('a[href]'))
    .slice(0, 150)
    .map(a => ({ text: a.textContent?.trim().slice(0, 120), href: a.href }))
    .filter(l => l.text && l.href && !l.href.startsWith('javascript:'));
  const images = Array.from(doc.querySelectorAll('img[src]'))
    .slice(0, 50)
    .map(i => ({ alt: i.alt?.trim().slice(0, 120), src: i.src, width: i.width || null }));
  const meta = {
    description: doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null,
    ogTitle: doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || null,
    ogImage: doc.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || null,
    ogType: doc.querySelector('meta[property="og:type"]')?.getAttribute('content')?.trim() || null,
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || null,
    published: doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')?.trim()
      || doc.querySelector('time[datetime]')?.getAttribute('datetime')?.trim() || null,
    lang: doc.documentElement.lang || null,
  };
  return {
    strategy: 'structural',
    title: doc.title?.trim() || null,
    headings,
    links,
    images,
    meta,
  };
}

/**
 * Detect JS gating signals from raw HTML.
 */
export function detectJsGating(html, bodyText) {
  const lower = (bodyText || '').toLowerCase();
  const signals = [];
  if (/enable\s*javascript/i.test(lower)) signals.push('enable-javascript');
  if (/checking\s*your\s*browser/i.test(lower)) signals.push('browser-check');
  if (/just\s*a\s*moment/i.test(lower)) signals.push('just-a-moment');
  if (/captcha/i.test(lower)) signals.push('captcha');
  if (/cloudflare/i.test(lower)) signals.push('cloudflare');
  if (/please\s*wait/i.test(lower)) signals.push('please-wait');
  if (/access\s*denied/i.test(lower)) signals.push('access-denied');
  // Low visible text with heavy script content
  const scriptBytes = (html.match(/<script[\s>]/gi) || []).length;
  if (bodyText.length < 300 && scriptBytes > 3) signals.push('low-text-high-scripts');
  return {
    jsGated: signals.length > 0,
    signals,
  };
}