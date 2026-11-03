// The level as scenery: tiles as a shallow diorama (front faces, tops receding to a back wall),
// glowing acid, the back wall with windows onto space (the ship) or layered alien skylines (the
// homeworld). Every texture is painted in code from the sector's palette. Built once per level.

import * as THREE from 'three';
import { hash3 } from '../rng.js';

export const DEPTH = 2.2;                 // how far back the floor runs to the back wall

export const PALETTES = {
    cryo: { base: '#4b5871', edge: '#9cb2d6', dark: '#222838', wall: '#1a2030', wall2: '#262f45', accent: '#5fd0ff', lamp: 0xbfe2ff, sky: ['#02030a', '#0a1430'], neb: '#2a5aa8', amb: 0x4a5a80, ground: 0x10121c, metal: 0.35 },
    hydro: { base: '#46584a', edge: '#9cc492', dark: '#1c271e', wall: '#16231a', wall2: '#203226', accent: '#9dff6a', lamp: 0xd8ffc0, sky: ['#020604', '#0c2418'], neb: '#2f8a4a', amb: 0x3f6a4a, ground: 0x0c1410, metal: 0.3 },
    reactor: { base: '#5b4637', edge: '#d39a62', dark: '#271a12', wall: '#22150e', wall2: '#332016', accent: '#ff8a3a', lamp: 0xffb070, sky: ['#060202', '#2a0c06'], neb: '#a8401a', amb: 0x6a4030, ground: 0x140a06, metal: 0.4 },
    spine: { base: '#3b425c', edge: '#a3aed8', dark: '#181c2c', wall: '#131828', wall2: '#1e243a', accent: '#ff3b5a', lamp: 0xffd0dc, sky: ['#030208', '#1a0a24'], neb: '#7a2a8a', amb: 0x4a4070, ground: 0x0c0a14, metal: 0.4 },
    ash: { base: '#4a3e52', edge: '#9a88a8', dark: '#211a2a', wall: '#1c1424', wall2: '#2a2034', accent: '#7affe0', lamp: 0xa8fff0, sky: ['#120a24', '#7a3a62'], neb: '#d0607a', amb: 0x6a4a7a, ground: 0x140a18, metal: 0, planet: '#f2a07a', ridge: ['#3a2244', '#241430'] },
    bone: { base: '#857560', edge: '#eadfc2', dark: '#3a3026', wall: '#2a2018', wall2: '#3a2e22', accent: '#ffb060', lamp: 0xffc890, sky: ['#1e120c', '#c0623a'], neb: '#ff9a4a', amb: 0x8a6a50, ground: 0x1a120a, metal: 0, planet: '#ffe0a0', ridge: ['#5a3424', '#3a2218'] },
    spires: { base: '#2a4a52', edge: '#78d6cc', dark: '#10242a', wall: '#0c1c22', wall2: '#14303a', accent: '#5affd8', lamp: 0x8affe4, sky: ['#030c14', '#1a5a5e'], neb: '#3ad0b0', amb: 0x3a6a70, ground: 0x081418, metal: 0.1, planet: '#b0fff0', ridge: ['#123a44', '#0a2830'] },
    larder: { base: '#5a2a3a', edge: '#c86a82', dark: '#2a0e18', wall: '#220a14', wall2: '#33121e', accent: '#ff5ab0', lamp: 0xff9ac8, sky: ['#0e0408', '#5a1426'], neb: '#ff3a7a', amb: 0x7a3a52, ground: 0x14060a, metal: 0.05, planet: '#ff8aa0', ridge: ['#3a1020', '#260a14'] },
};

// ---------------------------------------------------------------- tile painting
const T = 16;
const SLOTS = { top: 0, innerA: 1, innerB: 2, plat: 3, wallA: 4, wallB: 5, window: 6, wallPipe: 7, topFace: 8, under: 9, side: 10, wallC: 11 };

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

