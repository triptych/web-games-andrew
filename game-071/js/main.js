/**
 * main.js — boot, modes and the frame loop.
 *
 * loading → title → (create) → play ⇄ menus. The simulation ticks at a fixed 60 Hz; the view,
 * audio and UI drain the world's event queue once per frame.
 */
import { DEBUG, FAST, FORCE_Q, IS_TOUCH } from './config.js';
import { Terrain, terrainFromData } from './sim/terrain.js';
import { World } from './sim/world.js';
import { WorldView } from './view/worldview.js';
import { Input } from './input.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 60;

const app = {
    mode: 'loading',
    world: null,
    view: null,
    input: null,
    acc: 0,
    fps: 60,
    frames: 0,
    fpsT: 0,
};
window.__fm = app;

function setLoad(p, msg) {
    $('load-bar').style.width = `${Math.round(p * 100)}%`;
    if (msg) $('load-msg').textContent = msg;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function generateTerrain() {
    return new Promise((resolve) => {
        let worker;
        try { worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' }); } catch { worker = null; }
        if (!worker) { resolve(new Terrain().generate()); return; }
        let done = false;
        worker.onmessage = (e) => {
            if (e.data.progress != null) setLoad(e.data.progress * 0.6, 'Carving the mountains…');
            if (e.data.done) { done = true; worker.terminate(); resolve(terrainFromData(e.data.data)); }
        };
        worker.onerror = () => { if (!done) { worker.terminate(); resolve(new Terrain().generate()); } };
        worker.postMessage('go');
    });
}

async function boot() {
    document.body.classList.toggle('touch', IS_TOUCH);
    setLoad(0.02, 'Carving the mountains…');
    const terrain = await generateTerrain();
    setLoad(0.62, 'Raising the sky…');
    await nextFrame();
    const world = new World({ terrain });
    app.world = world;
    const view = new WorldView($('gl'), world);
    app.view = view;
    const tier = FORCE_Q ?? (IS_TOUCH ? 2 : 1);
    view.r.setTier(tier, false);
    let k = 0;
    for (const step of view.buildSteps()) {
        k++;
        setLoad(0.62 + k * 0.1, `Building the ${step}…`);
        await nextFrame();
    }
    view.setTier(tier);
    app.input = new Input($('gl'));
    if (IS_TOUCH) app.input.bindTouch($('touch'));
    app.input.onUnlock = () => { /* pause menu later */ };

    world.placeAt('pinebrook', 0, -30);
    world.time.hour = 9.5;
    // warm the terrain cache before the first frame
    view.update(0.016);
    setLoad(1, 'Ready');
    await nextFrame();
    $('loading').classList.add('hidden');
    startPlay();
    requestAnimationFrame(frame);
}

function startPlay() {
    app.mode = 'play';
    $('hud').classList.remove('hidden');
    if (IS_TOUCH) $('touch').classList.remove('hidden');
    document.body.classList.add('playing');
    app.input.wantLock = !IS_TOUCH;
}

let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const rdt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const dt = Math.min(rdt, 0.05);
    const { world, view, input } = app;
    // fps
    app.frames++; app.fpsT += rdt;
    if (app.fpsT > 0.5) { app.fps = app.frames / app.fpsT; app.frames = 0; app.fpsT = 0; }

    const snap = input.consume(dt);
    if (app.mode === 'play') {
        app.acc += dt * FAST;
        let first = true, steps = 0;
        while (app.acc >= STEP && steps < 4 * FAST) {
            world.tick(STEP, first ? snap : { ...snap, look: { dx: 0, dy: 0 }, pressed: new Set(), released: new Set() });
            first = false;
            app.acc -= STEP; steps++;
        }
        if (steps >= 4 * FAST) app.acc = 0;
    }
    world.drain();
    view.update(dt, { wheel: snap.wheel });
    view.render(dt);
    if (DEBUG) {
        const p = world.player;
        $('debug-info').classList.remove('hidden');
        $('debug-info').textContent = `${app.fps.toFixed(0)} fps  tier ${view.r.tier}  nodes ${view.terrainView.visibleCount}  calls ${view.r.gl.info.render.calls}  tris ${(view.r.gl.info.render.triangles / 1000).toFixed(0)}k\n` +
            `pos ${p.pos.x.toFixed(1)} ${p.pos.y.toFixed(1)} ${p.pos.z.toFixed(1)}  ${world.region}  ${world.time.hour.toFixed(2)}h  ${world.weather.type}`;
    }
}

boot().catch((e) => {
    console.error(e);
    $('load-msg').textContent = 'Something went wrong: ' + e.message;
});
