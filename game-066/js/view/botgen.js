// Procedural COM-bots. A species is a set of parts (js/sim/data/parts.js); this builds each part from
// primitives, lathes, tubes and cut gears, mounts them on the chassis' anchor points, paints them in
// the line's finishes (brass, copper, enamel…) with the weathering shader, lights eyes and cores in
// the type's glow colour, and animates them: wheels roll, legs step, rotors and gears turn, drills
// and saws spin, tendrils sway, stacks puff steam, coils spark.
//
//   const bot = buildBot(speciesId, { gilded });   scene.add(bot.root);   bot.update(dt, t);
//   bot.play('attack' | 'hit' | 'faint' | 'cheer');  bot.height

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SPECIES } from '../sim/dex.js';
import { TYPE_INFO } from '../sim/data/types.js';
import { metal, glow, MAT, tex } from './materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const geoCache = new Map();
function G(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }

const sphere = (r, w = 20, h = 14) => G(`s${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
const cyl = (rt, rb, h, s = 18, open = false) => G(`c${rt}|${rb}|${h}|${s}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
const box = (w, h, d, r = 0.04) => G(`b${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2)));
const torus = (r, t, s = 24) => G(`t${r}|${t}|${s}`, () => new THREE.TorusGeometry(r, t, 8, s));
const cone = (r, h, s = 16) => G(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const lathe = (key, pts, s = 24) => G(`l${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s));
const ico = (r, d = 1) => G(`i${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
const octa = (r) => G(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));

/** A cut gear: teeth around a ring, with spokes. */
export function gearGeo(r, teeth = 12, depth = 0.08, hole = 0.35) {
    return G(`gear${r}|${teeth}|${depth}|${hole}`, () => {
        const s = new THREE.Shape();
        const tooth = r * 0.16;
        for (let i = 0; i < teeth; i++) {
            const a0 = (i / teeth) * Math.PI * 2, a1 = ((i + 0.25) / teeth) * Math.PI * 2, a2 = ((i + 0.5) / teeth) * Math.PI * 2, a3 = ((i + 0.75) / teeth) * Math.PI * 2;
            const P = (a, rr) => [Math.cos(a) * rr, Math.sin(a) * rr];
            if (i === 0) s.moveTo(...P(a0, r));
            s.lineTo(...P(a1, r)); s.lineTo(...P(a1 + 0.02, r + tooth)); s.lineTo(...P(a2 - 0.02, r + tooth)); s.lineTo(...P(a2, r)); s.lineTo(...P(a3, r));
        }
        const h = new THREE.Path(); h.absarc(0, 0, r * hole, 0, Math.PI * 2, true); s.holes.push(h);
        // spoke windows
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4, w = new THREE.Path();
            w.absarc(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66, r * 0.16, 0, Math.PI * 2, true);
            s.holes.push(w);
        }
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: depth * 0.25, bevelThickness: depth * 0.25, bevelSegments: 1, curveSegments: 4 });
        g.translate(0, 0, -depth / 2);
        return g;
    });
}

function M(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}
function grp(...kids) { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; }
function rivets(parent, mat, r, y, n, rr = 0.018) {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; parent.add(M(sphere(rr, 6, 4), mat, Math.cos(a) * r, y, Math.sin(a) * r)); }
}

// =====================================================================================
export function buildBot(spId, opts = {}) {
    const S = SPECIES[spId];
    const P = S.parts;
    const gild = !!opts.gilded;
    const A = metal(S.pal[0], { gilded: gild });
    const B = metal(S.pal[1] || S.pal[0], { gilded: gild });
    const D = MAT.dark;
    const type = S.types[0];
    const gcol = (TYPE_INFO[S.types[1] || type] || TYPE_INFO.scrap).glow;
    const ecol = TYPE_INFO[type].glow;
    const GL = glow(gcol, 2.4), EYE = glow(ecol, 3.2);
    const ctx = { A, B, D, GL, EYE, gcol, S, spinners: [], wheels: [], legs: [], tendrils: [], emitters: [], glows: [GL, EYE], rotors: [], drills: [], seed: (spId * 9301 + 49297) % 233280 };

    const root = new THREE.Group();
    const rig = new THREE.Group();          // everything that bobs/leans
    root.add(rig);

    // Drive first: it sets how high the chassis sits.
    const loco = LOCO[P.l || 'none'] || LOCO.none;
    const L = loco(ctx);
    rig.add(L.group);
    const body = new THREE.Group();
    body.position.y = L.h;
    rig.add(body);
    const ch = (CHASSIS[P.c] || CHASSIS.orb)(ctx);
    body.add(ch.group);
    const an = ch.anchors;

    // Head (or eyes on the chassis).
    const head = new THREE.Group();
    let headTop = an.top.clone();
    if (P.h && P.h !== 'none' && HEADS[P.h]) {
        head.position.copy(an.top);
        const h = HEADS[P.h](ctx);
        head.add(h.group);
        headTop = an.top.clone().add(h.top);
        body.add(head);
    } else {
        const eyes = EYES[P.e || 'twin'](ctx, an.faceR || 0.18);
        eyes.position.copy(an.front);
        body.add(eyes);
        head.position.copy(an.top);
        body.add(head);
    }
    // Crest on top.
    if (P.t && CREST[P.t]) {
        const c = CREST[P.t](ctx);
        c.position.copy(headTop);
        body.add(c);
    }
    // Arms.
    const arms = [];
    if (P.a && ARMS[P.a]) {
        for (const side of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(an.side.x * side, an.side.y, an.side.z);
            const arm = ARMS[P.a](ctx, side);
            pivot.add(arm);
            body.add(pivot);
            arms.push(pivot);
        }
    }
    // Back rig.
    if (P.b && BACKS[P.b]) {
        const b = BACKS[P.b](ctx);
        b.position.copy(an.back);
        body.add(b);
    }
    // Overgrowth.
    if (P.o && OVER[P.o]) OVER[P.o](ctx, body, an);
    if (L.after) L.after(ctx, body, an);

    // Normalise height by stage.
    const bb = new THREE.Box3().setFromObject(root);
    const h = Math.max(0.2, bb.max.y - Math.min(0, bb.min.y));
    const target = S.tier === 'T' || S.tier === 'X' ? 2.3 : [0, 1.0, 1.45, 1.95][S.stage] * (S.stages === 1 ? 1.25 : S.stages === 2 && S.stage === 2 ? 1.18 : 1);
    const k = target / h;
    root.scale.setScalar(k);
    const width = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * k;

    // ------------------------------------------------------------------ animation
    const state = { t: (ctx.seed % 100) / 10, moving: 0, anim: null, at: 0, faint: false, hover: !!L.hover };
    const baseY = rig.position.y;
    function update(dt, time, opts2 = {}) {
        state.t += dt;
        const t = state.t;
        const mv = opts2.moving ? 1 : 0;
        state.moving += (mv - state.moving) * Math.min(1, dt * 8);
        const m = state.moving;
        // Bob and breathe.
        const bob = state.hover ? Math.sin(t * 2.2) * 0.06 + 0.04 : Math.abs(Math.sin(t * (m ? 9 : 1.6))) * (m ? 0.05 : 0.015);
        rig.position.y = baseY + bob;
        body.rotation.z = Math.sin(t * 1.3) * 0.02 + (m ? Math.sin(t * 9) * 0.04 : 0);
        head.rotation.y = Math.sin(t * 0.7) * 0.25 * (1 - m);
        for (const w of ctx.wheels) w.rotation.x -= dt * (1 + m * 10) * (w.userData.k || 1);
        for (const r of ctx.rotors) r.rotation.y += dt * (14 + m * 10);
        for (const s of ctx.spinners) s.rotation[s.userData.axis || 'z'] += dt * (s.userData.speed || 1.2);
        for (const d of ctx.drills) d.rotation.y += dt * (3 + (state.anim === 'attack' ? 30 : 0));
        ctx.legs.forEach((lg, i) => {
            const ph = t * (m ? 10 : 0) + i * Math.PI;
            lg.rotation.x = Math.sin(ph) * 0.5 * m;
        });
        ctx.tendrils.forEach((td, i) => { td.rotation.z = Math.sin(t * 2 + i) * 0.25; td.rotation.x = Math.cos(t * 1.7 + i) * 0.2; });
        arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.4 + i) * 0.08 + (m ? Math.sin(t * 9 + i * Math.PI) * 0.4 : 0); });
        // Glow flicker.
        GL.emissiveIntensity = 2.1 + Math.sin(t * 6) * 0.25 + (state.anim === 'attack' ? 1.5 : 0);
        // One-shot animations.
        if (state.anim) {
            state.at += dt;
            const a = state.at;
            if (state.anim === 'attack') {
                const k2 = a < 0.18 ? -a / 0.18 : a < 0.35 ? (a - 0.18) / 0.17 : Math.max(0, 1 - (a - 0.35) / 0.3);
                rig.position.z = k2 * 0.35;
                rig.rotation.x = k2 * 0.15;
                arms.forEach((ar, i) => { ar.rotation.x = -k2 * 1.2; ar.rotation.z = (i ? 1 : -1) * k2 * 0.3; });
                if (a > 0.7) { state.anim = null; rig.position.z = 0; rig.rotation.x = 0; }
            } else if (state.anim === 'hit') {
                rig.position.x = Math.sin(a * 60) * 0.06 * Math.max(0, 1 - a / 0.45);
                rig.rotation.z = Math.sin(a * 40) * 0.08 * Math.max(0, 1 - a / 0.45);
                if (a > 0.5) { state.anim = null; rig.position.x = 0; rig.rotation.z = 0; }
            } else if (state.anim === 'cheer') {
                rig.position.y = baseY + Math.abs(Math.sin(a * 9)) * 0.25;
                if (a > 1.2) state.anim = null;
            } else if (state.anim === 'charge') {
                rig.rotation.y = Math.sin(a * 30) * 0.05;
                if (a > 0.8) { state.anim = null; rig.rotation.y = 0; }
            }
        }
    }
    function play(name) { state.anim = name; state.at = 0; }

    return { root, rig, body, head, arms, ctx, height: target, width, update, play, state, emitters: ctx.emitters, species: S };
}

// =====================================================================================
// CHASSIS — each returns { group, anchors: { top, side, back, front, faceR } } in chassis space
// (bottom of the chassis at y = 0, front = +z).
const CHASSIS = {
    orb(c) {
        const g = grp(M(sphere(0.42), c.A, 0, 0.42, 0), M(torus(0.425, 0.035, 32), c.B, 0, 0.42, 0));
        g.children[1].rotation.x = Math.PI / 2;
        rivets(g, c.D, 0.43, 0.42, 14);
        g.add(M(cyl(0.12, 0.14, 0.06), c.B, 0, 0.82, 0));
        return { group: g, anchors: { top: V(0, 0.84, 0), side: V(0.42, 0.45, 0), back: V(0, 0.5, -0.38), front: V(0, 0.52, 0.38), faceR: 0.16 } };
    },
    pod(c) {
        const g = grp(M(G('capsule', () => new THREE.CapsuleGeometry(0.32, 0.36, 6, 16)), c.A, 0, 0.5, 0));
        g.add(M(torus(0.33, 0.03, 28), c.B, 0, 0.5, 0)); g.children[1].rotation.x = Math.PI / 2;
        g.add(M(box(0.3, 0.12, 0.05, 0.02), c.B, 0, 0.32, 0.31));
        return { group: g, anchors: { top: V(0, 0.98, 0), side: V(0.33, 0.55, 0), back: V(0, 0.55, -0.3), front: V(0, 0.62, 0.3), faceR: 0.14 } };
    },
    egg(c) {
        const m = M(sphere(0.38), c.A, 0, 0.48, 0); m.scale.set(1, 1.25, 1);
        const g = grp(m, M(torus(0.385, 0.03, 28), c.B, 0, 0.36, 0));
        g.children[1].rotation.x = Math.PI / 2;
        return { group: g, anchors: { top: V(0, 0.95, 0), side: V(0.38, 0.45, 0), back: V(0, 0.5, -0.36), front: V(0, 0.62, 0.34), faceR: 0.14 } };
    },
    box(c) {
        const g = grp(M(box(0.8, 0.66, 0.66, 0.08), c.A, 0, 0.36, 0));
        g.add(M(box(0.84, 0.08, 0.7, 0.03), c.B, 0, 0.05, 0), M(box(0.84, 0.08, 0.7, 0.03), c.B, 0, 0.67, 0));
        for (const x of [-0.3, 0.3]) for (const y of [0.18, 0.55]) g.add(M(sphere(0.025, 6, 4), c.D, x, y, 0.335));
        return { group: g, anchors: { top: V(0, 0.71, 0), side: V(0.42, 0.42, 0), back: V(0, 0.4, -0.34), front: V(0, 0.44, 0.34), faceR: 0.16 } };
    },
    boiler(c) {
        const g = grp(M(cyl(0.36, 0.38, 0.8, 24), c.A, 0, 0.42, 0), M(lathe('boilercap', [[0, 0], [0.36, 0], [0.3, 0.1], [0.18, 0.17], [0, 0.19]]), c.B, 0, 0.82, 0));
        for (const y of [0.12, 0.42, 0.72]) { const b = M(torus(0.375, 0.025, 32), c.B, 0, y, 0); b.rotation.x = Math.PI / 2; g.add(b); rivets(g, c.D, 0.385, y, 12, 0.014); }
        // Pressure gauge.
        const gg = grp(M(cyl(0.1, 0.1, 0.04), c.B), M(cyl(0.085, 0.085, 0.045), MAT.glass), M(box(0.012, 0.07, 0.01, 0.003), c.D, 0, 0.02, 0.03));
        gg.rotation.x = Math.PI / 2; gg.position.set(0.16, 0.3, 0.34); g.add(gg);
        return { group: g, anchors: { top: V(0, 1.0, 0), side: V(0.38, 0.52, 0), back: V(0, 0.5, -0.36), front: V(0, 0.62, 0.36), faceR: 0.15 } };
    },
    kettle(c) {
        const g = grp(M(lathe('kettle', [[0, 0], [0.34, 0.02], [0.42, 0.2], [0.4, 0.42], [0.28, 0.6], [0.12, 0.66], [0.13, 0.7], [0, 0.72]]), c.A));
        const sp = M(cyl(0.04, 0.08, 0.36, 12), c.B, 0.42, 0.42, 0); sp.rotation.z = -1.0; g.add(sp);
        const hd = M(torus(0.22, 0.03, 20), c.B, 0, 0.66, 0); hd.scale.set(1, 1.2, 1); g.add(hd);
        return { group: g, anchors: { top: V(0, 0.74, 0), side: V(0.4, 0.38, 0), back: V(0, 0.38, -0.38), front: V(0, 0.4, 0.38), faceR: 0.15 } };
    },
    barrel(c) {
        const g = grp(M(lathe('barrel', [[0, 0], [0.3, 0], [0.37, 0.2], [0.38, 0.4], [0.37, 0.6], [0.3, 0.8], [0, 0.8]]), c.A));
        for (const y of [0.1, 0.4, 0.7]) { const b = M(torus(y === 0.4 ? 0.385 : 0.345, 0.025, 30), c.B, 0, y, 0); b.rotation.x = Math.PI / 2; g.add(b); }
        g.add(M(cyl(0.06, 0.06, 0.06), c.D, 0.15, 0.82, 0.1));
        return { group: g, anchors: { top: V(0, 0.82, 0), side: V(0.38, 0.45, 0), back: V(0, 0.4, -0.36), front: V(0, 0.5, 0.37), faceR: 0.15 } };
    },
    bell(c) {
        const g = grp(M(lathe('bell', [[0, 0.82], [0.12, 0.8], [0.3, 0.66], [0.38, 0.4], [0.44, 0.08], [0.46, 0.02], [0.4, 0], [0, 0]]), c.A));
        const ring = M(torus(0.45, 0.035, 30), c.B, 0, 0.05, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 2; const p = M(torus(0.07, 0.02, 14), c.B, Math.cos(a) * 0.4, 0.32, Math.sin(a) * 0.4); p.lookAt(0, 0.32, 0); g.add(p); }
        return { group: g, anchors: { top: V(0, 0.84, 0), side: V(0.42, 0.32, 0), back: V(0, 0.4, -0.4), front: V(0, 0.42, 0.39), faceR: 0.16 } };
    },
    dome(c) {
        const g = grp(M(G('hemi', () => new THREE.SphereGeometry(0.44, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), c.A, 0, 0.18, 0), M(cyl(0.46, 0.48, 0.2, 28), c.B, 0, 0.1, 0));
        rivets(g, c.D, 0.47, 0.17, 16);
        return { group: g, anchors: { top: V(0, 0.62, 0), side: V(0.46, 0.22, 0), back: V(0, 0.35, -0.38), front: V(0, 0.3, 0.42), faceR: 0.15 } };
    },
    bulb(c) {
        const g = grp(M(cyl(0.2, 0.17, 0.22, 18), c.B, 0, 0.11, 0));
        for (const y of [0.05, 0.12, 0.19]) { const t = M(torus(0.2, 0.015, 20), c.A, 0, y, 0); t.rotation.x = Math.PI / 2; g.add(t); }
        const glass = M(sphere(0.36), MAT.glass, 0, 0.55, 0);
        g.add(glass, M(sphere(0.12), c.GL, 0, 0.55, 0));
        const fil = M(torus(0.09, 0.012, 12), c.GL, 0, 0.62, 0); g.add(fil);
        c.spinners.push(Object.assign(fil, { userData: { axis: 'y', speed: 2 } }));
        return { group: g, anchors: { top: V(0, 0.9, 0), side: V(0.34, 0.5, 0), back: V(0, 0.5, -0.33), front: V(0, 0.5, 0.36), faceR: 0.12 } };
    },
    lantern(c) {
        const g = grp(M(cyl(0.3, 0.34, 0.08, 6), c.B, 0, 0.04, 0), M(cyl(0.34, 0.3, 0.08, 6), c.B, 0, 0.82, 0), M(cone(0.22, 0.16, 6), c.A, 0, 0.94, 0));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(M(cyl(0.02, 0.02, 0.74, 6), c.A, Math.cos(a) * 0.3, 0.43, Math.sin(a) * 0.3)); }
        g.add(M(sphere(0.18), c.GL, 0, 0.45, 0), M(cyl(0.29, 0.29, 0.7, 6, true), MAT.glass, 0, 0.43, 0));
        return { group: g, anchors: { top: V(0, 1.0, 0), side: V(0.32, 0.45, 0), back: V(0, 0.45, -0.3), front: V(0, 0.45, 0.31), faceR: 0.12 } };
    },
    tank(c) {
        const g = grp(M(box(0.9, 0.5, 0.86, 0.06), c.A, 0, 0.3, 0), M(box(0.7, 0.18, 0.5, 0.04), c.B, 0, 0.62, -0.05));
        const fr = M(box(0.86, 0.12, 0.3, 0.03), c.B, 0, 0.42, 0.38); fr.rotation.x = -0.6; g.add(fr);
        for (const x of [-0.38, 0.38]) g.add(M(box(0.06, 0.48, 0.88, 0.02), c.D, x, 0.3, 0));
        return { group: g, anchors: { top: V(0, 0.72, 0), side: V(0.46, 0.38, 0), back: V(0, 0.42, -0.42), front: V(0, 0.4, 0.44), faceR: 0.17 } };
    },
    cone(c) {
        const g = new THREE.Group();
        const body = M(cone(0.34, 0.8, 18), c.A, 0, 0.4, 0.05); body.rotation.x = Math.PI / 2; g.add(body);
        for (let i = 0; i < 5; i++) { const r = M(torus(0.32 - i * 0.06, 0.02, 20), c.B, 0, 0.4, -0.25 + i * 0.13); g.add(r); }
        g.add(M(cyl(0.3, 0.32, 0.2, 18), c.B, 0, 0.4, -0.38)); g.children[g.children.length - 1].rotation.x = Math.PI / 2;
        c.drillBody = body;
        return { group: g, anchors: { top: V(0, 0.72, -0.22), side: V(0.32, 0.4, -0.15), back: V(0, 0.45, -0.46), front: V(0, 0.58, 0.18), faceR: 0.12 } };
    },
    serpent(c) {
        const g = new THREE.Group();
        const segs = 5;
        for (let i = 0; i < segs; i++) {
            const r = 0.3 - i * 0.04;
            const s = M(sphere(r), i % 2 ? c.B : c.A, 0, r + 0.02, -i * 0.38);
            g.add(s);
            const band = M(torus(r * 0.98, 0.02, 20), c.D, 0, r + 0.02, -i * 0.38 + r * 0.6); g.add(band);
            c.tendrils.push(s);
        }
        return { group: g, anchors: { top: V(0, 0.6, 0.05), side: V(0.3, 0.3, 0), back: V(0, 0.4, -0.5), front: V(0, 0.38, 0.28), faceR: 0.12 } };
    },
    disc(c) {
        const g = grp(M(lathe('saucer', [[0, 0], [0.3, 0.02], [0.58, 0.14], [0.6, 0.18], [0.5, 0.24], [0.2, 0.28], [0, 0.29]], 32), c.A, 0, 0.1, 0));
        g.add(M(G('saucerdome', () => new THREE.SphereGeometry(0.24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), MAT.glass, 0, 0.38, 0), M(sphere(0.1), c.GL, 0, 0.42, 0));
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(M(sphere(0.035, 8, 6), c.GL, Math.cos(a) * 0.56, 0.27, Math.sin(a) * 0.56)); }
        c.spinners.push(Object.assign(g, { userData: { axis: 'y', speed: 0.6 } }));
        return { group: grp(g), anchors: { top: V(0, 0.62, 0), side: V(0.55, 0.28, 0), back: V(0, 0.32, -0.45), front: V(0, 0.42, 0.22), faceR: 0.1 } };
    },
    frame(c) {
        const g = grp(M(box(0.62, 0.42, 0.38, 0.06), c.A, 0, 0.62, 0), M(box(0.4, 0.2, 0.3, 0.04), c.B, 0, 0.22, 0));
        for (const x of [-0.14, 0.14]) { const s = M(cyl(0.035, 0.035, 0.34, 8), c.D, x, 0.38, 0); s.rotation.z = x > 0 ? 0.25 : -0.25; g.add(s); }
        g.add(M(cyl(0.08, 0.08, 0.32, 12), c.D, 0, 0.42, 0));
        g.add(M(sphere(0.07), c.GL, 0, 0.66, 0.19));
        return { group: g, anchors: { top: V(0, 0.84, 0), side: V(0.36, 0.72, 0), back: V(0, 0.65, -0.2), front: V(0, 0.68, 0.2), faceR: 0.13 } };
    },
};

// =====================================================================================
// DRIVE — returns { group, h (chassis height), hover? }
function wheel(c, r, w) {
    const g = new THREE.Group();
    const tyre = M(torus(r, w, 22), MAT.rubber); tyre.rotation.y = Math.PI / 2; g.add(tyre);
    const hub = M(cyl(r * 0.35, r * 0.35, w * 2.2, 12), c.B); hub.rotation.z = Math.PI / 2; g.add(hub);
    for (let i = 0; i < 6; i++) { const s = M(box(0.02, r * 1.7, 0.02, 0.005), c.A); s.rotation.x = (i / 6) * Math.PI; g.add(s); }
    const spin = new THREE.Group(); spin.add(g);
    c.wheels.push(g);
    return spin;
}
function leg(c, len, foot = 'box') {
    const piv = new THREE.Group();
    piv.add(M(sphere(0.07), c.D, 0, 0, 0), M(cyl(0.05, 0.06, len * 0.5, 10), c.A, 0, -len * 0.25, 0), M(sphere(0.06), c.B, 0, -len * 0.5, 0), M(cyl(0.04, 0.05, len * 0.5, 10), c.D, 0, -len * 0.75, 0));
    if (foot === 'box') piv.add(M(box(0.16, 0.06, 0.22, 0.02), c.B, 0, -len, 0.04));
    else piv.add(M(cone(0.04, 0.08, 8), c.B, 0, -len, 0));
    c.legs.push(piv);
    return piv;
}
const LOCO = {
    none(c) { return { group: grp(M(cyl(0.3, 0.34, 0.06, 18), c.D, 0, 0.03, 0)), h: 0.05 }; },
    wheels(c) {
        const g = new THREE.Group();
        for (const x of [-0.36, 0.36]) for (const z of [-0.22, 0.22]) { const w = wheel(c, 0.15, 0.05); w.position.set(x, 0.17, z); g.add(w); }
        g.add(M(box(0.6, 0.06, 0.5, 0.02), c.D, 0, 0.22, 0));
        return { group: g, h: 0.24 };
    },
    wheel1(c) {
        const g = new THREE.Group();
        const w = wheel(c, 0.3, 0.07); w.position.set(0, 0.32, 0); g.add(w);
        g.add(M(box(0.1, 0.1, 0.5, 0.02), c.D, 0.12, 0.42, 0), M(box(0.1, 0.1, 0.5, 0.02), c.D, -0.12, 0.42, 0));
        return { group: g, h: 0.5 };
    },
    treads(c) {
        const g = new THREE.Group();
        for (const x of [-0.36, 0.36]) {
            const t = grp(M(box(0.2, 0.26, 0.8, 0.12), MAT.rubber, 0, 0, 0));
            for (const z of [-0.25, 0, 0.25]) { const w = wheel(c, 0.09, 0.03); w.position.set(x > 0 ? 0.11 : -0.11, 0, z); t.add(w); }
            for (let i = 0; i < 8; i++) t.add(M(box(0.22, 0.02, 0.04, 0.005), c.D, 0, 0.13, -0.35 + i * 0.1));
            t.position.set(x, 0.14, 0); g.add(t);
        }
        return { group: g, h: 0.26 };
    },
    legs2(c) {
        const g = new THREE.Group();
        for (const x of [-0.18, 0.18]) { const l = leg(c, 0.36); l.position.set(x, 0.4, 0); g.add(l); }
        return { group: g, h: 0.4 };
    },
    legs4(c) {
        const g = new THREE.Group();
        for (const x of [-0.26, 0.26]) for (const z of [-0.22, 0.22]) { const l = leg(c, 0.32); l.position.set(x, 0.34, z); g.add(l); }
        return { group: g, h: 0.34 };
    },
    spider(c) {
        const g = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const side = i < 3 ? -1 : 1, k = (i % 3) - 1;
            const piv = new THREE.Group();
            piv.position.set(side * 0.22, 0.34, k * 0.2);
            const up = M(cyl(0.025, 0.03, 0.34, 8), c.A, side * 0.15, 0.06, 0); up.rotation.z = side * -1.1; piv.add(up);
            const dn = M(cyl(0.02, 0.025, 0.42, 8), c.D, side * 0.3, -0.14, 0); dn.rotation.z = side * 0.35; piv.add(dn);
            piv.rotation.y = -k * 0.4 * side;
            c.legs.push(piv);
            g.add(piv);
        }
        return { group: g, h: 0.34 };
    },
    hover(c) {
        const g = new THREE.Group();
        for (const [x, z] of [[-0.2, 0.12], [0.2, 0.12], [0, -0.2]]) {
            const j = grp(M(cyl(0.08, 0.06, 0.12, 12), c.D, 0, 0, 0), M(cone(0.06, 0.18, 12), glow(c.gcol, 1.6), 0, -0.14, 0), M(cyl(0.05, 0.05, 0.02, 12), glow(c.gcol, 3), 0, -0.065, 0));
            j.children[1].rotation.x = Math.PI;
            j.children[1].castShadow = false;
            j.children[1].material = new THREE.MeshBasicMaterial({ color: c.gcol, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
            c.emitters.push({ obj: j.children[2], kind: 'jet', rate: 3 });
            j.position.set(x, 0.42, z);
            g.add(j);
        }
        return { group: g, h: 0.48, hover: true };
    },
    prop(c) {
        return {
            group: grp(M(box(0.5, 0.03, 0.06, 0.01), c.D, 0, 0.04, 0.12), M(box(0.5, 0.03, 0.06, 0.01), c.D, 0, 0.04, -0.12)), h: 0.42, hover: true,
            after(cc, body, an) {
                const mast = grp(M(cyl(0.03, 0.03, 0.22, 8), cc.D, 0, 0.11, 0), M(cyl(0.05, 0.05, 0.05, 10), cc.B, 0, 0.23, 0));
                const rotor = new THREE.Group();
                for (let i = 0; i < 3; i++) { const b = M(box(0.7, 0.012, 0.07, 0.005), cc.A, 0.35, 0, 0); const p = new THREE.Group(); p.add(b); p.rotation.y = (i / 3) * Math.PI * 2; rotor.add(p); }
                rotor.position.y = 0.26; mast.add(rotor);
                cc.rotors.push(rotor);
                mast.position.copy(an.top).add(V(0, 0.12, -0.05));
                body.add(mast);
            },
        };
    },
    slither(c) {
        const g = new THREE.Group();
        for (let i = 0; i < 4; i++) { const s = M(sphere(0.16 - i * 0.025), i % 2 ? c.B : c.A, 0, 0.14 - i * 0.02, -0.3 - i * 0.24); g.add(s); c.tendrils.push(s); }
        return { group: g, h: 0.06 };
    },
    pontoon(c) {
        const g = new THREE.Group();
        for (const x of [-0.34, 0.34]) { const p = M(G('pontoon', () => new THREE.CapsuleGeometry(0.11, 0.6, 4, 12)), c.B, x, 0.12, 0); p.rotation.x = Math.PI / 2; g.add(p); g.add(M(cyl(0.03, 0.03, 0.2, 8), c.D, x, 0.26, 0)); }
        return { group: g, h: 0.3 };
    },
    skis(c) {
        const g = new THREE.Group();
        for (const x of [-0.22, 0.22]) {
            const s = M(box(0.1, 0.03, 0.9, 0.012), c.B, x, 0.02, 0.05); g.add(s);
            const tip = M(box(0.1, 0.03, 0.15, 0.012), c.B, x, 0.06, 0.52); tip.rotation.x = -0.6; g.add(tip);
            const l = leg(c, 0.26, 'point'); l.position.set(x, 0.3, 0); g.add(l);
        }
        c.legs.length = 0;
        return { group: g, h: 0.3 };
    },
};

// =====================================================================================
// EYES
const EYES = {
    single(c, r) { const g = grp(M(cyl(r * 0.9, r, 0.08, 18), c.B), M(sphere(r * 0.7), c.EYE, 0, 0, 0.02)); g.children[0].rotation.x = Math.PI / 2; g.children[1].scale.z = 0.5; return g; },
    twin(c, r) {
        const g = new THREE.Group();
        for (const x of [-r * 0.75, r * 0.75]) { const e = grp(M(torus(r * 0.42, r * 0.12, 14), c.B), M(sphere(r * 0.38), c.EYE)); e.children[1].scale.z = 0.5; e.position.x = x; g.add(e); }
        return g;
    },
    visor(c, r) { const g = grp(M(box(r * 2.6, r * 0.7, 0.1, 0.03), c.D), M(box(r * 2.2, r * 0.25, 0.04, 0.01), c.EYE, 0, 0, 0.05)); return g; },
    goggles(c, r) {
        const g = new THREE.Group();
        for (const x of [-r * 0.8, r * 0.8]) { const e = grp(M(cyl(r * 0.55, r * 0.55, 0.12, 16), c.B), M(sphere(r * 0.42), c.EYE, 0, 0, 0)); e.children[0].rotation.x = Math.PI / 2; e.children[1].scale.z = 0.4; e.position.x = x; g.add(e); }
        g.add(M(box(r * 3.4, 0.04, 0.03, 0.01), MAT.rubber, 0, 0, -0.04));
        return g;
    },
    triple(c, r) {
        const g = new THREE.Group();
        for (const [x, y, s] of [[0, r * 0.4, 0.5], [-r * 0.7, -r * 0.3, 0.38], [r * 0.7, -r * 0.3, 0.38]]) { const e = M(sphere(r * s), c.EYE, x, y, 0); e.scale.z = 0.5; g.add(e); }
        return g;
    },
    slit(c, r) { return grp(M(box(r * 1.8, r * 0.18, 0.06, 0.02), c.EYE)); },
};

// =====================================================================================
// HEADS — on the top anchor; return { group, top }
function face(c, g, y, z, r) { const e = EYES[c.S.parts.e || 'twin'](c, r); e.position.set(0, y, z); g.add(e); }
const HEADS = {
    dome(c) { const g = grp(M(sphere(0.24), c.A, 0, 0.18, 0), M(torus(0.24, 0.025, 24), c.B, 0, 0.12, 0)); g.children[1].rotation.x = Math.PI / 2; face(c, g, 0.2, 0.22, 0.1); return { group: g, top: V(0, 0.42, 0) }; },
    box(c) { const g = grp(M(box(0.42, 0.32, 0.36, 0.05), c.A, 0, 0.18, 0), M(cyl(0.08, 0.1, 0.06), c.D, 0, 0.0, 0)); face(c, g, 0.2, 0.185, 0.1); return { group: g, top: V(0, 0.34, 0) }; },
    lamp(c) {
        const g = grp(M(cyl(0.16, 0.18, 0.06, 12), c.B, 0, 0.03, 0), M(cyl(0.14, 0.14, 0.24, 12, true), MAT.glass, 0, 0.18, 0), M(sphere(0.1), c.GL, 0, 0.18, 0), M(cone(0.18, 0.12, 12), c.A, 0, 0.36, 0));
        return { group: g, top: V(0, 0.42, 0) };
    },
    skull(c) {
        const g = grp(M(sphere(0.22), c.A, 0, 0.2, 0), M(box(0.3, 0.1, 0.22, 0.03), c.B, 0, 0.04, 0.04));
        g.children[0].scale.set(1, 0.9, 1.1);
        face(c, g, 0.22, 0.2, 0.09);
        for (let i = 0; i < 5; i++) g.add(M(box(0.03, 0.05, 0.02, 0.005), MAT.glass.color ? c.B : c.B, -0.1 + i * 0.05, 0.06, 0.16));
        return { group: g, top: V(0, 0.4, 0) };
    },
    helm(c) {
        const g = grp(M(sphere(0.25), c.A, 0, 0.22, 0), M(cyl(0.2, 0.22, 0.08, 18), c.B, 0, 0.0, 0));
        const port = M(torus(0.11, 0.03, 16), c.B, 0, 0.22, 0.23); g.add(port, M(sphere(0.1), MAT.glass, 0, 0.22, 0.2));
        face(c, g, 0.22, 0.2, 0.07);
        for (const x of [-0.24, 0.24]) { const p = M(torus(0.06, 0.02, 12), c.B, x, 0.22, 0); p.rotation.y = Math.PI / 2; g.add(p); }
        return { group: g, top: V(0, 0.47, 0) };
    },
    visor(c) {
        const g = grp(M(box(0.44, 0.18, 0.34, 0.06), c.A, 0, 0.1, 0));
        const v = M(box(0.36, 0.05, 0.03, 0.01), c.EYE, 0, 0.12, 0.17); g.add(v);
        return { group: g, top: V(0, 0.2, 0) };
    },
    screen(c) {
        const g = grp(M(box(0.46, 0.38, 0.36, 0.05), c.A, 0, 0.2, 0));
        const t = tex('screen');
        const scr = new THREE.Mesh(G('screenplane', () => new THREE.PlaneGeometry(0.34, 0.26)), new THREE.MeshBasicMaterial({ map: t, color: '#c8ffd8' }));
        scr.position.set(0, 0.21, 0.185); g.add(scr);
        g.add(M(cyl(0.015, 0.015, 0.14, 6), c.D, 0.14, 0.44, 0), M(sphere(0.03), c.GL, 0.14, 0.52, 0));
        return { group: g, top: V(0, 0.4, 0) };
    },
    beak(c) {
        const g = grp(M(sphere(0.2), c.A, 0, 0.18, 0));
        const bk = M(cone(0.08, 0.26, 10), c.B, 0, 0.14, 0.27); bk.rotation.x = Math.PI / 2; g.add(bk);
        face(c, g, 0.24, 0.15, 0.08);
        return { group: g, top: V(0, 0.38, 0) };
    },
    jaw(c) {
        const g = grp(M(box(0.34, 0.2, 0.46, 0.06), c.A, 0, 0.2, 0.08), M(box(0.3, 0.08, 0.38, 0.03), c.B, 0, 0.05, 0.1));
        for (let i = 0; i < 4; i++) for (const side of [-1, 1]) g.add(M(cone(0.02, 0.06, 6), c.B, side * 0.12, 0.11, 0.3 - i * 0.07));
        face(c, g, 0.25, 0.3, 0.07);
        return { group: g, top: V(0, 0.32, -0.05) };
    },
};

// =====================================================================================
// CREST — on top of the head
const CREST = {
    antenna(c) { return grp(M(cyl(0.012, 0.012, 0.36, 6), c.D, 0, 0.18, 0), M(sphere(0.04), c.GL, 0, 0.38, 0)); },
    horn(c) { const h = M(cone(0.07, 0.3, 10), c.B, 0, 0.12, 0.06); h.rotation.x = 0.4; return grp(h); },
    valve(c) {
        const g = grp(M(cyl(0.04, 0.04, 0.14, 8), c.D, 0, 0.07, 0), M(torus(0.09, 0.015, 16), c.B, 0, 0.15, 0));
        g.children[1].rotation.x = Math.PI / 2;
        for (let i = 0; i < 3; i++) { const s = M(box(0.18, 0.012, 0.012, 0.004), c.B, 0, 0.15, 0); s.rotation.y = (i / 3) * Math.PI; g.add(s); }
        c.spinners.push(Object.assign(g.children[1], { userData: { axis: 'z', speed: 0.6 } }));
        return g;
    },
    lamp(c) { const g = grp(M(cyl(0.06, 0.09, 0.14, 12), c.B, 0, 0.08, 0), M(cyl(0.07, 0.07, 0.02, 12), c.GL, 0, 0.08, 0.06)); g.children[1].rotation.x = Math.PI / 2; return g; },
    fin(c) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-0.25, 0); s.lineTo(-0.05, 0.28); s.lineTo(0.06, 0.28); s.lineTo(0, 0); const m = M(G('fin', () => new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false })), c.B, 0.015, 0, 0.1); m.rotation.y = Math.PI / 2; return grp(m); },
    crown(c) {
        const g = grp(M(cyl(0.16, 0.15, 0.08, 16, true), metal('gold'), 0, 0.04, 0));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(M(cone(0.03, 0.12, 6), metal('gold'), Math.cos(a) * 0.15, 0.13, Math.sin(a) * 0.15), M(sphere(0.022, 8, 6), c.GL, Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15)); }
        return g;
    },
    spikes(c) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(M(cone(0.04, 0.16, 6), c.B, 0, 0.07, 0.12 - i * 0.09)); return g; },
    whistle(c) { const g = grp(M(cyl(0.03, 0.03, 0.12, 8), c.D, 0, 0.06, 0), M(cyl(0.05, 0.05, 0.14, 12), c.B, 0, 0.18, 0), M(sphere(0.05), c.B, 0, 0.26, 0)); c.emitters.push({ obj: g.children[2], kind: 'steam', rate: 0.6 }); return g; },
};

// =====================================================================================
// ARMS — built pointing outward (+x for side = 1), shoulder at the origin
function armBase(c, side, len = 0.3) {
    const g = new THREE.Group();
    g.add(M(sphere(0.07), c.D, 0, 0, 0));
    const up = M(cyl(0.045, 0.05, len, 10), c.A, side * len * 0.45, -len * 0.25, 0.04); up.rotation.z = side * 1.1; g.add(up);
    const el = M(sphere(0.055), c.B, side * len * 0.85, -len * 0.45, 0.08); g.add(el);
    return { g, hand: V(side * len * 0.95, -len * 0.55, 0.22) };
}
const ARMS = {
    claws(c, side) {
        const { g, hand } = armBase(c, side);
        const fore = M(cyl(0.04, 0.045, 0.22, 10), c.A, hand.x, hand.y + 0.02, hand.z - 0.08); fore.rotation.x = Math.PI / 2; g.add(fore);
        for (let i = -1; i <= 1; i++) { const cl = M(cone(0.025, 0.14, 6), c.B, hand.x + i * 0.04, hand.y, hand.z + 0.08); cl.rotation.x = Math.PI / 2 - 0.2; g.add(cl); }
        return g;
    },
    pincers(c, side) {
        const { g, hand } = armBase(c, side);
        for (const s of [-1, 1]) { const p = M(G('pincer', () => new THREE.TorusGeometry(0.1, 0.035, 8, 12, Math.PI)), c.B, hand.x, hand.y + s * 0.03, hand.z); p.rotation.set(s > 0 ? 0 : Math.PI, side > 0 ? 0 : Math.PI, Math.PI / 2); g.add(p); }
        return g;
    },
    pistons(c, side) {
        const { g, hand } = armBase(c, side);
        const pis = M(cyl(0.03, 0.03, 0.2, 8), c.D, hand.x, hand.y, hand.z - 0.06); pis.rotation.x = Math.PI / 2; g.add(pis);
        const sleeve = M(cyl(0.06, 0.06, 0.12, 12), c.A, hand.x, hand.y, hand.z - 0.14); sleeve.rotation.x = Math.PI / 2; g.add(sleeve);
        g.add(M(box(0.14, 0.13, 0.13, 0.04), c.B, hand.x, hand.y, hand.z + 0.06));
        return g;
    },
    hammers(c, side) {
        const { g, hand } = armBase(c, side);
        const h = M(cyl(0.08, 0.08, 0.24, 12), c.B, hand.x, hand.y, hand.z + 0.04); h.rotation.z = Math.PI / 2; g.add(h);
        g.add(M(torus(0.08, 0.015, 14), c.D, hand.x + 0.09, hand.y, hand.z + 0.04)); g.children[g.children.length - 1].rotation.y = Math.PI / 2;
        return g;
    },
    drills(c, side) {
        const { g, hand } = armBase(c, side);
        const d = new THREE.Group();
        const bit = M(cone(0.08, 0.3, 12), c.B, 0, 0.15, 0);
        d.add(bit);
        for (let i = 0; i < 3; i++) { const r = M(torus(0.07 - i * 0.02, 0.012, 10), c.D, 0, 0.05 + i * 0.08, 0); r.rotation.x = Math.PI / 2; d.add(r); }
        const holder = new THREE.Group(); holder.add(d); holder.rotation.x = Math.PI / 2; holder.position.copy(hand);
        g.add(holder);
        c.drills.push(d);
        return g;
    },
    saws(c, side) {
        const { g, hand } = armBase(c, side);
        const s = M(gearGeo(0.13, 16, 0.02, 0.2), c.B, hand.x, hand.y, hand.z);
        s.rotation.y = Math.PI / 2;
        s.userData = { axis: 'z', speed: 9 };
        c.spinners.push(s);
        g.add(s);
        return g;
    },
    tesla(c, side) {
        const { g, hand } = armBase(c, side);
        const rod = new THREE.Group();
        rod.add(M(cyl(0.02, 0.02, 0.26, 8), c.D, 0, 0.13, 0));
        for (let i = 0; i < 4; i++) { const r = M(torus(0.045, 0.012, 10), metal('copper'), 0, 0.05 + i * 0.05, 0); r.rotation.x = Math.PI / 2; rod.add(r); }
        rod.add(M(sphere(0.055), c.GL, 0, 0.3, 0));
        rod.position.copy(hand); rod.rotation.x = 0.9;
        c.emitters.push({ obj: rod.children[rod.children.length - 1], kind: 'spark', rate: 1.2 });
        g.add(rod);
        return g;
    },
    cannons(c, side) {
        const { g, hand } = armBase(c, side);
        const b = M(cyl(0.06, 0.08, 0.36, 14), c.B, hand.x, hand.y, hand.z); b.rotation.x = Math.PI / 2; g.add(b);
        const mz = M(torus(0.065, 0.02, 14), c.A, hand.x, hand.y, hand.z + 0.18); g.add(mz);
        g.add(M(cyl(0.045, 0.045, 0.02, 12), c.GL, hand.x, hand.y, hand.z + 0.18)); g.children[g.children.length - 1].rotation.x = Math.PI / 2;
        return g;
    },
    nozzles(c, side) {
        const g = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(side * 0.15, -0.12, 0.05), V(side * 0.22, -0.2, 0.2), V(side * 0.2, -0.18, 0.32)]);
        g.add(M(new THREE.TubeGeometry(curve, 16, 0.035, 8), MAT.rubber));
        const n = M(cone(0.06, 0.14, 12), c.B, side * 0.2, -0.18, 0.38); n.rotation.x = -Math.PI / 2; g.add(n);
        return g;
    },
    tendrils(c, side) {
        const g = new THREE.Group();
        for (let k = 0; k < 2; k++) {
            const t = new THREE.Group();
            const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(side * 0.18, -0.06, 0.05 + k * 0.05), V(side * 0.32, -0.2, 0.12), V(side * 0.38, -0.36 + k * 0.08, 0.2)]);
            t.add(M(new THREE.TubeGeometry(curve, 16, 0.025 - k * 0.006, 6), k ? c.B : c.A));
            t.add(M(sphere(0.035), c.GL, side * 0.38, -0.36 + k * 0.08, 0.2));
            t.rotation.y = k * 0.4 * side;
            c.tendrils.push(t);
            g.add(t);
        }
        return g;
    },
    grabbers(c, side) {
        const { g, hand } = armBase(c, side);
        const hook = M(G('hook', () => new THREE.TorusGeometry(0.08, 0.025, 8, 14, Math.PI * 1.4)), c.B, hand.x, hand.y - 0.06, hand.z);
        hook.rotation.y = Math.PI / 2; g.add(hook);
        g.add(M(cyl(0.012, 0.012, 0.14, 6), c.D, hand.x, hand.y + 0.03, hand.z));
        return g;
    },
    blades(c, side) {
        const { g, hand } = armBase(c, side);
        const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.2, 0.12, 0.42, 0.02); s.quadraticCurveTo(0.2, 0.05, 0, -0.05); s.lineTo(0, 0);
        const b = M(G('blade', () => new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false })), metal('steel'), hand.x, hand.y, hand.z - 0.05);
        b.rotation.set(0, -Math.PI / 2, side > 0 ? 0.3 : 0.3); g.add(b);
        return g;
    },
    shields(c, side) {
        const { g, hand } = armBase(c, side, 0.26);
        const sh = M(G('shieldplate', () => new THREE.CylinderGeometry(0.2, 0.2, 0.04, 6)), c.B, hand.x + side * 0.04, hand.y + 0.05, hand.z - 0.05);
        sh.rotation.z = Math.PI / 2; g.add(sh);
        g.add(M(sphere(0.04), c.A, hand.x + side * 0.07, hand.y + 0.05, hand.z - 0.05));
        return g;
    },
};

// =====================================================================================
// BACK RIGS — at the back anchor, facing -z
const BACKS = {
    stack(c) {
        const g = new THREE.Group();
        const n = c.S.stage >= 2 ? 2 : 1;
        for (let i = 0; i < n; i++) {
            const x = n === 1 ? 0 : (i ? 0.13 : -0.13);
            const s = grp(M(cyl(0.07, 0.08, 0.5, 12), c.D, 0, 0.25, 0), M(lathe('stacktop', [[0.07, 0], [0.11, 0.06], [0.12, 0.1], [0.09, 0.1]]), c.B, 0, 0.5, 0), M(torus(0.08, 0.015, 12), c.B, 0, 0.18, 0));
            s.children[2].rotation.x = Math.PI / 2;
            s.position.set(x, 0.15, -0.02);
            g.add(s);
            c.emitters.push({ obj: s.children[1], kind: 'smoke', rate: 2 });
        }
        return g;
    },
    tank(c) {
        const g = grp(M(G('ptank', () => new THREE.CapsuleGeometry(0.13, 0.36, 6, 14)), c.B, 0, 0.1, -0.08));
        g.children[0].rotation.z = Math.PI / 2;
        g.add(M(cyl(0.05, 0.05, 0.02, 12), MAT.glass, 0, 0.2, -0.08), M(cyl(0.02, 0.02, 0.18, 8), c.D, 0.2, 0.18, -0.08));
        return g;
    },
    gear(c) {
        const gr = M(gearGeo(0.32, 14, 0.06), c.B, 0, 0.18, -0.06);
        gr.userData = { axis: 'z', speed: 0.8 };
        c.spinners.push(gr);
        return grp(gr, M(cyl(0.05, 0.05, 0.14, 10), c.D, 0, 0.18, -0.02));
    },
    wings(c) {
        const g = new THREE.Group();
        for (const side of [-1, 1]) {
            const w = new THREE.Group();
            for (let i = 0; i < 4; i++) { const r = M(cyl(0.012, 0.012, 0.6 - i * 0.08, 6), c.B, side * (0.18 + i * 0.03), 0.12 + i * 0.03, 0); r.rotation.z = side * (1.0 - i * 0.28); w.add(r); }
            const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.55, 0.32); s.lineTo(0.5, 0.05); s.lineTo(0.4, -0.12); s.lineTo(0.2, -0.08); s.lineTo(0, 0);
            const mem = M(G('wingmem', () => new THREE.ShapeGeometry(s)), new THREE.MeshStandardMaterial({ color: c.A.color, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, 0.06, 0);
            if (side < 0) mem.scale.x = -1;
            w.add(mem);
            w.position.set(side * 0.05, 0.1, -0.05);
            w.userData = { side };
            c.tendrils.push(w);
            g.add(w);
        }
        return g;
    },
    propeller(c) {
        const g = grp(M(cyl(0.06, 0.08, 0.16, 10), c.D, 0, 0.1, -0.06));
        g.children[0].rotation.x = Math.PI / 2;
        const p = new THREE.Group();
        for (let i = 0; i < 3; i++) { const b = M(box(0.06, 0.4, 0.02, 0.01), c.A, 0, 0.2, 0); const piv = new THREE.Group(); piv.add(b); piv.rotation.z = (i / 3) * Math.PI * 2; p.add(piv); }
        p.position.set(0, 0.1, -0.16);
        p.userData = { axis: 'z', speed: 16 };
        c.spinners.push(p);
        g.add(p);
        return g;
    },
    coil(c) {
        const g = grp(M(cyl(0.05, 0.08, 0.5, 10), c.D, 0, 0.3, -0.06));
        for (let i = 0; i < 5; i++) { const r = M(torus(0.09 - i * 0.012, 0.018, 12), metal('copper'), 0, 0.12 + i * 0.09, -0.06); r.rotation.x = Math.PI / 2; g.add(r); }
        const top = M(sphere(0.09), c.GL, 0, 0.6, -0.06); g.add(top);
        c.emitters.push({ obj: top, kind: 'spark', rate: 2.5 });
        return g;
    },
    turbine(c) {
        const g = new THREE.Group();
        for (const x of [-0.16, 0.16]) {
            const t = grp(M(cyl(0.1, 0.12, 0.4, 16, true), c.B, 0, 0, 0), M(cyl(0.085, 0.085, 0.02, 16), glow(c.gcol, 3), 0, -0.19, 0), M(torus(0.11, 0.02, 14), c.A, 0, 0.18, 0));
            t.children[2].rotation.x = Math.PI / 2;
            t.rotation.x = Math.PI / 2 - 0.3;
            t.position.set(x, 0.15, -0.12);
            c.emitters.push({ obj: t.children[1], kind: 'jet', rate: 6 });
            g.add(t);
        }
        return g;
    },
    furnace(c) {
        const g = grp(M(box(0.42, 0.36, 0.2, 0.04), c.D, 0, 0.12, -0.05));
        for (let i = 0; i < 4; i++) g.add(M(box(0.34, 0.025, 0.02, 0.005), c.B, 0, 0.0 + i * 0.075, -0.16));
        g.add(M(box(0.32, 0.26, 0.02, 0.01), glow('#ff6a1a', 2.6), 0, 0.11, -0.15));
        c.emitters.push({ obj: g.children[g.children.length - 1], kind: 'ember', rate: 2 });
        return g;
    },
    dish(c) {
        const g = grp(M(cyl(0.02, 0.03, 0.3, 8), c.D, 0, 0.15, -0.04));
        const d = M(G('dish', () => new THREE.SphereGeometry(0.26, 18, 8, 0, Math.PI * 2, 0, 0.9)), c.B, 0, 0.36, -0.08);
        d.material = c.B; d.rotation.x = -2.2; g.add(d);
        g.add(M(sphere(0.03), c.GL, 0, 0.42, 0.0));
        c.spinners.push(Object.assign(g, { userData: { axis: 'y', speed: 0.5 } }));
        return grp(g);
    },
    vats(c) {
        const g = new THREE.Group();
        for (const x of [-0.12, 0.12]) {
            g.add(M(cyl(0.09, 0.09, 0.3, 14, true), MAT.glass, x, 0.15, -0.08), M(cyl(0.08, 0.08, 0.22, 14), glow(c.gcol, 1.8), x, 0.12, -0.08), M(cyl(0.1, 0.1, 0.04, 14), c.B, x, 0.31, -0.08), M(cyl(0.1, 0.1, 0.04, 14), c.B, x, 0.0, -0.08));
            c.emitters.push({ obj: g.children[g.children.length - 2], kind: 'bubble', rate: 1.2 });
        }
        return g;
    },
    crystal(c) {
        const g = new THREE.Group();
        const cm = new THREE.MeshPhysicalMaterial({ color: c.gcol, emissive: new THREE.Color(c.gcol), emissiveIntensity: 1.1, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.85, clearcoat: 1 });
        for (let i = 0; i < 5; i++) {
            const k = M(octa(0.1 + (i % 3) * 0.04), cm, (i - 2) * 0.09, 0.15 + (i % 2) * 0.12, -0.08 - (i % 2) * 0.05);
            k.scale.y = 2.2; k.rotation.z = (i - 2) * 0.25;
            g.add(k);
        }
        c.spinners.push(Object.assign(g, { userData: { axis: 'y', speed: 0.3 } }));
        return grp(g);
    },
    sail(c) {
        const g = new THREE.Group();
        const sm = new THREE.MeshStandardMaterial({ color: '#1a2a4a', emissive: new THREE.Color(c.gcol), emissiveIntensity: 0.25, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
        for (const side of [-1, 1]) {
            const p = M(G('sailp', () => new THREE.PlaneGeometry(0.5, 0.36)), sm, side * 0.32, 0.25, -0.06);
            p.rotation.set(0, side * 0.3, side * -0.35);
            g.add(p, M(cyl(0.012, 0.012, 0.5, 6), c.B, side * 0.32, 0.25, -0.05));
            g.children[g.children.length - 1].rotation.z = Math.PI / 2 + side * -0.35;
        }
        return g;
    },
    balloon(c) {
        const g = new THREE.Group();
        const env = M(sphere(0.45, 24, 16), metal('cream'), 0, 0.75, -0.1); env.scale.set(0.8, 0.6, 1.4); g.add(env);
        for (let i = 0; i < 4; i++) { const b = M(torus(0.45, 0.012, 28), c.B, 0, 0.75, -0.1 - 0.42 + i * 0.28); b.scale.set(0.8 * Math.cos((i - 1.5) * 0.45), 0.6 * Math.cos((i - 1.5) * 0.45), 1); g.add(b); }
        for (const x of [-0.2, 0.2]) g.add(M(cyl(0.006, 0.006, 0.5, 4), MAT.rubber, x, 0.35, -0.1));
        return g;
    },
    horn(c) {
        const h = M(lathe('gramhorn', [[0.03, 0], [0.04, 0.2], [0.07, 0.35], [0.14, 0.45], [0.26, 0.52], [0.27, 0.53]]), c.B, 0, 0.1, -0.05);
        h.rotation.x = -0.9;
        h.material = c.B;
        return grp(h, M(cyl(0.05, 0.05, 0.1, 10), c.D, 0, 0.05, 0));
    },
    spikes(c) { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const s = M(cone(0.05, 0.22, 8), c.B, 0, 0.12 + i * 0.03, -0.04 - i * 0.02); s.rotation.x = -0.6; s.position.y = 0.05 + Math.sin(i / 4 * Math.PI) * 0.1; s.position.z = 0.1 - i * 0.12; g.add(s); } return g; },
};

// =====================================================================================
// OVERGROWTH
function scatter(ctx, body, an, count, make) {
    let s = ctx.seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const top = an.top.y;
    for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2, y = top * (0.5 + rnd() * 0.5), r = 0.3 + rnd() * 0.12;
        const o = make(rnd);
        o.position.set(Math.cos(a) * r * 0.9, y, Math.sin(a) * r * 0.9);
        o.lookAt(o.position.clone().multiplyScalar(2));
        body.add(o);
    }
}
const OVER = {
    moss(c, body, an) {
        scatter(c, body, an, 9, (rnd) => { const m = M(ico(0.08 + rnd() * 0.07, 1), rnd() > 0.5 ? MAT.moss : MAT.moss2); m.scale.set(1.3, 0.6, 1.3); return m; });
        for (let i = 0; i < 3; i++) { const sprout = grp(M(cyl(0.008, 0.01, 0.16, 5), MAT.moss, 0, 0.08, 0), M(sphere(0.035, 8, 6), MAT.moss2, 0.02, 0.17, 0)); sprout.position.set(-0.08 + i * 0.08, an.top.y - 0.02, 0); sprout.rotation.z = (i - 1) * 0.4; body.add(sprout); }
    },
    frost(c, body, an) {
        scatter(c, body, an, 10, (rnd) => { const m = M(cone(0.03 + rnd() * 0.02, 0.12 + rnd() * 0.1, 6), MAT.ice); m.rotation.x = Math.PI; return grp(m); });
    },
    crystal(c, body, an) {
        const cm = new THREE.MeshPhysicalMaterial({ color: c.gcol, emissive: new THREE.Color(c.gcol), emissiveIntensity: 0.9, roughness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 });
        scatter(c, body, an, 7, (rnd) => { const m = M(octa(0.05 + rnd() * 0.05), cm); m.scale.y = 2.4; return grp(m); });
    },
    rust(c, body, an) {
        scatter(c, body, an, 12, (rnd) => { const m = M(ico(0.05 + rnd() * 0.04, 0), MAT.rustFlake); m.scale.set(1.4, 0.5, 1.2); return m; });
    },
};

/** Dispose nothing (geometries and materials are shared); detach from the scene. */
export function removeBot(bot) { if (bot && bot.root.parent) bot.root.parent.remove(bot.root); }
