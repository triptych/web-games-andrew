/**
 * tree.js — the World Tree.
 *
 * The whole grown tree is generated once, from a fixed seed, as a skeleton of
 * branches. Every branch segment carries the tree level at which it starts and
 * finishes growing, and the vertex shader grows it: a segment slides out of its
 * start point, and a branch thickens for a long while after it appears. So one
 * merged mesh and one uniform (uGrow, the smoothed tree level 0–100) animate
 * the whole thing from sprout to World Tree. Children are always born after the
 * part of the parent they sit on has finished growing, so they never detach.
 *
 * On top of that the group scales from tiny to huge (scaleAt), sprout leaves
 * ride the growing tip, juvenile twigs are shed as the tree matures, and leaf
 * clusters, roots and glowing fruit appear on their own schedules.
 */

import * as THREE from 'three';
import { U } from './stage.js';

// ------------------------------------------------------------------ rng
function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const END = 99.2;              // everything has finished growing by this level
const UP = new THREE.Vector3(0, 1, 0);

/** World scale of the tree group at growth u (0..100). */
export function scaleAt(u) {
    const x = Math.max(0, Math.min(1, (u - 25) / 75));
    return 0.3 + 1.2 * Math.pow(x * x * (3 - 2 * x) * 0.6 + x * 0.4, 1.4);
}

/** Thickness factor of a branch born at `birth` with ramp `span`, at growth u (matches the shader). */
export function thickAt(u, birth, span) {
    const x = Math.max(0, Math.min(1, (u - birth) / span));
    return 0.03 + 0.97 * Math.pow(x, 1.7);
}

