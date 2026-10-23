/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): power-on → boot show → skip → title with no errors, the ← Games link on top →
 *   New Game by click → the typewriter really types, with keyboard sounds → any key finishes the typing
 *   and does not also choose → number keys, arrows+Enter and Space on a focused button all choose →
 *   floppy sound on a new scene → a roll shows its dice → Escape opens the menu, the journal opens →
 *   settings change the phosphor and the typing speed → pack: select, use, drop → the bot plays to an
 *   ending → the end card → New Game → Save to disk & Quit → Continue restores. No sideways scroll.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, a tap on the
 *   story finishes the typing without choosing, taps on choices and the PACK / SHEET tabs, controls ≥ 44 px
 *   and on screen, no sideways scroll, the text is not under the ← Games link.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8094          # from the REPO ROOT
 *   node game-094/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8094), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8094';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, query = '&fast=30' } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`http ${r.status()}: ${r.url()}`); });
    await page.goto(`${BASE}/game-094/index.html?debug=1${query}`);
    await page.waitForFunction(() => window.__lh, null, { timeout: 30000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 20000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
/** Wait until the story has finished typing and the choices are on screen. */
const ready = (page, msg) => until(page, () => !__lh.view.busy && document.querySelectorAll('#transcript .choices button').length > 0 || __lh.G.over && !__lh.view.busy, msg);
const node = (page) => Q(page, () => __lh.G.node);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const noHScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Count calls to an audio method. */
const spy = (page, method) => Q(page, (m) => { window.__spy = window.__spy || {}; window.__spy[m] = 0; const a = __lh.audio, orig = a[m].bind(a); a[m] = (...x) => { window.__spy[m]++; return orig(...x); }; }, method);
const spied = (page, m) => Q(page, (k) => window.__spy[k], m);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 }, { query: '&fast=30&boot=1' });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => __lh.mode === 'power' && !document.getElementById('boot').hidden), 'the monitor waits to be switched on');
    await page.keyboard.press('KeyX');
    await until(page, () => __lh.mode === 'boot', 'a key powers on the monitor and starts the boot show');
    await until(page, () => /LOADING THE LONG HELIX/.test(document.getElementById('boot-text').textContent) || __lh.mode === 'title', 'the boot show runs through its lines');
    await until(page, () => __lh.mode === 'title' && !document.getElementById('title').hidden, 'the boot ends at the title screen', 40000);
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => __lh.audio.ctx?.state === 'running'), 'audio starts on the first gesture');
    check(await noHScroll(page), 'no sideways scroll');
    await shot(page, 'desktop-title');

    // --- typing and sound, at the real speed
    await spy(page, 'key'); await spy(page, 'floppy');
    await Q(page, () => { __lh.view.fast = 1; });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __lh.mode === 'play' && document.getElementById('title').hidden, 'New Game starts play');
    await page.waitForTimeout(1900);
    const mid = await Q(page, () => { const p = [...document.querySelectorAll('#transcript p')].pop(); return { busy: __lh.view.busy, len: p ? p.textContent.length : 0 }; });
    check(mid.busy && mid.len > 0, `the text is being typed, not dumped (${mid.len} chars so far)`);
    check((await spied(page, 'key')) > 20, 'every typed character clacks a key');
    check((await spied(page, 'floppy')) >= 1, 'the disk drive chatters when a scene loads');
    check(await Q(page, () => document.querySelectorAll('#transcript .choices button').length === 0), 'no choices while it is still typing');
    // any key finishes the typing and does NOT also choose
    await page.keyboard.press('Space');
    await ready(page, 'a key finishes the typing and the choices appear');
    check(await node(page) === 'spec', 'the key that finished the typing did not also choose');
    await page.waitForTimeout(500);
    check(await node(page) === 'spec', 'and neither did its key-up');
    check(await Q(page, () => document.activeElement?.matches('#transcript .choices button')), 'the first choice has keyboard focus');
    await Q(page, () => { __lh.view.fast = 30; });
    await shot(page, 'desktop-first');

    // --- choosing: number key, arrows + Enter, Space on a focused button
    await page.keyboard.press('Digit2');
    await until(page, () => __lh.G.node === 'wake' && __lh.G.spec === 'FIELD GENETICIST', 'the 2 key chooses the second discipline');
    await ready(page, 'the next passage types out');
    await page.keyboard.press('Enter');
    await until(page, () => __lh.G.node === 'lab', 'Enter chooses the focused button');
    await ready(page, 'the lab appears');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await until(page, () => __lh.G.node === 'seq1' || __lh.G.flags.motif !== undefined || __lh.G.node === 'comms', 'arrow down then Space on a focused button chooses it');
    await ready(page, 'the results appear');
    check(await Q(page, () => document.querySelectorAll('#transcript .art').length >= 3), 'each scene draws its picture into the transcript');
    check(await Q(page, () => [...document.querySelectorAll('#transcript .art')].every((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let on = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) on++; return on > 500; })), 'the pictures are drawn, not blank');
    check(await Q(page, () => { const e = [...document.querySelectorAll('#transcript .echo')].pop(); return !!e && e.textContent.length > 3; }), 'a choice is echoed as a command');

    // --- a roll shows its dice
    await Q(page, () => { const G = __lh.G; G.node = 'lab'; G.flags.seq1 = true; delete G.flags.motif; G.codex.push('uniform'); __lh.view.clear(); __lh.view.scene(G, 'lab'); __lh.view.skip(); });
    await page.waitForTimeout(450);          // a click right after a skip is deliberately ignored
    await click(page, '#transcript .choices li:nth-child(1) button');
    await until(page, () => /ROLL ANALYSIS: 2d6 \[\d\+\d\]/.test(document.getElementById('transcript').textContent), 'a check prints its roll with the two dice');
    await ready(page, 'and the result follows');

    // --- menu, journal, settings
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('menu').hidden, 'Escape opens the menu');
    await click(page, '#menu-list [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden && Number(document.getElementById('settings').style.zIndex) > Number(document.getElementById('menu').style.zIndex), 'Settings opens on top of the menu');
    await Q(page, () => { const s = document.getElementById('set-phosphor'); s.value = 'green'; s.dispatchEvent(new Event('change')); const t = document.getElementById('set-speed'); t.value = 'fast'; t.dispatchEvent(new Event('change')); });
    check(await Q(page, () => document.body.dataset.phosphor === 'green' && __lh.view.speed === 'fast' && __lh.view.rgb[1] === 255 && __lh.view.rgb[0] === 51), 'the phosphor turns green and typing speeds up');
    await shot(page, 'desktop-green');
    await Q(page, () => { const s = document.getElementById('set-phosphor'); s.value = 'amber'; s.dispatchEvent(new Event('change')); const t = document.getElementById('set-speed'); t.value = 'normal'; t.dispatchEvent(new Event('change')); });
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('menu').hidden, 'Escape closes Settings, leaving the menu');
    await click(page, '#menu-list [data-act="resume"]');
    await until(page, () => !__lh.ui.anyScreen(), 'Resume closes the menu');
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden && document.querySelectorAll('#jn-list .entry:not(.locked)').length >= 1, 'J opens the journal with the entries found so far');
    await page.keyboard.press('Escape');

    // --- the pack
    await Q(page, () => { __lh.G.inv = ['stim', 'torch', 'tuner']; __lh.G.health = 5; __lh.ui.sig = ''; });
    await until(page, () => document.querySelectorAll('#pk-list .slot[data-id]').length === 3, 'the pack panel shows the three items');
    await click(page, '#pk-list .slot[data-id="stim"]');
    await until(page, () => !document.getElementById('pk-detail').hidden && !document.getElementById('pk-use').disabled, 'clicking an item shows its detail with USE');
    await click(page, '#pk-use');
    await until(page, () => __lh.G.health === 9 && !__lh.G.inv.includes('stim'), 'USE spends the stim and heals four');
    await click(page, '#pk-list .slot[data-id="torch"]');
    await click(page, '#pk-drop');
    await until(page, () => !__lh.G.inv.includes('torch'), 'DROP leaves the torch behind');
    await click(page, '#pk-list .slot[data-id="tuner"]');
    check(await Q(page, () => document.getElementById('pk-drop').disabled), 'a key item cannot be dropped');
    await shot(page, 'desktop-play');

    // --- the bot plays a whole game, through the real UI
    await Q(page, () => { __lh.start(21); __lh.autoplay(true, 'edit', 21); });
    await until(page, () => __lh.mode === 'over', 'the bot plays to an ending through the real buttons', 90000);
    await ready(page, 'the ending is typed');
    check(await Q(page, () => !!document.querySelector('.endcard') && /THE END/.test(document.querySelector('.endcard h3').textContent)), 'the end card shows the ending');
    check(await Q(page, () => __lh.ui.anyScreen() === false && document.querySelectorAll('#transcript .choices').length === 0), 'no choices after the ending');
    check(await Q(page, () => JSON.parse(localStorage.getItem('the-long-helix.v1.settings')).endings.length >= 1), 'the ending is remembered');
    await shot(page, 'desktop-over');
    await Q(page, () => __lh.autoplay(false));
    await click(page, '.endcard [data-end="new"]');
    await until(page, () => __lh.mode === 'play' && __lh.G.node === 'spec' && !__lh.G.over, 'New Game from the end card starts again');

    // --- save and continue
    await Q(page, () => { __lh.ff(25, 'edit', 4); });
    const snap = await Q(page, () => ({ node: __lh.G.node, und: __lh.G.und, inv: __lh.G.inv.join(), day: __lh.G.day }));
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('menu').hidden, 'Escape opens the menu mid-game');
    await click(page, '#menu-list [data-act="quit"]');
    await until(page, () => __lh.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save to disk & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __lh.mode === 'play' && __lh.G.node === s.node && __lh.G.und === s.und && __lh.G.inv.join() === s.inv && __lh.G.day === s.day, 'Continue restores the saved game exactly', 20000, snap);
    check(await Q(page, () => /RESTORED FROM DISK/.test(document.getElementById('transcript').textContent) && document.querySelectorAll('#transcript .choices button').length > 0), 'and shows the passage with its choices');
    check(await noHScroll(page), 'no sideways scroll in play');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true, query: '&fast=1' });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    check(await noHScroll(page), 'no sideways scroll on the title');
    const tsizes = await Q(page, () => [...document.querySelectorAll('#title-menu button:not([hidden])')].map((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth; }));
    check(tsizes.every(Boolean), 'the title buttons are at least 44 px and on screen');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __lh.mode === 'play', 'a tap on New Game starts play');

    // a tap on the story while it types finishes it, and does not choose
    await page.waitForTimeout(500);
    check(await Q(page, () => __lh.view.busy), 'the story is typing');
    const sr = await Q(page, () => { const r = document.getElementById('story').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 60 }; });
    await page.touchscreen.tap(sr.x, sr.y);
    await ready(page, 'a tap on the story finishes the typing');
    await page.waitForTimeout(400);
    check(await node(page) === 'spec', 'the tap that finished the typing did not choose');
    check(await Q(page, () => { const a = document.getElementById('back-link').getBoundingClientRect(); return ['#status', '#story'].every((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= a.bottom - 2 || r.left >= a.right - 2; }); }), 'the status bar and the story are clear of the ← Games link');
    await shot(page, `phone-${w}x${h}-first`);

    const sizes = await Q(page, () => [...document.querySelectorAll('#transcript .choices button, #btn-menu, #btn-journal, #tabs button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 18), ok: r.width >= 44 && r.height >= 44 }; }));
    for (const z of sizes) if (!z.ok) check(false, `${z.t} is at least 44 px`);
    check(sizes.every((z) => z.ok), 'choices, tabs, MENU and JOURNAL are all at least 44 px');
    await tapSel('#transcript .choices li:nth-child(3) button');
    await until(page, () => __lh.G.node === 'wake' && __lh.G.stats.INT === 4, 'a tap on a choice chooses it');
    await ready(page, 'the next passage types and its choices appear');
    check(await noHScroll(page), 'no sideways scroll in play');

    // the sheet and pack tabs
    await tapSel('#tabs button[data-tab="sheet"]');
    await until(page, () => document.getElementById('game').dataset.tab === 'sheet' && document.getElementById('sheet').getBoundingClientRect().height > 100 && document.getElementById('story').offsetParent === null, 'the SHEET tab shows the character and hides the story');
    check(await Q(page, () => /INTUITION/.test(document.getElementById('sheet').textContent) && /HEALTH/.test(document.getElementById('sheet').textContent)), 'the sheet lists attributes and vitals');
    await shot(page, `phone-${w}x${h}-sheet`);
    await Q(page, () => { __lh.G.inv = ['stim', 'sequencer']; __lh.ui.sig = ''; });
    await tapSel('#tabs button[data-tab="pack"]');
    await until(page, () => document.getElementById('pack').getBoundingClientRect().height > 100 && document.querySelectorAll('#pk-list .slot[data-id]').length === 2, 'the PACK tab shows the items');
    await tapSel('#pk-list .slot[data-id="stim"]');
    await until(page, () => !document.getElementById('pk-detail').hidden, 'a tap on an item shows its detail');
    const bsz = await Q(page, () => ['#pk-use', '#pk-drop'].map((s) => { document.querySelector(s).scrollIntoView({ block: 'center' }); const r = document.querySelector(s).getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    check(bsz.every(Boolean), 'USE and DROP are at least 44 px and can be scrolled onto the screen');
    await shot(page, `phone-${w}x${h}-pack`);
    await tapSel('#tabs button[data-tab="story"]');
    await until(page, () => document.getElementById('story').offsetParent !== null, 'the STORY tab brings the story back');

    // menu: the finger that opens it does not close it on lift
    await tapSel('#btn-menu');
    await until(page, () => !document.getElementById('menu').hidden, 'a tap on MENU opens the menu');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('menu').hidden), 'the menu stays open after the finger lifts');
    await tapSel('#menu-list [data-act="resume"]');
    await until(page, () => document.getElementById('menu').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __lh.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __lh.ff(30, 'signature', 2));
    check(await Q(page, () => __lh.save() === false), 'saving fails quietly');
    check(await Q(page, () => __lh.G.node !== 'spec'), 'and the story plays on');
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
