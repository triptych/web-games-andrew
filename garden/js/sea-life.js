// Who lives in the sea under the Moon Fountain: a small catalogue of real
// animals, each with a true fact for its card, and the models and motion for
// them. Fish swim in schools (one instanced mesh per school, tails wagged in
// the vertex shader); jellyfish drift in blooms and glow after dark; turtles,
// manta rays and, very rarely, a humpback whale pass by on their own. They are
// spawned ahead of the submarine at the edge of the murk and let go once left
// far behind, so the sea never runs out of them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, noise2, clamp, lerp, smoothstep, damp, angleDiff, TAU } from './util.js';
import { softGlow } from './textures.js';
import { seabedY, biomeAt } from './sea-reef.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);

// ------------------------------------------------------------------ the catalogue

/**
 * kind: school | jelly | turtle | manta | whale. size: length in metres (bell width for jellies).
 * where: weights by floor for spawning. see: how near it must come to go in the log.
 */
export const SEA_LIFE = [
    {
        id: 'chromis', name: 'Blue-green Chromis', latin: 'Chromis viridis', rarity: 'Common', kind: 'school',
        size: 0.09, count: [26, 44], radius: 3.2, speed: [0.5, 0.9], where: { reef: 4 }, see: 16,
        shape: { h: 0.38, w: 0.14 }, metal: 0.35,
        paint: (x, y) => (y > 0 ? C('#53d8c8') : C('#c8fbff')),
        fact: 'Whole clouds of them hover over a branching coral and dive into it together the moment anything big comes near.',
        habitat: 'Over branching coral on shallow reefs.',
    },
    {
        id: 'tang', name: 'Yellow Tang', latin: 'Zebrasoma flavescens', rarity: 'Common', kind: 'school',
        size: 0.18, count: [7, 13], radius: 2.6, speed: [0.5, 0.9], where: { reef: 3, sand: 1, rock: 1 }, see: 18,
        shape: { h: 0.62, w: 0.11 }, metal: 0.1,
        paint: (x) => (x < -0.4 ? C('#fff2b0') : C('#ffd21f')),
        fact: 'A sharp, scalpel-like spine on each side of its tail gives the surgeonfish family their name. It spends its days grazing algae off the reef.',
        habitat: 'Grazing the tops of shallow reefs.',
    },
    {
        id: 'bluetang', name: 'Blue Tang', latin: 'Paracanthurus hepatus', rarity: 'Uncommon', kind: 'school',
        size: 0.22, count: [4, 9], radius: 2.2, speed: [0.6, 1.0], where: { reef: 2 }, see: 18,
        shape: { h: 0.5, w: 0.12 }, metal: 0.15,
        paint: (x, y) => (x < -0.42 ? C('#ffd21f') : y > 0.1 && x > -0.35 && x < 0.3 && Math.abs(y - 0.45) < 0.28 ? C('#101830') : C('#2a5ae0')),
        fact: 'It is also called the palette surgeonfish, for the dark marking on its side shaped like a painter’s palette.',
        habitat: 'Reef edges with good hiding holes.',
    },
    {
        id: 'butterfly', name: 'Copperband Butterflyfish', latin: 'Chelmon rostratus', rarity: 'Uncommon', kind: 'school',
        size: 0.16, count: [2, 5], radius: 1.6, speed: [0.4, 0.7], where: { reef: 2, rock: 1 }, see: 14,
        shape: { h: 0.6, w: 0.09 }, metal: 0.1,
        paint: (x, y) => (x < -0.15 && x > -0.32 && y > 0.25 ? C('#101010') : Math.abs(Math.sin(x * 15)) > 0.7 ? C('#f08a2a') : C('#f6f2ea')),
        fact: 'The dark eyespot near its tail may fool a hunter into striking at the wrong end. Its long snout picks food from deep inside cracks in the coral.',
        habitat: 'Picking at crevices in coral and rock.',
    },
    {
        id: 'parrot', name: 'Stoplight Parrotfish', latin: 'Sparisoma viride', rarity: 'Uncommon', kind: 'school',
        size: 0.45, count: [2, 4], radius: 2.2, speed: [0.5, 0.8], where: { reef: 1.5, rock: 1 }, see: 22,
        shape: { h: 0.34, w: 0.16 }, metal: 0.2,
        paint: (x, y) => (x > 0.25 && y < 0.2 ? C('#ff8fb8') : x < -0.42 ? C('#f2c43a') : C('#2ec4a0')),
        fact: 'Parrotfish bite off coral with fused, beak-like teeth and grind it to powder. Much of the white sand on tropical beaches has passed through one.',
        habitat: 'Crunching along the reef by day.',
    },
    {
        id: 'sardine', name: 'European Sardine', latin: 'Sardina pilchardus', rarity: 'Common', kind: 'school',
        size: 0.16, count: [60, 110], radius: 5.5, speed: [1.0, 1.6], where: { sand: 3, kelp: 2, rock: 2 }, see: 24,
        shape: { h: 0.2, w: 0.1 }, metal: 0.75,
        paint: (x, y) => (y > 0.25 ? C('#3a6a8a') : C('#e6eef2')),
        fact: 'When a hunter comes close, the whole school packs itself into a tight, spinning ball, so that no single fish is easy to pick out.',
        habitat: 'Open water, in schools thousands strong.',
    },
    {
        id: 'garibaldi', name: 'Garibaldi', latin: 'Hypsypops rubicundus', rarity: 'Uncommon', kind: 'school',
        size: 0.26, count: [1, 3], radius: 1.8, speed: [0.3, 0.6], where: { kelp: 3 }, see: 18,
        shape: { h: 0.42, w: 0.15 }, metal: 0.15,
        paint: () => C('#ff6a10'),
        fact: 'The state marine fish of California. Males tend a nest of red algae and will chase off fish many times their size, and divers too.',
        habitat: 'Rocky floors in the kelp forest.',
    },
    {
        id: 'clown', name: 'Clownfish', latin: 'Amphiprion ocellaris', rarity: 'Uncommon', kind: 'school',
        size: 0.09, count: [2, 4], radius: 0.45, speed: [0, 0], where: {}, see: 9,
        shape: { h: 0.34, w: 0.16 }, metal: 0.15,
        paint: (x) => {
            for (const b of [0.28, -0.02, -0.34]) {
                const d = Math.abs(x - b);
                if (d < 0.05) return C('#ffffff');
                if (d < 0.075) return C('#141414');
            }
            return C('#ff6e14');
        },
        fact: 'A coat of mucus keeps its anemone from stinging it. Every clownfish hatches male, and the biggest in a group becomes the female.',
        habitat: 'Among the tentacles of a sea anemone.',
    },
    {
        id: 'moonjelly', name: 'Moon Jelly', latin: 'Aurelia aurita', rarity: 'Common', kind: 'jelly',
        size: 0.45, count: [5, 10], color: '#dfe8ff', glow: '#9fc8ff', where: { sand: 2, kelp: 1, reef: 1, rock: 1 }, see: 16,
        fact: 'It has no brain, no heart and no bones. The four pale rings you can see through its bell are where it makes its eggs.',
        habitat: 'Drifting in open water, often in great blooms.',
    },
    {
        id: 'purplejelly', name: 'Purple-striped Jelly', latin: 'Chrysaora colorata', rarity: 'Uncommon', kind: 'jelly',
        size: 0.7, count: [3, 6], color: '#e8b8ff', glow: '#c070ff', where: { sand: 1, kelp: 1, rock: 1 }, see: 18,
        fact: 'Young crabs sometimes hitch a ride on its bell and help themselves to the scraps of its meals.',
        habitat: 'Cool coastal water.',
    },
    {
        id: 'turtle', name: 'Green Sea Turtle', latin: 'Chelonia mydas', rarity: 'Rare', kind: 'turtle',
        size: 1.1, where: { reef: 2, sand: 2, kelp: 1 }, see: 24,
        fact: 'It is named not for its shell but for the green colour of its fat, from a lifetime of eating seagrass and algae.',
        habitat: 'Seagrass meadows and reefs.',
    },
    {
        id: 'manta', name: 'Reef Manta Ray', latin: 'Mobula alfredi', rarity: 'Rare', kind: 'manta',
        size: 1.0, where: { sand: 2, reef: 1, rock: 1 }, see: 32,
        fact: 'Mantas have the biggest brain for their size of any fish, and queue at reef “cleaning stations” for little fish to pick them clean.',
        habitat: 'Gliding over reefs and sandy channels.',
    },
    {
        id: 'humpback', name: 'Humpback Whale', latin: 'Megaptera novaeangliae', rarity: 'Legendary', kind: 'whale',
        size: 13, where: {}, see: 90,
        fact: 'Male humpbacks sing long, slow songs. Every male in a population sings the same song, and it changes a little from year to year.',
        habitat: 'Passing through, on a journey of thousands of miles.',
    },
];
export const BY_ID = Object.fromEntries(SEA_LIFE.map((s) => [s.id, s]));

