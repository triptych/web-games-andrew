// What grows and lives on the planets the Silver Comet's transporter throws
// you at, all built from primitives at load: a library of plants, stones and
// crystals (drawn as instances, many of each), animals made up fresh for each
// world from a few body plans, each with several forms (striders: deer, biped,
// brute, insect; grazers: longneck, shellback, mammoth; hoppers: bunny, frog,
// kangaroo; floaters: jelly, balloon, ray; fliers: bird, moth, dragon, kite;
// crawlers: worm, snake, centipede, slug), each with its own colours, markings,
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
// every plan has a few body forms; the first of each is the original shape, the rest are new
const FORMS_OF = {
    strider: ['deer', 'deer', 'biped', 'biped', 'brute', 'insect'],
    grazer: ['longneck', 'shell', 'mammoth'],
    hopper: ['bunny', 'frog', 'roo'],
    floater: ['jelly', 'balloon', 'ray'],
    flyer: ['bird', 'moth', 'dragon', 'kite'],
    crawler: ['worm', 'snake', 'centipede', 'slug'],
};
const LEGS_OF = { deer: null, biped: 2, brute: 4, insect: 6, longneck: 4, shell: 4, mammoth: 4, bunny: 2, frog: 2, roo: 2 };
const ADJ = ['Glass-backed', 'Lantern-eyed', 'Long-necked', 'Velvet', 'Six-legged', 'Bristled', 'Moon-faced', 'Three-eyed', 'Striped', 'Humming', 'Spotted', 'Ribboned', 'Crested', 'Dusk', 'Pebble', 'Thistle', 'Copper', 'Whistling', 'Tufted', 'Paper-winged', 'Gilded', 'Mossy', 'Ember', 'Frosted', 'Hollow', 'Saffron', 'Quiet', 'Barnacled'];
const NOUN = {
    deer: ['strider', 'trotter', 'stilt-deer', 'loper', 'prowler'],
    biped: ['runner', 'stalker', 'strutter', 'longshanks', 'dodo'],
    brute: ['bruiser', 'bulwark', 'stumper', 'rumbler', 'tuskling'],
    insect: ['skitter', 'stilt-bug', 'scuttler', 'spindle', 'tick-walker'],
    longneck: ['grazer', 'lumberback', 'tallneck', 'hill-ox'],
    shell: ['shellback', 'domeback', 'tortle', 'mossdome', 'pebblehorn'],
    mammoth: ['mammoth', 'tusker', 'trunkbeast', 'woolback', 'big-ears'],
    bunny: ['hopper', 'bounder', 'skipjack', 'puddlejumper', 'boing'],
    frog: ['croaker', 'pondskip', 'bulgeye', 'wartling', 'slapjack'],
    roo: ['kicker', 'pouncer', 'springtail', 'leaplord', 'stilt-hopper'],
    jelly: ['drifter', 'sky jelly', 'float-lantern', 'wisp'],
    balloon: ['balloonfish', 'bobble', 'gasbag', 'puffer', 'lamp-balloon'],
    ray: ['sky-ray', 'skate', 'floating manta', 'glidefin', 'veil'],
    bird: ['glider', 'kite', 'swallowtail', 'skreel'],
    moth: ['mothling', 'flutterby', 'lampwing', 'dust-wing', 'paper-wing'],
    dragon: ['wyrmlet', 'sky-serpent', 'drakelet', 'fire-lizard', 'fang-wing'],
    kite: ['pennant', 'streamer', 'ribbon-kite', 'swoop', 'sailwing'],
    worm: ['crawler', 'ribbon-worm', 'inchling', 'creeper'],
    snake: ['sandsnake', 'slither', 'coilback', 'longtongue'],
    centipede: ['thousand-leg', 'many-foot', 'scuttle-worm', 'legion'],
    slug: ['slug', 'glimmer-slug', 'mud-lump', 'slowpoke'],
};
const HABITS = {
    deer: ['It steps very carefully, as if the ground might wake up.', 'It stops now and then to listen to something nobody else can hear.', 'A herd of them will all turn their heads at once.'],
    biped: ['It runs on two legs and bobs its head at every step, like it is keeping time.', 'It stands stock-still, then dashes off for no reason you can see.', 'Its tail swings out behind to keep it balanced, and it is never quite still.'],
    brute: ['It is built like a boulder with opinions, and it shoves things out of its way.', 'It rubs its tusks on the rocks to keep them sharp, and seems very proud of them.', 'It looks fierce. It is mostly after the moss.'],
    insect: ['Six thin legs, and not one of them in a hurry.', 'It tests every step with a foot before it trusts it.', 'Its feelers twitch toward anything warm, you included.'],
    longneck: ['It is huge, slow and entirely uninterested in you.', 'It eats the tops of the tallest plants and hums while it chews.', 'Its footsteps can be felt more than heard.'],
    shell: ['It carries its home on its back and is never late.', 'When something frightens it, it simply stops, and becomes a rock.', 'Moss grows on the old ones, and little plants.'],
    mammoth: ['It swings its trunk as it walks, tasting the air.', 'Its great ears flap to keep it cool, and to say hello.', 'Its herd rumbles to each other across whole valleys.'],
    bunny: ['It bounces everywhere, even when it is in no hurry.', 'Each hop is a little higher than it needs to be. It seems to be showing off.', 'It lands with a sound like a dropped pillow.'],
    frog: ['It sits and puffs its throat, and now and then one of the others answers.', 'It leaps in one huge slap, then sits very still, as if nothing had happened.', 'Its eyes watch two directions at once.'],
    roo: ['It bounds on long hind legs and balances with its tail.', 'It stands tall to look at you, then thinks better of it and bounds away.', 'The young ones ride in a pouch and watch the world go by upside down.'],
    jelly: ['It drifts on the wind and steers with its trailing threads.', 'It is lighter than the air, and seems pleased about it.', 'It glows a little brighter when something passes underneath.'],
    balloon: ['A bobbing lantern of a creature, tugged along by its own streamers.', 'It gives a little tune when the wind gets inside it.', 'It rises at dusk and sinks at dawn, like a slow tide.'],
    ray: ['It beats its broad wings very slowly, as if swimming through the sky.', 'Its shadow slides across the ground like a lazy cloud.', 'It tilts to look at you, then goes on its way.'],
    bird: ['They wheel round the sky in loose rings, calling to each other.', 'It rides the warm air for hours without a single beat of its wings.', 'The flock never quite agrees which way to go.'],
    moth: ['It is drawn to the light of anything glowing, and very bad at being careful.', 'The eyes on its wings are not real, but they fool nearly everyone.', 'It flutters in a zigzag, as if the air were full of invisible puddles.'],
    dragon: ['It is the size of a cat and entirely convinced it is a dragon.', 'It coils and uncoils in the air and snaps at the dust.', 'Its wings snap like sails whenever it turns.'],
    kite: ['A long tail streams behind it, and it never seems to land.', 'It rides the wind like a kite and steers with its tail.', 'Its streamer stirs up little eddies of dust as it passes.'],
    worm: ['It pours itself across the ground like a slow ribbon.', 'It leaves a faint shining trail that fades in a minute.', 'It tastes the air with the tip of its tail.'],
    snake: ['It flows over the ground in S-shapes and tastes everything with its tongue.', 'It lies in the sun until the very last moment, then is simply somewhere else.', 'It is quite harmless, and quite insulted if you suggest otherwise.'],
    centipede: ['A hundred small legs that all seem to be thinking different things.', 'It ripples over the stones and never gets its feet in a tangle.', 'It carries its feelers high and forward, as if it were reading the ground.'],
    slug: ['It is slow, it is shiny, and it has never been in a hurry in its life.', 'It leaves a silvery track that catches the light.', 'Its eyes on stalks swivel to follow you at the speed of a very patient clock.'],
};

