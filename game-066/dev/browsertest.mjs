/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop (1280×760): title (back link visible) → New Game → name and look → the opening narration →
 * Ma Bellows → pick Embrit at the workbench → walk with the keyboard → a wild battle won with the
 * Fight menu → catch a bot with a Reboot Spike → a trainer who spots you → evolution (level) with
 * its parts screen → a technique to learn → the wreck-repair welding minigame → pause menu: Team,
 * Summary, Bag (use a Patch Kit), Registry and an entry, Map, Settings → Boiler Station heal →
 * Parts Exchange (buy) → Workbench (craft) → Locker → the ending screen → save, reload, Continue.
 * Touch-only phones at 390×844 and 844×390: taps through the title and new game, touch controls
 * finger-sized and not covering the HUD, the D-pad walks, A talks, battle menus fit and are tappable,
 * panels fit, no sideways scroll.
 * Fails on any console error, page error or failed request. Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8066                 # from the REPO ROOT
 *   node game-066/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8066), ONLY=desktop|phones, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8066';
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
                localStorage.setItem('scrapwright.v1.settings', JSON.stringify({ muted: true, quality: 3, textSpeed: 'instant' }));
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

// S = the debug hooks, A = the app, G = the current game.
const S = (page, js) => page.evaluate(`(() => { const S = window.__rt, A = S.app, G = A.game; ${js} })()`);
const waitFor = (page, js, timeout = 90000) => page.waitForFunction(`(() => { const S = window.__rt, A = S && S.app, G = A && A.game; return ${js}; })()`, null, { timeout, polling: 100 });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
/** Wait until the view has drawn n more frames (SwiftShader can take a second or more per frame). */
async function frames(page, n = 2) {
    const f0 = await S(page, 'return S.view.frameNo || 0');
    await waitFor(page, `(S.view.frameNo || 0) >= ${f0 + n}`);
}
async function press(page, key, hold = 0) { await page.keyboard.down(key); if (hold) await page.waitForTimeout(hold); else await frames(page, 1); await page.keyboard.up(key); }

/** What the player is looking at right now. */
const STATE = `return JSON.stringify({ mode: A.mode, iris: A.view.iris, dialog: A.dialog.open, choices: !!document.querySelector('#dchoices:not(.hidden) button'),
    prompt: A.prompts.open ? A.prompts.kind : null, panel: A.menus.open ? A.menus.cur.name : null, pending: G && G.pending ? G.pending.type : null,
    playing: A.battleUI.playing, menu: A.battleUI.menu, over: !!(G && G.battle && G.battle.over) })`;
const state = async (page) => JSON.parse(await S(page, STATE));

/** Press through dialogue until the player is free (or something else needs handling). choose = answer for Yes/No. */
async function advance(page, { choose = 0, max = 80 } = {}) {
    for (let i = 0; i < max; i++) {
        const s = await state(page);
        if (process.env.VERBOSE) console.log('    advance', JSON.stringify(s));
        if (s.mode === 'battle' || s.mode === 'battle-intro') return 'battle';
        if (s.prompt) return `prompt:${s.prompt}`;
        if (s.panel) return `panel:${s.panel}`;
        if (s.dialog && s.choices) { await page.click(`#dchoices button[data-i="${choose}"]`); await frames(page, 1); continue; }
        if (s.dialog) { await press(page, 'KeyZ'); continue; }
        if (!s.pending && s.iris === 0) return 'free';
        await frames(page, 1);
    }
    return 'stuck';
}

/** Play a battle to the end with the Fight menu (or a chosen action). Handles prompts that follow. */
async function fight(page, { move = 0, onCmd = null, max = 400 } = {}) {
    let turns = 0;
    for (let i = 0; i < max; i++) {
        const s = await state(page);
        if (s.mode === 'world') return { turns };
        if (s.prompt === 'learn') { await page.click('#prompt button[data-i="0"]'); continue; }
        if (s.prompt) { await frames(page, 1); continue; }
        if (s.mode !== 'battle' || s.playing || !s.menu) { if (s.playing) await press(page, 'KeyZ'); else await frames(page, 1); continue; }
        if (s.menu === 'cmd') {
            if (onCmd && (await onCmd(turns))) { turns++; continue; }
            await page.click('#bmenu .fight');
        } else if (s.menu === 'moves') {
            const n = await page.locator('#bmenu .mv:not([disabled])').count();
            await page.locator('#bmenu .mv:not([disabled])').nth(Math.min(move, n - 1)).click();
            turns++;
        } else if (s.menu === 'team') await page.locator('#bmenu .tm:not([disabled])').first().click();
        else await page.click('#bmenu .back');
        await frames(page, 1);
    }
    throw new Error('battle did not finish');
}

