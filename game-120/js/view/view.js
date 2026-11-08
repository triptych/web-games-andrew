// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y, z) maps straight to world (x, y, z): the walker starts at z = 0 and the Hive is at -z.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BIOMES, BIOME_OF } from './biomes.js';
import { LevelView } from './terrainmesh.js';
import { buildMech, metal, glow } from './walker.js';
import { buildEnemyModel, poseRigged } from './models.js';
import { FX } from './fx.js';
import { WEAPONS } from '../sim/data.js';

import { roundBloom } from '../../../lib/round-bloom.js';

const V = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FOV = 52;

const SKY_V = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_F = `
uniform vec3 top; uniform vec3 hor; uniform vec3 sunCol; uniform vec3 sunDir; uniform float t; uniform float storm;
varying vec3 vDir;
void main(){
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 1.5 + 0.08, 0.0, 1.0);
    vec3 c = mix(hor, top, pow(h, 0.5));
    float s = clamp(dot(d, normalize(sunDir)), 0.0, 1.0);
    c += sunCol * (pow(s, 700.0) * 8.0 + pow(s, 14.0) * 0.4);
    float cl = sin(d.x * 13.0 + t * 0.015) * sin(d.z * 8.0 - t * 0.01) * 0.5 + 0.5;
    c = mix(c, hor * 1.15, smoothstep(0.55, 0.95, cl) * 0.28 * (1.0 - h) * (1.0 - h * 0.5));
    c = mix(c, hor * 0.9 + 0.1, storm * 0.8);
    gl_FragColor = vec4(c, 1.0);
}`;

