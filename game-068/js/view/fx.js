/**
 * fx.js — the warm stuff: rising plus signs, hearts and music notes, steam, sparks, blight motes,
 * golden bursts when someone is cured, lanterns that rise for the lost; plus the things in flight
 * (bandages, vials, soup, darts, herb bombs, spit), rings (splashes, flares, bells, slams) and beams.
 *
 * Particles are one Points draw sized in world units from the drawing buffer and the field of view,
 * capped at a fraction of the screen and faded near the lens (the game-066 lesson).
 */

import * as THREE from 'three';
import { MAX_FX } from '../config.js';
import { Builder } from './builder.js';
import { toyMat } from './materials.js';

export const P = { soft: 0, plus: 1, heart: 2, note: 3, star: 4, drop: 5, flake: 6, smoke: 7, lantern: 8, leaf: 9, ring: 10, spark: 11 };

function atlas() {
    const S = 64, N = 4;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S * N;
    const g = cv.getContext('2d');
    const cell = (i, fn) => { g.save(); g.translate((i % N) * S + S / 2, Math.floor(i / N) * S + S / 2); fn(); g.restore(); };
    const soft = (r, a = 1) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); };
    g.fillStyle = '#fff';
    cell(P.soft, () => soft(30));
    cell(P.plus, () => { soft(30, 0.35); g.fillStyle = '#fff'; g.fillRect(-6, -20, 12, 40); g.fillRect(-20, -6, 40, 12); });
    cell(P.heart, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 20); g.bezierCurveTo(-34, -4, -14, -30, 0, -12); g.bezierCurveTo(14, -30, 34, -4, 0, 20); g.fill(); });
    cell(P.note, () => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-6, 12, 10, 7, -0.4, 0, 7); g.fill(); g.fillRect(2, -20, 5, 32); g.beginPath(); g.moveTo(7, -20); g.quadraticCurveTo(22, -14, 16, 0); g.lineTo(14, -2); g.quadraticCurveTo(16, -10, 7, -12); g.fill(); });
    cell(P.star, () => { soft(22, 0.6); g.fillStyle = '#fff'; g.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 5 : 26, a = (k / 8) * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); });
    cell(P.drop, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -18); g.bezierCurveTo(14, 2, 13, 18, 0, 18); g.bezierCurveTo(-13, 18, -14, 2, 0, -18); g.fill(); });
    cell(P.flake, () => { g.strokeStyle = '#fff'; g.lineWidth = 4; for (let k = 0; k < 3; k++) { g.save(); g.rotate((k * Math.PI) / 3); g.beginPath(); g.moveTo(0, -20); g.lineTo(0, 20); g.stroke(); g.restore(); } });
    cell(P.smoke, () => { for (const [x, y, r] of [[-8, 4, 16], [8, 2, 15], [0, -8, 16]]) { g.save(); g.translate(x, y); soft(r, 0.7); g.restore(); } });
    cell(P.lantern, () => { soft(30, 0.5); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-9, -13, 18, 24, 5); g.fill(); g.fillRect(-5, -17, 10, 4); });
    cell(P.leaf, () => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 9, 18, 0.6, 0, 7); g.fill(); });
    cell(P.ring, () => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.stroke(); });
    cell(P.spark, () => { soft(14, 1); soft(30, 0.3); });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const VERT = `
    attribute float aSize; attribute float aCell; attribute float aAlpha; attribute float aRot; attribute vec3 aCol;
    uniform float uScale, uMax;
    varying float vCell; varying float vAlpha; varying vec3 vCol; varying float vRot;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(0.1, -mv.z);
        gl_PointSize = min(uMax, aSize * uScale / d);
        gl_Position = projectionMatrix * mv;
        vCell = aCell; vCol = aCol; vRot = aRot;
        vAlpha = aAlpha * clamp((d - 0.6) / 1.5, 0.0, 1.0);
        if (vAlpha <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }`;
