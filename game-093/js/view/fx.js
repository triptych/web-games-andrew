// Particles and spell effects. One instanced quad batch draws every spark, flame, shard and glow (shapes are signed-distance
// functions in the shader, so there are no textures); a few mesh effects (slash arcs, light columns, lightning, rings) add
// the big shapes. Each spell is a short script of emitters on a timer.

import * as THREE from 'three';

export const SHAPE = { orb: 0, spark: 1, ring: 2, smoke: 3, flame: 4, shard: 5, streak: 6, plus: 7, leaf: 8, dot: 9, bubble: 10, star: 11, note: 12 };

const VS = `attribute vec3 aPos; attribute vec2 aScale; attribute float aRot; attribute vec4 aCol; attribute float aShape;
varying vec2 vUv; varying vec4 vCol; varying float vShape;
void main(){
  vUv = position.xy * 2.0;
  float c = cos(aRot), s = sin(aRot);
  vec2 p = position.xy * aScale;
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
  vCol = aCol; vShape = aShape;
}`;
const FS = `precision highp float;
varying vec2 vUv; varying vec4 vCol; varying float vShape; uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv; float d = length(uv);
  vec3 col = vCol.rgb; float a = vCol.a;
  vec3 rgb = vec3(0.0); float cover = 0.0;
  int s = int(vShape + 0.5);
  if (s == 0) { float g = exp(-d * d * 3.8); rgb = col * g * a; }
  else if (s == 1) { float st = max(0.0, 1.0 - abs(uv.x * uv.y) * 12.0 - d * 0.85); rgb = (col + 0.45) * st * a + col * exp(-d * d * 7.0) * 0.6 * a; }
  else if (s == 2) { float r = exp(-pow((d - 0.8) * 8.0, 2.0)); rgb = col * r * a; }
  else if (s == 3) { float n = h(floor(uv * 3.0 + vCol.a * 9.0)); float m = smoothstep(1.0, 0.25, d + n * 0.18); cover = m * a * 0.8; rgb = col * cover; }
  else if (s == 4) { vec2 q = uv; q.y += 0.25; float f = length(vec2(q.x * (1.2 + q.y * 0.6), q.y * 0.8)); float n = h(floor(vec2(uv.x * 4.0, uv.y * 4.0 - uTime * 18.0))); float m = smoothstep(1.0, 0.25, f + n * 0.25); vec3 c = mix(col, vec3(1.0, 0.95, 0.7), smoothstep(0.6, 0.0, f)); rgb = c * m * a; }
  else if (s == 5) { float dm = abs(uv.x) * 1.6 + abs(uv.y) * 0.8; float m = smoothstep(1.0, 0.8, dm); float core = smoothstep(0.55, 0.0, dm); rgb = (col * m + vec3(1.0) * core * 0.6) * a; cover = m * a * 0.5; rgb = mix(rgb, col * 0.6, cover * 0.3); }
  else if (s == 6) { float y = abs(uv.y), x = abs(uv.x); float ends = smoothstep(1.0, 0.6, x); rgb = (col * exp(-y * y * 3.0) + vec3(1.0) * exp(-y * y * 30.0)) * ends * a; }
  else if (s == 7) { float arm = min(abs(uv.x), abs(uv.y)); float len = max(abs(uv.x), abs(uv.y)); float m = smoothstep(0.28, 0.12, arm) * smoothstep(1.0, 0.7, len); rgb = (col * m + vec3(1.0) * m * 0.4) * a; }
  else if (s == 8) { vec2 q = vec2(uv.x * 1.7, uv.y); float m = smoothstep(1.0, 0.7, length(q)); rgb = col * m * a; cover = m * a * 0.9; }
  else if (s == 9) { float m = smoothstep(1.0, 0.6, d); rgb = col * m * a; cover = m * a * 0.7; }
  else if (s == 10) { float r = smoothstep(0.12, 0.0, abs(d - 0.8)); float hl = smoothstep(0.25, 0.0, length(uv - vec2(-0.35, 0.35))); rgb = (col * r + vec3(1.0) * hl * 0.8) * a; }
  else if (s == 11) { float ang = atan(uv.y, uv.x); float k = 0.45 + 0.55 * abs(cos(ang * 2.5)); float m = smoothstep(k, k - 0.15, d); rgb = (col * m + vec3(1.0) * smoothstep(0.35, 0.0, d)) * a; }
  else { float m = smoothstep(1.0, 0.7, d); rgb = col * m * a; cover = m * a; }
  gl_FragColor = vec4(rgb, cover);
}`;

