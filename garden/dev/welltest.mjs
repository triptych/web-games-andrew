/**
 * welltest.mjs — the Glowing Well beside the Hearthgarden, in real Chromium:
 * finds the well (near the cozy & sims pavilion, on dry land, off the paths),
 * clicks it and slides down the rope (the camera drops the length of the
 * shaft, then you land and the controls are yours), checks the garden below
 * (the panel, the can, the beds, the pool, the lights), picks what is ready,
 * waters a thirsty bed and sees it drink, finds the can empty and fills it
 * at the pool, grows a plant on to ripe and picks it, checks that everything
 * you did is kept, climbs the rope home (and that the beds went on growing
 * while you were away), goes down again on foot, visits at night, and then a
 * touch-only phone does the same by tapping. Fails on any console or page error.
 * Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/welltest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots,
 * Q=low|medium|high for the garden's quality tier (default low: this is slow
 * enough in software GL), ONLY=desktop|phone to run one part.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const OUT = path.join(HERE, 'shots');
const SHOTS = process.env.SHOTS !== '0';
const ONLY = process.env.ONLY;
const Q = process.env.Q ?? 'low';
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAILED: ' + msg + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
    console.log('  ok  ' + msg);
};
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function open(viewport, opts = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
    await ctx.addInitScript(() => localStorage.clear());
    if (fs.existsSync(PKG)) {
        await ctx.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
    const G = (expr) => page.evaluate(`(() => { const g = window.__garden; return ${expr}; })()`);
    const until = (expr, timeout = 600000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout });
    const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const shot = async (name) => {
        if (!SHOTS) return;
        await frames(4);
        await page.screenshot({ path: path.join(OUT, `well-${name}.png`), timeout: 300000 });
    };
    // where a point in the world appears on screen
    const screen = (x, y, z) => page.evaluate(([x, y, z]) => {
        const g = window.__garden;
        const v = g.camera.position.clone().set(x, y, z).project(g.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 };
    }, [x, y, z]);
    // what the tooltip would say for the pointer at (x, y), inside the well
    const hoverNote = (x, y) => page.evaluate(async ([x, y]) => {
        const T = await import('three');
        const g = window.__garden;
        const r = new T.Raycaster();
        r.setFromCamera(new T.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), g.camera);
        return g.grotto.hoverNote(r);
    }, [x, y]);
    return { ctx, page, G, until, frames, shot, screen, hoverNote };
}

const inWell = 'g.below && g.roomKind === "well" && g.grotto?.inside';
const url = (extra = '') => `${BASE}/index.html?debug&enter&pr=0.5&t=0.4&q=${Q}${extra}`;

/** Stand `d` metres from (x, z) on the landing's side, looking at it (pitch down a little). */
const standAt = (x, z, d, pitch = -0.2) => `(() => {
    const lx = ${x}, lz = ${z};
    const a = Math.atan2(0 - lx, 7.4 - lz);
    const px = lx + Math.sin(a) * ${d}, pz = lz + Math.cos(a) * ${d};
    g.controls.teleport(px, pz, Math.atan2(-(lx - px), -(lz - pz)));
    g.controls.pitch = ${pitch};
})()`;

