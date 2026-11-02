// Rare finds on the sea floor: a sunken galleon, a treasure chest, a statue of
// a sea goddess, a broken robot, a magic sword in a stone, a drowned temple, a
// giant anchor, an old diving helmet and a message in a bottle. About one
// chunk of floor in twenty-odd holds one, chosen by where it is (so it is
// always there when you come back). The stone, wood and metal are merged with
// the reef's own material, so they catch the caustics and the murk like
// everything else; the parts that glow (gold, the goddess's lamp, the sword,
// the robot's eye) are their own meshes, with a halo, and are animated.

import * as THREE from 'three';
import { rng, clamp, fbm2, TAU } from './util.js';
import { softGlow } from './textures.js';
import { Acc, CHUNK, seabedY, rockGeo, rockColor, UNIT_CYL, UNIT_SPH, UNIT_BOX, UNIT_CONE } from './sea-reef.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);
const CHANCE = 0.045;          // of a chunk holding a find

const BOTTLE_NOTES = [
    '“Whoever finds this: the tea at the hub is excellent. Say hello to the fox for me.”',
    '“Day twelve on the island. The statues are very good listeners.”',
    '“If found, please return to the sea. Thank you.”',
    '“The clock tower is three minutes fast. Don’t tell it.”',
    '“I hid something under the lighthouse. Not telling what.”',
    '“To the submarine captain: you are doing wonderfully. Mind the kelp.”',
    '“Recipe for happiness: one rowboat, one sunset, no hurry.”',
];

/**
 * see: how near you must come for it to go in the log. radius: for clicks.
 * cy: height of its middle above the floor.
 */
export const WONDERS = [
    {
        id: 'galleon', name: 'The Sunken Galleon', sub: 'The pirate ship Drowsy Marigold', rarity: 'Legendary', weight: 1.5, see: 45, radius: 9, cy: 1.5,
        fact: 'Her captain was said to be so polite that he asked permission before every boarding. Her treasure has never been found, though everyone has looked in the barrels.',
        where: 'Lying on her side where she went down.', build: galleon,
    },
    {
        id: 'chest', name: 'A Treasure Chest', sub: 'Pieces of eight, and rather a lot of rubies', rarity: 'Rare', weight: 5, see: 18, radius: 1.4, cy: 0.5,
        fact: 'Someone buried it with great care and then, it seems, lost the map. The lid rusted open long ago, and the fish have been admiring the gold ever since.',
        where: 'Half sunk in the sand.', build: chest,
    },
    {
        id: 'goddess', name: 'The Sea Goddess', sub: 'Marble, older than the island', rarity: 'Legendary', weight: 2.5, see: 32, radius: 2.6, cy: 2.6,
        fact: 'A goddess of tides and of lost things, holding up a lamp that has never once gone out. Sailors used to leave her a shell for luck.',
        where: 'Standing where a harbour once was.', build: goddess,
    },
    {
        id: 'robot', name: 'A Broken Robot', sub: 'Model R-7, “Rivet”', rarity: 'Rare', weight: 3, see: 24, radius: 1.9, cy: 1,
        fact: 'Rivet was built to tidy the sea floor and has been doing it very slowly ever since, one pebble at a time. One eye still blinks hello. It would like its other arm back.',
        where: 'Sitting down for a rest that has lasted years.', build: robot,
    },
    {
        id: 'sword', name: 'The Tide-Blade', sub: 'A magic sword, set in stone', rarity: 'Legendary', weight: 2, see: 26, radius: 1.6, cy: 1.4,
        fact: 'It glows a little brighter whenever someone kind swims past. Plenty have tried to pull it out; it is said to come free only for someone who does not want it.',
        where: 'In a ring of stones that nobody laid.', build: sword,
    },
    {
        id: 'temple', name: 'The Drowned Temple', sub: 'Columns of a city the sea took back', rarity: 'Rare', weight: 3, see: 36, radius: 6.5, cy: 2,
        fact: 'Its floor is a map of stars that nobody can find in the sky any more. A pearl on the altar still keeps a faint light.',
        where: 'On a rise in the floor, open to the water.', build: temple,
    },
    {
        id: 'anchor', name: 'A Giant Anchor', sub: 'From a ship much bigger than any galleon', rarity: 'Rare', weight: 4, see: 26, radius: 3, cy: 2,
        fact: 'Nobody knows which ship it belonged to, or how that ship managed to stay put without it.',
        where: 'Leaning where it dropped, its chain running off into the murk.', build: anchor,
    },
    {
        id: 'helmet', name: 'A Diving Helmet', sub: 'Brass, with three little windows', rarity: 'Rare', weight: 5, see: 14, radius: 0.9, cy: 0.35,
        fact: 'Before scuba, divers wore helmets like this one, with air pumped down to them by hand from the boat above. This one has been empty for a long time.',
        where: 'Rolled into the sand.', build: helmet,
    },
    {
        id: 'bottle', name: 'A Message in a Bottle', sub: 'Corked, with a rolled-up note inside', rarity: 'Rare', weight: 5, see: 12, radius: 0.8, cy: 0.15,
        fact: '', where: 'Washed down from the surface.', build: bottle,
    },
];