// ------------------------------------------------------------------ skeleton
function buildSkeleton(quality) {
    const r = mulberry(20260);
    const branches = [];
    const leaves = [];
    const fruit = [];

    const perp = (d) => {
        const a = Math.abs(d.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
        return new THREE.Vector3().crossVectors(d, a).normalize();
    };

    function makeBranch(o) {
        const { start, dir, length, radius, depth, birth } = o;
        const n = o.segs ?? [16, 7, 5, 4, 3][depth];
        const pts = [start.clone()];
        const radii = [radius];
        let d = dir.clone().normalize();
        const step = length / n;
        for (let k = 1; k <= n; k++) {
            const jitter = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(o.jitter ?? 0.35);
            d.add(jitter).addScaledVector(UP, o.upward ?? 0.08);
            if (o.gravity) d.y -= o.gravity;
            d.normalize();
            pts.push(pts[k - 1].clone().addScaledVector(d, step));
            const t = k / n;
            radii.push(radius * Math.max(o.tipFrac ?? 0.22, 1 - (1 - (o.tipFrac ?? 0.22)) * Math.pow(t, o.taper ?? 0.9)));
        }
        // growth schedule
        let dur = o.dur;
        let b = Math.min(birth, END - 1.5);
        if (b + dur > END) dur = Math.max(1.2, END - b);
        const segB = [], segF = [];
        for (let k = 0; k < n; k++) {
            const t0 = o.curve ? Math.pow(k / n, o.curve) : k / n;
            const t1 = o.curve ? Math.pow((k + 1) / n, o.curve) : (k + 1) / n;
            segB.push(b + dur * t0);
            segF.push(b + dur * t1);
        }
        const br = {
            pts, radii, segB, segF, depth, birth: b, thick: o.thick ?? [75, 34, 20, 12, 8][depth],
            death: o.death ?? 999, root: !!o.root, glow: o.glow ?? Math.max(0.1, 1 - depth * 0.28),
        };
        branches.push(br);
        return br;
    }

    /** Point and tangent on a branch at fraction t, plus the level it is fully grown there. */
    function along(br, t) {
        const n = br.pts.length - 1;
        const f = Math.min(n - 1e-6, t * n);
        const k = Math.floor(f), s = f - k;
        const p = br.pts[k].clone().lerp(br.pts[k + 1], s);
        const d = br.pts[k + 1].clone().sub(br.pts[k]).normalize();
        const rad = br.radii[k] + (br.radii[k + 1] - br.radii[k]) * s;
        return { p, d, rad, full: br.segF[k] };
    }

    function spawnDir(parentDir, angle, az) {
        const a = perp(parentDir);
        const q = new THREE.Quaternion().setFromAxisAngle(parentDir, az);
        a.applyQuaternion(q);
        return parentDir.clone().multiplyScalar(Math.cos(angle)).addScaledVector(a, Math.sin(angle)).normalize();
    }

    function addLeaves(br, count, size, death = 999) {
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 1 : 0.45 + 0.55 * (i / (count - 1));
            const { p, full } = along(br, Math.min(0.999, t));
            p.add(new THREE.Vector3(r() - 0.5, r() * 0.6 - 0.2, r() - 0.5).multiplyScalar(size * 0.6));
            leaves.push({ p, size: size * (0.75 + r() * 0.5), birth: Math.min(full + 0.5 + r() * 1.5, END), death, rnd: r(), blossom: r() < 0.28 ? 1 : 0 });
        }
    }

    // ---- trunk
    const trunkLen = 36;
    const trunk = makeBranch({
        start: new THREE.Vector3(0, -0.4, 0), dir: UP, length: trunkLen, radius: 3.1, depth: 0, birth: 0.6, dur: 92,
        segs: 16, jitter: 0.07, upward: 0.05, tipFrac: 0.16, taper: 1.15, thick: 75, glow: 1,
    });

    // ---- roots: flare out along the ground
    const nRoots = 9;
    for (let i = 0; i < nRoots; i++) {
        const az = (i / nRoots) * Math.PI * 2 + r() * 0.4;
        const dir = new THREE.Vector3(Math.cos(az), -0.05, Math.sin(az));
        const root = makeBranch({
            start: new THREE.Vector3(Math.cos(az) * 0.6, 0.7, Math.sin(az) * 0.6), dir, length: 10 + r() * 8, radius: 1.6 + r() * 0.5,
            depth: 1, birth: 16 + i * 2.2, dur: 34 + r() * 20, segs: 7, jitter: 0.25, upward: -0.02, gravity: 0.06,
            tipFrac: 0.12, taper: 0.8, root: true, thick: 55, glow: 0.8,
        });
        // little rootlets
        for (let j = 0; j < 2; j++) {
            const { p, d, rad, full } = along(root, 0.35 + j * 0.3);
            makeBranch({
                start: p, dir: spawnDir(d, 0.7, r() * 6.28).setY(-0.05), length: 3 + r() * 3, radius: rad * 0.5, depth: 2, birth: full + 2,
                dur: 10, segs: 4, jitter: 0.3, upward: -0.02, gravity: 0.05, tipFrac: 0.1, root: true, glow: 0.6,
            });
        }
    }

    // ---- juvenile twigs: what makes the sprout and seedling look like plants; shed later
    for (let i = 0; i < 12; i++) {
        const t = 0.05 + i * 0.03;
        const { p, d, rad, full } = along(trunk, t);
        const death = 38 + i * 2.5;
        const len = 2.4 + r() * 1.4 + i * 0.25;
        const tw = makeBranch({
            start: p, dir: spawnDir(d, 0.85 + r() * 0.35, i * 2.4), length: len, radius: rad * 0.14 + 0.06, depth: 3,
            birth: full + 0.3, dur: 4, segs: 3, jitter: 0.4, upward: 0.16, death, glow: 0.4,
        });
        addLeaves(tw, 4, 1.7 + i * 0.08, death);
    }

    // ---- primary limbs
    const nPrim = 15;
    const golden = 2.399963;
    for (let i = 0; i < nPrim; i++) {
        const t = 0.27 + 0.71 * (i / (nPrim - 1));
        const { p, d, rad, full } = along(trunk, t);
        const elev = 1.2 - t * 0.7 + (r() - 0.5) * 0.15;          // angle from vertical
        const len = (27 - t * 14) * (0.85 + r() * 0.3);
        const prim = makeBranch({
            start: p, dir: spawnDir(d, elev, i * golden + r() * 0.3), length: len, radius: rad * 0.6, depth: 1,
            birth: full + 0.5, dur: 6 + len * 0.36, jitter: 0.22, upward: 0.06, tipFrac: 0.2, glow: 0.75,
        });
        addLeaves(prim, 3, 3.4);
        const nSec = 4 + Math.floor(r() * 2);
        for (let j = 0; j < nSec; j++) {
            const ts = 0.3 + 0.65 * (j / (nSec - 1)) + (r() - 0.5) * 0.05;
            const a = along(prim, ts);
            const slen = len * (0.48 + r() * 0.15) * (1.1 - ts * 0.4);
            const sec = makeBranch({
                start: a.p, dir: spawnDir(a.d, 0.55 + r() * 0.35, j * 2.1 + r()), length: slen, radius: a.rad * 0.62, depth: 2,
                birth: a.full + 0.4, dur: 4 + slen * 0.4, jitter: 0.3, upward: 0.09, glow: 0.5,
            });
            const nTer = quality === 2 ? 2 : 3;
            for (let k = 0; k < nTer; k++) {
                const tt = 0.4 + 0.55 * (k / (nTer - 1));
                const b = along(sec, tt);
                const tlen = slen * (0.5 + r() * 0.2);
                const ter = makeBranch({
                    start: b.p, dir: spawnDir(b.d, 0.6 + r() * 0.3, k * 2.6 + r()), length: tlen, radius: b.rad * 0.62, depth: 3,
                    birth: b.full + 0.3, dur: 3 + tlen * 0.45, jitter: 0.35, upward: 0.1, glow: 0.3,
                });
                addLeaves(ter, quality === 2 ? 3 : 4, 4.6);
                if (r() < 0.35) {
                    const fp = along(ter, 0.7);
                    fruit.push({ p: fp.p.add(new THREE.Vector3(0, -0.6, 0)), birth: Math.max(fp.full + 2, 38 + r() * 30), rnd: r() });
                }
            }
            addLeaves(sec, 2, 5.0);
        }
    }
    // crown top
    for (let i = 0; i < 5; i++) {
        const { p, d, rad, full } = along(trunk, 0.985);
        const top = makeBranch({
            start: p, dir: spawnDir(d, 0.35 + r() * 0.3, i * 1.26), length: 7 + r() * 3, radius: rad * 0.7, depth: 2,
            birth: full + 0.2, dur: 4, jitter: 0.3, upward: 0.12, glow: 0.5,
        });
        addLeaves(top, 4, 5.0);
    }
    return { branches, leaves, fruit, trunk };
}

