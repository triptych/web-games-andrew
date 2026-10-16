// Rules both acts share: difficulty, hurting the dragon, scoring a kill, clearing a stage.

import { INVULN, LOOP_HARDER, SCALES } from '../config.js';
import { ENEMY, BEATS } from './data.js';

/** Enemy speed and fire-rate multiplier for the current cycle through the kingdom. */
export const diff = (G) => 1 + LOOP_HARDER * G.loop;

export const newId = (G) => ++G.nextId;

/** Hurt the dragon by one scale. Returns true if it landed (false during grace or between stages). */
export function hurt(G, by, x = 0, y = 0, z = 0) {
    const p = G.player;
    if (p.inv > 0 || G.phase === 'dead' || G.phase === 'clear' || G.phase === 'ascend') return false;
    G.scales -= 1;
    G.hits++;
    p.inv = INVULN;
    G.events.push({ type: 'hurt', by, x, y, z, scales: G.scales });
    if (G.scales <= 0) {
        G.scales = 0;
        G.phase = 'dead';
        G.phaseT = BEATS.dead;
        G.events.push({ type: 'dead', by });
    }
    return true;
}

/** Take n hit points off an enemy; kill it (score, quota, event) when they run out. */
export function damage(G, e, n = 1) {
    if (e.dead) return;
    e.hp -= n;
    e.hurtT = 0.35;
    if (e.hp > 0) {
        G.events.push({ type: 'hit', kind: e.kind, id: e.id, x: e.x, y: e.y, z: e.z, hp: e.hp });
        return;
    }
    kill(G, e, ENEMY[e.kind].score);
}

export function kill(G, e, score) {
    if (e.dead) return;
    e.dead = true;
    G.score += score;
    G.kills++;
    if (ENEMY[e.kind].quota) G.stageKills++;
    G.events.push({ type: 'kill', kind: e.kind, id: e.id, x: e.x, y: e.y, z: e.z, h: e.h || 0, score });
}

/** The stage's goal is met: a short beat, a scale back, then onward. */
export function stageClear(G, bonus = 0) {
    if (G.phase !== 'play') return;
    G.phase = 'clear';
    G.phaseT = BEATS.clear;
    G.score += bonus;
    const healed = G.scales < SCALES;
    G.scales = Math.min(SCALES, G.scales + 1);
    G.events.push({ type: 'clear', stage: G.stageIdx, bonus, healed });
}
