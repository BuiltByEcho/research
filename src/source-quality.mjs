import { hostname } from './url-utils.mjs';

const HIGH_TRUST_SUFFIXES = ['.gov', '.edu'];
const PRIMARY_HINTS = [
  'github.com', 'docs.', 'developer.', 'developers.', 'openai.com', 'anthropic.com',
  'google.', 'microsoft.com', 'mozilla.org', 'w3.org', 'ietf.org', 'arxiv.org',
  'pmc.ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'research.',
];
const LOW_SIGNAL_HOSTS = ['medium.com', 'substack.com', 'dev.to', 'hashnode.dev'];

export function assessSourceQuality(entry = {}, fetched = {}) {
  const url = entry.url || fetched.finalUrl || fetched.url || '';
  const host = hostname(url);
  const signals = [];
  let score = 50;

  if (fetched.ok || fetched.status === 200) { score += 12; signals.push('accessible'); }
  if (url.startsWith('https://')) { score += 5; signals.push('https'); }
  if (HIGH_TRUST_SUFFIXES.some(s => host.endsWith(s))) { score += 14; signals.push('gov-edu'); }
  if (host.endsWith('.org')) { score += 5; signals.push('org'); }
  if (PRIMARY_HINTS.some(h => host === h || host.includes(h))) { score += 12; signals.push('primary-ish'); }
  if (LOW_SIGNAL_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) { score -= 6; signals.push('blog-platform'); }

  const contentLength = (fetched.markdownish || fetched.textPreview || entry.textPreview || '').length;
  if (contentLength > 1500) { score += 6; signals.push('substantial-text'); }
  if (contentLength > 8000) { score += 4; signals.push('deep-page'); }
  if (fetched.title || entry.title) { score += 3; signals.push('has-title'); }
  if (fetched.metaDescription) { score += 3; signals.push('has-description'); }
  if (fetched.jsGated) { score -= 15; signals.push('js-gated'); }
  if (fetched.status && fetched.status !== 200) { score -= 20; signals.push(`status-${fetched.status}`); }
  if (fetched.contentType && !fetched.contentType.includes('html') && !fetched.contentType.includes('text')) {
    score -= 8;
    signals.push('non-html');
  }

  const freshness = assessFreshness(fetched.publishedAt || fetched.modifiedAt || entry.publishedAt);
  if (freshness.label !== 'unknown') signals.push(`freshness-${freshness.label}`);
  score += freshness.scoreDelta;

  return {
    score: clamp(Math.round(score), 0, 100),
    signals,
    freshness,
    host,
  };
}

export function assessFreshness(dateLike) {
  if (!dateLike) return { label: 'unknown', scoreDelta: 0, date: null };
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return { label: 'unknown', scoreDelta: 0, date: null };
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  if (ageDays < 90) return { label: 'very-fresh', scoreDelta: 8, date: date.toISOString() };
  if (ageDays < 365) return { label: 'fresh', scoreDelta: 5, date: date.toISOString() };
  if (ageDays < 1095) return { label: 'established', scoreDelta: 1, date: date.toISOString() };
  return { label: 'old', scoreDelta: -4, date: date.toISOString() };
}

export function diversifyByHost(results, opts = {}) {
  const domainCap = opts.domainCap ?? 2;
  const maxResults = opts.maxResults ?? results.length;
  const counts = new Map();
  const selected = [];
  const overflow = [];

  for (const r of results) {
    const host = hostname(r.url || r.finalUrl || 'unknown');
    const count = counts.get(host) ?? 0;
    if (count < domainCap) {
      selected.push(r);
      counts.set(host, count + 1);
    } else {
      overflow.push(r);
    }
    if (selected.length >= maxResults) break;
  }

  for (const r of overflow) {
    if (selected.length >= maxResults) break;
    selected.push(r);
  }
  return selected;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
