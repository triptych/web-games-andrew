/**
 * actors.js — everyone on the road, drawn with a handful of instanced meshes: legs, torso, arms,
 * head, eleven hats and hairstyles, the dead's glowing eyes and the carriers' handcarts. Each part
 * is posed every frame from the simulation: walking, limping, frozen with fear, lying collapsed,
 * the dead's hunched shamble, a volunteer's throw. Bosses are their own models.
 *
 * Over each head: a health bar (HP, golden temporary health, a blight band) and an icon per
 * ailment, drawn as screen-sized billboards so they stay readable when zoomed out on a phone.
 */

import * as THREE from 'three';
import { MAX_ACTORS, W, H, HAVEN_COLS } from '../config.js';
import { LOOKS, TRADES, KINDS } from '../sim/data.js';
import { Builder } from './builder.js';
import { actorMat, toyMat } from './materials.js';
import { bossModel } from './models.js';

const WHITE = 0xffffff;
export const ACTOR_SCALE = 1.45;   // people read better a little larger than life on a map this size
function part(fn) { const b = new Builder(); fn(b); return b.geometry(); }

// hat/hair variants (index → geometry). Hair-coloured ones take the hair colour.
const HATS = [
    { name: 'short', hair: true, g: (b) => { b.sphere(0.064, WHITE, 0, 0.405, -0.006, { half: true, seg: 10, sy: 0.85 }); } },
    { name: 'long', hair: true, g: (b) => { b.sphere(0.066, WHITE, 0, 0.405, -0.008, { half: true, seg: 10 }); b.box(0.12, 0.13, 0.04, WHITE, 0, 0.29, -0.045); } },
    { name: 'beanie', hair: false, g: (b) => { b.sphere(0.066, WHITE, 0, 0.41, 0, { half: true, seg: 10, sy: 1.1 }); b.sphere(0.022, WHITE, 0, 0.485, 0, { seg: 6 }); } },
    { name: 'cap', hair: false, g: (b) => { b.sphere(0.065, WHITE, 0, 0.415, 0, { half: true, seg: 10, sy: 0.7 }); b.box(0.08, 0.012, 0.07, WHITE, 0, 0.418, 0.07); } },
    { name: 'bun', hair: true, g: (b) => { b.sphere(0.064, WHITE, 0, 0.405, -0.006, { half: true, seg: 10, sy: 0.85 }); b.sphere(0.035, WHITE, 0, 0.47, -0.04, { seg: 7 }); } },
    { name: 'helmet', hair: false, g: (b) => { b.sphere(0.072, WHITE, 0, 0.41, 0, { half: true, seg: 10 }); b.cyl(0.095, 0.012, WHITE, 0, 0.41, -0.015, { seg: 12, sz: 1.15 }); b.box(0.03, 0.04, 0.02, 0xf2c14e, 0, 0.45, 0.07); } },
    { name: 'nursecap', hair: true, g: (b) => { b.sphere(0.064, WHITE, 0, 0.405, -0.006, { half: true, seg: 10, sy: 0.85 }); b.box(0.07, 0.035, 0.03, 0xffffff, 0, 0.455, 0.02); b.box(0.02, 0.025, 0.005, 0xd8382e, 0, 0.462, 0.037); } },
    { name: 'straw', hair: false, g: (b) => { b.cyl(0.12, 0.01, WHITE, 0, 0.43, 0, { seg: 14 }); b.cyl(0.06, 0.05, WHITE, 0, 0.43, 0, { seg: 10 }); } },
    { name: 'beret', hair: false, g: (b) => { b.sphere(0.07, WHITE, 0.012, 0.44, 0, { seg: 10, sy: 0.4 }); } },
    { name: 'band', hair: true, g: (b) => { b.sphere(0.064, WHITE, 0, 0.405, -0.006, { half: true, seg: 10, sy: 0.85 }); b.cyl(0.066, 0.02, 0xe8483a, 0, 0.415, 0, { seg: 12 }); } },
    { name: 'flatcap', hair: false, g: (b) => { b.sphere(0.066, WHITE, 0, 0.41, -0.005, { half: true, seg: 10, sy: 0.6 }); b.box(0.09, 0.012, 0.06, WHITE, 0, 0.42, 0.06, { rx: 0.15 }); } },
];
const HAT_INDEX = Object.fromEntries(HATS.map((h, i) => [h.name, i]));
const TRADE_HAT = { firefighter: 'helmet', nurse: 'nursecap', gardener: 'straw', athlete: 'band', musician: 'beret', mechanic: 'cap', storyteller: 'flatcap' };
const CIV_HATS = ['short', 'long', 'beanie', 'cap', 'bun', 'short', 'long', 'flatcap', 'beanie'];
const HAT_COL = [0xc8432e, 0x3a6ab8, 0x3a8a5a, 0xe0b040, 0x6a4a8a, 0xe8e0cc, 0x2a2a30];

