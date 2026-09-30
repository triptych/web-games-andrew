/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Walks the real game: title → hero select → prologue → chapter → map →
 * battle (mouse drag + tap-to-place + End Turn button) → reward → event →
 * shop → campfire → treasure → Warden (intro, fight, crown, epilogue, next
 * chapter) → death and rekindle → the final Warden → ending. Then a combat
 * screenshot of all ten realms, and touch-only play on a 390×844 phone and an
 * 844×390 landscape phone (tap targets ≥ 40px, nothing off-screen).
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8047                 # from the REPO ROOT
 *   node game-047/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three once and point THREE_PKG at it:
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node game-047/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8047), OUT (screenshots), ONLY=desktop|worlds|phones
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8047';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    // pin quality (auto-quality would fight the test) and speed the animations up
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('aa-init')) { sessionStorage.setItem('aa-init', '1'); localStorage.clear(); localStorage.setItem('ashes-aces-settings', JSON.stringify({ quality: '1', speed: '2.2', music: 0.2, sfx: 0.2 })); } } catch { /* ignore */ } });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} ${e.stack?.split('\n')[1] ?? ''}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 120000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, sel) => page.locator(sel).isVisible();
const clickText = async (page, text) => { await page.getByRole('button', { name: text }).first().click(); };

async function openGame(page) {
    await page.goto(`${BASE}/game-047/index.html?debug=1`);
    await until(page, () => window.__aa && document.querySelector('#scr-title:not(.hidden)'), 'title screen up');
}

async function waitIdle(page, msg = 'battle idle') {
    return until(page, () => window.__aa.screen !== 'combat' || (window.__aa.battle.idle() && window.__aa.battle.B()?.st.phase === 'player'), msg);
}

async function winBattle(page, label) {
    await waitIdle(page, `${label}: battle idle`);
    await Q(page, () => window.__aa.win());
    await until(page, () => window.__aa.screen !== 'combat', `${label}: battle ends`);
}

/** Click through queued story beats (and interlude choices) until the map or a node shows. */
async function throughStory(page, label) {
    for (let i = 0; i < 12; i++) {
        const scr = await Q(page, () => window.__aa.screen);
        if (scr !== 'story' && scr !== 'picker') return;
        if (scr === 'picker') { await page.locator('#scr-modal .cardbox').first().click(); continue; }
        if (await visible(page, '#story-next')) await page.locator('#story-next').click();
        else await page.locator('#story-choices .choice:not([disabled])').first().click();
        await page.waitForTimeout(150);
    }
    void label;
}

// ------------------------------------------------------------------ desktop walk

