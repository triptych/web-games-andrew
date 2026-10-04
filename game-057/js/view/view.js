/**
 * view.js — the bridge from simulation to screen. Builds a level's meshes
 * when a world starts, interpolates every entity between sim steps, follows
 * the marine with the camera and turns sim events into effects and decals.
 */

import * as THREE from 'three';
import { WEAPONS, ENEMIES, BOSSES } from '../config.js';
import { raycast } from '../sim/core.js';
import { scene, camera, renderer, LM, Q, shake, shakeOffset, post, viewDistance, isPortrait } from './scene.js';
import { buildLevel, updateDoors, makeItem, animateItem } from './level.js';
import {
    makeMarine, setMarineGun, animateMarine, makeEllie, animateEllie, Brood, makeBoss, animateBoss, Pickups,
    makeDrone, makeGrenadeMesh, weaponModel,
} from './actors.js';
import { FX, makeFlashlightCone } from './fx.js';

const BLOOD = { skitter: '#4a7a12', drone: '#2a8a6a', spitter: '#7aa21a', bloater: '#9ac21a', burrower: '#6a5a12', brute: '#3a6a2a', husk: '#5a1a12', wasp: '#a28a12', stalker: '#4a2a8a', sac: '#8a2a6a', clone: '#2a9a8a' };
const BLOOD_P = { skitter: 0x7ad21a, drone: 0x3affb4, spitter: 0xa8ff2a, bloater: 0xd8ff3a, burrower: 0xb4a21a, brute: 0x6ad23a, husk: 0xc0301a, wasp: 0xffd23a, stalker: 0x9a6aff, sac: 0xff4ab4, clone: 0x4affd8 };
const BULLET_COL = { acid: 0x9aff2a, fire: 0xff7a1a, spine: 0xffd27a, slug: 0xff4a3a, plasma: 0xff4ae0, web: 0xe8e8ff };

export class View {
    constructor() {
        this.fx = new FX(scene);
        this.brood = new Brood(scene);
        this.pickups = new Pickups(scene);
        this.marine = makeMarine();
        scene.add(this.marine);
        this.ellie = null;
        this.hemi = new THREE.HemisphereLight(0x1a2430, 0x050608, 0.9);
        scene.add(this.hemi);
        this.flash = new THREE.SpotLight(0xfff2d8, 110, 20, 0.62, 0.55, 1.5);
        this.flash.castShadow = Q.shadows;
        this.flash.shadow.mapSize.set(1024, 1024);
        this.flash.shadow.camera.near = 0.5;
        this.flash.shadow.camera.far = 20;
        this.flash.shadow.bias = -0.0015;
        scene.add(this.flash, this.flash.target);
        this.fill = new THREE.PointLight(0xffd8b0, 7, 8, 1.5);
        scene.add(this.fill);
        this.muzzleLight = new THREE.PointLight(0xffd8a0, 0, 7, 1.6);
        scene.add(this.muzzleLight);
        this.cone = makeFlashlightCone();
        scene.add(this.cone);
        this.drones = [];
        this.grenades = [];
        this.camPos = new THREE.Vector3();
        this.camLook = new THREE.Vector3();
        this.level = null;
        this.items = [];
        this.boss = null;
        this.time = 0;
        this.recoil = 0;
        this.muzzleT = 0;
        this.hazardMeshes = [];
        this.lastHurt = 0;
        this.shakeOn = true;
        this.aim = { x: 0, y: 0 };
    }

    setWorld(w) {
        if (this.level) { scene.remove(this.level.group); this.level.dispose(); }
        for (const it of this.items) scene.remove(it);
        this.items = [];
        if (this.boss) { scene.remove(this.boss); this.boss = null; }
        if (this.ellie) { scene.remove(this.ellie); this.ellie = null; }
        this.fx.beamList.length = 0; this.fx.teleList.length = 0;
        this.w = w;
        this.camTarget = null;
        const lv = w.lv;
        this.level = buildLevel(lv, (id) => weaponModel(id));
        scene.add(this.level.group);
        for (const it of w.items) this.addItem(it);
        const th = lv.theme;
        this.hemi.color.setHex(th.ambient);
        scene.fog = new THREE.FogExp2(th.fog, 0.012);
        scene.background = new THREE.Color(th.fog);
        if (w.ellie) { this.ellie = makeEllie(); scene.add(this.ellie); }
        // Snap the camera.
        const p = w.player;
        this.camLook.set(p.x, 0, p.y);
        this.placeCamera(0, true);
        for (const r of lv.rooms) if (r.visited) this.level.setVisited(r);
    }

