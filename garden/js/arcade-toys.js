// The plush in the claw machine: one toy for every game in the garden, each one a
// soft version of something from that game, chosen by the game's icon (a rocket
// for a space shooter, a dragon for a dragon game, a gem, a sword, a ghost, a
// little castle...) and dyed in its genre's colours. Every toy has a face and a
// swing tag with the game's icon on it. A toy is one merged mesh with vertex
// colours, plus its tag, so a machine full of them costs little to draw.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GENRES } from './genres.js';
import { rng, TAU } from './util.js';

// ------------------------------------------------------------------ which toy

const KINDS = {
    rocket: { name: 'Rocket', icons: '🚀🛰️🛸' },
    gem: { name: 'Gem', icons: '💎🔮' },
    sword: { name: 'Sword', icons: '⚔️🗡️🏹' },
    dragon: { name: 'Dragon', icons: '🐉🦖' },
    ghost: { name: 'Ghost', icons: '👻💀' },
    invader: { name: 'Space Invader', icons: '👾' },
    robot: { name: 'Robot', icons: '🤖⚙️🔧🕹️' },
    chick: { name: 'Chick', icons: '🥚🐣🕊️' },
    crown: { name: 'Crown', icons: '👑🏆' },
    bug: { name: 'Bug', icons: '🐛🐝🐜' },
    octopus: { name: 'Octopus', icons: '🐙🦀' },
    tree: { name: 'Tree', icons: '🌳🌿🌷🌴🏝️' },
    book: { name: 'Storybook', icons: '📖📜✒️🪶📼' },
    lantern: { name: 'Lantern', icons: '🏮🕯️🔥🎆' },
    castle: { name: 'Castle', icons: '🏰🏘️🗼🏚️' },
    snowman: { name: 'Snowman', icons: '⛄' },
    sweet: { name: 'Sweet', icons: '🍎🍬🧁' },
    car: { name: 'Racer', icons: '🏎️🏁🚂🚁⛵' },
    pick: { name: 'Pickaxe', icons: '⛏️' },
    potion: { name: 'Potion', icons: '⚗️⚕️🧬' },
    planet: { name: 'Planet', icons: '🪐🫧🪩🎱🌀◉🌃' },
    die: { name: 'Lucky Die', icons: '🃏🎰♟️🧩🎲' },
    block: { name: 'Block', icons: '📦🧱🖼️🎨📡' },
    star: { name: 'Star', icons: '✨💥⏳🧭⛳' },
    bear: { name: 'Bear', icons: '' },
};

/** The kind of toy for a game, from its icon (a bear when nothing fits). */
export function toyKind(game) {
    const icon = (game.icon || '').replace(/️/g, '');
    for (const [k, v] of Object.entries(KINDS)) if (v.icons && [...v.icons.replace(/️/g, '')].some((ch) => ch.length && icon.includes(ch) && ch.trim())) return k;
    return 'bear';
}

