/**
 * structures.js — procedural architecture and props, merged per location.
 *
 * A Builder emits boxes, slabs, prisms, cylinders and cones with world-scaled UVs, a texture
 * layer and a tint per vertex. Each settlement becomes one mesh drawn with one texture-array
 * material, which also puts snow on up-facing surfaces where the terrain is snowy, darkens
 * burned timber and lights windows at night.
 */
import * as THREE from 'three';
import { WORLD } from '../sim/geography.js';
import { patch, G, GLSL_NOISE } from './shaders.js';
import { makeStructureTextures, SLAYER as S, SLAYER_SCALE, SLAYER_ROUGH, SLAYER_METAL } from './textures.js';
import { mulberry32 } from '../sim/rng.js';

const _v = new THREE.Vector3(), _n = new THREE.Vector3();

export class Builder {
    constructor() {
        this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.lay = []; this.idx = [];
        this.m = new THREE.Matrix4();
        this.nm = new THREE.Matrix3();
        this.stack = [];
        this.tint = [1, 1, 1];
    }
    push() { this.stack.push([this.m.clone(), this.tint]); return this; }
    pop() { const [m, t] = this.stack.pop(); this.m = m; this.tint = t; this.nm.getNormalMatrix(this.m); return this; }
    translate(x, y, z) { this.m.multiply(new THREE.Matrix4().makeTranslation(x, y, z)); this.nm.getNormalMatrix(this.m); return this; }
    rotY(a) { this.m.multiply(new THREE.Matrix4().makeRotationY(a)); this.nm.getNormalMatrix(this.m); return this; }
    rotX(a) { this.m.multiply(new THREE.Matrix4().makeRotationX(a)); this.nm.getNormalMatrix(this.m); return this; }
    rotZ(a) { this.m.multiply(new THREE.Matrix4().makeRotationZ(a)); this.nm.getNormalMatrix(this.m); return this; }
    scale(x, y, z) { this.m.multiply(new THREE.Matrix4().makeScale(x, y, z)); this.nm.getNormalMatrix(this.m); return this; }
    color(r, g, b) { this.tint = [r, g, b]; return this; }

    vert(x, y, z, nx, ny, nz, u, v, layer) {
        _v.set(x, y, z).applyMatrix4(this.m);
        _n.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
        this.pos.push(_v.x, _v.y, _v.z);
        this.nrm.push(_n.x, _n.y, _n.z);
        this.uv.push(u, v);
        this.col.push(this.tint[0], this.tint[1], this.tint[2]);
        this.lay.push(layer);
        return this.pos.length / 3 - 1;
    }

    /** Quad from 4 local corners (CCW seen from the front), UVs in metres / the layer's tile size. */
    quad(a, b, c, d, layer, uvs = null) {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const sc = SLAYER_SCALE[layer];
        const w = Math.hypot(...e1) / sc, h = Math.hypot(...e2) / sc;
        const U = uvs || [[0, 0], [w, 0], [w, h], [0, h]];
        const i0 = this.vert(...a, nx, ny, nz, ...U[0], layer), i1 = this.vert(...b, nx, ny, nz, ...U[1], layer);
        const i2 = this.vert(...c, nx, ny, nz, ...U[2], layer), i3 = this.vert(...d, nx, ny, nz, ...U[3], layer);
        this.idx.push(i0, i1, i2, i0, i2, i3);
    }

    tri(a, b, c, layer) {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const sc = SLAYER_SCALE[layer];
        // planar UVs on the dominant axis
        const uvOf = (p) => (Math.abs(nx) > Math.abs(nz) ? [p[2] / sc, p[1] / sc] : [p[0] / sc, p[1] / sc]);
        const i0 = this.vert(...a, nx, ny, nz, ...uvOf(a), layer), i1 = this.vert(...b, nx, ny, nz, ...uvOf(b), layer), i2 = this.vert(...c, nx, ny, nz, ...uvOf(c), layer);
        this.idx.push(i0, i1, i2);
    }

    /** Axis-aligned box (in the current frame) centred at (cx, cy, cz). `top` overrides the top face layer. */
    box(cx, cy, cz, sx, sy, sz, layer, opts = {}) {
        const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
        const top = opts.top ?? layer, side = opts.side ?? layer;
        if (!opts.noFront) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side);
        if (!opts.noBack) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side);
        this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side);
        this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side);
        if (!opts.noTop) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
        if (!opts.noBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], layer);
    }

    /** Beam from p to q with a square section. */
    beam(p, q, t, layer = S.beam) {
        const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
        const len = Math.hypot(dx, dy, dz);
        this.push();
        this.translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
        const yaw = Math.atan2(dx, dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
        this.rotY(yaw); this.rotX(-pitch);
        this.box(0, 0, 0, t, t, len, layer);
        this.pop();
    }

    cylinder(cx, cy, cz, r0, r1, h, segs, layer, opts = {}) {
        const sc = SLAYER_SCALE[layer];
        const circ = 2 * Math.PI * Math.max(r0, r1) / sc;
        const base = this.pos.length / 3;
        for (let i = 0; i <= segs; i++) {
            const a = i / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
            const sl = (r0 - r1) / h;
            const nl = Math.hypot(1, sl);
            this.vert(cx + c * r0, cy, cz + s * r0, c / nl, sl / nl, s / nl, i / segs * circ, 0, layer);
            this.vert(cx + c * r1, cy + h, cz + s * r1, c / nl, sl / nl, s / nl, i / segs * circ, h / sc, layer);
        }
        for (let i = 0; i < segs; i++) {
            const a = base + i * 2;
            this.idx.push(a, a + 3, a + 1, a, a + 2, a + 3);
        }
        if (opts.cap && r1 > 0.001) {
            const c0 = this.vert(cx, cy + h, cz, 0, 1, 0, 0, 0, opts.capLayer ?? layer);
            const ring = [];
            for (let i = 0; i <= segs; i++) { const a = i / segs * Math.PI * 2; ring.push(this.vert(cx + Math.cos(a) * r1, cy + h, cz + Math.sin(a) * r1, 0, 1, 0, Math.cos(a) * r1 / sc, Math.sin(a) * r1 / sc, opts.capLayer ?? layer)); }
            for (let i = 0; i < segs; i++) this.idx.push(c0, ring[i + 1], ring[i]);
        }
    }

    /** Pitched roof over a w × d footprint at height y, ridge along x. */
    gableRoof(w, d, y, rise, over, layer, thick = 0.22) {
        const hw = w / 2 + over, hd = d / 2 + over * 1.1;
        const ry = y + rise;
        const ext = over * (rise / (d / 2));
        // two slabs (top surfaces) plus undersides and edges
        for (const side of [1, -1]) {
            const zA = side * hd, yA = y - ext;
            const a = [-hw, yA, zA], b = [hw, yA, zA], c = [hw, ry, 0], dd = [-hw, ry, 0];
            if (side > 0) this.quad(a, b, c, dd, layer); else this.quad(b, a, dd, c, layer);
            // underside
            const a2 = [-hw, yA - thick, zA], b2 = [hw, yA - thick, zA], c2 = [hw, ry - thick, 0], d2 = [-hw, ry - thick, 0];
            if (side > 0) this.quad(d2, c2, b2, a2, S.plank); else this.quad(c2, d2, a2, b2, S.plank);
            // eave edge
            if (side > 0) this.quad(a2, b2, b, a, S.beam); else this.quad(b2, a2, a, b, S.beam);
        }
        // gable ends
        for (const end of [1, -1]) {
            const x = end * (w / 2);
            if (end > 0) this.tri([x, y, d / 2], [x, y, -d / 2], [x, ry - 0.1, 0], S.plank);
            else this.tri([x, y, -d / 2], [x, y, d / 2], [x, ry - 0.1, 0], S.plank);
            // verge boards
            this.beam([end * hw, y - ext, hd], [end * hw, ry + 0.05, 0], 0.2);
            this.beam([end * hw, y - ext, -hd], [end * hw, ry + 0.05, 0], 0.2);
            // the carved crossed beams above the ridge
            this.beam([end * hw, ry - 0.6, 0.9], [end * hw, ry + 1.0, -0.6], 0.22);
            this.beam([end * hw, ry - 0.6, -0.9], [end * hw, ry + 1.0, 0.6], 0.22);
        }
        this.beam([-hw, ry + 0.05, 0], [hw, ry + 0.05, 0], 0.3);
    }

    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setAttribute('layer', new THREE.Float32BufferAttribute(this.lay, 1));
        g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
        g.computeBoundingSphere();
        return g;
    }
    get empty() { return this.idx.length === 0; }
}

