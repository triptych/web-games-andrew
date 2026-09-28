// perf.mjs — frame-time and renderer cost in Chromium at phone and desktop sizes: node dev/perf.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--no-sandbox'] });
for (const [w,h,dpr] of [[390,844,3],[1280,800,1]]) {
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
await p.goto('http://127.0.0.1:8043/game-043/index.html'); await p.waitForTimeout(800);
await p.click('text=New Game'); await p.click('text=Begin your story'); await p.click('text=Travel to'); await p.waitForTimeout(500);
await p.evaluate(() => { const u = window.__glim.ui; u.dlgQueue = []; u.closeDialog(); const g = window.__glim.game; const R = g.world.regions[0]; g.p.x = R.hub.x; g.p.y = R.hub.y; g.s.time.min = 20*60; });
const r = await p.evaluate(() => new Promise(res => { const t = []; let last = performance.now(); let n = 0; const G = window.__glim; function f(now) { t.push(now - last); last = now; const g = G.game; g.p.x += 0.05; if (++n < 180) requestAnimationFrame(f); else res(t); } requestAnimationFrame(f); }));
r.sort((a,b)=>a-b); console.log(w+'x'+h, 'median frame', r[r.length>>1].toFixed(1), 'p95', r[Math.floor(r.length*0.95)].toFixed(1));
const cost = await p.evaluate(() => { const R = window.__glim.renderer; const t0 = performance.now(); for (let k = 0; k < 60; k++) R.draw(1/60); return (performance.now() - t0) / 60; });
console.log('  draw() cost ms', cost.toFixed(2));
await p.close(); }
await b.close();
