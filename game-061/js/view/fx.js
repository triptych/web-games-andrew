// Effects: a pooled additive particle system, instanced bolts and loot, explosions with
// shockwave rings, the mining beam, space dust/speed lines, the shield bubble and the warp tunnel.

import * as THREE from 'three';
import { glowTexture } from './renderer.js';
import { ITEMS } from '../config.js';

const LOG_V = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOG_VM = '\n#include <logdepthbuf_vertex>\n';
const LOG_F = '#include <logdepthbuf_pars_fragment>\n';
const LOG_FM = '\n#include <logdepthbuf_fragment>\n';

export class Particles {
    constructor(scene, max = 3000) {
        this.max = max;
        this.n = 0;
        this.pos = new Float32Array(max * 3);
        this.vel = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.size = new Float32Array(max);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.drag = new Float32Array(max);
        this.grow = new Float32Array(max);
        this.alpha = new Float32Array(max);
        this.target = new Array(max).fill(null); // homing particles (ore streams)
        const g = new THREE.BufferGeometry();
        this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
        this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
        this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
        this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.aPos);
        g.setAttribute('color', this.aCol);
        g.setAttribute('size', this.aSize);
        g.setAttribute('alpha', this.aAlpha);
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uMap: { value: glowTexture() }, uScale: { value: 600 } },
            vertexShader: `${LOG_V}
                attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
                void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * uScale / -mv.z, 0.0, 256.0); gl_Position = projectionMatrix * mv; ${LOG_VM} }`,
            fragmentShader: `${LOG_F}
                uniform sampler2D uMap; varying vec3 vC; varying float vA;
                void main(){ ${LOG_FM} vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.a * vA, 1.0); }`,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        scene.add(this.points);
        this.budget = 1;
    }
    emit(p, v, color, size, life, opts = {}) {
        if (this.n >= this.max) return;
        const i = this.n++;
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
        const c = color.isColor ? color : new THREE.Color(color);
        this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
        this.size[i] = size;
        this.life[i] = life; this.maxLife[i] = life;
        this.drag[i] = opts.drag ?? 0.5;
        this.grow[i] = opts.grow ?? 0;
        this.alpha[i] = 1;
        this.target[i] = opts.target || null;
    }
    burst(p, n, speed, color, size, life, opts = {}) {
        n = Math.max(1, Math.round(n * this.budget));
        for (let k = 0; k < n; k++) {
            const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
            if (opts.base) d.add(opts.base);
            this.emit(p, d, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), opts);
        }
    }
    update(dt) {
        let i = 0;
        while (i < this.n) {
            this.life[i] -= dt;
            if (this.life[i] <= 0) { this.kill(i); continue; }
            const k = Math.max(0, 1 - this.drag[i] * dt);
            const tg = this.target[i];
            if (tg) {
                // Home in on a moving target (the ship); die on arrival.
                const dx = tg.x - this.pos[i * 3], dy = tg.y - this.pos[i * 3 + 1], dz = tg.z - this.pos[i * 3 + 2];
                const d = Math.hypot(dx, dy, dz) || 1;
                if (d < 4) { this.kill(i); continue; }
                const s = 260;
                this.vel[i * 3] += (dx / d * s - this.vel[i * 3]) * Math.min(1, dt * 5);
                this.vel[i * 3 + 1] += (dy / d * s - this.vel[i * 3 + 1]) * Math.min(1, dt * 5);
                this.vel[i * 3 + 2] += (dz / d * s - this.vel[i * 3 + 2]) * Math.min(1, dt * 5);
            } else {
                this.vel[i * 3] *= k; this.vel[i * 3 + 1] *= k; this.vel[i * 3 + 2] *= k;
            }
            this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            this.size[i] += this.grow[i] * dt;
            const t = this.life[i] / this.maxLife[i];
            this.alpha[i] = Math.min(1, t * 2.5);
            i++;
        }
        this.points.geometry.setDrawRange(0, this.n);
        this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
    }
    kill(i) {
        const j = --this.n;
        if (i !== j) {
            for (let a = 0; a < 3; a++) { this.pos[i * 3 + a] = this.pos[j * 3 + a]; this.vel[i * 3 + a] = this.vel[j * 3 + a]; this.col[i * 3 + a] = this.col[j * 3 + a]; }
            this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.drag[i] = this.drag[j]; this.grow[i] = this.grow[j]; this.alpha[i] = this.alpha[j]; this.target[i] = this.target[j];
        }
        this.target[j] = null;
    }
    clear() { this.n = 0; this.target.fill(null); }
}

