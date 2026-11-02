// Inside the tiny submarine from the Moon Fountain: you look out through a
// great round porthole at a sea that goes on for ever. The floor is made in
// chunks as you go (sea-reef.js) and the animals are spawned ahead of you in
// the murk (sea-life.js), so there is always more to find. Steer with the
// keys or the helm, drag to look about, and click any animal for its card;
// every kind you meet goes into your sea log. Its own scene, drawn by the
// garden's composer, like the view through the Observatory's telescope.

import * as THREE from 'three';
import { CHUNK, seabedY, biomeAt, dominant, buildChunk, reefMaterial } from './sea-reef.js';
import { SeaLife, SEA_LIFE } from './sea-life.js';
import { SeaAudio } from './sea-audio.js';
import { WONDERS, wonderAt, buildWonder } from './sea-wonders.js';
import { clamp, damp, store, TAU } from './util.js';

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const C = (h) => new THREE.Color(h);

const SPEEDS = [-1.0, 0, 1.4, 3.0, 5.2];
const TELEGRAPH = ['Astern', 'All stop', 'Slow ahead', 'Half ahead', 'Full ahead'];
const SUB_R = 1.6;        // how close the hull may come to a rock
const CLEAR = 2.6;        // how close to the floor it will go
const CEILING = -1.8;     // it never breaks the surface

const ZONES = {
    reef: ['The Coral Gardens', 'Branches, brains and fans in every colour', '#ff9ac0'],
    kelp: ['The Kelp Forest', 'Golden light through swaying stalks', '#c8d86a'],
    sand: ['The Sand Flats', 'Seagrass, starfish and open water', '#f0dca0'],
    rock: ['The Stone Arches', 'Old rock, worn into doorways', '#a8c8e0'],
};

const SHALLOW = C('#2b93b8'), DEEP = C('#0a3552'), NIGHT = C('#03101e');
const TOP_DAY = C('#62c8ea'), TOP_NIGHT = C('#14283e');

const TIER = {
    high: { R: 3, density: 1, snow: 1800 },
    medium: { R: 3, density: 0.8, snow: 1200 },
    low: { R: 2, density: 0.55, snow: 700 },
};

function bubbleTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 10, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,0.05)');
    grd.addColorStop(0.75, 'rgba(220,250,255,0.35)');
    grd.addColorStop(0.92, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(32, 32, 30, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(23, 22, 5, 0, TAU);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Undersea {
    /** @param {object} env { renderer, audio (AudioEngine), ui, canvas, quality } */
    constructor(env) {
        this.env = env;
        this.cfg = TIER[env.quality?.tier] || TIER.high;
        this.active = false;
        this.scene = new THREE.Scene();
        this.fogColor = SHALLOW.clone();
        this.scene.background = this.fogColor;
        // linear murk that is complete just inside the edge of the floor that is built
        this.scene.fog = new THREE.Fog(this.fogColor, 6, this.cfg.R * CHUNK - 10);
        this.scene.fog.color = this.fogColor;   // Fog copies the colour it is given; share ours so it follows depth and night
        this.uni = { uTime: { value: 0 }, uCaustic: { value: 1 }, uGlow: { value: 0.2 } };
        this.reefMat = reefMaterial(this.uni);
        this.chunks = new Map();
        this.queue = [];
        this.ci = this.cj = null;
        this.log = store.get('seaLog', {});
        this.sub = { pos: new V3(0, -6, 0), yaw: 0, speed: 0, throttle: 2, vy: 0, turn: 0 };
        this.look = { yaw: 0, pitch: 0, at: 0 };
        this.fwd = new V3(0, 0, -1);
        this.keys = new Set();
        this.hold = { left: 0, right: 0, up: 0, down: 0 };
        this.drag = null;
        this.lampOn = false;
        this.ray = new THREE.Raycaster();
        this.camera = null;
        this.clock = 0;
        this.sound = env.audio ? new SeaAudio(env.audio) : null;
        this._lights();
        this._sky();
        this._rays();
        this._snow();
        this._bubbles();
        this.life = new SeaLife(this.scene, env.quality?.tier, (x, z, r) => this.anemonesNear(x, z, r));
        this.life.onWhale = (w) => this.sound?.whale(0.7);
        this._dom();
        this._input();
    }

    // ------------------------------------------------------------ building the view

    _lights() {
        this.hemi = new THREE.HemisphereLight(0x8fd8ff, 0x16343c, 1.1);
        this.sun = new THREE.DirectionalLight(0xb8ecff, 1.2);
        this.sun.position.set(0.3, 1, 0.2);
        this.lamp = new THREE.SpotLight(0xfff0d0, 0, 46, 0.55, 0.55, 1.3);
        this.scene.add(this.hemi, this.sun, this.sun.target, this.lamp, this.lamp.target);
    }

    _sky() {
        // a dome of water light: bright overhead, the murk at the horizon, dark below
        this.domeU = { uTop: { value: TOP_DAY.clone() }, uFog: { value: this.fogColor }, uDeep: { value: new THREE.Color() } };
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
            uniforms: this.domeU,
            vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
            fragmentShader: `uniform vec3 uTop; uniform vec3 uFog; uniform vec3 uDeep; varying vec3 vDir;
void main(){ float y = normalize(vDir).y;
vec3 c = y > 0.0 ? mix(uFog, uTop, smoothstep(0.05, 0.95, y)) : mix(uFog, uDeep, 1.0 - smoothstep(-0.6, -0.12, y));
gl_FragColor = vec4(c, 1.0); }`,
            side: THREE.BackSide, depthWrite: false, fog: false,
        }));
        this.dome.renderOrder = -10;
        this.dome.frustumCulled = false;
        this.scene.add(this.dome);

        // the underside of the waves, rippling, brightest straight up (Snell's window)
        this.surfU = { uTime: this.uni.uTime, uTop: this.domeU.uTop, uFog: this.domeU.uFog, uFar: { value: this.cfg.R * CHUNK - 10 }, uBright: { value: 1 } };
        this.surface = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
            uniforms: this.surfU,
            vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: `uniform float uTime; uniform vec3 uTop; uniform vec3 uFog; uniform float uFar; uniform float uBright; varying vec3 vW;
void main(){
    vec2 p = vW.xz * 0.09;
    float w = sin(p.x * 3.1 + uTime * 0.9 + sin(p.y * 2.3 + uTime * 0.6)) * sin(p.y * 2.7 - uTime * 0.7 + sin(p.x * 1.9 - uTime * 0.4));
    vec3 dir = normalize(vW - cameraPosition);
    float win = smoothstep(0.55, 0.9, dir.y);
    vec3 c = uTop * (0.72 + 0.3 * w) * (0.55 + 1.0 * win) * uBright;
    float d = distance(vW, cameraPosition);
    float f = smoothstep(0.0, uFar * 2.2, d);
    gl_FragColor = vec4(mix(c, uFog, f), 1.0);
}`,
            side: THREE.DoubleSide, fog: false,
        }));
        this.surface.frustumCulled = false;
        this.scene.add(this.surface);
    }

    _rays() {
        // shafts of sunlight hanging from the surface, drifting past as you go
        this.rayU = { uOpacity: { value: 0.3 }, uTime: this.uni.uTime, uColor: { value: C('#bff4ff') } };
        const geo = new THREE.PlaneGeometry(1, 1, 1, 6).translate(0, -0.5, 0);
        this.rayList = [];
        for (let i = 0; i < 12; i++) {
            const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
                uniforms: { ...this.rayU, uSeed: { value: Math.random() } },
                vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vD = distance(w.xyz, cameraPosition); gl_Position = projectionMatrix * viewMatrix * w; }',
                fragmentShader: `uniform float uOpacity; uniform float uTime; uniform float uSeed; uniform vec3 uColor; varying vec2 vUv; varying float vD;
void main(){
    float e = sin(3.14159 * vUv.x);
    float a = e * e * pow(vUv.y, 1.4) * uOpacity;
    a *= 0.55 + 0.45 * sin(uTime * 0.6 + uSeed * 6.28 + vUv.y * 2.5);
    a *= smoothstep(2.0, 9.0, vD) * exp(-vD * 0.02);
    gl_FragColor = vec4(uColor * a, 1.0);
}`,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
            }));
            m.frustumCulled = false;
            m.userData.w = 2 + Math.random() * 5;
            this.scene.add(m);
            this.rayList.push(m);
        }
    }

    _placeRay(m, near) {
        const s = this.sub.pos;
        const a = Math.random() * TAU, d = near ? 4 + Math.random() * 40 : 30 + Math.random() * 18;
        const ahead = near ? 0 : 1;
        m.position.set(s.x + Math.sin(a) * d + this.fwd.x * 30 * ahead, 0, s.z + Math.cos(a) * d + this.fwd.z * 30 * ahead);
        m.scale.set(m.userData.w, 30 + Math.random() * 25, 1);
    }

    _snow() {
        // drifting specks in the water: they make the motion readable
        const n = this.cfg.snow;
        const pos = new Float32Array(n * 3), seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos.set([(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40], i * 3);
            seed[i] = Math.random();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        this.snowU = { uCam: { value: new V3() }, uTime: this.uni.uTime, uScale: { value: 400 }, uColor: { value: C('#d8f4ff') } };
        this.snow = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.snowU,
            vertexShader: `uniform vec3 uCam; uniform float uTime; uniform float uScale; attribute float aSeed; varying float vA;
void main(){
    vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 6.28) * 0.4, -uTime * 0.06, cos(uTime * 0.23 + aSeed * 4.0) * 0.4);
    p = mod(p - uCam + 20.0, 40.0) - 20.0 + uCam;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    vA = smoothstep(0.4, 2.0, d) * (1.0 - smoothstep(10.0, 20.0, d)) * (0.4 + aSeed * 0.6);
    gl_PointSize = (0.025 + aSeed * 0.03) * uScale / max(d, 0.1);
    gl_Position = projectionMatrix * mv;
}`,
            fragmentShader: `uniform vec3 uColor; varying float vA;
void main(){ float a = (1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5))) * vA; gl_FragColor = vec4(uColor, a * 0.55); }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        }));
        this.snow.frustumCulled = false;
        this.scene.add(this.snow);
    }

    _bubbles() {
        const n = 160;
        this.bub = { n, pos: new Float32Array(n * 3).fill(1e5), vel: [], life: new Float32Array(n), next: 0 };
        for (let i = 0; i < n; i++) this.bub.vel.push(new V3());
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.bub.pos, 3));
        this.bubbles = new THREE.Points(g, new THREE.PointsMaterial({ map: bubbleTexture(), size: 0.09, transparent: true, depthWrite: false, fog: false }));
        this.bubbles.frustumCulled = false;
        this.scene.add(this.bubbles);
    }

    /** Let go of `count` bubbles just outside the glass. */
    _burst(count, spread = 1) {
        if (!this.camera) return;
        const b = this.bub, q = this.camera.quaternion;
        for (let k = 0; k < count; k++) {
            const i = b.next;
            b.next = (b.next + 1) % b.n;
            const o = new V3((Math.random() - 0.5) * 3 * spread, -0.4 - Math.random() * 1.4, -1.6 - Math.random() * 2.2).applyQuaternion(q);
            const p = this.camera.position;
            b.pos.set([p.x + o.x, p.y + o.y, p.z + o.z], i * 3);
            b.vel[i].set((Math.random() - 0.5) * 0.2, 0.6 + Math.random() * 0.7, (Math.random() - 0.5) * 0.2);
            b.life[i] = 2.5 + Math.random() * 2;
        }
    }

    // ------------------------------------------------------------ the porthole's dials and the helm

    _dom() {
        const d = (this.dom = {
            root: $('sea'), finds: $('sea-finds'), depth: $('sea-depth'), heading: $('sea-heading'), rose: $('sea-rose'), dist: $('sea-dist'), logc: $('sea-logcount'),
            throttle: $('sea-throttle'), lamp: $('sea-lamp'), card: $('sea-card'), hint: $('sea-hint'),
        });
        $('sea-faster').addEventListener('click', () => this.setThrottle(1));
        $('sea-slower').addEventListener('click', () => this.setThrottle(-1));
        $('sea-leave').addEventListener('click', () => this.onLeave?.());
        d.lamp.addEventListener('click', () => this.toggleLamp());
        $('sea-card-close').addEventListener('click', () => this.closeCard());
        for (const b of document.querySelectorAll('#sea [data-hold]')) {
            const k = b.dataset.hold;
            const on = (e) => {
                e.preventDefault();
                b.setPointerCapture?.(e.pointerId);
                this.hold[k] = 1;
                b.classList.add('held');
            };
            const off = () => {
                this.hold[k] = 0;
                b.classList.remove('held');
            };
            b.addEventListener('pointerdown', on);
            b.addEventListener('pointerup', off);
            b.addEventListener('pointercancel', off);
            b.addEventListener('lostpointercapture', off);
            b.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    _input() {
        const c = this.env.canvas;
        addEventListener('keydown', (e) => {
            if (!this.active || e.target.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
            if (this.env.ui?.blocking) return;
            const k = e.key.toLowerCase();
            if (k === 'escape') {
                if (!this.dom.card.hidden) this.closeCard();
                else this.onLeave?.();
            } else if (k === 'w' || k === 'arrowup') {
                e.preventDefault();
                if (!e.repeat) this.setThrottle(1);
            } else if (k === 's' || k === 'arrowdown') {
                e.preventDefault();
                if (!e.repeat) this.setThrottle(-1);
            } else if (k === 'b') {
                if (!e.repeat) this.toggleLamp();
            } else if (['a', 'd', 'arrowleft', 'arrowright', 'r', 'c', 'q', 'e', ' ', 'pageup', 'pagedown'].includes(k)) {
                if (k === ' ' && e.target.closest?.('button, a')) return;
                e.preventDefault();
                this.keys.add(k);
            }
        }, true);
        addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
        addEventListener('blur', () => {
            this.keys.clear();
            for (const k in this.hold) this.hold[k] = 0;
        });

        c.addEventListener('pointerdown', (e) => {
            if (!this.active) return;
            this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, touch: e.pointerType === 'touch' };
        });
        addEventListener('pointermove', (e) => {
            if (!this.active) return;
            const g = this.drag;
            if (!g || g.id !== e.pointerId) {
                if (e.pointerType === 'mouse' && e.target === c) document.body.classList.toggle('can-hover-pick', !!this._pick(e.clientX, e.clientY));
                return;
            }
            if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 7) g.moved = true;
            if (g.moved) {
                const s = g.touch ? 0.005 : 0.004;
                this.look.yaw = clamp(this.look.yaw - (e.clientX - g.x) * s, -1.3, 1.3);
                this.look.pitch = clamp(this.look.pitch - (e.clientY - g.y) * s, -0.8, 0.8);
                this.look.at = this.clock;
            }
            g.x = e.clientX;
            g.y = e.clientY;
        });
        const end = (e) => {
            const g = this.drag;
            if (!this.active || !g || g.id !== e.pointerId) return;
            this.drag = null;
            if (e.type === 'pointerup' && !g.moved && e.target === c) this._tap(e.clientX, e.clientY);
        };
        addEventListener('pointerup', end);
        addEventListener('pointercancel', end);
    }

    setThrottle(dir) {
        const s = this.sub;
        const n = clamp(s.throttle + dir, 0, SPEEDS.length - 1);
        if (n === s.throttle) return;
        s.throttle = n;
        this.dom.throttle.textContent = TELEGRAPH[n];
        this.dom.throttle.dataset.level = n;
        this.env.audio?.click();
        this._burst(10);
    }

    toggleLamp() {
        this._setLamp(!this.lampOn);
        this.env.audio?.click();
    }

    _setLamp(on) {
        this.lampOn = on;
        this.dom.lamp.setAttribute('aria-pressed', String(on));
        this.dom.lamp.classList.toggle('on', on);
    }

    // ------------------------------------------------------------ going down and coming up

    /** Into the sea: the floor round the start is built at once, and the first animals put in place. */
    open(camera, night = 0) {
        this.camera = camera;
        this.active = true;
        const s = this.sub;
        s.pos.set(0, 0, 0);
        s.pos.y = clamp(seabedY(0, 0) + 7, -16, -4);
        s.yaw = 0.6;
        s.speed = 0;
        s.vy = 0;
        s.turn = 0;
        s.throttle = 2;
        this.look.yaw = this.look.pitch = 0;
        this.fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
        this.dom.throttle.textContent = TELEGRAPH[s.throttle];
        this.dom.throttle.dataset.level = s.throttle;
        this._setLamp(night > 0.45);
        this._chunks(true);
        this.life.populate(s.pos, this.fwd);
        for (const r of this.rayList) this._placeRay(r, true);
        this.biome = 'reef';
        this.biomeNext = null;
        this.biomeTimer = 0;
        this.seenTimer = 0;
        this.dashTimer = 0;
        this.dom.root.hidden = false;
        this.dom.card.hidden = true;
        document.body.classList.add('in-sea');
        this._dash(true);
        this.sound?.start();
        this._place(camera, 0);
        this._burst(60, 1.6);
    }

    /** Back up the hatch: the sea is let go, to be made again next time. */
    close() {
        if (!this.active) return;
        this.active = false;
        this.dom.root.hidden = true;
        this.dom.card.hidden = true;
        document.body.classList.remove('in-sea', 'can-hover-pick');
        this.keys.clear();
        for (const k in this.hold) this.hold[k] = 0;
        this.drag = null;
        this.sound?.stop();
        this.life.clear();
        for (const ch of this.chunks.values()) this._drop(ch);
        this.chunks.clear();
        this.queue = [];
        this.ci = this.cj = null;
    }

    // ------------------------------------------------------------ the endless floor

    _chunks(sync) {
        const p = this.sub.pos, R = this.cfg.R;
        const ci = Math.floor(p.x / CHUNK), cj = Math.floor(p.z / CHUNK);
        if (!sync && ci === this.ci && cj === this.cj) return;
        this.ci = ci;
        this.cj = cj;
        for (const [key, ch] of this.chunks) {
            if (Math.max(Math.abs(ch.i - ci), Math.abs(ch.j - cj)) > R + 1) {
                this._drop(ch);
                this.chunks.delete(key);
            }
        }
        const list = [];
        for (let dj = -R; dj <= R; dj++) {
            for (let di = -R; di <= R; di++) {
                if (di * di + dj * dj > (R + 0.5) ** 2) continue;
                const key = `${ci + di},${cj + dj}`;
                // a little ahead counts as nearer
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
        const ch = buildChunk(q.i, q.j, this.reefMat, this.cfg.density);
        ch.i = q.i;
        ch.j = q.j;
        this.scene.add(ch.mesh);
        // now and then, something rare lies on this patch of floor
        const spec = wonderAt(q.i, q.j);
        if (spec) {
            ch.wonder = buildWonder(spec, this.reefMat);
            this.scene.add(ch.wonder.root);
            ch.solids.push(...ch.wonder.solids);
        }
        this.chunks.set(q.key, ch);
    }

    _drop(ch) {
        this.scene.remove(ch.mesh);
        ch.mesh.geometry.dispose();
        if (ch.wonder) {
            this.scene.remove(ch.wonder.root);
            ch.wonder.dispose();
        }
    }

    /** The rare finds on the floor that is built. */
    *wonders() {
        for (const ch of this.chunks.values()) if (ch.wonder) yield ch.wonder;
    }

    *_near(x, z, r) {
        const i0 = Math.floor((x - r) / CHUNK), i1 = Math.floor((x + r) / CHUNK);
        const j0 = Math.floor((z - r) / CHUNK), j1 = Math.floor((z + r) / CHUNK);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const ch = this.chunks.get(`${i},${j}`);
            if (ch) yield ch;
        }
    }

    anemonesNear(x, z, r) {
        const out = [];
        for (const ch of this._near(x, z, r)) for (const a of ch.anemones) if (Math.hypot(a.x - x, a.z - z) < r) out.push(a);
        return out;
    }

    // ------------------------------------------------------------ frame

    update(dt, t, camera, night = 0) {
        if (!this.active) return;
        this.camera = camera;
        this.clock += dt;
        this.uni.uTime.value = t;
        const s = this.sub, k = this.keys, h = this.hold;
        const turnIn = clamp((k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0) + h.left - h.right, -1, 1);
        const vertIn = clamp((k.has('r') || k.has('q') || k.has(' ') || k.has('pageup') ? 1 : 0) - (k.has('c') || k.has('e') || k.has('pagedown') ? 1 : 0) + h.up - h.down, -1, 1);
        s.turn = damp(s.turn, turnIn * 0.55, 3, dt);
        s.yaw += s.turn * dt;
        s.speed = damp(s.speed, SPEEDS[s.throttle], 0.7, dt);
        s.vy = damp(s.vy, vertIn * 2.2, 2.5, dt);
        this.fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
        s.pos.addScaledVector(this.fwd, s.speed * dt);
        s.pos.y += s.vy * dt;

        // keep off the floor (looking a little ahead), under the waves, and out of the rocks
        const ax = s.pos.x + this.fwd.x * 6 * Math.sign(s.speed || 1), az = s.pos.z + this.fwd.z * 6 * Math.sign(s.speed || 1);
        const floor = Math.max(seabedY(s.pos.x, s.pos.z), seabedY(ax, az)) + CLEAR;
        if (s.pos.y < floor) {
            s.pos.y = Math.max(damp(s.pos.y, floor, 3, dt), floor - 0.8);
            if (s.vy < 0) s.vy *= 0.5;
        }
        if (s.pos.y > CEILING) {
            s.pos.y = CEILING;
            if (s.vy > 0) s.vy = 0;
        }
        for (const ch of this._near(s.pos.x, s.pos.z, 12)) {
            for (const o of ch.solids) {
                const dx = s.pos.x - o.x, dy = s.pos.y - o.y, dz = s.pos.z - o.z;
                const d = Math.hypot(dx, dy, dz), min = o.r + SUB_R;
                if (d < min && d > 1e-4) {
                    const push = (min - d) / d;
                    s.pos.x += dx * push;
                    s.pos.y += dy * push;
                    s.pos.z += dz * push;
                }
            }
        }

        // the view drifts back to dead ahead once you are under way again
        if (!this.drag && this.clock - this.look.at > 2.5 && Math.abs(s.speed) > 0.5) {
            this.look.yaw = damp(this.look.yaw, 0, 0.5, dt);
            this.look.pitch = damp(this.look.pitch, 0, 0.5, dt);
        }
        this._place(camera, t);

        this._chunks(false);
        if (this.queue.length) this._buildNext();
        this.life.update(dt, t, s.pos, this.fwd, night);
        for (const w of this.wonders()) w.update(t, night);
        this._env(dt, t, camera, night);

        // bubbles: a trickle, and plenty when the tanks blow or flood
        const b = this.bub;
        if (Math.random() < dt * (1.5 + Math.abs(s.vy) * 14)) this._burst(1 + Math.floor(Math.abs(s.vy) * 2), 1 + Math.abs(s.vy) * 0.3);
        for (let i = 0; i < b.n; i++) {
            if (b.life[i] <= 0) continue;
            b.life[i] -= dt;
            const v = b.vel[i];
            b.pos[i * 3] += (v.x + Math.sin(t * 6 + i) * 0.12) * dt;
            b.pos[i * 3 + 1] += v.y * dt;
            b.pos[i * 3 + 2] += (v.z + Math.cos(t * 5 + i) * 0.12) * dt;
            if (b.life[i] <= 0 || b.pos[i * 3 + 1] > -0.3) {
                b.life[i] = 0;
                b.pos[i * 3 + 1] = 1e5;
            }
        }
        this.bubbles.geometry.attributes.position.needsUpdate = true;

        this.seenTimer -= dt;
        if (this.seenTimer <= 0) {
            this.seenTimer = 0.4;
            this._sightings(camera);
        }
        this.biomeTimer -= dt;
        if (this.biomeTimer <= 0) {
            this.biomeTimer = 1;
            const b2 = dominant(biomeAt(s.pos.x, s.pos.z));
            if (b2 === this.biome) this.biomeNext = null;
            else if (b2 === this.biomeNext) {
                this.biome = b2;
                this.biomeNext = null;
                const z = ZONES[b2];
                this.env.ui?.zone(z[0], z[1], z[2]);
            } else this.biomeNext = b2;
        }
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
            this.dashTimer = 0.2;
            this._dash();
        }
        this.sound?.update(clamp(Math.abs(s.speed) / SPEEDS[4], 0, 1), clamp(s.vy / 2.2, -1, 1), -s.pos.y);
    }

    /** The camera sits at the porthole: the hull's heading, where you are looking, a lean into turns. */
    _place(camera, t) {
        const s = this.sub;
        camera.position.copy(s.pos);
        camera.position.y += Math.sin(t * 0.9) * 0.05;
        const pitch = this.look.pitch + clamp(s.vy * 0.05, -0.12, 0.12) + Math.sin(t * 0.7) * 0.01;
        const roll = -s.turn * 0.22 + Math.sin(t * 0.55) * 0.012;
        camera.quaternion.setFromEuler(_e.set(pitch, s.yaw + this.look.yaw, roll, 'YXZ'));
        camera.updateMatrixWorld();
    }

    /** Light, murk and glow by depth and by the garden's time of day. */
    _env(dt, t, camera, night) {
        const depth = -this.sub.pos.y;
        const dk = clamp(depth / 35, 0, 1);
        const day = 1 - night * 0.85;
        this.fogColor.copy(SHALLOW).lerp(DEEP, dk).lerp(NIGHT, night * 0.9);
        this.domeU.uDeep.value.copy(this.fogColor).multiplyScalar(0.35);
        this.domeU.uTop.value.copy(TOP_NIGHT).lerp(TOP_DAY, day).multiplyScalar(1.2 - dk * 0.5);
        this.surfU.uBright.value = 0.35 + day * 0.75;
        this.hemi.intensity = (1.1 - dk * 0.4) * day + 0.08;
        this.sun.intensity = 1.2 * (1 - dk * 0.5) * day;
        this.uni.uCaustic.value = 0.6 * day;
        this.uni.uGlow.value = 0.1 + night * 1.3;
        this.rayU.uOpacity.value = 0.32 * day * (1 - dk * 0.5);
        this.snowU.uColor.value.setScalar(0.4 + day * 0.5).multiply(C('#d8f4ff'));
        this.lamp.intensity = damp(this.lamp.intensity, this.lampOn ? 80 : 0, 6, dt);
        this.lamp.position.copy(camera.position);
        _v.set(0, 0, -10).applyQuaternion(camera.quaternion).add(camera.position);
        this.lamp.target.position.copy(_v);
        this.lamp.target.updateMatrixWorld();

        const p = camera.position;
        this.dome.position.copy(p);
        this.surface.position.set(p.x, 0, p.z);
        this.snowU.uCam.value.copy(p);
        this.snowU.uScale.value = this.env.renderer.domElement.height * 0.5;
        this.bubbles.material.size = 0.09;
        for (const m of this.rayList) {
            if (Math.hypot(m.position.x - p.x, m.position.z - p.z) > 52) this._placeRay(m, false);
            m.rotation.set(0, Math.atan2(p.x - m.position.x, p.z - m.position.z), 0.22);
        }
    }

    // ------------------------------------------------------------ the log and the dials

    _sightings(camera) {
        const s = this.sub.pos;
        _v.set(0, 0, -1).applyQuaternion(camera.quaternion);
        for (const it of this.life.items) {
            if (it.logged) continue;
            _w.subVectors(it.pos, s);
            const d = _w.length();
            if (d > it.sp.see + it.radius || (d > 4 && _w.dot(_v) / d < 0.3)) continue;
            it.logged = true;
            this._logIt(it.sp);
        }
        for (const w of this.wonders()) {
            _w.subVectors(w.pos, s);
            const d = _w.length();
            // the sonar hears it before you can see it
            if (!w.pinged && d < 62) {
                w.pinged = true;
                if (!w.logged) {
                    if (this.env.audio?.ctx) this.sound?.ping(this.env.audio.ctx.currentTime + 0.05, 20);
                    this.env.ui?.hint('The sonar pings: something unusual on the floor nearby…', 5000);
                }
            }
            if (w.logged || d > w.def.see + w.radius || (d > w.radius + 4 && _w.dot(_v) / d < 0.3)) continue;
            w.logged = true;
            this._logFind(w.def);
        }
    }

    _logFind(def, quiet = false) {
        const first = !this.log[def.id];
        this.log[def.id] = (this.log[def.id] || 0) + 1;
        store.set('seaLog', this.log);
        if (first && !quiet) {
            this.env.ui?.hint(`A rare find: ${def.name}! · click it for its story`, 7000);
            this.env.audio?.sparkle();
            if (def.rarity === 'Legendary') this.env.audio?.caught?.(true);
        }
        this._dash(true);
    }

    _logIt(sp, quiet = false) {
        const first = !this.log[sp.id];
        this.log[sp.id] = (this.log[sp.id] || 0) + 1;
        store.set('seaLog', this.log);
        if (first && !quiet) {
            this.env.ui?.hint(`New in your sea log: ${sp.name} · click it to read about it`, 6000);
            this.env.audio?.sparkle();
        }
        this._dash(true);
    }

    _dash(all) {
        const s = this.sub, d = this.dom;
        d.depth.textContent = `${Math.round(-s.pos.y)} m`;
        const deg = ((((-s.yaw - this.look.yaw) * 180) / Math.PI) % 360 + 360) % 360;
        d.heading.textContent = `${Math.round(deg)}° ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]}`;
        d.rose.style.transform = `rotate(${-deg}deg)`;
        const far = Math.hypot(s.pos.x, s.pos.z);
        d.dist.textContent = far < 1000 ? `${Math.round(far)} m` : `${(far / 1000).toFixed(1)} km`;
        if (all) {
            d.logc.textContent = `${SEA_LIFE.filter((x) => this.log[x.id]).length} / ${SEA_LIFE.length}`;
            d.finds.textContent = `${WONDERS.filter((x) => this.log[x.id]).length} / ${WONDERS.length}`;
        }
    }

    // ------------------------------------------------------------ touching things

    _pick(cx, cy) {
        if (!this.camera) return null;
        _ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
        this.ray.setFromCamera(_ndc, this.camera);
        const ray = this.ray.ray;
        let best = this.life.pick(ray);
        for (const w of this.wonders()) {
            _w.subVectors(w.pos, ray.origin);
            const t = _w.dot(ray.direction);
            if (t < 0 || t > 70 || (best && t > best.t)) continue;
            if (_w.lengthSq() - t * t < w.radius * w.radius) best = { wonder: w, t };
        }
        return best;
    }

    _tap(cx, cy) {
        const h = this._pick(cx, cy);
        if (h?.wonder) this.showFind(h.wonder);
        else if (h) this.showCard(h.item.sp, h.item);
        else if (!this.dom.card.hidden) this.closeCard();
    }

    /** The card for a rare find. */
    showFind(w) {
        const def = w.def;
        if (!w.logged) {
            w.logged = true;
            this._logFind(def, true);
        }
        const n = this.log[def.id] || 0;
        $('sea-kicker').textContent = n <= 1 ? 'A rare find!' : 'From your sea log';
        $('sea-name').textContent = def.name;
        $('sea-latin').textContent = def.sub;
        $('sea-stats').innerHTML = `<span class="fc-rarity r-${def.rarity.toLowerCase()}">${def.rarity} find</span><span>Found ${n}×</span>`;
        $('sea-fact').textContent = w.note || def.fact;
        $('sea-habitat').textContent = def.where;
        $('sea-log').textContent = `${WONDERS.filter((x) => this.log[x.id]).length} of ${WONDERS.length} rare finds`;
        this.dom.card.style.setProperty('--accent', def.rarity === 'Legendary' ? '#fff0a0' : '#e2a8ff');
        this.dom.card.hidden = false;
        this.env.audio?.click();
    }

    showCard(sp, item) {
        if (item && !item.logged) {
            item.logged = true;
            this._logIt(sp, true);
        }
        const d = this.dom, n = this.log[sp.id] || 0;
        $('sea-kicker').textContent = n <= 1 ? 'New in your sea log' : 'From your sea log';
        $('sea-name').textContent = sp.name;
        $('sea-latin').textContent = sp.latin;
        const size = sp.kind === 'jelly' ? `bell about ${Math.round(sp.size * 100)} cm` : sp.size >= 1 ? `about ${Math.round(sp.size)} m long` : `about ${Math.round(sp.size * 100)} cm long`;
        $('sea-stats').innerHTML = `<span class="fc-rarity r-${sp.rarity.toLowerCase()}">${sp.rarity}</span><span>${size}</span><span>Seen ${n}×</span>`;
        $('sea-fact').textContent = sp.fact;
        $('sea-habitat').textContent = sp.habitat;
        $('sea-log').textContent = `${SEA_LIFE.filter((x) => this.log[x.id]).length} of ${SEA_LIFE.length} kinds found`;
        d.card.style.setProperty('--accent', { Common: '#8fd6ff', Uncommon: '#8ff6c8', Rare: '#e2a8ff', Legendary: '#fff0a0' }[sp.rarity]);
        d.card.hidden = false;
        this.env.audio?.click();
    }

    closeCard() {
        this.dom.card.hidden = true;
    }
}

const _e = new THREE.Euler(), _v = new V3(), _w = new V3(), _ndc = new THREE.Vector2();
