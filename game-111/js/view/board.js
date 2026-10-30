// The lattice in three.js: a glass plate, the glyph blocks (one instanced mesh for the board, the
// hand and the glyph being dragged), sigils, the ghost of a placement and the lines it would clear.
// Everything lives in the board group's space: cell (cx, cy) has its centre at (cx − 3.5, 3.5 − cy, 0).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { N } from '../config.js';
import { sizeOf } from '../sim/pieces.js';
import { makeRng } from '../rng.js';

/** Glyph colours 1..7 and blight 8, in linear RGB. */
export const PALETTE = [
    null,
    new THREE.Color(1.0, 0.16, 0.72),   // 1 magenta
    new THREE.Color(0.08, 0.85, 1.0),   // 2 cyan
    new THREE.Color(1.0, 0.68, 0.10),   // 3 gold
    new THREE.Color(0.55, 0.25, 1.0),   // 4 violet
    new THREE.Color(0.15, 1.0, 0.45),   // 5 emerald
    new THREE.Color(1.0, 0.28, 0.20),   // 6 ember
    new THREE.Color(0.75, 0.88, 1.0),   // 7 starlight
    new THREE.Color(0.45, 0.12, 0.60),   // 8 blight
];
export const cellX = (cx) => cx - (N - 1) / 2;
export const cellY = (cy) => (N - 1) / 2 - cy;

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
    uniform float uTime, uOpacity, uDim;
    varying vec3 vN, vP, vCol, vV;
    varying vec4 vS;      // x glow boost, y white flash, z kind (0 glyph, 1 blight), w sigil / crack
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
        float fres = pow(clamp(1.0 - ndv, 0.0, 1.0), 3.0);
        vec2 q = abs(vP.xy) / 0.46;
        float m = max(q.x, q.y);
        float top = smoothstep(0.1, 0.19, vP.z);
        float edge = smoothstep(0.8, 0.97, m);
        float inner = smoothstep(0.6, 0.64, m) * (1.0 - smoothstep(0.66, 0.7, m));
        float dia = abs(vP.x) + abs(vP.y);
        float rune = (1.0 - smoothstep(0.0, 0.03, abs(dia - 0.2))) * top;
        float dot0 = (1.0 - smoothstep(0.03, 0.06, length(vP.xy))) * top;
        float shimmer = 0.5 + 0.5 * sin(uTime * 2.2 + (vP.x + vP.y) * 5.0 + vCol.g * 9.0);
        float lite = 0.55 + 0.45 * clamp(dot(n, normalize(vec3(-0.35, 0.55, 1.0))), 0.0, 1.0);
        vec3 col;
        if (vS.z < 0.5) {
            vec3 glass = vCol * (0.07 + 0.05 * top) * lite;
            col = glass
                + vCol * edge * top * 1.25
                + vCol * inner * top * 0.55
                + vCol * (rune * (0.7 + 0.4 * shimmer) + dot0 * 1.0)
                + vCol * fres * 0.7
                + vCol * (1.0 - top) * 0.3;
            col += vec3(1.0, 0.72, 0.28) * (rune + dot0) * vS.w * 1.2;      // standing on a sigil
        } else {
            // blight: a bruised stone with sick veins; cracks glow as it weakens
            float nz = noise(vP.xy * 7.0 + vec2(uTime * 0.05, 0.0));
            float vein = smoothstep(0.03, 0.0, abs(nz - 0.5)) * 0.9;
            float cr = noise(vP.xy * 4.0 + 13.0);
            float crack = smoothstep(0.04, 0.0, abs(cr - 0.5)) * vS.w;
            col = vec3(0.035, 0.008, 0.05) * lite
                + vec3(0.25, 0.9, 0.18) * vein * (0.4 + 0.3 * shimmer) * top
                + vec3(0.55, 0.12, 0.85) * edge * top * 1.6
                + vec3(0.9, 1.0, 0.4) * crack * 3.0 * top
                + vec3(0.35, 0.08, 0.5) * fres;
        }
        col *= (1.0 + vS.x) * uDim;
        col += vec3(vS.y) * 1.5;
        gl_FragColor = vec4(col, uOpacity);
    }`;

const PLATE_FS = /* glsl */`
    uniform float uTime, uPulse;
    uniform vec3 uTint;
    varying vec2 vUv;
    void main() {
        vec2 p = vUv * ${N.toFixed(1)} * (8.6 / 8.0) - 0.3;            // cell coords; the plate overhangs 0.3
        vec2 f = fract(p);
        vec2 g = min(f, 1.0 - f);
        float inside = step(0.0, p.x) * step(0.0, p.y) * step(p.x, ${N.toFixed(1)}) * step(p.y, ${N.toFixed(1)});
        float line = (1.0 - smoothstep(0.0, 0.035, min(g.x, g.y))) * inside;
        float well = smoothstep(0.08, 0.2, min(g.x, g.y)) * inside;
        float wave = 0.5 + 0.5 * sin(uTime * 1.3 - length(p - 4.0) * 0.9);
        vec3 col = vec3(0.008, 0.006, 0.02) + uTint * well * 0.02 * (0.6 + 0.4 * wave);
        col += uTint * line * (0.1 + 0.08 * wave + uPulse * 0.8);
        // the rim
        vec2 e = min(vUv, 1.0 - vUv);
        float rim = 1.0 - smoothstep(0.0, 0.012, min(e.x, e.y));
        col += uTint * rim * 0.9;
        gl_FragColor = vec4(col, 1.0);
    }`;

const GLOW_FS = /* glsl */`
    uniform vec3 uColor;
    uniform float uAlpha, uTime;
    varying vec2 vUv;
    void main() {
        vec2 c = abs(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.55, 1.0, c.y)) * (1.0 - smoothstep(0.92, 1.0, c.x));
        float scan = 0.65 + 0.35 * sin(vUv.x * 30.0 - uTime * 9.0);
        gl_FragColor = vec4(uColor * a * scan * uAlpha, 1.0);
    }`;
const UV_VS = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** A 4×4 atlas of sigil runes. */
function sigilAtlas() {
    const S = 512, c = S / 4;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const rng = makeRng(911);
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let k = 0; k < 16; k++) {
        const ox = (k % 4) * c + c / 2, oy = Math.floor(k / 4) * c + c / 2;
        g.save();
        g.translate(ox, oy);
        g.lineWidth = 4;
        g.shadowColor = '#fff';
        g.shadowBlur = 8;
        g.beginPath(); g.arc(0, 0, c * 0.42, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, c * 0.34, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 5;
        g.beginPath();
        const pts = [];
        for (let j = 0; j < 5; j++) { const a = rng() * Math.PI * 2, r = c * (0.08 + rng() * 0.22); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
        g.moveTo(...pts[0]);
        for (const p of pts.slice(1)) g.lineTo(...p);
        g.stroke();
        for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * c * 0.38, Math.sin(a) * c * 0.38, 3, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); }
        g.restore();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** A hand slot: a card-shaped neon frame. */
function slotTexture() {
    const W = 256, H = 256;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const r = 26;
    const rr = (x, y, w, h) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = 'rgba(40, 20, 80, 0.35)';
    rr(10, 10, W - 20, H - 20); g.fill();
    g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10;
    g.lineWidth = 4; rr(10, 10, W - 20, H - 20); g.stroke();
    g.lineWidth = 1.5; g.shadowBlur = 0; rr(22, 22, W - 44, H - 44); g.stroke();
    for (const [x, y] of [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const MAX_BLOCKS = 128;

export class Board {
    constructor(group) {
        this.group = group;
        this.tmp = new THREE.Object3D();
        this.col = new THREE.Color();

        // a dark slab beneath, for thickness
        const slab = new THREE.Mesh(new THREE.BoxGeometry(8.9, 8.9, 0.6), new THREE.MeshBasicMaterial({ color: 0x030208 }));
        slab.position.z = -0.56;
        group.add(slab);
        this.plateU = { uTime: { value: 0 }, uPulse: { value: 0 }, uTint: { value: new THREE.Color(0.4, 0.25, 1.0) } };
        this.plate = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 8.6), new THREE.ShaderMaterial({ uniforms: this.plateU, vertexShader: UV_VS, fragmentShader: PLATE_FS }));
        this.plate.position.z = -0.24;
        group.add(this.plate);
        // the invisible pick plane, at the glyphs' top faces
        this.pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ visible: false }));
        this.pickPlane.position.z = 0.21;
        group.add(this.pickPlane);

        // the blocks
        this.geo = new RoundedBoxGeometry(0.92, 0.92, 0.42, 3, 0.1);
        this.blockU = { uTime: { value: 0 }, uOpacity: { value: 1 }, uDim: { value: 1 } };
        this.blockMat = new THREE.ShaderMaterial({ uniforms: this.blockU, vertexShader: BLOCK_VS, fragmentShader: BLOCK_FS });
        this.blocks = this.instanced(this.geo, this.blockMat, MAX_BLOCKS);
        group.add(this.blocks);

        // the ghost of a placement
        this.ghostU = { uTime: { value: 0 }, uOpacity: { value: 0.32 }, uDim: { value: 1 } };
        this.ghostMat = new THREE.ShaderMaterial({ uniforms: this.ghostU, vertexShader: BLOCK_VS, fragmentShader: BLOCK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        this.ghost = this.instanced(this.geo, this.ghostMat, 12);
        group.add(this.ghost);

        // sigils
        this.sigilMat = new THREE.MeshBasicMaterial({ map: sigilAtlas(), color: new THREE.Color(2.2, 1.4, 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const sg = new THREE.PlaneGeometry(0.86, 0.86);
        // per-instance atlas cell through a uv offset attribute
        this.sigilMat.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
                .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (uv + aCell) * 0.25;');
        };
        this.sigils = new THREE.InstancedMesh(sg, this.sigilMat, 16);
        this.sigilCell = new THREE.InstancedBufferAttribute(new Float32Array(32), 2);
        sg.setAttribute('aCell', this.sigilCell);
        this.sigils.count = 0;
        this.sigils.frustumCulled = false;
        group.add(this.sigils);

        // line previews: rows and columns a placement would clear
        this.strips = [];
        for (let k = 0; k < 16; k++) {
            const u = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 } };
            const m = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 1.05), new THREE.ShaderMaterial({ uniforms: u, vertexShader: UV_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            m.position.z = 0.26;
            m.visible = false;
            m.userData.u = u;
            group.add(m);
            this.strips.push(m);
        }

        // hand slots
        this.slotTex = slotTexture();
        this.slots = [];
        for (let k = 0; k < 3; k++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.slotTex, color: 0x7755ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            m.position.z = -0.3;
            group.add(m);
            this.slots.push(m);
        }
        this.slotRects = [];

        // per-cell animation state, set from events by the view
        this.spawn = new Float32Array(N * N).fill(-10);     // time each cell was filled
        this.flash = new Float32Array(N * N);
        this.dealT = [-10, -10, -10];                        // time each slot was dealt
        this.handScale = 0.5;
    }

    instanced(geo, mat, n) {
        // each mesh has its own per-instance aState, so each gets its own copy of the geometry
        const m = new THREE.InstancedMesh(geo.clone(), mat, n);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.userData.state = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
        m.userData.state.setUsage(THREE.DynamicDrawUsage);
        m.geometry.setAttribute('aState', m.userData.state);
        for (let i = 0; i < n; i++) m.setColorAt(i, PALETTE[1]);
        m.instanceColor.setUsage(THREE.DynamicDrawUsage);
        m.count = 0;
        m.frustumCulled = false;
        return m;
    }

    /** slots: [{ x, y, w, h }] in cell coords (centre and size); handScale: hand glyph size in cells. */
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

    put(mesh, k, x, y, z, s, color, sx, sy, sz, sw) {
        const t = this.tmp;
        t.position.set(x, y, z);
        t.rotation.set(0, 0, 0);
        t.scale.setScalar(s);
        t.updateMatrix();
        mesh.setMatrixAt(k, t.matrix);
        mesh.setColorAt(k, color);
        mesh.userData.state.setXYZW(k, sx, sy, sz, sw);
    }

    /**
     * ui: { drag: { slot, cx, cy, s } | null, sel, hide: Set of slots not to draw in the hand,
     *       ghost: { cells: [[x, y]], color, valid } | null, lines: { rows, cols, color } | null, time }
     */
    update(G, ui, dt, time) {
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
        for (let i = 0; i < N * N; i++) {
            const v = G.cells[i];
            this.flash[i] = Math.max(0, this.flash[i] - dt * 4);
            if (!v) continue;
            const cx = i % N, cy = Math.floor(i / N);
            const a = Math.min(1, Math.max(0, (time - this.spawn[i]) / 0.22));
            const ease = 1 + 2.2 * Math.pow(a - 1, 3) + 1.2 * Math.pow(a - 1, 2);   // back-out
            const drop = (1 - a) * 1.4;
            const glow = lineSet.has(i) ? 0.6 + 0.4 * Math.sin(time * 14) : 0;
            if (v === 8) {
                const hp = G.hp[i];
                this.put(B, k++, cellX(cx), cellY(cy), drop, 0.6 + 0.4 * ease, PALETTE[8], glow, this.flash[i], 1, hp <= 1 ? 1 : hp === 2 ? 0.35 : 0);
            } else {
                this.put(B, k++, cellX(cx), cellY(cy), drop, 0.6 + 0.4 * ease, PALETTE[v], glow, this.flash[i], 0, G.sigils[i] ? 1 : 0);
            }
        }
        // the hand
        G.hand.forEach((h, slot) => {
            const s = this.slotRects[slot];
            const m = this.slots[slot];
            const sel = ui.sel === slot && h;
            m.material.color.setHSL(0.74 - (sel ? 0.18 : 0), 1, sel ? 0.7 : h ? 0.45 : 0.18);
            if (!h || !s || ui.hide?.has(slot)) return;
            const { w, h: hh } = sizeOf(h.cells);
            const da = Math.min(1, Math.max(0, (time - this.dealT[slot]) / 0.35));
            const slide = (1 - da) * (1 - da) * 3;
            const sc = this.handScale * (sel ? 1.12 : 1) * (0.4 + 0.6 * da);
            const fits = ui.fits ? ui.fits[slot] : true;
            for (const [px, py] of h.cells) {
                const x = cellX(s.x - 0.5) + (px - (w - 1) / 2) * sc;
                const y = cellY(s.y - 0.5) - (py - (hh - 1) / 2) * sc - slide;
                this.put(B, k++, x, y, 0, sc * 0.98, PALETTE[h.color], sel ? 0.5 + 0.2 * Math.sin(time * 6) : fits ? 0 : -0.65, 0, 0, 0);
            }
        });
        // the dragged glyph floats above the board
        if (ui.drag && G.hand[ui.drag.slot]) {
            const h = G.hand[ui.drag.slot];
            const { w, h: hh } = sizeOf(h.cells);
            const s = ui.drag.s;
            for (const [px, py] of h.cells) {
                const x = cellX(ui.drag.cx - 0.5) + (px - (w - 1) / 2) * s;
                const y = cellY(ui.drag.cy - 0.5) - (py - (hh - 1) / 2) * s;
                this.put(B, k++, x, y, 1.1, s * 0.98, PALETTE[h.color], 0.35, 0, 0, 0);
            }
        }
        B.count = k;
        B.instanceMatrix.needsUpdate = true;
        B.instanceColor.needsUpdate = true;
        B.userData.state.needsUpdate = true;

        // ghost
        let g = 0;
        if (ui.ghost) {
            const col = ui.ghost.valid ? PALETTE[ui.ghost.color] || PALETTE[7] : this.col.setRGB(1, 0.1, 0.1);
            const pulse = 0.2 + 0.25 * Math.sin(time * 8);
            for (const [x, y] of ui.ghost.cells) {
                if (x < 0 || y < 0 || x >= N || y >= N) continue;
                this.put(this.ghost, g++, cellX(x), cellY(y), 0, 0.96, col, pulse, 0, 0, 0);
            }
        }
        this.ghost.count = g;
        this.ghost.instanceMatrix.needsUpdate = true;
        this.ghost.instanceColor.needsUpdate = true;
        this.ghost.userData.state.needsUpdate = true;

        // strips
        let st = 0;
        if (ui.lines) {
            const col = PALETTE[ui.lines.color] || PALETTE[7];
            for (const r of ui.lines.rows) this.strip(st++, cellX(3.5), cellY(r), 0, col, time);
            for (const c of ui.lines.cols) this.strip(st++, cellX(c), cellY(3.5), Math.PI / 2, col, time);
        }
        for (; st < this.strips.length; st++) this.strips[st].visible = false;

        // sigils
        let sk = 0;
        for (let i = 0; i < N * N && sk < 16; i++) {
            if (!G.sigils[i]) continue;
            const t = this.tmp;
            t.position.set(cellX(i % N), cellY(Math.floor(i / N)), -0.2);
            t.rotation.set(0, 0, time * 0.4 + i);
            t.scale.setScalar(0.92 + 0.08 * Math.sin(time * 2.5 + i));
            t.updateMatrix();
            this.sigils.setMatrixAt(sk, t.matrix);
            this.sigilCell.setXY(sk, i % 4, Math.floor(i / 4) % 4);
            sk++;
        }
        this.sigils.count = sk;
        this.sigils.instanceMatrix.needsUpdate = true;
        this.sigilCell.needsUpdate = true;
    }

    strip(k, x, y, rot, col, time) {
        const m = this.strips[k];
        m.visible = true;
        m.position.x = x; m.position.y = y;
        m.rotation.z = rot;
        m.userData.u.uColor.value.copy(col).multiplyScalar(1.6);
        m.userData.u.uAlpha.value = 0.55 + 0.25 * Math.sin(time * 10);
        m.userData.u.uTime.value = time;
    }
}
