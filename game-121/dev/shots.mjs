/**
 * shots.mjs — boot the game ONCE and take a list of screenshots (software WebGL takes ~40 s to boot, so
 * play.mjs per picture is slow). Each step is [name, snippet, waitMs]; the snippet is the body of an async
 * function with window.__aw in scope.
 *
 *   node game-121/dev/shots.mjs                 # the default gallery
 *   STEPS=ball,deal node game-121/dev/shots.mjs # only these
 *   W=390 H=844 TOUCH=1 SUFFIX=-phone node game-121/dev/shots.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8121';
const W = +(process.env.W || 1280), H = +(process.env.H || 760), TOUCH = process.env.TOUCH === '1', SUF = process.env.SUFFIX || '';
const ONLY = (process.env.STEPS || '').split(',').filter(Boolean);
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });

// play the bot up to a moment, then look at it
const to = (pred) => `__aw.start(11); __aw.playTo((G) => ${pred}, { mode: 'perfect', romance: 'mirabel' });`;
const STEPS = [
    ['title', ``, 600],
    ['prologue', `__aw.start(11);`, 1500],
    ['day', `__aw.act({t:'next'}); while (__aw.G.dlg) __aw.act({t:'next'});`, 800],
    ['arrive', `__aw.playTo((G) => G.phase === 'arrive');`, 1800],
    ['talk', `__aw.playTo((G) => G.phase === 'talk' && G.dlg.i === 1);`, 2500],
    ['ready', `__aw.playTo((G) => G.phase === 'ready');`, 2500],
    ['ball', `__aw.act({t:'gaze'}); __aw.act({t:'next'});`, 3500],
    ['deal', `__aw.act({t:'draw'});`, 3500],
    ['placed', `const G = __aw.G; for (let i = 0; i < 3; i++) __aw.act({ t: 'place', h: G.reading.hand.findIndex((h, k) => !G.reading.placed.includes(k)) });`, 2500],
    ['flip', `__aw.act({t:'lay'});`, 1500],
    ['style', `__aw.act({t:'next'});`, 2500],
    ['result', `__aw.act({t:'say', style: __aw.G.reading.likes});`, 2800],
    ['clouded', `__aw.playTo((G) => G.phase === 'ready' && G.day === 2 && G.idx === 0); __aw.act({t:'gaze'}); __aw.act({t:'next'}); __aw.act({t:'draw'});`, 3500],
    ['stranger', `__aw.playTo((G) => G.phase === 'ready' && G.day === 2 && G.idx === 2);`, 2800],
    ['dusk', `__aw.playTo((G) => G.phase === 'dusk');`, 2500],
    ['date', `__aw.act({t:'evening', id:'mirabel'}); while (!__aw.G.dlg.choices) __aw.act({t:'next'}); `, 3500],
    ['codex', `__aw.ui.openScreen('codex');`, 1200],
    ['codex-cards', `__aw.ui.codexTab = 'card'; __aw.ui.renderCodex();`, 800],
    ['night', `__aw.ui.closeTop(); __aw.playTo((G) => G.phase === 'scene' && G.dlg?.ctx?.kind === 'prince');`, 3500],
    ['grand', `__aw.playTo((G) => G.phase === 'ready' && G.client?.grand);`, 3500],
    ['festival', `__aw.playTo((G) => G.phase === 'festival');`, 2500],
    ['finale', `__aw.act({t:'evening', id:'mirabel'});`, 4500],
    ['ending', `__aw.playTo((G) => G.phase === 'ending');`, 1500],
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: TOUCH, isMobile: TOUCH })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-121/index.html?debug=1&fast=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.__aw, null, { timeout: 120000 });
let started = false;
for (const [name, code, wait] of STEPS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    if (!started && name !== 'title' && name !== 'prologue') { await page.evaluate('__aw.start(11)'); }
    started = true;
    try {
        if (code) await page.evaluate(`(async () => { ${code} })()`);
        await page.evaluate('__aw.view.settle && __aw.view.settle(__aw.G, 3)');
        await page.waitForTimeout(wait);
        await page.screenshot({ path: path.join(OUT, `${name}${SUF}.png`), timeout: 180000 });
        console.log('shot', name);
    } catch (e) { console.log('FAILED', name, e.message.split('\n')[0]); }
}
await browser.close();
