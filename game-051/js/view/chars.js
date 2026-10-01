/**
 * chars.js — builds a chibi 3D character from a look (data/looks.js).
 *
 * Every limb is one merged, vertex-coloured toon mesh with an outline, on a
 * pivot the animator can rotate:
 *   root ─ body(hips) ─ neck ─ head(hair, ears, horns, headwear, face)
 *        │           ├ armL / armR (hands, weapon, shield)
 *        │           ├ cape, wings, tail
 *        ├ legL / legR
 */

import * as THREE from 'three';
import { part, toonMesh, toonMat, glowMat, merge, paint, paintGradient, shade, mix } from './toon.js';
import { faceTexture, faceCap } from './face.js';

const PI = Math.PI;
const sph = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const hemi = (r, len = 0.5, w = 20, h = 10) => new THREE.SphereGeometry(r, w, h, 0, PI * 2, 0, PI * len);
const caps = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg);
const cyl = (rt, rb, h, seg = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tor = (r, t, rs = 8, ts = 24, arc = PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

/** A tube along points whose radius goes r0 → r1. */
function taper(points, r0, r1, segs = 16, radial = 8) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const c = curve.getPointAt(t);
        const r = r0 + (r1 - r0) * t;
        for (let j = 0; j <= radial; j++) {
            const k = i * (radial + 1) + j;
            v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
            pos.setXYZ(k, v.x, v.y, v.z);
        }
    }
    g.computeVertexNormals();
    return g;
}

