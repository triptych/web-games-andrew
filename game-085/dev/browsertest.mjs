/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Caravan by a real
 *   click → name the wagon by typing (the dice, Enter) → fold Grandmother's letter → rename her on the Caravan tab → number keys switch tabs → buy a wagon upgrade, buy goods and hire
 *   by real clicks → set a course by clicking a town on the map → Space rallies on the road → a fight plays
 *   its animation → Esc opens the menu and the road keeps going under it → Save & Quit → Continue → a fresh
 *   page whose save is two hours old shows the "while you were away" chronicle with two hours on the road,
 *   and Space closes it from the keyboard → a new day's morning post is opened from the Quests tab → the
 *   Scrapbook by key and click: people, every creature's portrait drawn, the travel log, re-reading a letter.
 *   No sideways scroll; the canvas fills the window; every id in the page is unique.
 * phones (touch only, real taps) at 390×844 and 844×390: taps through the title, the letter and every tab;
 *   tabs and the Rally button are at least 44 px and on screen; Rally by tap; nothing sits under the back
 *   link; no sideways scroll; the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and travels.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8085          # from the REPO ROOT
 *   node game-085/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8085), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8085';
const URL = `${BASE}/game-085/index.html?debug=1&fast=4`;
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function launch() {
    if (browser) await browser.close();
    browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
}
async function newPage(ctx) {
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(URL);
    await page.waitForFunction(() => window.__wq && __wq.mode === 'title', null, { timeout: 60000 });
    return page;
}
async function open(viewport, { touch = false, nostorage = false } = {}) {
    await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!sessionStorage.getItem('kept')) { try { localStorage.clear(); } catch { /* */ } }
    }, nostorage);
    errors = [];
    return { ctx, page: await newPage(ctx) };
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
/** The centre of an element, scrolled into view, in client px. */
const centre = (page, sel) => Q(page, (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);
// A real mouse click at an element's centre (Playwright's click() waits for animations to settle, which a
// canvas redrawn every frame never does).
const clickSel = async (page, sel) => { const c = await centre(page, sel); if (!c) return false; await page.mouse.click(c.x, c.y); return true; };
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

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const { ctx, page } = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.length === new Set(ids).size; }), 'every id in the page is unique');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await clickSel(page, '#btn-new');
    await until(page, () => !document.getElementById('naming').hidden && document.activeElement?.id === 'wagon-name' && document.getElementById('wagon-name').value.length > 0, 'New Caravan asks for the wagon\'s name, with a suggestion selected');
    await clickSel(page, '#naming-dice');
    await until(page, () => document.getElementById('wagon-name').value.length > 0, 'the dice suggests another');
    await Q(page, () => { const i = document.getElementById('wagon-name'); i.focus(); i.select(); });
    await page.keyboard.type('The Bramble Rose');
    await page.keyboard.press('Enter');
    await until(page, () => __wq.mode === 'play' && document.getElementById('title').hidden && __wq.G.wagon === 'The Bramble Rose', 'typing a name and pressing Enter sets out with it');
    await until(page, () => !document.getElementById('letter').hidden, 'Grandmother\'s letter opens');
    await clickSel(page, '#letter-ok');
    await until(page, () => document.getElementById('letter').hidden && __wq.G.letters.length === 0, 'folding it puts it away');

    await page.keyboard.press('Digit2');
    await until(page, () => document.querySelector('#tabs .tab.on')?.dataset.tab === 'caravan' && document.getElementById('panel').textContent.includes('Iron-shod Wheels'), 'the 2 key opens the Caravan tab');
    check(await Q(page, () => document.getElementById('panel').textContent.includes('The Bramble Rose · level')), 'the Caravan tab carries her name');
    await clickSel(page, '[data-act="rename"]');
    await until(page, () => !document.getElementById('naming').hidden && document.getElementById('wagon-name').value === 'The Bramble Rose', 'Rename opens the sheet with her name in it');
    await Q(page, () => { const i = document.getElementById('wagon-name'); i.focus(); i.select(); });
    await page.keyboard.type('Old Faithful');
    await clickSel(page, '#naming-go');
    await until(page, () => __wq.G.wagon === 'Old Faithful' && document.getElementById('panel').textContent.includes('Old Faithful · level'), 'and renames her');
    await clickSel(page, '[data-act="rename"]');
    await until(page, () => !document.getElementById('naming').hidden, 'the sheet opens again');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('naming').hidden && __wq.G.wagon === 'Old Faithful', 'Escape in the name field closes it without renaming');
    await Q(page, () => { __wq.G.gold = 5000; });
    await until(page, () => { const b = document.querySelector('[data-act="upgrade"][data-k="hold"]'); return b && !b.disabled; }, 'the Deeper Hold button is live once there\'s gold');
    await clickSel(page, '[data-act="upgrade"][data-k="hold"]');
    await until(page, () => __wq.G.up.hold === 1, 'a click on it upgrades the hold');

    // the town: hold in Hearthford while we shop
    await clickSel(page, '#tabs [data-tab="road"]');
    await until(page, () => !!document.querySelector('[data-act="route"][data-v="hold"]'), 'the Road tab shows the standing orders');
    await clickSel(page, '[data-act="route"][data-v="hold"]');
    await until(page, () => __wq.G.orders.route === 'hold', 'a click sets the standing orders to Hold');
    await page.keyboard.press('Digit6');
    await until(page, () => !!document.querySelector('[data-act="buy"][data-g="grain"]'), 'the Town tab shows the market');
    // buttons that spend are green when they can be pressed, and grey when they can't
    const green = (sel) => Q(page, (q) => { const b = document.querySelector(q); if (!b) return null; const [r, g, bl] = getComputedStyle(b).backgroundColor.match(/\d+/g).map(Number); return { on: !b.disabled, green: g > r + 40 && g > bl + 40 }; }, sel);
    let g1 = await green('[data-act="buy"][data-g="grain"]'), g2 = await green('[data-act="sell"][data-g="grain"]');
    check(g1?.on && g1.green, 'the +5 button is green when you can buy');
    check(g2 && !g2.on && !g2.green, 'the −5 button is grey with nothing to sell');
    await Q(page, () => { __wq.G.gold0 = __wq.G.gold; __wq.G.gold = 0; });
    await until(page, () => document.querySelector('[data-act="buy"][data-g="grain"]').disabled, 'with an empty purse it goes grey');
    await Q(page, () => { __wq.G.gold = __wq.G.gold0; });
    await until(page, () => !document.querySelector('[data-act="buy"][data-g="grain"]').disabled, 'and green again with gold');
    await clickSel(page, '[data-act="buy"][data-g="grain"]');
    await until(page, () => (__wq.G.cargo.grain?.n || 0) === 5, 'a click on +5 buys five grain');
    g2 = await green('[data-act="sell"][data-g="grain"]');
    check(g2?.on && g2.green, 'and then −5 turns green');
    await Q(page, () => { __wq.G.level = 3; });
    await until(page, () => { const b = document.querySelector('[data-act="hire"]'); return b && !b.disabled; }, 'a level-3 caravan can hire in the tavern');
    const n0 = await Q(page, () => __wq.G.party.length);
    await clickSel(page, '[data-act="hire"]');
    await until(page, (n) => __wq.G.party.length === n + 1, 'a click hires a traveller with their cart', 30000, n0);
    await shot(page, 'desktop-town');

    // set a course by clicking Millbrook on the map
    await page.keyboard.press('Digit5');
    await until(page, () => !!document.getElementById('map') && document.getElementById('map').width > 100, 'the 5 key opens the map');
    const town = await Q(page, () => { const r = document.getElementById('map').getBoundingClientRect(); return { x: r.left + (240 / 1000) * r.width, y: r.top + (645 / 700) * r.height }; });
    await page.mouse.click(town.x, town.y);
    await until(page, () => !!document.querySelector('[data-act="course"][data-town="millbrook"]'), 'a click on Millbrook on the map shows it');
    await clickSel(page, '[data-act="course"][data-town="millbrook"]');
    await until(page, () => __wq.G.course === 'millbrook' || __wq.G.road?.to === 'millbrook', 'Set course heads for Millbrook even on Hold');
    await until(page, () => !!__wq.G.road, 'the caravan sets out', 30000);
    // the distant mountains pan gently with the road's bends, by distance travelled (v1.0.1: they spun)
    const pan0 = await Q(page, () => ({ s: __wq.view.bgShift || 0, o: __wq.G.odo }));
    await page.waitForTimeout(3000);
    const pan = await Q(page, (p) => ({ ds: Math.abs((__wq.view.bgShift || 0) - p.s), dm: __wq.G.odo - p.o }), pan0);
    check(pan.dm > 0.05 && pan.ds / pan.dm < 0.25, `the mountains drift ${(pan.ds / Math.max(pan.dm, 1e-6)).toFixed(3)} screen widths per mile (under 0.25)`);
    // the town ahead stands still in the world as the caravan rolls up to it, like the trees (v1.2.1: its houses
    // crept forward with the camera between ticks and snapped back on each one)
    const townDrift = await Q(page, () => new Promise((done) => {
        const r = __wq.G.road, back = r.done;
        r.done = Math.max(r.done, r.miles - 3);
        const zs = [], o0 = __wq.G.odo;
        const tick = () => {
            const t = __wq.view.town;
            if (t && t.id === __wq.G.road?.to) zs.push(t.z);
            if (zs.length < 90) requestAnimationFrame(tick);
            else { const miles = __wq.G.odo - o0; if (__wq.G.road === r) r.done = back + miles; done({ spread: Math.max(...zs) - Math.min(...zs), miles }); }
        };
        requestAnimationFrame(tick);
    }));
    check(townDrift.miles > 0.05 && townDrift.spread < 1, `Millbrook's houses hold their place as the caravan rolls in (moved ${townDrift.spread.toFixed(1)} units over ${townDrift.miles.toFixed(2)} miles)`);

    // Rally does nothing mid-fight, in camp or while a wheel is mended (the button greys out): like a player,
    // wait until it's ready, and press again if a fight got there first
    await Q(page, () => document.activeElement?.blur());
    for (let i = 0; i < 6 && !(await Q(page, () => (__wq.seen.rally || 0) >= 1)); i++) {
        await page.waitForFunction(() => __wq.G.road && !__wq.G.camp && !__wq.G.busy && __wq.G.buffs.rallyCd <= __wq.G.t, null, { timeout: 60000, polling: 100 });
        await page.keyboard.press('Space');
        await page.waitForFunction(() => (__wq.seen.rally || 0) >= 1 || __wq.G.busy > 0 || __wq.G.camp, null, { timeout: 15000, polling: 100 }).catch(() => {});
    }
    check(await Q(page, () => (__wq.seen.rally || 0) >= 1), 'Space rallies the oxen on the road');

    // a fight on the road plays out in the view
    // a sparkle on the road: click it where it's drawn
    await Q(page, () => { const G = __wq.G; G.fightIn = 1e9; G.sparkle = { id: G.t, at: G.odo + 1.6, x: 0.25 }; });
    await until(page, () => !!__wq.view.sparkleHit && !document.getElementById('btn-sparkle').hidden, 'a sparkle shows on the road, and the ✨ button with it');
    const sh = await Q(page, () => __wq.view.sparkleHit);
    await page.mouse.click(sh.X, sh.Y);
    await until(page, () => (__wq.G.stats.sparkles || 0) === 1 && !__wq.G.sparkle, 'clicking the sparkle on the road grabs it');
    await until(page, () => document.getElementById('btn-sparkle').hidden, 'and the ✨ button goes');
    if (await Q(page, () => !document.getElementById('letter').hidden)) {
        check(await Q(page, () => document.getElementById('letter-ok').textContent === 'Keep it' && __wq.G.book.lore.length === 1), 'it was lore, shown on a sheet and kept');
        await clickSel(page, '#letter-ok');
    }
    await Q(page, () => { const G = __wq.G; G.sparkle = { id: G.t + 1, at: G.odo + 1.6, x: -0.2 }; document.activeElement?.blur(); });
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    await until(page, () => (__wq.G.stats.sparkles || 0) === 2, 'E grabs one too');
    if (await Q(page, () => !document.getElementById('letter').hidden)) await clickSel(page, '#letter-ok');
    await Q(page, () => { __wq.G.fightIn = 30; });
    // birds cross the sky now and then
    await Q(page, () => { __wq.view.birds.wait = 0; });
    await until(page, () => __wq.view.birds.flocks.length > 0 || __wq.view.birds.wait > 7, 'a flock of birds (or none, at night in some places) sets off', 30000);
    // listen to the fight's sounds and watch the lead traveller's feet, frame by frame, until they're back
    const watch = Q(page, () => new Promise((done) => {
        const A = __wq.audio, hit = A.fightHit.bind(A), sounds = [];
        A.fightHit = (h) => { if (seen) sounds.push(__wq.view.fight ? __wq.view.fight.age : -1); hit(h); };
        const rows = [];
        let seen = false;
        const f = () => {
            const F = __wq.view.fight;
            // only a fight seen from its first moments (one already under way when we started doesn't count)
            if (F && (seen || F.age < 0.3)) { seen = { dur: F.dur, hits: F.e.hits.length }; __wq.G.fightIn = 1e9; }
            // everyone's offset from their cart; whoever is still standing at the end is the one we follow
            if (seen) rows.push({ fight: !!F, w: __wq.G.party.map((m) => { const w = __wq.view.walkers.get(m.id); return w && { d: Math.hypot(w.ox, w.oz), ph: w.ph, go: w.go, down: m.down }; }) });
            const home = seen && !F && rows.length > 10 && rows[rows.length - 1].w.every((w) => !w || w.down || w.d < 1);
            if (home || rows.length > 3000) {
                A.fightHit = hit;
                const k = Math.max(0, __wq.G.party.findIndex((m) => !m.down));
                done({ seen, sounds, rows: rows.map((r) => ({ fight: r.fight, ...(r.w[k] || { d: 0, ph: 0, go: false }) })) });
            } else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
    }));
    await Q(page, () => { __wq.G.fightIn = 0.001; });
    await until(page, () => !!__wq.view.fight, 'a fight starts its animation', 30000);
    await page.waitForTimeout(1200);
    await shot(page, 'desktop-fight');
    await until(page, () => !__wq.view.fight, 'and finishes', 60000);
    const fw = await watch;
    const lastSound = Math.max(...fw.sounds);
    const lastHitDue = 0.7 + (fw.seen.hits - 1) * (Math.max(1, fw.seen.dur - 1.6) / fw.seen.hits);
    check(fw.seen && fw.sounds.length >= Math.min(fw.seen.hits, 6) - 1 && lastSound >= lastHitDue - 0.05,
        `the fight sounds right to its end (${fw.sounds.length} hit sounds for ${fw.seen.hits} hits, the last at ${lastSound.toFixed(1)} s, when the last hit lands at ${lastHitDue.toFixed(1)} s)`);
    // the walk home starts the moment they leave their spot on the verge (just before the fight's last beat)
    const far = Math.max(...fw.rows.map((r) => r.d));
    let from = 0;
    fw.rows.forEach((r, i) => { if (r.d >= far - 1) from = i; });
    const back = fw.rows.slice(from);
    let maxStep = 0;
    for (let i = 1; i < fw.rows.length; i++) maxStep = Math.max(maxStep, Math.abs(fw.rows[i].d - fw.rows[i - 1].d));
    const strides = back.length ? back[back.length - 1].ph - back[0].ph : 0;
    check(back.length > 5 && back.some((r) => r.go) && strides > 3 && back[back.length - 1].d < 1 && maxStep < 400,
        `after the fight the travellers walk back to their carts, legs going (${strides.toFixed(1)} radians of stride, at most ${maxStep.toFixed(0)} units a frame)`);

    // making camp with nobody hurt is still a rest by the fire, and someone has something to say
    await Q(page, async () => {
        const { maxHp } = await import('./js/sim/party.js');
        const G = __wq.G;
        for (const m of G.party) { m.hp = maxHp(m); m.down = false; }
        G.fightIn = 1e9; G.eventIn = 1e9; G.sparkle = null;
    });
    await page.keyboard.press('Digit1');
    await until(page, () => __wq.G.road && !__wq.G.busy && !__wq.G.camp && !!document.querySelector('[data-act="rest"]'), 'the Road tab offers Make camp now', 30000);
    const campT = await Q(page, () => __wq.G.t);
    await clickSel(page, '[data-act="rest"]');
    await until(page, () => __wq.G.camp && !!__wq.view.bubble, 'a click makes camp, and someone by the fire speaks');
    check(await Q(page, () => { const b = __wq.view.bubble; return !!b && b.text.length > 5 && b.who !== 'You' && __wq.view.standAt.has(b.id); }), 'a traveller says their line in a bubble over where they stand');
    check(await Q(page, () => document.getElementById('status-sub').textContent.includes('short rest')), 'the HUD calls it a short rest');
    await page.waitForTimeout(400);
    await shot(page, 'desktop-camp');
    await until(page, () => !__wq.G.camp, 'and the caravan sets off again', 30000);
    const campLen = await Q(page, (t) => __wq.G.t - t, campT);
    check(campLen >= 7, `the rest lasted ${campLen} s of game time, not a blink`);

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('menu').hidden, 'Esc opens the menu');
    const t0 = await Q(page, () => __wq.G.t);
    await until(page, (t) => __wq.G.t > t + 2, 'the road keeps going under the menu', 30000, t0);
    await clickSel(page, '#menu-menu [data-act="quit"]');
    await until(page, () => __wq.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    check(await Q(page, () => document.getElementById('btn-continue').textContent === 'Continue: Old Faithful'), 'Continue names the wagon');
    const saved = await Q(page, () => JSON.parse(localStorage.getItem('wanderquest.v1')));
    await clickSel(page, '#btn-continue');
    await until(page, (t) => __wq.mode === 'play' && __wq.G.t >= t, 'Continue picks the caravan up again', 30000, saved.data.t);
    reportErrors('desktop');

    // time away: a fresh page whose save was written two hours ago
    console.log('\n== desktop: two hours away');
    await page.close();
    errors = [];
    const rewound = JSON.stringify({ ...saved, savedAt: Date.now() - 2 * 3600 * 1000 });
    await ctx.addInitScript((v) => { sessionStorage.setItem('kept', '1'); localStorage.setItem('wanderquest.v1', v); }, rewound);
    const p2 = await newPage(ctx);
    await clickSel(p2, '#btn-continue');
    await until(p2, () => !document.getElementById('away').hidden, 'the "while you were away" chronicle opens');
    check(await Q(p2, (t) => __wq.G.t - t >= 7190 && __wq.G.t - t <= 7300, saved.data.t), 'the caravan travelled for the two hours');
    check(await Q(p2, () => /2h/.test(document.getElementById('away-title').textContent) && document.querySelectorAll('#away-body .stat-grid div').length >= 6), 'the chronicle says how long and what happened');
    // the numbers are tallied up from 0, then the highlights fade in
    const tally = await Q(p2, async () => {
        let between = false;
        for (let i = 0; i < 100 && !__wq.ui.tally?.done; i++) {
            for (const b of document.querySelectorAll('#away-stats b')) {
                const v = +b.textContent.replace(/[^0-9]/g, ''), to = Math.abs(+b.dataset.to);
                if (to > 3 && v > 0 && v < to) between = true;
            }
            await new Promise((r) => setTimeout(r, 60));
        }
        const bs = [...document.querySelectorAll('#away-stats b')];
        return { between, done: !!__wq.ui.tally?.done, exact: bs.every((b) => +b.textContent.replace(/[^0-9]/g, '') === Math.abs(+b.dataset.to)), landed: bs.every((b) => b.classList.contains('landed')), shown: document.getElementById('away-body').classList.contains('tallied') };
    });
    check(tally.between, 'the chronicle\'s numbers count up (a number was seen between 0 and its total)');
    check(tally.done && tally.exact && tally.landed && tally.shown, 'and land on the exact totals before the highlights fade in');
    await shot(p2, 'desktop-away');
    await until(p2, () => document.activeElement?.id === 'away-ok', 'its button has the focus');
    await p2.keyboard.press('Space');
    await until(p2, () => document.getElementById('away').hidden, 'Space presses it and the chronicle closes');

    await Q(p2, () => __wq.day(1));
    await until(p2, () => !document.getElementById('badge-quests').hidden, 'a new day puts a badge on Quests');
    await p2.keyboard.press('Digit4');
    await until(p2, () => !!document.querySelector('[data-act="claimPost"]'), 'the Quests tab offers the morning post');
    await clickSel(p2, '[data-act="claimPost"]');
    await until(p2, () => __wq.G.daily.claimed && !__wq.G.daily.contracts.some((q) => !q), 'a click opens it');
    // the scrapbook
    await until(p2, () => !document.getElementById('badge-book').hidden, 'new scrapbook entries put a badge on Book');
    await p2.keyboard.press('Digit7');
    await until(p2, () => document.querySelector('#tabs .tab.on')?.dataset.tab === 'book' && document.getElementById('panel').classList.contains('book'), 'the 7 key opens the Scrapbook');
    await until(p2, () => document.getElementById('badge-book').hidden, 'and the badge goes');
    check(await Q(p2, () => [...document.querySelectorAll('#panel .snap figcaption b')].map((e) => e.textContent).includes('Old Tam')), 'People has Old Tam in it');
    for (const pg of ['monsters', 'items', 'places', 'log', 'letters']) {
        await clickSel(p2, `[data-act="bookPage"][data-v="${pg}"]`);
        await until(p2, (v) => document.querySelector('[data-act="bookPage"].on')?.dataset.v === v, `a click opens ${pg}`, 30000, pg);
        if (pg === 'monsters') {
            check(await Q(p2, () => {
                const cs = [...document.querySelectorAll('#panel canvas[data-portrait]')];
                // a drawn portrait has more than its backdrop: count the distinct colours on a coarse grid
                const bad = cs.filter((c) => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < x.length; i += 4 * 7) set.add(x[i] + ',' + x[i + 1] + ',' + x[i + 2]); return set.size < 12; });
                return cs.length >= 33 && bad.length === 0;
            }), 'every creature has a portrait, met or not');
            check(await Q(p2, () => document.getElementById('panel').textContent.includes('???') && Object.keys(__wq.G.book.monsters).length > 0), 'monsters met are named and the rest are ???');
            await shot(p2, 'desktop-book');
        }
        if (pg === 'log') check(await Q(p2, () => document.querySelectorAll('#panel .log-ledger li:not(.day)').length === Math.min(60, __wq.G.book.legs.length) && __wq.G.book.legs.length > 0), 'the travel log lists the roads driven');
    }
    await clickSel(p2, '[data-act="reread"]');
    await until(p2, () => !document.getElementById('letter').hidden, 'a filed letter opens again');
    await clickSel(p2, '#letter-ok');
    await until(p2, () => document.getElementById('letter').hidden && __wq.G.letters.length === 0 && __wq.G.book.letters.length >= 1, 're-reading it doesn\'t count as new post');
    const L2 = await layout(p2);
    check(L2.noHScroll && L2.canvas, 'still no sideways scroll, and the canvas fills the window');
    reportErrors('desktop, after time away');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const { page } = await open({ width: w, height: h }, { touch: true });
    const tap = async (sel) => { const c = await centre(page, sel); if (!c) return false; await page.touchscreen.tap(c.x, c.y); return true; };
    check(await backLinkOk(page), '← Games link is on top');
    check(await Q(page, () => { const l = document.querySelector('.logo'); return l.textContent === 'WanderQuest' && l.scrollWidth <= l.clientWidth; }), 'the title WanderQuest fits its sheet');
    await tap('#btn-new');
    await until(page, () => !document.getElementById('naming').hidden, 'a tap on New Caravan asks for a name');
    check(await Q(page, () => { const r = document.getElementById('wagon-name').getBoundingClientRect(), g = document.getElementById('naming-go').getBoundingClientRect(); return r.height >= 44 && g.height >= 44 && g.right <= innerWidth && r.left >= 0; }), 'the name field and Set out are finger-sized and on screen');
    await tap('#naming-go');
    await until(page, () => __wq.mode === 'play' && __wq.G.wagon.length > 0, 'a tap on Set out starts the journey with the suggested name');
    await until(page, () => !document.getElementById('letter').hidden, 'the letter opens');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('letter').hidden), 'and stays open after the finger lifts');
    check(await Q(page, () => { const r = document.querySelector('#letter .sheet').getBoundingClientRect(), b = document.getElementById('back-link').getBoundingClientRect(); return r.top >= b.bottom - 1 || r.left >= b.right; }), 'the letter clears the back link');
    await tap('#letter-ok');
    await until(page, () => document.getElementById('letter').hidden, 'a tap folds it');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => [...document.querySelectorAll('#tabs .tab'), document.getElementById('btn-rally'), document.getElementById('btn-menu')].map((el) => {
        const r = el.getBoundingClientRect();
        return { s: el.dataset.tab || el.id, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    await Q(page, () => { __wq.G.gold = 1234567; __wq.G.rations = 315; __wq.G.level = 27; });
    await page.waitForTimeout(600);
    check(await Q(page, () => { const b = document.getElementById('back-link').getBoundingClientRect(); return [...document.querySelectorAll('#hud .chip, #hud .ibtn')].every((c) => c.getBoundingClientRect().left >= b.right); }), 'the HUD stays clear of the back link with a big purse');
    const scene = await Q(page, () => __wq.ui.sceneRect());
    check(scene.w > 150 && scene.h > 150, `the scene keeps ${scene.w}×${scene.h} px beside the dock`);

    for (const t of ['caravan', 'pack', 'quests', 'map', 'town', 'book', 'road']) {
        await tap(`#tabs [data-tab="${t}"]`);
        await until(page, (tt) => document.querySelector('#tabs .tab.on')?.dataset.tab === tt && document.getElementById('panel').children.length > 0, `a tap opens ${t}`, 30000, t);
    }
    const small = await Q(page, () => [...document.querySelectorAll('#panel button')].filter((b) => b.offsetParent && (b.getBoundingClientRect().height < 43.5 || b.getBoundingClientRect().width < 43.5)).map((b) => b.textContent.trim()).slice(0, 5));
    check(small.length === 0, `every button on the Road tab is finger-sized${small.length ? ': ' + small.join(', ') : ''}`);
    await Q(page, () => __wq.cmd({ type: 'course', town: 'applewick' }));
    await until(page, () => !!__wq.G.road && !__wq.G.camp && !__wq.G.busy, 'the caravan takes the road', 40000);
    for (let i = 0; i < 6 && !(await Q(page, () => (__wq.seen.rally || 0) >= 1)); i++) {
        await page.waitForFunction(() => __wq.G.road && !__wq.G.camp && !__wq.G.busy && __wq.G.buffs.rallyCd <= __wq.G.t, null, { timeout: 60000, polling: 100 });
        await tap('#btn-rally');
        await page.waitForFunction(() => (__wq.seen.rally || 0) >= 1 || __wq.G.busy > 0 || __wq.G.camp, null, { timeout: 15000, polling: 100 }).catch(() => {});
    }
    check(await Q(page, () => (__wq.seen.rally || 0) >= 1), 'tapping Rally hurries the oxen');
    await shot(page, `phone-${w}x${h}`);
    await Q(page, () => { const G = __wq.G; G.sparkle = { id: G.t, at: G.odo + 1.6, x: 0 }; });
    await until(page, () => !document.getElementById('btn-sparkle').hidden, 'the ✨ button appears with a sparkle');
    check(await Q(page, () => { const r = document.getElementById('btn-sparkle').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.right <= innerWidth; }), 'and is finger-sized');
    await tap('#btn-sparkle');
    await until(page, () => (__wq.G.stats.sparkles || 0) >= 1 && !__wq.G.sparkle, 'tapping ✨ grabs the sparkle');
    if (await Q(page, () => !document.getElementById('letter').hidden)) await tap('#letter-ok');
    await tap('#btn-menu');
    await until(page, () => !document.getElementById('menu').hidden, 'tapping ☰ opens the menu');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('menu').hidden), 'the menu stays open after the finger lifts');
    await tap('#menu-menu [data-act="resume"]');
    await until(page, () => document.getElementById('menu').hidden, 'a tap on Back to the road closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const { page } = await open({ width: 1280, height: 760 }, { nostorage: true });
    await clickSel(page, '#btn-new');
    await until(page, () => !document.getElementById('naming').hidden, 'the naming sheet opens with localStorage throwing');
    await clickSel(page, '#naming-go');
    await until(page, () => __wq.mode === 'play', 'boots and starts a caravan with localStorage throwing');
    await Q(page, () => __wq.ff(600));
    check(await Q(page, () => __wq.G.t >= 600 && __wq.G.stats.miles > 0), 'it travels');
    check(await Q(page, () => __wq.save() === undefined && !__wq.hasSave()), 'saving fails quietly');
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
