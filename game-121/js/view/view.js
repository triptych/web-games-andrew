// The three.js view. It reads G every frame and answers the sim's events; it never changes G.
// First person: the camera is your seat at the round table. It leans toward whatever you are doing: the guest,
// the crystal ball, the cards.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildStage, POS, slotWorld } from './stage.js';
import { buildPerson } from './people.js';
import { buildModelPerson, preloadModels, modelReady } from './models.js';
import { drawSky, TOD_LIGHT } from './textures.js';
import { TIMING } from '../config.js';
import { COLOURS, OMENS } from '../sim/data/lexicon.js';
import { CAND } from '../sim/data/romance.js';
import { PRINCE } from '../sim/data/story.js';

import { roundBloom } from '../../../lib/round-bloom.js';

const TAU = Math.PI * 2;
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const CAMS = {
    title:  { p: [0.0, 1.38, 1.15], l: [0, 1.0, -0.55] },
    client: { p: [0.0, 1.56, 0.62], l: [0, 1.2, -1.5] },
    ball:   { p: [0.0, 1.2, 0.4],   l: [0, 1.07, -0.5] },
    deal:   { p: [0.0, 1.25, 0.7],  l: [0, 0.70, 0.06] },
    cards:  { p: [0.0, 1.25, 0.7],  l: [0, 0.84, 0.0] },
};

export class View {
    constructor(canvas, { quality = 'auto' } = {}) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        const gl = this.renderer.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
        this.software = /swiftshader|llvmpipe|software/i.test(gpu);
        this.q = quality === 'auto' ? (this.software ? 'low' : 'high') : quality;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(58, 1, 0.05, 40);
        this.S = buildStage(this.scene, this.renderer, { high: this.q === 'high' });
        // The named characters are Meshy models (assets/models). ?models=0 keeps the built-in people for everyone.
        this.useModels = !/[?&]models=0\b/.test(location.search);
        if (this.useModels) preloadModels();
        this.camState = { p: new THREE.Vector3(...CAMS.title.p), l: new THREE.Vector3(...CAMS.title.l) };

        this.t = 0;
        this.mode = 'title';
        this.person = null;                  // { key, p, u, target, look, yaw }
        this.sceneWho = null;                // who sits across from you in an evening scene
        this.talking = false;
        this.line = { w: 'n', m: 'n' };
        this.moodHold = 0;
        this.tod = 'dusk'; this.festival = false; this.todMix = 1;
        this.light = { hemi: new THREE.Color(0x8a6ac0), sun: new THREE.Color(0xff9a7a), int: 0.55 };
        this.vstate = [null, null, null];
        this.omen = null;
        this.tint = 0; this.tintCol = new THREE.Color('#ffa860');
        this.flash = 0; this.shake = 0;
        this.fwT = 0;
        this.handBoost = 0; this.dealT = 0;
        this.doorAngle = 0;
        this.burstQueue = [];

