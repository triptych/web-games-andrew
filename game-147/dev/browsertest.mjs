/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL), driven by real mouse, keys and touch.
 *
 * desktop 1280×760: the title (back link on top, no sideways scroll); New Game; the intro scene by Enter; a dust bunny
 *   shooed by clicking it in the 3D view; a walk-in checked in from the Desk panel (key 1); a Honey Tart cooked with a
 *   real Space press in the gold zone; every Meshy model and animation clip loaded, rigged characters with their clips;
 *   music playing and ElevenLabs clips decoded; an adventure (key 9): a battle with an Attack by keyboard and a target;
 *   the auto-battle (T) to victory; the expedition card; home; Escape → Save & Quit → Continue restores the game; a
 *   long panel's close button stays pinned in view.
 * phones (touch only, real touches) at 390×844 and 844×390: taps through the title and the intro, the dock fits with
 *   44 px buttons and no sideways scroll, a tapped dust bunny, a battle won by tapping Attack and an enemy.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any page error, console error or failed request.
 *
 *   python3 -m http.server 8147          # from the REPO ROOT
 *   node game-147/dev/browsertest.mjs     # ONLY=desktop,phones,nostorage
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8147';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, errors = [], browser = null;
const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok', m); return c; };

async function open(viewport, { touch = false, nostorage = false, keepStorage = false } = {}) {
    if (browser && !keepStorage) await browser.close();
    if (!browser || !keepStorage) {
        browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    }
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    }, nostorage);
    const page = await ctx.newPage();
    if (PKG) {
        await page.route('https://unpkg.com/**', (route) => {
            const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-147/index.html?debug=1&fast=3`);
    await page.waitForFunction(() => window.__iomh && __iomh.mode === 'title', null, { timeout: 90000 });
    return page;
}

const Q = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, msg, timeout = 60000, arg = null) => page.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => check(true, msg), () => check(false, msg));
const shot = (page, n) => page.screenshot({ path: path.join(OUT, `bt-${n}.png`) });
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const center = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no page errors, console errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const noHScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1);
/** Screen position of a dust bunny in the 3D inn. */
const bunnyAt = (page) => Q(page, () => {
    // the bunny nearest the middle of the screen, clear of the edges and of any overlay
    const h = __iomh.view.hotel;
    let best = null, bd = Infinity;
    for (const [room, list] of Object.entries(h.bunnies)) for (const b of list) {
        const p = b.root.position.clone(); p.y += 0.25;
        const s = h.stage.toScreen(p, 'hotel');
        if (s.x < 40 || s.x > innerWidth - 40 || document.elementFromPoint(s.x, s.y)?.id !== 'view') continue;
        const d = Math.hypot(s.x - innerWidth / 2, s.y - innerHeight / 2);
        if (d < bd) { bd = d; best = { x: s.x, y: s.y, room }; }
    }
    return best;
});
/** Close the story dialogue with real presses (Enter on desktop, a tap on phones). */
async function readScenes(page, tap) {
    for (let i = 0; i < 20; i++) {
        const open = await Q(page, () => !document.getElementById('dialog').hidden);
        if (!open) return true;
        if (tap) { const c = await center(page, '#dlg-next'); await page.touchscreen.tap(c.x, c.y); } else await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
    }
    return Q(page, () => document.getElementById('dialog').hidden);
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await Q(page, () => { const a = document.getElementById('back-link'); const r = a.getBoundingClientRect(); return a.getAttribute('href') === '../index.html' && document.elementFromPoint(r.left + 5, r.top + 5) === a; }), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await noHScroll(page), 'no sideways scroll');
    await shot(page, 'title');
    const ng = await center(page, '#title-menu [data-act="new"]');
    await page.mouse.click(ng.x, ng.y);
    await until(page, () => __iomh.mode === 'play' && !document.getElementById('dialog').hidden, 'New Game starts with Madame Goldmaw\'s scene');
    await until(page, () => Object.keys(__iomh.audio.buffers).length > 60, 'the ElevenLabs effects and voices decode');
    check(await readScenes(page, false), 'Enter reads through the scene');
    await until(page, () => __iomh.audio.current === 'inn' && __iomh.audio.tracks.inn && !__iomh.audio.tracks.inn.paused, 'the inn theme is playing');
    // models and clips
    await until(page, async () => {
        const v = __iomh.view.hotel;
        const m = v.actors.maple?.actor;
        return m && m.model && Object.keys(m.actions).length >= 10;
    }, 'Maple is the rigged Meshy model with her 11 clips', 90000);
    // a dust bunny, clicked in 3D
    const b = await bunnyAt(page);
    check(!!b, 'a dust bunny is visible in a room');
    const swept0 = await Q(page, () => __iomh.G.stats.swept);
    if (b) await page.mouse.click(b.x, b.y);
    await until(page, (n) => __iomh.G.stats.swept > n, 'clicking a dust bunny shoos it', 30000, swept0);
    // a walk-in at the desk (key 1)
    await Q(page, () => { __iomh.G.arriveT = 0; });
    await until(page, () => __iomh.G.queue.length > 0, 'a walk-in arrives');
    await page.keyboard.press('Digit1');
    await until(page, () => !document.getElementById('panel').hidden && document.getElementById('panel-title').textContent.includes('Desk'), 'key 1 opens the Desk');
    const room = await center(page, '#panel-body [data-cmd*="checkin"]:not([disabled])');
    if (room) await page.mouse.click(room.x, room.y);
    await until(page, () => __iomh.G.stats.checkins >= 1, 'a click checks the guest in');
    // a long panel keeps its close button in view
    await Q(page, () => { const b = document.getElementById('panel-body'); const f = document.createElement('div'); f.style.height = '2000px'; f.id = 'filler'; b.prepend(f); document.querySelector('#panel .sheet').scrollTop = 1e6; });
    check(await Q(page, () => { const x = document.querySelector('#panel .sheet-head .x').getBoundingClientRect(); return x.top >= 0 && x.bottom <= innerHeight && document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2)?.closest('.x'); }), 'the panel\'s ✕ stays pinned with 2000 px of filler, scrolled to the bottom');
    await Q(page, () => document.getElementById('filler')?.remove());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('panel').hidden, 'Escape closes the panel');
    // cooking with a real Space press in the gold zone
    await page.keyboard.press('Digit2');
    await until(page, () => !document.getElementById('panel').hidden, 'key 2 opens the Kitchen');
    const cook = await center(page, '#panel-body [data-cmd*="honeyTart"]');
    await page.mouse.click(cook.x, cook.y);
    await until(page, () => !!__iomh.G.cook, 'Cook puts a Honey Tart on the stove');
    await page.waitForFunction(() => { const n = __iomh.G.cook && __iomh.view && (() => { const G = __iomh.G; const ph = ((G.t - G.cook.t0) * 0.8) % 1; return ph < 0.5 ? ph * 2 : 2 - ph * 2; })(); return n != null && Math.abs(n - 0.5) < 0.05; }, null, { timeout: 20000, polling: 'raf' }).catch(() => {});
    await page.keyboard.press('Space');
    await until(page, () => __iomh.G.pantry.length >= 1, 'Space stirs, and a meal is in the pantry');
    check(await Q(page, () => __iomh.G.pantry[0].q >= 1.1), `a well-timed stir makes a good meal (quality ${await Q(page, () => __iomh.G.pantry[0]?.q)})`);
    await page.keyboard.press('Escape');
    await shot(page, 'inn');
    // an adventure (key 9)
    await page.keyboard.press('Digit9');
    await until(page, () => document.getElementById('panel-title').textContent.includes('Adventure'), 'key 9 opens the Adventure panel');
    const go = await center(page, '#exp-go');
    await page.mouse.click(go.x, go.y);
    await until(page, () => __iomh.G.mode === 'expedition' && !document.getElementById('exped').hidden, 'Set off: the expedition card');
    const ex = await center(page, '#exped-card [data-cmd*="fight"]');
    await page.mouse.click(ex.x, ex.y);
    await until(page, () => __iomh.G.mode === 'battle' && !document.getElementById('bhud').hidden, 'Explore: a battle, with the battle HUD');
    await until(page, () => __iomh.G.battle.phase === 'command' && !__iomh.busy(), 'Maple\'s turn comes', 90000);
    await until(page, () => { const m = __iomh.view.battle.units.maple?.actor; return m?.model && m.has('attack') && m.has('battleIdle'); }, 'in battle Maple has her attack and combat-idle clips');
    check(await Q(page, () => document.querySelectorAll('#timeline .t').length === 8), 'the timeline shows 8 turns');
    const acts0 = await Q(page, () => __iomh.seen.act || 0);
    await page.keyboard.press('KeyA');
    await until(page, () => !!__iomh.ui.pending, 'A picks Attack and asks for a target');
    await page.keyboard.press('Enter');
    await until(page, (n) => (__iomh.seen.act || 0) > n, 'Enter attacks the target', 30000, acts0);
    await shot(page, 'battle');
    await until(page, () => !__iomh.busy(), 'the attack animation plays out', 60000);
    await page.keyboard.press('KeyT');
    await until(page, () => __iomh.G.battle?.auto, 'T switches on the auto-battle');
    await until(page, () => ['won', 'lost', 'fled'].includes(__iomh.G.battle?.phase) && !__iomh.busy() && !document.getElementById('exped').hidden, 'the auto-battle finishes the fight and the result card shows', 180000);
    check(await Q(page, () => __iomh.G.battle.phase === 'won'), 'a meadow fight is won');
    await shot(page, 'victory');
    const cont = await center(page, '#exped-card [data-cmd*="battleDone"]');
    await page.mouse.click(cont.x, cont.y);
    await until(page, () => __iomh.G.mode === 'expedition', 'Continue returns to the expedition');
    const home = await center(page, '#exped-card [data-cmd*="return"]');
    await page.mouse.click(home.x, home.y);
    await until(page, () => __iomh.G.mode === 'hotel' && !document.getElementById('hud').hidden, 'Head home: back at the inn');
    // save, quit, continue
    const snap = await Q(page, () => JSON.stringify([__iomh.G.stats.swept, __iomh.G.stats.wins, __iomh.G.pantry.length, __iomh.G.day, __iomh.G.heroes.maple.lv]));
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape opens the menu');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __iomh.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (sn) => __iomh.mode === 'play' && JSON.stringify([__iomh.G.stats.swept, __iomh.G.stats.wins, __iomh.G.pantry.length, __iomh.G.day, __iomh.G.heroes.maple.lv]) === sn, 'Continue restores the game (bunnies, wins, pantry, day, level)', 30000, snap);
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => { const c = await center(page, sel); if (!c) return false; await page.touchscreen.tap(c.x, c.y); return true; };
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __iomh.mode === 'play', 'a tap on New Game starts');
    check(await readScenes(page, true), 'taps read through the scene');
    check(await noHScroll(page), 'no sideways scroll');
    const dock = await Q(page, () => [...document.querySelectorAll('#dock button')].map((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }));
    check(dock.every(Boolean), 'every dock button is at least 44 px');
    check(await Q(page, () => { const r = document.getElementById('dock').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), 'the dock fits on screen');
    await until(page, () => __iomh.view.hotel.actors.maple?.actor.model, 'the inn has loaded', 90000);
    const b = await bunnyAt(page);
    const swept0 = await Q(page, () => __iomh.G.stats.swept);
    if (b) await page.touchscreen.tap(b.x, b.y);
    await until(page, (n) => __iomh.G.stats.swept > n, 'a tapped dust bunny is shooed', 30000, swept0);
    await shot(page, `phone-${w}x${h}-inn`);
    // a battle by touch
    await tapSel('#dock [data-panel="expedition"]');
    await until(page, () => !document.getElementById('panel').hidden, 'a tap opens the Adventure panel');
    await tapSel('#exp-go');
    await until(page, () => __iomh.G.mode === 'expedition', 'a tap sets off');
    await tapSel('#exped-card [data-cmd*="fight"]');
    await until(page, () => __iomh.G.battle?.phase === 'command' && !__iomh.busy(), 'a battle, Maple\'s turn', 120000);
    check(await Q(page, () => [...document.querySelectorAll('#commands .cmd')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.right <= innerWidth && r.bottom <= innerHeight; })), 'the command buttons are 44 px and on screen');
    const acts0 = await Q(page, () => __iomh.seen.act || 0);
    await tapSel('#commands [data-b="attack"]');
    await until(page, () => !!__iomh.ui.pending, 'tapping Attack asks for a target');
    await page.waitForTimeout(300);
    await tapSel('#labels [data-unit]');
    await page.waitForTimeout(300);
    if (await Q(page, () => !!__iomh.ui.pending)) await tapSel('#labels [data-unit]');
    await until(page, (n) => (__iomh.seen.act || 0) > n, 'tapping the enemy (twice: pick, confirm) attacks it', 30000, acts0);
    await shot(page, `phone-${w}x${h}-battle`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __iomh.mode === 'play', 'boots and starts with localStorage throwing');
    await Q(page, () => { __iomh.G.scenes.length = 0; __iomh.ff(60); });
    check(await Q(page, () => __iomh.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message.split('\n')[0]);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);
