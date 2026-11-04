// The way into Gearfall. The ladder down from the trap door behind the Great
// Gear ends in a long industrial corridor: steel ribs every few metres, pipes
// and cable trays down the walls, a duct along the ceiling, caged lamps (some
// dead, some stuttering), steam leaking from the joints, puddles, a fallen
// beam, old signs. At its end is a high vault hall and a huge blast door,
// locked by a great gear, with a keypad beside it. Give it the right code and
// the beacon turns green, the gear spins and rises into the lintel, the bolts
// draw back and the two halves of the door grind apart on daylight, dust and
// a dirt road. Outside, the door is set in a concrete face dug into a mound.

import * as THREE from 'three';
import { Acc, C, mat, cyl, cone, sphere, quad, vquad, gearGeo, tube, sag, rusty, grimy, rock, WALL_IN, FLOOR, TAU } from './gearfall-kit.js';
import { DOOR_Z, HALL_D, HALL_W, HALL_H, CORR_W, CORR_H, CORR_L, SPAWN_Z } from './gearfall-land.js';
import { Signs, signRow } from './gearfall-street.js';
import { rng, clamp, smoothstep, lerp } from './util.js';

const V3 = THREE.Vector3;
const Z0 = DOOR_Z, ZH = DOOR_Z + HALL_D, ZE = DOOR_Z + HALL_D + CORR_L;   // door, end of the hall, end of the corridor
const HW = HALL_W / 2, CW = CORR_W / 2;
const DOOR_W = 8, DOOR_H = 8, WALL_Z0 = Z0 - 0.9, WALL_Z1 = Z0 + 0.7;    // the front wall, door in it
const CONC = grimy('#6a6862', 0.35), CONC_IN = C('#5a5a54'), STEEL = rusty('#4a5056', 0.45, 1.6), RUST = rusty('#5a4a3a', 0.8, 2.2);
const HAZ_Y = C('#c8a020'), HAZ_K = C('#1a1814');

export const LADDER = { x: 0, z: ZE - 0.75 };   // stand here and you climb out

export class Bunker {
    /** @param {object} o { scene, material, signMat } */
    constructor(o) {
        this.scene = o.scene;
        this.cols = [];
        this.doorCols = [];
        this.lights = [];
        this.steam = [];
        this.r = rng('gearfall-bunker');
        const acc = new Acc();
        this.signs = new Signs();
        this.acc = acc;
        this._corridor();
        this._hall();
        this._outside();
        this.mesh = new THREE.Mesh(acc.build(), o.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
        const sg = this.signs.build();
        if (sg) {
            this.signMesh = new THREE.Mesh(sg, o.signMat);
            this.scene.add(this.signMesh);
        }
        this._door(o.material);
        this._fan(o.material);
        this.spawn = { x: 0, z: SPAWN_Z, yaw: 0 };
        this.exit = { ...LADDER };
        this.state = 'locked';   // 'locked' | 'opening' | 'open'
        this.t = 0;
    }

    // ------------------------------------------------------------ helpers

    _colLine(ax, az, bx, bz, r = 0.25, into = this.cols) {
        const L = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.ceil(L / 0.4));
        for (let i = 0; i <= n; i++) into.push({ x: lerp(ax, bx, i / n), z: lerp(az, bz, i / n), r });
    }

    _light(x, y, z, o = {}) {
        this.lights.push({ x, y, z, color: o.color ?? 0xffd8a0, flick: o.flick ?? 0, power: o.power ?? 1.2, range: o.range ?? 9, kind: 'in' });
    }

    // ------------------------------------------------------------ the long corridor

