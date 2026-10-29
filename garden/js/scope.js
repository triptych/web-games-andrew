// The view through the Great Telescope: one procedurally generated thing in
// the sky at a time, framed by the eyepiece, with a card about it, the way the
// pier gives you a card for a fish. Rocky worlds (verdant, desert, ice, ocean,
// lava, violet jungle, crystal), gas giants with and without rings, red dwarfs,
// yellow suns, blue giants, binary suns, pulsars, emission and ring nebulae, a
// spiral galaxy and, rarely, a black hole. Every one is seeded, named, and
// written into your star log. Its own scene, drawn by the garden's composer.

import * as THREE from 'three';
import { glowSprite, softGlow } from './textures.js';
import { rng, TAU, damp, clamp, lerp, store, esc } from './util.js';
import { placeName } from './rooms-archive.js';

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ kinds

const KINDS = [
    { id: 'verdant', label: 'Verdant World', rank: 0, w: 10 },
    { id: 'desert', label: 'Desert World', rank: 0, w: 9 },
    { id: 'ice', label: 'Ice World', rank: 0, w: 8 },
    { id: 'ocean', label: 'Ocean World', rank: 0, w: 8 },
    { id: 'gas', label: 'Gas Giant', rank: 0, w: 10 },
    { id: 'lava', label: 'Lava World', rank: 1, w: 6 },
    { id: 'ringed', label: 'Ringed Giant', rank: 1, w: 6 },
    { id: 'jungle', label: 'Violet Jungle World', rank: 1, w: 5 },
    { id: 'reddwarf', label: 'Red Dwarf', rank: 1, w: 6 },
    { id: 'sun', label: 'Yellow Sun', rank: 1, w: 6 },
    { id: 'bluegiant', label: 'Blue Giant', rank: 2, w: 3 },
    { id: 'crystal', label: 'Crystal World', rank: 2, w: 3 },
    { id: 'binary', label: 'Binary Suns', rank: 2, w: 3 },
    { id: 'nebula', label: 'Emission Nebula', rank: 2, w: 3.5 },
    { id: 'ringneb', label: 'Ring Nebula', rank: 2, w: 2.5 },
    { id: 'pulsar', label: 'Pulsar', rank: 2, w: 2 },
    { id: 'galaxy', label: 'Spiral Galaxy', rank: 3, w: 2 },
    { id: 'blackhole', label: 'Black Hole', rank: 3, w: 2 },
];
const RANKS = ['Common', 'Uncommon', 'Rare', 'Legendary'];

const FACTS = {
    verdant: ['A temperate world of shallow seas and long green continents.', 'Rivers here run for thousands of miles and never seem to reach the sea.', 'Its forests are so old they have started to grow forests of their own.'],
    desert: ['A dry world of dunes and salt flats, scoured by slow red winds.', 'Its dunes sing at sunset, every one in a slightly different key.', 'Somewhere under the sand there is said to be an ocean, sulking.'],
    ice: ['A frozen world, white from pole to pole, cracked into a mosaic of glaciers.', 'The ice is so clear in places you can see fish frozen mid-thought.', 'It snows upwards here, on Thursdays.'],
    ocean: ['A world of one endless ocean, broken by a scatter of islands.', 'Its tides are so big that the islands have to be put away twice a day.', 'Whales the size of towns sing to each other across the whole planet.'],
    gas: ['A giant of churning gas, banded by winds faster than sound.', 'Its great storm has been going for longer than anyone has been watching.', 'It is mostly hydrogen, with a hint of something like cinnamon.'],
    lava: ['A young, molten world; its crust is a thin black skin over a sea of fire.', 'Its volcanoes erupt in turn, like an orchestra tuning up.', 'You could toast bread by holding it near this planet. Not too near.'],
    ringed: ['A gas giant wearing rings of ice and dust, each no thicker than a house.', 'The rings are slowly being nibbled away by a tiny, very hungry moon.', 'Seen edge on, the rings vanish altogether, which they find very funny.'],
    jungle: ['A warm world whose plants have chosen violet instead of green.', 'The jungle is so dense that the rain has never once reached the ground.', 'At night, the whole southern continent glows like a bruise.'],
    reddwarf: ['A small, cool, patient star, which will outlive almost everything else.', 'It will still be shining in a trillion years, slightly smug about it.', 'Most of the stars in the sky are like this one. Nobody ever mentions them.'],
    sun: ['A middle-aged yellow star, steady and warm, in no hurry at all.', 'It has eight planets, two of which are probably having picnics.', 'If you squint, it looks a lot like ours. Do not squint at stars.'],
    bluegiant: ['A huge, hot, young star, burning through its fuel at a tremendous rate.', 'It will live fast and end as a supernova bright enough to read by.', 'It is a hundred thousand times as bright as the Sun, and knows it.'],
    crystal: ['A world whose crust has grown into vast crystals, catching the starlight.', 'When the wind blows, the whole planet rings like a wineglass.', 'Geologists are still arguing about it. Loudly.'],
    binary: ['Two stars in a close waltz round each other, sharing their light.', 'Any planet here gets two sunsets, and two cups of tea to go with them.', 'They have been circling for a billion years, and still not decided who leads.'],
    nebula: ['A great cloud of glowing gas, lit from within by newborn stars.', 'Stars are being made inside it right now, a few hundred at a time.', 'Its colours come from hydrogen, oxygen and sulphur, and possibly joy.'],
    ringneb: ['The shell of a dying star, puffed out into a glowing ring.', 'At its centre the old star sits, shrunk to a white-hot ember.', 'In a few thousand years it will have blown away, like a smoke ring.'],
    pulsar: ['The spinning remnant of a giant star, sweeping beams across space like a lighthouse.', 'It turns hundreds of times a second, keeping better time than any clock in the tower.', 'A teaspoon of it would weigh as much as a mountain.'],
    galaxy: ['A whole galaxy, far away: hundreds of billions of suns in a slow pinwheel.', 'The light you are seeing left it before there were dinosaurs.', 'Somewhere in there, someone is probably looking back.'],
    blackhole: ['A black hole, wrapped in a blazing disc of matter it has not finished eating.', 'Its gravity bends the light of its own disc up and over the top, like a halo.', 'Time runs slow at its edge. Nobody who has checked has come back to say.'],
};
const WHIMSY = [
    'The telescope’s brass seems to hum when it is pointed this way.',
    'An astronomer once named it after their cat. The cat did not care.',
    'It is not on any of the charts in the Map Room. Yet.',
    'If you wave, something might wave back, in a few thousand years.',
    'The Starwright marked it in the margin with a small drawn heart.',
    'It is moving away from us at a polite, unhurried pace.',
    'The tower’s owl insists it saw this first.',
    'Its light has been travelling a long time just to land in your eye.',
];
const NEB_ADJ = ['Unravelled', 'Weeping', 'Velvet', 'Smouldering', 'Crimson', 'Drowsy', 'Laughing', 'Lantern', 'Silken', 'Thistle', 'Forgotten', 'Burning'];
const NEB_NOUN = ['Shawl', 'Rose', 'Heron', 'Lantern', 'Teapot', 'Veil', 'Fox', 'Thistle', 'Ghost', 'Butterfly', 'Kettle', 'Harp'];
const BH_NAME = ['The Quiet Keyhole', 'The Patient Throat', 'The Velvet Drain', 'Night’s Keyhole', 'The Final Door', 'The Hungry Halo', 'The Inkwell', 'The Plughole of Heaven'];