function paintTiles(pal, theme) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const ec = document.createElement('canvas'); ec.width = ec.height = 64;
    const eg = ec.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, 64, 64);
    const base = hex(pal.base), edge = hex(pal.edge), dark = hex(pal.dark), acc = hex(pal.accent);
    // the walls are painted fairly light: the lights, not the paint, make the dark
    const wall = mix(hex(pal.wall), base, 0.6), wall2 = mix(hex(pal.wall2), edge, 0.3);
    const slot = (i) => [(i % 4) * T, Math.floor(i / 4) * T];
    const px = (i, x, y, c) => { const [ox, oy] = slot(i); g.fillStyle = css(c); g.fillRect(ox + x, oy + y, 1, 1); };
    const glow = (i, x, y, c) => { const [ox, oy] = slot(i); eg.fillStyle = css(c); eg.fillRect(ox + x, oy + y, 1, 1); px(i, x, y, c); };
    const n = (i, x, y) => hash3(i * 31 + x, y, 7);
    const ship = theme === 'ship';

    // solid fill with texture
    const fillSolid = (i, top) => {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
            let c = mix(base, dark, 0.15 + n(i, x >> 1, y >> 1) * 0.2);
            if (ship) {
                if (x === 0 || y === 0) c = mix(base, edge, 0.35);
                if (x === T - 1 || y === T - 1) c = mix(base, dark, 0.6);
                if ((x === 3 || x === 12) && (y === 3 || y === 12)) c = mix(edge, base, 0.3);
                if (i === SLOTS.innerB && y > 5 && y < 10 && x > 2 && x < 13) c = mix(dark, base, (x + y) % 2 ? 0.2 : 0.5);
            } else {
                const k = n(i, x >> 2, y >> 2) * 0.7 + n(i + 3, x >> 1, y >> 1) * 0.3;
                c = mix(base, k > 0.55 ? edge : dark, Math.abs(k - 0.5) * 0.7);
                if ((x + (y >> 2) * 5) % 16 === 0 || y % 8 === 7) c = mix(c, dark, 0.35);
            }
            if (top && y < 3) c = mix(edge, base, y * 0.3 + n(i, x, 0) * 0.2);
            if (top && y === 3) c = mix(base, dark, 0.5);
            px(i, x, y, c);
        }
        if (top && ship) glow(i, 8, 1, mix(acc, base, 0.3));
        if (top && !ship) for (let x = 0; x < T; x++) if (n(i, x, 3) > 0.8) glow(i, x, 0, mix(acc, edge, 0.5));
    };
    fillSolid(SLOTS.top, true);
    fillSolid(SLOTS.innerA, false);
    fillSolid(SLOTS.innerB, false);
    // platform: a grate
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        let c = mix(edge, base, 0.4 + n(3, x, y) * 0.2);
        if (y > 3) c = (x + y) % 4 < 2 ? mix(base, dark, 0.3) : mix(dark, base, 0.2);
        if (y === 3 || y === T - 1) c = dark;
        px(SLOTS.plat, x, y, c);
    }
    for (let x = 1; x < T; x += 5) glow(SLOTS.plat, x, 1, acc);
    // back walls
    const wallTex = (i, kind) => {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
            let c = mix(wall, wall2, n(i, x >> 2, y >> 2) * 0.6);
            if (ship) {
                if (x === 0 || y === 0) c = mix(wall2, edge, 0.12);
                if (x === T - 1 || y === T - 1) c = mix(wall, dark, 0.5);
                if (kind === 'pipe' && x > 5 && x < 10) c = mix(wall2, edge, 0.15 + (x - 6) * 0.08);
                if (kind === 'c' && y > 4 && y < 11 && x > 3 && x < 12) c = (y % 2) ? mix(wall, dark, 0.6) : wall2;
            } else {
                const k = n(i, x >> 2, y >> 2) * 0.7 + n(i, x >> 1, y >> 1) * 0.3;
                c = mix(wall, wall2, k);
            }
            px(i, x, y, c);
        }
        if (ship && kind === 'b') { glow(i, 7, 7, mix(acc, wall, 0.4)); }
    };
    wallTex(SLOTS.wallA, 'a'); wallTex(SLOTS.wallB, 'b'); wallTex(SLOTS.wallPipe, 'pipe'); wallTex(SLOTS.wallC, 'c');
    // window: frame with a hole onto space
    wallTex(SLOTS.window, 'a');
    { const [ox, oy] = slot(SLOTS.window); g.clearRect(ox + 3, oy + 3, 10, 10); }
    // top face (seen receding), underside and side
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        px(SLOTS.topFace, x, y, mix(mix(edge, base, 0.45), dark, n(8, x, y) * 0.25 + (ship && y % 4 === 0 ? 0.25 : 0)));
        px(SLOTS.under, x, y, mix(dark, base, n(9, x, y) * 0.3));
        px(SLOTS.side, x, y, mix(base, dark, 0.35 + n(10, x, y) * 0.25));
    }
    return { cv, ec };
}

