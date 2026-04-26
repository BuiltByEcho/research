#!/usr/bin/env node
import { Command } from 'commander';
import { fetchUrl } from './fetch-url.mjs';
import { searchWeb } from './search.mjs';
import { renderExtract } from './render.mjs';
import { researchPipeline, comparePipeline } from './pipeline.mjs';
import { crawlSite } from './crawl.mjs';
import { toMarkdown, toSummary, toJsonFeed } from './formatters.mjs';
import { Cache } from './cache.mjs';

const cache = new Cache();

const program = new Command();
program.name('research').description('Local web research harness').version('0.3.0');

program.command('fetch <url>')
  .option('--max-chars <n>', 'max extraction chars', '20000')
  .option('--timeout <ms>', 'fetch timeout ms', '15000')
  .option('--html', 'include raw HTML in JSON output')
  .option('--cache', 'use cache', true)
  .option('--no-cache', 'bypass cache')
  .action(async (url, opts) => {
    if (opts.cache) {
      const cached = cache.get(`fetch:${url}:${opts.html ? 'html' : 'nohtml'}`);
      if (cached) { console.log(JSON.stringify(cached, null, 2)); return; }
    }
    const result = await fetchUrl(url, { maxChars: Number(opts.maxChars), timeoutMs: Number(opts.timeout), includeHtml: opts.html });
    if (opts.cache) cache.set(`fetch:${url}:${opts.html ? 'html' : 'nohtml'}`, result);
    console.log(JSON.stringify(result, null, 2));
  });

program.command('search <query>')
  .option('-n, --count <n>', 'result count', '10')
  .option('--cache', 'use cache', true)
  .option('--no-cache', 'bypass cache')
  .action(async (query, opts) => {
    if (opts.cache) {
      const cached = cache.get(`search:${query}:${opts.count}`);
      if (cached) { console.log(JSON.stringify(cached, null, 2)); return; }
    }
    const result = await searchWeb(query, { count: Number(opts.count) });
    if (opts.cache) cache.set(`search:${query}:${opts.count}`, result);
    console.log(JSON.stringify(result, null, 2));
  });

program.command('render <url>')
  .option('-s, --selector <selector>')
  .option('--screenshot <path>')
  .option('--timeout <ms>', 'render timeout ms', '20000')
  .action(async (url, opts) => {
    const result = await renderExtract(url, { ...opts, timeoutMs: Number(opts.timeout) });
    console.log(JSON.stringify(result, null, 2));
  });

program.command('crawl <url>')
  .description('breadth-first crawl with depth/page limits and citation-ready chunks')
  .option('--depth <n>', 'link depth', '1')
  .option('--max-pages <n>', 'maximum pages', '20')
  .option('--same-domain', 'stay on same domain', true)
  .option('--cross-domain', 'allow off-domain links')
  .option('--include <regexes>', 'comma-separated URL include regexes')
  .option('--exclude <regexes>', 'comma-separated URL exclude regexes')
  .option('--chunk', 'include citation-ready chunks')
  .option('--chunk-chars <n>', 'chunk size', '1200')
  .option('--overlap-chars <n>', 'chunk overlap', '150')
  .option('-f, --format <fmt>', 'output format: json|summary', 'json')
  .option('--no-cache', 'bypass cache')
  .action(async (url, opts) => {
    const result = await crawlSite(url, {
      depth: Number(opts.depth),
      maxPages: Number(opts.maxPages),
      sameDomainOnly: opts.crossDomain ? false : opts.sameDomain,
      includePatterns: opts.include ? opts.include.split(',').map(s => s.trim()).filter(Boolean) : [],
      excludePatterns: opts.exclude ? opts.exclude.split(',').map(s => s.trim()).filter(Boolean) : [],
      chunk: Boolean(opts.chunk),
      chunkChars: Number(opts.chunkChars),
      overlapChars: Number(opts.overlapChars),
      useCache: opts.cache !== false,
    });
    if (opts.format === 'summary') {
      console.log(`${result.startUrl}\nFetched ${result.pagesFetched} pages\n`);
      for (const p of result.pages) console.log(`• [d${p.depth}] ${p.title || '(untitled)'} — ${p.url}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  });

program.command('pipeline <query>')
  .option('-n, --count <n>', 'result count', '5')
  .option('--max-chars <n>', 'preview chars per result', '4000')
  .option('--domains <domains>', 'comma-separated domain allowlist')
  .option('--exclude-domains <domains>', 'comma-separated domain blocklist')
  .option('--chunk', 'include citation-ready chunks')
  .option('-f, --format <fmt>', 'output format: json|markdown|summary|jsonfeed', 'json')
  .option('--no-cache', 'bypass cache')
  .action(async (query, opts) => {
    const pipelineOpts = {
      count: Number(opts.count),
      maxChars: Number(opts.maxChars),
      useCache: opts.cache !== false,
      chunk: Boolean(opts.chunk),
    };
    if (opts.domains) pipelineOpts.domains = opts.domains.split(',').map(d => d.trim());
    if (opts.excludeDomains) pipelineOpts.excludeDomains = opts.excludeDomains.split(',').map(d => d.trim());
    const result = await researchPipeline(query, pipelineOpts);
    output(result, opts.format, query);
  });

program.command('compare <queries...>')
  .option('--per-query <n>', 'results per query', '3')
  .option('--max-results <n>', 'total max results', '15')
  .option('--chunk', 'include citation-ready chunks')
  .option('-f, --format <fmt>', 'output format: json|markdown|summary|jsonfeed', 'json')
  .option('--no-cache', 'bypass cache')
  .action(async (queries, opts) => {
    const result = await comparePipeline(queries, {
      perQuery: Number(opts.perQuery),
      maxResults: Number(opts.maxResults),
      useCache: opts.cache !== false,
      chunk: Boolean(opts.chunk),
    });
    output(result, opts.format, queries.join(' vs '));
  });

program.command('cache')
  .description('cache management')
  .addCommand(
    new Command('stats').action(() => console.log(JSON.stringify(cache.stats(), null, 2)))
  )
  .addCommand(
    new Command('purge').action(() => console.log(`Purged ${cache.purge()} expired entries`))
  )
  .addCommand(
    new Command('clear').action(() => { cache.purge(); console.log('Cache cleared'); })
  );

function output(result, format, label) {
  switch (format) {
    case 'markdown': case 'md':
      console.log(toMarkdown(result));
      break;
    case 'summary':
      console.log(toSummary(result));
      break;
    case 'jsonfeed':
      console.log(JSON.stringify(toJsonFeed(result), null, 2));
      break;
    case 'json':
    default:
      console.log(JSON.stringify(result, null, 2));
  }
}

program.parseAsync(process.argv).catch(err => { console.error(err); process.exit(1); });