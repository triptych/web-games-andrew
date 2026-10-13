// node game-076/dev/edshot.mjs <name> "<js after boot>" [waitMs] [w h] [touch] — the editor in Chromium
import { chromium } from 'playwright';
const [name = 'editor', js = '', wait = '600', w = '1366', h = '860', touch = ''] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:8076';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!touch, isMobile: !!touch, deviceScaleFactor: touch ? 2 : 1 });
if (process.env.FRESH !== '0') await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.stack || e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) errs.push('failed: ' + r.url()); });
await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.goto(`${BASE}/game-076/index.html`);
await p.waitForFunction(() => window.__tal, null, { timeout: 10000 }).catch(() => {});
await p.waitForTimeout(500);
if (js) { try { const r = await p.evaluate(js); if (r !== undefined) console.log('result:', JSON.stringify(r)); } catch (e) { console.log('EVAL ERROR', e.message); } }
await p.waitForTimeout(+wait);
await p.screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname });
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await b.close();
