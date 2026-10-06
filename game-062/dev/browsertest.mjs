/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop (1280×760): title (back link visible) → New Fruit → creator (class, fruit, hat, name) →
 * Tristrawberry → walk by clicking the ground → click Deckard Cane (quest) → Granny's shop (buy a
 * jam) → backpack: equip by double-click → character: spend a point → skills: learn + bind →
 * Wishing Well → cellar door → Root Cellar 1 → click a grape until it pops → right-click a skill →
 * Q drinks → click a loot label → R bakes a Portal Pie → town → back down → Tab map → Esc menu →
 * die and respawn → The Juicer (boss bar, kill, stairs, quest) → reward from Cane → Durian →
 * victory screen → save & quit → Continue.
 * Touch-only phones at 390×844 and 844×390: CDP touches through title and creator, controls ≥ 44 px
 * and not covering the HUD, the stick walks, ⚔️ attacks, a skill button casts, panels open, no
 * sideways scroll, canvas not clipped.
 * Fails on any console error, page error or failed request. Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8062                 # from the REPO ROOT
 *   node game-062/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8062), ONLY=desktop|phones, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8062';
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
            if (!sessionStorage.getItem('rt-init')) {
                sessionStorage.setItem('rt-init', '1');
                localStorage.clear();
                localStorage.setItem('rttc.v1.settings', JSON.stringify({ muted: true, quality: '2' }));
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
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { page, ctx };
}

const S = (page, js) => page.evaluate(`(() => { const S = window.__rt; ${js} })()`);
const waitFor = (page, js, timeout = 60000) => page.waitForFunction(`(() => { const S = window.__rt; return ${js}; })()`, null, { timeout, polling: 100 });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
/** Screen position of an entity (sim x, y) at a height. */
/** Wait until the view has drawn n more frames (SwiftShader can take seconds per frame while shaders compile). */
async function frames(page, n = 2) {
    const f0 = await S(page, 'return S.view.frameNo || 0');
    await waitFor(page, `(S.view.frameNo || 0) >= ${f0 + n}`, 60000);
}
async function screenOf(page, x, y, h = 0.5) {
    await S(page, 'S.view.snap = true;');
    await frames(page, 2);
    return S(page, `return S.view.project(${x}, ${h}, ${y});`);
}
async function clickWorld(page, x, y, h = 0.5, button = 'left') {
    const p = await screenOf(page, x, y, h);
    await page.mouse.move(p.x, p.y);
    await frames(page, 1);
    await page.mouse.down({ button }); await frames(page, 1); await page.mouse.up({ button });
    return p;
}