// ------------------------------------------------------------------ bark mesh
const BARK_VS = /* glsl */`
attribute vec3 aStart;
attribute vec3 aCenter;
attribute vec3 aOff;
attribute vec4 aG;      // segBirth, segFull, branchBirth, death
attribute vec3 aUv;     // around, along (world units), glow
attribute vec2 aSpan;   // levels over which the branch thickens, bark repeats around it
uniform float uGrow;
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
varying vec3 vUv;
varying float vFresh;
varying float vFogDepth;
void main() {
    float sLen = clamp((uGrow - aG.x) / max(0.001, aG.y - aG.x), 0.0, 1.0);
    float alive = 1.0 - smoothstep(aG.w - 6.0, aG.w, uGrow);
    float thick = 0.03 + 0.97 * pow(clamp((uGrow - aG.z) / aSpan.x, 0.0, 1.0), 1.7);
    thick *= step(0.0001, sLen) * alive;
    // the last few levels of growth taper to a point: a ring is thin until it
    // has been part of the branch for a while (start ring reached at segBirth, end ring at segFull)
    float isEnd = step(0.0001, distance(aCenter, aStart));
    float reached = mix(aG.x, aG.y, isEnd);
    float tipTaper = 0.1 + 0.9 * smoothstep(0.0, min(8.0, aSpan.x * 0.15), uGrow - reached);
    // a branch that has just started is thin all along; a shed twig withers to nothing
    vec3 p = aStart + (aCenter - aStart) * sLen * alive + aOff * thick * tipTaper;
    // gentle sway, more out at the ends of the limbs
    float sway = length(aCenter.xz) * 0.0025;
    p.x += sin(uTime * 0.9 + aCenter.y * 0.15) * sway;
    p.z += cos(uTime * 0.7 + aCenter.y * 0.11) * sway;
    vN = normalize(normalMatrix * normalize(aOff + vec3(0.0, 0.0001, 0.0)));
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    // keep the bark pattern the same size in the wood as the branch thickens
    vUv = vec3(aUv.x * max(1.0, floor(aSpan.y * thick + 0.5)), aUv.y, aUv.z);
    vFresh = clamp((uGrow - aG.y) / 6.0, 0.0, 1.0);
    vec4 mv = viewMatrix * w;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
}`;

