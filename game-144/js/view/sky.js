// The backgrounds: a painted backdrop (fal art) far behind, a procedural nebula shader in front of it, a parallax
// starfield that streaks with speed, and per-stage 3D scenery that drifts past at its own depth. Reads only the
// stage id and a scroll speed.

import * as THREE from 'three';
import { STAGES } from '../sim/data/world.js';
import { hash3 } from '../rng.js';

const NEB_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const NEB_FS = `
    uniform float uTime, uScroll, uAlpha; uniform vec3 uA, uB; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){
        vec2 p = vUv * vec2(3.2, 1.8) + vec2(uScroll * 0.02, 0.0);
        float q = fbm(p + fbm(p * 1.7 + uTime * 0.01));
        float r = fbm(p * 2.3 - vec2(uTime * 0.015, 0.0) + q);
        float m = clamp(q * q * 1.6 - 0.25, 0.0, 1.0);
        vec3 col = mix(uA, uB, clamp(r, 0.0, 1.0)) * m * 0.55;
        float edge = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        gl_FragColor = vec4(col * edge * uAlpha, 1.0);
    }`;

const STAR_VS = `
    attribute float aSize; attribute float aDepth; uniform float uSpeed, uPx; varying float vA; varying float vStreak;
    void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float sz = aSize * uPx * (60.0 / max(1.0, -mv.z));
        vStreak = clamp(uSpeed * 0.06 / max(aDepth, 0.2), 0.0, 1.0);
        gl_PointSize = clamp(sz * (1.0 + vStreak * 5.0), 1.0, 48.0);
        vA = clamp(1.4 - aDepth * 0.6, 0.25, 1.0);
    }`;
const STAR_FS = `
    varying float vA; varying float vStreak; uniform vec3 uTint;
    void main(){
        vec2 c = gl_PointCoord - 0.5;
        c.y /= max(0.08, 1.0 - vStreak * 0.92);        // squash into a horizontal streak when fast
        float d = length(c);
        float a = clamp(1.0 - d * 2.0, 0.0, 1.0);
        a = a * a * vA;
        gl_FragColor = vec4(mix(vec3(1.0), uTint, 0.35) * a, a);
    }`;

export class Sky {
    constructor(stage) {
        this.stage = stage;
        this.scene = stage.scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.loader = new THREE.TextureLoader();
        this.tex = {};
        this.scroll = 0;
        this.speed = 1;
        this.id = null;

        // painted backdrop, far away
        this.backMat = new THREE.MeshBasicMaterial({ color: 0x4a4a58, fog: false, depthWrite: false, transparent: true, opacity: 1 });
        this.back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.backMat);
        this.back.renderOrder = -10;
        this.group.add(this.back);
        this.backMat2 = this.backMat.clone();
        this.back2 = new THREE.Mesh(this.back.geometry, this.backMat2);
        this.back2.renderOrder = -9;
        this.back2.visible = false;
        this.group.add(this.back2);
        this.fade = 1;