// ------------------------------------------------------------------ models

const FISH_TIME = { value: 0 };

/** A fish one metre long along +x, coloured by its species' `paint(x, yNorm)`. */
function fishGeometry(sp) {
    const { h, w } = sp.shape;
    const body = new THREE.SphereGeometry(0.5, 12, 8);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const k = lerp(0.18, 1, smoothstep(0, 0.6, x + 0.5));
        p.setXYZ(i, x, p.getY(i) * h * 2 * k, p.getZ(i) * w * 2 * k);
    }
    const tri = (pts) => {
        const g = new THREE.BufferGeometry();
        const a = pts.flat();
        // both faces
        const back = [];
        for (let i = pts.length - 3; i >= 0; i -= 3) back.push(...pts[i + 2], ...pts[i + 1], ...pts[i]);
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...back], 3));
        return g;
    };
    const th = Math.min(0.5, Math.max(0.2, h * 1.3));
    const tail = tri([[-0.44, 0, 0], [-0.74, th, 0], [-0.62, 0, 0], [-0.44, 0, 0], [-0.62, 0, 0], [-0.74, -th, 0]]);
    const dorsal = tri([[0.18, h * 0.85, 0], [-0.3, h * 1.25, 0], [-0.32, h * 0.55, 0]]);
    body.computeVertexNormals();
    const parts = [body.toNonIndexed(), tail, dorsal];
    for (const g of parts) {
        g.deleteAttribute('uv');
        if (!g.attributes.normal) g.computeVertexNormals();
    }
    const g = mergeGeometries(parts, false);
    const col = [];
    const pp = g.attributes.position;
    for (let i = 0; i < pp.count; i++) {
        const c = sp.paint(pp.getX(i), pp.getY(i) / h);
        col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    for (const q of parts) q.dispose();
    body.dispose();
    return g;
}

