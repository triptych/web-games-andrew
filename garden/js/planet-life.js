// What grows and lives on the planets the Silver Comet's transporter throws
// you at, all built from primitives at load: a library of plants, stones and
// crystals (drawn as instances, many of each), animals made up fresh for each
// world from a few body plans (striders on two, four or six legs, hoppers,
// drifting jellies, flocks of fliers, crawlers), each with its own colours,
// eyes, horns and habits, and the remains of the ship's pilot, who went through
// the transporter one last time and did not come back.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowSprite } from './textures.js';
import { TAU, clamp, lerp, damp, angleDiff, smoothstep, fbm2 } from './util.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);

// ---------------------------------------------------------------- geometry helpers

/** Non-indexed, position and normal only, so anything can be merged with anything. */
function clean(g) {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
}
const at = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
    const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
    return clean(g).applyMatrix4(m);
};
const merge = (list) => {
    const g = mergeGeometries(list.map(clean), false);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
};
/** A lumpy stone: an icosahedron pushed about by noise. */
function lumpy(r, seed, detail = 1, squash = 0.7, amt = 0.3) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const v = new V3().fromBufferAttribute(p, i);
        const k = 1 + fbm2(v.x * 1.7 + seed, v.z * 1.7 + v.y * 1.3, 3) * amt;
        v.multiplyScalar(k);
        v.y *= squash;
        p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
}
/** A tube along points (each [x, y, z]), tapering from r0 to r1. */
function tube(pts, r0, r1 = r0 * 0.5, seg = 12, radial = 6) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
    // taper: the tube's rings are laid out in order along it
    const p = g.attributes.position;
    const per = radial + 1;
    for (let i = 0; i < p.count; i++) {
        const ring = Math.floor(i / per), u = ring / seg;
        const c = curve.getPointAt(Math.min(1, u));
        const v = new V3().fromBufferAttribute(p, i).sub(c).multiplyScalar(lerp(r0, r1, u));
        p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
    }
    return g;
}

// ---------------------------------------------------------------- plants, stones, crystals

/**
 * One kind of thing that grows (or just stands) on a planet: its parts, each a
 * geometry with a material role, and how it is scattered.
 * Roles: 'stem' (bark, stalks), 'leaf', 'glow' (lit from inside), 'rock', 'snow'.
 */
