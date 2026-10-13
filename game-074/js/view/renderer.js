// Renderer, camera and the post chain:
//   scene → UnrealBloom → final grade (heat shimmer, chromatic aberration,
//   colour grade, vignette, grain, screen flashes, fade) → output (ACES + sRGB).
//
// The camera is a 40° perspective camera placed so the z = 0 plane shows the
// 32 × 18 playfield exactly; everything with depth parallaxes naturally.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, H } from '../config.js';

export const FOV = 40;
export const CAM_D = (H / 2) / Math.tan((FOV / 2) * Math.PI / 180);

const FinalShader = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uHeat: { value: 0 }, uAberr: { value: 0.0 },
        uGrade: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: 0.9 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
        uFade: { value: 1 }, uGrain: { value: 0.025 }, uRes: { value: new THREE.Vector2(1280, 720) }, uDesat: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
uniform sampler2D tDiffuse; uniform float uTime, uHeat, uAberr, uVig, uFade, uGrain, uDesat; uniform vec3 uGrade; uniform vec4 uFlash; uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  if (uHeat > 0.0) {
    float w = sin(uv.y * 42.0 + uTime * 3.1) * sin(uv.x * 23.0 - uTime * 2.3);
    uv.x += w * 0.0016 * uHeat * (1.0 - uv.y);
    uv.y += cos(uv.x * 37.0 + uTime * 2.7) * 0.0011 * uHeat * (1.0 - uv.y);
  }
  vec3 c;
  if (uAberr > 0.0) {
    vec2 d = (uv - 0.5) * uAberr / uRes.x * 2.0;
    c = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
  } else c = texture2D(tDiffuse, uv).rgb;
  c *= uGrade;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(l), uDesat);
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * uVig;
  c += (hash(vUv * uRes + fract(uTime)) - 0.5) * uGrain * (0.3 + l);
  c = mix(c, uFlash.rgb, uFlash.a);
  c *= uFade;
  gl_FragColor = vec4(c, 1.0);
}`,
};

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        const gl = this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, W / H, 0.5, 700);
        this.camera.position.set(W / 2, H / 2, CAM_D);
        this.camera.lookAt(W / 2, H / 2, 0);
        this.base = new THREE.Vector3(W / 2, H / 2, CAM_D);
        this.look = new THREE.Vector3(W / 2, H / 2, 0);

        this.composer = new EffectComposer(gl);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.85, 0.55, 0.78);
        this.final = new ShaderPass(FinalShader);
        this.output = new OutputPass();
        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.bloom);
        this.composer.addPass(this.final);
        this.composer.addPass(this.output);

        this.shake = 0; this.flashA = 0; this.aberr = 0; this.fade = 1;
        this.quality = 0;   // 0 high, 1 medium, 2 low
        this.w = 0; this.h = 0;
        this.bloomBase = 0.85;
    }

    setQuality(q) {
        this.quality = q;
        this.resize(this.w, this.h, true);
    }

    resize(w, h, force = false) {
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = window.devicePixelRatio || 1;
        const pr = [Math.min(dpr, 2), Math.min(dpr, 1.25), Math.min(dpr, 1) * 0.75][this.quality];
        this.gl.setPixelRatio(pr);
        this.gl.setSize(w, h, false);
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.enabled = this.quality < 2;
        this.final.uniforms.uRes.value.set(w * pr, h * pr);
    }

    setLook(look) {
        this.gl.toneMappingExposure = look.exposure;
        this.bloomBase = look.bloom;
        this.final.uniforms.uHeat.value = look.heat;
        this.final.uniforms.uGrade.value.set(...look.grade);
    }

    kick(amount) { this.shake = Math.min(1.2, this.shake + amount); }
    flash(r, g, b, a) { this.final.uniforms.uFlash.value.set(r, g, b, 0); this.flashA = Math.max(this.flashA, a); }

    render(dt, time, shakeOn = true) {
        const u = this.final.uniforms;
        u.uTime.value = time;
        this.flashA = Math.max(0, this.flashA - dt * 2.2);
        u.uFlash.value.w = this.flashA;
        this.aberr = Math.max(0, this.aberr - dt * 6);
        u.uAberr.value = Math.min(6, this.aberr * 0.6 + this.shake * 0.8);
        u.uFade.value = this.fade;
        this.bloom.strength = this.bloomBase;
        this.shake = Math.max(0, this.shake - dt * 2.4);
        const s = shakeOn ? this.shake * this.shake * 0.5 : 0;
        const cam = this.camera;
        cam.position.set(this.base.x + (Math.random() - 0.5) * s, this.base.y + (Math.random() - 0.5) * s, this.base.z);
        cam.lookAt(this.look.x + (Math.random() - 0.5) * s * 0.3, this.look.y, this.look.z);
        this.composer.render(dt);
    }
}
