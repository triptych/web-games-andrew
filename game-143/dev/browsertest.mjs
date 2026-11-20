/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): title, the ← Games link on top, New Game by click, the intro dialogue advanced with real
 *   keys, a plot built by a real click on the town canvas and the panel's Build button, the tip card's Show me
 *   (the suggested building highlighted, locked ones explained), a harvest bubble collected by a click and by C,
 *   the rising numbers, the What next? window and its Show me, the dock panels, a
 *   delivery, sleeping until morning, the siege: real keys aim and throw, a staff ability by its number key, the
 *   result sheet; Save & Quit → Continue; the King and the Queen → the ending → the epilogue. Sound: the clips
 *   decode and a theme plays. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the dialogue, a tap
 *   on a plot opens it, a building is built by tap, a bubble is collected by tap, the tip card fits, the siege: a tap on the field throws, the ability button
 *   works, controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport, every
 *   panel's Close button stays on screen.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8143          # from the REPO ROOT
 *   node game-143/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8143), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8143';
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('/audio/music-')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-143/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__ds && __ds.mode === 'title' && document.body.classList.contains('art-ready'), null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, id) => Q(page, (i) => !document.getElementById(i).hidden, id);
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
const notBlank = (page) => Q(page, () => {
    const c = document.getElementById('view'), x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += l; sum2 += l * l; n++; }
    const m = sum / n;
    return { mean: Math.round(m), sd: Math.round(Math.sqrt(sum2 / n - m * m)) };
});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    const nb = await notBlank(page);
    check(nb.sd > 10, `the title art is drawn (luminance sd ${nb.sd})`);
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ds.mode === 'play' && !document.getElementById('talk').hidden, 'New Game starts with the election scene');
    // advance the intro with real keys (Enter presses the focused Next button)
    for (let i = 0; i < 14; i++) {
        if (await Q(page, () => document.getElementById('talk').hidden)) break;
        await page.keyboard.press(i % 2 ? 'Enter' : 'Space');
        await page.waitForTimeout(60);
    }
    await until(page, () => document.getElementById('talk').hidden || __ds.ui.talkQ.length < 5, 'real keys move the dialogue along');
    await Q(page, () => { __ds.quiet = true; __ds.ui.talkQ.length = 0; __ds.ui.nextLine(); });
    await until(page, () => document.getElementById('talk').hidden && !document.getElementById('topbar').hidden, 'the town HUD is shown');
    await Q(page, () => __ds.act({ t: 'speed', v: 0 }));

    // build by clicking a plot on the canvas
    const p = await Q(page, () => __ds.view.plotClient(1));
    await page.mouse.click(p.x, p.y);
    await until(page, () => !document.getElementById('panel').hidden && __ds.ui.panel === 'plot:1', 'clicking an empty plot opens its build list');
    await shot(page, 'desktop-build');
    const gold0 = await Q(page, () => __ds.G.res.gold);
    await click(page, '#panel-body button[data-cmd*="mill"]');
    await until(page, (g) => __ds.G.plots[1].b?.kind === 'mill' && __ds.G.res.gold < g, 'the Build button builds a windmill and pays for it', 30000, gold0);
    check(await Q(page, () => document.getElementById('panel').hidden), 'and the sheet closes');

    // the helper: the tip card and Show me
    await until(page, () => !document.getElementById('tip').hidden && document.getElementById('tip-title').textContent.length > 3, 'Lord Vellum\'s tip card says what to do next');
    await Q(page, () => { __ds.ui.tipT = 0; });
    await page.waitForTimeout(150);
    const tip = await Q(page, () => ({ id: __ds.ui.tipGoal?.id, title: document.getElementById('tip-title').textContent }));
    await click(page, '#tip-show');
    if (tip.id?.startsWith('build:')) {
        await until(page, (k) => !document.getElementById('panel').hidden && !!document.querySelector(`#panel-body .card.hint button[data-cmd*="${k}"]`), `Show me opens a free plot with the suggested building highlighted (${tip.title})`, 10000, tip.id.slice(6));
        check(await Q(page, () => !!document.querySelector('#panel-body .card .lock')), 'the build list shows locked buildings and how to unlock them');
        await shot(page, 'desktop-showme');
        await page.keyboard.press('Escape');
        await until(page, () => document.getElementById('panel').hidden, 'Escape closes it', 10000);
    } else {
        await until(page, () => !document.getElementById('panel').hidden || !!__ds.view.pulse, `Show me points at the goal (${tip.title})`);
        await Q(page, () => __ds.ui.closeScreen('panel'));
    }

    // harvest bubbles and the rising numbers
    await Q(page, () => __ds.act({ t: 'speed', v: 3 }));
    if (!await until(page, () => __ds.G.plots[0].b.ripe >= 10 && __ds.view.bub.some((b) => b.i === 0), 'a glowing bubble grows over the cottage', 30000)) {
        console.log('    state', await Q(page, () => JSON.stringify({ ripe: __ds.G.plots[0].b, speed: __ds.G.speed, stack: __ds.ui.stack, bub: __ds.view.bub, t: __ds.G.t })));
    }
    await Q(page, () => __ds.act({ t: 'speed', v: 0 }));
    check(await visible(page, 'btn-collect'), 'the ✨ collect-all button appears');
    await shot(page, 'desktop-bubbles');
    const gold1 = await Q(page, () => __ds.G.res.gold);
    const bp = await Q(page, () => __ds.view.bubbleClient(0));
    await page.mouse.click(bp.x, bp.y);
    await until(page, (g) => (__ds.seen.collect || 0) > 0 && __ds.G.res.gold > g, 'clicking the bubble collects it', 10000, gold1);
    check(await Q(page, () => document.getElementById('panel').hidden), 'and does not open the building under it');
    check(await Q(page, () => __ds.view.floats.some((f) => f.big)), 'a big number rises from it');
    await Q(page, () => __ds.act({ t: 'speed', v: 3 }));
    await until(page, () => __ds.view.floats.some((f) => !f.big), 'working buildings show what they make as small rising numbers', 20000);
    await until(page, () => __ds.G.plots.some((p) => p.b && p.b.ripe >= 10), 'another bubble ripens', 30000);
    await Q(page, () => __ds.act({ t: 'speed', v: 0 }));
    await shot(page, 'desktop-floaters');
    const c0 = await Q(page, () => __ds.seen.collect || 0);
    await page.keyboard.press('KeyC');
    await until(page, (n) => (__ds.seen.collect || 0) > n, 'C collects every bubble', 10000, c0);

    // the What next window
    await click(page, '[data-sheet="whatnext"]');
    await until(page, () => document.getElementById('panel-title').textContent === 'What next?' && document.querySelectorAll('#panel-body .card.goal').length >= 2, 'the 💡 Next button opens What next? with a list of goals');
    check(await Q(page, () => /How Thistlegloom works/.test(document.getElementById('panel-body').textContent)), 'and a short guide to the town');
    await shot(page, 'desktop-whatnext');
    await click(page, '#panel-body .card.goal button[data-cmd]');
    await until(page, () => __ds.ui.panel !== 'whatnext', 'its Show me button takes you there');
    await Q(page, () => __ds.ui.closeScreen('panel'));

    // the dock panels
    for (const [k, title] of [['whatnext', 'What next?'], ['quests', 'Quests'], ['staff', 'The Household'], ['heroes', 'Adventurers'], ['defence', 'The Siege'], ['bake', 'The Grand Bake']]) {
        await click(page, `[data-sheet="${k}"]`);
        await until(page, (t) => !document.getElementById('panel').hidden && document.getElementById('panel-title').textContent === t, `the ${title} panel opens`, 10000, title);
        await page.keyboard.press('Escape');
        await until(page, () => document.getElementById('panel').hidden, `Escape closes it`, 10000);
    }
    // a sheet with a slider focused still closes on Escape
    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button opens the menu');
    await click(page, '#pause-menu [data-act="settings"]');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden, 'Escape closes Settings even with a slider focused');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'and Escape closes the menu');

    // time: sleeping until morning
    const day = await Q(page, () => __ds.G.day);
    await click(page, '#btn-sleep');
    await until(page, (d) => __ds.G.day === d + 1, '☾ sleeps until morning', 10000, day);
    await Q(page, () => __ds.act({ t: 'speed', v: 1 }));
    await shot(page, 'desktop-town');

    // to the siege
    await Q(page, () => { __ds.ff(30); __ds.G.daysLeft = 1; __ds.G.dayT = __ds.DAY_LEN - 0.5; });
    await until(page, () => __ds.G.mode === 'battle' && !document.getElementById('bhud').hidden, 'the days run out and the siege begins; its HUD is shown', 60000);
    // hold the siege open while we poke at it: a King due far in the future means it can't be won yet
    await Q(page, () => { __ds.G.battle.kingAt = 1e9; __ds.G.battle.wall.hp = __ds.G.battle.wall.max = 1e6; });
    await page.waitForTimeout(400);
    await page.mouse.move(5, 5);
    await until(page, () => __ds.G.battle.t > 0.5, 'the brace passes');
    const aim0 = await Q(page, () => __ds.G.battle.aim);
    await page.keyboard.down('ArrowRight');
    await until(page, (a) => __ds.G.battle.aim > a + 5, 'holding → moves the aim', 20000, aim0);
    await page.keyboard.up('ArrowRight');
    const thrown = await Q(page, () => __ds.seen.throw || 0);
    await page.keyboard.press('Space');
    await until(page, (n) => (__ds.seen.throw || 0) > n, 'a tap of Space throws a doily (the press reaches a sim step)', 20000, thrown);
    const abil = await Q(page, () => Object.keys(__ds.G.battle.abil));
    if (abil.length) {
        await page.keyboard.press('Digit1');
        await until(page, () => (__ds.seen.ability || 0) > 0, `key 1 uses ${abil[0]}`);
    }
    // a click on the field aims and throws
    const t2 = await Q(page, () => __ds.seen.throw || 0);
    const fp = await Q(page, () => { const v = __ds.view, g = v.bGeo(); return { x: v.fx2s(40), y: g.groundY - 20 }; });
    await page.mouse.click(fp.x, fp.y);
    if (!await until(page, (n) => (__ds.seen.throw || 0) > n && Math.abs(__ds.G.battle.aim - 40) < 3, 'a click on the field aims there and throws', 20000, t2)) {
        console.log('    state', await Q(page, () => JSON.stringify({ aim: __ds.G.battle?.aim, thrown: __ds.seen.throw, ptr: __ds.input.pointer, keys: [...__ds.input.keys], stack: __ds.ui.stack, mode: __ds.G.mode })));
    }
    await shot(page, 'desktop-siege');
    await Q(page, () => { __ds.G.battle.kingAt = null; __ds.autoplay(true); });
    await until(page, () => !document.getElementById('result').hidden, 'the siege ends with the result sheet', 120000);
    await Q(page, () => __ds.autoplay(false));
    await shot(page, 'desktop-result');
    await click(page, '#result-ok');
    await until(page, () => document.getElementById('result').hidden && __ds.G.mode === 'town' && !document.getElementById('topbar').hidden, 'Back to Thistlegloom returns to the town');

    // sound
    await page.waitForTimeout(800);
    const snd = await Q(page, () => ({ loaded: __ds.audio.loaded, theme: __ds.audio.theme, playing: __ds.audio.playing(), state: __ds.audio.ctx?.state }));
    check(snd.loaded >= 40, `the effects and voices decode (${snd.loaded})`);
    check(snd.theme === 'town' && snd.playing, `the town theme is playing (${snd.theme}, ${snd.state})`);

    // save & quit → continue
    const day2 = await Q(page, () => __ds.G.day);
    await click(page, '#btn-pause');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ds.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (d) => __ds.mode === 'play' && __ds.G.day === d, 'Continue restores the saved game', 30000, day2);

    // the King and the Queen
    await Q(page, () => {
        const G = __ds.G;
        G.phase = 3; G.bake.ings = ['recipe', 'vanilla', 'icing', 'spark']; G.bake.pct = 100; G.daysLeft = 1; G.dayT = __ds.DAY_LEN - 1;
        for (const q of ['q_spark', 'q_drawing']) G.quests.done[q] = true;
        G.quests.active = [];
    });
    await until(page, () => __ds.G.mode === 'battle', 'the last siege begins');
    await Q(page, () => { __ds.quiet = false; __ds.G.battle.wall.hp = __ds.G.battle.wall.max = 1e6; __ds.G.battle.t = __ds.G.battle.kingAt - 0.5; });
    await until(page, () => !document.getElementById('talk').hidden && __ds.G.battle.king != null, 'King Crumbleton arrives with a scene', 60000);
    await Q(page, () => { __ds.ui.talkQ.length = 0; __ds.ui.nextLine(); const k = __ds.G.battle.enemies.find((e) => e.kind === 'king'); k.x = 40; });
    await until(page, () => !document.getElementById('btn-queen').hidden, 'once he looms mid-field, the Queen button appears', 60000);
    await shot(page, 'desktop-king');
    await page.keyboard.press('KeyQ');
    await until(page, () => !!__ds.G.battle?.queen && !document.getElementById('talk').hidden, 'Q reveals the Cookie Queen (with her scene)');
    await Q(page, () => { __ds.ui.talkQ.length = 0; __ds.ui.nextLine(); });
    await until(page, () => __ds.G.battle?.queen?.state === 'kiss', 'she crosses the field and they kiss', 60000);
    await shot(page, 'desktop-kiss');
    await until(page, () => __ds.G.battle?.enemies.some((e) => e.kind === 'king' && e.young) && (__ds.seen.transform || 0) > 0, 'the kiss turns the King young and freshly baked', 30000);
    await page.waitForTimeout(250);
    await shot(page, 'desktop-transform');
    await until(page, () => __ds.G.ended && !document.getElementById('talk').hidden, 'the war ends with the ending scene', 60000);
    await Q(page, () => { __ds.ui.talkQ.length = 0; __ds.ui.nextLine(); });
    await until(page, () => !document.getElementById('ending').hidden, 'the ending sheet appears');
    await shot(page, 'desktop-ending');
    await click(page, '#ending-ok');
    await until(page, () => document.getElementById('ending').hidden && __ds.G.phase === 4 && /held/.test(document.getElementById('r-day').textContent), 'Begin the Epilogue returns to an endless town');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd', 0, 0); };
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ds.mode === 'play' && !document.getElementById('talk').hidden, 'a tap on New Game starts the story');
    const n0 = await Q(page, () => __ds.ui.talkQ.length);
    await tapSel('#talk-line');
    await until(page, (n) => __ds.ui.talkQ.length < n, 'a tap on the dialogue moves it along', 10000, n0);
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('talk').hidden), 'the dialogue stays open after the finger lifts');
    await tapSel('#talk-skip');
    await Q(page, () => { __ds.quiet = true; __ds.ui.talkQ.length = 0; if (__ds.ui.talkCur) __ds.ui.nextLine(); __ds.act({ t: 'speed', v: 0 }); });
    await until(page, () => document.getElementById('talk').hidden, 'Skip closes the dialogue');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => [...document.querySelectorAll('#topbar button, #dock button, #tip button')].filter((b) => !b.hidden && b.getClientRects().length).map((b) => {
        const r = b.getBoundingClientRect();
        return { s: b.textContent.trim().slice(0, 8) || b.id, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    check(sizes.every((z) => z.ok), `every town control is at least 44 px and on screen${sizes.filter((z) => !z.ok).map((z) => ' ✗' + z.s).join('')}`);

    // tap a plot on the town canvas (centre it first: a portrait phone shows a slice of the town)
    await Q(page, () => __ds.view.centreOn(1));
    const p = await Q(page, () => __ds.view.plotClient(1));
    await tapAt(p.x, p.y);
    await until(page, () => __ds.ui.panel === 'plot:1' && !document.getElementById('panel').hidden, 'a tap on a plot opens it');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('panel').hidden), 'the sheet stays open after the finger lifts');
    await tapSel('#panel-body button[data-cmd*="cottage"]');
    await until(page, () => __ds.G.plots[1].b?.kind === 'cottage', 'a tap on Build builds a cottage');
    // a bubble by tap
    await Q(page, () => { __ds.view.centreOn(0); __ds.act({ t: 'speed', v: 3 }); });
    await until(page, () => __ds.view.bub.some((b) => b.i === 0), 'a bubble ripens over the cottage', 30000);
    await Q(page, () => __ds.act({ t: 'speed', v: 0 }));
    const bc = await Q(page, () => __ds.view.bubbleClient(0));
    const col0 = await Q(page, () => __ds.seen.collect || 0);
    await tapAt(bc.x, bc.y);
    await until(page, (n) => (__ds.seen.collect || 0) > n && document.getElementById('panel').hidden, 'a tap on the bubble collects it', 10000, col0);
    await page.waitForTimeout(700);   // let the card's slide-in finish (a transform moves its box)
    const tipOk = await Q(page, () => { const t = document.getElementById('tip'); if (t.hidden) return false; const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= document.getElementById('dock').getBoundingClientRect().top + 1; });
    if (!check(tipOk, 'the tip card sits on screen, above the dock')) console.log('    tip', await Q(page, () => JSON.stringify({ hidden: document.getElementById('tip').hidden, row: document.getElementById('tiprow').hidden, r: document.getElementById('tip').getBoundingClientRect(), dock: document.getElementById('dock').getBoundingClientRect().top, h: innerHeight })));
    // every panel's Close button is on screen, even with a long list
    for (const k of ['whatnext', 'quests', 'staff', 'heroes', 'defence', 'bake']) {
        await tapSel(`[data-sheet="${k}"]`);
        await until(page, () => !document.getElementById('panel').hidden, `the ${k} panel opens by tap`, 10000);
        const foot = await Q(page, () => { const s = document.querySelector('#panel .sheet'); s.scrollTop = 1e6; const b = document.querySelector('#panel [data-close]').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0 && b.height >= 44; });
        check(foot, `${k}: Close stays on screen, scrolled to the end`);
        await tapSel('#panel [data-close]');
        await until(page, () => document.getElementById('panel').hidden, `${k}: a tap on Close closes it`, 10000);
    }
    await shot(page, `phone-${w}x${h}-town`);

    // the siege by touch
    await Q(page, () => { __ds.G.staff.silk.joined = true; __ds.ff(1); __ds.G.daysLeft = 1; __ds.G.dayT = __ds.DAY_LEN - 0.5; __ds.act({ t: 'speed', v: 1 }); });
    await until(page, () => __ds.G.mode === 'battle' && __ds.G.battle.t > 0.2, 'the siege begins', 60000);
    const thrown = await Q(page, () => __ds.seen.throw || 0);
    const fp = await Q(page, () => { const v = __ds.view, g = v.bGeo(); return { x: v.fx2s(35), y: g.groundY - 30 }; });
    await tapAt(fp.x, fp.y);
    await until(page, (n) => (__ds.seen.throw || 0) > n, 'a tap on the field throws a doily', 20000, thrown);
    const abtn = await Q(page, () => { const b = document.querySelector('.abtn'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: r.width >= 44 && r.height >= 44 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    check(abtn && abtn.ok, 'the ability button is at least 44 px and on screen');
    if (abtn) { await tapAt(abtn.x, abtn.y); await until(page, () => (__ds.seen.ability || 0) > 0, 'tapping it uses the ability'); }
    await shot(page, `phone-${w}x${h}-siege`);
    await tapSel('#btn-pause2');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses the siege');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the menu stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => { __ds.quiet = true; });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ds.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __ds.ff(60));
    check(await Q(page, () => __ds.save() === false), 'saving fails quietly');
    check(await Q(page, () => __ds.G.day >= 2), 'and the town carries on');
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
