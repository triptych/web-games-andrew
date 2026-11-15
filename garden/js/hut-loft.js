// Upstairs in the Hut: a stair along the right-hand wall climbs through the
// ceiling into a loft under the roof. Under the rafters there is a round
// stained-glass window that is a new design every time you come up (see
// stained-glass.js), a bed tucked under the eaves with a patchwork quilt and a
// sleeping cat, where you can sleep through the night (or nap until dusk); a
// desk with an old beige computer whose amber Hercules screen shows a
// wireframe survey of the island (see hut-computer.js), and a wooden flute
// beside it with a songbook (see hut-flute.js). Strings of twinkle lights hang
// from the ridge beam and come on one by one as night falls.

import * as THREE from 'three';
import { xf } from './materials.js';
import { glowSprite, softGlow } from './textures.js';
import { stainedGlass } from './stained-glass.js';
import { IslandSurvey, HerculesTerminal } from './hut-computer.js';
import { FluteSynth, FluteUI, SONGS } from './hut-flute.js';
import { rng, TAU, clamp, smoothstep, damp } from './util.js';

export const KNEE = 1.7, RIDGE = 3.5;      // loft knee walls and ridge, above the loft floor

/**
 * The stair, in three parts: two steps up from the room toward the right-hand wall, a landing in
 * the front corner where it turns, and the main flight up the wall from the landing (zL) to the
 * back (zTop). Fourteen risers in all, three of them to the landing.
 */
export const STAIR = { x0: 2.28, x1: 3.14, zBot: 2.95, zTop: -0.4, n: 14, zL: 2.09, landing: 3, xB: 1.62 };

/** Can you stand on the stair at (x, z)? `zMax` is the front wall less your width. */
export function onStair(x, z, zMax) {
    const S = STAIR;
    if (x > S.x0 + 0.02 && x < S.x1 - 0.22) return z > S.zTop - 0.1 && z < zMax;   // the landing and the main flight
    return x > S.xB && x <= S.x0 + 0.02 && z > S.zL + 0.05 && z < zMax;          // the two bottom steps
}

/** The height of the stair underfoot at (x, z), climbing smoothly from 0 to the loft floor F. */
export function stairHeight(x, z, F) {
    const S = STAIR, hl = (F / S.n) * S.landing;
    if (x <= S.x0 + 0.02) return hl * clamp((x - S.xB) / (S.x0 - S.xB), 0, 1);
    if (z >= S.zL) return hl;
    return hl + (F - hl) * clamp((S.zL - z) / (S.zL - S.zTop), 0, 1);
}
/** The hole in the floor the stair climbs through. */
export const HOLE = { x0: 2.2, z0: -0.45, z1: 1.9 };

const BED = { x: -2.36, z: -1.86, w: 1.5, l: 2.1 };
const DESK = { x: 1.72, z: -2.5, w: 1.6, d: 0.7, h: 0.76 };
const WIN = { y: 2.38, r: 0.8 };            // the round window's centre above the loft floor, and its radius

function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
    }
    t.anisotropy = 4;
    return t;
}

/** A patchwork quilt: squares of calico, gingham and stars, stitched together. */
function quiltTexture() {
    return canvasTex(512, 512, (x, w) => {
        const r = rng('loft-quilt');
        const cols = ['#c8553d', '#e8a87c', '#f2d0a4', '#7d9d6a', '#4f7ca8', '#b5838d', '#e9c46a', '#8d6a9f', '#f4ead5'];
        const n = 8, s = w / n;
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const c = cols[Math.floor(r() * cols.length)];
                x.fillStyle = c;
                x.fillRect(i * s, j * s, s, s);
                const k = r();
                x.fillStyle = 'rgba(255,255,255,0.35)';
                if (k < 0.25) {
                    // gingham
                    x.fillStyle = 'rgba(255,255,255,0.28)';
                    for (let q = 0; q < 4; q++) {
                        x.fillRect(i * s + q * (s / 4), j * s, s / 8, s);
                        x.fillRect(i * s, j * s + q * (s / 4), s, s / 8);
                    }
                } else if (k < 0.5) {
                    // calico dots
                    for (let q = 0; q < 14; q++) {
                        x.beginPath();
                        x.arc(i * s + r() * s, j * s + r() * s, 1.5 + r() * 2, 0, TAU);
                        x.fill();
                    }
                } else if (k < 0.65) {
                    // a star patch
                    x.fillStyle = cols[Math.floor(r() * cols.length)];
                    x.beginPath();
                    for (let q = 0; q < 10; q++) {
                        const a = (q / 10) * TAU - Math.PI / 2, rr = q % 2 ? s * 0.16 : s * 0.38;
                        x.lineTo(i * s + s / 2 + Math.cos(a) * rr, j * s + s / 2 + Math.sin(a) * rr);
                    }
                    x.fill();
                } else if (k < 0.8) {
                    // half-square triangle
                    x.fillStyle = cols[Math.floor(r() * cols.length)];
                    x.beginPath();
                    x.moveTo(i * s, j * s);
                    x.lineTo(i * s + s, j * s);
                    x.lineTo(i * s, j * s + s);
                    x.fill();
                }
            }
        }
        // running stitches along every seam
        x.strokeStyle = 'rgba(255, 248, 230, 0.8)';
        x.setLineDash([5, 5]);
        x.lineWidth = 2;
        for (let q = 0; q <= n; q++) {
            x.beginPath();
            x.moveTo(q * s, 0);
            x.lineTo(q * s, w);
            x.moveTo(0, q * s);
            x.lineTo(w, q * s);
            x.stroke();
        }
        x.setLineDash([]);
        x.strokeStyle = 'rgba(60, 30, 20, 0.35)';
        x.lineWidth = 2;
        for (let q = 0; q <= n; q++) {
            x.beginPath();
            x.moveTo(q * s + 3, 0);
            x.lineTo(q * s + 3, w);
            x.moveTo(0, q * s + 3);
            x.lineTo(w, q * s + 3);
            x.stroke();
        }
    });
}

/** A chunky knitted throw: rows of little Vs in stripes. */
function knitTexture() {
    return canvasTex(256, 128, (x, w, h) => {
        const stripes = ['#e9dcc2', '#c75b4a', '#e9dcc2', '#5f7d6b', '#e9dcc2'];
        const sh = h / stripes.length;
        stripes.forEach((c, i) => {
            x.fillStyle = c;
            x.fillRect(0, i * sh, w, sh);
        });
        x.strokeStyle = 'rgba(0,0,0,0.18)';
        x.lineWidth = 2;
        for (let y = 4; y < h; y += 8) {
            for (let k = 0; k < w; k += 8) {
                x.beginPath();
                x.moveTo(k, y - 3);
                x.lineTo(k + 4, y + 3);
                x.lineTo(k + 8, y - 3);
                x.stroke();
            }
        }
    });
}

/** A round braided rag rug, ring after ring. */
function rugTexture() {
    return canvasTex(512, 512, (x, w) => {
        const r = rng('loft-rug');
        const cols = ['#8a3b2e', '#c9864a', '#e7c98f', '#5b6f4f', '#3f5873', '#a7695c', '#d9b36a'];
        x.fillStyle = '#6a3a2a';
        x.fillRect(0, 0, w, w);
        const c = w / 2;
        let rad = c - 4, i = 0;
        while (rad > 6) {
            const col = cols[(i * 3 + Math.floor(r() * 2)) % cols.length];
            x.strokeStyle = col;
            x.lineWidth = 15;
            x.beginPath();
            x.arc(c, c, rad - 7, 0, TAU);
            x.stroke();
            // the braid: little slanted strands
            x.strokeStyle = 'rgba(0,0,0,0.22)';
            x.lineWidth = 2;
            const n = Math.max(8, Math.floor(rad / 3));
            for (let k = 0; k < n; k++) {
                const a = (k / n) * TAU;
                x.beginPath();
                x.moveTo(c + Math.cos(a) * (rad - 13), c + Math.sin(a) * (rad - 13));
                x.lineTo(c + Math.cos(a + 0.04) * (rad - 1), c + Math.sin(a + 0.04) * (rad - 1));
                x.stroke();
            }
            rad -= 16;
            i++;
        }
    });
}

/** The front of the computer: two floppy drives, a badge and a power light. */
function caseTexture() {
    return canvasTex(512, 160, (x, w, h) => {
        x.fillStyle = '#d8ceb4';
        x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(0,0,0,0.08)';
        for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1);
        for (const dx of [250, 384]) {
            x.fillStyle = '#c8bea4';
            x.fillRect(dx - 60, 24, 120, 112);
            x.strokeStyle = '#9a9078';
            x.lineWidth = 3;
            x.strokeRect(dx - 60, 24, 120, 112);
            x.fillStyle = '#2a2622';
            x.fillRect(dx - 50, 70, 100, 9);
            x.fillStyle = '#8a8270';
            x.fillRect(dx - 12, 96, 24, 26);
        }
        x.fillStyle = '#3a342c';
        x.font = '700 22px Georgia, serif';
        x.fillText('HUT/PC', 26, 54);
        x.font = '600 13px system-ui, sans-serif';
        x.fillText('PERSONAL COMPUTER', 26, 76);
        x.fillStyle = '#ff3a2a';
        x.fillRect(30, 118, 16, 8);
        x.fillStyle = '#4a4238';
        x.font = '600 11px system-ui, sans-serif';
        x.fillText('POWER', 52, 126);
    });
}

