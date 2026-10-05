// Per-system skybox: an FBM nebula on the inside of a huge sphere, a galactic band,
// and three layers of point stars. The group follows the camera so it sits at infinity.

import * as THREE from 'three';
import { NOISE_GLSL } from './renderer.js';
import { RNG } from '../rng.js';

const SKY_R = 90000;

export function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); }

export function buildSky(sys, tier) {
    const group = new THREE.Group();
    group.name = 'sky';
    const sky = sys.sky;
    const starCol = new THREE.Color(sys.star.color);
    const c1 = hsl(sky.hue1, 0.75, 0.42), c2 = hsl(sky.hue2, 0.8, 0.35), c3 = hsl(sky.hue1 + 0.5, 0.5, 0.2);
    const bandN = new THREE.Vector3(Math.cos(sky.band) * 0.35, 1, Math.sin(sky.band) * 0.35).normalize(); // galactic plane normal: a gently tilted belt
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, depthTest: false,
        uniforms: {
            uC1: { value: c1 }, uC2: { value: c2 }, uC3: { value: c3 }, uStar: { value: starCol },
            uDensity: { value: sky.density }, uSeed: { value: (sky.seed % 1000) * 0.137 },
            uBand: { value: bandN }, uOct: { value: tier >= 2 ? 4 : 5 },
        },
        vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            ${NOISE_GLSL}
            uniform vec3 uC1, uC2, uC3, uStar, uBand; uniform float uDensity, uSeed; uniform int uOct;
            varying vec3 vDir;
            void main(){
                vec3 d = normalize(vDir);
                vec3 p = d * 2.2 + uSeed;
                float warp = fbm(p * 0.8, 3);
                float n = fbm(p + warp * 1.6, uOct);
                float n2 = fbm(p * 1.7 - warp, uOct);
                float neb = smoothstep(0.42, 0.85, n) * uDensity;
                float neb2 = smoothstep(0.5, 0.9, n2) * uDensity;
                vec3 col = vec3(0.004, 0.006, 0.014);
                col += uC1 * neb * 0.55 + uC2 * neb2 * 0.45;
                col += uC3 * pow(n, 3.0) * 0.25;
                // dark dust lanes
                col *= mix(1.0, 0.25, smoothstep(0.55, 0.75, fbm(p * 3.1 + 5.0, 3)) * neb);
                // galactic band
                float b = 1.0 - abs(dot(d, uBand));
                float band = pow(b, 7.0) * (0.4 + 0.8 * fbm(d * 7.0 + uSeed, 4));
                band *= mix(1.0, 0.35, smoothstep(0.5, 0.7, fbm(d * 14.0 - uSeed, 3)));
                col += vec3(0.5, 0.47, 0.6) * band * 0.12;
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 48, 24), mat);
    sphere.renderOrder = -10;
    sphere.frustumCulled = false;
    group.add(sphere);

    // Stars: three layers.
    const r = new RNG(sky.seed);
    const layers = [[4200, 1.2, 0.7], [1500, 2.2, 0.9], [260, 3.6, 1.0]];
    
    for (const [n0, size, bright] of layers) {
        const n = Math.round(n0 * (tier >= 3 ? 0.4 : tier >= 2 ? 0.65 : 1));
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const v = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
            // Bias toward the galactic band.
            for (let k = 0; k < 3; k++) {
                v.set(r.gauss(), r.gauss(), r.gauss()).normalize();
                if (Math.abs(v.dot(bandN)) < 0.25 || r.chance(0.45)) break;
            }
            v.multiplyScalar(SKY_R * 0.8);
            pos.set([v.x, v.y, v.z], i * 3);
            const t = r.next();
            const c = t < 0.15 ? [1, 0.75, 0.6] : t < 0.3 ? [0.7, 0.8, 1] : t < 0.35 ? [1, 0.95, 0.7] : [1, 1, 1];
            const b = bright * (0.4 + r.next() * 0.6);
            col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false, depthTest: false, transparent: true, blending: THREE.AdditiveBlending });
        const pts = new THREE.Points(g, m);
        pts.renderOrder = -9;
        pts.frustumCulled = false;
        group.add(pts);
    }
    return group;
}
