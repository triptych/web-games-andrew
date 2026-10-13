// The view: mirrors a World into three.js every frame. It owns the renderer,
// the stage backdrop and terrain, a model for every live sim object (pooled by
// kind), three sprite batches (effects, Cael's shots, enemy fire), and turns
// the sim's event queue into explosions, light and camera shake.

import * as THREE from 'three';
import { Renderer, CAM_D } from './renderer.js';
import { Backdrop, LOOKS } from './backgrounds.js';
import { TerrainView } from './terrain.js';
import { Sprites, SHAPE } from './sprites.js';
import { FX, KIND_PAL } from './fx.js';
import { shared } from './lib.js';
import { buildCael, buildHalo, buildEcho, buildItem, buildEnemy, buildBlock, setFlash, setFade, HALO_COLORS, ITEM_COLORS } from './models.js';
import { buildBoss } from './bossmodels.js';
import { Cinema } from './cinema.js';
import { H, W, PLAYER } from '../config.js';

const BULLET_LOOK = {
    orb: { c: [1, 0.22, 0.62], s: 0.5, shape: SHAPE.bullet },
    big: { c: [1, 0.42, 0.12], s: 0.86, shape: SHAPE.bullet },
    needle: { c: [0.75, 0.45, 1], s: 0.34, shape: SHAPE.needle, len: 3.4 },
    fire: { c: [1, 0.55, 0.1], s: 0.6, shape: SHAPE.bullet },
    soul: { c: [0.3, 1, 0.85], s: 0.62, shape: SHAPE.soul },
    shard: { c: [0.75, 0.95, 1], s: 0.42, shape: SHAPE.shard, len: 1.8 },
};
// enemy fire is tinted per circle so it always contrasts with the backdrop
const BULLET_TINT = [
    { orb: [1, 0.25, 0.7], big: [0.75, 0.35, 1] },
    { orb: [1, 0.25, 0.6], big: [1, 0.45, 0.1] },
    { orb: [0.4, 0.8, 1], big: [0.8, 0.4, 1] },
    { orb: [1, 0.3, 0.6], big: [1, 0.6, 0.15] },
    { orb: [0.4, 1, 0.55], big: [0.4, 0.9, 1], needle: [0.5, 1, 0.9] },
    { orb: [1, 0.35, 0.25], big: [1, 0.2, 0.6] },
    { orb: [0.75, 0.2, 1], big: [1, 0.2, 0.35] },
];
const VSCALE = { imp: 1.5, fly: 1.5, skull: 1.45, eye: 1.15, turret: 1.35, hound: 1.45, worm: 1.35, wormseg: 1.3, wraith: 1.55, carrier: 1.45, mine: 1.35, bull: 1.25, lancer: 1.45, pod: 1.25, lantern: 1.45, crystal: 1.45, tentacle: 1.25, tentseg: 1.0, gargoyle: 1.45, seraphling: 1.45, hand: 1.25, wheel: 1.15, crusher: 1.0 };
const LASER_COL = [[1, 0.3, 0.5], [1, 0.55, 0.15], [1, 0.3, 0.45], [0.55, 0.85, 1], [1, 0.2, 0.15]];

export class View {
    constructor(canvas) {
        this.r = new Renderer(canvas);
        const scene = this.scene = this.r.scene;
        this.backdrop = new Backdrop(scene);
        this.terrain = new TerrainView(scene);
        this.world = new THREE.Group();          // gameplay models
        scene.add(this.world);
        this.fx = new FX(scene);
        this.shots = new Sprites(1600, 15, true);
        this.bul = new Sprites(2400, 30, false);
        scene.add(this.shots.mesh, this.bul.mesh);

        this.cael = buildCael();
        this.world.add(this.cael.root);
        this.halo = buildHalo();
        this.world.add(this.halo.root);
        this.echoModels = [buildEcho(), buildEcho()];
        for (const e of this.echoModels) this.world.add(e.root);
        this.playerLight = new THREE.PointLight(0xffd890, 2.2, 11, 1.4);
        scene.add(this.playerLight);
        this.haloColor = new THREE.Color(0xffd890);

        this.ents = new Map();       // sim object → model
        this.pools = new Map();      // kind → [models]
        this.blockModels = new Map();
        this.bossModel = null;
        this.warnings = [];
        this.cinema = new Cinema(this);
        this.mode = 'game';
        this.stageIdx = -1;
        this.time = 0;
        this.px = 6; this.py = 9;
        this.shakeOn = true;
    }