const FRAG = `
    uniform sampler2D uAtlas;
    varying float vCell; varying float vAlpha; varying vec3 vCol; varying float vRot;
    void main() {
        vec2 p = gl_PointCoord - 0.5;
        float c = cos(vRot), s = sin(vRot);
        p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
        if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
        float cx = mod(vCell, 4.0), cy = floor(vCell / 4.0);
        vec2 uv = vec2((cx + p.x) / 4.0, 1.0 - (cy + p.y) / 4.0);
        vec4 t = texture2D(uAtlas, uv);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol * t.rgb, a);
    }`;

const SHOT_GEO = {
    bandage: () => { const b = new Builder(); b.cyl(0.045, 0.06, 0xf8f6f0, 0, -0.03, 0, { seg: 8, rx: Math.PI / 2, centre: true }); b.box(0.02, 0.05, 0.065, 0xd8382e, 0, -0.025, 0); return b.geometry(); },
    vial: () => { const b = new Builder(); b.cyl(0.03, 0.08, 0xbfe6f2, 0, -0.04, 0, { seg: 6 }); b.cyl(0.026, 0.05, 0x7cf28a, 0, -0.04, 0, { seg: 6, glow: 2 }); b.cyl(0.015, 0.02, 0x8a5a3a, 0, 0.04, 0, { seg: 5 }); return b.geometry(); },
    soup: () => { const b = new Builder(); b.sphere(0.055, 0xe8dcc0, 0, 0, 0, { seg: 8, rings: 4, half: true, rx: Math.PI }); b.cyl(0.05, 0.01, 0xd88a3a, 0, -0.005, 0, { seg: 8, glow: 0.6 }); return b.geometry(); },
    splint: () => { const b = new Builder(); b.box(0.025, 0.14, 0.025, 0xc89a68, -0.02, -0.07, 0); b.box(0.025, 0.14, 0.025, 0xc89a68, 0.02, -0.07, 0); b.box(0.06, 0.02, 0.03, 0xf4f1ea, 0, -0.01, 0); return b.geometry(); },
    spit: () => { const b = new Builder(); b.ico(0.045, 0x8ad84a, 0, 0, 0, { glow: 1.5 }); return b.geometry(); },
    glob: () => { const b = new Builder(); b.ico(0.13, 0x9af27a, 0, 0, 0, { glow: 2, detail: 1 }); b.ico(0.08, 0x5a3a6a, 0.06, 0.05, 0.04, { detail: 0 }); return b.geometry(); },
    dart: () => { const b = new Builder(); b.cyl(0.012, 0.14, 0x9ff0ff, 0, -0.07, 0, { seg: 5, glow: 2.5, rx: Math.PI / 2, centre: true }); return b.geometry(); },
    toss: () => { const b = new Builder(); b.sphere(0.04, 0xffe48a, 0, 0, 0, { seg: 7, glow: 2.5 }); return b.geometry(); },
    bomb: () => { const b = new Builder(); b.ico(0.06, 0x6ab84a, 0, 0, 0, { glow: 1 }); for (let i = 0; i < 4; i++) b.cone(0.02, 0.06, 0x8ad86a, Math.cos(i * 1.6) * 0.04, 0.03, Math.sin(i * 1.6) * 0.04, { glow: 1 }); return b.geometry(); },
};
const SHOT_TRAIL = { vial: [0x8af27a, P.spark], toss: [0xffe48a, P.spark], dart: [0x9ff0ff, P.spark], bomb: [0x8ad86a, P.leaf], glob: [0xa8f27a, P.soft], spit: [0x9ad84a, P.soft], soup: [0xffffff, P.smoke] };

