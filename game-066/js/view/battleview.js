// The battle stage. Plays back the battle engine's event list with animation: bots materialise from
// a beam of light, lunge, fire beams and bolts and fireballs coloured by type, flinch, and when they
// shut down they come apart — every part falls, bounces and scatters. Capture spikes fly, drain the
// bot into themselves and shake. Atmospheres (heatwave, acid rain, dust, static, smog) change the
// sky and fill the air.
//
//   bv.setup(spec)          build the stage for a battle (biome, kind, foe trainer look)
//   bv.handle(event) → s    animate one event; returns how long to wait before the next
//   bv.update(dt)

import * as THREE from 'three';
import { buildBot } from './botgen.js';
import { buildPerson } from './people.js';
import { BIOMES, makeSky, setSky } from './sky.js';
import { FX, rgb } from './fx.js';
import { metal, glow, weather, MAT } from './materials.js';
import { gearGeo } from './botgen.js';
import { JUNKGEO, junkMaterial, junkColors, buildFurniture } from './props.js';
import { TYPE_INFO } from '../sim/data/types.js';
import { MOVES } from '../sim/data/moves.js';
import { LOOKS } from '../sim/data/story.js';

const R = Math.random;
const POS = [new THREE.Vector3(-2.3, 0, 1.5), new THREE.Vector3(2.4, 0, -1.6)];
const TRAINER_POS = [new THREE.Vector3(-3.7, 0, 3.9), new THREE.Vector3(4.2, 0, -3.6)];
const ST_COLOR = { ovh: '#ff7a2a', cor: '#9be04a', shc: '#ffe14a', frz: '#8fe0ff', pdn: '#a8a8c8' };

export class BattleView {
    constructor(renderer) {
        this.r = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
        this.sky = makeSky();
        this.scene.add(this.sky);
        this.hemi = new THREE.HemisphereLight('#ffe8d0', '#3a2a20', 0.9);
        this.key = new THREE.DirectionalLight('#ffe0b0', 2.6);
        this.key.position.set(-4, 9, 7);
        this.key.castShadow = true;
        const c = this.key.shadow.camera; c.left = -9; c.right = 9; c.top = 9; c.bottom = -9; c.far = 40;
        this.key.shadow.mapSize.set(1024, 1024);
        this.rim = new THREE.DirectionalLight('#8ac8ff', 1.2);
        this.rim.position.set(6, 4, -8);
        this.flash = new THREE.PointLight('#ffffff', 0, 12, 1.5);
        this.scene.add(this.hemi, this.key, this.rim, this.flash);
        this.fx = new FX(this.scene);
        this.stage = null;
        this.bots = [null, null];
        this.trainers = [null, null];
        this.statusEm = [null, null];
        this.atm = null;
        this.t = 0;
        this.shake = 0;
        this.camT = 0;
        this.camFocus = new THREE.Vector3(0, 0.8, 0);
        this.camGoal = new THREE.Vector3(0, 0.8, 0);
        this.camBase = new THREE.Vector3(-1.6, 3.0, 7.9);
        this.debris = [];
        this.spike = null;
        this.pmrem = new THREE.PMREMGenerator(renderer.gl);
    }