const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));   // visual only: never touches the sim's seed
const TAU = Math.PI * 2;

export class Particles {
    constructor(max = 5000) {
        this.max = max; this.list = [];
        const quad = new THREE.PlaneGeometry(1, 1);
        const g = new THREE.InstancedBufferGeometry();
        g.index = quad.index; g.setAttribute('position', quad.attributes.position);
        const mk = (k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * k), k); a.setUsage(THREE.DynamicDrawUsage); return a; };
        this.aPos = mk(3); this.aScale = mk(2); this.aRot = mk(1); this.aCol = mk(4); this.aShape = mk(1);
        g.setAttribute('aPos', this.aPos); g.setAttribute('aScale', this.aScale); g.setAttribute('aRot', this.aRot); g.setAttribute('aCol', this.aCol); g.setAttribute('aShape', this.aShape);
        g.instanceCount = 0; this.geo = g;
        this.uniforms = { uTime: { value: 0 } };
        const mat = new THREE.ShaderMaterial({
            vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: true,
            blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        });
        this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
    }
    /** p: { x,y,z, vx,vy,vz, life, size, size1, r,g,b, a, shape, grav, drag, spin, rot, fade } */
    add(p) {
        if (this.list.length >= this.max) return;
        p.t = 0; p.life = p.life || 0.6; p.size1 = p.size1 ?? p.size; p.a = p.a ?? 1; p.rot = p.rot || 0; p.spin = p.spin || 0; p.grav = p.grav || 0; p.drag = p.drag || 0;
        p.vx = p.vx || 0; p.vy = p.vy || 0; p.vz = p.vz || 0; p.stretch = p.stretch || 0; p.delay = p.delay || 0;
        this.list.push(p);
    }
    update(dt, time) {
        const L = this.list; let n = 0;
        for (let i = 0; i < L.length; i++) {
            const p = L[i];
            if (p.delay > 0) { p.delay -= dt; L[n++] = p; continue; }
            p.t += dt;
            if (p.t >= p.life) continue;
            const k = Math.exp(-p.drag * dt);
            p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
            L[n++] = p;
        }
        L.length = n;
        let c = 0;
        for (const p of L) {
            if (p.delay > 0) continue;
            const u = p.t / p.life;
            let a = p.a * (p.fade === 'in' ? Math.min(1, u * 5) : p.fade === 'inout' ? Math.min(1, u * 6) * (1 - u) : p.fade === 'none' ? 1 : 1 - u * u);
            const s = p.size + (p.size1 - p.size) * u;
            const i = c++;
            this.aPos.array[i * 3] = p.x; this.aPos.array[i * 3 + 1] = p.y; this.aPos.array[i * 3 + 2] = p.z;
            this.aScale.array[i * 2] = s * (p.shape === SHAPE.streak ? 2.5 : 1); this.aScale.array[i * 2 + 1] = s;
            this.aRot.array[i] = p.stretch ? Math.atan2(p.vy, p.vx) + p.rot : p.rot;
            this.aCol.array[i * 4] = p.r; this.aCol.array[i * 4 + 1] = p.g; this.aCol.array[i * 4 + 2] = p.b; this.aCol.array[i * 4 + 3] = a;
            this.aShape.array[i] = p.shape;
        }
        this.geo.instanceCount = c;
        for (const a of [this.aPos, this.aScale, this.aRot, this.aCol, this.aShape]) { a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, c * a.itemSize); }
        this.uniforms.uTime.value = time;
    }
    clear() { this.list.length = 0; }
}

const col = (hex) => { const c = new THREE.Color(hex); return [c.r * 1.0, c.g * 1.0, c.b * 1.0]; };
const ELEM = {
    fire: 0xff7a30, ice: 0x9fe8ff, thunder: 0xffe84a, wind: 0x7fe8b4, holy: 0xfff2b0, dark: 0xb070ff, heal: 0x7fffb0, buff: 0xffd36a, debuff: 0xb070d0, slash: 0xffffff, arrow: 0xd8f0c0,
    quake: 0xd8b070, poison: 0x9be15d, sleep: 0x8fb0ff, claw: 0xffd0d0, impact: 0xffe0b0, thrust: 0xc8e0ff, spin: 0xffffff, sun: 0xfff0a0, meteor: 0xff6a20, star: 0xfff2b0, prism: 0xffffff, gravity: 0x9060ff, rift: 0xc070ff, grace: 0xfff8d0, scan: 0x7fffe0, guard: 0x9fd0ff, zap: 0xd8e0ff, cast: 0xd8e0ff,
};
export const elemColor = (k) => ELEM[k] ?? 0xffffff;

