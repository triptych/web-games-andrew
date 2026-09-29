/**
 * actors.js — the hero, every enemy and every boss, modelled from primitives
 * at runtime and animated from simulation state.
 *
 * Each model is built facing +z and turned with faceTo(). Enemies are tinted
 * toward the chapter's hue, so the same slime is moss-green in the Glade and
 * frost-blue on Frostpeak. Each actor owns its materials so it can flash
 * white when hit, glow red while winding up an attack, turn icy when frozen,
 * orange when burning and green when poisoned.
 *
 *   initActors()            once
 *   resetActors()           on room change
 *   syncActors(w, dt, time) every frame
 */

import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { glowTexture, ringTexture } from './textures.js';
import { getBiome } from './biomes.js';
import { orbitPositions, spiritPositions } from '../sim/combat.js';

const TAU = Math.PI * 2;
let group;
let hero;
const actors = new Map();         // enemy id → actor
const dying = [];
let shadowTex, shadowMat, reticle, heroRing, aegisBubble, starGlow;
let orbMeshes = [], spiritMeshes = [];
let biome = null;

// ------------------------------------------------------------------ helpers

function shadowTexture() {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(c);
}

function tint(hex, amount) {
    if (!amount) return hex;
    const c = new THREE.Color(hex);
    const hsl = {};
    c.getHSL(hsl);
    c.setHSL((hsl.h + amount) % 1, hsl.s, hsl.l);
    return c.getHex();
}

/** Material factory bound to one actor, so flashes don't leak between actors. */
function kit(hue) {
    const mats = [];
    const M = (color, o = {}) => {
        const { keep, ...rest } = o;
        const m = new THREE.MeshStandardMaterial({ color: keep ? color : tint(color, hue), roughness: 0.6, ...rest });
        m.userData.baseEmissive = m.emissive.clone();
        m.userData.baseEI = m.emissiveIntensity;
        mats.push(m);
        return m;
    };
    return { M, mats };
}

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
}

const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const eyeBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
const eyeRed = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 });
const G = {
    s: (r, w = 14, h = 10, ...more) => new THREE.SphereGeometry(r, w, h, ...more),
    c: (rt, rb, h, n = 10, ...more) => new THREE.CylinderGeometry(rt, rb, h, n, ...more),
    b: (x, y, z) => new THREE.BoxGeometry(x, y, z),
    cone: (r, h, n = 8, ...more) => new THREE.ConeGeometry(r, h, n, ...more),
};

function eyes(parent, y, z, spread, size, red = false) {
    for (const s of [-1, 1]) {
        if (red) { mesh(G.s(size, 8, 6), eyeRed, parent, s * spread, y, z); continue; }
        mesh(G.s(size, 10, 8), eyeWhite, parent, s * spread, y, z);
        mesh(G.s(size * 0.5, 8, 6), eyeBlack, parent, s * spread, y, z + size * 0.7);
    }
}

// ------------------------------------------------------------------ Hero

function buildHero() {
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const { M, mats } = kit(0);
    const tunic = M(0x2f9a5a), hood = M(0x1f6a3e), skin = M(0xffd6b0), leather = M(0x7a4a2a), cape = M(0xc8323a, { side: THREE.DoubleSide });
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(s * 0.12, 0.34, 0);
        mesh(G.c(0.07, 0.06, 0.34, 6), leather, leg, 0, -0.17, 0);
        rig.add(leg);
        legs.push(leg);
    }
    mesh(G.c(0.2, 0.25, 0.46, 12), tunic, rig, 0, 0.56, 0);
    const belt = mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 16), leather, rig, 0, 0.44, 0);
    belt.rotation.x = Math.PI / 2;
    const head = new THREE.Group();
    head.position.y = 0.95;
    rig.add(head);
    mesh(G.s(0.2), skin, head, 0, 0, 0);
    const h = mesh(G.s(0.23, 14, 10, 0, TAU, 0, Math.PI * 0.6), hood, head, 0, 0.03, -0.02);
    h.scale.set(1, 1.05, 1.05);
    const tip = mesh(G.cone(0.12, 0.3, 8), hood, head, 0, 0.12, -0.2);
    tip.rotation.x = -1.1;
    eyes(head, 0.02, 0.17, 0.07, 0.035);
    // Cape.
    const capeM = mesh(new THREE.PlaneGeometry(0.42, 0.55, 1, 3), cape, rig, 0, 0.6, -0.24);
    capeM.rotation.x = 0.15;
    // Quiver.
    const quiver = mesh(G.c(0.07, 0.06, 0.4, 8), leather, rig, 0.1, 0.72, -0.2);
    quiver.rotation.z = 0.4;
    // Bow in the left hand.
    const bow = new THREE.Group();
    bow.position.set(-0.26, 0.62, 0.22);
    const arc = mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 18, Math.PI), M(0x8a5a2a), bow, 0, 0, 0);
    arc.rotation.set(0, Math.PI / 2, Math.PI / 2);
    const str = new THREE.Mesh(G.c(0.006, 0.006, 0.68, 3), new THREE.MeshBasicMaterial({ color: 0xf0f0e0 }));
    str.position.set(0, 0, -0.0);
    bow.add(str);
    bow.userData.string = str;
    rig.add(bow);
    root.userData = { rig, legs, bow, cape: capeM, mats, head };
    return root;
}

