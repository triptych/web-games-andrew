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
 * their animations. Blocked storage: still boots and stars in memory.
 * Installable app (the only run with service workers on): the manifest,
 * every icon and screenshot at its stated size, the worker's scope, the
 * files it keeps, starting and browsing with the network off, the Install
 * App menu item and prompt, Settings' install help, and the shortcuts.
 * The Dragonfly (the Garden's companion as a pet, sharing `garden.companion`):
 * before meeting it, where it waits; its 8-bit stage; feeding it from the
 * wheel (written to the island's memory), petting by holding the center and
 * by tapping it, a trick, a change made on the island showing at once,
 * Places (found ones and hints) and flying to one (index.html?go=…); the
 * embossed dragonfly on the shell opens it on a phone.
 * Messages (./js/messages.js, each game's avatar/avatar.json): games in Recently
 * Played are friends in the address book, the Garden's dragonfly is too; the
 * newest game calls with a friend request (the handheld shakes), accepting it
 * opens the chat; quick replies by wheel and by tap, a typed question, a save
 * read for "how am I doing?", a question answered for friendship, a message
 * from the clock with a banner that opens its chat, a friend's game updated
 * (a message with a play link), a brand-new game calling, declining it, the
 * ▶ chip launching the game, and every avatar picture loading. A phone runs a
 * chat by touch.
 * The Lounge (./js/lounge.js): friends and games with a save walk in on their
 * sprites (every sprite sheet loads), the bartender walks eight ways with the
 * arrow keys, the wheel picks a guest and ● walks over; an order in a dialog
 * box, a wrong ingredient, the right ones, the needle stopped in the gold, the
 * serving (stars, friendship hearts, the Lounge's memory); a thank-you text
 * and a friend asking for a drink in Messages, whose button opens the Lounge
 * with them at the bar; a phone walks by tapping the floor.
 * Cloud (./js/cloud.js, a mock Supabase): the player count on a cartridge, signing in
 * by email link, the backup made on return (stars, shell; no game saves), an auto
 * backup of a new star, Saved Games backing up a game's save in its own slot, a
 * new device taking the backup by itself, restoring a game's save, signing out.
 * Screenshots → console/dev/shots/.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node console/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8077; BASE=disk answers from the repo on disk, no server
 * needed, and skips the installable-app checks, which need one),
 * PW_CHROMIUM_PATH, ONLY=desktop|pwa|calm|phones|storage|dragonfly|messages|lounge|cloud.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DISK = process.env.BASE === 'disk';
const BASE = DISK ? 'http://pocket.test' : process.env.BASE ?? 'http://127.0.0.1:8077';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
/** BASE=disk: answer every request for the site from the files in the repo. */
async function serveDisk(ctx, base = BASE) {
    await ctx.route(`${base}/**`, (r) => {
        let f = decodeURIComponent(new globalThis.URL(r.request().url()).pathname);
        if (f.endsWith('/')) f += 'index.html';
        const file = path.join(ROOT, f);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return r.fulfill({ status: 404, body: 'not found' });
        r.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
}
const URL = `${BASE}/console/`;
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY;
fs.mkdirSync(OUT, { recursive: true });

const games = (await import(path.join(HERE, '../../js/gamedata.js'))).default;
const TOTAL = games.length;
// when each game last changed (dev/make-updates.mjs), newest first
const UPDATES = Object.entries(JSON.parse(fs.readFileSync(path.join(HERE, '../../js/updates.json'), 'utf8')).games)
    .filter(([id]) => games.some((g) => g.id === id))
    .sort((a, b) => Date.parse(b[1].updated) - Date.parse(a[1].updated));

let errors = [];
const browsers = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAIL ' + msg);
    console.log('  ok  ' + msg);
};

async function open(viewport, { touch = false, blockStorage = false, init = null, reducedMotion = 'no-preference', serviceWorkers = 'block', messages = false } = {}) {
    // a fresh browser for each scenario: touch-gesture state left over from
    // another context's screenshots can swallow the click of a later tap
    const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    browsers.push(browser);
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion, serviceWorkers });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    if (DISK) await serveDisk(ctx);
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
    // Messages stay quiet (no texts, no friend-request calls) except in the Messages scenario
    if (!messages && !blockStorage) {
        await ctx.addInitScript(() => {
            try {
                if (!localStorage.getItem('console.messages')) localStorage.setItem('console.messages', JSON.stringify({ v: 1, me: '', freq: 'off', seen: null, friends: {}, requests: [], declined: {}, threads: {}, unread: {}, lastVisit: 0, news: {} }));
            } catch {
                /* blocked */
            }
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

async function boot(page, hash = '', url = URL) {
    if (hash) await page.goto('about:blank');
    await page.goto(url + hash);
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
/** Highlight a row of the top list by its label (the main menu's order changes now and then). */
async function pick(page, label) {
    const i = await page.evaluate((l) => window.pocketGarden.top.items.findIndex((it) => it.label === l), label);
    check(i >= 0, `the menu has ${label}`);
    await page.evaluate((n) => window.pocketGarden.top.setIndex(n), i);
}
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
    await pick(page, 'Favorites');
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

    // recently updated: newest version first, each with what changed and when
    await pick(page, 'Recently Updated');
    await settle(page);
    const cap = await page.locator('.view.is-top .preview').textContent();
    const latest = games.find((g) => g.id === UPDATES[0][0]);
    check(cap.includes(latest.title), `its slideshow caption names the latest update (${latest.title})`);
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    check(t.title === 'Recently Updated' && t.game === UPDATES[0][0], `Recently Updated lists the latest change first (${t.game})`);
    const rowsU = await page.locator('.view.is-top .row').count();
    check(rowsU === Math.min(30, UPDATES.length), `it lists the ${rowsU} most recent`);
    const shown = await page.evaluate(() => window.pocketGarden.top.items.map((it) => it.game.id));
    check(shown.join() === UPDATES.slice(0, rowsU).map(([id]) => id).join(), 'in the order js/updates.json dates them');
    const what = await page.locator('.view.is-top .row.sel .r-sub').textContent();
    const u0 = UPDATES[0][1];
    check(what === `${u0.added === u0.updated ? 'New' : 'Updated'} v${latest.version}`, `each row says what changed ("${what}")`);
    check((await page.locator('.view.is-top .row.sel .r-meta').textContent()).trim() !== '', 'and when');
    await page.screenshot({ path: path.join(OUT, 'desktop-updated.png') });
    await page.keyboard.press('Enter');
    await settle(page, 500);
    t = await top(page);
    check(t.type === 'detail' && t.game === UPDATES[0][0], 'a row opens its cartridge');
    await page.keyboard.press('Escape');
    await settle(page);
    await page.keyboard.press('Escape');
    await settle(page);

    // genres add up
    await pick(page, 'Genres');
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
    await pick(page, 'Cover Flow');
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
    await pick(page, 'Settings');
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
    await pick(page, 'New Arrivals');
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
    await boot(page, '#updated');
    t = await top(page);
    check(t.title === 'Recently Updated' && t.game === UPDATES[0][0], 'a #updated link opens Recently Updated');
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
    // a broken js/updates.json: Recently Updated says so instead of failing
    await ctx.route(/\/js\/updates\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: 'not json' }));
    await boot(page, '#updated');
    t = await top(page);
    check(t.title === 'Recently Updated' && (await page.locator('.view.is-top .empty').textContent()).includes('No update dates'), 'with no update dates, Recently Updated explains instead of breaking');
    await ctx.close();
}

// ------------------------------------------------------------------ reduced motion

async function calm() {
    console.log('\nReduced motion');
    const { ctx, page } = await open({ width: 1280, height: 800 }, { reducedMotion: 'reduce' });
    await page.goto(URL);
    await page.waitForFunction(() => window.pocketGarden);
    check(!(await page.locator('#boot').count()), 'no boot animation');
    await pick(page, 'Shuffle');
    await page.keyboard.press('Enter');
    await settle(page);
    const t = await top(page);
    check(t.type === 'detail' && !(await page.locator('#reel').isVisible()), `Shuffle goes straight to a cartridge (${t.game})`);
    await page.keyboard.press(' ');
    await page.waitForURL(`**/${t.game}/index.html`, { timeout: 2000 });
    check(true, 'Play launches without the long animation');
    await ctx.close();
}

// ------------------------------------------------------------------ installable app

async function pwa() {
    console.log('\nInstallable app (service worker on)');
    const { ctx, page } = await open({ width: 1280, height: 800 }, { serviceWorkers: 'allow' });
    await boot(page);

    // the manifest and everything it points at
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const res = await page.request.get(new globalThis.URL(href, URL).href);
    check(res.ok() && /manifest\+json|json/.test(res.headers()['content-type'] || 'application/manifest+json'), `the page links ${href}`);
    const m = await res.json();
    check(m.name === 'Pocket Garden' && m.short_name && m.short_name.length <= 14, `named "${m.name}" ("${m.short_name}" under the icon)`);
    check(m.display === 'standalone' && m.start_url === './' && m.scope === './' && m.id, 'opens standalone, starting and scoped at console/');
    const icons = m.icons || [];
    const has = (size, purpose) => icons.some((i) => i.sizes === size && (i.purpose || 'any').split(' ').includes(purpose));
    check(has('192x192', 'any') && has('512x512', 'any') && has('192x192', 'maskable') && has('512x512', 'maskable'), 'icons at 192 and 512, plain and maskable');
    const files = [...icons.map((i) => [i.src, i.sizes]), ...(m.screenshots || []).map((s) => [s.src, s.sizes]), ['icons/apple-touch-icon.png', '180x180']];
    for (const [src, sizes] of files) {
        const size = await page.evaluate(
            (u) =>
                new Promise((ok) => {
                    const img = new Image();
                    img.onload = () => ok(`${img.naturalWidth}x${img.naturalHeight}`);
                    img.onerror = () => ok('error');
                    img.src = u;
                }),
            new globalThis.URL(src, URL).href,
        );
        check(sizes === 'any' ? size !== 'error' : size === sizes, `${src} loads at ${size}`);
    }
    check((m.screenshots || []).some((s) => s.form_factor === 'wide') && m.screenshots.some((s) => s.form_factor === 'narrow'), 'wide and narrow screenshots for the install dialog');
    check((m.shortcuts || []).map((s) => s.url).join() === './#search,./#favorites,./#updated,./#shuffle', 'home-screen shortcuts: Search, Favorites, Recently Updated, Shuffle');
    check((await page.locator('link[rel="apple-touch-icon"]').count()) === 1 && (await page.locator('meta[name="apple-mobile-web-app-capable"]').count()) === 1, 'iOS Add to Home Screen tags');

    // the service worker, scoped to the console, and the files it keeps
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    check(scope === URL, `a service worker controls ${scope}`);
    await page.waitForFunction(() => window.pocketGarden.offlineReady > 0, null, { timeout: 15000 });
    const kept = await page.evaluate(async () => {
        const want = ['js/main.js', 'js/views.js', 'css/console.css', '../js/gamedata.js', '../js/updates.json', '../garden/js/genres.js'];
        const out = [];
        for (const w of want) out.push(!!(await caches.match(new URL(w, location.href).href)));
        return out;
    });
    check(kept.every(Boolean), `its scripts, styles and the game list are cached (${await page.evaluate(() => window.pocketGarden.offlineReady)} files)`);
    check(!(await page.locator('[aria-label="Install this game"]').count()), 'no "Install this game" pill over the device');
    const cdp = await ctx.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    await cdp.detach();
    check(!installabilityErrors.length, `Chromium finds it installable${installabilityErrors.length ? ': ' + JSON.stringify(installabilityErrors) : ''}`);

    // offline: it still starts
    const before = errors.length;
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.pocketGarden && document.querySelectorAll('.view.is-top .row').length >= 10, null, { timeout: 15000 });
    check(true, 'with the network off, it still starts and lists the games');
    await page.keyboard.press('Enter');
    await settle(page, 500);
    check((await top(page)).title === 'All Games', 'and browses offline');
    await ctx.setOffline(false);
    // offline, box art and game icons it has never shown can't load (the
    // row or label goes without); any other failure while offline is still an error
    const offline = errors.splice(before);
    const failed = offline.filter((e) => e.startsWith('requestfailed'));
    const art = failed.filter((e) => /\/garden\/img\/games\/game-\d+\.jpg |\/game-\d+\/icons\/icon-\d+\.png /.test(e));
    const other = offline.filter((e) => !(e.startsWith('requestfailed') && art.includes(e)) && !/^console: Failed to load resource: net::ERR_(FAILED|INTERNET_DISCONNECTED)/.test(e));
    errors.push(...other);
    check(!other.length, `offline, only box art and icons it hasn't shown yet fail to load (${art.length} pictures)`);
    await boot(page);

    // the browser offers to install: a menu item appears and prompts
    await page.evaluate(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = () => (window.__prompted = true);
        e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
        dispatchEvent(e);
    });
    await settle(page);
    const labels = await page.locator('.view.is-top .row .r-text').allTextContents();
    check(labels.includes('Install App'), 'when the browser can install it, Install App joins the main menu');
    await page.evaluate(() => window.pocketGarden.top.setIndex(window.pocketGarden.top.items.findIndex((i) => i.label === 'Install App')));
    await page.keyboard.press('Enter');
    await settle(page);
    check(await page.evaluate(() => window.__prompted === true), 'selecting it opens the browser install prompt');
    await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
    await settle(page);
    check(!(await page.locator('.view.is-top .row .r-text').allTextContents()).includes('Install App'), 'once installed, the item goes away');

    // without a prompt (Safari, Firefox), Settings explains how
    await page.evaluate(() => window.pocketGarden.top.setIndex(window.pocketGarden.top.items.findIndex((i) => i.label === 'Settings')));
    await page.keyboard.press('Enter');
    await settle(page);
    await page.evaluate(() => window.pocketGarden.top.setIndex(window.pocketGarden.top.items.findIndex((i) => i.label === 'Install as an app')));
    check((await page.locator('.view.is-top .row.sel .r-meta').textContent()).includes('How?'), 'Settings has Install as an app');
    await page.keyboard.press('Enter');
    await settle(page);
    check((await top(page)).title === 'Install' && (await page.locator('.view.is-top').textContent()).includes('Add to Home Screen'), 'and, with no prompt to show, explains how per browser');

    // home-screen shortcuts
    for (const [hash, want] of [['#search', 'search'], ['#favorites', 'Favorites'], ['#updated', 'Recently Updated']]) {
        await boot(page, hash);
        const t = await top(page);
        check(t.type === want || t.title === want, `the ${hash} shortcut opens ${want}`);
    }
    await ctx.close();
}

/** The Dragonfly menu: the Garden's dragonfly companion as a pocket pet (pet.js, pixel-dragonfly.js). */
async function dragonfly() {
    console.log('\nThe dragonfly');
    const now = Date.now();
    const mem = {
        v: 1, met: true, name: 'Pip', look: { body: 'ruby', wings: 'glass', acc: 'tophat' }, visits: 4, metAt: now - 5 * 864e5, together: 3600,
        full: 0.5, joy: 0.5, moodAt: now, fed: { midge: 1 }, plays: 0, petted: 0, catchBest: 3,
        places: { dock: now - 864e5, hub: now - 864e5, tree: now - 36e5, 'path:arcade': now - 36e5 }, games: { 'game-135': 2 },
    };
    const seed = (m) => `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('garden.companion', ${JSON.stringify(JSON.stringify(m))}); }`;

    // never met: where it waits
    let { ctx, page } = await open({ width: 1280, height: 800 });
    await boot(page, '#dragonfly');
    let t = await top(page);
    check(t.title === 'Dragonfly' && t.sel === 'Meet it on the island', 'before you have met it on the island, #dragonfly says where it waits');
    check(/Waiting on the dock/i.test(await page.locator('.view.is-top .pet-card').textContent()), 'and that it is waiting on the dock');
    await ctx.close();

    ({ ctx, page } = await open({ width: 1280, height: 800 }, { init: seed(mem) }));
    // the island itself is not under test here: answer the flight there with a stub
    await ctx.route(/\/index\.html\?go=/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>island</title>' }));
    await boot(page);
    await pick(page, 'Dragonfly');
    await settle(page);
    check(/Pip/.test(await page.locator('.view.is-top .hero-cap').textContent()), 'the main menu has Dragonfly, with its name and mood');
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    check(t.title === 'Pip' && t.sel === 'Feed', 'Dragonfly opens its screen, its name on the status bar');
    const px = await page.evaluate(() => {
        const c = document.querySelector('.view.is-top .pet-cv');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        return { n, w: c.width, h: c.height, cssW: c.offsetWidth };
    });
    check(px.n > 300 && px.cssW % px.w === 0, `the 8-bit pet is drawn on its stage at a whole-number scale (${px.w}×${px.h} art pixels, ×${px.cssW / px.w})`);

    // feed it from the wheel: Feed, then a honey bead
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    check(t.title === 'Feed' && t.sel === 'Midge', 'Feed lists the snacks');
    await pick(page, 'Honey bead');
    await page.keyboard.press('Enter');
    await settle(page, 600);
    check((await top(page)).title === 'Pip', 'choosing one goes back to it');
    await page.waitForFunction(() => window.pocketGarden.top.stage.act?.kind === 'happy', null, { timeout: 8000 });
    let m = await stored(page, 'garden.companion');
    check(m.fed.honey === 1 && m.fed.midge === 1 && m.full > 0.65 && m.joy > 0.65, `it eats it a bite at a time, and the island's memory says so (full ${m.full.toFixed(2)})`);
    await page.waitForFunction(() => !window.pocketGarden.top.stage.busy, null, { timeout: 8000 });

    // pet it: hold the center (F), or tap its stage
    await page.keyboard.press('f');
    await page.waitForFunction(() => !window.pocketGarden.top.stage.busy, null, { timeout: 8000 });
    await page.locator('.view.is-top .pet-cv').click();
    m = await stored(page, 'garden.companion');
    check(m.petted === 2, 'holding the center button pets it, and so does tapping it');
    await page.waitForFunction(() => !window.pocketGarden.top.stage.busy, null, { timeout: 8000 });

    // play
    await pick(page, 'Play');
    await page.keyboard.press('Enter');
    await settle(page);
    check((await top(page)).sel === 'Loop the loop', 'Play lists its tricks');
    await page.keyboard.press('Enter');
    await settle(page, 600);
    m = await stored(page, 'garden.companion');
    check(m.plays === 1 && (await page.evaluate(() => window.pocketGarden.top.stage.act?.kind)) === 'loop', 'and it does a loop the loop');

    // fed in another tab (the island): the meters follow
    const before = await page.locator('.view.is-top .pet-full').evaluate((e) => e.style.width);
    await page.evaluate(() => {
        const v = JSON.parse(localStorage.getItem('garden.companion'));
        v.full = 0.05;
        localStorage.setItem('garden.companion', JSON.stringify(v));
        dispatchEvent(new StorageEvent('storage', { key: 'garden.companion', newValue: JSON.stringify(v) }));
    });
    const after = await page.locator('.view.is-top .pet-full').evaluate((e) => e.style.width);
    check(before !== after && after === '5%' && /Hungry/.test(await page.locator('.view.is-top .pet-mood').textContent()), `a change made on the island shows at once (Full ${before} → ${after}, hungry)`);

    // places: found ones fly you there, the rest give hints
    await pick(page, 'Places');
    await page.keyboard.press('Enter');
    await settle(page);
    t = await top(page);
    check(t.title === 'Places' && /found 4 of \d+ places/i.test(await page.locator('.view.is-top .pet-lead').textContent()), 'Places counts what you have found together');
    await page.keyboard.press('Enter');
    await settle(page);
    const rows = await page.evaluate(() => window.pocketGarden.top.items.map((it) => it.label));
    check(rows.includes('The Dock') && rows.includes('The Great Tree') && rows.includes('? ? ?') && !rows.includes('The Lighthouse'), 'Around the island: the places you have found, and ??? for the rest');
    await pick(page, '? ? ?');
    await page.keyboard.press('Enter');
    await settle(page);
    check((await top(page)).title === 'Hint' && (await page.locator('.view.is-top blockquote').textContent()).length > 20, 'a place not found yet gives its hint');
    await page.keyboard.press('Escape');
    await settle(page, 500);
    await pick(page, 'The Great Tree');
    await page.keyboard.press('Enter');
    await settle(page, 300);
    check(!(await page.locator('#load').isHidden()) && /Pip is flying you there/.test(await page.locator('#load').textContent()), 'choosing one: Pip flies you there');
    await page.waitForURL(/index\.html\?go=place%3Atree$/, { timeout: 8000 });
    check(true, 'to the island, which takes it from there (index.html?go=place:tree)');
    await ctx.close();

    // the dragonfly pressed into the shell opens it too, on a phone
    ({ ctx, page } = await open({ width: 390, height: 844 }, { touch: true, init: seed(mem) }));
    await boot(page);
    const eb = await page.locator('#emboss').boundingBox();
    check(eb.width >= 40 && eb.x + eb.width <= 390 && eb.y + eb.height <= 844, `the embossed dragonfly sits in the shell's lower right (${Math.round(eb.width)}px)`);
    await tap(page, page.locator('#emboss'));
    await settle(page, 500);
    check((await top(page)).title === 'Pip', 'tapping it opens the Dragonfly screen');
    await noSideScroll(page, 'the Dragonfly screen');
    await ctx.close();
}

async function messages() {
    console.log('\nMessages');
    const now = Date.now();
    const newest = UPDATES.filter(([, u]) => now - Date.parse(u.added) < 21 * 864e5).sort((a, b) => Date.parse(b[1].added) - Date.parse(a[1].added))[0]?.[0];
    const seed = () => {
        try {
            if (sessionStorage.getItem('seeded')) return;
            sessionStorage.setItem('seeded', '1');
            const t = Date.now();
            localStorage.setItem('console.recent', JSON.stringify([{ id: 'game-001', t: t - 2 * 36e5 }, { id: 'game-065', t: t - 30 * 36e5 }]));
            localStorage.setItem('spaceShooter_best', '1234');
        } catch {
            /* about:blank */
        }
    };
    let { ctx, page } = await open({ width: 1280, height: 800 }, { messages: true, init: seed });
    await boot(page);
    const M = (fn, arg) => page.evaluate(fn, arg);
    let s = await M(() => ({ friends: pocketGarden.messenger.friendIds(), un: pocketGarden.messenger.unreadTotal() }));
    check(s.friends.includes('garden') && s.friends.includes('game-001') && s.friends.includes('game-065'), `Recently Played games and the dragonfly are friends (${s.friends.join(', ')})`);
    check(s.un > 0 && (await page.locator('#st-msg').isVisible()), `the status bar counts unread messages (✉${s.un})`);
    await pick(page, 'Messages');
    check(/new/.test(await page.locator('.view.is-top .row.sel .r-meta').textContent()), 'the Messages row says how many are new');

    // the newest game calls: a friend request, and the handheld shakes
    if (newest) {
        await page.waitForFunction(() => pocketGarden.top.type === 'ring', null, { timeout: 15000 });
        check(await page.locator('#device.ringing').count() === 1, `the newest game (${newest}) rings with a friend request and the handheld shakes`);
        await page.screenshot({ path: path.join(OUT, 'msg-ring.png') });
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => pocketGarden.top.type === 'thread', null, { timeout: 5000 });
        check((await M(() => pocketGarden.top.id)) === newest && (await M((id) => pocketGarden.messenger.isFriend(id), newest)), 'Accept makes them a friend and opens the chat');
        await settle(page, 1500);
        check((await page.locator('.view.is-top .b.them').count()) >= 2, 'they say hello');
        check((await page.locator('.view.is-top .b-act[data-play]').count()) >= 1, 'and invite you to play, with a link');
        await page.keyboard.press('Escape');
        await settle(page);
    }

    // a chat: quick replies with the wheel, a typed question, a save read
    await M(() => import('./js/messages.js').then((m) => m.openThread(pocketGarden, pocketGarden.messenger, 'game-001')));
    await page.waitForFunction(() => pocketGarden.top.type === 'thread' && pocketGarden.top.id === 'game-001');
    await settle(page, 500);
    check((await top(page)).title === 'Nova Vance', 'a chat shows the character name (Space Shooter → Nova Vance)');
    const chips = await page.locator('.view.is-top .chip').allTextContents();
    const doing = chips.findIndex((c) => /How am I doing/.test(c));
    check(doing > 0, 'a game with a save offers "How am I doing?"');
    for (let i = 0; i < doing; i++) await page.keyboard.press('ArrowDown');
    check((await page.locator('.view.is-top .chip.sel').textContent()).includes('How am I doing'), 'turning the wheel moves along the quick replies');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...pocketGarden.top.el.querySelectorAll('.b.them .b-x')].some((b) => /1,234/.test(b.textContent)), null, { timeout: 6000 });
    check(true, 'they read the save: the answer quotes the best score (1,234)');
    await settle(page, 600);
    await page.locator('.view.is-top .th-input').fill('any tips?');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => pocketGarden.top.el.querySelectorAll('.b.them').length >= 4 && !pocketGarden.top.busy, null, { timeout: 8000 });
    const tips = await M(() => fetch('../game-001/avatar/avatar.json').then((r) => r.json()).then((d) => d.tips));
    const last = (await page.locator('.view.is-top .b.them .b-x').last().textContent()).trim();
    check(tips.some((t) => last.startsWith(t.slice(0, 20))), `a typed "any tips?" gets one of their tips ("${last.slice(0, 40)}…")`);

    // a question from them, answered with a chip: friendship grows
    const before = await M(() => pocketGarden.messenger.friend('game-001').pts);
    await M(() => pocketGarden.messenger.deliver('game-001', pocketGarden.messenger.compose('game-001', 'question')));
    await settle(page, 400);
    check(await page.locator('.view.is-top .th-replies.answering').count() === 1, 'a question turns the quick replies into its answers');
    await page.locator('.view.is-top .chip').first().click();
    await page.waitForFunction(() => !pocketGarden.top.busy, null, { timeout: 8000 });
    const after = await M(() => pocketGarden.messenger.friend('game-001').pts);
    check(after > before, `answering grows the friendship (${before} → ${after} points)`);
    await page.screenshot({ path: path.join(OUT, 'msg-chat.png') });

    // the clock: a friend texts, a banner drops in, tapping it opens the chat
    await page.keyboard.press('Escape');
    await settle(page);
    const un0 = await M(() => pocketGarden.messenger.unreadTotal());
    await M(() => {
        const m = pocketGarden.messenger;
        return m.load('game-065').then(() => m.deliver('game-065', m.compose('game-065', 'idle')));
    });
    await page.waitForSelector('#notif.on');
    check((await M(() => pocketGarden.messenger.unreadTotal())) === un0 + 1, 'a new message adds to the unread count');
    check(/Sprig/.test(await page.locator('#notif').textContent()), 'and a banner shows who it is from (Worldroot → Sprig)');
    check(/day/.test(await page.locator('#notif').textContent()), 'an idle game says how long it has been');
    await page.screenshot({ path: path.join(OUT, 'msg-banner.png') });
    await page.locator('#notif').click();
    await page.waitForFunction(() => pocketGarden.top.type === 'thread' && pocketGarden.top.id === 'game-065');
    check(true, 'tapping the banner opens the chat');
    await settle(page);
    check((await M(() => pocketGarden.messenger.state.unread['game-065'])) === 0, 'reading it marks it read');

    // the ▶ chip plays the game
    await page.locator('.view.is-top .b-act[data-play="game-065"]').last().click();
    await page.waitForURL(/game-065\/index\.html/, { timeout: 5000 });
    check(true, 'the ▶ chip in a message launches the game');
    await ctx.close();

    // an update to a friend's game, and a brand-new game, after a reload
    ({ ctx, page } = await open({ width: 1280, height: 800 }, { messages: true, init: seed }));
    await boot(page);
    await M(() => {
        const m = pocketGarden.messenger;
        m.friend('game-001').ver = '0.0.1';
        m.state.seen = m.state.seen.filter((id) => id !== 'game-002');
        m.state.requests = [];
        m.save();
    });
    await page.reload();
    await page.waitForFunction(() => window.pocketGarden?.messenger?.updates);
    await settle(page, 600);
    const upd = await M(() => (pocketGarden.messenger.state.threads['game-001'] || []).filter((x) => x.k === 'update'));
    check(upd.length === 1 && upd[0].play === 'game-001' && upd[0].x.includes(games.find((g) => g.id === 'game-001').version), `a friend's updated game sends the news with a play link ("${upd[0]?.x.slice(0, 50)}…")`);
    check((await M(() => pocketGarden.messenger.state.requests.map((r) => r.id))).includes('game-002'), 'a game the console has not seen before sends a friend request');
    await page.evaluate(() => pocketGarden.skipBoot());
    await page.waitForFunction(() => pocketGarden.top.type === 'ring', null, { timeout: 15000 });
    check((await M(() => pocketGarden.top.id)) === 'game-002', 'and calls');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await settle(page, 500);
    check(!(await M(() => pocketGarden.messenger.isFriend('game-002'))) && (await M(() => pocketGarden.messenger.state.requests.length)) === 1, 'Not now keeps it in Friend requests');

    // every friend's pictures load
    const pics = await M(async () => {
        const m = pocketGarden.messenger;
        const urls = [...m.friendIds(), 'game-002'].filter((id) => id !== 'garden').flatMap((id) => [m.img(id), m.img(id, true)]);
        const bad = [];
        for (const u of urls) if (!(await fetch(u)).ok) bad.push(u);
        return { n: urls.length, bad };
    });
    check(!pics.bad.length, `every avatar picture loads (${pics.n} checked)`);
    check(!!(await stored(page, 'console.messages'))?.friends?.['game-001'], 'friends and chats are kept in console.messages');
    await ctx.close();

    // a phone: a chat by touch
    ({ ctx, page } = await open({ width: 390, height: 844 }, { touch: true, messages: true, init: seed }));
    await boot(page, '#messages');
    check((await top(page)).title.startsWith('Messages'), '#messages opens Messages');
    await M(() => import('./js/messages.js').then((m) => m.openThread(pocketGarden, pocketGarden.messenger, 'game-001')));
    await page.waitForFunction(() => pocketGarden.top.type === 'thread');
    await settle(page, 500);
    const n0 = await page.locator('.view.is-top .b').count();
    await tap(page, page.locator('.view.is-top .chip').first());
    await page.waitForFunction((n) => pocketGarden.top.el.querySelectorAll('.b').length > n + 1 && !pocketGarden.top.busy, n0, { timeout: 8000 });
    check(true, 'tapping a quick reply sends it and they answer');
    check(await page.locator('.view.is-top .th-input').isVisible(), 'the phone shows a box to type in');
    await noSideScroll(page, 'a chat on a phone');
    await page.screenshot({ path: path.join(OUT, 'msg-phone.png') });
    await ctx.close();
}

