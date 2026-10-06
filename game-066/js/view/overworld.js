// The overworld: builds a 3D place from the same grid the simulation walks on, and keeps the
// player, the townsfolk and the lead COM-bot (which follows you everywhere) in sync with it.
// One tile = one unit; tile (x, y) has its centre at world (x + 0.5, 0, y + 0.5).

import * as THREE from 'three';
import { MAPS } from '../sim/data/maps.js';
import { LEADERS, CLASS_LOOK, LOOKS } from '../sim/data/story.js';
import { BY_NAME, SPECIES } from '../sim/dex.js';
import { biomeOf, makeSky, setSky, makeHorizon, BIOMES } from './sky.js';
import { metal, glow, tex, NOISE_GLSL, MAT, weather } from './materials.js';
import { JUNK, JUNKGEO, junkMaterial, junkSolid, junkColors, mastGeometry, buildBuilding, buildLandmark, buildFurniture, buildThing } from './props.js';
import { buildPerson } from './people.js';
import { buildBot } from './botgen.js';
import { FX } from './fx.js';

const DIR_ANGLE = { down: 0, up: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 };
const R = Math.random;
const isDigit = (c) => c >= '0' && c <= '9';
function hash2(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export class Overworld {
    constructor(renderer) {
        this.r = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
        this.sky = makeSky();
        this.scene.add(this.sky);
        this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0.8);
        this.sun = new THREE.DirectionalLight('#ffffff', 2.4);
        this.sun.castShadow = true;
        const sc = this.sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.02;
        this.scene.add(this.hemi, this.sun, this.sun.target);
        this.lights = [];
        for (let i = 0; i < 6; i++) { const l = new THREE.PointLight('#ffcc88', 0, 7, 1.6); this.scene.add(l); this.lights.push(l); }
        this.fx = new FX(this.scene);
        this.lantern = new THREE.PointLight('#ffd8a0', 0, 10, 1.4);
        this.scene.add(this.lantern);
        this.pmrem = new THREE.PMREMGenerator(renderer.gl);
        this.envCache = {};
        this.group = null;
        this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
        this.time = 0;
        this.marks = new Map();
        this.lastLead = null;
        this.follower = null;
        this.trail = [];
        this.zoom = 1;
    }

    envFor(name, B) {
        if (this.envCache[name]) return this.envCache[name];
        const s = new THREE.Scene();
        const sky = makeSky();
        setSky(sky, B.interior ? BIOMES.boiler : B);
        s.add(sky);
        const rt = this.pmrem.fromScene(s, 0.02);
        this.envCache[name] = rt.texture;
        return rt.texture;
    }

    // ================================================================== build a map
    load(world, game) {
        if (this.group) { this.scene.remove(this.group); disposeGroup(this.group); }
        this.fx.clear();
        this.world = world;
        const map = world.map;
        const B = biomeOf(map);
        this.B = B;
        this.indoor = !!B.interior;
        const g = new THREE.Group();
        this.group = g;
        this.scene.add(g);
        this.emitters = [];
        this.lightSpots = [];
        this.removable = new Map();
        this.spinners = [];
        this.entViews = new Map();
        this.marks.clear();

        // Sky, fog, light.
        this.sky.visible = !this.indoor;
        this.scene.background = this.indoor ? new THREE.Color(B.fog) : null;
        if (!this.indoor) setSky(this.sky, B);
        this.scene.fog = new THREE.FogExp2(B.fog, this.indoor ? (B.fogD || 0.0) * 0.3 : B.fogD);
        this.scene.environment = this.envFor(map.biome || 'interior', B);
        this.scene.environmentIntensity = this.indoor ? 0.35 : 0.8;
        this.hemi.color.set(B.hemi[0]); this.hemi.groundColor.set(B.hemi[1]); this.hemi.intensity = B.hemi[2] * 1.15;
        this.sun.visible = !this.indoor || map.kind === 'interior';
        this.sun.color.set(this.indoor ? '#ffe0c0' : B.sun);
        this.sun.intensity = this.indoor ? (map.kind === 'interior' ? 0.9 : 0.25) : B.sunI;
        this.sunDir = new THREE.Vector3(...(B.sunDir || [0.4, 0.8, 0.3])).normalize();
        if (this.indoor) this.sunDir.set(0.3, 1, 0.5).normalize();
        this.lantern.intensity = map.dark ? 4.5 : 0;
        this.lantern.color.set(B.light || '#ffd8a0');
        this.r.grade.uniforms.uHaze.value = map.biome === 'boiler' || map.biome === 'cave' ? 0.6 : 0;

        // Ground under the map and around it.
        this.buildGround(g, map, world, B);
        if (!this.indoor) {
            const outer = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), weather(new THREE.MeshStandardMaterial({ color: B.ground2, roughness: 1 }), { rust: 0.3, patina: new THREE.Color(B.ground), scale: 0.15, streak: 0 }));
            outer.rotation.x = -Math.PI / 2; outer.position.set(map.W / 2, -0.02, map.H / 2); outer.receiveShadow = true;
            g.add(outer);
            const hz = makeHorizon(B.junk || '#3a2a20'); hz.position.set(map.W / 2, 0, map.H / 2); g.add(hz);
        }
        this.buildTiles(g, map, world, B);
        this.buildEnts(g, world, game);
        this.buildPlayer(g, game);
        this.snapCamera();
        this.ambientT = 0;
    }

    buildGround(g, map, world, B) {
        const S = 32, W = map.W, H = map.H;
        const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
        const x2 = c.getContext('2d');
        const style = map.style || '';
        const floorKind = /house|shop|workshop|shack/.test(style) ? 'planks' : 'plate';
        x2.fillStyle = B.ground; x2.fillRect(0, 0, c.width, c.height);
        if (!this.indoor || map.kind === 'dungeon') {
            for (let i = 0; i < W * H * 2; i++) { x2.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`; x2.beginPath(); x2.ellipse(R() * c.width, R() * c.height, 4 + R() * 26, 3 + R() * 16, R() * 3, 0, 7); x2.fill(); }
            for (let i = 0; i < W * H * 3; i++) { x2.fillStyle = B.ground2; x2.globalAlpha = 0.25; x2.beginPath(); x2.arc(R() * c.width, R() * c.height, 2 + R() * 10, 0, 7); x2.fill(); }
            x2.globalAlpha = 1;
            for (let i = 0; i < W * H * 10; i++) { x2.fillStyle = R() < 0.5 ? 'rgba(255,240,220,0.12)' : 'rgba(30,20,10,0.18)'; x2.fillRect(R() * c.width, R() * c.height, 1 + R() * 2, 1 + R() * 2); }
        }
        const floorTex = tex(floorKind);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const ch = world.grid[y][x];
            const px = x * S, py = y * S;
            const r = hash2(x, y);
            if (ch === ',' || (isDigit(ch) && !this.indoor && (x === 0 || y === 0 || x === W - 1 || y === H - 1))) {
                x2.fillStyle = B.road; x2.fillRect(px - 2, py - 2, S + 4, S + 4);
                for (let i = 0; i < 7; i++) { const v = 0.8 + R() * 0.35; x2.fillStyle = shade(B.road, v); x2.beginPath(); x2.ellipse(px + 3 + R() * (S - 6), py + 3 + R() * (S - 6), 3 + R() * 4, 2.5 + R() * 3, R() * 3, 0, 7); x2.fill(); }
                x2.fillStyle = 'rgba(0,0,0,0.08)'; x2.fillRect(px, py + S - 2, S, 2);
            } else if (ch === '_' || (this.indoor && map.kind !== 'dungeon' && ch !== '=')) {
                if (floorTex && floorTex.image) x2.drawImage(floorTex.image, (x % 4) * 64, (y % 4) * 64, 64, 64, px, py, S, S);
                if (ch === '_' && !this.indoor) { x2.strokeStyle = 'rgba(0,0,0,0.4)'; x2.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1); }
            } else if (ch === '"') {
                const gr = x2.createRadialGradient(px + S / 2, py + S / 2, 2, px + S / 2, py + S / 2, S * 0.75);
                gr.addColorStop(0, 'rgba(25,15,8,0.28)'); gr.addColorStop(1, 'rgba(25,15,8,0)');
                x2.fillStyle = gr; x2.fillRect(px - S / 2, py - S / 2, S * 2, S * 2);
            } else if (ch === '*') {
                for (let i = 0; i < 7; i++) { x2.fillStyle = R() < 0.5 ? 'rgba(70,110,50,0.55)' : 'rgba(110,140,60,0.4)'; x2.beginPath(); x2.arc(px + R() * S, py + R() * S, 3 + R() * 6, 0, 7); x2.fill(); }
            } else if (ch === '~') {
                x2.fillStyle = shade(B.sludge || '#2a3a2a', 0.5); x2.fillRect(px, py, S, S);
            }
            if (map.kind === 'dungeon' && (ch === '_' || isDigit(ch) || ch === '"')) {
                if (floorTex && floorTex.image) { x2.globalAlpha = ch === '"' ? 0.5 : 1; x2.drawImage(floorTex.image, (x % 4) * 64, (y % 4) * 64, 64, 64, px, py, S, S); x2.globalAlpha = 1; }
            }
        }
        // Rugs in houses.
        if (/house|shack|workshop/.test(style)) { x2.fillStyle = '#7a2a1a'; x2.fillRect(W * S * 0.3, H * S * 0.35, W * S * 0.4, H * S * 0.3); x2.strokeStyle = '#c8902a'; x2.lineWidth = 4; x2.strokeRect(W * S * 0.3 + 6, H * S * 0.35 + 6, W * S * 0.4 - 12, H * S * 0.3 - 12); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.perMap = true;
        const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: this.indoor && map.kind !== 'dungeon' ? 0.05 : 0.1 });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
        plane.rotation.x = -Math.PI / 2; plane.position.set(W / 2, 0, H / 2); plane.receiveShadow = true;
        g.add(plane);
    }

    buildTiles(g, map, world, B) {
        const W = map.W, H = map.H;
        const junk = {};
        const kinds = Object.keys(JUNK).filter((k) => k !== 'mound');
        const addJunk = (k, x, z, ry, s, color, sink = 0) => { (junk[k] ||= []).push({ x, z, ry, s, color, sink }); };
        const jc = junkColors();
        const drifts = [], masts = [], sludge = [];
        const style = map.style || (map.kind === 'dungeon' ? 'dungeon' : 'outdoor');
        const wallH = map.kind === 'interior' ? 1.5 : 1.7;
        const walls = [];
        const pileTile = (x, y, scale = 1, outside = false) => {
            const h = hash2(x, y, 7);
            addJunk('mound', x + 0.5, y + 0.5, h * 6, (0.85 + h * 0.5) * scale, B.junk || '#4a3a2e');
            const n = outside ? 1 : 2 + Math.floor(h * 2);
            for (let i = 0; i < n; i++) {
                const hh = hash2(x, y, i + 11);
                addJunk(kinds[Math.floor(hh * kinds.length)], x + 0.2 + hash2(x, y, i + 31) * 0.6, y + 0.2 + hash2(x, y, i + 41) * 0.6, hh * 7, (0.7 + hh * 0.5) * scale, jc[Math.floor(hash2(x, y, i + 51) * jc.length)], 0.15 + hh * 0.3);
            }
        };
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const c = world.grid[y][x];
            const raw = map.rows[y][x];
            switch (c) {
                case '#': pileTile(x, y); break;
                case 'T': masts.push([x + 0.5, y + 0.5, hash2(x, y) * 6]); break;
                case '"': drifts.push([x, y]); break;
                case '~': sludge.push([x, y]); break;
                case '^': { const l = buildThing('ledge', { metal: B.interior ? 'iron' : 'rust' }); l.position.set(x + 0.5, 0, y); g.add(l); break; }
                case 'X': { const f = buildThing('fence'); f.position.set(x + 0.5, 0, y + 0.5); g.add(f); this.removable.set(`${x},${y}`, f); break; }
                case 'O': { const f = buildThing('block'); f.position.set(x + 0.5, 0, y + 0.5); g.add(f); this.removable.set(`${x},${y}`, f); break; }
                case '+': { const l = buildThing('lamp'); l.position.set(x + 0.5, 0, y + 0.5); g.add(l); this.lightSpots.push({ p: new THREE.Vector3(x + 0.5, 2.3, y + 0.5), color: '#ffc870', i: 2.2 }); break; }
                case '%': { const k = buildThing('counter'); k.position.set(x + 0.5, 0, y + 0.5); g.add(k); break; }
                case 'K': {
                    const f = buildFurniture(this.indoor ? style : 'dungeon', Math.floor(hash2(x, y) * 1e6));
                    f.position.set(x + 0.5, 0, y + 0.5);
                    if (y === 0 || world.grid[y - 1] && world.grid[y - 1][x] === '=') f.rotation.y = 0; else f.rotation.y = hash2(x, y, 3) > 0.5 ? Math.PI : 0;
                    g.add(f);
                    this.collect(f, g);
                    break;
                }
                case '=': walls.push([x, y]); break;
            }
            if (isDigit(raw)) {
                const above = y > 0 ? world.grid[y - 1][x] : null;
                if (this.indoor && y === H - 1) { const m = buildThing('mat'); m.position.set(x + 0.5, 0, y + 0.5); g.add(m); }
                else if (above && above !== 'B' && (above === 'K' || above === '#' || above === '=')) { const d = buildThing('doorframe', { color: B.light || '#ffcc6a' }); d.position.set(x + 0.5, 0, y + 0.5); g.add(d); }
            }
        }
        // Junk piles around the outside of outdoor maps, so the world doesn't end at a line.
        if (!this.indoor) {
            for (let y = -7; y < H + 7; y++) for (let x = -7; x < W + 7; x++) {
                if (x >= 0 && y >= 0 && x < W && y < H) continue;
                const d = Math.max(-x, -y, x - W + 1, y - H + 1);
                if (hash2(x, y, 99) < 0.75 - d * 0.06) pileTile(x, y, 1 + d * 0.12, true);
            }
        }
        // Instanced junk.
        const jm = junkMaterial();
        for (const [k, list] of Object.entries(junk)) {
            const geo = JUNKGEO(k);
            const im = new THREE.InstancedMesh(geo, k === 'mound' ? junkMoundMat(B) : jm, list.length);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
            list.forEach((o, i) => {
                e.set(k === 'mound' ? 0 : (hash2(i, 3) - 0.5) * 0.6, o.ry, k === 'mound' ? 0 : (hash2(i, 5) - 0.5) * 0.6);
                q.setFromEuler(e);
                const sy = k === 'mound' ? o.s * (0.9 + hash2(i, 9) * 0.6) : o.s;
                m4.compose(new THREE.Vector3(o.x, k === 'mound' ? 0 : 0.25 + o.sink * 0.4, o.z), q, new THREE.Vector3(o.s, sy, o.s));
                im.setMatrixAt(i, m4);
                im.setColorAt(i, col.set(o.color).multiplyScalar(0.75 + hash2(i, 13) * 0.5));
            });
            im.castShadow = true; im.receiveShadow = true;
            g.add(im);
        }
        // Masts.
        if (masts.length) {
            const im = new THREE.InstancedMesh(mastGeometry(), metal('iron', { rustScale: 2 }), masts.length);
            const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), glow('#ff3a2a', 3), masts.length);
            const m4 = new THREE.Matrix4();
            masts.forEach(([x, z, r], i) => { m4.makeRotationY(r); m4.setPosition(x, 0, z); im.setMatrixAt(i, m4); m4.makeTranslation(x, 3.85, z); lamps.setMatrixAt(i, m4); });
            im.castShadow = true;
            g.add(im, lamps);
            this.mastLamps = lamps;
        } else this.mastLamps = null;
        // Walls.
        if (walls.length) {
            const outdoor = !this.indoor;
            if (outdoor) {
                const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), metal('iron'), walls.length);
                const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), metal('brass'), walls.length * 2);
                const m4 = new THREE.Matrix4();
                walls.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, 0.5, y + 0.5); posts.setMatrixAt(i, m4); m4.makeTranslation(x + 0.5, 0.85, y + 0.5); rails.setMatrixAt(i * 2, m4); m4.makeTranslation(x + 0.5, 0.45, y + 0.5); rails.setMatrixAt(i * 2 + 1, m4); });
                posts.castShadow = rails.castShadow = true;
                g.add(posts, rails);
            } else {
                const wm = wallMaterial(style, map.kind);
                const geo = new THREE.BoxGeometry(1, wallH, 1);
                const im = new THREE.InstancedMesh(geo, wm, walls.length);
                const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 0.1, 1.02), metal(map.kind === 'dungeon' ? 'gunmetal' : 'brass'), walls.length);
                const m4 = new THREE.Matrix4();
                walls.forEach(([x, y], i) => {
                    // Walls along the bottom edge are low, so the camera sees into the room.
                    const low = y === H - 1;
                    const h = low ? 0.45 : wallH;
                    m4.compose(new THREE.Vector3(x + 0.5, h / 2, y + 0.5), new THREE.Quaternion(), new THREE.Vector3(1, h / wallH, 1));
                    im.setMatrixAt(i, m4);
                    m4.makeTranslation(x + 0.5, h, y + 0.5); trim.setMatrixAt(i, m4);
                });
                im.castShadow = true; im.receiveShadow = true;
                g.add(im, trim);
                // Wall lamps on the back wall.
                for (let x = 2; x < W - 1; x += 4) if (world.grid[0][x] === '=' && world.grid[1] && world.grid[1][x] !== '=') {
                    const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(B.light || '#ffcc6a', 3)); l.position.set(x + 0.5, 1.2, 1.02); g.add(l);
                    this.lightSpots.push({ p: new THREE.Vector3(x + 0.5, 1.3, 1.4), color: B.light || '#ffcc6a', i: map.kind === 'dungeon' ? 2.6 : 1.8 });
                }
            }
        }
        if (this.indoor) {
            // Ambient light sources so rooms are never pitch black.
            for (let y = 2; y < H; y += 4) for (let x = 2; x < W; x += 5) this.lightSpots.push({ p: new THREE.Vector3(x + 0.5, 2.2, y + 0.5), color: B.light || '#ffcc88', i: map.kind === 'dungeon' ? 1.6 : 1.3, soft: true });
        }
        // Drifts: wire-weed.
        if (drifts.length) this.buildDrifts(g, drifts, B, map);
        if (sludge.length) this.buildSludge(g, sludge, map, B);
        // Buildings.
        this.buildBuildings(g, map, world, B);
        // Landmarks.
        for (const d of map.deco || []) {
            if (d.k === 'skyrail') { this.buildSkyrail(g, map); continue; }
            const lm = buildLandmark(d.k, B);
            lm.position.set(d.x + 0.5, 0, d.y + 0.5);
            lm.rotation.y = hash2(d.x, d.y) * 0.6 - 0.3;
            if (d.k === 'airship') lm.position.y = 2;
            g.add(lm);
            this.collect(lm, g);
        }
    }

    buildSkyrail(g, map) {
        const rail = new THREE.Group();
        for (let x = -4; x < map.W + 4; x += 4) {
            rail.add(meshAt(new THREE.CylinderGeometry(0.2, 0.3, 5, 8), metal('iron'), x, 2.5, -2.5));
            const arch = meshAt(new THREE.TorusGeometry(2, 0.12, 6, 16, Math.PI), metal('brass'), x + 2, 5, -2.5); rail.add(arch);
        }
        rail.add(meshAt(new THREE.BoxGeometry(map.W + 12, 0.25, 0.8), metal('gunmetal'), map.W / 2, 5.1, -2.5));
        g.add(rail);
    }

    collect(obj, g) {
        obj.traverse((o) => {
            if (o.userData.emitters) for (const e of o.userData.emitters) this.emitters.push({ obj: o, ...e, acc: R() });
            if (o.userData.light) this.lightSpots.push({ obj: o, p: new THREE.Vector3(), color: o.userData.light, i: 2 });
            if (o.userData.gear || o.userData.spin || o.userData.prop || o.userData.needle || o.userData.float) this.spinners.push(o);
        });
        void g;
    }

    buildDrifts(g, drifts, B, map) {
        const per = 10;
        const blade = new THREE.PlaneGeometry(0.05, 0.55, 1, 4);
        blade.translate(0, 0.275, 0);
        const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.65, roughness: 0.45, side: THREE.DoubleSide });
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = this.driftTime = { value: 0 };
            sh.uniforms.uPlayer = this.driftPlayer = { value: new THREE.Vector3() };
            sh.vertexShader = 'uniform float uTime;\nuniform vec3 uPlayer;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
                vec3 ip = vec3(instanceMatrix[3]);
                float hgt = transformed.y;
                float ph = ip.x * 1.7 + ip.z * 2.3;
                float sway = sin(uTime * 1.8 + ph) * 0.12 + sin(uTime * 3.7 + ph * 1.3) * 0.04;
                vec2 away = ip.xz - uPlayer.xz;
                float dd = length(away);
                vec2 push = dd < 1.2 ? normalize(away + 0.0001) * (1.2 - dd) * 0.6 : vec2(0.0);
                transformed.x += (sway + push.x) * hgt * hgt * 3.0;
                transformed.z += push.y * hgt * hgt * 3.0;`);
        };
        mat.customProgramCacheKey = () => 'drift';
        const im = new THREE.InstancedMesh(blade, mat, drifts.length * per);
        const bits = new THREE.InstancedMesh(JUNKGEO('gear'), metal('brass', { rustScale: 2 }), drifts.length * 2);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
        let n = 0, nb = 0;
        for (const [x, y] of drifts) {
            for (let i = 0; i < per; i++) {
                const h1 = hash2(x, y, i), h2 = hash2(x, y, i + 50), h3 = hash2(x, y, i + 90);
                e.set((h3 - 0.5) * 0.5, h1 * 6.28, (h2 - 0.5) * 0.5);
                q.setFromEuler(e);
                m4.compose(new THREE.Vector3(x + 0.1 + h1 * 0.8, 0, y + 0.1 + h2 * 0.8), q, new THREE.Vector3(1, 0.6 + h3 * 0.8, 1));
                im.setMatrixAt(n, m4);
                im.setColorAt(n, col.set(B.drift[Math.floor(h3 * B.drift.length)]).multiplyScalar(0.7 + h2 * 0.6));
                n++;
            }
            for (let i = 0; i < 2; i++) {
                const h1 = hash2(x, y, i + 200), h2 = hash2(x, y, i + 300);
                e.set(-1.2 + h1, h1 * 6, 0); q.setFromEuler(e);
                m4.compose(new THREE.Vector3(x + 0.15 + h1 * 0.7, 0.02, y + 0.15 + h2 * 0.7), q, new THREE.Vector3(0.18, 0.18, 0.18));
                bits.setMatrixAt(nb++, m4);
            }
        }
        im.castShadow = false; im.receiveShadow = true;
        g.add(im, bits);
    }

    buildSludge(g, tiles, map, B) {
        const W = map.W, H = map.H;
        const data = new Uint8Array(W * H * 4);
        for (const [x, y] of tiles) data[(y * W + x) * 4] = 255;
        const mask = new THREE.DataTexture(data, W, H);
        mask.magFilter = THREE.LinearFilter; mask.minFilter = THREE.LinearFilter; mask.flipY = false; mask.needsUpdate = true;
        const geo = new THREE.PlaneGeometry(W, H, W, H);
        const frozen = map.biome === 'frost';
        const mat = new THREE.MeshStandardMaterial({ color: B.sludge || '#3a5a2a', roughness: frozen ? 0.25 : 0.12, metalness: 0.2, transparent: true });
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = this.sludgeTime = { value: 0 };
            sh.uniforms.uMask = { value: mask };
            sh.uniforms.uSize = { value: new THREE.Vector2(W, H) };
            sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            sh.fragmentShader = 'uniform float uTime;\nuniform sampler2D uMask;\nuniform vec2 uSize;\nvarying vec3 vWp;\n' + NOISE_GLSL + sh.fragmentShader
                .replace('#include <color_fragment>', `#include <color_fragment>
                    vec2 muv = vWp.xz / uSize;
                    float m = texture2D(uMask, muv).r;
                    if (m < 0.08) discard;
                    vec3 p = vec3(vWp.xz * 0.9, uTime * 0.12);
                    float sw = swFbm(p + vec3(swFbm(p + uTime * 0.05) * 1.5));
                    vec3 film = 0.5 + 0.5 * cos(6.2831 * (sw * 1.6 + vec3(0.0, 0.33, 0.67)));
                    diffuseColor.rgb = mix(diffuseColor.rgb * (0.55 + 0.6 * sw), film * 0.55, ${frozen ? '0.08' : '0.22'} * smoothstep(0.45, 0.8, sw));
                    float bub = smoothstep(0.93, 0.98, swNoise(vec3(vWp.xz * 4.0, uTime * 0.8)));
                    float foam = smoothstep(0.75, 0.35, m);
                    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.9, 0.7), clamp(foam * 0.7 + bub * 0.5, 0.0, 1.0));
                    diffuseColor.a = smoothstep(0.08, 0.3, m);`)
                .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                    totalEmissiveRadiance += diffuseColor.rgb * ${map.biome === 'toxic' || map.biome === 'sludge' ? '0.25' : '0.06'};`);
        };
        mat.customProgramCacheKey = () => `sludge${frozen}${map.biome}`;
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2; m.position.set(W / 2, 0.04, H / 2); m.receiveShadow = true;
        g.add(m);
        this.sludgeTiles = tiles;
    }

    buildBuildings(g, map, world, B) {
        const W = map.W, H = map.H;
        const seen = new Set();
        let bi = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (map.rows[y][x] !== 'B' || seen.has(`${x},${y}`)) continue;
            // Flood the footprint (B cells plus doors directly below B).
            const cells = []; const q = [[x, y]]; seen.add(`${x},${y}`);
            while (q.length) {
                const [cx, cy] = q.pop(); cells.push([cx, cy]);
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = cx + dx, ny = cy + dy, k = `${nx},${ny}`;
                    if (seen.has(k) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    const c = map.rows[ny][nx];
                    if (c === 'B' || (isDigit(c) && ny > 0 && map.rows[ny - 1][nx] === 'B')) { seen.add(k); q.push([nx, ny]); }
                }
            }
            const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
            const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
            const door = cells.find(([cx, cy]) => isDigit(map.rows[cy][cx]));
            const style = (map.bld && map.bld[bi]) || 'house';
            bi++;
            const opts = {};
            if (door) {
                const tgt = map.w[map.rows[door[1]][door[0]]];
                const tm = tgt && MAPS[tgt[0]];
                if (tm && tm.ents.l && tm.ents.l.leader) { const L = LEADERS[tm.ents.l.leader]; opts.leader = L.name; opts.type = L.type; }
                if (tm && style === 'house') opts.label = tm.name.replace(/'s House$/, '').slice(0, 18);
            }
            const b = buildBuilding(style, x1 - x0 + 1, y1 - y0 + 1, door ? door[0] - x0 : Math.floor((x1 - x0) / 2), opts);
            b.position.set(x0, 0, y0);
            g.add(b);
            this.collect(b, g);
            for (const e of b.userData.emitters) this.emitters.push({ obj: b, pos: e.pos, kind: e.kind, rate: e.rate, acc: R() });
            if (b.userData.gear) this.spinners.push(b.userData.gear);
            if (b.userData.needle) this.spinners.push(b.userData.needle);
            for (let wx = x0 + 1; wx <= x1; wx += 2) this.lightSpots.push({ p: new THREE.Vector3(wx, 1.4, y1 + 1.6), color: '#ffcc6a', i: 1.1, soft: true });
        }
    }

    // ------------------------------------------------------------------ entities
    buildEnts(g, world, game) {
        for (const e of world.ents) {
            const d = e.def;
            if (d.k === 'trigger') continue;
            let obj, person = null, bot = null;
            switch (d.k) {
                case 'sign': case 'item': case 'heap': case 'locker': case 'bench': obj = buildThing(d.k); break;
                case 'wreck': {
                    const S = BY_NAME[d.sp.toLowerCase()];
                    bot = buildBot(S.id);
                    darken(bot.root);
                    bot.root.rotation.z = 0.35; bot.root.rotation.x = -0.2; bot.root.position.y = -0.1;
                    obj = new THREE.Group(); obj.add(bot.root);
                    obj.add(meshAt(JUNKGEO('mound'), junkSolid('#5a4030'), 0, 0, 0.1));
                    obj.children[1].scale.set(0.9, 0.5, 0.9);
                    obj.userData.sparkle = '#8ad8ff'; obj.userData.wreck = true;
                    break;
                }
                case 'titan': {
                    const S = BY_NAME[d.sp.toLowerCase()];
                    bot = buildBot(S.id);
                    bot.root.scale.multiplyScalar(1.15);
                    obj = new THREE.Group(); obj.add(bot.root);
                    obj.userData.titan = true;
                    this.lightSpots.push({ obj, p: new THREE.Vector3(), color: '#ffffff', i: 3 });
                    break;
                }
                default: {
                    const look = d.look === 'capsule' ? 'capsule' : d.look || (d.k === 'trainer' ? CLASS_LOOK[d.cls] || 'rand' : d.k === 'marshal' ? 'captain' : 'rand');
                    person = buildPerson(look, e.key, d.look === 'capsule' ? { capsule: d.capsule } : d.k === 'marshal' ? { coatColor: '#2a3a6a', hat: 'captain' } : null);
                    obj = person.root;
                }
            }
            obj.position.set(e.px + 0.5, 0, e.py + 0.5);
            obj.rotation.y = DIR_ANGLE[e.dir] || 0;
            obj.visible = e.visible;
            g.add(obj);
            this.collect(obj, g);
            this.entViews.set(e.key, { obj, person, bot, ent: e });
        }
        void game;
    }

    buildPlayer(g, game) {
        const look = { ...LOOKS.player, ...(game.state.look || {}) };
        this.player = buildPerson(look, 'player');
        g.add(this.player.root);
        this.skiff = buildThing('skiff');
        this.skiff.visible = false;
        g.add(this.skiff);
        this.follower = null;
        this.lastLead = null;
        const p = this.world.player;
        const back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[p.dir] || [0, 1];
        const bx = p.x + back[0], by = p.y + back[1];
        const ok = this.world.tile(bx, by) && !'#TB=K%+'.includes(this.world.tile(bx, by));
        this.trail = ok ? [[bx, by], [p.x, p.y]] : [[p.x, p.y], [p.x, p.y]];
        this.refreshFollower(game);
    }

    refreshFollower(game) {
        const lead = game.state.party.find((u) => u.hp > 0) || game.state.party[0];
        const key = lead ? `${lead.sp}|${lead.gilded}` : null;
        if (key === this.lastLead) return;
        this.lastLead = key;
        if (this.follower) this.group.remove(this.follower.root);
        this.follower = null;
        if (!lead) return;
        this.follower = buildBot(lead.sp, { gilded: lead.gilded });
        const s = 0.95 / Math.max(0.9, this.follower.height);
        this.follower.root.scale.multiplyScalar(Math.min(1, s * 1.0));
        const p = this.world.player;
        this.follower.root.position.set(p.px + 0.5, 0, p.py + 0.5);
        this.group.add(this.follower.root);
        this.followPos = this.follower.root.position.clone();
    }

    // ================================================================== per frame
    snapCamera() {
        const p = this.world.player;
        this.target = new THREE.Vector3(p.px + 0.5, 0, p.py + 0.5);
        this.camLook.copy(this.target);
        this.camPos.copy(this.target).add(this.camOffset());
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.camLook.x, 0.6, this.camLook.z - 0.4);
    }
    camOffset() {
        const k = this.world.map.kind;
        const z = this.zoom;
        if (k === 'interior') return new THREE.Vector3(0, 8.0 * z, 7.4 * z);
        if (k === 'dungeon') return new THREE.Vector3(0, 9.6 * z, 8.4 * z);
        return new THREE.Vector3(0, 10.8 * z, 11.2 * z);
    }

    update(dt, game) {
        const w = this.world;
        if (!w) return;
        this.time += dt;
        const t = this.time;
        const p = w.player;
        // Player.
        const moving = !!p.move;
        let hop = 0;
        if (p.move && p.move.hop) { const k = p.move.t / p.move.dur; hop = Math.sin(k * Math.PI) * 0.7; }
        const pr = this.player.root;
        pr.position.set(p.px + 0.5, hop + (p.skiff ? 0.25 : 0), p.py + 0.5);
        pr.rotation.y = lerpAngle(pr.rotation.y, DIR_ANGLE[p.dir], Math.min(1, dt * 16));
        this.player.update(dt, moving && !p.skiff, p.run);
        this.skiff.visible = p.skiff;
        if (p.skiff) {
            this.skiff.position.set(pr.position.x, 0.05 + Math.sin(t * 3) * 0.03, pr.position.z);
            this.skiff.rotation.y = pr.rotation.y;
            if (this.skiff.userData.fan) this.skiff.userData.fan.rotation.z += dt * 30;
            if (moving && R() < 0.5) this.fx.emit('bubble', pr.position.x, 0.08, pr.position.z, { color: '#c8e88a', force: true });
        }
        // Trail for the follower.
        const last = this.trail[this.trail.length - 1];
        if (last[0] !== p.x || last[1] !== p.y) { this.trail.push([p.x, p.y]); if (this.trail.length > 4) this.trail.shift(); }
        this.refreshFollower(game);
        if (this.follower) {
            const tgt = this.trail.length >= 2 ? this.trail[this.trail.length - 2] : this.trail[0];
            const fr = this.follower.root;
            const goal = new THREE.Vector3(tgt[0] + 0.5, 0, tgt[1] + 0.5);
            if (p.move) { const k = p.move.t / p.move.dur; goal.lerpVectors(new THREE.Vector3(this.trail[Math.max(0, this.trail.length - 3)][0] + 0.5, 0, this.trail[Math.max(0, this.trail.length - 3)][1] + 0.5), goal, k); }
            const dist = fr.position.distanceTo(goal);
            if (dist > 4) fr.position.copy(goal);
            else fr.position.lerp(goal, Math.min(1, dt * 10));
            const dx = pr.position.x - fr.position.x, dz = pr.position.z - fr.position.z;
            if (dx * dx + dz * dz > 0.05) fr.rotation.y = lerpAngle(fr.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8));
            fr.visible = !p.skiff || true;
            if (p.skiff) fr.position.y = 0.25 + Math.sin(t * 3 + 1) * 0.04; else fr.position.y = 0;
            this.follower.update(dt, t, { moving: dist > 0.08 });
            this.botEmitters(this.follower, dt);
        }
        // Entities.
        for (const v of this.entViews.values()) {
            const e = v.ent;
            v.obj.visible = e.visible;
            if (!e.visible) continue;
            v.obj.position.x = e.px + 0.5; v.obj.position.z = e.py + 0.5;
            if (v.person) { v.obj.rotation.y = lerpAngle(v.obj.rotation.y, DIR_ANGLE[e.dir] || 0, Math.min(1, dt * 10)); v.person.update(dt, !!e.move); }
            if (v.bot) {
                if (v.obj.userData.wreck) { if (R() < dt * 0.8) this.fx.emit('spark', v.obj.position.x, 0.5, v.obj.position.z, { force: true, n: 4, color: '#8ad8ff' }); }
                else { v.bot.update(dt, t); this.botEmitters(v.bot, dt); if (R() < dt * 6) this.fx.emit('mote', v.obj.position.x + (R() - 0.5) * 2, 0.3 + R() * 2, v.obj.position.z + (R() - 0.5) * 2, { color: '#ffffff', force: true }); }
            }
            const sp = v.obj.userData.sparkle;
            if (sp && R() < dt * 3) this.fx.emit('mote', v.obj.position.x + (R() - 0.5) * 0.5, 0.3 + R() * 0.4, v.obj.position.z + (R() - 0.5) * 0.5, { color: sp, force: true });
            if (v.obj.userData.bob) v.obj.userData.bob.position.y = 0.2 + Math.sin(t * 3 + e.x) * 0.05;
        }
        // Removed fences and blocks.
        for (const [k, obj] of this.removable) {
            const [x, y] = k.split(',').map(Number);
            if (w.grid[y][x] !== 'X' && w.grid[y][x] !== 'O' && obj.visible) {
                obj.visible = false;
                for (let i = 0; i < 20; i++) this.fx.emit(w.map.rows[y][x] === 'X' ? 'spark' : 'puff', x + 0.5, 0.6, y + 0.5, { force: true, color: '#ffd080' });
            }
        }
        // Animated bits.
        for (const s of this.spinners) {
            if (s.userData.float) s.position.y = 2 + Math.sin(t * 0.5) * 0.3;
            else if (s.userData.prop) s.userData.prop.rotation.x += dt * 12;
            else if (s.userData.spin) s.userData.spin.rotation.y += dt;
            else if (s.geometry && s.geometry.type === 'BoxGeometry') s.rotation.z = Math.sin(t * 0.7) * 0.6 - 0.3;   // gauge needle
            else s.rotation.z += dt * 0.4;
        }
        if (this.mastLamps) this.mastLamps.visible = Math.sin(t * 3) > -0.2;
        // Shader time.
        if (this.driftTime) { this.driftTime.value = t; this.driftPlayer.value.set(pr.position.x, 0, pr.position.z); }
        if (this.sludgeTime) this.sludgeTime.value = t;
        if (this.sludgeTiles && R() < dt * 4) { const [sx, sy] = this.sludgeTiles[Math.floor(R() * this.sludgeTiles.length)]; this.fx.emit('bubble', sx + R(), 0.06, sy + R(), { color: this.B.sludge, force: true }); }
        // Emitters.
        for (const e of this.emitters) {
            e.acc += dt * e.rate;
            if (e.acc < 1) continue;
            e.acc -= 1;
            const wp = e.pos ? e.obj.localToWorld(e.pos.clone()) : e.obj.getWorldPosition(new THREE.Vector3());
            if (e.bolt && R() < 0.3) this.fx.bolt(wp, wp.clone().add(new THREE.Vector3((R() - 0.5) * 4, -R() * 3, (R() - 0.5) * 4)), e.color || '#8ad8ff', 0.2);
            this.fx.emit(e.kind, wp.x, wp.y, wp.z, { color: e.color });
        }
        // Ambient particles around the player.
        this.ambientT += dt;
        const amb = this.B.ambient;
        if (amb && amb !== 'none') {
            const rate = amb === 'snow' ? 40 : amb === 'dust' ? 6 : amb === 'ash' ? 14 : 6;
            while (this.ambientT > 1 / rate) {
                this.ambientT -= 1 / rate;
                const x = pr.position.x + (R() - 0.5) * 22, z = pr.position.z + (R() - 0.5) * 16;
                const y = amb === 'snow' || amb === 'ash' ? 5 + R() * 3 : 0.3 + R() * 2.5;
                this.fx.emit(amb === 'ember' ? 'ember' : amb, x, y, z, { color: this.B.dust });
            }
        } else this.ambientT = 0;
        this.fx.update(dt);
        // Lights: the nearest light spots get the pooled point lights.
        this.lightT = (this.lightT || 0) - dt;
        if (this.lightT <= 0) {
            this.lightT = 0.4;
            for (const s of this.lightSpots) { if (s.obj) s.obj.getWorldPosition(s.p).y += 0.8; s.d = s.p.distanceToSquared(pr.position); }
            const near = [...this.lightSpots].sort((a, b) => a.d - b.d).slice(0, this.lights.length);
            this.lights.forEach((l, i) => { const s = near[i]; if (s && s.d < 400) { l.position.copy(s.p); l.color.set(s.color); l.userData.target = s.i * (this.indoor ? 1.4 : 0.9); l.distance = s.soft ? 9 : 7; } else l.userData.target = 0; });
        }
        for (const l of this.lights) l.intensity += ((l.userData.target || 0) * (0.9 + 0.1 * Math.sin(t * 13 + l.id)) - l.intensity) * Math.min(1, dt * 5);
        this.lantern.position.set(pr.position.x, 1.8, pr.position.z + 0.4);
        // Sun and shadows follow the player.
        this.sun.position.copy(pr.position).addScaledVector(this.sunDir, 30);
        this.sun.target.position.copy(pr.position);
        // Camera.
        const tgt = pr.position;
        this.camLook.lerp(new THREE.Vector3(tgt.x, 0, tgt.z), Math.min(1, dt * 5));
        this.camPos.copy(this.camLook).add(this.camOffset());
        this.camera.position.lerp(this.camPos, Math.min(1, dt * 6));
        this.camera.lookAt(this.camLook.x, 0.6, this.camLook.z - 0.4);
        this.sky.position.copy(this.camera.position);
        this.sky.material.uniforms.uTime.value = t;
    }

    botEmitters(bot, dt) {
        for (const e of bot.emitters) {
            e.acc = (e.acc || R()) + dt * (e.rate || 1);
            if (e.acc < 1) continue;
            e.acc -= 1;
            const wp = e.obj.getWorldPosition(new THREE.Vector3());
            this.fx.emit(e.kind, wp.x, wp.y, wp.z, { scale: 0.6, color: e.kind === 'jet' ? bot.ctx.gcol : undefined });
        }
    }

    /** Screen position of a tile point (for the HUD and tests). */
    project(x, y, h = 1) {
        const v = new THREE.Vector3(x + 0.5, h, y + 0.5).project(this.camera);
        return { x: (v.x * 0.5 + 0.5) * this.r.w, y: (-v.y * 0.5 + 0.5) * this.r.h, behind: v.z > 1 };
    }
}

// ------------------------------------------------------------------ helpers
function shade(hex, k) { const c = new THREE.Color(hex).multiplyScalar(k); return `#${c.getHexString()}`; }
function meshAt(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
function lerpAngle(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }
const moundMats = new Map();
function junkMoundMat(B) {
    const k = B.junk || '#4a3a2e';
    if (!moundMats.has(k)) { const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0.3 }); weather(m, { rust: 0.5, patina: new THREE.Color('#6a3a1a'), scale: 4, seed: 9 }); moundMats.set(k, m); }
    return moundMats.get(k);
}
const wallMats = new Map();
function wallMaterial(style, kind) {
    const k = `${style}|${kind}`;
    if (wallMats.has(k)) return wallMats.get(k);
    let m;
    if (kind === 'dungeon' || /foundry|elite|crown|arena/.test(style)) { const t = tex('plate').clone(); t.needsUpdate = true; t.repeat.set(1, 1.5); m = new THREE.MeshStandardMaterial({ map: t, color: kind === 'dungeon' ? '#c8ccd4' : '#d8c8b0', metalness: 0.45, roughness: 0.55 }); }
    else if (style === 'station') { const t = tex('brick').clone(); t.needsUpdate = true; m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); }
    else { const t = tex('planks').clone(); t.needsUpdate = true; m = new THREE.MeshStandardMaterial({ map: t, color: '#e8d0b0', roughness: 0.85 }); }
    wallMats.set(k, m);
    return m;
}
const darkCache = new Map();
/** Make a bot look dormant: darker, rustier copies of its materials. */
export function darken(root) {
    root.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const out = mats.map((m) => {
            if (darkCache.has(m.uuid)) return darkCache.get(m.uuid);
            const d = m.clone();
            if (d.color) d.color.multiplyScalar(0.45);
            if (d.emissive) d.emissiveIntensity = (d.emissiveIntensity || 0) * 0.08;
            if (m.userData.weather) weather(d, { ...m.userData.weather, rust: Math.min(0.9, m.userData.weather.rust + 0.4) });
            darkCache.set(m.uuid, d);
            return d;
        });
        o.material = Array.isArray(o.material) ? out : out[0];
    });
}
function disposeGroup(g) {
    // Geometries and materials are mostly shared caches reused by the next map; free instance buffers
    // and per-map canvas textures only.
    g.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        if (o.isMesh && o.material && o.material.map && o.material.map.userData?.perMap) o.material.map.dispose();
    });
}
