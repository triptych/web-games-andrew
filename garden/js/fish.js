// What bites off the fishing pier: a small catalogue of sea fish, each with
// a few true facts, plus one garden legend that only rises after dark, and a
// little procedural model of each to hold up when it is landed.

import * as THREE from 'three';
import { canvas, toTexture } from './textures.js';
import { lerp, smoothstep, TAU } from './util.js';

/**
 * len: [min, max] length in cm; kg: weight of a fish of the mid length (it scales with length cubed).
 * shape: body height and width as fractions of length. pull: how hard and how often it darts
 * on the line (0 easy .. 1 hard). weight: how often it bites, out of all of them.
 */
export const SPECIES = [
    {
        id: 'mackerel', name: 'Atlantic Mackerel', latin: 'Scomber scombrus', rarity: 'Common', weight: 26,
        len: [26, 40], kg: 0.45, pull: 0.35,
        habitat: 'Open water over the shelf, in fast, glinting schools.',
        fact: 'Mackerel have no swim bladder to keep them afloat, so they must keep swimming or slowly sink.',
        colors: { back: '#1f6a6a', belly: '#e6edf0', fin: '#6f8f8a', mark: '#0d2424' }, pattern: 'waves',
        shape: { h: 0.2, w: 0.13, tail: 'fork', dorsal: 0.5 },
    },
    {
        id: 'mullet', name: 'Striped Red Mullet', latin: 'Mullus surmuletus', rarity: 'Common', weight: 20,
        len: [15, 32], kg: 0.25, pull: 0.25,
        habitat: 'Sandy and rocky bottoms close to shore.',
        fact: 'It feels for buried worms and shrimps with two long barbels under its chin, which it tucks away when it swims.',
        colors: { back: '#cf4a36', belly: '#f6cdb8', fin: '#e8916f', mark: '#f2c14a' }, pattern: 'stripes',
        shape: { h: 0.25, w: 0.14, tail: 'fork', dorsal: 0.5, barbels: true },
    },
    {
        id: 'wrasse', name: 'Ballan Wrasse', latin: 'Labrus bergylta', rarity: 'Common', weight: 18,
        len: [20, 45], kg: 0.8, pull: 0.45,
        habitat: 'Kelp and rocks beneath piers and harbour walls.',
        fact: 'Every ballan wrasse begins life as a female; some change into males years later. It crushes crabs and mussels with teeth in its throat.',
        colors: { back: '#6f4a2a', belly: '#d9a066', fin: '#8a5a32', mark: '#e9d39a' }, pattern: 'dots',
        shape: { h: 0.32, w: 0.15, tail: 'round', dorsal: 0.75 },
    },
    {
        id: 'bass', name: 'European Sea Bass', latin: 'Dicentrarchus labrax', rarity: 'Uncommon', weight: 12,
        len: [35, 70], kg: 2.0, pull: 0.65,
        habitat: 'Rocky shores and breaking surf.',
        fact: 'Bass hunt hardest at dawn and dusk and in rough, churned-up water, when small fish are easiest to catch.',
        colors: { back: '#55677a', belly: '#eef2f4', fin: '#7d8a96', mark: '#3a4652' }, pattern: 'plain',
        shape: { h: 0.26, w: 0.13, tail: 'fork', dorsal: 0.6, spiny: true },
    },
    {
        id: 'flounder', name: 'European Flounder', latin: 'Platichthys flesus', rarity: 'Uncommon', weight: 10,
        len: [20, 40], kg: 0.5, pull: 0.3,
        habitat: 'Lying flat on sand and mud, even up into estuaries.',
        fact: 'Flatfish hatch looking like any other fish. As they grow, one eye moves across the top of the head until both are on the same side.',
        colors: { back: '#7a6650', belly: '#efe6d6', fin: '#8d7a62', mark: '#d4883a' }, pattern: 'spots',
        shape: { h: 0.55, w: 0.05, tail: 'round', dorsal: 0, flat: true },
    },
    {
        id: 'garfish', name: 'Garfish', latin: 'Belone belone', rarity: 'Uncommon', weight: 8,
        len: [45, 80], kg: 0.6, pull: 0.75,
        habitat: 'Near the surface in summer, often leaping clear of it.',
        fact: 'Its bones are bright green, coloured by a pigment called biliverdin. It is quite safe to eat.',
        colors: { back: '#246b85', belly: '#eaf2f2', fin: '#4f8a99', mark: '#123a48' }, pattern: 'plain',
        shape: { h: 0.075, w: 0.06, tail: 'fork', dorsal: 0.25, beak: true },
    },
    {
        id: 'cod', name: 'Atlantic Cod', latin: 'Gadus morhua', rarity: 'Uncommon', weight: 9,
        len: [40, 90], kg: 3.0, pull: 0.55,
        habitat: 'Cold, deep water; the young come inshore over rough ground.',
        fact: 'A big female cod can release several million eggs in a single spawning season.',
        colors: { back: '#8f8256', belly: '#f2ead2', fin: '#9c8f62', mark: '#5c5232' }, pattern: 'mottle',
        shape: { h: 0.24, w: 0.17, tail: 'square', dorsal: 0.55, barbel: true, line: true },
    },
    {
        id: 'puffer', name: 'Guineafowl Puffer', latin: 'Arothron meleagris', rarity: 'Rare', weight: 4,
        len: [20, 40], kg: 0.9, pull: 0.5,
        habitat: 'Warm reefs, where it nibbles coral tips and sponges.',
        fact: 'It blows itself up into a ball by gulping water. Like most puffers it carries tetrodotoxin, a poison far deadlier than cyanide, so it goes straight back.',
        colors: { back: '#33302e', belly: '#d8d4cc', fin: '#4a4642', mark: '#f4f0e8' }, pattern: 'dots-fine',
        shape: { h: 0.6, w: 0.56, tail: 'round', dorsal: 0.3, spines: true },
    },
    {
        id: 'moonfin', name: 'Moonfin', latin: 'a garden legend', rarity: 'Legendary', weight: 0, night: 6,
        len: [30, 50], kg: 1.2, pull: 0.85, legend: true,
        habitat: 'The garden’s own waters, and only after dark.',
        fact: 'The old garden tale says its scales hold a little of the moonlight it rises to, and that it only takes the bait to see who is fishing.',
        colors: { back: '#9fd2ff', belly: '#f2fbff', fin: '#c9b6ff', mark: '#ffffff' }, pattern: 'shimmer', glow: '#7fd6ff',
        shape: { h: 0.5, w: 0.08, tail: 'fork', dorsal: 1.0, long: true },
    },
];