// ------------------------------------------------------------------ Enemies

const BUILD = {
    slime(k, e) {
        const g = new THREE.Group();
        const small = e.type === 'slimelet';
        const body = mesh(G.s(0.45, 18, 12), k.M(0x5ad65a, { transparent: true, opacity: 0.88, roughness: 0.25 }), g, 0, 0.36, 0);
        body.scale.set(1, 0.8, 1);
        mesh(G.s(0.18, 10, 8), k.M(0xbaffba, { transparent: true, opacity: 0.6 }), body, -0.15, 0.22, 0.12);
        eyes(body, 0.08, 0.36, 0.13, 0.08);
        g.userData.body = body;
        g.scale.setScalar(small ? 0.62 : 0.95);
        return g;
    },
    bat(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 1.0;
        g.add(body);
        mesh(G.s(0.22), k.M(0x5a3a7a), body);
        for (const s of [-1, 1]) {
            const ear = mesh(G.cone(0.07, 0.18, 5), k.M(0x5a3a7a), body, s * 0.1, 0.2, 0);
            ear.rotation.z = -s * 0.3;
        }
        eyes(body, 0.04, 0.18, 0.08, 0.04, true);
        const wings = [];
        for (const s of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.x = s * 0.15;
            const shape = new THREE.Shape();
            shape.moveTo(0, 0.1); shape.lineTo(s * 0.55, 0.2); shape.lineTo(s * 0.45, -0.05); shape.lineTo(s * 0.3, 0.02); shape.lineTo(s * 0.18, -0.1); shape.lineTo(0, -0.05);
            const wing = mesh(new THREE.ShapeGeometry(shape), k.M(0x3a2250, { side: THREE.DoubleSide }), pivot);
            wing.rotation.x = -Math.PI / 2;
            body.add(pivot);
            wings.push(pivot);
        }
        g.userData = { body, wings, bob: true };
        return g;
    },
    archer(k) {
        const g = new THREE.Group();
        const bone = k.M(0xe8e0cc, { keep: true });
        mesh(G.c(0.05, 0.05, 0.4, 5), bone, g, -0.1, 0.2, 0);
        mesh(G.c(0.05, 0.05, 0.4, 5), bone, g, 0.1, 0.2, 0);
        const torso = mesh(G.c(0.17, 0.12, 0.42, 7), k.M(0x6a4a8a), g, 0, 0.6, 0);
        const skull = mesh(G.s(0.19, 12, 10), bone, g, 0, 0.95, 0);
        for (const s of [-1, 1]) mesh(G.s(0.05, 6, 5), eyeRed, skull, s * 0.07, 0.02, 0.15);
        const hoodM = mesh(G.cone(0.24, 0.35, 8), k.M(0x4a2a6a), g, 0, 1.12, -0.03);
        hoodM.rotation.x = -0.2;
        const bow = mesh(new THREE.TorusGeometry(0.3, 0.025, 5, 14, Math.PI), k.M(0x5a3a1a, { keep: true }), g, -0.22, 0.65, 0.2);
        bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
        g.userData = { torso };
        return g;
    },
    plant(k) {
        const g = new THREE.Group();
        mesh(G.c(0.08, 0.12, 0.5, 6), k.M(0x3a8a3a), g, 0, 0.25, 0);
        const head = new THREE.Group();
        head.position.y = 0.62;
        g.add(head);
        mesh(G.s(0.28, 12, 10), k.M(0xd04a7a), head);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const petal = mesh(G.s(0.2, 8, 6), k.M(0xff8ac0), head, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
            petal.scale.set(1, 0.35, 0.6);
            petal.rotation.y = -a;
        }
        const mouth = mesh(G.c(0.12, 0.08, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x300818 }), head, 0, 0, 0.24);
        mouth.rotation.x = Math.PI / 2;
        for (let i = 0; i < 3; i++) {
            const leaf = mesh(G.s(0.22, 8, 6), k.M(0x4aa04a), g, Math.cos(i * 2.1) * 0.25, 0.08, Math.sin(i * 2.1) * 0.25);
            leaf.scale.set(1, 0.2, 0.5); leaf.rotation.y = -i * 2.1;
        }
        g.userData = { head, noTurn: false };
        return g;
    },
    mage(k) {
        const g = new THREE.Group();
        mesh(G.cone(0.34, 0.9, 10), k.M(0x3a4ac8), g, 0, 0.45, 0);
        mesh(G.s(0.2), k.M(0x2a3a98), g, 0, 0.98, 0);
        mesh(G.s(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: 0x000000 }), g, 0, 0.96, 0.12);
        for (const s of [-1, 1]) mesh(G.s(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffe040, emissive: 0xffe040, emissiveIntensity: 2 }), g, s * 0.05, 0.98, 0.2);
        const hat = mesh(G.cone(0.2, 0.45, 8), k.M(0x2a3a98), g, 0, 1.25, -0.05);
        hat.rotation.x = -0.25;
        mesh(G.c(0.025, 0.025, 1.1, 5), k.M(0x6a4a2a, { keep: true }), g, 0.3, 0.6, 0.1);
        const orb = mesh(G.s(0.1), new THREE.MeshStandardMaterial({ color: 0xc080ff, emissive: 0xa040ff, emissiveIntensity: 2 }), g, 0.3, 1.2, 0.1);
        g.userData = { orb };
        return g;
    },
    spider(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 0.3;
        g.add(body);
        const dark = k.M(0x3a2a2a);
        mesh(G.s(0.3), dark, body, 0, 0.05, -0.18).scale.set(1, 0.8, 1.1);
        mesh(G.s(0.18), dark, body, 0, 0, 0.18);
        eyes(body, 0.05, 0.33, 0.06, 0.035, true);
        const stripe = mesh(G.s(0.12, 8, 6), k.M(0xff6030), body, 0, 0.25, -0.2);
        stripe.scale.set(1, 0.3, 1);
        const legs = [];
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
            const pivot = new THREE.Group();
            pivot.position.set(s * 0.12, 0, 0.12 - i * 0.13);
            const leg = mesh(G.c(0.025, 0.02, 0.5, 4), dark, pivot, s * 0.22, -0.05, 0);
            leg.rotation.z = s * 1.1;
            body.add(pivot);
            legs.push(pivot);
        }
        g.userData = { body, legs };
        return g;
    },
    boar(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 0.45;
        g.add(body);
        const fur = k.M(0x8a5a3a);
        mesh(G.s(0.42), fur, body, 0, 0, -0.08).scale.set(0.95, 0.8, 1.25);
        const head = mesh(G.s(0.26), fur, body, 0, -0.02, 0.42);
        mesh(G.c(0.1, 0.12, 0.12, 8), k.M(0xd8a080), head, 0, -0.05, 0.22).rotation.x = Math.PI / 2;
        for (const s of [-1, 1]) {
            const tusk = mesh(G.cone(0.04, 0.22, 5), k.M(0xfff8e0, { keep: true }), head, s * 0.13, -0.05, 0.2);
            tusk.rotation.x = -1.0;
        }
        eyes(head, 0.08, 0.2, 0.09, 0.035, true);
        mesh(G.b(0.06, 0.2, 0.5), k.M(0x4a2a1a), body, 0, 0.3, -0.1);
        const legs = [];
        for (const [x, z] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.35], [0.2, -0.35]]) {
            const l = mesh(G.c(0.07, 0.06, 0.3, 6), fur, g, x, 0.15, z);
            legs.push(l);
        }
        g.userData = { body, legs };
        return g;
    },
    bomber(k) {
        const g = new THREE.Group();
        const skin = k.M(0x6ab84a);
        mesh(G.c(0.2, 0.26, 0.5, 8), k.M(0x7a5a3a), g, 0, 0.35, 0);
        const head = mesh(G.s(0.22), skin, g, 0, 0.78, 0);
        for (const s of [-1, 1]) {
            const ear = mesh(G.cone(0.06, 0.28, 5), skin, head, s * 0.22, 0.05, 0);
            ear.rotation.z = -s * 1.2;
        }
        eyes(head, 0.05, 0.18, 0.08, 0.05);
        const bomb = mesh(G.s(0.16), new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.3 }), g, 0.25, 0.9, 0.12);
        const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb030, blending: THREE.AdditiveBlending, depthWrite: false }));
        spark.scale.setScalar(0.3);
        spark.position.set(0, 0.2, 0);
        bomb.add(spark);
        g.userData = { bomb, spark };
        return g;
    },
    ghost(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 0.9;
        g.add(body);
        const mat = k.M(0xc8d8ff, { transparent: true, opacity: 0.6, emissive: 0x6080ff, emissiveIntensity: 0.4, depthWrite: false });
        mesh(G.s(0.34, 14, 10, 0, TAU, 0, Math.PI * 0.55), mat, body, 0, 0.05, 0);
        const skirt = mesh(G.cone(0.34, 0.6, 12, 1, true), mat, body, 0, -0.25, 0);
        skirt.rotation.x = Math.PI;
        for (const s of [-1, 1]) mesh(G.s(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40ffff }), body, s * 0.11, 0.12, 0.28);
        g.userData = { body, bob: true, mat };
        return g;
    },
    golem(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        g.add(body);
        const stone = k.M(0x8a8478, { flatShading: true, roughness: 0.9 });
        const rune = k.M(0x40c8ff, { emissive: 0x40c8ff, emissiveIntensity: 1.5 });
        mesh(G.b(0.75, 0.7, 0.55), stone, body, 0, 0.85, 0).rotation.y = 0.05;
        mesh(G.b(0.4, 0.35, 0.4), stone, body, 0, 1.38, 0.02);
        mesh(G.b(0.25, 0.06, 0.02), rune, body, 0, 1.4, 0.23);
        mesh(G.b(0.12, 0.3, 0.02), rune, body, 0, 0.88, 0.285);
        const arms = [];
        for (const s of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(s * 0.52, 1.05, 0);
            mesh(G.b(0.28, 0.7, 0.3), stone, arm, 0, -0.3, 0);
            body.add(arm);
            arms.push(arm);
        }
        for (const s of [-1, 1]) mesh(G.b(0.28, 0.5, 0.3), stone, g, s * 0.2, 0.25, 0);
        g.userData = { body, arms };
        return g;
    },
    worm(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        g.add(body);
        const flesh = k.M(0xc86a5a);
        const segs = [];
        for (let i = 0; i < 4; i++) {
            const s = mesh(G.s(0.3 - i * 0.03, 12, 8), flesh, body, 0, 0.25 + i * 0.3, 0);
            segs.push(s);
        }
        const head = segs[3];
        mesh(G.c(0.14, 0.18, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x300808 }), head, 0, 0.18, 0.06).rotation.x = 0.4;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const t = mesh(G.cone(0.03, 0.1, 4), k.M(0xfff0e0, { keep: true }), head, Math.cos(a) * 0.14, 0.22, Math.sin(a) * 0.14 + 0.05);
            t.rotation.x = Math.PI;
        }
        const mound = mesh(G.s(0.5, 12, 6, 0, TAU, 0, Math.PI / 2), k.M(0x6a4a2a, { keep: true, flatShading: true }), g, 0, 0, 0);
        mound.scale.y = 0.35;
        g.userData = { body, segs, mound };
        return g;
    },
    eye(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 1.05;
        g.add(body);
        mesh(G.s(0.4, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff4ee, roughness: 0.25 }), body);
        const iris = mesh(G.s(0.2, 14, 10), k.M(0xa040ff, { emissive: 0x6020c0, emissiveIntensity: 0.8 }), body, 0, 0, 0.26);
        iris.scale.z = 0.5;
        mesh(G.s(0.09, 10, 8), eyeBlack, iris, 0, 0, 0.14);
        const lid = mesh(G.s(0.43, 16, 10, 0, TAU, 0, Math.PI * 0.35), k.M(0x7a2a5a), body, 0, 0, 0);
        lid.rotation.x = -0.6;
        const tent = [];
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            const t = mesh(G.c(0.04, 0.01, 0.6, 4), k.M(0x7a2a5a), body, Math.cos(a) * 0.2, -0.45, Math.sin(a) * 0.2);
            tent.push(t);
        }
        g.userData = { body, tent, bob: true };
        return g;
    },
};
BUILD.slimelet = BUILD.slime;

