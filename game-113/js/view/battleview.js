// The battle stage: a small theatre in the colours of the place the duel started. The band stands on the left in a
// diagonal line, Otto keeps time behind them, the enemy looms on the right. Everything pulses with the beat; every hit
// is a glowing note flying across the stage; Crescendo and the Colossus are as loud as the renderer can make them.

import * as THREE from 'three';
import { MAPS } from '../sim/data/maps.js';
import { CHARS } from '../sim/data/chars.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { maxHp } from '../sim/party.js';
import { THEMES, propPx, tileTexture } from './tiles.js';
import { shadowTexture, radialTexture } from './sprites.js';
import { Particles, Notes } from './fx.js';
import { billboard } from './fieldview.js';

const PX = 1 / 16;
const LANE_POS = [[-3.1, 0.9], [-4.3, 0.1], [-3.3, -0.7], [-4.5, -1.5]];
const LANE_COL = ['#ff6fa6', '#46e0cf', '#ffc23d', '#9b8cff'];
const ENEMY_POS = new THREE.Vector3(3.6, 0, -0.1);
const COL_POS = new THREE.Vector3(-1.6, 0, -5.4);     // the Colossus rises at the back, behind the band

export class BattleView {
    constructor(lib) {
        this.lib = lib;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
        this.particles = new Particles(this.scene);
        this.notes = new Notes(this.scene, this.particles);
        this.shadowTex = shadowTexture();
        this.glowTex = radialTexture();
        this.root = null;
        this.fxLayer = document.getElementById('fx-layer');
    }

