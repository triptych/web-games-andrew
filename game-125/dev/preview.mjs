/**
 * preview.mjs — the 1200×630 picture for the Garden's Library and share links.
 *
 *   node game-125/dev/preview.mjs           # writes dev/shots/preview-*.png; copy the best to garden/img/games/game-125.jpg
 *
 * Sets moments up through the debug hooks with the full post chain: the Meadow half-healed with creatures, nodes
 * and the bot's arms; Rustwood under its rust canopy; the Rootmother; and TILLY on the Command Deck.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8125';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const drop = (zone, setup) => `__sf.start(21); __sf.skipTalk(); const G = __sf.G; G.bot.gen = 5; G.zones[${zone}].visited = true; ${setup}
    __sf.act({ t: 'deploy', zone: ${zone} }); __sf.skipTalk();
    const M = __sf.G.mission; __sf.G.speed = 0;
    for (const e of M.enemies) { e.passive = true; e.st = 'idle'; }`;
const MOMENTS = [
    ['meadow', drop(0, 'G.zones[0].barren = 18; G.zones[0].hostile = 40; G.zones[0].harv.metal = 1; G.zones[0].colony = 1;') + `
        M.p.x = 0; M.p.y = 22; M.p.yaw = 0;
        const sp = M.enemies.filter((e) => e.type === 'skitterling').slice(0, 3); sp.forEach((e, i) => { e.x = -2.5 + i * 2.6; e.y = 16.5 - (i % 2); });
        const tb = M.enemies.find((e) => e.type === 'thornback'); if (tb) { tb.x = 4.5; tb.y = 13; }
        const fl = M.nodes.filter((n) => n.kind === 'flora').slice(0, 3); fl.forEach((n, i) => { n.x = -6 + i * 1.6; n.y = 18.5 - i; });
        const mi = M.nodes.find((n) => n.kind === 'mineral'); mi.x = 2.2; mi.y = 19;
        __sf.view.pitch = -0.06;`],
    ['rustwood', drop(1, '') + `M.p.x = 3; M.p.y = 14; M.p.yaw = -0.3; const b = M.enemies.filter((e) => e.type === 'barkhound').slice(0, 2); b.forEach((e, i) => { e.x = 1 + i * 2; e.y = 8; e.st = 'chase'; e.passive = false; });`],
    ['rootmother', drop(5, '') + `M.p.x = 0; M.p.y = 2; M.p.yaw = 0; const R = M.enemies.find((e) => e.type === 'rootmother'); R.provoked = true; __sf.view.pitch = 0.12;`],
    ['command', `__sf.start(21); __sf.skipTalk(); const G = __sf.G; G.me.x = 1.2; G.me.z = -40.2; G.me.yaw = -0.15; G.me.pitch = 0.02; for (const Z of G.zones) { Z.toxic = 30; Z.barren = 30; }
        G.talk = { id: 'command', i: 0 }; __sf.view.station.tillyPos.set(0.5, 1.5, -41.7);`],
];

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const [name, code] of MOMENTS) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue;
    await page.goto(`${BASE}/game-125/index.html?debug=1&q=high`);
    await page.waitForFunction(() => window.__sf, null, { timeout: 60000 });
    await page.evaluate(`(async () => { ${code} })()`);
    // a clean picture: no HUD, no back link
    await page.addStyleTag({ content: '.hud, #back-link, #touch, #crosshair, #toasts, #talk { display: none !important; }' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(HERE, 'shots', `preview-${name}.png`) });
    console.log('shot', name);
}
await browser.close();
