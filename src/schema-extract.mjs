import { fetchUrl } from './fetch-url.mjs';
import { renderExtract } from './render.mjs';

export async function extractSchemaFromUrl(url, schemaSpec, opts = {}) {
  const fetched = opts.render ? await renderExtract(url, { ...opts, html: true }) : await fetchUrl(url, { includeHtml: true, maxChars: opts.maxChars ?? 100000 });
  const text = fetched.text || fetched.markdownish || fetched.textPreview || '';
  const links = fetched.links || [];
  return extractSchema(text, links, schemaSpec, { url: fetched.finalUrl || fetched.url || url, title: fetched.title });
}

export function extractSchema(text, links = [], schemaSpec = '', meta = {}) {
  const fields = parseSchema(schemaSpec);
  const out = { url: meta.url, title: meta.title, schema: fields, data: {}, evidence: {} };
  for (const field of fields) {
    const value = extractField(field, text, links);
    out.data[field] = value.value;
    out.evidence[field] = value.evidence;
  }
  return out;
}

export function parseSchema(schemaSpec = '') {
  if (Array.isArray(schemaSpec)) return schemaSpec.map(s => String(s).trim()).filter(Boolean);
  return String(schemaSpec).split(',').map(s => s.trim()).filter(Boolean);
}

function extractField(field, text, links) {
  const f = field.toLowerCase();
  if (['email', 'emails'].includes(f)) return list([...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => m[0]), 'regex:email');
  if (['phone', 'phones'].includes(f)) return list([...text.matchAll(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g)].map(m => m[0]), 'regex:phone');
  if (['price', 'prices', 'pricing'].includes(f)) return list([...text.matchAll(/\$\s?\d[\d,]*(?:\.\d{2})?(?:\s?\/?\s?(?:mo|month|yr|year|unit|user))?/gi)].map(m => m[0]), 'regex:price');
  if (['links', 'urls'].includes(f)) return list(links.map(l => l.href).filter(Boolean), 'page-links');
  if (['contact_links', 'contact'].includes(f)) return list(links.filter(l => /contact|about|support|sales|get in touch/i.test(`${l.text} ${l.href}`)).map(l => l.href), 'link-text/contact');
  if (['social', 'socials'].includes(f)) return list(links.filter(l => /twitter|x\.com|linkedin|facebook|instagram|youtube|tiktok/i.test(l.href)).map(l => l.href), 'link-url/social');
  if (['company', 'companies'].includes(f)) return list(extractLikelyCompanies(text), 'heuristic:capitalized-phrases');
  if (['headlines', 'headings'].includes(f)) return list([...text.matchAll(/(?:^|\n)\s*([A-Z][^\n]{8,120})/g)].map(m => m[1]).slice(0, 20), 'line-headings');
  return { value: bestSentencesFor(field, text), evidence: `keyword:${field}` };
}

function list(values, evidence) {
  return { value: [...new Set(values.map(v => String(v).trim()).filter(Boolean))].slice(0, 50), evidence };
}

function extractLikelyCompanies(text) {
  const matches = [...text.matchAll(/\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}\s+(?:Inc|LLC|Ltd|Labs|AI|Technologies|Systems|Software|Group|Corp|Corporation|Company))\b/g)]
    .map(m => m[1].replace(/^(Call|Email|Contact|Visit|The)\s+/, ''));
  return matches.slice(0, 50);
}

function bestSentencesFor(field, text) {
  const terms = field.toLowerCase().split(/[\s_-]+/).filter(Boolean);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 20 && s.length < 400);
  return sentences
    .map(s => ({ s, score: terms.reduce((n, t) => n + (s.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.s);
}