export const FLORA = {
    puff: (r) => {
        const h = r.range(2.2, 4.2);
        const crown = [];
        for (let i = 0; i < 4; i++) crown.push(at(lumpy(r.range(0.9, 1.5), r() * 50, 1, 0.85, 0.25), r.range(-0.7, 0.7), h + r.range(-0.3, 0.6), r.range(-0.7, 0.7)));
        return { parts: [['stem', merge([at(new THREE.CylinderGeometry(0.16, 0.3, h + 0.4, 6), 0, (h + 0.4) / 2, 0)])], ['leaf', merge(crown)]], col: 0.5, minD: 4.5, scale: [0.75, 1.35], name: 'puffwood' };
    },
    umbrella: (r) => {
        const h = r.range(3.5, 6);
        const lean = r.range(-0.25, 0.25);
        return { parts: [['stem', merge([tube([[0, 0, 0], [lean * 0.5, h * 0.5, 0], [lean, h, 0]], 0.28, 0.14, 8, 6)])], ['leaf', merge([at(lumpy(2.4, r() * 50, 1, 0.22, 0.2), lean, h + 0.2, 0), at(lumpy(1.5, r() * 50, 1, 0.3, 0.2), lean + 0.5, h + 0.6, 0.3)])]], col: 0.45, minD: 6, scale: [0.8, 1.3], name: 'parasol tree' };
    },
    conifer: (r) => {
        const h = r.range(3.5, 6.5), tiers = 4;
        const leaf = [], snow = [];
        for (let i = 0; i < tiers; i++) {
            const y = h * (0.25 + (i / tiers) * 0.7), rad = (1 - i / tiers) * 1.6 + 0.4;
            leaf.push(at(new THREE.ConeGeometry(rad, h * 0.32, 7), 0, y, 0, 0, i));
            snow.push(at(new THREE.ConeGeometry(rad * 0.55, h * 0.12, 7), 0, y + h * 0.11, 0, 0, i));
        }
        return { parts: [['stem', merge([at(new THREE.CylinderGeometry(0.12, 0.22, h * 0.4, 5), 0, h * 0.2, 0)])], ['leaf', merge(leaf)], ['snow', merge(snow)]], col: 0.4, minD: 3.6, scale: [0.7, 1.3], name: 'spirefir' };
    },
    palm: (r) => {
        const h = r.range(3.5, 5.5), bend = r.range(0.6, 1.4);
        const fr = [];
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU;
            fr.push(at(new THREE.ConeGeometry(0.3, 2.6, 4), bend + Math.sin(a) * 1.0, h - 0.3, Math.cos(a) * 1.0, Math.cos(a) * 1.25, 0, -Math.sin(a) * 1.25, 1, 1, 0.25));
        }
        return { parts: [['stem', merge([tube([[0, 0, 0], [bend * 0.2, h * 0.5, 0], [bend, h, 0]], 0.22, 0.14, 10, 6)])], ['leaf', merge(fr)], ['glow', merge([0, 1, 2].map((k) => at(new THREE.SphereGeometry(0.2, 8, 6), bend + Math.sin(k * 2.1) * 0.25, h - 0.25, Math.cos(k * 2.1) * 0.25)))]], col: 0.35, minD: 4, scale: [0.8, 1.2], name: 'lantern palm' };
    },
    shroom: (r) => {
        const h = r.range(2, 6.5), cap = h * r.range(0.35, 0.55);
        const spots = [];
        for (let i = 0; i < 9; i++) {
            const a = r() * TAU, d = r() * 0.85;
            spots.push(at(new THREE.SphereGeometry(cap * 0.09, 6, 4), Math.cos(a) * d * cap, h + 0.05 + (1 - d * d) * cap * 0.42, Math.sin(a) * d * cap));
        }
        return { parts: [['stem', merge([tube([[0, 0, 0], [0.15, h * 0.5, 0], [0, h, 0.1]], h * 0.08, h * 0.05, 8, 7)])], ['leaf', merge([at(new THREE.SphereGeometry(cap, 14, 8, 0, TAU, 0, Math.PI / 2), 0, h, 0.1, 0, 0, 0, 1, 0.55, 1)])], ['glow', merge(spots)]], col: h * 0.12, minD: h * 0.8, scale: [0.6, 1.4], name: 'parasol cap', glow: true };
    },
    tendril: (r) => {
        const stems = [], bulbs = [];
        const n = r.int(3, 6);
        for (let i = 0; i < n; i++) {
            const a = r() * TAU, h = r.range(1.6, 3.6), tw = r.range(0.3, 0.8);
            const pts = [];
            for (let k = 0; k <= 5; k++) {
                const u = k / 5;
                pts.push([Math.cos(a) * u * 0.6 + Math.sin(u * 7 + i) * tw * u, u * h, Math.sin(a) * u * 0.6 + Math.cos(u * 7 + i) * tw * u]);
            }
            stems.push(tube(pts, 0.09, 0.03, 14, 5));
            bulbs.push(at(new THREE.SphereGeometry(0.17, 8, 6), ...pts[5]));
        }
        return { parts: [['stem', merge(stems)], ['glow', merge(bulbs)]], col: 0, minD: 2.4, scale: [0.7, 1.4], name: 'lamp-tendril', glow: true };
    },
    deadtree: (r) => {
        const h = r.range(2.5, 4.5);
        const br = [at(new THREE.CylinderGeometry(0.12, 0.28, h, 5), 0, h / 2, 0)];
        for (let i = 0; i < 5; i++) {
            const a = r() * TAU, y = h * r.range(0.45, 0.95), l = r.range(0.8, 1.8);
            br.push(at(new THREE.CylinderGeometry(0.03, 0.08, l, 4), Math.cos(a) * l * 0.4, y + l * 0.3, Math.sin(a) * l * 0.4, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9));
        }
        return { parts: [['stem', merge(br)]], col: 0.3, minD: 4, scale: [0.7, 1.3], name: 'bonewood' };
    },
    cactus: (r) => {
        const h = r.range(1.8, 4);
        const g = [at(new THREE.CylinderGeometry(0.32, 0.36, h, 8), 0, h / 2, 0), at(new THREE.SphereGeometry(0.32, 8, 6), 0, h, 0)];
        for (let i = 0; i < r.int(1, 3); i++) {
            const s = i % 2 ? 1 : -1, y = h * r.range(0.35, 0.6), l = r.range(0.5, 0.8), up = r.range(0.6, 1.3);
            g.push(at(new THREE.CylinderGeometry(0.17, 0.17, l, 7), s * l / 2, y, 0, 0, 0, Math.PI / 2));
            g.push(at(new THREE.CylinderGeometry(0.17, 0.19, up, 7), s * l, y + up / 2, 0));
            g.push(at(new THREE.SphereGeometry(0.17, 7, 5), s * l, y + up, 0));
        }
        return { parts: [['leaf', merge(g)], ['glow', merge([at(new THREE.SphereGeometry(0.13, 7, 5), 0, h + 0.3, 0)])]], col: 0.45, minD: 3.2, scale: [0.7, 1.3], name: 'sentinel cactus' };
    },
    crystal: (r) => {
        const g = [];
        for (let i = 0; i < r.int(3, 7); i++) {
            const h = r.range(0.8, 3.2), w = h * r.range(0.12, 0.22);
            const a = r() * TAU, tilt = r.range(0, 0.6), d = r.range(0, 0.6);
            const m = new THREE.Matrix4().compose(new V3(Math.cos(a) * d, 0, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, r() * TAU, -Math.cos(a) * tilt)), new V3(1, 1, 1));
            const prism = merge([at(new THREE.CylinderGeometry(w, w * 1.1, h, 6), 0, h / 2, 0), at(new THREE.ConeGeometry(w, w * 2.2, 6), 0, h + w * 1.1, 0)]);
            g.push(prism.applyMatrix4(m));
        }
        return { parts: [['glow', merge(g)]], col: 0.6, minD: 3, scale: [0.6, 1.6], name: 'song crystal', glow: true };
    },
    spire: (r) => {
        const h = r.range(4, 10);
        const g = lumpy(1, r() * 50, 1, 1, 0.35);
        g.scale(r.range(0.8, 1.4), h / 2, r.range(0.8, 1.4));
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i) / (h / 2);
            const k = lerp(1, 0.08, clamp((y + 1) / 2, 0, 1) ** 0.8);
            p.setXYZ(i, p.getX(i) * k, p.getY(i) + h / 2 - 0.3, p.getZ(i) * k);
        }
        return { parts: [['rock', merge([g])]], col: 0.9, minD: 7, scale: [0.6, 1.5], name: 'needle rock' };
    },
    rock: (r) => ({ parts: [['rock', merge([at(lumpy(r.range(0.6, 1.4), r() * 50, 1, r.range(0.45, 0.8), 0.32), 0, 0.15, 0)])]], col: 0.9, minD: 3, scale: [0.5, 1.8], name: 'stone' }),
    boulder: (r) => ({ parts: [['rock', merge([at(lumpy(2.2, r() * 50, 2, 0.65, 0.3), 0, 0.5, 0), at(lumpy(1.1, r() * 50, 1, 0.7, 0.3), 1.8, 0.3, 0.9)])]], col: 2.1, minD: 9, scale: [0.7, 1.4], name: 'boulder' }),
    tuft: (r) => {
        const g = [];
        for (let i = 0; i < 7; i++) {
            const a = r() * TAU, d = r() * 0.35, h = r.range(0.4, 0.9);
            g.push(at(new THREE.ConeGeometry(0.05, h, 3), Math.cos(a) * d, h / 2, Math.sin(a) * d, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3));
        }
        return { parts: [['leaf', merge(g)]], col: 0, minD: 0.9, scale: [0.7, 1.5], name: 'grass' };
    },
    fern: (r) => {
        const g = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + r() * 0.4;
            g.push(at(new THREE.ConeGeometry(0.22, 1.3, 3), Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5, Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0, 1, 1, 0.3));
        }
        return { parts: [['leaf', merge(g)]], col: 0, minD: 1.6, scale: [0.7, 1.4], name: 'frondling' };
    },
    bloom: (r) => {
        const st = [], bl = [];
        for (let i = 0; i < 5; i++) {
            const a = r() * TAU, d = r() * 0.4, h = r.range(0.3, 0.8);
            st.push(at(new THREE.CylinderGeometry(0.012, 0.018, h, 3), Math.cos(a) * d, h / 2, Math.sin(a) * d));
            bl.push(at(new THREE.SphereGeometry(0.07, 6, 4), Math.cos(a) * d, h, Math.sin(a) * d));
        }
        return { parts: [['stem', merge(st)], ['glow', merge(bl)]], col: 0, minD: 1, scale: [0.8, 1.4], name: 'glimmerbell', glow: true };
    },
    coral: (r) => {
        const g = [], tips = [];
        for (let i = 0; i < r.int(4, 7); i++) {
            const a = r() * TAU, h = r.range(0.6, 1.6);
            const pts = [[0, 0, 0], [Math.cos(a) * 0.25, h * 0.5, Math.sin(a) * 0.25], [Math.cos(a) * 0.55, h, Math.sin(a) * 0.55]];
            g.push(tube(pts, 0.09, 0.05, 6, 5));
            tips.push(at(new THREE.SphereGeometry(0.08, 6, 4), ...pts[2]));
        }
        return { parts: [['leaf', merge(g)], ['glow', merge(tips)]], col: 0.3, minD: 2, scale: [0.7, 1.4], name: 'shore coral' };
    },
    vent: (r) => {
        const g = lathe2([[1.3, 0], [1.0, 0.5], [0.55, 1.1], [0.35, 1.25], [0.25, 1.0]]);
        return { parts: [['rock', merge([g])], ['glow', merge([at(new THREE.CircleGeometry(0.3, 10), 0, 1.05, 0, -Math.PI / 2)])]], col: 1.1, minD: 8, scale: [0.8, 1.6], name: 'fire vent', glow: true, smokes: true };
    },
};
function lathe2(pts) {
    return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 12);
}

