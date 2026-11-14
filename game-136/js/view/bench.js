// The clay bench: a small turntable that shows what you're about to pinch out of clay, and the
// icon maker that draws each shelf thing from its real model. Each has its own small renderer, so
// the room never has to stop to draw them.

import * as THREE from 'three';
import { KINDS } from '../sim/data/catalog.js';
import { buildModel } from './models.js';
import { clay, puck, mesh } from './clay.js';

function stage(renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7a6a, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe0c0, 0.8);
    rim.position.set(4, 3, -4);
    scene.add(rim);
    return scene;
}

/** Fit an orthographic camera around an object, seen from the iso angle. */
function frame(cam, obj, wall, aspect = 1) {
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() * 0.5 + 0.05;
    if (wall) cam.position.set(c.x + 2.5, c.y + 1.4, c.z + 8);
    else cam.position.set(c.x + 6, c.y + 4.6, c.z + 6);
    cam.lookAt(c);
    Object.assign(cam, { left: -r * aspect, right: r * aspect, top: r, bottom: -r, near: 0.1, far: 50 });
    cam.updateProjectionMatrix();
}

export class Bench {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.scene = stage(this.renderer);
        this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
        this.table = mesh(puck(1.6, 1.7, 0.18, 0.06, 1.5, 2, 32), clay(0xd9b48a), 0, -0.095, 0);   // its top sits at y = -0.005
        this.scene.add(this.table);
        this.spin = new THREE.Group();
        this.scene.add(this.spin);
        this.model = null;
        this.squish = 0;
    }
    setRecipe(r) {
        if (this.model) this.spin.remove(this.model);
        if (!r) { this.model = null; return; }
        const it = { ...r, lump: 7 };
        this.model = buildModel(it);
        const wall = KINDS[r.kind].layer === 'wall';
        if (wall) this.model.position.y = 0.8;
        // centre the footprint on the turntable
        const box = new THREE.Box3().setFromObject(this.model);
        const c = box.getCenter(new THREE.Vector3());
        this.model.position.x -= c.x; this.model.position.z -= wall ? 0 : c.z;
        this.spin.add(this.model);
        const k = Math.max(1, ...KINDS[r.kind].fp[r.size]);
        // grow the turntable sideways only: scaled up in height its top rose through rugs and bed legs
        const sc = Math.max(0.6, k * 0.62);
        this.table.scale.set(sc, 1, sc);
        this.table.visible = !wall;
        this.wall = wall;
        this.squish = 1;
    }
    resize() {
        const r = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        if (w !== this.w || h !== this.h) {
            this.w = w; this.h = h;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.setSize(w, h, false);
        }
    }
    frame(dt, time) {
        if (!this.model) return;
        this.resize();
        this.spin.rotation.y = this.wall ? Math.sin(time * 0.8) * 0.5 : time * 0.6;
        this.squish = Math.max(0, this.squish - dt * 1.8);
        const k = Math.exp(-4 * (1 - this.squish)) * Math.cos((1 - this.squish) * 16) * this.squish;
        this.model.scale.set(1 + 0.15 * k, 1 - 0.2 * k, 1 + 0.15 * k);
        frame(this.cam, this.wall ? this.model : this.spin, this.wall, this.w / this.h);
        this.renderer.render(this.scene, this.cam);
    }
}

/** Shelf icons drawn from the real models, cached per recipe. */
export class Icons {
    constructor() {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.setSize(128, 128, false);
        this.scene = stage(this.renderer);
        this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
        this.cache = new Map();
    }
    of(it) {
        const key = `${it.kind}|${it.size}|${it.variant}|${it.motif}|${it.colors}`;
        if (this.cache.has(key)) return this.cache.get(key);
        const m = buildModel({ ...it, lump: 7 });
        const wall = KINDS[it.kind].layer === 'wall';
        this.scene.add(m);
        frame(this.cam, m, wall);
        this.renderer.render(this.scene, this.cam);
        const url = this.renderer.domElement.toDataURL('image/png');
        this.scene.remove(m);
        this.cache.set(key, url);
        return url;
    }
}
