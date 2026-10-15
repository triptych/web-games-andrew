// The level as meshes: one merged geometry for every wall, floor, ceiling and rooftop, drawn by a
// single ShaderMaterial whose per-vertex material id picks a procedural texture written in GLSL.
// Also: the baked lightmap, liquids, keycard doors, neon signs and the exit pad.

import * as THREE from 'three';
import { CELL, SKY } from '../config.js';
import { MAT } from '../sim/level.js';
import { SU, NOISE, LIGHTS, FOG } from './shaderlib.js';

const LM_RES = 4;   // lightmap texels per cell

// ==================================================================== geometry

class Builder {
    constructor() { this.pos = []; this.nrm = []; this.mat = []; this.ao = []; this.base = []; this.idx = []; }
    /** A quad a-b-c-d (any winding) facing n. Flips the winding if needed, so it always faces n. */
    quad(a, b, c, d, n, mat, ao = [1, 1, 1, 1], base = 0) {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
        const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
        const v = this.pos.length / 3;
        for (const p of [a, b, c, d]) { this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.mat.push(mat); this.base.push(base); }
        this.ao.push(...ao);
        if (flip) this.idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
        else this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
        g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
        g.setAttribute('aAO', new THREE.Float32BufferAttribute(this.ao, 1));
        g.setAttribute('aBase', new THREE.Float32BufferAttribute(this.base, 1));
        g.setIndex(this.idx);
        g.computeBoundingSphere();
        return g;
    }
}

const THEME_RISER = { city: MAT.concrete, mall: MAT.mallwall, sewer: MAT.brick, ship: MAT.chrome, core: MAT.chrome };

