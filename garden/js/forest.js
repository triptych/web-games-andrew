// The Springwood: through the shimmering door in the Great Tree's roots is a
// spring forest that goes on for ever. Like the sea under the Moon Fountain,
// the ground is made in chunks as you walk (forest-land.js) and only the wood
// round about you is kept, so there is always more of it. Blossom glades,
// bluebell woods, birch hollows and clover meadows run into one another;
// footpaths wind through them; and here and there is a lily pond or a special
// place to find (forest-places.js). Petals drift down, butterflies wander by
// day and fireflies come out at night, keeping time with the garden's sky.
// The door home stands in the clearing where you arrive. Its own scene, drawn
// by the garden's composer, walked with the garden's controls.

import * as THREE from 'three';
import { CHUNK, CELL, HOME_R, biomeAt, dominant, groundY, featureIn, buildChunk, forestMaterial } from './forest-land.js';
import { ALL_PLACES, POND } from './forest-places.js';
import { makePortal, inDoorway, rayPortal, PORTAL_W } from './forest-portal.js';
import { ForestAudio } from './forest-audio.js';
import { clamp, damp, store, smoothstep, TAU } from './util.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);
const $ = (id) => document.getElementById(id);

const ZONES = {
    blossom: ['The Blossom Glades', 'Cherry and apple trees in full flower', '#ffb7d5'],
    bluebell: ['The Bluebell Wood', 'A blue haze under the beeches', '#a8b4ff'],
    birch: ['The Birch Hollows', 'White trunks, ferns and daffodils', '#f4ecb0'],
    meadow: ['The Clover Meadows', 'Open sky, tulips and butterflies', '#b8f080'],
};

const TIER = {
    high: { R: 3, density: 1, petals: 700, motes: 260, butterflies: 14 },
    medium: { R: 2, density: 0.8, petals: 450, motes: 180, butterflies: 10 },
    low: { R: 2, density: 0.55, petals: 260, motes: 110, butterflies: 6 },
};

const MIST = C('#d4e8d0'), TOP = C('#8cc8f0'), NIGHT_FOG = C('#0e1a2a'), NIGHT_TOP = C('#081428'), GROUND = C('#8a9a62');

// ------------------------------------------------------------------ shaders

