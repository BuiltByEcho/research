import { spawn } from 'node:child_process';

const PYTHON_SCRIPT = String.raw`
import json, sys, traceback

payload = json.loads(sys.stdin.read() or '{}')
url = payload['url']
engine = payload.get('engine') or 'static'
timeout_ms = int(payload.get('timeoutMs') or 15000)
headless = bool(payload.get('headless', True))
wait_selector = payload.get('waitSelector')

try:
    if engine == 'dynamic':
        from scrapling import DynamicFetcher
        kwargs = {'headless': headless, 'timeout': timeout_ms}
        if wait_selector:
            kwargs['wait_selector'] = wait_selector
        page = DynamicFetcher.fetch(url, **kwargs)
    elif engine == 'stealth':
        from scrapling import StealthyFetcher
        kwargs = {'headless': headless, 'timeout': timeout_ms}
        if wait_selector:
            kwargs['wait_selector'] = wait_selector
        page = StealthyFetcher.fetch(url, **kwargs)
    else:
        from scrapling import Fetcher
        page = Fetcher.get(url, timeout=max(1, int(timeout_ms / 1000)))

    headers = dict(getattr(page, 'headers', {}) or {})
    html = getattr(page, 'html_content', None)
    if not html:
        body = getattr(page, 'body', b'') or b''
        encoding = getattr(page, 'encoding', 'utf-8') or 'utf-8'
        html = body.decode(encoding, errors='replace') if isinstance(body, (bytes, bytearray)) else str(body)
    try:
        text = page.get_all_text(ignore_tags=('script', 'style', 'noscript', 'svg'))
    except Exception:
        text = getattr(page, 'text', '') or ''
    out = {
        'ok': True,
        'engine': engine,
        'url': url,
        'finalUrl': getattr(page, 'url', url),
        'status': getattr(page, 'status', None),
        'headers': headers,
        'contentType': headers.get('content-type') or headers.get('Content-Type') or '',
        'html': html,
        'text': text,
    }
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({
        'ok': False,
        'engine': engine,
        'url': url,
        'error': str(e),
        'trace': traceback.format_exc()[-2000:],
    }))
    sys.exit(2)
`;

export async function fetchWithScrapling(url, opts = {}) {
  const engine = normalizeEngine(opts.engine ?? opts.backend ?? 'static');
  const python = opts.python ?? process.env.SCRAPLING_PYTHON ?? 'python3';
  const payload = {
    url,
    engine,
    timeoutMs: opts.timeoutMs ?? 15000,
    headless: opts.headless !== false,
    waitSelector: opts.waitSelector ?? null,
  };
  const result = await runPythonJson(python, PYTHON_SCRIPT, payload, opts.timeoutMs ?? 15000);
  if (!result.ok) {
    const detail = result.error ? `: ${result.error}` : '';
    throw new Error(`Scrapling ${engine} fetch failed${detail}`);
  }
  return result;
}

export async function isScraplingAvailable(opts = {}) {
  const python = opts.python ?? process.env.SCRAPLING_PYTHON ?? 'python3';
  try {
    const result = await runPythonJson(python, 'import json\ntry:\n import scrapling\n print(json.dumps({"ok": True, "version": getattr(scrapling, "__version__", None)}))\nexcept Exception as e:\n print(json.dumps({"ok": False, "error": str(e)}))\n', {}, opts.timeoutMs ?? 5000);
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function normalizeEngine(value) {
  const v = String(value || 'static').replace(/^scrapling-?/, '');
  if (v === 'dynamic' || v === 'render') return 'dynamic';
  if (v === 'stealth' || v === 'stealthy') return 'stealth';
  return 'static';
}

function runPythonJson(python, script, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['-c', script], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Python helper timed out after ${timeoutMs}ms`));
    }, timeoutMs + 2000);

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      const line = stdout.trim().split('\n').filter(Boolean).at(-1);
      if (!line) {
        reject(new Error(`Python helper produced no JSON${stderr ? `: ${stderr.trim().slice(0, 500)}` : ''}`));
        return;
      }
      try {
        const parsed = JSON.parse(line);
        if (code && parsed.ok !== false) parsed.ok = false;
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Python helper returned invalid JSON: ${line.slice(0, 500)}${stderr ? ` stderr=${stderr.trim().slice(0, 500)}` : ''}`));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
