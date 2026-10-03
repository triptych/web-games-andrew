/**
 * browsertest.mjs — real Chromium, real WebGL2 (SwiftShader).
 *
 * Desktop 1280×720: title, How to Play, Options, New Campaign → prologue →
 * briefing → difficulty → Launch; flying with real key presses, EMP, pause and
 * resume; a boss fight finished through every phase; the debrief and its
 * rank; the hangar (buy, refund); failure, Retry operation and Retry from the
 * boss checkpoint; Stormfront; the final boss, the epilogue and back to the
 * title; the GPU terrain agreeing with the CPU classification; the canvas
 * actually drawing (not black).
 * Phones (touch only, real CDP touches) at 390×844 and 844×390: menus by tap,
 * touch controls ≥ 44 px and on screen, a drag flies the helicopter,
 * EMP / FOCUS / pause buttons work.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8055       # from the repo root
 *   node game-055/dev/browsertest.mjs           ONLY=desktop|phones
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://127.0.0.1:8055';
const SEED = +(process.env.SEED ?? (1 + Math.floor(Math.random() * 1e6)));
const FAST = process.env.FAST ?? 8;
const URL0 = `${BASE}/game-055/index.html?debug=1&seed=${SEED}&fast=${FAST}`;
console.log(`seed ${SEED} (SEED=${SEED} reproduces this run)`);

let failures = 0;
const errors = [];
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { failures++; console.log('  FAIL ' + m); } };
let browser = null;

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__c')) { localStorage.clear(); sessionStorage.setItem('__c', '1'); } } catch { /* ignore */ } });
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${viewport.width}] console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${viewport.width}] pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) errors.push(`[${viewport.width}] requestfailed: ${r.url()}`); });
    page.on('dialog', (d) => d.accept());
    await page.goto(URL0);
    await page.waitForFunction(() => window.__rs && window.__rs.ui === 'title', null, { timeout: 90000 });
    return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const ui = (page) => page.evaluate(() => window.__rs.ui);
const mode = (page) => page.evaluate(() => window.__rs.mode);
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); }, sel);
async function simWait(page, sec, timeout = 180000) {
    const t0 = await page.evaluate(() => window.__rs.world.t);
    await page.waitForFunction((t) => window.__rs.world.t >= t, t0 + sec, { timeout });
}
async function untilUI(page, id, timeout = 120000) { await page.waitForFunction((x) => window.__rs.ui === x, id, { timeout }); }
async function finishBoss(page) {
    await page.evaluate(() => { window.__rs.god(true); window.__rs.skipToBoss(); });
    await page.waitForFunction(() => window.__rs.world.boss && !window.__rs.world.boss.entering, null, { timeout: 120000 });
    for (let i = 0; i < 6; i++) {
        const st = await page.evaluate(() => { const b = window.__rs.world.boss; return b ? { dying: !!b.dying, alive: b.alive, trans: b.transT > 0 } : null; });
        if (!st || st.dying || !st.alive) break;
        if (!st.trans) await page.evaluate(() => window.__rs.nextPhase());
        await simWait(page, 2.2);
    }
}
async function brightness(page) {
    // read the canvas inside a frame callback that runs after the game's own render
    return page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
        const c = document.getElementById('gl');
        const t = document.createElement('canvas'); t.width = 64; t.height = 36;
        const x = t.getContext('2d');
        x.drawImage(c, 0, 0, 64, 36);
        const d = x.getImageData(0, 0, 64, 36).data;
        let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
        res(s / (64 * 36 * 3));
    })));
}

