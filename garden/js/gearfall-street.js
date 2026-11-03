// Gearfall's streets and the open ground between the buildings: cars rusting
// where they were left (some burnt out, some on their roofs), lamp posts dead,
// bent or down across the road and a few still stuttering on, traffic lights,
// power lines sagging between leaning poles, a burning barrel here and there,
// rubbish, cones, barriers, slabs of road heaved up, and gears, thrown out
// across the city from the crater. Then the yards, car parks, plazas and
// rubble lots, the wasteland's scrub and wrecks, and the neon signs, most of
// their letters dead. buildChunk() puts a chunk of all of it together.

import * as THREE from 'three';
import { Acc, C, mat, rock, cyl, cone, sphere, quad, vquad, gearGeo, tube, sag, rusty, grimy, vary, GLSL_HASH, TAU } from './gearfall-kit.js';
import { BLOCK, ROAD, CHUNK, CLEAR_R, EDGE, MIDTOWN, DOWNTOWN, DOOR_Z, lotPlan, streetKind, nearBunker } from './gearfall-land.js';
import { buildBuilding, deadTree } from './gearfall-rooms.js';
import { rng, clamp, lerp } from './util.js';

const V3 = THREE.Vector3;
const CAR_COLS = ['#6a2a22', '#2a3a4a', '#4a5a4a', '#7a6a4a', '#8a8a80', '#3a3a3a', '#5a4a6a', '#7a4a2a', '#2a4a3a'];
const RUST = rusty('#5a4a3a', 0.8, 2.2);
const POLE = C('#4a3a2a');

// ------------------------------------------------------------------ neon signs

