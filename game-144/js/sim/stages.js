// Stage scripts and the endless director. Pure. A stage is a timeline of waves (fixed, so it can be learned),
// then a boss. Survival mode builds waves from a weighted table that grows with the wave number.

import { FIELD } from '../config.js';
import { formation } from './enemies.js';
import { startCapital } from './capital.js';
import { spawnEnemy } from './core.js';
import { hash3 } from '../rng.js';

const W = (t, type, form, o = {}) => ({ t, f: (G) => formation(G, type, form, o) });
const CAP = (t, kind, o) => ({ t, f: (G) => startCapital(G, kind, o) });
const ys = [3, 15, 6, 12, 9, 4.5, 13.5, 7.5, 10.5];

function stage1() {
    const s = [];
    s.push(W(1, 'mote', 'line', { n: 6, y: 5 }), W(3, 'mote', 'line', { n: 6, y: 13 }));
    s.push(W(6, 'dart', 'vee', { n: 5, y: 9 }), W(8.5, 'mote', 'rain', { n: 8 }));
    s.push(W(11, 'pod', 'pair', { n: 1 }), W(13, 'dart', 'line', { n: 4, y: 4, gap: 1 }), W(14, 'dart', 'line', { n: 4, y: 14, gap: 1 }));
    s.push(W(17, 'gunship', 'single', { y: 9, mv: { hx: 25, stay: 8 }, drop: 1 }));
    for (let i = 0; i < 5; i++) s.push(W(19 + i * 1.6, 'mote', 'line', { n: 3, y: ys[i], mv: { amp: 2.4 } }));
    s.push(W(27, 'carrier', 'single', { y: 9 }));
    s.push(W(31, 'dart', 'vee', { n: 7, y: 5 }), W(33, 'dart', 'vee', { n: 7, y: 13 }));
    s.push(W(36, 'mine', 'rain', { n: 7 }), W(38, 'pod', 'column', { n: 3 }));
    s.push(CAP(44, 'frigate'));
    for (let i = 0; i < 8; i++) s.push(W(47 + i * 2.2, 'mote', 'line', { n: 3, y: i % 2 ? 2.4 : 15.6, mv: { amp: 0.6 } }));
    s.push(W(52, 'dart', 'line', { n: 5, y: 2.5, gap: 0.9 }), W(58, 'dart', 'line', { n: 5, y: 15.5, gap: 0.9 }));
    s.push(W(68, 'gunship', 'pair', { n: 1, mv: { hx: 26, stay: 7 } }));
    s.push(W(74, 'mote', 'column', { n: 7 }), W(76, 'mote', 'column', { n: 6 }));
    s.push(W(79, 'carrier', 'single', { y: 6 }), W(83, 'pod', 'pair', { n: 2 }));
    s.push(W(87, 'dart', 'vee', { n: 9, y: 9 }), W(90, 'gunship', 'single', { y: 4, mv: { hx: 24, stay: 7 } }), W(91, 'gunship', 'single', { y: 14, mv: { hx: 24, stay: 7 } }));
    return { script: s, end: 98 };
}

function stage2() {
    const s = [];
    s.push(W(1, 'shard', 'line', { n: 5, y: 6 }), W(3, 'shard', 'line', { n: 5, y: 12 }));
    s.push(W(6, 'manta', 'vee', { n: 3, y: 9 }), W(9, 'mine', 'rain', { n: 9 }));
    s.push(W(12, 'eye', 'single', { y: 9, mv: { hx: 25, stay: 9 }, drop: 1 }));
    for (let i = 0; i < 6; i++) s.push(W(15 + i * 1.5, 'shard', 'line', { n: 2, y: ys[i] }));
    s.push(W(24, 'serpent', 'serpent', { y: 9, segments: 9 }));
    s.push(W(31, 'manta', 'line', { n: 4, y: 5, gap: 2.5 }), W(33, 'manta', 'line', { n: 4, y: 13, gap: 2.5, mv: { phase: 3 } }));
    s.push(W(38, 'carrier', 'single', { y: 9 }), W(41, 'dart', 'vee', { n: 7, y: 4 }));
    s.push(W(46, 'eye', 'pair', { n: 1, mv: { hx: 26, stay: 8 } }));
    s.push(W(52, 'mine', 'column', { n: 6 }), W(54, 'shard', 'rain', { n: 10 }));
    s.push(W(60, 'serpent', 'serpent', { y: 5, segments: 8 }), W(63, 'serpent', 'serpent', { y: 13, segments: 8 }));
    s.push(W(70, 'manta', 'vee', { n: 5, y: 9 }), W(73, 'kamikaze', 'rain', { n: 8 }));
    s.push(W(77, 'cruiser', 'single', { y: 9 }));
    s.push(W(84, 'shard', 'column', { n: 6 }), W(87, 'eye', 'single', { y: 5, mv: { hx: 25, stay: 6 } }), W(88, 'eye', 'single', { y: 13, mv: { hx: 25, stay: 6 } }));
    return { script: s, end: 96 };
}