function flatShape(pts, depth = 0.01) {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

// ---------------------------------------------------------------- dimensions

const D = {
    hipY: 0.40, legLen: 0.30, legR: 0.07,
    torsoTop: 0.42, shoulderX: 0.185, shoulderY: 0.34, armLen: 0.24, armR: 0.052, handR: 0.058,
    headR: 0.29, headY: 0.27,
};

// ---------------------------------------------------------------- hair

function hairParts(look, R) {
    const c = look.hairColor, tip = look.hairTip || c;
    const g = [];
    // the hair mass: a shell open only underneath, pushed back so the face shows through the front
    // (no open window at the front, so no dark inner ring around the face)
    const cap = (len = 0.55, sc = 1.07) => {
        g.push(part(new THREE.SphereGeometry(R * sc, 28, 16, 0, PI * 2, 0, PI * Math.min(0.92, len + 0.08)), c, [0, 0.035, -R * 0.13], [-0.1, 0, 0]));
    };
    const fringe = (n = 5, len = 0.12, spread = 0.9) => {
        for (let i = 0; i < n; i++) {
            const a = -spread / 2 + spread * (i / (n - 1));
            const geo = cone(0.07, len + (i % 2) * 0.04, 8);
            paintGradient(geo, tip, c, 1);
            g.push(part(geo, null, [Math.sin(a) * R * 0.92, R * 0.48, Math.cos(a) * R * 0.8], [PI + 0.5, a, 0]));
        }
    };
    const tail = (pts, r0, r1) => { const geo = taper(pts, r0, r1, 14, 8); paintGradient(geo, c, tip, 1, null, null); return geo; };
    switch (look.hair) {
        case 0: cap(0.52); fringe(5, 0.1, 1.0); break;
        case 1: cap(0.5);
            for (let i = 0; i < 11; i++) {
                const a = (i / 11) * PI * 2, up = 0.25 + (i % 3) * 0.2;
                const geo = cone(0.09, 0.26 + (i % 2) * 0.08, 8); paintGradient(geo, c, tip, 1);
                g.push(part(geo, null, [Math.sin(a) * R * 0.75, R * 0.62, Math.cos(a) * R * 0.75 - 0.03], [Math.cos(a) * (0.9 - up), 0, -Math.sin(a) * (0.9 - up)]));
            }
            fringe(4, 0.12, 0.8); break;
        case 2: cap(0.72, 1.08); fringe(7, 0.13, 1.4); break;
        case 3: cap(0.6, 1.08); fringe(5, 0.12, 1.0);
            g.push(part(paintGradient(caps(R * 0.62, R * 1.4, 12), tip, c, 1), null, [0, -R * 0.55, -R * 0.55], [0.12, 0, 0], [1.25, 1, 0.55]));
            for (const s of [-1, 1]) g.push(part(paintGradient(caps(0.07, R * 1.1, 8), tip, c, 1), null, [s * R * 0.9, -R * 0.35, R * 0.1], [0, 0, s * 0.08]));
            break;
        case 4: cap(0.55); fringe(5, 0.11, 1.0);
            g.push(part(sph(0.1), c, [0, R * 0.55, -R * 0.85]));
            g.push(tail([[0, R * 0.55, -R * 0.95], [0, R * 0.2, -R * 1.35], [0, -R * 0.4, -R * 1.25], [0, -R * 0.9, -R * 1.05]], 0.11, 0.03));
            break;
        case 5: cap(0.55); fringe(5, 0.11, 1.0);
            for (const s of [-1, 1]) {
                g.push(part(sph(0.08), look.c3 || c, [s * R * 0.85, R * 0.45, -R * 0.2]));
                g.push(tail([[s * R * 0.9, R * 0.42, -R * 0.2], [s * R * 1.4, R * 0.1, -R * 0.3], [s * R * 1.5, -R * 0.5, -R * 0.25], [s * R * 1.3, -R * 1.1, -R * 0.2]], 0.1, 0.025));
            }
            break;
        case 6: cap(0.55); fringe(5, 0.1, 1.0); g.push(part(sph(R * 0.38), c, [0, R * 1.05, -R * 0.2])); g.push(part(tor(R * 0.3, 0.025), look.c3 || '#d04040', [0, R * 0.85, -R * 0.15], [PI / 2 + 0.2, 0, 0])); break;
        case 7:
            for (let i = 0; i < 7; i++) {
                const a = -0.8 + i * 0.27;
                const geo = cone(0.075, 0.3, 6); paintGradient(geo, c, tip, 1);
                g.push(part(geo, null, [0, Math.cos(a) * R * 1.0, Math.sin(a) * R * 1.0], [a, 0, 0], [0.55, 1, 1]));
            }
            break;
        case 8: cap(0.62, 1.1);
            for (let i = 0; i < 14; i++) {
                const a = PI * 0.25 + (i / 13) * PI * 1.5, y = -0.2 + (i % 3) * 0.25;
                const geo = cone(0.13, 0.36, 8); paintGradient(geo, c, tip, 1);
                g.push(part(geo, null, [Math.sin(a + PI) * R * 0.95, R * y, Math.cos(a + PI) * R * 0.95], [Math.cos(a + PI) * 1.8, 0, -Math.sin(a + PI) * 1.8]));
            }
            fringe(5, 0.12, 1.0); break;
        case 9: cap(0.58); fringe(5, 0.11, 1.0);
            for (let i = 0; i < 7; i++) g.push(part(sph(0.075 - i * 0.004), i > 4 ? tip : c, [0, R * 0.2 - i * 0.13, -R * 1.02 + i * 0.015]));
            break;
        case 10: cap(0.55);
            g.push(part(paintGradient(sph(R * 0.6, 16, 10), c, tip, 0), null, [R * 0.15, R * 0.55, R * 0.45], [0.4, 0, -0.5], [1.4, 0.45, 0.8]));
            break;
        case 11: cap(0.5);
            for (let i = 0; i < 22; i++) {
                const a = (i / 22) * PI * 2, b = 0.25 + (i % 4) * 0.18;
                g.push(part(sph(0.085, 10, 8), i % 5 === 0 ? tip : c, [Math.sin(a) * Math.cos(b) * R * 1.02, Math.sin(b) * R * 1.02 + 0.03, Math.cos(a) * Math.cos(b) * R * 1.02 - 0.04]));
            }
            break;
        case 12: cap(0.55); fringe(5, 0.1, 1.0);
            for (const s of [-1, 1]) g.push(part(sph(R * 0.3), c, [s * R * 0.72, R * 0.72, -R * 0.15]));
            break;
        case 13: cap(0.62, 1.08);
            for (let i = 0; i < 7; i++) { const a = -0.75 + i * 0.25; g.push(part(box(0.09, 0.14, 0.04), c, [Math.sin(a) * R * 0.95, R * 0.42, Math.cos(a) * R * 0.86], [-0.3, a, 0])); }
            for (const s of [-1, 1]) g.push(part(paintGradient(box(0.1, R * 1.4, 0.07), tip, c, 1), null, [s * R * 0.92, -R * 0.25, R * 0.25]));
            g.push(part(paintGradient(caps(R * 0.6, R * 1.6, 12), tip, c, 1), null, [0, -R * 0.65, -R * 0.55], [0.1, 0, 0], [1.3, 1, 0.5]));
            break;
        case 14: g.push(part(new THREE.SphereGeometry(R * 1.06, 20, 10, PI * 0.15, PI * 1.7, 0, PI * 0.35), c, [0, 0.03, 0], [-0.2, 0, 0]));
            g.push(part(paintGradient(sph(R * 0.55, 14, 10), c, tip, 0), null, [R * 0.3, R * 0.62, R * 0.25], [0.2, 0, -0.6], [1.3, 0.45, 0.9]));
            break;
        default: break;
    }
    return g;
}

// ---------------------------------------------------------------- head extras

function earParts(look, R) {
    const g = [];
    const s = look.skin;
    const inner = shade(look.skin, -0.2);
    for (const k of [-1, 1]) {
        switch (look.ears) {
            case 'human': g.push(part(sph(0.06, 10, 8), s, [k * R * 0.97, -0.02, 0], [0, 0, 0], [0.5, 0.9, 0.7])); break;
            case 'elf': g.push(part(cone(0.06, 0.32, 8), s, [k * R * 1.05, 0.02, -0.02], [0.2, 0, -k * 1.25], [1, 1, 0.45])); break;
            case 'cat': case 'wolf': case 'fox': {
                const h = look.ears === 'cat' ? 0.2 : look.ears === 'wolf' ? 0.26 : 0.3;
                const base = look.ears === 'fox' ? 0.12 : 0.1;
                g.push(part(cone(base, h, 4), look.hairColor, [k * R * 0.55, R * 0.88, -0.02], [0, PI / 4, -k * 0.35], [1, 1, 0.5]));
                g.push(part(cone(base * 0.6, h * 0.7, 4), look.ears === 'fox' ? '#fff4ea' : inner, [k * R * 0.55, R * 0.86, 0.025], [0, PI / 4, -k * 0.35], [1, 1, 0.4]));
                break;
            }
            case 'bunny':
                g.push(part(caps(0.06, 0.32, 8), look.hairColor, [k * R * 0.35, R * 1.25, -0.05], [-0.2, 0, -k * 0.2], [1, 1, 0.6]));
                g.push(part(caps(0.035, 0.26, 8), '#ffc0d0', [k * R * 0.35, R * 1.25, -0.02], [-0.2, 0, -k * 0.2], [1, 1, 0.4]));
                break;
            case 'fin':
                g.push(part(cone(0.12, 0.28, 3), mix(look.skin, '#3a8aff', 0.35), [k * R * 1.0, 0.04, -0.05], [0, 0, -k * 1.4], [1, 1, 0.25]));
                break;
            default: break;
        }
    }
    return g;
}

function hornParts(look, R) {
    const c = look.hornColor || '#f0e6d0';
    const tipC = shade(c, -0.35);
    const g = [];
    const curved = (k, pts, r0, r1) => { const geo = taper(pts.map(([x, y, z]) => [x * k, y, z]), r0, r1, 14, 8); paintGradient(geo, c, tipC, 1); return geo; };
    for (const k of [-1, 1]) {
        switch (look.horns) {
            case 1: g.push(part(cone(0.05, 0.1, 8), c, [k * R * 0.42, R * 0.86, 0.05], [0.2, 0, -k * 0.3])); break;
            case 2: g.push(curved(k, [[R * 0.42, R * 0.8, 0.02], [R * 0.6, R * 1.15, -0.05], [R * 0.85, R * 1.3, -0.2], [R * 1.0, R * 1.25, -0.35]], 0.06, 0.012)); break;
            case 3: g.push(curved(k, [[R * 0.55, R * 0.7, 0], [R * 0.95, R * 0.95, -0.12], [R * 1.15, R * 0.6, -0.2], [R * 1.0, R * 0.3, -0.05], [R * 0.95, R * 0.35, 0.08]], 0.07, 0.025)); break;
            case 5: g.push(curved(k, [[R * 0.4, R * 0.85, 0], [R * 0.55, R * 1.2, -0.12], [R * 0.6, R * 1.5, -0.4], [R * 0.5, R * 1.65, -0.7]], 0.065, 0.01)); break;
            case 6:
                g.push(curved(k, [[R * 0.35, R * 0.85, 0], [R * 0.6, R * 1.25, -0.05], [R * 0.85, R * 1.55, -0.1]], 0.03, 0.015));
                g.push(curved(k, [[R * 0.55, R * 1.15, -0.04], [R * 0.9, R * 1.2, 0.05], [R * 1.05, R * 1.35, 0.08]], 0.022, 0.01));
                g.push(curved(k, [[R * 0.72, R * 1.4, -0.08], [R * 0.7, R * 1.7, 0.02]], 0.02, 0.008));
                break;
            default: break;
        }
    }
    if (look.horns === 4) { const geo = cone(0.06, 0.38, 12); paintGradient(geo, c, '#ffffff', 1); g.push(part(geo, null, [0, R * 1.05, R * 0.45], [0.55, 0, 0])); }
    return g;
}

function headwearParts(look, R, glow) {
    const g = [];
    const m = look.metal, c1 = look.c1, c2 = look.c2, c3 = look.c3;
    switch (look.headwear) {
        case 'helm':
            g.push(part(new THREE.SphereGeometry(R * 1.12, 22, 14, 0, PI * 2, 0, PI * 0.5), m, [0, 0.02, 0]));
            g.push(part(tor(R * 1.1, 0.03, 6, 28), shade(m, -0.2), [0, 0.03, 0], [PI / 2, 0, 0]));
            g.push(part(box(0.05, R * 0.55, 0.06), shade(m, -0.15), [0, R * 0.15, R * 1.08]));
            g.push(part(cone(0.09, 0.32, 4), c1, [0, R * 1.2, -0.05], [-0.3, 0, 0], [0.4, 1, 1.6]));
            break;
        case 'hood':
            g.push(part(new THREE.SphereGeometry(R * 1.14, 24, 14, PI * 0.88, PI * 1.24, 0, PI * 0.66), c1, [0, 0.02, -0.03], [-0.25, 0, 0]));
            g.push(part(cone(R * 0.55, R * 0.8, 12), c1, [0, R * 0.45, -R * 0.85], [-1.9, 0, 0], [1, 1, 0.6]));
            break;
        case 'wizard': {
            g.push(part(cyl(R * 1.55, R * 1.6, 0.04, 28), c1, [0, R * 0.62, 0], [-0.1, 0, 0]));
            const hat = taper([[0, R * 0.6, 0], [0, R * 1.3, -0.05], [0.05, R * 1.9, -0.15], [0.22, R * 2.2, -0.3]], R * 0.85, 0.03, 16, 14);
            paintGradient(hat, c1, shade(c1, -0.2), 1);
            g.push(hat);
            g.push(part(tor(R * 0.83, 0.045, 6, 28), c3, [0, R * 0.7, 0], [PI / 2 - 0.1, 0, 0]));
            break;
        }
        case 'circlet':
            g.push(part(tor(R * 1.02, 0.022, 6, 32), m, [0, R * 0.32, 0], [PI / 2 + 0.25, 0, 0]));
            glow.push(part(sph(0.045, 10, 8), look.glow, [0, R * 0.55, R * 0.95]));
            break;
        case 'crown':
            g.push(part(cyl(R * 0.75, R * 0.7, 0.14, 20, true), '#ffd24a', [0, R * 0.95, 0]));
            for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; g.push(part(cone(0.04, 0.13, 6), '#ffd24a', [Math.sin(a) * R * 0.74, R * 0.95 + 0.12, Math.cos(a) * R * 0.74])); }
            glow.push(part(sph(0.04, 8, 6), look.glow, [0, R * 0.95, R * 0.76]));
            break;
        case 'band':
            g.push(part(tor(R * 1.02, 0.035, 6, 32), c3, [0, R * 0.38, 0], [PI / 2 + 0.2, 0, 0]));
            for (const s of [-1, 1]) g.push(part(box(0.05, 0.22, 0.015), c3, [s * 0.05, R * 0.2, -R * 1.0], [0.3, 0, s * 0.3]));
            break;
        case 'cap':
            g.push(part(new THREE.SphereGeometry(R * 1.1, 18, 10, 0, PI * 2, 0, PI * 0.42), c2, [0, 0.06, 0], [-0.25, 0, 0]));
            g.push(part(cone(R * 0.4, R * 0.5, 10), c2, [0, R * 0.7, -R * 0.6], [-2.0, 0, 0]));
            break;
        case 'feathercap':
            g.push(part(sph(R * 0.95, 18, 10), c1, [R * 0.15, R * 0.62, 0], [0, 0, -0.3], [1.2, 0.35, 1.1]));
            g.push(part(paintGradient(caps(0.04, 0.42, 8), c3, '#ffffff', 1), null, [R * 0.75, R * 0.95, -R * 0.2], [0.3, 0, -0.9], [1, 1, 0.35]));
            break;
        case 'mask':
            g.push(part(new THREE.SphereGeometry(R * 1.04, 20, 8, PI * 0.18, PI * 0.64, PI * 0.58, PI * 0.25), c2, [0, 0, 0]));
            break;
        case 'antlers':
            for (const k of [-1, 1]) {
                g.push(taper([[k * R * 0.35, R * 0.8, 0], [k * R * 0.65, R * 1.2, -0.05], [k * R * 0.95, R * 1.55, -0.1]], 0.035, 0.015));
                g.push(taper([[k * R * 0.55, R * 1.1, -0.03], [k * R * 0.9, R * 1.18, 0.05]], 0.025, 0.01));
            }
            g.push(part(tor(R * 0.95, 0.03, 6, 24), '#5a8a3a', [0, R * 0.42, 0], [PI / 2 + 0.25, 0, 0]));
            g.forEach((x) => { if (!x.attributes.color) paint(x, '#8a6a4a'); });
            break;
        case 'wreath':
            for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; g.push(part(sph(0.06, 8, 6), i % 3 ? '#4fa84a' : '#e8e070', [Math.sin(a) * R * 0.95, R * 0.42 + Math.cos(a) * 0.04, Math.cos(a) * R * 0.95 - 0.02], [0, a, 0], [1.3, 0.6, 0.7])); }
            break;
        case 'horns':
            g.push(part(new THREE.SphereGeometry(R * 1.14, 22, 14, PI * 0.7, PI * 1.6, 0, PI * 0.7), c1, [0, 0.02, -0.02]));
            for (const k of [-1, 1]) { const geo = taper([[k * R * 0.6, R * 0.8, 0], [k * R * 1.0, R * 1.1, -0.1], [k * R * 1.15, R * 1.45, -0.25]], 0.06, 0.012); paint(geo, look.hornColor || '#2a2028'); g.push(geo); }
            break;
        default: break;
    }
    return g;
}