// ---------------------------------------------------------------- desktop
if (!ONLY || ONLY === 'desktop') {
    const { ctx, page, G, until, frames, shot, screen, hoverNote } = await open({ width: 1000, height: 560 });
    await page.goto(url());
    await until('g?.entered', 900000);

    // ---- the well beside the Hearthgarden
    const site = await G(`(() => {
        const w = g.world.well, pv = g.layout.spokes.find((s) => s.genre.id === 'cozy').pavilion;
        return { ok: !!w, d: Math.hypot(w.x - pv.x, w.z - pv.z), shore: g.island.shoreAt(w.x, w.z), path: Math.min(...[...g.layout.spokes.flatMap((s) => s.pts), ...g.layout.dock.pts].map((q) => Math.hypot(q.x - w.x, q.z - w.z))), h: g.island.heightAt(w.x, w.z), ph: g.island.heightAt(pv.x, pv.z) };
    })()`);
    check(site.ok, 'there is a well');
    check(site.d > 10 && site.d < 20, `it stands just outside the Hearthgarden pavilion's plaza (${site.d.toFixed(1)} m from its centre)`);
    check(site.shore < -6 && site.h > 1.5, `on dry land (${site.shore.toFixed(1)} m from the shore)`);
    check(site.path > 6, `clear of the paths (${site.path.toFixed(1)} m from the nearest)`);
    check(Math.abs(site.h - site.ph) < 0.6, 'its apron is level with the plaza');
    check(await G('g.world.landmarks.some((l) => l.name === "The Glowing Well")'), 'it is a named landmark (the map and the library can take you there)');

    // ---- look at it, click it
    await G('(() => { const w = g.world.well; g.controls.teleport(w.front.x + (w.front.x - w.x) * 0.5, w.front.z + (w.front.z - w.z) * 0.5, w.face); g.controls.pitch = -0.12; })()');
    await frames(30);
    await shot('0-garden');
    const xy = await G(`(() => { const w = g.world.well; const v = g.camera.position.clone().set(w.x, w.y + 1.0, w.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; })()`);
    check(await G(`g.pick(${xy.x}, ${xy.y})?.type === 'well'`), 'the well can be picked');
    await page.mouse.click(xy.x, xy.y);
    await until(inWell, 120000);
    check(true, 'clicking the well walks you up to the curb and down the rope');
    check(await G('g.grotto.state === "slide" || g.grotto.state === "free"'), 'you are sliding');

    // ---- the slide: the camera drops the length of the shaft; the controls are not yours until you land
    const y0 = await G('g.camera.position.y');
    check(y0 > 8, `it starts high up the shaft (${y0.toFixed(1)} m)`);
    check(await G('g.controls.enabled === false || g.grotto.state === "free"'), 'the controls wait while you slide');
    await shot('1-slide');
    await until('g.grotto.state === "free"', 600000);
    check(true, 'you land');
    const yL = await G('g.camera.position.y');
    check(yL < 2.2 && yL > 1.2, `at eye height (${yL.toFixed(2)} m)`);
    check(await G('g.controls.enabled'), 'and the controls are yours');
    await frames(20);
    await shot('2-landed');

    // ---- the garden below
    check(await G('!document.getElementById("well-hud").hidden'), 'the panel is showing');
    check(await G('document.querySelectorAll("#well-pips i.on").length') === 5, 'the can is full (5 waterings)');
    check(await G('g.grotto.plots.length') === 14, 'fourteen things to tend');
    const kinds = await G('(() => { const k = {}; for (const p of g.grotto.plots) k[p.kind] = (k[p.kind] || 0) + 1; return k; })()');
    check(kinds.glowcap >= 3 && kinds.lumen >= 2 && kinds.fruit >= 2 && kinds.lichen >= 2, `mushrooms, lumenblooms, trees and lichen (${JSON.stringify(kinds)})`);
    check(await G('g.grotto.plots.filter((p) => p.ripe).length') >= 3, 'a few are ready to pick from the start');
    check(await G('g.grotto.world.island.heightAt(-6.3, -0.9) < 0.35'), 'the pool is too deep to walk into');
    check(await G('g.grotto.world.island.heightAt(0, 4) > 0.35'), 'the floor is walkable');
    check(await G('g.grotto.world.collidersNear(0, 0).length > 10'), 'beds, boulders and the old tree are solid');
    check(await G('g.grotto.lamps.some((l) => l.intensity > 0.5)'), 'lights follow the nearest glowing things');
    check(await G('document.getElementById("well-n-glowcap").textContent') === '0', 'nothing picked yet');

    // ---- pick what is ready (plot 0 is a ripe glowcap bed)
    await G(standAt(-3.6, 3.4, 3.6));
    await frames(25);
    const ripe0 = await G('g.grotto.plots[0].ripe');
    check(ripe0, 'the first glowcap bed is ready');
    let p = await screen(-3.6, 0.7, 3.4);
    check(p.front && p.x > 0 && p.x < 1000 && p.y > 0 && p.y < 560, 'it is in view');
    const note = await hoverNote(p.x, p.y);
    check(note?.kicker === 'Ready to pick' && /pick/i.test(note.cta), 'hovering a ripe plant says so');
    await shot('3-bed');
    await page.mouse.click(p.x, p.y);
    await until('g.grotto.save.bag.glowcap >= 2', 60000);
    const n1 = await G('g.grotto.save.bag.glowcap');
    check(n1 >= 2 && n1 <= 4, `picking a ripe bed gives 2 to 4 glowcaps (${n1})`);
    check(await G('document.getElementById("well-n-glowcap").textContent') === String(n1), 'the panel counts them');
    check(await G('!g.grotto.plots[0].ripe && g.grotto.plots[0].g < 0.3'), 'the bed starts over');
    check(await G('document.querySelector(".well-pop") !== null'), 'a label floats up from it');
    await frames(10);
    await shot('4-picked');

    // ---- water a thirsty bed (plot 1 is a half-grown violet glowcap bed)
    await G(standAt(4.2, 3.6, 3.6));
    await frames(25);
    const g0 = await G('g.grotto.plots[1].g');
    check(await G('g.grotto.plots[1].water') === 0, 'the second bed is dry');
    p = await screen(4.2, 0.7, 3.6);
    await page.mouse.click(p.x, p.y);
    await until('g.grotto.plots[1].water > 0.9', 60000);
    check(await G('g.grotto.save.can') === 4, 'watering costs one watering of the can');
    check(await G('document.querySelectorAll("#well-pips i.on").length') === 4, 'the panel shows it');
    await frames(40);
    check(await G('g.grotto.plots[1].g') > g0, 'the plant grows while it has water');
    check(await G('g.grotto.plots[1].vital') > 0.9, 'and shines the brighter for it');
    await shot('5-watered');

    // ---- empty can: a hint, and nothing changes; then fill it at the pool
    await G('g.grotto.save.can = 0; g.grotto._hud()');
    await G(standAt(8.6, -0.8, 3.6));
    await frames(20);
    p = await screen(8.6, 0.7, -0.8);
    await page.mouse.click(p.x, p.y);
    await frames(60);
    check(await G('g.grotto.plots[2].water') === 0 && await G('g.grotto.save.can') === 0, 'with an empty can, nothing is watered');
    await G('(() => { g.controls.teleport(-2.5, 2.2, Math.atan2(-(-6.3 + 2.5), -(-0.9 - 2.2))); g.controls.pitch = -0.45; })()');
    await frames(25);
    p = await screen(-6.3, -0.17, -0.9);
    check(p.front, 'the pool is in view');
    check((await hoverNote(p.x, p.y))?.title === 'The Glow Pool', 'hovering the pool says what it is');
    await shot('6-pool');
    await page.mouse.click(p.x, p.y);
    await until('g.grotto.save.can === 5', 60000);
    check(true, 'clicking the pool fills the can');
    check(await G('document.querySelectorAll("#well-pips i.on").length') === 5, 'and the panel shows it');

    // ---- grow a plant on to ripe, and pick it (plot 4 is a ripe lumenbloom; use plot 5, the half-grown violet one)
    await G('(() => { const q = g.grotto.plots[5]; q.g = 0.992; q.water = 1; })()');
    await G(standAt(-1.2, -3.4, 3.6));
    await until('g.grotto.plots[5].ripe', 60000);
    check(true, 'a plant that has had its water grows ripe');
    await frames(30);
    await shot('7-ripe-lumen');
    p = await screen(-1.2, 0.8, -3.4);
    await page.mouse.click(p.x, p.y);
    await until('g.grotto.save.bag.lumen >= 2', 60000);
    check(await G('g.grotto.save.bag.lumen') <= 3, 'a lumenbloom gives 2 or 3');

    // ---- the trees and the lichen too (set them ripe, pick them)
    await G('(() => { for (const q of g.grotto.plots) if (q.kind === "fruit" || q.kind === "lichen") { q.g = 1; q.ripe = true; } })()');
    await G(standAt(8.6, -6.0, 4.0, -0.1));
    await frames(40);
    await shot('8-tree');
    p = await screen(8.6, 1.3, -6.0);
    await page.mouse.click(p.x, p.y);
    await until('g.grotto.save.bag.fruit >= 3', 60000);
    check(await G('g.grotto.save.bag.fruit') <= 5, 'a lanternwood gives 3 to 5 fruit');
    await G(standAt(10.9, 3.0, 3.4, -0.1));
    await frames(30);
    p = await screen(10.9, 0.6, 3.0);
    await page.mouse.click(p.x, p.y);
    await until('g.grotto.save.bag.lichen >= 2', 60000);
    check(true, 'and a boulder gives moonlichen');
    await shot('9-lichen');

    // ---- it is all kept
    const saved = await G('JSON.parse(localStorage.getItem("garden.wellGarden"))');
    check(saved && saved.bag.glowcap >= 2 && saved.bag.lumen >= 2 && saved.bag.fruit >= 3 && saved.bag.lichen >= 2, 'what you picked is saved');
    check(saved.plots.length === 14, 'and the state of every bed');

    // ---- places are found as you walk
    await G('(() => { g.controls.teleport(-6.3, 3.4, 0); })()');
    await frames(40);
    check(await G('g.grotto.seen.has("pool")'), 'coming up to the pool names it');

    // ---- the rope: click it, climb out
    await G('(() => { g.grotto.plots[3].g = 0.2; g.grotto.plots[3].water = 1; g.grotto._store(); })()');
    await G('g.controls.teleport(0, 3.0, Math.PI); g.controls.pitch = 0.1');
    await frames(20);
    const rp2 = await screen(0, 1.6, 7.4);
    await shot('10-rope');
    await page.mouse.click(rp2.x, rp2.y);
    await until('g.grotto.state === "climb"', 60000);
    check(true, 'clicking the rope starts the climb');
    await until('!g.below && g.roomKind === null', 300000);
    check(true, 'and you come out at the top');
    await frames(30);
    const pos = await G('({ x: g.controls.pos.x, z: g.controls.pos.z, o: g.world.well.out, en: g.controls.enabled, hud: document.getElementById("well-hud").hidden })');
    check(Math.hypot(pos.x - pos.o.x, pos.z - pos.o.z) < 0.5, 'beside the curb');
    check(pos.en && pos.hud, 'the controls are yours again and the panel is gone');
    await shot('11-out');
    // standing at the curb after coming up must not send you straight back down
    await frames(60);
    check(await G('!g.below'), 'you are not taken down again at once');

    // ---- the beds went on growing while you were away (an hour of "away", but the cap is half an hour)
    await G('(() => { const s = JSON.parse(localStorage.getItem("garden.wellGarden")); s.t -= 3600 * 1000; localStorage.setItem("garden.wellGarden", JSON.stringify(s)); })()');
    // ---- down again, on foot
    // (start well back from the curb: it only arms itself once you are more than 3.4 m away)
    await G('(() => { const w = g.world.well; g.controls.teleport(w.x + (w.front.x - w.x) * 1.8, w.z + (w.front.z - w.z) * 1.8, w.face); g.controls.walkTo([w.front, w.stand]); })()');
    await until(inWell, 120000);
    await until('g.grotto.state === "free"', 600000);
    check(true, 'walking up to the curb takes you down the rope again');
    check(await G('g.grotto.save.bag.glowcap') === n1, 'what you picked is still counted');
    check(await G('document.getElementById("well-n-lichen").textContent') !== '0', 'and the panel remembers');
    check(await G('g.grotto.plots[3].g') > 0.9, 'the bed you watered grew while you were away');
    check(await G('g.grotto.plots[7].ripe === false'), 'one you picked has not magically grown back');

    // ---- the shaft has the garden's time of day
    await frames(30);
    const dayLight = await G('g.grotto.shaftLight.intensity');
    await G('g.sky.setTime ? g.sky.setTime(0.95) : (g.sky.time = 0.95)');
    await frames(60);
    const nightLight = await G('g.grotto.shaftLight.intensity');
    check(dayLight > nightLight + 1.5, `the daylight down the shaft fades at night (${dayLight.toFixed(1)} to ${nightLight.toFixed(1)})`);
    await G(standAt(0, 7.4, 0.8, 1.1));
    await frames(30);
    await shot('12-night-up');
    await G('g.sky.setTime ? g.sky.setTime(0.4) : (g.sky.time = 0.4)');

    // ---- leave with the button
    await page.click('#well-home');
    await until('g.grotto.state === "climb"', 60000);
    await until('!g.below', 300000);
    check(true, 'the Climb the rope button takes you home too');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
}

