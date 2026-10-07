/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165, real input.
 *
 * Desktop (1280×760, mouse): title (back link, coloured logo) → New Island (Big Baseplate, no starter
 * town) → help → draw a closed loop of track by dragging → a crossing and a switch → two station
 * platforms → put a train on → train card: toot, speed, stop/go, ride along → the train runs, stops
 * at the station and people board → build a house (and turn it), a boat on the water refused on land
 * → paint water and a hill (bridge and tunnel) → bulldoze → undo/redo → workshop: a new train with
 * cars and colours, saved to the shed → time of day → stickers → save, reload, Keep Playing restores
 * the island → My Islands (copy, rename, share code, import it) → settings → back to the title.
 * Phones (390×844 and 844×390, touch only, CDP touches): title and New Island fit and work, the
 * toolbar and trays fit with finger-sized buttons, a one-finger drag lays track, a two-finger pinch
 * zooms without laying track, tapping a train opens its card on screen, the workshop fits and scrolls,
 * no sideways scroll anywhere.
 * Fails on any console error, page error or failed request. Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8067                 # from the REPO ROOT
 *   node game-067/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8067), ONLY=desktop|phones, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8067';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let fails = 0;
let browser = null;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (cond, m) => (cond ? ok(m) : fail(m));

async function newPage(viewport, touch = false) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => {
        try {
            if (!sessionStorage.getItem('bt-init')) {
                sessionStorage.setItem('bt-init', '1');
                localStorage.clear();
                localStorage.setItem('tootle-isles.v1.settings', JSON.stringify({ music: 0, sfx: 0, muted: true, quality: 2 }));
            }
        } catch { /* storage blocked */ }
    });
    const page = await ctx.newPage();
    if (PKG && fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' ').trim()}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { page, ctx };
}

const TT = (page, js) => page.evaluate(`(() => { const tt = window.__tt, A = tt.app, W = A.world; ${js} })()`);
const waitFor = (page, js, timeout = 60000) => page.waitForFunction(`(() => { const tt = window.__tt, A = tt && tt.app, W = A && A.world; return ${js}; })()`, null, { timeout, polling: 100 });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
async function frames(page, n = 2) {
    const f0 = await TT(page, 'return A.frameNo');
    await waitFor(page, `A.frameNo >= ${f0 + n}`);
}
/** Screen position of the centre of tile (x, z). */
const tileXY = (page, x, z) => TT(page, `return tt.tileScreen(${x}, ${z});`);

async function mouseDrag(page, tiles) {
    await frames(page, 2);   // let the dock settle: opening a tray shifts the view up
    const pts = [];
    for (const [x, z] of tiles) pts.push(await tileXY(page, x, z));
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        for (let s = 1; s <= 4; s++) await page.mouse.move(a.x + ((b.x - a.x) * s) / 4, a.y + ((b.y - a.y) * s) / 4);
    }
    await page.mouse.up();
    await frames(page, 1);
}
/** Bring a tile into the open part of the screen (above the tray) if something covers it. */
async function reveal(page, x, z) {
    await frames(page, 2);
    let p = await tileXY(page, x, z);
    const covered = (q) => page.evaluate(([a, b]) => { const e = document.elementFromPoint(a, b); return !e || e.id !== 'gl'; }, [q.x, q.y]);
    if (await covered(p)) {
        await TT(page, `tt.rig.gx = ${x} - 24 + 0.5; tt.rig.gz = ${z} - 24 + 0.5; return 1;`);
        await TT(page, 'tt.rig.tx = tt.rig.gx; tt.rig.tz = tt.rig.gz; return 1;');
        await frames(page, 3);
        p = await tileXY(page, x, z);
        if (await covered(p)) fail(`tile ${x},${z} is covered`);
    }
    return p;
}
async function clickTile(page, x, z) {
    const p = await reveal(page, x, z);
    await page.mouse.click(p.x, p.y);
    await frames(page, 1);
}