/** What, if anything, lies in chunk (ci, cj). Cheap: no geometry. */
export function wonderAt(ci, cj) {
    // the reef round the fountain is left to the fish
    if (Math.abs(ci) <= 1 && Math.abs(cj) <= 1) return null;
    const r = rng(`wonder:${ci}:${cj}`);
    if (r() > CHANCE) return null;
    let total = 0;
    for (const d of WONDERS) total += d.weight;
    let k = r() * total, def = WONDERS[0];
    for (const d of WONDERS) if ((k -= d.weight) <= 0) { def = d; break; }
    return { def, x: ci * CHUNK + 7 + r() * (CHUNK - 14), z: cj * CHUNK + 7 + r() * (CHUNK - 14), yaw: r() * TAU, seed: Math.floor(r() * 1e9) };
}

// ------------------------------------------------------------------ building

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
/** A local transform: position, rotation (XYZ), scale. */
function L(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    return new THREE.Matrix4().compose(new V3(x, y, z), _q, new V3(sx, sy, sz));
}
/** A transform that stands a unit piece (y 0..1) between two points, `rad` thick. */
function between(a, b, rad) {
    const d = new V3().subVectors(b, a);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
    return new THREE.Matrix4().compose(a, q, new V3(rad, d.length(), rad));
}

const ALGAE = C('#4c6e3a');
/** A colour streaked with weed and silt on its upper faces. */
function weathered(hex, amt = 0.5, seed = 0) {
    const base = C(hex), tmp = new THREE.Color();
    return (v, n) => tmp.copy(base).lerp(ALGAE, clamp(n.y, 0, 1) * amt * (0.4 + 0.6 * (fbm2(v.x * 2.3 + seed, v.z * 2.3 + v.y * 1.7, 2) + 0.5)));
}

function twoSided(g) {
    g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, idx = g.index.array;
    const count = p.length / 3;
    const pos = new Float32Array(p.length * 2), nor = new Float32Array(n.length * 2);
    pos.set(p);
    pos.set(p, p.length);
    nor.set(n);
    for (let i = 0; i < n.length; i++) nor[n.length + i] = -n[i];
    const ind = Array.from(idx);
    for (let k = 0; k < idx.length; k += 3) ind.push(idx[k] + count, idx[k + 2] + count, idx[k + 1] + count);
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setIndex(ind);
    g.dispose();
    return out;
}

/** A surface from a (u, v) -> [x, y, z] function on an nu × nv grid, seen from both sides. */
function sheet(nu, nv, fn) {
    const pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return twoSided(g);
}

/** Build a find from wonderAt()'s spec, with `material` the reef's. */
export function buildWonder(spec, material) {
    const def = spec.def;
    const floor = seabedY(spec.x, spec.z);
    const outer = new THREE.Group();
    outer.position.set(spec.x, floor, spec.z);
    outer.rotation.y = spec.yaw;
    const group = new THREE.Group();
    outer.add(group);
    outer.updateMatrixWorld();
    const ctx = {
        r: rng(spec.seed), acc: new Acc(), group, floor,
        M0: outer.matrixWorld.clone(), solids: [], updaters: [], mats: [],
        /** tilt and settle the whole find (once): merged and glowing parts alike */
        pose(m) {
            this.M0.multiply(m);
            group.matrix.multiply(m);
            group.matrix.decompose(group.position, group.quaternion, group.scale);
        },
        /** a merged piece, in the find's own frame */
        put(geo, local, o) {
            this.acc.add(geo, this.M0.clone().multiply(local), o);
        },
        /** something the hull must not pass through */
        solid(x, y, z, r) {
            const w = new V3(x, y, z).applyMatrix4(this.M0);
            this.solids.push({ x: w.x, y: w.y, z: w.z, r });
        },
        /** a glowing piece: its own mesh */
        glow(geo, hex, intensity, local, extra = {}) {
            const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.2, ...extra });
            this.mats.push(m);
            const mesh = new THREE.Mesh(geo, m);
            mesh.applyMatrix4(local);
            group.add(mesh);
            return mesh;
        },
        halo(hex, size, x, y, z, opacity = 0.5) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: hex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
            s.scale.set(size, size, 1);
            s.position.set(x, y, z);
            group.add(s);
            return s;
        },
    };
    const extra = def.build(ctx) || {};
    const mesh = new THREE.Mesh(ctx.acc.build(), material);
    mesh.matrixAutoUpdate = false;
    const root = new THREE.Group();
    root.add(mesh, outer);
    const at = new V3(0, def.cy, 0).applyMatrix4(ctx.M0);
    return {
        def, root, pos: at, radius: def.radius, solids: ctx.solids, ...extra,
        logged: false, pinged: false,
        update(t, night) {
            for (const f of ctx.updaters) f(t, night);
        },
        dispose() {
            root.traverse((o) => {
                o.geometry?.dispose();
                if (o.material && o.material !== material) {
                    if (o.material.map && o.material.map !== softGlow()) o.material.map.dispose();
                    o.material.dispose();
                }
            });
        },
    };
}