/** Make up a species. `pal` gives colours to borrow from the planet. */
export function makeSpecies(r, pal, plan) {
    plan ??= r.pick(PLANS);
    const form = r.pick(FORMS_OF[plan]);
    // a body colour from one of a few moods, so not everything is muted mid-tone
    const hue = r();
    const tone = r.pick(['normal', 'normal', 'pale', 'dark', 'vivid', 'earth']);
    const body = tone === 'pale' ? new THREE.Color().setHSL(hue, r.range(0.15, 0.4), r.range(0.68, 0.85))
        : tone === 'dark' ? new THREE.Color().setHSL(hue, r.range(0.2, 0.6), r.range(0.14, 0.28))
            : tone === 'vivid' ? new THREE.Color().setHSL(hue, r.range(0.75, 1), r.range(0.42, 0.55))
                : tone === 'earth' ? new THREE.Color().setHSL(r.range(0.04, 0.14), r.range(0.25, 0.5), r.range(0.25, 0.48))
                    : new THREE.Color().setHSL(hue, r.range(0.25, 0.7), r.range(0.3, 0.6));
    const accent = new THREE.Color().setHSL((hue + r.range(0.15, 0.5)) % 1, r.range(0.5, 0.9), r.range(0.45, 0.7));
    const size = plan === 'grazer' ? r.range(2.6, 4) : plan === 'flyer' ? r.range(0.6, 1.4) : plan === 'floater' ? r.range(0.7, 1.8) : plan === 'crawler' ? r.range(0.4, 0.8) : r.range(0.6, 1.6);
    const name = `${r.pick(ADJ)} ${r.pick(NOUN[form])}`;
    return {
        plan, form, name, size, tone,
        legs: plan === 'strider' || plan === 'grazer' || plan === 'hopper' ? (LEGS_OF[form] ?? r.pick([2, 4, 4, 6])) : 0,
        eyes: form === 'insect' ? r.pick([2, 4, 4]) : r.pick([1, 2, 2, 2, 3, 4]),
        horns: r() < 0.45, tail: form === 'biped' || r() < 0.7, crest: r() < 0.35, spots: r() < 0.5, glowEyes: r() < 0.5 || pal.night,
        stripes: r() < 0.3, belly: r() < 0.4, lumin: r() < 0.22,
        neck: plan === 'grazer' ? r.range(1.4, 2.2) : plan === 'strider' ? r.range(0.3, 1.1) : 0.2,
        speed: plan === 'grazer' ? r.range(0.6, 1.1) : plan === 'crawler' ? r.range(0.5, 1.0) : r.range(1.2, 2.6),
        skittish: plan !== 'grazer' && r() < 0.6, curious: r() < 0.3,
        body, accent, eyeCol: new THREE.Color().setHSL(r(), 0.9, 0.6),
        count: plan === 'flyer' ? r.int(5, 9) : plan === 'grazer' ? r.int(2, 4) : r.int(3, 7),
        desc: r.pick(HABITS[form]),
    };
}

// ---- body forms. Each takes the parts bag `c` and returns { hipY, radius }.
// c: { sp, s, r, pivot, bodyM, accM, eyeM, eyes, legs, wings, segs, tentacles }

