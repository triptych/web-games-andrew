import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package');
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); const f = path.join(PKG, rel); if (!fs.existsSync(f)) return route.abort(); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8054/game-054/index.html?debug=1');
await page.waitForFunction(() => window.__pe && window.__pe.state() === 'title', null, { timeout: 90000 });
await page.evaluate(() => __pe.start(1, 0));
await page.waitForFunction(() => __pe.game.cardReady, null, { timeout: 90000 });
await page.evaluate(() => { __pe.begin(); __pe.giveAll(); __pe.god(true); document.getElementById('hud').hidden = true; });
const ids = (process.env.W ?? 'blade,pistol,shotgun,ssg,chaingun,rocket,plasma,rail,bfg').split(',');
const files = [];
for (const id of ids) {
  await page.evaluate((id) => { __pe.weapons.select(id); }, id);
  await page.waitForTimeout(900);
  const f = `${OUT}/vm_${id}.png`;
  await page.screenshot({ path: f, clip: { x: 380, y: 200, width: 580, height: 340 } });
  files.push(f);
}
await browser.close();