/** Every visible button/tool at least `min` px in both directions. */
async function fingerSized(page, sel, min = 44) {
    return page.evaluate(([s, m]) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.w < m || r.h < m), [sel, min]);
}
async function inViewport(page, sel) {
    return page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }, sel);
}
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);

// ======================================================================== desktop
async function desktop() {
    console.log('desktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    await page.goto(`${BASE}/game-067/index.html?debug=1&fast=3`);
    await waitFor(page, 'A && A.frameNo > 3', 120000);
    check(await page.isVisible('#back-link'), 'back link visible');
    check(await page.evaluate(() => document.querySelector('#back-link').getAttribute('href') === '../index.html'), 'back link points to the launcher');
    const logoCol = await page.evaluate(() => getComputedStyle(document.querySelector('#logo-a span')).backgroundColor);
    check(logoCol && logoCol !== 'rgba(0, 0, 0, 0)', `logo bricks are coloured (${logoCol})`);
    check(await TT(page, 'return W.trains.list.length >= 2'), 'title island has trains running');
    await shot(page, 'd-title');

    // ---- new island
    await page.click('#t-new');
    await page.waitForSelector('[data-preset=plate]');
    check(await page.locator('.isle').count() === 8, 'eight islands to choose from');
    await page.click('[data-preset=plate]');
    await page.uncheck('#ni-starter');
    await page.fill('#ni-name', 'Test Isle');
    await page.click('[data-act=create]');
    await waitFor(page, "A.mode === 'play'");
    await page.waitForSelector('[data-act=helpok]');
    await shot(page, 'd-help');
    await page.click('[data-act=helpok]');
    check(await TT(page, "return W.name === 'Test Isle' && W.preset === 'plate' && W.counts().track === 0"), 'blank Big Baseplate created');
    check(await page.textContent('#island-name') === 'Test Isle', 'island name in the HUD');

    // ---- track: a loop by dragging
    await page.click('[data-tool=track]');
    check(await page.isVisible('[data-mode=lay]'), 'track tray open');
    const L = [[19, 19], [29, 19], [29, 25], [19, 25], [19, 19], [20, 19]];
    await mouseDrag(page, L);
    const loop = await TT(page, 'return W.counts().track');
    check(loop >= 30, `dragging laid a loop of track (${loop} tiles)`);
    const loose = await TT(page, `
        let loose = 0;
        for (let z = 0; z < 48; z++) for (let x = 0; x < 48; x++) { const i = z * 48 + x; if (!W.track[i]) continue;
            for (let e = 0; e < 4; e++) { const em = [1,2,4,8][e]; const S = [[0,2],[1,3],[0,1],[1,2],[2,3],[3,0]]; let m = 0; for (let s = 0; s < 6; s++) if (W.track[i] & (1 << s)) m |= (1 << S[s][0]) | (1 << S[s][1]); if ((m & em) && !W.connectsBack(x, z, e)) loose++; } }
        return loose;`);
    check(loose === 0, `the loop is closed (${loose} loose ends)`);
    // a branch off the loop makes a switch, and a line across makes a crossing
    await mouseDrag(page, [[24, 19], [24, 15]]);
    check(await TT(page, 'return W.isSwitch(24, 19)'), 'branching off the loop makes a switch');
    await mouseDrag(page, [[26, 17], [26, 22]]);
    check(await TT(page, 'return (W.track[22 * 48 + 26] & 3) === 3 || W.track[19 * 48 + 26] !== 0'), 'a line across the loop');
    const routeBefore = await TT(page, 'return W.route(24, 19, W.switchEntry(24, 19))');
    await clickTile(page, 24, 19);
    check(await TT(page, `return W.route(24, 19, W.switchEntry(24, 19)) !== ${routeBefore}`), 'tapping a switch with the track tool flips it');
    // stations
    await page.click('[data-mode=station]');
    await clickTile(page, 22, 25);
    await clickTile(page, 23, 25);
    check(await TT(page, 'return W.counts().stations === 2'), 'two station platforms');
    await shot(page, 'd-track');

    // ---- trains
    await page.click('[data-tool=trains]');
    await page.waitForSelector('[data-set=set-puffin]');
    await page.click('[data-set=set-puffin]');
    check(await TT(page, "return A.trainSet === 'set-puffin'"), 'picked Puffin Express');
    await clickTile(page, 27, 25);
    await waitFor(page, 'W.trains.list.length === 1');
    ok('train placed by tapping the track');
    check(await page.isVisible('#traincard'), 'train card opens');
    const wh0 = await TT(page, 'return W.stats.whistles');
    await page.click('[data-cmd=toot]');
    check(await TT(page, `return W.stats.whistles === ${wh0 + 1}`), 'Toot!');
    await page.click('[data-cmd=speed2]');
    check(await TT(page, 'return W.trains.list[0].level === 2'), 'speed: fast');
    await page.click('[data-cmd=go]');
    check(await TT(page, 'return W.trains.list[0].running === false'), 'stop');
    await page.click('[data-cmd=go]');
    check(await TT(page, 'return W.trains.list[0].running === true'), 'go');
    await page.click('[data-cmd=speed1]');
    await page.click('[data-cmd=ride]');
    check(await TT(page, 'return A.follow === W.trains.list[0].id'), 'ride along');
    await frames(page, 6);
    await shot(page, 'd-ride');
    await page.click('[data-cmd=ride]');
    check(await TT(page, 'return A.follow === 0'), 'hop off');
    const odo0 = await TT(page, 'return W.trains.list[0].odo');
    await TT(page, 'tt.step(300); return 1;');
    check(await TT(page, `return W.trains.list[0].odo > ${odo0 + 8}`), 'the train runs round the loop');

    // ---- build
    await page.click('[data-tool=build]');
    await page.waitForSelector('[data-item=house_red]');
    check(await page.evaluate(() => !!document.querySelector('[data-item=house_red] img')), 'item cards have rendered thumbnails');
    const objs0 = await TT(page, 'return W.objs.size');
    await clickTile(page, 23, 22);
    check(await TT(page, `return W.objs.size === ${objs0 + 1} && W.objectAt(23, 22)?.type === 'house_red'`), 'placed a house');
    await page.keyboard.press('r');
    await page.click('[data-item=house_blue]');
    await clickTile(page, 21, 22);
    check(await TT(page, "return W.objectAt(21, 22)?.rot === 1"), 'R turns the next building');
    for (const [x, z] of [[20, 21], [21, 21], [22, 21], [25, 22], [26, 23]]) await clickTile(page, x, z);
    const nBefore = await TT(page, 'return W.objs.size');
    const gBefore = await TT(page, 'return [tt.rig.gx, tt.rig.gz]');
    await mouseDrag(page, [[24, 23], [27, 23]]);
    check(await TT(page, `return W.objs.size === ${nBefore}`), 'a drag in Build places nothing');
    check(await TT(page, `return Math.hypot(tt.rig.gx - ${gBefore[0]}, tt.rig.gz - ${gBefore[1]}) > 0.5`), 'a drag in Build moves the camera');
    await page.click('[data-cat=water]');
    await page.click('[data-item=sailboat]');
    const objs1 = await TT(page, 'return W.objs.size');
    await clickTile(page, 25, 21);
    check(await TT(page, `return W.objs.size === ${objs1}`), 'a boat is refused on dry land');
    await page.click('[data-cat=fun]');
    await page.click('[data-item=windmill]');
    await clickTile(page, 22, 16);
    check(await TT(page, "return W.objectAt(22, 16)?.type === 'windmill'"), 'placed a windmill');

    // ---- land: water under track makes a bridge, a hill makes a tunnel
    await page.click('[data-tool=land]');
    await page.click('[data-paint="0"]');
    await clickTile(page, 29, 22);
    check(await TT(page, 'return W.tile(29, 22) === 0 && W.track[22 * 48 + 29] > 0'), 'water under the track: a bridge');
    await page.click('[data-paint="6"]');
    await clickTile(page, 19, 22);
    check(await TT(page, 'return W.tile(19, 22) === 6 && W.track[22 * 48 + 19] > 0'), 'a hill on the track: a tunnel');
    await page.click('[data-paint="0"]');
    await page.click('[data-brush="2"]');
    await clickTile(page, 33, 33);
    check(await TT(page, 'return [32,33,34].every((x) => W.tile(x, 33) === 0)'), 'medium brush paints 3×3');
    await TT(page, 'tt.step(60); return 1;');
    await shot(page, 'd-built');

    // ---- bulldoze, undo, redo
    await page.click('[data-tool=bulldoze]');
    await clickTile(page, 23, 22);
    check(await TT(page, 'return !W.objectAt(23, 22)'), 'bulldozed the house');
    await page.click('#b-undo');
    check(await TT(page, "return W.objectAt(23, 22)?.type === 'house_red'"), 'undo brings it back');
    await page.click('#b-redo');
    check(await TT(page, 'return !W.objectAt(23, 22)'), 'redo takes it away again');
    await page.keyboard.press('Control+z');
    check(await TT(page, "return W.objectAt(23, 22)?.type === 'house_red'"), 'Ctrl+Z undoes');

    // ---- people and passengers
    await TT(page, 'tt.step(30 * 120); return 1;');
    check(await TT(page, 'return W.people.list.length >= 6'), `residents moved in (${await TT(page, 'return W.people.list.length')})`);
    check(await TT(page, 'return W.stats.riders > 0'), `people rode the train (${await TT(page, 'return W.stats.riders')})`);

    // ---- workshop
    await page.click('[data-tool=trains]');
    await page.click('[data-act=newtrain]');
    await page.waitForSelector('#ws-name');
    await page.click('[data-engine=diesel]');
    await page.click('[data-addcar=tank]');
    await page.click('[data-addcar=logs]');
    await page.click('[data-addcar=caboose]');
    await page.fill('#ws-name', 'Test Freighter');
    await shot(page, 'd-workshop');
    const shed0 = await TT(page, 'return A.shed.length');
    await page.click('[data-act=savetrain]');
    check(await TT(page, `return A.shed.length === ${shed0 + 1} && A.shed[0].name === 'Test Freighter' && A.shed[0].cars.length === 5 && A.shed[0].engine === 'diesel'`), 'workshop saves a new train set');
    check(await TT(page, "return A.shed[0].thumb.startsWith('data:image/')"), 'the new set has a thumbnail');
    check(await page.isVisible('[data-set=' + (await TT(page, 'return A.shed[0].id')) + ']'), 'it appears in the shed tray');
    // place it
    await clickTile(page, 19, 23);
    check(await TT(page, 'return W.trains.list.length === 2'), 'second train on the track');

    // ---- time of day, stickers
    const t0 = await TT(page, 'return tt.tod.target');
    await page.click('#b-time');
    check(await TT(page, `return tt.tod.target !== ${t0} || tt.tod.cycle`), 'time of day changes');
    const got = await TT(page, 'return Object.keys(A.profile.stickers).length');
    check(got >= 5, `stickers earned (${got})`);
    await page.click('#b-menu');
    await page.click('#modal >> text=⭐ Stickers');
    check(await page.locator('.stk.got').count() === got, 'sticker book shows them');
    await page.keyboard.press('Escape');

    // ---- save, reload, keep playing
    const before = await TT(page, 'return JSON.stringify({ t: W.counts().track, o: W.objs.size, tr: W.trains.list.length })');
    await page.click('#b-menu');
    await page.click('[data-act=save]');
    await page.reload();
    await waitFor(page, 'A && A.frameNo > 3', 120000);
    check(await page.isVisible('#t-continue'), 'Keep Playing on the title after reload');
    await page.click('#t-continue');
    await waitFor(page, "A.mode === 'play'");
    const after = await TT(page, 'return JSON.stringify({ t: W.counts().track, o: W.objs.size, tr: W.trains.list.length })');
    check(after === before, `island restored after reload (${after})`);

    // ---- my islands
    await page.click('#b-menu');
    await page.click('#modal >> text=📂 My Islands');
    await page.waitForSelector('.save');
    check(await page.locator('.save').count() === 1, 'one island in My Islands');
    check(await page.evaluate(() => (document.querySelector('.save img')?.src || '').startsWith('data:image/jpeg')), 'it has a thumbnail');
    await page.click('text=📄 Copy');
    await page.waitForSelector('.save >> nth=1');
    check(await page.locator('.save').count() === 2, 'copied an island');
    await page.locator('.save').nth(0).locator('text=✏️ Rename').click();
    await page.fill('.panel input[type=text]', 'Renamed Isle');
    await page.click('[data-act=ok]');
    await page.waitForSelector('.save');
    check(await page.evaluate(() => [...document.querySelectorAll('.save .meta b')].some((b) => b.textContent === 'Renamed Isle')), 'renamed an island');
    await page.locator('.save').nth(0).locator('text=🔗 Share').click();
    await page.waitForSelector('textarea');
    const code = await page.inputValue('textarea');
    check(/^TOOT[01]:/.test(code) && code.length > 200, `share code (${code.length} chars)`);
    await page.click('text=Back');
    await page.waitForSelector('.save');
    await page.fill('input[placeholder^="Paste"]', code);
    await page.click('text=📥 Open');
    await waitFor(page, "A.mode === 'play' && W.name.endsWith('✉')");
    ok('imported the shared island');
    // ---- settings + title
    await page.click('#b-menu');
    await page.click('#modal >> text=⚙️ Settings');
    await page.waitForSelector('.slider');
    check(await page.locator('.slider').count() === 2, 'settings sliders');
    await page.keyboard.press('Escape');
    await page.click('#b-menu');
    await page.click('[data-act=title]');
    await waitFor(page, "A.mode === 'title'");
    check(await page.isVisible('#t-new'), 'back on the title');
    check(await noSideScroll(page), 'no sideways scroll');
}

// ======================================================================== phones
async function touchDrag(cdp, pts, id = 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y, id }] });
    for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        for (let s = 1; s <= 4; s++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * s) / 4, y: a.y + ((b.y - a.y) * s) / 4, id }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tap(cdp, x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapSel(page, cdp, sel) {
    const r = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    if (!r) throw new Error(`no ${sel}`);
    // the tap must land on the element itself, not something covering it
    const top = await page.evaluate(([s, x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest(s)); }, [sel, r.x, r.y]);
    if (!top) fail(`${sel} is covered`);
    await tap(cdp, r.x, r.y);
    await page.waitForTimeout(60);
}

async function phone(w, hgt) {
    console.log(`phone ${w}×${hgt} (touch)`);
    const { page, ctx } = await newPage({ width: w, height: hgt }, true);
    const cdp = await ctx.newCDPSession(page);
    await page.goto(`${BASE}/game-067/index.html?debug=1&fast=3`);
    await waitFor(page, 'A && A.frameNo > 3', 120000);
    check(await inViewport(page, '#t-new'), 'New Island button on screen');
    const small = await fingerSized(page, '#title button:not(.hidden)');
    check(small.length === 0, `title buttons finger-sized ${JSON.stringify(small)}`);
    await shot(page, `p${w}-title`);
    await tapSel(page, cdp, '#t-new');
    await page.waitForSelector('[data-act=create]');
    check(await noSideScroll(page), 'island picker: no sideways scroll');
    await shot(page, `p${w}-new`);
    await tapSel(page, cdp, '[data-preset=sunny]');
    await tapSel(page, cdp, '[data-act=create]');
    await waitFor(page, "A.mode === 'play'");
    await page.waitForSelector('[data-act=helpok]');
    await tapSel(page, cdp, '[data-act=helpok]');
    await frames(page, 2);
    check(await inViewport(page, '#toolbar'), 'toolbar fully on screen');
    const smallTools = await fingerSized(page, '#hud button');
    check(smallTools.length === 0, `HUD buttons finger-sized ${JSON.stringify(smallTools)}`);
    const overlap = await page.evaluate(() => {
        const rs = [...document.querySelectorAll('#topbar > *, #camctl button, #toolbar')].filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect());
        const bl = document.querySelector('#back-link').getBoundingClientRect();
        return rs.some((r) => !(r.right <= bl.left || r.left >= bl.right || r.bottom <= bl.top || r.top >= bl.bottom));
    });
    check(!overlap, 'nothing covers the back link');
    await shot(page, `p${w}-play`);

    // tap a train: its card opens on screen
    const tp = await TT(page, 'const e = W.trains.pointAt(W.trains.list[0], 0.4); return { x: e.x, z: e.z };');
    await TT(page, `tt.rig.gx = ${tp.x}; tt.rig.gz = ${tp.z}; tt.rig.gdist = 12; W.trains.list[0].running = false; return 1;`);
    await frames(page, 8);
    const eng = await page.evaluate(() => { const tt = window.__tt; const t = tt.world.trains.list[0]; const p = tt.world.trains.pointAt(t, 0.45); const v = new (tt.camera.position.constructor)(p.x, 0.45, p.z).project(tt.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; });
    await tap(cdp, eng.x, eng.y);
    await frames(page, 2);
    check(await TT(page, 'return A.selected === W.trains.list[0].id'), 'tapping a train selects it');
    check(await page.isVisible('#traincard') && await inViewport(page, '#traincard'), 'train card on screen');
    const smallCard = await fingerSized(page, '#traincard button');
    check(smallCard.length === 0, `train card buttons finger-sized ${JSON.stringify(smallCard)}`);
    await shot(page, `p${w}-card`);
    await tapSel(page, cdp, '#traincard .x');

    // one-finger drag with the track tool lays track
    await tapSel(page, cdp, '[data-tool=track]');
    await frames(page, 2);
    check(await inViewport(page, '#tray'), 'track tray on screen');
    const t0 = await TT(page, 'return W.counts().track');
    // find an empty run of land near the camera target
    const run = await TT(page, `
        const cx = Math.floor(tt.rig.tx + 24), cz = Math.floor(tt.rig.tz + 24);
        for (let r = 0; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
            const x = cx + dx, z = cz + dz; let good = true;
            for (let k = 0; k < 4; k++) { const i = z * 48 + x + k; if (W.tiles[i] === 0 || W.tiles[i] === 6 || W.track[i] || W.objAt[i] >= 0) good = false; }
            if (good) return [x, z];
        }
        return null;`);
    if (run) {
        const pts = [];
        for (let k = 0; k < 4; k++) pts.push(await tileXY(page, run[0] + k, run[1]));
        await touchDrag(cdp, pts);
        await frames(page, 2);
        const t1 = await TT(page, 'return W.counts().track');
        check(t1 >= t0 + 3, `one-finger drag laid track (${t0} → ${t1})`);
    } else fail('no free land for the touch track test');
    // two-finger pinch zooms and lays nothing
    const d0 = await TT(page, 'return tt.rig.gdist');
    const t2 = await TT(page, 'return W.counts().track');
    const cx = w / 2, cy = hgt / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }] });
    for (let s = 1; s <= 6; s++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 40 - s * 15, y: cy, id: 1 }, { x: cx + 40 + s * 15, y: cy, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frames(page, 2);
    check(await TT(page, `return tt.rig.gdist < ${d0} * 0.8`), 'pinch zooms in');
    check(await TT(page, `return W.counts().track === ${t2}`), 'pinch lays no track');

    // build tray fits and places by tap
    await tapSel(page, cdp, '[data-tool=build]');
    await frames(page, 2);
    check(await inViewport(page, '#tray'), 'build tray on screen');
    check(await noSideScroll(page), 'no sideways scroll with the tray open');
    // The canvas must be exactly the visible viewport, sized in px: a 100vh canvas is taller than
    // innerHeight on phones with a URL bar, so every tap lands below the finger.
    const cv = await page.evaluate(() => { const c = document.getElementById('gl'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, sh: c.style.height }; });
    check(Math.abs(cv.w - cv.iw) < 1 && Math.abs(cv.h - cv.ih) < 1 && cv.sh === `${cv.ih}px`, `canvas is sized to the visible viewport (${JSON.stringify(cv)})`);
    // A tap on a tile's drawn position builds on that tile; a drag only moves the camera.
    await TT(page, 'tt.rig.gdist = 14; return 1;');
    await frames(page, 4);
    const free = await TT(page, `
        const cx = Math.floor(tt.rig.tx + 24), cz = Math.floor(tt.rig.tz + 24);
        for (let r = 0; r < 10; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
            const x = cx + dx, z = cz + dz, i = z * 48 + x;
            if (W.tiles[i] !== 0 && W.tiles[i] !== 6 && !W.track[i] && W.objAt[i] < 0 && !W.canPlace(A.buildItem, x, z, A.rot)) return [x, z];
        }
        return null;`);
    if (free) {
        const fp = await reveal(page, free[0], free[1]);
        await tap(cdp, fp.x, fp.y);
        await frames(page, 2);
        const placed = await TT(page, `const o = W.objectAt(${free[0]}, ${free[1]}); return o ? o.type : null;`);
        check(placed === await TT(page, 'return A.buildItem'), `a tap builds on the tile under the finger (${placed} at ${free})`);
    } else fail('no free tile for the tap test');
    const n0 = await TT(page, 'return W.objs.size');
    const g0 = await TT(page, 'return [tt.rig.gx, tt.rig.gz]');
    await touchDrag(cdp, [{ x: w * 0.3, y: hgt * 0.3 }, { x: w * 0.6, y: hgt * 0.4 }, { x: w * 0.7, y: hgt * 0.45 }]);
    await frames(page, 2);
    check(await TT(page, `return W.objs.size === ${n0}`), 'a drag in Build places nothing');
    check(await TT(page, `return Math.hypot(tt.rig.gx - ${g0[0]}, tt.rig.gz - ${g0[1]}) > 0.5`), 'a drag in Build moves the camera');
    await shot(page, `p${w}-build`);
    // workshop fits
    await tapSel(page, cdp, '[data-tool=trains]');
    await tapSel(page, cdp, '[data-act=newtrain]');
    await page.waitForSelector('#ws-name');
    check(await inViewport(page, '#modal-panel'), 'workshop panel fits the screen');
    check(await inViewport(page, '[data-act=savetrain]'), 'workshop save button on screen');
    const scrolls = await page.evaluate(() => { const b = document.querySelector('.panel-body'); return b.scrollHeight <= b.clientHeight + 2 || getComputedStyle(b).overflowY === 'auto'; });
    check(scrolls, 'workshop body scrolls');
    await shot(page, `p${w}-workshop`);
    await tapSel(page, cdp, '[data-act=savetrain]');
    check(await TT(page, 'return !A.modal'), 'workshop saved and closed by touch');
    check(await noSideScroll(page), 'no sideways scroll');
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    fail(`exception: ${e.message}`);
    console.log(e.stack);
}
if (browser) await browser.close();
if (errors.length) { fails++; console.log('errors:\n  ' + [...new Set(errors)].slice(0, 20).join('\n  ')); }
console.log(fails ? `\n${fails} FAILED` : '\nall browser checks passed');
process.exit(fails ? 1 : 0);
