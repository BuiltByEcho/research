const DEFAULT_ANGLES = [
  { id: 'overview', label: 'Overview / landscape', template: q => q },
  { id: 'official', label: 'Primary / official sources', template: q => `${q} official documentation primary source` },
  { id: 'implementation', label: 'Implementation patterns', template: q => `${q} architecture implementation patterns` },
  { id: 'evaluation', label: 'Evaluation / benchmarks', template: q => `${q} benchmark evaluation metrics` },
  { id: 'limitations', label: 'Limitations / risks', template: q => `${q} limitations failure modes criticism` },
  { id: 'recent', label: 'Recent developments', template: q => `${q} latest 2026` },
];

/**
 * Deterministic query expansion: cheap, inspectable, and API-key-free.
 * Successful research systems usually start with planning/scoping before search;
 * this gives us that shape without introducing an LLM dependency.
 */
export function buildResearchPlan(objective, opts = {}) {
  const maxQueries = opts.maxQueries ?? 5;
  const disabledAngles = new Set(opts.skipAngles ?? []);
  const angles = (opts.angles ?? DEFAULT_ANGLES).filter(a => !disabledAngles.has(a.id));
  const queries = [];
  const seen = new Set();

  for (const angle of angles) {
    const query = cleanQuery(angle.template(objective));
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    queries.push({ angle: angle.id, label: angle.label, query });
    if (queries.length >= maxQueries) break;
  }

  return {
    objective,
    generatedAt: new Date().toISOString(),
    method: 'heuristic-angle-expansion',
    queries,
  };
}

function cleanQuery(q) {
  return String(q || '').replace(/\s+/g, ' ').trim();
}