function buildWorldGeometry(L) {
    const B = new Builder();
    const { W, H } = L;
    const solidAt = (x, z) => x < 0 || z < 0 || x >= W || z >= H || L.solid[z * W + x];
    const topAt = (x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? (L.outdoor ? 30 : 0) : L.top[z * W + x];
    const riser = THEME_RISER[L.theme];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        const i = z * W + x;
        const x0 = x * CELL, x1 = x0 + CELL, z0 = z * CELL, z1 = z0 + CELL;
        if (!L.solid[i]) {
            const f = L.floor[i], c = L.ceil[i];
            // floor, with ambient occlusion at the corners next to walls
            const aoAt = (vx, vz) => {
                let n = 0;
                for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (solidAt(vx + ox, vz + oz)) n++;
                return 1 - n * 0.16;
            };
            const fmat = L.liquid[i] ? MAT.concrete : L.fmat[i];
            B.quad([x0, f, z0], [x1, f, z0], [x1, f, z1], [x0, f, z1], [0, 1, 0], fmat, [aoAt(x, z), aoAt(x + 1, z), aoAt(x + 1, z + 1), aoAt(x, z + 1)], f);
            if (!L.outdoor && c < SKY) B.quad([x0, c, z0], [x1, c, z0], [x1, c, z1], [x0, c, z1], [0, -1, 0], L.cmat[i], [1, 1, 1, 1], f);
            for (const [dx, dz] of DIRS) {
                const nx = x + dx, nz = z + dz;
                const j = nz * W + nx;
                // the face sits on the shared edge, facing back into this cell
                const n = [-dx, 0, -dz];
                const ex = dx > 0 ? x1 : dx < 0 ? x0 : null, ez = dz > 0 ? z1 : dz < 0 ? z0 : null;
                const edge = (y0, y1) => ex !== null
                    ? [[ex, y0, z0], [ex, y0, z1], [ex, y1, z1], [ex, y1, z0]]
                    : [[x0, y0, ez], [x1, y0, ez], [x1, y1, ez], [x0, y1, ez]];
                if (solidAt(nx, nz)) {
                    const top = L.outdoor ? Math.max(f + 4, topAt(nx, nz)) : c;
                    const wm = (nx < 0 || nz < 0 || nx >= W || nz >= H) ? L.wmat[i] || MAT.concrete : L.wmat[j];
                    const q = edge(f, top);
                    B.quad(q[0], q[1], q[2], q[3], n, wm, [1, 1, 1, 1], f);
                } else {
                    const fj = L.floor[j];
                    if (fj > f + 1e-3) {
                        const m = L.crate[j] ? MAT.crate : L.platform?.[j] ? MAT.metal : riser;
                        const q = edge(f, fj);
                        B.quad(q[0], q[1], q[2], q[3], n, m, [1, 1, 1, 1], f);
                    }
                    const cj = L.ceil[j];
                    if (!L.outdoor && cj < c - 1e-3) {
                        const q = edge(cj, c);
                        B.quad(q[0], q[1], q[2], q[3], n, L.cmat[i] === MAT.ceilpanel ? MAT.mallwall : L.cmat[i], [1, 1, 1, 1], cj);
                    }
                }
            }
        } else if (L.outdoor) {
            // rooftops, and faces between towers of different heights
            const t = topAt(x, z);
            const touchesOpen = DIRS.some(([dx, dz]) => !solidAt(x + dx, z + dz));
            const nearOpen = touchesOpen || [[1, 1], [1, -1], [-1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => !solidAt(x + dx, z + dz));
            if (!nearOpen && ((x + z) % 2)) continue;   // the deep interior of a block is only seen from the air
            B.quad([x0, t, z0], [x1, t, z0], [x1, t, z1], [x0, t, z1], [0, 1, 0], MAT.concrete, [0.8, 0.8, 0.8, 0.8], t);
            for (const [dx, dz] of DIRS) {
                const nx = x + dx, nz = z + dz;
                if (!solidAt(nx, nz)) continue;
                const tn = topAt(nx, nz);
                if (tn >= t - 0.01) continue;
                const n = [dx, 0, dz];
                const ex = dx > 0 ? x1 : dx < 0 ? x0 : null, ez = dz > 0 ? z1 : dz < 0 ? z0 : null;
                const q = ex !== null ? [[ex, tn, z0], [ex, tn, z1], [ex, t, z1], [ex, t, z0]] : [[x0, tn, ez], [x1, tn, ez], [x1, t, ez], [x0, t, ez]];
                B.quad(q[0], q[1], q[2], q[3], n, L.wmat[i], [1, 1, 1, 1], tn);
            }
        }
    }
    return B.geometry();
}

// ==================================================================== the world shader

const WORLD_VERT = /* glsl */`
attribute float aMat;
attribute float aAO;
attribute float aBase;
varying vec3 vW;
varying vec3 vN;
varying float vMat;
varying float vAO;
varying float vBase;
varying float vDist;
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz; vN = normal; vMat = aMat; vAO = aAO; vBase = aBase;
    vec4 mv = viewMatrix * wp;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
}`;

const WORLD_FRAG = /* glsl */`
uniform float uTime;
uniform float uSkyLight;
varying vec3 vW;
varying vec3 vN;
varying float vMat;
varying float vAO;
varying float vBase;
varying float vDist;
${NOISE}
${LIGHTS}
${FOG}

float tiles(vec2 uv, vec2 size, float gap) {
    vec2 f = fract(uv / size);
    vec2 e = min(f, 1.0 - f) * size;
    return smoothstep(0.0, gap, min(e.x, e.y));
}
vec2 brickUV(vec2 uv, vec2 size) {
    float row = floor(uv.y / size.y);
    return vec2(uv.x + mod(row, 2.0) * size.x * 0.5, uv.y);
}

// albedo, emissive, height (for bump), gloss
void surface(float m, vec2 uv, vec3 wp, vec3 n, out vec3 alb, out vec3 emi, out float h, out float gloss) {
    emi = vec3(0.0); gloss = 0.0;
    float nz = fbm(uv * 1.7);
    if (m < 0.5) {                       // asphalt
        float sp = hash12(floor(uv * 40.0));
        alb = vec3(0.045, 0.045, 0.055) * (0.75 + 0.5 * nz) + step(0.985, sp) * 0.05;
        vec2 c = cells(uv * 0.35);
        float crack = 1.0 - smoothstep(0.0, 0.04, abs(c.x - 0.55));
        alb *= 1.0 - crack * 0.6;
        float puddle = smoothstep(0.62, 0.7, fbm(uv * 0.18 + 3.1));
        gloss = puddle * 0.9;
        alb *= 1.0 - puddle * 0.4;
        h = nz * 0.4 - crack * 0.5;
    } else if (m < 1.5) {                // sidewalk
        float t = tiles(uv, vec2(1.5), 0.05);
        float tint = hash12(floor(uv / 1.5));
        alb = vec3(0.16, 0.15, 0.17) * (0.8 + 0.25 * tint) * (0.85 + 0.3 * nz);
        alb *= mix(0.55, 1.0, t);
        float gum = step(0.993, hash12(floor(uv * 6.0)));
        alb = mix(alb, vec3(0.05), gum);
        h = t * 0.6 + nz * 0.2;
    } else if (m < 2.5) {                // building facade with windows
        vec2 cellw = vec2(3.0, 3.5);
        vec2 id = floor(uv / cellw);
        vec2 f = fract(uv / cellw);
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.85);
        float ground = step(uv.y - vBase, 3.2);
        float lit = step(0.68, hash12(id + 7.3));
        float flick = 0.85 + 0.15 * sin(uTime * (2.0 + 9.0 * hash12(id)) + hash12(id * 3.1) * 40.0);
        vec3 wcol = mix(vec3(1.0, 0.75, 0.4), vec3(0.45, 0.7, 1.0), step(0.6, hash12(id + 2.1)));
        wcol = mix(wcol, vec3(1.0, 0.3, 0.7), step(0.93, hash12(id + 5.7)));
        float blind = step(f.y, 0.25 + 0.6 * hash12(id + 1.7));
        vec3 wall = mix(vec3(0.12, 0.1, 0.12), vec3(0.2, 0.13, 0.12), step(0.5, hash12(floor(wp.xz / 12.0))));
        wall *= 0.8 + 0.4 * nz;
        // brick or panel texture between windows
        vec2 b = brickUV(uv, vec2(0.6, 0.25));
        wall *= mix(0.75, 1.0, tiles(b, vec2(0.6, 0.25), 0.03));
        alb = mix(wall, vec3(0.03, 0.04, 0.06), win * (1.0 - ground));
        emi = win * (1.0 - ground) * lit * wcol * flick * (0.55 + 0.45 * blind) * 0.75;
        gloss = win * (1.0 - ground) * 0.8;
        // ground floor: roller shutters
        float shutter = ground * step(0.1, f.x) * step(f.x, 0.9);
        alb = mix(alb, vec3(0.18, 0.18, 0.2) * (0.7 + 0.3 * step(0.5, fract((uv.y - vBase) * 6.0))), shutter);
        h = (1.0 - win) * 0.6 + nz * 0.2 + shutter * step(0.5, fract((uv.y - vBase) * 6.0)) * 0.3;
    } else if (m < 3.5) {                // crate
        vec2 f = fract(uv / 1.5);
        float frame = 1.0 - step(0.08, f.x) * step(f.x, 0.92) * step(0.08, f.y) * step(f.y, 0.92);
        float plank = smoothstep(0.0, 0.02, abs(fract(f.y * 5.0) - 0.5) - 0.46);
        float brace = 1.0 - smoothstep(0.0, 0.05, abs(f.x - f.y));
        alb = vec3(0.32, 0.2, 0.09) * (0.75 + 0.35 * fbm(vec2(uv.x * 0.6, uv.y * 8.0)));
        alb = mix(alb, vec3(0.42, 0.28, 0.12), max(frame, brace));
        alb *= 1.0 - plank * 0.4;
        float stencil = step(0.4, f.x) * step(f.x, 0.6) * step(0.4, f.y) * step(f.y, 0.6) * step(0.5, hash12(floor(uv / 1.5)));
        alb = mix(alb, vec3(0.9, 0.7, 0.1), stencil * 0.6);
        h = max(frame, brace) * 0.7 - plank * 0.3;
    } else if (m < 4.5) {                // mall tile: checkerboard
        vec2 id = floor(uv / 1.0);
        float ck = mod(id.x + id.y, 2.0);
        float t = tiles(uv, vec2(1.0), 0.02);
        alb = mix(vec3(0.03, 0.03, 0.04), vec3(0.55, 0.52, 0.5), ck) * mix(0.6, 1.0, t) * (0.92 + 0.1 * nz);
        gloss = 0.75;
        h = t * 0.3;
    } else if (m < 5.5) {                // mall wall: pastel stucco with an 80s stripe
        float y = uv.y - vBase;
        alb = vec3(0.55, 0.45, 0.5) * (0.88 + 0.2 * fbm(uv * 4.0));
        float s1 = step(1.0, y) * step(y, 1.25), s2 = step(1.35, y) * step(y, 1.45);
        alb = mix(alb, vec3(0.9, 0.2, 0.55), s1);
        alb = mix(alb, vec3(0.1, 0.75, 0.75), s2);
        h = fbm(uv * 9.0) * 0.4 + (s1 + s2) * 0.3;
    } else if (m < 6.5) {                // shopfront glass
        float y = uv.y - vBase;
        vec2 f = fract(vec2(uv.x / 1.5, y / 3.0));
        float mull = 1.0 - step(0.04, f.x) * step(f.x, 0.96);
        float glass = step(0.12, y) * step(y, 3.0) * (1.0 - mull);
        vec2 id = floor(vec2(uv.x / 6.0, 0.0));
        vec3 inside = mix(vec3(0.6, 0.25, 0.8), vec3(0.2, 0.7, 0.8), hash12(id)) * (0.3 + 0.2 * fbm(uv * 0.8 + 3.0));
        alb = mix(vec3(0.15, 0.15, 0.17), vec3(0.02, 0.03, 0.05), glass);
        emi = glass * inside * 0.7;
        float neonStrip = step(3.05, y) * step(y, 3.2);
        emi += neonStrip * mix(vec3(1.0, 0.2, 0.7), vec3(0.2, 0.9, 1.0), hash12(id + 3.0)) * 2.0;
        gloss = glass;
        h = mull * 0.6;
    } else if (m < 7.5) {                // ceiling panels
        float t = tiles(uv, vec2(1.5), 0.04);
        vec2 id = floor(uv / 1.5);
        float lamp = step(0.88, hash12(id)) * step(mod(id.x, 3.0), 0.5);
        alb = vec3(0.35, 0.34, 0.33) * mix(0.5, 1.0, t) * (0.8 + 0.3 * vnoise(uv * 20.0));
        float flick = step(0.2, sin(uTime * 23.0 + hash12(id) * 50.0) + 0.95);
        emi = lamp * t * vec3(1.0, 0.95, 0.85) * 1.5 * flick;
        h = t * 0.4;
    } else if (m < 8.5) {                // sewer floor
        alb = vec3(0.12, 0.13, 0.11) * (0.7 + 0.5 * nz);
        float wet = smoothstep(0.45, 0.6, fbm(uv * 0.4));
        alb = mix(alb, vec3(0.08, 0.12, 0.06), wet);
        gloss = wet * 0.9;
        h = nz * 0.5;
    } else if (m < 9.5) {                // brick
        vec2 b = brickUV(uv, vec2(0.5, 0.22));
        float t = tiles(b, vec2(0.5, 0.22), 0.025);
        float tint = hash12(floor(b / vec2(0.5, 0.22)));
        alb = mix(vec3(0.07, 0.06, 0.05), vec3(0.32, 0.15, 0.1) * (0.7 + 0.5 * tint), t) * (0.85 + 0.3 * nz);
        float y = uv.y - vBase;
        float slime = smoothstep(0.2, 0.0, y - fbm(vec2(uv.x * 2.0, 0.0)) * 1.4);
        alb = mix(alb, vec3(0.06, 0.16, 0.04), slime * 0.8);
        emi = vec3(0.05, 0.25, 0.04) * slime * (0.5 + 0.5 * sin(uTime * 2.0 + uv.x)) * 0.4;
        gloss = slime * 0.8;
        h = t * 0.8 + nz * 0.2;
    } else if (m < 10.5) {               // alien flesh: bulging cells, glowing veins in the creases
        vec2 q = uv * 0.9 + vec2(0.0, sin(uTime * 0.5 + uv.x * 0.7) * 0.04);
        vec2 c = cells(q);
        vec2 c2 = cells(q * 2.3 + 5.0);
        float bulge = 1.0 - smoothstep(0.0, 0.75, c.x);
        float crease = smoothstep(0.5, 0.75, c.x);
        float pulse = 0.5 + 0.5 * sin(uTime * 2.5 - length(wp.xz) * 0.25 + c.y * 6.0);
        alb = mix(vec3(0.12, 0.02, 0.04), vec3(0.45, 0.12, 0.16), bulge) * (0.75 + 0.35 * fbm(uv * 4.0));
        alb = mix(alb, vec3(0.3, 0.06, 0.2), smoothstep(0.55, 0.8, c2.x) * 0.5);
        emi = crease * mix(vec3(0.5, 0.04, 0.35), vec3(0.9, 0.2, 0.08), c.y) * (0.25 + 0.6 * pulse);
        gloss = 0.6 + 0.3 * bulge;
        h = bulge * 0.9 + (1.0 - c2.x) * 0.2;
    } else if (m < 11.5) {               // hex floor
        vec2 p = uv * 0.8;
        vec2 r = vec2(1.0, 1.7320508);
        vec2 a = mod(p, r) - r * 0.5, b = mod(p - r * 0.5, r) - r * 0.5;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        vec2 ag = abs(g);
        float d = max(dot(ag, normalize(vec2(1.0, 1.7320508))), ag.x);   // hex distance, edges at 0.5
        float seam = smoothstep(0.44, 0.49, d);
        vec2 id = p - g;
        alb = vec3(0.1, 0.09, 0.14) * (0.7 + 0.5 * hash12(floor(id * 3.0)));
        float flow = 0.5 + 0.5 * sin(uTime * 2.0 + id.x * 0.7 + id.y * 0.5);
        emi = seam * mix(vec3(0.2, 0.6, 1.0), vec3(0.8, 0.2, 1.0), hash12(floor(id))) * (0.5 + flow) * 0.9;
        gloss = 0.85;
        h = (1.0 - seam) * 0.5;
    } else if (m < 12.5) {               // purple chrome panels
        float y = uv.y - vBase;
        float rib = smoothstep(0.0, 0.03, abs(fract(uv.x / 0.75) - 0.5) - 0.45);
        float band = step(0.5, fract(y / 4.0 + 0.1)) * 0.0;
        alb = vec3(0.16, 0.1, 0.22) * (0.8 + 0.4 * fbm(uv * 0.7)) * (1.0 - rib * 0.5);
        float strip = step(2.4, y) * step(y, 2.55);
        emi = strip * mix(vec3(0.9, 0.2, 1.0), vec3(0.2, 0.9, 1.0), step(0.5, hash12(floor(wp.xz / 9.0)))) * (1.2 + 0.6 * sin(uTime * 4.0 + uv.x)) + band;
        gloss = 0.9;
        h = 1.0 - rib;
    } else if (m < 13.5) {               // diamond plate
        vec2 p = uv * 5.0;
        vec2 q = fract(vec2(p.x + p.y, p.x - p.y) * 0.5) - 0.5;
        float dia = smoothstep(0.12, 0.05, abs(q.x) + abs(q.y) * 3.0);
        alb = vec3(0.3, 0.3, 0.33) * (0.75 + 0.3 * nz) + dia * 0.06;
        gloss = 0.6;
        h = dia;
    } else if (m < 18.5) {               // concrete
        alb = vec3(0.2, 0.19, 0.2) * (0.7 + 0.5 * nz);
        float stain = smoothstep(0.55, 0.75, fbm(uv * 0.5 + 9.0));
        alb *= 1.0 - stain * 0.35;
        float y = uv.y - vBase;
        // graffiti tags low on the walls
        float tag = step(0.82, fbm(vec2(uv.x * 0.9, y * 1.6) + 4.0)) * step(y, 2.4) * step(0.5, abs(n.y) < 0.5 ? 1.0 : 0.0);
        alb = mix(alb, mix(vec3(0.9, 0.1, 0.6), vec3(0.1, 0.8, 0.9), step(0.5, hash12(floor(uv / 4.0)))), tag * 0.8);
        h = nz * 0.4;
    } else {                             // chrome with neon stripes
        float y = uv.y - vBase;
        alb = vec3(0.14, 0.12, 0.18) * (0.85 + 0.3 * nz);
        float s = step(0.92, fract(y / 1.2 + 0.05));
        emi = s * mix(vec3(1.0, 0.15, 0.6), vec3(0.15, 0.8, 1.0), step(0.5, hash12(vec2(floor(uv.x / 6.0), 3.0)))) * 2.0;
        gloss = 0.9;
        h = 1.0 - s;
    }
}

void main() {
    vec3 n = normalize(vN);
    vec2 uv = abs(n.y) > 0.5 ? vW.xz : vec2(dot(vW.xz, vec2(-n.z, n.x)), vW.y);
    vec3 alb, emi; float h, gloss;
    surface(floor(vMat + 0.5), uv, vW, n, alb, emi, h, gloss);
    // derivative bump mapping from the height
    vec3 dpx = dFdx(vW), dpy = dFdy(vW);
    float dhx = dFdx(h), dhy = dFdy(h);
    vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
    float det = dot(dpx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    vec3 bn = normalize(abs(det) * n - grad * 0.035 / max(1e-4, length(dpx) + length(dpy)) * 0.5);
    if (any(isnan(bn))) bn = n;
    // ambient occlusion: vertex AO on floors, height-based at wall feet
    float ao = vAO;
    if (abs(n.y) < 0.5) ao *= mix(0.55, 1.0, clamp((vW.y - vBase) / 1.0, 0.0, 1.0));
    vec3 light = uAmbient + bakedLight(vW, n) + dynLight(vW, bn) + uSkyLight * (0.5 + 0.5 * bn.y) * vec3(0.35, 0.3, 0.55);
    float lam = clamp(dot(bn, normalize(vec3(0.3, 1.0, 0.2))) * 0.25 + 0.75, 0.0, 1.0);
    vec3 col = alb * light * ao * lam + emi;
    // a fake neon reflection on glossy surfaces
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(clamp(1.0 - max(dot(bn, V), 0.0), 0.0, 1.0), 4.0);
    vec3 R = reflect(-V, bn);
    vec3 env = mix(vec3(0.05, 0.02, 0.1), mix(vec3(0.7, 0.15, 0.6), vec3(0.15, 0.6, 0.9), clamp(R.x * 0.5 + 0.5, 0.0, 1.0)), clamp(R.y * 0.6 + 0.4, 0.0, 1.0));
    col += env * gloss * (0.06 + 0.5 * fres) * (0.3 + light * 0.4);
    col = applyFog(col, vDist);
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`;

export function worldMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { ...SU },
        vertexShader: WORLD_VERT,
        fragmentShader: WORLD_FRAG,
    });
}

