// The battle scene and its director. The sim resolves a whole turn at once and hands the view a list of events; the director
// plays each one as a short script: the camera swings to the action, the actor lunges or casts, the spell lands on a beat,
// numbers pop, shields shatter, the HUD catches up. Hit-stop, shake and flashes are all decided here.

import * as THREE from 'three';
import { Billboard } from './actors.js';
import { Sky } from './sky.js';
import { Geo } from './geo.js';
import { CHARS } from '../sim/data/classes.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { BIOMES, buildScenery, floorTexture } from './biomes.js';
import { elemColor, SHAPE } from './fx.js';
import { dungeonTheme } from '../sim/world/dungeon.js';

const U = 1 / 20;                  // world units per sprite pixel in battle
const MELEE = new Set(['slash', 'claw', 'thrust', 'spin', 'impact', 'quake']);
const ease = (t) => t * t * (3 - 2 * t);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class BattleView {
    constructor(env) {
        this.env = env;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 200);
        this.sky = new Sky(this.scene, env.quality);
        this.units = new Map();
        this.queue = []; this.cur = null; this.speed = 1; this.freeze = 0;
        this.time = 0; this.active = false;
        this.shot = { pos: v3(0, 2.6, 11.5), look: v3(0, 1.1, 0), fov: 32 };
        this.cam = { pos: v3(0, 4, 18), look: v3(0, 1, 0), fov: 36 };
        this.group = new THREE.Group(); this.scene.add(this.group);
        this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: env.markerTex, depthTest: false, transparent: true })); this.marker.scale.set(0.6, 0.6, 1); this.marker.renderOrder = 6; this.marker.visible = false; this.scene.add(this.marker);
        this.fx = env.fx; // shares the field's particle batch only when it's added to this scene
        this.activeId = null; this.bg = 'grass'; this.ended = null; this.over = false;
        this.seed = 1; this.motes = 0;
    }

    // ------------------------------------------------------------------ setup
    begin(ev, G, field) {
        this.clearScene();
        this.active = true; this.ended = null; this.over = false; this.queue.length = 0; this.cur = null; this.freeze = 0;
        this.bg = ev.bg || 'grass'; this.boss = ev.boss;
        this.seed = (G.seed ^ (G.stats.battles * 7919)) | 0;
        const bio = BIOMES[this.bg] || BIOMES.grass;
        this.bio = bio;
        // floor
        const tex = floorTexture(this.env.atlasCanvas, bio.floor).clone(); tex.needsUpdate = true; tex.repeat.set(24, 16);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: new THREE.Color(1, 1, 1).multiplyScalar(bio.tint ?? 1) }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.z = -6; this.group.add(floor);
        if (bio.lava) { const lava = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshBasicMaterial({ color: 0xff6a20, toneMapped: false })); lava.rotation.x = -Math.PI / 2; lava.position.set(0, 0.02, -9); this.group.add(lava); }
        const sc = buildScenery(this.bg, this.env.atlas, this.seed);
        const mat = new THREE.MeshStandardMaterial({ map: this.env.atlas, vertexColors: true, roughness: 1, side: THREE.DoubleSide });
        const emMat = new THREE.MeshBasicMaterial({ map: this.env.atlas, vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
        const g = sc.geo.build(), e = sc.em.build();
        if (g) { const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
        if (e) this.group.add(new THREE.Mesh(e, emMat));
        this.group.add(sc.extra);
        this.emMat = emMat;
        // fx lives in this scene while we fight
        this.scene.add(this.fx.parts.mesh); this.fx.scene = this.scene; this.fx.camera = this.camera;
        for (const l of this.fx.lights) this.scene.add(l);
        this.fx.shake = (a) => this.env.stage.kick(a);
        this.fx.flash = (r, g, b, a) => this.env.stage.flash(r, g, b, a);
        // mood: outdoors follows the time of day; indoors is fixed
        this.mood = bio.mood || null;
        this.fieldState = field;
        this.units.clear();
        const party = ev.units.filter((u) => u.side === 'party'), foes = ev.units.filter((u) => u.side === 'enemy');
        party.forEach((u, i) => this.addUnit(u, i, party.length));
        foes.forEach((u, i) => this.addUnit(u, i, foes.length));
        this.applySnap(ev.snap, true);
        // intro: the camera swoops in while both sides walk on
        this.cam.pos.set(-4, 7.5, 20); this.cam.look.set(0, 1, 0); this.cam.fov = 38;
        this.shot = this.wideShot();
        for (const u of this.units.values()) { const to = u.home.clone(); u.pos.copy(to); u.pos.x += u.side === 'party' ? 5 : -5; u.tw = { from: u.pos.clone(), to, t: -0.05 * (u.idx + (u.side === 'party' ? 0 : 3)), dur: 0.9 }; if (u.side === 'party') u.pose = 'b:step'; }
        this.introT = 1.2;
        return this;
    }

    homeFor(side, i, n, bossLike) {
        if (side === 'party') return v3(2.4 + (i % 2) * 1.0, 0, (i - (n - 1) / 2) * 1.5);
        if (n === 1) return v3(-3.4, 0, 0);
        return v3(-2.6 - (i % 2) * 1.5, 0, (i - (n - 1) / 2) * (n > 3 ? 1.5 : 1.9));
    }

    addUnit(d, i, n) {
        const env = this.env, lib = env.lib;
        const u = { id: d.id, side: d.side, idx: i, d, name: d.name, pos: v3(0, 0, 0), dx: 0, dy: 0, dz: 0, flashA: 0, flashC: [1, 1, 1], dissolve: 0, dead: false, shake: 0, pose: null, poseT: 0, hop: 0, lunge: 0, hp: d.mhp, mhp: d.mhp, mp: d.mmp, mmp: d.mmp, bp: 0, sh: d.mshield, msh: d.mshield, br: false, ch: 0, st: [], rev: [], nw: 0, tint: 1 };
        if (d.side === 'party') {
            u.look = CHARS[d.ref].look;
            u.bill = new Billboard({ w: 32 * U, h: 48 * U, blob: 0.8 });
            u.bill.set(lib.hero(u.look, 'b:idle'), 32 * U * 1.02, 48 * U * 1.02); u.bill.setFlip(-1);
        } else {
            const e = ENEMIES[d.ref];
            const m = lib.monster(e.sprite, e.pal);
            const s = U * (1 + (e.scale - 1) * 0.26) * (d.boss ? 1 : 1.12);
            u.base = { w: m.w * s, h: m.h * s }; u.tex = m.tex;
            u.bill = new Billboard({ w: u.base.w, h: u.base.h, blob: 0.9 });
            u.bill.set(m.tex, u.base.w, u.base.h); u.bill.setFlip(1);
        }
        u.home = this.homeFor(d.side, i, n);
        u.bill.group.userData.id = d.id;
        this.group.add(u.bill.group);
        this.units.set(d.id, u);
        return u;
    }

    clearScene() {
        for (const u of this.units.values()) { this.group.remove(u.bill.group); u.bill.dispose(); }
        this.units.clear();
        while (this.group.children.length) { const c = this.group.children[0]; this.group.remove(c); c.geometry?.dispose?.(); }
        this.fx?.clear();
    }

    end() {
        this.active = false;
        this.clearScene();
        this.marker.visible = false;
        this.env.endFx?.();
    }

    // ------------------------------------------------------------------ the HUD's view of the world
    applySnap(snap, instant = false) {
        for (const s of snap) {
            const u = this.units.get(s.id); if (!u) continue;
            u.mp = s.mp; u.bp = s.bp; u.sh = s.sh; u.msh = s.msh; u.br = s.br; u.ch = s.ch; u.st = s.st; u.mhp = s.mhp;
            if (s.rev) { u.rev = s.rev; u.nw = s.nw; }
            if (instant || !u.dead) u.hp = Math.min(u.mhp, s.hp > u.hp && !instant && u.hpSetByHit ? u.hp : s.hp);
            if (s.hp > 0 && u.dead) { u.dead = false; u.dissolve = 0; u.bill.uniforms.uDissolve.value = 0; }
        }
    }
    screenPos(id, up = 1.2) {
        const u = this.units.get(id); if (!u) return null;
        const p = v3(u.pos.x + u.dx, u.pos.y + u.dy + (u.bill.h) * (up / 1.2 * 0.5 + 0.5), u.pos.z + u.dz);
        p.project(this.camera);
        const c = this.env.canvas;
        return { x: (p.x * 0.5 + 0.5) * c.clientWidth, y: (-p.y * 0.5 + 0.5) * c.clientHeight, behind: p.z > 1 };
    }
    popup(u, text, cls, dx = 0) {
        const s = this.screenPos(u.id, u.side === 'enemy' ? 1.6 : 1.5); if (!s) return;
        this.env.popup(s.x + dx + (Math.random() - 0.5) * 24, s.y, text, cls);
    }

    // ------------------------------------------------------------------ events
    push(ev) { this.queue.push(ev); }
    get busy() { return !!this.cur || this.queue.length > 0 || this.introT > 0; }

    next() {
        const ev = this.queue.shift();
        if (!ev) { this.cur = null; return; }
        const script = this.script(ev);
        this.cur = { ev, t: 0, steps: script.steps.sort((a, b) => a[0] - b[0]), end: script.end, i: 0 };
    }

    script(ev) {
        const S = (steps, end) => ({ steps, end });
        const env = this.env;
        switch (ev.type) {
            case 'b_start': return S([], 0.01);
            case 'b_round': return S([], 0.01);
            case 'b_turn': return S([[0, () => { this.activeId = ev.actor; this.applySnap(ev.snap); this.env.turn?.(ev); this.shot = this.wideShot(); }]], 0.12);
            case 'b_act': return this.actScript(ev);
            case 'b_tick': return S([[0, () => { const u = this.units.get(ev.id); this.applySnap(ev.snap); if (!u) return; if (ev.kind === 'poison') { u.hp = Math.max(0, u.hp - ev.amount); this.popup(u, String(ev.amount), 'poison'); u.flashA = 0.5; u.flashC = [0.4, 1, 0.3]; this.fx.sparks(this.headOf(u), 0x9be15d, 8, 3, 0.18, 0.5); if (u.hp <= 0) this.kill(u); } else { u.hp = Math.min(u.mhp, u.hp + ev.amount); this.popup(u, String(ev.amount), 'heal'); this.fx.play('heal', this.headOf(u), [this.chestOf(u)]); } }]], 0.45);
            case 'b_skip': return S([[0, () => { const u = this.units.get(ev.id); this.applySnap(ev.snap); if (u) this.popup(u, ev.reason === 'sleep' ? 'Zzz…' : 'Stunned', 'status'); }]], 0.5);
            case 'b_recover': return S([[0, () => { const u = this.units.get(ev.id); this.applySnap(ev.snap); if (u) { this.popup(u, 'Recovered', 'status'); this.fx.ring(this.chestOf(u), 0xffe08a, 3.5, 0.5); u.tint = 1; env.sfx?.('recover'); } }]], 0.5);
            case 'b_charge': return S([
                [0, () => { const u = this.units.get(ev.id); this.applySnap(ev.snap); if (!u) return; if (ev.warn) env.banner(ev.warn, 'warn'); env.sfx?.('charge'); this.fx.ring(this.chestOf(u), 0xff4a3a, 4, 0.7); u.flashA = 0.6; u.flashC = [1, 0.2, 0.1]; this.shot = { pos: v3(u.pos.x * 0.6, 2.2, 8.2), look: v3(u.pos.x * 0.8, 1.2, 0), fov: 26 }; env.stage.kick(0.25); }],
                [0.9, () => { this.shot = this.wideShot(); }]], ev.warn ? 1.5 : 0.9);
            case 'b_phase': return S([
                [0, () => { const u = this.units.get(ev.id); this.applySnap(ev.snap); if (!u) return; this.shot = { pos: v3(u.pos.x * 0.5, 2.0, 8.4), look: v3(u.pos.x * 0.75, 1.4, 0), fov: 25 }; env.stage.kick(0.9); env.stage.flash(1, 0.3, 0.2, 0.4); env.sfx?.('roar'); if (ev.say) env.banner(ev.say, 'say'); this.fx.ring(this.chestOf(u), 0xff6a4a, 6, 0.8); for (let i = 0; i < 18; i++) this.fx.parts.add({ x: u.pos.x, y: 0.2, z: u.pos.z + (Math.random() - 0.5), vy: 3 + Math.random() * 4, vx: (Math.random() - 0.5) * 4, life: 0.8, size: 0.3, size1: 0, r: 1, g: 0.3, b: 0.1, shape: SHAPE.flame, fade: 'out' }); }],
                [0.5, () => { for (const d of ev.spawn || []) { const n = [...this.units.values()].filter((x) => x.side === 'enemy').length; const nu = this.addUnit(d, n % 5, 5); nu.home = this.homeFor('enemy', n % 5, 5); nu.home.x -= 0.4; nu.pos.copy(nu.home); nu.bill.uniforms.uDissolve.value = 0; nu.flashA = 1; env.stage.flash(1, 1, 1, 0.3); this.fx.ring(nu.home.clone().setY(1), 0xc8a0ff, 3, 0.5); this.applySnap(ev.snap); } }],
                [1.4, () => { this.shot = this.wideShot(); }]], 1.9);
            case 'b_flee': return S([[0, () => { env.sfx?.('flee'); if (ev.ok) { for (const u of this.units.values()) if (u.side === 'party') { u.pose = 'b:step'; u.tw = { from: u.pos.clone(), to: u.pos.clone().add(v3(9, 0, 0)), t: 0, dur: 0.9 }; } env.banner('Escaped!', 'good'); } else { const u = this.units.get(ev.id); if (u) this.popup(u, "Couldn't escape!", 'status'); } }]], ev.ok ? 1.1 : 0.7);
            case 'b_end': return this.endScript(ev);
            case 'b_noop': return S([], 0.01);
        }
        return S([], 0.01);
    }

    wideShot() { const a = this.env.canvas.clientWidth / Math.max(1, this.env.canvas.clientHeight); const k = a < 1.2 ? 1.5 : a < 1.6 ? 1.1 : 1; return { pos: v3(0, 4.0 * k, 12.2 * k), look: v3(0, 1.0, 0), fov: 31 }; }
    headOf(u) { return v3(u.pos.x + u.dx, u.pos.y + u.bill.h * 0.95, u.pos.z + 0.3); }
    chestOf(u) { return v3(u.pos.x + u.dx, u.pos.y + u.bill.h * 0.5, u.pos.z + 0.3); }

    actScript(ev) {
        const env = this.env, actor = this.units.get(ev.actor);
        const targets = ev.targets.map((id) => this.units.get(id)).filter(Boolean);
        const tpos = targets.map((t) => this.chestOf(t));
        const side = actor.side, kind = ev.vfx, ranged = !MELEE.has(kind), friendly = ev.kind === 'heal' || ev.kind === 'buff' || ev.skill === 'defend' || (ev.targets.length && targets[0].side === side && ev.kind !== 'phys' && ev.kind !== 'mag');
        const melee = !ranged && targets.length && targets[0].side !== side;
        const steps = [];
        const boost = ev.boost || 0;
        const dirX = side === 'party' ? -1 : 1;
        const mid = tpos.reduce((a, p) => a.add(p), v3(0, 0, 0)).multiplyScalar(1 / Math.max(1, tpos.length));
        let T = 0;
        // 1. banner and camera
        steps.push([0, () => {
            env.banner(ev.name, ev.ult ? 'ult' : side === 'enemy' ? 'foe' : 'act'); this.activeId = actor.id; env.sfx?.('select');
            const focus = ev.ult ? actor.pos : mid;
            if (ev.ult) this.shot = { pos: v3(actor.pos.x * 0.5 + 0.6, 1.9, 7.4), look: v3(actor.pos.x * 0.8, 1.2, 0), fov: 24 };
            else if (targets.length === 1 || (melee && targets.length < 3)) this.shot = { pos: v3(mid.x * 0.55 + (actor.pos.x) * 0.1, 2.2, 9.0), look: v3((mid.x + actor.pos.x) * 0.5 * 0.8, 1.2, mid.z * 0.4), fov: 27 };
            else this.shot = { pos: v3(0, 2.8, 10.4), look: v3(0, 1.15, 0), fov: 29 };
            if (boost) { env.banner2?.(`BOOST ×${boost + 1}`, 'boost'); this.boostAura(actor, boost); env.sfx?.('boost'); }
        }]);
        if (ev.ult) T += 0.55;
        // 2. wind-up
        const wind = (ev.kind === 'mag' || ev.kind === 'heal' || ev.kind === 'buff' || ev.kind === 'util') ? 0.5 + (ev.ult ? 0.35 : 0) : 0.28;
        steps.push([T, () => {
            if (side === 'party') this.pose(actor, ev.kind === 'phys' ? (ranged ? 'b:shoot' : 'b:windup') : 'b:cast', 1.2);
            if (ev.kind !== 'phys' && ev.skill !== 'defend') { const c = elemColor(ev.atype || ev.vfx); this.chargeFx(actor, c, wind, ev.ult); env.sfx?.('charge_' + (ev.vfx || 'cast')); }
            if (ev.skill === 'defend') { this.pose(actor, 'b:guard', 1.0); this.fx.play('guard', actor.pos, [this.chestOf(actor)]); env.sfx?.('guard'); }
        }]);
        T += ev.skill === 'defend' ? 0.6 : wind;
        // 3. approach
        if (melee && targets.length) {
            const t0 = targets[0];
            const goal = v3(t0.home.x + (side === 'party' ? 1.7 : -1.7), 0, t0.home.z + 0.1);
            steps.push([T, () => { if (side === 'party') this.pose(actor, 'b:step', 0.3); actor.tw = { from: actor.pos.clone(), to: goal, t: 0, dur: 0.2 }; env.sfx?.('dash'); }]);
            T += 0.22;
        }
        // 4. the blow
        const fxo = { boost, element: ev.atype };
        let res = { hit: 0.2, dur: 0.6 };
        steps.push([T, () => {
            if (side === 'party' && ev.kind === 'phys') this.pose(actor, ranged ? 'b:shoot' : 'b:strike', 0.4);
            const from = this.chestOf(actor);
            res = this.fx.play(kind, from, tpos, fxo);
            env.sfx?.(ev.vfx || 'cast', ev);
            if (side === 'enemy') { actor.lunge = 0.2; }
        }]);
        const hitT = T + 0.16;
        // 5. every hit lands on its beat
        const hits = ev.hits;
        hits.forEach((h, i) => {
            const at = hitT + (hits.length > 1 && ev.tgt !== 'all' ? i * 0.13 : (ev.tgt === 'all' ? (i % Math.max(1, targets.length)) * 0.05 : 0)) + 0.08;
            steps.push([at, () => this.applyHit(ev, h, actor)]);
        });
        const lastHit = hitT + 0.08 + (hits.length > 1 && ev.tgt !== 'all' ? hits.length * 0.13 : 0.1);
        T = Math.max(lastHit + 0.55, T + 0.8 + (ev.ult ? 0.5 : 0));
        // 6. return home
        steps.push([T - 0.25, () => { if (melee) actor.tw = { from: actor.pos.clone(), to: actor.home.clone(), t: 0, dur: 0.22 }; }]);
        steps.push([T, () => { this.applySnap(ev.snap); this.shot = this.wideShot(); }]);
        return { steps, end: T + 0.25 };
    }

    pose(u, name, dur) { u.pose = name; u.poseT = dur; }

    boostAura(u, n) {
        const c = this.chestOf(u);
        this.fx.ring(c, 0xffd36a, 3.4, 0.5); this.fx.sparks(c, 0xffd36a, 10 + n * 6, 4, 0.2, 0.7);
        u.flashA = 0.4; u.flashC = [1, 0.8, 0.3];
    }

    chargeFx(u, color, dur, big) {
        const c = this.chestOf(u);
        const col = new THREE.Color(color);
        const n = big ? 30 : 16;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 1.6; this.fx.parts.add({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.8, z: c.z, vx: -Math.cos(a) * r / dur, vy: -Math.sin(a) * r * 0.8 / dur, life: dur, size: 0.3, size1: 0.05, r: col.r, g: col.g, b: col.b, shape: SHAPE.orb, fade: 'in', delay: i * dur * 0.02 }); }
        this.fx.glow(c, color, big ? 3 : 1.8, dur, 0.8);
        this.fx.light(v3(c.x, c.y + 0.5, c.z + 1.5), color, big ? 10 : 5, dur + 0.2);
    }

    applyHit(ev, h, actor) {
        const t = this.units.get(h.t); if (!t) return;
        const env = this.env;
        if (h.heal !== undefined && h.dmg === undefined) {
            if (h.revived) { t.dead = false; t.dissolve = 0; t.bill.uniforms.uDissolve.value = 0; this.pose(t, 'b:idle', 0); t.hp = h.hp; this.popup(t, 'Revived!', 'heal'); this.fx.play('holy', this.chestOf(t), [this.chestOf(t)]); env.sfx?.('revive'); }
            else if (h.heal > 0) { t.hp = h.hp; this.popup(t, String(h.heal), 'heal'); }
            if (h.bp) this.popup(t, `BP +${h.bp}`, 'status', 24);
            if (h.mp) this.popup(t, `MP ${h.mp}`, 'mp');
            if (h.cleansed) this.popup(t, 'Cleansed', 'status');
            if (h.analyzed) { this.popup(t, 'Analyzed', 'status'); env.sfx?.('analyze'); }
            if (h.steal) { this.popup(t, 'Stole ' + (env.itemName?.(h.steal) || h.steal) + '!', 'good'); env.sfx?.('steal'); }
            if (h.stealFail) this.popup(t, 'Nothing to steal', 'status');
            for (const [name, ok] of h.fx || []) if (ok) this.popup(t, env.statusName?.(name) || name, ['haste', 'atkUp', 'defUp', 'regen', 'cover', 'taunt'].includes(name) ? 'buff' : 'status', 18);
            else this.popup(t, 'Resisted', 'status', 18);
            if (h.hp !== undefined) t.hp = h.hp;
            env.sfx?.(ev.kind === 'heal' ? 'heal' : 'buff');
            return;
        }
        // damage
        const crit = h.crit, weak = h.weak, big = h.dmg > t.mhp * 0.3;
        t.hp = h.hp; t.hpSetByHit = true;
        this.popup(t, String(h.dmg), (crit ? 'crit' : weak ? 'weak' : h.resist ? 'resist' : big ? 'big' : t.side === 'party' ? 'hurt' : 'dmg'));
        if (weak) this.popup(t, 'WEAK!', 'tag', -26);
        if (h.resist) this.popup(t, 'resist', 'tagr', -26);
        if (crit) { this.popup(t, 'CRITICAL', 'tag', 28); env.stage.kick(0.35); }
        if (h.revealed) env.revealed?.(t.id, h.revealed);
        t.flashA = 1; t.flashC = crit ? [1, 0.9, 0.4] : [1, 1, 1];
        t.shake = crit || big ? 0.35 : 0.22;
        t.dx = (t.side === 'party' ? 0.35 : -0.35); t.kb = 1;
        if (t.side === 'party') this.pose(t, 'b:hurt', 0.45);
        this.fx.sparks(this.chestOf(t), crit ? 0xffe070 : weak ? 0xffffff : 0xffcc88, crit ? 18 : 10, 5, 0.2, 0.4);
        env.stage.kick(crit ? 0.5 : weak ? 0.3 : 0.18);
        this.freeze = Math.max(this.freeze, crit || weak ? 0.07 : 0.035);
        env.sfx?.(crit ? 'crit' : weak ? 'weak' : t.side === 'party' ? 'hurt' : 'hit', ev);
        if (h.covered) this.popup(this.units.get(h.covered) || t, 'Covered!', 'status', -20);
        for (const [name, ok] of h.fx || []) if (ok) this.popup(t, env.statusName?.(name) || name, 'status', 22);
        if (h.woke) this.popup(t, 'Awake!', 'status', 20);
        if (h.broke) this.breakFx(t);
        if (h.cancelled) this.popup(t, 'Attack cancelled!', 'good', 30);
        if (h.ko) this.kill(t);
        if (ev.drain && actor && h.dmg > 0) this.fx.play('heal', this.chestOf(actor), [this.chestOf(actor)]);
    }

    breakFx(t) {
        const env = this.env, c = this.chestOf(t);
        env.banner('BREAK!', 'break'); env.stage.kick(1.0); env.stage.flash(1, 1, 1, 0.5); env.stage.aberr = 4; this.freeze = Math.max(this.freeze, 0.16);
        this.fx.ring(c, 0xffffff, 6, 0.55); this.fx.ring(v3(c.x, 0.05, c.z), 0xffe08a, 7, 0.6, true);
        for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, v = 5 + Math.random() * 6; this.fx.parts.add({ x: c.x, y: c.y, z: c.z + 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 + 2, vz: (Math.random() - 0.5) * 3, life: 0.9, size: 0.34, size1: 0.08, r: 0.7, g: 0.85, b: 1, shape: SHAPE.shard, grav: 12, spin: (Math.random() - 0.5) * 14, fade: 'out' }); }
        this.fx.glow(c, 0xffffff, 5, 0.4);
        this.fx.light(v3(c.x, c.y + 1, c.z + 2), 0xcfe4ff, 14, 0.6);
        t.tint = 0.55; t.bill.uniforms.uTint.value.setScalar(0.55);
        env.sfx?.('break');
    }

    kill(t) {
        t.dead = true; t.hp = 0;
        const env = this.env;
        if (t.side === 'party') { this.pose(t, 'b:kneel', 999); t.tint = 0.6; env.sfx?.('ko'); this.popup(t, 'KO', 'tag', 0); }
        else {
            t.dying = { t: 0, dur: t.d.boss ? 1.6 : 0.7 };
            env.sfx?.(t.d.boss ? 'bossdie' : 'die');
            const c = this.chestOf(t);
            this.fx.ring(c, 0xffffff, 3, 0.4); this.fx.sparks(c, 0xffe8a0, t.d.boss ? 40 : 14, 6, 0.24, 0.9);
            if (t.d.boss) { env.stage.kick(1.1); env.stage.flash(1, 1, 1, 0.6); this.freeze = Math.max(this.freeze, 0.25); }
        }
    }

    endScript(ev) {
        const env = this.env;
        const steps = [];
        if (ev.result === 'victory') {
            steps.push([0.45, () => {
                for (const u of this.units.values()) if (u.side === 'party' && !u.dead) { this.pose(u, 'b:cheer', 99); u.hop = 1; }
                env.sfx?.('victory'); env.victory?.(); this.shot = { pos: v3(2, 2.0, 8.4), look: v3(3.3, 1.3, 0), fov: 26 };
                for (let i = 0; i < 40; i++) this.fx.parts.add({ x: 3 + (Math.random() - 0.5) * 6, y: 7 + Math.random() * 3, z: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 2, vx: (Math.random() - 0.5) * 2, life: 2.5, size: 0.2, r: Math.random(), g: Math.random(), b: Math.random(), shape: SHAPE.leaf, spin: (Math.random() - 0.5) * 8, fade: 'inout', delay: Math.random() * 0.8 });
            }]);
            steps.push([1.6, () => { this.ended = ev; env.ended?.(ev); }]);
            return { steps, end: 1.7 };
        }
        if (ev.result === 'defeat') { steps.push([0.2, () => { env.stage.flash(0.8, 0, 0, 0.4); env.sfx?.('defeat'); for (const u of this.units.values()) if (u.side === 'party') this.pose(u, 'b:kneel', 99); }]); steps.push([1.6, () => { this.ended = ev; env.ended?.(ev); }]); return { steps, end: 1.7 }; }
        steps.push([0.3, () => { this.ended = ev; env.ended?.(ev); }]);
        return { steps, end: 0.5 };
    }

    // ------------------------------------------------------------------ per frame
    update(dt, time) {
        this.time = time;
        const rdt = dt * this.speed;
        // intro
        if (this.introT > 0) this.introT -= rdt;
        // hit-stop: the script and the units hold still, the fx and camera don't
        let sdt = rdt;
        if (this.freeze > 0) { this.freeze -= dt; sdt = 0; }
        if (!this.cur && this.queue.length) this.next();
        if (this.cur && sdt > 0) {
            const c = this.cur;
            c.t += sdt;
            while (c.i < c.steps.length && c.steps[c.i][0] <= c.t) { c.steps[c.i][1](); c.i++; }
            if (c.t >= c.end) { while (c.i < c.steps.length) { c.steps[c.i][1](); c.i++; } this.cur = null; }
        }
        // units
        const cam = this.camera; Billboard.cam = cam;
        for (const u of this.units.values()) {
            if (u.tw) {
                u.tw.t += sdt;
                const k = Math.max(0, Math.min(1, u.tw.t / u.tw.dur));
                u.pos.lerpVectors(u.tw.from, u.tw.to, ease(k));
                if (k >= 1) u.tw = null;
            }
            if (u.poseT > 0) { u.poseT -= sdt; if (u.poseT <= 0 && u.pose !== 'b:kneel' && u.pose !== 'b:cheer') u.pose = 'b:idle'; }
            u.shake = Math.max(0, u.shake - sdt * 1.4);
            u.dx *= Math.exp(-sdt * 9); u.dy = 0;
            const sh = u.shake > 0 ? Math.sin(time * 70) * u.shake * 0.5 : 0;
            u.flashA = Math.max(0, u.flashA - dt * 5);
            const bob = u.dead ? 0 : Math.sin(time * (u.side === 'party' ? 2.2 : 1.6) + u.idx * 1.7) * 0.03;
            const hopY = u.pose === 'b:cheer' ? Math.abs(Math.sin(time * 6 + u.idx)) * 0.45 : 0;
            const lunge = u.lunge > 0 ? (u.lunge = Math.max(0, u.lunge - sdt)) / 0.2 * -(u.side === 'enemy' ? -0.5 : 0.5) : 0;
            if (u.side === 'party') {
                const pose = u.pose || (u.id === this.activeId && !this.cur ? 'b:ready' : 'b:idle');
                u.bill.set(this.env.lib.hero(u.look, pose));
            }
            if (u.dying) { u.dying.t += dt; u.bill.uniforms.uDissolve.value = Math.min(1, u.dying.t / u.dying.dur); if (u.dying.t >= u.dying.dur) { u.bill.group.visible = false; u.dying = null; } }
            u.bill.uniforms.uTint.value.setScalar(u.tint * (u.dead && u.side === 'party' ? 1 : 1));
            u.bill.flash(u.flashA, ...u.flashC);
            const yaw = Math.atan2(cam.position.x - u.pos.x, cam.position.z - u.pos.z);
            const sc = u.dead && u.side === 'party' ? 1 : 1 + Math.sin(time * 2 + u.idx) * 0.008;
            u.bill.place(u.pos.x + u.dx + sh + lunge, u.pos.y + bob + hopY, u.pos.z, yaw);
            u.bill.group.visible = !(u.dissolve > 0.99) && (u.bill.group.visible || !u.dead || u.side === 'party') && !(u.dead && u.side === 'enemy' && !u.dying);
            // status ambience: broken stars, charging embers
            if (!u.dead && u.side === 'enemy') {
                if (u.br && Math.random() < dt * 16) { const a = time * 6 + Math.random(); this.fx.parts.add({ x: u.pos.x + Math.cos(a) * 0.5, y: u.pos.y + u.bill.h + 0.15 + Math.sin(a) * 0.1, z: u.pos.z + Math.sin(a) * 0.3 + 0.3, life: 0.5, size: 0.28, size1: 0.1, r: 1, g: 0.9, b: 0.4, shape: SHAPE.star, fade: 'out' }); }
                if (u.ch > 0 && Math.random() < dt * 30) this.fx.parts.add({ x: u.pos.x + (Math.random() - 0.5) * u.bill.w * 0.7, y: u.pos.y + Math.random() * 0.5, z: u.pos.z + 0.3, vy: 2 + Math.random() * 3, life: 0.7, size: 0.18, size1: 0, r: 1, g: 0.25, b: 0.1, shape: SHAPE.orb, fade: 'out' });
            }
            if (u.side === 'party' && !u.dead && u.st.includes('poison') && Math.random() < dt * 4) this.fx.parts.add({ x: u.pos.x + (Math.random() - 0.5) * 0.6, y: u.pos.y + 0.5 + Math.random(), z: u.pos.z + 0.3, vy: 0.8, life: 0.8, size: 0.14, size1: 0.1, r: 0.6, g: 0.9, b: 0.3, shape: SHAPE.bubble, fade: 'out' });
        }
        // the marker over whoever is choosing
        const au = this.activeId ? this.units.get(this.activeId) : null;
        if (au && au.side === 'party' && !au.dead && !this.cur && this.env.choosing?.()) { this.marker.visible = true; this.marker.position.set(au.pos.x, au.pos.y + au.bill.h + 0.35 + Math.sin(time * 5) * 0.08, au.pos.z + 0.2); } else this.marker.visible = false;
        // camera: springs toward the shot, with a little drift
        const k = 1 - Math.exp(-dt * (this.introT > 0.2 ? 2.4 : 5.5));
        const drift = Math.sin(time * 0.35) * 0.25;
        this.cam.pos.lerp(v3(this.shot.pos.x + drift, this.shot.pos.y + Math.sin(time * 0.5) * 0.05, this.shot.pos.z), k);
        this.cam.look.lerp(this.shot.look, k);
        this.cam.fov += (this.shot.fov - this.cam.fov) * k;
        const sh = this.env.stage.shake, s2 = sh * sh * 0.45;
        cam.position.set(this.cam.pos.x + (Math.random() - 0.5) * s2, this.cam.pos.y + (Math.random() - 0.5) * s2, this.cam.pos.z);
        cam.lookAt(this.cam.look.x + (Math.random() - 0.5) * s2 * 0.4, this.cam.look.y, this.cam.look.z);
        if (Math.abs(cam.fov - this.cam.fov) > 0.01) { cam.fov = this.cam.fov; cam.updateProjectionMatrix(); }
        // light and sky
        const f = this.fieldState;
        if (this.mood) this.sky.update(dt, { fixed: this.mood, px: 0, py: 0, pz: 0, time });
        else this.sky.update(dt, { clock: f.clock, light: f.story.light, px: 0, py: 0, pz: 0, time });
        this.emMat.color.setScalar(this.sky.glow);
        // ambient motes
        this.ambient(dt, time);
        this.fx.update(dt, time);
    }

    ambient(dt, time) {
        const bg = this.bg;
        if (Math.random() < dt * 8) {
            const x = (Math.random() - 0.5) * 24, z = -Math.random() * 10;
            if (bg === 'snow' || bg === 'glacier') this.fx.parts.add({ x, y: 9, z, vy: -1.5, vx: -0.4, life: 6, size: 0.1, size1: 0.1, r: 1, g: 1, b: 1, shape: SHAPE.dot, fade: 'inout' });
            else if (bg === 'ash' || bg === 'volcano' || bg === 'maw' || bg === 'spire') this.fx.parts.add({ x, y: 0.3, z, vy: 1.2 + Math.random(), vx: 0.2, life: 4, size: 0.1, size1: 0, r: bg === 'spire' ? 0.7 : 1, g: bg === 'spire' ? 0.4 : 0.45, b: bg === 'spire' ? 1 : 0.1, shape: SHAPE.orb, fade: 'inout' });
            else if (bg === 'woods' || bg === 'forest') this.fx.parts.add({ x, y: 0.5 + Math.random() * 2, z, vy: 0.1, vx: 0.15, life: 5, size: 0.12, size1: 0.12, r: 0.9, g: 1, b: 0.4, shape: SHAPE.orb, fade: 'inout' });
            else if (bg === 'grass' || bg === 'plains') this.fx.parts.add({ x, y: 2 + Math.random() * 2, z, vy: -0.3, vx: 0.6, life: 6, size: 0.14, size1: 0.1, r: 0.5, g: 0.9, b: 0.3, shape: SHAPE.leaf, spin: 2, fade: 'inout', a: 0.8 });
            else if (bg === 'desert') this.fx.parts.add({ x: -14, y: 0.3 + Math.random() * 2, z, vx: 6, life: 3, size: 0.8, size1: 1.4, r: 0.8, g: 0.7, b: 0.5, a: 0.18, shape: SHAPE.smoke, fade: 'inout' });
            else if (bg === 'temple' || bg === 'pyramid' || bg === 'mines' || bg === 'chapel') this.fx.parts.add({ x, y: 0.5 + Math.random() * 4, z, vy: -0.05, life: 5, size: 0.08, size1: 0.08, r: 1, g: 0.9, b: 0.7, shape: SHAPE.orb, fade: 'inout', a: 0.7 });
        }
    }
}