    _corridor() {
        const { acc, r } = this;
        const T = 0.4;
        const mid = (ZH + ZE) / 2, L = ZE - ZH;
        const wallIn = (face) => (face === 0 || face === 1 || face === 4 || face === 5 ? 1 : 0.6);
        // floor, walls, ceiling (the ceiling has the ladder's shaft cut in it at the far end)
        acc.box(CORR_W + T * 2, 0.2, L, mat(0, -0.18, mid), { color: C('#4a4a46'), inside: 1, win: FLOOR.concrete, seed: 0.3 });
        for (const s of [-1, 1]) {
            acc.box(T, CORR_H, L, mat(s * (CW + T / 2), 0, mid), { color: CONC_IN, inside: wallIn, win: WALL_IN, seed: 0.2 });
            this._colLine(s * CW, ZH, s * CW, ZE, 0.22);
        }
        acc.box(CORR_W + T * 2, CORR_H, T, mat(0, 0, ZE + T / 2), { color: CONC_IN, inside: wallIn, win: WALL_IN, seed: 0.7 });
        this._colLine(-CW, ZE, CW, ZE, 0.22);
        const shaft0 = ZE - 1.4;
        acc.box(CORR_W + T * 2, T, shaft0 - ZH, mat(0, CORR_H, (ZH + shaft0) / 2), { color: C('#3e3e3a'), inside: 1 });
        acc.box(CW - 0.6 + T, T, ZE - shaft0, mat(-(0.6 + (CW - 0.6 + T) / 2), CORR_H, (shaft0 + ZE) / 2), { color: C('#3e3e3a'), inside: 1 });
        acc.box(CW - 0.6 + T, T, ZE - shaft0, mat(0.6 + (CW - 0.6 + T) / 2, CORR_H, (shaft0 + ZE) / 2), { color: C('#3e3e3a'), inside: 1 });
        // the shaft up to the trap door, with daylight (or night) at the top
        for (const s of [-1, 1]) acc.box(0.15, 4, ZE - shaft0, mat(s * 0.68, CORR_H, (shaft0 + ZE) / 2), { color: CONC_IN, inside: 1 });
        acc.box(1.2, 4, 0.15, mat(0, CORR_H, shaft0 - 0.07), { color: CONC_IN, inside: 1 });
        acc.box(1.2, 0.05, 1.4, mat(0, CORR_H + 4, (shaft0 + ZE) / 2), { color: C('#d8e0c0'), glow: 1.6, inside: 1 });
        // the ladder: rails and rungs up the end wall into the shaft
        for (const s of [-1, 1]) acc.box(0.06, CORR_H + 3.8, 0.06, mat(s * 0.25, 0, ZE - 0.12), { colorFn: STEEL, inside: 1 });
        for (let y = 0.3; y < CORR_H + 3.6; y += 0.3) acc.box(0.5, 0.035, 0.035, mat(0, y, ZE - 0.12), { colorFn: STEEL, inside: 1 });
        this.signs.add(mat(0, 3.1, ZE - 0.02, Math.PI), 2.4, r, { row: signRow('TO THE SURFACE'), fl: -3, h: 0.35 });
        // a grating down the middle, edged in hazard paint
        acc.box(1.6, 0.03, L, mat(0, -0.0, mid), { color: C('#2a2c2c'), inside: 1 });
        for (let z = ZH + 0.2; z < ZE; z += 0.25) acc.box(1.55, 0.04, 0.04, mat(0, 0, z), { colorFn: STEEL, inside: 1 });

        // steel ribs, and the services along the walls
        for (let z = ZH + 2; z < ZE - 1; z += 4) {
            const dead = r() < 0.06;
            for (const s of [-1, 1]) acc.box(0.3, CORR_H, 0.25, mat(s * (CW - 0.15), 0, z, 0, 1, 1, 1, 0, dead && s > 0 ? 0.06 : 0), { colorFn: STEEL, inside: 1 });
            acc.box(CORR_W, 0.35, 0.25, mat(0, CORR_H - 0.35, z), { colorFn: STEEL, inside: 1 });
            for (const s of [-1, 1]) this.cols.push({ x: s * (CW - 0.15), z, r: 0.25 });
        }
        // pipes down the left wall, flanged every so often
        const pipes = [[3.7, 0.16, '#6a2a1a'], [4.15, 0.11, '#5a6a5a'], [2.9, 0.08, '#b0902a'], [0.35, 0.2, '#4a4a48']];
        for (const [y, rad, colr] of pipes) {
            acc.add(cyl(10), mat(-CW + 0.25 + rad, y, ZH, 0, rad, L, rad, Math.PI / 2), { colorFn: rusty(colr, 0.55, 1.6), inside: 1 });
            for (let z = ZH + 3; z < ZE; z += 6 + r() * 3) acc.add(cyl(10), mat(-CW + 0.25 + rad, y, z, 0, rad * 1.45, 0.12, rad * 1.45, Math.PI / 2), { colorFn: RUST, inside: 1 });
        }
        // where the joints leak steam
        for (let i = 0; i < 6; i++) this.steam.push({ x: -CW + 0.5, y: r.pick([3.7, 4.15]), z: ZH + 6 + r() * (L - 12), dir: new V3(0.6, -0.2, 0) });
        // valves
        for (let i = 0; i < 5; i++) {
            const z = ZH + 8 + i * 17 + r() * 4;
            acc.add(new THREE.TorusGeometry(0.22, 0.03, 5, 12), mat(-CW + 0.65, 3.7, z, Math.PI / 2), { color: C('#8a2a1a'), inside: 1 });
            acc.add(cyl(6), mat(-CW + 0.25, 3.7, z, 0, 0.03, 0.45, 0.03, 0, -Math.PI / 2), { colorFn: STEEL, inside: 1 });
        }
        // a cable tray down the right wall, cables sagging between its brackets, and a duct along the roof
        acc.box(0.45, 0.06, L, mat(CW - 0.3, 4.25, mid), { colorFn: STEEL, inside: 1 });
        for (let z = ZH + 1; z < ZE - 4; z += 4) {
            for (let k = 0; k < 3; k++) acc.add(tube(sag(new V3(CW - 0.2 - k * 0.12, 4.28, z), new V3(CW - 0.2 - k * 0.12, 4.28, z + 4), 0.15 + k * 0.08 + r() * 0.1, 6), 0.025, 6, 3), mat(0, 0, 0), { color: C(['#1a1a1a', '#3a1a1a', '#1a2a3a'][k]), inside: 1, sway: 0.02 });
            if (r() < 0.12) {
                // one cable come loose, hanging nearly to the floor
                const x = CW - 0.3, Lh = r.range(2, 3.6);
                acc.add(tube([new V3(x, 4.25, z + 2), new V3(x - 0.2, 4.25 - Lh * 0.5, z + 2.1), new V3(x - 0.4, 4.25 - Lh, z + 2.3)], 0.025, 6, 3), mat(0, 0, 0), { color: C('#1a1a1a'), inside: 1, sway: 0.2, swayH: 1 });
            }
        }
        acc.box(1.0, 0.6, L - 4, mat(-0.6, CORR_H - 0.95, mid - 1), { colorFn: rusty('#6a6e6a', 0.4, 1), inside: 1 });
        // caged lamps, alternating sides; some dead, some stuttering
        let k = 0;
        for (let z = ZH + 4; z < ZE - 2; z += 8) {
            const s = k++ % 2 ? 1 : -1;
            const q = r();
            const state = z > ZE - 10 ? 'on' : q < 0.25 ? 'dead' : q < 0.65 ? 'flick' : 'on';
            const fl = state === 'flick' ? r.range(0.02, 1) : 0;
            const x = s * (CW - 0.18);
            acc.box(0.3, 0.4, 0.25, mat(x, 2.9, z), { colorFn: STEEL, inside: 1 });
            acc.box(0.22, 0.3, 0.18, mat(x - s * 0.1, 2.95, z), { color: state === 'dead' ? C('#3a3a30') : C('#ffe0a8'), glow: state === 'dead' ? 0 : 2.4, flick: fl, inside: 1 });
            for (let i = -1; i <= 1; i++) acc.box(0.02, 0.4, 0.02, mat(x - s * 0.2, 2.9, z + i * 0.1), { color: C('#1a1a1a'), inside: 1 });
            if (state !== 'dead') this._light(x - s * 0.6, 3.0, z, { flick: fl, power: 1.1, range: 9 });
        }
        // signs on the walls
        this.signs.add(mat(CW - 0.02, 2.2, ZH + 12, -Math.PI / 2), 2.6, r, { row: signRow('SUBLEVEL 7'), fl: -3, h: 0.5 });
        this.signs.add(mat(-CW + 0.02, 2.0, ZH + 40, Math.PI / 2), 3.6, r, { row: signRow('DANGER  HIGH VOLTAGE'), fl: -3, h: 0.32 });
        this.signs.add(mat(CW - 0.02, 2.2, ZH + 66, -Math.PI / 2), 3.8, r, { row: signRow('AUTHORISED PERSONNEL ONLY'), fl: -3, h: 0.3 });
        // fuse boxes, a fallen beam to step round, rubble, barrels, puddles and paper
        for (let i = 0; i < 4; i++) {
            const z = ZH + 10 + i * 21 + r() * 5;
            acc.box(0.6, 0.9, 0.2, mat(CW - 0.12, 1.3, z, -Math.PI / 2), { colorFn: rusty('#4a5a4a', 0.5, 2), inside: 1 });
            if (r() < 0.5) acc.box(0.55, 0.85, 0.03, mat(CW - 0.3, 1.32, z + 0.1, -Math.PI / 2 + 1.2), { colorFn: rusty('#4a5a4a', 0.5, 2), inside: 1 });
        }
        const bz = ZH + 47;
        acc.box(0.35, 0.4, 5.6, mat(0.4, 0.1, bz, 0.35, 1, 1, 1, -0.55).multiply(mat(0, 0, 2.6)), { colorFn: STEEL, inside: 1 });
        acc.box(CORR_W * 0.5, 0.06, 2, mat(0.9, 0.03, bz + 3.2, 0.3, 1, 1, 1, -0.5).multiply(mat(0, 0, 0.9)), { color: C('#4a4a46'), inside: 1 });
        this._colLine(0.4, bz, 1.4, bz + 2.4, 0.3);
        for (let i = 0; i < 10; i++) {
            const s = r.range(0.15, 0.5);
            acc.add(rock(r() * 6), mat(r.range(-0.6, 1.8), s * 0.2, bz + r.range(-1, 4), r() * 3, s), { color: C('#5a5850'), inside: 1 });
        }
        for (const [x, z] of [[1.8, ZH + 22], [1.75, ZH + 23], [-1.7, ZH + 73]]) {
            acc.add(cyl(10), mat(x, 0, z, 0, 0.3, 0.9, 0.3, r() < 0.3 ? 1.5 : 0), { colorFn: rusty('#6a5a2a', 0.6, 3), inside: 1 });
            this.cols.push({ x, z, r: 0.35 });
        }
        for (let i = 0; i < 9; i++) acc.add(sphere(10, 2), mat(r.range(-1.8, 1.8), 0.012, ZH + r() * L, 0, r.range(0.4, 1.3), 0.004, r.range(0.5, 1.6)), { color: C('#0e1214'), inside: 1 });
        for (let i = 0; i < 40; i++) acc.add(quad(), mat(r.range(-CW + 0.2, CW - 0.2), 0.02 + i * 0.0005, ZH + r() * L, r() * TAU, 0.21, 1, 0.29), { color: C('#c8bc9a').multiplyScalar(0.6 + r() * 0.4), inside: 1 });
        // a vent with a fan in it, half way along
        this.fanAt = new V3(CW - 0.05, 1.4, ZH + 30);
        acc.box(0.1, 1.2, 1.2, mat(CW - 0.02, 0.8, ZH + 30), { colorFn: STEEL, inside: 1 });
        acc.box(0.1, 1.0, 1.0, mat(CW - 0.05, 0.9, ZH + 30), { color: C('#050505'), inside: 1 });
    }

