// The three.js view: one renderer, two scenes (the campus overmap and the battle arena). Reads G every frame and
// turns sim events into effects; never changes G. The canvas is sized in px from visualViewport, never 100vh.
// In battles the canvas is transparent and the place's painted background shows through from #backdrop.

import * as THREE from 'three';
import { Campus } from './campus.js';
import { Arena } from './arena.js';

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.95;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.campus = new Campus(this);
        this.arena = new Arena(this);
        this.mode = 'none';
        this.backdrop = document.getElementById('backdrop');
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.campus.resize(w, h);
        this.arena.resize(w, h);
    }

    /** 'campus', 'arena' or 'none' (the VN and the mini-games cover the screen with their own layers). */
    setMode(mode, G) {
        if (mode === this.mode) return;
        this.mode = mode;
        this.canvas.style.visibility = mode === 'none' ? 'hidden' : 'visible';
        if (mode === 'arena') { this.arena.enter(G); this.backdrop.style.backgroundImage = `url(art/bg/${G.battle.where}.webp)`; this.backdrop.classList.add('dim'); }
        else { this.backdrop.style.backgroundImage = ''; this.backdrop.classList.remove('dim'); }
        if (mode !== 'arena') this.arena.leave();
    }

    get busy() { return this.mode === 'arena' && this.arena.busy; }

    onEvents(G, events) {
        this.campus.onEvents(G, events);
        this.arena.onEvents(G, events);
    }

    frame(G, dt, time) {
        this.resize();
        if (this.mode === 'campus') {
            this.campus.frame(G, dt, time);
            this.renderer.setClearColor(this.campus.sky, 1);
            this.renderer.render(this.campus.scene, this.campus.camera);
        } else if (this.mode === 'arena') {
            this.arena.frame(G, dt, time);
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.render(this.arena.scene, this.arena.camera);
        }
    }

    /** A world point → CSS px on screen, for the damage numbers. */
    project(v, camera) {
        const p = v.clone().project(camera);
        return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h, behind: p.z > 1 };
    }
}