async function desktop() {
    console.log('desktop 1280×720');
    const { page } = await newPage({ width: 1280, height: 720 });
    await openGame(page);
    await page.waitForTimeout(1200);
    await shot(page, '01-title');

    await clickText(page, 'New Journey');
    await until(page, () => window.__aa.screen === 'heroes', 'hero select');
    await page.locator('.hero-card').nth(1).click();
    await clickText(page, 'Another Face');
    await page.waitForTimeout(600);
    await shot(page, '02-heroes');
    await clickText(page, 'Begin');
    await until(page, () => window.__aa.screen === 'story', 'prologue shows');
    await shot(page, '03-prologue');
    await page.locator('#story-next').click();
    await until(page, () => document.querySelector('#story-kicker').textContent.includes('Chapter I'), 'chapter I card');
    await shot(page, '04-chapter');
    await page.locator('#story-next').click();
    await until(page, () => window.__aa.screen === 'map', 'map shows');
    await page.waitForTimeout(500);
    await shot(page, '05-map');
    check(await Q(page, () => document.querySelectorAll('.mnode.avail').length) >= 2, 'several start nodes to choose from');

    // first battle: real mouse
    await page.locator('.mnode.avail').first().click();
    await until(page, () => window.__aa.screen === 'combat', 'battle starts');
    await waitIdle(page);
    await shot(page, '06-battle');
    const h0 = await Q(page, () => window.__aa.battle.handPx(0));
    const c0 = await Q(page, () => window.__aa.battle.cellPx(0));
    await page.mouse.move(h0.x, h0.y);
    await page.mouse.down();
    await page.mouse.move((h0.x + c0.x) / 2, (h0.y + c0.y) / 2, { steps: 5 });
    await page.mouse.move(c0.x, c0.y, { steps: 5 });
    await page.mouse.up();
    await until(page, () => window.__aa.battle.B().st.board[0].card, 'drag-and-drop placed a card');
    await waitIdle(page);
    // tap-to-place
    const h1 = await Q(page, () => window.__aa.battle.handPx(0));
    await page.mouse.click(h1.x, h1.y);
    const c1 = await Q(page, () => window.__aa.battle.cellPx(1));
    await page.mouse.move(c1.x, c1.y);
    await page.waitForTimeout(200);
    await page.mouse.click(c1.x, c1.y);
    await until(page, () => window.__aa.battle.B().st.board[1].card, 'tap-select then tap-cell placed a card');
    await waitIdle(page);
    await page.locator('#btn-end').click();
    await until(page, () => window.__aa.battle.B().st.turn >= 2, 'End Turn button → enemy turn → turn 2');
    await waitIdle(page);
    // fill the rest of row 0 so a line fires
    for (let c = 2; c < 5; c++) {
        const empty = await Q(page, (cc) => !window.__aa.battle.B().st.board[cc].card, c);
        if (empty) await Q(page, (cc) => window.__aa.battle.place(0, cc), c);
        await waitIdle(page);
    }
    const lines = await Q(page, () => window.__aa.battle.B().st.stats.lines);
    check(lines >= 1, 'a completed row fired as a poker hand');
    await shot(page, '07-battle-fired');
    // pause menu
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#scr-modal').classList.contains('hidden'), 'Esc opens the menu');
    await shot(page, '08-menu');
    await page.keyboard.press('Escape');
    await page.keyboard.press('h');
    await until(page, () => document.querySelector('#modal-title').textContent === 'Hand Ranks', 'H opens hand ranks');
    await page.keyboard.press('Escape');
    await page.keyboard.press('d');
    await until(page, () => document.querySelector('#modal-title').textContent.startsWith('Your Deck'), 'D opens the deck');
    await shot(page, '09-deck');
    await page.keyboard.press('Escape');
    await winBattle(page, 'battle 1');
    await until(page, () => window.__aa.screen === 'reward', 'reward screen');
    await shot(page, '10-reward');
    const deckBefore = await Q(page, () => window.__aa.run.deck.length);
    await page.locator('#panel-body .cardbox').first().click();
    check(await Q(page, () => window.__aa.run.deck.length) === deckBefore + 1, 'reward card joins the deck');
    await clickText(page, 'Continue');
    await until(page, () => window.__aa.screen === 'map', 'back to the map');

    // each node type via debug jump
    for (const type of ['event', 'shop', 'rest', 'treasure', 'elite']) {
        const entered = await Q(page, (t) => window.__aa.goto(t), type);
        check(entered === type, `${type}: node found on the map and entered`);
        await throughStory(page, type);
        await page.waitForTimeout(400);
        const scr = await Q(page, () => window.__aa.screen);
        await shot(page, `11-${type}`);
        if (scr === 'event') {
            await page.locator('#story-choices .choice:not([disabled])').first().click();
            await page.waitForTimeout(200);
            await throughStory(page, 'event');
            for (let i = 0; i < 4; i++) {
                const s2 = await Q(page, () => window.__aa.screen);
                const modalUp = await Q(page, () => !document.querySelector('#scr-modal').classList.contains('hidden'));
                if (s2 === 'picker' || modalUp) await page.locator('#scr-modal .cardbox, #scr-modal button').first().click().catch(() => {});
                else break;
            }
            if (await Q(page, () => window.__aa.screen) === 'combat') await winBattle(page, 'event fight');
            await page.waitForTimeout(200);
            await shot(page, '12-event-result');
            if (await visible(page, '#story-next')) await page.locator('#story-next').click();
            await page.waitForTimeout(300);
            if (await Q(page, () => window.__aa.screen) === 'combat') {
                await winBattle(page, 'event fight');
                await until(page, () => window.__aa.screen === 'reward', 'event fight gives a reward');
                await clickText(page, 'Leave');
            }
        } else if (scr === 'shop') {
            await Q(page, () => { window.__aa.run.gold = 999; window.__aa.advance(); });
            await page.locator('#panel-body .item:not([disabled])').first().click();
            check(await Q(page, () => window.__aa.run.gold) < 999, 'bought something at the shop');
            await clickText(page, 'Leave');
        } else if (scr === 'rest') {
            await page.locator('#panel-body .item').nth(1).click();
            await until(page, () => window.__aa.screen === 'picker', 'temper opens the card picker');
            await shot(page, '12-temper');
            await page.locator('#scr-modal .cardbox').first().click();
            await clickText(page, 'Continue');
        } else if (scr === 'treasure') {
            await clickText(page, 'Open the Chest');
            await shot(page, '12-treasure-open');
            await clickText(page, 'Continue');
        } else if (scr === 'combat') {
            await waitIdle(page);
            await shot(page, '12-elite');
            await winBattle(page, 'elite');
            await clickText(page, 'Leave');
        }
        await until(page, () => ['map', 'story'].includes(window.__aa.screen), `${type}: returns to map`);
    }

    // Warden of world 1 → crown → epilogue → chapter II
    await Q(page, () => window.__aa.jump(0, 9));
    await Q(page, () => window.__aa.enter('boss'));
    await until(page, () => window.__aa.screen === 'story', 'Warden intro');
    await shot(page, '13-boss-intro');
    await page.locator('#story-next').click();
    await until(page, () => window.__aa.screen === 'combat', 'Warden battle');
    await waitIdle(page);
    await page.waitForTimeout(600);
    await shot(page, '14-boss');
    await winBattle(page, 'boss');
    await until(page, () => window.__aa.screen === 'story', 'Warden defeat text');
    await page.locator('#story-next').click();
    await until(page, () => window.__aa.screen === 'reward', 'boss reward');
    check(await Q(page, () => !!window.__aa.run.pending.crown), 'Warden drops a Crown');
    await shot(page, '15-boss-reward');
    await clickText(page, 'Leave');
    await until(page, () => window.__aa.run.world === 1, 'on to world 2');
    check(await Q(page, () => window.__aa.run.relics.includes('crownAsh')), 'crown was kept even without clicking it');
    await throughStory(page, 'epilogue');
    await until(page, () => window.__aa.screen === 'map', 'world 2 map');
    await shot(page, '16-world2-map');

    // death & rekindle
    await Q(page, () => window.__aa.enter('battle'));
    await throughStory(page, 'pre-battle');
    await waitIdle(page);
    await Q(page, () => { window.__aa.battle.hurtPlayer(1); });
    await page.locator('#btn-end').click();
    await until(page, () => window.__aa.screen === 'dead', 'death screen');
    await shot(page, '17-dead');
    await page.locator('#story-choices .choice').first().click();
    await throughStory(page, 'rekindle');
    await until(page, () => window.__aa.screen === 'map' && window.__aa.run.hp === window.__aa.run.maxHp, 'rekindled at full HP');

    // save/continue round trip
    await page.reload();
    await until(page, () => window.__aa && !document.querySelector('#t-continue').classList.contains('hidden'), 'Continue offered after reload');
    await clickText(page, 'Continue');
    await until(page, () => window.__aa.screen === 'map' && window.__aa.run.world === 1, 'Continue restores the run');

    // the final Warden and an ending
    await Q(page, () => window.__aa.jump(9, 9));
    await Q(page, () => window.__aa.enter('boss'));
    await throughStory(page, 'king intro');
    await until(page, () => window.__aa.screen === 'combat', 'the Hollow King');
    await waitIdle(page);
    await shot(page, '18-king');
    await winBattle(page, 'king');
    await throughStory(page, 'king defeat');
    await until(page, () => window.__aa.screen === 'reward', 'final reward');
    await clickText(page, 'Leave');
    await until(page, () => window.__aa.screen === 'ending', 'ending choice');
    await shot(page, '19-ending-choice');
    await page.locator('#story-choices .choice').nth(1).click();
    await until(page, () => window.__aa.screen === 'done', 'ending text');
    await shot(page, '20-ending');
    await page.locator('#story-next').click();
    await until(page, () => window.__aa.screen === 'title', 'back to title');
}