        // procedural nebula
        this.nebMat = new THREE.ShaderMaterial({
            vertexShader: NEB_VS, fragmentShader: NEB_FS, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
            uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uAlpha: { value: 0.45 }, uA: { value: new THREE.Color(1, 0.5, 0.3) }, uB: { value: new THREE.Color(0.3, 0.4, 1) } },
        });
        this.neb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.nebMat);
        this.neb.renderOrder = -8;
        this.group.add(this.neb);

        // stars
        const N = stage.quality === 'low' ? 700 : 2200;
        const pos = new Float32Array(N * 3), size = new Float32Array(N), depth = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const d = 0.15 + hash3(i, 1, 9) ** 1.5 * 3;
            depth[i] = d;
            pos[i * 3] = (hash3(i, 2, 9) - 0.5) * 220;
            pos[i * 3 + 1] = (hash3(i, 3, 9) - 0.5) * 130;
            pos[i * 3 + 2] = -24 - d * 60;
            size[i] = 0.35 + hash3(i, 4, 9) * 0.9;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
        this.starMat = new THREE.ShaderMaterial({
            vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
            uniforms: { uSpeed: { value: 0 }, uPx: { value: 1 }, uTint: { value: new THREE.Color(0.7, 0.8, 1) } },
        });
        this.stars = new THREE.Points(g, this.starMat);
        this.stars.frustumCulled = false;
        this.group.add(this.stars);

        this.props = new THREE.Group();
        this.group.add(this.props);
        this.propList = [];
    }

    texture(id) {
        if (!this.tex[id]) {
            const t = this.loader.load(`art/bg/${id}.webp`, (tt) => { tt.colorSpace = THREE.SRGBColorSpace; tt.needsUpdate = true; }, undefined, () => { this.tex[id].failed = true; });
            t.colorSpace = THREE.SRGBColorSpace;
            this.tex[id] = t;
        }
        return this.tex[id];
    }

    /** Switch to a stage's look (stage id from data/world.js, or 'endless'). */
    setStage(id, themeId = id) {
        if (this.id === id && this.theme === themeId) return;
        const first = !this.id;
        this.id = id; this.theme = themeId;
        const S = STAGES.find((s) => s.id === themeId) || STAGES[0];
        // crossfade the painted backdrop
        this.backMat2.map = this.backMat.map;
        this.backMat2.needsUpdate = true;
        this.back2.visible = !first && !!this.backMat.map;
        this.backMat.map = this.texture(id);
        this.backMat.needsUpdate = true;
        this.fade = first ? 1 : 0;
        // colours
        const sky = S.sky;
        this.backMat.color.set(0x4a4a58).multiplyScalar(sky.dim ?? 1);
        this.nebMat.uniforms.uA.value.set(sky.neb);
        this.nebMat.uniforms.uB.value.set(sky.neb2);
        this.starMat.uniforms.uTint.value.set(sky.dust);
        this.scene.fog.color.set(sky.fog);
        this.stage.renderer.setClearColor(sky.top);
        this.stage.key.color.set(sky.key);
        this.stage.rim.color.set(sky.rim);
        this.stage.hemi.color.set(sky.rim);
        this.stage.hemi.groundColor.set(sky.bottom);
        this.buildProps(themeId);
    }

    buildProps(id) {
        for (const o of this.propList) { this.props.remove(o.mesh); o.mesh.geometry.dispose(); o.mesh.material.dispose(); }
        this.propList = [];
        const add = (geo, mat, n, o) => {
            const mesh = new THREE.InstancedMesh(geo, mat, n);
            mesh.frustumCulled = false;
            const items = [];
            for (let i = 0; i < n; i++) {
                const r = (k) => hash3(i, k, id.length * 31 + n);
                items.push({
                    x: (r(1) - 0.5) * o.spanX, y: o.y ? o.y(r, i) : (r(2) - 0.5) * o.spanY, z: o.z(r, i),
                    s: o.s(r, i), rx: r(5) * 6, ry: r(6) * 6, rz: r(7) * 6, spin: (r(8) - 0.5) * (o.spin ?? 0.6), sy: o.sy ? o.sy(r, i) : 1,
                });
            }
            this.props.add(mesh);
            this.propList.push({ mesh, items, o });
        };
        // scenery stays well under the action: darker than its nominal colour, glows turned way down
        const std = (c, e = 0x000000, ei = 0, r = 0.7, m = 0.2) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(0.5), emissive: e, emissiveIntensity: ei * 0.3, roughness: r, metalness: m });
        const q = this.stage.quality === 'low' ? 0.5 : 1;
        switch (id) {
            case 'saturn':
                add(new THREE.DodecahedronGeometry(1, 0), std(0x5a5048, 0, 0, 0.9, 0.05), Math.round(60 * q), { spanX: 200, spanY: 80, z: (r) => -22 - r(3) * 70, s: (r) => 0.3 + r(4) ** 3 * 2.2, speed: 1 });
                add(new THREE.IcosahedronGeometry(1, 0), std(0x8aa0c0, 0x223355, 0.25, 0.3, 0.1), Math.round(40 * q), { spanX: 200, spanY: 70, z: (r) => -20 - r(3) * 60, s: (r) => 0.15 + r(4) * 0.7, speed: 1 });
                add(new THREE.BoxGeometry(3, 0.7, 1.2), std(0x24262c, 0xff5a20, 0.12, 0.7, 0.5), Math.round(6 * q), { spanX: 220, spanY: 60, z: (r) => -45 - r(3) * 50, s: (r) => 1 + r(4) * 2.2, speed: 1, spin: 0.1 });
                break;
            case 'veil':
                add(new THREE.OctahedronGeometry(1, 0), std(0x88f0ff, 0x30d8ff, 0.9, 0.08, 0.3), Math.round(45 * q), { spanX: 200, spanY: 80, z: (r) => -30 - r(3) * 70, s: (r) => 0.4 + r(4) ** 2 * 2.2, sy: (r) => 1.5 + r(9) * 2, speed: 1, spin: 0.3 });
                add(new THREE.OctahedronGeometry(1, 0), std(0xff9ae8, 0xff40c8, 0.9, 0.08, 0.3), Math.round(25 * q), { spanX: 200, spanY: 80, z: (r) => -32 - r(3) * 60, s: (r) => 0.3 + r(4) * 1.3, sy: (r) => 2 + r(9) * 2, speed: 1, spin: 0.3 });
                break;
            case 'cathedral':
                add(new THREE.TorusGeometry(26, 1.6, 6, 28, Math.PI), std(0x3a2a28, 0x401008, 0.4, 0.8, 0.3), Math.round(14 * q), { spanX: 180, y: () => -12, z: (r) => -14 - r(3) * 26, s: () => 1, speed: 1, spin: 0, fixedRot: true });
                add(new THREE.CylinderGeometry(0.6, 0.9, 40, 8), std(0x4a3434, 0xff3020, 0.15, 0.7, 0.3), Math.round(26 * q), { spanX: 180, y: (r) => (r(2) < 0.5 ? 20 : -20), z: (r) => -10 - r(3) * 40, s: () => 1, speed: 1, spin: 0, fixedRot: true });
                add(new THREE.SphereGeometry(1, 10, 8), std(0xff6040, 0xff3010, 1.6, 0.4, 0), Math.round(40 * q), { spanX: 180, spanY: 60, z: (r) => -16 - r(3) * 40, s: (r) => 0.2 + r(4) * 0.5, speed: 1 });
                break;
            case 'foundry':
                add(new THREE.BoxGeometry(1, 30, 1), std(0x50545c, 0, 0, 0.5, 0.8), Math.round(24 * q), { spanX: 180, spanY: 30, z: (r) => -12 - r(3) * 50, s: (r) => 0.5 + r(4), speed: 1, spin: 0, fixedRot: true });
                add(new THREE.BoxGeometry(40, 0.6, 0.6), std(0x60646c, 0xffa040, 0.25, 0.5, 0.8), Math.round(16 * q), { spanX: 180, spanY: 60, z: (r) => -14 - r(3) * 50, s: () => 1, speed: 1, spin: 0, fixedRot: true });
                add(new THREE.CylinderGeometry(0.35, 0.35, 24, 8), std(0x103040, 0x30d8ff, 2.0, 0.3, 0.2), Math.round(14 * q), { spanX: 180, spanY: 60, z: (r) => -10 - r(3) * 40, s: () => 1, speed: 1, spin: 0, fixedRot: true, rotZ: Math.PI / 2 });
                break;
            case 'deep':
                add(new THREE.CapsuleGeometry(0.5, 14, 4, 8), std(0xd8d0b8, 0x203018, 0.2, 0.9, 0), Math.round(30 * q), { spanX: 180, spanY: 70, z: (r) => -20 - r(3) * 60, s: (r) => 0.5 + r(4) * 1.4, speed: 1, spin: 0.08 });
                add(new THREE.SphereGeometry(1, 10, 8), std(0x40ffa0, 0x30ff90, 1.8, 0.4, 0), Math.round(70 * q), { spanX: 180, spanY: 70, z: (r) => -18 - r(3) * 50, s: (r) => 0.08 + r(4) * 0.4, speed: 1 });
                add(new THREE.SphereGeometry(1, 10, 8), std(0xb070ff, 0x9a40ff, 1.6, 0.4, 0), Math.round(40 * q), { spanX: 180, spanY: 70, z: (r) => -20 - r(3) * 50, s: (r) => 0.1 + r(4) * 0.3, speed: 1 });
                break;
            case 'heart':
            default:
                add(new THREE.ConeGeometry(1, 8, 5), std(0x8090b0, 0x4060c0, 0.8, 0.2, 0.5), Math.round(28 * q), { spanX: 170, spanY: 70, z: (r) => -20 - r(3) * 60, s: (r) => 0.4 + r(4) * 1.6, speed: 1, spin: 0.25 });
                add(new THREE.TorusGeometry(6, 0.12, 6, 48), std(0xc0a060, 0xffd060, 1.2, 0.2, 0.6), Math.round(5 * q), { spanX: 160, spanY: 50, z: (r) => -20 - r(3) * 50, s: (r) => 0.6 + r(4) * 2, speed: 1, spin: 0.4 });
                break;
        }
    }

    update(dt, time, speed = 1, warp = 0) {
        // fit the far planes to the view
        const cam = this.stage.camera;
        // far planes hang in front of the camera, facing it, so a leaning camera never sees their edge
        const fwd = this._fwd || (this._fwd = new THREE.Vector3());
        fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
        const fitPlane = (mesh, z, over = 1.25) => {
            const d = cam.position.z - z;
            const h = 2 * d * Math.tan((cam.fov * Math.PI) / 360) * over;
            mesh.scale.set(h * cam.aspect, h, 1);
            mesh.position.copy(cam.position).addScaledVector(fwd, d);
            mesh.quaternion.copy(cam.quaternion);
        };
        // the painted backdrop: keep its 16:9 aspect, cover the view, drift slowly
        const bz = -260;
        fitPlane(this.back, bz, 1.25);
        const ar = this.back.scale.x / this.back.scale.y;
        if (ar < 16 / 9) this.back.scale.x = this.back.scale.y * 16 / 9; else this.back.scale.y = this.back.scale.x * 9 / 16;
        this.back2.scale.copy(this.back.scale); this.back2.position.copy(this.back.position).addScaledVector(fwd, -1); this.back2.quaternion.copy(this.back.quaternion);
        this.fade = Math.min(1, this.fade + dt * 0.8);
        this.backMat.opacity = this.fade;
        this.backMat2.opacity = 1 - this.fade;
        if (this.fade >= 1) this.back2.visible = false;
        this.back.position.x += Math.sin(time * 0.03) * 6; this.back.position.y += Math.sin(time * 0.021) * 3;
        fitPlane(this.neb, -150, 1.2);

        this.scroll += dt * speed * (1 + warp * 6);
        this.nebMat.uniforms.uTime.value = time;
        this.nebMat.uniforms.uScroll.value = this.scroll;
        this.starMat.uniforms.uSpeed.value = speed * 4 + warp * 60;
        this.starMat.uniforms.uPx.value = this.stage.renderer.getPixelRatio();
        // stars wrap round as they drift left, faster when near
        const pos = this.stars.geometry.attributes.position, dep = this.stars.geometry.attributes.aDepth;
        const v = (speed * 5 + warp * 90) * dt;
        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i) - v / dep.getX(i);
            if (x < -110) x += 220;
            pos.setX(i, x);
        }
        pos.needsUpdate = true;

        // scenery drifts at a speed that falls off with depth
        const tmp = this._tmp || (this._tmp = new THREE.Object3D());
        for (const P of this.propList) {
            const { mesh, items, o } = P;
            items.forEach((it, i) => {
                const par = 18 / (18 - it.z);
                it.x -= (speed * 4.2 + warp * 50) * par * dt * 1.6;
                if (it.x < -o.spanX / 2) it.x += o.spanX;
                if (!o.fixedRot) { it.rx += it.spin * dt; it.ry += it.spin * 0.7 * dt; }
                tmp.position.set(it.x, it.y, it.z);
                if (o.fixedRot) tmp.rotation.set(0, 0, o.rotZ || 0); else tmp.rotation.set(it.rx, it.ry, it.rz);
                tmp.scale.set(it.s, it.s * it.sy, it.s);
                tmp.updateMatrix();
                mesh.setMatrixAt(i, tmp.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
