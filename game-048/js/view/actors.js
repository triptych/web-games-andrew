/**
 * actors.js — the hero, monsters, allies and Wardens as procedural models,
 * plus their animation: smooth tile-to-tile hops, lunges, hit flashes,
 * deaths, elite auras, status tints and floating health bars.
 *
 * A model is built from primitives by body plan and coloured from the
 * species; a per-monster seed jitters proportions so packs aren't clones.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { glowTexture } from './textures.js';
import { SPECIES, ELITE_AFFIXES } from '../sim/monsters.js';
import { CLASSES } from '../sim/classes.js';

const actors = new Map();   // id → actor view
export const actorViews = actors;

const geo = {
    box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(0.5, 14, 10), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cone: new THREE.ConeGeometry(0.5, 1, 10), ico: new THREE.IcosahedronGeometry(0.5, 0), oct: new THREE.OctahedronGeometry(0.5, 0),
    tor: new THREE.TorusGeometry(0.4, 0.08, 8, 20), cap: new THREE.CapsuleGeometry(0.5, 1, 4, 10), dod: new THREE.DodecahedronGeometry(0.5, 0),
    wing: (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.5, 0.45, 1, 0.1); s.lineTo(0.75, -0.05); s.lineTo(0.55, 0.08); s.lineTo(0.35, -0.08); s.lineTo(0, 0); return new THREE.ShapeGeometry(s); })(),
    plane: new THREE.PlaneGeometry(1, 1),
};

function mats(c, c2, glow) {
    return {
        main: new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0.05 }),
        acc: new THREE.MeshStandardMaterial({ color: c2, roughness: 0.55, metalness: 0.1 }),
        glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(glow || 0xffe0a0).multiplyScalar(2.2) }),
        dark: new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.6 }),
        wing: new THREE.MeshStandardMaterial({ color: c2, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    };
}

function P(parent, g, m, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
}
const rnd = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ------------------------------------------------------------------ Humanoids

/** Hooded figure used by the hero, wayfarers, merchants and humanoid monsters. */
export function buildHumanoid(o = {}) {
    const g = new THREE.Group();
    const M = mats(o.robe ?? 0x5a4a3a, o.skin ?? 0xe0b890, o.glow);
    const body = new THREE.Group(); g.add(body);
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(s * 0.1, 0.36, 0); body.add(leg);
        P(leg, geo.cap, M.dark, 0, -0.18, 0, 0.11, 0.2, 0.11);
        legs.push(leg);
    }
    P(body, geo.cone, M.main, 0, 0.62, 0, 0.5, 0.62, 0.42);                    // robe
    P(body, geo.sph, M.main, 0, 0.86, 0, 0.34, 0.3, 0.28);                     // shoulders
    const head = new THREE.Group(); head.position.y = 1.08; body.add(head);
    P(head, geo.sph, M.acc, 0, 0, 0, 0.24, 0.26, 0.24);
    P(head, geo.sph, M.dark, -0.05, 0.02, 0.11, 0.04, 0.04, 0.03);
    P(head, geo.sph, M.dark, 0.05, 0.02, 0.11, 0.04, 0.04, 0.03);
    if (o.hood) P(head, geo.cone, M.main, 0, 0.1, -0.03, 0.34, 0.34, 0.34, -0.25);
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(s * 0.2, 0.86, 0); body.add(arm);
        P(arm, geo.cap, M.main, 0, -0.17, 0, 0.09, 0.18, 0.09);
        arms.push(arm);
    }
    if (o.pack) P(body, geo.box, M.dark, 0, 0.8, -0.2, 0.3, 0.36, 0.18);
    g.userData = { body, legs, arms, head, M };
    return g;
}

function buildHero(cls) {
    const C = CLASSES[cls];
    const g = buildHumanoid({ robe: C.col, skin: 0xe8c098, hood: cls === 'ranger' });
    const { head, arms, body, M } = g.userData;
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.8, roughness: 0.3 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.7 });
    if (cls === 'warden') {
        P(head, geo.sph, metal, 0, 0.06, 0, 0.27, 0.22, 0.27);                  // helm
        P(head, geo.box, metal, 0, 0.2, 0, 0.04, 0.12, 0.2);                    // crest
        P(arms[0], geo.cyl, metal, -0.06, -0.3, 0.1, 0.36, 0.06, 0.36, Math.PI / 2, 0, 0.2); // shield
        P(arms[1], geo.box, metal, 0.02, -0.5, 0.18, 0.05, 0.5, 0.03, 0.6);    // sword
        P(arms[1], geo.box, wood, 0.02, -0.32, 0.06, 0.12, 0.04, 0.04, 0.6);
        P(body, geo.sph, metal, -0.2, 0.92, 0, 0.16, 0.12, 0.16);
        P(body, geo.sph, metal, 0.2, 0.92, 0, 0.16, 0.12, 0.16);
    } else if (cls === 'ranger') {
        const bow = P(arms[0], geo.tor, wood, -0.02, -0.32, 0.12, 0.7, 0.9, 0.5, 0, Math.PI / 2, 0);
        bow.scale.set(0.55, 0.9, 0.55);
        P(body, geo.cyl, wood, 0.08, 0.86, -0.18, 0.1, 0.4, 0.1, 0.3, 0, -0.3); // quiver
        P(body, geo.cone, M.acc, 0, 0.55, -0.12, 0.42, 0.5, 0.2, -0.15);        // cloak hint
    } else {
        P(head, geo.cone, M.main, 0, 0.3, -0.04, 0.42, 0.55, 0.42, -0.25);      // witch hat
        P(head, geo.cyl, M.main, 0, 0.12, 0, 0.5, 0.03, 0.5);                    // brim
        const staff = new THREE.Group(); staff.position.set(0.02, -0.25, 0.1); arms[1].add(staff);
        P(staff, geo.cyl, wood, 0, 0, 0, 0.04, 1.1, 0.04);
        const orb = P(staff, geo.ico, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a40).multiplyScalar(2.4) }), 0, 0.6, 0, 0.14, 0.14, 0.14);
        g.userData.orb = orb;
    }
    // The lantern, held in the off hand (or on the belt for the warden).
    const lan = new THREE.Group();
    if (cls === 'warden') { lan.position.set(0.24, 0.62, 0.12); body.add(lan); }
    else { lan.position.set(0.02, -0.38, 0.06); arms[0].add(lan); }
    P(lan, geo.box, new THREE.MeshStandardMaterial({ color: 0x3a3028, metalness: 0.6, roughness: 0.4 }), 0, 0.09, 0, 0.12, 0.02, 0.12);
    const flame = P(lan, geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc060).multiplyScalar(1.8) }), 0, 0, 0, 0.09, 0.12, 0.09);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
    halo.scale.set(0.45, 0.45, 1);
    lan.add(halo);
    g.userData.lantern = lan; g.userData.flame = flame; g.userData.halo = halo;
    return g;
}

