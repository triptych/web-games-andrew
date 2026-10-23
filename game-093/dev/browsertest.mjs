/**
 * browsertest.mjs — Dawnshard Saga in real Chromium (SwiftShader WebGL: tilt-shift, bloom and the swirl all run).
 *
 * desktop (1280×720): title with no errors and ← Games on top → New Game by click → the opening scene advances with real
 *   keys → the field: real keys walk, Esc opens the menu and the sim stops, a tab shows its pane, Esc closes it →
 *   a forced battle plays to Victory with real keys (Boost, Attack, targets, Skills) → Continue → the world is back →
 *   Save → reload → Continue restores the same game → Delete save.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the deck appears, the stick walks,
 *   A advances dialogue, ☰ opens the menu, a battle's command window is tapped through, controls ≥ 44 px and on screen.
 * nostorage: localStorage throws; the game still boots, starts and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8093          # from the REPO ROOT
 *   node game-093/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8093), ONLY=desktop,phones,nostorage. THREE_PKG: a local copy of three@0.165.0 if the CDN is blocked.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8093';
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, errors = [], browser = null;

async function open(viewport, { touch = false, nostorage = false, keepStorage = false, page: reuse = null } = {}) {
    if (!reuse) {
        if (browser) await browser.close();
        browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    }
    const ctx = reuse ? reuse.context() : await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    if (!reuse) await ctx.addInitScript((a) => {
        if (a.ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!sessionStorage.getItem('keep')) try { localStorage.clear(); sessionStorage.setItem('keep', '1'); } catch { /* */ }
    }, { ns: nostorage });
    const page = reuse || await ctx.newPage();
    if (!reuse) {
        if (PKG) await page.route('https://unpkg.com/**', (route) => { const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); if (!fs.existsSync(file)) return route.abort(); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) }); });
        await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
        errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    }
    await page.goto(`${BASE}/game-093/index.html?debug=1&fast=8&q=low&seed=7`);
    await page.waitForFunction(() => window.__ds && __ds.mode === 'title' && document.querySelector('#titlebox'), null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `bt-${name}.png`) });
const until = (page, fn, msg, timeout = 40000, arg = null) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const clickText = (page, text) => Q(page, (t) => { const e = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t) && b.offsetParent); if (!e) return false; e.click(); return true; }, text);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport, c = document.getElementById('view').getBoundingClientRect();
    const vw = vv?.width ?? innerWidth, vh = vv?.height ?? innerHeight;
    return { noHScroll: document.documentElement.scrollWidth <= innerWidth + 1, fills: Math.abs(c.width - vw) <= 2 && Math.abs(c.height - vh) <= 2 };
});
const backLinkOk = (page) => Q(page, () => { const a = document.getElementById('back-link'); if (!a || a.getAttribute('href') !== '../index.html') return false; const r = a.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.width > 0 && r.top >= 0 && (top === a || a.contains(top)); });
const key = (page, k) => page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), k);
const BATTLE = `const B = await import('/game-093/js/sim/battle.js'); const P = await import('/game-093/js/sim/party.js'); const G = __ds.G;
    G.scene = null; G.mode = 'field'; G.flags.intro_done = 1; G.story.i = 3;
    for (const id of ['lyra', 'thorne']) P.recruit(G, id);
    for (const id of G.party.active) G.party.members[id].lvl = 9;
    B.startBattle(G, { enemies: [{ kind: 'wolf', lvl: 4 }, { kind: 'slime', lvl: 3 }], bg: 'forest' });`;