// ------------------------------------------------------------------ shaders

const NOISE = /* glsl */ `
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float ridge(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { float n = 1.0 - abs(noise(p) * 2.0 - 1.0); s += a * n * n; p *= 2.1; a *= 0.5; } return s; }
`;
const SPHERE_VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() { vP = position; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;

const PLANET_FRAG = /* glsl */ `
uniform vec3 uSeed; uniform float uGas; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform float uSea; uniform float uIce; uniform vec3 uLava; uniform float uLavaAmt; uniform float uCity; uniform vec3 uLight;
uniform float uBands; uniform vec3 uStorm; uniform float uWarp; uniform float uTime; uniform float uCrystal;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
${NOISE}
void main() {
    vec3 p = normalize(vP);
    vec3 col; vec3 glowc = vec3(0.0); float spec = 0.0;
    if (uGas > 0.5) {
        float w = fbm(p * 2.2 + uSeed);
        float lat = p.y + (w - 0.5) * uWarp + 0.03 * sin(p.x * 9.0 + uTime * 0.05);
        float b = 0.5 + 0.5 * sin(lat * uBands);
        float b2 = 0.5 + 0.5 * sin(lat * uBands * 2.37 + 1.3);
        col = mix(uC0, uC1, b);
        col = mix(col, uC2, b2 * 0.55);
        col = mix(col, uC3, smoothstep(0.55, 0.85, fbm(p * vec3(3.0, 14.0, 3.0) + uSeed)) * 0.5);
        vec3 sc = vec3(cos(uStorm.x) * sin(uStorm.y), sin(uStorm.x), cos(uStorm.x) * cos(uStorm.y));
        float d = length((p - sc) * vec3(1.0, 1.8, 1.0));
        float swirl = fbm(p * 9.0 + uSeed + d * 6.0);
        col = mix(col, uC4, smoothstep(uStorm.z, uStorm.z * 0.25, d) * (0.6 + 0.4 * swirl));
    } else {
        float h = fbm(p * 1.7 + uSeed) * 0.75 + fbm(p * 6.0 + uSeed * 1.7) * 0.25;
        float land = smoothstep(uSea - 0.01, uSea + 0.01, h);
        vec3 sea = mix(uC0, uC1, smoothstep(uSea - 0.15, uSea, h));
        vec3 ground = mix(uC2, uC3, smoothstep(uSea, uSea + 0.22, h + (noise(p * 30.0) - 0.5) * 0.05));
        ground = mix(ground, uC4, smoothstep(uSea + 0.2, uSea + 0.32, h));
        col = mix(sea, ground, land);
        spec = (1.0 - land) * 0.6;
        float pole = abs(p.y) + (fbm(p * 4.0 + uSeed) - 0.5) * 0.25;
        col = mix(col, vec3(0.93, 0.96, 1.0), smoothstep(1.0 - uIce, 1.05 - uIce, pole));
        if (uLavaAmt > 0.0) {
            float r = ridge(p * 3.0 + uSeed);
            float crack = smoothstep(0.62, 0.8, r) * uLavaAmt;
            glowc += uLava * crack * (1.4 + 0.6 * sin(uTime * 1.5 + r * 20.0));
            col *= 1.0 - crack * 0.6;
        }
        if (uCrystal > 0.0) {
            float facets = floor(fbm(p * 5.0 + uSeed) * 8.0) / 8.0;
            col = mix(col, uC3 * (0.6 + facets), uCrystal * 0.7);
            spec = 1.2 * uCrystal * step(0.5, fract(facets * 3.7));
        }
        // city lights on the dark side, now and then
        float night = 1.0 - smoothstep(-0.2, 0.1, dot(normalize(vN), normalize(uLight)));
        float lights = step(0.86, noise(p * 70.0 + uSeed)) * land * (1.0 - smoothstep(0.7, 0.9, pole));
        glowc += vec3(1.0, 0.75, 0.35) * lights * night * uCity * 1.6;
    }
    vec3 n = normalize(vN), L = normalize(uLight), V = normalize(vV);
    float ndl = dot(n, L);
    float lit = smoothstep(-0.12, 0.45, ndl);
    vec3 H = normalize(L + V);
    float s = pow(max(dot(n, H), 0.0), 40.0) * spec * lit;
    vec3 outc = col * (0.025 + lit * 1.05) + s + glowc;
    gl_FragColor = vec4(outc, 1.0);
}`;

const CLOUD_FRAG = /* glsl */ `
uniform vec3 uSeed; uniform float uAmt; uniform vec3 uLight; uniform vec3 uCol; uniform float uTime;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
${NOISE}
void main() {
    vec3 p = normalize(vP);
    float c = fbm(p * 3.0 + uSeed + vec3(uTime * 0.01, 0.0, 0.0)) + 0.25 * fbm(p * 12.0 + uSeed);
    float a = smoothstep(0.8 - uAmt * 0.22, 0.9 - uAmt * 0.22, c);
    float lit = smoothstep(-0.15, 0.5, dot(normalize(vN), normalize(uLight)));
    gl_FragColor = vec4(uCol * (0.03 + lit * 0.85), a * 0.9);
}`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uLight; uniform float uAmt;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
    vec3 n = normalize(vN);
    float f = pow(1.0 - abs(dot(n, normalize(vV))), 3.0);
    float lit = smoothstep(-0.4, 0.6, dot(n, normalize(uLight)));
    gl_FragColor = vec4(uCol * f * lit * uAmt * 2.2, 1.0);
}`;

const RING_VERT = /* glsl */ `
uniform float uIn; uniform float uOut; varying float vR; varying vec3 vW;
void main() { vR = (length(position.xy) - uIn) / (uOut - uIn); vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const RING_FRAG = /* glsl */ `
uniform vec3 uC0; uniform vec3 uC1; uniform float uSeed; uniform vec3 uLight; uniform vec3 uCenter; uniform float uPR;
varying float vR; varying vec3 vW;
float h(float x) { return fract(sin(x * 91.7 + uSeed) * 43758.5); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main() {
    float b = n1(vR * 38.0) * 0.6 + n1(vR * 140.0) * 0.4;
    float gap = smoothstep(0.02, 0.06, abs(vR - 0.62)) * smoothstep(0.01, 0.03, abs(vR - 0.3));
    float a = smoothstep(0.0, 0.05, vR) * smoothstep(1.0, 0.9, vR) * (0.25 + 0.75 * b) * gap;
    // the planet's shadow across the rings
    vec3 L = normalize(uLight);
    vec3 d = vW - uCenter;
    float along = dot(d, -L);
    float perp = length(d + L * along);
    float shadow = along > 0.0 ? smoothstep(uPR * 0.92, uPR * 1.02, perp) : 1.0;
    vec3 col = mix(uC0, uC1, b) * (0.15 + 0.95 * shadow);
    gl_FragColor = vec4(col, a * 0.92);
}`;

const STAR_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uTime; uniform vec3 uSeed; uniform float uSpots;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
${NOISE}
void main() {
    vec3 p = normalize(vP);
    float g = fbm(p * 7.0 + uSeed + vec3(0.0, uTime * 0.08, uTime * 0.05));
    float cells = noise(p * 40.0 + uTime * 0.2);
    float spots = smoothstep(0.66, 0.74, fbm(p * 2.3 + uSeed)) * uSpots;
    float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
    float limb = pow(mu, 0.5);
    vec3 col = uCol * (0.6 + 0.7 * g + 0.25 * cells) * (1.0 - spots * 0.75);
    col = mix(col, vec3(1.0, 0.98, 0.92), smoothstep(0.6, 1.0, mu) * 0.35);
    gl_FragColor = vec4(col * limb * 2.4, 1.0);
}`;
const FLARE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uTime; uniform vec3 uSeed;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
${NOISE}
void main() {
    vec3 p = normalize(vP);
    float mu = abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(1.0 - mu, 2.0);
    float n = fbm(p * 4.0 + uSeed + vec3(uTime * 0.12, 0.0, uTime * 0.07));
    float a = rim * smoothstep(0.35, 0.75, n) * (1.0 - smoothstep(0.85, 1.0, 1.0 - mu));
    gl_FragColor = vec4(uCol * a * 2.0, 1.0);
}`;

const PLANE_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NEBULA_FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uTime; uniform vec3 uSeed; uniform float uRing; uniform float uDust;
varying vec2 vUv;
${NOISE}
float f2(vec2 p) { return fbm(vec3(p, uSeed.z)); }
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    vec2 s = uSeed.xy;
    vec2 q = vec2(f2(p * 1.4 + s), f2(p * 1.4 + s + 5.2));
    vec2 w = vec2(f2(p * 1.6 + 3.5 * q + vec2(1.7, 9.2) + uTime * 0.004), f2(p * 1.6 + 3.5 * q + vec2(8.3, 2.8)));
    float n = f2(p * 2.0 + 3.0 * w);
    float shape;
    vec3 col;
    if (uRing > 0.5) {
        float rr = r + (n - 0.5) * 0.18;
        shape = exp(-pow((rr - 0.42) / 0.11, 2.0)) * 1.25 + exp(-pow((rr - 0.6) / 0.2, 2.0)) * 0.25 + smoothstep(0.4, 0.0, rr) * 0.22;
        col = mix(uC, uA, smoothstep(0.3, 0.55, rr));
        col = mix(col, uB, smoothstep(0.55, 0.8, rr));
    } else {
        shape = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.9);
        col = mix(uA, uB, smoothstep(0.25, 0.75, w.x));
        col = mix(col, uC, smoothstep(0.45, 0.85, n) * 0.75);
    }
    float dust = smoothstep(0.52, 0.72, f2(p * 3.2 + s * 2.0 + w)) * uDust;
    float dens = shape * (0.35 + 1.1 * n) * (1.0 - dust * 0.9);
    float edge = smoothstep(1.0, 0.85, max(abs(p.x), abs(p.y)));
    gl_FragColor = vec4(col * dens * 1.5 * edge, 1.0);
}`;

const BH_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uSeed;
varying vec2 vUv;
${NOISE}
void main() {
    vec2 p = (vUv * 2.0 - 1.0) * 1.25;
    float r = length(p);
    float shadow = smoothstep(0.3, 0.325, r);
    // the disc, seen nearly edge on
    vec2 d = vec2(p.x, p.y / 0.24);
    float rd = length(d);
    float ang = atan(d.y, d.x);
    float streak = fbm(vec3(rd * 7.0 - uTime * 0.5, ang * 2.0 + uTime * 0.9, uSeed.x));
    float disk = smoothstep(0.36, 0.45, rd) * smoothstep(1.35, 0.55, rd) * (0.35 + streak);
    float dopp = 1.0 + 0.75 * (-p.x / max(rd, 0.001));
    vec3 hot = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.93, 0.78), clamp(streak * 1.3 * smoothstep(1.2, 0.4, rd), 0.0, 1.0));
    float front = smoothstep(0.02, -0.02, p.y) + smoothstep(0.35, 0.3, r) * 0.0;
    // the far half of the disc, lensed up and over the top (and a little under)
    float arcR = length(p * vec2(1.0, 1.0));
    float arc = exp(-pow((arcR - 0.46 - streak * 0.05) / 0.07, 2.0)) * (0.35 + streak) * (p.y > 0.0 ? 1.0 : 0.35);
    float ring = exp(-pow((r - 0.335) / 0.012, 2.0)) * 1.6;
    vec3 col = hot * (arc * shadow * 1.4 + disk * dopp * (front + (1.0 - front) * shadow));
    col += vec3(1.0, 0.85, 0.6) * ring;
    col *= smoothstep(1.25, 0.7, r) * 0.9 + 0.1;
    gl_FragColor = vec4(col * 1.6, 1.0);
}`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uCol; varying vec2 vUv;
void main() { float a = pow(vUv.y, 1.5) * (0.4 + 0.6 * sin(vUv.x * 6.2831 * 3.0) * sin(vUv.x * 6.2831 * 3.0)); gl_FragColor = vec4(uCol * a * 1.4, 1.0); }`;

// ------------------------------------------------------------------ helpers

const C = (h) => new THREE.Color(h);
const lerpC = (a, b, k) => C(a).lerp(C(b), k);
const fmt = (n) => n.toLocaleString('en', { maximumFractionDigits: n < 10 ? 1 : 0 });

function temperatureColor(K) {
    // a rough black-body ramp, from red dwarfs to blue giants
    const stops = [[2400, '#ff6a2a'], [3500, '#ff9a4a'], [5000, '#ffd08a'], [5800, '#fff1d0'], [7500, '#f0f4ff'], [12000, '#b8ccff'], [30000, '#8aa8ff']];
    for (let i = 1; i < stops.length; i++) if (K <= stops[i][0]) return lerpC(stops[i - 1][1], stops[i][1], (K - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    return C(stops[stops.length - 1][1]);
}

function pickKind(r, first) {
    if (first) return KINDS.find((k) => k.id === ['ringed', 'nebula', 'verdant'][Math.floor(r() * 3)]);
    const total = KINDS.reduce((s, k) => s + k.w, 0);
    let x = r() * total;
    for (const k of KINDS) if ((x -= k.w) <= 0) return k;
    return KINDS[0];
}

// ------------------------------------------------------------------ the scope

export class Scope {
    /** @param {object} env { renderer, audio (TowerAudio), canvas } */
    constructor(env) {
        this.env = env;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000004);
        this.active = false;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.obj = null;
        this.updaters = [];
        this.drag = { x: 0, y: 0, vx: 0.05, vy: 0, down: null };
        this.yaw = 0;
        this.pitch = 0;
        this.log = store.get('starLog', {});
        this.count = 0;
        this.seed = Math.floor(Math.random() * 1e9);
        this.lightDir = new V3(-0.9, 0.3, 0.32).normalize();
        this._stars();
        this._dom();
        this._pointer();
    }

    _stars() {
        const r = rng('scope-sky');
        const n = 5000;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u);
            // a band of the galaxy across the view, denser
            const band = r() < 0.45;
            const y = band ? (r() - 0.5) * 0.25 : u;
            const ss = Math.sqrt(1 - y * y);
            const v = new V3(Math.cos(a) * (band ? ss : s), y, Math.sin(a) * (band ? ss : s)).applyAxisAngle(new V3(0, 0, 1), 0.5).multiplyScalar(300);
            pos.set([v.x, v.y, v.z], i * 3);
            const c = r() < 0.2 ? C('#ffd0a0') : r() < 0.3 ? C('#a8c0ff') : C('#ffffff');
            c.multiplyScalar(0.3 + Math.pow(r(), 3) * 1.2);
            col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.bg = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, map: glowSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
        this.scene.add(this.bg);
        // a faint wash of colour behind everything
        this.wash = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: 0x2a1a4a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.wash.scale.set(260, 260, 1);
        this.wash.position.set(-40, 20, -200);
        this.scene.add(this.wash);
    }

    _dom() {
        this.dom = { root: $('scope'), card: $('sky-card'), iris: $('scope-iris') };
        $('sky-next').addEventListener('click', () => this.next());
        $('sky-leave').addEventListener('click', () => this.onLeave?.());
        addEventListener('keydown', (e) => {
            if (!this.active || e.target.closest?.('input')) return;
            if (e.key === 'Escape') this.onLeave?.();
            else if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'r') {
                if (e.target.closest?.('button')) return;
                e.preventDefault();
                this.next();
            }
        });
    }

    _pointer() {
        const c = this.env.canvas;
        c.addEventListener('pointerdown', (e) => {
            if (!this.active) return;
            this.drag.down = { x: e.clientX, y: e.clientY };
        });
        addEventListener('pointermove', (e) => {
            if (!this.active || !this.drag.down) return;
            const dx = e.clientX - this.drag.down.x, dy = e.clientY - this.drag.down.y;
            this.drag.down = { x: e.clientX, y: e.clientY };
            this.drag.vx = dx * 0.006;
            this.drag.vy = dy * 0.006;
            this.yaw += dx * 0.006;
            this.pitch = clamp(this.pitch + dy * 0.006, -1.2, 1.2);
        });
        addEventListener('pointerup', () => (this.drag.down = null));
    }

    open() {
        this.active = true;
        this.dom.root.hidden = false;
        this.dom.iris.classList.add('closed');
        this.next(true);
    }

    close() {
        this.active = false;
        this.dom.root.hidden = true;
        this.dom.card.hidden = true;
        this.drag.down = null;
    }

    /** Turn the dial: the iris closes, a new thing swims into view, and it opens again. */
    next(immediate) {
        if (this.turning) return;
        this.turning = true;
        this.env.audio?.focus();
        this.dom.iris.classList.add('closed');
        this.dom.card.hidden = true;
        setTimeout(() => {
            this._build();
            this.dom.iris.classList.remove('closed');
            setTimeout(() => {
                this.turning = false;
                this._card();
            }, 450);
        }, immediate ? 120 : 520);
    }

    // ------------------------------------------------------------ making things

    _clear() {
        this.group.traverse((o) => {
            o.geometry?.dispose();
            if (o.material) {
                if (o.material.map && o.material.map !== glowSprite() && o.material.map !== softGlow()) o.material.map.dispose();
                o.material.dispose();
            }
        });
        this.group.clear();
        this.updaters = [];
        this.billboard = null;
    }

    _build() {
        this._clear();
        const seed = this.seed + this.count * 7919;
        const r = rng(seed);
        const kind = pickKind(r, this.count === 0 && !Object.keys(this.log).length);
        this.count++;
        const d = { kind, r, seed, stats: [], R: 1.6 };
        this.yaw = r() * TAU;
        this.pitch = (r() - 0.5) * 0.5;
        this.drag.vx = 0.05;
        this.drag.vy = 0;
        const planetish = ['verdant', 'desert', 'ice', 'ocean', 'gas', 'lava', 'ringed', 'jungle', 'crystal'];
        if (planetish.includes(kind.id)) this._planet(d);
        else if (['reddwarf', 'sun', 'bluegiant', 'binary', 'pulsar'].includes(kind.id)) this._star(d);
        else if (kind.id === 'nebula' || kind.id === 'ringneb') this._nebula(d);
        else if (kind.id === 'galaxy') this._galaxy(d);
        else this._blackhole(d);
        this.cur = d;
        // the log
        const prev = this.log[kind.id];
        d.isNew = !prev;
        this.log[kind.id] = { n: (prev?.n || 0) + 1, first: prev?.first || d.name };
        store.set('starLog', this.log);
        this.env.audio?.discover(kind.rank + (d.isNew ? 1 : 0));
    }

    _sphere(rad, frag, uniforms, opts = {}) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 96, 64), new THREE.ShaderMaterial({ uniforms, vertexShader: SPHERE_VERT, fragmentShader: frag, ...opts }));
        return m;
    }

    _planet(d) {
        const { r, kind } = d;
        const id = kind.id;
        const gas = id === 'gas' || id === 'ringed';
        const pal = {
            verdant: ['#0a2a5a', '#1a6a9a', '#4a8a3a', '#8a7a4a', '#e8e8e0'],
            desert: ['#3a2a1a', '#6a4a2a', '#d8a060', '#b86a3a', '#f0d8b0'],
            ice: ['#3a5a7a', '#7aa8c8', '#d8e8f0', '#a8c0d8', '#ffffff'],
            ocean: ['#04183a', '#0a5a8a', '#3aa86a', '#d8c890', '#f0f0e8'],
            lava: ['#1a0a08', '#2a0e0a', '#2a2020', '#3a2a28', '#4a3a38'],
            jungle: ['#0a1a3a', '#1a4a6a', '#6a2a8a', '#3a1a5a', '#d8a8ff'],
            crystal: ['#1a0a3a', '#3a1a6a', '#7ae8ff', '#d88aff', '#ffffff'],
        }[id];
        const hue = r();
        const gasPal = () => {
            const base = new THREE.Color().setHSL(hue, 0.45 + r() * 0.3, 0.55);
            return [base, base.clone().offsetHSL(0.05, -0.1, 0.18), base.clone().offsetHSL(-0.06, 0.1, -0.2), base.clone().offsetHSL(0.5, -0.2, 0.1), C(r() < 0.5 ? '#c84a2a' : '#f0e0c0')];
        };
        const cols = gas ? gasPal() : pal.map((h) => C(h).offsetHSL((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.06));
        const R = gas ? 1.6 : 1.3;
        const U = {
            uSeed: { value: new V3(r() * 50, r() * 50, r() * 50) }, uGas: { value: gas ? 1 : 0 },
            uC0: { value: cols[0] }, uC1: { value: cols[1] }, uC2: { value: cols[2] }, uC3: { value: cols[3] }, uC4: { value: cols[4] },
            uSea: { value: { verdant: 0.5, desert: 0.3, ice: 0.42, ocean: 0.6, lava: 0.35, jungle: 0.45, crystal: 0.4 }[id] ?? 0.5 },
            uIce: { value: { verdant: 0.2, desert: 0.06, ice: 0.9, ocean: 0.15, lava: 0, jungle: 0.08, crystal: 0.1 }[id] ?? 0 },
            uLava: { value: C('#ff6a1a') }, uLavaAmt: { value: id === 'lava' ? 1 : 0 },
            uCity: { value: (id === 'verdant' || id === 'jungle') && r() < 0.5 ? 1 : 0 },
            uLight: { value: this.lightDir }, uBands: { value: 10 + r() * 16 }, uStorm: { value: new V3((r() - 0.5) * 1.2, r() * TAU, 0.12 + r() * 0.14) },
            uWarp: { value: 0.15 + r() * 0.3 }, uTime: { value: 0 }, uCrystal: { value: id === 'crystal' ? 1 : 0 },
        };
        const body = this._sphere(R, PLANET_FRAG, U);
        const spin = new THREE.Group();
        spin.add(body);
        const tilt = new THREE.Group();
        tilt.rotation.z = (r() - 0.5) * 0.9;
        tilt.add(spin);
        this.group.add(tilt);
        // clouds and air
        const cloudAmt = { verdant: 0.55, desert: 0.12, ice: 0.3, ocean: 0.65, lava: 0.25, jungle: 0.6, crystal: 0.1 }[id];
        if (!gas && cloudAmt) {
            const CU = { uSeed: { value: new V3(r() * 50, r() * 50, r() * 50) }, uAmt: { value: cloudAmt }, uLight: { value: this.lightDir }, uCol: { value: id === 'lava' ? C('#5a4a48') : id === 'desert' ? C('#f0d8b0') : C('#ffffff') }, uTime: { value: 0 } };
            const clouds = this._sphere(R * 1.012, CLOUD_FRAG, CU, { transparent: true, depthWrite: false });
            tilt.add(clouds);
            this.updaters.push((dt, t) => {
                clouds.rotation.y += dt * 0.025;
                CU.uTime.value = t;
            });
        }
        const atmoCol = { verdant: '#6ab0ff', desert: '#ffb070', ice: '#a8d8ff', ocean: '#5aa8ff', lava: '#ff6a2a', jungle: '#c88aff', crystal: '#9af0ff', gas: '#' + cols[1].getHexString(), ringed: '#' + cols[1].getHexString() }[id];
        const atmo = this._sphere(R * 1.07, ATMO_FRAG, { uCol: { value: C(atmoCol) }, uLight: { value: this.lightDir }, uAmt: { value: gas ? 0.6 : 1 } }, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        tilt.add(atmo);
        let ringR = 0;
        if (id === 'ringed' || (gas && r() < 0.25)) {
            ringR = R * (2.0 + r() * 0.5);
            const RU = { uIn: { value: R * 1.25 }, uOut: { value: ringR }, uC0: { value: cols[0].clone().lerp(C('#ffffff'), 0.3) }, uC1: { value: cols[3].clone().lerp(C('#e8d8c0'), 0.5) }, uSeed: { value: r() * 100 }, uLight: { value: this.lightDir }, uCenter: { value: new V3() }, uPR: { value: R } };
            const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.25, ringR, 160, 1), new THREE.ShaderMaterial({ uniforms: RU, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
            ring.rotation.x = -Math.PI / 2;
            tilt.add(ring);
            this.updaters.push(() => ring.getWorldPosition(RU.uCenter.value));
        }
        // moons
        const nm = gas ? 1 + Math.floor(r() * 3) : Math.floor(r() * 3);
        for (let i = 0; i < nm; i++) {
            const mr = 0.09 + r() * 0.16;
            const MU = { ...U, uSeed: { value: new V3(r() * 90, r() * 90, r() * 90) }, uGas: { value: 0 }, uSea: { value: -1 }, uIce: { value: r() < 0.3 ? 0.4 : 0 }, uLavaAmt: { value: 0 }, uCity: { value: 0 }, uCrystal: { value: 0 } };
            const g = C('#8a8478').offsetHSL(r() * 0.1, 0, (r() - 0.5) * 0.2);
            MU.uC2 = { value: g };
            MU.uC3 = { value: g.clone().offsetHSL(0, 0, 0.15) };
            MU.uC4 = { value: g.clone().offsetHSL(0, 0, 0.3) };
            const moon = this._sphere(mr, PLANET_FRAG, MU);
            const orbit = new THREE.Group();
            orbit.rotation.set((r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.3);
            moon.position.x = Math.max(ringR, R) * (1.25 + i * 0.35 + r() * 0.2);
            orbit.add(moon);
            this.group.add(orbit);
            const w = 0.08 + r() * 0.12;
            this.updaters.push((dt) => (orbit.rotation.y += dt * w));
        }
        const day = 0.03 + r() * 0.08;
        this.updaters.push((dt, t) => {
            spin.rotation.y += dt * day;
            U.uTime.value = t;
        });
        d.R = Math.max(R * 1.1, ringR * 0.95);
        // names and numbers
        d.name = placeName(r);
        d.catalog = `Starwright Catalogue ${1000 + Math.floor(r() * 8999)} ${'bcdefg'[Math.floor(r() * 6)]}`;
        const dist = Math.round(4 + Math.pow(r(), 2) * 3000);
        const radius = gas ? 4 + r() * 10 : 0.3 + r() * 2.2;
        const temp = { verdant: 15, desert: 48, ice: -120, ocean: 22, lava: 1100, jungle: 31, crystal: -40, gas: -140, ringed: -170 }[id] + Math.round((r() - 0.5) * 30);
        d.stats = [`${fmt(dist)} light years`, `${radius.toFixed(1)} × Earth`, `${temp} °C`, `day ${Math.round(6 + r() * 90)} h`, nm ? `${nm} moon${nm > 1 ? 's' : ''}` : 'no moons'];
        if (ringR) d.stats.push('rings');
        if (U.uCity.value) d.stats.push('lights on the night side');
        d.desc = FACTS[id][Math.floor(r() * FACTS[id].length)] + ' ' + (U.uCity.value ? 'There are lights on its night side. Somebody is home.' : WHIMSY[Math.floor(r() * WHIMSY.length)]);
        d.accent = '#' + (gas ? cols[0] : C(atmoCol)).getHexString();
    }

    _starMesh(R, K, r, spots = 0.5) {
        const col = temperatureColor(K);
        const g = new THREE.Group();
        const U = { uCol: { value: col }, uTime: { value: 0 }, uSeed: { value: new V3(r() * 50, r() * 50, r() * 50) }, uSpots: { value: spots } };
        const body = this._sphere(R, STAR_FRAG, U);
        g.add(body);
        const FU = { uCol: { value: col.clone().lerp(C('#ffffff'), 0.2) }, uTime: { value: 0 }, uSeed: { value: new V3(r() * 50, r() * 50, r() * 50) } };
        const flare = this._sphere(R * 1.35, FLARE_FRAG, FU, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        g.add(flare);
        const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: col, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
        corona.scale.setScalar(R * 6);
        g.add(corona);
        const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: col.clone().lerp(C('#ffffff'), 0.5), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        core.scale.setScalar(R * 3);
        g.add(core);
        this.updaters.push((dt, t) => {
            U.uTime.value = t;
            FU.uTime.value = t;
            body.rotation.y += dt * 0.04;
            corona.material.opacity = 0.75 + Math.sin(t * 1.3) * 0.08;
        });
        return { g, col };
    }

    _star(d) {
        const { r, kind } = d;
        const id = kind.id;
        let K, R;
        if (id === 'reddwarf') (K = 2600 + r() * 900), (R = 0.9);
        else if (id === 'sun') (K = 5200 + r() * 1000), (R = 1.3);
        else if (id === 'bluegiant') (K = 14000 + r() * 16000), (R = 1.7);
        else if (id === 'pulsar') (K = 30000), (R = 0.22);
        else (K = 4000), (R = 0.9);
        if (id === 'binary') {
            const K1 = 4000 + r() * 6000, K2 = 2800 + r() * 3000;
            const a = this._starMesh(0.95, K1, r, 0.3), b = this._starMesh(0.55, K2, r, 0.6);
            const pair = new THREE.Group();
            pair.add(a.g, b.g);
            a.g.position.x = -1.0;
            b.g.position.x = 1.75;
            pair.rotation.x = 0.35;
            this.group.add(pair);
            this.updaters.push((dt) => (pair.rotation.y += dt * 0.25));
            d.R = 2.9;
            d.name = `${placeName(r)} and ${placeName(r)}`;
            d.catalog = `Double star HSW ${100 + Math.floor(r() * 899)} AB`;
            d.stats = [`${fmt(Math.round(20 + r() * 900))} light years`, `${Math.round(K1).toLocaleString('en')} K and ${Math.round(K2).toLocaleString('en')} K`, `orbit ${Math.round(3 + r() * 60)} days`];
            d.accent = '#' + a.col.getHexString();
        } else if (id === 'pulsar') {
            const s = this._starMesh(R, K, r, 0);
            this.group.add(s.g);
            const axis = new THREE.Group();
            axis.rotation.z = 0.5;
            this.group.add(axis);
            const spinner = new THREE.Group();
            axis.add(spinner);
            const BU = { uCol: { value: C('#9ad8ff') } };
            for (const sgn of [1, -1]) {
                const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 6, 32, 1, true).translate(0, -3, 0), new THREE.ShaderMaterial({ uniforms: BU, vertexShader: PLANE_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
                cone.rotation.z = sgn > 0 ? Math.PI : 0;
                const tiltG = new THREE.Group();
                tiltG.rotation.x = 0.55;
                tiltG.add(cone);
                spinner.add(tiltG);
            }
            // a ghostly remnant around it
            const neb = this._nebulaPlane(r, ['#3a2aff', '#ff3a8a', '#3affd8'], 9, 0, 0.8);
            neb.material.uniforms.uA.value.multiplyScalar(0.35);
            neb.material.uniforms.uB.value.multiplyScalar(0.35);
            neb.material.uniforms.uC.value.multiplyScalar(0.35);
            neb.position.z = -2;
            this.group.add(neb);
            const rate = 4 + r() * 6;
            this.updaters.push((dt) => (spinner.rotation.y += dt * rate));
            d.R = 2.6;
            d.name = `The ${placeName(r)} Lighthouse`;
            d.catalog = `Pulsar PSW ${1000 + Math.floor(r() * 8999)}+${10 + Math.floor(r() * 89)}`;
            d.stats = [`${fmt(Math.round(800 + r() * 9000))} light years`, `${Math.round(rate * 37)} turns a second`, '20 km across', '1.4 × Sun’s mass'];
            d.accent = '#9ad8ff';
        } else {
            const s = this._starMesh(R, K, r, id === 'reddwarf' ? 0.8 : 0.4);
            this.group.add(s.g);
            d.R = R * 1.45;
            d.name = placeName(r);
            d.catalog = `HSW ${1000 + Math.floor(r() * 89999)}`;
            const rs = id === 'reddwarf' ? 0.1 + r() * 0.4 : id === 'sun' ? 0.8 + r() * 0.5 : 6 + r() * 14;
            d.stats = [`${fmt(Math.round(4 + Math.pow(r(), 2) * 2000))} light years`, `${rs.toFixed(1)} × Sun`, `${Math.round(K).toLocaleString('en')} K`, `${(id === 'bluegiant' ? 0.01 + r() * 0.05 : 1 + r() * 9).toFixed(id === 'bluegiant' ? 2 : 1)} billion years old`];
            d.accent = '#' + s.col.getHexString();
        }
        d.desc = FACTS[id][Math.floor(r() * FACTS[id].length)] + ' ' + WHIMSY[Math.floor(r() * WHIMSY.length)];
    }

    _nebulaPlane(r, colors, size, ring, dust) {
        const U = { uA: { value: C(colors[0]) }, uB: { value: C(colors[1]) }, uC: { value: C(colors[2]) }, uTime: { value: 0 }, uSeed: { value: new V3(r() * 40, r() * 40, r() * 40) }, uRing: { value: ring }, uDust: { value: dust } };
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({ uniforms: U, vertexShader: PLANE_VERT, fragmentShader: NEBULA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.updaters.push((dt, t) => (U.uTime.value = t));
        return m;
    }

    _nebula(d) {
        const { r, kind } = d;
        const ring = kind.id === 'ringneb';
        const palettes = ring
            ? [['#ff4a3a', '#ff8a5a', '#3affd8'], ['#ff3a8a', '#8a3aff', '#7affea'], ['#ffb03a', '#ff3a3a', '#5ad8ff']]
            : [['#ff3a8a', '#3a8aff', '#ffd23a'], ['#ff5a3a', '#8a2aff', '#5affc8'], ['#2affb0', '#3a5aff', '#ff6ad8'], ['#ff8a2a', '#c82a5a', '#7ad8ff']];
        const pal = palettes[Math.floor(r() * palettes.length)];
        const size = ring ? 6.5 : 9;
        const plane = this._nebulaPlane(r, pal, size, ring ? 1 : 0, ring ? 0.3 : 0.9);
        const holder = new THREE.Group();
        holder.add(plane);
        // a second, fainter layer for depth
        if (!ring) {
            const p2 = this._nebulaPlane(r, [pal[1], pal[2], pal[0]], size * 1.3, 0, 0.5);
            p2.position.z = -1.5;
            p2.material.uniforms.uA.value.multiplyScalar(0.4);
            p2.material.uniforms.uB.value.multiplyScalar(0.4);
            p2.material.uniforms.uC.value.multiplyScalar(0.4);
            holder.add(p2);
        }
        // stars inside it
        const n = ring ? 60 : 220;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const a = r() * TAU, rr = Math.sqrt(r()) * size * 0.4;
            pos.set([Math.cos(a) * rr, Math.sin(a) * rr, (r() - 0.5) * 1.5], i * 3);
            const c = r() < 0.5 ? C('#ffffff') : C(pal[2]).lerp(C('#ffffff'), 0.5);
            c.multiplyScalar(0.4 + Math.pow(r(), 4) * 2);
            col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        holder.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, map: glowSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
        if (ring) {
            const dwarf = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xe8f4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            dwarf.scale.setScalar(0.5);
            holder.add(dwarf);
        } else {
            for (let k = 0; k < 3; k++) {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: C(pal[2]).lerp(C('#ffffff'), 0.6), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
                s.scale.setScalar(0.5 + r() * 0.6);
                s.position.set((r() - 0.5) * 2.5, (r() - 0.5) * 2.5, 0.3);
                holder.add(s);
            }
        }
        this.group.add(holder);
        this.billboard = holder;
        d.R = size * 0.42;
        d.name = `The ${NEB_ADJ[Math.floor(r() * NEB_ADJ.length)]} ${NEB_NOUN[Math.floor(r() * NEB_NOUN.length)]} Nebula`;
        d.catalog = `${ring ? 'Planetary nebula' : 'Nebula'} NSW ${1 + Math.floor(r() * 999)}`;
        d.stats = [`${fmt(Math.round(1000 + r() * 7000))} light years`, `${Math.round(ring ? 1 + r() * 3 : 20 + r() * 120)} light years wide`, ring ? 'one dying star' : `${Math.round(200 + r() * 3000)} newborn stars`];
        d.desc = FACTS[kind.id][Math.floor(r() * FACTS[kind.id].length)] + ' ' + WHIMSY[Math.floor(r() * WHIMSY.length)];
        d.accent = pal[0];
    }

    _galaxy(d) {
        const { r } = d;
        const n = 26000, arms = 2 + Math.floor(r() * 3), twist = 2.6 + r() * 1.6;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const armC = C(['#9ab8ff', '#c8a8ff', '#8ad8ff'][Math.floor(r() * 3)]);
        for (let i = 0; i < n; i++) {
            const rr = Math.pow(r(), 1.6) * 3.2;
            const arm = Math.floor(r() * arms);
            const a = (arm / arms) * TAU + rr * twist + (r() - 0.5) * (0.5 + 0.4 / (rr + 0.3));
            const spread = (r() - 0.5) * 0.25 * (1 + rr * 0.2);
            const y = (r() - 0.5) * 0.12 * Math.exp(-rr * 0.6) * 3;
            pos.set([Math.cos(a) * rr + spread, y, Math.sin(a) * rr + spread], i * 3);
            const k = Math.min(1, rr / 1.4);
            const c = C('#ffe0a8').lerp(armC, k);
            if (r() < 0.015 && rr > 0.8) c.set('#ff6aa8');
            c.multiplyScalar(0.35 + r() * 0.6 + (1 - k) * 0.6);
            col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, map: glowSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        const disc = new THREE.Group();
        disc.add(pts);
        const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: 0xffd8a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
        core.scale.setScalar(2.6);
        disc.add(core);
        disc.rotation.x = 0.9 + r() * 0.4;
        disc.rotation.z = (r() - 0.5) * 0.8;
        this.group.add(disc);
        this.updaters.push((dt) => (pts.rotation.y += dt * 0.03));
        d.R = 3.0;
        d.name = `The ${placeName(r)} Wheel`;
        d.catalog = `Galaxy GSW ${100 + Math.floor(r() * 899)}`;
        d.stats = [`${Math.round(8 + r() * 90)} million light years`, `${Math.round(80 + r() * 400)} billion stars`, `${arms} arms`];
        d.desc = FACTS.galaxy[Math.floor(r() * 3)] + ' ' + WHIMSY[Math.floor(r() * WHIMSY.length)];
        d.accent = '#' + armC.getHexString();
    }

    _blackhole(d) {
        const { r } = d;
        const U = { uTime: { value: 0 }, uSeed: { value: new V3(r() * 30, 0, 0) } };
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.ShaderMaterial({ uniforms: U, vertexShader: PLANE_VERT, fragmentShader: BH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        const holder = new THREE.Group();
        holder.add(plane);
        // the hole itself blots out the stars behind it
        const black = new THREE.Mesh(new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        black.position.z = -0.05;
        holder.add(black);
        holder.rotation.z = (r() - 0.5) * 0.5;
        this.group.add(holder);
        this.billboard = holder;
        this.updaters.push((dt, t) => (U.uTime.value = t));
        d.R = 2.6;
        d.name = BH_NAME[Math.floor(r() * BH_NAME.length)];
        d.catalog = `Black hole BSW ${1 + Math.floor(r() * 99)}`;
        d.stats = [`${fmt(Math.round(1000 + r() * 30000))} light years`, `${Math.round(5 + r() * 60)} × Sun’s mass`, 'nothing comes back'];
        d.desc = FACTS.blackhole[Math.floor(r() * 3)] + ' Even the telescope seems to lean towards it, very slightly.';
        d.accent = '#ffb050';
    }

    // ------------------------------------------------------------ the card

    _card() {
        const d = this.cur;
        if (!d) return;
        const k = d.kind;
        const card = this.dom.card;
        card.style.setProperty('--accent', d.accent);
        $('sky-kicker').textContent = d.isNew ? `New to your star log · ${k.label}` : `Through the telescope · ${k.label}`;
        $('sky-name').textContent = d.name;
        $('sky-cat').textContent = d.catalog;
        $('sky-stats').innerHTML = [`<span class="fc-rarity r-${RANKS[k.rank].toLowerCase()}">${RANKS[k.rank]}</span>`, ...d.stats.map((s) => `<span>${esc(s)}</span>`)].join('');
        $('sky-desc').textContent = d.desc;
        const kinds = Object.keys(this.log).length;
        const n = this.log[k.id].n;
        $('sky-log').textContent = `${n === 1 ? `Your first ${k.label.toLowerCase()}` : `${k.label} number ${n}`} · ${kinds} of ${KINDS.length} kinds charted`;
        card.hidden = false;
    }

    // ------------------------------------------------------------ per frame

    update(dt, t, camera) {
        if (!this.active) return;
        if (!this.drag.down) {
            this.yaw += this.drag.vx * dt * 2;
            this.drag.vx = damp(this.drag.vx, 0.05, 1.2, dt);
            this.pitch = damp(this.pitch, 0, 0.4, dt);
        }
        if (camera.fov !== 40) {
            camera.fov = 40;
            camera.updateProjectionMatrix();
        }
        const d = this.cur;
        // frame the thing in the lens: how far away it must be to fill about two thirds of it
        const lens = this.dom.iris.getBoundingClientRect();
        const lensR = lens.width / 2 || innerHeight * 0.4;
        const fov = THREE.MathUtils.degToRad(camera.fov);
        const half = Math.atan((lensR / (innerHeight / 2)) * Math.tan(fov / 2));
        const dist = (d?.R ?? 1.6) / Math.tan(half * 0.66);
        const cy = (lens.top + lens.height / 2) / innerHeight, cx = (lens.left + lens.width / 2) / innerWidth;
        const offY = (0.5 - cy) * 2 * dist * Math.tan(fov / 2);
        const offX = (cx - 0.5) * 2 * dist * Math.tan(fov / 2) * camera.aspect;
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        this.group.position.set(offX, offY, -dist);
        if (this.billboard) {
            this.billboard.rotation.y = Math.sin(this.yaw) * 0.25;
            this.billboard.rotation.x = this.pitch * 0.3;
            this.group.rotation.set(0, 0, 0);
        } else this.group.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        this.bg.rotation.y = this.yaw * 0.05;
        for (const u of this.updaters) u(dt, t);
    }
}
