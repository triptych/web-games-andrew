// Tactical overlays drawn on the floor: guards' and cameras' vision cones
// (ray-cast against the map every frame, so they hug the walls), patrol
// routes, the aim guide, the pull-back band and the power ring.

import * as THREE from 'three';
import { coneOf, isDown, isAwake } from '../sim/ai.js';
import { castRay } from '../sim/physics.js';
import { VISION } from '../config.js';

const SEG = 30;

const coneMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0.3 }, uTime: { value: 0 } },
    vertexShader: 'attribute float aEdge; varying float vEdge; varying vec3 vW; void main(){ vEdge = aEdge; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime; varying float vEdge; varying vec3 vW;
        void main(){
            float scan = 0.85 + 0.15 * sin((vW.x + vW.z) * 6.0 - uTime * 4.0);
            float a = uOpacity * (0.35 + 0.65 * vEdge) * scan;
            a += smoothstep(0.93, 1.0, vEdge) * uOpacity * 1.3;
            gl_FragColor = vec4(uColor, a);
        }`,
});

class Cone {
    constructor(group) {
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array((SEG + 2) * 3);
        this.edge = new Float32Array(SEG + 2);
        const idx = [];
        for (let i = 0; i < SEG; i++) idx.push(0, i + 2, i + 1);
        g.setIndex(idx);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('aEdge', new THREE.BufferAttribute(this.edge, 1));
        this.mat = coneMat();
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 3;
        group.add(this.mesh);
    }
    update(S, L, x, y, face, range, half, y0 = 0.04) {
        this.pos[0] = x; this.pos[1] = y0; this.pos[2] = y;
        this.edge[0] = 0;
        for (let i = 0; i <= SEG; i++) {
            const a = face - half + (i / SEG) * half * 2;
            const d = castRay(S, L, x, y, a, range);
            this.pos[(i + 1) * 3] = x + Math.cos(a) * d;
            this.pos[(i + 1) * 3 + 1] = y0;
            this.pos[(i + 1) * 3 + 2] = y + Math.sin(a) * d;
            this.edge[i + 1] = d / range;
        }
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.attributes.aEdge.needsUpdate = true;
    }
}

/** A flat ribbon on the floor following a polyline; dashed if asked. */
class Ribbon {
    constructor(group, color, width = 0.08, opacity = 0.9, max = 600) {
        this.max = max;
        this.pos = new Float32Array(max * 6 * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setDrawRange(0, 0);
        this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 6;
        this.width = width;
        group.add(this.mesh);
    }
    set(points, { dash = 0, gap = 0, y = 0.06, width = this.width } = {}) {
        let n = 0;
        const hw = width / 2;
        let acc = 0;
        for (let i = 0; i + 1 < points.length && n < this.max; i++) {
            const [x0, z0] = points[i], [x1, z1] = points[i + 1];
            const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
            if (len < 1e-5) continue;
            const nx = -dz / len * hw, nz = dx / len * hw;
            let s = 0;
            while (s < len && n < this.max) {
                let e = len;
                if (dash > 0) {
                    const ph = acc % (dash + gap);
                    if (ph >= dash) { const skip = dash + gap - ph; s += skip; acc += skip; continue; }
                    e = Math.min(len, s + (dash - ph));
                }
                const ax = x0 + dx * (s / len), az = z0 + dz * (s / len), bx = x0 + dx * (e / len), bz = z0 + dz * (e / len);
                this.pos.set([ax + nx, y, az + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz], n * 18);
                n++;
                acc += e - s; s = e;
            }
        }
        this.mesh.geometry.setDrawRange(0, n * 6);
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.visible = n > 0;
    }
    hide() { this.mesh.visible = false; }
}

export class Overlay {
    constructor(group) {
        this.group = new THREE.Group();
        group.add(this.group);
        this.cones = new Map();
        this.camCones = [];
        this.path = new Ribbon(this.group, new THREE.Color(0x6ff8ff).multiplyScalar(1.5), 0.075, 0.95);
        this.objPath = new Ribbon(this.group, new THREE.Color(0xffe45c).multiplyScalar(1.4), 0.06, 0.85, 40);
        this.band = new Ribbon(this.group, new THREE.Color(0xff3fa4).multiplyScalar(1.6), 0.06, 0.9, 20);
        this.patrols = new Ribbon(this.group, 0xff6070, 0.04, 0.35, 3000);
        const gm = new THREE.MeshBasicMaterial({ color: 0x6ff8ff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        this.ghost = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 32), gm);
        this.ghost.rotation.x = -Math.PI / 2; this.ghost.visible = false; this.ghost.renderOrder = 7;
        this.group.add(this.ghost);
        this.powerMat = new THREE.MeshBasicMaterial({ color: 0x2ff2e0, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        this.power = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 48, 1, 0, Math.PI * 2), this.powerMat);
        this.power.rotation.x = -Math.PI / 2; this.power.visible = false; this.power.renderOrder = 7;
        this.group.add(this.power);
        this.dropMark = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.3, 4), new THREE.MeshBasicMaterial({ color: 0xff2e3e, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
        this.dropMark.rotation.x = -Math.PI / 2; this.dropMark.visible = false;
        this.group.add(this.dropMark);
        this.t = 0;
    }

    setPatrols(W) {
        const segs = [];
        for (const f of W.foes) {
            if (f.path.length < 2) continue;
            const p = f.path.map(([x, y]) => [x, y]);
            p.push(p[0]);
            segs.push(p);
        }
        this._ribMany(this.patrols, segs);
    }

    update(W, dt, aim, showPatrols) {
        this.t += dt;
        const S = W.S, L = W.L;
        // guard cones
        const seen = new Set();
        for (const f of W.foes) {
            seen.add(f.id);
            let c = this.cones.get(f.id);
            if (!c) { c = new Cone(this.group); this.cones.set(f.id, c); }
            const show = !f.gone && isAwake(f);
            c.mesh.visible = show;
            if (!show) continue;
            const cone = coneOf(S, f);
            c.update(S, L, f.x, f.y, f.face, cone.range, cone.half, 0.04 + (f.id % 7) * 0.002);
            const col = f.state === 'alert' ? 0xff2e3e : f.state === 'dance' ? 0xb44cff : f.sus > 0.25 || f.state === 'suspicious' || f.state === 'investigate' || f.state === 'search' ? 0xffa030 : 0xfff4e0;
            c.mat.uniforms.uColor.value.set(col);
            c.mat.uniforms.uOpacity.value = f.state === 'alert' ? 0.26 : 0.17;
            c.mat.uniforms.uTime.value = this.t;
        }
        for (const [id, c] of this.cones) if (!seen.has(id)) { this.group.remove(c.mesh); this.cones.delete(id); }
        // camera cones
        while (this.camCones.length < S.cams.length) this.camCones.push(new Cone(this.group));
        S.cams.forEach((c, i) => {
            const cc = this.camCones[i];
            const show = !c.off && !c.broken;
            cc.mesh.visible = show;
            if (!show) return;
            cc.update(S, L, c.x, c.y, c.a, VISION.camRange, VISION.camHalf, 0.05);
            cc.mat.uniforms.uColor.value.set(c.sus > 0.1 ? 0xff5050 : 0x7ad8ff);
            cc.mat.uniforms.uOpacity.value = 0.15 + c.sus * 0.25;
            cc.mat.uniforms.uTime.value = this.t;
        });
        // patrol routes (only while lining up a shot)
        this.patrols.mesh.visible = showPatrols && this.patrols.mesh.geometry.drawRange.count > 0;
        // aim guide
        if (aim && aim.pred) {
            const pts = aim.pred.pts;
            this.path.set(pts, { dash: 0.28, gap: 0.16, y: 0.07 });
            if (aim.pred.hit) {
                const h = aim.pred.hit;
                this.ghost.visible = true;
                this.ghost.position.set(h.x, 0.07, h.y);
                const s = aim.r / 0.37;
                this.ghost.scale.set(s, s, s);
                const tb = W.body(h.target);
                if (tb) this.objPath.set([[tb.x, tb.y], [tb.x + h.nx * 2.2, tb.y + h.ny * 2.2]], { y: 0.075 });
                this.ghost.material.color.set(h.kind === 'foe' ? 0xffe45c : 0x6ff8ff);
            } else { this.ghost.visible = false; this.objPath.hide(); }
            if (aim.pred.dropped) {
                const last = pts[pts.length - 1];
                this.dropMark.visible = true; this.dropMark.position.set(last[0], 0.08, last[1]); this.dropMark.rotation.z = this.t * 3;
            } else this.dropMark.visible = false;
            // pull-back band
            this.band.set([[aim.x, aim.y], [aim.x - Math.cos(aim.a) * (0.6 + aim.power * 2.2), aim.y - Math.sin(aim.a) * (0.6 + aim.power * 2.2)]], { y: 0.08, width: 0.05 + aim.power * 0.05 });
            this.power.visible = true;
            this.power.position.set(aim.x, 0.06, aim.y);
            this.power.geometry.dispose();
            this.power.geometry = new THREE.RingGeometry(aim.r + 0.22, aim.r + 0.32, 48, 1, Math.PI / 2, -Math.PI * 2 * Math.max(0.02, aim.power));
            this.powerMat.color.setHSL(0.5 - aim.power * 0.55, 1, 0.55);
        } else {
            this.path.hide(); this.objPath.hide(); this.band.hide(); this.ghost.visible = false; this.power.visible = false; this.dropMark.visible = false;
        }
    }

    _ribMany(rib, segs) {
        let off = 0;
        const total = [];
        for (const s of segs) {
            rib.set(s, { dash: 0.18, gap: 0.22, y: 0.05 });
            const cnt = rib.mesh.geometry.drawRange.count;
            total.push(rib.pos.slice(0, cnt * 3));
        }
        for (const arr of total) { if (off + arr.length > rib.pos.length) break; rib.pos.set(arr, off); off += arr.length; }
        rib.mesh.geometry.setDrawRange(0, off / 3);
        rib.mesh.geometry.attributes.position.needsUpdate = true;
        rib.mesh.visible = off > 0;
    }

    clear() {
        for (const c of this.cones.values()) this.group.remove(c.mesh);
        for (const c of this.camCones) this.group.remove(c.mesh);
        this.cones.clear(); this.camCones = [];
        this.patrols.mesh.geometry.setDrawRange(0, 0);
    }
}