const BARK_FS = /* glsl */`
uniform sampler2D uBark;
uniform sampler2D uRune;
uniform float uTime;
uniform float uGlowAmt;
uniform vec3 uMoonDir;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uVein;
uniform float uSnow;
varying vec3 vN;
varying vec3 vW;
varying vec3 vUv;
varying float vFresh;
varying float vFogDepth;
void main() {
    vec3 n = normalize(vN);
    vec3 wn = normalize((vec4(n, 0.0) * viewMatrix).xyz);
    vec2 uv = vec2(vUv.x, vUv.y * 0.11);
    vec3 bark = texture2D(uBark, uv).rgb;
    vec3 base = bark * vec3(0.62, 0.5, 0.42);
    // young growth is green, old wood grey-brown
    base = mix(vec3(0.32, 0.52, 0.22) * (0.6 + bark.g * 0.6), base, vFresh);
    // moss on upward faces
    float moss = smoothstep(0.35, 0.85, wn.y) * (0.6 + 0.4 * bark.r);
    base = mix(base, vec3(0.16, 0.34, 0.14), moss * 0.7);
    base = mix(base, vec3(0.85, 0.9, 0.95), smoothstep(0.55, 0.9, wn.y) * uSnow);

    vec3 V = normalize(cameraPosition - vW);
    float hemi = wn.y * 0.5 + 0.5;
    vec3 amb = mix(vec3(0.05, 0.06, 0.06), vec3(0.16, 0.22, 0.32), hemi);
    float moon = max(dot(wn, uMoonDir), 0.0) * 0.7 + 0.15;
    vec3 col = base * (amb + vec3(0.42, 0.5, 0.65) * moon * 0.6);
    // warm light from the tree's own heart: brighter near the trunk, low down
    float heart = exp(-length(vW.xz) * 0.05) * 0.35;
    col += base * vec3(1.0, 0.75, 0.4) * heart * uGlowAmt;
    float rim = pow(1.0 - max(dot(wn, V), 0.0), 3.0);
    col += vec3(0.3, 0.45, 0.6) * rim * 0.35;

    // glowing veins that pulse upward through the wood
    float rune = texture2D(uRune, vec2(vUv.x * 0.5, vUv.y * 0.05 - uTime * 0.03)).r;
    rune = smoothstep(0.55, 1.0, rune);
    float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(vUv.y * 0.3 - uTime * 1.6), 3.0);
    col += uVein * rune * pulse * vUv.z * uGlowAmt * 1.1;

    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    col = mix(col, uFogColor, fog);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

function buildBarkGeometry(skel) {
    const pos = [], aStart = [], aCenter = [], aOff = [], aG = [], aUv = [], aSpan = [], idx = [];
    for (const br of skel.branches) {
        const n = br.pts.length - 1;
        const radial = [14, 9, 6, 5, 4][br.depth] ?? 4;
        // frame along the branch (parallel transport) to avoid twisting
        let d0 = br.pts[1].clone().sub(br.pts[0]).normalize();
        let nrm = (Math.abs(d0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).cross(d0).normalize();
        let along = 0;
        const frames = [];
        for (let k = 0; k <= n; k++) {
            const d = k < n ? br.pts[k + 1].clone().sub(br.pts[k]).normalize() : br.pts[k].clone().sub(br.pts[k - 1]).normalize();
            const dPrev = k > 0 ? frames[k - 1].d : d;
            const q = new THREE.Quaternion().setFromUnitVectors(dPrev, d);
            nrm = nrm.clone().applyQuaternion(q);
            const bin = new THREE.Vector3().crossVectors(d, nrm).normalize();
            frames.push({ d, n: nrm.clone(), b: bin });
        }
        for (let k = 0; k < n; k++) {
            const segLen = br.pts[k + 1].distanceTo(br.pts[k]);
            const base = pos.length / 3;
            for (const end of [0, 1]) {
                const c = br.pts[k + end], f = frames[k + end];
                let rad = br.radii[k + end];
                if (br.depth === 0 && k + end <= 2) rad *= 1 + (2 - (k + end)) * 0.22;   // trunk flare
                for (let j = 0; j <= radial; j++) {
                    const a = (j / radial) * Math.PI * 2;
                    const off = f.n.clone().multiplyScalar(Math.cos(a) * rad).addScaledVector(f.b, Math.sin(a) * rad);
                    pos.push(c.x + off.x, c.y + off.y, c.z + off.z);
                    aStart.push(br.pts[k].x, br.pts[k].y, br.pts[k].z);
                    aCenter.push(c.x, c.y, c.z);
                    aOff.push(off.x, off.y, off.z);
                    aG.push(br.segB[k], br.segF[k], br.birth, br.death);
                    aUv.push(j / radial, along + end * segLen, br.glow);
                    aSpan.push(br.thick, Math.max(1, rad * 1.3));
                }
            }
            for (let j = 0; j < radial; j++) {
                const a = base + j, b = base + j + 1, c = base + radial + 1 + j, d = base + radial + 2 + j;
                idx.push(a, b, c, b, d, c);   // outward-facing (normal = radial)
            }
            along += segLen;
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aStart', new THREE.Float32BufferAttribute(aStart, 3));
    g.setAttribute('aCenter', new THREE.Float32BufferAttribute(aCenter, 3));
    g.setAttribute('aOff', new THREE.Float32BufferAttribute(aOff, 3));
    g.setAttribute('aG', new THREE.Float32BufferAttribute(aG, 4));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(aUv, 3));
    g.setAttribute('aSpan', new THREE.Float32BufferAttribute(aSpan, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}

// ------------------------------------------------------------------ leaves
const LEAF_VS = /* glsl */`
attribute vec3 iPos;
attribute vec4 iData;   // size, birth, death, rnd
attribute float iBlossom;
uniform float uGrow;
uniform float uTime;
uniform float uWind;
uniform float uScale;
uniform float uLeafCut;
varying vec2 vUv;
varying float vShade;
varying float vRnd;
varying float vBlossom;
varying float vFogDepth;
varying vec3 vW;
void main() {
    float g = smoothstep(iData.y, iData.y + 3.0, uGrow) * (1.0 - smoothstep(iData.z - 6.0, iData.z, uGrow));
    g *= step(uLeafCut, fract(iData.w * 7.31));   // winter thins the canopy
    vec3 p = iPos;
    float t = uTime * (0.8 + iData.w * 0.6);
    p += vec3(sin(t + p.y * 0.3), sin(t * 1.3 + p.x * 0.2) * 0.5, cos(t * 0.9 + p.z * 0.3)) * uWind * 0.18 * (p.y * 0.03 + 0.3);
    vec4 w = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * w;
    // billboard, rotated per instance
    float ang = iData.w * 6.2831 + sin(t * 0.7) * 0.15;
    vec2 c = position.xy;
    c = vec2(c.x * cos(ang) - c.y * sin(ang), c.x * sin(ang) + c.y * cos(ang));
    float size = iData.x * g * uScale;
    mv.xy += c * size;
    gl_Position = projectionMatrix * mv;
    // atlas cell
    float cell = floor(iData.w * 4.0);
    vUv = (uv + vec2(mod(cell, 2.0), floor(cell / 2.0))) * 0.5;
    vShade = 0.65 + 0.35 * clamp((p.y) / 40.0, 0.0, 1.0);
    vRnd = iData.w;
    vBlossom = iBlossom;
    vFogDepth = -mv.z;
    vW = w.xyz;
}`;

const LEAF_FS = /* glsl */`
uniform sampler2D uMap;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uBlossom;
uniform float uBlossomAmt;
uniform float uGlowAmt;
uniform float uTime;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec2 vUv;
varying float vShade;
varying float vRnd;
varying float vBlossom;
varying float vFogDepth;
varying vec3 vW;
void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a < 0.5) discard;
    float lum = dot(t.rgb, vec3(0.3, 0.55, 0.15));
    vec3 tint = mix(uTintA, uTintB, fract(vRnd * 13.7));
    tint = mix(tint, uBlossom, vBlossom * uBlossomAmt);
    vec3 col = tint * lum * vShade * 0.55;
    // moonlight from above and the glow of the tree within
    col += tint * 0.12;
    float sparkle = step(0.93, fract(vRnd * 31.7)) * (0.6 + 0.4 * sin(uTime * 2.0 + vRnd * 50.0));
    col += mix(tint, vec3(1.0, 0.95, 0.7), 0.5) * sparkle * uGlowAmt * 1.6;
    col += tint * uGlowAmt * 0.18 * exp(-length(vW.xz) * 0.04);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    col = mix(col, uFogColor, fog);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