// ------------------------------------------------------------------ Monsters by body plan

function buildBody(plan, s, seed, glow) {
    const r = rnd(seed);
    const g = new THREE.Group();
    const M = mats(s.c, s.c2, glow || s.g || s.c2);
    const body = new THREE.Group(); g.add(body);
    const ud = { body, legs: [], wings: [], M, plan };
    const eyes = (parent, y, z, sp = 0.08, size = 0.05, n = 2) => {
        for (let i = 0; i < n; i++) { const x = n === 1 ? 0 : (i - (n - 1) / 2) * sp; P(parent, geo.sph, M.glow, x, y, z, size, size, size * 0.6); }
    };
    const j = (a) => a * (0.9 + r() * 0.2);
    switch (plan) {
        case 'quad': {
            P(body, geo.cap, M.main, 0, 0.42, 0, j(0.38), j(0.32), j(0.36), Math.PI / 2);
            const head = new THREE.Group(); head.position.set(0, 0.52, 0.42); body.add(head);
            P(head, geo.sph, M.main, 0, 0, 0, 0.32, 0.28, 0.36);
            P(head, geo.cone, M.acc, 0, -0.03, 0.2, 0.14, 0.2, 0.14, Math.PI / 2);
            P(head, geo.cone, M.main, -0.1, 0.16, -0.02, 0.08, 0.16, 0.08);
            P(head, geo.cone, M.main, 0.1, 0.16, -0.02, 0.08, 0.16, 0.08);
            eyes(head, 0.06, 0.15, 0.14, 0.05);
            for (const [x, z] of [[-0.14, 0.24], [0.14, 0.24], [-0.14, -0.24], [0.14, -0.24]]) {
                const leg = new THREE.Group(); leg.position.set(x, 0.32, z); body.add(leg);
                P(leg, geo.cap, M.acc, 0, -0.14, 0, 0.07, 0.15, 0.07);
                ud.legs.push(leg);
            }
            P(body, geo.cone, M.main, 0, 0.45, -0.5, 0.06, 0.4, 0.06, -Math.PI / 2.5); // tail
            ud.head = head;
            break;
        }
        case 'biped': case 'imp': {
            const small = plan === 'imp';
            const h = small ? 0.75 : 1;
            for (const sx of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(sx * 0.12 * h, 0.4 * h, 0); body.add(leg); P(leg, geo.cap, M.acc, 0, -0.2 * h, 0, 0.1 * h, 0.22 * h, 0.1 * h); ud.legs.push(leg); }
            P(body, geo.cap, M.main, 0, 0.72 * h, 0, j(0.32) * h, j(0.28) * h, 0.24 * h);
            const head = new THREE.Group(); head.position.y = 1.08 * h; body.add(head);
            P(head, geo.sph, M.main, 0, 0, 0, 0.28 * h, 0.28 * h, 0.26 * h);
            eyes(head, 0.02 * h, 0.12 * h, 0.1 * h, 0.045 * h);
            if (small) { P(head, geo.cone, M.acc, -0.1, 0.15, 0, 0.06, 0.18, 0.06, 0, 0, 0.4); P(head, geo.cone, M.acc, 0.1, 0.15, 0, 0.06, 0.18, 0.06, 0, 0, -0.4); for (const sx of [-1, 1]) { const wg = new THREE.Group(); wg.position.set(sx * 0.12, 0.8 * h, -0.12); body.add(wg); P(wg, geo.wing, M.wing, 0, 0, 0, sx * 0.5, 0.5, 0.5); ud.wings.push(wg); } }
            for (const sx of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(sx * 0.27 * h, 0.88 * h, 0); body.add(arm); P(arm, geo.cap, M.main, 0, -0.18 * h, 0.04, 0.08 * h, 0.2 * h, 0.08 * h); ud.legs.push(arm); }
            if (s.a === 'caster' || s.a === 'summoner' || s.a === 'healer') P(body, geo.ico, M.glow, 0.32 * h, 0.7 * h, 0.15, 0.1, 0.1, 0.1);
            if (s.a === 'archer') P(body, geo.tor, M.acc, -0.3, 0.7, 0.1, 0.4, 0.7, 0.4, 0, Math.PI / 2, 0);
            ud.head = head;
            break;
        }
        case 'skeleton': {
            const bone = M.main;
            for (const sx of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(sx * 0.1, 0.42, 0); body.add(leg); P(leg, geo.cyl, bone, 0, -0.2, 0, 0.05, 0.42, 0.05); ud.legs.push(leg); }
            P(body, geo.cyl, bone, 0, 0.72, 0, 0.05, 0.45, 0.05);
            for (let k = 0; k < 4; k++) P(body, geo.tor, bone, 0, 0.6 + k * 0.08, 0, 0.32 - k * 0.02, 0.32 - k * 0.02, 0.4, Math.PI / 2);
            const head = new THREE.Group(); head.position.y = 1.08; body.add(head);
            P(head, geo.sph, bone, 0, 0, 0, 0.26, 0.26, 0.26);
            P(head, geo.box, bone, 0, -0.12, 0.04, 0.16, 0.08, 0.14);
            P(head, geo.sph, M.dark, -0.06, 0.02, 0.1, 0.07, 0.07, 0.05); P(head, geo.sph, M.dark, 0.06, 0.02, 0.1, 0.07, 0.07, 0.05);
            eyes(head, 0.02, 0.12, 0.12, 0.025);
            for (const sx of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(sx * 0.2, 0.9, 0); body.add(arm); P(arm, geo.cyl, bone, 0, -0.2, 0.03, 0.04, 0.4, 0.04); ud.legs.push(arm); }
            if (s.a === 'archer') P(body, geo.tor, M.acc, -0.28, 0.72, 0.12, 0.4, 0.7, 0.4, 0, Math.PI / 2, 0);
            ud.head = head;
            break;
        }
        case 'blob': {
            const b = P(body, geo.sph, M.main, 0, 0.3, 0, j(0.7), j(0.55), j(0.7));
            b.material = new THREE.MeshStandardMaterial({ color: s.c, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 });
            ud.M.main = b.material;
            P(body, geo.sph, M.acc, 0, 0.32, 0, 0.3, 0.25, 0.3);
            eyes(body, 0.42, 0.3, 0.16, 0.06);
            ud.squish = b;
            break;
        }
        case 'wraith': case 'wisp': case 'jelly': {
            const fl = new THREE.Group(); fl.position.y = 0.45; body.add(fl); ud.float = fl;
            if (plan === 'wraith') {
                P(fl, geo.cone, M.main, 0, 0.25, 0, 0.55, 0.9, 0.5, Math.PI);
                P(fl, geo.sph, M.main, 0, 0.62, 0, 0.32, 0.32, 0.3);
                P(fl, geo.cone, M.main, 0, 0.75, -0.04, 0.38, 0.4, 0.38, -0.3);
                eyes(fl, 0.62, 0.14, 0.12, 0.05);
                for (const sx of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(sx * 0.26, 0.45, 0); fl.add(arm); P(arm, geo.cone, M.main, 0, -0.2, 0.05, 0.08, 0.4, 0.08, Math.PI); ud.legs.push(arm); }
                M.main.transparent = true; M.main.opacity = 0.82; M.main.emissive = new THREE.Color(s.c2).multiplyScalar(0.25);
            } else if (plan === 'wisp') {
                P(fl, geo.ico, M.glow, 0, 0.3, 0, 0.32, 0.32, 0.32);
                for (let k = 0; k < 3; k++) P(fl, geo.oct, M.acc, Math.cos(k * 2.1) * 0.32, 0.3, Math.sin(k * 2.1) * 0.32, 0.1, 0.2, 0.1);
                ud.spin = fl;
            } else {
                P(fl, geo.sph, M.main, 0, 0.45, 0, 0.6, 0.45, 0.6);
                M.main.transparent = true; M.main.opacity = 0.7; M.main.emissive = new THREE.Color(s.g || s.c2).multiplyScalar(0.4);
                for (let k = 0; k < 6; k++) { const t = new THREE.Group(); t.position.set(Math.cos(k) * 0.18, 0.3, Math.sin(k) * 0.18); fl.add(t); P(t, geo.cyl, M.acc, 0, -0.25, 0, 0.03, 0.5, 0.03); ud.legs.push(t); }
                eyes(fl, 0.5, 0.26, 0.14, 0.05);
            }
            break;
        }
        case 'serpent': {
            const segs = [];
            for (let k = 0; k < 5; k++) { const sg = P(body, geo.sph, k % 2 ? M.acc : M.main, 0, 0.18, -k * 0.2 + 0.3, 0.3 - k * 0.035, 0.26 - k * 0.03, 0.3); segs.push(sg); }
            const head = new THREE.Group(); head.position.set(0, 0.28, 0.48); body.add(head);
            P(head, geo.sph, M.main, 0, 0, 0, 0.3, 0.24, 0.36);
            eyes(head, 0.06, 0.13, 0.14, 0.04);
            ud.segs = segs; ud.head = head;
            break;
        }
        case 'spider': case 'bug': {
            P(body, geo.sph, M.main, 0, 0.32, -0.15, j(0.55), j(0.42), j(0.6));
            P(body, geo.sph, M.acc, 0, 0.3, 0.22, 0.32, 0.26, 0.3);
            if (plan === 'bug') P(body, geo.sph, M.acc, 0, 0.42, -0.15, 0.58, 0.18, 0.62);
            eyes(body, 0.34, 0.36, 0.08, 0.035, plan === 'spider' ? 4 : 2);
            const n = plan === 'spider' ? 4 : 3;
            for (let k = 0; k < n; k++) for (const sx of [-1, 1]) {
                const leg = new THREE.Group(); leg.position.set(sx * 0.18, 0.3, 0.12 - k * 0.14); body.add(leg);
                P(leg, geo.cyl, M.acc, sx * 0.2, 0.05, 0, 0.035, 0.42, 0.035, 0, 0, sx * 1.1);
                P(leg, geo.cyl, M.acc, sx * 0.38, -0.12, 0, 0.03, 0.32, 0.03, 0, 0, -sx * 0.3);
                ud.legs.push(leg);
            }
            if (s.a === 'tank') P(body, geo.dod, M.acc, 0, 0.5, -0.15, 0.5, 0.3, 0.5);
            break;
        }
        case 'bat': {
            const fl = new THREE.Group(); fl.position.y = 0.7; body.add(fl); ud.float = fl;
            P(fl, geo.sph, M.main, 0, 0, 0, 0.26, 0.24, 0.28);
            P(fl, geo.cone, M.main, -0.07, 0.15, 0.04, 0.06, 0.12, 0.06); P(fl, geo.cone, M.main, 0.07, 0.15, 0.04, 0.06, 0.12, 0.06);
            eyes(fl, 0.03, 0.13, 0.08, 0.035);
            for (const sx of [-1, 1]) { const wg = new THREE.Group(); wg.position.set(sx * 0.1, 0, 0); fl.add(wg); P(wg, geo.wing, M.wing, 0, 0, 0, sx * 0.62, 0.62, 0.62, -Math.PI / 2); ud.wings.push(wg); }
            break;
        }
        case 'shroom': {
            for (const sx of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(sx * 0.1, 0.25, 0); body.add(leg); P(leg, geo.cap, M.acc, 0, -0.12, 0, 0.08, 0.12, 0.08); ud.legs.push(leg); }
            P(body, geo.cyl, M.acc, 0, 0.45, 0, 0.32, 0.5, 0.32);
            const capM = M.main;
            P(body, geo.sph, capM, 0, 0.78, 0, 0.82, 0.45, 0.82);
            for (let k = 0; k < 5; k++) P(body, geo.sph, M.acc, Math.cos(k * 1.3) * 0.25, 0.92, Math.sin(k * 1.3) * 0.25, 0.1, 0.06, 0.1);
            eyes(body, 0.5, 0.16, 0.1, 0.04);
            if (s.g) { const gl = P(body, geo.sph, M.glow, 0, 0.65, 0, 0.6, 0.06, 0.6); gl.castShadow = false; }
            ud.head = body;
            break;
        }
        case 'book': {
            const fl = new THREE.Group(); fl.position.y = 0.55; body.add(fl); ud.float = fl;
            P(fl, geo.box, M.acc, 0, 0, 0, 0.42, 0.06, 0.32);
            for (const sx of [-1, 1]) { const cv = new THREE.Group(); cv.position.x = 0; fl.add(cv); P(cv, geo.box, M.main, sx * 0.22, 0.02, 0, 0.44, 0.04, 0.34); ud.wings.push(cv); }
            P(fl, geo.box, M.glow, 0, 0.05, 0.12, 0.3, 0.01, 0.05);
            break;
        }
        case 'crystal': {
            for (let k = 0; k < 4; k++) P(body, geo.oct, k ? M.main : M.glow, (r() - 0.5) * 0.3, 0.35 + r() * 0.2, (r() - 0.5) * 0.3, 0.22, 0.5 + r() * 0.4, 0.22, 0, 0, (r() - 0.5) * 0.6);
            M.main.metalness = 0.4; M.main.roughness = 0.15; M.main.emissive = new THREE.Color(s.c).multiplyScalar(0.25);
            ud.spin = body;
            break;
        }
        case 'construct': case 'turret': {
            if (plan === 'turret') {
                P(body, geo.cyl, M.main, 0, 0.25, 0, 0.6, 0.5, 0.6);
                const head = new THREE.Group(); head.position.y = 0.6; body.add(head);
                P(head, geo.sph, M.main, 0, 0, 0, 0.5, 0.4, 0.5);
                P(head, geo.cyl, M.acc, 0, 0, 0.3, 0.1, 0.4, 0.1, Math.PI / 2);
                eyes(head, 0.1, 0.24, 0.1, 0.05, 1);
                ud.head = head;
            } else {
                for (const sx of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(sx * 0.18, 0.42, 0); body.add(leg); P(leg, geo.box, M.acc, 0, -0.2, 0, 0.16, 0.42, 0.18); ud.legs.push(leg); }
                P(body, geo.box, M.main, 0, 0.75, 0, j(0.62), j(0.5), 0.4);
                P(body, geo.box, M.acc, 0, 0.75, 0.21, 0.3, 0.2, 0.02);
                const head = new THREE.Group(); head.position.y = 1.08; body.add(head);
                P(head, geo.box, M.main, 0, 0, 0, 0.3, 0.24, 0.28);
                eyes(head, 0, 0.15, 0.12, 0.04);
                for (const sx of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(sx * 0.4, 0.9, 0); body.add(arm); P(arm, geo.box, M.main, 0, -0.22, 0, 0.16, 0.46, 0.16); ud.legs.push(arm); }
                if (s.g) P(body, geo.ico, M.glow, 0, 0.78, 0.2, 0.14, 0.14, 0.06);
                M.main.metalness = 0.5; M.main.roughness = 0.4;
                ud.head = head;
            }
            break;
        }
        case 'drone': {
            const fl = new THREE.Group(); fl.position.y = 0.75; body.add(fl); ud.float = fl;
            P(fl, geo.sph, M.main, 0, 0, 0, 0.3, 0.22, 0.3);
            eyes(fl, 0, 0.14, 0.1, 0.05, 1);
            for (const sx of [-1, 1]) { const rot = new THREE.Group(); rot.position.set(sx * 0.25, 0.1, 0); fl.add(rot); P(rot, geo.box, M.acc, 0, 0, 0, 0.36, 0.01, 0.06); ud.wings.push(rot); }
            ud.rotors = true;
            break;
        }
        case 'eye': {
            const fl = new THREE.Group(); fl.position.y = 0.7; body.add(fl); ud.float = fl;
            P(fl, geo.sph, M.main, 0, 0, 0, 0.6, 0.6, 0.6);
            P(fl, geo.sph, new THREE.MeshStandardMaterial({ color: 0xf0e8e0, roughness: 0.3 }), 0, 0, 0.18, 0.4, 0.4, 0.3);
            P(fl, geo.sph, M.glow, 0, 0, 0.32, 0.18, 0.18, 0.08);
            for (let k = 0; k < 5; k++) { const t = new THREE.Group(); t.rotation.set(-0.6 - r() * 0.4, k * 1.25, 0); fl.add(t); P(t, geo.cone, M.acc, 0, 0.42, 0, 0.06, 0.35, 0.06); }
            ud.spin = null;
            break;
        }
        case 'mimic': {
            P(body, geo.box, M.main, 0, 0.2, 0, 0.72, 0.4, 0.5);
            const lid = new THREE.Group(); lid.position.set(0, 0.4, -0.24); body.add(lid);
            P(lid, geo.box, M.main, 0, 0.06, 0.24, 0.74, 0.14, 0.52);
            for (let k = 0; k < 6; k++) { P(lid, geo.cone, new THREE.MeshStandardMaterial({ color: 0xf0f0e0 }), -0.28 + k * 0.11, -0.02, 0.47, 0.05, 0.1, 0.05, Math.PI); }
            P(body, geo.box, new THREE.MeshStandardMaterial({ color: 0x8a1a2a }), 0, 0.42, 0.05, 0.6, 0.02, 0.4);
            eyes(lid, 0.15, 0.4, 0.2, 0.05);
            ud.lid = lid;
            break;
        }
        case 'nest': {
            P(body, geo.sph, M.main, 0, 0.3, 0, 0.95, 0.6, 0.95);
            for (let k = 0; k < 6; k++) P(body, geo.sph, M.acc, Math.cos(k) * 0.3, 0.5 + r() * 0.15, Math.sin(k) * 0.3, 0.18, 0.18, 0.18);
            P(body, geo.sph, M.glow, 0, 0.55, 0, 0.2, 0.1, 0.2);
            ud.squish = body.children[0];
            break;
        }
        default: P(body, geo.sph, M.main, 0, 0.4, 0, 0.6, 0.6, 0.6);
    }
    g.userData = ud;
    return g;
}

