/**
 * preview.mjs — the Garden's 1200×630 preview of The Last Apprentice: Hollowmere just after the Rose Ward opens,
 * the drowned village still grey and only its roses red, Tilly holding up the first red rose anyone has seen.
 *
 *   python3 -m http.server 8140                     # repo root
 *   node game-140/dev/preview.mjs                    # writes garden/img/games/game-140.jpg
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8140';
const OUT = path.join(HERE, '../../garden/img/games/game-140.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-140/index.html?debug=1`);
await page.waitForFunction(() => window.__tla && __tla.mode === 'title', null, { timeout: 90000 });
const line = await page.evaluate(() => {
    __tla.start(3, 'Wren');
    __tla.toScene('rose-bloom');
    // on to Tilly's first line with the rose
    for (let i = 0; i < 40 && __tla.G.scene && __tla.G.scene.cur?.who !== 'tilly'; i++) __tla.send({ t: 'advance' });
    __tla.vn.complete();
    document.getElementById('toasts').innerHTML = '';
    document.getElementById('chapter-card').hidden = true;
    return __tla.G.scene?.cur;
});
console.log(line);
await page.waitForTimeout(4000);
// the picture is the point: no dialogue box over it
await page.evaluate(() => { document.getElementById('dlg').hidden = true; document.getElementById('toasts').innerHTML = ''; });
await page.waitForTimeout(600);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();
