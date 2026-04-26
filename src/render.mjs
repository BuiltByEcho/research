import { chromium } from 'playwright';
import path from 'node:path';

export async function renderExtract(url, opts = {}) {
  const headless = opts.headless ?? true;
  const profileDir = opts.profile ? path.resolve(opts.profileBaseDir ?? '.profiles', opts.profile) : null;
  const viewport = { width: opts.width ?? 1280, height: opts.height ?? 900 };
  let browser;
  let context;

  if (profileDir) {
    context = await chromium.launchPersistentContext(profileDir, { headless, viewport });
  } else {
    browser = await chromium.launch({ headless });
    context = await browser.newContext({ viewport });
  }

  const page = context.pages()[0] ?? await context.newPage();
  try {
    await page.goto(url, { waitUntil: opts.waitUntil ?? 'domcontentloaded', timeout: opts.timeoutMs ?? 20000 });
    if (opts.settleMs) await page.waitForTimeout(Number(opts.settleMs));
    if (opts.selector) await page.waitForSelector(opts.selector, { timeout: opts.selectorTimeoutMs ?? 10000 });

    const html = opts.html === false ? undefined : await page.content();
    const data = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      text: document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 50000) || '',
      links: Array.from(document.querySelectorAll('a[href]')).slice(0, 200).map(a => ({ text: a.textContent.trim().slice(0, 120), href: a.href })),
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 80).map(h => ({ level: Number(h.tagName.slice(1)), text: h.textContent.trim().slice(0, 200) })).filter(h => h.text),
    }));

    if (opts.snapshot !== false) data.accessibility = await compactAccessibilitySnapshot(page, opts.snapshotLimit ?? 160);
    if (html !== undefined) data.html = html;
    if (opts.screenshot) {
      await page.screenshot({ path: opts.screenshot, fullPage: false });
      data.screenshot = opts.screenshot;
    }
    data.render = { engine: 'playwright', profile: opts.profile || null, retrievedAt: new Date().toISOString() };
    return data;
  } finally {
    await context.close();
    if (browser) await browser.close();
  }
}

export async function compactAccessibilitySnapshot(page, limit = 160) {
  if (typeof page.locator('body').ariaSnapshot === 'function') {
    try {
      return String(await page.locator('body').ariaSnapshot()).split('\n').slice(0, limit).map(line => ({ aria: line.trim() })).filter(x => x.aria);
    } catch {}
  }
  let root = null;
  try {
    root = await page.accessibility?.snapshot({ interestingOnly: true });
  } catch {
    return [];
  }
  if (!root) return [];
  const out = [];
  const visit = (node, depth = 0) => {
    if (!node || out.length >= limit) return;
    const item = {
      role: node.role,
      name: trim(node.name, 140),
      value: trim(node.value, 120),
      checked: node.checked,
      disabled: node.disabled,
      expanded: node.expanded,
      level: node.level,
      depth,
    };
    if (item.name || ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'heading'].includes(item.role)) out.push(removeEmpty(item));
    for (const child of node.children ?? []) visit(child, depth + 1);
  };
  visit(root);
  return out;
}

function trim(v, n) {
  if (v == null) return undefined;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, n) : undefined;
}

function removeEmpty(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== false));
}
