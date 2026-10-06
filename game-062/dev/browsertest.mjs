/**
 * browsertest.mjs — real Chromium, real WebGL, the genuine three.js r165.
 *
 * Desktop (1280×800, mouse): title → How to Play (legend thumbnails rendered) →
 * setup (vs Computer, Cabin Boy, Tempest) → e2-e4 by real clicks on the ship and the
 * water → the computer replies → every sea event forced in turn and played by real
 * clicks, checking after each that the 3D fleet matches the simulation → undo →
 * hint → labels → promotion through the picker → a back-rank mate and the game-over
 * dialog → a two-captain game where the board turns to the side to move → reload
 * and Continue Voyage.
 * Phones (touch only, CDP input) at 390×844 and 844×390: a game by taps, toolbar
 * buttons ≥ 44 px and on screen, the log drawer, no sideways scroll, nothing
 * covering the board where we tap.
 * NOSTORAGE=1 makes every localStorage access throw; the game must still play.
 * Fails on any console error, page error or failed request. Shots → dev/shots/.
 *
 *   python3 -m http.server 8062                  # from the REPO ROOT
 *   node game-062/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served from disk:
 *   cd game-062/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz   # -> ./package
 * Env: BASE (default http://127.0.0.1:8062), THREE_PKG, PW_CHROMIUM_PATH,
 *      ONLY=desktop|phones, NOSTORAGE=1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8062';
const URL0 = `${BASE}/game-062/index.html?debug=1`;
const OUT = path.join(HERE, 'shots');
const NOSTORAGE = !!process.env.NOSTORAGE;
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    if (NOSTORAGE) {
        await ctx.addInitScript(() => {
            const boom = () => { throw new DOMException('blocked', 'SecurityError'); };
            Object.defineProperty(window, 'localStorage', { get: boom, configurable: true });
        });
    } else {
        await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__cleared')) { localStorage.clear(); sessionStorage.setItem('__cleared', '1'); } } catch { /* ignore */ } });
    }
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    // Fonts are optional (every face has a fallback); answer offline runs with an empty sheet.
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
        else if (m.type() === 'warning' && m.text().includes('[kraken]')) errors.push(`warning: ${m.text()}`);
        else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(OUT, `${name}${NOSTORAGE ? '-nostorage' : ''}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 90000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => Q(page, () => __kg.state());
const idle = (page, msg = 'the sea settles', timeout = 120000) => until(page, () => { const s = __kg.state(); return !s.busy && s.anims === 0; }, msg, timeout);

async function boot(page) {
    await page.goto(URL0);
    await until(page, () => window.__kg && window.__kg.ready, 'game boots');
    await page.waitForTimeout(400);
}

/** Click (or tap) the ship on `from`, then the water on `to`. */
async function playByPointer(page, from, to, tap = false) {
    const a = await Q(page, (n) => __kg.pieceScreen(n), from);   // the hull, just above the waterline
    const b = await Q(page, (n) => __kg.screenOf(n), to);
    for (const p of [a, b]) {
        const covered = await Q(page, ({ x, y }) => { const el = document.elementFromPoint(x, y); return el && el.tagName !== 'CANVAS' ? (el.id || el.className || el.tagName) : null; }, p);
        if (covered) { check(false, `tap target at ${Math.round(p.x)},${Math.round(p.y)} is covered by ${covered}`); return false; }
    }
    if (tap) { await page.touchscreen.tap(a.x, a.y); } else { await page.mouse.click(a.x, a.y); }
    await page.waitForTimeout(150);
    const sel = (await state(page)).sel;
    if (tap) { await page.touchscreen.tap(b.x, b.y); } else { await page.mouse.click(b.x, b.y); }
    return sel;
}

/** A quiet legal move for the side to move, as [from, to] square names. */
async function someMove(page, prefer = []) {
    return Q(page, (prefer) => {
        const m = __kg.match();
        const name = (s) => 'abcdefgh'[s & 7] + ((s >> 4) + 1);
        const legal = m.legal();
        for (const p of prefer) { const l = legal.find((x) => name(x.from) + name(x.to) === p); if (l) return [name(l.from), name(l.to)]; }
        const quiet = legal.filter((l) => !m.pos.b[l.to] && !l.promo && Math.abs(m.pos.b[l.from]) !== 6);
        const l = quiet[(m.ply * 7) % Math.max(1, quiet.length)] || legal[0];
        return [name(l.from), name(l.to)];
    }, prefer);
}

async function noSideScroll(page, label) {
    const w = await Q(page, () => [document.documentElement.scrollWidth, window.innerWidth]);
    check(w[0] <= w[1], `${label}: no sideways scroll (${w[0]} <= ${w[1]})`);
}

async function backLinkClear(page, label) {
    const r = await Q(page, () => {
        const a = document.getElementById('games-link');
        const b = a.getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { on: b.right <= innerWidth && b.bottom <= innerHeight && b.left >= 0 && b.top >= 0, top: el === a || a.contains(el) };
    });
    check(r.on && r.top, `${label}: ← Games link visible and clickable`);
}

// =========================================================== desktop
async function desktop() {
    console.log('\n== desktop 1280x800');
    const { page } = await newPage({ width: 1280, height: 800 });
    await boot(page);
    await backLinkClear(page, 'title');
    await shot(page, 'd-title');

    await page.click('#btn-howto');
    const thumbs = await Q(page, () => [...document.querySelectorAll('#legend img')].filter((i) => i.src.startsWith('data:image/png')).length);
    check(thumbs === 12, `help legend shows 12 rendered ship thumbnails (${thumbs})`);
    check(await Q(page, () => document.querySelectorAll('#event-legend .item').length === 8), 'help lists all 8 sea events');
    await shot(page, 'd-help');
    await page.click('#help .close');

    await page.click('#btn-new');
    await page.click('#opt-mode .chip[data-v="ai"]');
    await page.click('#opt-side .chip[data-v="1"]');
    await page.click('#opt-level .chip[data-v="1"]');
    await page.click('#opt-sea .chip[data-v="tempest"]');
    await shot(page, 'd-setup');
    await page.click('#btn-sail');
    await until(page, () => __kg.state().screen === 'play', 'voyage starts');
    await Q(page, () => __kg.speed(2.5));
    await idle(page);
    await backLinkClear(page, 'play');

    const sel = await playByPointer(page, 'e2', 'e4');
    check(sel === 20, 'clicking the e2 dinghy selects it');
    await until(page, () => __kg.state().ply >= 2 && !__kg.state().busy, 'e4 played and the computer replied');
    check((await state(page)).fen.split(' ')[0].includes('4P3'), 'Navy dinghy now on e4');
    await shot(page, 'd-after-e4');

    // Every event, forced, after a real-click move.
    const prefer = ['d2d4', 'g1f3', 'b1c3', 'f1c4', 'c2c3', 'a2a3', 'h2h3', 'b2b3'];
    const types = ['kraken', 'salvage', 'mermaid', 'storm', 'whirlpool', 'dolphins', 'ghost', 'serpent'];
    for (const t of types) {
        // The sea's fairness rules can veto a forced event in an awkward position;
        // then force it again on the next move (up to three tries).
        let seen = false;
        for (let attempt = 0; attempt < 3 && !seen; attempt++) {
            await idle(page);
            const s0 = await state(page);
            if (s0.result) break;
            await Q(page, (t) => __kg.force(t), t);
            const [f, to] = await someMove(page, prefer);
            await playByPointer(page, f, to);
            await until(page, (p) => __kg.state().ply > p, `${t}: move ${f}-${to} played`, 30000, s0.ply);
            if (attempt === 0) { await page.waitForTimeout(1700); await shot(page, `d-event-${t}`); }
            await idle(page, `${t}: event and reply finished`, 150000);
            const got = await Q(page, (p) => __kg.match().log[p]?.event?.type || null, s0.ply);
            seen = got === t;
            const s = await state(page);
            check(s.desyncs === 0 && s.matches, `${t}: the 3D fleet matches the simulation`);
        }
        check(seen, `${t}: the forced event happened`);
    }
    const s1 = await state(page);
    check(s1.events >= 6, `at least six sea events played (${s1.events})`);

    // Undo back to our previous turn.
    await idle(page);
    const before = await state(page);
    if (!before.result) {
        await page.click('#btn-undo');
        await idle(page);
        const after = await state(page);
        check(after.ply === before.ply - 2 && after.turn === 1, `undo rewinds a full turn (${before.ply} → ${after.ply})`);
        check(after.matches, 'fleet matches after undo');

        await page.click('#btn-hint');
        await until(page, () => document.getElementById('toast').textContent.startsWith('Try '), 'hint suggests a move');
        await shot(page, 'd-hint');
    }
    await page.click('#btn-labels');
    await page.waitForTimeout(300);
    await shot(page, 'd-labels');
    await page.click('#btn-labels');

    // Promotion through the picker (two captains, from a set position).
    await Q(page, () => __kg.startFen('7k/4P3/8/8/8/8/8/K7 w - - 0 1'));
    await idle(page);
    await playByPointer(page, 'e7', 'e8');
    await until(page, () => !document.getElementById('promo').hidden, 'promotion picker opens');
    await shot(page, 'd-promo');
    await page.click('#promo-choices button[data-type="2"]');
    await until(page, () => __kg.state().fen.startsWith('4N2k'), 'dinghy refitted as a Longship (knight) on e8');
    await idle(page);

    // Back-rank mate → game over dialog.
    await Q(page, () => __kg.startFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'));
    await idle(page);
    await playByPointer(page, 'd1', 'd8');
    await until(page, () => !document.getElementById('over').hidden, 'game-over dialog after Rd8#', 60000);
    const over = await Q(page, () => document.getElementById('over-text').textContent);
    check(/Navy win by checkmate/.test(over), `result reads "${over}"`);
    await shot(page, 'd-over');
    await page.click('#over-review');

    // Two captains: the board turns to the side to move.
    await page.click('#btn-menu');
    await page.click('#menu-new');
    await page.click('#opt-mode .chip[data-v="pvp"]');
    await page.click('#opt-sea .chip[data-v="off"]');
    await page.click('#btn-sail');
    await until(page, () => __kg.state().screen === 'play', 'two-captain voyage starts');
    await idle(page);
    await playByPointer(page, 'd2', 'd4');
    await until(page, () => __kg.state().ply === 1 && !__kg.state().busy && __kg.state().anims === 0, 'Navy moved');
    check((await state(page)).view === -1, 'board turned to face the Pirates');
    await shot(page, 'd-pvp-pirates-view');
    await playByPointer(page, 'd7', 'd5');
    await until(page, () => __kg.state().ply === 2, 'Pirates moved by clicking from their side');

    if (!NOSTORAGE) {
        await page.reload();
        await until(page, () => window.__kg && window.__kg.ready, 'reloaded');
        check(await Q(page, () => !document.getElementById('btn-continue').hidden), 'Continue Voyage offered after reload');
        await page.click('#btn-continue');
        await until(page, () => __kg.state().screen === 'play' && __kg.state().ply === 2, 'voyage restored at ply 2');
    }
    const b = await Q(page, () => __kg.brightness());
    check(b > 0, `frame isn't black (${b})`);
}