const WORDS = [
    ['HOTEL', '#ff4a6a'], ['MOTEL', '#4affd2'], ['BAR', '#ff7a2a'], ['OPEN', '#ff3a3a'], ['DINER', '#ffd24a'],
    ['PHARMACY', '#4aff7a'], ['CINEMA', '#c04aff'], ['GARAGE', '#4ab4ff'], ['LAUNDRY', '#7affff'], ['PAWN', '#ffb44a'],
    ['LIQUOR', '#ff4ad2'], ['ARCADE', '#ff4aff'], ['NO VACANCY', '#ff4a4a'], ['RADIO', '#4aff4a'], ['GAS', '#ff8a2a'],
    ['WELCOME TO GEARFALL', '#f0e0c0'], ['GEARFALL 1 KM', '#f0e0c0'], ['CAFE', '#ffb4ff'], ['REPAIRS', '#ffdd88'], ['COGWORKS', '#7ad2ff'],
    ['SUBLEVEL 7', '#f0e0c0'], ['AUTHORISED PERSONNEL ONLY', '#f0e0c0'], ['DANGER  HIGH VOLTAGE', '#f0e0c0'], ['KEEP CLEAR', '#f0e0c0'], ['ENTER CODE', '#7aff9a'],
    ['TO THE SURFACE', '#f0e0c0'], ['VAULT', '#f0e0c0'],
];
const ROW = 64;
let ATLAS = null;
function atlas() {
    if (ATLAS) return ATLAS;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = ROW * 32;
    const x = c.getContext('2d');
    x.textBaseline = 'middle';
    const rows = [];
    const r = rng('gearfall-neon');
    WORDS.forEach(([word, color], i) => {
        const y = i * ROW + ROW / 2;
        x.font = `700 ${ROW * 0.62}px "Arial Narrow", Arial, sans-serif`;
        const tw = Math.min(1000, x.measureText(word).width + 24);
        let px = 12;
        for (const ch of word) {
            const cw = x.measureText(ch).width;
            const dead = ch !== ' ' && r() < 0.22;
            x.shadowColor = color;
            x.shadowBlur = dead ? 0 : 10;
            x.fillStyle = dead ? 'rgba(90,80,80,0.55)' : color;
            x.fillText(ch, px, y);
            if (!dead) {
                x.shadowBlur = 0;
                x.fillStyle = 'rgba(255,255,255,0.75)';
                x.font = `700 ${ROW * 0.6}px "Arial Narrow", Arial, sans-serif`;
                x.fillText(ch, px + 1, y);
                x.font = `700 ${ROW * 0.62}px "Arial Narrow", Arial, sans-serif`;
            }
            px += cw;
        }
        rows.push({ u0: 0, u1: tw / 1024, v0: 1 - (i + 1) * ROW / c.height, v1: 1 - i * ROW / c.height, aspect: tw / ROW, word });
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    ATLAS = { tex, rows };
    return ATLAS;
}
export const signRow = (word) => atlas().rows.findIndex((r) => r.word === word);

/** The signs' material: neon on a dark board (flicker seed > 0 stutters, -1 is dead), or paint (-2). */
export function signMaterial(u) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, { uMap: { value: atlas().tex }, uTime: u.uTime, uNight: u.uNight });
    return new THREE.ShaderMaterial({ uniforms, vertexShader: SIGN_V, fragmentShader: SIGN_F, fog: true });
}
const SIGN_V = /* glsl */ `
attribute float aFl; varying vec2 vUv; varying float vFl;
#include <fog_pars_vertex>
void main() { vUv = uv; vFl = aFl; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const SIGN_F = /* glsl */ `
uniform sampler2D uMap; uniform float uTime; uniform float uNight;
varying vec2 vUv; varying float vFl;
#include <fog_pars_fragment>
${GLSL_HASH}
void main() {
    vec4 t = texture2D(uMap, vUv);
    vec3 c;
    if (vFl < -1.5) {
        // paint: dark letters on a faded board; indoors (-3) it is gloomy whatever the hour
        c = mix(vec3(0.58, 0.55, 0.46) * (0.7 + 0.3 * vn(vUv * vec2(40.0, 6.0))), vec3(0.08, 0.07, 0.06), t.a * 0.9);
        c *= vFl < -2.5 ? 0.3 : 0.35 + 0.65 * (1.0 - uNight * 0.85);
    } else {
        float f = vFl > 0.0 ? flick(uTime, vFl) : (vFl < 0.0 ? 0.0 : 1.0);
        c = mix(vec3(0.04, 0.036, 0.034), t.rgb * (0.18 + f * (1.6 + uNight * 2.2)), t.a);
    }
    gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;

/** Collects sign quads for a chunk. */
export class Signs {
    constructor() {
        this.pos = [];
        this.uv = [];
        this.fl = [];
        this.idx = [];
        this.n = 0;
    }
    /** A sign facing +z of transform `m`, centred on it, at most `maxW` wide. */
    add(m, maxW, r, o = {}) {
        const A = atlas();
        const row = o.row ?? Math.floor(r() * 15);
        const R = A.rows[row];
        const h = o.h ?? 0.75;
        const w = Math.min(maxW, R.aspect * h);
        const hh = w / R.aspect;
        const k = r();
        const fl = o.fl ?? (k < 0.45 ? r.range(0.02, 1) : k < 0.7 ? -1 : 0);
        const corners = [[-w / 2, -hh / 2, R.u0, R.v0], [w / 2, -hh / 2, R.u1, R.v0], [w / 2, hh / 2, R.u1, R.v1], [-w / 2, hh / 2, R.u0, R.v1]];
        const v = new V3();
        for (const [x, y, u, vv] of corners) {
            v.set(x, y, 0.02).applyMatrix4(m);
            this.pos.push(v.x, v.y, v.z);
            this.uv.push(u, vv);
            this.fl.push(fl);
        }
        const b = this.n;
        this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        this.n += 4;
        return { w, h: hh };
    }
    build() {
        if (!this.n) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('aFl', new THREE.Float32BufferAttribute(this.fl, 1));
        g.setIndex(this.idx);
        g.computeBoundingSphere();
        return g;
    }
}

// ------------------------------------------------------------------ cars

/** A car left to rot: whole, burnt out, on its side or on its roof. Returns nothing; adds colliders. */
export function car(ctx, x, z, yaw, r, o = {}) {
    const { acc } = ctx;
    const k = r();
    const state = o.state ?? (k < 0.18 ? 'burnt' : k < 0.26 ? 'roof' : k < 0.31 ? 'side' : 'rust');
    const body = state === 'burnt' ? rusty('#1a1612', 0.7, 2.5) : rusty(r.pick(CAR_COLS), 0.5 + r() * 0.3, 2);
    const glass = state === 'burnt' ? null : C('#141a1c');
    const L = r.range(3.9, 4.6), Wd = 1.75, van = r() < 0.15;
    let M = mat(x, 0, z, yaw);
    if (state === 'roof') M = M.multiply(mat(0, 1.45, 0, 0, 1, 1, 1, 0, Math.PI)).multiply(mat(0, 0, 0, 0, 1, 1, 1, 0.04));
    else if (state === 'side') M = M.multiply(mat(0, Wd / 2, 0, 0, 1, 1, 1, 0, Math.PI / 2));
    else {
        // a wheel or two gone, so it sits crooked
        const tz = r() < 0.4 ? r.range(-0.08, 0.08) : 0, tx = r() < 0.3 ? r.range(-0.05, 0.05) : 0;
        M = M.multiply(mat(0, 0, 0, 0, 1, 1, 1, tx, tz));
    }
    const P = (lx, ly, lz, ry = 0, sx = 1, sy = sx, sz = sx, tx = 0, tz = 0) => M.clone().multiply(mat(lx, ly, lz, ry, sx, sy, sz, tx, tz));
    acc.box(Wd, 0.62, L, P(0, 0.32, 0), { colorFn: body });
    const cabH = van ? 1.05 : 0.6, cabL = van ? L * 0.75 : L * 0.5;
    const cabZ = van ? -L * 0.1 : -L * 0.06;
    if (glass) acc.box(Wd - 0.12, cabH, cabL, P(0, 0.94, cabZ), { color: glass });
    acc.box(Wd - 0.08, 0.06, cabL - 0.1, P(0, 0.94 + cabH, cabZ), { colorFn: body });
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) acc.box(0.08, cabH, 0.08, P(px * (Wd / 2 - 0.08), 0.94, cabZ + pz * (cabL / 2 - 0.05)), { colorFn: body });
    if (r() < 0.25 && state === 'rust') acc.box(Wd - 0.1, 0.04, 1.1, P(0, 1.0, L / 2 - 0.55, 0, 1, 1, 1, -0.9).multiply(mat(0, 0, 0.5)), { colorFn: body });
    // lights, bumpers
    acc.box(Wd, 0.14, 0.1, P(0, 0.3, L / 2), { color: C('#3a3a38') });
    acc.box(Wd, 0.14, 0.1, P(0, 0.3, -L / 2), { color: C('#3a3a38') });
    // the wheels: tyres flat or gone, rims rusted
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (r() < 0.25 && state !== 'roof') continue;
        acc.add(cyl(8), P(px * (Wd / 2 - 0.05), 0.33, pz * L * 0.32, 0, 0.33, 0.24, 0.33, 0, Math.PI / 2).multiply(mat(0, -0.12, 0)), { color: state === 'burnt' ? C('#2a2420') : C('#151515') });
    }
    // colliders
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const s of [-0.36, 0, 0.36]) ctx.cols.push({ x: x + fx * s * L, z: z + fz * s * L, r: 0.95 });
}

