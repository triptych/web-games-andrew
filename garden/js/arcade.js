// The Lighthouse Arcade: the door at the foot of the lighthouse opens on a hall
// far bigger than the lighthouse, an 80s arcade with a cabinet for every game in
// the garden, each running its game's attract mode. Click a cabinet for its game
// card. Down the west side is a working bowling alley (arcade-bowling.js), and on
// the east a disco floor with a mirror ball and a jukebox (arcade-disco.js,
// arcade-audio.js). By the way in stand Madame Meridian, a fortune teller who
// prints you a ticket (arcade-fortune.js), and Plush Pier, a claw machine full of
// plush from the garden's games (arcade-claw.js, arcade-toys.js). The hall is planned from the game list (arcade-layout.js) and
// grows with it. Like the Observatory it is built on the first visit, with its
// own scene and a stand-in `world` for the walking controls.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { planArcade, walkablePlan, CAB_W, HALL_H } from './arcade-layout.js';
import { buildAtlases, screenMaterial, marqueeMaterial, neonTexture, pixelFontReady, pixelFontLoaded, PIXEL_FONT } from './arcade-screens.js';
import { Bowling } from './arcade-bowling.js';
import { Disco, FLOOR_Y } from './arcade-disco.js';
import { ArcadeAudio, SONGS } from './arcade-audio.js';
import { FortuneTeller } from './arcade-fortune.js';
import { ClawMachine } from './arcade-claw.js';
import { rng, store, esc, TAU } from './util.js';

const NEON = ['#ff3fd0', '#30e8ff', '#ffe94a', '#5fff8f', '#b06bff', '#ff8a3a'];

// ------------------------------------------------------------------ textures

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const tex = (c, repeatX = 1, repeatY = 1) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 8;
    return t;
};

/** The carpet every arcade had: neon squiggles, triangles and rings on midnight blue, tiling. */
function carpetCanvas() {
    const n = 512;
    const c = canvas(n, n);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f0a26';
    ctx.fillRect(0, 0, n, n);
    const r = rng('carpet');
    const wrap = (fn) => {
        for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
            ctx.save();
            ctx.translate(ox, oy);
            fn();
            ctx.restore();
        }
    };
    for (let k = 0; k < 90; k++) {
        const x = r() * n, y = r() * n, col = r.pick(NEON), s = r.range(8, 22), a = r() * TAU, kind = r.int(0, 3);
        wrap(() => {
            ctx.strokeStyle = col;
            ctx.fillStyle = col;
            ctx.lineWidth = r() < 0.5 ? 3 : 2;
            ctx.translate(x, y);
            ctx.rotate(a);
            ctx.beginPath();
            if (kind === 0) {
                ctx.moveTo(-s, 0);
                for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(-s + (i - 0.5) * s * 0.5, i % 2 ? -s * 0.5 : s * 0.5, -s + i * s * 0.5, 0);
                ctx.stroke();
            } else if (kind === 1) {
                ctx.moveTo(0, -s * 0.6);
                ctx.lineTo(s * 0.55, s * 0.4);
                ctx.lineTo(-s * 0.55, s * 0.4);
                ctx.closePath();
                ctx.stroke();
            } else if (kind === 2) {
                ctx.arc(0, 0, s * 0.45, 0, TAU);
                ctx.stroke();
            } else {
                ctx.moveTo(-s, 0);
                for (let i = 1; i <= 4; i++) ctx.lineTo(-s + i * s * 0.5, i % 2 ? -s * 0.35 : 0);
                ctx.stroke();
            }
        });
    }
    for (let k = 0; k < 500; k++) {
        ctx.fillStyle = r.pick(NEON);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(r() * n, r() * n, 2, 2);
    }
    ctx.globalAlpha = 1;
    return c;
}

/** The walls: deep violet with a neon stripe low down and memphis confetti. */
function wallCanvas() {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#07040f');
    g.addColorStop(0.6, '#1b0a36');
    g.addColorStop(1, '#2a0e46');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const r = rng('wall');
    for (let k = 0; k < 40; k++) {
        ctx.fillStyle = r.pick(NEON);
        ctx.globalAlpha = 0.25;
        const x = r() * 512, y = 120 + r() * 300;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(r() * TAU);
        ctx.fillRect(-6, -2, 12, 4);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const [y, col, h] of [[440, '#ff3fd0', 10], [458, '#30e8ff', 6], [470, '#ffe94a', 3]]) {
        ctx.fillStyle = col;
        ctx.fillRect(0, y, 512, h);
    }
    return c;
}

