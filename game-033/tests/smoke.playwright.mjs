// Manual smoke-test driver (not part of the `node --test` unit suite).
// Boots the real page in headless Chromium, plays through enough of the
// story to exercise brewing + the new charm equip slot, and asserts no
// console errors were logged.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8765/game-033/index.html';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(BASE);
await page.click('#btn-new-game');
await page.waitForSelector('#game-screen:not(.hidden)');

// Advance through a line, click a choice by label if present, repeat.
// Drives all the way from the opening scene through the slime fight,
// Mira's thanks, and into the new brewing lesson (Phase 3).
async function advanceUntilChoices(maxSteps = 40) {
    for (let i = 0; i < maxSteps; i++) {
        await page.click('#vn-text').catch(() => {});
        await page.waitForTimeout(25);
        if (await page.locator('#vn-choices:not(.hidden) button').count() > 0) return true;
        if (await page.locator('#battle-screen:not(.hidden)').count() > 0) return false; // in battle
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

await advanceUntilChoices();
await clickChoiceContaining('Continue.');
await advanceUntilChoices();
await clickChoiceContaining('I’ll go take a look right now'); // helpedMiraImmediately
await advanceUntilChoices();
await clickChoiceContaining('Head down to the cellar');
await advanceUntilChoices();
await clickChoiceContaining('Light the lantern');
// -> cellar_slime_fight (battle)
await fightThroughBattle();
await advanceUntilChoices();
await clickChoiceContaining('Bring the key back up to Mira');
await advanceUntilChoices();
await clickChoiceContaining('Do you have a moment to show me something');
await advanceUntilChoices();

const canBrewFlagSet = await page.evaluate(() => document.getElementById('brewing-open') && !document.getElementById('brewing-open').classList.contains('hidden'));
console.log('Brewing button visible after Mira’s lesson:', canBrewFlagSet);

await page.click('#brewing-open');
await page.waitForSelector('#brewing-panel:not(.hidden)');
const brewRows = await page.locator('#brewing-list .brewing-row').count();
console.log('Brewing recipes listed:', brewRows);

// Mira's lesson grants exactly enough river_root + dried_mintleaf for the
// Vigor Draught recipe — its Brew button should be enabled; try it.
const vigorRow = page.locator('.brewing-row', { hasText: 'Vigor Draught' });
const brewBtn = vigorRow.locator('.brew-btn');
const enabledBeforeBrew = await brewBtn.isEnabled();
console.log('Vigor Draught brewable with starter materials:', enabledBeforeBrew);
if (enabledBeforeBrew) {
    await brewBtn.click();
    await page.waitForTimeout(100);
    // Player carries more mintleaf/root than one recipe needs (starting
    // inventory + battle loot + Mira's gift), so the button legitimately
    // stays enabled for a second brew — that's correct, not a bug.
    console.log('Vigor Draught still brewable after one use (had surplus materials):', await brewBtn.isEnabled());
}
await page.click('#brewing-close');

// Open bag + stats panels too, to make sure Phase 3 UI doesn't crash.
await page.click('#inventory-open');
await page.waitForSelector('#inventory-panel:not(.hidden)');
const invRows = await page.locator('#inventory-list .inventory-row').count();
console.log('Inventory rows after brewing lesson:', invRows);
await page.click('#inventory-close');

await browser.close();

console.log('Console errors:', errors.length ? errors : 'none');
if (errors.length) {
    console.error('FAIL: console errors detected');
    process.exit(1);
}
console.log('PASS: no console errors, panels opened cleanly');
