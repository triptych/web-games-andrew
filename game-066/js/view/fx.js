// Particles and battle effects. Two pooled GPU point clouds (additive for sparks, embers and glows;
// alpha-blended for smoke, steam, dust and snow) with a soft round sprite drawn in the shader, plus
// helpers for beams, expanding rings, lightning bolts and projectiles.

import * as THREE from 'three';

const PVERT = /* glsl */`
    attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
    varying float vAlpha; varying vec3 vColor;
    uniform float uScale;
    void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        vAlpha = aAlpha; vColor = aColor;
    }`;
const PFRAG = /* glsl */`
    varying float vAlpha; varying vec3 vColor; uniform float uSoft;
    void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, uSoft, d);
        if (a <= 0.01 || vAlpha <= 0.0) discard;
        gl_FragColor = vec4(vColor, a * vAlpha);
    }`;

class Cloud {
    constructor(cap, additive) {
        this.cap = cap;
        this.n = 0;
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(cap * 3);
        this.col = new Float32Array(cap * 3);
        this.size = new Float32Array(cap);
        this.alpha = new Float32Array(cap);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        this.mat = new THREE.ShaderMaterial({
            vertexShader: PVERT, fragmentShader: PFRAG,
            uniforms: { uScale: { value: 300 }, uSoft: { value: additive ? 0.0 : 0.15 } },
            transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 20 : 10;
        this.geo = g;
        this.p = [];       // live particles
    }
    add(p) {
        if (this.p.length >= this.cap) this.p.shift();
        this.p.push(p);
    }
    update(dt) {
        const P = this.p;
        let w = 0;
        for (let i = 0; i < P.length; i++) {
            const p = P[i];
            p.t += dt;
            if (p.t >= p.life) continue;
            p.vx += (p.ax || 0) * dt; p.vy += (p.ay || 0) * dt; p.vz += (p.az || 0) * dt;
            const dr = p.drag ? Math.pow(p.drag, dt) : 1;
            p.vx *= dr; p.vy *= dr; p.vz *= dr;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            P[w++] = p;
        }
        P.length = w;
        const n = Math.min(P.length, this.cap);
        for (let i = 0; i < n; i++) {
            const p = P[i], k = p.t / p.life;
            this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
            const c = p.c1 && k > 0 ? lerpC(p.c0, p.c1, k) : p.c0;
            this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
            this.size[i] = p.s0 + (p.s1 - p.s0) * k;
            const fadeIn = p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1;
            this.alpha[i] = p.a * fadeIn * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3) * (p.flicker ? 0.6 + 0.4 * Math.sin(p.t * 40 + i) : 1);
        }
        this.geo.setDrawRange(0, n);
        for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[k].needsUpdate = true;
    }
    clear() { this.p.length = 0; this.geo.setDrawRange(0, 0); }
}
const tmpC = [0, 0, 0];
function lerpC(a, b, k) { tmpC[0] = a[0] + (b[0] - a[0]) * k; tmpC[1] = a[1] + (b[1] - a[1]) * k; tmpC[2] = a[2] + (b[2] - a[2]) * k; return tmpC; }
export function rgb(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }

const R = Math.random;   // cosmetic randomness only (view never feeds the simulation)

export class FX {
    constructor(scene, budget = 1) {
        this.scene = scene;
        this.budget = budget;
        this.add = new Cloud(2600, true);
        this.alpha = new Cloud(2600, false);
        scene.add(this.add.points, this.alpha.points);
        this.objs = [];       // timed meshes: { obj, t, life, update }
    }
    setScale(px) { this.add.mat.uniforms.uScale.value = px; this.alpha.mat.uniforms.uScale.value = px; }
    clear() { this.add.clear(); this.alpha.clear(); for (const o of this.objs) o.obj.parent && o.obj.parent.remove(o.obj); this.objs.length = 0; }

