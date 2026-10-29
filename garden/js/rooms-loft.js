// The fourth floor of the Observatory, the Clockwork Loft: the Grand Orrery (a
// brass model of a made-up solar system; wind its crank and the years fly
// round), the Harp of Light (nine beams you play by walking through them) and
// the Automaton Tea Party (an owl, a rabbit and a robot with a teapot for a
// head, who will pour you a cup and propose a toast).
// Room-local frame: the door is at +z, the back wall at -z (see tower.js).

import * as THREE from 'three';
import { lathe, gearShape, columnGeo } from './architecture.js';
import { TAU, damp, clamp, lerp, smoothstep } from './util.js';
import { canvasTex, glow, motes, emissiveMat, plaqueMesh, RAINBOW, ease } from './tower-kit.js';
import { PENTA } from './tower-audio.js';
import { pedestal, fern } from './rooms-hours.js';

const V3 = THREE.Vector3;

// ================================================================ the Grand Orrery

const PLANETS = [
    { name: 'Pip', desc: 'the size of a grape, and very proud of it', color: '#c8c8d0', band: '#9a9aa8', r: 0.13, R: 1.0 },
    { name: 'Marmalade', desc: 'a gas giant that smells faintly of toast', color: '#ff9a3a', band: '#ffd08a', r: 0.3, R: 1.45, stripes: true },
    { name: 'Bluebottle', desc: 'home of the singing whales, who are mostly in tune', color: '#2f8ad8', band: '#5ad87a', r: 0.22, R: 1.95 },
    { name: 'Plumbago', desc: 'made entirely of lost umbrellas, hence the rings', color: '#a86ad8', band: '#e0b8ff', r: 0.26, R: 2.45, rings: true },
    { name: 'Old Rusty', desc: 'it rusts in the rain, and it always rains. Its moon is called Biscuit', color: '#c8482a', band: '#e88a5a', r: 0.2, R: 2.85, moon: true },
    { name: 'Glimmer', desc: 'the coldest place in the tower; ice for the tea is fetched from here', color: '#d8f0ff', band: '#8ad0ff', r: 0.17, R: 3.2 },
];

function planetTex(p) {
    return canvasTex(256, 128, (x, w, h) => {
        x.fillStyle = p.color;
        x.fillRect(0, 0, w, h);
        let s = 7;
        const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        if (p.stripes || p.rings) {
            for (let y = 0; y < h; y += 6) {
                x.fillStyle = rnd() < 0.5 ? p.band : 'rgba(0,0,0,0.12)';
                x.globalAlpha = 0.6;
                x.fillRect(0, y + Math.sin(y) * 2, w, 3 + rnd() * 6);
            }
            x.globalAlpha = 1;
            x.fillStyle = '#c84a2a';
            x.beginPath();
            x.ellipse(w * 0.6, h * 0.62, 18, 9, 0, 0, TAU);
            x.fill();
        } else {
            x.fillStyle = p.band;
            for (let i = 0; i < 26; i++) {
                x.beginPath();
                x.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 26, 4 + rnd() * 12, rnd() * 3, 0, TAU);
                x.fill();
            }
            x.fillStyle = 'rgba(255,255,255,0.5)';
            for (let i = 0; i < 12; i++) x.fillRect(rnd() * w, rnd() * h, 20 + rnd() * 40, 3);
        }
    });
}

const SUN_FRAG = /* glsl */ `
uniform float uTime; uniform float uHeat;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
float h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
    vec3 p = normalize(vP) * 4.0;
    float g = n(p + uTime * 0.3) * 0.6 + n(p * 2.3 - uTime * 0.5) * 0.4;
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.9, 0.5), g) * (1.6 + uHeat);
    col += vec3(1.0, 0.6, 0.2) * rim * 1.5;
    gl_FragColor = vec4(col, 1.0);
}`;
export const SPHERE_VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;