    resize(w, h) { this.r.resize(w, h); }

    // ---------------------------------------------------------------- stage
    setStage(i, world) {
        this.stageIdx = i;
        const look = LOOKS[i];
        this.backdrop.setStage(i);
        this.r.setLook(look);
        shared.uRim.value.copy(look.rim);
        shared.uRimAmt.value = look.rimAmt;
        if (world) this.terrain.setStage(world.stage, world.terrain, look);
        this.reset();
    }

    /** Lighting/sky only (story scenes and the title). */
    setLook(i) {
        const look = LOOKS[i];
        this.backdrop.setStage(i);
        this.r.setLook(look);
        shared.uRim.value.copy(look.rim);
        shared.uRimAmt.value = look.rimAmt;
    }

    reset() {
        for (const [, m] of this.ents) this.release(m);
        this.ents.clear();
        for (const [, m] of this.blockModels) { this.world.remove(m.root); m.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
        this.blockModels.clear();
        if (this.bossModel) { this.world.remove(this.bossModel.root); this.bossModel = null; }
        this.fx.clear();
        this.warnings.length = 0;
    }

    setMode(m) {
        this.mode = m;
        const game = m === 'game';
        this.world.visible = game;
        this.terrain.setVisible(game);
        this.shots.mesh.visible = game; this.bul.mesh.visible = game;
        this.fx.sprites.mesh.visible = true;
        this.playerLight.visible = game;
        this.cinema.setVisible(!game);
        if (game) { this.r.base.set(W / 2, H / 2, CAM_D); this.r.look.set(W / 2, H / 2, 0); }
    }

    // ---------------------------------------------------------------- pooling
    acquire(kind) {
        const pool = this.pools.get(kind);
        let m = pool && pool.pop();
        if (!m) {
            m = kind.startsWith('item:') ? buildItem(kind.slice(5)) : buildEnemy(kind);
            if (!m) return null;
            m.kind = kind;
            m.root.scale.multiplyScalar(kind.startsWith('item:') ? 1.4 : (VSCALE[kind] ?? 1.3));
        }
        m.root.visible = true;
        setFlash(m, 0); setFade(m, 1);
        this.world.add(m.root);
        return m;
    }

    release(m) {
        if (!m) return;
        this.world.remove(m.root);
        if (!this.pools.has(m.kind)) this.pools.set(m.kind, []);
        this.pools.get(m.kind).push(m);
    }

    // ---------------------------------------------------------------- events
    event(ev, w) {
        const fx = this.fx, r = this.r;
        switch (ev.e) {
            case 'explode': {
                const pal = KIND_PAL[ev.kind] || 'fire';
                const s = ev.size ?? 1;
                fx.explode(ev.x, ev.y, s * 0.7, w && w.si === 5 && ev.kind === 'boss' ? 'ice' : pal);
                r.kick(s >= 2 ? 0.45 : s * 0.12);
                break;
            }
            case 'hit': fx.sparks(ev.x, ev.y, 2, [1, 0.85, 0.5], 6, 0.15); break;
            case 'spark': fx.sparks(ev.x, ev.y, 3, ev.armor ? [0.7, 0.85, 1] : [1, 0.9, 0.7], 7, 0.18); break;
            case 'bspark': fx.p({ x: ev.x, y: ev.y, s0: 0.4, s1: 0.1, c: [1, 0.4, 0.6], life: 0.2, shape: SHAPE.orb }); break;
            case 'absorb': fx.p({ x: ev.x, y: ev.y, s0: 0.3, s1: 1.2, c: [1, 0.85, 0.5], a0: 1.5, life: 0.25, shape: SHAPE.ring }); break;
            case 'cancel': fx.p({ x: ev.x, y: ev.y, vy: 1.5, s0: 0.45, s1: 0.1, c: [1, 0.85, 0.4], a0: 1.6, life: 0.6, shape: SHAPE.star }); break;
            case 'efire': fx.p({ x: ev.x, y: ev.y, s0: 0.9, s1: 0.2, c: [1, 0.4, 0.7], a0: 1, life: 0.12, shape: SHAPE.orb }); break;
            case 'playerDie': {
                fx.explode(ev.x, ev.y, 1.6, 'holy', { debris: 0 });
                for (let i = 0; i < 26; i++) {
                    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
                    fx.p({ x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s0: 0.5, s1: 0.3, c: [1, 1, 0.95], c2: [1, 0.8, 0.4], a0: 1.5, life: 1.4, shape: SHAPE.dart, rot: a, vr: (Math.random() - 0.5) * 6, drag: 1.5, grav: -2, aspect: 2.5 });
                }
                r.flash(1, 0.95, 0.85, 0.7); r.kick(0.8); r.aberr = 8;
                break;
            }
            case 'hurt': r.flash(1, 0.2, 0.15, 0.4); r.kick(0.4); r.aberr = 6; fx.sparks(ev.x, ev.y, 10, [1, 0.5, 0.4], 9, 0.3); break;
            case 'aegis': fx.p({ x: ev.x, y: ev.y, s0: 0.8, s1: 3, c: [0.5, 1, 0.85], a0: 1.6, life: 0.4, shape: SHAPE.ring }); r.kick(0.2); break;
            case 'pickup': {
                const c = new THREE.Color(ITEM_COLORS[ev.kind] ?? 0xffffff);
                fx.p({ x: ev.x, y: ev.y, s0: 0.6, s1: 3.2, c: [c.r, c.g, c.b], a0: 1.8, life: 0.45, shape: SHAPE.ring });
                fx.sparks(ev.x, ev.y, 12, [c.r, c.g, c.b], 6, 0.5);
                break;
            }
            case 'drop': fx.p({ x: ev.x, y: ev.y, s0: 0.4, s1: 2.2, c: [1, 0.9, 0.6], a0: 1.2, life: 0.4, shape: SHAPE.ring }); break;
            case 'beam': {
                const k = ev.charge ?? 1;
                fx.p({ x: ev.x + 1, y: ev.y, s0: 1.5 + k * 2, s1: 0.4, c: [1, 0.9, 0.5], a0: 2, life: 0.2, shape: SHAPE.orb });
                r.kick(0.1 + k * 0.25);
                break;
            }
            case 'geyser': fx.explode(ev.x, ev.y + 0.4, 0.8, 'fire', { debris: 3 }); r.kick(0.15); break;
            case 'slam': fx.sparks(ev.x, ev.y + 0.3, 14, [1, 0.7, 0.3], 9, 0.4); for (let i = 0; i < 6; i++) fx.p({ x: ev.x + (Math.random() - 0.5) * 2, y: ev.y + 0.3, vx: (Math.random() - 0.5) * 4, vy: 1, s0: 0.6, s1: 1.6, c: [0.2, 0.17, 0.15], a0: 0.7, life: 0.9, shape: SHAPE.smoke }); r.kick(0.18); break;
            case 'ripple': if (w) this.warnings.push({ type: 'ripple', wx: ev.wx, t: 0, life: 1.0 }); break;
            case 'geyserWarn': if (w) this.warnings.push({ type: 'geyser', wx: ev.wx, t: 0, life: 1.0 }); break;
            case 'warn': this.warnings.push({ type: 'edge', x: ev.x, y: ev.y, t: 0, life: 1.1 }); break;
            case 'blockBreak': fx.explode(ev.x, ev.y, 1.0, ev.kind === 'ice' ? 'ice' : ev.kind === 'membrane' ? 'flesh' : 'bone', { debris: 10 }); r.kick(0.25); break;
            case 'wake': fx.sparks(ev.x, ev.y, 12, [0.8, 0.75, 0.7], 5, 0.5); break;
            case 'pod': fx.p({ x: ev.x, y: ev.y, s0: 0.6, s1: 1.8, c: [1, 0.4, 0.5], a0: 1, life: 0.3, shape: SHAPE.ring }); break;
            case 'beat': r.kick(0.06); break;
            case 'bossDie': r.flash(1, 0.9, 0.7, 0.5); r.kick(1); break;
            case 'bossGone': {
                fx.explode(ev.x, ev.y, 4, ev.kind === 'sammael' ? 'ice' : ev.kind === 'ferryman' ? 'soul' : 'fire', { debris: 30 });
                r.flash(1, 1, 1, 0.9); r.kick(1.2); r.aberr = 12;
                if (this.bossModel) this.bossModel.root.visible = false;
                break;
            }
            case 'dawn': r.flash(1, 0.95, 0.7, 0.85); r.kick(0.6); break;
            case 'phase': r.flash(1, 0.4, 0.2, 0.4); r.kick(0.7); break;
            case 'roar': case 'clank': r.kick(0.2); break;
            case 'reset': this.resetEntities(); break;
            default: break;
        }
    }

    resetEntities() {
        for (const [, m] of this.ents) this.release(m);
        this.ents.clear();
        for (const [, m] of this.blockModels) this.world.remove(m.root);
        this.blockModels.clear();
        if (this.bossModel) { this.world.remove(this.bossModel.root); this.bossModel = null; }
        this.warnings.length = 0;
    }

    // ---------------------------------------------------------------- per frame
    sync(w, dt) {
        this.time += dt;
        const t = this.time;
        shared.uTime.value = t;
        const p = w.player;
        this.px = p.x; this.py = p.y;
        this.backdrop.update(w.scroll, t, dt);
        const pw = w.S.power;
        const hc = w.dawn ? 'dawn' : pw.halo ? pw.halo.c : 'none';
        this.haloColor.setHex(HALO_COLORS[hc]).lerp(new THREE.Color(0xffe8c0), 0.5);
        this.terrain.update(w.scroll, t, p, this.haloColor);

        // ---- Cael
        const cm = this.cael;
        const blink = p.inv > 0 && p.alive && Math.floor(t * 18) % 2 === 0;
        cm.root.visible = p.alive && !blink;
        cm.root.position.set(p.x, p.y, 0);
        cm.update(p, t, dt, { moving: p.moving });
        this.playerLight.position.set(p.x + 1.4, p.y + 0.6, 3.2);   // off the body, so it lights the world more than Cael
        this.playerLight.color.copy(this.haloColor);
        this.playerLight.intensity = p.alive ? 2.2 + (p.charging ? p.charge * 4 : 0) : 0;

        // ---- Halo + echoes
        const h = w.halo;
        this.halo.root.visible = !!h;
        if (h) {
            this.halo.root.position.set(h.x, h.y, 0.3);
            this.halo.update(h, t, dt, hc);
            const lv = pw.halo ? pw.halo.lvl : 1;
            this.halo.root.scale.setScalar(lv >= 2 || w.dawn ? 1.15 : 1);
        }
        this.echoModels.forEach((m, i) => {
            const e = w.echoes[i];
            m.root.visible = !!e && p.alive;
            if (e) { m.root.position.set(e.x, e.y, 0.2); m.update(e, t + i, dt); }
        });

        // ---- enemies
        const seen = new Set();
        const use = (key, kind, src) => {
            let m = this.ents.get(key);
            if (!m) { m = this.acquire(kind); if (!m) return null; this.ents.set(key, m); }
            seen.add(key);
            setFlash(m, src.flash > 0 ? 1.4 : 0);
            return m;
        };
        for (const e of w.enemies) {
            if (e.dead) continue;
            if (e.kind === 'geyser') { this.drawGeyser(e, dt); continue; }
            const m = use(e, e.kind, e);
            if (!m) continue;
            let y = e.y;
            if (e.kind === 'hand') y = e.y - 0.55;
            if (e.kind === 'crusher') y = e.y + 1.2;
            m.root.position.set(e.x, y, 0);
            m.update(e, t, dt);
            if (e.kind === 'worm') e.parts.forEach((q, i) => {
                if (!q.alive) return;
                const sm = use(q, 'wormseg', q);
                if (sm) { q.k = i; sm.root.position.set(q.x, q.y, -0.05 - i * 0.01); sm.update(q, t, dt); const prev = i ? e.parts[i - 1] : e; sm.root.rotation.z = Math.atan2(prev.y - q.y, prev.x - q.x); }
            });
            if (e.kind === 'tentacle') e.parts.forEach((q, i) => {
                const sm = use(q, 'tentseg', q);
                if (sm) { q.k = i; sm.root.position.set(q.x, q.y, -0.05); sm.update(q, t, dt); }
            });
            if (e.kind === 'skull' || e.kind === 'hound' || e.kind === 'fly') this.trailFlame(e, dt);
        }
        for (const it of w.items) {
            const m = use(it, 'item:' + it.kind, it);
            if (!m) continue;
            m.root.position.set(it.x, it.y, 0.3);
            m.update(it, t + it.id, dt);
        }
        for (const [key, m] of this.ents) if (!seen.has(key)) { this.release(m); this.ents.delete(key); }

        // ---- blocks
        const bseen = new Set();
        for (const b of w.blocks) {
            let m = this.blockModels.get(b.id);
            if (!m) { m = buildBlock(b); this.blockModels.set(b.id, m); this.world.add(m.root); }
            bseen.add(b.id);
            m.root.position.set(b.wx - w.scroll, 0, 0);
            setFlash(m, b.flash > 0 ? 1.2 : 0);
        }
        for (const [id, m] of this.blockModels) if (!bseen.has(id)) { this.world.remove(m.root); m.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); this.blockModels.delete(id); }

        // ---- boss
        const b = w.boss;
        if (b && b.st !== 'dead') {
            if (!this.bossModel || this.bossModel.kind !== b.kind) {
                if (this.bossModel) this.world.remove(this.bossModel.root);
                this.bossModel = buildBoss(b.kind);
                this.bossModel.kind = b.kind;
                this.world.add(this.bossModel.root);
            }
            const bm = this.bossModel;
            bm.root.visible = true;
            bm.root.position.set(b.x, b.y, 0);
            bm.update(b, t, dt, this);
            const hit = b.parts.some((q) => q.flash > 0 && !q.armor);
            setFlash(bm, hit ? 0.12 : 0);
            if (b.st === 'dying') {
                bm.root.position.x += (Math.random() - 0.5) * 0.3;
                bm.root.position.y -= b.deadT * b.deadT * 0.4;
                setFlash(bm, Math.random() < 0.3 ? 0.6 : 0.1);
            }
            if (b.kind === 'sammael' && b.mode === 'dash' && b.mt > 0.75) this.fx.p({ x: b.x + 1, y: b.y, s0: 1.8, s1: 0.2, c: [0.6, 0.85, 1], a0: 1.2, life: 0.3, shape: SHAPE.orb });
        } else if (this.bossModel && (!b || b.st === 'dead')) {
            this.world.remove(this.bossModel.root); this.bossModel = null;
        }

        this.drawShots(w, dt);
        this.drawBullets(w);
        this.drawCharge(w, dt);
        this.drawWarnings(w, dt);
        this.ambient(w, dt);
        this.fx.update(dt, t);
    }

