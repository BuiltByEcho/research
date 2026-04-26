import { toMarkdown } from './formatters.mjs';

export function toResearchReport(result, opts = {}) {
  const lines = [];
  const title = opts.title || result.query || result.queries?.join(' vs ') || 'Research report';
  lines.push(`# ${title}`);
  lines.push('');
  if (result.audit) {
    lines.push(`**Audit:** ${result.audit.grade} — ${result.audit.highQualitySources} high-quality source(s), ${result.audit.uniqueHosts} unique host(s).`);
    lines.push('');
  }
  lines.push('## Executive summary');
  const top = (result.results || []).slice(0, opts.top ?? 5);
  if (!top.length) lines.push('No usable sources were found.');
  for (const r of top) {
    const claim = firstUsefulSentence(r.textPreview || r.snippet || '') || r.snippet || 'Source retrieved and ranked for relevance.';
    lines.push(`- ${claim} [${r.citationId || top.indexOf(r) + 1}]`);
  }
  lines.push('');
  lines.push('## Findings');
  for (const [i, r] of top.entries()) {
    lines.push(`### ${i + 1}. ${r.title || 'Untitled'}`);
    lines.push(`- Source: ${r.url}`);
    lines.push(`- Score: ${r.score ?? 'n/a'}; quality: ${r.sourceQuality?.score ?? 'n/a'}`);
    if (r.sourceQuality?.signals?.length) lines.push(`- Signals: ${r.sourceQuality.signals.join(', ')}`);
    if (r.textPreview) lines.push(`- Evidence: ${r.textPreview.slice(0, 500).replace(/\s+/g, ' ')}${r.textPreview.length > 500 ? '…' : ''}`);
    lines.push('');
  }
  if (result.audit?.warnings?.length || result.audit?.followUpQueries?.length) {
    lines.push(result.audit?.warnings?.length ? '## Caveats / next checks' : '## Optional next checks');
    for (const w of result.audit.warnings ?? []) lines.push(`- ${w}`);
    for (const q of result.audit.followUpQueries ?? []) lines.push(`- Follow up: ${q}`);
    lines.push('');
  }
  lines.push('## Sources');
  for (const [i, r] of (result.results || []).entries()) lines.push(`${i + 1}. ${r.title || r.url} — ${r.url}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('<details><summary>Full machine report</summary>');
  lines.push('');
  lines.push(toMarkdown(result));
  lines.push('');
  lines.push('</details>');
  return lines.join('\n');
}

function firstUsefulSentence(text) {
  return String(text || '').split(/(?<=[.!?])\s+/).find(s => s.length > 60 && s.length < 280)?.replace(/\s+/g, ' ').trim();
}
