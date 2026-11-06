/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game by click → the prologue
 *   types out, a click finishes it, a real key goes on → the first guest walks in → gaze → three visions and an omen
 *   → draw → lay three cards by click and by number key, take one back with Backspace → they turn → choose how to
 *   tell it → the result card → the next guest. Escape pauses and the clock stops; a slider with focus does not
 *   swallow Escape; Space presses a focused menu button; the Codex opens with C. Save & Quit → Continue restores the
 *   game. Dusk offers the evening screen; an evening with someone and the Second Prince's night work by click.
 *   The ending screen shows. The canvas actually shows something (pixels read back), and the music is audible.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the whole reading,
 *   controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport, a second tap
 *   right after the typing finishes does not choose an answer, a menu opened by a finger stays open when it lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8121          # from the REPO ROOT
 *   node game-121/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8121), ONLY=desktop,phones,nostorage, THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8121';
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.g')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-121/index.html?debug=1&fast=6`);
    await page.waitForFunction(() => window.__aw && __aw.mode === 'title', null, { timeout: 150000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// a state that lasts a fraction of a second at test speed: look at every animation frame
const untilRaf = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 'raf' }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; }, sel);
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
/** Render a frame and read pixels back: a passing state test can still be a black screen. */
const pixels = (page) => Q(page, () => {
    const v = __aw.view;
    v.frame(__aw.G, 0.016, v.t + 0.016);
    const gl = v.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const buf = new Uint8Array(4);
    let sum = 0, sum2 = 0, n = 0, lit = 0;
    for (let i = 1; i < 12; i++) for (let j = 1; j < 9; j++) {
        gl.readPixels(Math.floor((w * i) / 12), Math.floor((h * j) / 9), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const l = (buf[0] + buf[1] + buf[2]) / 3; sum += l; sum2 += l * l; n++; if (l > 40) lit++;
    }
    const mean = sum / n;
    return { mean, sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), lit, n };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const G = (page, f) => Q(page, `(() => { const G = __aw.G; return ${f}; })()`);

/** Through whatever dialogue is on screen, by clicking the dialogue box. */
async function talkThrough(page, { tap = null } = {}) {
    for (let i = 0; i < 60; i++) {
        const open = await Q(page, () => !!__aw.G.dlg && !__aw.G.dlg.choices);
        if (!open) break;
        if (tap) await tap('#dlg-next'); else await Q(page, () => { document.getElementById('dlg-next').click(); document.getElementById('dlg-next').click(); });
        await page.waitForTimeout(60);
    }
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, '#title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => [...document.querySelectorAll('[id$="-title"]')].every((e) => /^H\d$/.test(e.tagName) && document.querySelectorAll('#' + e.id).length === 1)), 'every id of the form <screen>-title is a heading and unique (a11y.js owns those)');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    const px0 = await pixels(page);
    check(px0.sd > 12 && px0.lit > px0.n * 0.35, `the title scene is drawn, not black (mean ${px0.mean.toFixed(0)}, sd ${px0.sd.toFixed(0)}, ${px0.lit}/${px0.n} lit)`);
    await shot(page, 'desktop-title');

    // ---- a new game: the prologue. Slow typing, so the typewriter cannot finish between two of Playwright's calls.
    await Q(page, () => { __aw.ui.settings.text = 'slow'; });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __aw.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('dlg').hidden, 'New Game starts the prologue');
    check(await Q(page, () => document.getElementById('dlg-text').textContent.length < __aw.G.dlg.lines[0].t.length), 'the first line is being typed out');
    await Q(page, () => { document.getElementById('dlg').click(); });
    check(await Q(page, () => document.getElementById('dlg-text').textContent === __aw.G.dlg.lines[0].t), 'one click finishes the typing');
    check(await Q(page, () => __aw.G.dlg.i === 0), 'and does not also go on');
    await Q(page, () => { document.getElementById('dlg').click(); });
    check(await Q(page, () => __aw.G.dlg.i === 1), 'the next click goes on');
    // a real Enter and a real Space on the focused Continue button
    await until(page, () => document.activeElement?.id === 'dlg-next', 'the Continue button has focus, so keys work at once');
    await Q(page, () => document.getElementById('dlg').click());     // finish typing line 2
    check(await Q(page, () => document.getElementById('dlg-text').textContent === __aw.G.dlg.lines[1].t), 'line two is fully typed');
    await page.keyboard.press('Space');
    await until(page, () => __aw.G.dlg?.i === 2, 'a real Space goes on exactly one line');
    await Q(page, () => document.getElementById('dlg').click());
    await page.keyboard.press('Enter');
    await until(page, () => __aw.G.dlg?.i === 3, 'a real Enter does too');
    // three clicks inside one frame: finish the typing, go on, finish the new line, and never skip one
    await Q(page, () => { const d = document.getElementById('dlg'); d.click(); d.click(); d.click(); });
    check(await Q(page, () => __aw.G.dlg.i === 4 && document.getElementById('dlg-text').textContent === __aw.G.dlg.lines[4].t), 'three clicks in a single frame never skip a line');
    await Q(page, () => { __aw.ui.settings.text = 'fast'; });
    await talkThrough(page);
    await untilRaf(page, () => __aw.G.phase === 'dayintro' && !document.getElementById('daycard').hidden && /Day 1/.test(document.querySelector('#daycard .dc-day').textContent), 'the Day 1 card appears', 90000);
    await shot(page, 'desktop-day');
    await until(page, () => (__aw.seen.knock || 0) >= 1, 'then the first guest knocks', 60000);
    await shot(page, 'desktop-arrive');
    await until(page, () => __aw.G.phase === 'talk' && !!document.getElementById('dlg-name').textContent, 'she sits down and speaks, under her name');
    check(await Q(page, () => __aw.G.client.name === 'Granny Marta' && document.getElementById('dlg-name').textContent === 'Granny Marta'), 'it is Granny Marta');
    const px1 = await pixels(page);
    check(px1.sd > 12 && px1.lit > px1.n * 0.3, 'and the wagon is drawn');
    await talkThrough(page);
    await until(page, () => __aw.G.phase === 'ready' && !!document.querySelector('#actions .btn'), 'the Gaze button waits');
    await shot(page, 'desktop-ready');

    // ---- the reading
    await click(page, '#actions .btn');
    await until(page, () => __aw.G.phase === 'ball', 'gazing starts the ball');
    await until(page, () => document.querySelectorAll('#vis-row .vis').length === 3, 'three visions appear as chips', 60000);
    await until(page, () => !document.getElementById('omen-line').hidden, 'and then the omen');
    check(await Q(page, () => [...document.querySelectorAll('#vis-row .vis')].every((v) => v.querySelector('.name').textContent && v.querySelector('.glyphimg'))), 'each vision has a picture and a name');
    check(await Q(page, () => [...document.querySelectorAll('#vis-row .vis .when')].map((e) => e.textContent).join() === 'Past,Present,Future'), 'in the order past, present, future');
    check(await visible(page, '#tip'), 'a tip from the journal');
    await shot(page, 'desktop-ball');
    await until(page, () => __aw.G.ball.done && /Draw the cards/.test(document.querySelector('#actions .btn')?.textContent || ''), 'the ball clears and offers the cards');
    const pxb = await pixels(page);
    check(pxb.sd > 12, 'the ball scene is drawn');
    await click(page, '#actions .btn');
    await until(page, () => __aw.G.phase === 'deal' && document.querySelectorAll('#hand .hcard').length === 6, 'the hand of six cards is dealt');
    check(await Q(page, () => document.querySelectorAll('#hand canvas.cardimg').length === 6 && [...document.querySelectorAll('#hand canvas')].every((c) => c.width > 100)), 'each drawn in code');
    check(await Q(page, () => document.getElementById('btn-lay').disabled), 'Lay is disabled with no cards');
    await shot(page, 'desktop-deal');
    // lay by click, take one back with Backspace, lay again by number key
    await Q(page, () => document.querySelectorAll('#hand .hcard')[0].click());
    await until(page, () => __aw.G.reading.placed[0] === 0 && document.querySelectorAll('#slots .slot.filled').length === 1, 'a click lays the card in the first place');
    await page.keyboard.press('Digit2');
    await until(page, () => __aw.G.reading.placed[1] === 1, 'the 2 key lays the second card');
    await page.keyboard.press('Backspace');
    await until(page, () => __aw.G.reading.placed[1] === null, 'Backspace takes the last card back');
    await Q(page, () => document.querySelector('#slots .slot.filled').click());
    await until(page, () => __aw.G.reading.placed[0] === null, 'clicking a filled place takes its card back');
    // the best spread, by the sim's own truth
    await Q(page, async () => {
        const { cardPoints } = await import('./js/sim/reading.js');
        const R = __aw.G.reading, n = R.hand.length;
        let best = null;
        for (let a = 0; a < n && !best; a++) for (let b = 0; b < n && !best; b++) for (let c = 0; c < n && !best; c++) {
            if (a === b || b === c || a === c) continue;
            if ([a, b, c].every((k, i) => cardPoints(R.beats[i], R.hand[k].c, R.hand[k].r) === 2)) best = [a, b, c];
        }
        window.__best = best;
    });
    await until(page, () => __aw.G.reading.placed.every((p) => p === null) && ![...document.querySelectorAll('#hand .hcard')].some((b) => b.disabled), 'the hand has redrawn with every card free again');
    for (let k = 0; k < 3; k++) {
        await Q(page, (k) => document.querySelectorAll('#hand .hcard')[window.__best[k]].click(), k);
        await until(page, (k) => __aw.G.reading.placed.filter((p) => p !== null).length === k + 1 && document.querySelectorAll('#slots .slot.filled').length === k + 1, `card ${k + 1} laid`, 30000, k);
    }
    await until(page, () => !__aw.G.reading.placed.includes(null) && !document.getElementById('btn-lay').disabled, 'three cards laid, and Lay is enabled');
    await shot(page, 'desktop-placed');
    const pxc = await pixels(page);
    check(pxc.sd > 12, 'the cards scene is drawn');
    await page.focus('#btn-lay');
    await page.keyboard.press('Enter');
    await until(page, () => __aw.G.phase === 'flip' || __aw.G.phase === 'style', 'Enter on the Lay button lays the spread');
    await until(page, () => __aw.G.phase === 'style' && document.querySelectorAll('#styles .btn').length === 3, 'the cards turn and you choose how to tell it', 60000);
    await shot(page, 'desktop-style');
    await page.keyboard.press('Digit1');
    await until(page, () => __aw.G.phase === 'react' && !document.getElementById('result').hidden, 'the 1 key chooses Plain truth, and the result card shows');
    check(await Q(page, () => __aw.G.reading.result.stars === 3 && document.querySelectorAll('#result .beat.ok').length === 3 && document.querySelectorAll('#result .stars').length === 1), 'a perfect spread: three stars, three ticks');
    check(await Q(page, () => document.querySelectorAll('#result .chip.gain').length > 0), 'with what you learned listed');
    await shot(page, 'desktop-result');
    check(await Q(page, () => Object.keys(__aw.G.know.omen).length > 4), 'the Codex knows more than it did');

    // ---- pause, settings, the Codex
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await G(page, 'G.t'), pt0 = await G(page, 'G.pt');
    await page.waitForTimeout(700);
    check(await Q(page, ([t, p]) => __aw.G.t === t && __aw.G.pt === p, [t0, pt0]), 'the clock stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden && parseInt(document.getElementById('settings').style.zIndex) > parseInt(document.getElementById('pause').style.zIndex), 'Settings opens on top of the pause menu');
    await page.focus('#set-music');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await page.focus('#pause-menu [data-act="resume"]');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses a focused menu button (Resume)');
    await page.keyboard.press('KeyC');
    await until(page, () => !document.getElementById('codex').hidden && document.querySelectorAll('#codex-body .cx').length === 24, 'C opens the Codex with all 24 symbols');
    check(await Q(page, () => document.querySelectorAll('#codex-body .cx:not(.unk)').length === Object.keys(__aw.G.know.sym).length), 'the ones you know are named, the rest are ???');
    await Q(page, () => document.querySelector('#codex-tabs [data-tab="card"]').click());
    await until(page, () => document.querySelectorAll('#codex-body .cx.card').length === 22, 'the Cards tab shows the whole deck');
    await shot(page, 'desktop-codex');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('codex').hidden, 'Escape closes it');

    // ---- save and continue
    await Q(page, () => __aw.save());
    await Q(page, () => document.getElementById('btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    const day0 = await G(page, 'G.day + "/" + G.idx + "/" + G.xp');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __aw.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (d) => __aw.mode === 'play' && (__aw.G.day + '/' + __aw.G.idx + '/' + __aw.G.xp) === d, 'Continue restores the saved game', 30000, day0);

    // ---- an evening, and the prince
    await Q(page, () => __aw.playTo((G) => G.phase === 'dusk', { mode: 'perfect', romance: 'mirabel' }));
    await until(page, () => !document.getElementById('evening').hidden && document.querySelectorAll('#ev-options .evopt').length >= 2, 'dusk shows the evening screen with choices');
    await shot(page, 'desktop-dusk');
    await Q(page, () => document.querySelector('#ev-options .evopt:last-child').click());
    await until(page, () => document.getElementById('evening').hidden && __aw.G.phase === 'scene', 'choosing an evening closes the screen and begins it');
    await talkThrough(page);
    await Q(page, () => __aw.playTo((G) => G.phase === 'scene' && G.dlg?.ctx?.kind === 'prince' && G.dlg.i === G.dlg.lines.length - 1 && G.dlg.choices));
    await until(page, () => document.querySelectorAll('#dlg-choices .btn').length === 3, 'the Second Prince asks, and there are three answers', 60000);
    await shot(page, 'desktop-prince');
    await page.waitForTimeout(700);
    const tr0 = await G(page, 'G.trust');
    await Q(page, () => document.querySelector('#dlg-choices .btn').click());
    await until(page, (t) => __aw.G.trust >= t && __aw.G.dlg && !__aw.G.dlg.choices, 'an answer is chosen and his trust moves', 30000, tr0);

    // ---- the end
    await Q(page, () => __aw.playTo((G) => G.phase === 'festival', { mode: 'perfect', romance: 'mirabel' }));
    await until(page, () => !document.getElementById('evening').hidden && /Harvest Moon/.test(document.getElementById('ev-head').textContent), 'the festival night asks who to watch the fireworks with');
    await shot(page, 'desktop-festival');
    await Q(page, () => __aw.playTo((G) => G.phase === 'ending', { mode: 'perfect', romance: 'mirabel' }));
    await until(page, () => !document.getElementById('ending').hidden && document.querySelectorAll('#end-text p').length === 3, 'the ending screen shows its three paragraphs');
    check(await Q(page, () => __aw.G.ending.id === 'oracle' && document.getElementById('end-head').textContent === 'The Crown’s Oracle'), 'the best ending for a flawless seer');
    check(await Q(page, () => !__aw.hasSave()), 'and the finished game is not left as a save');
    await shot(page, 'desktop-ending');
    await Q(page, () => document.getElementById('end-again').click());
    await until(page, () => __aw.mode === 'play' && __aw.G.phase === 'prologue' && document.getElementById('ending').hidden, 'Begin Again starts a fresh game');
    // ---- the music is audible
    await Q(page, () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' })); __aw.audio.init(); });
    await page.waitForTimeout(3500);
    const lvl = await Q(page, () => ({ on: __aw.audio.on, peak: Math.max(...[0, 1, 2, 3, 4, 5].map(() => __aw.audio.level())) }));
    check(lvl.on ? lvl.peak > 0.004 : true, lvl.on ? `the score is audible (peak ${lvl.peak.toFixed(3)})` : 'audio context is not running in this browser (skipped)');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tap = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    const tapAt = (x, y) => page.touchscreen.tap(x, y);
    const noOverlap = (label) => Q(page, () => {
        const a = document.getElementById('back-link').getBoundingClientRect();
        const bad = [...document.querySelectorAll('button')].filter((b) => !b.hidden && b.getClientRects().length > 0 && b.id !== 'back-link').filter((b) => { const r = b.getBoundingClientRect(); return r.right > a.left && r.left < a.right && r.bottom > a.top && r.top < a.bottom; });
        return bad.map((b) => b.id || b.className || b.textContent.slice(0, 12));
    }).then((bad) => check(bad.length === 0, `${label}: no control sits under the ← Games link${bad.length ? ' (' + bad.join() + ')' : ''}`));
    const onScreen = (label, sels) => Q(page, (ss) => ss.flatMap((s) => [...document.querySelectorAll(s)]).filter((e) => !e.hidden && e.getClientRects().length > 0).map((e) => { const r = e.getBoundingClientRect(); return { s: e.id || e.className.toString().slice(0, 14), ok: r.width >= 43.5 && r.height >= 43.5 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; }), sels)
        .then((list) => check(list.length > 0 && list.every((z) => z.ok), `${label}: controls are at least 44 px and on screen${list.filter((z) => !z.ok).length ? ' (' + list.filter((z) => !z.ok).map((z) => z.s).join() + ')' : ''}`));

    check(await backLinkOk(page), '← Games link is on top');
    await noOverlap('title');
    await Q(page, () => { __aw.ui.settings.text = 'slow'; });
    await tap('#title-menu [data-act="new"]');
    await until(page, () => __aw.mode === 'play' && !document.getElementById('dlg').hidden, 'a tap on New Game starts play');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    await onScreen('prologue', ['#btn-pause', '#btn-codex', '#dlg-next']);
    // taps through the story: one tap finishes the line, the next goes on
    await tap('#dlg');
    await tap('#dlg');
    await until(page, () => __aw.G.dlg && __aw.G.dlg.i === 1, 'two taps on the box: the first finishes the typing, the second goes on');
    await Q(page, () => { __aw.ui.settings.text = 'fast'; });
    for (let i = 0; i < 12; i++) { if (!(await Q(page, () => !!__aw.G.dlg))) break; await tap('#dlg-next'); await tap('#dlg-next'); await page.waitForTimeout(80); }
    await until(page, () => !__aw.G.dlg && __aw.G.phase !== 'prologue', 'the prologue ends by touch');
    await until(page, () => __aw.G.phase === 'talk', 'the first guest comes in', 60000);
    for (let i = 0; i < 12; i++) { if (!(await Q(page, () => !!__aw.G.dlg))) break; await tap('#dlg-next'); await tap('#dlg-next'); await page.waitForTimeout(80); }
    await until(page, () => __aw.G.phase === 'ready' && document.querySelector('#actions .btn'), 'ready to gaze');
    await shot(page, `phone-${w}x${h}-ready`);
    await tap('#actions .btn');
    await until(page, () => __aw.G.phase === 'ball' && document.querySelectorAll('#vis-row .vis').length === 3, 'a tap gazes; three visions show', 60000);
    const vis = await Q(page, () => [...document.querySelectorAll('#vis-row .vis')].map((v) => { const r = v.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 40; }));
    check(vis.every(Boolean), 'all three vision chips fit across the screen');
    await shot(page, `phone-${w}x${h}-ball`);
    await until(page, () => __aw.G.ball.done, 'the ball clears', 60000);
    await tap('#actions .btn');
    await until(page, () => __aw.G.phase === 'deal' && document.querySelectorAll('#hand .hcard').length === 6, 'a tap draws the cards');
    await noOverlap('deal');
    await onScreen('deal', ['#btn-lay', '#slots .slot', '#btn-pause', '#btn-codex']);
    const hand = await Q(page, () => { const h = document.getElementById('hand'); return { sw: h.scrollWidth, cw: h.clientWidth }; });
    check(true, `the hand ${hand.sw > hand.cw ? 'scrolls sideways inside its row' : 'fits the width'} (${hand.sw}/${hand.cw})`);
    await tap('#hand .hcard:nth-child(1)');
    await until(page, () => __aw.G.reading.placed[0] === 0, 'a tap lays a card');
    await until(page, () => document.querySelectorAll('#slots .slot.filled').length === 1, 'the place shows the card');
    await tap('#slots .slot.filled');
    await until(page, () => __aw.G.reading.placed[0] === null, 'a tap on its place takes it back');
    await shot(page, `phone-${w}x${h}-deal`);
    await Q(page, async () => {
        const { cardPoints } = await import('./js/sim/reading.js');
        const R = __aw.G.reading, n = R.hand.length;
        let best = null;
        for (let a = 0; a < n && !best; a++) for (let b = 0; b < n && !best; b++) for (let c = 0; c < n && !best; c++) {
            if (a === b || b === c || a === c) continue;
            if ([a, b, c].every((k, i) => cardPoints(R.beats[i], R.hand[k].c, R.hand[k].r) === 2)) best = [a, b, c];
        }
        for (const h of best) __aw.act({ t: 'place', h });
    });
    await until(page, () => !document.getElementById('btn-lay').disabled, 'three cards in place');
    await tap('#btn-lay');
    await until(page, () => __aw.G.phase === 'style' && document.querySelectorAll('#styles .btn').length === 3, 'a tap lays them; they turn; the styles show', 60000);
    await onScreen('styles', ['#styles .btn']);
    await shot(page, `phone-${w}x${h}-style`);
    await tap('#styles .btn:nth-child(2)');
    await until(page, () => __aw.G.phase === 'react' && !document.getElementById('result').hidden, 'a tap chooses how to tell it; the result shows');
    const res = await Q(page, () => { const r = document.getElementById('result').getBoundingClientRect(), d = document.getElementById('dlg').getBoundingClientRect(); return { fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0, gap: d.top - r.bottom }; });
    check(res.fits, 'the result card fits on screen');
    await shot(page, `phone-${w}x${h}-result`);

    // a menu opened by a finger stays open when the finger lifts
    await tap('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(350);
    check(await visible(page, '#pause'), 'the pause screen stays open after the finger lifts');
    await noOverlap('pause');
    await tap('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await tap('#btn-codex');
    await until(page, () => !document.getElementById('codex').hidden, 'tapping the book opens the Codex');
    await noOverlap('codex');
    await onScreen('codex', ['#codex-tabs button', '#codex .sheet-foot .btn']);
    await shot(page, `phone-${w}x${h}-codex`);
    await tap('#codex .sheet-foot .btn');
    await until(page, () => document.getElementById('codex').hidden, 'and closes');

    // a second tap right after the typing finishes must not choose an answer
    await Q(page, () => __aw.playTo((G) => G.phase === 'scene' && G.dlg?.ctx?.kind === 'prince' && G.dlg.i === G.dlg.lines.length - 2 && G.dlg.choices, { mode: 'perfect', romance: 'none' }));
    await until(page, () => !!document.getElementById('dlg') && !document.getElementById('dlg').hidden && __aw.G.dlg?.choices && __aw.G.dlg.i === __aw.G.dlg.lines.length - 2, 'a night scene with choices is up');
    for (let i = 0; i < 4 && (await Q(page, () => __aw.G.dlg.i < __aw.G.dlg.lines.length - 1)); i++) { await tap('#dlg-next'); await page.waitForTimeout(120); }   // finish the line, go on to the last
    await until(page, () => __aw.G.dlg.i === __aw.G.dlg.lines.length - 1, 'the last line before the answers');
    await page.waitForTimeout(150);
    const box = await Q(page, () => { const r = document.getElementById('dlg-text').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await tapAt(box.x, box.y);                               // finishes the typing; the answers appear
    await until(page, () => document.querySelectorAll('#dlg-choices .btn').length === 3, 'the first tap finishes the typing and the answers appear');
    const c0 = await Q(page, () => { const r = document.querySelector('#dlg-choices .btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await tapAt(c0.x, c0.y);                                 // a quick second tap, right where an answer is
    await page.waitForTimeout(250);
    check(await Q(page, () => !!__aw.G.dlg?.choices), 'a second tap straight away does not pick an answer');
    await page.waitForTimeout(700);
    await shot(page, `phone-${w}x${h}-choices`);
    await onScreen('choices', ['#dlg-choices .btn']);
    const c1 = await Q(page, () => { const r = document.querySelector('#dlg-choices .btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await tapAt(c1.x, c1.y);
    await until(page, () => !__aw.G.dlg?.choices, 'but a considered tap does');

    // the evening screen
    await Q(page, () => __aw.playTo((G) => G.phase === 'dusk', { mode: 'perfect', romance: 'wren' }));
    await until(page, () => !document.getElementById('evening').hidden, 'the evening screen shows');
    await noOverlap('evening');
    await onScreen('evening', ['#ev-options .evopt']);
    await shot(page, `phone-${w}x${h}-dusk`);
    await tap('#ev-options .evopt:last-child');
    await until(page, () => __aw.G.phase === 'scene', 'a tap chooses an evening');
    await Q(page, () => __aw.playTo((G) => G.phase === 'ending', { mode: 'perfect', romance: 'wren' }));
    await until(page, () => !document.getElementById('ending').hidden, 'the ending shows');
    await noOverlap('ending');
    await onScreen('ending', ['#end-again', '#end-menu']);
    const endFit = await Q(page, () => { const s = document.querySelector('#ending .sheet'); return s.scrollWidth <= s.clientWidth + 1; });
    check(endFit, 'the ending sheet does not scroll sideways');
    await shot(page, `phone-${w}x${h}-ending`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __aw.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __aw.playTo((G) => G.phase === 'deal', { mode: 'perfect' }));
    await until(page, () => document.querySelectorAll('#hand .hcard').length === 6, 'plays up to the cards');
    check(await Q(page, () => __aw.save() === false && !__aw.hasSave()), 'saving fails quietly');
    await Q(page, () => __aw.playTo((G) => G.phase === 'ending', { mode: 'perfect', romance: 'elias' }));
    await until(page, () => !document.getElementById('ending').hidden, 'and the whole story can be played through');
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
