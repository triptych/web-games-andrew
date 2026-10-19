/**
 * browsertest.mjs — Colorverse in real Chromium, with real input.
 *
 * desktop (1280×760): boot with the ← Games link on top → Begin by click → the prologue by Enter and
 *   clicks → zoom with the wheel → click a right pixel (Glimmer goes up), a wrong one (a mistake),
 *   Ctrl+Z undoes it → a drag paints the run it crosses → number keys pick colours → finish Wick by
 *   real clicks → the reward card → Continue → the after-scene → Comet's page opens → Esc to the chart →
 *   the Constellation by click and Lantern Light learned, the chart never resizing → the gallery and a PNG download → reload: the
 *   save is still there.
 * phones (touch only, real taps and CDP multi-touch) at 390×844 and 844×390: Begin and the dialogue by tap;
 *   the canvas fills its stage; a two-finger pinch zooms in and paints nothing; a two-finger drag pans; a tap
 *   paints one pixel; a one-finger drag paints a run; the ✥ Move tool pans with one finger; every tool and
 *   swatch is at least 44 px and on screen; nothing sits under the back link; no sideways scroll.
 * nostorage: localStorage throws; the game boots and paints.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8086          # from the REPO ROOT
 *   node game-086/dev/browsertest.mjs     (ONLY=desktop,phones,nostorage)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8086';
const URL = `${BASE}/game-086/index.html?debug=1&fasttext`;
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
const SETTLE = 300; // longer than VIEW.pinchCancelMs, so a finished tap is never mistaken for a pinch
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, passes = 0, errors = [];
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ✗', m); } };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

async function newPage(ctx, initScript) {
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()}`); });
    if (initScript) await page.addInitScript(initScript);
    await page.goto(URL);
    await page.waitForFunction(() => window.__cv);
    return page;
}
const S = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => S(page, () => ({
    glimmer: __cv.state.glimmer, screen: __cv.app.screen, dlg: !document.getElementById('dialogue').hidden,
    modal: !document.getElementById('modal').hidden, s: __cv.paint.painter.cam.s,
    correct: __cv.paint.ps?.correct ?? 0, mistakes: __cv.paint.ps?.mistakes ?? 0, color: __cv.paint.color, art: __cv.paint.art?.id,
}));
/** Page coordinates of the middle of pixel i on the paint canvas. */
const cellPoint = (page, i) => S(page, (i) => {
    const p = __cv.paint.painter, w = p.pic.w, r = p.canvas.getBoundingClientRect();
    const { sx, sy } = p.cellToScreen((i % w) + 0.5, Math.floor(i / w) + 0.5);
    return { x: r.left + sx, y: r.top + sy };
}, i);
async function untilDialogueGone(page, tap) {
    for (let k = 0; k < 40 && (await state(page)).dlg; k++) { await tap(); await page.waitForTimeout(40); }
}
async function backLinkCheck(page, label) {
    const r = await S(page, () => {
        const a = document.getElementById('back-link'), b = a.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { on: b.right <= innerWidth && b.bottom <= innerHeight && b.left >= 0 && b.top >= 0, top: top === a || a.contains(top), href: a.getAttribute('href') };
    });
    ok(r.on && r.top && r.href === '../index.html', `${label}: ← Games link visible and on top`);
}

