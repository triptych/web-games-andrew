// Effects: particles (sparks, foam, smoke, debris), flashes and shockwave rings, the projectiles, telegraph aim
// lines and laser lanes. Reads G; never changes it. Sim (x, y) is world (x, −y).

import * as THREE from 'three';

const MAXP = 2600;

function pointsMaterial(additive) {
    return new THREE.ShaderMaterial({
        uniforms: { scale: { value: 600 } },
        transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: /* glsl */`
            attribute float size;
            attribute vec4 rgba;
            uniform float scale;
            varying vec4 vC;
            void main() {
                vC = rgba;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * scale / max(1.0, -mv.z);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            varying vec4 vC;
            void main() {
                vec2 d = gl_PointCoord - 0.5;
                float r = length(d);
                if (r > 0.5) discard;
                // a hard-edged anime blob with a lighter core
                float core = step(r, 0.22);
                gl_FragColor = vec4(mix(vC.rgb, min(vec3(1.0), vC.rgb + 0.35), core), vC.a);
            }`,
    });
}

class Particles {
    constructor(scene, additive) {
        this.n = 0;
        this.p = new Float32Array(MAXP * 3);
        this.v = new Float32Array(MAXP * 3);
        this.life = new Float32Array(MAXP);
        this.max = new Float32Array(MAXP);
        this.size0 = new Float32Array(MAXP);
        this.grow = new Float32Array(MAXP);
        this.grav = new Float32Array(MAXP);
        this.col = new Float32Array(MAXP * 4);
        this.geo = new THREE.BufferGeometry();
        this.pos = new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3);
        this.sz = new THREE.BufferAttribute(new Float32Array(MAXP), 1);
        this.rgba = new THREE.BufferAttribute(new Float32Array(MAXP * 4), 4);
        for (const a of [this.pos, this.sz, this.rgba]) a.setUsage(THREE.DynamicDrawUsage);
        this.geo.setAttribute('position', this.pos);
        this.geo.setAttribute('size', this.sz);
        this.geo.setAttribute('rgba', this.rgba);
        this.mat = pointsMaterial(additive);
        this.points = new THREE.Points(this.geo, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 5 : 4;
        scene.add(this.points);
        this.c = new THREE.Color();
    }
    add(x, y, z, vx, vy, vz, life, size, color, { grow = 0, grav = 0, alpha = 1 } = {}) {
        if (this.n >= MAXP) return;
        const i = this.n++;
        this.p.set([x, y, z], i * 3);
        this.v.set([vx, vy, vz], i * 3);
        this.life[i] = this.max[i] = life;
        this.size0[i] = size; this.grow[i] = grow; this.grav[i] = grav;
        this.c.setHex(color);
        this.col.set([this.c.r, this.c.g, this.c.b, alpha], i * 4);
    }
    update(dt) {
        let j = 0;
        const P = this.pos.array, S = this.sz.array, C = this.rgba.array;
        for (let i = 0; i < this.n; i++) {
            this.life[i] -= dt;
            if (this.life[i] <= 0) continue;
            const k = i * 3;
            this.v[k + 1] -= this.grav[i] * dt;
            this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
            if (this.p[k + 1] < 0.02 && this.grav[i] > 0) { this.p[k + 1] = 0.02; this.v[k + 1] *= -0.2; this.v[k] *= 0.7; this.v[k + 2] *= 0.7; }
            if (j !== i) {
                this.p.copyWithin(j * 3, k, k + 3); this.v.copyWithin(j * 3, k, k + 3);
                this.life[j] = this.life[i]; this.max[j] = this.max[i]; this.size0[j] = this.size0[i];
                this.grow[j] = this.grow[i]; this.grav[j] = this.grav[i];
                this.col.copyWithin(j * 4, i * 4, i * 4 + 4);
            }
            const f = this.life[j] / this.max[j];
            P[j * 3] = this.p[j * 3]; P[j * 3 + 1] = this.p[j * 3 + 1]; P[j * 3 + 2] = this.p[j * 3 + 2];
            S[j] = this.size0[j] * (1 + this.grow[j] * (1 - f));
            C[j * 4] = this.col[j * 4]; C[j * 4 + 1] = this.col[j * 4 + 1]; C[j * 4 + 2] = this.col[j * 4 + 2];
            C[j * 4 + 3] = this.col[j * 4 + 3] * Math.min(1, f * 2.5);
            j++;
        }
        this.n = j;
        this.geo.setDrawRange(0, j);
        this.pos.needsUpdate = this.sz.needsUpdate = this.rgba.needsUpdate = true;
    }
}

