/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): the title and the ← Games link; New Tale → hero choice → the opening scene stepped with real
 *   clicks and skipped; the village: the daily gift, the Market (buy a potion), Escape closes a panel even with focus
 *   inside it, the skill tree (learn a rank); Adventure → the chapter scene stepped with real Enter presses → a battle;
 *   a real mouse drag swaps gems; arrows + Space swap; a skill key; Escape pauses and the sim stops; Resume; a win
 *   shows the result screen and Continue moves on; the chapter is finished and the hero is home with the chapter done;
 *   Settings → Save & return to title → Continue restores the tale; the generated audio decodes and music plays.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the hero choice and the scene,
 *   village controls ≥ 44 px and on screen, no sideways scroll; a patrol: a real touch drag swaps gems, a tapped skill
 *   fires, the ❚❚ button pauses and the pause screen stays up after the finger lifts.
 * nostorage: localStorage throws; the game still boots, plays a fight and can't save.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8128          # from the REPO ROOT
 *   node game-128/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8128), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8128';
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
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.g')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-128/index.html?debug=1&fast=3`);
    await page.waitForFunction(() => window.__gs && __gs.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const shown = (page, id) => Q(page, (i) => !document.getElementById(i).hidden, id);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const noHScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** A legal move on the battle board, as client coordinates of the two gems' centres. */
const findMove = (page) => Q(page, async () => {
    const Bd = await import('./js/sim/board.js');
    const B = __gs.G.battle.board;
    const m = Bd.findMoves(B).filter((x) => !x.special)[0] || Bd.findMoves(B)[0];
    if (!m) return null;
    const L = __gs.view.layout.board, cs = L.s / 8;
    const r = document.getElementById('view').getBoundingClientRect();
    const at = (i) => ({ x: r.left + L.x + (Bd.col(i) + 0.5) * cs, y: r.top + L.y + (Bd.row(i) + 0.5) * cs });
    return { a: at(m.a), b: at(m.b), ia: m.a, ib: m.b };
});
const waitStable = (page) => page.waitForFunction(async () => { const Bd = await import('./js/sim/board.js'); return __gs.G?.battle && Bd.isStable(__gs.G.battle.board) && __gs.G.battle.phase === 'fight'; }, null, { timeout: 30000, polling: 100 }).catch(() => null);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await shown(page, 'title') && await Q(page, () => document.getElementById('btn-continue').hidden), 'title screen up, no Continue without a save');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('heroes').hidden && document.querySelectorAll('.hero-card').length === 4, 'New Tale shows the four heroes');
    await click(page, '.hero-card[data-hero="sela"]');
    await until(page, () => __gs.mode === 'scene' && !document.getElementById('scene').hidden, 'choosing Sela opens the opening scene');
    const line0 = await Q(page, () => __gs.G.scene.i);
    await click(page, '#scene-next'); await click(page, '#scene-next');
    await until(page, (i) => __gs.G.scene && __gs.G.scene.i > i, 'Next steps the dialogue', 10000, line0);
    await click(page, '#scene-skip');
    await until(page, () => __gs.mode === 'village' && !document.getElementById('village').hidden, 'Skip lands in Briarwick');
    await shot(page, 'desktop-village');

    // the daily gift
    const gold0 = await Q(page, () => __gs.G.res.gold);
    await click(page, '#btn-daily');
    await until(page, (g) => __gs.G.res.gold > g && __gs.G.village.daily.streak === 1, 'the daily gift pays and starts a streak', 10000, gold0);
    // the market
    await click(page, '[data-b="market"]');
    await until(page, () => !document.getElementById('panel').hidden && document.querySelector('[data-buy="potion"]'), 'the Market opens with its stock');
    const pots = await Q(page, () => __gs.G.bag.potion || 0);
    await click(page, '[data-buy="potion"]');
    await until(page, (n) => (__gs.G.bag.potion || 0) === n + 1, 'buying a potion puts it in the bag', 10000, pots);
    await Q(page, () => document.querySelector('#panel .btn')?.focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('panel').hidden, 'Escape closes the panel (focus inside it)');
    // the skill tree
    await Q(page, () => { __gs.G.hero.sp = 1; __gs.ui.renderVillage(__gs.G); });
    check(await Q(page, () => { const b = document.getElementById('hero-badge'); return !b.hidden && b.textContent === '1' && getComputedStyle(b).backgroundColor === 'rgb(63, 208, 122)'; }), 'a green 1 on Hero & Skills: a skill point to spend');
    await click(page, '#btn-hero');
    await until(page, () => !!document.querySelector('[data-node="s_weave"]'), 'Hero & Skills shows the tree');
    await click(page, '[data-node="s_weave"]');
    await click(page, '#btn-learn');
    await until(page, () => __gs.G.hero.ranks.s_weave === 1 && __gs.G.hero.sp === 0, 'a skill point learns Spellweave');
    await shot(page, 'desktop-tree');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('hero-badge').hidden, 'and the badge goes once it is spent');

    // the first chapter
    await click(page, '#btn-adventure');
    await until(page, () => !!document.getElementById('btn-story'), 'Adventure shows the next chapter');
    await click(page, '#btn-story');
    await until(page, () => __gs.mode === 'scene', 'Begin chapter opens its scene');
    for (let i = 0; i < 30; i++) {
        if (await Q(page, () => __gs.mode) !== 'scene') break;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(80);
    }
    await until(page, () => __gs.mode === 'battle' && !document.getElementById('bhud').hidden, 'Enter steps through the scene into a battle');
    check(await Q(page, () => document.querySelectorAll('#skills .skill').length === 1), 'the HUD shows Sela\'s first skill');
    await waitStable(page);
    // a real mouse drag
    const swaps0 = await Q(page, () => __gs.G.battle.stats.swaps);
    let mv = await findMove(page);
    await page.mouse.move(mv.a.x, mv.a.y);
    await page.mouse.down();
    await page.mouse.move((mv.a.x + mv.b.x) / 2, (mv.a.y + mv.b.y) / 2, { steps: 3 });
    await page.mouse.move(mv.b.x, mv.b.y, { steps: 3 });
    await page.mouse.up();
    await until(page, (n) => __gs.G.battle.stats.swaps > n, 'a mouse drag swaps two gems', 10000, swaps0);
    await until(page, () => __gs.seen.match >= 1, 'and the swap makes a match');
    // keyboard: move the cursor to the gem, Space, then the arrow toward its partner
    await waitStable(page);
    mv = await findMove(page);
    if (mv) {
        const s1 = await Q(page, () => __gs.G.battle.stats.swaps);
        await Q(page, (i) => { __gs.view.cursor = i; __gs.view.sel = -1; }, mv.ia);
        await page.keyboard.press('Space');
        const dir = mv.ib === mv.ia + 1 ? 'ArrowRight' : mv.ib === mv.ia - 1 ? 'ArrowLeft' : mv.ib > mv.ia ? 'ArrowDown' : 'ArrowUp';
        await page.keyboard.press(dir);
        await until(page, (n) => __gs.G.battle.stats.swaps > n, 'Space then an arrow swaps from the keyboard', 10000, s1);
    }
    // a skill key
    await Q(page, () => { __gs.G.battle.hero.mana.a = 20; });
    const sk = await Q(page, () => __gs.seen.skill || 0);
    await page.keyboard.press('Digit1');
    await until(page, (n) => (__gs.seen.skill || 0) > n, 'key 1 casts Arcane Lance', 10000, sk);
    const dr = await Q(page, () => __gs.view.drawn);
    check(dr.hero > 0 && dr.hero <= 1 && dr.foe > 0 && dr.foe <= 1, `the hero and foe are drawn at or below their art's size, never blown up (${dr.hero.toFixed(2)}, ${dr.foe.toFixed(2)})`);
    await shot(page, 'desktop-battle');
    // pause
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __gs.G.battle.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __gs.G.battle.t === t, t0), 'the battle stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes the pause screen');
    // win the fights of the chapter
    for (let fight = 0; fight < 6; fight++) {
        const mode = await Q(page, () => __gs.mode);
        if (mode === 'village') break;
        if (mode === 'scene') { await Q(page, () => __gs.skipScene()); continue; }
        await Q(page, () => __gs.win());
        await until(page, () => !document.getElementById('result').hidden, `fight ${fight + 1}: the result screen appears`);
        if (fight === 0) await shot(page, 'desktop-result');
        await click(page, '#result-go');
        await page.waitForTimeout(150);
    }
    await Q(page, () => { if (__gs.mode === 'scene') __gs.skipScene(); });
    await until(page, () => __gs.mode === 'village' && __gs.G.story.ch === 1, 'the chapter ends at home with the story moved on');
    // save and continue
    const lv = await Q(page, () => JSON.stringify([__gs.G.story.ch, __gs.G.res.gold, __gs.G.hero.lv]));
    await click(page, '#btn-vsettings');
    await until(page, () => !document.getElementById('settings').hidden, 'the menu button opens Settings');
    await click(page, '#set-title');
    await until(page, () => __gs.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & return to title shows Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __gs.mode === 'village' && JSON.stringify([__gs.G.story.ch, __gs.G.res.gold, __gs.G.hero.lv]) === s, 'Continue restores the tale', 30000, lv);
    // the end of the tale: the ending screen is on top of the village it returns to
    await Q(page, () => {
        __gs.G.story.ch = 9; __gs.G.hero.lv = 19;
        __gs.cmd({ t: 'story' }); __gs.skipScene();
        for (let i = 0; i < 8; i++) {
            if (__gs.mode === 'scene') { __gs.skipScene(); continue; }
            if (__gs.mode !== 'battle') break;
            __gs.win(); __gs.cmd({ t: 'continue' });
        }
        if (__gs.mode === 'scene') __gs.skipScene();
    });
    await until(page, () => __gs.G.story.done && __gs.ui.top() === 'ending', 'the last chapter ends the tale');
    check(await Q(page, () => { const b = document.querySelector('#ending .btn'); const r = b.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b; }), 'and the ending screen is on top, not under the village');
    await shot(page, 'desktop-ending');
    await click(page, '#ending .btn');
    await until(page, () => document.getElementById('ending').hidden && __gs.mode === 'village', 'Back to Briarwick closes it');
    // audio
    await until(page, () => __gs.audio.loaded() >= 50, 'the generated effects and voices decode', 30000);
    await until(page, () => __gs.audio.playing(), 'a music track is playing', 20000);
    check(await noHScroll(page), 'no sideways scroll');
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
    await until(page, () => !document.getElementById('heroes').hidden, 'a tap on New Tale shows the heroes');
    await tapSel('.hero-card[data-hero="odo"]');
    await until(page, () => __gs.mode === 'scene', 'a tap on Brother Odo starts his tale');
    await page.waitForTimeout(250);
    check(await Q(page, () => __gs.G.scene && __gs.G.scene.i === 0), 'the finger that chose the hero doesn\'t also advance the scene');
    await tapSel('#scene-skip');
    await until(page, () => __gs.mode === 'village', 'a tap on Skip lands in the village');
    await shot(page, `phone-village-${w}x${h}`);
    check(await noHScroll(page), 'no sideways scroll in the village');
    const small = await Q(page, () => [...document.querySelectorAll('#village button')].filter((b) => b.getClientRects().length).map((b) => {
        const r = b.getBoundingClientRect();
        return r.width >= 44 && r.height >= 44 && r.left >= -1 && r.right <= innerWidth + 1 ? null : (b.id || b.className) + ` ${Math.round(r.width)}x${Math.round(r.height)}`;
    }).filter(Boolean));
    check(!small.length, `village buttons are at least 44 px and inside the screen (${small.join(', ') || 'all'})`);
    await tapSel('#btn-adventure');
    await until(page, () => !!document.querySelector('[data-patrol="frostfang"]'), 'Adventure lists Odo\'s first region for patrols');
    await tapSel('[data-patrol="frostfang"]');
    await until(page, () => __gs.mode === 'battle' && !document.getElementById('bhud').hidden, 'a tap on Patrol starts a battle');
    await waitStable(page);
    const swaps0 = await Q(page, () => __gs.G.battle.stats.swaps);
    const mv = await findMove(page);
    await touch('touchStart', mv.a.x, mv.a.y);
    for (let i = 1; i <= 4; i++) await touch('touchMove', mv.a.x + (mv.b.x - mv.a.x) * i / 4, mv.a.y + (mv.b.y - mv.a.y) * i / 4);
    await touch('touchEnd', 0, 0);
    await until(page, (n) => __gs.G.battle.stats.swaps > n, 'a touch drag swaps two gems', 10000, swaps0);
    await Q(page, () => { __gs.G.battle.hero.mana.r = 20; });
    const sk = await Q(page, () => __gs.seen.skill || 0);
    await tapSel('#skills .skill');
    await until(page, (n) => (__gs.seen.skill || 0) > n, 'tapping the skill button casts it', 10000, sk);
    const sizes = await Q(page, () => ['#btn-pause', '#skills .skill'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const L = await Q(page, () => { const b = __gs.view.layout.board; return b.x >= 0 && b.y >= 0 && b.x + b.s <= innerWidth && b.y + b.s <= innerHeight; });
    check(L, 'the whole board is on screen');
    await shot(page, `phone-battle-${w}x${h}`);
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await shown(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    check(await noHScroll(page), 'no sideways scroll in battle');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __gs.start(5, 'kael'));
    await until(page, () => __gs.mode === 'village', 'boots into the village with localStorage throwing');
    await Q(page, () => __gs.cmd({ t: 'patrol', region: 'greenmarch' }));
    await Q(page, () => __gs.ff(120));
    await until(page, () => __gs.G.battle && (__gs.G.battle.phase === 'won' || __gs.G.battle.phase === 'lost'), 'and plays a fight to the end');
    check(await Q(page, () => __gs.save() === false), 'saving fails quietly');
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