const DOME_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }';
const DOME_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uFog; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight;
varying vec3 vDir;
void main() {
    vec3 d = normalize(vDir);
    vec3 c = d.y > 0.0 ? mix(uFog, uTop, smoothstep(0.02, 0.6, d.y)) : uFog;
    float s = max(dot(d, uSunDir), 0.0);
    c += uSunCol * (pow(s, 500.0) * 3.0 + pow(s, 9.0) * 0.22) * (1.0 - uNight);
    if (uNight > 0.01 && d.y > 0.0) {
        vec3 p = floor(d * 260.0);
        float h = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        c += step(0.9972, h) * uNight * smoothstep(0.05, 0.35, d.y) * vec3(0.9, 0.95, 1.0) * (0.6 + fract(h * 91.0) * 0.6);
    }
    gl_FragColor = vec4(c, 1.0);
}`;

const WATER_FRAG = /* glsl */ `
uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uFog; uniform float uTime; uniform float uNear; uniform float uFar; uniform float uDay;
varying vec3 vW;
void main() {
    vec3 v = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(v.y, 0.0), 3.0);
    vec2 p = vW.xz;
    float w = sin(p.x * 1.3 + uTime * 0.8 + sin(p.y * 0.9 + uTime * 0.5)) * sin(p.y * 1.1 - uTime * 0.6 + sin(p.x * 0.7));
    vec3 c = mix(uDeep, uSky, 0.3 + fres * 0.6 + w * 0.05);
    c += pow(max(w, 0.0), 16.0) * uDay * 0.7;
    float f = smoothstep(uNear, uFar, distance(vW, cameraPosition));
    gl_FragColor = vec4(mix(c, uFog, f), mix(0.84, 1.0, f));
}`;

const RAY_FRAG = /* glsl */ `
uniform float uOpacity; uniform float uTime; uniform float uSeed; uniform vec3 uColor; varying vec2 vUv; varying float vD;
void main() {
    float e = sin(3.14159 * vUv.x);
    float a = e * e * smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y)) * uOpacity;
    a *= 0.6 + 0.4 * sin(uTime * 0.4 + uSeed * 6.28 + vUv.y * 2.0);
    a *= smoothstep(3.0, 10.0, vD) * exp(-vD * 0.02);
    gl_FragColor = vec4(uColor * a, 1.0);
}`;

// petals: falling, tumbling, wrapped round the camera
const PETAL_VERT = /* glsl */ `
uniform vec3 uCam; uniform float uTime; uniform float uScale;
attribute float aSeed; attribute vec3 aCol;
varying float vA; varying vec3 vCol; varying float vRot;
void main() {
    vec3 p = position + vec3(sin(uTime * 0.7 + aSeed * 6.28) * 0.6 + uTime * 0.35, -uTime * (0.35 + aSeed * 0.3), cos(uTime * 0.5 + aSeed * 4.0) * 0.6);
    p = mod(p - uCam + 18.0, 36.0) - 18.0 + uCam;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    vA = smoothstep(0.3, 1.5, d) * (1.0 - smoothstep(10.0, 18.0, d));
    vCol = aCol;
    vRot = uTime * (1.0 + aSeed * 2.0) + aSeed * 30.0;
    gl_PointSize = (0.06 + aSeed * 0.05) * uScale / max(d, 0.1);
    gl_Position = projectionMatrix * mv;
}`;
const PETAL_FRAG = /* glsl */ `
uniform float uAmount; varying float vA; varying vec3 vCol; varying float vRot;
void main() {
    vec2 q = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    q.y *= 1.0 + 0.8 * abs(sin(vRot * 0.7));
    float e = length(q * vec2(1.0, 1.9));
    float a = (1.0 - smoothstep(0.3, 0.42, e)) * vA * uAmount;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vCol, a);
}`;

// pollen in the sunlight by day, fireflies by night
const MOTE_VERT = /* glsl */ `
uniform vec3 uCam; uniform float uTime; uniform float uScale; uniform float uNight;
attribute float aSeed;
varying float vA;
void main() {
    float s = aSeed;
    vec3 p = position + vec3(sin(uTime * (0.3 + s * 0.4) + s * 20.0) * 1.2, sin(uTime * (0.5 + s * 0.3) + s * 9.0) * 0.5, cos(uTime * (0.25 + s * 0.35) + s * 13.0) * 1.2);
    p.xz = mod(p.xz - uCam.xz + 15.0, 30.0) - 15.0 + uCam.xz;
    p.y += uCam.y - 1.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float blink = smoothstep(0.55, 0.95, sin(uTime * (1.3 + s * 1.7) + s * 40.0) * 0.5 + 0.5);
    vA = smoothstep(0.3, 1.5, d) * (1.0 - smoothstep(14.0, 15.0, d)) * mix(0.35, blink, uNight);
    gl_PointSize = mix(0.03, 0.14, uNight) * (0.7 + s * 0.6) * uScale / max(d, 0.1);
    gl_Position = projectionMatrix * mv;
}`;
const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uAmount; varying float vA;
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA * uAmount;
    gl_FragColor = vec4(uColor * a * 1.6, 1.0);
}`;

// butterflies: two wings that flap about the body, drawn per instance
const FLY_VERT = /* glsl */ `
uniform float uTime;
attribute float aPhase; attribute vec3 aColor;
varying vec2 vUv; varying vec3 vCol;
void main() {
    vUv = uv;
    vCol = aColor;
    float side = sign(position.x);
    float flap = sin(uTime * 13.0 + aPhase * 6.28) * 0.95 + 0.25;
    float s = abs(position.x);
    vec3 p = vec3(side * s * cos(flap), s * sin(flap), position.z);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}`;