const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
};
const ball = (r, mat, sx = 1, sy = 1, sz = 1, seed = 0, amt = 0.1) => {
    const m = new THREE.Mesh(lumpy(1, seed, 1, 1, amt), mat);
    m.scale.set(r * sx, r * sy, r * sz);
    return m;
};
/** Thigh, knee and shin pairs. `foot` > 0 adds a flat foot; `splay` angles the legs outward. */
function addLegs(c, o) {
    const { pairs, bw, bl, legL, hipY, thick = 1, xOff = 0.6, splay = 0, foot = 0, zSpan = 0.9, z0 = 0 } = o;
    for (let i = 0; i < pairs; i++) {
        const z = z0 + (pairs === 1 ? 0 : (i / (pairs - 1) - 0.5) * bl * zSpan);
        for (const sx of [-1, 1]) {
            const hip = new THREE.Group();
            hip.position.set(sx * bw * xOff, hipY, z);
            c.pivot.add(hip);
            hip.add(mesh(new THREE.CylinderGeometry(bw * 0.12 * thick, bw * 0.18 * thick, legL, 5).translate(0, -legL / 2, 0), c.bodyM));
            const knee = new THREE.Group();
            knee.position.y = -legL;
            hip.add(knee);
            knee.add(mesh(new THREE.CylinderGeometry(bw * 0.06 * thick, bw * 0.11 * thick, legL * 0.75, 5).translate(0, -legL * 0.375, 0), c.accM));
            if (foot) knee.add(mesh(new THREE.BoxGeometry(bw * 0.28 * foot, bw * 0.07, bw * 0.5 * foot).translate(0, 0, bw * 0.14 * foot), c.accM, 0, -legL * 0.75, 0));
            hip.rotation.x = 0.3;
            hip.rotation.z = sx * splay;
            knee.rotation.x = -0.55;
            c.legs.push({ hip, knee, phase: (i % 2 ? Math.PI : 0) + (sx > 0 ? Math.PI : 0), sx });
        }
    }
}
/** Stripes and a pale belly on a torso ellipsoid at (0, y, z0) of half-sizes (bw, bh, bl). */
function markings(c, y, z0, bw, bh, bl) {
    const { sp, pivot, accM } = c;
    if (sp.stripes) {
        const n = 4;
        for (let i = 0; i < n; i++) {
            const t = (i / (n - 1) - 0.5) * 1.3;
            const k = Math.sqrt(Math.max(0.1, 1 - t * t));
            const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 4, 14), accM);
            band.scale.set(bw * k * 1.02, bh * k * 1.02, bw * k);
            band.position.set(0, y, z0 + t * bl);
            pivot.add(band);
        }
    }
    if (sp.belly) {
        const b = ball(1, accM, bw * 0.78, bh * 0.55, bl * 0.8, 3, 0.04);
        b.position.set(0, y - bh * 0.42, z0);
        pivot.add(b);
    }
}
/** A flat wing shape through `pts` (x, z pairs, x for the +x side), mirrored by sx. */
function wingMesh(pts, sx, mat) {
    const shape = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? shape.lineTo(sx * x, y) : shape.moveTo(sx * x, y)));
    return new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), mat);
}
const wingMat = (col, c) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, side: THREE.DoubleSide, flatShading: true, emissive: c.sp.lumin ? col : 0x000000, emissiveIntensity: c.sp.lumin ? 0.35 : 0 });

