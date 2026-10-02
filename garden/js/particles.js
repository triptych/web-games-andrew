// Point-sprite effects animated entirely on the GPU: statue glows, magic
// motes rising from the statues, fireflies at dusk, petals drifting from the
// great tree, fountain spray and the hub's projector sparks.

import * as THREE from 'three';
import { rng, TAU } from './util.js';
import { glowSprite } from './textures.js';

const vert = /* glsl */ `
uniform float uTime, uNight, uScale;
attribute vec3 aColor;
attribute vec4 aParams; // size, phase, speed, mode
attribute vec3 aExtent; // per-mode extra (radius / height)
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec3 p = position;
  float size = aParams.x, ph = aParams.y, sp = aParams.z;
  int mode = int(aParams.w + 0.5);
  float t = uTime * sp + ph;
  float a = 1.0;
  if (mode == 0) {            // pulsing glow
    size *= 0.85 + 0.15 * sin(t * 2.0);
    a = 0.55 + 0.45 * uNight;
  } else if (mode == 1) {     // firefly
    p += vec3(sin(t * 0.7) * 1.6 + sin(t * 1.9) * 0.4, sin(t * 1.3) * 0.5 + 0.3, cos(t * 0.6) * 1.6 + cos(t * 2.3) * 0.3);
    a = uNight * smoothstep(0.2, 1.0, sin(t * 3.0 + ph * 7.0) * 0.5 + 0.5);
  } else if (mode == 2) {     // rising mote
    float k = fract(t * 0.12);
    p.y += k * aExtent.y;
    p.x += sin(t * 1.3) * aExtent.x * (0.3 + k);
    p.z += cos(t * 1.1) * aExtent.x * (0.3 + k);
    a = sin(k * 3.14159) * (0.45 + 0.55 * uNight);
  } else if (mode == 3) {     // falling petal
    float k = fract(t * 0.05);
    p.y -= k * aExtent.y;
    p.x += sin(t * 0.9) * 1.4 + k * 3.0;
    p.z += cos(t * 0.7) * 1.4;
    a = smoothstep(0.0, 0.1, k) * smoothstep(1.0, 0.85, k) * 0.9;
  } else if (mode == 4) {     // fountain arc
    float k = fract(t * 0.6);
    float ang = ph * 6.2831;
    float r = aExtent.x * k;
    p += vec3(cos(ang) * r, 1.6 * k * 2.2 - 4.9 * k * k * 0.9, sin(ang) * r);
    a = (1.0 - k) * 0.8;
  } else if (mode == 5) {     // projector spark spiralling up the beam
    float k = fract(t * 0.25);
    float ang = ph * 6.2831 + t * 1.5;
    float r = aExtent.x * (1.0 - k * 0.6);
    p += vec3(cos(ang) * r, k * aExtent.y, sin(ang) * r);
    a = sin(k * 3.14159);
  }
  vColor = aColor;
  vAlpha = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 c = texture2D(uMap, gl_PointCoord);
  if (vAlpha * c.a < 0.01) discard;
  gl_FragColor = vec4(vColor * c.rgb * vAlpha * c.a, 1.0);
  #include <colorspace_fragment>
}`;

