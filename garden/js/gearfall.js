// Gearfall: down the trap door behind the Great Gear, along the long hall to
// the vault door, and (if you know the code) out on to the dirt road to a
// derelict city that goes on for ever. Like the sea and the Springwood, the
// city is made in chunks as you walk (gearfall-land.js, gearfall-street.js,
// gearfall-rooms.js) and only the streets round about you are kept. Every
// building can be walked into. A skyline of the taller buildings is built
// once, so the towers stand in the haze ahead of you long before you reach
// them; and at the middle, the crater and the giant in it (gearfall-robot.js)
// glow for kilometres. Its own scene, drawn by the garden's composer, walked
// with the garden's controls, keeping the garden's time of day.

import * as THREE from 'three';
import { Acc, C, mat, cityMaterial, flick } from './gearfall-kit.js';
import { CHUNK, BLOCK, ROAD, DOOR_Z, HALL_W, HALL_D, CORR_W, CORR_L, CRATER_R, MIDTOWN, EDGE, zoneAt, groundY, lotPlan, groundMaterial, craterGeometry } from './gearfall-land.js';
import { buildChunk, signMaterial } from './gearfall-street.js';
import { Bunker, LADDER } from './gearfall-bunker.js';
import { Robot } from './gearfall-robot.js';
import { GearfallFX } from './gearfall-fx.js';
import { GearfallAudio } from './gearfall-audio.js';
import { Keypad } from './gearfall-ui.js';
import { clamp, damp, store, smoothstep, lerp, TAU } from './util.js';

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
export const CODE = '1337';

const TIER = {
    high: { R: 3, lights: 8, papers: 70, ash: 500, motes: 240 },
    medium: { R: 2, lights: 6, papers: 50, ash: 340, motes: 160 },
    low: { R: 2, lights: 4, papers: 30, ash: 200, motes: 90 },
};

export const PLACES = [
    { id: 'hall', name: 'The Long Hall', sub: 'Pipes, steam and dying lamps', accent: '#d8b070', note: 'Something down here still has power, just.' },
    { id: 'door', name: 'The Vault Door', sub: 'It still remembers its code', accent: '#7aff9a', note: 'The door is open. It will stay open for you now.' },
    { id: 'road', name: 'The Dirt Road', sub: 'Across the wasteland to the city', accent: '#c8a878', note: 'Follow the road and the poles. The city is that way, under the glow.' },
    { id: 'outskirts', name: 'The Outskirts', sub: 'Little houses with their doors hanging open', accent: '#b8a890', note: 'Every door is open. Go in, if you dare.' },
    { id: 'midtown', name: 'Midtown', sub: 'Shops, flats and warehouses, all empty', accent: '#e0a070', note: 'Some of the signs still flicker.' },
    { id: 'downtown', name: 'Downtown', sub: 'Towers, some of them broken off short', accent: '#a0b8c8', note: 'The nearer the glow, the worse the damage.' },
    { id: 'crater', name: 'The Crater', sub: 'Where something very large came down', accent: '#6affd0', note: 'The ground here is glass, and it glows.' },
    { id: 'robot', name: 'Unit 1337', sub: 'The giant in the crater, its gears spilled out', accent: '#ffb050', note: 'It is still warm. One eye is still lit.' },
];
const PLACE = Object.fromEntries(PLACES.map((p) => [p.id, p]));