/** Make the instanced meshes for one kind. `spots` are { x, y, z, s, rot }. */
export function plantKind(fn, r, cols, spots) {
    const k = fn(r);
    const group = new THREE.Group();
    const mats = {
        stem: new THREE.MeshStandardMaterial({ color: cols.stem, roughness: 0.9, flatShading: true }),
        leaf: new THREE.MeshStandardMaterial({ color: cols.leaf, roughness: 0.8, flatShading: true }),
        glow: new THREE.MeshStandardMaterial({ color: cols.glowBase ?? cols.glow, emissive: cols.glow, emissiveIntensity: cols.glowAmt ?? 0.9, roughness: 0.35, flatShading: true }),
        rock: new THREE.MeshStandardMaterial({ color: cols.rock, roughness: 0.95, flatShading: true }),
        snow: new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.7, flatShading: true }),
    };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new V3(), p3 = new V3();
    const tint = new THREE.Color();
    for (const [role, geo] of k.parts) {
        const mesh = new THREE.InstancedMesh(geo, mats[role], spots.length);
        spots.forEach((sp, i) => {
            e.set(sp.tilt ?? 0, sp.rot, 0);
            q.setFromEuler(e);
            m4.compose(p3.set(sp.x, sp.y, sp.z), q, s3.setScalar(sp.s));
            mesh.setMatrixAt(i, m4);
            tint.setHSL(0, 0, 1).offsetHSL((sp.v - 0.5) * 0.06, 0, (sp.v - 0.5) * 0.18);
            if (role !== 'snow') mesh.setColorAt(i, tint);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = role !== 'glow' && k.col > 0.2;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
    }
    return { group, kind: k, mats };
}

// ---------------------------------------------------------------- animals

const PLANS = ['strider', 'strider', 'hopper', 'floater', 'flyer', 'crawler', 'grazer'];
const ADJ = ['Glass-backed', 'Lantern-eyed', 'Long-necked', 'Velvet', 'Six-legged', 'Bristled', 'Moon-faced', 'Three-eyed', 'Striped', 'Humming', 'Spotted', 'Ribboned', 'Crested', 'Dusk', 'Pebble', 'Thistle', 'Copper', 'Whistling', 'Tufted', 'Paper-winged'];
const NOUN = {
    strider: ['strider', 'trotter', 'stilt-deer', 'loper', 'prowler'],
    hopper: ['hopper', 'bounder', 'skipjack', 'puddlejumper', 'boing'],
    floater: ['drifter', 'sky jelly', 'balloonfish', 'float-lantern', 'wisp'],
    flyer: ['glider', 'kite', 'swallowtail', 'skreel', 'sky-ray'],
    crawler: ['crawler', 'ribbon-worm', 'sandsnake', 'creeper', 'inchling'],
    grazer: ['grazer', 'lumberback', 'tallneck', 'mossback', 'hill-ox'],
};
const HABITS = {
    strider: ['It steps very carefully, as if the ground might wake up.', 'It stops now and then to listen to something nobody else can hear.', 'A herd of them will all turn their heads at once.'],
    hopper: ['It bounces everywhere, even when it is in no hurry.', 'Each hop is a little higher than it needs to be. It seems to be showing off.', 'It lands with a sound like a dropped pillow.'],
    floater: ['It drifts on the wind and steers with its trailing threads.', 'It is lighter than the air, and seems pleased about it.', 'It glows a little brighter when something passes underneath.'],
    flyer: ['They wheel round the sky in loose rings, calling to each other.', 'It rides the warm air for hours without a single beat of its wings.', 'The flock never quite agrees which way to go.'],
    crawler: ['It pours itself across the ground like a slow ribbon.', 'It leaves a faint shining trail that fades in a minute.', 'It tastes the air with the tip of its tail.'],
    grazer: ['It is huge, slow and entirely uninterested in you.', 'It eats the tops of the tallest plants and hums while it chews.', 'Its footsteps can be felt more than heard.'],
};

/** Make up a species. `pal` gives colours to borrow from the planet. */
export function makeSpecies(r, pal, plan) {
    plan ??= r.pick(PLANS);
    const hue = r();
    const body = new THREE.Color().setHSL(hue, r.range(0.25, 0.7), r.range(0.3, 0.6));
    const accent = new THREE.Color().setHSL((hue + r.range(0.15, 0.5)) % 1, r.range(0.5, 0.9), r.range(0.45, 0.7));
    const size = plan === 'grazer' ? r.range(2.6, 4) : plan === 'flyer' ? r.range(0.6, 1.4) : plan === 'floater' ? r.range(0.7, 1.8) : plan === 'crawler' ? r.range(0.4, 0.8) : r.range(0.6, 1.6);
    const name = `${r.pick(ADJ)} ${r.pick(NOUN[plan])}`;
    return {
        plan, name, size,
        legs: plan === 'strider' ? r.pick([2, 4, 4, 6]) : plan === 'grazer' ? 4 : plan === 'hopper' ? 2 : 0,
        eyes: r.pick([1, 2, 2, 2, 3, 4]),
        horns: r() < 0.45, tail: r() < 0.7, crest: r() < 0.35, spots: r() < 0.5, glowEyes: r() < 0.5 || pal.night,
        neck: plan === 'grazer' ? r.range(1.4, 2.2) : plan === 'strider' ? r.range(0.3, 1.1) : 0.2,
        speed: plan === 'grazer' ? r.range(0.6, 1.1) : plan === 'crawler' ? r.range(0.5, 1.0) : r.range(1.2, 2.6),
        skittish: plan !== 'grazer' && r() < 0.6, curious: r() < 0.3,
        body, accent, eyeCol: new THREE.Color().setHSL(r(), 0.9, 0.6),
        count: plan === 'flyer' ? r.int(5, 9) : plan === 'grazer' ? r.int(2, 4) : r.int(3, 7),
        desc: r.pick(HABITS[plan]),
    };
}

/** Build one animal of a species. Returns an object the planet moves about. */
export function makeCreature(sp, r) {
    const g = new THREE.Group();
    const s = sp.size * r.range(0.85, 1.15);
    const bodyM = new THREE.MeshStandardMaterial({ color: sp.body, roughness: 0.7, flatShading: true });
    const accM = new THREE.MeshStandardMaterial({ color: sp.accent, roughness: 0.55, flatShading: true });
    const eyeM = new THREE.MeshStandardMaterial({ color: 0x101010, emissive: sp.glowEyes ? sp.eyeCol : 0x000000, emissiveIntensity: sp.glowEyes ? 1.6 : 0, roughness: 0.2 });
    const legs = [], wings = [], segs = [], tentacles = [];
    const pivot = new THREE.Group();   // the body sways and bobs on this
    g.add(pivot);
    const eyes = (parent, r0, y, z, spread) => {
        for (let i = 0; i < sp.eyes; i++) {
            const off = sp.eyes === 1 ? 0 : (i / (sp.eyes - 1) - 0.5) * spread;
            const e = new THREE.Mesh(new THREE.SphereGeometry(r0, 8, 6), eyeM);
            e.position.set(off, y + (sp.eyes > 2 && i % 2 ? r0 * 1.2 : 0), z);
            parent.add(e);
        }
    };
    let hipY = 0, radius = s;
    if (sp.plan === 'strider' || sp.plan === 'grazer') {
        const bl = s * (sp.plan === 'grazer' ? 1.6 : 1.1), bw = s * 0.5;
        const legL = s * (sp.plan === 'grazer' ? 0.9 : r.range(0.7, 1.3));
        hipY = legL * 1.6;
        const torso = new THREE.Mesh(lumpy(1, r() * 30, 1, 1, 0.12), bodyM);
        torso.scale.set(bw, bw * 0.85, bl * 0.6);
        torso.position.y = hipY;
        pivot.add(torso);
        if (sp.spots) for (let i = 0; i < 5; i++) {
            const sp2 = new THREE.Mesh(new THREE.SphereGeometry(bw * 0.25, 6, 4), accM);
            sp2.position.set((r() - 0.5) * bw * 0.8, hipY + bw * 0.72, (r() - 0.5) * bl * 0.8);
            sp2.scale.y = 0.4;
            pivot.add(sp2);
        }
        if (sp.crest) for (let i = 0; i < 5; i++) {
            const c = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.18, bw * 0.6, 4), accM);
            c.position.set(0, hipY + bw * 0.85, (i / 4 - 0.5) * bl * 0.9);
            pivot.add(c);
        }
        // neck and head
        const neck = new THREE.Group();
        neck.position.set(0, hipY + bw * 0.3, bl * 0.5);
        neck.rotation.x = -0.9 + (sp.neck > 1 ? -0.3 : 0.4);
        pivot.add(neck);
        const nl = s * sp.neck;
        const nm = new THREE.Mesh(new THREE.CylinderGeometry(bw * 0.18, bw * 0.3, nl, 6).translate(0, nl / 2, 0), bodyM);
        neck.add(nm);
        const head = new THREE.Group();
        head.position.y = nl;
        head.rotation.x = 1.0;
        neck.add(head);
        const hm = new THREE.Mesh(lumpy(1, r() * 30, 1, 1, 0.1), bodyM);
        hm.scale.set(bw * 0.42, bw * 0.38, bw * 0.6);
        hm.position.z = bw * 0.2;
        head.add(hm);
        eyes(head, bw * 0.09, bw * 0.18, bw * 0.55, bw * 0.45);
        if (sp.horns) for (const sx of [-1, 1]) {
            const h = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.06, bw * 0.7, 5), accM);
            h.position.set(sx * bw * 0.22, bw * 0.45, 0);
            h.rotation.set(-0.5, 0, sx * 0.4);
            head.add(h);
        }
        if (sp.tail) {
            const t = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.18, bl * 0.8, 5).translate(0, -bl * 0.4, 0), accM);
            t.position.set(0, hipY + bw * 0.2, -bl * 0.55);
            t.rotation.x = -1.2;
            pivot.add(t);
            tentacles.push({ m: t, base: -1.2, axis: 'z', amp: 0.35, rate: 2 });
        }
        // the legs: pairs spaced along the body, each a thigh and a shin
        const pairs = sp.legs / 2;
        for (let i = 0; i < pairs; i++) {
            const z = pairs === 1 ? 0 : (i / (pairs - 1) - 0.5) * bl * 0.9;
            for (const sx of [-1, 1]) {
                const hip = new THREE.Group();
                hip.position.set(sx * bw * 0.6, hipY, z);
                pivot.add(hip);
                const thigh = new THREE.Mesh(new THREE.CylinderGeometry(bw * 0.12, bw * 0.18, legL, 5).translate(0, -legL / 2, 0), bodyM);
                hip.add(thigh);
                const knee = new THREE.Group();
                knee.position.y = -legL;
                hip.add(knee);
                const shin = new THREE.Mesh(new THREE.CylinderGeometry(bw * 0.06, bw * 0.11, legL * 0.75, 5).translate(0, -legL * 0.375, 0), accM);
                knee.add(shin);
                hip.rotation.x = 0.3;
                knee.rotation.x = -0.55;
                legs.push({ hip, knee, phase: (i % 2 ? Math.PI : 0) + (sx > 0 ? Math.PI : 0), sx });
            }
        }
        radius = Math.max(bl, hipY) * 0.8;
    } else if (sp.plan === 'hopper') {
        const br = s * 0.55;
        hipY = br * 1.6;
        const ball = new THREE.Mesh(lumpy(br, r() * 30, 1, 1, 0.12), bodyM);
        ball.position.y = hipY;
        pivot.add(ball);
        const belly = new THREE.Mesh(new THREE.SphereGeometry(br * 0.7, 10, 8), accM);
        belly.position.set(0, hipY - br * 0.2, br * 0.4);
        pivot.add(belly);
        eyes(pivot, br * 0.18, hipY + br * 0.45, br * 0.82, br * 0.8);
        for (const sx of [-1, 1]) {
            const ear = new THREE.Mesh(new THREE.ConeGeometry(br * 0.18, br * 1.3, 5), accM);
            ear.position.set(sx * br * 0.45, hipY + br * 1.3, -br * 0.1);
            ear.rotation.z = -sx * 0.35;
            pivot.add(ear);
            tentacles.push({ m: ear, base: -sx * 0.35, axis: 'z', amp: 0.2, rate: 3 });
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(br * 0.15, br * 0.22, hipY, 5).translate(0, -hipY / 2, 0), accM);
            const hip = new THREE.Group();
            hip.position.set(sx * br * 0.5, hipY - br * 0.3, -br * 0.2);
            hip.add(leg);
            pivot.add(hip);
            legs.push({ hip, phase: 0, sx, hop: true });
        }
        radius = br * 1.6;
    } else if (sp.plan === 'floater') {
        const br = s * 0.7;
        hipY = r.range(2.5, 6);
        const bell = new THREE.Mesh(new THREE.SphereGeometry(br, 14, 8, 0, TAU, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: sp.body, emissive: sp.accent, emissiveIntensity: 0.45, roughness: 0.3, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
        bell.position.y = hipY;
        pivot.add(bell);
        const core = new THREE.Mesh(new THREE.SphereGeometry(br * 0.35, 8, 6), eyeM);
        core.position.y = hipY + br * 0.2;
        pivot.add(core);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU, l = br * r.range(1.6, 3);
            const t = new THREE.Mesh(new THREE.CylinderGeometry(br * 0.04, br * 0.015, l, 4).translate(0, -l / 2, 0), accM);
            t.position.set(Math.cos(a) * br * 0.6, hipY + 0.05, Math.sin(a) * br * 0.6);
            pivot.add(t);
            tentacles.push({ m: t, base: 0, axis: i % 2 ? 'x' : 'z', amp: 0.25, rate: 1.4 + i * 0.2, ph: i });
        }
        radius = br * 1.2;
    } else if (sp.plan === 'flyer') {
        const bl = s;
        hipY = 0;
        const bodyMesh = new THREE.Mesh(new THREE.ConeGeometry(bl * 0.18, bl, 6).rotateX(Math.PI / 2), bodyM);
        pivot.add(bodyMesh);
        eyes(pivot, bl * 0.04, bl * 0.05, bl * 0.4, bl * 0.1);
        for (const sx of [-1, 1]) {
            const wing = new THREE.Group();
            pivot.add(wing);
            const shape = new THREE.Shape();
            shape.moveTo(0, -bl * 0.2);
            shape.lineTo(sx * bl * 1.3, -bl * 0.05);
            shape.lineTo(sx * bl * 0.9, bl * 0.25);
            shape.lineTo(0, bl * 0.3);
            const wm = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: sp.accent, roughness: 0.6, side: THREE.DoubleSide, flatShading: true }));
            wing.add(wm);
            wings.push({ w: wing, sx });
        }
        radius = bl * 1.3;
    } else {
        // a crawler: a head and a string of segments that follow it
        const sr = s * 0.4;
        hipY = sr;
        const n = 7;
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(sr * (1 - i * 0.07), 8, 6), i % 2 ? accM : bodyM);
            m.position.set(0, sr, -i * sr * 1.3);
            pivot.add(m);
            segs.push(m);
        }
        eyes(segs[0], sr * 0.22, sr * 0.4, sr * 0.75, sr * 0.9);
        if (sp.horns) for (const sx of [-1, 1]) {
            const h = new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.04, sr * 0.06, sr * 1.4, 4), accM);
            h.position.set(sx * sr * 0.4, sr * 1.1, sr * 0.4);
            h.rotation.set(0.6, 0, sx * 0.4);
            segs[0].add(h);
        }
        radius = sr * n * 0.8;
    }
    g.traverse((m) => {
        if (m.isMesh) m.castShadow = sp.plan !== 'flyer';
    });
    return { g, pivot, sp, s, legs, wings, segs, tentacles, hipY, radius, mats: [bodyM, accM, eyeM] };
}

