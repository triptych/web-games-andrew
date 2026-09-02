// Manual smoke-test driver (not part of the `node --test` unit suite).
// Drives the "called the watch" branch all the way to its distinct ending
// (Phase 4) and asserts the ending screen shows the right text with no
// console errors — a real-browser check that the new ending nodes actually
// render, since the unit tests only check the story graph's shape.
import { chromium } from 'playwright';

// Some sandboxes ship a preinstalled Chromium that doesn't match the build
// Playwright expects. Point PW_CHROMIUM_PATH at it to use that binary instead
// of the one `npx playwright install` would download.
const LAUNCH = process.env.PW_CHROMIUM_PATH
    ? { executablePath: process.env.PW_CHROMIUM_PATH }
    : {};


const BASE = 'http://localhost:8765/game-033/index.html';
const errors = [];

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
// A bare static file server has no favicon; that 404 is a harness artifact
// rather than anything the game did, so stub it out before the first navigation.
await page.route('**/favicon.ico', (route) => route.fulfill({ status: 200, body: '' }));


await page.goto(BASE, { waitUntil: 'networkidle' });
await page.click('#btn-new-game');
await page.waitForSelector('#game-screen:not(.hidden)');

// Set text speed to Instant via localStorage before the first click so the
// whole run is fast and deterministic (avoids racing the typewriter).
await page.evaluate(() => {
    localStorage.setItem('hearthbound-settings-v1', JSON.stringify({ textSpeedMsPerChar: 0, volume: 0.25 }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.click('#btn-continue').catch(() => {});
// If Continue isn't available yet (no save saved), start fresh again —
// New Game always exists.
if (await page.locator('#game-screen:not(.hidden)').count() === 0) {
    await page.click('#btn-new-game');
}
await page.waitForSelector('#game-screen:not(.hidden)');

async function advanceUntilChoices(maxSteps = 40) {
    for (let i = 0; i < maxSteps; i++) {
        await page.click('#vn-text').catch(() => {});
        await page.waitForTimeout(15);
        if (await page.locator('#vn-choices:not(.hidden) button').count() > 0) return true;
        if (await page.locator('#battle-screen:not(.hidden)').count() > 0) return false;
        if (await page.locator('#ending-screen:not(.hidden)').count() > 0) return false;
    }
    return false;
}

async function clickChoiceContaining(text) {
    const btn = page.locator('#vn-choices button', { hasText: text }).first();
    await btn.click();
}

async function fightThroughBattle() {
    await page.waitForSelector('#battle-screen:not(.hidden)');
    for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(150);
        const stillInBattle = await page.locator('#battle-screen:not(.hidden)').count();
        if (!stillInBattle) return;
        const attackBtn = page.locator('#battle-menu button', { hasText: 'Attack' }).first();
        if (await attackBtn.count() > 0 && await attackBtn.isEnabled()) {
            await attackBtn.click();
        }
    }
}

// Opening slice, same as smoke.playwright.mjs, through Mira's cellar.
await advanceUntilChoices();
await clickChoiceContaining('Continue.');
await advanceUntilChoices();
await clickChoiceContaining('I’ll go take a look right now');
await advanceUntilChoices();
await clickChoiceContaining('Head down to the cellar');
await advanceUntilChoices();
await clickChoiceContaining('Light the lantern');
await fightThroughBattle();
await advanceUntilChoices();
await clickChoiceContaining('Bring the key back up to Mira');
await advanceUntilChoices();
await clickChoiceContaining('Step out for some air.'); // skip the brewing lesson branch
await advanceUntilChoices();

// Village square -> Bramwell -> the "safer" watch path (calledTheWatch).
await clickChoiceContaining('Go say hello to the baker');
await advanceUntilChoices();
await clickChoiceContaining('It’s good to finally meet you.');
await advanceUntilChoices();
await clickChoiceContaining('Sending for the watch sounds safest');
await advanceUntilChoices();
await clickChoiceContaining('Thank you, Bramwell.');
await advanceUntilChoices();
await clickChoiceContaining('Return to the square');
await advanceUntilChoices();
await clickChoiceContaining('Head toward the Whisperwood anyway.');
await advanceUntilChoices();

// Hollow finds out the watch was called -> cold ending.
await clickChoiceContaining('Follow the smoke to Hollow');
await advanceUntilChoices();
await clickChoiceContaining('I didn’t know there was a');
await advanceUntilChoices();
await clickChoiceContaining('Leave quietly');

// This should land on ending_cold with no further choices.
for (let i = 0; i < 20; i++) {
    await page.click('#vn-text').catch(() => {});
    await page.waitForTimeout(50);
    if (await page.locator('#ending-screen:not(.hidden)').count() > 0) break;
}

const onEndingScreen = await page.locator('#ending-screen:not(.hidden)').count() > 0;
console.log('Reached ending screen:', onEndingScreen);
if (!onEndingScreen) {
    console.error('FAIL: did not reach the ending screen via the "called the watch" path');
    process.exit(1);
}

const endingText = await page.textContent('#ending-text');
console.log('Ending text:', endingText.slice(0, 80) + '...');
if (!endingText.includes('safe thing over the right one')) {
    console.error('FAIL: ending text does not match the expected ending_cold content');
    process.exit(1);
}

await browser.close();

console.log('Console errors:', errors.length ? errors : 'none');
if (errors.length) {
    console.error('FAIL: console errors detected');
    process.exit(1);
}
console.log('PASS: reached the distinct "cold" ending with no console errors');
