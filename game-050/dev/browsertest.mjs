/**
 * browsertest.mjs — real Chromium, real WebGL, the genuine three.js r165.
 *
 * Desktop (1280×800, mouse): title → How to Play → New Adventure (class + name) →
 * prologue → build a Lumber Camp on a plot → collect a basket bubble → Hero (allocate,
 * gear, spells) → Library → Quests → Adventure → wing map → pre-battle → a battle played
 * with real mouse drags (and a click-click swap), a spell and a potion → victory →
 * result → back to the map; a Keeper fight with its story and the returned book;
 * forge / alchemist / mage tower panels; save + reload + Continue with the away
 * summary; every wing's stage renders (not black); the menu.
 * Phones (touch only, CDP input) at 390×844 and 844×390: new game by taps, nav
 * buttons ≥ 44 px and on screen, a battle with a real swipe, spell buttons ≥ 44 px
 * and clear of the board.
 * Fails on any console error, page error or failed request. Screenshots → dev/shots/.
 *
 *   python3 -m http.server 8050                  # from the REPO ROOT
 *   node game-050/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served from disk:
 *   cd game-050/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz   # -> ./package
 * Env: BASE (default http://127.0.0.1:8050), PW_CHROMIUM_PATH, ONLY=desktop|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8050';
const URL0 = `${BASE}/game-050/index.html?debug=1`;
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__cleared')) { localStorage.clear(); sessionStorage.setItem('__cleared', '1'); } } catch { /* ignore */ } });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 60000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const frames = (page, n = 4) => Q(page, (n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const state = (page) => Q(page, () => __tb.state());
async function closeDialogs(page) {
    for (let i = 0; i < 60; i++) {
        const open = await Q(page, () => __tb.state().dialog);
        if (!open) return;
        await page.click('#dialog .dlg-box', { position: { x: 30, y: 30 } }).catch(() => {});
        await page.waitForTimeout(60);
    }
    await Q(page, () => __tb.skipStory());
}
const clickText = (page, sel, text) => page.locator(sel, { hasText: text }).first().click();

async function playUntilOver(page, opts = {}) {
    // Real mouse drags for the first few moves, then the bot via the same input path.
    for (let i = 0; i < 400; i++) {
        const st = await state(page);
        if (st.over || st.mode !== 'battle') return st;
        if (st.turn === 'p' && st.idle && !st.dialog) {
            if (i < (opts.drags ?? 3)) {
                const m = await Q(page, () => __tb.best());
                await page.mouse.move(m.pa.x, m.pa.y);
                await page.mouse.down();
                await page.mouse.move((m.pa.x + m.pb.x) / 2, (m.pa.y + m.pb.y) / 2, { steps: 3 });
                await page.mouse.move(m.pb.x, m.pb.y, { steps: 3 });
                await page.mouse.up();
            } else {
                if (opts.win) await Q(page, () => __tb.win());
                await Q(page, () => __tb.botMove());
            }
        }
        await page.waitForTimeout(120);
    }
    return state(page);
}

// ------------------------------------------------------------------ Desktop

async function desktop() {
    console.log('desktop 1280×800');
    const { page } = await newPage({ width: 1280, height: 800 });
    await page.goto(URL0);
    await until(page, () => window.__tb && !document.getElementById('title').hidden, 'title screen shows');
    await frames(page, 6);
    check(await Q(page, () => __tb.brightness()) > 2, 'title renders the island (not black)');
    await shot(page, 'd01-title');

    await page.click('#btn-help');
    await until(page, () => document.querySelector('.panel[data-name="help"]'), 'How to Play opens');
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('.panel'), 'How to Play closes with Esc');

    await page.click('#btn-new');
    await until(page, () => document.querySelector('.panel[data-name="create"]'), 'create panel opens');
    await clickText(page, '.panel .tile', 'Warrior');
    await page.fill('.panel input', 'Bramble');
    await shot(page, 'd02-create');
    await clickText(page, '.panel-foot .btn', 'Begin');
    await until(page, () => __tb.state().dialog, 'prologue plays');
    await shot(page, 'd03-prologue');
    await closeDialogs(page);
    await until(page, () => __tb.state().mode === 'town' && !__tb.state().dialog, 'town after the prologue');
    check(await Q(page, () => document.getElementById('hb-name').textContent === 'Bramble'), 'hero badge shows the chosen name');
    check(await Q(page, () => /Lumber Camp/.test(document.getElementById('town-hint').textContent)), 'tutorial hint asks for a Lumber Camp');

    // Build a Lumber Camp on plot 2 through the real UI.
    await page.click('#nav-build');
    await until(page, () => document.querySelector('.panel[data-name="build"]'), 'build panel opens');
    await shot(page, 'd04-build');
    await page.locator('.panel .tile', { hasText: 'Lumber Camp' }).locator('.btn', { hasText: 'Build' }).click();
    await until(page, () => __tb.G.placing === 'lumber', 'placement mode');
    await Q(page, () => __tb.snap());
    await frames(page, 3);
    const ps = await Q(page, () => __tb.plotScreen(2));
    await page.mouse.click(ps.x, ps.y);
    await until(page, () => __tb.G.profile.town.lumber && __tb.G.profile.town.lumber.plot === 2, 'Lumber Camp built on the tapped plot');

    // Fill the basket and collect it by tapping its bubble.
    await Q(page, () => __tb.basket('lumber', 40));
    await until(page, () => document.querySelector('.bubble'), 'a basket bubble appears');
    const wood0 = await Q(page, () => __tb.G.profile.res.wood);
    await page.click('.bubble');
    await until(page, (w) => __tb.G.profile.res.wood >= w + 40, 'tapping the bubble collects wood', 10000, wood0);
    await shot(page, 'd05-town');

    // Hero panel
    await Q(page, () => __tb.xp(400));
    await closeDialogs(page);
    await page.click('#nav-hero');
    await until(page, () => document.querySelector('.panel[data-name="hero"]'), 'hero panel opens');
    const pts = await Q(page, () => __tb.G.profile.points);
    await page.locator('.panel .plus').first().click();
    check(await Q(page, (p) => __tb.G.profile.points === p - 1, pts), 'allocating a stat point works');
    await clickText(page, '.tab', 'Gear');
    await until(page, () => document.querySelectorAll('.panel .item').length >= 1, 'gear tab lists the starting weapon');
    await clickText(page, '.tab', 'Spells');
    await until(page, () => document.querySelectorAll('.panel .spell').length >= 9, 'spellbook lists the class spells');
    await shot(page, 'd06-hero');
    await page.keyboard.press('Escape');
    await page.click('#nav-library');
    await until(page, () => document.querySelectorAll('.panel .book').length === 13, 'library shows 13 shelves');
    await page.keyboard.press('Escape');
    await page.click('#nav-quests');
    await until(page, () => document.querySelectorAll('.panel .tile').length >= 2, 'quest board lists quests');
    await shot(page, 'd07-quests');
    await page.keyboard.press('Escape');

    // Adventure → wing map → first node
    await page.click('#nav-adventure');
    await until(page, () => document.querySelectorAll('.wing-card').length === 7, 'adventure lists 7 wings');
    await page.click('.wing-card.current');
    await until(page, () => document.querySelector('.panel[data-name="wing:0"] svg'), 'wing map renders');
    await shot(page, 'd08-map');
    await page.locator('.node-btn[data-node="0"]').dispatchEvent('click');
    await until(page, () => document.querySelector('.panel[data-name="prebattle"]'), 'pre-battle panel');
    await shot(page, 'd09-prebattle');
    await clickText(page, '.panel-foot .btn', 'Fight');
    await until(page, () => __tb.state().mode === 'battle', 'battle starts');
    await until(page, () => __tb.state().dialog, 'first-battle tutorial plays');
    await closeDialogs(page);
    await until(page, () => __tb.state().idle && __tb.state().turn === 'p', 'player turn, board idle', 60000);
    await frames(page, 4);
    check(await Q(page, () => __tb.brightness()) > 2, 'battle stage renders (not black)');
    await shot(page, 'd10-battle');

    // A swap by drag
    const t0 = await Q(page, () => __tb.G.run.bt.stats.moves);
    const m = await Q(page, () => __tb.best());
    await page.mouse.move(m.pa.x, m.pa.y); await page.mouse.down();
    await page.mouse.move(m.pb.x, m.pb.y, { steps: 5 }); await page.mouse.up();
    await until(page, (t) => __tb.G.run.bt.stats.moves === t + 1, 'a mouse drag swaps gems', 10000, t0);
    await until(page, () => __tb.state().idle && __tb.state().turn === 'p', 'back to the player after the monster moves', 60000);
    // A swap by click-click
    const m2 = await Q(page, () => __tb.best());
    await page.mouse.click(m2.pa.x, m2.pa.y);
    await page.mouse.click(m2.pb.x, m2.pb.y);
    await until(page, (t) => __tb.G.run.bt.stats.moves === t + 2, 'tap-tap swaps gems', 10000, t0);
    await until(page, () => __tb.state().idle && __tb.state().turn === 'p', 'player turn again', 60000);
    // A spell (top up mana, click the glowing button)
    await Q(page, () => __tb.mana(30));
    await frames(page, 2);
    await until(page, () => document.querySelector('#p-spells .spell-btn.ready'), 'a spell glows when affordable');
    await page.click('#p-spells .spell-btn.ready');
    await until(page, () => __tb.G.run.bt.stats.spells >= 1, 'casting a spell works');
    await shot(page, 'd11-spell');
    // Win it
    const st = await playUntilOver(page, { drags: 0, win: true });
    check(st.over === 'win', 'battle won');
    await until(page, () => document.querySelector('.panel[data-name="result"]'), 'victory panel', 90000);
    await shot(page, 'd12-victory');
    await clickText(page, '.panel-foot .btn', 'Continue');
    await until(page, () => __tb.state().mode === 'town', 'back in town', 20000);
    await page.waitForTimeout(500);
    await closeDialogs(page);
    await until(page, () => document.querySelector('.panel[data-name="wing:0"]'), 'the wing map reopens after the battle', 20000);

    // Keeper fight with story, a potion and the returned book.
    await Q(page, () => { __tb.G.profile.potions.heal = 2; __tb.G.profile.loadout = { heal: 1 }; });
    const keeper = await Q(page, () => __tb.clearTo(0, 'keeper'));
    await page.keyboard.press('Escape');
    await Q(page, (k) => __tb.G.enterNode(0, k), keeper);
    await until(page, () => document.querySelector('.panel[data-name="prebattle"]'), 'keeper pre-battle');
    await clickText(page, '.panel-foot .btn', 'Fight');
    await until(page, () => __tb.state().dialog, 'keeper story plays before the fight');
    await shot(page, 'd13-keeper-story');
    await closeDialogs(page);
    await until(page, () => __tb.state().idle && __tb.state().turn === 'p', 'keeper fight ready', 60000);
    await until(page, () => document.querySelector('#potions .pot-btn'), 'potion button shows');
    await page.click('#potions .pot-btn');
    await until(page, () => __tb.G.run.bt.stats.potions === 1, 'drinking a potion works');
    await shot(page, 'd14-keeper');
    const st2 = await playUntilOver(page, { drags: 0, win: true });
    check(st2.over === 'win', 'keeper defeated');
    await until(page, () => document.querySelector('.panel[data-name="result"]'), 'keeper result', 90000);
    check(await Q(page, () => /Primer of Sparks/.test(document.querySelector('.panel')?.textContent || '')), 'the result shows the returned book');
    await clickText(page, '.panel-foot .btn', 'Continue');
    await until(page, () => __tb.state().mode === 'town', 'town after the keeper', 20000);
    await until(page, () => __tb.state().dialog, 'post-keeper story plays');
    await closeDialogs(page);
    check(await Q(page, () => !!__tb.G.profile.books.sparks), 'the book is on the shelf');
    check(await Q(page, () => __tb.G.profile.potions.heal === 1), 'the potion was used up');
    await page.keyboard.press('Escape');
    await frames(page, 6);
    await shot(page, 'd15-town-book');

    // Workshops
    await Q(page, () => { __tb.give({ gold: 50000, wood: 50000, stone: 50000, herbs: 5000, crystal: 5000, ink: 5000 }); __tb.books(10); __tb.xp(200000); });
    await closeDialogs(page);
    await Q(page, () => { const G = __tb.G; for (const id of ['forge', 'alchemist', 'magetower', 'scriptorium', 'market', 'quarry', 'herbs', 'crystal', 'training', 'guild', 'storehouse', 'clocktower']) { if (!G.profile.town[id]) { G.placing = id; G.placeAt(require_free()); } } function require_free() { const used = new Set(Object.values(G.profile.town).map((b) => b.plot)); for (let i = 0; i < 13; i++) if (!used.has(i)) return i; return 0; } });
    await closeDialogs(page);
    check(await Q(page, () => Object.keys(__tb.G.profile.town).length === 13), 'all 13 buildings placed');
    await frames(page, 30);
    await shot(page, 'd16-full-town');
    await Q(page, () => __tb.G.openBuilding('forge'));
    await clickText(page, '.panel .btn', 'Weapon');
    await until(page, () => __tb.G.profile.bag.length >= 1, 'forging an item works');
    await shot(page, 'd17-forge');
    await Q(page, () => __tb.G.openBuilding('alchemist'));
    await page.locator('.panel .tile', { hasText: 'Healing Draught' }).locator('.btn', { hasText: 'Brew' }).click();
    await until(page, () => __tb.G.profile.potions.heal >= 2, 'brewing a potion works');
    await Q(page, () => { __tb.G.upgrade('magetower'); __tb.G.upgrade('magetower'); __tb.G.openBuilding('magetower'); });
    await page.locator('.panel .btn', { hasText: 'Rank up' }).first().click();
    await until(page, () => Object.values(__tb.G.profile.spells).some((r) => r >= 2), 'ranking up a spell works');
    await Q(page, () => { __tb.G.upgrade('scriptorium'); __tb.G.openBuilding('scriptorium'); });
    await page.locator('.panel .btn', { hasText: 'Study' }).first().click();
    await until(page, () => Object.values(__tb.G.profile.books).some((t) => t >= 2), 'studying a book works');
    await page.keyboard.press('Escape');

    // Save, age the save by 3 hours, reload, Continue → away summary.
    await Q(page, () => { __tb.age(3 * 3600 * 1000); });
    await page.reload();
    await until(page, () => window.__tb && !document.getElementById('btn-continue').hidden, 'Continue offered after reload');
    await page.click('#btn-continue');
    await until(page, () => document.querySelector('.panel[data-name="away"]'), 'away summary after 3 hours', 30000);
    await shot(page, 'd18-away');
    const goldBefore = await Q(page, () => __tb.G.profile.res.gold);
    await clickText(page, '.panel-foot .btn', 'Collect');
    await until(page, (g) => __tb.G.profile.res.gold > g, 'collect all from the away summary', 10000, goldBefore);
    check(await Q(page, () => __tb.G.profile.name === 'Bramble' && !!__tb.G.profile.books.sparks), 'the save survived the reload');

    // Every wing's stage renders.
    for (let wi = 0; wi < 7; wi++) {
        await Q(page, (wi) => { __tb.G.profile.wingOpen = 6; __tb.fight(wi === 6 ? { type: 'node', wing: 6, node: 0 } : { type: 'patrol', wing: wi }); }, wi);
        await page.waitForTimeout(300);
        await closeDialogs(page);
        await until(page, () => __tb.state().mode === 'battle' && __tb.state().idle, `wing ${wi} battle ready`, 60000);
        await frames(page, 6);
        const b = await Q(page, () => __tb.brightness());
        check(b > 2, `wing ${wi} stage renders (brightness ${Math.round(b)})`);
        await shot(page, `d19-wing${wi}`);
        await Q(page, () => __tb.G.retreat());
        await until(page, () => document.querySelector('.panel[data-name="result"]'), `wing ${wi} retreat result`, 90000);
        await clickText(page, '.panel-foot .btn', 'Continue');
        await until(page, () => __tb.state().mode === 'town', `wing ${wi} back to town`, 20000);
        await closeDialogs(page);
        await page.keyboard.press('Escape');
    }
    // Menu
    await page.click('#menu-btn');
    await until(page, () => document.querySelector('.panel[data-name="menu"]'), 'menu opens');
    await clickText(page, '.panel .btn', 'Music');
    check(await Q(page, () => __tb.G.settings.music === false), 'music toggles off');
    await page.keyboard.press('Escape');
}

// ------------------------------------------------------------------ Phones

async function tap(cdp, x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapSel(page, cdp, sel, text) {
    const loc = text ? page.locator(sel, { hasText: text }).first() : page.locator(sel).first();
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
    // Panels slide in (CSS); at software-GL frame rates measure after the entrance settles.
    await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running' && /panelIn|rise|pop/.test(a.animationName || '')), null, { timeout: 5000 }).catch(() => {});
    const b = await loc.boundingBox();
    if (!b) { check(false, `tap target ${sel} ${text || ''} visible`); return; }
    const hit = await loc.evaluate((el, p) => { const t = document.elementFromPoint(p.x, p.y); const own = el instanceof SVGElement ? el.closest('g') || el : el; return !!t && (own === t || own.contains(t) || t.contains(own)); }, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    check(hit, `tap target ${sel} ${text || ''} is not covered`);
    await tap(cdp, b.x + b.width / 2, b.y + b.height / 2);
}
async function swipe(cdp, a, b) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
    for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function phone(w, hgt) {
    console.log(`phone ${w}×${hgt}`);
    const { ctx, page } = await newPage({ width: w, height: hgt }, { hasTouch: true, isMobile: true });
    const cdp = await ctx.newCDPSession(page);
    await page.goto(URL0);
    await until(page, () => window.__tb && !document.getElementById('title').hidden, 'title (phone)');
    await tapSel(page, cdp, '#btn-new');
    await until(page, () => document.querySelector('.panel[data-name="create"]'), 'create panel (tap)');
    await tapSel(page, cdp, '.panel-foot .btn', 'Begin');
    await until(page, () => __tb.state().dialog, 'prologue (phone)');
    for (let i = 0; i < 40 && (await state(page)).dialog; i++) { await tapSel(page, cdp, '#dialog .dlg-text'); await page.waitForTimeout(50); }
    await Q(page, () => __tb.skipStory());
    await until(page, () => __tb.state().mode === 'town', 'town (phone)');
    await frames(page, 4);
    await shot(page, `p-${w}x${hgt}-town`);
    // Control sizes and on-screen checks
    const navs = await Q(page, () => [...document.querySelectorAll('#nav .nav-btn, #corner .corner-btn')].filter((b) => !b.hidden && b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
    for (const n of navs) check(n.w >= 44 && n.h >= 44 && n.l >= 0 && n.r <= w + 0.5 && n.t >= 0 && n.b <= hgt + 0.5, `control ${n.id} ≥44px and on screen (${Math.round(n.w)}×${Math.round(n.h)})`);
    // Build by taps
    await tapSel(page, cdp, '#nav-build');
    await until(page, () => document.querySelector('.panel[data-name="build"]'), 'build panel (tap)');
    await tapSel(page, cdp, '.panel .tile:first-child .btn', 'Build');
    await until(page, () => __tb.G.placing === 'lumber', 'placement (tap)');
    await Q(page, () => __tb.snap());
    await frames(page, 3);
    const ps = await Q(page, () => __tb.plotScreen(1));
    check(await Q(page, (p) => document.elementFromPoint(p.x, p.y)?.id === 'game-canvas', ps), 'the plot is not covered by the HUD');
    await tap(cdp, ps.x, ps.y);
    await until(page, () => __tb.G.profile.town.lumber?.plot === 1, 'Lumber Camp built on the tapped plot', 20000);
    if (!(await Q(page, () => __tb.G.profile.town.lumber?.plot === 1))) console.log('   debug', JSON.stringify(await Q(page, () => ({ town: __tb.G.profile.town, placing: __tb.G.placing, ps: __tb.plotScreen(1), panel: __tb.state() }))), JSON.stringify(ps));
    // Adventure by taps
    await tapSel(page, cdp, '#nav-adventure');
    await until(page, () => document.querySelector('.wing-card.current'), 'adventure (tap)');
    await tapSel(page, cdp, '.wing-card.current');
    await until(page, () => document.querySelector('.node-btn[data-node="0"]'), 'wing map (tap)');
    await shot(page, `p-${w}x${hgt}-map`);
    await tapSel(page, cdp, '.node-btn[data-node="0"] circle');
    await until(page, () => document.querySelector('.panel[data-name="prebattle"]'), 'pre-battle (tap)');
    await tapSel(page, cdp, '.panel-foot .btn', 'Fight');
    await until(page, () => __tb.state().mode === 'battle', 'battle (phone)');
    await page.waitForTimeout(300);
    for (let i = 0; i < 40 && (await state(page)).dialog; i++) { await tapSel(page, cdp, '#dialog .dlg-text'); await page.waitForTimeout(50); }
    await Q(page, () => __tb.skipStory());
    await until(page, () => __tb.state().idle && __tb.state().turn === 'p', 'board ready (phone)', 60000);
    await frames(page, 4);
    await shot(page, `p-${w}x${hgt}-battle`);
    const t0 = await Q(page, () => __tb.G.run.bt.stats.moves);
    const m = await Q(page, () => __tb.best());
    await swipe(cdp, m.pa, m.pb);
    await until(page, (t) => __tb.G.run.bt.stats.moves === t + 1, 'a real touch swipe swaps gems', 10000, t0);
    // Layout checks: board fully on screen, spell buttons ≥44px and not over the board
    const lay = await Q(page, () => {
        const r = (el) => el.getBoundingClientRect();
        const board = r(document.getElementById('board-area'));
        const spells = [...document.querySelectorAll('#p-spells .spell-btn')].map(r);
        const pcard = r(document.getElementById('p-card'));
        const ecard = r(document.getElementById('e-card'));
        const ov = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        return {
            board: { l: board.left, r: board.right, t: board.top, b: board.bottom },
            small: spells.filter((s) => s.width < 44 || s.height < 44).length,
            overBoard: spells.filter((s) => ov(s, board)).length,
            cardsOverlap: ov(pcard, board) || ov(ecard, board),
            spellsOff: spells.filter((s) => s.bottom > innerHeight + 0.5 || s.right > innerWidth + 0.5).length,
        };
    });
    check(lay.board.l >= 0 && lay.board.r <= w + 0.5 && lay.board.t >= 0 && lay.board.b <= hgt + 0.5, 'board fully on screen');
    check(lay.small === 0, 'spell buttons ≥ 44 px');
    check(lay.overBoard === 0 && !lay.cardsOverlap, 'HUD cards clear of the board');
    check(lay.spellsOff === 0, 'spell buttons on screen');
}

// ------------------------------------------------------------------ Run

try {
    if (process.env.ONLY !== 'phones') await desktop();
    if (process.env.ONLY !== 'desktop') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    errors.push('exception: ' + (e.stack || e.message));
} finally {
    if (browser) await browser.close();
}
const real = errors.filter((e) => !/GPU stall|swiftshader/i.test(e));
console.log(real.length ? `\n${real.length} PROBLEM(S):\n` + real.join('\n') : '\nALL BROWSER CHECKS PASS');
process.exit(real.length ? 1 : 0);