/** Move one animal on: wander, graze, flee or come and look. */
export function stepCreature(c, dt, t, P) {
    const sp = c.sp;
    const me = P.player;
    const dx = me.x - c.x, dz = me.z - c.z;
    const dp = Math.hypot(dx, dz);
    let speed = 0;
    if (sp.plan === 'flyer') {
        // round and round, high up, the flock in a loose ring
        c.a += dt * c.w;
        c.x = c.cx + Math.cos(c.a) * c.ring;
        c.z = c.cz + Math.sin(c.a) * c.ring;
        const y = P.groundAt(c.x, c.z) + c.alt + Math.sin(t * 0.7 + c.ph) * 1.2;
        c.g.position.set(c.x, y, c.z);
        c.g.rotation.set(0, Math.atan2(-Math.sin(c.a) * Math.sign(c.w), Math.cos(c.a) * Math.sign(c.w)), -Math.sign(c.w) * 0.35);
        for (const w of c.wings) w.w.rotation.z = w.sx * Math.sin(t * c.flap + c.ph) * 0.6;
        return;
    }
    // what to do
    c.think -= dt;
    if (sp.skittish && dp < 7) {
        c.state = 'flee';
        c.tx = c.x - (dx / (dp || 1)) * 12;
        c.tz = c.z - (dz / (dp || 1)) * 12;
    } else if (sp.curious && dp < 12 && dp > 4.5) {
        c.state = 'look';
        c.tx = me.x;
        c.tz = me.z;
    } else if (c.think <= 0 || (c.state === 'look' && dp <= 4.5)) {
        c.think = 3 + Math.random() * 6;
        if (Math.random() < 0.35) c.state = 'graze';
        else {
            c.state = 'walk';
            const a = Math.random() * TAU, d = 4 + Math.random() * 14;
            c.tx = c.hx + Math.cos(a) * d;
            c.tz = c.hz + Math.sin(a) * d;
        }
    }
    if (c.state === 'walk' || c.state === 'flee' || c.state === 'look') {
        const tx = c.tx - c.x, tz = c.tz - c.z, d = Math.hypot(tx, tz);
        if (d < 0.6 || (c.state === 'look' && dp < 4.5)) {
            if (c.state !== 'flee') c.state = 'graze';
        } else {
            const want = Math.atan2(tx, tz);
            c.yaw += angleDiff(c.yaw, want) * (1 - Math.exp(-dt * 3));
            speed = sp.speed * (c.state === 'flee' ? 2.2 : 1);
            const nx = c.x + Math.sin(c.yaw) * speed * dt, nz = c.z + Math.cos(c.yaw) * speed * dt;
            if (P.roam(nx, nz, sp.plan === 'floater')) {
                c.x = nx;
                c.z = nz;
            } else {
                c.think = 0;
                c.state = 'graze';
                speed = 0;
            }
        }
        if (c.state === 'flee' && dp > 14) c.state = 'graze';
    }
    if (c.state === 'look' || (c.state === 'graze' && dp < 10 && sp.curious)) {
        c.yaw += angleDiff(c.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 2));
    }
    c.speed = damp(c.speed, speed, 6, dt);
    c.walk += c.speed * dt;
    const gy = P.groundAt(c.x, c.z);
    let bob = 0;
    if (sp.plan === 'hopper') {
        const hop = c.speed > 0.2 ? Math.abs(Math.sin(c.walk * 2.2)) : Math.abs(Math.sin(t * 2 + c.ph)) * 0.15;
        bob = hop * c.s * 1.1;
        c.pivot.scale.set(1 + (1 - hop) * 0.12, 1 - (1 - hop) * 0.12, 1);
        for (const l of c.legs) l.hip.rotation.x = c.speed > 0.2 ? -0.6 + hop * 0.9 : 0;
    } else if (sp.plan === 'floater') {
        bob = Math.sin(t * 0.9 + c.ph) * 0.5;
        for (const tn of c.tentacles) tn.m.rotation[tn.axis] = Math.sin(t * tn.rate + (tn.ph ?? 0)) * tn.amp;
    } else if (sp.plan === 'crawler') {
        c.segs.forEach((m, i) => {
            m.position.x = Math.sin(c.walk * 3 - i * 0.9 + c.ph) * c.s * 0.35 * (i / c.segs.length) * (c.speed > 0.1 ? 1 : 0.3);
            m.position.y = c.hipY + Math.max(0, Math.sin(c.walk * 3 - i * 0.9)) * c.s * 0.12;
        });
    } else {
        const k = clamp(c.speed / sp.speed, 0, 1.6);
        for (const l of c.legs) {
            const ph = c.walk * (3.2 / Math.max(0.5, c.s)) + l.phase;
            l.hip.rotation.x = 0.3 + Math.sin(ph) * 0.55 * k;
            l.knee.rotation.x = -0.55 - Math.max(0, Math.cos(ph)) * 0.6 * k;
        }
        bob = Math.abs(Math.sin(c.walk * (3.2 / Math.max(0.5, c.s)))) * 0.06 * c.s * k;
        // grazing: dip the whole front a little
        c.pivot.rotation.x = c.state === 'graze' ? Math.sin(t * 0.8 + c.ph) * 0.06 + 0.06 : 0;
        for (const tn of c.tentacles) tn.m.rotation[tn.axis] = tn.base + Math.sin(t * tn.rate + c.ph) * tn.amp * (tn.axis === 'z' ? 1 : 0.4);
    }
    c.g.position.set(c.x, gy + bob, c.z);
    c.g.rotation.y = c.yaw;
}