    // ------------------------------------------------------------ the vault hall

    _hall() {
        const { acc, r } = this;
        const T = 0.5;
        const mid = (WALL_Z1 + ZH) / 2, D = ZH - WALL_Z1;
        acc.box(HALL_W + 1, 0.2, D + 0.6, mat(0, -0.18, mid - 0.3), { color: C('#4a4a46'), inside: 1, win: FLOOR.concrete, seed: 0.6 });
        for (const s of [-1, 1]) {
            acc.box(T, HALL_H, D, mat(s * (HW + T / 2), 0, mid), { color: CONC_IN, inside: (f) => (f === (s < 0 ? 0 : 1) ? 1 : 0), win: WALL_IN, seed: 0.4 });
            this._colLine(s * HW, WALL_Z1, s * HW, ZH, 0.25);
            // the back wall, either side of the corridor's mouth
            acc.box(HW - CW, HALL_H, T, mat(s * (CW + (HW - CW) / 2), 0, ZH + T / 2), { color: CONC_IN, inside: (f) => (f === 5 ? 1 : 0), win: WALL_IN, seed: 0.5 });
            this._colLine(s * CW, ZH, s * HW, ZH, 0.25);
        }
        acc.box(CORR_W, HALL_H - CORR_H, T, mat(0, CORR_H, ZH + T / 2), { color: CONC_IN, inside: (f) => (f === 5 ? 1 : 0) });
        acc.box(HALL_W + 1, T, D + 1, mat(0, HALL_H, mid), { color: C('#3a3a36'), inside: (f) => (f === 3 ? 1 : 0) });
        // girders across the roof, a gantry crane rusted in place
        for (let z = WALL_Z1 + 3; z < ZH; z += 4) acc.box(HALL_W, 0.6, 0.4, mat(0, HALL_H - 0.6, z), { colorFn: STEEL, inside: 1 });
        acc.box(0.5, 0.5, D, mat(-3, HALL_H - 1.1, mid), { colorFn: STEEL, inside: 1 });
        acc.box(0.8, 0.6, 0.8, mat(-3, HALL_H - 1.7, mid + 2), { colorFn: rusty('#8a6a2a', 0.5), inside: 1 });
        acc.add(tube([new V3(-3, HALL_H - 1.7, mid + 2), new V3(-3, 3, mid + 2.1), new V3(-3, 1.6, mid + 2.2)], 0.03, 6, 3), mat(0, 0, 0), { colorFn: STEEL, inside: 1, sway: 0.05, swayH: -8 });
        acc.add(new THREE.TorusGeometry(0.25, 0.06, 6, 12), mat(-3, 1.4, mid + 2.2), { colorFn: STEEL, inside: 1, sway: 0.05 });

        // the front wall: concrete, the door opening in it, hazard paint round it
        const WT = WALL_Z1 - WALL_Z0, wm = (WALL_Z0 + WALL_Z1) / 2;
        const outsideFace = (f) => (f === 4 ? 1 : 0);   // +z faces the hall
        const FW = 15;
        for (const s of [-1, 1]) {
            acc.box(FW - DOOR_W / 2, 13, WT, mat(s * (DOOR_W / 2 + (FW - DOOR_W / 2) / 2), 0, wm), { colorFn: (v, n, w, f) => (f === 4 ? CONC_IN : CONC(v, n, w)), inside: outsideFace, win: WALL_IN, seed: 0.9 });
            this._colLine(s * (DOOR_W / 2 + 0.1), WALL_Z1 + 0.1, s * HW, WALL_Z1 + 0.1, 0.25);
            this._colLine(s * (DOOR_W / 2 + 0.1), WALL_Z0 - 0.1, s * FW, WALL_Z0 - 0.1, 0.25);
            this._colLine(s * (DOOR_W / 2 + 0.15), WALL_Z0, s * (DOOR_W / 2 + 0.15), WALL_Z1, 0.25);
        }
        acc.box(DOOR_W, 13 - DOOR_H, WT, mat(0, DOOR_H, wm), { colorFn: (v, n, w, f) => (f === 4 ? CONC_IN : CONC(v, n, w)), inside: outsideFace });
        // hazard stripes round the opening, on both faces
        for (const zf of [WALL_Z1 + 0.02, WALL_Z0 - 0.02]) {
            const insideF = zf > wm ? 1 : 0;
            const n = 14;
            for (let i = 0; i < n; i++) {
                const y = (i / n) * DOOR_H;
                for (const s of [-1, 1]) acc.box(0.5, DOOR_H / n, 0.04, mat(s * (DOOR_W / 2 + 0.25), y, zf), { color: i % 2 ? HAZ_Y : HAZ_K, inside: insideF });
            }
            for (let i = 0; i < 18; i++) acc.box((DOOR_W + 1) / 18, 0.5, 0.04, mat(-DOOR_W / 2 - 0.5 + (i + 0.5) * (DOOR_W + 1) / 18, DOOR_H, zf), { color: i % 2 ? HAZ_Y : HAZ_K, inside: insideF });
        }
        // the beacon over the door
        acc.box(0.6, 0.3, 0.4, mat(0, DOOR_H + 0.8, WALL_Z1 + 0.2), { colorFn: STEEL, inside: 1 });
        this.beaconAt = new V3(0, DOOR_H + 1.35, WALL_Z1 + 0.35);
        // floodlights high on the side walls
        for (const s of [-1, 1]) {
            const fl = s < 0 ? r.range(0.02, 1) : 0;
            acc.box(0.7, 0.5, 0.5, mat(s * (HW - 0.3), 7.5, ZH - 4, 0, 1, 1, 1, 0.3), { colorFn: STEEL, inside: 1 });
            acc.box(0.55, 0.38, 0.05, mat(s * (HW - 0.3), 7.55, ZH - 4.27, 0, 1, 1, 1, 0.3), { color: C('#fff0c8'), glow: 2.6, flick: fl, inside: 1 });
            this._light(s * (HW - 1.5), 7, ZH - 6, { flick: fl, power: 3.4, range: 20, color: 0xfff0d0 });
        }
        // a working lamp over the keypad, so the door can be seen
        acc.box(0.5, 0.25, 0.4, mat(DOOR_W / 2 + 1.6, 6, WALL_Z1 + 0.3), { colorFn: STEEL, inside: 1 });
        acc.box(0.42, 0.04, 0.3, mat(DOOR_W / 2 + 1.6, 5.98, WALL_Z1 + 0.32), { color: C('#ffe8c0'), glow: 2.4, inside: 1 });
        this._light(DOOR_W / 2, 5.4, WALL_Z1 + 2.5, { power: 2.2, range: 16, color: 0xffe0b0 });
        // the keypad, on a post to the right of the door
        const kx = DOOR_W / 2 + 1.6, kz = WALL_Z1 + 0.6;
        acc.box(0.2, 1.25, 0.2, mat(kx, 0, kz), { colorFn: STEEL, inside: 1 });
        acc.box(0.55, 0.75, 0.22, mat(kx, 1.15, kz, 0, 1, 1, 1, -0.25), { colorFn: rusty('#3a4a44', 0.4, 2), inside: 1 });
        this.screenMat = new THREE.MeshBasicMaterial({ color: 0x3aff7a });
        this.keypadAt = new V3(kx, 1.5, kz + 0.15);
        this.cols.push({ x: kx, z: kz, r: 0.3 });
        this.signs.add(mat(kx, 2.1, kz + 0.12), 0.9, r, { row: signRow('ENTER CODE'), fl: 0.6, h: 0.2 });
        this.signs.add(mat(0, 9.8, WALL_Z1 + 0.04), 4, r, { row: signRow('VAULT'), fl: -3, h: 0.9 });
        // stuff left about: crates, a cart, a drift of paper
        for (const [x, z, s] of [[-5.5, ZH - 2, 1.2], [-5.3, ZH - 3.4, 1], [-5.6, ZH - 2.6, 0.9], [5.6, ZH - 1.8, 1.1]]) {
            acc.box(s, s * 0.8, s, mat(x, 0, z, r() * 0.4), { color: C('#6a5236').multiplyScalar(0.7 + r() * 0.3), inside: 1 });
            this.cols.push({ x, z, r: s * 0.7 });
        }
        for (let i = 0; i < 30; i++) acc.add(quad(), mat(r.range(-HW + 0.5, HW - 0.5), 0.02 + i * 0.0005, r.range(WALL_Z1 + 0.5, ZH - 0.5), r() * TAU, 0.21, 1, 0.29), { color: C('#c8bc9a').multiplyScalar(0.6 + r() * 0.4), inside: 1 });
    }

