/**
 * castle.js — Emberhold, built from the castle's upgrade state.
 *
 * The wall runs along the left edge of the field: a log palisade at first,
 * then stone, then banded stone with gold trim and banners. Each lane's
 * tower is a stack of stepped fighting platforms (one per tier) rising back
 * from the wall. Behind them the keep grows with total investment (corner
 * turrets, a great tower, banners) and carries the Keepfire beacon. The
 * forge and treasury appear as outbuildings, spiked ramparts in front of
 * the wall. Everything merges into one mesh (plus glow) that casts shadows.
 */

import * as THREE from 'three';
import { Parts, actorMaterial, GLOW_MAT, darker, lighter } from './models.js';
import { LANES, LANE_W, laneZ, wallSlotX, REGIONS } from '../config.js';

export const wallHeight = (lv) => 0.7 + Math.min(15, lv) * 0.045;
export const slotY = (castle, tier) => wallHeight(castle.walls) + 0.42 * tier + 0.06;

export function keepLevel(c) {
    const sum = c.walls + (c.bailey - 3) + c.forge + c.treasury + c.keepfire + c.ramparts + c.towers.reduce((a, b) => a + b, 0);
    return Math.max(1, Math.min(6, 1 + Math.floor(sum / 6)));
}

const ROOF = ['#3a5a9a', '#2a6a4a', '#8a2a1a', '#4a6a9a', '#3a2a4a', '#2a0a0a'];