    addItem(it) {
        const g = makeItem(it, this.w.lv.theme, (id) => weaponModel(id));
        scene.add(g);
        this.items.push(g);
        g.userData.item = it;
    }

    placeCamera(dt, snap = false) {
        const D = viewDistance() * (this.bossZoom ?? 1);
        const pitch = THREE.MathUtils.degToRad(isPortrait() ? 62 : 57);
        const off = new THREE.Vector3(0, Math.sin(pitch) * D, Math.cos(pitch) * D);
        const want = this.camTarget ?? this.camLook;
        if (snap) this.camLook.copy(want);
        else this.camLook.lerp(want, 1 - Math.exp(-7 * dt));
        const s = shakeOffset(dt, this.shakeOn);
        camera.position.copy(this.camLook).add(off);
        camera.position.x += s.x; camera.position.z += s.y;
        camera.lookAt(this.camLook.x + s.x * 0.5, 0, this.camLook.z + s.y * 0.5);
        camera.rotation.z += s.r;
    }

    // ------------------------------------------------------------------ Per frame

    frame(w, alpha, dt, aim) {
        this.time += dt;
        const t = this.time;
        LM.uTime.value = t;
        const p = w.player;
        const px = p.ox + (p.x - p.ox) * alpha, py = p.oy + (p.y - p.oy) * alpha;
        // Camera: follow with a lead toward the aim; pull back for bosses.
        const ax = aim?.x ?? px + Math.cos(p.face) * 3, ay = aim?.y ?? py + Math.sin(p.face) * 3;
        let lx = (ax - px) * 0.22, ly = (ay - py) * 0.22;
        const ll = Math.hypot(lx, ly);
        if (ll > 3.2) { lx *= 3.2 / ll; ly *= 3.2 / ll; }
        this.camTarget = new THREE.Vector3(px + lx, 0, py + ly);
        const wantZoom = w.boss && !w.boss.dead ? 1.18 : 1;
        this.bossZoom = (this.bossZoom ?? 1) + (wantZoom - (this.bossZoom ?? 1)) * Math.min(1, dt * 2);
        this.placeCamera(dt);

        // Marine.
        setMarineGun(this.marine, p.weapons[p.cur].id);
        this.recoil = Math.max(0, this.recoil - dt * 10);
        p.recoil = this.recoil;
        const hurtGlow = Math.max(0, 1 - (t - this.lastHurt) * 4) * 0.8;
        animateMarine(this.marine, p, px, py, t, hurtGlow + (p.pow.aegis > 0 ? 0.25 + 0.15 * Math.sin(t * 20) : 0));
        const fa = p.face;
        const fdx = Math.cos(fa), fdz = Math.sin(fa);
        this.flash.position.set(px + fdx * 0.55, 1.45, py + fdz * 0.55);
        this.flash.target.position.set(px + fdx * 9, 0, py + fdz * 9);
        this.flash.intensity = p.alive ? 110 : 20;
        this.fill.position.set(px - fdx * 0.5, 3.6, py - fdz * 0.5);
        this.cone.position.set(px + fdx * 0.1, 1.55, py + fdz * 0.1);
        this.cone.rotation.set(0, -fa, -0.13);
        this.cone.material.uniforms.uTime.value = t;
        this.cone.material.uniforms.uOn.value = p.alive && p.rollT <= 0 ? 1 : 0.2;
        this.muzzleT -= dt;
        this.muzzleLight.intensity = this.muzzleT > 0 ? 7 * (this.muzzleT / 0.05) : 0;
        this.muzzleLight.position.set(px + fdx * 1.3, 1.2, py + fdz * 1.3);
        // Laser sight to the first wall.
        if (p.alive && p.rollT <= 0) {
            const len = raycast(w.lv, px, py, fdx, fdz, 14);
            const wcol = WEAPONS[p.weapons[p.cur].id].color;
            this.fx.beamList.push({ kind: 'laser', pts: [{ x: px + fdx * 0.7, y: py + fdz * 0.7 }, { x: px + fdx * len, y: py + fdz * len }], life: 1, max: 1, color: new THREE.Color(wcol), width: 0.018, alpha: 0.35 });
        }

        // Ellie.
        if (this.ellie && w.ellie) {
            const el = w.ellie;
            animateEllie(this.ellie, el, el.ox + (el.x - el.ox) * alpha, el.oy + (el.y - el.oy) * alpha);
        }

        // Bugs, boss.
        this.brood.update(w, alpha, t);
        if (w.boss && !this.boss) { this.boss = makeBoss(w.boss.type); scene.add(this.boss); }
        if (this.boss && w.boss) {
            const b = w.boss;
            if (b.dead) {
                // Collapse and sink.
                this.boss.position.y -= dt * 0.5;
                this.boss.rotation.z += dt * 0.3;
                if (this.boss.position.y < -4) { scene.remove(this.boss); this.boss = null; }
            } else animateBoss(this.boss, b, b.ox + (b.x - b.ox) * alpha, b.oy + (b.y - b.oy) * alpha, t, dt);
        }
        // Burning bugs smoke and flicker.
        for (const e of w.enemies) {
            if (e.burnT > 0 && Math.random() < 0.35 * this.fx.mul) this.fx.burst(e.x, 0.4 + e.r, e.y, 1, { color: 0xff7a2a, speed: [0.2, 0.8], up: [1, 2.5], life: [0.25, 0.5], size: [0.25, 0.45], kind: 4, sizeEnd: 0.4 });
            if (e.alpha && Math.random() < 0.1 * this.fx.mul) this.fx.burst(e.x, 0.3, e.y, 1, { color: ENEMIES[e.type]?.glow ?? 0xffffff, speed: [0.1, 0.4], up: [0.6, 1.4], life: [0.4, 0.8], size: [0.08, 0.14] });
        }

        // Pickups, items, props, doors.
        this.pickups.update(w, alpha, t);
        if (this.items.length < w.items.length) for (let i = this.items.length; i < w.items.length; i++) this.addItem(w.items[i]);
        for (const g of this.items) animateItem(g, g.userData.item, t);
        for (const mesh of this.level.props.meshes) {
            const f = mesh.userData.flash;
            let dirty = false;
            for (let i = 0; i < f.count; i++) if (f.array[i] > 0) { f.array[i] = Math.max(0, f.array[i] - dt * 6); dirty = true; }
            if (dirty) f.needsUpdate = true;
        }
        updateDoors(this.level.doors, w.lv);
        this.level.decals.update(dt);

        // Projectiles.
        this.drawBullets(w, alpha);
        this.drawGrenades(w, alpha, t);
        this.drawDrones(w, alpha);
        this.drawHazards(w, dt);

        // Shader state: alarms, vents, the wall fade around the marine.
        const alarm = w.activeRoom >= 0 || w.mode === 'escape' ? 1 : 0;
        this.alarm = (this.alarm ?? 0) + (alarm - (this.alarm ?? 0)) * Math.min(1, dt * 3);
        const pulse = 0.5 + 0.5 * Math.sin(t * (w.mode === 'escape' ? 7 : 4.5));
        LM.uAlarm.value.setHex(w.lv.theme.alarm).multiplyScalar(this.alarm * pulse * 1.8);
        this.level.floor.material.userData.uniforms.uVentGlow.value = this.alarm * (0.6 + 0.4 * pulse);
        this.level.walls.material.userData.uniforms.uPlayer.value.set(px, 0, py);

        // Post.
        post.low = p.alive ? Math.max(0, Math.min(1, (0.35 - p.hp / p.maxHp) / 0.35)) : 0.6;
        post.sat = w.cryoT > 0 ? 0.6 : 1;
        this.fx.update(dt, renderer.domElement.height * camera.projectionMatrix.elements[5] * 0.5);
    }

