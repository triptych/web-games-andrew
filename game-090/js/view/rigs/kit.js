// Shared pieces for the creature rigs: skinned materials, glowing eyes, wings, halos, helpers.

import * as THREE from 'three';
import { toonMat, part, glow } from '../toon.js';
import { loft, tube, ball, deform, tint, bake, xform, carve, smooth, lerp } from '../sculpt.js';
import { surface, hexShade, css } from '../skin.js';

export { THREE, loft, tube, ball, deform, tint, bake, xform, carve, smooth, lerp, glow, hexShade };
export const PI = Math.PI;
export const has = (x, t) => x.includes(t);
export const wrap = (root, h, r, anim) => ({ root, h, r, anim });

/** A skinned material: a painted creature surface times the vertex-colour shading. */
export function skin(kind, c1, c2, o = {}) {
    return toonMat({ vertexColors: true, map: surface(kind, c1, c2, o.size || 128), color: '#ffffff', steps: o.steps || 3, ...(o.mat || {}) });
}
export const P = (geo, mat, w = 0.016) => part(geo, { mat, outline: w });
/** Shade a geometry for a skinned material: white-ish with baked occlusion (the map carries colour). */
export const shadeGeo = (g, o = {}) => tint(g, o.base || '#ffffff', { ao: o.ao ?? 0.35, top: o.top, front: o.front });

/** Cheap value noise on a circle, for lumpy rings. */
export const wobble = (seed, amt) => (a) => amt * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7 + seed * 2.3) * 0.3 + Math.sin(a * 13 + seed * 1.7) * 0.2);

/**
 * A glowing, slit-pupilled eye facing +z: coloured glow, dark pupil, small highlight. Returns a group.
 */
export function eye(r, color, o = {}) {
    const g = new THREE.Group();
    const disc = glow(new THREE.CircleGeometry(r, 16), color); disc.scale.y = o.tall ?? 0.9;
    const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r * 1.25, 16), new THREE.MeshBasicMaterial({ color: o.rim || '#06080c', side: THREE.DoubleSide, fog: false }));
    rim.scale.y = disc.scale.y; rim.position.z = -0.001;
    const pup = new THREE.Mesh(new THREE.CircleGeometry(r * 0.5, 12), new THREE.MeshBasicMaterial({ color: o.pupil || '#06080c', fog: false })); pup.scale.set(o.slit ?? 0.5, 1.15, 1); pup.position.z = 0.002;
    const hl = glow(new THREE.CircleGeometry(r * 0.2, 8), '#ffffff'); hl.position.set(r * 0.28, r * 0.3, 0.004);
    g.add(rim, disc, pup, hl);
    return g;
}
/** Glossy dark eyes for the cuter creatures. */
export function beadEye(r, o = {}) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: o.color || '#10141c', fog: false })); m.scale.z = 0.5;
    const hl = glow(new THREE.CircleGeometry(r * 0.3, 8), '#ffffff'); hl.position.set(r * 0.3, r * 0.32, r * 0.5);
    const hl2 = glow(new THREE.CircleGeometry(r * 0.13, 6), '#ffffff'); hl2.position.set(-r * 0.3, -r * 0.3, r * 0.5);
    g.add(m, hl, hl2);
    return g;
}

export function halo(color, r, y, tilt = 0, thick = 0.07) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(r, r * thick, 6, 32), new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false }));
    g.position.y = y; g.rotation.x = PI / 2 + tilt;
    return g;
}

const wingTex = new Map();
function veinTexture(color, kind) {
    const key = color + kind;
    if (wingTex.has(key)) return wingTex.get(key);
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, S, S);
    const gr = g.createRadialGradient(S * 0.2, S * 0.5, 4, S * 0.5, S * 0.5, S * 0.7);
    gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0.18)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(0, S * 0.5); g.quadraticCurveTo(S * 0.5, S * (0.1 + i * 0.13), S, S * (0.08 + i * 0.14)); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    wingTex.set(key, t);
    return t;
}
/** An insect or fairy wing: a veined, translucent glowing sheet. Hinged at its inner edge (origin). */
export function insectWing(color, w = 0.5, h = 0.7, o = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(w * 0.2, h * 0.55, w * 0.9, h * 0.62, w, h * 0.3);
    shape.bezierCurveTo(w * 1.02, 0, w * 0.6, -h * 0.4, 0, 0);
    const g = new THREE.ShapeGeometry(shape, 12);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, map: veinTexture(color, 'i'), transparent: true, opacity: o.opacity ?? 0.7, side: THREE.DoubleSide, toneMapped: false, fog: false, depthWrite: false }));
    return m;
}