// ------------------------------------------------------------------ Wardens

function buildBossModel(id, s) {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const M = mats(s.c, s.c2, s.g);
    const ud = { body, legs: [], wings: [], M, plan: 'boss', parts: [] };
    switch (id) {
        case 'gnawbone': {
            for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const rat = buildBody('quad', { c: 0x5a4434, c2: 0xc09080, a: 'pack' }, k + 3); rat.scale.setScalar(0.55); rat.position.set(Math.cos(a) * 0.55, 0.15 + (k % 3) * 0.18, Math.sin(a) * 0.55); rat.rotation.y = -a + Math.PI / 2; body.add(rat); ud.parts.push(rat); }
            P(body, geo.sph, M.main, 0, 0.55, 0, 1.0, 0.8, 1.0);
            const crown = P(body, geo.cyl, new THREE.MeshStandardMaterial({ color: 0xd8b040, metalness: 0.8, roughness: 0.3 }), 0, 1.05, 0, 0.5, 0.18, 0.5);
            for (let k = 0; k < 6; k++) P(body, geo.cone, crown.material, Math.cos(k) * 0.24, 1.22, Math.sin(k) * 0.24, 0.08, 0.2, 0.08);
            for (let k = 0; k < 6; k++) P(body, geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4020).multiplyScalar(2) }), Math.cos(k * 1.1) * 0.35, 0.65 + Math.sin(k * 3) * 0.1, 0.38, 0.05, 0.05, 0.05);
            break;
        }
        case 'mycel': {
            P(body, geo.cyl, new THREE.MeshStandardMaterial({ color: 0xe0d8c0 }), 0, 0.7, 0, 0.7, 1.4, 0.7);
            P(body, geo.sph, M.main, 0, 1.5, 0, 2.0, 0.9, 2.0);
            const gl = P(body, geo.sph, M.glow, 0, 1.38, 0, 1.6, 0.12, 1.6); gl.castShadow = false;
            for (let k = 0; k < 8; k++) P(body, geo.sph, M.acc, Math.cos(k * 0.8) * 0.7, 1.75, Math.sin(k * 0.8) * 0.7, 0.2, 0.12, 0.2);
            for (let k = 0; k < 5; k++) { const a = k * 1.25; const ten = new THREE.Group(); ten.position.set(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4); ten.rotation.set(0.8, -a, 0); body.add(ten); P(ten, geo.cyl, M.acc, 0, 0.4, 0, 0.08, 0.8, 0.08); ud.legs.push(ten); }
            P(body, geo.sph, M.glow, -0.2, 1.0, 0.36, 0.1, 0.1, 0.06); P(body, geo.sph, M.glow, 0.2, 1.0, 0.36, 0.1, 0.1, 0.06);
            break;
        }
        case 'archivist': {
            const h = buildHumanoid({ robe: 0x1a2440, skin: 0xb8c0b0, hood: true, glow: 0x6a8aff });
            h.scale.setScalar(1.45); body.add(h);
            Object.assign(ud, { legs: h.userData.legs, arms: h.userData.arms });
            for (let k = 0; k < 5; k++) { const bk = new THREE.Group(); body.add(bk); P(bk, geo.box, new THREE.MeshStandardMaterial({ color: [0x8a2a2a, 0x2a4a7a, 0x4a6a2a, 0x7a5a2a, 0x5a2a5a][k] }), 0, 0, 0, 0.3, 0.08, 0.22); ud.parts.push(bk); }
            ud.orbit = true;
            break;
        }
        case 'brann': {
            const h = buildBody('construct', { c: 0x4a4a52, c2: 0xff7020, g: 0xff6010, a: 'brute' }, 9);
            h.scale.setScalar(1.6); body.add(h);
            Object.assign(ud, { legs: h.userData.legs });
            const hammer = new THREE.Group(); hammer.position.set(0.75, 1.3, 0.2); body.add(hammer);
            P(hammer, geo.cyl, new THREE.MeshStandardMaterial({ color: 0x5a3a20 }), 0, 0, 0, 0.08, 1.4, 0.08);
            P(hammer, geo.box, new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8, roughness: 0.3, emissive: 0x401000 }), 0, 0.7, 0, 0.6, 0.35, 0.35);
            ud.hammer = hammer;
            break;
        }
        case 'wyrm': {
            const glass = new THREE.MeshStandardMaterial({ color: 0xd0c0ff, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.8, emissive: 0x6040a0 });
            const segs = [];
            for (let k = 0; k < 7; k++) segs.push(P(body, geo.oct, glass, 0, 0.5 + Math.sin(k) * 0.1, 0.9 - k * 0.32, 0.6 - k * 0.05, 0.55 - k * 0.04, 0.6));
            const head = new THREE.Group(); head.position.set(0, 0.9, 1.25); body.add(head);
            P(head, geo.oct, glass, 0, 0, 0, 0.7, 0.5, 0.9);
            P(head, geo.cone, glass, -0.2, 0.35, -0.2, 0.1, 0.5, 0.1, -0.5); P(head, geo.cone, glass, 0.2, 0.35, -0.2, 0.1, 0.5, 0.1, -0.5);
            P(head, geo.sph, M.glow, -0.18, 0.08, 0.3, 0.08, 0.08, 0.06); P(head, geo.sph, M.glow, 0.18, 0.08, 0.3, 0.08, 0.08, 0.06);
            for (const sx of [-1, 1]) { const wg = new THREE.Group(); wg.position.set(sx * 0.3, 0.9, 0.5); body.add(wg); const w = P(wg, geo.wing, new THREE.MeshStandardMaterial({ color: 0xe0d0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.55, emissive: 0x5030a0 }), 0, 0, 0, sx * 1.8, 1.4, 1.4, -0.2); ud.wings.push(wg); }
            P(body, geo.ico, M.glow, 0, 0.6, 0.6, 0.3, 0.3, 0.3);
            ud.segs = segs; ud.head = head;
            break;
        }
        case 'vesper': {
            const h = buildBody('skeleton', { c: 0xe8e0c8, c2: 0x6a6050, a: 'caster' }, 4);
            h.scale.setScalar(1.35); body.add(h);
            Object.assign(ud, { legs: h.userData.legs });
            P(body, geo.cone, new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.8, transparent: true, opacity: 0.9 }), 0, 0.6, 0, 1.0, 1.2, 1.0);
            const crown = new THREE.MeshStandardMaterial({ color: 0xd0c8b0, metalness: 0.3 });
            for (let k = 0; k < 7; k++) P(body, geo.cone, crown, Math.cos(k * 0.9) * 0.2, 1.75, Math.sin(k * 0.9) * 0.2 - 0.05, 0.04, 0.25, 0.04);
            for (let k = 0; k < 3; k++) { const c = new THREE.Group(); body.add(c); P(c, geo.sph, M.glow, 0, 0, 0, 0.08, 0.08, 0.08); ud.parts.push(c); }
            ud.orbit = true;
            break;
        }
        case 'orrery': {
            const brass = new THREE.MeshStandardMaterial({ color: 0xc09040, metalness: 0.85, roughness: 0.3 });
            P(body, geo.cyl, brass, 0, 0.3, 0, 1.2, 0.6, 1.2);
            P(body, geo.sph, M.glow, 0, 1.2, 0, 0.7, 0.7, 0.7);
            for (let k = 0; k < 4; k++) {
                const arm = new THREE.Group(); arm.position.y = 1.2; arm.rotation.y = k * Math.PI / 2; body.add(arm);
                P(arm, geo.cyl, brass, 0.8, 0, 0, 0.05, 1.6, 0.05, 0, 0, Math.PI / 2);
                P(arm, geo.sph, new THREE.MeshStandardMaterial({ color: [0x6a8aff, 0xff7a40, 0x8aff8a, 0xffe08a][k], roughness: 0.4 }), 1.6, 0, 0, 0.3, 0.3, 0.3);
                P(arm, geo.tor, brass, 1.6, 0, 0, 0.6, 0.6, 0.6, Math.PI / 2);
                ud.parts.push(arm);
            }
            ud.spinArms = true;
            break;
        }
        case 'isolde': {
            const ice = new THREE.MeshStandardMaterial({ color: 0xc8ecff, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x204060 });
            P(body, geo.cone, ice, 0, 0.75, 0, 1.0, 1.5, 1.0);
            P(body, geo.sph, new THREE.MeshStandardMaterial({ color: 0xe8f4ff }), 0, 1.6, 0, 0.36, 0.4, 0.34);
            for (let k = 0; k < 9; k++) P(body, geo.cone, ice, Math.cos(k * 0.7 - 2.4) * 0.3, 2.0, Math.sin(k * 0.7 - 2.4) * 0.3 - 0.05, 0.06, 0.35 + (k % 2) * 0.15, 0.06);
            P(body, geo.sph, M.glow, -0.1, 1.62, 0.15, 0.05, 0.04, 0.03); P(body, geo.sph, M.glow, 0.1, 1.62, 0.15, 0.05, 0.04, 0.03);
            for (const sx of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(sx * 0.35, 1.3, 0); body.add(arm); P(arm, geo.cap, ice, 0, -0.3, 0.05, 0.1, 0.35, 0.1); ud.legs.push(arm); }
            break;
        }
        case 'watcher': {
            const fl = new THREE.Group(); fl.position.y = 1.3; body.add(fl); ud.float = fl;
            P(fl, geo.sph, new THREE.MeshStandardMaterial({ color: 0x2a1030, roughness: 0.5 }), 0, 0, 0, 1.7, 1.7, 1.7);
            P(fl, geo.sph, new THREE.MeshStandardMaterial({ color: 0xf0e0f0, roughness: 0.25 }), 0, 0, 0.5, 1.2, 1.2, 0.9);
            const iris = P(fl, geo.sph, M.glow, 0, 0, 0.93, 0.55, 0.55, 0.15);
            P(fl, geo.sph, new THREE.MeshBasicMaterial({ color: 0x000000 }), 0, 0, 1.0, 0.22, 0.22, 0.05);
            for (let k = 0; k < 8; k++) { const t = new THREE.Group(); t.rotation.set(-0.4 - (k % 2) * 0.5, k * 0.8, 0); fl.add(t); P(t, geo.cone, M.acc, 0, 1.05, 0, 0.1, 0.8, 0.1); ud.legs.push(t); }
            ud.iris = iris;
            break;
        }
        case 'hush': {
            const shadow = new THREE.MeshStandardMaterial({ color: 0x05040a, roughness: 1, transparent: true, opacity: 0.92, emissive: 0x1a0a30 });
            const h = buildHumanoid({ robe: 0x05040a, skin: 0x0a0812, hood: true, glow: 0xffd8a0 });
            h.scale.setScalar(1.7); body.add(h);
            h.traverse((o) => { if (o.isMesh && !(o.material instanceof THREE.MeshBasicMaterial)) o.material = shadow; });
            Object.assign(ud, { legs: h.userData.legs, arms: h.userData.arms });
            P(body, geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd8a0).multiplyScalar(3) }), -0.08, 1.88, 0.2, 0.05, 0.05, 0.04);
            P(body, geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd8a0).multiplyScalar(3) }), 0.08, 1.88, 0.2, 0.05, 0.05, 0.04);
            for (let k = 0; k < 6; k++) { const c = new THREE.Group(); body.add(c); P(c, geo.sph, shadow, 0, 0, 0, 0.25, 0.4, 0.25); ud.parts.push(c); }
            ud.orbit = true; ud.M.main = shadow;
            break;
        }
    }
    g.userData = ud;
    return g;
}