/** Pick what bites, weighted, with the Moonfin only at night. */
export function pickSpecies(night, r = Math.random) {
    const w = SPECIES.map((s) => s.weight + (night > 0.5 ? s.night || 0 : 0));
    let k = r() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < SPECIES.length; i++) if ((k -= w[i]) < 0) return SPECIES[i];
    return SPECIES[0];
}

/** One catch: the species with its own length and weight. */
export function rollCatch(sp, r = Math.random) {
    const u = Math.pow(r(), 1.6); // most are small, a few are big
    const cm = lerp(sp.len[0], sp.len[1], u);
    const mid = (sp.len[0] + sp.len[1]) / 2;
    const kg = sp.kg * Math.pow(cm / mid, 3) * (0.9 + r() * 0.2);
    return { species: sp, cm: Math.round(cm), kg: kg < 1 ? Math.round(kg * 1000) / 1000 : Math.round(kg * 100) / 100 };
}

// ------------------------------------------------------------- the model

/** The skin, laid out for a sphere: u runs round the body (tail to head on the right side), v from back to belly. */
function skinTexture(sp) {
    const W = 512, H = 256;
    const side = canvas(W / 2, H);
    const ctx = side.getContext('2d');
    const { back, belly, mark } = sp.colors;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, back);
    g.addColorStop(sp.shape.flat ? 0.75 : 0.42, back);
    g.addColorStop(sp.shape.flat ? 0.85 : 0.58, belly);
    g.addColorStop(1, belly);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W / 2, H);
    const w = W / 2;
    let seed = sp.id.length * 977;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = mark;
    ctx.strokeStyle = mark;
    if (sp.pattern === 'waves') {
        // the mackerel's wavy black bars over its back
        ctx.lineWidth = 5;
        for (let i = 0; i < 16; i++) {
            const x = w * (0.12 + i * 0.05);
            ctx.beginPath();
            for (let y = 6; y < H * 0.42; y += 4) ctx.lineTo(x + Math.sin(y * 0.09 + i) * 7, y);
            ctx.stroke();
        }
    } else if (sp.pattern === 'stripes') {
        ctx.globalAlpha = 0.85;
        for (const y of [0.36, 0.45, 0.54]) ctx.fillRect(w * 0.1, H * y, w * 0.8, H * 0.035);
    } else if (sp.pattern === 'dots' || sp.pattern === 'spots' || sp.pattern === 'dots-fine') {
        const n = sp.pattern === 'dots-fine' ? 260 : sp.pattern === 'spots' ? 40 : 90;
        const r0 = sp.pattern === 'dots-fine' ? 2.2 : sp.pattern === 'spots' ? 6 : 3.5;
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < n; i++) {
            ctx.beginPath();
            ctx.arc(rnd() * w, rnd() * H * (sp.pattern === 'dots-fine' ? 1 : sp.shape.flat ? 0.75 : 0.62), r0 * (0.6 + rnd() * 0.8), 0, TAU);
            ctx.fill();
        }
    } else if (sp.pattern === 'mottle') {
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 70; i++) {
            ctx.beginPath();
            ctx.arc(rnd() * w, rnd() * H * 0.5, 4 + rnd() * 8, 0, TAU);
            ctx.fill();
        }
    } else if (sp.pattern === 'shimmer') {
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        for (let y = 8; y < H; y += 10) for (let x = (y % 20) / 2; x < w; x += 14) {
            ctx.beginPath();
            ctx.arc(x, y, 6, 0.2, Math.PI - 0.2);
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
    if (sp.shape.line) {
        ctx.fillStyle = '#f6efd8';
        ctx.fillRect(w * 0.08, H * 0.4, w * 0.82, 3);
    }
    // the right side as drawn, then the left side mirrored (head to tail)
    const c = canvas(W, H);
    const cx = c.getContext('2d');
    cx.drawImage(side, 0, 0);
    cx.save();
    cx.translate(W, 0);
    cx.scale(-1, 1);
    cx.drawImage(side, 0, 0);
    cx.restore();
    return toTexture(c);
}

function finShape(kind) {
    const s = new THREE.Shape();
    if (kind === 'fork') {
        s.moveTo(0, 0); s.lineTo(-0.5, 0.42); s.lineTo(-0.36, 0); s.lineTo(-0.5, -0.42); s.lineTo(0, 0);
    } else if (kind === 'square') {
        s.moveTo(0, 0.05); s.lineTo(-0.38, 0.3); s.lineTo(-0.4, -0.3); s.lineTo(0, -0.05);
    } else {
        s.moveTo(0, 0.06);
        s.quadraticCurveTo(-0.5, 0.42, -0.42, 0);
        s.quadraticCurveTo(-0.5, -0.42, 0, -0.06);
    }
    return new THREE.ShapeGeometry(s, 6);
}

/**
 * A fish one metre long along +x (head forward) for `sp`, scaled to `cm`.
 * userData.tail is the tail's pivot, for flapping.
 */
export function makeFish(sp, cm) {
    const { h, w } = sp.shape;
    const skin = new THREE.MeshStandardMaterial({ map: skinTexture(sp), roughness: 0.32, metalness: 0.35 });
    if (sp.glow) {
        skin.emissive = new THREE.Color(sp.glow);
        skin.emissiveIntensity = 0.55;
        skin.emissiveMap = skin.map;
    }
    const finMat = new THREE.MeshStandardMaterial({ color: sp.colors.fin, roughness: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    if (sp.glow) {
        finMat.emissive = new THREE.Color(sp.glow);
        finMat.emissiveIntensity = 0.8;
    }
    const g = new THREE.Group();
    const body = new THREE.SphereGeometry(0.5, 40, 20);
    const pos = body.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const t = x + 0.5; // 0 at the tail, 1 at the nose
        const k = lerp(sp.shape.flat ? 0.3 : 0.16, 1, smoothstep(0, sp.shape.flat ? 0.4 : 0.6, t));
        pos.setXYZ(i, x, pos.getY(i) * h * 2 * k, pos.getZ(i) * w * 2 * k);
    }
    body.computeVertexNormals();
    g.add(new THREE.Mesh(body, skin));

    // tail on a pivot at the wrist
    const tail = new THREE.Group();
    tail.position.x = -0.46;
    const tf = new THREE.Mesh(finShape(sp.shape.tail), finMat);
    // (the fin shapes are 0.5 long and 0.84 tall)
    const th = sp.shape.flat ? h * 0.6 : Math.min(0.5, Math.max(0.2, h * 1.5));
    tf.scale.set(sp.shape.long ? 0.6 : 0.42, th / 0.84, 1);
    tail.add(tf);
    g.add(tail);
    g.userData.tail = tail;

    // dorsal and belly fins
    if (sp.shape.dorsal > 0) {
        const s = new THREE.Shape();
        const L = 0.18 + 0.32 * sp.shape.dorsal, H = (sp.shape.long ? 0.4 : 0.08 + h * 0.4) * (sp.shape.spiny ? 1.2 : 1);
        s.moveTo(L / 2, 0);
        if (sp.shape.spiny) for (let i = 1; i <= 8; i++) s.lineTo(L / 2 - (i / 8) * L, H * (i % 2 ? 1 : 0.45) * (1 - (0.5 * i) / 8));
        else s.quadraticCurveTo(L * 0.2, H * 1.2, -L / 2, H * 0.3);
        s.lineTo(-L / 2, 0);
        const df = new THREE.Mesh(new THREE.ShapeGeometry(s, 6), finMat);
        df.position.set(-0.02, h * 0.92, 0);
        g.add(df);
        if (sp.shape.long || sp.shape.flat) {
            const af = df.clone();
            af.scale.y = -0.8;
            af.position.y = -h * 0.92;
            g.add(af);
        }
    }
    if (sp.shape.flat) {
        // flatfish carry a frill of fin all round
        const frill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), finMat);
        frill.scale.set(0.5, h * 1.1, 1);
        g.add(frill);
    }
    // pectoral fins
    for (const sd of [-1, 1]) {
        const pf = new THREE.Mesh(finShape('round'), finMat);
        pf.scale.set(0.22, 0.16, 1);
        pf.position.set(0.22, -h * 0.25, sd * w * 0.82);
        pf.rotation.y = sd * 0.5;
        g.add(pf);
    }
    // eyes: on both sides, or both on one side for a flatfish
    const eyeW = new THREE.MeshStandardMaterial({ color: sp.legend ? '#e8f8ff' : '#f2e6b8', roughness: 0.2 });
    const eyeB = new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.1, metalness: 0.4 });
    const er = 0.03 + h * 0.04;
    const eyes = sp.shape.flat ? [[0.34, h * 0.32, 1], [0.3, h * 0.6, 1]] : [[0.38, h * 0.18, 1], [0.38, h * 0.18, -1]];
    for (const [ex, ey, sd] of eyes) {
        const t = ex + 0.5;
        const half = w * Math.sqrt(Math.max(0, 1 - (ex / 0.5) ** 2)) * lerp(0.16, 1, smoothstep(0, 0.6, t));
        const e = new THREE.Mesh(new THREE.SphereGeometry(er, 12, 8), eyeW);
        e.position.set(ex, ey, sd * (half + (sp.shape.flat ? 0.01 : er * 0.2)));
        e.scale.z = 0.5;
        const pu = new THREE.Mesh(new THREE.SphereGeometry(er * 0.55, 10, 6), eyeB);
        pu.position.z = sd * er * 0.75;
        e.add(pu);
        g.add(e);
    }
    // extras: a beak, barbels, spines
    if (sp.shape.beak) {
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.2, 6).rotateZ(-Math.PI / 2), skin);
        beak.position.x = 0.58;
        g.add(beak);
    }
    if (sp.shape.barbels || sp.shape.barbel) {
        for (const sd of sp.shape.barbels ? [-1, 1] : [0]) {
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.09, 4), finMat);
            b.position.set(0.42, -h * 0.55, sd * w * 0.3);
            b.rotation.z = 0.5;
            g.add(b);
        }
    }
    if (sp.shape.spines) {
        const spike = new THREE.ConeGeometry(0.012, 0.05, 4);
        for (let i = 0; i < 70; i++) {
            const a = i * 2.39996, y = 1 - (2 * (i + 0.5)) / 70, r = Math.sqrt(1 - y * y);
            const n = new THREE.Vector3(Math.cos(a) * r * 0.5, y * h, Math.sin(a) * r * w);
            if (n.x < -0.3) continue;
            const m = new THREE.Mesh(spike, finMat);
            m.position.copy(n);
            m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().normalize());
            g.add(m);
        }
    }
    g.scale.setScalar(cm / 100);
    return g;
}
