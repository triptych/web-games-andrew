/**
 * flicker.mjs — does anything flash on a still screen?
 *
 *   node game-100/dev/flicker.mjs
 *
 * Reads every frame back and splits the picture into a 4 x 3 grid. For each region it counts how
 * often the region's average brightness jumped by more than 5% in one frame and then jumped back:
 * a flash, as opposed to a slow drift or an edge moving across (a chasing floor and a turning wall
 * move a lot and flash nowhere). A mirror-polished ball glittering under bloom is exactly the kind
 * of thing that shows up. It samples the menu and an idle board, with calm effects off and on;
 * calm must show no flip at all, normal at most 4 (about one flash a second) in any region. The
 * animation clock advances 0.05 s a frame however slow the harness is, so a 36-frame window is
 * ~1.8 s of animation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8100';
const FRAMES = +(process.env.FRAMES || 36);

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.addInitScript(() => { try { localStorage.setItem('glitterball-groove.v1.settings', JSON.stringify({ quality: 'medium', crt: 'full', calm: false })); } catch { /* */ } });
await page.goto(`${BASE}/game-100/index.html?debug=1`);
await page.waitForFunction(() => window.__gg, null, { timeout: 60000 });

const measure = (label, setup, calm) => page.evaluate(async ({ setup, calm, FRAMES }) => {
    const gg = window.__gg;
    gg.stage.calm = calm; gg.settings.calm = calm;
    gg.stage.setLook(gg.settings.crt);
    await (async () => { eval(setup); })();
    await new Promise((r) => setTimeout(r, 1500));          // let the screen settle
    gg.stage.armSampler();
    await new Promise((res) => { const f = () => (gg.stage.sampler.frames >= FRAMES ? res() : requestAnimationFrame(f)); f(); });
    return { swing: gg.stage.swing(0.25), flash: gg.stage.flicker() };
}, { setup, calm, FRAMES }).then((r) => {
    console.log(`${label.padEnd(24)} ${r.flash.frames} frames: worst region flipped ${r.flash.worst}x (${r.flash.regions} of 12 flipped at all; biggest step ${r.flash.maxStep.toFixed(2)}); ${(r.swing.share * 100).toFixed(0)}% of points merely drifted > 25%`);
    return r.flash;
});

let fails = 0;
const cases = [
    ['menu, effects on', "__gg.toMenu()", false],
    ['menu, calm', "__gg.toMenu()", true],
    ['idle board, effects on', "__gg.start('dance', 3)", false],
    ['idle board, calm', "__gg.start('dance', 3)", true],
];
for (const [label, setup, calm] of cases) {
    const r = await measure(label, setup, calm);
    if (calm && r.worst > 0) { fails++; console.log('  FAIL calm mode should not flash'); }
    if (!calm && r.worst > 4) { fails++; console.log('  FAIL a region of the screen flashes too often'); }
}
await browser.close();
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
