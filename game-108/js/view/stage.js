// The stage: renderer, post chain, shader sky, the carved board, the enemy's dais, lights,
// camera fitting and pointer picking. Holds no game state.
//
// World: cell (x, y) sits at (x - 3, 0, y - 3); row 0 is the far edge (north, -z), the camera
// hangs south of the board and looks down at it, and the enemy stands on a dais beyond row 0.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD } from '../config.js';

export const HALF = (BOARD.w - 1) / 2;
export const cellPos = (x, y, out = new THREE.Vector3()) => out.set(x - HALF, 0, y - HALF);
export const ENEMY_POS = new THREE.Vector3(0, 0.35, -HALF - 3.3);

/** Sky palettes per region: zenith, mid, horizon, glow (moon or sun), mountains, mist. */
export const SKIES = [
    { top: 0x170b2a, mid: 0x5a2140, hor: 0xff8448, glow: 0xffb070, mtn: 0x24102a, mist: 0xff9a62, motes: 0xffa24a },
    { top: 0x041428, mid: 0x0d3a5c, hor: 0x46c4e0, glow: 0xd8f6ff, mtn: 0x07202e, mist: 0x7ad8ef, motes: 0x9ae8ff },
    { top: 0x06140d, mid: 0x123a24, hor: 0x8fd27a, glow: 0xe8ffb0, mtn: 0x07170e, mist: 0x9fe08a, motes: 0xb8ff7a },
    { top: 0x142458, mid: 0x4a5aa8, hor: 0xffd890, glow: 0xfff2c0, mtn: 0x2a2a58, mist: 0xffe0a8, motes: 0xffe48a },
    { top: 0x05030c, mid: 0x1e0c38, hor: 0x9a44d0, glow: 0xe6b8ff, mtn: 0x0c0618, mist: 0xb070e8, motes: 0xd09aff },
];

const SKY_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const SKY_FS = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uAspect;
uniform vec3 uTop, uMid, uHor, uGlow, uMtn, uMist;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float ridge(float x, float seed, float amp){ return fbm(vec2(x * 1.6 + seed, seed)) * amp; }
void main(){
  vec2 uv = vUv; vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y);
  float hz = 0.36;                                   // horizon height on screen
  float t = clamp((uv.y - hz) / (1.0 - hz), 0.0, 1.0);
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.35, t));
  col = mix(col, uTop, smoothstep(0.3, 1.0, t));
  // nebula and drifting cloud
  float neb = fbm(p * 2.2 + vec2(uTime * 0.01, 0.0));
  col += uMid * 0.35 * smoothstep(0.45, 0.9, neb) * t;
  float cl = fbm(vec2(p.x * 1.4 + uTime * 0.006, p.y * 4.0));
  col = mix(col, uMist, smoothstep(0.55, 0.85, cl) * 0.18 * (1.0 - t));
  // stars, twinkling, only high up
  vec2 sg = floor(p * 90.0); float sr = h21(sg);
  float star = step(0.985, sr) * smoothstep(0.25, 0.9, t);
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + sr * 3.0) + sr * 40.0);
  vec2 sc = fract(p * 90.0) - 0.5;
  col += vec3(1.0, 0.95, 0.9) * star * tw * smoothstep(0.18, 0.0, length(sc)) * 1.6;
  // moon or sun with a soft halo
  vec2 mpos = vec2(0.32 * uAspect, 0.74);
  float md = length(p - vec2(mpos.x, mpos.y));
  col += uGlow * (smoothstep(0.075, 0.068, md) * 1.6 + 0.35 * exp(-md * 6.0) + 0.12 * exp(-md * 1.6));
  // three ranges of mountains, the near ones darker
  for (int k = 0; k < 3; k++){
    float fk = float(k);
    float base = hz - 0.03 + fk * -0.06;
    float hgt = base + ridge(p.x + fk * 3.7 + uTime * 0.002 * (fk + 1.0), fk * 11.0 + 3.0, 0.16 - fk * 0.02);
    float m = smoothstep(hgt + 0.002, hgt - 0.002, uv.y);
    vec3 mc = mix(uMtn, uMist, 0.35 - fk * 0.14);
    col = mix(col, mc, m);
    // mist pooling in the valleys
    col = mix(col, uMist, m * smoothstep(hgt, hgt - 0.12, uv.y) * 0.12);
  }
  col *= 0.75 + 0.25 * smoothstep(0.0, 0.5, uv.y);
  gl_FragColor = vec4(col, 1.0);
}`;

// Grade: vignette, a hit flash and a little chromatic split on impacts. Works in linear HDR.
const GRADE = {
    uniforms: { tDiffuse: { value: null }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.2, 0.15) }, uAber: { value: 0 }, uVig: { value: 0.32 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uFlash, uAber, uVig; uniform vec3 uFlashCol; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + d * uAber * 0.012).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - d * uAber * 0.012).b;
      float v = clamp(1.0 - dot(d, d) * uVig * 3.0, 0.0, 1.0);
      c *= mix(1.0, v, 0.9);
      c = mix(c, c * 0.5 + uFlashCol * 0.6, clamp(uFlash, 0.0, 1.0) * (1.0 - v * 0.7));
      gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
    }`,
};