// ------------------------------------------------------------------ Health bars

function makeBar(elite) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false }));
    bg.scale.set(0.8, 0.09, 1);
    const fill = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: elite ? 0xffc040 : 0xe03a3a, depthTest: false }));
    fill.scale.set(0.76, 0.06, 1);
    fill.position.z = 0.001;
    bg.renderOrder = 20; fill.renderOrder = 21;
    g.add(bg, fill);
    g.userData.fill = fill;
    return g;
}

const AURA = { swift: 0x6ad0ff, vampiric: 0xff2a4a, armored: 0xc0c0c0, burning: 0xff6020, frostbound: 0x9ae0ff, thorned: 0x6aff6a, splitting: 0xd0a0ff, regen: 0x40ff90, volatile: 0xffa020, phasing: 0xb080ff };

// ------------------------------------------------------------------ Sync

export function clearActors() {
    for (const a of actors.values()) scene.remove(a.g);
    actors.clear();
}

function create(m, run) {
    let g;
    if (m.id === 0) g = buildHero(run.p.cls);
    else if (m.boss) g = buildBossModel(m.bossId, bossLook(m.bossId));
    else {
        const s = SPECIES[m.sp];
        if (s.a === 'ally') g = buildHumanoid({ robe: 0x3a5a8a, skin: 0xe0b890, hood: true });
        else g = buildBody(s.b, s, m.seed || m.id);
    }
    const a = { id: m.id, g, x: m.x, y: m.y, from: null, t: 1, face: 0, lunge: 0, lungeDir: [0, 0], flash: 0, dying: 0, bar: null, elite: !!m.elite, aura: null, hop: 0, boss: !!m.boss, walk: 0 };
    const size = m.id === 0 ? 1 : m.boss ? m.size : m.size * 1.35;
    g.scale.setScalar(size);
    g.position.set(m.x, 0, m.y);
    if (m.id !== 0 && !m.boss) {
        a.bar = makeBar(m.elite);
        a.bar.position.y = 1.45 * size / size;
        scene.add(a.bar);
    }
    if (m.elite) {
        const col = AURA[m.aff[0]] || 0xffd040;
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2), transparent: true, opacity: 0.8, depthWrite: false }));
        ring.position.y = 0.03;
        g.add(ring);
        a.aura = ring;
    }
    if (m.id === 0) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.85, 0.4), transparent: true, opacity: 0.35, depthWrite: false }));
        ring.position.y = 0.025; g.add(ring);
    }
    if (m.ally) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x60ff90).multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false }));
        ring.position.y = 0.03; g.add(ring);
    }
    // The hero carries the lantern: their own shadow would fill the screen.
    g.traverse((o) => { if (o.isMesh) o.castShadow = m.id !== 0; });
    scene.add(g);
    actors.set(m.id, a);
    return a;
}

