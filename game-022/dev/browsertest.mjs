/**
 * browsertest.mjs — Depths Unknown's ending, in real Chromium.
 *
 * Desktop (1280×760) and a touch-only phone (390×844):
 * title → BEGIN MISSION → in the mine → a base visit with ordinary ore sells
 * it and shows no ending → a base visit carrying Singing Vein ore plays the
 * ending over a paused base → its buttons wait for the text → KEEP MINING
 * returns to the base → DEPLOY returns to the mine → the save records the
 * mission → a reload shows MISSION COMPLETE on the title → a second vein
 * does not replay the ending → NEW GAME from the ending starts a fresh world.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8000                 # from the REPO ROOT
 *   node game-022/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8000), OUT (screenshots, default dev/shots), PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8000';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = `${BASE}/game-022/index.html?debug=1`;

let failures = 0, passes = 0;
const errors = [];
function check(cond, msg) {
    if (cond) passes++;
    else { failures++; console.log(`  FAIL ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

const active = (page, key) => page.evaluate((k) => window.__du.game.scene.isActive(window.__du.SCENE[k]), key);
const paused = (page, key) => page.evaluate((k) => window.__du.game.scene.isPaused(window.__du.SCENE[k]), key);
const waitFor = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

/** Wait until a button is interactive (scene clocks run slow under software WebGL). */
const ready = (page, sceneKey, label) => waitFor(page, ([k, text]) => {
    const scene = window.__du.game.scene.getScene(window.__du.SCENE[k]);
    return scene.children.list.some((o) => o.text === text && o.input && o.input.enabled);
}, [sceneKey, label], 20000);

/** Click or tap a Phaser text object by its label, mapping game → screen coordinates. */
async function press(page, sceneKey, label, touch) {
    const pt = await page.evaluate(([k, text]) => {
        const scene = window.__du.game.scene.getScene(window.__du.SCENE[k]);
        const obj = scene.children.list.find((o) => o.text === text);
        if (!obj) return null;
        const c = window.__du.game.canvas.getBoundingClientRect();
        const s = c.width / window.__du.game.config.width;
        return { x: c.left + obj.x * s, y: c.top + obj.y * s };
    }, [sceneKey, label]);
    if (!pt) return false;
    if (touch) await page.touchscreen.tap(pt.x, pt.y);
    else await page.mouse.click(pt.x, pt.y);
    return true;
}

/** Put ore in the hold and arrive at base, as the winch would. */
async function arriveWith(page, blockName) {
    await page.evaluate(async (name) => {
        const { BLOCK, ORE_DEFS } = await import('/game-022/js/data/ores.js');
        const { GameState, game, SCENE } = window.__du;
        GameState.addToCargoHold(BLOCK[name], ORE_DEFS[BLOCK[name]]);
        game.scene.getScene(SCENE.GAME)._onAtBase();
    }, blockName);
}