/** Normal map from brightness (bright = raised). */
function normalsFrom(cv, strength = 2.2) {
    const w = cv.width, h = cv.height;
    const d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const L = (x, y) => { x = (x + w) % w; y = (y + h) % h; const i = (y * w + x) * 4; return (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255; };
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const og = out.getContext('2d'); const im = og.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (L(x + 1, y) - L(x - 1, y)) * strength, dy = (L(x, y + 1) - L(x, y - 1)) * strength;
        let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz);
        const i = (y * w + x) * 4;
        im.data[i] = (nx / l * 0.5 + 0.5) * 255; im.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; im.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
    }
    og.putImageData(im, 0, 0);
    return out;
}

function canvasTex(cv, srgb = true, nearest = true) {
    const t = new THREE.CanvasTexture(cv);
    if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// ---------------------------------------------------------------- geometry
class Quads {
    constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; }
    /** a quad from four corners (counter-clockwise seen from the front) with a tile slot */
    add(a, b, c, d, nrm, s, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
        const base = this.p.length / 3;
        this.p.push(...a, ...b, ...c, ...d);
        for (let i = 0; i < 4; i++) this.n.push(...nrm);
        const sx = (s % 4) * 0.25, sy = 1 - (Math.floor(s / 4) + 1) * 0.25;
        const e = 0.5 / 64;
        const U = (u) => sx + e + u * (0.25 - 2 * e), V = (v) => sy + e + v * (0.25 - 2 * e);
        this.uv.push(U(u0), V(v0), U(u1), V(v0), U(u1), V(v1), U(u0), V(v1));
        this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setIndex(this.idx);
        g.computeBoundingSphere();
        return g;
    }
}

// ---------------------------------------------------------------- acid
const AcidShader = {
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.3, 0.85, 0.1) } },
    vertexShader: /* glsl */`
        varying vec3 vP; varying vec3 vN;
        void main() { vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uColor;
        varying vec3 vP; varying vec3 vN;
        float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main() {
            vec2 q = vP.xz * vec2(2.0, 3.0) + vec2(uTime * 0.4, uTime * 0.2);
            if (vN.z > 0.5) q = vec2(vP.x * 2.0 + uTime * 0.3, vP.y * 5.0 - uTime * 0.6);
            float n = noise(q) * 0.6 + noise(q * 2.3 + 4.0) * 0.4;
            float top = vN.y > 0.5 ? 1.0 : smoothstep(0.0, 0.8, fract(vP.y) + 0.2);
            vec3 c = uColor * (0.35 + n * 0.9) * (0.5 + top * 0.6);
            c += vec3(0.6, 1.0, 0.4) * pow(clamp(n, 0.0, 1.0), 6.0) * 0.9;
            gl_FragColor = vec4(c, 1.0);
        }`,
};

// ---------------------------------------------------------------- backgrounds
function starfield(pal, w = 1024, h = 512, seed = 1) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, pal.sky[0]); gr.addColorStop(1, pal.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
        const x = hash3(seed, i, 1) * w, y = hash3(seed, i, 2) * h, r = 80 + hash3(seed, i, 3) * 180;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, pal.neb + '55'); rg.addColorStop(1, pal.neb + '00');
        g.fillStyle = rg; g.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 900; i++) {
        const x = hash3(seed, i, 11) * w, y = hash3(seed, i, 12) * h, b = hash3(seed, i, 13);
        g.fillStyle = `rgba(255,255,255,${0.25 + b * 0.75})`;
        g.fillRect(x | 0, y | 0, b > 0.97 ? 2 : 1, b > 0.97 ? 2 : 1);
    }
    return cv;
}