function stage3() {
    // inside the mothership: a long corridor with turrets and five reactor engines
    const s = [CAP(1, 'mothership', { len: 330 })];
    for (let i = 0; i < 24; i++) {
        const t = 6 + i * 3.4;
        const kind = ['mote', 'kamikaze', 'squid', 'mote', 'bearer', 'dart'][i % 6];
        const form = kind === 'squid' || kind === 'bearer' ? 'single' : kind === 'kamikaze' ? 'rain' : 'line';
        s.push(W(t, kind, form, { n: kind === 'kamikaze' ? 4 : 4, y: 9 + Math.sin(i) * 2.5, mv: { hx: 24, stay: 6, amp: 1.2 } }));
    }
    s.push(W(40, 'sentinel', 'single', { y: 9, mv: { hx: 25, stay: 8 }, drop: 1 }));
    s.push(W(64, 'sentinel', 'single', { y: 8, mv: { hx: 25, stay: 8 }, drop: 1 }));
    return { script: s, end: 86 };
}

function stage4() {
    const s = [];
    s.push(W(1, 'sentinel', 'single', { y: 5, mv: { hx: 26, stay: 7 } }), W(2, 'sentinel', 'single', { y: 13, mv: { hx: 26, stay: 7 } }));
    s.push(W(6, 'kamikaze', 'column', { n: 6 }), W(8, 'kamikaze', 'column', { n: 5 }));
    s.push(W(11, 'bearer', 'vee', { n: 3, y: 9, mv: { hx: 25, stay: 9 } }));
    s.push(W(16, 'gunship', 'pair', { n: 1, mv: { hx: 25, stay: 8 } }), W(18, 'mote', 'rain', { n: 10 }));
    s.push(CAP(24, 'frigate'));
    for (let i = 0; i < 6; i++) s.push(W(27 + i * 2.6, 'kamikaze', 'line', { n: 2, y: i % 2 ? 2.4 : 15.6 }));
    s.push(W(36, 'sentinel', 'single', { y: 2.6, mv: { hx: 28, stay: 6 } }));
    s.push(W(46, 'cruiser', 'single', { y: 9 }));
    s.push(W(55, 'bearer', 'pair', { n: 1, mv: { hx: 24, stay: 7 } }), W(58, 'dart', 'vee', { n: 9, y: 9 }));
    s.push(W(63, 'carrier', 'single', { y: 4 }), W(64, 'carrier', 'single', { y: 14 }));
    s.push(W(72, 'sentinel', 'column', { n: 3, mv: { hx: 26, stay: 6 } }), W(76, 'kamikaze', 'rain', { n: 12 }));
    s.push(W(82, 'gunship', 'vee', { n: 3, y: 9, mv: { hx: 25, stay: 7 } }));
    return { script: s, end: 94 };
}

function stage5() {
    const s = [];
    s.push(W(1, 'squid', 'line', { n: 3, y: 6, gap: 3 }), W(3, 'squid', 'line', { n: 3, y: 12, gap: 3 }));
    s.push(W(7, 'egg', 'rain', { n: 10, mv: { speed: 3.5 } }));
    s.push(W(11, 'eye', 'single', { y: 9, mv: { hx: 25, stay: 9 }, drop: 1 }));
    s.push(W(15, 'serpent', 'serpent', { y: 6, segments: 11 }), W(19, 'serpent', 'serpent', { y: 12, segments: 11 }));
    s.push(W(26, 'manta', 'column', { n: 4 }), W(30, 'egg', 'column', { n: 7 }));
    s.push(W(34, 'eye', 'pair', { n: 1, mv: { hx: 24, stay: 8 } }), W(36, 'squid', 'vee', { n: 5, y: 9 }));
    s.push(W(44, 'cruiser', 'single', { y: 9 }));
    s.push(W(52, 'serpent', 'serpent', { y: 9, segments: 14 }), W(56, 'mine', 'rain', { n: 10 }));
    s.push(W(62, 'carrier', 'single', { y: 5 }), W(66, 'squid', 'rain', { n: 8 }));
    s.push(W(72, 'eye', 'vee', { n: 3, y: 9, mv: { hx: 25, stay: 7 } }), W(78, 'egg', 'rain', { n: 12 }));
    s.push(W(83, 'manta', 'vee', { n: 7, y: 9 }));
    return { script: s, end: 92 };
}

