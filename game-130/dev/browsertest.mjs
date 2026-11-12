/**
 * browsertest.mjs — Starbase Spooky in real Chromium, driven by real keys, mouse clicks and touches.
 *
 * desktop (1280×720): the title and the ← Games link; New Game; Space on the focused ▶ advances the briefing;
 *   M opens the map and a real click on the Docking Bay goes there; the toolbar under the picture (the room's name,
 *   ◀ ▶ walking to the next room, the button toward the next job glowing, the job list under it), the door arrows at
 *   the picture's edges and Q/E; the backpack (a clue's slot, its card, 🔊, Escape); a click on Zorp walks Kit over and starts the quiz;
 *   keys 1/2/3 answer (a wrong answer greys its button, the right one earns stickers); Escape pauses and the sim
 *   stops; Escape closes Settings even with a slider focused; the wire puzzle solved with real clicks on its plugs;
 *   N opens the Notebook with the clue in it; Save & Quit → Continue restores the day; the rest of the game
 *   fast-forwarded to the certificate; Play Again. Sound: effects and voice clips decode and a music theme plays.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the ▶ button, the toolbar
 *   (every button ≥ 44 px and on screen, ◀ ▶ and the edge arrows walk between rooms, 🎒 on a short phone) and the map,
 *   a tap on the visitor, answers tapped, controls ≥ 44 px and on screen, the dialogue on screen, no sideways
 *   scroll, the picture inside the viewport.
 * nostorage: localStorage throws; the game still boots and plays, and saving fails quietly.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8130          # from the REPO ROOT
 *   node game-130/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8130), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8130';
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
    }, nostorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !/\.mp3/.test(r.url())) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
    await page.goto(`${BASE}/game-130/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__ss && __ss.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 20000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => check(true, msg), () => check(false, msg));
const center = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel);
const front = (page) => Q(page, () => __ss.G && __ss.G.queue[0] ? JSON.stringify(__ss.G.queue[0]) : null);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const c = document.getElementById('view').getBoundingClientRect();
    const vv = window.visualViewport;
    const W = vv ? vv.width : innerWidth, H = vv ? vv.height : innerHeight;
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        inside: c.left >= -1 && c.top >= -1 && c.right <= W + 1 && c.bottom <= H + 1 && c.width > 200,
        ratio: Math.abs(c.width / c.height - 16 / 9) < 0.02,
    };
});
const onScreen = (page, sels) => Q(page, (ss) => ss.map((s) => {
    const e = document.querySelector(s);
    if (!e) return { s, ok: false, why: 'missing' };
    const r = e.getBoundingClientRect();
    return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, why: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` };
}), sels);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================================================== desktop
async function desktop() {
    console.log('\n== desktop 1280×720');
    const page = await open({ width: 1280, height: 720 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await shot(page, 'desktop-title');

    let c = await center(page, '#title-menu [data-act="new"]');
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.mode === 'play' && !document.getElementById('talk').hidden, 'a click on New Game starts the day with Captain Ada talking');
    check(await Q(page, () => document.getElementById('talk-name').textContent === 'Captain Ada Comet'), 'the dialogue box names Captain Ada');
    const L = await layout(page);
    check(L.noHScroll && L.inside && L.ratio, 'the picture fits the window at 16:9, no sideways scroll');
    const below = await Q(page, () => document.getElementById('talk').getBoundingClientRect().top >= document.getElementById('view').getBoundingClientRect().bottom - 1);
    check(below, 'on a desktop the dialogue sits under the picture, not over it');
    await shot(page, 'desktop-ada');

    // Space on the focused ▶ button advances (a keydown that cancelled Space would break this)
    const f0 = await front(page);
    await page.waitForTimeout(300);     // a line can't be skipped in its first quarter second
    await page.keyboard.press('Space');
    await until(page, (f) => JSON.stringify(__ss.G.queue[0]) !== f, 'Space advances the line', 5000, f0);
    for (let i = 0; i < 6 && (await front(page)); i++) { await page.waitForTimeout(280); await page.keyboard.press('Enter'); }
    await until(page, () => !__ss.G.queue.length, 'Enter clicks through the rest of the briefing');

    // the map
    await page.keyboard.press('KeyM');
    await until(page, () => __ss.map === true, 'M opens the station map');
    if (!(await Q(page, () => __ss.map))) console.log('    state:', await Q(page, () => JSON.stringify({ q: __ss.G.queue[0], stack: __ss.ui.stack, active: document.activeElement.id, mode: __ss.mode })));
    c = await Q(page, () => __ss.targetAt('map:dock'));
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.G.room === 'dock' && !__ss.map, 'a click on the Docking Bay goes there');

    // the toolbar: rooms left and right
    await until(page, () => !document.getElementById('bar').hidden && document.getElementById('nav-here').textContent.includes('Docking Bay'), 'the toolbar says which room Kit is in');
    const bar = await Q(page, () => {
        const v = document.getElementById('view').getBoundingClientRect(), b = document.getElementById('bar').getBoundingClientRect(), j = document.getElementById('jobs').getBoundingClientRect();
        return { under: b.top >= v.bottom - 1, jobs: !document.getElementById('jobs').hidden && j.top >= b.bottom - 1, inside: b.bottom <= innerHeight };
    });
    check(bar.under && bar.inside, 'the toolbar sits right under the picture');
    check(bar.jobs, 'today\'s jobs show under the toolbar while nobody is talking');
    c = await center(page, '#nav-prev');
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.G.room === 'observatory', 'a click on ◀ walks Kit out of the left side into the Observatory');
    check(await Q(page, () => __ss.G.kit.x > 500), 'and he comes in on the right-hand side');
    await until(page, () => document.getElementById('nav-next').classList.contains('way'), '▶ glows: the Docking Bay, where the next job is, is that way');
    await until(page, () => !!__ss.targetAt('exit:1'), 'the room has a door arrow at its right edge');
    c = await Q(page, () => __ss.targetAt('exit:1'));
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.G.room === 'dock', 'a click on the arrow at the edge of the picture walks through to the Docking Bay');
    await page.keyboard.press('KeyQ');
    await until(page, () => __ss.G.room === 'observatory', 'Q goes to the room on the left');
    await page.keyboard.press('KeyE');
    await until(page, () => __ss.G.room === 'dock', 'E goes to the room on the right');

    // the visitor
    await until(page, () => !!__ss.targetAt('spot:visitor'), 'Zorp is a target in the Docking Bay');
    c = await Q(page, () => __ss.targetAt('spot:visitor'));
    await page.mouse.move(c.x, c.y);
    await until(page, () => !document.getElementById('label').hidden && document.getElementById('label').textContent === 'Zorp', 'hovering him shows his name');
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.G.queue[0]?.say === 'zorp.hello', 'a click on Zorp walks Kit over and he says hello');
    while (!(await Q(page, () => !!__ss.G.queue[0]?.ask))) { await page.waitForTimeout(280); await page.keyboard.press('Enter'); }
    await until(page, () => !document.getElementById('quiz').hidden && document.querySelectorAll('#quiz-answers .ans:not(:disabled)').length === 3, 'the quiz shows the question and three answers');
    await shot(page, 'desktop-quiz');
    const okI = await Q(page, () => __ss.rightAnswer());
    const wrongKey = ['Digit1', 'Digit2', 'Digit3'][(okI + 1) % 3];
    const st0 = await Q(page, () => __ss.G.stickers);
    await page.keyboard.press(wrongKey);
    await until(page, () => __ss.G.queue[0]?.say === 'zorp.wrong', 'a wrong answer (key) gets "not quite"');
    await page.waitForTimeout(280); await page.keyboard.press('Enter');
    await until(page, (i) => document.querySelectorAll('#quiz-answers .ans')[i].disabled, 'and greys out that answer', 5000, (okI + 1) % 3);
    await page.keyboard.press(['Digit1', 'Digit2', 'Digit3'][okI]);
    await until(page, (s) => __ss.G.stickers === s + 1 && __ss.G.queue[0]?.say === 'zorp.right', 'the right answer earns a sticker and a cheer', 5000, st0);

    // pause, and Escape out of Settings with a slider focused
    await Q(page, () => { while (__ss.G.queue[0]?.say) __ss.next(); });
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __ss.G.t);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __ss.G.t === t, t0), 'the sim stops while paused');
    c = await center(page, '#pause-menu [data-act="settings"]');
    await page.mouse.click(c.x, c.y);
    await until(page, () => !document.getElementById('settings').hidden && document.activeElement?.id === 'set-voice', 'Settings opens with the voice slider focused');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with the slider focused');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'Escape again resumes');

    // the wire puzzle, solved with real clicks
    await Q(page, () => __ss.until((G) => G.puzzle?.kind === 'wires' && !!G.queue[0]?.puzzle));
    await until(page, () => !document.getElementById('pz-bar').hidden, 'the wire puzzle shows its instruction');
    for (let k = 0; k < 4; k++) {
        const pair = await Q(page, () => { const p = __ss.G.puzzle; const l = p.links.findIndex((x) => x === null); return { l, r: p.right.indexOf(p.left[l]) }; });
        let a = await Q(page, (l) => __ss.targetAt('wl' + l), pair.l);
        await page.mouse.click(a.x, a.y);
        a = await Q(page, (r) => __ss.targetAt('wr' + r), pair.r);
        await page.mouse.click(a.x, a.y);
        await page.waitForTimeout(60);
    }
    await until(page, () => __ss.G.fixed.garden, 'four clicked wires fix the Star Garden lights');
    await shot(page, 'desktop-fixed');

    // the Notebook
    await Q(page, () => __ss.until((G) => G.clues.includes('goo') && !G.queue.length));
    // the backpack
    await until(page, () => !!document.querySelector('#bag .slot[data-id="goo"]:not(.empty)'), 'the glowing goo is in the backpack on the toolbar');
    c = await center(page, '#bag .slot[data-id="goo"]');
    await page.mouse.click(c.x, c.y);
    await until(page, () => !document.getElementById('bag-pop').hidden && document.getElementById('bag-pop-name').textContent === 'Glowing goo', 'a click on it shows what it is');
    c = await center(page, '#bag-pop-say');
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.audio.voiceId === 'orby.clue.goo', '🔊 replays Orby telling about it');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('bag-pop').hidden && document.getElementById('pause').hidden, 'Escape puts it away (and doesn\'t pause)');
    await page.keyboard.press('KeyN');
    await until(page, () => !document.getElementById('notebook').hidden && document.getElementById('nb-clues').textContent.includes('Glowing goo'), 'N opens the Notebook with the glowing goo in it');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('notebook').hidden, 'Escape closes it');

    // save and continue
    await Q(page, () => __ss.until((G) => G.day === 2 && !G.queue.length));
    const st = await Q(page, () => __ss.G.stickers);
    await Q(page, () => document.getElementById('btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    c = await center(page, '#pause-menu [data-act="quit"]');
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    c = await center(page, '#btn-continue');
    await page.mouse.click(c.x, c.y);
    await until(page, (s) => __ss.mode === 'play' && __ss.G.day === 2 && __ss.G.stickers === s, 'Continue restores day 2 and the stickers', 10000, st);

    // the rest of the game
    await Q(page, () => __ss.until((G) => G.over));
    await until(page, () => !document.getElementById('end').hidden, 'the game ends with the Station Keeper certificate');
    await shot(page, 'desktop-end');
    check(await Q(page, () => !__ss.hasSave()), 'the finished game clears its save');

    // sound
    const snd = await Q(page, () => ({ state: __ss.audio.ctx?.state, buffers: Object.keys(__ss.audio.buffers), playing: __ss.audio.musicPlaying(), theme: __ss.audio.theme }));
    check(snd.state === 'running', `the audio context runs (${snd.state})`);
    check(snd.buffers.filter((b) => b.startsWith('sfx-')).length >= 10, `the ElevenLabs effects decode (${snd.buffers.filter((b) => b.startsWith('sfx-')).length})`);
    check(snd.buffers.some((b) => b.startsWith('vo-')), 'voice clips decode');
    check(snd.theme === 'ending' && snd.playing, `the ending theme is playing (${snd.theme}, ${snd.playing})`);

    c = await center(page, '#end-again');
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.mode === 'play' && __ss.G.day === 1 && !__ss.G.over, 'Play Again starts a new game');
    reportErrors('desktop');
}

// ======================================================================================================== phones
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touchAt = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const tapSel = async (sel) => { const r = await center(page, sel); if (!r) return false; await touchAt(r.x, r.y); return true; };
    const tapTarget = async (key) => {
        await page.waitForFunction((k) => !!__ss.targetAt(k), key, { timeout: 10000 }).catch(() => {});
        const r = await Q(page, (k) => __ss.targetAt(k), key);
        if (!r) return false;
        await touchAt(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play' && !document.getElementById('talk').hidden, 'a tap on New Game starts play');
    const L = await layout(page);
    check(L.noHScroll && L.inside, 'no sideways scroll; the picture is inside the viewport');
    const talkOk = await Q(page, () => { const r = document.getElementById('talk').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; });
    check(talkOk, 'the dialogue box is on screen');
    for (const z of await onScreen(page, ['#talk-next', '#talk-again', '#btn-hint', '#btn-map', '#btn-notebook', '#btn-pause', '#btn-jobs'])) check(z.ok, `${z.s} is at least 44 px and on screen (${z.why})`);
    await shot(page, `phone-${w}x${h}-ada`);

    const talkBar = await Q(page, () => { const t = document.getElementById('talk').getBoundingClientRect(), b = document.getElementById('bar').getBoundingClientRect(); return t.bottom <= b.top + 1 || t.top >= b.bottom - 1; });
    check(talkBar, 'the dialogue box doesn\'t cover the toolbar');
    const f0 = await front(page);
    await page.waitForTimeout(300);     // a line can't be skipped in its first quarter second
    await tapSel('#talk-next');
    await until(page, (f) => JSON.stringify(__ss.G.queue[0]) !== f, 'tapping ▶ advances the line', 5000, f0);
    for (let i = 0; i < 8 && (await front(page)); i++) { await page.waitForTimeout(280); await tapSel('#talk-text'); }
    await until(page, () => !__ss.G.queue.length, 'tapping the dialogue box clicks through the briefing');

    const narrow = await Q(page, () => !document.body.classList.contains('below'));
    const tb = ['#nav-prev', '#nav-next', '#btn-jobs', '#btn-hint', '#btn-map', '#btn-notebook', '#btn-pause', narrow ? '#btn-bag' : '#bag .slot'];
    for (const z of await onScreen(page, tb)) check(z.ok, `toolbar ${z.s} is at least 44 px and on screen (${z.why})`);
    await shot(page, `phone-${w}x${h}-toolbar`);
    await tapSel('#nav-next');
    await until(page, () => __ss.G.room === 'observatory', 'tapping ▶ walks to the Observatory');
    await tapTarget('exit:-1');
    await until(page, () => __ss.G.room === 'deck', 'tapping the arrow at the left edge walks back to the Command Deck');
    if (narrow) {
        await tapSel('#btn-bag');
        await until(page, () => !document.getElementById('bag-pop').hidden && document.querySelectorAll('#bag-pop-items .slot').length === 6, 'on a short phone 🎒 opens the backpack with its six clue slots');
        await shot(page, `phone-${w}x${h}-bag`);
        await tapSel('#bag-pop-close');
        await until(page, () => document.getElementById('bag-pop').hidden, '✕ puts it away');
    }
    await tapSel('#btn-map');
    await until(page, () => __ss.map, 'tapping 🗺️ opens the map');
    await tapTarget('map:dock');
    await until(page, () => __ss.G.room === 'dock', 'tapping the Docking Bay on the map goes there');
    await tapTarget('spot:visitor');
    await until(page, () => __ss.G.queue[0]?.say === 'zorp.hello', 'tapping Zorp starts his visit');
    for (let i = 0; i < 6 && !(await Q(page, () => !!__ss.G.queue[0]?.ask)); i++) { await page.waitForTimeout(280); await tapSel('#talk-next'); }
    await until(page, () => !document.getElementById('quiz').hidden && document.getElementById('talk').hidden, 'the quiz replaces the dialogue box');
    await page.waitForTimeout(450);
    for (const z of await onScreen(page, ['#quiz-answers .a0', '#quiz-answers .a1', '#quiz-answers .a2'])) check(z.ok, `answer ${z.s} is at least 44 px and on screen (${z.why})`);
    await shot(page, `phone-${w}x${h}-quiz`);
    const okI = await Q(page, () => __ss.rightAnswer());
    await tapSel(`#quiz-answers .a${okI}`);
    if (!(await until(page, () => __ss.G.queue[0]?.say === 'zorp.right' && __ss.G.facts.length === 1, 'tapping the right answer counts'))) {
        console.log('    state:', okI, await Q(page, () => JSON.stringify({ q: __ss.G.queue.slice(0, 3), facts: __ss.G.facts, wrong: __ss.G.wrong, seen: __ss.seen })));
    }

    // the hint button and pause stay put when the finger lifts
    await Q(page, () => { while (__ss.G.queue[0] && !__ss.G.queue[0].ask) __ss.next(); });
    await Q(page, () => __ss.until((G) => G.done.greet && !G.queue.length));
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await Q(page, () => { while (__ss.G.queue[0]?.say) __ss.next(); });   // a spooky moment may have started meanwhile
    await page.waitForTimeout(100);
    await tapSel('#btn-hint');
    await until(page, () => /^orby\.hint/.test(__ss.G.queue[0]?.say || ''), 'tapping 🤖 gets Orby\'s hint');
    await shot(page, `phone-${w}x${h}-hint`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================================================== nostorage
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 720 }, { nostorage: true });
    const c = await center(page, '#title-menu [data-act="new"]');
    await page.mouse.click(c.x, c.y);
    await until(page, () => __ss.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __ss.ff(60));
    check(await Q(page, () => __ss.G.day >= 1 && __ss.save() === false), 'it plays on, and saving fails quietly');
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
