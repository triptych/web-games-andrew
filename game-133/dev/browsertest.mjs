/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): the title with no errors and the ← Games link on top → New Game: name and gender by real
 *   typing and clicks → the prologue advances with real Enter/Space, a choice with a real digit key → Escape opens
 *   the menu and closes it, and closes Settings even with a slider focused → the desk: a petitioner called and
 *   graded by click, the job assigned through the party picker → every mini-game played through its real buttons
 *   and keys → a visit plays a scene → End the Day → Save & Quit → Continue restores the day → the Handbook → the
 *   bot plays to the raid, the raid is sent by click → the ending screen and the album → every picture and every
 *   sound file loads and decodes; music is playing.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through New Game, the story, a choice, the
 *   desk, a petition and a mini-game; controls ≥ 44 px and on screen; no sideways scroll; nothing under the back link.
 * nostorage: localStorage throws; the game still boots, plays a day and reaches an ending.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8133          # from the REPO ROOT
 *   node game-133/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8133), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8133';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, errors = [], browser = null;

async function open(viewport, { touch = false, nostorage = false } = {}) {
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`http ${r.status()}: ${r.url()}`); });
    await page.goto(`${BASE}/game-133/index.html?debug=1&fast=8`);
    await page.waitForFunction(() => window.__lh && __lh.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `bt-${name}.png`) });
