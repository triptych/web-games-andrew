/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Campaign by a
 *   click → the map → a real click on the first node → deployment: a real mouse click picks a stack
 *   and another places it → Begin → a click selects a stack and a click on a gold hex moves it → a
 *   card from the hand, a click on a foe shows the forecast, a second click attacks → E ends the turn,
 *   the foe moves and turn 2 begins → Escape pauses and the foe's turn stands still → Save & Quit →
 *   Continue restores the battle → the bot wins it → the spoils: take a card, Space on Onward → the
 *   map moves on. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title and the
 *   map, every control ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible
 *   viewport, a tap on a sample of hexes picks that hex, select and move by touch, a card and a
 *   two-tap attack by touch, the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays a battle.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8112          # from the REPO ROOT
 *   node game-112/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8112), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8112';
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
        else try { localStorage.clear(); } catch { /* */ }
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.gstatic')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-112/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__ql && __ql.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 40000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// the view has caught up with the sim
const idle = (page, timeout = 40000) => page.waitForFunction(() => __ql.G && __ql.G.events.length === 0 && __ql.idle(), null, { timeout, polling: 100 });
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
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const hexAt = (page, c, r) => Q(page, ([c2, r2]) => __ql.screenOf(c2, r2), [c, r]);
const centerOf = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
/** A foe the selected card can hit, and an own stack that can move somewhere, from the live battle. */
const pickFoe = (page) => Q(page, () => { const B = __ql.G.battle; const f = B.stacks.find((s) => s.side === 'e'); return f ? [f.c, f.r] : null; });

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'the title is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    // Space on the focused button (New Campaign) must press it
    await Q(page, () => document.querySelector('#title-menu [data-act="new"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => __ql.mode === 'run' && __ql.G.screen === 'map' && !document.getElementById('map').hidden, 'Space on New Campaign opens the map');
    await shot(page, 'desktop-map');
    const node = await centerOf(page, '#map-svg .node.next');
    await page.mouse.click(node.x, node.y);
    await until(page, () => __ql.G.screen === 'battle' && __ql.G.battle.phase === 'deploy', 'a click on a map node starts a skirmish in deployment');
    await idle(page);

    // deployment by mouse
    const st = await Q(page, () => { const s = __ql.G.battle.stacks.find((x) => x.side === 'p'); return { id: s.id, c: s.c, r: s.r }; });
    let p = await hexAt(page, st.c, st.r);
    await page.mouse.click(p.x, p.y);
    await until(page, (id) => __ql.play.sel === id, 'a click picks one of your stacks', 20000, st.id);
    const free = await Q(page, () => { const B = __ql.G.battle; for (let r = 0; r < B.rows; r++) for (let c = 0; c < 2; c++) if (!B.stacks.some((s) => s.c === c && s.r === r) && !B.rocks.includes(c * 16 + r)) return [c, r]; return null; });
    p = await hexAt(page, free[0], free[1]);
    await page.mouse.click(p.x, p.y);
    await until(page, ([id, c, r]) => { const s = __ql.stack(id); return s.c === c && s.r === r; }, 'a click on a hex of your lines places it there', 20000, [st.id, free[0], free[1]]);
    await click(page, '#btn-begin');
    await until(page, () => __ql.G.battle.phase === 'player' && __ql.G.battle.hand.length === 5, 'Begin: turn 1, five cards in hand');
    await idle(page);
    check(await Q(page, () => document.querySelectorAll('#hand .card').length === 5), 'the hand shows five cards');
    check(await Q(page, () => document.querySelectorAll('#labels .tag .intent:not([hidden])').length >= 1), 'foes show their intents');

    // a free move by mouse
    const mv = await Q(page, () => {
        const B = __ql.G.battle;
        const s = B.stacks.find((x) => x.side === 'p' && !x.moved);
        return { id: s.id, c: s.c, r: s.r };
    });
    p = await hexAt(page, mv.c, mv.r);
    await page.mouse.click(p.x, p.y);
    await until(page, (id) => __ql.play.sel === id && __ql.view.hl.some((h) => h.visible && h.userData.kind === 'move'), 'clicking your stack shows its gold move hexes', 20000, mv.id);
    const dest = await Q(page, (id) => { const B = __ql.G.battle; const h = __ql.view.hl.find((x) => x.visible && x.userData.kind === 'move'); const s = __ql.stack(id); void B; void s; return h ? __ql.view.stage.toScreen(h.position) : null; }, mv.id);
    await page.mouse.click(dest.x, dest.y);
    await until(page, (id) => __ql.stack(id).moved, 'a click on a gold hex moves it (the free move)', 20000, mv.id);
    await idle(page);

    // a card and an aimed attack: forecast, then the order
    const before = await Q(page, () => __ql.seen.attack || 0);
    const ci = await Q(page, () => { const B = __ql.G.battle; const i = B.hand.findIndex((c) => ['strike', 'firebolt'].includes(c.id) && document.querySelector(`#hand .card[data-uid="${c.uid}"]:not(.no)`)); return i; });
    if (check(ci >= 0, 'there is an attack or a spell to play')) {
        await page.keyboard.press(`Digit${ci + 1}`);
        await until(page, () => __ql.play.card != null, `key ${ci + 1} picks the card`);
        // if the card needs an actor, click the first green one
        const needActor = await Q(page, () => { const h = __ql.view.hl.find((x) => x.visible && x.userData.kind === 'ally'); return __ql.play.actor == null && h ? __ql.view.stage.toScreen(h.position) : null; });
        if (needActor) await page.mouse.click(needActor.x, needActor.y);
        const tgt = await Q(page, () => { const h = __ql.view.hl.find((x) => x.visible && x.userData.kind === 'attack'); return h ? __ql.view.stage.toScreen(h.position) : null; });
        if (check(!!tgt, 'the card highlights a foe to hit')) {
            await page.mouse.click(tgt.x, tgt.y);
            await until(page, () => !document.getElementById('forecast').hidden && __ql.play.pending, 'the first click shows the forecast');
            await shot(page, 'desktop-forecast');
            await page.mouse.click(tgt.x, tgt.y);
            await until(page, (n) => (__ql.seen.attack || 0) + (__ql.seen.spell || 0) > n, 'the second click gives the order', 30000, before);
        }
    }
    await idle(page);
    await shot(page, 'desktop-battle');

    // end the turn: the foe moves, turn 2 begins
    await page.mouse.move(5, 300);
    await page.keyboard.press('KeyE');
    await until(page, () => __ql.G.battle && (__ql.G.battle.phase === 'enemy' || __ql.G.battle.turn >= 2 || __ql.G.battle.over), 'E ends the turn');
    await until(page, () => !__ql.G.battle || __ql.G.battle.turn >= 2 || __ql.G.battle.over, 'the foe moves and turn 2 begins', 60000);
    await idle(page);

    // pause holds the foe still
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => __ql.G.battle?.phase === 'enemy' || __ql.G.battle?.over, null, { timeout: 20000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const eq = await Q(page, () => JSON.stringify(__ql.G.battle?.eq || []));
    await page.waitForTimeout(800);
    check(await Q(page, (q) => JSON.stringify(__ql.G.battle?.eq || []) === q, eq), 'the foe\'s turn stands still while paused');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ql.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    const turn = await Q(page, () => JSON.parse(localStorage.getItem('quill-legion.v1')).data.battle?.turn);
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (t) => __ql.mode === 'run' && __ql.G.screen === 'battle' && __ql.G.battle.turn === t, 'Continue restores the battle', 30000, turn);
    await idle(page);

    // the bot wins it; the spoils
    await Q(page, () => { const B = __ql.G.battle; for (const s of B.stacks) if (s.side === 'e') { s.count = 1; s.top = 1; } __ql.ff(); });
    await until(page, () => __ql.G.screen === 'reward' && !document.getElementById('reward').hidden, 'winning opens the spoils', 40000);
    await shot(page, 'desktop-reward');
    const deck0 = await Q(page, () => __ql.G.deck.length);
    await click(page, '#reward-body .card[data-i="0"]');
    await until(page, (n) => __ql.G.deck.length === n + 1, 'taking a card adds it to the deck', 20000, deck0);
    await Q(page, () => document.getElementById('btn-reward-go').focus());
    await page.keyboard.press('Space');
    await until(page, () => ['map', 'boon'].includes(__ql.G.screen), 'Space on Onward goes back to the road');
    check(await Q(page, () => __ql.G.map.visited.length === 1 && document.querySelectorAll('#map-svg .node.next').length >= 1), 'the map has moved on one floor');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touchAt = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const tapSel = async (sel) => { const r = await centerOf(page, sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ql.G?.screen === 'map', 'a tap on New Campaign opens the map');
    check((await layout(page)).noHScroll, 'the map has no sideways scroll');
    await tapSel('#map-svg .node.next');
    await until(page, () => __ql.G.screen === 'battle', 'a tap on a map node starts the battle');
    await idle(page);
    await tapSel('#btn-begin');
    await until(page, () => __ql.G.battle.phase === 'player', 'a tap on Begin starts the fight');
    await idle(page);
    await page.waitForTimeout(400);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-end', '#btn-pause', '#btn-draw', '#btn-disc'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const cardsOk = await Q(page, () => [...document.querySelectorAll('#hand .card')].every((c) => { const r = c.getBoundingClientRect(); return r.width >= 44 && r.bottom <= innerHeight + 4 && r.top >= 0; }));
    check(cardsOk, 'every card is on screen and finger-sized');
    await shot(page, `phone-${w}x${h}`);

    // a tap on a sample of hexes picks that hex
    let picked = 0, tried = 0;
    for (const [c, r] of [[0, 0], [8, 5], [4, 2], [2, 4], [7, 1], [1, 3]]) {
        const p = await hexAt(page, c, r);
        if (p.x < 0 || p.y < 60 || p.x > w || p.y > h - 150) continue;
        tried++;
        const hit = await Q(page, ([x, y]) => __ql.view.stage.pick(x, y), [p.x, p.y]);
        if (hit && hit[0] === c && hit[1] === r) picked++;
    }
    check(tried >= 3 && picked === tried, `taps land on the hex under the finger (${picked}/${tried})`);

    // select and move by touch
    const mv = await Q(page, () => { const s = __ql.G.battle.stacks.find((x) => x.side === 'p' && !x.moved); return { id: s.id, c: s.c, r: s.r }; });
    let p = await hexAt(page, mv.c, mv.r);
    await touchAt(p.x, p.y);
    await until(page, (id) => __ql.play.sel === id, 'a tap selects your stack', 20000, mv.id);
    const dest = await Q(page, () => { const h = __ql.view.hl.find((x) => x.visible && x.userData.kind === 'move'); return h ? __ql.view.stage.toScreen(h.position) : null; });
    if (check(!!dest, 'gold move hexes appear')) {
        await touchAt(dest.x, dest.y);
        await until(page, (id) => __ql.stack(id).moved, 'a tap on a gold hex moves it', 20000, mv.id);
    }
    await idle(page);

    // a card, then a two-tap attack
    const before = await Q(page, () => (__ql.seen.attack || 0) + (__ql.seen.spell || 0));
    const uid = await Q(page, () => { const c = __ql.G.battle.hand.find((x) => ['strike', 'firebolt'].includes(x.id) && document.querySelector(`#hand .card[data-uid="${x.uid}"]:not(.no)`)); return c ? c.uid : null; });
    if (uid != null) {
        await tapSel(`#hand .card[data-uid="${uid}"]`);
        await until(page, (u) => __ql.play.card === u, 'a tap picks a card', 20000, uid);
        const needActor = await Q(page, () => { const h = __ql.view.hl.find((x) => x.visible && x.userData.kind === 'ally'); return __ql.play.actor == null && h ? __ql.view.stage.toScreen(h.position) : null; });
        if (needActor) await touchAt(needActor.x, needActor.y);
        const tgt = await Q(page, () => { const h = __ql.view.hl.find((x) => x.visible && x.userData.kind === 'attack'); return h ? __ql.view.stage.toScreen(h.position) : null; });
        if (tgt) {
            await touchAt(tgt.x, tgt.y);
            await until(page, () => !!__ql.play.pending, 'the first tap on a foe aims (forecast)');
            await touchAt(tgt.x, tgt.y);
            await until(page, (n) => (__ql.seen.attack || 0) + (__ql.seen.spell || 0) > n, 'the second tap gives the order', 30000, before);
        }
    }
    await idle(page);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    const btn = await Q(page, () => { const r = document.querySelector('#pause-menu [data-act="resume"]').getBoundingClientRect(); return r.top >= 50 && r.height >= 44; });
    check(btn, 'Resume clears the back link and is finger-sized');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ql.G?.screen === 'map', 'boots and starts a campaign with localStorage throwing');
    await Q(page, () => { __ql.send({ t: 'go', id: document.querySelector('#map-svg .node.next').dataset.node }); __ql.send({ t: 'begin' }); __ql.ff(); });
    await until(page, () => __ql.G.screen === 'reward' || __ql.G.screen === 'defeat', 'and fights a battle to the end');
    check(await Q(page, () => __ql.save() === false), 'saving fails quietly');
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
