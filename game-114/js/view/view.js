// The three.js view: reads G every frame, draws the level, the cast and the effects, and turns sim
// events into sparks, blasts, shakes and flashes. Never changes G.
//
// Sim (x, y) maps straight to world (x, y); the level sits in the z = 0 plane and recedes to a back
// wall at z = −2.2. Actors are flat sprites in front of it, lit by a pool of point lights through
// normal maps made from their shapes.

import * as THREE from 'three';
import { LEVEL_H, PLAYER, WEAPONS } from '../config.js';
import { Stage } from './stage.js';
import { buildSprites, PPU } from './sprites.js';
import { World, DEPTH } from './world.js';
import { FX, colorOf, hexToRgb } from './fx.js';

const ZA = 0.02;          // actors
const ZB = 0.3;           // bullets and glows

// ---------------------------------------------------------------- sprites
function spriteMaterial(S) {
    const mat = new THREE.MeshStandardMaterial({
        map: S.map, normalMap: S.normal, emissiveMap: S.emissive, emissive: 0xffffff, emissiveIntensity: 1.8,
        roughness: 0.62, metalness: 0.1, alphaTest: 0.5, side: THREE.FrontSide,
    });
    mat.normalScale.set(1.4, 1.4);
    mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute float aFlash;\nvarying float vFlash;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlash = aFlash;');
        sh.fragmentShader = 'varying float vFlash;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.95, 0.9) * vFlash * 1.6;');
    };
    return mat;
}

class SpritePool {
    constructor(scene, mat, S, anchor) {
        this.scene = scene; this.mat = mat; this.S = S; this.anchor = anchor;
        this.items = []; this.i = 0;
    }
    make() {
        const g = new THREE.PlaneGeometry(1, 1);
        if (this.anchor === 'bottom') g.translate(0, 0.5, 0);
        else if (this.anchor === 'left') g.translate(0.5, 0, 0);
        g.setAttribute('aFlash', new THREE.BufferAttribute(new Float32Array(4), 1));
        const m = new THREE.Mesh(g, this.mat);
        m.frustumCulled = false;
        m.userData = { frame: null, flash: -1 };
        this.scene.add(m);
        return m;
    }
    begin() { this.i = 0; }
    draw(name, x, y, z = ZA, o = {}) {
        const f = this.S.frames[name];
        if (!f) return null;
        const m = this.items[this.i] || (this.items[this.i] = this.make());
        this.i++;
        m.visible = true;
        const ud = m.userData;
        if (ud.frame !== name) {
            ud.frame = name;
            const s = this.S.size;
            const u0 = f.x / s, u1 = (f.x + f.w) / s, v0 = 1 - (f.y + f.h) / s, v1 = 1 - f.y / s;
            const uv = m.geometry.attributes.uv;
            uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
            uv.needsUpdate = true;
        }
        const fl = o.flash || 0;
        if (ud.flash !== fl) {
            ud.flash = fl;
            const a = m.geometry.attributes.aFlash;
            a.array.fill(fl); a.needsUpdate = true;
        }
        const sc = o.scale ?? 1;
        m.scale.set((f.w / PPU) * sc * (o.flip ? -1 : 1), (f.h / PPU) * sc * (o.flipY ? -1 : 1), 1);
        m.position.set(x, y, z);
        m.rotation.z = o.rot || 0;
        return m;
    }
    end() { for (let j = this.i; j < this.items.length; j++) this.items[j].visible = false; }
}

const lerp = (a, b, t) => a + (b - a) * t;