const startBattle = (page) => Q(page, `(async () => { ${BATTLE} })()`);
/** the hero's window is open: choose Attack with a boost, confirm the first target */
const playTurns = async (page, mode = 'keys', max = 80) => {
    for (let i = 0; i < max; i++) {
        const st = await Q(page, () => ({ res: __ds.G.battle?.result || null, over: !__ds.G.battle, ui: __ds.ui.battle.mode, top: __ds.ui.top?.id }));
        if (st.over || st.res) return;
        if (st.ui === 'main') {
            if (mode === 'keys') { await key(page, 'KeyR'); await key(page, 'Enter'); await page.waitForTimeout(250); await key(page, 'Enter'); }
            else { await clickText(page, 'Attack'); await page.waitForTimeout(250); await clickText(page, 'OK'); }
        }
        await page.waitForTimeout(600);
    }
};

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×720');
    const page = await open({ width: 1280, height: 720 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !!document.getElementById('titlebox') && !document.getElementById('btn-continue')), 'title screen is up, no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.fills, 'the picture fills the window; no sideways scroll');
    await until(page, () => __ds.view.mapRec, 'the town is built behind the title');
    await shot(page, 'desktop-title');
    await clickText(page, 'New Game');
    await until(page, () => __ds.mode === 'play' && !document.getElementById('titlebox'), 'New Game starts play');
    check(await Q(page, () => !document.querySelector('#hud').hidden), 'the HUD is shown');
    await until(page, () => __ds.G.scene?.line, 'the opening scene starts talking', 60000);
    await until(page, () => document.getElementById('dialogue') && !document.getElementById('dialogue').hidden && document.querySelector('#dialogue .txt').textContent.length > 4, 'the dialogue box types the line');
    await shot(page, 'desktop-dialogue');
    const l0 = await Q(page, () => __ds.G.scene.line.text);
    await key(page, 'Enter'); await page.waitForTimeout(300); await key(page, 'Enter');
    await until(page, (t) => !__ds.G.scene?.line || __ds.G.scene.line.text !== t, 'Enter finishes the line, then advances', 30000, l0);
    // skip the rest of the opening to reach the field
    await Q(page, () => { const G = __ds.G; for (let i = 0; i < 400 && G.scene; i++) { __ds.act(G, { type: 'advance' }); __ds.ff(0.3); } G.events.length = 0; });
    await until(page, () => __ds.G.mode === 'field' || __ds.G.mode === 'scene', 'the story hands over the field');
    await Q(page, () => { const G = __ds.G; if (G.scene) { G.scene = null; G.mode = 'field'; } __ds.ui.endLine(); });
    await until(page, () => __ds.G.mode === 'field' && !__ds.G.warp && !__ds.G.pending, 'free to walk');
    const p0 = await Q(page, () => [__ds.G.px, __ds.G.py]);
    await page.keyboard.down('ArrowDown');
    await until(page, (p) => Math.hypot(__ds.G.px - p[0], __ds.G.py - p[1]) > 1.5, 'holding ↓ walks', 30000, p0);
    await page.keyboard.up('ArrowDown');
    await shot(page, 'desktop-field');
    await page.keyboard.press('Escape');
    await until(page, () => document.querySelector('#menu'), 'Esc opens the pause menu');
    const t0 = await Q(page, () => __ds.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __ds.G.t === t, t0), 'the sim stops while the menu is open');
    await clickText(page, 'Party'); await shot(page, 'desktop-menu-party');
    await clickText(page, 'Status'); await shot(page, 'desktop-menu-status');
    await clickText(page, 'Quests'); await clickText(page, 'Bestiary');
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#menu'), 'Esc closes the menu');
    await until(page, (t) => __ds.G.t > t, 'and the game runs again', 30000, t0);

    // keys only: Z picks a dialogue choice and a menu button
    await Q(page, () => { __ds.ui.line = { who: 'Test', text: 'x' }; __ds.ui.showChoices(['First', 'Second']); window.__picked = null; __ds.act = () => true; document.querySelectorAll('#choices button').forEach((b, i) => b.addEventListener('click', () => { window.__picked = i; })); });
    await key(page, 'ArrowDown'); await page.waitForTimeout(150); await key(page, 'KeyZ');
    await until(page, () => window.__picked === 1, 'Down then Z picks the second dialogue choice (no mouse)');
    await Q(page, () => { __ds.ui.endLine(); });
    await key(page, 'KeyP');
    await until(page, () => document.querySelector('#menu'), 'P opens the menu');
    await key(page, 'ArrowDown'); await page.waitForTimeout(150); await key(page, 'KeyZ');
    await until(page, () => document.querySelector('#menu .main h2')?.textContent.length > 0, 'Z on a menu tab opens its pane');
    await key(page, 'KeyX');
    await until(page, () => !document.querySelector('#menu'), 'X backs out of the menu');
    // a battle, by real keys
    await startBattle(page);
    await until(page, () => __ds.ui.battle.mode === 'main', 'the hero\'s command window opens', 60000);
    check(await Q(page, () => !!document.querySelector('#party-hud') && !!document.querySelector('#order') && document.querySelectorAll('.elabel').length >= 1), 'party panel, turn order and enemy labels are up');
    await shot(page, 'desktop-battle');
    await clickText(page, 'Skills');
    await until(page, () => __ds.ui.battle.mode === 'skills', 'Skills lists the hero\'s skills');
    await shot(page, 'desktop-battle-skills');
    await key(page, 'Escape');
    await until(page, () => __ds.ui.battle.mode === 'main', 'Esc goes back');
    await playTurns(page, 'keys');
    await until(page, () => document.querySelector('#results'), 'Victory shows the results window', 120000);
    await shot(page, 'desktop-results');
    await clickText(page, 'Continue');
    await until(page, () => __ds.G.mode === 'field' && !__ds.G.battle && !document.querySelector('#battle'), 'Continue returns to the field', 60000);
    // save, reload, continue
    const snap = await Q(page, () => { __ds.save(); return JSON.stringify([__ds.G.map, __ds.G.gold, Object.keys(__ds.G.party.members).length]); });
    await open(null, { page });
    check(await Q(page, () => !!document.getElementById('titlebox') && [...document.querySelectorAll('#titlebox button')].some((b) => b.textContent.startsWith('Continue'))), 'after a reload the title offers Continue');
    await clickText(page, 'Continue');
    await until(page, (s) => __ds.mode === 'play' && JSON.stringify([__ds.G.map, __ds.G.gold, Object.keys(__ds.G.party.members).length]) === s, 'Continue restores the saved game', 30000, snap);
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => { const r = await Q(page, (s) => { const e = document.querySelector(s); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };
    const tapText = async (text) => { const r = await Q(page, (t) => { const e = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t) && b.offsetParent); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, text); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };
    check(await backLinkOk(page), '← Games link is on top');
    const L0 = await layout(page);
    check(L0.noHScroll && L0.fills, 'the picture fills the visible viewport; no sideways scroll');
    await shot(page, `phone-${w}x${h}-title`);
    check(await Q(page, () => [...document.querySelectorAll('#titlebox button')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 40 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })), 'title buttons are ≥ 40 px tall and on screen');
    await tapText('New Game');
    await until(page, () => __ds.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    check(await Q(page, () => [...document.querySelectorAll('#touch .tbtn')].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 36 && r.height >= 36 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })), 'deck buttons are big enough and on screen');
    await until(page, () => __ds.G.scene?.line && document.querySelector('#dialogue .txt')?.textContent.length > 3, 'the opening scene talks', 60000);
    check(await Q(page, () => { const r = document.getElementById('dialogue').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.top > 0; }), 'the dialogue box is inside the screen');
    await shot(page, `phone-${w}x${h}-dialogue`);
    const l0 = await Q(page, () => __ds.G.scene.line.text);
    await tapSel('#btn-a'); await page.waitForTimeout(300); await tapSel('#btn-a');
    await until(page, (t) => !__ds.G.scene?.line || __ds.G.scene.line.text !== t, 'tapping A advances the dialogue', 30000, l0);
    await Q(page, () => { const G = __ds.G; for (let i = 0; i < 400 && G.scene; i++) { __ds.act(G, { type: 'advance' }); __ds.ff(0.3); } G.events.length = 0; if (G.scene) { G.scene = null; G.mode = 'field'; } __ds.ui.endLine(); });
    await until(page, () => __ds.G.mode === 'field' && !__ds.G.warp, 'free to walk');
    // the stick
    const p0 = await Q(page, () => [__ds.G.px, __ds.G.py]);
    const z = await Q(page, () => { const b = document.getElementById('stick-zone').getBoundingClientRect(); return { x: b.left + b.width * 0.5, y: b.top + b.height * 0.5 }; });
    await touch('touchStart', z.x, z.y); await touch('touchMove', z.x + 60, z.y);
    await until(page, (p) => Math.hypot(__ds.G.px - p[0], __ds.G.py - p[1]) > 1.5, 'dragging the stick walks', 30000, p0);
    await touch('touchEnd');
    await shot(page, `phone-${w}x${h}-field`);
    await tapSel('#btn-menu');
    await until(page, () => document.querySelector('#menu'), '☰ opens the menu');
    check(await Q(page, () => { const m = document.querySelector('#menu'); return [...m.querySelectorAll('button')].every((b) => b.getBoundingClientRect().height >= 34); }), 'menu buttons are finger-sized');
    await shot(page, `phone-${w}x${h}-menu`);
    check(await Q(page, () => { const c = document.querySelector('#menu [data-close]'); if (!c) return false; const r = c.getBoundingClientRect(); return r.height >= 34 && r.right <= innerWidth && r.bottom <= innerHeight; }), 'the menu has an on-screen Close button (the deck is under it)');
    await tapText('✕ Close');
    await until(page, () => !document.querySelector('#menu'), 'tapping Close closes the menu');
    await startBattle(page);
    await until(page, () => __ds.ui.battle.mode === 'main', 'the command window opens', 90000);
    check(await Q(page, () => { const c = document.getElementById('cmd').getBoundingClientRect(); const p = document.getElementById('party-hud').getBoundingClientRect(); return c.left >= 0 && c.bottom <= innerHeight + 1 && p.right <= innerWidth + 1 && p.bottom <= innerHeight + 1 && !(c.right > p.left && c.left < p.right && c.bottom > p.top && c.top < p.bottom); }), 'the command window and party panel fit and do not overlap');
    await shot(page, `phone-${w}x${h}-battle`);
    await playTurns(page, 'tap');
    await until(page, () => document.querySelector('#results'), 'Victory by taps', 150000);
    await tapText('Continue');
    await until(page, () => __ds.G.mode === 'field' && !__ds.G.battle, 'back to the field', 60000);
    reportErrors(`phone ${w}x${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1100, height: 650 }, { nostorage: true });
    check(await Q(page, () => { try { localStorage.getItem('x'); return false; } catch { return true; } }), 'storage really throws here');
    await clickText(page, 'New Game');
    await until(page, () => __ds.mode === 'play', 'the game starts without storage');
    await Q(page, () => { const G = __ds.G; for (let i = 0; i < 400 && G.scene; i++) { __ds.act(G, { type: 'advance' }); __ds.ff(0.3); } G.events.length = 0; if (G.scene) { G.scene = null; G.mode = 'field'; } __ds.ui.endLine(); });
    check(await Q(page, () => __ds.save() === false), 'saving fails quietly');
    await until(page, () => __ds.G.mode === 'field' && !__ds.G.warp && !__ds.G.pending && !__ds.G.scene, 'free to walk');
    await page.keyboard.press('Escape');
    await until(page, () => document.querySelector('#menu'), 'the menu still opens');
    await clickText(page, 'Save');
    await clickText(page, 'Save game');
    await until(page, () => [...document.querySelectorAll('.toast')].some((t) => /could not save/i.test(t.textContent)), 'the Save button says it could not save');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} finally { if (browser) await browser.close(); }
console.log(fails ? `\n${fails} FAILED` : '\nall browser checks passed');
process.exit(fails ? 1 : 0);
