// Everything that hurts something: terrain layers, monsters, hives and the mech, and explosions
// that do all four at once. Pure.

import { MECH, OVERDRIVE, MAP } from '../config.js';
import { ENEMIES, BOSSES, HIVE, MATS } from './data/enemies.js';
import { MAT_LIST, MAT_ID, idx, inMap, cellOf } from './world.js';
import { burst, scatter, C } from './voxels.js';

/** Damage the top layer of a cell. Breaking a layer throws rubble (and sometimes gold). */
export function hurtCell(R, i, dmg) {
    const W = R.W;
    if (W.h[i] <= 0) return;
    const mat = MAT_LIST[W.mat[i]];
    if (mat === 'edge') return;
    if (mat === 'hive') {
        const hv = R.hives.find((h) => !h.dead && h.cells.includes(i));
        if (hv) hurtHive(R, hv, dmg);
        return;
    }
    const M = MATS[mat];
    W.hp[i] -= dmg;
    while (W.hp[i] <= 0 && W.h[i] > 0) {
        W.h[i]--;
        const x = (i % MAP.w) + 0.5, y = ((i / MAP.w) | 0) + 0.5;
        burst(R, x, y, W.h[i] + 0.5, M.voxels, { [mat]: 1 - M.gold, gold: M.gold }, 0.8);
        R.events.push({ type: 'break', x, y, i, mat, h: W.h[i] });
        if (W.h[i] > 0) W.hp[i] += M.hp; else { W.mat[i] = 0; W.hp[i] = 0; }
        W.ffDirty = true;
    }
}

export function hurtEnemy(R, e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.12;
    if (e.hp <= 0) killEnemy(R, e);
}

export function killEnemy(R, e) {
    if (e.dead) return;
    e.dead = true;
    const def = e.boss ? BOSSES[e.kind] : ENEMIES[e.kind];
    const mix = { ...def.mix };
    if (R.mods.luck) mix.gold = (mix.gold || 0) * 2.2;
    burst(R, e.x, e.y, e.boss ? 2 : 0.6, def.drops, mix, e.boss ? 1.8 : 1);
    R.kills++;
    const M = R.mech;
    M.od = Math.min(1, M.od + OVERDRIVE.perKill * M.odMul * (e.boss ? 10 : 1));
    R.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, boss: !!e.boss });
    if (e.kind === 'boomer') explode(R, e.x, e.y, ENEMIES.boomer.boom.radius, ENEMIES.boomer.boom.dmg * R.dmgScale, ENEMIES.boomer.boom.terrain, 'monster');
    if (e.boss) { R.bossDown = true; R.events.push({ type: 'boss_down', x: e.x, y: e.y, kind: e.kind }); }
}

export function hurtHive(R, hv, dmg) {
    if (hv.dead) return;
    hv.hp -= dmg;
    hv.flash = 0.12;
    if (hv.hp > 0) return;
    hv.dead = true;
    for (const i of hv.cells) { R.W.h[i] = 0; R.W.mat[i] = 0; R.W.hp[i] = 0; }
    R.W.ffDirty = true;
    const mix = { ...HIVE.mix };
    if (R.mods.luck) mix.gold *= 1.8;
    burst(R, hv.x, hv.y, 1.5, HIVE.drops, mix, 1.6);
    burst(R, hv.x, hv.y, 1.5, 14, C.hive, 1.4);
    R.mech.od = Math.min(1, R.mech.od + OVERDRIVE.perHive * R.mech.odMul);
    R.events.push({ type: 'hive_down', x: hv.x, y: hv.y });
    for (const i of hv.cells) R.events.push({ type: 'break', x: (i % MAP.w) + 0.5, y: ((i / MAP.w) | 0) + 0.5, i, mat: 'hive', h: 0 });
}

/** The mech takes a hit. Overdrive and the i-frames after a hit ignore it; the shield goes first. */
export function hurtMech(R, dmg, src = 'hit') {
    const M = R.mech;
    if (M.hp <= 0 || M.odT > 0 || M.inv > 0 || R.over) return;
    M.inv = MECH.hitIframes;
    M.shieldT = MECH.shieldDelay;
    let left = dmg;
    if (M.shield > 0) { const s = Math.min(M.shield, left); M.shield -= s; left -= s; }
    M.hp = Math.max(0, M.hp - left);
    M.taken += dmg;
    R.events.push({ type: 'hurt', dmg, shield: left === 0, src });
    if (M.hp <= 0) R.events.push({ type: 'down' });
}

/**
 * A blast at (x, y). from = 'mech' (hurts monsters, hives and terrain) or 'monster' (hurts the
 * mech, other monsters and terrain). Settled voxels in the blast fly again.
 */
export function explode(R, x, y, radius, dmg, terrainDmg, from = 'mech') {
    R.events.push({ type: 'boom', x, y, r: radius, from });
    for (const e of R.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < radius + e.r) {
            hurtEnemy(R, e, e.boss && from === 'monster' ? 0 : dmg);
            if (!e.boss && !e.dead && d > 0.01) { const k = 3 * (1 - d / (radius + e.r)); e.kx = (e.x - x) / d * k * 3; e.ky = (e.y - y) / d * k * 3; }
        }
    }
    if (from === 'monster') {
        const M = R.mech;
        if (Math.hypot(M.x - x, M.y - y) < radius + MECH.radius) hurtMech(R, dmg, 'blast');
    }
    if (terrainDmg > 0) {
        const r = Math.ceil(radius);
        for (let cy = cellOf(y) - r; cy <= cellOf(y) + r; cy++) for (let cx = cellOf(x) - r; cx <= cellOf(x) + r; cx++) {
            if (!inMap(cx, cy)) continue;
            const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
            if (d > radius + 0.5) continue;
            const i = idx(cx, cy);
            if (R.W.mat[i] === MAT_ID.hive) continue;            // hives take the blast once, below
            hurtCell(R, i, terrainDmg * (1 - 0.5 * d / (radius + 0.5)));
        }
    }
    if (from === 'mech') for (const hv of R.hives) if (!hv.dead && Math.hypot(hv.x - x, hv.y - y) < radius + 1.5) hurtHive(R, hv, dmg);
    scatter(R, x, y, radius + 0.5, 1);
}