export function bossLook(id) {
    return {
        gnawbone: { c: 0x4a3828, c2: 0xc09080, g: 0xff4020 }, mycel: { c: 0xa04050, c2: 0xf0d0b0, g: 0x6affd0 }, archivist: { c: 0x1a2440, c2: 0xe8d8b0, g: 0x6a8aff },
        brann: { c: 0x4a4a52, c2: 0xff7020, g: 0xff6010 }, wyrm: { c: 0xd0c0ff, c2: 0xffffff, g: 0xe0c0ff }, vesper: { c: 0xe8e0c8, c2: 0x2a2030, g: 0xa0ffb0 },
        orrery: { c: 0xc09040, c2: 0x6a5020, g: 0xffd890 }, isolde: { c: 0xc8ecff, c2: 0xffffff, g: 0x9ae0ff }, watcher: { c: 0x2a1030, c2: 0x6a3a6a, g: 0xff4a8a },
        hush: { c: 0x05040a, c2: 0x1a0a30, g: 0xffd8a0 },
    }[id];
}

/** Keep one view per live actor; returns the hero's view. */
export function syncActors(run, dt, time, camera) {
    const seen = new Set([0]);
    const all = [run.p, ...run.mons];
    const W = run.lv.w;
    for (const m of all) {
        if (m.dead && m.id !== 0) continue;
        seen.add(m.id);
        let a = actors.get(m.id);
        if (!a) a = create(m, run);
        if (a.dying) continue;
        // Target position: tween when the sim position moves.
        if (a.x !== m.x || a.y !== m.y) {
            a.from = { x: a.g.position.x, z: a.g.position.z };
            a.x = m.x; a.y = m.y; a.t = 0;
            a.dist = Math.hypot(a.from.x - m.x, a.from.z - m.y);
            const dx = m.x - a.from.x, dz = m.y - a.from.z;
            if (Math.abs(dx) + Math.abs(dz) > 0.01) a.face = Math.atan2(dx, dz);
        }
        const visible = m.id === 0 || (run._t.vis[m.y * W + m.x] && !(m.dormant && m.disguise === 'burrow')) || m.ally;
        a.g.visible = !!visible;
        if (a.bar) a.bar.visible = !!visible && m.hp < m.hpMax && !m.dormant;
        animate(a, m, dt, time, camera);
    }
    for (const [id, a] of actors) {
        if (seen.has(id)) continue;
        // Dead or gone: play out the death, then remove.
        if (!a.dying) a.dying = 0.0001;
        a.dying += dt;
        const k = Math.min(1, a.dying / 0.55);
        a.g.scale.multiplyScalar(1 - dt * 2.2);
        a.g.position.y -= dt * 0.6;
        a.g.rotation.z += dt * 2 * (id % 2 ? 1 : -1);
        if (a.bar) a.bar.visible = false;
        if (k >= 1) { scene.remove(a.g); if (a.bar) scene.remove(a.bar); actors.delete(id); }
    }
    return actors.get(0);
}

