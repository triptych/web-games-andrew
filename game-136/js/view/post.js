// Photo-mode post-processing: a two-pass tilt-shift blur (the "miniature" look that suits a diorama)
// and a grade pass for the photo filters. Both run after OutputPass, in display (sRGB) space.
// Every pow() base is clamped, so no NaN can appear.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TILT = {
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.5 }, uBand: { value: 0.16 }, uAmount: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform vec2 uDir, uRes; uniform float uFocus, uBand, uAmount; varying vec2 vUv;
        void main() {
            float d = abs(vUv.y - uFocus);
            float b = smoothstep(uBand, uBand + 0.32, d) * uAmount;
            vec2 st = uDir / uRes * b * 3.2;
            vec4 c = texture2D(tDiffuse, vUv) * 0.2270;
            c += (texture2D(tDiffuse, vUv + st * 1.0) + texture2D(tDiffuse, vUv - st * 1.0)) * 0.1945;
            c += (texture2D(tDiffuse, vUv + st * 2.0) + texture2D(tDiffuse, vUv - st * 2.0)) * 0.1216;
            c += (texture2D(tDiffuse, vUv + st * 3.0) + texture2D(tDiffuse, vUv - st * 3.0)) * 0.0540;
            c += (texture2D(tDiffuse, vUv + st * 4.0) + texture2D(tDiffuse, vUv - st * 4.0)) * 0.0162;
            gl_FragColor = c;
        }`,
};

const GRADE = {
    uniforms: {
        tDiffuse: { value: null }, uSat: { value: 1 }, uWarm: { value: 0 }, uContrast: { value: 1 }, uLift: { value: 0 },
        uMono: { value: 0 }, uSepia: { value: 0 }, uVignette: { value: 0.2 }, uGrain: { value: 0 }, uBright: { value: 1 }, uTime: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uSat, uWarm, uContrast, uLift, uMono, uSepia, uVignette, uGrain, uBright, uTime; varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec3 c = clamp(texture2D(tDiffuse, vUv).rgb, 0.0, 1.0) * uBright;
            float l = dot(c, vec3(0.299, 0.587, 0.114));
            c = mix(vec3(l), c, uSat);
            c += vec3(uWarm, uWarm * 0.3, -uWarm);
            c = (c - 0.5) * uContrast + 0.5;
            c = mix(c, vec3(l), uMono);
            vec3 sep = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
            c = mix(c, sep, uSepia);
            c = c * (1.0 - uLift) + uLift;
            vec2 q = vUv - 0.5;
            c *= 1.0 - uVignette * clamp(dot(q, q) * 2.2, 0.0, 1.0);
            c += (h(vUv * 917.0 + uTime) - 0.5) * uGrain;
            gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
};

/** The photo filters: what the grade pass does for each. */
export const FILTERS = {
    natural: { name: 'Natural', sat: 1.05, warm: 0, contrast: 1.02, lift: 0, mono: 0, sepia: 0, vignette: 0.22, grain: 0, bright: 1 },
    warm: { name: 'Warm', sat: 1.12, warm: 0.06, contrast: 1.05, lift: 0.02, mono: 0, sepia: 0, vignette: 0.3, grain: 0, bright: 1.02 },
    cool: { name: 'Cool', sat: 0.95, warm: -0.06, contrast: 1.04, lift: 0.02, mono: 0, sepia: 0, vignette: 0.25, grain: 0, bright: 1 },
    pastel: { name: 'Pastel', sat: 0.78, warm: 0.02, contrast: 0.86, lift: 0.1, mono: 0, sepia: 0, vignette: 0.12, grain: 0, bright: 1.06 },
    film: { name: 'Film', sat: 0.86, warm: 0.04, contrast: 0.94, lift: 0.07, mono: 0, sepia: 0, vignette: 0.45, grain: 0.07, bright: 1 },
    sepia: { name: 'Sepia', sat: 1, warm: 0, contrast: 1.05, lift: 0.04, mono: 0, sepia: 0.9, vignette: 0.45, grain: 0.05, bright: 1.02 },
    mono: { name: 'B & W', sat: 1, warm: 0, contrast: 1.14, lift: 0.02, mono: 1, sepia: 0, vignette: 0.35, grain: 0.05, bright: 1 },
};

export class Post {
    constructor(renderer, scene, camera) {
        this.composer = new EffectComposer(renderer);
        this.render = new RenderPass(scene, camera);
        this.composer.addPass(this.render);
        this.composer.addPass(new OutputPass());
        this.tiltH = new ShaderPass(TILT); this.tiltV = new ShaderPass(TILT);
        this.tiltV.uniforms.uDir.value.set(0, 1);
        this.composer.addPass(this.tiltH); this.composer.addPass(this.tiltV);
        this.grade = new ShaderPass(GRADE);
        this.composer.addPass(this.grade);
        this.setFilter('natural');
        this.setTilt(0);
    }
    setCamera(cam) { this.render.camera = cam; }
    setSize(w, h) {
        this.composer.setSize(w, h);
        for (const p of [this.tiltH, this.tiltV]) p.uniforms.uRes.value.set(w, h);
    }
    setTilt(amount, focus = 0.5) {
        for (const p of [this.tiltH, this.tiltV]) { p.uniforms.uAmount.value = amount; p.uniforms.uFocus.value = focus; }
        this.tiltH.enabled = this.tiltV.enabled = amount > 0;
    }
    setFilter(id) {
        const f = FILTERS[id] || FILTERS.natural;
        const u = this.grade.uniforms;
        u.uSat.value = f.sat; u.uWarm.value = f.warm; u.uContrast.value = f.contrast; u.uLift.value = f.lift;
        u.uMono.value = f.mono; u.uSepia.value = f.sepia; u.uVignette.value = f.vignette; u.uGrain.value = f.grain; u.uBright.value = f.bright;
    }
    draw(time) { this.grade.uniforms.uTime.value = time % 10; this.composer.render(); }
}
