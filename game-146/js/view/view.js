// JINGLE POP — the three.js view. Reads G every frame and turns sim events into effects. Never changes G.
//
// An orthographic camera looks straight at the board: sim (x, y) is world (x, -y, 0), so the screen mapping is a plain
// scale and offset (layout()), which the UI and the pointer aiming share. Ornaments are instanced spheres, one mesh per
// colour with its own painted pattern (stripes, dots, zigzags, snowflakes, ribs, stars), glossy against a room
// environment map. Specials, the launcher, the aim guide, falling ornaments, sparkles and snow are all made in code.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FIELD, R, ROW_H, ROWS, COLS, DEAD_Y, SHOOTER, COLOR_HEX, AIM_MIN } from '../config.js';
import * as H from '../sim/hex.js';
import { shotPos } from '../sim/game.js';

const VIEW = { x0: -0.7, x1: 11.7, y0: -1.0, y1: 16.6 };       // the part of the world that must always be on screen
const CAP = 280;                                                  // instances per mesh (grid + falling)
const TAU = Math.PI * 2;

function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function shade(n, k) {
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** The painted band of each colour: a pattern as well as a colour, so the colours never rely on hue alone. */
function ornamentTexture(i) {
    const base = COLOR_HEX[i];
    return canvasTex(256, 128, (g, w, h) => {
        g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
        const lite = shade(base, 0.75), dark = shade(base, -0.45), gold = '#ffe08a';
        if (i === 0) {                                     // cranberry: two white bands with gold piping
            for (const y of [0.36, 0.6]) { g.fillStyle = '#fff6ee'; g.fillRect(0, y * h, w, 8); g.fillStyle = gold; g.fillRect(0, y * h - 3, w, 2); g.fillRect(0, y * h + 9, w, 2); }
        } else if (i === 1) {                              // gold: dots
            g.fillStyle = dark;
            for (let y = 0; y < 5; y++) for (let x = 0; x < 12; x++) { g.beginPath(); g.arc(x * 22 + (y % 2) * 11, 18 + y * 22, 5, 0, TAU); g.fill(); }
        } else if (i === 2) {                              // evergreen: a white zigzag
            g.strokeStyle = '#f4fff4'; g.lineWidth = 7; g.beginPath();
            for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.5 + (x / 16 % 2 ? -14 : 14));
            g.stroke();
        } else if (i === 3) {                              // frost blue: snowflakes
            g.strokeStyle = '#f2f8ff'; g.lineWidth = 2.5;
            for (let k = 0; k < 9; k++) {
                const cx = 14 + k * 28, cy = k % 2 ? 44 : 84;
                for (let a = 0; a < 3; a++) { const t = a * Math.PI / 3; g.beginPath(); g.moveTo(cx - Math.cos(t) * 9, cy - Math.sin(t) * 9); g.lineTo(cx + Math.cos(t) * 9, cy + Math.sin(t) * 9); g.stroke(); }
            }
        } else if (i === 4) {                              // silver: ribs
            for (let x = 0; x < w; x += 16) { g.fillStyle = dark; g.fillRect(x, 0, 4, h); g.fillStyle = lite; g.fillRect(x + 6, 0, 3, h); }
        } else {                                           // plum: gold stars
            g.fillStyle = gold;
            for (let k = 0; k < 8; k++) {
                const cx = 16 + k * 32, cy = k % 2 ? 46 : 82;
                g.beginPath();
                for (let p = 0; p < 10; p++) { const rr = p % 2 ? 4 : 10, a = p * Math.PI / 5 - Math.PI / 2; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
                g.fill();
            }
        }
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, h * 0.12);
    });
}

function glowTexture() {
    return canvasTex(64, 64, (g, w) => {
        const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }, false);
}