/** A friendly name for a game's toy: "Space Shooter Rocket". */
export function toyName(game) {
    const k = KINDS[toyKind(game)].name;
    const t = game.title.replace(/[’']s\b/g, '’s');
    return `${t} ${k}`.replace(/\s+/g, ' ');
}

// ------------------------------------------------------------------ building blocks

class Kit {
    constructor() {
        this.parts = [];
    }

    /** Adds a geometry in a colour at a place, turned (rx, ry, rz) and scaled (sx, sy, sz). */
    add(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
        let g = geo.index ? geo.toNonIndexed() : geo.clone();
        g.applyMatrix4(m);
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        const c = new THREE.Color(col);
        const n = g.attributes.position.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        this.parts.push(g);
        return this;
    }

    ball(r, col, x, y, z, sx = 1, sy = sx, sz = sx) {
        return this.add(SPH, col, x, y, z, 0, 0, 0, r * sx, r * sy, r * sz);
    }

    /** Two button eyes with a glint, rosy cheeks and a little smile, on a face at (0, y, z) looking +z. */
    face(y, z, s = 1, x = 0) {
        for (const sx of [-1, 1]) {
            this.ball(0.012 * s, 0x14101a, x + sx * 0.026 * s, y, z);
            this.ball(0.004 * s, 0xffffff, x + sx * 0.026 * s + 0.004 * s, y + 0.005 * s, z + 0.009 * s);
            this.ball(0.01 * s, 0xff8fa8, x + sx * 0.045 * s, y - 0.016 * s, z - 0.004 * s, 1.3, 0.7, 0.4);
        }
        this.add(SMILE, 0x14101a, x, y - 0.014 * s, z + 0.002, 0, 0, Math.PI, 0.011 * s);
        return this;
    }

    build() {
        const g = mergeGeometries(this.parts, false);
        g.computeBoundingBox();
        g.computeBoundingSphere();
        return g;
    }
}

const SPH = new THREE.SphereGeometry(1, 14, 10);
const SMILE = new THREE.TorusGeometry(1, 0.28, 5, 10, Math.PI);
const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d, 1, 1, 1);
const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
const tor = (R, r, seg = 18) => new THREE.TorusGeometry(R, r, 8, seg);
function starGeo(R, r, depth) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + Math.PI / 2, rr = i % 2 ? r : R;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.35, bevelSegments: 2, steps: 1 }).translate(0, 0, -depth / 2);
}
const STAR = starGeo(0.1, 0.05, 0.045);

/** Pastel: plush is never quite as loud as the box it came in. */
const soft = (hex, k = 0.25) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHex();
const deep = (hex, k = 0.35) => new THREE.Color(hex).lerp(new THREE.Color(0x10081a), k).getHex();

// ------------------------------------------------------------------ the toys
// Each builder makes a toy about 0.2 m tall standing on y = 0, facing +z, and
// returns where its tag goes.

