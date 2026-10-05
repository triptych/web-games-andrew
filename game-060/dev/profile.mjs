// profile.mjs — CPU-profile a few seconds of the real game (boss stage, bot playing) and print the hottest functions.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const stage = +(process.argv[2] || 13);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 600, height: 760 } })).newPage();
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8060'}/game-060/index.html?debug=1`);
await page.waitForFunction(() => window.__bv);
await page.evaluate((st) => { __bv.start('arcade', st); __bv.autoplay(); __bv.G.world.god = true; __bv.skipIntro(); }, stage);
await page.waitForTimeout(1500);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
await page.waitForTimeout(3000);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, t] of counts) { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + t); }
const tot = [...self.values()].reduce((a, b) => a + b, 0);
console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, t]) => `${(t / tot * 100).toFixed(1).padStart(5)}%  ${k}`).join('\n'));
await browser.close();
