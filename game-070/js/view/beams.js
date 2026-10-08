// Beams: the only primitive this game draws. One instance = one line segment of
// light (two 3D endpoints, a colour, a brightness and a width in logical units).
// The vertex shader projects both ends, then builds a screen-space quad around
// the segment wide enough for the halo; the fragment shader shades it with the
// distance to the segment: a white-hot core inside a coloured glow. A segment
// whose ends meet is a round dot. Additive blending, so crossings add up the way
// they do on a vector CRT.

import * as THREE from 'three';

const VS = `
attribute vec2 corner;
attribute vec3 aA;
attribute vec3 aB;
attribute vec4 aCol;
attribute float aW;
uniform vec2 uRes;
uniform float uUnit;
uniform float uD;
varying vec3 vCol;
varying vec2 vP;
varying float vLen;
varying float vHw;
void main() {
    vec4 ca = projectionMatrix * modelViewMatrix * vec4(aA, 1.0);
    vec4 cb = projectionMatrix * modelViewMatrix * vec4(aB, 1.0);
    ca.w = max(ca.w, 1e-3); cb.w = max(cb.w, 1e-3);
    vec2 sa = ca.xy / ca.w * 0.5 * uRes;
    vec2 sb = cb.xy / cb.w * 0.5 * uRes;
    float persp = uD / (0.5 * (ca.w + cb.w));
    float hw = max(0.55, 0.5 * aW * uUnit * persp);
    vec2 d = sb - sa;
    float len = length(d);
    vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float R = hw * 3.2 + 1.5;
    vec2 p = mix(sa, sb, corner.x) + dir * (corner.x * 2.0 - 1.0) * R + nrm * corner.y * R;
    vP = vec2(corner.x * (len + 2.0 * R) - R, corner.y * R);
    vLen = len;
    vHw = hw;
    // a dim beam of a small width still has to read: brightness tracks width a little
    vCol = aCol.rgb * aCol.a;
    gl_Position = vec4(p / (0.5 * uRes), 0.0, 1.0);
}`;

const FS = `
varying vec3 vCol;
varying vec2 vP;
varying float vLen;
varying float vHw;
void main() {
    float u = clamp(vP.x, 0.0, vLen);
    float d = length(vec2(vP.x - u, vP.y));
    float core = exp(-(d * d) / (vHw * vHw * 0.55));
    float halo = exp(-d / (vHw * 1.35)) * 0.42;
    vec3 c = vCol * (core * 1.05 + halo) + vec3(core * core) * 0.55 * max(vCol.r, max(vCol.g, vCol.b));
    gl_FragColor = vec4(c, 1.0);
}`;

export class Beams {
    constructor(capacity, isOrtho = false) {
        this.cap = capacity;
        this.n = 0;
        const g = this.geo = new THREE.InstancedBufferGeometry();
        // quad: corner.x picks the endpoint, corner.y the side
        const corners = new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]);
        g.setAttribute('corner', new THREE.BufferAttribute(corners, 2));
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        this.A = new Float32Array(capacity * 3);
        this.B = new Float32Array(capacity * 3);
        this.C = new Float32Array(capacity * 4);
        this.Wd = new Float32Array(capacity);
        const mk = (arr, size) => {
            const a = new THREE.InstancedBufferAttribute(arr, size);
            a.setUsage(THREE.DynamicDrawUsage);
            return a;
        };
        g.setAttribute('aA', this.aA = mk(this.A, 3));
        g.setAttribute('aB', this.aB = mk(this.B, 3));
        g.setAttribute('aCol', this.aC = mk(this.C, 4));
        g.setAttribute('aW', this.aW = mk(this.Wd, 1));
        g.instanceCount = 0;
        this.mat = new THREE.ShaderMaterial({
            vertexShader: VS, fragmentShader: FS,
            uniforms: { uRes: { value: new THREE.Vector2(800, 600) }, uUnit: { value: 2 }, uD: { value: 1 } },
            blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
        });
        this.isOrtho = isOrtho;
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        // state used by the drawing helpers
        this.r = 1; this.g = 1; this.b = 1; this.i = 1; this.w = 1;
        this.z = 0;
    }

    setView(resX, resY, unit, camDist) {
        this.mat.uniforms.uRes.value.set(resX, resY);
        this.mat.uniforms.uUnit.value = unit;
        this.mat.uniforms.uD.value = this.isOrtho ? 1 : camDist;
    }

    begin() { this.n = 0; }

    /** Current pen: colour [r,g,b], brightness, width. */
    pen(col, i = 1, w = 1) { this.r = col[0]; this.g = col[1]; this.b = col[2]; this.i = i; this.w = w; return this; }

    seg3(ax, ay, az, bx, by, bz) {
        const n = this.n;
        if (n >= this.cap) return;
        const a3 = n * 3, c4 = n * 4;
        const A = this.A, B = this.B, C = this.C;
        A[a3] = ax; A[a3 + 1] = ay; A[a3 + 2] = az;
        B[a3] = bx; B[a3 + 1] = by; B[a3 + 2] = bz;
        C[c4] = this.r; C[c4 + 1] = this.g; C[c4 + 2] = this.b; C[c4 + 3] = this.i;
        this.Wd[n] = this.w;
        this.n = n + 1;
    }

    seg(ax, ay, bx, by) { this.seg3(ax, ay, this.z, bx, by, this.z); }
    dot(x, y) { this.seg3(x, y, this.z, x, y, this.z); }

    /** Polyline from a flat array [x0,y0,x1,y1,...]; closed joins the ends. */
    poly(pts, closed = false) {
        for (let k = 0; k + 3 < pts.length; k += 2) this.seg(pts[k], pts[k + 1], pts[k + 2], pts[k + 3]);
        if (closed && pts.length >= 6) this.seg(pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1]);
    }

    circle(x, y, r, n = 20, a0 = 0) {
        let px = x + Math.cos(a0) * r, py = y + Math.sin(a0) * r;
        for (let k = 1; k <= n; k++) {
            const a = a0 + (k / n) * Math.PI * 2;
            const qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
            this.seg(px, py, qx, qy);
            px = qx; py = qy;
        }
    }

    end() {
        const n = this.n;
        this.geo.instanceCount = n;
        for (const a of [this.aA, this.aB, this.aC, this.aW]) {
            a.clearUpdateRanges();
            a.addUpdateRange(0, n * a.itemSize);
            a.needsUpdate = true;
        }
    }
}