function bus(ctx, x, z, yaw, r) {
    const { acc } = ctx;
    const body = rusty(r.pick(['#8a6a2a', '#5a6a7a', '#7a3a2a']), 0.65, 1.6);
    const M = mat(x, 0, z, yaw, 1, 1, 1, 0, r.range(-0.06, 0.06));
    const L = 11, Wd = 2.5;
    acc.box(Wd, 1.2, L, M.clone().multiply(mat(0, 0.45, 0)), { colorFn: body });
    acc.box(Wd - 0.06, 0.9, L - 0.6, M.clone().multiply(mat(0, 1.65, 0)), { color: C('#101416') });
    for (let k = -5; k <= 5; k++) acc.box(Wd + 0.02, 0.9, 0.12, M.clone().multiply(mat(0, 1.65, k * 1.0)), { colorFn: body });
    acc.box(Wd, 0.3, L, M.clone().multiply(mat(0, 2.55, 0)), { colorFn: body });
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (let s = -0.45; s <= 0.46; s += 0.15) ctx.cols.push({ x: x + fx * s * L, z: z + fz * s * L, r: 1.35 });
}

// ------------------------------------------------------------------ street furniture

function lamp(ctx, x, z, yaw, r, zone) {
    const { acc } = ctx;
    const k = r();
    const state = k < 0.12 ? 'down' : k < 0.25 ? 'bent' : k < (zone === 'city' ? 0.42 : 0.34) ? 'on' : 'dead';
    const H = 7;
    let M = mat(x, 0, z, yaw);
    if (state === 'down') M = M.multiply(mat(0, 0.15, 0, r.range(-0.5, 0.5), 1, 1, 1, 0, Math.PI / 2 * 0.97));
    else if (state === 'bent') M = M.multiply(mat(0, 0, 0, 0, 1, 1, 1, r.range(-0.3, 0.3), r.range(-0.35, 0.35)));
    acc.add(cyl(6), M.clone().multiply(mat(0, 0, 0, 0, 0.09, H, 0.09)), { color: C('#3a3e40') });
    acc.box(0.08, 0.08, 1.8, M.clone().multiply(mat(0, H - 0.1, 0.85)), { color: C('#3a3e40') });
    const on = state === 'on';
    const fl = on ? (r() < 0.75 ? r.range(0.02, 1) : 0) : 0;
    acc.box(0.36, 0.14, 0.6, M.clone().multiply(mat(0, H - 0.25, 1.65)), { color: C('#2a2c2c') });
    acc.box(0.3, 0.03, 0.5, M.clone().multiply(mat(0, H - 0.28, 1.65)), { color: on ? C('#ffb060') : C('#3a3830'), glow: on ? 2.6 : 0, flick: fl });
    if (state !== 'down') ctx.cols.push({ x, z, r: 0.14 });
    if (on) {
        const p = new V3(0, H - 0.4, 1.65).applyMatrix4(M);
        ctx.lights.push({ x: p.x, y: p.y, z: p.z, color: 0xffa050, flick: fl, power: 1.6, range: 13, kind: 'street' });
    }
}