function keyboardTexture() {
    return canvasTex(512, 192, (x, w, h) => {
        x.fillStyle = '#cfc5aa';
        x.fillRect(0, 0, w, h);
        const rows = [15, 15, 14, 13, 11];
        rows.forEach((n, j) => {
            const kw = (w - 30) / 15.5, y = 14 + j * 34;
            const off = j * kw * 0.25;
            for (let i = 0; i < n; i++) {
                const big = j === 4 && i === 4;
                const ww = big ? kw * 5 : kw - 4;
                const xx = 14 + off + i * kw + (j === 4 && i > 4 ? kw * 4 : 0);
                x.fillStyle = j === 0 || i === 0 || i === n - 1 ? '#a89e86' : '#e8e0c8';
                x.fillRect(xx, y, ww, 28);
                x.fillStyle = 'rgba(0,0,0,0.12)';
                x.fillRect(xx, y + 24, ww, 4);
            }
        });
    });
}

/** Points along a string hung from a to b, sagging by `sag`, one every `gap` metres. */
function strand(a, b, sag, gap) {
    const len = a.distanceTo(b) + sag;
    const n = Math.max(3, Math.round(len / gap));
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= sag * 4 * t * (1 - t);
        pts.push(p);
    }
    return pts;
}

const SHAFT_VERT = /* glsl */ `
varying vec2 vUv; varying float vFace;
void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFace = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
}`;
const SHAFT_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
varying vec2 vUv; varying float vFace;
void main() {
    float along = smoothstep(0.0, 0.35, vUv.y) * (0.45 + 0.55 * vUv.y);
    float edge = pow(vFace, 1.6);
    float ripple = 0.85 + 0.15 * sin(vUv.x * 40.0 + uTime * 0.3) * sin(vUv.x * 13.0 - uTime * 0.2);
    gl_FragColor = vec4(uColor * along * edge * ripple * uOpacity, 1.0);
}`;

export class Loft {
    /**
     * @param {object} o
     * @param {object} o.hut     the Hut (for env, ui, and the level)
     * @param {Batch} o.batch    the room's static batch (built by the hut)
     * @param {object} o.dims    { R_X, R_Z, CEIL, F } room half-extents, ground ceiling, loft floor
     * @param {(x, z, w, d) => void} o.collide1   adds a collider on the loft floor
     */
    constructor({ hut, batch, dims, collide1 }) {
        this.hut = hut;
        this.env = hut.env;
        this.scene = hut.scene;
        this.mats = hut.mats;
        this.d = dims;
        this.collide1 = collide1;
        this.time = 0;
        this.hover = null;
        this.pickables = [];
        this.stairPick = [];
        this.danceUntil = -1;
        this.flyUntil = -1;
        this.purrUntil = -1;
        this.sleep = null;
        this.busy = false;
        this._materials();
        this._stair(batch);
        this._shell(batch);
        this._window(batch);
        this._bed(batch);
        this._desk(batch);
        this._cozy(batch);
        this._lights();
        this._twinkles();
        this._fireflies();
    }

    roofY(x) {
        const { R_X, F } = this.d;
        return F + KNEE + (RIDGE - KNEE) * (1 - Math.abs(x) / R_X);
    }

    _materials() {
        const m = this.mats, std = (o) => new THREE.MeshStandardMaterial(o);
        m.linen = std({ color: 0xf1e8d6, roughness: 0.95 });
        m.pillow = std({ color: 0xf6efe2, roughness: 0.95 });
        m.pillowRose = std({ color: 0xe6b7b0, roughness: 0.95 });
        m.quilt = std({ map: quiltTexture(), roughness: 0.92, side: THREE.DoubleSide });
        m.knit = std({ map: knitTexture(), roughness: 1 });
        m.braid = std({ map: rugTexture(), roughness: 1 });
        m.beige = std({ color: 0xd8ceb4, roughness: 0.7 });
        m.beigeDark = std({ color: 0xb4aa90, roughness: 0.75 });
        m.bezel = std({ color: 0x2a2620, roughness: 0.6 });
        m.shade = std({ color: 0x1f5a3a, roughness: 0.35, metalness: 0.2, emissive: 0x0e3a20, emissiveIntensity: 0.4 });
        m.mustard = std({ color: 0xd4a03a, roughness: 0.95 });
        m.sage = std({ color: 0x8aa585, roughness: 0.95 });
        m.terracotta = std({ color: 0xb8673e, roughness: 0.9 });
        m.fur = std({ color: 0xd98a3e, roughness: 1 });
        m.furLight = std({ color: 0xf2d2a4, roughness: 1 });
        m.wax = std({ color: 0xfff0d0, roughness: 0.6, emissive: 0xffc070, emissiveIntensity: 0.3 });
        m.flame = new THREE.MeshBasicMaterial({ color: 0xffc86a });
        m.flute = std({ color: 0xc89058, roughness: 0.5, map: m.wood.map });
        m.ribbon = std({ color: 0xc0283a, roughness: 0.8 });
        m.basket = std({ color: 0xb08850, roughness: 1, map: m.bark.map });
        m.mug = std({ color: 0x5a7ea8, roughness: 0.4 });
        m.cocoa = std({ color: 0x4a2a18, roughness: 0.3 });
        m.floppy = std({ color: 0x222226, roughness: 0.5 });
        m.label = std({ color: 0xf0e6c8, roughness: 0.9 });
    }

    _box(b, key, w, h, d, x, y, z, ry = 0) {
        b.add(key, new THREE.BoxGeometry(w, h, d), xf(x, y, z, ry));
    }

    /** Fourteen steps up the right-hand wall, a banister, and the rail round the hole above. */
    _stair(b) {
        const S = STAIR, { F } = this.d;
        const rise = F / S.n, w = S.x1 - S.x0, cx = (S.x0 + S.x1) / 2;
        const nMain = S.n - S.landing, tread = (S.zL - S.zTop) / nMain, hl = rise * S.landing;
        const step = (top, sx, sz, x, z) => {
            this._box(b, 'darkWood', sx, top, sz, x, top / 2, z);
            this._box(b, 'wood', sx + 0.03, 0.035, sz + 0.03, x, top - 0.0175, z);
        };
        // two steps up from the room, toward the wall, and the landing in the corner
        const tb = (S.x0 - S.xB - 0.1) / (S.landing - 1);
        for (let k = 0; k < S.landing - 1; k++) step((k + 1) * rise, tb, S.zBot - S.zL, S.x0 - (S.landing - 1 - k - 0.5) * tb, (S.zBot + S.zL) / 2);
        step(hl, w, S.zBot - S.zL, cx, (S.zBot + S.zL) / 2);
        // the main flight, up the wall from the landing
        for (let k = 0; k < nMain; k++) step(hl + (k + 1) * rise, w, tread, cx, S.zL - (k + 0.5) * tread);
        // a little cupboard door under the high end of the stair, on the room side
        const cz = 0.55, ch = 1.15;
        this._box(b, 'wood', 0.03, ch, 0.62, S.x0 - 0.01, ch / 2 + 0.06, cz);
        this._box(b, 'darkWood', 0.045, 0.05, 0.7, S.x0 - 0.02, ch + 0.09, cz);
        this._box(b, 'darkWood', 0.045, ch + 0.05, 0.05, S.x0 - 0.02, ch / 2 + 0.06, cz - 0.33);
        this._box(b, 'darkWood', 0.045, ch + 0.05, 0.05, S.x0 - 0.02, ch / 2 + 0.06, cz + 0.33);
        b.add('brass', new THREE.SphereGeometry(0.025, 8, 6), xf(S.x0 - 0.05, 0.62, cz - 0.2));
        // the banister: a newel post at the turn, a baluster on every step, a rail that climbs with the flight
        const zNewel = S.zL - 0.04, bx = S.x0 + 0.03;
        this._box(b, 'darkWood', 0.09, 1.0, 0.09, bx, hl + 0.5, zNewel);
        b.add('darkWood', new THREE.SphereGeometry(0.06, 10, 8), xf(bx, hl + 1.04, zNewel));
        for (let k = 0; k < nMain; k++) {
            const z = S.zL - (k + 0.5) * tread;
            const top = hl + (k + 1) * rise, railY = stairHeight(cx, z, F) + 0.92;
            this._box(b, 'darkWood', 0.03, railY - top, 0.03, bx, (railY + top) / 2, z);
        }
        // and a newel at the foot of the bottom steps, with a short rail up to the turn
        const fx = S.xB + 0.1, fz = S.zL + 0.03;
        this._box(b, 'darkWood', 0.1, 1.0, 0.1, fx, 0.5, fz);
        b.add('darkWood', new THREE.SphereGeometry(0.065, 10, 8), xf(fx, 1.04, fz));
        const f0 = new THREE.Vector3(fx, 0.95, fz), f1 = new THREE.Vector3(bx, hl + 0.95, fz);
        b.add('darkWood', new THREE.BoxGeometry(f0.distanceTo(f1), 0.05, 0.07), xf((f0.x + f1.x) / 2, (f0.y + f1.y) / 2, fz, 0, 1, 1, 1, 0, Math.atan2(f1.y - f0.y, f1.x - f0.x)));
        for (let k = 0; k < S.landing - 1; k++) {
            const x = S.x0 - (S.landing - 1 - k - 0.5) * tb, top = (k + 1) * rise;
            const railY = 0.95 + ((x - fx) / (bx - fx)) * hl;
            this._box(b, 'darkWood', 0.03, railY - top, 0.03, x, (railY + top) / 2, fz);
        }
        const r0 = new THREE.Vector3(bx, hl + 0.95, zNewel), r1 = new THREE.Vector3(bx, F + 0.92, S.zTop);
        const len = r0.distanceTo(r1), ang = Math.atan2(r1.y - r0.y, r0.z - r1.z);
        b.add('darkWood', new THREE.BoxGeometry(0.07, 0.05, len), xf(bx, (r0.y + r1.y) / 2, (r0.z + r1.z) / 2, 0, 1, 1, 1, ang, 0));
        // upstairs: a rail along the hole's open side and its front edge
        const ux = HOLE.x0 - 0.03, ry = F + 0.92;
        for (let z = HOLE.z0; z <= HOLE.z1 + 0.01; z += 0.235) this._box(b, 'darkWood', 0.03, 0.9, 0.03, ux, F + 0.45, z);
        for (const z of [HOLE.z0, HOLE.z1]) this._box(b, 'darkWood', 0.09, 1.0, 0.09, ux, F + 0.5, z);
        this._box(b, 'darkWood', 0.07, 0.05, HOLE.z1 - HOLE.z0 + 0.1, ux, ry, (HOLE.z0 + HOLE.z1) / 2);
        for (let x = ux + 0.24; x < S.x1; x += 0.24) this._box(b, 'darkWood', 0.03, 0.9, 0.03, x, F + 0.45, HOLE.z1);
        this._box(b, 'darkWood', S.x1 - ux, 0.05, 0.07, (S.x1 + ux) / 2, ry, HOLE.z1);
        for (let z = HOLE.z0 + 0.15; z < HOLE.z1 + 0.1; z += 0.29) this.collide1(ux, Math.min(z, HOLE.z1), 0.16, 0.16);
        for (let x = ux + 0.29; x < S.x1; x += 0.29) this.collide1(x, HOLE.z1, 0.16, 0.16);
        // the hole's edges, trimmed in dark wood
        this._box(b, 'darkWood', 0.1, 0.12, HOLE.z1 - HOLE.z0, HOLE.x0 - 0.05, this.d.CEIL - 0.04, (HOLE.z0 + HOLE.z1) / 2);
        this._box(b, 'darkWood', this.d.R_X - HOLE.x0, 0.12, 0.1, (HOLE.x0 + this.d.R_X) / 2, this.d.CEIL - 0.04, HOLE.z0 - 0.05);
        this._box(b, 'darkWood', this.d.R_X - HOLE.x0, 0.12, 0.1, (HOLE.x0 + this.d.R_X) / 2, this.d.CEIL - 0.04, HOLE.z1 + 0.05);
        // something to click to go up or down: the flight and landing, and the bottom steps
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, F + 0.4, S.zBot - S.zTop), hitMat);
        hit.position.set(cx, F / 2, (S.zBot + S.zTop) / 2);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(S.x0 - S.xB, hl + 0.1, S.zBot - S.zL), hitMat);
        foot.position.set((S.x0 + S.xB) / 2, hl / 2, (S.zBot + S.zL) / 2);
        for (const m of [hit, foot]) {
            m.userData.kind = 'stairs';
            this.scene.add(m);
        }
        this.stairHits = [hit, foot];
    }

    /** The loft's walls and roof: knee walls, two gables, sloping boards on rafters and a ridge beam. */
    _shell(b) {
        const { R_X, R_Z, CEIL, F } = this.d;
        const kTop = F + KNEE, ridge = F + RIDGE;
        // side walls from the ground floor's ceiling up to the eaves
        for (const sx of [-1, 1]) this._box(b, 'plaster', 0.12, kTop - CEIL, R_Z * 2, sx * R_X, (kTop + CEIL) / 2, 0);
        for (const sz of [-1, 1]) {
            this._box(b, 'plaster', R_X * 2, kTop - CEIL, 0.12, 0, (kTop + CEIL) / 2, sz * R_Z);
            const tri = new THREE.Shape();
            tri.moveTo(-R_X, 0);
            tri.lineTo(R_X, 0);
            tri.lineTo(0, RIDGE - KNEE);
            tri.closePath();
            const g = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06);
            b.add('plaster', g, xf(0, kTop, sz * R_Z));
        }
        // skirting and a dado rail
        this._box(b, 'darkWood', R_X * 2, 0.14, 0.05, 0, F + 0.07, -R_Z + 0.08);
        this._box(b, 'darkWood', R_X * 2, 0.14, 0.05, 0, F + 0.07, R_Z - 0.08);
        for (const sx of [-1, 1]) this._box(b, 'darkWood', 0.05, 0.14, R_Z * 2, sx * (R_X - 0.08), F + 0.07, 0);
        for (const sx of [-1, 1]) this._box(b, 'darkWood', 0.06, 0.1, R_Z * 2, sx * (R_X - 0.08), kTop - 0.05, 0);
        // the roof boards, and rafters under them
        const L = Math.hypot(R_X, RIDGE - KNEE), a = Math.atan2(RIDGE - KNEE, R_X);
        const nx = Math.sin(a), ny = Math.cos(a);
        for (const sx of [-1, 1]) {
            const mx = (sx * R_X) / 2, my = (kTop + ridge) / 2;
            b.add('wood', new THREE.BoxGeometry(L + 0.2, 0.08, R_Z * 2 + 0.1), xf(mx + sx * nx * 0.04, my + ny * 0.04, 0, 0, 1, 1, 1, 0, -sx * a));
            for (let z = -R_Z + 0.25; z < R_Z; z += 0.92) {
                b.add('darkWood', new THREE.BoxGeometry(L, 0.16, 0.1), xf(mx - sx * nx * 0.08, my - ny * 0.08, z, 0, 1, 1, 1, 0, -sx * a));
            }
        }
        this._box(b, 'darkWood', 0.2, 0.24, R_Z * 2, 0, ridge - 0.16, 0);
        // a collar tie across the front half (clear of the window's view)
        this._box(b, 'darkWood', 2.6, 0.12, 0.12, 0, this.roofY(1.3) - 0.12, 1.0);
        // a little round window in the front gable, looking out at the night
        const fw = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), this.mats.window);
        fw.position.set(-1.25, F + 1.95, R_Z - 0.07);
        fw.rotation.y = Math.PI;
        this.scene.add(fw);
        b.add('darkWood', new THREE.TorusGeometry(0.32, 0.045, 8, 32), xf(-1.25, F + 1.95, R_Z - 0.08));
        b.add('darkWood', new THREE.BoxGeometry(0.62, 0.035, 0.05), xf(-1.25, F + 1.95, R_Z - 0.09));
        b.add('darkWood', new THREE.BoxGeometry(0.035, 0.62, 0.05), xf(-1.25, F + 1.95, R_Z - 0.09));
    }

    /** The rose window in the back gable, the shaft of light it throws and the colours it lays on the floor. */
    _window(b) {
        const { R_Z, F } = this.d;
        const sg = stainedGlass();
        this.glass = sg;
        const cy = F + WIN.y, wz = -R_Z + 0.075;
        this.winMat = new THREE.MeshBasicMaterial({ map: sg.texture, transparent: true, alphaTest: 0.1 });
        const disc = new THREE.Mesh(new THREE.CircleGeometry(WIN.r, 64), this.winMat);
        disc.position.set(0, cy, wz);
        this.scene.add(disc);
        b.add('darkWood', new THREE.TorusGeometry(WIN.r + 0.03, 0.07, 10, 64), xf(0, cy, wz + 0.01));
        b.add('wood', new THREE.TorusGeometry(WIN.r + 0.13, 0.035, 8, 64), xf(0, cy, wz));
        // a deep sill for a plant
        this._box(b, 'wood', 0.7, 0.05, 0.2, 0, cy - WIN.r - 0.12, wz + 0.1);
        b.add('terracotta', new THREE.CylinderGeometry(0.07, 0.055, 0.11, 12), xf(0.18, cy - WIN.r - 0.04, wz + 0.1));
        for (let k = 0; k < 6; k++) b.add('hedge', new THREE.SphereGeometry(0.05, 6, 5), xf(0.18 + Math.cos(k) * 0.04, cy - WIN.r + 0.04 + (k % 2) * 0.03, wz + 0.1 + Math.sin(k) * 0.04, k, 1, 0.8, 1));
        const hit = new THREE.Mesh(new THREE.CircleGeometry(WIN.r + 0.1, 16), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(0, cy, wz + 0.02);
        hit.userData.kind = 'window';
        this.pickables.push(hit);
        this.scene.add(hit);

        // the shaft: from the glass down to a pool of colour on the floor
        const from = new THREE.Vector3(0, cy, wz), to = new THREE.Vector3(0, F + 0.01, -0.45);
        const len = from.distanceTo(to);
        const geo = new THREE.CylinderGeometry(WIN.r * 0.95, WIN.r * 1.35, len, 32, 1, true).translate(0, -len / 2, 0);
        this.shaftUniforms = { uColor: { value: sg.tint.clone() }, uOpacity: { value: 0 }, uTime: { value: 0 } };
        const shaft = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.shaftUniforms, vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        shaft.position.copy(from);
        shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
        shaft.renderOrder = 3;
        this.shaft = shaft;
        this.scene.add(shaft);
        this.poolMat = new THREE.MeshBasicMaterial({ map: sg.texture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(WIN.r * 2.5, WIN.r * 3.3), this.poolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, F + 0.022, -0.45);
        pool.renderOrder = 2;
        this.scene.add(pool);
        // dust drifting in the light
        const n = 90, r = rng('loft-dust');
        const pos = new Float32Array(n * 3);
        this.dust = [];
        for (let i = 0; i < n; i++) {
            const t = r(), off = new THREE.Vector3((r() - 0.5) * 1.6, (r() - 0.5) * 1.2, (r() - 0.5) * 1.2);
            this.dust.push({ t, off, s: 0.02 + r() * 0.05, ph: r() * TAU });
        }
        this.dustFrom = from;
        this.dustTo = to;
        const dg = new THREE.BufferGeometry();
        dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.dustMat = new THREE.PointsMaterial({ map: glowSprite(), size: 0.03, color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        this.dustPts = new THREE.Points(dg, this.dustMat);
        this.dustPts.frustumCulled = false;
        this.scene.add(this.dustPts);
    }

    /** The bed under the eaves: a quilt that drapes, pillows, a knitted throw, and the cat. */
    _bed(b) {
        const { F } = this.d, B = BED;
        const x0 = B.x - B.w / 2, x1 = B.x + B.w / 2, zh = B.z - B.l / 2, zf = B.z + B.l / 2;
        // frame, legs, headboard and footboard
        this._box(b, 'darkWood', B.w, 0.18, B.l, B.x, F + 0.22, B.z);
        for (const x of [x0 + 0.05, x1 - 0.05]) for (const z of [zh + 0.05, zf - 0.05]) this._box(b, 'darkWood', 0.09, 0.2, 0.09, x, F + 0.1, z);
        this._box(b, 'darkWood', B.w + 0.08, 0.8, 0.07, B.x, F + 0.5, zh - 0.02);
        for (const x of [x0 - 0.02, x1 + 0.02]) {
            this._box(b, 'darkWood', 0.09, 0.95, 0.09, x, F + 0.47, zh - 0.02);
            this._box(b, 'darkWood', 0.09, 0.62, 0.09, x, F + 0.31, zf + 0.02);
        }
        for (let k = 1; k < 6; k++) this._box(b, 'wood', 0.05, 0.42, 0.02, x0 + (k / 6) * B.w, F + 0.58, zh + 0.02);
        this._box(b, 'darkWood', B.w + 0.08, 0.06, 0.1, B.x, F + 0.92, zh - 0.02);
        this._box(b, 'darkWood', B.w + 0.08, 0.42, 0.06, B.x, F + 0.36, zf + 0.02);
        // mattress
        this._box(b, 'linen', B.w - 0.08, 0.2, B.l - 0.06, B.x, F + 0.41, B.z);
        // pillows
        const pg = new THREE.SphereGeometry(0.5, 16, 10);
        b.add('pillow', pg, xf(B.x - 0.33, F + 0.58, zh + 0.25, 0.08, 0.6, 0.18, 0.34));
        b.add('pillowRose', pg, xf(B.x + 0.34, F + 0.58, zh + 0.26, -0.1, 0.58, 0.18, 0.32));
        b.add('pillow', pg, xf(B.x + 0.05, F + 0.63, zh + 0.42, 0.02, 0.42, 0.14, 0.24, -0.4, 0));
        // the quilt: a soft sheet over the bed that hangs down over the sides and the foot
        const qw = B.w + 0.02, ql = B.l * 0.72, hang = 0.3;
        const geo = new THREE.PlaneGeometry(qw + hang * 2, ql + hang, 28, 24);
        geo.rotateX(-Math.PI / 2);
        const p = geo.attributes.position, r = rng('loft-quilt-lumps');
        const lumps = Array.from({ length: 6 }, () => ({ x: (r() - 0.5) * qw * 0.8, z: (r() - 0.3) * ql * 0.7, a: 0.02 + r() * 0.03, s: 0.15 + r() * 0.2 }));
        for (let i = 0; i < p.count; i++) {
            let x = p.getX(i), z = p.getZ(i) - hang / 2;   // z from -ql/2 (head end) to ql/2 + hang
            let y = 0;
            const ax = Math.abs(x) - qw / 2;
            if (ax > 0) {
                // over the side: down the edge of the mattress
                y = -Math.min(ax, hang);
                x = Math.sign(x) * (qw / 2 + 0.02 + Math.max(0, ax - hang) * 0.2);
            }
            const fz = z - ql / 2;
            if (fz > 0) {
                y = Math.min(y, -fz);
                z = ql / 2 + 0.02;
            }
            if (ax <= 0 && fz <= 0) for (const l of lumps) y += l.a * Math.exp(-((x - l.x) ** 2 + (z - l.z) ** 2) / (l.s * l.s));
            // a folded-back edge at the head end
            if (z < -ql / 2 + 0.12 && ax <= 0) y += 0.025;
            p.setXYZ(i, x, y, z);
        }
        geo.computeVertexNormals();
        const quilt = new THREE.Mesh(geo, this.mats.quilt);
        quilt.position.set(B.x, F + 0.53, B.z + (B.l - ql) / 2 - 0.02);
        this.scene.add(quilt);
        this.quilt = quilt;
        // the knitted throw folded across the foot
        this._box(b, 'knit', B.w + 0.04, 0.07, 0.38, B.x, F + 0.6, zf - 0.32);
        this._box(b, 'knit', B.w + 0.04, 0.22, 0.03, B.x, F + 0.5, zf - 0.13);
        this.collide1(B.x, B.z, B.w + 0.1, B.l + 0.1);
        // the nightstand: a candle in a jar, a mug and two books
        const nx = x1 + 0.33, nz = zh + 0.3;
        this._box(b, 'darkWood', 0.42, 0.5, 0.38, nx, F + 0.25, nz);
        this._box(b, 'wood', 0.46, 0.04, 0.42, nx, F + 0.52, nz);
        this._box(b, 'wood', 0.34, 0.14, 0.02, nx, F + 0.36, nz + 0.19);
        b.add('brass', new THREE.SphereGeometry(0.018, 8, 6), xf(nx, F + 0.36, nz + 0.205));
        this._box(b, 'ribbon', 0.2, 0.04, 0.15, nx + 0.06, F + 0.56, nz - 0.06, 0.2);
        this._box(b, 'sage', 0.18, 0.035, 0.14, nx + 0.06, F + 0.597, nz - 0.06, -0.15);
        b.add('mug', new THREE.CylinderGeometry(0.04, 0.036, 0.09, 14), xf(nx - 0.12, F + 0.585, nz + 0.07));
        b.add('cocoa', new THREE.CylinderGeometry(0.035, 0.035, 0.01, 14), xf(nx - 0.12, F + 0.625, nz + 0.07));
        b.add('glass', new THREE.CylinderGeometry(0.05, 0.05, 0.12, 14, 1, true), xf(nx - 0.05, F + 0.6, nz - 0.1));
        b.add('wax', new THREE.CylinderGeometry(0.03, 0.03, 0.07, 10), xf(nx - 0.05, F + 0.575, nz - 0.1));
        this.candlePos = new THREE.Vector3(nx - 0.05, F + 0.63, nz - 0.1);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6).scale(1, 2, 1), this.mats.flame);
        flame.position.copy(this.candlePos);
        this.candle = flame;
        const cglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
        cglow.scale.set(0.3, 0.3, 1);
        cglow.position.copy(this.candlePos);
        this.candleGlow = cglow;
        this.scene.add(flame, cglow);
        this.collide1(nx, nz, 0.45, 0.42);
        // the cat, curled up on the quilt
        const cat = new THREE.Group();
        cat.position.set(B.x + 0.28, F + 0.6, B.z + 0.25);
        cat.rotation.y = 0.5;
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), this.mats.fur);
        body.scale.set(1.25, 0.62, 1);
        body.position.y = 0.06;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), this.mats.fur);
        head.position.set(0.13, 0.07, 0.1);
        head.scale.set(1, 0.85, 1);
        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this.mats.furLight);
        chest.position.set(0.12, 0.03, 0.14);
        const ears = [-1, 1].map((s) => {
            const e = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.06, 4), this.mats.fur);
            e.position.set(0.13 + s * 0.035, 0.135, 0.09);
            e.rotation.z = -s * 0.25;
            return e;
        });
        const tail = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 20, Math.PI * 1.1), this.mats.fur);
        tail.rotation.x = Math.PI / 2;
        tail.rotation.z = 1.2;
        tail.position.y = 0.025;
        // stripes
        for (let k = -2; k <= 2; k++) {
            const s = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 12, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0xa85a22, roughness: 1 }));
            s.scale.set(1.25, 0.62, 1);
            s.position.y = 0.06;
            s.rotation.set(0, k * 0.35, Math.PI / 4);
            cat.add(s);
        }
        cat.add(body, head, chest, ...ears, tail);
        this.cat = { g: cat, body, head, ears, tail };
        this.scene.add(cat);
        const catHit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
        catHit.position.copy(cat.position);
        catHit.userData.kind = 'cat';
        this.pickables.push(catHit);
        this.scene.add(catHit);
        // the bed is the thing to click to sleep
        const bedHit = new THREE.Mesh(new THREE.BoxGeometry(B.w + 0.1, 0.9, B.l + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
        bedHit.position.set(B.x, F + 0.45, B.z);
        bedHit.userData.kind = 'bed';
        this.pickables.push(bedHit);
        this.scene.add(bedHit);
        // lying down: head on the pillow, looking up at the lights and the window
        this.bedEye = new THREE.Vector3(B.x + 0.05, F + 0.82, zh + 0.45);
        this.bedLook = new THREE.Vector3(B.x + 1.6, F + 2.9, B.z + 0.4);
        this.bedStand = { x: x1 + 0.55, z: B.z + 0.55, yaw: Math.atan2(x1 + 0.55, 2.6 + B.z + 0.55) };
    }

    /** The desk: an old computer, its keyboard, a green lamp, the flute, a mug and some floppies. */
    _desk(b) {
        const { F } = this.d, K = DESK;
        const top = F + K.h;
        this._box(b, 'darkWood', K.w, 0.06, K.d, K.x, top - 0.03, K.z);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this._box(b, 'darkWood', 0.07, K.h - 0.06, 0.07, K.x + sx * (K.w / 2 - 0.06), F + (K.h - 0.06) / 2, K.z + sz * (K.d / 2 - 0.06));
        // a bank of drawers on the right
        this._box(b, 'darkWood', 0.42, K.h - 0.12, K.d - 0.06, K.x + K.w / 2 - 0.25, F + (K.h - 0.06) / 2 + 0.03, K.z);
        for (let k = 0; k < 3; k++) {
            this._box(b, 'wood', 0.38, 0.17, 0.02, K.x + K.w / 2 - 0.25, F + 0.14 + k * 0.2, K.z + K.d / 2 - 0.02);
            b.add('brass', new THREE.SphereGeometry(0.016, 8, 6), xf(K.x + K.w / 2 - 0.25, F + 0.14 + k * 0.2, K.z + K.d / 2 - 0.005));
        }
        this.collide1(K.x, K.z, K.w, K.d);
        // the computer: a flat box with two floppy drives, and the monitor on top of it
        const cx = K.x + 0.12, cz = K.z - 0.06;
        const caseFront = new THREE.MeshStandardMaterial({ map: caseTexture(), roughness: 0.7 });
        const pc = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.42), [this.mats.beige, this.mats.beige, this.mats.beige, this.mats.beigeDark, caseFront, this.mats.beige]);
        pc.position.set(cx, top + 0.075, cz);
        this.scene.add(pc);
        const my = top + 0.15;
        this._box(b, 'beige', 0.44, 0.37, 0.3, cx, my + 0.19, cz + 0.03);
        this._box(b, 'beigeDark', 0.32, 0.27, 0.16, cx, my + 0.19, cz - 0.19);
        this._box(b, 'beigeDark', 0.2, 0.025, 0.2, cx, my + 0.01, cz + 0.02);
        this._box(b, 'bezel', 0.37, 0.29, 0.02, cx, my + 0.205, cz + 0.18);
        // the screen: a texture the survey is drawn into
        const sc = document.createElement('canvas');
        sc.width = 360;
        sc.height = 174;
        this.screenCanvas = sc;
        this.screenCtx = sc.getContext('2d', { willReadFrequently: true });
        this.screenCtx.fillStyle = '#000';
        this.screenCtx.fillRect(0, 0, 360, 174);
        this.screenTex = new THREE.CanvasTexture(sc);
        this.screenTex.colorSpace = THREE.SRGBColorSpace;
        this.screenTex.minFilter = THREE.LinearFilter;
        this.screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex, color: 0xffffff });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), this.screenMat);
        screen.position.set(cx, my + 0.205, cz + 0.192);
        this.scene.add(screen);
        const sglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: 0xffa020, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.18 }));
        sglow.scale.set(0.8, 0.6, 1);
        sglow.position.set(cx, my + 0.2, cz + 0.24);
        this.screenGlow = sglow;
        this.scene.add(sglow);
        this.screenPos = new THREE.Vector3(cx, my + 0.205, cz + 0.2);
        // keyboard and a stack of floppies
        const kb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.16), [this.mats.beige, this.mats.beige, new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.7 }), this.mats.beige, this.mats.beige, this.mats.beige]);
        kb.position.set(cx, top + 0.018, K.z + 0.24);
        kb.rotation.x = 0.06;
        this.scene.add(kb);
        for (let k = 0; k < 3; k++) {
            this._box(b, 'floppy', 0.13, 0.004, 0.13, K.x + 0.62, top + 0.003 + k * 0.005, K.z + 0.12, 0.1 + k * 0.25);
            this._box(b, 'label', 0.1, 0.002, 0.035, K.x + 0.62 + Math.sin(0.1 + k * 0.25) * 0.03, top + 0.0055 + k * 0.005, K.z + 0.12 + Math.cos(0.1 + k * 0.25) * 0.03 - 0.03, 0.1 + k * 0.25);
        }
        // a mug of tea
        b.add('mug', new THREE.CylinderGeometry(0.042, 0.038, 0.095, 14), xf(K.x + 0.6, top + 0.048, K.z - 0.15));
        b.add('cocoa', new THREE.CylinderGeometry(0.037, 0.037, 0.01, 14), xf(K.x + 0.6, top + 0.09, K.z - 0.15));
        b.add('mug', new THREE.TorusGeometry(0.025, 0.007, 6, 12), xf(K.x + 0.645, top + 0.05, K.z - 0.15, 0, 1, 1, 1, 0, 0));
        // the green banker's lamp on the left
        const lx = K.x - 0.6, lz = K.z - 0.12;
        b.add('brass', new THREE.CylinderGeometry(0.08, 0.09, 0.025, 18), xf(lx, top + 0.012, lz));
        b.add('brass', new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), xf(lx, top + 0.16, lz));
        const shade = new THREE.CylinderGeometry(0.075, 0.075, 0.26, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
        b.add('shade', shade, xf(lx, top + 0.32, lz + 0.04, 0, 1, 1, 1, 0.3, 0));
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), this.mats.lamp);
        bulb.position.set(lx, top + 0.29, lz + 0.05);
        this.scene.add(bulb);
        this.lampPos = new THREE.Vector3(lx, top + 0.27, lz + 0.08);
        // the flute: a wooden tube with eight holes and a red ribbon, lying in front of the lamp
        const flute = new THREE.Group();
        flute.position.set(K.x - 0.42, top + 0.018, K.z + 0.2);
        flute.rotation.y = 0.32;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.5, 14).rotateZ(Math.PI / 2), this.mats.flute);
        flute.add(tube);
        for (const xx of [-0.25, 0.25]) {
            const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.02, 14).rotateZ(Math.PI / 2), this.mats.darkWood);
            ring.position.x = xx * 0.98;
            flute.add(ring);
        }
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x1a0e06 });
        const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10).scale(1.6, 1, 1), holeMat);
        mouth.rotation.x = -Math.PI / 2;
        mouth.position.set(-0.19, 0.0165, 0);
        flute.add(mouth);
        for (let k = 0; k < 8; k++) {
            const h = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 10), holeMat);
            h.rotation.x = -Math.PI / 2;
            h.position.set(-0.08 + k * 0.038, 0.0168, 0);
            flute.add(h);
        }
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 14), this.mats.ribbon);
        bow.position.set(-0.13, 0.01, 0.0);
        bow.rotation.y = Math.PI / 2;
        flute.add(bow);
        const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, 0.08), this.mats.ribbon);
        tailR.position.set(-0.13, -0.012, 0.05);
        tailR.rotation.y = 0.4;
        flute.add(tailR);
        this.scene.add(flute);
        this.flute = flute;
        this.fluteBase = flute.position.clone();
        const fglint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0 }));
        fglint.scale.set(0.55, 0.25, 1);
        fglint.position.copy(flute.position).add(new THREE.Vector3(0, 0.03, 0));
        this.fluteGlint = fglint;
        this.scene.add(fglint);
        const fhit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.16), new THREE.MeshBasicMaterial({ visible: false }));
        fhit.position.copy(flute.position);
        fhit.rotation.y = 0.32;
        fhit.userData.kind = 'flute';
        this.pickables.push(fhit);
        this.scene.add(fhit);
        // the computer is clickable all over
        const chit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
        chit.position.set(cx, top + 0.3, cz + 0.1);
        chit.userData.kind = 'computer';
        this.pickables.push(chit);
        this.scene.add(chit);
        // the chair, pulled out a little
        const chx = K.x + 0.1, chz = K.z + 0.75;
        this._box(b, 'wood', 0.44, 0.05, 0.42, chx, F + 0.46, chz, 0.12);
        this._box(b, 'sage', 0.38, 0.05, 0.36, chx, F + 0.51, chz, 0.12);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this._box(b, 'darkWood', 0.04, 0.45, 0.04, chx + sx * 0.18 + sz * 0.02, F + 0.225, chz + sz * 0.17 - sx * 0.02);
        for (const sx of [-1, 1]) this._box(b, 'darkWood', 0.04, 0.5, 0.04, chx + sx * 0.19 + 0.02, F + 0.72, chz + 0.19 - sx * 0.02);
        this._box(b, 'darkWood', 0.42, 0.12, 0.03, chx + 0.025, F + 0.92, chz + 0.2, 0.12);
        this.collide1(chx, chz, 0.42, 0.42);
        this.deskStand = { x: cx, z: K.z + 1.05, yaw: 0 };
    }

    /** Rugs, cushions, a bookcase under the eaves, a basket of blankets and a fern. */
    _cozy(b) {
        const { F, R_X, R_Z } = this.d;
        b.add('braid', new THREE.CylinderGeometry(1.15, 1.15, 0.014, 48), xf(-0.35, F + 0.007, -0.15, 0, 1, 1, 0.82));
        // floor cushions by the rug
        const cg = new THREE.SphereGeometry(0.5, 16, 10);
        b.add('mustard', cg, xf(-1.05, F + 0.09, 0.75, 0.3, 0.62, 0.2, 0.62));
        b.add('sage', cg, xf(-0.2, F + 0.08, 1.2, -0.2, 0.56, 0.18, 0.56));
        b.add('pillowRose', cg, xf(-0.95, F + 0.24, 0.72, 0.5, 0.36, 0.12, 0.32, 0.3, 0));
        // a low bookcase under the left eave, toward the front
        const bx = -R_X + 0.22, bz0 = 0.15, bz1 = 1.55;
        this._box(b, 'darkWood', 0.34, 0.9, 0.04, bx, F + 0.45, bz0);
        this._box(b, 'darkWood', 0.34, 0.9, 0.04, bx, F + 0.45, bz1);
        for (const y of [0.03, 0.45, 0.9]) this._box(b, 'darkWood', 0.34, 0.035, bz1 - bz0, bx, F + y, (bz0 + bz1) / 2);
        const r = rng('loft-books');
        const pal = ['mugRed', 'sage', 'mustard', 'mug', 'pillowRose', 'darkWood'];
        this.mats.mugRed ??= new THREE.MeshStandardMaterial({ color: 0x8a3030, roughness: 0.8 });
        for (const y of [0.05, 0.47]) {
            let z = bz0 + 0.04;
            while (z < bz1 - 0.08) {
                const w = 0.04 + r() * 0.05, h = 0.24 + r() * 0.12;
                this._box(b, pal[Math.floor(r() * pal.length)], 0.22, h, w, bx + 0.02, F + y + h / 2, z + w / 2);
                z += w + 0.006;
                if (r() < 0.1) z += 0.12;
            }
        }
        // a lantern on top
        b.add('iron', new THREE.CylinderGeometry(0.06, 0.07, 0.02, 10), xf(bx + 0.02, F + 0.93, 1.25));
        b.add('glass', new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10, 1, true), xf(bx + 0.02, F + 1.0, 1.25));
        b.add('iron', new THREE.ConeGeometry(0.07, 0.07, 10), xf(bx + 0.02, F + 1.1, 1.25));
        this.lanternPos = new THREE.Vector3(bx + 0.02, F + 1.0, 1.25);
        this.collide1(bx, (bz0 + bz1) / 2, 0.4, bz1 - bz0);
        // a basket of rolled blankets
        b.add('basket', new THREE.CylinderGeometry(0.28, 0.23, 0.36, 18, 1, true), xf(-2.55, F + 0.18, 2.25));
        b.add('basket', new THREE.CylinderGeometry(0.23, 0.23, 0.02, 18), xf(-2.55, F + 0.01, 2.25));
        for (const [dx, dz, m, rot] of [[-0.08, -0.05, 'knit', 0.4], [0.1, 0.06, 'pillowRose', -0.3], [-0.02, 0.12, 'sage', 1.2]]) {
            b.add(m, new THREE.CylinderGeometry(0.09, 0.09, 0.42, 14), xf(-2.55 + dx, F + 0.4, 2.25 + dz, rot, 1, 1, 1, 0.25, 0));
        }
        this.collide1(-2.55, 2.25, 0.6, 0.6);
        // a fern in the front corner by the stair rail
        b.add('terracotta', new THREE.CylinderGeometry(0.2, 0.15, 0.32, 14), xf(1.75, F + 0.16, 2.55));
        const leaf = new THREE.SphereGeometry(0.16, 8, 6).scale(0.35, 1.5, 0.18);
        for (let k = 0; k < 11; k++) {
            const a = (k / 11) * TAU;
            b.add('hedge', leaf, xf(1.75 + Math.cos(a) * 0.12, F + 0.55, 2.55 + Math.sin(a) * 0.12, -a, 1, 1, 1, 0.75, 0));
        }
        this.collide1(1.75, 2.55, 0.45, 0.45);
        // a little wall clock and a pinned-up map on the front gable
        b.add('darkWood', new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20), xf(0.6, F + 1.65, R_Z - 0.08, 0, 1, 1, 1, Math.PI / 2, 0));
        b.add('paper', new THREE.CylinderGeometry(0.135, 0.135, 0.045, 20), xf(0.6, F + 1.65, R_Z - 0.085, 0, 1, 1, 1, Math.PI / 2, 0));
        this._box(b, 'iron', 0.01, 0.1, 0.005, 0.6, F + 1.69, R_Z - 0.115);
        this._box(b, 'iron', 0.07, 0.01, 0.005, 0.63, F + 1.65, R_Z - 0.115);
    }

    _lights() {
        const { F } = this.d;
        // daylight through the window, tinted by its glass
        this.winLight = new THREE.PointLight(0xffe0b0, 0, 7, 1.4);
        this.winLight.position.set(0, F + 1.7, -2.0);
        // the green lamp on the desk
        this.deskLight = new THREE.PointLight(0xffc27a, 2.2, 3.4, 1.6);
        this.deskLight.position.copy(this.lampPos);
        // the twinkle lights' warmth, and the candle and lantern by the bed
        this.twinkleLight = new THREE.PointLight(0xffc890, 0, 6.5, 1.3);
        this.twinkleLight.position.set(-0.4, F + 2.4, -0.3);
        this.candleLight = new THREE.PointLight(0xffa850, 1.2, 2.6, 1.8);
        this.candleLight.position.copy(this.candlePos).add(new THREE.Vector3(0, 0.08, 0.1));
        this.scene.add(this.winLight, this.deskLight, this.twinkleLight, this.candleLight);
    }

    /** Strings of little bulbs from the ridge to the eaves, and a long swag along each side. */
    _twinkles() {
        const { F, R_Z } = this.d;
        const ridge = F + RIDGE - 0.3;
        const strands = [];
        for (const z of [-2.35, -1.2, 0, 1.2, 2.35]) {
            for (const sx of [-1, 1]) {
                const a = new THREE.Vector3(0, ridge, z), b2 = new THREE.Vector3(sx * 2.55, this.roofY(2.55) - 0.12, z + sx * 0.45);
                strands.push(strand(a, b2, 0.32, 0.15));
            }
        }
        // swags along each side, scalloping between the rafters
        for (const sx of [-1, 1]) {
            const x = sx * 1.95, y = this.roofY(1.95) - 0.1;
            const pts = [];
            for (let z = -R_Z + 0.35; z < R_Z - 0.6; z += 0.92) {
                const seg = strand(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, Math.min(z + 0.92, R_Z - 0.35)), 0.22, 0.15);
                pts.push(...(pts.length ? seg.slice(1) : seg));
            }
            strands.push(pts);
        }
        const r = rng('loft-twinkle');
        const warm = [0xffd59a, 0xffcf8a, 0xffe2b0];
        const pastel = [0xff9ec4, 0x9fe8d0, 0xa8c8ff, 0xffc36a, 0xd2b0ff];
        const bulbs = [];
        const wire = [];
        strands.forEach((pts, si) => {
            pts.forEach((p, i) => {
                if (i > 0) wire.push(pts[i - 1], p);
                if (i === 0) return;
                const hex = r() < 0.72 ? warm[Math.floor(r() * warm.length)] : pastel[Math.floor(r() * pastel.length)];
                bulbs.push({ p: p.clone().add(new THREE.Vector3(0, -0.025, 0)), c: new THREE.Color(hex), th: 0.18 + r() * 0.3, sp: 0.6 + r() * 2.2, ph: r() * TAU, si, k: i / pts.length });
            });
        });
        this.bulbs = bulbs;
        const wg = new THREE.BufferGeometry().setFromPoints(wire);
        this.scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x33402a })));
        const n = bulbs.length;
        const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 6).scale(1, 1.3, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
        const m = new THREE.Matrix4();
        bulbs.forEach((bb, i) => {
            m.makeTranslation(bb.p.x, bb.p.y, bb.p.z);
            im.setMatrixAt(i, m);
            im.setColorAt(i, new THREE.Color(0x3a3228));
        });
        im.frustumCulled = false;
        this.bulbMesh = im;
        this.scene.add(im);
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        bulbs.forEach((bb, i) => bb.p.toArray(pos, i * 3));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.glowPts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowSprite(), size: 0.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.glowPts.frustumCulled = false;
        this.scene.add(this.glowPts);
        this.lightsOn = 0;
        this._tmpC = new THREE.Color();
    }

    /** The fireflies the Firefly Reel calls in. */
    _fireflies() {
        const n = 36, r = rng('loft-flies');
        this.flies = Array.from({ length: n }, () => ({ c: new THREE.Vector3((r() - 0.5) * 4.6, this.d.F + 0.6 + r() * 2.2, (r() - 0.5) * 4.6), a: r() * TAU, b: r() * TAU, s: 0.3 + r() * 0.6, rad: 0.2 + r() * 0.6, ph: r() * TAU }));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        this.flyMat = new THREE.PointsMaterial({ map: glowSprite(), size: 0.16, color: 0xd8ff7a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        this.flyPts = new THREE.Points(g, this.flyMat);
        this.flyPts.frustumCulled = false;
        this.flyPts.visible = false;
        this.scene.add(this.flyPts);
    }

    // ------------------------------------------------------------ the things you click

    setHover(kind) {
        this.hover = kind;
    }

    /** A loft thing was clicked. Returns true if it took the click. */
    activate(kind) {
        const env = this.env;
        if (this.busy) return true;
        if (kind === 'computer') {
            this._terminal().show();
            this._takeControls();
            return true;
        }
        if (kind === 'flute') {
            this._flute().show();
            this._takeControls();
            return true;
        }
        if (kind === 'bed') {
            this.startSleep();
            return true;
        }
        if (kind === 'cat') {
            this.purrUntil = this.time + 4;
            this._purr(3.5);
            env.ui?.hint('The cat opens one eye, purrs, and goes back to sleep.', 4000);
            return true;
        }
        if (kind === 'window') {
            env.ui?.hint(`The window today: ${this.glass.name} · it finds a new picture every time you come up`, 6000);
            return true;
        }
        return false;
    }

    _takeControls() {
        const c = this.env.controls;
        this.busy = true;
        if (!c) return;
        c.enabled = false;
        c.route = null;
        c.keys.clear();
        c.vel.set(0, 0);
    }

    _giveControls() {
        this.busy = false;
        const c = this.env.controls;
        if (c) c.enabled = true;
    }

    _terminal() {
        if (!this.terminal) {
            this.survey ??= this._survey();
            this.terminal = new HerculesTerminal({
                survey: this.survey,
                onClose: () => this._giveControls(),
                beep: (k) => this._beep(k),
            });
        }
        return this.terminal;
    }

    _survey() {
        const env = this.env;
        return new IslandSurvey({ heightAt: env.island ? (x, z) => env.island.heightAt(x, z) : () => 0, landmarks: env.landmarks ?? [], islandR: env.islandR ?? 150, home: env.home });
    }

    synth() {
        this._synth ??= new FluteSynth(this.env.audio);
        return this._synth;
    }

    _flute() {
        this.fluteUI ??= new FluteUI({ synth: this.synth(), audio: this.env.audio, onSong: (s) => this.songEffect(s), onClose: () => this._giveControls() });
        return this.fluteUI;
    }

    /** A song of the loft's, played by hand: something happens. */
    songEffect(song) {
        const env = this.env;
        if (song.id === 'lanterns') this.danceUntil = this.time + 24;
        else if (song.id === 'window') {
            const name = this.glass.next();
            this._refreshTint();
            env.ui?.hint(`The window shimmers… ${name}`, 5000);
        } else if (song.id === 'fireflies') this.flyUntil = this.time + 40;
        else if (song.id === 'lullaby') {
            this.purrUntil = this.time + 9;
            this._purr(8);
        } else if (song.id === 'hours' && env.sky) {
            const s = env.sky, night = s.time < 0.25 || s.time > 0.75;
            s.setTime(night ? 0.29 : 0.84);
        }
    }

    /** The window has a new picture: the light it lets in changes colour too. */
    _refreshTint() {
        this.shaftUniforms.uColor.value.copy(this.glass.tint);
    }

    /** Called when you come up the stair. */
    arrive() {
        this._refreshTint();
    }

    _audioCtx() {
        const a = this.env.audio;
        if (a && !a.ctx) a.start?.();
        return a?.ctx ? { ctx: a.ctx, out: a.sfx } : null;
    }

    _beep(kind) {
        const c = this._audioCtx();
        if (!c) return;
        const { ctx, out } = c, t = ctx.currentTime;
        if (kind === 'on') {
            // the tube warming up: a thump and a high whine
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(15700, t);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.012, t + 0.3);
            g.gain.setTargetAtTime(0.004, t + 0.5, 0.5);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 2.5);
            const th = ctx.createOscillator();
            th.type = 'sine';
            th.frequency.setValueAtTime(70, t);
            th.frequency.exponentialRampToValueAtTime(30, t + 0.25);
            const tg = ctx.createGain();
            tg.gain.setValueAtTime(0.25, t);
            tg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            th.connect(tg).connect(out);
            th.start(t);
            th.stop(t + 0.35);
            // and the PC speaker's beep
            const bp = ctx.createOscillator();
            bp.type = 'square';
            bp.frequency.value = 880;
            const bg = ctx.createGain();
            bg.gain.setValueAtTime(0, t + 0.6);
            bg.gain.setValueAtTime(0.03, t + 0.61);
            bg.gain.setValueAtTime(0, t + 0.78);
            bp.connect(bg).connect(out);
            bp.start(t + 0.6);
            bp.stop(t + 0.8);
        } else if (kind === 'off') {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(400, t);
            o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 0.25);
        } else {
            const o = ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = 1200;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.02, t);
            g.gain.setValueAtTime(0, t + 0.03);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 0.05);
        }
    }

    /** A purr: a low rumble that swells with each breath. */
    _purr(sec) {
        const c = this._audioCtx();
        if (!c) return;
        const { ctx, out } = c, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 26;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380;
        const g = ctx.createGain();
        g.gain.value = 0;
        for (let k = 0; k < sec / 1.6; k++) {
            const t0 = t + k * 1.6;
            g.gain.setTargetAtTime(0.09, t0, 0.15);
            g.gain.setTargetAtTime(0.03, t0 + 0.8, 0.2);
        }
        g.gain.setTargetAtTime(0, t + sec, 0.3);
        o.connect(lp).connect(g).connect(out);
        o.start(t);
        o.stop(t + sec + 1.5);
    }

    // ------------------------------------------------------------ sleeping

    startSleep() {
        const env = this.env, sky = env.sky;
        if (this.sleep || !sky) return;
        const time = sky.time;
        const night = time > 0.7 || time < 0.21;
        this._takeControls();
        let el = document.getElementById('loft-sleep');
        if (!el) {
            el = document.createElement('div');
            el.id = 'loft-sleep';
            el.className = 'loft-sleep';
            el.innerHTML = '<p class="ls-z" aria-hidden="true"><span>z</span><span>z</span><span>Z</span></p><p class="ls-text" aria-live="polite"></p>';
            document.body.appendChild(el);
        }
        this.sleepEl = el;
        el.querySelector('.ls-text').textContent = night ? 'You snuggle under the quilt and drift off…' : 'You curl up for a little nap…';
        const cam = env.camera;
        this.sleep = {
            t: 0, night, done: false,
            fromP: cam.position.clone(), fromQ: cam.quaternion.clone(),
            toQ: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.bedEye, this.bedLook, new THREE.Vector3(0, 1, 0))),
            target: night ? 0.292 : 0.812,    // 7:00, or 19:30
        };
        this.synth().playSong(SONGS.find((s) => s.id === 'lullaby'), 0.45);
        env.ui?.tooltip?.(null);
    }

    _sleepUpdate(dt) {
        const S = this.sleep, cam = this.env.camera, el = this.sleepEl;
        S.t += dt;
        const LIE = 1.4, FADE = 3.4, DARK = 5.6, WAKE = 7.6, UP = 9.0;
        const t = S.t;
        if (t < LIE + 0.4) {
            const k = smoothstep(0, LIE, t);
            cam.position.copy(S.fromP).lerp(this.bedEye, k);
            cam.quaternion.copy(S.fromQ).slerp(S.toQ, k);
        }
        // the dark comes down, the hours pass, and the light comes back
        let o = 0;
        if (t > LIE) o = smoothstep(LIE, FADE, t);
        if (t > DARK) o = 1 - smoothstep(DARK, WAKE, t);
        el.style.opacity = String(o);
        el.classList.toggle('show', t > LIE && t < WAKE);
        if (t > (FADE + DARK) / 2 && !S.passed) {
            S.passed = true;
            this.env.sky.setTime(S.target);
            el.querySelector('.ls-text').textContent = S.night ? 'Morning! Sunlight pours through the window.' : 'You wake as the stars come out.';
        }
        if (t > WAKE) {
            const k = smoothstep(WAKE, UP, t), st = this.bedStand;
            const eye = new THREE.Vector3(st.x, this.d.F + 1.65, st.z);
            cam.position.copy(this.bedEye).lerp(eye, k);
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, st.yaw, 0, 'YXZ'));
            cam.quaternion.copy(S.toQ).slerp(q, k);
        }
        if (t >= UP) {
            const st = this.bedStand, c = this.env.controls;
            this.sleep = null;
            el.classList.remove('show');
            el.style.opacity = '0';
            if (c) {
                c.teleport(st.x, st.z, st.yaw);
                c.pitch = -0.05;
            }
            this._giveControls();
            this.env.ui?.hint(S.night ? 'Good morning! · the twinkle lights have gone out for the day' : 'Good evening · the twinkle lights are coming on', 6000);
        }
    }

    // ------------------------------------------------------------ every frame

    /**
     * @param {number} dt
     * @param {number} t
     * @param {object} o { night, day, up (0 downstairs .. 1 in the loft) }
     */
    update(dt, t, { night = 0, day = 1, up = 0 } = {}) {
        this.time = t;
        if (this.sleep) this._sleepUpdate(dt);
        const vis = up > 0.05;   // anything of the loft worth animating in view
        // the window: bright by day, a faint moonlit glow at night
        const glow = 0.22 + day * 1.25;
        this.winMat.color.setScalar(glow);
        const sun = smoothstep(0.15, 0.7, day);
        this.shaftUniforms.uOpacity.value = sun * 0.16;
        this.shaftUniforms.uTime.value = t;
        this.poolMat.opacity = sun * 0.38;
        this.winLight.color.copy(this.glass.tint);
        this.winLight.intensity = (0.6 + sun * 7) * (0.25 + 0.75 * up);
        this.dustMat.opacity = sun * 0.8;
        if (vis && sun > 0.02) {
            const pos = this.dustPts.geometry.attributes.position;
            const dir = this.dustTo.clone().sub(this.dustFrom);
            for (let i = 0; i < this.dust.length; i++) {
                const d = this.dust[i];
                d.t = (d.t + dt * d.s * 0.08) % 1;
                const p = this.dustFrom.clone().addScaledVector(dir, 0.1 + d.t * 0.85);
                const spread = 0.4 + d.t * 0.5;
                pos.setXYZ(i, p.x + d.off.x * spread + Math.sin(t * 0.3 + d.ph) * 0.05, p.y + d.off.y * 0.5 + Math.sin(t * 0.21 + d.ph) * 0.04, p.z + d.off.z * spread * 0.6);
            }
            pos.needsUpdate = true;
        }
        // the twinkle lights come on, one by one, as it gets dark (or dance when the waltz is played)
        const dance = t < this.danceUntil ? smoothstep(0, 1.5, this.danceUntil - t) : 0;
        const im = this.bulbMesh, col = this.glowPts.geometry.attributes.color, c = this._tmpC;
        let lit = 0;
        for (let i = 0; i < this.bulbs.length; i++) {
            const bb = this.bulbs[i];
            const on = Math.max(smoothstep(bb.th, bb.th + 0.12, night), dance);
            const tw = 0.62 + 0.38 * Math.sin(t * bb.sp + bb.ph) * Math.sin(t * bb.sp * 0.37 + bb.ph * 2.1);
            let br = on * tw;
            c.copy(bb.c);
            if (dance > 0) {
                const hue = (bb.k + bb.si * 0.13 - t * 0.35) % 1;
                this._tmpC2 ??= new THREE.Color();
                this._tmpC2.setHSL((hue + 1) % 1, 0.85, 0.62);
                c.lerp(this._tmpC2, dance);
                br = Math.max(br, dance * (0.55 + 0.45 * Math.sin(t * 6 - bb.k * 12 - bb.si)));
            }
            lit += br;
            col.setXYZ(i, c.r * br * 0.9, c.g * br * 0.9, c.b * br * 0.9);
            im.setColorAt(i, c.multiplyScalar(0.1 + br * 1.8).addScalar(br < 0.05 ? 0.03 : 0));
        }
        im.instanceColor.needsUpdate = true;
        col.needsUpdate = true;
        this.lightsOn = lit / this.bulbs.length;
        this.twinkleLight.intensity = this.lightsOn * 4.2 * (0.3 + 0.7 * up);
        // the lamp, the candle and the lantern by the bookcase
        const fl = 0.85 + 0.15 * Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1);
        this.candleLight.intensity = (0.4 + night * 1.3) * fl * (0.3 + 0.7 * up);
        this.candle.scale.y = 0.9 + 0.2 * fl;
        this.candleGlow.material.opacity = 0.3 + 0.3 * fl;
        this.deskLight.intensity = (1.0 + night * 1.6) * (0.3 + 0.7 * up);
        // the computer's screen: the survey turning slowly, redrawn a few times a second
        this._screenT = (this._screenT ?? 0) - dt;
        const hov = this.hover;
        this.screenMat.color.setScalar(hov === 'computer' ? 1.6 : 1.15);
        this.screenGlow.material.opacity = 0.14 + (hov === 'computer' ? 0.12 : 0) + Math.sin(t * 9) * 0.01;
        if (vis && this._screenT <= 0 && !this.terminal?.open) {
            this._screenT = 0.14;
            this.survey ??= this._survey();
            const sx = this.screenCtx;
            this.survey.draw(sx, 360, 174, { yaw: t * 0.18, pitch: 0.6, zoom: 1, tx: 0, tz: 0, mode: '3d', labels: false, blink: Math.floor(t * 2.4) % 2 === 0, step: 2 });
            sx.fillStyle = 'rgb(255,176,0)';
            sx.fillRect(0, 0, 360, 9);
            const img = sx.getImageData(0, 0, 360, 174), d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const on = d[i] > 70;
                d[i] = on ? 255 : 8;
                d[i + 1] = on ? 176 : 4;
                d[i + 2] = on ? 0 : 0;
            }
            sx.putImageData(img, 0, 0);
            this.screenTex.needsUpdate = true;
        }
        // the flute lifts and glints when you point at it
        this._fh = damp(this._fh ?? 0, hov === 'flute' ? 1 : 0, 8, dt);
        this.flute.position.y = this.fluteBase.y + this._fh * 0.03;
        this.flute.rotation.z = this._fh * 0.05;
        this.fluteGlint.material.opacity = 0.12 + 0.08 * Math.sin(t * 2.1) + this._fh * 0.35;
        // the cat breathes, flicks an ear, and purrs when asked
        const cat = this.cat, purr = t < this.purrUntil ? 1 : 0;
        const br = 1 + Math.sin(t * (purr ? 2.6 : 1.4)) * (purr ? 0.045 : 0.03);
        cat.body.scale.set(1.25 * br, 0.62 * br, 1 * br);
        const flick = Math.max(0, Math.sin(t * 0.7) - 0.97) * 30 + (hov === 'cat' ? 0.3 : 0);
        cat.ears[1].rotation.z = 0.25 + flick * 0.3;
        cat.tail.rotation.z = 1.2 + Math.sin(t * 0.5) * 0.06 + purr * Math.sin(t * 3) * 0.08;
        // fireflies
        const fly = t < this.flyUntil ? smoothstep(0, 3, this.flyUntil - t) * smoothstep(this.flyUntil - 40, this.flyUntil - 37, t) : 0;
        this.flyPts.visible = fly > 0.01;
        if (this.flyPts.visible) {
            this.flyMat.opacity = fly;
            const pos = this.flyPts.geometry.attributes.position;
            this.flies.forEach((f, i) => {
                const a = f.a + t * f.s, b2 = f.b + t * f.s * 0.7;
                const blink = 0.5 + 0.5 * Math.sin(t * 3 + f.ph);
                pos.setXYZ(i, f.c.x + Math.cos(a) * f.rad, f.c.y + Math.sin(b2) * 0.25 + (blink < 0.15 ? -100 : 0), f.c.z + Math.sin(a) * f.rad);
            });
            pos.needsUpdate = true;
        }
    }
}
