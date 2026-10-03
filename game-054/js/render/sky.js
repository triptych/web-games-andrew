/**
 * sky.js — one shader, four skies, drawn on a camera-centred sphere behind
 * everything. Only visible above open-air rooms (their walls rise 10–14 m
 * with no ceiling).
 *
 *   jupiter — black space, stars, and a banded Jupiter with its Great Red Spot
 *   io      — sulphur-orange haze, ash, volcanic glow on the horizon, Jupiter huge and low
 *   hell    — a red vortex of churning cloud with lightning in it
 *   void    — purple-black nothing, stars, and a pale ring: the Engine
 */
import * as THREE from 'three';
import { G } from './materials.js';

const TYPES = { jupiter: 0, io: 1, hell: 2, void: 3 };

const VS = /* glsl */`
varying vec3 vDir;
void main(){
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
}
`;

const FS = /* glsl */`
uniform float uTime;
uniform int uType;
uniform float uFlash;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += noise(p) * a; p *= 2.02; a *= 0.5; } return s; }
float stars(vec3 d, float dens){
    vec3 p = d * 220.0;
    vec3 i = floor(p);
    float h = hash(i);
    float s = smoothstep(dens, 1.0, h);
    vec3 f = fract(p) - 0.5;
    return s * smoothstep(0.35, 0.0, length(f)) * (0.6 + 0.4 * sin(uTime * 2.0 + h * 40.0));
}
vec3 planet(vec3 d, vec3 c, float r, out float mask){
    float cosA = dot(d, c);
    float ang = acos(clamp(cosA, -1.0, 1.0));
    mask = smoothstep(r, r - 0.004, ang);
    // local coords on the disc
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, c));
    vec3 u2 = cross(c, right);
    vec2 q = vec2(dot(d, right), dot(d, u2)) / sin(r);
    float z = sqrt(max(0.0, 1.0 - dot(q, q)));
    float lat = q.y;
    float bands = sin(lat * 22.0 + fbm(vec3(q * 3.0, uTime * 0.01)) * 3.0);
    vec3 col = mix(vec3(0.75, 0.55, 0.38), vec3(0.95, 0.88, 0.75), bands * 0.5 + 0.5);
    col = mix(col, vec3(0.55, 0.32, 0.22), smoothstep(0.6, 1.0, abs(sin(lat * 7.0 + 1.3))) * 0.5);
    float spot = smoothstep(0.16, 0.08, length((q - vec2(0.25, -0.28)) * vec2(1.0, 1.8)));
    col = mix(col, vec3(0.75, 0.25, 0.15), spot);
    float light = clamp(dot(normalize(vec3(q, z)), normalize(vec3(-0.6, 0.3, 0.75))), 0.0, 1.0);
    return col * (0.08 + 1.1 * light) * z * 0.9 + vec3(0.9, 0.6, 0.4) * pow(1.0 - z, 3.0) * 0.4;
}
void main(){
    vec3 d = normalize(vDir);
    vec3 col = vec3(0.0);
    float h = d.y;
    if (uType == 0) {
        col = vec3(0.004, 0.006, 0.014) + vec3(0.02, 0.025, 0.05) * pow(1.0 - abs(h), 4.0);
        col += vec3(stars(d, 0.985)) * 1.4;
        float neb = fbm(d * 3.0 + 5.0);
        col += vec3(0.25, 0.1, 0.35) * pow(neb, 3.0) * 0.6;
        float m;
        vec3 pc = planet(d, normalize(vec3(0.5, 0.42, -0.75)), 0.42, m);
        col = mix(col, pc, m);
    } else if (uType == 1) {
        col = mix(vec3(0.45, 0.2, 0.06), vec3(0.08, 0.03, 0.02), smoothstep(-0.1, 0.7, h));
        col += vec3(1.0, 0.35, 0.05) * pow(1.0 - clamp(h, 0.0, 1.0), 6.0) * 0.8;
        float m;
        vec3 pc = planet(d, normalize(vec3(-0.6, 0.28, 0.6)), 0.6, m);
        col = mix(col, pc * vec3(1.1, 0.8, 0.6), m * 0.92);
        float ash = fbm(d * 6.0 + vec3(uTime * 0.05, 0.0, uTime * 0.03));
        col = mix(col, vec3(0.18, 0.09, 0.05), smoothstep(0.45, 0.8, ash) * 0.7);
        col += vec3(stars(d, 0.993)) * 0.4 * smoothstep(0.2, 0.8, h);
    } else if (uType == 2) {
        // vortex
        vec2 p = d.xz / (abs(h) + 0.25);
        float r = length(p), a = atan(p.y, p.x);
        float swirl = a + r * 1.6 - uTime * 0.12;
        float c = fbm(vec3(cos(swirl) * r, sin(swirl) * r, uTime * 0.05) * 1.8);
        float eye = smoothstep(0.6, 0.0, r) * step(0.0, h);
        col = mix(vec3(0.08, 0.0, 0.0), vec3(0.75, 0.12, 0.04), c * c * 1.4);
        col += vec3(1.0, 0.55, 0.2) * eye * (0.6 + 0.4 * sin(uTime * 1.5)) * 0.9;
        col = mix(col, vec3(0.2, 0.02, 0.0), smoothstep(0.1, -0.3, h));
        float bolt = step(0.985, noise(vec3(a * 6.0, r * 2.0, floor(uTime * 6.0)))) * uFlash;
        col += vec3(1.0, 0.7, 0.6) * bolt * 2.0 + vec3(0.6, 0.2, 0.2) * uFlash * 0.4;
    } else {
        col = vec3(0.01, 0.0, 0.02) + vec3(0.12, 0.05, 0.2) * pow(fbm(d * 2.5 + uTime * 0.01), 2.5);
        col += vec3(stars(d, 0.98)) * vec3(0.9, 0.85, 1.0);
        // the ring: a pale band around a tilted axis
        vec3 axis = normalize(vec3(0.3, 1.0, 0.2));
        float band = abs(dot(d, axis));
        float ring = smoothstep(0.08, 0.0, band) * (0.6 + 0.4 * fbm(d * 20.0 + uTime * 0.2));
        col += vec3(0.85, 0.8, 1.0) * ring * 0.9;
        col += vec3(0.6, 0.5, 1.0) * smoothstep(0.3, 0.0, band) * 0.12;
    }
    gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky(type) {
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: G.uTime, uType: { value: TYPES[type] ?? 0 }, uFlash: { value: 0 } },
        vertexShader: VS,
        fragmentShader: FS,
        side: THREE.BackSide,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;
    mesh.name = 'sky';
    return mesh;
}
