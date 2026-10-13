// node game-076/dev/shot.mjs <page relative to repo root> <out.png> [w h] — screenshot a dev page
import { chromium } from 'playwright';
const [page0, out, w = '1280', h = '900'] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:8076';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`${BASE}/${page0}`);
await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true });
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await b.close();
