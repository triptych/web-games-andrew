// The sky: a dome drawn entirely in one shader, always centred on the camera so it sits at infinity.
// Three layers of crisp stars of different colours, a dusty galactic band, the sun with its corona,
// and a banded gas giant traced as a real sphere (lit by the sun, with a terminator, a limb glow,
// a great storm and a thin ring that passes in front of it and takes its shadow).

import * as THREE from 'three';
import { NOISE } from './glsl.js';

export const SUN_DIR = new THREE.Vector3(0.75, 0.5, 0.35).normalize();
export const PLANET_DIR = new THREE.Vector3(-0.55, -0.2, 0.81).normalize();
export const PLANET_COLOR = new THREE.Color(0xd9a26a);

export function makeSky(quality) {
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            uSun: { value: SUN_DIR.clone() },
            uPlanet: { value: PLANET_DIR.clone() },
            uPx: { value: 0.0012 },
            uTime: { value: 0 },
            uStorm: { value: 0 },
        },
        defines: { QUALITY: quality },
        vertexShader: /* glsl */`
varying vec3 vDir;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.99999;   // always behind everything
}`,
        fragmentShader: /* glsl */`
uniform vec3 uSun, uPlanet; uniform float uPx, uTime;
varying vec3 vDir;
${NOISE}
vec3 starLayer(vec3 d, float scale, float dens, float bright){
  vec3 p = d * scale;
  vec3 c = floor(p);
  vec3 r = h33(c);
  if (r.x > dens) return vec3(0.0);
  vec3 sp = c + 0.2 + h33(c + 3.1) * 0.6;
  float dist = length(p - sp) / scale;                    // angular distance (radians)
  float size = max(uPx * 0.9, 0.00045);
  float k = exp(-dist * dist / (size * size));
  float mag = pow(clamp(r.y, 0.0, 1.0), 6.0) * 3.5 + 0.18;
  float t = r.z;
  vec3 col = t < 0.2 ? vec3(0.72, 0.8, 1.0) : t < 0.75 ? vec3(1.0, 0.97, 0.92) : vec3(1.0, 0.78, 0.55);
  return col * k * mag * bright * (uPx * 0.9 > 0.00045 ? 1.0 : (uPx * 0.9) / 0.00045 + 0.5);
}
vec3 planet(vec3 d, out float hit, out float depth){
  hit = 0.0; depth = 1e9;
  float rad = 0.2;                                         // angular radius
  float D = 1.0 / sin(rad);
  vec3 C = uPlanet * D;
  float b = dot(d, C), c = dot(C, C) - 1.0;
  float disc = b * b - c;
  vec3 col = vec3(0.0);
  vec3 axis = normalize(vec3(0.25, 1.0, 0.12));
  if (disc > 0.0) {
    float t = b - sqrt(disc);
    vec3 n = normalize(d * t - C);
    depth = t;
    float lat = dot(n, axis);
    vec3 e1 = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
    vec3 e2 = cross(axis, e1);
    float lon = atan(dot(n, e2), dot(n, e1));
    float turb = fbm3(vec3(lon * 2.0, lat * 9.0, 0.0) + uTime * 0.004, QUALITY > 0 ? 5 : 3);
    float band = sin(lat * 24.0 + turb * 3.0 + sin(lat * 7.0) * 1.5);
    vec3 cream = vec3(0.93, 0.86, 0.72), tan_ = vec3(0.8, 0.6, 0.42), rust = vec3(0.62, 0.36, 0.22), dark = vec3(0.36, 0.25, 0.18);
    vec3 alb = mix(tan_, cream, smoothstep(-0.2, 0.6, band));
    alb = mix(alb, rust, smoothstep(0.55, 0.95, abs(sin(lat * 11.0 + turb * 2.0))) * 0.55);
    alb = mix(alb, dark, smoothstep(0.75, 1.0, abs(lat)) * 0.6);
    // the great storm
    vec2 so = vec2((lon - 0.8) * 2.2, (lat + 0.32) * 9.0);
    float sd = length(so);
    alb = mix(alb, vec3(0.78, 0.36, 0.22), smoothstep(1.0, 0.55, sd) * 0.85);
    alb = mix(alb, vec3(0.95, 0.85, 0.7), smoothstep(1.15, 1.0, sd) * smoothstep(0.85, 1.0, sd) * 0.5);
    float lit = dot(n, uSun);
    float term = smoothstep(-0.08, 0.25, lit);
    float limb = pow(clamp(1.0 - dot(n, -d), 0.0, 1.0), 3.0);
    col = alb * term * (0.25 + 0.85 * clamp(lit, 0.0, 1.0)) * 1.25;
    col += vec3(0.95, 0.7, 0.45) * limb * term * 0.6;
    col += alb * 0.012;                                     // faint ring-shine on the night side
    hit = 1.0;
  }
  // the ring: a plane through C with normal axis
  float dn = dot(d, axis);
  if (abs(dn) > 1e-4) {
    float tr = dot(C, axis) / dn;
    if (tr > 0.0) {
      vec3 hp = d * tr - C;
      float rr = length(hp);
      if (rr > 1.35 && rr < 2.3 && tr < depth) {
        float ringd = 0.35 + 0.65 * vn3(vec3(rr * 40.0, 0.0, 0.0));
        ringd *= smoothstep(1.35, 1.45, rr) * smoothstep(2.3, 2.15, rr) * (1.0 - 0.7 * smoothstep(1.78, 1.82, rr) * smoothstep(1.9, 1.86, rr));
        // the planet's shadow on the ring
        vec3 toSun = uSun;
        float bb = dot(hp, toSun);
        float sh = (bb < 0.0 && length(hp - toSun * bb) < 1.0) ? 0.08 : 1.0;
        vec3 rc = vec3(0.85, 0.75, 0.62) * ringd * sh * 0.9;
        col = mix(col, rc, ringd * 0.75);
        hit = max(hit, ringd * 0.75);
      }
    }
  }
  return col;
}
void main(){
  vec3 d = normalize(vDir);
  vec3 col = vec3(0.0);
  // galactic band
  vec3 gN = normalize(vec3(0.3, 0.85, 0.42));
  float g = dot(d, gN);
  float band = exp(-g * g / 0.035);
  float dust = fbm3(d * 5.0, QUALITY > 0 ? 5 : 3);
  float lanes = smoothstep(0.42, 0.62, fbm3(d * 9.0 + 4.0, QUALITY > 0 ? 4 : 2));
  col += vec3(0.5, 0.52, 0.62) * band * dust * dust * 0.09 * (1.0 - lanes * 0.8);
  col += vec3(0.35, 0.18, 0.3) * band * smoothstep(0.55, 0.8, dust) * 0.04;
  // stars: three layers, more of them along the band
  col += starLayer(d, 70.0, 0.16 + band * 0.12, 1.0);
  col += starLayer(d, 170.0, 0.06 + band * 0.12, 0.6);
  if (QUALITY > 0) col += starLayer(d, 400.0, 0.02 + band * 0.08, 0.4);
  // the sun
  float sa = acos(clamp(dot(d, uSun), -1.0, 1.0));
  col += vec3(1.0, 0.97, 0.9) * (smoothstep(0.0105, 0.0085, sa) * 60.0);
  col += vec3(1.0, 0.85, 0.65) * exp(-sa * 14.0) * 1.1 + vec3(0.7, 0.75, 1.0) * exp(-sa * 4.0) * 0.08;
  // the gas giant, in front of the stars
  float hit, depth;
  vec3 pc = planet(d, hit, depth);
  col = mix(col, pc, clamp(hit, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 64, 32), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return mesh;
}