    /** Bullets are sized in metres; on small screens scale them up to a readable on-screen size. */
    bulletScale() {
        const visibleH = 2 * camera.position.distanceTo(this.camLook) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const pxPerM = window.innerHeight / visibleH;
        return THREE.MathUtils.clamp(48 / pxPerM, 1, 2.4);
    }

    drawBullets(w, alpha) {
        const tr = this.fx.tracers, orb = this.fx.orbs;
        const bs = this.bulletScale(), bl = Math.sqrt(bs);
        tr.begin(); orb.begin();
        const col = new THREE.Color();
        for (const b of w.pbullets) {
            const x = b.ox + (b.x - b.ox) * alpha, y = b.oy + (b.y - b.oy) * alpha;
            const sp = Math.hypot(b.vx, b.vy) || 1;
            const dx = b.vx / sp, dz = b.vy / sp;
            if (b.kind === 'flame') {
                const f = 1 - b.life / b.max;
                col.setHex(b.blue ? 0x4a8aff : 0xff6a1a).lerp(new THREE.Color(b.blue ? 0x8a4aff : 0xff2a0a), f);
                tr.add(x, 0.9 + f * 0.5, y, 1, dx, dz, b.r * 2.6 * bl, b.r * 2.6 * bl, col.r, col.g, col.b, (1 - f) * 0.8);
            } else if (b.kind === 'plasma' || b.kind === 'micro') {
                col.setHex(b.kind === 'plasma' ? 0xff5ce1 : 0xffd23a);
                const s = (b.kind === 'plasma' ? 1.1 : 0.45) * bl;
                tr.add(x, 1.05, y, 2, dx, dz, s, s, col.r, col.g, col.b, 1);
            } else {
                col.setHex(b.weapon === 'drone' ? 0x8aff6a : b.weapon === 'ellie' ? 0xffd27a : (WEAPONS[b.weapon]?.color ?? 0xffffff));
                const len = Math.min(1.6, sp * 0.045) * bl;
                tr.add(x - dx * len * 0.5, 1.15, y - dz * len * 0.5, 0, dx, dz, len, b.r * 1.6 * bs, col.r, col.g, col.b, 1);
            }
        }
        for (const b of w.ebullets) {
            const x = b.ox + (b.x - b.ox) * alpha, y = b.oy + (b.y - b.oy) * alpha;
            col.setHex(BULLET_COL[b.kind] ?? 0xff4a3a);
            const s = b.r * 2.9 * bs;
            const sp = Math.hypot(b.vx, b.vy) || 1;
            const stretch = b.kind === 'spine' || b.kind === 'slug' ? 1.6 : 1;
            orb.add(x, 1.0, y, b.kind === 'web' ? 3 : 0, b.vx / sp, b.vy / sp, s * stretch, s, col.r, col.g, col.b, 1);
        }
        tr.end(); orb.end();
    }