    // ------------------------------------------------------------ outside: the concrete face and the mound over it all

    _outside() {
        const { acc, r } = this;
        const cz = (Z0 + ZE) / 2 + 4, rx = 27, rz = (ZE - Z0) / 2 + 20;
        const H = (x, z) => {
            if (z < WALL_Z0) return 0;
            const e = 1 - (x / rx) ** 2 - ((z - cz) / rz) ** 2;
            return e <= 0 ? 0 : 17 * Math.sqrt(e) * (0.9 + 0.1 * Math.sin(x * 0.4 + z * 0.13)) + 0.0;
        };
        const nx = 40, nz = 90;
        const pos = [], idx = [];
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
            const x = -rx + (i / nx) * rx * 2, z = WALL_Z0 + (j / nz) * (cz + rz - WALL_Z0);
            pos.push(x, H(x, z) - 0.3, z);
        }
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
            const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const earth = C('#4a3e30'), grass = C('#5a5232');
        acc.add(g, mat(0, 0, 0), { colorFn: (v, n, w) => earth.clone().lerp(grass, clamp(n.y * 1.4 - 0.4, 0, 1) * (0.5 + 0.5 * Math.sin(w.x * 0.7 + w.z * 0.3))) });
        // its edge is solid, as is the concrete face
        for (let a = 0; a < TAU; a += 0.02) {
            const x = Math.cos(a) * rx * 0.97, z = cz + Math.sin(a) * rz * 0.97;
            if (z < WALL_Z0 + 0.4) continue;
            this.cols.push({ x, z, r: 0.6 });
        }
        // rocks strewn on the mound
        for (let i = 0; i < 40; i++) {
            const x = r.range(-rx * 0.8, rx * 0.8), z = r.range(WALL_Z0 + 4, cz + rz * 0.8);
            const h = H(x, z);
            if (h < 0.5) continue;
            const s = r.range(0.3, 1.4);
            acc.add(rock(r() * 6), mat(x, h - 0.2, z, r() * 3, s), { color: C('#5a5246').multiplyScalar(0.8 + r() * 0.3) });
        }
        // the hall's roof and walls showing where the mound is thin
        acc.box(HALL_W + 2, 1.2, ZH - WALL_Z1 + 1, mat(0, HALL_H + 0.3, (WALL_Z1 + ZH) / 2), { colorFn: CONC });
        // the face: a rusted sign over the door, a floodlight, sandbags, barrels, a broken fence
        acc.box(30, 0.6, 1.4, mat(0, 13, (WALL_Z0 + WALL_Z1) / 2), { colorFn: CONC });
        this.signs.add(mat(0, 10.5, WALL_Z0 - 0.06, Math.PI), 5, r, { row: signRow('SUBLEVEL 7'), fl: -2, h: 1 });
        for (const s of [-1, 1]) {
            acc.box(0.6, 0.45, 0.5, mat(s * 6.5, 9.2, WALL_Z0 - 0.3, Math.PI, 1, 1, 1, 0.4), { colorFn: STEEL });
            const fl = s > 0 ? r.range(0.02, 1) : 0;
            const on = s > 0;
            acc.box(0.48, 0.34, 0.05, mat(s * 6.5, 9.25, WALL_Z0 - 0.55, Math.PI, 1, 1, 1, 0.4), { color: on ? C('#fff0c8') : C('#3a3a30'), glow: on ? 2.4 : 0, flick: fl });
            if (on) this.lights.push({ x: s * 6.5, y: 8.5, z: WALL_Z0 - 2.5, color: 0xfff0d0, flick: fl, power: 2, range: 18, kind: 'street' });
        }
        for (let i = 0; i < 14; i++) {
            const s = i < 7 ? -1 : 1, k = i % 7;
            acc.add(sphere(8, 5), mat(s * (5.6 + (k % 4) * 0.7), 0.25 + Math.floor(k / 4) * 0.4, WALL_Z0 - 1.2, r.range(-0.2, 0.2), 0.42, 0.22, 0.3), { color: C('#6a5e44').multiplyScalar(0.8 + r() * 0.3) });
        }
        for (const s of [-1, 1]) this._colLine(s * 5.4, WALL_Z0 - 1.2, s * 8.2, WALL_Z0 - 1.2, 0.35);
        for (const [x, z] of [[-9, WALL_Z0 - 2], [-9.6, WALL_Z0 - 2.8], [10, WALL_Z0 - 1.6]]) {
            acc.add(cyl(10), mat(x, 0, z, 0, 0.3, 0.9, 0.3), { colorFn: rusty('#2a4a3a', 0.6, 3) });
            this.cols.push({ x, z, r: 0.35 });
        }
        // a chain-link fence, mostly down
        for (let x = -24; x <= 24; x += 3) {
            if (Math.abs(x) < 6) continue;
            const lean = r() < 0.3 ? r.range(0.3, 1.4) : r.range(-0.1, 0.1);
            acc.add(cyl(5), mat(x, 0, WALL_Z0 - 12, 0, 0.04, 2.2, 0.04, lean), { colorFn: STEEL });
            if (r() < 0.6) acc.box(2.9, 1.9, 0.02, mat(x + 1.5, 0.2, WALL_Z0 - 12, 0, 1, 1, 1, lean * 0.6), { color: C('#4a4c4a') });
        }
    }

    // ------------------------------------------------------------ the door itself

    _door(material) {
        const r = this.r;
        const build = (side) => {
            const acc = new Acc();
            const w = DOOR_W / 2, zt = 0.8;
            const face = rusty('#5a5e5a', 0.55, 1.2);
            acc.box(w, DOOR_H, zt, mat(side * w / 2, 0, 0), { colorFn: face });
            // ribs, rivets, hazard chevrons along the meeting edge
            for (let y = 0.6; y < DOOR_H; y += 1.6) for (const zf of [-1, 1]) acc.box(w - 0.3, 0.3, 0.12, mat(side * w / 2, y, zf * (zt / 2 + 0.05)), { colorFn: rusty('#4a4e4a', 0.6, 1.5), inside: zf > 0 ? 1 : 0 });
            for (let y = 0.3; y < DOOR_H; y += 0.5) for (const zf of [-1, 1]) {
                acc.add(sphere(5, 3), mat(side * (w - 0.25), y, zf * (zt / 2 + 0.02), 0, 0.05), { color: C('#3a3a38'), inside: zf > 0 ? 1 : 0 });
                acc.add(sphere(5, 3), mat(side * 0.25, y, zf * (zt / 2 + 0.02), 0, 0.05), { color: C('#3a3a38'), inside: zf > 0 ? 1 : 0 });
            }
            for (let i = 0; i < 10; i++) for (const zf of [-1, 1]) acc.box(0.35, DOOR_H / 10, 0.03, mat(side * 0.18, i * DOOR_H / 10, zf * (zt / 2 + 0.11)), { color: i % 2 ? HAZ_Y : HAZ_K, inside: zf > 0 ? 1 : 0 });
            // half of a ring round the lock
            acc.add(new THREE.TorusGeometry(2.4, 0.18, 6, 28, Math.PI), mat(0, DOOR_H / 2, zt / 2 + 0.1, 0, 1, 1, 1, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2), { colorFn: rusty('#8a6a2a', 0.5, 2), inside: 1 });
            const m = new THREE.Mesh(acc.build(), material);
            m.position.set(0, 0, (WALL_Z0 + WALL_Z1) / 2 - 0.05);
            return m;
        };
        this.leafL = build(-1);
        this.leafR = build(1);
        // the great gear that locks it, and four bolts
        const ga = new Acc();
        ga.add(gearGeo(1), mat(0, 0, 0, 0, 2.1, 2.1, 2.1, Math.PI / 2), { colorFn: rusty('#8a6a2a', 0.45, 2.5), inside: 1 });
        ga.add(cyl(16), mat(0, 0, 0, 0, 0.5, 0.6, 0.5, Math.PI / 2), { colorFn: STEEL, inside: 1 });
        this.gear = new THREE.Mesh(ga.build(), material);
        this.gearY = DOOR_H / 2;
        this.gear.position.set(0, this.gearY, WALL_Z1 + 0.05);
        const ba = new Acc();
        ba.box(1.6, 0.35, 0.35, mat(0, -0.17, 0), { colorFn: STEEL, inside: 1 });
        this.bolts = [];
        for (const [x, y] of [[-1.5, 1.6], [1.5, 1.6], [-1.5, 6.4], [1.5, 6.4]]) {
            const b = new THREE.Mesh(ba.build(), material);
            b.position.set(x, y, WALL_Z1 + 0.15);
            b.userData.x0 = x;
            this.bolts.push(b);
        }
        // keypad screen and the hit targets
        this.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.14), this.screenMat);
        this.screen.position.copy(this.keypadAt).add(new V3(0, 0.08, 0.075));
        this.screen.rotation.x = -0.25;
        this.keypadHit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
        this.keypadHit.position.copy(this.keypadAt);
        this.keypadHit.userData.kind = 'keypad';
        this.ladderHit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
        this.ladderHit.position.set(0, 2, ZE - 0.3);
        this.ladderHit.userData.kind = 'ladder';
        this.doorHit = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
        this.doorHit.position.set(0, DOOR_H / 2, (WALL_Z0 + WALL_Z1) / 2);
        this.doorHit.userData.kind = 'door';
        // the beacon: a lamp, a beam sweeping round, and its light
        this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
        this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 12), this.beaconMat);
        this.beacon.position.copy(this.beaconAt);
        this.beamMat = new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
        this.beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 14, 1, true).translate(0, -4.5, 0).rotateZ(Math.PI / 2), this.beamMat);
        this.beamPivot = new THREE.Group();
        this.beamPivot.position.copy(this.beaconAt);
        this.beamPivot.add(this.beam);
        this.beaconLight = new THREE.PointLight(0xff2a1a, 0, 18, 1.6);
        this.beaconLight.position.copy(this.beaconAt).add(new V3(0, -0.4, 1));
        this.scene.add(this.leafL, this.leafR, this.gear, ...this.bolts, this.screen, this.keypadHit, this.ladderHit, this.doorHit, this.beacon, this.beamPivot, this.beaconLight);
        // the door blocks the way until it opens
        this._colLine(-DOOR_W / 2, (WALL_Z0 + WALL_Z1) / 2, DOOR_W / 2, (WALL_Z0 + WALL_Z1) / 2, 0.45, this.doorCols);
    }

    _fan(material) {
        const a = new Acc();
        for (let k = 0; k < 5; k++) a.box(0.06, 0.42, 0.14, mat(0, 0, 0, 0, 1, 1, 1, (k / 5) * TAU, 0).multiply(mat(0, 0.05, 0, 0, 1, 1, 1, 0, 0)), { colorFn: STEEL, inside: 1 });
        this.fan = new THREE.Mesh(a.build(), material);
        this.fan.position.copy(this.fanAt).add(new V3(-0.05, 0, 0));
        this.scene.add(this.fan);
    }

    // ------------------------------------------------------------ opening

    /** The right code: the sequence starts. `instant` opens it at once (it was opened before). */
    unlock(instant = false) {
        if (this.state !== 'locked') return;
        this.state = instant ? 'open' : 'opening';
        this.t = instant ? 99 : 0;
        if (instant) this._pose(99);
    }

    get blocking() {
        return this.state !== 'open' && !(this.state === 'opening' && this.t > 7.2);
    }

    /** Where everything is `t` seconds into opening. */
    _pose(t) {
        const spin = smoothstep(0.6, 3.2, t), rise = smoothstep(3.2, 4.8, t), bolts = smoothstep(2.2, 3.4, t), slide = smoothstep(4.6, 9.5, t);
        this.gear.rotation.z = -spin * TAU * 1.5;
        this.gear.position.y = this.gearY + rise * (DOOR_H / 2 + 1.2);
        this.gear.position.z = WALL_Z1 + 0.05 - rise * 0.6;
        for (const b of this.bolts) b.position.x = b.userData.x0 + Math.sign(b.userData.x0) * bolts * 1.2;
        this.leafL.position.x = -slide * (DOOR_W / 2 + 0.2);
        this.leafR.position.x = slide * (DOOR_W / 2 + 0.2);
        // a judder as it starts to move
        const shake = slide > 0 && slide < 1 ? Math.sin(t * 40) * 0.01 * (1 - slide) : 0;
        this.leafL.position.y = this.leafR.position.y = shake;
        return { spin, rise, bolts, slide };
    }

    update(dt, t) {
        // the fan turns, the beacon goes round, the keypad's screen glows
        this.fan.rotation.x += dt * (2.2 + Math.sin(t * 0.3) * 0.6);
        const green = this.state !== 'locked';
        this.beaconMat.color.set(green ? 0x3aff6a : 0xff2a1a);
        this.beamMat.color.set(green ? 0x3aff6a : 0xff3a1a);
        this.beaconLight.color.set(green ? 0x3aff6a : 0xff2a1a);
        this.beamPivot.rotation.y = t * 2.6;
        const sweep = Math.max(0, Math.cos(t * 2.6));
        this.beaconLight.intensity = 3 + sweep * 9;
        if (this.state === 'opening') {
            this.t += dt;
            const p = this._pose(this.t);
            if (p.slide >= 1) this.state = 'open';
            return p;
        }
        return null;
    }
}