async function lounge() {
    console.log('\nLounge');
    const seed = () => {
        try {
            if (sessionStorage.getItem('seeded')) return;
            sessionStorage.setItem('seeded', '1');
            const t = Date.now();
            localStorage.setItem('console.recent', JSON.stringify([{ id: 'game-001', t: t - 2 * 36e5 }, { id: 'game-021', t: t - 5 * 36e5 }, { id: 'game-147', t: t - 9 * 36e5 }]));
            // a save in a game never opened from the console: its character comes to the Lounge too
            localStorage.setItem('roguelike_save', JSON.stringify({ level: 3 }));
        } catch {
            /* about:blank */
        }
    };
    let { ctx, page } = await open({ width: 1280, height: 800 }, { init: seed });
    await boot(page, '#lounge');
    const L = (fn, arg) => page.evaluate(fn, arg);
    check((await top(page)).type === 'lounge', '#lounge opens the Lounge');
    const pool = await L(() => pocketGarden.top.pool);
    check(['game-001', 'game-021', 'game-147'].every((id) => pool.includes(id)) && pool.includes('game-003'), `friends and saved games are the regulars (${pool.join(', ')})`);
    check(!pool.includes('garden'), 'the dragonfly is not a guest (it flies about if you have met it)');
    await page.waitForFunction(() => pocketGarden.top.guests.length >= 3 && pocketGarden.top.guests.every((g) => g.state !== 'enter'), null, { timeout: 15000 });
    await page.waitForFunction(() => pocketGarden.top.guests.every((g) => g.img.complete && g.img.naturalWidth === 96 && g.img.naturalHeight === 200), null, { timeout: 8000 });
    check(true, 'guests walk in on their 96×200 sprite sheets (five facings by three steps)');
    check(await page.locator('.lg-hud .lg-who i').textContent().then((t) => /^[♥♡]{5}$/.test(t)), 'the HUD shows the picked guest with their friendship hearts');
    await page.screenshot({ path: path.join(OUT, 'lounge.png') });

    // every character's sprite sheet loads in the browser
    const bad = await L(async () => {
        const cast = pocketGarden.loungeCast;
        const games = [...pocketGarden.messenger.byId.values()];
        const out = [];
        await Promise.all(
            Object.keys(cast).map(
                (id) =>
                    new Promise((ok) => {
                        const img = new Image();
                        img.onload = () => (img.naturalWidth === 96 && img.naturalHeight === 200 ? 0 : out.push(id), ok());
                        img.onerror = () => (out.push(id), ok());
                        img.src = `../${games.find((g) => g.id === id)?.folder || id}/avatar/sprite.png`;
                    }),
            ),
        );
        return { n: Object.keys(cast).length, bad: out };
    });
    check(bad.n === TOTAL && !bad.bad.length, `all ${bad.n} Lounge sprites load (${bad.bad.join(', ') || 'none missing'})`);

    // walking: eight ways with the arrow keys
    await L(() => pocketGarden.top.closeDialog());
    const p0 = await L(() => ({ x: pocketGarden.top.me.x, y: pocketGarden.top.me.y }));
    await page.keyboard.down('ArrowRight');
    await settle(page, 600);
    await page.keyboard.up('ArrowRight');
    const p1 = await L(() => ({ x: pocketGarden.top.me.x, y: pocketGarden.top.me.y, dir: pocketGarden.top.me.dir }));
    check(p1.x > p0.x + 10 && p1.dir === 'e', `→ walks the bartender east (${Math.round(p0.x)} → ${Math.round(p1.x)})`);
    await page.keyboard.down('ArrowDown');
    await page.keyboard.down('ArrowLeft');
    await settle(page, 500);
    const p2 = await L(() => ({ x: pocketGarden.top.me.x, y: pocketGarden.top.me.y, dir: pocketGarden.top.me.dir }));
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('ArrowLeft');
    check(p2.dir === 'sw' && p2.y > p1.y && p2.x < p1.x, `↓+← walks south-west (facing ${p2.dir}, a mirrored sprite)`);
    check(!(await L(() => pocketGarden.top.free(pocketGarden.top.me.x, 3 * 16 + 8))), 'the counter is solid');

    // an order: someone at the bar asks; the wheel picks them and ● walks over
    const who = await L(() => {
        const v = pocketGarden.top;
        const a = v.guests.find((g) => g.id === 'game-001') || v.guests[0];
        v.seatGuest(a, 'bar');
        a.wants = 'coffee';
        a.asked = null;
        return a.id;
    });
    await page.waitForFunction((id) => pocketGarden.top.guests.find((g) => g.id === id)?.state === 'order', who, { timeout: 15000 });
    check(true, `${who} sits at the bar with an order bubble`);
    await L((id) => {
        const v = pocketGarden.top;
        v.focus = v.guests.findIndex((g) => g.id === id);
    }, who);
    await page.locator('#wheel-center').click();
    await page.waitForFunction(() => !!pocketGarden.top.dlg, null, { timeout: 10000 });
    check(true, '● walks the bartender over (across the bar) and they order in a dialog box');
    check((await page.locator('.lg-name').textContent()).length > 0 && (await page.locator('.lg-face').isVisible()), 'the dialog box has their name and portrait');
    await page.keyboard.press('Enter');
    await settle(page, 200);
    check(await page.locator('.lg-choice.sel').isVisible(), 'and a choice with a ▶ cursor');
    await page.screenshot({ path: path.join(OUT, 'lounge-order.png') });
    await page.keyboard.press('Enter');
    await page.waitForSelector('.lg-craft:not([hidden])');
    check(true, '"Coming right up!" opens the recipe and the shelf');
    const pts0 = await L((id) => pocketGarden.messenger.friend(id)?.pts || 0, who);
    await page.locator('.lg-ing[aria-label="Milk"]').click();
    check((await L(() => pocketGarden.top.craft.misses)) === 1 && (await page.locator('.lg-miss').isVisible()), 'a wrong ingredient is a miss');
    await page.locator('.lg-ing[aria-label="Coffee beans"]').click();
    await page.locator('.lg-ing[aria-label="Hot water"]').click();
    check((await L(() => pocketGarden.top.craft.phase)) === 'time' && (await page.locator('.lg-meter').isVisible()), 'the right ones in order, then the timing needle');
    await page.screenshot({ path: path.join(OUT, 'lounge-craft.png') });
    await page.waitForFunction(() => Math.abs(pocketGarden.top.craft.needle - 0.5) < 0.04, null, { polling: 5, timeout: 8000 });
    await page.keyboard.press(' ');
    await page.waitForSelector('.lg-stars');
    check((await page.locator('.lg-stars').textContent()).startsWith('★★☆'), 'the gold with one miss is two stars');
    await page.waitForFunction(() => !pocketGarden.top.craft && !!pocketGarden.top.dlg, null, { timeout: 5000 });
    const after = await L((id) => ({ pts: pocketGarden.messenger.friend(id)?.pts || 0, l: JSON.parse(localStorage.getItem('console.lounge')) }), who);
    check(after.pts >= pts0 + 4, `serving it grows your friendship (+${after.pts - pts0})`);
    check(after.l.served[who]?.item === 'coffee' && after.l.served[who].q === 2 && after.l.count === 1, 'the Lounge remembers what you made them');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // later, in Messages: thanks for the drink yesterday
    const thanks = await L((id) => {
        const l = JSON.parse(localStorage.getItem('console.lounge'));
        l.served[id].t -= 26 * 36e5;
        localStorage.setItem('console.lounge', JSON.stringify(l));
        return pocketGarden.messenger.compose(id, 'lthanks');
    }, who);
    check(thanks?.k === 'lthanks' && /coffee/.test(thanks.x), `a day later they text to say thanks ("${thanks?.x}")`);
    check((await L((id) => pocketGarden.messenger.compose(id, 'lthanks').k, who)) !== 'lthanks', 'once');

    // a friend asks for a drink in Messages; its button opens the Lounge with them at the bar
    await page.keyboard.press('Escape');
    await settle(page);
    const ask = await L(() => {
        const m = pocketGarden.messenger;
        const msg = m.compose('game-147', 'lask');
        m.deliver('game-147', msg, { notify: false });
        return msg;
    });
    check(ask.lounge === 'game-147' && /Lounge|bar|stool|seat/i.test(ask.x), `a friend asks for something ("${ask.x}")`);
    check(/🍹/.test(await L(() => pocketGarden.stack[0].items.find((x) => x.label === 'Lounge').meta)), 'the Lounge row on the main menu says someone is waiting');
    await L(() => import('./js/messages.js').then((m) => m.openThread(pocketGarden, pocketGarden.messenger, 'game-147')));
    await page.waitForSelector('.view.is-top [data-lounge]');
    await page.locator('.view.is-top [data-lounge]').last().click();
    await page.waitForFunction(() => pocketGarden.top.type === 'lounge', null, { timeout: 5000 });
    await page.waitForFunction(() => pocketGarden.top.guests.find((g) => g.id === 'game-147')?.state === 'order', null, { timeout: 15000 });
    const o = await L(() => {
        const a = pocketGarden.top.guests.find((g) => g.id === 'game-147');
        return { order: a.order, asked: a.asked, want: JSON.parse(localStorage.getItem('console.lounge')).orders['game-147']?.item };
    });
    check(o.asked === 'msg' && o.order === o.want, `"Go to the Lounge" brings you to the bar, and they order what they asked for (${o.order})`);
    check((await L(() => pocketGarden.top.guests[0].id)) === 'game-147', 'the one who asked walks in first');
    await ctx.close();

    // a phone: tap the floor to walk there
    ({ ctx, page } = await open({ width: 390, height: 844 }, { touch: true, init: seed }));
    await boot(page, '#lounge');
    await settle(page, 1200);
    await L(() => pocketGarden.top.closeDialog());
    await noSideScroll(page, 'the Lounge on a phone');
    const q0 = await L(() => ({ x: pocketGarden.top.me.x, y: pocketGarden.top.me.y }));
    const box = await page.locator('.lg-cv').boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height * 0.72);
    await settle(page, 2500);
    const q1 = await L(() => ({ x: pocketGarden.top.me.x, y: pocketGarden.top.me.y }));
    check(Math.hypot(q1.x - q0.x, q1.y - q0.y) > 30, `tapping the floor walks the bartender there (${Math.round(q0.x)},${Math.round(q0.y)} → ${Math.round(q1.x)},${Math.round(q1.y)})`);
    await page.screenshot({ path: path.join(OUT, 'lounge-phone.png') });
    await ctx.close();
}