// ---------------------------------------------------------------- outfits

function legParts(look, k) {
    const g = [];
    const L = D.legLen, r = D.legR * (0.92 + 0.08 * look.build);
    const o = look.outfit;
    const pants = { plate: shade(look.c2, -0.1), leather: look.c2, robe: look.c2, cloak: look.c2, tunic: shade(look.c2, 0.1), gi: look.c1, priest: look.c2, bard: look.c2, necro: look.c2, druid: shade(look.c2, -0.1) }[o];
    g.push(part(caps(r, L - r, 10), pants, [0, -L / 2, 0], [0, 0, 0], [1, 1, 1]));
    const bootC = o === 'plate' ? look.metal : shade(look.c2, -0.35);
    g.push(part(sph(r * 1.35, 14, 10), bootC, [0, -L + 0.02, 0.035], [0, 0, 0], [1, 0.7, 1.45]));
    if (o === 'plate') g.push(part(cyl(r * 1.25, r * 1.3, 0.14, 12), look.metal, [0, -L + 0.12, 0]));
    if (o === 'gi') g.push(part(cyl(r * 1.4, r * 1.1, 0.16, 12), look.c1, [0, -0.09, 0]));
    if (look.race === 'golem') g.push(part(box(r * 2.4, 0.1, r * 2.4), shade(look.skin, -0.15), [0, -0.1, 0]));
    return g;
}