/** The board's carved top: two stone tones, grooves, a gold border with runes. */
function boardTextures() {
    const S = 1024, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const bump = document.createElement('canvas');
    bump.width = bump.height = S;
    const b = bump.getContext('2d');
    const total = BOARD.w + 1.2, cs = S / total, off = cs * 0.6;
    g.fillStyle = '#2a2238'; g.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    // speckled stone
    for (let k = 0; k < 9000; k++) {
        const x = Math.random() * S, y = Math.random() * S, r = Math.random() * 2.2;
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,220' : '0,0,10'},${Math.random() * 0.07})`;
        g.fillRect(x, y, r, r);
    }
    for (let y = 0; y < BOARD.h; y++) for (let x = 0; x < BOARD.w; x++) {
        const px = off + x * cs, py = off + y * cs;
        const dark = (x + y) % 2 === 0;
        const gr = g.createLinearGradient(px, py, px + cs, py + cs);
        gr.addColorStop(0, dark ? '#3d3350' : '#4a4060');
        gr.addColorStop(1, dark ? '#2e263e' : '#3a3150');
        g.fillStyle = gr;
        g.fillRect(px + 3, py + 3, cs - 6, cs - 6);
        g.strokeStyle = 'rgba(255,220,160,0.10)'; g.lineWidth = 2;
        g.strokeRect(px + 9, py + 9, cs - 18, cs - 18);
        b.fillStyle = '#9a9a9a'; b.fillRect(px + 3, py + 3, cs - 6, cs - 6);
        b.fillStyle = '#707070'; b.fillRect(px + 9, py + 9, cs - 18, 2); b.fillRect(px + 9, py + cs - 11, cs - 18, 2);
        // a faint carved rosette in each cell
        g.save(); g.translate(px + cs / 2, py + cs / 2);
        g.strokeStyle = 'rgba(200,180,255,0.06)'; g.lineWidth = 2;
        for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.ellipse(0, 0, cs * 0.3, cs * 0.11, 0, 0, Math.PI * 2); g.stroke(); }
        g.restore();
    }
    // grooves between cells
    g.strokeStyle = '#140f1e'; g.lineWidth = 6;
    b.strokeStyle = '#303030'; b.lineWidth = 6;
    for (let k = 0; k <= BOARD.w; k++) {
        for (const c of [g, b]) {
            c.beginPath(); c.moveTo(off + k * cs, off); c.lineTo(off + k * cs, off + BOARD.h * cs); c.stroke();
            c.beginPath(); c.moveTo(off, off + k * cs); c.lineTo(off + BOARD.w * cs, off + k * cs); c.stroke();
        }
    }
    // gold border with runes
    const gold = g.createLinearGradient(0, 0, S, S);
    gold.addColorStop(0, '#f5d27a'); gold.addColorStop(0.5, '#b8862f'); gold.addColorStop(1, '#f0c766');
    g.strokeStyle = gold; g.lineWidth = 10;
    g.strokeRect(off - 14, off - 14, BOARD.w * cs + 28, BOARD.h * cs + 28);
    g.lineWidth = 3; g.strokeRect(off - 28, off - 28, BOARD.w * cs + 56, BOARD.h * cs + 56);
    b.strokeStyle = '#d0d0d0'; b.lineWidth = 10; b.strokeRect(off - 14, off - 14, BOARD.w * cs + 28, BOARD.h * cs + 28);
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    g.fillStyle = 'rgba(255,214,140,0.55)'; g.font = `${Math.round(cs * 0.22)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    let ri = 0;
    const edge = off - 21;
    for (let k = 0; k < 28; k++) {
        const t = (k + 0.5) / 28, L = BOARD.w * cs + 42;
        const pts = [[off - 21 + t * L, edge], [off - 21 + t * L, off + BOARD.h * cs + 21], [edge, off - 21 + t * L], [off + BOARD.w * cs + 21, off - 21 + t * L]];
        for (const [x, y] of pts) g.fillText(runes[ri++ % runes.length], x, y);
    }
    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const bumpMap = new THREE.CanvasTexture(bump);
    return { map, bumpMap, total };
}

/** A soft rounded-square glow for cell highlights. */
function cellGlowMaterial(color) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uCol: { value: new THREE.Color(color) }, uA: { value: 1 }, uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uCol; uniform float uA, uTime; varying vec2 vUv;
        void main(){ vec2 q = abs(vUv - 0.5) * 2.0; float d = max(q.x, q.y);
          float edge = smoothstep(0.7, 0.92, d) * smoothstep(1.0, 0.94, d);
          float fill = smoothstep(1.0, 0.2, d) * 0.25;
          float a = (edge * 1.4 + fill) * uA * (0.85 + 0.15 * sin(uTime * 5.0));
          gl_FragColor = vec4(uCol * a * 1.6, a); }`,
    });
}