// ------------------------------------------------------------------ all ten realms

async function worlds() {
    console.log('ten realms');
    for (let w = 0; w < 10; w++) {
        const { page } = await newPage({ width: 1280, height: 720 });
        await openGame(page);
        await Q(page, (ww) => { window.__aa.newRun('knight', 777 + ww); window.__aa.jump(ww, 5); }, w);
        await Q(page, () => window.__aa.enter(window.__aa.run.world % 2 ? 'elite' : 'battle'));
        await throughStory(page, 'realm');
        await until(page, () => window.__aa.screen === 'combat', `realm ${w + 1}: battle`);
        await waitIdle(page);
        await page.waitForTimeout(1500);
        await shot(page, `w${String(w + 1).padStart(2, '0')}`);
    }
}

// ------------------------------------------------------------------ phones (touch only)

async function tap(page, cdp, x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(120);
}

async function phone(vw, vh, name) {
    console.log(`phone ${vw}×${vh}`);
    const { ctx, page } = await newPage({ width: vw, height: vh }, { hasTouch: true, isMobile: true });
    const cdp = await ctx.newCDPSession(page);
    await openGame(page);
    await page.waitForTimeout(800);
    await shot(page, `${name}-title`);
    const nb = await page.locator('#t-new').boundingBox();
    await tap(page, cdp, nb.x + nb.width / 2, nb.y + nb.height / 2);
    await until(page, () => window.__aa.screen === 'heroes', `${name}: hero select by touch`);
    await shot(page, `${name}-heroes`);
    const go = await page.locator('#h-go').boundingBox();
    await tap(page, cdp, go.x + go.width / 2, go.y + go.height / 2);
    await throughStory(page, 'phone story');
    await until(page, () => window.__aa.screen === 'map', `${name}: map`);
    await shot(page, `${name}-map`);
    const node = await page.locator('.mnode.avail').first().boundingBox();
    check(node && node.width >= 40 && node.y > 0 && node.y + node.height < vh, `${name}: map node on screen and ≥40px`);
    await tap(page, cdp, node.x + node.width / 2, node.y + node.height / 2);
    await until(page, () => window.__aa.screen === 'combat', `${name}: battle`);
    await waitIdle(page);
    await shot(page, `${name}-battle`);
    const h = await Q(page, () => window.__aa.battle.handPx(0));
    const c = await Q(page, () => window.__aa.battle.cellPx(12));
    check(h.y < vh && h.y > vh * 0.6, `${name}: hand on screen`);
    await tap(page, cdp, h.x, h.y);
    await tap(page, cdp, c.x, c.y);
    await until(page, () => window.__aa.battle.B().st.board[12].card, `${name}: touch tap-to-place`);
    await waitIdle(page);
    const end = await page.locator('#btn-end').boundingBox();
    check(end && end.height >= 40 && end.x + end.width <= vw && end.y + end.height <= vh, `${name}: End Turn on screen, ≥40px`);
    const table = await Q(page, () => ({ top: window.__aa.battle.cellPx(0), bot: window.__aa.battle.cellPx(24) }));
    check(table.top.y > 0 && table.bot.y < vh, `${name}: whole table on screen`);
    await tap(page, cdp, end.x + end.width / 2, end.y + end.height / 2);
    await until(page, () => window.__aa.battle.B().st.turn >= 2, `${name}: End Turn by touch`);
    await waitIdle(page);
    await shot(page, `${name}-battle2`);
}

// ------------------------------------------------------------------ run

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'worlds') await worlds();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844, 'portrait'); await phone(844, 390, 'landscape'); }
} catch (e) {
    errors.push(`exception: ${e.stack ?? e}`);
} finally {
    if (browser) await browser.close();
}
if (errors.length) {
    console.log(`\n${errors.length} problem(s):`);
    for (const e of errors.slice(0, 40)) console.log('  -', e);
    process.exit(1);
}
console.log('\nbrowser test passed');
