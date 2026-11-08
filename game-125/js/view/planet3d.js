// A zone on Cradle, built for one drop from G.mission: a terrain diorama whose colours follow how barren the zone
// still is, hills that close the map in, pixel billboards for everything the sim knows about, flowers that appear
// as the zone heals, hazards, shots, telegraphed slams and the bot's own arms in the corner of the eye.

import * as THREE from 'three';
import { ZONES, ENEMIES, SPECIES_BY_ID } from '../sim/data.js';
import { MAP, BEACON } from '../config.js';
import { ventHot, ventWarn } from '../sim/mission.js';
import { terraOf } from '../sim/genetics.js';
import { fbm, hash3 } from '../rng.js';
import { Px } from './pixel.js';
import { pixelTex, skyDome } from './stage.js';
import { billboard, face, disposeTree, spriteTex } from './billboard.js';
import * as SP from './sprites.js';

export const EYE = 1.15;
const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/** Cosmetic ground height: gentle inside the map, rising into hills beyond its edge. Pure, so sprites sit on it. */
export function groundY(seed, x, z) {
    const n = (fbm(seed, x * 0.06, z * 0.06, 3) - 0.5) * 1.2;
    const e = Math.max(Math.abs(x), Math.abs(z)) - (MAP.half - 2);
    return n + (e > 0 ? Math.min(9, e * e * 0.05) + fbm(seed + 9, x * 0.1, z * 0.1, 3) * Math.min(e, 20) * 0.35 : 0);
}

function groundCanvas(a, b) {
    const P = new Px(32, 32);
    const hi = '#' + new THREE.Color(a).offsetHSL(0, 0, 0.06).getHexString();
    P.mrect(0, 0, 32, 32).paint(a, { flat: true });
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const v = hash3(x, y, 77);
        if (v < 0.18) P.set(x, y, b); else if (v > 0.93) P.set(x, y, hi);
    }
    return P.toCanvas();
}

export class PlanetView {
    constructor() {
        this.scene = new THREE.Scene();
        this.root = null;
        this.M = null;
        this.key = null;
        this.arms = new THREE.Group();
        this.ents = new Map();          // enemy id -> billboard
        this.nodes = new Map();
        this.shots = new Map();
        this.fx = [];
        this.flashT = 0;
        this.shake = 0;
        this.sun = new THREE.DirectionalLight(0xffffff, 2);
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
        this.lamp = new THREE.PointLight(0xfff0c0, 0, 16, 1.4);
        this.scene.add(this.sun, this.sun.target, this.hemi, this.lamp);
    }