    /** A fresh stage for a battle in the given map's theme. */
    build(G) {
        const B = G.battle;
        if (this.root) { this.scene.remove(this.root); this.root.traverse((o) => { o.geometry?.dispose?.(); }); }
        this.particles.clear(); this.notes.clear();
        const themeId = MAPS[G.map].theme;
        const T = this.T = THEMES[themeId];
        this.final = B.final;
        const root = this.root = new THREE.Group();
        this.scene.add(root);
        this.scene.background = new THREE.Color(T.sky).multiplyScalar(T.day ? 0.85 : 1);
        this.scene.fog = new THREE.Fog(T.fog, 14, 34);

        root.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2] * 0.9));
        const sun = new THREE.DirectionalLight(T.sun[0], T.sun[1] * 0.8);
        sun.position.set(-4, 10, 8); root.add(sun);
        this.enemyLight = new THREE.PointLight(0xff3a6a, 0, 9, 1.4); this.enemyLight.position.set(2.5, 2.5, 2); root.add(this.enemyLight);
        this.laneLights = LANE_POS.map(([x, z], i) => { const L = new THREE.PointLight(LANE_COL[i], 0.5, 5, 1.6); L.position.set(x + 0.6, 1.6, z + 1.2); root.add(L); return L; });

        // ---- the floor: tiles out to the fog, and a glowing stage ring under the band
        const ft = tileTexture(themeId, themeId === 'marisonde' ? 'ground' : 'path', 0).clone();
        ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(28, 14); ft.needsUpdate = true;
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 14), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.95 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -1); root.add(floor);
        const ringMat = new THREE.MeshBasicMaterial({ map: this.ringTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        this.partyRing = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), ringMat.clone());
        this.partyRing.rotation.x = -Math.PI / 2; this.partyRing.position.set(-3.4, 0.02, -0.1); root.add(this.partyRing);
        this.enemyRing = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), ringMat.clone());
        this.enemyRing.material.color.set(0xff4a7a);
        this.enemyRing.rotation.x = -Math.PI / 2; this.enemyRing.position.set(ENEMY_POS.x, 0.02, ENEMY_POS.z); root.add(this.enemyRing);

        // ---- the backdrop: the place's own scenery, behind
        const back = new THREE.Group();
        const prop = T.tree === 'palm' ? 'palm' : T.tree === 'oak' ? 'oak' : T.tree === 'pine' ? 'pine' : 'shroom';
        const P = this.lib.raw('prop|' + prop + '|' + themeId, () => propPx(prop, themeId));
        for (let i = 0; i < 12; i++) {
            const x = -11 + i * 2 + (i % 3) * 0.4, z = -5 - (i % 2) * 1.4;
            const b = billboard(P.tex, P.w * PX * 1.6, P.h * PX * 1.6, { emissive: prop === 'shroom' ? 0.8 : 0.15 });
            b.position.set(x, 0, z); back.add(b);
        }
        const wallMat = new THREE.MeshStandardMaterial({ map: tileTexture(themeId, 'cliff'), roughness: 1 });
        for (let i = 0; i < 9; i++) {
            const h = 3 + ((i * 37) % 5) * 0.6;
            const w = new THREE.Mesh(new THREE.BoxGeometry(3, h, 1.5), wallMat);
            w.position.set(-12 + i * 3, h / 2, -8.2); back.add(w);
        }
        if (!T.day) {
            const cm = new THREE.MeshStandardMaterial({ color: T.lightCol, emissive: T.lightCol, emissiveIntensity: 1.8, flatShading: true });
            this.backCrystals = [];
            for (let i = 0; i < 7; i++) {
                const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), cm);
                c.scale.set(0.8, 2.6, 0.8); c.position.set(-9 + i * 3, 0.8, -6.4 - (i % 2)); c.rotation.z = (i % 3 - 1) * 0.3;
                back.add(c); this.backCrystals.push(c);
            }
        }
        root.add(back);

        // ---- the band, Otto and the enemy
        this.party = LANE_POS.map(([x, z], i) => {
            const g = this.sprite(); g.group.position.set(x, 0, z); root.add(g.group);
            g.home = new THREE.Vector3(x, 0, z); g.lane = i; return g;
        });
        this.otto = this.sprite(); this.otto.group.position.set(-6.3, 0, -1.9); root.add(this.otto.group);
        this.otto.home = this.otto.group.position.clone();
        this.ottoGone = false;
        this.enemy = this.sprite(true); this.enemy.group.position.copy(ENEMY_POS); root.add(this.enemy.group);
        this.enemy.home = ENEMY_POS.clone();
        const ed = ENEMIES[B.enemy], ep = this.lib.monster(B.enemy, false);
        // size from the data, but never taller than the stage can frame
        this.enemyScale = Math.min((ed.size || 1.3) * 0.55, (ed.final ? 4.6 : ed.boss ? 3.5 : 2.6) / (ep.h * PX));
        this.enemy.home.set(ed.final ? 4.1 : ENEMY_POS.x, 0, ed.final ? -1.2 : ENEMY_POS.z);
        this.colossus = null;
        this.flashT = {}; this.desat = 0; this.cresT = 0; this.downT = 0; this.punch = 0; this.shake = 0; this.colRise = 0;
        this.enemyId = B.enemy;
        this.lastBeat = -99;
        this.hitStop = 0;
        this.beam = null;
    }

    ringTexture() {
        if (this._ring) return this._ring;
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const x = c.getContext('2d');
        x.translate(128, 128);
        const g = x.createRadialGradient(0, 0, 40, 0, 0, 128);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.12)'); g.addColorStop(0.9, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, 128, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 3;
        for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(70, 0); x.lineTo(84, 0); x.stroke(); }
        x.beginPath(); x.arc(0, 0, 62, 0, Math.PI * 2); x.stroke();
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        return (this._ring = t);
    }

    sprite(isEnemy = false) {
        const group = new THREE.Group();
        const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
        const mat = new THREE.MeshStandardMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.22 });
        const mesh = new THREE.Mesh(geo, mat); mesh.rotation.x = -0.12; group.add(mesh);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; group.add(sh);
        return { group, mesh, mat, sh, tex: null, flash: 0, hurt: 0, isEnemy, lunge: 0, pose: null };
    }
    setTex(s, e, scale) {
        if (s.tex !== e.tex) { s.mat.map = e.tex; s.mat.emissiveMap = e.tex; s.mat.needsUpdate = true; s.tex = e.tex; }
        s.mesh.scale.set(e.w * PX * scale, e.h * PX * scale, 1);
        s.sh.scale.set(e.w * PX * scale * 0.8, e.w * PX * scale * 0.35, 1);
        s.h = e.h * PX * scale;
    }

    /** World position of the top-middle of a lane's princess, or the enemy's chest. */
    lanePos(lane) { const s = this.party[lane]; return s.group.position.clone().add(new THREE.Vector3(0.1, 1.3, 0.2)); }
    enemyPos() { return this.enemy.group.position.clone().add(new THREE.Vector3(-0.2, (this.enemy.h || 2) * 0.5, 0.3)); }

    update(G, dt, time) {
        const B = G.battle;
        if (!B) return;
        if (!this.root || this.enemyId !== B.enemy || this.builtFor !== B) { this.build(G); this.builtFor = B; }
        const lib = this.lib;
        // the beat: 1 on the downbeat, decaying through the beat
        const beatF = B.t / B.spb;
        const phase = beatF - Math.floor(beatF);
        const pulse = B.t >= -0.01 && B.state !== 'talk' ? Math.exp(-phase * 6) : 0;
        const beat = Math.floor(beatF);
        if (beat !== this.lastBeat && B.t >= 0 && B.state === 'run') { this.lastBeat = beat; this.punch = beat % 4 === 0 ? 1 : 0.5; }
        this.punch = Math.max(0, this.punch - dt * 5);
        const cres = B.t < B.cresUntil;
        this.cresT = cres ? Math.min(1, this.cresT + dt * 3) : Math.max(0, this.cresT - dt * 2);
        const guard = B.ph.kind === 'guard';

        // ---- the band
        B.lanes.forEach((id, lane) => {
            const s = this.party[lane];
            if (!id) { s.group.visible = false; return; }
            s.group.visible = true;
            const st = G.party.st[id];
            const down = st.hp <= 0;
            let pose = down ? 'ko' : s.hurt > 0 ? 'hurt' : s.flash > 0.2 && !guard ? 'play' : 'idle';
            if (B.state === 'win' || G.mode === 'results') pose = 'cheer';
            const view = pose === 'cheer' ? 'down' : 'side';
            this.setTex(s, lib.person(id, view, 0, pose, false), 1.0);
            const bob = down ? 0 : pulse * 0.08 + Math.sin(time * 3 + lane) * 0.02;
            s.hurt = Math.max(0, s.hurt - dt * 2.5); s.flash = Math.max(0, s.flash - dt * 3);
            s.group.position.set(s.home.x - s.hurt * 0.4, bob, s.home.z);
            s.mat.color.setRGB(1, down ? 0.55 : 1 - s.hurt * 0.5, down ? 0.6 : 1 - s.hurt * 0.5);
            s.mat.emissiveIntensity = 0.22 + s.flash * 0.6 + (cres ? 0.25 : 0);
            this.laneLights[lane].intensity = down ? 0 : 0.35 + s.flash * 3 + pulse * (guard ? 0.2 : 0.8) + this.cresT * 1.5;
        });

        // ---- Otto keeps time at the back (until he leaves on his errand)
        if (!this.ottoGone || this.otto.group.position.x > -14) {
            this.setTex(this.otto, lib.person('otto', 'side', B.state === 'run' ? Math.floor(beatF) % 2 : 0, null, this.ottoGone), 0.85);
            if (this.ottoGone) this.otto.group.position.x -= dt * 7;
            else this.otto.group.position.y = pulse * 0.1;
        }
        this.otto.group.visible = !this.colossus && this.otto.group.position.x > -14;

        // ---- the enemy
        const en = this.enemy;
        const dead = B.state === 'win' || G.mode === 'results';
        this.setTex(en, lib.monster(B.enemy, false), this.enemyScale * (1 + pulse * 0.02));
        en.flash = Math.max(0, en.flash - dt * 5); en.lunge = Math.max(0, en.lunge - dt * 4);
        if (dead) this.downT = Math.min(1, this.downT + dt * 0.8);
        const breathe = Math.sin(time * 2) * 0.05;
        en.group.position.set(en.home.x - en.lunge * 0.8 + (Math.random() - 0.5) * en.flash * 0.25, (ENEMIES[B.enemy].sprite === 'wisp' || ENEMIES[B.enemy].sprite === 'moth' || ENEMIES[B.enemy].sprite === 'jelly' ? 0.4 + Math.sin(time * 2.2) * 0.2 : 0) + breathe, en.home.z);
        en.mat.emissiveIntensity = 0.25 + en.flash * 1.6;
        en.mat.opacity = 1;
        en.group.visible = !(dead && this.downT >= 1);
        if (dead) { en.group.scale.setScalar(1 + this.downT * 0.2); en.mat.color.setScalar(1 - this.downT * 0.6); }
        else { en.group.scale.setScalar(1); en.mat.color.setScalar(1); }
        this.enemyLight.intensity = guard ? 1.6 + pulse * 2.5 : 0.3;

        // ---- rings and the backdrop pulse
        this.partyRing.material.opacity = 0.35 + pulse * (guard ? 0.15 : 0.6) + this.cresT * 0.5;
        this.partyRing.material.color.setHSL(cres ? (time * 0.5) % 1 : 0.88, cres ? 0.9 : 0.6, 0.65);
        this.partyRing.rotation.z += dt * (0.2 + this.cresT * 2);
        this.enemyRing.material.opacity = guard ? 0.35 + pulse * 0.6 : 0.15;
        this.enemyRing.rotation.z -= dt * 0.3;
        if (this.backCrystals) for (const c of this.backCrystals) c.material.emissiveIntensity = 1.2 + pulse * 1.6 + this.cresT * 2;

        // ---- the Colossus
        if (this.colossus) {
            this.colRise = Math.min(1, this.colRise + dt * 0.35);
            const e = this.colossus;
            const y = -9 + 9 * easeOut(this.colRise);
            e.group.position.set(COL_POS.x, y + pulse * 0.08, COL_POS.z);
            e.mat.emissiveIntensity = 0.35 + pulse * 0.25 + e.flash;
            e.flash = Math.max(0, e.flash - dt * 3);
            if (this.colRise < 1 && Math.random() < 0.6) this.particles.emit(COL_POS.x + (Math.random() - 0.5) * 6, 0.2, COL_POS.z + 0.6, { n: 2, color: 0xc8a070, speed: 2, life: 1, size: 0.35, gravity: 3, lift: 3 });
        }
        if (this.beam) {
            this.beam.t -= dt;
            this.beam.mesh.material.opacity = Math.max(0, this.beam.t / 0.35);
            this.beam.mesh.scale.y = 1 + Math.random() * 0.3;
            if (this.beam.t <= 0) { this.root.remove(this.beam.mesh); this.beam = null; }
        }

        // ---- the Hush drains the colour
        const hushing = B.final && B.stage === 'hush';
        this.desat += ((hushing ? 0.8 : 0) - this.desat) * Math.min(1, dt * 1.5);

        // ---- camera: a narrow lens in landscape; a wide one in portrait, with the stage lifted above the highway
        const asp = this.camera.aspect;
        const portrait = asp < 1;
        const fov = portrait ? 52 : 30;
        if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
        // fit the stage (about 11.5 units wide) to the screen
        const halfW = portrait ? 5.3 : 6.2;
        const dist = Math.max(portrait ? 9 : 11.5, halfW / (Math.tan((fov * Math.PI) / 360) * asp) * 0.98);
        const sway = Math.sin(time * 0.35) * 0.5;
        const orbit = this.cresT * Math.sin(time * 0.8) * 1.4;
        this.shake = Math.max(0, this.shake - dt * 3);
        const sh = this.shake * 0.25;
        const z = dist * (1 - this.punch * 0.012) - this.cresT * 0.8;
        this.camera.position.set(sway + orbit + (Math.random() - 0.5) * sh, 2.6 + dist * 0.12 + (Math.random() - 0.5) * sh, z);
        this.camera.lookAt(-0.2 + sway * 0.3, 1.25, -0.4);
        const W = this.vw || 1, H = this.vh || 1;
        if (portrait) this.camera.setViewOffset(W, H, 0, H * 0.2, W, H); else this.camera.clearViewOffset();
        this.portrait = portrait;
        this.scene.fog.near = dist + 3; this.scene.fog.far = dist + 26;

        this.particles.update(dt);
        this.notes.update(dt);
    }

    gradeOpts(G) {
        const T = this.T || THEMES.beach;
        return { bloom: (T.grade.bloom || 0.5) + this.cresT * 0.5 + this.punch * 0.08, warm: T.grade.warm, dusk: T.grade.dusk, desat: this.desat, vig: 0.85, focus: this.portrait ? 0.72 : 0.55, range: this.portrait ? 0.12 : 0.3, blur: 1.6, exposure: T.day ? 1.0 : 1.08 };
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events, stage) {
        const B = G.battle;
        for (const e of events) {
            if (e.type === 'battleStart') { this.root = null; continue; }
            if (!B || !this.root) continue;
            switch (e.type) {
                case 'judge': {
                    if (e.side === 'party') {
                        const s = this.party[e.lane]; s.flash = 1;
                        const col = CHARS[e.who]?.color || '#ffffff';
                        const from = this.lanePos(e.lane), to = this.enemyPos();
                        this.particles.emit(from.x, from.y, from.z, { n: e.j === 'perfect' ? 14 : 7, color: col, speed: 2.2, life: 0.4, size: 0.12, gravity: 0 });
                        if (!e.hold) this.notes.fly(from, to, col, { size: e.j === 'perfect' ? 0.7 : 0.5, arc: 0.8 + e.lane * 0.25, dur: 0.34, onHit: () => this.hitEnemy(col, e.j === 'perfect' ? 1 : 0.6) });
                    } else {
                        const s = this.party[e.lane]; if (!s) break;
                        this.enemy.lunge = 1;
                        const v = this.lanePos(e.lane);
                        const col = e.j === 'perfect' ? 0xffffff : LANE_COL[e.lane];
                        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; this.particles.emit(v.x + 0.5, v.y, v.z, { n: 1, color: col, vel: [0.4, Math.sin(a) * 2.2, Math.cos(a) * 2.2], spread: 0.1, life: 0.35, size: 0.12, gravity: 0, drag: 3 }); }
                        if (e.j === 'perfect') this.notes.fly(this.enemyPos(), v, 0xffffff, { size: 0.4, dur: 0.18, arc: 0.3, glyph: 2 });
                    }
                    break;
                }
                case 'hit':
                    this.popNumber(this.enemyPos(), e.dmg, e.big ? 'big' : e.cres ? 'cres' : '');
                    break;
                case 'hurt': {
                    const s = this.party[e.lane]; if (!s) break;
                    this.enemy.lunge = 1;
                    if (e.dmg > 0) { s.hurt = 1; this.shake = Math.max(this.shake, 0.6); const v = this.lanePos(e.lane); this.particles.emit(v.x, v.y, v.z, { n: 18, color: 0xff3a4a, speed: 3, life: 0.5, size: 0.12, gravity: 3 }); this.popNumber(v, e.dmg, 'hurt'); stage.kick(0.18); }
                    if (e.soak > 0) { const v = this.lanePos(e.lane); this.particles.emit(v.x + 0.4, v.y, v.z, { n: 10, color: 0xffc23d, speed: 2, life: 0.4, size: 0.12, gravity: 0 }); }
                    break;
                }
                case 'heal': {
                    const lane = CHARS[e.who].lane; const v = this.lanePos(lane);
                    this.particles.emit(v.x, v.y - 0.6, v.z, { n: 10, color: 0x7affb0, vel: [0, 1.6, 0], spread: 0.6, life: 0.7, size: 0.12, gravity: 0, box: 0.6 });
                    if (e.amt >= 3) this.popNumber(v, '+' + e.amt, 'heal');
                    break;
                }
                case 'ko': { const v = this.lanePos(e.lane); this.particles.emit(v.x, v.y, v.z, { n: 30, color: 0x8a8aa8, speed: 2, life: 0.9, size: 0.18, gravity: -0.5 }); this.shake = 0.8; break; }
                case 'revive': { const v = this.lanePos(CHARS[e.who].lane); this.particles.emit(v.x, v.y, v.z, { n: 40, color: 0xffd35c, speed: 2.5, life: 1, size: 0.16, gravity: -1 }); break; }
                case 'crescendo': {
                    stage.flash(1, 0.9, 1, 0.8); this.shake = 1.2;
                    for (let i = 0; i < 4; i++) { const v = this.lanePos(i); this.particles.emit(v.x, v.y, v.z, { n: 50, color: LANE_COL[i], speed: 5, life: 1.2, size: 0.2, gravity: -0.5 }); }
                    break;
                }
                case 'enemyDown': {
                    const v = this.enemyPos();
                    this.particles.emit(v.x, v.y, v.z, { n: 200, color: B.boss ? 0xffd35c : 0xffffff, speed: 6, life: 1.6, size: 0.22, gravity: 1, box: 1.5 });
                    stage.flash(1, 1, 1, 0.7); this.shake = 1.4; this.downT = 0;
                    break;
                }
                case 'bandDown': stage.flash(0.2, 0, 0.1, 0.6); break;
                case 'colossusHit': this.colossusBlast(e.j, stage); break;
                case 'fx': this.fx(e.name, stage, G); break;
                case 'phrase':
                    if (e.kind === 'guard') { const v = this.enemyPos(); this.particles.emit(v.x, 0.3, v.z, { n: 30, color: 0xff3a6a, speed: 2.5, life: 0.7, size: 0.18, gravity: -1, box: 1.5 }); }
                    break;
                default: break;
            }
        }
    }

    hitEnemy(col, k) {
        const en = this.enemy; en.flash = Math.max(en.flash, k);
        const v = this.enemyPos();
        this.particles.emit(v.x, v.y, v.z, { n: Math.round(14 * k) + 4, color: col, speed: 4, life: 0.5, size: 0.15, gravity: 2 });
    }

    colossusBlast(j, stage) {
        if (!this.colossus) return;
        this.colossus.flash = 1;
        // from the Colossus's chest, where Otto's eye now is
        const from = new THREE.Vector3(COL_POS.x, this.colossus.h * 0.5, COL_POS.z + 0.5), to = this.enemyPos();
        const len = from.distanceTo(to);
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, len, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9affff).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        mesh.position.copy(from).lerp(to, 0.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        this.root.add(mesh);
        if (this.beam) this.root.remove(this.beam.mesh);
        this.beam = { mesh, t: 0.35 };
        this.particles.emit(to.x, to.y, to.z, { n: 90, color: 0x9affff, speed: 6, life: 0.9, size: 0.22, gravity: 1 });
        this.enemy.flash = 1.5; this.shake = 1.1; stage.flash(0.7, 1, 1, 0.35); stage.kick(0.3);
    }

    fx(name, stage, G) {
        if (name === 'hushwave') {
            for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; this.particles.emit(ENEMY_POS.x, 1, ENEMY_POS.z, { n: 1, color: 0x6a2aff, vel: [Math.cos(a) * 8, Math.sin(a) * 2, Math.sin(a) * 3], spread: 0.2, life: 1.2, size: 0.3, gravity: 0, drag: 0.6 }); }
            stage.flash(0.1, 0.0, 0.2, 0.8); this.shake = 1.4;
        } else if (name === 'ottoLeave') { this.ottoGone = true; this.particles.emit(this.otto.group.position.x, 0.4, this.otto.group.position.z, { n: 30, color: 0xc8a070, speed: 2, life: 0.8, size: 0.25, gravity: 2 }); }
        else if (name === 'quake') { this.shake = 2; stage.kick(0.6); }
        else if (name === 'colossus') {
            const c = this.colossus = this.sprite();
            this.setTex(c, this.lib.raw('m|colossus', () => { return import_colossus(); }), 1.25);
            c.mat.emissiveIntensity = 0.35;
            c.group.position.set(COL_POS.x, -9, COL_POS.z);
            this.root.add(c.group);
            this.colRise = 0;
            const L = new THREE.PointLight(0x9affff, 3, 16, 1.2); L.position.set(COL_POS.x, 6, COL_POS.z + 3); this.root.add(L);
            stage.flash(1, 0.95, 0.7, 0.9); this.shake = 2;
        } else if (name === 'revive') {
            for (let i = 0; i < 4; i++) { const v = this.lanePos(i); this.particles.emit(v.x, v.y, v.z, { n: 60, color: 0xffd35c, speed: 3, life: 1.4, size: 0.2, gravity: -1 }); }
            stage.flash(1, 0.9, 0.6, 0.7);
        }
    }

    popNumber(world, value, cls) {
        if (!this.fxLayer) return;
        const v = world.clone().project(this.camera);
        if (v.z > 1) return;
        const r = this.fxLayer.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = 'pop ' + cls;
        el.textContent = value;
        el.style.left = `${(v.x * 0.5 + 0.5) * r.width + (Math.random() - 0.5) * 30}px`;
        el.style.top = `${(-v.y * 0.5 + 0.5) * r.height + (Math.random() - 0.5) * 16}px`;
        this.fxLayer.appendChild(el);
        setTimeout(() => el.remove(), 900);
        while (this.fxLayer.childElementCount > 40) this.fxLayer.firstChild.remove();
    }

    resize(w, h) { this.vw = w; this.vh = h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.particles.setScale(h); }
}

import { drawMonster } from './monsters.js';
import { assetPx } from './assets.js';
function import_colossus() { return assetPx('monster/colossus') || drawMonster('colossus'); }
const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