export function buildOrrery(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    const SY = 2.7;   // the sun's height
    // the pillar, a gear-train round its foot, and a railing
    ctx.geo('marble', lathe([[0, 0], [1.1, 0], [1.1, 0.2], [0.9, 0.3], [0.9, 0.5], [0.7, 0.55], [0, 0.55]], 40), 0, 0, 0);
    ctx.geo('gold', columnGeo(SY - 0.9, 0.12, 12), 0, 0.55, 0);
    const gears = [];
    const gearMat = ctx.mats.brass;
    for (const [gx, gz, R, teeth, dir] of [[0, 0, 0.65, 16, 1], [1.1, 0.3, 0.42, 11, -1.55], [-0.95, -0.55, 0.36, 9, -1.8], [0.4, -1.05, 0.3, 8, -2.2]]) {
        const g = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(R, teeth, R * 0.14, R * 0.18), { depth: 0.08, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2), gearMat);
        g.position.set(gx, 0.62, gz);
        ctx.add(g);
        gears.push({ g, dir });
    }
    for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU;
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.18) continue;
        ctx.geo('gold', new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), Math.sin(a) * 3.5, 0.5, Math.cos(a) * 3.5);
    }
    ctx.geo('gold', new THREE.TorusGeometry(3.5, 0.05, 8, 96).rotateX(Math.PI / 2), 0, 1.0, 0);
    ctx.collide(0, 0, 3.55);
    // the sun
    const sunU = { uTime: { value: 0 }, uHeat: { value: 0 } };
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 28), new THREE.ShaderMaterial({ uniforms: sunU, vertexShader: SPHERE_VERT, fragmentShader: SUN_FRAG }));
    sun.position.y = SY;
    ctx.add(sun);
    const corona = glow(0xffb040, 3.4, 0.55);
    corona.position.y = SY;
    ctx.add(corona);
    const sunLight = ctx.light(0xffc070, 18, 14, 0, SY, 0);
    // the planets on their arms
    const planets = PLANETS.map((p, i) => {
        const arm = new THREE.Group();
        arm.position.y = SY - 0.75 + i * 0.07;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, p.R, 6).rotateZ(Math.PI / 2).translate(p.R / 2, 0, 0), ctx.mats.brass);
        arm.add(rod);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), ctx.mats.gold);
        arm.add(collar);
        const up = SY - arm.position.y + Math.sin(i * 1.7) * 0.25;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, up, 6).translate(0, up / 2, 0), ctx.mats.brass);
        post.position.x = p.R;
        arm.add(post);
        const mat = new THREE.MeshStandardMaterial({ map: planetTex(p), roughness: 0.6, emissive: new THREE.Color(p.color), emissiveIntensity: 0.1 });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(p.r, 28, 18), mat);
        ball.position.set(p.R, up, 0);
        arm.add(ball);
        if (p.rings) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * 1.35, p.r * 2.1, 48), new THREE.MeshStandardMaterial({ color: 0xe0c8ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, roughness: 0.6 }));
            ring.rotation.x = -Math.PI / 2 + 0.4;
            ball.add(ring);
        }
        let moonArm = null;
        if (p.moon) {
            moonArm = new THREE.Group();
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8d0a0, roughness: 0.8 }));
            m.position.x = 0.42;
            moonArm.add(m);
            const mr = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4).rotateZ(Math.PI / 2).translate(0.21, 0, 0), ctx.mats.brass);
            moonArm.add(mr);
            ball.add(moonArm);
        }
        ctx.add(arm);
        const pl = { p, arm, ball, mat, moonArm, a: r() * TAU, w: 0.55 / Math.pow(i + 1, 1.15), pulse: 0 };
        ctx.hit(ball, {
            label: p.name,
            range: 9,
            onClick: () => {
                pl.pulse = 1;
                audio.bell(PENTA[6 + i], 0, 0.05);
                ctx.say(`${p.name}: ${p.desc}.`, 4800);
            },
        });
        return pl;
    });
    // the crank, out by the railing nearest the door
    const CZ = 4.0;
    ctx.box('darkWood', 0.6, 1.0, 0.5, 0, 0.5, CZ);
    ctx.collideBox(0, CZ, 0.6, 0.5);
    const crank = new THREE.Group();
    crank.position.set(0, 1.15, CZ);
    const wheel = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(0.28, 12, 0.04, 0.05), { depth: 0.05, bevelEnabled: false }), ctx.mats.gold);
    crank.add(wheel);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8).rotateX(Math.PI / 2), ctx.mats.darkWood);
    handle.position.set(0.22, 0, 0.15);
    crank.add(handle);
    crank.rotation.y = 0;
    ctx.add(crank);
    const cp = plaqueMesh('Wind the Years', 'Turn the crank', 0.5);
    cp.position.set(0, 0.6, CZ + 0.26);
    ctx.add(cp);
    let mult = 1, wind = 0, told = false;
    ctx.proxy(0.7, 0.7, 0.7, 0, 1.15, CZ, {
        label: 'The crank · wind the years',
        range: 5,
        onClick: () => {
            wind = Math.min(wind + 3.5, 9);
            audio.ratchet(14);
            audio.whirr(1.4);
            if (!told) {
                told = true;
                ctx.say('Whirr-click-whirr! The years go round. Pip has had four birthdays since you came in.', 5000);
            }
        },
    });
    // a ceiling of stars
    const SN = 260;
    const stars = motes(SN, 0xfff0d0, 0.09, 0.9);
    const sp = stars.geometry.attributes.position;
    for (let i = 0; i < SN; i++) sp.setXYZ(i, (r() - 0.5) * (W - 0.4), ceil - 0.15 - r() * 0.4, (r() - 0.5) * (D - 0.4));
    ctx.add(stars);

    return {
        update(dt, t) {
            wind = Math.max(0, wind - dt);
            mult = damp(mult, 1 + wind * 9, 2, dt);
            sunU.uTime.value = t;
            sunU.uHeat.value = Math.min(1.5, (mult - 1) / 30);
            corona.scale.setScalar(3.4 + Math.sin(t * 2) * 0.15 + (mult - 1) * 0.02);
            sunLight.intensity = 18 + (mult - 1) * 0.3;
            for (const pl of planets) {
                pl.a += pl.w * dt * mult;
                pl.arm.rotation.y = pl.a;
                pl.ball.rotation.y += dt * (1 + mult * 0.2);
                if (pl.moonArm) pl.moonArm.rotation.y += dt * 2 * mult;
                pl.pulse = Math.max(0, pl.pulse - dt);
                pl.mat.emissiveIntensity = 0.1 + pl.pulse * 1.5 + (mult - 1) * 0.01;
                pl.ball.scale.setScalar(1 + Math.sin(pl.pulse * Math.PI) * 0.4);
            }
            for (const g of gears) g.g.rotation.y += dt * 0.3 * mult * g.dir;
            crank.rotation.z -= dt * (0.3 + wind * 3);
            stars.material.opacity = 0.7 + Math.sin(t * 1.3) * 0.2;
        },
    };
}

