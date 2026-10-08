/**
 * browsertest.mjs — plays the real game in Chromium (SwiftShader) and fails on any page error.
 *
 *   python3 -m http.server 8071      (from the repo root)
 *   node game-071/dev/browsertest.mjs
 *
 * Desktop: boot → title → new game → character creation → the prologue road; walk, open every
 * menu (inventory, magic, skills, map, journal), quicksave and quickload, enter the keep, talk to
 * an NPC, fast travel, enter a dungeon, and step into the Eye of the Storm.
 * Phone (touch only, 390×844): boot, start, the touch deck is shown and drives the player.
 * Screenshots go to game-071/dev/shots/bt-*.png. Env: BASE (default http://127.0.0.1:8071).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8071';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function open(viewport, touch) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    if (PKG) await page.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const errs = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 300)}`); });
    await page.goto(`${BASE}/game-071/index.html?q=3`);
    await page.waitForFunction('window.__fm && window.__fm.mode === "title"', null, { timeout: 240000 });
    return { page, ctx, errs };
}
const F = (page, js) => page.evaluate(`(() => { const F = window.__fm; ${js} })()`);
const until = (page, expr, t = 60000) => page.waitForFunction(`(() => { const F = window.__fm; return ${expr}; })()`, null, { timeout: t, polling: 250 });
const shot = (page, n) => page.screenshot({ path: path.join(OUT, `bt-${n}.png`), timeout: 240000 });

// ------------------------------------------------------------------ desktop
console.log('desktop 1280×720');
{
    const { page, ctx, errs } = await open({ width: 1280, height: 720 }, false);
    ok(await F(page, 'return F.mode') === 'title', 'title screen');
    await shot(page, 'title');
    await F(page, "document.getElementById('t-new').click()");
    await until(page, "F.mode === 'chargen' && !!document.querySelector('.chargen')");
    ok(true, 'character creation');
    await F(page, "document.querySelectorAll('.chargen .chip')[1].click()");
    await shot(page, 'chargen');
    await F(page, "document.querySelector('.chargen .mbtn.gold').click()");
    await until(page, "F.mode === 'play'");
    ok(await F(page, "return F.world.quests.active('mq01') && F.world.player.inv.some((e) => e.id === 'sealed_letter')"), 'prologue begins with the letter');
    // walk forward a little
    await page.keyboard.down('KeyW');
    ok(await until(page, 'F.world.player.pos.z > 1177', 90000).then(() => true, () => false), 'walked toward the keep');
    await page.keyboard.up('KeyW');
    await shot(page, 'road');
    // every menu
    for (const [key, cls] of [['KeyI', 'inventory'], ['KeyP', 'magic'], ['KeyK', 'skills'], ['KeyM', 'map'], ['KeyJ', 'journal']]) {
        await page.keyboard.press(key);
        ok(await until(page, 'F.ui.open', 60000).then(() => true, () => false), `${cls} menu opens`);
        if (cls === 'journal') await shot(page, 'journal');
        await page.keyboard.press('Escape');
        await until(page, '!F.ui.open', 20000).catch(() => F(page, 'F.ui.closeAll()'));
    }
    // quicksave / quickload
    await page.keyboard.press('F5');
    ok(await until(page, "!!F.saves.load('quick')", 60000).then(() => true, () => false), 'quicksave written');
    await F(page, 'F.world.player.gold = 9999');
    await page.keyboard.press('F9');
    await until(page, 'F.world.player.gold !== 9999 && !F.loading');
    ok(true, 'quickload restores');
    // into the keep and talk to someone
    await F(page, "const w = F.world; w.flags.prologueDone = true; const d = w.settlements.doors.find((x) => x.to === 'hollowmere:keep'); w.emit('useDoor', { door: d });");
    await until(page, "F.world.cellId === 'hollowmere:keep'");
    await page.waitForTimeout(1500);
    await shot(page, 'keep');
    ok(true, 'entered the keep');
    await F(page, "const w = F.world; const a = w.pop.npc('ragna'); F.ui.show('talk', a);");
    ok(await until(page, "document.querySelectorAll('.dlg .opt').length >= 1", 30000).then(() => true, () => false), 'conversation shows options');
    await shot(page, 'talk');
    await F(page, 'F.ui.closeAll()');
    // fast travel to Brightwater
    await F(page, "const w = F.world; w.exitToExt(null); w.discovered.add('brightwater'); w.fastTravel('brightwater');");
    await page.waitForTimeout(3000);
    ok(await F(page, "return Math.hypot(F.world.player.pos.x - 40, F.world.player.pos.z + 120) < 200"), 'fast travelled to Brightwater');
    await shot(page, 'brightwater');
    // a dungeon and the Eye
    await F(page, "const w = F.world; w.emit('useDoor', { door: w.settlements.doors.find((d) => d.loc === 'coldmarrow' && d.interior === 'dungeon') });");
    await until(page, "F.world.cellId === 'coldmarrow:d0'");
    await page.waitForTimeout(1500);
    await shot(page, 'barrow');
    ok(true, 'entered Coldmarrow Barrow');
    await F(page, "F.world.quests.start('mq11'); F.world.emit('useDoor', { door: { to: 'eye' } });");
    await until(page, "F.world.cellId === 'eye'");
    ok(await until(page, "F.world.actors.some((a) => a.tpl === 'vyrthax')", 180000).then(() => true, () => false), 'Vyrthax in the Eye');
    await shot(page, 'eye');
    ok(!errs.length, `no page errors${errs.length ? ':\n    ' + [...new Set(errs)].slice(0, 8).join('\n    ') : ''}`);
    await ctx.close();
}

// ------------------------------------------------------------------ phone
console.log('phone 390×844 (touch only)');
{
    const { page, ctx, errs } = await open({ width: 390, height: 844 }, true);
    await F(page, "document.getElementById('t-new').click()");
    await until(page, "F.mode === 'chargen'");
    await shot(page, 'phone-chargen');
    await F(page, "document.querySelector('.chargen .mbtn.gold').click()");
    await until(page, "F.mode === 'play'");
    ok(await F(page, "return !document.getElementById('touch').classList.contains('hidden')"), 'touch deck shown');
    const z0 = await F(page, 'return F.world.player.pos.z');
    const box = await page.locator('#t-stickzone').boundingBox();
    const cx = box.x + box.width * 0.4, cy = box.y + box.height * 0.6;
    const cdp = await ctx.newCDPSession(page);
    const tp = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx, y, id: 1 }] });
    await tp('touchStart', cy); for (let i = 1; i <= 6; i++) await tp('touchMove', cy - i * 10);
    ok(await until(page, `Math.abs(F.world.player.pos.z - ${z0}) > 0.5`, 90000).then(() => true, () => false), 'the stick moves the player');
    await tp('touchEnd', cy - 60);
    await shot(page, 'phone-play');
    ok(!errs.length, `no page errors${errs.length ? ':\n    ' + [...new Set(errs)].slice(0, 8).join('\n    ') : ''}`);
    await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