export class Particles {
    constructor(world) {
        this.world = world;
        this.items = [];
        this.uniforms = { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 400 }, uMap: { value: glowSprite() } };
    }

    add(x, y, z, color, size, mode, { phase = Math.random() * 10, speed = 1, ex = 0, ey = 0 } = {}) {
        this.items.push({ x, y, z, color: new THREE.Color(color), size, mode, phase, speed, ex, ey });
    }

    build() {
        const world = this.world;
        const r = rng('particles');
        // statue glows and motes
        for (const g of world.statueGlows) {
            this.add(g.x, g.y, g.z, g.color, 0.9 * g.size, 0, { phase: r() * 10 });
        }
        const motes = world.quality.motes;
        for (const st of world.statues) {
            for (let k = 0; k < motes; k++) this.add(st.x + r.range(-0.6, 0.6), st.y + 1.2, st.z + r.range(-0.6, 0.6), st.genre.accent, r.range(0.12, 0.25), 2, { phase: r() * 50, speed: r.range(0.6, 1.2), ex: 0.5, ey: 3.0 });
        }
        // fireflies over the meadows
        const { island } = world;
        const H = island.half - 10;
        let n = 0;
        for (let i = 0; i < 4000 && n < world.quality.fireflies; i++) {
            const x = r.range(-H, H), z = r.range(-H, H);
            if (island.shoreAt(x, z) > -3 || island.heightAt(x, z) < 1) continue;
            this.add(x, island.heightAt(x, z) + r.range(0.4, 1.8), z, r() < 0.8 ? '#d8ff7a' : '#9fffd8', r.range(0.18, 0.3), 1, { phase: r() * 100, speed: r.range(0.5, 1.0) });
            n++;
        }
        for (const p of world.petalSources) {
            for (let k = 0; k < 90; k++) {
                const a = r() * TAU, d = r() * p.r;
                this.add(p.x + Math.cos(a) * d, p.y, p.z + Math.sin(a) * d, r() < 0.5 ? '#ffb3dc' : '#ffe0f0', r.range(0.1, 0.18), 3, { phase: r() * 100, speed: r.range(0.6, 1.1), ey: 9 });
            }
        }
        for (const f of world.fountains) {
            for (let k = 0; k < 120; k++) this.add(f.x, f.y, f.z, '#cfefff', r.range(0.08, 0.14), 4, { phase: r(), speed: r.range(0.8, 1.2), ex: 1.25 });
        }
        for (const a of world.altars) {
            for (let k = 0; k < 40; k++) this.add(a.x, a.y, a.z, '#7fffd4', r.range(0.1, 0.2), 5, { phase: r(), speed: r.range(0.5, 1.0), ex: 0.8, ey: 3.5 });
        }
        for (const s of world.sparkSources) {
            for (let k = 0; k < s.n; k++) this.add(s.x, s.y, s.z, s.color, r.range(0.06, 0.13), 5, { phase: r(), speed: r.range(0.6, 1.2), ex: s.r, ey: s.h });
        }

        const N = this.items.length;
        const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), par = new Float32Array(N * 4), ext = new Float32Array(N * 3);
        this.items.forEach((p, i) => {
            pos.set([p.x, p.y, p.z], i * 3);
            col.set([p.color.r, p.color.g, p.color.b], i * 3);
            par.set([p.size, p.phase, p.speed, p.mode], i * 4);
            ext.set([p.ex, p.ey, 0], i * 3);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aParams', new THREE.BufferAttribute(par, 4));
        g.setAttribute('aExtent', new THREE.BufferAttribute(ext, 3));
        const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        this.points = new THREE.Points(g, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        world.root.add(this.points);
    }

    update(t, night, viewportH) {
        this.uniforms.uTime.value = t;
        this.uniforms.uNight.value = night;
        this.uniforms.uScale.value = viewportH * 0.9;
    }
}

const burstVert = /* glsl */ `
uniform float uTime, uScale;
attribute vec3 aColor;
attribute vec3 aVel;
attribute vec3 aParams; // size, birth, life
varying vec3 vColor;
varying float vAlpha;
void main(){
  float age = uTime - aParams.y;
  float k = age / aParams.z;
  vec3 p = position;
  float a = 0.0;
  if (k > 0.0 && k < 1.0) {
    // a quick outward pop that settles into a slow lift
    p += aVel * (1.0 - exp(-age * 2.5)) * 0.4 + vec3(0.0, age * 0.35, 0.0);
    a = smoothstep(0.0, 0.08, k) * (1.0 - k) * (0.75 + 0.25 * sin(age * 18.0 + aParams.y * 40.0));
  }
  vColor = aColor;
  vAlpha = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = a > 0.0 ? aParams.x * uScale / -mv.z : 0.0;
  gl_Position = projectionMatrix * mv;
}`;

/**
 * One-shot sparkle bursts (the vines waking up). A fixed ring buffer of
 * points: emitting overwrites the oldest slots, and the shader animates each
 * from its birth time, so nothing is touched per frame but the clock.
 */
export class Bursts {
    constructor(world, size = 512) {
        this.size = size;
        this.cursor = 0;
        this.time = 0;
        this.uniforms = { uTime: { value: 0 }, uScale: { value: 400 }, uMap: { value: glowSprite() } };
        const g = new THREE.BufferGeometry();
        const params = new Float32Array(size * 3);
        for (let i = 0; i < size; i++) params[i * 3 + 1] = -1e4; // long dead
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
        g.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
        g.setAttribute('aParams', new THREE.BufferAttribute(params, 3));
        this.geo = g;
        const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: burstVert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        this.points = new THREE.Points(g, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 6;
        world.root.add(this.points);
        this._c = new THREE.Color();
    }

    emit(x, y, z, { vx = 0, vy = 0, vz = 0, color = '#ffffff', size = 0.25, delay = 0, life = 1.6 } = {}) {
        const i = this.cursor;
        this.cursor = (i + 1) % this.size;
        const a = this.geo.attributes;
        a.position.setXYZ(i, x, y, z);
        a.aVel.setXYZ(i, vx, vy, vz);
        const c = this._c.set(color);
        a.aColor.setXYZ(i, c.r, c.g, c.b);
        a.aParams.setXYZ(i, size, this.time + delay, life);
        for (const k of ['position', 'aVel', 'aColor', 'aParams']) a[k].needsUpdate = true;
    }

    update(t, viewportH) {
        this.time = t;
        this.uniforms.uTime.value = t;
        this.uniforms.uScale.value = viewportH * 0.9;
    }
}