// ================================================================ the Harp of Light

export function buildHarp(ctx) {
    const { W, D, ceil, audio } = ctx;
    const n = 9;
    const beams = [];
    const coreGeo = new THREE.CylinderGeometry(0.045, 0.045, ceil, 10, 1, true);
    const softGeo = new THREE.CylinderGeometry(0.22, 0.22, ceil, 16, 1, true);
    const ringGeo = new THREE.TorusGeometry(0.28, 0.03, 6, 24).rotateX(Math.PI / 2);
    const harpColors = ['#ff4f6a', '#ff8a3c', '#ffd84d', '#9aff4d', '#3fffb0', '#3fd0ff', '#5b7dff', '#a45cff', '#ff5ce0'];
    for (let i = 0; i < n; i++) {
        const a = -1.05 + (i / (n - 1)) * 2.1;
        const x = Math.sin(a) * 3.4, z = 2.4 - Math.cos(a) * 3.4;
        const col = new THREE.Color(harpColors[i]);
        const add = (geo, op) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
        const core = add(coreGeo, 0.8);
        const soft = add(softGeo, 0.12);
        core.position.set(x, ceil / 2, z);
        soft.position.copy(core.position);
        ctx.add(core, soft);
        // emitter and receiver
        ctx.geo('gold', new THREE.CylinderGeometry(0.28, 0.34, 0.12, 20), x, 0.06, z);
        ctx.geo('gold', new THREE.CylinderGeometry(0.34, 0.28, 0.12, 20), x, ceil - 0.06, z);
        const lensMat = ctx.mat('lens' + i, emissiveMat(col, 2.5));
        ctx.geo('lens' + i, new THREE.CircleGeometry(0.2, 20).rotateX(-Math.PI / 2), x, 0.125, z);
        const rings = [0, 1, 2].map(() => {
            const m = add(ringGeo, 0);
            m.position.set(x, -1, z);
            ctx.add(m);
            return { m, y: -1 };
        });
        const wave = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        wave.position.set(x, 0.02, z);
        ctx.add(wave);
        const b = { x, z, col, core, soft, rings, wave, waveK: 0, k: 0, note: PENTA[4 + i], last: -9, ri: 0 };
        beams.push(b);
        ctx.hit(soft, { label: 'A string of light · walk through it, or click', range: 9, onClick: () => pluck(b) });
    }
    const noteLight = ctx.light(0xffffff, 0, 9, 0, 2.5, 0);
    let lastPlayed = [], auto = -1, told = false;
    function pluck(b, quiet) {
        b.k = 1;
        b.waveK = 1;
        const rr = b.rings[b.ri++ % 3];
        rr.y = 0.2;
        audio.harp(b.note);
        noteLight.color.copy(b.col);
        noteLight.intensity = 12;
        if (quiet) return;
        lastPlayed.push(beams.indexOf(b));
        if (lastPlayed.length > 9) lastPlayed.shift();
        if (lastPlayed.length === 9 && lastPlayed.every((v, k) => v === k) && auto < 0) {
            auto = 0;
            lastPlayed = [];
            setTimeout(() => ctx.say('You played every string in order. The harp is so pleased it plays you a little something back.', 5000), 400);
        } else if (!told && lastPlayed.length >= 4) {
            told = true;
            ctx.say('Each beam is a string. Run along them for a glissando; play all nine in order and see what happens.', 5200);
        }
    }
    // the tune it plays back: a little phrase in beam indices
    const TUNE = [4, 6, 7, 8, 7, 6, 4, -1, 2, 4, 5, 4, 2, 0, -1, 4, 6, 8, 8];
    const prev = new Map();
    // a dark floor that mirrors a little, and dim violet light
    ctx.mat('glossy', new THREE.MeshStandardMaterial({ color: 0x08060f, roughness: 0.08, metalness: 0.6 }));
    ctx.box('glossy', W - 0.2, 0.01, D - 0.2, 0, 0.004, 0);
    ctx.light(0x8a6aff, 6, 14, 0, ceil - 0.5, 0);
    const pl = plaqueMesh('The Harp of Light', 'Strings: nine. Fingers: optional.', 0.7);
    pl.position.set(0, 1.4, -D / 2 + 0.04);
    ctx.add(pl);

    return {
        update(dt, t) {
            // walking through a beam plays it
            const p = ctx.player();
            for (const b of beams) {
                const d = Math.hypot(p.x - b.x, p.z - b.z);
                const was = prev.get(b) ?? 9;
                if (d < 0.45 && was >= 0.45 && t - b.last > 0.35) {
                    b.last = t;
                    pluck(b);
                }
                prev.set(b, d);
            }
            if (auto >= 0) {
                const step = Math.floor(auto / 0.32);
                auto += dt;
                const next = Math.floor(auto / 0.32);
                if (next !== step && next < TUNE.length && TUNE[next] >= 0) pluck(beams[TUNE[next]], true);
                if (next >= TUNE.length + 2) auto = -1;
            }
            for (const b of beams) {
                b.k = Math.max(0, b.k - dt * 1.6);
                b.core.material.opacity = 0.55 + b.k * 0.45 + Math.sin(t * 3 + b.note) * 0.08;
                b.core.scale.set(1 + b.k * 1.8, 1, 1 + b.k * 1.8);
                b.soft.material.opacity = 0.09 + b.k * 0.3;
                b.soft.scale.set(1 + b.k * 0.8 + Math.sin(t * 40) * b.k * 0.15, 1, 1 + b.k * 0.8);
                for (const rr of b.rings) {
                    if (rr.y < 0) continue;
                    rr.y += dt * 3.5;
                    rr.m.position.y = rr.y;
                    rr.m.material.opacity = Math.max(0, 1 - rr.y / ceil) * 0.9;
                    rr.m.scale.setScalar(1 + rr.y * 0.15);
                    if (rr.y > ceil) rr.y = -1;
                }
                b.waveK = Math.max(0, b.waveK - dt * 0.9);
                const wk = 1 - b.waveK;
                b.wave.scale.setScalar(1 + wk * 6);
                b.wave.material.opacity = b.waveK * 0.6;
            }
            noteLight.intensity = Math.max(0, noteLight.intensity - dt * 10);
        },
    };
}

