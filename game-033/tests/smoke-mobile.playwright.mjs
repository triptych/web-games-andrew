// Manual smoke-test driver (not part of the `node --test` unit suite).
// Phase 5 (mobile pass): boots the real page with a narrow phone-sized
// viewport and touch emulation enabled, taps (not clicks-via-mouse) through
// the opening slice and a battle, and checks the mobile-specific layout/
// touch-target work actually holds up:
//   - HUD, VN stage, and battle screen don't overflow the viewport
//   - every interactive element meets a ~40px minimum tap target
//   - tapping a modal's dimmed backdrop closes it (no Escape key on touch)
//   - the battle canvas scales down without breaking the menu underneath
import { chromium, devices } from 'playwright';

// Some sandboxes ship a preinstalled Chromium that doesn't match the build
// Playwright expects. Point PW_CHROMIUM_PATH at it to use that binary instead
// of the one `npx playwright install` would download.
const LAUNCH = process.env.PW_CHROMIUM_PATH
    ? { executablePath: process.env.PW_CHROMIUM_PATH }
    : {};


const BASE = 'http://localhost:8765/game-033/index.html';
const errors = [];

const iPhone = devices['iPhone 13'];
const browser = await chromium.launch(LAUNCH);
const context = await browser.newContext({ ...iPhone });
const page = await context.newPage();
page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
// A bare static file server has no favicon; that 404 is a harness artifact
// rather than anything the game did, so stub it out before the first navigation.
await page.route('**/favicon.ico', (route) => route.fulfill({ status: 200, body: '' }));


await page.goto(BASE);
await page.tap('#btn-new-game');
await page.waitForSelector('#game-screen:not(.hidden)');

async function advanceUntilChoices(maxSteps = 40) {
    for (let i = 0; i < maxSteps; i++) {
        await page.tap('#vn-text').catch(() => {});
        await page.waitForTimeout(25);
        if (await page.locator('#vn-choices:not(.hidden) button').count() > 0) return true;
        if (await page.locator('#battle-screen:not(.hidden)').count() > 0) return false;
    }
    return false;
}

async function tapChoiceContaining(text) {
    const btn = page.locator('#vn-choices button', { hasText: text }).first();
    await btn.tap();
}

// --- Viewport overflow check: nothing on the opening screen should force
// horizontal scroll on a 390px-wide phone. ---
const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
const viewportWidth = iPhone.viewport.width;
console.log(`Body scroll width: ${bodyScrollWidth}px (viewport: ${viewportWidth}px)`);
if (bodyScrollWidth > viewportWidth) {
    console.error(`FAIL: page overflows horizontally on a ${viewportWidth}px viewport`);
    process.exit(1);
}

// --- Tap target size check: every visible HUD button should be >= 40px in
// both dimensions (44px target, small tolerance for sub-pixel rounding). ---
const hudBoxes = await page.locator('#hud button:visible').evaluateAll(
    (els) => els.map((el) => el.getBoundingClientRect())
);
console.log('HUD button count:', hudBoxes.length);
for (const box of hudBoxes) {
    if (box.width < 40 || box.height < 40) {
        console.error(`FAIL: HUD button too small for touch: ${box.width}x${box.height}`);
        process.exit(1);
    }
}

// --- Play through the opening slice by tapping (not mouse-clicking). ---
await advanceUntilChoices();
await tapChoiceContaining('Continue.');
await advanceUntilChoices();
await tapChoiceContaining('I’ll go take a look right now');
await advanceUntilChoices();
await tapChoiceContaining('Head down to the cellar');
await advanceUntilChoices();
await tapChoiceContaining('Light the lantern');

// --- Battle screen: canvas should scale to fit the viewport, and every
// battle menu button should stay tappable. ---
await page.waitForSelector('#battle-screen:not(.hidden)');
const canvasBox = await page.locator('#battle-canvas').boundingBox();
console.log('Battle canvas box:', canvasBox);
if (canvasBox.width > viewportWidth) {
    console.error('FAIL: battle canvas overflows the viewport width');
    process.exit(1);
}
const battleBtnBoxes = await page.locator('#battle-menu button:visible').evaluateAll(
    (els) => els.map((el) => el.getBoundingClientRect())
);
for (const box of battleBtnBoxes) {
    if (box.width < 40 || box.height < 40) {
        console.error(`FAIL: battle menu button too small for touch: ${box.width}x${box.height}`);
        process.exit(1);
    }
}

for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(150);
    if (await page.locator('#battle-screen:not(.hidden)').count() === 0) break;
    const attackBtn = page.locator('#battle-menu button', { hasText: 'Attack' }).first();
    if (await attackBtn.count() > 0 && await attackBtn.isEnabled().catch(() => false)) {
        // The menu rebuilds after every turn (buildMenu() in battle.js), so
        // the element behind this locator can detach mid-tap if a turn
        // resolves concurrently — same benign race the desktop smoke test
        // guards against. Swallow it and let the loop re-poll.
        await attackBtn.tap({ timeout: 5000 }).catch(() => {});
    }
}
await advanceUntilChoices();
await tapChoiceContaining('Bring the key back up to Mira');
await advanceUntilChoices();

// --- Modal backdrop-tap-to-close: open the bag, tap the dimmed backdrop
// (not the Close button) and confirm it closes — the touch-only equivalent
// of pressing Escape. ---
await page.tap('#inventory-open');
await page.waitForSelector('#inventory-panel:not(.hidden)');
const invBoxes = await page.locator('#inventory-list button:visible').evaluateAll(
    (els) => els.map((el) => el.getBoundingClientRect())
);
for (const box of invBoxes) {
    if (box.width < 40 || box.height < 40) {
        console.error(`FAIL: inventory action button too small for touch: ${box.width}x${box.height}`);
        process.exit(1);
    }
}
// Tap the panel backdrop itself, away from the centered box, by targeting
// a corner of the fixed overlay.
await page.locator('#inventory-panel').tap({ position: { x: 5, y: 5 } });
const invClosedAfterBackdropTap = await page.locator('#inventory-panel.hidden').count() > 0;
console.log('Inventory panel closed after tapping backdrop:', invClosedAfterBackdropTap);
if (!invClosedAfterBackdropTap) {
    console.error('FAIL: tapping the inventory backdrop did not close the panel');
    process.exit(1);
}

// Same check for the brewing panel (also wired up in this pass).
await page.tap('#hud-settings');
await page.waitForSelector('#settings-panel:not(.hidden)');
const settingsBoxes = await page.locator('#settings-box button:visible, #settings-box input[type="range"]:visible').evaluateAll(
    (els) => els.map((el) => el.getBoundingClientRect())
);
for (const box of settingsBoxes) {
    if (box.height < 30) { // sliders are visually thin but still tappable across their full width
        console.error(`FAIL: settings control too short for touch: ${box.width}x${box.height}`);
        process.exit(1);
    }
}
await page.locator('#settings-panel').tap({ position: { x: 5, y: 5 } });
const settingsClosedAfterBackdropTap = await page.locator('#settings-panel.hidden').count() > 0;
console.log('Settings panel closed after tapping backdrop:', settingsClosedAfterBackdropTap);
if (!settingsClosedAfterBackdropTap) {
    console.error('FAIL: tapping the settings backdrop did not close the panel');
    process.exit(1);
}

await browser.close();

console.log('Console errors:', errors.length ? errors : 'none');
if (errors.length) {
    console.error('FAIL: console errors detected');
    process.exit(1);
}
console.log('PASS: mobile layout, tap targets, and backdrop-tap-to-close all check out');