function stripeTexture(a = '#e0283a', b = '#fff6ee', n = 8) {
    const t = canvasTex(64, 256, (g, w, h) => {
        g.fillStyle = b; g.fillRect(0, 0, w, h);
        g.fillStyle = a;
        for (let i = -2; i < n * 2; i++) { g.beginPath(); const y = i * (h / n); g.moveTo(0, y); g.lineTo(w, y - 24); g.lineTo(w, y - 24 + h / n / 2); g.lineTo(0, y + h / n / 2); g.fill(); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.setClearColor(0x000000, 0);
        this.scene = new THREE.Scene();
        const pm = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        pm.dispose();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        this.camera.position.set(0, 0, 40);
        this.scene.add(new THREE.HemisphereLight(0xfff2dd, 0x203050, 0.9));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(-5, 7, 9);
        this.scene.add(key);
        const rimL = new THREE.DirectionalLight(0x9fc8ff, 1.2);       // a cool rim from the lower right
        rimL.position.set(6, -5, 4);
        this.scene.add(rimL);

        this.calm = false;
        this.guideMode = 'short';
        this.dummy = new THREE.Object3D();
        this.bumps = new Map();          // ball id -> time of a wobble
        this.falling = [];               // ornaments dropping off the board
        this.offY = 0;                   // the board eases into place after the ceiling drops or a row pushes in
        this.shake = 0;
        this.flash = 0;
        this.time = 0;
        this.icons = {};

        this._buildBoard();
        this._buildBalls();
        this._buildLauncher();
        this._buildFx();

        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    // ------------------------------------------------------------------ building
    _buildBoard() {
        const g = new THREE.Group();
        this.scene.add(g);
        // a dark glass panel behind the ornaments
        const shape = new THREE.Shape();
        const x0 = -0.15, x1 = FIELD.w + 0.15, y0 = 0.4, y1 = -16.55, rr = 0.5;
        shape.moveTo(x0 + rr, y0); shape.lineTo(x1 - rr, y0); shape.quadraticCurveTo(x1, y0, x1, y0 - rr);
        shape.lineTo(x1, y1 + rr); shape.quadraticCurveTo(x1, y1, x1 - rr, y1); shape.lineTo(x0 + rr, y1);
        shape.quadraticCurveTo(x0, y1, x0, y1 + rr); shape.lineTo(x0, y0 - rr); shape.quadraticCurveTo(x0, y0, x0 + rr, y0);
        this.panel = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x0a1230, transparent: true, opacity: 0.6, depthWrite: false }));
        this.panel.position.z = -2;
        g.add(this.panel);
        // candy-cane rails down both sides
        const railMat = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.3, metalness: 0.05 });
        railMat.map.repeat.set(1, 6);
        for (const x of [-0.24, FIELD.w + 0.24]) {
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 15.2, 16), railMat);
            rail.position.set(x, -7.0, -0.5);
            g.add(rail);
        }
        // the ceiling: a frosted wash over the rows it has come down, and a snow-capped wooden beam at its edge
        this.ceilBlock = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w + 0.3, 1), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.22, depthWrite: false }));
        this.ceilBlock.position.z = -1;
        g.add(this.ceilBlock);
        const beamTex = canvasTex(512, 64, (c, w, h) => {
            const gr = c.createLinearGradient(0, 0, 0, h);
            gr.addColorStop(0, '#8a5530'); gr.addColorStop(1, '#4e2c15');
            c.fillStyle = gr; c.fillRect(0, 0, w, h);
            c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
            for (let y = 14; y < h; y += 14) { c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x * 0.05 + y) * 3); c.stroke(); }
            c.fillStyle = '#f6fbff';
            c.fillRect(0, 0, w, 14);
            for (let x = 0; x < w; x += 22) { c.beginPath(); c.arc(x + 11, 13, 9 + (x % 3) * 2, 0, Math.PI); c.fill(); }
        });
        this.beam = new THREE.Mesh(new THREE.BoxGeometry(FIELD.w + 0.8, 0.55, 0.5), new THREE.MeshStandardMaterial({ map: beamTex, roughness: 0.8 }));
        this.beam.position.z = -0.4;
        g.add(this.beam);
        this.icicles = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.4, 6), new THREE.MeshPhysicalMaterial({ color: 0xcfeaff, roughness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 }), 24);
        g.add(this.icicles);
        // a garland of little lights along the ceiling's edge
        this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 22);
        for (let i = 0; i < 22; i++) this.bulbs.setColorAt(i, new THREE.Color(COLOR_HEX[i % 4 === 3 ? 3 : i % 4]).multiplyScalar(1.4));
        g.add(this.bulbs);
        // the deadline: a dashed red line that glows when the ornaments get close
        const dash = canvasTex(256, 16, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#ff5a5a'; for (let x = 0; x < w; x += 32) c.fillRect(x, 4, 20, 8); });
        dash.wrapS = THREE.RepeatWrapping; dash.repeat.set(4, 1);
        this.deadline = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w, 0.16), new THREE.MeshBasicMaterial({ map: dash, transparent: true, opacity: 0.55, toneMapped: false }));
        this.deadline.position.set(FIELD.w / 2, -DEAD_Y - R, -0.2);
        g.add(this.deadline);
    }

    _buildBalls() {
        const sphere = new THREE.SphereGeometry(0.47, 32, 22);
        this.colorMats = COLOR_HEX.map((c, i) => new THREE.MeshPhysicalMaterial({
            map: ornamentTexture(i), metalness: i === 4 ? 0.6 : 0.45, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.8,
        }));
        this.colorMeshes = this.colorMats.map((m) => { const im = new THREE.InstancedMesh(sphere, m, CAP); im.frustumCulled = false; this.scene.add(im); return im; });
        // the little gold cap and hanging loop every ornament wears
        const capGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.12, 12);
        capGeo.translate(0, 0.47, 0);
        const loop = new THREE.TorusGeometry(0.07, 0.02, 6, 12); loop.translate(0, 0.58, 0);
        const merged = mergeGeos([capGeo, loop]);
        this.caps = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 1, roughness: 0.25 }), CAP * 2);
        this.caps.frustumCulled = false;
        this.scene.add(this.caps);
        // frozen ornaments wear a shell of ice
        const frost = canvasTex(128, 64, (g, w, h) => {
            g.fillStyle = '#dff4ff'; g.fillRect(0, 0, w, h);
            g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
            for (let k = 0; k < 18; k++) { g.beginPath(); let x = (k * 37) % w, y = (k * 23) % h; g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += ((k * 7 + s * 13) % 21) - 10; y += ((k * 11 + s * 5) % 17) - 8; g.lineTo(x, y); } g.stroke(); }
        });
        this.ice = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.53, 1), new THREE.MeshPhysicalMaterial({
            map: frost, color: 0xe8f7ff, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0, clearcoat: 1, flatShading: true, depthWrite: false,
        }), 120);
        this.ice.frustumCulled = false; this.ice.renderOrder = 2;
        this.scene.add(this.ice);
        this.coal = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.44, 0), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.95, flatShading: true, emissive: 0x1a0800 }), 120);
        this.coal.frustumCulled = false; this.scene.add(this.coal);
        const giftTex = canvasTex(128, 128, (g, w) => {
            g.fillStyle = '#2f9e55'; g.fillRect(0, 0, w, w);
            g.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < w; i += 16) g.fillRect(i, 0, 6, w);
            g.fillStyle = '#d8283a'; g.fillRect(w * 0.42, 0, w * 0.16, w); g.fillRect(0, w * 0.42, w, w * 0.16);
            g.fillStyle = '#ffd86a'; g.fillRect(w * 0.42, 0, 3, w); g.fillRect(w * 0.58 - 3, 0, 3, w);
        });
        this.gift = new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), new THREE.MeshStandardMaterial({ map: giftTex, roughness: 0.5 }), 60);
        this.gift.frustumCulled = false; this.scene.add(this.gift);
        const bow = mergeGeos([new THREE.TorusGeometry(0.12, 0.05, 6, 12).translate(-0.12, 0.42, 0), new THREE.TorusGeometry(0.12, 0.05, 6, 12).translate(0.12, 0.42, 0)]);
        this.bows = new THREE.InstancedMesh(bow, new THREE.MeshStandardMaterial({ color: 0xd8283a, roughness: 0.4 }), 60);
        this.bows.frustumCulled = false; this.scene.add(this.bows);
        const pts = [[0, 0.42], [0.08, 0.4], [0.18, 0.3], [0.24, 0.1], [0.3, -0.12], [0.42, -0.3], [0.46, -0.36], [0.4, -0.4], [0.0, -0.38]].map(([x, y]) => new THREE.Vector2(x, y));
        this.bell = new THREE.InstancedMesh(new THREE.LatheGeometry(pts, 20), new THREE.MeshStandardMaterial({ color: 0xffcc40, metalness: 1, roughness: 0.2, side: THREE.DoubleSide }), 60);
        this.bell.frustumCulled = false; this.scene.add(this.bell);
        const rainbow = canvasTex(256, 64, (g, w, h) => {
            const gr = g.createLinearGradient(0, 0, w, 0);
            ['#ff4d6d', '#ffb347', '#fff275', '#5ee87a', '#4db8ff', '#b07aff', '#ff4d6d'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
        });
        this.prism = new THREE.InstancedMesh(sphere, new THREE.MeshPhysicalMaterial({ map: rainbow, metalness: 0.2, roughness: 0.1, clearcoat: 1, iridescence: 1, emissive: 0x332244 }), 60);
        this.prism.frustumCulled = false; this.scene.add(this.prism);
    }

    _buildLauncher() {
        const g = this.launcher = new THREE.Group();
        g.position.set(SHOOTER.x, -SHOOTER.y, 0.3);
        this.scene.add(g);
        const base = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 16, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x1f7a45, roughness: 0.35, clearcoat: 0.8 }));
        base.rotation.x = Math.PI / 2; base.position.set(0, -0.35, -0.6); base.scale.set(1, 1, 0.6);
        g.add(base);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.16, 40), new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 1, roughness: 0.25 }));
        rim.position.set(0, -0.4, -0.5);
        g.add(rim);
        this.barrel = new THREE.Group();
        g.add(this.barrel);
        const stripes = stripeTexture();
        stripes.repeat.set(1, 2);
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 20, 1, true), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.3, side: THREE.DoubleSide }));
        tube.position.y = 0.55; tube.position.z = -0.3;
        this.barrel.add(tube);
        const tip = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.05, 8, 20), new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 1, roughness: 0.25 }));
        tip.rotation.x = Math.PI / 2; tip.position.set(0, 1.3, -0.3);
        this.barrel.add(tip);
        // the loaded ornament and the flying shot are ordinary meshes sharing the instanced meshes' materials
        const sphere = new THREE.SphereGeometry(0.47, 32, 22);
        this.loadedBall = new THREE.Mesh(sphere, this.colorMats[0]);
        this.scene.add(this.loadedBall);
        this.shotBall = new THREE.Mesh(sphere, this.colorMats[0]);
        this.scene.add(this.shotBall);
        this.trayBalls = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(sphere, this.colorMats[0]); m.visible = false; this.scene.add(m); return m; });
        // power-up icons (art/icon-*.webp) on sprites, used for a loaded or flying power-up
        const glow = glowTexture();
        this.loadedIcon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        this.loadedIcon.scale.set(1.25, 1.25, 1);
        this.scene.add(this.loadedIcon);
        this.shotIcon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        this.shotIcon.scale.set(1.1, 1.1, 1);
        this.scene.add(this.shotIcon);
        this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
        this.halo.scale.set(2, 2, 1);
        this.scene.add(this.halo);
        // the aim guide: little glowing beads, and a ghost of where the shot will land
        this.guide = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }), 160);
        this.guide.frustumCulled = false;
        this.scene.add(this.guide);
        this.ghost = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
        this.scene.add(this.ghost);
    }

    _buildFx() {
        const N = this.NP = 1400;
        const geo = new THREE.BufferGeometry();
        this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3);
        this.pVel = new Float32Array(N * 2); this.pLife = new Float32Array(N); this.pMax = new Float32Array(N);
        geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
        this.pMat = new THREE.PointsMaterial({ size: 8, map: glowTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false, toneMapped: false });
        this.points = new THREE.Points(geo, this.pMat);
        this.points.frustumCulled = false;
        this.points.position.z = 2;
        this.scene.add(this.points);
        this.pNext = 0;
        for (let i = 0; i < N; i++) this.pPos[i * 3 + 2] = -999;
        // snow drifting over everything
        const S = this.NS = 140;
        const sgeo = new THREE.BufferGeometry();
        this.sPos = new Float32Array(S * 3);
        for (let i = 0; i < S; i++) { this.sPos[i * 3] = -8 + Math.random() * 27; this.sPos[i * 3 + 1] = 2 - Math.random() * 20; this.sPos[i * 3 + 2] = 3; }
        sgeo.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3));
        this.snowMat = new THREE.PointsMaterial({ size: 4, map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: false });
        this.snow = new THREE.Points(sgeo, this.snowMat);
        this.snow.frustumCulled = false;
        this.scene.add(this.snow);
    }

    setIcons(map) {
        // map: power id -> image URL
        const loader = new THREE.TextureLoader();
        for (const [k, url] of Object.entries(map)) {
            loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; this.icons[k] = t; }, undefined, () => { /* missing art: plain glow */ });
        }
    }

    // ------------------------------------------------------------------ layout
    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return false;
        this.w = w; this.h = h; this.dpr = dpr;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);
        const top = h < 500 ? 44 : 50, bot = 4;
        const vw = VIEW.x1 - VIEW.x0, vh = VIEW.y1 - VIEW.y0;
        const s = this.s = Math.min(w / vw, (h - top - bot) / vh);
        this.ox = w / 2 - ((VIEW.x0 + VIEW.x1) / 2) * s;                  // screen x of sim x = 0
        this.oy = top + (h - top - bot - vh * s) * 0.7 - VIEW.y0 * s;       // screen y of sim y = 0 (tall phones: nearer the thumb)
        const cam = this.camera;
        cam.left = -this.ox / s; cam.right = (w - this.ox) / s;
        cam.top = this.oy / s; cam.bottom = -(h - this.oy) / s;
        cam.updateProjectionMatrix();
        this.pMat.size = 0.42 * s * dpr;
        this.snowMat.size = Math.max(2, 0.12 * s) * dpr;
        return true;
    }

    /** Sim units -> CSS px (the canvas fills the window from 0, 0). */
    toScreen(x, y) { return { x: this.ox + x * this.s, y: this.oy + y * this.s }; }
    /** CSS px -> sim units, through the canvas's own rect. */
    toSim(cx, cy) {
        const r = this.canvas.getBoundingClientRect();
        return { x: (cx - r.left - this.ox) / this.s, y: (cy - r.top - this.oy) / this.s };
    }
    /** The aim for a pointer at (cx, cy), and whether it is over the board (a release there shoots). */
    aimFor(cx, cy) {
        const p = this.toSim(cx, cy);
        const dx = p.x - SHOOTER.x, dy = SHOOTER.y - p.y;
        if (dy < 0.3 && Math.abs(dx) < 1.5) return { angle: Math.PI / 2, onBoard: false };
        const a = Math.atan2(Math.max(0.02, dy), dx);
        return { angle: Math.max(AIM_MIN, Math.min(Math.PI - AIM_MIN, a)), onBoard: dy > 0.7 && p.x > -1 && p.x < FIELD.w + 1 };
    }
    /** Where the tray's ornaments sit: slot 0 is in the launcher. */
    trayPos(i) { return i === 0 ? { x: SHOOTER.x, y: SHOOTER.y } : { x: SHOOTER.x - 1.9 - (i - 1) * 1.2, y: SHOOTER.y + 0.35 }; }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'stick':
                    for (const b of H.balls(G)) if (Math.hypot(b.x - e.x, b.y - e.y) < 1.6) this.bumps.set(b.b.id, this.time);
                    this.burst(e.x, e.y, COLOR_HEX[e.col] ?? 0xffffff, 5, 2);
                    break;
                case 'pop':
                    for (const b of e.list) {
                        const col = b.k === 'coal' ? 0x553322 : b.k === 'bell' ? 0xffd060 : b.k === 'prism' ? 0xffffff : COLOR_HEX[b.c] ?? 0xffffff;
                        this.burst(b.x, b.y, col, this.calm ? 6 : 14, 5);
                        this.burst(b.x, b.y, 0xffffff, 3, 3);
                    }
                    if (e.list.length >= 6) this.shake = Math.max(this.shake, this.calm ? 0 : 0.12);
                    break;
                case 'drop':
                    for (const b of e.list) this.falling.push({ ...b, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, rot: 0, spin: (Math.random() - 0.5) * 8, t: 0 });
                    break;
                case 'gift': this.burst(e.x, e.y, 0xffe08a, 30, 7); break;
                case 'thaw': this.burst(e.x, e.y, 0xcfefff, 16, 4); break;
                case 'blast': this.burst(e.x, e.y, 0xffb060, 60, 10); this.shake = this.calm ? 0 : 0.3; this.flash = this.calm ? 0 : 0.6; break;
                case 'ring': case 'chime': this.burst(e.x, e.y, 0xffe070, 30, 8); break;
                case 'tinsel': for (const y of e.rows) for (let x = 0.5; x < FIELD.w; x += 0.7) this.burst(x, y, 0xe8f0ff, 3, 4); break;
                case 'cocoa': this.burst(e.x, e.y, 0xc08060, 40, 6); break;
                case 'lower': case 'push': this.offY = -ROW_H; this.shake = this.calm ? 0 : 0.18; break;
                case 'shatter': this.burst(e.x, e.y, 0xff4060, 24, 7); break;
                case 'won': for (let i = 0; i < 6; i++) this.burst(1 + i * 1.8, 6, COLOR_HEX[i], 30, 9); break;
                default: break;
            }
        }
    }

    burst(x, y, color, n, speed) {
        const c = new THREE.Color(color);
        for (let k = 0; k < n; k++) {
            const i = this.pNext; this.pNext = (this.pNext + 1) % this.NP;
            const a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7);
            this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = -y; this.pPos[i * 3 + 2] = 0;
            this.pVel[i * 2] = Math.cos(a) * v; this.pVel[i * 2 + 1] = Math.sin(a) * v;
            this.pMax[i] = this.pLife[i] = 0.4 + Math.random() * 0.5;
            this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
        }
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time, opts = {}) {
        this.resize();
        this.time = time;
        this.offY += (0 - this.offY) * Math.min(1, dt * 7);
        if (Math.abs(this.offY) < 0.002) this.offY = 0;
        this.shake = Math.max(0, this.shake - dt * 1.5);
        const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
        this.scene.position.set(sx, sy, 0);
        const top = H.top(G) + this.offY;

        // ceiling, icicles and lights follow it down
        this.ceilBlock.visible = top > 0.05;
        this.ceilBlock.scale.y = Math.max(0.01, top + 0.4);
        this.ceilBlock.position.set(FIELD.w / 2, 0.4 - (top + 0.4) / 2, -1);
        this.beam.position.set(FIELD.w / 2, -(top - 0.27), -0.4);
        for (let i = 0; i < 24; i++) {
            this.dummy.position.set(0.25 + i * 0.46, -(top + 0.12 + (i % 3) * 0.03), -0.5);
            this.dummy.scale.set(1, 0.6 + ((i * 7) % 5) * 0.1, 1);
            this.dummy.rotation.set(0, 0, Math.PI);
            this.dummy.updateMatrix();
            this.icicles.setMatrixAt(i, this.dummy.matrix);
        }
        this.icicles.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < 22; i++) {
            const tw = this.calm ? 1 : 0.75 + 0.25 * Math.sin(time * 2.5 + i * 1.7);
            this.dummy.position.set(0.2 + i * 0.505, -(top - 0.05) + Math.sin(i * 1.3) * 0.05, 0.2);
            this.dummy.scale.setScalar(tw);
            this.dummy.updateMatrix();
            this.bulbs.setMatrixAt(i, this.dummy.matrix);
        }
        this.bulbs.instanceMatrix.needsUpdate = true;
        const low = lowest(G);
        const danger = low > DEAD_Y - 2 * ROW_H ? 1 : 0;
        this.deadline.material.opacity = danger ? 0.55 + 0.4 * Math.sin(time * 8) : 0.35;
        this.deadline.material.map.offset.x = -time * 0.1;

        // ornaments
        const counts = { col: new Array(6).fill(0), caps: 0, ice: 0, coal: 0, gift: 0, bell: 0, prism: 0 };
        const place = (kind, c, x, y, rot = 0, scale = 1) => {
            const d = this.dummy;
            d.position.set(x, -y, 0);
            d.rotation.set(0, kind === 'gift' ? 0.6 : 0, rot);
            d.scale.setScalar(scale);
            d.updateMatrix();
            if (kind === 'orn' || kind === 'ice') {
                if (counts.col[c] < CAP) this.colorMeshes[c].setMatrixAt(counts.col[c]++, d.matrix);
                if (counts.caps < CAP * 2) this.caps.setMatrixAt(counts.caps++, d.matrix);
                if (kind === 'ice' && counts.ice < 120) { d.rotation.set(0.3, 0.5, rot); d.updateMatrix(); this.ice.setMatrixAt(counts.ice++, d.matrix); }
            } else if (kind === 'coal' && counts.coal < 120) { d.rotation.set(rot * 3 + x, y, rot); d.updateMatrix(); this.coal.setMatrixAt(counts.coal++, d.matrix); }
            else if (kind === 'gift' && counts.gift < 60) { this.gift.setMatrixAt(counts.gift, d.matrix); this.bows.setMatrixAt(counts.gift++, d.matrix); }
            else if (kind === 'bell' && counts.bell < 60) { this.bell.setMatrixAt(counts.bell++, d.matrix); }
            else if (kind === 'prism' && counts.prism < 60) {
                d.rotation.set(0, time * 1.5, rot); d.updateMatrix();
                this.prism.setMatrixAt(counts.prism++, d.matrix);
                if (counts.caps < CAP * 2) { d.rotation.set(0, 0, rot); d.updateMatrix(); this.caps.setMatrixAt(counts.caps++, d.matrix); }
            }
        };
        for (let r = 0; r < ROWS; r++) {
            const row = G.grid[r];
            for (let c = 0; c < COLS; c++) {
                const b = row[c];
                if (!b) continue;
                const x = H.cellX(G, r, c), y = H.cellY(G, r) + this.offY;
                const bt = this.bumps.get(b.id);
                let scale = 1;
                if (bt !== undefined) {
                    const k = time - bt;
                    if (k > 0.5) this.bumps.delete(b.id); else scale = 1 + Math.sin(k * 25) * 0.08 * (1 - k / 0.5);
                }
                const sway = this.calm ? 0 : Math.sin(time * 1.4 + b.id * 0.9) * 0.05;
                place(b.k, b.c, x, y, sway, scale);
            }
        }
        // falling ornaments
        for (let i = this.falling.length - 1; i >= 0; i--) {
            const f = this.falling[i];
            f.t += dt; f.vy += 30 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
            if (f.y > VIEW.y1 + 3) { this.falling.splice(i, 1); continue; }
            place(f.k, f.c, f.x, f.y, f.rot, 1);
        }
        for (let c = 0; c < 6; c++) { this.colorMeshes[c].count = counts.col[c]; this.colorMeshes[c].instanceMatrix.needsUpdate = true; }
        for (const [k, m] of [['caps', this.caps], ['ice', this.ice], ['coal', this.coal], ['gift', this.gift], ['bell', this.bell], ['prism', this.prism]]) {
            m.count = counts[k]; m.instanceMatrix.needsUpdate = true;
        }
        this.bows.count = counts.gift; this.bows.instanceMatrix.needsUpdate = true;

        // launcher, loaded ornament, tray
        const aim = G.aim;
        this.barrel.rotation.z = aim - Math.PI / 2;
        const showLauncher = opts.playing !== false;
        this.launcher.visible = showLauncher;
        const kindLoaded = G.loaded;
        const cur = G.tray[0];
        const ready = G.phase === 'aim' && showLauncher;
        this.loadedBall.visible = ready && !kindLoaded && cur >= 0;
        if (this.loadedBall.visible) {
            this.loadedBall.material = this.colorMats[cur];
            this.loadedBall.position.set(SHOOTER.x, -SHOOTER.y, 0.9);
            this.loadedBall.rotation.set(0, time * 0.6, 0);
        }
        const icon = kindLoaded && this.icons[kindLoaded];
        this.loadedIcon.visible = ready && !!kindLoaded && !!icon;
        this.halo.visible = ready && !!kindLoaded;
        if (kindLoaded) {
            if (icon) { this.loadedIcon.material.map = icon; this.loadedIcon.material.needsUpdate = true; }
            const bob = Math.sin(time * 4) * 0.06;
            this.loadedIcon.position.set(SHOOTER.x, -SHOOTER.y + bob, 1);
            this.halo.position.set(SHOOTER.x, -SHOOTER.y, 0.95);
            this.halo.material.opacity = 0.55 + 0.25 * Math.sin(time * 5);
        }
        for (let i = 0; i < this.trayBalls.length; i++) {
            const m = this.trayBalls[i];
            const preview = G.slots === 1 && i === 1;
            const col = i < G.tray.length ? G.tray[i] : preview ? G.next : -1;
            m.visible = showLauncher && i > 0 && col >= 0;
            if (!m.visible) continue;
            const p = this.trayPos(i);
            m.material = this.colorMats[col];
            m.position.set(p.x, -p.y, 0.6);
            m.scale.setScalar(preview ? 0.7 : 0.85);
            m.rotation.set(0, time * 0.5 + i, 0);
        }

        // the shot in flight
        const sp = shotPos(G);
        const kind = G.shot?.kind;
        this.shotBall.visible = !!sp && kind === 'orn';
        this.shotIcon.visible = !!sp && kind !== 'orn' && !!this.icons[kind];
        if (sp) {
            if (kind === 'orn') { this.shotBall.material = this.colorMats[G.shot.c]; this.shotBall.position.set(sp.x, -sp.y, 0.8); this.shotBall.rotation.z += dt * 10; }
            else {
                if (this.icons[kind]) { this.shotIcon.material.map = this.icons[kind]; this.shotIcon.material.needsUpdate = true; }
                this.shotIcon.position.set(sp.x, -sp.y, 1);
                this.halo.visible = true; this.halo.position.set(sp.x, -sp.y, 0.95);
                if (Math.random() < 0.6) this.burst(sp.x, sp.y, kind === 'candy' ? 0xff4060 : 0xffe08a, 2, 1.5);
            }
        }

        // the aim guide
        let n = 0;
        this.ghost.visible = false;
        if (ready && opts.guide !== false) {
            const tr = opts.trace;
            if (tr) {
                const full = G.guide > 0;
                const maxBounce = full ? 99 : this.guideMode === 'long' ? 2 : 1;
                let budget = full ? 99 : this.guideMode === 'long' ? 15 : 7.5;
                const phase = (time * 1.6) % 0.55;
                for (let i = 1; i < tr.pts.length && i <= maxBounce + 1 && budget > 0 && n < 160; i++) {
                    const a = tr.pts[i - 1], b = tr.pts[i];
                    const L = Math.hypot(b.x - a.x, b.y - a.y);
                    for (let s = (i === 1 ? 0.9 : 0) + phase; s < L && budget > 0 && n < 160; s += 0.55) {
                        const k = s / L;
                        this.dummy.position.set(a.x + (b.x - a.x) * k, -(a.y + (b.y - a.y) * k), 0.7);
                        this.dummy.scale.setScalar(full ? 1.3 : 1);
                        this.dummy.rotation.set(0, 0, 0);
                        this.dummy.updateMatrix();
                        this.guide.setMatrixAt(n++, this.dummy.matrix);
                        budget -= 0.55;
                    }
                }
                this.guide.material.color.set(full ? 0xffe070 : 0xffffff);
                if (full && tr.cell) {
                    this.ghost.visible = true;
                    this.ghost.position.set(H.cellX(G, tr.cell[0], tr.cell[1]), -H.cellY(G, tr.cell[0]), 0.4);
                    this.ghost.material.color.set(kindLoaded ? 0xffe070 : COLOR_HEX[cur]);
                }
            }
        }
        this.guide.count = n;
        this.guide.instanceMatrix.needsUpdate = true;

        // sparkles and snow
        const P = this.pPos;
        for (let i = 0; i < this.NP; i++) {
            if (this.pLife[i] <= 0) continue;
            this.pLife[i] -= dt;
            if (this.pLife[i] <= 0) { P[i * 3 + 2] = -999; continue; }
            this.pVel[i * 2 + 1] -= 9 * dt;
            this.pVel[i * 2] *= 1 - dt * 2; this.pVel[i * 2 + 1] *= 1 - dt * 2;
            P[i * 3] += this.pVel[i * 2] * dt; P[i * 3 + 1] += this.pVel[i * 2 + 1] * dt;
            const k = this.pLife[i] / this.pMax[i];
            this.pCol[i * 3] *= 0.985; this.pCol[i * 3 + 1] *= 0.985; this.pCol[i * 3 + 2] *= 0.985;
            if (k < 0.1) P[i * 3 + 2] = -999;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
        const S = this.sPos;
        for (let i = 0; i < this.NS; i++) {
            S[i * 3 + 1] -= dt * (0.6 + (i % 5) * 0.15);
            S[i * 3] += Math.sin(time * 0.7 + i) * dt * 0.3;
            if (S[i * 3 + 1] < -18) { S[i * 3 + 1] = 2; S[i * 3] = -8 + ((i * 37) % 27); }
        }
        this.snow.geometry.attributes.position.needsUpdate = true;
        this.snow.visible = !this.calm;

        this.renderer.render(this.scene, this.camera);
    }
}

function lowest(G) {
    for (let r = ROWS - 1; r >= 0; r--) if (G.grid[r].some(Boolean)) return H.cellY(G, r);
    return -Infinity;
}

/** Merge non-indexed copies of a few geometries into one (enough for caps and bows). */
function mergeGeos(list) {
    const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0;
    for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return out;
}