// season palettes for leaves: [tintA, tintB, blossom, blossomAmt, leafCut, snow]
const SEASON_LEAF = [
    [0x7fe07a, 0x4fc89a, 0xffa8d8, 1.0, 0.0, 0],    // spring: fresh green, pink blossom
    [0x2fae6a, 0x37c4a0, 0xfff1a0, 0.25, 0.0, 0],   // summer: deep emerald, a few golden flowers
    [0xffb03a, 0xe2502a, 0xffd24a, 0.6, 0.12, 0],   // autumn: amber and crimson
    [0x9fd8ff, 0xd8f0ff, 0xffffff, 0.5, 0.35, 1],   // winter: frost-blue, thinned, snow on bark
];

// ------------------------------------------------------------------ the tree
export class WorldTree {
    constructor(scene, textures, quality) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.skel = buildSkeleton(quality);
        this.growth = 0;

        this.barkU = {
            uGrow: { value: 0 }, uTime: U.uTime, uBark: { value: textures.bark }, uRune: { value: textures.rune },
            uGlowAmt: U.uGlow, uMoonDir: U.uMoonDir, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity,
            uVein: { value: new THREE.Color(0x7dffcf) }, uSnow: { value: 0 },
        };
        const bark = new THREE.Mesh(buildBarkGeometry(this.skel), new THREE.ShaderMaterial({
            uniforms: this.barkU, vertexShader: BARK_VS, fragmentShader: BARK_FS,
        }));
        bark.frustumCulled = false;
        this.bark = bark;
        this.group.add(bark);

