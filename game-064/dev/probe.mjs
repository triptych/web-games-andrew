/**
 * probe.mjs — one screenshot for iterating on visuals.
 *   node game-064/dev/probe.mjs [WxH] [name]       EVAL='js' runs an expression first (awaited)
 * Needs a static server at BASE (default http://127.0.0.1:8064) from the repo root.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8064';
const [W, H] = (process.argv[2] || '1280x800').split('x').map(Number);
const name = process.argv[3] || 'probe';
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
if (fs.existsSync(PKG)) await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || process.env.VERBOSE) console.log('console.' + m.type(), m.text()); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${BASE}/game-064/index.html?debug=1${process.env.QS || ''}`);
await page.waitForFunction(() => window.__kg && window.__kg.ready, null, { timeout: 60000 });
if (process.env.EVAL) console.log(await page.evaluate(`(async () => { ${process.env.EVAL} })()`));
await page.waitForTimeout(+(process.env.WAIT || 2500));
await page.screenshot({ path: path.join(OUT, `${name}.png`) });
console.log('shot', path.join(OUT, `${name}.png`));
await browser.close();