// ---------------------------------------------------------------- mesh effects
const arcGeo = (() => { const g = new THREE.RingGeometry(0.55, 1, 28, 1, 0, Math.PI * 0.85); return g; })();
const arcMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uP: { value: 0 }, uCol: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uP; uniform vec3 uCol; varying vec2 vP;
void main(){ float ang = atan(vP.y, vP.x); float t = ang / 2.6; float head = uP * 1.2 - 0.1; float tail = smoothstep(head - 0.55, head, t) * step(t, head + 0.0); float r = length(vP); float edge = smoothstep(0.55, 0.9, r) * smoothstep(1.0, 0.92, r);
 gl_FragColor = vec4(uCol * (0.8 + tail * 1.8) * tail * edge * (1.0 - smoothstep(0.7, 1.0, uP)), 1.0); }`,
});
const colMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 1 }, uCol: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `varying float vY; void main(){ vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; uniform vec3 uCol; varying float vY; void main(){ float g = pow(1.0 - vY, 0.7) * smoothstep(0.0, 0.08, vY); gl_FragColor = vec4(uCol * g * uA * 1.6, 1.0); }`,
});
const ringMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 1 }, uCol: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; uniform vec3 uCol; varying vec2 vP; void main(){ float r = length(vP) * 2.0; float m = exp(-pow((r - 0.85) * 9.0, 2.0)); gl_FragColor = vec4(uCol * m * uA * 1.6, 1.0); }`,
});

