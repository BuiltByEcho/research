import assert from 'node:assert/strict';
import { fetchUrl } from '../src/fetch-url.mjs';
import { readabilityExtract, structuralExtract, detectJsGating } from '../src/extractors.mjs';
import { Cache } from '../src/cache.mjs';
import { toMarkdown, toSummary } from '../src/formatters.mjs';
import { chunkText, attachCitationMetadata, buildCitationLedger } from '../src/chunking.mjs';
import { normalizeUrl, hostname, isProbablyHtmlUrl } from '../src/url-utils.mjs';
import { crawlSite } from '../src/crawl.mjs';

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
console.log('✓ detectJsGating');

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

const summary = toSummary(mockResult);
assert.ok(summary.includes('example.com'));
console.log('✓ toSummary');

console.log('\n✅ All smoke tests passed');