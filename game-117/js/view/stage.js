// The renderer and its post-processing: scene → bloom → the film pass → ACES and sRGB.
//
// The film pass is where the 1968 look lives: a soft halation around highlights, a gentle
// Technicolor-ish grade, grain, a vignette, a touch of lens fringing at the edges, impact flashes,
// and the slit-scan star gate: two planes of streaming coloured light rushing out of a horizon,
// drawn entirely in the shader and faded in over the scene while the sim warps.
// Bloom's threshold sits above 1, so only lights (bolts, beacons, the sun, wall strips) glow.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { roundBloom } from '../../../lib/round-bloom.js';

const Film = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) },
        uAberr: { value: 0 }, uVig: { value: 0.9 }, uGrain: { value: 0.035 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
        uFade: { value: 1 }, uGate: { value: 0 }, uGateT: { value: 0 }, uHurt: { value: 0 }, uBars: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
uniform sampler2D tDiffuse; uniform float uTime, uAberr, uVig, uGrain, uFade, uGate, uGateT, uHurt, uBars;
uniform vec4 uFlash; uniform vec2 uRes; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
vec3 hue(float h){ return clamp(abs(mod(h*6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
// One plane of the slit-scan corridor: perspective-divided coordinates streaming toward the viewer.
vec3 slit(vec2 q, float t){
  float a = abs(q.y);
  if (a < 0.002) return vec3(0.0);
  float z = 0.18 / a;                    // depth along the plane
  vec2 s = vec2(q.x * z * 1.6, z + t * 3.2);
  float band = vnoise(vec2(s.x * 3.0, s.y * 0.35)) * 0.7 + vnoise(vec2(s.x * 11.0, s.y * 1.2)) * 0.3;
  band = pow(clamp(band, 0.0, 1.0), 2.2) * 2.2;
  float stripe = smoothstep(0.55, 1.0, sin(s.x * 23.0 + vnoise(vec2(s.y * 0.6, s.x)) * 6.0) * 0.5 + 0.5);
  vec3 col = hue(fract(s.y * 0.045 + s.x * 0.05 + (q.y > 0.0 ? 0.0 : 0.5))) * (band + stripe * 0.9);
  float fog = smoothstep(0.0, 0.25, a) * (1.0 - smoothstep(0.75, 1.4, a));   // dark at the horizon line
  return col * fog * (0.6 + 0.8 * clamp(z * 0.12, 0.0, 1.0));
}
void main(){
  vec2 uv = vUv;
  vec2 q = uv - 0.5;
  // lens fringing grows toward the edges, and with impacts
  float edge = dot(q, q);
  float ab = (uAberr + edge * 1.4) / uRes.x * 2.0;
  vec3 c = vec3(texture2D(tDiffuse, uv + q * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - q * ab).b);
  // grade: cool clean shadows, a little warmth in the highlights, like a 70 mm print
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, c * vec3(0.94, 1.0, 1.06), 1.0 - smoothstep(0.0, 0.35, l));
  c += vec3(0.03, 0.012, -0.01) * smoothstep(0.4, 1.4, l);
  // the star gate
  if (uGate > 0.0) {
    vec2 p = q * vec2(uRes.x / uRes.y, 1.0);
    float rot = sin(uGateT * 0.35) * 0.25;
    p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;
    vec3 g = slit(p, uGateT) + slit(vec2(p.y, p.x) * 1.15, uGateT * 1.1) * smoothstep(1.2, 2.6, uGateT) * 0.8;
    g += vec3(1.0, 0.95, 0.85) * exp(-abs(p.y) * 60.0) * 0.6;       // the glowing horizon slit
    c = mix(c, g, uGate);
  }
  // hurt: a red bloom creeping in from the edges
  c = mix(c, c * vec3(1.0, 0.4, 0.35) + vec3(0.2, 0.0, 0.0) * smoothstep(0.12, 0.4, edge), uHurt * 0.7 * smoothstep(0.08, 0.4, edge));
  c *= 1.0 - edge * uVig;
  c += (hash(vUv * uRes + fract(uTime * 7.13)) - 0.5) * uGrain * (0.35 + l);
  c = mix(c, uFlash.rgb, uFlash.a);
  c *= uFade;
  // letterbox bars for the cards between asteroids
  float bar = uBars * 0.11;
  if (uv.y < bar || uv.y > 1.0 - bar) c = vec3(0.0);
  gl_FragColor = vec4(c, 1.0);
}`,
};

export class Stage {
    constructor(canvas, quality = 2) {
        this.canvas = canvas;
        this.quality = quality;
        const gl = this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
        gl.shadowMap.enabled = quality > 0;
        gl.shadowMap.type = THREE.PCFShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setClearColor(0x000000);
        this.w = 0; this.h = 0;
        this.flashA = 0; this.aberr = 0; this.fade = 1; this.gate = 0; this.gateT = 0; this.hurt = 0; this.bars = 0;
    }

    setScene(scene, camera) {
        this.scene = scene; this.camera = camera;
        const size = this.gl.getSize(new THREE.Vector2());
        const rt = new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), { type: THREE.HalfFloatType, samples: this.quality > 1 ? 4 : 0 });
        this.composer = new EffectComposer(this.gl, rt);
        this.renderPass = new RenderPass(scene, camera);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.55, 0.5, 1.35);
        roundBloom(this.bloom);
        this.film = new ShaderPass(Film);
        this.output = new OutputPass();
        for (const p of [this.renderPass, this.bloom, this.film, this.output]) this.composer.addPass(p);
        this.bloom.enabled = this.quality > 0;
        this.resize(size.x, size.y, true);
    }

    setQuality(q) {
        this.quality = q;
        this.gl.shadowMap.enabled = q > 0;
        if (this.bloom) this.bloom.enabled = q > 0;
        this.resize(this.w, this.h, true);
    }

    resize(w, h, force = false) {
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = window.devicePixelRatio || 1;
        const pr = [Math.min(dpr, 1), Math.min(dpr, 1.5), Math.min(dpr, 2)][this.quality] || 1;
        this.gl.setPixelRatio(pr);
        this.gl.setSize(w, h, false);
        // CSS size in px from the visual viewport: never 100vw / 100vh
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        if (this.composer) {
            this.composer.setPixelRatio(pr);
            this.composer.setSize(w, h);
            this.bloom.resolution.set((w * pr) / 2, (h * pr) / 2);
        }
        this.film?.uniforms.uRes.value.set(w * pr, h * pr);
        if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    }

    flash(r, g, b, a) { this.film.uniforms.uFlash.value.set(r, g, b, 0); this.flashA = Math.max(this.flashA, a); }
    kickAberr(a) { this.aberr = Math.min(10, this.aberr + a); }

    render(dt, time) {
        if (!this.composer) return;
        const u = this.film.uniforms;
        u.uTime.value = time;
        this.flashA = Math.max(0, this.flashA - dt * 2.2);
        u.uFlash.value.w = this.flashA;
        this.aberr = Math.max(0, this.aberr - dt * 8);
        u.uAberr.value = this.aberr;
        u.uFade.value = this.fade;
        u.uGate.value = this.gate;
        u.uGateT.value = this.gateT;
        u.uHurt.value = this.hurt;
        u.uBars.value = this.bars;
        this.composer.render(dt);
    }
}
