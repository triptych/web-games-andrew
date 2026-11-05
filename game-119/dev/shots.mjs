/**
 * shots.mjs — boot the real game once and screenshot a series of moments (software GL needs ~40 s to boot,
 * so this does many shots per boot). Edit STEPS or pass a JSON file: node game-119/dev/shots.mjs [steps.json] [w h] [touch]
 * Each step is [name, "js snippet (async body, window.__thm available)", waitMs]. Output: game-119/dev/shots/<name>.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8119';
const [stepsFile, w = '1280', h = '760', touch = ''] = process.argv.slice(2);
const STEPS = stepsFile ? JSON.parse(fs.readFileSync(stepsFile, 'utf8')) : [
    ['s-title', '', 500],
    ['s-town', '__thm.start(3); __thm.skip()', 800],
    ['s-market', "__thm.act({t:'buy',shop:'general',item:'grain',n:8}); __thm.act({t:'buy',shop:'general',item:'pine',n:3}); __thm.open('market')", 600],
    ['s-wagon', "__thm.open('wagon')", 400],
    ['s-board', "__thm.open('board')", 400],
    ['s-inn', "__thm.open('inn')", 400],
    ['s-workshop', "__thm.open('workshop')", 400],
    ['s-guild', "__thm.open('guild')", 400],
    ['s-ledger', "__thm.open('ledger')", 400],
    ['s-quests', "__thm.open('quests')", 400],
];
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[error]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-119/index.html?debug=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.__thm && __thm.mode === 'title', null, { timeout: 120000 });
for (const [name, code, wait] of STEPS) {
    if (code) { const out = await page.evaluate(`(async () => { ${code} })()`); if (out !== undefined) console.log(name, JSON.stringify(out)); }
    await page.waitForTimeout(wait || 500);
    await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), timeout: 60000 });
    console.log('shot', name);
}
await browser.close();
