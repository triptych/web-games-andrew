// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// A game is the road home: four marches on foot and the Dragonbane (Act I, js/sim/ground.js),
// then the dragon's wings return and three flight stages finish it (Act II, js/sim/flight.js).
// Each stage runs intro → play → clear; the boss's clear runs into the ascent; a dragon with no
// scales left is dead, then over. Winning offers another, fiercer cycle through the kingdom.

import { SCALES } from '../config.js';
import { STAGES, BEATS } from './data.js';
import { makeRng } from '../rng.js';
import { initGround, stepGround } from './ground.js';
import { initFlight, stepFlight } from './flight.js';

export function newGame(seed = 1, { stage = 0, loop = 0 } = {}) {
    const G = {
        v: 1,                       // save format version
        seed: seed | 0,
        rng: makeRng(seed),
        t: 0,
        score: 0,
        scales: SCALES,
        loop,
        stageIdx: 0,
        stageScore: 0,
        stageKills: 0,
        kills: 0,
        hits: 0,
        continues: 0,
        mode: 'ground',
        phase: 'intro',
        phaseT: 0,
        player: { x: 0, z: 0, h: 0, speed: 0, cd: 0, inv: 0, bumpT: 0, px: 0, py: 0, ax: 0, ay: 0, vx: 0, vy: 0 },
        enemies: [],
        shots: [],
        foes: [],
        fl: null,
        nextId: 0,
        spawnT: 0,
        wispT: 0,
        firstSpawn: true,
        over: false,
        won: false,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    startStage(G, stage, true);
    return G;
}

/** Begin stage idx: clear the field and set its opening beat. */
export function startStage(G, idx, fresh = false) {
    const def = STAGES[idx];
    G.stageIdx = idx;
    G.mode = def.mode;
    G.phase = 'intro';
    G.phaseT = BEATS.intro;
    G.stageKills = 0;
    G.stageScore = G.score;
    G.enemies.length = 0;
    G.shots.length = 0;
    G.foes.length = 0;
    if (def.mode === 'ground') { G.fl = null; initGround(G, fresh); }
    else initFlight(G);
    G.events.push({ type: 'stage', stage: idx, id: def.id, mode: def.mode });
}

function advancePhase(G) {
    switch (G.phase) {
        case 'intro':
            G.phase = 'play';
            G.events.push({ type: 'go', stage: G.stageIdx });
            break;
        case 'clear': {
            const def = STAGES[G.stageIdx];
            if (def.boss) {
                G.phase = 'ascend';
                G.phaseT = BEATS.ascend;
                G.scales = SCALES;
                G.enemies.length = 0; G.foes.length = 0; G.shots.length = 0;
                G.events.push({ type: 'ascend' });
            } else if (G.stageIdx === STAGES.length - 1) victory(G);
            else startStage(G, G.stageIdx + 1);
            break;
        }
        case 'ascend':
            startStage(G, G.stageIdx + 1);
            break;
        case 'dead':
            G.over = true;
            G.events.push({ type: 'over', won: false, score: G.score });
            break;
    }
}

function victory(G) {
    const bonus = G.scales * 5000 * (G.loop + 1);
    G.score += bonus;
    G.won = true;
    G.over = true;
    G.events.push({ type: 'victory', bonus, loop: G.loop });
    G.events.push({ type: 'over', won: true, score: G.score });
}

/** Advance one fixed step. inp = { x, y, a, abs, turn }: x, y in [-1, 1] (y down), a = fire, abs = x, y place the cursor, turn = radians of mouse look to turn by on foot. */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    if (G.phaseT > 0) {
        G.phaseT -= dt;
        if (G.phaseT <= 0) { G.phaseT = 0; advancePhase(G); }
        if (G.over) return;
    }
    if (G.mode === 'ground') stepGround(G, inp, dt);
    else stepFlight(G, inp, dt);
    if (G.enemies.some((e) => e.dead)) G.enemies = G.enemies.filter((e) => !e.dead);
    if (G.foes.some((f) => f.dead)) G.foes = G.foes.filter((f) => !f.dead);
}

/** After a death: try the same stage again with full scales and the score it started with. */
export function continueGame(G) {
    if (!G.over || G.won) return false;
    G.over = false;
    G.continues++;
    G.score = G.stageScore;
    G.scales = SCALES;
    startStage(G, G.stageIdx);
    return true;
}

/** After a win: round the kingdom again, fiercer, keeping the score. */
export function nextCycle(G) {
    if (!G.won) return false;
    G.won = false;
    G.over = false;
    G.loop++;
    G.scales = SCALES;
    startStage(G, 0, true);
    return true;
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