    trailFlame(e, dt) {
        if (Math.random() > dt * 30) return;
        const col = e.kind === 'skull' ? [1, 0.45, 0.1] : e.kind === 'fly' ? [1, 0.7, 0.2] : [1, 0.35, 0.05];
        this.fx.p({ x: e.x + 0.2 + Math.random() * 0.3, y: e.y + (Math.random() - 0.3) * 0.4, z: -0.1, vx: 2 + Math.random(), vy: 1.2, s0: e.kind === 'fly' ? 0.25 : 0.55, s1: 0.1, c: col, c2: [0.4, 0.05, 0], a0: 1.1, life: 0.35, shape: SHAPE.flame });
    }

    drawGeyser(e, dt) {
        const fx = this.fx;
        if (!e.act) {
            if (Math.random() < dt * 40) fx.p({ x: e.x + (Math.random() - 0.5) * 1.1, y: e.y + 0.2, vy: 1.5 + Math.random() * 2, s0: 0.25, s1: 0.05, c: [1, 0.6, 0.15], a0: 1.6, life: 0.4, shape: SHAPE.orb });
            fx.p({ x: e.x, y: e.y + 0.3, s0: 1.4 + Math.sin(e.t * 20) * 0.2, s1: 1.2, c: [1, 0.3, 0.05], a0: 0.35 + e.t * 0.4, life: 0.03, shape: SHAPE.orb });
        } else {
            const top = e.y + e.h * e.act;
            for (let i = 0; i < 4; i++) {
                const yy = e.y + Math.random() * (top - e.y);
                fx.p({ x: e.x + (Math.random() - 0.5) * 0.9, y: yy, vy: 6 + Math.random() * 5, vx: (Math.random() - 0.5) * 1.5, s0: 1.0 + Math.random() * 0.6, s1: 0.4, c: [1, 0.85, 0.4], c2: [1, 0.3, 0.05], a0: 1.6, life: 0.35, shape: SHAPE.flame });
            }
        }
    }

