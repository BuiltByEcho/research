import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const DEFAULT_DIR = join(import.meta.dirname, '..', '.cache');
const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour

function hashKey(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export class Cache {
  constructor(opts = {}) {
    this.dir = opts.dir ?? DEFAULT_DIR;
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    mkdirSync(this.dir, { recursive: true });
  }

  _path(key) {
    return join(this.dir, `${hashKey(key)}.json`);
  }

  get(key) {
    try {
      const raw = readFileSync(this._path(key), 'utf8');
      const entry = JSON.parse(raw);
      if (Date.now() - entry.ts > this.ttlMs) return null;
      return entry.data;
    } catch {
      return null;
    }
  }

  set(key, data) {
    writeFileSync(this._path(key), JSON.stringify({ ts: Date.now(), data }, null, 2));
  }

  has(key) {
    return this.get(key) !== null;
  }

  invalidate(key) {
    try { rmSync(this._path(key)); } catch {}
  }

  /** Remove all expired entries. Returns count purged. */
  purge() {
    let purged = 0;
    const now = Date.now();
    for (const f of readdirSync(this.dir).filter(f => f.endsWith('.json'))) {
      try {
        const entry = JSON.parse(readFileSync(join(this.dir, f), 'utf8'));
        if (now - entry.ts > this.ttlMs) { rmSync(join(this.dir, f)); purged++; }
      } catch { rmSync(join(this.dir, f)); purged++; }
    }
    return purged;
  }

  /** Return cache stats. */
  stats() {
    let entries = 0, expired = 0, bytes = 0;
    const now = Date.now();
    try {
      for (const f of readdirSync(this.dir).filter(f => f.endsWith('.json'))) {
        const fp = join(this.dir, f);
        const s = statSync(fp);
        bytes += s.size;
        try {
          const entry = JSON.parse(readFileSync(fp, 'utf8'));
          if (now - entry.ts > this.ttlMs) expired++;
          entries++;
        } catch { entries++; }
      }
    } catch {}
    return { entries, expired, bytes };
  }
}