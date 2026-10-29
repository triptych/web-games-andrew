/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game opens
 *   the camp and the first stage's brief → Fight → real mouse clicks select a token and swap it
 *   with a neighbour; a swap that makes no line snaps back → the keyboard cursor picks up and swaps
 *   → a charged skill fires from its key → Escape pauses → Save & Quit → Continue resumes the
 *   battle where it was → the battle is won and the result shows → To Camp → a summon reveals its
 *   heroes and Space on the focused button closes it → a hero sheet adds a hero to the party.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the
 *   board fits between the HUD and the party bar, a swipe swaps two tokens, a tap reads a token's
 *   oath, controls ≥ 44 px and on screen, the pause screen survives the finger lifting, no
 *   sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8108          # from the REPO ROOT
 *   node game-108/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8108), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8108';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, keep = null } = {}) {
    if (browser && !keep) await browser.close();
    if (!keep) {
        browser = await chromium.launch({
            executablePath: process.env.PW_CHROMIUM_PATH || undefined,
            args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
        });
    }
    const ctx = keep || await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    if (!keep) {
        await ctx.addInitScript((ns) => {
            if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
            else if (!sessionStorage.getItem('kept')) { try { localStorage.clear(); } catch { /* */ } sessionStorage.setItem('kept', '1'); }
        }, nostorage);
    }
    const page = await ctx.newPage();
    if (PKG) {
        // No network to the CDN? Serve the genuine three.js package from disk.
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
    await page.goto(`${BASE}/game-108/index.html?debug=1&fast=6`);
    await page.waitForFunction(() => window.__os && __os.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 40000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, id) => Q(page, (i) => !document.getElementById(i).hidden, id);
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
/** Every corner cell's centre lands in the free part of the window, clear of the HUD (the party
 * bar is at the bottom, or in a column on the right on a landscape phone). */
const boardFits = (page) => Q(page, () => {
    const pad = __os.ui.pads();
    const box = { l: pad.left, r: innerWidth - pad.right, t: pad.top - 8, b: innerHeight - pad.bottom + 6 };
    for (const i of [0, 6, 42, 48]) {
        const p = __os.cellCenter(i);
        if (p.x < box.l || p.x > box.r || p.y < box.t || p.y > box.b) return { ok: false, i, p, box };
    }
    return { ok: true };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const readyBoard = (page, msg) => until(page, () => __os.ready, msg);
/** A swap that clears something, and one that doesn't, between two movable neighbours. */
const pickSwaps = (page) => Q(page, () => {
    const g = __os.G.B.g, W = 7;
    const good = __os.moves()[0];
    let bad = null;
    const ok = new Set(__os.moves().map(([a, b]) => a + ',' + b));
    for (let i = 0; i < 48 && !bad; i++) {
        const j = i % W < W - 1 ? i + 1 : -1;
        if (j > 0 && !ok.has(i + ',' + j) && g[i] && g[j] && !g[i].rb && !g[i].fz && !g[j].rb && !g[j].fz) bad = [i, j];
    }
    return { good, bad };
});

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

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __os.mode === 'camp' && !document.getElementById('brief').hidden, 'New Game opens the camp and the first brief');
    await shot(page, 'desktop-brief');
    await click(page, '#brief-go');
    await until(page, () => __os.mode === 'battle' && !document.getElementById('hud').hidden, 'Fight starts the battle');
    await readyBoard(page, 'the board is dealt and waits for a move');
    check(await Q(page, () => document.getElementById('foe-name').textContent === 'Cinder Imp'), 'the enemy plate names the Cinder Imp');
    const fit = await boardFits(page);
    check(fit.ok, `the board sits between the enemy plate and the party bar ${fit.ok ? '' : JSON.stringify(fit)}`);
    await shot(page, 'desktop-battle');

    // real mouse: a swap that makes no line snaps back and costs nothing
    let { good, bad } = await pickSwaps(page);
    if (bad) {
        const moves0 = await Q(page, () => __os.G.stats.moves);
        for (const i of bad) { const p = await Q(page, (k) => __os.cellCenter(k), i); await page.mouse.click(p.x, p.y); }
        await until(page, () => (__os.seen.swap || 0) >= 1 && __os.ready, 'a swap that makes no line is shown and snaps back');
        check(await Q(page, (m) => __os.G.stats.moves === m && __os.G.B.turn === 0, moves0), 'and costs no turn');
    }
    // real mouse: select, then click the neighbour
    ({ good } = await pickSwaps(page));
    let p = await Q(page, (k) => __os.cellCenter(k), good[0]);
    await page.mouse.click(p.x, p.y);
    await until(page, (i) => __os.sel === i && /Kinship|Form|Twinned|Prism|Motley|Host|Fool|Rubble/.test(document.getElementById('info-text').textContent), 'a click selects a token and the info line reads its oath', 20000, good[0]);
    p = await Q(page, (k) => __os.cellCenter(k), good[1]);
    await page.mouse.click(p.x, p.y);
    await until(page, () => __os.G.stats.moves === 1, 'a click on a neighbour swaps them and the move counts');
    await readyBoard(page, 'the cascade plays out and the board is ready again');
    check(await Q(page, () => __os.G.B.enemy.hp < __os.G.B.enemy.maxHp || __os.G.B.over), 'the match hurt the enemy');

    // keyboard cursor: ArrowLeft puts the cursor at the centre-left, then walk to the target
    ({ good } = await pickSwaps(page));
    const path0 = await Q(page, ([a, b]) => {
        const keys = ['ArrowLeft'];
        let cx = 2, cy = 3;
        const tx = a % 7, ty = (a / 7) | 0;
        while (cx < tx) { keys.push('ArrowRight'); cx++; }
        while (cx > tx) { keys.push('ArrowLeft'); cx--; }
        while (cy < ty) { keys.push('ArrowDown'); cy++; }
        while (cy > ty) { keys.push('ArrowUp'); cy--; }
        keys.push('Space');
        keys.push(b === a + 1 ? 'ArrowRight' : b === a - 1 ? 'ArrowLeft' : b > a ? 'ArrowDown' : 'ArrowUp');
        return keys;
    }, good);
    for (const k of path0) await page.keyboard.press(k);
    await until(page, () => __os.G.stats.moves === 2, 'arrow keys and Space pick up a token and swap it');
    await readyBoard(page, 'ready after the keyboard swap');

    // a charged skill from its key
    await Q(page, () => { const p0 = __os.G.B.party[0]; p0.charge = 99; __os.ui.updateCharges(__os.G); });
    await page.keyboard.press('Digit1');
    await until(page, () => (__os.seen.skill || 0) >= 1, 'key 1 fires the first hero’s charged skill');
    await readyBoard(page, 'ready after the skill');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const turn = await Q(page, () => __os.G.B.turn);
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __os.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (t) => __os.mode === 'battle' && __os.G.B && __os.G.B.turn === t && __os.ready, 'Continue resumes the battle on the same turn', 40000, turn);

    // win it
    await Q(page, () => { __os.G.B.enemy.hp = 1; });
    await Q(page, () => __os.ff(30));
    await until(page, () => !document.getElementById('result').hidden && document.getElementById('result-title').textContent === 'Victory', 'the battle is won and the result shows', 60000);
    await shot(page, 'desktop-result');
    await click(page, '#result-camp');
    await until(page, () => __os.mode === 'camp' && !document.getElementById('camp').hidden, 'To Camp returns to the camp');

    // summon, and Space on the focused button closes the reveal (a keydown that preventDefaults Space would not)
    await Q(page, () => { __os.G.crystals = 1000; document.querySelector('.tab[data-tab="summon"]').click(); });
    await click(page, '[data-summon="5"]');
    await until(page, () => !document.getElementById('reveal').hidden && document.querySelectorAll('.rcard').length === 5, 'Call ×5 reveals five heroes');
    check(await Q(page, () => __os.G.calls.length >= 5 && __os.G.crystals <= 550), 'they wait in the calling and the crystals are spent');
    await page.waitForTimeout(1200);
    await shot(page, 'desktop-reveal');
    await Q(page, () => document.querySelector('#reveal [data-close]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('reveal').hidden, 'Space on the focused button closes the reveal');

    // a hero sheet, then into the party
    await Q(page, () => { __os.G.roster.nyx = { lv: 1, xp: 0, rank: 0 }; document.querySelector('.tab[data-tab="heroes"]').click(); });
    await click(page, '#tab-heroes .roster [data-hero="nyx"]');
    await until(page, () => !document.getElementById('hero').hidden && document.getElementById('hero-name').textContent === 'Nyx', 'a hero card opens the hero sheet');
    check(await Q(page, () => /Prism/.test(document.getElementById('hero-oath').textContent)), 'the sheet explains her Prism oath');
    await shot(page, 'desktop-hero');
    await click(page, '#hero-party');
    await until(page, () => __os.G.party.includes('nyx') && document.getElementById('hero').hidden, 'Add to Party puts her in the party');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('brief').hidden, 'a tap on New Game opens the brief');
    await page.waitForTimeout(300);
    await tapSel('#brief-go');
    await until(page, () => __os.mode === 'battle', 'a tap on Fight starts the battle');
    await readyBoard(page, 'the board is ready');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const fit = await boardFits(page);
    check(fit.ok, `the board sits between the enemy plate and the party bar ${fit.ok ? '' : JSON.stringify(fit)}`);

    const sizes = await Q(page, () => ['#btn-pause', '#skills .skill:nth-child(1)', '#skills .skill:nth-child(2)'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const back = await Q(page, () => {
        const a = document.getElementById('back-link').getBoundingClientRect(), f = document.getElementById('foe').getBoundingClientRect();
        return a.right <= f.left || a.bottom <= f.top;
    });
    check(back, 'the enemy plate stays clear of the ← Games link');

    // tap reads a token
    const { good } = await pickSwaps(page);
    const pa = await Q(page, (k) => __os.cellCenter(k), good[0]);
    await page.touchscreen.tap(pa.x, pa.y);
    await until(page, (i) => __os.sel === i, 'a tap selects a token', 20000, good[0]);
    await page.touchscreen.tap(pa.x, pa.y);
    await until(page, () => __os.sel === null, 'a second tap puts it down');

    // a real swipe from one token toward its neighbour
    const pb = await Q(page, (k) => __os.cellCenter(k), good[1]);
    await touch('touchStart', pa.x, pa.y);
    for (let k = 1; k <= 6; k++) await touch('touchMove', pa.x + ((pb.x - pa.x) * k) / 6, pa.y + ((pb.y - pa.y) * k) / 6);
    await touch('touchEnd', 0, 0);
    await until(page, () => __os.G.stats.moves === 1, 'a swipe swaps two tokens');
    await readyBoard(page, 'ready after the swipe');
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // the camp on a phone
    await Q(page, () => { __os.G.B.enemy.hp = 1; __os.ff(30); });
    await until(page, () => !document.getElementById('result').hidden, 'the battle ends');
    await page.waitForTimeout(300);
    await tapSel('#result-camp');
    await until(page, () => __os.mode === 'camp', 'a tap on To Camp opens the camp');
    await Q(page, () => document.querySelector('.tab[data-tab="heroes"]').click());
    await page.waitForTimeout(500);
    const campOk = await Q(page, () => {
        const s = document.querySelector('#camp .sheet').getBoundingClientRect();
        return s.left >= 0 && s.right <= innerWidth + 1 && s.top >= 40 && s.bottom <= innerHeight + 1;
    });
    check(campOk, 'the camp sheet fits the screen below the back link');
    await shot(page, `phone-camp-${w}x${h}`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __os.mode === 'camp', 'boots and opens the camp with localStorage throwing');
    await click(page, '#brief-go');
    await until(page, () => __os.mode === 'battle' && __os.ready, 'a battle starts and is ready');
    await Q(page, () => __os.ff(3));
    await readyBoard(page, 'and plays');
    check(await Q(page, () => __os.save() === false), 'saving fails quietly');
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
