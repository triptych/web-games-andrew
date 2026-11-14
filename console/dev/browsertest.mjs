/**
 * browsertest.mjs — drives Pocket Garden (console/index.html) in real
 * Chromium and fails on any console error, page error or failed request.
 *
 * Desktop (1280×800): boot → turn the click wheel with the mouse (drag round
 * the ring) → tap MENU / center → All Games → spin fast → cartridge → flip
 * with ⏭ → star with F (written to the Garden's `garden.starred`) →
 * Favorites → search by title and by description, and by the letter rail →
 * genres add up to every game → Cover Flow → Settings change the shell and
 * persist → the box-art sleeve follows the highlight → ⏯ launches the game
 * → a deep link (#game-135) opens its cartridge → stars made in the Garden
 * show up here. Phones (390×844 upright, 844×390 sideways, touch only): fit
 * the screen with no sideways scroll, tap a row, long-press to star, swipe
 * back, swipe through cartridges, turn the wheel with a finger and tap the
 * instant it stops. Reduced motion: no boot screen, Shuffle and Play skip
 * their animations. Blocked storage: still boots and stars in memory. Screenshots → console/dev/shots/.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node console/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8077), PW_CHROMIUM_PATH, ONLY=desktop|calm|phones|storage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const URL = `${BASE}/console/`;
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY;
fs.mkdirSync(OUT, { recursive: true });

const games = (await import(path.join(HERE, '../../js/gamedata.js'))).default;
const TOTAL = games.length;

let errors = [];
const browsers = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAIL ' + msg);
    console.log('  ok  ' + msg);
};

async function open(viewport, { touch = false, blockStorage = false, init = null, reducedMotion = 'no-preference' } = {}) {
    // a fresh browser for each scenario: touch-gesture state left over from
    // another context's screenshots can swallow the click of a later tap
    const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    browsers.push(browser);
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    // the games themselves are not under test: answer their pages with a stub
    await ctx.route(/\/game-\d+\/index\.html$/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title><p>game</p>' }));
    if (blockStorage) {
        await ctx.addInitScript(() => {
            Object.defineProperty(window, 'localStorage', {
                get() {
                    throw new DOMException('blocked', 'SecurityError');
                },
            });
        });
    }
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
        if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
    });
    return { ctx, page };
}

async function boot(page, hash = '') {
    if (hash) await page.goto('about:blank');
    await page.goto(URL + hash);
    await page.waitForFunction(() => window.pocketGarden && document.querySelector('.view'));
    await page.waitForTimeout(400);
    // any key skips the boot screen
    await page.evaluate(() => window.pocketGarden.skipBoot());
    await page.waitForTimeout(450);
}

const top = (page) =>
    page.evaluate(() => {
        const a = window.pocketGarden;
        const t = a.top;
        return {
            type: t.type,
            title: document.getElementById('st-title').textContent,
            depth: a.stack.length,
            sel: t.el.querySelector('.row.sel .r-text')?.textContent ?? null,
            index: t.index ?? null,
            game: t.currentGame?.()?.id ?? null,
        };
    });
const settle = (page, ms = 340) => page.waitForTimeout(ms);
const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);

/** Drag the mouse round the click wheel by `deg` degrees (clockwise > 0). */
async function spinMouse(page, deg, startDeg = 0, { stepDeg = 4, wait = 12 } = {}) {
    const r = await page.locator('#wheel').boundingBox();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const rad = r.width * 0.42;
    const pt = (d) => [cx + Math.cos((d * Math.PI) / 180) * rad, cy + Math.sin((d * Math.PI) / 180) * rad];
    await page.mouse.move(...pt(startDeg));
    await page.mouse.down();
    const steps = Math.max(4, Math.round(Math.abs(deg) / stepDeg));
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(...pt(startDeg + (deg * i) / steps));
        if (wait) await page.waitForTimeout(wait);
    }
    await page.mouse.up();
}