const GEO = {
    leg: () => part((b) => { b.box(0.048, 0.17, 0.056, WHITE, 0, -0.17, 0); b.box(0.05, 0.03, 0.075, 0x3a3030, 0, -0.17, 0.01); }),
    torso: () => part((b) => { b.cyl(0.075, 0.18, WHITE, 0, 0.0, 0, { rt: 0.062, seg: 7, sz: 0.72 }); }),
    arm: () => part((b) => { b.box(0.036, 0.15, 0.04, WHITE, 0, -0.15, 0); b.box(0.034, 0.03, 0.034, 0xe8c4a0, 0, -0.17, 0); }),
    head: () => part((b) => {
        b.cyl(0.024, 0.03, WHITE, 0, 0.335, 0, { seg: 6 });
        b.sphere(0.06, WHITE, 0, 0.395, 0, { seg: 12, rings: 8 });
        b.sphere(0.008, 0x1a1a1a, -0.022, 0.402, 0.055, { seg: 5, rings: 3 });
        b.sphere(0.008, 0x1a1a1a, 0.022, 0.402, 0.055, { seg: 5, rings: 3 });
    }),
    eyes: () => part((b) => {
        b.sphere(0.012, 0xe8ffb0, -0.022, 0.402, 0.056, { seg: 5, rings: 3, glow: 3 });
        b.sphere(0.012, 0xe8ffb0, 0.022, 0.402, 0.056, { seg: 5, rings: 3, glow: 3 });
    }),
    cart: () => part((b) => {
        b.box(0.22, 0.1, 0.16, 0x9a6a3e, 0, 0.08, 0);
        b.box(0.18, 0.08, 0.12, 0xd8c8a0, 0, 0.18, 0);
        b.cyl(0.05, 0.02, 0x3a3030, -0.06, 0.05, -0.09, { rx: Math.PI / 2, centre: true, seg: 8 });
        b.cyl(0.05, 0.02, 0x3a3030, -0.06, 0.05, 0.09, { rx: Math.PI / 2, centre: true, seg: 8 });
        b.box(0.012, 0.012, 0.2, 0x6a4a2c, 0.15, 0.15, 0, { rz: 0.4 });
    }),
};

// ------------------------------------------------------------------ overhead: bars and icons
const ICON = { wound: 0, sick: 1, hunger: 2, cold: 3, fracture: 4, fear: 5, down: 6, heart: 7, star: 8, lured: 9 };