const FORMS = {
    // an upright runner on two long legs, with a counterweight tail and a beaked head on a bobbing neck
    biped(c) {
        const { s, r, pivot, bodyM, accM, sp } = c;
        const bw = s * 0.4, legL = s * 1.1, hipY = legL * 1.55;
        const torso = ball(bw, bodyM, 1, 1.05, 1.55, r() * 30, 0.1);
        torso.position.y = hipY + bw * 0.2;
        torso.rotation.x = -0.5;
        pivot.add(torso);
        const nl = s * (0.5 + sp.neck * 0.5);
        const neck = new THREE.Group();
        neck.position.set(0, hipY + bw * 0.95, bw * 0.75);
        neck.rotation.x = 0.55;
        pivot.add(neck);
        neck.add(mesh(new THREE.CylinderGeometry(bw * 0.17, bw * 0.28, nl, 6).translate(0, nl / 2, 0), bodyM));
        const head = new THREE.Group();
        head.position.y = nl;
        head.rotation.x = -0.4;
        neck.add(head);
        head.add(ball(bw, bodyM, 0.4, 0.37, 0.55, r() * 30, 0.08));
        head.add(mesh(new THREE.ConeGeometry(bw * 0.15, bw * 0.7, 5).rotateX(Math.PI / 2), accM, 0, -bw * 0.03, bw * 0.75));
        c.eyes(head, bw * 0.08, bw * 0.12, bw * 0.4, bw * 0.55);
        if (sp.crest || sp.horns) for (let i = 0; i < 3; i++) {
            const spike = mesh(new THREE.ConeGeometry(bw * 0.07, bw * (0.55 - i * 0.1), 4), accM, 0, bw * 0.4 - i * 0.02, -bw * 0.1 - i * bw * 0.16);
            spike.rotation.x = -0.5;
            head.add(spike);
        }
        for (const sx of [-1, 1]) {
            const arm = mesh(new THREE.CylinderGeometry(bw * 0.05, bw * 0.08, bw * 0.55, 4).translate(0, -bw * 0.27, 0), bodyM, sx * bw * 0.55, hipY + bw * 0.45, bw * 0.55);
            arm.rotation.set(0.9, 0, sx * 0.25);
            pivot.add(arm);
        }
        const t = mesh(new THREE.ConeGeometry(bw * 0.28, bw * 3.4, 5).rotateX(Math.PI).translate(0, -bw * 1.7, 0), accM, 0, hipY + bw * 0.1, -bw * 1.1);
        t.rotation.x = 1.5;
        pivot.add(t);
        c.tentacles.push({ m: t, base: 0, axis: 'z', amp: 0.3, rate: 2.2 });
        markings(c, hipY + bw * 0.2, 0, bw, bw * 1.05, bw * 1.5);
        addLegs(c, { pairs: 1, bw, bl: bw * 2, legL, hipY, thick: 1.25, xOff: 0.55, foot: 1.5 });
        return { hipY, radius: Math.max(hipY, bw * 3) * 0.8 };
    },
    // a low, heavy, tusked beast on four thick legs
    brute(c) {
        const { s, r, pivot, bodyM, accM, sp } = c;
        const bw = s * 0.7, bl = s * 1.2, legL = s * 0.42, hipY = legL * 1.5 + bw * 0.15;
        const torso = ball(bw, bodyM, 1, 0.9, bl / bw * 0.65, r() * 30, 0.14);
        torso.position.y = hipY;
        pivot.add(torso);
        const hump = ball(bw, bodyM, 0.7, 0.6, 0.6, r() * 30, 0.1);
        hump.position.set(0, hipY + bw * 0.6, bl * 0.2);
        pivot.add(hump);
        const head = new THREE.Group();
        head.position.set(0, hipY - bw * 0.05, bl * 0.72);
        pivot.add(head);
        head.add(ball(bw, bodyM, 0.62, 0.55, 0.7, r() * 30, 0.08));
        c.eyes(head, bw * 0.09, bw * 0.15, bw * 0.55, bw * 0.55);
        head.add(mesh(new THREE.SphereGeometry(bw * 0.2, 6, 5), accM, 0, -bw * 0.12, bw * 0.68));
        for (const sx of [-1, 1]) {
            const tusk = mesh(new THREE.ConeGeometry(bw * 0.1, bw * 0.9, 5).translate(0, bw * 0.45, 0), new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.5, flatShading: true }), sx * bw * 0.3, -bw * 0.25, bw * 0.45);
            tusk.rotation.set(0.9, 0, -sx * 0.45);
            head.add(tusk);
            const ear = mesh(new THREE.ConeGeometry(bw * 0.18, bw * 0.4, 4), accM, sx * bw * 0.5, bw * 0.38, -bw * 0.05);
            ear.rotation.z = -sx * 0.7;
            head.add(ear);
        }
        if (sp.tail) {
            const t = mesh(new THREE.ConeGeometry(bw * 0.12, bl * 0.5, 4).rotateX(Math.PI).translate(0, -bl * 0.25, 0), accM, 0, hipY + bw * 0.2, -bl * 0.65);
            t.rotation.x = 1.3;
            pivot.add(t);
            c.tentacles.push({ m: t, base: 0, axis: 'z', amp: 0.3, rate: 2 });
        }
        markings(c, hipY, 0, bw, bw * 0.9, bl * 0.65);
        addLegs(c, { pairs: 2, bw, bl, legL, hipY, thick: 1.7, xOff: 0.62, zSpan: 0.8, foot: 1.2 });
        return { hipY, radius: Math.max(bl, hipY) * 0.85 };
    },
    // a spidery walker: two body lumps, a small head with big eyes, feelers and six splayed legs
    insect(c) {
        const { s, r, pivot, bodyM, accM, sp } = c;
        const bw = s * 0.32, bl = s * 1.0, legL = s * 0.85, hipY = legL * 1.25;
        const thorax = ball(bw, bodyM, 1, 0.85, 1.3, r() * 30, 0.08);
        thorax.position.set(0, hipY, bl * 0.1);
        pivot.add(thorax);
        const abd = ball(bw, bodyM, 1.15, 1.0, 1.7, r() * 30, 0.08);
        abd.position.set(0, hipY + bw * 0.25, -bl * 0.5);
        abd.rotation.x = -0.2;
        pivot.add(abd);
        const head = new THREE.Group();
        head.position.set(0, hipY + bw * 0.1, bl * 0.5);
        pivot.add(head);
        head.add(ball(bw, bodyM, 0.55, 0.5, 0.55, r() * 30, 0.05));
        for (const sx of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(bw * 0.28, 8, 6), c.eyeM, sx * bw * 0.4, bw * 0.12, bw * 0.2));
        for (const sx of [-1, 1]) {
            const ant = mesh(new THREE.CylinderGeometry(bw * 0.02, bw * 0.04, bw * 1.8, 3).translate(0, bw * 0.9, 0), accM, sx * bw * 0.15, bw * 0.3, bw * 0.3);
            ant.rotation.set(0.9, 0, -sx * 0.35);
            head.add(ant);
            c.tentacles.push({ m: ant, base: 0.9, axis: 'x', amp: 0.35, rate: 2.5 + sx });
        }
        for (let i = 0; i < 4; i++) abd.add(mesh(new THREE.TorusGeometry(0.98 - Math.abs(i - 1.5) * 0.18, 0.05, 4, 12), accM, 0, 0, (i - 1.5) * 0.4));
        addLegs(c, { pairs: 3, bw: bw * 1.1, bl: bl * 0.7, legL, hipY, thick: 0.55, xOff: 0.5, splay: 0.55, zSpan: 1.0, z0: bl * 0.05 });
        return { hipY, radius: Math.max(bl, hipY) * 0.8 };
    },
    // a domed shell on stubby legs, a small head nosing out of the front
    shell(c) {
        const { s, r, pivot, bodyM, accM, sp } = c;
        const bw = s * 0.42, bl = s * 0.7, legL = s * 0.3, hipY = legL * 1.5;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 9, 0, TAU, 0, Math.PI / 2), accM);
        dome.scale.set(bw * 1.3, bw * 1.1, bl * 1.1);
        dome.position.y = hipY;
        pivot.add(dome);
        const under = ball(bw, bodyM, 1.15, 0.45, bl / bw * 0.95, r() * 30, 0.05);
        under.position.y = hipY;
        pivot.add(under);
        // plates: arcs across the dome, and a plant or two growing on it
        for (let i = 0; i < 4; i++) {
            const t = (i / 3 - 0.5) * 1.5;
            const k = Math.sqrt(Math.max(0.05, 1 - t * t));
            const arc = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 4, 14, Math.PI), bodyM);
            arc.scale.set(bw * 1.32 * k, bw * 1.12 * k, bw * 1.3 * k);
            arc.position.set(0, hipY, t * bl * 1.1);
            pivot.add(arc);
        }
        if (sp.spots) for (let i = 0; i < 3; i++) {
            const tuft = mesh(new THREE.ConeGeometry(bw * 0.07, bw * 0.4, 4), bodyM, (r() - 0.5) * bw, hipY + bw * 1.05, (r() - 0.5) * bl);
            pivot.add(tuft);
        }
        const head = new THREE.Group();
        head.position.set(0, hipY + bw * 0.1, bl * 1.1);
        pivot.add(head);
        head.add(mesh(new THREE.CylinderGeometry(bw * 0.2, bw * 0.28, bw * 0.5, 6).rotateX(Math.PI / 2).translate(0, 0, -bw * 0.1), bodyM));
        head.add(ball(bw, bodyM, 0.25, 0.22, 0.3, r() * 30, 0.06).translateZ(bw * 0.3));
        c.eyes(head, bw * 0.06, bw * 0.12, bw * 0.5, bw * 0.28);
        if (sp.tail) pivot.add(mesh(new THREE.ConeGeometry(bw * 0.12, bw * 0.55, 4).rotateX(-Math.PI / 2), accM, 0, hipY, -bl * 1.15));
        addLegs(c, { pairs: 2, bw, bl, legL, hipY, thick: 1.8, xOff: 0.8, zSpan: 1.3, foot: 1.3 });
        return { hipY, radius: Math.max(bl * 1.2, bw * 1.5) };
    },
    // a huge shaggy elephant of a thing: trunk, tusks, big flat ears
    mammoth(c) {
        const { s, r, pivot, bodyM, accM } = c;
        const bw = s * 0.4, bl = s * 1.15, legL = s * 0.6, hipY = legL * 1.5 + bw * 0.25;
        const torso = ball(bw, bodyM, 1, 0.95, bl / bw * 0.62, r() * 30, 0.14);
        torso.position.y = hipY;
        pivot.add(torso);
        const hump = ball(bw, bodyM, 0.8, 0.6, 0.65, r() * 30, 0.1);
        hump.position.set(0, hipY + bw * 0.55, bl * 0.3);
        pivot.add(hump);
        const head = new THREE.Group();
        head.position.set(0, hipY + bw * 0.1, bl * 0.72);
        pivot.add(head);
        head.add(ball(bw, bodyM, 0.65, 0.7, 0.7, r() * 30, 0.08));
        c.eyes(head, bw * 0.08, bw * 0.2, bw * 0.55, bw * 0.55);
        const tuskM = new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.5, flatShading: true });
        const trunk = new THREE.Group();
        trunk.position.set(0, -bw * 0.1, bw * 0.62);
        head.add(trunk);
        trunk.add(mesh(tube([[0, 0, 0], [0, -bw * 0.55, bw * 0.25], [0, -bw * 1.15, bw * 0.4], [0, -bw * 1.5, bw * 0.15]], bw * 0.2, bw * 0.1, 8, 6), bodyM));
        c.tentacles.push({ m: trunk, base: 0, axis: 'z', amp: 0.2, rate: 1.7 });
        for (const sx of [-1, 1]) {
            head.add(mesh(tube([[sx * bw * 0.35, -bw * 0.15, bw * 0.4], [sx * bw * 0.55, -bw * 0.6, bw * 0.7], [sx * bw * 0.5, -bw * 0.45, bw * 1.2], [sx * bw * 0.3, bw * 0.1, bw * 1.5]], bw * 0.09, bw * 0.03, 8, 5), tuskM));
            const ear = new THREE.Mesh(new THREE.CircleGeometry(bw * 0.55, 7), accM);
            ear.material = accM.clone();
            ear.material.side = THREE.DoubleSide;
            ear.position.set(sx * bw * 0.6, bw * 0.1, -bw * 0.15);
            ear.rotation.y = sx * 1.15;
            head.add(ear);
            c.tentacles.push({ m: ear, base: sx * 1.15, axis: 'y', amp: 0.25, rate: 2.3 });
        }
        const tail = mesh(new THREE.ConeGeometry(bw * 0.12, bl * 0.35, 4).rotateX(Math.PI).translate(0, -bl * 0.17, 0), bodyM, 0, hipY + bw * 0.25, -bl * 0.62);
        tail.rotation.x = 1.0;
        pivot.add(tail);
        markings(c, hipY, 0, bw, bw * 0.95, bl * 0.62);
        addLegs(c, { pairs: 2, bw, bl, legL, hipY, thick: 2.0, xOff: 0.62, zSpan: 0.85, foot: 1.3 });
        return { hipY, radius: Math.max(bl, hipY) * 0.8 };
    },
    // a squat pond-hopper with bulging eyes on top and a pale throat
    frog(c) {
        const { s, r, pivot, bodyM, accM, eyeM } = c;
        const br = s * 0.55, hipY = br * 1.2;
        const body = ball(br, bodyM, 1.2, 0.78, 1.25, r() * 30, 0.1);
        body.position.y = hipY;
        pivot.add(body);
        const throat = ball(br, accM, 0.7, 0.45, 0.6, 2, 0.04);
        throat.position.set(0, hipY - br * 0.35, br * 0.95);
        pivot.add(throat);
        for (const sx of [-1, 1]) {
            const eye = mesh(new THREE.SphereGeometry(br * 0.32, 8, 6), bodyM, sx * br * 0.5, hipY + br * 0.7, br * 0.65);
            pivot.add(eye);
            pivot.add(mesh(new THREE.SphereGeometry(br * 0.18, 8, 6), eyeM, sx * br * 0.55, hipY + br * 0.78, br * 0.85));
            pivot.add(mesh(new THREE.SphereGeometry(br * 0.15, 6, 4), accM, sx * br * 0.55, hipY - br * 0.2, br * 0.4));
            const leg = new THREE.Group();
            leg.position.set(sx * br * 0.95, hipY - br * 0.1, -br * 0.4);
            leg.add(mesh(new THREE.CylinderGeometry(br * 0.14, br * 0.3, hipY * 0.95, 5).translate(0, -hipY * 0.47, 0), accM));
            leg.add(mesh(new THREE.BoxGeometry(br * 0.5, br * 0.1, br * 0.7), accM, 0, -hipY * 0.95, br * 0.2));
            pivot.add(leg);
            c.legs.push({ hip: leg, phase: 0, sx, hop: true });
        }
        pivot.add(mesh(new THREE.BoxGeometry(br * 1.1, br * 0.05, br * 0.05), c.sp.glowEyes ? eyeM : new THREE.MeshStandardMaterial({ color: 0x201410 }), 0, hipY - br * 0.05, br * 1.2));
        return { hipY, radius: br * 1.7 };
    },
    // a tall bounder on big hind legs, balanced by a thick tail
    roo(c) {
        const { s, r, pivot, bodyM, accM } = c;
        const br = s * 0.5, hipY = br * 2.2;
        const body = ball(br, bodyM, 0.85, 1.35, 0.9, r() * 30, 0.1);
        body.position.y = hipY + br * 0.55;
        body.rotation.x = 0.3;
        pivot.add(body);
        const pouch = ball(br, accM, 0.55, 0.6, 0.35, 1, 0.03);
        pouch.position.set(0, hipY + br * 0.2, br * 0.55);
        pivot.add(pouch);
        const head = new THREE.Group();
        head.position.set(0, hipY + br * 1.75, br * 0.5);
        pivot.add(head);
        head.add(ball(br, bodyM, 0.38, 0.35, 0.52, r() * 30, 0.06));
        head.add(mesh(new THREE.SphereGeometry(br * 0.1, 6, 5), accM, 0, -br * 0.05, br * 0.52));
        c.eyes(head, br * 0.07, br * 0.1, br * 0.4, br * 0.4);
        for (const sx of [-1, 1]) {
            const ear = mesh(new THREE.ConeGeometry(br * 0.12, br * 0.8, 4), accM, sx * br * 0.2, br * 0.5, -br * 0.1);
            ear.rotation.z = -sx * 0.25;
            head.add(ear);
            c.tentacles.push({ m: ear, base: -sx * 0.25, axis: 'z', amp: 0.2, rate: 2.8 });
            const arm = mesh(new THREE.CylinderGeometry(br * 0.05, br * 0.08, br * 0.5, 4).translate(0, -br * 0.25, 0), bodyM, sx * br * 0.45, hipY + br * 1.2, br * 0.45);
            arm.rotation.x = 0.6;
            pivot.add(arm);
            const leg = new THREE.Group();
            leg.position.set(sx * br * 0.55, hipY, -br * 0.1);
            leg.add(mesh(new THREE.CylinderGeometry(br * 0.14, br * 0.3, hipY, 5).translate(0, -hipY / 2, 0), accM));
            leg.add(mesh(new THREE.BoxGeometry(br * 0.28, br * 0.1, br * 1.1), accM, 0, -hipY, br * 0.3));
            pivot.add(leg);
            c.legs.push({ hip: leg, phase: 0, sx, hop: true });
        }
        const tail = mesh(new THREE.ConeGeometry(br * 0.3, br * 2.4, 5).rotateX(Math.PI).translate(0, -br * 1.2, 0), bodyM, 0, hipY + br * 0.1, -br * 0.55);
        tail.rotation.x = 1.15;
        pivot.add(tail);
        return { hipY, radius: br * 2 };
    },
    // a glossy lantern-balloon with a little gondola and streamers
    balloon(c) {
        const { s, r, pivot, accM, eyeM, sp } = c;
        const br = s * 0.6, hipY = r.range(2.5, 6);
        const shell = new THREE.MeshStandardMaterial({ color: sp.body, emissive: sp.accent, emissiveIntensity: 0.4, roughness: 0.25, transparent: true, opacity: 0.85 });
        const bag = new THREE.Mesh(new THREE.SphereGeometry(br, 14, 10), shell);
        bag.scale.y = 1.15;
        bag.position.y = hipY + br * 1.1;
        pivot.add(bag);
        const core = mesh(new THREE.SphereGeometry(br * 0.4, 8, 6), eyeM, 0, hipY + br * 1.0, 0);
        pivot.add(core);
        for (const k of [0.5, 1.1, 1.7]) {
            const band = new THREE.Mesh(new THREE.TorusGeometry(br * Math.sqrt(Math.max(0.05, 1 - ((k - 1.1) / 1.2) ** 2)), br * 0.04, 4, 16), accM);
            band.rotation.x = Math.PI / 2;
            band.position.y = hipY + br * k;
            pivot.add(band);
        }
        const gondola = ball(br, accM, 0.3, 0.2, 0.3, r() * 20, 0.1);
        gondola.position.y = hipY - br * 0.2;
        pivot.add(gondola);
        c.eyes(gondola, br * 0.06, br * 0.05, br * 0.28, br * 0.25);
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + 0.4, l = br * r.range(1.4, 2.4);
            const st = new THREE.Group();
            st.position.set(Math.cos(a) * br * 0.55, hipY + br * 0.4, Math.sin(a) * br * 0.55);
            st.add(mesh(new THREE.CylinderGeometry(br * 0.03, br * 0.015, l, 4).translate(0, -l / 2, 0), accM));
            const flag = mesh(new THREE.PlaneGeometry(br * 0.3, br * 0.45).translate(0, -br * 0.22, 0), new THREE.MeshStandardMaterial({ color: sp.accent, side: THREE.DoubleSide, roughness: 0.7 }), 0, -l, 0);
            st.add(flag);
            pivot.add(st);
            c.tentacles.push({ m: st, base: 0, axis: i % 2 ? 'x' : 'z', amp: 0.3, rate: 1.3 + i * 0.25, ph: i });
        }
        return { hipY: hipY + br, radius: br * 1.4 };
    },
    // a flat manta of the sky: broad wings that beat very slowly, a long thin tail
    ray(c) {
        const { s, r, pivot, bodyM, accM, sp } = c;
        const br = s * 0.7, hipY = r.range(2.5, 6);
        const body = ball(br, bodyM, 0.42, 0.22, 0.75, r() * 30, 0.05);
        body.position.y = hipY;
        pivot.add(body);
        const head = ball(br, bodyM, 0.25, 0.18, 0.3, r() * 30, 0.04);
        head.position.set(0, hipY + br * 0.03, br * 0.7);
        pivot.add(head);
        c.eyes(head, br * 0.045, br * 0.05, br * 0.26, br * 0.25);
        const wm = new THREE.MeshStandardMaterial({ color: sp.body, emissive: sp.accent, emissiveIntensity: 0.25, roughness: 0.5, side: THREE.DoubleSide, flatShading: true, transparent: true, opacity: 0.92 });
        for (const sx of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(sx * br * 0.3, hipY, 0);
            wing.add(wingMesh([[0, 0.55 * br], [2.4 * br, 0.1 * br], [2.1 * br, -0.3 * br], [0.2 * br, -0.55 * br]], sx, wm));
            wing.add(wingMesh([[0.4 * br, 0.05 * br], [1.9 * br, -0.05 * br], [1.7 * br, -0.18 * br], [0.4 * br, -0.2 * br]], sx, accM.clone()).translateY(0.01));
            pivot.add(wing);
            c.tentacles.push({ m: wing, base: 0, axis: 'z', amp: 0.35 * sx, rate: 1.1 });
        }
        const tail = mesh(new THREE.ConeGeometry(br * 0.05, br * 3, 4).rotateX(-Math.PI / 2).translate(0, 0, -br * 1.5), accM, 0, hipY, -br * 0.6);
        pivot.add(tail);
        c.tentacles.push({ m: tail, base: 0, axis: 'y', amp: 0.25, rate: 1.4 });
        return { hipY, radius: br * 2.2 };
    },
    // a fat little moth with feathered feelers and four patterned wings
    moth(c) {
        const { s, r, pivot, bodyM, accM, sp, wings } = c;
        const bl = s;
        const body = ball(bl, bodyM, 0.12, 0.12, 0.3, r() * 30, 0.05);
        pivot.add(body);
        const head = mesh(new THREE.SphereGeometry(bl * 0.09, 8, 6), bodyM, 0, bl * 0.02, bl * 0.32);
        pivot.add(head);
        c.eyes(pivot, bl * 0.03, bl * 0.06, bl * 0.38, bl * 0.12);
        for (const sx of [-1, 1]) {
            const ant = mesh(new THREE.CylinderGeometry(bl * 0.005, bl * 0.012, bl * 0.35, 3).translate(0, bl * 0.17, 0), accM, sx * bl * 0.04, bl * 0.06, bl * 0.36);
            ant.rotation.set(0.9, 0, -sx * 0.5);
            pivot.add(ant);
            const f1 = ant.clone();
            f1.scale.set(1, 0.6, 1);
            f1.rotation.z += sx * 0.3;
            pivot.add(f1);
        }
        const fm = wingMat(sp.accent, c), hm = wingMat(sp.body, c);
        const eyeM = new THREE.MeshStandardMaterial({ color: 0xf6f0e0, side: THREE.DoubleSide, roughness: 0.6, emissive: sp.lumin ? 0xffffff : 0x000000, emissiveIntensity: 0.3 });
        for (const sx of [-1, 1]) {
            const fw = new THREE.Group();
            fw.add(wingMesh([[0, -0.2 * bl], [1.0 * bl, -0.35 * bl], [1.25 * bl, 0.05 * bl], [0.8 * bl, 0.5 * bl], [0, 0.3 * bl]], sx, fm));
            const spot = new THREE.Mesh(new THREE.CircleGeometry(bl * 0.16, 10), eyeM);
            spot.rotation.x = -Math.PI / 2;
            spot.position.set(sx * bl * 0.72, 0.01, bl * 0.03);
            fw.add(spot);
            pivot.add(fw);
            wings.push({ w: fw, sx });
            const hw = new THREE.Group();
            hw.add(wingMesh([[0, 0.15 * bl], [0.7 * bl, 0.35 * bl], [0.85 * bl, 0.7 * bl], [0.3 * bl, 0.65 * bl], [0, 0.4 * bl]], sx, hm));
            hw.position.y = -0.01;
            pivot.add(hw);
            wings.push({ w: hw, sx });
        }
        return { hipY: 0, radius: bl * 1.3 };
    },
    // a cat-sized dragon: a long coiling body, horned head, bat wings
    dragon(c) {
        const { s, r, pivot, bodyM, accM, sp, wings } = c;
        const bl = s * 1.1;
        pivot.add(mesh(tube([[0, 0, bl * 0.35], [0, 0.04 * bl, 0.1 * bl], [0, -0.03 * bl, -0.3 * bl], [0, 0.05 * bl, -0.7 * bl], [0, -0.02 * bl, -1.1 * bl]], bl * 0.075, bl * 0.012, 16, 6), bodyM));
        pivot.add(mesh(new THREE.ConeGeometry(bl * 0.05, bl * 0.15, 4).rotateX(-Math.PI / 2), accM, 0, -0.02 * bl, -1.15 * bl));
        const head = new THREE.Group();
        head.position.set(0, bl * 0.04, bl * 0.42);
        pivot.add(head);
        head.add(ball(bl, bodyM, 0.075, 0.06, 0.12, r() * 30, 0.04));
        head.add(mesh(new THREE.ConeGeometry(bl * 0.035, bl * 0.12, 5).rotateX(Math.PI / 2), accM, 0, -bl * 0.01, bl * 0.12));
        c.eyes(head, bl * 0.016, bl * 0.03, bl * 0.075, bl * 0.09);
        for (const sx of [-1, 1]) {
            const horn = mesh(new THREE.ConeGeometry(bl * 0.015, bl * 0.12, 4), accM, sx * bl * 0.035, bl * 0.055, -bl * 0.03);
            horn.rotation.set(-0.7, 0, -sx * 0.3);
            head.add(horn);
        }
        for (let i = 0; i < 6; i++) pivot.add(mesh(new THREE.ConeGeometry(bl * 0.02, bl * 0.06, 4), accM, 0, bl * (0.09 - i * 0.003), bl * (0.2 - i * 0.2)));
        const wm = wingMat(sp.accent, c);
        for (const sx of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(sx * bl * 0.05, bl * 0.04, bl * 0.12);
            wing.add(wingMesh([[0, 0.05 * bl], [0.6 * bl, -0.28 * bl], [1.3 * bl, -0.12 * bl], [1.1 * bl, 0.15 * bl], [0.85 * bl, 0.05 * bl], [0.65 * bl, 0.3 * bl], [0.35 * bl, 0.12 * bl], [0, 0.2 * bl]], sx, wm));
            wing.add(mesh(new THREE.CylinderGeometry(bl * 0.01, bl * 0.015, bl * 1.3, 4).rotateZ(sx * Math.PI / 2).translate(sx * bl * 0.65, 0, -bl * 0.12), bodyM));
            pivot.add(wing);
            wings.push({ w: wing, sx });
        }
        return { hipY: 0, radius: bl * 1.2 };
    },
    // a streamer-tailed glider: broad rounded wings and a long ribbon trailing behind
    kite(c) {
        const { s, r, pivot, bodyM, accM, sp, wings } = c;
        const bl = s;
        pivot.add(mesh(new THREE.ConeGeometry(bl * 0.15, bl * 0.8, 5).rotateX(Math.PI / 2), bodyM));
        c.eyes(pivot, bl * 0.04, bl * 0.04, bl * 0.35, bl * 0.12);
        pivot.add(mesh(new THREE.ConeGeometry(bl * 0.04, bl * 0.2, 4).rotateX(Math.PI / 2), accM, 0, -bl * 0.02, bl * 0.48));
        const pts = [];
        for (let i = 0; i < 6; i++) pts.push([Math.sin(i * 1.3) * bl * 0.12, Math.cos(i * 0.9) * bl * 0.05, -bl * (0.35 + i * 0.4)]);
        const ribbon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p))), 20, bl * 0.02, 4), accM);
        pivot.add(ribbon);
        pivot.add(mesh(new THREE.ConeGeometry(bl * 0.12, bl * 0.35, 3).rotateX(-Math.PI / 2), accM, 0, 0, -bl * 2.5));
        const wm = wingMat(sp.accent, c);
        for (const sx of [-1, 1]) {
            const wing = new THREE.Group();
            wing.add(wingMesh([[0, -0.3 * bl], [0.7 * bl, -0.45 * bl], [1.5 * bl, -0.2 * bl], [1.5 * bl, 0.1 * bl], [0.8 * bl, 0.35 * bl], [0, 0.25 * bl]], sx, wm));
            pivot.add(wing);
            wings.push({ w: wing, sx });
        }
        return { hipY: 0, radius: bl * 1.5 };
    },
    // a long smooth snake of many small segments
    snake(c) {
        const { s, r, pivot, bodyM, accM, segs, sp } = c;
        const sr = s * 0.28, n = 16;
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(sr * (1 - (i / n) ** 1.5 * 0.85), 8, 6), i % 3 === 1 && sp.stripes ? accM : bodyM);
            if (i === 0) m.scale.set(1.05, 0.8, 1.35);
            m.position.set(0, sr, -i * sr * 0.9);
            pivot.add(m);
            segs.push(m);
        }
        c.eyes(segs[0], sr * 0.2, sr * 0.4, sr * 0.55, sr * 1.0);
        const tongue = mesh(new THREE.BoxGeometry(sr * 0.05, sr * 0.04, sr * 0.9).translate(0, 0, sr * 0.45), accM, 0, -sr * 0.15, sr * 1.0);
        segs[0].add(tongue);
        c.tentacles.push({ m: tongue, base: 0, axis: 'y', amp: 0.3, rate: 9 });
        return { hipY: sr, radius: sr * n * 0.5 };
    },
    // a many-legged crawler with long feelers
    centipede(c) {
        const { s, r, pivot, bodyM, accM, segs } = c;
        const sr = s * 0.3, n = 11;
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(sr * (1 - Math.abs(i - 2) * 0.04), 8, 6), i % 2 ? accM : bodyM);
            m.scale.set(1, 0.75, 0.9);
            m.position.set(0, sr, -i * sr * 1.05);
            for (const sx of [-1, 1]) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.04, sr * 0.06, sr * 1.3, 3).translate(0, -sr * 0.55, 0), accM);
                leg.position.set(sx * sr * 0.6, -sr * 0.2, 0);
                leg.rotation.z = sx * 0.9;
                m.add(leg);
            }
            pivot.add(m);
            segs.push(m);
        }
        c.eyes(segs[0], sr * 0.14, sr * 0.3, sr * 0.7, sr * 0.9);
        for (const sx of [-1, 1]) {
            const ant = new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.02, sr * 0.04, sr * 2, 3).translate(0, sr * 1.0, 0), accM);
            ant.position.set(sx * sr * 0.3, sr * 0.2, sr * 0.7);
            ant.rotation.set(1.1, 0, -sx * 0.5);
            segs[0].add(ant);
            c.tentacles.push({ m: ant, base: 1.1, axis: 'x', amp: 0.3, rate: 3 + sx });
        }
        return { hipY: sr, radius: sr * n * 0.6 };
    },
    // a fat, shiny slug with eyes on stalks
    slug(c) {
        const { s, r, pivot, bodyM, accM, segs, eyeM, sp } = c;
        const sr = s * 0.5, n = 5;
        for (let i = 0; i < n; i++) {
            const k = 1 - Math.abs(i - 1) * 0.16;
            const m = new THREE.Mesh(new THREE.SphereGeometry(sr * k, 10, 8), bodyM);
            m.scale.set(1, 0.65, 1.15);
            m.position.set(0, sr * 0.65, -i * sr * 0.95);
            pivot.add(m);
            segs.push(m);
            if (i % 2 === 0 && sp.stripes) {
                const ring = mesh(new THREE.TorusGeometry(sr * k * 0.78, sr * 0.06, 4, 12), accM, 0, sr * 0.3, 0);
                ring.rotation.x = Math.PI / 2;
                m.add(ring);
            }
        }
        for (const sx of [-1, 1]) {
            const stalk = new THREE.Group();
            stalk.position.set(sx * sr * 0.35, sr * 0.2, sr * 0.8);
            stalk.add(mesh(new THREE.CylinderGeometry(sr * 0.05, sr * 0.08, sr * 0.9, 5).translate(0, sr * 0.45, 0), bodyM));
            stalk.add(mesh(new THREE.SphereGeometry(sr * 0.12, 8, 6), eyeM, 0, sr * 0.95, 0));
            stalk.rotation.set(0.3, 0, -sx * 0.3);
            segs[0].add(stalk);
            c.tentacles.push({ m: stalk, base: 0.3, axis: 'x', amp: 0.4, rate: 1.6 + sx * 0.3 });
        }
        return { hipY: sr * 0.65, radius: sr * n * 0.6 };
    },
};

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
    if (sp.lumin) {
        accM.emissive.copy(sp.accent);
        accM.emissiveIntensity = 0.45;
    }
    if (FORMS[sp.form]) {
        ({ hipY, radius } = FORMS[sp.form]({ sp, s, r, pivot, bodyM, accM, eyeM, eyes, legs, wings, segs, tentacles }));
    } else if (sp.plan === 'strider' || sp.plan === 'grazer') {
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
            // thick at the rump, tapering to a tip trailing out behind; tilted back once on x, and the
            // wag swings on z (the animation only writes z, so it can't tip the tail sideways)
            const t = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.18, bl * 0.8, 5).rotateX(Math.PI).translate(0, -bl * 0.4, 0), accM);
            t.position.set(0, hipY + bw * 0.2, -bl * 0.55);
            t.rotation.x = 1.4;
            pivot.add(t);
            tentacles.push({ m: t, base: 0, axis: 'z', amp: 0.35, rate: 2 });
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
            // +z is forward and a positive hip rotation.x swings the foot back, so the swing is subtracted:
            // the foot travels forward exactly while the knee is bent up (cos(ph) > 0), and back while planted
            l.hip.rotation.x = 0.3 - Math.sin(ph) * 0.55 * k;
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
    // (well back, so the torso leans on its face instead of being swallowed by it)
    g.add(mesh(lumpy(0.85, 7.7, 1, 0.9, 0.2), stone, 0, 0.5, -1.38));
    // the body sits back against it: pelvis at the foot, torso leaning back
    const torso = new THREE.Group();
    torso.position.set(0, 0.17, -0.1);
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
