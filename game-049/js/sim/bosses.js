/**
 * bosses.js — the ten Wardens. Each is a rotation of telegraphed moves per
 * phase (phases change at 66% and 33% health). Every area attack is placed as
 * a hazard that resolves after the hero's next action, so every fight is a
 * readable dance on the grid.
 */

import { TP, DIRS8, cheb, T } from './tiles.js';
import { R, ev, log, attack, alive, heal, applyStatus, freeNear, inBounds, tileAt, canEnter, actorAt } from './combat.js';
import { approach, moveTo, summon } from './ai.js';
import { lineOfFire, bresenham, ray } from './path.js';
import { hpScale, dmgScale } from './monsters.js';

/**
 * hp/dmg are depth-1 values (scaled by floor). minion is a species id.
 * phases: move rotations. gap: basic turns between moves per phase.
 */
export const BOSSES = {
    gnawbone:  { w: 1, hp: 70, dmg: [3, 6], acc: 6, eva: 4, arm: 1, spd: 100, sz: 1.5, minion: 'rat', bolt: null,
        phases: [['summon', 'slam'], ['burrow', 'summon', 'slam'], ['burrow', 'slam', 'summon', 'slam']], gap: [2, 1, 1] },
    mycel:     { w: 2, hp: 85, dmg: [4, 7], acc: 4, eva: 0, arm: 2, spd: 80, sz: 1.9, minion: 'puffball', bolt: 'spore',
        phases: [['ring2', 'summon'], ['ring2', 'sporefield', 'summon'], ['ring3', 'sporefield', 'summon', 'ring2']], gap: [2, 1, 1] },
    archivist: { w: 3, hp: 80, dmg: [4, 7], acc: 8, eva: 8, arm: 1, spd: 100, sz: 1.4, minion: 'tome', bolt: 'ink',
        phases: [['lines', 'blink', 'summon'], ['lines2', 'blink', 'summon', 'lines'], ['lines2', 'scatter', 'blink', 'lines2']], gap: [2, 1, 1] },
    brann:     { w: 4, hp: 100, dmg: [5, 9], acc: 6, eva: 0, arm: 6, spd: 90, sz: 1.6, minion: 'imp', bolt: null,
        phases: [['cross', 'cross'], ['cross', 'molten', 'summon'], ['haste', 'cross', 'molten', 'cross']], gap: [2, 1, 1] },
    wyrm:      { w: 5, hp: 105, dmg: [5, 8], acc: 8, eva: 4, arm: 3, spd: 100, sz: 1.7, minion: 'shardling', bolt: 'prism',
        phases: [['beams4', 'beams4'], ['beamsX', 'beams4', 'summon'], ['beams8', 'summon', 'beams8']], gap: [2, 1, 1] },
    vesper:    { w: 6, hp: 105, dmg: [5, 8], acc: 8, eva: 6, arm: 2, spd: 100, sz: 1.5, minion: 'skeleton', bolt: 'wail',
        phases: [['drain', 'raise'], ['danse', 'drain', 'raise'], ['danse', 'raise', 'drain', 'danse']], gap: [2, 1, 1] },
    orrery:    { w: 7, hp: 130, dmg: [5, 9], acc: 8, eva: 0, arm: 5, spd: 100, sz: 2.0, minion: 'drone', bolt: 'bolt', still: true,
        phases: [['arms2', 'arms2', 'summon'], ['arms3', 'arms3', 'summon'], ['arms4', 'arms3', 'summon', 'arms4']], gap: [1, 1, 1] },
    isolde:    { w: 8, hp: 120, dmg: [6, 9], acc: 8, eva: 6, arm: 3, spd: 100, sz: 1.5, minion: 'snowwolf', bolt: 'frost',
        phases: [['blizzard', 'summon'], ['blizzard', 'icefield', 'summon'], ['blizzard', 'ring3', 'icefield', 'summon']], gap: [2, 1, 1] },
    watcher:   { w: 9, hp: 125, dmg: [6, 10], acc: 10, eva: 6, arm: 2, spd: 100, sz: 1.8, minion: 'voidstalker', bolt: 'beam', fly: true,
        phases: [['gaze', 'blink', 'gaze'], ['gaze', 'collapse', 'blink', 'summon'], ['collapse', 'gaze', 'blink', 'gaze', 'summon']], gap: [1, 1, 1] },
    hush:      { w: 10, hp: 150, dmg: [6, 10], acc: 10, eva: 8, arm: 4, spd: 100, sz: 1.6, minion: 'shade', bolt: 'shadow',
        phases: [['mirror', 'mirror', 'blink'], ['dark', 'scatter', 'summon', 'lines'], ['lines2', 'ring3', 'cross', 'arms3', 'summon']], gap: [1, 1, 1] },
};