// ==================================================================== lightmap

/** Bake the static lights into an RGB lightmap over XZ, with hard 2D shadows from walls. */
export function bakeLightmap(L) {
    const { W, H } = L;
    const TW = W * LM_RES, TH = H * LM_RES;
    const acc = new Float32Array(TW * TH * 3);
    const s = CELL / LM_RES;
    const solid = (x, z) => {
        const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
        return cx < 0 || cz < 0 || cx >= W || cz >= H || L.solid[cz * W + cx];
    };
    const losClear = (x0, z0, x1, z1) => {
        const d = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.ceil(d / (CELL * 0.33));
        for (let k = 1; k < n; k++) {
            const t = k / n;
            if (solid(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
        }
        return true;
    };
    for (const li of L.lights) {
        const r = li.range;
        const tx0 = Math.max(0, Math.floor((li.x - r) / s)), tx1 = Math.min(TW - 1, Math.ceil((li.x + r) / s));
        const tz0 = Math.max(0, Math.floor((li.z - r) / s)), tz1 = Math.min(TH - 1, Math.ceil((li.z + r) / s));
        const k = li.kind === 'neon' ? 0.9 : li.kind === 'liquid' ? 0.8 : li.kind === 'street' ? 0.75 : 0.65;
        for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
            const px = (tx + 0.5) * s, pz = (tz + 0.5) * s;
            const d = Math.hypot(px - li.x, pz - li.z);
            if (d >= r) continue;
            if (solid(px, pz)) continue;
            if (!losClear(li.x, li.z, px, pz)) continue;
            const f = (1 - d / r);
            const I = k * f * f;
            const o = (tz * TW + tx) * 3;
            acc[o] += li.r * I; acc[o + 1] += li.g * I; acc[o + 2] += li.b * I;
        }
    }
    // soft clip so stacked lights saturate rather than blow out, then blur and dilate into walls
    const soft = (v) => v / (1 + 0.22 * v);
    const blur = new Float32Array(acc.length);
    for (let tz = 0; tz < TH; tz++) for (let tx = 0; tx < TW; tx++) {
        for (let ch = 0; ch < 3; ch++) {
            let sum = 0, n = 0;
            for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
                const x = tx + ox, z = tz + oz;
                if (x < 0 || z < 0 || x >= TW || z >= TH) continue;
                if (solid((x + 0.5) * s, (z + 0.5) * s)) continue;
                sum += acc[(z * TW + x) * 3 + ch]; n++;
            }
            blur[(tz * TW + tx) * 3 + ch] = n ? soft(sum / n) : 0;
        }
    }
    for (let pass = 0; pass < 2; pass++) {
        for (let tz = 0; tz < TH; tz++) for (let tx = 0; tx < TW; tx++) {
            if (!solid((tx + 0.5) * s, (tz + 0.5) * s)) continue;
            const o = (tz * TW + tx) * 3;
            for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const x = tx + ox, z = tz + oz;
                if (x < 0 || z < 0 || x >= TW || z >= TH) continue;
                const q = (z * TW + x) * 3;
                for (let ch = 0; ch < 3; ch++) blur[o + ch] = Math.max(blur[o + ch], blur[q + ch] * 0.9);
            }
        }
    }
    const data = new Uint8Array(TW * TH * 4);
    for (let i = 0; i < TW * TH; i++) {
        for (let ch = 0; ch < 3; ch++) data[i * 4 + ch] = Math.min(255, Math.round(blur[i * 3 + ch] / 4 * 255));
        data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    // a CPU copy for lighting the gun in your hands
    tex.userData.sample = (x, z) => {
        const tx = Math.max(0, Math.min(TW - 1, Math.floor(x / s))), tz = Math.max(0, Math.min(TH - 1, Math.floor(z / s)));
        const o = (tz * TW + tx) * 3;
        return [blur[o], blur[o + 1], blur[o + 2]];
    };
    return tex;
}