function stage6() {
    const s = [];
    s.push(W(1, 'angel', 'single', { y: 9, mv: { hx: 25, stay: 9 }, drop: 1 }));
    s.push(W(4, 'mote', 'column', { n: 8, c: 5 }), W(7, 'dart', 'vee', { n: 9, y: 9 }));
    s.push(W(12, 'angel', 'pair', { n: 1, mv: { hx: 26, stay: 8 } }));
    s.push(W(18, 'serpent', 'serpent', { y: 9, segments: 12 }), W(22, 'kamikaze', 'rain', { n: 12 }));
    s.push(W(28, 'cruiser', 'single', { y: 6 }), W(32, 'eye', 'single', { y: 14, mv: { hx: 25, stay: 7 } }));
    s.push(W(38, 'bearer', 'vee', { n: 5, y: 9, mv: { hx: 24, stay: 7 } }));
    s.push(W(45, 'angel', 'vee', { n: 3, y: 9, mv: { hx: 25, stay: 8 } }));
    s.push(W(54, 'shard', 'rain', { n: 12 }), W(56, 'manta', 'column', { n: 5 }));
    s.push(W(62, 'carrier', 'single', { y: 9 }), W(66, 'sentinel', 'pair', { n: 1, mv: { hx: 26, stay: 7 } }));
    s.push(W(72, 'angel', 'pair', { n: 2, mv: { hx: 25, stay: 7 } }), W(78, 'kamikaze', 'column', { n: 9 }));
    s.push(W(84, 'cruiser', 'single', { y: 9 }));
    return { script: s, end: 96 };
}

const BUILDERS = [stage1, stage2, stage3, stage4, stage5, stage6];
export const STAGE_COUNT = BUILDERS.length;

export function stageScript(n) {
    const st = BUILDERS[n]();
    st.script.sort((a, b) => a.t - b.t);
    return st;
}

/** Advance a story stage's timeline. Returns true when the script is spent and it's time for the boss. */
export function stepStage(G, dt) {
    G.stageT += dt;
    const st = G._script || (G._script = stageScript(G.stage));
    while (G.scriptI < st.script.length && st.script[G.scriptI].t <= G.stageT) {
        st.script[G.scriptI].f(G);
        G.scriptI++;
    }
    const spent = G.scriptI >= st.script.length;
    const quiet = !G.enemies.some((e) => !e.part) && !G.capital;
    return spent && (G.stageT >= st.end || (quiet && G.stageT > st.script[st.script.length - 1].t + 3));
}

// ---------------------------------------------------------------------------- survival
const POOL = [
    // [type, form, first wave it can appear, weight, n]
    ['mote', 'line', 0, 10, 6], ['mote', 'column', 0, 6, 6], ['dart', 'vee', 0, 8, 5], ['pod', 'pair', 1, 5, 1],
    ['mine', 'rain', 1, 4, 8], ['shard', 'line', 2, 6, 4], ['manta', 'vee', 3, 6, 3], ['gunship', 'single', 2, 5, 1],
    ['kamikaze', 'rain', 3, 6, 8], ['squid', 'line', 4, 5, 3], ['sentinel', 'single', 5, 5, 1], ['bearer', 'vee', 6, 4, 3],
    ['eye', 'single', 6, 4, 1], ['serpent', 'serpent', 7, 3, 1], ['carrier', 'single', 4, 3, 1], ['cruiser', 'single', 10, 2, 1],
    ['angel', 'single', 12, 3, 1], ['egg', 'rain', 8, 3, 10],
];
export const BOSS_ORDER = ['bellwether', 'wyrm', 'organ', 'titan', 'mother', 'heart'];
export const ENDLESS_BOSS_EVERY = 8;

/** One survival wave: a few groups from the pool, more and tougher as waves go on. Deterministic per run seed. */
export function endlessWave(G) {
    const w = G.wave;
    const groups = 1 + Math.min(4, Math.floor(w / 3));
    const avail = POOL.filter((p) => p[2] <= w);
    for (let g = 0; g < groups; g++) {
        let tot = 0;
        for (const p of avail) tot += p[3];
        let r = hash3(G.seed, w, g) * tot, pick = avail[0];
        for (const p of avail) { r -= p[3]; if (r <= 0) { pick = p; break; } }
        const y = 3 + hash3(G.seed, w, g + 50) * 12;
        const n = Math.ceil(pick[4] * (1 + w * 0.04));
        const hpMul = 1 + w * 0.06;
        G.pending.push({ t: G.waveT + g * 2.2, type: pick[0], form: pick[1], o: { n, y, hpMul, mv: { hx: 22 + hash3(G.seed, w, g + 9) * 6, stay: 8 }, drop: pick[1] === 'single' ? 0.5 : undefined } });
    }
    if (w % 5 === 4) G.pending.push({ t: G.waveT + 1, type: 'carrier', form: 'single', o: { y: 9, hpMul: 1 + w * 0.05 } });
}

export function stepEndless(G, dt) {
    G.waveT += dt;
    // pending groups from the current wave
    for (let i = G.pending.length - 1; i >= 0; i--) {
        const p = G.pending[i];
        if (p.t <= G.waveT) { G.pending.splice(i, 1); formation(G, p.type, p.form, p.o); }
    }
    return G.pending.length === 0 && !G.enemies.some((e) => !e.part) && G.waveT > 3;
}

export { spawnEnemy };
void FIELD;