// ------------------------------------------------------------------ cloud (a mock Supabase)

/** A Supabase stand-in: game_saves rows by "game|slot", the play counts, and every request it was sent. */
async function mockSupabase(ctx, db) {
    await ctx.route('https://zhjcfwrgvwfmjhfibkjc.supabase.co/**', async (r) => {
        const req = r.request();
        const u = new globalThis.URL(req.url());
        db.calls.push({ method: req.method(), path: u.pathname, search: u.search, headers: req.headers(), body: req.postData() });
        const json = (status, body) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
        if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        if (u.pathname === '/auth/v1/otp') return json(200, {});
        if (u.pathname === '/auth/v1/logout') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        if (u.pathname === '/rest/v1/game_stats') return json(200, db.stats);
        if (u.pathname === '/rest/v1/game_saves') {
            const eq = (k) => u.searchParams.get(k)?.replace(/^eq\./, '');
            if (req.method() === 'POST') {
                const row = JSON.parse(req.postData());
                db.rows[`${row.game}|${row.slot}`] = { ...row, updated_at: new Date().toISOString() };
                return r.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
            }
            const all = Object.values(db.rows);
            if (eq('game')) return json(200, all.filter((x) => x.game === eq('game') && x.slot === eq('slot')));
            return json(200, all.map(({ game, slot, summary, version, updated_at }) => ({ game, slot, summary, version, updated_at })));
        }
        return json(404, {});
    });
}

