/**
 * shiptest.mjs — the pirate wharf and the Black Nocturne, in real Chromium.
 *
 * The wharf stands below the Delvers' Descent pavilion (the dungeon path's end),
 * is longer and wider than the fishing pier, and the galleon lies along it in
 * deep water. She rocks on the swell. Her decks are floors you can walk on: the
 * walk from the foot of the wharf over the gangplank and up the stairs to the
 * wheel arrives, and standing behind the wheel casts her off. She backs out
 * and swings round, then the helm is ours: the sails and the rudder answer, and
 * she never sails onto land (driven straight at the shore she stops). Esc
 * brings her home to the exact berth with the player at the wheel, and doesn't
 * cast off again until the player has stepped away; so does backing away
 * (holding S with the sails furled). At night her lamps, windows and lights come on.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/shiptest.mjs
 *
 * Env: BASE, THREE_PKG, PW_CHROMIUM_PATH (see browsertest.mjs). Screenshots → garden/dev/shots/.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const OUT = path.join(HERE, 'shots');
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

const until = (fn, label, timeout = 240000, arg) => page.waitForFunction(fn, arg, { timeout, polling: 500 }).catch(() => {
    throw new Error('TIMED OUT: ' + label + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
});
const snap = (name) => page.screenshot({ path: path.join(OUT, `ship-${name}.png`), timeout: 180000 });

try {
    await page.goto(`${BASE}/index.html?debug=1&pr=0.25&bigdt&t=0.4&w=clear&fox=0`);
    await page.waitForSelector('#enter', { state: 'visible', timeout: 240000 });
    await page.waitForFunction(() => window.__garden, null, { timeout: 30000 });
    await page.click('#enter');
    await page.waitForFunction(() => window.__garden.entered, null, { timeout: 240000 });

    console.log('the wharf and her berth');
    const r = await page.evaluate(() => {
        const g = window.__garden, L = g.layout, w = g.world.wharf, s = g.ship, I = g.island;
        const pv = w.spoke.pavilion;
        const hull = [[0, -12.5], [0, 12.5], [-3.7, 0], [3.7, 0], [-2.2, -9], [2.8, 9]].map(([lx, lz]) => {
            const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
            return I.heightAt(s.pos.x + lx * c + lz * sn, s.pos.z - lx * sn + lz * c);
        });
        const eye = w.toW(0, w.rampEnd + 3);
        return {
            genre: w.spoke.genre.id, pierLen: L.pier.length, wharfLen: w.length, headHalf: w.headHalf,
            fromPavilion: Math.hypot(w.ax - pv.x, w.az - pv.z), hull, spans: g.world.spans.length,
            lamps: g.world.lampSpots.filter((l) => Math.hypot(l.x - w.ax, l.z - w.az) < w.length + 8).length,
            onDeck: g.world.onDeck(eye.x, eye.z), landmark: g.world.landmarks.some((l) => l.name === 'The Pirate Wharf'), mode: s.mode,
        };
    });
    check(r.genre === 'dungeon', "the wharf leaves the Delvers' Descent, the dungeons and roguelikes path");
    check(r.fromPavilion < 20, `and starts at the pavilion (${r.fromPavilion.toFixed(1)} m from its centre)`);
    check(r.wharfLen > r.pierLen * 2 && r.headHalf > 4, `it is far longer and wider than the fishing pier (${r.wharfLen.toFixed(0)} m against ${r.pierLen.toFixed(0)} m)`);
    check(r.onDeck && r.landmark, 'its deck is walkable and it is on the map');
    check(r.hull.every((h) => h < -1.6), 'the galleon lies in deep water along it');
    check(r.lamps >= 6, `the wharf has ${r.lamps} lamps for the night`);

    console.log('rocking');
    const rock = await page.evaluate(async () => {
        const s = window.__garden.ship;
        const roll = [], pitch = [], heave = [];
        for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 250));
            roll.push(s.roll); pitch.push(s.pitch); heave.push(s.heave);
        }
        const span = (a) => Math.max(...a) - Math.min(...a);
        return { roll: span(roll), pitch: span(pitch), heave: span(heave), maxRoll: Math.max(...roll.map(Math.abs)) };
    });
    check(rock.roll > 0.01 && rock.pitch > 0.005 && rock.heave > 0.05, `she rocks on the swell (roll ${(rock.roll * 57.3).toFixed(1)}°, pitch ${(rock.pitch * 57.3).toFixed(1)}°, heave ${rock.heave.toFixed(2)} m)`);
    check(rock.maxRoll < 0.12, 'but only a bit (never more than 7° of roll)');

    console.log('walking aboard');
    await page.evaluate(() => {
        const g = window.__garden, w = g.world.wharf;
        g.controls.teleport(w.stand.x, w.stand.z, w.stand.yaw);
        g.controls.enabled = true;
    });
    // the click target: a ray that meets her proxy boxes gives a distance, and the API tells a ship from the sea
    const hit = await page.evaluate(() => window.__garden.ship.pick({ intersectObjects: (objs) => (objs.length ? [{ distance: 12 }] : []) }));
    check(hit === 12, 'clicking the ship picks her');
    await page.evaluate(() => {
        const g = window.__garden;
        g.controls.walkTo(g.ship.route(g.controls));
    });
    await until(() => {
        const g = window.__garden;
        return g.ship.onBoard(g.controls.pos.x, g.controls.pos.z);
    }, 'the walk reaches her deck');
    check(true, 'the walk from the foot of the wharf crosses the gangplank onto her deck');
    const onBoard = await page.evaluate(() => {
        const g = window.__garden, s = g.ship, c = g.controls;
        return { y: c.pos.y, floor: s._floorAt(c.pos.x, c.pos.z), deck: g.world.walkHeight(c.pos.x, c.pos.z), mode: s.mode };
    });
    check(onBoard.mode === 'docked' && Math.abs(onBoard.y - onBoard.floor) < 0.8, 'she is moored and the player stands on her deck');
    await snap('aboard');
    await until(() => window.__garden.ship.mode !== 'docked', 'standing behind the wheel casts her off', 300000);
    check(true, 'the walk goes up the stairs and behind the wheel, and she casts off');
    const cast = await page.evaluate(() => {
        const g = window.__garden, s = g.ship, c = g.controls;
        return { seated: c.seated, mode: s.mode };
    });
    check(cast.seated && cast.mode === 'castoff', 'the player is at the wheel');
    await until(() => window.__garden.ship.mode === 'sail', 'she backs out and swings round', 300000);
    const out = await page.evaluate(() => {
        const g = window.__garden, s = g.ship, w = g.world.wharf;
        const d = s.yaw - w.berth.yaw - Math.PI; // facing the sea is a half turn from her berth heading
        const turn = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
        return { dist: Math.hypot(s.pos.x - w.berth.x, s.pos.z - w.berth.z), turn, plank: s.plankK, blocked: s._blocked(s.pos.x, s.pos.z, s.yaw, true) };
    });
    check(out.dist > 12 && out.turn < 0.2 && out.plank < 0.1, `she has backed out and turned her bow to the sea (${out.dist.toFixed(0)} m off, gangplank in)`);
    check(!out.blocked, 'in open water');
    await snap('helm');

    console.log('sailing');
    await page.evaluate(() => {
        window.__garden.ship.input.up = true;
    });
    await until(() => window.__garden.ship.speed > 6, 'the sails drive her', 120000);
    const yaw0 = await page.evaluate(() => window.__garden.ship.yaw);
    await page.evaluate(() => {
        window.__garden.ship.input.left = true;
    });
    await until((y) => Math.abs(window.__garden.ship.yaw - y) > 0.5, 'the helm turns her', 120000, yaw0);
    check(true, 'the sails and the rudder answer the helm');
    await page.evaluate(() => {
        const i = window.__garden.ship.input;
        i.left = false;
        i.up = false;
    });
    await snap('sailing');

    console.log('shoals');
    // drive her straight at a distant shore: she must stop in deep water, never on land
    const shoal = await page.evaluate(() => {
        const g = window.__garden, s = g.ship, I = g.island;
        const sp = g.layout.spokes[0];
        const a = Math.atan2(sp.pavilion.x, sp.pavilion.z);
        let r = 500;
        while (r > 0 && I.heightAt(Math.sin(a) * r, Math.cos(a) * r) < 0) r -= 1; // the shore on that bearing
        const start = r + 45;
        s.pos.x = Math.sin(a) * start;
        s.pos.z = Math.cos(a) * start;
        s.yaw = a; // the bow toward the island's centre
        s.speed = 8;
        s.sail = 1;
        s.input.up = true;
        window.__worstShoal = -99;
        window.__shoalWatch = setInterval(() => {
            window.__worstShoal = Math.max(window.__worstShoal, I.heightAt(s.pos.x, s.pos.z));
        }, 100);
        return { shore: r, start };
    });
    await until(() => window.__garden.ship.speed < 0.5, 'she grinds to a halt at the shoals', 240000);
    const stopped = await page.evaluate(() => {
        const s = window.__garden.ship, I = window.__garden.island;
        clearInterval(window.__shoalWatch);
        s.input.up = false;
        return { worst: window.__worstShoal, r: Math.hypot(s.pos.x, s.pos.z), h: I.heightAt(s.pos.x, s.pos.z) };
    });
    check(stopped.worst < -1.4 && stopped.h < -1.5, `driven at the shore she stops in deep water (${stopped.r.toFixed(0)} m from the centre, the shore at ${shoal.shore} m)`);

    console.log('coming home');
    await page.keyboard.press('Escape');
    await until(() => window.__garden.ship.mode === 'return', 'Esc sends her home', 20000);
    check(true, 'Esc hands her to the autopilot');
    await until(() => window.__garden.ship.mode === 'docked', 'she moors', 480000);
    const home = await page.evaluate(() => {
        const g = window.__garden, s = g.ship, c = g.controls, w = g.world.wharf, h = s.helm;
        return { off: Math.hypot(s.pos.x - w.berth.x, s.pos.z - w.berth.z), yaw: Math.abs(Math.atan2(Math.sin(s.yaw - w.berth.yaw), Math.cos(s.yaw - w.berth.yaw))), seated: c.seated, enabled: c.enabled, near: Math.hypot(c.pos.x - h.x, c.pos.z - h.z), plank: s.plankK };
    });
    check(home.off < 0.2 && home.yaw < 0.05, 'she lies at her berth again, bow to the shore');
    check(!home.seated && home.enabled && home.near < 0.5, 'and the player is standing at the wheel, free to walk');
    await page.waitForTimeout(3000);
    check((await page.evaluate(() => window.__garden.ship.plankK)) > 0.9, 'the gangplank goes back out');
    await page.waitForTimeout(3000);
    check((await page.evaluate(() => window.__garden.ship.mode)) === 'docked', 'standing at the wheel does not cast her off again until you step away');
    await snap('home');

    console.log('backing away');
    await page.evaluate(() => {
        const g = window.__garden, s = g.ship, h = s.helm;
        const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
        g.controls.teleport(h.x - 3 * sn, h.z - 3 * c, s.yaw); // three steps forward of the wheel
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
        const g = window.__garden, s = g.ship, h = s.helm;
        g.controls.teleport(h.x, h.z, s.yaw);
    });
    await until(() => window.__garden.ship.mode === 'castoff', 'stepping back up to the wheel casts her off again', 60000);
    await until(() => window.__garden.ship.mode === 'sail', 'out again', 300000);
    await page.evaluate(() => {
        window.__garden.ship.input.down = true;
    });
    await until(() => window.__garden.ship.mode === 'return', 'backing away (S, sails furled) sends her home', 120000);
    check(true, 'backing away from the wheel (S with the sails furled) brings her home too');
    await page.evaluate(() => {
        window.__garden.ship.input.down = false;
    });
    await until(() => window.__garden.ship.mode === 'docked', 'she moors again', 480000);

    console.log('night');
    await page.evaluate(() => {
        const g = window.__garden;
        g.sky.setTime(0.95);
        g.controls.enabled = false;
    });
    await page.waitForTimeout(6000);
    const night = await page.evaluate(() => {
        const s = window.__garden.ship;
        return { lamp: s.mats.lamp.emissiveIntensity, ecto: s.mats.ecto.emissiveIntensity, glass: s.glassMats[0].emissiveIntensity, lights: s.lights.map((l) => l.intensity), night: window.__garden.sky.state.night };
    });
    // (the ghost lights pulse between 70% and 100% of full, so allow for the dip)
    check(night.night > 0.8 && night.lamp > 2 && night.ecto > 2 && night.glass > 1.8, 'at night her lanterns, ghost lights and stained glass glow');
    check(night.lights.every((v) => v > 4), `and her two lights burn (${night.lights.map((v) => v.toFixed(0)).join(', ')})`);
    await snap('night');

    check(errors.length === 0, 'no console or page errors');
    console.log('\nship tests passed');
} catch (e) {
    console.error(e.message);
    await snap('failure').catch(() => {});
    process.exitCode = 1;
} finally {
    await browser.close();
}