    drawShots(w, dt) {
        const S = this.shots;
        S.begin();
        for (const s of w.pshots) {
            const a = Math.atan2(s.vy, s.vx);
            switch (s.k) {
                case 'dart': S.add(s.x, s.y, 0.3, 1.0, 0.26, a, 1, 0.92, 0.65, 1.6, SHAPE.dart); break;
                case 'echo': S.add(s.x, s.y, 0.3, 0.8, 0.22, a, 1, 0.85, 0.5, 1.4, SHAPE.dart); break;
                case 'fire': S.add(s.x, s.y, 0.3, s.r * 2.6, s.r * 2.2, a - Math.PI / 2, 1, 0.45, 0.12, 1.5, SHAPE.flame); S.add(s.x, s.y, 0.25, s.r * 3, s.r * 3, 0, 1, 0.3, 0.05, 0.6, SHAPE.orb); break;
                case 'laser': S.add(s.x - 0.6, s.y, 0.3, 2.6, 0.42, a, 0.35, 0.75, 1, 1.8, SHAPE.streak); break;
                case 'diag': S.add(s.x, s.y, 0.3, 1.8, 0.36, a, 0.45, 0.8, 1, 1.6, SHAPE.streak); break;
                case 'mote': S.add(s.x, s.y, 0.3, 0.7, 0.7, 0, 1, 0.82, 0.35, 1.6, SHAPE.orb); S.add(s.x - Math.cos(a) * 0.3, s.y - Math.sin(a) * 0.3, 0.3, 0.9, 0.22, a, 1, 0.7, 0.3, 0.8, SHAPE.streak); break;
                case 'seeker': S.add(s.x, s.y, 0.3, 0.9, 0.3, a, 0.85, 0.95, 1, 1.5, SHAPE.dart); if (Math.random() < 0.5) this.fx.p({ x: s.x, y: s.y, s0: 0.3, s1: 0.05, c: [0.7, 0.9, 1], a0: 0.8, life: 0.25, shape: SHAPE.orb }); break;
                case 'dawn': S.add(s.x - 0.8, s.y, 0.3, 3.2, 0.6, a, 1, 0.92, 0.6, 2, SHAPE.streak); break;
                case 'beam': {
                    const len = 2.2 + s.charge * 5, wid = s.r * 2.6;
                    S.add(s.x - len * 0.35, s.y, 0.35, len, wid, 0, 1, 0.78, 0.3, 2.2, SHAPE.beam);
                    S.add(s.x, s.y, 0.4, wid * 1.6, wid * 1.6, 0, 1, 0.9, 0.6, 1.4, SHAPE.orb);
                    if (Math.random() < 0.6) this.fx.p({ x: s.x - len * 0.6, y: s.y + (Math.random() - 0.5) * wid, vx: -3, s0: 0.35, s1: 0.05, c: [1, 0.8, 0.4], a0: 1.5, life: 0.3, shape: SHAPE.star });
                    break;
                }
                default: S.add(s.x, s.y, 0.3, 0.5, 0.5, 0, 1, 1, 1, 1, SHAPE.orb);
            }
        }
        S.end(this.time);
    }

