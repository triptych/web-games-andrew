/**
 * foresttest.mjs — walks through the shimmering door in the Great Tree in real
 * Chromium: finds the door, clicks it and walks through, checks the Springwood
 * is built round you, walks a long way (the wood is rebuilt as you go, the old
 * chunks let go), comes upon a pond or special place, visits at night, steps
 * home with the button, and goes through again by walking (the wood is made
 * again). The fox: the garden's fox runs home through the door; in the wood it
 * greets you, follows, can be petted, and leads you to a place you haven't
 * found. Then a touch-only phone in portrait taps the ground to walk. Fails on
 * any console or page error. Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/foresttest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots,
 * ONLY=desktop|fox|phone to run one part.
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
        await page.screenshot({ path: path.join(OUT, `forest-${name}.png`), timeout: 300000 });
    };
    return { ctx, page, G, until, frames, shot };
}

const inForest = 'g.below && g.roomKind === "forest" && g.forest?.inside';

// ---------------------------------------------------------------- desktop
if (!ONLY || ONLY === 'desktop') {
    const { ctx, page, G, until, frames, shot } = await open({ width: 1280, height: 720 });
    await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.4${process.env.Q ? '&q=' + process.env.Q : ''}`);
    await until('g?.entered', 240000);
    check(await G('!!g.world.treePortal'), 'there is a door in the Great Tree');

    // stand in front of it, look at it and click it
    await G('(() => { const tp = g.world.treePortal; const f = tp.front; g.controls.teleport(f.x + tp.nx * 4, f.z + tp.nz * 4, tp.out.yaw + Math.PI); g.controls.pitch = -0.05; })()');
    await frames(30);
    await shot('0-tree');
    const xy = await page.evaluate(() => {
        const g = window.__garden, tp = g.world.treePortal;
        const p = tp.surface.getWorldPosition(new tp.surface.position.constructor());
        p.y += 1.6;
        p.project(g.camera);
        return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
    });
    check(await G(`g.pick(${xy.x}, ${xy.y})?.type === 'treePortal'`), 'the door can be picked');
    await page.mouse.click(xy.x, xy.y);
    await until(inForest, 60000);
    check(true, 'clicking the door walks you through it into the Springwood');
    await frames(40);
    const n0 = await G('g.forest.chunks.size');
    check(n0 >= 13, `the wood round the clearing is built (${n0} chunks)`);
    check(await G('!document.getElementById("forest-hud").hidden'), 'the way-home panel is showing');
    await shot('1-arrive');
    await G('(() => { g.controls.yaw = 0; })()');
    await frames(10);
    await shot('2-portal-home');

    // walk a long way: the wood is made ahead and let go behind
    const keys0 = await G('[...g.forest.chunks.keys()].join(";")');
    for (let k = 1; k <= 8; k++) {
        await G(`(() => { const c = g.controls; c.teleport(${k * 40}, ${k * 28}, 2.2); })()`);
        await frames(25);
    }
    await until('g.forest.queue.length === 0', 120000);
    const keys1 = await G('[...g.forest.chunks.keys()]');
    check(keys1.every((k) => !keys0.split(';').includes(k)), 'far from the door the wood is all new chunks');
    const R = await G('g.forest.cfg.R');
    const farthest = await G('(() => { const f = g.forest, c = g.controls.pos, ci = Math.floor(c.x / 32), cj = Math.floor(c.z / 32); return Math.max(...[...f.chunks.values()].map((ch) => Math.hypot(ch.i - ci, ch.j - cj))); })()');
    check(farthest <= R + 1, `old chunks are let go (${keys1.length} kept, none more than ${R + 1} chunks away)`);
    check(await G('g.forest.world.collidersNear(g.controls.pos.x, g.controls.pos.z).length > 0'), 'trees and stones are solid');
    await shot('3-far');

    // find a pond and a special place by searching the feature grid
    const spot = await page.evaluate(async () => {
        const land = await import('./garden/js/forest-land.js');
        const out = {};
        for (let r = 1; r < 30 && (!out.pond || !out.place); r++) {
            for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
                const f = land.featureIn(i, j);
                if (!f) continue;
                if (f.kind === 'pond') out.pond ??= { x: f.x, z: f.z, R: f.R };
                else out.place ??= { x: f.x, z: f.z, r: f.r, kind: f.kind };
            }
        }
        return out;
    });
    check(spot.pond && spot.place, `the wood has ponds and places (${spot.place?.kind})`);
    await G(`(() => { g.controls.teleport(${spot.place.x}, ${spot.place.z + spot.place.r + 1.5}, 0); g.controls.pitch = -0.12; })()`);
    await frames(60);
    check(await G(`g.forest.log[${JSON.stringify(spot.place.kind)}] >= 1`), 'coming upon a special place puts it in your log');
    await shot('4-place-' + spot.place.kind);
    await G(`(() => { g.controls.teleport(${spot.pond.x}, ${spot.pond.z + spot.pond.R + 4}, 0); g.controls.pitch = -0.2; })()`);
    await frames(60);
    check(await G('g.forest.log.pond >= 1'), 'and a pond');
    check(await G(`g.forest.world.island.heightAt(${spot.pond.x}, ${spot.pond.z}) < 0.35`), 'the pond is too deep to walk into');
    await shot('5-pond');

    // night: fireflies and glowing toadstools
    await G('g.sky.setTime ? g.sky.setTime(0.95) : (g.sky.time = 0.95)');
    await frames(60);
    check(await G('g.forest.uni.uGlow.value > 0.5'), 'at night the wood glows');
    await shot('6-night');
    await G('g.sky.setTime ? g.sky.setTime(0.4) : (g.sky.time = 0.4)');

    // step home with the button
    await page.click('#forest-home');
    await until('!g.below && g.roomKind === null', 30000);
    await frames(20);
    const tp = await G('(() => { const t = g.world.treePortal; return { x: t.out.x, z: t.out.z }; })()');
    const pos = await G('({ x: g.controls.pos.x, z: g.controls.pos.z })');
    check(Math.hypot(pos.x - tp.x, pos.z - tp.z) < 0.5, 'Step home puts you back beside the Great Tree');
    check(await G('document.getElementById("forest-hud").hidden'), 'and the panel goes away');
    check(await G('g.forest.chunks.size === 0'), 'the wood is let go');

    // walk through it on foot
    await G('(() => { const tp = g.world.treePortal; g.controls.walkTo([tp.front, tp.back]); })()');
    await until(inForest, 60000);
    check(true, 'walking through the door takes you in again');
    await frames(20);
    check(await G('g.forest.chunks.size') >= 13, 'the wood is made again');
    // and out through the door in the clearing
    await G('(() => { const f = g.forest; g.controls.teleport(0, 5, Math.PI); g.controls.walkTo([{ x: 0, z: 2 }, { x: 0, z: -1.2 }]); })()');
    await until('!g.below', 60000);
    check(true, 'walking back through the clearing door takes you home');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
}

// ---------------------------------------------------------------- the fox
if (!ONLY || ONLY === 'fox') {
    const { ctx, page, G, until, frames, shot } = await open({ width: 1280, height: 720 });
    await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.4&fox=1`);
    await until('g?.entered', 240000);
    // the garden's fox, bolting near the Great Tree, runs home through the door
    await until('g.fox.state === "coming" || g.fox.state === "looking"', 60000);
    await G(`(() => {
        const f = g.fox, tp = g.world.treePortal;
        const x = tp.front.x + tp.nx * 8, z = tp.front.z + tp.nz * 8;
        f.fox.position.set(x, g.world.walkHeight(x, z), z);
        g.controls.teleport(x + tp.nx * 6, z + tp.nz * 6, tp.out.yaw + Math.PI);
        f.path = { from: { x, z }, stop: { x, z }, to: { x: x + 30, z } };
        f._flee();
    })()`);
    await until('g.fox.state === "gone"', 60000);
    check(await G('g.fox.wentHome === true'), 'the garden fox runs home through the door in the Great Tree');

    await G('g.throughDoor(true, "forest")');
    await until(inForest, 60000);
    await frames(10);
    const ff = 'g.forest.fox';
    check(await G(`${ff}.fox.visible && Math.hypot(${ff}.fox.position.x - g.controls.pos.x, ${ff}.fox.position.z - g.controls.pos.z) < 5`), 'in the Springwood the fox is waiting by the door');
    await shot('8-fox-greet');

    // it follows: walk off somewhere open and see it keep up
    const open = await page.evaluate(async () => {
        const land = await import('./garden/js/forest-land.js');
        for (let a = 0; a < 6.28; a += 0.4) {
            let ok = true;
            for (let r = 3; r <= 26; r += 1) {
                const x = Math.sin(a) * r, z = Math.cos(a) * r;
                if (land.groundY(x, z) < 0.6) ok = false;
                if (window.__garden.forest.world.collidersNear(x, z).some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.5) ** 2)) ok = false;
            }
            if (ok) return { x: Math.sin(a) * 24, z: Math.cos(a) * 24 };
        }
        return null;
    });
    check(open, 'there is an open way out of the clearing');
    await G(`g.controls.walkTo([{ x: ${open.x}, z: ${open.z} }])`);
    await until('!g.controls.route', 120000);
    await frames(60);
    const fd = await G(`Math.hypot(${ff}.fox.position.x - g.controls.pos.x, ${ff}.fox.position.z - g.controls.pos.z)`);
    check(fd < 6, `the fox follows you (${fd.toFixed(1)} m away)`);
    check(await G(`${ff}.state === 'follow' || ${ff}.state === 'lead'`), 'and it settles to watch when you stop');
    await shot('9-fox-follow');

    // click it for a fuss
    await G(`${ff}.state = 'follow'`);
    const fxy = await page.evaluate(() => {
        const g = window.__garden, f = g.forest.fox.fox;
        const p = f.position.clone();
        p.y += 0.35;
        p.project(g.camera);
        return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, front: p.z < 1 };
    });
    if (fxy.front && fxy.x > 0 && fxy.x < 1280 && fxy.y > 0 && fxy.y < 720) {
        await page.mouse.click(fxy.x, fxy.y);
        await frames(3);
        check(await G(`${ff}.state === 'fuss'`), 'clicking the fox gives it a fuss');
    } else console.log('  --  the fox was out of view; skipped the click');

    // it leads you to a special place you haven't found
    const spot = await page.evaluate(async () => {
        const land = await import('./garden/js/forest-land.js');
        for (let r = 1; r < 30; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
            const f = land.featureIn(i, j);
            if (f && f.kind !== 'pond' && Math.hypot(f.x, f.z) > 120) return { x: f.x, z: f.z, r: f.r, kind: f.kind, key: `${i},${j}` };
        }
        return null;
    });
    check(spot, `there is a place to be led to (${spot?.kind})`);
    // stand 40 m off it; the fox finds you again and catches the scent
    await G(`(() => { const a = 0.7; g.controls.teleport(${spot.x} + Math.sin(a) * 40, ${spot.z} + Math.cos(a) * 40, 0); })()`);
    await until(`${ff}.state === 'lead'`, 120000);
    check(await G(`${ff}.lead.key === ${JSON.stringify(spot.key)}`), 'when a special place is near, the fox sets off to show you');
    await shot('10-fox-lead');
    // stay put: it stops to wait for you
    await until(`${ff}.waiting === true`, 120000);
    check(true, 'it stops and looks back when you fall behind');
    // follow it until you are there
    let found = false;
    for (let k = 0; k < 120 && !found; k++) {
        await G(`(() => { const f = ${ff}.fox.position; g.controls.walkTo([{ x: f.x, z: f.z }]); })()`);
        await frames(15);
        found = await G(`g.forest.log[${JSON.stringify(spot.kind)}] >= 1`);
    }
    check(found, 'following the fox brings you to the place');
    await frames(20);
    check(await G(`${ff}.state !== 'lead'`), 'and it stops leading once you have found it');
    await shot('11-fox-arrived');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
}

// ---------------------------------------------------------------- phone
if (!ONLY || ONLY === 'phone') {
    const { ctx, page, G, until, frames, shot } = await open({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.4`);
    await until('g?.entered', 240000);
    await G('g.throughDoor(true, "forest")');
    await until(inForest, 60000);
    await frames(30);
    await shot('7-phone');
    const p0 = await G('({ x: g.controls.pos.x, z: g.controls.pos.z })');
    await page.touchscreen.tap(250, 520);
    await frames(90);
    const p1 = await G('({ x: g.controls.pos.x, z: g.controls.pos.z })');
    check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5, 'a tap on the ground walks you there');
    const box = await page.locator('#forest-home').boundingBox();
    check(box && box.x >= 0 && box.x + box.width <= 390, 'the Step home button is on screen');
    await page.locator('#forest-home').tap();
    await until('!g.below', 30000);
    check(true, 'and the button takes you home');
    check(errors.length === 0, 'no errors: ' + errors.join(' | '));
    await ctx.close();
}

await browser.close();
console.log('foresttest: all passed');
