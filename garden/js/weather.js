// Weather: clear, rain, fog, snow and thunderstorm. A preset sets target
// amounts; they ease in over a few seconds and drive the sky (overcast, fog
// density, lightning flashes), the wind, the soundscape and two camera-centred
// precipitation volumes that run entirely in the vertex shader.

import * as THREE from 'three';
import { rng, damp } from './util.js';

export const WEATHER = {
    clear: { label: 'Clear', rain: 0, snow: 0, fog: 0, storm: 0 },
    rain: { label: 'Rain', rain: 0.8, snow: 0, fog: 0.2, storm: 0 },
    fog: { label: 'Fog', rain: 0, snow: 0, fog: 1, storm: 0 },
    snow: { label: 'Snow', rain: 0, snow: 1, fog: 0.25, storm: 0 },
    storm: { label: 'Thunderstorm', rain: 1, snow: 0, fog: 0.15, storm: 1 },
};

const BOX = new THREE.Vector3(34, 22, 34);

const rainVert = /* glsl */ `
uniform float uTime, uIntensity, uSpeed, uLen;
uniform vec3 uCenter, uBox, uWind;
attribute vec4 aDrop; // x y z in 0..1, seed
attribute float aEnd;
varying float vAlpha;
void main(){
  vec3 p = aDrop.xyz * uBox + vec3(uWind.x, -uSpeed, uWind.z) * uTime;
  vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 head = uCenter + rel;
  vec3 dir = normalize(vec3(-uWind.x, uSpeed, -uWind.z));
  vec3 wp = head + dir * uLen * aEnd;
  float on = step(aDrop.w, uIntensity);
  float edge = smoothstep(0.5, 0.3, length(rel.xz) / (uBox.x * 0.5));
  vAlpha = on * edge * mix(0.55, 0.0, aEnd);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const rainFrag = /* glsl */ `