const until = (page, fn, msg, timeout = 20000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => page.click(sel, { timeout: 8000 }).then(() => true, (e) => { console.log('    click failed', sel, e.message.split('\n')[0]); return false; });
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const noHScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('app').getBoundingClientRect().width <= innerWidth + 1);
/** Every visible button on the top screen (or the desk) is finger-sized, on screen and not under the back link. */
const controlsOk = (page) => Q(page, () => {
    const back = document.getElementById('back-link').getBoundingClientRect();
    const top = __lh.ui.top();
    const root = top ? document.getElementById(top) : document.getElementById('app');
    const bad = [];
    for (const b of root.querySelectorAll('button, select, input')) {
        const r = b.getBoundingClientRect();
        if (!r.width || b.closest('[hidden]')) continue;
        const scroller = b.closest('.sheet, #tab-body');
        const view = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight };
        if (r.bottom < view.top + 4 || r.top > view.bottom - 4) continue;            // scrolled out of its sheet: fine
        if (r.width < 43.5 || r.height < 43.5) bad.push(`${b.id || b.textContent.trim().slice(0, 20)} is ${Math.round(r.width)}×${Math.round(r.height)}`);
        if (r.left < -1 || r.right > innerWidth + 1) bad.push(`${b.id || b.textContent.trim().slice(0, 20)} runs off the side`);
        if (r.left < back.right && r.top < back.bottom && r.right > back.left && r.bottom > back.top) bad.push(`${b.id || b.textContent.trim().slice(0, 20)} is under the back link`);
    }
    return bad;
});
const grade = (page) => Q(page, () => {
    // read the petition as a player would: from the words on the page
    const text = document.getElementById('pet-text').textContent;
    return import('./js/sim/petition.js').then((m) => m.readPetition(text).rank);
});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden && document.getElementById('btn-continue').hidden), 'the title is up, with no Continue yet');
    check(await noHScroll(page), 'no sideways scroll');
    await shot(page, 'desktop-title');

    // a new game: name and gender
    await click(page, '#title-menu [data-act="new"]');
    await page.fill('#ng-name', '');
    await page.type('#ng-name', 'Wren');
    await click(page, '#ng-gender [data-g="f"]');
    await click(page, '#ng-go');
    await until(page, () => __lh.mode === 'game' && __lh.G.scene?.id === 'prologue', 'New Game opens the prologue');
    check(await Q(page, () => __lh.G.name === 'Wren' && __lh.G.gender === 'f'), 'with the name typed and the gender chosen');
    check(await Q(page, () => getComputedStyle(document.querySelector('#bg .pic.on') || document.body).backgroundImage.includes('art/bg/')), 'a painted backdrop is on stage');

    // real keys move the story
    const pc0 = await Q(page, () => __lh.G.scene.pc);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await until(page, (p) => __lh.G.scene.pc > p, 'Enter advances the story', 20000, pc0);
    for (let i = 0; i < 60 && !(await Q(page, () => !!__lh.G.scene?.cur?.choice)); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(30); }
    check(await Q(page, () => !!__lh.G.scene?.cur?.choice && document.querySelectorAll('#dlg-choices button').length === 3), 'Space reaches the first choice, shown as three answers');
    check(await Q(page, () => /Wren/.test(__lh.vn.log.map((l) => l.text).join(' ')) && __lh.vn.log.some((l) => /Let her breathe/.test(l.text))), 'the script uses her name and "her"');
    check(await Q(page, () => [...document.querySelectorAll('#actors img')].every((im) => im.complete && im.naturalWidth > 0) && document.querySelectorAll('#actors img').length >= 1), 'portraits are on stage and loaded');
    await shot(page, 'desktop-choice');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    check(await Q(page, () => !!__lh.G.scene?.cur?.choice), 'Enter does not skip past a choice');
    await page.keyboard.press('Digit2');
    await until(page, () => __lh.G.flags.why_story === true, 'the 2 key picks the second answer');

    // Escape: the menu, and a sheet with a slider focused
    await page.keyboard.press('Escape');
    await until(page, () => __lh.ui.top() === 'menu', 'Escape opens the menu');
    await click(page, '#menu-menu [data-act="settings"]');
    await page.focus('#set-music');
    await page.keyboard.press('Escape');
    await until(page, () => __lh.ui.top() === 'menu', 'Escape closes Settings even with a slider focused');
    await page.focus('#menu-menu [data-act="resume"]');
    await page.keyboard.press('Space');
    await until(page, () => !__lh.ui.anyScreen(), 'Space presses the focused Resume button');
    const pc1 = await Q(page, () => __lh.G.scene.pc);
    await page.waitForTimeout(400);
    check(await Q(page, (p) => __lh.G.scene.pc === p, pc1), 'the key that closed the menu did not also advance the story');

    // skip to the desk
    await click(page, '[data-vn="skip"]');
    await until(page, () => !__lh.G.scene && !document.getElementById('panel').hidden, 'Skip plays the rest of the prologue and the desk appears', 30000);
    check(await Q(page, () => __lh.G.flags.met_bram && __lh.G.queue.length === 2), 'two petitioners are waiting');
    await shot(page, 'desktop-desk');

    // a petition, graded from its words
    await click(page, '#btn-call');
    await until(page, () => __lh.ui.top() === 'petition' && !!__lh.G.pet, 'Next, please brings a petitioner to the desk');
    check(await Q(page, () => { const f = document.querySelector('#petition .face'); return /art\/giv\//.test(f.style.backgroundImage); }), 'with a painted face');
    await shot(page, 'desktop-petition');
    const r = await grade(page);
    check(await Q(page, (x) => x === __lh.G.pet.rank, r), 'the words on the page give the true rank');
    await click(page, `[data-grade="${r}"]`);
    await until(page, () => !__lh.G.pet && __lh.G.board.length === 1 && __lh.G.merit === 1, 'grading it posts the job and earns merit');
    check(await Q(page, () => __lh.audio.played.stamp >= 1), 'the stamp is heard');

    // assign through the party picker
    await click(page, '#tabs [data-tab="board"]');
    await click(page, '[data-ui="assign"]');
    await until(page, () => __lh.ui.top() === 'party', 'Assign opens the party picker');
    check(await Q(page, () => document.getElementById('party-go').disabled), 'nothing can be sent until someone is picked');
    await click(page, '[data-ui="pick"][data-arg="kael"]');
    await click(page, '[data-ui="pick"][data-arg="pip"]');
    check(await Q(page, () => /%/.test(document.getElementById('party-odds').textContent)), 'the odds are shown');
    await shot(page, 'desktop-party');
    await click(page, '#party-go');
    await until(page, () => __lh.G.out.length === 1 && __lh.G.advs.find((a) => a.id === 'kael').state === 'away' && !__lh.ui.anyScreen(), 'Send them puts the party on the road');

    // the mini-games, through their own buttons and keys
    await Q(page, () => { __lh.G.ap = 9; __lh.G.gold = 200; __lh.ui.refresh(__lh.G); });
    await click(page, '#tabs [data-tab="guild"]');
    await click(page, '[data-game="stamp"]');
    await until(page, () => __lh.G.mg?.game === 'stamp' && __lh.ui.top() === 'mg', 'Stamp Rush opens');
    const t0 = await Q(page, () => __lh.G.mg.time);
    await until(page, (t) => __lh.G.mg.time < t - 1, 'its sand-glass runs', 20000, t0);
    for (let i = 0; i < 8 && !(await Q(page, () => __lh.G.mg.done)); i++) {
        const ok = await Q(page, () => import('./js/sim/minigames.js').then((m) => m.formValid(__lh.G.mg.forms[__lh.G.mg.i])));
        if (i % 2) await page.keyboard.press(ok ? 'KeyY' : 'KeyN'); else await click(page, ok ? '#mg-ok' : '#mg-no');
    }
    await until(page, () => __lh.G.mg?.done && __lh.G.mg.right === 8, 'eight forms filed right, by button and by key');
    await shot(page, 'desktop-mg-result');
    await click(page, '#mg-close');
    await until(page, () => !__lh.G.mg && !__lh.ui.anyScreen(), 'Back to the desk closes it');

    await click(page, '[data-game="brew"]');
    await until(page, () => __lh.G.mg?.game === 'brew' && !__lh.ui.mini.showing, 'the Cauldron shows its recipe, then waits for you', 30000);
    for (let n = 0; n < 12 && !(await Q(page, () => __lh.G.mg.done)); n++) {
        await until(page, () => __lh.G.mg.done || !__lh.ui.mini.showing, 'recipe shown', 30000);
        if (await Q(page, () => __lh.G.mg.done)) break;
        const a = await Q(page, () => __lh.G.mg.seq[__lh.G.mg.pos]);
        await click(page, `[data-pot="${a}"]`);
    }
    await until(page, () => __lh.G.mg?.done && __lh.G.mg.made === 3, 'three recipes remembered, three draughts bottled');
    await click(page, '#mg-close');

    await click(page, '[data-game="route"]');
    await until(page, () => __lh.G.mg?.game === 'route', 'Cartography opens');
    const path_ = await Q(page, () => import('./js/sim/minigames.js').then((m) => m.routeSolve(__lh.G.mg).path));
    const KEY = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' };
    for (const d of path_) await page.keyboard.press(KEY[d]);
    await until(page, () => __lh.G.mg?.done && __lh.G.charts === 2, 'the arrow keys walk the best road: two charts');
    await click(page, '#mg-close');

    await click(page, '[data-game="dice"]');
    await until(page, () => __lh.G.mg?.game === 'dice' && __lh.G.gold === 190 + 16, 'Dragon\'s Hoard takes the stake');
    for (let i = 0; i < 40 && !(await Q(page, () => __lh.G.mg.done)); i++) await click(page, (await Q(page, () => __lh.G.mg.pot >= 12)) ? '#mg-bank' : '#mg-roll');
    await until(page, () => __lh.G.mg?.done, 'three rounds of dice play out');
    await click(page, '#mg-close');

    await page.selectOption('#spar-who', 'tamsin');
    await click(page, '[data-game="spar"]');
    await until(page, () => __lh.G.mg?.game === 'spar' && __lh.G.mg.adv === 'tamsin', 'the Sparring Ring opens with the adventurer chosen');
    for (let i = 0; i < 5; i++) {
        // read the tell from the page, look it up as the Handbook says
        const a = await Q(page, () => import('./js/sim/minigames.js').then((m) => { const t = document.getElementById('spar-tell').textContent; const them = Object.keys(m.TELLS).find((k) => m.TELLS[k].includes(t)); return Object.keys(m.BEATS).find((k) => m.BEATS[k] === them); }));
        await click(page, `#mg-body [data-cmd*='"${a}"']`);
    }
    await until(page, () => __lh.G.mg?.done && __lh.G.mg.wins === 5, 'five tells read from the page, five exchanges won');
    await click(page, '#mg-close');

    // a visit
    await click(page, '[data-visit="bram"]');
    await until(page, () => /^(talk_bram|bram_h1)$/.test(__lh.G.scene?.id || ''), 'a visit plays a scene with Bram');
    await until(page, () => (__lh.audio.voiceKey || '').startsWith('bram-') && __lh.audio.speaking, 'and his greeting is spoken aloud');
    await shot(page, 'desktop-visit');
    await Q(page, () => __lh.skip());

    // end the day, save, quit, continue
    await Q(page, () => { __lh.G.ap = 0; __lh.G.queue.length = 0; __lh.ui.refresh(__lh.G); });
    await click(page, '#btn-endday');
    await until(page, () => __lh.G.day === 2, 'End the Day moves to day 2');
    await Q(page, () => __lh.skip());
    const snap = await Q(page, () => ({ day: __lh.G.day, gold: __lh.G.gold, merit: __lh.G.merit, board: __lh.G.board.length }));
    await page.keyboard.press('Escape');
    await click(page, '#menu-menu [data-act="quit"]');
    await until(page, () => __lh.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title, with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __lh.mode === 'game' && __lh.G.day === s.day && __lh.G.gold === s.gold && __lh.G.merit === s.merit && __lh.G.name === 'Wren', 'Continue restores the day, the gold, the merit and the name', 20000, snap);

    // the Handbook
    await page.keyboard.press('KeyH');
    await until(page, () => __lh.ui.top() === 'handbook' && /giant rats/.test(document.getElementById('handbook-body').textContent), 'H opens the Handbook, with the creature tables');
    await page.keyboard.press('Escape');

    // the bot plays on through the real command path to the raid
    await Q(page, () => __lh.ff(28));
    await Q(page, () => __lh.skip());
    await until(page, () => __lh.G.day === 28 && __lh.G.phase === 'raid' && !!document.getElementById('raid-go'), 'the bot plays to day 28, and the raid panel is up', 60000);
    check(await Q(page, () => __lh.G.rank >= 3 && __lh.seen.promoted >= 3 && __lh.seen.report >= 20), 'promotions and reports happened on the way');
    await shot(page, 'desktop-raid');
    for (const id of await Q(page, () => __lh.G.advs.filter((a) => a.state === 'ready').sort((a, b) => b.rank - a.rank).slice(0, 5).map((a) => a.id))) await click(page, `[data-ui="raidpick"][data-arg="${id}"]`);
    check(await Q(page, () => +document.getElementById('raid-total').textContent > 0), 'picking a party shows its strength');
    await click(page, '#raid-go');
    await until(page, () => __lh.G.scene?.id === 'raid_result', 'Send them down plays the descent');
    await Q(page, () => { __lh.skip(); __lh.ff(); });
    await until(page, () => __lh.mode === 'ending' && !document.getElementById('ending').hidden, 'the bot plays to an ending, and the ending screen is up', 60000);
    const end = await Q(page, () => ({ id: __lh.G.ending.id, name: document.getElementById('ending-name').textContent, n: __lh.album().endings.length }));
    check(end.name.length > 3 && end.n === 1, `the ending is named ("${end.name}") and kept in the album`);
    await shot(page, 'desktop-ending');
    await click(page, '#ending-album');
    await until(page, () => __lh.ui.top() === 'album' && document.querySelectorAll('#album-body .e').length === 16 && document.querySelectorAll('#album-body .e.locked').length === 15, 'the album shows sixteen endings, one found');
    await shot(page, 'desktop-album');
    await page.keyboard.press('Escape');
    await click(page, '#ending-again');
    await until(page, () => __lh.mode === 'title' && document.getElementById('btn-continue').hidden, 'Back to Title: a finished game leaves no Continue');

    // every file the game can ask for exists and decodes
    const media = await Q(page, async () => {
        const [{ PLACES, CAST }, { MUSIC, SFX }, { ROSTER }, { VOICED }] = await Promise.all([import('./js/sim/data/cast.js'), import('./js/sim/data/media.js'), import('./js/sim/data/adventurers.js'), import('./js/voices.js')]);
        const imgs = ['art/title.webp', ...Object.keys(PLACES).map((p) => `art/bg/${p}.webp`), ...[...__lh.CG_FILES].map((c) => `art/cg/${c}.webp`),
            ...Object.keys(CAST).flatMap((c) => ['neutral', 'happy', 'sad', 'angry'].map((e) => `art/por/${c}-${e}.webp`)),
            ...ROSTER.filter((a) => !a.face).map((a) => `art/por/adv-${a.id}.webp`), ...['folk', 'adv', 'crown', 'wild'].flatMap((t) => [0, 1, 2, 3, 4, 5].map((i) => `art/giv/${t}-${i}.webp`))];
        const bad = [];
        await Promise.all(imgs.map((src) => new Promise((res) => { const im = new Image(); im.onload = () => { if (!im.naturalWidth) bad.push(src); res(); }; im.onerror = () => { bad.push(src); res(); }; im.src = src; })));
        const ctx = __lh.audio.ctx;
        const sounds = [...Object.keys(MUSIC).map((m) => `audio/music/${m}.mp3`), ...Object.keys(SFX).map((s) => `audio/sfx/${s}.mp3`), ...[...VOICED].map((v) => `audio/vo/${v}.mp3`)];
        await Promise.all(sounds.map(async (src) => { try { const b = await ctx.decodeAudioData(await (await fetch(src)).arrayBuffer()); if (!(b.duration > 0.1)) bad.push(src); } catch { bad.push(src); } }));
        return { imgs: imgs.length, sounds: sounds.length, bad, sfx: Object.keys(__lh.audio.buffers).length, playing: __lh.audio.playing, voiced: VOICED.size };
    });
    check(media.bad.length === 0, `${media.imgs} pictures load and ${media.sounds} sound files decode${media.bad.length ? ': ' + media.bad.slice(0, 6).join(', ') : ''}`);
    check(media.sfx >= 18, `the effects are decoded into buffers (${media.sfx})`);
    check(media.playing, 'a music track is playing');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tap = async (sel) => {
        const r = await Q(page, (s) => {
            const e = document.querySelector(s);
            if (!e) return null;
            e.scrollIntoView({ block: 'center' });
            for (let n = e; n; n = n.parentElement) n.getAnimations?.().forEach((a) => a.finish());
            const b = e.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }, sel);
        if (!r) { console.log('    no element', sel); return false; }
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    const controls = async (label) => { const bad = await controlsOk(page); check(bad.length === 0, `${label}: controls are finger-sized, on screen and clear of the back link${bad.length ? ' — ' + bad.slice(0, 4).join('; ') : ''}`); };

    check(await backLinkOk(page), '← Games link is on top');
    await controls('title');
    await tap('#title-menu [data-act="new"]');
    await until(page, () => __lh.ui.top() === 'newgame', 'a tap opens New Game');
    await page.waitForTimeout(350);
    check(await Q(page, () => __lh.ui.top() === 'newgame'), 'and it stays open after the finger lifts');
    await controls('new game');
    await tap('#ng-gender [data-g="m"]');
    await tap('#ng-go');
    await until(page, () => __lh.mode === 'game' && __lh.G.scene?.id === 'prologue' && __lh.G.gender === 'm', 'taps start a game as a man');
    check(await noHScroll(page), 'no sideways scroll');
    const pc0 = await Q(page, () => __lh.G.scene.pc);
    await tap('#dlg .box'); await page.waitForTimeout(80); await tap('#dlg .box');
    await until(page, (p) => __lh.G.scene.pc > p, 'tapping the text box advances the story', 20000, pc0);
    for (let i = 0; i < 70 && !(await Q(page, () => !!__lh.G.scene?.cur?.choice)); i++) { await tap('#dlg .box'); await page.waitForTimeout(40); }
    await controls('a choice');
    check(await Q(page, () => { const b = document.querySelector('#dlg .box').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.top >= 40; }), 'the whole choice fits on screen');
    await shot(page, `phone-${w}x${h}-choice`);
    await tap('#dlg-choices button:nth-child(1)');
    await until(page, () => __lh.G.flags.why_help === true, 'a tap picks an answer');
    await tap('[data-vn="skip"]');
    await until(page, () => !__lh.G.scene && !document.getElementById('panel').hidden, 'Skip reaches the desk', 30000);
    await controls('the desk');
    check(await noHScroll(page), 'no sideways scroll at the desk');
    check(await Q(page, () => { const hud = document.getElementById('hud').getBoundingClientRect(), p = document.getElementById('tabs').getBoundingClientRect(); return p.top >= hud.bottom - 2; }), 'the tabs sit below the HUD');
    await shot(page, `phone-${w}x${h}-desk`);
    await tap('#btn-call');
    await until(page, () => __lh.ui.top() === 'petition', 'a tap calls a petitioner');
    await controls('the petition');
    await shot(page, `phone-${w}x${h}-petition`);
    const r = await grade(page);
    await tap(`[data-grade="${r}"]`);
    await until(page, () => __lh.G.board.length === 1 && __lh.G.merit === 1, 'a tap grades it right');
    for (const t of ['board', 'roster', 'guild']) { await tap(`#tabs [data-tab="${t}"]`); await until(page, (x) => __lh.ui.tab === x, `the ${t} tab opens`, 8000, t); await controls(`${t} tab`); }
    await tap('[data-game="route"]');
    await until(page, () => __lh.G.mg?.game === 'route', 'a tap opens Cartography');
    await controls('Cartography');
    check(await Q(page, () => { const m = document.querySelector('.map').getBoundingClientRect(); return m.left >= 0 && m.right <= innerWidth; }), 'the map fits the screen');
    await shot(page, `phone-${w}x${h}-route`);
    const p = await Q(page, () => import('./js/sim/minigames.js').then((m) => m.routeSolve(__lh.G.mg).path));
    const LAB = { u: 'Up', d: 'Down', l: 'Left', r: 'Right' };
    for (const d of p) await tap(`.dpad [aria-label="${LAB[d]}"]`);
    await until(page, () => __lh.G.mg?.done && __lh.G.charts === 2, 'the d-pad walks the road');
    await tap('#mg-close');
    await tap('#btn-menu');
    await until(page, () => __lh.ui.top() === 'menu', 'tapping ☰ opens the menu');
    await page.waitForTimeout(350);
    check(await Q(page, () => __lh.ui.top() === 'menu'), 'and it stays open after the finger lifts');
    await controls('menu');
    await tap('#menu-menu [data-act="howto"]');
    await until(page, () => __lh.ui.top() === 'howto', 'How to Play opens on top of the menu');
    check(await Q(page, () => { const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!el.closest('#howto'); }), 'and is the screen under the finger');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await click(page, '#ng-go');
    await until(page, () => __lh.mode === 'game' && !!__lh.G.scene, 'boots and starts a game with localStorage throwing');
    check(await Q(page, () => __lh.save() === false && !__lh.hasSave()), 'saving fails quietly');
    await Q(page, () => { __lh.skip(); __lh.ff(); __lh.skip(); });
    await until(page, () => __lh.mode === 'ending', 'and the bot can still play it to an ending', 60000);
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
