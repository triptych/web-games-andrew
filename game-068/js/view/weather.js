/**
 * weather.js — the air of each act: falling leaves in Maple Hollow, snow in Frostford, rain over
 * Lantern City, and fireflies whenever the light is low.
 */

import * as THREE from 'three';
import { W, H, THEMES } from '../config.js';

function dotTexture(kind) {
    const S = 32, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    if (kind === 'leaf') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(16, 16, 7, 13, 0.7, 0, 7); g.fill(); }
    else { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Weather {
    constructor(root) {
        this.root = root;
        this.group = new THREE.Group();
        root.add(this.group);
        this.kind = null;
    }

    clear() {
        for (const o of this.group.children.slice()) { this.group.remove(o); o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); }
        this.parts = null; this.rain = null; this.flies = null;
    }

    set(theme, nightAmt) {
        this.clear();
        const T = THEMES[theme];
        this.kind = T.weather;
        const box = { x0: -4, x1: W + 4, z0: -4, z1: H + 4, top: 7 };
        this.box = box;
        if (this.kind === 'leaves' || this.kind === 'snow') {
            const n = this.kind === 'snow' ? 700 : 160;
            const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
            this.v = new Float32Array(n * 3);
            const c = new THREE.Color();
            for (let i = 0; i < n; i++) {
                pos[i * 3] = rand(box.x0, box.x1); pos[i * 3 + 1] = rand(0, box.top); pos[i * 3 + 2] = rand(box.z0, box.z1);
                this.v[i * 3] = rand(-0.2, 0.3); this.v[i * 3 + 1] = this.kind === 'snow' ? -rand(0.35, 0.7) : -rand(0.4, 0.7); this.v[i * 3 + 2] = rand(-0.1, 0.2);
                c.setHex(T.leaves[i % T.leaves.length]);
                col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
            const mat = new THREE.PointsMaterial({ size: this.kind === 'snow' ? 0.07 : 0.1, map: dotTexture(this.kind === 'snow' ? 'dot' : 'leaf'), vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05 });
            this.parts = new THREE.Points(geo, mat);
            this.parts.frustumCulled = false;
            this.group.add(this.parts);
        } else if (this.kind === 'rain') {
            const n = 600;
            const pos = new Float32Array(n * 6);
            for (let i = 0; i < n; i++) {
                const x = rand(box.x0, box.x1), y = rand(0, box.top), z = rand(box.z0, box.z1);
                pos.set([x, y, z, x - 0.04, y + 0.32, z - 0.02], i * 6);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb6d8, transparent: true, opacity: 0.35, depthWrite: false }));
            this.rain.frustumCulled = false;
            this.group.add(this.rain);
        }
        if (nightAmt > 0.4) {
            const n = 50;
            const pos = new Float32Array(n * 3);
            this.fv = new Float32Array(n * 2);
            for (let i = 0; i < n; i++) { pos.set([rand(0, W), rand(0.2, 0.9), rand(0, H)], i * 3); this.fv[i * 2] = rand(0, 6.28); this.fv[i * 2 + 1] = rand(0.2, 0.6); }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            this.flies = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, map: dotTexture('dot'), color: 0xfff09a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            this.flies.frustumCulled = false;
            this.group.add(this.flies);
        }
    }

    update(dt, t) {
        const box = this.box;
        if (!box) return;
        if (this.parts) {
            const a = this.parts.geometry.attributes.position, p = a.array, v = this.v;
            for (let i = 0; i < p.length; i += 3) {
                const sway = this.kind === 'leaves' ? Math.sin(t * 2 + i) * 0.4 : Math.sin(t + i) * 0.15;
                p[i] += (v[i] + sway) * dt; p[i + 1] += v[i + 1] * dt; p[i + 2] += v[i + 2] * dt;
                if (p[i + 1] < 0.02) { p[i] = rand(box.x0, box.x1); p[i + 1] = box.top; p[i + 2] = rand(box.z0, box.z1); }
            }
            a.needsUpdate = true;
        }
        if (this.rain) {
            const a = this.rain.geometry.attributes.position, p = a.array;
            for (let i = 0; i < p.length; i += 6) {
                const dy = -9 * dt;
                p[i + 1] += dy; p[i + 4] += dy; p[i] -= 0.4 * dt; p[i + 3] -= 0.4 * dt;
                if (p[i + 1] < 0) { const x = rand(box.x0, box.x1), z = rand(box.z0, box.z1); p.set([x, box.top, z, x - 0.04, box.top + 0.32, z - 0.02], i); }
            }
            a.needsUpdate = true;
        }
        if (this.flies) {
            const a = this.flies.geometry.attributes.position, p = a.array, f = this.fv;
            for (let i = 0, k = 0; i < p.length; i += 3, k += 2) {
                f[k] += dt * f[k + 1];
                p[i] += Math.cos(f[k]) * 0.2 * dt; p[i + 2] += Math.sin(f[k] * 1.3) * 0.2 * dt; p[i + 1] = 0.5 + Math.sin(f[k] * 2) * 0.25;
            }
            a.needsUpdate = true;
            this.flies.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
        }
    }
}
function rand(a, b) { return a + Math.random() * (b - a); }