async function desktop() {
    console.log('\n== desktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    await page.goto(`${BASE}/game-062/index.html?debug=1&seed=4242&fast=3`);
    await waitFor(page, 'S && S.mode === "title"');
    const back = await page.locator('#back-link').boundingBox();
    check(back && back.y >= 0 && back.x >= 0, 'back link visible on the title');
    await shot(page, 'bt-title');

    // Creator.
    await page.click('text=New Fruit');
    await waitFor(page, 'S.mode === "creator"');
    await page.click('.cls >> text=Citromancer');
    await page.click('.chip.fruit[title=lemon]');
    await page.click('.chip >> text=Top hat');
    await page.fill('#cr-name', 'Sir Testalot');
    await page.waitForTimeout(300);
    check(await S(page, 'return S.game.hero.cls === "mage" && S.game.hero.look.hat === "tophat"'), 'creator preview follows class, fruit and hat');
    await shot(page, 'bt-creator');
    await page.click('text=Into Tristrawberry!');
    await waitFor(page, 'S.mode === "play" && S.world.town');
    check(await S(page, 'return S.game.hero.name') === 'Sir Testalot', 'hero named Sir Testalot');
    check(!(await page.locator('#back-link').isVisible()), 'back link hidden while playing');
    check(await page.locator('#hud').isVisible(), 'HUD visible');
    await S(page, 'S.god(true)');

    // Walk by clicking the ground.
    const p0 = await S(page, 'const h = S.world.hero; return [h.x, h.y];');
    await clickWorld(page, p0[0] + 3, p0[1] + 3, 0);
    await waitFor(page, `Math.hypot(S.world.hero.x - ${p0[0]}, S.world.hero.y - ${p0[1]}) > 1.5`, 30000).catch(() => {});
    check(await S(page, `const h = S.world.hero; return Math.hypot(h.x - ${p0[0]}, h.y - ${p0[1]}) > 1.5`), 'clicking the ground walks there');

    // Deckard Cane.
    await S(page, 'const c = S.world.npcs.find((n) => n.npc === "cane"); S.tp(c.x, c.y + 1.4);');
    await page.waitForTimeout(600);
    const cane = await S(page, 'const c = S.world.npcs.find((n) => n.npc === "cane"); return [c.x, c.y];');
    const cp = await clickWorld(page, cane[0], cane[1], 0.6);
    await waitFor(page, 'S.panels.isOpen("dialog")', 20000).catch(() => {});
    if (process.env.VERBOSE) console.log('    cane', cp, await S(page, 'const h = S.world.hero; return JSON.stringify([h.x, h.y, h.intent, S.view.hover && S.view.hover.kind, S.input.mouse, S.view.camMode])'));
    check(await S(page, 'return S.game.hero.quests.freshfruit === 1'), 'clicking Deckard Cane gives "Ahh, Fresh Fruit!"');
    await shot(page, 'bt-cane');
    await page.click('.panel >> text=Goodbye');

    // Granny's pantry.
    await S(page, 'const w = S.world; S.app.panels.showDialog(S.game.talk("granny"));');
    await page.click('.services >> text=Trade');
    await waitFor(page, 'S.panels.isOpen("shop")');
    const jams = await S(page, 'return S.game.hero.potions.hp');
    await page.click('.panel >> button[data-act=buypot][data-k=hp][data-n="1"]');
    check(await S(page, 'return S.game.hero.potions.hp') === jams + 1, "bought a Strawberry Jam in Granny's pantry");
    await page.keyboard.press('Escape');

    // Backpack: equip by double-click.
    await S(page, 'S.give("wand", "rare", 1);');
    await page.keyboard.press('KeyI');
    await waitFor(page, 'S.panels.isOpen("inv")');
    const cell = page.locator('.cell[data-from=inv]').first();
    await cell.dblclick();
    await page.waitForTimeout(300);
    check(await S(page, 'return S.game.hero.equip.weapon && S.game.hero.equip.weapon.rarity === "rare"'), 'double-clicking a wand equips it');
    await shot(page, 'bt-backpack');
    // Character sheet.
    await S(page, 'S.level(3);');
    await page.keyboard.press('KeyC');
    await waitFor(page, 'S.panels.isOpen("char")');
    const mag = await S(page, 'return S.game.hero.alloc.mag');
    await page.click('.plus[data-s=mag]');
    check(await S(page, 'return S.game.hero.alloc.mag') === mag + 1, 'spent an attribute point on Zest');
    // Skills: learn Brain Freeze and bind it to 1.
    await page.keyboard.press('KeyK');
    await waitFor(page, 'S.panels.isOpen("skills")');
    await page.click('.plus[data-sk=brainfreeze]');
    check(await S(page, 'return S.game.hero.skills.brainfreeze') === 1, 'learned Brain Freeze');
    await page.click('[data-act=bind][data-sk=brainfreeze][data-slot="2"]');
    check(await S(page, 'return S.game.hero.bar[2]') === 'brainfreeze', 'bound Brain Freeze to key 1');
    await shot(page, 'bt-skills');
    await page.keyboard.press('Space');
    await frames(page, 2);
    check(!(await S(page, 'return S.panels.any()')), 'Space closes the panels');

    // Wishing Well.
    await S(page, 'const o = S.world.objs.find((x) => x.type === "well"); S.tp(o.x, o.y + 1.6);');
    await page.waitForTimeout(500);
    const well = await S(page, 'const o = S.world.objs.find((x) => x.type === "well"); return [o.x, o.y];');
    await clickWorld(page, well[0], well[1], 0.4);
    await waitFor(page, 'S.panels.isOpen("waypoint")', 20000).catch(() => {});
    check(await S(page, 'return S.panels.isOpen("waypoint")'), 'the Wishing Well opens the waypoint list');
    await page.keyboard.press('Escape');

    // Into the cellar.
    await S(page, 'const o = S.world.objs.find((x) => x.type === "cellar"); S.tp(o.x, o.y + 1.8);');
    await page.waitForTimeout(500);
    const cellar = await S(page, 'const o = S.world.objs.find((x) => x.type === "cellar"); return [o.x, o.y];');
    await clickWorld(page, cellar[0], cellar[1], 0.3);
    await waitFor(page, 'S.world.floor === 1', 30000).catch(() => {});
    check(await S(page, 'return S.world.floor') === 1, 'the cellar door leads to the Root Cellar');
    await page.waitForTimeout(800);
    await shot(page, 'bt-cellar');

    // Click a grape until it pops.
    await S(page, 'S.god(false); const w = S.world, h = w.hero; for (const m of w.mons) if (Math.hypot(m.x - h.x, m.y - h.y) < 12) { m.dead = true; m.deadT = 99; } const m = w.spawnMon("grape", h.x + 1.8, h.y - 0.4, {}); m.aggro = true; m.dmgMul = 0.01; window.__g = m.id;');
    await page.waitForTimeout(400);
    const kills0 = await S(page, 'return S.game.hero.stats.kills');
    for (let i = 0; i < 8; i++) {
        const g = await S(page, 'const m = S.world.monById(window.__g); return m && !m.dead ? [m.x, m.y] : null;');
        if (!g) break;
        await clickWorld(page, g[0], g[1], 0.5);
        await page.waitForTimeout(1500);
    }
    await waitFor(page, `S.game.hero.stats.kills > ${kills0}`, 30000).catch(() => {});
    check(await S(page, `return S.game.hero.stats.kills > ${kills0} && S.game.hero.xp > 0`), 'clicking a Moldy Grape squashes it for XP');
    await shot(page, 'bt-squash');

    // Right-click casts the RMB skill (Caramelize) at a monster.
    await S(page, 'const w = S.world, h = w.hero; const m = w.spawnMon("peelton", h.x + 3, h.y, {}); m.aggro = true; m.dmgMul = 0.01; window.__p = m.id; w.hero.juice = w.hero.maxJuice;');
    await page.waitForTimeout(300);
    const pe = await S(page, 'const m = S.world.monById(window.__p); return [m.x, m.y];');
    const j0 = await S(page, 'return S.world.hero.juice');
    await S(page, 'window.__ev = []; const w = S.world; const o = w.emit.bind(w); w.emit = (t, d) => { window.__ev.push(t); o(t, d); };');
    await clickWorld(page, pe[0], pe[1], 0.5, 'right');
    await waitFor(page, 'window.__ev.includes("cast")', 20000).catch(() => {});
    check(await S(page, 'return window.__ev.includes("cast")'), `right-click casts Caramelize (juice ${j0.toFixed(0)} → ${(await S(page, 'return S.world.hero.juice')).toFixed(0)})`);
    await page.keyboard.press('Digit1');
    await waitFor(page, 'window.__ev.includes("nova")', 20000).catch(() => {});
    check(await S(page, 'return window.__ev.includes("nova")'), 'key 1 casts Brain Freeze');
    await page.waitForTimeout(500);
    await shot(page, 'bt-skills-cast');

    // Q drinks a jam.
    await S(page, 'const h = S.world.hero; h.hp = h.maxHp * 0.3;');
    const jam0 = await S(page, 'return S.game.hero.potions.hp');
    await page.keyboard.press('KeyQ');
    await frames(page, 2);
    check(await S(page, 'return S.game.hero.potions.hp') === jam0 - 1, 'Q drinks a Strawberry Jam');

    // Pick up loot by clicking its label.
    await S(page, 'const w = S.world, h = w.hero; for (const m of w.mons) if (!m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 9) w.killMon(m); w.spawnLoot({ items: [S.give("ring", "magic", 1)], sugar: 0 }, h.x + 1.5, h.y + 0.5); S.game.hero.inv = S.game.hero.inv.map((it) => it && it.slot === "ring" && it !== w.items.at(-1)?.item ? it : it);');
    // give() put the ring in the bag too; take it back out so the label is the only copy.
    await S(page, 'const hero = S.game.hero; const gi = S.world.items.at(-1); hero.inv = hero.inv.map((it) => (it === gi.item ? null : it));');
    await page.waitForTimeout(1200);
    const label = page.locator('.loot-label', { hasText: 'Ring' }).first();
    const inv0 = await S(page, 'return S.game.hero.inv.filter(Boolean).length');
    if (await label.isVisible().catch(() => false)) {
        await label.click({ force: true });
        await waitFor(page, `S.game.hero.inv.filter(Boolean).length > ${inv0}`, 20000).catch(() => {});
        if (process.env.VERBOSE) console.log('    label', await S(page, 'const h = S.world.hero; return JSON.stringify([h.x, h.y, h.intent, S.world.items.map((i) => [i.x, i.y, i.item && i.item.name])])'));
        check(await S(page, `return S.game.hero.inv.filter(Boolean).length > ${inv0}`), 'clicking a loot label picks the ring up');
    } else fail('a loot label is visible for the dropped ring');

    // Portal Pie round trip. (Clear the floor loot first: its labels sit on top of the canvas and take clicks.)
    await S(page, 'S.world.items.length = 0;');
    await page.keyboard.press('KeyR');
    await waitFor(page, 'S.world.objs.some((o) => o.type === "portal")', 10000).catch(() => {});
    check(await S(page, 'return S.world.objs.some((o) => o.type === "portal")'), 'R bakes a Portal Pie');
    await S(page, 'const p = S.world.objs.find((o) => o.type === "portal"); S.tp(p.x, p.y + 1.2);');
    await page.waitForTimeout(400);
    const portal = await S(page, 'const p = S.world.objs.find((o) => o.type === "portal"); return [p.x, p.y];');
    await clickWorld(page, portal[0], portal[1], 1.0);
    await waitFor(page, 'S.world.town', 30000).catch(() => {});
    check(await S(page, 'return S.world.town && S.world.objs.some((o) => o.type === "portal")'), 'the portal leads home, and a portal back waits in town');
    await S(page, 'const p = S.world.objs.find((o) => o.type === "portal"); S.tp(p.x, p.y + 1.2);');
    await page.waitForTimeout(400);
    const tportal = await S(page, 'const p = S.world.objs.find((o) => o.type === "portal"); return [p.x, p.y];');
    await clickWorld(page, tportal[0], tportal[1], 1.0);
    await waitFor(page, 'S.world.floor === 1', 30000).catch(() => {});
    check(await S(page, 'return S.world.floor === 1 && !S.game.portal'), 'the portal back goes down and closes');

    // Map and menu.
    await page.keyboard.press('Tab');
    await frames(page, 2);
    check(await page.locator('#automap').isVisible(), 'Tab shows the automap');
    await shot(page, 'bt-automap');
    await page.keyboard.press('Tab');
    await frames(page, 2);
    await page.keyboard.press('Escape');
    await waitFor(page, 'S.panels.isOpen("menu")');
    await page.click('text=Settings');
    await waitFor(page, 'S.panels.isOpen("settings")');
    await page.selectOption('select[data-set=labels]', 'alt');
    check(await S(page, 'return S.app.settings.labels') === 'alt', 'settings change loot labels to Alt only');
    await page.selectOption('select[data-set=labels]', 'always');
    await page.click('.panel >> text=Back');
    await page.click('text=Resume');
    check(!(await S(page, 'return S.panels.any()')), 'Resume closes the menu');

    // Die and respawn.
    const sugar0 = await S(page, 'S.game.hero.sugar = 500; return 500;');
    await S(page, 'const w = S.world; w.hero.hp = 1; w.damageHero(50, "phys", null, { aoe: true });');
    await waitFor(page, 'S.mode === "dead"', 30000).catch(() => {});
    check(await S(page, 'return S.mode') === 'dead', 'running out of Freshness shows the death screen');
    await shot(page, 'bt-death');
    await page.click('text=Respawn in town');
    await waitFor(page, 'S.mode === "play" && S.world.town');
    check(await S(page, 'return S.game.hero.sugar') === sugar0 - Math.floor(sugar0 * 0.1), 'respawned in town, a tenth of the sugar lighter');

    // The Juicer.
    await S(page, 'S.god(true); S.floor(4);');
    await waitFor(page, 'S.world.floor === 4');
    await S(page, 'const b = S.world.boss(); S.tp(b.x, b.y + 6);');
    await waitFor(page, 'S.world.boss().state !== "sleep"', 30000).catch(() => {});
    await page.waitForTimeout(800);
    check(await page.locator('#bossbar').isVisible(), 'The Juicer wakes up and shows a boss bar');
    await shot(page, 'bt-juicer');
    await S(page, 'const w = S.world; w.damageMon(w.boss(), 1e6, "phys", { src: "hero" });');
    await waitFor(page, 'S.world.objs.some((o) => o.type === "down")', 20000).catch(() => {});
    check(await S(page, 'return S.world.objs.some((o) => o.type === "down") && S.game.hero.quests.freshfruit === 2'), 'killing The Juicer opens the stairs and finishes the quest');
    await page.waitForTimeout(800);
    await shot(page, 'bt-juicer-dead');
    await S(page, 'S.app.travel(0);');
    await waitFor(page, 'S.world.town');
    const pts = await S(page, 'return S.game.hero.skillPts');
    await S(page, 'S.app.panels.showDialog(S.game.talk("cane"));');
    check(await S(page, 'return S.game.hero.quests.freshfruit === 3') && (await S(page, 'return S.game.hero.skillPts')) === pts + 1, 'Deckard Cane rewards the quest (+1 skill point and a Ripe item)');
    await page.keyboard.press('Escape');

    // Durian and the ending.
    await S(page, 'S.floor(12);');
    await waitFor(page, 'S.world.floor === 12');
    await S(page, 'const b = S.world.boss(); S.tp(b.x, b.y + 6);');
    await waitFor(page, 'S.world.boss().state !== "sleep"', 30000).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, 'bt-durian');
    await S(page, 'const w = S.world; w.damageMon(w.boss(), 1e7, "phys", { src: "hero" });');
    await waitFor(page, 'S.mode === "victory"', 40000).catch(() => {});
    check(await S(page, 'return S.mode') === 'victory', 'squashing Durian the Diabolical shows the victory screen');
    await shot(page, 'bt-victory');
    await page.click('text=Keep playing');

    // Save, quit, continue.
    await page.keyboard.press('Escape');
    await page.click('text=Save & quit to title');
    await waitFor(page, 'S.mode === "title"');
    const cont = page.locator('.title-menu >> text=Continue');
    check(await cont.isVisible(), 'the title offers Continue');
    await cont.click();
    await waitFor(page, 'S.mode === "play"');
    check(await S(page, 'return S.game.hero.name === "Sir Testalot" && S.game.hero.quests.core >= 2'), 'Continue restores Sir Testalot with the quests done');
}