export class View {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.q = opts.quality || 'high';
        const dpr = window.devicePixelRatio || 1;
        this.dprMax = Math.min(dpr, this.q === 'high' ? 2 : 1.25);
        this.prScale = 1;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q !== 'high', powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = this.q !== 'low';
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 520);
        this.camera.position.set(0, 12, 16);
        this.pmrem = new THREE.PMREMGenerator(this.renderer);

        // lights
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.sun.castShadow = this.q !== 'low';
        const sh = this.sun.shadow; sh.mapSize.set(this.q === 'high' ? 2048 : 1024, this.q === 'high' ? 2048 : 1024);
        sh.camera.left = -46; sh.camera.right = 46; sh.camera.top = 46; sh.camera.bottom = -46; sh.camera.near = 5; sh.camera.far = 220; sh.bias = -0.0008; sh.normalBias = 0.5;
        this.scene.add(this.sun, this.sun.target);
        this.sunDir = new V(0, 1, 0);

        // sky
        this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
            uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new V(0, 1, 0) }, t: { value: 0 }, storm: { value: 0 } } });
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), this.skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = -10; this.scene.add(this.sky);
        this.scene.fog = new THREE.Fog(0x888888, 60, 240);

        // post
        this.composer = null;
        this.bloom = null;
        this.buildComposer();

        this.world = null; this.lv = null; this.G = null;
        this.models = new Map();
        this.hbars = new Map();
        this.fx = new FX(this.scene, this.q, (x, z) => (this.world ? this.world.h(x, z) : 0));
        this.mech = null; this.mechKey = ''; this.mechScale = 1;
        this.mechGroup = new THREE.Group(); this.scene.add(this.mechGroup);
        this.camPos = new V(0, 12, 16); this.camLook = new V(0, 0, 0);
        this.time = 0; this.storm = 0; this.hangar = false; this.hangarT = 0;
        this.kick = [];
        this.flameT = 0;
        this.buildTracers();
        this.buildTelegraphs();
        this.buildPickups();
        this.buildHangar();
        this.buildLock();
        this.fwd = new V(); this.tmpV = new V(); this.shakeV = new V();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this.frameMs = 16; this.slowT = 0; this.fastT = 0;
    }

    buildComposer() {
        if (this.q === 'low') { this.composer = null; return; }
        const w = 64, h = 64;
        const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.q === 'high' ? 4 : 0 });
        this.composer = new EffectComposer(this.renderer, rt);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.55, 1.05);
        roundBloom(this.bloom);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth)), h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const pr = this.dprMax * this.prScale;
        if (w === this.w && h === this.h && pr === this.pr) return;
        this.w = w; this.h = h; this.pr = pr;
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
        this.camera.aspect = w / h;
        // portrait phones need a wider vertical field to keep the walker and the road ahead in view
        this.camera.fov = w / h < 1 ? FOV + Math.min(22, (1 - w / h) * 40) : FOV;
        this.camera.updateProjectionMatrix();
        this.fx.setSize(h * pr, this.camera.fov);
    }

    // ------------------------------------------------------------------ pools
    buildTracers() {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
        const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color()); this.scene.add(m); return m; };
        const bolt = new THREE.CylinderGeometry(0.5, 0.5, 1, 6); bolt.rotateX(Math.PI / 2);
        this.tracers = mk(bolt, 500);
        this.orbs = mk(new THREE.SphereGeometry(1, 10, 8), 160);
        const mis = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); mis.rotateX(Math.PI / 2);
        this.rockets = mk(mis, 120);
        this.o3 = new THREE.Object3D(); this.col = new THREE.Color();
    }

    buildTelegraphs() {
        const flat = new THREE.CircleGeometry(1, 40); flat.rotateX(-Math.PI / 2);
        const ringG = new THREE.RingGeometry(0.9, 1, 48); ringG.rotateX(-Math.PI / 2);
        const mkMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
        this.markPool = [];
        for (let i = 0; i < 40; i++) {
            const g = new THREE.Group(), disc = new THREE.Mesh(flat, mkMat(0xff3020, 0.2)), fill = new THREE.Mesh(flat, mkMat(0xff6030, 0.35)), ring = new THREE.Mesh(ringG, mkMat(0xff4030, 0.9));
            g.add(disc, fill, ring); g.visible = false; g.userData = { disc, fill, ring }; this.scene.add(g); this.markPool.push(g);
        }
        this.wavePool = [];
        for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), mkMat(0xbfe8ff, 0.9)); m.visible = false; this.scene.add(m); this.wavePool.push(m); }
        this.firePool = [];
        for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(flat, mkMat(0xff6a1a, 0.55)); m.visible = false; m.renderOrder = 2; this.scene.add(m); this.firePool.push(m); }
        const strip = new THREE.PlaneGeometry(1, 1); strip.rotateX(-Math.PI / 2); strip.translate(0, 0, -0.5);
        this.strip = new THREE.Mesh(strip, mkMat(0xff3020, 0.3)); this.strip.visible = false; this.scene.add(this.strip);
        const beam = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true); beam.rotateX(Math.PI / 2); beam.translate(0, 0, -0.5);
        this.beam = new THREE.Mesh(beam, mkMat(0xff5a30, 0.85)); this.beam.visible = false; this.scene.add(this.beam);
        this.beamCore = new THREE.Mesh(beam, mkMat(0xffffff, 1)); this.beamCore.visible = false; this.scene.add(this.beamCore);
        this.links = [];
        for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(beam, mkMat(0x7ae8ff, 0.7)); m.visible = false; this.scene.add(m); this.links.push(m); }
        const col = new THREE.CylinderGeometry(1, 1, 90, 10, 1, true); col.translate(0, 45, 0);
        this.columns = [];
        for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(col, mkMat(0xff6a3a, 0.8)); m.visible = false; this.scene.add(m); this.columns.push(m); }
        this.podMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x4a4048, emissive: 0xff4020, emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.4 }));
        this.drops = [];
        for (let i = 0; i < 10; i++) { const m = this.podMesh.clone(); m.visible = false; this.scene.add(m); this.drops.push(m); }
    }

    buildPickups() {
        const mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.3, metalness: 0.5 });
        const mk = (geo, c, e) => { const m = new THREE.InstancedMesh(geo, mat(c, e), 80); m.count = 0; m.frustumCulled = false; this.scene.add(m); return m; };
        this.pk = {
            scrap: mk(new THREE.OctahedronGeometry(0.5, 0), 0xffc83a, 1.6), hp: mk(new THREE.BoxGeometry(0.8, 0.8, 0.8), 0x4aff7a, 1.6),
            fuel: mk(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10), 0xff8a2a, 1.6), ammo: mk(new THREE.CapsuleGeometry(0.28, 0.6, 3, 8), 0x5ab8ff, 1.6),
        };
    }

    /** The lock-on bracket drawn over the enemy the homing rockets will pick. */
    buildLock() {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round';
        for (let i = 0; i < 4; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(-50, -26); g.lineTo(-50, -50); g.lineTo(-26, -50); g.stroke(); g.restore(); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        this.lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0xff7a3a, depthTest: false, transparent: true, toneMapped: false }));
        this.lock.renderOrder = 60; this.lock.visible = false; this.scene.add(this.lock);
    }

    buildHangar() {
        const g = new THREE.Group(); g.visible = false;
        const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), metal(0x181c24, 0.5, 0.7)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
        const dais = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.6, 0.6, 48), metal(0x2a303c, 0.3, 0.9)); dais.position.y = 0.3; dais.receiveShadow = true; g.add(dais);
        const ringM = glow(0x38e4ff, 2.5);
        const r1 = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.12, 8, 64), ringM); r1.rotation.x = Math.PI / 2; r1.position.y = 0.62; g.add(r1);
        const r2 = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.07, 8, 64), ringM); r2.rotation.x = Math.PI / 2; r2.position.y = 0.62; g.add(r2);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * 6.28, pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), metal(0x20242c, 0.4, 0.9)); pillar.position.set(Math.cos(a) * 26, 11, Math.sin(a) * 26); pillar.castShadow = true; g.add(pillar);
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 14, 0.3), glow(i % 2 ? 0xffb050 : 0x38e4ff, 2.2)); lamp.position.set(Math.cos(a) * 25.2, 11, Math.sin(a) * 25.2); g.add(lamp);
        }
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 30, 48, 1, true), metal(0x12151b, 0.6, 0.6, { side: THREE.BackSide })); wall.position.y = 15; g.add(wall);
        this.hangarGroup = g; this.scene.add(g);
        this.hSpot = new THREE.SpotLight(0xfff0d8, 600, 80, 0.7, 0.6, 1.5); this.hSpot.position.set(10, 30, 14); this.hSpot.castShadow = this.q !== 'low'; this.hSpot.visible = false; this.scene.add(this.hSpot, this.hSpot.target);
        this.hRim = new THREE.PointLight(0x38e4ff, 300, 60, 1.6); this.hRim.position.set(-14, 8, -12); this.hRim.visible = false; this.scene.add(this.hRim);
    }

    // ------------------------------------------------------------------ level
    loadLevel(G) {
        if (this.lv) { this.scene.remove(this.lv.group); this.lv.dispose(); }
        for (const m of this.models.values()) { this.scene.remove(m.group); m.dispose(); }
        this.models.clear();
        for (const b of this.hbars.values()) this.scene.remove(b.bg, b.fg);
        this.hbars.clear();
        this.world = G.world; this.G = G;
        const B = BIOMES[BIOME_OF[G.level]];
        this.B = B;
        this.lv = new LevelView(G.world, G.level, this.q, G);
        this.lv.fx = this.fx; this.lv.onTeleport = () => this.onTeleport?.();
        this.scene.add(this.lv.group);
        this.hemi.color.set(B.hemi[0]); this.hemi.groundColor.set(B.hemi[1]); this.hemi.intensity = B.hemi[2];
        this.sun.color.set(B.sun); this.sun.intensity = B.sunI;
        this.sunDir.set(...B.sunDir).normalize();
        this.scene.fog.color.set(B.fog); this.scene.fog.near = B.fogNear; this.scene.fog.far = B.fogFar;
        this.fogBase = [B.fogNear, B.fogFar];
        this.renderer.setClearColor(B.fog);
        const u = this.skyMat.uniforms;
        u.top.value.set(B.sky[0]); u.hor.value.set(B.sky[1]); u.sunCol.value.set(B.sun); u.sunDir.value.copy(this.sunDir);
        this.buildEnv(B);
        this.mechKey = ''; this.mech && this.mech.rig.plant && (this.mech.rig.placed = false);
        this.camSnap = true;
        this.lowSmoke = 0;
    }

    buildEnv(B) {
        if (this.envTex) this.envTex.dispose();
        const s = new THREE.Scene();
        const g = new THREE.SphereGeometry(50, 24, 16);
        const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(B.sky[0]).multiplyScalar(1.6) }, hor: { value: new THREE.Color(B.sky[1]).multiplyScalar(1.4) }, gnd: { value: new THREE.Color(B.hemi[1]).multiplyScalar(2) } },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
            fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, clamp(h, 0.0, 1.0)) : mix(hor, gnd, clamp(-h * 2.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }' });
        s.add(new THREE.Mesh(g, mat));
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(B.sun).multiplyScalar(6), side: THREE.DoubleSide }));
        panel.position.set(this.sunDir.x * 40, this.sunDir.y * 40, this.sunDir.z * 40); panel.lookAt(0, 0, 0); s.add(panel);
        this.envTex = this.pmrem.fromScene(s, 0.04).texture;
        this.scene.environment = this.envTex;
        this.scene.environmentIntensity = 0.8;
        g.dispose(); mat.dispose();
    }

    setMech(G) {
        const key = G.upg.guns + '' + G.upg.missiles + G.upg.armor + G.upg.fuel + G.upg.legs;
        if (key === this.mechKey && this.mech) return;
        if (this.mech) { this.mechGroup.remove(this.mech.root); this.mech.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
        this.mech = buildMech(G.upg, this.q);
        this.mechGroup.add(this.mech.root);
        this.mech.rig.onStep = (leg) => { if (this.G) this.stepFx(leg.planted.x, leg.planted.z, this.G.st.scale); };
        this.mech.pose = null;
        this.mechKey = key;
        this.kick = this.mech.info.barrels.map(() => 0);
        this.mech.rig.placed = false;
    }
    stepFx(x, z, s) {
        if (!this.B) return;
        this.fx.dust(x, z, this.B.dust, s > 1.4 ? 2 : 1);
        if (s > 1.5) this.fx.shake = Math.max(this.fx.shake, 0.03 * s);
        if (this.onStep) this.onStep(x, z, s);
    }

    // ------------------------------------------------------------------ sim events -> effects
    onEvents(G, events) {
        const fx = this.fx, p = G.player;
        for (const e of events) {
            switch (e.type) {
                case 'boom': {
                    const kind = e.kind;
                    fx.explosion(e.x, e.y, e.z, Math.min(5, e.size || 2), kind === 'plasma' ? 'plasma' : kind === 'erupt' || kind === 'phase' ? kind : '', e.r || 4);
                    if (e.inf) fx.ichor(e.x, e.y, e.z, 14);
                    if (e.col === 'mech') { fx.debris(e.x, e.y, e.z, 30, 0xe3a02e, 16, false); fx.sparks(e.x, e.y, e.z, 40, 0x38e4ff, 14); }
                    const d = Math.hypot(e.x - p.x, e.z - p.z);
                    if (e.size >= 3 && d < 70) fx.shake = Math.max(fx.shake, (e.size * 0.12) * (1 - d / 70));
                    break;
                }
                case 'shot': {
                    if (e.team === 'p' && e.dx !== undefined) {
                        fx.muzzle(e.x, e.y, e.z, e.dx, e.dy, e.dz, WEAPONS[e.tier ?? 0].col, 0.8 + (e.tier || 0) * 0.15);
                        if (e.barrel !== undefined && this.kick) this.kick[e.barrel] = 1;
                        if (e.tier >= 4) fx.shake = Math.max(fx.shake, 0.05);
                    } else if (e.team === 'p') { fx.puff(e.x, e.y, e.z, 3, 0x9a9a9a, 0.8, 1, 0.8); }
                    else if (e.x !== undefined) fx.sparks(e.x, e.y, e.z, e.heavy ? 8 : 2, 0xff9a50, 4);
                    break;
                }
                case 'impact': fx.impact(e.x, e.y, e.z, e.what === 'player' ? 0xff6a40 : 0xffd080, e.what === 'ground'); break;
                case 'hit': { const inf = e.kind === 'trooper' || e.kind === 'rocketeer' || e.kind === 'wasp'; if (inf) fx.ichor(e.x, e.y, e.z, 3); else fx.sparks(e.x, e.y, e.z, 4, 0xffe0a0, 7); break; }
                case 'ping': fx.sparks(e.x, e.y, e.z, 5, e.shield ? 0x7ae8ff : 0xffffff, 6); break;
                case 'scorch': fx.scorch(e.x, e.z, e.r); break;
                case 'stomp': {
                    fx.ring(e.x, e.z, e.r * 1.3, 0.6, e.fire ? 0xff8030 : 0xbfe8ff);
                    fx.dust(e.x, e.z, this.B.dust, 8);
                    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; fx.dust(e.x + Math.cos(a) * e.r * 0.5, e.z + Math.sin(a) * e.r * 0.5, this.B.dust, 2); }
                    fx.shake = Math.max(fx.shake, e.mine ? 0.25 : 0.35);
                    break;
                }
                case 'land': fx.dust(e.x, e.z, this.B.dust, 10); break;
                case 'jump': fx.dust(e.x, e.z, this.B.dust, 8); fx.sparks(e.x, this.world.h(e.x, e.z) + 0.5, e.z, 12, 0xffb060, 8); break;
                case 'step': break;
                case 'pickup': {
                    const c = e.kind === 'scrap' ? 0xffc83a : e.kind === 'hp' ? 0x4aff7a : e.kind === 'fuel' ? 0xff8a2a : 0x5ab8ff;
                    fx.sparks(p.x, p.y + 3, p.z, 8, c, 5); break;
                }
                case 'rescue': {
                    fx.ring(e.x, e.z, 14, 1.2, 0x7aff9a); fx.light(e.x, this.world.h(e.x, e.z) + 4, e.z, 0x7aff9a, 80, 0.8);
                    for (let i = 0; i < 40; i++) fx.glow.emit(e.x, this.world.h(e.x, e.z) + 3, e.z, fx.r(-6, 6), fx.r(6, 15), fx.r(-6, 6), fx.r(0.8, 1.6), 0.4, 0.15, [0xff6a9a, 0x7aff9a, 0xffe05a, 0x6ac8ff][i % 4], 0xffffff, 2.4, 0, 0.5, 14);
                    break;
                }
                case 'bossPhase': fx.ring(e.x ?? p.x, e.z ?? p.z, 40, 1.2, 0xffffff); fx.shake = Math.max(fx.shake, 0.7); break;
                case 'wave': fx.ring(e.x, e.z, 36, 1.0, 0xffffff); fx.shake = Math.max(fx.shake, 0.5); break;
                case 'drop': fx.ring(e.x, e.z, 8, 0.6, 0xff8a40); fx.dust(e.x, e.z, this.B.dust, 10); fx.shake = Math.max(fx.shake, 0.1); break;
                case 'tremor': fx.dust(e.x, e.z, this.B.dust, 5); fx.shake = Math.max(fx.shake, 0.06); break;
                case 'dive': fx.dust(e.x, e.z, 0xe8f4ff, 16); fx.ring(e.x, e.z, 12, 0.8, 0xbfe8ff); fx.debris(e.x, this.world.h(e.x, e.z) + 1, e.z, 14, 0xbfe0ff, 10); break;
                case 'erupt': fx.ring(e.x, e.z, 18, 0.9, 0xe8f8ff); fx.dust(e.x, e.z, 0xe8f4ff, 20); fx.debris(e.x, this.world.h(e.x, e.z) + 1, e.z, 24, 0xbfe0ff, 16); fx.shake = Math.max(fx.shake, 0.7); break;
                case 'smash': fx.sparks(e.x, p.y + 3, e.z, 30, 0xffffff, 12); fx.shake = Math.max(fx.shake, 0.5); break;
                case 'bossDown': fx.shake = 1.4; break;
                case 'dead': this.mechGroup.visible = false; fx.shake = 1.2; break;
                case 'upgrade': this.weld = 1.2; break;
                case 'hurt': break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ per-frame
    frame(G, dt, time, mode = 'play') {
        const t0 = performance.now();
        this.resize();
        this.time = time;
        if (G.world !== this.world) this.loadLevel(G);
        this.G = G;
        const hangar = mode === 'hangar';
        if (hangar !== this.hangar) this.enterHangar(hangar, G);
        this.setMech(G);
        const st = G.st, p = G.player, w = G.world;
        const h = hangar ? () => 0.6 : (x, z) => w.h(x, z);
        const ctx = { h, time, player: p, fx: this.fx };

        // the walker
        const target = st.scale;
        this.mechScale += (target - this.mechScale) * Math.min(1, dt * (hangar ? 2 : 5));
        if (Math.abs(this.mechScale - target) < 0.002) this.mechScale = target;
        const air = !hangar && p.y - w.h(p.x, p.z) > 0.35;
        if (this.mech && (G.phase !== 'dead' || this.mechGroup.visible)) {
            const e = hangar ? { x: 0, y: 0.6, z: 0, yaw: Math.sin(time * 0.3) * 0.6, vx: 0, vz: 0 } : { x: p.x, y: p.y, z: p.z, yaw: p.yaw, vx: p.vx, vz: p.vz };
            this.mech.pose = this.mech.pose || null;
            poseRigged(this.mech, e, dt, ctx, this.mechScale, this.mech.info.H, air);
            this.animateMech(G, dt, time, hangar);
        }
        if (G.phase !== 'dead' && !this.mechGroup.visible && mode !== 'dead') this.mechGroup.visible = true;

        // lights follow
        const cx = hangar ? 0 : p.x, cz = hangar ? 0 : p.z, cy = hangar ? 0 : p.y;
        this.sun.target.position.set(cx, cy, cz);
        this.sun.position.set(cx + this.sunDir.x * 90, cy + this.sunDir.y * 90, cz + this.sunDir.z * 90);
        this.sky.position.copy(this.camera.position);
        this.skyMat.uniforms.t.value = time;

        if (!hangar) {
            this.lv.update(dt, time, G, p.x, p.z);
            this.syncEnemies(G, dt, ctx);
            this.drawBullets(G, dt);
            this.drawTelegraphs(G, dt, time);
            this.drawPickups(G, time);
            this.ambient(G, dt, time);
            this.burners(G, dt);
            if (G.phase === 'victory') this.fireworks(G, dt);
        } else this.hangarFrame(G, dt, time);

        this.updateCamera(G, dt, time, hangar);
        this.fx.update(dt, this.camera);
        this.render();
        // dynamic resolution: if frames are slow for a while, render fewer pixels
        const ms = performance.now() - t0 + 0.0;
        this.frameMs = this.frameMs * 0.95 + (dt * 1000) * 0.05;
        if (!this.noAdapt) {
            if (this.frameMs > 30) { this.slowT += dt; this.fastT = 0; } else if (this.frameMs < 19) { this.fastT += dt; this.slowT = 0; }
            if (this.slowT > 2 && this.prScale > 0.55) { this.prScale = Math.max(0.55, this.prScale - 0.15); this.slowT = 0; }
            else if (this.fastT > 6 && this.prScale < 1) { this.prScale = Math.min(1, this.prScale + 0.1); this.fastT = 0; }
        }
        void ms;
    }

    render() {
        if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    }

    animateMech(G, dt, time, hangar) {
        const info = this.mech.info, p = G.player, root = this.mech.root;
        const boosting = !hangar && p.boosting, jetting = !hangar && p.jetting;
        const on = boosting || jetting;
        info.flames.forEach((f, i) => { f.visible = on; if (on) f.scale.set(1, 1, (0.8 + Math.random() * 0.5) * (boosting ? 1.4 : 1.0)); });
        if (on && !hangar) {
            for (const j of info.jets) {
                _v.copy(j); info.hull.localToWorld(_v);
                this.fx.glow.emit(_v.x, _v.y, _v.z, this.fx.r(-0.5, 0.5), this.fx.r(-0.5, 0.5) - (jetting ? 4 : 0), this.fx.r(-0.5, 0.5), 0.35, 0.8, 0.15, 0xffc060, 0xff3000, 2.4, 0, 1, 0);
                if (jetting) this.fx.dust(_v.x, _v.z, this.B.dust, 1);
            }
        }
        this.kick.forEach((k, i) => { this.kick[i] = Math.max(0, k - dt * 14); info.barrels[i].position.z = k * 0.25; });
        if (!hangar && p.hp < G.st.maxHp * 0.4 && Math.random() < dt * 14) {
            _v.set(0, 0.8, 0.8); info.hull.localToWorld(_v);
            this.fx.smoke.emit(_v.x, _v.y, _v.z, 0, 2, 0, 1.4, 0.5, 2.2, 0x1a1816, 0x1a1816, 0.6, 0, 1, -0.5);
            if (p.hp < G.st.maxHp * 0.2) this.fx.sparks(_v.x, _v.y, _v.z, 1, 0xffb050, 4);
        }
        if (this.weld > 0) {
            this.weld -= dt;
            if (Math.random() < 0.7) { _v.set((Math.random() - 0.5) * 3, Math.random() * 1.2, (Math.random() - 0.5) * 4); info.hull.localToWorld(_v); this.fx.sparks(_v.x, _v.y, _v.z, 6, 0xaee8ff, 7); }
        }
    }

    updateCamera(G, dt, time, hangar) {
        const cam = this.camera, p = G.player, s = Math.sqrt(this.mechScale);
        if (this.focus && !hangar) {            // debug: frame the boss (dev/shots.mjs, the gallery)
            const e = G.enemies.find((q) => q.b && q.hp > 0);
            if (e) {
                const R = e.r * (this.focus.k || 3.2) + 8, a = this.focus.a ?? 0.6;
                cam.position.set(e.x + Math.sin(a) * R, e.y + e.h * 0.55 + R * 0.3, e.z + Math.cos(a) * R);
                cam.lookAt(e.x, e.y + e.h * 0.42, e.z);
                return;
            }
        }
        if (hangar) {
            this.hangarT += dt * 0.25;
            const R = 15 + this.mechScale * 6, a = this.hangarT + 0.6;
            const px = Math.sin(a) * R, pz = Math.cos(a) * R;
            this.camPos.set(px, 4.5 + this.mechScale * 3.2, pz);
            cam.position.copy(this.camPos);
            this.camLook.set(0, 2.8 + this.mechScale * 1.2, 0);
            cam.lookAt(this.camLook);
            if (cam.aspect > 1.15) cam.translateX(R * 0.3); else cam.translateY(-R * 0.28);     // keep the walker clear of the upgrade panel
            return;
        }
        const lead = 0.28;
        const tx = p.x + Math.sin(p.yaw) * 9 * lead * 2, tz = p.z - Math.cos(p.yaw) * 9 * lead * 2;
        const camH = 9.5 * s + 2.5, camD = 14 * s + 4;
        let gy = p.y + 1.5 * s;
        this.camLook.x += (tx - this.camLook.x) * Math.min(1, dt * 4.5); this.camLook.z += (tz - 5 - this.camLook.z) * Math.min(1, dt * 4.5);
        this.camLook.y += (gy - this.camLook.y) * Math.min(1, dt * 3);
        const wx = p.x + (this.camLook.x - p.x) * 0.3, wz = p.z + camD;
        this.camPos.x += (wx - this.camPos.x) * Math.min(1, dt * 5); this.camPos.z += (wz - this.camPos.z) * Math.min(1, dt * 5);
        const floor = this.world.h(this.camPos.x, this.camPos.z) + 2.2;
        const wantY = Math.max(floor, gy + camH);
        this.camPos.y += (wantY - this.camPos.y) * Math.min(1, dt * 3.5);
        if (this.camSnap) { this.camSnap = false; this.camPos.set(p.x, p.y + camH, p.z + camD); this.camLook.set(tx, gy, tz - 5); }
        cam.position.copy(this.camPos);
        this.fx.shakeOffset(time, this.shakeV);
        if (!(window.A11Y && window.A11Y.reducedMotion)) cam.position.add(this.shakeV);
        cam.lookAt(this.camLook.x, this.camLook.y, this.camLook.z);
    }

    // ------------------------------------------------------------------ enemies
    syncEnemies(G, dt, ctx) {
        const p = G.player, seen = new Set();
        for (const e of G.enemies) {
            const d = Math.hypot(e.x - p.x, e.z - p.z);
            const far = d > (e.b ? 320 : 150);
            let m = this.models.get(e.id);
            if (!m) {
                if (far) continue;
                m = buildEnemyModel(e.type); this.models.set(e.id, m); this.scene.add(m.group);
                if (m.rig) m.rig.onStep = (leg) => { if (this.fx) this.fx.dust(leg.planted.x, leg.planted.z, this.B.dust, e.b ? 3 : 1); if (e.b) { this.fx.shake = Math.max(this.fx.shake, 0.08); this.onBossStep?.(Math.hypot(e.x - this.G.player.x, e.z - this.G.player.z)); } };
            }
            seen.add(e.id);
            m.group.visible = !far && !(m.hidden && e.b);
            if (far) continue;
            m.tick(dt, e, ctx);
            if (m.hidden) { m.group.visible = true; }
            if (e.hp <= 0 && !e.b) m.group.visible = false;
            // health bar for hurt, awake things (bosses use the HUD)
            if (!e.b && e.awake && e.hp < e.maxhp && e.hp > 0 && d < 80) this.hbar(e, m);
        }
        for (const [id, m] of this.models) if (!seen.has(id)) { this.scene.remove(m.group); m.dispose(); this.models.delete(id); const b = this.hbars.get(id); if (b) { this.scene.remove(b.bg, b.fg); this.hbars.delete(id); } }
        for (const [id, b] of this.hbars) if (b.stale-- <= 0) { b.bg.visible = b.fg.visible = false; }
        // lock-on bracket on the enemy the rockets would home in on
        const tg = p.target && p.missiles >= 1 ? G.enemies.find((q) => q.id === p.target && q.hp > 0 && !(q.b && q.b.under)) : null;
        if (tg) {
            const sz = Math.max(2.4, tg.r * 2.8) * (1 + Math.sin(this.time * 8) * 0.05);
            this.lock.visible = true; this.lock.position.set(tg.x, tg.y + (tg.fly ? 0 : tg.h * 0.5), tg.z); this.lock.scale.set(sz, sz, 1); this.lock.material.rotation += dt * 1.2;
        } else this.lock.visible = false;
        // shield links from pylons to the shielded boss
        let li = 0;
        const boss = G.enemies.find((q) => q.b && q.hp > 0);
        for (const l of this.links) l.visible = false;
        if (boss && boss.b.shield) for (const q of G.enemies) if (q.type === 'pylon' && q.hp > 0 && li < 4) this.link(this.links[li++], q.x, q.y + 4.5, q.z, boss.x, boss.y + boss.h * 0.5, boss.z);
    }
    hbar(e, m) {
        let b = this.hbars.get(e.id);
        if (!b) {
            const mk = (c) => new THREE.Sprite(new THREE.SpriteMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.9, toneMapped: false }));
            b = { bg: mk(0x1a1010), fg: mk(0x7aff5a), stale: 0 }; b.bg.renderOrder = 50; b.fg.renderOrder = 51; this.scene.add(b.bg, b.fg); this.hbars.set(e.id, b);
        }
        b.stale = 2; b.bg.visible = b.fg.visible = true;
        const w = Math.max(1.2, e.r * 1.4), f = Math.max(0.02, e.hp / e.maxhp), y = e.y + (e.fly ? 1.6 : m.height + 0.6);
        b.bg.scale.set(w, 0.22, 1); b.bg.position.set(e.x, y, e.z);
        b.fg.scale.set(w * f, 0.16, 1); b.fg.position.set(e.x - (w - w * f) / 2, y + 0.01, e.z);
        b.fg.material.color.setHex(f > 0.5 ? 0x7aff5a : f > 0.25 ? 0xffd24a : 0xff4a3a);
    }
    link(m, x0, y0, z0, x1, y1, z1) {
        _v.set(x1 - x0, y1 - y0, z1 - z0); const len = _v.length();
        m.visible = true; m.position.set(x0, y0, z0); m.lookAt(x1, y1, z1); m.scale.set(0.18 + Math.sin(this.time * 20) * 0.04, 0.18, len);
    }

    // ------------------------------------------------------------------ projectiles
    drawBullets(G, dt) {
        const o = this.o3, c = this.col;
        let nt = 0, no = 0, nr = 0;
        for (const b of G.bullets) {
            const sp = Math.hypot(b.vx, b.vy, b.vz) || 1;
            const hot = b.team === 'p';
            switch (b.kind) {
                case 'bolt': case 'slug': case 'shard': {
                    if (nt >= 500) break;
                    const len = b.kind === 'slug' ? 5 : b.kind === 'shard' ? 1.6 : 1.5 + sp * 0.02, th = (b.kind === 'slug' ? 0.2 : b.kind === 'shard' ? 0.22 : 0.12 + b.r * 0.2);
                    o.position.set(b.x - b.vx / sp * len * 0.4, b.y - b.vy / sp * len * 0.4, b.z - b.vz / sp * len * 0.4);
                    o.lookAt(o.position.x + b.vx, o.position.y + b.vy, o.position.z + b.vz); o.scale.set(th, th, len); o.updateMatrix();
                    this.tracers.setMatrixAt(nt, o.matrix);
                    if (b.kind === 'shard') c.setHex(0x9fe0ff).multiplyScalar(2.2); else if (hot) c.setHex(b.col || 0x66ddff).multiplyScalar(3); else c.setHex(b.col || 0xff7a30).multiplyScalar(2.4);
                    this.tracers.setColorAt(nt, c); nt++;
                    if (b.kind === 'slug' && Math.random() < 0.6) this.fx.glow.emit(b.x, b.y, b.z, 0, 0, 0, 0.3, 0.5, 0.1, 0xbfe8ff, 0x4080ff, 1.2, 0, 2, 0);
                    break;
                }
                case 'missile': case 'emissile': case 'rocket': {
                    if (nr >= 120) break;
                    o.position.set(b.x, b.y, b.z); o.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); o.scale.set(0.3, 0.3, 1.5); o.updateMatrix();
                    this.rockets.setMatrixAt(nr, o.matrix); c.setHex(hot ? 0xffe0b0 : 0xff6a40).multiplyScalar(2); this.rockets.setColorAt(nr, c); nr++;
                    this.fx.glow.emit(b.x - b.vx / sp * 0.8, b.y - b.vy / sp * 0.8, b.z - b.vz / sp * 0.8, 0, 0, 0, 0.25, 0.8, 0.2, hot ? 0xffd080 : 0xff8040, 0xff2000, 2.2, 0, 1, 0);
                    if (Math.random() < 0.9) this.fx.smoke.emit(b.x - b.vx / sp * 1.2, b.y - b.vy / sp * 1.2, b.z - b.vz / sp * 1.2, this.fx.r(-0.3, 0.3), this.fx.r(-0.3, 0.3), this.fx.r(-0.3, 0.3), 1.0, 0.4, 1.6, 0x8a8480, 0x8a8480, 0.4, 0, 1.2, -0.2);
                    break;
                }
                default: {                    // shell, fireball, bomblet: glowing orbs
                    if (no >= 160) break;
                    const r = b.kind === 'fireball' ? 0.9 : b.kind === 'shell' ? 0.6 : 0.3;
                    o.position.set(b.x, b.y, b.z); o.rotation.set(0, 0, 0); o.scale.setScalar(r); o.updateMatrix();
                    this.orbs.setMatrixAt(no, o.matrix); c.setHex(b.kind === 'fireball' ? 0xff7a20 : b.kind === 'shell' ? 0xff9a50 : 0xffd060).multiplyScalar(2.4); this.orbs.setColorAt(no, c); no++;
                    this.fx.glow.emit(b.x, b.y, b.z, this.fx.r(-0.4, 0.4), this.fx.r(-0.4, 0.4), this.fx.r(-0.4, 0.4), 0.45, r * 1.6, 0.2, 0xff9040, 0xff2000, 1.8, 0, 1, 0);
                    if (b.kind !== 'bomblet') this.fx.smoke.emit(b.x, b.y, b.z, 0, 0.3, 0, 0.9, r, r * 3, 0x302a26, 0x302a26, 0.4, 0, 1, -0.3);
                }
            }
        }
        for (const [m, n] of [[this.tracers, nt], [this.orbs, no], [this.rockets, nr]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
        void dt;
    }

    drawTelegraphs(G, dt, time) {
        const w = this.world, pool = this.markPool;
        let n = 0, ci = 0, di = 0;
        for (const col of this.columns) col.visible = false;
        for (const dm of this.drops) dm.visible = false;
        for (const m of G.marks) {
            if (n >= pool.length) break;
            const g = pool[n++]; const u = g.userData; g.visible = true;
            const k = 1 - m.t / m.tmax, y = w.h(m.x, m.z) + 0.35;
            g.position.set(m.x, y, m.z); g.scale.set(m.r, 1, m.r);
            const col = m.kind === 'drop' ? 0xff9a40 : m.kind === 'erupt' ? 0x9fe0ff : m.kind === 'ice' ? 0x9fe0ff : 0xff3a22;
            u.disc.material.color.setHex(col); u.fill.material.color.setHex(col); u.ring.material.color.setHex(col);
            u.fill.scale.set(k, 1, k); u.disc.material.opacity = 0.14 + Math.sin(time * 20) * 0.04; u.ring.material.opacity = 0.65 + Math.sin(time * 16) * 0.3;
            if (m.kind === 'shell' && m.from && ci < this.columns.length) {
                // the shell falls on a lob from the boss
                const u2 = clamp(k, 0, 1), sx = m.from.x + (m.x - m.from.x) * u2, sz = m.from.z + (m.z - m.from.z) * u2;
                const sy = m.from.y + (y - m.from.y) * u2 + Math.sin(u2 * Math.PI) * 30;
                this.fx.glow.emit(sx, sy, sz, 0, 0, 0, 0.3, 1.4, 0.2, 0xffa040, 0xff2000, 2.4, 0, 1, 0);
                this.fx.smoke.emit(sx, sy, sz, 0, 0, 0, 0.8, 0.8, 2, 0x403a36, 0x403a36, 0.4, 0, 1, 0);
            }
            if (m.kind === 'orbital' && m.t < 0.45 && ci < this.columns.length) { const col2 = this.columns[ci++]; col2.visible = true; col2.position.set(m.x, y, m.z); col2.scale.set(m.r * 0.5 * (1.2 - m.t), 1, m.r * 0.5 * (1.2 - m.t)); col2.material.opacity = 0.9; }
            if (m.kind === 'drop' && di < this.drops.length) { const d = this.drops[di++]; d.visible = true; const f = Math.max(0, m.t / m.tmax); d.position.set(m.x, y + 1.2 + f * f * 90, m.z); this.fx.glow.emit(d.position.x, d.position.y + 1, d.position.z, 0, 4, 0, 0.35, 1.5, 0.3, 0xffa050, 0xff2000, 2, 0, 1, 0); }
        }
        for (let i = n; i < pool.length; i++) pool[i].visible = false;
        // waves
        this.wavePool.forEach((m, i) => {
            const wv = G.waves[i];
            if (!wv) { m.visible = false; return; }
            m.visible = true; m.position.set(wv.x, this.world.h(wv.x, wv.z) + 0.7, wv.z); m.scale.set(wv.r, 1, wv.r);
            m.material.color.setHex(wv.kind === 'fire' ? 0xff7a30 : 0xcfeaff); m.material.opacity = 0.9 * (1 - wv.r / wv.max);
            if (Math.random() < 0.5) { const a = Math.random() * 6.28; this.fx.dust(wv.x + Math.cos(a) * wv.r, wv.z + Math.sin(a) * wv.r, wv.kind === 'fire' ? 0xff7a30 : this.B.dust, 1); }
        });
        // fires and lava
        this.firePool.forEach((m, i) => {
            const f = G.fires[i];
            if (!f) { m.visible = false; return; }
            m.visible = true; m.position.set(f.x, this.world.h(f.x, f.z) + 0.3, f.z); const r = f.r * f.grow; m.scale.set(r, 1, r);
            m.material.color.setHex(f.lava ? 0xc83a08 : 0xb85a14); m.material.opacity = (f.lava ? 0.7 : 0.35) * Math.min(1, f.t) + Math.sin(time * 9 + i) * 0.05;
            if (Math.random() < 0.8) { const a = Math.random() * 6.28, rr = Math.random() * r; this.fx.glow.emit(f.x + Math.cos(a) * rr, m.position.y, f.z + Math.sin(a) * rr, 0, this.fx.r(2, 5), 0, this.fx.r(0.5, 1.1), 0.9, 0.2, 0xffb040, 0xff2000, 1.4, 0, 0.5, -1); }
            if (Math.random() < 0.15) this.fx.smoke.emit(f.x + (Math.random() - 0.5) * r, m.position.y + 0.5, f.z + (Math.random() - 0.5) * r, 0, 2, 0, 1.6, 0.8, 2.6, 0x1c1816, 0x1c1816, 0.4, 0, 1, -0.4);
        });
        // boss telegraphs: charge lines and beams
        this.strip.visible = false; this.beam.visible = false; this.beamCore.visible = false;
        for (const e of G.enemies) {
            if (!e.b || !e.b.act || e.hp <= 0) continue;
            const a = e.b.act, y = e.y + 0.5;
            if ((a.k === 'charge' || a.k === 'lance') && a.t < a.wind && a.dx !== undefined) {
                this.strip.visible = true; this.strip.position.set(e.x, this.world.h(e.x, e.z) + 0.6, e.z); this.strip.rotation.y = Math.atan2(-a.dx, -a.dz) + Math.PI; this.strip.scale.set(e.r * 1.6, 1, a.len || 20);
                this.strip.material.opacity = 0.15 + 0.25 * (a.t / a.wind) + Math.sin(time * 30) * 0.05;
            }
            if (a.k === 'beam') {
                const m = { x: e.x + Math.sin(e.yaw) * e.r * 0.9, y: e.y + e.h * 0.72, z: e.z - Math.cos(e.yaw) * e.r * 0.9 };
                const dir = new V(Math.sin(a.ang), 0, -Math.cos(a.ang));
                // march the beam down to the ground so it sits on the terrain at range
                const end = new V(m.x + dir.x * a.range, 0, m.z + dir.z * a.range); end.y = this.world.h(end.x, end.z) + 0.4;
                const on = !!a.on, tele = a.t < 0.9;
                const bm = on ? this.beam : this.beam, len = new V(end.x - m.x, end.y - m.y, end.z - m.z).length();
                bm.visible = true; bm.position.set(m.x, m.y, m.z); bm.lookAt(end.x, end.y, end.z);
                const wd = on ? 0.55 + Math.sin(time * 40) * 0.1 : 0.04 + (a.t / 0.9) * 0.12;
                bm.scale.set(wd, wd, len); bm.material.opacity = on ? 0.9 : 0.5;
                if (on) {
                    this.beamCore.visible = true; this.beamCore.position.copy(bm.position); this.beamCore.quaternion.copy(bm.quaternion); this.beamCore.scale.set(wd * 0.45, wd * 0.45, len);
                    if (Math.random() < 0.9) this.fx.sparks(end.x, end.y, end.z, 3, 0xffa060, 8);
                    this.fx.glow.emit(m.x, m.y, m.z, 0, 0, 0, 0.2, 2.5, 0.3, 0xffd0a0, 0xff3000, 2.4, 0, 1, 0);
                    this.fx.shake = Math.max(this.fx.shake, 0.08);
                }
                void tele; void y;
            }
        }
    }

    drawPickups(G, time) {
        const o = this.o3, counts = { scrap: 0, hp: 0, fuel: 0, ammo: 0 };
        for (const k of G.pickups) {
            const m = this.pk[k.type]; if (!m || counts[k.type] >= 80) continue;
            o.position.set(k.x, k.y + 0.4 + Math.sin(time * 3 + k.id) * 0.15, k.z); o.rotation.set(0, time * 2 + k.id, k.type === 'scrap' ? 0.3 : 0); o.scale.setScalar(k.type === 'scrap' ? 0.9 + Math.min(0.6, k.val * 0.02) : 1); o.updateMatrix();
            m.setMatrixAt(counts[k.type]++, o.matrix);
            if (Math.random() < 0.04) this.fx.glow.emit(k.x, k.y + 0.5, k.z, 0, 1.2, 0, 0.7, 0.35, 0.05, k.type === 'scrap' ? 0xffc83a : k.type === 'hp' ? 0x4aff7a : k.type === 'fuel' ? 0xff8a2a : 0x5ab8ff, 0xffffff, 1.5, 0, 0.5, 0);
        }
        for (const t in counts) { this.pk[t].count = counts[t]; this.pk[t].instanceMatrix.needsUpdate = true; }
    }

    // ------------------------------------------------------------------ atmosphere
    ambient(G, dt, time) {
        const B = this.B, p = G.player, fx = this.fx;
        const stormTarget = G.storm > 0 ? 1 : 0;
        this.storm += (stormTarget - this.storm) * Math.min(1, dt * 1.5);
        this.skyMat.uniforms.storm.value = this.storm * 0.8;
        this.scene.fog.near = this.fogBase[0] * (1 - this.storm * 0.65); this.scene.fog.far = this.fogBase[1] * (1 - this.storm * 0.55);
        // drifting dust / snow / ash / spores near the camera
        const rate = (B.wind * 26 + this.storm * 160) * dt * fx.scale;
        let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
        const col = B.decor === 'ash' ? 0x6a5a50 : B.decor === 'snow' ? 0xffffff : B.decor === 'spore' ? 0xe080ff : B.decor === 'moss' ? 0xc8e8a0 : B.dust;
        const add = B.decor === 'spore' || B.decor === 'ash';
        while (n-- > 0) {
            const x = p.x + fx.r(-45, 45), z = p.z + fx.r(-60, 25), y = this.world.h(x, z) + fx.r(0.5, 16);
            const sys = add && Math.random() < 0.5 ? fx.glow : fx.smoke;
            const sc = B.decor === 'snow' ? 0.25 : 0.18;
            sys.emit(x, y, z, -(B.wind * 6 + this.storm * 22) * fx.r(0.5, 1.2), B.decor === 'snow' ? -fx.r(1, 2.6) : B.decor === 'ash' ? fx.r(0.2, 1.5) : fx.r(-0.3, 0.6), fx.r(-1, 1) * 2, fx.r(2, 4), sc, sc, col, col, add ? 0.7 : 0.75, 0, 0, 0);
        }
    }
    burners(G, dt) {
        const p = G.player, fx = this.fx;
        for (const b of this.lv.burners) {
            if (Math.abs(b.z - p.z) > 90 || Math.abs(b.x - p.x) > 70) continue;
            if (Math.random() < dt * 9) fx.smoke.emit(b.x + fx.r(-b.r, b.r) * 0.4, b.y, b.z + fx.r(-b.r, b.r) * 0.4, fx.r(-0.4, 0.4), fx.r(2, 4), fx.r(-0.4, 0.4), fx.r(2, 3.5), 0.8, 3.4, 0x201a18, 0x201a18, 0.55, 0, 0.5, -0.5);
            if (Math.random() < dt * 5) fx.glow.emit(b.x + fx.r(-1, 1), b.y, b.z + fx.r(-1, 1), 0, fx.r(1, 3), 0, fx.r(0.4, 0.9), 0.8, 0.1, 0xffb040, 0xff2000, 1.6, 0, 0.5, -1);
        }
    }
    fireworks(G, dt) {
        this.fwT = (this.fwT || 0) - dt;
        if (this.fwT > 0) return;
        this.fwT = 0.35;
        const p = G.player, fx = this.fx, cols = [0xff4a7a, 0x7aff9a, 0xffe05a, 0x6ac8ff, 0xd070ff];
        const x = p.x + fx.r(-30, 30), y = p.y + fx.r(22, 40), z = p.z + fx.r(-45, -10), c = cols[(Math.random() * cols.length) | 0];
        for (let i = 0; i < 50; i++) { const a = Math.random() * 6.28, e = Math.acos(Math.random() * 2 - 1), s = fx.r(10, 16); fx.glow.emit(x, y, z, Math.cos(a) * Math.sin(e) * s, Math.cos(e) * s, Math.sin(a) * Math.sin(e) * s, fx.r(1.4, 2.2), 0.9, 0.2, c, 0xffffff, 2.6, 0, 1.3, 7); }
        fx.light(x, y, z, c, 200, 0.4);
    }

    // ------------------------------------------------------------------ hangar
    enterHangar(on, G) {
        this.hangar = on;
        this.hangarGroup.visible = on;
        if (this.lv) this.lv.group.visible = !on;
        this.hSpot.visible = on; this.hRim.visible = on;
        this.hSpot.target.position.set(0, 2, 0);
        this.sky.visible = !on;
        this.scene.fog.near = on ? 60 : this.fogBase[0]; this.scene.fog.far = on ? 160 : this.fogBase[1];
        this.sun.visible = !on; this.hemi.intensity = on ? 0.35 : (this.B ? this.B.hemi[2] : 0.8);
        this.renderer.setClearColor(on ? 0x080a0e : this.B.fog);
        for (const m of this.models.values()) m.group.visible = !on;
        this.mechGroup.visible = true;
        this.mech.rig.placed = false; this.mech.pose = null;
        this.mechScale = G.st.scale * (on ? 0.96 : 1);
        this.hangarT = 0;
        if (!on) this.camSnap = true;
    }
    hangarFrame(G, dt, time) {
        this.pk.scrap.count = 0; this.pk.hp.count = 0; this.pk.fuel.count = 0; this.pk.ammo.count = 0;
        this.tracers.count = this.orbs.count = this.rockets.count = 0;
        for (const m of this.markPool) m.visible = false;
        if (Math.random() < dt * 4) { const a = Math.random() * 6.28; this.fx.sparks(Math.cos(a) * 8, 0.8, Math.sin(a) * 8, 3, 0xaee8ff, 5); }
        void time;
    }

    // ------------------------------------------------------------------ helpers for the UI
    /** Where the mouse points on the ground, in world units, or null. */
    groundPoint(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -(((clientY - r.top) / r.height) * 2 - 1);
        const ray = new THREE.Raycaster(); ray.setFromCamera({ x: nx, y: ny }, this.camera);
        const o = ray.ray.origin, d = ray.ray.direction;
        if (!this.world) return null;
        let prev = 0;
        for (let t = 2; t < 320; t += 1.5) {
            const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
            if (y < this.world.h(x, z)) {
                let lo = prev, hi = t;
                for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (o.y + d.y * m < this.world.h(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; }
                return { x: o.x + d.x * hi, y: o.y + d.y * hi, z: o.z + d.z * hi };
            }
            prev = t;
        }
        return null;
    }
    project(x, y, z) {
        const v = new V(x, y, z).project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
    }
}
const _v = new V();