function trafficLight(ctx, x, z, yaw, r) {
    const { acc } = ctx;
    const M = mat(x, 0, z, yaw, 1, 1, 1, r.range(-0.08, 0.08), r.range(-0.08, 0.08));
    acc.add(cyl(6), M.clone().multiply(mat(0, 0, 0, 0, 0.1, 4.2, 0.1)), { color: C('#2a2e2a') });
    acc.box(0.4, 1.1, 0.3, M.clone().multiply(mat(0, 3.2, 0.2)), { color: C('#1e2220') });
    const live = r() < 0.4 ? r.int(0, 2) : -1;
    ['#ff3020', '#ffb020', '#30ff70'].forEach((c, i) => {
        const lit = i === live;
        acc.add(sphere(6, 4), M.clone().multiply(mat(0, 4.1 - i * 0.33, 0.36, 0, 0.11, 0.11, 0.05)), { color: lit ? C(c) : C(c).multiplyScalar(0.15), glow: lit ? 2.5 : 0, flick: lit ? r.range(0.02, 1) : 0 });
    });
    ctx.cols.push({ x, z, r: 0.14 });
}

function pole(ctx, x, z, r, nextX, nextZ) {
    const { acc } = ctx;
    const lean = r() < 0.3 ? r.range(-0.25, 0.25) : r.range(-0.05, 0.05), lean2 = r.range(-0.06, 0.06);
    const M = mat(x, 0, z, 0, 1, 1, 1, lean, lean2);
    const H = 9;
    acc.add(cyl(6), M.clone().multiply(mat(0, 0, 0, 0, 0.14, H, 0.14)), { color: POLE });
    acc.box(2.2, 0.12, 0.12, M.clone().multiply(mat(0, H - 0.8, 0)), { color: POLE });
    ctx.cols.push({ x, z, r: 0.2 });
    // the wires to the next pole: sagging, or snapped and hanging
    const top = new V3(0, H - 0.75, 0).applyMatrix4(M);
    for (const s of [-1, 1]) {
        const a = new V3(s * 1, H - 0.7, 0).applyMatrix4(M);
        if (r() < 0.15) {
            const L = r.range(3, 7);
            acc.add(tube([a, a.clone().add(new V3(0.2, -L * 0.5, 0.4)), a.clone().add(new V3(0.5, -L, 1.2))], 0.02, 5, 3), mat(0, 0, 0), { color: C('#111'), sway: 0.25, swayH: 1 });
        } else {
            const b = new V3(nextX + s * 1, top.y + 0.05, nextZ);
            acc.add(tube(sag(a, b, r.range(0.8, 1.6), 10), 0.02, 10, 3), mat(0, 0, 0), { color: C('#111'), sway: 0.12 });
        }
    }
}