function fishMaterial(sp) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: lerp(0.55, 0.25, sp.metal), metalness: sp.metal, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = FISH_TIME;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
float fid = float(gl_InstanceID);
float sw = 1.0 - smoothstep(-0.75, 0.25, position.x);
transformed.z += sin(uTime * (7.0 + mod(fid, 5.0)) + fid * 1.37 + position.x * 4.0) * 0.14 * sw;`);
    };
    m.customProgramCacheKey = () => 'garden-fish-1';
    return m;
}

function shellColors(g, fn) {
    const p = g.attributes.position, n = g.attributes.normal;
    const col = [];
    const v = new V3(), nn = new V3();
    for (let i = 0; i < p.count; i++) {
        const c = fn(v.fromBufferAttribute(p, i), nn.fromBufferAttribute(n, i));
        col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
}

function turtleModel() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const skin = new THREE.MeshStandardMaterial({ color: '#7a8a5a', roughness: 0.7 });
    const shell = shellColors(new THREE.SphereGeometry(0.5, 22, 12).scale(1.1, 0.42, 0.85), (v, n) => {
        const plate = Math.abs(Math.sin(v.x * 11 + Math.sin(v.z * 7))) * Math.abs(Math.sin(v.z * 12 + Math.sin(v.x * 5)));
        return n.y < -0.3 ? C('#e8d8a0') : C('#5a4a26').lerp(C('#9a8a46'), plate);
    });
    g.add(new THREE.Mesh(shell, mat));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8).scale(1.3, 0.9, 1), skin);
    head.position.set(0.62, 0.04, 0);
    g.add(head);
    const flips = [];
    for (const [x, z, len, front] of [[0.28, 0.36, 0.55, true], [0.28, -0.36, 0.55, true], [-0.42, 0.26, 0.26, false], [-0.42, -0.26, 0.26, false]]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0, z);
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6).scale(len * 0.45, 0.06, len), skin);
        f.position.z = Math.sign(z) * len * 0.45;
        f.rotation.y = Math.sign(z) * (front ? 0.55 : 0.9);
        pivot.add(f);
        g.add(pivot);
        flips.push({ pivot, side: Math.sign(z), front });
    }
    g.userData.flips = flips;
    return g;
}

function mantaModel() {
    const span = 2.2;
    const geo = new THREE.PlaneGeometry(2, span * 2, 10, 20).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        // half-span along the body: wide behind the head, narrow at both ends
        const hs = x > 0.1 ? lerp(span, 0.45, smoothstep(0.1, 1, x)) : lerp(span, 0.15, smoothstep(0.1, -1, x) ** 0.8);
        const zz = (z / span) * hs;
        const u = zz / Math.max(hs, 1e-3);
        const sweep = -(u * u) * 0.55;   // wingtips swept back
        p.setXYZ(i, x + sweep, 0.16 * (1 - u * u) * (1 - x * x), zz);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: '#2a3036', roughness: 0.55, side: THREE.DoubleSide });
    const flap = { value: 0 };
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uFlap = flap;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uFlap;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
float az = abs(position.z);
transformed.y += sin(uFlap - az * 0.8) * pow(az / 2.2, 1.5) * 0.8;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.82, 0.84, 0.86);`);
    };
    mat.customProgramCacheKey = () => 'garden-manta-1';
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.04, 1.6, 5).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a3036' }));
    tail.position.x = -1.7;
    g.add(tail);
    for (const sd of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6).scale(0.5, 0.06, 0.12), mat);
        lobe.position.set(1.05, 0.02, sd * 0.38);
        lobe.rotation.y = sd * 0.3;
        g.add(lobe);
    }
    g.userData.flap = flap;
    return g;
}

