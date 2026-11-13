/**
 * preview.mjs — the 1200×630 Garden/share preview: a Thunderborn fighting Skyllith in the drowned temple.
 *   python3 -m http.server 8132   (repo root)   then   node game-132/dev/preview.mjs
 * Writes garden/img/games/game-132.jpg (via a PNG screenshot and Pillow).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const OUT = path.join(HERE, '../../garden/img/games/game-132.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    return fs.existsSync(file) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) }) : route.abort();
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8132'}/game-132/index.html?debug=1`);
await page.waitForFunction(() => window.__tv);
await page.evaluate(async () => {
    __tv.start(9, 'ironsworn');
    const G = __tv.G, P = G.player;
    // a level-12 Thunderborn with the skills the picture wants
    P.level = 12; P.unspent.skill = 40; P.unspent.attr = 0;
    __tv.act({ t: 'pickMastery', m: 'storm' });
    for (const m of ['warfare', 'storm']) for (let i = 0; i < 7; i++) __tv.act({ t: 'learnBar', m });
    for (const id of ['leap', 'warcry', 'chain', 'staticcharge', 'thunderstrike']) __tv.act({ t: 'learnSkill', id });
    __tv.act({ t: 'enter', id: 'gate' });
    __tv.act({ t: 'enter', id: 'exit' });
    for (const id of [...__tv.ui.stack]) __tv.ui.closeScreen(id);
    const boss = G.mons.find((m) => m.boss);
    G.mons = G.mons.filter((m) => m.boss || Math.hypot(m.x - boss.x, m.y - boss.y) < 14);
    P.x = boss.x - 4.5; P.y = boss.y + 2.5;
    boss.aggro = true; boss.life = boss.max * 0.62;
    G.pet.x = P.x - 1; G.pet.y = P.y + 1;
    __tv.view.zoom = 0.8;
    __tv.autoplay(true);
    await new Promise((r) => setTimeout(r, 9000));
    __tv.autoplay(false);
});
await page.waitForTimeout(800);
const png = path.join(HERE, 'shots', 'preview.png');
fs.mkdirSync(path.dirname(png), { recursive: true });
await page.screenshot({ path: png });
await browser.close();
execFileSync('python3', ['-c', `from PIL import Image; Image.open('${png}').convert('RGB').save('${OUT}', quality=86)`]);
console.log('wrote', path.relative(process.cwd(), OUT));
