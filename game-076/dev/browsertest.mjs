/**
 * browsertest.mjs — TALEWRIGHT in real Chromium.
 *
 *   story    the first-run choice, the prologue scene, painting 40 tiles of 5 kinds through
 *            the real palette and map, the start flag, a playtest (walk, close), Chapter 0
 *            finishing (its scene, the restored-tools card, Chapter 1 opening), then an event
 *            made entirely through the UI (double-click, graphic picker, Insert ▸ Show Text,
 *            OK), and a playtest-from-here that talks to it — which finishes a quest
 *   sample   Free Mode; the sample game opens; the event editor, Database, Forge, Trophy
 *            Case, Emporium (buying a theme with Ink), Journal and Settings open with no errors;
 *            undo/redo; a full playtest from the title: New Game, the intro, a battle, the menu,
 *            a shop
 *   export   a standalone HTML export of the sample, written to disk and opened by itself from
 *            file:// in a fresh browser: title → New Game → the map; the runtime player opens
 *            a .talewright.json through its file picker; Download and Import round-trip
 *   phone    a touch-only 390×844 phone: no sideways scroll, the back link, the drawers, tap
 *            painting, a playtest with on-screen controls that move the hero
 *   storage  localStorage blocked: the Atelier boots, warns once, and still paints and playtests
 *
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8076          # from the REPO ROOT
 *   node game-076/dev/browsertest.mjs    # ONLY=story,sample,export,phone,storage
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8076';
const URL0 = `${BASE}/game-076/index.html`;
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ?? '';
const run = (n) => !ONLY || ONLY.split(',').includes(n);
let fails = 0, passes = 0;
const errors = [];
const ok = (c, msg) => { if (c) { passes++; console.log('  ok  ', msg); } else { fails++; console.log('  FAIL', msg); } };
const section = (n) => console.log('\n── ' + n);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
async function newPage(o) {
    o = o || {};
    if (!browser) browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const ctx = await browser.newContext({ viewport: o.viewport || { width: 1366, height: 860 }, hasTouch: !!o.touch, isMobile: !!o.touch, deviceScaleFactor: o.touch ? 2 : 1, acceptDownloads: true });
    await ctx.addInitScript((blocked) => {
        if (blocked) { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); return; }
        try { if (!sessionStorage.getItem('tw-test')) { localStorage.clear(); sessionStorage.setItem('tw-test', '1'); } } catch { /* ignore */ }
    }, !!o.blockStorage);
    const page = await ctx.newPage();
    const tag = o.tag || 'page';
    page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + (e.stack || e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); });
    page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) errors.push(tag + ' requestfailed: ' + r.url()); });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, body: '' }));
    if (o.url !== false) {
        await page.goto(o.url || URL0);
        await page.waitForFunction(() => window.__tal, null, { timeout: 15000 });
        await wait(300);
    }
    return { page, ctx };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout) => page.waitForFunction(fn, arg, { timeout: timeout || 8000 }).then(() => true, () => false);
async function skipScenes(page) { for (let i = 0; i < 6; i++) { if (!(await page.$('.scene'))) return; await page.click('.scskip'); await wait(250); } }
async function closeModals(page) { for (let i = 0; i < 6; i++) { const b = await page.$('.modal-back'); if (!b) return; await page.keyboard.press('Escape'); await wait(120); } }

async function paletteClick(page, n) {
    const pal = await page.locator('canvas.palette').boundingBox();
    const k = pal.width / 8, col = (n - 1) % 8, row = Math.floor((n - 1) / 8);
    await page.mouse.click(pal.x + col * k + k / 2, pal.y + row * k + k / 2);
}
/** Screen point of a map cell. */
async function cellPoint(page, x, y) {
    return ev(page, ([x, y]) => {
        const v = __tal.view();
        const r = v.scroller.getBoundingClientRect(), o = v.origin(), s = 16 * v.zoom;
        return { x: r.left + o.x + x * s + s / 2, y: r.top + o.y + y * s + s / 2 };
    }, [x, y]);
}