function whaleModel() {
    const prof = [[0, -1], [0.1, -0.92], [0.32, -0.6], [0.7, -0.15], [0.88, 0.25], [0.8, 0.62], [0.55, 0.88], [0.22, 0.99], [0, 1]];
    const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18).rotateZ(-Math.PI / 2);
    lathe.scale(6.5, 1.3, 1.5);
    shellColors(lathe, (v, n) => (n.y < -0.25 ? C('#c9ced2').multiplyScalar(0.8 + 0.2 * Math.abs(Math.sin(v.z * 30))) : C('#3a4450')));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(lathe, mat));
    const finMat = new THREE.MeshStandardMaterial({ color: '#c8ccd0', roughness: 0.6 });
    for (const sd of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6).scale(1.0, 0.12, 4.4), finMat);
        fin.position.set(2.2, -0.7, sd * 2.6);
        fin.rotation.set(sd * -0.5, sd * 0.6, 0);
        g.add(fin);
    }
    const flukes = new THREE.Group();
    flukes.position.x = -6.3;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6).scale(1.4, 0.12, 4.2), new THREE.MeshStandardMaterial({ color: '#2e3640', roughness: 0.6 }));
    fl.position.x = -0.5;
    flukes.add(fl);
    g.add(flukes);
    g.userData.flukes = flukes;
    return g;
}

function jellyModel(sp, r) {
    const g = new THREE.Group();
    const bellMat = new THREE.MeshStandardMaterial({
        color: sp.color, emissive: sp.glow, emissiveIntensity: 0.3, roughness: 0.25,
        transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
    });
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 9, 0, TAU, 0, Math.PI * 0.52), bellMat);
    bell.scale.y = 0.7;
    g.add(bell);
    if (sp.id === 'moonjelly') {
        const ringMat = new THREE.MeshBasicMaterial({ color: '#ffb8d8', transparent: true, opacity: 0.7, depthWrite: false });
        for (let k = 0; k < 4; k++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 14), ringMat);
            const a = (k / 4) * TAU + 0.78;
            ring.position.set(Math.cos(a) * 0.14, 0.18, Math.sin(a) * 0.14);
            ring.rotation.x = Math.PI / 2;
            bell.add(ring);
        }
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: sp.glow, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(1.8, 1.8, 1);
    glow.position.y = 0.1;
    g.add(glow);
    // tentacles: lines, bent each frame
    const nt = sp.id === 'moonjelly' ? 10 : 8, seg = 10;
    const len = sp.id === 'moonjelly' ? 0.5 : 2.2;
    const tg = new THREE.BufferGeometry();
    const arr = new Float32Array(nt * (seg - 1) * 2 * 3);
    tg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const lines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: sp.glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    lines.frustumCulled = false;
    g.add(lines);
    g.userData = { bell, bellMat, glow, lines, nt, seg, len, phase: r() * TAU };
    return g;
}