const BUILD = {
    rocket(k, a, b) {
        k.add(cyl(0.06, 0.065, 0.14), soft(0xf4f0ff, 0.1), 0, 0.1, 0);
        k.add(cone(0.06, 0.08), soft(a), 0, 0.21, 0);
        k.add(SPH, soft(a), 0, 0.03, 0, 0, 0, 0, 0.065, 0.03, 0.065);
        for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * TAU + Math.PI;
            k.add(box(0.012, 0.06, 0.05), soft(b), Math.sin(ang) * 0.065, 0.045, Math.cos(ang) * 0.065, 0, ang, 0);
        }
        k.add(tor(0.028, 0.008), 0xd9a84a, 0, 0.125, 0.058);
        k.ball(0.026, 0x8fdcff, 0, 0.125, 0.052, 1, 1, 0.5);
        k.face(0.075, 0.064, 0.8);
        k.ball(0.022, 0xffb040, 0, -0.002, 0, 1, 0.6, 1);
        return { y: 0.09, x: 0.066, ry: Math.PI / 2 };
    },
    gem(k, a, b) {
        const g = new THREE.OctahedronGeometry(0.1, 0);
        k.add(g, soft(a, 0.15), 0, 0.12, 0, 0, Math.PI / 4, 0, 0.95, 1.15, 0.95);
        k.add(new THREE.OctahedronGeometry(0.06, 0), soft(b, 0.5), 0, 0.17, 0.025, 0, Math.PI / 4, 0, 0.6, 0.5, 0.4);
        k.face(0.11, 0.072, 0.9);
        return { y: 0.08, x: 0.06, ry: Math.PI / 4 };
    },
    sword(k, a, b) {
        k.add(box(0.05, 0.16, 0.025), 0xdfe6f2, 0, 0.12, 0, 0, 0, 0);
        k.add(cone(0.026, 0.04, 4), 0xdfe6f2, 0, 0.22, 0, 0, Math.PI / 4, 0, 1, 1, 0.5);
        k.add(box(0.13, 0.025, 0.04), soft(a), 0, 0.035, 0);
        k.ball(0.018, soft(b), -0.068, 0.035, 0);
        k.ball(0.018, soft(b), 0.068, 0.035, 0);
        k.add(cyl(0.015, 0.015, 0.05), deep(a, 0.4), 0, 0.0, 0, 0, 0, 0);
        k.ball(0.02, 0xd9a84a, 0, -0.03, 0);
        k.ball(0.014, 0xff3060, 0, 0.035, 0.02);
        k.face(0.13, 0.014, 0.75);
        return { y: 0.06, x: 0.06, ry: Math.PI / 2, lift: 0.05 };
    },
    dragon(k, a, b) {
        const c = soft(a, 0.2), belly = soft(b, 0.55);
        k.ball(0.08, c, 0, 0.075, -0.01, 1, 0.95, 1.05);
        k.ball(0.055, belly, 0, 0.065, 0.04, 1, 1.05, 0.6);
        k.ball(0.06, c, 0, 0.165, 0.02, 1.1, 0.95, 1);
        k.ball(0.032, belly, 0, 0.15, 0.065, 1.1, 0.8, 0.8);
        for (const sx of [-1, 1]) {
            k.add(cone(0.014, 0.04), 0xfff1c8, sx * 0.03, 0.225, 0.0, -0.3, 0, sx * -0.3);
            k.add(SPH, soft(b, 0.3), sx * 0.085, 0.13, -0.04, 0, sx * 0.6, sx * 0.5, 0.05, 0.035, 0.012);
            k.ball(0.022, c, sx * 0.045, 0.02, 0.04);
        }
        for (let i = 0; i < 3; i++) k.add(cone(0.014, 0.03), soft(b, 0.1), 0, 0.15 - i * 0.04, -0.08 + i * 0.005, -0.5, 0, 0);
        k.add(cone(0.03, 0.09), c, 0, 0.03, -0.1, -1.3, 0, 0);
        k.face(0.175, 0.078, 0.85);
        return { y: 0.08, x: 0.08, ry: Math.PI / 2 };
    },
    ghost(k, a) {
        const c = 0xf6f2ff;
        k.ball(0.075, c, 0, 0.12, 0, 1, 1.1, 1);
        k.add(cyl(0.075, 0.085, 0.08, 18), c, 0, 0.06, 0);
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * TAU;
            k.ball(0.024, c, Math.sin(ang) * 0.068, 0.022, Math.cos(ang) * 0.068);
        }
        for (const sx of [-1, 1]) k.ball(0.022, c, sx * 0.085, 0.09, 0.01, 1.2, 0.7, 0.8);
        k.ball(0.022, soft(a, 0.4), 0.0, 0.205, 0.0, 1.3, 0.4, 1.3);
        k.face(0.13, 0.072, 1.0);
        return { y: 0.06, x: 0.08, ry: Math.PI / 2 };
    },
    invader(k, a, b) {
        const c = soft(a, 0.15);
        k.add(box(0.15, 0.09, 0.08), c, 0, 0.1, 0);
        k.add(box(0.1, 0.035, 0.07), c, 0, 0.16, 0);
        for (const sx of [-1, 1]) {
            k.add(box(0.025, 0.06, 0.06), c, sx * 0.09, 0.075, 0);
            k.add(box(0.025, 0.05, 0.06), c, sx * 0.045, 0.03, 0);
            k.add(cyl(0.006, 0.006, 0.05), c, sx * 0.035, 0.2, 0, 0, 0, sx * -0.4);
            k.ball(0.012, soft(b), sx * 0.046, 0.225, 0);
        }
        k.face(0.11, 0.042, 1.0);
        return { y: 0.06, x: 0.1, ry: Math.PI / 2 };
    },
    robot(k, a, b) {
        const c = 0xcfd6e2;
        k.add(box(0.11, 0.09, 0.08), c, 0, 0.065, 0);
        k.add(box(0.12, 0.085, 0.09), soft(a, 0.35), 0, 0.155, 0);
        k.add(box(0.08, 0.04, 0.012), 0x1a2a3a, 0, 0.155, 0.046);
        for (const sx of [-1, 1]) {
            k.ball(0.011, 0x6fe8ff, sx * 0.02, 0.158, 0.054);
            k.add(cyl(0.015, 0.015, 0.07), c, sx * 0.07, 0.07, 0, 0, 0, sx * 0.3);
            k.ball(0.02, soft(b), sx * 0.085, 0.03, 0);
            k.add(cyl(0.01, 0.01, 0.025), c, sx * 0.065, 0.155, 0, 0, 0, Math.PI / 2);
        }
        k.add(cyl(0.005, 0.005, 0.04), 0x888899, 0, 0.215, 0);
        k.ball(0.014, 0xff4060, 0, 0.24, 0);
        k.add(box(0.04, 0.03, 0.01), soft(b), 0, 0.075, 0.042);
        k.add(SMILE, 0x14101a, 0, 0.145, 0.052, 0, 0, Math.PI, 0.012);
        return { y: 0.05, x: 0.06, ry: Math.PI / 2 };
    },
    chick(k, a) {
        const c = 0xffe36a;
        k.ball(0.085, 0xfff6e2, 0, 0.085, 0, 1, 1.15, 1);
        k.ball(0.06, c, 0, 0.17, 0.0);
        k.add(SPH, 0xfff6e2, 0, 0.12, 0.0, 0, 0, 0, 0.088, 0.02, 0.088);
        for (let i = 0; i < 8; i++) k.add(cone(0.015, 0.03, 4), 0xfff6e2, Math.sin((i / 8) * TAU) * 0.08, 0.135, Math.cos((i / 8) * TAU) * 0.08, 0, (i / 8) * TAU, 0);
        k.add(cone(0.016, 0.03), 0xff9f2a, 0, 0.165, 0.065, Math.PI / 2, 0, 0);
        k.ball(0.014, soft(a), 0, 0.235, -0.01, 1, 1.4, 0.6);
        k.face(0.18, 0.056, 0.85);
        return { y: 0.06, x: 0.085, ry: Math.PI / 2 };
    },
    crown(k, a, b) {
        const g = 0xffd24a;
        k.add(cyl(0.085, 0.085, 0.08, 24), g, 0, 0.05, 0);
        k.add(tor(0.085, 0.013, 24), soft(a), 0, 0.012, 0, Math.PI / 2, 0, 0);
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * TAU;
            k.add(cone(0.026, 0.07), g, Math.sin(ang) * 0.075, 0.12, Math.cos(ang) * 0.075);
            k.ball(0.014, soft(b, 0.1), Math.sin(ang) * 0.075, 0.16, Math.cos(ang) * 0.075);
        }
        k.ball(0.018, 0xff3060, 0, 0.05, 0.086, 1, 1, 0.6);
        k.face(0.065, 0.086, 0.75, 0);
        return { y: 0.05, x: 0.088, ry: Math.PI / 2 };
    },
    bug(k, a, b) {
        const c = soft(a, 0.2), s = deep(a, 0.6);
        k.ball(0.075, c, 0, 0.08, -0.02, 1, 0.95, 1.2);
        for (let i = 0; i < 3; i++) k.add(tor(0.07, 0.012), s, 0, 0.08, -0.04 + i * 0.035, 0, 0, 0, 1 - Math.abs(i - 1) * 0.1);
        k.ball(0.055, c, 0, 0.12, 0.07);
        for (const sx of [-1, 1]) {
            k.add(SPH, 0xeaf6ff, sx * 0.06, 0.16, -0.03, 0.3, sx * 0.4, sx * 0.6, 0.06, 0.035, 0.012);
            k.add(cyl(0.004, 0.004, 0.05), s, sx * 0.025, 0.19, 0.08, 0.3, 0, sx * -0.4);
            k.ball(0.012, soft(b), sx * 0.036, 0.215, 0.09);
        }
        k.face(0.125, 0.122, 0.8);
        return { y: 0.06, x: 0.075, ry: Math.PI / 2 };
    },
    octopus(k, a) {
        const c = soft(a, 0.25);
        k.ball(0.08, c, 0, 0.13, 0, 1, 1.1, 1);
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * TAU;
            k.ball(0.022, c, Math.sin(ang) * 0.07, 0.04, Math.cos(ang) * 0.07, 1, 1.6, 1);
            k.ball(0.016, c, Math.sin(ang) * 0.1, 0.015, Math.cos(ang) * 0.1);
        }
        k.ball(0.02, soft(a, 0.6), 0.04, 0.19, 0.05);
        k.face(0.125, 0.078, 1.0);
        return { y: 0.08, x: 0.08, ry: Math.PI / 2 };
    },
    tree(k, a, b) {
        k.add(cyl(0.03, 0.04, 0.09), 0x8a5a3a, 0, 0.045, 0);
        const g = soft(0x5fbf5f, 0.15);
        k.ball(0.075, g, 0, 0.15, 0);
        k.ball(0.05, g, -0.06, 0.12, 0.01);
        k.ball(0.05, g, 0.06, 0.12, 0.01);
        k.ball(0.045, soft(0x5fbf5f, 0.3), 0, 0.21, 0);
        for (let i = 0; i < 4; i++) k.ball(0.014, soft(i % 2 ? a : b, 0.1), Math.sin(i * 1.7) * 0.06, 0.14 + (i % 2) * 0.05, 0.05 + Math.cos(i * 1.7) * 0.02);
        k.face(0.05, 0.034, 0.6);
        return { y: 0.04, x: 0.04, ry: Math.PI / 2 };
    },
    book(k, a, b) {
        const c = soft(a, 0.1);
        k.add(box(0.15, 0.19, 0.025), c, 0, 0.095, -0.035);
        k.add(box(0.15, 0.19, 0.025), c, 0, 0.095, 0.035);
        k.add(box(0.14, 0.18, 0.05), 0xfff6e2, 0.008, 0.095, 0);
        k.add(cyl(0.025, 0.025, 0.19, 12), deep(a, 0.2), -0.075, 0.095, 0);
        k.add(box(0.07, 0.03, 0.006), soft(b, 0.2), 0.01, 0.16, 0.049);
        k.add(STAR, 0xffd24a, 0.01, 0.045, 0.049, 0, 0, 0, 0.2);
        k.face(0.105, 0.05, 1.0, 0.01);
        return { y: 0.05, x: 0.08, ry: Math.PI / 2 };
    },
    lantern(k, a) {
        const g = 0xd9a84a, glow = soft(a, 0.55);
        k.add(cyl(0.05, 0.06, 0.02, 12), g, 0, 0.01, 0);
        k.ball(0.07, glow, 0, 0.1, 0, 1, 1.2, 1);
        for (let i = 0; i < 4; i++) k.add(box(0.006, 0.16, 0.006), g, Math.sin((i / 4) * TAU + 0.785) * 0.066, 0.1, Math.cos((i / 4) * TAU + 0.785) * 0.066);
        k.add(cone(0.06, 0.04, 12), g, 0, 0.2, 0);
        k.add(tor(0.02, 0.005), g, 0, 0.23, 0);
        k.face(0.1, 0.072, 0.9);
        return { y: 0.05, x: 0.075, ry: Math.PI / 2 };
    },
    castle(k, a, b) {
        const st = 0xe4dcd0, roof = soft(a, 0.1);
        k.add(box(0.14, 0.11, 0.09), st, 0, 0.055, 0);
        for (const sx of [-1, 1]) {
            k.add(cyl(0.032, 0.032, 0.15, 12), st, sx * 0.075, 0.075, 0);
            k.add(cone(0.042, 0.07, 12), roof, sx * 0.075, 0.185, 0);
        }
        for (let i = -1; i <= 1; i++) k.add(box(0.025, 0.025, 0.09), st, i * 0.04, 0.122, 0);
        k.add(cyl(0.025, 0.025, 0.004, 12), 0x5a3a28, 0, 0.025, 0.046, Math.PI / 2, 0, 0, 1, 1, 1);
        k.add(box(0.05, 0.03, 0.004), 0x5a3a28, 0, 0.012, 0.046);
        k.add(box(0.002, 0.05, 0.002), 0x888888, 0.075, 0.24, 0);
        k.add(box(0.03, 0.02, 0.003), soft(b), 0.09, 0.255, 0);
        k.face(0.075, 0.047, 0.8);
        return { y: 0.05, x: 0.11, ry: Math.PI / 2 };
    },
    snowman(k, a) {
        k.ball(0.075, 0xffffff, 0, 0.07, 0);
        k.ball(0.055, 0xffffff, 0, 0.17, 0);
        k.add(tor(0.042, 0.016), soft(a), 0, 0.13, 0, Math.PI / 2, 0, 0);
        k.add(cone(0.012, 0.045), 0xff8a2a, 0, 0.165, 0.065, Math.PI / 2, 0, 0);
        k.add(cyl(0.045, 0.045, 0.012, 16), 0x22222a, 0, 0.22, 0);
        k.add(cyl(0.03, 0.032, 0.045, 16), 0x22222a, 0, 0.245, 0);
        for (let i = 0; i < 3; i++) k.ball(0.008, 0x22222a, 0, 0.1 - i * 0.03, 0.073);
        k.face(0.18, 0.05, 0.75);
        return { y: 0.06, x: 0.075, ry: Math.PI / 2 };
    },
    sweet(k, a, b) {
        // a cupcake with a cherry, the sweetest of the sweets
        k.add(cyl(0.075, 0.055, 0.08, 16), soft(b, 0.4), 0, 0.04, 0);
        k.ball(0.08, soft(a, 0.45), 0, 0.1, 0, 1, 0.6, 1);
        k.ball(0.06, soft(a, 0.45), 0, 0.14, 0, 1, 0.8, 1);
        k.ball(0.022, 0xe0203a, 0, 0.19, 0);
        k.add(cyl(0.003, 0.003, 0.03), 0x4a8a2a, 0.008, 0.215, 0, 0, 0, -0.3);
        for (let i = 0; i < 8; i++) k.add(box(0.012, 0.004, 0.004), [0xff6ad5, 0x5fe8ff, 0xffe94a, 0x7aff8a][i % 4], Math.sin(i * 2.3) * 0.05, 0.155, Math.cos(i * 2.3) * 0.05, 0, i, 0);
        k.face(0.05, 0.066, 0.8);
        return { y: 0.04, x: 0.07, ry: Math.PI / 2 };
    },
    car(k, a, b) {
        const c = soft(a, 0.15);
        k.add(box(0.2, 0.06, 0.11), c, 0, 0.055, 0);
        k.ball(0.06, c, -0.01, 0.1, 0, 1.3, 0.7, 0.9);
        k.add(box(0.06, 0.035, 0.1), 0x9fdcff, -0.01, 0.11, 0, 0, 0, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(cyl(0.028, 0.028, 0.025, 14), 0x22222a, sx * 0.065, 0.028, sz * 0.058, Math.PI / 2, 0, 0);
        k.add(box(0.012, 0.035, 0.11), soft(b), 0.1, 0.09, 0);
        k.face(0.065, 0.0, 0.8, 0.1);
        return { y: 0.06, x: 0.0, z: 0.056, ry: 0 };
    },
    pick(k, a) {
        k.add(cyl(0.014, 0.014, 0.2, 10), 0x9a6a3a, 0, 0.1, 0);
        k.add(SPH, 0xc8ccd8, 0, 0.2, 0, 0, 0, Math.PI / 2, 0.025, 0.11, 0.03);
        k.add(cone(0.025, 0.04, 8), 0xc8ccd8, 0.11, 0.19, 0, 0, 0, -Math.PI / 2 - 0.2);
        k.add(cone(0.025, 0.04, 8), 0xc8ccd8, -0.11, 0.19, 0, 0, 0, Math.PI / 2 + 0.2);
        k.add(tor(0.017, 0.006), soft(a), 0, 0.06, 0, Math.PI / 2, 0, 0);
        k.ball(0.04, soft(a, 0.3), 0, 0.03, 0, 1, 0.7, 1);
        k.face(0.2, 0.03, 0.55);
        return { y: 0.04, x: 0.04, ry: Math.PI / 2 };
    },
    potion(k, a, b) {
        k.ball(0.075, 0xe8f4ff, 0, 0.075, 0);
        k.ball(0.066, soft(a, 0.1), 0, 0.065, 0, 1, 0.85, 1);
        k.add(cyl(0.025, 0.03, 0.06, 12), 0xe8f4ff, 0, 0.16, 0);
        k.add(cyl(0.03, 0.026, 0.03, 12), 0xa87a4a, 0, 0.2, 0);
        k.ball(0.012, soft(b), 0.03, 0.1, 0.06);
        k.ball(0.008, soft(b), -0.025, 0.06, 0.065);
        k.face(0.08, 0.07, 0.9);
        return { y: 0.06, x: 0.075, ry: Math.PI / 2 };
    },
    planet(k, a, b) {
        k.ball(0.08, soft(a, 0.2), 0, 0.1, 0);
        k.add(tor(0.115, 0.012, 32), soft(b, 0.3), 0, 0.1, 0, Math.PI / 2 - 0.35, 0, 0.2, 1, 1, 0.35);
        k.ball(0.02, soft(a, 0.5), -0.04, 0.15, 0.05, 1, 0.6, 0.6);
        k.face(0.095, 0.078, 1.0);
        return { y: 0.04, x: 0.0, z: 0.0, ry: 0, hang: 0.13 };
    },
    die(k, a) {
        k.add(box(0.14, 0.14, 0.14), 0xfff8ee, 0, 0.07, 0);
        for (const [x, y] of [[-0.035, 0.105], [0.035, 0.035]]) k.ball(0.011, soft(a, 0.1), x, y, 0.071, 1, 1, 0.4);
        for (const [y, z] of [[0.035, -0.035], [0.105, 0.035], [0.07, 0]]) k.ball(0.011, soft(a, 0.1), 0.071, y, z, 0.4, 1, 1);
        k.face(0.075, 0.071, 0.85);
        return { y: 0.04, x: -0.072, ry: -Math.PI / 2 };
    },
    block(k, a, b) {
        k.add(box(0.14, 0.13, 0.12), soft(a, 0.15), 0, 0.065, 0);
        k.add(box(0.15, 0.02, 0.13), soft(b, 0.2), 0, 0.12, 0);
        k.ball(0.014, soft(b, 0.1), 0.04, 0.14, 0.03);
        k.ball(0.014, soft(b, 0.1), -0.04, 0.14, -0.03);
        k.face(0.07, 0.061, 1.0);
        return { y: 0.04, x: 0.072, ry: Math.PI / 2 };
    },
    star(k, a) {
        k.add(STAR, soft(a, 0.35), 0, 0.105, 0, 0, 0, 0, 1.05);
        k.face(0.105, 0.037, 0.95);
        return { y: 0.0, x: 0.0, z: 0.0, ry: 0, hang: 0.03 };
    },
    bear(k, a, b) {
        const c = soft(a, 0.35), m = soft(b, 0.65);
        k.ball(0.07, c, 0, 0.07, 0, 1, 1, 0.9);
        k.ball(0.045, m, 0, 0.065, 0.04, 1, 1.1, 0.5);
        k.ball(0.062, c, 0, 0.17, 0.01);
        k.ball(0.028, m, 0, 0.155, 0.06, 1.1, 0.8, 0.7);
        k.ball(0.009, 0x14101a, 0, 0.165, 0.083);
        for (const sx of [-1, 1]) {
            k.ball(0.024, c, sx * 0.05, 0.225, 0.0);
            k.ball(0.013, m, sx * 0.05, 0.225, 0.012);
            k.ball(0.024, c, sx * 0.068, 0.085, 0.02);
            k.ball(0.026, c, sx * 0.04, 0.018, 0.045);
        }
        k.face(0.18, 0.062, 0.8);
        return { y: 0.06, x: 0.072, ry: Math.PI / 2 };
    },
};