function torsoParts(look) {
    const g = [], glow = [];
    const b = look.build, c1 = look.c1, c2 = look.c2, c3 = look.c3, m = look.metal, skin = look.skin;
    const T = D.torsoTop;
    const body = lathe([[0.001, -0.06], [0.13, -0.04], [0.142, 0.06], [0.13, 0.16], [0.15, 0.27], [0.155, 0.33], [0.12, 0.4], [0.055, T], [0.001, T + 0.01]]);
    const torsoColor = { plate: m, leather: c2, robe: c1, cloak: c1, tunic: c1, gi: c1, priest: c1, bard: c1, necro: c1, druid: c1 }[look.outfit];
    g.push(part(body, torsoColor, [0, 0, 0], [0, 0, 0], [b, 1, b * 0.88]));
    g.push(part(cyl(0.05, 0.055, 0.08, 10), skin, [0, T + 0.02, 0]));
    const belt = (col, y = 0.05) => g.push(part(tor(0.142 * b, 0.022, 6, 24), col, [0, y, 0], [PI / 2, 0, 0], [1, 0.88, 1]));
    const skirt = (top, bottom, len, col, y = 0.04) => g.push(part(cyl(top * b, bottom * b, len, 22, true), col, [0, y - len / 2, 0]));
    switch (look.outfit) {
        case 'plate':
            g.push(part(sph(0.15, 16, 12), shade(m, 0.15), [0, 0.25, 0.06], [0, 0, 0], [b * 0.95, 0.85, 0.6]));
            g.push(part(tor(0.11, 0.015, 6, 20, PI), c3, [0, 0.33, 0.1], [0.3, 0, 0], [b, 1, 1]));
            belt(c2); skirt(0.145, 0.19, 0.14, c1, 0.06);
            glow.push(part(sph(0.03, 8, 6), look.glow, [0, 0.24, 0.155]));
            break;
        case 'leather':
            g.push(part(lathe([[0.001, 0.08], [0.15, 0.1], [0.158, 0.3], [0.12, 0.39], [0.001, 0.39]]), c1, [0, 0, 0.01], [0, 0, 0], [b * 1.04, 1, b * 0.88]));
            belt(shade(c2, -0.3), 0.08);
            g.push(part(box(0.05, 0.04, 0.03), c3, [0, 0.08, 0.135]));
            g.push(part(box(0.025, 0.36, 0.02), shade(c2, -0.35), [0.03, 0.23, 0.13], [0, 0, 0.6]));
            break;
        case 'robe':
            skirt(0.14, 0.27, 0.42, c1, 0.06);
            g.push(part(tor(0.27 * b, 0.022, 6, 28), c3, [0, -0.35, 0], [PI / 2, 0, 0]));
            g.push(part(box(0.06, 0.4, 0.02), c3, [0, 0.18, 0.14]));
            belt(c2, 0.08);
            break;
        case 'cloak':
            g.push(part(cyl(0.11, 0.2, 0.2, 18), c1, [0, 0.32, 0], [0, 0, 0], [b, 1, 0.9]));
            g.push(part(tor(0.08, 0.04, 8, 18), c2, [0, T - 0.03, 0.01], [PI / 2 + 0.2, 0, 0], [1.3, 1, 1]));
            belt(shade(c2, -0.2), 0.07); skirt(0.14, 0.2, 0.16, c1, 0.07);
            break;
        case 'tunic':
            skirt(0.14, 0.22, 0.2, c1, 0.06); belt(c2, 0.07);
            g.push(part(box(0.04, 0.03, 0.02), c3, [0, 0.07, 0.145]));
            g.push(part(tor(0.07, 0.02, 6, 16), c3, [0, T - 0.04, 0.02], [PI / 2 + 0.3, 0, 0]));
            break;
        case 'gi':
            g.push(part(box(0.24 * b, 0.34, 0.02), shade(c1, -0.1), [0, 0.22, 0.13], [0, 0, 0], [1, 1, 1]));
            g.push(part(box(0.05, 0.34, 0.03), c2, [0.03, 0.22, 0.142], [0, 0, 0.45]));
            g.push(part(tor(0.142 * b, 0.032, 6, 24), c2, [0, 0.08, 0], [PI / 2, 0, 0], [1, 0.88, 1]));
            g.push(part(box(0.06, 0.14, 0.02), c2, [0.08, -0.02, 0.13], [0, 0, 0.15]));
            break;
        case 'priest':
            skirt(0.14, 0.26, 0.42, c1, 0.06);
            g.push(part(box(0.07, 0.8, 0.02), c3, [0, -0.02, 0.15], [0.08, 0, 0]));
            g.push(part(tor(0.13, 0.03, 6, 20), c2, [0, T - 0.06, 0.0], [PI / 2 + 0.15, 0, 0], [1.1, 1, 1]));
            glow.push(part(sph(0.03, 8, 6), look.glow, [0, 0.3, 0.16]));
            break;
        case 'bard':
            g.push(part(lathe([[0.001, 0.05], [0.155, 0.07], [0.16, 0.3], [0.12, 0.39], [0.001, 0.39]]), c1, [0, 0, 0.005], [0, 0, 0], [b * 1.04, 1, b * 0.9]));
            for (let i = 0; i < 3; i++) g.push(part(sph(0.018, 8, 6), c3, [0, 0.14 + i * 0.08, 0.16]));
            belt(c2, 0.06); skirt(0.14, 0.2, 0.12, c2, 0.05);
            g.push(part(tor(0.08, 0.035, 8, 18), '#ffffff', [0, T - 0.03, 0.01], [PI / 2 + 0.2, 0, 0], [1.2, 1, 1]));
            break;
        case 'necro':
            skirt(0.14, 0.28, 0.43, c1, 0.06);
            g.push(part(cone(0.24, 0.24, 18, true), c2, [0, T + 0.02, -0.04], [PI + 0.25, 0, 0], [b, 1, 0.8]));
            for (let i = 0; i < 4; i++) g.push(part(box(0.27 * b, 0.02, 0.02), c3, [0, -0.34 + i * 0.012, 0.0], [0, i * 0.4, 0]));
            belt(c3, 0.08);
            glow.push(part(sph(0.03, 8, 6), look.glow, [0, 0.08, 0.15]));
            break;
        case 'druid':
            skirt(0.14, 0.23, 0.22, c1, 0.06);
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * PI * 2;
                g.push(part(sph(0.06, 8, 6), i % 2 ? c2 : shade(c1, 0.15), [Math.sin(a) * 0.2 * b, -0.12 - (i % 3) * 0.03, Math.cos(a) * 0.2 * b], [0.4, a, 0], [1, 0.4, 1.6]));
            }
            for (let i = 0; i < 5; i++) g.push(part(sph(0.045, 8, 6), shade(c1, 0.2), [-0.08 + i * 0.04, 0.33 - Math.abs(i - 2) * 0.03, 0.12], [0, 0, 0], [1, 0.5, 0.6]));
            belt(shade(c2, -0.2), 0.07);
            break;
        default: break;
    }
    // shoulders
    if (look.shoulders) {
        for (const k of [-1, 1]) {
            g.push(part(new THREE.SphereGeometry(0.085, 14, 10, 0, PI * 2, 0, PI * 0.55), look.outfit === 'necro' ? c3 : m, [k * 0.17 * b, D.shoulderY + 0.04, 0], [0, 0, -k * 0.5], [1.15, 1, 1.05]));
            if (look.shoulders === 2) for (let i = 0; i < 3; i++) g.push(part(cone(0.022, 0.1, 6), shade(m, 0.2), [k * (0.19 + i * 0.01) * b, D.shoulderY + 0.1, -0.04 + i * 0.04], [0, 0, -k * 0.6]));
        }
    }
    if (look.race === 'golem') {
        for (let i = 0; i < 3; i++) glow.push(part(box(0.05, 0.015, 0.01), look.glow, [-0.06 + i * 0.06, 0.22 - (i % 2) * 0.05, 0.15]));
    }
    return { g, glow };
}

