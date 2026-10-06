/**
 * mini.js — a second, small renderer for the train workshop's turntable preview and for the
 * thumbnails on every card (catalog items and train sets). Thumbnails are rendered once and kept as
 * data URLs; read back with toDataURL in the same task as the render, so no preserveDrawingBuffer.
 */

import * as THREE from 'three';
import { ENGINES, CARS, GAP } from '../sim/trainsets.js';
import { engineGeo, carGeo } from './trainmodels.js';
import { buildItem } from './models.js';
import { toyMat } from './materials.js';
import { Builder } from './builder.js';
import { ITEM, footprint } from '../sim/catalog.js';

export class Mini {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'mini-canvas';
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x8a9a70, 1.25));
        const d = new THREE.DirectionalLight(0xfff4e0, 2.0);
        d.position.set(3, 6, 4);
        this.scene.add(d);
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
        this.holder = new THREE.Group();
        this.scene.add(this.holder);
        this.thumbs = new Map();
        this.live = false;
        this.yaw = 0.6;
        this.dragging = false;
        // a strip of straight track for trains to stand on
        const b = new Builder();
        b.box(8, 0.03, 0.6, 0x9d968b, 0, -0.1, 0);
        for (let i = 0; i < 32; i++) b.box(0.085, 0.028, 0.5, 0x6b4a33, -4 + i * 0.25 + 0.125, -0.07, 0);
        for (const z of [-0.15, 0.15]) b.box(8, 0.04, 0.036, 0x8c939c, 0, -0.042, z);
        b.cyl(4.6, 0.05, 0x7cc35a, 0, -0.15, 0, { seg: 40 });
        this.trackMesh = new THREE.Mesh(b.geometry(), toyMat);
        this.scene.add(this.trackMesh);
        this.canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.lx = e.clientX; try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } });
        this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) { this.yaw -= (e.clientX - this.lx) * 0.01; this.lx = e.clientX; } });
        const up = () => { this.dragging = false; };
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointercancel', up);
    }

    clear() { while (this.holder.children.length) this.holder.remove(this.holder.children[0]); }

    /** Lay a design out along x, engine at the front (+x), centred. Returns the total length. */
    setTrain(design) {
        this.clear();
        const items = [{ geo: engineGeo(design.engine, design.body, design.trim, design.face), len: ENGINES[design.engine].len }];
        for (const c of design.cars) items.push({ geo: carGeo(c.type, c.color), len: CARS[c.type].len });
        let L = 0;
        for (const it of items) L += it.len;
        L += GAP * (items.length - 1);
        let x = L / 2;
        for (const it of items) {
            const m = new THREE.Mesh(it.geo, toyMat);
            m.position.x = x - it.len / 2;
            this.holder.add(m);
            x -= it.len + GAP;
        }
        this.trackMesh.visible = true;
        this.trainLen = L;
        return L;
    }

    size(w, h) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    frameTrain(L, yaw, pitch = 0.42, scale = 1) {
        const r = Math.max(1.2, L * 0.62) * scale;
        const dist = r / Math.tan((this.camera.fov * Math.PI) / 360) / Math.max(0.8, Math.min(1.6, this.camera.aspect));
        this.camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist + 0.15, Math.cos(yaw) * Math.cos(pitch) * dist);
        this.camera.lookAt(0, 0.2, 0);
    }

    /** A JPEG data URL of a train set, side on. */
    trainThumb(design, w = 240, h = 110) {
        const L = this.setTrain(design);
        this.size(w, h);
        this.frameTrain(L, 0.5, 0.32, 0.92);
        this.renderer.setClearColor(0xdff3fb, 1);
        this.renderer.render(this.scene, this.camera);
        return this.canvas.toDataURL('image/jpeg', 0.82);
    }

    /** A PNG data URL of a catalog item (cached). */
    itemThumb(id, px = 96) {
        if (this.thumbs.has(id)) return this.thumbs.get(id);
        this.clear();
        this.trackMesh.visible = false;
        const model = buildItem(id);
        const m = new THREE.Mesh(model.geo, toyMat);
        this.holder.add(m);
        if (model.spin) {
            const s = new THREE.Mesh(model.spin.geo, toyMat);
            s.position.set(...model.spin.pivot);
            this.holder.add(s);
        }
        const it = ITEM[id];
        if (it.on === 'water') m.position.y = 0.17;
        const box = new THREE.Box3().setFromObject(this.holder);
        const sph = box.getBoundingSphere(new THREE.Sphere());
        this.size(px, px);
        const dist = sph.radius / Math.sin((this.camera.fov * Math.PI) / 360) * 0.92;
        const [w] = footprint(it, 0);
        const yaw = w > 1 ? 0.5 : 0.65;
        this.camera.position.set(sph.center.x + Math.sin(yaw) * dist * 0.8, sph.center.y + dist * 0.55, sph.center.z + Math.cos(yaw) * dist * 0.8);
        this.camera.lookAt(sph.center);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.render(this.scene, this.camera);
        const url = this.canvas.toDataURL('image/png');
        this.thumbs.set(id, url);
        return url;
    }

    /** Live turntable inside the workshop. */
    attach(parent, design) {
        parent.appendChild(this.canvas);
        this.live = true;
        this.show(design);
        const loop = () => {
            if (!this.live) return;
            requestAnimationFrame(loop);
            const r = parent.getBoundingClientRect();
            const w = Math.max(50, Math.floor(r.width)), h = Math.max(50, Math.floor(r.height));
            if (w !== this._w || h !== this._h) { this._w = w; this._h = h; this.size(w, h); }
            if (!this.dragging) this.yaw += 0.004;
            this.frameTrain(this.trainLen || 2, this.yaw, 0.38, 1.0);
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }
    show(design) { this.setTrain(design); }
    detach() { this.live = false; this._w = 0; if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas); }
}