for (const [name, opts] of [
    ['desktop', { viewport: { width: 1280, height: 760 } }],
    ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
]) {
    console.log(name);
    const touch = name === 'phone';
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`${name} requestfailed: ${r.url()}`));
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitFor(page, () => window.__du && window.__du.game.scene.isActive('SplashScene'));

    await ready(page, 'SPLASH', '[ BEGIN MISSION ]');
    check(await press(page, 'SPLASH', '[ BEGIN MISSION ]', touch), `${name}: BEGIN MISSION button`);
    check(await waitFor(page, () => window.__du.game.scene.isActive('GameScene')), `${name}: the mission starts`);
    await sleep(500);

    // An ordinary haul: sold, no ending
    await arriveWith(page, 'COAL');
    check(await waitFor(page, () => window.__du.game.scene.isActive('BaseScene')), `${name}: arriving opens the base`);
    await sleep(300);
    check(!(await active(page, 'ENDING')), `${name}: coal does not end the game`);
    check(await page.evaluate(() => window.__du.GameState.cargo.slots.length === 0), `${name}: cargo sold`);
    await press(page, 'BASE', '[ DEPLOY ]', touch);
    check(await waitFor(page, () => !window.__du.game.scene.isActive('BaseScene') && !window.__du.game.scene.isPaused('GameScene')), `${name}: deploy returns to the mine`);

    // The Singing Vein
    await arriveWith(page, 'SINGING_VEIN');
    check(await waitFor(page, () => window.__du.game.scene.isActive('EndingScene')), `${name}: the Singing Vein plays the ending`);
    check(await paused(page, 'BASE'), `${name}: the base waits, paused, underneath`);
    check(await page.evaluate(() => window.__du.GameState.stats.missionComplete), `${name}: mission recorded`);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('depths_unknown_save')).stats.missionComplete), `${name}: and saved`);
    await press(page, 'ENDING', '[ KEEP MINING ]', touch);
    await sleep(200);
    check(await active(page, 'ENDING'), `${name}: buttons ignore taps until the epilogue has played`);
    check(await ready(page, 'ENDING', '[ KEEP MINING ]'), `${name}: the ending's buttons become active`);
    await page.screenshot({ path: path.join(OUT, `${name}-ending.png`) });
    check(await press(page, 'ENDING', '[ KEEP MINING ]', touch), `${name}: KEEP MINING button`);
    check(await waitFor(page, () => !window.__du.game.scene.isActive('EndingScene') && window.__du.game.scene.isActive('BaseScene') && !window.__du.game.scene.isPaused('BaseScene')), `${name}: KEEP MINING returns to the base`);
    await press(page, 'BASE', '[ DEPLOY ]', touch);
    check(await waitFor(page, () => !window.__du.game.scene.isPaused('GameScene')), `${name}: and on into the mine`);

    // A second vein is just ore
    await arriveWith(page, 'SINGING_VEIN');
    await waitFor(page, () => window.__du.game.scene.isActive('BaseScene'));
    await sleep(300);
    check(!(await active(page, 'ENDING')), `${name}: a second vein does not replay the ending`);

    // Title after a reload
    await page.reload();
    await waitFor(page, () => window.__du && window.__du.game.scene.isActive('SplashScene'));
    await sleep(300);
    const shown = await page.evaluate(() => window.__du.game.scene.getScene('SplashScene').children.list.some((o) => typeof o.text === 'string' && o.text.includes('MISSION COMPLETE')));
    check(shown, `${name}: the title shows MISSION COMPLETE`);
    await page.screenshot({ path: path.join(OUT, `${name}-title-after.png`) });

    // NEW GAME from the ending
    await page.evaluate(() => { window.__du.GameState.stats.missionComplete = false; window.__du.GameState.save(); });
    await ready(page, 'SPLASH', '[ CONTINUE ]');
    await press(page, 'SPLASH', '[ CONTINUE ]', touch);
    await waitFor(page, () => window.__du.game.scene.isActive('GameScene'));
    await sleep(300);
    await arriveWith(page, 'SINGING_VEIN');
    await waitFor(page, () => window.__du.game.scene.isActive('EndingScene'));
    await ready(page, 'ENDING', '[ NEW GAME ]');
    const seed = await page.evaluate(() => window.__du.GameState.worldSeed);
    check(await press(page, 'ENDING', '[ NEW GAME ]', touch), `${name}: NEW GAME button`);
    check(await waitFor(page, () => ['EndingScene', 'BaseScene', 'UIScene'].every((k) => !window.__du.game.scene.isActive(k))), `${name}: NEW GAME closes the old scenes`);
    check(await page.evaluate((s) => !window.__du.GameState.stats.missionComplete && window.__du.GameState.worldSeed !== s, seed), `${name}: NEW GAME starts a fresh world`);
    check(await waitFor(page, () => window.__du.game.scene.isActive('SplashScene')), `${name}: and returns to the title once the world is generated`);
    await ctx.close();
}

await browser.close();
for (const e of [...new Set(errors)]) { failures++; console.log(`  FAIL ${e}`); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
