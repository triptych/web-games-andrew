// The garden under the well. Slide down the rope from the Glowing Well beside
// the Hearthgarden and you land in a cave where everything shines: glowcap
// mushrooms, lumenblooms, a lanternwood grove, moonlichen on the boulders,
// shelf fungus, hanging vines, and a pool with a thread of waterfall and a few
// glowing fish. It is a small garden you keep: fill your can at the pool, water
// the beds and the plants drink and grow; when one is ready to pick, pick it.
// What you gather is counted in the corner and kept between visits, and the
// beds go on growing (for a while) while you are away.
//
// Its own scene, drawn by the garden's composer, walked with the garden's
// controls. The cave itself is grotto-cave.js; the plants are grotto-flora.js.

import * as THREE from 'three';
import { NavGrid } from './nav.js';
import { LAND, POOL, SHAFT_R, wallR, insideCave, ceilingAt, shellPoint, shellNormal, buildShell, buildBasin, buildShaft } from './grotto-cave.js';
import { C, floraMaterial, floraUniforms, waterMaterial, waterfallMaterial, sparkMaterial, sparkPoints, beamTexture } from './grotto-kit.js';
import * as F from './grotto-flora.js';
import { Acc, mat } from './forest-kit.js';
import { GrottoAudio } from './grotto-audio.js';
import { ropeMaterial } from './well.js';
import { glowSprite } from './textures.js';
import { rng, clamp, damp, lerp, smoothstep, store, TAU } from './util.js';

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const EYE = 1.65;
export const CAN_MAX = 5;           // waterings in a full can
export const REACH = 2.7;           // how near you must stand to tend a plant
export const WATER_TIME = 36;       // seconds one watering keeps a plant drinking
const SLIDE_T = 4.4, CLIMB_T = 3.8;
const OFFLINE_MAX = 30 * 60;        // the beds grow for at most this long while you are away

/** What can be grown: how long it takes (seconds of being watered), what it yields, and how far back picking sets it. */
export const KINDS = {
    glowcap: { name: 'Glowcap', plural: 'Glowcaps', icon: '\u{1F344}', accent: '#3af0c0', grow: 50, yield: [2, 4], regrow: 0.08, light: 0x3af0c0, blurb: 'A mushroom that shines like a green moon. It likes its feet wet, and the biggest ones hum.' },
    lumen: { name: 'Lumenbloom', plural: 'Lumenblooms', icon: '\u{1F33A}', accent: '#ff7ad9', grow: 70, yield: [2, 3], regrow: 0.12, light: 0xff7ad9, blurb: 'A fern whose bells open only when it has drunk its fill, and ring very faintly in the draught.' },
    fruit: { name: 'Lanternfruit', plural: 'Lanternfruit', icon: '\u{1F3EE}', accent: '#ffb347', grow: 130, yield: [3, 5], regrow: 0.4, light: 0xffa640, blurb: 'A lanternwood grows slowly, but its fruit hangs like little lamps and keeps well.' },
    lichen: { name: 'Moonlichen', plural: 'Moonlichen', icon: '\u{1F33F}', accent: '#bffff0', grow: 60, yield: [2, 4], regrow: 0.1, light: 0xbffff0, blurb: 'Pale rosettes that spread over a boulder as it drinks. Scrape a little, never the whole boulder.' },
};
export const KIND_KEYS = Object.keys(KINDS);

/** Where things can be tended. `start` is how far along a new garden begins (1 = ready to pick). */
export const PLOTS = [
    { kind: 'glowcap', x: -3.6, z: 3.4, hue: 'teal', start: 1 },
    { kind: 'glowcap', x: 4.2, z: 3.6, hue: 'violet', start: 0.5 },
    { kind: 'glowcap', x: 8.6, z: -0.8, hue: 'blue', start: 0.25 },
    { kind: 'glowcap', x: -9.8, z: 5.0, hue: 'pink', start: 0.15 },
    { kind: 'lumen', x: 4.6, z: -3.2, hue: 'pink', start: 1 },
    { kind: 'lumen', x: -1.2, z: -3.4, hue: 'violet', start: 0.4 },
    { kind: 'lumen', x: -10.4, z: -5.2, hue: 'blue', start: 0.2 },
    { kind: 'fruit', x: 8.6, z: -6.0, start: 1 },
    { kind: 'fruit', x: -6.2, z: -7.8, start: 0.5 },
    { kind: 'fruit', x: 8.0, z: 7.2, start: 0.2 },
    { kind: 'lichen', x: 10.9, z: 3.0, start: 1 },
    { kind: 'lichen', x: -12.2, z: 1.4, start: 0.45 },
    { kind: 'lichen', x: -6.4, z: -10.2, start: 0.2 },
    { kind: 'lichen', x: 6.6, z: -9.4, start: 0.3 },
];
const BED_R = { glowcap: 0.95, lumen: 1.05, fruit: 1.2, lichen: 1.15 };

const MOTHER = { x: 1.6, z: -6.4 };
const FALL = { x: -9.0, z: -0.9, h: 2.5 };

export const PLACES = [
    { id: 'landing', name: 'The Landing', sub: 'Where the rope comes down', accent: '#8affc8', x: LAND.x, z: LAND.z, r: 3.4, note: 'The rope you came down on. Click it, or press Climb the rope, to go up.' },
    { id: 'beds', name: 'The Mushroom Beds', sub: 'Glowcaps like their feet wet', accent: '#3af0c0', x: 4.2, z: 3.6, r: 5, note: 'Water what is thirsty and pick what is ready: it is all yours.' },
    { id: 'pool', name: 'The Glow Pool', sub: 'Still water with a light of its own', accent: '#6dffe0', x: POOL.x, z: POOL.z, r: 6.6, note: 'Click the pool to fill your can. It never runs dry.' },
    { id: 'mother', name: 'The Old Lanternwood', sub: 'The oldest tree in the garden', accent: '#b48cff', x: MOTHER.x, z: MOTHER.z, r: 6.4, note: 'Nobody planted it. Its fruit are lamps that nobody picks.' },
    { id: 'lichen', name: 'The Moonlichen Wall', sub: 'Pale rosettes on every boulder', accent: '#bffff0', x: 11.2, z: 1.4, r: 5, note: 'Lichen grows a hair a day. With water, a good deal faster.' },
];

const TIER = {
    high: { spores: 220, worms: 300, fx: 240, lights: 6, deco: 1, shell: 1 },
    medium: { spores: 150, worms: 200, fx: 170, lights: 5, deco: 0.75, shell: 0.8 },
    low: { spores: 80, worms: 120, fx: 110, lights: 4, deco: 0.5, shell: 0.6 },
};

const SAVE_KEY = 'wellGarden';
const DRY_SOIL = C('#4a3a2e'), WET_SOIL = C('#1a120e');