// ------------------------------------------------------------------ the tags

/** One canvas holding every game's icon, for the toys' swing tags. */
export function tagAtlas(games) {
    const n = Math.ceil(Math.sqrt(games.length));
    const cell = Math.min(128, Math.floor(2048 / n));
    const c = Object.assign(document.createElement('canvas'), { width: cell * n, height: cell * n });
    const x = c.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    games.forEach((g, i) => {
        const cx = (i % n) * cell + cell / 2, cy = Math.floor(i / n) * cell + cell / 2;
        x.fillStyle = '#fff6e2';
        x.beginPath();
        x.arc(cx, cy, cell * 0.47, 0, TAU);
        x.fill();
        x.strokeStyle = '#d9a84a';
        x.lineWidth = cell * 0.06;
        x.stroke();
        x.font = `${Math.round(cell * 0.56)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        x.fillStyle = '#222';
        x.fillText(g.icon || '★', cx, cy + cell * 0.04);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, n };
}

// ------------------------------------------------------------------ a toy

const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
const geoCache = new Map();

/**
 * A plush toy for game number `index` in the list.
 * @returns {THREE.Group} with userData { game, kind, name, r (radius), h (height) }
 */
export function makeToy(game, index, atlas) {
    const kind = toyKind(game);
    const genre = GENRES.find((g) => g.id === game.genre) ?? GENRES[0];
    const r = rng('toy-' + game.id);
    // two colours from the genre, nudged per game so no two are quite alike
    const a = new THREE.Color(genre.accent).offsetHSL((r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.1).getHex();
    const b = new THREE.Color(genre.accent2).offsetHSL((r() - 0.5) * 0.12, 0, 0).getHex();
    const key = game.id;
    let entry = geoCache.get(key);
    if (!entry) {
        const k = new Kit();
        const tag = BUILD[kind](k, a, b);
        entry = { geo: k.build(), tag };
        geoCache.set(key, entry);
    }
    const g = new THREE.Group();
    const body = new THREE.Mesh(entry.geo, bodyMat);
    g.add(body);
    const bb = entry.geo.boundingBox;
    g.userData = { game, kind, name: toyName(game), r: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2, h: bb.max.y, body };
    if (atlas) {
        // a little round tag on a thread, with the game's icon
        const n = atlas.n, i = index % (n * n);
        const u0 = (i % n) / n, v0 = 1 - (Math.floor(i / n) + 1) / n;
        const tg = new THREE.CircleGeometry(0.03, 18);
        const uv = tg.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) / n, v0 + uv.getY(j) / n);
        const t = entry.tag;
        const tagMesh = new THREE.Mesh(tg, tagMat(atlas));
        if (t.hang) {
            tagMesh.position.set(0.0, t.hang, 0.0);
            tagMesh.position.z = 0.04;
        } else tagMesh.position.set(t.x ?? 0, t.y + (t.lift ?? 0), t.z ?? 0);
        tagMesh.rotation.y = t.ry ?? 0;
        if (t.ry) tagMesh.position.x += Math.sign(t.x || 1) * 0.004;
        else tagMesh.position.z += 0.004;
        g.add(tagMesh);
        g.userData.tag = tagMesh;
    }
    return g;
}

const tagMats = new WeakMap();
function tagMat(atlas) {
    if (!tagMats.has(atlas)) tagMats.set(atlas, new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: atlas.tex, emissiveIntensity: 0.12 }));
    return tagMats.get(atlas);
}

export const TOY_KINDS = Object.keys(KINDS);
