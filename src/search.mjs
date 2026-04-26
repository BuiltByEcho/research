export async function searchWeb(query, opts = {}) {
  if (process.env.BRAVE_API_KEY) return braveSearch(query, opts);
  return duckDuckGoSearch(query, opts);
}

async function braveSearch(query, opts = {}) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(opts.count ?? 10));
  const res = await fetch(url, { headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Brave search failed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description, source: 'brave' }));
}

async function duckDuckGoSearch(query, opts = {}) {
  const url = new URL('https://duckduckgo.com/html/');
  url.searchParams.set('q', query);
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 web-research-harness/0.1' } });
  if (!res.ok) throw new Error(`DuckDuckGo search failed ${res.status}`);
  const html = await res.text();
  const results = [];
  const re = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.*?)<\/a>/gms;
  for (const match of html.matchAll(re)) {
    const rawUrl = decodeHtml(match[1]);
    const title = stripTags(decodeHtml(match[2]));
    const u = new URL(rawUrl, 'https://duckduckgo.com');
    const target = u.searchParams.get('uddg') || rawUrl;
    results.push({ title, url: target, snippet: '', source: 'duckduckgo-html' });
    if (results.length >= (opts.count ?? 10)) break;
  }
  return results;
}

function stripTags(s) { return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
function decodeHtml(s) { return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
