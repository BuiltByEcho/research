import { chromium } from 'playwright';

export async function renderExtract(url, opts = {}) {
  const browser = await chromium.launch({ headless: opts.headless ?? true });
  const page = await browser.newPage({ viewport: { width: opts.width ?? 1280, height: opts.height ?? 900 } });
  try {
    await page.goto(url, { waitUntil: opts.waitUntil ?? 'domcontentloaded', timeout: opts.timeoutMs ?? 20000 });
    if (opts.selector) await page.waitForSelector(opts.selector, { timeout: opts.selectorTimeoutMs ?? 10000 });
    const data = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      text: document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 20000) || '',
      links: Array.from(document.querySelectorAll('a[href]')).slice(0, 100).map(a => ({ text: a.textContent.trim().slice(0, 120), href: a.href })),
    }));
    if (opts.screenshot) {
      await page.screenshot({ path: opts.screenshot, fullPage: false });
      data.screenshot = opts.screenshot;
    }
    return data;
  } finally {
    await browser.close();
  }
}