// ------------------------------------------------------------------ the finds

function galleon(c) {
    const { r } = c;
    // she lies over on her side, keel half in the sand
    c.pose(L(0, 0.2, 0, 0.38, 0, 0.05));
    const wood = weathered('#5a3d24', 0.55, 3), dark = weathered('#3a2716', 0.4, 7), sailCol = C('#b3a47e');
    const width = (t) => 2.6 * (t < 0.12 ? 0.7 + (0.3 * t) / 0.12 : 1 - Math.pow(Math.max(0, (t - 0.5) / 0.5), 1.6) * 0.96);
    const deck = (t) => 1 + (t < 0.22 ? 1.4 * (1 - Math.max(0, (t - 0.15) / 0.07)) : 0) + Math.max(0, (t - 0.85) / 0.15) * 0.7;
    const keel = (t) => -2.1 * (0.35 + 0.65 * Math.sin(Math.PI * clamp(t * 1.04, 0, 1)));
    const X = (t) => -9 + t * 18;
    // the hull: a shell round from one rail, under the keel, to the other
    c.put(sheet(20, 10, (u, v) => {
        const th = v * Math.PI, w = width(u);
        return [X(u), deck(u) - (deck(u) - keel(u)) * Math.sin(th), w * Math.cos(th)];
    }), new THREE.Matrix4(), { colorFn: (v, n) => wood(v, n).multiplyScalar(0.85 + 0.15 * Math.sin(v.y * 9)) });
    c.put(sheet(20, 4, (u, v) => [X(u), deck(u) - 0.25, width(u) * (v * 2 - 1) * 0.97]), new THREE.Matrix4(), { colorFn: (v, n) => dark(v, n).multiplyScalar(0.9 + 0.1 * Math.sin(v.z * 12)) });
    // the stern: a transom and a cabin, its windows still faintly lit
    c.put(UNIT_BOX, L(-8.9, keel(0) + 0.3, 0, 0, 0, 0, 0.3, deck(0) - keel(0) + 0.4, width(0) * 2), { colorFn: dark });
    c.put(UNIT_BOX, L(-7.4, deck(0.05) - 0.2, 0, 0, 0, 0, 3, 1.5, 4.2), { colorFn: wood });
    const windows = [];
    for (const z of [-1.2, 0, 1.2]) windows.push(c.glow(new THREE.PlaneGeometry(0.6, 0.5), '#ffcf70', 0.4, L(-8.93, deck(0.05) + 0.6, z, 0, -Math.PI / 2, 0), { side: THREE.DoubleSide }));
    // masts: the main standing, the fore snapped off, the mizzen short
    const d1 = deck(0.55);
    c.put(UNIT_CYL, L(1, d1 - 0.3, 0, 0, 0, 0, 0.24, 10, 0.24), { colorFn: wood });
    c.put(UNIT_CYL, L(1, d1 + 7.4, -3, Math.PI / 2, 0, 0, 0.1, 6, 0.1), { colorFn: dark });
    c.put(new THREE.TorusGeometry(0.55, 0.12, 6, 14).rotateX(Math.PI / 2), L(1, d1 + 8.4, 0), { colorFn: dark });
    const d2 = deck(0.8);
    c.put(UNIT_CYL, L(5.4, d2 - 0.3, 0, 0, 0, 0.1, 0.21, 3.2, 0.21), { colorFn: wood });
    c.put(UNIT_CONE, L(5.1, d2 + 2.9, 0, 0, 0, 0.1, 0.2, 0.7, 0.2), { colorFn: wood });
    c.put(UNIT_CYL, L(-5, deck(0.22) - 0.3, 0, 0, 0, 0, 0.18, 5.5, 0.18), { colorFn: wood });
    // a tattered sail, still hanging from the main yard
    const sail = sheet(7, 6, (u, v) => {
        const tear = v > 0.6 && Math.sin(u * 17) > 0.3 ? (v - 0.6) * 1.2 : 0;
        return [Math.sin(u * 3 + v * 2) * 0.25 + v * v * 0.5, -v * 4.4 + tear, (u - 0.5) * 5.6];
    });
    c.put(sail, L(1.2, d1 + 7.3, 0), { colorFn: (v) => sailCol.clone().multiplyScalar(0.75 + 0.25 * Math.sin(v.z * 3 + v.y)), sway: 0.35, base: c.floor - 2, H: 14 });
    // cannon at the gun ports
    for (const t of [0.4, 0.55, 0.7]) for (const sd of [-1, 1]) c.put(UNIT_CYL, L(X(t), 0.25, sd * (width(t) - 0.25), sd * Math.PI / 2, 0, 0, 0.13, 0.9, 0.13), { color: C('#2a2a2e') });
    c.put(UNIT_BOX, L(-9.1, keel(0) + 0.2, 0, 0, 0, 0, 0.9, 2.6, 0.2), { colorFn: dark });
    // a pirate flag, rather the worse for wear
    const cv = document.createElement('canvas');
    cv.width = 96;
    cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#121212';
    g.fillRect(0, 0, 96, 64);
    g.fillStyle = '#e8e2d0';
    g.beginPath();
    g.arc(48, 26, 12, 0, TAU);
    g.fill();
    g.fillRect(41, 32, 14, 9);
    g.fillStyle = '#121212';
    g.beginPath();
    g.arc(43, 25, 3.5, 0, TAU);
    g.arc(53, 25, 3.5, 0, TAU);
    g.fill();
    g.strokeStyle = '#e8e2d0';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(26, 46);
    g.lineTo(70, 60);
    g.moveTo(70, 46);
    g.lineTo(26, 60);
    g.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const fm = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1, 6, 1).translate(0.75, 0, 0), fm);
    flag.position.set(1, d1 + 9.2, 0);
    flag.rotation.y = Math.PI / 2;
    c.group.add(flag);
    // barrels that rolled out of the hold
    for (let k = 0; k < 3; k++) c.put(UNIT_CYL, L(-2 + k * 2.4 + r(), -0.6 + r() * 0.3, 4.2 + r() * 1.5, Math.PI / 2, r() * TAU, 0, 0.42, 1.1, 0.42), { colorFn: wood });
    for (const x of [-8, -5, -2, 1, 4, 7]) c.solid(x, -0.2, 0, 2.7);
    c.solid(1, d1 + 3, 0, 0.9);
    c.solid(1, d1 + 6.5, 0, 0.9);
    c.updaters.push((t, night) => {
        flag.rotation.y = Math.PI / 2 + Math.sin(t * 1.3) * 0.25;
        for (const [i, w] of windows.entries()) w.material.emissiveIntensity = (0.3 + night * 1.6) * (0.75 + 0.25 * Math.sin(t * 2.3 + i * 1.7));
    });
}

