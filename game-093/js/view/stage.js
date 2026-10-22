// The renderer and its post-processing: scene → tilt-shift (the diorama blur) → bloom → grade, vignette, grain, flashes and the
// battle swirl → ACES tone mapping. Everything about the HD-2D look that isn't geometry happens here.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TiltShift = {
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1280, 720) }, uFocus: { value: 0.5 }, uRange: { value: 0.16 }, uBlur: { value: 3.2 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uRange, uBlur; varying vec2 vUv;
void main(){
  float d = abs(vUv.y - uFocus);
  float k = smoothstep(uRange, uRange + 0.34, d);
  float r = k * uBlur;
  vec4 c = texture2D(tDiffuse, vUv);
  if (r < 0.35) { gl_FragColor = c; return; }
  vec3 sum = c.rgb; float wsum = 1.0;
  for (int i = 1; i <= 12; i++) {
    float a = float(i) * 2.39996; float rad = sqrt(float(i) / 12.0) * r;
    vec2 o = vec2(cos(a), sin(a)) * rad / uRes;
    vec4 s = texture2D(tDiffuse, vUv + o);
    float w = 1.0 + max(0.0, dot(s.rgb, vec3(0.3333)) - 1.0) * 1.5;   // bright bits bloom out into bokeh
    sum += s.rgb * w; wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}`,
};

const Final = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) }, uAberr: { value: 0 }, uVig: { value: 0.75 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
        uFade: { value: 1 }, uGrain: { value: 0.03 }, uSwirl: { value: 0 }, uPix: { value: 0 }, uWarm: { value: 0 }, uDusk: { value: 0 }, uDesat: { value: 0 }, uPulse: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAberr, uVig, uFade, uGrain, uSwirl, uPix, uWarm, uDusk, uDesat, uPulse; uniform vec4 uFlash; uniform vec2 uRes; uniform vec3 uTint; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  vec2 q0 = uv - 0.5;
  if (uSwirl > 0.0) {
    float r = length(q0 * vec2(uRes.x / uRes.y, 1.0));
    float a = uSwirl * uSwirl * 9.0 * (1.0 - smoothstep(0.0, 0.9, r));
    float s = sin(a), c = cos(a);
    q0 = mat2(c, -s, s, c) * q0;
    q0 *= 1.0 - uSwirl * 0.55;
    uv = q0 + 0.5;
  }
  if (uPix > 0.0) { float cell = mix(1.0, 60.0, uPix); vec2 g = vec2(cell * uRes.x / uRes.y, cell); uv = (floor(uv * g) + 0.5) / g; }
  vec3 c;
  if (uAberr > 0.0) { vec2 d = (uv - 0.5) * uAberr / uRes.x * 2.0; c = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b); }
  else c = texture2D(tDiffuse, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // the Long Dusk: colour drains toward a cold violet, the lights stay warm
  c = mix(c, vec3(l) * vec3(1.0, 0.92, 1.05), uDesat + uDusk * 0.3);
  c *= uTint;
  c += vec3(0.08, 0.035, -0.02) * uWarm * l;
  c = mix(c, c * vec3(1.06, 0.9, 1.1), uDusk * 0.5);
  vec2 q = vUv - 0.5;
  float v = dot(q, q);
  c *= 1.0 - v * uVig;
  c = mix(c, c * vec3(1.0, 0.4, 0.4) + vec3(0.18, 0.0, 0.0) * smoothstep(0.05, 0.3, v), uPulse * smoothstep(0.02, 0.28, v));
  c += (hash(vUv * uRes + fract(uTime)) - 0.5) * uGrain * (0.25 + l);
  c = mix(c, uFlash.rgb, uFlash.a);
  c *= uFade;
  gl_FragColor = vec4(c, 1.0);
}`,
};

export class Stage {
    constructor(canvas, quality = 2) {
        this.canvas = canvas; this.quality = quality;
        const gl = this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
        gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.outputColorSpace = THREE.SRGBColorSpace;
        this.w = 0; this.h = 0; this.scene = null; this.camera = null;
        this.composer = null;
        this.shake = 0; this.flashA = 0; this.aberr = 0; this.fade = 1; this.swirl = 0; this.pix = 0; this.pulse = 0;
        this.bloomBase = 0.42; this.focus = 0.5;
    }

    setScene(scene, camera) {
        this.scene = scene; this.camera = camera;
        const gl = this.gl;
        const size = gl.getSize(new THREE.Vector2());
        const rt = new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), { type: THREE.HalfFloatType, samples: this.quality > 1 ? 4 : 0 });
        this.composer = new EffectComposer(gl, rt);
        this.renderPass = new RenderPass(scene, camera);
        this.tilt = new ShaderPass(TiltShift);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.42, 0.7, 1.05);
        this.final = new ShaderPass(Final);
        this.output = new OutputPass();
        for (const p of [this.renderPass, this.tilt, this.bloom, this.final, this.output]) this.composer.addPass(p);
        this.bloom.enabled = this.quality > 0; this.tilt.enabled = this.quality > 0;
        this.w = 0; this.resize(size.x, size.y, true);
    }

    use(scene, camera) {
        this.scene = scene; this.camera = camera;
        if (this.renderPass) { this.renderPass.scene = scene; this.renderPass.camera = camera; }
        camera.aspect = this.w / Math.max(1, this.h); camera.updateProjectionMatrix();
    }

    resize(w, h, force = false) {
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = window.devicePixelRatio || 1;
        const pr = [Math.min(dpr, 1), Math.min(dpr, 1.35), Math.min(dpr, 2)][this.quality];
        this.gl.setPixelRatio(pr); this.gl.setSize(w, h, false);
        this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
        if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
        const u = this.final?.uniforms; if (u) u.uRes.value.set(w * pr, h * pr);
        if (this.tilt) this.tilt.uniforms.uRes.value.set(w * pr, h * pr);
        if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    }

    kick(a) { this.shake = Math.min(1.4, this.shake + a); }
    flash(r, g, b, a) { this.final.uniforms.uFlash.value.set(r, g, b, 0); this.flashA = Math.max(this.flashA, a); }

    render(dt, time, o = {}) {
        if (!this.composer) return;
        if (this.direct) { this.gl.render(this.scene, this.camera); return; }
        const u = this.final.uniforms;
        u.uTime.value = time;
        this.flashA = Math.max(0, this.flashA - dt * 2.4); u.uFlash.value.w = this.flashA;
        this.aberr = Math.max(0, this.aberr - dt * 6);
        u.uAberr.value = Math.min(7, this.aberr * 0.7 + this.shake * 1.2);
        u.uFade.value = this.fade; u.uSwirl.value = this.swirl; u.uPix.value = this.pix; u.uPulse.value = this.pulse;
        u.uWarm.value = o.warm ?? 0; u.uDusk.value = o.dusk ?? 0; u.uDesat.value = o.desat ?? 0; u.uVig.value = o.vig ?? 0.75;
        u.uTint.value.set(...(o.tint || [1, 1, 1]));
        this.bloom.strength = (o.bloom ?? this.bloomBase);
        this.tilt.uniforms.uFocus.value = o.focus ?? this.focus; this.tilt.uniforms.uRange.value = o.range ?? 0.16; this.tilt.uniforms.uBlur.value = (o.blur ?? 3.2) * (this.h / 720);
        this.gl.toneMappingExposure = o.exposure ?? 1.05;
        this.shake = Math.max(0, this.shake - dt * 2.6);
        this.composer.render(dt);
    }
}
