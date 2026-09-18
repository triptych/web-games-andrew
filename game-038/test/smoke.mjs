// Browser smoke test: boot the game on a phone-sized viewport, start a new
// run, and walk the screens, failing on any console error.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const SHOTS = process.env.SHOTS || '/tmp/shots';
const URL = process.env.URL || 'http://127.0.0.1:8765/game-038/index.html';

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

/** Clear any open dialog before the next tap; the game stacks one at a time. */
const dismiss = async () => {
  for (let i = 0; i < 6; i++) {
    const inner = await page.$('.overlay-inner');
    if (!inner) return;
    const btn = await page.$('.overlay-inner button:not([disabled])');
    if (!btn) return;
    await btn.click();
    await page.waitForTimeout(220);
  }
};

const step = async (name, fn) => {
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); errors.push(name + ': ' + e.message); }
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/01-title.png` });

await step('title renders', async () => {
  const logo = await page.textContent('.logo');
  if (!logo.includes('EMBERBROOD')) throw new Error('no logo, got ' + logo);
  const sprites = await page.$$('.title-dragons canvas');
  if (sprites.length !== 4) throw new Error('title dragons: ' + sprites.length);
});

await step('new game starts', async () => {
  await page.fill('.seed-row input', 'smoke-test');
  await page.click('button:has-text("New game")');
  await page.waitForTimeout(500);
  const overlay = await page.$('.overlay-inner');
  if (!overlay) throw new Error('intro scene did not open');
});

await page.screenshot({ path: `${SHOTS}/02-intro.png` });

await step('scene advances to the end', async () => {
  for (let i = 0; i < 12; i++) {
    const btn = await page.$('.scene-nav button.primary');
    if (!btn) break;
    await btn.click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
});

await step('lands on a screen with the brood', async () => {
  // after the intro the first main quest completes; get to the place screen
  await page.evaluate(() => window.EMBERBROOD.show('place'));
  await page.waitForTimeout(300);
  const roster = await page.evaluate(() => window.EMBERBROOD.state.roster.length);
  if (roster !== 1) throw new Error('roster is ' + roster);
});
await page.screenshot({ path: `${SHOTS}/03-place.png` });

await step('map draws', async () => {
  await page.click('#btn-place');
  await page.waitForTimeout(400);
  const blank = await page.evaluate(() => {
    const c = document.getElementById('mapcanvas');
    if (!c) return 'no canvas';
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 40 || d[i + 1] > 40) lit++;
    return lit < 200 ? 'canvas looks blank (' + lit + ')' : null;
  });
  if (blank) throw new Error(blank);
});
await page.screenshot({ path: `${SHOTS}/04-map.png` });

await step('travel to the Low Fields', async () => {
  await page.click('text=The Low Fields');
  await page.waitForTimeout(400);
  const node = await page.evaluate(() => window.EMBERBROOD.state.node);
  if (node !== 'lowfields') throw new Error('node is ' + node);
});

await step('explore until a fight starts', async () => {
  for (let i = 0; i < 20; i++) {
    await dismiss();
    const explore = await page.$('button:has-text("Explore")');
    if (!explore) throw new Error('no Explore button on a wild node');
    await explore.click();
    await page.waitForTimeout(400);
    if (await page.$('.enemy-row .enemy')) return;
  }
  throw new Error('no battle in 20 explores');
});
await page.screenshot({ path: `${SHOTS}/05-battle.png` });

await step('fight a round', async () => {
  await dismiss();
  await page.click('button:has-text("Strike")');
  await page.waitForTimeout(250);
  const moveBtn = await page.$('.move-pick button:not([disabled])');
  if (!moveBtn) throw new Error('no strike option');
  await moveBtn.click();
  await page.waitForTimeout(250);
  // targeting: tap the first enemy if asked
  const hint = (await page.textContent('#hint')) || '';
  if (hint.includes('Tap an enemy')) {
    await page.click('.enemy');
    await page.waitForTimeout(250);
  }
  const go = await page.$('button:has-text("Go")');
  if (!go) throw new Error('no Go button after ordering');
  await go.click();
  await page.waitForTimeout(2500);
});
await page.screenshot({ path: `${SHOTS}/06-battle-round.png` });

/** Playback blocks input; wait it out rather than clicking into it. */
const settle = async () => {
  for (let i = 0; i < 60; i++) {
    const busy = await page.$('#commands button[disabled]');
    if (!busy) return;
    await page.waitForTimeout(400);
  }
};

await step('battle finishes', async () => {
  for (let i = 0; i < 40; i++) {
    await settle();
    const end = await page.$('button:has-text("carry on")');
    if (end) { await end.click(); await page.waitForTimeout(500); break; }
    const go = await page.$('button:has-text("Go")');
    if (go) { await go.click(); await page.waitForTimeout(500); continue; }
    const strike = await page.$('button:has-text("Strike")');
    if (strike) {
      await strike.click(); await page.waitForTimeout(200);
      const m = await page.$('.move-pick button:not([disabled])');
      if (m) await m.click();
      await page.waitForTimeout(200);
      const h2 = (await page.textContent('#hint')) || '';
      if (h2.includes('Tap an enemy')) { await page.click('.enemy'); await page.waitForTimeout(200); }
      continue;
    }
    await page.waitForTimeout(400);
  }
  // The after-battle panel says "Carry on" after a win and "Get up" after a
  // loss; either way it is the one button on it.
  await dismiss();
  await page.waitForTimeout(400);
  const stillFighting = await page.$('.enemy-row .enemy');
  if (stillFighting) throw new Error('the battle never resolved');
  const tabbarVisible = await page.evaluate(() => !document.getElementById('tabbar').hidden);
  if (!tabbarVisible) throw new Error('did not return to a normal screen after the fight');
});
await page.screenshot({ path: `${SHOTS}/07-after-battle.png` });

for (const [tab, shot] of [['brood', '08-brood'], ['items', '09-pack'], ['journal', '10-journal']]) {
  await step(`${tab} screen`, async () => {
    await dismiss();
    await page.click(`#tabbar button[data-tab="${tab}"]`);
    await page.waitForTimeout(350);
    const body = await page.textContent('#screen');
    if (!body || body.length < 30) throw new Error('screen looks empty');
    await page.screenshot({ path: `${SHOTS}/${shot}.png` });
  });
}

await step('dragon detail opens', async () => {
  await dismiss();
  await page.click('#tabbar button[data-tab="brood"]');
  await page.waitForTimeout(250);
  await page.click('.dragon-card');
  await page.waitForTimeout(350);
  const h = await page.textContent('h1');
  if (!h) throw new Error('no dragon page');
  await page.screenshot({ path: `${SHOTS}/11-dragon.png` });
});

await step('save survives a reload', async () => {
  const before = await page.evaluate(() => ({ seed: window.EMBERBROOD.state.seed, roster: window.EMBERBROOD.state.roster.length }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ seed: window.EMBERBROOD.state.seed }));
  if (!after.seed) throw new Error("state missing after reload");
});

await browser.close();
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nno console errors');
process.exit(errors.length ? 1 : 0);
