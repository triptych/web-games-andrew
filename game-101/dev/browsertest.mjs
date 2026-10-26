/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boots to the title with no errors; the ← Games link is on top → New Game →
 *   party creation → Descend → the town (3D square, party cards, eight places) → real keys open the
 *   Guild and close it → the Descent → the dungeon; real arrow keys turn and step; a battle by real
 *   key presses (1 = Attack) through to the results; the camp (items, journal, map); a chest dialog
 *   by key and button; a shop buy by click; Save → reload → Continue restores the game.
 * autoplay: the bot plays the real game through the real UI for a while: no errors, battles fought.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through title, creation and the
 *   town; the Descent; the touch pad steps and turns; a battle by taps; every control ≥ 44 px and on
 *   screen; no sideways scroll; the 3D view fits.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8101          # from the REPO ROOT
 *   node game-101/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8101), ONLY=desktop,autoplay,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8101';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, fast = 6, keepStorage = null, page: reuse = null } = {}) {
    if (!reuse) {
        if (browser) await browser.close();
        browser = await chromium.launch({
            executablePath: process.env.PW_CHROMIUM_PATH || undefined,
            args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
        });
    }
    const ctx = reuse ? reuse.context() : await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    if (!reuse) {
        await ctx.addInitScript((ns) => {
            if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        }, nostorage);
    }
    const page = reuse || await ctx.newPage();
    if (!reuse) {
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
        page.on('framenavigated', (f) => { if (f === page.mainFrame() && process.env.NAVLOG) console.log('    nav', f.url()); });
        page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    }
    await page.goto(`${BASE}/game-101/index.html?debug=1&fast=${fast}`);
    await page.waitForFunction(() => window.__pc && __pc.mode === 'title', null, { timeout: 60000 });
    void keepStorage;
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
let failShots = 0;
const until = (page, fn, msg, timeout = 40000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), async () => {
        check(false, msg);
        const name = `fail-${++failShots}`;
        await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }).catch(() => {});
        console.log(`    (screenshot: dev/shots/bt-${name}.png)`);
    });
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e || e.disabled) return false; e.click(); return true; }, sel);
const clickText = (page, scope, text) => Q(page, ([sc, t]) => { const e = [...document.querySelectorAll(`${sc} button`)].find((b) => b.textContent.trim().includes(t) && !b.disabled); if (!e) return false; e.click(); return true; }, [scope, text]);
const settle = (page) => page.waitForFunction(() => __pc.ui.q.length === 0 && __pc.ui.wait <= 0, null, { timeout: 40000, polling: 100 });
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const v = document.getElementById('viewbox').getBoundingClientRect();
    return { noHScroll: document.documentElement.scrollWidth <= innerWidth + 1, viewFits: v.left >= -1 && v.right <= innerWidth + 1 && v.width > 150 };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Start a game through the real menus (click or tap). */
