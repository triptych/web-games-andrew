/**
 * walktest.mjs — auto-walks and frame costs in the Garden, in real Chromium.
 *
 * Walks: from many seeded random spots on the island, click-to-walk (a straight
 * walk to a spot on the ground) and path walks (the route along the flagstone
 * paths that the Library's "Find statue" uses) to many others, stepping the real
 * controller with its colliders, sea and ledges until the walk ends. Every walk
 * must end, and every one must arrive: a walk that stops against a statue, a
 * hedge niche, a railing or the shore fails. Spots are only drawn where the
 * ground can be reached from the dock, so a walk that can't arrive is a bug.
 * Also: walks behind statue niches, a walk from the dock to the carousel, and
 * that a walk pressed into a door still ends at the door.
 *
 * Rendering: the sky's reflection refresh (every couple of seconds) must not
 * compile shaders or swap the environment texture, and the big merged meshes
 * must be split so the camera and the shadow map can cull them.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/walktest.mjs
 *
 * Env: BASE, THREE_PKG, PW_CHROMIUM_PATH (see browsertest.mjs), N (random pairs, default 120).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const N = Number(process.env.N || 120);
const errors = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAILED: ' + msg + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
    console.log('  ok  ' + msg);
};

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
    try {
        localStorage.clear();
    } catch {
        /* ignore */
    }
});
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
page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
    await page.goto(`${BASE}/index.html?debug=1&pr=0.25&bigdt&t=0.4&w=clear&fox=0`);
    await page.waitForSelector('#enter', { state: 'visible', timeout: 120000 });
    await page.waitForFunction(() => window.__garden, null, { timeout: 30000 });
    await page.click('#enter');
    await page.waitForFunction(() => window.__garden.entered, null, { timeout: 120000 });

    console.log('rendering');
    const r = await page.evaluate(() => {
        const g = window.__garden, R = g.renderer;
        const env0 = g.scene.environment, progs0 = R.info.programs.length;
        for (let i = 0; i < 3; i++) g.sky.refreshEnv();
        let marble = 0;
        g.scene.traverse((o) => {
            if (o.isMesh && o.name === 'statueMarble') marble++;
        });
        return { sameEnv: g.scene.environment === env0, progs0, progs1: R.info.programs.length, marble };
    });
    check(r.sameEnv, 'refreshing the sky reflections keeps the same environment texture');
    check(r.progs1 === r.progs0, `and compiles no shaders (${r.progs0} → ${r.progs1} programs)`);
    check(r.marble > 1, `the statues' marble is split into ${r.marble} meshes the camera can cull`);

    console.log('walks');
    const res = await page.evaluate((N) => {
        const g = window.__garden, w = g.world, c = g.controls, L = g.layout, nav = w.nav;
        let seed = 12345;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        const sp = L.spawn;
        const ground = (x, z) => {
            if (!w.onDeck(x, z) && w.island.heightAt(x, z) < 0.35) return false;
            for (const k of w.collidersNear(x, z)) if (Math.hypot(x - k.x, z - k.z) < k.r + 0.45) return false;
            return true;
        };
        // reachable from the dock: the grid's own path gets there (the controller still has to walk it)
        const reachable = (x, z) => {
            const p = nav.find(sp.x, sp.z, x, z);
            const e = p?.[p.length - 1];
            return !!e && Math.hypot(e.x - x, e.z - z) < 0.6;
        };
        const spot = () => {
            for (;;) {
                const x = (rnd() * 2 - 1) * L.islandR, z = (rnd() * 2 - 1) * L.islandR;
                if (ground(x, z) && reachable(x, z)) return { x, z };
            }
        };
        const pairs = [];
        for (let i = 0; i < N; i++) pairs.push([spot(), spot()]);
        const niches = [];
        for (const st of g.statues) {
            const a = st.rot + Math.PI;
            const t = { x: st.x + Math.sin(a) * 3.4, z: st.z + Math.cos(a) * 3.4 };
            if (ground(t.x, t.z) && reachable(t.x, t.z)) niches.push([{ x: st.pathX, z: st.pathZ }, t]);
        }
        const walk = (a, b, how) => {
            c.teleport(a.x, a.z, 0);
            c.enabled = true;
            let arrived = false;
            w.onArrive = () => (arrived = true);
            c.walkTo(how === 'path' ? c.plan(b.x, b.z) : [{ x: b.x, z: b.z }]);
            let t = 0;
            while (c.route && t < 300) {
                c.update(1 / 30);
                t += 1 / 30;
            }
            w.onArrive = null;
            const d = Math.hypot(c.pos.x - b.x, c.pos.z - b.z);
            return { ok: arrived || d < 0.6, ended: !c.route, d, at: { x: c.pos.x, z: c.pos.z } };
        };
        const run = (list, how) => {
            const out = { n: list.length, ok: 0, endless: 0, fails: [] };
            for (const [a, b] of list) {
                const o = walk(a, b, how);
                if (o.ok) out.ok++;
                else out.fails.push(`(${a.x.toFixed(1)}, ${a.z.toFixed(1)}) → (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) stopped at (${o.at.x.toFixed(1)}, ${o.at.z.toFixed(1)}), ${o.d.toFixed(1)} m short`);
                if (!o.ended) out.endless++;
            }
            return out;
        };
        const click = run(pairs, 'click');
        const path = run(pairs, 'path');
        const niche = run(niches, 'click');
        // a walk into the clock tower's door (inside its collider) still ends there
        const door = w.clockDoor;
        const out = door.out;
        c.teleport(out.x, out.z, out.yaw);
        c.walkTo([{ x: door.x, z: door.z }]);
        const doorPts = c.route.points.length;
        // the dock to the carousel, near enough to climb on (the click on a creature walks there this way)
        let carousel = null;
        if (g.carousel?.ok) {
            const ap = g.carousel.approach(sp.x, sp.z);
            const o = walk(sp, ap, 'path');
            carousel = { ok: o.ok, mountable: g.carousel.near(c.pos.x, c.pos.z, 8.3) };
        }
        // standing at the lighthouse's step, its door is a step away: no trip out to the paths and back
        const lh = w.lighthouse;
        c.teleport(lh.out.x, lh.out.z, 0);
        const lhPlan = c.plan(lh.out.x, lh.out.z).length;
        return { click, path, niche, doorPts, carousel, lhPlan };
    }, N);
    for (const [k, v] of Object.entries({ 'click-to-walk': res.click, 'path walk': res.path, 'walk behind a statue': res.niche })) {
        for (const f of v.fails.slice(0, 6)) console.log('      ' + f);
        check(v.endless === 0, `${k}: every walk ends (${v.n} walks)`);
        check(v.ok === v.n, `${k}: every walk arrives (${v.ok}/${v.n})`);
    }
    check(res.doorPts === 1, 'a walk straight into a door is left alone');
    check(res.lhPlan === 1, `a path walk to a spot in plain sight goes straight there (${res.lhPlan} legs)`);
    if (res.carousel) check(res.carousel.ok && res.carousel.mountable, 'a walk from the dock reaches the carousel, near enough to climb on');
    check(errors.length === 0, 'no console or page errors');
} finally {
    await browser.close();
}
