/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop: title (attract demo) → How to Play → hero select → prologue → play:
 * keyboard moves, auto-explore, tap-to-travel, pack / journal / map / pause,
 * a targeted skill, a level-up perk, a Warden fight and its stairs, death and
 * Rekindle, save + reload + Continue, all ten worlds and ten arenas (not
 * black), and the ending choice. Phones: touch-only play at 390×844 and
 * 844×390 with every control ≥ 44 px, on screen, and not overlapping the HUD.
 * Fails on any console error, page error or failed request. Shots → dev/shots/.
 *
 *   python3 -m http.server 8049                 # from the REPO ROOT
 *   node game-049/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served
 * from disk (still the genuine r165):
 *   cd game-049/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz
 *
 * Env: BASE (default http://127.0.0.1:8049), THREE_PKG, PW_CHROMIUM_PATH, OUT, ONLY=desktop|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8049';
const URL0 = `${BASE}/game-049/index.html?debug=1`;
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    // Clear storage once per context — not on reloads (the save test reloads).
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__cleared')) { localStorage.clear(); sessionStorage.setItem('__cleared', '1'); } } catch { /* ignore */ } });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 60000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, id) => Q(page, (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; }, id);
const frames = (page, n = 4) => Q(page, (n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

// ------------------------------------------------------------------ Desktop

async function desktop() {
    console.log('desktop 1280×800');
    const { page } = await newPage({ width: 1280, height: 800 });
    await page.goto(URL0);
    await until(page, () => window.__ld && !document.getElementById('title').hidden, 'title screen shows');
    await frames(page, 6);
    check(await Q(page, () => __ld.brightness()) > 2, 'attract demo renders something behind the title');
    await shot(page, 'd01-title');
    await page.click('#btn-help');
    check(await visible(page, 'help'), 'How to Play opens');
    await shot(page, 'd02-help');
    await page.click('#help-close');
    check(await visible(page, 'title'), 'help returns to the title');
    await page.click('#btn-new');
    check(await visible(page, 'classpick'), 'hero select opens');
    await page.click('.class-card:nth-child(2)');
    await shot(page, 'd03-classpick');
    await page.click('#class-go');
    await until(page, () => !document.getElementById('story').hidden, 'prologue shows');
    await shot(page, 'd04-prologue');
    check(await Q(page, () => __ld.run.p.cls) === 'ranger', 'picked hero is a Ranger');
    await page.click('#story-next');
    await until(page, () => !document.getElementById('story').hidden && document.getElementById('story-title').textContent.includes('Under Lastlight'), 'world 1 chapter card shows');
    await page.click('#story-next');
    await until(page, () => document.getElementById('story').hidden && !document.getElementById('hud').hidden, 'HUD after the story');
    await frames(page, 4);
    await shot(page, 'd05-floor1');

    // Keyboard.
    const t0 = await Q(page, () => __ld.run.turn);
    for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Space']) { await page.keyboard.press(k); await page.waitForTimeout(150); }
    check(await Q(page, () => __ld.run.turn) > t0, 'keyboard actions take turns');

    // Auto-explore.
    await Q(page, () => { __ld.god(); __ld.killAll(); __ld.act({ t: 'wait' }); });
    const steps0 = await Q(page, () => __ld.run.stats.steps);
    await page.keyboard.press('x');
    await until(page, (s) => __ld.run.stats.steps >= s + 6 || !__ld.G.auto, 'auto-explore walks', 30000, steps0);
    check(await Q(page, (s) => __ld.run.stats.steps > s, steps0), 'auto-explore moved the hero');
    await Q(page, () => { __ld.G.auto = null; __ld.clearBlockers(); });

    // Tap-to-travel: click a seen walkable tile a few steps away.
    const tgt = await Q(page, () => {
        const r = __ld.run, p = r.p;
        for (let d = 3; d < 7; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
            const x = p.x + dx, y = p.y + dy;
            if (x < 0 || y < 0 || x >= r.lv.w || y >= r.lv.h) continue;
            const i = y * r.lv.w + x;
            if (r.lv.seen[i] && r._t.vis[i] && r.lv.tiles[i] === 1 && !r.mons.some((m) => m.x === x && m.y === y) && !r.objs.some((o) => o.x === x && o.y === y)) { const s = __ld.tile(x, y); if (s.x > 60 && s.y > 120 && s.x < innerWidth - 200 && s.y < innerHeight - 160) return { x, y, sx: s.x, sy: s.y }; }
        }
        return null;
    });
    if (tgt) {
        await page.mouse.click(tgt.sx, tgt.sy);
        await until(page, (t) => (__ld.run.p.x === t.x && __ld.run.p.y === t.y) || (!__ld.G.auto && __ld.run.stats.steps > 0), 'tap-to-travel walks to the tapped tile', 30000, tgt);
    } else check(false, 'found a tile to tap');

    // Panels.
    await page.keyboard.press('i');
    check(await visible(page, 'inventory'), 'pack opens (I)');
    const nItems = await Q(page, () => document.querySelectorAll('#inv-grid .item').length);
    check(nItems >= 2, `pack lists items (${nItems})`);
    await page.click('#inv-grid .item');
    check(await visible(page, 'item-detail'), 'item detail shows');
    await shot(page, 'd06-pack');
    await page.keyboard.press('Escape');
    check(!(await visible(page, 'inventory')), 'Esc closes the pack');
    await page.keyboard.press('j');
    check(await visible(page, 'journal'), 'journal opens (J)');
    await page.click('#journal .tab[data-tab="pages"]');
    await shot(page, 'd07-journal');
    await page.keyboard.press('Escape');
    await page.keyboard.press('m');
    check(await visible(page, 'bigmap'), 'map opens (M)');
    await shot(page, 'd08-map');
    await page.keyboard.press('Escape');
    await page.click('#pause-btn');
    check(await visible(page, 'pause'), 'pause menu opens');
    await page.click('#pause-resume');
    check(!(await visible(page, 'pause')), 'resume closes the pause menu');

    // A targeted skill (Pinning Shot unlocks at level 3) and a perk choice.
    await Q(page, () => __ld.xp(200));
    await until(page, () => !document.getElementById('perk').hidden, 'level-up offers perks');
    await shot(page, 'd09-perk');
    while (await visible(page, 'perk')) { await page.click('.perk-card'); await page.waitForTimeout(100); }
    check(await Q(page, () => __ld.run.p.lvl) >= 3, 'hero reached level 3');
    await Q(page, () => { __ld.clearBlockers(); });
    const mid = await Q(page, () => __ld.spawnNear('kobold', 4));
    check(mid !== null, 'spawned a target');
    await frames(page, 2);
    await page.keyboard.press('2');
    const armed = await visible(page, 'target-hint');
    check(armed, 'skill 2 enters targeting');
    await shot(page, 'd10-targeting');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    check(await Q(page, () => (__ld.run.p.cds.pin || 0) > 0), 'Pinning Shot fired (on cooldown)');

    // Warden fight.
    await Q(page, () => __ld.toFloor(10));
    await Q(page, () => { __ld.clearBlockers(); __ld.god(); const r = __ld.run; const b = r.mons.find((m) => m.boss); r.p.x = b.x; r.p.y = b.y + 4; b.awake = true; __ld.act({ t: 'wait' }); });
    await until(page, () => !document.getElementById('boss-bar').hidden, 'boss bar shows');
    await Q(page, () => __ld.snap());
    for (let k = 0; k < 6; k++) await Q(page, () => __ld.act({ t: 'wait' }));
    await frames(page, 4);
    await shot(page, 'd11-warden');
    check(await Q(page, () => __ld.run.hazards.length + __ld.run.mons.length > 1), 'the Warden acts (hazards or minions)');
    await Q(page, () => __ld.killBoss());
    await until(page, () => !document.getElementById('story').hidden && document.getElementById('story-kicker').textContent.includes('defeated'), 'defeat story shows');
    await shot(page, 'd12-defeat');
    await page.click('#story-next');
    check(await Q(page, () => __ld.run.lv.tiles[__ld.run.lv.down.y * __ld.run.lv.w + __ld.run.lv.down.x] === 4), 'stairs open after the Warden falls');
    check(await Q(page, () => __ld.run.p.embers) === 1, 'an Ember was reclaimed');

    // Death and Rekindle.
    await Q(page, () => __ld.toFloor(13));
    await Q(page, () => __ld.hurt(1e6));
    await until(page, () => !document.getElementById('death').hidden, 'death screen shows');
    await shot(page, 'd13-death');
    await page.click('#death-rekindle');
    await until(page, () => document.getElementById('death').hidden && __ld.run && !__ld.run.over, 'rekindle restarts the run');
    check(await Q(page, () => __ld.run.floor) === 11, 'rekindled at the top of world 2');

    // Save, reload, continue.
    await Q(page, () => { __ld.clearBlockers(); __ld.act({ t: 'wait' }); __ld.G.toTitle(); });
    await page.reload();
    await until(page, () => window.__ld && !document.getElementById('btn-continue').hidden, 'Continue offered after reload');
    await page.click('#btn-continue');
    await until(page, () => __ld.run && __ld.run.floor === 11, 'Continue resumes on floor 11');

    // Every world and every arena renders.
    for (let w = 1; w <= 10; w++) {
        for (const f of [w * 10 - 5, w * 10]) {
            await Q(page, (f) => { __ld.toFloor(f); __ld.clearBlockers(); __ld.god(); __ld.run.p.embers = Math.floor(f / 10); }, f);
            if (f % 10 === 0) await Q(page, () => { const r = __ld.run; const b = r.mons.find((m) => m.boss); r.p.x = b.x; r.p.y = b.y + 4; __ld.act({ t: 'wait' }); __ld.clearBlockers(); });
            await frames(page, 2);
            await Q(page, () => __ld.snap());
            await frames(page, 5);
            // A NaN pixel smeared by bloom gives an all-black frame (brightness 0); arenas are dark, not black.
            const br = await Q(page, () => __ld.brightness());
            check(br > 0.15, `floor ${f} renders (brightness ${br.toFixed(1)})`);
            await shot(page, `w${String(f).padStart(3, '0')}`);
        }
    }

    // The ending.
    await Q(page, () => { __ld.toFloor(100); __ld.clearBlockers(); __ld.god(); __ld.run.p.pages = [1, 2, 3]; __ld.killBoss(); });
    await until(page, () => !document.getElementById('story').hidden, 'Hush defeat story shows');
    await page.click('#story-next');
    await until(page, () => document.querySelectorAll('.ending-choice .btn').length === 3, 'three endings offered');
    check(await Q(page, () => document.querySelectorAll('.ending-choice .btn')[2].disabled), 'The Long Dawn needs all ten pages');
    await page.waitForTimeout(400);
    await shot(page, 'd14-ending-choice');
    await page.click('.ending-choice .btn');
    await until(page, () => !document.getElementById('victory').hidden, 'victory screen shows');
    await shot(page, 'd15-victory');
    await page.click('#victory-title-btn');
    await until(page, () => !document.getElementById('title').hidden, 'back to the title');
}

// ------------------------------------------------------------------ Phones

async function phone(w, h, name) {
    console.log(`phone ${w}×${h}`);
    const { page, ctx } = await newPage({ width: w, height: h }, { hasTouch: true, isMobile: true });
    await page.goto(URL0);
    await until(page, () => window.__ld && !document.getElementById('title').hidden, `${name}: title`);
    await page.tap('#btn-new');
    // A centred column taller than the screen used to start above the scroll origin: the
    // heading and the first hero card could never be scrolled into view.
    const pick = await Q(page, () => { const s = document.getElementById('classpick'); s.scrollTop = 0; return { h: s.querySelector('.screen-h').getBoundingClientRect().top, c: s.querySelector('.class-card').getBoundingClientRect().top }; });
    check(pick.h >= 0 && pick.c >= 0, `${name}: hero select starts on screen (heading ${Math.round(pick.h)}, first card ${Math.round(pick.c)})`);
    await shot(page, `${name}-0-classpick`);
    await page.tap('.class-card:nth-child(3)');
    await page.tap('#class-go');
    await until(page, () => !document.getElementById('story').hidden, `${name}: prologue`);
    await shot(page, `${name}-1-prologue`);
    await page.tap('#story-next');
    await page.waitForTimeout(200);
    await page.tap('#story-next');
    await until(page, () => !document.getElementById('hud').hidden && document.getElementById('story').hidden, `${name}: HUD`);
    await frames(page, 4);
    await shot(page, `${name}-2-play`);
    // Controls: big enough, on screen, not over the HUD readouts.
    const geo = await Q(page, () => {
        const r = (e) => e.getBoundingClientRect();
        const acts = [...document.querySelectorAll('#actions .act'), document.getElementById('pause-btn'), document.getElementById('mute-btn')].map((e) => ({ id: e.id || e.className, ...r(e).toJSON() }));
        const hud = ['hud-left', 'hud-right', 'minimap'].map((id) => ({ id, ...r(document.getElementById(id)).toJSON() }));
        return { acts, hud, W: innerWidth, H: innerHeight };
    });
    const small = geo.acts.filter((a) => a.width < 44 || a.height < 44);
    check(!small.length, `${name}: every control ≥ 44px${small.length ? ' (' + small.map((a) => a.id).join(',') + ')' : ''}`);
    check(geo.acts.every((a) => a.left >= 0 && a.top >= 0 && a.right <= geo.W + 0.5 && a.bottom <= geo.H + 0.5), `${name}: controls on screen`);
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const overl = geo.acts.filter((a) => geo.hud.some((b) => hit(a, b)));
    check(!overl.length, `${name}: controls clear of the HUD (${overl.map((a) => a.id).join(',') || 'none'})`);
    // Touch: tap a tile next to the hero via CDP (real touch input).
    const cdp = await ctx.newCDPSession(page);
    const before = await Q(page, () => __ld.run.turn);
    const tgt = await Q(page, () => {
        const r = __ld.run, p = r.p;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const x = p.x + dx, y = p.y + dy;
            if (r.lv.tiles[y * r.lv.w + x] === 1 && !r.mons.some((m) => m.x === x && m.y === y) && !r.objs.some((o) => o.x === x && o.y === y)) { const s = __ld.tile(x, y); return { x, y, sx: s.x, sy: s.y }; }
        }
        return null;
    });
    if (tgt) {
        // Real touch input (CDP). Start and end back to back: under software GL a frame can
        // outlast the long-press timer and turn a slow tap into an inspect.
        await Promise.all([
            cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tgt.sx, y: tgt.sy, id: 1 }] }),
            cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
        ]);
        await until(page, (b) => __ld.run.turn > b, `${name}: tapping a tile moves the hero`, 15000, before);
    }
    await page.tap('#btn-bag');
    check(await visible(page, 'inventory'), `${name}: pack opens by tap`);
    await shot(page, `${name}-3-pack`);
    await page.tap('#inventory [data-close]');
    check(!(await visible(page, 'inventory')), `${name}: pack closes by tap`);
    await page.tap('#btn-explore');
    await page.waitForTimeout(1500);
    await shot(page, `${name}-4-explore`);
    // A Warden on a phone.
    await Q(page, () => { __ld.toFloor(20); __ld.clearBlockers(); __ld.god(); const r = __ld.run; const b = r.mons.find((m) => m.boss); r.p.x = b.x; r.p.y = b.y + 4; b.awake = true; __ld.act({ t: 'wait' }); });
    for (let k = 0; k < 4; k++) await Q(page, () => __ld.act({ t: 'wait' }));
    await frames(page, 4);
    await shot(page, `${name}-5-warden`);
    check(await visible(page, 'boss-bar'), `${name}: boss bar visible`);
}

const only = process.env.ONLY;
try {
    if (!only || only === 'desktop') await desktop();
    if (!only || only === 'phones') { await phone(390, 844, 'portrait'); await phone(844, 390, 'landscape'); }
} catch (e) {
    errors.push('harness: ' + e.message);
    console.log(e);
}
if (browser) await browser.close();
console.log(errors.length ? `\n${errors.length} PROBLEMS\n` + errors.join('\n') : '\nall browser checks passed');
process.exit(errors.length ? 1 : 0);