const _q = new THREE.Quaternion();
function animate(a, m, dt, time, camera) {
    const g = a.g, ud = g.userData;
    // Movement tween with a little hop.
    if (a.t < 1) {
        const speed = a.dist > 1.6 ? 7 : 9;
        a.t = Math.min(1, a.t + dt * speed / Math.max(1, a.dist));
        const e = a.t;
        g.position.x = a.from.x + (a.x - a.from.x) * e;
        g.position.z = a.from.z + (a.y - a.from.z) * e;
        g.position.y = Math.sin(e * Math.PI) * (a.dist > 1.6 ? 0.45 : 0.12);
        a.walk += dt * 14;
    } else {
        g.position.x = a.x; g.position.z = a.y; g.position.y = 0;
    }
    // Lunge on attack.
    if (a.lunge > 0) {
        a.lunge = Math.max(0, a.lunge - dt * 5);
        const k = Math.sin((1 - a.lunge) * Math.PI) * 0.35;
        g.position.x += a.lungeDir[0] * k; g.position.z += a.lungeDir[1] * k;
    }
    // Face direction (smooth).
    let d = a.face - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 12);
    const frozen = m.st && m.st.frozen;
    const moving = a.t < 1;
    const ph = time * (frozen ? 0 : 1) + a.id * 1.7;
    // Limbs.
    if (ud.legs) ud.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(a.walk + i * Math.PI) * 0.7 : Math.sin(ph * 2 + i) * 0.06; });
    if (ud.arms) ud.arms.forEach((arm, i) => { arm.rotation.x = moving ? -Math.sin(a.walk + i * Math.PI) * 0.5 : (a.lunge > 0 && i === 1 ? -1.2 : Math.sin(ph * 1.5 + i) * 0.05); });
    if (ud.wings) ud.wings.forEach((w, i) => {
        if (ud.rotors) w.rotation.y = time * 40 * (i ? 1 : -1);
        else if (ud.plan === 'book') w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(ph * 8) * 0.4);
        else w.rotation.z = (i ? 1 : -1) * Math.sin(ph * 10) * 0.6;
    });
    if (ud.float) ud.float.position.y = (ud.float.userData.base ??= ud.float.position.y) + Math.sin(ph * 2.2) * 0.08;
    if (ud.squish) { const s = 1 + Math.sin(ph * 4) * 0.06; ud.squish.scale.y = ud.squish.userData.sy ?? (ud.squish.userData.sy = ud.squish.scale.y); ud.squish.scale.y *= s; }
    if (ud.spin) ud.spin.rotation.y = ph * 1.5;
    if (ud.segs) ud.segs.forEach((sg, i) => { sg.position.x = Math.sin(ph * 3 + i * 0.9) * 0.08 * (moving ? 2 : 1); });
    if (ud.body && !ud.float) ud.body.position.y = Math.abs(Math.sin(ph * 2)) * 0.02;
    if (ud.lid) ud.lid.rotation.x = m.dormant ? 0 : -0.5 - Math.abs(Math.sin(ph * 6)) * 0.4;
    if (ud.orbit) ud.parts.forEach((p, i) => { const t = ph * 0.9 + i * Math.PI * 2 / ud.parts.length; p.position.set(Math.cos(t) * 1.0, 1.0 + Math.sin(ph * 2 + i) * 0.25, Math.sin(t) * 1.0); p.rotation.y = t; });
    if (ud.spinArms) ud.parts.forEach((p, i) => { p.rotation.y = ph * 0.4 + i * Math.PI / 2; });
    if (ud.hammer) ud.hammer.rotation.x = a.lunge > 0 ? -1.4 * Math.sin((1 - a.lunge) * Math.PI) : -0.2;
    if (ud.iris && camera) ud.iris.material.color.setRGB(2.2 + Math.sin(ph * 3) * 0.6, 0.6, 1.2);
    if (ud.flame) { const k = 1 + Math.sin(time * 17) * 0.08 + Math.sin(time * 9.3) * 0.06; ud.flame.scale.set(0.09 * k, 0.12 * k, 0.09 * k); ud.halo.material.opacity = 0.38 + Math.sin(time * 13) * 0.06; }
    if (a.aura) { a.aura.rotation.y = time; a.aura.material.opacity = 0.55 + Math.sin(time * 4) * 0.25; }
    // Hit flash, frozen tint.
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt * 5);
    const M = ud.M;
    if (M) for (const k of ['main', 'acc']) {
        const mm = M[k];
        if (!mm || !mm.emissive) continue;
        if (a.flash > 0) mm.emissive.setRGB(a.flash * 1.4, a.flash * 1.2, a.flash * 1.2);
        else if (frozen) mm.emissive.setRGB(0.15, 0.35, 0.6);
        else if (m.st && m.st.burn) mm.emissive.setRGB(0.35 + Math.sin(time * 20) * 0.1, 0.1, 0);
        else mm.emissive.setRGB(0, 0, 0);
    }
    // Health bar (billboard).
    if (a.bar && a.bar.visible) {
        a.bar.position.set(g.position.x, 0.6 + 1.25 * g.scale.y, g.position.z);
        a.bar.quaternion.copy(camera.quaternion);
        const f = Math.max(0, m.hp / m.hpMax);
        a.bar.userData.fill.scale.x = 0.76 * f;
        a.bar.userData.fill.position.x = -0.38 * (1 - f);
    }
}