const DOME_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }';
const DOME_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uFog; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight; uniform vec3 uCrater; uniform float uGlow;
varying vec3 vDir;
void main() {
    vec3 d = normalize(vDir);
    vec3 c = d.y > 0.0 ? mix(uFog, uTop, smoothstep(0.0, 0.55, d.y)) : uFog;
    float s = clamp(dot(d, uSunDir), 0.0, 1.0);
    c += uSunCol * (pow(s, 700.0) * 1.6 + pow(s, 8.0) * 0.18) * (1.0 - uNight);
    // the crater's glow on the haze, low in its direction
    // (straight up, the horizontal part is zero: normalize() of it would be NaN)
    vec2 hz = d.xz / max(length(d.xz), 1e-4);
    float k = clamp(dot(vec3(hz.x, 0.0, hz.y), uCrater), 0.0, 1.0);
    c += vec3(0.25, 0.85, 0.7) * pow(k, 6.0) * pow(1.0 - clamp(d.y, 0.0, 1.0), 6.0) * uGlow;
    if (uNight > 0.01 && d.y > 0.0) {
        vec3 p = floor(d * 240.0);
        float h = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        c += step(0.9978, h) * uNight * smoothstep(0.1, 0.4, d.y) * vec3(0.8, 0.8, 0.75) * (0.4 + fract(h * 91.0) * 0.5);
    }
    gl_FragColor = vec4(c, 1.0);
    if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(uFog, 1.0);
}`;

// at night the sky still gives a cold, moonlit fill, so the streets read as shapes, not black
const MOON_FILL = C('#8e9ab8'), MOON_GROUND = C('#5c5e6a'), DAY_GROUND = C('#4a4034');
const HAZE_DAY = C('#a89a80'), HAZE_NIGHT = C('#252633'), TOP_DAY = C('#8a9098'), TOP_NIGHT = C('#0b0d17'), HALL_FOG = C('#1a1814');

export class Gearfall {
    /** @param {object} env { renderer, audio (AudioEngine), ui, quality } */
    constructor(env) {
        this.env = env;
        this.cfg = TIER[env.quality?.tier] || TIER.high;
        this.inside = false;
        this.scene = new THREE.Scene();
        this.fogColor = HAZE_DAY.clone();
        this.scene.background = this.fogColor;
        this.scene.fog = new THREE.FogExp2(this.fogColor, 0.004);
        this.uni = { uTime: { value: 0 }, uWind: { value: 1 }, uNight: { value: 0 }, uInDim: { value: 0.24 }, uSky: { value: C('#8a9098') } };
        this.mat = cityMaterial(this.uni);
        this.signMat = signMaterial(this.uni);
        this.chunks = new Map();
        this.queue = [];
        this.ci = this.cj = null;
        this.grid = new Map();
        this.staticCols = [];
        this.log = store.get('gearfallLog', {});
        this.clock = 0;
        this.fwd = new V3(0, 0, -1);
        this.sound = env.audio ? new GearfallAudio(env.audio) : null;
        this._lights();
        this._sky();
        this._ground();
        this.bunker = new Bunker({ scene: this.scene, material: this.mat, signMat: this.signMat });
        this.robot = new Robot({ scene: this.scene, material: this.mat });
        for (const c of [...this.bunker.cols, ...this.robot.cols]) this._addCol(c, null);
        this._skyline();
        this.fx = new GearfallFX(this.scene, this.cfg);
        this._dom();
        if (store.get('gearfallOpen', false)) this.bunker.unlock(true);

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: () => 1 },
            walkHeight: (x, z) => groundY(x, z),
            onDeck: () => false,
            collidersNear: (x, z) => self._collidersNear(x, z),
            onArrive: (r) => r?.then?.(),
        };
    }

    // ------------------------------------------------------------ building the view

    _lights() {
        this.hemi = new THREE.HemisphereLight(0xbcc0c4, 0x4a4034, 0.9);
        this.sun = new THREE.DirectionalLight(0xffe8c8, 1.6);
        this.sun.position.set(0.4, 1, 0.3);
        this.scene.add(this.hemi, this.sun, this.sun.target);
        // a pool of point lights, moved to the nearest working lamps
        this.pool = [];
        for (let i = 0; i < this.cfg.lights; i++) {
            const l = new THREE.PointLight(0xffd8a0, 0, 8, 1.6);
            l.userData.src = null;
            this.scene.add(l);
            this.pool.push(l);
        }
        this.poolTimer = 0;
    }

    _sky() {
        this.domeU = { uTop: { value: TOP_DAY.clone() }, uFog: { value: this.fogColor }, uSunDir: { value: new V3(0.3, 0.8, 0.2).normalize() }, uSunCol: { value: C('#ffe0b0') }, uNight: { value: 0 }, uCrater: { value: new V3(0, 0, -1) }, uGlow: { value: 0.3 } };
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({ uniforms: this.domeU, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
        this.dome.renderOrder = -10;
        this.dome.frustumCulled = false;
        this.scene.add(this.dome);
    }

    _ground() {
        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800, 1, 1).rotateX(-Math.PI / 2), groundMaterial(this.uni, CRATER_R - 1.5));
        this.plane.frustumCulled = false;
        this.crater = new THREE.Mesh(craterGeometry(), groundMaterial(this.uni, 0));
        this.scene.add(this.plane, this.crater);
    }

    /** The taller buildings as plain boxes, built once, so the city has a skyline beyond the chunks. */
    _skyline() {
        const acc = new Acc();
        const n = Math.ceil((MIDTOWN + 40) / BLOCK);
        for (let bj = -n; bj <= n; bj++) for (let bi = -n; bi <= n; bi++) {
            const p = lotPlan(bi, bj);
            for (const b of p.items) {
                if (b.type !== 'bld' || b.H < 14) continue;
                const top = b.damaged ? b.gH + (b.H - b.gH) * 0.5 : b.H;
                acc.box(b.w - 0.14, top - b.gH - 0.4, b.d - 0.14, mat(b.x, b.gH + 0.3, b.z, b.yaw), { color: C(b.color).multiplyScalar(0.85), win: b.win, seed: b.seed });
            }
        }
        this.skyline = new THREE.Mesh(acc.build(), this.mat);
        this.skyline.frustumCulled = false;
        this.scene.add(this.skyline);
    }

    _dom() {
        this.dom = { root: $('city-hud'), dist: $('city-dist'), arrow: $('city-arrow'), found: $('city-found'), home: $('city-home') };
        this.dom.home?.addEventListener('click', () => {
            this.env.audio?.click();
            this.onExit?.();
        });
        this.keypad = new Keypad();
        this.keypad.check = (c) => c === CODE;
        this.keypad.onBeep = (n) => this.sound?.beep(n);
        this.keypad.onDenied = () => {
            this.sound?.denied();
            this.env.ui?.hint('ACCESS DENIED · the code must be written down somewhere', 4000);
        };
        this.keypad.onGranted = () => this.sound?.granted();
        this.keypad.onOpen = () => this.openDoor();
        this.keypad.onClose = () => {
            if (this.controls) this.controls.enabled = true;
        };
    }

    // ------------------------------------------------------------ in and out

    /** Down the ladder into the long hall: the land round about is built at once. */
    enter(controls) {
        this.controls = controls;
        controls.world = this.world;
        const s = this.bunker.spawn;
        controls.teleport(s.x, s.z, s.yaw);
        this.inside = true;
        this.armed = false;
        this.fwd.set(0, 0, -1);
        this._chunks(controls.pos, true);
        this.zone = 'hall';
        this.zoneNext = null;
        this.zoneTimer = 1;
        this.quietUntil = this.clock + 6;
        this.dashTimer = 0;
        this.poolTimer = 0;
        if (this.dom.root) this.dom.root.hidden = false;
        document.body.classList.add('in-city');
        this._dash(true);
        this.sound?.start();
        this._found('hall', true);
    }

    /** Back up the ladder: the city is let go, to be made again next time. */
    leave() {
        if (!this.inside) return;
        this.inside = false;
        this.keypad.close();
        if (this.dom.root) this.dom.root.hidden = true;
        document.body.classList.remove('in-city');
        this.sound?.stop();
        for (const ch of this.chunks.values()) this._drop(ch);
        this.chunks.clear();
        this.queue = [];
        this.ci = this.cj = null;
        for (const l of this.pool) {
            l.intensity = 0;
            l.userData.src = null;
        }
    }

    // ------------------------------------------------------------ the endless city

    _chunks(p, sync) {
        const R = this.cfg.R;
        const ci = Math.floor(p.x / CHUNK), cj = Math.floor(p.z / CHUNK);
        if (!sync && ci === this.ci && cj === this.cj) return;
        this.ci = ci;
        this.cj = cj;
        for (const [key, ch] of this.chunks) {
            if ((ch.i - ci) ** 2 + (ch.j - cj) ** 2 > (R + 1) ** 2) {
                this._drop(ch);
                this.chunks.delete(key);
            }
        }
        const list = [];
        for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
            if (di * di + dj * dj > (R + 0.5) ** 2) continue;
            const key = `${ci + di},${cj + dj}`;
            if (!this.chunks.has(key)) list.push({ key, i: ci + di, j: cj + dj, d: di * di + dj * dj - (di * this.fwd.x + dj * this.fwd.z) * 1.5 });
        }
        list.sort((a, b) => a.d - b.d);
        this.queue = list;
        if (sync) while (this.queue.length) this._buildNext();
    }

    _buildNext() {
        const q = this.queue.shift();
        if (!q || this.chunks.has(q.key)) return;
        const ch = buildChunk(q.i, q.j, this.mat, this.signMat);
        ch.i = q.i;
        ch.j = q.j;
        ch.key = q.key;
        ch.cells = [];
        this.scene.add(ch.mesh);
        if (ch.signs) this.scene.add(ch.signs);
        for (const c of ch.cols) this._addCol(c, ch);
        this.chunks.set(q.key, ch);
    }

    _drop(ch) {
        this.scene.remove(ch.mesh);
        ch.mesh.geometry?.dispose();
        if (ch.signs) {
            this.scene.remove(ch.signs);
            ch.signs.geometry.dispose();
        }
        for (const k of ch.cells) {
            const list = this.grid.get(k);
            if (!list) continue;
            const kept = list.filter((c) => c.ch !== ch);
            if (kept.length) this.grid.set(k, kept);
            else this.grid.delete(k);
        }
    }

    /** Colliders go in a grid of 4 m cells, padded by your own radius so the cell you stand in has all you can touch. */
    _addCol(c, ch) {
        const pad = c.r + 0.35;
        const i0 = Math.floor((c.x - pad) / 4), i1 = Math.floor((c.x + pad) / 4);
        const j0 = Math.floor((c.z - pad) / 4), j1 = Math.floor((c.z + pad) / 4);
        c.ch = ch;
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const k = i * 100003 + j;
            let list = this.grid.get(k);
            if (!list) this.grid.set(k, (list = []));
            list.push(c);
            ch?.cells.push(k);
        }
    }

    _collidersNear(x, z) {
        const list = this.grid.get(Math.floor(x / 4) * 100003 + Math.floor(z / 4)) || EMPTY;
        if (this.bunker.blocking && Math.abs(z - DOOR_Z) < 4 && Math.abs(x) < 6) return list.concat(this.bunker.doorCols);
        return list;
    }

    // ------------------------------------------------------------ the door

    /** The right code: the door opens, and stays open from now on. */
    openDoor() {
        if (this.bunker.state !== 'locked') return;
        this.bunker.unlock();
        store.set('gearfallOpen', true);
        this.sound?.opening();
        this.env.ui?.hint('ACCESS GRANTED · the great gear turns, the bolts draw back…', 6000);
        this.doorShown = false;
    }

    // ------------------------------------------------------------ frame

    /** `sky` is the garden sky's state: { sunDir, moonDir, zenith, horizon, sunColor, night, sunElev }. */
    update(dt, t, camera, sky) {
        if (!this.inside) return;
        this.clock += dt;
        const tt = this.clock % 600;
        this.uni.uTime.value = tt;
        const p = this.controls.pos;
        this.fwd.set(-Math.sin(this.controls.yaw), 0, -Math.cos(this.controls.yaw));
        this._chunks(p, false);
        if (this.queue.length) this._buildNext();
        const night = sky?.night ?? 0;
        const hall = p.z > DOOR_Z - 0.5 && Math.abs(p.x) < HALL_W / 2 + 1;
        this.indoor = damp(this.indoor ?? 1, hall ? 1 : this._inBuilding(p.x, p.z) ? 0.75 : 0, 3, dt);
        this._env(dt, camera, sky, night);
        const door = this.bunker.update(dt, tt);
        if (door && door.slide > 0.02 && !this.doorShown) {
            this.doorShown = true;
            this._found('door');
        }
        this.robot.update(dt, tt, flick);
        this._pool(dt, tt, p);

        // the ladder home
        const ld = Math.hypot(p.x - LADDER.x, p.z - LADDER.z);
        if (ld > 1.5) this.armed = true;
        else if (ld < 0.55 && this.armed) {
            this.armed = false;
            this.onExit?.();
            return;
        }
        if (!this.keypadHint && Math.hypot(p.x - this.bunker.keypadAt.x, p.z - this.bunker.keypadAt.z) < 7 && this.bunker.state === 'locked') {
            this.keypadHint = true;
            this.env.ui?.hint('The vault door is locked · a keypad glows on the post beside it · click it to enter a code', 7000);
        }

        // where you are
        this.zoneTimer -= dt;
        if (this.zoneTimer <= 0) {
            this.zoneTimer = 0.6;
            this._where(p);
        }
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
            this.dashTimer = 0.2;
            this._dash();
        }
        const d = Math.hypot(p.x, p.z);
        const gust = smoothstep(0.3, 1, Math.sin(t * 0.31) * 0.5 + 0.5);
        this.uni.uWind.value = 0.6 + gust * 1.2;
        this.sound?.update(hall ? 1 : this.indoor * 0.6, 1 - smoothstep(40, 200, d), this.buzz || 0, gust);
        // the air
        const vents = [], fires = [];
        for (const s of this.bunker.steam) if (Math.abs(s.z - p.z) < 25 && Math.abs(s.x - p.x) < 25) vents.push(s);
        for (const ch of this.chunks.values()) {
            if (Math.abs(ch.i * CHUNK + CHUNK / 2 - p.x) > 60 || Math.abs(ch.j * CHUNK + CHUNK / 2 - p.z) > 60) continue;
            for (const f of ch.fires) if (Math.abs(f.x - p.x) < 30 && Math.abs(f.z - p.z) < 30) fires.push(f);
            for (const s of ch.steam) if (Math.abs(s.x - p.x) < 25 && Math.abs(s.z - p.z) < 25) vents.push(s);
        }
        const sunUp = clamp((sky?.sunElev ?? 0.5) * 3, 0, 1) * (1 - night);
        this.fx.update(dt, tt, camera.position, groundY(p.x, p.z), hall ? 0.15 : 0.2 + 0.8 * sunUp, hall ? 1 : this.indoor, this.env.renderer.domElement.height * 0.5, vents, fires);
    }

    /** Whether (x, z) is under a roof in the city (for the papers and the wind). */
    _inBuilding(x, z) {
        const bi = Math.floor(x / BLOCK), bj = Math.floor(z / BLOCK);
        for (const b of lotPlan(bi, bj).items) {
            if (b.type !== 'bld') continue;
            const dx = x - b.x, dz = z - b.z;
            const lx = dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw), lz = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
            if (Math.abs(lx) < b.w / 2 && Math.abs(lz) < b.d / 2) return true;
        }
        return false;
    }

    /** Light and haze from the garden's time of day: browner, dustier, darker. */
    _env(dt, camera, sky, night) {
        const day = 1 - night;
        const sunUp = clamp((sky?.sunElev ?? 0.5) * 3, 0, 1);
        const cam = camera.position;
        this.fogColor.copy(HAZE_DAY).lerp(HAZE_NIGHT, night);
        if (sky) {
            this.fogColor.lerp(sky.horizon, 0.18 * day);
            this.domeU.uTop.value.copy(TOP_DAY).lerp(sky.zenith, 0.3).lerp(TOP_NIGHT, night);
            this.domeU.uSunCol.value.copy(sky.sunColor);
            if (sky.sunElev > -0.05) {
                this.domeU.uSunDir.value.copy(sky.sunDir);
                this.sun.position.copy(sky.sunDir);
                this.sun.color.copy(sky.sunColor).lerp(C('#e8c8a0'), 0.4);
            } else {
                this.sun.position.copy(sky.moonDir);
                this.sun.color.set(0x9eaccc);
            }
        }
        // the long hall is dark and close; the city's haze thins out across the wasteland
        const hall = this.indoor > 0.9 && cam.z > DOOR_Z - 1 ? 1 : 0;
        this.hallK = damp(this.hallK ?? 1, hall, 2, dt);
        this.fogColor.lerp(HALL_FOG, this.hallK * 0.85);
        const d = Math.hypot(cam.x, cam.z);
        this.scene.fog.density = lerp(lerp(0.0042, 0.0016, smoothstep(500, 1250, d)), 0.012, this.hallK);
        this.domeU.uNight.value = night;
        if (Math.hypot(cam.x, cam.z) > 1e-3) this.domeU.uCrater.value.set(-cam.x, 0, -cam.z).normalize();
        this.domeU.uGlow.value = (0.25 + night * 0.9) * (1 - smoothstep(900, 2200, d));
        this.uni.uNight.value = night;
        this.uni.uSky.value.copy(this.domeU.uTop.value).lerp(this.fogColor, 0.5);
        this.hemi.color.copy(this.domeU.uTop.value).lerp(C('#c8c0b0'), 0.4).lerp(MOON_FILL, night);
        this.hemi.groundColor.copy(DAY_GROUND).lerp(MOON_GROUND, night);
        this.hemi.intensity = lerp(0.78, 1.07, day);
        this.sun.intensity = sky?.sunElev > -0.05 ? 1.7 * sunUp * day : 0.75 * night;
        this.dome.position.copy(cam);
        this.plane.position.set(Math.round(cam.x / 20) * 20, 0, Math.round(cam.z / 20) * 20);
        this.robot.columnU.uAmount.value = 0.55 + night * 0.6;
    }

    /** Point the pool of lights at the nearest working lamps, and flicker them with their lamps. */
    _pool(dt, t, p) {
        this.poolTimer -= dt;
        if (this.poolTimer <= 0) {
            this.poolTimer = 0.3;
            const cand = [];
            const near = (l) => {
                const d = (l.x - p.x) ** 2 + (l.z - p.z) ** 2 + (l.y - p.y - 1.6) ** 2 * 0.5;
                if (d < 50 * 50) cand.push({ l, d });
            };
            for (const l of this.bunker.lights) near(l);
            for (const ch of this.chunks.values()) {
                if (Math.abs(ch.i * CHUNK + CHUNK / 2 - p.x) > 100 || Math.abs(ch.j * CHUNK + CHUNK / 2 - p.z) > 100) continue;
                for (const l of ch.lights) near(l);
            }
            cand.sort((a, b) => a.d - b.d);
            this.pool.forEach((L, i) => {
                const c = cand[i];
                L.userData.src = c ? c.l : null;
                if (c) {
                    L.position.set(c.l.x, c.l.y, c.l.z);
                    L.color.set(c.l.color);
                    L.distance = c.l.range;
                }
            });
        }
        let buzz = 0;
        for (const L of this.pool) {
            const s = L.userData.src;
            if (!s) {
                L.intensity = 0;
                continue;
            }
            const k = s.fire ? 0.75 + 0.25 * Math.sin(t * 13 + s.x) * Math.sin(t * 7.3 + s.z) : s.flick ? flick(t, s.flick) : 1;
            L.intensity = k * s.power * 9;
            if (s.flick) {
                const d = Math.hypot(s.x - p.x, s.z - p.z, s.y - p.y - 1.5);
                buzz = Math.max(buzz, (1 - smoothstep(1.5, 9, d)) * (k > 0.5 ? 1 : 0.2));
            }
        }
        this.buzz = buzz;
    }

    _found(id, quiet = false) {
        const def = PLACE[id];
        if (!def) return;
        const first = !this.log[id];
        this.log[id] = (this.log[id] || 0) + 1;
        store.set('gearfallLog', this.log);
        if (!quiet || first) this.env.ui?.zone(def.name, def.sub, def.accent);
        if (first && !quiet) {
            this.env.ui?.hint(`Found: ${def.name}. ${def.note}`, 7000);
            this.env.audio?.sparkle();
        }
        this.quietUntil = this.clock + 6;
        this._dash(true);
    }

    /** Which part of the city you are in, with a banner when it changes. */
    _where(p) {
        let z = p.z > DOOR_Z - 0.5 && Math.abs(p.x) < HALL_W / 2 + 1 ? 'hall' : zoneAt(p.x, p.z);
        if (z === 'waste' && Math.abs(p.x) < 40 && p.z > EDGE - 20 && p.z < DOOR_Z) z = 'road';
        if (z === 'crater' && Math.hypot(p.x, p.z + 2) < 48 && !this.robotSeen) {
            this.robotSeen = true;
            this._found('robot');
        }
        if (z === this.zone) {
            this.zoneNext = null;
            return;
        }
        if (z !== this.zoneNext) {
            this.zoneNext = z;
            return;
        }
        this.zone = z;
        this.zoneNext = null;
        if (z === 'waste') this.env.ui?.zone('The Wasteland', 'Dead ground, as far as you can see', '#a89070');
        else if (PLACE[z]) {
            if (!this.log[z]) this._found(z);
            else if (this.clock > this.quietUntil) this.env.ui?.zone(PLACE[z].name, PLACE[z].sub, PLACE[z].accent);
        }
    }

    _dash(all) {
        const d = this.dom, p = this.controls?.pos;
        if (!d.root || !p) return;
        const dx = LADDER.x - p.x, dz = LADDER.z - p.z;
        const far = Math.hypot(dx, dz);
        d.dist.textContent = far < 1000 ? `${Math.round(far)} m` : `${(far / 1000).toFixed(1)} km`;
        const want = Math.atan2(-dx, -dz);
        const rel = ((want - this.controls.yaw) * 180) / Math.PI;
        d.arrow.style.transform = `rotate(${-rel}deg)`;
        if (all) d.found.textContent = `${PLACES.filter((x) => this.log[x.id]).length} / ${PLACES.length}`;
    }

    // ------------------------------------------------------------ touching things

    _march(o, dir, maxT = 120) {
        let prev = 0;
        for (let t = 0.3; t < maxT; t += t < 20 ? 0.3 : 0.8) {
            const x = o.x + dir.x * t, z = o.z + dir.z * t;
            if (o.y + dir.y * t < groundY(x, z)) {
                let lo = prev, hi = t;
                for (let i = 0; i < 8; i++) {
                    const m = (lo + hi) / 2;
                    if (o.y + dir.y * m < groundY(o.x + dir.x * m, o.z + dir.z * m)) hi = m;
                    else lo = m;
                }
                return hi;
            }
            prev = t;
        }
        return Infinity;
    }

    /** What a ray points at: { type: 'keypad' | 'ladder' | 'robot' | 'door' | 'ground' | 'wall', point, t } or null. */
    pick(ray, solid = false) {
        const b = this.bunker;
        const hits = ray.intersectObjects([b.keypadHit, b.ladderHit, ...(b.state === 'locked' ? [b.doorHit] : []), ...this.robot.hits], false);
        const h = hits[0];
        let best = h ? { type: h.object.userData.kind, t: h.distance, point: h.point } : null;
        if (best && best.type === 'robot' && best.t > 140) best = null;
        if (best && best.type !== 'robot' && best.t > 30) best = null;
        // walls and things in the way (only for clicks: it is costly)
        if (solid) {
            const meshes = [this.bunker.mesh];
            for (const ch of this.chunks.values()) if (Math.abs(ch.i - this.ci) <= 1 && Math.abs(ch.j - this.cj) <= 1 && ch.mesh.isMesh) meshes.push(ch.mesh);
            const w = ray.intersectObjects(meshes, false)[0];
            if (w && (!best || w.distance < best.t) && w.distance < 120) {
                const tg = this._march(ray.ray.origin, ray.ray.direction, w.distance + 0.5);
                if (tg > w.distance - 0.05) best = { type: 'wall', t: w.distance, point: w.point };
            }
        }
        const tg = this._march(ray.ray.origin, ray.ray.direction, Math.min(best?.t ?? 120, 120));
        if (tg < (best?.t ?? Infinity)) return { type: 'ground', point: ray.ray.origin.clone().addScaledVector(ray.ray.direction, tg), t: tg };
        return best;
    }

    /** A click: walk there, use the keypad, climb the ladder, touch the giant. */
    tap(ray) {
        const h = this.pick(ray, true);
        if (!h) return null;
        const c = this.controls, p = c.pos;
        if (h.type === 'keypad') {
            const k = this.bunker.keypadAt;
            const stand = { x: k.x - 0.4, z: k.z + 1.3 };
            if (this.bunker.state !== 'locked') this.env.ui?.hint('The keypad’s screen reads OPEN', 3000);
            else if (Math.hypot(p.x - stand.x, p.z - stand.z) < 2.4) this.useKeypad();
            else {
                c.walkTo([stand]);
                c.route.then = () => this.useKeypad();
            }
        } else if (h.type === 'door') {
            this.env.ui?.hint('A blast door, locked by a great gear · the keypad beside it wants a code', 4000);
        } else if (h.type === 'ladder') {
            this.armed = true;
            c.walkTo([{ x: LADDER.x, z: LADDER.z - 1.4 }, { x: LADDER.x, z: LADDER.z }]);
        } else if (h.type === 'robot') {
            this.robot.poke();
            this.sound?.robot();
            const say = ROBOT_SAYS[(this.pokes = (this.pokes || 0) + 1) % ROBOT_SAYS.length];
            this.env.ui?.hint(say, 5000);
            if (!this.log.robot) this._found('robot');
        } else if (h.type === 'wall') {
            // walk up to it
            const d = ray.ray.direction;
            const back = Math.max(0, h.t - 0.7) / Math.max(h.t, 1e-3);
            const o = ray.ray.origin;
            c.walkTo([{ x: o.x + (h.point.x - o.x) * back, z: o.z + (h.point.z - o.z) * back }]);
            h.point.set(o.x + d.x * h.t * back, h.point.y, o.z + d.z * h.t * back);
        } else if (h.type === 'ground') c.walkTo([{ x: h.point.x, z: h.point.z }]);
        return h;
    }

    useKeypad() {
        if (this.bunker.state !== 'locked' || this.keypad.open) return;
        this.controls.keys.clear();
        this.controls.route = null;
        this.controls.enabled = false;
        this.keypad.show();
        this.env.audio?.click();
    }

    /** The hover card for what the pointer is over, or null. */
    hover(ray) {
        const h = this.pick(ray);
        if (!h) return null;
        if (h.type === 'keypad') return this.bunker.state === 'locked' ? { icon: '🔢', kicker: 'The vault door', title: 'A keypad', desc: 'Its screen glows green: ENTER CODE. Four digits.', cta: 'Click to use it →', accent: '#7aff9a' } : { icon: '🔓', kicker: 'The vault door', title: 'The keypad', desc: 'Its screen reads OPEN.', accent: '#7aff9a' };
        if (h.type === 'door') return { icon: '⚙️', kicker: 'Sublevel 7', title: 'The vault door', desc: 'A blast door eight metres high, locked by a great gear. The keypad beside it wants a code.', accent: '#d8b070' };
        if (h.type === 'ladder') return { icon: '🪜', kicker: 'The way home', title: 'The ladder', desc: 'Up through the trap door to the Great Gear in the garden.', cta: 'Click or walk to it →', accent: '#d8b070' };
        if (h.type === 'robot') return { icon: '🤖', kicker: 'The crater', title: 'Unit 1337', desc: 'A giant, rusted where it fell, its chest torn open and its gears spilled out. Something inside it still glows.', cta: 'Click to touch it →', accent: '#ffb050' };
        return null;
    }

    /** What your feet are on, for the footsteps. */
    stepSurface() {
        const p = this.controls?.pos;
        if (!p) return 'stone';
        if (p.z > DOOR_Z - 0.5 && Math.abs(p.x) < HALL_W / 2 + 1) return Math.abs(p.x) < 0.8 && p.z > DOOR_Z + HALL_D ? 'metal' : 'stone';
        if (this._inBuilding(p.x, p.z)) return 'wood';
        const g = Math.abs(p.x - Math.round(p.x / BLOCK) * BLOCK), h = Math.abs(p.z - Math.round(p.z / BLOCK) * BLOCK);
        return Math.min(g, h) < ROAD && Math.hypot(p.x, p.z) < EDGE ? 'stone' : 'grass';
    }
}

const EMPTY = [];
const ROBOT_SAYS = [
    'You lay a hand on the giant. The iron is warm, and somewhere deep inside it something ticks, once',
    'A groan runs through the whole body of it, and a few more gears slide out of its chest',
    'Its one good eye brightens, just for a moment, as if it had seen you',
    'UNIT 1337, says the stencil on its chest. Someone built this. Someone knew the code',
];