function debris(ctx, x, z, r, zone, d) {
    const { acc } = ctx;
    const k = r();
    const yaw = r() * TAU;
    if (k < 0.18) {
        // bin bags, split
        for (let i = 0; i < r.int(2, 5); i++) acc.add(rock(r() * 6), mat(x + r.range(-0.6, 0.6), 0.2, z + r.range(-0.6, 0.6), r() * 3, r.range(0.3, 0.45), r.range(0.3, 0.45), r.range(0.3, 0.45)), { color: C(r.pick(['#1a1e1a', '#2a2a24', '#1a1a20'])) });
    } else if (k < 0.3) {
        // a slab of road heaved up
        acc.box(r.range(1.5, 3), 0.25, r.range(1.2, 2.4), mat(x, -0.05, z, yaw, 1, 1, 1, r.range(0.15, 0.4), r.range(-0.2, 0.2)), { color: C('#1e1e20') });
        ctx.cols.push({ x, z, r: 0.9 });
    } else if (k < 0.4) {
        // a concrete barrier, cones
        acc.box(2, 0.8, 0.5, mat(x, 0, z, yaw, 1, 1, 1, 0, r() < 0.3 ? 1.4 : 0), { colorFn: grimy('#8a8678', 0.4) });
        ctx.cols.push({ x, z, r: 0.7 });
    } else if (k < 0.5) {
        for (let i = 0; i < r.int(1, 3); i++) acc.add(cone(8), mat(x + r.range(-1, 1), r() < 0.5 ? 0.15 : 0, z + r.range(-1, 1), r() * 3, 0.18, 0.7, 0.18, r() < 0.5 ? Math.PI / 2 : 0), { color: C('#c05a20').multiplyScalar(0.6 + r() * 0.3) });
    } else if (k < 0.58) {
        // a tyre pile, a hydrant
        for (let i = 0; i < r.int(1, 4); i++) acc.add(new THREE.TorusGeometry(0.32, 0.12, 5, 10), mat(x + r.range(-0.4, 0.4), 0.12 + i * 0.2, z + r.range(-0.4, 0.4), r() * 3, 1, 1, 1, Math.PI / 2 + r.range(-0.3, 0.3)), { color: C('#141414') });
    } else if (k < 0.66 && zone === 'city') {
        // a newspaper box, rusted shut
        acc.box(0.5, 1, 0.45, mat(x, 0, z, yaw, 1, 1, 1, 0, r() < 0.3 ? 1.5 : 0), { colorFn: rusty(r.pick(['#2a4a8a', '#8a2a2a', '#2a6a3a']), 0.6) });
        ctx.cols.push({ x, z, r: 0.35 });
    } else if (k < 0.78 && d < 520) {
        // gears, thrown out of the crater
        const s = r.range(0.4, d < 300 ? 2.6 : 1.4);
        if (s > 1.6 && r() < 0.6) {
            // a big one buried edge-on in the road
            acc.add(gearGeo(r.int(0, 3)), mat(x, s * 0.45, z, yaw, s, s, s, Math.PI / 2 + r.range(-0.4, 0.4)), { colorFn: rusty('#6a5a3a', 0.7, 1.6) });
            acc.box(s * 1.4, 0.3, s * 0.8, mat(x, -0.1, z, yaw, 1, 1, 1, 0.12), { color: C('#1a1a1a') });
            ctx.cols.push({ x, z, r: s * 0.6 });
        } else {
            acc.add(gearGeo(r.int(0, 3)), mat(x, 0.03 * s, z, yaw, s, s, s, r.range(-0.1, 0.1)), { colorFn: rusty('#6a5a3a', 0.7, 1.6) });
            if (s > 1) ctx.cols.push({ x, z, r: s * 0.7 });
        }
    } else if (k < 0.84) {
        // a burning barrel
        acc.add(cyl(10), mat(x, 0, z, 0, 0.3, 0.9, 0.3), { colorFn: rusty('#3a3a3a', 0.8, 3) });
        const fs = r.range(0.02, 1);
        for (let i = 0; i < 3; i++) acc.add(cone(6), mat(x + r.range(-0.08, 0.08), 0.85, z + r.range(-0.08, 0.08), r() * 3, 0.24 - i * 0.05, 0.5 + i * 0.25, 0.24 - i * 0.05), { color: C(i ? '#ffb040' : '#ff6a1a'), glow: 3.5 - i * 0.6, flick: 0, sway: 0.06, swayH: 1 });
        ctx.cols.push({ x, z, r: 0.4 });
        ctx.lights.push({ x, y: 1.6, z, color: 0xff7a2a, flick: 0, fire: true, power: 1.6, range: 9, kind: 'fire' });
        ctx.fires.push({ x, y: 1.4, z });
    } else if (k < 0.9) {
        // a manhole, lid off
        acc.add(cyl(14), mat(x, -0.01, z, 0, 0.55, 0.03, 0.55), { color: C('#050505') });
        acc.add(cyl(14), mat(x + 0.8, 0.0, z + 0.3, 0, 0.6, 0.04, 0.6, 0.08), { colorFn: rusty('#2a2a2a', 0.6, 4) });
        ctx.steam.push({ x, y: 0.1, z });
    } else {
        // rubble spilled off a building
        for (let i = 0; i < 6; i++) {
            const s = r.range(0.2, 0.7);
            acc.add(rock(r() * 6), mat(x + r.range(-1.2, 1.2), s * 0.25, z + r.range(-1.2, 1.2), r() * 3, s), { color: C(r.pick(['#6a645a', '#5a564e', '#7a7064'])).multiplyScalar(0.8 + r() * 0.3) });
        }
        ctx.cols.push({ x, z, r: 0.8 });
    }
}

/** One stretch of street: from (ax, az) to (bx, bz), the centre line of the road. */
function street(ctx, ax, az, bx, bz, r, kind, d) {
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux;
    const yaw = Math.atan2(ux, uz);
    // cars: parked along the kerb, or left skewed across the lanes
    const nCars = kind === 'city' ? r.int(0, d < 400 ? 3 : 2) : r.int(0, 1);
    for (let i = 0; i < nCars; i++) {
        const t = r.range(0.12, 0.88), side = r.sign();
        const parked = r() < 0.6;
        const off = parked ? side * 2.6 : r.range(-2, 2);
        const cy = yaw + (parked ? (side < 0 ? Math.PI : 0) + r.range(-0.08, 0.08) : r.range(-0.9, 0.9));
        if (r() < 0.06 && kind === 'city') bus(ctx, ax + ux * len * t + nx * off, az + uz * len * t + nz * off, cy, r);
        else car(ctx, ax + ux * len * t + nx * off, az + uz * len * t + nz * off, cy, r);
    }
    // lamp posts on the pavement
    if (kind === 'city' || r() < 0.5) {
        const side = r.sign();
        lamp(ctx, ax + ux * len * 0.5 + nx * side * 4.4, az + uz * len * 0.5 + nz * side * 4.4, Math.atan2(-side * nx, -side * nz), r, kind);
    }
    // power lines in the suburbs
    if (kind === 'edge') {
        const px = ax + ux * len * 0.5 - nx * 4.6, pz = az + uz * len * 0.5 - nz * 4.6;
        pole(ctx, px, pz, r, px + ux * BLOCK, pz + uz * BLOCK);
    }
    // rubbish and wreckage
    const nd = kind === 'city' ? r.int(1, 4) : r.int(0, 2);
    for (let i = 0; i < nd; i++) {
        const t = r.range(0.05, 0.95), off = r.range(-4.5, 4.5);
        debris(ctx, ax + ux * len * t + nx * off, az + uz * len * t + nz * off, r, kind, d);
    }
}

