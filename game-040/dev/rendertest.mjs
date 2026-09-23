/**
 * rendertest.mjs — runs the REAL view layer (scene, models, instanced bullets,
 * backdrops, fx, HUD, comms, menus) against the strict fake three.js and a
 * strict fake Canvas2D.
 *
 * The fake throws on a non-finite position or scale, an undefined colour, a
 * disposed material still in the scene, and an out-of-range instance write — so
 * this is a real test of the rendering code, not a smoke test of imports.
 *
 *   node dev/rendertest.mjs
 */

import { register } from 'node:module';
import { installFakeDom, resizeWindow, canvasOps, resetCanvasOps } from './fake-dom.mjs';

const HUD_IDS = ['gl', 'hud', 'screen', 'comms', 'comms-portrait', 'comms-name', 'comms-text',
    'score-val', 'chain-val', 'saved-val', 'lost-val', 'roll-val', 'graze-val',
    'lives-row', 'flares-row', 'weapon-name', 'power-pips', 'od-fill', 'od-label',
    'boss-bar', 'boss-name', 'boss-title', 'boss-fill', 'boss-parts',
    'level-name', 'level-fill', 'fps', 'touch', 'touch-flare', 'touch-od', 'touch-focus', 'touch-pause'];

installFakeDom({ ids: HUD_IDS });
register('./hooks.mjs', import.meta.url);