// ------------------------------------------------------------------ Bosses

const BOSS_BUILD = {
    slimeKing(k) {
        const g = BUILD.slime(k, { type: 'slime' });
        g.scale.setScalar(2.6);
        const crown = new THREE.Group();
        crown.position.set(0, 0.72, 0);
        const gold = k.M(0xffcc30, { keep: true, metalness: 0.9, roughness: 0.25, emissive: 0x805000, emissiveIntensity: 0.3 });
        mesh(G.c(0.2, 0.22, 0.1, 12, 1, true), gold, crown);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            mesh(G.cone(0.045, 0.14, 4), gold, crown, Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2);
        }
        mesh(G.s(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2050, emissive: 0xff2050, emissiveIntensity: 1 }), crown, 0, 0.02, 0.21);
        g.add(crown);
        g.userData.crown = crown;
        return g;
    },
    boneArcher(k) {
        const g = BUILD.archer(k);
        g.scale.setScalar(1.9);
        const cape = mesh(new THREE.PlaneGeometry(0.5, 0.7), k.M(0x8a1a2a, { side: THREE.DoubleSide, keep: true }), g, 0, 0.62, -0.18);
        cape.rotation.x = 0.1;
        g.userData.cape = cape;
        return g;
    },
    cinderGolem(k) {
        const g = BUILD.golem(k);
        g.traverse((m) => {
            if (m.material && m.material.emissiveIntensity > 1) { m.material.color.set(0xff6a1a); m.material.emissive.set(0xff5a0a); m.material.emissiveIntensity = 2.2; m.material.userData.baseEmissive = m.material.emissive.clone(); m.material.userData.baseEI = 2.2; }
            else if (m.material) { m.material.color.set(0x3a302c); }
        });
        g.scale.setScalar(1.75);
        return g;
    },
    tideSerpent(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        g.add(body);
        const scale = k.M(0x2a8aa8, { roughness: 0.35, metalness: 0.2 });
        const belly = k.M(0xe8d8a0);
        const segs = [];
        for (let i = 0; i < 6; i++) {
            const s = mesh(G.s(0.5 - i * 0.03, 14, 10), scale, body, 0, 0.3 + i * 0.36, -0.3 + Math.sin(i * 0.8) * 0.15);
            segs.push(s);
        }
        const head = new THREE.Group();
        head.position.set(0, 2.5, 0.2);
        body.add(head);
        mesh(G.s(0.5, 16, 12), scale, head).scale.set(1, 0.8, 1.3);
        mesh(G.s(0.35, 12, 8), belly, head, 0, -0.18, 0.35).scale.set(1, 0.5, 1);
        eyes(head, 0.2, 0.4, 0.25, 0.1, true);
        for (const s of [-1, 1]) {
            const fin = mesh(G.cone(0.2, 0.7, 4), k.M(0x7af0ff, { emissive: 0x20a0c0, emissiveIntensity: 0.6 }), head, s * 0.45, 0.25, -0.2);
            fin.rotation.z = -s * 1.1;
        }
        const crest = mesh(G.cone(0.12, 0.6, 4), k.M(0x7af0ff), head, 0, 0.5, -0.1);
        crest.rotation.x = -0.6;
        g.userData = { body, segs, head };
        return g;
    },
    voidLich(k) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 0.4;
        g.add(body);
        const robe = k.M(0x2a1040, { keep: true });
        mesh(G.cone(0.55, 1.5, 12), robe, body, 0, 0.75, 0);
        const skull = mesh(G.s(0.26), new THREE.MeshStandardMaterial({ color: 0xe8e0d0 }), body, 0, 1.6, 0);
        for (const s of [-1, 1]) mesh(G.s(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd070ff }), skull, s * 0.09, 0.02, 0.2);
        const hood = mesh(G.s(0.34, 12, 10, 0, TAU, 0, Math.PI * 0.6), robe, body, 0, 1.63, -0.05);
        hood.scale.set(1, 1.1, 1.1);
        const crown = mesh(G.c(0.18, 0.2, 0.12, 8, 1, true), k.M(0xb05aff, { keep: true, emissive: 0xb05aff, emissiveIntensity: 1.5 }), body, 0, 1.88, 0);
        mesh(G.c(0.03, 0.03, 1.8, 6), k.M(0x1a1a1a, { keep: true }), body, 0.5, 0.9, 0.1);
        const orb = mesh(G.s(0.16), new THREE.MeshStandardMaterial({ color: 0xd08aff, emissive: 0xb05aff, emissiveIntensity: 3 }), body, 0.5, 1.9, 0.1);
        const runes = new THREE.Group();
        runes.position.y = 1.0;
        for (let i = 0; i < 4; i++) {
            const r = mesh(G.b(0.12, 0.2, 0.02), k.M(0xb05aff, { keep: true, emissive: 0xb05aff, emissiveIntensity: 2 }), runes, Math.cos(i * TAU / 4) * 0.9, 0, Math.sin(i * TAU / 4) * 0.9);
            r.rotation.y = -i * TAU / 4;
        }
        body.add(runes);
        g.userData = { body, orb, runes, crown, bob: true };
        g.scale.setScalar(1.3);
        return g;
    },
};

