// Cel shading: lit surfaces step through a few flat tones (a toon ramp), and a screen-space pass
// inks an outline wherever the depth buffer bends: a silhouette against whatever is behind, or a
// crease between two faces of a building. No second geometry, so instanced traffic, merged models
// and the growing ball all get outlines for free.
//
// The scene is drawn in two passes. Layer 0 (everything solid) goes into a render target with a depth
// texture; a full-screen pass inks it onto the screen and copies the depth across; then layer 1
// (dust, shadows, rings, bubbles: things that blend and don't write depth) is drawn straight onto
// the screen, depth-tested against the solid world.

import * as THREE from 'three';

let ramp = null;
/** A hard four-step ramp: darkest on faces turned from the sun, brightest facing it. */
export function toonGradient() {
    if (!ramp) {
        const d = new Uint8Array([104, 164, 222, 255]);
        ramp = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
        ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
        ramp.generateMipmaps = false;
        ramp.needsUpdate = true;
    }
    return ramp;
}

/** A toon material with the shared ramp. */
export function toon(params = {}) {
    return new THREE.MeshToonMaterial({ gradientMap: toonGradient(), ...params });
}

/** Put an object on the layer that is drawn after the outline pass (no depth writes, may blend). */
export function overlay(...objs) { for (const o of objs) o.layers.set(1); return objs[0]; }

const VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FS = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float near;
uniform float far;
uniform float thick;
uniform float lo;
uniform float hi;
uniform float strength;
uniform vec3 ink;
varying vec2 vUv;
// 1 / view depth, which is an affine function of the depth buffer value: flat surfaces have a
// zero Laplacian in it, so only silhouettes and creases light up.
float invZ(vec2 uv) { return (far - texture2D(tDepth, uv).x * (far - near)) / (near * far); }
void main() {
    vec4 c = texture2D(tColor, vUv);
    float d0 = texture2D(tDepth, vUv).x;
    vec2 o = texel * thick;
    float z0 = invZ(vUv);
    float lap = abs(invZ(vUv + vec2(-o.x, 0.0)) + invZ(vUv + vec2(o.x, 0.0)) + invZ(vUv + vec2(0.0, -o.y)) + invZ(vUv + vec2(0.0, o.y)) - 4.0 * z0);
    float e = smoothstep(lo, hi, lap / max(z0, 1e-6)) * strength;
    gl_FragColor = vec4(mix(c.rgb, ink, e), 1.0);
    gl_FragDepth = d0;
    #include <colorspace_fragment>
}`;

export class Cel {
    constructor(renderer, camera) {
        this.renderer = renderer;
        this.camera = camera;
        this.on = true;
        this.ink = new THREE.Color(0x1a2142);
        const depth = new THREE.DepthTexture(2, 2);
        depth.minFilter = depth.magFilter = THREE.NearestFilter;
        let type = THREE.HalfFloatType;
        const ext = renderer.extensions;
        if (!(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) type = THREE.UnsignedByteType;
        this.target = new THREE.WebGLRenderTarget(2, 2, { type, samples: 4, depthTexture: depth });
        if (type === THREE.UnsignedByteType) this.target.texture.colorSpace = THREE.SRGBColorSpace;
        this.target.texture.minFilter = this.target.texture.magFilter = THREE.NearestFilter;
        this.material = new THREE.ShaderMaterial({
            vertexShader: VS, fragmentShader: FS, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
            uniforms: {
                tColor: { value: this.target.texture }, tDepth: { value: depth },
                texel: { value: new THREE.Vector2(1, 1) }, near: { value: camera.near }, far: { value: camera.far },
                thick: { value: 1 }, lo: { value: 0.004 }, hi: { value: 0.02 }, strength: { value: 0.95 },
                ink: { value: this.ink },
            },
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.quad.frustumCulled = false;
        this.quadScene = new THREE.Scene();
        this.quadScene.add(this.quad);
        this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this._size = new THREE.Vector2();
    }

    /** Match the drawing buffer (call after renderer.setSize / setPixelRatio). */
    resize() {
        this.renderer.getDrawingBufferSize(this._size);
        const w = Math.max(1, this._size.x), h = Math.max(1, this._size.y);
        this.target.setSize(w, h);
        this.material.uniforms.texel.value.set(1 / w, 1 / h);
        this.material.uniforms.thick.value = Math.max(1.6, this.renderer.getPixelRatio() * 1.3);
        this.material.uniforms.near.value = this.camera.near;
        this.material.uniforms.far.value = this.camera.far;
    }

    render(scene) {
        const r = this.renderer, cam = this.camera;
        if (!this.on) {
            cam.layers.enableAll();
            r.setRenderTarget(null);
            r.autoClear = true;
            r.render(scene, cam);
            return;
        }
        // 1. everything solid, into the target
        r.autoClear = true;
        cam.layers.set(0);
        r.setRenderTarget(this.target);
        r.render(scene, cam);
        // 2. ink it onto the screen and carry its depth across
        r.setRenderTarget(null);
        r.clear();
        r.autoClear = false;
        r.render(this.quadScene, this.quadCam);
        // 3. dust, shadows, rings and bubbles on top, tested against that depth
        cam.layers.set(1);
        const bg = scene.background;
        scene.background = null;
        r.render(scene, cam);
        scene.background = bg;
        cam.layers.set(0);
        r.autoClear = true;
    }
}