    drawBullets(w) {
        const S = this.bul;
        const tint = BULLET_TINT[w.si] || BULLET_TINT[0];
        S.begin();
        for (const l of w.lasers) {
            const c = LASER_COL[l.color ?? 0];
            const cx = l.x + Math.cos(l.a) * l.len / 2, cy = l.y + Math.sin(l.a) * l.len / 2;
            if (!l.on) {
                const k = l.t / l.warn;
                const fl = 0.35 + 0.35 * Math.abs(Math.sin(l.t * 30));
                S.add(cx, cy, 0.5, l.len, 0.1 + k * 0.12, l.a, c[0], c[1], c[2], fl, SHAPE.streak);
                S.add(l.x, l.y, 0.5, 0.6 + k * 1.2, 0.6 + k * 1.2, 0, c[0], c[1], c[2], 0.6 + k, SHAPE.orb);
            } else {
                const k = Math.min(1, (l.t - l.warn) / 0.08) * Math.min(1, (l.warn + l.dur - l.t) / 0.1);
                S.add(cx, cy, 0.5, l.len, l.w * 2.6 * k, l.a, c[0], c[1], c[2], 1.8, SHAPE.beam);
                S.add(l.x, l.y, 0.5, l.w * 5, l.w * 5, 0, c[0], c[1], c[2], 1.6 * k, SHAPE.orb);
            }
        }
        for (const b of w.bullets) {
            const L = BULLET_LOOK[b.type] || BULLET_LOOK.orb;
            const a = Math.atan2(b.vy, b.vx);
            const C = tint[b.type] || L.c;
            if (b.type === 'fire') S.add(b.x + Math.cos(a) * -0.15, b.y + Math.sin(a) * -0.15, 0.6, L.s * 1.6, L.s * 1.9, a + Math.PI / 2, 1, 0.45, 0.05, 0.9, SHAPE.flame);
            if (L.len) S.add(b.x, b.y, 0.6, L.s * L.len * 0.55, L.s, a, C[0], C[1], C[2], 1, L.shape);
            else S.add(b.x, b.y, 0.6, L.s, L.s, b.type === 'soul' ? a : 0, C[0], C[1], C[2], 1, L.shape);
        }
        S.end(this.time);
    }