/** A pool of meshes that grow and fade: flash balls, shockwave rings. */
class Pool {
    constructor(scene, geo, make) {
        this.scene = scene; this.geo = geo; this.make = make; this.items = [];
    }
    spawn(x, y, z, { from = 0.3, to = 4, life = 0.4, color = 0xffffff, flat = false, opacity = 1 } = {}) {
        let it = this.items.find((q) => !q.mesh.visible);
        if (!it) {
            const mesh = new THREE.Mesh(this.geo, this.make());
            this.scene.add(mesh);
            it = { mesh };
            this.items.push(it);
        }
        Object.assign(it, { t: 0, from, to, life, opacity });
        it.mesh.visible = true;
        it.mesh.position.set(x, y, z);
        it.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
        it.mesh.material.color.setHex(color);
        it.mesh.scale.setScalar(from);
        return it;
    }
    update(dt) {
        for (const it of this.items) {
            if (!it.mesh.visible) continue;
            it.t += dt;
            const f = it.t / it.life;
            if (f >= 1) { it.mesh.visible = false; continue; }
            const e = 1 - (1 - f) ** 3;
            it.mesh.scale.setScalar(it.from + (it.to - it.from) * e);
            it.mesh.material.opacity = it.opacity * (1 - f);
        }
    }
}

const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false, ...extra });

