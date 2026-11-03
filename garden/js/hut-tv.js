// The hut's television: an old wooden set with rabbit ears on a cabinet beside
// the desk. It doesn't get the news. It gets the island's secret places, live:
// the fishing hole, the Moon Fountain, the galaxy in the glass, the Violet Line,
// and (once you have found them) the Lighthouse Arcade and the Works. Click the
// set to turn the dial. Each channel is a scene the garden already has, drawn
// from a camera of the channel's own into a small picture a dozen times a second,
// and shown through a curved, scan-lined glass that crackles between channels.
// The channels themselves are handed in by main.js, which knows those places.

import * as THREE from 'three';
import { PIXEL_FONT } from './arcade-screens.js';
import { damp } from './util.js';

const RT_W = 320, RT_H = 240;
const SCREEN_W = 0.5, SCREEN_H = 0.375;

const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SCREEN_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uOsd;
uniform float uTime;
uniform float uStatic;
uniform float uSignal;
uniform float uOsdA;
uniform float uHover;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv *= 1.0 + 0.07 * dot(uv, uv);          // the bulge of the tube
    vec2 st = uv * 0.5 + 0.5;
    if (st.x < 0.0 || st.y < 0.0 || st.x > 1.0 || st.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    // a little horizontal jitter and colour fringing, like a set that has seen some winters
    float wob = sin(st.y * 90.0 + uTime * 4.0) * 0.0008 + (hash(vec2(floor(uTime * 20.0), floor(st.y * 60.0))) - 0.5) * 0.002 * uStatic;
    vec3 col;
    col.r = texture2D(uMap, st + vec2(0.0018 + wob, 0.0)).r;
    col.g = texture2D(uMap, st + vec2(wob, 0.0)).g;
    col.b = texture2D(uMap, st + vec2(-0.0018 + wob, 0.0)).b;
    col = col / (1.0 + col * 0.45);
    col *= uSignal;
    // snow: between channels, and on a channel with no signal
    float n = hash(floor(st * vec2(240.0, 180.0)) + floor(uTime * 30.0) * 7.13);
    float snow = max(uStatic, 1.0 - uSignal);
    col = mix(col, vec3(n * 0.85), snow * (1.0 - uSignal * 0.25));
    // a slow bright band that rolls up the screen
    col *= 1.0 + 0.08 * smoothstep(0.0, 0.08, 0.08 - abs(fract(st.y - uTime * 0.07) - 0.5));
    // scan lines and the dark corners of the glass
    col *= 0.8 + 0.2 * sin(st.y * float(${RT_H}) * 3.14159);
    col *= 1.0 - 0.42 * pow(dot(uv, uv) * 0.5, 1.3);
    vec4 o = texture2D(uOsd, st);
    col = mix(col, o.rgb * 1.4, o.a * uOsdA);
    col *= 1.0 + 0.15 * uHover;
    gl_FragColor = vec4(col * 1.25, 1.0);
}`;

export class HutTV {
    /**
     * @param {object} env  { renderer, scene, camera, mats, quality, channels, x, z, ry, onChannel }
     *   channels: [{ name, sub, ready() -> bool, scene() -> THREE.Scene, aim(cam, t, dt, h), prep?(dt, t), hint }]
     */
    constructor(env) {
        this.env = env;
        this.channels = env.channels;
        this.index = 0;
        this.time = 0;
        this.lastDraw = -1;
        this.static = 1;
        this.signal = 0;
        this.osdT = 0;
        this.hover = 0;
        this.hoverTarget = 0;
        this.cam = new THREE.PerspectiveCamera(55, RT_W / RT_H, 0.15, 4000);
        this.rt = new THREE.WebGLRenderTarget(RT_W, RT_H, { type: THREE.HalfFloatType, depthBuffer: true });
        this.osdCanvas = Object.assign(document.createElement('canvas'), { width: 512, height: 384 });
        this.osd = new THREE.CanvasTexture(this.osdCanvas);
        this.osd.colorSpace = THREE.SRGBColorSpace;
        this.group = new THREE.Group();
        this.group.position.set(env.x, 0, env.z);
        this.group.rotation.y = env.ry ?? 0;
        env.scene.add(this.group);
        this._build();
        this.group.updateMatrixWorld(true);
        this.screenWorld = new THREE.Vector3();
        this.screen.getWorldPosition(this.screenWorld);
        this._osd();
    }

    _build() {
        const g = this.group, m = this.env.mats;
        const veneer = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.45, metalness: 0.05, map: m.darkWood?.map ?? null });
        const black = new THREE.MeshStandardMaterial({ color: 0x18140f, roughness: 0.55 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.2, metalness: 1 });
        const box = (w, h, d, x, y, z, mat, parent = g) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.set(x, y, z);
            parent.add(mesh);
            return mesh;
        };
        // a low cabinet with two doors and splayed legs
        const cab = m.darkWood ?? veneer;
        box(0.92, 0.42, 0.46, 0, 0.32, 0, cab);
        for (const sx of [-1, 1]) {
            box(0.42, 0.34, 0.012, sx * 0.218, 0.32, 0.232, veneer);
            box(0.02, 0.08, 0.02, sx * 0.04, 0.34, 0.245, m.brass ?? chrome);
            for (const sz of [-1, 1]) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.13, 8), black);
                leg.position.set(sx * 0.4, 0.055, sz * 0.18);
                leg.rotation.set(sz * 0.15, 0, -sx * 0.15);
                g.add(leg);
            }
        }
        // the set: a veneered box, a black bezel, the tube, a column of controls
        const Y = 0.53, H = 0.5;
        const set = new THREE.Group();
        set.position.y = Y;
        g.add(set);
        box(0.78, H, 0.5, 0, H / 2, -0.02, veneer, set);
        box(0.6, 0.45, 0.02, -0.07, H / 2, 0.235, black, set);
        // the tube's glass, bulging a little: a bent plane
        const geo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H, 16, 12);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i) / (SCREEN_W / 2), y = p.getY(i) / (SCREEN_H / 2);
            p.setZ(i, 0.018 * (1 - 0.5 * x * x - 0.5 * y * y));
        }
        geo.computeVertexNormals();
        this.uniforms = {
            uMap: { value: this.rt.texture }, uOsd: { value: this.osd }, uTime: { value: 0 }, uStatic: { value: 1 },
            uSignal: { value: 0 }, uOsdA: { value: 1 }, uHover: { value: 0 },
        };
        const screen = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG }));
        screen.position.set(-0.07, H / 2, 0.247);
        set.add(screen);
        this.screen = screen;
        // a glint of glass over the picture
        const glass = new THREE.Mesh(geo.clone(), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05, clearcoat: 1, depthWrite: false }));
        glass.position.copy(screen.position).z += 0.004;
        set.add(glass);
        // the control column: two knobs and a speaker grille
        box(0.12, 0.45, 0.02, 0.31, H / 2, 0.235, black, set);
        this.knobs = [];
        for (const [y, r] of [[0.39, 0.032], [0.3, 0.024]]) {
            const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, 0.03, 18).rotateX(Math.PI / 2), chrome);
            k.position.set(0.31, y, 0.255);
            set.add(k);
            box(0.004, r * 0.8, 0.004, 0, r * 0.4, 0.016, black, k);
            this.knobs.push(k);
        }
        for (let i = 0; i < 7; i++) box(0.08, 0.008, 0.006, 0.31, 0.07 + i * 0.02, 0.248, chrome, set);
        // the rabbit ears
        const base = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), black);
        base.position.set(0.05, H, -0.05);
        set.add(base);
        for (const s of [-1, 1]) {
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.45, 6).translate(0, 0.225, 0), chrome);
            rod.position.set(0.05, H + 0.03, -0.05);
            rod.rotation.set(-0.15, 0, s * 0.55);
            set.add(rod);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), chrome);
            tip.position.set(0, 0.45, 0);
            rod.add(tip);
        }
        // the light the picture throws into the room
        this.glow = new THREE.PointLight(0x9fc8ff, 0, 3.2, 1.6);
        this.glow.position.set(-0.07, Y + H / 2, 0.6);
        g.add(this.glow);
        // a target over the set, for the pointer
        const hit = new THREE.Mesh(new THREE.BoxGeometry(0.82, H + 0.1, 0.56), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(0, Y + H / 2, 0);
        hit.userData.kind = 'tv';
        g.add(hit);
        this.pickables = [hit];
    }

    get channel() {
        return this.channels[this.index];
    }

    /** Turn the dial to the next channel (or the one before, with dir = -1). */
    next(dir = 1) {
        const n = this.channels.length;
        this.index = (this.index + dir + n) % n;
        this.static = 1;
        this.osdT = 0;
        this.lastDraw = -1;
        this._osd();
        this.knobs[0].rotation.z -= (dir * Math.PI) / 4;
        this.env.onChannel?.(this.channel, this.index);
    }

    _osd() {
        const c = this.osdCanvas, x = c.getContext('2d');
        const ch = this.channel;
        const live = ch.ready();
        x.clearRect(0, 0, c.width, c.height);
        x.textBaseline = 'top';
        const text = (s, px, X, Y, col, align = 'left') => {
            x.font = `${px}px ${PIXEL_FONT}`;
            x.textAlign = align;
            x.fillStyle = 'rgba(0,0,0,0.75)';
            x.fillText(s, X + 3, Y + 3);
            x.fillStyle = col;
            x.fillText(s, X, Y);
        };
        text(`CH ${String(this.index + 2).padStart(2, '0')}`, 34, 28, 26, '#7dff8a');
        if (live) {
            x.fillStyle = '#ff3040';
            x.beginPath();
            x.arc(420, 44, 9, 0, Math.PI * 2);
            x.fill();
            text('LIVE', 20, 436, 34, '#ffffff');
        }
        text(ch.name.toUpperCase(), 20, 28, 316, '#ffffff');
        if (ch.sub) text(ch.sub.toUpperCase(), 13, 28, 346, '#bfe8ff');
        if (!live) {
            text('NO SIGNAL', 36, 256, 150, '#ffffff', 'center');
            if (ch.hint) {
                const words = ch.hint.toUpperCase().split(' ');
                let line = '', y = 206;
                x.font = `12px ${PIXEL_FONT}`;
                for (const w of words) {
                    if (x.measureText(line + w).width > 420) {
                        text(line.trim(), 12, 256, y, '#ffe94a', 'center');
                        line = '';
                        y += 22;
                    }
                    line += w + ' ';
                }
                if (line.trim()) text(line.trim(), 12, 256, y, '#ffe94a', 'center');
            }
        }
        this.osd.needsUpdate = true;
    }

    setHover(on) {
        this.hoverTarget = on ? 1 : 0;
    }

    /** Is the set in front of the room's camera? (No point drawing a picture nobody sees.) */
    _inView(camera) {
        const v = this.screenWorld.clone().project(camera);
        return v.z < 1 && Math.abs(v.x) < 1.4 && Math.abs(v.y) < 1.4;
    }

    update(dt, t, camera, paused = false) {
        this.time = t;
        const ch = this.channel;
        const live = ch.ready();
        this.static = damp(this.static, 0, 5, dt);
        this.signal = damp(this.signal, live ? 1 : 0, live ? 3 : 8, dt);
        this.osdT += dt;
        if (this.osdT > 0.4 && this.osdT - dt <= 0.4 && live !== this._wasLive) this._osd();
        this._wasLive = live;
        this.hover = damp(this.hover, this.hoverTarget, 8, dt);
        const u = this.uniforms;
        u.uTime.value = t;
        u.uStatic.value = this.static;
        u.uSignal.value = this.signal;
        u.uOsdA.value = live ? (this.osdT < 4 ? 1 : Math.max(0.45, 1 - (this.osdT - 4) * 0.5)) : 1;
        u.uHover.value = this.hover;
        this.glow.intensity = (0.6 + this.signal * 0.6) * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.7)) * 1.6;
        if (paused || !live || !this._inView(camera)) return;
        // a dozen pictures a second is plenty for an old set (half that on a lighter setting)
        const fps = this.env.quality?.tier === 'low' ? 6 : 12;
        if (this.lastDraw >= 0 && t - this.lastDraw < 1 / fps) return;
        const step = this.lastDraw < 0 ? 1 / fps : t - this.lastDraw;
        this.lastDraw = t;
        try {
            const scene = ch.scene();
            ch.prep?.(step, t);
            ch.aim(this.cam, t, step, RT_H);
            this.cam.updateMatrixWorld();
            const r = this.env.renderer;
            const prev = r.getRenderTarget();
            const auto = r.shadowMap.autoUpdate;
            r.shadowMap.autoUpdate = false;
            r.setRenderTarget(this.rt);
            r.clear();
            r.render(scene, this.cam);
            r.setRenderTarget(prev);
            r.shadowMap.autoUpdate = auto;
        } catch (e) {
            // a channel that can't be drawn goes off the air rather than taking the room with it
            console.warn('hut tv:', ch.name, e);
            ch.ready = () => false;
            this._osd();
        }
    }

    dispose() {
        this.rt.dispose();
        this.osd.dispose();
    }
}