export function makeStructureMaterial(tex, masks) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const U = {
        uAlb: { value: tex.albedo }, uNrm: { value: tex.normal }, uMasks: { value: masks },
        uWorld: { value: WORLD.SIZE }, uHalf: { value: WORLD.HALF },
        uRough: { value: SLAYER_ROUGH }, uMetal: { value: SLAYER_METAL }, uNight: G.uNight, uSnowAll: { value: 0 },
    };
    mat.userData.U = U;
    patch(mat, (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = 'attribute float layer;\nvarying float vLayer;\nvarying vec3 vSW;\nvarying vec3 vSN;\nvarying vec2 vSUv;\n' + sh.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\nvLayer = layer;\nvSUv = uv;\nvSW = (modelMatrix * vec4(position, 1.0)).xyz;\nvSN = normalize(mat3(modelMatrix) * normal);');
        sh.fragmentShader = `precision highp sampler2DArray;
            uniform sampler2DArray uAlb; uniform sampler2DArray uNrm; uniform sampler2D uMasks; uniform float uWorld, uHalf;
            uniform float uRough[17]; uniform float uMetal[17]; uniform float uNight; uniform float uSnowAll;
            varying float vLayer; varying vec3 vSW; varying vec3 vSN; varying vec2 vSUv;
            vec3 sNW; float sR; float sM; float sGlow;
            ${GLSL_NOISE}\n` + sh.fragmentShader
            .replace('#include <map_fragment>', `{
                float L = floor(vLayer + 0.5);
                vec4 a = texture(uAlb, vec3(vSUv, L));
                vec3 tn = texture(uNrm, vec3(vSUv, L)).xyz * 2.0 - 1.0;
                vec3 col = a.rgb;
                int li = int(L);
                sR = uRough[li]; sM = uMetal[li];
                // weathering: darker near the ground, a little grime variation
                float grime = vnoise(vSW.xz * 0.7 + vSW.y * 0.3);
                col *= 0.85 + 0.25 * grime;
                // snow on up-facing surfaces where the land is snowy
                vec3 N = normalize(vSN);
                float snowM = max(texture2D(uMasks, (vSW.xz + uHalf) / uWorld).g, uSnowAll);
                float sn = smoothstep(0.35, 0.75, N.y + (grime - 0.5) * 0.3) * smoothstep(0.15, 0.5, snowM);
                if (li == 14) { sGlow = 1.0; sn = 0.0; } else sGlow = 0.0;
                col = mix(col, vec3(0.9, 0.93, 0.98), sn);
                sR = mix(sR, 0.6, sn); sM = mix(sM, 0.0, sn);
                diffuseColor.rgb = col;
                // world-space-ish normal perturbation from the tangent normal (approximate TBN from N)
                vec3 T = normalize(abs(N.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : cross(vec3(0.0, 1.0, 0.0), N));
                vec3 B = cross(N, T);
                sNW = normalize(N + (T * tn.x + B * tn.y) * 0.8 * (1.0 - sn * 0.8));
            }`)
            .replace('#include <color_fragment>', '#include <color_fragment>')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sR;')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = sM;')
            .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(sNW, 0.0)).xyz);')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                totalEmissiveRadiance += sGlow * vec3(1.0, 0.62, 0.28) * (0.15 + uNight * 1.6) * smoothstep(0.1, 0.3, diffuseColor.r + 0.2);`);
    }, 'structure');
    return mat;
}

// ---------------------------------------------------------------- building models
function wallLayer(wall) { return wall === 'stone' ? S.masonry : wall === 'plank' ? S.plank : S.log; }

