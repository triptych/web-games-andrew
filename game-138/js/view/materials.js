// Materials: parallax occlusion mapping on three's MeshStandardMaterial, theme material sets, water and waterfalls.
//
// Parallax occlusion mapping (POM): before the albedo is sampled, the fragment walks its view ray down through the
// height map in up to 32 layers until it passes under the surface, then interpolates between the last two layers.
// The albedo and the normal map are then read at that shifted uv, so mortar sinks, planks stand proud and pebbles
// hide each other as the camera moves. The tangent frame comes from screen-space derivatives (no tangent attribute),
// which works on merged, hand-built geometry. Height also darkens crevices (a cheap ambient occlusion).

import * as THREE from 'three';
import { materialMaps } from './textures.js';

/** Theme looks: which recipe each surface uses, and the light and air of the place. */
export const LOOKS = {
    burrow: { wall: 'planks', floor: 'boards', cap: 'turf', ceil: 'roots', amb: 0xffd9a8, fog: 0x2a1c14, water: 0x3d7f8a, light: 0xffb36b, sky: 0x3b2a20 },
    stone:  { wall: 'blocks', floor: 'flags', cap: 'slate', ceil: 'blocks', amb: 0xd8d4e8, fog: 0x1b1a22, water: 0x2f6f8f, light: 0xffa95a, sky: 0x24222c },
    cellar: { wall: 'bricks', floor: 'terracotta', cap: 'soil', ceil: 'bricks', amb: 0xffc9a0, fog: 0x24150f, water: 0x3a6a70, light: 0xff9e55, sky: 0x2e1c16 },
    cavern: { wall: 'rock', floor: 'pebbles', cap: 'darkrock', ceil: 'rock', amb: 0xc8d0dc, fog: 0x14171c, water: 0x2b6a80, light: 0xffb070, sky: 0x1a1d22 },
    ruins:  { wall: 'mossblocks', floor: 'mossflags', cap: 'moss', ceil: 'mossblocks', amb: 0xd8f0c8, fog: 0x15201a, water: 0x3a7f70, light: 0xffc27a, sky: 0x1e2a22 },
    grotto: { wall: 'crystal', floor: 'glass', cap: 'amethyst', ceil: 'crystal', amb: 0xd8c0ff, fog: 0x140e22, water: 0x5a4fb0, light: 0xd9a0ff, sky: 0x1c1430 },
    frost:  { wall: 'ice', floor: 'snow', cap: 'snowcap', ceil: 'ice', amb: 0xd8ecff, fog: 0x1a2430, water: 0x6ab0d8, light: 0xffc890, sky: 0x223040 },
};

const POM_PARS = /* glsl */`
uniform sampler2D pomHeight;
uniform float pomScale;
uniform float pomAO;
`;

const POM_MAIN = /* glsl */`
vec2 pomUv = vMapUv;
float pomH = 1.0;
{
    vec3 pN = normalize( vNormal );
    vec3 q0 = dFdx( - vViewPosition ), q1 = dFdy( - vViewPosition );
    vec2 st0 = dFdx( vMapUv ), st1 = dFdy( vMapUv );
    vec3 q1perp = cross( q1, pN ), q0perp = cross( pN, q0 );
    vec3 pT = q1perp * st0.x + q0perp * st1.x;
    vec3 pB = q1perp * st0.y + q0perp * st1.y;
    float pDet = max( dot( pT, pT ), dot( pB, pB ) );
    float pSc = pDet == 0.0 ? 0.0 : inversesqrt( pDet );
    pT *= pSc; pB *= pSc;
    vec3 V = normalize( vViewPosition );
    vec3 vt = vec3( dot( V, pT ), dot( V, pB ), dot( V, pN ) );
    float layers = mix( 28.0, 8.0, clamp( vt.z, 0.0, 1.0 ) );
    float layerD = 1.0 / layers;
    vec2 dUv = vt.xy / max( vt.z, 0.2 ) * pomScale / layers;
    float curD = 0.0;
    vec2 uv = vMapUv;
    float hD = 1.0 - textureGrad( pomHeight, uv, st0, st1 ).r;
    for ( int i = 0; i < 32; i ++ ) {
        if ( float( i ) >= layers || curD >= hD ) break;
        uv -= dUv;
        hD = 1.0 - textureGrad( pomHeight, uv, st0, st1 ).r;
        curD += layerD;
    }
    vec2 prevUv = uv + dUv;
    float after = hD - curD;
    float before = ( 1.0 - textureGrad( pomHeight, prevUv, st0, st1 ).r ) - curD + layerD;
    float wgt = clamp( after / ( after - before + 1e-5 ), 0.0, 1.0 );
    pomUv = mix( uv, prevUv, wgt );
    pomH = textureGrad( pomHeight, pomUv, st0, st1 ).r;
}
#ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D( map, pomUv );
    diffuseColor *= sampledDiffuseColor;
#endif
diffuseColor.rgb *= mix( 1.0 - pomAO, 1.0, clamp( pomH * 1.3, 0.0, 1.0 ) );
`;

const POM_NORMAL = /* glsl */`
#ifdef USE_NORMALMAP_TANGENTSPACE
    vec3 mapN = texture2D( normalMap, pomUv ).xyz * 2.0 - 1.0;
    mapN.xy *= normalScale;
    normal = normalize( tbn * mapN );
#endif
`;

export const settings = { pom: true };