        this.raven = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ravenTexture(), transparent: true, opacity: 0, depthWrite: false }));
        this.raven.scale.set(0.26, 0.2, 1); this.raven.position.copy(this.S.sillPos); this.scene.add(this.raven);

        this.buildComposer();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this.setTod('dusk', false);
        this.setCardsTitle();
    }

    ravenTexture() {
        const c = document.createElement('canvas'); c.width = 128; c.height = 100; const x = c.getContext('2d');
        x.fillStyle = '#0a0612'; x.beginPath(); x.ellipse(60, 62, 34, 22, -0.2, 0, TAU); x.fill();
        x.beginPath(); x.arc(92, 40, 15, 0, TAU); x.fill(); x.beginPath(); x.moveTo(104, 38); x.lineTo(126, 46); x.lineTo(104, 50); x.fill();
        x.beginPath(); x.moveTo(30, 62); x.lineTo(2, 82); x.lineTo(28, 76); x.lineTo(8, 96); x.lineTo(40, 80); x.fill();
        x.fillStyle = '#ffd25a'; x.beginPath(); x.arc(96, 37, 3, 0, TAU); x.fill();
        x.strokeStyle = '#0a0612'; x.lineWidth = 3; x.beginPath(); x.moveTo(56, 80); x.lineTo(56, 92); x.moveTo(70, 80); x.lineTo(70, 92); x.stroke();
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }

    buildComposer() {
        this.composer = null; this.bloom = null;
        if (this.q !== 'high') return;
        const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
        this.composer = new EffectComposer(this.renderer, rt);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.5, 0.6, 0.88);
        roundBloom(this.bloom);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, this.q === 'high' ? 2 : 1);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);                                   // also sets the canvas CSS size in px
        this.canvas.style.left = '0px'; this.canvas.style.top = '0px';
        this.composer?.setPixelRatio(dpr); this.composer?.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.fov = w / h > 1.3 ? 56 : w / h > 0.85 ? 63 : 74;
        this.camera.updateProjectionMatrix();
        const k = (this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 2) / Math.tan((this.camera.fov * Math.PI) / 360);
        this.S.fx.setK(k); this.S.dust.setK(k);
    }

    // ------------------------------------------------------------------ sky and light
    setTod(tod, festival) {
        if (tod === this.tod && festival === this.festival && this.skyDone) return;
        this.tod = tod; this.festival = festival; this.skyDone = true;
        drawSky(this.S.sky.canvas, tod, festival);
        this.S.sky.tex.needsUpdate = true;
    }

    todFor(G) {
        const ph = G.phase;
        if (['scene', 'festival', 'finale', 'ending'].includes(ph)) return ['night', ph !== 'scene'];
        if (ph === 'dusk' || ph === 'plot') return ['dusk', G.day === 7];
        if (G.queue?.length && G.client) {
            const n = G.queue.length - 1 || 1;
            const f = G.idx / n;
            return [f < 0.34 ? 'dawn' : f < 0.99 ? 'day' : 'dusk', G.day === 7];
        }
        return [this.tod, this.festival];
    }

    // ------------------------------------------------------------------ people
    wanted(G) {
        const ph = G.phase;
        if (G.client && ['arrive', 'talk', 'ready', 'ball', 'deal', 'flip', 'style', 'react'].includes(ph)) return { key: 'c:' + G.client.id, look: G.client.look, go: 1 };
        if (G.client && ph === 'leave') return { key: 'c:' + G.client.id, look: G.client.look, go: 0 };
        if ((ph === 'scene' || ph === 'finale') && this.sceneWho) return { key: 's:' + this.sceneWho.key, look: this.sceneWho.look, go: 1 };
        return null;
    }

    updatePerson(G, dt, t) {
        const w = this.wanted(G);
        let P = this.person;
        if (P && (!w || w.key !== P.key)) {
            P.target = 0; P.fast = !!w;                      // the old guest goes (quickly if a new one is waiting)
            if (P.u <= 0.002) { this.scene.remove(P.p.group); P.p.dispose(); this.person = P = null; }
        }
        if (w && !this.person) {
            const p = (this.useModels && w.look.model && buildModelPerson(w.look)) || buildPerson(w.look);
            p.group.visible = false;
            this.scene.add(p.group);
            P = this.person = { key: w.key, p, def: w.look, u: 0, target: w.go, look: new THREE.Vector3(), yaw: 0, fast: false };
        }
        if (!P) return;
        // the model was still loading when this guest arrived: swap it in as soon as it is ready
        if (!P.p.model && this.useModels && P.def.model && modelReady(P.def.model)) {
            const next = buildModelPerson(P.def);
            if (next) {
                next.group.visible = P.p.group.visible;
                this.scene.add(next.group); this.scene.remove(P.p.group); P.p.dispose();
                P.p = next;
            }
        }
        if (w && w.key === P.key) P.target = w.go;
        const walking = G.phase === 'arrive' || G.phase === 'leave';
        const speed = P.fast ? 1 / 0.35 : G.phase === 'leave' ? 1 / 1.4 : walking ? 1 / 2.4 : 1 / 0.9;
        P.u += Math.sign(P.target - P.u) * Math.min(Math.abs(P.target - P.u), dt * speed);
        const u = P.u;
        // the walk: door -> a curve -> the chair; the sit comes at the very end
        const a = POS.door, b = new THREE.Vector3(-0.95, 0, -1.9), c = new THREE.Vector3(0, 0, -1.58);
        const s = ease(clamp01(u / 0.84));
        const pos = new THREE.Vector3().copy(a).multiplyScalar((1 - s) * (1 - s)).addScaledVector(b, 2 * s * (1 - s)).addScaledVector(c, s * s);
        const tan = new THREE.Vector3().copy(b).sub(a).multiplyScalar(2 * (1 - s)).addScaledVector(new THREE.Vector3().copy(c).sub(b), 2 * s);
        const seat = ease(clamp01((u - 0.82) / 0.18));
        const moving = P.u !== P.target;
        const heading = P.target >= P.u ? Math.atan2(tan.x, tan.z) : Math.atan2(-tan.x, -tan.z);
        P.yaw = lerp(P.yaw, moving ? heading : 0, Math.min(1, dt * 8));
        const faceAmt = seat;
        P.p.group.position.copy(pos);
        P.p.group.rotation.y = lerp(P.yaw, 0, faceAmt);
        P.p.group.visible = u > 0.003 || P.target > 0;
        P.look.copy(this.camera.position);
        const mood = this.line.w === 'c' ? this.line.m : 'n';
        P.p.update(dt, t, { mood, talking: this.talking && this.line.w === 'c', seat, walk: moving && seat < 0.9 ? 1 : 0, look: seat > 0.5 ? this.camera.position : null });
    }

    // ------------------------------------------------------------------ the ball
    visionKey(v, i) { return v ? v.sym + v.col + (v.clouded ? 'c' : '') : ''; }

    syncVisions(G) {
        const want = [null, null, null];
        const live = G.reading && G.ball && ['ball', 'deal', 'flip', 'style', 'react'].includes(G.phase);
        if (live) for (let i = 0; i < 3; i++) if (i < G.ball.shown) want[i] = G.reading.visions[i];
        const B = this.S.ball;
        for (let i = 0; i < 3; i++) {
            const k = this.visionKey(want[i], i), st = this.vstate[i];
            if (!want[i]) { if (st) { st.out = true; } continue; }
            if (!st || st.key !== k) {
                const fresh = !st || st.out || st.sym !== want[i].sym;
                const burst = !!st && !st.out && st.clouded && !want[i].clouded;
                const v = want[i];
                this.vstate[i] = { key: k, sym: v.sym, clouded: v.clouded, col: v.col, t: fresh ? 0 : 0.6, out: false };
                B.vis[i].material.map = v.clouded ? this.S.cloudTexture(COLOURS[v.col].hex) : this.S.glyphTexture(v.sym, COLOURS[v.col].hex);
                B.vis[i].material.needsUpdate = true;
                this.setBallColour(COLOURS[v.col].hex, 1);
                this.burst(B.group.position.clone().add(B.vis[i].position), COLOURS[v.col].hex, burst ? 40 : 22, 0.5);
            }
        }
    }

    setBallColour(hex, kick = 0) {
        const c = new THREE.Color(hex), B = this.S.ball;
        B.shell.material.uniforms.uA.value.copy(c);
        B.shell.material.uniforms.uB.value.copy(c).lerp(new THREE.Color('#ffffff'), 0.35).offsetHSL(0.08, 0, 0);
        B.light.color.copy(c); B.core.material.color.copy(c);
        this.ballKick = Math.max(this.ballKick || 0, kick);
    }

    updateBall(G, dt, t) {
        const B = this.S.ball, u = B.shell.material.uniforms;
        u.uTime.value = t;
        this.ballKick = Math.max(0, (this.ballKick || 0) - dt * 0.8);
        const gazing = ['ball', 'deal'].includes(G.phase);
        const e = (gazing ? 0.8 : this.mode === 'title' ? 0.6 : 0.42) + this.ballKick * 0.7 + Math.sin(t * 1.3) * 0.06;
        u.uE.value = lerp(u.uE.value, e, Math.min(1, dt * 4));
        B.light.intensity = lerp(B.light.intensity, (gazing ? 1.6 : 0.5) + this.ballKick * 2, Math.min(1, dt * 4));
        B.core.scale.setScalar(1 + Math.sin(t * 2.1) * 0.05 + this.ballKick * 0.15);
        B.group.position.y = POS.ball.y + Math.sin(t * 0.9) * 0.0;
        this.syncVisions(G);
        for (let i = 0; i < 3; i++) {
            const st = this.vstate[i], sp = B.vis[i];
            if (!st) { sp.material.opacity = 0; continue; }
            st.t += dt;
            const k = st.out ? Math.max(0, 1 - (st.t - (st.outT ?? (st.outT = st.t))) * 3) : backOut(clamp01(st.t / 0.9));
            if (st.out && k <= 0) { this.vstate[i] = null; sp.material.opacity = 0; continue; }
            const size = 0.115 * (st.out ? k : Math.max(0.001, k)) * (1 + Math.sin(t * 2.4 + i) * 0.04);
            sp.scale.setScalar(size);
            sp.material.opacity = (st.out ? k : clamp01(st.t / 0.5)) * (st.clouded ? 0.8 : 1);
            sp.material.rotation = st.clouded ? t * 0.6 + i : Math.sin(t * 0.9 + i) * 0.08;
            sp.position.y = (i === 1 ? 0.012 : -0.01) + Math.sin(t * 1.4 + i * 1.7) * 0.006;
        }
    }

    burst(p, colour, n = 24, speed = 0.4, size = 0.02) {
        const c = new THREE.Color(colour);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, e = (Math.random() - 0.3) * 1.6, s = speed * (0.4 + Math.random());
            this.S.fx.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: Math.sin(e) * s + 0.1, vz: Math.sin(a) * s, life: 0.8 + Math.random() * 0.9, size: size * (0.5 + Math.random()), color: c, alpha: 0.9, grav: 0.15, drag: 1.6 });
        }
    }

    // ------------------------------------------------------------------ omens
    startOmen(theme) {
        this.omen = { theme, t: 0 };
        this.tintCol.set(OMENS[theme].tint);
        this.tint = 1;
    }

    updateOmen(dt) {
        const S = this.S, o = this.omen;
        this.raven.material.opacity = lerp(this.raven.material.opacity, o && o.theme === 'betrayal' && o.t < 7 ? 1 : 0, Math.min(1, dt * 3));
        for (const c of S.curtains) c.rotation.z = lerp(c.rotation.z, 0, Math.min(1, dt * 3));
        S.journal.page.rotation.z = lerp(S.journal.page.rotation.z, 0, Math.min(1, dt * 3));
        if (!o) { this.tint = Math.max(0, this.tint - dt * 0.5); return; }
        o.t += dt;
        const T = o.t, fx = S.fx, R = Math.random;
        const dur = 7;
        this.tint = o.t < 5.5 ? Math.min(1, this.tint + dt * 2) : Math.max(0, this.tint - dt * 0.7);
        const rate = (per) => R() < per * dt;
        switch (o.theme) {
            case 'love': if (rate(30)) fx.emit({ x: (R() - 0.5) * 1.2, y: 2.1, z: -1 + R() * 1.4, vx: (R() - 0.5) * 0.1, vy: -0.25, vz: 0, life: 4, size: 0.035, color: R() < 0.5 ? '#ff7ab8' : '#ffc2d8', alpha: 0.8, grav: 0.05, drag: 0.2 }); break;
            case 'loss': if (rate(70)) fx.emit({ x: (R() - 0.5) * 2.4, y: 2.5, z: -2.5 + R() * 4, vy: -3, life: 1, size: 0.012, color: '#8fb0ff', alpha: 0.7, drag: 0 }); this.dim = 0.6; break;
            case 'wealth': if (rate(40)) fx.emit({ x: (R() - 0.5) * 1.0, y: 1.0 + R() * 0.8, z: -1.0 + R() * 0.9, vy: 0.1, life: 1.4, size: 0.03, color: '#ffd25a', alpha: 0.95, drag: 1 }); break;
            case 'betrayal': if (rate(24)) fx.emit({ x: S.sillPos.x + (R() - 0.5) * 0.3, y: S.sillPos.y + 0.1, z: S.sillPos.z + 0.1, vx: (R() - 0.5) * 0.2, vy: 0.1, life: 1.8, size: 0.03, color: '#b04dff', alpha: 0.7, drag: 0.5 }); break;
            case 'journey': this.sway = 1; if (rate(20)) fx.emit({ x: (R() - 0.5) * 2, y: 1 + R() * 1.2, z: -2.5, vz: 1.4, life: 2.4, size: 0.02, color: '#6fd0ff', alpha: 0.6, drag: 0 }); break;
            case 'health': if (rate(50)) fx.emit({ x: S.incensePos.x + (R() - 0.5) * 0.02, y: S.incensePos.y, z: S.incensePos.z, vx: Math.sin(T * 2) * 0.05, vy: 0.2, life: 3, size: 0.05, color: '#58f0a0', alpha: 0.5, drag: 0.4 }); break;
            case 'family': this.warm = 1; break;
            case 'ambition': this.tall = 1; break;
            case 'secret': for (const [i, c] of S.curtains.entries()) c.rotation.z = Math.sin(T * 2.4 + i) * 0.05 * Math.min(1, T); if (rate(24)) fx.emit({ x: 0.3 + R() * 1.1, y: 1.0 + R() * 1, z: -2.9, vx: (R() - 0.5) * 0.1, vy: 0.05, life: 2, size: 0.04, color: '#a58cff', alpha: 0.5, drag: 0.5 }); break;
            case 'danger': if (T < 5 && R() < 0.5 * dt * 4) this.flash = 1; this.shake = Math.max(this.shake, 0.6); break;
            case 'change': S.journal.page.rotation.z = Math.sin(T * 3) * 1.3 * Math.min(1, T); if (rate(30)) fx.emit({ x: S.journal.group.position.x + (R() - 0.5) * 0.15, y: POS.topY + 0.05, z: S.journal.group.position.z, vy: 0.4, life: 1.4, size: 0.025, color: '#7ff0e0', alpha: 0.8, drag: 0.8 }); break;
            case 'hope': if (rate(40)) fx.emit({ x: 0.85 + (R() - 0.5) * 0.4, y: 1.9, z: -2.7, vx: -0.15 + (R() - 0.5) * 0.05, vy: -0.4, vz: 0.5, life: 2.8, size: 0.04, color: '#fff0b0', alpha: 0.7, drag: 0.2 }); this.sunBeam = 1; break;
            default: break;
        }
        if (T > dur) this.omen = null;
    }

    // ------------------------------------------------------------------ the cards on the table
    setCardsTitle() {
        const ids = [18, 17, 19];
        this.S.cards.forEach((c, i) => { this.S.setCardFace(c, ids[i]); c.outer.visible = true; c.shown = true; c.anim = 1; c.flipped = true; c.flipT = 1; });
    }

    updateCards(G, dt, t) {
        const S = this.S;
        const title = this.mode === 'title';
        const R = G.reading;
        S.cards.forEach((c, i) => {
            const slot = slotWorld(i);
            let placed = false, hand = null;
            if (title) { c.outer.visible = true; c.outer.position.set(slot.x, 1.0 + Math.sin(t * 0.8 + i * 1.6) * 0.04, slot.z - 0.15); c.outer.rotation.set(0, Math.sin(t * 0.3 + i) * 0.2, 0); c.inner.rotation.x = -Math.PI / 2 + 0.7; c.inner.rotation.z = 0; c.aura.material.opacity = 0.25; return; }
            if (R && ['deal', 'flip', 'style', 'react'].includes(G.phase) && R.placed[i] !== null && R.placed[i] !== undefined) { placed = true; hand = R.hand[R.placed[i]]; }
            if (placed) {
                if (!c.shown || c.face !== hand.c) { if (!c.shown) { c.anim = 0; c.flipT = 0; c.flipped = false; } S.setCardFace(c, hand.c); c.shown = true; }
                c.anim = Math.min(1, c.anim + dt * 2.4);
                c.outer.visible = true;
                // a rim of reversed cards: turned about their own centre
                c.outer.rotation.set(0, hand.r ? Math.PI : 0, 0);
                const drop = ease(clamp01(c.anim));
                c.outer.position.set(slot.x, lerp(slot.y + 0.32, slot.y, drop), lerp(slot.z + 0.2, slot.z, drop));
                // flip timing follows the sim's flip phase
                const flipping = G.phase === 'flip' ? clamp01((G.pt - i * 0.55) / 0.9) : (G.phase === 'deal' ? 0 : 1);
                c.flipT = lerp(c.flipT || 0, flipping, Math.min(1, dt * 14));
                const f = ease(clamp01(flipping));
                c.inner.rotation.x = Math.PI / 2 - Math.PI * f;
                c.inner.rotation.z = 0;
                c.outer.position.y += Math.sin(Math.PI * f) * 0.16 + (G.phase === 'deal' ? 0 : 0);
                if (f >= 1 && !c.flipped) { c.flipped = true; this.burst(new THREE.Vector3(slot.x, slot.y + 0.05, slot.z), '#ffe9a0', 18, 0.35, 0.018); }
                if (f < 1) c.flipped = false;
                c.aura.material.opacity = lerp(c.aura.material.opacity, f >= 1 ? 0.55 + Math.sin(t * 2 + i) * 0.12 : 0.25, Math.min(1, dt * 6));
            } else if (c.shown) {
                // gather the card up and away
                c.anim = Math.max(0, c.anim - dt * 3);
                c.outer.position.y += dt * 0.5;
                c.aura.material.opacity = Math.max(0, c.aura.material.opacity - dt * 2);
                if (c.anim <= 0) { c.shown = false; c.outer.visible = false; c.flipped = false; }
            } else { c.outer.visible = false; c.aura.material.opacity = 0; }
        });
    }

    // ------------------------------------------------------------------ your hands
    updateHands(G, dt, t) {
        const S = this.S, ph = G.phase;
        const k = Math.min(1, dt * 4);
        this.dealT = Math.max(0, this.dealT - dt);
        S.hands.forEach((h, idx) => {
            const s = h.s;
            let tp = new THREE.Vector3(s * 0.36, 0.62, 0.5), rz = 0, ry = 0, rx = 0, glow = 0;
            h.group.visible = this.mode !== 'title';
            if (this.mode === 'title') tp.set(s * 0.36, 0.6, 0.5);
            else if (ph === 'ball' || (ph === 'ready')) {
                const gaze = ph === 'ball';
                tp.set(s * (gaze ? 0.25 : 0.3), gaze ? 0.97 : 0.7, gaze ? -0.34 : 0.2); rz = -s * (gaze ? 0.5 : 0); rx = gaze ? -0.2 : 0; glow = gaze ? 0.55 + Math.sin(t * 3 + idx) * 0.2 : 0;
                if (gaze) { tp.x += Math.sin(t * 1.3 + idx * 3) * 0.015; tp.y += Math.sin(t * 1.7 + idx) * 0.012; }
            } else if (ph === 'deal') {
                tp.set(s * 0.3, 0.93, 0.22 - (s > 0 && this.dealT > 0 ? 0.28 : 0)); rz = -s * 0.2;
                if (s > 0 && this.dealT > 0) { const q = this.dealT / 0.8; tp.x = lerp(0.3, POS.deck.x, ease(Math.sin(q * Math.PI))); tp.z = lerp(0.2, POS.deck.z + 0.1, ease(Math.sin(q * Math.PI))); }
            } else if (ph === 'flip') {
                tp.set(s * 0.34, 0.97, 0.08); rz = -s * 0.3; glow = 0.45;
            } else if (ph === 'style' || ph === 'react') { tp.set(s * 0.32, 0.9, 0.3); }
            h.group.position.lerp(tp, k);
            h.group.rotation.z = lerp(h.group.rotation.z, rz, k);
            h.group.rotation.x = lerp(h.group.rotation.x, rx, k);
            h.glow.material.opacity = lerp(h.glow.material.opacity, glow, k);
            h.fingers.forEach((f, i) => { f.rotation.x = Math.PI / 2 - (glow ? 0.28 : 0.05) - Math.sin(t * 2 + i + idx) * (glow ? 0.07 : 0.02); });
        });
    }

    // ------------------------------------------------------------------ lights, candles, the sky
    updateLights(G, dt, t) {
        const S = this.S;
        const [tod, fest] = this.mode === 'title' ? ['dusk', false] : this.todFor(G);
        this.setTod(tod, fest);
        const L = TOD_LIGHT[tod], k = Math.min(1, dt * 2);
        this.light.hemi.lerp(new THREE.Color(L.hemi), k); this.light.sun.lerp(new THREE.Color(L.sun), k);
        const gazing = ['ball', 'deal'].includes(G.phase) && this.mode !== 'title';
        const dim = (this.dim || 1) * (gazing ? 0.7 : 1);
        this.dim = 1;
        this.light.int = lerp(this.light.int, L.int * dim, k);
        S.hemi.color.copy(this.light.hemi); S.hemi.intensity = this.light.int;
        S.sun.color.copy(this.light.sun); S.sun.intensity = 0.5 + (tod === 'day' ? 0.4 : 0);
        this.renderer.toneMappingExposure = lerp(this.renderer.toneMappingExposure, L.exp * (gazing ? 0.95 : 1), k);
        // candles flicker; an omen tints them and some make them leap
        const tall = this.tall ? 1.7 : 1; this.tall = 0;
        const warm = this.warm ? 1.35 : 1; this.warm = 0;
        const base = new THREE.Color('#ffa860');
        S.flames.forEach((f, i) => {
            const fl = 0.85 + Math.sin(t * 9 + f.seed * 5) * 0.08 + Math.sin(t * 23 + f.seed) * 0.05 + (this.omen?.theme === 'loss' ? -0.25 : 0);
            const col = base.clone().lerp(this.tintCol, this.tint * 0.85);
            f.flame.material.color.copy(col); f.halo.material.color.copy(col);
            f.flame.scale.set(0.05 * fl, 0.09 * fl * tall, 1);
            f.halo.scale.setScalar(0.35 * (0.9 + fl * 0.15) * warm);
            f.halo.material.opacity = 0.7;
            if (f.light) { f.light.intensity = 0.9 * fl * warm; f.light.color.copy(col); }
        });
        S.lanterns.forEach((l, i) => { const fl = 1 + Math.sin(t * 5 + i * 2) * 0.05; l.light.intensity = (1.5 * fl) * (this.sunBeam ? 1 : 1) * warm; l.g.rotation.z = Math.sin(t * 0.8 + i) * 0.03; l.g.rotation.x = Math.cos(t * 0.6 + i) * 0.02; });
        S.fill.intensity = 0.9 + (this.sunBeam ? 1.6 : 0); this.sunBeam = 0;
        // lightning
        this.flash = Math.max(0, this.flash - dt * 4);
        S.rim.intensity = 1.4 + this.flash * 5;
        S.skyMesh.material.color.setScalar(1 + this.flash * 1.5);
        // door
        const ph = G.phase;
        const open = this.mode !== 'title' && ((ph === 'arrive' && G.pt < 2.3) || (ph === 'leave' && G.pt > 0.15) || ((ph === 'scene' || ph === 'finale') && this.person && this.person.u < 0.98));
        this.doorAngle = lerp(this.doorAngle, open ? -1.55 : 0, Math.min(1, dt * 3.5));
        S.door.rotation.y = this.doorAngle;
    }

    // ------------------------------------------------------------------ fireworks outside the window
    updateFireworks(G, dt) {
        const on = this.mode !== 'title' && (this.tod === 'night' && this.festival || G.phase === 'festival' || G.phase === 'finale');
        if (!on) return;
        this.fwT -= dt;
        if (this.fwT > 0) return;
        this.fwT = 0.8 + Math.random() * 1.3;
        const cx = -1.2 + Math.random() * 3.2, cy = 1.9 + Math.random() * 1.3, cz = -3.5;
        const cols = ['#ff5a6a', '#ffd25a', '#6ad0ff', '#c46aff', '#6affb0', '#ffffff'];
        const col = new THREE.Color(cols[(Math.random() * cols.length) | 0]);
        for (let i = 0; i < 70; i++) {
            const a = Math.random() * TAU, e = Math.acos(2 * Math.random() - 1), s = 0.8 + Math.random() * 0.5;
            this.S.fx.emit({ x: cx, y: cy, z: cz, vx: Math.sin(e) * Math.cos(a) * s, vy: Math.cos(e) * s, vz: Math.sin(e) * Math.sin(a) * s * 0.3, life: 1.8 + Math.random() * 0.7, size: 0.07, color: col, alpha: 1, grav: 0.35, drag: 1.1 });
        }
    }

    // ------------------------------------------------------------------ the camera
    camFor(G) {
        if (this.mode === 'title') return 'title';
        switch (G.phase) {
            case 'ball': return 'ball';
            case 'deal': return 'deal';
            case 'flip': case 'style': return 'cards';
            default: return 'client';
        }
    }

    updateCamera(G, dt, t) {
        const key = this.camFor(G), c = CAMS[key], st = this.camState;
        const asp = this.camera.aspect;
        const back = asp < 0.85 ? 0.28 : asp < 1.3 ? 0.1 : 0;
        const tp = new THREE.Vector3(...c.p); tp.z += back; if (asp < 0.85 && key === 'client') tp.y += 0.05;
        const tl = new THREE.Vector3(...c.l);
        if (key === 'title') { const a = t * 0.12; tp.x = Math.sin(a) * 0.45; tp.z += Math.cos(a) * 0.1; tl.x = Math.sin(a) * -0.1; }
        const k = Math.min(1, dt * (key === 'client' ? 2.2 : 3));
        st.p.lerp(tp, k); st.l.lerp(tl, k);
        const sway = this.sway ? 3 : 1; this.sway = 0;
        this.shake = Math.max(0, this.shake - dt * 1.5);
        const sx = Math.sin(t * 0.55) * 0.012 * sway + (Math.random() - 0.5) * 0.02 * this.shake;
        const sy = Math.sin(t * 0.8) * 0.008 + (Math.random() - 0.5) * 0.02 * this.shake;
        this.camera.position.set(st.p.x + sx, st.p.y + sy, st.p.z);
        this.camera.lookAt(st.l.x + Math.sin(t * 0.4) * 0.02, st.l.y, st.l.z);
        this.camera.rotation.z += Math.sin(t * 0.6) * 0.004 * sway;
        // the thing you lean toward: the guest's face looks back at you through the eyes of the model
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'line': this.line = { w: e.w, m: e.m }; this.moodHold = 3; break;
                case 'omen': this.startOmen(e.theme); break;
                case 'rankup': this.burst(new THREE.Vector3(0, 1.1, -0.5), '#ffd25a', 80, 0.9, 0.03); break;
                case 'clue': this.burst(new THREE.Vector3(0, 1.1, -0.5), '#c8a8ff', 60, 0.7, 0.03); break;
                case 'result': this.burst(new THREE.Vector3(0, 1.0, 0.0), e.stars >= 2 ? '#ffe9a0' : '#8a6aff', 20 + e.stars * 20, 0.6, 0.025); break;
                case 'deal': this.dealT = 0.8; break;
                case 'evening': this.sceneWho = CAND[e.id] ? { key: e.id, look: CAND[e.id].look } : null; break;
                case 'finale': this.sceneWho = CAND[e.id] ? { key: e.id, look: CAND[e.id].look } : null; break;
                case 'prince': this.sceneWho = { key: 'prince', look: PRINCE.look }; break;
                case 'knock': this.knockT = 0; break;
                default: break;
            }
        }
    }

    setTalking(v) { this.talking = v; }
    setMode(m) { this.mode = m; if (m === 'play') { this.S.cards.forEach((c) => { c.shown = false; c.outer.visible = false; c.aura.material.opacity = 0; }); } else this.setCardsTitle(); }

    /** Debug and screenshots: let the scene finish its moves (a guest sitting down, the camera leaning in) without
     *  drawing, so a software renderer at 3 fps still shows the settled picture. */
    settle(G, sec = 4) {
        const dt = 0.05;
        for (let i = 0; i < sec / dt; i++) {
            this.t += dt;
            this.updatePerson(G, dt, this.t); this.updateBall(G, dt, this.t); this.updateCards(G, dt, this.t); this.updateHands(G, dt, this.t);
            this.updateLights(G, dt, this.t); this.updateOmen(dt); this.updateCamera(G, dt, this.t); this.S.fx.update(dt);
        }
    }

    // ------------------------------------------------------------------ the frame
    frame(G, dt, time) {
        this.t = time;
        this.resize();
        this.moodHold -= dt; if (this.moodHold < 0 && this.line.m !== 'n') this.line = { w: 'n', m: 'n' };
        this.updatePerson(G, dt, time);
        this.updateBall(G, dt, time);
        this.updateCards(G, dt, time);
        this.updateHands(G, dt, time);
        this.updateLights(G, dt, time);
        this.updateOmen(dt);
        this.updateFireworks(G, dt);
        this.updateCamera(G, dt, time);
        // incense smoke and a slow drift of dust
        if (Math.random() < dt * 8) this.S.fx.emit({ x: this.S.incensePos.x, y: this.S.incensePos.y, z: this.S.incensePos.z, vx: (Math.random() - 0.5) * 0.02, vy: 0.12, life: 3, size: 0.045, color: '#9a8ac8', alpha: 0.18, drag: 0.3 });
        this.S.fx.update(dt);
        const D = this.S.dust, n = D.max;
        for (let i = 0; i < n; i++) {
            const k = i * 3;
            D.p[k] += Math.sin(time * 0.2 + i) * 0.02 * dt; D.p[k + 1] += (Math.sin(time * 0.3 + i * 1.3) * 0.02 + 0.006) * dt; D.p[k + 2] += Math.cos(time * 0.17 + i) * 0.015 * dt;
            if (D.p[k + 1] > 2.5) D.p[k + 1] = 0.3;
            D.col[i * 4] = D.base[i * 4]; D.col[i * 4 + 1] = D.base[i * 4 + 1]; D.col[i * 4 + 2] = D.base[i * 4 + 2]; D.col[i * 4 + 3] = D.base[i * 4 + 3];
            D.size[i] = 0.014;
        }
        D.geo.attributes.position.needsUpdate = true; D.geo.attributes.aColor.needsUpdate = true; D.geo.attributes.aSize.needsUpdate = true;
        if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    }
}