/** The mural on the north wall: a synthwave sun over a grid, and the arcade's name in neon. */
function muralCanvas(count) {
    const W = 2048, H = 640;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#05020e');
    sky.addColorStop(0.55, '#2a0a4a');
    sky.addColorStop(0.7, '#7a1060');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const r = rng('mural');
    for (let k = 0; k < 300; k++) {
        ctx.fillStyle = `rgba(255,255,255,${r() * 0.8})`;
        ctx.fillRect(r() * W, r() * H * 0.55, 2, 2);
    }
    // the sun, striped
    const sy = H * 0.66, sr = 170;
    const sun = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    sun.addColorStop(0, '#ffe94a');
    sun.addColorStop(0.6, '#ff3fd0');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(W / 2, sy, sr, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#2a0a4a';
    for (let k = 0; k < 7; k++) ctx.fillRect(W / 2 - sr, sy - 70 + k * 12, sr * 2, 3 + k * 1.2);
    // the mountains and the grid
    ctx.fillStyle = '#12052a';
    ctx.beginPath();
    ctx.moveTo(0, sy);
    for (let x = 0; x <= W; x += 64) ctx.lineTo(x, sy - 30 - Math.abs(Math.sin(x * 0.004)) * 90 - r() * 30);
    ctx.lineTo(W, sy);
    ctx.fill();
    ctx.fillStyle = '#0a0418';
    ctx.fillRect(0, sy, W, H - sy);
    ctx.strokeStyle = '#ff3fd0';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff3fd0';
    ctx.shadowBlur = 10;
    for (let k = -24; k <= 24; k++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + k * 20, sy);
        ctx.lineTo(W / 2 + k * 180, H);
        ctx.stroke();
    }
    for (let k = 0; k < 8; k++) {
        const y = sy + Math.pow(k / 8, 2) * (H - sy);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
    // the name
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `92px ${PIXEL_FONT}`;
    for (const [col, blur] of [['#30e8ff', 40], ['#30e8ff', 14], ['#ffffff', 0]]) {
        ctx.shadowColor = col;
        ctx.shadowBlur = blur;
        ctx.fillStyle = col;
        ctx.fillText('LIGHTHOUSE', W / 2, 110);
    }
    ctx.font = `64px ${PIXEL_FONT}`;
    for (const [col, blur] of [['#ff3fd0', 36], ['#ff3fd0', 12], ['#ffe0f8', 0]]) {
        ctx.shadowColor = col;
        ctx.shadowBlur = blur;
        ctx.fillStyle = col;
        ctx.fillText('ARCADE', W / 2, 220);
    }
    ctx.shadowBlur = 0;
    ctx.font = `22px ${PIXEL_FONT}`;
    ctx.fillStyle = '#ffe94a';
    ctx.fillText(`${count} GAMES  ·  FREE PLAY  ·  OPEN ALL NIGHT`, W / 2, 300);
    return c;
}

// ------------------------------------------------------------------ the cabinet

function cabinetParts() {
    // the side profile in (z, y): kick panel, control panel, screen leaning back, marquee
    const s = new THREE.Shape();
    const P = [[-0.41, 0], [0.41, 0], [0.41, 0.82], [0.47, 0.9], [0.21, 1.03], [0.17, 1.06], [0.04, 1.62], [0.17, 1.66], [0.17, 1.93], [-0.41, 1.93]];
    s.moveTo(P[0][0], P[0][1]);
    for (const [x, y] of P.slice(1)) s.lineTo(x, y);
    const body = new THREE.ExtrudeGeometry(s, { depth: CAB_W, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(CAB_W / 2, 0, 0);
    body.computeVertexNormals();

    // black trim with coloured controls, merged into one geometry with vertex colours
    const parts = [];
    const add = (geo, col, m) => {
        geo.applyMatrix4(m);
        const n = geo.attributes.position.count;
        const c = new Float32Array(n * 3);
        const cc = new THREE.Color(col);
        for (let i = 0; i < n; i++) c.set([cc.r, cc.g, cc.b], i * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
        parts.push(geo.toNonIndexed());
    };
    const M = (x, y, z, rx = 0) => new THREE.Matrix4().makeRotationX(rx).setPosition(x, y, z);
    const tilt = -Math.atan2(0.13, 0.56);
    add(new THREE.BoxGeometry(0.7, 0.58, 0.02), 0x050508, M(0, 1.34, 0.103, tilt));
    const panelA = Math.atan2(0.13, 0.26);
    add(new THREE.BoxGeometry(CAB_W + 0.01, 0.02, 0.29), 0x101018, M(0, 0.97, 0.34, panelA));
    add(new THREE.BoxGeometry(CAB_W + 0.01, 0.1, 0.02), 0x08080c, M(0, 0.86, 0.44, 0));
    // a joystick and three buttons
    const top = (x, z) => new THREE.Vector3(x, 0.98 + (0.34 - z) * 0.5, z);
    const js = top(-0.17, 0.33);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), 0x111111, M(js.x, js.y + 0.045, js.z));
    add(new THREE.SphereGeometry(0.03, 10, 8), 0xe02030, M(js.x, js.y + 0.1, js.z));
    [[0.04, 0xffe030], [0.12, 0x30d0ff], [0.2, 0x40ff70]].forEach(([x, col]) => {
        const b = top(x, 0.35);
        add(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 12), col, M(b.x, b.y + 0.012, b.z));
    });
    // the coin door
    add(new THREE.BoxGeometry(0.3, 0.26, 0.02), 0x2a2a30, M(0, 0.5, 0.415));
    const trim = mergeSimple(parts);
    const screen = new THREE.PlaneGeometry(0.58, 0.44).applyMatrix4(M(0, 1.34, 0.116, tilt));
    const marquee = new THREE.PlaneGeometry(0.74, 0.21).translate(0, 1.795, 0.174);
    const coins = new THREE.PlaneGeometry(0.05, 0.07);
    const coinL = coins.clone().translate(-0.06, 0.52, 0.427), coinR = coins.clone().translate(0.06, 0.52, 0.427);
    const coin = mergeSimple([coinL.toNonIndexed(), coinR.toNonIndexed()].map((g) => (g.deleteAttribute('uv'), g)));
    return { body, trim, screen, marquee, coin };
}

/** Merges non-indexed geometries with matching attributes. */
function mergeSimple(geos) {
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(geos[0].attributes)) {
        const size = geos[0].attributes[name].itemSize;
        const total = geos.reduce((n, g) => n + g.attributes[name].count, 0);
        const arr = new Float32Array(total * size);
        let o = 0;
        for (const g of geos) {
            arr.set(g.attributes[name].array, o);
            o += g.attributes[name].array.length;
        }
        out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
}

// ------------------------------------------------------------------ the hall

export class Arcade {
    /** @param {object} env { renderer, ui, mats, audio, quality, camera, games } */
    constructor(env) {
        this.env = env;
        this.plan = planArcade(env.games);
        const plan = this.plan;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05030c);
        this.scene.fog = new THREE.FogExp2(0x0a0618, 0.012);
        const pmrem = new THREE.PMREMGenerator(env.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.3;
        pmrem.dispose();
        this.hoverId = -1;
        this.cardId = -1;
        this.time = 0;
        this.best = store.get('bowlBest', 0);
        this.sound = new ArcadeAudio(env.audio);

        this._hall();
        this._cabinets();
        this._signs();
        this._decor();
        this._lights();
        this.bowling = new Bowling({ plan, scene: this.scene, audio: this.sound, camera: env.camera, mats: env.mats });
        this.bowling.best = () => this.best;
        this.bowling.onBest = (total) => {
            if (total <= this.best) return false;
            this.best = total;
            store.set('bowlBest', total);
            return true;
        };
        this.bowling.onQuit = () => this.stopBowling();
        this.bowling.monitors.forEach((m) => this.bowling._drawMonitor(m, null));
        this.disco = new Disco({ plan, scene: this.scene, quality: env.quality });
        this.disco.setSongs(SONGS);
        this.fortune = new FortuneTeller({ plan, scene: this.scene, audio: this.sound, games: env.games, showCard: env.showCard });
        this.claw = new ClawMachine({ plan, scene: this.scene, audio: this.sound, camera: env.camera, games: env.games, showCard: env.showCard });
        this.claw.onQuit = () => this.stopClaw();
        this._grid();
        this._jukeDom();
        // while bowling the walking controls are off, so a click on the view is caught here
        this._onCanvasUp = (e) => {
            if (this.inside && this.bowling.active && e.button === 0 && !this.env.ui.blocking) this.bowling.tap();
        };
        env.canvas?.addEventListener('pointerup', this._onCanvasUp);

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: (x, z) => (self.disco.onFloor(x, z) ? FLOOR_Y : 0),
            onDeck: () => false,
            collidersNear: () => [],
            onArrive: (r) => self._arrive(r),
        };
        this.spawn = plan.spawn;
        this.exit = plan.exit;
        // the pixel font may still be on its way; once it is here the screens are drawn again in it
        if (!this.fontWasReady) {
            pixelFontReady().then(() => {
                if (!this.disposed && pixelFontLoaded()) this._redrawText();
            });
        }
    }

    walkable(x, z) {
        return walkablePlan(this.plan, x, z, 0.3);
    }

    // ------------------------------------------------------------ building

    _hall() {
        const { hall, AW } = this.plan;
        const w = hall.w, d = hall.d, cx = (hall.x0 + hall.x1) / 2, cz = (hall.z0 + hall.z1) / 2;
        const g = new THREE.Group();
        this.scene.add(g);
        this.root = g;
        const carpet = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex(carpetCanvas(), w / 3.2, d / 3.2), roughness: 0.95 }));
        carpet.position.set(cx, 0, cz);
        carpet.userData.kind = 'floor';
        g.add(carpet);
        this.floor = carpet;
        const wc = wallCanvas();
        const wall = (len, x, z, ry) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(len, HALL_H), new THREE.MeshStandardMaterial({ map: tex(wc, len / 4, 1), roughness: 0.8, emissive: 0xffffff, emissiveMap: tex(wc, len / 4, 1), emissiveIntensity: 0.25 }));
            m.position.set(x, HALL_H / 2, z);
            m.rotation.y = ry;
            g.add(m);
        };
        wall(w, cx, hall.z0, 0);
        wall(w, cx, hall.z1, Math.PI);
        wall(d, hall.x0, cz, Math.PI / 2);
        wall(d, hall.x1, cz, -Math.PI / 2);
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x07050c, roughness: 1 }));
        ceil.position.set(cx, HALL_H, cz);
        g.add(ceil);
        // the mural over the cabinets
        const mural = new THREE.Mesh(new THREE.PlaneGeometry(AW, AW * (640 / 2048)), new THREE.MeshBasicMaterial({ map: tex(muralCanvas(this.plan.cabinets.length)), toneMapped: false, color: 0xbbbbbb }));
        const mh = Math.min(HALL_H - 0.3, AW * (640 / 2048));
        mural.scale.setScalar(mh / (AW * (640 / 2048)));
        mural.position.set(0, HALL_H - 0.15 - mh / 2, hall.z0 + 0.03);
        g.add(mural);
        this.mural = mural;
        // a neon tube along the top of every wall
        const tubes = [];
        for (const [len, x, z, ry, col] of [[w, cx, hall.z0 + 0.05, 0, 0], [w, cx, hall.z1 - 0.05, 0, 1], [d, hall.x0 + 0.05, cz, Math.PI / 2, 1], [d, hall.x1 - 0.05, cz, Math.PI / 2, 0]]) tubes.push({ len, x, z, ry, col, y: HALL_H - 0.1 });
        // and a grid of tubes across the ceiling over the cabinets
        for (let x = -AW / 2 + 2, k = 0; x <= AW / 2 - 2; x += 4.6, k++) tubes.push({ len: d - 4, x, z: cz, ry: Math.PI / 2, col: k % 2, y: HALL_H - 0.05 });
        const neonMats = [new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON[0]).multiplyScalar(2.2), toneMapped: false }), new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON[1]).multiplyScalar(2.2), toneMapped: false })];
        this.neonMats = neonMats;
        for (const t of tubes) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(t.len, 0.06, 0.06), neonMats[t.col]);
            m.position.set(t.x, t.y, t.z);
            m.rotation.y = t.ry;
            g.add(m);
        }
        // the door you came in by, and the EXIT sign over it
        const { door } = this.plan;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.6, roughness: 0.4 }));
        frame.position.set(door.x, 1.3, door.z);
        g.add(frame);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.06), this.env.mats?.darkWood ?? new THREE.MeshStandardMaterial({ color: 0x5a3a28 }));
        leaf.position.set(door.x, 1.15, door.z - 0.07);
        leaf.userData.kind = 'door';
        g.add(leaf);
        this.doorMesh = leaf;
        const exit = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: neonTexture('EXIT', '#ff2040', { w: 512, h: 128, size: 0.55 }), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
        exit.position.set(door.x, 2.85, door.z - 0.08);
        exit.rotation.y = Math.PI;
        g.add(exit);
        const welcome = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.9), new THREE.MeshBasicMaterial({ map: neonTexture('INSERT COIN', '#ffe94a', { sub: 'ONE CABINET FOR EVERY GAME IN THE GARDEN', subColor: '#30e8ff' }), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
        welcome.position.set(door.x, 4.2, door.z - 0.1);
        welcome.rotation.y = Math.PI;
        g.add(welcome);
    }

    _cabinets() {
        const cabs = this.plan.cabinets;
        const n = cabs.length;
        const parts = cabinetParts();
        this.fontWasReady = pixelFontLoaded();
        this.atl = buildAtlases(cabs);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.1 });
        const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2 });
        this.screenMat = screenMaterial(this.atl);
        this.marqueeMat = marqueeMaterial(this.atl);
        const coinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a20).multiplyScalar(1.8), toneMapped: false });
        const mk = (geo, mat) => {
            const m = new THREE.InstancedMesh(geo, mat, n);
            m.frustumCulled = true;
            this.root.add(m);
            return m;
        };
        this.bodies = mk(parts.body, bodyMat);
        this.trims = mk(parts.trim, trimMat);
        this.screens = mk(parts.screen, this.screenMat);
        this.marquees = mk(parts.marquee, this.marqueeMat);
        this.coins = mk(parts.coin, coinMat);
        const aId = new Float32Array(n), aSeed = new Float32Array(n);
        const m = new THREE.Matrix4(), c = new THREE.Color();
        cabs.forEach((cab, i) => {
            m.makeRotationY(cab.rot).setPosition(cab.x, 0, cab.z);
            for (const mesh of [this.bodies, this.trims, this.screens, this.marquees, this.coins]) mesh.setMatrixAt(i, m);
            // the cabinet takes its genre's colour, a little different on each machine
            c.set(cab.genre.accent).lerp(new THREE.Color(cab.genre.accent2), cab.seed * 0.5).multiplyScalar(0.55 + cab.seed * 0.2);
            this.bodies.setColorAt(i, c);
            aId[i] = i;
            aSeed[i] = cab.seed;
        });
        for (const mesh of [this.screens, this.marquees]) {
            mesh.geometry.setAttribute('aId', new THREE.InstancedBufferAttribute(aId, 1));
            mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
        }
        this.hasAttr = new THREE.InstancedBufferAttribute(this.atl.has, 1);
        this.screens.geometry.setAttribute('aHas', this.hasAttr);
        this.marquees.geometry.setAttribute('aHas', this.hasAttr);
        // the bounds must cover every instance for the frustum test
        for (const mesh of [this.bodies, this.trims, this.screens, this.marquees, this.coins]) mesh.computeBoundingSphere();
        this.atl.onShot = () => (this.hasAttr.needsUpdate = true);
        this.atl.load();
        // a soft pool of light from every screen on the carpet in front of it
        const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.0, 1.1).rotateX(-Math.PI / 2).translate(0, 0.004, 0.9), new THREE.MeshBasicMaterial({ map: this._poolTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), n);
        cabs.forEach((cab, i) => {
            m.makeRotationY(cab.rot).setPosition(cab.x, 0, cab.z);
            pool.setMatrixAt(i, m);
            pool.setColorAt(i, c.set(cab.genre.accent2).multiplyScalar(0.35));
        });
        pool.computeBoundingSphere();
        this.root.add(pool);
    }

    _poolTex() {
        const c = canvas(64, 64);
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(32, 20, 2, 32, 26, 34);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }

    _signs() {
        this.signMeshes = [];
        for (const s of this.plan.signs) {
            const label = s.genre.short.toUpperCase() + (s.part ? ` ${s.part + 1}` : '');
            const t = neonTexture(label, s.genre.accent, { w: 1024, h: 160, size: 0.4 });
            const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
            const w = Math.max(3, s.w);
            for (const ry of [0, Math.PI]) {
                const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (160 / 1024)), mat);
                m.position.set(s.x, 3.25, s.z + (ry ? -0.02 : 0.02));
                m.rotation.y = ry;
                this.root.add(m);
            }
            // a black backing board and its chains
            const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, w * (160 / 1024) + 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0x050308 }));
            board.position.set(s.x, 3.25, s.z);
            this.root.add(board);
            for (const sx of [-1, 1]) {
                const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, HALL_H - 3.4), new THREE.MeshBasicMaterial({ color: 0x333340 }));
                ch.position.set(s.x + sx * w * 0.42, (HALL_H + 3.4) / 2, s.z);
                this.root.add(ch);
            }
        }
        const { bowling, disco, counter, hall } = this.plan;
        const big = (text, col, x, y, z, ry, w, opts = {}) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: neonTexture(text, col, opts), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
            m.position.set(x, y, z);
            m.rotation.y = ry;
            this.root.add(m);
            return m;
        };
        big('BOWL-O-RAMA', '#30e8ff', (bowling.x0 + bowling.x1) / 2, 5.0, bowling.headZ - 0.5, 0, Math.min(8, bowling.x1 - bowling.x0), { sub: 'STRIKE IT LUCKY', subColor: '#ff3fd0' });
        big('DISCO', '#ff3fd0', disco.x, 4.6, hall.z0 + 0.06, 0, 6, { sub: 'JUKEBOX ON THE EAST WALL', subColor: '#ffe94a' });
        big('PRIZES', '#5fff8f', (counter.x0 + counter.x1) / 2, 3.4, hall.z1 - 0.06, Math.PI, 4.5);
        big('JUKEBOX', '#ffe94a', this.plan.jukebox.x + 0.6, 3.3, this.plan.jukebox.z, -Math.PI / 2, 3);
    }

    _decor() {
        const { pillars, counter, tables } = this.plan;
        const dark = new THREE.MeshStandardMaterial({ color: 0x120c22, roughness: 0.5, metalness: 0.3 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xdde0ff, metalness: 1, roughness: 0.15 });
        for (const p of pillars) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, HALL_H, 16), dark);
            m.position.set(p.x, HALL_H / 2, p.z);
            this.root.add(m);
            for (const [y, k] of [[1.2, 0], [2.4, 1], [3.6, 0]]) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.02, 0.025, 6, 24).rotateX(Math.PI / 2), this.neonMats[k]);
                ring.position.set(p.x, y, p.z);
                this.root.add(ring);
            }
        }
        // the prize counter: a glass case and a wall of shelves full of plush
        const cw = counter.x1 - counter.x0, cxm = (counter.x0 + counter.x1) / 2;
        const caseM = new THREE.Mesh(new THREE.BoxGeometry(cw, 1.0, counter.z1 - counter.z0), new THREE.MeshStandardMaterial({ color: 0x8a7aff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2, emissive: 0x30205a, emissiveIntensity: 0.5 }));
        caseM.position.set(cxm, 0.5, (counter.z0 + counter.z1) / 2);
        this.root.add(caseM);
        const top = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.06, 0.05, counter.z1 - counter.z0 + 0.06), chrome);
        top.position.set(cxm, 1.02, (counter.z0 + counter.z1) / 2);
        this.root.add(top);
        const r = rng('prizes');
        const zBack = this.plan.hall.z1 - 0.35;
        for (let shelf = 0; shelf < 3; shelf++) {
            const sh = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.04, 0.5), dark);
            sh.position.set(cxm, 0.9 + shelf * 0.8, zBack);
            this.root.add(sh);
            for (let k = 0; k < Math.floor(cw / 0.4); k++) {
                const col = new THREE.Color(r.pick(NEON));
                const plush = new THREE.Mesh(new THREE.SphereGeometry(0.13 + r() * 0.06, 10, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }));
                plush.position.set(counter.x0 + 0.25 + k * 0.4, 1.05 + shelf * 0.8, zBack);
                plush.scale.y = 1.15;
                this.root.add(plush);
                for (const ex of [-1, 1]) {
                    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), plush.material);
                    ear.position.set(plush.position.x + ex * 0.09, plush.position.y + 0.15, zBack);
                    this.root.add(ear);
                }
            }
        }
        // café tables with stools round them
        for (const t of tables) {
            const top2 = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, 0.04, 20), chrome);
            top2.position.set(t.x, 0.95, t.z);
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8), chrome);
            leg.position.set(t.x, 0.47, t.z);
            this.root.add(top2, leg);
            for (let k = 0; k < 3; k++) {
                const a = (k / 3) * TAU + 0.5;
                const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 14), new THREE.MeshStandardMaterial({ color: new THREE.Color(NEON[k]).multiplyScalar(0.7), roughness: 0.4 }));
                seat.position.set(t.x + Math.sin(a) * 0.75, 0.7, t.z + Math.cos(a) * 0.75);
                const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), chrome);
                sl.position.set(seat.position.x, 0.35, seat.position.z);
                this.root.add(seat, sl);
            }
        }
    }

    _lights() {
        const q = this.env.quality?.tier ?? 'high';
        this.scene.add(new THREE.HemisphereLight(0x7a6aff, 0x1a0830, 0.9));
        const dl = new THREE.DirectionalLight(0xb0a0ff, 0.35);
        dl.position.set(-10, 20, 8);
        this.scene.add(dl);
        const n = q === 'low' ? 1 : q === 'medium' ? 2 : 3;
        const { AW } = this.plan;
        for (let k = 0; k < n; k++) {
            const l = new THREE.PointLight(k % 2 ? 0x30e8ff : 0xff3fd0, 5, 18, 1.3);
            l.position.set(-AW / 2 + ((k + 0.5) / n) * AW, 4.6, 0);
            this.scene.add(l);
        }
    }

    _redrawText() {
        // the atlases were drawn before the pixel font arrived: draw the text-only ones again
        const atl = buildAtlases(this.plan.cabinets);
        atl.disposed = true;   // these copies never fetch the stills
        this.screenMat.uniforms.uTitles.value.dispose();
        this.screenMat.uniforms.uTitles.value = atl.titles;
        this.marqueeMat.uniforms.uMap.value.dispose();
        this.marqueeMat.uniforms.uMap.value = atl.marquees;
        atl.shots.dispose();
        this.atl.titles = atl.titles;
        this.atl.marquees = atl.marquees;
    }

    // ------------------------------------------------------------ walking

    _grid() {
        const h = this.plan.hall;
        const C = 0.5;
        this.gc = C;
        this.gw = Math.ceil(h.w / C);
        this.gh = Math.ceil(h.d / C);
        this.cells = new Uint8Array(this.gw * this.gh);
        for (let j = 0; j < this.gh; j++) for (let i = 0; i < this.gw; i++) this.cells[j * this.gw + i] = walkablePlan(this.plan, h.x0 + (i + 0.5) * C, h.z0 + (j + 0.5) * C, 0.4) ? 1 : 0;
    }

    _clearLine(ax, az, bx, bz) {
        const d = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(d / 0.2);
        for (let k = 1; k < n; k++) if (!walkablePlan(this.plan, ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, 0.36)) return false;
        return true;
    }

    /** A walk through the aisles from (x0, z0) to (x1, z1): A* on a half-metre grid, then pulled straight. */
    path(x0, z0, x1, z1) {
        if (this._clearLine(x0, z0, x1, z1)) return [{ x: x1, z: z1 }];
        const h = this.plan.hall, C = this.gc, W = this.gw, H = this.gh;
        const cellOf = (x, z) => {
            let i = Math.floor((x - h.x0) / C), j = Math.floor((z - h.z0) / C);
            i = Math.max(0, Math.min(W - 1, i));
            j = Math.max(0, Math.min(H - 1, j));
            if (this.cells[j * W + i]) return j * W + i;
            // the nearest open cell
            for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
                const a = i + di, b = j + dj;
                if (a >= 0 && b >= 0 && a < W && b < H && this.cells[b * W + a]) return b * W + a;
            }
            return -1;
        };
        const s = cellOf(x0, z0), t = cellOf(x1, z1);
        if (s < 0 || t < 0) return null;
        const g = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1);
        const tx = t % W, tz = Math.floor(t / W);
        const heur = (c) => {
            const dx = Math.abs((c % W) - tx), dz = Math.abs(Math.floor(c / W) - tz);
            return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
        };
        // a binary heap of [f, cell]
        const heap = [];
        const push = (f, c) => {
            heap.push([f, c]);
            let k = heap.length - 1;
            while (k > 0) {
                const p = (k - 1) >> 1;
                if (heap[p][0] <= heap[k][0]) break;
                [heap[p], heap[k]] = [heap[k], heap[p]];
                k = p;
            }
        };
        const pop = () => {
            const top = heap[0], last = heap.pop();
            if (heap.length) {
                heap[0] = last;
                let k = 0;
                for (;;) {
                    const l = 2 * k + 1, r = l + 1;
                    let m = k;
                    if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                    if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                    if (m === k) break;
                    [heap[m], heap[k]] = [heap[k], heap[m]];
                    k = m;
                }
            }
            return top;
        };
        g[s] = 0;
        push(heur(s), s);
        const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
        let found = false;
        while (heap.length) {
            const [, c] = pop();
            if (c === t) {
                found = true;
                break;
            }
            const ci = c % W, cj = Math.floor(c / W);
            for (const [di, dj, cost] of N8) {
                const a = ci + di, b = cj + dj;
                if (a < 0 || b < 0 || a >= W || b >= H) continue;
                const nc = b * W + a;
                if (!this.cells[nc]) continue;
                if (di && dj && (!this.cells[cj * W + a] || !this.cells[b * W + ci])) continue;
                const ng = g[c] + cost;
                if (ng < g[nc]) {
                    g[nc] = ng;
                    from[nc] = c;
                    push(ng + heur(nc), nc);
                }
            }
        }
        if (!found) return null;
        const cells = [];
        for (let c = t; c !== -1; c = from[c]) cells.push(c);
        cells.reverse();
        const pts = cells.map((c) => ({ x: h.x0 + ((c % W) + 0.5) * C, z: h.z0 + (Math.floor(c / W) + 0.5) * C }));
        pts[pts.length - 1] = { x: x1, z: z1 };
        // pull the string: from each point, jump to the furthest one in plain sight
        const out = [];
        let cur = { x: x0, z: z0 }, k = 0;
        while (k < pts.length - 1) {
            let far = k + 1;
            for (let m = pts.length - 1; m > k + 1; m--) {
                if (this._clearLine(cur.x, cur.z, pts[m].x, pts[m].z)) {
                    far = m;
                    break;
                }
            }
            out.push(pts[far]);
            cur = pts[far];
            k = far;
        }
        if (!out.length) out.push(pts[pts.length - 1]);
        return out;
    }

    walkTo(x, z, extra = {}) {
        const p = this.controls.pos;
        const pts = this.path(p.x, p.z, x, z);
        if (!pts) return false;
        this.controls.walkTo(pts, extra.face);
        Object.assign(this.controls.route, extra);
        this.controls.route.run = Math.hypot(x - p.x, z - p.z) > 14;
        return true;
    }

    _arrive(r) {
        if (r.lane !== undefined) this.startBowling(r.lane);
        else if (r.jukebox) this.openJukebox();
        else if (r.fortune) this.fortune.ask();
        else if (r.claw) this.startClaw();
    }

    /** Bowling or at the claw: the walking controls are off and the view is the game's. */
    get busy() {
        return this.bowling.active || this.claw.active;
    }

    // ------------------------------------------------------------ in and out

    enter(controls) {
        this.controls = controls;
        controls.world = this.world;
        const s = this.spawn;
        controls.teleport(s.x, s.z, s.yaw);
        this.sound.enter();
        this.inside = true;
    }

    leave() {
        if (this.bowling.active) {
            this.stopBowling(true);
            this.controls.enabled = true;
            this.onBowling?.(false);
        }
        if (this.claw.active) this.stopClaw(true);
        this.fortune.leave();
        this.closeJukebox();
        this.sound.leave();
        this.env.ui.tooltip(null);
        this.inside = false;
        this.hoverId = -1;
    }

    // ------------------------------------------------------------ touching things

    _hit(ray) {
        const objs = [this.bodies, this.screens, this.marquees, ...this.disco.pickables, ...this.bowling.pickables, this.doorMesh, ...this.bowling.rackBalls, ...this.fortune.pickables, ...this.claw.pickables];
        const hit = ray.intersectObjects(objs, false)[0];
        if (!hit) return null;
        const o = hit.object;
        if (o === this.bodies || o === this.screens || o === this.marquees) return hit.distance < 30 ? { type: 'cabinet', cab: this.plan.cabinets[hit.instanceId], t: hit.distance } : null;
        if (o.userData.kind === 'jukebox') return { type: 'jukebox', t: hit.distance };
        if (o.userData.kind === 'fortune' || o.userData.kind === 'claw') return hit.distance < 40 ? { type: o.userData.kind, t: hit.distance } : null;
        if (o.userData.kind === 'lane') return { type: 'lane', lane: o.userData.lane, t: hit.distance };
        if (this.bowling.rackBalls.includes(o)) {
            // the nearest lane to the rack
            let best = 0, bd = Infinity;
            for (const L of this.plan.bowling.lanes) if (Math.abs(L.x - o.position.x) < bd) (bd = Math.abs(L.x - o.position.x)), (best = L.i);
            return { type: 'lane', lane: best, t: hit.distance };
        }
        if (o === this.doorMesh) return { type: 'door', t: hit.distance };
        return null;
    }

    _ground(ray) {
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y >= -1e-4) return null;
        const t = (0 - o.y) / d.y;
        const p = o.clone().addScaledVector(d, t);
        return { type: 'ground', point: p, t };
    }

    /** A click or tap. Returns what was touched, having done whatever touching it does. */
    tap(ray) {
        if (this.bowling.active) {
            this.bowling.tap();
            return { type: 'bowl' };
        }
        if (this.claw.active) return { type: 'claw' };
        const h = this._hit(ray);
        const env = this.env;
        if (h?.type === 'cabinet') {
            this.cardId = h.cab.id;
            env.showCard?.(h.cab.game);
            this.sound.coin();
            return h;
        }
        if (h?.type === 'jukebox') {
            const j = this.plan.jukebox;
            const p = this.controls.pos;
            if (Math.hypot(p.x - j.x, p.z - j.z) > 4) this.walkTo(j.x - 1.4, j.z, { face: -Math.PI / 2, jukebox: true });
            this.openJukebox();
            return h;
        }
        if (h?.type === 'fortune' || h?.type === 'claw') {
            const m = this.plan[h.type], s = m.stand;
            const p = this.controls.pos;
            const go = h.type === 'fortune' ? () => this.fortune.ask() : () => this.startClaw();
            env.ui.closeAll();
            if (Math.hypot(p.x - s.x, p.z - s.z) < 2.2) go();
            else if (!this.walkTo(s.x, s.z, { face: s.yaw, [h.type]: true })) go();
            return h;
        }
        if (h?.type === 'lane') {
            const L = this.plan.bowling.lanes[h.lane];
            const p = this.controls.pos;
            if (Math.hypot(p.x - L.stand.x, p.z - L.stand.z) < 9) this.startBowling(h.lane);
            else if (!this.walkTo(L.stand.x, L.stand.z, { lane: h.lane })) this.startBowling(h.lane);
            return h;
        }
        if (h?.type === 'door') {
            this.walkTo(this.exit.x, this.exit.z);
            return h;
        }
        const g = this._ground(ray);
        if (g && g.t < 60 && this.walkable(g.point.x, g.point.z)) {
            env.ui.closeAll();
            this.walkTo(g.point.x, g.point.z);
            return g;
        }
        return null;
    }

    /** The pointer is over something: highlight a cabinet and show its tooltip. Returns whether to show a hand. */
    hover(ray, mx, my) {
        if (this.bowling.active || this.claw.active) {
            this.hoverId = -1;
            this.env.ui.tooltip(null);
            return false;
        }
        const h = this._hit(ray);
        if (h?.type === 'cabinet') {
            this.hoverId = h.cab.id;
            this.env.ui.tooltip(h.cab.game, mx, my, 'Click the cabinet for its game card');
            return true;
        }
        if (h?.type === 'fortune' || h?.type === 'claw') {
            this.hoverId = -1;
            this.env.ui.note((h.type === 'fortune' ? this.fortune : this.claw).info(), mx, my);
            return true;
        }
        this.hoverId = -1;
        this.env.ui.tooltip(null);
        return !!h;
    }

    clearHover() {
        this.hoverId = -1;
        this.env.ui.tooltip(null);
    }

    stepSurface(p) {
        if (this.disco.onFloor(p.x, p.z)) return 'stone';
        const b = this.plan.bowling;
        if (p.x < b.x1 && p.z > b.foulZ && p.z < b.foulZ + 4.6) return 'wood';
        return 'grass';
    }

    // ------------------------------------------------------------ bowling

    startBowling(i) {
        if (this.bowling.active) return;
        this.closeJukebox();
        this.env.ui.closeAll();
        this.env.ui.tooltip(null);
        this.controls.route = null;
        this.controls.enabled = false;
        this.controls.keys.clear();
        this.bowling.start(i, this.controls);
        this.onBowling?.(true);
    }

    stopBowling(silent = false) {
        if (!this.bowling.active) return;
        const L = this.bowling.lane;
        this.bowling.stop();
        if (silent) return;
        const s = L.stand;
        this.controls.teleport(s.x, s.z + 0.6, s.yaw);
        this.controls.pitch = -0.1;
        this.controls.enabled = true;
        this.onBowling?.(false);
    }

    // ------------------------------------------------------------ the claw machine

    startClaw() {
        if (this.claw.active || this.bowling.active) return;
        this.closeJukebox();
        this.env.ui.closeAll();
        this.env.ui.tooltip(null);
        this.controls.route = null;
        this.controls.enabled = false;
        this.controls.keys.clear();
        this.claw.start(this.controls);
        this.onBusy?.(true);
    }

    stopClaw(silent = false) {
        if (!this.claw.active) return;
        this.claw.stop();
        if (silent) return;
        const s = this.plan.claw.stand;
        this.controls.teleport(s.x, s.z + 0.3, s.yaw);
        this.controls.pitch = -0.12;
        this.controls.enabled = true;
        this.onBusy?.(false);
    }

    // ------------------------------------------------------------ the jukebox

    _jukeDom() {
        const $ = (id) => document.getElementById(id);
        this.jukePanel = $('juke-panel');
        this.jukeList = $('juke-list');
        this.jukeNow = $('juke-now');
        if (!this.jukePanel) return;
        this.jukeList.innerHTML = SONGS.map((s, i) => `<button class="juke-song" data-song="${i}"><span class="js-code">${String.fromCharCode(65 + Math.floor(i / 2))}${(i % 2) + 1}</span><span class="js-t">${esc(s.title)}</span><span class="js-a">${esc(s.artist)}</span></button>`).join('');
        this._onJuke = (e) => {
            const b = e.target.closest('[data-song]');
            if (!b) return;
            this.play(Number(b.dataset.song));
        };
        this.jukeList.addEventListener('click', this._onJuke);
        $('juke-stop')?.addEventListener('click', () => this.stopMusic());
        $('juke-next')?.addEventListener('click', () => this.play((this.sound.index + 1) % SONGS.length));
        $('juke-close')?.addEventListener('click', () => this.closeJukebox());
        this._onKey = (e) => {
            if (e.key === 'Escape' && !this.jukePanel.hidden) this.closeJukebox();
        };
        addEventListener('keydown', this._onKey);
    }

    openJukebox() {
        if (!this.jukePanel) return;
        this.jukePanel.hidden = false;
        this._syncJuke();
    }

    closeJukebox() {
        if (this.jukePanel) this.jukePanel.hidden = true;
    }

    get jukeboxOpen() {
        return !!this.jukePanel && !this.jukePanel.hidden;
    }

    play(i) {
        this.sound.play(i);
        this.disco.setRecord(i);
        this._syncJuke();
        const s = SONGS[this.sound.index];
        this.env.ui.hint?.(`♪ Now playing: ${s.title} · ${s.artist}`, 4000);
    }

    stopMusic() {
        this.sound.stop();
        this._syncJuke();
    }

    _syncJuke() {
        if (!this.jukePanel) return;
        const i = this.sound.song ? this.sound.index : -1;
        this.jukeList.querySelectorAll('[data-song]').forEach((b) => b.classList.toggle('on', Number(b.dataset.song) === i));
        this.jukeNow.textContent = i >= 0 ? `Now playing: ${SONGS[i].title} — ${SONGS[i].artist} (${this.sound.song.bpm} bpm)` : 'Pick a record. The floor lights up when the music plays.';
    }

    // ------------------------------------------------------------ every frame

    update(dt, t) {
        this.time = t;
        const p = this.controls?.pos;
        const j = this.plan.jukebox;
        this.sound.update(dt, p ? Math.hypot(p.x - j.x, p.z - j.z) : 0);
        const beat = this.sound.beat();
        this.lastBeat = beat;
        this.disco.update(dt, t, beat, this.bowling.active ? null : p);
        this.bowling.update(dt, t);
        this.fortune.update(dt, t, this.busy ? null : p);
        this.claw.update(dt, t);
        this.screenMat.uniforms.uTime.value = t;
        this.marqueeMat.uniforms.uTime.value = t;
        const lit = this.hoverId >= 0 ? this.hoverId : this.env.ui.cardGame && this.cardId >= 0 && this.plan.cabinets[this.cardId]?.game === this.env.ui.cardGame ? this.cardId : -1;
        this.screenMat.uniforms.uHover.value = lit;
        this.marqueeMat.uniforms.uHover.value = lit;
        // the ceiling tubes breathe with the music
        const k = beat.playing ? 1.6 + beat.pulse * 1.4 : 2.2;
        this.neonMats[0].color.set(NEON[0]).multiplyScalar(k);
        this.neonMats[1].color.set(NEON[1]).multiplyScalar(beat.playing ? 1.6 + (1 - beat.pulse) * 1.2 : 2.2);
        // dancing: on the floor with a song on, the view bobs to the beat
        if (beat.playing && p && !this.busy && this.disco.onFloor(p.x, p.z) && this.controls.enabled) {
            this.env.camera.position.y += Math.sin(beat.beat * Math.PI * 2) * 0.03 * (0.6 + beat.pulse);
            this.dancing = (this.dancing || 0) + dt;
            if (this.dancing > 6 && !this.danceHint) {
                this.danceHint = true;
                this.env.ui.hint?.('Look at you go!', 3000);
            }
        }
    }

    dispose() {
        this.disposed = true;
        this.atl?.dispose();
        this.sound.dispose();
        if (this._onKey) removeEventListener('keydown', this._onKey);
        this.env.canvas?.removeEventListener('pointerup', this._onCanvasUp);
    }
}