// ------------------------------------------------------------------ Life cycle

export function initActors() {
    group = new THREE.Group();
    scene.add(group);
    shadowTex = shadowTexture();
    shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    hero = buildHero();
    hero.userData.rig.scale.setScalar(1.22);
    hero.userData.shadow = blob(0.5);
    group.add(hero);

    reticle = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 32, 1), new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.8, depthWrite: false }));
    reticle.rotation.x = -Math.PI / 2;
    group.add(reticle);
    heroRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0x60ffb0, transparent: true, opacity: 0.55, depthWrite: false }));
    heroRing.rotation.x = -Math.PI / 2;
    heroRing.position.y = 0.02;
    hero.add(heroRing);
    aegisBubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshBasicMaterial({ color: 0x60c0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    aegisBubble.position.y = 0.6;
    hero.add(aegisBubble);
    starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe060, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    starGlow.scale.setScalar(2.6);
    starGlow.position.y = 0.6;
    hero.add(starGlow);
}

function blob(r) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.015;
    m.renderOrder = -1;
    group.add(m);
    return m;
}

export function setActorBiome(biomeId) { biome = getBiome(biomeId); }

export function resetActors() {
    for (const a of actors.values()) removeActor(a);
    actors.clear();
    for (const d of dying) removeActor(d);
    dying.length = 0;
}

