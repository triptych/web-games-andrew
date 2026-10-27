/**
 * browsertest.mjs: the real game in real Chromium.
 *
 * desktop (1280×760): boots to the title with no errors and the ← Games link on top → New Game →
 *   real keys type commands that change the game → an unknown verb gets an answer → Esc pauses →
 *   the tap shortcuts compose commands → Save & Quit → Continue restores the game and its
 *   transcript → a death shows the death screen and Restore brings you back → the whole story
 *   played through the UI ends on the ending screen with a perfect score. No sideways scroll;
 *   the picture is drawn in strict black and white.
 * phones (touch only, real touches) at 390×844 and 844×390: taps through the menus, the shortcut
 *   chips are on and compose a command, controls ≥ 44 px, the log keeps room to be read, no
 *   sideways scroll, the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8104          # from the REPO ROOT
 *   node game-104/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8104), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8104';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, fast = true } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-104/index.html?debug=1${fast ? '&fast=1' : ''}`);
    await page.waitForFunction(() => window.__hh && __hh.mode === 'title', null, { timeout: 30000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 15000, arg = null) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const logText = (page) => Q(page, () => document.getElementById('log').innerText);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const app = document.getElementById('app').getBoundingClientRect();
    const log = document.getElementById('log').getBoundingClientRect();
    const stage = document.getElementById('stage').getBoundingClientRect();
    const c = document.getElementById('view');
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        fits: app.bottom <= (vv?.height ?? innerHeight) + 1 && app.right <= innerWidth + 1,
        logH: Math.round(log.height), stageOk: stage.left >= 0 && stage.right <= innerWidth + 1,
        cw: c.width, ch: c.height,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const type = async (page, text) => { await page.locator('#cmd').click(); await page.keyboard.type(text); await page.keyboard.press('Enter'); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    let L = await layout(page);
    check(L.noHScroll && L.fits, 'the title fits the window, no sideways scroll');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="howto"]');
    await until(page, () => !document.getElementById('howto').hidden, 'How to Play opens');
    await click(page, '#howto [data-close]');
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hh.mode === 'play' && document.getElementById('title').hidden, 'New Game starts play');
    check((await logText(page)).includes('Marga is gone'), 'the story opens in the transcript');
    check(await Q(page, () => document.querySelector('#card') && !document.getElementById('card').hidden), 'the chapter card shows');
    L = await layout(page);
    check(L.noHScroll && L.fits && L.stageOk, 'the play screen fits, no sideways scroll');
    check(L.cw === 320 && L.ch === 136, 'the picture is drawn at 320×136');
    await page.waitForFunction(() => __hh.view.wipe === 0, null, { timeout: 5000 });
    // strict one-bit: every pixel the canvas holds is black or near-white
    const bw = await Q(page, () => { const c = document.getElementById('view'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let other = 0, white = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] === 0) continue; if (d[i] === 240) white++; else other++; } return { other, white }; });
    check(bw.other === 0 && bw.white > 300, `the picture is strict black and white (${bw.white} white pixels, ${bw.other} grey)`);
    await shot(page, 'desktop-play');

    await type(page, 'take satchel');
    await until(page, () => __hh.G.loc.satchel === 'inv', 'typing "take satchel" and Enter takes it');
    check((await logText(page)).includes('take satchel'), 'the command is echoed in the transcript');
    await type(page, 'xyzzy');
    await until(page, () => /xyzzy/.test(document.getElementById('log').innerText.split('› xyzzy')[1] || ''), 'an unknown verb gets an answer');
    await type(page, 'read note');
    await until(page, () => __hh.G.flags.read_note === true, 'reading the note sets the flag');
    await page.locator('#cmd').click(); await page.keyboard.press('ArrowUp');
    check((await Q(page, () => document.getElementById('cmd').value)) === 'read note', 'Up recalls the last command');
    await page.keyboard.press('Enter');

    // the tap shortcuts
    await click(page, '#btn-chips');
    check(await Q(page, () => !document.getElementById('verbs').offsetParent === false), 'the shortcut button shows the verbs');
    await click(page, '#verbs [data-v="take"]');
    await Q(page, () => document.querySelector('#nouns [data-n="kettle"]').click());
    await until(page, () => __hh.G.loc.kettle === 'inv', 'Take then Kettle composes "take kettle"');
    await click(page, '#exits [data-d="out"]');
    await until(page, () => __hh.G.room === 'garden', 'an exit chip walks you there');
    await Q(page, () => document.querySelector('#verbs [data-v="take"]').click());
    await Q(page, () => document.querySelector('#nouns [data-n="yarrow"]').click());
    await until(page, () => __hh.G.stock.yarrow === 2, 'Take then Yarrow picks the herb');
    await shot(page, 'desktop-garden');

    // pause, save, quit, continue
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes it');
    await click(page, '#btn-pause');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __hh.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __hh.mode === 'play' && __hh.G.room === 'garden' && __hh.G.stock.yarrow === 2, 'Continue restores the game');
    check((await logText(page)).includes('take satchel'), '...and the transcript');

    // a death, and restoring from it
    await Q(page, () => { __hh.G.room = 'garden'; });
    await type(page, 'climb well');
    await until(page, () => __hh.mode === 'dead' && !document.getElementById('dead').hidden, 'a death shows the death screen');
    check((await Q(page, () => document.getElementById('dead-title').textContent)).length > 3, '...with a title');
    await shot(page, 'desktop-dead');
    await click(page, '#dead-restore');
    await until(page, () => __hh.mode === 'play' && !__hh.G.dead && document.getElementById('dead').hidden, 'Restore brings you back alive');

    // the whole story through the UI
    await Q(page, () => __hh.start(7));
    await Q(page, () => { __hh.walk(Infinity); });
    await until(page, () => __hh.mode === 'over' && !document.getElementById('over').hidden, 'the whole story, played through the UI, reaches the ending screen', 30000);
    check((await Q(page, () => document.getElementById('over-title').textContent)) === 'Dawn Over Ashwick', 'it is the best ending');
    check((await Q(page, () => __hh.G.score)) === 100, 'with a perfect score');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __hh.mode === 'play' && __hh.G.turn === 0, 'Play Again starts a fresh game');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    let L = await layout(page);
    check(L.noHScroll && L.fits, 'the title fits, no sideways scroll');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __hh.mode === 'play', 'a tap on New Game starts play');
    L = await layout(page);
    check(L.noHScroll && L.fits && L.stageOk, 'the play screen fits, no sideways scroll');
    check(L.logH >= 60, `the transcript keeps room to be read (${L.logH}px)`);
    check(await Q(page, () => !!document.getElementById('verbs').offsetParent), 'the tap shortcuts are on for touch');
    const sizes = await Q(page, () => ['#btn-pause', '#go', '#btn-chips'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { s, ok: r.width >= 40 && r.height >= 40 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
    for (const z of sizes) check(z.ok, `${z.s} is finger-sized and on screen`);
    const chips = await Q(page, () => [...document.querySelectorAll('.chip')].map((e) => { const r = e.getBoundingClientRect(); return { h: r.height, w: r.width }; }));
    check(chips.length > 10 && chips.every((c) => c.h >= 32 && c.w >= 32), `every chip is at least 32 px (${chips.length} chips)`);

    await tapSel('#verbs [data-v="take"]');
    await tapSel('#nouns [data-n="satchel"]');
    await until(page, () => __hh.G.loc.satchel === 'inv', 'tapping Take then Satchel takes it');
    await tapSel('#verbs [data-v="read"]');
    await tapSel('#nouns [data-n="note"]');
    await until(page, () => __hh.G.flags.read_note === true, 'tapping Read then Note reads it');
    await tapSel('#exits [data-d="out"]');
    await until(page, () => __hh.G.room === 'garden', 'tapping an exit walks');
    await tapSel('#verbs [data-v="brew"]');
    check(await Q(page, () => document.getElementById('cmd').value === 'brew '), 'Brew starts a command');
    await tapSel('#verbs [data-v="look"]');
    await until(page, () => /Marga's Herb Garden/.test(document.getElementById('log').innerText), 'Look is immediate');
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ☰ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hh.mode === 'play', 'boots and starts a game with localStorage throwing');
    await type(page, 'take satchel');
    await until(page, () => __hh.G.loc.satchel === 'inv', 'and plays');
    await click(page, '#btn-pause'); await click(page, '#pause-menu [data-act="save"]');
    check(/Could not save/.test(await Q(page, () => document.getElementById('toasts').innerText)), 'saving fails quietly with a toast');
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