// ------------------------------------------------------------------ creatures

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3(), _d = new V3();

/** Keep a height within a band over the floor and below the surface. */
function bandY(x, z, lo, hi) {
    const f = seabedY(x, z);
    return { lo: Math.min(f + lo, -3), hi: Math.min(f + hi, -2.5) };
}

class School {
    constructor(sp, at, r, assets, anchor = null) {
        this.sp = sp;
        this.kind = 'school';
        this.anchor = anchor;
        const n = r.int(sp.count[0], sp.count[1]);
        this.mesh = new THREE.InstancedMesh(assets.geo, assets.mat, n);
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.pos = at.clone();
        this.heading = r() * TAU;
        this.speed = lerp(sp.speed[0], sp.speed[1], r());
        this.seed = r() * 1000;
        this.radius = sp.radius;
        this.fish = [];
        const R = sp.radius;
        for (let i = 0; i < n; i++) {
            const a = r() * TAU, u = r() * 2 - 1, d = Math.cbrt(r());
            const sq = Math.sqrt(1 - u * u);
            this.fish.push({
                off: new V3(Math.cos(a) * sq * R * d, u * R * 0.45 * d, Math.sin(a) * sq * R * d),
                ph: r() * TAU,
                sc: sp.size * (0.85 + r() * 0.3),
                yaw: 0,
                push: new V3(),
            });
        }
        this.band = sp.id === 'sardine' ? [4, 14] : sp.id === 'chromis' ? [1.5, 4] : [1.5, 6];
        this.update(0, 0, null);
    }

    update(dt, t, sub) {
        const sp = this.sp;
        if (!this.anchor) {
            this.heading += noise2(t * 0.08, this.seed) * 0.9 * dt;
            // shy of the submarine
            let flee = 0;
            if (sub) {
                const dx = this.pos.x - sub.x, dz = this.pos.z - sub.z, d = Math.hypot(dx, dz);
                if (d < 12) {
                    const away = Math.atan2(-dz, dx);
                    this.heading += angleDiff(this.heading, away) * dt * 1.2;
                    flee = (12 - d) / 12;
                }
            }
            const v = this.speed * (1 + flee * 1.5);
            this.pos.x += Math.cos(this.heading) * v * dt;
            this.pos.z -= Math.sin(this.heading) * v * dt;
            const b = bandY(this.pos.x, this.pos.z, this.band[0], this.band[1]);
            const target = clamp(this.pos.y, b.lo, b.hi);
            this.pos.y = damp(this.pos.y, target, 0.8, dt);
        }
        const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
        for (let i = 0; i < this.fish.length; i++) {
            const f = this.fish[i];
            const w = t * 0.6 + f.ph;
            // orbit a little within the school
            const ox = f.off.x + Math.sin(w) * 0.25 * this.radius * 0.3, oy = f.off.y + Math.sin(w * 1.3) * 0.15, oz = f.off.z + Math.cos(w * 0.8) * 0.25 * this.radius * 0.3;
            _p.set(this.pos.x + ox * ch + oz * sh, this.pos.y + oy, this.pos.z - ox * sh + oz * ch);
            let yaw = this.heading + Math.sin(w * 0.9) * 0.25;
            if (this.anchor) yaw = this.heading + w * 0.6;
            // scatter from the submarine's nose
            if (sub) {
                _d.subVectors(_p, sub);
                const d = _d.length(), R = 2.6;
                if (d < R) f.push.addScaledVector(_d.normalize(), (R - d) * 2.2 * dt);
            }
            f.push.multiplyScalar(Math.exp(-0.6 * dt));
            _p.add(f.push);
            f.yaw = yaw;
            _q.setFromEuler(_e.set(0, yaw, Math.sin(w * 1.7) * 0.08));
            _s.setScalar(f.sc);
            this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.mesh.dispose();
    }
}

class JellyBloom {
    constructor(sp, at, r) {
        this.sp = sp;
        this.kind = 'jelly';
        this.pos = at.clone();
        this.radius = 6;
        this.group = new THREE.Group();
        this.jellies = [];
        const n = r.int(sp.count[0], sp.count[1]);
        for (let i = 0; i < n; i++) {
            const m = jellyModel(sp, r);
            const s = sp.size * (0.7 + r() * 0.6);
            m.scale.setScalar(s);
            const a = r() * TAU, d = r() * 6;
            m.position.set(at.x + Math.cos(a) * d, at.y + (r() - 0.5) * 5, at.z + Math.sin(a) * d);
            m.rotation.set((r() - 0.5) * 0.4, r() * TAU, (r() - 0.5) * 0.4);
            this.group.add(m);
            this.jellies.push({ m, vy: 0, drift: new V3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.12) });
        }
    }