    drawCharge(w, dt) {
        const p = w.player;
        if (!p.alive) return;
        // the heart-light marks the true hitbox
        this.fx.p({ x: p.x, y: p.y, z: 0.6, s0: 0.42, s1: 0.42, c: [1, 0.95, 0.8], a0: 0.9, life: 0.001, shape: SHAPE.orb });
        if (!p.charging) return;
        const k = p.charge, x = p.x + 1.0, y = p.y;
        const full = k >= 1;
        this.fx.p({ x, y, z: 0.5, s0: 0.5 + k * 1.4, s1: 0.5 + k * 1.4, c: full ? [1, 1, 0.8] : [1, 0.8, 0.4], a0: 1.1 + (full ? Math.sin(this.time * 30) * 0.4 : 0), life: 0.001, shape: SHAPE.orb });
        if (Math.random() < dt * 60) {
            const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random();
            this.fx.p({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, s0: 0.25, s1: 0.05, c: [1, 0.85, 0.5], a0: 1.6, life: 0.22, shape: SHAPE.star });
        }
    }

    drawWarnings(w, dt) {
        const keep = [];
        for (const wn of this.warnings) {
            wn.t += dt;
            if (wn.t > wn.life) continue;
            const pulse = 0.5 + 0.5 * Math.sin(wn.t * 22);
            if (wn.type === 'edge') {
                this.fx.p({ x: wn.x, y: wn.y, z: 1, s0: 1.4, s1: 1.4, c: [1, 0.15, 0.1], a0: 1.2 * pulse, life: 0.001, shape: SHAPE.ring });
                this.fx.p({ x: wn.x, y: wn.y, z: 1, s0: 0.5, s1: 0.5, c: [1, 0.3, 0.2], a0: 1.5 * pulse, life: 0.001, shape: SHAPE.orb });
            } else if (wn.type === 'ripple') {
                const x = wn.wx - w.scroll, y = w.terrain.at(wn.wx).floor + 0.25;
                if (Math.random() < 0.5) this.fx.p({ x: x + (Math.random() - 0.5) * 1.4, y, vy: 1.2, s0: 0.3, s1: 0.1, c: [0.4, 1, 0.9], a0: 1.2, life: 0.4, shape: SHAPE.orb });
                this.fx.p({ x, y, z: 0.5, s0: 0.5 + wn.t * 2.5, s1: 0.5 + wn.t * 2.5, c: [0.4, 1, 0.9], a0: 1 - wn.t, life: 0.001, shape: SHAPE.ring });
            }
            keep.push(wn);
        }
        this.warnings = keep;
    }