function removeActor(a) {
    group.remove(a.obj);
    group.remove(a.shadow);
    if (a.bar) group.remove(a.bar);
    a.obj.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    for (const m of a.mats) m.dispose();
}

function makeActor(e) {
    const k = kit(biome ? biome.tint : 0);
    const obj = e.boss ? BOSS_BUILD[e.bossId](k, e) : BUILD[e.type](k, e);
    if (e.elite) {
        obj.scale.multiplyScalar(1.45);
        const aura = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0xffc030, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.03;
        obj.add(aura);
        obj.userData.aura = aura;
    }
    group.add(obj);
    const a = {
        id: e.id, obj, mats: k.mats, shadow: blob(e.r * 1.25), spawn: 0, dead: 0, lastFlash: -1,
        bar: null, barFill: null, boss: !!e.boss, baseScale: obj.scale.x, walk: 0,
    };
    if (!e.boss) {
        const bar = new THREE.Group();
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.09), new THREE.MeshBasicMaterial({ color: 0x1a0a0a, transparent: true, opacity: 0.75, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.06), new THREE.MeshBasicMaterial({ color: e.elite ? 0xffc030 : 0xff3a3a, depthWrite: false }));
        fill.position.z = 0.001;
        bar.add(bg, fill);
        bar.renderOrder = 5;
        bar.scale.setScalar(e.elite ? 1.5 : 1);
        group.add(bar);
        a.bar = bar; a.barFill = fill;
    }
    return a;
}

