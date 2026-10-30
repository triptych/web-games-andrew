/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): boots to the title (a demo plays behind it) with no errors, the ← Games link on
 *   top, the canvas filling the window and actually drawing → Start Game by click → real key presses
 *   move the ship, hold fire shoots, X sets off a bomb → Escape pauses and the sim stops → Space on the
 *   focused Resume button resumes → the pause button → Save & Quit → Continue restores the game → the
 *   last ship goes, the game-over sheet asks for initials, the score lands in the table and survives a
 *   reload → Play Again → after a boss the ship flies to the mothership and the Hangar opens (Escape does
 *   not close it, Space buys on a focused row, Launch flies back out), and a game saved in the hangar
 *   comes back to it. The title's High Scores, How to Play and Settings (calm mode) open and close.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck
 *   appears, auto-fire is on and the FIRE button hidden, the stick moves the ship, BOMB bombs, with
 *   auto-fire off the FIRE button fires while held and stops when let go, controls ≥ 44 px and on
 *   screen, no sideways scroll, the canvas matches the visible viewport, the field sits clear of the
 *   ← Games link and the pause button.
 * story (desktop and a phone): the intro cutscene opens on a new game and pauses it, Next types out and moves on,
 *   Skip and Escape end it, Mira's comm strip follows, a boss arrival and the dock after the first boss have
 *   cutscenes (the hangar waits behind the second), the Story setting turns it all off, Mira has a word on the
 *   game-over sheet, and it all fits a phone.
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