function chest(c) {
    const { r } = c;
    c.pose(L(0, -0.15, 0, 0.06, 0, -0.08));
    const wood = weathered('#6a4426', 0.45, 2), iron = C('#2e2c2a');
    c.put(UNIT_BOX, L(0, 0, 0, 0, 0, 0, 1.2, 0.62, 0.76), { colorFn: wood });
    for (const x of [-0.46, 0, 0.46]) c.put(UNIT_BOX, L(x, -0.01, 0, 0, 0, 0, 0.08, 0.64, 0.78), { color: iron });
    // the lid, rusted open on its hinges
    const lid = new THREE.CylinderGeometry(0.38, 0.38, 1.2, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0, 0.38);
    c.put(lid, L(0, 0.62, -0.38, -1.25, 0, 0), { colorFn: wood });
    c.put(UNIT_SPH, L(0, 0.42, 0.39, 0, 0, 0, 0.07, 0.09, 0.03), { color: C('#c8963e'), glow: 0.3 });
    // the gold
    const gold = '#ffbf40';
    c.glow(new THREE.SphereGeometry(0.5, 14, 6, 0, TAU, 0, Math.PI / 2), gold, 0.7, L(0, 0.58, 0, 0, 0, 0, 0.56, 0.26, 0.34), { metalness: 0.8, roughness: 0.3 });
    const coin = new THREE.CylinderGeometry(0.055, 0.055, 0.012, 12);
    for (let k = 0; k < 16; k++) c.glow(coin, gold, 0.6, L((r() - 0.5) * 1.6, 0.17 + r() * 0.05, 0.5 + r() * 1.1, r() * 0.6, r() * TAU, r() * 0.6), { metalness: 0.8, roughness: 0.3 });
    const gem = new THREE.OctahedronGeometry(0.07);
    for (const [hex, x, z] of [['#ff2a5a', 0.3, 0.7], ['#2aff8a', -0.4, 0.9], ['#3a8aff', 0.1, 1.3], ['#ff2a5a', 0.2, 0.62]]) c.glow(gem, hex, 0.9, L(x, 0.65 + (z < 0.8 ? 0 : -0.45), z < 0.8 ? 0.05 : z, r(), r(), r()));
    const halo = c.halo('#ffd27a', 2.6, 0, 0.8, 0.3, 0.35);
    const twinkle = c.halo('#ffffff', 0.4, 0, 0.7, 0.6, 0);
    c.updaters.push((t) => {
        halo.material.opacity = 0.28 + 0.1 * Math.sin(t * 1.7);
        const ph = (t * 0.7) % 1;
        twinkle.material.opacity = Math.sin(ph * Math.PI) ** 4 * 0.9;
        if (ph < 0.02) twinkle.position.set((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.2, Math.random() * 0.9);
    });
}

function goddess(c) {
    c.pose(L(0, -0.4, 0, 0.07, 0, 0.04));
    const marble = weathered('#ddd6c8', 0.6, 5), seed = c.r() * 9;
    c.put(UNIT_BOX, L(0, 0, 0, 0, 0, 0, 2.3, 1.1, 2.3), { colorFn: marble });
    c.put(UNIT_BOX, L(0, 1.05, 0, 0, 0, 0, 1.7, 0.18, 1.7), { colorFn: marble });
    const robe = new THREE.LatheGeometry([[0.78, 0], [0.72, 0.4], [0.58, 1.4], [0.44, 2.2], [0.36, 2.55], [0, 2.58]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
    c.put(robe, L(0, 1.2, 0), { colorFn: weathered('#ddd6c8', 0.7, seed) });
    const torso = new THREE.LatheGeometry([[0.36, 0], [0.42, 0.35], [0.33, 0.78], [0.15, 0.95], [0, 0.97]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    c.put(torso, L(0, 3.72, 0, 0, 0, 0, 1, 1, 0.8), { colorFn: marble });
    c.put(UNIT_SPH, L(0, 4.92, 0.02, 0, 0, 0, 0.25, 0.29, 0.26), { colorFn: marble });
    c.put(UNIT_SPH, L(0, 5.0, -0.18, 0, 0, 0, 0.16), { colorFn: marble });
    // a crown of shells
    for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI - Math.PI / 2;
        c.put(UNIT_CONE, L(Math.sin(a) * 0.22, 5.12, Math.cos(a) * 0.12, Math.cos(a) * -0.4, 0, Math.sin(a) * 0.5, 0.06, 0.2, 0.06), { color: C('#f0d8c8') });
    }
    // arms raised, holding up the lamp
    const orbAt = new V3(0, 5.75, 0.25);
    for (const sd of [-1, 1]) {
        const sh = new V3(sd * 0.36, 4.42, 0), hand = new V3(sd * 0.14, 5.5, 0.22);
        c.put(UNIT_CYL, between(sh, hand, 0.1), { colorFn: marble });
    }
    const orb = c.glow(new THREE.SphereGeometry(0.28, 20, 14), '#8ff6ff', 1.3, L(orbAt.x, orbAt.y, orbAt.z));
    const halo = c.halo('#8ff6ff', 4.2, orbAt.x, orbAt.y, orbAt.z, 0.5);
    // shells left for luck
    for (let k = 0; k < 12; k++) {
        const a = c.r() * TAU, d = 1.4 + c.r() * 1.2;
        c.put(UNIT_CONE, L(Math.cos(a) * d, 0.4, Math.sin(a) * d, Math.PI / 2 - 0.3, a, 0, 0.09, 0.16, 0.09), { color: C(c.r() < 0.5 ? '#f4e2d0' : '#f0b8a8') });
    }
    c.solid(0, 1.2, 0, 1.5);
    c.solid(0, 3.2, 0, 0.9);
    c.solid(0, 4.9, 0, 0.6);
    c.updaters.push((t, night) => {
        const p = 0.5 + 0.5 * Math.sin(t * 0.9);
        orb.material.emissiveIntensity = 1.1 + p * 0.6 + night * 0.6;
        halo.material.opacity = 0.35 + p * 0.2 + night * 0.25;
    });
}

function robot(c) {
    const body = (h) => {
        const base = C('#7c8c8a'), rust = C('#8a4a2a'), tmp = new THREE.Color();
        return (v) => tmp.copy(base).lerp(rust, clamp(fbm2(v.x * 3 + h, v.y * 3 + v.z * 2, 2) * 1.6 + 0.2, 0, 0.85));
    };
    const dark = C('#2a2e30');
    // sitting, slumped back against nothing in particular
    const torso = L(0, 0.35, 0, -0.22, 0, 0.08);
    c.put(UNIT_BOX, torso.clone().multiply(L(0, 0, 0, 0, 0, 0, 1.2, 1.3, 0.9)), { colorFn: body(1) });
    // the chest panel, its lights still blinking
    const lights = [];
    for (const [i, hex] of ['#40ff80', '#ffb030', '#40ff80'].entries()) lights.push(c.glow(new THREE.BoxGeometry(0.1, 0.1, 0.04), hex, 0.8, torso.clone().multiply(L(-0.25 + i * 0.25, 0.85, 0.46))));
    c.put(UNIT_BOX, torso.clone().multiply(L(0, 0.35, 0.44, 0, 0, 0, 0.8, 0.35, 0.05)), { color: dark });
    // the head, lolling to one side
    const head = torso.clone().multiply(L(0.05, 1.35, 0.05, 0.12, 0.18, 0.38));
    c.put(UNIT_BOX, head.clone().multiply(L(0, 0, 0, 0, 0, 0, 0.82, 0.66, 0.72)), { colorFn: body(4) });
    const eye = c.glow(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16).rotateX(Math.PI / 2), '#ff7a3a', 1.4, head.clone().multiply(L(-0.18, 0.4, 0.37)));
    c.put(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16).rotateX(Math.PI / 2), head.clone().multiply(L(0.18, 0.4, 0.37)), { color: C('#101416') });
    for (let k = 0; k < 3; k++) c.put(UNIT_BOX, head.clone().multiply(L(0, 0.12 + k * 0.06, 0.37, 0, 0, 0, 0.4, 0.025, 0.02)), { color: dark });
    // the antenna, bent
    const a0 = new V3(0, 0.66, 0).applyMatrix4(head), a1 = new V3(0.05, 1.05, 0).applyMatrix4(head), a2 = a1.clone().add(new V3(0.35, 0.1, 0));
    c.put(UNIT_CYL, between(a0, a1, 0.025), { color: dark });
    c.put(UNIT_CYL, between(a1, a2, 0.022), { color: dark });
    const tip = c.glow(new THREE.SphereGeometry(0.06, 10, 8), '#ff3030', 1, L(a2.x, a2.y, a2.z));
    // legs out in front
    for (const sd of [-1, 1]) {
        c.put(UNIT_CYL, L(sd * 0.32, 0.22, 0.2, Math.PI / 2, 0, 0, 0.18, 1.3, 0.18), { colorFn: body(sd + 6) });
        c.put(UNIT_BOX, L(sd * 0.32, 0, 1.5, 0, 0, 0, 0.4, 0.3, 0.5), { colorFn: body(sd + 8) });
    }
    // one arm resting on the sand; the other came off and lies a little way away
    const sh = new V3(0.72, 1.25, -0.1).applyMatrix4(torso), hand = new V3(1.15, 0.12, 0.5);
    c.put(UNIT_CYL, between(sh, hand, 0.12), { colorFn: body(3) });
    for (const sd of [-1, 1]) c.put(UNIT_BOX, L(hand.x + 0.1, 0.05, hand.z + sd * 0.08, 0, 0, -0.6, 0.06, 0.25, 0.05), { color: dark });
    c.put(UNIT_CYL, L(2.2, 0.12, 0.9, Math.PI / 2, 0.6, 0, 0.12, 1.1, 0.12), { colorFn: body(9) });
    c.put(UNIT_BOX, L(2.6, 0.05, 1.7, 0, 0.6, 0, 0.3, 0.12, 0.2), { color: dark });
    const spark = c.halo('#bfe8ff', 0.6, -0.65, 1.55, 0, 0);
    c.solid(0, 1, 0, 1.3);
    c.updaters.push((t, night) => {
        // the good eye blinks hello every few seconds
        const blink = (t % 4.3) < 0.15 ? 0.1 : 1;
        eye.material.emissiveIntensity = (1.1 + 0.3 * Math.sin(t * 7) + night * 0.6) * blink;
        tip.material.emissiveIntensity = Math.sin(t * 3) > 0.6 ? 1.6 : 0.2;
        for (const [i, l] of lights.entries()) l.material.emissiveIntensity = Math.sin(t * (1.3 + i * 0.7) + i) > 0 ? 1.2 : 0.15;
        const s = (t * 0.37) % 1;
        spark.material.opacity = s < 0.05 ? Math.random() * 0.9 : 0;
    });
}

function sword(c) {
    const seed = c.r() * 50;
    const rock = rockGeo(seed);
    c.put(rock, L(0, 0.1, 0, 0, c.r() * TAU, 0, 1.15, 0.75, 1.05), { colorFn: rockColor(seed) });
    rock.dispose();
    // the blade, glowing, its point in the stone
    const pose = L(0.05, 0, 0, 0, 0.4, 0.14);
    const bladeGeo = new THREE.BoxGeometry(0.16, 2.1, 0.035, 1, 6, 1);
    const p = bladeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y < -0.75) p.setX(i, p.getX(i) * ((y + 1.05) / 0.3));
    }
    bladeGeo.computeVertexNormals();
    const blade = c.glow(bladeGeo, '#9ff8ff', 1.4, pose.clone().multiply(L(0, 1.35, 0)), { metalness: 0.6, roughness: 0.15 });
    c.put(UNIT_BOX, pose.clone().multiply(L(0, 2.38, 0, 0, 0, 0, 0.78, 0.1, 0.13)), { color: C('#e0b040'), glow: 0.4 });
    c.put(UNIT_CYL, pose.clone().multiply(L(0, 2.47, 0, 0, 0, 0, 0.05, 0.5, 0.05)), { color: C('#5a3020') });
    const pommel = c.glow(new THREE.SphereGeometry(0.085, 12, 10), '#c070ff', 1.2, pose.clone().multiply(L(0, 3.02, 0)));
    const halo = c.halo('#7ff0ff', 3.4, 0.1, 1.6, 0, 0.45);
    // a ring of runes in the sand, and the stones that keep it
    const ring = c.glow(new THREE.TorusGeometry(2.1, 0.035, 4, 64).rotateX(Math.PI / 2), '#7ff0ff', 0.6, L(0, 0.08, 0));
    for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        const g = rockGeo(seed + k, 0);
        c.put(g, L(Math.cos(a) * 2.6, 0.1, Math.sin(a) * 2.6, 0, a, 0, 0.3, 0.35 + c.r() * 0.2, 0.3), { colorFn: rockColor(seed + k) });
        g.dispose();
    }
    c.solid(0, 0.5, 0, 1.1);
    c.updaters.push((t, night) => {
        const p2 = 0.5 + 0.5 * Math.sin(t * 1.4);
        blade.material.emissiveIntensity = 1.1 + p2 * 0.7 + night * 0.4;
        pommel.material.emissiveIntensity = 1 + 0.5 * Math.sin(t * 2.1);
        halo.material.opacity = 0.3 + p2 * 0.25 + night * 0.2;
        ring.material.emissiveIntensity = 0.4 + 0.4 * Math.sin(t * 0.8) + night * 0.5;
    });
}

