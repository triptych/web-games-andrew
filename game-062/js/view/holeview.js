// Builds the scene for one hole from its course, and syncs it from the World every frame:
// terrain, water, grass, trees, props, pickups, monsters, the boss, the hero and Wedgewick, the ball
// (with its blob shadow and trail), the aim arc and landing ring. World events become effects here.

import * as THREE from 'three';
import { buildTerrain, buildGrass, TERRAIN_U } from './terrain.js';
import { instancedTrees, decorMesh, windmillMesh, springMesh, bumperMesh, rockMesh, teeBoxMesh, flagMesh, sealMesh, geyserMesh, runeMesh, iceWallMesh, moleHillMesh, scatterBackground } from './props.js';
import { buildHumanoid, buildWedgewick, buildMonster, buildBoss, heroLook, CAST, wormSegment, neckSegment } from './chars.js';
import { setPose, animate, animateWedge, animateMonster } from './anim.js';
import { toonMat, toonMesh, part, sph, TOON, outlineMat } from './toon.js';
import { PALETTES } from './palette.js';
import { monsterPos, MONSTERS } from '../sim/monsters.js';
import { geyserActive } from '../sim/world.js';
import { predictArc } from '../sim/clubs.js';
import { SURF } from '../sim/realms.js';
import { LOOKS, OUTFITS, SPELLS } from '../sim/rpg.js';
import { BOSSES } from '../sim/bosses.js';

const _mp = {};
const HERO_SCALE = 1.45;
const ITEM_COL = { rocket: '#ff5a3a', sticky: '#ffb030', spring: '#b05aff', ghost: '#e8f0ff' };
const SPELL_TRAIL = { fire: ['#ff8a2a', 0.34], frost: ['#a8eaff', 0.26], seek: ['#d58aff', 0.24], ward: ['#9fe8ff', 0.2] };

