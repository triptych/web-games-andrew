// The rock: one instanced box per visible tile, lit by Thimble's lantern in a custom shader,
// and a back wall behind the tunnels. Only the rows in view are written each frame.

import * as THREE from 'three';
import { W, H, T, STRATA, ORES } from '../config.js';
import { ATLAS } from './textures.js';

const MAX = 4200;

const VERT = /* glsl */`
attribute vec2 aPos;
attribute vec2 aCell;
attribute vec4 aInfo;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vCell;
varying vec4 vInfo;
void main() {
    vec3 wp = position + vec3(aPos, 0.0);
    vWorld = wp;
    vN = normal;
    vUv = uv;
    vCell = aCell;
    vInfo = aInfo;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const COMMON = /* glsl */`
uniform sampler2D uAtlas;
uniform vec3 uLight;
uniform float uRadius;
uniform float uSense;
uniform float uTime;
uniform vec3 uLightCol;
uniform vec3 uAmbCol;
uniform float uFlash;
vec4 cellTex(float idx, vec2 uv) {
    float cx = mod(idx, 16.0), cy = floor(idx / 16.0);
    vec2 inset = uv * (62.0 / 64.0) + 1.0 / 64.0;
    return texture2D(uAtlas, vec2((cx + inset.x) / 16.0, 1.0 - (cy + 1.0 - inset.y) / 16.0));
}
float lanternAt(vec2 p) {
    float d = length(p - uLight.xy);
    float k = clamp(1.0 - d / uRadius, 0.0, 1.0);
    return k * k * (3.0 - 2.0 * k);
}
`;

const FRAG = /* glsl */`
${COMMON}
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vCell;
varying vec4 vInfo;
void main() {
    float flags = vInfo.w;
    bool surface = mod(flags, 2.0) >= 1.0;
    bool lava = mod(floor(flags / 2.0), 2.0) >= 1.0;
    vec2 uv = vUv;
    float face = 1.0;
    vec3 n = vN;
    if (abs(n.x) > 0.5) { face = 0.55; }
    else if (n.y > 0.5) { face = 0.8; uv = vec2(vUv.x, 0.9 + vUv.y * 0.1); }
    else if (n.y < -0.5) { face = 0.35; }
    if (lava) uv = fract(uv + vec2(uTime * 0.03, uTime * 0.05));
    vec4 base = cellTex(vCell.x, uv);
    float lan = lanternAt(vWorld.xy);
    float amb = vInfo.z;
    vec3 light = uAmbCol * amb + uLightCol * lan * 1.2;
    vec3 col = base.rgb * light * face;
    if (surface && n.y > 0.5) col = vec3(0.32, 0.55, 0.2) * (amb * 0.9 + lan * 0.4);
    if (surface && n.z > 0.5) {
        vec4 g = cellTex(${ATLAS.grass}.0, vUv);
        col = mix(col, g.rgb * (amb + lan * 0.5), g.a);
    }
    if (lava) col = base.rgb * (0.9 + 0.25 * sin(uTime * 2.0 + vWorld.x));
    float d = length(vWorld.xy - uLight.xy);
    if (vCell.y >= 0.0 && n.z > 0.5) {
        vec4 o = cellTex(vCell.y, vUv);
        float glow = vInfo.x;
        float pulse = 0.75 + 0.25 * sin(uTime * 2.5 + vWorld.x * 1.7 + vWorld.y);
        vec3 oc = o.rgb * (light + glow * 0.9 * pulse);
        col = mix(col, oc, o.a);
        col += o.rgb * o.a * glow * 0.22 * pulse;
        if (uSense > 0.0) {
            float s = smoothstep(uSense, uSense * 0.55, d) * (1.0 - lan);
            col += o.rgb * o.a * s * (0.55 + 0.25 * pulse);
        }
    }
    if (vInfo.y > 0.0 && n.z > 0.5) {
        vec4 c = cellTex(${ATLAS.crack}.0, vUv);
        col *= 1.0 - c.a * vInfo.y * 0.85;
        col += vec3(1.0, 0.8, 0.5) * c.a * vInfo.y * lan * 0.15;
    }
    col += vec3(1.0, 0.5, 0.3) * uFlash * lan;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}`;

const BACK_FRAG = /* glsl */`
${COMMON}
uniform sampler2D uStrat;
varying vec3 vWorld;
void main() {
    if (vWorld.y > -0.02) discard;
    float c = floor(vWorld.x), r = floor(-vWorld.y);
    float s = texture2D(uStrat, vec2((clamp(c, 0.0, ${W - 1}.0) + 0.5) / ${W}.0, (clamp(r, 0.0, ${H - 1}.0) + 0.5) / ${H}.0)).r * 255.0;
    vec4 b = cellTex(28.0 + floor(s + 0.5), fract(vWorld.xy));
    float lan = lanternAt(vWorld.xy);
    float amb = 0.06 + 0.85 * exp(-r / 18.0);
    vec3 col = b.rgb * (uAmbCol * amb * 0.8 + uLightCol * lan * 0.95);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}`;

const BACK_VERT = /* glsl */`
varying vec3 vWorld;
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}`;

/** Ambient light of a row: daylight near the grass, fading to near-black by the Greystone. */
export function ambientAt(r) {
    if (r < 0) return 1;
    return 0.07 + 0.9 * Math.exp(-r / 20);
}

export class Terrain {
    constructor(scene, atlasTex) {
        const box = new THREE.BoxGeometry(1, 1, 1);
        const geo = new THREE.InstancedBufferGeometry();
        geo.index = box.index;
        geo.setAttribute('position', box.getAttribute('position'));
        geo.setAttribute('normal', box.getAttribute('normal'));
        geo.setAttribute('uv', box.getAttribute('uv'));
        this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
        this.aCell = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
        this.aInfo = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
        for (const a of [this.aPos, this.aCell, this.aInfo]) a.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('aPos', this.aPos);
        geo.setAttribute('aCell', this.aCell);
        geo.setAttribute('aInfo', this.aInfo);
        geo.instanceCount = 0;
        this.uniforms = {
            uAtlas: { value: atlasTex },
            uLight: { value: new THREE.Vector3() },
            uRadius: { value: 4 },
            uSense: { value: 0 },
            uTime: { value: 0 },
            uLightCol: { value: new THREE.Color(1.0, 0.82, 0.55) },
            uAmbCol: { value: new THREE.Color(1, 1, 1) },
            uFlash: { value: 0 },
        };
        this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms });
        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.frustumCulled = false;
        this.geo = geo;
        scene.add(this.mesh);

        // back wall
        this.stratTex = new THREE.DataTexture(new Uint8Array(W * H), W, H, THREE.RedFormat, THREE.UnsignedByteType);
        this.stratTex.magFilter = this.stratTex.minFilter = THREE.NearestFilter;
        this.backUniforms = { ...this.uniforms, uStrat: { value: this.stratTex } };
        this.back = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.ShaderMaterial({ vertexShader: BACK_VERT, fragmentShader: BACK_FRAG, uniforms: this.backUniforms }),
        );
        this.back.position.z = -0.5;
        this.back.frustumCulled = false;
        scene.add(this.back);
        this.worldRef = null;
    }

    setWorld(world) {
        this.worldRef = world;
        // DataTexture rows run bottom-up in v; we sample with v = (r + 0.5)/H, so row r → texel row r.
        this.stratTex.image.data.set(world.strat);
        this.stratTex.needsUpdate = true;
    }

    /**
     * view: { x, y, halfW, halfH } of the camera window in world units.
     * drill: { c, r, p } the tile being drilled and its progress, or null.
     */
    update(G, view, time, drill) {
        const world = G.world;
        if (this.worldRef !== world) this.setWorld(world);
        const r0 = Math.max(0, Math.floor(-(view.y + view.halfH)) - 1);
        const r1 = Math.min(H - 1, Math.ceil(-(view.y - view.halfH)) + 1);
        const c0 = Math.max(-3, Math.floor(view.x - view.halfW) - 1);
        const c1 = Math.min(W + 2, Math.ceil(view.x + view.halfW) + 1);
        const P = this.aPos.array, C = this.aCell.array, I = this.aInfo.array;
        let n = 0;
        for (let r = r0; r <= r1 && n < MAX; r++) {
            const amb = ambientAt(r);
            for (let c = c0; c <= c1 && n < MAX; c++) {
                let t, a = 0, s;
                if (c < 0 || c >= W) { t = T.BEDROCK; s = Math.min(6, world.strat[r * W + Math.max(0, Math.min(W - 1, c))]); }
                else {
                    const i = r * W + c;
                    t = world.tiles[i];
                    if (t === T.EMPTY) continue;
                    a = world.aux[i];
                    s = world.strat[i];
                }
                const v = ((c * 7 + r * 13) ^ (r >> 1)) & 3;
                let base = ATLAS.base(s, v), over = -1, glow = 0, flags = r === 0 ? 1 : 0;
                switch (t) {
                    case T.ORE: over = ATLAS.ore(a); glow = ORES[a].glow; break;
                    case T.GAS: over = ATLAS.gas; glow = 0.45; break;
                    case T.LAVA: base = ATLAS.lava; flags |= 2; break;
                    case T.BOULDER: over = ATLAS.boulder; break;
                    case T.RUNESTONE: base = ATLAS.rune; glow = 0; break;
                    case T.RELIC: base = ATLAS.relic(a); over = ATLAS.relic(a); glow = 1; break;
                    case T.ARTIFACT: over = [1, 3, 5, 8, 10, 12].includes(a) ? ATLAS.page : ATLAS.artifact; glow = 0.35; break;
                    case T.BRICK: base = ATLAS.brick(s >= 6 ? 2 : s >= 3 ? 1 : 0); break;
                    case T.GATE: base = ATLAS.gate; over = ATLAS.gate; glow = 0.8; break;
                    case T.SHARD: base = ATLAS.shard; over = ATLAS.shard; glow = 1; break;
                    case T.CACHE: over = ATLAS.cache; glow = 0.2; break;
                    case T.BEDROCK: base = ATLAS.bedrock; break;
                    case T.WAYSTONE: base = ATLAS.waystone; over = ATLAS.waystone; glow = G.waystones[a] ? 1 : 0.2; break;
                    case T.WRECK: over = ATLAS.wreck; glow = 0.3; break;
                    case T.HEART: base = ATLAS.heart; over = ATLAS.heart; glow = 1.5; break;
                    default: break;
                }
                P[n * 2] = c + 0.5; P[n * 2 + 1] = -(r + 0.5);
                C[n * 2] = base; C[n * 2 + 1] = over;
                I[n * 4] = glow;
                I[n * 4 + 1] = drill && drill.c === c && drill.r === r ? drill.p : 0;
                I[n * 4 + 2] = amb;
                I[n * 4 + 3] = flags;
                n++;
            }
        }
        this.geo.instanceCount = n;
        this.aPos.needsUpdate = this.aCell.needsUpdate = this.aInfo.needsUpdate = true;
        this.uniforms.uTime.value = time;
        // back wall covers the window
        this.back.scale.set(view.halfW * 2 + 6, view.halfH * 2 + 6, 1);
        this.back.position.x = view.x; this.back.position.y = view.y;
        this.count = n;
    }
}

export { STRATA };