const SETTLED = 'A.mode === "world" && A.lastWorld === G.world && A.view.irisDir === 0 && A.view.iris === 0 && !G.pending';
async function tp(page, map, x, y, dir) {
    await S(page, `S.tp(${JSON.stringify(map)}, ${x}, ${y}, ${JSON.stringify(dir)});`);
    await frames(page, 2);
    await waitFor(page, SETTLED);
    await advance(page);
    await waitFor(page, SETTLED);
}
/** Teleport next to something and press A at it. */
async function talkAt(page, map, x, y, dir) {
    await tp(page, map, x, y, dir);
    await press(page, 'KeyZ');
    await frames(page, 1);
}

async function desktop() {
    console.log('\n== desktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    await page.goto(`${BASE}/game-066/index.html?debug=1&seed=4242&fast=4`);
    await waitFor(page, 'S && S.mode === "title" && S.view.frameNo > 2');
    const back = await page.locator('#back-link').boundingBox();
    check(back && back.y >= 0 && back.x >= 0, 'back link visible on the title');
    check(!(await page.locator('button[data-a="continue"]').count()), 'no Continue without a save');
    await shot(page, 'bt-title');

    // New game.
    await page.click('button[data-a="new"]');
    await page.click('.chip[data-v="aviator"]');
    await page.click('.sw[data-k="coatColor"][data-v="#2a4a6a"]');
    await page.fill('#ngname', 'Tessa');
    await shot(page, 'bt-newgame');
    await page.click('#ngstart');
    await waitFor(page, 'A.mode === "world" && G && G.world.id === "home"');
    check(!(await page.locator('#back-link').isVisible()), 'back link hides while playing');
    check(await S(page, 'return G.state.name === "Tessa" && G.state.look.hat === "aviator"'), 'name and look carry into the game');
    await frames(page, 2);
    await shot(page, 'bt-opening');
    check((await advance(page)) === 'free', 'the opening narration plays through');

    // Ma Bellows, then the starter.
    await talkAt(page, 'workshop', 7, 6, 'up');
    check((await advance(page)) === 'free' && (await S(page, 'return G.state.flags.maTalked')), 'Ma Bellows explains the starters');
    await talkAt(page, 'workshop', 3, 4, 'up');
    await shot(page, 'bt-starter');
    let r = await advance(page, { choose: 0 });
    check(await S(page, 'return G.state.party.length === 1 && G.state.party[0].sp === S.species.find(s => s && s.name === "Embrit").id'), 'picked Embrit from the workbench');
    if (r === 'battle') { await fight(page); r = await advance(page); }
    check(r === 'free', `free to roam after the starter (${r})`);

    // Walk with the keyboard.
    await tp(page, 'cinderwick', 11, 7, 'down');
    const y0 = await S(page, 'return G.world.player.y');
    await page.keyboard.down('ArrowDown');
    await waitFor(page, `G.world.player.y > ${y0}`, 60000).catch(() => {});
    await page.keyboard.up('ArrowDown');
    check((await S(page, 'return G.world.player.y')) > y0, 'arrow keys walk');
    await shot(page, 'bt-town');

    // A wild battle, won with Fight.
    await S(page, 'G.state.party[0].lv = 14; G.state.party[0].xp = 2744; G.healAll(); S.wild("Bolty", 3);');
    await waitFor(page, 'A.mode === "battle" && A.battleUI.menu === "cmd"');
    await shot(page, 'bt-battle');
    const box = await page.locator('.bbox').boundingBox();
    check(box && box.y + box.height <= 760 && box.x >= 0, 'battle box fits the screen');
    await page.click('#bmenu .fight');
    await frames(page, 1);
    await shot(page, 'bt-moves');
    check((await page.locator('#bmenu .mv').count()) >= 2, 'Fight lists techniques');
    const xp0 = await S(page, 'return G.state.party[0].xp');
    await fight(page);
    check((await S(page, 'return G.state.party[0].xp')) > xp0, 'winning gives experience');
    check(await S(page, 'return G.state.battles >= 1'), 'the battle is counted');

    // Catch with a Reboot Spike from the bag.
    await S(page, 'G.give("reboot-spike", 5); S.wild("Tinwing", 2);');
    await waitFor(page, 'A.mode === "battle" && A.battleUI.menu === "cmd"');
    await S(page, 'G.battle.side[1].units[0].hp = 1;');
    let thrown = 0;
    await fight(page, {
        onCmd: async () => {
            if (thrown > 6) return false;
            thrown++;
            await page.click('#bmenu .bag');
            await frames(page, 1);
            if (thrown === 1) await shot(page, 'bt-bag');
            await page.locator('#bmenu .it').first().click();
            return true;
        },
    });
    let caught = await S(page, 'return G.state.party.some(u => u.sp === S.species.find(s => s && s.name === "Tinwing").id)');
    r = await advance(page);
    check(caught, `a Reboot Spike catches a wild Tinwing (${thrown} thrown)`);

    // A trainer spots the player.
    await S(page, 'G.healAll();');
    await tp(page, 'route1', 13, 5, 'right');
    await page.keyboard.down('ArrowRight');
    await waitFor(page, 'G.pending || A.dialog.open || A.mode !== "world"', 60000).catch(() => {});
    await page.keyboard.up('ArrowRight');
    await frames(page, 2);
    await shot(page, 'bt-spotted');
    r = await advance(page);
    check(r === 'battle', 'Dex spots the player and challenges them');
    if (r === 'battle') {
        await waitFor(page, 'A.mode === "battle"');
        await frames(page, 4);
        await shot(page, 'bt-trainer');
        await fight(page);
        r = await advance(page);
        check(await S(page, 'return !!G.state.flags["beat:route1:b"] || Object.keys(G.state.flags).some(k => /route1/.test(k))'), 'beating Dex is remembered');
    }

    // Level-up evolution, with the parts it installed.
    await S(page, 'const u = G.state.party[0]; const sp = S.species[u.sp]; u.lv = sp.evolves.lv - 1; u.xp = Math.pow(sp.evolves.lv, 3) - 1; G.healAll(); S.wild("Bolty", 3);');
    await waitFor(page, 'A.mode === "battle"');
    await fight(page);
    await waitFor(page, 'A.prompts.open && A.prompts.kind === "evolve"', 60000).catch(() => {});
    check(await S(page, 'return A.prompts.kind === "evolve"'), 'the evolution sequence starts after the battle');
    await frames(page, 3);
    await shot(page, 'bt-evolve');
    await waitFor(page, 'A.prompts.kind === "evolved" || A.prompts.kind === "learn"', 90000).catch(() => {});
    for (let i = 0; i < 6 && (await S(page, 'return A.prompts.kind === "learn"')); i++) await page.click('#prompt button[data-i="-1"]');
    await waitFor(page, 'A.prompts.kind === "evolved"', 30000).catch(() => {});
    await shot(page, 'bt-evolved');
    check(await S(page, 'return A.prompts.kind === "evolved" && document.querySelectorAll("#prompt .part.new").length > 0'), 'the evolved screen lists new parts');
    check(await S(page, 'return S.species[G.state.party[0].sp].name === "Furnacle"'), 'Embrit evolved into Furnacle');
    await page.click('#prompt button.default');
    r = await advance(page);
    for (let i = 0; i < 4 && r === 'prompt:learn'; i++) { await page.click('#prompt button[data-i="-1"]'); r = await advance(page); }
    check(r === 'free', `back to the world after evolving (${r})`);

    // Repair a wreck (it needs salvage first).
    await S(page, 'G.give("scrap-metal", 3); G.give("rubber", 2);');
    await talkAt(page, 'route1', 20, 14, 'down');
    r = await advance(page, { choose: 0 });
    check(r === 'prompt:repair', `a wreck opens the repair minigame (${r})`);
    if (r === 'prompt:repair') {
        await shot(page, 'bt-repair');
        for (let i = 0; i < 3; i++) { await page.click('#weld'); await page.waitForTimeout(200); }
        await waitFor(page, '!A.prompts.open || A.prompts.kind !== "repair"', 30000);
        r = await advance(page, { choose: 1 });
        check(await S(page, 'return G.state.wrecks >= 1'), 'the wreck is repaired');
    }

    // Pause menu and every panel.
    await waitFor(page, 'A.mode === "world" && !G.pending');
    await press(page, 'Escape');
    await waitFor(page, 'A.menus.open');
    await shot(page, 'bt-menu');
    for (const p of ['team', 'bag', 'registry', 'map', 'settings']) {
        await page.click(`.pnl.menu [data-p="${p}"]`);
        await waitFor(page, `A.menus.cur.name === "${p}"`);
        await frames(page, 2);
        await shot(page, `bt-panel-${p}`);
        const pr = await page.locator('.pnl').boundingBox();
        check(pr && pr.x >= 0 && pr.y >= 0 && pr.y + pr.height <= 761, `${p} panel fits`);
        if (p === 'team') {
            await page.click('.tcell');
            await waitFor(page, 'A.menus.cur.name === "summary"');
            await frames(page, 2);
            await shot(page, 'bt-panel-summary');
            check((await page.locator('.pnl .srow').count()) === 6, 'summary shows six stats');
            await press(page, 'KeyX');
        }
        if (p === 'bag') {
            await S(page, 'G.state.party[0].hp = 3;');
            await page.click('.tab[data-p="repair"]');
            await page.click('.irow[data-id="patch-kit"]');
            await waitFor(page, 'A.menus.cur.name === "pick"');
            const hp0 = await S(page, 'return G.state.party[0].hp');
            await page.click('.tcell[data-i="0"]');
            check((await S(page, 'return G.state.party[0].hp')) > hp0, 'a Patch Kit from the bag repairs a bot');
        }
        if (p === 'registry') {
            await page.locator('.rcell:not([disabled])').first().click();
            await waitFor(page, 'A.menus.cur.name === "entry"');
            await frames(page, 2);
            await shot(page, 'bt-panel-entry');
            await press(page, 'KeyX');
        }
        await press(page, 'KeyX');
        await waitFor(page, 'A.menus.cur && A.menus.cur.name === "menu"');
    }
    await press(page, 'Escape');
    await waitFor(page, '!A.menus.open');
    ok('pause menu panels open and close');

    // Station heal, shop, workbench, locker.
    await S(page, 'G.state.party.forEach(u => u.hp = 1);');
    await talkAt(page, 'gasket-station', 6, 2, 'up');
    r = await advance(page, { choose: 0 });
    check(await S(page, 'return G.state.party.every(u => u.hp > 1)'), 'the Boilerkeeper repairs the team');
    await talkAt(page, 'gasket-shop', 5, 2, 'up');
    r = await advance(page);
    check(r === 'panel:shop', `the clerk opens the Parts Exchange (${r})`);
    if (r === 'panel:shop') {
        await shot(page, 'bt-shop');
        const c0 = await S(page, 'return G.state.cogs');
        await page.locator('.rrow button[data-x="buy"]:not([disabled])').first().click();
        check((await S(page, 'return G.state.cogs')) < c0, 'buying spends cogs');
        await press(page, 'KeyX');
        r = await advance(page);
    }
    await S(page, 'G.give("scrap-metal", 10); G.give("copper-wire", 10); G.give("spring", 10); G.give("rubber", 10);');
    await talkAt(page, 'workshop', 12, 5, 'right');
    r = await advance(page);
    check(r === 'panel:bench', `the workbench opens (${r})`);
    if (r === 'panel:bench') {
        await shot(page, 'bt-bench');
        const n = await page.locator('.rrow button[data-x="craft"]:not([disabled])').count();
        if (n) { const before = await S(page, 'return G.state.bag["scrap-metal"]'); await page.locator('.rrow button[data-x="craft"]:not([disabled])').first().click(); check((await S(page, 'return G.state.bag["scrap-metal"] || 0')) <= before, 'crafting uses materials'); }
        else fail('nothing craftable with plenty of materials');
        await press(page, 'KeyX');
        r = await advance(page);
    }
    await talkAt(page, 'workshop', 2, 6, 'down');
    r = await advance(page);
    check(r === 'panel:locker', `the locker opens (${r})`);
    if (r === 'panel:locker') {
        await page.locator('button[data-x="deposit"]').last().click();
        check(await S(page, 'return G.state.locker.length === 1'), 'a bot goes into the locker');
        await page.locator('button[data-x="withdraw"]').first().click();
        check(await S(page, 'return G.state.locker.length === 0'), 'and comes back out');
        await press(page, 'KeyX');
        r = await advance(page);
    }

    // The ending screen.
    await S(page, 'G.pending = { type: "ending" };');
    await waitFor(page, 'A.prompts.kind === "ending"');
    await frames(page, 2);
    await shot(page, 'bt-ending');
    check((await page.locator('.endtitle').textContent()).includes('CHAMPION'), 'the ending screen shows');
    await page.click('#prompt button.default');
    check((await advance(page)) === 'free', 'play continues after the ending');

    // Save, reload, Continue.
    await press(page, 'Escape');
    await waitFor(page, 'A.menus.open');
    await page.click('.pnl.menu [data-x="save"]');
    const want = await S(page, 'return JSON.stringify({ n: G.state.party.length, map: G.world.id, x: G.world.player.x, cogs: G.state.cogs })');
    await page.reload();
    await waitFor(page, 'S && S.mode === "title" && S.view.frameNo > 2');
    check(await page.locator('button[data-a="continue"]').count() === 1, 'the title offers Continue after saving');
    await page.click('button[data-a="continue"]');
    await waitFor(page, 'A.mode === "world" && G');
    const got = await S(page, 'return JSON.stringify({ n: G.state.party.length, map: G.world.id, x: G.world.player.x, cogs: G.state.cogs })');
    check(got === want, `Continue restores the game (${got})`);
}

// ------------------------------------------------------------------ phones
async function phone(w, h) {
    console.log(`\n== touch phone ${w}×${h}`);
    const { page } = await newPage({ width: w, height: h }, true);
    const cdp = await page.context().newCDPSession(page);
    const tapAt = async (x, y, hold = 120) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await page.waitForTimeout(hold);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const tapEl = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await tapAt(b.x + b.width / 2, b.y + b.height / 2); await frames(page, 1); };
    const noScroll = async (what) => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1), `no sideways scroll (${what})`);

    await page.goto(`${BASE}/game-066/index.html?debug=1&seed=99&fast=4`);
    await waitFor(page, 'S && S.mode === "title" && S.view.frameNo > 2');
    await shot(page, `bt-phone-${w}-title`);
    await noScroll('title');
    await tapEl('button[data-a="new"]');
    await waitFor(page, '!!document.getElementById("ngstart")');
    await shot(page, `bt-phone-${w}-newgame`);
    const st = await page.locator('#ngstart').boundingBox();
    check(st && st.y + st.height <= h + 1 || await page.evaluate(() => document.querySelector('.screen.newgame').scrollHeight > innerHeight), 'the start button is reachable');
    await page.locator('#ngstart').scrollIntoViewIfNeeded();
    await tapEl('#ngstart');
    await waitFor(page, 'A.mode === "world" && G');
    await frames(page, 2);
    check(await page.locator('#touch').isVisible(), 'touch controls show in the world');
    for (const id of ['#tb-a', '#tb-b', '#tb-menu', '#dpad']) {
        const b = await page.locator(id).boundingBox();
        check(b && b.width >= 44 && b.height >= 44 && b.x >= 0 && b.y + b.height <= h + 1, `${id} is finger-sized and on screen`);
    }
    // A taps through the opening narration.
    for (let i = 0; i < 40 && (await S(page, 'return A.dialog.open')); i++) await tapEl('#tb-a');
    check(!(await S(page, 'return A.dialog.open')), 'A advances dialogue');
    const dlg = await page.locator('#dialog').boundingBox();
    void dlg;

    // The D-pad walks.
    await tp(page, 'cinderwick', 11, 7, 'down');
    const obj = await page.locator('#objective').boundingBox();
    const pad = await page.locator('#dpad').boundingBox();
    const btns = await page.locator('#tbtns').boundingBox();
    check(!obj || (obj.y + obj.height < pad.y && obj.y + obj.height < btns.y), 'touch controls leave the objective clear');
    const y0 = await S(page, 'return G.world.player.y');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + pad.width / 2, y: pad.y + pad.height * 0.85, id: 2 }] });
    await waitFor(page, `G.world.player.y > ${y0}`, 60000).catch(() => {});
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check((await S(page, 'return G.world.player.y')) > y0, 'the D-pad walks');
    await shot(page, `bt-phone-${w}-world`);
    await noScroll('world');

    // Talking with A.
    await tp(page, 'cinderwick', 11, 8, 'up');
    await tapEl('#tb-a');
    await waitFor(page, 'A.dialog.open', 20000).catch(() => {});
    check(await S(page, 'return A.dialog.open'), 'A reads the sign ahead');
    await frames(page, 2);
    await shot(page, `bt-phone-${w}-dialog`);
    const d = await page.locator('#dialog').boundingBox();
    check(d && d.x >= 0 && d.x + d.width <= w + 1 && d.y + d.height <= h + 1, 'the dialogue box fits');
    for (let i = 0; i < 10 && (await S(page, 'return A.dialog.open')); i++) await tapEl('#dialog');
    check(!(await S(page, 'return A.dialog.open')), 'tapping the dialogue box advances it');

    // A battle by touch.
    await S(page, 'S.bot("Embrit", 12); S.wild("Bolty", 2);');
    await waitFor(page, 'A.mode === "battle" && A.battleUI.menu === "cmd"');
    await frames(page, 2);
    check(!(await page.locator('#touch').isVisible()), 'the D-pad hides in battle');
    await shot(page, `bt-phone-${w}-battle`);
    const bb = await page.locator('.bbox').boundingBox();
    check(bb && bb.x >= 0 && bb.x + bb.width <= w + 1 && bb.y + bb.height <= h + 1, 'the battle box fits');
    const g0 = await page.locator('#g0').boundingBox(), g1 = await page.locator('#g1').boundingBox();
    check(g0 && g1 && g0.y + g0.height <= bb.y + 1 && g1.y + g1.height <= bb.y + 1 && (g0.y >= g1.y + g1.height || g0.x >= g1.x + g1.width), 'gauges sit clear of each other and the battle box');
    const fb = await page.locator('#bmenu .fight').boundingBox();
    check(fb.height >= 40, 'battle buttons are finger-sized');
    await tapEl('#bmenu .fight');
    await frames(page, 1);
    await shot(page, `bt-phone-${w}-moves`);
    const mvs = await page.locator('#bmenu .mv').all();
    for (const m of mvs) { const b = await m.boundingBox(); if (!(b && b.y + b.height <= h + 1)) { fail('a technique button is off screen'); break; } }
    await tapEl('#bmenu .mv');
    for (let i = 0; i < 300 && (await S(page, 'return A.mode')) !== 'world'; i++) {
        const s = await state(page);
        if (s.menu === 'cmd') await tapEl('#bmenu .fight');
        else if (s.menu === 'moves') await tapEl('#bmenu .mv:not([disabled])');
        else if (s.menu === 'team') await tapEl('#bmenu .tm:not([disabled])');
        else if (s.prompt === 'learn') await tapEl('#prompt button[data-i="-1"]');
        else if (s.playing) await tapEl('.bbox');
        else await frames(page, 1);
    }
    check((await S(page, 'return A.mode')) === 'world', 'the battle plays out by touch');
    await advance(page);
    await waitFor(page, SETTLED);

    // Panels by touch (the Registry button needs the Registry).
    await S(page, 'G.give("registry", 1);');
    await tapEl('#tb-menu');
    await waitFor(page, 'A.menus.open');
    check(!(await page.locator('#touch').isVisible()) || (await S(page, 'return document.body.classList.contains("panel-open")')), 'the menu covers the controls');
    for (const p of ['team', 'bag', 'registry', 'map', 'settings']) {
        await tapEl(`.pnl.menu [data-p="${p}"]`);
        await waitFor(page, `A.menus.cur.name === "${p}"`);
        await frames(page, 1);
        const r = await page.locator('.pnl').boundingBox();
        check(r && r.x >= 0 && r.y >= 0 && r.x + r.width <= w + 1 && r.y + r.height <= h + 1, `the ${p} panel fits (${r ? [r.x, r.y, r.width, r.height].map(Math.round).join(',') : 'none'})`);
        if (p === 'team') await shot(page, `bt-phone-${w}-team`);
        const close = await page.locator('.pnl .pclose').boundingBox();
        check(close && close.width >= 36, 'panel close button is finger-sized');
        await tapEl('.pnl .pclose');
        await waitFor(page, 'A.menus.cur && A.menus.cur.name === "menu"');
    }
    await noScroll('menu');
    await tapEl('.pnl .pclose');
    check(!(await S(page, 'return A.menus.open')), 'the menu closes');
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
