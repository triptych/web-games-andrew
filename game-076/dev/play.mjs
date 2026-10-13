// node game-076/dev/play.mjs <name> "<js to run after boot>" [waitMs] [w h] [query]
// Opens dev/runtime.html (the sample game), runs a snippet, screenshots dev/shots/<name>.png
import { chromium } from 'playwright';
const [name = 'play', js = '', wait = '600', w = '960', h = '720', q = ''] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:8076';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.stack || e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await p.goto(`${BASE}/game-076/dev/runtime.html?${q}`);
await p.waitForFunction(() => window.__tw, null, { timeout: 10000 });
await p.waitForTimeout(400);
if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log('result:', JSON.stringify(r)); }
await p.waitForTimeout(+wait);
await p.screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname });
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await b.close();
