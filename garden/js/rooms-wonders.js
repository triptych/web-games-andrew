// The second floor of the Observatory, the Gallery of Small Wonders: the
// Alchemist's Kitchen (pour three flasks into the cauldron and it names what you
// brewed), the Origami Aviary (a flock of paper cranes that circles you when you
// blow the whistle) and the Glowshroom Grotto (mushrooms that ring like a
// marimba, and answer a scale).
// Room-local frame: the door is at +z, the back wall at -z (see tower.js).

import * as THREE from 'three';
import { lathe } from './architecture.js';
import { TAU, damp, clamp, lerp, smoothstep } from './util.js';
import { glow, motes, colorMotes, emissiveMat, plaqueMesh, RAINBOW, ease } from './tower-kit.js';
import { PENTA } from './tower-audio.js';

const V3 = THREE.Vector3;

// ================================================================ the Alchemist's Kitchen

const INGREDIENTS = [
    { id: 'pepper', name: 'Dragon Pepper', color: '#ff3a1a', adj: 'Fiery', noun: 'Whistling', effect: 'your ears whistle sea shanties for an hour' },
    { id: 'moon', name: 'Moon Milk', color: '#bfe2ff', adj: 'Sleepy', noun: 'Levitation', effect: 'you float about a hand’s breadth off the floor' },
    { id: 'giggle', name: 'Bottled Giggle', color: '#ffe14d', adj: 'Ticklish', noun: 'Hiccups', effect: 'every hiccup comes out as a tiny bubble' },
    { id: 'fern', name: 'Fern Whisper', color: '#4cf07a', adj: 'Leafy', noun: 'Sprouting', effect: 'small ferns grow in your pockets' },
    { id: 'ink', name: 'Ink of Night', color: '#8a3aff', adj: 'Partial', noun: 'Invisibility', effect: 'your left elbow becomes invisible until Thursday' },
];
const FORMS = ['Tonic', 'Draught', 'Elixir', 'Philter', 'Cordial', 'Tincture', 'Brew', 'Essence'];
const SPECIAL = {
    'ink,moon,pepper': ['The Midnight Dragon', 'you dream of flying, and wake up slightly singed'],
    'fern,giggle,moon': ['Spring Morning in a Bottle', 'birds follow you about, humming'],
    'giggle,giggle,giggle': ['Pure Unstoppable Laughter', 'do not drink this at a funeral'],
    'ink,ink,ink': ['Total Invisibility (Mostly)', 'everything vanishes except your shoes'],
};

function brewName(ids) {
    const key = [...ids].sort().join(',');
    if (SPECIAL[key]) return SPECIAL[key];
    const count = {};
    for (const id of ids) count[id] = (count[id] || 0) + 1;
    const main = Object.keys(count).sort((a, b) => count[b] - count[a] || ids.lastIndexOf(b) - ids.lastIndexOf(a))[0];
    const first = INGREDIENTS.find((g) => g.id === ids[0]);
    const m = INGREDIENTS.find((g) => g.id === main);
    let h = 0;
    for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const form = FORMS[h % FORMS.length];
    const adj = first.id === m.id ? (count[main] === 3 ? 'Triple-Strength' : 'Rather Strong') : first.adj;
    return [`${form} of ${adj} ${m.noun}`, m.effect];
}

