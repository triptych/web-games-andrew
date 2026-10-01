// Day/night cycle: an analytic sky dome (gradient, sun, moon, stars, drifting
// clouds and a faint aurora), the sun/moon light with a shadow box that follows
// the player, hemisphere fill, fog, and a PMREM environment refreshed as the
// light changes. Everything else reads `sky.state` for its own colours.

import * as THREE from 'three';
import { smoothstep, clamp, TAU } from './util.js';

const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;
export { GLSL_NOISE };

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w; // pin to the far plane
}`;

const skyFrag = /* glsl */ `
uniform vec3 uZenith, uHorizon, uSunColor, uSunDir, uMoonDir, uGround;
uniform float uTime, uNight, uCloud, uStars;
varying vec3 vDir;
${GLSL_NOISE}
void main(){
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.45));
  // horizon haze band and ground below
  col = mix(col, uHorizon * 1.08, exp(-up * 18.0) * 0.6);
  if (d.y < 0.0) col = mix(uHorizon, uGround, smoothstep(0.0, -0.25, d.y));

  float sd = dot(d, uSunDir);
  float sunUp = smoothstep(-0.12, 0.05, uSunDir.y);
  // mie glow around the sun, stronger near the horizon
  col += uSunColor * (pow(max(sd, 0.0), 6.0) * 0.35 + pow(max(sd, 0.0), 64.0) * 0.6) * sunUp * (0.6 + 0.8 * exp(-uSunDir.y * 6.0));
  col += uSunColor * smoothstep(0.99955, 0.99975, sd) * 18.0 * sunUp;

  // stars
  if (uStars > 0.001 && d.y > -0.02) {
    vec3 c = floor(d * 260.0);
    float h = hash13(c);
    float star = step(0.9965, h) * smoothstep(0.55, 0.0, length(fract(d * 260.0) - 0.5));
    float tw = 0.6 + 0.4 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
    vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash13(c + 3.1));
    col += sc * star * tw * uStars * 3.0 * smoothstep(-0.02, 0.2, d.y);
    // milky band
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.2, 1.0))) * 3.2, 2.0));
    col += vec3(0.25, 0.3, 0.45) * band * fbm(d.xz * 6.0 + d.y * 3.0) * uStars * 0.35;
    // aurora curtains in the northern sky
    float ah = smoothstep(0.08, 0.35, d.y) * smoothstep(0.85, 0.35, d.y) * smoothstep(0.1, -0.6, d.z);
    float a = fbm(vec2(d.x * 3.0 + uTime * 0.02, d.y * 0.6)) ;
    float curtain = pow(smoothstep(0.35, 0.75, a), 2.0) * (0.6 + 0.4 * sin(d.x * 24.0 + uTime * 0.3 + a * 8.0));
    col += mix(vec3(0.1, 0.9, 0.55), vec3(0.55, 0.3, 1.0), smoothstep(0.2, 0.7, d.y)) * curtain * ah * uStars * 0.55;
  }

  // moon
  float md = dot(d, uMoonDir);
  float moonDisc = smoothstep(0.99925, 0.9995, md);
  if (moonDisc > 0.0) {
    vec3 mp = normalize(cross(uMoonDir, vec3(0, 1, 0)));
    vec2 mu = vec2(dot(d - uMoonDir, mp), dot(d - uMoonDir, cross(mp, uMoonDir))) * 900.0;
    float crater = fbm(mu * 0.25 + 3.0);
    col = mix(col, vec3(0.92, 0.94, 1.0) * (0.75 + crater * 0.4) * 2.2, moonDisc * smoothstep(-0.05, 0.05, uMoonDir.y));
  }
  col += vec3(0.5, 0.6, 0.85) * pow(max(md, 0.0), 120.0) * 0.5 * uNight;

  // clouds on a virtual plane
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12) * 1.3 + vec2(uTime * 0.006, uTime * 0.0025);
    float n = fbm(uv * 1.6);
    float n2 = fbm(uv * 4.0 + 9.0);
    float dens = smoothstep(0.5 - uCloud * 0.25, 0.85, n + n2 * 0.25) * smoothstep(0.0, 0.18, d.y);
    vec3 lit = mix(uHorizon * 1.1, uSunColor * 1.2 + uZenith * 0.25, 0.55 + 0.45 * pow(max(sd, 0.0), 3.0));
    lit = mix(lit, vec3(0.08, 0.1, 0.16), uNight * 0.85);
    vec3 shade = mix(lit * 0.55, uZenith * 0.6, 0.3);
    vec3 cc = mix(lit, shade, smoothstep(0.55, 0.95, n2));
    col = mix(col, cc, dens * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// colour keys over sun elevation
const KEYS = [
    { e: -0.4, zen: '#03060e', hor: '#08101f', sun: '#ff6a3a', gnd: '#02040a' },
    { e: -0.14, zen: '#0b1433', hor: '#23284a', sun: '#ff6a3a', gnd: '#05070f' },
    { e: -0.02, zen: '#25366e', hor: '#e07a5a', sun: '#ff7438', gnd: '#141824' },
    { e: 0.08, zen: '#3f66ad', hor: '#f6b07a', sun: '#ffa660', gnd: '#2c3a40' },
    { e: 0.25, zen: '#3a76cc', hor: '#bcd6ec', sun: '#ffe2b8', gnd: '#3c5258' },
    { e: 1.0, zen: '#2a64c4', hor: '#a8cbeb', sun: '#fff4e6', gnd: '#3c5258' },
];
const KEYC = KEYS.map((k) => ({ e: k.e, zen: new THREE.Color(k.zen), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun), gnd: new THREE.Color(k.gnd) }));