function armParts(look, k) {
    const g = [];
    const L = D.armLen, r = D.armR * (0.9 + 0.1 * look.build);
    const sleeve = { plate: look.metal, leather: shade(look.skin, 0), robe: look.c1, cloak: look.c1, tunic: look.c1, gi: look.c1, priest: look.c1, bard: look.c2, necro: look.c1, druid: look.skin }[look.outfit];
    const bare = sleeve === look.skin;
    g.push(part(caps(r, L - r, 10), bare ? look.skin : sleeve, [0, -L / 2, 0]));
    if (['robe', 'priest', 'necro'].includes(look.outfit)) g.push(part(cyl(r * 1.15, r * 1.8, L * 0.5, 18, true), look.c1, [0, -L * 0.7, 0]));
    if (look.outfit === 'bard') g.push(part(sph(r * 1.8, 12, 10), look.c1, [0, -0.02, 0]));
    if (look.outfit === 'leather' || look.outfit === 'druid') g.push(part(cyl(r * 1.15, r * 1.2, 0.08, 10), shade(look.c2, -0.2), [0, -L + 0.06, 0]));
    const handC = look.outfit === 'plate' ? look.metal : look.weapon === 'knuckles' ? look.metal : look.race === 'golem' ? shade(look.skin, -0.1) : look.skin;
    g.push(part(sph(D.handR * (look.outfit === 'plate' ? 1.15 : 1), 12, 10), handC, [0, -L - 0.01, 0]));
    if (look.weapon === 'knuckles') for (let i = 0; i < 3; i++) g.push(part(cone(0.018, 0.06, 6), '#e8e8f0', [-0.025 + i * 0.025, -L - 0.03, 0.055], [PI / 2, 0, 0]));
    return g;
}

// ---------------------------------------------------------------- weapons