function temple(c) {
    const { r } = c;
    const marble = weathered('#d4cfc2', 0.65, r() * 9);
    c.put(new THREE.CylinderGeometry(6, 6.4, 0.6, 28), L(0, -0.1, 0), { colorFn: marble });
    c.put(new THREE.CylinderGeometry(4.4, 4.4, 0.04, 28), L(0, 0.21, 0), { color: C('#6a7a8a') });
    const shaft = new THREE.CylinderGeometry(0.42, 0.48, 1, 14).translate(0, 0.5, 0);
    const N = 8, R = 4.6, heights = [];
    for (let k = 0; k < N; k++) {
        const a = (k / N) * TAU, x = Math.cos(a) * R, z = Math.sin(a) * R;
        const roll = r();
        const h = roll < 0.4 ? 5.6 : roll < 0.85 ? 1.2 + r() * 2.6 : 0.4;
        heights.push(h);
        c.put(UNIT_BOX, L(x, 0.2, z, 0, a, 0, 1.15, 0.32, 1.15), { colorFn: marble });
        c.put(shaft, L(x, 0.5, z, 0, 0, 0, 1, h, 1), { colorFn: marble });
        if (h > 5) c.put(UNIT_BOX, L(x, 0.5 + h, z, 0, a, 0, 1.15, 0.34, 1.15), { colorFn: marble });
        else c.put(UNIT_CONE, L(x, 0.5 + h, z, r() * 0.3, r() * TAU, r() * 0.3, 0.44, 0.35, 0.44), { colorFn: marble });
        if (h > 1) c.solid(x, h / 2, z, 0.95);
    }
    // lintels where two neighbours still stand
    for (let k = 0; k < N; k++) {
        const k2 = (k + 1) % N;
        if (heights[k] > 5 && heights[k2] > 5) {
            const a = ((k + 0.5) / N) * TAU;
            c.put(UNIT_BOX, L(Math.cos(a) * R * 0.93, 6.4, Math.sin(a) * R * 0.93, 0, -a, 0, 1.2, 0.55, 2 * R * Math.sin(Math.PI / N) + 1.1), { colorFn: marble });
        }
    }
    // fallen drums outside the ring
    for (let k = 0; k < 2; k++) {
        const a = r() * TAU, d = 7 + r() * 2;
        for (let s = 0; s < 3; s++) c.put(shaft, L(Math.cos(a) * d + Math.cos(a + 1.57) * s * 1.25, 0.1, Math.sin(a) * d + Math.sin(a + 1.57) * s * 1.25, 0, -a, Math.PI / 2 + (r() - 0.5) * 0.2, 1, 1.15, 1), { colorFn: marble });
    }
    // the altar and its pearl
    c.put(UNIT_BOX, L(0, 0.2, 0, 0, 0, 0, 1.3, 0.9, 0.9), { colorFn: marble });
    const pearl = c.glow(new THREE.SphereGeometry(0.2, 16, 12), '#f4ecff', 1, L(0, 1.32, 0));
    const halo = c.halo('#e8dcff', 2.4, 0, 1.35, 0, 0.4);
    c.updaters.push((t, night) => {
        pearl.material.emissiveIntensity = 0.8 + 0.3 * Math.sin(t * 0.6) + night * 0.6;
        halo.material.opacity = 0.3 + 0.1 * Math.sin(t * 0.6) + night * 0.25;
    });
}

