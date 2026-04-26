import fs from 'node:fs';
import path from 'node:path';

export function writeTrace(result, opts = {}) {
  const dir = path.resolve(opts.dir ?? 'output/traces');
  fs.mkdirSync(dir, { recursive: true });
  const safe = slug(opts.label || result.query || result.queries?.join('-') || 'research');
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${safe}.json`);
  fs.writeFileSync(file, JSON.stringify({ traceVersion: 1, writtenAt: new Date().toISOString(), ...result }, null, 2));
  return file;
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'trace';
}
