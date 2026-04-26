export function normalizeUrl(url, base) {
  try {
    const u = new URL(url, base);
    u.hash = '';
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) u.port = '';
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/+$/, '');
    // Drop common tracking params but preserve meaningful query params.
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|igshid$)/i.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

export function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}

export function sameRegistrableHost(a, b) {
  return hostname(a) === hostname(b);
}

export function isProbablyHtmlUrl(url) {
  try {
    const { pathname, protocol } = new URL(url);
    if (!/^https?:$/.test(protocol)) return false;
    return !/\.(pdf|zip|gz|tar|png|jpe?g|gif|webp|svg|mp4|mp3|mov|avi|docx?|xlsx?|pptx?)$/i.test(pathname);
  } catch {
    return false;
  }
}

export function matchesAny(url, patterns = []) {
  return patterns.some((p) => {
    if (!p) return false;
    if (p instanceof RegExp) return p.test(url);
    return new RegExp(String(p)).test(url);
  });
}