export class Grotto {
    /** @param {object} env { renderer, audio (AudioEngine), ui, quality } */
    constructor(env) {
        this.env = env;
        this.cfg = TIER[env.quality?.tier] || TIER.high;
        this.inside = false;
        this.state = 'out';           // 'out' | 'slide' | 'free' | 'climb'
        this.onExit = null;
        this.clock = 0;
        this.scene = new THREE.Scene();
        this.fog = new THREE.FogExp2(0x07141c, 0.017);
        this.scene.background = new THREE.Color(0x03070c);
        this.scene.fog = this.fog;
        this.uni = {
            uTime: { value: 0 }, uSway: { value: 1 }, uGlow: { value: 1 },
            uHole: { value: new V3(LAND.x, LAND.z, SHAFT_R) },
            uPool: { value: new V3(POOL.x, POOL.z, POOL.r) },
        };
        this.sound = env.audio ? new GrottoAudio(env.audio) : null;
        this.cols = [];                 // circles you can't walk through: { x, z, r }
        this.occupied = [];             // where decorations must not go
        this.plots = [];
        this.hits = [];
        this.sources = [];
        this.fwd = new V3(0, 0, -1);
        this.hover = null;
        this.seen = new Set();
        this.dashTimer = 0;
        this.ripeCount = 0;
        this.save = null;
        this.pendingHint = null;

        this._lights();
        this._cave();
        this._shaft();
        this._pool();
        this._motherTree();
        this._decor();
        this._plots();
        this._particles();
        this._ring();
        this._dom();

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (insideCave(x, z, 0.9) && Math.hypot(x - POOL.x, z - POOL.z) > POOL.r + 0.3 ? 1 : -5) },
            walkHeight: () => 0,
            onDeck: () => false,
            collidersNear: () => self.cols,
            onArrive: (r) => r?.then?.(),
        };
        this.world.nav = new NavGrid(this.world, 22);
        // beside the rope, turned a little to take in the garden (the rope itself would fill the view)
        this.spawn = { x: LAND.x + 1.25, z: LAND.z + 1.0, yaw: 0.3 };
        this._load();
    }

    // ------------------------------------------------------------ the view

    _lights() {
        this.hemi = new THREE.HemisphereLight(0x5a88b0, 0x1c3a2c, 2.0);
        this.amb = new THREE.AmbientLight(0x2a4268, 1.2);
        this.scene.add(this.hemi, this.amb);
        // daylight falling down the shaft
        this.shaftLight = new THREE.PointLight(0xfff0d0, 0, 28, 1.2);
        this.scene.add(this.shaftLight);
        // a few lights that follow the nearest glowing things (the rest only shine)
        this.lamps = Array.from({ length: this.cfg.lights }, () => {
            const l = new THREE.PointLight(0xffffff, 0, 11, 1.5);
            l.userData.src = null;
            this.scene.add(l);
            return l;
        });
        this.lampTimer = 0;
    }

    _cave() {
        this.shell = buildShell(this.uni, this.cfg.shell);
        this.scene.add(this.shell);
        this.basin = buildBasin();
        this.scene.add(this.basin);
        // flora material for everything that doesn't belong to one plant
        this.matStatic = floraMaterial(floraUniforms(this.uni, 1));
        this.matFrame = floraMaterial(floraUniforms(this.uni, 1), { roughness: 0.9 });
    }

    /** The brick shaft overhead, the rope hanging down it, and the daylight falling through. */
    _shaft() {
        const top = ceilingAt(LAND.x, LAND.z) + 9.6;
        this.shaft = buildShaft(top);
        this.scene.add(this.shaft.group);
        // the sky at its mouth
        this.skyMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, side: THREE.DoubleSide, fog: false });
        const disc = new THREE.Mesh(new THREE.CircleGeometry(SHAFT_R + 0.05, 24).rotateX(Math.PI / 2), this.skyMat);
        disc.position.set(LAND.x, top + 0.05, LAND.z);
        this.scene.add(disc);
        this.shaftGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xdff4ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        this.shaftGlow.scale.setScalar(5.5);
        this.shaftGlow.position.set(LAND.x, top - 0.6, LAND.z);
        this.scene.add(this.shaftGlow);
        this.shaftLight.position.set(LAND.x, top - 1.5, LAND.z);
        // a column of daylight from the mouth down to the floor
        const H = top;
        this.beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xcfeeff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_R * 0.95, 2.7, H - 1.0, 24, 1, true), this.beamMat);
        beam.position.set(LAND.x, (H - 1.0) / 2, LAND.z);
        this.scene.add(beam);
        // the rope: from the beam over the shaft, down to a coil on the floor
        const ropeM = ropeMaterial();
        const len = top - 0.5 - 0.35;
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, len, 8, 1, true), ropeM);
        ropeM.map.repeat.set(1, len * 4);
        rope.position.set(LAND.x, 0.35 + len / 2, LAND.z);
        this.rope = rope;
        this.scene.add(rope);
        const knot = new THREE.SphereGeometry(0.06, 8, 6);
        const kn = new THREE.InstancedMesh(knot, ropeM, Math.floor(len / 0.5));
        const m = new THREE.Matrix4();
        for (let i = 0; i < kn.count; i++) {
            m.makeTranslation(LAND.x, 0.5 + i * 0.5, LAND.z);
            kn.setMatrixAt(i, m);
        }
        this.scene.add(kn);
        // a stone landing with the rope's tail coiled on it
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0x6b7a74, roughness: 0.95 }));
        pad.position.set(LAND.x, 0.07, LAND.z);
        this.scene.add(pad);
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 7, 16).rotateX(Math.PI / 2), ropeM);
        coil.position.set(LAND.x + 0.1, 0.2, LAND.z + 0.05);
        const coil2 = coil.clone();
        coil2.position.y = 0.28;
        coil2.scale.setScalar(0.8);
        this.scene.add(coil, coil2);
        // the pointer's target for the rope
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 4.2, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(LAND.x, 2.1, LAND.z);
        hit.userData.kind = 'rope';
        this.ropeHit = hit;
        this.scene.add(hit);
        this.occupied.push({ x: LAND.x, z: LAND.z, r: 3.2 });
    }

    /** The pool: a basin sunk in the floor, a rim of stones, water that glints, a waterfall, lily pads and fish. */
    _pool() {
        const rnd = rng('grotto-pool');
        this.water = waterMaterial(POOL.x, POOL.z, POOL.r + 0.05);
        const surf = new THREE.Mesh(new THREE.CircleGeometry(POOL.r + 0.05, 44).rotateX(-Math.PI / 2), this.water);
        surf.position.set(POOL.x, POOL.y, POOL.z);
        surf.renderOrder = 2;
        this.scene.add(surf);
        // the rim: stones, mossy on top
        const acc = new Acc();
        F.stoneRing(acc, rnd, POOL.x, POOL.z, POOL.r + 0.12, 22, 0.34);
        F.stoneRing(acc, rnd, POOL.x, POOL.z, POOL.r + 0.55, 14, 0.24);
        // a little outcrop where the water comes in, with a ledge at its top
        const base = F.boulder(acc, rnd, FALL.x - 0.9, FALL.z - 0.1, 1.5);
        F.boulder(acc, rnd, FALL.x - 0.6, FALL.z + 0.9, 1.1, { y: 0.1 });
        F.boulder(acc, rnd, FALL.x - 0.7, FALL.z - 1.1, 1.2, { y: 0.1 });
        F.boulder(acc, rnd, FALL.x - 1.0, FALL.z - 0.1, 1.1, { y: 1.35 });
        void base;
        this.cols.push({ x: FALL.x - 1.0, z: FALL.z, r: 1.5 }, { x: FALL.x - 0.7, z: FALL.z + 0.9, r: 0.8 }, { x: FALL.x - 0.8, z: FALL.z - 1.1, r: 0.8 });
        // lily pads, and a lily on some
        for (let i = 0; i < 7; i++) {
            const a = rnd() * TAU, d = rnd.range(0.5, POOL.r - 0.5), r = rnd.range(0.16, 0.3);
            const px = POOL.x + Math.cos(a) * d, pz = POOL.z + Math.sin(a) * d;
            const pad = new THREE.CircleGeometry(r, 10, 0.4, TAU - 0.5).rotateX(-Math.PI / 2);
            acc.add(pad, mat(px, POOL.y + 0.02, pz, rnd() * TAU, 1), { color: C('#2f6a4c'), glow: 0.15 });
            if (i % 2 === 0) {
                const col = C(i % 4 === 0 ? '#ff9ae6' : '#fff2b0');
                acc.add(new THREE.ConeGeometry(0.07, 0.14, 6), mat(px, POOL.y + 0.1, pz, 0, 1), { color: col, glow: 2.4 });
            }
        }
        this.poolMesh = new THREE.Mesh(acc.build(), this.matStatic);
        this.scene.add(this.poolMesh);
        // the waterfall: a ribbon of light falling from the ledge into the pool
        this.fallMat = waterfallMaterial();
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.75, FALL.h, 1, 1), this.fallMat);
        fall.position.set(FALL.x + 0.1, POOL.y + FALL.h / 2, FALL.z);
        fall.rotation.y = Math.PI / 2;
        this.scene.add(fall);
        this.fallAt = { x: FALL.x + 0.5, z: FALL.z };
        // a few glowing fish
        this.fish = [];
        const fishMat = [new THREE.MeshBasicMaterial({ color: 0xffb070 }), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }), new THREE.MeshBasicMaterial({ color: 0x9affc8 })];
        for (let i = 0; i < 4; i++) {
            const f = new THREE.Group();
            const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6).scale(0.24, 0.07, 0.09), fishMat[i % 3]);
            const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4).rotateZ(Math.PI / 2).translate(-0.28, 0, 0), fishMat[i % 3]);
            tail.scale.set(1, 1, 0.3);
            f.add(body, tail);
            f.userData = { r: rnd.range(0.7, POOL.r - 0.8), sp: rnd.range(0.25, 0.55) * (i % 2 ? -1 : 1), ph: rnd() * TAU, wob: rnd.range(0.6, 1.4) };
            this.fish.push(f);
            this.scene.add(f);
        }
        this.occupied.push({ x: POOL.x, z: POOL.z, r: POOL.r + 1.6 }, { x: FALL.x - 1, z: FALL.z, r: 2.6 });
        this.rippleT = 0;
    }

    /** The old lanternwood at the back of the cave, whose crown fills the dome with light. */
    _motherTree() {
        const rnd = rng('mother-tree'), rnd2 = rng('mother-tree');
        const acc = new Acc();
        const o = { height: 3.6, girth: 2.7, boughs: 7, spread: 2.2, crown: 1.9, roots: 7, fruits: 2, glow: 0.55, leaf: ['#3a6fe0', '#6a4fe0', '#2fb9c8', '#8a5ff0'] };
        F.lanternTree(acc, rnd, MOTHER.x, MOTHER.z, 1.55, o);
        this.matMother = floraMaterial(floraUniforms(this.uni, 1));
        this.mother = new THREE.Mesh(acc.build(), this.matMother);
        this.scene.add(this.mother);
        const lanterns = new Acc();
        F.lanternTree(lanterns, rnd2, MOTHER.x, MOTHER.z, 1.55, { ...o, fruitOnly: true, fruits: 3, fruitSize: 1.3 });
        this.scene.add(new THREE.Mesh(lanterns.build(), this.matMother));
        // pale bulbs hanging on threads from its boughs
        const vines = new Acc();
        for (let i = 0; i < 12; i++) {
            const a = rnd() * TAU, d = rnd.range(1.2, 4.4);
            F.hangingVine(vines, rnd, MOTHER.x + Math.cos(a) * d, 4.6 + rnd.range(0, 0.9), MOTHER.z + Math.sin(a) * d, rnd.range(1.4, 3.2), rnd.pick(['violet', 'blue', 'teal']));
        }
        this.scene.add(new THREE.Mesh(vines.build(), this.matMother));
        this.cols.push({ x: MOTHER.x, z: MOTHER.z, r: 1.35 });
        this.occupied.push({ x: MOTHER.x, z: MOTHER.z, r: 3.3 });
        this.sources.push({ pos: new V3(MOTHER.x + 1.5, 1.6, MOTHER.z + 2.2), color: new THREE.Color(0x9a78ff), power: 4.2, id: 'mother' });
    }

    /** Wild things that only decorate: mushrooms round the walls, ferns, boulders, shelves, lichen, drips and vines. */
    _decor() {
        const rnd = rng('grotto-decor');
        const k = this.cfg.deco;
        // the beds are built after this, but nothing wild may grow in them
        for (const d of PLOTS) this.occupied.push({ x: d.x, z: d.z, r: BED_R[d.kind] + 0.9 });
        const acc = new Acc();
        const free = (x, z, r = 0.6) => insideCave(x, z, 0.7) && !this.occupied.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r);
        const edge = (inset) => {
            for (let t = 0; t < 40; t++) {
                const th = rnd() * TAU;
                const rho = wallR(th) - inset - rnd.range(0, 2.2);
                const x = Math.sin(th) * rho, z = Math.cos(th) * rho;
                if (free(x, z)) return { x, z, th };
            }
            return null;
        };
        const hues = Object.keys(F.HUES);
        // mushrooms: clusters round the edge, some giants
        for (let i = 0; i < Math.round(40 * k); i++) {
            const p = edge(1.0);
            if (!p) continue;
            F.glowcapCluster(acc, rnd, p.x, p.z, rnd.range(0.5, 1.2), rnd.int(3, 6), rnd.range(0.12, 0.42), rnd.pick(hues));
        }
        for (let i = 0; i < Math.round(8 * k); i++) {
            const p = edge(1.6);
            if (p) F.mushroom(acc, rnd, p.x, p.z, rnd.range(0.7, 1.1), rnd.pick(['teal', 'violet', 'blue', 'pink']), { tall: rnd.range(1.3, 2) });
        }
        // ferns
        for (let i = 0; i < Math.round(28 * k); i++) {
            const p = edge(0.8);
            if (p) F.lumenFern(acc, rnd, p.x, p.z, rnd.range(0.6, 1.2), { fronds: 6 });
        }
        for (let i = 0; i < 8; i++) {
            const a = rnd() * TAU, d = POOL.r + rnd.range(0.8, 1.5);
            const x = POOL.x + Math.cos(a) * d, z = POOL.z + Math.sin(a) * d;
            if (insideCave(x, z, 1) && Math.hypot(x - FALL.x, z - FALL.z) > 2) F.lumenFern(acc, rnd, x, z, rnd.range(0.5, 0.9), { fronds: 6 });
            if (insideCave(x, z, 1) && i % 2) F.mushroom(acc, rnd, x + 0.5, z, rnd.range(0.15, 0.3), rnd.pick(['teal', 'blue']));
        }
        // boulders and stalagmites
        for (let i = 0; i < Math.round(12 * k); i++) {
            const p = edge(1.3);
            if (!p) continue;
            const size = rnd.range(0.5, 1.1);
            F.boulder(acc, rnd, p.x, p.z, size);
            if (size > 0.8) this.cols.push({ x: p.x, z: p.z, r: size * 0.9 });
        }
        for (let i = 0; i < Math.round(16 * k); i++) {
            const p = edge(0.9);
            if (p) F.stalagmite(acc, rnd, p.x, p.z, rnd.range(0.15, 0.45), rnd.range(0.6, 2.1));
        }
        // the walls: shelf fungus, lichen, and the dome: drips, vines, lichen
        const p = new V3(), n = new V3();
        const onWall = (phMin, phMax) => {
            for (let t = 0; t < 30; t++) {
                const th = rnd() * TAU, ph = rnd.range(phMin, phMax);
                shellPoint(th, ph, p);
                if (Math.hypot(p.x - LAND.x, p.z - LAND.z) < 3.2 && p.y > 3) continue;
                if (Math.hypot(p.x - LAND.x, p.z - LAND.z) < 2.4) continue;
                shellNormal(th, ph, n).negate();
                return { p: p.clone(), n: n.clone() };
            }
            return null;
        };
        for (let i = 0; i < Math.round(34 * k); i++) {
            const w = onWall(0.04, 0.5);
            if (w) F.shelfFungus(acc, rnd, w.p, w.n, rnd.range(0.25, 0.8), rnd.pick(hues));
        }
        for (let i = 0; i < Math.round(56 * k); i++) {
            const w = onWall(0.03, 1.25);
            if (w) F.wallLichen(acc, rnd, w.p, w.n, rnd.range(0.2, 0.7));
        }
        for (let i = 0; i < Math.round(52 * k); i++) {
            const w = onWall(0.4, 1.5);
            if (w) F.stalactite(acc, rnd, w.p.x, w.p.y + 0.1, w.p.z, rnd.range(0.1, 0.42), rnd.range(0.6, 2.4), { tip: i % 4 === 0 ? '#7dffe0' : null });
        }
        for (let i = 0; i < Math.round(30 * k); i++) {
            const w = onWall(0.5, 1.35);
            if (w) F.hangingVine(acc, rnd, w.p.x, w.p.y, w.p.z, rnd.range(1.2, 3.6), rnd.pick(['pink', 'teal', 'blue', 'amber', 'violet']));
        }
        this.decor = new THREE.Mesh(acc.build(), this.matStatic);
        this.scene.add(this.decor);
        this.sources.push({ pos: new V3(POOL.x, 0.7, POOL.z), color: new THREE.Color(0x40e8d0), power: 6.5, id: 'pool' });
    }

    // ------------------------------------------------------------ the plots

    _plots() {
        PLOTS.forEach((def, i) => {
            const K = KINDS[def.kind];
            const R = BED_R[def.kind];
            const rnd = rng('plot' + i);
            const group = new THREE.Group();
            group.position.set(def.x, 0, def.z);
            this.scene.add(group);
            const uni = floraUniforms(this.uni, 1);
            const material = floraMaterial(uni);
            const p = { i, def, kind: def.kind, K, x: def.x, z: def.z, R, group, uni, material, g: def.start, water: 0, ripe: false, perk: 0, view: {}, vital: 0.4, sc: 0, moteT: Math.random(), soilMat: null };
            const grow = new THREE.Group();
            group.add(grow);
            p.grow = grow;

            if (def.kind === 'lichen') {
                // a boulder, and its lichen in tiers
                const rock = new Acc();
                const b = F.boulder(rock, rnd, 0, 0, 0.95);
                grow.add(new THREE.Mesh(rock.build(), this.matFrame));
                p.tiers = F.lichenTiers(rnd, b, 3).map((a) => {
                    const m = new THREE.Mesh(a.build(), material);
                    grow.add(m);
                    return m;
                });
                p.tierAt = [0.0, 0.34, 0.68];
            } else {
                // a ring of stones round a low mound of soil
                const frame = new Acc();
                F.stoneRing(frame, rnd, 0, 0, R, def.kind === 'fruit' ? 12 : 10);
                group.add(new THREE.Mesh(frame.build(), this.matFrame));
                p.soilMat = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.95 });
                const soil = new THREE.Mesh(new THREE.SphereGeometry(R - 0.08, 18, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.2, 1), p.soilMat);
                soil.position.y = 0.02;
                group.add(soil);
                const a = new Acc(), a2 = new Acc();
                if (def.kind === 'glowcap') {
                    F.glowcapCluster(a, rnd, 0, 0, R * 0.55, 8, 0.36, def.hue);
                    F.glowcapCluster(a2, rnd, 0, 0, R * 0.5, 3, 0.5, def.hue, { glow: 1.1 });
                } else if (def.kind === 'lumen') {
                    // the buds and the open bells grow from one seed each, so the bells sit exactly on the buds
                    F.lumenFern(a, rng('fern' + i), 0, 0, 0.95);
                    F.lumenBells(a, rng('bells' + i), 0, 0, 1.0, false, def.hue);
                    F.lumenBells(a2, rng('bells' + i), 0, 0, 1.0, true, def.hue);
                } else {
                    // likewise the tree and its lantern fruit
                    const o = { height: 2.6, girth: 1.1, boughs: 4, spread: 0.9, crown: 0.95, roots: 4, fruits: 2 };
                    F.lanternTree(a, rng('tree' + i), 0, 0, 1, o);
                    F.lanternTree(a2, rng('tree' + i), 0, 0, 1, { ...o, fruitOnly: true, fruitSize: 1 });
                }
                p.base = new THREE.Mesh(a.build(), material);
                p.ripeMesh = new THREE.Mesh(a2.build(), material);
                grow.add(p.base);
                grow.add(p.ripeMesh);
                p.ripeMesh.scale.setScalar(0.001);
                p.ripeMesh.visible = false;
            }
            // the target for the pointer
            const hit = new THREE.Mesh(new THREE.SphereGeometry(def.kind === 'fruit' ? 1.5 : 1.2, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
            hit.position.set(def.x, def.kind === 'fruit' ? 1.3 : 0.55, def.z);
            hit.userData.plot = p;
            this.hits.push(hit);
            this.scene.add(hit);
            this.cols.push({ x: def.x, z: def.z, r: R + 0.05 });
            this.occupied.push({ x: def.x, z: def.z, r: R + 1.0 });
            p.light = { pos: new V3(def.x, def.kind === 'fruit' ? 1.8 : 0.9, def.z), color: new THREE.Color(K.light), power: 3.4, plot: p };
            this.sources.push(p.light);
            this.plots.push(p);
        });
    }

    // ------------------------------------------------------------ particles, ring

    _particles() {
        const rnd = rng('grotto-motes');
        // spores drifting up through the cave
        const spores = [];
        const tints = [[0.4, 1, 0.85], [1, 0.55, 0.9], [0.6, 0.75, 1], [1, 0.85, 0.5]];
        for (let i = 0; i < this.cfg.spores; i++) {
            const th = rnd() * TAU, rho = Math.sqrt(rnd()) * 11;
            const c = tints[Math.floor(rnd() * tints.length)];
            spores.push({ x: Math.sin(th) * rho, y: rnd.range(0, 8), z: Math.cos(th) * rho, r: c[0], g: c[1], b: c[2], a: rnd.range(0.3, 0.7), size: rnd.range(3.5, 8), seed: rnd() });
        }
        this.sporeMat = sparkMaterial({ move: 1, height: 8, twinkle: 0.5 });
        this.spores = sparkPoints(spores, this.sporeMat);
        this.scene.add(this.spores);
        // glowworms: a sky of tiny stars on the dome
        const worms = [];
        const p = new V3(), n = new V3();
        for (let i = 0; i < this.cfg.worms; i++) {
            const th = rnd() * TAU, ph = rnd.range(0.35, 1.5);
            shellPoint(th, ph, p);
            shellNormal(th, ph, n).negate();
            const c = tints[Math.floor(rnd() * 2)];
            worms.push({ x: p.x + n.x * 0.12, y: p.y + n.y * 0.12, z: p.z + n.z * 0.12, r: c[0] * 0.8, g: c[1] * 0.9 + 0.1, b: c[2], a: rnd.range(0.5, 1), size: rnd.range(2.5, 6), seed: rnd() });
        }
        this.wormMat = sparkMaterial({ move: 0, twinkle: 1 });
        this.worms = sparkPoints(worms, this.wormMat);
        this.scene.add(this.worms);
        // sparks that come and go: water drops, picked things, motes over plants that are ready
        const N = this.cfg.fx;
        this.fx = { n: N, pos: new Float32Array(N * 3), col: new Float32Array(N * 4), size: new Float32Array(N), seed: new Float32Array(N), vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), grav: new Float32Array(N), next: 0 };
        for (let i = 0; i < N; i++) this.fx.seed[i] = Math.random();
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.fx.pos, 3));
        g.setAttribute('aCol', new THREE.BufferAttribute(this.fx.col, 4));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.fx.size, 1));
        g.setAttribute('aSeed', new THREE.BufferAttribute(this.fx.seed, 1));
        this.fxMat = sparkMaterial({ move: 0, twinkle: 0 });
        this.fxPts = new THREE.Points(g, this.fxMat);
        this.fxPts.frustumCulled = false;
        this.scene.add(this.fxPts);
        // beams of light through the shaft: dust in the column
        const dust = [];
        for (let i = 0; i < 40; i++) {
            const a = rnd() * TAU, d = Math.sqrt(rnd()) * 1.6;
            dust.push({ x: LAND.x + Math.cos(a) * d, y: rnd.range(0.5, 7.5), z: LAND.z + Math.sin(a) * d, r: 1, g: 0.95, b: 0.8, a: 0.45, size: rnd.range(2.5, 5), seed: rnd() });
        }
        this.dustMat = sparkMaterial({ move: 1, height: 8, twinkle: 0.6 });
        this.dust = sparkPoints(dust, this.dustMat);
        this.scene.add(this.dust);
    }

    /** A spark from the pool of sparks. */
    _spark(x, y, z, vx, vy, vz, hex, size, life, grav = -3) {
        const f = this.fx, i = f.next++ % f.n;
        f.pos.set([x, y, z], i * 3);
        f.vel.set([vx, vy, vz], i * 3);
        const c = C(hex);
        f.col.set([c.r, c.g, c.b, 1], i * 4);
        f.size[i] = size;
        f.life[i] = f.max[i] = life;
        f.grav[i] = grav;
    }

    _updateSparks(dt) {
        const f = this.fx;
        for (let i = 0; i < f.n; i++) {
            if (f.life[i] <= 0) {
                f.col[i * 4 + 3] = 0;
                continue;
            }
            f.life[i] -= dt;
            f.vel[i * 3 + 1] += f.grav[i] * dt;
            f.pos[i * 3] += f.vel[i * 3] * dt;
            f.pos[i * 3 + 1] += f.vel[i * 3 + 1] * dt;
            f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * dt;
            const k = f.life[i] / f.max[i];
            f.col[i * 4 + 3] = Math.min(1, k * 3);
        }
        this.fxPts.geometry.attributes.position.needsUpdate = true;
        this.fxPts.geometry.attributes.aCol.needsUpdate = true;
    }

    /** The ring that shows what the pointer is over. */
    _ring() {
        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        this.ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 40).rotateX(-Math.PI / 2), this.ringMat);
        this.ringMesh.visible = false;
        this.scene.add(this.ringMesh);
    }

    // ------------------------------------------------------------ the HUD

    _dom() {
        this.dom = { root: $('well-hud'), pips: $('well-pips'), home: $('well-home'), n: {} };
        for (const k of KIND_KEYS) this.dom.n[k] = $(`well-n-${k}`);
        this.dom.home?.addEventListener('click', () => {
            this.env.audio?.click();
            this.climb();
        });
        if (this.dom.pips && !this.dom.pips.children.length) {
            for (let i = 0; i < CAN_MAX; i++) this.dom.pips.append(document.createElement('i'));
        }
    }

    _hud() {
        const d = this.dom;
        if (!d.root) return;
        for (const k of KIND_KEYS) if (d.n[k]) d.n[k].textContent = String(this.save.bag[k]);
        if (d.pips) {
            [...d.pips.children].forEach((el, i) => el.classList.toggle('on', i < this.save.can));
            d.pips.setAttribute('aria-label', `Watering can: ${this.save.can} of ${CAN_MAX}`);
        }
    }

    /** A little label that floats up from a plant: +3 Glowcaps. */
    _pop(x, y, z, text, accent) {
        if (!this.camera) return;
        const v = new V3(x, y, z).project(this.camera);
        if (v.z > 1) return;
        const el = document.createElement('div');
        el.className = 'well-pop';
        el.textContent = text;
        el.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
        el.style.top = `${((1 - v.y) / 2) * innerHeight}px`;
        el.style.setProperty('--accent', accent);
        document.body.append(el);
        setTimeout(() => el.remove(), 1500);
    }

    // ------------------------------------------------------------ saving

    _load() {
        const s = store.get(SAVE_KEY, null);
        this.save = {
            t: Date.now(),
            can: CAN_MAX,
            bag: Object.fromEntries(KIND_KEYS.map((k) => [k, 0])),
            total: 0,
            log: {},
            plots: null,
        };
        if (s && typeof s === 'object') {
            this.save.t = Number(s.t) || Date.now();
            this.save.can = clamp(Math.round(Number(s.can) || 0), 0, CAN_MAX);
            for (const k of KIND_KEYS) this.save.bag[k] = Math.max(0, Math.floor(Number(s.bag?.[k]) || 0));
            this.save.total = Math.max(0, Math.floor(Number(s.total) || 0));
            this.save.log = s.log && typeof s.log === 'object' ? s.log : {};
            if (Array.isArray(s.plots) && s.plots.length === this.plots.length) {
                this.plots.forEach((p, i) => {
                    p.g = clamp(Number(s.plots[i]?.g) || 0, 0, 1);
                    p.water = clamp(Number(s.plots[i]?.w) || 0, 0, 1);
                });
            }
        }
        // the beds went on growing while you were away, as long as they had water
        const away = clamp((Date.now() - this.save.t) / 1000, 0, OFFLINE_MAX);
        for (const p of this.plots) {
            if (p.g < 1 && away > 0) {
                const drink = Math.min(away, p.water * WATER_TIME);
                p.g = Math.min(1, p.g + drink / p.K.grow);
            }
            p.water = Math.max(0, p.water - away / WATER_TIME);
            p.ripe = p.g >= 1;
            this._showPlot(p, 0, true);
        }
        this._hud();
    }

    _store() {
        const s = this.save;
        s.t = Date.now();
        s.plots = this.plots.map((p) => ({ g: Math.round(p.g * 1000) / 1000, w: Math.round(p.water * 1000) / 1000 }));
        store.set(SAVE_KEY, s);
    }

    // ------------------------------------------------------------ in and out

    /** Over the curb and down the rope. */
    enter(controls, camera) {
        this.controls = controls;
        this.camera = camera;
        controls.world = this.world;
        this.inside = true;
        this.state = 'slide';
        this.sT = 0;
        controls.enabled = false;
        controls.route = null;
        this.seen.clear();
        this.armedExit = false;
        this.dashTimer = 0;
        // the beds have been growing since you left
        this._load();
        if (this.dom.root) this.dom.root.hidden = false;
        document.body.classList.add('in-well');
        this._hud();
        this.sound?.start();
        this.sound?.slide(SLIDE_T);
        this._slideCamera(0);
    }

    /** Back at the surface: the camera is the garden's again. */
    leave() {
        if (!this.inside) return;
        this._store();
        this.inside = false;
        this.state = 'out';
        if (this.dom.root) this.dom.root.hidden = true;
        document.body.classList.remove('in-well');
        this.sound?.stop();
        if (this.controls) this.controls.enabled = true;
        for (const el of document.querySelectorAll('.well-pop')) el.remove();
        this.hover = null;
        this.ringMesh.visible = false;
        this.fx.life.fill(0);
    }

    /** Is the player locked into a slide or a climb? */
    get busy() {
        return this.state === 'slide' || this.state === 'climb';
    }

    /** Down the shaft: the camera hangs on the rope, gathers speed and slows into the landing. */
    _slideCamera(dt) {
        const cam = this.camera;
        this.sT += dt;
        const k = clamp(this.sT / SLIDE_T, 0, 1);
        const e = k * k * k * (k * (k * 6 - 15) + 10);
        const y = lerp(this.shaft.top - 1.0, EYE, e);
        // the last stretch eases out to the spot you stand on, and turns you to face the garden
        const s = smoothstep(0.72, 1, k);
        const sp = this.spawn;
        const px = lerp(LAND.x, sp.x, s), pz = lerp(LAND.z + 0.4, sp.z, s);
        const pitch = lerp(-1.18, -0.08, smoothstep(0.4, 1, k));
        const t = this.clock;
        cam.position.set(px + Math.sin(t * 1.7) * 0.03 * (1 - k), y, pz);
        cam.rotation.set(pitch, sp.yaw * s, Math.sin(t * 2.3) * 0.022 * (1 - k), 'YXZ');
        if (k >= 1 && this.state === 'slide') this._landed();
    }

    _landed() {
        this.state = 'free';
        const c = this.controls;
        c.teleport(this.spawn.x, this.spawn.z, this.spawn.yaw);
        c.pitch = -0.08;
        c.enabled = true;
        this.sound?.thump();
        this.env.ui?.zone('The Glowing Well', 'A garden that shines by itself', '#8affc8');
        this._found('landing', true);
        if (!this.save.log.intro) {
            this.save.log.intro = 1;
            setTimeout(() => this.inside && this.env.ui?.hint(`Fill your can at the pool, water what is thirsty, and pick what is ready · ${matchMedia('(pointer: coarse)').matches ? 'tap' : 'click'} anything that glows · the rope behind you leads home`, 12000), 1800);
        }
    }

    /** Up the rope: walk to it first if you are away, then rise to the light. */
    climb() {
        if (this.state !== 'free' || !this.controls) return;
        const c = this.controls;
        const d = Math.hypot(c.pos.x - LAND.x, c.pos.z - LAND.z);
        if (d > 1.7) {
            const stand = this._standNear(LAND.x, LAND.z, 1.0);
            c.walkTo([stand], undefined);
            c.route.then = () => this.climb();
            return;
        }
        this.state = 'climb';
        this.cT = 0;
        c.enabled = false;
        c.route = null;
        this.climbFrom = { y: this.camera.position.y, x: this.camera.position.x, z: this.camera.position.z, pitch: c.pitch, yaw: c.yaw };
        this.exited = false;
        this.sound?.slide(CLIMB_T);
    }

    _climbCamera(dt) {
        const cam = this.camera;
        this.cT += dt;
        const k = clamp(this.cT / CLIMB_T, 0, 1);
        const a = smoothstep(0, 0.16, k);       // first: step in to the rope and look up
        const r = smoothstep(0.1, 1, k);
        const e = r * r * (3 - 2 * r);
        const f = this.climbFrom;
        const x = lerp(f.x, LAND.x, a), z = lerp(f.z, LAND.z + 0.42, a);
        const y = lerp(f.y, this.shaft.top - 0.6, e);
        cam.position.set(x, y, z);
        let dyaw = ((0 - f.yaw + Math.PI * 3) % TAU) - Math.PI;
        cam.rotation.set(lerp(f.pitch, 1.1, smoothstep(0.05, 0.6, k)), f.yaw + dyaw * a, 0, 'YXZ');
        if (k > 0.9 && !this.exited) {
            this.exited = true;
            this.onExit?.();
        }
    }

    // ------------------------------------------------------------ plants

    /** What a plant looks like now: its size and glow follow its growth and thirst. */
    _showPlot(p, dt, snap = false) {
        const g = p.g;
        const ease = (a, b) => (snap ? b : damp(a, b, 5, dt));
        if (p.kind === 'glowcap') {
            const s = 0.2 + 0.8 * (1 - (1 - g) ** 1.6);
            p.sc = ease(p.sc || s, s);
            p.base.scale.set(p.sc, p.sc ** 0.9, p.sc);
        } else if (p.kind === 'lumen') {
            const s = 0.3 + 0.7 * g;
            p.sc = ease(p.sc || s, s);
            p.base.scale.setScalar(p.sc);
        } else if (p.kind === 'fruit') {
            const s = 0.5 + 0.5 * g;
            p.sc = ease(p.sc || s, s);
            p.base.scale.setScalar(p.sc);
        } else {
            p.tiers.forEach((m, k) => {
                const want = g >= p.tierAt[k] ? 1 : 0;
                const s = ease(m.scale.x || 0.001, want || 0.001);
                const grow = k === 0 ? 0.55 + 0.45 * smoothstep(0, 0.3, g) : 1;
                m.scale.setScalar(Math.max(0.001, s * grow));
                m.visible = s > 0.01;
            });
        }
        if (p.ripeMesh) {
            const want = p.ripe ? 1 : 0.001;
            const s = ease(p.ripeMesh.scale.x || 0.001, want);
            p.ripeMesh.scale.setScalar(Math.max(0.001, s));
            p.ripeMesh.visible = s > 0.02;
        }
        // thirsty plants dim; a ripe one shines hardest; a drink makes it flare for a moment
        const want = p.ripe ? 1.15 : 0.3 + 0.7 * smoothstep(0, 0.2, p.water);
        p.vital = ease(p.vital, want + p.perk * 0.4);
        p.uni.uVital.value = p.vital;
        if (p.soilMat) p.soilMat.color.copy(DRY_SOIL).lerp(WET_SOIL, clamp(p.water * 3, 0, 1));
    }

    _tickPlot(p, dt) {
        p.perk = Math.max(0, p.perk - dt * 1.4);
        if (p.water > 0) {
            p.water = Math.max(0, p.water - dt / WATER_TIME);
            if (!p.ripe) {
                p.g = Math.min(1, p.g + dt / p.K.grow);
                if (p.g >= 1) this._ripen(p);
            }
        }
        if (p.ripe) {
            p.moteT -= dt;
            if (p.moteT <= 0) {
                p.moteT = 0.3 + Math.random() * 0.4;
                const a = Math.random() * TAU, d = Math.random() * p.R * 0.7;
                this._spark(p.x + Math.cos(a) * d, 0.3 + Math.random() * 0.4, p.z + Math.sin(a) * d, 0, 0.45 + Math.random() * 0.3, 0, p.K.accent, 6, 2.2, 0);
            }
        }
        this._showPlot(p, dt);
    }

    _ripen(p) {
        p.ripe = true;
        p.g = 1;
        p.perk = 1;
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * TAU, v = 0.6 + Math.random() * 1.2;
            this._spark(p.x, 0.5, p.z, Math.cos(a) * v, 0.8 + Math.random() * 1.2, Math.sin(a) * v, p.K.accent, 7, 1.2, -1.5);
        }
        this.sound?.drink();
        if (Math.hypot(this.controls.pos.x - p.x, this.controls.pos.z - p.z) < 10) this.env.ui?.hint(`A ${p.K.name} is ready to pick`, 3500);
        this._store();
    }

    /** Dip the can in the pool. */
    fillCan() {
        const s = this.save;
        if (s.can >= CAN_MAX) {
            this.env.ui?.hint('Your can is full already', 2200);
            return;
        }
        s.can = CAN_MAX;
        this.sound?.fill();
        const c = this.controls.pos;
        const a = Math.atan2(c.x - POOL.x, c.z - POOL.z);
        const ex = POOL.x + Math.sin(a) * POOL.r * 0.85, ez = POOL.z + Math.cos(a) * POOL.r * 0.85;
        this.water.userData.ripple(ex, ez, this.clock, 1.3);
        for (let i = 0; i < 12; i++) this._spark(ex, POOL.y + 0.1, ez, (Math.random() - 0.5) * 1.2, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 1.2, '#9ffff0', 6, 0.7, -7);
        this._hud();
        this._store();
    }

    /** Pour some water on a plant. */
    waterPlot(p) {
        const s = this.save;
        if (p.ripe) return this.harvest(p);
        if (s.can <= 0) {
            this.env.ui?.hint('Your can is empty · fill it at the pool', 3200);
            return;
        }
        s.can--;
        p.water = 1;
        p.perk = 1;
        this.sound?.pour();
        // a spray from where the can is held, in an arc down on to the plant
        const c = this.controls.pos;
        const fx = c.x + Math.sin(this.controls.yaw + 0.4) * -0.5, fz = c.z + Math.cos(this.controls.yaw + 0.4) * -0.5;
        for (let i = 0; i < 24; i++) {
            const T = 0.38 + Math.random() * 0.16;
            const tx = p.x + (Math.random() - 0.5) * p.R * 0.9, tz = p.z + (Math.random() - 0.5) * p.R * 0.9, ty = 0.2;
            const sy = 1.1 + Math.random() * 0.2;
            const vx = (tx - fx) / T, vz = (tz - fz) / T, vy = (ty - sy + 0.5 * 9 * T * T) / T;
            this._spark(fx, sy, fz, vx, vy, vz, '#aef0ff', 5, T + 0.05, -9);
        }
        for (let i = 0; i < 6; i++) setTimeout(() => this.inside && this._spark(p.x + (Math.random() - 0.5), 0.15, p.z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4, '#8affc8', 5, 0.7, -1), 420 + i * 40);
        setTimeout(() => this.inside && this.sound?.drink(), 480);
        this._hud();
        this._store();
    }

    /** Pick what is ready. */
    harvest(p) {
        if (!p.ripe) return;
        const K = p.K;
        const n = K.yield[0] + Math.floor(Math.random() * (K.yield[1] - K.yield[0] + 1));
        const s = this.save;
        s.bag[p.kind] += n;
        s.total += n;
        p.ripe = false;
        p.g = K.regrow;
        p.perk = 0.6;
        this.sound?.harvest(n);
        const y = p.kind === 'fruit' ? 1.8 : 0.9;
        for (let i = 0; i < 26; i++) {
            const a = Math.random() * TAU, v = 0.8 + Math.random() * 1.8;
            this._spark(p.x, y * 0.7, p.z, Math.cos(a) * v, 0.6 + Math.random() * 1.6, Math.sin(a) * v, K.accent, 7, 1.1, -2);
        }
        this._pop(p.x, y + 0.3, p.z, `+${n} ${n === 1 ? K.name : K.plural} ${K.icon}`, K.accent);
        if (!s.log['got-' + p.kind]) {
            s.log['got-' + p.kind] = 1;
            this.env.ui?.hint(`Your first ${K.name}! ${K.blurb}`, 7000);
            this.env.audio?.sparkle();
        }
        this._hud();
        this._store();
    }

    // ------------------------------------------------------------ places

    _found(id, quiet) {
        const pl = PLACES.find((x) => x.id === id);
        if (!pl || this.seen.has(id)) return;
        this.seen.add(id);
        const first = !this.save.log[id];
        this.save.log[id] = 1;
        if (!quiet) this.env.ui?.zone(pl.name, pl.sub, pl.accent);
        if (first && id !== 'landing') {
            this.env.ui?.hint(`Found: ${pl.name}. ${pl.note}`, 7000);
            this.env.audio?.sparkle();
        }
    }

    _places(p) {
        for (const pl of PLACES) if (!this.seen.has(pl.id) && Math.hypot(p.x - pl.x, p.z - pl.z) < pl.r) this._found(pl.id);
    }

    // ------------------------------------------------------------ frame

    /** `sky` is the garden sky's state; only the time of day reaches the shaft. */
    update(dt, t, camera, sky) {
        if (!this.inside) return;
        this.camera = camera;
        dt = Math.min(dt, 0.1);
        this.clock += dt;
        const clock = this.clock;
        this.uni.uTime.value = clock;
        this.water.uniforms.uTime.value = clock;
        this.fallMat.uniforms.uTime.value = clock;
        for (const m of [this.sporeMat, this.wormMat, this.fxMat, this.dustMat]) {
            m.uniforms.uTime.value = clock;
            m.uniforms.uScale.value = this.env.renderer.domElement.height * 0.5;
        }
        if (this.state === 'slide') this._slideCamera(dt);
        else if (this.state === 'climb') this._climbCamera(dt);

        // daylight down the shaft
        const night = sky?.night ?? 0;
        const day = 1 - night;
        this.skyMat.color.set(0xbfe6ff).lerp(C('#16264a'), night * 0.9);
        this.shaftLight.color.set(0xfff0d0).lerp(C('#4a66c8'), night);
        this.shaftLight.intensity = 1.5 + 5.5 * day;
        this.shaftGlow.material.opacity = 0.25 + 0.6 * day;
        this.beamMat.opacity = 0.07 + 0.2 * day;
        this.beamMat.color.set(0xcfeeff).lerp(C('#4466aa'), night);
        this.dustMat.uniforms.uTwinkle.value = 0.6;

        // the pool
        this.rippleT -= dt;
        if (this.rippleT <= 0) {
            this.rippleT = 0.55 + Math.random() * 0.5;
            this.water.userData.ripple(this.fallAt.x, this.fallAt.z, clock, 0.8);
        }
        for (const f of this.fish) {
            const u = f.userData, a = u.ph + clock * u.sp;
            const r = u.r + Math.sin(clock * 0.4 * u.wob + u.ph) * 0.25;
            const x = POOL.x + Math.cos(a) * r, z = POOL.z + Math.sin(a) * r;
            f.position.set(x, POOL.y - 0.32 - Math.sin(clock * u.wob + u.ph) * 0.06, z);
            const dir = Math.sign(u.sp);
            f.rotation.y = Math.atan2(-dir * Math.cos(a), -dir * Math.sin(a));
        }

        // the plants
        let ripe = 0;
        for (const p of this.plots) {
            this._tickPlot(p, dt);
            if (p.ripe) ripe++;
            p.light.power = (p.ripe ? 4.6 : 2.2 + 1.4 * smoothstep(0, 0.2, p.water)) * (0.7 + 0.3 * p.vital);
        }
        this.ripeCount = ripe;
        this._lamps(dt);
        this._updateSparks(dt);

        // the sounds follow where you stand
        const p = camera.position;
        const water = 1 - smoothstep(POOL.r + 1, POOL.r + 9, Math.hypot(p.x - POOL.x, p.z - POOL.z));
        const dripped = this.sound?.update(Math.max(water, 0.5 * (1 - smoothstep(1, 7, Math.hypot(p.x - this.fallAt.x, p.z - this.fallAt.z)))), ripe);
        if (dripped) this.water.userData.ripple(POOL.x + (Math.random() - 0.5) * POOL.r, POOL.z + (Math.random() - 0.5) * POOL.r, clock, 0.5);

        // hover ring
        const h = this.hover;
        if (h?.type === 'plot' && this.state === 'free') {
            const pl = h.plot;
            this.ringMesh.visible = true;
            this.ringMesh.position.set(pl.x, 0.07, pl.z);
            this.ringMesh.scale.setScalar(pl.R + 0.25 + Math.sin(clock * 4) * 0.03);
            this.ringMat.color.set(pl.K.accent);
        } else if (h?.type === 'pool' && this.state === 'free') {
            this.ringMesh.visible = true;
            this.ringMesh.position.set(POOL.x, 0.05, POOL.z);
            this.ringMesh.scale.setScalar(POOL.r + 0.5);
            this.ringMat.color.set('#6dffe0');
        } else this.ringMesh.visible = false;

        if (this.state === 'free') {
            this.fwd.set(-Math.sin(this.controls.yaw), 0, -Math.cos(this.controls.yaw));
            this._places(this.controls.pos);
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.dashTimer = 0.5;
                this._hud();
                const near = Math.hypot(this.controls.pos.x - LAND.x, this.controls.pos.z - LAND.z);
                if (near < 3 && !this.save.log.ropeHint) {
                    this.save.log.ropeHint = 1;
                    this.env.ui?.hint('The rope hangs where you landed · click it, or press Climb the rope, when you are ready to go up', 7000);
                }
            }
            this.saveTimer = (this.saveTimer ?? 0) + dt;
            if (this.saveTimer > 10) {
                this.saveTimer = 0;
                this._store();
            }
        }
    }

    /** Keep the few real lights on whatever glows nearest the camera. */
    _lamps(dt) {
        this.lampTimer -= dt;
        const cam = this.camera.position;
        if (this.lampTimer <= 0) {
            this.lampTimer = 0.25;
            const near = this.sources.map((s) => ({ s, d: (s.pos.x - cam.x) ** 2 + (s.pos.y - cam.y) ** 2 + (s.pos.z - cam.z) ** 2 })).sort((a, b) => a.d - b.d);
            this.lamps.forEach((L, i) => {
                const n = near[i];
                L.userData.src = n && n.d < 18 * 18 ? n.s : null;
                if (L.userData.src) {
                    // a lamp that changes hands snaps, but only while it is dark
                    if (L.intensity < 0.05) L.position.copy(L.userData.src.pos);
                    L.color.copy(L.userData.src.color);
                }
            });
        }
        for (const L of this.lamps) {
            const s = L.userData.src;
            L.intensity = damp(L.intensity, s ? s.power : 0, 5, dt);
            if (s) L.position.lerp(s.pos, 1 - Math.exp(-6 * dt));
        }
    }

    // ------------------------------------------------------------ touching things

    /** What a ray points at: { type: 'plot' | 'pool' | 'rope' | 'ground', ... , t } or null. */
    pick(ray) {
        const o = ray.ray.origin, d = ray.ray.direction;
        let best = null, bt = Infinity;
        const hit = ray.intersectObjects(this.hits, false)[0];
        if (hit && hit.distance < 40) {
            bt = hit.distance;
            best = { type: 'plot', plot: hit.object.userData.plot, t: bt };
        }
        const rp = ray.intersectObject(this.ropeHit, false)[0];
        if (rp && rp.distance < bt && rp.distance < 30) {
            bt = rp.distance;
            best = { type: 'rope', t: bt };
        }
        // the floor
        if (d.y < -1e-4) {
            const tg = (POOL.y - o.y) / d.y;
            const px = o.x + d.x * tg, pz = o.z + d.z * tg;
            if (tg > 0 && tg < bt && Math.hypot(px - POOL.x, pz - POOL.z) < POOL.r + 0.1) {
                bt = tg;
                best = { type: 'pool', point: new V3(px, POOL.y, pz), t: tg };
            } else {
                const t0 = -o.y / d.y;
                const x = o.x + d.x * t0, z = o.z + d.z * t0;
                if (t0 > 0 && t0 < bt && insideCave(x, z, 0.5)) {
                    bt = t0;
                    best = { type: 'ground', point: new V3(x, 0, z), t: t0 };
                }
            }
        }
        return best;
    }

    /** Somewhere to stand near (x, z), clear of everything, on the player's side of it. */
    _standNear(x, z, r) {
        const c = this.controls.pos;
        const base = Math.atan2(c.x - x, c.z - z);
        const free = (px, pz) => insideCave(px, pz, 0.9) && Math.hypot(px - POOL.x, pz - POOL.z) > POOL.r + 0.45 && !this.cols.some((q) => Math.hypot(px - q.x, pz - q.z) < q.r + 0.45);
        for (let k = 0; k < 18; k++) {
            for (const rr of [r, r + 0.5, r + 1]) {
                const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35;
                const px = x + Math.sin(a) * rr, pz = z + Math.cos(a) * rr;
                if (free(px, pz)) return { x: px, z: pz };
            }
        }
        return { x: c.x, z: c.z };
    }

    /** Go to a spot, then do something (at once if already there). */
    _goThen(x, z, r, reach, fn, faceX = x, faceZ = z) {
        const c = this.controls;
        const here = Math.hypot(c.pos.x - x, c.pos.z - z);
        const face = Math.atan2(-(faceX - c.pos.x), -(faceZ - c.pos.z));
        if (here < reach) {
            c.route = null;
            c.faceYaw = face;
            fn();
            return;
        }
        const st = this._standNear(x, z, r);
        c.walkTo([st], Math.atan2(-(faceX - st.x), -(faceZ - st.z)));
        c.route.then = fn;
    }

    /** A click or tap. */
    tap(ray) {
        if (this.state !== 'free') return null;
        const h = this.pick(ray);
        if (!h) return null;
        if (h.type === 'plot') {
            const p = h.plot;
            this._goThen(p.x, p.z, p.R + 0.75, REACH + p.R * 0.5, () => (p.ripe ? this.harvest(p) : this.waterPlot(p)));
        } else if (h.type === 'pool') {
            this._goThen(POOL.x, POOL.z, POOL.r + 0.9, POOL.r + 1.9, () => this.fillCan());
        } else if (h.type === 'rope') {
            this.climb();
        } else if (h.type === 'ground') {
            const pt = h.point;
            // clamp to the floor you can walk on
            this.controls.walkTo([{ x: pt.x, z: pt.z }]);
        }
        return h;
    }

    /** The tooltip for what the pointer is over, or null. */
    hoverNote(ray) {
        if (this.state !== 'free') {
            this.hover = null;
            return null;
        }
        const h = this.pick(ray);
        this.hover = h;
        if (!h) return null;
        const s = this.save;
        if (h.type === 'plot') {
            const p = h.plot, K = p.K;
            if (p.ripe) return { icon: K.icon, kicker: 'Ready to pick', title: K.name, desc: K.blurb, cta: 'Click to pick it →', accent: K.accent };
            const pct = Math.floor(p.g * 100);
            const drinking = p.water > 0;
            return {
                icon: K.icon,
                kicker: drinking ? `Growing · ${pct}%` : `Thirsty · ${pct}%`,
                title: K.name,
                desc: drinking ? `It is drinking, and will keep growing for about ${Math.ceil(p.water * WATER_TIME)} more seconds.` : 'It grows only while it has water.',
                cta: s.can > 0 ? 'Click to water it →' : 'Your can is empty: fill it at the pool',
                accent: K.accent,
            };
        }
        if (h.type === 'pool') return { icon: '\u{1F4A7}', kicker: 'The Glowing Well', title: 'The Glow Pool', desc: 'Cold, still and faintly luminous. It never runs dry.', cta: s.can < CAN_MAX ? 'Click to fill your can →' : 'Your can is full', accent: '#6dffe0' };
        if (h.type === 'rope') return { icon: '\u{1FAA2}', kicker: 'The Glowing Well', title: 'The rope', desc: 'It goes up to the garden, and it holds.', cta: 'Click to climb out →', accent: '#8affc8' };
        return null;
    }

    clearHover() {
        this.hover = null;
    }

    stepSurface() {
        return 'stone';
    }
}