function weaponParts(look, which) {
    const g = [], glow = [];
    const m = look.metal, c1 = look.c1, c3 = look.c3, grip = shade(look.c2, -0.3), gl = look.glow;
    const w = look.weapon;
    if (which === 'L') {
        if (w === 'daggers') {
            g.push(part(box(0.03, 0.09, 0.03), grip, [0, 0.0, 0]));
            g.push(part(box(0.08, 0.02, 0.03), c3, [0, 0.05, 0]));
            g.push(part(cone(0.03, 0.22, 4), m, [0, 0.17, 0], [0, PI / 4, 0], [1, 1, 0.3]));
        }
        if (w === 'tome') {
            g.push(part(box(0.18, 0.22, 0.06), c1, [0, 0.05, 0.05]));
            g.push(part(box(0.16, 0.2, 0.05), '#f4ead0', [0.012, 0.05, 0.05]));
            glow.push(part(sph(0.03, 8, 6), gl, [0, 0.05, 0.085], [0, 0, 0], [1, 1, 0.3]));
        }
        return { g, glow };
    }
    switch (w) {
        case 'sword':
            g.push(part(cyl(0.018, 0.02, 0.12, 8), grip, [0, 0, 0]));
            g.push(part(box(0.18, 0.03, 0.04), c3, [0, 0.07, 0]));
            g.push(part(sph(0.025, 8, 6), c3, [0, -0.07, 0]));
            g.push(part(box(0.055, 0.46, 0.014), m, [0, 0.31, 0]));
            g.push(part(cone(0.039, 0.08, 4), m, [0, 0.58, 0], [0, PI / 4, 0], [1, 1, 0.26]));
            break;
        case 'greatsword':
            g.push(part(cyl(0.02, 0.022, 0.2, 8), grip, [0, 0, 0]));
            g.push(part(box(0.26, 0.04, 0.05), c3, [0, 0.11, 0]));
            g.push(part(box(0.09, 0.7, 0.018), m, [0, 0.48, 0]));
            g.push(part(cone(0.064, 0.12, 4), m, [0, 0.89, 0], [0, PI / 4, 0], [1, 1, 0.2]));
            glow.push(part(box(0.02, 0.55, 0.02), gl, [0, 0.45, 0]));
            break;
        case 'axe':
            g.push(part(cyl(0.02, 0.022, 0.6, 8), grip, [0, 0.2, 0]));
            g.push(part(cyl(0.16, 0.16, 0.025, 20, false), m, [0.08, 0.42, 0], [PI / 2, 0, 0], [1, 1.25, 1]));
            g.push(part(box(0.06, 0.12, 0.04), shade(m, -0.2), [0, 0.42, 0]));
            break;
        case 'hammer':
            g.push(part(cyl(0.022, 0.025, 0.55, 8), grip, [0, 0.18, 0]));
            g.push(part(box(0.26, 0.15, 0.15), m, [0, 0.48, 0]));
            g.push(part(box(0.28, 0.04, 0.17), c3, [0, 0.48, 0]));
            break;
        case 'spear':
            g.push(part(cyl(0.018, 0.018, 1.0, 8), grip, [0, 0.25, 0]));
            g.push(part(cone(0.05, 0.22, 4), m, [0, 0.86, 0], [0, PI / 4, 0], [1, 1, 0.35]));
            g.push(part(tor(0.035, 0.012, 6, 12), c3, [0, 0.74, 0], [PI / 2, 0, 0]));
            break;
        case 'bow': {
            const arc = taper([[0, -0.36, 0], [0, -0.2, 0.12], [0, 0, 0.16], [0, 0.2, 0.12], [0, 0.36, 0]], 0.022, 0.022, 20, 6);
            paint(arc, c1);
            g.push(arc);
            g.push(part(cyl(0.004, 0.004, 0.72, 4), '#f0f0f0', [0, 0, -0.01]));
            g.push(part(box(0.04, 0.1, 0.04), grip, [0, 0, 0.16]));
            break;
        }
        case 'staff':
            g.push(part(cyl(0.022, 0.026, 1.05, 8), c1 === '#f4f0e4' ? '#8a6a4a' : shade(look.c2, 0.1), [0, 0.2, 0]));
            for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; g.push(part(cone(0.02, 0.16, 6), c3, [Math.sin(a) * 0.05, 0.78, Math.cos(a) * 0.05], [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4])); }
            glow.push(part(sph(0.075, 14, 12), gl, [0, 0.82, 0]));
            break;
        case 'wand':
            g.push(part(cyl(0.012, 0.016, 0.32, 8), shade(look.c2, 0.2), [0, 0.08, 0]));
            g.push(part(tor(0.03, 0.01, 6, 12), c3, [0, 0.24, 0], [PI / 2, 0, 0]));
            glow.push(part(new THREE.OctahedronGeometry(0.045), gl, [0, 0.3, 0], [0, 0, 0], [1, 1.5, 1]));
            break;
        case 'daggers':
            g.push(part(box(0.03, 0.09, 0.03), grip, [0, 0.0, 0]));
            g.push(part(box(0.08, 0.02, 0.03), c3, [0, 0.05, 0]));
            g.push(part(cone(0.03, 0.22, 4), m, [0, 0.17, 0], [0, PI / 4, 0], [1, 1, 0.3]));
            break;
        case 'mace':
            g.push(part(cyl(0.02, 0.022, 0.4, 8), grip, [0, 0.12, 0]));
            g.push(part(new THREE.IcosahedronGeometry(0.09, 1), m, [0, 0.36, 0]));
            for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; g.push(part(cone(0.025, 0.07, 6), c3, [Math.sin(a) * 0.09, 0.36, Math.cos(a) * 0.09], [Math.cos(a) * PI / 2, 0, -Math.sin(a) * PI / 2])); }
            break;
        case 'lute':
            g.push(part(sph(0.13, 16, 12), '#b07040', [0, 0.02, 0.08], [0, 0, 0], [1, 1.2, 0.45]));
            g.push(part(sph(0.035, 10, 8), '#2a1a10', [0, 0.04, 0.14], [0, 0, 0], [1, 1, 0.3]));
            g.push(part(box(0.05, 0.32, 0.03), '#5a3a20', [0, 0.28, 0.08]));
            g.push(part(box(0.07, 0.08, 0.04), c3, [0, 0.46, 0.06], [0.4, 0, 0]));
            break;
        case 'scythe': {
            g.push(part(cyl(0.02, 0.022, 1.0, 8), shade(look.c2, 0.1), [0, 0.22, 0]));
            const blade = taper([[0, 0.7, 0.02], [0.18, 0.78, 0.0], [0.38, 0.7, 0], [0.5, 0.52, 0]], 0.05, 0.005, 16, 6);
            paint(blade, m);
            blade.scale(1, 1, 0.3);
            g.push(blade);
            glow.push(part(box(0.06, 0.02, 0.02), gl, [0.02, 0.7, 0]));
            break;
        }
        case 'tome':
            g.push(part(box(0.2, 0.25, 0.07), c1, [0, 0.06, 0.06], [0.2, 0, 0]));
            g.push(part(box(0.18, 0.23, 0.06), '#f4ead0', [0.012, 0.06, 0.06], [0.2, 0, 0]));
            glow.push(part(sph(0.035, 8, 6), gl, [0, 0.06, 0.1], [0, 0, 0], [1, 1, 0.3]));
            break;
        default: break;
    }
    return { g, glow };
}