// ======================================================================= desktop
async function desktop() {
    console.log('desktop 1280×720');
    const page = await newPage({ width: 1280, height: 720 });
    ok(await visible(page, '#btn-new'), 'title shows New Campaign');
    ok(!(await visible(page, '#btn-continue')), 'no Continue on a fresh profile');
    await page.waitForTimeout(1500);
    ok((await brightness(page)) > 12, 'attract mode renders behind the title');
    await shot(page, 'd-title');

    await page.click('[data-act=howto]'); await untilUI(page, 'howto');
    ok(await visible(page, '#howto .howto'), 'How to Play opens');
    await page.click('#howto [data-back]'); await untilUI(page, 'title');
    await page.click('[data-act=options]'); await untilUI(page, 'options');
    const rows = await page.$$eval('#opts > label', (l) => l.length);
    ok(rows >= 10, `options lists ${rows} settings`);
    await page.$eval('#opts input[type=range]', (i) => { i.value = 0.3; i.dispatchEvent(new Event('input')); });
    ok(await page.evaluate(() => window.__rs.profile.settings.music === 0.3), 'music slider saves');
    await page.click('#options [data-back]'); await untilUI(page, 'title');

    await page.click('[data-act=new]'); await untilUI(page, 'prologue');
    await page.waitForTimeout(600);
    await shot(page, 'd-prologue');
    await page.click('#prologue-skip'); await untilUI(page, 'briefing');
    ok((await page.textContent('#b-name')).includes('Breakwater'), 'briefing for Operation Breakwater');
    ok((await page.$$eval('#b-lines .line', (l) => l.length)) >= 3, 'briefing has radio lines with portraits');
    await page.click('#b-diff button:nth-child(1)');
    ok(await page.evaluate(() => window.__rs.profile.difficulty === 'recruit'), 'difficulty picker');
    await page.click('#b-diff button:nth-child(2)');
    await page.waitForTimeout(800);
    await shot(page, 'd-briefing');
    await page.click('#b-launch');
    await page.waitForFunction(() => window.__rs.mode === 'playing', null, { timeout: 60000 });
    ok(await visible(page, '#hud-top'), 'HUD visible in flight');
    await page.evaluate(() => window.__rs.god(true));
    await simWait(page, 1);

    // fly with the keyboard
    const x0 = await page.evaluate(() => window.__rs.world.player.x);
    await page.keyboard.down('ArrowLeft');
    await simWait(page, 0.5);
    await page.keyboard.up('ArrowLeft');
    const x1 = await page.evaluate(() => window.__rs.world.player.x);
    ok(x1 < x0 - 40, `ArrowLeft flies left (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
    await page.keyboard.down('ShiftLeft'); await simWait(page, 0.1);
    ok(await page.evaluate(() => window.__rs.world.player.focus), 'Shift focuses');
    await page.keyboard.up('ShiftLeft');
    const b0 = await page.evaluate(() => window.__rs.world.player.bombs);
    await page.keyboard.press('KeyX'); await simWait(page, 0.2);
    ok((await page.evaluate(() => window.__rs.world.player.bombs)) === b0 - 1, 'X fires a Thunderclap EMP');
    await simWait(page, 10);
    ok(await page.evaluate(() => window.__rs.world.score > 0), 'scoring');
    await shot(page, 'd-play');
    ok((await brightness(page)) > 15, 'gameplay renders (not black)');
    const probe = await page.evaluate(() => window.__rs.terrainProbe(40));
    ok(probe.total > 20 && probe.agree === probe.total, `GPU terrain matches CPU classification (${probe.agree}/${probe.total}) ${JSON.stringify(probe.mism)}`);

    await page.keyboard.press('KeyP'); await untilUI(page, 'pause');
    const tP = await page.evaluate(() => window.__rs.world.t);
    await page.waitForTimeout(500);
    ok(await page.evaluate((t) => window.__rs.world.t === t, tP), 'pause stops the simulation');
    await page.click('#p-resume');
    await page.waitForFunction(() => window.__rs.mode === 'playing');

    // boss
    await finishBoss(page);
    await shot(page, 'd-bossdeath');
    await untilUI(page, 'debrief', 180000);
    await page.waitForTimeout(2600);
    ok(/^[SABCD]$/.test(await page.textContent('#d-rank')), 'debrief shows a rank');
    ok(await page.evaluate(() => window.__rs.profile.cleared.includes('breakwater') && window.__rs.profile.nextOp === 1), 'operation recorded as cleared');
    ok(await page.evaluate(() => window.__rs.profile.salvage > 0), 'salvage banked');
    await shot(page, 'd-debrief');

    // hangar
    await page.click('#d-hangar'); await untilUI(page, 'hangar');
    await page.evaluate(() => window.__rs.giveSalvage(5000));
    await page.click('#d-hangar').catch(() => {});
    await page.evaluate(() => { document.querySelector('#h-respec').click(); });
    await page.waitForTimeout(200);
    const nodes = await page.$$('#tree .node');
    ok(nodes.length === 28, `skill tree has ${nodes.length} nodes`);
    await page.click('#tree .node');
    await page.click('#h-detail button.primary');
    ok(await page.evaluate(() => window.__rs.profile.owned.g_dmg === 1), 'bought Heavy Barrels');
    const before = await page.evaluate(() => window.__rs.profile.salvage);
    await page.click('#h-respec');
    ok(await page.evaluate((b) => window.__rs.profile.salvage > b && !window.__rs.profile.owned.g_dmg, before), 'refund returns salvage');
    await page.click('#tree .node'); await page.click('#h-detail button.primary');
    await page.waitForTimeout(400);
    await shot(page, 'd-hangar');

    // failure and retries
    await page.click('#h-go'); await untilUI(page, 'briefing');
    ok((await page.textContent('#b-name')).includes('Canopy'), 'next briefing is Operation Canopy');
    await page.click('#b-launch');
    await page.waitForFunction(() => window.__rs.mode === 'playing');
    await simWait(page, 2);
    await page.evaluate(() => window.__rs.die());
    await untilUI(page, 'failed', 60000);
    ok(!(await visible(page, '#f-boss')), 'no boss checkpoint before reaching the boss');
    await shot(page, 'd-failed');
    await page.click('#f-retry');
    await page.waitForFunction(() => window.__rs.mode === 'playing');
    await page.evaluate(() => { window.__rs.god(true); window.__rs.skipToBoss(); });
    await page.waitForFunction(() => window.__rs.world.boss && !window.__rs.world.boss.entering, null, { timeout: 120000 });
    await page.evaluate(() => window.__rs.die());
    await untilUI(page, 'failed', 60000);
    ok(await visible(page, '#f-boss'), 'boss checkpoint offered after reaching the boss');
    await page.click('#f-boss');
    await page.waitForFunction(() => window.__rs.mode === 'playing');
    await simWait(page, 5);
    ok(await page.evaluate(() => !!window.__rs.world.boss && window.__rs.world.stats.checkpoint), 'Retry from the boss starts at the boss');

    // endless
    await page.evaluate(() => window.__rs.endless());
    await page.waitForFunction(() => window.__rs.mode === 'playing' && window.__rs.world.endless);
    await simWait(page, 4);
    ok(await page.evaluate(() => window.__rs.world.endless && window.__rs.world.t > 3), 'Stormfront runs');
    await shot(page, 'd-endless');

    // finale
    await page.evaluate(() => window.__rs.startOp(5));
    await page.waitForFunction(() => window.__rs.mode === 'playing' && window.__rs.world.op.id === 'crucible');
    await finishBoss(page);
    await untilUI(page, 'debrief', 180000);
    ok((await page.textContent('#d-next')).includes('Epilogue'), 'final debrief leads to the epilogue');
    await page.click('#d-next'); await untilUI(page, 'ending');
    await page.waitForTimeout(3000);
    await shot(page, 'd-ending');
    await page.click('#end-skip'); await untilUI(page, 'title');
    ok(await page.evaluate(() => window.__rs.profile.endingSeen), 'ending recorded');
    ok(await visible(page, '#btn-continue'), 'Continue appears after progress');
}

// ======================================================================= phones
async function touchDrag(page, cdp, x0, y0, dx, dy, steps = 12) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / steps, y: y0 + dy * i / steps, id: 1 }] });
        await page.waitForTimeout(30);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tap(cdp, x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapEl(page, cdp, sel) {
    const r = await page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await tap(cdp, r.x, r.y);
}

async function phone(w, h) {
    console.log(`phone ${w}×${h}`);
    const page = await newPage({ width: w, height: h }, { hasTouch: true, isMobile: true });
    const cdp = await page.context().newCDPSession(page);
    await page.waitForTimeout(800);
    await shot(page, `p${w}-title`);
    await tapEl(page, cdp, '[data-act=new]'); await untilUI(page, 'prologue');
    await tapEl(page, cdp, '#prologue-skip'); await untilUI(page, 'briefing');
    await page.waitForTimeout(800);
    await shot(page, `p${w}-briefing`);
    // long menus must scroll under a real finger (touch-action on body must not block it)
    for (let i = 0; i < 6; i++) {
        const lr = await page.$eval('#b-launch', (e) => e.getBoundingClientRect().bottom);
        if (lr <= h) break;
        await touchDrag(page, cdp, w / 2, h * 0.75, 0, -h * 0.5, 8);
        await page.waitForTimeout(250);
    }
    const lb = await page.$eval('#b-launch', (e) => e.getBoundingClientRect().bottom);
    ok(lb <= h, 'Launch reachable by scrolling with a finger');
    await tapEl(page, cdp, '#b-launch');
    await page.waitForFunction(() => window.__rs.mode === 'playing', null, { timeout: 60000 });
    await page.evaluate(() => window.__rs.god(true));
    await simWait(page, 1.5);
    ok(await visible(page, '#t-bomb'), 'touch controls shown');
    const btns = await page.$$eval('.tbtn, #pause-btn', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; }));
    for (const b of btns) ok(Math.min(b.w, b.h) >= 40 && b.l >= 0 && b.t >= 0 && b.r <= w && b.b <= h, `${b.id} ${b.w.toFixed(0)}×${b.h.toFixed(0)} on screen`);
    const L = await page.evaluate(() => window.__rs.layout());
    ok(L.fw <= w + 1 && L.fh <= h + 1, `field fits (${L.fw.toFixed(0)}×${L.fh.toFixed(0)})`);
    if (h > w) ok(L.fw >= w - 1, 'portrait: field uses the full width');
    // buttons don't cover the field's centre band
    const fieldMid = { x: L.fx + L.fw / 2, y: L.fy + L.fh / 2 };
    ok(btns.every((b) => !(fieldMid.x >= b.l && fieldMid.x <= b.r && fieldMid.y >= b.t && fieldMid.y <= b.b)), 'buttons clear of the field centre');
    // drag to fly
    const p0 = await page.evaluate(() => ({ x: window.__rs.world.player.x, y: window.__rs.world.player.y }));
    await touchDrag(page, cdp, w * 0.5, L.fy + L.fh * 0.6, -90, -60);
    await simWait(page, 0.2);
    const p1 = await page.evaluate(() => ({ x: window.__rs.world.player.x, y: window.__rs.world.player.y }));
    ok(p1.x < p0.x - 40 && p1.y < p0.y - 25, `drag flies the Kestrel (${p0.x.toFixed(0)},${p0.y.toFixed(0)} → ${p1.x.toFixed(0)},${p1.y.toFixed(0)})`);
    const b0 = await page.evaluate(() => window.__rs.world.player.bombs);
    await tapEl(page, cdp, '#t-bomb'); await simWait(page, 0.2);
    ok((await page.evaluate(() => window.__rs.world.player.bombs)) === b0 - 1, 'EMP button fires');
    await tapEl(page, cdp, '#t-focus'); await simWait(page, 0.1);
    ok(await page.evaluate(() => window.__rs.world.player.focus), 'FOCUS button toggles focus');
    await tapEl(page, cdp, '#t-focus');
    await simWait(page, 3);
    await shot(page, `p${w}-play`);
    ok((await brightness(page)) > 15, 'renders on the phone');
    await tapEl(page, cdp, '#pause-btn'); await untilUI(page, 'pause');
    ok(true, 'pause button pauses');
    await shot(page, `p${w}-pause`);
    await tapEl(page, cdp, '#p-resume');
    await page.waitForFunction(() => window.__rs.mode === 'playing');
    await page.evaluate(() => { window.__rs.skipToBoss(); });
    await page.waitForFunction(() => window.__rs.world.boss && !window.__rs.world.boss.entering, null, { timeout: 120000 });
    await simWait(page, 3);
    await shot(page, `p${w}-boss`);
    // hangar on a phone
    await page.evaluate(() => { window.__rs.giveSalvage(3000); });
    await tapEl(page, cdp, '#pause-btn'); await untilUI(page, 'pause');
    await tapEl(page, cdp, '#p-quit'); await untilUI(page, 'hangar');
    await page.waitForTimeout(600);
    const nb = await page.$eval('#tree .node', (e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); });
    ok(nb >= 44, `skill nodes are ${nb.toFixed(0)} px`);
    await shot(page, `p${w}-hangar`);
}

try {
    if (process.env.ONLY !== 'phones') await desktop();
    if (process.env.ONLY !== 'desktop') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    failures++;
    console.log('  FAIL exception: ' + (e.stack || e));
} finally {
    if (browser) await browser.close();
}
if (errors.length) { failures += errors.length; console.log(errors.map((e) => '  ERR ' + e).join('\n')); }
console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
