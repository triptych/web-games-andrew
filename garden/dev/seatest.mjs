/**
 * seatest.mjs — drives the Moon Fountain's submarine in real Chromium: walks
 * to the fountain and clicks the sub, climbs in, steers with the keys and the
 * helm buttons, travels far enough that the floor is rebuilt round it, checks
 * the creatures and their cards, dives at night with the lamp, surfaces, and
 * goes down again (the sea is rebuilt). Then a touch-only phone in portrait
 * presses the on-screen helm. Fails on any console or page error. Needs
 * ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/seatest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots.
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
        await page.screenshot({ path: path.join(OUT, `sea-${name}.png`), timeout: 300000 });
    };
    return { ctx, page, G, until, frames, shot };
}

// ---------------------------------------------------------------- desktop
{
    const { ctx, page, G, until, frames, shot } = await open({ width: 1280, height: 720 });
    await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.4${process.env.Q ? '&q=' + process.env.Q : ''}`);
    await until('g?.entered', 240000);
    check(await G('g.fountainSub.ok'), 'there is a submarine in the fountain');
    const a0 = await G('g.fountainSub.a');
    await frames(20);
    check(await G(`g.fountainSub.a !== ${a0}`), 'it circles the fountain');

    // stand by the fountain, look at the sub and click it
    await G('(() => { const s = g.fountainSub.stand; g.controls.teleport(s.x, s.z, s.yaw); g.controls.pitch = -0.35; })()');
    await frames(20);
    await shot('0-fountain');
    const xy = await page.evaluate(() => {
        const g = window.__garden;
        const p = g.fountainSub.group.position.clone().project(g.camera);
        return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, z: p.z };
    });
    check(xy.z < 1 && xy.x > 0 && xy.x < 1280 && xy.y > 0 && xy.y < 720, 'the submarine is in view from the rim');
    const hit = await G(`g.pick(${xy.x}, ${xy.y})?.type`);
    check(hit === 'sub', `the pick finds the submarine (got ${hit})`);
    await page.mouse.click(xy.x, xy.y);
    await until('g.diving?.phase === "view" && g.undersea?.active', 120000);
    check(errors.length === 0, 'climbing in builds the sea without errors');
    await frames(10);
    check(await page.isVisible('#sea'), 'the porthole and helm are showing');
    const nChunks = await G('g.undersea.chunks.size');
    check(nChunks >= 12, `the floor round the start is built (${nChunks} chunks)`);
    const nLife = await G('g.undersea.life.items.length');
    check(nLife >= 5, `there is life about (${nLife} groups)`);
    await shot('1-porthole');

    // steer with the keys: faster, turn left, rise
    const p0 = await G('({ ...g.undersea.sub.pos, yaw: g.undersea.sub.yaw })');
    await page.keyboard.press('w');
    await page.keyboard.press('w');
    check(await G('g.undersea.sub.throttle') === 4, 'W rings the telegraph up to full ahead');
    await page.keyboard.down('a');
    await page.keyboard.down('Space');
    await frames(40);
    await page.keyboard.up('a');
    await page.keyboard.up('Space');
    const p1 = await G('({ ...g.undersea.sub.pos, yaw: g.undersea.sub.yaw })');
    check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5, 'it moves forward');
    check(p1.yaw > p0.yaw, 'A turns it to port');
    check(p1.y > p0.y || p1.y >= -1.81, 'Space takes it up');
    check(p1.y <= -1.79, 'it stays under the surface');

    // the helm buttons, by mouse
    const y0 = await G('g.undersea.sub.pos.y');
    const dive = await page.locator('[data-hold="down"]').boundingBox();
    await page.mouse.move(dive.x + dive.width / 2, dive.y + dive.height / 2);
    await page.mouse.down();
    await frames(40);
    await page.mouse.up();
    const y1 = await G('g.undersea.sub.pos.y');
    check(y1 < y0, `holding the dive button takes it down (${y0.toFixed(2)} → ${y1.toFixed(2)})`);
    await page.click('#sea-slower');
    check(await G('g.undersea.sub.throttle') === 3, 'the − button rings it down');
    await page.click('#sea-lamp');
    check(await G('g.undersea.lampOn') && (await page.getAttribute('#sea-lamp', 'aria-pressed')) === 'true', 'the lamp switches on');
    await page.keyboard.press('b');
    check(!(await G('g.undersea.lampOn')), 'B switches it off');

    // never into the floor or the rocks
    const clear = await page.evaluate(async () => {
        const g = window.__garden, u = g.undersea;
        const { seabedY } = await import('./garden/js/sea-reef.js');
        let worst = Infinity;
        for (let k = 0; k < 120; k++) {
            u.keys.add('c');
            await new Promise((r) => requestAnimationFrame(r));
            const p = u.sub.pos;
            worst = Math.min(worst, p.y - seabedY(p.x, p.z));
        }
        u.keys.delete('c');
        return worst;
    });
    check(clear > 1.5, `diving hard stays clear of the floor (closest ${clear.toFixed(2)} m)`);

    // a long way off: the old floor is let go and new floor is made
    const keys0 = await G('[...g.undersea.chunks.keys()].join(";")');
    await G('(() => { const u = g.undersea; u.sub.pos.x += 400; u.sub.pos.z -= 300; u._chunks(false); })()');
    await until('g.undersea.queue.length === 0', 120000);
    await frames(5);
    const keys1 = await G('[...g.undersea.chunks.keys()]');
    check(keys1.every((k) => !keys0.split(';').includes(k)), 'far away, the floor is all new');
    check(keys1.length >= 12 && keys1.length <= (2 * 3 + 3) ** 2, `new floor is built and old chunks are let go (${keys1.length} held)`);
    await frames(40);
    check(await G('g.undersea.life.items.every((it) => Math.hypot(it.pos.x - g.undersea.sub.pos.x, it.pos.z - g.undersea.sub.pos.z) < 260)'), 'animals left far behind are let go');
    await shot('2-far');

    // every kind of floor can be built
    const kinds = await page.evaluate(async () => {
        const { biomeAt, dominant, buildChunk, reefMaterial } = await import('./garden/js/sea-reef.js');
        const seen = {};
        for (let i = -40; i <= 40; i += 4) for (let j = -40; j <= 40; j += 4) {
            const b = dominant(biomeAt(i * 32 + 16, j * 32 + 16));
            if (!seen[b]) {
                const ch = buildChunk(i, j, reefMaterial({ uTime: { value: 0 }, uCaustic: { value: 1 }, uGlow: { value: 0 } }), 1);
                seen[b] = ch.mesh.geometry.attributes.position.count;
                ch.mesh.geometry.dispose();
            }
        }
        return seen;
    });
    check(['reef', 'kelp', 'sand', 'rock'].every((k) => kinds[k] > 289), `all four floors grow things (${JSON.stringify(kinds)})`);

    // visit each biome for a look
    for (const b of ['kelp', 'rock', 'sand']) {
        const at = await page.evaluate(async (b) => {
            const { biomeAt, dominant } = await import('./garden/js/sea-reef.js');
            for (let r = 100; r < 8000; r += 37) {
                for (let k = 0; k < 12; k++) {
                    const x = Math.cos(k) * r, z = Math.sin(k) * r;
                    const w = biomeAt(x, z);
                    if (dominant(w) === b && w[b] > 0.5) return { x, z };
                }
            }
            return null;
        }, b);
        if (!at) continue;
        await G(`(() => { const u = g.undersea; u.sub.pos.x = ${at.x}; u.sub.pos.z = ${at.z}; u.sub.pos.y = -6; u.sub.throttle = 1; u.sub.speed = 0; u.look.pitch = -0.25; u._chunks(false); })()`);
        await until('g.undersea.queue.length === 0', 120000);
        await frames(30);
        await shot(`3-${b}`);
    }
    check(errors.length === 0, 'travelling builds and drops floor without errors');

    // every animal: spawn it in front, look at it, click it for its card
    for (const id of ['turtle', 'manta', 'humpback']) {
        await G(`(() => { const u = g.undersea; u.look.yaw = 0; u.look.pitch = 0; u.sub.throttle = 1; u.sub.speed = 0; u.life.clear(); const w = u.life.spawnSwimmer('${id}', u.sub.pos, u.fwd, ${id === 'humpback' ? 34 : 8}, 0.01); w.heading = Math.atan2(-u.fwd.z, u.fwd.x) + Math.PI / 2; w.pos.y = u.sub.pos.y - ${id === 'humpback' ? 1 : 0.5}; })()`);
        await frames(8);
        await shot(`4-${id}`);
        const at = await page.evaluate(() => {
            const g = window.__garden, it = g.undersea.life.items[0];
            const p = it.pos.clone().project(g.camera);
            return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
        });
        await page.mouse.click(at.x, at.y);
        await frames(2);
        const name = await page.textContent('#sea-name');
        check(!(await page.isHidden('#sea-card')) && name.length > 3, `clicking the ${id} opens its card (${name})`);
        await page.click('#sea-card-close');
    }
    check(await G('Object.keys(g.undersea.log).length') >= 3, 'they are in the sea log');
    check((await page.textContent('#sea-logcount')).startsWith(String(await G('Object.keys(g.undersea.log).length'))), 'the log dial counts them');

    // schools and jellies, and the clownfish in their anemones
    await G(`(() => { const u = g.undersea; u.life.clear(); u.life.populate(u.sub.pos, u.fwd); })()`);
    await frames(30);
    const kindsAlive = await G('[...new Set(g.undersea.life.items.map((it) => it.kind))].join(",")');
    check(kindsAlive.includes('school') && kindsAlive.includes('jelly'), `schools and jellies swim (${kindsAlive})`);
    const clowns = await page.evaluate(async () => {
        const g = window.__garden, u = g.undersea;
        u.sub.pos.set(0, -6, 0);
        u._chunks(true);
        // find an anemone and park beside it
        for (const ch of u.chunks.values()) for (const a of ch.anemones) {
            u.sub.pos.set(a.x + 3, a.y + 1.5, a.z + 3);
            for (let k = 0; k < 120; k++) await new Promise((r) => requestAnimationFrame(r));
            if (u.life.items.some((it) => it.sp.id === 'clown')) return true;
        }
        return false;
    });
    check(clowns, 'clownfish move into anemones near the submarine');
    check(errors.length === 0, 'all the animals run without errors');

    // surface: back on the fountain's rim, the sub bobs back up and carries on
    await page.keyboard.press('Escape');
    await until('!g.diving && g.controls.enabled', 120000);
    await frames(10);
    const st = await G('g.fountainSub.stand');
    const pos = await G('({ x: g.controls.pos.x, z: g.controls.pos.z })');
    check(Math.hypot(pos.x - st.x, pos.z - st.z) < 0.5, 'Esc brings you back to the fountain');
    check(await page.isHidden('#sea'), 'the porthole is gone');
    check(await G('g.undersea.chunks.size') === 0 && await G('g.undersea.life.items.length') === 0, 'the sea is let go');
    await until('g.fountainSub.state === "circle"', 300000);
    check(true, 'the submarine bobs up and carries on round the fountain');

    // at night, down again: the lamp is lit and the reef glows
    await G('g.sky.setTime(0.95)');
    await frames(10);
    await G('g.startDive()');
    await until('g.diving?.phase === "view"', 120000);
    await frames(20);
    check(await G('g.undersea.lampOn'), 'the lamp is lit for a night dive');
    check(await G('g.undersea.chunks.size') >= 12, 'the sea is built again');
    await shot('5-night');
    await G('g.leaveDive()');
    await until('!g.diving', 120000);
    check(errors.length === 0, 'no errors on desktop');
    await ctx.close();
}

// ---------------------------------------------------------------- a phone, portrait, touch only
{
    const { ctx, page, G, until, frames, shot } = await open({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    await page.goto(`${BASE}/index.html?debug&enter&t=0.45&q=low`);
    await until('g?.entered', 240000);
    await G('g.startDive()');
    await until('g.diving?.phase === "view"', 120000);
    await frames(10);
    await shot('6-phone');
    for (const sel of ['[data-hold="left"]', '[data-hold="right"]', '[data-hold="up"]', '[data-hold="down"]', '#sea-faster', '#sea-slower', '#sea-lamp', '#sea-leave']) {
        const b = await page.locator(sel).boundingBox();
        check(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844 && b.height >= 40, `${sel} fits on a phone and is big enough to press`);
    }
    const yaw0 = await G('g.undersea.sub.yaw');
    const left = await page.locator('[data-hold="left"]').boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const pt = { x: left.x + left.width / 2, y: left.y + left.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
    await frames(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(await G(`g.undersea.sub.yaw > ${yaw0}`), 'holding ◀ by touch turns it');
    await page.tap('#sea-leave');
    await until('!g.diving', 120000);
    check(errors.length === 0, 'no errors on a phone');
    await ctx.close();
}

await browser.close();
console.log('\nseatest: all good');