function shieldParts(look) {
    const g = [];
    g.push(part(cyl(0.19, 0.19, 0.035, 22), look.c1, [0, 0, 0], [PI / 2, 0, 0], [1, 1.18, 1]));
    g.push(part(tor(0.19, 0.02, 6, 26), look.metal, [0, 0, 0.0], [0, 0, 0], [1, 1.18, 1]));
    g.push(part(sph(0.05, 10, 8), look.c3, [0, 0, 0.025], [0, 0, 0], [1, 1, 0.4]));
    g.push(part(box(0.03, 0.3, 0.01), look.c3, [0, 0, 0.02]));
    return g;
}

// ---------------------------------------------------------------- back

function tailGeo(look) {
    const c = look.tail === 3 ? look.skin : look.tail === 4 ? shade(look.skin, -0.25) : look.hairColor;
    const g = [];
    switch (look.tail) {
        case 1: { const t = taper([[0, 0, 0], [0, 0.05, -0.15], [0, 0.22, -0.3], [0.05, 0.42, -0.28]], 0.035, 0.03, 16, 8); paint(t, c); g.push(t); g.push(part(sph(0.04, 8, 6), c, [0.05, 0.43, -0.28])); break; }
        case 2: for (let i = 0; i < 6; i++) g.push(part(sph(0.07 + i * 0.012, 12, 10), i > 4 ? '#fff4ea' : c, [0, 0.03 + i * 0.06, -0.12 - i * 0.04 + (i > 3 ? (i - 3) * 0.02 : 0)])); break;
        case 3: { const t = taper([[0, 0, 0], [0, -0.1, -0.2], [0, -0.25, -0.42], [0.1, -0.33, -0.6]], 0.08, 0.015, 18, 10); paint(t, c); g.push(t);
            for (let i = 0; i < 4; i++) g.push(part(cone(0.025, 0.07, 4), look.hornColor || shade(c, -0.3), [0, -0.02 - i * 0.07, -0.12 - i * 0.12], [-0.6, 0, 0])); break; }
        case 4: { const t = taper([[0, 0, 0], [0, -0.05, -0.2], [0, 0.1, -0.38], [0, 0.3, -0.42]], 0.025, 0.018, 16, 6); paint(t, c); g.push(t);
            g.push(part(cone(0.06, 0.12, 4), c, [0, 0.36, -0.42], [0, 0, 0], [1, 1, 0.3])); break; }
        default: break;
    }
    return g;
}