    update(dt, t, sub, night) {
        let cx = 0, cy = 0, cz = 0;
        for (const j of this.jellies) {
            const u = j.m.userData;
            const ph = t * 1.6 + u.phase;
            const pulse = Math.sin(ph);
            u.bell.scale.set(1 + pulse * 0.09, 0.7 * (1 - pulse * 0.13), 1 + pulse * 0.09);
            const thrust = Math.max(0, Math.cos(ph)) * 0.22;
            const b = bandY(j.m.position.x, j.m.position.z, 2.5, 30);
            const wander = Math.sin(t * 0.07 + u.phase) * 0.08;
            j.vy = damp(j.vy, thrust + wander - (j.m.position.y > b.hi - 1 ? 0.3 : 0) + (j.m.position.y < b.lo ? 0.3 : 0), 2, dt);
            j.m.position.y += j.vy * dt;
            j.m.position.addScaledVector(j.drift, dt);
            u.bellMat.emissiveIntensity = 0.25 + night * 1.6;
            u.glow.material.opacity = 0.12 + night * 0.5;
            // trailing tentacles
            const arr = u.lines.geometry.attributes.position.array;
            let k = 0;
            for (let i = 0; i < u.nt; i++) {
                const a = (i / u.nt) * TAU;
                const r0 = 0.42 * (1 + pulse * 0.09);
                let px = Math.cos(a) * r0, py = 0, pz = Math.sin(a) * r0;
                for (let s = 1; s < u.seg; s++) {
                    const f = s / (u.seg - 1);
                    const nx = Math.cos(a) * r0 * (1 - f * 0.6) + Math.sin(t * 1.3 + s * 0.6 + i) * 0.05 * s;
                    const ny = -f * u.len - j.vy * f * 0.6;
                    const nz = Math.sin(a) * r0 * (1 - f * 0.6) + Math.cos(t * 1.1 + s * 0.5 + i) * 0.05 * s;
                    arr[k++] = px; arr[k++] = py; arr[k++] = pz;
                    arr[k++] = nx; arr[k++] = ny; arr[k++] = nz;
                    px = nx; py = ny; pz = nz;
                }
            }
            u.lines.geometry.attributes.position.needsUpdate = true;
            cx += j.m.position.x;
            cy += j.m.position.y;
            cz += j.m.position.z;
        }
        const n = this.jellies.length || 1;
        this.pos.set(cx / n, cy / n, cz / n);
    }

    /** The nearest jelly the ray passes through, if any. */
    hit(ray) {
        let best = Infinity;
        for (const j of this.jellies) {
            const t = raySphere(ray, j.m.position, j.m.scale.x * 0.8);
            if (t < best) best = t;
        }
        return best;
    }

    dispose() {
        this.group.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
        });
    }
}

class Swimmer {
    /** One big animal: a turtle, a manta or a whale. */
    constructor(sp, at, heading, r) {
        this.sp = sp;
        this.kind = sp.kind;
        this.pos = at.clone();
        this.heading = heading;
        this.seed = r() * 1000;
        this.group = sp.kind === 'turtle' ? turtleModel() : sp.kind === 'manta' ? mantaModel() : whaleModel();
        const s = sp.kind === 'manta' ? 0.8 + r() * 0.5 : sp.kind === 'whale' ? 1 : 0.9 + r() * 0.3;
        this.group.scale.setScalar(s);
        this.speed = sp.kind === 'turtle' ? 0.7 : sp.kind === 'manta' ? 1.3 : 2.2;
        this.radius = sp.kind === 'turtle' ? 1.0 * s : sp.kind === 'manta' ? 2.4 * s : 7;
        this.band = sp.kind === 'turtle' ? [2.5, 7] : sp.kind === 'manta' ? [3.5, 10] : [6, 30];
        this.bank = 0;
        this.pitch = 0;
        this.update(0, 0, null);
    }

