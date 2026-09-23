/**
 * state.js — the run-level state that outlives a single level: score, lives,
 * headcount, which cadets have been rescued, difficulty, mode.
 *
 * The per-level *simulation* state lives in js/sim/world.js. This module is
 * deliberately plain data plus small mutators so the Node harnesses can drive
 * a whole campaign without a browser.
 */

import { DIFFICULTY, PLAYER } from './config.js';

export const MODE = {
    BOOT: 'boot',
    TITLE: 'title',
    LEVEL_SELECT: 'levelselect',
    BRIEFING: 'briefing',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_CLEAR: 'levelclear',
    GAME_OVER: 'gameover',
    ENDING: 'ending',
};

export function newRun(difficultyId = 'pilot', startLevel = 1) {
    const diff = DIFFICULTY[difficultyId] || DIFFICULTY.pilot;
    return {
        difficulty: diff.id,
        level: startLevel,
        score: 0,
        lives: diff.lives,
        continues: 3,
        flares: PLAYER.startFlares,
        weapon: 'vulcan',
        power: 1,
        rescued: 0,          // cadets carried across the whole run
        lost: 0,
        podsRescued: 0,
        podsLost: 0,
        cadets: [],          // ids of named cadets rescued
        wing: {},            // wing ability flags, e.g. { patchwork: true }
        levelResults: [],
        startedAt: Date.now(),
        seed: 'halcyon',
    };
}

export const state = {
    mode: MODE.BOOT,
    prevMode: MODE.BOOT,
    run: newRun(),
    save: null,             // filled by main.js from core/save.js
    world: null,            // the live sim world while PLAYING
    fps: 0,
};

export function setMode(next) {
    if (state.mode === next) return;
    state.prevMode = state.mode;
    state.mode = next;
}

/** Award a named cadet and their permanent Wing Ability to the run. */
export function addCadet(run, cadet) {
    if (run.cadets.includes(cadet.id)) return false;
    run.cadets.push(cadet.id);
    run.wing[cadet.ability] = true;
    return true;
}

export function hasWing(run, ability) {
    return !!run.wing[ability];
}