    drawGrenades(w, alpha, t) {
        while (this.grenades.length < w.grenades.length) { const m = makeGrenadeMesh(); scene.add(m); this.grenades.push(m); }
        this.grenades.forEach((m, i) => {
            const g = w.grenades[i];
            m.visible = !!g;
            if (!g) return;
            m.position.set(g.ox + (g.x - g.ox) * alpha, g.z + 0.1, g.oy + (g.y - g.oy) * alpha);
            m.rotation.x += 0.3; m.rotation.z += 0.2;
            m.scale.setScalar(g.kind === 'bomblet' ? 0.7 : 1);
            if (Math.random() < 0.3 * this.fx.mul) this.fx.burst(m.position.x, m.position.y, m.position.z, 1, { color: g.fuse < 0.4 ? 0xff2a1a : 0xffa84a, speed: [0, 0.3], up: [0, 0.3], life: [0.15, 0.3], size: [0.1, 0.18] });
        });
    }

    drawDrones(w, alpha) {
        const ds = w.player.drones;
        while (this.drones.length < ds.length) { const m = makeDrone(); scene.add(m); this.drones.push(m); }
        this.drones.forEach((m, i) => {
            const d = ds[i];
            m.visible = !!d;
            if (!d) return;
            m.position.set(d.ox + (d.x - d.ox) * alpha, 1.7 + Math.sin(this.time * 4 + i) * 0.1, d.oy + (d.y - d.oy) * alpha);
            m.rotation.y = -d.face;
        });
    }

    drawHazards(w, dt) {
        for (const h of w.hazards) {
            const fire = h.kind === 'fire';
            if (Math.random() < (fire ? 0.5 : 0.15) * this.fx.mul * Math.min(2, h.r)) {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * h.r;
                if (fire) this.fx.burst(h.x + Math.cos(a) * r, 0.1, h.y + Math.sin(a) * r, 1, { color: 0xff5a1a, speed: [0, 0.3], up: [1, 2.2], life: [0.3, 0.6], size: [0.3, 0.55], kind: 4, sizeEnd: 0.3 });
                else this.fx.burst(h.x + Math.cos(a) * r, 0.05, h.y + Math.sin(a) * r, 1, { color: 0x8aff2a, speed: [0, 0.1], up: [0.2, 0.6], life: [0.4, 0.8], size: [0.12, 0.22], sizeEnd: 1.5 });
            }
            if (!h.decal) {
                h.decal = true;
                if (fire) this.level.decals.scorch(h.x, h.y, h.r * 1.2);
                else this.level.decals.splat(h.x, h.y, h.r, '#4a9a10', 0.75, 9);
            }
        }
        void dt;
    }

    // ------------------------------------------------------------------ Events

