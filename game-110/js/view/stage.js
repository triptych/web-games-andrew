// The renderer and its post-processing: scene → tilt-shift (the diorama blur) → bloom → grade → output.
// The grade follows the Overlord's reputation: a cosy, rosy wash when dread is low, a cold violet menace when it's high.
// Adapted from game-093's stage.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const TiltShift = {
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1280, 720) }, uFocus: { value: 0.5 }, uRange: { value: 0.2 }, uBlur: { value: 3 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uRange, uBlur; varying vec2 vUv;
void main(){
  float d = abs(vUv.y - uFocus);
  float r = smoothstep(uRange, uRange + 0.32, d) * uBlur;
  vec4 c = texture2D(tDiffuse, vUv);
  if (r < 0.35) { gl_FragColor = c; return; }
  vec3 sum = c.rgb; float wsum = 1.0;
  for (int i = 1; i <= 10; i++) {
    float a = float(i) * 2.39996; float rad = sqrt(float(i) / 10.0) * r;
    vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rad / uRes).rgb;
    float w = 1.0 + clamp(dot(s, vec3(0.3333)) - 1.0, 0.0, 4.0) * 1.5;
    sum += s * w; wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}`,
};

const Grade = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) }, uDread: { value: 0.5 },
        uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uVig: { value: 0.9 }, uFade: { value: 1 }, uFrenzy: { value: 0 },
    },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uDread, uVig, uFade, uFrenzy; uniform vec4 uFlash; uniform vec2 uRes; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = clamp(texture2D(tDiffuse, vUv).rgb, 0.0, 64.0);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // cosy: warm and rosy, a little lifted; dreadful: cooler, violet shadows, deeper contrast
  float cozy = clamp(1.0 - uDread * 1.6, 0.0, 1.0);
  float evil = clamp((uDread - 0.55) / 0.45, 0.0, 1.0);
  c = mix(c, c * vec3(1.08, 0.97, 1.0) + vec3(0.035, 0.012, 0.025), cozy);
  c = mix(c, mix(vec3(l) * vec3(0.92, 0.85, 1.15), c, 0.75) * vec3(0.98, 0.93, 1.08), evil * 0.6);
  c += vec3(0.05, 0.035, 0.0) * uFrenzy * (0.4 + l);
  vec2 q = vUv - 0.5;
  float v = dot(q, q);
  c *= 1.0 - v * (uVig + evil * 0.5);
  c += (hash(vUv * uRes + fract(uTime)) - 0.5) * 0.025 * (0.3 + l);
  c = mix(c, uFlash.rgb, clamp(uFlash.a, 0.0, 1.0));
  c *= uFade;
  gl_FragColor = vec4(c, 1.0);
}`,
};

export class Stage {
    constructor(canvas, quality = 2) {
        this.canvas = canvas;
        this.quality = quality;
        const gl = this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        this.w = 0; this.h = 0;
        this.flashA = 0;
        this.shake = 0;
    }

    setScene(scene, camera) {
        this.scene = scene; this.camera = camera;
        const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: this.quality > 1 ? 4 : 0 });
        this.composer = new EffectComposer(this.gl, rt);
        this.renderPass = new RenderPass(scene, camera);
        this.tilt = new ShaderPass(TiltShift);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.6, 0.92);
        this.grade = new ShaderPass(Grade);
        this.output = new OutputPass();
        for (const p of [this.renderPass, this.tilt, this.bloom, this.grade, this.output]) this.composer.addPass(p);
        this.setQuality(this.quality);
    }

    setQuality(q) {
        this.quality = q;
        if (!this.composer) return;
        this.tilt.enabled = q > 0;
        this.bloom.enabled = q > 0;
        this.w = 0;
    }

    resize(w, h) {
        if (w === this.w && h === this.h) return false;
        this.w = w; this.h = h;
        const dpr = window.devicePixelRatio || 1;
        const pr = [Math.min(dpr, 1), Math.min(dpr, 1.5), Math.min(dpr, 2)][this.quality];
        this.pr = pr;
        this.gl.setPixelRatio(pr);
        this.gl.setSize(w, h, false);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        if (this.composer) {
            this.composer.setPixelRatio(pr);
            this.composer.setSize(w, h);
            this.grade.uniforms.uRes.value.set(w * pr, h * pr);
            this.tilt.uniforms.uRes.value.set(w * pr, h * pr);
        }
        return true;
    }

    flash(r, g, b, a) { this.grade.uniforms.uFlash.value.set(r, g, b, 0); this.flashA = Math.max(this.flashA, a); }
    kick(a) { this.shake = Math.min(1.2, this.shake + a); }

    render(dt, time, o = {}) {
        const u = this.grade.uniforms;
        u.uTime.value = time;
        this.flashA = Math.max(0, this.flashA - dt * 3);
        u.uFlash.value.w = this.flashA;
        u.uDread.value = o.dread ?? 0.5;
        u.uFrenzy.value = o.frenzy ?? 0;
        u.uFade.value = o.fade ?? 1;
        this.tilt.uniforms.uFocus.value = o.focus ?? 0.5;
        this.tilt.uniforms.uRange.value = o.range ?? 0.2;
        this.tilt.uniforms.uBlur.value = (o.blur ?? 3) * (this.h / 720);
        this.bloom.strength = o.bloom ?? 0.55;
        this.shake = Math.max(0, this.shake - dt * 2.5);
        this.composer.render(dt);
    }
}