uniform vec3 uTint;
varying float vAlpha;
void main(){
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(uTint, vAlpha);
  #include <colorspace_fragment>
}`;

const snowVert = /* glsl */ `
uniform float uTime, uIntensity, uScale;
uniform vec3 uCenter, uBox;
attribute vec4 aFlake; // x y z in 0..1, seed
varying float vAlpha;
void main(){
  float ph = aFlake.w * 40.0;
  vec3 p = aFlake.xyz * uBox - vec3(0.0, uTime * (0.9 + aFlake.w * 0.8), 0.0);
  p.x += sin(uTime * 0.7 + ph) * 0.8 + uTime * 0.6;
  p.z += cos(uTime * 0.55 + ph * 1.3) * 0.8;
  vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  float on = step(aFlake.w, uIntensity);
  float edge = smoothstep(0.5, 0.3, length(rel.xz) / (uBox.x * 0.5));
  vAlpha = on * edge * (0.55 + 0.45 * aFlake.w);
  vec4 mv = viewMatrix * vec4(uCenter + rel, 1.0);
  gl_PointSize = (0.07 + aFlake.w * 0.09) * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const snowFrag = /* glsl */ `
uniform vec3 uTint;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.2, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uTint, a);
  #include <colorspace_fragment>
}`;

export class Weather {
    constructor(scene, sky, audio, quality) {
        this.sky = sky;
        this.audio = audio;
        this.name = 'clear';
        this.v = { rain: 0, snow: 0, fog: 0, storm: 0 };
        this.target = { ...WEATHER.clear };
        this.lightningTimer = 8;
        this.flashAge = 99;
        this.audioTimer = 0;
        this.tint = new THREE.Color();
        this.center = new THREE.Vector3();

        const hi = quality.tier === 'high', mid = quality.tier === 'medium';
        const nRain = hi ? 12000 : mid ? 7000 : 3500;
        const nSnow = hi ? 4500 : mid ? 2800 : 1400;
        const r = rng('weather');

        // rain: a line segment per drop, head at the bottom
        const rp = new Float32Array(nRain * 2 * 4), re = new Float32Array(nRain * 2);
        for (let i = 0; i < nRain; i++) {
            const x = r(), y = r(), z = r(), seed = i / nRain; // seed sweeps 0..1 so intensity thins the shower evenly
            for (let e = 0; e < 2; e++) {
                rp.set([x, y, z, seed], (i * 2 + e) * 4);
                re[i * 2 + e] = e;
            }
        }
        const rg = new THREE.BufferGeometry();
        rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nRain * 2 * 3), 3));
        rg.setAttribute('aDrop', new THREE.BufferAttribute(rp, 4));
        rg.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
        this.rainU = {
            uTime: { value: 0 }, uIntensity: { value: 0 }, uSpeed: { value: 26 }, uLen: { value: 0.9 },
            uCenter: { value: this.center }, uBox: { value: BOX }, uWind: { value: new THREE.Vector3() }, uTint: { value: this.tint },
        };
        this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ uniforms: this.rainU, vertexShader: rainVert, fragmentShader: rainFrag, transparent: true, depthWrite: false }));
        this.rain.frustumCulled = false;
        this.rain.renderOrder = 7;
        this.rain.visible = false;
        scene.add(this.rain);

        // snow: soft round points that wobble as they fall
        const sp = new Float32Array(nSnow * 4);
        for (let i = 0; i < nSnow; i++) sp.set([r(), r(), r(), i / nSnow], i * 4);
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSnow * 3), 3));
        sg.setAttribute('aFlake', new THREE.BufferAttribute(sp, 4));
        this.snowU = {
            uTime: { value: 0 }, uIntensity: { value: 0 }, uScale: { value: 800 },
            uCenter: { value: this.center }, uBox: { value: BOX }, uTint: { value: this.tint },
        };
        this.snow = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.snowU, vertexShader: snowVert, fragmentShader: snowFrag, transparent: true, depthWrite: false }));
        this.snow.frustumCulled = false;
        this.snow.renderOrder = 7;
        this.snow.visible = false;
        scene.add(this.snow);
    }

    set(name) {
        const w = WEATHER[name];
        if (!w) return;
        this.name = name;
        Object.assign(this.target, w);
        this.lightningTimer = w.storm ? 2 + Math.random() * 3 : 8;
        this.sky.lastEnvElev = 9; // reflections pick up the new light
    }

    update(dt, t, camPos, viewportH, below) {
        const v = this.v, tg = this.target, sky = this.sky;
        for (const k in v) v[k] = damp(v[k], tg[k], 0.7, dt);
        for (const k in v) if (Math.abs(v[k] - tg[k]) < 0.002) v[k] = tg[k];

        // lightning: a flash with a flicker, thunder a beat later
        if (tg.storm > 0 && v.storm > 0.6) {
            this.lightningTimer -= dt;
            if (this.lightningTimer <= 0) {
                this.lightningTimer = 5 + Math.random() * 11;
                this.flashAge = 0;
                const far = Math.random();
                setTimeout(() => this.audio.thunder(far), 300 + far * 2600);
            }
        }
        this.flashAge += dt;
        const a = this.flashAge;
        const flash = a < 1.5 ? Math.exp(-a * 11) + (a > 0.17 ? 0.75 * Math.exp(-(a - 0.17) * 9) : 0) : 0;

        if (Object.keys(v).some((k) => v[k] !== tg[k])) sky.lastEnvElev = 9;

        const wx = sky.wx;
        wx.overcast = Math.max(v.rain * 0.8, v.snow * 0.75, v.storm, v.fog * 0.45);
        wx.fog = v.fog;
        wx.density = v.fog * 0.02 + v.rain * 0.0025 + v.snow * 0.005 + v.storm * 0.003;
        wx.flash = flash;
        wx.snow = v.snow;

        const wind = Math.max(v.storm, v.rain * 0.5, v.snow * 0.3);
        // precipitation follows the camera and takes the sky's light
        this.center.copy(camPos);
        this.tint.copy(sky.state.horizon).multiplyScalar(1.35).lerp(new THREE.Color(0.85, 0.9, 1), 0.35);
        this.tint.multiplyScalar(0.35 + 0.65 * sky.state.day);
        const rainOn = v.rain > 0.01 && !below, snowOn = v.snow > 0.01 && !below;
        this.rain.visible = rainOn;
        this.snow.visible = snowOn;
        if (rainOn) {
            const u = this.rainU;
            u.uTime.value = t;
            u.uIntensity.value = v.rain;
            u.uWind.value.set(-(2 + v.storm * 5), 0, -(0.8 + v.storm * 2));
            u.uSpeed.value = 24 + v.storm * 8;
            u.uLen.value = 0.8 + v.storm * 0.4;
        }
        if (snowOn) {
            const u = this.snowU;
            u.uTime.value = t;
            u.uIntensity.value = v.snow;
            u.uScale.value = viewportH * 0.9;
        }

        this.audioTimer += dt;
        if (this.audioTimer > 0.4) {
            this.audioTimer = 0;
            this.audio.setWeather(v.rain, wind, below);
        }
        return wind;
    }
}