function iconAtlas() {
    const S = 64, N = 4;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S * N;
    const g = cv.getContext('2d');
    const cell = (i, fn) => { g.save(); g.translate((i % N) * S + S / 2, Math.floor(i / N) * S + S / 2); fn(); g.restore(); };
    const disc = (col) => { g.fillStyle = 'rgba(20,18,30,0.75)'; g.beginPath(); g.arc(0, 0, 29, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = 4; g.stroke(); };
    cell(0, () => { disc('#e0483e'); g.fillStyle = '#ff5a4a'; g.beginPath(); g.moveTo(0, -18); g.bezierCurveTo(14, 2, 13, 18, 0, 18); g.bezierCurveTo(-13, 18, -14, 2, 0, -18); g.fill(); });
    cell(1, () => { disc('#6fcf5a'); g.strokeStyle = '#8af27a'; g.lineWidth = 5; g.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = 2 + a * 1.4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); });
    cell(2, () => { disc('#e8a640'); g.fillStyle = '#f2b850'; g.beginPath(); g.arc(0, 2, 16, 0, Math.PI); g.fill(); g.fillRect(-18, -2, 36, 5); g.strokeStyle = '#fff3d0'; g.lineWidth = 3; for (const x of [-6, 4]) { g.beginPath(); g.moveTo(x, -6); g.quadraticCurveTo(x + 5, -12, x, -18); g.stroke(); } });
    cell(3, () => { disc('#8ccff5'); g.strokeStyle = '#d8f2ff'; g.lineWidth = 4; for (let k = 0; k < 3; k++) { g.save(); g.rotate((k * Math.PI) / 3); g.beginPath(); g.moveTo(0, -19); g.lineTo(0, 19); for (const s of [-1, 1]) { g.moveTo(0, s * 11); g.lineTo(-6, s * 17); g.moveTo(0, s * 11); g.lineTo(6, s * 17); } g.stroke(); g.restore(); } });
    cell(4, () => { disc('#f1ead8'); g.save(); g.rotate(-0.7); g.fillStyle = '#fff8e6'; g.fillRect(-4, -14, 8, 28); for (const y of [-14, 14]) for (const x of [-5, 5]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } g.restore(); g.strokeStyle = '#e0483e'; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, 4); g.lineTo(-2, -2); g.lineTo(2, 4); g.lineTo(8, -2); g.stroke(); });
    cell(5, () => { disc('#c39cf2'); g.fillStyle = '#e2c8ff'; g.beginPath(); g.moveTo(4, -20); g.lineTo(-10, 3); g.lineTo(-1, 3); g.lineTo(-5, 20); g.lineTo(11, -4); g.lineTo(2, -4); g.closePath(); g.fill(); });
    cell(6, () => { disc('#ff6a5a'); g.fillStyle = '#ff6a5a'; g.fillRect(-5, -17, 10, 34); g.fillRect(-17, -5, 34, 10); });
    cell(7, () => { g.fillStyle = '#ff7a8a'; g.beginPath(); g.moveTo(0, 20); g.bezierCurveTo(-34, -4, -14, -30, 0, -12); g.bezierCurveTo(14, -30, 34, -4, 0, 20); g.fill(); });
    cell(8, () => { g.fillStyle = '#ffd86a'; g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 10 : 24, a = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); });
    cell(9, () => { disc('#d9b45a'); g.fillStyle = '#f2d27a'; g.beginPath(); g.moveTo(-12, 10); g.quadraticCurveTo(-12, -16, 0, -16); g.quadraticCurveTo(12, -16, 12, 10); g.closePath(); g.fill(); g.beginPath(); g.arc(0, 13, 4, 0, 7); g.fill(); });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const BB_VERT = `
    attribute vec3 aCenter; attribute vec2 aOff; attribute vec2 aSize;
    uniform vec2 uRes; uniform float uScale;
    varying vec2 vUv;
    void main() {
        vec4 c = projectionMatrix * modelViewMatrix * vec4(aCenter, 1.0);
        vec2 px = (position.xy * aSize + aOff) * uScale;
        c.xy += px * 2.0 / uRes * c.w;
        gl_Position = c;
        vUv = uv;
    }`;

function billboardSet(n, extraAttrs, frag, uniforms) {
    const geo = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    geo.index = q.index;
    geo.setAttribute('position', q.attributes.position);
    geo.setAttribute('uv', q.attributes.uv);
    const attrs = {};
    const add = (name, size) => { attrs[name] = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); attrs[name].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, attrs[name]); };
    add('aCenter', 3); add('aOff', 2); add('aSize', 2);
    for (const [k, s] of extraAttrs) add(k, s);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
        uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uScale: { value: 1 }, ...uniforms },
        vertexShader: BB_VERT.replace('varying vec2 vUv;', `varying vec2 vUv; ${extraAttrs.map(([k, s]) => `attribute ${s === 1 ? 'float' : `vec${s}`} ${k}; varying ${s === 1 ? 'float' : `vec${s}`} v${k.slice(1)};`).join(' ')}`)
            .replace('vUv = uv;', `vUv = uv; ${extraAttrs.map(([k]) => `v${k.slice(1)} = ${k};`).join(' ')}`),
        fragmentShader: frag,
        transparent: true, depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    return { mesh, geo, attrs, mat, n };
}

