/**
 * Output formatters — transform pipeline results into different shapes.
 */

/**
 * Markdown report. Good for saving to memory/research/.
 */
export function toMarkdown(result, opts = {}) {
  const maxPreview = opts.maxPreview ?? 800;
  const lines = [];
  lines.push(`# Research: ${result.query}`);
  lines.push(`Results: ${result.count}`);
  lines.push('');

  for (const r of result.results) {
    lines.push(`## ${r.title || 'Untitled'}`);
    lines.push(`- **URL:** ${r.url}`);
    lines.push(`- **Source:** ${r.source || 'unknown'}`);
    if (r.score != null) lines.push(`- **Score:** ${r.score}/100`);
    if (r.fetch) {
      lines.push(`- **Status:** ${r.fetch.status} | **Type:** ${r.fetch.contentType} | **Bytes:** ${r.fetch.bytes}`);
      if (r.fetch.jsGated) lines.push(`- ⚠️ **JS-gated** (${r.fetch.jsGatedSignals?.join(', ')})`);
    }
    if (r.snippet) lines.push(`- **Snippet:** ${r.snippet}`);
    lines.push('');
    if (r.textPreview) {
      lines.push('> ' + r.textPreview.slice(0, maxPreview).replace(/\n/g, '\n> '));
      if (r.textPreview.length > maxPreview) lines.push('> …');
      lines.push('');
    }
    if (r.extractions?.structural?.headings?.length) {
      lines.push('**Headings:**');
      for (const h of r.extractions.structural.headings.slice(0, 10)) {
        lines.push(`  - ${'#'.repeat(h.level)} ${h.text}`);
      }
      lines.push('');
    }
    if (r.error) lines.push(`❌ Error: ${r.error}`);
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Compact summary — just titles, URLs, and top snippets.
 */
export function toSummary(result) {
  const lines = [result.query, '='.repeat(result.query.length), ''];
  for (const r of result.results) {
    lines.push(`• ${r.title} — ${r.url}`);
    if (r.snippet) lines.push(`  ${r.snippet.slice(0, 200)}`);
    if (r.error) lines.push(`  ❌ ${r.error}`);
  }
  return lines.join('\n');
}

/**
 * JSON feed — clean JSON suitable for downstream tools/agents.
 */
export function toJsonFeed(result) {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: `Research: ${result.query}`,
    items: result.results.map((r, i) => ({
      id: String(i),
      url: r.url,
      title: r.title,
      content_text: r.textPreview?.slice(0, 1000) || r.snippet || '',
      tags: [r.source, r.fetch?.jsGated ? 'js-gated' : 'static'].filter(Boolean),
    })),
  };
}