function anchor(c) {
    const rust = (h) => {
        const a = C('#6a3a22'), b = C('#3a2a24'), tmp = new THREE.Color();
        return (v) => tmp.copy(a).lerp(b, clamp(fbm2(v.x * 4 + h, v.y * 4 + v.z * 3, 2) + 0.5, 0, 1));
    };
    const pose = L(0, -0.7, 0, 0, 0, 0.5);
    c.put(UNIT_CYL, pose.clone().multiply(L(0, 0.6, 0, 0, 0, 0, 0.24, 5, 0.24)), { colorFn: rust(1) });
    c.put(new THREE.TorusGeometry(1.8, 0.24, 8, 20, Math.PI).rotateZ(Math.PI), pose.clone().multiply(L(0, 2.1, 0)), { colorFn: rust(2) });
    for (const sd of [-1, 1]) c.put(UNIT_CONE, pose.clone().multiply(L(sd * 1.8, 2.0, 0, 0, 0, -sd * 0.35, 0.42, 0.9, 0.16)), { colorFn: rust(3) });
    c.put(UNIT_CYL, pose.clone().multiply(L(0, 4.9, -1.7, Math.PI / 2, 0, 0, 0.15, 3.4, 0.15)), { colorFn: rust(4) });
    c.put(new THREE.TorusGeometry(0.55, 0.11, 8, 20), pose.clone().multiply(L(0, 6.1, 0)), { colorFn: rust(5) });
    // the chain, running off across the sand
    const link = new THREE.TorusGeometry(0.24, 0.07, 6, 12);
    const ring = new V3(0, 6.1, 0).applyMatrix4(pose);
    let x = ring.x, y = ring.y, z = 0;
    for (let k = 0; k < 18; k++) {
        const t = Math.min(1, k / 6);
        x += 0.42 * (1 - t * 0.3);
        y = Math.max(0.1, ring.y * (1 - t));
        z += t * 0.12;
        c.put(link, L(x, y, z, k % 2 ? Math.PI / 2 : 0, 0, t < 1 ? -1.1 : 0, 1.4, 1, 1), { colorFn: rust(k) });
    }
    for (const yy of [1.2, 3, 4.8]) {
        const w = new V3(0, yy, 0).applyMatrix4(pose);
        c.solid(w.x, w.y, w.z, 0.9);
    }
    for (const sd of [-1, 1]) {
        const w = new V3(sd * 1.4, 0.8, 0).applyMatrix4(pose);
        c.solid(w.x, w.y, w.z, 0.9);
    }
}