const BAR_FRAG = `
    varying vec2 vUv; varying vec4 vBar; varying float vKind;
    void main() {
        vec2 p = vUv;
        // a rounded dark backing with a 1-px rim
        vec3 col = vec3(0.08, 0.07, 0.12);
        float a = 0.82;
        float inner = step(0.06, p.x) * step(p.x, 0.94) * step(0.2, p.y) * step(p.y, 0.8);
        if (inner > 0.5) {
            float x = (p.x - 0.06) / 0.88;
            if (vKind > 0.5) {
                // the dead's blight: violet, draining as they're cured
                col = x < vBar.x ? mix(vec3(0.55, 0.3, 0.9), vec3(0.75, 0.55, 1.0), p.y) : vec3(0.18, 0.15, 0.24);
            } else {
                float hp = vBar.x, tmp = vBar.y;
                vec3 hc = hp > 0.6 ? vec3(0.35, 0.85, 0.4) : hp > 0.3 ? vec3(0.98, 0.78, 0.25) : vec3(0.95, 0.3, 0.25);
                col = x < hp ? hc : vec3(0.2, 0.18, 0.24);
                if (x >= hp && x < hp + tmp) col = vec3(1.0, 0.85, 0.35);
                if (x < tmp && p.y > 0.62) col = mix(col, vec3(1.0, 0.92, 0.5), 0.7);
                // blight band along the bottom
                if (p.y < 0.36 && x < vBar.z) col = vec3(0.45, 0.85, 0.35);
            }
        }
        gl_FragColor = vec4(col, a * vBar.w);
    }`;

const ICON_FRAG = `
    uniform sampler2D uAtlas; varying vec2 vUv; varying float vCell; varying float vAlpha;
    void main() {
        float cx = mod(vCell, 4.0), cy = floor(vCell / 4.0);
        vec2 uv = vec2((cx + vUv.x) / 4.0, 1.0 - (cy + 1.0 - vUv.y) / 4.0);
        vec4 t = texture2D(uAtlas, uv);
        gl_FragColor = vec4(t.rgb, t.a * vAlpha);
    }`;

// ------------------------------------------------------------------ the view
const _torso = new THREE.Matrix4(), _t = new THREE.Matrix4();
const _m = new THREE.Matrix4(), _base = new THREE.Matrix4(), _loc = new THREE.Matrix4(), _r = new THREE.Matrix4(), _r2 = new THREE.Matrix4(), _s = new THREE.Matrix4(), _c = new THREE.Color();

export class Actors {
    constructor(root) {
        this.root = root;
        const mk = (geo, n) => {
            const m = new THREE.InstancedMesh(geo, actorMat, n);
            m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
            m.count = 0; m.frustumCulled = false; m.castShadow = true;
            root.add(m);
            return m;
        };
        const N = MAX_ACTORS;
        this.legs = mk(GEO.leg(), N * 2);
        this.torso = mk(GEO.torso(), N);
        this.arms = mk(GEO.arm(), N * 2);
        this.head = mk(GEO.head(), N);
        this.eyes = mk(GEO.eyes(), N);
        this.eyes.castShadow = false;
        this.carts = mk(GEO.cart(), 40);
        this.hats = HATS.map((h) => mk(part(h.g), N));
        this.bars = billboardSet(N, [['aBar', 4], ['aKind', 1]], BAR_FRAG, {});
        this.icons = billboardSet(N * 4, [['aCell', 1], ['aAlpha', 1]], ICON_FRAG, { uAtlas: { value: iconAtlas() } });
        root.add(this.bars.mesh, this.icons.mesh);
        this.bosses = new Map();
        this.crowd = [];
        this.t = 0;
        this.shown = true;
    }

    setRes(w, h, phone) {
        for (const s of [this.bars, this.icons]) { s.mat.uniforms.uRes.value.set(w, h); s.mat.uniforms.uScale.value = phone ? 0.9 : 1; }
    }

    clear() {
        for (const [, b] of this.bosses) this.root.remove(b.group);
        this.bosses.clear();
        this.crowd = [];
    }