/** A MeshStandardMaterial with parallax occlusion mapping from a texture recipe. */
export function pomMaterial(recipe, { scale = 0.045, ao = 0.45, rough = 0.85, color = 0xffffff, vertexColors = true, emissive = 0x000000 } = {}) {
    const maps = materialMaps(recipe);
    const mat = new THREE.MeshStandardMaterial({
        map: maps.map, normalMap: maps.normalMap, normalScale: new THREE.Vector2(1.1, 1.1),
        roughness: rough, metalness: 0, color, vertexColors, emissive,
    });
    mat.userData.pom = { pomHeight: { value: maps.heightMap }, pomScale: { value: scale }, pomAO: { value: ao } };
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, mat.userData.pom);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\n' + POM_PARS)
            .replace('#include <map_fragment>', POM_MAIN)
            .replace('#include <normal_fragment_maps>', POM_NORMAL);
    };
    mat.customProgramCacheKey = () => 'pom';
    return mat;
}

/** Turn the parallax on or off everywhere (a setting for slow GPUs): scale 0 makes the loop a no-op. */
export function setPom(materials, on) {
    settings.pom = on;
    for (const m of materials) if (m.userData.pom) m.userData.pom.pomScale.value = on ? m.userData.pomScale0 ?? (m.userData.pomScale0 = m.userData.pom.pomScale.value) : 0;
}

const themeCache = new Map();

/** The material set of a theme: walls, floor, caps, ceiling, the trim on stairs and wells, the diorama sides. */
export function themeMaterials(theme) {
    if (themeCache.has(theme)) return themeCache.get(theme);
    const L = LOOKS[theme] || LOOKS.stone;
    const set = {
        look: L,
        wall: pomMaterial(L.wall, { scale: 0.05 }),
        floor: pomMaterial(L.floor, { scale: 0.04, ao: 0.5 }),
        under: pomMaterial('pebbles', { scale: 0.03, color: 0x8899aa }),
        cap: pomMaterial(L.cap, { scale: 0.03, ao: 0.35, rough: 0.95, vertexColors: false }),
        ceil: pomMaterial(L.ceil, { scale: 0.03, color: 0x9a8c80, vertexColors: false }),
        trim: pomMaterial(L.wall === 'planks' ? 'blocks' : L.wall, { scale: 0.03, vertexColors: false }),
        side: pomMaterial('strata', { scale: 0.02, ao: 0.3, vertexColors: false }),
    };
    if (theme === 'grotto') { set.wall.emissive.set(0x1a0c30); set.floor.emissive.set(0x0c0618); }
    if (theme === 'frost') { set.wall.roughness = 0.35; set.floor.roughness = 0.6; }
    themeCache.set(theme, set);
    return set;
}

/** Every theme material made so far (for the parallax switch). */
export const allThemeMaterials = () => [...themeCache.values()].flatMap((s) => Object.values(s).filter((m) => m && m.isMaterial));

// ------------------------------------------------------------------ water
export const clock = { value: 0 };

/** Fog uniforms (cloned, as three expects) plus our own, which stay shared: the clock must be one object everywhere. */
export const withFog = (own) => ({ ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...own });

export function waterMaterial(color) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: true,
        uniforms: withFog({ uTime: clock, uColor: { value: new THREE.Color(color) } }),
        vertexShader: /* glsl */`
            #include <fog_pars_vertex>
            varying vec3 vW; varying vec3 vView;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vW = w.xyz;
                vView = cameraPosition - w.xyz;
                vec4 mvPosition = viewMatrix * w;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }`,
        fragmentShader: /* glsl */`
            #include <fog_pars_fragment>
            uniform float uTime; uniform vec3 uColor;
            varying vec3 vW; varying vec3 vView;
            float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
            void main() {
                vec2 p = vW.xz * 1.3;
                float a = n(p + vec2(uTime * 0.35, uTime * 0.2)), b = n(p * 1.9 - vec2(uTime * 0.25, -uTime * 0.4));
                vec3 N = normalize(vec3((a - 0.5) * 0.6, 1.0, (b - 0.5) * 0.6));
                vec3 V = normalize(vView);
                float fres = clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0);
                fres = fres * fres * fres;
                float glint = smoothstep(0.82, 0.98, a * b * 1.6);
                vec3 col = mix(uColor * 0.55, uColor * 1.35 + 0.15, fres) + glint * 0.35;
                gl_FragColor = vec4(col, 0.72 + fres * 0.2);
                #include <fog_fragment>
                #include <colorspace_fragment>
            }`,
    });
}

export function waterfallMaterial(color) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
        uniforms: withFog({ uTime: clock, uColor: { value: new THREE.Color(color) } }),
        vertexShader: /* glsl */`
            #include <fog_pars_vertex>
            varying vec2 vUv;
            void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }`,
        fragmentShader: /* glsl */`
            #include <fog_pars_fragment>
            uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
            float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
            float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
            void main() {
                float streak = n(vec2(vUv.x * 14.0, vUv.y * 2.0 + uTime * 3.2)) * 0.6 + n(vec2(vUv.x * 30.0, vUv.y * 5.0 + uTime * 5.0)) * 0.4;
                float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
                float foam = smoothstep(0.25, 0.0, vUv.y);
                vec3 col = mix(uColor * 1.1 + 0.1, vec3(0.95, 0.98, 1.0), clamp(streak * 0.7 + foam, 0.0, 1.0));
                float a = edge * (0.45 + streak * 0.45 + foam * 0.3);
                gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
                #include <fog_fragment>
                #include <colorspace_fragment>
            }`,
    });
}

// ------------------------------------------------------------------ fire and sparkles (one shared sprite texture)
let glowTex = null;
export function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    return glowTex;
}
