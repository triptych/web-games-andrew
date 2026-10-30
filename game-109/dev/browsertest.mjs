/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): boots to the title (a demo plays behind it) with no errors, the ← Games link on
 *   top, the canvas filling the window and actually drawing → Start Game by click → real key presses
 *   move the ship, hold fire shoots, X sets off a bomb → Escape pauses and the sim stops → Space on the
 *   focused Resume button resumes → the pause button → Save & Quit → Continue restores the game → the
 *   last ship goes, the game-over sheet asks for initials, the score lands in the table and survives a
 *   reload → Play Again. The title's High Scores, How to Play and Settings (calm mode) open and close.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck
 *   appears, auto-fire is on and the FIRE button hidden, the stick moves the ship, BOMB bombs, with
 *   auto-fire off the FIRE button fires while held and stops when let go, controls ≥ 44 px and on
 *   screen, no sideways scroll, the canvas matches the visible viewport, the field sits clear of the
 *   ← Games link and the pause button.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8109          # from the REPO ROOT
 *   node game-109/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8109), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8109';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, keepStorage = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(({ ns, keep }) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!keep && !sessionStorage.getItem('__cleared')) { try { localStorage.clear(); sessionStorage.setItem('__cleared', '1'); } catch { /* */ } }
    }, { ns: nostorage, keep: keepStorage });
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-109/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__sb && __sb.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// Wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle; click from inside the page instead.
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
    const c = document.getElementById('view').getBoundingClientRect(), v = __sb.view;
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
        field: { x: v.ox, y: v.oy, w: v.dw, h: v.dh },
        inside: v.ox >= 0 && v.oy >= 44 && v.ox + v.dw <= innerWidth + 1 && v.oy + v.dh <= innerHeight + 1,
    };
});
/** Is the canvas actually showing a picture? Counts bright and coloured pixels over a grid. */
const lit = (page) => Q(page, () => {
    const c = document.getElementById('view'), g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let bright = 0, colours = new Set();
    for (let y = 0; y < c.height; y += 7) for (let x = 0; x < c.width; x += 7) {
        const i = (y * c.width + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r + gg + b > 330) bright++;
        colours.add(((r >> 5) << 6) | ((gg >> 5) << 3) | (b >> 5));
    }
    return { bright, colours: colours.size };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(L.inside, 'the field sits inside the window, clear of the ← Games link');
    // the attract demo is playing behind the title
    await until(page, () => __sb.G.t > 3 && __sb.G.stats.shots > 5, 'a demo plays behind the title (the bot is shooting)');
    const pic = await lit(page);
    check(pic.bright > 40 && pic.colours > 12, `the canvas is drawing a real picture (${pic.bright} bright samples, ${pic.colours} colours)`);
    await shot(page, 'desktop-title');

    // the title's other screens
    await click(page, '#title-menu [data-act="scores"]');
    await until(page, () => !document.getElementById('scores').hidden && document.querySelectorAll('#score-table li').length === 5, 'High Scores shows a table of five');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('scores').hidden, 'Escape closes it');
    await click(page, '#title-menu [data-act="howto"]');
    await until(page, () => !document.getElementById('howto').hidden, 'How to Play opens');
    await click(page, '#howto [data-close]');
    await until(page, () => document.getElementById('howto').hidden, '... and closes');
    await click(page, '#title-menu [data-act="settings"]');
    await Q(page, () => { const s = document.getElementById('set-effects'); s.value = 'calm'; s.dispatchEvent(new Event('change')); });
    check(await Q(page, () => __sb.view.fx.calm === true && __sb.settings.effects === 'calm'), 'Settings: calm mode switches the flashes and shake down');
    await Q(page, () => { const s = document.getElementById('set-effects'); s.value = 'full'; s.dispatchEvent(new Event('change')); });
    await click(page, '#settings [data-close]');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sb.mode === 'play' && document.getElementById('title').hidden, 'Start Game starts play');
    check(await Q(page, () => !document.getElementById('btn-pause').hidden), 'the pause button is shown');

    // real keys
    const x0 = await Q(page, () => __sb.G.player.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __sb.G.player.x > x + 8, 'holding → moves the ship right', 30000, x0);
    await page.keyboard.up('ArrowRight');
    const shots0 = await Q(page, () => __sb.seen.shoot || 0);
    await page.keyboard.down('Space');
    await until(page, (n) => (__sb.seen.shoot || 0) > n + 6, 'holding Space fires a stream of shots', 30000, shots0);
    await page.keyboard.up('Space');
    await Q(page, () => { __sb.ff(8); });
    const bombs = await Q(page, () => __sb.G.bombs);
    await page.keyboard.press('KeyX');
    await until(page, (b) => __sb.G.bombs === b - 1 && (__sb.seen.bomb || 0) >= 1, 'X sets off a bomb (one fewer, and a bomb event)', 30000, bombs);
    await page.waitForTimeout(300);
    await shot(page, 'desktop-play');

    // pause, and Space on the focused Resume button
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __sb.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __sb.G.t === t, t0), 'the sim stops while paused');
    check(await Q(page, () => document.activeElement?.textContent.trim() === 'Resume'), 'Resume is focused');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes (a real key press)');
    await until(page, (t) => __sb.G.t > t + 0.3, 'time runs again', 30000, t0);
    // a key that closed the pause screen must not also have fired
    check(await Q(page, () => __sb.G.pbullets.length < 3), 'the key that resumed did not also fire a volley');

    // the pause button, then Save & Quit, then Continue
    await Q(page, () => { __sb.ff(10); });
    const score = await Q(page, () => __sb.G.score), wave = await Q(page, () => __sb.G.wave);
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __sb.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, ([s, w]) => __sb.mode === 'play' && __sb.G.score === s && __sb.G.wave === w, 'Continue restores the saved game', 30000, [score, wave]);

    // game over → initials → table → persists
    await Q(page, () => { __sb.G.score = 70000; __sb.die(true); });
    await until(page, () => __sb.mode === 'over' && !document.getElementById('over').hidden, 'the last ship goes and the game-over sheet opens');
    check(await Q(page, () => !document.getElementById('over-entry').hidden), 'a score in the table asks for initials');
    await shot(page, 'desktop-over');
    await Q(page, () => { document.getElementById('over-name').value = 'ZED'; });
    await Q(page, () => document.getElementById('over-save').click());
    await until(page, () => !document.getElementById('over-table').hidden && document.querySelector('#over-table li.me .n')?.textContent === 'ZED', 'the score is entered in the table under ZED');
    check(await Q(page, () => document.querySelectorAll('#over-table li').length === 5), 'the table still has five rows');
    await click(page, '#over-quit');
    await until(page, () => __sb.mode === 'title' && document.getElementById('hiscore').textContent === '070000', 'the title shows the new hi-score');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'a finished game leaves no save to continue');
    await page.reload();
    await page.waitForFunction(() => window.__sb && __sb.mode === 'title', null, { timeout: 60000 });
    check(await Q(page, () => document.getElementById('hiscore').textContent === '070000'), 'the high score survives a reload');
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sb.mode === 'play' && __sb.G.wave === 1, 'a new game starts at wave 1');

    // the announcer: a boss wave speaks its warning; the Voice setting silences it; a pause cancels it
    await Q(page, () => {
        window.__spoken = []; window.__cancels = 0;
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { __spoken.push(u.text); }, cancel() { __cancels++; } } });
        __sb.wave(5);
    });
    await until(page, () => __spoken.length === 1 && /Mothership/.test(__spoken[0]), 'a boss wave announces itself by voice ("Warning! Mothership approaching.")');
    await Q(page, () => { __sb.wave(10); });
    await until(page, () => /Crab Warden/.test(__spoken[__spoken.length - 1]), 'each boss is announced by name');
    await Q(page, () => { const s = document.getElementById('set-voice'); s.value = 'off'; s.dispatchEvent(new Event('change')); __sb.wave(15); });
    await page.waitForTimeout(300);
    check(await Q(page, () => __spoken.length === 2), 'with the announcer voice off, nothing is spoken');
    await Q(page, () => { const s = document.getElementById('set-voice'); s.value = 'on'; s.dispatchEvent(new Event('change')); __cancels = 0; });
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => __cancels > 0, 'pausing cancels any speech in progress');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'resume after the voice test');

    // a boss, looked at
    await Q(page, () => { __sb.wave(5); __sb.G.player.weapon = 4; __sb.G.player.inv = 1e9; __sb.ff(10); });
    await page.waitForTimeout(250);
    await shot(page, 'desktop-boss');
    const pic2 = await lit(page);
    check(pic2.bright > 40 && pic2.colours > 12, `the boss fight is drawn (${pic2.bright} bright samples, ${pic2.colours} colours)`);
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    const L0 = await layout(page);
    check(L0.noHScroll && L0.canvas, 'title: no sideways scroll; the canvas matches the visible viewport');
    check(L0.inside, 'the field sits inside the window, below the ← Games link and pause button band');
    await shot(page, `phone-${w}x${h}-title`);
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __sb.mode === 'play', 'a tap on Start Game starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    check(await Q(page, () => __sb.input.autofire === true && getComputedStyle(document.getElementById('btn-a')).display === 'none'), 'auto-fire is on by default and the FIRE button is hidden');
    await until(page, () => (__sb.seen.shoot || 0) > 8, 'the ship shoots without a finger on a fire button');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    check(L.inside, 'the field is inside the window');
    await Q(page, () => { __sb.G.player.inv = 1e9; });

    const sizes = await Q(page, () => ['#btn-b', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.5 }; });
    await Q(page, () => { __sb.G.player.x = 60; });
    const x0 = await Q(page, () => __sb.G.player.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __sb.G.player.x > x + 8, 'dragging the stick moves the ship', 30000, x0);
    await touch('touchEnd', 0, 0);

    // constant speed: a short drag and a long drag steer at the same speed, and a small pull-back stops
    const stickState = () => Q(page, () => { const s = __sb.input.state(); return Math.hypot(s.x, s.y); });
    await touch('touchStart', zone.x, zone.y);
    await touch('touchMove', zone.x + 12, zone.y);
    const short = await stickState();
    for (let i = 1; i <= 8; i++) await touch('touchMove', zone.x + 12 + i * 20, zone.y);
    const long = await stickState();
    check(Math.abs(short - 1) < 0.01 && Math.abs(long - 1) < 0.01, `the stick is constant speed (a 12 px drag gives ${short.toFixed(2)}, a 170 px drag ${long.toFixed(2)})`);
    const back = await Q(page, () => __sb.input.stick.ox);
    await touch('touchMove', back + 20 - 0, zone.y);          // 20 px of the thumb: near the leash, still going
    for (let i = 0; i < 4; i++) await touch('touchMove', back + 3, zone.y);   // ... then back to within 3 px of the base
    check(await stickState() === 0, 'pulling the thumb back a few px stops the ship (no rubber band)');
    await touch('touchEnd', 0, 0);

    // a touch anywhere is the stick: far on the right and near the top, and moving left
    await Q(page, () => { __sb.G.player.x = 150; });
    const far = await Q(page, () => ({ x: innerWidth * 0.8, y: __sb.view.oy + __sb.view.dh * 0.3 }));
    const x1 = await Q(page, () => __sb.G.player.x);
    await touch('touchStart', far.x, far.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', far.x - i * 12, far.y);
    await until(page, (x) => __sb.G.player.x < x - 8, 'a drag started anywhere on the screen steers the ship (far right, high up)', 30000, x1);
    await touch('touchEnd', 0, 0);
    // ... but a touch that lands on the BOMB button is the button's, not the stick's
    const bb = await Q(page, () => { const r = document.getElementById('btn-b').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await touch('touchStart', bb.x, bb.y, 3);
    await page.waitForTimeout(150);
    check(await Q(page, () => __sb.input.stick.active === false), 'a touch on BOMB does not start the stick');
    await touch('touchEnd', 0, 0, 3);
    await Q(page, () => { __sb.G.bombs = Math.max(__sb.G.bombs, 2); __sb.G.bombFx = null; });

    // BOMB
    const bombs = await Q(page, () => __sb.G.bombs);
    await tapSel('#btn-b');
    await until(page, (b) => __sb.G.bombs === b - 1, 'tapping BOMB sets off a bomb', 30000, bombs);
    await page.waitForTimeout(300);
    await shot(page, `phone-${w}x${h}`);

    // pause by touch
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // with auto-fire off, FIRE fires while held and stops when let go
    await Q(page, () => { const s = document.getElementById('set-autofire'); s.value = 'off'; s.dispatchEvent(new Event('change')); });
    check(await Q(page, () => getComputedStyle(document.getElementById('btn-a')).display !== 'none' && !__sb.input.autofire), 'auto-fire off: the FIRE button appears');
    const fire = await Q(page, () => { const r = document.getElementById('btn-a').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: r.width >= 44 && r.height >= 44 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    check(fire.ok, 'the FIRE button is at least 44 px and on screen');
    await Q(page, () => { __sb.G.pbullets.length = 0; });
    await page.waitForTimeout(400);
    const idle = await Q(page, () => __sb.seen.shoot || 0);
    await page.waitForTimeout(400);
    check(await Q(page, (n) => (__sb.seen.shoot || 0) === n, idle), 'with no finger on FIRE the ship is quiet');
    await touch('touchStart', fire.x, fire.y, 2);
    await until(page, (n) => (__sb.seen.shoot || 0) > n + 5, 'holding FIRE shoots', 30000, idle);
    await touch('touchEnd', 0, 0, 2);
    await page.waitForTimeout(300);
    const after = await Q(page, () => __sb.seen.shoot || 0);
    await page.waitForTimeout(500);
    check(await Q(page, (n) => (__sb.seen.shoot || 0) <= n + 1, after), 'letting go of FIRE stops the shooting');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    check(await Q(page, () => document.getElementById('hiscore').textContent === '060000'), 'the default high-score table still shows');
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sb.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __sb.ff(3));
    check(await Q(page, () => __sb.save() === false), 'saving fails quietly');
    await Q(page, () => { __sb.G.score = 99999; __sb.die(true); });
    await until(page, () => __sb.mode === 'over', 'the game still ends');
    await Q(page, () => document.getElementById('over-save').click());
    await until(page, () => !document.getElementById('over-table').hidden, 'the initials form still works');
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