    /** Somebody arrived: they join the crowd milling about in the Haven. */
    addToCrowd(p, rng) {
        if (this.crowd.length >= 48) this.crowd.shift();
        this.crowd.push({
            x: W - HAVEN_COLS + 0.4, z: p.z, tx: W - HAVEN_COLS + 0.6 + rng() * 2.1, tz: 0.6 + rng() * (H - 1.2), yaw: Math.PI / 2,
            look: p.look, kind: p.kind, trade: p.trade, role: 'civ', phase: rng() * 6, wait: 0, restored: p.restored, glowT: 1.5, cheer: 1.6,
        });
    }

    // One body. o: { x, z, y, yaw, scale, swing, pose, look, kind, trade, dead, armUp, tint }
    body(o, counts) {
        const n = counts.n;
        if (n >= MAX_ACTORS) return;
        const s = o.scale * ACTOR_SCALE;
        _base.makeRotationY(o.yaw).setPosition(o.x, o.y, o.z);
        if (o.pose === 'down') {
            _base.multiply(_r.makeTranslation(0, 0.05 * s, 0)).multiply(_r2.makeRotationX(-Math.PI / 2));
        } else if (o.pose === 'cheer') {
            _base.multiply(_r.makeTranslation(0, Math.abs(Math.sin(o.phase * 2)) * 0.05, 0));
        }
        _base.multiply(_s.makeScale(s, s, s));
        const hunch = o.dead ? 0.35 : o.pose === 'frozen' ? -0.12 : 0;
        const torsoM = _torso.makeTranslation(0, 0.17, 0).multiply(_r2.makeRotationX(hunch));
        // legs
        const L = this.legs;
        for (const side of [-1, 1]) {
            let rx = o.swing * side;
            if (o.pose === 'limp' && side === 1) rx *= 0.2;
            _loc.makeTranslation(side * 0.035, 0.17, 0).multiply(_r2.makeRotationX(rx));
            L.setMatrixAt(counts.l, _m.multiplyMatrices(_base, _loc));
            _c.setHex(o.bottom).multiplyScalar(o.tint);
            L.setColorAt(counts.l++, _c);
        }
        _m.multiplyMatrices(_base, torsoM);
        this.torso.setMatrixAt(n, _m);
        _c.setHex(o.top).multiplyScalar(o.tint);
        this.torso.setColorAt(n, _c);
        // arms
        for (const side of [-1, 1]) {
            let rx = -o.swing * side * 0.8, rz = 0;
            if (o.dead) { rx = -1.35 + Math.sin(o.phase * 0.7 + side) * 0.12; }
            else if (o.pose === 'frozen') { rx = -2.6; rz = side * -0.3 + Math.sin(o.phase * 9) * 0.08; }
            else if (o.pose === 'cheer') { rx = -2.8; rz = side * -0.4; }
            else if (o.armUp && side === 1) { rx = -2.4 * o.armUp; }
            else if (o.pose === 'stand') rx = Math.sin(o.phase * 0.6 + side) * 0.05;
            _loc.copy(torsoM).multiply(_t.makeTranslation(side * 0.086, 0.165, 0)).multiply(_r2.makeRotationX(rx));
            if (rz) _loc.multiply(_r2.makeRotationZ(rz));
            this.arms.setMatrixAt(counts.a, _m.multiplyMatrices(_base, _loc));
            this.arms.setColorAt(counts.a++, _c);
        }
        // head (on the torso, so it hunches with it), eyes, hat
        _loc.copy(torsoM).multiply(_t.makeTranslation(0, -0.17, 0));
        if (o.dead) _loc.multiply(_r2.makeRotationZ(Math.sin(o.phase * 0.5) * 0.25));
        _m.multiplyMatrices(_base, _loc);
        this.head.setMatrixAt(n, _m);
        _c.setHex(o.skin).multiplyScalar(o.tint);
        this.head.setColorAt(n, _c);
        if (o.dead) {
            this.eyes.setMatrixAt(counts.e, _m);
            _c.setHex(0xffffff);
            this.eyes.setColorAt(counts.e++, _c);
        }
        const hm = this.hats[o.hat];
        hm.setMatrixAt(counts.h[o.hat], _m);
        _c.setHex(o.hatCol).multiplyScalar(o.tint);
        hm.setColorAt(counts.h[o.hat]++, _c);
        counts.n++;
    }

