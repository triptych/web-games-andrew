// Effects that answer sim events or mirror short-lived sim objects: a pooled additive particle
// system, floating score numbers, zap bolts, nova flames and fireballs, and the crew's shots.

import * as THREE from 'three';
import { H } from '../config.js';

const MAXP = 900;

const PVERT = /* glsl */`
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vC;
varying float vA;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vC = aColor; vA = aAlpha;
    gl_PointSize = aSize * (520.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */`
varying vec3 vC;
varying float vA;
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = clamp(1.0 - d * 2.0, 0.0, 1.0);
    gl_FragColor = vec4(vC * 1.6, a * a * vA);
}`;

function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function boltTex(seed) {
    return canvasTex(256, 64, (g) => {
        let s = seed;
        const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (const [w, col] of [[14, 'rgba(255,230,90,0.35)'], [6, 'rgba(255,245,170,0.9)'], [2, '#ffffff']]) {
            g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round';
            s = seed;
            g.beginPath(); g.moveTo(0, 32);
            for (let x = 16; x <= 256; x += 16) g.lineTo(x, 32 + (r() - 0.5) * 40);
            g.stroke();
        }
    });
}

export class Fx {
    constructor(scene) {
        this.scene = scene;
        // particles
        this.pos = new Float32Array(MAXP * 3);
        this.col = new Float32Array(MAXP * 3);
        this.size = new Float32Array(MAXP);
        this.alpha = new Float32Array(MAXP);
        this.p = [];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.points.frustumCulled = false;
        this.points.renderOrder = 8;
        scene.add(this.points);
        // score numbers
        this.labels = [];
        this.labelTex = new Map();
        // bolts, flames, novas, shots: pooled meshes keyed by sim id
        this.boltTex = [boltTex(11), boltTex(29), boltTex(53)];
        this.pools = { bolt: new Map(), nova: new Map(), shot: new Map() };
        this.flameTex = canvasTex(64, 128, (gx) => {
            const grd = gx.createRadialGradient(32, 96, 2, 32, 80, 60);
            grd.addColorStop(0, 'rgba(255,255,220,1)'); grd.addColorStop(0.3, 'rgba(255,170,60,0.95)'); grd.addColorStop(0.7, 'rgba(255,60,20,0.5)'); grd.addColorStop(1, 'rgba(255,0,0,0)');
            gx.fillStyle = grd;
            gx.beginPath(); gx.moveTo(32, 4); gx.quadraticCurveTo(62, 70, 52, 110); gx.quadraticCurveTo(32, 128, 12, 110); gx.quadraticCurveTo(2, 70, 32, 4); gx.fill();
        });
        this.flames = [];
        this.flameGroup = new THREE.Group();
        scene.add(this.flameGroup);
        this.geo = { sph: new THREE.SphereGeometry(1, 16, 10), box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1) };
    }

    burst(x, y, n, color, o = {}) {
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            if (this.p.length >= MAXP) this.p.shift();
            const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 6) * (0.3 + Math.random() * 0.7);
            const cc = o.rainbow ? new THREE.Color().setHSL(Math.random(), 0.9, 0.65) : c;
            this.p.push({
                x, y, z: 0.6 + Math.random() * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up ?? 0), g: o.g ?? 6,
                life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), t: 0, size: (o.size ?? 0.35) * (0.6 + Math.random() * 0.8), r: cc.r, gg: cc.g, b: cc.b,
            });
        }
    }

    ring(x, y, n, color, r = 1, o = {}) {
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            if (this.p.length >= MAXP) this.p.shift();
            const a = (i / n) * Math.PI * 2, sp = o.speed ?? 5;
            this.p.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: 0.9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: o.life ?? 0.35, t: 0, size: o.size ?? 0.3, r: c.r, gg: c.g, b: c.b });
        }
    }

    /** A rising number or word at a world point. */
    label(text, x, y, color = '#ffe066', big = false) {
        const key = text + color + big;
        let tex = this.labelTex.get(key);
        if (!tex) {
            // measure first: a fixed-width canvas clips long words ("Long Shot")
            const font = `900 ${big ? 64 : 52}px system-ui, Arial Black, sans-serif`;
            const m = document.createElement('canvas').getContext('2d');
            m.font = font;
            const w = Math.ceil(m.measureText(text).width + 28);
            tex = canvasTex(w, 96, (g) => {
                g.font = font;
                g.textAlign = 'center'; g.textBaseline = 'middle';
                g.lineWidth = 10; g.strokeStyle = 'rgba(10,6,30,0.9)';
                g.strokeText(text, w / 2, 50);
                g.fillStyle = color;
                g.fillText(text, w / 2, 50);
            });
            tex.userData = { aspect: w / 96 };
            this.labelTex.set(key, tex);
        }
        // don't stack on a label that is still rising from the same spot
        for (const l of this.labels) if (l.s.visible && l.t < 0.5 && Math.abs(l.s.position.x - x) < 1.5 && Math.abs(l.y - y) < 0.8) y += 0.9;
        let s = this.labels.find((l) => !l.s.visible);
        if (!s) {
            s = { s: new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })) };
            s.s.renderOrder = 20;
            this.scene.add(s.s);
            this.labels.push(s);
        }
        s.s.material.map = tex;
        s.s.material.needsUpdate = true;
        s.s.visible = true;
        s.s.position.set(x, y, 2);
        s.t = 0; s.y = y; s.big = big;
        const hgt = big ? 2 : 1.35;
        s.s.scale.set(hgt * tex.userData.aspect, hgt, 1);
    }

    clearAll() {
        this.p.length = 0;
        for (const l of this.labels) l.s.visible = false;
        for (const pool of Object.values(this.pools)) { for (const m of pool.values()) this.scene.remove(m); pool.clear(); }
        for (const f of this.flames) f.visible = false;
    }

    /** Keep a mesh per live sim object (by id); drop the rest. */
    sync(pool, list, make, place) {
        const live = new Set();
        for (const o of list) {
            live.add(o.id);
            let m = pool.get(o.id);
            if (!m) { m = make(o); pool.set(o.id, m); this.scene.add(m); }
            place(m, o);
        }
        for (const [id, m] of pool) if (!live.has(id)) { this.scene.remove(m); pool.delete(id); }
    }

    update(G, dt, time) {
        // particles
        let n = 0;
        for (let i = this.p.length - 1; i >= 0; i--) {
            const q = this.p[i];
            q.t += dt;
            if (q.t >= q.life) { this.p.splice(i, 1); continue; }
            q.vy -= q.g * dt;
            q.x += q.vx * dt; q.y += q.vy * dt;
            q.vx *= 1 - dt * 1.5;
        }
        for (const q of this.p) {
            if (n >= MAXP) break;
            this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
            this.col[n * 3] = q.r; this.col[n * 3 + 1] = q.gg; this.col[n * 3 + 2] = q.b;
            this.size[n] = q.size;
            this.alpha[n] = 1 - q.t / q.life;
            n++;
        }
        const geo = this.points.geometry;
        geo.setDrawRange(0, n);
        for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) geo.attributes[k].needsUpdate = true;
        // labels
        for (const l of this.labels) {
            if (!l.s.visible) continue;
            l.t += dt;
            l.s.position.y = l.y + Math.min(1, l.t * 2) * 1.2;
            l.s.material.opacity = l.t < 0.9 ? 1 : Math.max(0, 1 - (l.t - 0.9) * 2.5);
            if (l.t > (l.big ? 1.8 : 1.3)) l.s.visible = false;
        }
        if (!G) return;
        // zap bolts
        this.sync(this.pools.bolt, G.bolts, () => {
            const m = new THREE.Mesh(this.geo.plane, new THREE.MeshBasicMaterial({ map: this.boltTex[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            m.scale.set(3.4, 1.4, 1);
            m.renderOrder = 9;
            return m;
        }, (m, z) => {
            m.position.set(z.x, H - z.y, 1);
            m.rotation.z = Math.atan2(-z.vy, z.vx);
            m.material.map = this.boltTex[Math.floor(time * 30) % 3];
            if (Math.random() < 0.6) this.burst(z.x, H - z.y, 1, 0xfff27a, { speed: 2, life: 0.3, size: 0.3, g: 0 });
        });
        // falling novas
        this.sync(this.pools.nova, G.novas, () => {
            const m = new THREE.Mesh(this.geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.4) }));
            m.scale.setScalar(0.45);
            return m;
        }, (m, o) => {
            m.position.set(o.x, H - o.y + 0.4, 0.8);
            this.burst(o.x, H - o.y + 0.4, 1, 0xff8a3a, { speed: 1.5, life: 0.4, size: 0.4, g: -2 });
        });
        // flames
        let f = 0;
        for (const fl of G.flames) {
            if (fl.t < 0) continue;
            let s = this.flames[f];
            if (!s) {
                s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
                this.flameGroup.add(s);
                this.flames.push(s);
            }
            s.visible = true;
            const life = 1 - fl.t / 4;
            const flick = 0.85 + Math.sin(time * 23 + fl.c * 3.1) * 0.15;
            s.scale.set(0.95 * flick, 1.5 * flick * Math.min(1, fl.t * 5) * (0.5 + 0.5 * life), 1);
            s.position.set(fl.c + 0.5, H - fl.r + s.scale.y * 0.42, 0.8);
            f++;
        }
        for (let i = f; i < this.flames.length; i++) this.flames[i].visible = false;
        // the crew's shots
        this.sync(this.pools.shot, G.shots, (o) => {
            if (o.kind === 'laser') {
                const m = new THREE.Mesh(this.geo.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 2.4) }));
                m.scale.set(0.18, 1.1, 0.18);
                return m;
            }
            const g = new THREE.Group();
            const core = new THREE.Mesh(this.geo.sph, new THREE.MeshBasicMaterial({ color: o.kind === 'orb' ? new THREE.Color(0.08, 0, 0.12) : new THREE.Color(1, 3, 0.8) }));
            core.scale.setScalar(o.kind === 'orb' ? 0.42 : 0.32);
            const halo = new THREE.Mesh(this.geo.sph, new THREE.MeshBasicMaterial({ color: o.kind === 'orb' ? new THREE.Color(1.8, 0.4, 3) : new THREE.Color(0.4, 1.6, 0.3), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
            halo.scale.setScalar(o.kind === 'orb' ? 0.62 : 0.5);
            g.add(core, halo);
            return g;
        }, (m, o) => {
            m.position.set(o.x, H - o.y, 0.9);
            if (m.children.length) m.children[1].scale.setScalar((o.kind === 'orb' ? 0.62 : 0.5) * (1 + Math.sin(time * 20 + o.id) * 0.12));
        });
    }
}
