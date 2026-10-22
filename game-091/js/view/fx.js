// Effects: additive spark bursts (one pooled Points object) and short-lived beams from the
// payline to whatever a symbol hits.

import * as THREE from 'three';

const N = 700;

const pVert = /* glsl */`
attribute float aLife;
attribute vec3 aColor;
attribute float aSize;
varying float vLife;
varying vec3 vColor;
void main() {
    vLife = aLife;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * clamp(aLife, 0.0, 1.0) * (300.0 / max(-mv.z, 0.1));
    gl_Position = projectionMatrix * mv;
}
`;
const pFrag = /* glsl */`
precision highp float;
varying float vLife;
varying vec3 vColor;
void main() {
    if (vLife <= 0.0) discard;
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * a * 1.6 * clamp(vLife, 0.0, 1.0), 1.0);
}
`;

export class Fx {
    constructor(scene) {
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(N * 3);
        this.vel = new Float32Array(N * 3);
        this.life = new Float32Array(N);
        this.col = new Float32Array(N * 3);
        this.size = new Float32Array(N);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
        this.geo = g;
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({
            vertexShader: pVert, fragmentShader: pFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.next = 0;
        // a little deterministic jitter source, so effects don't need Math.random either
        this.j = 1;
        this.beams = [];
        this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
        this.beamGeo.translate(0, 0.5, 0);
        this.scene = scene;
        this.tmp = new THREE.Color();
    }

    rnd() { this.j = (this.j * 16807) % 2147483647; return this.j / 2147483647; }

    burst(p, color, count = 30, speed = 2.5, size = 0.35) {
        const c = this.tmp.set(color);
        for (let k = 0; k < count; k++) {
            const i = this.next;
            this.next = (this.next + 1) % N;
            const a = this.rnd() * Math.PI * 2, b = this.rnd() * 2 - 1, s = speed * (0.4 + this.rnd() * 0.8);
            const r = Math.sqrt(1 - b * b);
            this.pos.set([p.x, p.y, p.z], i * 3);
            this.vel.set([Math.cos(a) * r * s, b * s, Math.sin(a) * r * s * 0.5 + 0.4], i * 3);
            this.life[i] = 0.6 + this.rnd() * 0.6;
            this.col.set([c.r, c.g, c.b], i * 3);
            this.size[i] = size * (0.5 + this.rnd());
        }
    }

    /** A beam from a to b in `color`, fading over `dur` seconds. */
    beam(a, b, color, width = 0.06, dur = 0.35) {
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const m = new THREE.Mesh(this.beamGeo, mat);
        const d = new THREE.Vector3().subVectors(b, a);
        m.position.copy(a);
        m.scale.set(width, d.length(), width);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        this.scene.add(m);
        this.beams.push({ m, t: 0, dur, width });
    }

    frame(dt) {
        for (let i = 0; i < N; i++) {
            if (this.life[i] <= 0) continue;
            this.life[i] -= dt;
            const o = i * 3;
            this.vel[o + 1] -= dt * 1.5;
            this.vel[o] *= 1 - dt * 1.5; this.vel[o + 1] *= 1 - dt * 1.5; this.vel[o + 2] *= 1 - dt * 1.5;
            this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aLife.needsUpdate = true;
        this.geo.attributes.aColor.needsUpdate = true;
        this.geo.attributes.aSize.needsUpdate = true;
        for (let k = this.beams.length - 1; k >= 0; k--) {
            const b = this.beams[k];
            b.t += dt;
            const f = 1 - b.t / b.dur;
            b.m.material.opacity = Math.max(0, f);
            b.m.scale.x = b.m.scale.z = b.width * (0.4 + f);
            if (b.t >= b.dur) { this.scene.remove(b.m); b.m.material.dispose(); this.beams.splice(k, 1); }
        }
    }
}
