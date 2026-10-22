// The three.js view: reads G every frame and plays sim events as effects. Never changes G.
//
// Passes: the shader sky (its own scene), the machine and enemies, bloom, a CRT pass (chromatic
// fringe, scanlines, vignette, a red edge when you're hit), then tone mapping and sRGB.
// Layout: enemies above the machine on tall screens, beside it on wide short ones.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ENEMIES, SYMBOLS } from '../sim/data.js';
import { Backdrop } from './backdrop.js';
import { Machine, RH } from './machine.js';
import { Foe } from './foes.js';
import { Fx } from './fx.js';

const CRT = {
    uniforms: {
        tDiffuse: { value: null }, uChroma: { value: 0.012 }, uScan: { value: 0.06 }, uVig: { value: 0.55 }, uHurt: { value: 0 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float uChroma, uScan, uVig, uHurt;
        void main() {
            vec2 d = vUv - 0.5;
            float r2 = dot(d, d);
            vec2 off = d * uChroma * (0.4 + r2 * 2.0);
            vec3 c;
            c.r = texture2D(tDiffuse, vUv + off).r;
            c.g = texture2D(tDiffuse, vUv).g;
            c.b = texture2D(tDiffuse, vUv - off).b;
            c *= 1.0 - uScan * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
            c *= clamp(1.0 - uVig * r2 * 1.5, 0.0, 1.0);
            c += vec3(0.9, 0.05, 0.12) * uHurt * smoothstep(0.08, 0.35, r2);
            gl_FragColor = vec4(max(c, 0.0), 1.0);
        }`,
};

const KIND_COLOR = { blade: SYMBOLS.blade.color, comet: SYMBOLS.comet.color, burn: SYMBOLS.hex.color };

export class View {
    constructor(canvas, { insets = () => ({ top: 56, bottom: 110 }) } = {}) {
        this.canvas = canvas;
        this.insets = insets;
        this.calm = false;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

        const pm = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        pm.dispose();
        this.scene.add(new THREE.HemisphereLight(0xb8a8ff, 0x301030, 0.6));
        const key = new THREE.DirectionalLight(0xffe0f4, 1.4);
        key.position.set(3, 6, 8);
        this.scene.add(key);
        const rim = new THREE.PointLight(0x40e0ff, 6, 14);
        rim.position.set(-4, 2, 3);
        this.scene.add(rim);

        this.backdrop = new Backdrop();
        this.machine = new Machine(this.scene);
        this.fx = new Fx(this.scene);
        this.foes = [];

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.backdrop.scene, this.backdrop.camera));
        const main = new RenderPass(this.scene, this.camera);
        main.clear = false;
        main.clearDepth = true;
        this.composer.addPass(main);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 1.1);
        this.composer.addPass(this.bloom);
        this.crt = new ShaderPass(CRT);
        this.composer.addPass(this.crt);
        this.composer.addPass(new OutputPass());

        this.shake = 0;
        this.hurt = 0;
        this.lastHurt = -9;
        this.time = 0;
        this.v = new THREE.Vector3();
        this.layoutMode = 'stack';
        this.machine.build(3);

        this.resize();
        const onResize = () => this.resize(true);
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setCalm(on) {
        this.calm = on;
        this.crt.uniforms.uChroma.value = on ? 0.004 : 0.012;
        this.crt.uniforms.uScan.value = on ? 0.03 : 0.06;
        this.bloom.strength = on ? 0.35 : 0.6;
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const ins = this.insets();
        const key = `${w}x${h}:${ins.top}:${ins.bottom}:${this.machine.n}:${this.foes.length}`;
        if (!force && key === this.key) return;
        this.key = key;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        this.composer.setPixelRatio(dpr);
        this.composer.setSize(w, h);
        this.layout(ins);
    }

    /** Fit the machine and the enemies into the band between the HUD and the bottom bar. */
    layout(ins) {
        const { w, h } = this;
        const band = Math.max(120, h - ins.top - ins.bottom);
        const bandAsp = w / band;
        const mW = this.machine.cabW + 0.6;               // the lever sticks out on the right
        const n = Math.max(1, this.foes.length);
        const boss = this.foes.some((f) => f.boss);
        let box;                                          // [x0, x1, y0, y1]
        if (bandAsp > 1.45) {
            this.layoutMode = 'side';
            const span = boss ? 3.4 : n * 2.3;
            const x0 = mW / 2 + 0.5;
            this.foes.forEach((f, i) => f.home.set(x0 + (i + 0.5) * (span / n), boss ? 0.5 : 0.3 + (i % 2) * 0.5, -0.4));
            box = [-mW / 2, x0 + span, -2.05, 2.75];
        } else {
            this.layoutMode = 'stack';
            const span = Math.max(mW, n * 2.1);
            const y = boss ? 4.35 : 3.95;
            this.foes.forEach((f, i) => f.home.set((i - (n - 1) / 2) * (span / n) * 0.98, y + (n === 3 && i === 1 ? 0.35 : 0), -0.4));
            box = [-span / 2, span / 2, -2.05, boss ? 5.95 : 5.2];
        }
        const cw = box[1] - box[0], ch = box[3] - box[2];
        const fov = (this.camera.fov * Math.PI) / 180;
        const aspect = w / h;
        // visible world height needed so the box fits the band vertically and the width horizontally
        const H = Math.max(ch / (band / h) * 1.04, cw / (aspect * 0.94));
        const dist = H / (2 * Math.tan(fov / 2));
        const cx = (box[0] + box[1]) / 2, cy = (box[2] + box[3]) / 2;
        // the band's centre sits below the screen's centre when the bottom bar is taller than the HUD
        const bandMid = ins.top + band / 2;
        const camY = cy + ((bandMid - h / 2) / h) * H;
        this.camera.aspect = aspect;
        this.camera.position.set(cx, camY, dist);
        this.camera.lookAt(cx, camY, 0);
        this.camera.far = dist * 4 + 20;
        this.camera.updateProjectionMatrix();
        this.camBase = this.camera.position.clone();
        // the sky's horizon sits at the foot of the machine; on wide screens the sun rises in the
        // gap beside it instead of behind it
        this.toScreen(this.v.set(0, -2.0, 0));
        const horizon = Math.min(0.5, Math.max(0.1, 1 - this.v.y / h));
        this.toScreen(this.v.set(-this.machine.cabW / 2, 0, 0));
        const gap = this.v.x;
        const sunX = gap > h * 0.5 ? (gap / 2 - w / 2) / h : 0;
        this.backdrop.resize(w, h, horizon, sunX);
    }

    /** World → CSS px through the canvas's own rect. */
    toScreen(v) {
        const p = v.clone().project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        v.set(r.left + (p.x * 0.5 + 0.5) * r.width, r.top + (-p.y * 0.5 + 0.5) * r.height, p.z);
        return v;
    }

    /** Screen rects of the reels and anchor points of the enemies, for the DOM overlay. */
    anchors() {
        const M = this.machine;
        const reels = M.reels.map((r, i) => {
            const x = M.reelX(i);
            const a = this.toScreen(new THREE.Vector3(x - 0.5, RH / 2, 0.56));
            const b = this.toScreen(new THREE.Vector3(x + 0.5, -RH / 2, 0.56));
            return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
        });
        const foes = this.foes.map((f) => {
            const top = this.toScreen(new THREE.Vector3(f.home.x, f.home.y + f.size * 0.55, f.home.z));
            const c = this.toScreen(new THREE.Vector3(f.home.x, f.home.y, f.home.z));
            const side = this.toScreen(new THREE.Vector3(f.home.x + f.size * 0.5, f.home.y, f.home.z));
            return { x: top.x, y: top.y, cx: c.x, cy: c.y, r: Math.abs(side.x - c.x), dead: f.dying };
        });
        return { reels, foes };
    }

    paylinePoint(i) {
        const M = this.machine;
        return new THREE.Vector3(i == null ? 0 : M.reelX(i), 0, 0.7);
    }

    // ------------------------------------------------------------------ battle setup
    setBattle(ids, reels, stops) {
        for (const f of this.foes) f.dispose();
        this.foes = ids.map((id) => new Foe(this.scene, id, ENEMIES[id]));
        this.machine.build(reels.length);
        reels.forEach((s, i) => { this.machine.setStrip(i, s); this.machine.snap(i, stops[i]); });
        this.resize(true);
    }

    /** Snap to the true state once no event is pending (hides any drift). */
    sync(G) {
        if (!G.b) return;
        const B = G.b;
        if (this.foes.length !== B.enemies.length || this.foes.some((f, i) => f.id !== B.enemies[i].id)) {
            this.setBattle(B.enemies.map((e) => e.id), B.reels, B.stops);
        }
        if (this.machine.n !== B.reels.length) this.setBattle(B.enemies.map((e) => e.id), B.reels, B.stops);
        if (!this.machine.busy()) {
            B.reels.forEach((s, i) => {
                this.machine.setStrip(i, s);
                const r = this.machine.reels[i];
                const cur = ((r.off % r.len) + r.len) % r.len;
                if (Math.abs(cur - B.stops[i]) > 0.01) this.machine.snap(i, B.stops[i]);
            });
        }
        this.foes.forEach((f, i) => {
            const dead = B.enemies[i].hp <= 0;
            if (dead && !f.dying) f.die();
            f.targeted = i === B.target && G.phase === 'battle';
        });
    }

    // ------------------------------------------------------------------ events
    onEvent(G, e) {
        const M = this.machine;
        const foeAt = (i) => this.foes[i];
        switch (e.type) {
            case 'battle':
                this.setBattle(e.ids, e.reels, e.stops);
                break;
            case 'sector':
                this.backdrop.setSector(e.sector);
                break;
            case 'spin':
                M.pull();
                e.stops.forEach((s, i) => M.spin(i, s, 0.45 + i * 0.22));
                break;
            case 'nudge':
                M.nudge(e.reel, e.dir, e.stop);
                break;
            case 'respin':
                M.spin(e.reel, e.stop, 0.35);
                break;
            case 'fire': {
                M.fireFlash();
                e.line.forEach((s, i) => this.fx.burst(this.paylinePoint(i), SYMBOLS[s].color, e.top >= 3 ? 26 : 12, 2.2, 0.3));
                break;
            }
            case 'hit': {
                const f = foeAt(e.i);
                if (!f) break;
                f.flashHit();
                if (e.kind !== 'burn') this.fx.beam(this.paylinePoint(), f.home, KIND_COLOR[e.kind], e.kind === 'comet' ? 0.05 : 0.08);
                this.fx.burst(f.home, KIND_COLOR[e.kind], e.dmg > 20 ? 40 : 22, 2.6, 0.35);
                break;
            }
            case 'edie': {
                const f = foeAt(e.i);
                if (!f) break;
                f.die();
                this.fx.burst(f.home, '#' + f.color.getHexString(), 70, 3.5, 0.45);
                break;
            }
            case 'burn': {
                const f = foeAt(e.i);
                if (f) this.fx.burst(f.home, SYMBOLS.hex.color, 18, 1.6, 0.3);
                break;
            }
            case 'eact': {
                const f = foeAt(e.i);
                if (f && e.k === 'atk') f.attack();
                if (f && e.k !== 'atk') this.fx.burst(f.home, e.k === 'block' ? SYMBOLS.shield.color : e.k === 'buff' ? '#ffb347' : '#b0b4c8', 16, 1.4, 0.3);
                break;
            }
            case 'phit':
                if (e.dmg > 0) {
                    this.shake = Math.min(1, 0.35 + e.dmg / 25);
                    // the red edge flashes at most twice a second
                    if (this.time - this.lastHurt > 0.5) { this.hurt = this.calm ? 0.25 : 0.55; this.lastHurt = this.time; }
                }
                this.fx.burst(this.paylinePoint(), e.dmg > 0 ? '#ff4060' : SYMBOLS.shield.color, 20, 2.4, 0.3);
                break;
            case 'pblock':
                this.fx.burst(this.paylinePoint(), SYMBOLS.shield.color, 24, 2, 0.3);
                break;
            case 'pheal':
                this.fx.burst(this.paylinePoint(), SYMBOLS.mend.color, 24, 2, 0.3);
                break;
            case 'charge':
                this.fx.burst(this.paylinePoint(), SYMBOLS.charge.color, 20, 2, 0.3);
                break;
            case 'jam': {
                const f = foeAt(e.i);
                M.jam(e.reel, e.at, e.strip);
                const to = new THREE.Vector3(M.reelX(e.reel), 0, 0.7);
                if (f) this.fx.beam(f.home, to, '#9aa0b8', 0.04, 0.4);
                this.fx.burst(to, '#9aa0b8', 18, 1.6, 0.28);
                break;
            }
            case 'eheal': {
                const f = foeAt(e.j);
                if (f) this.fx.burst(f.home, SYMBOLS.mend.color, 24, 1.8, 0.3);
                break;
            }
            case 'win':
                this.fx.burst(this.paylinePoint(), '#fff2a8', 60, 4, 0.4);
                break;
        }
    }

    /** True while a reel is still turning. */
    busy() { return this.machine.busy(); }

    frame(G, dt, time, sel) {
        this.time = time;
        this.resize();
        this.machine.setSel(G.b && G.phase === 'battle' && G.b.spun ? sel : -1);
        this.backdrop.frame(dt, time, this.calm);
        this.machine.frame(dt, time, this.calm);
        for (const f of this.foes) f.frame(dt, time, this.calm);
        this.fx.frame(dt);
        // camera shake when you're hit
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const s = this.calm ? this.shake * 0.3 : this.shake;
        if (this.camBase) {
            this.camera.position.set(this.camBase.x + Math.sin(time * 53) * s * 0.12, this.camBase.y + Math.cos(time * 47) * s * 0.1, this.camBase.z);
        }
        this.hurt = Math.max(0, this.hurt - dt * 1.8);
        this.crt.uniforms.uHurt.value = this.hurt;
        this.composer.render(dt);
    }
}