function helmet(c) {
    const pose = L(0, 0.32, 0, 0.45, 0, 0.3);
    const brass = C('#c08a3a'), verd = C('#4ab09a'), tmp = new THREE.Color();
    const metal = (v) => tmp.copy(brass).lerp(verd, clamp(fbm2(v.x * 5, v.y * 5 + v.z * 4, 2) * 1.4, 0, 0.8));
    c.put(new THREE.SphereGeometry(0.42, 20, 14), pose, { colorFn: metal });
    c.put(new THREE.CylinderGeometry(0.4, 0.52, 0.26, 20), pose.clone().multiply(L(0, -0.44, 0)), { colorFn: metal });
    const disc = new THREE.CylinderGeometry(1, 1, 0.04, 18);
    const rim = new THREE.TorusGeometry(1, 0.2, 6, 18);
    for (const [x, y, z, rx, rz, s] of [[0, 0.02, 0.41, Math.PI / 2, 0, 0.15], [0.41, 0.02, 0, 0, Math.PI / 2, 0.1], [-0.41, 0.02, 0, 0, Math.PI / 2, 0.1]]) {
        c.put(disc, pose.clone().multiply(L(x, y, z, rx, 0, rz, s, 1, s)), { color: C('#16262c') });
        c.put(rim, pose.clone().multiply(L(x * 1.02, y, z * 1.02, rx === 0 ? 0 : 0, rz ? Math.PI / 2 : 0, 0, s)), { color: brass });
    }
    c.put(UNIT_CYL, pose.clone().multiply(L(0, 0.38, -0.12, -0.5, 0, 0, 0.05, 0.18, 0.05)), { color: brass });
    // a hermit crab, thinking it over
    const crab = C('#e0603a');
    c.put(UNIT_SPH, L(0.7, 0.08, 0.3, 0, 0, 0, 0.12, 0.07, 0.1), { color: crab });
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) c.put(UNIT_CYL, L(0.62 + k * 0.08, 0.05, 0.3 + sd * 0.08, sd * 1.1, 0, 0, 0.012, 0.12, 0.012), { color: crab });
    c.put(UNIT_CONE, L(0.6, 0.12, 0.3, 0, 0, 1.2, 0.08, 0.18, 0.08), { color: C('#e8d0b0') });
}