const THREE = await import('./fake-three.mjs');
const { initScene, screenToWorld, renderer, scene, camera, composer } = await import('../js/view/scene.js');
const sceneMod = await import('../js/view/scene.js');
const { initRender, renderWorld, setLevelVisuals, handleFxEvent, resetRender } = await import('../js/view/render.js');
const { initHud, updateHud, showHud } = await import('../js/ui/hud.js');
const { initComms, updateComms, say, clearComms } = await import('../js/ui/comms.js');
const menus = await import('../js/ui/menus.js');
const { createWorld, stepWorld } = await import('../js/sim/world.js');
const { newRun, addCadet } = await import('../js/core/state.js');
const { CADETS } = await import('../js/sim/story.js');
const { loadSave } = await import('../js/core/save.js');
const { TICK, ARENA } = await import('../js/core/config.js');

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log(`  ok   ${name}`); pass++; }
    catch (err) { console.log(`  FAIL ${name}\n       ${err.message}`); fail++; }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'not equal'}: ${a} !== ${b}`); };

console.log('\n== boot ==');
t('the scene, bloom composer and render layer initialise', () => {
    initScene(document.getElementById('gl'));
    initRender();
    initHud();
    initComms();
    menus.initMenus({});
    assert(sceneMod.renderer, 'renderer created');
    assert(sceneMod.composer.passes.length === 2, 'render pass + bloom pass');
    assert(sceneMod.camera.projectionUpdates > 0, 'projection matrix was updated');
});

console.log('\n== the whole game, rendered ==');

const NO_INPUT = { ax: 0, ay: 0, focus: false, fire: true, flare: false, od: false, pointer: { active: false, x: 0, y: 0 } };

function playLevel(level, { seconds = 40, atBoss = false, difficulty = 'pilot' } = {}) {
    const run = newRun(difficulty, level);
    for (const c of CADETS.filter((c) => c.level < level)) addCadet(run, c);
    const world = createWorld({ level, run, seed: `render${level}` });
    setLevelVisuals(world.level);
    if (atBoss) {
        const cue = world.level.cues.find((c) => c.kind === 'boss');
        world.t = cue.t - 0.05;
        world.cueIndex = world.level.cues.indexOf(cue);
    }
    world.player.lives = 99;
    world.player.power = 3;

    const frameDt = 1 / 60;
    const frames = Math.round(seconds / frameDt);
    for (let f = 0; f < frames; f++) {
        const inp = { ...NO_INPUT, ax: Math.sin(f / 40), ay: Math.cos(f / 55) * 0.5,
                      focus: f % 180 < 30, flare: f % 900 === 0, od: f % 1200 === 0 };
        let acc = frameDt;
        while (acc >= TICK) { stepWorld(world, inp, TICK); acc -= TICK; inp.flare = false; inp.od = false; }
        for (const ev of world.fxQueue) handleFxEvent(ev, world);
        world.fxQueue.length = 0;
        updateHud(world, run);
        updateComms(frameDt);
        renderWorld(world, frameDt);
        if (world.phase === 'failed') { world.player.lives = 99; world.phase = 'wave'; }
    }
    return world;
}

for (const level of [1, 2, 3, 4, 5, 6]) {
    t(`level ${level} waves render for 40s with no invalid draw`, () => {
        THREE.resetStats();
        const world = playLevel(level, { seconds: 40 });
        assert(THREE.stats.frames > 2000, `frames rendered: ${THREE.stats.frames}`);
        assert(THREE.stats.instanced > 0, 'bullets were written to instanced meshes');
        assert(THREE.problems.length === 0, THREE.problems[0]);
        resetRender();
    });
}

for (const level of [1, 3, 6]) {
    t(`level ${level} boss fight renders (phases, telegraphs, parts, death)`, () => {
        THREE.resetStats();
        const world = playLevel(level, { seconds: 70, atBoss: true, difficulty: 'ace' });
        assert(world.boss || world.phase === 'clear' || world.phase === 'done', 'the boss actually spawned');
        assert(THREE.stats.maxDraws > 20, `scene has real content (${THREE.stats.maxDraws} draws)`);
        assert(THREE.problems.length === 0, THREE.problems[0]);
        resetRender();
    });
}

console.log('\n== camera & resize ==');

t('screenToWorld maps the screen centre to the middle of the arena', () => {
    const c = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    assert(Math.abs(c.x) < 0.5, `centre x ${c.x.toFixed(2)}`);
    assert(Math.abs(c.y) < 4, `centre y ${c.y.toFixed(2)}`);
});

t('the whole arena is reachable by pointer at desktop and phone aspect ratios', () => {
    for (const [w, h] of [[1920, 1080], [1280, 720], [390, 844], [844, 390], [768, 1024]]) {
        resizeWindow(w, h);
        const left = screenToWorld(0, h / 2);
        const right = screenToWorld(w, h / 2);
        const top = screenToWorld(w / 2, 0);
        const bottom = screenToWorld(w / 2, h);
        assert(left.x <= ARENA.left + 0.5, `${w}x${h}: left edge reachable (${left.x.toFixed(1)})`);
        assert(right.x >= ARENA.right - 0.5, `${w}x${h}: right edge reachable (${right.x.toFixed(1)})`);
        assert(top.y >= ARENA.top - 1.5, `${w}x${h}: top reachable (${top.y.toFixed(1)})`);
        assert(bottom.y <= ARENA.bottom + 1.5, `${w}x${h}: bottom reachable (${bottom.y.toFixed(1)})`);
    }
    resizeWindow(1280, 720);
});

t('resizing updates the camera, the renderer AND the bloom composer', () => {
    const before = sceneMod.composer.sized;
    resizeWindow(1024, 640);
    eq(sceneMod.renderer.width, 1024, 'renderer resized');
    assert(sceneMod.composer.sized > before, 'composer resized alongside it');
    assert(Math.abs(sceneMod.camera.aspect - 1024 / 640) < 1e-6, 'camera aspect updated');
    resizeWindow(1280, 720);
});

console.log('\n== HUD, comms, menus ==');

t('the HUD writes the headcount, weapon pips and boss bar', () => {
    const run = newRun('pilot', 3);
    const world = createWorld({ level: 3, run, seed: 'hud' });
    world.stats.cadets = 42;
    world.stats.cadetsLost = 3;
    world.player.power = 4;
    updateHud(world, run);
    eq(document.getElementById('saved-val').textContent, '42', 'saved count');
    eq(document.getElementById('lost-val').textContent, '3', 'lost count');
    eq(document.getElementById('weapon-name').textContent, 'VULCAN');
    eq(document.getElementById('power-pips').children.length, 5, 'five power pips');
    assert(document.getElementById('boss-bar').classList.contains('hidden'), 'boss bar hidden with no boss');
});

t('comms draws a procedural portrait for every speaker without a canvas error', () => {
    resetCanvasOps();
    clearComms();
    for (const id of ['l1_open', 'l1_hook', 'l2_open', 'l3_people', 'l4_open', 'l5_kel_voice',
                      'kel_fighting_it', 'l6_boss', 'pod_streak']) {
        say(id);
        updateComms(0.1);
        updateComms(9);          // run the line out so the next one starts
    }
    assert(canvasOps.calls > 50, `portrait canvas was actually drawn (${canvasOps.calls} ops)`);
    assert((canvasOps.byOp.ellipse ?? 0) > 5, 'helmet/visor geometry drawn');
});

t('every menu screen renders', () => {
    const save = loadSave();
    save.unlockedLevel = 4;
    const run = newRun('pilot', 3);
    for (const c of CADETS.slice(0, 2)) addCadet(run, c);
    menus.showTitle(save);
    menus.showIntro();
    menus.showLevelSelect(save);
    menus.showBriefing(3, run);
    menus.showPause(run);
    menus.showOptions(save, { fromPause: true });
    menus.showLevelClear({ level: 3, name: 'THE RING YARDS', score: 12345, bonus: 500, rescued: 30,
        lost: 2, cadets: 70, cadetsLost: 4, budget: 38, kills: 120, graze: 400, deaths: 1,
        maxChain: 12, rank: 'A', cleared: true }, run, CADETS[2]);
    menus.showGameOver(run, { canContinue: true });
    run.rescued = 205;
    menus.showEnding(run);
    menus.showRoll(save);
    menus.hideScreens();
    assert(true);
});

console.log('\n== resource hygiene ==');

t('resetRender frees pooled meshes and the scene does not grow run to run', () => {
    THREE.resetStats();
    playLevel(2, { seconds: 12 });
    resetRender();
    const after1 = countScene();
    playLevel(4, { seconds: 12 });
    resetRender();
    const after2 = countScene();
    assert(Math.abs(after2 - after1) <= 2, `scene size is stable across runs (${after1} -> ${after2})`);
    assert(THREE.problems.length === 0, THREE.problems[0]);
});

function countScene() {
    let n = 0;
    sceneMod.scene.traverse(() => n++);
    return n;
}

console.log(`\n${fail === 0 ? `ALL ${pass} RENDER TESTS PASSED` : `${fail} FAILED, ${pass} passed`}`);
console.log(`(fake-three saw ${THREE.stats.frames} frames, max ${THREE.stats.maxDraws} draws/frame)\n`);
process.exit(fail === 0 ? 0 : 1);
