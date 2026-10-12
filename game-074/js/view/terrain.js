// Terrain meshes. The floor and ceiling are built in 16-unit chunks straight
// from the sim's Terrain functions: each column is a rounded ridge whose crest
// sits exactly on the collision line at z = 0, falling away in front (toward
// the camera) and behind, so what reads as solid is exactly what is solid.
// A custom shader paints stone, bone, iron, flesh or ice with glowing veins and
// lights it with the stage lights plus Cael's own glow.
//
// Lava and water stages also get a sea: a wide animated plane to the horizon.

import * as THREE from 'three';
import { NONE_FLOOR, NONE_CEIL } from '../sim/terrain.js';
import { NOISE_GLSL, noise3 } from './lib.js';

const CW = 16, STEP = 0.2;
// [z, dy] rows from the back of the ridge to its front face
const ROWS = [[-6, -5.5], [-4, -2.8], [-2.6, -1.25], [-1.5, -0.5], [-0.7, -0.12], [0, 0], [0.5, -0.08], [1.1, -0.36], [1.8, -1.05], [2.5, -2.6], [3.1, -8]];

const TERRAIN_VS = `
varying vec3 vObj; varying vec3 vWorld; varying vec3 vN; varying float vDepth;
void main(){
  vObj = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * w;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const TERRAIN_FS = `
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vN; varying float vDepth;
uniform vec3 uBase, uDark, uGlow, uEdge, uKeyDir, uKeyCol, uSky, uGround, uFog, uPlayer, uHalo;
uniform float uGlowAmt, uVein, uTime, uFogNear, uFogFar, uStyle, uCeil, uBand;
${NOISE_GLSL}
float fbm(vec3 p){ return vn3(p) * 0.55 + vn3(p * 2.1 + 3.1) * 0.28 + vn3(p * 4.3 + 7.7) * 0.17; }
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 p = vObj;
  float n1 = fbm(p * 0.55);
  float n2 = fbm(p * 2.4 + 11.0);
  vec3 base = mix(uDark, uBase, smoothstep(0.25, 0.75, n1)) * (0.8 + 0.4 * n2);
  // strata bands
  base *= 1.0 - uBand * 0.18 * step(0.5, fract(p.y * 1.3 + n1 * 1.6));
  // veins
  float v = abs(fbm(p * uVein + vec3(0.0, 0.0, uTime * 0.05)) - 0.5);
  float mask = smoothstep(0.48, 0.72, fbm(p * 0.22 + 31.0));
  float vein = smoothstep(0.02, 0.0, v) * (0.15 + 0.85 * mask);
  float pulse = 0.75 + 0.25 * sin(uTime * 2.2 + p.x * 0.4);
  // lighting
  vec3 L = normalize(uKeyDir);
  float diff = max(dot(N, L), 0.0);
  vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 toP = uPlayer - vWorld;
  float d = length(toP);
  float pl = max(dot(N, toP / max(d, 1e-3)), 0.0) * 2.4 / (1.0 + d * d * 0.18);
  vec3 col = base * (hemi + diff * uKeyCol + pl * uHalo);
  // icy / wet specular glint
  if (uStyle > 2.5) {
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(L + V);
    col += uKeyCol * pow(max(dot(N, H), 0.0), uStyle > 4.5 ? 60.0 : 24.0) * (uStyle > 4.5 ? 0.9 : 0.35);
  }
  col += uGlow * vein * uGlowAmt * pulse;
  // the crest: a faint line along the collision edge so the solid edge reads
  float crest = smoothstep(0.35, 0.0, abs(p.z)) * smoothstep(0.2, 0.8, abs(N.y));
  col += uEdge * crest * 0.35;
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, 1.0);
}`;

const SEA_VS = `
varying vec3 vObj; varying vec3 vWorld; varying float vDepth;
uniform float uTime, uScroll, uKind;
void main(){
  vec3 p = position;
  float tx = p.x + uScroll;
  p.y += sin(tx * 0.9 + uTime * 1.6) * 0.06 + sin(p.z * 0.7 + tx * 0.3 + uTime) * 0.05;
  vObj = vec3(tx, p.y, p.z);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const SEA_FS = `
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying float vDepth;
uniform float uTime, uKind, uFogNear, uFogFar;
uniform vec3 uFog, uSky, uPlayer, uHalo;
${NOISE_GLSL}
float fbm(vec3 p){ return vn3(p) * 0.55 + vn3(p * 2.1 + 3.1) * 0.28 + vn3(p * 4.3 + 7.7) * 0.17; }
void main(){
  vec3 p = vObj;
  vec3 col;
  if (uKind < 1.5) {
    // lava: dark crust plates over a white-hot flow
    vec3 q = vec3(p.x * 0.35, uTime * 0.05, p.z * 0.35);
    float flow = fbm(q + vec3(fbm(q * 1.7 + uTime * 0.08) * 1.5, 0.0, 0.0));
    float crack = smoothstep(0.08, 0.0, abs(flow - 0.5));
    float hot = smoothstep(0.35, 0.75, fbm(vec3(p.x * 0.12, uTime * 0.03, p.z * 0.12)));
    vec3 crust = mix(vec3(0.025, 0.006, 0.003), vec3(0.09, 0.02, 0.006), hot);
    float fine = smoothstep(0.03, 0.0, abs(fbm(q * 3.1 + 5.0) - 0.5));
    col = crust + vec3(1.5, 0.38, 0.06) * crack * (0.35 + hot) + vec3(0.9, 0.2, 0.03) * fine * hot * 0.5 + vec3(0.35, 0.06, 0.01) * hot * 0.25;
    col *= 0.85 + 0.15 * sin(uTime * 3.0 + p.x * 0.5);
  } else {
    // the Styx: black-teal water, the sky in it, drowned lights below
    vec3 V = normalize(cameraPosition - vWorld);
    float rip = fbm(vec3(p.x * 0.8, uTime * 0.4, p.z * 0.8));
    vec3 N = normalize(vec3((rip - 0.5) * 0.6, 1.0, (fbm(vec3(p.z * 0.9, uTime * 0.3, p.x * 0.7)) - 0.5) * 0.6));
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col = vec3(0.005, 0.03, 0.035) + uSky * fres * 0.9;
    float souls = smoothstep(0.82, 0.95, fbm(vec3(p.x * 0.25 + uTime * 0.05, uTime * 0.1, p.z * 0.4)));
    col += vec3(0.2, 1.0, 0.8) * souls * 0.6;
    vec3 toP = uPlayer - vWorld;
    col += uHalo * 1.4 / (1.0 + dot(toP, toP) * 0.25) * (0.4 + fres);
  }
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, 1.0);
}`;

export const TERRAIN_STYLES = {
    lava: { base: 0x4a2a22, dark: 0x140806, glow: 0xff5a14, edge: 0xff8a40, amt: 1.8, vein: 1.3, style: 0, band: 0.3 },
    bone: { base: 0xd8ccb0, dark: 0x5a4a38, glow: 0x9aff70, edge: 0xfff0d0, amt: 0.45, vein: 1.6, style: 1, band: 1 },
    iron: { base: 0x5a4c42, dark: 0x1a1412, glow: 0xff6a10, edge: 0xffa060, amt: 1.2, vein: 1.1, style: 2, band: 0.5 },
    water: { base: 0x2a3a3c, dark: 0x0a1214, glow: 0x50ffd8, edge: 0x80fff0, amt: 0.7, vein: 1.4, style: 3, band: 0.6 },
    flesh: { base: 0xa83848, dark: 0x3a0812, glow: 0xff8090, edge: 0xffa0b0, amt: 0.9, vein: 1.8, style: 4, band: 0 },
    ice: { base: 0xa8d0e8, dark: 0x2a4a68, glow: 0x80e0ff, edge: 0xe0f8ff, amt: 0.6, vein: 1.2, style: 5, band: 0.3 },
    stone: { base: 0xc8b8a0, dark: 0x4a3a40, glow: 0xffd070, edge: 0xfff0c0, amt: 0.6, vein: 1.1, style: 6, band: 1 },
};

export class TerrainView {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.uniforms = {
            uBase: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() },
            uKeyDir: { value: new THREE.Vector3(0.3, -1, 0.4) }, uKeyCol: { value: new THREE.Color(0xff6020) },
            uSky: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
            uPlayer: { value: new THREE.Vector3() }, uHalo: { value: new THREE.Color(0xffd890) },
            uGlowAmt: { value: 1 }, uVein: { value: 1 }, uTime: { value: 0 }, uFogNear: { value: 30 }, uFogFar: { value: 80 },
            uStyle: { value: 0 }, uCeil: { value: 0 }, uBand: { value: 0.5 },
        };
        this.mat = new THREE.ShaderMaterial({ vertexShader: TERRAIN_VS, fragmentShader: TERRAIN_FS, uniforms: this.uniforms, side: THREE.DoubleSide });
        this.chunks = new Map();
        this.terrain = null;
        this.sea = null;
        this.seaUniforms = {
            uTime: { value: 0 }, uScroll: { value: 0 }, uKind: { value: 1 }, uFogNear: this.uniforms.uFogNear, uFogFar: this.uniforms.uFogFar,
            uFog: this.uniforms.uFog, uSky: this.uniforms.uSky, uPlayer: this.uniforms.uPlayer, uHalo: this.uniforms.uHalo,
        };
    }

    setStage(stage, terrain, look) {
        for (const c of this.chunks.values()) this.disposeChunk(c);
        this.chunks.clear();
        this.terrain = terrain;
        const s = TERRAIN_STYLES[stage.floorKind] || TERRAIN_STYLES.lava;
        const u = this.uniforms;
        u.uBase.value.set(s.base); u.uDark.value.set(s.dark); u.uGlow.value.set(s.glow); u.uEdge.value.set(s.edge);
        u.uGlowAmt.value = s.amt; u.uVein.value = s.vein; u.uStyle.value = s.style; u.uBand.value = s.band;
        u.uKeyDir.value.copy(look.keyDir); u.uKeyCol.value.copy(look.keyCol).multiplyScalar(look.keyInt * 0.6);
        u.uSky.value.copy(look.sky).multiplyScalar(0.55); u.uGround.value.copy(look.ground).multiplyScalar(0.55);
        u.uFog.value.set(look.fog); u.uFogNear.value = look.fogNear; u.uFogFar.value = look.fogFar;
        if (this.sea) { this.group.parent.remove(this.sea); this.sea.geometry.dispose(); this.sea = null; }
        if (stage.floorKind === 'lava' || stage.floorKind === 'water') {
            const g = new THREE.PlaneGeometry(260, 110, 260, 60);
            g.rotateX(-Math.PI / 2);
            g.translate(16, 0, -52);
            const level = stage.terrain[0][1] + 0.18;
            this.seaUniforms.uKind.value = stage.floorKind === 'lava' ? 1 : 2;
            this.sea = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: SEA_VS, fragmentShader: SEA_FS, uniforms: this.seaUniforms }));
            this.sea.position.y = level;
            this.sea.frustumCulled = false;
            this.group.parent.add(this.sea);
        }
    }

    buildChunk(k) {
        const T = this.terrain;
        const x0 = k * CW;
        const cols = Math.round(CW / STEP) + 1;
        const make = (ceil) => {
            const pos = [], idx = [];
            let any = false;
            for (let j = 0; j < ROWS.length; j++) {
                const [z, dy] = ROWS[j];
                const jitter = j === 5 ? 0.04 : 0.28 * Math.min(1, Math.abs(j - 5) / 3);
                for (let i = 0; i < cols; i++) {
                    const wx = x0 + i * STEP;
                    const t = T.at(wx);
                    const h = ceil ? t.ceil : t.floor;
                    if (ceil ? h < NONE_CEIL - 0.5 : h > NONE_FLOOR + 0.5) any = true;
                    const n = noise3(wx * 1.3, z * 0.9 + (ceil ? 50 : 0), k * 0.01);
                    const n2 = noise3(wx * 0.37 + 9, z * 0.4, ceil ? 3 : 7);
                    const y = ceil ? h - dy - n * jitter - n2 * 0.25 * Math.min(1, Math.abs(j - 5) / 2) : h + dy + n * jitter + n2 * 0.25 * Math.min(1, Math.abs(j - 5) / 2);
                    pos.push(wx + noise3(wx * 2.1, z, 1) * 0.06 * (j !== 5), y, z + n2 * 0.3 * (j !== 5));
                }
            }
            if (!any) return null;
            for (let j = 0; j < ROWS.length - 1; j++) for (let i = 0; i < cols - 1; i++) {
                const a = j * cols + i, b = (j + 1) * cols + i, c = a + 1, d = b + 1;
                if (ceil) idx.push(a, c, b, c, d, b); else idx.push(a, b, c, c, b, d);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setIndex(idx);
            g.computeVertexNormals();
            const m = new THREE.Mesh(g, this.mat);
            m.frustumCulled = false;
            return m;
        };
        const c = { floor: make(false), ceil: make(true) };
        if (c.floor) this.group.add(c.floor);
        if (c.ceil) this.group.add(c.ceil);
        return c;
    }

    disposeChunk(c) {
        for (const m of [c.floor, c.ceil]) if (m) { this.group.remove(m); m.geometry.dispose(); }
    }

    update(scroll, time, player, haloColor) {
        if (!this.terrain) return;
        const k0 = Math.floor((scroll - 8) / CW), k1 = Math.floor((scroll + 44) / CW);
        for (let k = k0; k <= k1; k++) if (!this.chunks.has(k)) this.chunks.set(k, this.buildChunk(k));
        for (const [k, c] of this.chunks) if (k < k0 - 1 || k > k1 + 1) { this.disposeChunk(c); this.chunks.delete(k); }
        this.group.position.x = -scroll;
        const u = this.uniforms;
        u.uTime.value = time;
        u.uPlayer.value.set(player.x, player.y, 1.2);
        if (haloColor) u.uHalo.value.copy(haloColor);
        this.seaUniforms.uTime.value = time;
        this.seaUniforms.uScroll.value = scroll;
    }

    setVisible(v) { this.group.visible = v; if (this.sea) this.sea.visible = v; }
}