        // leaves (instanced billboards)
        const L = this.skel.leaves;
        const quad = new THREE.PlaneGeometry(1, 1);
        const ig = new THREE.InstancedBufferGeometry();
        ig.index = quad.index;
        ig.attributes.position = quad.attributes.position;
        ig.attributes.uv = quad.attributes.uv;
        const iPos = new Float32Array(L.length * 3), iData = new Float32Array(L.length * 4), iBl = new Float32Array(L.length);
        L.forEach((l, i) => {
            iPos.set([l.p.x, l.p.y, l.p.z], i * 3);
            iData.set([l.size, l.birth, l.death, l.rnd], i * 4);
            iBl[i] = l.blossom;
        });
        ig.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
        ig.setAttribute('iData', new THREE.InstancedBufferAttribute(iData, 4));
        ig.setAttribute('iBlossom', new THREE.InstancedBufferAttribute(iBl, 1));
        ig.instanceCount = L.length;
        this.leafU = {
            uGrow: this.barkU.uGrow, uTime: U.uTime, uWind: U.uWind, uScale: { value: 1 }, uMap: { value: textures.leaf },
            uTintA: { value: new THREE.Color() }, uTintB: { value: new THREE.Color() }, uBlossom: { value: new THREE.Color() },
            uBlossomAmt: { value: 0 }, uLeafCut: { value: 0 }, uGlowAmt: U.uGlow, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity,
        };
        this.leaves = new THREE.Mesh(ig, new THREE.ShaderMaterial({
            uniforms: this.leafU, vertexShader: LEAF_VS, fragmentShader: LEAF_FS, side: THREE.DoubleSide,
        }));
        this.leaves.frustumCulled = false;
        this.group.add(this.leaves);