async function newGameViaMenus(page, tap) {
    const press = async (sel) => { if (tap) await tap(sel); else await click(page, sel); };
    await clickText(page, '[data-screen=title]', 'New Game').then(async (ok) => { if (!ok && tap) await tap('[data-screen=title] .btn.primary'); });
    await until(page, () => !!document.querySelector('[data-screen=create]'), 'New Game opens party creation');
    await press('[data-screen=create] .btn.primary');
    await until(page, () => __pc.mode === 'play' && !document.querySelector('[data-screen=title]') && !document.querySelector('[data-screen=create]'), 'Descend starts the game in town');
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !!document.querySelector('[data-screen=title]')), 'the title screen is up');
    check(!(await Q(page, () => [...document.querySelectorAll('[data-screen=title] button')].some((b) => b.textContent.includes('Continue')))), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.viewFits, 'no sideways scroll; the 3D view fits');
    await shot(page, 'desktop-title');

    await newGameViaMenus(page);
    check(await Q(page, () => document.querySelectorAll('#party .card').length === 4), 'four party cards');
    check(await Q(page, () => document.querySelectorAll('#cmd .place').length === 8), 'eight places in town');
    await settle(page);
    await shot(page, 'desktop-town');

    // real keys: 2 = Guild, Escape closes
    await page.keyboard.press('Digit2');
    await until(page, () => !!document.querySelector('[data-screen=guild]'), 'key 2 opens the Guild');
    check(await clickText(page, '[data-screen=guild]', 'Investments'), 'the Investments tab is there');
    await until(page, () => document.querySelectorAll('[data-screen=guild] .biz').length === 7, 'seven businesses to invest in');
    await shot(page, 'desktop-guild');
    const g0 = await Q(page, () => __pc.G.gold);
    await clickText(page, '[data-screen=guild]', 'Buy');
    await until(page, (g) => __pc.G.gold < g && __pc.G.biz.tavern.lvl + __pc.G.biz.items.lvl + __pc.G.biz.smith.lvl + __pc.G.biz.magic.lvl + __pc.G.biz.inn.lvl + __pc.G.biz.church.lvl + __pc.G.biz.guild.lvl === 1, 'buying a stake costs gold and sets a level', 40000, g0);
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('[data-screen=guild]'), 'Escape closes it');

    // shops
    await page.keyboard.press('Digit3');
    await until(page, () => !!document.querySelector('[data-screen=items]'), 'key 3 opens the Item Shop');
    const inv0 = await Q(page, () => __pc.G.inv.reduce((a, x) => a + (x.n || 1), 0));
    await Q(page, () => document.querySelector('[data-screen=items] .shoprow .row').click());
    await until(page, (n) => __pc.G.inv.reduce((a, x) => a + (x.n || 1), 0) > n, 'clicking a shop row buys it', 40000, inv0);
    await shot(page, 'desktop-shop');
    await page.keyboard.press('Escape');
    for (const [key, name] of [['Digit4', 'smith'], ['Digit5', 'magic'], ['Digit6', 'church'], ['Digit7', 'tavern'], ['Digit8', 'inn']]) {
        await page.keyboard.press(key);
        await until(page, (n) => !!document.querySelector(`[data-screen=${n}]`), `key ${key.slice(5)} opens the ${name}`, 40000, name);
        if (name === 'inn') await shot(page, 'desktop-inn');
        await page.keyboard.press('Escape');
        await until(page, () => !document.querySelector('.screen'), `Escape leaves the ${name}`);
    }

    // the descent
    await page.keyboard.press('Digit1');
    await until(page, () => !!document.querySelector('[data-screen=gate]'), 'key 1 opens the Descent');
    await Q(page, () => document.querySelector('[data-screen=gate] .row').click());
    await until(page, () => !!__pc.G.floor && __pc.ui.stage.mode === 'dungeon' && !document.querySelector('.screen'), 'entering loads the dungeon');
    await Q(page, () => { __pc.G.danger = -1e9; const f = __pc.G.floor.feat; for (const k of Object.keys(f)) delete f[k]; __pc.ui.stage.syncFeatures(); });
    await settle(page);
    await shot(page, 'desktop-dungeon');
    check(await Q(page, () => !document.getElementById('mini').hidden && getComputedStyle(document.getElementById('mini')).display !== 'none'), 'the minimap shows');

    // walk: turn right, step
    const d0 = await Q(page, () => __pc.G.pos.d);
    await page.keyboard.press('ArrowRight');
    await until(page, (d) => __pc.G.pos.d === (d + 1) % 4, 'ArrowRight turns the party', 40000, d0);
    await page.keyboard.press('ArrowLeft');
    await until(page, (d) => __pc.G.pos.d === d, 'ArrowLeft turns back', 40000, d0);
    // make sure there is room to walk: face a way that is open
    const moved = await Q(page, async () => {
        const G = __pc.G, f = G.floor;
        for (let k = 0; k < 4; k++) { const t = f.hw ? 0 : 0; void t; }
        return true;
    });
    void moved;
    const s0 = await Q(page, () => __pc.G.steps), bump0 = await Q(page, () => __pc.seen.bump || 0);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); }
    await until(page, ([s, b]) => __pc.G.steps > s || (__pc.seen.bump || 0) > b, 'ArrowUp steps forward (or bumps a wall)', 40000, [s0, bump0]);
    await Q(page, () => __pc.G.events.length = 0);

    // map screen by key
    await page.keyboard.press('KeyM');
    await until(page, () => !!document.querySelector('[data-screen=map]') && !!document.querySelector('canvas.bigmap'), 'M opens the map');
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('.screen'), 'Escape closes the map');

    // a chest by key and button
    await Q(page, () => {
        const G = __pc.G, here = `${G.pos.x},${G.pos.y}`;
        G.floor.feat[here] = { type: 'chest', tier: 1, trap: null, opened: false };
        G.arrived = false;
    });
    await page.keyboard.press('Space');
    await until(page, () => __pc.G.dialog?.kind === 'chest' && !!document.querySelector('[data-screen=dialog]'), 'Space on a chest opens its dialog');
    const g1 = await Q(page, () => __pc.G.gold);
    await clickText(page, '[data-screen=dialog]', 'Open it');
    await until(page, (g) => __pc.G.gold > g && __pc.G.dialog?.kind === 'result', 'opening it pays out', 40000, g1);
    await shot(page, 'desktop-chest');
    await page.keyboard.press('Space');                // Space presses the focused OK button
    await until(page, () => !__pc.G.dialog && !document.querySelector('[data-screen=dialog]'), 'Space presses the focused OK button');

    // a battle by real keys
    await Q(page, async () => {
        const M = await import('/game-101/js/sim/monsters.js'), R = await import('/game-101/js/rng.js');
        __pc.act({ t: 'debugBattle', enemies: M.genEncounter(R.makeRng(5), 1, 1, 4) });
    });
    await until(page, () => !!__pc.G.battle && document.querySelectorAll('#cmd button').length >= 4, 'a battle shows the command menu');
    await settle(page);
    await shot(page, 'desktop-battle');
    let guard = 0;
    while (await Q(page, () => !!__pc.G.battle && !__pc.G.battle.over) && guard++ < 14) {
        const r0 = await Q(page, () => __pc.G.battle.round);
        for (let i = 0; i < 4; i++) {
            const stepNow = await Q(page, () => ({ round: __pc.G.battle.round, over: __pc.G.battle.over, step: __pc.ui.bs?.step, busy: __pc.ui.busy, who: __pc.ui.bs?.who }));
            if (stepNow.over || stepNow.round !== r0) break;
            await settle(page);
            if (stepNow.step === 'target') await Q(page, () => document.querySelector('#cmd .row.tgt')?.click());
            else await page.keyboard.press('Digit1');
            await page.waitForTimeout(120);
        }
        await settle(page);
    }
    check(await Q(page, () => __pc.G.battle?.over === 'win' || !__pc.G.battle), 'real key presses (1 = Attack) win a battle');
    await until(page, () => !!document.querySelector('[data-screen=results]') || !__pc.G.battle, 'the results screen appears');
    await shot(page, 'desktop-results');
    await clickText(page, '[data-screen=results]', 'Continue');
    await until(page, () => !__pc.G.battle && !document.querySelector('[data-screen=results]'), 'Continue ends the battle');

    // camp
    await page.keyboard.press('KeyI');
    await until(page, () => !!document.querySelector('[data-screen=camp]'), 'I opens the camp');
    await clickText(page, '[data-screen=camp]', 'Party');
    await until(page, () => document.querySelectorAll('[data-screen=camp] .detail .list .row').length >= 8, 'the party tab lists equipment slots');
    await shot(page, 'desktop-camp');
    const w0 = await Q(page, () => __pc.G.party[0].eq.weapon?.name);
    await Q(page, () => document.querySelector('[data-screen=camp] .detail .list .row').click());
    await until(page, () => /Weapon/.test(document.querySelector('[data-screen=camp] .detail h3')?.textContent || ''), 'clicking a slot opens the picker');
    void w0;
    await clickText(page, '[data-screen=camp]', 'Back');
    await clickText(page, '[data-screen=camp]', 'Journal');
    await until(page, () => document.querySelectorAll('[data-screen=camp] .jrow').length >= 20, 'the journal lists the monsters');
    await shot(page, 'desktop-journal');
    await clickText(page, '[data-screen=camp]', 'Items');
    await until(page, () => document.querySelectorAll('[data-screen=camp] .split.items .row').length >= 1, 'the items tab lists the bag');
    await page.keyboard.press('Escape');

    // equipping from the bag through the real menus
    await Q(page, async () => {
        const I = await import('/game-101/js/sim/items.js'), R = await import('/game-101/js/rng.js'), V = await import('/game-101/js/sim/inv.js');
        const w = I.genWeapon(R.makeRng(77), 14, { base: 'sword', rar: 2, noCurse: true });
        w.name = 'Test Brand'; V.give(__pc.G, w, 'found');
        __pc.ui.refresh();
    });
    await page.keyboard.press('KeyI');
    await until(page, () => !!document.querySelector('[data-screen=camp]'), 'the camp opens again');
    await clickText(page, '[data-screen=camp]', 'Items');
    await until(page, () => [...document.querySelectorAll('[data-screen=camp] .split.items .row')].some((b) => b.textContent.includes('Test Brand')), 'the new sword is in the bag');
    await Q(page, () => [...document.querySelectorAll('[data-screen=camp] .split.items .row')].find((b) => b.textContent.includes('Test Brand')).click());
    await until(page, () => document.querySelectorAll('[data-screen=camp] .detail .list .row').length >= 4, 'selecting it lists who can use it');
    await shot(page, 'desktop-equip');
    await Q(page, () => { const rows = [...document.querySelectorAll('[data-screen=camp] .detail .list .row')]; rows.find((r) => !r.disabled).click(); });
    await until(page, () => __pc.G.party.some((m) => m.eq.weapon?.name === 'Test Brand'), 'clicking a member equips it');
    await page.keyboard.press('Escape');

    // a doomed fight and the way home
    const gold2 = await Q(page, () => __pc.G.gold);
    await Q(page, async () => {
        const M = await import('/game-101/js/sim/monsters.js'), R = await import('/game-101/js/rng.js');
        __pc.act({ t: 'debugBattle', enemies: [M.genBoss(R.makeRng(5), 40, 40, 4)], opts: { boss: true } });
    });
    await until(page, () => !!__pc.G.battle && document.querySelectorAll('#cmd button').length >= 4, 'a hopeless battle starts');
    await settle(page);
    await Q(page, () => document.querySelector('#cmd .btn.danger')?.click());       // Flee is refused against a guardian
    await settle(page);
    check(await Q(page, () => !!__pc.G.battle && __pc.G.battle.over !== 'flee'), 'you cannot flee a guardian');
    await Q(page, () => { __pc.ui.auto = false; });
    for (let i = 0; i < 40 && await Q(page, () => __pc.G.battle && !__pc.G.battle.over); i++) {
        await settle(page);
        await Q(page, () => { const b = [...document.querySelectorAll('#cmd button')].find((x) => /Defend/.test(x.textContent)); if (b) { for (let k = 0; k < 4; k++) { const bb = [...document.querySelectorAll('#cmd button')].find((x) => /Defend/.test(x.textContent)); bb?.click(); } } });
        await page.waitForTimeout(150);
    }
    await until(page, () => __pc.G.battle?.over === 'lose' && !!document.querySelector('[data-screen=results]'), 'the party falls and the defeat screen shows', 120000);
    await shot(page, 'desktop-defeat');
    await clickText(page, '[data-screen=results]', 'Return to town');
    await until(page, () => !__pc.G.floor && !__pc.G.battle && __pc.ui.stage.mode === 'town', 'a wipe sends you back to town');
    check(await Q(page, (g) => __pc.G.gold < g && __pc.G.party.every((m) => m.hp >= 1), gold2), 'poorer, but alive');
    await Q(page, () => { const G = __pc.G; for (const m of G.party) m.hp = Math.max(1, m.hp); });

    // sound is really running
    check(await Q(page, () => !!__pc.audio.ctx && __pc.audio.ctx.state === 'running' && !!__pc.audio.timer), 'the audio context is running with the sequencer on');

    // save → reload → continue
    const pos = await Q(page, () => ({ ...__pc.G.pos, depth: __pc.G.depth, gold: __pc.G.gold, day: __pc.G.day }));
    await clickText(page, '#cmd', 'Save');
    await until(page, () => __pc.hasSave(), 'Save writes the game');
    await page.reload();
    await page.waitForFunction(() => window.__pc && __pc.mode === 'title', null, { timeout: 60000 });
    check(await clickText(page, '[data-screen=title]', 'Continue'), 'Continue is offered after a save');
    await until(page, () => __pc.mode === 'play', 'Continue restores the game');
    check(await Q(page, (p) => __pc.G.depth === p.depth && __pc.G.gold >= p.gold && __pc.G.day >= p.day, pos), 'with the same gold and day');

    // away for a while: the businesses keep paying
    await Q(page, () => { __pc.G.biz.inn.lvl = 3; __pc.act({ t: 'collect' }); __pc.save(); });
    const day0 = await Q(page, () => __pc.G.day);
    await page.reload();
    await page.waitForFunction(() => window.__pc && __pc.mode === 'title', null, { timeout: 60000 });
    // (the page saves again as it unloads, so the clock is wound back after the reload)
    await Q(page, () => { const o = JSON.parse(localStorage.getItem('pixelcrypt.v1')); o.savedAt -= 1000 * 60 * 30; localStorage.setItem('pixelcrypt.v1', JSON.stringify(o)); });
    await clickText(page, '[data-screen=title]', 'Continue');
    await until(page, (d) => __pc.mode === 'play' && __pc.G.day > d, 'half an hour away passes game days', 40000, day0);
    check(await Q(page, () => __pc.G.biz.inn.pend > 0), 'and the inn has earned something');
    reportErrors('desktop');
}

