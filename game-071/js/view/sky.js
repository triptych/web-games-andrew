/**
 * sky.js — atmosphere, sun, moons, stars, aurora, clouds and the lights they cast.
 *
 * A single-scattering atmosphere (Rayleigh + Mie) is rendered into a 256×128 equirect HDR
 * texture whenever the sun moves; the dome, the global fog and the PBR environment map all
 * read that one texture, so distant hills fade into exactly the sky behind them.
 */
import * as THREE from 'three';
import { G, GLSL_NOISE, GLSL_SKY } from './shaders.js';

const LUT_W = 256, LUT_H = 128;

const quadVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const lutFrag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec3 uSun; uniform vec3 uMoon; uniform float uCover; uniform float uNight; uniform float uMoonLight; uniform float uAlt;
#define PI 3.141592653589793
vec2 rsi(vec3 r0, vec3 rd, float sr) {
    float a = dot(rd, rd), b = 2.0 * dot(rd, r0), c = dot(r0, r0) - sr * sr;
    float d = b * b - 4.0 * a * c;
    if (d < 0.0) return vec2(1e5, -1e5);
    return vec2((-b - sqrt(d)) / (2.0 * a), (-b + sqrt(d)) / (2.0 * a));
}
vec3 atmosphere(vec3 r, vec3 r0, vec3 pSun, float iSun) {
    const float rPlanet = 6371e3, rAtmos = 6471e3;
    const vec3 kRlh = vec3(5.5e-6, 13.0e-6, 22.4e-6);
    const float kMie = 21e-6, shRlh = 8e3, shMie = 1.2e3, g = 0.758;
    vec2 p = rsi(r0, r, rAtmos);
    if (p.x > p.y) return vec3(0.0);
    vec2 pg = rsi(r0, r, rPlanet);
    if (pg.x > 0.0 && pg.x < pg.y) p.y = min(p.y, pg.x);
    const int iSteps = 16, jSteps = 6;
    float iStep = (p.y - max(p.x, 0.0)) / float(iSteps);
    float iTime = max(p.x, 0.0);
    vec3 totalRlh = vec3(0.0), totalMie = vec3(0.0);
    float iOdRlh = 0.0, iOdMie = 0.0;
    float mu = dot(r, pSun), mumu = mu * mu, gg = g * g;
    float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
    float pMie = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));
    for (int i = 0; i < iSteps; i++) {
        vec3 iPos = r0 + r * (iTime + iStep * 0.5);
        float iHeight = length(iPos) - rPlanet;
        float odStepRlh = exp(-iHeight / shRlh) * iStep, odStepMie = exp(-iHeight / shMie) * iStep;
        iOdRlh += odStepRlh; iOdMie += odStepMie;
        float jStep = rsi(iPos, pSun, rAtmos).y / float(jSteps);
        float jTime = 0.0, jOdRlh = 0.0, jOdMie = 0.0;
        for (int j = 0; j < jSteps; j++) {
            vec3 jPos = iPos + pSun * (jTime + jStep * 0.5);
            float jHeight = length(jPos) - rPlanet;
            jOdRlh += exp(-jHeight / shRlh) * jStep;
            jOdMie += exp(-jHeight / shMie) * jStep;
            jTime += jStep;
        }
        vec3 attn = exp(-(kMie * (iOdMie + jOdMie) + kRlh * (iOdRlh + jOdRlh)));
        totalRlh += odStepRlh * attn;
        totalMie += odStepMie * attn;
        iTime += iStep;
    }
    return iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);
}
void main() {
    float az = (vUv.x - 0.5) * 2.0 * PI;
    float el = (vUv.y - 0.5) * PI;
    vec3 d = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
    vec3 dd = vec3(d.x, max(d.y, -0.05), d.z);
    vec3 r0 = vec3(0.0, 6372e3 + uAlt, 0.0);
    vec3 col = atmosphere(normalize(dd), r0, uSun, 22.0);
    if (uMoonLight > 0.001) col += atmosphere(normalize(dd), r0, uMoon, 22.0) * uMoonLight * vec3(0.75, 0.85, 1.2);
    col += vec3(0.0016, 0.0028, 0.0068) * uNight;                         // airglow so night is never black
    // overcast: the sky greys toward a flat bright-or-dark cloud deck
    float dayL = clamp(uSun.y * 3.0 + 0.25, 0.0, 1.0);
    vec3 deck = mix(vec3(0.006, 0.008, 0.012), vec3(0.42, 0.45, 0.5), dayL) * (0.85 + 0.15 * clamp(d.y * 3.0, 0.0, 1.0));
    col = mix(col, deck, uCover * 0.82);
    // below the horizon: a dim, bluish ground haze
    if (d.y < 0.0) col *= mix(1.0, 0.45, clamp(-d.y * 4.0, 0.0, 1.0));
    if (!(col.r >= 0.0 && col.g >= 0.0 && col.b >= 0.0) || col.r > 1e4) col = vec3(0.0);
    gl_FragColor = vec4(col, 1.0);
}`;

const domeVert = /* glsl */`
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;   // always at the far plane
}`;

const domeFrag = /* glsl */`
uniform float uTime; uniform vec3 uSunReal; uniform vec3 uMoon1; uniform vec3 uMoon2; uniform float uPhase1; uniform float uPhase2;
uniform float uNight; uniform float uCover; uniform float uAurora; uniform float uAuroraSteps; uniform float uCloudOct;
uniform vec3 uCloudSun; uniform vec3 uCloudAmb; uniform vec2 uCloudOff; uniform float uLightning; uniform float uStarVis;
varying vec3 vDir;
${GLSL_NOISE}
${GLSL_SKY}
float cloudFbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { if (float(i) >= uCloudOct) break; s += a * vnoise(p); p = p * 2.07 + 13.7; a *= 0.5; } return s; }
float cloudD(vec2 p) {
    float n = cloudFbm(p);
    float lo = mix(0.64, 0.28, uCover), hi = lo + 0.22;
    return smoothstep(lo, hi, n);
}
vec3 stars(vec3 d) {
    vec3 c = vec3(0.0);
    for (int L = 0; L < 2; L++) {
        float sc = L == 0 ? 160.0 : 380.0;
        vec3 p = d * sc;
        vec3 id = floor(p);
        vec3 f = fract(p) - 0.5;
        float h = hash13(id);
        if (h > (L == 0 ? 0.965 : 0.985)) {
            vec3 o = vec3(hash13(id + 1.7), hash13(id + 4.1), hash13(id + 9.3)) - 0.5;
            float dd = length(f - o * 0.7);
            float tw = 0.65 + 0.35 * sin(uTime * (2.0 + h * 6.0) + h * 40.0);
            float b = smoothstep(0.08, 0.0, dd) * tw * (L == 0 ? 1.6 : 0.7);
            vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.65), hash13(id + 2.2));
            c += tint * b;
        }
    }
    // a faint band of the galaxy
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.4, -0.85))) * 4.0, 2.0));
    c += vec3(0.08, 0.09, 0.12) * band * (0.4 + 0.6 * fbm3(d * 6.0)) * 0.4;
    return c;
}
vec3 moon(vec3 d, vec3 md, float size, float phase, vec3 tint) {
    float c = dot(d, md);
    float cs = cos(size);
    if (c < cs - 0.002) return vec3(0.0);
    // local disc coordinates
    vec3 up = abs(md.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    vec3 r = normalize(cross(up, md)), u = cross(md, r);
    vec2 q = vec2(dot(d, r), dot(d, u)) / sin(size);
    float rr = dot(q, q);
    if (rr > 1.0) return vec3(0.0);
    vec3 n = vec3(q, sqrt(1.0 - rr));
    vec3 L = normalize(vec3(cos(phase), 0.0, sin(phase)));
    float lit = smoothstep(-0.05, 0.15, dot(n, L));
    float craters = 0.75 + 0.25 * fbm2(q * 3.0 + size * 10.0) - 0.15 * smoothstep(0.55, 0.62, vnoise(q * 5.0 + 3.0));
    float edge = smoothstep(1.0, 0.96, rr);
    return tint * (lit * craters * 2.2 + 0.04) * edge;
}
vec3 aurora(vec3 d) {
    vec3 acc = vec3(0.0);
    float steps = uAuroraSteps;
    float j = hash12(gl_FragCoord.xy);
    for (int i = 0; i < 24; i++) {
        if (float(i) >= steps) break;
        float t = (float(i) + j) / steps;
        float hgt = mix(1.0, 2.4, t);
        vec2 P = d.xz * (hgt / max(d.y, 0.06)) * 1.0;
        vec2 c = P * 0.32 + vec2(0.0, 1.5);
        float warp = fbm2(c * 0.45 + vec2(uTime * 0.012, -uTime * 0.008));
        float band = abs(sin((c.x * 0.9 + warp * 3.2) + c.y * 0.35));
        float sheet = exp(-band * 9.0) + 0.35 * exp(-band * 3.0);
        float streak = 0.55 + 0.45 * vnoise(vec2((c.x + warp * 3.2) * 7.0, uTime * 0.25));
        float region = smoothstep(0.2, 0.7, fbm2(c * 0.2 - vec2(uTime * 0.004, 0.0)));
        vec3 col = mix(vec3(0.1, 1.0, 0.45), vec3(0.55, 0.15, 1.0), smoothstep(0.25, 1.0, t));
        acc += col * sheet * streak * region * (1.0 - t * 0.6);
    }
    return acc / steps * 1.8 * smoothstep(0.02, 0.25, d.y);
}
void main() {
    vec3 d = normalize(vDir);
    vec3 col = skyLookup(d);
    float above = smoothstep(-0.02, 0.04, d.y);
    // stars & moons fade with the light and the clouds
    float starVis = uStarVis * (1.0 - uCover * 0.9) * above;
    if (starVis > 0.0) col += stars(d) * starVis;
    col += moon(d, uMoon1, 0.055, uPhase1, vec3(0.92, 0.9, 0.85)) * above * (1.0 - uCover * 0.8) * (0.3 + 0.7 * uNight);
    col += moon(d, uMoon2, 0.026, uPhase2, vec3(0.7, 0.82, 1.0)) * above * (1.0 - uCover * 0.8) * (0.3 + 0.7 * uNight);
    // sun disc with limb darkening, behind the clouds
    float sd = dot(d, uSunReal);
    float disc = smoothstep(0.99985, 0.99992, sd);
    col += vec3(1.0, 0.92, 0.8) * disc * 60.0 * (1.0 - uCover * 0.95) * smoothstep(-0.02, 0.02, uSunReal.y);
    if (uAurora > 0.0 && d.y > 0.02) col += aurora(d) * uAurora * (1.0 - uCover * 0.85);
    // clouds on a plane 1.6 km up
    if (d.y > 0.0) {
        vec2 p = d.xz / (d.y + 0.08) * 1.6 + uCloudOff;
        float den = cloudD(p * 1.4);
        if (den > 0.001) {
            float shade = cloudD(p * 1.4 + uSunReal.xz * 0.12);
            float light = exp(-shade * 2.2);
            float silver = pow(max(sd, 0.0), 10.0) * (1.0 - den) * 3.0;
            vec3 cc = uCloudAmb * (0.6 + 0.4 * d.y) + uCloudSun * (light * 0.9 + silver);
            cc += vec3(0.8, 0.85, 1.0) * uLightning * 3.0;
            float fade = smoothstep(0.0, 0.18, d.y);
            col = mix(col, cc, den * fade * 0.95);
        }
    }
    col += vec3(0.7, 0.75, 0.9) * uLightning * 0.6 * above;
    gl_FragColor = vec4(col, 1.0);
}`;

function sunDirection(hour, out) {
    const a = (hour - 6) / 12 * Math.PI;
    out.set(Math.cos(a), Math.sin(a) * 0.80, Math.sin(a) * 0.60).normalize();
    return out;
}

export class Sky {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.lut = new THREE.WebGLRenderTarget(LUT_W, LUT_H, { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
        this.lut.texture.wrapS = THREE.RepeatWrapping;
        this.lutMat = new THREE.ShaderMaterial({
            vertexShader: quadVert, fragmentShader: lutFrag, depthTest: false, depthWrite: false,
            uniforms: { uSun: { value: new THREE.Vector3() }, uMoon: { value: new THREE.Vector3() }, uCover: { value: 0 }, uNight: { value: 0 }, uMoonLight: { value: 0 }, uAlt: { value: 0 } },
        });
        this.lutScene = new THREE.Scene();
        this.lutScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.lutMat));
        this.lutCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        G.uSkyTex.value = this.lut.texture;

        this.domeU = {
            uTime: G.uTime, uSkyTex: G.uSkyTex,
            uSunReal: { value: new THREE.Vector3(0, 1, 0) }, uMoon1: { value: new THREE.Vector3() }, uMoon2: { value: new THREE.Vector3() },
            uPhase1: { value: 0 }, uPhase2: { value: 0 }, uNight: { value: 0 }, uCover: { value: 0 }, uAurora: { value: 0 },
            uAuroraSteps: { value: 16 }, uCloudOct: { value: 5 }, uCloudSun: { value: new THREE.Color() }, uCloudAmb: { value: new THREE.Color() },
            uCloudOff: { value: new THREE.Vector2() }, uLightning: G.uLightning, uStarVis: { value: 0 },
        };
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({
            vertexShader: domeVert, fragmentShader: domeFrag, uniforms: this.domeU, side: THREE.BackSide, depthWrite: false, fog: false,
        }));
        this.dome.frustumCulled = false;
        this.dome.renderOrder = -10;
        scene.add(this.dome);

        // the sun (or moon) light with a shadow box that follows the camera
        this.light = new THREE.DirectionalLight(0xffffff, 3);
        this.light.castShadow = true;
        this.light.shadow.bias = -0.0004;
        this.light.shadow.normalBias = 0.6;
        scene.add(this.light, this.light.target);
        this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a4030, 0.25);
        scene.add(this.hemi);

        this.pmrem = new THREE.PMREMGenerator(renderer.gl);
        this.envRT = null;
        this.envTimer = 0;
        this.sun = new THREE.Vector3();
        this.moon1 = new THREE.Vector3();
        this.moon2 = new THREE.Vector3();
        this.lastSun = new THREE.Vector3(9, 9, 9);
        this.lastCover = -1;
        this.cloudOff = new THREE.Vector2();
        this.state = { hour: 12, day: 0, cover: 0, fog: 0, rain: 0, snow: 0, aurora: 0 };
        this.lightCol = new THREE.Color();
        this.envEvery = 6;
    }

    setQuality(q, tier) {
        this.domeU.uAuroraSteps.value = q.aurora;
        this.domeU.uCloudOct.value = q.clouds;
        this.light.castShadow = q.shadow > 0;
        if (q.shadow > 0) {
            this.light.shadow.mapSize.set(q.shadow, q.shadow);
            this.light.shadow.map?.dispose();
            this.light.shadow.map = null;
            const b = q.shadowBox;
            const c = this.light.shadow.camera;
            c.left = -b; c.right = b; c.top = b; c.bottom = -b; c.near = 1; c.far = 900;
            c.updateProjectionMatrix();
        }
        this.envEvery = [5, 6, 15, 1e9][tier];
        this.useEnv = tier < 3;
        if (!this.useEnv) this.scene.environment = null;
        this.envTimer = 1e9;
    }

    /**
     * @param s {hour, day, cover 0..1, fog 0..1, aurora 0..1, lightning 0..1, interior}
     * @param cam camera (shadow box & dome follow it)
     */
    update(dt, s, cam) {
        this.state = s;
        const sun = sunDirection(s.hour, this.sun);
        const night = THREE.MathUtils.smoothstep(-sun.y, -0.02, 0.18);  // 1 when the sun is well down
        const ma = (s.hour - 6) / 12 * Math.PI + Math.PI + 0.35 + s.day * 0.21;
        this.moon1.set(Math.cos(ma), Math.sin(ma) * 0.7 + 0.1, Math.sin(ma) * 0.5 - 0.25).normalize();
        const mb = ma - 0.9 + s.day * 0.37;
        this.moon2.set(Math.cos(mb) * 0.9, Math.sin(mb) * 0.6 + 0.18, Math.sin(mb) * 0.55 + 0.1).normalize();
        const moonUp = this.moon1.y > 0.05;

        // atmosphere LUT when the sun moves enough or the clouds change
        if (this.lastSun.distanceToSquared(sun) > 2e-6 || Math.abs(this.lastCover - s.cover) > 0.01) {
            this.lastSun.copy(sun); this.lastCover = s.cover;
            const u = this.lutMat.uniforms;
            u.uSun.value.copy(sun);
            u.uMoon.value.copy(this.moon1);
            u.uCover.value = s.cover;
            u.uNight.value = night;
            u.uMoonLight.value = moonUp ? 0.006 * night : 0;
            const gl = this.renderer.gl;
            const prev = gl.getRenderTarget();
            gl.setRenderTarget(this.lut);
            gl.render(this.lutScene, this.lutCam);
            gl.setRenderTarget(prev);
        }

        // dome
        const d = this.domeU;
        d.uSunReal.value.copy(sun);
        d.uMoon1.value.copy(this.moon1);
        d.uMoon2.value.copy(this.moon2);
        d.uPhase1.value = (s.day * 0.4 + 1.2) % (Math.PI * 2);
        d.uPhase2.value = (s.day * 0.9 + 2.5) % (Math.PI * 2);
        d.uNight.value = night;
        d.uStarVis.value = night;
        d.uCover.value = s.cover;
        d.uAurora.value = night * (s.aurora || 0);
        this.cloudOff.x += dt * G.uWind.value.x * 0.004;
        this.cloudOff.y += dt * G.uWind.value.y * 0.004;
        d.uCloudOff.value.copy(this.cloudOff);
        const day = THREE.MathUtils.smoothstep(sun.y, -0.1, 0.3);
        const warm = 1 - THREE.MathUtils.smoothstep(sun.y, 0.0, 0.35);
        d.uCloudSun.value.setRGB(1.0, 0.85 - warm * 0.35, 0.7 - warm * 0.5).multiplyScalar(day * 1.6 * (1 - s.cover * 0.6) + 0.02);
        d.uCloudAmb.value.setRGB(0.55, 0.6, 0.7).multiplyScalar(0.03 + day * 0.55 * (1 - s.cover * 0.3));
        this.dome.position.copy(cam.position);

        // the light: the sun by day, the larger moon by night
        const sunUp = sun.y > -0.06;
        const L = this.light;
        let dir, inten;
        const col = this.lightCol;
        if (sunUp) {
            dir = sun;
            inten = THREE.MathUtils.smoothstep(sun.y, -0.06, 0.15) * 3.4 * (1 - s.cover * 0.72);
            col.setRGB(1.0, 0.93 - warm * 0.28, 0.82 - warm * 0.5);
        } else {
            dir = moonUp ? this.moon1 : new THREE.Vector3(0.2, 0.9, 0.3).normalize();
            inten = (moonUp ? 0.42 : 0.18) * night * (1 - s.cover * 0.6);
            col.setRGB(0.55, 0.66, 0.95);
        }
        if (s.interior) inten = 0;
        L.color.copy(col);
        L.intensity = inten;
        G.uSunDir.value.copy(dir);
        G.uSunCol.value.copy(col).multiplyScalar(inten);
        G.uNight.value = night;
        // in-scatter glow toward the light, stronger at golden hour
        G.uSunFog.value.setRGB(1.0, 0.72, 0.42).multiplyScalar((sunUp ? (0.25 + warm * 0.9) : 0.05) * (1 - s.cover * 0.6) * day + 0.01);
        // fog: thicker at night, in weather, and low in valleys
        G.uFogDensity.value = (0.00055 + s.fog * 0.006 + s.cover * 0.0006 + night * 0.0002) * (s.interior ? 0 : 1);
        G.uFogFalloff.value = 0.0045 + s.fog * 0.002;
        G.uFogBase.value = 30;
        this.hemi.intensity = (0.12 + day * 0.25) * (s.interior ? 0 : 1);
        this.hemi.color.setRGB(0.65 + day * 0.1, 0.72 + day * 0.1, 0.9);
        this.hemi.groundColor.setRGB(0.25, 0.22, 0.18).multiplyScalar(0.4 + day * 0.6);

        // shadow box follows the camera, snapped to texels so edges don't crawl
        const q = cam.position;
        const sdist = 400;
        if (L.castShadow) {
            const box = L.shadow.camera.right;
            const texel = (box * 2) / L.shadow.mapSize.x;
            const tx = Math.round(q.x / texel) * texel, tz = Math.round(q.z / texel) * texel;
            L.target.position.set(tx, q.y, tz);
            L.position.set(tx + dir.x * sdist, q.y + dir.y * sdist, tz + dir.z * sdist);
        } else {
            L.target.position.copy(q);
            L.position.copy(q).addScaledVector(dir, sdist);
        }
        L.target.updateMatrixWorld();

        // environment lighting from the sky, refreshed now and then
        this.envTimer += dt;
        if (this.useEnv && this.envTimer > this.envEvery) {
            this.envTimer = 0;
            const rt = this.pmrem.fromEquirectangular(this.lut.texture);
            if (this.envRT) this.envRT.dispose();
            this.envRT = rt;
            if (!s.interior) this.scene.environment = rt.texture;
        }
        this.scene.environmentIntensity = s.interior ? 0 : 0.9;
        return { sun, night, day, warm };
    }

    /** Sun position in screen space for god rays; z = visibility (0..1). */
    sunScreen(cam, out) {
        const p = this._tmp || (this._tmp = new THREE.Vector3());
        p.copy(this.sun).multiplyScalar(1000).add(cam.position).project(cam);
        const vis = p.z < 1 && Math.abs(p.x) < 1.4 && Math.abs(p.y) < 1.4 ? THREE.MathUtils.smoothstep(this.sun.y, -0.02, 0.08) : 0;
        out.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5, vis);
        return out;
    }
}