    update(dt, t, sub) {
        const k = this.kind;
        if (k !== 'whale') {
            const turn = noise2(t * 0.06, this.seed) * 0.5;
            this.heading += turn * dt;
            this.bank = damp(this.bank, -turn * 0.8, 1.5, dt);
        }
        this.pos.x += Math.cos(this.heading) * this.speed * dt;
        this.pos.z -= Math.sin(this.heading) * this.speed * dt;
        const b = bandY(this.pos.x, this.pos.z, this.band[0], this.band[1]);
        const vy = clamp(b.lo + (b.hi - b.lo) * (0.5 + 0.4 * Math.sin(t * 0.05 + this.seed)) - this.pos.y, -0.6, 0.6);
        this.pos.y += vy * dt;
        this.pitch = damp(this.pitch, vy * 0.3, 1, dt);
        this.group.position.copy(this.pos);
        this.group.rotation.set(this.bank, this.heading, this.pitch, 'YXZ');
        const u = this.group.userData;
        if (k === 'turtle') {
            const w = t * 2.2 + this.seed;
            for (const f of u.flips) {
                const s = Math.sin(w + (f.front ? 0 : 1.2));
                f.pivot.rotation.set(f.side * s * (f.front ? 0.55 : 0.25), f.front ? s * 0.25 : 0, 0);
            }
        } else if (k === 'manta') {
            u.flap.value = t * 1.5 + this.seed;
        } else {
            u.flukes.rotation.z = Math.sin(t * 0.8 + this.seed) * 0.32;
            this.group.rotation.z += Math.sin(t * 0.8 + this.seed - 1.2) * 0.03;
        }
    }

    dispose() {
        this.group.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
        });
    }
}

function raySphere(ray, c, r) {
    _d.subVectors(c, ray.origin);
    const t = _d.dot(ray.direction);
    if (t < 0) return Infinity;
    const d2 = _d.lengthSq() - t * t;
    return d2 < r * r ? t : Infinity;
}

// ------------------------------------------------------------------ the whole population

const TIER = {
    high: { schools: 9, jellies: 2 },
    medium: { schools: 7, jellies: 2 },
    low: { schools: 5, jellies: 1 },
};

export class SeaLife {
    /** @param {THREE.Scene} scene  @param {string} tier quality tier  @param {(x, z, r) => V3[]} anemonesNear */
    constructor(scene, tier, anemonesNear) {
        this.scene = scene;
        this.cfg = TIER[tier] || TIER.high;
        this.anemonesNear = anemonesNear;
        this.items = [];
        this.assets = new Map();
        this.r = rng(Date.now() >>> 0);
        this.spawnTimer = 0;
        this.whaleTimer = 70 + this.r() * 80;
        this.homes = new WeakSet();    // anemones that already have clownfish
    }

    _assets(sp) {
        if (!this.assets.has(sp.id)) this.assets.set(sp.id, { geo: fishGeometry(sp), mat: fishMaterial(sp) });
        return this.assets.get(sp.id);
    }

    _add(item) {
        this.items.push(item);
        this.scene.add(item.mesh || item.group);
        return item;
    }

    _remove(item) {
        this.scene.remove(item.mesh || item.group);
        item.dispose();
        if (item.home) this.homes.delete(item.home);
    }

    clear() {
        for (const it of this.items) this._remove(it);
        this.items = [];
    }

    /** Pick a species for a spot, by what kind of floor it is. */
    _species(kind, x, z) {
        const w = biomeAt(x, z);
        const list = SEA_LIFE.filter((s) => s.kind === kind && Object.keys(s.where).length);
        let total = 0;
        const ws = list.map((s) => {
            let v = 0;
            for (const [b, k] of Object.entries(s.where)) v += k * w[b];
            total += v;
            return v;
        });
        let k = this.r() * total;
        for (let i = 0; i < list.length; i++) if ((k -= ws[i]) <= 0) return list[i];
        return list[0];
    }

    /** A spot `dist` metres from `pos`, mostly ahead along `fwd`, at a good height for `band`. */
    _spot(pos, fwd, dist, spread, band) {
        const a = Math.atan2(fwd.x, fwd.z) + (this.r() - 0.5) * spread;
        const x = pos.x + Math.sin(a) * dist, z = pos.z + Math.cos(a) * dist;
        const b = bandY(x, z, band[0], band[1]);
        return new V3(x, lerp(b.lo, b.hi, this.r()), z);
    }