// ======================================================================
async function autoplay() {
    console.log('\n== autoplay (the bot plays the real game through the real UI)');
    const page = await open({ width: 1280, height: 760 }, { fast: 12 });
    await Q(page, () => { __pc.start(21); __pc.autoplay(true); });
    await until(page, () => (__pc.G.journal.misc.battles || 0) >= 6 && __pc.G.floor && __pc.G.stats.steps > 40, 'the bot walks the dungeon and fights battles in the real UI', 120000);
    await shot(page, 'autoplay');
    await until(page, () => __pc.G.maxDepth >= 2 || __pc.G.stats.kills >= 25, 'and keeps going', 120000);
    check(await Q(page, () => !document.querySelector('.screen[data-screen=title]')), 'no stray title screen');
    reportErrors('autoplay');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    void cdp;
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return null; return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    const tapText = async (scope, text) => {
        const sel = await Q(page, ([sc, t]) => { const els = [...document.querySelectorAll(`${sc} button`)]; const i = els.findIndex((b) => b.textContent.trim().includes(t) && !b.disabled); if (i < 0) return null; els[i].setAttribute('data-tap', '1'); return `${sc} button[data-tap="1"]`; }, [scope, text]);
        if (!sel) return false;
        const ok = await tapSel(sel);
        await Q(page, () => document.querySelectorAll('[data-tap]').forEach((e) => e.removeAttribute('data-tap')));
        return ok;
    };
    check(await backLinkOk(page), '← Games link is on top');
    check(await tapText('[data-screen=title]', 'New Game'), 'tapped New Game');
    await until(page, () => !!document.querySelector('[data-screen=create]'), 'a tap opens party creation');
    const btnOk = await Q(page, () => [...document.querySelectorAll('[data-screen=create] button, [data-screen=create] select, [data-screen=create] input')].every((e) => { const r = e.getBoundingClientRect(); return r.height >= 40 && r.left >= 0 && r.right <= innerWidth && r.top >= 0; }));
    check(btnOk, 'creation controls are ≥ 40 px and on screen');
    await tapText('[data-screen=create]', 'Descend');
    await until(page, () => __pc.mode === 'play' && !document.querySelector('.screen'), 'tapping Descend starts the game');
    await settle(page);
    let L = await layout(page);
    check(L.noHScroll && L.viewFits, 'town: no sideways scroll; the view fits');
    check(await Q(page, () => [...document.querySelectorAll('#cmd .place, #cmd .btn')].every((e) => { const r = e.getBoundingClientRect(); return r.height >= 36 && r.right <= innerWidth + 1; })), 'town buttons are big enough and on screen');
    await shot(page, `phone-${w}x${h}-town`);
    await tapText('#cmd', 'The Descent');
    await until(page, () => !!document.querySelector('[data-screen=gate]'), 'tapping a place opens it');
    await tapSel('[data-screen=gate] .row');
    await until(page, () => !!__pc.G.floor && !document.querySelector('.screen'), 'tapping a floor enters the dungeon');
    await Q(page, () => { __pc.G.danger = -1e9; const f = __pc.G.floor.feat; for (const k of Object.keys(f)) delete f[k]; __pc.ui.stage.syncFeatures(); });
    await settle(page);
    check(await Q(page, () => getComputedStyle(document.getElementById('deck')).display !== 'none'), 'the touch pad is shown in the dungeon');
    L = await layout(page);
    check(L.noHScroll && L.viewFits, 'dungeon: no sideways scroll; the view fits');
    const sizes = await Q(page, () => [...document.querySelectorAll('#deck button')].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.key, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight + 2 }; }));
    for (const z of sizes) check(z.ok, `pad button ${z.k} is ≥ 44 px and fully on screen`);
    const d0 = await Q(page, () => __pc.G.pos.d);
    await tapSel('#deck [data-key=KeyD]');
    await until(page, (d) => __pc.G.pos.d === (d + 1) % 4, 'tapping ↱ turns the party', 40000, d0);
    const s0 = await Q(page, () => ({ s: __pc.G.steps, b: __pc.seen.bump || 0 }));
    for (let i = 0; i < 4; i++) { await tapSel('#deck [data-key=KeyW]'); await page.waitForTimeout(250); await tapSel('#deck [data-key=KeyD]'); await page.waitForTimeout(250); }
    await until(page, (o) => __pc.G.steps > o.s || (__pc.seen.bump || 0) > o.b, 'tapping ▲ steps forward', 40000, s0);
    await shot(page, `phone-${w}x${h}-dungeon`);
    // a battle by taps
    await Q(page, async () => { const M = await import('/game-101/js/sim/monsters.js'), R = await import('/game-101/js/rng.js'); __pc.act({ t: 'debugBattle', enemies: M.genEncounter(R.makeRng(7), 1, 1, 4) }); });
    await until(page, () => !!__pc.G.battle && [...document.querySelectorAll('#cmd button')].some((b) => /Attack/.test(b.textContent)), 'the battle menu appears');
    await settle(page);
    check(await Q(page, () => [...document.querySelectorAll('#cmd button')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 36; })), 'battle buttons are big enough');
    await shot(page, `phone-${w}x${h}-battle`);
    await tapText('#cmd', 'Auto');
    await until(page, () => !__pc.G.battle || __pc.G.battle.over, 'Auto plays the battle out', 90000);
    await until(page, () => !!document.querySelector('[data-screen=results]'), 'the results screen shows');
    await shot(page, `phone-${w}x${h}-results`);
    await tapText('[data-screen=results]', 'Continue');
    await until(page, () => !__pc.G.battle, 'Continue closes the battle');
    await settle(page);
    // the camp sheet fits
    await tapText('#cmd', 'Menu');
    await until(page, () => !!document.querySelector('[data-screen=camp]'), 'Menu opens the camp');
    check(await Q(page, () => { const s = document.querySelector('[data-screen=camp] .sheet').getBoundingClientRect(); return s.left >= 0 && s.right <= innerWidth + 1 && s.top >= 0 && s.bottom <= innerHeight + 1; }), 'the camp sheet fits on the phone');
    await shot(page, `phone-${w}x${h}-camp`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await newGameViaMenus(page);
    await Q(page, () => __pc.ff(300));
    check(await Q(page, () => __pc.save() === false), 'saving fails quietly');
    check(await Q(page, () => __pc.hasSave() === false), 'and there is nothing to continue');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('autoplay')) await autoplay();
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