/** A ring of runes under the enemy that glows when it acts. */
function daisMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uCol: { value: new THREE.Color(0xffffff) }, uTime: { value: 0 }, uPulse: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uCol; uniform float uTime, uPulse; varying vec2 vUv;
        void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
          float ring = smoothstep(0.03, 0.0, abs(r - 0.86)) + smoothstep(0.02, 0.0, abs(r - 0.7));
          float ticks = step(0.5, fract(a * 6.0 / 3.14159 + uTime * 0.1)) * smoothstep(0.03, 0.0, abs(r - 0.78)) * 0.8;
          float glow = exp(-abs(r - 0.8) * 9.0) * 0.35;
          float k = (ring + ticks + glow) * (0.55 + uPulse * 1.8) * smoothstep(1.0, 0.95, r);
          gl_FragColor = vec4(uCol * k, k); }`,
    });
}

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environment = this.env;
        this.scene.fog = new THREE.Fog(0x120a1e, 18, 60);

        // sky in its own scene, drawn first
        this.skyScene = new THREE.Scene();
        this.skyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.skyMat = new THREE.ShaderMaterial({
            vertexShader: SKY_VS, fragmentShader: SKY_FS, depthWrite: false, depthTest: false,
            uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uMtn: { value: new THREE.Color() }, uMist: { value: new THREE.Color() } },
        });
        this.skyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMat));

        // lights
        this.hemi = new THREE.HemisphereLight(0xcfd8ff, 0x2a1830, 0.55);
        this.scene.add(this.hemi);
        const sun = this.sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
        sun.position.set(-5, 12, 7);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 10, bottom: -8, near: 1, far: 40 });
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.02;
        this.scene.add(sun);
        this.rim = new THREE.DirectionalLight(0xff9a62, 1.2);
        this.rim.position.set(4, 4, -10);
        this.scene.add(this.rim);
        this.flashLight = new THREE.PointLight(0xffffff, 0, 9, 2);
        this.flashLight.position.set(0, 2.2, 0);
        this.scene.add(this.flashLight);

        this.buildBoard();
        this.buildMotes();

        // post
        const composer = this.composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(this.skyScene, this.skyCam));
        const main = new RenderPass(this.scene, this.camera);
        main.clear = false;
        main.clearDepth = true;
        composer.addPass(main);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.3, 1.5);
        composer.addPass(this.bloom);
        this.grade = new ShaderPass(GRADE);
        composer.addPass(this.grade);
        composer.addPass(new OutputPass());

        this.pad = { top: 60, bottom: 120, left: 0, right: 0 };
        this.shake = 0;
        this.setSky(0);
        this.resize(true);
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this.ray = new THREE.Raycaster();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
    }

    buildBoard() {
        const { map, bumpMap, total } = boardTextures();
        this.boardSize = total;
        const slab = new THREE.Mesh(
            new RoundedBoxGeometry(total, 0.6, total, 4, 0.22),
            [
                new THREE.MeshStandardMaterial({ color: 0x2a2134, roughness: 0.8 }),
                new THREE.MeshStandardMaterial({ color: 0x2a2134, roughness: 0.8 }),
                new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.2, roughness: 0.62, metalness: 0.08 }),
                new THREE.MeshStandardMaterial({ color: 0x2a2134, roughness: 0.8 }),
                new THREE.MeshStandardMaterial({ color: 0x2a2134, roughness: 0.8 }),
                new THREE.MeshStandardMaterial({ color: 0x2a2134, roughness: 0.8 }),
            ],
        );
        slab.position.set(0, -0.3, 0);
        slab.receiveShadow = true;
        this.scene.add(slab);
        // gilded lip around the slab
        const lip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 4), new THREE.MeshStandardMaterial({ color: 0xc8963a, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.5 }));
        lip.rotation.set(Math.PI / 2, 0, Math.PI / 4);
        lip.scale.setScalar(total * 0.707);
        lip.position.y = -0.04;
        this.scene.add(lip);
        // a floating island of rock under the board and the dais, the dusk sky all around it
        const isl = new THREE.CylinderGeometry(1, 0.35, 1, 40, 6, false);
        const ip = isl.attributes.position;
        for (let i = 0; i < ip.count; i++) {
            const x = ip.getX(i), y = ip.getY(i), z = ip.getZ(i), a = Math.atan2(z, x);
            const k = 1 + Math.sin(a * 5 + y * 3) * 0.06 + Math.sin(a * 11 - y * 7) * 0.04;
            ip.setXYZ(i, x * k, y + (y < 0.4 ? Math.sin(a * 7) * 0.08 : 0), z * k);
        }
        isl.computeVertexNormals();
        const island = new THREE.Mesh(isl, new THREE.MeshStandardMaterial({ color: 0x3a2c40, roughness: 0.95, flatShading: true }));
        island.scale.set(7.2, 5, 9.6);
        island.position.set(0, -3.2, -2.4);
        island.receiveShadow = true;
        this.scene.add(island);
        const turf = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x2c2238, roughness: 1 }));
        turf.rotation.x = -Math.PI / 2;
        turf.scale.set(7.2, 9.6, 1);
        turf.position.set(0, -0.68, -2.4);
        turf.receiveShadow = true;
        this.scene.add(turf);
        this.ground = turf;
        // the enemy's dais
        const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.9, 40), new THREE.MeshStandardMaterial({ color: 0x2a2236, roughness: 0.85 }));
        dais.position.set(ENEMY_POS.x, ENEMY_POS.y - 0.45 - 0.05, ENEMY_POS.z);
        dais.receiveShadow = true;
        this.scene.add(dais);
        this.daisMat = daisMaterial();
        const runes = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), this.daisMat);
        runes.rotation.x = -Math.PI / 2;
        runes.position.set(ENEMY_POS.x, ENEMY_POS.y + 0.01, ENEMY_POS.z);
        this.scene.add(runes);
        // pillars either side of the dais
        const pm = new THREE.MeshStandardMaterial({ color: 0x3a3048, roughness: 0.8 });
        this.braziers = [];
        for (const sx of [-1, 1]) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.6, 10), pm);
            p.position.set(sx * 4.2, 0.7, ENEMY_POS.z + 0.6);
            p.castShadow = true;
            this.scene.add(p);
            const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.25, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0xc89a3a, metalness: 0.9, roughness: 0.35 }));
            bowl.position.set(sx * 4.2, 2.1, ENEMY_POS.z + 0.6);
            this.scene.add(bowl);
            const fire = new THREE.PointLight(0xff9a40, 6, 9, 2);
            fire.position.set(sx * 4.2, 2.6, ENEMY_POS.z + 0.6);
            this.scene.add(fire);
            this.braziers.push({ fire, pos: fire.position.clone() });
        }
        this.cellGlow = {};
        for (const [k, c] of [['sel', 0xffd060], ['hint', 0xffffff], ['cur', 0x80d8ff]]) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), cellGlowMaterial(c));
            m.rotation.x = -Math.PI / 2;
            m.position.y = 0.012;
            m.visible = false;
            m.renderOrder = 2;
            this.scene.add(m);
            this.cellGlow[k] = m;
        }
    }

    /** Embers and pollen drifting up through the scene. */
    buildMotes() {
        const n = 220, pos = new Float32Array(n * 3), seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 22;
            pos[i * 3 + 1] = Math.random() * 8;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 22 - 3;
            seed[i] = Math.random();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        this.moteMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0xffa24a) }, uScale: { value: 300 } },
            vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying float vA;
            void main(){ vec3 p = position; float t = uTime * (0.15 + aSeed * 0.2) + aSeed * 10.0;
              p.y = mod(p.y + t, 8.0); p.x += sin(t * 1.3 + aSeed * 6.0) * 0.4; p.z += cos(t + aSeed * 3.0) * 0.3;
              vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
              gl_PointSize = (0.04 + aSeed * 0.05) * uScale / -mv.z;
              vA = smoothstep(0.0, 1.0, p.y) * smoothstep(8.0, 5.0, p.y) * (0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 30.0)); }`,
            fragmentShader: `uniform vec3 uCol; varying float vA;
            void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uCol * a * 2.2, a); }`,
        });
        this.motes = new THREE.Points(g, this.moteMat);
        this.motes.frustumCulled = false;
        this.scene.add(this.motes);
    }

    setSky(i) {
        const s = SKIES[i] || SKIES[0];
        this.skyIndex = i;
        const u = this.skyMat.uniforms;
        u.uTop.value.set(s.top); u.uMid.value.set(s.mid); u.uHor.value.set(s.hor);
        u.uGlow.value.set(s.glow); u.uMtn.value.set(s.mtn); u.uMist.value.set(s.mist);
        this.moteMat.uniforms.uCol.value.set(s.motes);
        this.rim.color.set(s.hor);
        this.scene.fog.color.set(s.mtn).lerp(new THREE.Color(s.mist), 0.15);
        this.hemi.color.set(0xd6dcff).lerp(new THREE.Color(s.glow), 0.25);
    }

    setPad(pad) { this.pad = { ...this.pad, ...pad }; this.fitted = false; this.resize(true); }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const pr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);         // also sets the canvas CSS size in px (no 100vh trap)
        this.composer.setPixelRatio(pr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(w * pr / 2, h * pr / 2);
        this.skyMat.uniforms.uAspect.value = w / h;
        this.moteMat.uniforms.uScale.value = h * pr * 0.9;
        this.fit();
    }

    /**
     * Fit the board and the enemy into the free part of the screen (between the HUD pads).
     * The camera keeps its tilt; its distance is binary-searched until every key point projects
     * inside the free box, then setViewOffset slides the picture so that box is centred.
     */
    fit() {
        const cam = this.camera, { w, h } = this;
        const pad = this.pad;
        const free = { l: pad.left, r: w - pad.right, t: pad.top, b: h - pad.bottom };
        const fw = Math.max(80, free.r - free.l), fh = Math.max(80, free.b - free.t);
        const portrait = fh > fw * 1.15;
        const pitch = portrait ? 0.98 : 0.86;     // radians above the horizon
        const half = this.boardSize / 2;
        const pts = [
            [-half, 0, half + 0.1], [half, 0, half + 0.1], [-half, 0, -half], [half, 0, -half],
            [-2.0, 0.2, ENEMY_POS.z], [2.0, 0.2, ENEMY_POS.z], [0, ENEMY_POS.y + 3.6, ENEMY_POS.z],
        ].map((p) => new THREE.Vector3(...p));
        const target = new THREE.Vector3(0, 0.6, -1.3);
        const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
        cam.aspect = fw / fh;
        cam.clearViewOffset();
        const v = new THREE.Vector3();
        const box = (dist) => {
            cam.position.copy(target).addScaledVector(dir, dist);
            cam.lookAt(target);
            cam.updateMatrixWorld();
            cam.updateProjectionMatrix();
            let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
            for (const p of pts) { v.copy(p).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
            return { x0, x1, y0, y1 };
        };
        let lo = 4, hi = 60;
        for (let k = 0; k < 30; k++) {
            const mid = (lo + hi) / 2, b = box(mid);
            if (b.x1 - b.x0 > 1.9 || b.y1 - b.y0 > 1.88) lo = mid; else hi = mid;
        }
        const dist = hi, b = box(dist);
        this.camDist = dist;
        // shift so the projected box is centred in the free area
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        // The fit was made for a virtual image the size of the free box; the canvas is a window
        // onto it, offset by where the free box sits and by the box's off-centre projection.
        cam.aspect = fw / fh;
        cam.setViewOffset(fw, fh, -free.l + cx * fw / 2, -free.t - cy * fh / 2, w, h);
        cam.far = dist * 4 + 40;
        cam.updateProjectionMatrix();
        this.scene.fog.near = dist * 1.4;
        this.scene.fog.far = dist * 3.5 + 20;
        this.basePos = cam.position.clone();
        this.fitted = true;
    }

    /** Screen (client) px → board cell, or null. */
    pick(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.ray.setFromCamera(ndc, this.camera);
        const hit = new THREE.Vector3();
        if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
        const x = Math.round(hit.x + HALF), y = Math.round(hit.z + HALF);
        if (x < 0 || y < 0 || x >= BOARD.w || y >= BOARD.h) return null;
        if (Math.abs(hit.x + HALF - x) > 0.52 || Math.abs(hit.z + HALF - y) > 0.52) return null;
        return { x, y };
    }

    /** World point → client px (for floating numbers). */
    toScreen(p) {
        const v = p.clone().project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    }

    flash(k = 1, color = 0xff3322) { this.grade.uniforms.uFlash.value = Math.max(this.grade.uniforms.uFlash.value, 0.45 * k); this.grade.uniforms.uFlashCol.value.set(color); }
    kick(k = 1) { this.shake = Math.max(this.shake, k); this.grade.uniforms.uAber.value = Math.max(this.grade.uniforms.uAber.value, k); }

    render(dt, time) {
        const u = this.grade.uniforms;
        u.uFlash.value = Math.max(0, u.uFlash.value - dt * 1.6);
        u.uAber.value = Math.max(0, u.uAber.value - dt * 2.5);
        this.skyMat.uniforms.uTime.value = time;
        this.moteMat.uniforms.uTime.value = time;
        this.daisMat.uniforms.uTime.value = time;
        this.daisMat.uniforms.uPulse.value = Math.max(0, this.daisMat.uniforms.uPulse.value - dt * 1.5);
        for (const k in this.cellGlow) this.cellGlow[k].material.uniforms.uTime.value = time;
        for (const [i, b] of this.braziers.entries()) b.fire.intensity = 5 + Math.sin(time * 9 + i * 2) * 0.8 + Math.sin(time * 23 + i) * 0.5;
        this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 30);
        if (this.basePos) {
            this.shake = Math.max(0, this.shake - dt * 3);
            const s = this.shake * this.shake * 0.12 * (this.shakeScale ?? 1);
            this.camera.position.set(this.basePos.x + (Math.random() - 0.5) * s, this.basePos.y + (Math.random() - 0.5) * s, this.basePos.z);
        }
        this.composer.render(dt);
    }
}
