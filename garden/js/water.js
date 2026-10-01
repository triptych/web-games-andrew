// The sea: a dense polar grid around the island with Gerstner swells, sky
// reflection from the same analytic sky as the dome, sun and moon glints,
// turquoise shallows over the sand, and foam lines that roll onto the shore.

import * as THREE from 'three';
import { GLSL_NOISE } from './sky.js';

const vert = /* glsl */ `
uniform float uTime, uHalf;
uniform sampler2D uData;
varying vec3 vWPos;
varying vec3 vNrm;
varying vec2 vData;
varying float vCrest;
#include <fog_pars_vertex>

vec3 gerstner(vec2 dir, float L, float A, float Q, vec2 p, float t, inout vec3 tan, inout vec3 bin){
  float k = 6.28318 / L;
  float c = sqrt(9.8 / k);
  vec2 d = normalize(dir);
  float f = k * (dot(d, p) - c * t);
  float wa = k * A;
  float s = sin(f), co = cos(f);
  tan += vec3(-Q * d.x * d.x * wa * s, d.x * wa * co, -Q * d.x * d.y * wa * s);
  bin += vec3(-Q * d.x * d.y * wa * s, d.y * wa * co, -Q * d.y * d.y * wa * s);
  return vec3(Q * A * d.x * co, A * s, Q * A * d.y * co);
}

void main(){
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vec2 uv = (p.xz + uHalf) / (2.0 * uHalf);
  vec2 data = vec2(1.0, 0.0);
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) data = texture2D(uData, uv).rg;
  vData = data;
  float amp = mix(0.25, 1.0, smoothstep(0.0, 0.3, data.r));
  vec3 tan = vec3(1, 0, 0), bin = vec3(0, 0, 1);
  vec3 o = vec3(0.0);
  o += gerstner(vec2(1.0, 0.35), 24.0, 0.17 * amp, 0.6, p.xz, uTime, tan, bin);
  o += gerstner(vec2(0.55, 0.85), 13.0, 0.09 * amp, 0.6, p.xz, uTime, tan, bin);
  o += gerstner(vec2(-0.45, 0.9), 7.5, 0.05 * amp, 0.5, p.xz, uTime, tan, bin);
  o += gerstner(vec2(0.9, -0.45), 4.1, 0.025 * amp, 0.4, p.xz, uTime, tan, bin);
  p += o;
  vCrest = o.y;
  vNrm = normalize(cross(bin, tan));
  vWPos = p;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */ `
uniform vec3 uZenith, uHorizon, uSunColor, uSunDir, uMoonDir;
uniform float uTime, uNight, uDay;
varying vec3 vWPos;
varying vec3 vNrm;
varying vec2 vData;
varying float vCrest;
#include <fog_pars_fragment>
${GLSL_NOISE}

float ripple(vec2 p){
  return vnoise(p * 0.55 + vec2(uTime * 0.21, uTime * 0.09)) * 0.55
       + vnoise(p * 1.3 - vec2(uTime * 0.17, -uTime * 0.23)) * 0.3
       + vnoise(p * 3.1 + vec2(-uTime * 0.31, uTime * 0.27)) * 0.15;
}

vec3 skyColor(vec3 d){
  float up = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, pow(up, 0.45));
  return mix(c, uHorizon * 1.08, exp(-up * 18.0) * 0.6);
}