// ---------------------------------------------------------------- the pilot

/**
 * What is left of the Silver Comet's pilot: a skeleton in a torn silver
 * spacesuit, propped against a stone, helmet on, looking up at the sky; a flag
 * of the ship planted beside, a little cairn, and the flight log in one hand.
 * The emergency light on the shoulder still blinks, very faintly.
 */
export function buildPilot(r) {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.55, metalness: 0.2, flatShading: true });
    const torn = new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    const orange = new THREE.MeshStandardMaterial({ color: 0xd86a1a, roughness: 0.5 });
    const red = new THREE.MeshStandardMaterial({ color: 0xb8231b, roughness: 0.45 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.3, metalness: 0.9 });
    const blink = new THREE.MeshStandardMaterial({ color: 0x401010, emissive: 0xff2a1a, emissiveIntensity: 0.1 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x7a7266, roughness: 0.95, flatShading: true });
    const mesh = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        m.castShadow = true;
        return m;
    };
    // the stone at the back
    g.add(mesh(lumpy(1.0, 7.7, 1, 0.9, 0.25), stone, 0, 0.55, -0.75));
    // the body sits back against it: pelvis at the foot, torso leaning back
    const torso = new THREE.Group();
    torso.position.set(0, 0.3, -0.05);
    torso.rotation.x = -0.5;
    g.add(torso);
    torso.add(mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.62, 10, 1, true).translate(0, 0.32, 0), suit));
    // the chest panel is torn open, and the ribs show
    torso.add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), orange, 0, 0.5, 0.21));
    for (let i = 0; i < 5; i++) torso.add(mesh(new THREE.TorusGeometry(0.15 - i * 0.008, 0.012, 4, 12, Math.PI * 1.25), bone, 0, 0.18 + i * 0.07, 0.02, Math.PI / 2, 0, -Math.PI * 0.62));
    torso.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), bone, 0, 0.32, -0.08));
    torso.add(mesh(new THREE.BoxGeometry(0.22, 0.04, 0.26), torn, 0.06, 0.42, 0.18, 0.4, 0.2, 0.3));
    // the air tank on the back, and the badge of the ship on the shoulder
    torso.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), brass, 0.09, 0.36, -0.24));
    torso.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), brass, -0.09, 0.36, -0.24));
    torso.add(mesh(new THREE.CircleGeometry(0.06, 14), red, 0.25, 0.52, 0.04, 0, Math.PI / 2));
    const lamp = mesh(new THREE.SphereGeometry(0.035, 8, 6), blink, -0.2, 0.62, 0.1);
    torso.add(lamp);
    // the fishbowl helmet, and the skull inside it, tipped back to look at the sky
    const head = new THREE.Group();
    head.position.set(0, 0.72, 0);
    head.rotation.x = -0.35;
    torso.add(head);
    head.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 18), brass, 0, 0, 0, Math.PI / 2));
    const skull = new THREE.Group();
    skull.position.y = 0.17;
    skull.rotation.z = 0.25;
    head.add(skull);
    skull.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), bone, 0, 0.02, 0, 0, 0, 0));
    skull.add(mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), bone, 0, -0.08, 0.03));
    const socket = new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 1 });
    for (const sx of [-1, 1]) skull.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), socket, sx * 0.04, 0.02, 0.09));
    const bowl = mesh(new THREE.SphereGeometry(0.26, 18, 14), glass, 0, 0.2, 0);
    bowl.castShadow = false;
    head.add(bowl);
    // a crack across the glass
    const crack = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.0035, 3, 30, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    crack.position.y = 0.2;
    crack.rotation.set(0.4, 0.9, 0.2);
    head.add(crack);
    // arms: the right on the lap holding the log, the left reaching out across the ground
    const arm = (sx, rx, rz, bones) => {
        const sh = new THREE.Group();
        sh.position.set(sx * 0.27, 0.55, 0);
        sh.rotation.set(rx, 0, rz);
        torso.add(sh);
        sh.add(mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 8).translate(0, -0.27, 0), suit));
        sh.add(mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 10), orange, 0, -0.5, 0, Math.PI / 2));
        if (bones) {
            // the glove is gone: finger bones
            for (let k = 0; k < 4; k++) sh.add(mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.1, 4), bone, (k - 1.5) * 0.022, -0.6, 0.02, 0.3));
        } else sh.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), suit, 0, -0.58, 0));
        return sh;
    };
    arm(1, 0.9, 0.35, false);
    arm(-1, 0.2, -1.2, true);
    // the log on the lap: a tin-bound notebook
    const log = mesh(new THREE.BoxGeometry(0.2, 0.03, 0.26), new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 0.8 }), 0.12, 0.33, 0.32, 0.1, 0.3, 0);
    g.add(log);
    // legs, stretched out
    for (const sx of [-1, 1]) {
        g.add(mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.85, 8).rotateX(Math.PI / 2), suit, sx * 0.13, 0.12, 0.45, 0, sx * 0.08, 0));
        g.add(mesh(new THREE.BoxGeometry(0.13, 0.12, 0.24), orange, sx * 0.15, 0.08, 0.92));
    }
    // the flag of the Comet, planted beside, faded and frayed
    const flagTex = (() => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 80;
        const x = c.getContext('2d');
        x.fillStyle = '#e8e0d0';
        x.fillRect(0, 0, 128, 80);
        x.fillStyle = '#b8231b';
        x.beginPath();
        x.arc(44, 40, 24, 0, TAU);
        x.fill();
        x.fillStyle = '#e8e0d0';
        x.font = 'bold 22px sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('SC', 44, 41);
        x.fillStyle = '#b8231b';
        x.fillRect(76, 18, 44, 10);
        x.fillRect(76, 52, 44, 10);
        // frayed end
        x.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 9; i++) x.fillRect(112 + Math.random() * 16, i * 9, 20, 4);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    })();
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.7, 5), brass, 0.9, 0.85, 0.2));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38, 6, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3, roughness: 0.9 }));
    flag.position.set(0.9 + 0.31, 1.48, 0.2);
    g.add(flag);
    // a cairn of stones with an arrow scratched pointing up
    for (let i = 0; i < 5; i++) g.add(mesh(lumpy(0.2 - i * 0.025, i * 3.1, 1, 0.6, 0.25), stone, -0.85 + (r() - 0.5) * 0.05, 0.08 + i * 0.13, 0.35));
    // the shoulder lamp blinks: it is very nearly out
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff3a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.9);
    lamp.add(halo);
    const pos = flag.geometry.attributes.position;
    const base = Float32Array.from(pos.array);
    const update = (t) => {
        const on = t % 3.4 < 0.15;
        blink.emissiveIntensity = on ? 2.8 : 0.08;
        halo.material.opacity = on ? 0.75 : 0;
        for (let i = 0; i < pos.count; i++) {
            const x0 = base[i * 3];
            pos.setZ(i, Math.sin(t * 2.4 + x0 * 7) * 0.05 * (x0 + 0.31));
        }
        pos.needsUpdate = true;
    };
    return { group: g, update, log, radius: 1.3 };
}