function bottle(c) {
    const note = BOTTLE_NOTES[Math.floor(c.r() * BOTTLE_NOTES.length)];
    const pose = L(0, 0.1, 0, 0, 0, Math.PI / 2 - 0.12);
    const glass = new THREE.LatheGeometry([[0, 0], [0.085, 0], [0.095, 0.02], [0.095, 0.24], [0.06, 0.3], [0.03, 0.34], [0.03, 0.42], [0, 0.42]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
    const g = c.glow(glass, '#7fe0a0', 0.25, pose.clone().multiply(L(0, -0.2, 0)), { transparent: true, opacity: 0.45, depthWrite: false, roughness: 0.05 });
    g.renderOrder = 2;
    c.put(UNIT_CYL, pose.clone().multiply(L(0, 0.2, 0, 0, 0, 0, 0.034, 0.07, 0.034)), { color: C('#8a6a3a') });
    c.put(UNIT_CYL, pose.clone().multiply(L(0, -0.14, 0, 0, 0, 0, 0.05, 0.24, 0.05)), { color: C('#efe2bc') });
    const halo = c.halo('#e8fff0', 1.4, 0, 0.15, 0, 0.3);
    c.updaters.push((t, night) => (halo.material.opacity = 0.2 + 0.15 * Math.sin(t * 1.5) + night * 0.2));
    return { note };
}