/** Tap a spot on the wheel: 'menu' (top), 'next' (right), 'play' (bottom), 'prev' (left). */
async function wheelButton(page, which) {
    const r = await page.locator('#wheel').boundingBox();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const d = r.width * 0.4;
    const [x, y] = { menu: [cx, cy - d], next: [cx + d, cy], play: [cx, cy + d], prev: [cx - d, cy] }[which];
    await page.mouse.click(x, y);
}

// ------------------------------------------------------------------ touch helpers (CDP)

async function touchPath(page, points, { holdMs = 0, stepMs = 16 } = {}) {
    const cdp = await page.context().newCDPSession(page);
    const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(...points[0]) });
    if (holdMs) await page.waitForTimeout(holdMs);
    for (const p of points.slice(1)) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(...p) });
        await page.waitForTimeout(stepMs);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
}

/** A finger tap that stays down for a moment, as a real one does. */
async function tap(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    await touchPath(page, [[b.x + b.width / 2, b.y + b.height / 2]], { holdMs: 70 });
}

async function swipe(page, dir) {
    const r = await page.locator('#views').boundingBox();
    const y = r.y + r.height * 0.45;
    const [x0, x1] = dir === 'right' ? [r.x + r.width * 0.15, r.x + r.width * 0.85] : [r.x + r.width * 0.85, r.x + r.width * 0.15];
    const pts = Array.from({ length: 9 }, (_, i) => [x0 + ((x1 - x0) * i) / 8, y]);
    await touchPath(page, pts, { stepMs: 14 });
}

async function spinTouch(page, deg) {
    const r = await page.locator('#wheel').boundingBox();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const rad = r.width * 0.42;
    const steps = Math.round(Math.abs(deg) / 5);
    const pts = Array.from({ length: steps + 1 }, (_, i) => {
        const d = ((-90 + (deg * i) / steps) * Math.PI) / 180;
        return [cx + Math.cos(d) * rad, cy + Math.sin(d) * rad];
    });
    await touchPath(page, pts, { stepMs: 10 });
}

async function noSideScroll(page, label) {
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: innerWidth, sh: document.documentElement.scrollHeight, ch: innerHeight }));
    check(m.sw <= m.cw + 1 && m.sh <= m.ch + 1, `${label}: page fits the viewport (${m.sw}×${m.sh} in ${m.cw}×${m.ch})`);
}

// ------------------------------------------------------------------ desktop