/** A feathered angel wing built from tapered flat tubes, fanned out; hinged at the origin. */
export function featherWing(c1, c2, span = 1.0, rows = [6, 5], sd = 1) {
    const g = new THREE.Group();
    const parts = [];
    let rowI = 0;
    for (const n of rows) {
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1 || 1);
            const ang = lerp(0.1, 1.15, t) + rowI * 0.07, len = span * (0.55 + 0.45 * (1 - t)) * (1 - rowI * 0.28);
            const x1 = Math.cos(ang) * len * 0.5, y1 = Math.sin(ang) * len * 0.5 - rowI * 0.05;
            const x2 = Math.cos(ang - 0.25) * len, y2 = Math.sin(ang - 0.25) * len - 0.12 - rowI * 0.1;
            const f = tube([[0, 0, 0], [x1 * sd, y1, -0.01 * i], [x2 * sd, y2, -0.02 * i]], [0.016, 0.1 - rowI * 0.018, 0.006], { seg: 6, n: 8, flat: 0.14, thin: [0, 0, 1] });
            parts.push(tint(f, rowI % 2 ? c2 : c1, { ao: 0.2, top: '#ffffff' }));
        }
        rowI++;
    }
    g.add(P(bake(parts), toonMat({ vertexColors: true, steps: 3 }), 0.008));
    return g;
}

/** A leathery bat/dragon wing: finger bones as tubes and a membrane stretched between them. */
export function batWing(boneColor, memColor, span = 1.2, sd = 1) {
    const g = new THREE.Group();
    const tips = [[span, 0.35, -0.1], [span * 0.85, -0.1, -0.2], [span * 0.55, -0.55, -0.25]];
    const arm = tube([[0, 0, 0], [span * 0.35 * sd, 0.2, 0], [span * 0.65 * sd, 0.42, -0.05]], [0.035, 0.026, 0.016], { seg: 6, n: 8 });
    const bones = tips.map((t) => tube([[span * 0.65 * sd, 0.42, -0.05], [(t[0] * 0.85) * sd, t[1] + 0.1, t[2]], [t[0] * sd, t[1], t[2]]], [0.016, 0.01, 0.003], { seg: 5, n: 8 }));
    g.add(P(bake([tint(arm, boneColor, { ao: 0.2 }), ...bones.map((b) => tint(b, boneColor, { ao: 0.2 }))]), toonMat({ vertexColors: true, steps: 3 }), 0.01));
    const pts = [[0, 0, 0], [span * 0.65 * sd, 0.42, -0.05], ...tips.map((t) => [t[0] * sd, t[1], t[2]]), [span * 0.15 * sd, -0.6, -0.15]];
    const verts = [];
    const c = [span * 0.3 * sd, -0.1, -0.1];
    for (let i = 1; i < pts.length; i++) { const a = pts[i], b = pts[i + 1] || pts[0]; verts.push(...c, ...a, ...b); }
    verts.push(...c, ...pts[pts.length - 1], ...pts[0]);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); mg.computeVertexNormals();
    const mem = new THREE.Mesh(mg, new THREE.MeshToonMaterial({ color: memColor, side: THREE.DoubleSide, gradientMap: toonMat().gradientMap }));
    g.add(mem);
    return g;
}

export function motes(root, n, color, size = 0.03) {
    const list = [];
    for (let i = 0; i < n; i++) { const m = glow(new THREE.SphereGeometry(size, 6, 5), color); root.add(m); list.push(m); }
    return list;
}

/** A flame: three nested teardrops (colour, yellow, white) that flicker; call flick(t) each frame. */
export function flame(color, h = 0.6, r = 0.16) {
    const g = new THREE.Group();
    const layers = [[color, 1, 1], ['#ffd060', 0.78, 0.68], ['#fff4d0', 0.5, 0.42]].map(([c, kh, kr], i) => {
        const hh = h * kh, rr = r * kr;
        const geo = loft([{ y: 0, rx: rr * 0.35, rz: rr * 0.35 }, { y: hh * 0.2, rx: rr, rz: rr, wob: (a) => 0.12 * Math.sin(a * 3 + i) }, { y: hh * 0.5, rx: rr * 0.78, rz: rr * 0.78, wob: (a) => 0.18 * Math.sin(a * 2 + i * 2) }, { y: hh * 0.82, rx: rr * 0.34, rz: rr * 0.34 }, { y: hh, rx: 0.004, rz: 0.004 }], { seg: 10 });
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
        g.add(m); return m;
    });
    g.userData.flick = (t) => layers.forEach((m, i) => { m.scale.set(1 + Math.sin(t * 17 + i * 2) * 0.12, 1 + Math.sin(t * 13 + i) * 0.2, 1 + Math.cos(t * 15 + i) * 0.12); m.rotation.y = t * (1.5 + i); });
    return g;
}

/** A rounded slab: a superelliptic loft with flat caps. w/h/d are full sizes; taper scales the top. */
export function slab(w, h, d, o = {}) {
    const sq = o.sq ?? 4, tp = o.taper ?? 1;
    return loft([{ y: -h / 2, rx: w / 2, rz: d / 2, sq }, { y: h / 2, rx: (w / 2) * tp, rz: (d / 2) * (o.taperZ ?? tp), sq }], { seg: o.seg ?? 16, caps: true });
}
/** A cylinder or cone as a capped loft: radii bottom/top. */
export function rod(r0, r1, h, o = {}) {
    return loft([{ y: -h / 2, rx: r0, rz: o.rz0 ?? r0 }, { y: h / 2, rx: r1, rz: o.rz1 ?? r1 }], { seg: o.seg ?? 12, caps: true });
}
