import assert from 'node:assert/strict';
import { fetchUrl } from '../src/fetch-url.mjs';
import { readabilityExtract, structuralExtract, detectJsGating } from '../src/extractors.mjs';
import { Cache } from '../src/cache.mjs';
import { toMarkdown, toSummary } from '../src/formatters.mjs';
import { chunkText, attachCitationMetadata, buildCitationLedger } from '../src/chunking.mjs';
import { normalizeUrl, hostname, isProbablyHtmlUrl } from '../src/url-utils.mjs';
import { crawlSite } from '../src/crawl.mjs';
import { buildResearchPlan } from '../src/query-plan.mjs';
import { assessSourceQuality, diversifyByHost } from '../src/source-quality.mjs';
import { shouldRenderEscalate } from '../src/pipeline.mjs';
import { auditResearchRun } from '../src/research-audit.mjs';
import { extractSchema } from '../src/schema-extract.mjs';
import { toResearchReport } from '../src/report.mjs';

// fetchUrl
const res = await fetchUrl('https://example.com');
assert.equal(res.ok, true);
assert.match(res.title || '', /Example Domain/);
assert.ok(res.links.some(l => l.href.includes('iana.org')));
console.log('✓ fetchUrl basic + links');

// extractors
const html = '<html><head><title>Test</title><meta name="description" content="A test page"></head><body><h1>Hello</h1><p>World</p><a href="https://example.com">Link</a></body></html>';
const read = readabilityExtract(html, 'https://example.com');
assert.equal(read.strategy, 'readability');
assert.ok(read.textContent);
console.log('✓ readabilityExtract');

const struct = structuralExtract(html, 'https://example.com');
assert.equal(struct.strategy, 'structural');
assert.equal(struct.headings.length, 1);
assert.equal(struct.links.length, 1);
assert.ok(struct.meta.description);
console.log('✓ structuralExtract');

const gate = detectJsGating('', 'enable javascript to continue');
assert.equal(gate.jsGated, true);
assert.ok(gate.signals.includes('enable-javascript'));
assert.equal(shouldRenderEscalate({ textPreview: 'tiny', html: '<script></script><script></script><script></script><script></script>' }, gate), true);
assert.equal(shouldRenderEscalate({ textPreview: 'x'.repeat(5000), html: '' }, { jsGated: false }), false);
assert.equal(shouldRenderEscalate({ textPreview: 'tiny', html: '' }, gate, { autoRender: false }), false);
console.log('✓ detectJsGating + render escalation decision');

// cache
const c = new Cache({ dir: '/tmp/test-wrh-cache', ttlMs: 5000 });
c.set('test', { hello: 'world' });
assert.deepEqual(c.get('test'), { hello: 'world' });
c.invalidate('test');
assert.equal(c.get('test'), null);
console.log('✓ Cache get/set/invalidate');

// url utils
assert.equal(hostname('https://www.Example.com/a?utm_source=x#b'), 'example.com');
assert.equal(normalizeUrl('/x/?utm_source=x&a=1#frag', 'https://example.com/base'), 'https://example.com/x?a=1');
assert.equal(isProbablyHtmlUrl('https://example.com/a.pdf'), false);
assert.equal(isProbablyHtmlUrl('https://example.com/docs'), true);
console.log('✓ url-utils');

// chunking
const chunks = chunkText('Sentence one. Sentence two. Sentence three.', { chunkChars: 20, overlapChars: 3 });
assert.ok(chunks.length >= 2);
const cited = attachCitationMetadata(chunks, { url: 'https://example.com', title: 'Example' });
assert.ok(cited[0].source.chunkId.includes('#chunk-0'));
const ledger = buildCitationLedger([{ title: 'Example', url: 'https://example.com', fetch: { status: 200, retrievedAt: 'now' }, score: 80 }]);
assert.equal(ledger[0].status, 200);
console.log('✓ chunking + citations');

// planning + source quality
const plan = buildResearchPlan('web research harnesses', { maxQueries: 3 });
assert.equal(plan.queries.length, 3);
assert.ok(plan.queries[0].query.includes('web research harnesses'));
const quality = assessSourceQuality({ url: 'https://www.nasa.gov/test' }, { ok: true, status: 200, markdownish: 'x'.repeat(2000), title: 'NASA' });
assert.ok(quality.score > 70);
const diverse = diversifyByHost([
  { url: 'https://a.com/1', score: 99 }, { url: 'https://a.com/2', score: 98 }, { url: 'https://a.com/3', score: 97 }, { url: 'https://b.com/1', score: 80 },
], { domainCap: 1, maxResults: 2 });
assert.deepEqual(diverse.map(r => r.url), ['https://a.com/1', 'https://b.com/1']);
const audit = auditResearchRun({ query: 'test', plan, results: [{ url: 'https://a.com', angle: 'overview', sourceQuality: { score: 80 } }] });
assert.equal(audit.grade, 'needs-review');
assert.ok(audit.followUpQueries.length > 0);
console.log('✓ planning + source quality + audit');

// schema extraction
const schema = extractSchema('Call ACME Labs LLC at (555) 123-4567 or sales@example.com. Plans start at $49/mo.', [], 'emails,phones,pricing,companies');
assert.deepEqual(schema.data.emails, ['sales@example.com']);
assert.ok(schema.data.phones.length);
assert.ok(schema.data.pricing.includes('$49/mo'));
assert.ok(schema.data.companies.includes('ACME Labs LLC'));
console.log('✓ schema extraction');

// crawler
const crawl = await crawlSite('https://example.com', { depth: 0, maxPages: 1, useCache: false, chunk: true });
assert.equal(crawl.pagesFetched, 1);
assert.ok(crawl.pages[0].chunks.length >= 1);
console.log('✓ crawlSite depth-0');

// formatters
const mockResult = { query: 'test', count: 1, results: [{ title: 'T', url: 'https://example.com', source: 'brave', snippet: 'S', score: 80, fetch: { status: 200, contentType: 'text/html', bytes: 1234, jsGated: false }, textPreview: 'Preview text' }] };
const md = toMarkdown(mockResult);
assert.ok(md.includes('# Research: test'));
assert.ok(md.includes('Score'));
console.log('✓ toMarkdown');

const report = toResearchReport(mockResult);
assert.ok(report.includes('Executive summary'));
assert.ok(report.includes('Sources'));
console.log('✓ toResearchReport');

const summary = toSummary(mockResult);
assert.ok(summary.includes('example.com'));
console.log('✓ toSummary');

console.log('\n✅ All smoke tests passed');