function wingMesh(look, k, flash) {
    const c = look.wingColor || '#3a2a40';
    const grp = new THREE.Group();
    const s = k;
    if (look.wings === 1 || look.wings === 4) {
        const big = look.wings === 4 ? 1.35 : 1;
        const mem = flatShape([[0, 0], [0.25 * big, 0.2 * big], [0.55 * big, 0.3 * big], [0.6 * big, 0.05 * big], [0.45 * big, -0.05 * big], [0.35 * big, -0.15 * big], [0.2 * big, -0.08 * big], [0.1 * big, -0.15 * big]], 0.008);
        paint(mem, c);
        const bones = [];
        for (const [x, y] of [[0.55, 0.3], [0.6, 0.05], [0.35, -0.15]]) {
            bones.push(taper([[0, 0, 0.004], [x * big * 0.5, y * big * 0.5 + 0.06, 0.004], [x * big, y * big, 0.004]], 0.018, 0.006, 8, 5));
        }
        bones.forEach((b) => paint(b, shade(c, -0.35)));
        const m = toonMesh([mem, ...bones], { side: THREE.DoubleSide, flash, outline: 0.008 });
        grp.add(m);
    } else if (look.wings === 2) {
        const geos = [];
        for (let i = 0; i < 7; i++) {
            const a = 0.9 - i * 0.22;
            const len = 0.35 - i * 0.025;
            const f = sph(0.08, 10, 8);
            paintGradient(f, shade(c, -0.15), shade(c, 0.35), 0);
            geos.push(part(f, null, [Math.cos(a) * len * 0.6, Math.sin(a) * len * 0.6, 0], [0, 0, a], [len * 7, 0.7, 0.25]));
        }
        grp.add(toonMesh(geos, { flash, outline: 0.008 }));
    } else if (look.wings === 3) {
        const geo = merge([
            part(flatShape([[0, 0], [0.18, 0.32], [0.38, 0.38], [0.42, 0.22], [0.22, 0.05]], 0.004), c),
            part(flatShape([[0, 0], [0.24, -0.06], [0.3, -0.22], [0.15, -0.24]], 0.004), shade(c, 0.2)),
        ]);
        const m = new THREE.Mesh(geo, glowMat({ transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        grp.add(m);
    }
    grp.scale.x = s;
    return grp;
}

function capeMesh(look, flash) {
    const len = look.cape === 1 ? 0.45 : 0.82;
    const geo = new THREE.PlaneGeometry(0.4, len, 6, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const t = (len / 2 - y) / len;
        let z = -Math.pow(t, 1.4) * 0.12 - Math.cos((x / 0.2) * PI * 0.5) * 0.04;
        let ny = y;
        if (look.cape === 3 && t > 0.8) ny -= (Math.abs(Math.sin(x * 40)) * 0.08);
        pos.setXYZ(i, x * (1 + t * 0.6), ny - len / 2, z);
    }
    geo.computeVertexNormals();
    paintGradient(geo, shade(look.c1, -0.25), look.c1, 1);
    const trim = part(new THREE.BoxGeometry(0.42, 0.04, 0.03), look.c3, [0, -0.01, -0.02]);
    const m = toonMesh([geo, trim], { side: THREE.DoubleSide, flash, outline: 0.006 });
    return m;
}

// ---------------------------------------------------------------- assembly

/**
 * Returns a rig: { root, body, neck, head, armL, armR, legL, legR, cape, tail,
 *   wingL, wingR, weapon, offhand, face, flash, setExpression, height, look }
 */
export function buildCharacter(look, opts = {}) {
    const flash = { value: 0 };
    const flashColor = { value: new THREE.Color('#ffffff') };
    const M = (geos, o = {}) => toonMesh(geos, { flash, flashColor, ...o });
    const root = new THREE.Group();
    root.name = 'character';
    const holder = new THREE.Group(); // scaled by height
    root.add(holder);
    const H = look.height || 1;
    holder.scale.setScalar(H);

    // legs
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(0.075 * look.build, D.hipY, 0);
    legR.position.set(-0.075 * look.build, D.hipY, 0);
    legL.add(M(legParts(look, 1)));
    legR.add(M(legParts(look, -1)));
    holder.add(legL, legR);

    // body
    const body = new THREE.Group();
    body.position.y = D.hipY - 0.02;
    holder.add(body);
    const tp = torsoParts(look);
    body.add(M(tp.g));
    if (tp.glow.length) body.add(new THREE.Mesh(merge(tp.glow), glowMat()));

    // head
    const neck = new THREE.Group();
    neck.position.y = D.torsoTop + 0.03;
    body.add(neck);
    const head = new THREE.Group();
    head.position.y = D.headY * (look.head || 1);
    head.scale.setScalar(look.head || 1);
    neck.add(head);
    const R = D.headR;
    const headGeos = [part(sph(R, 28, 22), look.skin, [0, 0, 0], [0, 0, 0], [1, 0.96, 0.98])];
    if (look.race === 'golem') {
        headGeos.push(part(box(R * 1.3, R * 0.16, R * 0.5), shade(look.skin, -0.15), [0, R * 0.42, R * 0.72], [0.35, 0, 0]));
        for (const k of [-1, 1]) headGeos.push(part(new THREE.IcosahedronGeometry(R * 0.28, 0), shade(look.skin, -0.08), [k * R * 0.78, R * 0.25, -R * 0.2]));
    }
    if (look.race === 'dragonkin') headGeos.push(part(sph(R * 0.38, 12, 10), look.skin, [0, -R * 0.35, R * 0.72], [0, 0, 0], [1, 0.6, 0.8]));
    if (look.beard >= 2) {
        headGeos.push(part(sph(R * 0.6, 14, 10), look.hairColor, [0, -R * 0.55, R * 0.45], [0.3, 0, 0], [1.1, 1, 0.75]));
        if (look.beard === 3) headGeos.push(part(caps(0.05, 0.2, 8), shade(look.hairColor, 0.1), [0, -R * 1.05, R * 0.55], [0.2, 0, 0]));
    }
    if (look.tusks) for (const k of [-1, 1]) headGeos.push(part(cone(0.025, 0.08, 6), '#fff4e0', [k * R * 0.32, -R * 0.42, R * 0.85], [-0.2, 0, k * 0.2]));
    headGeos.push(...earParts(look, R), ...hairParts(look, R), ...hornParts(look, R));
    const hwGlow = [];
    headGeos.push(...headwearParts(look, R, hwGlow));
    head.add(M(headGeos, { outline: 0.014 }));
    if (hwGlow.length) head.add(new THREE.Mesh(merge(hwGlow), glowMat()));
    // face decal
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(look), transparent: true, alphaTest: 0.35, depthWrite: false });
    const face = new THREE.Mesh(faceCap(R), faceMat);
    face.scale.set(1, 0.96, 0.98);
    face.renderOrder = 2;
    head.add(face);

    // arms
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(D.shoulderX * look.build, D.shoulderY, 0);
    armR.position.set(-D.shoulderX * look.build, D.shoulderY, 0);
    armL.rotation.z = 0.18; armR.rotation.z = -0.18;
    armL.add(M(armParts(look, 1)));
    armR.add(M(armParts(look, -1)));
    body.add(armL, armR);

    // weapon in the right hand (character's right = -x)
    const weapon = new THREE.Group();
    weapon.position.set(0, -D.armLen - 0.01, 0.01);
    weapon.rotation.x = PI / 2 - 0.35;
    weapon.scale.setScalar(1.3);
    const wp = weaponParts(look, 'R');
    if (wp.g.length) weapon.add(M(wp.g, { outline: 0.01 }));
    if (wp.glow.length) weapon.add(new THREE.Mesh(merge(wp.glow), glowMat()));
    if (look.weapon === 'bow') { weapon.rotation.set(0, 0, 0); armR.rotation.z = -0.5; }
    if (look.weapon === 'lute') { weapon.rotation.set(0.2, 0, 0.9); weapon.position.set(0.12, -0.12, 0.12); }
    armR.add(weapon);
    // off-hand
    const offhand = new THREE.Group();
    offhand.position.set(0, -D.armLen - 0.01, 0.01);
    if (look.shield) {
        offhand.add(M(shieldParts(look), { outline: 0.01 }));
        offhand.position.set(0.05, -D.armLen * 0.7, 0.07);
        offhand.rotation.y = 0.35;
    } else {
        const op = weaponParts(look, 'L');
        if (op.g.length) { offhand.add(M(op.g, { outline: 0.01 })); offhand.rotation.x = PI / 2 - 0.35; }
        if (op.glow.length) offhand.add(new THREE.Mesh(merge(op.glow), glowMat()));
    }
    armL.add(offhand);

    // cape, wings, tail
    let cape = null;
    if (look.cape) {
        cape = new THREE.Group();
        cape.position.set(0, D.torsoTop - 0.04, -0.12 * look.build);
        cape.add(capeMesh(look, flash));
        body.add(cape);
    }
    let wingL = null, wingR = null;
    if (look.wings) {
        wingL = new THREE.Group(); wingR = new THREE.Group();
        wingL.position.set(0.06, 0.3, -0.12); wingR.position.set(-0.06, 0.3, -0.12);
        wingL.add(wingMesh(look, 1, flash)); wingR.add(wingMesh(look, -1, flash));
        wingL.rotation.y = -0.5; wingR.rotation.y = 0.5;
        body.add(wingL, wingR);
    }
    let tail = null;
    if (look.tail) {
        tail = new THREE.Group();
        tail.position.set(0, 0.02, -0.12);
        tail.add(M(tailGeo(look), { outline: 0.01 }));
        body.add(tail);
    }

    const rig = {
        root, holder, body, neck, head, armL, armR, legL, legR, cape, tail, wingL, wingR, weapon, offhand, face, flash, flashColor, look,
        kind: 'humanoid', height: (D.hipY + D.torsoTop + D.headY * (look.head || 1) + R * (look.head || 1) + 0.05) * H, headY: (D.hipY + D.torsoTop + D.headY * (look.head || 1)) * H,
        expr: 'normal',
        setExpression(expr) {
            if (rig.expr === expr) return;
            rig.expr = expr;
            faceMat.map = faceTexture(look, expr);
            faceMat.needsUpdate = true;
        },
    };
    root.userData.rig = rig;
    return rig;
}

export { D as BODY, taper, sph, caps, cyl, cone, box, tor, lathe, flatShape, hemi };
