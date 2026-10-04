/**
 * fx.js — juice splashes, sparkles, leaf and ice bits, selection rings, the
 * dotted pollen trail and shockwaves. Everything is pooled.
 */

import * as THREE from 'three';
import { cellToWorld } from './scene.js';

function dotTexture(star = false) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    if (star) {
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2, r = i % 2 ? 6 : 31;
            ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
        }
        ctx.fill();
    } else {
        const g = ctx.createRadialGradient(28, 26, 0, 32, 32, 30);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.6, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

class Particles {
    constructor(scene, max, additive, tex) {
        this.max = max;
        this.geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.size = new Float32Array(max);
        this.alpha = new Float32Array(max);
        this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
        this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
        this.mat = new THREE.ShaderMaterial({
            uniforms: { map: { value: tex }, scale: { value: 400 } },
            vertexShader: `
                attribute float size; attribute float alpha; attribute vec3 color;
                varying vec3 vColor; varying float vAlpha;
                uniform float scale;
                void main() {
                    vColor = color; vAlpha = alpha;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * scale / -mv.z;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
                void main() {
                    vec4 t = texture2D(map, gl_PointCoord);
                    if (t.a * vAlpha < 0.02) discard;
                    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
                    #include <colorspace_fragment>
                }`,
            transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(this.geo, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        scene.add(this.points);
        this.list = [];
        for (let i = 0; i < max; i++) this.list.push({ life: 0 });
        this.cursor = 0;
    }

    spawn(o) {
        const p = this.list[this.cursor];
        this.cursor = (this.cursor + 1) % this.max;
        p.x = o.x; p.y = o.y; p.z = o.z;
        p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
        p.life = p.max = o.life ?? 0.8;
        p.size = o.size ?? 0.2;
        p.grav = o.grav ?? 9;
        p.drag = o.drag ?? 0.5;
        p.c = o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color ?? 0xffffff);
        p.twinkle = o.twinkle ?? 0;
        p.floor = o.floor ?? -1;
    }

    update(dt, time) {
        for (let i = 0; i < this.max; i++) {
            const p = this.list[i];
            if (p.life <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
            p.life -= dt;
            p.vy -= p.grav * dt;
            const d = Math.max(0, 1 - p.drag * dt);
            p.vx *= d; p.vy *= d; p.vz *= d;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
            const k = Math.max(0, p.life / p.max);
            this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
            this.col[i * 3] = p.c.r; this.col[i * 3 + 1] = p.c.g; this.col[i * 3 + 2] = p.c.b;
            this.size[i] = p.size * (0.4 + 0.6 * k) * (p.twinkle ? 0.7 + 0.3 * Math.sin(time * 20 + i) : 1);
            this.alpha[i] = Math.min(1, k * 2.2);
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.color.needsUpdate = true;
        this.geo.attributes.size.needsUpdate = true;
        this.geo.attributes.alpha.needsUpdate = true;
    }
}

export class FX {
    constructor(scene) {
        this.scene = scene;
        this.drops = new Particles(scene, 700, false, dotTexture(false));
        this.sparks = new Particles(scene, 400, true, dotTexture(true));

        // Selection rings under trail fruit.
        this.ringGeo = new THREE.RingGeometry(0.38, 0.48, 32);
        this.ringGeo.rotateX(-Math.PI / 2);
        this.rings = [];
        this.ringRoot = new THREE.Group();
        scene.add(this.ringRoot);
        // Hint rings for legal next hops.
        this.candGeo = new THREE.RingGeometry(0.42, 0.46, 32);
        this.candGeo.rotateX(-Math.PI / 2);
        this.cands = [];

        // Pollen trail dots.
        this.dotMax = 400;
        this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.dotMax);
        this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.dots.count = 0;
        this.dots.frustumCulled = false;
        this.dots.renderOrder = 4;
        scene.add(this.dots);
        this._m = new THREE.Matrix4();
        this._c = new THREE.Color();

        this.waves = [];
        this.waveGeo = new THREE.RingGeometry(0.8, 1, 48);
        this.waveGeo.rotateX(-Math.PI / 2);
    }

    // --- bursts ---
    splash(pos, colour, n = 14, power = 1) {
        const c = new THREE.Color(colour);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = (1.2 + Math.random() * 2.4) * power;
            this.drops.spawn({
                x: pos.x, y: pos.y + 0.3, z: pos.z,
                vx: Math.cos(a) * s, vy: 2.5 + Math.random() * 3.5 * power, vz: Math.sin(a) * s,
                life: 0.55 + Math.random() * 0.4, size: 0.12 + Math.random() * 0.14, color: c.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.15),
                grav: 14, floor: 0.04,
            });
        }
    }

    sparkle(pos, colour = 0xfff2a0, n = 10, spread = 0.5) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * 1.6;
            this.sparks.spawn({
                x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + 0.3 + Math.random() * 0.5, z: pos.z + (Math.random() - 0.5) * spread,
                vx: Math.cos(a) * s, vy: 0.8 + Math.random() * 1.5, vz: Math.sin(a) * s,
                life: 0.5 + Math.random() * 0.6, size: 0.25 + Math.random() * 0.25, color: colour, grav: 0.5, drag: 2, twinkle: 1,
            });
        }
    }

    leaves(pos, n = 12) {
        const cols = [0x7ac043, 0xb8c040, 0xe0a030, 0x5aa83a];
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.8 + Math.random() * 1.8;
            this.drops.spawn({
                x: pos.x, y: pos.y + 0.25, z: pos.z,
                vx: Math.cos(a) * s, vy: 2 + Math.random() * 2.5, vz: Math.sin(a) * s,
                life: 0.9 + Math.random() * 0.5, size: 0.16 + Math.random() * 0.1, color: cols[i % cols.length], grav: 5, drag: 1.5, floor: 0.04,
            });
        }
    }

    ice(pos, n = 14) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2;
            this.drops.spawn({
                x: pos.x, y: pos.y + 0.4, z: pos.z,
                vx: Math.cos(a) * s, vy: 2 + Math.random() * 3, vz: Math.sin(a) * s,
                life: 0.6 + Math.random() * 0.4, size: 0.1 + Math.random() * 0.12, color: i % 3 ? 0xd8f4ff : 0xffffff, grav: 12, floor: 0.04,
            });
        }
        this.sparkle(pos, 0xc8f0ff, 6);
    }

    confetti(center, n = 60) {
        const cols = [0xff5a7a, 0xffc81a, 0x5ac8ff, 0x7ad04a, 0xb07aff, 0xff9a3a];
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
            this.drops.spawn({
                x: center.x + (Math.random() - 0.5) * 4, y: center.y + 1.5, z: center.z + (Math.random() - 0.5) * 4,
                vx: Math.cos(a) * s, vy: 3 + Math.random() * 4, vz: Math.sin(a) * s,
                life: 1.4 + Math.random() * 0.8, size: 0.14 + Math.random() * 0.1, color: cols[i % cols.length], grav: 5, drag: 1.2, floor: 0.03,
            });
        }
    }

    shockwave(pos, colour = 0xffffff, size = 2.2) {
        const m = new THREE.Mesh(this.waveGeo, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.8, depthWrite: false }));
        m.position.set(pos.x, 0.08, pos.z);
        m.renderOrder = 3;
        this.scene.add(m);
        this.waves.push({ m, t: 0, dur: 0.5, size });
    }

    // --- trail ---
    setTrail(cells, colours, pulse, time, wild = false) {
        // Rings
        while (this.rings.length < cells.length) {
            const r = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
            r.renderOrder = 2;
            this.ringRoot.add(r);
            this.rings.push(r);
        }
        const v = new THREE.Vector3();
        this.rings.forEach((r, i) => {
            r.visible = i < cells.length;
            if (!r.visible) return;
            cellToWorld(cells[i][0], cells[i][1], v);
            r.position.set(v.x, 0.03, v.z);
            const s = 1 + Math.sin(time * 6 - i * 0.5) * 0.05;
            r.scale.setScalar(s);
            r.material.color.setHex(wild ? new THREE.Color().setHSL((time * 0.4 + i * 0.08) % 1, 0.8, 0.65).getHex() : (i === cells.length - 1 ? 0xffe25a : 0xffffff));
        });
        // Dots between consecutive cells, coloured by the link trait.
        let n = 0;
        const a = new THREE.Vector3(), b = new THREE.Vector3();
        for (let i = 1; i < cells.length; i++) {
            cellToWorld(cells[i - 1][0], cells[i - 1][1], a);
            cellToWorld(cells[i][0], cells[i][1], b);
            const steps = 4;
            this._c.setHex(colours[i - 1] ?? 0xffffff);
            for (let k = 1; k < steps; k++) {
                if (n >= this.dotMax) break;
                const t = k / steps;
                const y = 0.95 + Math.sin(t * Math.PI) * 0.12 + Math.sin(time * 8 + i + t * 3) * 0.02;
                this._m.makeTranslation(a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t);
                const s = 1 + 0.25 * Math.sin(time * 10 - (i + t) * 2);
                this._m.scale(new THREE.Vector3(s, s, s));
                this.dots.setMatrixAt(n, this._m);
                this.dots.setColorAt(n, this._c);
                n++;
            }
        }
        this.dots.count = n;
        this.dots.instanceMatrix.needsUpdate = true;
        if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    }

    setCandidates(cells, time) {
        while (this.cands.length < cells.length) {
            const r = new THREE.Mesh(this.candGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
            r.renderOrder = 2;
            this.ringRoot.add(r);
            this.cands.push(r);
        }
        const v = new THREE.Vector3();
        this.cands.forEach((r, i) => {
            r.visible = i < cells.length;
            if (!r.visible) return;
            cellToWorld(cells[i][0], cells[i][1], v);
            r.position.set(v.x, 0.025, v.z);
            r.material.opacity = 0.35 + 0.3 * Math.sin(time * 7);
        });
    }

    clearTrail() {
        for (const r of this.rings) r.visible = false;
        for (const r of this.cands) r.visible = false;
        this.dots.count = 0;
    }

    update(dt, time) {
        this.drops.update(dt, time);
        this.sparks.update(dt, time);
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const w = this.waves[i];
            w.t += dt;
            const k = w.t / w.dur;
            w.m.scale.setScalar(0.3 + k * w.size);
            w.m.material.opacity = 0.8 * (1 - k);
            if (k >= 1) {
                this.scene.remove(w.m);
                w.m.material.dispose();
                this.waves.splice(i, 1);
            }
        }
    }

    /** Point sprites are sized in world units: pixels = size * scale / depth. */
    setPixelScale(bufferHeight, fovDeg) {
        const s = bufferHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
        this.drops.mat.uniforms.scale.value = s;
        this.sparks.mat.uniforms.scale.value = s;
    }
}