export class FX {
    constructor(root) {
        this.root = root;
        const n = MAX_FX;
        this.n = n;
        this.pos = new Float32Array(n * 3);
        this.vel = new Float32Array(n * 3);
        this.col = new Float32Array(n * 3);
        this.size = new Float32Array(n);
        this.cell = new Float32Array(n);
        this.alpha = new Float32Array(n);
        this.rot = new Float32Array(n);
        this.spin = new Float32Array(n);
        this.life = new Float32Array(n);
        this.max = new Float32Array(n);
        this.grav = new Float32Array(n);
        this.drag = new Float32Array(n);
        this.grow = new Float32Array(n);
        this.next = 0;
        const geo = new THREE.BufferGeometry();
        const at = (name, arr, size) => { const a = new THREE.BufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, a); return a; };
        this.aPos = at('position', this.pos, 3);
        this.aCol = at('aCol', this.col, 3);
        this.aSize = at('aSize', this.size, 1);
        this.aCell = at('aCell', this.cell, 1);
        this.aAlpha = at('aAlpha', this.alpha, 1);
        this.aRot = at('aRot', this.rot, 1);
        geo.setDrawRange(0, n);
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uAtlas: { value: atlas() }, uScale: { value: 400 }, uMax: { value: 200 } },
            vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
        });
        this.points = new THREE.Points(geo, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 10;
        root.add(this.points);

        // things in flight
        this.shotMeshes = {};
        for (const [k, fn] of Object.entries(SHOT_GEO)) {
            const m = new THREE.InstancedMesh(fn(), toyMat, 64);
            m.count = 0; m.frustumCulled = false;
            root.add(m);
            this.shotMeshes[k] = m;
        }
        // rings
        this.rings = [];
        const rg = new THREE.RingGeometry(0.93, 1, 48);
        rg.rotateX(-Math.PI / 2);
        for (let i = 0; i < 24; i++) {
            const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
            m.visible = false; m.renderOrder = 5;
            root.add(m);
            this.rings.push({ m, t: 0, dur: 1, r0: 0, r1: 1 });
        }
        // beams
        this.beams = [];
        const bg = new THREE.BoxGeometry(1, 0.05, 0.12);
        bg.translate(0.5, 0, 0);
        for (let i = 0; i < 10; i++) {
            const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
            m.visible = false; m.renderOrder = 6;
            root.add(m);
            this.beams.push({ m, t: 0, dur: 0.3 });
        }
        // the range ring for selection and placement
        const rr = new THREE.RingGeometry(0.965, 1, 64); rr.rotateX(-Math.PI / 2);
        const rf = new THREE.CircleGeometry(1, 48); rf.rotateX(-Math.PI / 2);
        this.range = new THREE.Group();
        this.rangeLine = new THREE.Mesh(rr, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
        this.rangeFill = new THREE.Mesh(rf, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
        this.range.add(this.rangeFill, this.rangeLine);
        this.range.position.y = 0.02;
        this.range.renderOrder = 4;
        this.range.visible = false;
        root.add(this.range);
        this.t = 0;
    }

    setView(bufferH, fovDeg) {
        this.mat.uniforms.uScale.value = bufferH / (2 * Math.tan((fovDeg * Math.PI) / 360));
        this.mat.uniforms.uMax.value = bufferH * 0.3;
    }

    /** One particle. o: { x,y,z, vx,vy,vz, life, size, col, cell, grav, drag, spin, grow, alpha } */
    emit(o) {
        const i = this.next;
        this.next = (this.next + 1) % this.n;
        const j = i * 3;
        this.pos[j] = o.x; this.pos[j + 1] = o.y; this.pos[j + 2] = o.z;
        this.vel[j] = o.vx || 0; this.vel[j + 1] = o.vy || 0; this.vel[j + 2] = o.vz || 0;
        const c = _col.setHex(o.col ?? 0xffffff);
        this.col[j] = c.r; this.col[j + 1] = c.g; this.col[j + 2] = c.b;
        this.size[i] = o.size ?? 0.1;
        this.cell[i] = o.cell ?? P.soft;
        this.life[i] = this.max[i] = o.life ?? 1;
        this.grav[i] = o.grav ?? 0;
        this.drag[i] = o.drag ?? 0;
        this.rot[i] = o.rot ?? 0;
        this.spin[i] = o.spin ?? 0;
        this.grow[i] = o.grow ?? 0;
        this.alpha[i] = o.alpha ?? 1;
        this._a0 = this._a0 || new Float32Array(this.n);
        this._a0[i] = o.alpha ?? 1;
    }

    burst(kind, x, z, opts = {}) {
        const y = opts.y ?? 0.35;
        const R = Math.random;
        switch (kind) {
            case 'heal': for (let i = 0; i < 5; i++) this.emit({ x: x + (R() - 0.5) * 0.2, y: y + R() * 0.1, z: z + (R() - 0.5) * 0.2, vy: 0.5 + R() * 0.3, life: 0.9, size: 0.1, col: opts.col ?? 0x7cf28a, cell: P.plus, drag: 1 }); break;
            case 'heart': for (let i = 0; i < (opts.n ?? 3); i++) this.emit({ x: x + (R() - 0.5) * 0.3, y: y + 0.1, z: z + (R() - 0.5) * 0.3, vy: 0.45 + R() * 0.3, vx: (R() - 0.5) * 0.2, life: 1.3, size: 0.11, col: opts.col ?? 0xff7a8a, cell: P.heart, drag: 0.6 }); break;
            case 'notes': for (let i = 0; i < (opts.n ?? 2); i++) this.emit({ x: x + (R() - 0.5) * 0.3, y: y + 0.2, z: z + (R() - 0.5) * 0.3, vy: 0.35 + R() * 0.2, vx: (R() - 0.5) * 0.3, life: 1.6, size: 0.11, col: [0xd8b0ff, 0xffd86a, 0x8ad8ff][Math.floor(R() * 3)], cell: P.note, drag: 0.5, spin: (R() - 0.5) * 2 }); break;
            case 'steam': this.emit({ x: x + (R() - 0.5) * 0.1, y, z: z + (R() - 0.5) * 0.1, vy: 0.25, vx: 0.05, life: 1.6, size: 0.12, col: 0xffffff, cell: P.smoke, alpha: 0.4, grow: 0.15 }); break;
            case 'ember': this.emit({ x: x + (R() - 0.5) * 0.15, y, z: z + (R() - 0.5) * 0.15, vy: 0.5 + R() * 0.4, vx: (R() - 0.5) * 0.15, life: 0.9, size: 0.04, col: 0xffa040, cell: P.spark, drag: 0.4 }); break;
            case 'sparkle': for (let i = 0; i < (opts.n ?? 8); i++) { const a = R() * 6.28, s = 0.3 + R() * 0.6; this.emit({ x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 0.4 + R() * 0.6, life: 0.8 + R() * 0.4, size: opts.size ?? 0.08, col: opts.col ?? 0xffe48a, cell: P.star, drag: 2, grav: 0.6, spin: 3 }); } break;
            case 'splash': for (let i = 0; i < 14; i++) { const a = R() * 6.28, s = 0.4 + R() * 0.8; this.emit({ x, y: 0.15, z, vx: Math.cos(a) * s * (opts.r ?? 1), vz: Math.sin(a) * s * (opts.r ?? 1), vy: 0.6 + R() * 0.6, life: 0.7, size: 0.07, col: opts.col ?? 0x8af27a, cell: P.drop, grav: 2.2, drag: 1 }); } break;
            case 'blight': this.emit({ x: x + (R() - 0.5) * 0.3, y: y + R() * 0.2, z: z + (R() - 0.5) * 0.3, vy: 0.15, life: 1.2, size: 0.06, col: opts.col ?? 0x9a6af2, cell: P.soft, alpha: 0.6, drag: 0.3 }); break;
            case 'cure': {
                for (let i = 0; i < 18; i++) { const a = R() * 6.28, s = 0.3 + R() * 0.9; this.emit({ x, y: y + 0.1, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 0.6 + R() * 1.0, life: 1.1, size: 0.09, col: R() < 0.5 ? 0xffe48a : 0xffffff, cell: P.star, drag: 1.6, grav: 0.3, spin: 4 }); }
                this.emit({ x, y: y + 0.2, z, life: 0.5, size: 0.4 * (opts.s ?? 1), col: 0xfff2c0, cell: P.soft, alpha: 0.5, grow: 0.8 * (opts.s ?? 1) });
                break;
            }
            case 'lantern': this.emit({ x, y: 0.4, z, vy: 0.28, vx: 0.05, life: 9, size: 0.2, col: 0xffc860, cell: P.lantern, drag: 0, alpha: 1 }); break;
            case 'dust': for (let i = 0; i < 10; i++) { const a = R() * 6.28, s = 0.3 + R() * 0.5; this.emit({ x, y: 0.05, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 0.2, life: 0.8, size: 0.14, col: opts.col ?? 0xd8c8a8, cell: P.smoke, alpha: 0.6, drag: 2, grow: 0.3 }); } break;
            case 'scratch': for (let i = 0; i < 4; i++) this.emit({ x: x + (R() - 0.5) * 0.15, y: 0.3 + R() * 0.1, z: z + (R() - 0.5) * 0.15, vy: 0.3, vx: (R() - 0.5) * 0.5, vz: (R() - 0.5) * 0.5, life: 0.5, size: 0.06, col: 0xb07af2, cell: P.soft, drag: 2 }); break;
            case 'confetti': for (let i = 0; i < (opts.n ?? 24); i++) { const a = R() * 6.28, s = 0.4 + R() * 1.2; this.emit({ x, y: y + 0.3, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 1 + R() * 1.4, life: 1.6 + R() * 0.6, size: 0.07, col: [0xff7a8a, 0xffd86a, 0x8ad8ff, 0x8af27a, 0xd8b0ff][Math.floor(R() * 5)], cell: P.leaf, grav: 1.6, drag: 1.2, spin: (R() - 0.5) * 10 }); } break;
            case 'spray': {
                const dx = opts.tx - x, dz = opts.tz - z, d = Math.hypot(dx, dz) || 1;
                for (let i = 0; i < 16; i++) { const sp = 2.2 + R() * 1.6, j = (R() - 0.5) * 0.7; const ux = dx / d, uz = dz / d; this.emit({ x, y: 0.32, z, vx: (ux - uz * j) * sp, vz: (uz + ux * j) * sp, vy: 0.4 + R() * 0.5, life: 0.5, size: 0.07, col: 0x9fd8ff, cell: P.drop, grav: 3, drag: 1.2 }); }
                break;
            }
            case 'flake': for (let i = 0; i < 6; i++) this.emit({ x: x + (R() - 0.5) * 0.4, y: y + R() * 0.3, z: z + (R() - 0.5) * 0.4, vy: -0.1, vx: (R() - 0.5) * 0.4, life: 1.2, size: 0.07, col: 0xd8f2ff, cell: P.flake, spin: 2 }); break;
            case 'bolt': for (let i = 0; i < 4; i++) this.emit({ x: x + (R() - 0.5) * 0.3, y: y + 0.1, z: z + (R() - 0.5) * 0.3, vy: 0.3, life: 0.6, size: 0.07, col: 0xd8b0ff, cell: P.spark, drag: 1 }); break;
            default: break;
        }
    }

    ring(x, z, r1, col, dur = 0.7, r0 = 0.1) {
        const R = this.rings.find((q) => q.t >= q.dur) || this.rings[0];
        R.t = 0; R.dur = dur; R.r0 = r0; R.r1 = r1;
        R.m.material.color.setHex(col);
        R.m.position.set(x, 0.03, z);
        R.m.visible = true;
    }

    beam(x, z, tx, tz, col = 0xfff6c8, dur = 0.3) {
        const B = this.beams.find((q) => q.t >= q.dur) || this.beams[0];
        B.t = 0; B.dur = dur;
        const len = Math.hypot(tx - x, tz - z);
        B.m.position.set(x, 0.32, z);
        B.m.rotation.set(0, -Math.atan2(tz - z, tx - x), 0);
        B.m.scale.set(len, 1, 1);
        B.m.material.color.setHex(col);
        B.m.visible = true;
    }

    showRange(x, z, r, col = 0xffffff, ok = true) {
        this.range.visible = true;
        this.range.position.set(x, 0.02, z);
        this.range.scale.set(r, 1, r);
        this.rangeLine.material.color.setHex(ok ? col : 0xff6a5a);
        this.rangeFill.material.color.setHex(ok ? col : 0xff6a5a);
    }
    hideRange() { this.range.visible = false; }

    update(dt, world) {
        this.t += dt;
        const a0 = this._a0;
        for (let i = 0; i < this.n; i++) {
            if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
            this.life[i] -= dt;
            const j = i * 3;
            const dr = Math.max(0, 1 - this.drag[i] * dt);
            this.vel[j] *= dr; this.vel[j + 1] = this.vel[j + 1] * dr - this.grav[i] * dt; this.vel[j + 2] *= dr;
            this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
            if (this.pos[j + 1] < 0.01) { this.pos[j + 1] = 0.01; this.vel[j + 1] *= -0.2; }
            this.rot[i] += this.spin[i] * dt;
            this.size[i] += this.grow[i] * dt;
            const f = this.life[i] / this.max[i];
            this.alpha[i] = (a0 ? a0[i] : 1) * Math.min(1, f * 3) * Math.min(1, (1 - f) * 12 + 0.2);
            if (this.life[i] <= 0) this.alpha[i] = 0;
        }
        this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aCell.needsUpdate = this.aAlpha.needsUpdate = this.aRot.needsUpdate = true;

        // in flight
        const counts = {};
        for (const k in this.shotMeshes) counts[k] = 0;
        if (world) for (const s of world.shots) {
            const m = this.shotMeshes[s.kind];
            if (!m || counts[s.kind] >= 64) continue;
            const u = Math.min(1, s.t / s.dur);
            const x = s.x + (s.tx - s.x) * u, z = s.z + (s.tz - s.z) * u;
            const y = 0.35 + Math.sin(u * Math.PI) * (s.h || 0.5);
            _m4.makeRotationY(Math.atan2(s.tx - s.x, s.tz - s.z)).multiply(_r4.makeRotationX(u * 8)).setPosition(x, y, z);
            m.setMatrixAt(counts[s.kind]++, _m4);
            const tr = SHOT_TRAIL[s.kind];
            if (tr && Math.random() < 0.5) this.emit({ x, y, z, life: 0.35, size: 0.05, col: tr[0], cell: tr[1], alpha: 0.7 });
        }
        for (const k in this.shotMeshes) { const m = this.shotMeshes[k]; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; }

        for (const R of this.rings) {
            if (R.t >= R.dur) { R.m.visible = false; continue; }
            R.t += dt;
            const f = Math.min(1, R.t / R.dur);
            const r = R.r0 + (R.r1 - R.r0) * (1 - (1 - f) * (1 - f));
            R.m.scale.set(r, 1, r);
            R.m.material.opacity = (1 - f) * 0.55;
        }
        for (const B of this.beams) {
            if (B.t >= B.dur) { B.m.visible = false; continue; }
            B.t += dt;
            B.m.material.opacity = (1 - B.t / B.dur) * 0.9;
        }
        if (this.range.visible) this.rangeLine.material.opacity = 0.6 + Math.sin(this.t * 4) * 0.2;
    }

    clear() {
        this.life.fill(0); this.alpha.fill(0);
        for (const R of this.rings) { R.t = R.dur; R.m.visible = false; }
        for (const B of this.beams) { B.t = B.dur; B.m.visible = false; }
    }
}
const _col = new THREE.Color(), _m4 = new THREE.Matrix4(), _r4 = new THREE.Matrix4();
