// A planet made up on the spot for every trip through the Silver Comet's
// transporter, in the spirit of the worlds in the Great Telescope: verdant,
// desert, ice, ocean, lava, violet jungle, crystal or a bare airless moon, each
// with its colours shifted (and now and then turned inside out: blue grass,
// red trees), its own sky, suns, stars and neighbouring worlds overhead, its
// own landscape, plants and animals, weather, gravity and air. You arrive on a
// recall beacon in a valley ringed by hills, and can walk out as far as the
// beacon's lock reaches, for as long as your suit's air lasts.
//
// Everything comes from the seed, so a world can be visited again exactly.
// Its own scene, drawn by the garden's composer, walked with the garden's controls.

import * as THREE from 'three';
import { NavGrid } from './nav.js';
import { buildSky } from './planet-sky.js';
import { FLORA, plantKind, makeSpecies, makeCreature, stepCreature, buildPilot } from './planet-life.js';
import { placeName } from './rooms-archive.js';
import { glowSprite } from './textures.js';
import { rng, hashString, fbm2, ridged2, clamp, lerp, smoothstep, TAU } from './util.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);
export const WALK_R = 48;         // how far the beacon's lock reaches
const PAD_R = 5;
const INNER = 68, INNER_STEP = 0.85, OUTER = 430, OUTER_STEP = 7;

/** The kinds of world. Colours are a starting point: every visit shifts them. */
export const BIOMES = {
    verdant: {
        label: 'Verdant World', accent: '#7ad86a', w: 10,
        ground: ['#4c7a2a', '#87a03c'], high: '#6a6a48', rock: '#8a8478', shore: '#cdb88d', peak: '#eef2f6',
        zenith: '#2f6cd0', horizon: '#a8d4f2', liquid: { type: 'water', col: '#2a6a9a', q: 0.12 },
        flora: { puff: 1, umbrella: 0.5, tuft: 6, fern: 2, bloom: 2, rock: 1, boulder: 0.3 }, leaf: '#3f8a32', stem: '#5a4030', glow: '#ffe07a',
        plans: ['strider', 'hopper', 'grazer', 'flyer', 'crawler'], weather: 'pollen', temp: [6, 28], amp: 4, ridge: 2.5, rimH: 26, fog: 0.006, o2: 190, g: [0.8, 1.2],
    },
    desert: {
        label: 'Desert World', accent: '#ffb070', w: 9,
        ground: ['#d8a060', '#c8884a'], high: '#a86a3a', rock: '#9a5a32', shore: '#e8c890', peak: '#f0d8b0',
        zenith: '#3a7ab8', horizon: '#f0d0a8', liquid: null, dunes: true,
        flora: { cactus: 1.2, deadtree: 0.4, rock: 1.5, spire: 0.35, tuft: 1.2 }, leaf: '#5a8a4a', stem: '#6a5038', glow: '#ff7ad0',
        plans: ['strider', 'hopper', 'crawler', 'flyer'], weather: 'dust', temp: [34, 70], amp: 3, ridge: 4, rimH: 30, fog: 0.007, o2: 150, g: [0.7, 1.3],
    },
    ice: {
        label: 'Ice World', accent: '#a8d8ff', w: 8,
        ground: ['#e8f0f8', '#c8d8e8'], high: '#a8b8c8', rock: '#6a7a8a', shore: '#d8e8f0', peak: '#ffffff',
        zenith: '#3a5a9a', horizon: '#c8dcf0', liquid: { type: 'ice', col: '#9ad0ff', q: 0.16 },
        flora: { conifer: 1.2, spire: 0.4, crystal: 0.5, rock: 1, tuft: 0.6 }, leaf: '#2a5a4a', stem: '#4a3a30', glow: '#7ae8ff', rockCol: '#a8c8e8',
        plans: ['strider', 'grazer', 'hopper', 'crawler', 'flyer'], weather: 'snow', temp: [-90, -12], amp: 4.5, ridge: 3, rimH: 34, fog: 0.008, o2: 160, g: [0.8, 1.3], aurora: 0.7,
    },
    ocean: {
        label: 'Ocean World', accent: '#5ab8ff', w: 8,
        ground: ['#e0cc94', '#c8b07a'], high: '#6a8a4a', rock: '#7a7468', shore: '#f0e0b0', peak: '#d8d8c8',
        zenith: '#1a7ad8', horizon: '#b0e0f8', liquid: { type: 'water', col: '#1a8ab0', q: 0.42 },
        flora: { palm: 1.4, coral: 1.2, tuft: 3, rock: 0.8, bloom: 1 }, leaf: '#4aa04a', stem: '#7a5a3a', glow: '#ff9a5a',
        plans: ['hopper', 'crawler', 'flyer', 'floater', 'strider'], weather: 'none', temp: [18, 34], amp: 3.5, ridge: 1.5, rimH: 22, fog: 0.005, o2: 200, g: [0.8, 1.1],
    },
    lava: {
        label: 'Lava World', accent: '#ff6a2a', w: 6,
        ground: ['#3a302c', '#4a3c36'], high: '#5a4a42', rock: '#1a1614', shore: '#4a2a1a', peak: '#6a5a50',
        zenith: '#3a1210', horizon: '#c8582a', liquid: { type: 'lava', col: '#ff5a10', q: 0.28 },
        flora: { spire: 1, vent: 0.5, deadtree: 0.8, rock: 1.6, crystal: 0.25 }, leaf: '#3a2a20', stem: '#1a1412', glow: '#ff7a2a', rockCol: '#2a2220',
        plans: ['crawler', 'strider', 'floater', 'hopper'], weather: 'ash', temp: [180, 640], amp: 4, ridge: 5, rimH: 32, fog: 0.012, o2: 110, g: [0.9, 1.5],
    },
    jungle: {
        label: 'Violet Jungle World', accent: '#c88aff', w: 7,
        ground: ['#3a2a5a', '#4a3a6a'], high: '#5a3a6a', rock: '#4a4258', shore: '#6a5a7a', peak: '#c8b8e8',
        zenith: '#5a2a8a', horizon: '#e8a8d8', liquid: { type: 'water', col: '#6a3aa8', q: 0.1 },
        flora: { shroom: 1.2, tendril: 1.4, fern: 3, bloom: 3, umbrella: 0.4, rock: 0.5 }, leaf: '#8a3ac8', stem: '#3a2a4a', glow: '#7affd8',
        plans: ['floater', 'strider', 'hopper', 'crawler', 'flyer', 'grazer'], weather: 'spores', temp: [22, 38], amp: 3.5, ridge: 2, rimH: 24, fog: 0.011, o2: 170, g: [0.7, 1.1],
    },
    crystal: {
        label: 'Crystal World', accent: '#9af0ff', w: 5,
        ground: ['#b8b0c8', '#9a90b0'], high: '#7a7090', rock: '#5a5470', shore: '#d8d0e8', peak: '#f0f0ff',
        zenith: '#1a2a5a', horizon: '#8ad0d8', liquid: { type: 'water', col: '#3ad0d0', q: 0.08 },
        flora: { crystal: 2.4, spire: 0.6, rock: 0.8, bloom: 1.2 }, leaf: '#6a8aa8', stem: '#4a4a5a', glow: '#b88aff',
        plans: ['floater', 'strider', 'crawler', 'hopper'], weather: 'sparkle', temp: [-60, 5], amp: 4, ridge: 4, rimH: 30, fog: 0.005, o2: 150, g: [0.6, 1.0],
    },
    moon: {
        label: 'Airless Moon', accent: '#d8d8e0', w: 5,
        ground: ['#8a8a8e', '#a0a0a4'], high: '#6a6a70', rock: '#5a5a60', shore: '#b0b0b4', peak: '#c8c8cc',
        zenith: '#000000', horizon: '#05050a', liquid: null, craters: true,
        flora: { rock: 2.4, boulder: 0.5, crystal: 0.15 }, leaf: '#4a4a4a', stem: '#3a3a3a', glow: '#8ae0ff',
        plans: ['crawler', 'floater'], weather: 'none', temp: [-170, 120], amp: 2.5, ridge: 2, rimH: 22, fog: 0.0012, o2: 120, g: [0.16, 0.4], airless: true,
    },
};
export const BIOME_KEYS = Object.keys(BIOMES);

