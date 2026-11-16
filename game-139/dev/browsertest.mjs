/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): the title with no errors and the ← Games link on top → New Run by click → the narrator's
 *   story closes with real Enter presses → a letter → the rival's arrival → a real mouse pair on the 3D table
 *   settles cards → E ends the round → Escape pauses and the sim waits → Resume → the bot wins the night → the
 *   partnership screen → the day: buy, a chore, the deck picker (Polish), Open the doors → Save & Quit →
 *   Continue restores the run → the bot plays the run out to an ending or a loss, and that screen shows. Media:
 *   every effect and voice clip decodes, music plays, sound reaches the master bus. No sideways scroll.
 * phones (touch only, real touches) at 390×844 and 844×390: taps through the menus and stories, a tapped pair on
 *   the table settles, End round, controls ≥ 44 px and on screen, the canvas matches the visible viewport, the
 *   pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays a night.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8139          # from the REPO ROOT
 *   node game-139/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8139), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8139';
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
    page.on('requestfailed', (r) => {
        const u = r.url();
        // a picture whose screen closed (or whose <img> moved on to the next portrait) before it arrived is cancelled,
        // not broken; every other failed request still fails the run (games 127-133 do the same)
        if (u.includes('favicon') || u.includes('fonts.g') || (u.includes('/art/') && r.failure()?.errorText === 'net::ERR_ABORTED')) return;
        errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
    });
    await page.goto(`${BASE}/game-139/index.html?debug=1`);
    await page.waitForFunction(() => window.__cs && __cs.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const visible = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden && e.getClientRects().length > 0; }, id);
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