    lookOf(p, dead = false) {
        const L = p.look || { skin: 0, hair: 0, top: 0, bottom: 0, hat: 0 };
        let hatName = CIV_HATS[L.hat % CIV_HATS.length];
        if (p.role === 'vol' && TRADE_HAT[p.trade]) hatName = TRADE_HAT[p.trade];
        if (p.kind === 'elder' && !dead && p.role !== 'vol') hatName = L.hat % 2 ? 'flatcap' : 'short';
        const hat = HAT_INDEX[hatName];
        let top = LOOKS.cloth[L.top % LOOKS.cloth.length], bottom = LOOKS.cloth[L.bottom % LOOKS.cloth.length];
        let skin = LOOKS.skin[L.skin % LOOKS.skin.length];
        let hatCol = HATS[hat].hair ? LOOKS.hair[L.hair % LOOKS.hair.length] : HAT_COL[(L.top + L.hat) % HAT_COL.length];
        if (p.role === 'vol' && TRADES[p.trade]) {
            top = TRADES[p.trade].color;
            if (p.trade === 'firefighter') hatCol = 0xd8382e;
            if (p.trade === 'nurse') { top = 0xf2f6fa; }
            if (p.trade === 'gardener') hatCol = 0xe8c870;
            if (p.trade === 'musician') hatCol = 0x2a2a3a;
        }
        if (dead) {
            skin = 0x8a9a80;
            _c.setHex(top).lerp(_c2.setHex(0x5a5a52), 0.7); top = _c.getHex();
            _c.setHex(bottom).lerp(_c2.setHex(0x4a4a44), 0.75); bottom = _c.getHex();
            hatCol = HATS[hat].hair ? 0x4a4a40 : 0x5a5a52;
        }
        return { top, bottom, skin, hat, hatCol };
    }