const WEATHER = {
    pollen: { n: 260, col: '#fff2a0', size: 0.09, fall: -0.1, drift: 0.4, glow: 0.6 },
    dust: { n: 520, col: '#e8c090', size: 0.12, fall: 0.05, drift: 3.2, glow: 0.25 },
    snow: { n: 700, col: '#ffffff', size: 0.13, fall: 1.1, drift: 0.6, glow: 0.4 },
    ash: { n: 600, col: '#5a4a44', size: 0.11, fall: 0.6, drift: 0.8, glow: 0.2, embers: true },
    spores: { n: 380, col: '#7affd8', size: 0.1, fall: -0.25, drift: 0.3, glow: 1 },
    sparkle: { n: 300, col: '#d8c8ff', size: 0.08, fall: 0.05, drift: 0.2, glow: 1 },
};

const LIQUID_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const LIQUID_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uSky; uniform float uTime; uniform float uLava; uniform float uIce; uniform vec3 uFogCol; uniform float uFog;
varying vec3 vW;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
    vec2 p = vW.xz;
    float n = n2(p * 0.35 + uTime * 0.12) * 0.6 + n2(p * 1.1 - uTime * 0.2) * 0.4;
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
    vec3 col;
    float a = 0.86;
    if (uLava > 0.5) {
        float crust = smoothstep(0.45, 0.62, n2(p * 0.5 + uTime * 0.05) * 0.7 + n2(p * 2.0) * 0.3);
        col = mix(uCol * (1.6 + 0.6 * sin(uTime * 1.3 + n * 6.0)), vec3(0.08, 0.05, 0.04), crust * 0.85);
        a = 1.0;
    } else if (uIce > 0.5) {
        col = mix(uCol, uSky, 0.35 + fres * 0.4) + (n - 0.5) * 0.08;
        col += smoothstep(0.92, 1.0, n2(p * 3.0)) * 0.3;
        a = 1.0;
    } else {
        col = mix(uCol, uSky, fres * 0.8 + n * 0.15);
        col += pow(n, 6.0) * 0.4;
    }
    float d = length(cameraPosition - vW);
    float fogF = 1.0 - exp(-uFog * uFog * d * d);
    gl_FragColor = vec4(mix(col, uFogCol, fogF), a);
}`;

function shift(hex, dh, ds = 0, dl = 0) {
    return C(hex).offsetHSL(dh, ds, dl);
}

/** Pick what kind of world a seed makes. `avoid` (the last one) is passed over. */
export function biomeFor(seed, avoid) {
    const r = rng((seed ^ 0x9e3779b9) >>> 0);
    const keys = BIOME_KEYS.filter((k) => k !== avoid);
    const total = keys.reduce((s, k) => s + BIOMES[k].w, 0);
    let x = r() * total;
    for (const k of keys) if ((x -= BIOMES[k].w) <= 0) return k;
    return keys[0];
}

export class Planet {
    /** @param {object} env { quality } */
    constructor(env) {
        this.env = env;
        this.tier = env.quality?.tier || 'high';
        this.scene = null;
        this.built = false;
    }

    // ------------------------------------------------------------ making a world

    /**
     * Make the world for `seed`. `opts.biome` names its kind (else the seed picks),
     * `opts.pilot` puts the pilot there. Returns what to say about it.
     */
    build(seed, opts = {}) {
        this.dispose();
        this.seed = seed >>> 0;
        const S = (name) => rng((this.seed ^ hashString(name)) >>> 0);
        const r = S('world');
        const key = opts.biome || biomeFor(this.seed);
        const B = BIOMES[key];
        this.key = key;
        this.B = B;
        const scene = new THREE.Scene();
        this.scene = scene;
        this.updaters = [];
        this.cols = [];
        this.hits = [];
        this.clock = 0;

        // ---- colours: the biome's, shifted; one world in four turned strange
        const strange = r() < 0.25;
        const dh = strange ? r.range(0.25, 0.75) : r.range(-0.07, 0.07);
        const pal = {
            g0: shift(B.ground[0], dh, 0, r.range(-0.06, 0.06)), g1: shift(B.ground[1], dh, 0, r.range(-0.06, 0.06)),
            high: shift(B.high, dh * 0.5), rock: shift(B.rock, r.range(-0.04, 0.04)), shore: shift(B.shore, dh * 0.4), peak: C(B.peak),
            leaf: shift(B.leaf, strange ? r.range(0.2, 0.8) : r.range(-0.08, 0.08), r.range(-0.1, 0.1), r.range(-0.05, 0.05)),
            stem: shift(B.stem, r.range(-0.05, 0.05)), glow: shift(B.glow, r.range(-0.15, 0.15)),
        };
        this.pal = pal;

        // ---- the time of day and the suns
        const tod = r();
        const phase = B.airless ? (tod < 0.7 ? 'day' : 'night') : tod < 0.6 ? 'day' : tod < 0.82 ? 'golden' : 'night';
        const elev = phase === 'day' ? r.range(0.45, 1.15) : phase === 'golden' ? r.range(0.08, 0.28) : r.range(-0.3, -0.12);
        const az = r() * TAU;
        const sunDir = new V3(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)).normalize();
        const K = r.range(2800, 11000);
        const sunCol = K < 4000 ? C('#ffb07a') : K < 5500 ? C('#ffe0b0') : K < 7500 ? C('#fff6e8') : C('#d0dcff');
        const binary = r() < 0.22;
        let sun2 = null;
        if (binary) {
            const a2 = az + r.range(0.35, 0.8) * r.sign(), e2 = elev + r.range(-0.15, 0.2);
            sun2 = { dir: new V3(Math.cos(e2) * Math.sin(a2), Math.sin(e2), Math.cos(e2) * Math.cos(a2)).normalize(), col: r() < 0.5 ? '#ff8a5a' : '#9ab8ff', size: r.range(0.015, 0.03) };
        }
        const night = phase === 'night' ? 1 : 0, golden = phase === 'golden' ? 1 : 0;

        // ---- the sky's colours
        // (the sky keeps its kind's colours, give or take: a strange world is strange underfoot)
        const skyDh = strange ? r.range(-0.08, 0.08) : dh * 0.6;
        let zen = shift(B.zenith, skyDh), hor = shift(B.horizon, skyDh);
        if (golden) {
            hor = hor.clone().lerp(C('#ff9a5a'), 0.55);
            zen = zen.clone().lerp(C('#3a3a7a'), 0.4);
        }
        if (night) {
            zen = zen.clone().lerp(C('#03040a'), 0.88);
            hor = hor.clone().lerp(C('#0a0c1a'), 0.8);
        }
        const haze = B.airless ? 0 : 1;
        const fogCol = hor.clone().lerp(zen, 0.25);
        this.fogCol = fogCol;

        // ---- neighbours in the sky
        const bodies = [];
        const awayFromSun = (minA) => {
            for (let k = 0; k < 30; k++) {
                const e = r.range(0.15, night ? 0.9 : 0.75), a = r() * TAU;
                const d = new V3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
                if (d.angleTo(sunDir) > minA && bodies.every((b) => b.dir.angleTo(d) > (b.size + 0.2))) return d;
            }
            return new V3(-sunDir.x, 0.5, -sunDir.z).normalize();
        };
        if (B.airless || r() < 0.65) {
            const gh = r();
            const base = new THREE.Color().setHSL(gh, r.range(0.35, 0.65), 0.55);
            const homeLike = B.airless && r() < 0.6;
            bodies.push({
                dir: awayFromSun(0.7), size: r.range(0.32, 0.75), gas: !homeLike, rings: !homeLike && r() < 0.55 ? r.range(1.9, 2.6) : 0, bands: r.range(10, 24), tilt: r.range(-0.5, 0.5),
                cols: homeLike ? ['#0a3a7a', '#1a6aaa', '#4a8a3a', '#e8e8e0'] : [base, base.clone().offsetHSL(0.05, -0.1, 0.18), base.clone().offsetHSL(-0.06, 0.1, -0.2), base.clone().offsetHSL(0.5, -0.2, 0.1)],
                sea: homeLike ? 0.5 : -1, ice: homeLike ? 0.2 : 0, hazeK: 0.9,
            });
        }
        if (r() < 0.5) {
            const t = r.pick(['ice', 'desert', 'ocean', 'lava']);
            const c = { ice: ['#3a5a7a', '#7aa8c8', '#d8e8f0', '#ffffff'], desert: ['#3a2a1a', '#6a4a2a', '#d8a060', '#f0d8b0'], ocean: ['#04183a', '#0a5a8a', '#3aa86a', '#d8c890'], lava: ['#1a0a08', '#2a0e0a', '#3a2a28', '#ff6a2a'] }[t];
            bodies.push({ dir: awayFromSun(0.5), size: r.range(0.1, 0.22), gas: false, cols: c, sea: t === 'ocean' ? 0.55 : 0.35, ice: t === 'ice' ? 0.8 : 0.1 });
        }
        for (let i = 0, n = r.int(0, 3); i < n; i++) {
            const g = C('#8a8478').offsetHSL(r() * 0.1, 0, r.range(-0.1, 0.1));
            bodies.push({ dir: awayFromSun(0.3), size: r.range(0.025, 0.07), gas: false, cols: [g, g, g, g.clone().offsetHSL(0, 0, 0.18)], sea: -1, craters: 1 });
        }
        this.bodies = bodies;
        const neb = r() < (night || B.airless ? 0.7 : 0.25) ? { amt: r.range(0.3, 0.7), a: new THREE.Color().setHSL(r(), 0.8, 0.45), b: new THREE.Color().setHSL(r(), 0.8, 0.5) } : null;
        const aurora = (B.aurora && r() < B.aurora) || (night && r() < 0.3) ? { amt: r.range(0.5, 1), a: new THREE.Color().setHSL(r.range(0.3, 0.5), 0.9, 0.5), b: new THREE.Color().setHSL(r.range(0.7, 0.9), 0.9, 0.5) } : null;
        const stars = B.airless ? 1 : night ? 1 : golden ? 0.3 : 0;
        this.sky = buildSky({
            r: S('sky'), zenith: zen, horizon: hor, ground: fogCol.clone().multiplyScalar(0.6), haze,
            sun: { dir: sunDir, col: sunCol.clone().multiplyScalar(night ? 0 : 1), size: r.range(0.02, 0.05) }, sun2: night ? null : sun2,
            stars, neb, aurora: aurora && (night || golden || B.airless) ? aurora : aurora && aurora.amt > 0.8 ? { ...aurora, amt: 0.35 } : null, bodies,
        });
        scene.add(this.sky.group);
        scene.background = zen.clone();
        scene.fog = new THREE.FogExp2(fogCol, B.fog * r.range(0.6, 1.2) * (night ? 0.7 : 1));
        this.night = night;

        // ---- light
        const sunL = new THREE.DirectionalLight(sunCol, night ? 0 : golden ? 1.6 : 2.4);
        sunL.position.copy(sunDir).multiplyScalar(60);
        scene.add(sunL, sunL.target);
        if (this.tier !== 'low' && !night) {
            sunL.castShadow = true;
            sunL.shadow.mapSize.set(this.tier === 'high' ? 2048 : 1024, this.tier === 'high' ? 2048 : 1024);
            const sc = sunL.shadow.camera;
            sc.left = sc.bottom = -32;
            sc.right = sc.top = 32;
            sc.near = 1;
            sc.far = 160;
            sunL.shadow.bias = -0.0006;
            sunL.shadow.normalBias = 0.04;
        }
        this.sunL = sunL;
        this.sunDir = sunDir;
        const hemi = new THREE.HemisphereLight(night ? C('#5a6aa8') : hor.clone().lerp(zen, 0.5), pal.g0.clone().multiplyScalar(0.6), night ? 0.85 : B.airless ? 0.35 : 0.9);
        scene.add(hemi);
        if (night && bodies[0]) {
            // the biggest neighbour lights the night
            const ml = new THREE.DirectionalLight(C('#a8b8e8'), 0.7);
            ml.position.copy(bodies[0].dir).multiplyScalar(60);
            scene.add(ml, ml.target);
        }

        // ---- the land
        this._terrain(S('terrain'), B);
        this._liquid(B, hor);

        // ---- the recall beacon on its pad
        this._beacon();

        // ---- what grows
        const fr = S('flora');
        const glowAmt = night ? 1.6 : 0.8;
        this.plants = [];
        for (const [name, dens] of Object.entries(B.flora)) {
            const fn = FLORA[name];
            const kr = rng((this.seed ^ hashString('flora-' + name)) >>> 0);
            const glowCol = name === 'crystal' ? new THREE.Color().setHSL(fr(), 0.7, 0.6) : pal.glow;
            const cols = {
                stem: pal.stem, leaf: name === 'cactus' ? shift('#5a8a4a', dh * 0.5) : pal.leaf, glow: glowCol, glowBase: glowCol.clone().multiplyScalar(0.5), glowAmt: name === 'crystal' ? glowAmt * 0.7 : glowAmt,
                rock: name === 'spire' || name === 'rock' || name === 'boulder' || name === 'vent' ? (B.rockCol ? C(B.rockCol) : pal.rock) : pal.rock,
            };
            this._plant(fn, kr, cols, dens, name);
        }

        // ---- who lives here
        this._fauna(S('fauna'), B);

        // ---- weather
        this._weather(B, S('weather'));

        // ---- the pilot, if this is the world the pilot came to
        this.pilot = opts.pilot ? this._pilot(S('pilot')) : null;

        // ---- the walk
        this._world();
        this.spawn = this._spawn();

        // ---- what to say about it
        const nr = S('name');
        const name = placeName(nr) + (nr() < 0.35 ? ' ' + nr.pick(['Prime', 'II', 'III', 'IV', 'Minor', 'b', 'c', 'VII']) : '');
        const temp = Math.round(lerp(B.temp[0], B.temp[1], r()));
        const grav = B.g[0] + (B.g[1] - B.g[0]) * r();
        this.gravity = Math.round(grav * 100) / 100;
        const o2 = Math.round(B.o2 * r.range(0.85, 1.15));
        this.info = {
            seed: this.seed, key, name, label: B.label, accent: B.accent, temp, gravity: this.gravity, o2,
            day: Math.round(r.range(6, 90)), suns: binary ? 2 : 1, moons: bodies.length, phase, strange,
            air: B.airless ? 'none' : key === 'lava' ? 'poisonous' : r.pick(['thin', 'thin', 'heavy', 'sweet-smelling', 'cold']),
            species: this.species.map((s) => s.name),
        };
        this.built = true;
        return this.info;
    }

    // ------------------------------------------------------------ land

    _terrain(r, B) {
        const ox = r() * 500, oz = r() * 500, ox2 = r() * 500, oz2 = r() * 500;
        const f = r.range(0.014, 0.026), amp = B.amp * r.range(0.7, 1.4), ridgeA = B.ridge * r.range(0.6, 1.4);
        const rimH = B.rimH * r.range(0.8, 1.3);
        const duneA = B.dunes ? r.range(0.8, 1.8) : 0, duneF = r.range(0.12, 0.22), duneT = r() * TAU;
        const dc = Math.cos(duneT), ds = Math.sin(duneT);
        const mesa = (B === BIOMES.desert || B === BIOMES.lava) && r() < 0.4 ? r.range(1.6, 3) : 0;
        const craters = [];
        if (B.craters) for (let i = 0; i < 16; i++) {
            const a = r() * TAU, d = r.range(12, 110), cr = r.range(4, i < 3 ? 22 : 10);
            craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: cr, depth: cr * r.range(0.12, 0.22) });
        }
        const raw = (x, z) => {
            let h = fbm2(x * f + ox, z * f + oz, 4) * amp + ridged2(x * f * 1.8 + ox2, z * f * 1.8 + oz2, 3) * ridgeA;
            if (duneA) {
                const w = fbm2(x * 0.02 + oz, z * 0.02 + ox, 2) * 3;
                h += Math.pow(Math.sin((x * dc + z * ds) * duneF + w) * 0.5 + 0.5, 1.6) * duneA;
            }
            if (mesa) {
                const k = h / mesa, i = Math.floor(k);
                h = (i + smoothstep(0.7, 1, k - i)) * mesa;
            }
            for (const c of craters) {
                const d = Math.hypot(x - c.x, z - c.z) / c.r;
                if (d < 1.8) h += (d < 1 ? (d * d - 1) * c.depth : 0) + c.depth * 0.45 * Math.exp(-(((d - 1) / 0.22) ** 2));
            }
            const rr = Math.hypot(x, z);
            // the ring of hills round the valley, and mountains beyond
            h += Math.pow(smoothstep(WALK_R - 6, WALK_R + 42, rr), 1.3) * rimH * (0.7 + 0.6 * (fbm2(x * 0.012 + ox, z * 0.012, 3) * 0.5 + 0.5));
            h += smoothstep(110, 300, rr) * ridged2(x * 0.006 + ox2, z * 0.006, 3) * rimH * 2.2;
            return h;
        };
        // the level of the seas: a share of the valley floor lies under it
        const L = B.liquid;
        let level = -Infinity;
        if (L) {
            const hs = [];
            for (let i = 0; i < 900; i++) {
                const a = r() * TAU, d = Math.sqrt(r()) * WALK_R;
                hs.push(raw(Math.cos(a) * d, Math.sin(a) * d));
            }
            hs.sort((a, b) => a - b);
            level = hs[Math.floor(hs.length * L.q * r.range(0.8, 1.2))];
        }
        // the pad is always dry, and the ground round it eased level
        let padY = raw(0, 0);
        if (L && padY < level + 0.7) padY = level + 0.7;
        this.level = level;
        this.liquidType = L?.type ?? null;
        this.padY = padY;
        // a dry shelf round the pad: the valley floor near the beacon never dips under the sea, so
        // the pad is never an island and there is always dry land to walk out on
        const SHELF = 24;
        const height = (x, z) => {
            const rr = Math.hypot(x, z);
            const h = lerp(raw(x, z), padY, 1 - smoothstep(PAD_R, PAD_R + 7, rr));
            if (!isFinite(level) || rr > SHELF + 10) return h;
            const floor = level + 0.45 + 0.35 * (fbm2(x * 0.09 + oz, z * 0.09 + ox, 2) * 0.5 + 0.5);
            return h < floor ? lerp(h, floor, 1 - smoothstep(SHELF, SHELF + 10, rr)) : h;
        };
        this.groundAt = height;

        const pal = this.pal;
        const colour = (x, z, h, slope, out) => {
            const n1 = fbm2(x * 0.05 + 3, z * 0.05, 3) * 0.5 + 0.5, n2 = fbm2(x * 0.2, z * 0.2 + 7, 2) * 0.5 + 0.5;
            out.copy(pal.g0).lerp(pal.g1, n1);
            const rel = h - (isFinite(level) ? level : padY - 3);
            if (isFinite(level)) out.lerp(pal.shore, 1 - smoothstep(0.2, 1.4, rel));
            out.lerp(pal.high, smoothstep(6, 18, rel) * 0.8);
            out.lerp(pal.rock, clamp(smoothstep(0.35, 0.75, slope) + n2 * 0.15 * smoothstep(0.2, 0.5, slope), 0, 1));
            out.lerp(pal.peak, smoothstep(rimH * 0.9, rimH * 1.6, rel) * 0.85);
            out.multiplyScalar(0.92 + n2 * 0.16);
            return out;
        };
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: B.craters || B === BIOMES.crystal });
        const grid = (half, step, skip) => {
            const n = Math.round((half * 2) / step) + 1;
            const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
            const c = new THREE.Color();
            for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
                const x = -half + i * step, z = -half + j * step;
                let h = height(x, z);
                if (skip && Math.abs(x) < INNER - 1 && Math.abs(z) < INNER - 1) h -= 0.3;
                const e = 0.8;
                const sx = height(x + e, z) - height(x - e, z), sz = height(x, z + e) - height(x, z - e);
                const slope = 1 - 1 / Math.sqrt(1 + (sx * sx + sz * sz) / (4 * e * e));
                colour(x, z, h, slope * 2.2, c);
                const k = (j * n + i) * 3;
                pos[k] = x;
                pos[k + 1] = h;
                pos[k + 2] = z;
                col[k] = c.r;
                col[k + 1] = c.g;
                col[k + 2] = c.b;
            }
            const idx = [];
            for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
                const x0 = -half + i * step, z0 = -half + j * step;
                if (skip && x0 > -INNER + step && x0 + step < INNER - step && z0 > -INNER + step && z0 + step < INNER - step) continue;
                const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
                idx.push(a, cc, b, b, cc, d);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('color', new THREE.BufferAttribute(col, 3));
            g.setIndex(idx);
            g.computeVertexNormals();
            const m = new THREE.Mesh(g, mat);
            m.receiveShadow = true;
            return m;
        };
        const inner = grid(INNER, this.tier === 'low' ? INNER_STEP * 1.4 : INNER_STEP, false);
        const outer = grid(OUTER, OUTER_STEP, true);
        this.scene.add(inner, outer);
        this.ground = inner;
    }

    _liquid(B, hor) {
        const L = B.liquid;
        if (!L) return;
        const U = {
            uCol: { value: shift(L.col, L.type === 'lava' ? 0 : (this.pal.g0.getHSL({}).h - C(B.ground[0]).getHSL({}).h) * 0.5) }, uSky: { value: hor.clone() }, uTime: { value: 0 },
            uLava: { value: L.type === 'lava' ? 1 : 0 }, uIce: { value: L.type === 'ice' ? 1 : 0 }, uFogCol: { value: this.fogCol }, uFog: { value: this.scene.fog.density },
        };
        const m = new THREE.Mesh(new THREE.CircleGeometry(OUTER, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: LIQUID_VERT, fragmentShader: LIQUID_FRAG, transparent: L.type === 'water', depthWrite: L.type !== 'water' }));
        m.position.y = this.level;
        m.renderOrder = 1;
        this.scene.add(m);
        this.updaters.push((dt, t) => (U.uTime.value = t));
        if (L.type === 'lava') {
            // the lava lights what is near it
            const glow = new THREE.HemisphereLight(0x000000, 0xff5a1a, 0.5);
            this.scene.add(glow);
        }
    }

    /** Dry land the player may stand on, inside the beacon's reach. */
    walkable(x, z) {
        if (Math.hypot(x, z) > WALK_R) return false;
        if (this.liquidType && this.liquidType !== 'ice' && this.groundAt(x, z) < this.level + 0.12) return false;
        return true;
    }

    /** Where animals may go: anywhere dry in the valley (drifters fly over water). */
    _roam(x, z, flies) {
        const r = Math.hypot(x, z);
        // they keep off the beacon's pad, and inside the hills
        if (r > WALK_R + 8 || (!flies && r < PAD_R)) return false;
        if (!flies && this.liquidType && this.liquidType !== 'ice' && this.groundAt(x, z) < this.level + 0.2) return false;
        return true;
    }

    _slopeAt(x, z) {
        const e = 0.7;
        return Math.hypot(this.groundAt(x + e, z) - this.groundAt(x - e, z), this.groundAt(x, z + e) - this.groundAt(x, z - e)) / (2 * e);
    }

    // ------------------------------------------------------------ things on it

    _beacon() {
        const g = new THREE.Group();
        g.position.set(0, this.padY, 0);
        const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.35, metalness: 0.6 });
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x103040, emissive: 0x7ae8ff, emissiveIntensity: 2 });
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.16, 32), steel);
        disc.position.y = 0.08;
        disc.receiveShadow = true;
        g.add(disc);
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 40).rotateX(-Math.PI / 2), ringMat);
        ring.position.y = 0.17;
        g.add(ring);
        // a tripod mast with a lamp on top, to the side of the pad, so you can see it from far off
        const mast = new THREE.Group();
        mast.position.set(2.4, 0, 0.6);
        g.add(mast);
        for (let k = 0; k < 3; k++) {
            const a = (k / 3) * TAU;
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.3, 5), steel);
            leg.position.set(Math.cos(a) * 0.35, 1.08, Math.sin(a) * 0.35);
            leg.rotation.set(Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16);
            mast.add(leg);
        }
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), lampMat);
        lamp.position.y = 2.3;
        mast.add(lamp);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0x7ae8ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.setScalar(2.2);
        halo.position.y = 2.3;
        mast.add(halo);
        // a column of faint light over it, to steer home by
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
        beam.position.y = 32;
        mast.add(beam);
        this.scene.add(g);
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 10), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(0.8, 1.5, 0.2);
        hit.userData.kind = 'beacon';
        g.add(hit);
        this.hits.push(hit);
        this.cols.push({ x: 2.4, z: 0.6, r: 0.45 });
        this.beacon = { g, ring, ringMat, lampMat, halo, hit };
        this.updaters.push((dt, t) => {
            const p = 0.5 + 0.5 * Math.sin(t * 2.2);
            ringMat.opacity = 0.45 + 0.4 * p;
            lampMat.emissiveIntensity = 1 + 2 * (t % 1.6 < 0.2 ? 1 : 0);
            halo.material.opacity = 0.3 + 0.5 * (t % 1.6 < 0.2 ? 1 : 0);
        });
    }

    _plant(fn, kr, cols, dens, name) {
        // three shapes of each kind, the spots shared out between them
        const variants = 3;
        const per = Math.round(dens * (name === 'tuft' || name === 'fern' || name === 'bloom' ? 55 : 22));
        const keep = this.tier === 'low' ? 2 : this.tier === 'medium' ? 1.4 : 1;
        const spots = Array.from({ length: variants }, () => []);
        for (let i = 0; i < per; i++) {
            const a = kr() * TAU, d = Math.sqrt(kr()) * (WALK_R + 40);
            const x = Math.cos(a) * d, z = Math.sin(a) * d;
            const v = kr(), sRand = kr(), rot = kr() * TAU, vi = Math.floor(kr() * variants);
            if (d < PAD_R + 2.5) continue;
            const small = name === 'tuft' || name === 'fern' || name === 'bloom';
            if (small && (i % 10) / 10 >= 1 / keep) continue;
            const y = this.groundAt(x, z);
            const wet = this.liquidType && this.liquidType !== 'ice' ? y - this.level : 99;
            if (name === 'coral' ? wet < -0.4 || wet > 0.8 : wet < 0.25) continue;
            if (this._slopeAt(x, z) > (name === 'rock' || name === 'boulder' || name === 'spire' ? 1.4 : 0.7)) continue;
            spots[vi].push({ x, y: y - 0.05, z, s: 0, sRand, rot, v, tilt: name === 'spire' ? (kr() - 0.5) * 0.3 : 0 });
        }
        for (let k = 0; k < variants; k++) {
            if (!spots[k].length) continue;
            // its size and spacing first (the same seed makes the same shape again below)
            const meta = fn(rng((this.seed ^ hashString(name + k)) >>> 0));
            for (const [, geo] of meta.parts) geo.dispose();
            const made = { kind: meta };
            const sc = made.kind.scale;
            // keep things from standing in each other
            const list = [];
            for (const sp of spots[k]) {
                sp.s = lerp(sc[0], sc[1], sp.sRand);
                const rad = made.kind.minD * sp.s * 0.5;
                if (made.kind.col > 0.2 && this.cols.some((c) => Math.hypot(c.x - sp.x, c.z - sp.z) < c.r + rad)) continue;
                list.push(sp);
                if (made.kind.col > 0.2) this.cols.push({ x: sp.x, z: sp.z, r: made.kind.col * sp.s, plant: name });
            }
            if (!list.length) continue;
            const real = plantKind(fn, rng((this.seed ^ hashString(name + k)) >>> 0), cols, list);
            this.scene.add(real.group);
            if (real.kind.smokes) for (const sp of list.slice(0, 4)) this._smokeAt(sp.x, sp.y + 1.2 * sp.s, sp.z);
            this.plants.push({ name: real.kind.name, glow: real.kind.glow });
        }
    }

    _smokeAt(x, y, z) {
        const N = 6;
        const puffs = [];
        for (let i = 0; i < N; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0x5a4a44, transparent: true, opacity: 0, depthWrite: false }));
            this.scene.add(s);
            puffs.push({ s, t: i / N });
        }
        this.updaters.push((dt, t) => {
            for (const p of puffs) {
                const u = (p.t + t * 0.15) % 1;
                p.s.position.set(x + u * 1.5, y + u * 7, z + Math.sin(u * 5 + p.t * 9) * 0.5);
                p.s.scale.setScalar(0.8 + u * 5);
                p.s.material.opacity = smoothstep(0, 0.1, u) * (1 - u) * 0.6;
            }
        });
    }

    _fauna(r, B) {
        this.species = [];
        this.creatures = [];
        if (B.airless && r() < 0.5) return;
        const n = B.airless ? 1 : r.int(2, 4);
        const cap = this.tier === 'low' ? 0.5 : this.tier === 'medium' ? 0.75 : 1;
        const plans = [...B.plans];
        for (let i = 0; i < n; i++) {
            const plan = plans.splice(Math.floor(r() * plans.length), 1)[0] ?? r.pick(B.plans);
            const sp = makeSpecies(r, { night: this.night }, plan);
            this.species.push(sp);
            // a herd's home, somewhere dry in the valley
            let hx = 0, hz = 0;
            for (let k = 0; k < 40; k++) {
                const a = r() * TAU, d = r.range(12, WALK_R - 4);
                hx = Math.cos(a) * d;
                hz = Math.sin(a) * d;
                if (this._roam(hx, hz, false)) break;
            }
            const count = Math.max(1, Math.round(sp.count * cap));
            for (let k = 0; k < sp.count; k++) {
                const cr = rng((this.seed ^ hashString(`beast-${i}-${k}`)) >>> 0);
                if (k >= count) continue;
                const c = makeCreature(sp, cr);
                Object.assign(c, {
                    x: hx + cr.range(-5, 5), z: hz + cr.range(-5, 5), yaw: cr() * TAU, hx, hz, tx: hx, tz: hz,
                    think: cr() * 4, state: 'graze', speed: 0, walk: cr() * 10, ph: cr() * TAU,
                    // fliers: round and round
                    cx: cr.range(-20, 20), cz: cr.range(-20, 20), ring: cr.range(16, 46), a: cr() * TAU, w: cr.range(0.08, 0.2) * cr.sign(), alt: cr.range(10, 26), flap: cr.range(5, 9),
                });
                if (!this._roam(c.x, c.z, sp.plan === 'floater')) {
                    c.x = hx;
                    c.z = hz;
                }
                c.g.userData.creature = c;
                this.scene.add(c.g);
                this.creatures.push(c);
            }
        }
    }

    _weather(B, r) {
        const W = WEATHER[B.weather];
        if (!W) return;
        const n = Math.round(W.n * (this.tier === 'low' ? 0.45 : this.tier === 'medium' ? 0.7 : 1));
        const BOX = 44, H = 24;
        const pos = new Float32Array(n * 3), seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (r() - 0.5) * BOX;
            pos[i * 3 + 1] = r() * H;
            pos[i * 3 + 2] = (r() - 0.5) * BOX;
            seed[i] = r();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const col = C(W.col);
        if (W.glow > 0.5) col.multiplyScalar(1.6);
        const m = new THREE.PointsMaterial({ map: glowSprite(), color: col, size: W.size * 2, transparent: true, opacity: 0.85, depthWrite: false, blending: W.glow > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending });
        const pts = new THREE.Points(g, m);
        pts.frustumCulled = false;
        this.scene.add(pts);
        const wind = new V3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(W.drift);
        this.updaters.push((dt, t, cam) => {
            for (let i = 0; i < n; i++) {
                let x = pos[i * 3] + (wind.x + Math.sin(t * 0.7 + seed[i] * 20) * 0.3) * dt;
                let y = pos[i * 3 + 1] - W.fall * (0.6 + seed[i] * 0.8) * dt;
                let z = pos[i * 3 + 2] + (wind.z + Math.cos(t * 0.6 + seed[i] * 17) * 0.3) * dt;
                // wrap round the camera
                const rx = x - cam.position.x, rz = z - cam.position.z, ry = y - (cam.position.y - 6);
                if (rx > BOX / 2) x -= BOX;
                else if (rx < -BOX / 2) x += BOX;
                if (rz > BOX / 2) z -= BOX;
                else if (rz < -BOX / 2) z += BOX;
                if (ry < 0) y += H;
                else if (ry > H) y -= H;
                pos[i * 3] = x;
                pos[i * 3 + 1] = y;
                pos[i * 3 + 2] = z;
            }
            g.attributes.position.needsUpdate = true;
            if (W.embers) m.color.setRGB(0.35 + 0.15 * Math.sin(t * 3), 0.28, 0.25);
        });
    }

    /** A test for "can be walked to from the beacon": flood-fills the dry ground on a coarse grid. */
    _reachable() {
        const C = 2, N = Math.ceil(WALK_R / C) + 1, W = N * 2 + 1;
        const seen = new Uint8Array(W * W);
        const idx = (i, j) => (j + N) * W + (i + N);
        const ok = (i, j) => Math.abs(i) <= N && Math.abs(j) <= N && this.walkable(i * C, j * C) && this._slopeAt(i * C, j * C) < 0.9;
        const q = [[0, 0]];
        seen[idx(0, 0)] = 1;
        while (q.length) {
            const [i, j] = q.pop();
            for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
                const ni = i + di, nj = j + dj;
                if ((di || dj) && ok(ni, nj) && !seen[idx(ni, nj)]) {
                    seen[idx(ni, nj)] = 1;
                    q.push([ni, nj]);
                }
            }
        }
        return (x, z) => {
            const i = Math.round(x / C), j = Math.round(z / C);
            return Math.abs(i) <= N && Math.abs(j) <= N && seen[idx(i, j)] === 1;
        };
    }

    _pilot(r) {
        // somewhere dry and level, not too near the beacon, and not right behind you as you arrive
        // (and on land you can walk to from the beacon, not across the water)
        const reach = this._reachable();
        let best = null;
        for (let k = 0; k < 400 && !best; k++) {
            const a = r() * TAU, d = r.range(k < 300 ? 18 : 12, WALK_R - 8);
            const x = Math.cos(a) * d, z = Math.sin(a) * d;
            if (!this.walkable(x, z) || this._slopeAt(x, z) > 0.35 || !reach(x, z)) continue;
            if (this.cols.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 2.5)) continue;
            best = { x, z };
        }
        if (!best) best = { x: 14, z: 6 };
        const p = buildPilot(r);
        const y = this.groundAt(best.x, best.z);
        p.group.position.set(best.x, y, best.z);
        // facing the biggest world in the sky, or else the beacon
        const look = this.bodies[0]?.dir ?? new V3(-best.x, 0, -best.z).normalize();
        p.group.rotation.y = Math.atan2(look.x, look.z);
        p.group.traverse((m) => {
            if (m.isMesh) m.userData.kind = 'pilot';
        });
        this.scene.add(p.group);
        const back = new V3(0, 0, -0.75).applyAxisAngle(new V3(0, 1, 0), p.group.rotation.y);
        this.cols.push({ x: best.x + back.x, z: best.z + back.z, r: 0.9 });
        const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(0, 0.9, 0);
        hit.userData.kind = 'pilot';
        p.group.add(hit);
        this.hits.push(hit);
        this.updaters.push((dt, t) => p.update(t));
        return { x: best.x, z: best.z, y, group: p.group, found: false };
    }

    // ------------------------------------------------------------ the walk

    _world() {
        const self = this;
        const CELL = 4;
        const grid = new Map();
        for (const c of this.cols) {
            for (let i = Math.floor((c.x - c.r) / CELL); i <= Math.floor((c.x + c.r) / CELL); i++) {
                for (let j = Math.floor((c.z - c.r) / CELL); j <= Math.floor((c.z + c.r) / CELL); j++) {
                    const k = i * 7919 + j;
                    if (!grid.has(k)) grid.set(k, []);
                    grid.get(k).push(c);
                }
            }
        }
        const empty = [];
        this.world = {
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: (x, z) => (self.liquidType === 'ice' ? Math.max(self.groundAt(x, z), self.level) : self.groundAt(x, z)),
            onDeck: () => false,
            collidersNear: (x, z) => grid.get(Math.floor(x / CELL) * 7919 + Math.floor(z / CELL)) || empty,
            onArrive: (r) => r?.then?.(),
        };
        this.world.nav = new NavGrid(this.world, WALK_R + 2);
    }

    _spawn() {
        // on the pad, facing the biggest thing in the sky (or the sun, low)
        const look = this.bodies[0]?.dir ?? this.sunDir;
        const yaw = Math.atan2(-look.x, -look.z);
        return { x: 0, z: 0, yaw };
    }

    // ------------------------------------------------------------ living

    update(dt, t, camera, player) {
        if (!this.built) return;
        this.clock += dt;
        this.sky.update(dt, t, camera);
        // the sun's shadows follow you about
        const s = this.sunL;
        s.target.position.set(player.x, this.groundAt(player.x, player.z), player.z);
        s.position.copy(s.target.position).addScaledVector(this.sunDir, 70);
        for (const u of this.updaters) u(dt, t, camera);
        const P = { player, groundAt: this.groundAt, roam: (x, z, f) => this._roam(x, z, f) };
        for (const c of this.creatures) stepCreature(c, dt, t, P);
    }

    /** The animal under the pointer, if any. */
    creatureAt(ray, maxD = 60) {
        let best = null, bd = maxD;
        const c3 = new V3();
        for (const c of this.creatures) {
            c3.set(c.g.position.x, c.g.position.y + (c.sp.plan === 'flyer' ? 0 : c.hipY), c.g.position.z);
            const d = ray.ray.origin.distanceTo(c3);
            if (d > bd) continue;
            if (ray.ray.distanceSqToPoint(c3) < (c.radius * 0.9) ** 2) {
                bd = d;
                best = c;
            }
        }
        return best;
    }

    /** What the pointer is on: { type, ... } (beacon, pilot, creature, ground) or null. */
    pick(ray) {
        const h = ray.intersectObjects(this.hits, false)[0];
        const c = this.creatureAt(ray, h ? h.distance : 60);
        if (c) return { type: 'creature', c, d: ray.ray.origin.distanceTo(c.g.position) };
        if (h && h.distance < 60) return { type: h.object.userData.kind, d: h.distance, point: h.point };
        const g = ray.intersectObject(this.ground, false)[0];
        if (g && g.distance < 80) return { type: 'ground', point: g.point, d: g.distance };
        return null;
    }

    dispose() {
        if (!this.scene) return;
        const seen = new Set();
        this.scene.traverse((o) => {
            if (o.geometry && !seen.has(o.geometry)) {
                seen.add(o.geometry);
                o.geometry.dispose();
            }
            const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
            for (const m of ms) {
                if (seen.has(m)) continue;
                seen.add(m);
                if (m.map && m.map !== glowSprite()) m.map.dispose();
                m.dispose();
            }
            if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
        });
        this.scene = null;
        this.built = false;
        this.creatures = [];
    }
}