    /** Rebuild the scene for a new drop. */
    build(G, cam) {
        const M = G.mission;
        if (this.root) { this.scene.remove(this.root); disposeTree(this.root); }
        this.ents.clear(); this.nodes.clear(); this.shots.clear(); this.fx.length = 0;
        const R = this.root = new THREE.Group();
        this.statics = [];
        this.scene.add(R);
        const Z = ZONES[M.zone], st = G.zones[M.zone], heal = Math.min(1, Math.max(0, terraOf(st) / 100));
        this.Z = Z; this.heal = heal; this.seed = M.seed % 100000;
        const seed = this.seed;
        // sky, fog, light
        const top = lerpC(Z.sky[0], Z.zone === 4 ? Z.sky[0] : '#5a9ae8', heal * 0.35), hor = lerpC(Z.sky[1], '#e8f4ff', heal * 0.25);
        this.sky = skyDome(top, hor, { sun: Z.sun, stars: M.zone === 4 ? 1 : 0 });
        R.add(this.sky);
        this.scene.fog = new THREE.Fog(lerpC(Z.fog, '#d8e8f0', heal * 0.3), M.zone === 4 ? 6 : 14, M.zone === 4 ? 34 : 70);
        this.scene.background = hor;
        this.sun.color.set(Z.sun); this.sun.intensity = Z.light;
        this.sun.position.set(20, 40, -30);
        this.hemi.color.set(top); this.hemi.groundColor.set(Z.ground[0]); this.hemi.intensity = M.zone === 4 ? 0.5 : M.zone === 5 ? 1.3 : 0.9;
        this.lamp.intensity = M.zone === 4 ? 30 : M.zone === 5 ? 6 : 0;
        // terrain
        const SZ = MAP.half * 2 + 70, SEG = 96;
        const geo = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position, cols = [];
        const live = new THREE.Color(), dead = new THREE.Color(), c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            pos.setY(i, groundY(seed, x, z));
            const n = fbm(seed + 3, x * 0.08, z * 0.08, 2);
            live.set(Z.ground[0]).lerp(new THREE.Color(Z.ground[1]), n);
            dead.set(Z.dead[0]).lerp(new THREE.Color(Z.dead[1]), n);
            c.copy(dead).lerp(live, Math.min(1, heal * 1.2 + (n - 0.5) * 0.3));
            const out = Math.max(Math.abs(x), Math.abs(z)) > MAP.half;
            if (out) c.multiplyScalar(0.85);
            cols.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        geo.computeVertexNormals();
        const gt = pixelTex(groundCanvas('#f0f0f0', '#c8c8c8'), true);
        gt.repeat.set(SZ / 2, SZ / 2);
        R.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: gt, vertexColors: true })));
        const gy = (x, z) => groundY(seed, x, z);
        this.gy = gy;
        // scenery
        for (const p of M.props) {
            const b = billboard(`prop-${p.kind}-${M.zone}`, () => SP.prop(p.kind, M.zone), { scale: p.s, emissive: p.kind === 'crystal' || p.kind === 'shroomtree' ? 0.35 : M.zone === 4 ? 0.15 : 0 });
            b.position.set(p.x, gy(p.x, p.y), p.y);
            R.add(b); this.statics.push(b);
        }
        // ground cover: flowers as the zone heals, dead stalks while it's barren
        const flowerCols = ['#ff8ab0', '#ffd04a', '#ffffff', '#b07aff', '#7ad8ff'];
        const nFlower = Math.round(260 * heal * heal), nDead = Math.round(200 * (1 - heal)), nGrass = Math.round(120 + 260 * heal);
        const cover = (key, make, n, sc, salt) => {
            if (!n) return;
            const T = spriteTex(key, make);
            const g = new THREE.PlaneGeometry(sc * T.w / T.hpx, sc); g.translate(0, sc / 2, 0);
            const g2 = g.clone().rotateY(Math.PI / 2);
            const mat = new THREE.MeshLambertMaterial({ map: T.tex, alphaTest: 0.5, side: THREE.DoubleSide });
            for (const gg of [g, g2]) {
                const im = new THREE.InstancedMesh(gg, mat, n), o = new THREE.Object3D();
                for (let i = 0; i < n; i++) {
                    const x = (hash3(i, salt, seed) - 0.5) * (MAP.half * 2 + 6), z = (hash3(i, salt + 1, seed) - 0.5) * (MAP.half * 2 + 6);
                    o.position.set(x, gy(x, z), z); o.rotation.y = hash3(i, salt + 2, seed) * 3; o.scale.setScalar(0.7 + hash3(i, salt + 3, seed) * 0.6); o.updateMatrix();
                    im.setMatrixAt(i, o.matrix);
                }
                R.add(im);
            }
        };
        cover('grass-' + M.zone, () => SP.tuft('grass', Z.ground[1]), nGrass, 0.5, 10);
        cover('dead-' + M.zone, () => SP.tuft('dead', Z.dead[1]), nDead, 0.45, 20);
        flowerCols.forEach((fc, i) => cover('flower-' + fc, () => SP.tuft('flower', fc), Math.round(nFlower / 5), 0.5, 30 + i * 7));
        // the beacon, and what we've built here
        const bc = billboard('beacon', () => SP.beacon(), { emissive: 0.4 });
        bc.position.set(BEACON.x, gy(BEACON.x, BEACON.y), BEACON.y); R.add(bc); this.statics.push(bc);
        this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(BEACON.r - 0.15, BEACON.r, 48), new THREE.MeshBasicMaterial({ color: 0x7affc8, transparent: true, opacity: 0.6, toneMapped: false }));
        this.beaconRing.rotation.x = -Math.PI / 2; this.beaconRing.position.set(BEACON.x, gy(BEACON.x, BEACON.y) + 0.06, BEACON.y);
        R.add(this.beaconRing);
        let k = 0;
        for (const h in st.harv) for (let l = 0; l < Math.min(2, st.harv[h]); l++) {
            const b = billboard('rig-' + h, () => SP.harvester(h), {});
            const x = -9 + (k % 6) * 3.4, z = BEACON.y + 3 + Math.floor(k / 6) * 2; k++;
            b.position.set(x, gy(x, z), z); R.add(b); this.statics.push(b);
        }
        if (st.colony) { const b = billboard('colony-' + st.colony, () => SP.colony(st.colony), { emissive: 0.2 }); b.position.set(9, gy(9, 28), 28); R.add(b); this.statics.push(b); }
        // nodes
        for (const n of M.nodes) this.addNode(n);
        if (M.echo && !M.got.echo) {
            const b = billboard('echo', () => SP.echoBox(), { emissive: 0.9 });
            b.position.set(M.echo.x, gy(M.echo.x, M.echo.y), M.echo.y); R.add(b);
            const L = new THREE.PointLight(0xc89aff, 8, 7, 1.5); L.position.set(M.echo.x, gy(M.echo.x, M.echo.y) + 1, M.echo.y); R.add(L);
            this.echo = { b, L };
        } else this.echo = null;
        // hazards
        this.haz = M.hazards.map((h) => {
            const col = { spore: 0xff9a4a, acid: 0x5ad86a, vent: 0xff5a2a, thorn: 0x6a2a4a }[h.kind];
            const disc = new THREE.Mesh(new THREE.CircleGeometry(h.r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: h.kind === 'spore' ? 0.18 : h.kind === 'acid' ? 0.4 : 0.55, depthWrite: false, toneMapped: h.kind !== 'vent' }));
            disc.rotation.x = -Math.PI / 2; disc.position.set(h.x, gy(h.x, h.y) + 0.05, h.y);
            R.add(disc);
            let cloud = null;
            if (h.kind === 'spore') {
                const g = new THREE.BufferGeometry(), p = [];
                for (let i = 0; i < 70; i++) { const a = hash3(i, 1, h.x * 10) * 6.28, r = Math.sqrt(hash3(i, 2, h.y * 10)) * h.r; p.push(h.x + Math.cos(a) * r, gy(h.x, h.y) + 0.3 + hash3(i, 3, 5) * 2.2, h.y + Math.sin(a) * r); }
                g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
                cloud = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffb06a, size: 0.22, transparent: true, opacity: 0.7, depthWrite: false }));
                R.add(cloud);
            }
            return { h, disc, cloud };
        });
        this.slams = new Map();
        // the bot's arms, fixed to the camera
        cam.add(this.arms);
        this.arms.clear();
        const gen = G.bot.gen;
        const armL = billboard('arm-l', () => armSprite(gen, false), { shadow: 0, emissive: 0.25 });
        const armR = billboard('arm-r-' + gen, () => armSprite(gen, true), { shadow: 0, emissive: 0.25 });
        // the arms are unlit and drawn last: the camera lamp in the dark zones must not blow them out
        for (const a of [armL, armR]) {
            const old = a.userData.sprite.material;
            a.userData.sprite.material = new THREE.MeshBasicMaterial({ map: old.map, alphaTest: 0.5, transparent: true, depthTest: false, depthWrite: false, fog: false });
            a.userData.sprite.material.color.setScalar(M.zone === 4 ? 0.75 : 0.95);
            old.dispose();
        }
        armL.renderOrder = armR.renderOrder = 10;
        armL.userData.sprite.renderOrder = armR.userData.sprite.renderOrder = 10;
        this.arms.add(armL, armR);
        this.armL = armL; this.armR = armR;
        this.M = M;
    }

    addNode(n) {
        const tier = this.Z.tier;
        const b = n.species
            ? billboard('sp-' + n.species, () => SP.species(n.species), { emissive: tier === 4 ? 0.3 : 0 })
            : billboard(`node-${n.kind}-${tier}`, () => SP.node(n.kind, tier), { emissive: n.kind === 'mineral' ? 0.45 : (tier === 4 ? 0.25 : 0) });
        b.position.set(n.x, this.gy(n.x, n.y), n.y);
        this.root.add(b);
        this.nodes.set(n.id, { b, n });
    }

    burst(x, y, z, col, n = 10, spd = 3) {
        const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
        for (let i = 0; i < n; i++) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; v.push([(Math.random() - 0.5) * spd, Math.random() * spd, (Math.random() - 0.5) * spd]); }
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        const m = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 0.14, transparent: true, toneMapped: false }));
        m.material.color.multiplyScalar(1.6);
        this.root.add(m);
        this.fx.push({ m, v, t: 0.7 });
    }

    onEvents(G, events, cam) {
        if (!this.root || !G.mission) return;
        for (const e of events) {
            if (e.type === 'hit') { const en = this.ents.get(e.id); if (en) en.flash = 0.15; this.burst(e.x, this.gy(e.x, e.y) + 0.8, e.y, e.how === 'shot' ? 0x7affff : 0xffffff, 8, 2.5); }
            else if (e.type === 'kill') { this.burst(e.x, this.gy(e.x, e.y) + 0.6, e.y, 0xffb47e, 22, 4); }
            else if (e.type === 'gather') { this.burst(e.x, this.gy(e.x, e.y) + 0.6, e.y, { metal: 0xd8e0e8, mineral: 0x86e4ff, flora: 0x86e08e }[e.kind] || 0xffffff, 10, 2); }
            else if (e.type === 'hurt') { this.flashT = 0.35; this.shake = Math.min(0.25, 0.05 + e.dmg * 0.006); }
            else if (e.type === 'swing') this.swingT = 0.25;
            else if (e.type === 'shoot') this.shootT = 0.15;
            else if (e.type === 'echo' && this.echo) { this.burst(this.echo.b.position.x, this.echo.b.position.y + 0.5, this.echo.b.position.z, 0xc89aff, 30, 4); this.echo.b.visible = false; this.echo.L.intensity = 0; }
            else if (e.type === 'slam') { this.burst(e.x, this.gy(e.x, e.y) + 0.2, e.y, 0x8a5a3a, 30, 6); this.shake = 0.2; }
        }
        void cam;
    }

    frame(G, dt, time, cam, look) {
        const M = G.mission;
        if (!M) return;
        const p = M.p;
        // the camera rides the bot
        const bob = Math.sin(M.t * 9) * 0.03 * Math.min(1, Math.hypot(p.x - (this.lx ?? p.x), p.y - (this.ly ?? p.y)) / dt / 4);
        this.lx = p.x; this.ly = p.y;
        this.shake = Math.max(0, this.shake - dt);
        cam.position.set(p.x + (Math.random() - 0.5) * this.shake, this.gy(p.x, p.y) + EYE + bob, p.y + (Math.random() - 0.5) * this.shake);
        cam.rotation.set(look.pitch, -p.yaw, 0, 'YXZ');
        this.lamp.position.copy(cam.position);
        this.sky.position.copy(cam.position);
        this.sky.userData.U.uTime.value = time;
        // enemies
        const seen = new Set();
        for (const e of M.enemies) {
            if (!e.alive) continue;
            seen.add(e.id);
            let en = this.ents.get(e.id);
            if (!en) {
                const E = ENEMIES[e.type];
                const b = E.boss ? billboard('rootmother', () => SP.rootmother(), { emissive: 0.15, shadow: 4 }) : billboard('sp-' + e.type, () => SP.species(e.type), { emissive: this.Z.tier === 4 ? 0.35 : 0.05 });
                this.root.add(b);
                en = { b, flash: 0, hp: null };
                if (E.boss) en.hp = hpBar(); else en.hp = hpBar(0.9);
                b.add(en.hp); en.hp.position.y = b.userData.h + 0.25;
                this.ents.set(e.id, en);
            }
            const E = ENEMIES[e.type];
            const fly = E.flyer ? 1.2 + Math.sin(time * 3 + e.id) * 0.25 : 0;
            en.b.position.set(e.x, this.gy(e.x, e.y) + fly, e.y);
            const s = en.b.userData.sprite;
            const hop = e.st === 'chase' && !E.boss ? Math.abs(Math.sin(time * 10 + e.id)) * 0.08 : Math.sin(time * 2 + e.id) * 0.02;
            s.position.y = hop;
            const wind = e.wind > 0 ? 1 + Math.sin(time * 40) * 0.06 : 1;
            s.scale.set(wind, e.wind > 0 ? 0.92 : 1, 1);
            en.flash = Math.max(0, en.flash - dt);
            s.material.emissiveIntensity = en.flash > 0 ? 2 : s.material.emissiveIntensity && s.material.emissiveIntensity > 1 ? (E.boss ? 0.15 : 0.05) : s.material.emissiveIntensity;
            if (en.flash > 0) { s.material.emissive?.set(0xffffff); s.material.emissiveMap = null; s.material.emissiveIntensity = 1.5; s.material.needsUpdate = true; en.lit = true; }
            else if (en.lit) { s.material.emissiveMap = s.material.map; s.material.emissiveIntensity = this.Z.tier === 4 ? 0.35 : E.boss ? 0.15 : 0.05; s.material.needsUpdate = true; en.lit = false; }
            en.hp.visible = e.hp < e.hpMax;
            en.hp.userData.fill.scale.x = Math.max(0.001, e.hp / e.hpMax);
            en.hp.quaternion.copy(cam.quaternion);
            face(en.b, cam);
        }
        for (const [id, en] of this.ents) if (!seen.has(id)) { this.root.remove(en.b); this.ents.delete(id); }
        // nodes
        for (const [, o] of this.nodes) {
            const n = o.n, mn = M.nodes.find((q) => q.id === n.id);
            o.b.visible = !!mn && mn.amount > 0;
            if (mn && mn.prog > 0 && p.gatherId === mn.id) o.b.userData.sprite.position.x = Math.sin(time * 50) * 0.03; else o.b.userData.sprite.position.x = 0;
            face(o.b, cam);
        }
        for (const b of this.statics) face(b, cam);
        if (this.echo?.b.visible) { face(this.echo.b, cam); this.echo.b.userData.sprite.position.y = 0.3 + Math.sin(time * 2) * 0.15; }
        // shots
        const live = new Set();
        for (const s of M.shots) {
            live.add(s.id);
            let m = this.shots.get(s.id);
            if (!m) {
                const col = s.from === 'p' ? 0x7affff : s.kind === 'ember' ? 0xff7a2a : s.kind === 'thorn' ? 0xff5a8a : 0xffb04a;
                m = new THREE.Mesh(new THREE.SphereGeometry(s.from === 'p' ? 0.1 : 0.16, 8, 6), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
                m.material.color.multiplyScalar(2.5);
                this.root.add(m); this.shots.set(s.id, m);
            }
            m.position.set(s.x, this.gy(s.x, s.y) + (s.from === 'p' ? 0.95 : 0.9), s.y);
        }
        for (const [id, m] of this.shots) if (!live.has(id)) { this.root.remove(m); m.geometry.dispose(); m.material.dispose(); this.shots.delete(id); }
        // slams: a red ring that fills before it lands
        const sl = new Set();
        M.slams.forEach((s, i) => {
            const k = s.x.toFixed(2) + s.y.toFixed(2); sl.add(k);
            let m = this.slams.get(k);
            if (!m) { m = new THREE.Mesh(new THREE.CircleGeometry(s.r, 32), new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.set(s.x, this.gy(s.x, s.y) + 0.08, s.y); this.root.add(m); this.slams.set(k, m); }
            m.material.opacity = 0.2 + 0.5 * (1 - s.t / 1.2) + Math.sin(time * 30) * 0.08;
            void i;
        });
        for (const [k, m] of this.slams) if (!sl.has(k)) { this.root.remove(m); this.slams.delete(k); }
        // hazards breathe
        for (const o of this.haz) {
            if (o.h.kind === 'vent') {
                const hot = ventHot(o.h, M.t), warn = ventWarn(o.h, M.t);
                o.disc.material.opacity = hot ? 0.9 : warn ? 0.35 + Math.sin(time * 25) * 0.2 : 0.18;
                o.disc.material.color.set(hot ? 0xffd04a : 0xff5a2a).multiplyScalar(hot ? 2.5 : 1);
            } else if (o.cloud) o.cloud.rotation.y = time * 0.2;
        }
        // fx
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i]; f.t -= dt;
            const a = f.m.geometry.attributes.position;
            for (let k = 0; k < f.v.length; k++) { f.v[k][1] -= 6 * dt; a.setXYZ(k, a.getX(k) + f.v[k][0] * dt, a.getY(k) + f.v[k][1] * dt, a.getZ(k) + f.v[k][2] * dt); }
            a.needsUpdate = true; f.m.material.opacity = Math.max(0, f.t / 0.7);
            if (f.t <= 0) { this.root.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); this.fx.splice(i, 1); }
        }
        this.beaconRing.material.opacity = 0.4 + Math.sin(time * 3) * 0.2 + (p.extract > 0 ? 0.4 : 0);
        this.beaconRing.scale.setScalar(1 - Math.min(1, p.extract / BEACON.hold) * 0.6);
        // arms: the cutter swings, the scoop digs, the blaster kicks
        // place the arms in the lower corners of what this camera actually sees at their depth
        const D = 0.8, halfH = Math.tan((cam.fov * Math.PI) / 360) * D, halfW = halfH * cam.aspect;
        const k = Math.min(1, halfW / 0.75);
        this.armL.scale.setScalar(k); this.armR.scale.setScalar(k);
        this.swingT = Math.max(0, (this.swingT || 0) - dt); this.shootT = Math.max(0, (this.shootT || 0) - dt);
        const sw = this.swingT > 0 ? Math.sin((1 - this.swingT / 0.25) * Math.PI) : 0;
        const dig = p.gatherId ? Math.sin(time * 18) * 0.03 : 0;
        const walk = Math.sin(M.t * 9) * 0.015;
        const ax = halfW * 0.6, ay = -halfH * 0.98;
        this.armR.position.set(ax - sw * 0.2 * k, ay + walk + sw * 0.14 * k - (this.shootT || 0) * 0.2, -D);
        this.armR.rotation.z = sw * 0.9;
        this.armL.position.set(-ax, ay - walk + dig, -D + dig);
        this.flashT = Math.max(0, this.flashT - dt);
    }

    dispose(cam) { if (this.root) { this.scene.remove(this.root); disposeTree(this.root); this.root = null; } cam.remove(this.arms); }
}