// =========================================================== phones
async function phone(w, h) {
    console.log(`\n== phone ${w}x${h} (touch only)`);
    const { page } = await newPage({ width: w, height: h }, { hasTouch: true, isMobile: true });
    await boot(page);
    await noSideScroll(page, 'title');
    await backLinkClear(page, 'title');
    await page.tap('#btn-new');
    await page.tap('#opt-level .chip[data-v="1"]');
    await page.tap('#opt-sea .chip[data-v="choppy"]');
    await shot(page, `p-${w}x${h}-setup`);
    await page.tap('#btn-sail');
    await until(page, () => __kg.state().screen === 'play', 'voyage starts by tap');
    await Q(page, () => __kg.speed(2.5));
    await idle(page);
    await noSideScroll(page, 'play');
    await backLinkClear(page, 'play');
    const tools = await Q(page, () => [...document.querySelectorAll('#toolbar .tool')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, h: r.height, w: r.width, on: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; }));
    check(tools.every((t) => t.on), 'every toolbar button is on screen');
    check(tools.every((t) => t.h >= 40 && t.w >= 34), `toolbar buttons are finger-sized (min ${Math.min(...tools.map((t) => Math.round(t.h)))}×${Math.min(...tools.map((t) => Math.round(t.w)))})`);
    await playByPointer(page, 'e2', 'e4', true);
    await until(page, () => __kg.state().ply >= 2 && !__kg.state().busy, 'e4 by taps, computer replied');
    await playByPointer(page, 'g1', 'f3', true);
    await until(page, () => __kg.state().ply >= 4 && !__kg.state().busy, 'Nf3 by taps, computer replied');
    await page.tap('#panel-toggle');
    check(await Q(page, () => getComputedStyle(document.getElementById('panel-body')).display !== 'none'), 'log drawer opens');
    await shot(page, `p-${w}x${h}-log`);
    await page.tap('#panel-toggle');
    await shot(page, `p-${w}x${h}-play`);
    const s = await state(page);
    check(s.matches && s.desyncs === 0, 'fleet matches the simulation');
}

try {
    if (process.env.ONLY !== 'phones') await desktop();
    if (process.env.ONLY !== 'desktop') {
        await phone(390, 844);
        await phone(844, 390);
    }
} catch (e) {
    errors.push(`exception: ${e.stack || e.message}`);
} finally {
    if (browser) await browser.close();
}
console.log(errors.length ? `\n${errors.length} PROBLEM(S):\n  ${errors.join('\n  ')}` : '\nALL OK');
process.exit(errors.length ? 1 : 0);
