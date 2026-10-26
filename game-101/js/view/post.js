// The EGA pass: the scene is rendered to a 320×200 target, then every pixel is snapped to the nearest
// of the sixteen EGA colours with a 4×4 ordered (Bayer) dither, which is what makes dark corridors
// look like a real 1987 graphics card instead of a smooth gradient.

import * as THREE from 'three';
import { EGA } from '../config.js';

export const RES_W = 320, RES_H = 200;
export const palVec = EGA.map((h) => new THREE.Vector3(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255));

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tex;
uniform vec3 pal[16];
uniform vec2 res;
uniform vec3 tint;
uniform float tintAmt;
uniform float dither;
uniform float fade;
float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    float m[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
    return m[i] / 16.0;
}
void main() {
    vec3 c = texture2D(tex, vUv).rgb;
    c = mix(c, tint, tintAmt);
    c *= fade;
    float t = bayer(floor(vUv * res)) - 0.47;
    c = clamp(c + t * dither, 0.0, 1.0);
    float best = 1e9;
    vec3 bc = pal[0];
    for (int i = 0; i < 16; i++) {
        vec3 d = c - pal[i];
        float dd = dot(d, d);
        if (dd < best) { best = dd; bc = pal[i]; }
    }
    gl_FragColor = vec4(bc, 1.0);
}
`;

export function makePost(rtTexture) {
    const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
        uniforms: {
            tex: { value: rtTexture }, pal: { value: palVec }, res: { value: new THREE.Vector2(RES_W, RES_H) },
            tint: { value: new THREE.Vector3(1, 0, 0) }, tintAmt: { value: 0 }, dither: { value: 0.22 }, fade: { value: 1 },
        },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { mat, scene, cam };
}
