// The lattice in three.js (adapted from NEON ARCANA's board, game-111): an oak plate with brass
// grid lines, the tiles (one instanced mesh for the board, the hand and the tile being dragged, each
// showing its element's painted icon), deposit cover slabs and the ore beneath, the crucible's golden
// rings, foes and their portrait tokens, the ghost of a placement and the lines it would clear.
// Everything lives in the board group's space: cell (cx, cy) has its centre at (cx − 4, 4 − cy, 0).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { N } from '../config.js';
import { sizeOf } from '../sim/data/shapes.js';
import { ELEMENTS, ELEMENT_IDS } from '../sim/data/elements.js';
import { FOES } from '../sim/data/foes.js';
import { elOf, nearHarvest } from '../sim/level.js';

export const EL_COLOR = {};
for (const id of ELEMENT_IDS) EL_COLOR[id] = new THREE.Color().setHex(ELEMENTS[id].color);
export const GOLD = new THREE.Color(1, 0.72, 0.3);
const AMBER = new THREE.Color(1, 0.55, 0.2);
export const cellX = (cx) => cx - (N - 1) / 2;
export const cellY = (cy) => (N - 1) / 2 - cy;
const H = (N - 1) / 2;

const BLOCK_VS = /* glsl */`
    attribute vec4 aState;
    varying vec3 vN, vP, vCol, vV;
    varying vec4 vS;
    void main() {
        vP = position;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vCol = instanceColor;
        vS = aState;
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
const BLOCK_FS = /* glsl */`
    uniform sampler2D uAtlas;
    uniform float uTime, uOpacity, uDim;
    varying vec3 vN, vP, vCol, vV;
    varying vec4 vS;      // x glow, y white flash, z kind (0 tile, 1 foe, 2 cover slab), w atlas cell / foe hurt / cover left
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float ndv = clamp(dot(n, v), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        vec3 L = normalize(vec3(-0.45, 0.6, 1.0));
        float diff = clamp(dot(n, L), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(-L, n), v), 0.0, 1.0), 28.0);
        float top = smoothstep(0.1, 0.19, vP.z);
        vec2 q = abs(vP.xy) / 0.46;
        float m = max(q.x, q.y);
        vec3 col;
        if (vS.z < 0.5) {
            // a glazed tile: the element's painted icon set in a brass-rimmed well
            vec2 uv = vP.xy / 0.74 + 0.5;
            vec2 cell = vec2(mod(vS.w, 4.0), 1.0 - floor(vS.w / 4.0));
            vec3 icon = texture2D(uAtlas, (clamp(uv, 0.0, 1.0) + cell) * vec2(0.25, 0.5)).rgb;
            float well = 1.0 - smoothstep(0.76, 0.8, m);
            float rim = smoothstep(0.78, 0.82, m) * (1.0 - smoothstep(0.9, 0.96, m));
            vec3 glaze = vCol * (0.2 + 0.32 * diff);
            vec3 face = mix(glaze, icon * 0.82, well);
            face = mix(face, vec3(0.85, 0.6, 0.28) * (0.45 + 0.5 * diff), rim);
            col = mix(vCol * (0.14 + 0.26 * diff), face, top);
            col += vec3(1.0, 0.9, 0.7) * spec * 0.22 + vCol * fres * 0.18;
        } else if (vS.z < 1.5) {
            // a foe's flesh: dark, veined with its colour, pulsing; brighter where it was hurt
            float nz = noise(vP.xy * 6.0 + vec2(uTime * 0.3, uTime * 0.17));
            float vein = smoothstep(0.06, 0.0, abs(nz - 0.5));
            float pulse = 0.6 + 0.4 * sin(uTime * 3.0 + vP.x * 4.0);
            col = vec3(0.05, 0.03, 0.03) * (0.6 + diff) + vCol * vein * (0.6 + 0.6 * pulse) + vCol * fres * 0.5;
            col += vCol * smoothstep(0.8, 0.95, m) * top * 0.6;
            col += vec3(1.0, 0.3, 0.2) * vS.w * 0.8;
        } else {
            // a cover slab of old stone over a deposit; cracks glow as it wears through
            top = smoothstep(0.06, 0.095, vP.z);          // the slab is thinner than a tile
            float nz = noise(vP.xy * 9.0 + 7.0) * 0.6 + noise(vP.xy * 23.0) * 0.4;
            float crack = smoothstep(0.035, 0.0, abs(noise(vP.xy * 3.5 + 3.0) - 0.5)) * top;
            float r = length(vP.xy);
            float rune = (1.0 - smoothstep(0.0, 0.025, abs(r - 0.24))) * top;
            float bevel = smoothstep(0.82, 0.98, m) * top;
            col = vec3(0.045, 0.036, 0.03) * (0.4 + 0.9 * diff) * (0.6 + 0.8 * nz);
            col += vec3(0.3, 0.22, 0.15) * bevel * 0.3;
            col += vCol * (crack * (1.3 - 0.3 * vS.w) + rune * 0.9) * (0.75 + 0.25 * sin(uTime * 2.0));
        }
        col *= (1.0 + vS.x) * uDim;
        col += vec3(1.0, 0.92, 0.75) * vS.y * 1.2;
        gl_FragColor = vec4(col, uOpacity);
    }`;

const PLATE_FS = /* glsl */`
    uniform sampler2D uWood;
    uniform float uTime, uPulse, uHasWood;
    uniform vec3 uTint;
    varying vec2 vUv;
    void main() {
        float S = ${(N + 0.6).toFixed(2)};
        vec2 p = vUv * S - 0.3;                       // cell coords; the plate overhangs 0.3
        vec2 f = fract(p);
        vec2 g = min(f, 1.0 - f);
        float inside = step(0.0, p.x) * step(0.0, p.y) * step(p.x, ${N.toFixed(1)}) * step(p.y, ${N.toFixed(1)});
        float line = (1.0 - smoothstep(0.0, 0.03, min(g.x, g.y))) * inside;
        vec3 wood = mix(vec3(0.16, 0.1, 0.06), texture2D(uWood, vUv).rgb, uHasWood) * 0.62;
        float well = smoothstep(0.05, 0.25, min(g.x, g.y)) * inside;
        vec3 col = wood * (0.75 + 0.25 * well);
        col += vec3(0.85, 0.6, 0.28) * line * (0.45 + uPulse * 0.9);
        col += uTint * line * uPulse * 0.6;
        vec2 e = min(vUv, 1.0 - vUv);
        float rim = 1.0 - smoothstep(0.0, 0.02, min(e.x, e.y));
        col = mix(col, vec3(0.75, 0.52, 0.25), rim * 0.85);
        gl_FragColor = vec4(col, 1.0);
    }`;

const GLOW_FS = /* glsl */`
    uniform vec3 uColor;
    uniform float uAlpha, uTime;
    varying vec2 vUv;
    void main() {
        vec2 c = abs(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.55, 1.0, c.y)) * (1.0 - smoothstep(0.92, 1.0, c.x));
        float shimmer = 0.7 + 0.3 * sin(vUv.x * 26.0 - uTime * 7.0);
        gl_FragColor = vec4(uColor * a * shimmer * uAlpha, 1.0);
    }`;
const UV_VS = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** A foe's token: its portrait in a brass ring whose red arc is its health. */
const TOKEN_FS = /* glsl */`
    uniform sampler2D uMap;
    uniform float uHp, uHurt, uHas;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;
        vec3 img = mix(uColor * 0.4, texture2D(uMap, (vUv - 0.5) * 1.15 + 0.5).rgb, uHas);
        float a = atan(c.x, c.y) / 6.2831853 + 0.5;
        float ring = smoothstep(0.78, 0.8, r);
        vec3 rim = mix(vec3(0.25, 0.08, 0.05), vec3(1.0, 0.25, 0.15), step(a, uHp));
        rim = mix(rim, vec3(0.9, 0.68, 0.32), smoothstep(0.93, 0.96, r));
        vec3 col = mix(img, rim, ring) + vec3(1.0, 0.35, 0.25) * uHurt * (1.0 - ring);
        gl_FragColor = vec4(col, 1.0);
    }`;

function ringTexture() {
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.strokeStyle = '#fff';
    g.shadowColor = '#fff'; g.shadowBlur = 10;
    g.lineWidth = 7; g.beginPath(); g.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S * 0.31, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.arc(S / 2 + Math.cos(a) * S * 0.355, S / 2 + Math.sin(a) * S * 0.355, 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function slotTexture() {
    const W = 256, Hh = 256, r = 30;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Hh;
    const g = cv.getContext('2d');
    const rr = (x, y, w, h) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = 'rgba(40, 24, 12, 0.55)'; rr(10, 10, W - 20, Hh - 20); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 4; rr(10, 10, W - 20, Hh - 20); g.stroke();
    g.lineWidth = 1.5; rr(24, 24, W - 48, Hh - 48); g.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const MAX_BLOCKS = 160;

export class Board {
    constructor(group, art) {
        this.group = group;
        this.art = art;
        this.tmp = new THREE.Object3D();
        this.col = new THREE.Color();

        const slab = new THREE.Mesh(new THREE.BoxGeometry(N + 0.9, N + 0.9, 0.7), new THREE.MeshBasicMaterial({ color: 0x1a0f07 }));
        slab.position.z = -0.6;
        group.add(slab);
        this.plateU = { uWood: { value: null }, uHasWood: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 }, uTint: { value: new THREE.Color(1, 0.6, 0.3) } };
        this.plate = new THREE.Mesh(new THREE.PlaneGeometry(N + 0.6, N + 0.6), new THREE.ShaderMaterial({ uniforms: this.plateU, vertexShader: UV_VS, fragmentShader: PLATE_FS }));
        this.plate.position.z = -0.24;
        group.add(this.plate);
        this.pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ visible: false }));
        this.pickPlane.position.z = 0.21;
        group.add(this.pickPlane);

        // the element atlas: 4 × 2 painted icons
        this.atlasCv = document.createElement('canvas');
        this.atlasCv.width = 1024; this.atlasCv.height = 512;
        this.atlas = new THREE.CanvasTexture(this.atlasCv);
        this.atlas.colorSpace = THREE.SRGBColorSpace;
        this.paintAtlas();

        this.geo = new RoundedBoxGeometry(0.92, 0.92, 0.42, 3, 0.1);
        this.blockU = { uAtlas: { value: this.atlas }, uTime: { value: 0 }, uOpacity: { value: 1 }, uDim: { value: 1 } };
        this.blockMat = new THREE.ShaderMaterial({ uniforms: this.blockU, vertexShader: BLOCK_VS, fragmentShader: BLOCK_FS });
        this.blocks = this.instanced(this.geo, this.blockMat, MAX_BLOCKS);
        group.add(this.blocks);

        this.ghostU = { uAtlas: { value: this.atlas }, uTime: { value: 0 }, uOpacity: { value: 0.4 }, uDim: { value: 1 } };
        this.ghostMat = new THREE.ShaderMaterial({ uniforms: this.ghostU, vertexShader: BLOCK_VS, fragmentShader: BLOCK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        this.ghost = this.instanced(this.geo, this.ghostMat, 12);
        group.add(this.ghost);

        // cover slabs over deposits, and the ore beneath that shows through as they wear
        this.coverGeo = new RoundedBoxGeometry(0.96, 0.96, 0.2, 2, 0.05);
        this.covers = this.instanced(this.coverGeo, this.blockMat, N * N);
        group.add(this.covers);
        this.oreMat = new THREE.MeshBasicMaterial({ map: this.atlas, transparent: true, opacity: 0.9, depthWrite: false });
        const og = new THREE.PlaneGeometry(0.84, 0.84);
        this.oreMat.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
                .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (uv + aCell) * vec2(0.25, 0.5);');
        };
        this.oreCell = new THREE.InstancedBufferAttribute(new Float32Array(N * N * 2), 2);
        og.setAttribute('aCell', this.oreCell);
        this.ores = new THREE.InstancedMesh(og, this.oreMat, N * N);
        this.ores.count = 0;
        this.ores.frustumCulled = false;
        for (let i = 0; i < N * N; i++) this.ores.setColorAt(i, new THREE.Color(1, 1, 1));
        group.add(this.ores);

        // the crucible's rings
        this.ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), color: new THREE.Color(1.6, 1.1, 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.rings = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9), this.ringMat, 16);
        this.rings.count = 0;
        this.rings.frustumCulled = false;
        group.add(this.rings);

        // foe tokens
        this.tokens = [];
        for (let k = 0; k < 4; k++) {
            const u = { uMap: { value: null }, uHas: { value: 0 }, uHp: { value: 1 }, uHurt: { value: 0 }, uColor: { value: new THREE.Color(0.8, 0.3, 0.2) } };
            const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), new THREE.ShaderMaterial({ uniforms: u, vertexShader: UV_VS, fragmentShader: TOKEN_FS }));
            m.visible = false; m.renderOrder = 4;
            m.userData = { u, kind: null, hurt: 0 };
            group.add(m);
            this.tokens.push(m);
        }

        this.strips = [];
        for (let k = 0; k < 18; k++) {
            const u = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 } };
            const m = new THREE.Mesh(new THREE.PlaneGeometry(N + 0.5, 1.05), new THREE.ShaderMaterial({ uniforms: u, vertexShader: UV_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            m.position.z = 0.26;
            m.visible = false;
            m.userData.u = u;
            group.add(m);
            this.strips.push(m);
        }

        this.slotTex = slotTexture();
        this.slots = [];
        for (let k = 0; k < 3; k++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.slotTex, color: 0xc89040, transparent: true, depthWrite: false }));
            m.position.z = -0.3;
            group.add(m);
            this.slots.push(m);
        }
        this.slotRects = [];

        this.spawn = new Float32Array(N * N).fill(-10);
        this.flash = new Float32Array(N * N);
        this.dealT = [-10, -10, -10];
        this.handScale = 0.5;
    }

    /** Paint the element icons into the atlas (painted art once it has loaded, a glyph until then). */
    paintAtlas() {
        const g = this.atlasCv.getContext('2d');
        const S = 256;
        ELEMENT_IDS.forEach((id, k) => {
            const x = (k % 4) * S, y = Math.floor(k / 4) * S;
            const img = this.art?.img('el-' + id);
            const c = '#' + ELEMENTS[id].color.toString(16).padStart(6, '0');
            if (img) g.drawImage(img, x, y, S, S);
            else {
                g.fillStyle = '#2a1a0e'; g.fillRect(x, y, S, S);
                g.fillStyle = c; g.font = `bold ${S * 0.6}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
                g.fillText(ELEMENTS[id].glyph, x + S / 2, y + S / 2);
            }
        });
        this.atlas.needsUpdate = true;
    }

    setWood(tex) { this.plateU.uWood.value = tex; this.plateU.uHasWood.value = tex ? 1 : 0; }

    instanced(geo, mat, n) {
        const m = new THREE.InstancedMesh(geo.clone(), mat, n);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.userData.state = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
        m.userData.state.setUsage(THREE.DynamicDrawUsage);
        m.geometry.setAttribute('aState', m.userData.state);
        for (let i = 0; i < n; i++) m.setColorAt(i, EL_COLOR.salt);
        m.instanceColor.setUsage(THREE.DynamicDrawUsage);
        m.count = 0;
        m.frustumCulled = false;
        return m;
    }

    layout(slots, handScale) {
        this.slotRects = slots;
        this.handScale = handScale;
        slots.forEach((s, k) => {
            const m = this.slots[k];
            m.position.x = cellX(s.x - 0.5);
            m.position.y = cellY(s.y - 0.5);
            m.scale.set(s.w, s.h, 1);
        });
    }

    put(mesh, k, x, y, z, s, color, sx, sy, sz, sw, sh = 1) {
        const t = this.tmp;
        t.position.set(x, y, z);
        t.rotation.set(0, 0, 0);
        t.scale.set(s, s, s * sh);
        t.updateMatrix();
        mesh.setMatrixAt(k, t.matrix);
        mesh.setColorAt(k, color);
        mesh.userData.state.setXYZW(k, sx, sy, sz, sw);
    }

    /** ui: { drag, sel, hide, ghost: { cells, el, valid }, lines: { rows, cols, el }, fits, sight, vein, foeArt } */
    update(L, ui, dt, time) {
        this.blockU.uTime.value = time;
        this.ghostU.uTime.value = time;
        this.plateU.uTime.value = time;
        this.plateU.uPulse.value = Math.max(0, this.plateU.uPulse.value - dt * 1.5);
        const lineSet = new Set();
        if (ui.lines) {
            for (const r of ui.lines.rows) for (let c = 0; c < N; c++) lineSet.add(r * N + c);
            for (const c of ui.lines.cols) for (let r = 0; r < N; r++) lineSet.add(r * N + c);
        }
        let k = 0;
        const B = this.blocks;
        const foes = L.battle?.foes || [];
        for (let i = 0; i < N * N; i++) {
            this.flash[i] = Math.max(0, this.flash[i] - dt * 4);
            const v = L.cells[i], f = L.foeAt[i];
            if (!v && f < 0) continue;
            const cx = i % N, cy = Math.floor(i / N);
            const a = Math.min(1, Math.max(0, (time - this.spawn[i]) / 0.22));
            const ease = 1 + 2.2 * Math.pow(a - 1, 3) + 1.2 * Math.pow(a - 1, 2);
            const drop = (1 - a) * 1.4;
            const glow = lineSet.has(i) ? 0.35 + 0.25 * Math.sin(time * 12) : 0;
            if (v) {
                const el = elOf(v);
                this.put(B, k++, cellX(cx), cellY(cy), drop, 0.6 + 0.4 * ease, EL_COLOR[el], glow, this.flash[i], 0, ELEMENT_IDS.indexOf(el));
            } else {
                const foe = foes[f];
                const fc = this.foeColor(foe.kind);
                this.put(B, k++, cellX(cx), cellY(cy), drop, 0.6 + 0.4 * ease, fc, glow, this.flash[i], 1, this.tokens[f]?.userData.hurt || 0);
            }
        }
        // the hand
        L.hand.forEach((h, slot) => {
            const s = this.slotRects[slot];
            const m = this.slots[slot];
            const sel = ui.sel === slot && h;
            m.material.color.setRGB(sel ? 1.4 : h ? 0.85 : 0.35, sel ? 1.0 : h ? 0.6 : 0.25, sel ? 0.5 : h ? 0.3 : 0.15);
            if (!h || !s || ui.hide?.has(slot)) return;
            const { w, h: hh } = sizeOf(h.cells);
            const da = Math.min(1, Math.max(0, (time - this.dealT[slot]) / 0.35));
            const slide = (1 - da) * (1 - da) * 3;
            const sc = this.handScale * (sel ? 1.12 : 1) * (0.4 + 0.6 * da);
            const fits = ui.fits ? ui.fits[slot] : true;
            for (const [px, py] of h.cells) {
                const x = cellX(s.x - 0.5) + (px - (w - 1) / 2) * sc;
                const y = cellY(s.y - 0.5) - (py - (hh - 1) / 2) * sc - slide;
                this.put(B, k++, x, y, 0, sc * 0.98, EL_COLOR[h.el], sel ? 0.35 + 0.15 * Math.sin(time * 6) : fits ? 0 : -0.6, 0, 0, ELEMENT_IDS.indexOf(h.el));
            }
        });
        // the next hand (Surveyor), small and dim beneath the slots
        if (ui.next && this.slotRects.length) {
            ui.next.forEach((t, slot) => {
                const s = this.slotRects[slot];
                if (!t || !s) return;
                const { w, h: hh } = sizeOf(t.cells);
                const sc = this.handScale * 0.38;
                for (const [px, py] of t.cells) {
                    const x = cellX(s.x - 0.5) + s.w * 0.36 + (px - (w - 1) / 2) * sc;
                    const y = cellY(s.y - 0.5) - s.h * 0.36 - (py - (hh - 1) / 2) * sc;
                    this.put(B, k++, x, y, -0.1, sc * 0.95, EL_COLOR[t.el], -0.45, 0, 0, ELEMENT_IDS.indexOf(t.el));
                }
            });
        }
        if (ui.drag && L.hand[ui.drag.slot]) {
            const h = L.hand[ui.drag.slot];
            const { w, h: hh } = sizeOf(h.cells);
            const s = ui.drag.s;
            for (const [px, py] of h.cells) {
                const x = cellX(ui.drag.cx - 0.5) + (px - (w - 1) / 2) * s;
                const y = cellY(ui.drag.cy - 0.5) - (py - (hh - 1) / 2) * s;
                this.put(B, k++, x, y, 1.1, s * 0.98, EL_COLOR[h.el], 0.25, 0, 0, ELEMENT_IDS.indexOf(h.el));
            }
        }
        B.count = k;
        B.instanceMatrix.needsUpdate = true;
        B.instanceColor.needsUpdate = true;
        B.userData.state.needsUpdate = true;

        // deposits: slabs on empty covered cells, the ore when it can be seen
        let ck = 0, ok = 0;
        const C = this.covers;
        for (let d = 0; d < L.deposits.length; d++) {
            const dep = L.deposits[d];
            const col = EL_COLOR[dep.el];
            const near = ui.vein && nearHarvest(L, dep);
            const showOre = ui.sight || dep.harvested || near;
            for (const c of dep.cells) {
                const x = cellX(c % N), y = cellY(Math.floor(c / N));
                if (dep.cover > 0 && !L.cells[c] && L.foeAt[c] < 0) {
                    const pulse = near ? 0.4 + 0.3 * Math.sin(time * 5) : 0;
                    this.put(C, ck++, x, y, -0.2 + dep.cover * 0.05, 1, ui.sight ? col : AMBER, pulse, this.flash[c], 2, dep.cover, 0.5 + dep.cover * 0.5);
                }
                if (showOre && !L.cells[c] && ok < N * N) {
                    const t = this.tmp;
                    t.position.set(x, y, dep.cover > 0 ? 0.03 + dep.cover * 0.1 : -0.2);
                    t.rotation.set(0, 0, 0);
                    t.scale.setScalar(dep.cover > 0 ? 0.55 : 0.92);
                    t.updateMatrix();
                    this.ores.setMatrixAt(ok, t.matrix);
                    const e = ELEMENT_IDS.indexOf(dep.el);
                    this.oreCell.setXY(ok, e % 4, 1 - Math.floor(e / 4));
                    const b = dep.harvested ? 0.35 : dep.cover > 0 ? 0.45 + (near ? 0.4 * Math.sin(time * 5) : 0) : 1;
                    this.ores.setColorAt(ok, this.col.setRGB(b, b, b));
                    ok++;
                }
            }
        }
        C.count = ck;
        C.instanceMatrix.needsUpdate = true;
        C.instanceColor.needsUpdate = true;
        C.userData.state.needsUpdate = true;
        this.ores.count = ok;
        this.ores.instanceMatrix.needsUpdate = true;
        if (this.ores.instanceColor) this.ores.instanceColor.needsUpdate = true;
        this.oreCell.needsUpdate = true;

        // crucible rings
        let rk = 0;
        for (let i = 0; i < N * N && rk < 16; i++) {
            if (!L.crucible[i]) continue;
            const t = this.tmp;
            t.position.set(cellX(i % N), cellY(Math.floor(i / N)), -0.21);
            t.rotation.set(0, 0, time * 0.3 + i);
            t.scale.setScalar(0.94 + 0.06 * Math.sin(time * 2 + i));
            t.updateMatrix();
            this.rings.setMatrixAt(rk++, t.matrix);
        }
        this.rings.count = rk;
        this.rings.instanceMatrix.needsUpdate = true;

        // foe tokens over each living foe's first cell
        this.tokens.forEach((m, j) => {
            const f = foes[j];
            if (!f || f.hp <= 0 || !f.cells.length) { m.visible = false; return; }
            const c = f.cells[0];
            m.visible = true;
            const big = FOES[f.kind].boss ? 1.7 : 1.1;
            m.position.set(cellX(c % N), cellY(Math.floor(c / N)) + 0.15, 0.75 + 0.05 * Math.sin(time * 2 + j));
            m.scale.setScalar(big);
            const u = m.userData.u;
            if (m.userData.kind !== f.kind) {
                m.userData.kind = f.kind;
                const tex = ui.foeTex?.(f.kind);
                u.uMap.value = tex || null;
                u.uHas.value = tex ? 1 : 0;
                u.uColor.value.copy(this.foeColor(f.kind));
            }
            if (!u.uHas.value) { const tex = ui.foeTex?.(f.kind); if (tex) { u.uMap.value = tex; u.uHas.value = 1; } }
            u.uHp.value = f.hp / f.maxHp;
            m.userData.hurt = Math.max(0, m.userData.hurt - dt * 2);
            u.uHurt.value = m.userData.hurt;
        });

        let g = 0;
        if (ui.ghost) {
            const col = ui.ghost.valid ? EL_COLOR[ui.ghost.el] || GOLD : this.col.setRGB(1, 0.15, 0.1);
            const pulse = 0.2 + 0.25 * Math.sin(time * 8);
            for (const [x, y] of ui.ghost.cells) {
                if (x < 0 || y < 0 || x >= N || y >= N) continue;
                this.put(this.ghost, g++, cellX(x), cellY(y), 0, 0.96, col, pulse, 0, 0, ELEMENT_IDS.indexOf(ui.ghost.el));
            }
        }
        this.ghost.count = g;
        this.ghost.instanceMatrix.needsUpdate = true;
        this.ghost.instanceColor.needsUpdate = true;
        this.ghost.userData.state.needsUpdate = true;

        let st = 0;
        if (ui.lines) {
            const col = EL_COLOR[ui.lines.el] || GOLD;
            for (const r of ui.lines.rows) this.strip(st++, cellX(H), cellY(r), 0, col, time);
            for (const c of ui.lines.cols) this.strip(st++, cellX(c), cellY(H), Math.PI / 2, col, time);
        }
        for (; st < this.strips.length; st++) this.strips[st].visible = false;
    }

    foeColor(kind) {
        const c = { imp: 0xff6a2a, hulk: 0xa09080, warden: 0xff7a1a, crawler: 0x6ad050, vinelord: 0x9ae070, serpent: 0x60d8ff, tail: 0x60d8ff, wisp: 0xc08aff, sentinel: 0xffc060, homunculus: 0xb070ff }[kind] || 0xff5040;
        return this.col.clone().setHex(c);
    }

    strip(k, x, y, rot, col, time) {
        const m = this.strips[k];
        m.visible = true;
        m.position.x = x; m.position.y = y;
        m.rotation.z = rot;
        m.userData.u.uColor.value.copy(col).multiplyScalar(1.2);
        m.userData.u.uAlpha.value = 0.5 + 0.2 * Math.sin(time * 10);
        m.userData.u.uTime.value = time;
    }
}