export class FX {
    constructor(scene) {
        this.scene = scene;
        this.glow = new Particles(scene, true);
        this.soft = new Particles(scene, false);
        this.flashes = new Pool(scene, new THREE.IcosahedronGeometry(1, 1), () => basic(0xffffff));
        this.rings = new Pool(scene, new THREE.RingGeometry(0.82, 1, 40), () => basic(0xffffff, { side: THREE.DoubleSide }));

        // projectiles
        const N = 700;
        this.ebOuter = new THREE.InstancedMesh(new THREE.SphereGeometry(0.62, 10, 8), basic(0xff3d8a), N);
        this.ebInner = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 8, 6), basic(0xffffff), N);
        this.shots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 1.6), basic(0xffe04a), 500);
        this.plasma = new THREE.InstancedMesh(new THREE.SphereGeometry(1.1, 12, 8), basic(0x7af7ff), 80);
        this.missiles = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 1.4, 8).rotateX(-Math.PI / 2), basic(0x9af0ff), 60);
        this.emissiles = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 1.8, 8).rotateX(-Math.PI / 2), basic(0xff5030), 60);
        for (const m of [this.ebOuter, this.ebInner, this.shots, this.plasma, this.missiles, this.emissiles]) {
            m.frustumCulled = false; m.count = 0; m.renderOrder = 6; scene.add(m);
        }
        this.ebColor = new THREE.Color();
        this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.S = new THREE.Vector3(); this.P = new THREE.Vector3(); this.E = new THREE.Euler();

        // telegraph aim lines and laser lanes
        this.lines = [];
        this.lineGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
        this.lanes = [];
        this.laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        this.beamGeo = new THREE.BoxGeometry(1, 1, 1);
        this.lineN = 0; this.laneN = 0;
        this.wakeT = 0;
    }

    // ------------------------------------------------------------------ one-shot effects
    explosion(x, y, z = 0.6, size = 1) {
        const X = x, Z = -y;
        this.flashes.spawn(X, z + 0.5, Z, { from: 0.4 * size, to: 3.4 * size, life: 0.32, color: 0xfff3b0 });
        this.flashes.spawn(X, z + 0.4, Z, { from: 0.3 * size, to: 2.4 * size, life: 0.5, color: 0xff7a1a, opacity: 0.9 });
        this.rings.spawn(X, 0.15, Z, { from: 0.5, to: 6 * size, life: 0.45, color: 0xffffff, flat: true });
        const n = Math.round(22 * size);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = (4 + Math.random() * 10) * size;
            this.glow.add(X, z + 0.5, Z, Math.cos(a) * s, 3 + Math.random() * 8 * size, Math.sin(a) * s, 0.35 + Math.random() * 0.4, 0.35 + Math.random() * 0.4, Math.random() < 0.5 ? 0xffd040 : 0xff6a20, { grav: 14 });
        }
        for (let i = 0; i < 8 * size; i++) {
            const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5;
            this.soft.add(X, z + 0.8, Z, Math.cos(a) * s, 1.5 + Math.random() * 2, Math.sin(a) * s, 0.6 + Math.random() * 0.5, 1.4 * size, Math.random() < 0.5 ? 0xe4e0ec : 0xbcb6c8, { grow: 1.6, alpha: 0.8 });
        }
        for (let i = 0; i < 6 * size; i++) {
            const a = Math.random() * Math.PI * 2;
            this.soft.add(X, 0.3, Z, Math.cos(a) * 4, 7 + Math.random() * 5, Math.sin(a) * 4, 0.9, 0.7, 0xffffff, { grav: 22 });
        }
    }
    spark(x, y, z = 0.8, color = 0xfff6a0, n = 5) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 6;
            this.glow.add(x, z, -y, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s, 0.18 + Math.random() * 0.15, 0.3, color, { grav: 10 });
        }
    }
    splash(x, y, big = 1) {
        for (let i = 0; i < 26 * big; i++) {
            const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5 * big;
            this.soft.add(x, 0.2, -y, Math.cos(a) * s, 4 + Math.random() * 6 * big, Math.sin(a) * s, 0.7 + Math.random() * 0.4, 0.55 + Math.random() * 0.4, 0xffffff, { grav: 20 });
        }
        this.rings.spawn(x, 0.12, -y, { from: 0.8, to: 5 * big, life: 0.6, color: 0xffffff, flat: true, opacity: 0.9 });
    }
    shockwave(x, y, radius) {
        this.rings.spawn(x, 0.2, -y, { from: 1, to: radius, life: 0.45, color: 0x9af6ff, flat: true });
        this.rings.spawn(x, 0.25, -y, { from: 0.6, to: radius * 0.75, life: 0.35, color: 0xffffff, flat: true });
    }
    pickup(x, y, color) {
        this.rings.spawn(x, 0.6, -y, { from: 0.5, to: 3, life: 0.35, color, flat: true });
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            this.glow.add(x, 0.8, -y, Math.cos(a) * 4, 3 + Math.random() * 3, Math.sin(a) * 4, 0.4, 0.3, color, { grav: 6 });
        }
    }
    cancel(x, y) { this.glow.add(x, 0.6, -y, 0, 2.5, 0, 0.5, 0.45, 0xffe680, {}); }

    /** Foam behind the boat, spray from its sides; heavier at speed. */
    wake(b, dt, airborne) {
        if (airborne) return;
        this.wakeT += dt * (b.speed / 16) * 60;
        while (this.wakeT > 1) {
            this.wakeT -= 1;
            const s = (Math.random() - 0.5) * 1.2;
            this.soft.add(b.x + s, 0.08, -(b.y - 2.2), s * 2.5, 0, b.speed * 0.6, 1.1 + Math.random() * 0.5, 0.7, 0xffffff, { grow: 1.6, alpha: 0.9 });
            if (Math.random() < 0.5) {
                const side = Math.random() < 0.5 ? -1 : 1;
                this.soft.add(b.x + side * 0.9, 0.3, -(b.y - 0.6), side * (3 + Math.random() * 2), 2.5 + Math.random() * 2, b.speed * 0.3, 0.45, 0.35, 0xe8fdff, { grav: 16 });
            }
        }
    }

    // ------------------------------------------------------------------ every frame from G
    frame(G, dt, time) {
        this.glow.update(dt);
        this.soft.update(dt);
        this.flashes.update(dt);
        this.rings.update(dt);
        const { M, Q, S, P, E } = this;
        // enemy bullets: pink orbs (shells orange), pulsing
        let n = 0;
        const pulse = 1 + Math.sin(time * 18) * 0.12;
        let nm = 0;
        for (const q of G.bullets) {
            if (q.kind === 'missile') {
                E.set(0, Math.atan2(q.vx, q.vy) + Math.PI, 0);
                Q.setFromEuler(E); P.set(q.x, 0.8, -q.y); S.set(1, 1, 1);
                M.compose(P, Q, S); this.emissiles.setMatrixAt(nm++, M);
                if (Math.random() < 0.5) this.soft.add(q.x, 0.8, -q.y, 0, 0.6, 0, 0.5, 0.6, 0x9a9aa6, { grow: 1.5, alpha: 0.7 });
                continue;
            }
            if (n >= 700) break;
            const s = (q.kind === 'shell' ? 1.15 : 1) * pulse;
            Q.identity(); P.set(q.x, 0.75, -q.y); S.set(s, s, s);
            M.compose(P, Q, S);
            this.ebOuter.setMatrixAt(n, M);
            this.ebOuter.setColorAt(n, this.ebColor.setHex(q.kind === 'shell' ? 0xff8a1a : 0xff3d8a));
            this.ebInner.setMatrixAt(n, M);
            n++;
        }
        this.ebOuter.count = this.ebInner.count = n;
        this.emissiles.count = nm;
        this.ebOuter.instanceMatrix.needsUpdate = this.ebInner.instanceMatrix.needsUpdate = this.emissiles.instanceMatrix.needsUpdate = true;
        if (this.ebOuter.instanceColor) this.ebOuter.instanceColor.needsUpdate = true;

        // the player's shots
        let ns = 0, np = 0, nmi = 0;
        for (const s of G.shots) {
            const ang = Math.atan2(s.vx, s.vy);
            E.set(0, -ang, 0); Q.setFromEuler(E);
            P.set(s.x, s.kind === 'missile' ? 1.1 : 0.9, -s.y);
            if (s.kind === 'plasma') { S.set(1, 1, 1.6); M.compose(P, Q, S); this.plasma.setMatrixAt(np++, M); }
            else if (s.kind === 'missile') {
                E.set(0, Math.atan2(s.vx, s.vy) + Math.PI, 0); Q.setFromEuler(E); S.set(1, 1, 1);
                M.compose(P, Q, S); this.missiles.setMatrixAt(nmi++, M);
                this.soft.add(s.x, 1.1, -s.y, 0, 0.4, 0, 0.55, 0.5, 0xeef4ff, { grow: 2, alpha: 0.75 });
            } else if (ns < 500) { S.set(1, 1, 1); M.compose(P, Q, S); this.shots.setMatrixAt(ns++, M); }
        }
        this.shots.count = ns; this.plasma.count = np; this.missiles.count = nmi;
        this.shots.instanceMatrix.needsUpdate = this.plasma.instanceMatrix.needsUpdate = this.missiles.instanceMatrix.needsUpdate = true;
    }

    /** Aim lines: call begin, then line() for each telegraphing gun, then end. */
    beginLines() { this.lineN = 0; this.laneN = 0; }
    line(x, y, ang, len, color, width, alpha) {
        let m = this.lines[this.lineN];
        if (!m) { m = new THREE.Mesh(this.lineGeo, basic(color)); m.renderOrder = 3; this.scene.add(m); this.lines.push(m); }
        this.lineN++;
        m.visible = true;
        m.material.color.setHex(color);
        m.material.opacity = alpha;
        m.position.set(x, 0.35, -y);
        // sim angle a points (cos a, sin a) in (x, y) → world direction (cos a, 0, −sin a)
        m.rotation.set(0, Math.atan2(-Math.cos(ang), Math.sin(ang)), 0);
        m.scale.set(width, 1, len);
    }
    lane(x, y0, y1, w, live, alpha, time) {
        let L = this.lanes[this.laneN];
        if (!L) {
            const floor = new THREE.Mesh(this.laneGeo, basic(0xff2050));
            const beam = new THREE.Mesh(this.beamGeo, basic(0xffffff));
            const glow = new THREE.Mesh(this.beamGeo, basic(0x6ff6ff));
            floor.renderOrder = 2; beam.renderOrder = glow.renderOrder = 7;
            this.scene.add(floor, beam, glow);
            L = { floor, beam, glow };
            this.lanes.push(L);
        }
        this.laneN++;
        const len = y0 - y1, mid = (y0 + y1) / 2;
        L.floor.visible = true;
        L.floor.position.set(x, 0.3, -mid);
        L.floor.scale.set(w, 1, len);
        L.floor.material.color.setHex(live ? 0xffffff : 0xff2050);
        L.floor.material.opacity = live ? 0.55 : alpha * (0.35 + 0.3 * Math.abs(Math.sin(time * 14)));
        L.beam.visible = L.glow.visible = live;
        if (live) {
            L.beam.position.set(x, 1.2, -mid); L.beam.scale.set(w * 0.45, 1.6, len);
            L.glow.position.set(x, 1.2, -mid); L.glow.scale.set(w * (0.95 + Math.sin(time * 40) * 0.08), 2.4, len);
            L.glow.material.opacity = 0.55;
        }
    }
    endLines() {
        for (let i = this.lineN; i < this.lines.length; i++) this.lines[i].visible = false;
        for (let i = this.laneN; i < this.lanes.length; i++) { const L = this.lanes[i]; L.floor.visible = L.beam.visible = L.glow.visible = false; }
    }
}