        // sprout leaves riding the growing tip (only while young)
        this.sprout = new THREE.Group();
        const sproutMat = new THREE.MeshStandardMaterial({ color: 0x7fe07a, emissive: 0x2a7a3a, emissiveIntensity: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
        const leafShape = new THREE.Shape();
        leafShape.moveTo(0, 0);
        leafShape.quadraticCurveTo(0.45, 0.35, 0, 1);
        leafShape.quadraticCurveTo(-0.45, 0.35, 0, 0);
        const lg = new THREE.ShapeGeometry(leafShape, 8);
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(lg, sproutMat);
            const piv = new THREE.Group();
            piv.rotation.y = i * Math.PI / 2 + 0.3;
            m.rotation.x = -0.9 + (i % 2) * 0.2;
            piv.add(m);
            piv.userData.leaf = m;
            this.sprout.add(piv);
        }
        this.group.add(this.sprout);

        // the seed
        const seedMat = new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffb84a, emissiveIntensity: 0.9, roughness: 0.25 });
        this.seed = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), seedMat);
        this.seed.scale.set(1, 1.35, 1);
        this.seed.position.y = 0.09;
        this.seedHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.seedHalo.scale.setScalar(0.9);
        this.seedHalo.material.opacity = 0.55;
        this.seedHalo.position.y = 0.14;
        scene.add(this.seed, this.seedHalo);

        // glowing fruit motes in the crown
        const F = this.skel.fruit;
        const fg = new THREE.BufferGeometry();
        const fp = new Float32Array(F.length * 3), fd = new Float32Array(F.length * 2);
        F.forEach((f, i) => { fp.set([f.p.x, f.p.y, f.p.z], i * 3); fd.set([f.birth, f.rnd], i * 2); });
        fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
        fg.setAttribute('aD', new THREE.BufferAttribute(fd, 2));
        this.fruitU = { uGrow: this.barkU.uGrow, uTime: U.uTime, uMap: { value: textures.glow }, uScale: { value: 1 }, uPx: { value: 1 }, uColor: { value: new THREE.Color(0xffe08a) } };
        this.fruit = new THREE.Points(fg, new THREE.ShaderMaterial({
            uniforms: this.fruitU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */`
                attribute vec2 aD; uniform float uGrow; uniform float uTime; uniform float uScale; uniform float uPx;
                varying float vA;
                void main() {
                    float g = smoothstep(aD.x, aD.x + 4.0, uGrow);
                    vec3 p = position; p.y += sin(uTime * 1.2 + aD.y * 20.0) * 0.25;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vA = g * (0.6 + 0.4 * sin(uTime * 2.0 + aD.y * 30.0));
                    gl_PointSize = g * uScale * uPx * 2.2 * 300.0 / -mv.z;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
                void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor * t.r * vA * 1.5, 1.0); }`,
        }));
        this.fruit.frustumCulled = false;
        this.group.add(this.fruit);

        this.precomputeMetrics();
        this.setGrowth(0);
    }

    /** Height / crown radius / tip (local units) for every whole level, from the skeleton. */
    precomputeMetrics() {
        this.metrics = [];
        for (let L = 0; L <= 100; L++) {
            let h = 0.3, crown = 0.3;
            for (const br of this.skel.branches) {
                if (br.root || L >= br.death) continue;
                for (let k = 0; k < br.segB.length; k++) {
                    if (L <= br.segB[k]) break;
                    const s = Math.min(1, (L - br.segB[k]) / (br.segF[k] - br.segB[k]));
                    const p = br.pts[k].clone().lerp(br.pts[k + 1], s);
                    h = Math.max(h, p.y + (br.depth >= 2 ? 2.5 : 0));
                    crown = Math.max(crown, Math.hypot(p.x, p.z) + (br.depth >= 2 ? 2.5 : 0));
                }
            }
            this.metrics.push({ h, crown });
        }
    }

    tipAt(u) {
        const tr = this.skel.trunk;
        let tip = tr.pts[0].clone();
        for (let k = 0; k < tr.segB.length; k++) {
            if (u <= tr.segB[k]) break;
            const s = Math.min(1, (u - tr.segB[k]) / (tr.segF[k] - tr.segB[k]));
            tip = tr.pts[k].clone().lerp(tr.pts[k + 1], s);
        }
        return tip;
    }

    /** World-space size of the tree now. */
    size() {
        const u = this.growth;
        const i = Math.min(99, Math.floor(u)), f = u - i;
        const a = this.metrics[i], b = this.metrics[i + 1];
        const sc = scaleAt(u);
        return { height: (a.h + (b.h - a.h) * f) * sc, crown: (a.crown + (b.crown - a.crown) * f) * sc, scale: sc };
    }

    setGrowth(u) {
        this.growth = u;
        this.barkU.uGrow.value = u;
        const sc = scaleAt(u);
        this.group.scale.setScalar(sc);
        this.leafU.uScale.value = sc;
        this.fruitU.uScale.value = sc;
        // sprout leaves: at the tip, big while young, gone by the sapling stage
        const tip = this.tipAt(u);
        this.sprout.position.copy(tip);
        const sl = Math.min(1, u / 1.2) * (1 - smooth01((u - 34) / 14));
        this.sprout.visible = sl > 0.01;
        this.sprout.scale.setScalar(sl * (0.9 + Math.min(u, 30) * 0.06));
        // seed: glowing until the sprout breaks out, then fades into the roots
        const seedVis = 1 - smooth01((u - 0.4) / 2.5);
        this.seed.visible = seedVis > 0.01;
        this.seed.scale.set(seedVis, seedVis * 1.35, seedVis);
        this.seedHalo.material.opacity = seedVis * 0.5;
        this.seedHalo.visible = seedVis > 0.01;
    }

    pxScale(px) { this.fruitU.uPx.value = px; }

    /** Season blend s in [0,4). */
    setSeason(s) {
        const i = Math.floor(s) % 4, j = (i + 1) % 4;
        const f = smooth01(((s - Math.floor(s)) - 0.85) / 0.15);
        const A = SEASON_LEAF[i], B = SEASON_LEAF[j];
        const c1 = new THREE.Color(), c2 = new THREE.Color();
        this.leafU.uTintA.value.copy(c1.setHex(A[0])).lerp(c2.setHex(B[0]), f);
        this.leafU.uTintB.value.copy(c1.setHex(A[1])).lerp(c2.setHex(B[1]), f);
        this.leafU.uBlossom.value.copy(c1.setHex(A[2])).lerp(c2.setHex(B[2]), f);
        this.leafU.uBlossomAmt.value = A[3] + (B[3] - A[3]) * f;
        this.leafU.uLeafCut.value = A[4] + (B[4] - A[4]) * f;
        this.barkU.uSnow.value = A[5] + (B[5] - A[5]) * f;
    }

    update(dt, t) {
        const sp = this.sprout.children;
        for (let i = 0; i < sp.length; i++) sp[i].userData.leaf.rotation.z = Math.sin(t * 1.4 + i) * 0.12;
        if (this.seed.visible) {
            const pulse = 1 + Math.sin(t * 2.4) * 0.08;
            this.seedHalo.scale.setScalar(0.9 * pulse);
            this.seed.material.emissiveIntensity = 0.8 + Math.sin(t * 2.4) * 0.3;
        }
    }

    /** Hit-test proxies: returns a world point on the tree if the ray hits it. */
    hit(ray) {
        const { height, crown } = this.size();
        const u = this.growth;
        // seed / sprout: a generous sphere at the base
        if (u < 12) {
            const r = Math.max(0.35, height * 0.6);
            const sphere = new THREE.Sphere(new THREE.Vector3(0, Math.max(0.15, height * 0.45), 0), r);
            const p = ray.ray.intersectSphere(sphere, new THREE.Vector3());
            return p;
        }
        // crown ellipsoid-ish sphere
        const cy = height * 0.66;
        const cr = Math.max(crown * 0.85, height * 0.35);
        const p1 = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(0, cy, 0), cr), new THREE.Vector3());
        if (p1) return p1;
        // trunk cylinder approximated by spheres up the trunk
        const tr = Math.max(0.3, 3.1 * scaleAt(u) * thickAt(u, 0.6, 75) * 1.5);
        for (let y = tr; y < cy; y += tr) {
            const p = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(0, y, 0), tr), new THREE.Vector3());
            if (p) return p;
        }
        return null;
    }
}

function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