    /** Emit a particle kind at a world position. */
    emit(kind, x, y, z, o = {}) {
        if (R() > this.budget && !o.force) return;
        const n = o.n || 1;
        for (let i = 0; i < n; i++) this.one(kind, x, y, z, o);
    }
    one(kind, x, y, z, o) {
        const s = o.scale || 1;
        const j = (a) => (R() - 0.5) * a;
        switch (kind) {
            case 'smoke': this.alpha.add({ x: x + j(0.1), y, z: z + j(0.1), vx: j(0.3) + (o.wind || 0.25), vy: 0.6 + R() * 0.4, vz: j(0.3), t: 0, life: 2.6 + R(), s0: 14 * s, s1: 60 * s, a: 0.4, c0: rgb(o.color || '#5a5450'), c1: rgb('#8a8278'), drag: 0.6, fadeIn: 0.3 }); break;
            case 'steam': this.alpha.add({ x: x + j(0.1), y, z: z + j(0.1), vx: j(0.4) + (o.wind || 0.15), vy: 0.8 + R() * 0.5, vz: j(0.4), t: 0, life: 1.4 + R() * 0.6, s0: 10 * s, s1: 46 * s, a: 0.55, c0: rgb('#f0f0f0'), drag: 0.5, fadeIn: 0.15 }); break;
            case 'spark': this.add.add({ x, y, z, vx: j(3) * s, vy: R() * 2.5 * s, vz: j(3) * s, ay: -6, t: 0, life: 0.3 + R() * 0.4, s0: 7 * s, s1: 2, a: 1, c0: rgb(o.color || '#fff0a0'), c1: rgb('#ff8a2a'), drag: 0.8 }); break;
            case 'ember': this.add.add({ x: x + j(0.2), y, z: z + j(0.2), vx: j(0.4), vy: 0.6 + R() * 0.8, vz: j(0.4), t: 0, life: 1 + R() * 1.2, s0: 6 * s, s1: 2, a: 0.9, c0: rgb('#ffb04a'), c1: rgb('#ff3a0a'), flicker: true }); break;
            case 'jet': this.add.add({ x: x + j(0.05), y, z: z + j(0.05), vx: j(0.3), vy: -1.5 - R(), vz: j(0.3), t: 0, life: 0.25 + R() * 0.2, s0: 10 * s, s1: 3, a: 0.8, c0: rgb(o.color || '#8ad8ff'), c1: rgb('#ffffff') }); break;
            case 'bubble': this.add.add({ x: x + j(0.08), y, z: z + j(0.08), vx: 0, vy: 0.3 + R() * 0.2, vz: 0, t: 0, life: 0.8 + R() * 0.5, s0: 5 * s, s1: 7 * s, a: 0.7, c0: rgb(o.color || '#aaff6a') }); break;
            case 'dust': this.alpha.add({ x, y, z, vx: j(0.3) + 0.2, vy: j(0.1), vz: j(0.3), t: 0, life: 6 + R() * 4, s0: 3 * s, s1: 3 * s, a: 0.35, c0: rgb(o.color || '#e8d0a0'), fadeIn: 1.5 }); break;
            case 'snow': this.alpha.add({ x, y, z, vx: j(0.3) + 0.15, vy: -0.4 - R() * 0.3, vz: j(0.3), t: 0, life: 8, s0: 5 * s, s1: 5 * s, a: 0.8, c0: rgb('#ffffff'), fadeIn: 0.5 }); break;
            case 'ash': this.alpha.add({ x, y, z, vx: j(0.3) + 0.2, vy: -0.15 - R() * 0.1, vz: j(0.3), t: 0, life: 8, s0: 4 * s, s1: 4 * s, a: 0.5, c0: rgb('#3a3a3a'), fadeIn: 0.5 }); break;
            case 'mote': this.add.add({ x, y, z, vx: j(0.2), vy: 0.05 + R() * 0.1, vz: j(0.2), t: 0, life: 4 + R() * 3, s0: 4 * s, s1: 4 * s, a: 0.7, c0: rgb(o.color || '#c8ff8a'), flicker: true, fadeIn: 1 }); break;
            case 'rain': this.alpha.add({ x, y, z, vx: 0.4, vy: -9, vz: 0, t: 0, life: 0.6, s0: 3, s1: 3, a: 0.5, c0: rgb(o.color || '#a8ff8a') }); break;
            case 'glow': this.add.add({ x, y, z, vx: 0, vy: 0, vz: 0, t: 0, life: o.life || 0.4, s0: (o.size || 60) * s, s1: (o.size2 ?? o.size ?? 60) * s, a: o.a ?? 0.9, c0: rgb(o.color || '#ffffff') }); break;
            case 'burst': this.add.add({ x, y, z, vx: j(5) * s, vy: j(5) * s + 1, vz: j(5) * s, t: 0, life: 0.4 + R() * 0.4, s0: 12 * s, s1: 2, a: 1, c0: rgb(o.color || '#ffffff'), drag: 0.25, ay: o.grav ?? -2 }); break;
            case 'puff': this.alpha.add({ x, y, z, vx: j(2) * s, vy: R() * 1.2, vz: j(2) * s, t: 0, life: 0.8 + R() * 0.5, s0: 20 * s, s1: 70 * s, a: 0.5, c0: rgb(o.color || '#d8d0c0'), drag: 0.2 }); break;
            case 'shard': this.alpha.add({ x, y, z, vx: j(4) * s, vy: R() * 3 * s, vz: j(4) * s, ay: -8, t: 0, life: 0.6 + R() * 0.4, s0: 8 * s, s1: 5 * s, a: 1, c0: rgb(o.color || '#c8f4ff') }); break;
            case 'leaf': this.alpha.add({ x, y, z, vx: j(2), vy: R() * 2, vz: j(2), ay: -1.5, t: 0, life: 1.2 + R(), s0: 7 * s, s1: 6 * s, a: 1, c0: rgb(o.color || '#6ad84a'), drag: 0.5 }); break;
        }
    }