// ================================================================ the Automaton Tea Party

const TOASTS = [
    'Robot: “To gears that never grind!”',
    'Rabbit: “To carrots, and to cake, and to carrot cake!”',
    'Owl: “To the night, which is when the good biscuits come out.”',
    'Robot: “To my head, which is also the teapot. Please do not ask how.”',
    'Rabbit: “To our guest, who is not made of clockwork, and is still very welcome!”',
];
const CHATTER = {
    owl: ['The Owl blinks slowly. “I take mine with seventeen sugars. Do not judge me.”', 'The Owl: “Have you tried the scones? They are older than the tower.”', 'The Owl swivels its head all the way round, for your benefit.'],
    rabbit: ['The Rabbit: “Late, late, I’m always late! Oh. No. That was my cousin.”', 'The Rabbit’s key winds itself. “Ahh, much better.”', 'The Rabbit: “Is it my birthday? Is it yours? Let’s say yes!”'],
    robot: ['The Robot’s lid rattles. “Careful! I am full and very hot.”', 'The Robot: “BEEP. That was a joke. I do not actually beep.”', 'The Robot bows, and a little tea comes out of its spout.'],
};

export function buildTeaParty(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    const C = new V3(0, 0, -0.7);
    const TH = 0.78;
    // the table, with a lace cloth
    ctx.geo('darkWood', lathe([[0, 0], [0.5, 0], [0.5, 0.06], [0.12, 0.12], [0.1, TH - 0.06], [0, TH - 0.06]], 20), C.x, 0, C.z);
    ctx.geo('cloth', new THREE.CylinderGeometry(1.25, 1.32, 0.3, 48, 1, true), C.x, TH - 0.14, C.z);
    ctx.geo('cloth', new THREE.CylinderGeometry(1.25, 1.25, 0.03, 48), C.x, TH, C.z);
    for (let k = 0; k < 40; k++) {
        const a = (k / 40) * TAU;
        ctx.geo('cloth', new THREE.SphereGeometry(0.06, 6, 4), C.x + Math.cos(a) * 1.32, TH - 0.3, C.z + Math.sin(a) * 1.32);
    }
    ctx.collide(C.x, C.z, 1.4);
    // the three of them, round the back of the table, and an empty chair for you
    const seats = [
        { kind: 'owl', a: Math.PI * 0.8 },
        { kind: 'rabbit', a: Math.PI },
        { kind: 'robot', a: Math.PI * 1.2 },
        { kind: 'you', a: 0 },
    ];
    const pastel = ['#ffb0c8', '#bfe8d8', '#ffe0a0', '#c8b8ff'];
    const cups = [];
    seats.forEach((s, i) => {
        s.x = C.x + Math.sin(s.a) * 1.75;
        s.z = C.z + Math.cos(s.a) * 1.75;
        s.face = s.a + Math.PI;
        // chair
        const key = 'chair' + i;
        ctx.roomMats[key] = new THREE.MeshStandardMaterial({ color: pastel[i], roughness: 0.6 });
        ctx.geo(key, new THREE.BoxGeometry(0.6, 0.08, 0.6), s.x, 0.48, s.z, s.face);
        const bx = s.x - Math.sin(s.face) * 0.28, bz = s.z - Math.cos(s.face) * 0.28;
        ctx.geo(key, new THREE.BoxGeometry(0.6, 0.9, 0.06), bx, 0.9, bz, s.face);
        ctx.geo(key, new THREE.SphereGeometry(0.08, 10, 8), bx + Math.cos(s.face) * 0.3, 1.38, bz - Math.sin(s.face) * 0.3);
        ctx.geo(key, new THREE.SphereGeometry(0.08, 10, 8), bx - Math.cos(s.face) * 0.3, 1.38, bz + Math.sin(s.face) * 0.3);
        for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) ctx.geo('darkWood', new THREE.CylinderGeometry(0.03, 0.03, 0.48, 6), s.x + lx, 0.24, s.z + lz);
        if (s.kind !== 'you') ctx.collide(s.x, s.z, 0.45);
        // a cup and saucer at each place
        const cx = C.x + Math.sin(s.a) * 0.85, cz = C.z + Math.cos(s.a) * 0.85;
        ctx.geo('white', new THREE.CylinderGeometry(0.13, 0.11, 0.015, 20), cx, TH + 0.02, cz);
        const cup = new THREE.Group();
        cup.position.set(cx, TH + 0.03, cz);
        cup.add(new THREE.Mesh(lathe([[0, 0], [0.05, 0], [0.07, 0.08], [0.072, 0.09], [0.0, 0.09]], 16), new THREE.MeshStandardMaterial({ color: pastel[i], roughness: 0.3 })));
        const tea = new THREE.Mesh(new THREE.CircleGeometry(0.064, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a4a1a, roughness: 0.2 }));
        tea.position.y = 0.04;
        tea.visible = false;
        cup.add(tea);
        const steam = glow(0xffffff, 0.3, 0);
        steam.position.y = 0.2;
        cup.add(steam);
        ctx.add(cup);
        cups.push({ cup, tea, steam, home: cup.position.clone(), seat: s, fill: 0 });
    });
    // the teapot in the middle, and a cake stand
    const pot = new THREE.Group();
    const potMat = new THREE.MeshStandardMaterial({ color: 0xf6f0ff, roughness: 0.25 });
    pot.add(new THREE.Mesh(lathe([[0, 0], [0.12, 0], [0.18, 0.08], [0.19, 0.16], [0.14, 0.26], [0.06, 0.28], [0.07, 0.3], [0, 0.32]], 24), potMat));
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.22, 10), potMat);
    spout.position.set(0.22, 0.17, 0);
    spout.rotation.z = -0.9;
    pot.add(spout);
    const ph = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 16, Math.PI * 1.2), potMat);
    ph.position.set(-0.2, 0.16, 0);
    ph.rotation.z = Math.PI * 0.4;
    pot.add(ph);
    const flowers = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.012, 6, 32).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff7ab0 }));
    flowers.position.y = 0.14;
    pot.add(flowers);
    const potHome = new V3(C.x + 0.3, TH + 0.02, C.z + 0.1);
    pot.position.copy(potHome);
    ctx.add(pot);
    ctx.geo('gold', new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), C.x - 0.35, TH + 0.3, C.z - 0.1);
    [0.24, 0.18, 0.12].forEach((rad, k) => {
        ctx.geo('white', new THREE.CylinderGeometry(rad, rad, 0.012, 24), C.x - 0.35, TH + 0.1 + k * 0.2, C.z - 0.1);
        for (let j = 0; j < 5 - k; j++) {
            const a = (j / (5 - k)) * TAU;
            const key = 'cake' + ((j + k) % 4);
            ctx.roomMats[key] ??= new THREE.MeshStandardMaterial({ color: pastel[(j + k) % 4], roughness: 0.7 });
            ctx.geo(key, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), C.x - 0.35 + Math.cos(a) * rad * 0.6, TH + 0.135 + k * 0.2, C.z - 0.1 + Math.sin(a) * rad * 0.6);
            ctx.geo('white', new THREE.SphereGeometry(0.02, 6, 4), C.x - 0.35 + Math.cos(a) * rad * 0.6, TH + 0.17 + k * 0.2, C.z - 0.1 + Math.sin(a) * rad * 0.6);
        }
    });

    // ---- the automatons
    const bots = [];
    const mk = (geo, mat, x = 0, y = 0, z = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        return m;
    };
    for (const s of seats) {
        if (s.kind === 'you') continue;
        const g = new THREE.Group();
        g.position.set(s.x, 0.52, s.z);
        g.rotation.y = s.face;
        const head = new THREE.Group();
        const armL = new THREE.Group(), armR = new THREE.Group();
        let ears = null, eyes = [];
        if (s.kind === 'owl') {
            const brass = ctx.mats.brass;
            g.add(mk(new THREE.SphereGeometry(0.28, 20, 14).scale(1, 1.3, 0.95), brass, 0, 0.36, 0));
            g.add(mk(new THREE.SphereGeometry(0.2, 16, 10).scale(1, 1.2, 0.5), ctx.mats.gold, 0, 0.32, 0.14));
            head.position.set(0, 0.82, 0);
            head.add(mk(new THREE.SphereGeometry(0.23, 20, 14), brass));
            for (const sd of [-1, 1]) {
                const e = mk(new THREE.SphereGeometry(0.075, 14, 10), emissiveMat(0xffb02e, 2.2), sd * 0.09, 0.03, 0.18);
                head.add(e);
                eyes.push(e);
                head.add(mk(new THREE.TorusGeometry(0.085, 0.015, 6, 16), ctx.mats.gold, sd * 0.09, 0.03, 0.2));
                const tuft = mk(new THREE.ConeGeometry(0.05, 0.16, 6), brass, sd * 0.14, 0.22, 0);
                tuft.rotation.z = -sd * 0.4;
                head.add(tuft);
            }
            head.add(mk(new THREE.ConeGeometry(0.03, 0.08, 6).rotateX(Math.PI / 2 + 0.5), ctx.mats.gold, 0, -0.06, 0.22));
            for (const [arm, sd] of [[armL, -1], [armR, 1]]) {
                arm.position.set(sd * 0.27, 0.55, 0);
                arm.add(mk(new THREE.SphereGeometry(0.12, 12, 8).scale(0.4, 1.4, 0.8).translate(0, -0.15, 0.05), ctx.mats.bronze));
            }
        } else if (s.kind === 'rabbit') {
            const tin = ctx.mats.silver;
            g.add(mk(new THREE.CapsuleGeometry(0.2, 0.3, 6, 14), tin, 0, 0.38, 0));
            g.add(mk(new THREE.ConeGeometry(0.08, 0.1, 3).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8463c }), 0, 0.62, 0.17));
            head.position.set(0, 0.86, 0);
            head.add(mk(new THREE.SphereGeometry(0.19, 18, 12), tin));
            head.add(mk(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffa0c0 }), 0, -0.04, 0.17));
            for (const sd of [-1, 1]) {
                const e = mk(new THREE.SphereGeometry(0.035, 10, 8), ctx.mats.black, sd * 0.08, 0.05, 0.16);
                head.add(e);
                eyes.push(e);
            }
            ears = [-1, 1].map((sd) => {
                const ear = new THREE.Group();
                ear.position.set(sd * 0.08, 0.15, 0);
                ear.add(mk(new THREE.CapsuleGeometry(0.045, 0.3, 4, 8).translate(0, 0.18, 0), tin));
                ear.add(mk(new THREE.CapsuleGeometry(0.025, 0.25, 4, 8).translate(0, 0.18, 0.03), new THREE.MeshStandardMaterial({ color: 0xffb0c8 })));
                ear.rotation.z = -sd * 0.15;
                head.add(ear);
                return ear;
            });
            const key = new THREE.Group();
            key.position.set(0, 0.45, -0.22);
            key.add(mk(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6).rotateX(Math.PI / 2), ctx.mats.gold, 0, 0, -0.05));
            key.add(mk(new THREE.TorusGeometry(0.06, 0.015, 6, 16), ctx.mats.gold, 0, 0, -0.1));
            g.add(key);
            g.userData.key = key;
            for (const [arm, sd] of [[armL, -1], [armR, 1]]) {
                arm.position.set(sd * 0.22, 0.55, 0);
                arm.add(mk(new THREE.CapsuleGeometry(0.04, 0.24, 4, 8).translate(0, -0.15, 0), tin));
            }
        } else {
            const cop = ctx.mats.copper;
            g.add(mk(new THREE.BoxGeometry(0.42, 0.5, 0.32), cop, 0, 0.35, 0));
            for (let k = 0; k < 3; k++) g.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10).rotateX(Math.PI / 2), emissiveMat(RAINBOW[k * 2], 2), -0.1 + k * 0.1, 0.42, 0.17));
            g.add(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), ctx.mats.iron, 0, 0.64, 0));
            head.position.set(0, 0.7, 0);
            head.add(mk(lathe([[0, 0], [0.13, 0], [0.19, 0.08], [0.2, 0.16], [0.15, 0.26], [0.06, 0.28], [0.07, 0.3], [0, 0.32]], 20), potMat));
            const sp = mk(new THREE.CylinderGeometry(0.02, 0.035, 0.2, 10), potMat, 0.22, 0.16, 0);
            sp.rotation.z = -0.9;
            head.add(sp);
            for (const sd of [-1, 1]) {
                const e = mk(new THREE.SphereGeometry(0.035, 10, 8), emissiveMat(0x3fd0ff, 2.5), sd * 0.07, 0.16, 0.18);
                head.add(e);
                eyes.push(e);
            }
            for (const [arm, sd] of [[armL, -1], [armR, 1]]) {
                arm.position.set(sd * 0.26, 0.55, 0);
                arm.add(mk(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8).translate(0, -0.15, 0), ctx.mats.iron));
                arm.add(mk(new THREE.SphereGeometry(0.05, 8, 6), cop, 0, -0.32, 0));
            }
        }
        g.add(head, armL, armR);
        ctx.add(g);
        const bot = { s, g, head, armL, armR, ears, eyes, nod: 0, toast: 0, ph: r() * TAU, said: 0 };
        bots.push(bot);
        ctx.proxy(0.8, 1.6, 0.8, s.x, 0.9, s.z, {
            label: { owl: 'The Brass Owl', rabbit: 'The Tin Rabbit', robot: 'The Copper Robot' }[s.kind],
            range: 6,
            onClick: () => {
                bot.nod = 1;
                audio.murmur(s.kind === 'owl' ? 0.7 : s.kind === 'rabbit' ? 1.5 : 1.1);
                ctx.say(CHATTER[s.kind][bot.said++ % 3], 5000);
            },
        });
    }
    // pour: the teapot floats round, fills each cup, and everyone raises a toast
    let pour = -1, toastI = 0;
    const potHit = ctx.proxy(0.6, 0.5, 0.6, potHome.x, TH + 0.2, potHome.z, {
        label: 'The teapot · click for tea',
        range: 6,
        onClick: () => {
            if (pour >= 0) return;
            pour = 0;
            for (const c of cups) c.fill = 0;
            audio.bell(81, 0, 0.03);
        },
    });
    const streamN = 16;
    const stream = motes(streamN, 0xa0582a, 0.05, 0.95);
    ctx.add(stream);
    // garden-party bunting and a sign
    for (let k = 0; k < 14; k++) {
        const x = -W / 2 + 0.6 + (k / 13) * (W - 1.2);
        const y = ceil - 0.5 - Math.sin((k / 13) * Math.PI) * 0.5;
        const key = 'cake' + (k % 4);
        ctx.geo(key, new THREE.ConeGeometry(0.15, 0.3, 3).rotateX(Math.PI), x, y - 0.15, -D / 2 + 0.8, 0, 1, 1, 0.1);
    }
    const sign = plaqueMesh('Tea at All Hours', 'Guests welcome · bring a biscuit', 0.9);
    sign.position.set(0, 2.6, -D / 2 + 0.04);
    ctx.add(sign);
    fern(ctx, -4.2, -3.8, 1.2);
    fern(ctx, 4.2, -3.8, 1.2);
    ctx.light(0xfff0e0, 14, 14, 0, ceil - 0.5, -0.5);

    const cam = new V3(), tmp = new V3();
    return {
        update(dt, t) {
            ctx.camLocal(cam);
            // the pour, cup by cup
            stream.visible = false;
            if (pour >= 0) {
                pour += dt;
                const per = 1.6, k0 = 0.8;
                const i = Math.floor((pour - k0) / per);
                if (pour < k0) {
                    pot.position.lerpVectors(potHome, tmp.copy(potHome).setY(TH + 0.55), ease.out(pour / k0));
                } else if (i < cups.length) {
                    const c = cups[i];
                    const k = (pour - k0 - i * per) / per;
                    tmp.copy(c.home).setY(TH + 0.45);
                    tmp.x -= Math.sin(c.seat.a) * 0.22;
                    tmp.z -= Math.cos(c.seat.a) * 0.22;
                    pot.position.lerp(tmp, Math.min(1, dt * 6));
                    pot.rotation.y = c.seat.a - Math.PI / 2;
                    const tilt = k > 0.25 && k < 0.8;
                    pot.rotation.z = damp(pot.rotation.z, tilt ? -0.6 : 0, 8, dt);
                    if (tilt) {
                        c.fill = Math.min(1, c.fill + dt * 2);
                        stream.visible = true;
                        const sp = stream.geometry.attributes.position;
                        for (let j = 0; j < streamN; j++) {
                            const q = ((t * 3 + j / streamN) % 1);
                            sp.setXYZ(j, lerp(pot.position.x + Math.sin(c.seat.a) * 0.1, c.home.x, q), lerp(pot.position.y + 0.12, c.home.y + 0.06, q), lerp(pot.position.z + Math.cos(c.seat.a) * 0.1, c.home.z, q));
                        }
                        sp.needsUpdate = true;
                        if (Math.floor(t * 12) !== Math.floor((t - dt) * 12)) audio.bubble();
                    }
                } else if (pour < k0 + cups.length * per + 0.8) {
                    pot.position.lerp(potHome, Math.min(1, dt * 4));
                    pot.rotation.z = damp(pot.rotation.z, 0, 6, dt);
                    pot.rotation.y = damp(pot.rotation.y, 0, 4, dt);
                } else if (pour < k0 + cups.length * per + 3.4) {
                    // cheers!
                    const k = (pour - (k0 + cups.length * per + 0.8)) / 2.6;
                    for (const b of bots) b.toast = Math.sin(Math.min(1, k * 1.3) * Math.PI);
                    if (!potHit.userData.toasted && k > 0.35) {
                        potHit.userData.toasted = true;
                        for (let j = 0; j < 3; j++) audio.clink(j * 0.09);
                        ctx.say(TOASTS[toastI++ % TOASTS.length], 4500);
                    }
                } else {
                    pour = -1;
                    potHit.userData.toasted = false;
                    pot.position.copy(potHome);
                    for (const b of bots) b.toast = 0;
                }
            }
            for (const c of cups) {
                c.tea.visible = c.fill > 0.05;
                c.tea.position.y = 0.01 + c.fill * 0.06;
                c.steam.material.opacity = c.fill * (0.25 + Math.sin(t * 2 + c.home.x) * 0.1);
                c.steam.position.y = 0.2 + ((t * 0.3) % 1) * 0.1;
                const bot = bots.find((b) => b.s === c.seat);
                c.cup.position.copy(c.home);
                if (bot && bot.toast > 0) {
                    c.cup.position.y += bot.toast * 0.35;
                    c.cup.position.x -= Math.sin(c.seat.a) * bot.toast * 0.25;
                    c.cup.position.z -= Math.cos(c.seat.a) * bot.toast * 0.25;
                }
            }
            // the automatons look at you, tick and twitch
            for (const b of bots) {
                b.nod = Math.max(0, b.nod - dt * 1.2);
                const dx = cam.x - b.g.position.x, dz = cam.z - b.g.position.z;
                let yaw = Math.atan2(dx, dz) - b.g.rotation.y;
                yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
                const lim = b.s.kind === 'owl' ? 2.6 : 1.1;
                b.head.rotation.y = damp(b.head.rotation.y, clamp(yaw, -lim, lim), 3, dt);
                b.head.rotation.x = Math.sin(b.nod * Math.PI * 3) * 0.3 * b.nod + Math.sin(t * 2 + b.ph) * 0.03;
                b.armR.rotation.x = -b.toast * 1.5 + Math.sin(t * 1.5 + b.ph) * 0.05;
                b.armL.rotation.x = Math.sin(t * 1.3 + b.ph) * 0.06 - b.nod * 0.6;
                if (b.ears) b.ears.forEach((e, k) => (e.rotation.x = Math.max(0, Math.sin(t * 3 + k * 2 + b.ph) - 0.85) * 3));
                if (b.g.userData.key) b.g.userData.key.rotation.z += dt * 2;
                if (b.s.kind === 'owl') {
                    const bl = ((t + b.ph) % 4) < 0.12;
                    for (const e of b.eyes) e.scale.y = bl ? 0.1 : 1;
                }
            }
        },
    };
}
