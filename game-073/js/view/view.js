// The view: renderer, camera, post-processing, and everything drawn in the world.
// Reads the simulation state; never changes it.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, STRATA, ORES, RELICS, RIG } from '../config.js';
import { derived } from '../sim/game.js';
import { buildAtlasCanvas } from './textures.js';
import { Terrain } from './terrain.js';
import { RigModel } from './rigmodel.js';
import { Town } from './town.js';
import { FX } from './fx.js';
import { Actors } from './actors.js';

const FOV = 40;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export class View {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setClearColor(0x05040a);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
        this.camera.position.set(18, 2, 20);

        const atlasCv = buildAtlasCanvas();
        this.atlasCanvas = atlasCv;
        const atlas = new THREE.CanvasTexture(atlasCv);
        atlas.colorSpace = THREE.SRGBColorSpace;
        atlas.magFilter = THREE.LinearFilter;
        atlas.minFilter = THREE.LinearFilter;
        atlas.generateMipmaps = false;
        this.terrain = new Terrain(this.scene, atlas);
        this.rig = new RigModel(this.scene);
        this.town = new Town(this.scene);
        this.fx = new FX(this.scene);
        this.actors = new Actors(this.scene);
        this.amb = new THREE.AmbientLight(0xffffff, 0.25);
        this.scene.add(this.amb);

        this.cam = { x: 18, y: 2, halfW: 10, halfH: 7, shakeT: 0 };
        this.quality = opts.quality ?? 'high';
        this.composer = null;
        this.flash = 0;
        this._v = new THREE.Vector3();
        this.titleMode = false;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setQuality(q) {
        this.quality = q;
        this.resize(true);
    }

    resize(force = false) {
        const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);   // sets the canvas CSS size in px too (no 100vh trap)
        const aspect = w / h;
        this.camera.aspect = aspect;
        // Show at least 9.8 tiles across and 13 tall, whichever is the tighter fit.
        const halfH = Math.max(6.6, 4.9 / aspect);
        this.cam.halfH = halfH;
        this.cam.halfW = halfH * aspect;
        this.cam.dist = halfH / Math.tan((FOV * Math.PI) / 360);
        this.camera.updateProjectionMatrix();
        this.fx.setScale((h * dpr) / (2 * Math.tan((FOV * Math.PI) / 360)));
        if (this.quality !== 'low') {
            if (!this.composer) {
                this.composer = new EffectComposer(this.renderer);
                this.composer.addPass(new RenderPass(this.scene, this.camera));
                this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.55, 0.5, 0.82);
                this.composer.addPass(this.bloom);
                this.composer.addPass(new OutputPass());
            }
            this.composer.setPixelRatio(dpr);
            this.composer.setSize(w, h);
            this.bloom.resolution.set(w / 2, h / 2);
        }
    }

    /** World position → CSS pixels (for floating text). */
    toScreen(x, y, z = 0.5) {
        const v = this._v.set(x, y, z).project(this.camera);
        return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, on: v.z < 1 };
    }

    /** React to simulation events with effects. */
    onEvents(G, events) {
        const fx = this.fx;
        for (const e of events) {
            switch (e.type) {
                case 'dug': {
                    const x = e.c + 0.5, y = -(e.r + 0.5);
                    const t = STRATA[e.strat]?.tint ?? [0.5, 0.4, 0.3];
                    fx.debris(x, y, t, e.byDrill ? 7 : 4, 3.2);
                    fx.dust(x, y, t.map((v) => v * 0.9), 6);
                    break;
                }
                case 'ore': {
                    const c = hex(ORES[e.id].col2);
                    if (!e.lost) fx.burst(G.rig.x, G.rig.y, c, 14, 2.5, 0.2, 0.6);
                    break;
                }
                case 'cache': fx.burst(e.c + 0.5, -(e.r + 0.5), [1, 0.85, 0.3], 30, 3.5, 0.22, 0.9); break;
                case 'artifact': fx.burst(G.rig.x, G.rig.y, [1, 0.95, 0.7], 24, 2.5, 0.25, 1); break;
                case 'relic': {
                    const c = hex(RELICS[e.id].col);
                    fx.burst(G.rig.x, G.rig.y, c, 60, 4, 0.35, 1.4);
                    fx.rise(G.rig.x, G.rig.y, c, 30);
                    this.flash = 1;
                    break;
                }
                case 'explode': fx.explosion(e.x, e.y, e.size); this.flash = Math.max(this.flash, 0.7); break;
                case 'blast': fx.explosion(e.x, e.y, e.size * 0.9); fx.burst(e.x, e.y, [0.6, 0.9, 1], 30, 6, 0.3, 0.6); this.flash = 0.8; break;
                case 'hurt': this.rig.flash = 1; fx.shake = Math.max(fx.shake, Math.min(0.4, e.amt * 0.03)); if (e.kind !== 'heat') fx.sparks(G.rig.x, G.rig.y, [1, 0.6, 0.3], 8, 3); break;
                case 'land': fx.dust(G.rig.x, G.rig.y - RIG.halfH, [0.5, 0.42, 0.34], Math.min(14, 4 + e.v)); if (e.v > 7) fx.shake = Math.max(fx.shake, 0.12); break;
                case 'bonk': fx.sparks(G.rig.x, G.rig.y + RIG.halfH, [1, 0.8, 0.5], 4, 2); break;
                case 'boulder-land': fx.dust(e.x, e.y - 0.4, [0.5, 0.48, 0.44], 10); fx.shake = Math.max(fx.shake, 0.15); break;
                case 'boulder-hit': fx.debris(e.x, e.y, [0.55, 0.5, 0.45], 14, 4); fx.shake = 0.3; break;
                case 'gate-open':
                    for (let c = 0; c < W; c += 2) fx.burst(c + 0.5, -(368.5), [1, 0.85, 0.4], 6, 2, 0.4, 1.5);
                    this.flash = 1; fx.shake = 0.6; break;
                case 'shard': fx.burst(e.x, e.y, [0.9, 0.4, 1], 70, 6, 0.4, 1.2); fx.debris(e.x, e.y, [0.6, 0.2, 0.8], 16, 5); this.flash = 0.9; fx.shake = 0.5; break;
                case 'wyrm-stun': fx.burst(G.boss.head.x, G.boss.head.y, [1, 1, 0.7], 30, 4, 0.3, 0.6); break;
                case 'wyrm-freed': fx.burst(G.boss.head.x, G.boss.head.y, [1, 0.85, 0.4], 120, 8, 0.45, 2); this.flash = 1; break;
                case 'heart': fx.burst(G.rig.x, G.rig.y - 0.5, [1, 0.9, 0.6], 150, 9, 0.5, 2.5); fx.rise(G.rig.x, G.rig.y, [1, 0.9, 0.5], 60); this.flash = 1; break;
                case 'orb-pop': fx.burst(e.x, e.y, [0.8, 0.4, 1], 14, 2.5, 0.25, 0.5); break;
                case 'wisp-pop': fx.burst(e.x, e.y, [0.5, 0.8, 1], e.hit ? 20 : 10, 2.5, 0.25, 0.6); break;
                case 'recall': fx.rise(e.fromX, e.fromY, [0.6, 0.9, 1], 30); this.snapCam = true; break;
                case 'travel': case 'rescued': this.snapCam = true; fx.rise(G.rig.x, G.rig.y, [0.6, 0.9, 1], 24); break;
                case 'waystone': fx.rise(G.rig.x, G.rig.y, [0.5, 0.95, 1], 50); this.flash = 0.6; break;
                case 'mend': fx.rise(G.rig.x, G.rig.y, [0.6, 1, 0.6], 20); break;
                case 'flask': fx.rise(G.rig.x, G.rig.y, [0.5, 0.9, 1], 20); break;
                case 'upgrade': fx.burst(G.rig.x, G.rig.y, [1, 0.85, 0.5], 24, 2.5, 0.2, 0.8); break;
                default: break;
            }
        }
    }

    /**
     * Render one frame.
     * ui: { pressDown, pressSide, title }
     */
    frame(G, dt, time, ui = {}) {
        const rig = G.rig;
        const S = derived(G);
        const cam = this.cam;

        // --- camera target ---
        let tx, ty;
        if (ui.title) {
            tx = W / 2 + Math.sin(time * 0.08) * 6;
            ty = 4.2;
        } else {
            tx = rig.x;
            ty = rig.y + (rig.y > -4 ? 2.6 : 0.6);
        }
        // pull back for the wyrm's chamber so the whole fight is in frame
        const wantZoom = G.boss && (G.boss.active || G.boss.dying) && !ui.title ? Math.max(1, Math.min(2.1, 15 / cam.halfH)) : 1;
        cam.zoom = (cam.zoom ?? 1) + (wantZoom - (cam.zoom ?? 1)) * Math.min(1, dt * 1.5);
        const zhw = cam.halfW * cam.zoom, zhh = cam.halfH * cam.zoom;
        if (wantZoom > 1) ty = -(383 + 0.5) + 0.3 * (rig.y + 383.5);
        const minX = zhw - 3.2, maxX = W - zhw + 3.2;
        tx = minX > maxX ? W / 2 : Math.max(minX, Math.min(maxX, tx));
        if (this.snapCam || Math.hypot(tx - cam.x, ty - cam.y) > 30) { cam.x = tx; cam.y = ty; this.snapCam = false; }
        const k = 1 - Math.pow(0.0015, dt);
        cam.x += (tx - cam.x) * k;
        cam.y += (ty - cam.y) * k;
        const sh = (this.fx.shake + (rig.drill ? 0.03 : 0)) * (this.shakeK ?? 1);
        const sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
        this.camera.position.set(cam.x + sx, cam.y + sy + 0.6, cam.dist * cam.zoom);
        this.camera.lookAt(cam.x + sx, cam.y + sy, 0);

        // --- surface vs deep lighting ---
        const surfaceK = Math.max(0, Math.min(1, (cam.y + cam.halfH + 2) / 6));
        const spire = G.story.flags.ending ? 1 : 0.15 + G.relics.filter(Boolean).length * 0.04;
        const business = ui.business || {};
        this.town.update(dt, time, surfaceK, spire, business);
        this.amb.intensity = 0.12 + 0.3 * surfaceK;

        // --- terrain ---
        const drill = rig.drill ? { c: rig.drill.c, r: rig.drill.r, p: Math.min(1, rig.drill.t / rig.drill.dur) } : null;
        const s = rig.y < 0 ? STRATA[Math.min(6, rig.lastStratum)] : STRATA[0];
        const tint = s.tint;
        const u = this.terrain.uniforms;
        u.uAmbCol.value.setRGB(0.75 + tint[0] * 0.4, 0.75 + tint[1] * 0.4, 0.78 + tint[2] * 0.4);
        u.uLight.value.set(rig.x, rig.y + 0.3, 0.6);
        const lan = S.lantern * (1 + Math.sin(time * 7) * 0.015);
        u.uRadius.value = ui.title ? 0.01 : lan;
        u.uSense.value = S.sense;
        u.uFlash.value = this.flash * 0.5;
        this.flash = Math.max(0, this.flash - dt * 2.2);
        this.terrain.update(G, { x: cam.x, y: cam.y, halfW: zhw + 1, halfH: zhh + 1.5 }, time, drill);

        // --- rig ---
        this.rig.setRelics(G.relics);
        this.rig.setLantern(S.lantern);
        this.rig.update(rig, dt, time, { pressDown: ui.pressDown, pressSide: ui.pressSide, visible: !G.down || G.down.t < 1.6, lightK: 1 });
        if (G.down) { this.rig.root.rotation.z = Math.min(1.2, G.down.t) * 0.8; this.rig.root.position.y += G.down.t > 1.4 ? (G.down.t - 1.4) * 6 : 0; }
        if (!ui.title) {
            this.fx.exhaust(this.rig.exhaustWorld(this._v), rig.thrust);
            if (rig.drill && Math.random() < 0.6) {
                const tip = this.rig.drillTipWorld(this._v);
                this.fx.sparks(tip.x, tip.y, [1, 0.8, 0.4], 1, 3);
                if (Math.random() < 0.3) this.fx.dust(tip.x, tip.y, STRATA[rig.drill.strat].tint, 1);
            }
            if (rig.heat > 0.2 && Math.random() < 0.2) this.fx.rise(rig.x, rig.y + 0.3, [1, 0.5, 0.2], 1);
        }
        for (const sm of this.town.smoke) this.fx.smoke(sm.pos, sm.col, sm.rate, dt);

        this.actors.update(G, dt, time);
        this.fx.update(dt);

        if (this.composer && this.quality !== 'low') this.composer.render(dt);
        else this.renderer.render(this.scene, this.camera);
    }
}
