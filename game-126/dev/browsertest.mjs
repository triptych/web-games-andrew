/**
 * browsertest.mjs — EMBERSPIRE in real Chromium.
 *
 * desktop (1280x760): title with no errors and the ← Games link on top → New Game → the intro story → town and the
 *   daily bonus → the Tavern opens and Escape closes it → the Gate → floor 1 → real keys: 1 attacks (Enter picks a
 *   target) → A turns on auto battle → victory, the 10 s auto-climb countdown climbs to floor 2 by itself, Wait
 *   stops it, and there's no countdown into a mini boss → home in the evening → an evening at the Tavern →
 *   rest → the Forge upgrades a weapon, the Market sells a potion → Save & Quit → Continue restores the game.
 * phones (touch only, real taps) at 390x844 and 844x390: taps through the title and the story, the town fits,
 *   controls ≥ 44 px and on screen, the Gate, a battle command by tap, a target tapped on the canvas, no sideways
 *   scroll.
 * nostorage: localStorage throws; the game still boots and fights.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8126          # from the REPO ROOT
 *   node game-126/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8126), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8126';
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
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
        window.confirm = () => true;
    }, nostorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-126/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__es && __es.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; })()`;
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const noHScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const inputReady = `(() => { const B = __es.G?.battle; return B && B.phase === 'input' && !__es.busy; })()`;

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280x760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await shot(page, 'desktop-title');
    await click(page, '#title-menu [data-act="new"]');
    await until(page, visible('#scene .dlg'), 'New Game opens the intro story');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Enter');
    await until(page, () => __es.mode === 'town' && !__es.ui.stack.includes('scene'), 'Enter pages through the story into town');
    await until(page, visible('#popup .sheet'), 'the daily bonus greets you');
    check(await Q(page, () => __es.G.daily.streak === 1 && __es.G.gold > 150), 'and pays out');
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('popup').hidden, 'Enter closes it');
    await shot(page, 'desktop-town');
    await until(page, () => Object.keys(__es.audio.buffers).length >= 48, 'all 14 ElevenLabs effects and 34 voice lines decode');
    await until(page, () => { const t = __es.audio.tracks.town; return t && !t.paused && t.currentTime > 0.5; }, 'the ElevenLabs town theme is playing', 20000);

    await click(page, '#town [data-place="tavern"]');
    await until(page, visible('#place .npc'), 'the Tavern opens with Old Bram');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('place').hidden && __es.ui.place === null, 'Escape leaves the building');

    await click(page, '#town [data-place="gate"]');
    await until(page, visible('#place [data-k="floor-1"]'), 'the Gate offers floor 1');
    await click(page, '#place [data-k="floor-1"]');
    await until(page, () => __es.mode === 'tower' && __es.G.battle?.floor === 1, 'Climb starts the battle on floor 1');
    check(await Q(page, () => { const c = document.getElementById('stage').getBoundingClientRect(); return c.width > 600 && c.height > 300; }), 'the battle canvas is a good size');
    await until(page, () => { const t = __es.audio.tracks.battle; return t && !t.paused; }, 'the battle theme takes over', 20000);
    await until(page, inputReady, 'the party gets a turn', 60000);
    await shot(page, 'desktop-battle');
    const acts0 = await Q(page, () => __es.G.counters.skills + __es.G.battle.actions);
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(150);
    if (await Q(page, () => __es.ui.bmenu === 'target')) await page.keyboard.press('Enter');
    await until(page, (a) => __es.G.battle.actions > a || __es.G.battle.phase !== 'input', 'pressing 1 attacks (Enter picks the target)', 30000, acts0);
    await page.keyboard.press('KeyA');
    await until(page, () => __es.G.auto === true, 'A turns on auto battle');
    await until(page, () => ['won', 'lost'].includes(__es.G.battle?.phase) && !__es.busy, 'the battle plays out', 90000);
    await until(page, visible('#victory .sheet'), 'the result screen opens');
    await shot(page, 'desktop-victory');
    const won = await Q(page, () => __es.G.battle.phase === 'won');
    check(won, 'the starting party wins floor 1');
    if (won) {
        // auto battle is on and floor 2 is an ordinary floor: the button counts down from 10 and climbs by itself
        await until(page, () => /\(\d+\)$/.test(document.querySelector('#victory [data-k="next"]')?.textContent || ''), 'with auto battle on, Climb to floor 2 counts down');
        check(await Q(page, () => /\((10|9|8)\)$/.test(document.querySelector('#victory [data-k="next"]').textContent)), 'the countdown starts at 10 seconds');
        await until(page, () => __es.G.battle?.floor === 2 && document.getElementById('victory').hidden, 'at zero it climbs to floor 2 by itself', 30000);
        // Wait stops the countdown
        await Q(page, () => __es.resolve());
        await until(page, visible('#victory [data-k="wait"]'), 'the next victory counts down again, with a Wait button');
        await click(page, '#victory [data-k="wait"]');
        await page.waitForTimeout(3500);   // 3.5 s at fast=4 is 14 s of countdown time: it would have climbed by now
        check(await Q(page, () => __es.G.battle.floor === 2 && !document.getElementById('victory').hidden && !/\(\d+\)$/.test(document.querySelector('#victory [data-k="next"]').textContent)), 'Wait stops it: still on floor 2, no countdown');
        await shot(page, 'desktop-victory-wait');
        // no countdown into a mini boss: win floor 4 and the climb to floor 5 waits for you
        await Q(page, () => { __es.fight(4); __es.G.battle.units.filter((u) => u.side === 'e').forEach((u) => { u.hp = 1; }); __es.resolve(); });
        await until(page, () => __es.G.battle.floor === 4 && __es.G.battle.phase === 'won' && !document.getElementById('victory').hidden, 'floor 4 won (the mini boss is next)');
        await page.waitForTimeout(3500);
        check(await Q(page, () => __es.G.battle.floor === 4 && !/\(\d+\)$/.test(document.querySelector('#victory [data-k="next"]').textContent) && /mini boss waits/.test(document.getElementById('victory').textContent)), 'no countdown into a mini boss, and it says why');
        await shot(page, 'desktop-victory-miniboss');
        await until(page, visible('#victory [data-k="home"]'), 'after the fight, the way home');
        await click(page, '#victory [data-k="home"]');
        await until(page, () => __es.mode === 'town' && __es.G.phase === 'evening', 'home again, and it is evening');
    }
    // an evening with Mira
    await click(page, '#town [data-place="tavern"]');
    await until(page, visible('#place [data-k="eve-mira"]'), 'the Tavern offers an evening with Mira');
    await click(page, '#place [data-k="eve-mira"]');
    await until(page, visible('#scene .dlg'), 'the evening scene plays');
    await shot(page, 'desktop-evening');
    await page.keyboard.press('Enter');
    await until(page, () => __es.G.eveningDone && !__es.G.scene, 'Goodnight ends the evening');
    await until(page, visible('#place [data-k="rest"]'), 'rest is offered');
    await click(page, '#place [data-k="rest"]');
    await until(page, () => __es.G.day === 2 && __es.G.phase === 'day', 'resting starts day 2');
    // forge and market by click
    await Q(page, () => { __es.ui.closePlace(__es.G); __es.give(1e5); });
    await click(page, '#town [data-place="forge"]');
    const uid = await Q(page, () => __es.G.heroes.arin.eq.weapon);
    await until(page, visible(`#place [data-k="up-${uid}"]`), 'the Forge lists Arin\'s sword');
    await click(page, `#place [data-k="up-${uid}"]`);
    await until(page, (u) => __es.G.gear[u].plus === 1, 'and upgrades it', 10000, uid);
    await shot(page, 'desktop-forge');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('place').hidden, 'Escape leaves the Forge');
    await click(page, '#town [data-place="market"]');
    const pots = await Q(page, () => __es.G.inv.potion);
    await until(page, visible('#place [data-k="b1-potion"]'), 'the Market sells potions');
    await click(page, '#place [data-k="b1-potion"]');
    await until(page, (p) => __es.G.inv.potion === p + 1, 'buying one', 10000, pots);
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('place').hidden, 'Escape leaves the Market');
    // save & quit, continue
    const best = await Q(page, () => __es.G.best);
    await click(page, '#btn-menu');
    await until(page, visible('#settings .sheet'), 'the menu opens settings');
    await click(page, '#set-title');
    await until(page, () => __es.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (b) => __es.mode === 'town' && __es.G.best === b && __es.G.day === 2, 'Continue restores the game', 30000, best);
    check(await noHScroll(page), 'no sideways scroll');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}x${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, visible('#scene .dlg'), 'a tap on New Game opens the story');
    for (let i = 0; i < 4; i++) { await tapSel('#scene .choices .btn'); await page.waitForTimeout(150); }
    await until(page, () => __es.mode === 'town' && !__es.ui.stack.includes('scene'), 'taps page through the story');
    await until(page, visible('#popup .btn'), 'the daily bonus');
    await tapSel('#popup .btn');
    await until(page, () => document.getElementById('popup').hidden, 'a tap closes it');
    check(await noHScroll(page), 'the town has no sideways scroll');
    const small = await Q(page, () => [...document.querySelectorAll('#town button, #topbar button')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { ok: r.width >= 44 && r.height >= 36 && r.left >= -1 && r.right <= innerWidth + 1, t: b.textContent.slice(0, 20) }; }).filter((x) => !x.ok));
    check(small.length === 0, `town buttons are finger-sized and on screen ${small.length ? JSON.stringify(small) : ''}`);
    await shot(page, `phone-${w}x${h}-town`);
    await tapSel('#town [data-place="gate"]');
    await until(page, visible('#place [data-k="floor-1"]'), 'a tap opens the Gate');
    await tapSel('#place [data-k="floor-1"]');
    await until(page, () => __es.mode === 'tower', 'a tap on Climb starts the battle');
    await until(page, inputReady, 'the party gets a turn', 60000);
    const cmdSizes = await Q(page, () => [...document.querySelectorAll('#cmds button')].map((b) => { const r = b.getBoundingClientRect(); return r.height >= 40 && r.top >= 0 && r.bottom <= innerHeight + 1; }));
    check(cmdSizes.length >= 5 && cmdSizes.every(Boolean), 'battle commands are finger-sized and on screen');
    const actions = await Q(page, () => __es.G.battle.actions);
    await tapSel('#cmds [data-k="c-1"]');
    await page.waitForTimeout(200);
    if (await Q(page, () => __es.ui.bmenu === 'target')) {
        // tap the first target on the canvas itself
        const pt = await Q(page, () => {
            const uid = __es.ui.pending.pool[0];
            const u = __es.stage.units.get(uid);
            const c = document.getElementById('stage').getBoundingClientRect();
            const [, hh] = __es.stage.sizeOf(u);
            return { x: c.left + u.x / 640 * c.width, y: c.top + (u.y - hh / 2) / 360 * c.height };
        });
        await page.touchscreen.tap(pt.x, pt.y);
    }
    await until(page, (a) => __es.G.battle.actions > a || __es.G.battle.phase !== 'input', 'a tapped Attack (and a tapped target) acts', 30000, actions);
    check(await noHScroll(page), 'the battle has no sideways scroll');
    await shot(page, `phone-${w}x${h}-battle`);
    reportErrors(`phone ${w}x${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __es.start(7));
    await until(page, () => __es.mode === 'town', 'boots into town with localStorage throwing');
    await Q(page, () => { document.querySelector('#popup .btn')?.click(); __es.send({ t: 'enter', floor: 1 }); });
    await until(page, () => __es.mode === 'tower', 'and climbs');
    check(await Q(page, () => __es.save() === false), 'saving fails quietly');
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