// ─────────────────────────────────────────────────────────────────────────────
async function story() {
    section('story mode');
    const { page, ctx } = await newPage({ tag: 'story' });
    const back = await ev(page, () => { const a = document.getElementById('back-link'); const r = a.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { vis: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight, href: a.getAttribute('href'), top: top === a || a.contains(top) }; });
    ok(back.vis && back.href === '../index.html', 'the ← Games link is on screen and points at the launcher');
    ok(await page.$('.modecard'), 'first run asks for Story or Free Mode');
    await page.locator('.modecard').first().click();
    ok(await until(page, () => document.querySelector('.scene')), 'the prologue scene plays');
    for (let i = 0; i < 30 && (await page.$('.scene')); i++) { await page.click('.scnext'); await wait(40); }
    ok(!(await page.$('.scene')), 'the scene can be read to the end');
    ok(await ev(page, () => __tal.meta.data.mode === 'story' && __tal.meta.data.chapter === 0), 'story mode, chapter 0');
    ok(await ev(page, () => document.getElementById('tool-rect').classList.contains('locked') && document.getElementById('btn-db').classList.contains('locked')), 'later tools start locked');
    // paint through the real palette and map
    await paletteClick(page, 7);   // water
    let p0 = await cellPoint(page, 3, 4);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down();
    for (let x = 3; x < 15; x++) { const p = await cellPoint(page, x, 4); await page.mouse.move(p.x, p.y); }
    await page.mouse.up();
    await paletteClick(page, 5);   // path
    p0 = await cellPoint(page, 2, 9);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down();
    for (let x = 2; x < 18; x++) { const p = await cellPoint(page, x, 9); await page.mouse.move(p.x, p.y); }
    await page.mouse.up();
    await paletteClick(page, 6);   // sand
    for (let x = 3; x < 15; x++) { const p = await cellPoint(page, x, 5); await page.mouse.click(p.x, p.y); }
    await paletteClick(page, 13);  // oak tree → the decor layer
    ok(await ev(page, () => __tal.view().layer === 1), 'picking a decor tile switches to the Decor layer');
    for (const [x, y] of [[1, 1], [17, 2], [16, 12], [3, 12]]) { const p = await cellPoint(page, x, y); await page.mouse.click(p.x, p.y); }
    await paletteClick(page, 22);  // flowers
    for (const [x, y] of [[6, 7], [8, 7], [10, 12]]) { const p = await cellPoint(page, x, y); await page.mouse.click(p.x, p.y); }
    const m = await ev(page, () => { const m = __tal.curMap(); return { water: m.layers[0].filter((t) => t === 7).length, trees: m.layers[1].filter((t) => t === 13).length, painted: __tal.meta.data.stats.painted }; });
    ok(m.water >= 10 && m.trees === 4, 'strokes and clicks paint the map (' + m.water + ' water, ' + m.trees + ' trees)');
    ok(m.painted >= 40, 'the paint counter counts (' + m.painted + ')');
    // undo / redo
    await page.keyboard.press('Control+z');
    const undone = await ev(page, () => __tal.curMap().layers[1].filter((t) => t).length);
    await page.keyboard.press('Control+y');
    const redone = await ev(page, () => __tal.curMap().layers[1].filter((t) => t).length);
    ok(redone === undone + 1, 'undo and redo (' + undone + ' → ' + redone + ')');
    // the hero's start
    await page.click('#tool-start');
    const sp = await cellPoint(page, 9, 7);
    await page.mouse.click(sp.x, sp.y);
    ok(await ev(page, () => { const s = __tal.store.project.system; return s.startSet && s.startX === 9 && s.startY === 7; }), 'the Start tool places the hero');
    // playtest
    await page.click('#btn-playtest');
    ok(await until(page, () => document.querySelector('.playtest') && window.__twGame && __twGame.scene === 'title'), 'Playtest opens on the title screen');
    await page.keyboard.press('Enter');
    ok(await until(page, () => __twGame.scene === 'map', null, 6000), 'New Game starts on the map');
    const x0 = await ev(page, () => __twGame.map.player.x);
    await page.keyboard.down('ArrowLeft'); await wait(450); await page.keyboard.up('ArrowLeft');
    await wait(300);
    ok(await ev(page, (x0) => __twGame.map.player.x < x0, x0), 'the arrow keys walk the hero');
    await shot(page, 'story-playtest');
    await page.click('.ptclose');
    ok(!(await page.$('.playtest')), 'the playtest closes');
    // chapter 0 complete
    ok(await until(page, () => document.querySelector('.scene'), null, 6000), 'finishing the prologue plays its closing scene');
    await skipScenes(page);
    ok(await until(page, () => document.querySelector('.restored'), null, 3000), 'the restored-tools card lists the unlocks');
    await shot(page, 'story-restored');
    await page.locator('.restored button.primary').click();
    await until(page, () => document.querySelector('.scene'), null, 3000);
    await skipScenes(page);
    ok(await ev(page, () => __tal.meta.data.chapter === 1 && __tal.meta.has('events') && !document.getElementById('layer-3').classList.contains('locked')), 'Chapter 1 begins and Events unlock');
    ok(await ev(page, () => __tal.meta.data.ink >= 150), 'Ink was earned (' + (await ev(page, () => __tal.meta.data.ink)) + ')');
    // an event made entirely through the UI
    await page.click('#layer-3');
    const ep = await cellPoint(page, 12, 7);
    await page.mouse.dblclick(ep.x, ep.y);
    const opened = await until(page, () => document.querySelector('.evedit'));
    if (!opened) { await shot(page, 'fail-dblclick'); console.log(await ev(page, () => ({ layer: __tal.view().layer, tool: __tal.view().tool, modals: document.querySelectorAll('.modal-back').length, scene: !!document.querySelector('.scene'), evs: __tal.curMap().events.length }))); }
    ok(opened, 'double-clicking an empty tile opens the event editor');
    await page.locator('.evedit button', { hasText: 'Choose…' }).first().click();
    await page.locator('.pickgrid .pick', { hasText: 'Elder' }).first().click();
    await page.locator('.modal-foot button', { hasText: 'Choose' }).last().click();
    await page.locator('.crow.end').last().click();
    await page.locator('.cmdtools button', { hasText: 'Insert' }).click();
    ok(await until(page, () => document.querySelector('.cmdpicker')), 'Insert opens the command picker');
    ok(await ev(page, () => document.querySelector('.cmdbtn[data-cmd="battle"]').classList.contains('locked')), 'later commands are locked');
    await page.click('.cmdbtn[data-cmd="text"]');
    await page.locator('.modal input[type=text]').last().fill('Elder Oak');
    await page.locator('.modal textarea').last().fill('Welcome to my meadow, \\p!');
    await page.locator('.modal-foot button.primary').last().click();
    await wait(150);
    const rows = await ev(page, () => [...document.querySelectorAll('.crow.cmd .ctext')].map((e) => e.textContent));
    ok(rows.some((r) => r.includes('Elder Oak') && r.includes('Welcome')), 'the new Show Text appears in the list');
    await shot(page, 'story-eventeditor');
    await page.locator('.modal-foot button.primary', { hasText: 'OK' }).last().click();
    await wait(300);
    ok(await ev(page, () => { const e = __tal.curMap().events.find((q) => q.x === 12 && q.y === 7); return e && e.pages[0].gfx.id === 'elder' && e.pages[0].list[0].t === 'text'; }), 'the event is saved on the map');
    // playtest from next to it and talk
    await ev(page, () => __tal.startPlaytest({ at: { map: __tal.curMap().id, x: 11, y: 7 } }));
    await until(page, () => window.__twGame && __twGame.scene === 'map');
    await wait(300);
    await ev(page, () => { __twGame.map.player.dir = 6; });
    await page.keyboard.press('z');
    ok(await until(page, () => __twGame.ui.stack.length > 0, null, 3000), 'pressing Z facing the event shows its message');
    await wait(500);
    await shot(page, 'story-talk');
    await page.keyboard.press('z'); await wait(100); await page.keyboard.press('z'); await wait(300);
    await page.click('.ptclose');
    ok(await until(page, () => __tal.meta.data.quests['ch1.talk'], null, 3000), 'talking in a playtest completes the Conversation quest');
    ok(await ev(page, () => ['ch1.npc', 'ch1.speaker'].every((k) => __tal.meta.data.quests[k])), 'the event and Show Text quests are done');
    await closeModals(page);
    await shot(page, 'story-ch1');
    await ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
async function sample() {
    section('free mode and the sample');
    const { page, ctx } = await newPage({ tag: 'sample' });
    await page.locator('.modecard').nth(1).click();
    await until(page, () => document.querySelector('.scene'));
    await skipScenes(page);
    ok(await ev(page, () => __tal.meta.free && __tal.meta.has('export') && __tal.meta.has('forge')), 'Free Mode unlocks everything');
    await ev(page, () => __tal.openSample());
    await wait(400);
    ok(await ev(page, () => __tal.store.project.maps.length === 5 && __tal.store.project.meta.sample), 'the sample game opens as a copy');
    await closeModals(page);
    // every big dialog opens cleanly
    for (const [btn, sel, name] of [['#btn-db', '.dbmodal', 'Database'], ['#btn-forge', '.forgemodal', 'Sprite Forge'], ['#btn-export', '.export', 'Export'], ['#btn-trophies', '.trophies', 'Trophy Case'], ['#btn-shop', '.shop', 'Emporium'], ['#btn-journal', '.journal', 'Journal'], ['#btn-settings', '.modal .form', 'Settings']]) {
        await page.click(btn);
        ok(await until(page, (s) => document.querySelector(s), sel, 3000), name + ' opens');
        if (name === 'Database') {
            for (const t of ['Heroes', 'Items', 'Skills', 'Enemies', 'Troops', 'Switches', 'System']) { await page.locator('.tab', { hasText: t }).click(); await wait(80); }
            ok(true, 'every Database tab renders');
        }
        await shot(page, 'sample-' + name.toLowerCase().replace(/\s+/g, '-'));
        await closeModals(page);
    }
    // buy something at the Emporium
    await ev(page, () => { __tal.meta.data.ink = 500; __tal.meta.save(); });
    await page.click('#btn-shop');
    await page.locator('.shopitem', { hasText: 'Synthwave' }).locator('button').click();
    ok(await ev(page, () => __tal.meta.data.owned['theme.synthwave'] && document.body.dataset.theme === 'synthwave'), 'buying the Synthwave theme applies it');
    await shot(page, 'sample-synthwave');
    await closeModals(page);
    // the event editor on a branching event
    await ev(page, () => { const m = __tal.curMap(); const e = m.events.find((q) => q.name === 'Granny Wren'); __tal.bus.emit('x'); document.querySelector('.mapscroll').focus(); __tal.view().sel = e.id; });
    await page.keyboard.press('Enter');
    ok(await until(page, () => document.querySelectorAll('.crow.branch').length >= 3), 'the event editor shows branches');
    await closeModals(page);
    // a full playtest of the sample
    await page.click('#btn-playtest');
    await until(page, () => window.__twGame && __twGame.scene === 'title');
    await page.keyboard.press('Enter');
    ok(await until(page, () => __twGame.scene === 'map' && __twGame.interp, null, 6000), 'New Game plays the intro cutscene');
    for (let i = 0; i < 12 && (await ev(page, () => !!__twGame.interp)); i++) { await page.keyboard.press('Enter'); await wait(250); }
    ok(await ev(page, () => __twGame.state.sw(1) && !__twGame.interp), 'the intro finishes and sets its switch');
    await page.keyboard.press('Escape');
    ok(await until(page, () => __twGame.ui.stack.some((w) => w.constructor.name === 'MainMenu')), 'Esc opens the menu');
    await shot(page, 'sample-menu');
    await page.keyboard.press('Escape'); await wait(200);
    await ev(page, () => __twGame.startBattle(1, { escape: true }));
    ok(await until(page, () => __twGame.battle && __twGame.battle.phase === 'input', null, 6000), 'a battle starts and waits for orders');
    await shot(page, 'sample-battle');
    for (let i = 0; i < 80 && (await ev(page, () => !!__twGame.battle)); i++) { await page.keyboard.press('Enter'); await wait(150); }
    ok(await ev(page, () => !__twGame.battle), 'the battle ends');
    await ev(page, () => __twGame.shop([1, 2, 11]));
    await wait(200);
    await page.keyboard.press('Enter'); await wait(150); await page.keyboard.press('Enter'); await wait(150); await page.keyboard.press('Enter'); await wait(200);
    ok(await ev(page, () => __twGame.state.count(1) >= 1 || __twGame.state.count(11) >= 1), 'buying from a shop with the keyboard');
    await shot(page, 'sample-shop');
    await page.click('.ptclose');
    ok(await until(page, () => __tal.meta.data.flags['hook.battleWin'] || __tal.meta.data.flags['hook.battleLose'] || __tal.meta.data.flags['hook.escape']), 'playtest hooks reach the Atelier');
    await ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
async function exporting() {
    section('export');
    const { page, ctx } = await newPage({ tag: 'export' });
    await page.locator('.modecard').nth(1).click();
    await until(page, () => document.querySelector('.scene')); await skipScenes(page);
    await ev(page, () => __tal.openSample());
    await closeModals(page);
    // through the real Export dialog
    await page.click('#btn-export');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.expcard button', { hasText: '.html' }).first().click()]);
    const file = path.join(OUT, 'exported-sample.html');
    await dl.saveAs(file);
    const html = fs.readFileSync(file, 'utf8');
    ok(html.length > 50000 && html.includes('window.TW_GAME') && html.includes('TW_MODULES.push'), 'the standalone export is one HTML file with the runtime and the game (' + Math.round(html.length / 1024) + ' KB)');
    ok(!/src=["'](?!data:)/i.test(html) && !/<link/i.test(html), 'it loads nothing from anywhere');
    ok(await until(page, () => __tal.meta.data.stats.exports >= 1), 'exporting counts');
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('.expcard button', { hasText: 'player' }).click()]);
    const playerFile = path.join(OUT, 'talewright-player.html');
    await dl2.saveAs(playerFile);
    const [dl3] = await Promise.all([page.waitForEvent('download'), page.locator('.expcard button', { hasText: '.talewright.json' }).click()]);
    const jsonFile = path.join(OUT, 'sample.talewright.json');
    await dl3.saveAs(jsonFile);
    ok(JSON.parse(fs.readFileSync(jsonFile, 'utf8')).format === 'talewright', 'the project file downloads');
    await closeModals(page);
    // import it back
    const before = await ev(page, () => __tal.store.list().length);
    await page.locator('#btn-project').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.popmenu button', { hasText: 'Import' }).click()]);
    await chooser.setFiles(jsonFile);
    ok(await until(page, (n) => __tal.store.list().length === n + 1, before, 4000), 'Import adds the project back');
    await ctx.close();

    // the exported file, alone, from file://
    const alone = await newPage({ url: false, tag: 'standalone' });
    await alone.page.goto(pathToFileURL(file).href);
    ok(await until(alone.page, () => window.TW && TW.game && TW.game.scene === 'title', null, 8000), 'the exported game boots on its own from file://');
    await shot(alone.page, 'standalone-title');
    await alone.page.keyboard.press('Enter');
    ok(await until(alone.page, () => TW.game.scene === 'map', null, 8000), 'and New Game reaches the first map');
    for (let i = 0; i < 12; i++) { await alone.page.keyboard.press('Enter'); await wait(250); }
    await shot(alone.page, 'standalone-map');
    ok(await alone.page.evaluate(() => TW.game.state.sw(1)), 'the intro cutscene runs in the export');
    await alone.ctx.close();

    // the runtime player opening the project file
    const pl = await newPage({ url: false, tag: 'player' });
    await pl.page.goto(pathToFileURL(playerFile).href);
    ok(await until(pl.page, () => document.querySelector('.tw-loader')), 'the runtime player asks for a game');
    await pl.page.setInputFiles('.tw-loader input[type=file]', jsonFile);
    ok(await until(pl.page, () => window.TW && TW.game && TW.game.scene === 'title', null, 8000), 'and plays the .talewright.json it is given');
    await shot(pl.page, 'player-title');
    await pl.ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
async function phone() {
    section('touch-only phone');
    const { page, ctx } = await newPage({ viewport: { width: 390, height: 844 }, touch: true, tag: 'phone' });
    await page.locator('.modecard').first().tap();
    await until(page, () => document.querySelector('.scene'));
    await shot(page, 'phone-scene');
    await page.tap('.scskip');
    await wait(300);
    const lay = await ev(page, () => ({ sw: document.documentElement.scrollWidth, w: innerWidth, bar: getComputedStyle(document.getElementById('bottombar')).display, back: (() => { const r = document.getElementById('back-link').getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth && r.top >= 0; })() }));
    ok(lay.sw <= lay.w, 'no sideways scroll (' + lay.sw + ' ≤ ' + lay.w + ')');
    ok(lay.bar === 'flex' && lay.back, 'the bottom bar and the back link are on screen');
    await page.tap('#bottombar button[data-panel="left"]');
    await wait(300);
    ok(await ev(page, () => { const r = document.getElementById('left').getBoundingClientRect(); return r.left >= -1 && r.width > 200; }), 'the Maps & tiles drawer slides in');
    const pal = await page.locator('canvas.palette').boundingBox();
    await page.touchscreen.tap(pal.x + pal.width / 8 * 6.5, pal.y + pal.width / 16);
    await page.tap('#bottombar button[data-panel="none"]');
    await wait(300);
    for (let i = 0; i < 4; i++) { const p = await cellPoint(page, 4 + i, 5); await page.touchscreen.tap(p.x, p.y); }
    ok(await ev(page, () => __tal.curMap().layers[0].filter((t) => t === 7).length >= 4), 'tapping paints');
    await shot(page, 'phone-editor');
    await page.tap('#bottombar button[data-panel="right"]');
    await wait(300);
    await shot(page, 'phone-quests');
    await page.tap('#bottombar button[data-panel="none"]');
    await page.tap('#btn-playtest');
    ok(await until(page, () => window.__twGame && document.querySelector('.tw-player.touch')), 'playtest shows on-screen controls');
    const a = await page.locator('.tw-btn.a').boundingBox();
    await page.touchscreen.tap(a.x + a.width / 2, a.y + a.height / 2);
    ok(await until(page, () => __twGame.scene === 'map', null, 6000), 'tapping A starts the game');
    const before = await ev(page, () => __twGame.map.player.y);
    const pad = await page.locator('.tw-pad .d').boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const pt = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
    await wait(600);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(300);
    const after = await ev(page, () => __twGame.map.player.y);
    ok(after !== before, 'the d-pad moves the hero (' + before + ' → ' + after + ')');
    const sizes = await ev(page, () => [...document.querySelectorAll('.tw-btn, .tw-pad i')].map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
    ok(sizes.every((s) => s >= 44), 'touch controls are at least 44 px');
    await shot(page, 'phone-playtest');
    await page.tap('.ptclose');
    await ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
async function storage() {
    section('blocked storage');
    const { page, ctx } = await newPage({ blockStorage: true, tag: 'storage' });
    await page.locator('.modecard').first().click();
    await until(page, () => document.querySelector('.scene')); await skipScenes(page);
    ok(await until(page, () => [...document.querySelectorAll('.toast')].some((t) => /save|storage/i.test(t.textContent)), null, 4000), 'the Atelier warns that it can\'t save here');
    await paletteClick(page, 7);
    const p = await cellPoint(page, 5, 5);
    await page.mouse.click(p.x, p.y);
    ok(await ev(page, () => __tal.curMap().layers[0][5 * __tal.curMap().w + 5] === 7), 'painting still works');
    await page.click('#btn-playtest');
    await page.keyboard.press('Enter');
    ok(await until(page, () => window.__twGame && __twGame.scene === 'map', null, 6000), 'playtesting still works');
    await page.click('.ptclose');
    await ctx.close();
}

try {
    if (run('story')) await story();
    if (run('sample')) await sample();
    if (run('export')) await exporting();
    if (run('phone')) await phone();
    if (run('storage')) await storage();
} catch (e) {
    fails++;
    console.log('  FAIL (exception)', e.stack || e.message);
}
if (browser) await browser.close();
const noise = errors.filter((e) => !/AudioContext was not allowed/.test(e));
ok(!noise.length, 'no console errors, page errors or failed requests' + (noise.length ? ':\n    ' + noise.join('\n    ') : ''));
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