    /** A cylinder beam from a to b that flares and fades. */
    beam(a, b, color, width = 0.12, life = 0.5) {
        const d = new THREE.Vector3().subVectors(b, a);
        const len = d.length();
        const m = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.copy(a).addScaledVector(d, 0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        this.scene.add(m);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.35, width * 0.35, len, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.add(core);
        this.objs.push({ obj: m, t: 0, life, update: (o, k) => { const s = 1 + Math.sin(k * Math.PI) * 0.6; m.scale.set(s, 1, s); m.material.opacity = 0.9 * (1 - k); core.material.opacity = 1 - k; } });
    }

    ring(pos, color, r0 = 0.2, r1 = 2.5, life = 0.6, flat = true) {
        const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.copy(pos);
        if (flat) m.rotation.x = Math.PI / 2;
        this.scene.add(m);
        this.objs.push({ obj: m, t: 0, life, update: (o, k) => { const r = r0 + (r1 - r0) * (1 - (1 - k) * (1 - k)); m.scale.set(r, r, r); m.material.opacity = 1 - k; } });
    }

    /** A jagged lightning bolt between two points, re-jittered while it lives. */
    bolt(a, b, color = '#fff27a', life = 0.35, segs = 12) {
        const pts = new Float32Array((segs + 1) * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        const glowL = line.clone(); glowL.material = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
        const grp = new THREE.Group(); grp.add(line, glowL);
        const jit = () => {
            for (let i = 0; i <= segs; i++) {
                const k = i / segs;
                const amp = Math.sin(k * Math.PI) * 0.35;
                pts[i * 3] = a.x + (b.x - a.x) * k + (R() - 0.5) * amp;
                pts[i * 3 + 1] = a.y + (b.y - a.y) * k + (R() - 0.5) * amp;
                pts[i * 3 + 2] = a.z + (b.z - a.z) * k + (R() - 0.5) * amp;
            }
            g.attributes.position.needsUpdate = true;
        };
        jit();
        this.scene.add(grp);
        this.objs.push({ obj: grp, t: 0, life, update: (o, k) => { if (R() < 0.6) jit(); line.material.opacity = 1 - k; } });
    }

    /** A mesh flying from a to b (arcing), calling onHit at the end. */
    projectile(mesh, a, b, dur = 0.45, arc = 0.6, onHit = null, trail = null) {
        mesh.position.copy(a);
        this.scene.add(mesh);
        const fx = this;
        this.objs.push({
            obj: mesh, t: 0, life: dur, update: (o, k) => {
                mesh.position.lerpVectors(a, b, k);
                mesh.position.y += Math.sin(k * Math.PI) * arc;
                mesh.rotation.x += 0.3; mesh.rotation.y += 0.2;
                if (trail) fx.emit(trail.kind, mesh.position.x, mesh.position.y, mesh.position.z, { color: trail.color, force: true, scale: trail.scale || 1 });
            }, done: onHit,
        });
    }

    timed(obj, life, update) { this.scene.add(obj); this.objs.push({ obj, t: 0, life, update }); }

    update(dt) {
        this.add.update(dt);
        this.alpha.update(dt);
        let w = 0;
        for (const o of this.objs) {
            o.t += dt;
            const k = Math.min(1, o.t / o.life);
            if (o.update) o.update(o, k);
            if (o.t >= o.life) {
                if (o.obj.parent) o.obj.parent.remove(o.obj);
                o.obj.traverse((c) => { if (c.isMesh || c.isLine) { if (c.geometry && !c.userData.shared) c.geometry.dispose(); } });
                if (o.done) o.done();
                continue;
            }
            this.objs[w++] = o;
        }
        this.objs.length = w;
    }
}
