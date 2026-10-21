/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game by
 *   click, pick the Ranger, type a name → Space rolls the dice and the token walks → every decision
 *   card answered by clicking its buttons for several turns → a town by landing: buy a potion,
 *   every tab, leave → a battle: Attack through the menu and a target marker, a skill submenu by
 *   keyboard, then Auto to the win → the reward card → back on the island → tap a tile for its
 *   card → the map → Escape pauses and Space presses Resume → Save & Quit → Continue restores it →
 *   the dragon, won with Auto → the ending and its rank → Play again.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the ROLL
 *   button and the menu are at least 44 px and on screen, a roll by tap, a battle by tapping the
 *   menu and a target, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8089          # from the REPO ROOT
 *   node game-089/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8089), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8089';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!sessionStorage.getItem('bt-cleared')) { try { localStorage.clear(); sessionStorage.setItem('bt-cleared', '1'); } catch { /* */ } }
    }, nostorage);
    const page = await ctx.newPage();
    if (PKG) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-089/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__dr && __dr.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for frames to settle, which SwiftShader never does: click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const idle = (page, timeout = 60000) => page.waitForFunction(() => !__dr.busy, null, { timeout, polling: 150 }).catch(() => {});
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('view').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

/** Answer whatever card is showing by clicking its primary (or first) button. */
const answer = (page) => Q(page, () => {
    const P = document.getElementById('panel');
    if (!P.hidden) { const b = P.querySelector('.btn.primary:not(:disabled)') || P.querySelector('.btn:not(:disabled)'); if (b) { b.click(); return 'panel'; } }
    if (!document.getElementById('town').hidden) { document.getElementById('town-leave').click(); return 'town'; }
    if (__dr.phase === 'battle') { if (document.getElementById('b-auto').getAttribute('aria-pressed') !== 'true') document.getElementById('b-auto').click(); return 'battle'; }
    return null;
});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden && document.getElementById('btn-continue').hidden), 'the title, with no Continue before a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'New Game opens hero selection');
    await click(page, '.cls[data-cls="ranger"]');
    await page.fill('#hero-name', 'Wren');
    await shot(page, 'desktop-newgame');
    await click(page, '#btn-start');
    await until(page, () => __dr.mode === 'game' && __dr.G.cls === 'ranger' && __dr.G.heroName === 'Wren', 'Begin starts a Ranger called Wren');
    await until(page, () => !document.getElementById('hud').hidden && !document.getElementById('btn-roll').disabled, 'the board HUD and an enabled ROLL button');
    await shot(page, 'desktop-board');

    // a roll by the real Space key
    await Q(page, () => document.activeElement?.blur());
    await page.keyboard.press('Space');
    await until(page, () => __dr.seen.dice >= 1 && __dr.seen.step >= 2, 'Space rolls the dice and the token walks');
    await idle(page);
    // answer cards for a few turns
    const kinds = new Set();
    for (let i = 0; i < 60 && (await Q(page, () => __dr.G.turn)) < 4; i++) {
        await idle(page);
        const ph = await Q(page, () => __dr.phase);
        kinds.add(ph);
        if (ph === 'roll') { await click(page, '#btn-roll'); continue; }
        await answer(page);
        await page.waitForTimeout(150);
    }
    check(await Q(page, () => __dr.G.turn >= 4), `three turns played by clicking (${[...kinds].join(', ')})`);
    await Q(page, () => { document.getElementById('b-auto').getAttribute('aria-pressed') === 'true' && document.getElementById('b-auto').click(); });

    // a town, by landing on it
    await idle(page);
    await Q(page, () => { const G = __dr.G; G.roamers.length = 0; G.pos = 3; G.bag.items.die = 1; G.gold = 600; __dr.ui.refresh(G); });
    await Q(page, () => __dr.act({ type: 'roll', item: 'die', pick: 2 }));
    await until(page, () => !__dr.busy && __dr.phase === 'town' && !document.getElementById('town').hidden, 'landing on Brookhollow opens the town');
    const pots = await Q(page, () => __dr.G.bag.items.potion || 0);
    await Q(page, () => [...document.querySelectorAll('#town-sheet .item-row')].find((r) => r.textContent.includes('Potion'))?.querySelector('button').click());
    check(await Q(page, (n) => (__dr.G.bag.items.potion || 0) === n + 1, pots), 'buying a potion by click');
    for (const tab of ['Inn', 'Tavern', 'Forge']) {
        await Q(page, (t) => [...document.querySelectorAll('#town-sheet .tabs button')].find((b) => b.textContent.includes(t)).click(), tab);
        check(await Q(page, (t) => document.querySelector('#town-sheet .tabs button[aria-pressed="true"]').textContent.includes(t), tab), `the ${tab} tab`);
    }
    await Q(page, () => [...document.querySelectorAll('#town-sheet .tabs button')].find((b) => b.textContent.includes('Tavern')).click());
    const hired = await Q(page, () => { const b = [...document.querySelectorAll('#town-sheet .btn.primary')].find((x) => x.textContent.includes('Hire')); if (!b) return false; b.click(); return true; });
    check(hired && await Q(page, () => __dr.G.party.some((m) => m.id === 'pip')), 'hiring Pip at the tavern');
    await shot(page, 'desktop-town');
    await click(page, '#town-leave');
    await until(page, () => __dr.phase === 'roll' && document.getElementById('town').hidden, 'Leave town ends the turn');

    // a battle by hand
    await idle(page);
    await Q(page, () => __dr.fight(['slime', 'goblin'], 2));
    await until(page, () => !__dr.busy && __dr.phase === 'battle' && !document.getElementById('cmd').hidden, 'a battle shows the command menu');
    await until(page, () => __dr.view.inBattle && !document.getElementById('bhud').hidden, 'on the battle field');
    await shot(page, 'desktop-battle');
    await Q(page, () => [...document.querySelectorAll('#cmd button')].find((b) => b.textContent.includes('Attack')).click());
    await until(page, () => document.querySelectorAll('#markers .marker').length >= 1 && !document.getElementById('target-hint').hidden, 'Attack asks for a target');
    const hits = await Q(page, () => __dr.seen.b_hit || 0);
    await click(page, '#markers .marker');
    await until(page, (n) => (__dr.seen.b_hit || 0) > n, 'tapping a target marker attacks it', 60000, hits);
    // the skills menu by keyboard
    await page.waitForFunction(() => (!__dr.busy && __dr.phase === 'battle' && !document.getElementById('cmd').hidden) || __dr.phase !== 'battle', null, { timeout: 60000 });
    if (await Q(page, () => __dr.phase === 'battle')) {
        await Q(page, () => [...document.querySelectorAll('#cmd button')].find((b) => b.textContent.includes('Skills'))?.focus());
        await page.keyboard.press('Enter');
        await until(page, () => [...document.querySelectorAll('#cmd button')].some((b) => b.textContent.includes('Back')), 'Enter on Skills opens the skill list');
        await page.keyboard.press('Escape');
        await until(page, () => [...document.querySelectorAll('#cmd button')].some((b) => b.textContent.includes('Attack')), 'Escape goes back to the main menu');
        await click(page, '#b-auto');
    }
    await until(page, () => __dr.phase === 'reward' && !__dr.busy && !document.getElementById('panel').hidden, 'Auto wins the battle and shows the reward card', 120000);
    await shot(page, 'desktop-reward');
    await Q(page, () => { document.getElementById('b-auto').getAttribute('aria-pressed') === 'true' && document.getElementById('b-auto').click(); });
    await click(page, '#panel .btn.primary');
    await until(page, () => !__dr.busy && __dr.phase === 'roll' && !__dr.view.inBattle, 'Continue goes back to the island');

    // a tile card and the map
    const tile = await Q(page, () => { const p = __dr.view.board.island.tiles[(__dr.G.pos + 2) % 40].grp.position.clone(); p.y += 0.5; const v = p.project(__dr.view.board.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; });
    await page.mouse.click(tile.x, tile.y);
    await until(page, () => !document.getElementById('tile-card').hidden, 'clicking a tile shows what it is');
    await click(page, '#btn-map');
    await until(page, () => __dr.view.board.mode === 'overview', 'Map shows the whole island');
    await page.waitForTimeout(800);
    await shot(page, 'desktop-map');
    await click(page, '#btn-map');

    // pause with Escape, resume with a real Space on the focused button
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button');

    // Save & Quit, then Continue
    const state = await Q(page, () => ({ turn: __dr.G.turn, gold: __dr.G.gold, pos: __dr.G.pos }));
    await click(page, '#btn-menu');
    await until(page, () => !document.getElementById('pause').hidden, 'the ☰ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __dr.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __dr.mode === 'game' && __dr.G.turn === s.turn && __dr.G.gold === s.gold && __dr.G.pos === s.pos, 'Continue restores the game', 60000, state);

    // the dragon
    await idle(page);
    await Q(page, () => __dr.dragon(26));
    await until(page, () => !__dr.busy && __dr.phase === 'battle' && __dr.G.battle.kind === 'dragon', 'the dragon fight begins', 90000);
    await shot(page, 'desktop-dragon');
    await click(page, '#b-auto');
    await until(page, () => __dr.mode === 'over' && !document.getElementById('over').hidden, 'Auto slays Pyrrhax and the ending shows', 240000);
    check(await Q(page, () => /RANK/.test(document.getElementById('over-sheet').textContent)), 'the ending has a rank');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __dr.mode === 'game' && __dr.G.turn === 1 && __dr.phase === 'roll', 'Play again starts a fresh game');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    void cdp;
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = typeof s === 'string' ? document.querySelector(s) : null; e?.scrollIntoView({ block: 'center' }); e?.getAnimations?.({ subtree: true }).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity).forEach((a) => a.finish()); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'a tap on New Game opens hero selection');
    await tapSel('.cls[data-cls="mage"]');
    await tapSel('#btn-start');
    await until(page, () => __dr.mode === 'game' && __dr.G.cls === 'mage', 'a tap on Begin starts a Mage');
    await idle(page);
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-roll', '#btn-menu', '#btn-party', '#btn-map'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    await shot(page, `phone-${w}x${h}-board`);
    await tapSel('#btn-roll');
    await until(page, () => __dr.seen.dice >= 1, 'a tap on ROLL rolls');
    await idle(page);
    // whatever card came up fits on screen and its buttons can be tapped
    const card = await Q(page, () => {
        const P = document.getElementById('panel');
        if (P.hidden) return null;
        P.getAnimations({ subtree: true }).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity).forEach((a) => a.finish());
        const r = P.getBoundingClientRect();
        const bs = [...P.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
        return { inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1, big: bs.every((b) => b.height >= 44) };
    });
    if (card) { check(card.inside, 'the decision card is on screen'); check(card.big, 'and its buttons are finger-sized'); }
    // a battle by touch
    await Q(page, () => { if (!document.getElementById('town').hidden) document.getElementById('town-leave').click(); });
    await idle(page);
    await Q(page, () => { __dr.G.phase = 'roll'; __dr.G.ctx = {}; __dr.fight(['slime'], 1); });
    await until(page, () => !__dr.busy && __dr.phase === 'battle' && !document.getElementById('cmd').hidden, 'a battle shows the command menu');
    const cmdOk = await Q(page, () => { const r = document.getElementById('cmd').getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0 && r.top >= 0; });
    check(cmdOk, 'the command menu is on screen');
    await shot(page, `phone-${w}x${h}-battle`);
    const attack = await Q(page, () => { const b = [...document.querySelectorAll('#cmd button')].find((x) => x.textContent.includes('Attack')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(attack.x, attack.y);
    await until(page, () => document.querySelectorAll('#markers .marker').length >= 1, 'tapping Attack asks for a target');
    const hits = await Q(page, () => __dr.seen.b_hit || 0);
    const mk = await Q(page, () => { const r = document.querySelector('#markers .marker').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(mk.x, mk.y);
    await until(page, (n) => (__dr.seen.b_hit || 0) > n, 'tapping the target marker attacks', 60000, hits);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __dr.start(5));
    await until(page, () => __dr.mode === 'game', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __dr.act({ type: 'roll' }));
    await until(page, () => __dr.seen.dice >= 1, 'and rolls');
    check(await Q(page, () => __dr.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);