    setup(spec) {
        if (this.stage) { this.scene.remove(this.stage); }
        this.fx.clear();
        for (const b of this.bots) if (b) this.scene.remove(b.root);
        for (const t of this.trainers) if (t) this.scene.remove(t.root);
        for (const d of this.debris) this.scene.remove(d.m);
        this.debris = [];
        if (this.spike) { this.scene.remove(this.spike); this.spike = null; }
        this.bots = [null, null];
        this.trainers = [null, null];
        this.statusEm = [null, null];
        this.atm = null;
        this.spec = spec;
        const B = BIOMES[spec.biome] || BIOMES.scrapyard;
        const indoor = !!B.interior;
        this.B = B;
        this.sky.visible = !indoor;
        if (!indoor) setSky(this.sky, B);
        this.scene.background = indoor ? new THREE.Color(B.fog) : null;
        this.scene.fog = new THREE.FogExp2(indoor ? B.fog : B.fog, indoor ? 0.03 : 0.012);
        if (!this.env) { const s = new THREE.Scene(); const sk = makeSky(); setSky(sk, BIOMES.scrapyard); s.add(sk); this.env = this.pmrem.fromScene(s, 0.02).texture; }
        this.scene.environment = this.env;
        this.scene.environmentIntensity = indoor ? 0.5 : 0.9;
        this.hemi.color.set(B.hemi[0]); this.hemi.groundColor.set(B.hemi[1]); this.hemi.intensity = Math.max(0.7, B.hemi[2] * 1.2);
        this.key.color.set(indoor ? (B.light || '#ffe0b0') : B.sun);
        this.key.intensity = indoor ? 1.8 : B.sunI;
        const stage = new THREE.Group();
        this.stage = stage;
        this.scene.add(stage);
        const big = spec.leader || spec.titan;
        // Ground.
        const gm = weather(new THREE.MeshStandardMaterial({ color: B.ground, roughness: 0.95, metalness: 0.05 }), { rust: 0.35, patina: new THREE.Color(B.ground2), scale: 0.35, streak: 0 });
        const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), gm);
        ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
        stage.add(ground);
        // The ring: brass for Circuit battles, a scuffed clearing in the wild.
        if (spec.kind === 'trainer') {
            const plat = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.9, 0.22, 48), metal(big ? 'gunmetal' : 'iron'));
            plat.position.y = 0.06; plat.receiveShadow = true; stage.add(plat);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(5.7, 0.12, 8, 64), metal('brass'));
            ring.rotation.x = Math.PI / 2; ring.position.y = 0.18; stage.add(ring);
            const inner = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 6, 40), glow(big ? (TYPE_INFO[spec.leaderType] || TYPE_INFO.gear).glow : '#ffcc6a', 1.6));
            inner.rotation.x = Math.PI / 2; inner.position.y = 0.18; stage.add(inner);
            for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow('#ffcc6a', 2.4)); b.position.set(Math.cos(a) * 5.7, 0.26, Math.sin(a) * 5.7); stage.add(b); }
            // Floor markings.
            const line = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 10.5), metal('brass')); line.position.y = 0.18; line.rotation.y = Math.PI / 2 - 0.6; stage.add(line);
            this.yBase = 0.17;
        } else {
            const patch = new THREE.Mesh(new THREE.CircleGeometry(5, 40), new THREE.MeshStandardMaterial({ color: new THREE.Color(B.ground2).multiplyScalar(0.85), roughness: 1, transparent: true, opacity: 0.8 }));
            patch.rotation.x = -Math.PI / 2; patch.position.y = 0.01; stage.add(patch);
            this.yBase = 0;
        }
        // Surroundings.
        if (big && spec.kind === 'trainer') this.buildFoundry(stage, spec);
        else this.buildJunkRing(stage, B, indoor);
        if (indoor) { const l = new THREE.PointLight(B.light || '#ffcc88', 3, 18, 1.2); l.position.set(0, 6, 0); stage.add(l); }
        // Trainers.
        if (spec.kind === 'trainer') {
            const foe = buildPerson(spec.look || 'rand', `battle:${spec.name}`);
            foe.root.position.copy(TRAINER_POS[1]); foe.root.position.y = this.yBase;
            foe.root.lookAt(TRAINER_POS[0].x, 0, TRAINER_POS[0].z);
            foe.root.scale.setScalar(1.2);
            this.scene.add(foe.root);
            this.trainers[1] = foe;
        }
        const me = buildPerson({ ...LOOKS.player, ...(spec.playerLook || {}) }, 'player');
        me.root.position.copy(TRAINER_POS[0]); me.root.position.y = this.yBase;
        me.root.lookAt(TRAINER_POS[1].x, 0, TRAINER_POS[1].z);
        me.root.scale.setScalar(1.2);
        this.scene.add(me.root);
        this.trainers[0] = me;
        this.camGoal.set(0, 0.9, 0);
        this.intro = 1.6;
        this.setAtmos(null);
    }

    buildJunkRing(stage, B, indoor) {
        const kinds = ['mound', 'barrel', 'crate', 'tires', 'pipe', 'gear', 'engine', 'girder'];
        const jc = junkColors();
        const per = {};
        for (let i = 0; i < 90; i++) {
            const a = R() * Math.PI * 2, r = 9 + R() * 12;
            const k = i % 3 === 0 ? 'mound' : kinds[1 + Math.floor(R() * (kinds.length - 1))];
            (per[k] ||= []).push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: (k === 'mound' ? 2.2 : 1.3) * (0.7 + R() * 0.9), ry: R() * 6, c: jc[Math.floor(R() * jc.length)] });
        }
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
        for (const [k, list] of Object.entries(per)) {
            const im = new THREE.InstancedMesh(JUNKGEO(k), junkMaterial(), list.length);
            list.forEach((o, i) => { q.setFromEuler(new THREE.Euler(k === 'mound' ? 0 : (R() - 0.5) * 0.8, o.ry, 0)); m4.compose(new THREE.Vector3(o.x, 0, o.z), q, new THREE.Vector3(o.s, o.s * (k === 'mound' ? 1.2 : 1), o.s)); im.setMatrixAt(i, m4); im.setColorAt(i, k === 'mound' ? col.set(B.junk || '#4a3a2e') : col.set(o.c)); });
            im.castShadow = true; im.receiveShadow = true;
            stage.add(im);
        }
        if (indoor) for (let i = 0; i < 10; i++) { const f = buildFurniture('dungeon', i * 7919); const a = (i / 10) * Math.PI * 2; f.position.set(Math.cos(a) * 8, 0, Math.sin(a) * 8); f.scale.setScalar(1.8); f.lookAt(0, 0, 0); stage.add(f); }
    }

    buildFoundry(stage, spec) {
        const tcol = (TYPE_INFO[spec.leaderType] || TYPE_INFO.gear).color;
        // Giant gears as walls, banners, braziers and a crowd on stands.
        for (let i = 0; i < 7; i++) {
            const a = Math.PI * 0.95 + (i / 6) * Math.PI * 1.1;
            const gr = new THREE.Mesh(gearGeo(2.4, 16, 0.4), metal(i % 2 ? 'brass' : 'bronze'));
            gr.position.set(Math.cos(a) * 12, 2.2, Math.sin(a) * 12);
            gr.lookAt(0, 2.2, 0);
            stage.add(gr);
            (this.spinGears ||= []).push(gr);
        }
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.2;
            const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.2), new THREE.MeshStandardMaterial({ color: tcol, roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color(tcol), emissiveIntensity: 0.15 }));
            b.position.set(Math.cos(a) * 9.5, 3.4, Math.sin(a) * 9.5); b.lookAt(0, 3.4, 0); stage.add(b);
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.5, 8), metal('iron')); post.position.set(Math.cos(a) * 9.6, 2.75, Math.sin(a) * 9.6); stage.add(post);
            const br = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), glow('#ff8a2a', 3)); br.position.set(Math.cos(a) * 9.6, 5.7, Math.sin(a) * 9.6); stage.add(br);
            (this.braziers ||= []).push(br.position.clone());
        }
        // Crowd.
        const crowdM = new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1 });
        const body = new THREE.CapsuleGeometry(0.22, 0.4, 3, 8);
        const im = new THREE.InstancedMesh(body, crowdM, 140);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < 140; i++) {
            const row = i % 4, a = Math.PI * 0.05 + (i / 140) * Math.PI * 0.9;
            const r = 14 + row * 1.3;
            m4.makeTranslation(Math.cos(a + Math.PI) * r, 0.9 + row * 0.8, Math.sin(a + Math.PI) * r * -1);
            im.setMatrixAt(i, m4);
            im.setColorAt(i, new THREE.Color().setHSL(R(), 0.35, 0.25 + R() * 0.2));
        }
        stage.add(im);
        this.crowd = im;
        for (let row = 0; row < 4; row++) { const st = new THREE.Mesh(new THREE.TorusGeometry(14 + row * 1.3, 0.5, 4, 40, Math.PI * 0.9), metal('gunmetal')); st.rotation.x = Math.PI / 2; st.rotation.z = Math.PI * 1.05; st.position.y = 0.5 + row * 0.8; st.scale.z = 0.4; stage.add(st); }
    }

    // ------------------------------------------------------------------ events
    handle(e) {
        const side = e.side;
        switch (e.t) {
            case 'send': return this.sendOut(e);
            case 'recall': return this.recall(side);
            case 'move': return this.moveFx(e);
            case 'hit': return this.hit(e);
            case 'miss': { const b = this.bots[side]; if (b) { b.dodge = 0.5; } this.whoosh(side); return 0.45; }
            case 'immune': return 0.3;
            case 'protected': return this.shield(side);
            case 'protect': return this.shield(side);
            case 'status': return this.status(side, e.st);
            case 'statusTick': { this.statusBurst(side, e.st); return 0.5; }
            case 'stat': return this.statFx(side, e.n);
            case 'heal': { const p = this.pos(side); for (let i = 0; i < 24; i++) this.fx.emit('mote', p.x + (R() - 0.5), p.y - 0.3 + R(), p.z + (R() - 0.5), { color: '#8aff8a', force: true }); this.fx.ring(new THREE.Vector3(p.x, this.yBase + 0.05, p.z), '#8aff8a', 0.2, 1.4, 0.7); return 0.6; }
            case 'faint': return this.faint(side);
            case 'atm': this.setAtmos(e.k); return e.k ? 0.8 : 0.3;
            case 'trait': { const p = this.pos(side); this.fx.ring(p, '#ffe8a0', 0.3, 1.6, 0.5, false); return 0.35; }
            case 'spike': return this.throwSpike(e);
            case 'glitch': { const b = this.bots[side]; if (b) b.glitch = 1.2; const p = this.pos(side); for (let i = 0; i < 12; i++) this.fx.emit('spark', p.x, p.y, p.z, { color: '#e86ad8', force: true }); return 0.5; }
            case 'stagger': { const b = this.bots[side]; if (b) b.bot.play('hit'); return 0.4; }
            case 'shards': { this.shards(side); return 0.5; }
            case 'siphon': { const p = this.pos(side); for (let i = 0; i < 16; i++) this.fx.emit('leaf', p.x, p.y, p.z, { force: true }); return 0.5; }
            case 'purge': { for (const s of [0, 1]) { const p = this.pos(s); for (let i = 0; i < 20; i++) this.fx.emit('steam', p.x + (R() - 0.5), this.yBase + 0.2, p.z + (R() - 0.5), { force: true, scale: 1.5 }); } return 0.7; }
            case 'item': { const p = this.pos(side); this.fx.ring(p, '#ffe8a0', 0.3, 1.2, 0.5, false); for (let i = 0; i < 14; i++) this.fx.emit('mote', p.x + (R() - 0.5), p.y + R() * 0.6, p.z + (R() - 0.5), { color: '#ffe8a0', force: true }); return 0.5; }
            case 'revive': return 0.3;
            case 'level': { if (e.active) { const p = this.pos(0); this.fx.ring(new THREE.Vector3(p.x, this.yBase + 0.05, p.z), '#ffd84a', 0.3, 2.2, 0.8); for (let i = 0; i < 30; i++) this.fx.emit('burst', p.x, p.y, p.z, { color: '#ffd84a', force: true }); const b = this.bots[0]; if (b) b.bot.play('cheer'); } return 0.6; }
            case 'end': { if (e.result === 'win' || e.result === 'caught') { const b = this.bots[0]; if (b) b.bot.play('cheer'); } return 0.4; }
            default: return 0;
        }
    }

    pos(side, h = null) {
        const b = this.bots[side];
        const p = (b ? b.root.position : POS[side]).clone();
        p.y = this.yBase + (h ?? (b ? b.bot.height * 0.5 * (b.k || 1) : 0.7));
        return p;
    }

    sendOut(e) {
        const side = e.side;
        if (this.bots[side]) this.scene.remove(this.bots[side].root);
        const bot = buildBot(e.sp, { gilded: e.gilded });
        const k = Math.min(1.7, 2.1 / Math.max(0.9, bot.height));
        bot.root.scale.multiplyScalar(k);
        bot.root.position.copy(POS[side]); bot.root.position.y = this.yBase;
        bot.root.lookAt(POS[1 - side].x, this.yBase, POS[1 - side].z);
        const fullScale = bot.root.scale.x;
        bot.root.scale.setScalar(fullScale * 0.01);
        this.scene.add(bot.root);
        const v = { bot, root: bot.root, k, grow: 0, side, home: bot.root.position.clone(), lunge: 0, dodge: 0, glitch: 0, full: fullScale };
        this.bots[side] = v;
        // Beam of light from above, rings.
        const p = POS[side].clone(); p.y = this.yBase;
        const col = (TYPE_INFO[bot.species.types[0]] || TYPE_INFO.scrap).glow;
        this.fx.beam(p.clone().add(new THREE.Vector3(0, 6, 0)), p, col, 0.22, 0.55);
        this.fx.ring(p.clone().setY(this.yBase + 0.05), col, 0.2, 2.2, 0.7);
        for (let i = 0; i < 14; i++) this.fx.emit('burst', p.x, p.y + 0.6, p.z, { color: col, force: true, scale: 0.7 });
        if (e.gilded) for (let i = 0; i < 40; i++) this.fx.emit('mote', p.x + (R() - 0.5) * 2, p.y + R() * 2, p.z + (R() - 0.5) * 2, { color: '#ffd84a', force: true });
        this.setStatus(side, e.st);
        this.camGoal.copy(POS[side]).setY(0.9).multiplyScalar(0.5);
        if (this.trainers[side]) this.trainers[side].throw = 0.6;
        return 0.75;
    }

    recall(side) {
        const v = this.bots[side];
        if (!v) return 0.2;
        const p = this.pos(side);
        this.fx.beam(p, p.clone().add(new THREE.Vector3(0, 6, 0)), '#ffffff', 0.4, 0.5);
        v.shrink = 0.0001;
        this.setStatus(side, null);
        return 0.5;
    }

    whoosh(side) { const p = this.pos(side); for (let i = 0; i < 8; i++) this.fx.emit('puff', p.x, p.y, p.z, { force: true, scale: 0.5 }); }

    moveFx(e) {
        const s = e.side, t = 1 - s;
        const mv = MOVES[e.move];
        const v = this.bots[s];
        if (!v) return 0.3;
        const col = (TYPE_INFO[mv.type] || TYPE_INFO.scrap).glow;
        const from = this.pos(s), to = this.pos(t);
        this.camGoal.lerpVectors(POS[s], POS[t], 0.35).setY(0.9);
        if (mv.cat === 'U') {
            v.bot.play('charge');
            this.fx.ring(from, col, 0.3, 1.8, 0.6, false);
            for (let i = 0; i < 26; i++) this.fx.emit('mote', from.x + (R() - 0.5) * 1.2, from.y - 0.5 + R() * 1.2, from.z + (R() - 0.5) * 1.2, { color: col, force: true });
            if (mv.fx.some((f) => f.k === 'st' || f.k === 'foe' || f.k === 'glitch' || f.k === 'siphon')) { this.fx.projectile(this.orb(col, 0.15), from, to, 0.45, 0.8, null, { kind: 'glow', color: col, scale: 0.4 }); return 0.6; }
            return 0.55;
        }
        if (mv.cat === 'K') {
            v.bot.play('attack');
            v.lunge = 0.55;
            // Contact flourishes per type.
            if (mv.type === 'blaze') for (let i = 0; i < 20; i++) this.fx.emit('ember', from.x, from.y, from.z, { force: true });
            if (mv.type === 'volt') this.fx.bolt(from, to, col, 0.3);
            if (mv.type === 'frost') for (let i = 0; i < 10; i++) this.fx.emit('shard', from.x, from.y, from.z, { force: true });
            return 0.45;
        }
        // Energy: projectiles, beams and bolts by type.
        v.bot.play('charge');
        this.flash.color.set(col); this.flash.position.copy(from); this.flash.intensity = 6;
        switch (mv.type) {
            case 'volt': this.fx.bolt(from, to, col, 0.4); this.fx.bolt(from, to, '#ffffff', 0.25); return 0.45;
            case 'hydro': case 'frost': case 'void': case 'signal':
                if (mv.type === 'signal') { for (let i = 0; i < 4; i++) setTimeout(() => { const ring = from.clone().lerp(to, 0.15 + i * 0.22); this.fx.ring(ring, col, 0.2, 1.0, 0.5, false); }, i * 90); return 0.55; }
                this.fx.beam(from, to, col, mv.pow >= 100 ? 0.32 : 0.18, 0.55);
                return 0.5;
            case 'aero': for (let i = 0; i < 5; i++) setTimeout(() => this.fx.ring(from.clone().lerp(to, i / 5), col, 0.4, 0.9, 0.4, false), i * 60); return 0.5;
            case 'steam': for (let i = 0; i < 16; i++) setTimeout(() => { const p = from.clone().lerp(to, R()); this.fx.emit('steam', p.x, p.y, p.z, { force: true, scale: 1.4 }); }, i * 20); return 0.55;
            default: {
                const proj = mv.type === 'gear' ? new THREE.Mesh(gearGeo(0.25, 10, 0.06), metal('brass')) : mv.type === 'scrap' || mv.type === 'iron' || mv.type === 'grit' ? new THREE.Mesh(JUNKGEO(mv.type === 'grit' ? 'mound' : 'gear'), metal(mv.type === 'iron' ? 'steel' : 'rust')) : this.orb(col, mv.pow >= 100 ? 0.32 : 0.2);
                if (proj.geometry && mv.type !== 'gear') proj.scale.setScalar(mv.type === 'grit' ? 0.4 : mv.type === 'scrap' || mv.type === 'iron' ? 0.5 : 1);
                if (proj.geometry) proj.geometry.userData.shared = true;
                proj.traverse((c) => { if (c.geometry) c.userData.shared = true; });
                const trailKind = mv.type === 'blaze' ? 'ember' : mv.type === 'toxic' ? 'bubble' : mv.type === 'moss' ? 'leaf' : mv.type === 'rust' ? 'ember' : 'glow';
                this.fx.projectile(proj, from, to, 0.42, mv.type === 'grit' || mv.type === 'scrap' ? 1.2 : 0.4, null, { kind: trailKind, color: col, scale: 0.6 });
                return 0.45;
            }
        }
    }

    orb(col, r) {
        const g = new THREE.Group();
        const core = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
        const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 1.9, 14, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        g.add(core, halo);
        return g;
    }

    hit(e) {
        const side = e.side;
        const v = this.bots[side];
        const p = this.pos(side);
        if (e.chip || e.self) { if (v) v.bot.play('hit'); for (let i = 0; i < 8; i++) this.fx.emit('puff', p.x, p.y, p.z, { force: true, scale: 0.4, color: '#c8a888' }); return 0.35; }
        const col = e.mtype ? TYPE_INFO[e.mtype].glow : '#ffffff';
        const n = e.eff >= 2 ? 40 : e.eff < 1 ? 10 : 22;
        for (let i = 0; i < n; i++) this.fx.emit('burst', p.x, p.y, p.z, { color: col, force: true, scale: e.eff >= 2 ? 1.3 : 1 });
        if (e.mtype === 'blaze') for (let i = 0; i < 20; i++) this.fx.emit('ember', p.x, p.y, p.z, { force: true });
        if (e.mtype === 'hydro' || e.mtype === 'steam') for (let i = 0; i < 16; i++) this.fx.emit(e.mtype === 'steam' ? 'steam' : 'shard', p.x, p.y, p.z, { color: '#6ac8ff', force: true });
        if (e.mtype === 'frost') for (let i = 0; i < 16; i++) this.fx.emit('shard', p.x, p.y, p.z, { force: true });
        if (e.mtype === 'grit' || e.mtype === 'piston') { this.fx.ring(new THREE.Vector3(p.x, this.yBase + 0.05, p.z), '#ffd8a0', 0.3, 2.2, 0.5); for (let i = 0; i < 10; i++) this.fx.emit('puff', p.x, this.yBase + 0.2, p.z, { force: true, color: '#c8a87a' }); }
        if (e.mtype === 'toxic') for (let i = 0; i < 16; i++) this.fx.emit('bubble', p.x + (R() - 0.5), p.y, p.z + (R() - 0.5), { force: true, color: '#aaff6a' });
        if (e.mtype === 'moss') for (let i = 0; i < 16; i++) this.fx.emit('leaf', p.x, p.y, p.z, { force: true });
        if (e.mtype === 'rust') for (let i = 0; i < 16; i++) this.fx.emit('ember', p.x, p.y, p.z, { force: true });
        if (e.mtype === 'void') { this.fx.ring(p, '#c08aff', 1.6, 0.1, 0.4, false); }
        this.fx.emit('glow', p.x, p.y, p.z, { color: col, size: e.crit ? 220 : 140, size2: 20, life: 0.25, force: true });
        this.flash.color.set(col); this.flash.position.copy(p); this.flash.intensity = e.eff >= 2 ? 14 : 8;
        if (v) v.bot.play('hit');
        this.shake = Math.max(this.shake, e.eff >= 2 ? 0.35 : e.crit ? 0.3 : 0.15);
        if (e.eff >= 2 || e.crit) this.r.grade.uniforms.uFlash.value.set(1, 0.95, 0.85, 0.35);
        return e.eff >= 2 ? 0.55 : 0.4;
    }

    shield(side) {
        const p = this.pos(side);
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshBasicMaterial({ color: '#8ad8ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }));
        m.position.copy(p);
        this.fx.timed(m, 0.8, (o, k) => { m.scale.setScalar(0.8 + k * 0.4); m.material.opacity = 0.45 * (1 - k); m.rotation.y += 0.05; });
        return 0.5;
    }

    status(side, st) {
        this.setStatus(side, st);
        if (st) this.statusBurst(side, st);
        return st ? 0.5 : 0.2;
    }
    statusBurst(side, st) {
        const p = this.pos(side);
        const kind = { ovh: 'ember', cor: 'bubble', shc: 'spark', frz: 'shard', pdn: 'puff' }[st] || 'burst';
        for (let i = 0; i < 24; i++) this.fx.emit(kind, p.x + (R() - 0.5) * 0.8, p.y + (R() - 0.5) * 0.6, p.z + (R() - 0.5) * 0.8, { color: ST_COLOR[st], force: true });
        if (st === 'shc') this.fx.bolt(p.clone().add(new THREE.Vector3(-0.5, 0.6, 0)), p.clone().add(new THREE.Vector3(0.5, -0.4, 0)), '#ffe14a', 0.25);
    }
    setStatus(side, st) { this.statusEm[side] = st || null; }

    statFx(side, n) {
        const p = this.pos(side);
        const up = n > 0;
        for (let i = 0; i < 26; i++) this.fx.one('mote', p.x + (R() - 0.5) * 1.2, up ? p.y - 0.6 : p.y + 0.8, p.z + (R() - 0.5) * 1.2, {});
        const col = up ? '#6ad8ff' : '#ff5a5a';
        for (let i = 0; i < 20; i++) this.fx.add.add({ x: p.x + (R() - 0.5) * 1.2, y: up ? p.y - 0.6 : p.y + 0.8, z: p.z + (R() - 0.5) * 1.2, vx: 0, vy: up ? 2.2 : -2.2, vz: 0, t: 0, life: 0.6, s0: 8, s1: 3, a: 0.9, c0: rgb(col) });
        this.fx.ring(new THREE.Vector3(p.x, this.yBase + 0.05, p.z), col, 0.3, 1.5, 0.5);
        return 0.5;
    }

    faint(side) {
        const v = this.bots[side];
        if (!v) return 0.3;
        // Detach every mesh into world space and let it fall.
        const parts = [];
        v.root.updateMatrixWorld(true);
        v.root.traverse((o) => { if (o.isMesh) parts.push(o); });
        for (const m of parts) {
            const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
            m.matrixWorld.decompose(wp, wq, ws);
            this.scene.attach(m);
            m.position.copy(wp); m.quaternion.copy(wq); m.scale.copy(ws);
            const c = this.pos(side);
            const dir = wp.clone().sub(c); dir.y = 0; dir.normalize();
            this.debris.push({ m, vx: dir.x * (0.6 + R() * 1.6), vy: 1.5 + R() * 2.5, vz: dir.z * (0.6 + R() * 1.6), rx: (R() - 0.5) * 8, rz: (R() - 0.5) * 8, t: 0, ground: this.yBase + 0.05 + R() * 0.05 });
        }
        this.scene.remove(v.root);
        this.bots[side] = null;
        const p = this.pos(side);
        for (let i = 0; i < 30; i++) this.fx.emit('spark', p.x, p.y, p.z, { force: true, scale: 1.2 });
        for (let i = 0; i < 12; i++) this.fx.emit('smoke', p.x + (R() - 0.5), this.yBase + 0.2, p.z + (R() - 0.5), { force: true });
        this.setStatus(side, null);
        this.shake = 0.25;
        return 1.1;
    }

    shards(side) {
        const p = POS[side];
        for (let i = 0; i < 6; i++) {
            const m = new THREE.Mesh(JUNKGEO('plate'), metal('steel'));
            m.position.set(p.x + (R() - 0.5) * 3, this.yBase, p.z + (R() - 0.5) * 3);
            m.scale.setScalar(0.4); m.rotation.y = R() * 6;
            this.stage.add(m);
        }
    }

    throwSpike(e) {
        const from = this.pos(0).add(new THREE.Vector3(-0.8, 0.6, 0.8));
        const to = this.pos(1);
        const spike = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), metal(e.id === 'brass-spike' ? 'brass' : e.id === 'tesla-spike' ? 'copper' : e.id === 'prime-key' ? 'gold' : 'steel'));
        shaft.rotation.x = Math.PI;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), glow('#6affc8', 2.5));
        head.position.y = 0.32;
        spike.add(shaft, head);
        shaft.userData.shared = head.userData.shared = true;
        if (this.spike) this.scene.remove(this.spike);
        this.spike = spike;
        const groundAt = to.clone(); groundAt.y = this.yBase + 0.3;
        this.fx.projectile(spike, from, groundAt, 0.5, 1.4, () => {
            this.scene.add(spike);
            spike.position.copy(groundAt); spike.rotation.set(0, 0, 0);
            const v = this.bots[1];
            if (v) {
                // The bot drains into the spike.
                const p = this.pos(1);
                for (let i = 0; i < 40; i++) this.fx.add.add({ x: p.x + (R() - 0.5) * 1.4, y: p.y + (R() - 0.5) * 1.4, z: p.z + (R() - 0.5) * 1.4, vx: (groundAt.x - p.x) * 1.5, vy: (groundAt.y - p.y) * 1.5, vz: (groundAt.z - p.z) * 1.5, t: 0, life: 0.5, s0: 10, s1: 2, a: 1, c0: rgb('#6affc8') });
                v.shrink = 0.0001;
            }
            this.spikeShakes = e.shakes; this.spikeCaught = e.caught; this.spikeT = 0;
        }, { kind: 'glow', color: '#6affc8', scale: 0.4 });
        return 1.3 + 0.55 * Math.min(3, e.shakes) + 0.6;
    }

    breakOut() {
        // A failed capture: the bot bursts back out.
        const v = this.bots[1];
        if (v) { v.shrink = 0; v.grow = 0; v.root.scale.setScalar(v.full * 0.01); }
        const p = this.pos(1);
        for (let i = 0; i < 30; i++) this.fx.emit('burst', p.x, p.y, p.z, { color: '#6affc8', force: true });
        if (this.spike) { this.scene.remove(this.spike); this.spike = null; }
    }

    setAtmos(k) {
        this.atm = k;
        const g = this.r.grade.uniforms;
        g.uHaze.value = k === 'heat' ? 1 : 0;
        g.uShadow.value.set(...(k === 'smog' ? [0.08, 0.08, 0.0] : k === 'rain' ? [0.0, 0.06, 0.02] : k === 'static' ? [0.02, 0.0, 0.1] : [0.02, 0.06, 0.08]));
        if (this.B && !this.B.interior) {
            const dark = k === 'static' || k === 'rain' || k === 'smog';
            const u = this.sky.material.uniforms;
            setSky(this.sky, this.B);
            if (dark) { u.uTop.value.multiplyScalar(0.45); u.uMid.value.multiplyScalar(0.55); u.uHor.value.multiplyScalar(0.6); u.uCloud.value = 1; }
            if (k === 'dust') { u.uMid.value.set('#d8a060'); u.uHor.value.set('#e8b070'); }
            if (k === 'smog') { u.uHor.value.set('#a8a040'); }
        }
        this.scene.fog.density = k === 'dust' || k === 'smog' ? 0.06 : this.B && this.B.interior ? 0.03 : 0.012;
        this.scene.fog.color.set(k === 'smog' ? '#9a9a4a' : k === 'dust' ? '#c8a070' : this.B ? this.B.fog : '#000');
    }

    // ------------------------------------------------------------------ per frame
    update(dt) {
        this.t += dt;
        const t = this.t;
        // Bots.
        for (const v of this.bots) {
            if (!v) continue;
            const full = v.full;
            if (v.shrink) {
                const s = v.root.scale.x * Math.pow(0.0005, dt * 2.5);
                v.root.scale.setScalar(s);
                if (s < full * 0.02) { this.scene.remove(v.root); this.bots[v.side] = null; }
                continue;
            }
            if (v.grow < 1) { v.grow = Math.min(1, v.grow + dt * 2.2); const e2 = 1 - Math.pow(1 - v.grow, 3); v.root.scale.setScalar(full * (e2 + Math.sin(v.grow * Math.PI) * 0.15)); }
            v.bot.update(dt, t);
            // Lunge toward the foe on kinetic attacks.
            const other = POS[1 - v.side];
            let off = 0;
            if (v.lunge > 0) { v.lunge -= dt; const k = 1 - v.lunge / 0.55; off = Math.sin(k * Math.PI) * 2.2; }
            let side = 0;
            if (v.dodge > 0) { v.dodge -= dt; side = Math.sin((1 - v.dodge / 0.5) * Math.PI) * 0.8; }
            const dir = other.clone().sub(v.home); dir.y = 0; dir.normalize();
            const perp = new THREE.Vector3(-dir.z, 0, dir.x);
            v.root.position.copy(v.home).addScaledVector(dir, off).addScaledVector(perp, side);
            if (v.glitch > 0) { v.glitch -= dt; v.root.position.x += (R() - 0.5) * 0.12; v.root.rotation.y += (R() - 0.5) * 0.2; }
            // Persistent status effects.
            const st = this.statusEm[v.side];
            if (st && R() < dt * 8) {
                const p = this.pos(v.side);
                const kind = { ovh: 'ember', cor: 'bubble', shc: 'spark', frz: 'shard', pdn: 'puff' }[st];
                this.fx.emit(kind, p.x + (R() - 0.5) * 0.7, p.y + (R() - 0.3) * 0.7, p.z + (R() - 0.5) * 0.7, { color: ST_COLOR[st], force: true, scale: 0.6 });
            }
            for (const em of v.bot.emitters) {
                em.acc = (em.acc || R()) + dt * (em.rate || 1);
                if (em.acc < 1) continue;
                em.acc -= 1;
                const wp = em.obj.getWorldPosition(new THREE.Vector3());
                this.fx.emit(em.kind, wp.x, wp.y, wp.z, { scale: 0.8, color: em.kind === 'jet' ? v.bot.ctx.gcol : undefined });
            }
        }
        // Trainers.
        for (const tr of this.trainers) if (tr) { tr.update(dt, 0); if (tr.throw > 0) tr.throw -= dt; }
        // Debris from shut-down bots.
        for (const d of this.debris) {
            if (d.t > 3) continue;
            d.t += dt;
            if (d.m.position.y > d.ground || d.vy > 0) {
                d.vy -= 12 * dt;
                d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
                d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt;
                if (d.m.position.y < d.ground) { d.m.position.y = d.ground; d.vy = -d.vy * 0.3; d.vx *= 0.5; d.vz *= 0.5; d.rx *= 0.5; d.rz *= 0.5; if (Math.abs(d.vy) < 0.4) d.vy = 0; }
            }
            if (d.t > 2.2) { const k = Math.max(0.01, 1 - (d.t - 2.2) / 0.8); d.m.scale.multiplyScalar(Math.pow(k, dt * 4)); }
            if (d.t > 3) this.scene.remove(d.m);
        }
        this.debris = this.debris.filter((d) => d.t <= 3);
        // The capture spike shakes, then clicks.
        if (this.spikeShakes !== undefined && this.spike) {
            this.spikeT += dt;
            const n = Math.min(3, this.spikeShakes);
            const k = this.spikeT / 0.55;
            if (k < n) { this.spike.rotation.z = Math.sin(k * Math.PI * 2) * 0.4; if (Math.abs(Math.sin(k * Math.PI * 2)) > 0.99 && R() < 0.5) this.fx.emit('spark', this.spike.position.x, this.spike.position.y + 0.3, this.spike.position.z, { force: true, n: 3 }); }
            else {
                this.spike.rotation.z = 0;
                if (this.spikeCaught) { for (let i = 0; i < 40; i++) this.fx.emit('burst', this.spike.position.x, this.spike.position.y + 0.3, this.spike.position.z, { color: '#ffd84a', force: true }); this.fx.ring(this.spike.position.clone(), '#ffd84a', 0.2, 2, 0.8, false); }
                else this.breakOut();
                this.spikeShakes = undefined;
            }
        }
        // Gears and braziers.
        if (this.spinGears) for (const g of this.spinGears) g.rotateZ(dt * 0.2);
        if (this.braziers && R() < dt * 12) { const b = this.braziers[Math.floor(R() * this.braziers.length)]; this.fx.emit('ember', b.x, b.y + 0.2, b.z, { force: true }); }
        if (this.crowd) this.crowd.position.y = Math.abs(Math.sin(t * 6)) * 0.05;
        // Atmosphere particles.
        const a = this.atm;
        if (a) {
            const n = a === 'rain' ? 30 : a === 'dust' ? 20 : a === 'smog' ? 6 : a === 'heat' ? 6 : 0;
            for (let i = 0; i < n * dt * 4; i++) {
                const x = (R() - 0.5) * 18, z = (R() - 0.5) * 14;
                if (a === 'rain') this.fx.emit('rain', x, 7, z, { force: true, color: '#c8ff8a' });
                else if (a === 'dust') this.fx.emit('dust', x, 0.5 + R() * 3, z, { force: true, color: '#e0b878', scale: 2 });
                else if (a === 'smog') this.fx.emit('smoke', x, R() * 2, z, { force: true, color: '#8a8a3a' });
                else if (a === 'heat') this.fx.emit('ember', x * 0.5, 0.2, z * 0.5, { force: true });
            }
            if (a === 'static' && R() < dt * 1.2) { const x = (R() - 0.5) * 16, z = -6 - R() * 8; this.fx.bolt(new THREE.Vector3(x, 14, z), new THREE.Vector3(x + (R() - 0.5) * 3, 0, z), '#e8f0ff', 0.25, 16); this.r.grade.uniforms.uFlash.value.set(0.9, 0.95, 1, 0.25); }
        }
        this.fx.update(dt);
        this.flash.intensity *= Math.pow(0.002, dt);
        const fl = this.r.grade.uniforms.uFlash.value; fl.w *= Math.pow(0.004, dt);
        // Camera: a slow orbit, drift toward the action, shake.
        this.camFocus.lerp(this.camGoal, Math.min(1, dt * 2));
        this.camGoal.lerp(new THREE.Vector3(0, 0.9, 0), Math.min(1, dt * 0.5));
        let intro = 0;
        if (this.intro > 0) { this.intro -= dt; intro = Math.max(0, this.intro / 1.6); }
        const ang = Math.sin(t * 0.15) * 0.08 + intro * 1.2;
        const w = this.r.w / Math.max(1, this.r.h);
        // Portrait phones are too narrow for the side-on view: look down the line from behind the player's bot.
        const base = w < 0.9 ? new THREE.Vector3(-5.6, 5.4, 7.6).multiplyScalar(w < 0.6 ? 1.25 : 1.08) : this.camBase.clone();
        base.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
        base.y += intro * 2;
        this.camera.position.copy(base).add(this.camFocus.clone().multiplyScalar(0.3));
        if (this.shake > 0) { this.camera.position.x += (R() - 0.5) * this.shake; this.camera.position.y += (R() - 0.5) * this.shake; this.shake *= Math.pow(0.02, dt); }
        this.camera.lookAt(this.camFocus);
        // Centre the stage in the space above the command box rather than on the whole screen.
        this.shift = (this.shift || 0) + ((this.boxShift || 0) - (this.shift || 0)) * Math.min(1, dt * 8);
        const sh = Math.round(this.shift);
        if (sh > 0) this.camera.setViewOffset(this.r.w, this.r.h, 0, sh, this.r.w, this.r.h);
        else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();
        this.sky.position.copy(this.camera.position);
        this.sky.material.uniforms.uTime.value = t;
    }

    project(v3) {
        const v = v3.clone().project(this.camera);
        return { x: (v.x * 0.5 + 0.5) * this.r.w, y: (-v.y * 0.5 + 0.5) * this.r.h };
    }
    /** Screen anchor above a side's bot (for damage numbers). */
    anchor(side) { return this.project(this.pos(side, (this.bots[side] ? this.bots[side].bot.height * (this.bots[side].k || 1) : 1.2) + 0.2)); }
}
