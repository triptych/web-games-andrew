/**
 * browsertest.mjs — Glimmerglade in real Chromium.
 *
 * desktop (1280×760): boots to the title with no errors and the ← Games link on top; Begin opens Willow's story,
 *   real Space presses step through it; real mouse clicks lift and pour, a real drag pours, Z undoes, digit keys
 *   pour; the Firefly and Sprout tools work from real clicks; Escape pauses, Settings opens over it and Escape
 *   closes it even with a slider focused; a won level shows the stars and Next starts the next level; Back to
 *   Title → Play restores the level in play; the map unlocks the next level; the journal shows the woken
 *   creatures; the daily dewdrop counts as done; the generated sounds and voices decode and the music plays;
 *   sheets keep their buttons on screen however far they scroll.
 * phones (touch only, real touches) at 390×844 and 844×390: taps through the title and story, taps pour, the
 *   toolbar and pause button are ≥ 44 px, on screen and on top, the pause sheet survives the lifting finger, no
 *   sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game boots, plays and wins.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8148          # from the REPO ROOT
 *   node game-148/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8148), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8148';
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-148/index.html?debug=1`);
    await page.waitForFunction(() => window.__gg && __gg.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 20000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => check(true, msg), () => check(false, msg));
const settle = (page) => page.waitForFunction(() => !__gg.busy, null, { timeout: 20000, polling: 50 }).catch(() => {});
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const center = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
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
/** A legal pour and the client points of its two blossoms. */
const legalPour = (page) => Q(page, () => {
    const L = __gg.legal().find(([f, t]) => f !== t && __gg.G.tubes[t].kind === 'bloom') || __gg.legal()[0];
    return L && { f: L[0], t: L[1], a: __gg.tubeCenter(L[0]), b: __gg.tubeCenter(L[1]) };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/**
 * Every possible pour's flight path, sampled through the view's own _flightPos(): inside a blossom (going up out of
 * the source or down into the target) a wisp must stay within that blossom's glass walls and clear of every other
 * blossom; out of the glass, wherever it overlaps any blossom it must be drawn behind it. Returns the failures.
 */
const flightAudit = (page) => Q(page, () => {
    const v = __gg.view, n = v.layout.length, r = v.d / 2, bad = [];
    const over = (p, L) => Math.abs(p.x - L.cx) < L.w / 2 + r && p.y + r > L.top - L.w * 0.2 && p.y - r < L.bottom + L.w * 0.6;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        if (a === b) continue;
        const path = v._path(a, b, v.slot(a, 0), v.slot(b, 0));
        for (let i = 0; i <= 120; i++) {
            const u = i / 120;
            // _flightPos eases time into progress (1 − (1 − x)³); invert it to sample progress evenly
            const p = v._flightPos({ path, from: a, to: b, t: 1 - Math.cbrt(1 - u), dur: 1 });
            if (p.inside) {
                const host = [a, b].find((k) => Math.abs(p.x - v.layout[k].cx) < 1);
                const L = v.layout[host];
                if (!L || Math.abs(p.x - L.cx) + r > L.w / 2) bad.push(`${a}→${b} leaves the glass of ${host}`);
                v.layout.forEach((M, k) => { if (k !== a && k !== b && over(p, M)) bad.push(`${a}→${b} runs in front of ${k}`); });
            } else if (v.layout.some((M) => over(p, M)) && !p.behind) bad.push(`${a}→${b} crosses ${v.layout.findIndex((M) => over(p, M))} in front`);
        }
    }
    return [...new Set(bad)].slice(0, 6);
});
/** Does a sheet keep its foot buttons on screen at the top and after scrolling to the end? */
const footVisible = (page, id) => Q(page, (sid) => {
    const sheet = document.querySelector(`#${sid} .sheet`);
    const foot = sheet.querySelector('.sheet-foot button:last-child');
    const inView = () => { const r = foot.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === foot; };
    sheet.getAnimations({ subtree: true }).forEach((a) => { if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish(); });
    const a = inView();
    sheet.scrollTop = 1e6;
    const b = inView();
    sheet.scrollTop = 0;
    return a && b;
}, id);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    const L0 = await layout(page);
    check(L0.noHScroll && L0.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => document.querySelectorAll('[id$="-title"]').length === new Set([...document.querySelectorAll('[id$="-title"]')].map((e) => e.id)).size), 'no duplicate *-title ids');
    await shot(page, 'desktop-title');

    // Begin → Willow's story, stepped through with real Space presses
    const begin = await center(page, '#btn-play');
    await page.mouse.click(begin.x, begin.y);
    await until(page, () => __gg.ui.top() === 'story' && /Tumble Wind/.test(document.getElementById('story-text').textContent), 'Begin opens Grandmother Willow\'s story');
    await shot(page, 'desktop-story');
    await page.keyboard.press('Space');
    await until(page, () => /Leave it to me/.test(document.getElementById('story-text').textContent), 'Space steps to Lumi\'s line');
    await page.keyboard.press('Space');
    await until(page, () => __gg.mode === 'play' && __gg.G && __gg.G.n === 0 && !__gg.ui.anyScreen(), 'the story ends in level 1');
    await settle(page);
    await Q(page, () => __gg.start(38));            // 11 blossoms and a cup
    await settle(page);
    let fa = await flightAudit(page);
    check(!fa.length, 'desktop: every flight goes up, over and down without passing through glass' + (fa.length ? ' — ' + fa.join('; ') : ''));
    await Q(page, () => __gg.start(0));
    await settle(page);

    // real clicks: lift, then pour
    let p = await legalPour(page);
    await page.mouse.click(p.a.x, p.a.y);
    await until(page, (f) => __gg.view.selected === f, 'a click lifts the top wisps', 5000, p.f);
    await page.mouse.click(p.b.x, p.b.y);
    await until(page, () => __gg.G.moves === 1, 'a click on another blossom pours');
    await settle(page);

    // a real drag
    p = await legalPour(page);
    await page.mouse.move(p.a.x, p.a.y);
    await page.mouse.down();
    await page.mouse.move((p.a.x + p.b.x) / 2, p.a.y - 60, { steps: 4 });
    await page.mouse.move(p.b.x, p.b.y, { steps: 4 });
    await page.mouse.up();
    await until(page, () => __gg.G.moves === 2, 'a drag from one blossom to another pours');
    await settle(page);
    await page.keyboard.press('KeyZ');
    await until(page, () => __gg.G.moves === 1 && __gg.seen.undo >= 1, 'Z undoes');
    await settle(page);
    p = await legalPour(page);
    if (p.f < 9 && p.t < 9) {
        await page.keyboard.press('Digit' + (p.f + 1));
        await page.keyboard.press('Digit' + (p.t + 1));
        await until(page, () => __gg.G.moves === 2, 'digit keys lift and pour');
        await settle(page);
    }
    // tools
    const hints = await Q(page, () => __gg.G.hints);
    const fly = await center(page, '#tool-hint');
    await page.mouse.click(fly.x, fly.y);
    await until(page, (h) => __gg.G.hints === h - 1 && __gg.view.hint, 'the Firefly tool shows a hint', 8000, hints);
    await shot(page, 'desktop-hint');
    const nt = await Q(page, () => __gg.G.tubes.length);
    const sp = await center(page, '#tool-sprout');
    await page.mouse.click(sp.x, sp.y);
    await until(page, (n) => __gg.G.tubes.length === n + 1 && document.getElementById('tool-sprout').disabled, 'the Sprout tool grows one blossom, once', 8000, nt);
    await settle(page);

    // pause → settings → Escape with a slider focused → resume
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => __gg.ui.top() === 'settings' && getComputedStyle(document.getElementById('settings')).zIndex > getComputedStyle(document.getElementById('pause')).zIndex, 'Settings opens on top of the pause sheet');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => __gg.ui.top() === 'pause', 'Escape closes Settings even with a slider focused');
    const resume = await center(page, '#pause-menu [data-act="resume"]');
    await page.mouse.click(resume.x, resume.y);
    await until(page, () => !__gg.ui.anyScreen(), 'Resume returns to the board');

    // the sounds and voices: decoded, and the music is playing
    await until(page, () => Object.keys(__gg.audio.buffers).length >= 30, 'the generated effects and voices decode', 30000);
    await until(page, () => __gg.audio.playing() || __gg.audio.synthMusic, 'a music theme is playing', 15000);
    check(await Q(page, () => !__gg.audio.synthMusic), 'the generated music loaded (no synth fallback)');

    // win → stars → Next
    await Q(page, () => __gg.win());
    await until(page, () => __gg.ui.top() === 'win' && document.querySelectorAll('#win-stars i.on').length >= 1, 'a won level shows its stars', 15000);
    await page.waitForTimeout(600);
    await shot(page, 'desktop-win');
    check(await Q(page, () => __gg.P.stars[0] >= 1 && __gg.P.unlocked >= 1), 'the win is saved and the next level unlocked');
    const next = await center(page, '#win-next');
    await page.mouse.click(next.x, next.y);
    await until(page, () => __gg.mode === 'play' && __gg.G.n === 1, 'Next starts level 2');
    await settle(page);

    // leave and come back
    p = await legalPour(page);
    await page.mouse.click(p.a.x, p.a.y); await page.mouse.click(p.b.x, p.b.y);
    await until(page, () => __gg.G.moves === 1, 'a pour in level 2');
    await settle(page);
    await page.keyboard.press('KeyP');
    await until(page, () => !document.getElementById('pause').hidden, 'P pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __gg.mode === 'title' && document.getElementById('btn-play').textContent === 'Continue', 'Back to Title offers Continue');
    await click(page, '#btn-play');
    await until(page, () => __gg.mode === 'play' && __gg.G.n === 1 && __gg.G.moves === 1, 'Continue restores the level in play');
    await shot(page, 'desktop-play');

    // map and journal
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'pause again');
    await click(page, '#pause-menu [data-act="map"]');
    await until(page, () => __gg.ui.top() === 'map', 'the Glade Map opens');
    check(await Q(page, () => !document.querySelector('.lvl[data-level="1"]').disabled && document.querySelector('.lvl[data-level="2"]').disabled), 'level 2 is open, level 3 still locked');
    check(await footVisible(page, 'map'), 'the map\'s Back button stays on screen when scrolled');
    await shot(page, 'desktop-map');
    await click(page, '#map [data-close]');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __gg.mode === 'title', 'back on the title');
    await click(page, '#title-menu [data-act="journal"]');
    await until(page, () => __gg.ui.top() === 'journal' && document.querySelectorAll('.creature:not(.asleep)').length >= 2, 'the journal shows the woken creatures (and Bramble)');
    check(await footVisible(page, 'journal'), 'the journal\'s Close button stays on screen when scrolled');
    await shot(page, 'desktop-journal');
    await click(page, '#journal [data-close]');

    // the daily dewdrop
    await click(page, '#title-menu [data-act="daily"]');
    await until(page, () => __gg.mode === 'play' && __gg.G.kind === 'daily', 'the Daily Dewdrop starts');
    await Q(page, () => __gg.win());
    await until(page, () => __gg.ui.top() === 'win', 'the daily can be won', 15000);
    check(await Q(page, () => __gg.P.daily.streak === 1 && !!__gg.P.daily.last), 'the daily streak counts it');
    await click(page, '#win-next');
    await until(page, () => __gg.mode === 'title' && /done today/.test(document.getElementById('daily-note').textContent), 'the title says the daily is done');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => { const r = await center(page, sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#btn-play');
    await until(page, () => __gg.ui.top() === 'story', 'a tap on Begin opens the story');
    await page.waitForTimeout(250);
    await tapSel('#story-next');
    await until(page, () => /Leave it to me/.test(document.getElementById('story-text').textContent), 'a tap on Next steps the story');
    await tapSel('#story-next');
    await until(page, () => __gg.mode === 'play' && !__gg.ui.anyScreen(), 'the story ends in play');
    await settle(page);
    await Q(page, () => __gg.start(38));
    await settle(page);
    const fa = await flightAudit(page);
    check(!fa.length, `${w}×${h}: every flight goes up, over and down without passing through glass (${await Q(page, () => Math.ceil(__gg.view.layout.length / __gg.view.per))} rows)` + (fa.length ? ' — ' + fa.join('; ') : ''));
    await Q(page, () => __gg.start(0));
    await settle(page);
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const p = await legalPour(page);
    await page.touchscreen.tap(p.a.x, p.a.y);
    await until(page, (f) => __gg.view.selected === f, 'a tap lifts', 5000, p.f);
    await page.touchscreen.tap(p.b.x, p.b.y);
    await until(page, () => __gg.G.moves === 1, 'a second tap pours');
    await settle(page);

    const sizes = await Q(page, () => ['#tool-undo', '#tool-hint', '#tool-sprout', '#tool-restart', '#btn-pause'].map((s) => {
        const el = document.querySelector(s);
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && (top === el || el.contains(top)) };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px, on screen and on top`);
    const tubes = await Q(page, () => __gg.G.tubes.map((_, i) => __gg.tubeCenter(i)).every((c) => c.x > 0 && c.x < innerWidth && c.y > 0 && c.y < innerHeight));
    check(tubes, 'every blossom is on screen');
    const overlap = await Q(page, () => {
        const tb = document.getElementById('toolbar').getBoundingClientRect();
        const c = document.getElementById('view').getBoundingClientRect();
        // each blossom's box, from its lifted wisps above the rim to the foot of its stem
        return __gg.view.layout.every((L) => {
            const b = { l: c.left + L.cx - L.w * 0.8, r: c.left + L.cx + L.w * 0.8, t: c.top + L.top - L.w, btm: c.top + L.bottom + L.w * 0.6 };
            return b.r <= tb.left || b.l >= tb.right || b.btm <= tb.top || b.t >= tb.bottom;
        });
    });
    check(overlap, 'no blossom sits under the toolbar');
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause sheet stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await Q(page, () => __gg.win());
    await until(page, () => __gg.ui.top() === 'win', 'a level can be won', 15000);
    await page.waitForTimeout(700);
    const winOk = await Q(page, () => { const r = document.querySelector('#win-next').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
    check(winOk, 'the win sheet\'s Next button is on screen');
    await shot(page, `phone-${w}x${h}-win`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __gg.start(0));
    await until(page, () => __gg.mode === 'play', 'boots and starts a level with localStorage throwing');
    check(await Q(page, () => __gg.save() === false), 'saving fails quietly');
    await Q(page, () => __gg.win());
    await until(page, () => __gg.ui.top() === 'win', 'and the level can still be won', 15000);
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
