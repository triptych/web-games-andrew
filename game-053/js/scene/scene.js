// Renderer and the two layers (world + frame), camera views that track the
// DOM scene window, foes and combat animation, quality and the render loop.
//
// Gotchas kept in mind: updateProjectionMatrix() after any camera change;
// dt capped at 0.05 s; THREE.Color takes 0..1 floats.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World, VIEWS } from './world3d.js';
import { Frame } from './frame.js';
import { buildFoe } from './foes.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FOG = {
    forest: [6, 55, 0.55], clearing: [5, 48, 0.5], healer: [6, 55, 0.6],
    shades: [4, 45, 1], graveyard: [3, 40, 1], graveyardfight: [3, 36, 1], mausoleum: [3, 40, 1],
    lair: [8, 80, 0.4], lairfight: [6, 60, 0.35],
};

export async function createScene(container, opts = {}) {
    const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
    let quality = resolveQuality(opts.quality, isMobile);
    const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.autoClear = false;
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const world = new World({ shadows: quality === 'high', lowTrees: quality !== 'high' });
    const frame = new Frame(renderer, env);
    return new SceneCtl({ renderer, world, frame, quality, isMobile, motion: opts.motion !== false });
}

function resolveQuality(q, mobile) {
    if (q === 'high' || q === 'low' || q === 'off') return q;
    return mobile ? 'low' : 'high';
}

