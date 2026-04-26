import { hostname } from './url-utils.mjs';

/**
 * Lightweight audit of a research run. Successful deep-research systems keep an
 * explicit sense of coverage, source diversity, and evidence quality instead of
 * blindly trusting the first result set.
 */
export function auditResearchRun(result, opts = {}) {
  const results = result?.results ?? [];
  const planQueries = result?.plan?.queries ?? [];
  const minHighQuality = opts.minHighQuality ?? 2;
  const minHosts = opts.minHosts ?? Math.min(3, Math.max(1, results.length));
  const minCoverage = opts.minCoverage ?? (planQueries.length ? Math.min(3, planQueries.length) : 1);

  const hosts = new Set(results.map(r => hostname(r.finalUrl || r.url)).filter(Boolean));
  const highQuality = results.filter(r => (r.sourceQuality?.score ?? r.score ?? 0) >= 70);
  const jsGated = results.filter(r => r.fetch?.jsGated);
  const errors = results.filter(r => r.error);
  const stale = results.filter(r => r.sourceQuality?.freshness === 'stale');
  const coveredAngles = new Set(results.map(r => r.angle).filter(Boolean));
  const uncoveredAngles = planQueries.filter(q => q.angle && !coveredAngles.has(q.angle));

  const warnings = [];
  if (!results.length) warnings.push('No usable results returned.');
  if (hosts.size < minHosts) warnings.push(`Low source diversity: ${hosts.size} unique host(s).`);
  if (highQuality.length < minHighQuality) warnings.push(`Low high-quality source count: ${highQuality.length}.`);
  if (planQueries.length && coveredAngles.size < minCoverage) warnings.push(`Incomplete plan coverage: ${coveredAngles.size}/${planQueries.length} angles represented.`);
  if (jsGated.length) warnings.push(`${jsGated.length} result(s) appear JS-gated.`);
  if (errors.length) warnings.push(`${errors.length} result(s) failed to fetch/extract.`);
  if (stale.length > Math.max(1, results.length / 2)) warnings.push('Most sources look stale or lack fresh date signals.');

  const followUpQueries = uncoveredAngles.slice(0, 4).map(q => q.query);
  if (hosts.size < minHosts && result?.query) followUpQueries.push(`${result.query} independent sources analysis`);
  if (highQuality.length < minHighQuality && result?.query) followUpQueries.push(`${result.query} official documentation primary source`);

  const grade = warnings.length === 0 ? 'strong' : warnings.length <= 2 ? 'needs-review' : 'weak';

  return {
    grade,
    resultCount: results.length,
    uniqueHosts: hosts.size,
    highQualitySources: highQuality.length,
    coveredAngles: [...coveredAngles],
    uncoveredAngles: uncoveredAngles.map(q => q.angle),
    jsGatedCount: jsGated.length,
    errorCount: errors.length,
    staleCount: stale.length,
    warnings,
    followUpQueries: [...new Set(followUpQueries)].slice(0, 6),
  };
}