// ------------------------------------------------------------------ yards and open ground

function yard(ctx, it, r, L) {
    const { acc } = ctx;
    const at = (x, y, z, ry = 0, s = 1) => mat(x, y, z, ry, s);
    const col = (lx, lz, rad) => ctx.cols.push({ x: lx, z: lz, r: rad });
    const atL = (lx, ly, lz, ry = 0, sx = 1, sy = sx, sz = sx, tx = 0, tz = 0) => mat(lx, ly, lz, ry, sx, sy, sz, tx, tz);
    const S = it.big ? L / 2 : 6;
    if (it.type === 'yard' || it.type === 'scrub') {
        const n = it.type === 'scrub' ? r.int(1, 4) : r.int(2, 6);
        for (let i = 0; i < n; i++) {
            const x = it.x + r.range(-S, S), z = it.z + r.range(-S, S);
            if (nearBunker(x, z, 2) || Math.abs(x) < 6) continue;
            const k = r();
            if (k < 0.35) deadTree(ctx, atL, r, x, z, col);
            else if (k < 0.6) {
                // a dead bush
                for (let j = 0; j < 5; j++) acc.add(cone(4), atL(x, 0, z, r() * TAU, 0.03, r.range(0.4, 1), 0.03, r.range(0.3, 1.1)), { color: C('#4a3e2a') });
            } else if (k < 0.75) {
                const s = r.range(0.4, 1.2);
                acc.add(rock(r() * 6), atL(x, s * 0.2, z, r() * 3, s), { color: C('#5a5248').multiplyScalar(0.8 + r() * 0.3) });
                if (s > 0.8) col(x, z, s * 0.8);
            } else if (k < 0.85 && it.type === 'yard') {
                // a rusted swing set, one swing left
                const M = atL(x, 0, z, r() * TAU);
                for (const s of [-1, 1]) for (const t of [-1, 1]) acc.box(0.06, 2.3, 0.06, M.clone().multiply(mat(s * 1.2, 0, t * 0.5, 0, 1, 1, 1, -t * 0.2)), { colorFn: RUST });
                acc.box(2.6, 0.07, 0.07, M.clone().multiply(mat(0, 2.2, 0)), { colorFn: RUST });
                acc.box(0.02, 1.6, 0.02, M.clone().multiply(mat(-0.3, 0.6, 0)), { color: C('#333'), sway: 0.08, swayH: -1 });
                acc.box(0.02, 1.6, 0.02, M.clone().multiply(mat(0.2, 0.6, 0)), { color: C('#333'), sway: 0.08, swayH: -1 });
                acc.box(0.55, 0.04, 0.2, M.clone().multiply(mat(-0.05, 0.6, 0)), { color: C('#3a2a1a') });
                col(x, z, 0.3);
            } else car(ctx, x, z, r() * TAU, r, { state: r() < 0.5 ? 'burnt' : 'rust' });
        }
    } else if (it.type === 'parking') {
        // rows of cars nobody came back for
        for (let row = -1; row <= 1; row += 2) for (let i = 0; i < 5; i++) {
            if (r() < 0.35) continue;
            const x = it.x - L / 2 + 3 + i * (L - 6) / 4, z = it.z + row * 5.5;
            car(ctx, x, z, (row > 0 ? 0 : Math.PI) + r.range(-0.15, 0.15), r);
        }
        acc.box(2, 2.4, 2, at(it.x + L / 2 - 2.5, 0, it.z - L / 2 + 2.5), { colorFn: grimy('#7a7464', 0.4) });
        col(it.x + L / 2 - 2.5, it.z - L / 2 + 2.5, 1.3);
        lamp(ctx, it.x, it.z, r() * TAU, r, 'city');
    } else if (it.type === 'plaza') {
        // a dry fountain with its statue fallen, benches, dead trees in planters, and a gear the size of a house
        const fx = it.x, fz = it.z;
        acc.add(cyl(24), at(fx, 0, fz, 0).multiply(mat(0, 0, 0, 0, 4, 0.6, 4)), { colorFn: grimy('#8a8678', 0.4) });
        acc.add(cyl(24), at(fx, 0.02, fz).multiply(mat(0, 0, 0, 0, 3.7, 0.6, 3.7)), { color: C('#2a2a26') });
        acc.box(0.8, 1.4, 0.8, at(fx, 0, fz), { colorFn: grimy('#8a8678', 0.4) });
        acc.box(0.7, 0.6, 2.2, at(fx + 1.6, 0.6, fz + 0.4, r() * 3, 1, 1, 1, 0.1), { colorFn: rusty('#4a6a5a', 0.5) });
        acc.add(sphere(8, 6), at(fx + 2.4, 0.9, fz + 1.4, 0, 0.45), { colorFn: rusty('#4a6a5a', 0.5) });
        for (let a = 0; a < TAU; a += 0.4) col(fx + Math.cos(a) * 3.8, fz + Math.sin(a) * 3.8, 0.4);
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + 0.4, x = fx + Math.cos(a) * 9, z = fz + Math.sin(a) * 9;
            acc.box(1.6, 0.8, 1.6, at(x, 0, z), { colorFn: grimy('#7a7464', 0.4) });
            deadTree(ctx, (lx, ly, lz, ...rest) => mat(lx, ly + 0.8, lz, ...rest), r, x, z, null);
            col(x, z, 1.0);
            const bx = fx + Math.cos(a + 0.8) * 7, bz = fz + Math.sin(a + 0.8) * 7;
            acc.box(1.8, 0.45, 0.5, at(bx, 0, bz, a + 0.8 + Math.PI / 2), { color: C('#4a3a2a') });
        }
        const gs = r.range(3, 4.5);
        acc.add(gearGeo(1), mat(fx + r.range(-8, 8), gs * 0.55, fz + 11, r.range(-0.5, 0.5), gs, gs, gs, Math.PI / 2 - 0.25), { colorFn: rusty('#6a5a3a', 0.75, 1.4) });
        col(fx, fz + 11, gs * 0.6);
    } else if (it.type === 'rubble') {
        // where a building came down: mounds of it, bits of wall still standing
        for (let i = 0; i < 9; i++) {
            const x = it.x + r.range(-L / 2 + 3, L / 2 - 3), z = it.z + r.range(-L / 2 + 3, L / 2 - 3), s = r.range(1.2, 3.2);
            acc.add(rock(r() * 6), at(x, s * 0.15, z, r() * 3).multiply(mat(0, 0, 0, 0, s, s * 0.8, s)), { color: C(r.pick(['#6a645a', '#5a564e', '#7a7064'])).multiplyScalar(0.7 + r() * 0.3) });
            col(x, z, s * 0.85);
        }
        for (let i = 0; i < 3; i++) {
            const x = it.x + r.range(-L / 3, L / 3), z = it.z + r.range(-L / 3, L / 3), h = r.range(2, 6);
            acc.box(r.range(2, 5), h, 0.3, at(x, 0, z, r() * 3), { colorFn: grimy(r.pick(['#8a5a44', '#7a6250']), 0.4), win: 2, seed: r() });
            col(x, z, 0.6);
        }
    } else if (it.type === 'wreck') {
        if (r() < 0.3) bus(ctx, it.x, it.z, r() * TAU, r);
        else car(ctx, it.x, it.z, r() * TAU, r, { state: r() < 0.4 ? 'burnt' : r() < 0.5 ? 'roof' : 'rust' });
    } else if (it.type === 'billboard') {
        const M = mat(it.x, 0, it.z, it.yaw);
        for (const s of [-1, 1]) acc.box(0.25, 6, 0.25, M.clone().multiply(mat(s * 3, 0, 0)), { color: POLE });
        acc.box(8, 3.6, 0.15, M.clone().multiply(mat(0, 4.4, 0, 0, 1, 1, 1, 0, r.range(-0.08, 0.08))), { colorFn: rusty(r.pick(['#8a6a4a', '#4a6a8a', '#8a4a4a']), 0.55, 0.6) });
        for (let i = 0; i < 6; i++) acc.box(r.range(0.5, 1.4), r.range(0.6, 1.6), 0.02, M.clone().multiply(mat(r.range(-3.5, 3.5), r.range(4.6, 6.8), 0.1)), { color: C('#c8c0a8').multiplyScalar(0.6 + r() * 0.3), sway: 0.05, swayH: -1 });
        col(it.x + Math.cos(it.yaw) * 3, it.z - Math.sin(it.yaw) * 3, 0.3);
        col(it.x - Math.cos(it.yaw) * 3, it.z + Math.sin(it.yaw) * 3, 0.3);
    } else if (it.type === 'pumps') {
        // the forecourt: a canopy on four posts, pumps, and the GAS sign
        const fx = Math.sin(it.yaw), fz = Math.cos(it.yaw);
        const cx = it.x + fx * 4, cz = it.z + fz * 4;
        const M = mat(cx, 0, cz, it.yaw);
        for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            acc.box(0.3, 4.4, 0.3, M.clone().multiply(mat(a * 5, 0, c * 3)), { colorFn: grimy('#8a8a80', 0.4) });
            const p = new V3(a * 5, 0, c * 3).applyMatrix4(M);
            col(p.x, p.z, 0.25);
        }
        acc.box(11.5, 0.6, 7.5, M.clone().multiply(mat(0, 4.4, 0, 0, 1, 1, 1, 0, r.range(-0.06, 0.06))), { colorFn: rusty('#8a3a2a', 0.5) });
        for (const s of [-1, 1]) {
            const p = new V3(s * 2, 0, 0).applyMatrix4(M);
            acc.box(0.7, 1.6, 0.5, M.clone().multiply(mat(s * 2, 0, 0, 0, 1, 1, 1, 0, s * r.range(0, 0.25))), { colorFn: rusty('#c8c0a0', 0.6, 3) });
            col(p.x, p.z, 0.5);
        }
        ctx.signs.add(M.clone().multiply(mat(0, 4.7, 3.78)), 3, r, { row: signRow('GAS') });
    }
}