export const BOSS_BY_WORLD = Object.fromEntries(Object.entries(BOSSES).map(([k, b]) => [b.w, k]));

export function makeBoss(run, id, name, x, y, L) {
    const B = BOSSES[id];
    const m = {
        id: run.nextId++, sp: 'boss_' + id, bossId: id, boss: true, name, x, y, lvl: L,
        hpMax: Math.round(B.hp * hpScale(L) * 1.35), hp: 0,
        dmg: [Math.round(B.dmg[0] * dmgScale(L)), Math.round(B.dmg[1] * dmgScale(L))],
        acc: B.acc + Math.round(L * 0.75), eva: B.eva + Math.round(L * 0.4), arm: Math.round(B.arm * (1 + L * 0.05)),
        spd: B.spd, energy: 0, arch: 'boss', r: B.bolt ? 6 : 0, st: {}, awake: false, home: { x, y },
        seed: 0, size: B.sz, xp: Math.round(60 * (1 + L * 0.15)), aff: [], ai: { cd: 2, k: 0, phase: 0, arm: 0 },
    };
    m.hp = m.hpMax;
    if (B.still) m.still = true;
    return m;
}

const tilesOk = (run, list) => list.filter((i) => {
    const x = i % run.lv.w, y = (i / run.lv.w) | 0;
    return inBounds(run, x, y) && !TP[run.lv.tiles[i]].opaque;
});
const idx = (run, x, y) => y * run.lv.w + x;

function hazard(run, m, tiles, mult, kind, extra = {}) {
    tiles = tilesOk(run, [...new Set(tiles)]);
    if (!tiles.length) return;
    run.hazards.push({ id: run.nextId++, tiles, t: 1, dmg: Math.round(m.dmg[1] * mult), kind, owner: m.id, ...extra });
    ev(run, { t: 'hazard', tiles, kind, id: m.id });
}

function square(run, cx, cy, r) {
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inBounds(run, cx + dx, cy + dy)) out.push(idx(run, cx + dx, cy + dy));
    return out;
}
function ring(run, cx, cy, r0, r1) {
    const out = [];
    for (let dy = -r1; dy <= r1; dy++) for (let dx = -r1; dx <= r1; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d >= r0 && d <= r1 && inBounds(run, cx + dx, cy + dy)) out.push(idx(run, cx + dx, cy + dy));
    }
    return out;
}

// ------------------------------------------------------------------ Turn

export function bossAct(run, m) {
    const B = BOSSES[m.bossId];
    const p = run.p;
    const rng = R(run);
    if (!m.awake) {
        if (run._t.vis[idx(run, m.x, m.y)] && cheb(m.x, m.y, p.x, p.y) <= 9) { m.awake = true; ev(run, { t: 'alert', id: m.id }); ev(run, { t: 'bossWake', id: m.id }); }
        return;
    }
    if (m.ai.ccImmune > 0) m.ai.ccImmune--;
    // Phase changes.
    const frac = m.hp / m.hpMax;
    const want = frac < 0.33 ? 2 : frac < 0.66 ? 1 : 0;
    if (want > m.ai.phase) {
        m.ai.phase = want; m.ai.k = 0; m.ai.cd = 0;
        ev(run, { t: 'phase', id: m.id, phase: want });
        log(run, PHASE_LINES[m.bossId][want - 1], 'boss');
        if (m.bossId === 'hush' && want === 2) { run.flags.dark = false; }
        return;
    }
    if (m.ai.burrowed) return;
    if (m.ai.cd > 0) { m.ai.cd--; return basic(run, m, B); }
    const rot = B.phases[m.ai.phase];
    const move = rot[m.ai.k % rot.length];
    m.ai.k++;
    m.ai.cd = B.gap[m.ai.phase];
    doMove(run, m, B, move, rng);
}