function palette(e, out) {
    let i = 0;
    while (i < KEYC.length - 2 && e > KEYC[i + 1].e) i++;
    const a = KEYC[i], b = KEYC[i + 1];
    const t = clamp((e - a.e) / (b.e - a.e), 0, 1);
    out.zenith.copy(a.zen).lerp(b.zen, t);
    out.horizon.copy(a.hor).lerp(b.hor, t);
    out.sunColor.copy(a.sun).lerp(b.sun, t);
    out.ground.copy(a.gnd).lerp(b.gnd, t);
}

export class Sky {
    constructor(scene, renderer, quality) {
        this.scene = scene;
        this.renderer = renderer;
        this.quality = quality;
        this.time = 0.34;          // 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset
        this.dayLength = 480;      // seconds for a full day
        this.paused = false;
        this.clock = 0;
        this.state = {
            sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), lightDir: new THREE.Vector3(),
            zenith: new THREE.Color(), horizon: new THREE.Color(), sunColor: new THREE.Color(), ground: new THREE.Color(),
            night: 0, day: 1, sunElev: 0.5,
        };

        this.uniforms = {
            uZenith: { value: this.state.zenith }, uHorizon: { value: this.state.horizon },
            uSunColor: { value: this.state.sunColor }, uGround: { value: this.state.ground },
            uSunDir: { value: this.state.sunDir }, uMoonDir: { value: this.state.moonDir },
            uTime: { value: 0 }, uNight: { value: 0 }, uCloud: { value: 0.3 }, uStars: { value: 0 },
        };
        const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false });
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
        this.dome.frustumCulled = false;
        this.dome.renderOrder = -10;
        scene.add(this.dome);

        // environment capture uses a copy of the dome
        this.envScene = new THREE.Scene();
        this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));
        this.pmrem = new THREE.PMREMGenerator(renderer);
        this.envRT = null;
        this.envTimer = 0;
        this.lastEnvElev = 9;

        this.sun = new THREE.DirectionalLight(0xffffff, 3);
        this.sun.castShadow = quality.shadows > 0;
        if (this.sun.castShadow) {
            this.sun.shadow.mapSize.set(quality.shadows, quality.shadows);
            const c = this.sun.shadow.camera;
            const S = quality.shadowBox;
            c.left = -S; c.right = S; c.top = S; c.bottom = -S; c.near = 1; c.far = 260;
            this.sun.shadow.bias = -0.0004;
            this.sun.shadow.normalBias = 0.04;
            this.sun.shadow.radius = 3;
        }
        scene.add(this.sun, this.sun.target);
        this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x445533, 1);
        scene.add(this.hemi);

        scene.fog = new THREE.FogExp2(0xa8cbeb, 0.0042);
        this.update(0, new THREE.Vector3());
        this.refreshEnv();
    }

    setTime(t) {
        this.time = ((t % 1) + 1) % 1;
        this.envTimer = 99;
    }

    /** Hour of day as "HH:MM". */
    clockText() {
        const mins = Math.floor(this.time * 24 * 60);
        return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }

    update(dt, focus) {
        this.clock += dt;
        if (!this.paused) this.time = (this.time + dt / this.dayLength) % 1;
        const s = this.state;
        const a = (this.time - 0.25) * TAU;
        s.sunDir.set(Math.cos(a), Math.sin(a) * 0.92, 0.38).normalize();
        s.moonDir.set(-Math.cos(a) * 0.9, -Math.sin(a) * 0.85, -0.3).normalize();
        s.sunElev = s.sunDir.y;
        palette(s.sunElev, s);
        s.night = 1 - smoothstep(-0.14, 0.06, s.sunElev);
        s.day = smoothstep(-0.05, 0.3, s.sunElev);

        const u = this.uniforms;
        u.uTime.value = this.clock;
        u.uNight.value = s.night;
        u.uStars.value = smoothstep(0.35, 1, s.night);

        // the key light is the sun by day and the moon by night
        const sunUp = smoothstep(-0.06, 0.08, s.sunElev);
        const moonUp = smoothstep(-0.02, 0.15, s.moonDir.y) * (1 - sunUp);
        if (sunUp > 0.001 || moonUp < 0.001) {
            s.lightDir.copy(s.sunDir);
            this.sun.color.copy(s.sunColor);
            this.sun.intensity = sunUp * (1.2 + 2.2 * smoothstep(0.0, 0.4, s.sunElev));
        } else {
            s.lightDir.copy(s.moonDir);
            this.sun.color.setRGB(0.55, 0.65, 1.0);
            this.sun.intensity = moonUp * 0.55;
        }
        if (s.lightDir.y < 0.06) s.lightDir.y = 0.06;
        s.lightDir.normalize();

        // shadow box follows the focus, snapped to texels to stop shimmering
        const box = this.quality.shadowBox * 2;
        const texel = box / (this.quality.shadows || 1024);
        const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
        this.sun.target.position.set(fx, focus.y, fz);
        this.sun.position.set(fx + s.lightDir.x * 120, focus.y + s.lightDir.y * 120, fz + s.lightDir.z * 120);
        this.sun.target.updateMatrixWorld();

        this.hemi.color.copy(s.zenith).lerp(s.horizon, 0.5).multiplyScalar(1.0);
        this.hemi.groundColor.set(0x3d4a2e).multiplyScalar(0.4 + 0.6 * s.day);
        this.hemi.intensity = 0.35 + 1.1 * s.day + s.night * 0.9;
        if (s.night > 0.5) this.hemi.color.setRGB(0.25, 0.32, 0.55);

        this.scene.fog.color.copy(s.horizon);
        this.dome.position.copy(focus);

        this.envTimer += dt;
        if (this.envTimer > 1.5 && Math.abs(this.lastEnvElev - s.sunElev) > 0.02) this.refreshEnv();
    }

    refreshEnv() {
        this.envTimer = 0;
        this.lastEnvElev = this.state.sunElev;
        const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
        this.scene.environment = rt.texture;
        // dim the reflections at night so marble doesn't glow
        this.scene.environmentIntensity = 0.35 + 0.65 * this.state.day;
        if (this.envRT) this.envRT.dispose();
        this.envRT = rt;
    }
}