const faceTo = (obj, ang) => { obj.rotation.y = Math.atan2(Math.cos(ang), -Math.sin(ang)); };

function lerpAngle(cur, target, k) {
    let d = target - cur;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return cur + d * k;
}

// ------------------------------------------------------------------ Per-frame

const WIND_STATES = new Set(['wind', 'aim', 'cast', 'throw', 'rise', 'charge', 'stomp']);
const _c = new THREE.Color();

export function syncActors(w, dt, time) {
    syncHero(w, dt, time);
    const seen = new Set();
    let target = null;
    for (const e of w.enemies) {
        seen.add(e.id);
        let a = actors.get(e.id);
        if (!a) { a = makeActor(e); actors.set(e.id, a); }
        animateEnemy(a, e, dt, time, w);
        if (e.id === w.player.target) target = e;
    }
    for (const [id, a] of actors) {
        if (!seen.has(id)) { actors.delete(id); a.dead = 0.0001; dying.push(a); if (a.bar) a.bar.visible = false; }
    }
    for (let i = dying.length - 1; i >= 0; i--) {
        const a = dying[i];
        a.dead += dt;
        const k = Math.max(0, 1 - a.dead / 0.22);
        a.obj.scale.setScalar(a.baseScale * (1 + (1 - k) * 0.4) * k);
        for (const m of a.mats) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 1.5; }
        a.shadow.scale.setScalar(k);
        if (a.dead > 0.22) { removeActor(a); dying.splice(i, 1); }
    }
    // Target reticle.
    reticle.visible = !!target && w.phase === 'fight';
    if (target) {
        reticle.position.set(target.x, 0.03, -target.y);
        reticle.scale.setScalar(target.r / 0.45 + Math.sin(time * 8) * 0.05);
        reticle.rotation.z = time * 2;
    }
    syncOrbits(w, time);
}

