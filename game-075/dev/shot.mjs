// Screenshot any page under the repo: node game-075/dev/shot.mjs path/to/page.html out.png [w h]
import { chromium } from 'playwright';
const [url, out, w = '1200', h = '760'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => console.log('console', m.type(), m.text()));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:8075/${url}`);
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 20000 }).catch(() => console.log('not ready'));
await page.screenshot({ path: out });
await browser.close();
