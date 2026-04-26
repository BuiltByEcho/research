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
  if (result.plan?.queries?.length) {
    lines.push('');
    lines.push('## Research plan');
    for (const q of result.plan.queries) lines.push(`- **${q.label}:** ${q.query}`);
  }
  if (result.audit) {
    lines.push('');
    lines.push('## Research audit');
    lines.push(`- **Grade:** ${result.audit.grade}`);
    lines.push(`- **Hosts:** ${result.audit.uniqueHosts} | **High-quality sources:** ${result.audit.highQualitySources}`);
    if (result.audit.warnings?.length) {
      lines.push('- **Warnings:**');
      for (const warning of result.audit.warnings) lines.push(`  - ${warning}`);
    }
    if (result.audit.followUpQueries?.length) {
      lines.push('- **Suggested follow-up queries:**');
      for (const q of result.audit.followUpQueries) lines.push(`  - ${q}`);
    }
  }
  lines.push('');

  for (const r of result.results) {
    lines.push(`## ${r.title || 'Untitled'}`);
    lines.push(`- **URL:** ${r.url}`);
    lines.push(`- **Source:** ${r.source || 'unknown'}`);
    if (r.score != null) lines.push(`- **Score:** ${r.score}/100`);
    if (r.sourceQuality) lines.push(`- **Source quality:** ${r.sourceQuality.score}/100 (${r.sourceQuality.signals.join(', ') || 'no signals'})`);
    if (r.searchQuery) lines.push(`- **Search angle:** ${r.angle || 'direct'} — ${r.searchQuery}`);
    if (r.fetch) {
      lines.push(`- **Status:** ${r.fetch.status} | **Type:** ${r.fetch.contentType} | **Bytes:** ${r.fetch.bytes}`);
      if (r.fetch.publishedAt || r.fetch.modifiedAt) lines.push(`- **Date signal:** ${r.fetch.publishedAt || r.fetch.modifiedAt}`);
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