export class FX {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.parts = new Particles(scene, 4000);
        // Bolts
        const bg = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1);
        bg.rotateX(Math.PI / 2);
        this.boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.bolts = new THREE.InstancedMesh(bg, this.boltMat, 400);
        this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.bolts.frustumCulled = false;
        this.bolts.setColorAt(0, new THREE.Color());
        scene.add(this.bolts);
        // Loot canisters
        const lg = new THREE.BoxGeometry(4, 4, 6);
        this.lootMesh = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: '#c8b070', metalness: 0.7, roughness: 0.3, emissive: new THREE.Color('#6bffb0'), emissiveIntensity: 0.6 }), 120);
        this.lootMesh.frustumCulled = false;
        scene.add(this.lootMesh);
        // Mining beam
        const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
        beamGeo.translate(0, 0.5, 0);
        beamGeo.rotateX(Math.PI / 2);
        this.beamMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color('#ffb36b') }, uHeat: { value: 0 } },
            vertexShader: `${LOG_V} varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); ${LOG_VM} }`,
            fragmentShader: `${LOG_F} uniform float uTime, uHeat; uniform vec3 uCol; varying vec2 vUv;
                void main(){ ${LOG_FM}
                    float edge = pow(1.0 - abs(vUv.x * 2.0 - 1.0), 0.5);
                    float pulse = 0.6 + 0.4 * sin(vUv.y * 60.0 - uTime * 40.0);
                    vec3 c = mix(uCol, vec3(1.0, 0.3, 0.2), uHeat) * (1.5 + pulse);
                    gl_FragColor = vec4(c * edge, 1.0);
                }`,
        });
        this.beam = new THREE.Mesh(beamGeo, this.beamMat);
        this.beam.visible = false;
        this.beam.frustumCulled = false;
        scene.add(this.beam);
        this.beamCore = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.beamCore.visible = false;
        scene.add(this.beamCore);
        this.beamHit = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(3, 2, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        this.beamHit.visible = false;
        scene.add(this.beamHit);
        // Tractor/scan beam (thin line)
        this.scanLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.8, 2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
        this.scanLine.visible = false;
        this.scanLine.frustumCulled = false;
        scene.add(this.scanLine);
        // Shockwave rings pool
        this.rings = [];
        // Shield bubble
        this.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uHit: { value: new THREE.Vector3(0, 0, 1) }, uT: { value: 0 }, uCol: { value: new THREE.Color('#5ef0ff') } },
            vertexShader: `${LOG_V} varying vec3 vN; varying vec3 vL; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vL = normalize(position); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; ${LOG_VM} }`,
            fragmentShader: `${LOG_F} uniform vec3 uHit, uCol; uniform float uT; varying vec3 vN; varying vec3 vL; varying vec3 vV;
                void main(){ ${LOG_FM}
                    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
                    float spot = smoothstep(0.4, 1.0, dot(vL, normalize(uHit)));
                    float hex = 0.6 + 0.4 * sin(vL.x * 40.0) * sin(vL.y * 40.0) * sin(vL.z * 40.0);
                    float a = (fres * 0.6 + spot * 1.4) * uT * hex;
                    gl_FragColor = vec4(uCol * a, 1.0);
                }`,
        }));
        this.shield.visible = false;
        scene.add(this.shield);
        this.shieldT = 0;
        // Space dust & speed lines around the camera.
        const DN = 500;
        this.dustN = DN;
        this.dustPos = new Float32Array(DN * 6);
        this.dustBase = new Float32Array(DN * 3);
        for (let i = 0; i < DN; i++) { this.dustBase[i * 3] = (Math.random() - 0.5) * 400; this.dustBase[i * 3 + 1] = (Math.random() - 0.5) * 400; this.dustBase[i * 3 + 2] = (Math.random() - 0.5) * 400; }
        const dg = new THREE.BufferGeometry();
        this.aDust = new THREE.BufferAttribute(this.dustPos, 3).setUsage(THREE.DynamicDrawUsage);
        dg.setAttribute('position', this.aDust);
        this.dust = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.65, 0.8), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.dust.frustumCulled = false;
        scene.add(this.dust);
        // Warp tunnel
        const tg = new THREE.CylinderGeometry(30, 30, 2000, 32, 1, true);
        tg.rotateX(Math.PI / 2);
        this.tunnelMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
            uniforms: { uT: { value: 0 }, uK: { value: 0 }, uCol: { value: new THREE.Color('#7aa8ff') } },
            vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
            fragmentShader: `uniform float uT, uK; uniform vec3 uCol; varying vec2 vUv;
                float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
                void main(){
                    float a = vUv.x * 64.0; float id = floor(a);
                    float streak = step(0.82, h(vec2(id, 1.0))) * fract(vUv.y * (3.0 + h(vec2(id, 2.0)) * 4.0) - uT * (2.0 + h(vec2(id,3.0)) * 3.0));
                    streak = pow(streak, 6.0);
                    float glow = 0.15 + 0.1 * sin(vUv.y * 40.0 - uT * 30.0);
                    vec3 c = uCol * (streak * 4.0 + glow) + vec3(1.0, 0.8, 1.0) * streak * 2.0;
                    gl_FragColor = vec4(c * uK, 1.0);
                }`,
        });
        this.tunnel = new THREE.Mesh(tg, this.tunnelMat);
        this.tunnel.visible = false;
        this.tunnel.frustumCulled = false;
        this.tunnel.renderOrder = 50;
        scene.add(this.tunnel);
        this.flashLight = new THREE.PointLight(0xffaa66, 0, 1200, 1.6);
        scene.add(this.flashLight);
        this.flashT = 0;
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._z = new THREE.Vector3(0, 0, 1);
    }

    setBudget(b) { this.parts.budget = b; }
    clear() {
        this.parts.clear();
        for (const r of this.rings) { this.scene.remove(r); r.geometry.dispose(); r.material.dispose(); }
        this.rings = [];
        this.beam.visible = this.beamCore.visible = this.beamHit.visible = false;
    }

    explosion(pos, size = 1, color = '#ffa040') {
        const p = this.parts;
        const c = new THREE.Color(color);
        p.burst(pos, 26 * size, 90 * size, c.clone().multiplyScalar(2.2), 14 * size, 0.9, { drag: 1.6, grow: 18 * size });
        p.burst(pos, 18 * size, 40 * size, new THREE.Color(2.5, 2.2, 1.6), 22 * size, 0.35, { drag: 3, grow: 40 * size });
        p.burst(pos, 40 * size, 220 * size, new THREE.Color(2, 1.2, 0.5), 2.5, 1.2, { drag: 0.6 });
        p.burst(pos, 12 * size, 30 * size, new THREE.Color(0.35, 0.25, 0.3), 26 * size, 2.2, { drag: 0.8, grow: 10 * size });
        this.ring(pos, size, c);
        this.flashLight.position.set(pos.x, pos.y, pos.z);
        this.flashLight.intensity = 60 * size;
        this.flashLight.distance = 500 * size;
        this.flashT = 0.35;
    }
    ring(pos, size, color) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.position.set(pos.x, pos.y, pos.z);
        m.lookAt(this.camera.position);
        m.rotateX((Math.random() - 0.5) * 1.2);
        m.userData = { t: 0, life: 0.8, size: 60 * size };
        this.scene.add(m);
        this.rings.push(m);
    }
    sparks(pos, color = '#ffd27a', n = 8, speed = 80) { this.parts.burst(pos, n, speed, new THREE.Color(color).multiplyScalar(2), 2.4, 0.5, { drag: 2 }); }
    hit(pos, shield) { this.sparks(pos, shield ? '#5ef0ff' : '#ffb36b', 10, 70); }
    oreStream(from, target, res) {
        const c = new THREE.Color(ITEMS[res]?.color || '#fff').multiplyScalar(1.8);
        for (let i = 0; i < 2; i++) {
            const v = new THREE.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60);
            this.parts.emit({ x: from.x + v.x * 0.1, y: from.y + v.y * 0.1, z: from.z + v.z * 0.1 }, v, c, 3.5, 3, { target });
        }
    }
    rockBreak(pos, radius, color) {
        const c = new THREE.Color(color);
        this.parts.burst(pos, 30, radius * 4, c.clone().multiplyScalar(0.9), radius * 0.5, 1.6, { drag: 0.7 });
        this.parts.burst(pos, 14, radius * 2, new THREE.Color(1.5, 1.3, 1.0), radius * 0.8, 0.6, { drag: 2, grow: radius });
        this.ring(pos, radius / 40, c);
    }
    shieldHit(dirLocal) { this.shieldT = 1; this.shield.material.uniforms.uHit.value.copy(dirLocal); }

    // Per-frame sync of world-driven effects.
    update(dt, t, world, view) {
        this.parts.update(dt);
        // rings
        for (const r of this.rings) {
            r.userData.t += dt;
            const k = r.userData.t / r.userData.life;
            r.scale.setScalar(1 + k * r.userData.size);
            r.material.opacity = 0.9 * (1 - k);
        }
        this.rings = this.rings.filter((r) => { if (r.userData.t < r.userData.life) return true; this.scene.remove(r); r.geometry.dispose(); r.material.dispose(); return false; });
        if (this.flashT > 0) { this.flashT -= dt; this.flashLight.intensity *= Math.max(0, 1 - dt * 8); } else this.flashLight.intensity = 0;
        if (!world) { this.bolts.count = 0; this.lootMesh.count = 0; return; }
        // bolts
        let i = 0;
        for (const b of world.bolts) {
            if (i >= 400) break;
            this._v.set(b.vel.x, b.vel.y, b.vel.z).normalize();
            this._q.setFromUnitVectors(this._z, this._v);
            const len = b.plasma ? 22 : b.owner === 'player' ? 16 : 12;
            const w = (b.plasma ? 2.6 : 1.2) * (b.size || 1) * (b.owner === 'enemy' ? 1.3 : 1);
            this._s.set(w, w, len);
            this._m.compose(this._v.set(b.pos.x, b.pos.y, b.pos.z), this._q, this._s);
            this.bolts.setMatrixAt(i, this._m);
            const col = b.owner === 'player' ? (b.plasma ? [1.2, 2.5, 3] : [0.6, 2.4, 3]) : b.faction === 'swarm' ? [1.6, 3, 0.6] : b.faction === 'warden' ? [2.4, 1, 3] : [3, 0.9, 0.5];
            this.bolts.setColorAt(i, this._c.setRGB(col[0], col[1], col[2]));
            i++;
        }
        this.bolts.count = i;
        this.bolts.instanceMatrix.needsUpdate = true;
        if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;
        // loot
        let li = 0;
        for (const l of world.loot) {
            if (li >= 120) break;
            this._q.setFromAxisAngle(this._v.set(0.3, 1, 0.2).normalize(), t * l.spin);
            this._m.compose(this._v.set(l.pos.x, l.pos.y, l.pos.z), this._q, this._s.setScalar(l.special ? 2 : 1));
            this.lootMesh.setMatrixAt(li++, this._m);
        }
        this.lootMesh.count = li;
        this.lootMesh.instanceMatrix.needsUpdate = true;

        // mining beam
        const p = world.player;
        const rock = p.mining ? world.rockById(p.mining) : null;
        const shipObj = view.playerShip;
        if (rock && shipObj && !world.docked) {
            const from = this._v.set(0, -0.5, (shipObj.userData.length || 14) * 0.45).applyMatrix4(shipObj.matrixWorld).clone();
            const to = new THREE.Vector3(rock.pos.x, rock.pos.y, rock.pos.z);
            const dir = to.clone().sub(from);
            const dist = dir.length();
            dir.normalize();
            const surf = from.clone().addScaledVector(dir, Math.max(1, dist - rock.radius * (0.55 + 0.45 * rock.ore / rock.maxOre) * 0.85));
            const L = from.distanceTo(surf);
            for (const bm of [this.beam, this.beamCore]) {
                bm.visible = true;
                bm.position.copy(from);
                bm.quaternion.setFromUnitVectors(this._z, dir);
            }
            this.beam.scale.set(1.6 + Math.sin(t * 50) * 0.3, 1.6, L);
            this.beamCore.scale.set(0.45, 0.45, L);
            this.beamMat.uniforms.uTime.value = t;
            this.beamMat.uniforms.uHeat.value = p.heat / 100;
            this.beamHit.visible = true;
            this.beamHit.position.copy(surf);
            this.beamHit.scale.setScalar(14 + Math.sin(t * 37) * 4);
            if (Math.random() < 0.6) this.parts.emit(surf, { x: (Math.random() - 0.5) * 90, y: (Math.random() - 0.5) * 90, z: (Math.random() - 0.5) * 90 }, new THREE.Color(2.4, 1.6, 0.8), 2, 0.4, { drag: 2 });
        } else { this.beam.visible = this.beamCore.visible = this.beamHit.visible = false; }

        // scan line to the current hold target
        if (world.ctx && world.hold.t > 0 && world.ctx.hold > 0 && shipObj) {
            const o = world.ctx.o || world.findNav(world.ctx.id);
            if (o) {
                const a = shipObj.position, b = o.pos;
                const arr = this.scanLine.geometry.attributes.position.array;
                arr[0] = a.x; arr[1] = a.y; arr[2] = a.z; arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
                this.scanLine.geometry.attributes.position.needsUpdate = true;
                this.scanLine.visible = true;
                this.scanLine.material.opacity = 0.4 + 0.4 * Math.sin(t * 20);
            }
        } else this.scanLine.visible = false;

        // shield bubble
        if (shipObj) {
            this.shieldT = Math.max(0, this.shieldT - dt * 2.5);
            this.shield.visible = this.shieldT > 0.01;
            this.shield.position.copy(shipObj.position);
            this.shield.quaternion.copy(shipObj.quaternion);
            this.shield.scale.setScalar((shipObj.userData.radius || 10) * 1.25);
            this.shield.material.uniforms.uT.value = this.shieldT;
        }

        // dust & speed lines (relative to the camera, wrapped in a 400-unit box)
        const cam = this.camera.position;
        const v = p.vel;
        const cruise = p.cruise.state === 'on';
        const stretch = cruise ? 0.05 : 0.08;
        const B = 400;
        for (let k = 0; k < this.dustN; k++) {
            let x = this.dustBase[k * 3], y = this.dustBase[k * 3 + 1], z = this.dustBase[k * 3 + 2];
            x = ((x - cam.x) % B + B * 1.5) % B - B / 2 + cam.x;
            y = ((y - cam.y) % B + B * 1.5) % B - B / 2 + cam.y;
            z = ((z - cam.z) % B + B * 1.5) % B - B / 2 + cam.z;
            const sx = Math.max(-80, Math.min(80, v.x * stretch)), sy = Math.max(-80, Math.min(80, v.y * stretch)), sz = Math.max(-80, Math.min(80, v.z * stretch));
            this.dustPos.set([x, y, z, x - sx - 0.3, y - sy - 0.3, z - sz], k * 6);
        }
        this.aDust.needsUpdate = true;
        this.dust.material.opacity = Math.min(0.75, 0.15 + p.speed / 400);
    }

    warpTunnel(k, t) {
        this.tunnel.visible = k > 0.01;
        if (!this.tunnel.visible) return;
        this.tunnel.position.copy(this.camera.position);
        this.tunnel.quaternion.copy(this.camera.quaternion);
        this.tunnelMat.uniforms.uK.value = k;
        this.tunnelMat.uniforms.uT.value = t;
    }
}