function ridge(cols, w, h, seed, rough, spires) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
        const t = x / w * Math.PI * 2;
        let y = h * 0.55 + Math.sin(t * 2 + seed) * h * 0.12 + Math.sin(t * 5 + seed * 2) * h * 0.06 * rough + (hash3(seed, x >> 3, 1) - 0.5) * h * 0.03 * rough;
        if (spires && hash3(seed, x >> 5, 2) > 0.8) y -= h * 0.35 * hash3(seed, x >> 5, 3);
        g.lineTo(x, y);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
    return cv;
}

export class World {
    constructor(scene, quality) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.acidMat = new THREE.ShaderMaterial({ ...AcidShader, uniforms: THREE.UniformsUtils.clone(AcidShader.uniforms), toneMapped: false });
        this.quality = quality;
        this.L = null;
    }

    clear() {
        for (const o of [...this.group.children]) {
            this.group.remove(o);
            o.geometry?.dispose();
            if (o.material && o.material !== this.acidMat) {
                for (const k of ['map', 'normalMap', 'emissiveMap']) o.material[k]?.dispose?.();
                o.material.dispose();
            }
        }
    }

    build(L) {
        this.clear();
        this.L = L;
        const pal = this.pal = PALETTES[L.pal];
        const ship = L.theme === 'ship';
        const { cv, ec } = paintTiles(pal, L.theme);
        const mat = new THREE.MeshStandardMaterial({
            map: canvasTex(cv), normalMap: canvasTex(normalsFrom(cv), false), emissiveMap: canvasTex(ec),
            emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.78, metalness: pal.metal, alphaTest: 0.5,
        });
        mat.normalScale.set(1.2, 1.2);
        const solid = (c, r) => (c < 0 || c >= L.w) ? true : r < 0 ? true : r >= L.h ? false : L.tiles[r * L.w + c] === 1;
        const kind = (c, r) => (c < 0 || c >= L.w || r < 0 || r >= L.h) ? 0 : L.tiles[r * L.w + c];
        const q = new Quads();
        const D = -DEPTH;
        for (let r = 0; r < L.h; r++) for (let c = 0; c < L.w; c++) {
            const t = kind(c, r);
            if (t === 1) {
                const top = !solid(c, r + 1);
                const s = top ? SLOTS.top : hash3(c, r, 3) > 0.7 ? SLOTS.innerB : SLOTS.innerA;
                q.add([c, r, 0], [c + 1, r, 0], [c + 1, r + 1, 0], [c, r + 1, 0], [0, 0, 1], s);
                if (top) q.add([c, r + 1, 0], [c + 1, r + 1, 0], [c + 1, r + 1, D], [c, r + 1, D], [0, 1, 0], SLOTS.topFace);
                if (!solid(c, r - 1)) q.add([c, r, D], [c + 1, r, D], [c + 1, r, 0], [c, r, 0], [0, -1, 0], SLOTS.under);
                if (!solid(c - 1, r)) q.add([c, r, D], [c, r, 0], [c, r + 1, 0], [c, r + 1, D], [-1, 0, 0], SLOTS.side);
                if (!solid(c + 1, r)) q.add([c + 1, r, 0], [c + 1, r, D], [c + 1, r + 1, D], [c + 1, r + 1, 0], [1, 0, 0], SLOTS.side);
            } else if (t === 2) {
                const y0 = r + 0.72, y1 = r + 1;
                q.add([c, y0, 0], [c + 1, y0, 0], [c + 1, y1, 0], [c, y1, 0], [0, 0, 1], SLOTS.plat, 0, 0.72, 1, 1);
                q.add([c, y1, 0], [c + 1, y1, 0], [c + 1, y1, D], [c, y1, D], [0, 1, 0], SLOTS.plat, 0, 0.4, 1, 0.7);
                q.add([c, y0, D], [c + 1, y0, D], [c + 1, y0, 0], [c, y0, 0], [0, -1, 0], SLOTS.under);
            }
        }
        // the back wall (ship): every cell, with windows high up
        if (ship) {
            for (let r = 0; r < 14; r++) for (let c = -12; c < L.w + 12; c++) {
                const h = hash3(c, r, 9);
                const win = r >= 6 && r <= 11 && (Math.floor(c / 3) % 4 === 1) && r % 3 !== 2;
                const s = win ? SLOTS.window : h > 0.96 ? SLOTS.wallB : h > 0.8 ? SLOTS.wallPipe : h > 0.68 ? SLOTS.wallC : SLOTS.wallA;
                q.add([c, r, D], [c + 1, r, D], [c + 1, r + 1, D], [c, r + 1, D], [0, 0, 1], s);
            }
        } else {
            // the homeworld: a low wall of rock at the back of the floor, broken in places
            for (let c = 0; c < L.w; c++) {
                const hgt = 1 + Math.floor(hash3(c >> 2, 5, 9) * 4);
                for (let r = 0; r < hgt + 2; r++) q.add([c, r, D], [c + 1, r, D], [c + 1, r + 1, D], [c, r + 1, D], [0, 0, 1], r === hgt + 1 ? SLOTS.wallB : SLOTS.wallA);
            }
        }
        const mesh = new THREE.Mesh(q.geometry(), mat);
        this.group.add(mesh);
        this.tileMat = mat;

        // acid runs
        const aq = [];
        this.acidSpots = [];
        for (let r = 0; r < L.h; r++) {
            let c = 0;
            while (c < L.w) {
                if (kind(c, r) !== 3) { c++; continue; }
                const c0 = c;
                while (c < L.w && kind(c, r) === 3) c++;
                aq.push([c0, c, r]);
                for (let x = c0 + 1; x < c; x += 3) this.acidSpots.push({ x: x + 0.5, y: r + 1.2 });
            }
        }
        if (aq.length) {
            const g = new Quads();
            for (const [a, b, r] of aq) {
                const y = r + 0.78;
                g.add([a, r, 0.02], [b, r, 0.02], [b, y, 0.02], [a, y, 0.02], [0, 0, 1], 0);
                g.add([a, y, 0.02], [b, y, 0.02], [b, y, D], [a, y, D], [0, 1, 0], 0);
            }
            this.group.add(new THREE.Mesh(g.geometry(), this.acidMat));
        }

        // far away: space (the ship's windows) or the homeworld's sky and ridges
        const W = L.w + 600;
        const layer = (cvs, z, h, y, opts = {}) => {
            const t = canvasTex(cvs, true, false);
            t.wrapS = THREE.RepeatWrapping;
            t.repeat.set(W / (opts.tile || 120), 1);
            const m = new THREE.Mesh(new THREE.PlaneGeometry(W, h), new THREE.MeshBasicMaterial({ map: t, transparent: !!opts.alpha, depthWrite: !opts.alpha, fog: false }));
            m.position.set(L.w / 2, y, z);
            if (opts.color) m.material.color.set(opts.color);
            this.group.add(m);
            return m;
        };
        if (ship) {
            layer(starfield(pal, 1024, 512, L.idx + 1), -70, 120, 8, { tile: 200 });
        } else {
            layer(starfield(pal, 512, 512, L.idx + 7), -110, 260, 30, { tile: 400 });
            // a planet hanging over the horizon
            const pc = document.createElement('canvas'); pc.width = pc.height = 256;
            const pg = pc.getContext('2d');
            const rg = pg.createRadialGradient(100, 100, 10, 128, 128, 120);
            rg.addColorStop(0, pal.planet); rg.addColorStop(0.75, pal.neb); rg.addColorStop(1, 'rgba(0,0,0,0)');
            pg.fillStyle = rg; pg.beginPath(); pg.arc(128, 128, 120, 0, Math.PI * 2); pg.fill();
            this.planet = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({ map: canvasTex(pc, true, false), transparent: true, depthWrite: false, fog: false }));
            this.planet.material.color.setScalar(1.4);
            this.planet.position.set(0, 40, -100);
            this.group.add(this.planet);
            layer(ridge(pal.ridge, 1024, 256, L.idx * 3 + 1, 1, false), -45, 50, 4, { alpha: true, tile: 160 });
            layer(ridge([pal.wall2, pal.wall], 1024, 256, L.idx * 3 + 2, 1.6, true), -16, 26, 6, { alpha: true, tile: 90 });
        }
        return this;
    }

    frame(time, camX) {
        this.acidMat.uniforms.uTime.value = time;
        if (this.planet) this.planet.position.x = camX * 0.82 + 18;
    }
}
