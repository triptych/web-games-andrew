// Bust portraits for the dialogue and the party cards: a model is shot once on a backdrop into a
// render target and read back into a 2D canvas, then cached. The target is linear, so the
// pixels are converted to sRGB here.

import * as THREE from 'three';
import { buildCast } from './humans.js';
import { buildDaemon } from './daemons3d.js';

const LUT = new Uint8Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LUT[i] = Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); }

export class Portraits {
    constructor(renderer) {
        this.r = renderer;
        this.scene = new THREE.Scene();
        this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
        this.scene.add(new THREE.HemisphereLight('#cfe8ff', '#3a3450', 0.8));
        const key = new THREE.DirectionalLight('#fff4e0', 1.5); key.position.set(2, 3, 4); this.scene.add(key);
        const rim = new THREE.DirectionalLight('#7affd0', 1.1); rim.position.set(-3, 1.5, -2); this.scene.add(rim);
        this.cache = new Map();
        this.rt = new THREE.WebGLRenderTarget(256, 320, { samples: 4, type: THREE.UnsignedByteType });
        this.bg = null;
    }

    /** Shoot `obj` (already in the scene graph of nobody) with a camera aimed at `look` from `pos`. */
    shoot(obj, pos, look, bg = null, w = 256, h = 320) {
        if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
        this.cam.aspect = w / h;
        this.cam.position.set(...pos);
        this.cam.lookAt(...look);
        this.cam.updateProjectionMatrix();
        if (this.bg) { this.scene.remove(this.bg); this.bg.geometry.dispose(); this.bg.material.dispose(); this.bg = null; }
        if (bg) {
            const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64;
            const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
            const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
            this.bg = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
            this.bg.position.set(look[0], look[1], look[2] - 2.5);
            this.scene.add(this.bg);
        }
        this.scene.add(obj);
        const prev = this.r.getRenderTarget();
        const prevSh = this.r.shadowMap.enabled;
        this.r.shadowMap.enabled = false;
        this.r.setRenderTarget(this.rt);
        this.r.setClearColor('#000000', 0);
        this.r.clear();
        this.r.render(this.scene, this.cam);
        const px = new Uint8Array(w * h * 4);
        this.r.readRenderTargetPixels(this.rt, 0, 0, w, h, px);
        this.r.setRenderTarget(prev);
        this.r.shadowMap.enabled = prevSh;
        this.scene.remove(obj);
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        const ctx = out.getContext('2d');
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
            const src = (h - 1 - y) * w * 4, dst = y * w * 4;
            for (let x = 0; x < w * 4; x += 4) {
                img.data[dst + x] = LUT[px[src + x]]; img.data[dst + x + 1] = LUT[px[src + x + 1]]; img.data[dst + x + 2] = LUT[px[src + x + 2]]; img.data[dst + x + 3] = px[src + x + 3];
            }
        }
        ctx.putImageData(img, 0, 0);
        return out;
    }

    /** A person's bust. mood: neutral | smile | smirk | angry | sad | shock. */
    person(id, mood = 'neutral', look = 0) {
        const key = `p:${id}:${mood}:${look}`;
        if (this.cache.has(key)) return this.cache.get(key);
        const h = buildCast(id, { look });
        if (!h) return null;
        h.setMood(mood);
        h.pose({ talk: true }, 0);
        h.root.rotation.y = -0.25;
        const c = this.shoot(h.root, [0.4, 1.98, 2.4], [0, 1.52, 0]);
        this.cache.set(key, c);
        return c;
    }

    /** A daemon, whole, on a dark panel. */
    daemon(spId, w = 160, h = 200) {
        const key = `d:${spId}:${w}`;
        if (this.cache.has(key)) return this.cache.get(key);
        const m = buildDaemon(spId);
        m.pose({}, 0.5);
        m.root.rotation.y = -0.45;
        const hh = Math.max(0.8, m.h), cy = hh * 0.52;
        const c = this.shoot(m.root, [0.4 * hh, cy + 0.15 * hh, hh * 2.15 + m.r * 0.8], [0, cy, 0], null, w * 2, h * 2);
        this.cache.set(key, c);
        return c;
    }
}
