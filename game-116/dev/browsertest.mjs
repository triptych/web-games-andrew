/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Run by
 *   click → the reel card → the map by real keys (→, Enter) → a fight: a real mouse click plays a
 *   card that fits, D draws, E ends the turn, 1 fires a gadget → Escape pauses, Space presses the
 *   focused Resume button → Save & Quit → Continue restores the fight → the reward panel by click →
 *   a lost run shows THE END. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the map,
 *   a tap plays a card and draws, every control ≥ 44 px and on screen, the table clear of the bar,
 *   ❚❚ opens the intermission and it stays open when the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8116          # from the REPO ROOT
 *   node game-116/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8116), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8116';
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
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-116/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__sfos && __sfos.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const idle = (page) => page.waitForFunction(() => !__sfos.busy, null, { timeout: 30000, polling: 50 }).catch(() => {});
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
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
/** The centre of the first canvas hit that matches, in client px. */
const hitCentre = (page, pred) => Q(page, (src) => {
    const f = new Function('h', `return (${src})(h)`);
    const h = __sfos.view.hits.find((x) => f(x));
    if (!h) return null;
    const r = document.getElementById('view').getBoundingClientRect();
    return { x: r.left + h.x + h.w / 2, y: r.top + h.y + h.h / 2, key: h.key };
}, pred.toString());
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const panelButton = (page, text) => Q(page, (t) => {
    const b = [...document.querySelectorAll('#panel-sheet button')].find((x) => x.textContent.includes(t) && !x.disabled);
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, text);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden && document.getElementById('btn-continue').hidden), 'title screen is up, no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => document.querySelectorAll('#over-title').length === 0), 'no button id collides with a11y heading ids');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sfos.mode === 'play' && !document.getElementById('panel').hidden && __sfos.G.phase === 'intro', 'New Run shows the reel card');
    await shot(page, 'desktop-intro');
    let p = await panelButton(page, 'Roll the film');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __sfos.G.phase === 'map' && document.getElementById('panel').hidden, 'Roll the film opens the map');
    await idle(page);
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await until(page, () => __sfos.G.phase === 'battle', 'real keys pick a stop on the map and start a fight');
    await idle(page);
    await shot(page, 'desktop-fight');

    // play a card by a real mouse click (drawing until one fits)
    for (let i = 0; i < 6; i++) {
        await idle(page);
        await page.waitForTimeout(120);
        const c = await hitCentre(page, (h) => h.kind === 'card' && h.ok);
        if (c) {
            const played = await Q(page, () => __sfos.G.stats.played);
            await page.mouse.click(c.x, c.y);
            await until(page, (n) => __sfos.G.stats.played > n, 'a mouse click plays a card that fits the beam', 15000, played);
            break;
        }
        await page.keyboard.press('KeyD');
        await page.waitForTimeout(200);
        if (i === 5) check(false, 'found a card to play');
    }
    await idle(page);
    const draws = await Q(page, () => __sfos.G.stats.draws);
    await Q(page, () => { const B = __sfos.G.battle; B.draws = 2; B.enemy.hp = 999; B.enemy.maxHp = 999; });
    await page.keyboard.press('KeyD');
    await until(page, (n) => __sfos.G.stats.draws > n, 'D draws a card', 15000, draws);
    await idle(page);
    const turn = await Q(page, () => __sfos.G.battle.turn);
    await page.keyboard.press('KeyE');
    await until(page, (t) => __sfos.G.battle.turn > t, 'E ends the turn and the creature moves', 15000, turn);
    await idle(page);
    await Q(page, () => { __sfos.G.battle.charge = 9; });
    await page.waitForTimeout(150);     // a frame, so the gadget button sees the charge
    await page.keyboard.press('Digit1');
    await until(page, () => (__sfos.seen.gadget || 0) >= 1, '1 fires the first gadget');
    await idle(page);

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape opens the intermission');
    await page.waitForTimeout(200);
    check(await Q(page, () => document.activeElement?.dataset?.act === 'resume'), 'Resume has the focus');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button');

    await page.keyboard.press('KeyP');
    await until(page, () => !document.getElementById('pause').hidden, 'P pauses too');
    const ehp = await Q(page, () => __sfos.G.battle.enemy.hp);
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __sfos.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (h) => __sfos.mode === 'play' && __sfos.G.phase === 'battle' && __sfos.G.battle.enemy.hp === h, 'Continue restores the fight', 30000, ehp);

    // win it, then the reward panel by click
    await Q(page, () => { const B = __sfos.G.battle; B.enemy.hp = 1; B.enemy.block = 0; B.charge = 9; });
    await page.waitForTimeout(150);
    await page.keyboard.press('Digit1');
    await until(page, () => __sfos.G.phase === 'reward' && !document.getElementById('panel').hidden, 'winning shows the reward panel');
    await page.waitForTimeout(200);
    await shot(page, 'desktop-reward');
    const deck = await Q(page, () => __sfos.G.deck.length);
    p = await Q(page, () => { const b = document.querySelector('#panel-sheet .item.card'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(p.x, p.y);
    await until(page, (n) => __sfos.G.deck.length === n + 1, 'clicking a card adds it to the deck', 15000, deck);
    p = await panelButton(page, 'Onward') || await panelButton(page, 'Skip');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __sfos.G.phase === 'map', 'Onward goes back to the map');
    await page.waitForTimeout(200);
    await shot(page, 'desktop-map');

    // the deck viewer
    await page.click('#btn-deck', { noWaitAfter: true, timeout: 5000 }).catch(() => click(page, '#btn-deck'));
    await until(page, () => !document.getElementById('deck').hidden && document.querySelectorAll('#deck-body .item').length > 10, 'the deck viewer lists cards, gadgets and souvenirs');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('deck').hidden, 'Escape closes it');

    // lose
    await Q(page, () => __sfos.ff(60, (g) => g.phase === 'battle'));
    await until(page, () => __sfos.G.phase === 'battle', 'into another fight');
    await Q(page, () => { const G = __sfos.G; G.hp = 1; G.battle.block = 0; G.battle.enemy.intent = { t: 'atk', n: 99, hits: 1 }; });
    await idle(page);
    await page.keyboard.press('KeyE');
    await until(page, () => __sfos.mode === 'over' && !document.getElementById('over').hidden, 'losing every HP shows THE END');
    await shot(page, 'desktop-over');
    check(await Q(page, () => !__sfos.hasSave()), 'a lost run deletes its save');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapAt = (x, y) => page.touchscreen.tap(x, y);
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await tapAt(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __sfos.G?.phase === 'intro' && !document.getElementById('panel').hidden, 'a tap on New Run shows the reel card');
    await page.waitForTimeout(250);
    const p = await panelButton(page, 'Roll the film');
    await tapAt(p.x, p.y);
    await until(page, () => __sfos.G.phase === 'map', 'a tap rolls the film');
    await idle(page);
    await page.waitForTimeout(200);
    await shot(page, `phone-${w}x${h}-map`);
    const nodes = await Q(page, () => __sfos.view.hits.filter((x) => x.kind === 'node').map((x) => ({ w: x.w, h: x.h, x: x.x, y: x.y })));
    check(nodes.length >= 2 && nodes.every((n) => n.w >= 44 && n.h >= 44 && n.x >= 0 && n.y >= 0 && n.x + n.w <= w + 1 && n.y + n.h <= h + 1), 'map stops are at least 44 px and on screen');
    const n = await hitCentre(page, (x) => x.kind === 'node');
    await tapAt(n.x, n.y);
    await until(page, () => __sfos.G.phase === 'battle', 'a tap on a stop starts a fight');
    await idle(page);
    await page.waitForTimeout(300);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const geo = await Q(page, () => {
        const v = __sfos.view, Lt = v.L;
        const cards = v.hits.filter((x) => x.kind === 'card');
        const ctrls = v.hits.filter((x) => x.kind === 'gadget' || x.key === 'btn' || x.key === 'draw');
        const on = (r) => r.x >= -1 && r.y >= -1 && r.x + r.w <= innerWidth + 1 && r.y + r.h <= innerHeight + 1;
        return {
            cardsOn: cards.length > 0 && cards.every(on),
            cardsClear: cards.every((c) => c.y + c.h <= Lt.bar.y + 4),
            ctrls: ctrls.map((c) => ({ k: c.key, ok: c.w >= 44 && c.h >= 44 && on(c) })),
            hud: ['#btn-pause', '#btn-deck'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { k: s, ok: r.width >= 44 && r.height >= 44 && on({ x: r.left, y: r.top, w: r.width, h: r.height }) }; }),
        };
    });
    check(geo.cardsOn, 'every face-up table card is on screen');
    check(geo.cardsClear, 'the table stays clear of the bar');
    for (const c of [...geo.ctrls, ...geo.hud]) check(c.ok, `${c.k} is at least 44 px and on screen`);
    await shot(page, `phone-${w}x${h}-fight`);

    // a tap plays a card (or draws until one fits)
    let played = false;
    for (let i = 0; i < 6 && !played; i++) {
        await idle(page);
        await page.waitForTimeout(120);
        const c = await hitCentre(page, (x) => x.kind === 'card' && x.ok);
        if (c) {
            const before = await Q(page, () => __sfos.G.stats.played);
            await tapAt(c.x, c.y);
            await until(page, (k) => __sfos.G.stats.played > k, 'a tap plays a card that fits', 15000, before);
            played = true;
        } else {
            await Q(page, () => { __sfos.G.battle.draws = 2; });
            const d = await hitCentre(page, (x) => x.key === 'btn');
            await tapAt(d.x, d.y);
            await page.waitForTimeout(200);
        }
    }
    if (!played) check(false, 'found a card to tap');
    await idle(page);
    await Q(page, () => { __sfos.G.battle.draws = 2; });
    await page.waitForTimeout(100);
    const before = await Q(page, () => __sfos.G.stats.draws);
    const d = await hitCentre(page, (x) => x.key === 'btn');
    await tapAt(d.x, d.y);
    await until(page, (k) => __sfos.G.stats.draws > k, 'a tap on DRAW draws', 15000, before);
    await idle(page);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ opens the intermission');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'it stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // the reward panel fits and works by touch
    await Q(page, () => { const B = __sfos.G.battle; B.enemy.hp = 1; B.enemy.block = 0; B.charge = 9; });
    const g = await hitCentre(page, (x) => x.key === 'gadget:0');
    await tapAt(g.x, g.y);
    await until(page, () => __sfos.G.phase === 'reward' && !document.getElementById('panel').hidden, 'a tap on the Ray Pistol wins the fight');
    await page.waitForTimeout(300);
    await shot(page, `phone-${w}x${h}-reward`);
    const items = await Q(page, () => [...document.querySelectorAll('#panel-sheet button')].map((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1; }));
    check(items.length > 0 && items.every(Boolean), 'reward buttons are at least 44 px and inside the screen');
    const on = await panelButton(page, 'Skip') || await panelButton(page, 'Onward');
    await tapAt(on.x, on.y);
    await until(page, () => __sfos.G.phase === 'map', 'a tap leaves the reward panel');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sfos.mode === 'play', 'boots and starts a run with localStorage throwing');
    await Q(page, () => __sfos.ff(40));
    check(await Q(page, () => __sfos.save() === false), 'saving fails quietly');
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