async function open(viewport, { touch = false, nostorage = false, keepStorage = false, story = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(({ ns, keep, story }) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!keep && !sessionStorage.getItem('__cleared')) {
            try {
                localStorage.clear(); sessionStorage.setItem('__cleared', '1');
                // the story has its own test group; everything else plays without the cutscenes
                if (!story) localStorage.setItem('starblazer-86.v1.settings', JSON.stringify({ story: 'off' }));
            } catch { /* */ }
        }
    }, { ns: nostorage, keep: keepStorage, story });
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
    // menus by keyboard alone: arrows move, Z (the fire key) presses the highlighted button, X goes back
    check(await Q(page, () => document.activeElement?.textContent.trim() === 'Start Game'), 'the title starts with Start Game highlighted');
    await page.keyboard.press('ArrowDown');
    check(await Q(page, () => document.activeElement?.textContent.trim() === 'High Scores'), 'the down arrow moves the highlight');
    await page.keyboard.press('KeyZ');
    await until(page, () => !document.getElementById('scores').hidden && document.querySelectorAll('#score-table li').length === 5, 'Z presses the highlighted button (High Scores shows a table of five)');
    await page.keyboard.press('KeyX');
    await until(page, () => document.getElementById('scores').hidden, 'X goes back');
    await page.keyboard.press('KeyS'); await page.waitForTimeout(80); await page.keyboard.press('KeyS');
    await until(page, () => document.activeElement?.textContent.trim() === 'How to Play', 'S moves the highlight down too');
    await page.keyboard.press('KeyW');
    await until(page, () => document.activeElement?.textContent.trim() === 'High Scores', 'and W moves it up');
    await page.keyboard.press('KeyS');
    await until(page, () => document.activeElement?.textContent.trim() === 'How to Play', 'back on How to Play');
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('howto').hidden, 'J presses it as well');
    await page.keyboard.press('KeyZ');                                      // the highlighted Got it
    await until(page, () => document.getElementById('howto').hidden, 'Z presses Got it');
    await click(page, '#title-menu [data-act="scores"]');
    await until(page, () => !document.getElementById('scores').hidden, 'High Scores opens by click as well');
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
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    const [score, wave, clock] = await Q(page, () => [__sb.G.score, __sb.G.wave, __sb.G.t]);      // read once it is paused
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __sb.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    // the game runs on after Continue, so compare with "no less than": a restore that failed would be back at time 0
    await until(page, ([s, w, t]) => __sb.mode === 'play' && __sb.G.score >= s && __sb.G.wave >= w && __sb.G.t >= t, 'Continue restores the saved game', 30000, [score, wave, clock]);

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

    // the hangar: after a boss the ship flies to the mothership and the shop opens
    await Q(page, () => { const G = __sb.G; G.enemies.length = 0; G.ebullets.length = 0; G.plan.idx = G.plan.orders.length; G.credits = 300; __sb.dock(); });
    await page.waitForTimeout(300);
    await shot(page, 'desktop-docking');
    await until(page, () => !document.getElementById('dock').hidden && __sb.G.dock?.st === 'shop', 'the ship flies to the mothership and the Hangar opens');
    check(await Q(page, () => document.getElementById('dock-cr').textContent === '300'), 'the Hangar shows the credits');
    check(await Q(page, () => document.activeElement?.classList.contains('dock-row')), 'focus starts on an item, not on Launch (a stray Space cannot launch)');
    check(await Q(page, () => document.querySelectorAll('#dock .dock-row').length === 9), 'six upgrades and three supplies are listed');
    await shot(page, 'desktop-hangar');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(await Q(page, () => !document.getElementById('dock').hidden), 'Escape does not close the Hangar (you launch from it)');
    await page.keyboard.press('Space');
    await until(page, () => __sb.G.upg.engine === 1 && __sb.G.credits === 260, 'Space on the focused ENGINES row buys it (40 credits)');
    check(await Q(page, () => document.querySelectorAll('[data-buy="engine"] .pips i.on').length === 1), 'its level box fills in');
    await click(page, '[data-buy="cannon"]');
    await until(page, () => __sb.G.upg.cannon === 1 && __sb.G.credits === 210, 'clicking CANNONS buys it (50 credits)');
    await Q(page, () => { __sb.G.credits = 5; __sb.ui.renderDock(__sb.G); });
    check(await Q(page, () => document.querySelector('[data-buy="rapid"]').disabled), 'what you cannot afford is disabled');
    await Q(page, () => { __sb.G.credits = 300; __sb.ui.renderDock(__sb.G); });
    // a game saved in the hangar comes back to it
    await Q(page, () => { __sb.save(); });
    await page.reload();
    await page.waitForFunction(() => window.__sb && __sb.mode === 'title', null, { timeout: 60000 });
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __sb.mode === 'play' && !document.getElementById('dock').hidden && __sb.G.upg.engine === 1, 'Continue brings back a game saved in the hangar, upgrades and all');
    const w = await Q(page, () => __sb.G.wave);
    await click(page, '#dock-go');
    await until(page, () => document.getElementById('dock').hidden, 'Launch closes the Hangar');
    await until(page, (n) => __sb.G.wave === n + 1 && !__sb.G.dock, 'the ship flies back out and the next wave begins', 30000, w);
    await Q(page, () => { __sb.G.player.inv = 1e9; });
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
    await page.waitForTimeout(80);
    await touch('touchMove', (await Q(page, () => __sb.input.stick.ox)) + 20, zone.y);   // 20 px out: past the leash, still going
    await page.waitForTimeout(80);
    const back = await Q(page, () => __sb.input.stick.ox);                                // the base has been dragged along
    await touch('touchMove', back + 2, zone.y);                                           // ... then back to within 2 px of it
    await page.waitForTimeout(80);
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

    // the hangar by touch
    await Q(page, () => { __sb.G.credits = 120; __sb.dock(); });
    await until(page, () => !document.getElementById('dock').hidden && __sb.G.dock?.st === 'shop', 'the Hangar opens after the flight');
    check(await Q(page, () => getComputedStyle(document.getElementById('touch')).visibility === 'hidden'), 'the touch deck steps out of the way of the Hangar');
    const goBox = await Q(page, () => { const r = document.getElementById('dock-go').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight; });
    check(goBox, 'Launch is at least 44 px and on screen without scrolling');
    await tapSel('[data-buy="engine"]');
    await until(page, () => __sb.G.upg.engine === 1 && __sb.G.credits === 80, 'a tap on ENGINES buys it');
    const w5 = await Q(page, () => __sb.G.wave);
    await tapSel('#dock-go');
    await until(page, (n) => __sb.G.wave === n + 1 && !__sb.G.dock, 'a tap on Launch flies back out into the next wave', 30000, w5);
    await until(page, () => getComputedStyle(document.getElementById('touch')).visibility === 'visible', 'the touch deck is back');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function story(phoneSize = null) {
    console.log(`\n== story ${phoneSize ? `phone ${phoneSize[0]}×${phoneSize[1]}` : 'desktop'}`);
    const page = await open({ width: phoneSize?.[0] ?? 1280, height: phoneSize?.[1] ?? 760 }, { story: true, touch: !!phoneSize });
    const tap = (sel) => phoneSize
        ? Q(page, (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel).then((r) => page.touchscreen.tap(r.x, r.y))
        : click(page, sel);
    await tap('#title-menu [data-act="new"]');
    await until(page, () => __sb.mode === 'play' && __sb.ui.top() === 'story', 'a new game opens with the intro cutscene');
    check(await Q(page, () => document.getElementById('story-where').textContent.includes('BRIDGE')), 'it is set on the bridge');
    const t0 = await Q(page, () => __sb.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __sb.G.t === t, t0), 'the game waits behind the cutscene');
    await until(page, () => document.getElementById('story-text').textContent.length > 10, 'her line types itself out');
    const L = await Q(page, () => { const r = document.querySelector('#story .sheet').getBoundingClientRect(), n = document.getElementById('story-next').getBoundingClientRect(); return { fits: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, nextOk: n.width >= 44 && n.height >= 44 }; });
    check(L.fits && L.nextOk, 'the cutscene fits the screen and Next is at least 44 px');
    const pic = await Q(page, () => { const c = document.getElementById('story-scene'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; const cols = new Set(); for (let i = 0; i < d.length; i += 16) { if (d[i] + d[i + 1] + d[i + 2] > 200) n++; cols.add((d[i] >> 5) * 64 + (d[i + 1] >> 5) * 8 + (d[i + 2] >> 5)); } return { n, cols: cols.size }; });
    check(pic.n > 80 && pic.cols > 15, `the scene (with Mira) is really painted (${pic.n} bright samples, ${pic.cols} colours)`);
    await shot(page, `story-${phoneSize ? 'phone' : 'desktop'}-intro`);
    await tap('#story-next');                                           // finishes the typing
    check(await Q(page, () => __sb.ui.story.shown === __sb.ui.story.lines[__sb.ui.story.i].text.length && document.getElementById('story-text').textContent.length === __sb.ui.story.shown), 'Next finishes a line that is still typing');
    const i0 = await Q(page, () => __sb.ui.story.i);
    await tap('#story-next');
    await until(page, (i) => __sb.ui.story?.i === i + 1, 'Next again moves to the next line', 30000, i0);
    if (!phoneSize) {
        // keyboard only, with focus nowhere in particular: each key moves exactly one step, never two
        await Q(page, () => document.activeElement?.blur());
        const step = async (key, want, msg) => {
            const before = await Q(page, () => [__sb.ui.story.i, __sb.ui.story.shown, __sb.G.stats.shots]);
            await page.keyboard.press(key);
            await page.waitForTimeout(120);
            const after = await Q(page, () => [__sb.ui.story?.i, __sb.ui.story?.shown, __sb.G.stats.shots, __sb.input.edges.fire]);
            check(want === 'finish' ? after[0] === before[0] && after[1] > before[1] : after[0] === before[0] + 1, msg);
            check(after[2] === before[2] && after[3] === false, `${key} did not also fire the guns`);
        };
        await step('KeyZ', 'finish', 'Z finishes a line that is still typing');
        await step('KeyZ', 'next', 'Z moves on to the next line (exactly one)');
        await step('Space', 'finish', 'Space works with no button focused');
        const held = await Q(page, () => __sb.ui.story.i);                  // a line is typed out in full: one press moves on
        await page.keyboard.down('KeyZ'); await page.keyboard.down('KeyZ'); await page.keyboard.down('KeyZ');   // the 2nd and 3rd are auto-repeat
        await page.keyboard.up('KeyZ');
        await page.waitForTimeout(200);
        check(await Q(page, (i) => __sb.ui.story.i === i + 1, held), 'a held key moves on once and does not race through the lines');
        await step('Enter', 'finish', 'Enter finishes a line (exactly one step)');
    }
    for (let k = 0; k < 14 && await Q(page, () => !document.getElementById('story').hidden); k++) await tap('#story-next');
    await until(page, () => document.getElementById('story').hidden, 'going through every line ends the cutscene');
    await until(page, () => __sb.G.t > 0.5, 'and the game begins');
    check(await Q(page, () => (__sb.view.commNow?.text || __sb.view.comms[0]?.text || '').includes('Drones ahead')), 'Mira then opens wave 1 over the comm: "Drones ahead..."');
    await page.waitForTimeout(900);
    await shot(page, `story-${phoneSize ? 'phone' : 'desktop'}-comm`);
    const pic2 = await lit(page);
    check(pic2.bright > 40, 'the comm strip is drawn over the game');

    if (phoneSize) { reportErrors('story phone'); return; }

    // Skip and Escape
    await Q(page, () => __sb.story('boss1'));
    await until(page, () => __sb.ui.top() === 'story', 'a cutscene can be started');
    await page.keyboard.press('ArrowRight');
    await until(page, () => __sb.ui.story.shown === __sb.ui.story.lines[__sb.ui.story.i].text.length, 'the right arrow is a next key too');
    await click(page, '#story-skip');
    await until(page, () => document.getElementById('story').hidden, 'Skip ends it at once');
    await Q(page, () => __sb.story('boss2'));
    await until(page, () => __sb.ui.top() === 'story', 'another cutscene');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('story').hidden, 'Escape skips it too');
    await Q(page, () => __sb.story('boss0'));
    await until(page, () => __sb.ui.top() === 'story', 'and another');
    await page.keyboard.press('KeyX');
    await until(page, () => document.getElementById('story').hidden, 'X skips it as well');
    await Q(page, () => __sb.story('finale'));
    await until(page, () => __sb.ui.top() === 'story', 'a third');
    await page.keyboard.press('Space');                                 // Space on the focused Next button
    await until(page, () => __sb.ui.story.shown === __sb.ui.story.lines[__sb.ui.story.i].text.length, 'Space on the focused Next button works');
    await click(page, '#story-skip');

    // a boss arrives with a cutscene; docking after the first boss has one, and the hangar waits behind it
    await Q(page, () => { __sb.G.player.inv = 1e9; __sb.wave(5); });
    await until(page, () => __sb.ui.top() === 'story' && document.getElementById('story-where').textContent.includes('OBSERVATION'), 'the first boss arrives with a cutscene at the observation window');
    await shot(page, 'story-boss-window');
    await click(page, '#story-skip');
    await Q(page, () => { const G = __sb.G; G.enemies.length = 0; G.ebullets.length = 0; G.plan.idx = G.plan.orders.length; G.credits = 120; __sb.dock(); });
    await until(page, () => __sb.ui.top() === 'story' && document.getElementById('story-where').textContent.includes('HANGAR'), 'docking after the first boss opens a cutscene in the hangar bay');
    check(await Q(page, () => document.getElementById('dock').hidden), 'the shop waits behind it');
    check(await Q(page, () => document.getElementById('dock-quip').hidden), 'and the quip is left for the ordinary visits');
    await page.keyboard.press('KeyX');
    await until(page, () => !document.getElementById('dock').hidden && __sb.ui.top() === 'dock', 'when it ends (here with X) the Hangar opens');
    await page.keyboard.press('KeyZ');
    await until(page, () => __sb.G.upg.engine + __sb.G.upg.cannon + __sb.G.upg.rapid + __sb.G.upg.magnet >= 1, 'Z buys the highlighted item');
    await page.keyboard.press('KeyL');
    await until(page, () => document.getElementById('dock').hidden, 'L launches from the Hangar');
    // a later dock: no cutscene, a quip on the screen
    await Q(page, () => { const G = __sb.G; G.enemies.length = 0; G.ebullets.length = 0; G.wave = 20; G.plan.idx = G.plan.orders.length; __sb.dock(); });
    await until(page, () => !document.getElementById('dock').hidden, 'a later dock goes straight to the Hangar');
    check(await Q(page, () => !document.getElementById('dock-quip').hidden && document.getElementById('dock-quip').textContent.length > 10), 'with a quip from Mira at the top');
    await shot(page, 'story-hangar-quip');
    await click(page, '#dock-go');
    await until(page, () => document.getElementById('dock').hidden, 'launch again');

    // game over: Mira has a word
    await Q(page, () => { __sb.die(true); });
    await until(page, () => __sb.mode === 'over', 'the game ends');
    check(await Q(page, () => !document.getElementById('over-quip').hidden && document.getElementById('over-quip').textContent.length > 15), 'Mira has a word on the game-over sheet');
    await shot(page, 'story-over');
    await Q(page, () => { document.getElementById('over-save').click(); });
    await click(page, '#over-quit');
    await until(page, () => __sb.mode === 'title', 'back to the title');

    // the Story setting
    await click(page, '#title-menu [data-act="settings"]');
    await Q(page, () => { const s = document.getElementById('set-story'); s.value = 'off'; s.dispatchEvent(new Event('change')); });
    await click(page, '#settings [data-close]');
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sb.mode === 'play' && __sb.ui.top() === null, 'with Story off a new game has no cutscene');
    await page.waitForTimeout(400);
    check(await Q(page, () => !__sb.view.commNow && __sb.view.comms.length === 0), 'and no comms');
    await Q(page, () => { __sb.G.player.inv = 1e9; __sb.wave(5); });
    await page.waitForTimeout(400);
    check(await Q(page, () => __sb.ui.top() === null && __sb.G.t > 0), 'nor does a boss arrive with a cutscene');
    reportErrors('story desktop');
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    check(await Q(page, () => document.getElementById('hiscore').textContent === '060000'), 'the default high-score table still shows');
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sb.mode === 'play', 'boots and starts a game with localStorage throwing');
    await click(page, '#story-skip');
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
    if (want('story')) { await story(); await story([390, 844]); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);