export class HoleView {
    constructor(R, fx, sky, director) {
        this.R = R; this.fx = fx; this.sky = sky; this.dir = director;
        this.root = new THREE.Group();
        R.scene.add(this.root);
        this.disposers = [];
        // reusable bits
        this.ball = toonMesh([part(sph(0.2, 16, 12), '#ffffff')], { outline: 0.03 });
        this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }));
        this.ballShadow.renderOrder = 3;
        this.arcDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), 80);
        this.arcDots.frustumCulled = false;
        this.landRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
        this.landRing.renderOrder = 4;
        this.ticks = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe070', transparent: true, opacity: 0.8, depthWrite: false })); m.renderOrder = 4; return m; });
        this.aimArrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
    }

    clear() {
        for (const c of [...this.root.children]) this.root.remove(c);
        for (const d of this.disposers) d();
        this.disposers = [];
        this.fx.clear();
    }

    build(course, world, profile) {
        this.clear();
        const c = course, P = PALETTES[c.hole.realm];
        this.c = c; this.P = P; this.world = world;
        this.R.setPalette(P);
        const centre = new THREE.Vector3((c.tee.x + c.cup.x) / 2, (c.tee.y + c.cup.y) / 2, (c.tee.z + c.cup.z) / 2);
        const radius = Math.hypot(c.cup.x - c.tee.x, c.cup.z - c.tee.z) / 2 + 60;
        this.sky.apply(P, centre, radius, c.seed);
        this.fx.setAmbient(P.snowfall ? 'snow' : P.embers ? 'embers' : P.key === 'meadow' ? 'pollen' : P.key === 'sky' ? 'sparkles' : null);
        const q = this.R.quality;
        // ground
        const T = buildTerrain(c, P, q);
        this.root.add(T.group);
        this.terrain = T;
        this.disposers.push(T.dispose);
        this.root.add(buildGrass(c, P, q, c.seed));
        // trees: hole colliders + background scatter
        const trees = [];
        for (const t of c.hole.trees ?? []) trees.push({ x: t[0], z: t[1], y: c.heightAt(t[0], t[1]), s: t[2] ?? 1, style: t[3] ?? c.realm.tree, rot: (t[0] * 7.1 + t[1]) % 6.28 });
        trees.push(...scatterBackground(c, P, c.seed, q >= 1 ? 1 : 0.5));
        this.trees = instancedTrees(trees, P);
        this.root.add(this.trees);
        // props
        for (const [x, z, r] of c.hole.rocks ?? []) { const m = rockMesh(r, P.key === 'cinder' ? '#4a3a3e' : '#9a9088', x); m.position.set(x, c.heightAt(x, z) + r * 0.2, z); this.root.add(m); }
        for (const C of c.statics) if (C.kind === 'box') {
            const m = toonMesh([part(new THREE.BoxGeometry(C.hx * 2, C.hy * 2, C.hz * 2), P.key === 'sky' ? '#ece4f4' : '#a89880')], { outline: 0.04 });
            m.position.set(C.x, C.y, C.z); m.rotation.y = C.yaw; this.root.add(m);
        }
        for (const [x, z, s = 1] of c.hole.springs ?? []) { const m = springMesh(s); m.position.set(x, c.heightAt(x, z), z); this.root.add(m); }
        for (const [x, z, y, r = 1.4] of c.hole.bumpers ?? []) { const m = bumperMesh(r); m.position.set(x, c.heightAt(x, z) + y, z); m.userData.bob = Math.random() * 6; this.root.add(m); (this.bumpers ??= []).push(m); }
        this.bumpers = this.bumpers ?? [];
        this.mills = c.windmills.map((w) => { const m = windmillMesh(); m.position.set(w.x, w.y, w.z); m.rotation.y = w.yaw + Math.PI; this.root.add(m); return { m, w }; });
        // the sim's blades face the tee: hub at −forward. Our mesh's hub is at +z, so it is turned to face −forward.
        this.geysers = c.geysers.map((g) => { const m = geyserMesh(); m.position.set(g.x, g.y, g.z); this.root.add(m); return { m, g, was: false }; });
        this.runes = c.runes.flatMap((r) => [[r.ax, r.ay, r.az], [r.bx, r.by, r.bz]].map(([x, y, z]) => { const m = runeMesh(); m.position.set(x, y + 0.06, z); this.root.add(m); return m; }));
        for (const d of c.hole.decor ?? []) {
            const [kind, x, z, rot = 0, s = 1] = d;
            const m = decorMesh(kind, P);
            if (!m) continue;
            m.position.set(x, c.heightAt(x, z), z); m.rotation.y = rot; m.scale.setScalar(s);
            this.root.add(m);
        }
        const tee = teeBoxMesh(P);
        tee.position.set(c.tee.x, c.tee.y, c.tee.z); tee.rotation.y = c.teeYaw;
        this.root.add(tee);
        this.flag = flagMesh(['#ff3a4a', '#ff8a2a', '#3a8aff', '#ffd040', '#c85aff'][c.hole.realm]);
        this.flag.position.set(c.cup.x, c.cup.y, c.cup.z);
        this.root.add(this.flag);
        this.seal = null;
        if (c.hole.boss) { this.seal = sealMesh(); this.seal.position.copy(this.flag.position); this.root.add(this.seal); }
        // pickups
        this.pickups = world.s.pickups.map((p) => {
            let m;
            if (p.kind === 'coin') m = toonMesh([part(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 16).rotateX(Math.PI / 2), '#ffd040')], { outline: 0.03, emissive: '#7a5000', emissiveIntensity: 0.5 });
            else if (p.kind === 'gem') m = toonMesh([part(new THREE.OctahedronGeometry(0.5, 0), '#ff4ad8')], { outline: 0.03, emissive: '#80104a', emissiveIntensity: 0.8 });
            else if (p.kind === 'orb') m = toonMesh([part(sph(0.4, 14, 10), '#6ab0ff')], { outline: 0.03, emissive: '#2050c0', emissiveIntensity: 0.45 });
            else m = toonMesh([part(new THREE.OctahedronGeometry(0.55, 0), ITEM_COL[p.item] ?? '#ffffff', [0, 0, 0], [0, 0, 0], [0.7, 1.3, 0.7])], { outline: 0.03, emissive: ITEM_COL[p.item] ?? '#ffffff', emissiveIntensity: 0.6 });
            m.position.set(p.x, p.y, p.z);
            this.root.add(m);
            return m;
        });
        // monsters
        this.mons = world.s.mons.map((mo) => { const rig = buildMonster(mo.kind); rig.root.scale.setScalar(1.35); this.root.add(rig.root); return rig; });
        // boss
        this.boss = null;
        if (world.s.boss) this.buildBoss(world);
        this.patchMeshes = [];
        // hero + Wedgewick
        const look = LOOKS[profile.look] ?? LOOKS[0];
        this.hero = buildHumanoid(heroLook(look, OUTFITS[profile.outfit] ?? OUTFITS[0]));
        this.hero.root.scale.setScalar(HERO_SCALE);
        setPose(this.hero, 'address');
        this.root.add(this.hero.root);
        this.wedge = buildWedgewick();
        this.wedge.root.scale.setScalar(1.3);
        this.root.add(this.wedge.root);
        // ball, shadow, aim helpers
        this.root.add(this.ball, this.ballShadow, this.arcDots, this.landRing, this.aimArrow, ...this.ticks);
        this.fx.trail.cam = this.R.camera;
        this.fx.trail.reset();
        this.heroAt = null;
        this.arcKey = '';
        this.lastPhase = '';
        this.dir.groundAt = (x, z) => Math.max(c.heightAt(x, z), c.sky ? -20 : -1e9);
        this.dir.baseFov = 52;
        this.placeHeroAtBall(true);
        this.R.focusShadow(new THREE.Vector3(c.tee.x, c.tee.y, c.tee.z));
    }

    buildBoss(world) {
        const b = world.s.boss, c = this.c;
        const B = { kind: b.kind, rigs: [], extra: [] };
        if (b.kind === 'gopher') {
            B.main = buildBoss('gopher'); B.main.root.scale.setScalar(1.15);
            this.root.add(B.main.root);
            B.hills = b.hills.map((h) => { const m = moleHillMesh(); m.position.set(h.x, h.y, h.z); this.root.add(m); return m; });
        } else if (b.kind === 'worm') {
            B.main = buildBoss('worm');
            this.root.add(B.main.root);
            B.segs = [];
            for (let i = 0; i < 7; i++) { const m = wormSegment(i); this.root.add(m); B.segs.push(m); }
        } else if (b.kind === 'yeti') {
            B.main = buildBoss('yeti');
            B.main.root.position.set(b.x, c.heightAt(b.x, b.z), b.z);
            B.main.root.rotation.y = Math.PI;
            this.root.add(B.main.root);
            B.walls = b.wallDefs.map(([x1, z1, x2, z2]) => {
                const len = Math.hypot(x2 - x1, z2 - z1);
                const m = iceWallMesh(len);
                m.position.set((x1 + x2) / 2, Math.min(c.heightAt(x1, z1), c.heightAt(x2, z2)) + 1.3, (z1 + z2) / 2);
                m.rotation.y = Math.atan2(x2 - x1, z2 - z1);
                this.root.add(m);
                return m;
            });
            // the throne
            const th = toonMesh([part(new THREE.BoxGeometry(5, 5.5, 1.2), '#bfe8ff', [0, 2.7, -1.9]), part(new THREE.BoxGeometry(5.6, 0.8, 4), '#d8f0ff', [0, 0.4, 0]), ...[-1, 1].map((sx) => part(new THREE.ConeGeometry(0.5, 1.6, 6), '#e8f8ff', [sx * 2.2, 6.2, -1.9]))], { outline: 0.05 });
            th.position.copy(B.main.root.position); th.rotation.y = Math.PI;
            this.root.add(th);
        } else if (b.kind === 'ogre') {
            B.main = buildBoss('ogre');
            B.main.root.position.set(b.x, c.heightAt(b.x, b.z), b.z);
            B.main.root.rotation.y = Math.PI;
            this.root.add(B.main.root);
        } else if (b.kind === 'bogey') {
            B.lord = buildHumanoid(CAST.bogey);
            B.lord.root.scale.setScalar(1.8);
            setPose(B.lord, 'float');
            this.root.add(B.lord.root);
            B.shields = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), toonMat({ color: '#c060ff', emissive: '#8020ff', emissiveIntensity: 0.9 })); this.root.add(m); return m; });
            B.main = buildBoss('dragon');
            const [dx, dz] = b.dragon;
            B.main.root.position.set(dx, c.heightAt(dx, dz), dz);
            B.main.root.rotation.y = Math.PI;
            B.main.root.visible = b.phase === 2;
            this.root.add(B.main.root);
            B.necks = [0, 1, 2].map((i) => { const arr = []; for (let k = 0; k < 4; k++) { const m = neckSegment(['#e04a2a', '#4ab0f0', '#4ad070'][i]); this.root.add(m); arr.push(m); } return arr; });
        }
        this.boss = B;
    }

    placeHeroAtBall(snap = false) {
        const B = this.world.s.ball, yaw = this.world.s.aimYaw;
        const dx = Math.sin(yaw), dz = Math.cos(yaw);
        const fx = -dz, fz = dx;   // golfer faces right of the aim line, target to their left
        const off = 0.95 * HERO_SCALE * 0.75;
        const tx = B.x - fx * off, tz = B.z - fz * off;
        const ty = this.c.heightAt(tx, tz);
        const h = this.hero.root;
        if (snap || !this.heroAt) { h.position.set(tx, ty, tz); this.heroAt = new THREE.Vector3(tx, ty, tz); }
        this.heroAt.set(tx, Math.max(ty, this.c.sky ? B.y - 0.2 : ty), tz);
        this.heroYaw = Math.atan2(fx, fz);
    }

    // ------------------------------------------------------------------ per frame
    sync(dt, t, ui) {
        const w = this.world, s = w.s, c = this.c;
        TERRAIN_U.uWind.value.set(s.wind.x, s.wind.z);
        // ball
        const B = s.ball;
        this.ball.position.set(B.x, B.y, B.z);
        this.ball.visible = B.state !== 'holed' || s.phaseT < 0.2;
        const gy = c.heightAt(B.x, B.z);
        const ground = gy < -60 ? null : gy;
        this.ballShadow.visible = ground !== null && B.state !== 'holed';
        if (ground !== null) {
            const hgt = Math.max(0, B.y - ground);
            this.ballShadow.position.set(B.x, ground + 0.04, B.z);
            const k = 1 + hgt * 0.06;
            this.ballShadow.scale.setScalar(k);
            this.ballShadow.material.opacity = Math.max(0.12, 0.45 - hgt * 0.012);
        }
        if (s.phase === 'flight' && B.state === 'moving') {
            this.fx.trail.push(B.x, B.y, B.z);
            if (s.fx.fire) this.fx.preset('fire', B.x, B.y, B.z);
            if (s.fx.frost) this.fx.preset('frost', B.x, B.y, B.z);
            if (s.fx.seek) this.fx.preset('seek', B.x, B.y, B.z);
        } else this.fx.trail.fade();
        // pickups
        s.pickups.forEach((p, i) => {
            const m = this.pickups[i];
            if (p.got) { if (m.visible) { m.visible = false; } return; }
            m.rotation.y = t * 2.4 + i;
            m.position.y = p.y + Math.sin(t * 2 + i) * 0.12;
        });
        // monsters
        s.mons.forEach((mo, i) => {
            const rig = this.mons[i];
            if (!mo.alive) { rig.root.visible = false; return; }
            monsterPos(c, mo, s.time, _mp);
            const M = MONSTERS[mo.kind];
            rig.root.position.set(_mp.x, _mp.y - M.h * 0.9, _mp.z);
            rig.root.rotation.y = _mp.face;
            animateMonster(rig, s.time + i, _mp.hop);
        });
        // windmills
        for (const { m, w: wm } of this.mills) m.userData.hub.rotation.z = -s.time * (wm.speed ?? 0.9);
        // geysers
        for (const G of this.geysers) {
            const on = geyserActive(G.g, s.time);
            if (on) { if (Math.random() < dt * 30) this.fx.preset('steam', G.g.x, G.g.y + 0.6, G.g.z); }
            else if (Math.random() < dt * 2) this.fx.burst('wisp', G.g.x, G.g.y + 0.6, G.g.z, 1, { color: '#e8e0e0', speed: 0.6, up: 2, life: 1.2, size: 0.9, grow: 1.5, g: -2, alpha: 0.4 });
            G.was = on;
        }
        for (const r of this.runes) r.material.uniforms.uTime.value = t;
        for (const m of this.bumpers) m.position.y += Math.sin(t * 1.5 + m.userData.bob) * 0.005;
        this.flag.userData.uTime.value = t;
        this.flag.userData.cloth.rotation.y = Math.atan2(s.wind.x, s.wind.z) - Math.PI / 2 + (s.wind.speed < 0.5 ? 0.5 : 0);
        if (this.seal) {
            this.seal.material.uniforms.uTime.value = t;
            const target = s.sealed ? 1 : 0;
            const f = this.seal.material.uniforms.uFade;
            f.value += (target - f.value) * Math.min(1, dt * 3);
            this.seal.visible = f.value > 0.02;
            this.seal.scale.setScalar(1 + (1 - f.value) * 0.6);
        }
        // snow patches
        while (this.patchMeshes.length < s.patches.length) {
            const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), toonMat({ color: '#ffffff' }));
            m.receiveShadow = true;
            this.root.add(m); this.patchMeshes.push(m);
        }
        this.patchMeshes.forEach((m, i) => {
            const p = s.patches[i];
            m.visible = !!p;
            if (p) { m.position.set(p.x, c.heightAt(p.x, p.z) + 0.06, p.z); m.scale.setScalar(Math.min(p.r, m.scale.x + dt * 8)); }
        });
        this.syncBoss(dt, t);
        // hero
        const h = this.hero;
        const hp = h.root.position;
        if (this.heroAt) {
            const d = hp.distanceTo(this.heroAt);
            if (d > 0.05) {
                const sp = Math.min(d, dt * Math.max(12, d * 3));
                const dir = new THREE.Vector3().subVectors(this.heroAt, hp).normalize();
                hp.addScaledVector(dir, sp);
                hp.y = this.heroAt.y;
                h.root.rotation.y = Math.atan2(dir.x, dir.z);
                if (h.pose !== 'walk' && d > 0.4) setPose(h, 'walk');
            } else {
                h.root.rotation.y += (this.wrapAng(this.heroYaw - h.root.rotation.y)) * Math.min(1, dt * 10);
                if (h.pose === 'walk') setPose(h, s.phase === 'aim' ? 'address' : 'idle');
            }
        }
        animate(h, dt, t);
        // Wedgewick floats at the hero's shoulder
        const wr = this.wedge.root;
        const side = this.heroYaw ?? 0;
        const wx = hp.x + Math.sin(side + 2.2) * 1.6, wz = hp.z + Math.cos(side + 2.2) * 1.6;
        wr.position.x += (wx - wr.position.x) * Math.min(1, dt * 3);
        wr.position.z += (wz - wr.position.z) * Math.min(1, dt * 3);
        wr.position.y += (hp.y + 2.2 - wr.position.y) * Math.min(1, dt * 3);
        wr.rotation.y = Math.atan2(this.R.camera.position.x - wr.position.x, this.R.camera.position.z - wr.position.z);
        animateWedge(this.wedge, dt, t, ui?.talking);
        // aim helpers
        this.syncAim(ui);
        this.R.focusShadow(this.dir.look);
    }

    wrapAng(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

    syncAim(ui) {
        const w = this.world, s = w.s;
        const show = s.phase === 'aim' && ui && !ui.hideAim;
        this.arcDots.visible = this.landRing.visible = this.aimArrow.visible = show;
        this.ticks.forEach((m) => (m.visible = show));
        if (!show) return;
        const B = s.ball;
        const fx = { ...w.baseFx() };
        if (s.armed.spell === 'ward') fx.windK = 0;
        if (s.armed.item === 'rocket') fx.rocket = true;
        const key = `${B.x.toFixed(2)},${B.z.toFixed(2)},${s.aimYaw.toFixed(4)},${s.club},${fx.rocket}`;
        if (key !== this.arcKey) {
            this.arcKey = key;
            const from = { x: B.x, y: B.y, z: B.z };
            const pr = predictArc(this.c, from, s.club, s.aimYaw, w.d, fx);
            this.arc = pr;
            const frac = s.club === 'putter' ? 1 : w.d.arcFrac;
            const n = Math.max(2, Math.floor(pr.pts.length * frac));
            const step = Math.max(1, Math.ceil(n / 70));
            const m4 = new THREE.Matrix4();
            let k = 0;
            for (let i = 1; i < n && k < 80; i += step) { const p = pr.pts[i]; m4.makeTranslation(p[0], p[1], p[2]); this.arcDots.setMatrixAt(k++, m4); }
            this.arcDots.count = k;
            this.arcDots.instanceMatrix.needsUpdate = true;
            if (pr.land) {
                this.landRing.position.set(pr.land[0], this.c.heightAt(pr.land[0], pr.land[2]) + 0.08, pr.land[2]);
                const fuzz = s.club === 'putter' ? 0.6 : 1.2 + (1 - w.d.arcFrac) * 5;
                this.landRing.userData.base = fuzz;
            }
            // 50% and 75% power marks (full shots only)
            this.ticks.forEach((m, i) => { m.visible = false; m.userData.p = null; });
            if (s.club !== 'putter') {
                [0.5, 0.75].forEach((p, i) => {
                    const sp = predictArcPower(this.c, from, s.club, s.aimYaw, w.d, fx, p);
                    if (sp) { const m = this.ticks[i]; m.position.set(sp[0], this.c.heightAt(sp[0], sp[2]) + 0.08, sp[2]); m.userData.p = true; }
                });
            }
        }
        this.ticks.forEach((m) => (m.visible = !!m.userData.p));
        const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.12;
        this.landRing.scale.setScalar((this.landRing.userData.base ?? 1) * pulse);
        this.landRing.visible = !!this.arc?.land;
        const yaw = s.aimYaw;
        this.aimArrow.position.set(B.x + Math.sin(yaw) * 1.6, this.c.heightAt(B.x + Math.sin(yaw) * 1.6, B.z + Math.cos(yaw) * 1.6) + 0.15, B.z + Math.cos(yaw) * 1.6);
        this.aimArrow.rotation.set(0, yaw, 0);
        const col = s.armed.spell ? SPELLS[s.armed.spell].color : s.armed.item ? ITEM_COL[s.armed.item] : '#ffffff';
        this.arcDots.material.color.set(col); this.landRing.material.color.set(col); this.aimArrow.material.color.set(col);
    }

    syncBoss(dt, t) {
        const B = this.boss;
        if (!B) return;
        const w = this.world, b = w.s.boss, c = this.c, cols = w.bossCols;
        const flashOf = (hurt) => (hurt > 0 ? Math.max(0, Math.sin(hurt * 25)) * 0.8 : 0);
        if (b.kind === 'gopher') {
            const C = cols[0];
            const r = B.main.root;
            const h = b.hills[b.at];
            const rise = b.hp <= 0 ? 0 : b.up ? Math.min(1, b.popT * 3) : Math.max(0, r.userData.rise ?? 0) - dt * 3;
            r.userData.rise = rise;
            r.position.set(h.x, h.y - 2.2 + rise * 2.2 + Math.sin(t * 3) * 0.06 * rise, h.z);
            r.visible = rise > 0.02;
            r.lookAt(this.ball.position.x, r.position.y, this.ball.position.z);
            B.main.flash.value = flashOf(b.hurtT);
            B.main.setExpr(b.hurtT > 0 ? 'hurt' : b.hp <= 0 ? 'sad' : 'angry');
        } else if (b.kind === 'worm') {
            const head = B.main.root;
            const p0 = BOSSES.worm.pose(w, b, 0, w.s.time);
            head.position.set(p0.x, p0.y, p0.z);
            const p1 = BOSSES.worm.pose(w, b, 1, w.s.time);
            head.lookAt(p0.x + (p0.x - p1.x), p0.y + 0.4, p0.z + (p0.z - p1.z));
            head.visible = b.hp > 0 || (B.deadT = (B.deadT ?? 0) + dt) < 1.5;
            for (let k = 0; k < B.segs.length; k++) {
                const p = BOSSES.worm.pose(w, b, k + 1, w.s.time);
                B.segs[k].position.set(p.x, p.y, p.z);
                B.segs[k].visible = head.visible;
            }
            B.main.flash.value = flashOf(b.hurtT);
            B.main.setExpr(b.hurtT > 0 ? 'hurt' : 'angry');
        } else if (b.kind === 'yeti') {
            const r = B.main.root;
            r.scale.setScalar(1 + Math.sin(t * 2) * 0.02);
            r.visible = b.hp > 0 || (B.deadT = (B.deadT ?? 0) + dt) < 0.1;
            if (b.hp <= 0) r.visible = true, r.rotation.z = Math.min(0.4, (B.deadT ?? 0) * 0.5);
            B.main.flash.value = flashOf(b.hurtT);
            B.main.setExpr(b.hurtT > 0 ? 'hurt' : b.hp <= 0 ? 'sad' : b.throwT > 0 ? 'angry' : 'normal');
            B.walls.forEach((m, i) => {
                const hp = b.walls[i];
                const target = hp > 0 ? 1 : 0;
                m.scale.y += (target - m.scale.y) * Math.min(1, dt * 6);
                m.visible = m.scale.y > 0.03;
                m.material.opacity = hp === 1 ? 0.6 : 0.85;
            });
        } else if (b.kind === 'ogre') {
            const r = B.main.root;
            for (let i = 0; i < 2; i++) {
                const p = BOSSES.ogre.headPos(w, b, i, w.s.time);
                const hm = B.main.parts['head' + i];
                hm.position.set(p.x - r.position.x, p.y - r.position.y, p.z - r.position.z);
                // parts are in root space, root is rotated by π: mirror x/z
                hm.position.x *= -1; hm.position.z *= -1;
                if (b.heads[i] <= 0) hm.rotation.x = Math.min(1.2, hm.rotation.x + dt * 2);
                B.main.setExpr(b.hurt[i] > 0 ? 'hurt' : b.heads[i] <= 0 ? 'sad' : b.stompT > 0 ? 'angry' : i ? 'smug' : 'angry', i);
            }
            r.position.y = c.heightAt(b.x, b.z) + (b.stompT > 0 ? Math.abs(Math.sin(b.stompT * 6)) * 0.6 : 0);
            B.main.flash.value = flashOf(Math.max(b.hurt[0], b.hurt[1]));
        } else if (b.kind === 'bogey') {
            const lp = BOSSES.bogey.lordPos(w, b, w.s.time);
            const L = B.lord;
            L.root.visible = b.phase === 1 || b.transformT > 2.5;
            L.root.position.set(lp.x, lp.y - 1.4, lp.z);
            L.root.lookAt(this.ball.position.x, L.root.position.y, this.ball.position.z);
            L.flash.value = b.transformT > 0 ? 0.5 + Math.sin(t * 30) * 0.5 : flashOf(b.hurtT);
            L.setExpr(b.hurtT > 0 ? 'hurt' : b.transformT > 0 ? 'angry' : 'smug');
            animate(L, dt, t);
            B.shields.forEach((m, i) => { const S = cols[1 + i]; m.visible = !S.off; m.position.set(S.x, S.y, S.z); m.rotation.y = t * 3; m.scale.setScalar(0.92); });
            const D = B.main;
            D.root.visible = b.phase === 2 && b.transformT < 2.6;
            if (D.root.visible) {
                const rise = Math.min(1, (2.6 - Math.max(0, b.transformT)) / 2.6);
                D.root.scale.setScalar(0.3 + rise * 0.7);
                const r = D.root;
                for (let i = 0; i < 3; i++) {
                    const p = BOSSES.bogey.headPos(w, b, i, w.s.time);
                    const hm = D.parts['head' + i];
                    const lx = -(p.x - r.position.x) / r.scale.x, ly = (p.y - r.position.y) / r.scale.x, lz = -(p.z - r.position.z) / r.scale.x;
                    hm.position.set(lx, ly, lz);
                    if (b.heads[i] <= 0) hm.rotation.x = Math.min(1.3, hm.rotation.x + dt * 2);
                    // neck: from the body's shoulders to the head
                    const sx = (i - 1) * 1.6, sy = 3.6, sz = 0.6;
                    B.necks[i].forEach((m, k) => {
                        const u = (k + 1) / 5;
                        m.visible = true;
                        m.position.set(r.position.x - (sx + (lx - sx) * u) * r.scale.x, r.position.y + (sy + (ly - sy) * u + Math.sin(u * Math.PI) * 0.8) * r.scale.x, r.position.z - (sz + (lz - sz) * u) * r.scale.x);
                        m.scale.setScalar(r.scale.x);
                    });
                    D.setExpr(b.hurt[i] > 0 ? 'hurt' : b.heads[i] <= 0 ? 'sad' : b.breathT > 0 ? 'angry' : 'smug', i);
                }
                D.flash.value = flashOf(Math.max(...b.hurt));
            } else B.necks.forEach((arr) => arr.forEach((m) => (m.visible = false)));
        }
    }

    // ------------------------------------------------------------------ events
    onEvent(e) {
        const fx = this.fx, w = this.world;
        const P = this.P;
        const surfFx = (sid, x, y, z, k = 1) => {
            if (sid === SURF.sand || sid === SURF.dune || sid === SURF.quick) fx.preset('sand', x, y, z, k);
            else if (sid === SURF.snow) fx.preset('snow', x, y, z, k);
            else if (sid === SURF.ice) fx.preset('ice', x, y, z, k);
            else if (sid === SURF.cloud) fx.preset('poof', x, y, z);
            else if (sid === SURF.ash || sid === SURF.stone) fx.preset('dust', x, y, z, k);
            else fx.preset('grass', x, y, z, k);
        };
        switch (e.type) {
            case 'shot': {
                surfFx(w.lieSurf(), e.x, e.y, e.z, 0.6);
                if (e.perfect) { fx.preset('perfect', e.x, e.y, e.z); this.R.doFlash('#fff6c0', 0.25); }
                const sp = Object.keys(SPELL_TRAIL).find((k) => e.fx[k]);
                const [col, wd] = sp ? SPELL_TRAIL[sp] : e.fx.ghost ? ['#e8f0ff', 0.2] : e.fx.rocket ? ['#ff8a5a', 0.28] : w.d.comet ? ['#ffd84a', 0.3] : ['#ffffff', 0.16];
                fx.trail.reset(); fx.trail.setColor(col, wd);
                this.dir.fovKick = e.club === 'driver' ? 6 : 3;
                this.hero.setExpr(e.perfect ? 'happy' : Math.abs(e.acc) > 0.4 ? 'surprised' : 'focus');
                break;
            }
            case 'land': case 'bounce': surfFx(e.surf, e.x, e.y, e.z, Math.min(1.5, e.speed / 10)); break;
            case 'plug': surfFx(e.surf, e.x, e.y, e.z, 1.5); break;
            case 'thunk': fx.preset('sparkle', e.x, e.y, e.z, 0.4); if (e.tag === 'spring' || e.tag === 'bumper') fx.preset('magic', e.x, e.y, e.z, 0.6, '#d0a0ff'); break;
            case 'leaves': fx.preset('leaves', e.x, e.y, e.z); break;
            case 'burn': fx.preset('lava', e.x, e.y, e.z, 0.5); break;
            case 'frostSkate': fx.preset('ice', e.x, e.y, e.z, 2); break;
            case 'hazard':
                if (e.kind === 'water') fx.preset('splash', e.x, this.c.waterLevelAt(e.x, e.z), e.z);
                else if (e.kind === 'lava') fx.preset('lava', e.x, this.c.waterLevelAt(e.x, e.z), e.z);
                else if (e.kind === 'void') fx.preset('void', e.x, e.y, e.z);
                else fx.preset('dust', e.x, e.y, e.z, 1.5);
                this.hero.setExpr('sad'); setPose(this.hero, 'slump');
                break;
            case 'drop': fx.preset('poof', e.x, e.y, e.z); break;
            case 'holed': {
                const C = this.c.cup;
                fx.preset('confetti', C.x, C.y + 0.5, C.z);
                fx.preset('sparkle', C.x, C.y + 0.3, C.z, 2);
                this.R.doFlash('#ffffff', 0.3);
                this.hero.setExpr('happy'); setPose(this.hero, 'cheer');
                break;
            }
            case 'lipout': fx.preset('sparkle', e.x, this.c.cup.y + 0.2, e.z, 0.6); this.hero.setExpr('surprised'); break;
            case 'monsterHit': fx.preset('poof', e.x, e.y, e.z); fx.coinBurst(e.x, e.y + 0.5, e.z, Math.min(6, e.gold)); this.dir.shake = Math.max(this.dir.shake, 0.4); break;
            case 'pickup': fx.preset('sparkle', e.x, e.y, e.z, e.kind === 'coin' ? 0.5 : 1.2); if (e.kind === 'orb') fx.preset('magic', e.x, e.y, e.z, 0.8, '#6ab0ff'); break;
            case 'bossHit': fx.preset('hit', e.x, e.y, e.z); this.dir.shake = 0.9; this.R.doFlash('#ffffff', 0.2); if (e.fire) fx.preset('lava', e.x, e.y, e.z, 0.6); break;
            case 'wallHit': fx.preset('ice', e.x ?? this.ball.position.x, this.ball.position.y, this.ball.position.z, 3); this.dir.shake = 0.4; break;
            case 'bossAct': this.bossActFx(e); break;
            case 'bossDown': fx.preset('poof', e.x, e.y, e.z); fx.preset('firework', e.x, e.y + 3, e.z); fx.coinBurst(e.x, e.y + 1, e.z, 10); this.R.doFlash('#fff0c0', 0.7); this.dir.shake = 1.2; break;
            case 'sealBroken': fx.preset('magic', e.x, e.y + 1, e.z, 2, '#d080ff'); fx.preset('sparkle', e.x, e.y + 1, e.z, 2); break;
            case 'bossPhase': this.R.doFlash('#c080ff', 1); this.dir.shake = 1.5; fx.preset('magic', this.ball.position.x, this.ball.position.y, this.ball.position.z, 3, '#c080ff'); break;
            case 'geyser': fx.preset('steam', e.x, e.y + 0.5, e.z); fx.preset('splash', e.x, e.y + 0.3, e.z, 0.5); break;
            case 'rune': fx.preset('magic', e.ax, this.c.heightAt(e.ax, e.az) + 0.5, e.az, 1.5, '#8ad8ff'); fx.preset('magic', e.bx, this.c.heightAt(e.bx, e.bz) + 0.5, e.bz, 1.5, '#8ad8ff'); break;
            case 'spell': fx.preset('magic', e.x, e.y + 0.6, e.z, 1.5, SPELLS[e.id]?.color); this.wedge.setExpr('happy'); break;
            case 'kicked': fx.preset('dust', this.ball.position.x, this.ball.position.y, this.ball.position.z, 1.5); break;
        }
    }

    bossActFx(e) {
        const fx = this.fx, b = this.world.s.boss, c = this.c;
        switch (e.action) {
            case 'burrow': fx.preset('dust', e.x, c.heightAt(e.x, e.z) + 0.5, e.z, 2.5); break;
            case 'coil': this.dir.shake = 0.5; break;
            case 'snowball': fx.preset('snow', e.x, c.heightAt(e.x, e.z) + 0.3, e.z, 3); this.dir.shake = 0.4; break;
            case 'rebuild': fx.preset('ice', b.x, c.heightAt(b.x, b.z) + 1, b.z - 9, 3); break;
            case 'stomp': fx.preset('shock', e.x, c.heightAt(e.x, e.z), e.z); this.dir.shake = 1.2; break;
            case 'teleport': { const p = BOSSES.bogey.lordPos(this.world, b, this.world.s.time); fx.preset('magic', p.x, p.y, p.z, 2, '#c080ff'); break; }
            case 'fire': { const [x, z] = b.dragon; fx.burst('breath', x, c.heightAt(x, z) + 6, z - 3, 60, { colors: ['#ffe070', '#ff8a2a', '#ff4a1a'], speed: 14, up: 0.1, life: 1.0, size: 1.0, additive: true, g: -2, drag: 1 }); this.dir.shake = 0.8; break; }
            case 'frost': fx.preset('snow', e.x, c.heightAt(e.x, e.z) + 0.5, e.z, 3); break;
            case 'storm': { const [x, z] = b.dragon; fx.burst('storm', x + 3.4, c.heightAt(x, z) + 6, z - 2, 40, { colors: ['#c8ffe0', '#ffffff'], speed: 10, up: 0.3, life: 1.0, size: 0.5, additive: true, shape: 2, g: 0 }); this.R.doFlash('#e0fff0', 0.3); break; }
            case 'roar': this.dir.shake = 0.6; break;
        }
    }
}

// Landing point at a given power (for the 50% / 75% marks).
function predictArcPower(c, from, club, yaw, d, fx, p) {
    const d2 = { ...d, powMult: d.powMult * p };
    const pr = predictArc(c, from, club, yaw, d2, fx);
    return pr.land;
}