function basic(run, m, B) {
    const p = run.p;
    const d = cheb(m.x, m.y, p.x, p.y);
    if (d <= 1) return attack(run, m, p);
    if (B.bolt && d <= 7 && (m.still || R(run).chance(0.45)) && lineOfFire(run.lv, m.x, m.y, p.x, p.y)) {
        ev(run, { t: 'shot', id: m.id, fx: m.x, fy: m.y, x: p.x, y: p.y, kind: B.bolt });
        return attack(run, m, p, { ranged: true, kind: B.bolt === 'frost' ? 'cold' : B.bolt === 'spore' ? 'poison' : 'magic', mult: 0.8 });
    }
    if (!m.still) approach(run, m);
}

function doMove(run, m, B, move, rng) {
    const p = run.p;
    const w = run.lv.w;
    switch (move) {
        case 'summon': {
            const n = 1 + m.ai.phase + (B.minion === 'rat' ? 1 : 0);
            const live = run.mons.filter((o) => alive(o) && o.summoner === m.id).length;
            if (live >= (m.bossId === 'hush' ? 3 : 5)) return basic(run, m, B);
            for (let k = 0; k < n; k++) summon(run, m, B.minion, m.x, m.y);
            log(run, SUMMON_LINES[m.bossId], 'boss');
            return;
        }
        case 'raise': {
            // Vesper raises the dead from the bone piles around the arena.
            const n = 2 + m.ai.phase;
            for (let k = 0; k < n; k++) {
                const c = freeNear(run, p.x + rng.int(-4, 4), p.y + rng.int(-4, 4), { id: -1 }, 3);
                if (c) summon(run, m, 'skeleton', c[0], c[1]);
            }
            log(run, '"Rise. Rise and sing with me."', 'boss');
            return;
        }
        case 'slam': return hazard(run, m, square(run, p.x, p.y, 1), 1.3, 'slam', { st: { k: 'stun', n: 1 } });
        case 'burrow': {
            m.ai.burrowed = true; m.ai.invuln = true;
            hazard(run, m, square(run, p.x, p.y, 1), 1.6, 'burrow', { emerge: { x: p.x, y: p.y } });
            log(run, 'Gnawbone dives into the earth — the ground under you churns!', 'warn');
            ev(run, { t: 'burrow', id: m.id });
            return;
        }
        case 'ring2': return hazard(run, m, ring(run, m.x, m.y, 1, 2), 1.2, 'poison', { st: { k: 'poison', n: 4 } });
        case 'ring3': return hazard(run, m, ring(run, m.x, m.y, 2, 3), 1.3, m.bossId === 'isolde' ? 'ice' : m.bossId === 'hush' ? 'void' : 'poison', { st: m.bossId === 'isolde' ? { k: 'frozen', n: 1 } : { k: 'poison', n: 4 } });
        case 'sporefield': {
            const tiles = [];
            for (let k = 0; k < 8; k++) tiles.push(...square(run, p.x + rng.int(-3, 3), p.y + rng.int(-3, 3), 0));
            tiles.push(idx(run, p.x, p.y));
            return hazard(run, m, tiles, 0.7, 'poison', { st: { k: 'poison', n: 3 }, field: 4 });
        }
        case 'lines': {
            const t = [...ray(run.lv, p.x, p.y, 1, 0), ...ray(run.lv, p.x, p.y, -1, 0), ...ray(run.lv, p.x, p.y, 0, 1), ...ray(run.lv, p.x, p.y, 0, -1), idx(run, p.x, p.y)];
            return hazard(run, m, t, 1.1, 'rune');
        }
        case 'lines2': {
            const t = [];
            for (const [dx, dy] of DIRS8) t.push(...ray(run.lv, p.x, p.y, dx, dy, 8));
            t.push(idx(run, p.x, p.y));
            return hazard(run, m, t, 1.1, m.bossId === 'hush' ? 'void' : 'rune');
        }
        case 'scatter': case 'blizzard': {
            const t = [idx(run, p.x, p.y)];
            const n = 10 + m.ai.phase * 4;
            for (let k = 0; k < n; k++) t.push(idx(run, Math.max(1, Math.min(run.lv.w - 2, p.x + rng.int(-4, 4))), Math.max(1, Math.min(run.lv.h - 2, p.y + rng.int(-4, 4)))));
            const ice = move === 'blizzard';
            return hazard(run, m, t, 1.0, ice ? 'ice' : m.bossId === 'hush' ? 'void' : 'rune', ice ? { st: { k: 'frozen', n: 1 } } : {});
        }
        case 'icefield': {
            const t = ring(run, p.x, p.y, 0, 1);
            return hazard(run, m, t, 0.8, 'ice', { st: { k: 'frozen', n: 1 }, field: 3 });
        }
        case 'cross': {
            const t = [idx(run, p.x, p.y)];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) t.push(...ray(run.lv, p.x, p.y, dx, dy, 4));
            log(run, m.bossId === 'brann' ? 'Brann raises his hammer high!' : 'The dark gathers into a cross!', 'warn');
            return hazard(run, m, t, 1.5, m.bossId === 'brann' ? 'slam' : 'void', { st: { k: 'stun', n: 1 } });
        }
        case 'molten': {
            const t = [];
            for (let k = 0; k < 6; k++) t.push(...square(run, p.x + rng.int(-3, 3), p.y + rng.int(-3, 3), 0));
            t.push(...ring(run, p.x, p.y, 0, 0));
            return hazard(run, m, t, 0.9, 'fire', { st: { k: 'burn', n: 3 }, field: 4 });
        }
        case 'haste': applyStatus(run, m, 'haste', 30); m.spd = 150; log(run, 'Brann\'s armour glows white-hot. He quickens!', 'boss'); return;
        case 'beams4': case 'beamsX': case 'beams8': {
            const dirs = move === 'beams4' ? DIRS8.slice(0, 4) : move === 'beamsX' ? DIRS8.slice(4) : DIRS8;
            const t = [];
            for (const [dx, dy] of dirs) t.push(...ray(run.lv, m.x, m.y, dx, dy));
            log(run, 'The Wyrm\'s scales flare — light gathers along its lines!', 'warn');
            return hazard(run, m, t, 1.4, 'beam');
        }
        case 'drain': {
            if (!lineOfFire(run.lv, m.x, m.y, p.x, p.y)) return basic(run, m, B);
            ev(run, { t: 'shot', id: m.id, fx: m.x, fy: m.y, x: p.x, y: p.y, kind: 'drain' });
            const d = attack(run, m, p, { ranged: true, kind: 'magic', mult: 1.1, accBonus: 10 });
            if (d) heal(run, m, d * 1.5);
            return;
        }
        case 'danse': {
            const r0 = rng.int(1, 2);
            hazard(run, m, ring(run, m.x, m.y, r0, r0 + 1), 1.2, 'void');
            hazard(run, m, ring(run, m.x, m.y, r0 + 3, r0 + 4), 1.2, 'void');
            log(run, 'Vesper begins the danse macabre — the floor rings with bone!', 'warn');
            return;
        }
        case 'arms2': case 'arms3': case 'arms4': {
            const n = +move.slice(4);
            m.ai.arm = (m.ai.arm + 1) % 8;
            const t = [];
            for (let k = 0; k < n; k++) {
                const [dx, dy] = DIRS_RING[(m.ai.arm + Math.round(k * 8 / n)) % 8];
                t.push(...ray(run.lv, m.x, m.y, dx, dy));
            }
            log(run, 'The Orrery\'s arms swing into alignment.', 'warn');
            return hazard(run, m, t, 1.4, m.bossId === 'hush' ? 'void' : 'beam');
        }
        case 'gaze': {
            const pts = bresenham(m.x, m.y, m.x + (p.x - m.x) * 6, m.y + (p.y - m.y) * 6);
            const t = [];
            for (let k = 1; k < pts.length; k++) {
                const [x, y] = pts[k];
                if (!inBounds(run, x, y) || TP[tileAt(run, x, y)].opaque) break;
                t.push(idx(run, x, y));
            }
            // A wide gaze: the tiles beside the line too.
            const wide = [];
            for (const i of t) { const x = i % w, y = (i / w) | 0; wide.push(i, idx(run, x + 1, y), idx(run, x - 1, y), idx(run, x, y + 1), idx(run, x, y - 1)); }
            log(run, 'The Watcher\'s eye fixes on you.', 'warn');
            return hazard(run, m, m.ai.phase ? wide : t, 1.5, 'beam', { st: { k: 'mark', n: 3 } });
        }
        case 'collapse': {
            const t = [];
            const a = run.lv.arena;
            for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) if (cheb(x, y, m.x, m.y) >= 3) t.push(idx(run, x, y));
            log(run, 'The void collapses inward — get close to the eye!', 'warn');
            return hazard(run, m, t, 1.3, 'void');
        }
        case 'blink': {
            const a = run.lv.arena;
            for (let k = 0; k < 40; k++) {
                const x = rng.int(a.x + 1, a.x + a.w - 2), y = rng.int(a.y + 1, a.y + a.h - 2);
                if (cheb(x, y, p.x, p.y) < 4 || !canEnter(run, m, x, y)) continue;
                ev(run, { t: 'tele', id: m.id, fx: m.x, fy: m.y, x, y });
                m.x = x; m.y = y;
                return;
            }
            return basic(run, m, B);
        }
        case 'dark': {
            run.flags.dark = true;
            log(run, 'The Hush swallows the light. Your lantern shrinks to a spark.', 'boss');
            ev(run, { t: 'dark' });
            if (run.mons.filter((o) => alive(o) && o.summoner === m.id).length < 2) summon(run, m, 'shade', m.x, m.y);
            return;
        }
        case 'mirror': {
            // Phase 1: Maren's shape mirrors your own craft.
            const c = run.p.cls;
            if (c === 'warden') { log(run, '"Remember the stance I taught you?" It cleaves the air.', 'boss'); return hazard(run, m, ring(run, m.x, m.y, 1, 2), 1.3, 'void'); }
            if (c === 'ranger') { log(run, '"Remember how to read the dark?" It looses a volley.', 'boss'); const t = []; for (let k = 0; k < 6; k++) t.push(idx(run, p.x + rng.int(-2, 2), p.y + rng.int(-2, 2))); t.push(idx(run, p.x, p.y)); return hazard(run, m, t, 1.2, 'void'); }
            log(run, '"Remember the first fire I showed you?" A meteor gathers.', 'boss');
            return hazard(run, m, square(run, p.x, p.y, 1), 1.4, 'fire', { st: { k: 'burn', n: 3 } });
        }
    }
}

