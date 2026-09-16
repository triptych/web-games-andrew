// Manual smoke-test driver (not part of the `node --test` unit suite).
// Phase 6 (the long season): drives the real page through the new
// systems end to end — the aunt's workroom and the journal it unlocks,
// the shop counter's brew-to-order loop, coin and the day counter,
// sleeping, and Peddler Ock's cart — and asserts no console errors.
//
//   python3 -m http.server 8765 &          # from the repo root
//   node game-033/tests/smoke-season.playwright.mjs
import { chromium } from 'playwright';

// Some sandboxes ship a preinstalled Chromium that doesn't match the build
// Playwright expects. Point PW_CHROMIUM_PATH at it to use that binary instead
// of the one `npx playwright install` would download.
const LAUNCH = process.env.PW_CHROMIUM_PATH
    ? { executablePath: process.env.PW_CHROMIUM_PATH }
    : {};

const BASE = 'http://localhost:8765/game-033/index.html';
const errors = [];
const failures = [];

function check(label, condition) {
    console.log(`${condition ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!condition) failures.push(label);
}

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
// A bare static file server has no favicon; that 404 is a harness artifact
// rather than anything the game did, so stub it out before the first navigation.
await page.route('**/favicon.ico', (route) => route.fulfill({ status: 200, body: '' }));

/** Click the visible choice whose label contains `needle`, then settle. */
async function choose(needle) {
    const btn = page.locator('.vn-choice-btn', { hasText: needle }).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(120);
}

/** Skip the typewriter and wait for this node's choices to appear. */
async function toChoices() {
    for (let i = 0; i < 40; i++) {
        if (await page.locator('#vn-choices .vn-choice-btn').first().isVisible().catch(() => false)) return;
        await page.click('#vn-text');
        await page.waitForTimeout(60);
    }
    throw new Error('choices never appeared');
}

async function step(needle) { await toChoices(); await choose(needle); }

await page.goto(BASE);
await page.click('#btn-new-game');
await page.waitForSelector('#game-screen:not(.hidden)');

// --- the HUD gained a day counter and a purse ---
check('HUD shows the day', (await page.textContent('#hud-day')).trim() === 'Day 1');
check('HUD shows coin', /^\d+c$/.test((await page.textContent('#hud-coin')).trim()));
check('journal button hidden before the journal is found', await page.isHidden('#journal-open'));
check('trade button hidden away from the cart', await page.isHidden('#trade-open'));

// --- opening slice: cellar, slime, brewing lesson ---
await step('Continue');
await step('take a look right now');
await step('Head down to the cellar');
await step('Light the lantern');

// Battle: attack until it resolves back to the story.
await page.waitForSelector('#battle-screen:not(.hidden)');
for (let i = 0; i < 40; i++) {
    if (await page.isHidden('#battle-screen')) break;
    const attack = page.locator('.battle-menu-btn', { hasText: 'Attack' }).first();
    if (await attack.isVisible().catch(() => false)) await attack.click();
    await page.waitForTimeout(180);
}
check('battle resolved back to the story', await page.isHidden('#battle-screen'));

await step('Bring the key back up');
await step('Do you have a moment');

// --- the workroom: the payoff for the Cellar Key ---
await step('locked door at the back');
await step('Come down with me');
await step('Push it open');
await step('workbench');
check('journal button appears once the journal is found', await page.isVisible('#journal-open'));

// --- the journal panel ---
await page.click('#journal-open');
await page.waitForSelector('#journal-panel:not(.hidden)');
const journalText = await page.textContent('#journal-list');
check('journal lists an open quest', journalText.includes('Asked of You'));
check('journal shows a settled quest', journalText.includes('Settled'));
check('journal collected a lore entry', journalText.includes('Wisteria, First Entry'));
await page.keyboard.press('Escape');
check('journal closes on Escape', await page.isHidden('#journal-panel'));

await step('Keep looking');
await step('jar labels');
await step('Keep looking');
await step('Go back up to the shop');
await step('No. I don’t think it was');
await step('Back up to the shop');

// --- the counter: a customer wants something you have to brew ---
await step('Take the counter');
await step('boy is hovering');
await step('I can make the green stuff');
await step('keep an eye out');
await step('Leave the counter');

// --- brewing panel: the salve recipe was taught by the journal ---
await page.click('#brewing-open');
await page.waitForSelector('#brewing-panel:not(.hidden)');
const recipeNames = await page.locator('.brew-name').allTextContents();
check('the journal taught the Burn Salve recipe', recipeNames.includes('Burn Salve'));
check('untaught recipes stay off the list', !recipeNames.includes('Hearthbound Tea'));
const salveRow = page.locator('.brewing-row', { hasText: 'Burn Salve' });
await salveRow.locator('.brew-btn').click();
await page.waitForTimeout(150);
await page.click('#brewing-close');

const coinBefore = parseInt((await page.textContent('#hud-coin')).trim(), 10);
await step('Take the counter');
await step('Hand over the burn salve');
await step('Back to the counter');
const coinAfter = parseInt((await page.textContent('#hud-coin')).trim(), 10);
check('delivering a brewed order pays coin', coinAfter > coinBefore);

// --- sleeping advances the day ---
await step('Leave the counter');
await step('Bank the stove and sleep');
check('sleeping advanced the day', (await page.textContent('#hud-day')).trim() === 'Day 2');
await step('Get up');
await step('Get on with it');

// --- Peddler Ock's cart: the trade panel ---
await step('Out to the square');
await step('peddler’s cart');
check('trade button appears at the cart', await page.isVisible('#trade-open'));
await page.click('#trade-open');
await page.waitForSelector('#trade-panel:not(.hidden)');
const beforeBuy = parseInt((await page.textContent('#hud-coin')).trim(), 10);
const mintRow = page.locator('.trade-row', { hasText: 'Dried Mintleaf' }).first();
await mintRow.locator('.trade-btn').click();
await page.waitForTimeout(150);
const afterBuy = parseInt((await page.textContent('#hud-coin')).trim(), 10);
check('buying from the cart spends coin', afterBuy < beforeBuy);
await page.click('#trade-tab-sell');
await page.waitForTimeout(120);
const sellRows = await page.locator('#trade-list .trade-row').count();
check('the sell tab lists something sellable', sellRows > 0);
if (sellRows > 0) await page.locator('#trade-list .trade-btn').first().click();
await page.waitForTimeout(150);
check('selling pays coin back', parseInt((await page.textContent('#hud-coin')).trim(), 10) > afterBuy);
await page.click('#trade-close');

// --- walking away from the cart closes the cart ---
await step('Back to the square');
check('trade button hidden again away from the cart', await page.isHidden('#trade-open'));

console.log('\nConsole errors:', errors.length ? errors : 'none');
if (errors.length || failures.length) {
    console.error(`FAIL: ${failures.length} assertion(s), ${errors.length} console error(s)`);
    await browser.close();
    process.exit(1);
}
console.log('PASS: workroom, journal, counter orders, brewing, days and trading all check out');
await browser.close();
