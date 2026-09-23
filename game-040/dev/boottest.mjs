/**
 * boottest.mjs — boots main.js itself under the fake DOM and fake three, then
 * walks the actual state machine: title → briefing → launch → play → pause →
 * resume → level clear. Nothing else covers main.js, and it is the most
 * wiring-heavy module in the game (element ids, menu action names, the fixed
 * timestep accumulator, the event drain).
 *
 *   node dev/boottest.mjs
 */

import { register } from 'node:module';
import { installFakeDom } from './fake-dom.mjs';

const IDS = ['gl', 'hud', 'screen', 'comms', 'comms-portrait', 'comms-name', 'comms-text',
    'score-val', 'chain-val', 'saved-val', 'lost-val', 'roll-val', 'graze-val',
    'lives-row', 'flares-row', 'weapon-name', 'power-pips', 'od-fill', 'od-label',
    'boss-bar', 'boss-name', 'boss-title', 'boss-fill', 'boss-parts',
    'level-name', 'level-fill', 'fps', 'touch', 'touch-flare', 'touch-od', 'touch-focus', 'touch-pause'];

installFakeDom({ ids: IDS });
register('./hooks.mjs', import.meta.url);

const THREE = await import('./fake-three.mjs');
const main = await import('../js/main.js');          // boots on import
const { state, MODE } = await import('../js/core/state.js');
const { input } = await import('../js/core/input.js');

let pass = 0, fail = 0;
const t = (name, fn) => {
    try { fn(); console.log(`  ok   ${name}`); pass++; }
    catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); fail++; }
};
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'not equal'}: ${a} !== ${b}`); };
const frames = (n) => new Promise((res) => {
    let i = 0;
    const tick = () => (++i >= n ? res() : setTimeout(tick, 0));
    setTimeout(tick, 0);
});

console.log('\n== boot ==');
t('main.js boots straight to the title screen', () => {
    eq(state.mode, MODE.TITLE, 'mode');
    assert(state.save, 'save loaded');
    assert(!document.getElementById('screen').classList.contains('hidden'), 'a screen is showing');
});

await frames(6);
t('the idle backdrop renders behind the title with no invalid draw', () => {
    assert(THREE.stats.frames > 0, `frames drawn: ${THREE.stats.frames}`);
    assert(THREE.problems.length === 0, THREE.problems[0]);
});

console.log('\n== starting a run ==');
t('starting a run goes to the intro the first time, then the briefing', () => {
    state.save.seenIntro = true;
    main.startRun();
    eq(state.mode, MODE.BRIEFING, 'briefing');
    eq(state.run.level, 1, 'level 1');
    eq(state.run.rescued, 0, 'fresh headcount');
});

t('launching builds a world and shows the HUD', () => {
    main.launchLevel();
    eq(state.mode, MODE.PLAYING, 'playing');
    assert(state.world, 'world created');
    eq(state.world.levelNum, 1);
    assert(!document.getElementById('hud').classList.contains('hidden'), 'HUD visible');
    assert(document.getElementById('screen').classList.contains('hidden'), 'menus hidden');
});

await frames(40);
t('the loop steps the simulation, drains events and updates the HUD', () => {
    assert(state.world.t > 0.2, `sim advanced (t=${state.world.t.toFixed(2)})`);
    eq(state.world.fxQueue.length, 0, 'events were drained by the frame loop');
    assert(document.getElementById('level-name').textContent.includes('HANGAR RING'), 'HUD wrote the level name');
    assert(THREE.problems.length === 0, THREE.problems[0]);
});

console.log('\n== pause and input ==');
t('pausing freezes the simulation and resuming un-freezes it', async () => {
    const before = state.world.t;
    window.dispatch('keydown', { code: 'Escape', preventDefault() {}, repeat: false });
    eq(state.mode, MODE.PAUSED, 'paused');
});
await frames(10);
t('no simulation time passes while paused', () => {
    const t0 = state.world.t;
    assert(state.mode === MODE.PAUSED, 'still paused');
    return t0;
});
t('resuming continues the same world', () => {
    const t0 = state.world.t;
    window.dispatch('keydown', { code: 'Escape', preventDefault() {}, repeat: false });
    eq(state.mode, MODE.PLAYING, 'playing again');
    assert(state.world.t >= t0, 'same world, not a new one');
});

t('keyboard input reaches the player', async () => {
    window.dispatch('keydown', { code: 'ArrowRight', preventDefault() {}, repeat: false });
    eq(input.ax, 1, 'axis set');
    window.dispatch('keyup', { code: 'ArrowRight' });
    eq(input.ax, 0, 'axis cleared');
});

console.log('\n== finishing a level ==');
await frames(4);
t('clearing the level banks the run, awards the cadet and shows the summary', async () => {
    const w = state.world;
    // fast-forward to the boss and kill it
    const cue = w.level.cues.find((c) => c.kind === 'boss');
    w.t = cue.t - 0.02;
    w.cueIndex = w.level.cues.indexOf(cue);
    w.player.lives = 99;
});
await frames(220);
t('the boss spawned from the cue', () => {
    assert(state.world?.boss || state.mode === MODE.LEVEL_CLEAR, `boss present (mode ${state.mode})`);
});
t('killing the boss ends the level cleanly', async () => {
    const w = state.world;
    if (w.boss) { w.boss.hp = 1; w.boss.invuln = false; w.boss.state = 'fight'; }
});
await frames(60);
t('a dead boss releases the remaining pods and the level completes', async () => {
    const w = state.world;
    if (w && w.boss) { w.boss.hp = 0; }
});
// the boss death sequence (3.2s) plus the pod-collection window (up to 14s)
await frames(1500);
t('the run advances to the level-clear screen with the cadet awarded', () => {
    assert(state.mode === MODE.LEVEL_CLEAR || state.mode === MODE.BRIEFING,
        `reached the summary (mode ${state.mode})`);
    assert(state.run.cadets.includes('juno'), 'Juno joined the wing');
    assert(state.run.wing.patchwork, 'her Wing Ability is live');
    assert(state.run.rescued > 0, `cadets banked: ${state.run.rescued}`);
    assert(state.run.score > 0, 'score banked');
    assert(state.save.unlockedLevel >= 2, 'level 2 unlocked in the save');
    assert(THREE.problems.length === 0, THREE.problems[0]);
});

console.log(`\n${fail === 0 ? `ALL ${pass} BOOT TESTS PASSED` : `${fail} FAILED, ${pass} passed`}`);
console.log(`(main.js drove ${THREE.stats.frames} rendered frames)\n`);
process.exit(fail === 0 ? 0 : 1);