// ---------------------------------------------------------------- a touch-only phone
if (!ONLY || ONLY === 'phone') {
    const { ctx, page, G, until, frames, shot, screen } = await open({ width: 390, height: 780 }, { hasTouch: true, isMobile: true });
    await page.goto(url());
    await until('g?.entered', 900000);
    await G('(() => { const w = g.world.well; g.controls.teleport(w.front.x + (w.front.x - w.x) * 0.7, w.front.z + (w.front.z - w.z) * 0.7, w.face); g.controls.pitch = -0.12; })()');
    await frames(30);
    const xy = await G(`(() => { const w = g.world.well; const v = g.camera.position.clone().set(w.x, w.y + 1.0, w.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; })()`);
    await page.touchscreen.tap(xy.x, xy.y);
    await until(inWell, 120000);
    check(true, 'tapping the well takes you down the rope');
    await until('g.grotto.state === "free"', 600000);
    await frames(20);
    const box = await page.evaluate(() => { const r = document.getElementById('well-hud').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; });
    check(box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b < box.h * 0.4, 'the panel fits the top of a phone');
    await shot('phone-0-landed');
    // tap a ripe bed: walk up and pick
    await G(standAt(-3.6, 3.4, 4.4));
    await frames(25);
    const p = await screen(-3.6, 0.7, 3.4);
    await page.touchscreen.tap(p.x, p.y);
    await until('g.grotto.save.bag.glowcap >= 2', 90000);
    check(true, 'tapping a ripe bed walks over and picks it');
    // tap the ground to walk
    await G('g.controls.teleport(0, 5, 0); g.controls.pitch = -0.25');
    await frames(20);
    // (a phone in portrait sees only about 34 degrees across: pick a spot nearly straight ahead)
    const gp = await screen(0.6, 0, 2.2);
    check(gp.front && gp.x > 20 && gp.x < 370 && gp.y > 0 && gp.y < 780, 'the spot is on screen');
    await page.touchscreen.tap(gp.x, gp.y);
    await until('Math.hypot(g.controls.pos.x - 0.6, g.controls.pos.z - 2.2) < 1.0', 60000);
    check(true, 'tapping the floor walks there');
    await shot('phone-1-walked');
    await page.touchscreen.tap(...(await page.evaluate(() => { const b = document.getElementById('well-home').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })));
    await until('g.grotto.state === "climb"', 60000);
    await until('!g.below', 300000);
    check(true, 'the Climb the rope button works by touch');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
}

await browser.close();
console.log('all well tests passed');
