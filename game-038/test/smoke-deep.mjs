// Deep browser test: drives the parts of the game a short smoke run cannot
// reach in a reasonable time - the Broodwell, shops, the forge, a boss fight
// and an ending - by seeding state through the game's own API, then using
// the real UI for everything after that.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const SHOTS = process.env.SHOTS || '/tmp/shots';
const URL = process.env.URL || 'http://127.0.0.1:8765/game-038/index.html';

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

const step = async (name, fn) => {
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); errors.push(name + ': ' + e.message); }
};
const dismiss = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.$('.overlay-inner'))) return;
    const btn = await page.$('.overlay-inner button:not([disabled])');
    if (!btn) return;
    await btn.click();
    await page.waitForTimeout(200);
  }
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await step('seed a mid-game save', async () => {
  await page.fill('.seed-row input', 'deep-test');
  await page.click('button:has-text("New game")');
  await page.waitForTimeout(400);
  await dismiss();
  // Load the modules directly and build a party that can do everything.
  const out = await page.evaluate(async () => {
    const [{ state, addDragon, addItem, addCoin, setAct, visit }, rand, dragon] = await Promise.all([
      import('./js/game/state.js'), import('./js/core/rand.js'), import('./js/gen/dragon.js'),
    ]);
    const rng = rand.rngFrom('deep-test', 'seedparty');
    const roles = ['kindler', 'clutcher'];
    for (let i = 0; i < 4; i++) {
      const d = dragon.makeDragon(rng, {
        lineageId: ['emberwyrm', 'tidechorus', 'stonefather', 'skyward'][i],
        level: 30, bond: 70, broodRole: roles[i % 2], generation: 1,
      });
      addDragon(d, { toParty: i < 3 });
    }
    addCoin(9000);
    for (const [id, n] of Object.entries({
      greater_salve: 9, wardens_salve: 5, sigil_snare: 6, clearwater: 4, warmth_stone: 3,
      scale_shard: 12, sinew: 8, cinder_glass: 6, ley_crystal: 6, dragonbone: 4, ashsalt: 8,
      memory_stone: 1, brood_ledger: 1, ember_root: 2, phoenix_cinder: 2, cinder_flask: 3,
    })) addItem(id, n);
    setAct(2);
    return { roster: state.roster.length, coin: state.coin };
  });
  if (out.roster < 5) throw new Error('roster is ' + out.roster);
});

await step('Broodwell pairs two dragons', async () => {
  // Read the roster and pick a legal pair by name, then drive the real UI.
  const pair = await page.evaluate(() => {
    const r = window.EMBERBROOD.state.roster.filter(d => d.level >= 10 && d.bond >= 30);
    const k = r.find(d => d.broodRole === 'kindler');
    const c = r.find(d => d.broodRole === 'clutcher');
    return k && c ? [k.name, c.name] : null;
  });
  if (!pair) throw new Error('seeded roster has no legal pair');

  await page.evaluate(() => window.EMBERBROOD.show('broodwell'));
  await page.waitForTimeout(350);

  for (let i = 0; i < 2; i++) {
    await page.locator('.pair-slot').nth(i).click();
    await page.waitForTimeout(250);
    await page.locator(`.overlay-inner button:has-text("${pair[i]}")`).first().click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${SHOTS}/20-broodwell.png` });

  await page.locator('#screen button:has-text("Pair them")').click();
  await page.waitForTimeout(350);
  const confirm = page.locator('.overlay-inner button:has-text("Pair them")');
  if (await confirm.count()) { await confirm.first().click(); await page.waitForTimeout(400); }
  await dismiss();
  const eggs = await page.evaluate(() => window.EMBERBROOD.state.eggs.length);
  if (eggs !== 1) throw new Error('eggs: ' + eggs);
});

await step('an egg hatches after enough battles', async () => {
  await page.evaluate(async () => {
    const { state } = await import('./js/game/state.js');
    state.eggs[0].battlesLeft = 0;
    window.EMBERBROOD.show('brood');
  });
  await page.waitForTimeout(350);
  await page.locator('button:has-text("Hatch")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/20b-hatch.png` });
  await dismiss();
  const gen2 = await page.evaluate(() => window.EMBERBROOD.state.roster.some(d => (d.generation || 0) >= 2));
  if (!gen2) throw new Error('no second-generation dragon after hatching');
});

await step('shop buys and sells', async () => {
  await page.evaluate(() => { window.EMBERBROOD.state.node = 'hollowbridge'; window.EMBERBROOD.show('shop'); });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/21-shop.png` });
  const before = await page.evaluate(() => window.EMBERBROOD.state.coin);
  await page.locator('#screen button:has-text("Ember Salve")').first().click();
  await page.waitForTimeout(280);
  await page.locator('.overlay-inner button:has-text("Buy")').click();
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => window.EMBERBROOD.state.coin);
  if (after >= before) throw new Error('coin did not drop: ' + before + ' -> ' + after);
});

await step('forge makes a relic', async () => {
  await page.evaluate(() => { window.EMBERBROOD.state.node = 'cindermarch'; window.EMBERBROOD.show('forge'); });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/22-forge.png` });
  const makeable = page.locator('#screen button:not([disabled]):has-text("Make")');
  if (!(await makeable.count())) throw new Error('nothing forgeable with those parts');
  const relicsBefore = await page.evaluate(() => Object.keys(window.EMBERBROOD.state.inventory).length);
  await makeable.first().click();
  await page.waitForTimeout(350);
  const relicsAfter = await page.evaluate(() => Object.keys(window.EMBERBROOD.state.inventory).length);
  if (relicsAfter < relicsBefore) throw new Error('forge consumed parts without producing anything');
});

