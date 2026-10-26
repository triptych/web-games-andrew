/**
 * gallery.mjs — a contact sheet of the procedural art on a neutral background: every monster family
 * (and a boss), strangers, things on the floor, item icons, portraits, and a wall atlas per theme.
 * Judging art in the game itself hides broken shapes under the dither and the fog.
 *
 *   node game-101/dev/gallery.mjs         → dev/shots/gallery-sprites.png, gallery-atlas.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8101';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => { const f = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : route.abort(); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-101/index.html?debug=1`);
await page.waitForFunction(() => window.__pc);
await page.evaluate(async () => {
    const S = await import('/game-101/js/view/sprites.js');
    const M = await import('/game-101/js/sim/monsters.js');
    const I = await import('/game-101/js/sim/items.js');
    const R = await import('/game-101/js/rng.js');
    const D = await import('/game-101/js/sim/dungeon.js');
    document.body.replaceChildren();
    document.body.style.cssText = 'background:#555;padding:10px;overflow:auto;font:14px monospace;color:#fff';
    const add = (c, s = 3, label = '') => { const w = document.createElement('div'); w.style.cssText = 'display:inline-block;margin:3px;text-align:center;vertical-align:top'; const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); cv.style.cssText = `width:${c.width * s}px;height:${c.height * s}px;image-rendering:pixelated;background:#222`; w.append(cv); if (label) { const l = document.createElement('div'); l.textContent = label; l.style.fontSize = '11px'; w.append(l); } document.body.append(w); };
    const hdr = (t) => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'margin:8px 0 2px;color:#ff5'; document.body.append(d); };
    hdr('Monsters');
    for (const f of M.FAMILIES) add(S.monsterCanvas({ fam: f.id, seed: 5, pal: f.pal, boss: false }), 2, f.id);
    hdr('Variant tints + boss');
    const r = R.makeRng(3);
    for (const t of [11, 12, 14, 8, 5, 15]) add(S.monsterCanvas({ fam: 'wolf', seed: 1, pal: [t, 8, 15], boss: false }), 2, 'tint ' + t);
    for (const f of ['goblin', 'golem', 'drake', 'demon']) add(S.monsterCanvas({ fam: f, seed: 2, pal: M.FAM_BY_ID[f].pal, boss: true }), 2, 'boss ' + f);
    hdr('Strangers');
    for (const k of ['merchant', 'hermit', 'adventurer', 'gambler', 'riddler', 'healer', 'questgiver']) add(S.npcCanvas(k, 2), 3, k);
    hdr('Things on the floor');
    for (const [t, s, o] of [['chest', '', false], ['chest', '', true], ['gather', 'herb'], ['gather', 'ore'], ['gather', 'bug'], ['gather', 'relic'], ['spring'], ['altar', 'shrine'], ['altar', 'blood'], ['sign'], ['relic'], ['den'], ['trap']]) add(S.featureCanvas(t, s || '', !!o), 3, t + (s ? ':' + s : ''));
    hdr('Item icons');
    const its = [];
    for (const b of I.WEAPONS) its.push(I.genWeapon(r, 20, { base: b.id, rar: 2, noCurse: true }));
    for (const b of I.ARMORS) its.push(I.genArmor(r, 20, { base: b.id, rar: 2, noCurse: true }));
    for (const b of I.CHARMS) its.push(I.genCharm(r, 12, { base: b.id }));
    for (const e of Object.keys(I.POTIONS)) its.push(I.genPotion(r, 12, e));
    for (const e of Object.keys(I.SCROLLS)) its.push(I.genScroll(r, 12, e));
    its.push(I.genWand(r, 10), I.genTome(r, 10));
    for (const k of ['herb', 'ore', 'bug', 'relic', 'gem']) its.push(I.genCollectible(r, 12, k));
    for (const it of its) add(S.itemIcon(it), 4, '');
    hdr('Portraits');
    for (const cls of ['warrior', 'rogue', 'cleric', 'mage', 'ranger', 'alchemist']) for (let f = 0; f < 3; f++) add(S.portraitCanvas({ cls, face: f * 5 + 1 }), 3, '');
    void D;
});
await page.screenshot({ path: path.join(HERE, 'shots', 'gallery-sprites.png'), fullPage: true });
await page.evaluate(async () => {
    const T = await import('/game-101/js/view/textures.js');
    document.body.replaceChildren();
    document.body.style.cssText = 'background:#555;padding:10px';
    for (let i = 0; i < 10; i++) { const c = T.buildAtlas(i); c.style.cssText = 'width:512px;height:256px;image-rendering:pixelated;margin:4px;background:#222'; document.body.append(c); }
});
await page.screenshot({ path: path.join(HERE, 'shots', 'gallery-atlas.png'), fullPage: true });
console.log('shots in dev/shots: gallery-sprites.png gallery-atlas.png');
await browser.close();