async function desktop() {
    console.log('\nDesktop 1280×800');
    const { ctx, page } = await open({ width: 1280, height: 800 });
    await boot(page);
    let t = await top(page);
    check(t.type === 'list' && t.sel === 'All Games', 'boots on the main menu with All Games highlighted');
    const allMeta = await page.locator('.view.is-top .row.sel .r-meta').textContent();
    check(allMeta.trim() === String(TOTAL), `All Games shows ${TOTAL}`);
    await page.screenshot({ path: path.join(OUT, 'desktop-home.png') });
    await noSideScroll(page, 'desktop');

    // turn the wheel by dragging the mouse round the ring: 90° = 6 ticks
    await spinMouse(page, 97, -60);
    t = await top(page);
    check(t.index === 6, `a 90° clockwise turn moves down six rows (now on ${t.sel})`);
    await spinMouse(page, -97, 37);
    t = await top(page);
    check(t.index === 0, 'turning back the other way returns to the top');

    // center selects; MENU on the ring goes back
    await page.locator('#wheel-center').click();
    await settle(page);
    t = await top(page);
    check(t.type === 'list' && t.title === 'All Games' && t.depth === 2, 'the center button opens All Games');
    const first = t.sel;
    await spinMouse(page, 52, 0);
    t = await top(page);
    check(t.index === 3 && t.sel !== first, `a 45° turn moves three games (${t.sel})`);
    await wheelButton(page, 'next');
    t = await top(page);
    check(t.index > 6, `⏭ pages down (${t.index})`);
    await page.keyboard.press('End');
    t = await top(page);
    check(t.index === TOTAL - 1, 'End jumps to the last game');
    await page.keyboard.press('Home');

    // fast spin: big steps and the A–Z letter
    await spinMouse(page, 300, 0, { stepDeg: 6, wait: 0 });
    t = await top(page);
    check(t.index > 20, `spinning fast accelerates (${t.index} games for 20 ticks)`);
    const azShown = await page.evaluate(() => document.getElementById('az').textContent);
    check(/^[A-Z#]$/.test(azShown), `the A–Z letter flashes while spinning (${azShown})`);

    // sleeve follows the highlight
    await settle(page, 300);
    const sleeveTitle = await page.locator('#sleeve h2').textContent();
    check(sleeveTitle === t.sel, `the box-art sleeve shows the highlighted game (${sleeveTitle})`);
    await page.screenshot({ path: path.join(OUT, 'desktop-list.png') });

    // cartridge
    await page.keyboard.press('Enter');
    await settle(page, 700);
    t = await top(page);
    check(t.type === 'detail' && /^NO\.\d{3}$/i.test(t.title), `Enter opens the cartridge (${t.title})`);
    check(page.url().endsWith('#' + t.game), 'the cartridge has its own URL');
    await page.screenshot({ path: path.join(OUT, 'desktop-cartridge.png') });
    const g1 = t.game;
    await wheelButton(page, 'next');
    await settle(page, 450);
    t = await top(page);
    check(t.game !== g1, `⏭ flips to the next cartridge (${t.game})`);
    await page.keyboard.press('ArrowLeft');
    await settle(page, 450);
    t = await top(page);
    check(t.game === g1, '← flips back');

    // star it (F), and it lands in the Garden's own key
    await page.keyboard.press('f');
    await settle(page);
    let favs = await stored(page, 'garden.starred');
    check(Array.isArray(favs) && favs.includes(g1), `F stars the game into garden.starred (${JSON.stringify(favs)})`);
    check((await page.locator('#st-fav').textContent()) === '★1', 'the status bar counts one favorite');
    check(await page.locator('.d-actions .act.on').count() === 1, 'the cartridge shows it is a favorite');
    await settle(page, 600);
    const g1Title = await page.evaluate(() => window.pocketGarden.top.currentGame().title);
    check((await page.locator('#sleeve h2').textContent()) === g1Title, 'the sleeve stays on the cartridge (menus underneath stay quiet)');

    // hold the center button: unstar, then star again
    const c = await page.locator('#wheel-center').boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    favs = await stored(page, 'garden.starred');
    check(!favs.includes(g1), 'holding the center button unstars it');
    await page.keyboard.press('f');

    // back out with MENU on the wheel; the list shows the star
    await wheelButton(page, 'menu');
    await settle(page);
    t = await top(page);
    check(t.type === 'list' && t.title === 'All Games', 'MENU goes back to the list');
    check((await page.locator('.view.is-top .row.sel .r-fav').textContent()) === '★', 'the starred game has a star in the list');
    await page.keyboard.press('Escape');
    await settle(page);
    t = await top(page);
    check(t.depth === 1, 'Esc goes back to the main menu');

    // favorites list
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    t = await top(page);
    check(t.sel === 'Favorites', 'Favorites is on the main menu');
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    check(t.title === 'Favorites' && t.game === g1, 'Favorites lists the starred game');
    await page.keyboard.press('Escape');
    await settle(page);

    // search by title (typing anywhere opens it)
    await page.keyboard.type('dragon');
    await settle(page);
    t = await top(page);
    check(t.type === 'search', 'typing on the menu opens Search');
    const titles = await page.locator('.view.is-top .row .r-text').allTextContents();
    check(titles.some((x) => /dragonroll/i.test(x)), `"dragon" finds Dragonroll (${titles.length} results)`);
    check(await page.locator('.view.is-top .row mark').count() > 0, 'matches are highlighted');
    await page.screenshot({ path: path.join(OUT, 'desktop-search.png') });
    // by description: a word that only appears in a blurb
    await page.fill('.s-input', 'cartographer');
    await settle(page);
    const sub = await page.locator('.view.is-top .row').first().evaluate((r) => ({ title: r.querySelector('.r-text').textContent, sub: r.querySelector('.r-sub')?.textContent ?? '' }));
    check(/atlas of ink/i.test(sub.title) && /cartographer/i.test(sub.sub), `"cartographer" finds Atlas of Ink by its description ("${sub.sub.slice(0, 50)}…")`);
    await page.fill('.s-input', 'zzqqxx');
    await settle(page);
    check((await page.locator('.view.is-top .empty').textContent()).includes('No games match'), 'a search with no results says so');
    // Enter in the field opens the top result
    await page.fill('.s-input', 'hard hat');
    await page.keyboard.press('Enter');
    await settle(page, 600);
    t = await top(page);
    check(t.type === 'detail' && t.game === 'game-135', 'Enter in the search field opens the top result');
    await page.keyboard.press('Escape');
    await settle(page);
    // the letter rail: blur the field, then spell with the wheel
    await page.evaluate(() => {
        const s = window.pocketGarden.top;
        s.input.blur();
        s.setQuery('');
        s.zone = 'rail';
        s.key = 0;
        s.renderZone();
    });
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown'); // A → H
    await page.locator('#wheel-center').click();
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowUp'); // H → A
    await page.locator('#wheel-center').click();
    const q = await page.evaluate(() => window.pocketGarden.top.query);
    check(q === 'ha', `the letter rail spells with the wheel ("${q}")`);
    await page.keyboard.press('Escape');
    await settle(page);
    t = await top(page);
    check(t.depth === 1, 'leaving search returns to the menu');

    // genres add up
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await settle(page);
    const counts = await page.locator('.view.is-top .row .r-meta').allTextContents();
    const sum = counts.reduce((a, b) => a + Number(b), 0);
    check(sum === TOTAL, `${counts.length} genres hold all ${TOTAL} games`);
    await page.screenshot({ path: path.join(OUT, 'desktop-genres.png') });
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    check(t.type === 'list' && t.game, `a genre opens its games (${t.title})`);
    await page.keyboard.press('Escape');
    await settle(page);
    await page.keyboard.press('Escape');
    await settle(page);

    // cover flow
    await page.evaluate(() => window.pocketGarden.top.setIndex(5));
    await page.keyboard.press('Enter');
    await settle(page, 500);
    t = await top(page);
    check(t.type === 'cover', 'Cover Flow opens');
    const cap0 = await page.locator('.cf-title').textContent();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await settle(page, 500);
    const cap1 = await page.locator('.cf-title').textContent();
    check(cap1 !== cap0, `→ flips covers (${cap0} → ${cap1})`);
    // drag the covers with the mouse
    const st = await page.locator('.cf-stage').boundingBox();
    await page.mouse.move(st.x + st.width * 0.7, st.y + st.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(st.x + st.width * 0.4, st.y + st.height * 0.4, { steps: 8 });
    await page.mouse.up();
    await settle(page, 600);
    const cap2 = await page.locator('.cf-title').textContent();
    check(cap2 !== cap1, `dragging moves the covers (${cap2})`);
    await page.screenshot({ path: path.join(OUT, 'desktop-coverflow.png') });
    await page.locator('.cf-item.center').click();
    await settle(page, 500);
    t = await top(page);
    check(t.type === 'detail', 'clicking the middle cover opens its cartridge');
    await page.keyboard.press('Escape');
    await settle(page);
    await page.keyboard.press('Escape');
    await settle(page);

    // settings: shell colour cycles and persists
    await page.evaluate(() => window.pocketGarden.top.setIndex(8));
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    check(t.title === 'Settings', 'Settings opens');
    const shellRow = await page.locator('.view.is-top .row').evaluateAll((rows) => rows.findIndex((r) => r.textContent.includes('Shell')));
    await page.evaluate((i) => window.pocketGarden.top.setIndex(i), shellRow);
    await page.keyboard.press('Enter');
    await settle(page, 200);
    check((await page.locator('#device').getAttribute('data-shell')) === 'charcoal', 'Shell cycles to Charcoal');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    check((await page.locator('#device').getAttribute('data-shell')) === 'atomic', 'and on to Atomic Purple');
    const settings = await stored(page, 'console.settings');
    check(settings.shell === 'atomic', 'the shell is saved');
    await page.screenshot({ path: path.join(OUT, 'desktop-atomic.png') });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    check((await page.locator('#device').getAttribute('data-glow')) === 'amber', 'Screen cycles to Amber');
    await page.keyboard.press('Escape');
    await settle(page);

    // ⏯ on a game launches it after the cartridge goes in
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown'); // New Arrivals
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    const newest = t.game;
    await page.keyboard.press('Enter');
    await settle(page, 500);
    await wheelButton(page, 'play');
    await page.waitForTimeout(500);
    check(await page.locator('#load').isVisible(), 'the loading screen shows the game');
    await page.screenshot({ path: path.join(OUT, 'desktop-loading.png') });
    await page.waitForURL(`**/${newest}/index.html`, { timeout: 5000 });
    check(true, `⏯ launches ${newest}`);
    await page.goBack();
    await page.waitForFunction(() => window.pocketGarden);
    await page.waitForTimeout(500);
    const recent = await stored(page, 'console.recent');
    check(recent?.[0]?.id === newest, 'it is first in Recently Played');

    // deep link
    await boot(page, '#game-135');
    t = await top(page);
    check(t.type === 'detail' && t.game === 'game-135' && t.depth === 2, 'a #game-135 link opens its cartridge');
    await page.goBack();
    await settle(page);
    t = await top(page);
    check(t.depth === 1, 'the browser Back button goes back a screen');
    await ctx.close();

    // stars made in the Garden show up here
    const g2 = await open({ width: 1280, height: 800 }, { init: () => localStorage.setItem('garden.starred', JSON.stringify(['game-001', 'game-016'])) });
    await boot(g2.page);
    check((await g2.page.locator('#st-fav').textContent()) === '★2', 'favorites starred in the Garden are shared');
    await g2.ctx.close();
}

// ------------------------------------------------------------------ phones

async function phone(viewport, label) {
    console.log(`\n${label} ${viewport.width}×${viewport.height} (touch)`);
    const { ctx, page } = await open(viewport, { touch: true });
    await boot(page);
    await noSideScroll(page, label);
    const box = await page.locator('#device').boundingBox();
    check(box.width >= viewport.width - 1 && box.height >= viewport.height - 1, 'the device fills the screen');
    const w = await page.locator('#wheel').boundingBox();
    const s = await page.locator('.screen').boundingBox();
    if (viewport.width > viewport.height) check(w.x > s.x + s.width, 'held sideways, the wheel sits right of the screen');
    else check(w.y > s.y + s.height, 'held upright, the wheel sits under the screen');
    check(w.width >= 180, `the wheel is big enough for a thumb (${Math.round(w.width)}px)`);
    const rowH = await page.locator('.view.is-top .row').first().evaluate((r) => r.getBoundingClientRect().height);
    check(rowH >= 44, `rows are at least 44px tall (${Math.round(rowH)}px)`);
    // turn the wheel with a finger
    await spinTouch(page, 66);
    let t = await top(page);
    check(t.index === 4, `a 60° turn with a finger moves four rows (${t.sel})`);
    // (the tap below comes the instant the spin ends: Chromium used to swallow
    // it as the tap that stops a fling, until the wheel cancelled its touches)

    // tap a row
    await tap(page, page.locator('.view.is-top .row').first());
    await settle(page);
    t = await top(page);
    check(t.title === 'All Games', 'tapping a row opens it');

    // long-press a game to star it
    const row = page.locator('.view.is-top .row').nth(2);
    const rb = await row.boundingBox();
    const id = await row.evaluate((r) => window.pocketGarden.top.items[+r.dataset.i].game.id);
    await touchPath(page, [[rb.x + rb.width / 2, rb.y + rb.height / 2]], { holdMs: 750 });
    await settle(page);
    t = await top(page);
    check(t.title === 'All Games', 'a long-press does not open the game');
    check((await stored(page, 'garden.starred'))?.includes(id), 'a long-press stars it');

    // tap into a cartridge, swipe through, swipe… then back with the status bar
    await tap(page, row);
    await settle(page, 600);
    t = await top(page);
    check(t.type === 'detail' && t.game === id, 'tapping a game opens its cartridge');
    await swipe(page, 'left');
    await settle(page, 450);
    t = await top(page);
    check(t.game !== id, 'swiping left flips to the next cartridge');
    await tap(page, page.locator('#st-back'));
    await settle(page);
    t = await top(page);
    check(t.title === 'All Games', 'the back arrow in the status bar goes back');
    await swipe(page, 'right');
    await settle(page);
    t = await top(page);
    check(t.depth === 1, 'swiping right goes back to the menu');

    // MENU on the wheel at the top level does nothing harmful
    const wb = await page.locator('.wb-menu').boundingBox();
    await page.touchscreen.tap(wb.x + wb.width / 2, wb.y + wb.height / 2);
    await settle(page);
    t = await top(page);
    check(t.depth === 1, 'MENU on the main menu stays put');
    await page.screenshot({ path: path.join(OUT, `${label}-home.png`) });
    await page.keyboard.press('Enter');
    await settle(page);
    await page.keyboard.press('Enter');
    await settle(page, 700);
    await page.screenshot({ path: path.join(OUT, `${label}-cartridge.png`) });
    await ctx.close();
}

// ------------------------------------------------------------------ blocked storage

async function storage() {
    console.log('\nBlocked localStorage');
    const { ctx, page } = await open({ width: 1280, height: 800 }, { blockStorage: true });
    await boot(page);
    let t = await top(page);
    check(t.type === 'list', 'boots without storage');
    await page.keyboard.press('Enter');
    await settle(page);
    await page.keyboard.press('f');
    check((await page.locator('#st-fav').textContent()) === '★1', 'stars still work, in memory');
    await page.keyboard.press('f');
    check((await page.locator('#st-fav').textContent()) === '★0', 'and unstar');
    await ctx.close();
}

// ------------------------------------------------------------------ reduced motion

async function calm() {
    console.log('\nReduced motion');
    const { ctx, page } = await open({ width: 1280, height: 800 }, { reducedMotion: 'reduce' });
    await page.goto(URL);
    await page.waitForFunction(() => window.pocketGarden);
    check(!(await page.locator('#boot').count()), 'no boot animation');
    await page.evaluate(() => window.pocketGarden.top.setIndex(7));
    check((await top(page)).sel === 'Shuffle', 'Shuffle is on the main menu');
    await page.keyboard.press('Enter');
    await settle(page);
    const t = await top(page);
    check(t.type === 'detail' && !(await page.locator('#reel').isVisible()), `Shuffle goes straight to a cartridge (${t.game})`);
    await page.keyboard.press(' ');
    await page.waitForURL(`**/${t.game}/index.html`, { timeout: 2000 });
    check(true, 'Play launches without the long animation');
    await ctx.close();
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'calm') await calm();
    if (!ONLY || ONLY === 'phones') {
        await phone({ width: 390, height: 844 }, 'phone');
        await phone({ width: 844, height: 390 }, 'landscape');
    }
    if (!ONLY || ONLY === 'storage') await storage();
    if (errors.length) throw new Error('errors:\n' + errors.join('\n'));
    console.log('\nAll console checks passed.');
} catch (e) {
    console.error('\n' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    process.exitCode = 1;
} finally {
    await Promise.all(browsers.map((b) => b.close()));
}