const DIRS_RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

/** Gnawbone surfaces where the burrow hazard was. */
export function emerge(run, h) {
    const m = run.mons.find((o) => o.id === h.owner);
    if (!m || !alive(m)) return;
    m.ai.burrowed = false; m.ai.invuln = false;
    const c = canEnter(run, m, h.emerge.x, h.emerge.y) ? [h.emerge.x, h.emerge.y] : freeNear(run, h.emerge.x, h.emerge.y, m, 3);
    if (c) { ev(run, { t: 'tele', id: m.id, fx: m.x, fy: m.y, x: c[0], y: c[1], emerge: true }); m.x = c[0]; m.y = c[1]; }
    ev(run, { t: 'emerge', id: m.id });
}

const PHASE_LINES = {
    gnawbone: ['"MORE! WE NEED MORE MOUTHS!" The crown of rats writhes.', '"WE WILL EAT THE DARK TOO IF WE HAVE TO!"'],
    mycel: ['"Breathe, little lamp. Breathe deep."', 'Mother Mycel splits open, and the grotto fills with spores.'],
    archivist: ['"Cross-referencing. You are... overdue."', '"I WILL FILE YOU UNDER EXTINGUISHED."'],
    brann: ['"THE STEEL IS NOT HOT ENOUGH. HOTTER."', '"THE FORGE NEVER GOES COLD. NEVER."'],
    wyrm: ['The Wyrm turns, and its light comes at you from new angles.', 'Cracks run through the Wyrm. Every colour it has eaten is bleeding out.'],
    vesper: ['"Dance with me. Everyone here dances with me."', '"I know your name now. I know it."'],
    orrery: ['"ERROR. RECALCULATING ORBITS."', '"ALL ARMS. ALL ARMS. PROBABILITY OF DAWN: ZERO. ZERO. ZERO."'],
    isolde: ['"Why must everything move? Be still."', 'The Queen rises from her throne for the first time in a thousand years.'],
    watcher: ['The eye widens. You see, for a moment, what it sees.', 'The void between the stars begins to fold.'],
    hush: ['Maren\'s face slides off it like wax. Underneath is Lastlight — every lamp, every window, going dark.', 'There is nothing left but the shape of your own shadow, cast enormous by the Lantern behind it.'],
};
const SUMMON_LINES = {
    gnawbone: 'Rats pour from the walls!', mycel: 'Puffballs swell up out of the floor.', archivist: 'Books tear themselves from the shelves.',
    brann: 'Cinder imps crawl out of the coals.', wyrm: 'Shards of the Wyrm break off and skitter towards you.', vesper: 'Bones knit together.',
    orrery: 'Drones detach from the orbit rings.', isolde: 'Wolves of snow lope out of the blizzard.', watcher: 'Things step out of the gaps between the stars.',
    hush: 'Shades peel off the walls.',
};