const FLY_FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vCol;
void main() {
    vec2 q = vec2(abs(vUv.x - 0.5) * 2.0, vUv.y);
    float fore = length((q - vec2(0.55, 0.68)) * vec2(1.0, 1.25));
    float hind = length((q - vec2(0.45, 0.28)) * vec2(1.15, 1.3));
    float m = min(fore, hind);
    if (m > 0.42 || q.x < 0.04) discard;
    vec3 c = mix(vCol, vCol * 0.3, smoothstep(0.3, 0.42, m));
    c = mix(c, vec3(1.0), (1.0 - smoothstep(0.0, 0.06, length(q - vec2(0.62, 0.72)))) * 0.85);
    gl_FragColor = vec4(c, 1.0);
}`;

export class Forest {
    /** @param {object} env { renderer, audio (AudioEngine), ui, quality } */
    constructor(env) {
        this.env = env;
        this.cfg = TIER[env.quality?.tier] || TIER.high;
        this.inside = false;
        this.scene = new THREE.Scene();
        this.fogColor = MIST.clone();
        this.scene.background = this.fogColor;
        this.far = this.cfg.R * CHUNK - 8;
        this.scene.fog = new THREE.Fog(this.fogColor, 12, this.far);
        this.scene.fog.color = this.fogColor;
        this.uni = { uTime: { value: 0 }, uWind: { value: 1 }, uDapple: { value: 1 }, uGlow: { value: 0 } };
        this.mat = forestMaterial(this.uni);
        this.chunks = new Map();
        this.queue = [];
        this.ci = this.cj = null;
        this.ver = 0;
        this.coll = { key: null, ver: -1, list: [] };
        this.glowMats = [];
        this.log = store.get('forestLog', {});
        this.seen = new Set();
        this.clock = 0;
        this.fwd = new V3(0, 0, -1);
        this.sound = env.audio ? new ForestAudio(env.audio) : null;
        this._lights();
        this._sky();
        this._water();
        this._rays();
        this._petals();
        this._motes();
        this._butterflies();
        this._home();
        this._dom();

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            // the ponds are too deep to wade
            island: { heightAt: (x, z) => groundY(x, z) },
            walkHeight: (x, z) => Math.max(groundY(x, z), 0),
            onDeck: () => false,
            collidersNear: (x, z) => self._collidersNear(x, z),
            onArrive: null,
        };
    }

    // ------------------------------------------------------------ building the view

    _lights() {
        this.hemi = new THREE.HemisphereLight(0xcfe8ff, GROUND, 1.0);
        this.sun = new THREE.DirectionalLight(0xfff1d0, 2.0);
        this.sun.position.set(0.4, 1, 0.3);
        this.scene.add(this.hemi, this.sun, this.sun.target);
    }

    _sky() {
        this.domeU = { uTop: { value: TOP.clone() }, uFog: { value: this.fogColor }, uSunDir: { value: new V3(0.3, 0.8, 0.2).normalize() }, uSunCol: { value: C('#fff0d0') }, uNight: { value: 0 } };
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ uniforms: this.domeU, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
        this.dome.renderOrder = -10;
        this.dome.frustumCulled = false;
        this.scene.add(this.dome);
    }

    _water() {
        this.waterU = { uDeep: { value: C('#2a5a5a') }, uSky: { value: C('#a8d0e0') }, uFog: { value: this.fogColor }, uTime: this.uni.uTime, uNear: { value: 12 }, uFar: { value: this.far }, uDay: { value: 1 } };
        this.water = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
            uniforms: this.waterU,
            vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: WATER_FRAG,
            transparent: true, depthWrite: false, fog: false,
        }));
        this.water.frustumCulled = false;
        this.water.renderOrder = 1;
        this.scene.add(this.water);
    }

    _rays() {
        // shafts of sunlight slanting down between the trees
        this.rayU = { uOpacity: { value: 0.2 }, uTime: this.uni.uTime, uColor: { value: C('#fff0c0') } };
        const geo = new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, 0.5, 0);
        this.rayList = [];
        for (let i = 0; i < 10; i++) {
            const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
                uniforms: { ...this.rayU, uSeed: { value: Math.random() } },
                vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vD = distance(w.xyz, cameraPosition); gl_Position = projectionMatrix * viewMatrix * w; }',
                fragmentShader: RAY_FRAG,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
            }));
            m.frustumCulled = false;
            m.userData.w = 1.5 + Math.random() * 3.5;
            this.scene.add(m);
            this.rayList.push(m);
        }
    }

    _placeRay(m, p, near) {
        const a = Math.random() * TAU, d = near ? 5 + Math.random() * 30 : 24 + Math.random() * 14;
        const x = p.x + Math.sin(a) * d + (near ? 0 : this.fwd.x * 18), z = p.z + Math.cos(a) * d + (near ? 0 : this.fwd.z * 18);
        m.position.set(x, groundY(x, z) - 0.5, z);
        m.scale.set(m.userData.w, 16 + Math.random() * 8, 1);
    }

    _petals() {
        const n = this.cfg.petals;
        const pos = new Float32Array(n * 3), seed = new Float32Array(n), col = new Float32Array(n * 3);
        const pal = ['#ffc4dc', '#ffe0ec', '#fff4f6', '#f7a8c8', '#ffffff'].map(C);
        for (let i = 0; i < n; i++) {
            pos.set([(Math.random() - 0.5) * 36, (Math.random() - 0.5) * 36, (Math.random() - 0.5) * 36], i * 3);
            seed[i] = Math.random();
            const c = pal[i % pal.length];
            col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
        this.petalU = { uCam: { value: new V3() }, uTime: this.uni.uTime, uScale: { value: 400 }, uAmount: { value: 1 } };
        this.petals = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.petalU, vertexShader: PETAL_VERT, fragmentShader: PETAL_FRAG, transparent: true, depthWrite: false, fog: false }));
        this.petals.frustumCulled = false;
        this.scene.add(this.petals);
    }

    _motes() {
        const n = this.cfg.motes;
        const pos = new Float32Array(n * 3), seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos.set([(Math.random() - 0.5) * 30, Math.random() * 3.2, (Math.random() - 0.5) * 30], i * 3);
            seed[i] = Math.random();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        this.moteU = { uCam: { value: new V3() }, uTime: this.uni.uTime, uScale: { value: 400 }, uNight: { value: 0 }, uColor: { value: C('#fff0b0') }, uAmount: { value: 1 } };
        this.motes = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.moteU, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        this.motes.frustumCulled = false;
        this.scene.add(this.motes);
    }

    _butterflies() {
        const n = this.cfg.butterflies;
        // two wings either side of x = 0, 0.12 m long, each a quad hinged at the body
        const g = new THREE.BufferGeometry();
        const W = 0.07, Lz = 0.06;
        g.setAttribute('position', new THREE.Float32BufferAttribute([
            -W, 0, -Lz, -1e-4, 0, -Lz, -1e-4, 0, Lz, -W, 0, Lz,
            1e-4, 0, -Lz, W, 0, -Lz, W, 0, Lz, 1e-4, 0, Lz,
        ], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 0, 0.5, 1, 0, 1, 0.5, 0, 1, 0, 1, 1, 0.5, 1], 2));
        g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
        const phase = new Float32Array(n), col = new Float32Array(n * 3);
        const pal = ['#ffd23a', '#ff8a3a', '#8ab8ff', '#ffffff', '#f0a8ff', '#ffe890'].map(C);
        this.flies = [];
        for (let i = 0; i < n; i++) {
            phase[i] = Math.random();
            const c = pal[i % pal.length];
            col.set([c.r, c.g, c.b], i * 3);
            this.flies.push({ anchor: new V3(), pos: new V3(), heading: 0, p: Math.random() * 100, a: 0.4 + Math.random() * 0.5, b: 0.3 + Math.random() * 0.5, placed: false });
        }
        g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
        g.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
        this.flyMesh = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ uniforms: { uTime: this.uni.uTime }, vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, side: THREE.DoubleSide, fog: false }), n);
        this.flyMesh.frustumCulled = false;
        this.scene.add(this.flyMesh);
    }

    _home() {
        // the door back to the garden, in a clearing ringed with stones and flowers
        const y = groundY(0, 0);
        const portal = makePortal({
            seed: 'springwood-home',
            colors: ['#4a6cff', '#ffcf6a', '#a88aff', '#fff0c0'],
            bark: new THREE.MeshStandardMaterial({ color: 0x6a5040, roughness: 0.9 }),
            bloom: 0xfff2f6,
            glowMats: this.glowMats,
        });
        portal.group.position.set(0, y, 0);
        this.scene.add(portal.group);
        this.home = { x: 0, z: 0, nx: 0, nz: 1, y, surface: portal.surface, portal };
        this.homeColliders = [-1, 1].map((s) => ({ x: s * (PORTAL_W / 2 + 0.35), z: 0, r: 0.32 }));
        this.spawn = { x: 0, z: 2.3, yaw: Math.PI };
    }

    _dom() {
        this.dom = { root: $('forest-hud'), dist: $('forest-dist'), arrow: $('forest-arrow'), found: $('forest-found'), home: $('forest-home') };
        this.dom.home?.addEventListener('click', () => {
            this.env.audio?.click();
            this.onExit?.();
        });
    }

    // ------------------------------------------------------------ in and out

    /** In through the door: the wood round the clearing is built at once. */
    enter(controls) {
        this.controls = controls;
        controls.world = this.world;
        const s = this.spawn;
        controls.teleport(s.x, s.z, s.yaw);
        this.inside = true;
        this.armed = false;
        this.fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
        this._chunks(controls.pos, true);
        for (const r of this.rayList) this._placeRay(r, controls.pos, true);
        for (const f of this.flies) f.placed = false;
        this.biome = 'blossom';
        this.biomeNext = null;
        this.biomeTimer = 1;
        this.placeTimer = 0;
        this.quietUntil = this.clock + 6;
        this.dashTimer = 0;
        if (this.dom.root) this.dom.root.hidden = false;
        document.body.classList.add('in-forest');
        this._dash(true);
        this.sound?.start();
    }

    /** Back to the garden: the wood is let go, to be made again next time. */
    leave() {
        if (!this.inside) return;
        this.inside = false;
        if (this.dom.root) this.dom.root.hidden = true;
        document.body.classList.remove('in-forest');
        this.sound?.stop();
        for (const ch of this.chunks.values()) this._drop(ch);
        this.chunks.clear();
        this.queue = [];
        this.ci = this.cj = null;
        this.ver++;
    }

    // ------------------------------------------------------------ the endless wood

    _chunks(p, sync) {
        const R = this.cfg.R;
        const ci = Math.floor(p.x / CHUNK), cj = Math.floor(p.z / CHUNK);
        if (!sync && ci === this.ci && cj === this.cj) return;
        this.ci = ci;
        this.cj = cj;
        // a little slack past the ring that is built, so stepping back and forth over an edge doesn't rebuild it
        for (const [key, ch] of this.chunks) {
            if ((ch.i - ci) ** 2 + (ch.j - cj) ** 2 > (R + 1) ** 2) {
                this._drop(ch);
                this.chunks.delete(key);
                this.ver++;
            }
        }
        const list = [];
        for (let dj = -R; dj <= R; dj++) {
            for (let di = -R; di <= R; di++) {
                if (di * di + dj * dj > (R + 0.5) ** 2) continue;
                const key = `${ci + di},${cj + dj}`;
                // the chunk you stand in first, then the way you are facing
                if (!this.chunks.has(key)) list.push({ key, i: ci + di, j: cj + dj, d: di * di + dj * dj - (di * this.fwd.x + dj * this.fwd.z) * 1.5 });
            }
        }
        list.sort((a, b) => a.d - b.d);
        this.queue = list;
        if (sync) while (this.queue.length) this._buildNext();
    }

    _buildNext() {
        const q = this.queue.shift();
        if (!q || this.chunks.has(q.key)) return;
        const ch = buildChunk(q.i, q.j, this.mat, this.cfg.density);
        ch.i = q.i;
        ch.j = q.j;
        this.scene.add(ch.mesh);
        this.chunks.set(q.key, ch);
        this.ver++;
    }

    _drop(ch) {
        this.scene.remove(ch.mesh);
        ch.mesh.geometry.dispose();
    }

    /** Everything solid in the chunks round (x, z), cached until you cross into another chunk. */
    _collidersNear(x, z) {
        const ci = Math.floor(x / CHUNK), cj = Math.floor(z / CHUNK);
        const key = `${ci},${cj}`, c = this.coll;
        if (c.key === key && c.ver === this.ver) return c.list;
        c.key = key;
        c.ver = this.ver;
        c.list = Math.hypot(x, z) < 40 ? [...this.homeColliders] : [];
        for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
            const ch = this.chunks.get(`${i},${j}`);
            if (ch) for (const o of ch.colliders) c.list.push(o);
        }
        return c.list;
    }

    // ------------------------------------------------------------ frame

    /** `sky` is the garden sky's state: { sunDir, moonDir, zenith, horizon, sunColor, night, sunElev }. */
    update(dt, t, camera, sky) {
        if (!this.inside) return;
        this.clock += dt;
        this.uni.uTime.value = t;
        const p = this.controls.pos;
        const yaw = this.controls.yaw;
        this.fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        this._chunks(p, false);
        if (this.queue.length) this._buildNext();
        const night = sky?.night ?? 0;
        this._env(dt, camera, sky, night);
        this._flutter(dt, t, p, night);

        // the door home
        const hd = Math.hypot(p.x - this.home.x, p.z - this.home.z);
        this.home.portal.update(t, night, clamp(1 - (hd - 1.5) / 8, 0, 1), this.env.renderer.domElement.height * 0.5);
        for (const g of this.glowMats) g.mat.emissiveIntensity = g.day + (g.night - g.day) * night;
        if (hd > 3) this.armed = true;
        if (this.armed && inDoorway(this.home, p.x, p.z)) {
            this.armed = false;
            this.onExit?.();
        }

        // where you are: places found, and the kind of wood
        this.placeTimer -= dt;
        if (this.placeTimer <= 0) {
            this.placeTimer = 0.5;
            this._places(p);
        }
        this.biomeTimer -= dt;
        if (this.biomeTimer <= 0) {
            this.biomeTimer = 1;
            const b = Math.hypot(p.x, p.z) < 24 ? 'blossom' : dominant(biomeAt(p.x, p.z));
            if (b === this.biome) this.biomeNext = null;
            else if (b === this.biomeNext) {
                this.biome = b;
                this.biomeNext = null;
                if (this.clock > this.quietUntil) {
                    const z = ZONES[b];
                    this.env.ui?.zone(z[0], z[1], z[2]);
                }
            } else this.biomeNext = b;
        }
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
            this.dashTimer = 0.2;
            this._dash();
        }
        this.sound?.update(night, this._nearWater(p), 0.5 + 0.5 * Math.sin(t * 0.07));
    }

    /** Light, mist and glow from the garden's time of day, a little greener and softer. */
    _env(dt, camera, sky, night) {
        const day = 1 - night;
        const sunUp = clamp((sky?.sunElev ?? 0.5) * 3, 0, 1);
        if (sky) {
            this.fogColor.copy(sky.horizon).lerp(MIST, 0.55 * day);
            this.domeU.uTop.value.copy(sky.zenith).lerp(TOP, 0.3 * day);
            this.domeU.uSunCol.value.copy(sky.sunColor);
            if (sky.sunElev > -0.05) {
                this.domeU.uSunDir.value.copy(sky.sunDir);
                this.sun.position.copy(sky.sunDir);
                this.sun.color.copy(sky.sunColor);
            } else {
                this.sun.position.copy(sky.moonDir);
                this.sun.color.set(0x9ab4ff);
            }
        }
        this.fogColor.lerp(NIGHT_FOG, night * 0.6);
        this.domeU.uTop.value.lerp(NIGHT_TOP, night * 0.5);
        this.domeU.uNight.value = night;
        this.hemi.color.copy(this.domeU.uTop.value).lerp(C('#ffffff'), 0.35);
        this.hemi.intensity = 0.35 + 1.0 * day;
        this.sun.intensity = sky?.sunElev > -0.05 ? 2.1 * sunUp * day : 0.45 * night;
        this.uni.uDapple.value = 0.9 * sunUp * day;
        // a little by day too, so blossom and lit windows stay bright in the shade
        this.uni.uGlow.value = 0.22 * day + night * 1.15;
        this.rayU.uOpacity.value = 0.22 * sunUp * day;
        this.waterU.uSky.value.copy(this.domeU.uTop.value).lerp(this.fogColor, 0.4);
        this.waterU.uDeep.value.set(0x2a5a5a).multiplyScalar(0.3 + 0.7 * day);
        this.waterU.uDay.value = sunUp * day;

        const p = camera.position;
        this.dome.position.copy(p);
        this.water.position.set(Math.round(p.x / 10) * 10, 0, Math.round(p.z / 10) * 10);
        const h = this.env.renderer.domElement.height * 0.5;
        const w = biomeAt(p.x, p.z);
        this.petalU.uCam.value.copy(p);
        this.petalU.uScale.value = h;
        this.petalU.uAmount.value = damp(this.petalU.uAmount.value, clamp(0.15 + w.blossom * 1.6, 0, 1) * (0.4 + day * 0.6), 1, dt);
        this.moteU.uCam.value.copy(p);
        this.moteU.uScale.value = h;
        this.moteU.uNight.value = night;
        this.moteU.uColor.value.set(0xfff0b0).lerp(C('#c8ff6a'), night);
        this.moteU.uAmount.value = night > 0.3 ? night : 0.5 * sunUp * day;
        for (const m of this.rayList) {
            if (Math.hypot(m.position.x - p.x, m.position.z - p.z) > 42) this._placeRay(m, p, false);
            m.rotation.set(0, Math.atan2(p.x - m.position.x, p.z - m.position.z), 0.18);
        }
    }

    /** The butterflies: each wanders about a spot near you, and is moved on ahead when left behind. */
    _flutter(dt, t, p, night) {
        const m = this.flyMesh;
        m.visible = night < 0.6;
        if (!m.visible) return;
        const M = _m, q = _q, s = _s;
        this.flies.forEach((f, i) => {
            if (!f.placed || Math.hypot(f.anchor.x - p.x, f.anchor.z - p.z) > 24) {
                const ahead = f.placed ? 10 + Math.random() * 8 : 3 + Math.random() * 14;
                const side = (Math.random() - 0.5) * 18;
                f.anchor.set(p.x + this.fwd.x * ahead - this.fwd.z * side, 0, p.z + this.fwd.z * ahead + this.fwd.x * side);
                f.placed = true;
            }
            const tt = t + f.p;
            const x = f.anchor.x + Math.sin(tt * f.a) * 2.6 + Math.sin(tt * 2.3) * 0.25;
            const z = f.anchor.z + Math.cos(tt * f.b) * 2.6 + Math.cos(tt * 1.9) * 0.25;
            const y = Math.max(groundY(x, z), 0.2) + 0.7 + Math.sin(tt * 1.3) * 0.35 + Math.abs(Math.sin(tt * 7)) * 0.08;
            const dx = x - f.pos.x, dz = z - f.pos.z;
            if (dx * dx + dz * dz > 1e-6) f.heading = Math.atan2(dx, dz);
            f.pos.set(x, y, z);
            q.setFromEuler(_e.set(0, f.heading, 0));
            M.compose(f.pos, q, s.setScalar(1.6 * (1 - night)));
            m.setMatrixAt(i, M);
        });
        m.instanceMatrix.needsUpdate = true;
    }

    _nearWater(p) {
        const f = featureIn(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
        if (!f || f.kind !== 'pond') return 0;
        return 1 - smoothstep(f.R, f.R + 16, Math.hypot(p.x - f.x, p.z - f.z));
    }

    /** Coming upon a pond or one of the special places: its name, and a note in your log the first time. */
    _places(p) {
        const ci = Math.floor(p.x / CELL), cj = Math.floor(p.z / CELL);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const f = featureIn(ci + di, cj + dj);
            if (!f) continue;
            const key = `${ci + di},${cj + dj}`;
            if (this.seen.has(key)) continue;
            const reach = f.kind === 'pond' ? f.R + 5 : f.r + 3;
            if (Math.hypot(p.x - f.x, p.z - f.z) > reach) continue;
            this.seen.add(key);
            const def = f.kind === 'pond' ? POND : f.def;
            const first = !this.log[def.id];
            this.log[def.id] = (this.log[def.id] || 0) + 1;
            store.set('forestLog', this.log);
            this.quietUntil = this.clock + 8;
            this.env.ui?.zone(def.name, def.sub, def.accent);
            if (first) {
                this.env.ui?.hint(`Found: ${def.name}. ${def.note}`, 8000);
                this.env.audio?.sparkle();
            }
            this._dash(true);
        }
    }

    _dash(all) {
        const d = this.dom, p = this.controls?.pos;
        if (!d.root || !p) return;
        const dx = this.home.x - p.x, dz = this.home.z - p.z;
        const far = Math.hypot(dx, dz);
        d.dist.textContent = far < 1000 ? `${Math.round(far)} m` : `${(far / 1000).toFixed(1)} km`;
        // the arrow points the way home, as seen from where you face
        const want = Math.atan2(-dx, -dz);
        const rel = ((want - this.controls.yaw) * 180) / Math.PI;
        d.arrow.style.transform = `rotate(${-rel}deg)`;
        if (all) d.found.textContent = `${ALL_PLACES.filter((x) => this.log[x.id]).length} / ${ALL_PLACES.length}`;
    }

    // ------------------------------------------------------------ touching things

    /** Where a ray meets the ground (or Infinity), marching over the hills. */
    _march(o, d, maxT = 90) {
        let prev = 0;
        for (let t = 0.4; t < maxT; t += t < 20 ? 0.3 : 0.7) {
            const x = o.x + d.x * t, z = o.z + d.z * t;
            if (o.y + d.y * t < Math.max(groundY(x, z), 0)) {
                let lo = prev, hi = t;
                for (let i = 0; i < 8; i++) {
                    const m = (lo + hi) / 2;
                    if (o.y + d.y * m < Math.max(groundY(o.x + d.x * m, o.z + d.z * m), 0)) hi = m;
                    else lo = m;
                }
                return hi;
            }
            prev = t;
        }
        return Infinity;
    }

    /** What a ray points at: { type: 'portal' | 'ground' | 'water', point, t } or null. */
    pick(ray) {
        const o = ray.ray.origin, d = ray.ray.direction;
        const tp = rayPortal(this.home, ray);
        const tg = this._march(o, d, Math.min(tp, 90));
        if (tp < tg && tp < 60) return { type: 'portal', t: tp };
        if (tg === Infinity) return null;
        const point = o.clone().addScaledVector(d, tg);
        return { type: groundY(point.x, point.z) < 0.35 ? 'water' : 'ground', point, t: tg };
    }

    /** A click: walk there, or into the door home. */
    tap(ray) {
        const h = this.pick(ray);
        if (!h) return null;
        if (h.type === 'portal') {
            const side = Math.sign(this.controls.pos.z - this.home.z) || 1;
            this.controls.walkTo([{ x: this.home.x, z: this.home.z + side * 2.2 }, { x: this.home.x, z: this.home.z - side * 1.2 }]);
        } else if (h.type === 'ground') this.controls.walkTo([{ x: h.point.x, z: h.point.z }]);
        return h;
    }

    hover(ray) {
        return this.pick(ray)?.type === 'portal';
    }

    stepSurface() {
        return 'grass';
    }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _e = new THREE.Euler();