// ------------------------------------------------------------------ phones
async function phone(w, h) {
    console.log(`\n== touch-only phone ${w}×${h}`);
    const { page, ctx } = await newPage({ width: w, height: h }, true);
    const cdp = await ctx.newCDPSession(page);
    const tap = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(250);
    };
    const tapEl = async (sel) => {
        const loc = page.locator(sel).first();
        await loc.scrollIntoViewIfNeeded();
        const b = await loc.boundingBox();
        const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        const covered = await loc.evaluate((t, [x, y]) => { const e = document.elementFromPoint(x, y); return !(e === t || t.contains(e)); }, [cx, cy]);
        if (covered) fail(`${sel} is covered at its centre`);
        await tap(cx, cy);
    };
    await page.goto(`${BASE}/game-062/index.html?debug=1&seed=77&fast=3`);
    await waitFor(page, 'S && S.mode === "title"');
    check(await S(page, 'return S.input.isTouch'), 'detected a touch-only device');
    await tapEl('.title-menu >> text=New Fruit');
    await waitFor(page, 'S.mode === "creator"');
    await tapEl('.cls >> text=Seed Ranger');
    await tapEl('text=Into Tristrawberry!');
    await waitFor(page, 'S.mode === "play"');
    await page.waitForTimeout(600);
    await shot(page, `bt-phone-${w}-town`);
    check(await page.locator('#touch').isVisible(), 'touch controls shown');

    // Layout: controls big enough and not on top of the HUD readouts.
    const lay = await page.evaluate(() => {
        const rect = (e) => e.getBoundingClientRect();
        const ctrls = [...document.querySelectorAll('#tbtns .tb:not(.empty), #menubtns button, #belt .pot')].filter((e) => e.offsetParent);
        const small = ctrls.filter((e) => { const r = rect(e); return r.width < 40 || r.height < 34; }).map((e) => e.id || e.className);
        const huds = ['#g-hp', '#g-juice', '#minimap', '#area', '#xp'].map((s) => document.querySelector(s)).filter(Boolean);
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const overlaps = [];
        for (const c of [...document.querySelectorAll('#tbtns .tb:not(.empty), #menubtns button')].filter((e) => e.offsetParent)) for (const hd of huds) if (hit(rect(c), rect(hd))) overlaps.push(`${c.id || c.dataset.slot} × ${hd.id}`);
        return { small, overlaps, sw: document.documentElement.scrollWidth, iw: innerWidth, canvas: rect(document.getElementById('gl')) };
    });
    check(!lay.small.length, `controls are finger-sized${lay.small.length ? ' — small: ' + lay.small.join(', ') : ''}`);
    check(!lay.overlaps.length, `controls don't cover HUD readouts${lay.overlaps.length ? ' — ' + lay.overlaps.join(', ') : ''}`);
    check(lay.sw <= lay.iw + 1, 'no sideways scroll');
    check(lay.canvas.left >= -1 && lay.canvas.right <= lay.iw + 1 && lay.canvas.width >= lay.iw - 2, 'canvas fills the screen without clipping');

    // Stick walks.
    const p0 = await S(page, 'const h = S.world.hero; return [h.x, h.y];');
    const zone = await page.locator('#stick-zone').boundingBox();
    const sx = zone.x + zone.width * 0.4, sy = zone.y + zone.height * 0.6;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 2 }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 8, y: sy - i * 7, id: 2 }] }); await page.waitForTimeout(40); }
    await page.waitForTimeout(1500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(await S(page, `const h = S.world.hero; return Math.hypot(h.x - ${p0[0]}, h.y - ${p0[1]}) > 0.8`), 'the stick walks the hero');

    // Into the cellar, attack with ⚔️, cast with a skill button.
    await S(page, 'S.god(true); S.floor(1);');
    await waitFor(page, 'S.world.floor === 1');
    await S(page, 'const w = S.world, h = w.hero; for (const m of w.mons) if (Math.hypot(m.x - h.x, m.y - h.y) < 12) { m.dead = true; m.deadT = 99; } for (let i = 0; i < 3; i++) { const m = w.spawnMon("grape", h.x + 2 + i * 0.5, h.y - 0.5, {}); m.aggro = true; } window.__ev = []; const o = w.emit.bind(w); w.emit = (t, d) => { window.__ev.push(t); o(t, d); };');
    await page.waitForTimeout(600);
    const atk = await page.locator('#tb-attack').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: atk.x + atk.width / 2, y: atk.y + atk.height / 2, id: 3 }] });
    await waitFor(page, 'window.__ev.includes("hit")', 30000).catch(() => {});
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(await S(page, 'return window.__ev.includes("hit")'), '⚔️ attacks the nearest enemy');
    await S(page, 'S.world.hero.juice = S.world.hero.maxJuice;');
    await tapEl('.tb[data-slot="1"]');
    await waitFor(page, 'window.__ev.includes("cast")', 20000).catch(() => {});
    check(await S(page, 'return window.__ev.includes("cast")'), 'a skill button casts at the nearest enemy');
    await shot(page, `bt-phone-${w}-fight`);
    // Tap a monster.
    const g = await S(page, 'const w = S.world, h = w.hero; const m = w.spawnMon("grape", h.x + 2, h.y - 0.6, {}); m.speed = 0; m.dmgMul = 0.01; return [m.x, m.y];');
    if (g) {
        await S(page, 'S.world.hero.intent = null; S.world.items.length = 0; window.__ev = [];');
        const p = await screenOf(page, g[0], g[1], 0.5);
        await tap(p.x, p.y);
        await waitFor(page, '(S.world.hero.intent && S.world.hero.intent.kind === "attack") || window.__ev.includes("swing") || window.__ev.includes("cast")', 20000).catch(() => {});
        check(await S(page, 'const i = S.world.hero.intent; return (!!i && i.kind === "attack") || window.__ev.includes("swing") || window.__ev.includes("cast")'), 'tapping a grape attacks it');
    }
    // Panels.
    await tapEl('#mb-inv');
    await waitFor(page, 'S.panels.isOpen("inv")');
    await shot(page, `bt-phone-${w}-inv`);
    const closeBox = await page.locator('.panel .x').first().boundingBox();
    check(closeBox.width >= 40 && closeBox.height >= 40, 'panel close button is finger-sized');
    await tapEl('.panel .x');
    check(!(await S(page, 'return S.panels.any()')), 'the panel closes');
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    fail(`crashed: ${e.stack}`);
}
if (browser) await browser.close();
const errs = [...new Set(errors)];
if (errs.length) { console.log('\nErrors:'); for (const e of errs.slice(0, 30)) console.log('  ' + e); }
check(!errs.length, 'no console errors, page errors or failed requests');
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