export class Fx {
    constructor(scene) {
        this.scene = scene;
        this.parts = new Particles(5000);
        scene.add(this.parts.mesh);
        this.meshes = [];
        this.timers = [];
        this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 14, 1.6); scene.add(l); return l; });
        this.lightJobs = [];
        this.boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.shake = () => {}; this.flash = () => {}; this.camera = null; this.sfx = () => {};
        this.time = 0;
    }
    clear() { this.parts.clear(); for (const m of this.meshes) { this.scene.remove(m.mesh); m.mesh.geometry !== arcGeo && m.mesh.geometry.dispose(); m.mesh.material.dispose(); } this.meshes.length = 0; this.timers.length = 0; this.lightJobs.length = 0; for (const l of this.lights) l.intensity = 0; }
    later(t, fn) { this.timers.push({ t, fn }); }
    light(pos, color, intensity, dur) { this.lightJobs.push({ pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z), color, intensity, dur, t: 0 }); }

    update(dt, time) {
        this.time = time;
        this.parts.update(dt, time);
        for (let i = this.timers.length - 1; i >= 0; i--) { const j = this.timers[i]; j.t -= dt; if (j.t <= 0) { this.timers.splice(i, 1); j.fn(); } }
        for (let i = this.meshes.length - 1; i >= 0; i--) {
            const m = this.meshes[i]; m.t += dt;
            const u = m.t / m.dur;
            if (u >= 1) { this.scene.remove(m.mesh); if (m.mesh.geometry !== arcGeo) m.mesh.geometry.dispose(); m.mesh.material.dispose(); this.meshes.splice(i, 1); continue; }
            m.update(u, dt);
        }
        // two point lights shared by flashes
        this.lightJobs = this.lightJobs.filter((j) => (j.t += dt) < j.dur);
        for (let i = 0; i < 2; i++) {
            const j = this.lightJobs[this.lightJobs.length - 1 - i], l = this.lights[i];
            if (!j) { l.intensity = 0; continue; }
            const u = j.t / j.dur; l.position.copy(j.pos); l.color.set(j.color); l.intensity = j.intensity * (1 - u) * (1 - u) * 1.6;
        }
    }

    // ---------------- emitters
    burst(n, make) { for (let i = 0; i < n; i++) this.parts.add(make(i)); }
    sparks(pos, color, n = 16, speed = 5, size = 0.2, life = 0.5) {
        const [r, g, b] = col(color);
        this.burst(n, () => { const a = rnd(TAU), e = rnd(-0.2, 1.1), v = rnd(speed * 0.4, speed); return { x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + 1, vz: Math.sin(a) * Math.cos(e) * v, life: rnd(life * 0.6, life), size: rnd(size * 0.6, size), size1: 0, r, g, b, shape: SHAPE.spark, grav: 9, drag: 1.5 }; });
    }
    glow(pos, color, size = 1.5, life = 0.35, a = 1) { const [r, g, b] = col(color); this.parts.add({ x: pos.x, y: pos.y, z: pos.z, life, size: size * 0.4, size1: size, r, g, b, a, shape: SHAPE.orb, fade: 'out' }); }
    ring(pos, color, size = 2.5, life = 0.45, flat = false) {
        if (!flat) { const [r, g, b] = col(color); this.parts.add({ x: pos.x, y: pos.y, z: pos.z, life, size: 0.2, size1: size, r, g, b, shape: SHAPE.ring }); return; }
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat()); m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.renderOrder = 18;
        m.material.uniforms.uCol.value.set(color); this.scene.add(m);
        this.meshes.push({ mesh: m, t: 0, dur: life, update: (u) => { m.scale.setScalar(0.4 + size * u); m.material.uniforms.uA.value = (1 - u) * (1 - u); } });
    }
    arc(pos, angle, color, size = 2.2, dur = 0.28, flipY = 1) {
        const m = new THREE.Mesh(arcGeo, arcMat()); m.position.copy(pos); m.renderOrder = 22;
        m.material.uniforms.uCol.value.set(color);
        m.quaternion.copy(this.camera.quaternion); m.rotateZ(angle); m.scale.set(size, size * flipY, 1);
        this.scene.add(m); this.meshes.push({ mesh: m, t: 0, dur, update: (u) => { m.material.uniforms.uP.value = u; } });
    }
    column(pos, color, radius = 0.9, height = 6, dur = 0.8) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.15, height, 18, 1, true), colMat()); m.position.set(pos.x, pos.y + height / 2 - 0.2, pos.z); m.renderOrder = 19;
        m.material.uniforms.uCol.value.set(color); this.scene.add(m);
        this.meshes.push({ mesh: m, t: 0, dur, update: (u) => { const w = Math.sin(Math.min(1, u * 3) * Math.PI / 2) * (1 - Math.max(0, u - 0.6) / 0.4); m.scale.set(w, 1, w); m.material.uniforms.uA.value = 1 - u * 0.5; } });
    }
    lightning(from, to, color = 0xffe84a, dur = 0.28, width = 0.1) {
        const pts = [from.clone()]; const segs = 9;
        for (let i = 1; i < segs; i++) { const t = i / segs; pts.push(new THREE.Vector3(from.x + (to.x - from.x) * t + rnd(-0.55, 0.55), from.y + (to.y - from.y) * t + rnd(-0.2, 0.2), from.z + (to.z - from.z) * t + rnd(-0.3, 0.3))); }
        pts.push(to.clone());
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const pos = [], idx = [];
        pts.forEach((p, i) => { const w = width * (1 - i / pts.length * 0.4); pos.push(p.x - right.x * w, p.y - right.y * w, p.z - right.z * w, p.x + right.x * w, p.y + right.y * w, p.z + right.z * w); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        const mat = this.boltMat.clone(); mat.color.set(color).multiplyScalar(2.2);
        const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 23; this.scene.add(m);
        this.meshes.push({ mesh: m, t: 0, dur, update: (u) => { mat.opacity = (Math.floor(u * 8) % 2 ? 0.5 : 1) * (1 - u); } });
    }

    // ---------------- spells. Each returns { hit: seconds until the blow lands, dur: seconds in all }
    play(kind, from, targets, o = {}) {
        const boost = o.boost || 0, B = 1 + boost * 0.35;
        const tc = targets.length ? targets : [from];
        const mid = tc.reduce((a, t) => a.add(t.clone ? t.clone() : new THREE.Vector3(t.x, t.y, t.z)), new THREE.Vector3()).multiplyScalar(1 / tc.length);
        const colr = elemColor(o.element || kind);
        const dirTo = (t) => Math.atan2(t.y - from.y, t.x - from.x);
        switch (kind) {
            case 'slash': case 'claw': case 'spin': {
                const n = kind === 'claw' ? 3 : kind === 'spin' ? 2 : 1 + (boost > 1 ? 1 : 0);
                tc.forEach((t, ti) => { for (let k = 0; k < n; k++) this.later(0.08 * k, () => {
                    const a = (kind === 'claw' ? -0.5 + k * 0.5 : -0.7 + k * 1.2) + (kind === 'spin' ? k * 2.6 : 0);
                    this.arc(t.clone().add(new THREE.Vector3(-0.1, 0.1, 0.4)), a, kind === 'claw' ? 0xffb0b0 : o.element ? ELEM[o.element] || 0xffffff : 0xdff4ff, 2.6 * B, 0.26, k % 2 ? -1 : 1);
                    this.sparks(t, k % 2 ? 0xffffff : 0xffe8a0, 10, 6 * B, 0.2, 0.4);
                    this.glow(t, 0xffffff, 1.8 * B, 0.2);
                }); });
                return { hit: 0.1, dur: 0.12 + n * 0.08 + 0.25 };
            }
            case 'thrust': {
                tc.forEach((t) => {
                    const ang = dirTo(t);
                    for (let i = 0; i < 6; i++) this.parts.add({ x: t.x - 2.2 + i * 0.3, y: t.y, z: t.z + 0.3, vx: 9, life: 0.18, size: 0.55 - i * 0.05, size1: 0.1, r: 0.85, g: 0.95, b: 1, shape: SHAPE.streak, fade: 'out', delay: i * 0.01 });
                    this.later(0.1, () => { this.sparks(t, 0xdff0ff, 14, 6 * B, 0.22, 0.4); this.glow(t, 0xffffff, 2 * B, 0.2); this.ring(t, 0xc8e0ff, 2.4, 0.35); });
                });
                return { hit: 0.12, dur: 0.55 };
            }
            case 'impact': case 'quake': {
                const big = kind === 'quake';
                tc.forEach((t) => {
                    const g = new THREE.Vector3(t.x, 0.05, t.z);
                    this.later(0.05, () => {
                        this.ring(g, 0xffe0b0, (big ? 5 : 3) * B, 0.5, true); this.ring(t, 0xffffff, 3 * B, 0.3);
                        this.burst(big ? 18 : 10, () => ({ x: t.x + rnd(-0.6, 0.6), y: 0.1, z: t.z + rnd(-0.4, 0.4), vx: rnd(-3, 3), vy: rnd(4, 9), vz: rnd(-1, 1), life: rnd(0.5, 0.9), size: rnd(0.15, 0.32), size1: 0.05, r: 0.55, g: 0.45, b: 0.35, shape: SHAPE.shard, grav: 18, spin: rnd(-8, 8), fade: 'out' }));
                        this.burst(8, () => ({ x: t.x + rnd(-0.8, 0.8), y: 0.2, z: t.z + rnd(-0.4, 0.4), vx: rnd(-1.5, 1.5), vy: rnd(0.4, 1.5), life: rnd(0.5, 0.9), size: 0.5, size1: 1.4, r: 0.7, g: 0.62, b: 0.5, a: 0.8, shape: SHAPE.smoke }));
                        this.glow(t, 0xffe0b0, 2.6 * B, 0.25);
                    });
                });
                if (big) this.later(0.05, () => this.shake(0.7));
                return { hit: 0.1, dur: 0.8 };
            }
            case 'arrow': case 'zap': {
                tc.forEach((t, ti) => {
                    const c = kind === 'zap' ? 0xd8e0ff : 0xe8f8c8, [r, g, b] = col(c);
                    const dx = t.x - from.x, dy = t.y - from.y, dz = t.z - from.z;
                    const T0 = 0.22 + ti * 0.04;
                    for (let i = 0; i < 14; i++) this.parts.add({ x: from.x + dx * i / 14, y: from.y + dy * i / 14, z: from.z + dz * i / 14, life: 0.2, size: 0.45, size1: 0.05, r, g, b, shape: SHAPE.streak, fade: 'out', vx: dx / T0 * 0.8, vy: dy / T0 * 0.8, vz: dz / T0 * 0.8, stretch: 1, delay: i * (T0 / 14) });
                    this.later(T0, () => { this.sparks(t, 0xfff0c0, 10, 5, 0.18, 0.35); this.glow(t, 0xffffff, 1.5, 0.18); });
                });
                return { hit: 0.26, dur: 0.6 };
            }
            case 'fire': case 'meteor': {
                const big = kind === 'meteor';
                if (big) {
                    this.later(0.0, () => this.shake(0.3));
                    tc.forEach((t, ti) => {
                        const st = new THREE.Vector3(t.x + 8, 11, t.z - 2);
                        for (let i = 0; i < 24; i++) this.parts.add({ x: st.x + (t.x - st.x) * i / 24, y: st.y + (t.y - st.y) * i / 24, z: st.z, size: 1.4, size1: 0.3, life: 0.4, r: 1, g: 0.5, b: 0.1, shape: SHAPE.flame, delay: ti * 0.16 + i * 0.012, fade: 'out' });
                        this.later(0.35 + ti * 0.16, () => { this.shake(0.6); this.flash(1, 0.7, 0.3, 0.55); this.explosion(t, 0xff7a30, 1.6); });
                    });
                    return { hit: 0.4, dur: 1.4 };
                }
                tc.forEach((t, ti) => {
                    const T0 = 0.3 + ti * 0.05;
                    const steps = 10;
                    for (let i = 0; i < steps; i++) this.parts.add({ x: from.x + (t.x - from.x) * i / steps, y: from.y + (t.y - from.y) * i / steps + Math.sin(i / steps * Math.PI) * 0.8, z: from.z + (t.z - from.z) * i / steps, size: 0.9, size1: 0.3, life: 0.3, r: 1, g: 0.55, b: 0.15, shape: SHAPE.flame, delay: i * T0 / steps, fade: 'out' });
                    this.later(T0, () => this.explosion(t, 0xff7a30, 1 * B));
                });
                return { hit: 0.34, dur: 0.9 };
            }
            case 'ice': {
                tc.forEach((t, ti) => this.later(ti * 0.05, () => {
                    this.ring(new THREE.Vector3(t.x, 0.05, t.z), 0x9fe8ff, 3.5 * B, 0.5, true);
                    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; this.parts.add({ x: t.x + Math.cos(a) * 0.5, y: 0.1, z: t.z + Math.sin(a) * 0.35, vy: 5 + rnd(3), vx: Math.cos(a) * 0.8, life: 0.55, size: 0.55, size1: 0.3, r: 0.6, g: 0.92, b: 1, shape: SHAPE.shard, grav: 7, rot: rnd(-0.3, 0.3), fade: 'out', delay: i * 0.02 }); }
                    this.later(0.12, () => { this.sparks(t, 0xcff4ff, 18, 6, 0.22, 0.6); this.glow(t, 0xbff0ff, 2.4 * B, 0.3); this.burst(10, () => ({ x: t.x + rnd(-0.6, 0.6), y: rnd(0.2, 1.8), z: t.z + rnd(-0.4, 0.4), vy: -1, life: 0.9, size: rnd(0.08, 0.16), r: 0.9, g: 0.98, b: 1, shape: SHAPE.dot, grav: -1, fade: 'out' })); });
                }));
                return { hit: 0.16, dur: 0.9 };
            }
            case 'thunder': {
                tc.forEach((t, ti) => this.later(0.04 * ti, () => {
                    this.lightning(new THREE.Vector3(t.x + rnd(-0.8, 0.8), 9, t.z), t, 0xffe84a, 0.3, 0.1 * B);
                    this.lightning(new THREE.Vector3(t.x + rnd(-1.4, 1.4), 9, t.z), t, 0xfff6a0, 0.24, 0.05);
                    this.flash(1, 0.95, 0.6, 0.45); this.shake(0.35);
                    this.sparks(t, 0xfff08a, 20, 8, 0.24, 0.5); this.glow(t, 0xfff6c0, 3, 0.25);
                    this.ring(new THREE.Vector3(t.x, 0.05, t.z), 0xffe84a, 3.5 * B, 0.4, true);
                }));
                this.light(mid.clone().add(new THREE.Vector3(0, 2, 2)), 0xfff0a0, 14, 0.45);
                return { hit: 0.08, dur: 0.7 };
            }
            case 'wind': {
                tc.forEach((t) => {
                    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU * 2, r = 0.2 + i * 0.045; this.parts.add({ x: t.x + Math.cos(a) * r, y: 0.2 + i * 0.07, z: t.z + Math.sin(a) * r * 0.6, vx: Math.cos(a + 1.5) * 4, vy: 1.5, vz: Math.sin(a + 1.5) * 2.4, life: 0.55, size: 0.28, size1: 0.1, r: 0.55, g: 1, b: 0.8, shape: SHAPE.streak, stretch: 1, fade: 'out', delay: i * 0.012 }); }
                    this.burst(7, () => ({ x: t.x + rnd(-0.5, 0.5), y: rnd(0.3, 1.5), z: t.z + rnd(-0.3, 0.3), vx: rnd(-2, 2), vy: rnd(1, 3), life: 0.8, size: 0.22, size1: 0.1, r: 0.4, g: 0.85, b: 0.3, shape: SHAPE.leaf, spin: rnd(-6, 6), fade: 'out' }));
                    this.later(0.12, () => { this.arc(t.clone().add(new THREE.Vector3(0, 0.3, 0.4)), 0.8, 0x9fffd0, 2.4 * B, 0.3); this.arc(t.clone().add(new THREE.Vector3(0, 0.2, 0.4)), 3.4, 0x9fffd0, 2.0 * B, 0.3); this.glow(t, 0xbfffe0, 2, 0.25); });
                });
                return { hit: 0.16, dur: 0.85 };
            }
            case 'holy': case 'sun': case 'grace': {
                const sun = kind === 'sun', grace = kind === 'grace';
                const C = grace ? 0xfff8d0 : 0xfff2b0;
                tc.forEach((t, ti) => this.later(0.05 * ti, () => {
                    this.column(new THREE.Vector3(t.x, 0, t.z), C, grace ? 1.3 : 0.9 * B, 8, grace ? 1.2 : 0.8);
                    this.ring(new THREE.Vector3(t.x, 0.05, t.z), C, 3.6 * B, 0.7, true);
                    this.burst(sun ? 26 : 16, () => ({ x: t.x + rnd(-0.8, 0.8), y: 0.2, z: t.z + rnd(-0.5, 0.5), vy: rnd(2, 6), life: rnd(0.6, 1.1), size: rnd(0.15, 0.32), size1: 0, r: 1, g: 0.95, b: 0.7, shape: grace ? SHAPE.star : SHAPE.spark, fade: 'out' }));
                    this.glow(t.clone().setY(t.y + 0.4), 0xfff6c0, 3.4 * B, 0.5);
                }));
                if (sun) { this.later(0.0, () => { this.flash(1, 0.95, 0.7, 0.6); this.shake(0.5); }); this.light(mid.clone().add(new THREE.Vector3(0, 4, 2)), 0xfff0a0, 18, 0.9); for (let i = 0; i < 14; i++) this.parts.add({ x: mid.x, y: mid.y + 1, z: mid.z, life: 0.7, size: 7, size1: 12, r: 1, g: 0.9, b: 0.5, a: 0.5, rot: i * 0.22, shape: SHAPE.streak, delay: 0.1, fade: 'out' }); }
                this.light(mid.clone().add(new THREE.Vector3(0, 3, 1)), 0xfff0a0, 8, 0.7);
                return { hit: sun ? 0.45 : 0.3, dur: sun ? 1.5 : grace ? 1.6 : 1.1 };
            }
            case 'dark': case 'rift': case 'gravity': {
                tc.forEach((t) => {
                    const c = kind === 'gravity' ? 0x9060ff : 0xb070ff, [r, g, b] = col(c);
                    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; this.parts.add({ x: t.x + Math.cos(a) * 2.2, y: t.y + Math.sin(a) * 1.8, z: t.z, vx: -Math.cos(a) * 6, vy: -Math.sin(a) * 5, life: 0.4, size: 0.4, size1: 0.1, r, g, b, shape: SHAPE.orb, fade: 'out', delay: i * 0.01 }); }
                    this.parts.add({ x: t.x, y: t.y, z: t.z, life: 0.7, size: 0.3, size1: kind === 'gravity' ? 2.4 : 1.6, r: 0.04, g: 0.0, b: 0.1, a: 1, shape: SHAPE.smoke, delay: 0.1, fade: 'out' });
                    this.later(0.28, () => { this.ring(t, c, 3.4 * B, 0.5); this.sparks(t, c, 16, 6, 0.24, 0.6); this.glow(t, c, 2.8, 0.3); this.burst(9, () => ({ x: t.x + rnd(-0.6, 0.6), y: t.y + rnd(-0.6, 0.6), z: t.z, vy: rnd(1, 3), life: 0.7, size: 0.6, size1: 1.2, r: 0.1, g: 0.03, b: 0.18, a: 0.9, shape: SHAPE.smoke })); });
                });
                if (kind === 'rift') { this.later(0.2, () => { this.flash(0.6, 0.2, 1, 0.4); this.shake(0.5); }); }
                return { hit: 0.3, dur: 0.95 };
            }
            case 'star': {
                tc.forEach((t, ti) => {
                    this.later(ti * 0.1, () => {
                        for (let i = 0; i < 12; i++) this.parts.add({ x: t.x + 4 - i * 0.2, y: 8 - i * 0.55, z: t.z, size: 0.9 - i * 0.05, size1: 0.2, life: 0.25, r: 1, g: 0.95, b: 0.65, shape: SHAPE.star, fade: 'out', delay: i * 0.012 });
                        this.later(0.14, () => { this.sparks(t, 0xfff2b0, 18, 7, 0.24, 0.5); this.glow(t, 0xfff6c0, 3, 0.25); this.ring(t, 0xfff2b0, 3, 0.4); this.shake(0.2); });
                    });
                });
                return { hit: 0.3, dur: 1.2 + tc.length * 0.1 };
            }
            case 'prism': {
                tc.forEach((t) => this.later(0.05, () => {
                    ['ff4a4a', 'ffa84a', 'ffee4a', '4aff7a', '4acaff', 'b04aff'].forEach((hx, i) => { const a = i / 6 * TAU; for (let k = 0; k < 4; k++) this.parts.add({ x: t.x, y: t.y, z: t.z, vx: Math.cos(a) * (3 + k), vy: Math.sin(a) * (3 + k), life: 0.5, size: 0.5, size1: 0.1, ...Object.fromEntries(['r', 'g', 'b'].map((c, j) => [c, parseInt(hx.slice(j * 2, j * 2 + 2), 16) / 255])), shape: SHAPE.streak, stretch: 1, fade: 'out', delay: k * 0.02 }); });
                    this.glow(t, 0xffffff, 3.4, 0.4); this.ring(t, 0xffffff, 3.6, 0.45);
                }));
                return { hit: 0.2, dur: 0.9 };
            }
            case 'heal': case 'buff': case 'guard': case 'scan': {
                const c = kind === 'heal' ? 0x7fffb0 : kind === 'buff' ? 0xffd36a : kind === 'scan' ? 0x7fffe0 : 0x9fd0ff, [r, g, b] = col(c);
                tc.forEach((t) => {
                    this.ring(new THREE.Vector3(t.x, 0.1, t.z), c, 2.6, 0.7, true);
                    this.burst(kind === 'heal' ? 12 : 9, (i) => ({ x: t.x + rnd(-0.6, 0.6), y: rnd(0, 0.8), z: t.z + rnd(-0.4, 0.4), vy: rnd(1.2, 3), life: rnd(0.7, 1.1), size: rnd(0.16, 0.3), size1: 0.05, r, g, b, shape: kind === 'heal' ? SHAPE.plus : SHAPE.star, fade: 'out', delay: i * 0.03 }));
                    this.glow(t, c, 2.2, 0.5, 0.7);
                    if (kind === 'scan') this.parts.add({ x: t.x, y: t.y + 1, z: t.z, life: 0.6, size: 3.6, size1: 0.4, r, g, b, shape: SHAPE.ring, a: 0.8 });
                });
                return { hit: 0.25, dur: 1.0 };
            }
            case 'debuff': case 'sleep': case 'poison': {
                const c = kind === 'sleep' ? 0x8fb0ff : kind === 'poison' ? 0x9be15d : 0xb070d0, [r, g, b] = col(c);
                tc.forEach((t) => {
                    this.burst(10, (i) => ({ x: t.x + rnd(-0.6, 0.6), y: t.y + rnd(-0.2, 1.4), z: t.z, vy: kind === 'debuff' ? -2.2 : rnd(0.8, 1.6), life: 0.9, size: rnd(0.15, 0.3), size1: 0.1, r, g, b, shape: kind === 'poison' ? SHAPE.bubble : kind === 'sleep' ? SHAPE.orb : SHAPE.spark, fade: 'out', delay: i * 0.04 }));
                    this.ring(t, c, 2.4, 0.5);
                });
                return { hit: 0.25, dur: 0.95 };
            }
            case 'cast': default: {
                tc.forEach((t) => { this.sparks(t, colr, 12, 5, 0.2, 0.4); this.glow(t, colr, 2, 0.25); this.ring(t, colr, 2.4, 0.35); });
                return { hit: 0.15, dur: 0.6 };
            }
        }
    }

    explosion(t, color, s = 1) {
        const [r, g, b] = col(color);
        this.glow(t, color, 3.6 * s, 0.35); this.glow(t, 0xffffff, 1.8 * s, 0.18);
        this.ring(t, color, 4 * s, 0.45); this.ring(new THREE.Vector3(t.x, 0.05, t.z), color, 5 * s, 0.55, true);
        this.burst(Math.round(18 * s), () => ({ x: t.x, y: t.y, z: t.z, vx: rnd(-5, 5) * s, vy: rnd(1, 6) * s, vz: rnd(-1.5, 1.5), life: rnd(0.4, 0.8), size: rnd(0.4, 0.8) * s, size1: 0.1, r, g, b, shape: SHAPE.flame, grav: -2, drag: 2, fade: 'out' }));
        this.sparks(t, 0xffe0a0, Math.round(20 * s), 8 * s, 0.22, 0.7);
        this.burst(6, () => ({ x: t.x + rnd(-0.5, 0.5), y: t.y, z: t.z, vy: rnd(1, 2.5), vx: rnd(-1, 1), life: 1, size: 0.6, size1: 1.8, r: 0.18, g: 0.12, b: 0.1, a: 0.8, shape: SHAPE.smoke }));
        this.light(new THREE.Vector3(t.x, t.y + 1, t.z + 1.4), color, 14 * s, 0.5);
    }
}