    spawnSchool(pos, fwd, dist, spread) {
        const at = this._spot(pos, fwd, dist, spread, [1.5, 7]);
        const sp = this._species('school', at.x, at.z);
        return this._add(new School(sp, at, this.r, this._assets(sp)));
    }

    spawnJellies(pos, fwd, dist, spread) {
        const at = this._spot(pos, fwd, dist, spread, [4, 14]);
        return this._add(new JellyBloom(this._species('jelly', at.x, at.z), at, this.r));
    }

    spawnSwimmer(id, pos, fwd, dist, spread) {
        const sp = SEA_LIFE.find((s) => s.id === id);
        const at = this._spot(pos, fwd, dist, spread, sp.kind === 'whale' ? [8, 22] : [3, 8]);
        // whales cross the view; the others wander towards it
        const toSub = Math.atan2(-(pos.z - at.z), pos.x - at.x);
        const heading = sp.kind === 'whale' ? toSub + (this.r() < 0.5 ? 1 : -1) * (1.1 + this.r() * 0.4) : toSub + (this.r() - 0.5) * 1.6;
        return this._add(new Swimmer(sp, at, heading, this.r));
    }

    /** Fill the sea round the submarine when it first goes down. */
    populate(pos, fwd) {
        this.clear();
        const n = this.cfg.schools;
        for (let i = 0; i < n; i++) this.spawnSchool(pos, fwd, 10 + this.r() * 40, i < 3 ? 1.2 : TAU);
        this.spawnJellies(pos, fwd, 26 + this.r() * 10, 1.6);
        // the first look out of the window is a good one
        this.spawnSwimmer(this.r() < 0.6 ? 'turtle' : 'manta', pos, fwd, 22, 0.9);
        this.spawnTimer = 0;
    }

    count(kind) {
        let n = 0;
        for (const it of this.items) if (it.kind === kind && !it.anchor) n++;
        return n;
    }

    update(dt, t, sub, fwd, night) {
        FISH_TIME.value = t;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.update(dt, t, sub, night);
            const far = it.kind === 'whale' ? 260 : 125;
            if (Math.hypot(it.pos.x - sub.x, it.pos.z - sub.z) > far) {
                this._remove(it);
                this.items.splice(i, 1);
            }
        }
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 1.2;
            const r = this.r;
            if (this.count('school') < this.cfg.schools) this.spawnSchool(sub, fwd, 62 + r() * 18, 2.4);
            if (this.count('jelly') < this.cfg.jellies + (night > 0.5 ? 1 : 0) && r() < 0.15) this.spawnJellies(sub, fwd, 65, 2);
            if (!this.count('turtle') && r() < 0.035) this.spawnSwimmer('turtle', sub, fwd, 60, 1.6);
            if (!this.count('manta') && r() < 0.022) this.spawnSwimmer('manta', sub, fwd, 66, 1.6);
            // clownfish move into anemones you come near
            for (const a of this.anemonesNear(sub.x, sub.z, 40)) {
                if (this.homes.has(a)) continue;
                this.homes.add(a);
                if (r() < 0.45) continue;
                const sp = SEA_LIFE.find((s) => s.id === 'clown');
                const sc = this._add(new School(sp, a, r, this._assets(sp), a));
                sc.home = a;
            }
        }
        this.whaleTimer -= dt;
        if (this.whaleTimer <= 0 && !this.count('whale')) {
            this.whaleTimer = 140 + this.r() * 140;
            const w = this.spawnSwimmer('humpback', sub, fwd, 75, 1.2);
            this.onWhale?.(w);
        }
    }

    /** The animal under a ray, nearest first: { item, t }. */
    pick(ray, maxT = 70) {
        let best = null, bt = maxT;
        for (const it of this.items) {
            const t = it.kind === 'jelly' ? it.hit(ray) : raySphere(ray, it.pos, it.radius + (it.kind === 'school' ? 0.4 : 0));
            if (t < bt) {
                bt = t;
                best = { item: it, t };
            }
        }
        return best;
    }

    dispose() {
        this.clear();
        for (const a of this.assets.values()) {
            a.geo.dispose();
            a.mat.dispose();
        }
        this.assets.clear();
    }
}