function longhouse(B, b, rnd) {
    const { w, d, h, roof } = b;
    const burned = b.burned;
    // foundation from the lowest corner to the floor
    const footH = b.y - b.foot + 0.3;
    B.color(0.95, 0.95, 0.95);
    B.box(0, -footH / 2 + 0.15, 0, w + 0.5, footH, d + 0.5, S.field);
    if (burned) B.color(0.25, 0.22, 0.2);
    const WL = wallLayer(b.wall);
    if (b.wall !== 'open') B.box(0, 0.15 + h / 2, 0, w, h, d, WL, { noTop: true, noBottom: true });
    // corner posts
    B.color(burned ? 0.2 : 1, burned ? 0.18 : 1, burned ? 0.16 : 1);
    for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(px * (w / 2), h / 2 + 0.3, pz * (d / 2), 0.4, h + 0.5, 0.4, S.beam);
    if (b.wall === 'open') {
        // a back wall to waist height and a rail
        B.box(0, 0.8, -d / 2 + 0.1, w, 1.4, 0.2, S.plank);
    }
    // door, frame and windows on the front
    if (b.wall !== 'open') {
        const front = d / 2 + 0.05;
        B.color(0.8, 0.75, 0.7);
        B.box(0, 1.2, front, 1.4, 2.3, 0.12, S.plank);
        B.color(1, 1, 1);
        B.box(-0.82, 1.3, front + 0.05, 0.22, 2.6, 0.22, S.beam); B.box(0.82, 1.3, front + 0.05, 0.22, 2.6, 0.22, S.beam); B.box(0, 2.62, front + 0.05, 1.9, 0.25, 0.25, S.beam);
        B.box(0.45, 1.2, front + 0.12, 0.08, 0.08, 0.06, S.iron);
        const nWin = Math.max(1, Math.floor(w / 5));
        for (let i = 0; i < nWin; i++) {
            const x = (i - (nWin - 1) / 2) * (w / (nWin + 0.6));
            if (Math.abs(x) < 1.6) continue;
            for (const side of [1, -1]) {
                B.box(x, h * 0.6, side * (d / 2 + 0.03), 0.8, 0.7, 0.06, S.window);
                B.box(x, h * 0.6 + 0.42, side * (d / 2 + 0.06), 1.0, 0.12, 0.12, S.beam);
            }
        }
    }
    // the roof
    if (burned) {
        B.color(0.18, 0.16, 0.15);
        for (let i = 0; i < 5; i++) B.beam([-w / 2 + i * w / 4, h + 0.3, -d / 2], [-w / 2 + i * w / 4 + rnd() - 0.5, h + 1.5 + rnd(), 0], 0.25);
        return;
    }
    const rl = roof === 'thatch' ? S.thatch : roof === 'turf' ? S.turf : roof === 'stone' ? S.flag : S.shingle;
    B.color(1, 1, 1);
    B.gableRoof(w, d, h + 0.3, d * 0.42 + 0.4, 0.75, rl, roof === 'thatch' ? 0.45 : 0.22);
    // a chimney on some
    if (w > 9 && rnd() < 0.7) {
        B.color(0.9, 0.9, 0.9);
        B.box(w * 0.28, h + d * 0.32, -d * 0.18, 0.9, d * 0.42 + 1.4, 0.9, S.field);
    }
    if (b.type === 'hall') {
        // the great hall: a porch with posts and banners
        B.color(1, 1, 1);
        for (const px of [-4, -1.5, 1.5, 4]) B.box(px, h * 0.45 + 0.15, d / 2 + 2.2, 0.5, h * 0.9, 0.5, S.beam);
        B.push(); B.translate(0, 0, d / 2 + 2.2); B.gableRoof(10, 4.4, h * 0.9, 1.6, 0.3, S.shingle); B.pop();
        B.box(0, 0.05, d / 2 + 2.2, 10, 0.3, 4.6, S.flag);
    }
}

function stoneBuilding(B, b, rnd) {
    const { w, d, h, roof } = b;
    const footH = b.y - b.foot + 0.3;
    B.color(0.9, 0.9, 0.9);
    B.box(0, -footH / 2 + 0.15, 0, w + 0.6, footH, d + 0.6, S.field);
    B.color(1, 1, 1);
    B.box(0, h / 2 + 0.15, 0, w, h, d, S.masonry, { noBottom: true, noTop: roof !== 'flat' });
    // pilasters
    for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.max(2, Math.round(w / 4))) {
        B.box(x, h / 2 + 0.15, d / 2 + 0.15, 0.6, h, 0.3, S.carved);
        B.box(x, h / 2 + 0.15, -d / 2 - 0.15, 0.6, h, 0.3, S.carved);
    }
    // door: a dark arch
    B.color(0.55, 0.5, 0.45);
    B.box(0, 1.4, d / 2 + 0.1, 1.8, 2.8, 0.14, S.plank);
    B.color(1, 1, 1);
    B.box(0, 3.0, d / 2 + 0.2, 2.6, 0.5, 0.4, S.carved);
    for (let i = -1; i <= 1; i += 2) B.box(i * 2.6, h * 0.62, d / 2 + 0.04, 0.7, 1.0, 0.06, S.window);
    if (roof === 'flat') {
        // parapet with merlons
        B.box(0, h + 0.15 + 0.1, 0, w + 0.4, 0.2, d + 0.4, S.flag);
        const step = 1.6;
        for (let x = -w / 2; x <= w / 2; x += step) { B.box(x, h + 0.75, d / 2, 0.8, 0.9, 0.5, S.masonry); B.box(x, h + 0.75, -d / 2, 0.8, 0.9, 0.5, S.masonry); }
        for (let z = -d / 2 + step; z < d / 2; z += step) { B.box(w / 2, h + 0.75, z, 0.5, 0.9, 0.8, S.masonry); B.box(-w / 2, h + 0.75, z, 0.5, 0.9, 0.8, S.masonry); }
        if (b.type === 'keep') {
            for (const [tx, tz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                B.cylinder(tx * w / 2, 0, tz * d / 2, 3, 2.8, h + 4, 12, S.masonry);
                B.cylinder(tx * w / 2, h + 4, tz * d / 2, 3.3, 3.3, 0.6, 12, S.masonry, { cap: true, capLayer: S.flag });
            }
            for (const bx of [-3.5, 3.5]) { B.color(0.6, 0.12, 0.1); B.box(bx, h * 0.6, d / 2 + 0.35, 1.4, 3.6, 0.05, S.cloth); B.color(1, 1, 1); }
        }
    } else {
        B.gableRoof(w, d, h + 0.15, d * 0.38, 0.5, roof === 'stone' ? S.flag : S.shingle, 0.35);
    }
    if (b.type === 'monastery') {
        B.cylinder(w / 2 - 3, 0, -d / 2 + 3, 3.4, 3, h + 9, 14, S.masonry);
        B.push(); B.translate(w / 2 - 3, h + 9, -d / 2 + 3); B.cylinder(0, 0, 0, 3.8, 0.01, 6, 14, S.flag); B.pop();
        B.box(0, 0.1, d / 2 + 6, w * 0.7, 0.4, 10, S.flag);
    }
}