// ------------------------------------------------------------------ a chunk

/** Everything in chunk (ci, cj): { mesh, signs, cols, lights, fires, steam }. */
export function buildChunk(ci, cj, material, signMat) {
    const ctx = { acc: new Acc(), cols: [], lights: [], fires: [], steam: [], signs: new Signs() };
    for (let bj = cj * 2; bj < cj * 2 + 2; bj++) for (let bi = ci * 2; bi < ci * 2 + 2; bi++) {
        const plan = lotPlan(bi, bj);
        const r = rng(`gfst:${bi}:${bj}`);
        for (const it of plan.items) {
            if (it.type === 'bld') buildBuilding(ctx, it);
            else yard(ctx, it, r, plan.L);
        }
        // the streets on this block's west and north sides
        const sx = bi * BLOCK, sz = bj * BLOCK;
        const west = streetKind(sx, sz + BLOCK / 2), north = streetKind(sx + BLOCK / 2, sz);
        const dw = Math.hypot(sx, sz + BLOCK / 2), dn = Math.hypot(sx + BLOCK / 2, sz);
        if (west !== 'none' && !nearBunker(sx, sz + 20, 4)) street(ctx, sx, sz + ROAD, sx, sz + BLOCK - ROAD, r, west, dw);
        if (north !== 'none') street(ctx, sx + ROAD, sz, sx + BLOCK - ROAD, sz, r, north, dn);
        // traffic lights at the crossing
        const dc = Math.hypot(sx, sz);
        if (dc > CLEAR_R && dc < MIDTOWN && r() < 0.4) trafficLight(ctx, sx + 4.4, sz + 4.4, Math.PI * 0.25 + r.int(0, 3) * Math.PI / 2, r);
        // the dirt road across the wasteland: poles along it, the odd wreck, and the signs
        if (sx === 0 && sz > EDGE - 40 && sz < DOOR_Z - 20) {
            pole(ctx, -6, sz + 20, r, -6, sz + 60);
            if (r() < 0.35) car(ctx, r.sign() * r.range(5.5, 9), sz + r.range(5, 35), r() * TAU, r, { state: r() < 0.5 ? 'burnt' : 'rust' });
            if (r() < 0.4) debris(ctx, r.sign() * r.range(5, 8), sz + r.range(5, 35), r, 'edge', 2000);
        }
        if (sx === 0 && sz === Math.floor((DOOR_Z - 120) / BLOCK) * BLOCK) roadSign(ctx, 7, sz + 10, 'GEARFALL 1 KM', r);
        if (sx === 0 && sz === Math.floor((EDGE + 30) / BLOCK) * BLOCK) roadSign(ctx, 7.5, sz + 10, 'WELCOME TO GEARFALL', r);
    }
    const geo = ctx.acc.empty ? null : ctx.acc.build();
    const mesh = geo ? new THREE.Mesh(geo, material) : new THREE.Group();
    const sg = ctx.signs.build();
    const signs = sg ? new THREE.Mesh(sg, signMat) : null;
    return { mesh, signs, cols: ctx.cols, lights: ctx.lights, fires: ctx.fires, steam: ctx.steam };
}

function roadSign(ctx, x, z, word, r) {
    const { acc } = ctx;
    const yaw = -0.3;   // facing down the road, toward the vault door
    const M = mat(x, 0, z, yaw, 1, 1, 1, 0, r.range(-0.06, 0.06));
    const row = signRow(word);
    for (const s of [-1, 1]) acc.box(0.18, 3.4, 0.18, M.clone().multiply(mat(s * 2.4, 0, -0.1)), { color: POLE });
    acc.box(5.4, 1.4, 0.08, M.clone().multiply(mat(0, 2.2, -0.1)), { colorFn: rusty('#6a6a60', 0.5, 1.2) });
    ctx.signs.add(M.clone().multiply(mat(0, 2.9, -0.04)), 5.1, r, { row, fl: -2, h: 1.2 });
    ctx.cols.push({ x: x + Math.cos(yaw) * 2.4, z: z - Math.sin(yaw) * 2.4, r: 0.2 }, { x: x - Math.cos(yaw) * 2.4, z: z + Math.sin(yaw) * 2.4, r: 0.2 });
}