function animateEnemy(a, e, dt, time, w) {
    const o = a.obj, u = o.userData;
    a.spawn = Math.min(1, a.spawn + dt * 2.5);
    const pop = a.spawn < 1 ? easeOutBack(a.spawn) : 1;
    o.position.set(e.x, (e.z || 0), -e.y);
    o.scale.setScalar(a.baseScale * pop);
    o.rotation.y = lerpAngle(o.rotation.y, Math.atan2(Math.cos(e.face), -Math.sin(e.face)), Math.min(1, dt * 10));

    const moving = Math.hypot(e.x - (a.px ?? e.x), e.y - (a.py ?? e.y)) > 0.002;
    a.px = e.x; a.py = e.y;
    if (moving) a.walk += dt * 10;
    const wind = (!e.boss && WIND_STATES.has(e.state)) || (e.boss && e.state !== 'idle' && e.state !== 'stun' && e.t < 0.45);

    // Type-specific animation.
    if (u.body && (e.type === 'slime' || e.type === 'slimelet' || e.bossId === 'slimeKing')) {
        const squash = e.state === 'hop' ? 1 + (e.z || 0) * 0.35 : 1 - Math.sin(time * 5 + e.id) * 0.06 - (e.state === 'rest' ? 0 : 0);
        u.body.scale.set(1 / Math.sqrt(squash), 0.8 * squash, 1 / Math.sqrt(squash));
    }
    if (u.wings) for (let i = 0; i < 2; i++) u.wings[i].rotation.z = (i ? -1 : 1) * Math.sin(time * (e.state === 'dive' ? 30 : 18) + e.id) * 0.8;
    if (u.bob && u.body) u.body.position.y = (e.type === 'eye' ? 1.05 : e.type === 'ghost' ? 0.9 : e.bossId === 'voidLich' ? 0.4 : 1.0) + Math.sin(time * 3 + e.id) * 0.1;
    if (u.legs && e.type === 'spider') u.legs.forEach((l, i) => { l.rotation.x = Math.sin(a.walk + i * 1.3) * 0.35; });
    if (u.legs && (e.type === 'boar')) u.legs.forEach((l, i) => { l.rotation.x = Math.sin(a.walk * (e.state === 'charge' ? 2 : 1) + (i % 2) * Math.PI) * 0.6; });
    if (u.arms) u.arms.forEach((arm, i) => { arm.rotation.x = e.state === 'wind' || e.state === 'stomp' ? -2.4 : Math.sin(a.walk + i * Math.PI) * 0.4; });
    if (u.head && e.type === 'plant') { const s = e.state === 'wind' ? 1.2 + Math.sin(time * 30) * 0.05 : 1; u.head.scale.setScalar(s); }
    if (u.orb) u.orb.position.y = (e.bossId === 'voidLich' ? 1.9 : 1.2) + Math.sin(time * 4) * 0.05;
    if (u.runes) u.runes.rotation.y = time * 1.5;
    if (u.spark) u.spark.scale.setScalar(0.25 + Math.random() * 0.15);
    if (u.mat && e.type === 'ghost') u.mat.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(time * 2 + e.id));
    if (u.crown) u.crown.rotation.y = time * 0.8;
    if (u.aura) { u.aura.rotation.z = time; u.aura.material.opacity = 0.5 + Math.sin(time * 4) * 0.2; }
    if (u.segs && e.type === 'worm') {
        const under = e.burrowed;
        const rise = e.state === 'rise' ? 0.25 : e.state === 'dive' ? 0.3 : under ? 0 : 1;
        a.rise = (a.rise ?? 0) + (rise - (a.rise ?? 0)) * Math.min(1, dt * 8);
        u.body.position.y = -1.3 * (1 - a.rise);
        u.body.visible = a.rise > 0.05;
        u.segs.forEach((s, i) => { s.position.x = Math.sin(time * 3 + i) * 0.06 * a.rise; });
        u.mound.scale.set(1, 0.35 + (under ? Math.sin(time * 12) * 0.05 : 0), 1);
    }
    if (u.segs && e.bossId === 'tideSerpent') {
        u.segs.forEach((s, i) => { s.position.x = Math.sin(time * 2 + i * 0.7) * 0.18; });
        const hidden = e.hidden ? 1 : 0;
        a.sub = (a.sub ?? 0) + (hidden - (a.sub ?? 0)) * Math.min(1, dt * 6);
        u.body.position.y = -3 * a.sub;
    }
    if (e.bossId === 'voidLich' || e.bossId === 'boneArcher') {
        const hidden = e.hidden ? 1 : 0;
        a.sub = (a.sub ?? 0) + (hidden - (a.sub ?? 0)) * Math.min(1, dt * 10);
        o.scale.set(a.baseScale * pop * (1 - a.sub * 0.9), a.baseScale * pop * (1 + a.sub * 1.5), a.baseScale * pop * (1 - a.sub * 0.9));
    }
    if (u.tent) u.tent.forEach((t, i) => { t.rotation.x = Math.sin(time * 3 + i) * 0.3; });
    if (u.cape) u.cape.rotation.x = 0.1 + Math.sin(time * 3) * 0.08;
    if (moving && !u.bob && e.type !== 'slime' && e.type !== 'slimelet' && !e.boss) o.position.y += Math.abs(Math.sin(a.walk)) * 0.06;
    // Charge-up throb.
    if (wind) o.scale.multiplyScalar(1 + Math.sin(time * 25) * 0.03);

    // Material state: hit flash > frozen > wind-up > burning > poisoned.
    const sinceHit = w.time - e.flash;
    let r = 0, g = 0, b = 0, ei = 0;
    if (sinceHit >= 0 && sinceHit < 0.1) { r = g = b = 1; ei = 1.4; }
    else if (e.frozenT > 0) { r = 0.3; g = 0.7; b = 1; ei = 0.9; }
    else if (wind) { r = 1; g = 0.1; b = 0.05; ei = 0.35 + 0.35 * Math.sin(time * 20); }
    else if (e.burnT > 0) { r = 1; g = 0.4; b = 0; ei = 0.35 + 0.2 * Math.sin(time * 15); }
    else if (e.poisonDps) { r = 0.3; g = 1; b = 0.2; ei = 0.15 + 0.12 * Math.sin(time * 4); }
    else if (e.slowT > 0) { r = 0.3; g = 0.6; b = 1; ei = 0.25; }
    for (const m of a.mats) {
        if (ei > 0) { m.emissive.setRGB(r, g, b); m.emissiveIntensity = ei; }
        else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; }
    }

    // Shadow & HP bar.
    const lift = (e.z || 0) + (e.fly ? 0.8 : 0);
    a.shadow.position.set(e.x, 0.015, -e.y);
    a.shadow.scale.setScalar(Math.max(0.3, 1 - lift * 0.18) * pop * (e.burrowed ? 0.3 : 1));
    a.shadow.visible = !(e.bossId === 'tideSerpent' && e.hidden);
    if (a.bar) {
        const frac = Math.max(0, e.hp / e.maxHp);
        a.bar.visible = !e.burrowed && pop > 0.9;
        const h = (e.elite ? 2.1 : 1.35) * (e.type === 'golem' ? 1.25 : 1) + (e.fly ? 0.5 : 0) + (e.z || 0);
        a.bar.position.set(e.x, h, -e.y);
        a.bar.quaternion.copy(camera.quaternion);
        a.barFill.scale.x = Math.max(0.001, frac);
        a.barFill.position.x = -0.38 * (1 - frac);
    }
}

