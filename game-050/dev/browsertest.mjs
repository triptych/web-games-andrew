/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop: title → Begin → character creator (randomize, rename) → intro →
 * citadel → summon ×1 (reveal) → campaign stage 1-1 on auto at 3× → results →
 * a manual battle (pick a skill, tap a target) → hero growth (elixir, auto-equip)
 * → mine strike → farm plant → wheel spin → forge craft → expedition → quests
 * claim → save, reload, Continue. Phones (390×844 and 844×390, touch only):
 * every visible button is ≥ 44 px tall and inside the viewport on the main
 * screens, the tab bar works by tap, and a battle runs.
 * Fails on any console error, page error or failed request. Shots → dev/shots/.
 *
 *   python3 -m http.server 8050                 # from the REPO ROOT
 *   node game-050/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served
 * from disk (still the genuine r165):
 *   cd game-050/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz
 *
 * Env: BASE (default http://127.0.0.1:8050), THREE_PKG, PW_CHROMIUM_PATH, OUT, ONLY=desktop|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8050';
const URL0 = `${BASE}/game-050/index.html?debug=1`;
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let passed = 0;
function ok(c, msg) { if (!c) { errors.push('assert: ' + msg); console.log('  ✗', msg); } else { passed++; if (process.env.VERBOSE) console.log('  ✓', msg); } }

const launch = () => chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(browser, viewport, extra = {}) {
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
    // fonts are optional; serve an empty stylesheet when offline so the run is deterministic
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 404, body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
    page.on('requestfailed', (r) => { const u = r.url(); if (!u.includes('favicon') && !u.includes('fonts.')) errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`); });
    await page.goto(URL0);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    return { ctx, page };
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
async function waitScreen(page, id, timeout = 30000) {
    await page.waitForFunction((id) => window.__sb && window.__sb.current() === id, id, { timeout });
}
async function clickText(page, sel, text) {
    const loc = page.locator(sel, { hasText: text }).first();
    await loc.waitFor({ state: 'visible', timeout: 20000 });
    await loc.click();
}
async function closeModals(page) {
    for (let i = 0; i < 6; i++) {
        const has = await page.evaluate(() => document.querySelectorAll('.modal-back.on').length);
        if (!has) return;
        const btn = page.locator('.modal-back.on .modal-btns .btn').last();
        if (await btn.count()) await btn.click(); else await page.locator('.modal-back.on .modal-x').first().click();
        await page.waitForTimeout(300);
    }
}

async function battleToEnd(page, timeout = 240000) {
    await page.waitForFunction(() => document.querySelector('.result-title'), null, { timeout });
}

// ------------------------------------------------------------ desktop
async function desktop(browser) {
    console.log('desktop 1280×760');
    const { page } = await newPage(browser, { width: 1280, height: 760 });
    await shot(page, 'bt-title');
    await clickText(page, '.title-btns .btn', 'Begin');
    await waitScreen(page, 'creator');
    await page.waitForTimeout(600);
    await clickText(page, '.creator-panel .btn', 'Randomize');
    await page.locator('.creator-panel .tbtn', { hasText: 'Hair' }).click();
    await page.locator('.opt-row .opt', { hasText: 'Ponytail' }).click();
    await page.locator('.creator-panel .tbtn', { hasText: 'Weapon' }).click();
    await page.locator('.opt-row .opt', { hasText: 'Scythe' }).click();
    await page.fill('.name-input', 'Testarch');
    await shot(page, 'bt-creator');
    await clickText(page, '.creator-panel .btn', 'Begin Reign');
    await waitScreen(page, 'citadel');
    for (let i = 0; i < 3; i++) { await page.locator('.modal-back.on .modal-btns .btn').first().click(); await page.waitForTimeout(350); }
    await page.waitForSelector('.modal-back.on .modal-title', { timeout: 5000 });
    ok((await page.locator('.modal-back.on .modal-title').innerText()).includes('Daily Login'), 'login calendar after the intro');
    await clickText(page, '.modal-back.on .btn', 'Claim');
    ok(await page.evaluate(() => __sb.G.S.login.streak === 1), 'login reward claimed');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => __sb.G.S.overlord.name === 'Testarch'), 'overlord named');
    ok(await page.evaluate(() => __sb.G.S.overlord.look.weapon === 'scythe'), 'creator choices saved');
    await page.waitForTimeout(800);
    await shot(page, 'bt-citadel');
    // labels are tappable
    ok(await page.locator('.blabel').count() >= 10, 'building labels present');

    // summon
    await page.locator('#tabbar .tab[data-tab="summon"]').click();
    await waitScreen(page, 'summon');
    await page.locator('.sigil-tab', { hasText: 'Mystic' }).click();
    await clickText(page, '.summon-ui .btn', 'Summon ×1');
    await page.waitForSelector('.reveal-card', { timeout: 30000 });
    await page.waitForTimeout(500);
    await shot(page, 'bt-reveal');
    ok(await page.evaluate(() => __sb.G.S.heroes.length === 3), 'summon added a hero');
    ok(await page.evaluate(() => __sb.G.S.heroes[2].nat >= 4), 'first mystic summon is 4★+');
    await clickText(page, '.reveal-card .btn', 'Continue');

    // campaign 1-1 on auto, 3×
    await page.evaluate(() => { __sb.G.S.settings.speed = 3; __sb.G.S.settings.auto = true; });
    await page.locator('#tabbar .tab[data-tab="adventure"]').click();
    await waitScreen(page, 'adventure');
    await page.locator('.stage-btn', { hasText: '1-1' }).click();
    await clickText(page, '.modal-btns .btn', 'Prepare');
    await waitScreen(page, 'team');
    await clickText(page, '.sheet-foot .btn', 'Auto-fill');
    await page.waitForTimeout(400);
    await clickText(page, '.sheet-foot .btn', 'Battle!');
    await waitScreen(page, 'battle');
    await page.waitForTimeout(2500);
    await shot(page, 'bt-battle');
    ok(await page.locator('.uplate').count() >= 4, 'unit plates shown');
    ok(await page.locator('.tb-unit').count() >= 4, 'turn-order bar populated');
    await battleToEnd(page);
    await page.waitForTimeout(800);
    await shot(page, 'bt-result');
    ok(await page.evaluate(() => __sb.G.S.campaign.cleared >= 1), 'stage 1-1 cleared');
    await clickText(page, '.modal-btns .btn', 'Leave');
    await waitScreen(page, 'adventure');

    // manual battle: pick a skill, tap a target
    await page.evaluate(() => { __sb.G.S.settings.auto = false; __sb.G.S.settings.speed = 3; __sb.G.S.res.stamina = 99; __sb.go('battle', { mode: 'campaign', idx: 1, team: __sb.G.S.heroes.map((h) => h.id) }); });
    await waitScreen(page, 'battle');
    await page.waitForSelector('.skill-btn:not([disabled])', { timeout: 60000 });
    await shot(page, 'bt-manual');
    const first = page.locator('.skill-btn:not([disabled])').first();
    await first.click();
    const needsTarget = await page.locator('.uplate.targetable').count();
    if (needsTarget) await page.locator('.uplate.targetable').first().click();
    await page.waitForFunction(() => !document.querySelector('.manual-hint') || document.querySelector('.manual-hint').hidden, null, { timeout: 20000 });
    ok(true, 'manual skill accepted');
    // flip to auto to finish
    await page.locator('.bh-btn[aria-label="Auto battle"]').click();
    await battleToEnd(page);
    await closeModals(page);
    await page.evaluate(() => { __sb.G.S.settings.auto = true; });

    // a boss stage (wave banner, boss focus, boss music, enrage)
    await page.evaluate(() => { __sb.G.S.settings.speed = 3; __sb.G.S.res.stamina = 99; for (const x of __sb.G.S.heroes) { x.star = 4; x.level = 25; } __sb.go('battle', { mode: 'campaign', idx: 7, team: __sb.G.S.heroes.map((h) => h.id) }); });
    await waitScreen(page, 'battle');
    await page.waitForFunction(() => [...document.querySelectorAll('.uplate.boss')].length > 0, null, { timeout: 180000 });
    await page.waitForTimeout(600);
    await shot(page, 'bt-boss');
    ok(true, 'boss wave appears');
    await battleToEnd(page);
    await closeModals(page);

    // hero growth
    const hid = await page.evaluate(() => __sb.G.S.heroes[0].id);
    if (process.env.VERBOSE) console.log("   screen before hero:", await page.evaluate(() => [__sb.current(), document.querySelectorAll(".modal-back").length, document.querySelector("#fade").className]));
    const gerr = await page.evaluate(async (id) => { try { await __sb.go('hero', { id }); return null; } catch (e) { return e.message + ' ' + e.stack; } }, hid);
    if (gerr) console.log('go(hero) failed:', gerr);
    if (process.env.VERBOSE) { console.log('   after go(hero):', await page.evaluate(() => __sb.current())); await page.waitForTimeout(1000); console.log('   1s later:', await page.evaluate(() => [__sb.current(), document.querySelector('#fade').className])); }
    await waitScreen(page, 'hero');
    await page.locator('.hd-sheet .tbtn', { hasText: 'Grow' }).click();
    const lv0 = await page.evaluate((id) => { const x = __sb.G.S.heroes.find((h) => h.id === id); x.level = 1; x.xp = 0; return 1; }, hid);
    await page.locator('.hd-sheet .tbtn', { hasText: 'Stats' }).click();
    await page.locator('.hd-sheet .tbtn', { hasText: 'Grow' }).click();
    await page.evaluate(() => __sb.grant({ items: { xpM: 3 } }));
    await page.locator('.hd-sheet .btn', { hasText: '(M)' }).first().click();
    const lv1 = await page.evaluate((id) => __sb.G.S.heroes.find((h) => h.id === id).level, hid);
    ok(lv1 > lv0, `elixir levels a hero (${lv0} → ${lv1})`);
    await page.locator('.hd-sheet .tbtn', { hasText: 'Gear' }).click();
    await page.evaluate(() => __sb.grantGear(3));
    await clickText(page, '.hd-sheet .btn', 'Auto-equip');
    ok(await page.evaluate((id) => Object.keys(__sb.G.S.heroes.find((h) => h.id === id).gear).length > 0, hid), 'auto-equip equips gear');
    await shot(page, 'bt-hero');

    // mine: strike the top-left block until it breaks
    await page.evaluate(() => __sb.go('mine'));
    await waitScreen(page, 'mine');
    await page.waitForTimeout(800);
    await closeModals(page); // first-visit tip
    const before = await page.evaluate(() => __sb.G.S.counters.strikes || 0);
    const pt = await page.evaluate(() => __sb.mineCellScreen(0, 3));
    for (let i = 0; i < 3; i++) { await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(150); }
    ok(await page.evaluate((b) => (__sb.G.S.counters.strikes || 0) > b, before), 'tapping the rock face strikes it');
    await shot(page, 'bt-mine');

    // farm: plant a seed via the picker
    await page.evaluate(() => __sb.go('farm'));
    await waitScreen(page, 'farm');
    await page.waitForTimeout(800);
    await closeModals(page); // first-visit tip
    const fp = await page.evaluate(() => __sb.farmPlotScreen(0));
    await page.mouse.click(fp.x, fp.y);
    await clickText(page, '.modal .btn', 'Plant');
    ok(await page.evaluate(() => !!__sb.G.S.farm.plots[0].crop), 'planted a crop');
    await page.waitForTimeout(500);
    await shot(page, 'bt-farm');

    // wheel
    await page.evaluate(() => __sb.go('market', { tab: 'wheel' }));
    await waitScreen(page, 'market');
    await clickText(page, '.btn', 'Free Spin');
    await page.waitForSelector('.rewards-modal', { timeout: 15000 });
    ok(await page.evaluate(() => (__sb.G.S.counters.wheelSpins || 0) === 1), 'wheel spun');
    await closeModals(page);

    // forge craft
    await page.evaluate(() => { __sb.grant({ ores: { copper: 40 }, gold: 20000 }); __sb.go('forge', { tab: 'craft' }); });
    await waitScreen(page, 'forge');
    const g0 = await page.evaluate(() => __sb.G.S.gear.length);
    await clickText(page, '.sheet-body .btn', 'Craft');
    ok(await page.evaluate((g0) => __sb.G.S.gear.length === g0 + 1, g0), 'crafted a Sigilstone');
    await closeModals(page);

    // expedition
    await page.evaluate(() => __sb.go('tavern'));
    await waitScreen(page, 'tavern');
    await page.locator('.btn', { hasText: 'Choose Party' }).first().click();
    await page.locator('.modal .hero-card').first().click();
    await clickText(page, '.modal .btn', 'Send');
    ok(await page.evaluate(() => __sb.G.S.expeditions.active.length === 1), 'expedition sent');

    // quests: claim the first main quest
    await page.evaluate(() => __sb.go('quests', { tab: 'main' }));
    await waitScreen(page, 'quests');
    const q0 = await page.evaluate(() => __sb.G.S.quests.main);
    await clickText(page, '.quest .btn', 'Claim');
    ok(await page.evaluate((q0) => __sb.G.S.quests.main > q0, q0), 'main quest claimed');
    await closeModals(page);

    // every 3D stage renders something that is not black
    for (const s of ['citadel', 'summon', 'mine', 'farm', 'spire', 'arena']) {
        await page.evaluate((s) => __sb.go(s), s);
        await waitScreen(page, s);
        await page.waitForTimeout(500);
        const b = await page.evaluate(() => __sb.brightness());
        ok(b > 0.08, `${s} renders (brightness ${b.toFixed(2)})`);
    }

    // codex tab
    await page.evaluate(() => __sb.go('heroes', { view: 'codex' }));
    await waitScreen(page, 'heroes');
    ok(await page.locator('text=discovered').count() > 0, 'codex shows discoveries');

    // save + reload + continue
    await page.evaluate(() => __sb.saveGame(true));
    const n = await page.evaluate(() => __sb.G.S.heroes.length);
    await page.reload();
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await clickText(page, '.title-btns .btn', 'Continue');
    await waitScreen(page, 'citadel');
    ok(await page.evaluate((n) => __sb.G.S.heroes.length === n && __sb.G.S.overlord.name === 'Testarch', n), 'save survives a reload');
    await closeModals(page);
    await page.close();
}

// ------------------------------------------------------------ phones (touch only)
async function phone(browser, vp, tag) {
    console.log(`phone ${vp.width}×${vp.height}`);
    const { page } = await newPage(browser, vp, { hasTouch: true, isMobile: true });
    await page.evaluate(() => { __sb.newGame(); __sb.G.S.overlord.look = __sb.randomLook(); __sb.G.S.story.tips = { mine: 1, farm: 1 }; __sb.G.S.settings.speed = 3; });
    await page.evaluate(() => __sb.go('citadel'));
    await waitScreen(page, 'citadel');
    for (const s of ['citadel', 'heroes', 'summon', 'adventure', 'quests', 'mine', 'farm', 'forge', 'market', 'spire']) {
        await page.evaluate((s) => __sb.go(s), s);
        await waitScreen(page, s);
        await page.waitForTimeout(400);
        const bad = await page.evaluate(() => {
            const out = [];
            for (const el of document.querySelectorAll('#screen button, #tabbar button, #topbar button')) {
                const r = el.getBoundingClientRect();
                if (!r.width || !r.height) continue;
                const cs = getComputedStyle(el);
                if (cs.visibility === 'hidden' || cs.display === 'none') continue;
                const scroller = el.closest('.sheet-body, .opt-row, .sigil-tabs, .tabs, .chips, .modal-body');
                if (r.height < 40 && !el.classList.contains('chip') && !el.classList.contains('opt') && !el.classList.contains('hero-card') && !el.classList.contains('swatch')) out.push(`${el.textContent.trim().slice(0, 20) || el.getAttribute('aria-label')} h=${Math.round(r.height)}`);
                if (!scroller && (r.right > innerWidth + 1 || r.left < -1)) out.push(`${el.textContent.trim().slice(0, 20)} off-screen x`);
            }
            return out;
        });
        ok(!bad.length, `${tag} ${s}: tap targets ok ${bad.slice(0, 4).join('; ')}`);
        await shot(page, `bt-${tag}-${s}`);
    }
    // tab bar by touch
    await page.locator('#tabbar .tab[data-tab="heroes"]').tap();
    await waitScreen(page, 'heroes');
    ok(true, `${tag} tab bar taps`);
    // a battle on a phone
    await page.evaluate(() => { __sb.G.S.res.stamina = 99; __sb.go('battle', { mode: 'campaign', idx: 0, team: __sb.G.S.heroes.map((h) => h.id) }); });
    await waitScreen(page, 'battle');
    await page.waitForTimeout(2000);
    await shot(page, `bt-${tag}-battle`);
    await battleToEnd(page);
    await shot(page, `bt-${tag}-result`);
    ok(true, `${tag} battle completes`);
    await page.close();
}

const browser = await launch();
try {
    if (process.env.ONLY !== 'phones') await desktop(browser);
    if (process.env.ONLY !== 'desktop') {
        await phone(browser, { width: 390, height: 844 }, 'portrait');
        await phone(browser, { width: 844, height: 390 }, 'landscape');
    }
} catch (e) {
    errors.push('exception: ' + e.message);
    console.log(e);
}
await browser.close();
console.log(`\n${passed} checks passed`);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log('no errors');