/** React to a sim event (lunge, flash). */
export function actorEvent(e) {
    if (e.t === 'atk') {
        const a = actorViews.get(e.id);
        if (!a) return;
        const dx = e.tx - a.x, dz = e.ty - a.y;
        const l = Math.hypot(dx, dz) || 1;
        a.face = Math.atan2(dx, dz);
        if (!e.ranged || l < 1.5) { a.lunge = 1; a.lungeDir = [dx / l, dz / l]; }
        else { a.lunge = 0.5; a.lungeDir = [dx / l * 0.3, dz / l * 0.3]; }
    } else if (e.t === 'dmg') {
        const a = actorViews.get(e.id);
        if (a) a.flash = 1;
    } else if (e.t === 'tele') {
        const a = actorViews.get(e.id);
        if (a && !e.leap) { a.g.position.set(e.x, 0, e.y); a.x = e.x; a.y = e.y; a.t = 1; }
    } else if (e.t === 'shot') {
        const a = actorViews.get(e.id);
        if (a) { const dx = e.x - e.fx, dz = e.y - e.fy; a.face = Math.atan2(dx, dz); a.lunge = 0.6; a.lungeDir = [Math.sign(dx) * 0.2, Math.sign(dz) * 0.2]; }
    }
}

export function actorPos(id) {
    const a = actorViews.get(id);
    return a ? a.g.position : null;
}
