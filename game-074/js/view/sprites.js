// One instanced quad batch draws thousands of camera-facing sprites in a single
// call: bullets, shots, beams, sparks, flames, smoke and rings. Shapes are
// signed-distance functions in the fragment shader, so nothing is a texture.
//
// Output is premultiplied: alpha 0 means "add" (glow), alpha 1 means "cover"
// (smoke, a bullet's dark rim). One blend mode does both.

import * as THREE from 'three';

export const SHAPE = { orb: 0, bullet: 1, streak: 2, ring: 3, smoke: 4, dart: 5, star: 6, flame: 7, soul: 8, needle: 9, beam: 10, shard: 11 };

const VS = `
attribute vec3 aPos; attribute vec2 aScale; attribute float aRot; attribute vec4 aCol; attribute float aShape;
varying vec2 vUv; varying vec4 vCol; varying float vShape; varying vec2 vScale;
void main(){
  vUv = position.xy * 2.0;
  float c = cos(aRot), s = sin(aRot);
  vec2 p = position.xy * aScale;
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
  vCol = aCol; vShape = aShape; vScale = aScale;
}`;

const FS = `
precision highp float;
varying vec2 vUv; varying vec4 vCol; varying float vShape; varying vec2 vScale;
uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  float d = length(uv);
  vec3 col = vCol.rgb; float a = vCol.a;
  vec3 rgb = vec3(0.0); float cover = 0.0;
  int s = int(vShape + 0.5);
  if (s == 0) {                         // soft glow orb
    float g = exp(-d * d * 3.5);
    rgb = col * g * a;
  } else if (s == 1 || s == 9 || s == 11) {   // enemy bullet: white core, colour body, dark rim, outer glow
    vec2 q = uv;
    if (s == 9) q.x *= 0.55;                  // needles are stretched by aScale; keep the core round-ish
    float dd = length(q);
    if (s == 11) dd = max(abs(q.x) * 0.8 + abs(q.y) * 0.9, dd * 0.7);
    float rim = smoothstep(1.0, 0.86, dd);
    float body = smoothstep(0.78, 0.62, dd);
    float core = smoothstep(0.42, 0.24, dd);
    vec3 c = mix(col * 0.08, col * 1.7, body) + vec3(1.0) * core * 0.9;
    rgb = c * rim * a;
    cover = rim * a * 0.9;
    rgb += col * exp(-dd * dd * 1.8) * 0.35 * a;
  } else if (s == 2 || s == 10) {           // streak / beam: bright along the long axis
    float y = abs(uv.y), x = abs(uv.x);
    float ends = smoothstep(1.0, 0.7, x);
    float body = exp(-y * y * 3.0);
    float core = exp(-y * y * 30.0);
    if (s == 10) {
      float flow = 0.75 + 0.25 * sin(uv.x * 9.0 - uTime * 40.0);
      body *= flow;
      ends = smoothstep(1.0, 0.8, x);
    }
    rgb = (col * body + vec3(1.0) * core * 0.9) * ends * a;
  } else if (s == 3) {                  // ring / shockwave
    float r = exp(-pow((d - 0.78) * 9.0, 2.0));
    rgb = col * r * a;
  } else if (s == 4) {                  // smoke: covers
    float n = h(floor(uv * 3.0 + vCol.a * 7.0));
    float m = smoothstep(1.0, 0.2, d + n * 0.15);
    cover = m * a * 0.75;
    rgb = col * cover;
  } else if (s == 5) {                  // player dart: a sharp feather of light, tip at +x
    float t = uv.x * 0.5 + 0.5;
    float w = mix(0.18, 1.0, smoothstep(0.0, 0.62, t)) * (1.0 - smoothstep(0.78, 1.0, t));
    float y = abs(uv.y);
    float m = smoothstep(w, w * 0.35, y) * smoothstep(0.0, 0.25, t);
    float core = smoothstep(0.22, 0.0, y) * smoothstep(0.05, 0.6, t) * (1.0 - smoothstep(0.85, 1.0, t));
    rgb = (col * m * 0.9 + vec3(1.0) * core) * a;
  } else if (s == 6) {                  // four-point star spark
    float st = max(0.0, 1.0 - abs(uv.x * uv.y) * 14.0 - d * 0.8);
    rgb = (col + 0.4) * st * a + col * exp(-d * d * 6.0) * 0.6 * a;
  } else if (s == 7) {                  // flame
    vec2 q = uv; q.y += 0.25;
    float f = length(vec2(q.x * (1.2 + q.y * 0.6), q.y * 0.8));
    float n = h(floor(vec2(uv.x * 4.0, uv.y * 4.0 - uTime * 18.0)));
    float m = smoothstep(1.0, 0.25, f + n * 0.25);
    vec3 c = mix(col, vec3(1.0, 0.95, 0.7), smoothstep(0.6, 0.0, f));
    rgb = c * m * a;
  } else if (s == 8) {                  // soul: wisp with a tail behind (uv.x < 0)
    float head = exp(-d * d * 6.0);
    float tail = exp(-uv.y * uv.y * 10.0) * smoothstep(-1.0, 0.0, uv.x) * smoothstep(0.4, -0.2, uv.x);
    float rim = smoothstep(0.55, 0.42, d);
    rgb = (col * (head + tail * 0.6) + vec3(1.0) * smoothstep(0.25, 0.0, d) * 0.9) * a;
    cover = rim * a * 0.6;
    rgb = mix(rgb, col * 0.05, cover * (1.0 - smoothstep(0.32, 0.45, d)) * 0.0);
  }
  gl_FragColor = vec4(rgb, cover);
}`;

