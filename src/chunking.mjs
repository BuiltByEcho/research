export function chunkText(text, opts = {}) {
  const chunkChars = opts.chunkChars ?? 1200;
  const overlapChars = opts.overlapChars ?? 150;
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(cleaned.length, start + chunkChars);
    // Prefer ending on sentence/paragraph-ish boundary.
    if (end < cleaned.length) {
      const boundary = Math.max(cleaned.lastIndexOf('. ', end), cleaned.lastIndexOf('\n', end), cleaned.lastIndexOf(' ', end));
      if (boundary > start + chunkChars * 0.65) end = boundary + 1;
    }
    const content = cleaned.slice(start, end).trim();
    if (content) chunks.push({ index: chunks.length, start, end, content });
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return chunks;
}

export function attachCitationMetadata(chunks, source) {
  const retrievedAt = source.retrievedAt ?? new Date().toISOString();
  return chunks.map((chunk) => ({
    ...chunk,
    source: {
      url: source.url,
      finalUrl: source.finalUrl ?? source.url,
      title: source.title ?? null,
      retrievedAt,
      chunkId: `${source.id ?? source.url}#chunk-${chunk.index}`,
    },
  }));
}

export function buildCitationLedger(results) {
  const ledger = [];
  for (const r of results) {
    ledger.push({
      title: r.title ?? null,
      url: r.url,
      finalUrl: r.fetch?.finalUrl ?? r.url,
      retrievedAt: r.fetch?.retrievedAt ?? null,
      score: r.score ?? null,
      status: r.fetch?.status ?? null,
      source: r.source ?? null,
    });
  }
  return ledger;
}