/**
 * browsertest.mjs — The First Dragon Prince in real Chromium.
 *
 * desktop (1280x760): title with no errors and the ← Games link on top → New Game names the prince → the prologue
 *   plays (Enter types and advances, a voiced line plays, the generated music and effects load) → Tab skips → the
 *   Free Day → the market sells a gift → Escape leaves → the planner takes three periods by click → the periods
 *   run with their results → S opens the status sheet → Save to slot 1 → Save & Quit → Continue restores the game
 *   → the album replays the prologue → the bot plays to the coming of age → the ending card.
 * phones (touch only, real taps) at 390x844 and 844x390: tap through the title and the naming sheet, a tap on the
 *   dialogue box advances, the Free Day and the planner fit, controls ≥ 44 px and on screen, no sideways scroll.
 * nostorage: localStorage throws; the game still boots and plays a month.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8127          # from the REPO ROOT
 *   node game-127/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8127), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8127';
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
    page.on('requestfailed', (r) => {
        const u = r.url();
        // a voice clip cut off by the next line is aborted on purpose
        if (u.includes('favicon') || (u.includes('/audio/') && r.failure()?.errorText === 'net::ERR_ABORTED')) return;
        errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
    });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
    await page.goto(`${BASE}/game-127/index.html?debug=1&fast=6`);
    await page.waitForFunction(() => window.__fdp && __fdp.mode === 'title', null, { timeout: 60000 });
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
const noHScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('panel').scrollWidth <= innerWidth + 1);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Every visible button in a region is at least 44 px and inside the viewport. */
const controlsOk = (page, sel) => Q(page, (s) => {
    const bad = [];
    for (const b of document.querySelectorAll(`${s} button`)) {
        if (b.closest('[hidden]') || !b.getClientRects().length) continue;
        const r = b.getBoundingClientRect();
        if (r.height < 43.5 || r.width < 43.5 || r.left < -1 || r.right > innerWidth + 1) bad.push(`${b.textContent.trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return bad;
}, sel);

/** Press Tab (skip) and pick the first choice until the scenes are done and the Free Day shows. */
async function skipToFree(page, keys = true) {
    for (let i = 0; i < 80; i++) {
        const st = await Q(page, () => ({ scene: !!__fdp.G.scene, choice: !!__fdp.G.scene?.cur?.choice, phase: __fdp.G.phase, res: __fdp.ui.results.length }));
        if (!st.scene && st.phase === 'free' && !st.res) return true;
        if (st.res) await click(page, '#panel [data-k^="dismiss"]');
        else if (st.choice) { if (keys) await page.keyboard.press('Digit1'); else await click(page, '#dlg-choices button'); }
        else if (keys) await page.keyboard.press('Tab');
        else await click(page, '[data-vn="skip"]');
        await page.waitForTimeout(60);
    }
    return false;
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280x760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, visible('#ng-name'), 'New Game asks for names');
    await page.fill('#ng-name', 'Ember');
    await page.fill('#ng-gname', 'Marta');
    await page.selectOption('#ng-title', 'Mother');
    await click(page, '#ng-go');
    await until(page, () => __fdp.mode === 'game' && __fdp.G.scene?.id === 'prologue', 'Begin starts the prologue');
    check(await Q(page, () => __fdp.G.name === 'Ember' && __fdp.G.gname === 'Marta' && __fdp.G.title === 'Mother'), 'with the names chosen');
    await until(page, visible('#dlg .text'), 'the dialogue box is up');
    const t0 = await Q(page, () => __fdp.G.scene.pc);
    await page.keyboard.press('Enter');          // finish typing
    await page.keyboard.press('Enter');          // next line
    await until(page, (p) => __fdp.G.scene.pc > p, 'Enter advances the story', 10000, t0);
    await until(page, () => Object.keys(__fdp.audio.buffers).length >= 14, 'all 14 ElevenLabs effects decode', 30000);
    await until(page, () => { const t = Object.values(__fdp.audio.tracks).find((e) => !e.paused); return t && t.currentTime > 0.3; }, 'an ElevenLabs music track is playing', 20000);
    await until(page, () => __fdp.audio.voiceEl && __fdp.audio.voiceEl.src.includes('/audio/vo/') && __fdp.audio.voiceEl.currentTime > 0.1, 'the narrator\'s recorded voice plays', 20000);
    await shot(page, 'desktop-prologue');
    // the history keeps what was said
    await page.keyboard.press('KeyL');
    await until(page, visible('#log .ln'), 'L opens the history');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('log').hidden, 'Escape closes it');

    check(await skipToFree(page), 'Tab and 1 get through the prologue to the Free Day');
    await until(page, visible('#panel [data-k="place:market"]'), 'the Free Day map shows the city');
    await shot(page, 'desktop-free');
    await click(page, '#panel [data-k="place:market"]');
    await until(page, visible('#panel [data-k="buy:sweets"]'), 'the market opens its stalls');
    const gold0 = await Q(page, () => __fdp.G.gold);
    await click(page, '#panel [data-k="buy:sweets"]');
    await until(page, (g) => __fdp.G.gold < g && __fdp.G.inv.sweets === 1, 'buying Honey Sweets takes the gold', 5000, gold0);
    await page.keyboard.press('Escape');
    await until(page, () => __fdp.ui.place === null, 'Escape leaves the market');
    await click(page, '#panel [data-k="place:manor"]');
    await click(page, '#panel [data-k="talk:praise"]');
    await until(page, () => __fdp.G.scene?.id === 'talk', 'praising the prince plays a little scene');
    check(await skipToFree(page), 'and returns to the Free Day');
    check(await Q(page, () => __fdp.G.ap === 2), 'it used one of the day\'s three actions');

    await click(page, '#panel [data-k="endFree"]');
    await until(page, () => __fdp.G.phase === 'plan' && !!document.querySelector('#panel [data-k="pick:sword"]'), 'Plan the month opens the planner');
    await click(page, '#panel [data-k="pick:sword"]');
    await click(page, '#panel [data-k="tab:job"]');
    await click(page, '#panel [data-k="pick:bakery"]');
    await click(page, '#panel [data-k="tab:rest"]');
    await click(page, '#panel [data-k="pick:rest"]');
    check(await Q(page, () => __fdp.ui.planSlots.join() === 'sword,bakery,rest'), 'three periods picked by click');
    await shot(page, 'desktop-plan');
    await click(page, '#panel [data-k="plan"]');
    await until(page, () => __fdp.G.phase === 'run', 'Begin the month starts the periods');
    await click(page, '#panel [data-k="next"]');
    await until(page, visible('#panel .result .story'), 'the first period shows its result and vignette');
    check(await Q(page, () => /act\/sword\.webp/.test(document.querySelector('#panel .vignette').style.backgroundImage)), 'with the swordsmanship vignette');
    await shot(page, 'desktop-result');
    for (let i = 0; i < 6 && await Q(page, () => __fdp.G.month === 1); i++) { await click(page, '#panel [data-k^="dismiss"]'); await page.waitForTimeout(80); }
    await until(page, () => __fdp.G.month === 2, 'three periods later it is Thawmoon');
    // the last period's result is still up: its Continue leads into a month that opens with a story scene, and
    // the dialogue box must take over (v1.0.0 left the screen blank here)
    await until(page, visible('#panel [data-k^="dismiss"]'), 'the last period\'s result waits for Continue');
    await click(page, '#panel [data-k^="dismiss"]');
    await until(page, () => __fdp.G.scene?.id === 'meet_rowan' && !__fdp.ui.results.length, 'Thawmoon opens with Rowan\'s scene');
    await until(page, visible('#dlg .text'), 'and its dialogue box shows after the last result');
    check(await Q(page, () => document.getElementById('panel').hidden), 'with the period panel gone');
    await shot(page, 'desktop-month2-scene');

    check(await skipToFree(page), 'Tab and 1 get through it to the Free Day');
    await page.keyboard.press('KeyS');
    await until(page, visible('#status .stat'), 'S opens the status sheet');
    await shot(page, 'desktop-status');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('status').hidden, 'Escape closes it');

    // save, quit, continue
    await click(page, '#btn-menu');
    await click(page, '#menu-menu [data-act="save"]');
    await until(page, visible('#slots [data-slot="1"]'), 'the Save screen lists the slots');
    await click(page, '#slots [data-slot="1"]');
    await until(page, () => !!__fdp.slots()[1], 'saved to slot 1');
    await page.keyboard.press('Escape');
    const before = await Q(page, () => ({ m: __fdp.G.month, g: __fdp.G.gold, n: __fdp.G.name }));
    await click(page, '#menu-menu [data-act="quit"]');
    await until(page, () => __fdp.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (b) => __fdp.mode === 'game' && __fdp.G.month === b.m && __fdp.G.gold === b.g && __fdp.G.name === b.n, 'Continue restores the game', 10000, before);

    // the album replays a cutscene
    await click(page, '#btn-album');
    await until(page, visible('#album [data-replay="prologue"]'), 'the album holds the prologue');
    await click(page, '#album [data-replay="prologue"]');
    await until(page, () => __fdp.mode === 'replay' && __fdp.R.scene?.id === 'prologue' && !document.getElementById('dlg').hidden, 'and replays it');
    check(await Q(page, (b) => __fdp.G.month === b.m && __fdp.G.gold === b.g && __fdp.R !== __fdp.G, before), 'without touching the real game');
    await shot(page, 'desktop-replay');
    await click(page, '#replay-exit');
    await until(page, () => __fdp.mode === 'game' && !document.getElementById('album').hidden, 'End replay goes back to the album and the game');
    await page.keyboard.press('Escape');

    // the bot raises him the rest of the way; the ending plays
    await Q(page, () => __fdp.toEnding('king'));
    await until(page, () => __fdp.G.phase === 'ending' && __fdp.G.scene?.id === 'ending', 'eight years later, the coming of age', 60000);
    await shot(page, 'desktop-ending-scene');
    for (let i = 0; i < 60 && await Q(page, () => __fdp.mode === 'game'); i++) {
        const choice = await Q(page, () => !!__fdp.G.scene?.cur?.choice);
        if (choice) await page.keyboard.press('Digit1'); else await page.keyboard.press('Tab');
        await page.waitForTimeout(50);
    }
    await until(page, visible('#ending h2'), 'the ending card shows');
    check(await Q(page, () => __fdp.album.endings.length >= 1 && document.getElementById('ending-title').textContent.length > 3), `and the album records it: "${await Q(page, () => document.getElementById('ending-title').textContent)}"`);
    await shot(page, 'desktop-ending');
    reportErrors('desktop');
}

async function phone(viewport, label) {
    console.log(`\n== phone ${label} (touch)`);
    const page = await open(viewport, { touch: true });
    check(await backLinkOk(page), '← Games link is on top');
    check(await noHScroll(page), 'no sideways scroll on the title');
    await page.tap('#title-menu [data-act="new"]');
    await until(page, visible('#ng-go'), 'tap New Game opens the naming sheet');
    await page.tap('#ng-go');
    await until(page, () => __fdp.G?.scene?.id === 'prologue', 'tap Begin starts the prologue');
    const pc = await Q(page, () => __fdp.G.scene.pc);
    await page.tap('#dlg .box'); await page.tap('#dlg .box');
    await until(page, (p) => __fdp.G.scene.pc > p, 'tapping the dialogue box advances', 10000, pc);
    check((await controlsOk(page, '#dlg')).length === 0, 'the VN buttons are finger-sized and on screen');
    await shot(page, `${label}-prologue`);
    check(await skipToFree(page, false), 'Skip and taps reach the Free Day');
    const bad = await controlsOk(page, '#panel');
    check(bad.length === 0, `Free Day controls ≥ 44 px and on screen${bad.length ? ': ' + bad.join(', ') : ''}`);
    check(await noHScroll(page), 'no sideways scroll on the Free Day');
    check(await Q(page, () => document.getElementById('panel').getBoundingClientRect().top >= document.getElementById('hud').getBoundingClientRect().bottom - 1), 'the panel starts below the HUD');
    await shot(page, `${label}-free`);
    await page.tap('#panel [data-k="endFree"]');
    await until(page, () => __fdp.G.phase === 'plan', 'tap Plan the month');
    await page.tap('#panel [data-k="pick:library"]');
    await page.tap('#panel [data-k="pick:library"]');
    await page.tap('#panel [data-k="pick:library"]');
    await page.locator('#panel [data-k="plan"]').tap();
    await until(page, () => __fdp.G.phase === 'run', 'three taps and Begin start the month');
    check(await noHScroll(page), 'no sideways scroll in the planner');
    await shot(page, `${label}-run`);
    await page.locator('#panel [data-k="next"]').tap();
    for (let i = 0; i < 8 && await Q(page, () => __fdp.G.month === 1 || __fdp.ui.results.length > 0); i++) {
        await page.locator('#panel [data-k^="dismiss"]').tap();
        await page.waitForTimeout(80);
    }
    await until(page, visible('#dlg .text'), 'tapping through the month lands in Rowan\'s scene with its dialogue box');
    reportErrors(label);
}

async function nostorage() {
    console.log('\n== nostorage');
    const page = await open({ width: 1024, height: 700 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await click(page, '#ng-go');
    await until(page, () => __fdp.mode === 'game', 'a new game starts with storage blocked');
    await Q(page, () => __fdp.months(2));
    check(await Q(page, () => __fdp.G.turn >= 3), 'and the bot plays two months');
    await click(page, '#btn-menu');
    await click(page, '#menu-menu [data-act="save"]');
    await click(page, '#slots [data-slot="1"]');
    await until(page, () => [...document.querySelectorAll('.toast')].some((t) => /not available/.test(t.textContent)), 'saving says it is not available');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone({ width: 390, height: 844 }, 'phone-portrait'); await phone({ width: 844, height: 390 }, 'phone-landscape'); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL (exception)', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(fails ? `\n${fails} failure(s)` : '\nall browser checks passed');
process.exit(fails ? 1 : 0);