/* ───────────── desktop ───────────── */
if (want('desktop')) {
    console.log('— desktop');
    errors = [];
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, acceptDownloads: true });
    const page = await newPage(ctx);
    await backLinkCheck(page, 'title');
    ok(await S(page, () => { const all = [...document.querySelectorAll('[id]')].map((e) => e.id); return all.length === new Set(all).size; }), 'every id is unique');
    await page.click('#btn-new');
    await page.waitForTimeout(100);
    ok((await state(page)).dlg, 'the prologue opens');
    await page.keyboard.press('Enter');
    await untilDialogueGone(page, () => page.mouse.click(640, 600));
    let st = await state(page);
    ok(st.screen === 'paint' && st.art === 'wick' && !st.dlg, 'Wick\'s page is open after the prologue');
    await page.screenshot({ path: path.join(OUT, 'desktop-paint.png') });

    const s0 = st.s;
    await page.mouse.move(500, 400);
    for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(30); }
    st = await state(page);
    ok(st.s > s0 * 1.3, `the wheel zooms in (${s0.toFixed(1)} → ${st.s.toFixed(1)})`);
    await page.click('#zoom-fit');
    await page.waitForTimeout(500);

    const art = await S(page, () => ({ cells: [...__cv.ART_BY_ID.wick.cells], n: __cv.ART_BY_ID.wick.palette.length }));
    const c0 = art.cells[0];
    await page.keyboard.press(String(c0 + 1));
    ok((await state(page)).color === c0, 'a number key picks its colour');
    let pt = await cellPoint(page, 0);
    await page.mouse.click(pt.x, pt.y);
    st = await state(page);
    ok(st.correct === 1 && st.glimmer >= 1, 'clicking a right pixel paints it and earns Glimmer');
    const wrongI = art.cells.findIndex((c) => c !== c0);
    pt = await cellPoint(page, wrongI);
    await page.mouse.click(pt.x, pt.y);
    ok((await state(page)).mistakes === 1, 'clicking a wrong pixel makes a mistake');
    await page.keyboard.press('Control+z');
    st = await state(page);
    ok(st.mistakes === 0 && (await S(page, (i) => __cv.paint.ps.cells[i], wrongI)) === 0, 'Ctrl+Z undoes it');
    // a drag along the top row paints every pixel it crosses
    const a = await cellPoint(page, 1), b = await cellPoint(page, 15);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 3 });
    await page.mouse.up();
    const rowRight = art.cells.slice(0, 16).filter((c) => c === c0).length;
    st = await state(page);
    ok(st.correct === rowRight, `a drag paints the run it crosses (${st.correct}/${rowRight})`);
    ok(st.mistakes === 16 - rowRight, `and marks the others it crossed as mistakes (${st.mistakes})`);
    await page.keyboard.press('Control+z');

    for (let c = 0; c < art.n; c++) {
        await page.keyboard.press(String(c + 1));
        for (let i = 0; i < art.cells.length; i++) {
            if (art.cells[i] !== c) continue;
            if (await S(page, (i) => __cv.paint.ps.cells[i] === __cv.paint.art.cells[i] + 1, i)) continue;
            const p = await cellPoint(page, i);
            await page.mouse.click(p.x, p.y);
        }
    }
    await page.waitForSelector('#reward-continue', { timeout: 6000 }).catch(() => {});
    ok(await page.isVisible('#reward-continue'), 'finishing the page shows the reward card');
    await page.screenshot({ path: path.join(OUT, 'desktop-reward.png') });
    const gWick = (await state(page)).glimmer;
    ok(gWick > 300, `Wick pays out (${gWick.toFixed(0)})`);
    await page.click('#reward-continue');
    await page.waitForTimeout(100);
    ok((await state(page)).dlg, 'the after-scene plays');
    await untilDialogueGone(page, () => page.keyboard.press('Enter'));
    await page.waitForTimeout(150);
    await untilDialogueGone(page, () => page.keyboard.press('Enter'));
    st = await state(page);
    ok(st.screen === 'paint' && st.art === 'comet', `the story moves on to Comet (${st.screen} ${st.art})`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    ok((await state(page)).screen === 'chart', 'Esc goes back to the Star Chart');
    ok(await page.isVisible('.page-tile.done'), 'the chart shows Wick restored');
    await page.screenshot({ path: path.join(OUT, 'desktop-chart.png') });

    await page.click('#chart-skills');
    const skyH = () => S(page, () => document.getElementById('sky').getBoundingClientRect().height);
    const sky0 = await skyH();
    await page.click('.sk-node[data-skill="flourish"]');
    ok(await skyH() === sky0, 'selecting another star does not resize the chart');
    await page.click('.sk-node[data-skill="lantern"]');
    await page.click('#skill-buy');
    ok(await skyH() === sky0, `learning a skill does not resize the chart (${sky0} → ${await skyH()})`);
    ok(await S(page, () => __cv.state.skills.includes('lantern')), 'Lantern Light learned by click');
    ok((await state(page)).glimmer < gWick, 'it cost Glimmer');
    await page.screenshot({ path: path.join(OUT, 'desktop-skills.png') });
    await page.click('#skills-back');

    await page.click('#chart-gallery');
    ok(await page.isVisible('.g-tile'), 'the gallery has Wick');
    await page.click('.g-tile');
    const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        page.click('#modal-card button:has-text("Share")'),
    ]);
    ok(!!dl && dl.suggestedFilename() === 'wick.png', 'Share downloads a PNG where sharing files is not supported');
    await page.keyboard.press('Escape');
    await page.click('#gallery-back');

    await page.reload();
    await page.waitForFunction(() => window.__cv);
    ok(await page.isVisible('#btn-continue'), 'after a reload, Continue is offered');
    const kept = await S(page, () => ({ done: __cv.state.pages.wick?.done, lantern: __cv.state.skills.includes('lantern'), seen: __cv.state.seen.length }));
    ok(kept.done && kept.lantern && kept.seen >= 3, `the save kept the page, the skill and the story ${JSON.stringify(kept)}`);
    await page.click('#btn-continue');
    ok((await state(page)).screen === 'chart', 'Continue opens the chart');
    ok(!(await S(page, () => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll');
    ok(!errors.length, `no errors: ${errors.join(' | ')}`);
    await ctx.close();
}

/* ───────────── phones ───────────── */
async function multi(cdp, type, pts) {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
}
async function drag(cdp, from, to, steps = 8) {
    await multi(cdp, 'touchStart', [from]);
    for (let k = 1; k <= steps; k++) await multi(cdp, 'touchMove', [[from[0] + ((to[0] - from[0]) * k) / steps, from[1] + ((to[1] - from[1]) * k) / steps]]);
    await multi(cdp, 'touchEnd', []);
    await new Promise((r) => setTimeout(r, SETTLE));
}

if (want('phones')) {
    for (const [w, h] of [[390, 844], [844, 390]]) {
        const tag = `${w}x${h}`;
        console.log(`— phone ${tag}`);
        errors = [];
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
        const page = await newPage(ctx);
        const cdp = await ctx.newCDPSession(page);
        const tap = (x, y) => page.touchscreen.tap(x, y);
        const tapEl = async (sel) => { const r = await page.locator(sel).boundingBox(); await tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(80); };
        await backLinkCheck(page, `${tag} title`);
        await tapEl('#btn-new');
        await page.waitForTimeout(80);
        ok((await state(page)).dlg, `${tag}: Begin by tap opens the prologue`);
        await untilDialogueGone(page, () => tap(w / 2, h - 60));
        let st = await state(page);
        ok(st.screen === 'paint', `${tag}: the dialogue taps through to the page`);
        await page.waitForTimeout(SETTLE);
        await backLinkCheck(page, `${tag} paint`);

        const lay = await S(page, () => {
            const stage = document.getElementById('stage').getBoundingClientRect(), c = document.getElementById('paint-canvas').getBoundingClientRect();
            const ctl = [...document.querySelectorAll('.tool, .swatch, #zoom-in, #zoom-out, #zoom-fit, #paint-back')].filter((e) => e.offsetParent).map((e) => {
                const r = e.getBoundingClientRect();
                return { id: e.title || e.id || e.className, w: r.width, h: r.height, on: r.top >= -1 && r.bottom <= innerHeight + 1 && (e.classList.contains('swatch') || (r.left >= -1 && r.right <= innerWidth + 1)) };
            });
            const back = document.getElementById('back-link').getBoundingClientRect();
            const under = [...document.querySelectorAll('.screen.active button, .screen.active .glim')].filter((e) => {
                const r = e.getBoundingClientRect();
                return r.width && r.left < back.right && r.right > back.left && r.top < back.bottom && r.bottom > back.top;
            }).map((e) => e.id || e.className);
            return { fill: Math.abs(stage.width - c.width) < 2 && Math.abs(stage.height - c.height) < 2, stageH: stage.height, ctl, under, hscroll: document.documentElement.scrollWidth > innerWidth };
        });
        ok(lay.fill, `${tag}: the canvas fills its stage`);
        ok(lay.stageH > h * 0.35, `${tag}: the picture gets a good share of the screen (${lay.stageH.toFixed(0)}px)`);
        const tooSmall = lay.ctl.filter((s) => s.w < 43.5 || s.h < 43.5);
        ok(!tooSmall.length, `${tag}: controls are at least 44px: ${JSON.stringify(tooSmall)}`);
        const off = lay.ctl.filter((s) => !s.on);
        ok(!off.length, `${tag}: controls on screen: ${JSON.stringify(off)}`);
        ok(!lay.under.length, `${tag}: nothing under the back link: ${lay.under}`);
        ok(!lay.hscroll, `${tag}: no sideways scroll`);

        // pinch out with two fingers: zooms in, paints nothing
        const cr = await page.locator('#paint-canvas').boundingBox();
        const mx = cr.x + cr.width / 2, my = cr.y + cr.height / 2;
        st = await state(page);
        const s0 = st.s, c0 = st.correct, m0 = st.mistakes;
        await multi(cdp, 'touchStart', [[mx - 20, my], [mx + 20, my]]);
        for (let k = 1; k <= 10; k++) await multi(cdp, 'touchMove', [[mx - 20 - k * 9, my], [mx + 20 + k * 9, my]]);
        await multi(cdp, 'touchEnd', []);
        await page.waitForTimeout(60);
        st = await state(page);
        ok(st.s > s0 * 2.5, `${tag}: a pinch zooms in (${s0.toFixed(1)} → ${st.s.toFixed(1)})`);
        ok(st.correct === c0 && st.mistakes === m0, `${tag}: the pinch painted nothing`);
        // a second finger that lands late (after the first started a stroke) still pinches
        await multi(cdp, 'touchStart', [[mx, my]]);
        await page.waitForTimeout(60);
        await multi(cdp, 'touchStart', [[mx, my], [mx + 60, my + 60]]);
        for (let k = 1; k <= 5; k++) await multi(cdp, 'touchMove', [[mx + k * 4, my + k * 4], [mx + 60 - k * 4, my + 60 - k * 4]]);
        await multi(cdp, 'touchEnd', []);
        st = await state(page);
        ok(st.correct === c0 && st.mistakes === m0, `${tag}: a late second finger undoes the first finger's dab`);
        // two-finger drag pans
        const cam0 = await S(page, () => ({ ...__cv.paint.painter.cam }));
        await multi(cdp, 'touchStart', [[mx - 40, my], [mx + 40, my]]);
        for (let k = 1; k <= 6; k++) await multi(cdp, 'touchMove', [[mx - 40 + k * 10, my + k * 6], [mx + 40 + k * 10, my + k * 6]]);
        await multi(cdp, 'touchEnd', []);
        const cam1 = await S(page, () => ({ ...__cv.paint.painter.cam }));
        ok(Math.hypot(cam1.ox - cam0.ox, cam1.oy - cam0.oy) > 20 && Math.abs(cam1.s - cam0.s) < cam0.s * 0.15, `${tag}: a two-finger drag pans`);
        await page.screenshot({ path: path.join(OUT, `phone-${tag}-zoomed.png`) });

        // a tap paints one pixel
        const target = await S(page, () => {
            const p = __cv.paint.painter, art = __cv.paint.art, ps = __cv.paint.ps;
            for (let i = 0; i < art.total; i++) {
                if (art.cells[i] !== __cv.paint.color || ps.cells[i]) continue;
                const { sx, sy } = p.cellToScreen((i % art.w) + 0.5, Math.floor(i / art.w) + 0.5);
                if (sx > 30 && sy > 30 && sx < p.W - 70 && sy < p.H - 30) return i;
            }
            return -1;
        });
        ok(target >= 0, `${tag}: a pixel to tap is on screen`);
        const pt = await cellPoint(page, target);
        await tap(pt.x, pt.y);
        await page.waitForTimeout(SETTLE);
        st = await state(page);
        ok(st.correct === c0 + 1, `${tag}: a tap paints one pixel (${st.correct - c0})`);
        // a one-finger drag across a run of four of the same number
        const run = await S(page, () => {
            const p = __cv.paint.painter, art = __cv.paint.art, ps = __cv.paint.ps;
            for (let c = 0; c < art.palette.length; c++) for (let y = 0; y < art.h; y++) for (let x = 0; x + 3 < art.w; x++) {
                let good = true;
                for (let k = 0; k < 4; k++) { const i = y * art.w + x + k; if (art.cells[i] !== c || ps.cells[i]) good = false; }
                if (!good) continue;
                const a = p.cellToScreen(x + 0.5, y + 0.5), b = p.cellToScreen(x + 3.5, y + 0.5);
                if (a.sx > 20 && b.sx < p.W - 70 && a.sy > 20 && a.sy < p.H - 20) return { from: y * art.w + x, to: y * art.w + x + 3, c };
            }
            return null;
        });
        if (run) {
            await S(page, (c) => __cv.paint.selectColor(c), run.c);
            const a = await cellPoint(page, run.from), b = await cellPoint(page, run.to);
            const before = (await state(page)).correct;
            await drag(cdp, [a.x, a.y], [b.x, b.y]);
            st = await state(page);
            ok(st.correct >= before + 4, `${tag}: a one-finger drag paints a run (${st.correct - before})`);
        } else ok(false, `${tag}: no run of four to drag across`);
        // the Move tool pans with one finger and paints nothing
        await tapEl('.tool[data-tool="move"]');
        const before = await state(page), camA = await S(page, () => ({ ...__cv.paint.painter.cam }));
        await drag(cdp, [mx, my], [mx - 60, my - 40]);
        const camB = await S(page, () => ({ ...__cv.paint.painter.cam }));
        st = await state(page);
        ok(Math.hypot(camB.ox - camA.ox, camB.oy - camA.oy) > 30 && st.correct === before.correct && st.mistakes === before.mistakes, `${tag}: Move pans with one finger ${JSON.stringify([camA, camB, before.correct, st.correct, await S(page, () => __cv.paint.tool)])}`);
        await tapEl('#zoom-out');
        await page.waitForTimeout(500);
        const sz = (await state(page)).s;
        ok(sz < st.s, `${tag}: the − button zooms out (${st.s} → ${sz})`);
        await page.screenshot({ path: path.join(OUT, `phone-${tag}.png`) });
        ok(!errors.length, `${tag}: no errors: ${errors.join(' | ')}`);
        await ctx.close();
    }
}

/* ───────────── nostorage ───────────── */
if (want('nostorage')) {
    console.log('— nostorage');
    errors = [];
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    const page = await newPage(ctx, () => {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); }, configurable: true });
    });
    await page.click('#btn-new');
    await untilDialogueGone(page, () => page.keyboard.press('Enter'));
    ok((await state(page)).screen === 'paint', 'nostorage: boots into the first page');
    const i = await S(page, () => [...__cv.paint.art.cells].findIndex((c) => c === __cv.paint.color));
    const pt = await cellPoint(page, i);
    await page.mouse.click(pt.x, pt.y);
    ok((await state(page)).correct === 1, 'nostorage: painting works');
    await page.keyboard.press('Escape');
    ok(!errors.length, `nostorage: no errors: ${errors.join(' | ')}`);
    await ctx.close();
}

await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