    update(world, dt, t, flags = {}) {
        this.t = t;
        const counts = { n: 0, l: 0, a: 0, e: 0, h: this.hats.map(() => 0), c: 0 };
        let nb = 0, ni = 0;
        const bars = this.bars.attrs, icons = this.icons.attrs;
        const pushBar = (x, y, z, v0, v1, v2, alpha, kind, w = 30) => {
            if (nb >= this.bars.n) return;
            bars.aCenter.setXYZ(nb, x, y, z); bars.aOff.setXY(nb, 0, 10); bars.aSize.setXY(nb, w, 6);
            bars.aBar.setXYZW(nb, v0, v1, v2, alpha); bars.aKind.setX(nb, kind);
            nb++;
        };
        const pushIcon = (x, y, z, cell, i, total, alpha = 1, big = 1) => {
            if (ni >= this.icons.n) return;
            icons.aCenter.setXYZ(ni, x, y, z);
            icons.aOff.setXY(ni, (i - (total - 1) / 2) * 15, 24);
            icons.aSize.setXY(ni, 15 * big, 15 * big);
            icons.aCell.setX(ni, cell); icons.aAlpha.setX(ni, alpha);
            ni++;
        };

        // the living (walkers and volunteers)
        const ail = world ? world.ail : null;
        if (world) for (const p of world.people) {
            const K = KINDS[p.kind];
            const lk = this.lookOf(p);
            const walking = p.state === 'walk' && p.speed > 0.01;
            const pose = p.state === 'down' ? 'down' : p.freezeT > 0 ? 'frozen' : p.role === 'vol' ? 'stand' : p.fracture ? 'limp' : 'walk';
            const swing = walking ? Math.sin(p.phase) * (p.fracture ? 0.35 : 0.6) : 0;
            let armUp = 0;
            if (p.role === 'vol' && TRADES[p.trade] && TRADES[p.trade].every) {
                const since = TRADES[p.trade].every - p.cool;
                armUp = since < 0.3 ? 1 - since / 0.3 : 0;
            }
            const tint = p.hitT > 0 ? 1.5 : p.treatT > 0 ? 1.25 : p.restored ? 1.15 : 1;
            const bob = walking ? Math.abs(Math.sin(p.phase)) * 0.015 : 0;
            this.body({ x: p.x, z: p.z, y: bob, yaw: p.role === 'vol' ? p.yaw : p.yaw, scale: K.scale, swing, pose, dead: false, armUp, tint, phase: p.phase + t * 3, ...lk }, counts);
            if (p.kind === 'carrier' && p.state === 'walk' && counts.c < 40) {
                _base.makeRotationY(p.yaw).setPosition(p.x + Math.sin(p.yaw) * 0.28, 0, p.z + Math.cos(p.yaw) * 0.28);
                _base.multiply(_r.makeRotationY(Math.PI / 2)).multiply(_s.makeScale(ACTOR_SCALE, ACTOR_SCALE, ACTOR_SCALE));
                this.carts.setMatrixAt(counts.c, _base);
                this.carts.setColorAt(counts.c++, _c.setHex(0xffffff));
            }
            // overhead
            if (!this.shown) continue;
            const h = 0.5 * K.scale * ACTOR_SCALE + 0.06;
            const icon = [];
            if (p.state === 'down') icon.push(ICON.down);
            else {
                if (p.wound > 0) icon.push(ICON.wound);
                if (p.sick >= 5) icon.push(ICON.sick);
                if (p.hunger) icon.push(ICON.hunger);
                if (ail && ail.has('cold') && p.cold > 40) icon.push(ICON.cold);
                if (p.fracture) icon.push(ICON.fracture);
                if (p.fear > 45) icon.push(ICON.fear);
            }
            const hurt = p.hp < p.maxHp - 0.5 || p.temp > 0.5 || p.sick > 0 || icon.length;
            if (p.restored && !hurt) { pushIcon(p.x, h, p.z, ICON.heart, 0, 1, 0.8); continue; }
            if (hurt || p.role === 'vol' || flags.allBars) {
                const blink = p.state === 'down' ? 0.55 + 0.45 * Math.sin(t * 8) : 1;
                pushBar(p.x, h, p.z, Math.max(0, p.hp / p.maxHp), Math.min(1, p.temp / p.maxHp), p.sick / 100, blink, 0, p.role === 'vol' ? 34 : 30);
            }
            icon.forEach((c, i) => pushIcon(p.x, h, p.z, c, i, icon.length, c === ICON.down ? 0.6 + 0.4 * Math.sin(t * 8) : 1));
        }

        // the dead
        const seen = new Set();
        if (world) for (const z of world.dead) {
            if (z.boss) { seen.add(z.id); this.drawBoss(z, dt, t); if (this.shown) pushBar(z.x, 2.2, z.z, z.blight / z.blightMax, 0, 0, 1, 1, 80); continue; }
            const lk = this.lookOf(z, true);
            const moving = z.stunT <= 0 && z.pauseT <= 0 && !z.engaged;
            const tint = z.state === 'fading' ? Math.max(0.05, 1 - z.fade) : z.hitT > 0 ? 1.6 : z.stunT > 0 ? 1.3 : 1;
            const sway = moving ? Math.sin(z.phase * 0.9) * 0.4 : 0;
            const sink = z.state === 'fading' ? -z.fade * 0.25 : 0;
            this.body({ x: z.x, z: z.z, y: sink, yaw: z.yaw + Math.sin(z.phase * 0.3) * 0.15, scale: z.scale * 1.02, swing: sway, pose: 'walk', dead: true, tint, phase: z.phase, ...lk }, counts);
            if (this.shown && world.boss && z.state === 'walk' && z.blight < z.blightMax) pushBar(z.x, 0.55 * z.scale * ACTOR_SCALE + 0.06, z.z, z.blight / z.blightMax, 0, 0, 1, 1, 26);
            if (this.shown && z.mode === 'lured') pushIcon(z.x, 0.55 * z.scale * ACTOR_SCALE + 0.06, z.z, ICON.lured, 0, 1, 0.9);
        }
        for (const [id, b] of this.bosses) if (!seen.has(id)) { this.root.remove(b.group); this.bosses.delete(id); }

        // the crowd in the Haven
        for (const c of this.crowd) {
            c.phase += dt * 6;
            c.glowT = Math.max(0, c.glowT - dt);
            c.cheer = Math.max(0, c.cheer - dt);
            let walking = false;
            if (c.wait > 0) c.wait -= dt;
            else {
                const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
                if (d < 0.05) { c.wait = 2 + (Math.sin(c.phase * 13.7) * 0.5 + 0.5) * 6; c.tx = W - HAVEN_COLS + 0.6 + (Math.sin(c.phase * 3.1) * 0.5 + 0.5) * 2.1; c.tz = 0.6 + (Math.cos(c.phase * 2.3) * 0.5 + 0.5) * (H - 1.2); }
                else { const v = Math.min(d, dt * 0.5); c.x += (dx / d) * v; c.z += (dz / d) * v; c.yaw = Math.atan2(dx, dz); walking = true; }
            }
            const lk = this.lookOf(c);
            this.body({ x: c.x, z: c.z, y: 0, yaw: c.yaw, scale: KINDS[c.kind].scale, swing: walking ? Math.sin(c.phase) * 0.5 : 0, pose: c.cheer > 0 ? 'cheer' : 'stand', dead: false, tint: c.glowT > 0 ? 1.3 : 1, phase: c.phase, ...lk }, counts);
            if (this.shown && c.glowT > 0) pushIcon(c.x, 0.5 * KINDS[c.kind].scale * ACTOR_SCALE + 0.1, c.z, ICON.heart, 0, 1, Math.min(1, c.glowT));
        }

        // flush
        for (const [m, n] of [[this.legs, counts.l], [this.torso, counts.n], [this.arms, counts.a], [this.head, counts.n], [this.eyes, counts.e], [this.carts, counts.c]]) {
            m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        this.hats.forEach((m, k) => { m.count = counts.h[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
        this.bars.geo.instanceCount = nb;
        this.icons.geo.instanceCount = ni;
        for (const a of Object.values(bars)) a.needsUpdate = true;
        for (const a of Object.values(icons)) a.needsUpdate = true;
        this.drawn = counts.n;
    }

    drawBoss(z, dt, t) {
        let b = this.bosses.get(z.id);
        if (!b) {
            b = bossModel(z.kind);
            b.group.traverse((o) => { if (o.isMesh && o.material === toyMat) o.castShadow = true; });
            this.root.add(b.group);
            this.bosses.set(z.id, b);
            b.hit = 0;
        }
        const r = b.rig;
        b.group.position.set(z.x, r.float ? 0.15 + Math.sin(t * 1.5) * 0.08 : 0, z.z);
        b.group.rotation.y = z.yaw;
        const moving = z.stunT <= 0 && z.pauseT <= 0;
        const ph = z.phase;
        for (let i = 0; i < r.legs.length; i++) r.legs[i].rotation.x = moving ? Math.sin(ph * 0.5 + i * Math.PI) * (r.pulse ? 0.25 : 0.35) : 0;
        for (let i = 0; i < r.arms.length; i++) r.arms[i].rotation.x = -0.9 + Math.sin(ph * 0.4 + i) * 0.2 - (z.pauseT > 0 ? 1.2 : 0);
        if (r.body) {
            r.body.rotation.z = Math.sin(ph * 0.25) * 0.06;
            if (r.pulse) { const s = 1 + Math.sin(t * (3 + z.phaseN * 1.5)) * 0.06; r.body.scale.set(s, s, s); }
        }
        b.hit = z.hitT > 0 ? 1 : Math.max(0, b.hit - dt * 4);
        r.aura.material.opacity = 0.035 + b.hit * 0.06 + Math.sin(t * 2) * 0.012;
        const frac = z.blight / z.blightMax;
        r.aura.scale.setScalar((r.pulse ? 1.3 : 0.9) * (0.7 + frac * 0.5));
    }

    /** Id of whoever is nearest a screen point: { kind: 'person' | 'dead', id } or null. */
    pick(world, sx, sy, toScreen, maxPx = 30) {
        let best = null, bd = maxPx * maxPx;
        const test = (e, kind, h) => {
            const s = toScreen(e.x, h, e.z);
            if (!s) return;
            const d = (s.x - sx) ** 2 + (s.y - sy) ** 2;
            if (d < bd) { bd = d; best = { kind, id: e.id }; }
        };
        for (const p of world.people) test(p, 'person', 0.35);
        for (const z of world.dead) test(z, 'dead', z.boss ? 0.9 : 0.35);
        return best;
    }

    setVisible(v) { this.shown = v; }
}
const _c2 = new THREE.Color();