// sign-in only works on the hosts a link can come back to (lib/core/cloud.js CLOUD_HOSTS): with BASE=disk, serve the
// repo on localhost instead of pocket.test
const CLOUD_BASE = DISK ? 'http://localhost:8199' : BASE;

function fakeJwt(sub, email) {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256' })}.${b64({ sub, email, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

async function cloudScenario() {
    const URL = `${CLOUD_BASE}/console/`;
    console.log('\nCloud: sign in, back up, a new device restores, Saved Games, player counts');
    const db = { rows: {}, calls: [], stats: [{ game: 'game-135', players: 1234, plays: 4000 }, { game: 'game-001', players: 1, plays: 3 }] };
    const back = `#access_token=${fakeJwt('user-1', 'player@example.com')}&refresh_token=r1&expires_in=3600&token_type=bearer&type=magiclink`;

    // ---- the first device: has stars, a shell and a game save
    let { ctx, page } = await open({ width: 1280, height: 800 }, {
        init: () => {
            try {
                localStorage.setItem('web-games.stats', 'on');
                if (!localStorage.getItem('garden.starred')) {
                    localStorage.setItem('garden.starred', JSON.stringify(['game-135', 'game-031']));
                    localStorage.setItem('console.settings', JSON.stringify({ shell: 'lilac', glow: 'amber' }));
                    localStorage.setItem('grimhold-abyss-save', JSON.stringify({ level: 4, gold: 99 }));
                }
            } catch {
                /* about:blank */
            }
        },
    });
    await mockSupabase(ctx, db);
    if (DISK) await serveDisk(ctx, CLOUD_BASE);
    await boot(page, '#game-135', URL);
    await page.waitForFunction(() => document.querySelector('.d-players')?.textContent.includes('players'));
    check((await page.textContent('.d-players')).includes('1.2k players'), 'the cartridge shows the player count (1.2k players)');
    check(db.calls.some((c) => c.path === '/rest/v1/game_stats' && c.headers.apikey?.startsWith('sb_publishable_')), 'the counts are read with the publishable key');
    await page.evaluate(() => window.pocketGarden.popTo(1));
    await settle(page);
    await pick(page, 'Cloud');
    await page.keyboard.press('Enter');
    await settle(page);
    check((await top(page)).title === 'Cloud', 'the main menu opens Cloud');
    check((await page.evaluate(() => window.pocketGarden.top.items.map((x) => x.label))).includes('Sign in with email'), 'signed out, it offers to sign in');
    await pick(page, 'Sign in with email');
    await page.keyboard.press('Enter');
    await settle(page);
    await page.fill('.cl-form input', 'nope');
    await page.keyboard.press('Enter');
    check((await page.textContent('.cl-form .nm-hint')).includes('email address first'), 'a bad address is refused');
    await page.fill('.cl-form input', 'player@example.com');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.cl-form .nm-hint').textContent.includes('Check your inbox'));
    const otp = db.calls.find((c) => c.path === '/auth/v1/otp');
    check(otp && JSON.parse(otp.body).email === 'player@example.com' && decodeURIComponent(otp.search).includes('/console/'), 'the sign-in link is emailed, coming back to the console');
    await page.screenshot({ path: path.join(OUT, 'cloud-email.png') });

    // back from the email: nothing in the cloud yet, so this device becomes the backup
    await page.goto('about:blank');
    await page.goto(URL + back);
    await page.waitForFunction(() => window.pocketGarden?.top?.title === 'Cloud' && window.pocketGarden.cloud.row);
    check(!(await page.evaluate(() => location.hash)), 'the sign-in tokens are taken out of the address');
    await page.evaluate(() => window.pocketGarden.skipBoot());
    const up = db.rows['pocket-garden|main'];
    check(up && up.user_id === 'user-1' && JSON.parse(up.data['garden.starred']).length === 2 && JSON.parse(up.data['console.settings']).shell === 'lilac', 'signed in, the Pocket Garden is backed up (stars, shell)');
    check(!('grimhold-abyss-save' in up.data), 'the backup holds only the Pocket Garden keys');
    await settle(page, 500);
    check((await page.textContent('.cl-lead')).startsWith('Backed up'), 'Cloud says when it was backed up');
    await page.screenshot({ path: path.join(OUT, 'cloud-signed-in.png') });

    // a change is backed up by itself
    await page.evaluate(() => { window.pocketGarden.store.toggleFav('game-001'); window.pocketGarden.cloud.lastUp = 0; window.pocketGarden.cloud.autosave(); });
    await page.waitForFunction(() => !window.pocketGarden.cloud.busy);
    await settle(page, 200);
    check(JSON.parse(db.rows['pocket-garden|main'].data['garden.starred']).includes('game-001'), 'auto backup sends a new star');

    // Saved Games: the game's save is on this device; back them all up
    await pick(page, 'Saved Games');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.pocketGarden.top.title === 'Saved Games' && window.pocketGarden.top.saves);
    const sg = await page.evaluate(() => window.pocketGarden.top.items.map((x) => x.label || x.game?.id));
    check(sg[0] === 'Back up all 1' && sg.includes('game-031'), 'Saved Games lists the game with a save on this device');
    await page.evaluate(() => window.pocketGarden.top.setIndex(0));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.pocketGarden.top.running && window.pocketGarden.top.el.querySelector('.cl-lead').textContent.includes('1 backed up'));
    const gs = db.rows['game-031|pocket-garden'];
    check(gs && JSON.parse(gs.data['grimhold-abyss-save']).level === 4 && gs.summary.includes('4'), "the game's save is backed up in its own slot, with a summary");
    await page.screenshot({ path: path.join(OUT, 'cloud-saved-games.png') });
    await ctx.close();

    // ---- a new device: nothing on it, signs in, and the backup comes back by itself
    ({ ctx, page } = await open({ width: 1280, height: 800 }));
    await mockSupabase(ctx, db);
    if (DISK) await serveDisk(ctx, CLOUD_BASE);
    await page.goto(URL + back);
    await page.waitForFunction(() => localStorage.getItem('garden.starred')?.includes('game-001'), null, { timeout: 15000 });
    await page.waitForFunction(() => window.pocketGarden && document.querySelector('.view'));
    await settle(page, 600);
    check((await page.getAttribute('#device', 'data-shell')) === 'lilac', 'a new device takes the backup by itself: the lilac shell is back');
    check((await page.evaluate(() => window.pocketGarden.store.favs.length)) === 3, 'and the stars');
    // the game's save, restored from Saved Games
    await page.evaluate(() => window.pocketGarden.openCloud());
    await settle(page);
    await pick(page, 'Saved Games');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.pocketGarden.top.title === 'Saved Games' && window.pocketGarden.top.saves);
    const i = await page.evaluate(() => window.pocketGarden.top.items.findIndex((x) => x.game?.id === 'game-031'));
    check(i >= 0, 'the cloud backup of a game shows on a device without its save');
    await page.evaluate((n) => window.pocketGarden.top.setIndex(n), i);
    await page.keyboard.press('Enter');
    await settle(page);
    await pick(page, 'Restore to this device');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => localStorage.getItem('grimhold-abyss-save'));
    check(JSON.parse(await page.evaluate(() => localStorage.getItem('grimhold-abyss-save'))).gold === 99, "the game's save is restored to this device");
    // sign out
    await page.evaluate(() => window.pocketGarden.popTo(1));
    await settle(page);
    await page.evaluate(() => window.pocketGarden.openCloud());
    await settle(page);
    await pick(page, 'Sign out');
    await page.keyboard.press('Enter');
    await settle(page, 400);
    check(db.calls.some((c) => c.path === '/auth/v1/logout') && !(await page.evaluate(() => localStorage.getItem('web-games.cloud'))), 'Sign out signs out (of every game)');
    check((await page.evaluate(() => window.pocketGarden.top.items[0].label)) === 'Sign in with email', 'and Cloud offers to sign in again');
    await ctx.close();
}

try {
    if (!ONLY || ONLY === 'dragonfly') await dragonfly();
    if (!ONLY || ONLY === 'desktop') await desktop();
    // the installable-app checks fetch outside the page and need a real server
    if (!ONLY || ONLY === 'pwa') {
        if (DISK) console.log('\nInstallable app: skipped with BASE=disk (needs a server)');
        else await pwa();
    }
    if (!ONLY || ONLY === 'calm') await calm();
    if (!ONLY || ONLY === 'phones') {
        await phone({ width: 390, height: 844 }, 'phone');
        await phone({ width: 844, height: 390 }, 'landscape');
    }
    if (!ONLY || ONLY === 'storage') await storage();
    if (!ONLY || ONLY === 'messages') await messages();
    if (!ONLY || ONLY === 'lounge') await lounge();
    if (!ONLY || ONLY === 'cloud') await cloudScenario();
    if (errors.length) throw new Error('errors:\n' + errors.join('\n'));
    console.log('\nAll console checks passed.');
} catch (e) {
    console.error('\n' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    process.exitCode = 1;
} finally {
    await Promise.all(browsers.map((b) => b.close()));
}