function roundTower(B, b, rnd) {
    const r = b.w / 2, h = b.h;
    const footH = b.y - b.foot + 0.3;
    B.color(1, 1, 1);
    B.cylinder(0, -footH, 0, r * 1.08, r, h + footH, 16, S.masonry);
    if (b.ruined) {
        // broken crown: uneven chunks of wall
        for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2, hh = rnd() * 3;
            if (rnd() < 0.3) continue;
            B.push(); B.rotY(-a); B.box(r - 0.4, h + hh / 2, 0, 0.9, hh, r * 0.6, S.masonry); B.pop();
        }
        B.cylinder(0, h * 0.55, 0, r * 0.98, r * 0.98, 0.3, 16, S.flag, { cap: true });
        return;
    }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; B.push(); B.rotY(-a); B.box(r + 0.02, h * (0.3 + k * 0.15), 0, 0.06, 1.0, 0.6, S.window); B.pop(); }
    if (b.type === 'spire') {
        B.cylinder(0, h, 0, r + 0.6, r + 0.6, 1, 16, S.carved, { cap: true, capLayer: S.flag });
        B.cylinder(0, h + 1, 0, r * 0.7, r * 0.6, 8, 12, S.masonry);
        B.cylinder(0, h + 9, 0, r * 0.8, 0.05, 10, 12, S.shingle);
        B.color(0.35, 0.5, 0.95); B.box(0, h + 19.5, 0, 0.4, 1, 0.4, S.brass); B.color(1, 1, 1);
        // a hall at its foot
        B.box(0, 3, r + 5, 9, 6, 10, S.masonry, { noBottom: true });
        B.push(); B.translate(0, 0, r + 5); B.rotY(Math.PI / 2); B.gableRoof(10, 9, 6, 3.2, 0.5, S.flag, 0.3); B.pop();
        return;
    }
    B.cylinder(0, h, 0, r + 0.4, r + 0.4, 0.5, 16, S.flag, { cap: true });
    B.cylinder(0, h + 0.5, 0, r + 0.6, 0.05, r * 1.4, 16, S.shingle);
}

function tent(B, b) {
    const { w, d, h } = b;
    if (b.roof === 'hide') {
        B.color(1, 1, 1);
        B.cylinder(0, 0, 0, w / 2, 0.15, h, 9, S.hide);
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; B.beam([Math.cos(a) * w / 2, 0, Math.sin(a) * w / 2], [Math.cos(a) * 0.3, h + 0.9, Math.sin(a) * 0.3], 0.18); }
        return;
    }
    B.color(0.85, 0.78, 0.65);
    const hw = w / 2;
    B.quad([-hw, 0, d / 2], [0, h, d / 2], [0, h, -d / 2], [-hw, 0, -d / 2], S.hide);
    B.quad([0, h, d / 2], [hw, 0, d / 2], [hw, 0, -d / 2], [0, h, -d / 2], S.hide);
    B.quad([-hw, 0, -d / 2], [0, h, -d / 2], [0, h, d / 2], [-hw, 0, d / 2], S.hide);
    B.quad([0, h, -d / 2], [hw, 0, -d / 2], [hw, 0, d / 2], [0, h, d / 2], S.hide);
    B.color(1, 1, 1);
    B.beam([0, 0, d / 2 + 0.1], [0, h + 0.2, d / 2 + 0.1], 0.1); B.beam([0, 0, -d / 2 - 0.1], [0, h + 0.2, -d / 2 - 0.1], 0.1);
}

export function buildBuilding(B, b, rnd) {
    B.push();
    B.translate(b.x, b.y, b.z);
    B.rotY(b.rot);
    if (b.round) roundTower(B, b, rnd);
    else if (b.wall === 'stone') stoneBuilding(B, b, rnd);
    else if (b.wall === 'none') tent(B, b);
    else longhouse(B, b, rnd);
    B.pop();
}

// ---------------------------------------------------------------- props
const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