    handle(ev, w) {
        const fx = this.fx;
        const dec = this.level.decals;
        switch (ev.type) {
        case 'shot': {
            const c = ev.weapon === 'drone' ? 0x8aff6a : ev.weapon === 'ellie' ? 0xffd27a : WEAPONS[ev.weapon]?.color ?? 0xffffff;
            if (ev.weapon === 'flame') { if (Math.random() < 0.4) fx.muzzle(ev.x, ev.y, ev.ang, 0xff7a1a, 0.6); }
            else fx.muzzle(ev.x, ev.y, ev.ang, c, ev.weapon === 'scatter' || ev.weapon === 'rail' || ev.weapon === 'plasma' ? 1.6 : ev.quiet ? 0.5 : 1);
            if (!ev.quiet && ev.weapon !== 'ellie' && ev.weapon !== 'drone') {
                this.muzzleT = 0.05;
                this.muzzleLight.color.setHex(c);
                this.recoil = Math.min(1, this.recoil + (ev.weapon === 'scatter' || ev.weapon === 'rail' ? 1 : 0.4));
                if (ev.weapon === 'scatter' || ev.weapon === 'rail' || ev.weapon === 'plasma') shake(0.18);
                // Brass.
                if (ev.weapon === 'pulse' || ev.weapon === 'minigun' || ev.weapon === 'smart' || ev.weapon === 'scatter') {
                    const side = ev.ang + Math.PI / 2;
                    fx.alpha.emit(ev.x, 1.15, ev.y, Math.cos(side) * 2.2, 2.5, Math.sin(side) * 2.2, 0.6, 0.9, 0.7, 0.3, 0.07, 14, 0.5, 1, 3, fx.time);
                }
            }
            break;
        }
        case 'phit': {
            const blood = BLOOD_P[ev.kind] ?? 0x7ad21a;
            fx.burst(ev.x, 0.8, ev.y, 3, { color: WEAPONS[ev.weapon]?.color ?? 0xffffff, speed: [2, 6], up: [0, 2], life: [0.08, 0.2], size: [0.04, 0.08], kind: 1 });
            fx.burst(ev.x, 0.6, ev.y, 3, { color: blood, additive: false, speed: [1, 4], up: [1, 3], life: [0.3, 0.6], size: [0.06, 0.12], gravity: 14, drag: 1, kind: 3 });
            break;
        }
        case 'pwall':
            fx.burst(ev.x, 1.1, ev.y, 4, { color: 0xffd8a0, speed: [1.5, 5], up: [0, 2.5], life: [0.1, 0.25], size: [0.03, 0.06], gravity: 10, kind: 1 });
            fx.burst(ev.x, 1.1, ev.y, 1, { color: 0x3a3a3a, additive: false, speed: [0.1, 0.4], up: [0.2, 0.6], life: [0.4, 0.7], size: [0.25, 0.4], kind: 2, sizeEnd: 2 });
            break;
        case 'bwall':
            fx.burst(ev.x, 1.0, ev.y, 3, { color: BULLET_COL[ev.kind] ?? 0xff4a3a, speed: [0.5, 2.5], up: [0, 1.5], life: [0.1, 0.25], size: [0.06, 0.12] });
            break;
        case 'bclear':
            fx.burst(ev.x, 1.0, ev.y, 2, { color: 0x9ad8ff, speed: [0.5, 2], up: [0, 1], life: [0.15, 0.3], size: [0.1, 0.18] });
            break;
        case 'kill': {
            const blood = BLOOD_P[ev.kind] ?? 0x7ad21a;
            const r = ev.r;
            const n = Math.round(6 + r * 14);
            if (ev.by === 'fire') {
                fx.burst(ev.x, 0.4, ev.y, n, { color: 0x1a1410, additive: false, speed: [0.3, 2], up: [1, 3], life: [0.6, 1.2], size: [0.2, 0.4], kind: 2, sizeEnd: 2 });
                fx.burst(ev.x, 0.4, ev.y, n, { color: 0xff6a1a, speed: [0.5, 3], up: [1, 4], life: [0.2, 0.5], size: [0.05, 0.1], kind: 1, gravity: 4 });
                dec.scorch(ev.x, ev.y, r * 1.4);
            } else {
                fx.burst(ev.x, 0.4 + r * 0.5, ev.y, n, { color: blood, additive: false, speed: [1.5, 5 + r * 4], up: [1, 4 + r * 2], life: [0.35, 0.8], size: [0.07, 0.15 + r * 0.1], gravity: 16, drag: 1, kind: 3 });
                fx.burst(ev.x, 0.4 + r * 0.5, ev.y, Math.round(n * 0.6), { color: ENEMIES[ev.kind]?.color ?? 0x3a2a1a, additive: false, speed: [1.5, 4 + r * 3], up: [2, 5], life: [0.4, 0.9], size: [0.08, 0.18 + r * 0.1], gravity: 18, drag: 0.8, kind: 3 });
                fx.burst(ev.x, 0.5, ev.y, 3, { color: blood, speed: [0.5, 1.5], up: [0.5, 1], life: [0.2, 0.4], size: [0.4 * r + 0.2, 0.7 * r + 0.3] });
                dec.splat(ev.x, ev.y, 0.35 + r * 0.9, BLOOD[ev.kind] ?? '#4a7a12', 0.85, 5 + Math.round(r * 6));
            }
            if (r > 0.6 || ev.alpha) shake(0.12);
            break;
        }
        case 'spawn':
            fx.rings.add(ev.x, 0.06, ev.y, 0.9, Math.max(0.3, ev.emerge), ev.alpha ? 3 : 0, fx.time, true);
            fx.burst(ev.x, 0.1, ev.y, 3, { color: 0x3a3228, additive: false, speed: [0.5, 1.5], up: [1, 2.5], life: [0.4, 0.8], size: [0.2, 0.35], kind: 2, sizeEnd: 2 });
            break;
        case 'explode':
            fx.explosion(ev.x, ev.y, ev.r, ev.kind);
            if (ev.kind === 'acid' || ev.kind === 'bio' || ev.kind === 'egg') dec.splat(ev.x, ev.y, ev.r * 0.8, '#4a9a10', 0.8, 10);
            else dec.scorch(ev.x, ev.y, ev.r * 0.9);
            shake(Math.min(0.6, 0.12 + ev.r * 0.08));
            post.ca = Math.min(1, post.ca + ev.r * 0.12);
            if (ev.kind === 'nova') { fx.rings.add(ev.x, 0.1, ev.y, ev.r * 1.3, 0.7, 2, fx.time); post.flash = 0.8; }
            break;
        case 'hurt':
            this.lastHurt = this.time;
            post.hurt = 1;
            post.ca = Math.min(1, post.ca + 0.4);
            shake(0.35);
            fx.burst(ev.x, 1.0, ev.y, 8, { color: 0xb01a1a, additive: false, speed: [1, 4], up: [1, 3], life: [0.3, 0.6], size: [0.06, 0.12], gravity: 14, kind: 3 });
            dec.splat(ev.x, ev.y, 0.35, '#5a0a0a', 0.6, 4);
            break;
        case 'roll':
            fx.burst(ev.x, 0.1, ev.y, 6, { color: 0x4a4a48, additive: false, ang: Math.atan2(-ev.dy, -ev.dx), spread: 1, speed: [0.5, 2], up: [0.2, 1], life: [0.3, 0.6], size: [0.25, 0.4], kind: 2, sizeEnd: 2 });
            break;
        case 'pulse':
            fx.rings.add(ev.x, 0.15, ev.y, 9.5, 0.6, 2, fx.time);
            fx.rings.add(ev.x, 0.15, ev.y, 6, 0.4, 2, fx.time);
            fx.burst(ev.x, 1, ev.y, 50, { color: 0x6ad8ff, speed: [6, 14], up: [0, 1], life: [0.2, 0.5], size: [0.1, 0.2], kind: 1, drag: 3 });
            fx.lights.flash(ev.x, 2, ev.y, 0x6ad8ff, 40, 14, 0.4);
            shake(0.4); post.ca = 1; post.flash = 0.4;
            break;
        case 'telegraph':
            fx.telegraphLine(ev.x, ev.y, ev.ang, ev.len, ev.width, ev.t);
            break;
        case 'target':
            fx.telegraphCircle(ev.x, ev.y, ev.r, ev.t, ev.kind === 'egg' ? 0xaaff3a : 0xff3a1a);
            break;
        case 'arc':
            fx.beam('arc', ev.pts, ev.small ? 0.1 : 0.16, 0xb49aff, ev.small ? 0.04 : 0.07);
            if (!ev.small) for (const p of ev.pts.slice(1)) fx.burst(p.x, 1, p.y, 4, { color: 0xc8b4ff, speed: [1, 4], up: [0, 2], life: [0.1, 0.25], size: [0.05, 0.1], kind: 1 });
            fx.lights.flash(ev.pts[0].x, 1.4, ev.pts[0].y, 0xa98bff, 10, 7, 0.12);
            break;
        case 'rail':
            fx.beam('rail', [{ x: ev.x, y: ev.y }, { x: ev.ex, y: ev.ey }], 0.35, 0x6af0ff, 0.22);
            fx.burst(ev.ex, 1.1, ev.ey, 16, { color: 0x6af0ff, speed: [2, 8], up: [0, 3], life: [0.15, 0.4], size: [0.05, 0.1], kind: 1 });
            fx.lights.flash(ev.ex, 1.4, ev.ey, 0x6af0ff, 18, 8, 0.2);
            post.ca = Math.min(1, post.ca + 0.3);
            break;
        case 'propBreak': {
            const ref = this.level.props.lookup.get(ev.id);
            if (ref) {
                const m = new THREE.Matrix4();
                ref.mesh.getMatrixAt(ref.i, m);
                m.scale(new THREE.Vector3(0.0001, 0.0001, 0.0001));
                ref.mesh.setMatrixAt(ref.i, m);
                ref.mesh.instanceMatrix.needsUpdate = true;
            }
            const glass = ev.kind === 'tank';
            const col = { crate: 0x5a4a30, barrel: 0xa8221a, sandbag: 0x7a6a48, tank: 0xaaffdd, cocoon: 0x4a2448, pod: 0x5a3a3a }[ev.kind] ?? 0x666666;
            fx.burst(ev.x, 0.5, ev.y, 18, { color: col, additive: false, speed: [2, 6], up: [2, 5], life: [0.5, 1], size: [0.08, 0.2], gravity: 16, drag: 0.8, kind: 3 });
            fx.burst(ev.x, 0.5, ev.y, 6, { color: 0x3a3632, additive: false, speed: [0.5, 1.5], up: [0.5, 1.5], life: [0.6, 1.2], size: [0.4, 0.7], kind: 2, sizeEnd: 2 });
            if (glass) { dec.splat(ev.x, ev.y, 1.2, '#2a9a5a', 0.7, 8); fx.burst(ev.x, 0.8, ev.y, 14, { color: 0x6affb4, speed: [1, 4], up: [1, 3], life: [0.3, 0.7], size: [0.05, 0.1], kind: 1, gravity: 10 }); }
            if (ev.kind === 'cocoon' || ev.kind === 'pod') dec.splat(ev.x, ev.y, 0.8, '#6a2a5a', 0.7, 7);
            break;
        }
        case 'propHit': {
            const ref = this.level.props.lookup.get(ev.id);
            if (ref) { ref.flash.array[ref.i] = 1; ref.flash.needsUpdate = true; }
            fx.burst(ev.x, 0.7, ev.y, 3, { color: 0xffd8a0, speed: [1, 3], up: [0, 2], life: [0.1, 0.2], size: [0.04, 0.07], kind: 1 });
            break;
        }
        case 'visit':
            this.level.setVisited(w.lv.rooms[ev.room]);
            break;
        case 'pickup':
            fx.burst(ev.x, 0.6, ev.y, ev.kind === 'salvage' ? 3 : 12, { color: ev.kind === 'salvage' ? 0xffd23a : ev.kind === 'health' ? 0xff4a4a : 0x6ad8ff, speed: [0.5, 2.5], up: [1, 3], life: [0.2, 0.5], size: [0.06, 0.12] });
            break;
        case 'power':
            fx.rings.add(ev.x, 0.1, ev.y, 3, 0.5, 2, fx.time);
            post.flash = 0.25;
            break;
        case 'chest': case 'buy': case 'heal':
            fx.burst(ev.x, 1, ev.y, 24, { color: ev.type === 'heal' ? 0x6affd0 : 0xffd23a, speed: [1, 4], up: [1, 4], life: [0.3, 0.8], size: [0.06, 0.14], kind: 1, gravity: 4 });
            break;
        case 'bossIntro':
            shake(0.5);
            break;
        case 'bossPhase':
            shake(0.6); post.flash = 0.5; post.ca = 1;
            fx.rings.add(ev.x, 0.2, ev.y, 8, 0.8, 4, fx.time);
            break;
        case 'bossDead':
            shake(1); post.flash = 1; post.ca = 1;
            fx.rings.add(ev.x, 0.2, ev.y, 14, 1.2, 0, fx.time);
            for (let i = 0; i < 6; i++) fx.explosion(ev.x + (Math.random() - 0.5) * 3, ev.y + (Math.random() - 0.5) * 3, 2.5, 'fire');
            dec.splat(ev.x, ev.y, 3.5, BLOOD[ev.kind] ?? '#3a6a2a', 0.9, 16);
            break;
        case 'thud':
            shake(ev.big ? 0.5 : 0.3);
            fx.burst(ev.x, 0.2, ev.y, 14, { color: 0x4a4a48, additive: false, speed: [1, 4], up: [0.5, 2], life: [0.5, 1], size: [0.3, 0.6], kind: 2, sizeEnd: 2 });
            break;
        case 'erupt':
            fx.burst(ev.x, 0.2, ev.y, 20, { color: 0x3a2a1a, additive: false, speed: [1, 5], up: [3, 7], life: [0.5, 1], size: [0.08, 0.18], gravity: 18, kind: 3 });
            fx.rings.add(ev.x, 0.06, ev.y, 2, 0.4, 0, fx.time);
            dec.scorch(ev.x, ev.y, 1);
            shake(0.2);
            break;
        case 'dig':
            fx.burst(ev.x, 0.1, ev.y, 10, { color: 0x3a2a1a, additive: false, speed: [0.5, 2], up: [1, 3], life: [0.4, 0.8], size: [0.07, 0.14], gravity: 14, kind: 3 });
            break;
        case 'birth':
            fx.burst(ev.x, 0.6, ev.y, 8, { color: 0xff5ab4, additive: false, speed: [1, 3], up: [1, 3], life: [0.3, 0.6], size: [0.06, 0.12], gravity: 12, kind: 3 });
            break;
        case 'blinkOut': case 'blinkIn': case 'split':
            fx.rings.add(ev.x, 0.2, ev.y, 3, 0.4, 2, fx.time);
            fx.burst(ev.x, 1.4, ev.y, 30, { color: 0x6affd8, speed: [2, 6], up: [-1, 3], life: [0.2, 0.5], size: [0.06, 0.12], kind: 1 });
            break;
        case 'armorBreak':
            shake(0.7);
            fx.burst(ev.x, 2.6, ev.y, 30, { color: 0x5a6068, additive: false, speed: [3, 7], up: [3, 7], life: [0.6, 1.2], size: [0.15, 0.3], gravity: 16, kind: 3 });
            fx.explosion(ev.x, ev.y, 2.5, 'fire');
            break;
        case 'missile': case 'lob':
            fx.burst(ev.x, 3.5, ev.y, 6, { color: 0xffa84a, speed: [1, 3], up: [3, 6], life: [0.3, 0.6], size: [0.15, 0.3], kind: 4 });
            break;
        case 'swell':
            fx.burst(ev.x, 0.6, ev.y, 6, { color: 0xd8ff3a, speed: [0.5, 1.5], up: [0.5, 1.5], life: [0.3, 0.55], size: [0.15, 0.3] });
            break;
        case 'secondwind':
            post.flash = 1; fx.rings.add(ev.x, 0.2, ev.y, 5, 0.8, 2, fx.time);
            break;
        case 'death':
            shake(0.8); post.ca = 1;
            fx.burst(ev.x, 1, ev.y, 30, { color: 0xb01a1a, additive: false, speed: [1, 5], up: [1, 4], life: [0.4, 0.9], size: [0.07, 0.15], gravity: 14, kind: 3 });
            break;
        case 'detonate':
            post.flash = 3; shake(1);
            break;
        case 'ricochet':
            fx.burst(ev.x, 1, ev.y, 3, { color: 0xffffff, speed: [2, 5], up: [0, 2], life: [0.05, 0.15], size: [0.03, 0.05], kind: 1 });
            break;
        case 'slash':
            fx.burst(ev.x + Math.cos(ev.ang ?? 0) * 0.8, 1, ev.y + Math.sin(ev.ang ?? 0) * 0.8, 6, { color: 0xb46aff, ang: ev.ang, spread: 0.8, speed: [3, 6], up: [0, 1], life: [0.1, 0.2], size: [0.06, 0.1], kind: 1 });
            break;
        case 'upgrade': case 'newWeapon':
            fx.rings.add(w.player.x, 0.1, w.player.y, 2.2, 0.5, 1, fx.time);
            fx.burst(w.player.x, 1, w.player.y, 20, { color: 0x6aff8a, speed: [1, 3], up: [1, 4], life: [0.3, 0.6], size: [0.05, 0.1], kind: 1 });
            break;
        default: break;
        }
    }

    /** World point under the screen position (on the plane y = h). */
    screenToWorld(sx, sy, h = 1.1) {
        const ndc = new THREE.Vector3((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5);
        ndc.unproject(camera);
        const dir = ndc.sub(camera.position).normalize();
        const t = (h - camera.position.y) / dir.y;
        return { x: camera.position.x + dir.x * t, y: camera.position.z + dir.z * t };
    }

    worldToScreen(x, y, h = 1) {
        const v = new THREE.Vector3(x, h, y).project(camera);
        return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, on: v.z < 1 };
    }

    bossDef() { return this.w?.boss ? BOSSES[this.w.boss.type] : null; }
}