function easeOutBack(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

function syncHero(w, dt, time) {
    const p = w.player, u = hero.userData;
    hero.visible = !p.dead || w.phase !== 'dead';
    hero.position.set(p.x, 0, -p.y);
    u.rig.rotation.y = lerpAngle(u.rig.rotation.y, Math.atan2(Math.cos(p.face), -Math.sin(p.face)), Math.min(1, dt * 16));
    const speed = Math.hypot(p.vx || 0, p.vy || 0);
    u.walkT = (u.walkT || 0) + dt * speed * 3.2;
    const moving = speed > 0.3 || w.phase === 'exit';
    u.legs[0].rotation.x = moving ? Math.sin(u.walkT) * 0.7 : 0;
    u.legs[1].rotation.x = moving ? -Math.sin(u.walkT) * 0.7 : 0;
    u.rig.position.y = moving ? Math.abs(Math.sin(u.walkT)) * 0.06 : Math.sin(time * 2) * 0.01;
    u.cape.rotation.x = 0.15 + (moving ? 0.5 : Math.sin(time * 2) * 0.05);
    // Bow draw: string pulls back just before each shot.
    const since = w.time - p.shootT;
    const cd = 1 / p.stat.aspd;
    const pull = !p.moving && w.phase === 'fight' ? Math.min(1, p.atkT / cd) : 0;
    u.bow.userData.string.position.z = -pull * 0.18;
    u.bow.rotation.x = since < 0.08 ? -0.2 : 0;
    // Hurt blink / star / aegis.
    const hurt = w.time - p.hurtT < 0.12;
    const blink = p.invuln > 0 && !p.starOn && Math.floor(time * 20) % 2 === 0;
    u.rig.visible = !blink || w.phase !== 'fight';
    for (const m of u.mats) {
        if (hurt) { m.emissive.setRGB(1, 0.1, 0.1); m.emissiveIntensity = 1; }
        else if (p.starOn) { m.emissive.setRGB(1, 0.85, 0.2); m.emissiveIntensity = 0.6 + Math.sin(time * 20) * 0.3; }
        else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; }
    }
    starGlow.material.opacity = p.starOn ? 0.8 : 0;
    aegisBubble.visible = !!p.ab.aegis && p.aegisT <= 0;
    aegisBubble.material.opacity = 0.14 + Math.sin(time * 3) * 0.05;
    heroRing.material.opacity = 0.35 + Math.sin(time * 3) * 0.15;
    u.shadow.position.set(p.x, 0.015, -p.y);
}

function syncOrbits(w, time) {
    const orbs = orbitPositions(w);
    while (orbMeshes.length < orbs.length) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false }));
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), new THREE.MeshStandardMaterial({ emissiveIntensity: 2.5 }));
        s.add(core);
        s.scale.setScalar(0.9);
        group.add(s);
        orbMeshes.push(s);
    }
    orbMeshes.forEach((m, i) => {
        const o = orbs[i];
        m.visible = !!o;
        if (!o) return;
        const col = o.kind === 'fire' ? 0xff7020 : 0x70d0ff;
        m.material.color.set(col);
        m.children[0].material.color.set(col);
        m.children[0].material.emissive.set(col);
        m.position.set(o.x, 0.6 + Math.sin(time * 5 + i) * 0.08, -o.y);
    });
    const sp = spiritPositions(w);
    while (spiritMeshes.length < sp.length) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9affff, blending: THREE.AdditiveBlending, depthWrite: false }));
        s.scale.setScalar(0.7);
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe0ffff }));
        s.add(core);
        group.add(s);
        spiritMeshes.push(s);
    }
    spiritMeshes.forEach((m, i) => {
        const o = sp[i];
        m.visible = !!o;
        if (o) m.position.set(o.x, 1.2 + Math.sin(time * 3 + i * 2) * 0.12, -o.y);
    });
}

/** Hero world position for fx that need it. */
export function heroObject() { return hero; }