class SceneCtl {
    constructor({ renderer, world, frame, quality, isMobile, motion }) {
        Object.assign(this, { renderer, world, frame, quality, isMobile, motion });
        this.camPos = VIEWS.title.pos.clone();
        this.camTgt = VIEWS.title.tgt.clone();
        this.from = null; this.to = null; this.tweenT = 1;
        this.view = 'title';
        this.foe = null; this.pendingFoe = null; this.foeState = null;
        this.queue = [];
        this.shake = 0;
        this.t = 0;
        this.dirty = 2;
        this.dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.25);
        this.frameTimes = [];
        this.clock = new THREE.Clock();
        this.layout();
        this.world.setTime(1150, true);
        document.body.classList.toggle('blur', quality === 'high');
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    // -------------------------------------------------------------- layout
    layout() {
        const W = window.innerWidth, H = window.innerHeight;
        this.renderer.setPixelRatio(this.dpr);
        this.renderer.setSize(W, H, false);
        this.W = W; this.H = H;
        const app = document.getElementById('app');
        const inGame = app && !app.classList.contains('hidden');
        const winEl = document.getElementById('scenewin');
        let r = inGame && winEl ? winEl.getBoundingClientRect() : null;
        if (!r || r.width < 10) r = { left: 0, top: 0, right: W, bottom: H, width: W, height: H };
        this.win = r;
        this.inGame = inGame;
        // world camera: centre its optical axis on the scene window
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const fullW = 2 * Math.max(cx, W - cx), fullH = 2 * Math.max(cy, H - cy);
        const cam = this.world.camera;
        const fovWin = r.width / r.height < 1.3 ? 58 : 48;
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(fovWin / 2)) * (fullH / r.height);
        cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf));
        cam.aspect = fullW / fullH;
        cam.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, W, H);
        cam.updateProjectionMatrix();
        const top = document.getElementById('top');
        const topH = top && inGame ? top.getBoundingClientRect().height : 0;
        this.frameVisible = inGame;
        if (inGame) this.frame.layout(W, H, topH, r, W < 760 || H < 520);
        this.dirty = 2;
    }

    setQuality(q, motion) {
        this.motion = motion;
        const nq = resolveQuality(q, this.isMobile);
        if (nq !== this.quality) {
            this.quality = nq;
            this.dpr = Math.min(window.devicePixelRatio || 1, nq === 'high' ? 1.75 : 1.25);
            document.body.classList.toggle('blur', nq === 'high');
            this.layout();
        }
        this.dirty = 2;
    }

    // -------------------------------------------------------------- views
    setView(name) {
        const v = VIEWS[name] || VIEWS.village;
        if (name === this.view && this.to) { this.dirty = 2; return; }
        this.view = name;
        this.from = { pos: this.camPos.clone(), tgt: this.camTgt.clone() };
        this.to = v;
        const far = this.from.pos.distanceTo(v.pos);
        this.tweenDur = Math.min(2.2, 0.9 + far / 60);
        this.tweenT = this.motion && this.quality !== 'off' ? 0 : 1;
        if (this.tweenT >= 1) { this.camPos.copy(v.pos); this.camTgt.copy(v.tgt); }
        // fog per view
        const f = FOG[name];
        const fog = this.world.scene.fog;
        this.fogTo = f ? [f[0], f[1]] : [40, 170];
        // foe handling
        if (v.foe && this.pendingFoe) this.spawnFoe(this.pendingFoe, v.foe);
        else if (!v.foe) this.removeFoe();
        this.world.eyesVisible = name !== 'lairfight';
        this.world.focus = v.tgt;
        this.dirty = 3;
    }
    snapView() { if (this.to) { this.camPos.copy(this.to.pos); this.camTgt.copy(this.to.tgt); this.tweenT = 1; } }
    setTime(min, alive) { this.world.setTime(min, alive); this.frame.setNight(this.world.night); this.dirty = 2; }

    // -------------------------------------------------------------- foes
    showFoe(c) { this.pendingFoe = c; const v = VIEWS[this.view]; if (v && v.foe) this.spawnFoe(c, v.foe); }
    hideFoe() { this.pendingFoe = null; if (this.foe && this.foeState?.mode !== 'die') this.removeFoe(); }
    foeDie() { if (this.foe) { this.foeState.mode = 'die'; this.foeState.t = 0; } this.pendingFoe = null; }

    spawnFoe(c, spot) {
        this.removeFoe();
        const m = buildFoe(c);
        m.position.copy(spot);
        const cam = (VIEWS[this.view] || VIEWS.clearing).pos;
        m.rotation.y = Math.atan2(cam.x - spot.x, cam.z - spot.z);
        this.world.scene.add(m);
        this.foe = m;
        this.foeState = { mode: 'spawn', t: 0, hit: 0, lunge: 0, base: spot.clone(), scale: m.scale.x };
        m.scale.setScalar(0.01);
        this.pendingFoe = null;
        this.dirty = 3;
    }
    removeFoe() {
        if (!this.foe) return;
        this.world.scene.remove(this.foe);
        this.foe.traverse((o) => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => mm.dispose()); });
        this.foe = null; this.foeState = null;
    }

    combatEvents(events) {
        let delay = 0;
        for (const e of events.slice(0, 12)) { this.queue.push({ at: this.t + delay, e }); delay += this.motion ? 0.16 : 0; }
    }

    playEvent(e) {
        const fs = this.foeState;
        if (e.who === 'foe') {
            if (e.type === 'miss') this.number('MISS', 'miss', true);
            else { this.number(e.dmg, e.type === 'power' ? 'power' : '', true); if (fs) { fs.hit = 1; } if (e.type === 'power') this.shake = Math.max(this.shake, 0.25); }
        } else {
            if (e.type === 'heal') this.number('+' + e.dmg, 'heal', false);
            else if (e.type === 'miss') { this.number('miss', 'miss', false); if (fs) fs.lunge = 1; }
            else {
                if (fs) fs.lunge = 1;
                this.number(e.dmg, 'you', false);
                this.shake = Math.max(this.shake, e.type === 'breath' ? 0.8 : 0.3);
                const fx = document.getElementById('fx-layer');
                if (fx && this.motion) { const d = document.createElement('div'); d.className = 'flash-red'; fx.append(d); setTimeout(() => d.remove(), 520); }
                if (e.type === 'breath' && fs) fs.breath = 1;
            }
        }
        this.dirty = 3;
    }

    number(text, cls, onFoe) {
        const fx = document.getElementById('fx-layer');
        if (!fx || !this.inGame) return;
        const r = this.win;
        let x = r.width / 2, y = r.height * 0.72;
        if (onFoe && this.foe) {
            const p = this.foe.position.clone(); p.y += this.foe.userData.height * 0.85;
            p.project(this.world.camera);
            x = (p.x * 0.5 + 0.5) * this.W - r.left; y = (-p.y * 0.5 + 0.5) * this.H - r.top;
            x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 16;
        } else { x += (Math.random() - 0.5) * 60; }
        const d = document.createElement('div');
        d.className = 'dmg ' + cls; d.textContent = text;
        d.style.left = Math.max(20, Math.min(r.width - 20, x)) + 'px';
        d.style.top = Math.max(20, Math.min(r.height - 20, y)) + 'px';
        fx.append(d);
        setTimeout(() => d.remove(), 1150);
        while (fx.children.length > 14) fx.firstChild.remove();
    }

    animateFoe(dt) {
        const m = this.foe, s = this.foeState; if (!m) return;
        const P = m.userData.parts;
        const t = this.t;
        s.t += dt;
        if (s.mode === 'spawn') { const k = Math.min(1, s.t / 0.6); m.scale.setScalar(s.scale * ease(k)); if (k >= 1) { s.mode = 'idle'; } }
        if (s.mode === 'die') {
            const k = Math.min(1, s.t / 1.2);
            m.position.y = s.base.y - k * 1.2 * (m.userData.kind === 'dragon' ? 3 : 1);
            m.rotation.z = k * 0.5;
            m.scale.setScalar(s.scale * (1 - k * 0.6));
            m.traverse((o) => { if (o.material && 'opacity' in o.material) { o.material.transparent = true; o.material.opacity = Math.min(o.material.opacity, 1 - k); } });
            if (k >= 1) this.removeFoe();
            return;
        }
        // idle breathing / bob
        const bob = Math.sin(t * 2.2) * 0.04;
        P.bob.position.y = (m.userData.kind === 'flyer' ? Math.sin(t * 3) * 0.2 : m.userData.kind === 'spirit' ? Math.sin(t * 1.5) * 0.15 + 0.1 : bob);
        if (P.squish) { const q = Math.sin(t * 3); P.squish.scale.set(1.15 + q * 0.06, 0.85 - q * 0.06, 1.15 + q * 0.06); }
        if (P.wings) for (const { w, s: sd } of P.wings) w.rotation.z = sd * Math.sin(t * (m.userData.kind === 'dragon' ? 1.6 : 9)) * (m.userData.kind === 'dragon' ? 0.25 : 0.6);
        if (P.vines) P.vines.forEach((v, i) => { v.rotation.x = Math.sin(t * 1.8 + i) * 0.3; });
        if (P.head) P.head.rotation.y = Math.sin(t * 0.7) * 0.2;
        if (P.arm) P.arm.rotation.x = -0.3 + Math.sin(t * 1.5) * 0.1;
        if (P.jaw) P.jaw.rotation.x = 0.1 + Math.max(0, Math.sin(t * 0.8)) * 0.2;
        // lunge toward the camera when it attacks you
        if (s.lunge > 0) {
            s.lunge = Math.max(0, s.lunge - dt * 3);
            const k = Math.sin((1 - s.lunge) * Math.PI);
            const cam = this.camPos;
            const dir = cam.clone().sub(s.base).setY(0).normalize();
            m.position.copy(s.base).addScaledVector(dir, k * (m.userData.kind === 'dragon' ? 1.5 : 0.9));
            if (P.arm) P.arm.rotation.x = -0.3 - k * 1.6;
            if (P.jaw) P.jaw.rotation.x = 0.1 + k * 0.6;
        } else m.position.lerp(s.base, Math.min(1, dt * 8));
        // flash and recoil when hit
        if (s.hit > 0) {
            s.hit = Math.max(0, s.hit - dt * 3.5);
            m.traverse((o) => { if (o.material && o.material.emissive && o.userData.baseEmissive) o.material.emissive.copy(o.userData.baseEmissive).lerp(new THREE.Color(0xff3020), s.hit * 0.8); });
            m.rotation.x = -s.hit * 0.15;
            P.bob.position.x = Math.sin(t * 60) * 0.06 * s.hit;
        }
        if (P.mouthLight) P.mouthLight.intensity = 20 + (s.breath > 0 ? s.breath * 200 : Math.sin(t * 2) * 8);
        if (s.breath > 0) s.breath = Math.max(0, s.breath - dt * 0.8);
    }

    // -------------------------------------------------------------- loop
    loop() {
        requestAnimationFrame(this.loop);
        let dt = this.clock.getDelta();
        if (this.quality === 'off' && this.dirty <= 0 && !this.foe && this.tweenT >= 1) return;
        if (this.quality === 'low' && !this.foe && this.tweenT >= 1) { this.skip = !this.skip; if (this.skip) { this.acc = (this.acc || 0) + dt; return; } }
        const raw = Math.min(dt + (this.acc || 0), 0.3); this.acc = 0;
        dt = Math.min(raw, 0.05);
        const t0 = performance.now();
        this.t += dt;
        // events
        this.t += raw - dt;
        if (this.queue.length) { const due = this.queue.filter((q) => q.at <= this.t); this.queue = this.queue.filter((q) => q.at > this.t); for (const q of due) this.playEvent(q.e); }
        // camera tween
        if (this.to && this.tweenT < 1) {
            this.tweenT = Math.min(1, this.tweenT + raw / this.tweenDur);
            const k = ease(this.tweenT);
            this.camPos.lerpVectors(this.from.pos, this.to.pos, k);
            // lift the camera in the middle of long moves
            const lift = Math.sin(k * Math.PI) * Math.min(12, this.from.pos.distanceTo(this.to.pos) * 0.15);
            this.camPos.y += lift;
            this.camTgt.lerpVectors(this.from.tgt, this.to.tgt, k);
        }
        const fog = this.world.scene.fog;
        if (this.fogTo) { fog.near += (this.fogTo[0] - fog.near) * Math.min(1, dt * 2); fog.far += (this.fogTo[1] - fog.far) * Math.min(1, dt * 2); }
        const cam = this.world.camera;
        cam.position.copy(this.camPos);
        if (this.motion) {
            const sway = this.view === 'title' ? 0 : 1;
            cam.position.x += Math.sin(this.t * 0.31) * 0.12 * sway;
            cam.position.y += Math.sin(this.t * 0.47) * 0.06 * sway;
            if (this.view === 'title') {
                const a = this.t * 0.03;
                const base = VIEWS.title.pos;
                const r = Math.hypot(base.x, base.z);
                if (this.tweenT >= 1) { cam.position.set(Math.cos(a + 0.94) * r, base.y + Math.sin(this.t * 0.1) * 2, Math.sin(a + 0.94) * r); }
            }
        }
        if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.6); const s = this.shake * 0.12; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; }
        cam.lookAt(this.camTgt);
        this.world.update(this.t, this.motion ? dt : 0);
        this.animateFoe(raw);
        if (this.frameVisible) this.frame.update(dt, this.motion);
        const r = this.renderer;
        if (r.shadowMap.enabled) { r.shadowMap.autoUpdate = false; this.fc = (this.fc || 0) + 1; if (this.fc % 4 === 0 || this.tweenT < 1 || this.foe) r.shadowMap.needsUpdate = true; }
        r.clear();
        r.render(this.world.scene, cam);
        if (this.frameVisible) { r.clearDepth(); r.render(this.frame.scene, this.frame.camera); }
        if (this.dirty > 0) this.dirty--;
        this.adapt(performance.now() - t0, dt);
    }

    adapt(ms, dt) {
        if (this.quality === 'off') return;
        this.frameTimes.push(dt);
        if (this.frameTimes.length < 90) return;
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.frameTimes.length = 0;
        if (avg > 0.034 && this.dpr > 0.75) { this.dpr = Math.max(0.75, this.dpr - 0.25); this.layout(); }
        else if (avg < 0.018 && this.dpr < Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.75 : 1.25)) { this.dpr = Math.min(this.dpr + 0.25, 2); this.layout(); }
    }
}