export class Sprites {
    constructor(max = 4096, renderOrder = 10, depthTest = true) {
        this.max = max;
        this.n = 0;
        const quad = new THREE.PlaneGeometry(1, 1);
        const g = new THREE.InstancedBufferGeometry();
        g.index = quad.index;
        g.setAttribute('position', quad.attributes.position);
        const mk = (k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * k), k); a.setUsage(THREE.DynamicDrawUsage); return a; };
        this.aPos = mk(3); this.aScale = mk(2); this.aRot = mk(1); this.aCol = mk(4); this.aShape = mk(1);
        g.setAttribute('aPos', this.aPos); g.setAttribute('aScale', this.aScale); g.setAttribute('aRot', this.aRot);
        g.setAttribute('aCol', this.aCol); g.setAttribute('aShape', this.aShape);
        g.instanceCount = 0;
        this.uniforms = { uTime: { value: 0 } };
        const mat = new THREE.ShaderMaterial({
            vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms,
            transparent: true, depthWrite: false, depthTest,
            blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
            blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        });
        this.mesh = new THREE.Mesh(g, mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = renderOrder;
        this.geo = g;
    }

    begin() { this.n = 0; }

    /** Add one sprite. size: world units (w, h); col: THREE.Color or [r,g,b]; a: brightness/opacity. */
    add(x, y, z, w, h, rot, r, g, b, a, shape) {
        if (this.n >= this.max) return;
        const i = this.n++;
        this.aPos.array[i * 3] = x; this.aPos.array[i * 3 + 1] = y; this.aPos.array[i * 3 + 2] = z;
        this.aScale.array[i * 2] = w; this.aScale.array[i * 2 + 1] = h;
        this.aRot.array[i] = rot;
        this.aCol.array[i * 4] = r; this.aCol.array[i * 4 + 1] = g; this.aCol.array[i * 4 + 2] = b; this.aCol.array[i * 4 + 3] = a;
        this.aShape.array[i] = shape;
    }

    end(time) {
        this.geo.instanceCount = this.n;
        for (const a of [this.aPos, this.aScale, this.aRot, this.aCol, this.aShape]) {
            a.needsUpdate = true;
            a.clearUpdateRanges();
            a.addUpdateRange(0, this.n * a.itemSize);
        }
        this.uniforms.uTime.value = time;
    }
}
