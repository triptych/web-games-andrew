// Renderer, lights and the post chain:
//   RenderPass → UnrealBloom (half-res, high threshold: only magic, lava and highlights glow)
//   → Storybook pass (warm grade, vignette, paper grain, tilt-shift for the map diorama, flash)
//   → OutputPass (sRGB)
// Quality tiers move pixels (pixel ratio, shadow map size, bloom) rather than features.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TOON } from './toon.js';

const StorybookShader = {
    uniforms: {
        tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
        uVignette: { value: 0.32 }, uGrain: { value: 0.035 }, uTilt: { value: 0 }, uTiltY: { value: 0.5 },
        uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color('#ffffff') }, uWarm: { value: 0.06 }, uSat: { value: 1.08 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uVignette, uGrain, uTilt, uTiltY, uFlash, uWarm, uSat; uniform vec3 uFlashCol;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    if (uTilt > 0.0) {
        float b = smoothstep(0.12, 0.5, abs(vUv.y - uTiltY)) * uTilt;
        if (b > 0.01) {
            vec4 acc = vec4(0.0); float w = 0.0;
            for (int i = -3; i <= 3; i++) for (int j = -3; j <= 3; j++) {
                vec2 o = vec2(float(i), float(j)) * b * 2.2 / uRes;
                float k = 1.0 / (1.0 + float(i * i + j * j) * 0.3);
                acc += texture2D(tDiffuse, vUv + o) * k; w += k;
            }
            c = acc / w;
        }
    }
    vec3 col = c.rgb;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, uSat);
    col += vec3(uWarm, uWarm * 0.45, -uWarm * 0.3) * (0.4 + 0.6 * l);
    vec2 q = vUv - 0.5;
    col *= 1.0 - uVignette * dot(q, q) * 2.2;
    col += (h(vUv * uRes + uTime) - 0.5) * uGrain;
    col = mix(col, uFlashCol, uFlash);
    gl_FragColor = vec4(col, c.a);
}`,
};

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.r.setClearColor('#8cc8f4');
        this.r.shadowMap.enabled = true;
        this.r.shadowMap.type = THREE.PCFSoftShadowMap;
        this.r.toneMapping = THREE.NoToneMapping;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, 1, 0.3, 2500);
        this.scene.add(this.camera);
        // lights
        this.hemi = new THREE.HemisphereLight('#cfe8ff', '#6a8a4a', 1.1);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight('#fff1c8', 2.6);
        this.sun.castShadow = true;
        this.sun.shadow.bias = -0.0006;
        this.sun.shadow.normalBias = 0.04;
        const sc = this.sun.shadow.camera;
        sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
        this.scene.add(this.sun, this.sun.target);
        this.sunDir = new THREE.Vector3(0.45, 0.8, -0.35).normalize();
        this.fog = new THREE.Fog('#cfeefc', 140, 520);
        this.scene.fog = this.fog;
        // post
        this.composer = new EffectComposer(this.r);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.86);
        this.composer.addPass(this.bloom);
        this.story = new ShaderPass(StorybookShader);
        this.composer.addPass(this.story);
        this.composer.addPass(new OutputPass());
        this.quality = 2;
        this.flash = 0;
        this.resizePending = true;
        this.w = 1; this.h = 1;
        addEventListener('resize', () => { this.resizePending = true; });
    }

    setQuality(q) {
        this.quality = q;
        const map = [512, 1024, 2048][q] ?? 1024;
        if (this.sun.shadow.mapSize.x !== map) {
            this.sun.shadow.mapSize.set(map, map);
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
        }
        this.sun.castShadow = q > 0;
        this.resizePending = true;
    }

    setPalette(P) {
        this.hemi.color.set(P.hemiSky); this.hemi.groundColor.set(P.hemiGround); this.hemi.intensity = P.hemiI;
        this.sun.color.set(P.sun); this.sun.intensity = P.sunI;
        this.sunDir.set(...P.sunDir).normalize();
        this.fog.color.set(P.fog); this.fog.near = P.fogNear; this.fog.far = P.fogFar;
        this.r.setClearColor(P.fog);
        this.bloom.strength = P.bloom;
        TOON.uRim.value.set(P.rim); TOON.uRimK.value = P.rimK;
        this.story.uniforms.uWarm.value = P.key === 'cinder' ? 0.03 : P.key === 'frost' ? -0.02 : 0.05;
    }

    // Keep the sun's shadow box centred on what matters.
    focusShadow(p) {
        this.sun.position.set(p.x + this.sunDir.x * 120, p.y + this.sunDir.y * 120, p.z + this.sunDir.z * 120);
        this.sun.target.position.set(p.x, p.y, p.z);
    }

    resize() {
        const w = Math.max(1, Math.floor(this.canvas.clientWidth || innerWidth));
        const h = Math.max(1, Math.floor(this.canvas.clientHeight || innerHeight));
        const pr = Math.min(devicePixelRatio || 1, [1, 1.5, 2][this.quality] ?? 1.5);
        this.r.setPixelRatio(pr);
        this.r.setSize(w, h, false);
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set((w * pr) / 2, (h * pr) / 2);
        this.story.uniforms.uRes.value.set(w * pr, h * pr);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.w = w; this.h = h;
        this.resizePending = false;
    }

    render(dt, t) {
        if (this.resizePending) this.resize();
        this.story.uniforms.uTime.value = t;
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
        this.story.uniforms.uFlash.value = this.flash * this.flash;
        this.composer.render(dt);
    }

    doFlash(color = '#ffffff', k = 0.8) { this.story.uniforms.uFlashCol.value.set(color); this.flash = Math.max(this.flash, k); }
}
