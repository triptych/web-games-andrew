/**
 * browsertest.mjs — Folio & Fable in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game: the prologue plays and
 *   Continue (a real click) walks through it → a real click on a bookshelf in the canvas opens that spot's sheet →
 *   Add a book → it stands on the shelf → Escape (a real key) closes the sheet → the O key opens the shop → the clock
 *   runs, customers come in → a customer with a wish: 🔔 opens the counter, a book is served → the day ends, the
 *   evening sheet: read a book, Sleep → the Books sheet and the 3D inspector (the WebGL canvas is not blank; Open
 *   swings the cover) → the 3D shelves: a real click on a book opens it in the inspector → the bindery crafts a book
 *   by clicks → the adventurers sheet sends an expedition → Save & Quit → Continue restores the day → the last
 *   chapter's masterwork → the ending screen. The ElevenLabs clips decode and the music plays.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title and the story, the dock is
 *   on screen and ≥ 44 px, a tap on the shop opens a sheet whose Done button is on screen, a drag pans the shop,
 *   no sideways scroll, the canvas fills its frame, nothing covers the dock.
 * nostorage: localStorage throws; the game boots, plays a day and saving fails quietly.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8150          # from the REPO ROOT
 *   node game-150/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8150), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8150';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, fast = 4 } = {}) {
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-150/index.html?debug=1&fast=${fast}`);
    await page.waitForFunction(() => window.__ff && __ff.mode === 'title', null, { timeout: 60000 });
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
/** Where a slot's furniture is on screen (client px), from the shop view's own layout. */
const slotPoint = (page, slot, dy = 0.9) => Q(page, ([s, d]) => {
    const v = __ff.shop, r = document.getElementById('shop').getBoundingClientRect();
    v.centerOn(s + 0.5);
    v.layout(__ff.G.shop.width);
    return { x: r.left + v.sx(s + 0.5), y: r.top + v.floorY - v.s * d };
}, [slot, dy]);
/** Click through the story until it closes. */
async function skipStory(page) {
    for (let i = 0; i < 20; i++) {
        if (!(await visible(page, 'story'))) return true;
        await click(page, '#story-next');
        await page.waitForTimeout(60);
    }
    return !(await visible(page, 'story'));
}
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Non-blank: fewer than 97% of sampled pixels within a few levels of the first one. */
const notBlank = (page, sel, stage) => Q(page, ([s, st]) => {
    const c = document.querySelector(s);
    // a WebGL canvas is read in the same task as its render (no preserveDrawingBuffer)
    if (st) { const S = __ff[st]; S.renderer.render(S.scene, S.camera); }
    const t = document.createElement('canvas'); t.width = 64; t.height = 64;
    const x = t.getContext('2d'); x.drawImage(c, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data;
    let same = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) < 12) same++;
    return same / (d.length / 4) < 0.97;
}, [sel, stage]);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await shot(page, 'desktop-title');

    // New Game by a real mouse click on the button
    const nb = await Q(page, () => { const r = document.querySelector('#title-menu [data-act="new"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.click(nb.x, nb.y);
    await until(page, () => __ff.mode === 'play' && !document.getElementById('story').hidden, 'New Game starts and the prologue is told');
    check(await Q(page, () => document.getElementById('story-text').textContent.includes('Old Vellum')), 'Old Vellum introduces himself');
    await shot(page, 'desktop-prologue');
    check(await skipStory(page), 'Continue walks through the prologue and the first chapter');
    check(await Q(page, () => __ff.G.story.told.includes('ch1')), 'chapter 1 was told once');

    // the audio: clips decode and the music plays (the click was a gesture)
    await until(page, () => __ff.audio.buffers['sfx-bell'] && __ff.audio.buffers['vo-vellum-sale'] && __ff.audio.buffers['vo-vellum-ch1-intro'], 'the ElevenLabs effects and voices decode', 40000);
    await until(page, () => __ff.audio.playing(), 'the music is playing');

    // a real click on a bookshelf in the canvas → its sheet
    const p = await slotPoint(page, 1, 0.9);
    await page.waitForTimeout(200);
    await page.mouse.click(p.x, p.y);
    await until(page, () => !document.getElementById('column').hidden && document.getElementById('column-head').textContent.includes('2'), 'clicking a bookshelf opens its sheet');
    await click(page, '#column-body .row-actions .btn');
    await until(page, () => !document.getElementById('picker').hidden, 'Add a book opens the book picker');
    const n0 = await Q(page, () => __ff.shelfBooks('wall', 1).filter(Boolean).length);
    await click(page, '#picker-list .btn.primary');
    await until(page, (n) => __ff.shelfBooks('wall', 1).filter(Boolean).length === n + 1 && document.getElementById('picker').hidden, 'choosing a book stands it on the shelf', 20000, n0);
    await shot(page, 'desktop-column');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('column').hidden, 'Escape (a real key) closes the sheet');

    // Books → fill the shelves
    await click(page, '[data-tab="books"]');
    await until(page, () => !document.getElementById('books').hidden, 'the Books tab opens the library');
    await click(page, '#btn-autoshelve');
    await until(page, () => __ff.G.books.every((b) => b.loc), '✨ Fill shelves puts every book out');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('books').hidden, 'and Escape closes it');

    // open the shop with the O key; customers come; serve a wish at the counter
    await page.keyboard.press('KeyO');
    await until(page, () => __ff.G.phase === 'open' && __ff.G.clock > 0, 'the O key opens the shop and the clock runs');
    await until(page, () => __ff.seen.enter >= 1, 'a customer comes in', 60000);
    await until(page, () => !document.getElementById('btn-waiting').hidden, 'someone brings a wish to the counter (🔔)', 90000);
    await shot(page, 'desktop-open');
    await click(page, '#btn-waiting');
    await until(page, () => !document.getElementById('serve').hidden, '🔔 opens the counter');
    const t0 = await Q(page, () => __ff.G.clock);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __ff.G.clock === t, t0), 'the shop clock waits while Tam serves');
    const served = await Q(page, () => {
        const b = document.querySelector('#serve-list .btn.primary');
        if (b) { b.click(); return 'served'; }
        document.getElementById('serve-commission').click(); return 'commissioned';
    });
    await until(page, (k) => document.getElementById('serve').hidden && (k === 'served' ? __ff.seen.served >= 1 : __ff.G.commissions.length >= 1), `the wish is answered (${served})`, 20000, served);
    // a chapter can finish mid-day: Old Vellum's beat pauses the shop until it is read, as a player would
    for (let i = 0; i < 400 && !(await Q(page, () => __ff.G.phase === 'evening')); i++) {
        if (await visible(page, 'story')) await click(page, '#story-next');
        if (await visible(page, 'loot')) await click(page, '#loot [data-close]');
        await Q(page, () => { const cu = __ff.G.customers.find((c) => c.state === 'ask' && c.want); if (cu) __ff.cmd({ t: 'decline', cust: cu.id }); });
        await page.waitForTimeout(250);
    }
    await skipStory(page);
    await until(page, () => __ff.G.phase === 'evening' && !document.getElementById('evening').hidden, 'the day ends and the evening sheet opens', 60000);
    await shot(page, 'desktop-evening');
    await click(page, '#evening-body .btn.primary');
    await until(page, () => __ff.G.player.readToday, 'Tam reads a book in the evening');
    await click(page, '#evening-sleep');
    await until(page, () => __ff.G.phase === 'morning' && __ff.G.day === 2, 'Sleep starts day 2');
    await Q(page, () => __ff.skipStory());

    // the 3D inspector from a cover in the library
    await click(page, '[data-tab="books"]');
    await click(page, '#books-list .cover');
    await until(page, () => !document.getElementById('inspect').hidden && __ff.stage.bookObj, 'tapping a cover opens the 3D inspector');
    await page.waitForTimeout(1500);
    check(await notBlank(page, '#stage3d', 'stage'), 'the 3D book is drawn (canvas not blank)');
    await click(page, '#ins-open');
    await until(page, () => __ff.stage.openT > 0.6, 'Open swings the cover open');
    await shot(page, 'desktop-inspect');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('inspect').hidden && !__ff.stage.visible, 'Escape closes the inspector');
    await page.keyboard.press('Escape');

    // the 3D shelves: a real click on a book
    await Q(page, () => { __ff.ui.closeAll(); });
    await click(page, '#btn-shelves3d');
    await until(page, () => !document.getElementById('shelves3d').hidden && __ff.shelfStage.picks.length > 0, 'the 3D shelves open with every book on them');
    await page.waitForTimeout(1200);
    check(await notBlank(page, '#shelves-canvas', 'shelfStage'), 'the 3D shelves are drawn');
    await shot(page, 'desktop-shelves3d');
    const target = await Q(page, () => { const id = __ff.shelfStage.picks[0].userData.book; __ff.shelfStage.focusBook(id); return id; });
    await page.waitForTimeout(300);
    const sp = await Q(page, (id) => __ff.shelfStage.screenOf(id), target);
    await page.mouse.click(sp.x, sp.y);
    await until(page, (id) => !document.getElementById('inspect').hidden && __ff.stage.bookObj && document.getElementById('ins-title').textContent.startsWith(__ff.G.books.find((b) => b.id === id).title), 'a real click on a shelved book opens it in the inspector', 20000, target);
    await Q(page, () => __ff.ui.closeAll());

    // the bindery, by clicks
    await Q(page, () => { const G = __ff.G; G.flags.bindery = true; G.mats = { leather: 2, honey: 2, gold: 1, clasp: 1 }; });
    await click(page, '[data-tab="bindery"]');
    await until(page, () => !document.getElementById('bindery').hidden, 'the bindery opens');
    for (const name of ['Calfskin Leather', 'Honey Ink', 'Gold Leaf']) await Q(page, (nm) => [...document.querySelectorAll('#bindery-body .mslot')].find((b) => b.textContent.includes(nm))?.click(), name);
    const crafted = await Q(page, () => __ff.G.stats.crafted);
    await Q(page, () => [...document.querySelectorAll('#bindery-body .btn.primary')].find((b) => b.textContent.includes('Bind!'))?.click());
    await until(page, (c) => __ff.G.stats.crafted === c + 1 && !document.getElementById('inspect').hidden, 'Bind! crafts a book and shows it in 3D', 20000, crafted);
    check(await Q(page, () => { const b = __ff.G.books.at(-1); return b.crafted && b.rarity >= 1 && (b.stats.hearth || 0) > 0; }), 'a leather cookbook with Hearth, uncommon or better');
    await Q(page, () => __ff.ui.closeAll());

    // adventurers: Rook carries a book and goes to the woods
    await Q(page, () => { const G = __ff.G; G.flags.exp = true; G.heroes.rook.hired = true; });
    await click(page, '[data-tab="heroes"]');
    await until(page, () => !document.getElementById('heroes').hidden, 'the Quests sheet opens');
    await Q(page, () => [...document.querySelectorAll('#heroes-body .btn')].find((b) => b.textContent === 'Add to party')?.click());
    await Q(page, () => document.querySelector('#heroes-body .place:not([disabled])')?.click());
    await Q(page, () => [...document.querySelectorAll('#heroes-body .btn.primary')].find((b) => b.textContent.includes('Send'))?.click());
    await until(page, () => __ff.G.exps.length === 1 && __ff.G.heroes.rook.away, 'Rook is sent on an expedition');
    await shot(page, 'desktop-heroes');
    await Q(page, () => __ff.ui.closeAll());

    // save and quit, continue
    const day = await Q(page, () => __ff.G.day);
    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'the ☰ button opens the menu');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ff.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (d) => __ff.mode === 'play' && __ff.G.day === d && __ff.G.exps.length === 1, 'Continue restores the day and the expedition', 30000, day);
    await Q(page, () => __ff.skipStory());

    // the last chapter: bind the Book of Larkspur → the ending
    await Q(page, () => { const G = __ff.G; G.story.ch = 7; G.story.told.push('ch7'); G.flags.bindery = true; G.mats = { dragonhide: 1, moon: 1, star: 1, gold: 1 }; __ff.ui.closeAll(); });
    await click(page, '[data-tab="bindery"]');
    await Q(page, () => [...document.querySelectorAll('#bindery-body .btn.primary')].find((b) => b.textContent.includes('Larkspur'))?.click());
    await until(page, () => __ff.G.ending && !document.getElementById('story').hidden, 'the Book of Larkspur is bound and Old Vellum speaks');
    await skipStory(page);
    await until(page, () => !document.getElementById('ending').hidden, 'the ending screen follows the last words');
    await shot(page, 'desktop-ending');
    await click(page, '#ending [data-close]');
    await until(page, () => document.getElementById('ending').hidden && __ff.mode === 'play', 'and the shop stays open after the ending');
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
    await until(page, () => __ff.mode === 'play', 'a tap on New Game starts');
    for (let i = 0; i < 12 && await visible(page, 'story'); i++) { await tapSel('#story-next'); await page.waitForTimeout(80); }
    check(!(await visible(page, 'story')), 'taps on Continue walk through the story');

    const L = await Q(page, () => {
        const c = document.getElementById('shop').getBoundingClientRect(), f = document.getElementById('shop-wrap').getBoundingClientRect();
        const app = document.getElementById('app').getBoundingClientRect();
        return {
            noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
            canvas: Math.abs(c.width - f.width) < 2 && Math.abs(c.height - f.height) < 2,
            app: Math.abs(app.height - (visualViewport?.height ?? innerHeight)) < 2 && app.top === 0,
        };
    });
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the shop canvas fills its frame');
    check(L.app, 'the game fills the visible viewport (px, not 100vh)');
    const dock = await Q(page, () => [...document.querySelectorAll('#dock button')].filter((b) => !b.hidden).map((b) => {
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { id: b.dataset.tab || b.id, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, top: b === top || b.contains(top) };
    }));
    for (const d of dock) check(d.ok && d.top, `dock ${d.id} is ≥ 44 px, on screen and not covered`);
    await shot(page, `phone-${w}x${h}`);

    // drag the shop sideways with a real touch
    const c0 = await Q(page, () => __ff.shop.cam);
    const mid = await Q(page, () => { const r = document.getElementById('shop').getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + r.height * 0.5, max: __ff.shop.maxCam }; });
    if (mid.max > 60) {
        await touch('touchStart', mid.x, mid.y);
        for (let i = 1; i <= 8; i++) await touch('touchMove', mid.x - i * 15, mid.y);
        await touch('touchEnd', 0, 0);
        check(await Q(page, (c) => Math.abs(__ff.shop.cam - c) > 30, c0), 'dragging pans the shop');
    }
    // a tap on the shelf opens its sheet; Done is on screen
    const p = await slotPoint(page, 1, 0.9);
    await page.waitForTimeout(300);
    await page.touchscreen.tap(p.x, p.y);
    await until(page, () => !document.getElementById('column').hidden, 'a tap on the shelf opens its sheet');
    // a card's text keeps a readable width; its buttons wrap below instead of squeezing it to a word a line (v1.0.1)
    const narrow = (sel) => Q(page, (q) => Math.min(...[...document.querySelectorAll(q)].map((e) => e.getBoundingClientRect().width)), sel);
    const colInfo = await narrow('#column .card .info');
    check(colInfo >= 150, `the shelf card's text is at least 150 px wide (${Math.round(colInfo)} px)`);
    await Q(page, () => { const s = document.querySelector('#column .sheet'); s.scrollTop = 1e6; });
    const foot = await Q(page, () => { const r = document.querySelector('#column .sheet-foot .btn').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 44; });
    check(foot, 'the sheet\'s Done button stays on screen, scrolled or not');
    await page.waitForTimeout(300);
    check(await visible(page, 'column'), 'the sheet stays open after the finger lifts');
    await tapSel('#column .sheet-foot .btn');
    await until(page, () => document.getElementById('column').hidden, 'a tap on Done closes it');
    await tapSel('[data-tab="books"]');
    await until(page, () => !document.getElementById('books').hidden, 'a tap on the Books tab opens the library');
    await shot(page, `phone-books-${w}x${h}`);
    const libInfo = await narrow('#books-list .card .info');
    check(libInfo >= 150, `the library cards' text is at least 150 px wide (${Math.round(libInfo)} px)`);
    await tapSel('#btn-autoshelve');
    await tapSel('#books .sheet-foot .btn');
    await tapSel('#btn-main');
    await until(page, () => __ff.G.phase === 'open', 'a tap on Open opens the shop');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true, fast: 12 });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ff.mode === 'play', 'boots and starts with localStorage throwing');
    await Q(page, () => { __ff.skipStory(); __ff.ff(2); });
    check(await Q(page, () => __ff.G.day === 3), 'plays two days');
    check(await Q(page, () => __ff.save() === false), 'saving fails quietly');
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
