// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y, z) is world (x, z, −y): the boat sails toward −Z, the chase camera sits behind and above it.

import * as THREE from 'three';
import { ENEMIES, BOSSES, SECTOR_DATA } from '../sim/data.js';
import { riverAt } from '../sim/river.js';
import { JUMP, BOOSTS } from '../config.js';
import { Terrain, PALETTES, bankHeight } from './terrain.js';
import { FX } from './fx.js';
import { Craft, loadModels } from './models.js';
import { toon, addOutlines } from './toon.js';

const PICK = {
    cell: { color: 0x5cff8a, label: 'E' }, repair: { color: 0xff5a7a, label: '+' }, jump: { color: 0x5ab4ff, label: 'J' },
    overdrive: { color: 0xffb000, label: 'O' }, spread: { color: 0xff7ae0, label: 'S' }, plasma: { color: 0x7af7ff, label: 'P' },
    rapid: { color: 0xffe04a, label: 'R' }, shield: { color: 0x6fd0ff, label: 'B' }, magnet: { color: 0xc07aff, label: 'M' },
    core: { color: 0x9af6ff, label: '' },
};

function badgeTexture(label, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#14121f'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.beginPath(); g.arc(32, 32, 25, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(24, 22, 7, 0, Math.PI * 2); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1;
    g.font = 'bold 34px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#14121f'; g.strokeText(label, 32, 34);
    g.fillStyle = '#ffffff'; g.fillText(label, 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function fuelTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff3048'; g.fillRect(0, i * 32, 128, 32); }
    g.fillStyle = '#14121f'; g.fillRect(14, 80, 100, 96);
    g.fillStyle = '#ffe04a'; g.font = 'bold 40px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(64, 128); g.rotate(-Math.PI / 2); g.fillText('FUEL', 0, 0); g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class View {
    constructor(canvas, fxCanvas, popups) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0xcdeeff, 60, 160);
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);
        this.hemi = new THREE.HemisphereLight(0xd8f0ff, 0x6a8a6a, 1.35);
        this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
        this.sun.position.set(-20, 40, 18);
        this.scene.add(this.hemi, this.sun, this.sun.target);

        this.terrain = new Terrain(this.scene);
        this.fx = new FX(this.scene);
        loadModels('models/');

        // the boat, its shadow, its barrier
        this.boat = new Craft('hayate');
        this.scene.add(this.boat.group);
        this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x0a2a3a, transparent: true, opacity: 0.45, depthWrite: false }));
        this.shadow.renderOrder = 1;
        this.scene.add(this.shadow);
        this.bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 2),
            new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
        this.bubble.renderOrder = 8;
        this.scene.add(this.bubble);
        this.aura = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 16, 1, true).rotateX(Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        this.scene.add(this.aura);

        this.enemies = new Map();
        this.pickups = new Map();
        this.bridges = new Map();
        this.boss = null;
        this.bossMarks = [];
        this.badges = {};
        for (const k in PICK) if (PICK[k].label) this.badges[k] = new THREE.SpriteMaterial({ map: badgeTexture(PICK[k].label, PICK[k].color), depthTest: false });
        this.gemGeo = new THREE.OctahedronGeometry(0.75, 0);
        this.coreGeo = new THREE.OctahedronGeometry(0.45, 0);
        this.fuelTex = fuelTexture();
        this.barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 10).rotateZ(Math.PI / 2);
        this.barrelMat = toon(0xd04030);
        this.barrelMat2 = toon(0xf0c030);

        // 2D overlay: speed lines, hurt flash
        this.fx2d = fxCanvas;
        this.ctx2d = fxCanvas.getContext('2d');
        this.popups = popups;
        this.popPool = [];

        this.shake = 0;
        this.hurtT = 0;
        this.flashT = 0;
        this.camPos = new THREE.Vector3();
        this.camLook = new THREE.Vector3();
        this.camInit = false;
        this.palette = null;
        this.time = 0;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);
        this.fx2d.width = Math.round(w * dpr); this.fx2d.height = Math.round(h * dpr);
        this.fx2d.style.width = w + 'px'; this.fx2d.style.height = h + 'px';
        const aspect = w / h;
        this.camera.aspect = aspect;
        this.camera.fov = aspect < 0.8 ? 58 : 50;
        // back the camera off until ~34 m of river (26 m on a portrait phone) fits across the screen
        const hTan = Math.tan((this.camera.fov * Math.PI) / 360) * aspect;
        const want = aspect < 0.8 ? 13 : 19;
        this.camDist = Math.max(30, want / hTan);
        this.camera.far = this.camDist * 6;
        this.scene.fog.near = this.camDist * 1.5;
        this.scene.fog.far = this.camDist * 4.6;
        this.terrain.setFog(this.scene.fog.near, this.scene.fog.far);
        this.camera.updateProjectionMatrix();
        this.fx.glow.mat.uniforms.scale.value = this.fx.soft.mat.uniforms.scale.value = h * dpr * 0.6;
    }

    setPalette(name) {
        if (this.palette === name) return;
        this.palette = name;
        const p = PALETTES[name];
        this.terrain.setPalette(name);
        this.scene.fog.color.setHex(p.fog);
        this.renderer.setClearColor(p.sky);
        this.hemi.color.setHex(p.hemiSky); this.hemi.groundColor.setHex(p.hemiGround);
        this.sun.color.setHex(p.sun);
    }

    /** World position of a sim point, projected to CSS px (for popups). */
    toScreen(x, y, z = 1) {
        const v = new THREE.Vector3(x, z, -y).project(this.camera);
        return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h, on: v.z < 1 };
    }

    popup(x, y, text, cls = '') {
        const p = this.toScreen(x, y, 2);
        if (!p.on) return;
        let el = this.popPool.find((q) => !q.busy);
        if (!el) { el = { node: document.createElement('div'), busy: false }; this.popups.appendChild(el.node); this.popPool.push(el); }
        el.busy = true;
        el.node.className = 'pop ' + cls;
        el.node.textContent = text;
        el.node.style.left = p.x + 'px';
        el.node.style.top = p.y + 'px';
        el.node.style.animation = 'none';
        void el.node.offsetWidth;
        el.node.style.animation = '';
        clearTimeout(el.tm);
        el.tm = setTimeout(() => { el.busy = false; el.node.className = 'pop'; }, 900);
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        const fx = this.fx;
        for (const e of events) {
            switch (e.type) {
                case 'sector':
                    this.terrain.reset();
                    this.clearAll();
                    this.camInit = false;
                    break;
                case 'kill':
                    fx.explosion(e.x, e.y, 0.6, e.big ? 1.4 : 0.9);
                    this.shake = Math.max(this.shake, e.big ? 0.6 : 0.3);
                    this.popup(e.x, e.y, '+' + e.pts, e.mult > 1 ? 'mult' : '');
                    break;
                case 'boom': fx.explosion(e.x, e.y, 0.6, e.big ? 1.6 : 0.6); if (e.big) this.shake = Math.max(this.shake, 0.8); break;
                case 'hit': fx.spark(e.x, e.y); break;
                case 'spark': fx.spark(e.x, e.y, 1.4, 0xfff6a0, 3); break;
                case 'deflect': fx.spark(e.x, e.y, 1.6, 0x7ad8ff, 3); break;
                case 'hurt': this.hurtT = 0.35; this.shake = Math.max(this.shake, 0.9); fx.spark(G.boat.x, G.boat.y, 1, 0xff5050, 10); break;
                case 'shieldhit': fx.pickup(G.boat.x, G.boat.y, 0x6fd0ff); this.shake = Math.max(this.shake, 0.3); break;
                case 'jump': fx.splash(e.x, e.y, 1); break;
                case 'land':
                    fx.splash(e.x, e.y, 1.3);
                    if (e.shock) fx.shockwave(e.x, e.y, JUMP.shockRadius[e.shock] * 1.1);
                    this.shake = Math.max(this.shake, 0.35);
                    break;
                case 'pickup':
                    fx.pickup(e.x, e.y, PICK[e.kind]?.color || 0xffffff);
                    if (e.kind === 'core') this.popup(e.x, e.y, '◆' + e.value, 'core');
                    else this.popup(e.x, e.y, labelOf(e.kind), 'boost');
                    break;
                case 'bridge':
                    for (let i = -3; i <= 3; i++) fx.explosion(e.x + i * 4, e.y, 1.5, 0.9);
                    this.shake = 1.2;
                    this.popup(e.x, e.y, 'BRIDGE +500', 'big');
                    break;
                case 'partdown': fx.explosion(e.x, e.y, 1.5, 1.8); this.shake = 1.1; this.popup(e.x, e.y, 'BREAK!', 'big'); break;
                case 'phase': this.flashT = 0.35; this.shake = 1.4; break;
                case 'bossdown': this.flashT = 0.5; this.shake = 1.6; fx.explosion(e.x, e.y, 2, 3); break;
                case 'bosskill':
                    this.terrain.dropFrom(G.river.endY);
                    break;
                case 'cancel': fx.cancel(e.x, e.y); break;
                case 'tele': {
                    const en = G.enemies.find((q) => q.id === e.id);
                    if (en) fx.rings.spawn(en.x, 2.4, -en.y, { from: 0.4, to: 1.6, life: 0.35, color: 0xff3048 });
                    break;
                }
                case 'btele': fx.rings.spawn(e.x, 2.5, -e.y, { from: 0.6, to: 3.2, life: 0.4, color: 0xff3048 }); break;
                case 'lane': this.shake = Math.max(this.shake, 0.5); break;
                case 'over': fx.explosion(G.boat.x, G.boat.y, 0.6, 2); this.shake = 1.5; break;
            }
        }
    }

    clearAll() {
        for (const v of this.enemies.values()) this.scene.remove(v.obj);
        for (const v of this.pickups.values()) this.scene.remove(v.obj);
        for (const v of this.bridges.values()) this.scene.remove(v.obj);
        this.enemies.clear(); this.pickups.clear(); this.bridges.clear();
        if (this.boss) { this.scene.remove(this.boss.craft.group); for (const m of this.bossMarks) this.scene.remove(m); this.boss = null; this.bossMarks = []; }
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.time = time;
        this.resize();
        this.setPalette(SECTOR_DATA[G.sector].palette);
        this.terrain.update(G, time);
        const pal = PALETTES[this.palette];
        const b = G.boat;

        // ---- the boat
        const air = b.z > 0.05;
        const bob = air ? 0 : Math.sin(time * 9) * 0.06;
        this.boat.group.position.set(b.x, b.z + bob, -b.y);
        this.boat.body.rotation.z = -b.vx * 0.022;
        this.boat.body.rotation.x = air ? Math.max(-0.35, Math.min(0.35, b.vz * 0.03)) : -0.04 - (b.throttle > 0 ? 0.04 : 0);
        this.boat.group.rotation.y = -b.vx * 0.012;
        const blink = b.iframes > 0 && Math.floor(time * 20) % 2 === 0;
        this.boat.group.visible = !G.over && !blink;
        this.boat.flash(b.overdriveT > 0 ? 0.35 + Math.sin(time * 30) * 0.15 : 0, 0xffb000);
        const sh = 1.6 + b.z * 0.18;
        this.shadow.position.set(b.x, 0.06, -b.y);
        this.shadow.scale.set(sh * 0.9 / (1 + b.z * 0.08), 1, sh * 1.6 / (1 + b.z * 0.08));
        this.shadow.material.opacity = 0.45 / (1 + b.z * 0.25);
        this.shadow.visible = !G.over;
        this.bubble.visible = b.shield > 0 && !G.over;
        this.bubble.position.set(b.x, b.z + 1, -b.y);
        this.bubble.material.opacity = 0.18 + Math.sin(time * 6) * 0.06;
        this.bubble.rotation.y = time;
        this.aura.visible = b.overdriveT > 0 && !G.over;
        this.aura.position.set(b.x, b.z + 0.8, -b.y + 3);
        this.aura.material.opacity = 0.25 + Math.sin(time * 25) * 0.1;
        if (!G.over && G.phase !== 'dock') this.fx.wake(b, dt, air);

        // ---- enemies
        const seen = new Set();
        for (const e of G.enemies) {
            seen.add(e.id);
            let v = this.enemies.get(e.id);
            if (!v) { v = this.makeEnemy(e, pal); this.enemies.set(e.id, v); }
            this.placeEnemy(v, e, G, time, pal);
        }
        for (const [id, v] of this.enemies) if (!seen.has(id)) { this.scene.remove(v.obj); this.enemies.delete(id); }

        // ---- pickups
        const pseen = new Set();
        for (const p of G.pickups) {
            pseen.add(p.id);
            let v = this.pickups.get(p.id);
            if (!v) { v = this.makePickup(p); this.pickups.set(p.id, v); }
            v.obj.position.set(p.x, 1.1 + Math.sin(time * 4 + p.id) * 0.25, -p.y);
            v.gem.rotation.y = time * 3 + p.id;
        }
        for (const [id, v] of this.pickups) if (!pseen.has(id)) { this.scene.remove(v.obj); this.pickups.delete(id); }

        // ---- bridges
        const bseen = new Set();
        for (const br of G.bridges) {
            bseen.add(br.id);
            let v = this.bridges.get(br.id);
            if (!v) { v = this.makeBridge(br, pal); this.bridges.set(br.id, v); }
            if (br.down) {
                v.fall = (v.fall || 0) + dt;
                v.deck.position.y = Math.max(-3, 3.2 - v.fall * v.fall * 9);
                v.deck.rotation.z = Math.min(0.5, v.fall * 0.6) * (br.id % 2 ? 1 : -1);
            }
        }
        for (const [id, v] of this.bridges) if (!bseen.has(id)) { this.scene.remove(v.obj); this.bridges.delete(id); }

        // ---- boss
        this.frameBoss(G, dt, time);

        // ---- telegraphs: aim lines and laser lanes
        this.fx.beginLines();
        for (const e of G.enemies) {
            const d = ENEMIES[e.kind];
            if (!d.fire || e.tele <= 0) continue;
            const f = 1 - e.tele / d.fire.tele;
            const laser = !!d.fire.laser;
            const on = laser
                ? Math.sin(time * (18 + f * 10) + e.id) > -0.12
                : Math.floor(time * 16) % 2 === 0;
            if (on) this.fx.line(e.x, e.y, e.aim, laser ? 58 : 24,
                laser ? 0xff684a : 0xff6a3a,
                laser ? 0.035 + f * 0.035 : 0.3,
                laser ? 0.16 + f * 0.28 : 0.35 + f * 0.5);
        }
        if (G.boss) {
            const B = G.boss, d = BOSSES[B.key];
            d.phases[B.phase]?.patterns.forEach((p, i) => {
                const t = B.tele[B.phase][i];
                if (t <= 0 || p.p === 'lane' || p.p === 'ring') return;
                const part = B.parts.find((q) => q.id === p.from);
                if (!part || part.dead) return;
                const f = 1 - t / p.tele;
                if (Math.floor(time * 16) % 2 === 0) this.fx.line(B.x + part.dx, B.y + part.dy, B.aims[B.phase][i], 30, 0xff3048, 0.35 + f * 0.3, 0.3 + f * 0.5);
            });
        }
        for (const l of G.lanes) {
            const live = !!l.live;
            this.fx.lane(l.x, l.y0, b.y - 25, l.w, live, Math.min(1, l.t / l.tele), time);
        }
        this.fx.endLines();
        this.fx.frame(G, dt, time);

        // ---- camera
        const r = riverAt(G.river, b.y + 10);
        const tx = b.x * 0.75 + r.cx * 0.25;
        const D = this.camDist;
        // portrait screens look less far ahead, so the boat sits higher, clear of the thumbs
        const tall = this.camera.aspect < 0.8;
        const want = new THREE.Vector3(tx, D * 0.82 + b.z * 0.3, -(b.y - D * (tall ? 0.3 : 0.5)));
        const look = new THREE.Vector3(tx, 0, -(b.y + D * (tall ? 0.42 : 0.55)));
        if (!this.camInit) { this.camPos.copy(want); this.camLook.copy(look); this.camInit = true; }
        const k = Math.min(1, dt * 5);
        this.camPos.lerp(want, k);
        this.camLook.lerp(look, k);
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const s = this.shake * this.shake * 0.9 * (this.shakeScale ?? 1);
        this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z + (Math.random() - 0.5) * s);
        this.camera.lookAt(this.camLook);
        this.sun.position.set(b.x - 20, 40, -b.y + 18);
        this.sun.target.position.set(b.x, 0, -b.y);

        this.renderer.render(this.scene, this.camera);
        this.draw2d(G, dt, time);
    }

    makeEnemy(e, pal) {
        const obj = new THREE.Group();
        const v = { obj, kind: e.kind };
        if (e.kind === 'depot') {
            const pad = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 7.2), [toon(0xd0d4dc), toon(0xd0d4dc), new THREE.MeshToonMaterial({ map: this.fuelTex }), toon(0x30343c), toon(0xd0d4dc), toon(0xd0d4dc)]);
            pad.position.y = 0.2;
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 12), toon(0xffe04a));
            tank.position.set(1.1, 1.0, 2.4);
            obj.add(pad, tank);
            addOutlines(obj, 0.05);
        } else if (e.kind === 'blockade') {
            const n = Math.ceil((e.w * 2) / 1.6);
            for (let i = 0; i < n; i++) {
                const x = -e.w + i * 1.6 + 0.8;
                if (e.gap != null && Math.abs(x - e.gap * e.w) < 3.2) continue;
                const m = new THREE.Mesh(this.barrelGeo, i % 3 ? this.barrelMat : this.barrelMat2);
                m.position.set(x, 0.3, 0);
                m.rotation.y = i % 2 ? 0.08 : -0.08;
                obj.add(m);
            }
            const rope = new THREE.Mesh(new THREE.BoxGeometry(e.w * 2, 0.08, 0.08), toon(0x30241a));
            rope.position.y = 0.4;
            obj.add(rope);
            addOutlines(obj, 0.04);
        } else if (e.kind === 'tank') {
            // Tanks sit on a low cantilevered shelf. Its riverward edge hangs over
            // the channel so the boat can pass beneath and line up a clean shot.
            const side = e.side || 1;
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.05, 5.2), toon(0x777c82));
            shelf.position.set(-side * 1.35, 0, 0);
            const lip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 4.6), toon(0xa4a9bd));
            lip.position.set(-side * 3.0, 0.58, 0);
            const shadow = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.25, 4.7), toon(0x404852));
            shadow.position.set(-side * 1.5, -0.62, 0);
            v.craft = new Craft(e.kind);
            v.craft.group.position.set(-side * 3.0, 0.5, 0);
            obj.add(shadow, shelf, lip, v.craft.group);
            addOutlines(obj, 0.055);
        } else {
            v.craft = new Craft(e.kind);
            obj.add(v.craft.group);
        }
        this.scene.add(obj);
        return v;
    }

    placeEnemy(v, e, G, time, pal) {
        const d = ENEMIES[e.kind];
        let h = 0;
        if (e.kind === 'tank' && !e.onBridge) {
            h = 2.0;
        } else if (d.where === 'bank' && !e.onBridge) {
            const r = riverAt(G.river, e.y);
            h = bankHeight(pal, Math.abs(e.x - r.cx) - r.hw + 0.6, e.y, Math.sign(e.x - r.cx));
        } else if (e.onBridge) h = 3.6;
        const bob = d.where === 'water' ? Math.sin(time * 3 + e.id) * 0.1 : 0;
        v.obj.position.set(e.x, h + bob, -e.y);
        if (!v.craft) return;
        let yaw = 0;
        if (e.kind === 'raider' && e.mode === 'charge') yaw = Math.PI + Math.atan2(e.vx, -e.vy) * 0.6;
        else if (d.where === 'bank' || e.kind === 'gunboat') {
            const a = e.tele > 0 ? e.aim : Math.atan2(G.boat.y - e.y, G.boat.x - e.x);
            yaw = Math.atan2(-Math.cos(a), Math.sin(a));
        } else if (e.kind === 'mine') yaw = time * 0.8 + e.id;
        v.craft.group.rotation.y = yaw;
        v.craft.body.rotation.z = Math.sin(time * 2 + e.id) * 0.04;
        v.craft.flash(e.hit > 0 ? 0.55 : e.tele > 0 && Math.floor(time * 16) % 2 ? 0.35 : 0, e.hit > 0 ? 0xffffff : 0xff2020);
    }

    makePickup(p) {
        const obj = new THREE.Group();
        const c = PICK[p.kind] || PICK.core;
        const gem = new THREE.Mesh(p.kind === 'core' ? this.coreGeo : this.gemGeo, toon(c.color, { emissive: c.color, emissiveIntensity: 0.45 }));
        obj.add(gem);
        if (this.badges[p.kind]) {
            const sp = new THREE.Sprite(this.badges[p.kind]);
            sp.scale.set(1.5, 1.5, 1);
            sp.position.y = 1.5;
            sp.renderOrder = 9;
            obj.add(sp);
        }
        this.scene.add(obj);
        return { obj, gem };
    }

    makeBridge(br, pal) {
        const obj = new THREE.Group();
        const w = br.hw * 2 + 10;
        const deck = new THREE.Group();
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, 4.4), toon(0x9aa0ad));
        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.25), toon(0xd04030));
        rail1.position.set(0, 0.75, 2.1);
        const rail2 = rail1.clone(); rail2.position.z = -2.1;
        deck.add(slab, rail1, rail2);
        deck.position.y = 3.2;
        obj.add(deck);
        for (const s of [-1, -0.33, 0.33, 1]) {
            const pil = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 1.6), toon(0x7a808c));
            pil.position.set(s * (br.hw - 1), 1.2, 0);
            obj.add(pil);
        }
        addOutlines(obj, 0.05);
        obj.position.set(br.cx, 0, -br.y);
        this.scene.add(obj);
        return { obj, deck };
    }

    frameBoss(G, dt, time) {
        const B = G.boss;
        if (!B) {
            if (this.boss) {
                this.scene.remove(this.boss.craft.group);
                for (const m of this.bossMarks) this.scene.remove(m);
                this.boss = null; this.bossMarks = [];
            }
            return;
        }
        const d = BOSSES[B.key];
        if (!this.boss || this.boss.key !== B.key) {
            if (this.boss) this.scene.remove(this.boss.craft.group);
            const craft = new Craft(d.model);
            this.scene.add(craft.group);
            this.boss = { key: B.key, craft };
            for (const m of this.bossMarks) this.scene.remove(m);
            this.bossMarks = B.parts.map((p) => {
                const g = new THREE.Group();
                const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * 0.85, p.r, 32).rotateX(-Math.PI / 2),
                    new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0.8, depthTest: false, toneMapped: false }));
                ring.renderOrder = 9;
                const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(p.r * 1.15, 1),
                    new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.3, wireframe: true, toneMapped: false }));
                g.add(ring, shield);
                g.userData = { ring, shield };
                this.scene.add(g);
                return g;
            });
        }
        const craft = this.boss.craft;
        const sink = B.dying > 0 ? (d.mini ? 1.6 : 3) - B.dying : 0;
        craft.group.position.set(B.x, -sink * 1.2, -B.y);
        craft.body.rotation.z = Math.sin(time * 0.8) * 0.02 + sink * 0.08;
        craft.body.rotation.x = sink * 0.05;
        const od = d.phases[B.phase]?.overdrive;
        const hit = B.parts.some((p) => p.hit > 0);
        craft.flash(hit && Math.floor(time * 30) % 3 === 0 ? 0.28 : od ? 0.22 + Math.sin(time * 12) * 0.15 : 0, hit ? 0xffffff : 0xff2030);
        B.parts.forEach((p, i) => {
            const m = this.bossMarks[i];
            if (!m) return;
            const h = Math.max(2, craft.height * 0.6);
            m.position.set(B.x + p.dx, h, -(B.y + p.dy));
            const { ring, shield } = m.userData;
            const sh = !p.dead && p.role === 'core' && d.phases[B.phase]?.shielded;
            ring.visible = !p.dead && !sh && !B.entering && B.dying <= 0;
            ring.material.opacity = 0.5 + Math.sin(time * 8 + i) * 0.3;
            ring.scale.setScalar(1 + Math.sin(time * 6 + i) * 0.08);
            shield.visible = sh && B.dying <= 0;
            shield.rotation.y = time * 0.8;
            if (p.dead && Math.random() < dt * 14 && B.dying <= 0) {
                this.fx.soft.add(B.x + p.dx, h, -(B.y + p.dy), (Math.random() - 0.5) * 1.5, 3 + Math.random() * 2, 2, 1.3, 1.2, Math.random() < 0.5 ? 0x9a94a4 : 0xc4bece, { grow: 2, alpha: 0.6 });
                if (Math.random() < 0.4) this.fx.glow.add(B.x + p.dx, h, -(B.y + p.dy), (Math.random() - 0.5) * 2, 3, 0, 0.4, 0.6, 0xff7a1a, {});
            }
        });
    }

    // ------------------------------------------------------------------ 2D overlay
    draw2d(G, dt, time) {
        const g = this.ctx2d, W = this.fx2d.width, H = this.fx2d.height;
        g.clearRect(0, 0, W, H);
        const b = G.boat;
        // speed lines: always a few at speed, a storm in overdrive
        const fast = b.overdriveT > 0 ? 1 : Math.max(0, (b.speed - 19) / 6);
        if (fast > 0 && !G.over) {
            const n = Math.round(10 + fast * 50);
            g.strokeStyle = b.overdriveT > 0 ? 'rgba(255,240,200,0.75)' : 'rgba(255,255,255,0.45)';
            const cx = W / 2, cy = H * 0.42;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2;
                const r0 = Math.max(W, H) * (0.32 + Math.random() * 0.2);
                const len = Math.max(W, H) * (0.12 + Math.random() * 0.25) * fast;
                g.lineWidth = (1 + Math.random() * 3) * this.dpr;
                g.beginPath();
                g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
                g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
                g.stroke();
            }
        }
        // hurt: a red edge; low hull: a slow red pulse
        this.hurtT = Math.max(0, this.hurtT - dt);
        const low = !G.over && b.hull < G.stats.maxHull * 0.25 ? 0.25 + Math.sin(time * 6) * 0.15 : 0;
        const red = Math.max(this.hurtT * 2, low);
        if (red > 0) {
            const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
            grad.addColorStop(0, 'rgba(255,0,40,0)');
            grad.addColorStop(1, `rgba(255,0,40,${Math.min(0.6, red)})`);
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
        }
        this.flashT = Math.max(0, this.flashT - dt);
        if (this.flashT > 0) { g.fillStyle = `rgba(255,255,255,${this.flashT * 1.6})`; g.fillRect(0, 0, W, H); }
    }
}

function labelOf(kind) {
    return { cell: 'FUEL +30', repair: 'REPAIR', jump: 'JUMP READY', overdrive: 'OVERDRIVE!', spread: 'SPREAD SHOT', plasma: 'PLASMA', rapid: 'RAPID FIRE', shield: 'BARRIER', magnet: 'MAGNET' }[kind] || kind.toUpperCase();
}

export { BOOSTS };