/** A pair that can be made right now, preferring one of your cards with a rival card. */
const findPair = (page) => Q(page, () => {
    const moves = __cs.legal().filter((m) => m.t === 'pair');
    const m = moves.find((x) => x.a.hand || x.b.hand) || moves[0];
    if (!m) return null;
    const a = m.a.hand ? m.a : m.b, b = m.a.hand ? m.b : m.a;
    return { a: __cs.screenOf(a), b: __cs.screenOf(b), aKey: a, bKey: b };
});
/** Make sure the table has a pair to make (redeal the open cards around the first hand card if needed). */
const ensurePair = (page) => Q(page, () => {
    const G = __cs.G, F = G.fight;
    if (__cs.legal().some((m) => m.t === 'pair' && (m.a.hand || m.b.hand))) return true;
    const uid = F.hand.find((u) => F.cards[u].id !== 'grudge' && F.cards[u].id !== 'habit' && F.cards[u].id !== 'regular');
    const rank = { ale: 3, bread: 10, stew: 5, hearthfire: 8, copper: 2, silver: 11, roomkey: 1, guestbook: 12, sparekey: 13, stiletto: 9, garrote: 4, knives: 7 }[F.cards[uid]?.id] ?? 6;
    const open = F.slots.filter((s, i) => !s.gone && !s.lock && __cs.legal().some((m) => m.t === 'cut' && m.slot === i) || false);
    const slot = F.slots.find((s) => !s.gone && __cs.view.rivalMeshes.get(s.id)?.userData.open);
    if (slot) slot.rank = Math.max(1, 13 - rank);
    return !!slot && open !== null;
});
const settles = (page) => Q(page, () => __cs.seen.settle || 0);
// wait until the cards the test is about to tap have stopped moving
const settled = (page) => page.waitForFunction(() => !__cs.view.busy, null, { timeout: 20000, polling: 100 }).catch(() => {});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await page.mouse.click(640, 545);   // New Run (real click on the button)
    await until(page, () => __cs.mode === 'run' && !document.getElementById('story').hidden, 'New Run starts the story');
    await page.keyboard.press('Enter');
    await until(page, () => /thirteen/.test(document.getElementById('story-text').textContent), 'Enter moves the story on');
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('story').hidden && !document.getElementById('letters').hidden, 'the letters arrive');
    await shot(page, 'desktop-letters');
    check(await Q(page, () => document.querySelectorAll('#letters-list .letter').length === 2), 'two letters to choose from');
    const lb = await Q(page, () => { const r = document.querySelector('#letters-list .letter').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(lb.x, lb.y);
    await until(page, () => __cs.G.phase === 'night' && !document.getElementById('story').hidden, 'hosting a rival: they arrive and say their piece');
    await shot(page, 'desktop-arrive');
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('story').hidden && !document.getElementById('hud').hidden, 'the cards are dealt: the HUD is up');
    await settled(page);
    await page.waitForTimeout(400);

    // a real mouse pair on the 3D table
    await ensurePair(page);
    const p = await findPair(page);
    check(!!p && p.a && p.b, 'there is a pair to make');
    const s0 = await settles(page);
    await page.mouse.click(p.a.x, p.a.y);
    await until(page, (k) => JSON.stringify(__cs.sel) === JSON.stringify(k), 'clicking a card in the hand selects it', 10000, p.aKey);
    const b = await Q(page, (k) => __cs.screenOf(k), p.bKey);
    await page.mouse.click(b.x, b.y);
    await until(page, (n) => (__cs.seen.settle || 0) > n, 'clicking a rival card that makes 13 settles it', 10000, s0);
    await shot(page, 'desktop-night');

    const r0 = await Q(page, () => __cs.G.fight.round);
    await page.keyboard.press('KeyE');
    await until(page, (r) => __cs.G.phase !== 'night' || __cs.G.fight.round === r + 1, 'E ends the round: the rival acts, a new hand', 10000, r0);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const snap = await Q(page, () => JSON.stringify([__cs.G.fight?.round, __cs.G.resolve]));
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
    check(await Q(page, (s) => JSON.stringify([__cs.G.fight?.round, __cs.G.resolve]) === s, snap), 'keys do nothing to the table while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes the pause screen');

    // win the night (the bot plays the real commands)
    await Q(page, () => { for (let i = 0; i < 400 && __cs.G.phase === 'night'; i++) __cs.ff(1); });
    await until(page, () => !document.getElementById('won').hidden || __cs.G.phase === 'over', 'the night ends on the partnership screen');
    if (await Q(page, () => __cs.G.phase === 'won')) {
        await shot(page, 'desktop-won');
        await click(page, (await Q(page, () => !document.getElementById('won-partner').hidden)) ? '#won-partner' : '#won-farewell');
        await until(page, () => !document.getElementById('day').hidden, 'then the day at the inn');
        await Q(page, () => { __cs.G.tips = 60; __cs.ui.sync(__cs.G, true); });
        const n0 = await Q(page, () => __cs.G.deck.length);
        await click(page, '#market [data-i="0"]');
        await until(page, (n) => __cs.G.deck.length === n + 1, 'buying from the market adds a card', 10000, n0);
        await click(page, '#chores [data-chore="polish"]');
        await until(page, () => !document.getElementById('deck').hidden && document.querySelectorAll('#deck-list [data-uid]').length > 0, 'Polish opens the deck to choose a card');
        await click(page, '#deck-list [data-uid]');
        await until(page, () => __cs.G.day.chore === 'polish' && __cs.G.deck.some((c) => c.up), 'choosing a card polishes it');
        await shot(page, 'desktop-day');
        await click(page, '#day-open');
        await until(page, () => ['letters', 'interlude'].includes(__cs.G.phase), 'Open the doors: the next letters (or an interlude)');
    }
    // save, quit, continue
    await Q(page, () => { __cs.ui.openScreen('pause'); });
    const state = await Q(page, () => JSON.stringify([__cs.G.phase, __cs.G.tips, __cs.G.deck.length, __cs.G.night]));
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __cs.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __cs.mode === 'run' && JSON.stringify([__cs.G.phase, __cs.G.tips, __cs.G.deck.length, __cs.G.night]) === s, 'Continue restores the run', 10000, state);

    // media
    await page.waitForFunction(() => __cs.audio.loading, null, { timeout: 10000 }).catch(() => {});
    await Q(page, () => __cs.audio.loading);
    check(await Q(page, () => Object.keys(__cs.audio.buffers).length === 16), 'all 16 sound effects decode');
    check(await Q(page, () => Object.keys(__cs.audio.voices).length >= 40), 'the voice lines decode');
    await until(page, () => __cs.audio.playing(), 'music is playing', 15000);

    // play it out
    await Q(page, () => { for (let i = 0; i < 6000 && !__cs.G.over; i++) __cs.ff(1); __cs.skipStory(); });
    await until(page, () => (__cs.G.phase === 'ending' && !document.getElementById('ending').hidden) || (__cs.G.phase === 'over' && !document.getElementById('over').hidden), 'the run ends on its screen (an ending or the blade)');
    await shot(page, 'desktop-end');
    check(await Q(page, () => !__cs.hasSave()), 'a finished run leaves no save');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && b.width > 0 && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('story').hidden, 'a tap on New Run starts the story');
    await tapSel('#story-ok');
    await page.waitForTimeout(200);
    await tapSel('#story-ok');
    await until(page, () => !document.getElementById('letters').hidden, 'taps carry the story to the letters');
    await tapSel('#letters-list .letter');
    await until(page, () => __cs.G.phase === 'night' && !document.getElementById('story').hidden, 'a tapped letter brings the rival');
    await tapSel('#story-ok');
    await until(page, () => !document.getElementById('hud').hidden && document.getElementById('story').hidden, 'the table and HUD are up');
    await settled(page);
    await page.waitForTimeout(400);
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-end', '#btn-pour', '#btn-deck', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const onScreen = await Q(page, () => {
        const F = __cs.G.fight;
        const pts = [...F.hand.map((u) => __cs.screenOf({ hand: u })), ...F.slots.filter((s) => __cs.view.rivalMeshes.get(s.id)?.userData.open).map((s) => __cs.screenOf({ slot: s.id }))];
        return pts.every((p) => p && p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight);
    });
    check(onScreen, 'every playable card is on screen');

    await ensurePair(page);
    const p = await findPair(page);
    const s0 = await settles(page);
    await page.touchscreen.tap(p.a.x, p.a.y);
    await until(page, (k) => JSON.stringify(__cs.sel) === JSON.stringify(k), 'tapping a card in the hand selects it', 10000, p.aKey);
    const b = await Q(page, (k) => __cs.screenOf(k), p.bKey);
    await page.touchscreen.tap(b.x, b.y);
    await until(page, (n) => (__cs.seen.settle || 0) > n, 'tapping its match on the table settles the pair', 10000, s0);
    await shot(page, `phone-${w}x${h}`);
    const r0 = await Q(page, () => __cs.G.fight.round);
    await tapSel('#btn-end');
    await until(page, (r) => __cs.G.phase !== 'night' || __cs.G.fight.round === r + 1, 'tapping End round plays the rival\'s turn', 10000, r0);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // the day on a phone
    await Q(page, () => { for (let i = 0; i < 400 && __cs.G.phase === 'night'; i++) __cs.ff(1); });
    if (await Q(page, () => __cs.G.phase === 'won')) {
        await tapSel('#won-farewell');
        await until(page, () => !document.getElementById('day').hidden, 'the day screen on a phone');
        const dayOk = await Q(page, () => { const r = document.querySelector('#day .sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
        check(dayOk, 'the day sheet fits the screen width');
        await shot(page, `phone-day-${w}x${h}`);
        await tapSel('#day-open');
        await until(page, () => ['letters', 'interlude'].includes(__cs.G.phase), 'Open the doors by tap');
    }
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __cs.mode === 'run', 'boots and starts a run with localStorage throwing');
    await Q(page, () => { __cs.skipStory(); for (let i = 0; i < 300 && __cs.G.stats.nights < 1 && !__cs.G.over; i++) __cs.ff(1); });
    check(await Q(page, () => __cs.G.stats.nights >= 1 || __cs.G.over), 'and plays a night');
    check(await Q(page, () => __cs.save() === false), 'saving fails quietly');
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
