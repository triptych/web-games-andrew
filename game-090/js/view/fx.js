// Battle and field effects: one pooled particle cloud, pooled rings, beams, slashes and
// lightning, and a recipe per element. All additive and unlit, so they bloom.

import * as THREE from 'three';

const CAP = 1400;
const tmp = new THREE.Color();

export class FX {
    constructor(scene) {
        this.scene = scene;
        this.calm = false;
        // particles
        this.pos = new Float32Array(CAP * 3); this.col = new Float32Array(CAP * 3); this.siz = new Float32Array(CAP); this.alp = new Float32Array(CAP);
        this.vel = new Float32Array(CAP * 3); this.life = new Float32Array(CAP); this.max = new Float32Array(CAP); this.grav = new Float32Array(CAP); this.drag = new Float32Array(CAP); this.sz0 = new Float32Array(CAP); this.grow = new Float32Array(CAP);
        this.next = 0;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        g.setAttribute('size', new THREE.BufferAttribute(this.siz, 1));
        g.setAttribute('alpha', new THREE.BufferAttribute(this.alp, 1));
        const m = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uScale: { value: 600 } },
            vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uScale; void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
            fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC * (0.6 + a), a * vA); }',
        });
        this.points = new THREE.Points(g, m);
        this.points.frustumCulled = false;
        scene.add(this.points);
        // pools
        this.rings = []; this.beams = []; this.slashes = []; this.bolts = []; this.pillars = [];
        this.lights = [];
    }

    // ------------------------------------------------------------ particles
    spawn(x, y, z, vx, vy, vz, color, size, life, o = {}) {
        const i = this.next; this.next = (this.next + 1) % CAP;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        tmp.set(color);
        this.col[i * 3] = tmp.r; this.col[i * 3 + 1] = tmp.g; this.col[i * 3 + 2] = tmp.b;
        this.siz[i] = this.sz0[i] = size; this.life[i] = this.max[i] = life; this.alp[i] = 1;
        this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0; this.grow[i] = o.grow ?? 0;
    }
    burst(p, color, n = 20, speed = 3, life = 0.6, size = 0.3, o = {}) {
        if (this.calm) n = Math.ceil(n * 0.6);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283, b = (Math.random() - 0.3) * 2.2, s = speed * (0.4 + Math.random() * 0.8);
            this.spawn(p.x, p.y, p.z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s * (o.up ?? 1) + (o.lift ?? 0), Math.sin(a) * Math.cos(b) * s, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), o);
        }
    }

    // ------------------------------------------------------------ rings, beams, slashes
    ring(p, color, r0 = 0.3, r1 = 3, life = 0.5, flat = true, w = 0.12) {
        let r = this.rings.find((x) => !x.live);
        if (!r) {
            r = { mesh: new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false })), live: false };
            this.scene.add(r.mesh); this.rings.push(r);
        }
        r.live = true; r.t = 0; r.life = life; r.r0 = r0; r.r1 = r1;
        r.mesh.visible = true; r.mesh.material.color.set(color);
        r.mesh.position.copy(p); r.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
        r.flat = flat; r.cam = null;
    }
    beam(a, b, color, life = 0.25, width = 0.12) {
        let r = this.beams.find((x) => !x.live);
        if (!r) {
            r = { mesh: new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })), live: false };
            this.scene.add(r.mesh); this.beams.push(r);
        }
        r.live = true; r.t = 0; r.life = life; r.w = width;
        const d = new THREE.Vector3().subVectors(b, a), len = d.length();
        r.mesh.visible = true; r.mesh.material.color.set(color);
        r.mesh.position.copy(a).addScaledVector(d, 0.5);
        r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        r.len = len;
        r.mesh.scale.set(width, len, width);
    }
    slash(p, color, size = 1.6, life = 0.28, tilt = 0.6) {
        let r = this.slashes.find((x) => !x.live);
        if (!r) {
            r = { mesh: new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 20, 1, 0, 2.0), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false })), live: false };
            this.scene.add(r.mesh); this.slashes.push(r);
        }
        r.live = true; r.t = 0; r.life = life; r.size = size;
        r.mesh.visible = true; r.mesh.material.color.set(color);
        r.mesh.position.copy(p); r.mesh.rotation.set(0, 0, tilt - 1.0);
        r.mesh.scale.setScalar(size);
        r.cam = true;
    }
    pillar(p, color, h = 8, life = 0.6, r = 0.7) {
        let o = this.pillars.find((x) => !x.live);
        if (!o) {
            o = { mesh: new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false })), live: false };
            this.scene.add(o.mesh); this.pillars.push(o);
        }
        o.live = true; o.t = 0; o.life = life; o.h = h; o.r = r;
        o.mesh.visible = true; o.mesh.material.color.set(color);
        o.mesh.position.set(p.x, p.y + h / 2, p.z);
    }
    bolt(a, b, color = '#fff6a0', life = 0.3) {
        let o = this.bolts.find((x) => !x.live);
        if (!o) {
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
            o = { line: new THREE.Line(g, new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })), live: false };
            this.scene.add(o.line); this.bolts.push(o);
        }
        o.live = true; o.t = 0; o.life = life; o.a = a.clone(); o.b = b.clone();
        o.line.visible = true; o.line.material.color.set(color);
        this.jag(o);
    }
    jag(o) {
        const p = o.line.geometry.attributes.position;
        for (let i = 0; i < 14; i++) {
            const k = i / 13, j = (i === 0 || i === 13) ? 0 : 0.5;
            p.setXYZ(i, o.a.x + (o.b.x - o.a.x) * k + (Math.random() - 0.5) * j, o.a.y + (o.b.y - o.a.y) * k + (Math.random() - 0.5) * j * 0.3, o.a.z + (o.b.z - o.a.z) * k + (Math.random() - 0.5) * j);
        }
        p.needsUpdate = true;
    }
    light(p, color, intensity = 20, life = 0.4, dist = 14) {
        let l = this.lights.find((x) => !x.live);
        if (!l) { l = { light: new THREE.PointLight('#fff', 0, dist, 1.6), live: false }; this.scene.add(l.light); this.lights.push(l); }
        l.live = true; l.t = 0; l.life = life; l.k = intensity;
        l.light.color.set(color); l.light.position.copy(p); l.light.distance = dist;
    }

    // ------------------------------------------------------------ frame
    update(dt, camera) {
        for (let i = 0; i < CAP; i++) {
            if (this.life[i] <= 0) { this.alp[i] = 0; continue; }
            this.life[i] -= dt;
            const k = Math.max(0, this.life[i] / this.max[i]);
            const d = Math.max(0, 1 - this.drag[i] * dt);
            this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
            this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            this.alp[i] = Math.min(1, k * 1.6);
            this.siz[i] = this.sz0[i] * (this.grow[i] ? 1 + (1 - k) * this.grow[i] : 0.4 + k * 0.6);
        }
        const gp = this.points.geometry;
        gp.attributes.position.needsUpdate = gp.attributes.size.needsUpdate = gp.attributes.alpha.needsUpdate = gp.attributes.color.needsUpdate = true;
        for (const r of this.rings) if (r.live) {
            r.t += dt; const k = r.t / r.life;
            if (k >= 1) { r.live = false; r.mesh.visible = false; continue; }
            r.mesh.scale.setScalar(r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)));
            r.mesh.material.opacity = 1 - k;
            if (!r.flat) r.mesh.quaternion.copy(camera.quaternion);
        }
        for (const r of this.beams) if (r.live) {
            r.t += dt; const k = r.t / r.life;
            if (k >= 1) { r.live = false; r.mesh.visible = false; continue; }
            r.mesh.scale.set(r.w * (1 - k * 0.7), r.len, r.w * (1 - k * 0.7));
            r.mesh.material.opacity = 1 - k * k;
        }
        for (const r of this.slashes) if (r.live) {
            r.t += dt; const k = r.t / r.life;
            if (k >= 1) { r.live = false; r.mesh.visible = false; continue; }
            r.mesh.quaternion.copy(camera.quaternion);
            r.mesh.rotateZ(-1.0 + k * 1.8);
            r.mesh.scale.setScalar(r.size * (0.7 + k * 0.5));
            r.mesh.material.opacity = Math.sin((1 - k) * Math.PI * 0.5);
        }
        for (const o of this.pillars) if (o.live) {
            o.t += dt; const k = o.t / o.life;
            if (k >= 1) { o.live = false; o.mesh.visible = false; continue; }
            const w = o.r * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8 * 0.8);
            o.mesh.scale.set(w, o.h, w);
            o.mesh.material.opacity = 1 - k * 0.8;
        }
        for (const o of this.bolts) if (o.live) {
            o.t += dt; const k = o.t / o.life;
            if (k >= 1) { o.live = false; o.line.visible = false; continue; }
            if (Math.random() < 0.5) this.jag(o);
            o.line.material.opacity = 1 - k;
        }
        for (const l of this.lights) if (l.live) {
            l.t += dt; const k = l.t / l.life;
            if (k >= 1) { l.live = false; l.light.intensity = 0; continue; }
            l.light.intensity = l.k * (1 - k) * (1 - k);
        }
    }

    clear() {
        this.life.fill(0); this.alp.fill(0);
        for (const arr of [this.rings, this.beams, this.slashes, this.pillars]) for (const r of arr) { r.live = false; r.mesh.visible = false; }
        for (const o of this.bolts) { o.live = false; o.line.visible = false; }
        for (const l of this.lights) { l.live = false; l.light.intensity = 0; }
    }

    // ------------------------------------------------------------ element recipes
    /** An attack of element `el` landing at `p` (world), from `from`. */
    hit(el, p, from, big = false) {
        const k = big ? 1.6 : 1;
        const c = p.clone();
        switch (el) {
            case 'strike':
                this.slash(c.clone().add(new THREE.Vector3(0, 0.2, 0)), '#ffd8a0', 1.7 * k, 0.3, 0.7);
                this.burst(c, '#ffb060', 14 * k, 4, 0.4, 0.22, { grav: 6 });
                this.light(c.clone().add(new THREE.Vector3(0, 1, 0)), '#ffb060', 14, 0.25);
                break;
            case 'gun': {
                const o = from ? from.clone().add(new THREE.Vector3(0, 1.2, 0)) : c.clone().add(new THREE.Vector3(-6, 1.2, 2));
                this.beam(o, c.clone().add(new THREE.Vector3(0, 1, 0)), '#fff8d0', 0.14, 0.05);
                this.burst(c.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe8a0', 10, 3, 0.3, 0.18, { grav: 4 });
                this.light(c.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe8a0', 10, 0.2);
                break;
            }
            case 'pyre':
                for (let i = 0; i < 26 * k; i++) this.spawn(c.x + (Math.random() - 0.5) * 1.2, c.y + Math.random() * 0.3, c.z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6, 2 + Math.random() * 3, (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? '#ff5a2a' : '#ffb040', 0.55, 0.8, { grav: -1, drag: 1.2, grow: 0.8 });
                this.ring(c.clone().setY(0.1), '#ff7a3a', 0.3, 2.6 * k, 0.5);
                this.pillar(c.clone(), '#ff6a2a', 4 * k, 0.55, 0.9 * k);
                this.light(c.clone().add(new THREE.Vector3(0, 1.2, 0)), '#ff7a3a', 40, 0.7);
                break;
            case 'rime':
                this.burst(c.clone().add(new THREE.Vector3(0, 1, 0)), '#dff8ff', 28 * k, 5, 0.8, 0.28, { grav: 5 });
                this.ring(c.clone().setY(0.1), '#9fe8ff', 0.3, 2.8 * k, 0.6);
                this.pillar(c.clone(), '#bff0ff', 3.4 * k, 0.5, 0.6 * k);
                this.light(c.clone().add(new THREE.Vector3(0, 1.2, 0)), '#9fe8ff', 30, 0.6);
                break;
            case 'volt': {
                const top = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 9, (Math.random() - 0.5) * 2));
                this.bolt(top, c.clone().add(new THREE.Vector3(0, 0.3, 0)), '#fff6a0', 0.35);
                this.bolt(top.clone().add(new THREE.Vector3(0.4, 0, 0)), c.clone().add(new THREE.Vector3(0, 0.3, 0)), '#ffe14a', 0.3);
                this.burst(c.clone().add(new THREE.Vector3(0, 0.6, 0)), '#fff6a0', 18 * k, 5, 0.4, 0.2);
                this.ring(c.clone().setY(0.1), '#ffe14a', 0.3, 2.2 * k, 0.35);
                this.light(c.clone().add(new THREE.Vector3(0, 2, 0)), '#ffe86a', 70, 0.35);
                break;
            }
            case 'gale':
                for (let i = 0; i < 30 * k; i++) { const a = Math.random() * 6.283, r = 0.3 + Math.random() * 1.0; this.spawn(c.x + Math.cos(a) * r, c.y + Math.random() * 0.4, c.z + Math.sin(a) * r, -Math.sin(a) * 4, 1.5 + Math.random() * 3, Math.cos(a) * 4, '#bfffd0', 0.3, 0.7, { drag: 0.8 }); }
                this.ring(c.clone().setY(0.2), '#8dff9c', 0.4, 2.4 * k, 0.5);
                this.ring(c.clone().setY(1.2), '#cfffd8', 0.3, 1.8 * k, 0.4);
                this.light(c.clone().add(new THREE.Vector3(0, 1.2, 0)), '#8dff9c', 20, 0.4);
                break;
            case 'lumen':
                this.pillar(c.clone(), '#fff3a8', 10, 0.7, 0.8 * k);
                this.burst(c.clone().add(new THREE.Vector3(0, 1, 0)), '#fffbd0', 26 * k, 3.5, 0.9, 0.3, { grav: -0.6 });
                this.ring(c.clone().setY(0.1), '#fff3a8', 0.3, 3 * k, 0.6);
                this.light(c.clone().add(new THREE.Vector3(0, 2, 0)), '#fff3a8', 60, 0.7);
                break;
            case 'hex':
                for (let i = 0; i < 24 * k; i++) this.spawn(c.x + (Math.random() - 0.5) * 1.4, c.y + Math.random() * 2, c.z + (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, Math.random() < 0.5 ? '#d24bff' : '#4affd0', 0.35, 0.7, { drag: 1.5 });
                this.ring(c.clone().setY(1), '#d24bff', 0.2, 2.4 * k, 0.5, false);
                this.ring(c.clone().setY(0.1), '#ff4ad8', 0.3, 2.8 * k, 0.6);
                this.light(c.clone().add(new THREE.Vector3(0, 1.2, 0)), '#d24bff', 35, 0.5);
                break;
            default:
                this.burst(c.clone().add(new THREE.Vector3(0, 1, 0)), '#ffffff', 30 * k, 5, 0.6, 0.3);
                this.ring(c.clone().setY(0.1), '#ffffff', 0.3, 3 * k, 0.5);
                this.ring(c.clone().setY(1.1), '#cfe8ff', 0.2, 2.2 * k, 0.4, false);
                this.light(c.clone().add(new THREE.Vector3(0, 1.4, 0)), '#ffffff', 50, 0.5);
        }
    }

    heal(p) {
        for (let i = 0; i < 18; i++) this.spawn(p.x + (Math.random() - 0.5) * 1.2, p.y + 0.2, p.z + (Math.random() - 0.5) * 1.2, 0, 1.2 + Math.random() * 1.5, 0, i % 3 ? '#9dffb0' : '#fffbd0', 0.28, 0.9, { grav: -0.5 });
        this.ring(p.clone().setY(0.1), '#9dffb0', 0.3, 1.8, 0.6);
        this.light(p.clone().add(new THREE.Vector3(0, 1.2, 0)), '#9dffb0', 14, 0.6);
    }
    buff(p, up, color) {
        for (let i = 0; i < 14; i++) this.spawn(p.x + (Math.random() - 0.5) * 1.0, up ? 0.1 : 2.2, p.z + (Math.random() - 0.5) * 1.0, 0, up ? 2.2 : -2.2, 0, color, 0.25, 0.8);
        this.ring(p.clone().setY(up ? 0.1 : 2.2), color, 0.3, 1.5, 0.5);
    }
    recode(p) {
        for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; this.spawn(p.x + Math.cos(a) * 1.6, p.y + 0.3 + Math.random() * 1.6, p.z + Math.sin(a) * 1.6, -Math.cos(a) * 3, 0.5, -Math.sin(a) * 3, i % 2 ? '#9dffb0' : '#7affd0', 0.3, 0.8); }
        this.ring(p.clone().setY(0.1), '#7affd0', 2.5, 0.3, 0.8);
        this.pillar(p.clone(), '#9dffb0', 6, 0.9, 0.7);
        this.light(p.clone().add(new THREE.Vector3(0, 1.5, 0)), '#9dffb0', 60, 0.9);
    }
    death(p, color) {
        this.burst(p.clone().add(new THREE.Vector3(0, 1, 0)), color, 40, 5, 1.0, 0.35, { grav: 2 });
        this.ring(p.clone().setY(0.1), color, 0.3, 3, 0.7);
    }
}