void main(){
  vec3 V = normalize(cameraPosition - vWPos);
  float dist = length(cameraPosition - vWPos);
  // detail normal from scrolling noise, faded with distance to avoid sparkle
  float e = 0.12;
  vec2 q = vWPos.xz;
  float h0 = ripple(q), hx = ripple(q + vec2(e, 0.0)), hz = ripple(q + vec2(0.0, e));
  float detail = mix(0.9, 0.12, smoothstep(10.0, 160.0, dist));
  vec3 N = normalize(vNrm + vec3(h0 - hx, 0.0, h0 - hz) / e * detail * 0.35);

  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 refl = skyColor(R);

  float depth = vData.x * 12.0;
  vec3 deep = vec3(0.012, 0.09, 0.14), shallow = vec3(0.06, 0.42, 0.40);
  vec3 body = mix(shallow, deep, smoothstep(0.2, 6.0, depth));
  // light through the wave crests
  float sss = pow(max(dot(V, -uSunDir), 0.0), 3.0) * smoothstep(0.0, 0.3, vCrest);
  body += vec3(0.05, 0.3, 0.25) * sss * uDay;
  body *= 0.25 + 0.85 * uDay + 0.25 * uNight * 0.3;
  body += vec3(0.0, 0.02, 0.05) * uNight;

  vec3 col = mix(body, refl, fres);

  // sun and moon glints
  float sunUp = smoothstep(-0.05, 0.05, uSunDir.y);
  float sp = max(dot(R, uSunDir), 0.0);
  col += uSunColor * (pow(sp, 900.0) * 30.0 + pow(sp, 80.0) * 0.6) * sunUp;
  float mp = max(dot(R, uMoonDir), 0.0);
  col += vec3(0.6, 0.7, 1.0) * (pow(mp, 600.0) * 6.0 + pow(mp, 40.0) * 0.12) * uNight;

  // foam: a ring hugging the shore plus swash lines rolling in
  float shore = vData.y;
  float n = vnoise(q * 0.9 + uTime * 0.15) * 0.6 + vnoise(q * 3.0 - uTime * 0.2) * 0.4;
  float edge = smoothstep(0.35, 0.0, depth + n * 0.25 - 0.1);
  float lines = smoothstep(0.82, 1.0, sin(shore * 60.0 - uTime * 1.2 + n * 3.0)) * smoothstep(0.6, 0.95, shore) * smoothstep(2.5, 0.3, depth);
  float crest = smoothstep(0.22, 0.34, vCrest + n * 0.05) * 0.35 * smoothstep(1.0, 4.0, depth);
  float foam = clamp(max(edge, lines * 0.8) + crest, 0.0, 1.0) * (0.55 + 0.45 * n);
  vec3 foamCol = mix(vec3(0.9, 0.95, 1.0) * (0.25 + 0.85 * uDay), vec3(0.35, 0.45, 0.65), uNight * 0.6);
  col = mix(col, foamCol, foam);

  float alpha = mix(0.35, 1.0, smoothstep(0.0, 1.6, depth));
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function polarGrid(innerStep, innerR, outerR, segs) {
    const radii = [0];
    for (let r = innerStep; r < innerR; r += innerStep) radii.push(r);
    let r = innerR, step = innerStep;
    while (r < outerR) {
        radii.push(r);
        step *= 1.12;
        r += step;
    }
    radii.push(outerR);
    const pos = [];
    for (const rr of radii) {
        for (let i = 0; i < segs; i++) {
            const a = (i / segs) * Math.PI * 2 + (rr * 0.013);
            pos.push(Math.sin(a) * rr, 0, Math.cos(a) * rr);
        }
    }
    const idx = [];
    for (let k = 0; k < radii.length - 1; k++) {
        for (let i = 0; i < segs; i++) {
            const a = k * segs + i, b = k * segs + ((i + 1) % segs);
            const c = (k + 1) * segs + i, d = (k + 1) * segs + ((i + 1) % segs);
            idx.push(a, c, b, b, c, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outerR);
    return g;
}

export class Water {
    constructor(scene, island, sky, quality) {
        this.sky = sky;
        const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
            uTime: { value: 0 }, uHalf: { value: island.half }, uData: { value: null },
            uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() },
            uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() },
            uNight: { value: 0 }, uDay: { value: 1 },
        }]);
        uniforms.uData.value = island.buildWaterData();
        this.mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, fog: true, depthWrite: true });
        const geo = polarGrid(quality.waterStep, Math.min(island.half, 180), 2400, quality.waterSegs);
        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.renderOrder = 1;
        this.mesh.name = 'water';
        scene.add(this.mesh);
    }

    update(t) {
        const u = this.mat.uniforms, s = this.sky.state;
        u.uTime.value = t;
        u.uZenith.value.copy(s.zenith);
        u.uHorizon.value.copy(s.horizon);
        u.uSunColor.value.copy(s.sunColor);
        u.uSunDir.value.copy(s.sunDir);
        u.uMoonDir.value.copy(s.moonDir);
        u.uNight.value = s.night;
        u.uDay.value = s.day;
    }
}
