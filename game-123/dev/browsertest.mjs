/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): boot to the title with the attract demo charting behind it, no errors, the
 *   ← Games link on top → New Season by click → the brief appears and the clock waits → Begin →
 *   real key presses move the quill → holding Space focuses and releasing casts → Escape pauses and the
 *   sim stops → Space presses the focused Resume → Escape closes Settings even with a slider focused →
 *   Enter asks before handing over → the result and its stars → Next opens the next brief → Save & Quit →
 *   Continue restores the sheet → a whole season through to the end screen → Play Again.
 *   Enter on Begin must not also open the hand-over dialog. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck,
 *   the stick moves the quill, a held SCRY button focuses and casts (while the stick moves, with two
 *   fingers), ✓ asks before handing over, controls ≥ 44 px and on screen, no sideways scroll, the canvas
 *   matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8123          # from the REPO ROOT
 *   node game-123/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8123), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8123';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, query = '&fast=4&seed=5' } = {}) {
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
    await page.goto(`${BASE}/game-123/index.html?debug=1${query}`);
    await page.waitForFunction(() => window.__ai && __ai.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const shown = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden; }, id);
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
/** A pop-in animation may not have drawn a frame yet: finish them so a tap lands on the final layout. */
const settle = (page) => Q(page, () => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* */ } }));

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await shown(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await until(page, () => __ai.G.ink.some((v) => v), 'the attract demo charts a map behind the title', 30000);
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    // New Season → the brief, with the clock waiting
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ai.mode === 'play' && !document.getElementById('brief').hidden, 'New Season opens the first client’s brief');
    check(await Q(page, () => document.getElementById('brief-name').textContent === 'Farmer Hobb' && __ai.G.commissions[0].kind === 'farm'), 'the first client is Farmer Hobb');
    const t0 = await Q(page, () => __ai.G.timeLeft);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __ai.G.timeLeft === t, t0), 'the clock waits while the brief is open');
    await shot(page, 'desktop-brief');

    // Enter on Begin must start play, not also open the hand-over dialog
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('brief').hidden, 'Enter on Begin closes the brief');
    await page.waitForTimeout(400);
    check(await Q(page, () => document.getElementById('confirm').hidden && __ai.G.phase === 'work'), 'and the same Enter does not open the hand-over dialog');
    await until(page, (t) => __ai.G.timeLeft < t - 0.5, 'the clock runs once play begins', 30000, t0);

    // real keys move the quill
    const x0 = await Q(page, () => __ai.G.q.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __ai.G.q.x > x + 2, 'holding → moves the quill right', 30000, x0);
    await page.keyboard.up('ArrowRight');

    // hold Space to focus, release to cast
    await page.keyboard.down('Space');
    await until(page, () => __ai.G.channel && __ai.G.channel.focus > 0.95, 'holding Space builds focus');
    await shot(page, 'desktop-focus');
    const casts = await Q(page, () => __ai.G.casts);
    await page.keyboard.up('Space');
    await until(page, (n) => __ai.G.casts > n && !__ai.G.channel && __ai.seen.scry >= 1, 'releasing Space casts the spell', 30000, casts);
    check(await Q(page, () => __ai.G.ink.filter((v) => v).length > 60), 'and ink lands on the parchment');

    // a quick tap is a small, rough cast, and is never lost
    const n1 = await Q(page, () => __ai.G.casts);
    await page.keyboard.press('Space');
    await until(page, (n) => __ai.G.casts > n, 'a quick tap of Space still casts', 30000, n1);

    // pause: Escape, frozen sim, Space on the focused Resume
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t1 = await Q(page, () => __ai.G.timeLeft);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __ai.G.timeLeft === t, t1), 'the sim stops while paused');
    check(await Q(page, () => document.activeElement?.dataset?.act === 'resume'), 'Resume has the focus');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button');
    await page.waitForTimeout(300);
    check(await Q(page, (t) => __ai.G.timeLeft < t && !__ai.G.channel, t1), 'play resumes and the Space that resumed it did not start a spell');

    // Escape closes Settings even though a slider has the focus
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'paused again');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden && document.activeElement?.tagName === 'INPUT', 'Settings opens with a slider focused');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden, 'Escape closes Settings with the slider focused');
    await click(page, '#pause-menu [data-act="brief"]');
    await until(page, () => !document.getElementById('brief').hidden, 'the pause menu can reread the commission');
    check(await Q(page, () => document.getElementById('brief-go').textContent === 'Back to the map'), 'whose button says Back to the map');
    await click(page, '#brief-go');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'Escape resumes');
    await page.waitForTimeout(200);                    // a key pressed in the very frame a screen closes is, by design, dropped

    // hand over: asks first
    await Q(page, () => __ai.ff(6));
    check(await Q(page, () => __ai.G.phase === 'work'), 'six seconds of a bot’s work leave the commission running');
    await page.keyboard.press('Enter');
    await until(page, () => !document.getElementById('confirm').hidden, 'Enter asks before handing over');
    check(await Q(page, () => document.activeElement?.textContent.includes('Keep working')), 'with Keep working focused, so a stray Enter is harmless');
    await click(page, '#confirm [data-close]');
    check(await Q(page, () => __ai.G.phase === 'work' && document.getElementById('confirm').hidden), 'Keep working goes back to the map');
    await page.waitForTimeout(150);                    // a key pressed in the very frame a screen closes is, by design, dropped
    await page.keyboard.press('KeyE');
    await until(page, () => !document.getElementById('confirm').hidden, 'E asks too');
    await click(page, '#confirm-yes');
    await until(page, () => __ai.G.phase === 'result' && !document.getElementById('result').hidden, 'handing over shows the result');
    check(await Q(page, () => document.querySelectorAll('#result-stars').length === 1 && __ai.G.result.stars >= 1 && document.getElementById('result-lines').children.length >= 2), 'with stars and the numbers behind them');
    check(await Q(page, () => /points|payment/.test(document.getElementById('result-points').textContent)), 'and the points');
    await shot(page, 'desktop-result');

    // on to the next client
    await click(page, '#result-next');
    await until(page, () => __ai.G.idx === 1 && !document.getElementById('brief').hidden && document.getElementById('brief-name').textContent === 'Brunna Deepdelve', 'Next opens the prospector’s brief');
    await click(page, '#brief-go');
    await until(page, () => document.getElementById('brief').hidden, 'Begin');
    await Q(page, () => __ai.ff(6));

    // Save & Quit → Continue
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    const inkBefore = await Q(page, () => __ai.G.ink.filter((v) => v).length);
    const idxBefore = await Q(page, () => __ai.G.idx);
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ai.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (a) => __ai.mode === 'play' && __ai.G.idx === a[0] && __ai.G.ink.filter((v) => v).length === a[1], 'Continue restores the commission and the sheet', 30000, [idxBefore, inkBefore]);
    check(await Q(page, () => document.getElementById('brief').hidden && __ai.G.phase === 'work'), 'straight back to the map, no brief in the way');

    // a whole season
    const left = 6 - (await Q(page, () => __ai.G.idx));
    for (let k = 0; k < left; k++) {
        await Q(page, () => { if (__ai.G.phase === 'work') __ai.finish(); });
        await until(page, () => !document.getElementById('result').hidden || !document.getElementById('over').hidden, `commission ${6 - left + k + 1} ends in a result`, 30000);
        if (k < left - 1) { await click(page, '#result-next'); await until(page, () => !document.getElementById('brief').hidden, 'the next brief opens'); await click(page, '#brief-go'); }
        else await click(page, '#result-next');
    }
    await until(page, () => __ai.mode === 'over' && !document.getElementById('over').hidden, 'the season ends on the end screen');
    check(await Q(page, () => document.getElementById('over-list').children.length === 6 && document.getElementById('over-rank').textContent.length > 3), 'with a rank and six results');
    check(await Q(page, () => !__ai.hasSave()), 'a finished season clears the save');
    await shot(page, 'desktop-over');
    await click(page, '#over-menu');
    await until(page, () => __ai.mode === 'title' && /Best season/.test(document.getElementById('best').textContent), 'back at the title, which remembers the best season');
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ai.mode === 'play' && __ai.G.idx === 0 && !document.getElementById('brief').hidden, 'a new season starts at the first client');
    const L2 = await layout(page);
    check(L2.noHScroll && L2.canvas, 'still no sideways scroll');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const centre = (sel) => Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    const tapSel = async (sel) => {
        await settle(page);
        const r = await centre(sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ai.mode === 'play' && !document.getElementById('brief').hidden, 'a tap on New Season shows the brief');
    const sheet = await Q(page, () => { const r = document.querySelector('#brief .sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1 || document.querySelector('#brief .sheet').scrollHeight > document.querySelector('#brief .sheet').clientHeight; });
    check(sheet, 'the brief fits on the screen (or scrolls inside its sheet)');
    await shot(page, `phone-${w}x${h}-brief`);
    await tapSel('#brief-go');
    await until(page, () => __ai.mode === 'play' && document.getElementById('brief').hidden, 'a tap on Begin starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-a', '#btn-d', '#btn-pause', '#btn-brief'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => {
        const a = document.getElementById('back-link').getBoundingClientRect(), p = document.getElementById('btn-brief').getBoundingClientRect();
        return a.right <= p.left;
    }), 'the HUD does not run under the ← Games link');

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __ai.G.q.x);
    await touch('touchStart', [{ x: zone.x, y: zone.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: zone.x + i * 12, y: zone.y, id: 1 }]);
    await until(page, (x) => __ai.G.q.x > x + 1, 'dragging the stick moves the quill', 30000, x0);

    // with the stick still down, a second finger holds SCRY: focus bleeds while moving, then the cast lands
    const a = await centre('#btn-a');
    const cast0 = await Q(page, () => __ai.G.casts);
    await touch('touchStart', [{ x: zone.x + 72, y: zone.y, id: 1 }, { x: a.x, y: a.y, id: 2 }]);
    await until(page, () => !!__ai.G.channel, 'a second finger on SCRY starts a spell while the stick is down');
    await touch('touchEnd', [{ x: a.x, y: a.y, id: 2 }]);
    await until(page, (n) => __ai.G.casts > n && !__ai.G.channel, 'lifting it casts', 30000, cast0);
    check(await Q(page, () => __ai.G.events.length === 0 || true) && await Q(page, () => __ai.seen.scry >= 1), 'and the scry event reached the view');
    await touch('touchEnd', []);
    await until(page, () => !document.getElementById('stick').classList.contains('on'), 'the stick lets go');

    // hold SCRY alone for a steady cast
    const cast1 = await Q(page, () => __ai.G.casts);
    await touch('touchStart', [{ x: a.x, y: a.y, id: 3 }]);
    await until(page, () => __ai.G.channel && __ai.G.channel.focus > 0.95, 'holding SCRY alone builds full focus');
    await shot(page, `phone-${w}x${h}-focus`);
    await touch('touchEnd', []);
    await until(page, (n) => __ai.G.casts > n && !__ai.G.channel, 'letting go casts', 30000, cast1);
    check(await Q(page, () => document.getElementById('btn-a').classList.contains('down') === false), 'the SCRY button pops back up');

    // a short tap on SCRY is a quick cast and is never dropped
    const cast2 = await Q(page, () => __ai.G.casts);
    await tapSel('#btn-a');
    await until(page, (n) => __ai.G.casts > n, 'a tap on SCRY casts a rough spell', 30000, cast2);

    // the hand-over button asks first
    await tapSel('#btn-d');
    await until(page, () => !document.getElementById('confirm').hidden, 'tapping ✓ asks before handing over');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('confirm').hidden), 'the dialog stays open after the finger lifts');
    await tapSel('#confirm [data-close]');
    await until(page, () => document.getElementById('confirm').hidden && __ai.G.phase === 'work', 'Keep working closes it');

    // pause by touch
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // the result, by touch
    await Q(page, () => __ai.ff(6));
    await tapSel('#btn-d');
    await until(page, () => !document.getElementById('confirm').hidden, 'asks again');
    await tapSel('#confirm-yes');
    await until(page, () => !document.getElementById('result').hidden, 'handing over shows the result');
    const fits = await Q(page, () => { const s = document.querySelector('#result .sheet'); const r = s.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && (r.bottom <= innerHeight + 1 || s.scrollHeight > s.clientHeight); });
    check(fits, 'the result sheet is on screen');
    await shot(page, `phone-${w}x${h}-result`);
    await tapSel('#result-next');
    await until(page, () => !document.getElementById('brief').hidden && __ai.G.idx === 1, 'a tap on Next opens the next brief');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ai.mode === 'play', 'boots and starts a season with localStorage throwing');
    await click(page, '#brief-go');
    await Q(page, () => __ai.ff(3));
    check(await Q(page, () => __ai.save() === false), 'saving fails quietly');
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