function hpBar(w = 3) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.12), new THREE.MeshBasicMaterial({ color: 0x1a1020, depthTest: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.12), new THREE.MeshBasicMaterial({ color: 0xff4a5a, depthTest: false, toneMapped: false }));
    fill.geometry.translate(w / 2, 0, 0); fill.position.x = -w / 2; fill.position.z = 0.001;
    bg.renderOrder = fill.renderOrder = 5;
    g.add(bg, fill); g.userData.fill = fill;
    return g;
}

/** The bot's own forearm in the corner of the view: a cutter on the right, a scoop on the left. */
function armSprite(gen, right) {
    const cols = ['#d8b070', '#e09a3a', '#6ac0a8', '#c8603a', '#7a6ad8', '#f0f0e8'];
    const P = new Px(32, 32);
    P.mpoly([[4, 31], [12, 31], [22, 12], [16, 10]]).paint(cols[gen], { tex: (x, y) => ((x + y) % 7 === 0 ? -1 : 0) });
    P.mrect(14, 12, 9, 5).paint('#4a4a58');
    if (right) { P.mpoly([[16, 12], [24, 1], [27, 3], [22, 13]]).paint('#d8e0e8', { hi: 1.5 }); if (gen >= 1) P.mrect(22, 13, 6, 3).paint('#5a5a6a'); }
    else P.mpoly([[12, 10], [26, 8], [28, 14], [14, 16]]).paint('#8a8a92');
    if (!right) P.flipX();
    return { px: P.outline('#1a1222', 0.7), h: 0.3 };
}

void SPECIES_BY_ID;