const LIQUID_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uBoil;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float a = atan(p.y, p.x) + uTime * 0.6 + r * 6.0;
    float swirl = 0.5 + 0.5 * sin(a * 3.0 + r * 18.0 - uTime * 2.0);
    vec2 g = floor(vUv * 14.0);
    float bub = 0.0;
    vec2 f = fract(vUv * 14.0) - 0.5;
    float life = fract(uTime * (0.4 + uBoil) + h(g) * 7.0);
    bub = smoothstep(0.32 * life, 0.28 * life, length(f)) * step(0.55, h(g + 3.0)) * (1.0 - life);
    vec3 col = uColor * (0.55 + 0.45 * swirl) + bub * 0.6 + uColor * pow(1.0 - r * 2.0, 2.0) * 0.6;
    gl_FragColor = vec4(col, 1.0);
}`;

export function buildAlchemy(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    const C = new V3(-0.9, 0, -1.0);   // the cauldron
    // the cauldron on its legs, over a fire
    ctx.geo('iron', lathe([[0, 0.25], [0.45, 0.28], [0.75, 0.5], [0.85, 0.8], [0.8, 1.05], [0.86, 1.1], [0.78, 1.12], [0.72, 1.02], [0, 1.0]], 32), C.x, 0, C.z);
    for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.4;
        ctx.geo('iron', new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6), C.x + Math.cos(a) * 0.55, 0.25, C.z + Math.sin(a) * 0.55, 0, 1, 1, 1, Math.sin(a) * 0.3, -Math.cos(a) * 0.3);
    }
    for (const s of [-1, 1]) ctx.geo('iron', new THREE.TorusGeometry(0.12, 0.025, 6, 14), C.x + s * 0.86, 1.0, C.z, Math.PI / 2);
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        ctx.geo('granite', new THREE.DodecahedronGeometry(0.16, 0), C.x + Math.cos(a) * 0.95, 0.08, C.z + Math.sin(a) * 0.95, a);
        ctx.geo('bark', new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), C.x + Math.cos(a) * 0.25, 0.08, C.z + Math.sin(a) * 0.25, a, 1, 1, 1, Math.PI / 2, 0);
    }
    ctx.collide(C.x, C.z, 1.1);
    const flames = [];
    for (let k = 0; k < 6; k++) {
        const f = glow(k % 2 ? 0xff8a2a : 0xffc04a, 0.5, 0.9);
        f.position.set(C.x + Math.cos(k) * 0.2, 0.25, C.z + Math.sin(k) * 0.2);
        ctx.add(f);
        flames.push(f);
    }
    const liquidU = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x4a6a3a) }, uBoil: { value: 0 } };
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.74, 40).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: liquidU, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: LIQUID_FRAG }));
    liquid.position.set(C.x, 0.95, C.z);
    ctx.add(liquid);
    const steam = glow(0x88aa66, 2.2, 0.35);
    steam.position.set(C.x, 1.5, C.z);
    ctx.add(steam);
    const BN = 40;
    const bubbles = motes(BN, 0xffffff, 0.12, 0.8);
    ctx.add(bubbles);
    const bub = Array.from({ length: BN }, () => ({ p: new V3(), v: 0, life: r() }));
    const cauldronLight = ctx.light(0x88cc66, 6, 7, C.x, 1.6, C.z);

    // the ingredient table and its flasks
    const TX = 2.7;
    ctx.box('darkWood', 0.9, 0.08, 3.6, TX, 0.95, -1.0);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) ctx.box('darkWood', 0.08, 0.95, 0.08, TX + sx * 0.38, 0.47, -1.0 + sz * 1.7);
    ctx.collideBox(TX, -1.0, 0.9, 3.6);
    const flasks = INGREDIENTS.map((ing, i) => {
        const g = new THREE.Group();
        const home = new V3(TX - 0.05, 0.99, -2.6 + i * 0.8);
        g.position.copy(home);
        const glass = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), ctx.mats.glassClear);
        glass.position.y = 0.17;
        g.add(glass);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 12, 1, true), ctx.mats.glassClear);
        neck.position.y = 0.42;
        g.add(neck);
        const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.06, 10), ctx.mats.bark);
        cork.position.y = 0.55;
        g.add(cork);
        const mat = emissiveMat(ing.color, 1.1, { color: ing.color, transparent: true, opacity: 0.9 });
        const fill = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12, 0, TAU, Math.PI * 0.35, Math.PI * 0.65), mat);
        fill.position.y = 0.17;
        g.add(fill);
        const halo = glow(ing.color, 0.7, 0.35);
        halo.position.y = 0.2;
        g.add(halo);
        const tag = plaqueMesh(ing.name, null, 0.36);
        tag.position.set(-0.24, 0.05, 0);
        tag.rotation.y = -Math.PI / 2;
        tag.rotation.x = 0;
        g.add(tag);
        ctx.add(g);
        const f = { ing, g, home, cork, t: -1 };
        ctx.hit(glass, {
            label: `${ing.name} · click to add it to the cauldron`,
            range: 4.5,
            stand: { x: 1.6, z: home.z },
            onClick: () => {
                if (busy || brewing > 0) return;
                busy = f;
                f.t = 0;
                audio.noise(0.08, 1800, 3, 0.06);
            },
        });
        return f;
    });
    // the shelf of finished brews on the back wall
    ctx.box('darkWood', 3.6, 0.06, 0.34, -1.2, 1.7, -D / 2 + 0.18);
    ctx.box('darkWood', 3.6, 0.06, 0.34, -1.2, 2.5, -D / 2 + 0.18);
    const shelfSpots = [];
    for (let k = 0; k < 7; k++) shelfSpots.push(new V3(-2.75 + k * 0.5, 1.73, -D / 2 + 0.2));
    for (let k = 0; k < 7; k++) shelfSpots.push(new V3(-2.75 + k * 0.5, 2.53, -D / 2 + 0.2));
    const brewed = [];
    const brewPlaque = plaqueMesh('Brews of the Day', 'Do not drink', 0.7);
    brewPlaque.position.set(-1.2, 3.0, -D / 2 + 0.03);
    ctx.add(brewPlaque);

    // jars of glowing things on the left wall, herbs from the ceiling, a lectern with a recipe book
    for (let row = 0; row < 3; row++) {
        const y = 1.2 + row * 0.8;
        ctx.box('darkWood', 0.34, 0.05, 4.4, -W / 2 + 0.18, y, -0.6);
        for (let k = 0; k < 8; k++) {
            const c = RAINBOW[(k + row * 3) % RAINBOW.length];
            const key = 'jar' + c;
            ctx.roomMats[key] ??= emissiveMat(c, 0.9, { color: c });
            const h = 0.18 + r() * 0.16;
            ctx.geo(key, new THREE.CylinderGeometry(0.08, 0.08, h, 10), -W / 2 + 0.2, y + h / 2 + 0.03, -2.5 + k * 0.54);
            ctx.geo('bark', new THREE.CylinderGeometry(0.085, 0.085, 0.03, 10), -W / 2 + 0.2, y + h + 0.04, -2.5 + k * 0.54);
        }
    }
    for (let k = 0; k < 12; k++) {
        const x = -3.8 + (k % 6) * 1.5, z = k < 6 ? -2.6 : 1.8;
        ctx.box('bark', 0.012, 0.5, 0.012, x, ceil - 0.25, z);
        ctx.geo('hedge', new THREE.ConeGeometry(0.14, 0.45, 7).rotateX(Math.PI), x, ceil - 0.68, z);
    }
    ctx.box('darkWood', 0.6, 1.1, 0.5, -3.6, 0.55, 2.6, 0.4);
    ctx.box('paper', 0.66, 0.06, 0.48, -3.6, 1.13, 2.6, 0.4, -0.25);
    ctx.collide(-3.6, 2.6, 0.45);
    ctx.proxy(0.7, 0.4, 0.6, -3.6, 1.2, 2.6, {
        label: 'Brewing for Beginners & Dragons',
        onClick: () => {
            audio.page();
            ctx.say('“Chapter One: Three ingredients, one cauldron, no refunds. Chapter Two: on the importance of standing well back.”', 6000);
        },
    });

    // the smoke of a finished brew
    const SN = 70;
    const smoke = colorMotes(SN, 0.5, 0.75);
    ctx.add(smoke);
    const puffs = Array.from({ length: SN }, () => ({ p: new V3(0, -10, 0), v: new V3(), life: 0 }));
    const pourN = 24;
    const pour = motes(pourN, 0xffffff, 0.08, 0.95);
    ctx.add(pour);
    let busy = null, added = [], brewing = 0, told = false;
    const mixCol = new THREE.Color(0x4a6a3a), targetCol = new THREE.Color(0x4a6a3a);
    const above = new V3(C.x + 0.55, 1.75, C.z);

    const finish = () => {
        const [name, effect] = brewName(added.map((a) => a.id));
        const col = new THREE.Color(0, 0, 0);
        for (const a of added) col.add(new THREE.Color(a.color));
        col.multiplyScalar(1 / added.length);
        brewing = 2.6;
        audio.poof();
        const sc = smoke.geometry.attributes.color;
        puffs.forEach((p, i) => {
            p.p.set(C.x + (r() - 0.5) * 0.6, 1.1, C.z + (r() - 0.5) * 0.6);
            p.v.set((r() - 0.5) * 1.4, 1.5 + r() * 2.5, (r() - 0.5) * 1.4);
            p.life = 1.5 + r() * 1.5;
            const c = r() < 0.6 ? col : new THREE.Color(added[i % added.length].color);
            sc.setXYZ(i, c.r, c.g, c.b);
        });
        sc.needsUpdate = true;
        // a new bottle on the shelf
        const spot = shelfSpots[brewed.length % shelfSpots.length];
        if (brewed.length >= shelfSpots.length) {
            const old = brewed[brewed.length % shelfSpots.length];
            ctx.group.remove(old);
        }
        const bottle = new THREE.Group();
        const bm = emissiveMat(col, 1.0, { color: col, transparent: true, opacity: 0.85 });
        const shape = brewed.length % 3;
        const body = new THREE.Mesh(shape === 0 ? new THREE.SphereGeometry(0.11, 14, 10) : shape === 1 ? new THREE.CylinderGeometry(0.08, 0.1, 0.24, 6) : new THREE.ConeGeometry(0.12, 0.26, 12), bm);
        body.position.y = 0.12;
        bottle.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.1, 8), ctx.mats.glassClear);
        neck.position.y = 0.28;
        bottle.add(neck);
        const stop = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), ctx.mats.gold);
        stop.position.y = 0.35;
        bottle.add(stop);
        bottle.position.copy(spot);
        bottle.scale.setScalar(0.01);
        bottle.userData.grow = 0;
        ctx.add(bottle);
        brewed.push(bottle);
        ctx.say(`You brewed the ${name}! Side effects: ${effect}.`, 7000);
        targetCol.copy(col);
        added = [];
    };

    ctx.light(0xffb070, 10, 14, 1.5, ceil - 0.6, 1.0);

    return {
        update(dt, t) {
            liquidU.uTime.value = t;
            flames.forEach((f, i) => {
                f.position.y = 0.22 + ((t * 0.9 + i * 0.17) % 1) * 0.2;
                f.material.opacity = 0.8 - ((t * 0.9 + i * 0.17) % 1) * 0.6;
                f.scale.setScalar(0.4 + Math.sin(t * 9 + i) * 0.08);
            });
            // the flask flying over, pouring and going home
            if (busy) {
                const f = busy;
                f.t += dt;
                const T1 = 0.7, T2 = 1.6, T3 = 2.3;
                if (f.t < T1) {
                    const k = ease.inOut(f.t / T1);
                    f.g.position.lerpVectors(f.home, above, k);
                    f.g.position.y += Math.sin(k * Math.PI) * 0.5;
                    f.cork.position.y = 0.55 + k * 0.25;
                    f.cork.visible = k < 0.9;
                } else if (f.t < T2) {
                    f.g.position.copy(above);
                    f.g.rotation.z = Math.min(1, (f.t - T1) / 0.3) * 2.0;
                    if (!f.poured) {
                        f.poured = true;
                        audio.pour();
                    }
                } else if (f.t < T3) {
                    const k = ease.inOut((f.t - T2) / (T3 - T2));
                    f.g.rotation.z = 2.0 * (1 - k);
                    f.g.position.lerpVectors(above, f.home, k);
                    f.g.position.y += Math.sin(k * Math.PI) * 0.4;
                    f.cork.visible = k > 0.1;
                    f.cork.position.y = 0.55 + (1 - k) * 0.25;
                } else {
                    f.g.position.copy(f.home);
                    f.g.rotation.z = 0;
                    f.poured = false;
                    busy = null;
                    added.push(f.ing);
                    targetCol.copy(new THREE.Color(0, 0, 0));
                    for (const a of added) targetCol.add(new THREE.Color(a.color));
                    targetCol.multiplyScalar(1 / added.length);
                    audio.bubble();
                    if (added.length === 3) finish();
                    else if (!told) {
                        told = true;
                        ctx.say(`${f.ing.name} goes in with a hiss. Two more ingredients to go.`, 4000);
                    }
                }
                // the pour
                const pp = pour.geometry.attributes.position;
                const pouring = f.t > T1 + 0.25 && f.t < T2;
                pour.visible = pouring;
                pour.material.color.set(f.ing.color);
                if (pouring) for (let i = 0; i < pourN; i++) {
                    const k = ((t * 2.5 + i / pourN) % 1);
                    pp.setXYZ(i, above.x - 0.32 - k * 0.12, above.y + 0.15 - k * 0.75, above.z + Math.sin(i * 7) * 0.02);
                }
                pp.needsUpdate = true;
            } else pour.visible = false;
            mixCol.lerp(targetCol, Math.min(1, dt * 1.5));
            liquidU.uColor.value.copy(mixCol);
            steam.material.color.copy(mixCol);
            cauldronLight.color.copy(mixCol);
            // the eruption
            if (brewing > 0) {
                brewing -= dt;
                liquidU.uBoil.value = 2.5;
                steam.material.opacity = 0.8;
                steam.scale.setScalar(2.2 + Math.sin(t * 20) * 0.3 + brewing);
                cauldronLight.intensity = 6 + brewing * 8;
                if (brewing <= 0) targetCol.set(0x4a6a3a);
            } else {
                liquidU.uBoil.value = 0.3 + added.length * 0.4;
                steam.material.opacity = 0.3 + Math.sin(t * 0.8) * 0.05;
                steam.scale.setScalar(2.2);
                cauldronLight.intensity = 6;
            }
            const sp = smoke.geometry.attributes.position;
            puffs.forEach((p, i) => {
                if (p.life > 0) {
                    p.life -= dt;
                    p.v.multiplyScalar(1 - dt * 0.8);
                    p.p.addScaledVector(p.v, dt);
                    if (p.p.y > ceil - 0.3) p.v.y = -Math.abs(p.v.y) * 0.2;
                }
                sp.setXYZ(i, p.p.x, p.life > 0 ? p.p.y : -10, p.p.z);
            });
            sp.needsUpdate = true;
            const bp = bubbles.geometry.attributes.position;
            bub.forEach((b, i) => {
                b.life += dt * (0.5 + liquidU.uBoil.value * 0.4);
                if (b.life > 1) {
                    b.life = 0;
                    const a = r() * TAU, d = Math.sqrt(r()) * 0.6;
                    b.p.set(C.x + Math.cos(a) * d, 0.96, C.z + Math.sin(a) * d);
                }
                bp.setXYZ(i, b.p.x, b.p.y + b.life * 0.5, b.p.z);
            });
            bp.needsUpdate = true;
            bubbles.material.color.copy(mixCol).lerp(new THREE.Color(0xffffff), 0.4);
            for (const b of brewed) {
                if (b.userData.grow < 1) {
                    b.userData.grow = Math.min(1, b.userData.grow + dt * 1.5);
                    b.scale.setScalar(Math.max(0.01, ease.back(b.userData.grow)));
                }
            }
        },
    };
}

// ================================================================ the Origami Aviary

function craneGeometry() {
    const p = [
        // the keel of the body
        0, 0, 0.12, 0, -0.06, 0, 0, 0, -0.1,
        0, 0, 0.12, 0, 0.03, 0, 0, 0, -0.1,
        // neck and head
        0.012, 0, 0.07, -0.012, 0, 0.07, 0, 0.13, 0.2,
        0, 0.13, 0.2, 0, 0.115, 0.2, 0, 0.1, 0.27,
        // tail
        0.012, 0, -0.06, -0.012, 0, -0.06, 0, 0.11, -0.22,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
}

function wingGeometry(side) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.01, 0.07, 0, 0.01, -0.06, side * 0.3, 0.03, -0.03, 0, 0.01, 0.07, side * 0.3, 0.03, -0.03, side * 0.16, 0.02, 0.06], 3));
    g.computeVertexNormals();
    return g;
}

export function buildAviary(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    const N = ctx.low ? 26 : 40;
    const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, flatShading: true, emissive: 0x222222 });
    const body = new THREE.InstancedMesh(craneGeometry(), paper, N);
    const wingL = new THREE.InstancedMesh(wingGeometry(-1), paper, N);
    const wingR = new THREE.InstancedMesh(wingGeometry(1), paper, N);
    for (const m of [body, wingL, wingR]) {
        m.frustumCulled = false;
        ctx.add(m);
    }
    const PAPER = ['#ff8fa8', '#ffd36a', '#8fd8ff', '#b8f28a', '#c8a8ff', '#ffffff', '#ffa86a', '#7ae8d0'];
    const birds = Array.from({ length: N }, (_, i) => ({
        p: new V3((r() - 0.5) * (W - 2), 2.5 + r() * (ceil - 3.5), (r() - 0.5) * (D - 2)),
        v: new V3(r() - 0.5, 0, r() - 0.5).setLength(1.5),
        ph: r() * TAU,
        col: new THREE.Color(PAPER[i % PAPER.length]),
        target: new THREE.Color(PAPER[i % PAPER.length]),
        loop: 0,
    }));
    const setColors = () => {
        birds.forEach((b, i) => {
            for (const m of [body, wingL, wingR]) m.setColorAt(i, b.col);
        });
        for (const m of [body, wingL, wingR]) m.instanceColor.needsUpdate = true;
    };
    setColors();
    let swirl = 0, scatter = 0, hue = 0;
    ctx.hit(body, {
        label: 'A paper crane · click it',
        range: 12,
        onClick: (h) => {
            const b = birds[h.instanceId];
            if (!b) return;
            b.loop = 1.6;
            hue = (hue + 0.13) % 1;
            birds.forEach((o, i) => o.target.setHSL((hue + i / N * 0.35) % 1, 0.75, 0.72));
            audio.flutter();
            audio.bell(PENTA[8 + (h.instanceId % 6)], 0, 0.04);
        },
    });

    // the brass whistle on a stand by the door
    const WX = 2.4, WZ = 3.4;
    ctx.geo('brass', new THREE.CylinderGeometry(0.04, 0.06, 1.1, 10), WX, 0.55, WZ);
    ctx.geo('brass', new THREE.CylinderGeometry(0.2, 0.25, 0.05, 16), WX, 0.03, WZ);
    const whistle = new THREE.Group();
    whistle.position.set(WX, 1.18, WZ);
    const wb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10).scale(1.5, 1, 1), ctx.mats.gold);
    whistle.add(wb);
    const wt = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 10).rotateZ(Math.PI / 2), ctx.mats.gold);
    wt.position.x = 0.2;
    whistle.add(wt);
    const wbird = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6).rotateX(Math.PI / 2), ctx.mats.gold);
    wbird.position.set(-0.05, 0.1, 0);
    whistle.add(wbird);
    ctx.add(whistle);
    ctx.collide(WX, WZ, 0.3);
    const pl = plaqueMesh('The Bird Whistle', 'One blow, and they come', 0.5);
    pl.position.set(WX, 0.75, WZ + 0.08);
    ctx.add(pl);
    ctx.proxy(0.5, 0.5, 0.5, WX, 1.18, WZ, {
        label: 'The bird whistle · blow it',
        onClick: () => {
            swirl = 7;
            audio.whistle();
            audio.flutter();
            ctx.say('Every crane in the aviary turns at once and comes to circle you, rustling like a library in a breeze.', 5000);
        },
    });

    // paper lanterns, a paper moon, bunting and a folding table
    const lanterns = [];
    for (let k = 0; k < 9; k++) {
        const c = PAPER[k % PAPER.length];
        const x = -4 + (k % 5) * 2 + r() * 0.4, z = -3.4 + Math.floor(k / 5) * 4.5 + r() * 0.6, y = ceil - 1.2 - r() * 1.6;
        const lm = emissiveMat(c, 0.9, { color: c, transparent: true, opacity: 0.92 });
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10).scale(1, 1.15, 1), lm);
        lan.position.set(x, y, z);
        ctx.add(lan);
        ctx.box('bark', 0.01, ceil - y - 0.3, 0.01, x, (ceil + y + 0.3) / 2, z);
        for (const s of [-1, 1]) ctx.box('black', 0.2, 0.03, 0.2, x, y + s * 0.32, z);
        lanterns.push({ lan, y, ph: r() * TAU });
    }
    const moonTex = new THREE.CanvasTexture((() => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const x = c.getContext('2d');
        x.fillStyle = '#fff6d8';
        x.beginPath();
        x.arc(128, 128, 124, 0, TAU);
        x.fill();
        x.fillStyle = 'rgba(200,170,110,0.35)';
        for (const [cx, cy, rr] of [[90, 90, 26], [160, 150, 34], [110, 180, 16], [170, 80, 14], [70, 150, 12]]) {
            x.beginPath();
            x.arc(cx, cy, rr, 0, TAU);
            x.fill();
        }
        x.strokeStyle = 'rgba(160,130,80,0.5)';
        x.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
            x.beginPath();
            x.moveTo(40 + i * 18, 30);
            x.lineTo(60 + i * 14, 226);
            x.stroke();
        }
        return c;
    })());
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshStandardMaterial({ map: moonTex, emissive: 0xffffff, emissiveMap: moonTex, emissiveIntensity: 0.7, transparent: true }));
    moon.position.set(1.6, ceil - 2.0, -D / 2 + 0.05);
    ctx.add(moon);
    const flags = RAINBOW.concat(RAINBOW);
    for (const z of [-1.5, 1.8]) {
        for (let k = 0; k < flags.length; k++) {
            const x = -W / 2 + 0.5 + (k / (flags.length - 1)) * (W - 1);
            const y = ceil - 0.6 - Math.sin((k / (flags.length - 1)) * Math.PI) * 0.7;
            const key = 'flag' + (k % 7);
            ctx.roomMats[key] ??= new THREE.MeshStandardMaterial({ color: flags[k], roughness: 0.9, side: THREE.DoubleSide });
            ctx.geo(key, new THREE.ConeGeometry(0.16, 0.34, 3).rotateX(Math.PI), x, y - 0.17, z, Math.PI / 2, 1, 1, 0.1);
        }
    }
    ctx.box('wood', 1.8, 0.06, 0.9, -3.2, 0.8, 2.6);
    for (const sx of [-1, 1]) ctx.box('iron', 0.05, 0.8, 0.8, -3.2 + sx * 0.8, 0.4, 2.6);
    ctx.collideBox(-3.2, 2.6, 1.8, 0.9);
    for (let k = 0; k < 6; k++) ctx.box('paper', 0.24, 0.005, 0.24, -3.7 + (k % 3) * 0.32, 0.84 + Math.floor(k / 3) * 0.006, 2.45 + Math.floor(k / 3) * 0.3, r() * 0.5);
    const tbl = plaqueMesh('Fold your own', 'Paper provided', 0.5);
    tbl.position.set(-3.2, 0.62, 3.06);
    ctx.add(tbl);
    ctx.light(0xfff4e0, 14, 18, 0, ceil - 0.5, 0);

    const o = new THREE.Object3D(), w = new THREE.Object3D();
    const cen = new V3(), avg = new V3(), sep = new V3(), tmp = new V3(), up = new V3(0, 1, 0);
    const cam = new V3();
    return {
        update(dt, t) {
            swirl = Math.max(0, swirl - dt);
            scatter = Math.max(0, scatter - dt);
            ctx.camLocal(cam);
            cen.set(0, 0, 0);
            avg.set(0, 0, 0);
            for (const b of birds) {
                cen.add(b.p);
                avg.add(b.v);
            }
            cen.multiplyScalar(1 / N);
            avg.multiplyScalar(1 / N);
            birds.forEach((b, i) => {
                const acc = tmp.set(0, 0, 0);
                if (swirl > 0) {
                    // orbit the player's head
                    const a = t * 1.4 + (i / N) * TAU;
                    const rr = 1.3 + (i % 3) * 0.35;
                    acc.set(cam.x + Math.cos(a) * rr - b.p.x, cam.y + 0.3 + Math.sin(a * 2 + i) * 0.4 - b.p.y, cam.z + Math.sin(a) * rr - b.p.z).multiplyScalar(2.2);
                } else {
                    acc.addScaledVector(cen.clone().sub(b.p), 0.12);
                    acc.addScaledVector(avg.clone().sub(b.v), 0.4);
                    sep.set(0, 0, 0);
                    for (const c of birds) {
                        if (c === b) continue;
                        const d = b.p.distanceTo(c.p);
                        if (d < 0.6 && d > 1e-4) sep.addScaledVector(b.p.clone().sub(c.p), (0.6 - d) / d);
                    }
                    acc.addScaledVector(sep, 3);
                    acc.x += Math.sin(t * 0.7 + b.ph) * 0.6;
                    acc.y += Math.sin(t * 0.9 + b.ph * 2) * 0.4;
                    // keep in the room, and clear of the player's head
                    const m = 1.2;
                    if (b.p.x < -W / 2 + m) acc.x += 3;
                    if (b.p.x > W / 2 - m) acc.x -= 3;
                    if (b.p.z < -D / 2 + m) acc.z += 3;
                    if (b.p.z > D / 2 - m) acc.z -= 3;
                    if (b.p.y < 2.2) acc.y += 3;
                    if (b.p.y > ceil - 0.8) acc.y -= 3;
                    const dh = b.p.distanceTo(cam);
                    if (dh < 1.2) acc.addScaledVector(b.p.clone().sub(cam).normalize(), 4);
                }
                b.v.addScaledVector(acc, dt);
                const sp = b.v.length(), want = swirl > 0 ? 2.6 : 1.7;
                b.v.multiplyScalar(lerp(1, want / Math.max(sp, 0.01), Math.min(1, dt * 2)));
                b.p.addScaledVector(b.v, dt);
                b.col.lerp(b.target, Math.min(1, dt * 2.5));
                // pose: face the way it flies, a loop-the-loop if clicked
                o.position.copy(b.p);
                o.lookAt(tmp.copy(b.p).add(b.v));
                if (b.loop > 0) {
                    b.loop -= dt;
                    o.rotateX(-(1.6 - b.loop) / 1.6 * TAU);
                }
                o.rotateZ(Math.sin(t + b.ph) * 0.15);
                o.scale.setScalar(1.8);
                o.updateMatrix();
                body.setMatrixAt(i, o.matrix);
                const flap = Math.sin(t * (swirl > 0 ? 14 : 9) + b.ph) * 0.7;
                for (const [m, s] of [[wingL, 1], [wingR, -1]]) {
                    w.position.set(0, 0, 0);
                    w.rotation.set(0, 0, s * flap);
                    w.updateMatrix();
                    m.setMatrixAt(i, o.matrix.clone().multiply(w.matrix));
                }
            });
            for (const m of [body, wingL, wingR]) m.instanceMatrix.needsUpdate = true;
            setColors();
            for (const l of lanterns) {
                l.lan.position.y = l.y + Math.sin(t * 0.8 + l.ph) * 0.05;
                l.lan.rotation.y = t * 0.2 + l.ph;
            }
            whistle.rotation.y = Math.sin(t * 0.7) * 0.3;
        },
    };
}

// ================================================================ the Glowshroom Grotto

export function buildGrotto(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    // rock walls and ceiling
    const rock = ctx.mats.cave.clone();
    rock.map = rock.map.clone();
    rock.map.repeat.set(3, 2);
    rock.map.needsUpdate = true;
    rock.color.set(0x2a5050);
    ctx.roomMats.rw = rock;
    ctx.roomMats.rc = rock;
    // stalactites and stalagmites
    for (let k = 0; k < 40; k++) {
        const x = (r() - 0.5) * (W - 0.6), z = (r() - 0.5) * (D - 0.6), h = 0.3 + r() * 1.1;
        ctx.geo('cave', new THREE.ConeGeometry(0.1 + r() * 0.2, h, 7).rotateX(Math.PI), x, ceil - h / 2, z, r() * 3);
    }
    for (let k = 0; k < 18; k++) {
        const side = k % 4;
        const t = r() - 0.5;
        const x = side < 2 ? (side ? 1 : -1) * (W / 2 - 0.35 - r() * 0.3) : t * (W - 1);
        const z = side >= 2 ? (side === 3 ? 1 : -1) * (D / 2 - 0.35 - r() * 0.3) : t * (D - 1);
        if (z > D / 2 - 1 && Math.abs(x) < 1.6) continue;
        const h = 0.4 + r() * 1.2;
        ctx.geo('cave', new THREE.ConeGeometry(0.15 + r() * 0.25, h, 7), x, h / 2, z, r() * 3);
        ctx.collide(x, z, 0.3);
    }
    // a glowing pool in the back corner
    const PX = -3.0, PZ = -3.0;
    const poolU = { uTime: { value: 0 } };
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: poolU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTime; varying vec2 vUv;
            void main(){ vec2 p = vUv - 0.5; float d = length(p);
            float w = 0.5 + 0.5 * sin(d * 40.0 - uTime * 2.0) * sin(atan(p.y,p.x) * 5.0 + uTime * 0.5);
            vec3 c = mix(vec3(0.0,0.35,0.4), vec3(0.3,1.0,0.9), w * (1.0 - d * 1.6));
            gl_FragColor = vec4(c, 1.0); }`,
    }));
    pool.position.set(PX, 0.03, PZ);
    ctx.add(pool);
    for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU;
        ctx.geo('cave', new THREE.DodecahedronGeometry(0.22 + r() * 0.1, 0), PX + Math.cos(a) * 1.35, 0.05, PZ + Math.sin(a) * 1.35, a);
    }
    ctx.collide(PX, PZ, 1.4);
    const poolLight = ctx.light(0x4affe0, 6, 6, PX, 0.8, PZ);

    // the singing mushrooms, in an arc facing the door
    const shrooms = [];
    const n = 8;
    const capColors = ['#ff4f8a', '#ff8a3a', '#ffd84a', '#7aff5a', '#3affd8', '#3aa8ff', '#8a5aff', '#ff5ae8'];
    for (let i = 0; i < n; i++) {
        const a = -1.25 + (i / (n - 1)) * 2.5;
        const x = Math.sin(a) * 3.0, z = -0.6 - Math.cos(a) * 2.2;
        const h = 0.7 + (n - 1 - Math.abs(i - 3.5)) * 0.18 + r() * 0.2;
        const capR = 0.35 + h * 0.18;
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0xe8f0e0, emissive: 0x8aa8a0, emissiveIntensity: 0.35, roughness: 0.6 });
        const stem = new THREE.Mesh(lathe([[0, 0], [0.16, 0], [0.11, 0.2], [0.09, h * 0.7], [0.12, h], [0, h]], 14), stemMat);
        g.add(stem);
        const col = new THREE.Color(capColors[i]);
        const capMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.4 });
        const cap = new THREE.Mesh(lathe([[0, capR * 0.55], [capR * 0.55, capR * 0.5], [capR * 0.9, capR * 0.3], [capR, capR * 0.05], [capR * 0.92, 0], [0.1, 0.02]], 24).scale(1, 1, 1), capMat);
        cap.position.y = h - 0.04;
        g.add(cap);
        // gills glow underneath
        const gills = new THREE.Mesh(new THREE.CircleGeometry(capR * 0.9, 24).rotateX(Math.PI / 2), emissiveMat(col.clone().lerp(new THREE.Color(0xffffff), 0.5), 0.8));
        gills.position.y = h - 0.03;
        g.add(gills);
        for (let k = 0; k < 7; k++) {
            const da = r() * TAU, dr = r() * capR * 0.7;
            const spot = new THREE.Mesh(new THREE.SphereGeometry(0.03 + r() * 0.03, 8, 6), ctx.mats.white);
            spot.position.set(Math.cos(da) * dr, h - 0.04 + capR * 0.5 * (1 - (dr / capR) ** 2) + 0.01, Math.sin(da) * dr);
            g.add(spot);
        }
        const halo = glow(col, capR * 4, 0.25);
        halo.position.y = h;
        g.add(halo);
        ctx.add(g);
        ctx.collide(x, z, 0.3);
        const s = { g, cap, capMat, halo, col, h, note: PENTA[5 + i], bounce: 0, glowK: 0 };
        shrooms.push(s);
        ctx.hit(cap, { label: 'A glowshroom · click to ring it', range: 7, onClick: () => ring(i) });
        ctx.hit(stem, { label: 'A glowshroom · click to ring it', range: 7, onClick: () => ring(i) });
    }
    const SPN = 120;
    const spores = colorMotes(SPN, 0.09, 0.95);
    ctx.add(spores);
    const sp = Array.from({ length: SPN }, () => ({ p: new V3(0, -10, 0), v: new V3(), life: 0 }));
    let spI = 0;
    const burst = (s, count = 16, power = 1) => {
        const cc = spores.geometry.attributes.color;
        for (let k = 0; k < count; k++) {
            const p = sp[spI];
            spI = (spI + 1) % SPN;
            p.p.set(s.g.position.x + (r() - 0.5) * 0.3, s.h + 0.15, s.g.position.z + (r() - 0.5) * 0.3);
            p.v.set((r() - 0.5) * 1.2 * power, (0.6 + r() * 1.2) * power, (r() - 0.5) * 1.2 * power);
            p.life = 2 + r() * 1.5;
            cc.setXYZ((spI + SPN - 1) % SPN, s.col.r, s.col.g, s.col.b);
        }
        cc.needsUpdate = true;
    };
    const played = [];
    let wave = -1, told = false;
    function ring(i) {
        const s = shrooms[i];
        s.bounce = 1;
        s.glowK = 1;
        audio.marimba(s.note);
        burst(s);
        played.push(i);
        if (played.length > 8) played.shift();
        const tail = played.slice(-5);
        const up = tail.length === 5 && tail.every((v, k) => k === 0 || v === tail[k - 1] + 1);
        const down = tail.length === 5 && tail.every((v, k) => k === 0 || v === tail[k - 1] - 1);
        if ((up || down) && wave < 0) {
            wave = 0;
            played.length = 0;
            setTimeout(() => audio.arp([74, 78, 81, 86, 90, 93], 0.1, 0.035), 300);
            ctx.say(told ? 'The grotto sings it back, louder this time.' : 'You played a scale, and the whole grotto hums it back to you in a shower of spores.', 5000);
            told = true;
        }
    }
    // fireflies
    const FN = ctx.low ? 30 : 60;
    const flies = motes(FN, 0xc8ff6a, 0.1, 0.9);
    ctx.add(flies);
    const fl = Array.from({ length: FN }, () => ({ x: (r() - 0.5) * (W - 1), y: 0.5 + r() * (ceil - 1.2), z: (r() - 0.5) * (D - 1), ph: r() * TAU, s: 0.2 + r() * 0.4 }));
    const pinkLight = ctx.light(0xff6ad8, 7, 9, 2.5, 2.5, -1.5);

    return {
        update(dt, t) {
            poolU.uTime.value = t;
            poolLight.intensity = 6 + Math.sin(t * 1.3) * 1.5;
            if (wave >= 0) {
                wave += dt;
                shrooms.forEach((s, i) => {
                    const k = wave * 5 - i;
                    if (k > 0 && k < dt * 5 + 0.001) {
                        s.bounce = 1;
                        s.glowK = 1;
                        burst(s, 20, 1.6);
                        audio.marimba(s.note + 12);
                    }
                });
                if (wave > 3) wave = -1;
            }
            for (const s of shrooms) {
                s.bounce = Math.max(0, s.bounce - dt * 2.2);
                s.glowK = Math.max(0, s.glowK - dt * 1.2);
                const b = s.bounce;
                const sq = Math.sin(b * Math.PI * 3) * b;
                s.g.scale.set(1 + sq * 0.18, 1 - sq * 0.22, 1 + sq * 0.18);
                s.capMat.emissiveIntensity = 0.5 + s.glowK * 2.5 + Math.sin(t * 1.5 + s.note) * 0.12;
                s.halo.material.opacity = 0.2 + s.glowK * 0.5;
            }
            const pp = spores.geometry.attributes.position;
            sp.forEach((p, i) => {
                if (p.life > 0) {
                    p.life -= dt;
                    p.v.y -= dt * 0.25;
                    p.v.multiplyScalar(1 - dt * 0.6);
                    p.p.addScaledVector(p.v, dt);
                    p.p.x += Math.sin(t * 2 + i) * dt * 0.1;
                }
                pp.setXYZ(i, p.p.x, p.life > 0 ? p.p.y : -10, p.p.z);
            });
            pp.needsUpdate = true;
            const fp = flies.geometry.attributes.position;
            fl.forEach((f, i) => fp.setXYZ(i, f.x + Math.sin(t * f.s + f.ph) * 0.8, f.y + Math.sin(t * f.s * 1.7 + f.ph) * 0.3, f.z + Math.cos(t * f.s * 0.8 + f.ph) * 0.8));
            fp.needsUpdate = true;
            flies.material.opacity = 0.6 + 0.3 * Math.sin(t * 3);
            pinkLight.intensity = 6 + Math.sin(t * 0.7) * 2;
        },
    };
}