// ==================================================================== liquids

const LIQUID_FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uColA, uColB;
varying vec3 vW;
varying float vDist;
${NOISE}
${FOG}
void main() {
    vec2 p = vW.xz * 0.35;
    float n1 = fbm(p + vec2(uTime * 0.15, uTime * 0.08));
    float n2 = fbm(p * 2.3 - vec2(uTime * 0.11, -uTime * 0.17));
    float bubbles = step(0.94, hash12(floor(vW.xz * 3.0) + floor(uTime * 2.0)));
    float v = n1 * 0.6 + n2 * 0.4;
    vec3 col = mix(uColA, uColB, smoothstep(0.35, 0.75, v)) * (0.8 + 0.6 * smoothstep(0.55, 0.8, n2)) + bubbles * uColB * 0.6;
    gl_FragColor = vec4(applyFog(col, vDist), 1.0);
}`;
const LIQUID_VERT = /* glsl */`
uniform float uTime;
varying vec3 vW;
varying float vDist;
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    wp.y += sin(wp.x * 1.3 + uTime * 2.0) * 0.04 + sin(wp.z * 1.7 - uTime * 1.6) * 0.04;
    vW = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
}`;
const LIQUID_COLORS = {
    toxic: [[0.05, 0.25, 0.02], [0.5, 1.6, 0.15]],
    slime: [[0.08, 0.2, 0.02], [0.7, 1.5, 0.1]],
    plasma: [[0.25, 0.02, 0.35], [1.6, 0.4, 1.8]],
};

function buildLiquids(L, liquidKind) {
    const pos = [], idx = [];
    for (let i = 0; i < L.N; i++) {
        if (!L.liquid[i]) continue;
        const x0 = (i % L.W) * CELL, z0 = ((i / L.W) | 0) * CELL, y = L.floor[i] + 0.45;
        const v = pos.length / 3;
        pos.push(x0, y, z0, x0, y, z0 + CELL, x0 + CELL, y, z0 + CELL, x0 + CELL, y, z0);
        idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const [a, b] = LIQUID_COLORS[liquidKind] || LIQUID_COLORS.slime;
    const m = new THREE.ShaderMaterial({
        uniforms: { ...SU, uColA: { value: new THREE.Vector3(...a) }, uColB: { value: new THREE.Vector3(...b) } },
        vertexShader: LIQUID_VERT, fragmentShader: LIQUID_FRAG,
    });
    return new THREE.Mesh(g, m);
}

// ==================================================================== doors

const KEY_COLORS = [0xffffff, 0xff2a1a, 0x2a7bff, 0xffc020];

function doorTexture(key) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#2a2b33'; x.fillRect(0, 0, 256, 256);
    // hazard stripes top and bottom
    for (const y0 of [0, 216]) {
        for (let k = -2; k < 12; k++) {
            x.fillStyle = k % 2 ? '#111' : '#f2c21a';
            x.beginPath(); x.moveTo(k * 28, y0); x.lineTo(k * 28 + 28, y0); x.lineTo(k * 28 + 68, y0 + 40); x.lineTo(k * 28 + 40, y0 + 40); x.fill();
        }
    }
    // panel seams and rivets
    x.strokeStyle = '#15161b'; x.lineWidth = 6;
    x.strokeRect(14, 48, 228, 160);
    x.beginPath(); x.moveTo(128, 48); x.lineTo(128, 208); x.stroke();
    x.fillStyle = '#5a5c66';
    for (let i = 0; i < 8; i++) for (const yy of [56, 200]) { x.beginPath(); x.arc(24 + i * 30, yy, 4, 0, 7); x.fill(); }
    // the key colour band with the key's name
    const col = '#' + KEY_COLORS[key].toString(16).padStart(6, '0');
    x.fillStyle = col; x.fillRect(14, 110, 228, 36);
    x.fillStyle = '#000'; x.font = 'bold 26px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(['', 'RED', 'BLUE', 'GOLD'][key] + ' KEY', 128, 129);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

function buildDoors(L) {
    const group = new THREE.Group();
    const list = [];
    const texCache = {};
    for (const d of L.doors) {
        texCache[d.key] ??= doorTexture(d.key);
        const mat = new THREE.MeshStandardMaterial({ map: texCache[d.key], roughness: 0.5, metalness: 0.6, emissive: KEY_COLORS[d.key], emissiveIntensity: 0.0 });
        const meshes = [];
        for (const c of d.cells) {
            const f = L.floor[c];
            const h = L.outdoor ? 4.5 : Math.min(L.ceil[c] - f, 6);
            const geo = new THREE.BoxGeometry(CELL - 0.06, h, CELL - 0.06);
            const m = new THREE.Mesh(geo, mat);
            m.position.set((c % L.W + 0.5) * CELL, f + h / 2, (((c / L.W) | 0) + 0.5) * CELL);
            m.userData = { base: f + h / 2, h, sink: L.outdoor };
            group.add(m);
            meshes.push(m);
        }
        list.push({ door: d, mat, meshes });
    }
    return { group, list };
}

// ==================================================================== neon signs

const signCache = new Map();
function signTexture(text) {
    if (signCache.has(text)) return signCache.get(text);
    const c = document.createElement('canvas');
    const fs = 96;
    const ctx = c.getContext('2d');
    ctx.font = `bold ${fs}px "Arial Black", Impact, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + 60;
    c.width = Math.min(1024, w); c.height = fs + 50;
    const x = c.getContext('2d');
    x.font = `bold ${fs}px "Arial Black", Impact, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    // white core on a glow: the material's colour tints it, bloom does the rest
    x.shadowColor = '#fff'; x.shadowBlur = 18;
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 7;
    x.strokeText(text, c.width / 2, c.height / 2 + 4);
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillText(text, c.width / 2, c.height / 2 + 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const out = { tex: t, aspect: c.width / c.height };
    signCache.set(text, out);
    return out;
}

function buildSigns(L) {
    const group = new THREE.Group();
    const flicker = [];
    const backMat = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.7, metalness: 0.4 });
    for (const s of L.signs) {
        const { tex, aspect } = signTexture(s.text);
        const h = L.outdoor ? 1.3 : 0.75;
        const w = Math.min(CELL * 0.92, h * aspect);
        const hh = w / aspect;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(s.r * 2.4, s.g * 2.4, s.b * 2.4), toneMapped: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
        const yaw = Math.atan2(s.nx, s.nz);
        m.position.set(s.x + s.nx * 0.12, s.y, s.z + s.nz * 0.12);
        m.rotation.y = yaw;
        group.add(m);
        const back = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, hh * 1.1, 0.1), backMat);
        back.position.set(s.x + s.nx * 0.05, s.y, s.z + s.nz * 0.05);
        back.rotation.y = yaw;
        group.add(back);
        if ((s.text.length * 7 + Math.round(s.x)) % 5 === 0) flicker.push({ mat, base: mat.color.clone(), seed: s.x * 13.1 + s.z });
    }
    return { group, flicker };
}

// ==================================================================== exit

function buildExit(L) {
    const g = new THREE.Group();
    const c = L.exitCell;
    const x = (c % L.W + 0.5) * CELL, z = (((c / L.W) | 0) + 0.5) * CELL, y = L.floor[c];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 10, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 0.8), toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);
    const beamMat = new THREE.ShaderMaterial({
        uniforms: { uTime: SU.uTime },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.45 * sin(vUv.y * 30.0 - uTime * 6.0)); gl_FragColor = vec4(vec3(0.3, 1.6, 0.6) * a, a); }',
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 6, 32, 1, true), beamMat);
    beam.position.y = 3;
    g.add(beam);
    const { tex, aspect } = signTexture('EXIT');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * aspect * 0.5, 0.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.5, 3, 0.8), toneMapped: false, side: THREE.DoubleSide }));
    sign.position.y = 2.6;
    g.add(sign);
    g.position.set(x, y, z);
    g.userData = { ring, beam, sign };
    return g;
}

// ==================================================================== everything

export function buildLevel(L, liquidKind) {
    const group = new THREE.Group();
    const geo = buildWorldGeometry(L);
    const mat = worldMaterial();
    const world = new THREE.Mesh(geo, mat);
    world.frustumCulled = false;
    group.add(world);
    const lm = bakeLightmap(L);
    SU.uLM.value = lm;
    SU.uLMSize.value.set(L.W * CELL, L.H * CELL);
    const liquid = buildLiquids(L, liquidKind);
    if (liquid) group.add(liquid);
    const doors = buildDoors(L);
    group.add(doors.group);
    const signs = buildSigns(L);
    group.add(signs.group);
    const exit = buildExit(L);
    group.add(exit);
    return {
        group, lightmap: lm, doors, signs, exit,
        dispose() {
            group.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.map?.isCanvasTexture) o.material.dispose?.(); });
            lm.dispose();
        },
    };
}