export function buildCastle(c, regionIdx) {
    const R = REGIONS[regionIdx];
    const P = new Parts(31 + c.walls);
    const wh = wallHeight(c.walls);
    const tier = c.walls <= 3 ? 0 : c.walls <= 9 ? 1 : 2;
    const stone = regionIdx === 2 || regionIdx === 5 ? '#6a625c' : regionIdx === 4 ? '#6a6a72' : '#a8a296';
    const stoneD = darker(stone, 0.82);
    const roof = ROOF[regionIdx];
    const snow = R.id === 'frostfell';
    const zMin = -(LANES / 2) * LANE_W - 0.05, zMax = -zMin;
    const zLen = zMax - zMin;

    // ---- the wall
    if (tier === 0) {
        const n = Math.round(zLen / 0.15);
        for (let i = 0; i < n; i++) {
            const z = zMin + (i + 0.5) * (zLen / n);
            const h = wh + ((i * 7) % 3) * 0.04;
            P.cyl(i % 2 ? '#7a5a34' : '#6a4a2a', [-0.18, h / 2, z], [0.075, h, 0.075]);
            P.cone('#b8946a', [-0.18, h + 0.07, z], [0.075, 0.14, 0.075]);
        }
        for (const y of [wh * 0.35, wh * 0.75]) P.box('#5a3a1a', [-0.08, y, 0], [0.04, 0.06, zLen]);
        P.box('#6a4a2a', [-0.42, wh - 0.12, 0], [0.32, 0.06, zLen]);
    } else {
        P.box(stone, [-0.21, wh / 2, 0], [0.42, wh, zLen], [0, 0, 0], { rough: 0.05 });
        // block courses
        for (let row = 0; row < 4; row++) for (let i = 0; i < 18; i++) {
            const z = zMin + ((i + (row % 2) * 0.5) / 18) * zLen;
            if (z > zMax - 0.1) continue;
            P.box((i + row) % 3 ? stoneD : lighter(stone, 1.08), [0.005, wh * (0.12 + row * 0.22), z], [0.02, wh * 0.18, zLen / 18 * 0.92]);
        }
        const merl = Math.round(zLen / 0.32);
        for (let i = 0; i < merl; i++) P.box(stone, [-0.04, wh + 0.09, zMin + (i + 0.5) * (zLen / merl)], [0.12, 0.18, 0.16]);
        if (snow) P.box('#f4f8fc', [-0.21, wh + 0.01, 0], [0.44, 0.03, zLen]);
        if (tier === 2) {
            for (const y of [wh * 0.3, wh * 0.72]) P.box('#3a3a40', [0.01, y, 0], [0.03, 0.05, zLen], [0, 0, 0], { rough: 0.02 });
            for (let i = 0; i < LANES; i++) {
                const z = laneZ(i) + LANE_W / 2;
                if (i < LANES - 1) { P.box('#8a1a1a', [0.03, wh * 0.55, z], [0.02, wh * 0.6, 0.22]); P.box('#ffd24a', [0.04, wh * 0.62, z], [0.02, 0.06, 0.06]); }
            }
        }
    }

    // ---- towers (stepped fighting platforms)
    for (let lane = 0; lane < LANES; lane++) {
        const t = c.towers[lane];
        const z = laneZ(lane);
        for (let k = 0; k < t; k++) {
            const x = wallSlotX(k);
            const top = slotY(c, k) - 0.06;
            const col = tier === 0 ? (k % 2 ? '#6a4a2a' : '#7a5a34') : (k % 2 ? stoneD : stone);
            if (tier === 0) {
                for (const dz of [-0.38, 0.38]) for (const dx of [-0.32, 0.32]) P.cyl('#5a3a1a', [x + dx, top / 2, z + dz], [0.06, top, 0.06]);
                P.box(col, [x, top - 0.04, z], [0.86, 0.08, 0.98]);
                for (let i = 0; i < 6; i++) P.cyl('#7a5a34', [x - 0.42 + i * 0.17, top + 0.12, z + 0.47], [0.035, 0.24, 0.035]);
            } else {
                P.box(col, [x, top / 2, z], [0.88, top, 1.0], [0, 0, 0], { rough: 0.05 });
                for (const dz of [-0.44, 0.44]) for (let i = 0; i < 3; i++) P.box(col, [x - 0.3 + i * 0.3, top + 0.08, z + dz], [0.16, 0.16, 0.1]);
                P.box(darker(col, 0.6), [0.0 + x + 0.441, top * 0.45, z], [0.01, 0.22, 0.1]);
                P.add('cyl', darker(col, 0.6), [x + 0.44, top * 0.45 + 0.11, z], [0.05, 0.01, 0.05], [0, 0, Math.PI / 2]);
                if (snow) P.box('#f4f8fc', [x, top + 0.005, z], [0.9, 0.02, 1.02]);
            }
        }
        if (t > 0) {
            const x = wallSlotX(t - 1) - 0.36;
            const top = slotY(c, t - 1);
            P.cyl('#5a4a3a', [x, top + 0.5, z - 0.4], [0.015, 1.0, 0.015]);
            P.box(roof, [x + 0.14, top + 0.86, z - 0.4], [0.26, 0.2, 0.012], [0, 0, 0], { rough: 0.15 });
            P.box('#ffd24a', [x + 0.14, top + 0.86, z - 0.395], [0.06, 0.06, 0.012]);
        }
    }

    // ---- curtain walls to the keep
    const kl = keepLevel(c);
    const kx = -4.4;
    for (const s of [-1, 1]) {
        P.box(tier ? stoneD : '#6a4a2a', [(-0.4 + kx) / 2, wh * 0.4, s * (zMax - 0.05)], [Math.abs(kx + 0.4), wh * 0.8, 0.22]);
        P.cyl(tier ? stone : '#7a5a34', [-0.25, (wh + 0.35) / 2, s * zMax], [0.3, wh + 0.35, 0.3]);
        P.cone(roof, [-0.25, wh + 0.55, s * zMax], [0.36, 0.45, 0.36], [0, 0, 0], { rough: 0.1 });
    }

    // ---- the keep
    const kw = 1.4 + 0.14 * kl, kh = 1.3 + 0.32 * kl;
    P.box(stone, [kx, kh / 2, 0], [kw, kh, kw * 1.2], [0, 0, 0], { rough: 0.05 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) P.box(stone, [kx + kw / 2 - 0.08, kh + 0.1, s * (0.15 + i * kw * 0.16)], [0.16, 0.2, 0.14]);
    for (let r = 0; r < Math.min(3, kl); r++) for (const s of [-1, 1]) {
        P.box('#2a2018', [kx + kw / 2 + 0.005, kh * (0.35 + r * 0.22), s * kw * 0.28], [0.02, 0.18, 0.1]);
        P.box('#ffcf6a', [kx + kw / 2 + 0.012, kh * (0.35 + r * 0.22), s * kw * 0.28], [0.01, 0.13, 0.07], [0, 0, 0], { glow: true });
    }
    P.box('#4a3020', [kx + kw / 2 + 0.01, 0.3, 0], [0.03, 0.6, 0.4]);
    P.add('cyl', '#4a3020', [kx + kw / 2 + 0.01, 0.6, 0], [0.2, 0.03, 0.2], [0, 0, Math.PI / 2]);
    if (snow) P.box('#f4f8fc', [kx, kh + 0.01, 0], [kw + 0.02, 0.03, kw * 1.2 + 0.02]);
    if (kl < 3) {
        // A pitched roof until the great tower rises through it.
        P.add('cone4', roof, [kx, kh + 0.55, 0], [kw * 0.82, 0.95, kw * 0.95], [0, Math.PI / 4, 0], { rough: 0.12 });
    }
    const turrets = kl >= 4 ? 4 : kl >= 2 ? 2 : 0;
    const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].slice(0, turrets);
    for (const [sx, sz] of corners) {
        const tx = kx + sx * kw / 2, tz = sz * kw * 0.6, th = kh + 0.5;
        P.cyl(stone, [tx, th / 2, tz], [0.28, th, 0.28]);
        P.cone(roof, [tx, th + 0.35, tz], [0.36, 0.7, 0.36], [0, 0, 0], { rough: 0.12 });
        P.cyl('#5a4a3a', [tx, th + 0.85, tz], [0.012, 0.35, 0.012]);
        P.box(roof, [tx + 0.1, th + 0.95, tz], [0.18, 0.12, 0.01]);
    }
    let beaconY = kl < 3 ? kh + 1.12 : kh + 0.25;
    if (kl >= 3) {
        const gh = kh + 0.7 + kl * 0.15;
        P.cyl(stone, [kx - 0.1, gh / 2, 0], [0.42, gh, 0.42]);
        for (let i = 0; i < 8; i++) P.box(stone, [kx - 0.1 + Math.cos(i * 0.785) * 0.4, gh + 0.08, Math.sin(i * 0.785) * 0.4], [0.12, 0.16, 0.12]);
        beaconY = gh + 0.15;
    }
    const bx = kl >= 3 ? kx - 0.1 : kx;
    // the beacon brazier
    P.cyl('#3a3a40', [bx, beaconY, 0], [0.16, 0.22, 0.16], [0, 0, 0], { rough: 0.02 });
    P.cyl('#2a2a2e', [bx, beaconY - 0.15, 0], [0.06, 0.12, 0.06]);
    if (c.keepfire > 0) P.add('sph', '#ffb02a', [bx, beaconY + 0.12, 0], [0.13, 0.09, 0.13], [0, 0, 0], { glow: true });
    // banners on the keep
    for (const s of [-1, 1]) {
        P.box(roof, [kx + kw / 2 + 0.02, kh * 0.68, s * kw * 0.5], [0.02, kh * 0.5, 0.26], [0, 0, 0], { rough: 0.15 });
        P.box('#ffd24a', [kx + kw / 2 + 0.03, kh * 0.74, s * kw * 0.5], [0.02, 0.1, 0.1], [0, 0, 0], { glow: kl >= 5 });
    }

    // ---- outbuildings
    if (c.forge > 0) {
        const fx = -2.6, fz = 2.55;
        P.box('#7a6a5a', [fx, 0.3, fz], [0.8, 0.6, 0.6]);
        P.cone('#5a3a2a', [fx, 0.75, fz], [0.62, 0.35, 0.48], [0, Math.PI / 4, 0]);
        P.box('#5a5050', [fx - 0.25, 0.85, fz - 0.15], [0.15, 0.6, 0.15]);
        P.box('#ff7a2a', [fx + 0.41, 0.2, fz], [0.01, 0.22, 0.26], [0, 0, 0], { glow: true });
        P.box('#3a3a40', [fx + 0.6, 0.15, fz + 0.15], [0.2, 0.1, 0.12]);
    }
    if (c.treasury > 0) {
        const tx = -2.6, tz = -2.55;
        P.box('#c8b89a', [tx, 0.35, tz], [0.7, 0.7, 0.6]);
        P.add('sph2', '#ffd24a', [tx, 0.72, tz], [0.32, 0.26, 0.28], [0, 0, 0], { rough: 0.02 });
        P.box('#4a3020', [tx + 0.36, 0.22, tz], [0.02, 0.35, 0.2]);
        for (let i = 0; i < Math.min(c.treasury, 6); i++) P.cyl('#ffd24a', [tx + 0.45 + (i % 3) * 0.1, 0.03 + Math.floor(i / 3) * 0.04, tz + 0.25], [0.04, 0.03, 0.04], [0, 0, 0], { glow: true });
    }
    if (c.ramparts > 0) {
        const n = 26;
        const len = 0.2 + 0.035 * c.ramparts;
        for (let i = 0; i < n; i++) {
            const z = zMin + (i + 0.5) * (zLen / n);
            P.limb(c.ramparts >= 5 ? '#8a8a94' : '#8a6a3a', [0.0, 0.12 + (i % 2) * 0.12, z], [len, 0.25 + (i % 2) * 0.15, z], 0.03, 'cone');
        }
    }
    const built = P.build();
    const group = new THREE.Group();
    const mat = actorMaterial({ rough: 0.88 });
    const m = new THREE.Mesh(built.solid, mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    if (built.glow) group.add(new THREE.Mesh(built.glow, GLOW_MAT));
    return {
        group, mat,
        beacon: new THREE.Vector3(bx, beaconY + 0.15, 0),
        forge: c.forge > 0 ? new THREE.Vector3(-2.85, 1.2, 2.4) : null,
        wallH: wh,
        dispose() { built.solid.dispose(); built.glow?.dispose(); mat.dispose(); },
    };
}