export function buildProp(B, p, ground, rnd) {
    B.push();
    B.translate(p.x, p.y, p.z);
    B.rotY(p.rot || 0);
    const s = p.s || 1;
    if (s !== 1) B.scale(s, s, s);
    B.color(1, 1, 1);
    switch (p.type) {
        case 'well':
            B.cylinder(0, 0, 0, 1.3, 1.3, 0.9, 12, S.field, { cap: false });
            B.cylinder(0, 0, 0, 1.0, 1.0, 0.85, 12, S.field);
            B.color(0.1, 0.12, 0.14); B.cylinder(0, 0.3, 0, 1.0, 1.0, 0.01, 12, S.iron, { cap: true }); B.color(1, 1, 1);
            B.box(-1.1, 1.4, 0, 0.2, 2.2, 0.2, S.beam); B.box(1.1, 1.4, 0, 0.2, 2.2, 0.2, S.beam);
            B.push(); B.translate(0, 2.4, 0); B.gableRoof(2.6, 2.0, 0, 0.7, 0.2, S.shingle, 0.12); B.pop();
            break;
        case 'stall': {
            for (const [x, z] of [[-1.4, -0.9], [1.4, -0.9], [1.4, 0.9], [-1.4, 0.9]]) B.box(x, 1.2, z, 0.15, 2.4, 0.15, S.beam);
            const cols = [[0.7, 0.15, 0.12], [0.2, 0.35, 0.7], [0.75, 0.6, 0.2], [0.25, 0.5, 0.25]];
            B.color(...cols[Math.floor(rnd() * 4)]);
            B.quad([-1.6, 2.2, 1.1], [1.6, 2.2, 1.1], [1.6, 2.6, -1.1], [-1.6, 2.6, -1.1], S.cloth);
            B.quad([1.6, 2.2, 1.1], [-1.6, 2.2, 1.1], [-1.6, 2.6, -1.1], [1.6, 2.6, -1.1], S.cloth);
            B.color(1, 1, 1); B.box(0, 0.5, 0.6, 3, 1, 0.8, S.plank);
            for (let i = 0; i < 6; i++) { B.color(0.4 + rnd() * 0.5, 0.3 + rnd() * 0.4, 0.2 + rnd() * 0.3); B.box(-1.1 + i * 0.45, 1.1, 0.6, 0.3, 0.2, 0.3, S.cloth); }
            break;
        }
        case 'bench': B.box(0, 0.45, 0, 2, 0.1, 0.45, S.plank); B.box(-0.8, 0.22, 0, 0.12, 0.44, 0.4, S.beam); B.box(0.8, 0.22, 0, 0.12, 0.44, 0.4, S.beam); break;
        case 'lamp':
            B.box(0, 1.4, 0, 0.16, 2.8, 0.16, S.beam); B.box(0.35, 2.75, 0, 0.8, 0.1, 0.1, S.beam);
            B.color(1, 0.8, 0.5); B.box(0.7, 2.45, 0, 0.3, 0.4, 0.3, S.window); B.color(1, 1, 1); B.box(0.7, 2.7, 0, 0.36, 0.08, 0.36, S.iron);
            break;
        case 'forge':
            B.box(0, 0.55, 0, 2, 1.1, 1.6, S.field); B.box(0, 1.6, -0.6, 1.2, 2.2, 0.5, S.field); B.box(0, 3.4, -0.6, 0.7, 1.5, 0.5, S.field);
            B.color(1, 0.45, 0.15); B.box(0, 1.12, 0.1, 1.3, 0.05, 1.0, S.window); B.color(1, 1, 1);
            break;
        case 'anvil': B.cylinder(0, 0, 0, 0.35, 0.3, 0.5, 8, S.log, { cap: true }); B.box(0, 0.65, 0, 0.3, 0.3, 0.7, S.iron); B.box(0, 0.83, 0.05, 0.38, 0.12, 0.85, S.iron); break;
        case 'grindstone':
            B.box(-0.35, 0.5, 0, 0.12, 1, 0.12, S.beam); B.box(0.35, 0.5, 0, 0.12, 1, 0.12, S.beam);
            B.push(); B.translate(0, 0.75, 0); B.rotZ(Math.PI / 2); B.cylinder(0, -0.12, 0, 0.45, 0.45, 0.24, 14, S.field, { cap: true }); B.pop();
            break;
        case 'workbench': B.box(0, 0.9, 0, 2, 0.12, 0.9, S.plank); for (const [x, z] of [[-0.9, -0.35], [0.9, -0.35], [0.9, 0.35], [-0.9, 0.35]]) B.box(x, 0.45, z, 0.12, 0.9, 0.12, S.beam); B.box(-0.5, 1.0, 0, 0.5, 0.08, 0.2, S.iron); break;
        case 'smelter':
            B.cylinder(0, 0, 0, 1.0, 0.7, 1.6, 10, S.field); B.cylinder(0, 1.6, 0, 0.7, 0.3, 0.8, 10, S.field, { cap: true });
            B.color(1, 0.5, 0.15); B.box(0, 0.5, 0.92, 0.5, 0.4, 0.1, S.window); B.color(1, 1, 1);
            break;
        case 'tanning': B.box(-0.9, 1, 0, 0.1, 2, 0.1, S.beam); B.box(0.9, 1, 0, 0.1, 2, 0.1, S.beam); B.box(0, 1.9, 0, 2, 0.1, 0.1, S.beam); B.color(0.8, 0.65, 0.5); B.box(0, 1.15, 0, 1.5, 1.3, 0.04, S.hide); break;
        case 'cookpot': for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; B.beam([Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8], [0, 1.6, 0], 0.07); } B.cylinder(0, 0.7, 0, 0.35, 0.42, 0.5, 10, S.iron, { cap: true }); break;
        case 'campfire': case 'bigfire': {
            const r = p.type === 'bigfire' ? 1.6 : 0.65;
            for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; B.color(0.7, 0.7, 0.7); B.box(Math.cos(a) * r, 0.1, Math.sin(a) * r, 0.3, 0.22, 0.28, S.field); }
            B.color(0.4, 0.3, 0.25); for (let i = 0; i < 4; i++) B.beam([Math.cos(i * 1.6) * r * 0.7, 0.05, Math.sin(i * 1.6) * r * 0.7], [0, 0.45 * r, 0], 0.14 * r + 0.05);
            break;
        }
        case 'barrel': B.cylinder(0, 0, 0, 0.38, 0.42, 0.5, 10, S.plank); B.cylinder(0, 0.5, 0, 0.42, 0.38, 0.5, 10, S.plank, { cap: true }); B.cylinder(0, 0.3, 0, 0.42, 0.42, 0.06, 10, S.iron); B.cylinder(0, 0.75, 0, 0.42, 0.42, 0.06, 10, S.iron); break;
        case 'crate': B.box(0, 0.5, 0, 1, 1, 1, S.plank); break;
        case 'cart': B.box(0, 0.9, 0, 1.4, 0.15, 2.6, S.plank); B.box(0.7, 1.15, 0, 0.08, 0.5, 2.6, S.plank); B.box(-0.7, 1.15, 0, 0.08, 0.5, 2.6, S.plank);
            for (const sx of [-0.8, 0.8]) { B.push(); B.translate(sx, 0.55, 0.4); B.rotZ(Math.PI / 2); B.cylinder(0, -0.06, 0, 0.55, 0.55, 0.12, 12, S.plank, { cap: true }); B.pop(); }
            B.beam([0, 0.9, 1.3], [0, 0.4, 2.8], 0.1); break;
        case 'wagon': B.box(0, 1.3, 0, 1.7, 1.2, 2.6, S.plank); B.color(0.5, 0.15, 0.1); B.box(0, 2.0, 0, 1.8, 0.1, 2.8, S.cloth); B.color(1, 1, 1);
            for (const [sx, sz] of [[-0.9, 0.8], [0.9, 0.8], [-0.9, -0.9], [0.9, -0.9]]) { B.push(); B.translate(sx, 0.55, sz); B.rotZ(Math.PI / 2); B.cylinder(0, -0.06, 0, 0.55, 0.55, 0.12, 12, S.plank, { cap: true }); B.pop(); }
            break;
        case 'haystack': B.cylinder(0, 0, 0, 1.4, 1.0, 1.4, 10, S.straw); B.cylinder(0, 1.4, 0, 1.0, 0.1, 0.9, 10, S.straw); break;
        case 'fence': { const len = p.len || 10; for (let x = -len / 2; x <= len / 2; x += 2.5) B.box(x, 0.6, 0, 0.14, 1.2, 0.14, S.beam); B.box(0, 0.9, 0, len, 0.1, 0.06, S.plank); B.box(0, 0.5, 0, len, 0.1, 0.06, S.plank); break; }
        case 'woodpile': for (let i = 0; i < 12; i++) { B.push(); B.translate(-1.2 + (i % 6) * 0.48, 0.2 + Math.floor(i / 6) * 0.4, 0); B.rotX(Math.PI / 2); B.cylinder(0, -0.5, 0, 0.2, 0.2, 1, 7, S.log, { cap: true, capLayer: S.plank }); B.pop(); } break;
        case 'logpile': for (let i = 0; i < 7; i++) { B.push(); B.translate(0, 0.3 + (i < 4 ? 0 : 0.55), -1.2 + (i % 4) * 0.62 + (i < 4 ? 0 : 0.3)); B.rotZ(Math.PI / 2); B.cylinder(0, -2, 0, 0.3, 0.3, 4, 8, S.log, { cap: true, capLayer: S.plank }); B.pop(); } break;
        case 'signpost':
            B.box(0, 1.5, 0, 0.16, 3, 0.16, S.beam);
            (p.to || []).forEach((_, i) => { B.push(); B.translate(0, 2.6 - i * 0.35, 0); B.rotY(i * 1.4); B.box(0.6, 0, 0, 1.1, 0.24, 0.05, S.plank); B.pop(); });
            break;
        case 'block': B.cylinder(0, 0, 0, 0.45, 0.45, 0.7, 8, S.log, { cap: true, capLayer: S.plank }); break;
        case 'statue':
            B.box(0, 0.6, 0, 2.6, 1.2, 2.6, S.carved);
            B.cylinder(0, 1.2, 0, 0.7, 0.5, 2.6, 8, S.field); B.cylinder(0, 3.8, 0, 0.45, 0.4, 0.7, 8, S.field, { cap: true });
            B.beam([0, 3.4, 0], [1.2, 4.6, 0.2], 0.25, S.field); B.beam([0, 3.4, 0], [-1, 2.4, 0.3], 0.25, S.field);
            break;
        case 'totem':
            B.box(0, 0.3, 0, 2.2, 0.6, 2.2, S.flag);
            B.push(); B.scale(1, 1, 0.6); B.cylinder(0, 0.5, 0, 0.9, 0.6, 5, 7, S.carved, { cap: true }); B.pop();
            B.color(0.6, 0.85, 1.0); B.box(0, 3.4, 0.38, 0.9, 0.9, 0.04, S.window); B.color(1, 1, 1);
            break;
        case 'sigilstone': {
            // three leaning slabs around a round plinth; a ring of storm-light hangs between them
            B.cylinder(0, 0, 0, 2.6, 2.5, 0.35, 12, S.flag, { cap: true });
            for (let i = 0; i < 3; i++) {
                const a = i * Math.PI * 2 / 3;
                B.push(); B.translate(Math.sin(a) * 2.6, 0, Math.cos(a) * 2.6); B.rotY(a);
                B.push(); B.rotX(-0.08); B.box(0, 2.3, 0, 1.2, 4.6, 0.55, S.carved); B.pop();
                B.color(0.55, 0.8, 1.0);
                B.box(0, 3.2, -0.3, 0.5, 0.5, 0.02, S.window);
                B.box(0, 1.9, -0.3, 0.12, 1.4, 0.02, S.window);
                B.color(1, 1, 1);
                B.pop();
            }
            B.color(0.55, 0.8, 1.0);
            for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; B.box(Math.sin(a) * 1.1, 2.6 + Math.cos(a) * 1.1, 0, 0.5, 0.08, 0.08, S.window); }
            B.color(1, 1, 1);
            break;
        }
        case 'mound':
            B.color(0.6, 0.55, 0.45);
            B.cylinder(0, -1, 0, 12, 4, 4.5, 16, S.turf, { cap: true, capLayer: S.field });
            B.color(1, 1, 1);
            for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; B.box(Math.cos(a) * 14, 1.2, Math.sin(a) * 14, 0.8, 2.4 + (i % 3) * 0.6, 0.6, S.carved); }
            B.box(0, 3.6, 0, 3.4, 0.4, 1.6, S.carved);
            break;
        case 'rubble': for (let i = 0; i < 6; i++) { B.color(0.85, 0.85, 0.85); B.push(); B.translate((rnd() - 0.5) * 3, 0.25, (rnd() - 0.5) * 3); B.rotY(rnd() * 3); B.box(0, 0, 0, 0.6 + rnd(), 0.5 + rnd() * 0.5, 0.6 + rnd() * 0.6, S.masonry); B.pop(); } break;
        case 'tent': tent(B, { w: 4, d: 3.5, h: 2.2 }); break;
        case 'palisade': { const r = p.r || 14; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.08) continue; const x = Math.cos(a) * r, z = Math.sin(a) * r; B.cylinder(x, ground(p.x + x, p.z + z) - p.y - 0.5, z, 0.22, 0.05, 3.6 + (i % 3) * 0.3, 6, S.log); } break; }
        case 'tusks': for (const side of [-1, 1]) for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6; B.color(0.9, 0.86, 0.76); B.beam([side * (1 + Math.sin(t0 * 2) * 1.2), t0 * 4, Math.cos(t0 * 2.4) * 0.5], [side * (1 + Math.sin(t1 * 2) * 1.2), t1 * 4, Math.cos(t1 * 2.4) * 0.5], 0.35 - k * 0.04, S.plaster); } break;
        case 'spring': B.color(0.7, 0.68, 0.6); B.cylinder(0, -0.2, 0, 3.4, 3, 0.35, 14, S.field, { cap: false }); break;
        case 'wreck': {
            B.color(0.55, 0.5, 0.45);
            for (let i = 0; i < 9; i++) { const z = -7 + i * 1.7; B.push(); B.translate(0, 0, z); B.rotZ(0.25); B.beam([-2.4, 0, 0], [-1.2, 2.6, 0], 0.3); B.beam([2.4, 0, 0], [1.2, 2.6, 0], 0.3); B.beam([-2.4, 0, 0], [2.4, 0, 0], 0.3); B.pop(); }
            B.push(); B.rotZ(0.25); B.box(-2.2, 0.8, 0, 0.15, 1.8, 13, S.plank); B.box(0, -0.1, 0, 4.5, 0.2, 14, S.plank); B.pop();
            B.beam([0.5, 0, 2], [3, 7, 4], 0.35);
            break;
        }
        case 'cave_mouth': {
            for (let i = 0; i < 9; i++) {
                const a = (i / 8) * Math.PI;
                B.color(0.8, 0.78, 0.75);
                B.push(); B.translate(Math.cos(a) * 3.4, Math.sin(a) * 3.6 - 0.4, -0.5 - rnd() * 0.8); B.rotY(rnd() * 3); B.rotX(rnd());
                B.box(0, 0, 0, 2.2 + rnd(), 1.8 + rnd(), 2.4, S.field);
                B.pop();
            }
            B.color(0.04, 0.04, 0.05); B.quad([-2.6, -0.2, -0.6], [2.6, -0.2, -0.6], [2.6, 3.4, -0.6], [-2.6, 3.4, -0.6], S.iron);
            break;
        }
        case 'barrow_door': {
            B.box(0, -0.2, 2.5, 7, 0.4, 7, S.flag);
            for (const x of [-2.2, 2.2]) B.box(x, 2.2, 0, 1.1, 4.4, 1.1, S.carved);
            B.box(0, 4.7, 0, 6.4, 0.9, 1.4, S.carved);
            B.push(); B.translate(0, 5.6, 0); B.gableRoof(5, 2.4, 0, 1.2, 0.3, S.flag, 0.3); B.pop();
            B.color(0.35, 0.33, 0.32); B.box(0, 1.9, -0.2, 3.2, 3.8, 0.3, S.carved);
            B.color(0.5, 0.75, 1.0); B.box(0, 3.4, -0.02, 0.6, 0.6, 0.02, S.window); B.color(1, 1, 1);
            for (let i = 0; i < 4; i++) B.box(0, -0.15 - i * 0.3, 4 + i * 0.7, 4, 0.3, 0.7, S.flag);
            break;
        }
        case 'mine_door':
            B.box(-1.8, 1.6, 0, 0.35, 3.2, 0.35, S.log); B.box(1.8, 1.6, 0, 0.35, 3.2, 0.35, S.log); B.box(0, 3.3, 0, 4.2, 0.4, 0.4, S.log);
            B.color(0.05, 0.05, 0.05); B.quad([-1.6, 0, -0.3], [1.6, 0, -0.3], [1.6, 3.1, -0.3], [-1.6, 3.1, -0.3], S.iron); B.color(1, 1, 1);
            B.box(-0.5, 0.05, 3, 0.1, 0.1, 6, S.iron); B.box(0.5, 0.05, 3, 0.1, 0.1, 6, S.iron);
            for (let i = 0; i < 4; i++) B.box(0, 0.02, 0.5 + i * 1.5, 1.4, 0.06, 0.2, S.beam);
            break;
        case 'deep_door':
            B.cylinder(0, 0, -0.5, 4.6, 4.6, 0.8, 20, S.carved, { cap: true });
            B.push(); B.translate(0, 0, 0.4); B.rotX(Math.PI / 2);
            B.cylinder(0, -0.4, 0, 3.4, 3.4, 0.5, 24, S.brass, { cap: true }); B.pop();
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.box(Math.cos(a) * 2.6, 3.4 + Math.sin(a) * 2.6, 0.65, 0.5, 0.5, 0.2, S.brass); }
            B.box(0, 0, 3, 6, 0.4, 6, S.flag);
            break;
        case 'temple_door':
            for (let i = 0; i < 8; i++) B.box(0, -1.6 + i * 0.4, 6 - i * 0.8, 10 - i * 0.4, 0.4, 0.8, S.flag);
            for (const x of [-4, -2, 2, 4]) B.cylinder(x, 1.6, 0, 0.6, 0.55, 7, 10, S.carved, { cap: true });
            B.box(0, 8.8, 0, 11, 1.2, 2.4, S.carved);
            B.color(0.03, 0.03, 0.04); B.quad([-1.6, 1.6, -0.6], [1.6, 1.6, -0.6], [1.6, 6, -0.6], [-1.6, 6, -0.6], S.iron);
            break;
        case 'fort':
            stoneBuilding(B, { w: 16, d: 12, h: 8, roof: 'flat', y: 0, foot: -1, type: 'keep' }, rnd);
            break;
        case 'brazier':
            for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; B.beam([Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], [Math.cos(a) * 0.2, 1.0, Math.sin(a) * 0.2], 0.06, S.iron); }
            B.cylinder(0, 0.95, 0, 0.25, 0.5, 0.35, 10, S.iron);
            B.color(1, 0.5, 0.15); B.cylinder(0, 1.25, 0, 0.42, 0.42, 0.01, 10, S.window, { cap: true }); B.color(1, 1, 1);
            break;
        case 'stepsmarker': B.cylinder(0, 0, 0, 0.5, 0.4, 2.4, 8, S.carved, { cap: true }); B.box(0, 2.5, 0, 0.9, 0.2, 0.9, S.flag); break;
        case 'gatehouse':
            for (const x of [-4.6, 4.6]) { B.cylinder(x, -1, 0, 2.6, 2.4, 10, 12, S.masonry); B.cylinder(x, 9, 0, 2.8, 2.8, 0.6, 12, S.flag, { cap: true }); }
            B.box(0, 7.5, 0, 7, 2.2, 2.6, S.masonry);
            for (let x = -3; x <= 3; x += 1.5) B.box(x, 9, 1.1, 0.7, 0.8, 0.4, S.masonry);
            B.color(0.6, 0.12, 0.1); B.box(0, 5.6, 1.35, 1.5, 3.2, 0.04, S.cloth);
            break;
        case 'tower_small':
            B.cylinder(0, -1.5, 0, 3.2, 3, 12, 12, S.masonry);
            B.cylinder(0, 10.5, 0, 3.4, 3.4, 0.5, 12, S.flag, { cap: true });
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.box(Math.cos(a) * 3.1, 11.4, Math.sin(a) * 3.1, 0.8, 0.9, 0.8, S.masonry); }
            break;
        case 'terrace': {
            const r = p.r - 2;
            for (let i = 0; i < 40; i++) {
                const a0 = i / 40 * Math.PI * 2, a1 = (i + 1) / 40 * Math.PI * 2;
                if (Math.sin((a0 + a1) / 2) > 0.93) continue;   // the gap at the head of the stairs (south)
                const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
                B.beam([x0, 0.45, z0], [x1, 0.45, z1], 0.7, S.masonry);
            }
            break;
        }
        case 'stairs': {
            const n = 22;
            for (let i = 0; i < n; i++) {
                const z = 13 - (i + 0.5) * (26 / n);
                const gy = ground(p.x, p.z + z) - p.y;
                B.box(0, gy - 0.4, z, p.wid, 1, 26 / n + 0.05, S.flag);
                if (i % 4 === 0) { B.box(-p.wid / 2 - 0.3, gy + 0.3, z, 0.4, 0.8, 0.5, S.masonry); B.box(p.wid / 2 + 0.3, gy + 0.3, z, 0.4, 0.8, 0.5, S.masonry); }
            }
            break;
        }
        case 'stairs_stone': for (let i = 0; i < 6; i++) B.box(0, -0.6 + i * 0.25, 4 - i * 0.6, 4, 0.25, 0.6, S.flag); break;
        case 'banner': B.box(0, 3.5, 0, 0.15, 7, 0.15, S.beam); B.color(...new THREE.Color(p.color || 0xaa2222).toArray()); B.box(0.8, 5, 0, 1.4, 3, 0.04, S.cloth); break;
        case 'dock': { const len = p.len || 20; B.box(0, 0.6, -len / 2, 3, 0.2, len, S.plank); for (let z = 0; z < len; z += 3) { B.cylinder(-1.4, -6, -z, 0.18, 0.18, 6.6, 6, S.log); B.cylinder(1.4, -6, -z, 0.18, 0.18, 6.6, 6, S.log); } break; }
        case 'boat': B.box(0, 0.4, 0, 1.6, 0.6, 5, S.plank); B.box(0, 0.75, 2.3, 0.8, 0.2, 0.8, S.plank); B.beam([0, 0.5, 0], [0, 4.5, 0], 0.15); break;
        case 'bridge': {
            const len = p.len;
            B.box(0, -0.3, 0, 6, 0.6, len, S.flag);
            B.box(3.05, 0.5, 0, 0.3, 1.0, len, S.masonry); B.box(-3.05, 0.5, 0, 0.3, 1.0, len, S.masonry);
            for (const z of [-len / 2 + 1, len / 2 - 1]) for (const x of [-2.6, 2.6]) B.cylinder(x, -8, z, 0.9, 0.9, 7.8, 10, S.masonry);
            B.box(0, -1.1, 0, 5.8, 1.0, len * 0.6, S.masonry);
            break;
        }
        case 'eldertree': break;   // drawn by the vegetation layer
        case 'waterwheel': break;  // animated separately
        default: break;
    }
    B.pop();
}

