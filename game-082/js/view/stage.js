// Renderer, camera and the post chain (scene → half-res bloom → OutputPass: ACES + sRGB).
// The camera looks straight at the playfield and is placed so the whole 32 × 26 field fits the
// part of the screen the HUD and the touch deck leave free, in any orientation.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, H } from '../config.js';

export class Stage {
    constructor(canvas, quality = 1) {
        this.canvas = canvas;
        this.quality = quality;             // 0 low (no bloom), 1 medium, 2 high
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality > 0, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.setClearColor(0x03040a);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.82);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
        this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
        this.shake = 0;
        this.sway = new THREE.Vector2();
        this.envMap = this.makeEnv();
        this.scene.environment = this.envMap;
        this.resize(true);
    }

    /** A tiny generated room for reflections: a nebula-coloured sky and a couple of bright panels. */
    makeEnv() {
        const pm = new THREE.PMREMGenerator(this.renderer);
        const s = new THREE.Scene();
        s.background = new THREE.Color(0x0a0820);
        const box = (c, p, sc) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: c })); m.position.set(...p); m.scale.set(...sc); s.add(m); };
        box(new THREE.Color(1.6, 0.6, 2.2), [-5, 3, -3], [0.4, 4, 6]);
        box(new THREE.Color(0.4, 1.8, 2.4), [5, 1, 2], [0.4, 3, 6]);
        box(new THREE.Color(2.2, 2.0, 1.8), [0, 6, 0], [6, 0.3, 6]);
        box(new THREE.Color(0.05, 0.05, 0.12), [0, -4, 0], [20, 0.3, 20]);
        const rt = pm.fromScene(s, 0.04);
        pm.dispose();
        return rt.texture;
    }

    setQuality(q) { this.quality = q; this.resize(true); }

    /** Space the HUD and the touch deck take, in CSS px. */
    setInsets(ins) {
        const k = JSON.stringify(ins);
        if (k === this.insetsKey) return;
        this.insetsKey = k;
        this.insets = ins;
        this.fit();
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const pr = Math.min(window.devicePixelRatio || 1, [1, 1.5, 2][this.quality]) * [0.75, 1, 1][this.quality];
        this.pr = pr;
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);            // sets the canvas CSS size in px (never 100vh)
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
        this.bloom.strength = [0, 0.6, 0.72][this.quality];
        this.camera.aspect = w / h;
        this.fit();
        return true;
    }

    /** Fit the field (plus a margin) into the free rectangle and centre it there. */
    fit() {
        const { w, h } = this;
        if (!w) return;
        const ins = this.insets;
        const rw = Math.max(80, w - ins.left - ins.right), rh = Math.max(80, h - ins.top - ins.bottom);
        const fw = W + 0.6, fh = H + 0.6;
        const ppu = Math.min(rw / fw, rh / fh);
        this.ppu = ppu;
        const tan = Math.tan((this.camera.fov * Math.PI) / 360);
        this.dist = h / (2 * tan * ppu);
        const ox = ins.left + rw / 2 - w / 2, oy = ins.top + rh / 2 - h / 2;
        this.base = new THREE.Vector3(W / 2 - ox / ppu, H / 2 + oy / ppu, this.dist);
        this.camera.near = Math.max(1, this.dist - 40);
        this.camera.far = this.dist + 260;
        this.camera.updateProjectionMatrix();
        this.place(0);
    }

    place(time) {
        if (!this.base) return;
        const s = this.shake;
        this.camera.position.set(
            this.base.x + this.sway.x + (s ? (Math.sin(time * 91) * s) : 0),
            this.base.y + this.sway.y + (s ? (Math.cos(time * 73) * s) : 0),
            this.base.z,
        );
        this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);
    }

    /** CSS px of a world point (for DOM labels). */
    toScreen(x, y, z = 0) {
        const v = new THREE.Vector3(x, y, z).project(this.camera);
        return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h };
    }

    render() {
        if (this.quality === 0) this.renderer.render(this.scene, this.camera);
        else this.composer.render();
    }
}