await step('a relic can be fitted', async () => {
  await page.evaluate(() => {
    const s = window.EMBERBROOD.state;
    window.EMBERBROOD.show('dragon', { id: s.party[0] });
  });
  await page.waitForTimeout(350);
  const equipBtn = page.locator('#screen button:has-text("Equip")');
  if (await equipBtn.count()) {
    await equipBtn.first().click();
    await page.waitForTimeout(280);
    const pick = page.locator('.overlay-inner button.btn').first();
    if (await pick.count()) { await pick.click(); await page.waitForTimeout(350); }
  }
  const equipped = await page.evaluate(() => {
    const s = window.EMBERBROOD.state;
    const d = s.roster.find(x => x.id === s.party[0]);
    return !!(d.equip.harness || d.equip.relic);
  });
  if (!equipped) throw new Error('nothing got equipped');
  await page.screenshot({ path: `${SHOTS}/23-dragon-geared.png` });
});

await step('a boss fight runs to a result', async () => {
  await page.evaluate(async () => {
    const adv = await import('./js/game/adventure.js');
    const { state } = await import('./js/game/state.js');
    state.node = 'cinder_roost';
    const r = adv.startBossBattle('cinderfang');
    window.EMBERBROOD.show('battle', { existing: r.battle, onDone: () => window.EMBERBROOD.show('place') });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/24-boss.png` });
  for (let i = 0; i < 40; i++) {
    const end = await page.$('button:has-text("carry on")');
    if (end) { await end.click(); await page.waitForTimeout(500); break; }
    const go = await page.$('button:has-text("Go")');
    if (go) { await go.click(); await page.waitForTimeout(2200); continue; }
    const strike = await page.$('button:has-text("Skills")');
    if (strike) {
      await strike.click(); await page.waitForTimeout(250);
      const usable = page.locator('.move-pick button:not([disabled])');
      if (await usable.count()) await usable.first().click();
      else {
        await page.locator('.overlay-inner button:has-text("Back")').click();
        await page.waitForTimeout(200);
        await page.locator('button:has-text("Strike")').click();
        await page.waitForTimeout(250);
        const basic = page.locator('.move-pick button:not([disabled])');
        if (await basic.count()) await basic.first().click();
      }
      await page.waitForTimeout(250);
      const hint = (await page.textContent('#hint')) || '';
      if (hint.includes('Tap an enemy')) { await page.click('.enemy'); await page.waitForTimeout(200); }
      continue;
    }
    await page.waitForTimeout(400);
  }
  await dismiss();
  const beaten = await page.evaluate(() => !!(window.EMBERBROOD.state.quests.counters
    && window.EMBERBROOD.state.quests.counters.bosses
    && window.EMBERBROOD.state.quests.counters.bosses.cinderfang));
  if (!beaten) throw new Error('boss never resolved');
  await page.screenshot({ path: `${SHOTS}/25-boss-done.png` });
});

await step('the ending choice offers all three and takes one', async () => {
  const state = await page.evaluate(async () => {
    const scenes = await import('./js/game/scenes.js');
    scenes.requestScene('ending_choice', { replay: true });
    return true;
  });
  await page.waitForTimeout(500);
  // The choice only appears once the scene's lines have been read.
  for (let i = 0; i < 8; i++) {
    const next = page.locator('.scene-nav button.primary');
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(220);
  }
  await page.screenshot({ path: `${SHOTS}/26-ending-choice.png` });
  const choices = await page.$$('.choice-list .btn');
  if (choices.length !== 3) throw new Error('choices: ' + choices.length);
  const disabled = await page.$$('.choice-list .btn[disabled]');
  if (disabled.length === 0) throw new Error('locked endings should be visibly locked');
  await choices[0].click();                            // Unbind is always open
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/27-ending.png` });
  const ending = await page.evaluate(() => window.EMBERBROOD.state.ending);
  if (ending !== 'ending_unbind') throw new Error('ending is ' + ending);
});

await step('the game is usable on a small phone', async () => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.EMBERBROOD.show('brood'));
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error('horizontal overflow of ' + overflow + 'px');
  await page.screenshot({ path: `${SHOTS}/28-small-phone.png` });
});

await step('the game is usable on a desktop window', async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => window.EMBERBROOD.show('place'));
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error('horizontal overflow of ' + overflow + 'px');
  await page.screenshot({ path: `${SHOTS}/29-desktop.png` });
});

await browser.close();
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nno console errors');
process.exit(errors.length ? 1 : 0);