    ambient(w, dt) {
        // drifting embers / ash / snow / souls in front of the action
        const i = w.si;
        if (Math.random() > dt * 18 * this.fx.quality) return;
        const x = Math.random() * 36, z = 1 + Math.random() * 4;
        const k = [
            { y: -1, vy: 2.5, vx: -1.5, c: [1, 0.5, 0.15], s: 0.12, shape: SHAPE.orb, a: 1.4 },
            { y: 19, vy: -0.5, vx: -1.0, c: [0.7, 0.68, 0.6], s: 0.08, shape: SHAPE.orb, a: 0.6 },
            { y: -1, vy: 3, vx: -2, c: [1, 0.6, 0.2], s: 0.1, shape: SHAPE.star, a: 1.6 },
            { y: -1, vy: 1.2, vx: -0.6, c: [0.3, 1, 0.85], s: 0.14, shape: SHAPE.orb, a: 1.0 },
            { y: 19, vy: -0.6, vx: -0.6, c: [1, 0.4, 0.5], s: 0.1, shape: SHAPE.orb, a: 0.8 },
            { y: 19, vy: -1.6, vx: -2.5, c: [0.9, 0.95, 1], s: 0.1, shape: SHAPE.orb, a: 1.0 },
            { y: -1, vy: 1.5, vx: -1.2, c: [1, 0.9, 0.6], s: 0.1, shape: SHAPE.star, a: 1.2 },
        ][i] || null;
        if (!k) return;
        this.fx.p({ x, y: k.y, z, vx: k.vx, vy: k.vy, s0: k.s, s1: k.s, c: k.c, a0: k.a, a1: k.a, life: 9, shape: k.shape });
    }

    // ---------------------------------------------------------------- draw
    render(dt) {
        if (this.mode !== 'game') this.cinema.update(dt, this.time += dt);
        this.r.render(dt, this.time, this.shakeOn);
    }
}