export function waterwheelGeometry() {
    const B = new Builder();
    B.color(1, 1, 1);
    B.push(); B.rotZ(Math.PI / 2); B.cylinder(0, -1.2, 0, 0.35, 0.35, 2.4, 8, S.log, { cap: true }); B.pop();
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        B.push(); B.rotX(a);
        B.box(0, 2.4, 0, 1.8, 1.2, 0.12, S.plank);
        B.beam([-0.8, 0, 0], [-0.8, 2.9, 0], 0.14); B.beam([0.8, 0, 0], [0.8, 2.9, 0], 0.14);
        B.pop();
    }
    return B.geometry();
}

export class StructuresView {
    constructor(scene, renderer, settlements, terrain, maps, veg) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'structures';
        scene.add(this.group);
        this.S = settlements;
        this.T = terrain;
        this.tex = makeStructureTextures(256, Math.min(8, renderer.maxAniso));
        this.material = makeStructureMaterial(this.tex, maps.masks);
        this.wheels = [];
        this.meshes = [];
        const ground = (x, z) => terrain.heightAt(x, z);
        // one builder per location (so frustum culling works per settlement)
        const builders = new Map();
        const get = (loc) => { if (!builders.has(loc)) builders.set(loc, new Builder()); return builders.get(loc); };
        let k = 0;
        for (const b of settlements.buildings) buildBuilding(get(b.loc), b, mulberry32(k++ * 31 + 7));
        for (const p of settlements.props) {
            const loc = p.loc || `misc${Math.floor((p.x + 1536) / 256)}_${Math.floor((p.z + 1536) / 256)}`;
            buildProp(get(loc), p, ground, mulberry32(k++ * 17 + 3));
            if (p.type === 'waterwheel') {
                const m = new THREE.Mesh(this.wheelGeo || (this.wheelGeo = waterwheelGeometry()), this.material);
                m.position.set(p.x, p.y + 1.4, p.z);
                m.rotation.order = 'YXZ'; m.rotation.y = p.rot;
                m.castShadow = true;
                this.group.add(m);
                this.wheels.push(m);
            }
            if (p.type === 'eldertree' && veg) veg.addSpecial('great', p.x, p.y, p.z, 1, [1.0, 0.7, 0.82]);
        }
        for (const w of settlements.walls) {
            const B = get(w.loc);
            for (const sg of w.segs) {
                B.push(); B.translate(sg.mx, sg.y0, sg.mz); B.rotY(sg.rot);
                if (w.style === 'palisade') {
                    for (let z = -sg.len / 2; z < sg.len / 2; z += 0.5) B.cylinder(0, 0, z, 0.25, 0.08, w.h + 1 + Math.sin(z * 3) * 0.3, 6, S.log);
                } else {
                    B.box(0, (w.h + 1) / 2, 0, w.thick, w.h + 1, sg.len + 0.6, S.masonry);
                    for (let z = -sg.len / 2 + 0.6; z < sg.len / 2; z += 1.8) B.box(0, w.h + 1.45, z, w.thick + 0.2, 0.9, 0.9, S.masonry);
                    B.box(0, w.h + 0.95, 0, w.thick + 0.4, 0.15, sg.len + 0.6, S.flag);
                }
                B.pop();
            }
        }
        for (const [loc, B] of builders) {
            if (B.empty) continue;
            const mesh = new THREE.Mesh(B.geometry(), this.material);
            mesh.castShadow = true; mesh.receiveShadow = true;
            mesh.name = `struct:${loc}`;
            mesh.matrixAutoUpdate = false;
            this.group.add(mesh);
            this.meshes.push(mesh);
        }
        this.tris = this.meshes.reduce((a, m) => a + m.geometry.index.count / 3, 0);
    }

    update(dt) {
        for (const w of this.wheels) w.rotation.x -= dt * 0.6;
    }
}
