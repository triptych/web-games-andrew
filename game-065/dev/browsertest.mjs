/**
 * browsertest.mjs — real Chromium, real WebGL, the genuine three.js r165.
 *
 * Desktop (1280×800, mouse): title → help → touch the seed with real clicks →
 * buy a Firefly from the Grove tab → Nourish → an upgrade → a stage-up and its
 * lore banner → catch a golden wisp by clicking it → cast a spell → be reborn
 * through the confirm dialog → buy heartwood → begin a trial → bind a realm →
 * journal, stats and settings → export a save code.
 * Offline: a fresh page whose save is two hours old shows "While you were away"
 * with motes gained (seeded with addInitScript, never through reload: the old
 * page would re-save on unload and undo the rewind; see game-034's learnings).
 * Phones (touch only, CDP input) at 390×844 and 844×390: start, tap the seed,
 * buy, nourish and switch tabs by touch; every control ≥ 44 px and on screen;
 * nothing covers the tap point; no sideways scroll.
 * NOSTORAGE=1 makes every localStorage access throw; the game must still play.
 * Fails on any console error, page error or failed request. Shots → dev/shots/.
 *
 *   python3 -m http.server 8065                  # from the REPO ROOT
 *   node game-065/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served from disk:
 *   cd game-065/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz   # -> ./package
 * Env: BASE (default http://127.0.0.1:8065), THREE_PKG, ONLY=desktop|offline|phones, NOSTORAGE=1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8065';
const URL0 = `${BASE}/game-065/index.html?debug=1`;
const OUT = path.join(HERE, 'shots');
const NOSTORAGE = !!process.env.NOSTORAGE;
const ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}, init = null) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    if (NOSTORAGE) {
        await ctx.addInitScript(() => {
            const boom = () => { throw new DOMException('blocked', 'SecurityError'); };
            Object.defineProperty(window, 'localStorage', { get: boom, configurable: true });
        });
    } else if (init) await ctx.addInitScript(init.fn, init.arg);
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
        else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, `${name}${NOSTORAGE ? '-nostorage' : ''}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 90000, arg = null) => {
    try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { check(false, `timed out: ${msg}`); return false; }
};
const st = (page) => page.evaluate(() => window.__wr.state());
const frames = async (page, n = 2) => { const f0 = (await st(page)).frames; await until(page, (f) => window.__wr.state().frames >= f, `${n} frames`, 60000, f0 + n); };

async function boot(page) {
    await page.goto(URL0);
    await until(page, () => window.__wr && window.__wr.state().frames > 1, 'first frames');
    const link = await page.evaluate(() => {
        const a = document.getElementById('games-link'); const r = a.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { ok: r.width > 0 && r.top >= 0 && r.left >= 0 && (top === a || a.contains(top)), href: a.getAttribute('href') };
    });
    check(link.ok && link.href === '../index.html', 'back link visible, on top, points to ../index.html');
}

async function realClickTree(page, n = 1) {
    for (let i = 0; i < n; i++) {
        const p = await page.evaluate(() => window.__wr.treeScreen(0.45));
        await page.mouse.click(p.x, p.y);
    }
}

// ================================================================== desktop
async function desktop() {
    console.log('\n== desktop 1280×800');
    const { page } = await newPage({ width: 1280, height: 800 });
    await boot(page);
    check(await page.isVisible('#title h1'), 'title screen shows');
    await shot(page, 'd01-title');
    await page.click('#btn-start');
    await until(page, () => window.__wr.state().started, 'started');
    if (!NOSTORAGE) {
        await until(page, () => !document.getElementById('modal').hidden, 'help shows on first run');
        check(await page.isVisible('text=How to grow a World Tree'), 'help text');
        await page.click('#modal-buttons button');
    } else {
        await page.waitForTimeout(800);
        if (await page.isVisible('#modal')) await page.click('#modal-buttons button');
    }
    // touch the seed
    await frames(page, 2);
    const p = await page.evaluate(() => window.__wr.treeScreen(0.45));
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, p);
    check(hit === 'CANVAS', `the seed's tap point is the canvas (${hit})`);
    await realClickTree(page, 12);
    let s = await st(page);
    check(s.clicks === 12 && s.motes >= 12, `12 real clicks on the seed gather motes (${s.clicks} clicks, ${s.motes} motes)`);
    check(await page.evaluate(() => document.querySelectorAll('.floater').length > 0), 'floating numbers appear');
    await shot(page, 'd02-seed');
    // buy a firefly by clicking its row
    await realClickTree(page, 6);
    await page.click('#gen-list .gen[data-gen="0"]');
    s = await st(page);
    check(s.gens[0] === 1, 'a Firefly bought from the Grove tab');
    // nourish
    await page.evaluate(() => window.__wr.give(200));
    await page.click('#nourish-btn');
    s = await st(page);
    check(s.tree === 1, 'Nourish raises the tree a level');
    // upgrades tab
    await page.evaluate(() => window.__wr.give(5000));
    await page.click('.tab[data-tab="ups"]');
    await until(page, () => document.querySelectorAll('#up-list [data-up]').length > 0, 'an upgrade is offered');
    const before = (await st(page)).ups;
    await page.click('#up-list [data-up]');
    check((await st(page)).ups === before + 1, 'an upgrade bought by click');
    // stage-up by nourishing
    await page.evaluate(() => window.__wr.give(1e6));
    for (let i = 0; i < 12 && (await st(page)).tree < 10; i++) await page.click('#nourish-btn');
    s = await st(page);
    check(s.stage === 1, `the tree reaches the Sprout stage (level ${s.tree})`);
    await until(page, () => !document.getElementById('lore-banner').hidden, 'the stage lore banner shows', 10000);
    await page.waitForTimeout(500);
    await shot(page, 'd03-sprout');
    // catch a wisp with a real click
    await page.evaluate(() => { window.__wr.tree(40); window.__wr.gens([40, 30, 20, 10, 5, 2, 1, 0, 0, 0, 0, 0]); window.__wr.snap(); window.__wr.wisp(); });
    await until(page, () => { const w = window.__wr.wispScreen(); return w && w.x > 20 && w.x < 860 && w.y > 120 && w.y < 760 && window.__wr.grove.s.t - window.__wr.grove.s.wisp.active.born > 2; }, 'the wisp flies into view');
    await shot(page, 'd04-wisp');
    const w = await page.evaluate(() => window.__wr.wispScreen());
    await page.mouse.click(w.x, w.y);
    s = await page.evaluate(() => window.__wr.grove.s.stats.wisps);
    check(s === 1, 'the golden wisp is caught by clicking it');
    // spells
    await page.click('.tab[data-tab="magic"]');
    await until(page, () => !document.querySelector('#spell-list [data-spell="surge"]').disabled, 'Verdant Surge is castable');
    await page.click('#spell-list [data-spell="surge"]');
    check(await page.evaluate(() => window.__wr.grove.s.buffs.some((b) => b.id === 'surge')), 'Verdant Surge cast by click');
    check(await page.evaluate(() => document.querySelectorAll('#buffs .buff').length >= 1), 'the buff shows in the HUD');
    // rebirth
    await page.evaluate(() => { window.__wr.give(1e15); window.__wr.tree(55); window.__wr.snap(); });
    await page.click('.tab[data-tab="rebirth"]');
    await until(page, () => !document.getElementById('btn-rebirth')?.disabled, 'rebirth available');
    await shot(page, 'd05-rebirth-tab');
    await page.click('#btn-rebirth');
    await until(page, () => !document.getElementById('modal').hidden, 'rebirth confirm');
    await page.click('#modal-buttons .big-btn.purple');
    s = await st(page);
    check(s.rebirths === 1 && s.hw > 0 && s.tree === 0, `reborn: ${s.hw} heartwood, tree back to ${s.tree}`);
    await page.click('#hw-list [data-hw="dowry"]');
    check(await page.evaluate(() => window.__wr.grove.hwLevel('dowry') === 1), 'heartwood spent on Firefly Dowry');
    // trial
    await page.evaluate(() => { window.__wr.grove.s.hwEarned = 100; window.__wr.grove.mark(); });
    await page.waitForTimeout(400);
    await page.click('#trial-list [data-trial="silent"]');
    await until(page, () => !document.getElementById('modal').hidden, 'trial confirm');
    await page.click('#modal-buttons .big-btn.purple');
    s = await st(page);
    check(s.trial === 'silent', 'the Silent Grove trial begins');
    await realClickTree(page, 3);
    check((await st(page)).motes === 0 || (await page.evaluate(() => window.__wr.grove.clickValue())) === 0, 'clicks give nothing in the Silent Grove');
    await page.evaluate(() => { window.__wr.tree(60); window.__wr.snap(); });
    await page.click('#btn-abandon');
    await page.click('#modal-buttons .big-btn:last-child');
    check((await st(page)).trial === null, 'left the trial');
    // realm
    await page.evaluate(() => { window.__wr.give(1e40); window.__wr.tree(100); window.__wr.gens([300, 160, 160, 160, 100, 100, 90, 80, 60, 40, 30, 20]); window.__wr.snap(); });
    await frames(page, 3);
    await shot(page, 'd06-world-tree');
    await page.click('#realm-list [data-realm="midgard"]');
    await page.click('#modal-buttons .big-btn.purple');
    s = await st(page);
    check(s.realms.includes('midgard'), 'Midgard bound to the World Tree');
    // journal, stats, settings
    await page.click('.tab[data-tab="journal"]');
    check(await page.evaluate(() => document.querySelectorAll('.ach.got').length > 5), 'achievements earned show in the journal');
    await page.click('#journal-seg [data-j="stats"]');
    check(await page.isVisible('table.stats'), 'stats table');
    await page.click('#journal-seg [data-j="lore"]');
    check(await page.evaluate(() => document.querySelectorAll('.lore-entry').length >= 1), 'lore entries');
    await page.click('.tab[data-tab="settings"]');
    await page.evaluate(() => window.__wr.give(5e9));
    await page.click('#set-sci');
    await frames(page, 2);
    check(/e\d/.test(await page.textContent('#motes')), 'scientific numbers setting');
    await page.click('#btn-export');
    check((await page.inputValue('#save-text')).length > 100, 'export produces a save code');
    const brightness = await page.evaluate(() => window.__wr.brightness());
    check(brightness > 0, `the scene is not black (${brightness})`);
    await shot(page, 'd07-settings');
}

// ================================================================== offline
async function offline() {
    if (NOSTORAGE) return;
    console.log('\n== offline catch-up');
    // build a save in one browser…
    let { page } = await newPage({ width: 1280, height: 800 });
    await boot(page);
    await page.click('#btn-start');
    await page.evaluate(() => { window.__wr.closeModal(); window.__wr.give(1e6); window.__wr.gens([20, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0]); window.__wr.save(); });
    const raw = await page.evaluate(() => localStorage.getItem('worldroot-save'));
    const data = JSON.parse(raw);
    data.savedAt = Date.now() - 2 * 3600 * 1000;
    const rewound = JSON.stringify(data);
    // …then open a fresh page that starts with the rewound save
    ({ page } = await newPage({ width: 1280, height: 800 }, {}, {
        fn: ({ v }) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('worldroot-save', v); localStorage.setItem('worldroot-settings', JSON.stringify({ seenHelp: true })); sessionStorage.setItem('seeded', '1'); } },
        arg: { v: rewound },
    }));
    await boot(page);
    check((await page.textContent('#btn-start')).includes('Return'), 'the title welcomes you back');
    await page.click('#btn-start');
    await until(page, () => !document.getElementById('modal').hidden, 'away summary shows');
    const txt = await page.textContent('#modal-body');
    check(/While you were away/.test(txt) && /2h/.test(txt), `away summary: ${txt.replace(/\s+/g, ' ').slice(0, 90)}`);
    const motes = (await st(page)).motes;
    check(motes > 1e6, `motes were gathered offline (${Math.round(motes)})`);
    await shot(page, 'o01-away');
}

// ================================================================== phones
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const { ctx, page } = await newPage({ width: w, height: h }, { hasTouch: true, isMobile: true });
    const cdp = await ctx.newCDPSession(page);
    const tap = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(60);
    };
    const tapEl = async (sel) => {
        const r = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; }, sel);
        if (!r) { check(false, `${sel} exists`); return; }
        const top = await page.evaluate(({ x, y, s }) => { const e = document.elementFromPoint(x, y); const t = document.querySelector(s); return !!e && (e === t || t.contains(e)); }, { ...r, s: sel });
        check(top, `${sel} is not covered where we tap`);
        await tap(r.x, r.y);
    };
    await boot(page);
    await tapEl('#btn-start');
    await until(page, () => window.__wr.state().started, 'started by touch');
    if (!NOSTORAGE) { await until(page, () => !document.getElementById('modal').hidden, 'help shows'); await tapEl('#modal-buttons button'); }
    else { await page.waitForTimeout(800); if (await page.isVisible('#modal')) await tapEl('#modal-buttons button'); }
    await frames(page, 2);
    const p = await page.evaluate(() => window.__wr.treeScreen(0.45));
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, p);
    check(hit === 'CANVAS', `the seed's tap point is the canvas (${hit})`);
    for (let i = 0; i < 20; i++) await tap(p.x, p.y);
    let s = await st(page);
    check(s.clicks >= 18, `tapping the seed gathers motes (${s.clicks} taps registered)`);
    if (await page.evaluate(() => document.getElementById('panel').classList.contains('closed'))) await tapEl('#panel-toggle');
    await tapEl('.tab[data-tab="grove"]');
    await tapEl('#gen-list .gen[data-gen="0"]');
    check((await st(page)).gens[0] >= 1, 'a Firefly bought by touch');
    await page.evaluate(() => window.__wr.give(500));
    await tapEl('#nourish-btn');
    check((await st(page)).tree >= 1, 'Nourish by touch');
    await page.evaluate(() => { window.__wr.give(1e9); window.__wr.tree(35); window.__wr.gens([60, 50, 40, 30, 12, 6, 4, 0, 0, 0, 0, 0]); window.__wr.snap(); });
    await frames(page, 3);
    for (const t of ['ups', 'tree', 'magic', 'rebirth', 'journal', 'settings', 'grove']) {
        await tapEl(`.tab[data-tab="${t}"]`);
        const ok = await page.evaluate((t) => document.getElementById(`pane-${t}`).classList.contains('active'), t);
        check(ok, `tab ${t} opens by touch`);
    }
    // layout checks
    const lay = await page.evaluate(() => {
        const small = [];
        for (const sel of ['.tab', '#nourish-btn', '#gen-list .gen', '#buy-amt button']) {
            document.querySelectorAll(sel).forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.height < 32 || r.width < 32)) small.push(`${sel} ${Math.round(r.width)}×${Math.round(r.height)}`); });
        }
        const off = [];
        for (const sel of ['#panel', '#nourish-btn', '#hud-top', '#games-link']) {
            const r = document.querySelector(sel).getBoundingClientRect();
            if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) off.push(sel);
        }
        const nb = document.getElementById('nourish-btn').getBoundingClientRect();
        return { small, off, scrollX: document.documentElement.scrollWidth > innerWidth, nb: Math.min(nb.width, nb.height) };
    });
    check(lay.small.length === 0, `controls are finger-sized ${lay.small.join(', ')}`);
    check(lay.nb >= 64, `Nourish button is big (${lay.nb}px)`);
    check(lay.off.length === 0, `everything on screen ${lay.off.join(', ')}`);
    check(!lay.scrollX, 'no sideways scroll');
    // the wisp by touch
    await page.evaluate(() => window.__wr.wisp());
    // wait until the wisp is somewhere a finger can reach: on screen, not under the panel, HUD or Nourish button
    await until(page, () => {
        const w = window.__wr.wispScreen();
        if (!w || window.__wr.grove.s.t - window.__wr.grove.s.wisp.active.born < 2) return false;
        if (w.x < 20 || w.x > innerWidth - 20 || w.y < 20 || w.y > innerHeight - 20) return false;
        const inside = (sel, pad) => { const r = document.querySelector(sel).getBoundingClientRect(); return w.x > r.left - pad && w.x < r.right + pad && w.y > r.top - pad && w.y < r.bottom + pad; };
        return !inside('#panel', 12) && !inside('#hud-top', 12) && !inside('#nourish-btn', 12) && !inside('#games-link', 12);
    }, 'the wisp is in the open', 120000);
    const w2 = await page.evaluate(() => window.__wr.wispScreen());
    if (w2) await tap(w2.x, w2.y);
    check(await page.evaluate(() => window.__wr.grove.s.stats.wisps >= 1), 'wisp caught by touch');
    await shot(page, `p-${w}x${h}`);
}

// ================================================================== run
try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'offline') await offline();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    errors.push(`exception: ${e.stack || e}`);
} finally {
    if (browser) await browser.close();
}
const real = errors.filter((e) => !/favicon/.test(e));
console.log(real.length ? `\nFAILED (${real.length})\n${real.join('\n')}` : '\nPASSED');
process.exit(real.length ? 1 : 0);
