/**
 * rigshot.mjs — screenshot a rigged model through its clips (dev/rig.html), as a contact sheet per clip.
 *
 *   python3 -m http.server 8147        # repo root
 *   node game-147/dev/rigshot.mjs maple walk,run,attack [frames]
 *
 * Expects game-147/dev/rig/<who>.glb and rig/<who>-<clip>.glb. Writes dev/shots/rig-<who>-<clip>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const [who, clipList, frames = '6'] = process.argv.slice(2);
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 260, height: 320 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://unpkg.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''))) }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:8147/game-147/dev/rig.html?model=rig/${who}.glb&who=${who}&clips=${clipList}`);
await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
console.log(who, 'bones', await page.evaluate(() => window.boneCount), 'clips', await page.evaluate(() => window.clipNames));
for (const clip of clipList.split(',')) {
    const d = await page.evaluate((c) => window.setClip(c, 0), clip);
    if (!d) { console.log('no clip', clip); continue; }
    const shots = [];
    for (let i = 0; i < +frames; i++) {
        await page.evaluate(([c, t]) => window.setClip(c, t), [clip, (d * i) / +frames]);
        shots.push(await page.screenshot());
    }
    // a strip: write the frames side by side with a tiny inline PNG compositor (canvas in the page)
    const strip = await page.evaluate(async (pngs) => {
        const imgs = await Promise.all(pngs.map((b) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b; })));
        const cv = document.createElement('canvas'); cv.width = imgs.length * imgs[0].width; cv.height = imgs[0].height;
        const cx = cv.getContext('2d'); imgs.forEach((im, i) => cx.drawImage(im, i * im.width, 0));
        return cv.toDataURL('image/png').split(',')[1];
    }, shots.map((b) => b.toString('base64')));
    fs.writeFileSync(path.join(OUT, `rig-${who}-${clip}.png`), Buffer.from(strip, 'base64'));
    console.log('wrote', `rig-${who}-${clip}.png`, d.toFixed(2) + 's');
}
await browser.close();
