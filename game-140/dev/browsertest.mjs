/**
 * browsertest.mjs — The Last Apprentice in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): the title with no errors, WebGL on and the ← Games link on top → New Story names the
 *   apprentice → the prologue plays (Enter types and advances, a voiced line plays, the generated music is playing
 *   and the effects decode) → a choice by key → Tab skips to the next choice → the log and the journal open and close
 *   → a ward-lock turned by a real mouse drag and by its buttons, a hint, the Codex opens it → the colour ripple runs
 *   and the bloom scene follows → a night at the fire by click → the road map and Travel on → Save to slot 1, Save &
 *   Quit, Continue restores the story → the bot plays to the end → the ending → Title, now in full colour.
 * phones (touch only, real taps) at 390×844 and 844×390: tap through the title and the naming sheet, a tap on the
 *   dialogue box advances, a tap on a ward ring turns it, controls ≥ 44 px and on screen, the camp and map panels fit,
 *   no sideways scroll, the stage matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error, failed request or HTTP error.
 *
 *   python3 -m http.server 8140          # from the REPO ROOT
 *   node game-140/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8140), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8140';
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
        window.confirm = () => true;
    }, nostorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
        const u = r.url();
        // a voice clip cut off by the next line, or a track paused before it loaded, is aborted on purpose
        if (u.includes('favicon') || (u.includes('/audio/') && r.failure()?.errorText === 'net::ERR_ABORTED')) return;
        errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
    });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
    await page.goto(`${BASE}/game-140/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__tla && __tla.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const shown = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('stage').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        stage: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
    };
});
/** Every visible control in `sel` is at least 44 px and inside the window. */
const controlsOk = (page, sel) => Q(page, (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length && !e.closest('[hidden]')).map((e) => {
    const r = e.getBoundingClientRect();
    return { s: e.id || e.textContent.trim().slice(0, 14), ok: r.width >= 43.5 && r.height >= 43.5 && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
}), sel);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

/**
 * Every dialog keeps its way out on screen: with 2000 px of filler before its foot, the foot's buttons (and the
 * journal's tabs) are inside the sheet's visible rect and on top, before and after scrolling to the bottom.
 */
async function dialogsOk(page, label) {
    const res = await Q(page, () => {
        const out = [];
        const G = __tla.G;
        for (const id of ['journal', 'howto', 'settings', 'log', 'slots', 'menu']) {
            if (id === 'journal') __tla.ui.openJournal(G, __tla.album); else if (id === 'log') __tla.ui.openLog([]); else if (id === 'slots') __tla.ui.openSlots('load', __tla.slots()); else __tla.ui.openScreen(id);
            const sheet = document.querySelector(`#${id} .sheet`);
            const foot = sheet.querySelector(':scope > .sheet-foot');
            const filler = document.createElement('div');
            filler.style.height = '2000px';
            if (foot) sheet.insertBefore(filler, foot); else sheet.appendChild(filler);
            const visible = (el) => {
                const r = el.getBoundingClientRect(), c = sheet.getBoundingClientRect();
                if (!(r.top >= c.top - 1 && r.bottom <= c.bottom + 1 && r.top >= 0 && r.bottom <= innerHeight + 1)) return false;
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return el === hit || el.contains(hit);
            };
            const targets = () => [...(foot ? foot.querySelectorAll('button') : []), ...sheet.querySelectorAll(':scope > .tabs .tab:not([hidden])')];
            let ok = !foot || targets().every(visible);
            sheet.scrollTop = 1e6;
            ok = ok && (!foot || targets().every(visible));
            out.push({ id, ok: ok || !foot && id === 'menu' });
            filler.remove();
            sheet.scrollTop = 0;
            __tla.ui.closeScreen(id);
        }
        return out;
    });
    for (const r of res) check(r.ok, `${label}: the ${r.id} sheet keeps its buttons${r.id === 'journal' ? ' and tabs' : ''} on screen with a long page`);
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => __tla.webgl), 'the colour shader runs on WebGL');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.stage, 'no sideways scroll; the stage fills the window');
    check(await Q(page, () => __tla.stage.lv.join() === '0,0,1,0,0,0,0'), 'the title is grey but for the book\'s gold');
    await shot(page, 'desktop-title');

    // a real mouse click (not an in-page one) is the gesture that unlocks audio
    const nb = await Q(page, () => { const r = document.querySelector('#title-menu [data-act="new"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(nb.x, nb.y);
    await until(page, () => !document.getElementById('newgame').hidden, 'New Story opens the naming sheet');
    await page.fill('#ng-name', 'Ash');
    await click(page, '#ng-go');
    await until(page, () => __tla.mode === 'game' && __tla.G.scene?.id === 'prologue' && __tla.G.name === 'Ash', 'Begin starts the prologue with the name');
    await until(page, () => !document.getElementById('chapter-card').hidden, 'the chapter card is shown');
    await until(page, () => __tla.audio.current === 'ravenmoor' && __tla.audio.tracks.ravenmoor && !__tla.audio.tracks.ravenmoor.paused, 'the generated music is playing');
    await until(page, () => Object.keys(__tla.audio.buffers).length >= 13, 'the generated sound effects decode');
    await until(page, () => __tla.audio.speaking, 'the narrator\'s line is voiced');

    const l0 = await Q(page, () => __tla.G.stats.lines);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
    await until(page, (n) => __tla.G.stats.lines > n, 'Enter finishes and advances lines', 30000, l0);
    await shot(page, 'desktop-prologue');

    // on to the first choice and take it by key
    await page.keyboard.press('Tab');
    await until(page, () => __tla.vn.choosing, 'Tab skips to the next choice');
    const c0 = await Q(page, () => __tla.G.stats.choices);
    await page.keyboard.press('Digit1');
    await until(page, (n) => __tla.G.stats.choices > n, 'a number key picks a choice', 30000, c0);

    await page.keyboard.press('KeyL');
    await until(page, () => !document.getElementById('log').hidden && document.querySelectorAll('#log-body p').length > 3, 'L opens the history');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('log').hidden, 'Escape closes it');
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden && document.querySelectorAll('.ward-item').length === 7, 'J opens the journal with the seven wards');
    await click(page, '#journal-tabs [data-tab="lore"]');
    await until(page, () => document.querySelectorAll('.lore h3').length >= 2, 'the Lore tab lists what is known');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden, 'Escape closes the journal');
    await dialogsOk(page, 'desktop');
    // Escape closes Settings even with a slider focused (a keydown handler that ignores INPUT never sees it)
    await click(page, '#btn-menu');
    await click(page, '#menu-menu [data-act="settings"]');
    await Q(page, () => document.getElementById('set-music').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden, 'Escape closes Settings with a slider focused');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('menu').hidden, 'and then the menu');

    // the first ward-lock
    await Q(page, () => __tla.toPhase('ward'));
    await until(page, () => __tla.G.phase === 'ward' && !document.getElementById('ward').hidden && !document.getElementById('ward-ui').hidden, 'the Rose Ward is on screen');
    const g = await Q(page, () => { const g = __tla.wardView.geom(); return { cx: g.cx, cy: g.cy, r: g.R - g.rw / 2 }; });
    const m0 = await Q(page, () => __tla.G.ward.moves);
    await page.mouse.move(g.cx, g.cy - g.r);
    await page.mouse.down();
    for (let a = 0; a <= 12; a++) {
        const t = -Math.PI / 2 + (a / 12) * (Math.PI / 2.6);
        await page.mouse.move(g.cx + Math.cos(t) * g.r, g.cy + Math.sin(t) * g.r);
    }
    await page.mouse.up();
    await until(page, (m) => __tla.G.phase !== 'ward' || __tla.G.ward.moves >= m + 2, 'dragging the outer ring a quarter round turns it twice', 30000, m0);
    if (await Q(page, () => __tla.G.phase === 'ward')) {
        const m1 = await Q(page, () => __tla.G.ward.moves);
        await click(page, '#ward-cw');
        await until(page, (m) => __tla.G.phase !== 'ward' || __tla.G.ward.moves > m, 'the ⟳ button turns the selected ring', 30000, m1);
    }
    if (await Q(page, () => __tla.G.phase === 'ward')) {
        await page.keyboard.press('KeyH');
        await until(page, () => (__tla.seen.hint || 0) >= 1, 'H gives a hint');
        await shot(page, 'desktop-ward');
        await click(page, '#ward-unseal');
    }
    await until(page, () => (__tla.seen.wardOpen || 0) >= 1 && __tla.G.hues[0] === 1, 'the ward opens and crimson is restored');
    await until(page, () => __tla.stage.rip && __tla.stage.rip.hue === 0, 'the crimson ripple spreads', 10000);
    await shot(page, 'desktop-ripple');
    await until(page, () => !__tla.holding && __tla.G.scene?.id === 'rose-bloom' && !document.getElementById('dlg').hidden, 'the bloom scene follows the opening');
    await until(page, () => __tla.stage.lv[0] === 1, 'the ripple finishes and red is back for good');
    await shot(page, 'desktop-bloom');

    // a night at the fire
    await Q(page, () => __tla.toPhase('camp'));
    await until(page, () => !document.getElementById('camp-ui').hidden && document.querySelectorAll('.camp-card').length >= 2, 'the camp lists who to sit with');
    await shot(page, 'desktop-camp');
    await click(page, '.camp-card[data-who="aldwin"]');
    await until(page, () => __tla.G.scene?.kind === 'talk' && __tla.G.scene.who === 'aldwin', 'a click sits with Aldwin');

    // the road
    await Q(page, () => __tla.toPhase('map'));
    await until(page, () => !document.getElementById('map-ui').hidden && document.querySelectorAll('.pin').length === 8, 'the road map shows the eight places');
    await shot(page, 'desktop-map');
    const ch = await Q(page, () => __tla.G.ch);
    await click(page, '#map-go');
    await until(page, (c) => __tla.G.ch === c + 1 && __tla.G.phase === 'scene', 'Travel on starts the next chapter', 30000, ch);

    // saving
    await click(page, '#btn-menu');
    await until(page, () => !document.getElementById('menu').hidden, 'the ☰ button opens the menu');
    await click(page, '#menu-menu [data-act="save"]');
    await until(page, () => !document.getElementById('slots').hidden, 'Save opens the slots');
    await click(page, '#slots-list [data-slot="1"]');
    await until(page, () => __tla.slots()[1] !== null, 'the story is saved to slot 1');
    await page.keyboard.press('Escape');
    const where = await Q(page, () => ({ ch: __tla.G.ch, id: __tla.G.scene?.id, pc: __tla.G.scene?.pc }));
    await click(page, '#menu-menu [data-act="quit"]');
    await until(page, () => __tla.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (w) => __tla.mode === 'game' && __tla.G.ch === w.ch && __tla.G.scene?.id === w.id && __tla.G.scene.pc === w.pc, 'Continue restores the story where it was', 30000, where);
    await until(page, () => __tla.G.hues.some(Boolean) && __tla.stage.lv.every((v, i) => v === __tla.G.hues[i]), 'the restored colours come back with it');

    // to the end
    await Q(page, () => __tla.toPhase('end'));
    await until(page, () => __tla.mode === 'ending' && !document.getElementById('ending').hidden, 'the bot plays to the end and the ending is shown');
    await until(page, () => __tla.stage.lv.every((v) => v === 1), 'the world is in full colour');
    await shot(page, 'desktop-ending');
    await click(page, '#ending-title-btn');
    await until(page, () => __tla.mode === 'title' && __tla.stage.lv.every((v) => v === 1), 'the title is in full colour once the story is finished');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    for (const z of await controlsOk(page, '#title-menu .btn')) check(z.ok, `title "${z.s}" is at least 44 px and on screen`);
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'a tap on New Story opens the naming sheet');
    await page.waitForTimeout(300);
    await tapSel('#ng-go');
    await until(page, () => __tla.mode === 'game' && __tla.G.scene?.id === 'prologue', 'a tap on Begin starts the story');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.stage, 'the stage matches the visible viewport');

    const l0 = await Q(page, () => __tla.G.stats.lines);
    for (let i = 0; i < 3; i++) { await tapSel('#dlg .box'); await page.waitForTimeout(200); }
    await until(page, (n) => __tla.G.stats.lines > n, 'tapping the dialogue box advances', 30000, l0);
    for (const z of await controlsOk(page, '#dlg .vbtn, #btn-journal, #btn-menu')) check(z.ok, `${z.s} is at least 44 px and on screen`);
    await shot(page, `phone-${w}x${h}-dlg`);
    await dialogsOk(page, `phone ${w}×${h}`);

    await Q(page, () => __tla.toPhase('ward'));
    await until(page, () => __tla.G.phase === 'ward' && !document.getElementById('ward').hidden, 'the ward-lock is on screen');
    const g = await Q(page, () => { const g = __tla.wardView.geom(); const d = __tla.wardView.dpr; return { x: (g.cx + (g.R - g.rw / 2) * 0.9) / d, y: g.cy / d }; });
    const m0 = await Q(page, () => __tla.G.ward.moves);
    await page.touchscreen.tap(g.x, g.y);
    await until(page, (m) => __tla.G.phase !== 'ward' || __tla.G.ward.moves > m, 'a tap on the right of the outer ring turns it', 30000, m0);
    for (const z of await controlsOk(page, '#ward-ui .btn')) check(z.ok, `ward "${z.s}" is at least 44 px and on screen`);
    check(await Q(page, () => {
        const g = __tla.wardView.geom(), d = __tla.wardView.dpr;
        const btns = document.querySelector('.ward-btns').getBoundingClientRect();
        if (innerWidth / innerHeight >= 1.1) return (g.cx + g.R) / d <= btns.left + 8 || (g.cy + g.R) / d <= btns.top + 8;
        return (g.cy + g.R) / d <= btns.top + 8;
    }), 'the rings sit clear of the ward buttons');
    await shot(page, `phone-${w}x${h}-ward`);

    await Q(page, () => __tla.toPhase('camp'));
    await until(page, () => !document.getElementById('camp-ui').hidden, 'the camp panel is up');
    for (const z of await controlsOk(page, '#camp-ui .card, #camp-sleep')) check(z.ok, `camp "${z.s}" is at least 44 px and on screen`);
    await shot(page, `phone-${w}x${h}-camp`);
    await Q(page, () => __tla.toPhase('map'));
    await until(page, () => !document.getElementById('map-ui').hidden, 'the road map is up');
    for (const z of await controlsOk(page, '#map-go')) check(z.ok, 'Travel on is at least 44 px and on screen');
    check(await Q(page, () => [...document.querySelectorAll('.pin')].every((p) => { const r = p.getBoundingClientRect(); return r.left >= -20 && r.right <= innerWidth + 20; })), 'every map pin is on screen');
    await shot(page, `phone-${w}x${h}-map`);
    await tapSel('#map-go');
    await until(page, () => __tla.G.phase === 'scene', 'a tap on Travel on moves on');
    check((await layout(page)).noHScroll, 'still no sideways scroll');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await click(page, '#ng-go');
    await until(page, () => __tla.mode === 'game', 'boots and starts a story with localStorage throwing');
    await Q(page, () => __tla.toPhase('ward'));
    await Q(page, () => __tla.send({ t: 'unseal' }));
    await until(page, () => __tla.G.hues[0] === 1, 'plays on to the first ward');
    check(await Q(page, () => __tla.slots().every((s) => s === null)), 'saving fails quietly');
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
