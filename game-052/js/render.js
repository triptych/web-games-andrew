// The render pipeline:
//   1. reflection pass — the scene from a camera mirrored in the road plane,
//      clipped to above the road, into a small target the road shader samples;
//   2. main pass into a deliberately low-resolution target;
//   3. a post pass (bloom, a touch of chromatic aberration, grade, grain,
//      ordered dithering) straight onto a canvas of that same low resolution,
//      which CSS then scales up with hard pixel edges.

import * as THREE from 'three';
import { U } from './materials.js';
import { RES_PRESETS } from './config.js';

export class Pipeline {
    constructor(host) {
        THREE.ColorManagement.enabled = false;
        const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        r.outputColorSpace = THREE.LinearSRGBColorSpace;
        r.setPixelRatio(1);
        r.autoClear = true;
        r.info.autoReset = false;      // stats cover all three passes of a frame
        r.domElement.id = 'gl';
        host.appendChild(r.domElement);
        this.canvas = r.domElement;

        const isWebGL2 = r.capabilities.isWebGL2;
        const type = isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
        this.sceneRT = new THREE.WebGLRenderTarget(4, 4, { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
        this.reflRT = new THREE.WebGLRenderTarget(4, 4, { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
        U.uRefl.value = this.reflRT.texture;

        this.reflCam = new THREE.PerspectiveCamera();
        this.reflCam.layers.set(0);
        this.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
        this._v = new THREE.Vector3();
        this._t = new THREE.Vector3();

        this.post = new THREE.ShaderMaterial({
            uniforms: {
                tScene: { value: this.sceneRT.texture },
                uRes: { value: new THREE.Vector2(4, 4) },
                uTime: { value: 0 },
                uRetro: { value: 1 },
            },
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
            fragmentShader: /* glsl */`
                uniform sampler2D tScene;
                uniform vec2 uRes;
                uniform float uTime, uRetro;
                varying vec2 vUv;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
                float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
                vec3 bright(vec2 uv) { vec3 c = texture2D(tScene, uv).rgb; return max(c - 0.5, 0.0); }
                void main() {
                    vec2 px = 1.0 / uRes;
                    vec2 d = vUv - 0.5;
                    vec2 off = d * px * 3.0 * uRetro;
                    vec3 c;
                    c.r = texture2D(tScene, vUv + off).r;
                    c.g = texture2D(tScene, vUv).g;
                    c.b = texture2D(tScene, vUv - off).b;
                    // cheap two-ring bloom: neon and lamps bleed into the haze
                    vec3 b = vec3(0.0);
                    for (int i = 0; i < 8; i++) {
                        float a = float(i) * 0.785398 + 0.3;
                        vec2 dir = vec2(cos(a), sin(a));
                        b += bright(vUv + dir * px * 2.5) * 0.7;
                        b += bright(vUv + dir * px * 6.0) * 0.45;
                    }
                    c += b * 0.11;
                    // soft knee for anything that blew past white
                    c = c / (1.0 + max(c - 0.85, 0.0));
                    // grade: purple lift in the shadows, a little warmth up top
                    c = c * vec3(1.03, 0.97, 1.05) + vec3(0.014, 0.004, 0.028);
                    c *= 1.0 - dot(d, d) * (0.55 + 0.5 * uRetro);
                    c += (hash(vUv * uRes + fract(uTime * 7.0) * 113.0) - 0.5) * 0.035 * uRetro;
                    float levels = mix(255.0, 30.0, uRetro);
                    c = floor(c * levels + bayer4(gl_FragCoord.xy)) / levels;
                    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
                }`,
            depthTest: false, depthWrite: false,
        });
        this.postScene = new THREE.Scene();
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
        quad.frustumCulled = false;
        this.postScene.add(quad);
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.preset = 'lofi';
        this.retro = true;
        this.reflections = true;
        this.width = 4; this.height = 4;
    }

    configure({ preset, retro, reflections }) {
        if (preset) this.preset = preset;
        if (retro !== undefined) this.retro = retro;
        if (reflections !== undefined) this.reflections = reflections;
        this.post.uniforms.uRetro.value = this.retro ? 1 : 0;
        U.uReflOn.value = this.reflections ? 1 : 0;
        this.resize();
    }

    resize() {
        const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let h = RES_PRESETS[this.preset] || 240;
        h = Math.min(h, Math.round(vh * dpr));
        const w = Math.max(1, Math.round(h * vw / vh));
        this.width = w; this.height = h;
        this.renderer.setSize(w, h, false);
        this.sceneRT.setSize(w, h);
        this.reflRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
        this.post.uniforms.uRes.value.set(w, h);
        this.aspect = vw / vh;
        this.canvas.classList.toggle('smooth', this.preset === 'crisp');
    }

    render(scene, camera, planeY, time) {
        const r = this.renderer;
        r.info.reset();
        U.uPointScale.value = this.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

        if (this.reflections) {
            const rc = this.reflCam;
            rc.fov = camera.fov; rc.aspect = camera.aspect; rc.near = camera.near; rc.far = camera.far;
            rc.updateProjectionMatrix();
            const p = camera.position;
            rc.position.set(p.x, 2 * planeY - p.y, p.z);
            camera.getWorldDirection(this._v);
            this._t.set(p.x + this._v.x * 10, 2 * planeY - (p.y + this._v.y * 10), p.z + this._v.z * 10);
            rc.up.set(0, -1, 0);
            rc.lookAt(this._t);
            rc.updateMatrixWorld();
            U.uTexMatrix.value.copy(this._bias).multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
            this.clip.constant = -(planeY - 0.05);
            r.clippingPlanes = [this.clip];
            r.setRenderTarget(this.reflRT);
            r.render(scene, rc);
            r.clippingPlanes = [];
        }

        camera.layers.enableAll();
        r.setRenderTarget(this.sceneRT);
        r.render(scene, camera);

        this.post.uniforms.uTime.value = time;
        r.setRenderTarget(null);
        r.render(this.postScene, this.postCam);
    }

    /** Upscaled PNG of the frame that was just drawn. */
    snapshot(scale = 4) {
        const c = document.createElement('canvas');
        c.width = this.width * scale; c.height = this.height * scale;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(this.canvas, 0, 0, c.width, c.height);
        return c.toDataURL('image/png');
    }
}