export class View {
    constructor(canvas, settings = {}) {
        this.canvas = canvas;
        this.stage = new Stage(canvas, settings.quality ?? 2);
        this.scene = this.stage.scene;
        this.S = buildSprites();
        this.mat = spriteMaterial(this.S);
        this.spr = new SpritePool(this.scene, this.mat, this.S, 'bottom');
        this.sprC = new SpritePool(this.scene, this.mat, this.S, 'center');
        this.sprL = new SpritePool(this.scene, this.mat, this.S, 'left');
        this.world = new World(this.scene, this.stage.quality);
        this.fx = new FX(this.scene);
        this.L = null;
        this.cam = { x: 10, y: 8, init: false };
        this.shake = 0;
        this.ca = 0;
        this.hurt = 0;
        this.whiteout = 0;
        this.extras = [];         // view-only actors: rescued colonists waving, falling debris
        this.shakeOn = settings.shake !== false;
        this.reduced = !!window.A11Y?.reducedMotion;
        this.flicker = new Map();
        this.time = 0;
        this.setQuality(this.stage.quality);
        const onResize = () => this.stage.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setQuality(q) {
        this.stage.setQuality(q);
        this.fx.amount = [0.45, 0.8, 1][q];
    }
    setShake(on) { this.shakeOn = on; }

    // ------------------------------------------------------------ level
    setLevel(L) {
        this.L = L;
        this.world.build(L);
        const pal = this.world.pal;
        this.stage.hemi.color.setHex(pal.amb);
        this.stage.hemi.groundColor.setHex(pal.ground);
        this.stage.hemi.intensity = L.theme === 'ship' ? 0.5 : 0.75;
        this.stage.key.intensity = L.theme === 'ship' ? 0.25 : 0.45;
        this.stage.renderer.setClearColor(new THREE.Color(pal.sky[0]));
        this.cam.init = false;
        this.fx.parts.length = 0;
        this.extras.length = 0;
        // static light sources: lamps and glowing acid
        this.statics = [];
        for (const l of L.lamps) {
            const ship = L.theme === 'ship';
            this.statics.push({ x: l.x, y: ship ? Math.min(l.y, 12.6) : l.y, z: -0.5, color: pal.lamp, intensity: ship ? 12 : 9, dist: 11, pri: 2, lamp: true, seed: (l.x * 7.3) % 1 });
        }
        for (const a of this.world.acidSpots) this.statics.push({ x: a.x, y: a.y + 0.3, z: 0.6, color: 0x9aff3a, intensity: 5, dist: 5, pri: 1.2 });
    }

    // ------------------------------------------------------------ events
    kick(s, ca = 0) {
        if (!this.reduced && this.shakeOn) this.shake = Math.max(this.shake, s);
        this.ca = Math.max(this.ca, ca);
    }

    onEvents(G, events) {
        const fx = this.fx;
        for (const e of events) {
            switch (e.type) {
                case 'shot': fx.muzzle(e.x, e.y, e.ax, e.ay, e.k); if (e.k === 'rocket') this.kick(0.08); break;
                case 'spark': fx.spark(e.x, e.y, e.k); break;
                case 'ehit': fx.hit(e.x, e.y, e.k); break;
                case 'kill': {
                    if (e.k === 'missile') { fx.explosion(e.x, e.y, 0.8, 'missile'); break; }
                    const big = e.k === 'brute' || e.k === 'nest' ? 2 : 1;
                    fx.gore(e.x, e.y, e.k, big);
                    this.kick(0.12 * big);
                    break;
                }
                case 'boom': fx.explosion(e.x, e.y, Math.min(2.6, e.r * 0.8), e.kind); this.kick(Math.min(0.9, e.r * 0.22), e.r * 0.2); break;
                case 'hurt': if (e.god) break; this.kick(0.35, 0.9); this.hurt = 1; fx.emit(10, { x: e.x, y: e.y, speed: 6, life: 0.4, size: 0.08, color: 0xff5a4a, k: 2.5, g: 12 }); break;
                case 'die': fx.gore(e.x, e.y, 'turret', 2); fx.explosion(e.x, e.y, 1.2, 'rocket'); this.kick(0.8, 1.2); this.whiteout = 0.4; break;
                case 'respawn': fx.rescue(e.x, e.y); break;
                case 'rescue': fx.rescue(e.x, e.y); this.extras.push({ k: 'colonist', x: e.x, y: e.y, t: 0, max: 1.6 }); break;
                case 'podHit': fx.emit(6, { x: e.x, y: e.y, speed: 4, life: 0.3, size: 0.08, color: 0xffd28a, k: 2, g: 10 }); break;
                case 'pickup': fx.ring(e.x, e.y, 1.2, colorOf(e.k === 'med' ? 'med' : e.k === 'flare' ? 'flare' : e.k), 0.4); fx.emit(20, { x: e.x, y: e.y, speed: 5, life: 0.5, size: 0.07, color: colorOf(e.k === 'med' ? 'med' : 'gold'), k: 3 }); break;
                case 'jump': fx.dust(e.x, e.y, 4, 0.8); break;
                case 'land': if (e.v > 10) fx.dust(e.x, e.y, Math.min(10, e.v / 3), 1); break;
                case 'splash': case 'esplash':
                    if (e.k === 'acid' || e.type === 'splash') fx.acid(e.x, e.y, 10);
                    else fx.spark(e.x, e.y, e.k || 'bolt');
                    break;
                case 'vent': fx.steam(e.x, e.y); break;
                case 'flareThrow': fx.emit(6, { x: e.x, y: e.y, speed: 3, life: 0.3, size: 0.06, color: 0xffb060, k: 3 }); break;
                case 'flareBounce': fx.emit(5, { x: e.x, y: e.y, speed: 5, life: 0.3, size: 0.06, color: 0xffb060, k: 3, g: 12 }); break;
                case 'cleared': fx.ring(e.x, e.y, 3.4, 0xffd080, 0.5, 0.2); break;
                case 'bossIntro': this.kick(0.6, 0.8); break;
                case 'bhit': {
                    const B = G.boss;
                    if (!B) break;
                    const bx = B.x + (Math.random() - 0.5) * B.w * 0.6, by = B.y + Math.random() * Math.max(1, B.h) * 0.8;
                    fx.emit(3, { x: bx, y: by, speed: 5, life: 0.25, size: 0.07, color: 0xfff0c0, k: 3, g: 10 });
                    break;
                }
                case 'slam': this.kick(e.big ? 1.0 : 0.5, 0.4); fx.dust(e.x, e.y, 24, 3); fx.ring(e.x, e.y + 0.3, 3, 0xffc080, 0.4); break;
                case 'rumble': fx.dust(e.x + (Math.random() - 0.5) * 2, 2, 3, 2); this.kick(0.12); break;
                case 'erupt': fx.dust(e.x, 2, 30, 4); this.kick(0.9, 0.5); fx.emit(20, { x: e.x, y: 2.3, dir: Math.PI / 2, spread: 1.2, speed: 12, life: 0.9, size: 0.14, color: 0x6a5a48, add: false, g: 26, shape: 2 }); break;
                case 'ring': fx.flash(e.x, e.y, 0xff8a3a, 40, 0.25); fx.ring(e.x, e.y, 1.8, 0xff8a3a, 0.3); break;
                case 'bossDown': fx.explosion(e.x, e.y, 3, 'boss'); this.kick(1.4, 1.6); this.whiteout = 0.7; break;
                case 'phase': this.kick(0.7, 1.2); fx.ring(e.x, e.y, 5, 0xff5ac8, 0.6, 0.25); this.whiteout = 0.25; break;
                case 'beam': this.kick(0.6, 0.8); break;
                case 'checkpoint': fx.ring(e.x, e.y + 1.5, 2.2, 0x6cff9a, 0.6); fx.emit(24, { x: e.x, y: e.y + 2, speed: 4, life: 0.8, size: 0.07, color: 0x6cff9a, k: 3 }); break;
                case 'hatch': fx.gore(e.x, e.y, 'nest', e.big ? 1 : 0.5); break;
                case 'launch': fx.emit(16, { x: e.x, y: e.y, dir: Math.PI / 2, spread: 2, speed: 4, life: 0.8, size: 0.35, grow: 1.5, color: 0x5a5060, add: false, alpha: 0.5 }); break;
                case 'spit': fx.emit(e.big ? 14 : 6, { x: e.x, y: e.y, dir: Math.PI / 2, spread: 1.6, speed: 4, life: 0.4, size: 0.08, color: 0xb8ff3c, k: 2.5, g: 16 }); break;
                case 'eshot': fx.emit(4, { x: e.x, y: e.y, speed: 4, life: 0.12, size: 0.08, color: 0xff6a4a, k: 3 }); fx.flash(e.x, e.y, 0xff4a3a, 10, 0.08, 6); break;
                case 'roar': case 'charge': this.kick(e.k === 'queen' ? 0.8 : 0.3, 0.3); break;
                case 'supply': fx.rescue(e.x, e.y); break;
                case 'fall': this.kick(0.3); break;
                case 'warn': if (e.k === 'beam') fx.flash(e.x, e.y, 0xff3ac8, 30, 0.9, 12); break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.time = time;
        if (G.level !== this.L) this.setLevel(G.level);
        this.stage.resize();
        const L = this.L, p = G.player, st = this.stage;
        const fx = this.fx;

        // ---- camera: ahead of the player, inside the level; centred on a locked arena
        const vw = st.viewW, vh = st.viewH;
        let tx = p.x + p.face * Math.min(3, vw * 0.12), ty = p.y + 2.2;
        if (G.arenaLocked && L.arena) { tx = (L.arena.x0 + L.arena.x1) / 2; ty = Math.max(ty, 2 + vh / 2 - 1.2); }
        const top = L.theme === 'ship' ? 15.2 : LEVEL_H + 3;
        tx = Math.max(vw / 2, Math.min(L.w - vw / 2, tx));
        ty = Math.max(vh / 2 - 0.4, Math.min(top - vh / 2, ty));
        if (vh / 2 - 0.4 > top - vh / 2) ty = (vh / 2 - 0.4 + top - vh / 2) / 2;
        if (!this.cam.init) { this.cam.x = tx; this.cam.y = ty; this.cam.init = true; }
        const k = 1 - Math.exp(-dt * (G.arenaLocked ? 3 : 6));
        this.cam.x = lerp(this.cam.x, tx, k);
        this.cam.y = lerp(this.cam.y, ty, 1 - Math.exp(-dt * 3));
        this.shake = Math.max(0, this.shake - dt * 2.2);
        st.shake = this.shake;
        st.place(this.cam.x, this.cam.y, time);
        this.ca = Math.max(0, this.ca - dt * 3);
        this.hurt = Math.max(0, this.hurt - dt * 2);
        this.whiteout = Math.max(0, this.whiteout - dt * 2);
        const g = st.grade.uniforms;
        const low = !p.dead && p.hp <= 1 ? 0.35 + 0.25 * Math.sin(time * 6) : 0;
        g.uAberr.value = this.ca;
        g.uHurt.value = Math.max(this.hurt, low);
        const w = 1 + this.whiteout * 1.5;
        g.uTint.value.setRGB(w, w, w);

        this.world.frame(time, this.cam.x);
        fx.update(dt);
        this.spr.begin(); this.sprC.begin(); this.sprL.begin();
        fx.add.begin(); fx.alpha.begin();
        const lights = [];
        const A = fx.add;

        // ---- static scenery sprites: lamps, the cryo pod you woke in, beacons, the exit, vents
        const ship = L.theme === 'ship';
        for (const s of this.statics) {
            if (Math.abs(s.x - this.cam.x) > vw / 2 + 6) continue;
            let inten = s.intensity;
            if (s.lamp) {
                // a few ship lamps stutter
                const flick = ship && s.seed > 0.75 ? (Math.sin(time * 23 + s.seed * 50) > 0.6 || Math.sin(time * 3.1 + s.seed * 9) > 0.92 ? 0.15 : 1) : 1;
                inten *= flick;
                this.sprC.draw(ship ? 'lamp' : 'lampAlien', s.x, s.y + (ship ? 0.25 : 0), -DEPTH + 0.06, {});
                const [r, gg, b] = hexToRgb(s.color, 1.6 * flick);
                A.blob(s.x, s.y, -DEPTH + 0.1, 1.3, r * 0.3, gg * 0.3, b * 0.3, 0.35);
                A.blob(s.x, s.y, -DEPTH + 0.12, 0.3, r * 0.8, gg * 0.8, b * 0.8, 0.8);
            } else if (Math.random() < dt * 3) fx.emit(1, { x: s.x + (Math.random() - 0.5) * 2.5, y: s.y - 0.4, dir: Math.PI / 2, spread: 0.6, speed: 0.8, life: 0.8, size: 0.06, color: 0xb8ff3c, k: 2.5, g: -0.5 });
            lights.push({ ...s, intensity: inten });
        }
        if (L.idx === 0) this.spr.draw('cryoPod', 1.6, 2, -1.0, {});
        L.checkpoints.forEach((c, i) => {
            const on = i <= G.cpIdx;
            this.spr.draw(on ? 'beacon1' : 'beacon0', c.x, c.y, -0.8, {});
            if (on) { A.blob(c.x, c.y + 1.85, -0.6, 0.7, 0.4, 2, 1, 0.8 + 0.2 * Math.sin(time * 5)); lights.push({ x: c.x, y: c.y + 1.9, z: 0.5, color: 0x5aff9a, intensity: 8, dist: 6, pri: 1.5 }); }
        });
        if (L.exit) {
            const open = Math.abs(p.x - L.exit.x) < 7;
            this.spr.draw(open ? 'door1' : 'door0', L.exit.x + 0.6, L.exit.y, -1.2, {});
            lights.push({ x: L.exit.x + 0.6, y: L.exit.y + 1.8, z: 0.4, color: open ? 0x6cff9a : 0xff4a3a, intensity: open ? 30 : 10, dist: 9, pri: 2.5 });
        }
        for (const v of G.vents) {
            this.spr.draw('vent', v.x, v.y - 0.1, ZA + 0.01, {});
            if (v.on) { if (Math.random() < dt * 30) fx.steam(v.x, v.y); A.quad(v.x, v.y + 1.5, ZB, 0, 1, 1.6, 0.45, 0.5, 0.55, 0.6, 0.35, 3); }
            else if (v.warn && Math.random() < dt * 12) fx.emit(1, { x: v.x, y: v.y + 0.2, dir: Math.PI / 2, spread: 0.5, speed: 2, life: 0.4, size: 0.2, grow: 0.8, color: 0xd8e0f0, add: false, alpha: 0.3 });
        }

        // ---- pickups and pods
        for (const pk of G.pickups) {
            if (pk.taken) continue;
            if (Math.abs(pk.x - this.cam.x) > vw / 2 + 3) continue;
            const bob = pk.float ? Math.sin(time * 3 + pk.id) * 0.15 : 0;
            const name = pk.k === 'med' ? 'med' : pk.k === 'flare' ? 'flarepack' : 'cap_' + pk.k;
            const y = pk.y - (pk.float ? 0.4 : 0) + bob;
            this.spr.draw(name, pk.x, y, ZA, {});
            const c = hexToRgb(colorOf(pk.k === 'med' ? 'med' : pk.k === 'flare' ? 'flare' : pk.k), 1.4);
            A.blob(pk.x, y + 0.4, ZB - 0.2, 0.9, c[0], c[1], c[2], 0.35 + 0.15 * Math.sin(time * 4));
            lights.push({ x: pk.x, y: y + 0.5, z: 0.8, color: colorOf(pk.k === 'med' ? 'med' : pk.k), intensity: 6, dist: 4, pri: 1 });
        }
        for (const pod of G.pods) {
            if (Math.abs(pod.x - this.cam.x) > vw / 2 + 3) continue;
            const beat = Math.sin(time * 5 + pod.x) > 0.3;
            this.spr.draw(pod.open ? 'pod2' : beat ? 'pod1' : 'pod0', pod.x, pod.y, ZA - 0.01, { flash: pod.flash > 0 ? 1 : 0 });
            if (!pod.open) {
                lights.push({ x: pod.x, y: pod.y + 1, z: 0.8, color: 0xffb347, intensity: beat ? 7 : 3, dist: 4, pri: 1.6 });
                A.blob(pod.x, pod.y + 1.2, ZB - 0.25, 0.8, 1.2, 0.7, 0.2, beat ? 0.35 : 0.15);
            }
        }

        // ---- enemies
        for (const e of G.enemies) {
            if (Math.abs(e.x - this.cam.x) > vw / 2 + 4) continue;
            const fl = e.flash > 0 ? 1 : 0;
            const flip = e.face < 0;
            switch (e.k) {
                case 'skitter': this.spr.draw('skitter' + (e.ground ? Math.floor(e.t * 12) % 3 : 1), e.x, e.y - 0.05, ZA, { flip, flash: fl }); break;
                case 'hiveling': this.spr.draw('hiveling' + Math.floor(e.t * 14) % 2, e.x, e.y - 0.05, ZA, { flip, flash: fl }); break;
                case 'wisp': {
                    this.sprC.draw('wisp' + Math.floor(e.t * 8) % 3, e.x, e.y + 0.3, ZA, { flip, flash: fl });
                    A.blob(e.x, e.y + 0.4, ZB - 0.1, 1.2, 0.2, 0.9, 1.2, 0.35);
                    lights.push({ x: e.x, y: e.y + 0.4, z: 0.7, color: 0x6ae8ff, intensity: 8, dist: 5, pri: 1.4 });
                    break;
                }
                case 'spitter': this.spr.draw('spitter' + (e.st > 0 ? 1 : 0), e.x, e.y, ZA, { flip, flash: fl }); break;
                case 'turret': {
                    this.spr.draw('turret', e.x, e.y, ZA, { flash: fl });
                    const a = e.aim ?? Math.PI;
                    this.sprL.draw('turretGun', e.x, e.y + 0.55, ZA + 0.01, { rot: a, flipY: Math.cos(a) < 0, flash: fl });
                    lights.push({ x: e.x, y: e.y + 0.6, z: 0.6, color: 0xff3b30, intensity: 3, dist: 3, pri: 0.8 });
                    break;
                }
                case 'brute': this.spr.draw('brute' + (e.state === 'wind' || e.state === 'charge' ? 3 : e.ground && e.vx ? Math.floor(e.t * 6) % 3 : 0), e.x, e.y - 0.05, ZA, { flip, flash: fl }); break;
                case 'nest': {
                    this.spr.draw('nest' + (e.st > 0 || Math.sin(time * 4 + e.id) > 0.6 ? 1 : 0), e.x, e.y - 0.05, ZA, { flash: fl });
                    lights.push({ x: e.x, y: e.y + 0.8, z: 0.7, color: 0xff5ac8, intensity: 6, dist: 4, pri: 1.2 });
                    break;
                }
                case 'missile': {
                    const a = Math.atan2(e.vy, e.vx);
                    this.sprC.draw('missile', e.x, e.y, ZA, { rot: a, flash: fl });
                    if (Math.random() < 0.4) fx.emit(1, { x: e.x - Math.cos(a) * 0.4, y: e.y - Math.sin(a) * 0.4, speed: 0.5, life: 0.45, size: 0.15, grow: 0.6, color: 0x7a7080, add: false, alpha: 0.35 });
                    A.blob(e.x - Math.cos(a) * 0.4, e.y - Math.sin(a) * 0.4, ZB, 0.35, 2.5, 1.6, 0.4, 0.9);
                    lights.push({ x: e.x, y: e.y, z: 0.6, color: 0xffb040, intensity: 6, dist: 4, pri: 1 });
                    break;
                }
            }
        }

        // ---- the boss
        const B = G.boss;
        if (B) this.drawBoss(G, B, time, lights);

        // ---- the player
        if (!p.dead) {
            const blink = p.inv > 0 && G.phase === 'play' && Math.floor(time * 14) % 2 === 0 && p.inv < PLAYER.iframes + 1;
            if (!blink) {
                let name;
                if (p.inv > PLAYER.iframes - 0.22 && p.inv <= PLAYER.iframes) name = 'p_hurt';
                else if (!p.ground) name = p.vy > 0 ? 'p_jump' : 'p_fall';
                else if (p.crouch) name = 'p_crouch';
                else if (Math.abs(p.vx) > 0.1) name = 'p_run' + (Math.floor(p.runT * 9) % 6);
                else name = 'p_idle' + (Math.floor(time * 1.6) % 2);
                const flip = p.face < 0;
                this.spr.draw(name, p.x, p.y - 0.06, ZA + 0.02, { flip });
                const sy = p.crouch ? 0.55 : 1.12;
                const ang = Math.atan2(p.aim.y, p.aim.x);
                const kick = p.fireT > 0 ? -0.08 : 0;
                this.sprL.draw('gun_' + p.weapon, p.x + p.face * 0.05 + Math.cos(ang) * kick, p.y + sy - 0.02 + Math.sin(ang) * kick, ZA + 0.04, { rot: ang, flipY: Math.cos(ang) < -0.01 || (Math.abs(Math.cos(ang)) < 0.01 && p.face < 0) });
            }
            // suit lamp: the light that follows you through the dark
            lights.push({ x: p.x + p.face * 1.2, y: p.y + 1.6, z: 2.4, color: 0xffeedd, intensity: 6, dist: 8, pri: 12 });
            const [vr, vg, vb] = hexToRgb(0x62f4ff, 1.2);
            A.blob(p.x + p.face * 0.3, p.y + (p.crouch ? 1.1 : 1.6), ZB, 0.3, vr, vg, vb, 0.18);
        }

        // ---- bullets
        for (const b of G.pbul) {
            const sp = Math.hypot(b.vx, b.vy) || 1, dx = b.vx / sp, dy = b.vy / sp;
            const [r, gg, bb] = hexToRgb(colorOf(b.k), 2.2);
            if (b.k === 'rocket') {
                this.sprC.draw('missile', b.x, b.y, ZB - 0.05, { rot: Math.atan2(dy, dx), scale: 0.9 });
                A.blob(b.x - dx * 0.45, b.y - dy * 0.45, ZB, 0.45, 3, 1.6, 0.5, 1);
                if (Math.random() < 0.5) fx.emit(1, { x: b.x - dx * 0.5, y: b.y - dy * 0.5, speed: 0.6, life: 0.5, size: 0.15, grow: 0.6, color: 0x6a6070, add: false, alpha: 0.35 });
                lights.push({ x: b.x, y: b.y, z: 0.8, color: 0xff8a3a, intensity: 12, dist: 6, pri: 2 });
            } else if (b.k === 'laser') {
                A.quad(b.x - dx * 0.9, b.y - dy * 0.9, ZB, dx, dy, 1.1, 0.16, r, gg, bb, 1, 3);
                A.quad(b.x - dx * 0.9, b.y - dy * 0.9, ZB + 0.01, dx, dy, 1.0, 0.05, 3, 3, 3, 1, 3);
                lights.push({ x: b.x, y: b.y, z: 0.8, color: 0xc88aff, intensity: 9, dist: 5, pri: 1.6 });
            } else {
                // fresh shots fade in, so a spread volley doesn't stack into one white blob at the muzzle
                const age = WEAPONS[b.k].life - b.life;
                const k = Math.min(1, 0.25 + age * 12) * (b.k === 'spread' ? 0.7 : 1);
                const len = b.k === 'spread' ? 0.22 : 0.32;
                A.quad(b.x - dx * len, b.y - dy * len, ZB, dx, dy, len + 0.08, 0.11, r, gg, bb, 0.9 * k, 0);
                A.quad(b.x - dx * len * 0.6, b.y - dy * len * 0.6, ZB + 0.01, dx, dy, len * 0.6, 0.035, 1.8, 1.8, 1.8, k, 0);
            }
        }
        // a few bullet lights (the blaster's stream lights the corridor as it goes)
        for (let i = 0; i < G.pbul.length; i += 3) {
            const b = G.pbul[i];
            if (b.k === 'blaster' || b.k === 'spread') lights.push({ x: b.x, y: b.y, z: 0.7, color: colorOf(b.k), intensity: 4, dist: 4, pri: 0.9 });
        }
        for (const b of G.ebul) {
            const c = hexToRgb(colorOf(b.k), 1.7);
            if (b.k === 'egg') {
                this.sprC.draw('egg', b.x, b.y, ZB - 0.05, { rot: time * 6 });
                A.blob(b.x, b.y, ZB, 0.45, c[0], c[1], c[2], 0.5);
            } else if (b.k === 'acid') {
                A.blob(b.x, b.y, ZB, 0.36, c[0], c[1], c[2], 1, 2);
                A.blob(b.x, b.y, ZB - 0.01, 0.7, c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, 0.8, 0);
                if (Math.random() < 0.3) fx.emit(1, { x: b.x, y: b.y, speed: 0.4, life: 0.4, size: 0.06, color: 0xb8ff3c, k: 2, g: 10 });
            } else {
                const sp = Math.hypot(b.vx, b.vy) || 1;
                A.quad(b.x, b.y, ZB, b.vx / sp, b.vy / sp, 0.32, 0.17, c[0], c[1], c[2], 1, 0);
                A.blob(b.x, b.y, ZB + 0.01, 0.1, 3, 3, 3, 1, 2);
            }
        }
        for (let i = 0; i < G.ebul.length; i += 2) {
            const b = G.ebul[i];
            lights.push({ x: b.x, y: b.y, z: 0.6, color: colorOf(b.k), intensity: 4, dist: 3.5, pri: 0.7 });
        }
        // ---- flares: a fizzing stick that lights the whole room, then a bang
        for (const f of G.flares) {
            this.sprC.draw('flare', f.x, f.y, ZB - 0.05, { rot: time * 10 });
            const fl = 0.8 + Math.random() * 0.4;
            A.blob(f.x, f.y, ZB, 1.2 * fl, 2.6, 0.9, 0.35, 0.8);
            A.blob(f.x, f.y, ZB + 0.01, 0.25, 4, 3.4, 2.4, 1);
            if (Math.random() < 0.9) fx.emit(2, { x: f.x, y: f.y, speed: 4, life: 0.35, size: 0.05, color: 0xffc080, k: 3, g: 10 });
            if (Math.random() < 0.4) fx.emit(1, { x: f.x, y: f.y, speed: 0.6, life: 1.0, size: 0.2, grow: 1.2, color: 0x7a5a5a, add: false, alpha: 0.35, vy: 1 });
            lights.push({ x: f.x, y: f.y + 0.3, z: 1.2, color: 0xff6a2a, intensity: 55 * fl, dist: 13, pri: 8 });
        }
        // ---- hazards: shockwaves and the Queen's beam
        for (const h of G.hazards) {
            if (h.k === 'wave') {
                A.quad(h.x, h.y + 0.5, ZB, 0, 1, 0.6, 0.35, 2.6, 1.6, 0.7, 0.9, 3);
                if (Math.random() < 0.6) fx.dust(h.x, h.y, 1, 1.5);
                lights.push({ x: h.x, y: h.y + 0.6, z: 0.6, color: 0xffa040, intensity: 10, dist: 4, pri: 2 });
            } else if (h.k === 'beam') {
                const xm = (h.x0 + h.x1) / 2, hl = (h.x1 - h.x0) / 2;
                if (h.warn > 0) {
                    const a = 0.25 + 0.25 * Math.sin(time * 40);
                    A.quad(xm, h.y, ZB, 1, 0, hl, 0.05, 3, 0.6, 2.2, a, 3);
                } else {
                    A.quad(xm, h.y, ZB, 1, 0, hl, h.h * 0.9, 3.2, 0.7, 2.4, 1, 3);
                    A.quad(xm, h.y, ZB + 0.01, 1, 0, hl, h.h * 0.3, 4, 4, 4, 1, 3);
                    lights.push({ x: p.x, y: h.y, z: 1, color: 0xff4ad8, intensity: 60, dist: 12, pri: 9 });
                    lights.push({ x: xm, y: h.y, z: 1, color: 0xff4ad8, intensity: 40, dist: 12, pri: 7 });
                }
            }
        }

        // ---- view-only extras: rescued colonists beaming up
        for (const x of this.extras) x.t += dt;
        this.extras = this.extras.filter((x) => x.t < x.max);
        for (const x of this.extras) {
            const f = x.t / x.max;
            if (Math.floor(time * 20) % 2 || f < 0.6) this.spr.draw('colonist' + (Math.floor(time * 4) % 2), x.x, x.y + Math.max(0, f - 0.45) * 6, ZA + 0.03, { flash: f > 0.5 ? (f - 0.5) * 2 : 0 });
        }

        // ---- ambient motes: dust on the ship, ash and spores on the homeworld
        const rate = (ship ? 4 : 5) * fx.amount;
        if (Math.random() < dt * rate) {
            const x = this.cam.x + (Math.random() - 0.5) * vw, y = this.cam.y + (Math.random() - 0.5) * vh;
            if (ship) fx.emit(1, { x, y, speed: 0.15, life: 4, size: 0.04, color: 0xd0dcff, k: 0.8, drag: 0, z: -1 + Math.random() * 1.5 });
            else fx.emit(1, { x: x + vw * 0.3, y: y + vh * 0.4, vx: -0.8, vy: -0.6, speed: 0.3, life: 6, size: 0.045, color: this.world.pal.lamp, k: 0.7, drag: 0, z: -1.8 + Math.random() * 1.6 });
        }

        fx.draw();
        lights.push(...fx.flashes.map((f) => ({ ...f, intensity: f.intensity * (f.t / f.max) })));
        st.assignLights(lights);
        this.spr.end(); this.sprC.end(); this.sprL.end();
        fx.add.end(); fx.alpha.end();
        st.render(time);
    }

    drawBoss(G, B, time, lights) {
        const fl = B.flash > 0.03 ? 0.45 : 0;
        const A = this.fx.add;
        if (B.dead) {
            // shake and smoke while it dies; gone once the last blast fires
            if (B.deadT < 0.5) return;
        }
        const jit = B.dead ? (Math.random() - 0.5) * 0.15 : 0;
        switch (B.k) {
            case 'brood': {
                const open = B.state === 'spit' || B.state === 'birth' || (B.state === 'charge' && B.st > 0) || B.state === 'intro';
                const f = open ? 2 : B.vx ? Math.floor(B.t * 5) % 2 : 0;
                this.spr.draw('brood' + f, B.x + jit, B.y - 0.08, ZA, { flip: B.face < 0, flash: fl });
                lights.push({ x: B.x + B.face * 2, y: B.y + 2, z: 1, color: 0xa6ff3a, intensity: 18, dist: 7, pri: 4 });
                lights.push({ x: B.x - B.face * 1.2, y: B.y + 1.6, z: 1, color: 0xff6ac8, intensity: 14, dist: 6, pri: 3 });
                break;
            }
            case 'warden': {
                this.spr.draw('warden' + (B.phase === 2 || B.state === 'slam' ? 1 : 0), B.x + jit, B.y - 0.2, ZA, { flash: fl });
                A.blob(B.x - 0.95, B.y - 0.15, ZB, 0.6, 0.6, 1.6, 3, 0.8);
                A.blob(B.x + 0.95, B.y - 0.15, ZB, 0.6, 0.6, 1.6, 3, 0.8);
                if (Math.random() < 0.5) this.fx.emit(1, { x: B.x + (Math.random() < 0.5 ? -0.95 : 0.95), y: B.y - 0.3, dir: -Math.PI / 2, spread: 0.3, speed: 5, life: 0.3, size: 0.1, color: 0x8ad0ff, k: 2.5 });
                lights.push({ x: B.x, y: B.y + 1.3, z: 1.2, color: 0xff3a2a, intensity: 26, dist: 9, pri: 5 });
                lights.push({ x: B.x, y: B.y - 0.3, z: 0.8, color: 0x6ab8ff, intensity: 16, dist: 6, pri: 3 });
                if (B.state === 'slam' && B.st > 0) {
                    const a = 0.3 + 0.3 * Math.sin(time * 30);
                    A.quad(B.x, (B.y + 2) / 2, ZB - 0.2, 0, 1, (B.y - 2) / 2, 0.9, 2.5, 0.4, 0.3, a, 3);
                }
                break;
            }
            case 'gravemaw': {
                if (B.hy > 1.6) {
                    const headY = B.hy - 2.3;
                    for (let y = 2; y < headY; y += 0.95) this.spr.draw('worm_seg', B.x + Math.sin(y * 1.3 + time * 3) * 0.08, y, ZA - 0.02, { flash: fl });
                    this.spr.draw('worm_head' + (B.state === 'exposed' ? 1 : 0), B.x + jit, headY, ZA, { flash: fl });
                    lights.push({ x: B.x, y: B.hy - 0.8, z: 1.2, color: 0xff5a1a, intensity: 28, dist: 9, pri: 5 });
                }
                if ((B.state === 'burrow' || B.state === 'intro') && B.tx) {
                    const a = 0.3 + 0.2 * Math.sin(time * 20);
                    A.quad(B.tx, 2.15, ZB, 1, 0, 1.4, 0.18, 2.4, 1.0, 0.3, a, 3);
                    lights.push({ x: B.tx, y: 2.3, z: 0.8, color: 0xff6a2a, intensity: 10, dist: 4, pri: 3 });
                }
                break;
            }
            case 'queen': {
                const open = B.state === 'spray' || B.state === 'beam' || B.state === 'wisps' || B.state === 'intro';
                this.spr.draw('queen' + (open ? 1 : 0), B.x + jit, B.y - 0.15, ZA - 0.05, { flash: fl });
                lights.push({ x: B.x - 0.6, y: B.y + 6.7, z: 1.4, color: 0xff4ad8, intensity: open ? 40 : 22, dist: 10, pri: 5 });
                lights.push({ x: B.x, y: B.y + 3, z: 1.4, color: 0xff6ab8, intensity: 18, dist: 8, pri: 3 });
                break;
            }
        }
    }

    /** CSS px of a world point (for DOM labels). */
    toScreen(x, y, z = 0) {
        const v = new THREE.Vector3(x, y, z).project(this.stage.camera);
        return { x: (v.x + 1) / 2 * this.stage.w, y: (1 - v.y) / 2 * this.stage.h };
    }
}

export { WEAPONS };
