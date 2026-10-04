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

const ROPE_Y = 0.78;
const _white = new THREE.Color(0xffffff);

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

        // Glowing discs under trail fruit (drawn under the rings).
        this.discGeo = new THREE.CircleGeometry(0.47, 32);
        this.discGeo.rotateX(-Math.PI / 2);
        this.discs = [];

        // The trail rope: a dark outline tube and a coloured core tube, drawn
        // over the fruit so the path is never hidden behind them.
        const ropeMat = (opts) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...opts });
        this.ropeOutline = new THREE.Mesh(new THREE.BufferGeometry(), ropeMat({ color: 0x4a2a12, opacity: 0.55 }));
        this.ropeCore = new THREE.Mesh(new THREE.BufferGeometry(), ropeMat({ vertexColors: true, opacity: 0.95 }));
        this.ropeOutline.renderOrder = 6;
        this.ropeCore.renderOrder = 7;
        this.ropeOutline.frustumCulled = this.ropeCore.frustumCulled = false;
        this.ropeOutline.visible = this.ropeCore.visible = false;
        scene.add(this.ropeOutline, this.ropeCore);
        this._ropeKey = '';
        this._ropeSegs = null;

        // Pollen sparkles that flow along the rope, plus the rubber band to the finger.
        this.dotMax = 400;
        this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, toneMapped: false }), this.dotMax);
        this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.dots.count = 0;
        this.dots.frustumCulled = false;
        this.dots.renderOrder = 8;
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
    /**
     * Draw the trail being dragged: glowing discs and rings under each fruit,
     * a rope through them coloured per hop by the linking trait, sparkles
     * flowing along it, and a rubber band from the last fruit to the finger.
     * `tail` is the finger's board-plane point (or null).
     */
    setTrail(cells, colours, tail, time, wild = false) {
        const v = new THREE.Vector3();
        const n = cells.length;
        const rainbow = (k) => new THREE.Color().setHSL((time * 0.4 + k * 0.08) % 1, 0.85, 0.6).getHex();

        // Discs + rings
        while (this.rings.length < n) {
            const d = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: 0xffe25a, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
            d.renderOrder = 1;
            this.ringRoot.add(d);
            this.discs.push(d);
            const r = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
            r.renderOrder = 2;
            this.ringRoot.add(r);
            this.rings.push(r);
        }
        this.rings.forEach((r, i) => {
            const d = this.discs[i];
            r.visible = d.visible = i < n;
            if (!r.visible) return;
            cellToWorld(cells[i][0], cells[i][1], v);
            const last = i === n - 1;
            const pulse = last ? 1 + Math.sin(time * 9) * 0.08 : 1 + Math.sin(time * 6 - i * 0.5) * 0.04;
            r.position.set(v.x, 0.03, v.z);
            d.position.set(v.x, 0.025, v.z);
            r.scale.setScalar(pulse);
            d.scale.setScalar(pulse);
            r.material.color.setHex(wild ? rainbow(i) : (last ? 0xffffff : 0xfff3c0));
            d.material.color.setHex(wild ? rainbow(i) : (last ? 0xffd23a : 0xffe680));
            d.material.opacity = last ? 0.75 : 0.5;
        });

        // Rope (rebuilt only when the trail changes).
        const key = cells.map(c => c.join(',')).join(';');
        if (key !== this._ropeKey) {
            this._ropeKey = key;
            this._buildRope(cells);
        }
        if (this._ropeSegs) {
            // Colour each ring of the core tube by the hop it belongs to.
            const col = this.ropeCore.geometry.attributes.color;
            const c = this._c;
            for (let ring = 0; ring < this._ropeSegs.length; ring++) {
                const seg = this._ropeSegs[ring];
                c.setHex(wild ? rainbow(seg) : (colours[seg] ?? 0xffb72b));
                // A bright band that travels toward the newest fruit.
                const u = ring / (this._ropeSegs.length - 1);
                const glow = Math.max(0, Math.sin((u * 6 - time * 3) * Math.PI)) ** 6 * 0.45;
                c.lerp(_white, glow);
                for (let k = 0; k < this._ropeRadial; k++) col.setXYZ(ring * this._ropeRadial + k, c.r, c.g, c.b);
            }
            col.needsUpdate = true;
        }

        // Sparkles along the rope, then the rubber band to the finger.
        let m = 0;
        if (this._ropeCurve) {
            const count = Math.min(this.dotMax - 12, (n - 1) * 3);
            for (let k = 0; k < count; k++) {
                const u = ((k / count) + time * 0.35) % 1;
                this._ropeCurve.getPointAt(u, v);
                const s = 0.55 + 0.25 * Math.sin(time * 12 + k * 1.7);
                this._m.makeScale(s, s, s).setPosition(v.x, v.y + 0.01, v.z);
                this.dots.setMatrixAt(m, this._m);
                this.dots.setColorAt(m, _white);
                m++;
            }
        }
        if (tail && n) {
            const a = cellToWorld(cells[n - 1][0], cells[n - 1][1], new THREE.Vector3()).setY(ROPE_Y);
            const b = new THREE.Vector3(tail.x, ROPE_Y, tail.z);
            const dist = a.distanceTo(b);
            if (dist > 0.3) {
                const steps = Math.min(10, Math.ceil(dist / 0.2));
                for (let k = 1; k <= steps && m < this.dotMax; k++) {
                    const t = k / steps;
                    v.lerpVectors(a, b, t);
                    const s = 0.9 - t * 0.45;
                    this._m.makeScale(s, s, s).setPosition(v.x, v.y, v.z);
                    this.dots.setMatrixAt(m, this._m);
                    this.dots.setColorAt(m, this._c.setHex(wild ? rainbow(n) : 0xfff3c0));
                    m++;
                }
            }
        }
        this.dots.count = m;
        this.dots.instanceMatrix.needsUpdate = true;
        if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    }

    _buildRope(cells) {
        this.ropeOutline.geometry.dispose();
        this.ropeCore.geometry.dispose();
        this._ropeSegs = null;
        this._ropeCurve = null;
        const n = cells.length;
        this.ropeOutline.visible = this.ropeCore.visible = n >= 2;
        if (n < 2) {
            this.ropeOutline.geometry = new THREE.BufferGeometry();
            this.ropeCore.geometry = new THREE.BufferGeometry();
            return;
        }
        const pts = cells.map(([r, c]) => cellToWorld(r, c, new THREE.Vector3()).setY(ROPE_Y));
        const curve = n === 2 ? new THREE.LineCurve3(pts[0], pts[1]) : new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const tubular = (n - 1) * 10, radial = 10;
        this.ropeOutline.geometry = new THREE.TubeGeometry(curve, tubular, 0.155, radial, false);
        const core = new THREE.TubeGeometry(curve, tubular, 0.105, radial, false);
        core.setAttribute('color', new THREE.BufferAttribute(new Float32Array(core.attributes.position.count * 3), 3));
        this.ropeCore.geometry = core;
        // Which hop each ring of the tube belongs to, by arc length along the trail.
        const lens = [0];
        for (let i = 1; i < n; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
        const total = lens[n - 1];
        this._ropeSegs = [];
        for (let ring = 0; ring <= tubular; ring++) {
            const d = (ring / tubular) * total;
            let seg = 0;
            while (seg < n - 2 && d > lens[seg + 1]) seg++;
            this._ropeSegs.push(seg);
        }
        this._ropeRadial = radial + 1;
        this._ropeCurve = curve;
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
        for (const d of this.discs) d.visible = false;
        this.ropeOutline.visible = this.ropeCore.visible = false;
        this._ropeKey = '';
        this._ropeSegs = null;
        this._ropeCurve = null;
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
