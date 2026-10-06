// The view: scene, camera, lights, and syncing the sim's world into meshes each frame.
// It reads the world, never writes it; input asks it what is under the pointer (pick()).

import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { LevelView, THEME } from './level.js';
import { ActorView, monsterSpec } from './actors.js';
import { Fx, JUICE, ELEM_COL } from './fx.js';
import { Loot } from './loot.js';
import { updateFow } from './fow.js';
import { glowTex } from './textures.js';
import { RARITY } from '../config.js';

const _v = new THREE.Vector3();
const HEIGHT = { hero: 1.05, npc: 1.1, mon: 0.9 };

export class View {
    constructor(canvas, layers) {
        this.r = new Renderer(canvas);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 120);
        this.r.setup(this.scene, this.camera);
        this.layers = layers;
        this.level = new LevelView(this.scene);
        this.fx = new Fx(this.scene);
        this.loot = new Loot(this.scene, layers.labels);
        this.actors = new Map();
        this.world = null;
        this.zoom = 1;
        this.shake = 0;
        this.camPos = new THREE.Vector3();
        this.camTarget = new THREE.Vector3();
        this.snap = true;
        this.hover = null;
        this.hitStop = 0;
        this.floaters = [];
        this.bars = new Map();
        this.time = 0;
        this.w = 1; this.h = 1;
        this.heroLook = null;
        this.flash = { r: 1, g: 1, b: 1, a: 0 };

        // Lights.
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
        this.scene.add(this.hemi);
        this.key = new THREE.DirectionalLight(0xffffff, 1.0);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(2048, 2048);
        const sc = this.key.shadow.camera;
        sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
        this.key.shadow.bias = -0.0006; this.key.shadow.normalBias = 0.03;
        this.scene.add(this.key); this.scene.add(this.key.target);
        this.heroLight = new THREE.PointLight(0xffd8a8, 2.5, 15, 1.2);
        this.scene.add(this.heroLight);
        this.pool = [];
        for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 1.6); this.scene.add(l); this.pool.push(l); }
        this.poolT = 0;
        this.r.onTier = (T) => { this.key.shadow.mapSize.set(T.shadowSize, T.shadowSize); if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; } this.fx.setBudget(T.particles); };
        this.fx.setBudget(this.r.T.particles);
    }

    resize(w, h) {
        this.w = w; this.h = h;
        this.r.resize(w, h);
        this.fx.setPointScale(h);
    }

    // ------------------------------------------------------------------ world changes
    enter(world, heroSpec) {
        this.world = world;
        for (const a of this.actors.values()) { this.scene.remove(a.root); a.dispose(); }
        this.actors.clear();
        for (const b of this.bars.values()) b.el.remove();
        this.bars.clear();
        this.fx.clear();
        this.loot.clear();
        this.level.build(world);
        const th = THEME[world.map.theme];
        this.theme = th;
        this.hemi.color.set(th.ambient); this.hemi.groundColor.set(th.ground); this.hemi.intensity = th.ambientK;
        this.key.color.set(th.key);
        this.key.intensity = world.town ? 2.2 : 0.65;
        this.heroLight.intensity = world.town ? 0.6 : 3.2;
        this.heroLight.distance = world.town ? 8 : 15;
        this.scene.background = new THREE.Color(world.town ? 0x8ec2ea : 0x000000);
        this.scene.fog = world.town ? new THREE.Fog(0x9ec8e8, 30, 70) : new THREE.Fog(th.fog, 18, 34);
        const grade = this.r.grade.uniforms;
        const tints = { town: [[0.02, 0.03, 0.06], [1.02, 1.0, 0.95]], cellar: [[0.05, 0.03, 0.06], [1.04, 0.98, 0.9]], jam: [[0.07, 0.01, 0.07], [1.02, 0.95, 1.0]], core: [[0.08, 0.01, 0.02], [1.05, 0.96, 0.88]] }[world.map.theme];
        grade.uShadowTint.value.set(...tints[0]); grade.uHighTint.value.set(...tints[1]);
        grade.uVignette.value = world.town ? 0.5 : 1.0;
        this.heroSpec = heroSpec;
        this.snap = true;
        updateFow(world.vis, world.seen, 0, true);
    }

    /** Rebuild the hero model (equipment or look changed). */
    refreshHero(spec) {
        this.heroSpec = spec;
        const hv = this.world && this.actors.get(this.world.hero.id);
        if (hv) { this.scene.remove(hv.root); hv.dispose(); this.actors.delete(this.world.hero.id); }
    }

    actorFor(ent) {
        let a = this.actors.get(ent.id);
        if (a) return a;
        let spec;
        if (ent.kind === 'hero') spec = { model: 'hero', ...this.heroSpec };
        else if (ent.kind === 'npc') spec = { model: ent.npc };
        else spec = monsterSpec(ent);
        a = new ActorView(spec);
        a.kind = ent.kind;
        a.height = (HEIGHT[ent.kind] || 1) * a.scale;
        if (ent.kind === 'mon' && ent.elite) {
            const col = ent.elite === 'champion' ? 0x4a8aff : ent.boss ? 0xff4a2a : 0xffc23a;
            const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false }));
            aura.scale.setScalar(1.6 / (spec.scale || 1)); aura.position.y = 0.05;
            a.root.add(aura);
            a.aura = aura;
            for (const m of a.flashMats) if (m.emissive) { m.userData.baseEmissive = new THREE.Color(col).multiplyScalar(ent.boss ? 0.04 : 0.12); }
        }
        this.actors.set(ent.id, a);
        this.scene.add(a.root);
        a.root.position.set(ent.x, 0, ent.y);
        return a;
    }

    // ------------------------------------------------------------------ per frame
    frame(world, dt, time) {
        this.time = time;
        this.frameNo = (this.frameNo || 0) + 1;
        const h = world.hero;
        const live = new Set();
        const vis = (e) => world.town || world.visibleTile(e.x, e.y);
        // Hero and townsfolk.
        for (const e of [h, ...world.npcs]) {
            live.add(e.id);
            const a = this.actorFor(e);
            a.root.position.set(e.x, 0, e.y);
            a.root.visible = !(e.kind === 'hero' && e.dead);
            a.update(dt, e, time);
        }
        // Monsters.
        for (const m of world.mons) {
            const a = this.actors.get(m.id);
            if (m.dead) {
                if (a) {
                    live.add(m.id);
                    if (!a.dying) a.dying = 0.001;
                    a.dying += dt;
                    const k = Math.min(1, a.dying / 0.16);
                    a.bob.scale.set(1 + k * 0.6, 1 - k * 0.9, 1 + k * 0.6);
                    if (a.dying > 0.16) a.root.visible = false;
                }
                continue;
            }
            if (!vis(m) && !a) continue;
            live.add(m.id);
            const av = this.actorFor(m);
            if (av.dying) { av.dying = 0; av.root.visible = true; av.bob.scale.set(1, 1, 1); }
            av.root.position.set(m.x, 0, m.y);
            av.root.visible = vis(m) && !(m.burrowed && false);
            if (av.root.visible) av.update(dt, m, time);
            if (av.aura) av.aura.material.opacity = 0.35 + Math.sin(time * 4) * 0.15;
        }
        for (const [id, a] of this.actors) if (!live.has(id)) { this.scene.remove(a.root); a.dispose(); this.actors.delete(id); }

        // Fog, level, loot, fx.
        updateFow(world.vis, world.seen, dt);
        this.level.update(dt, world, time, h);
        this.fx.syncProjs(world, dt, time);
        this.fx.update(dt, this.camera);
        this.loot.sync(world, dt, time, this.camera, this.w, this.h, h);

        // Camera.
        const aspect = this.w / this.h;
        if (this.camMode === 'custom' && this.customCam) {
            const c = this.customCam;
            this.camera.position.set(...c.pos);
            this.camera.lookAt(...c.look);
        } else if (this.camMode === 'orbit') {
            const a = time * 0.045;
            const cx = world.map.w / 2, cz = world.map.h / 2 + 1;
            this.camera.position.set(cx + Math.sin(a) * 15, 10.5, cz + Math.cos(a) * 15);
            this.camera.lookAt(cx, 0.5, cz);
            this.snap = true;
        } else if (this.camMode === 'preview') {
            // Close-up of the hero standing in the square, framed to the right of the creator panel.
            const side = aspect > 1.1 ? 1.15 : 0;
            this.camera.position.set(h.x - side, 1.55, h.y + 3.4);
            this.camera.lookAt(h.x - side, 0.62, h.y);
            this.snap = true;
        } else {
            const z = this.zoom * (aspect < 0.8 ? 1.45 : aspect < 1.2 ? 1.2 : 1);
            this.camTarget.set(h.x, 0, h.y);
            const want = _v.set(h.x, 11.4 * z, h.y + 10.2 * z);
            if (this.snap) { this.camPos.copy(want); this.snap = false; } else this.camPos.lerp(want, 1 - Math.pow(0.0005, dt));
            const sh = this.shake;
            this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z + (Math.random() - 0.5) * sh);
            this.camera.lookAt(this.camPos.x, 0.6, this.camPos.z - 10.2 * z);
            this.shake = Math.max(0, this.shake - dt * 1.8);
        }

        // Lights follow the hero; the pool takes the nearest light sources.
        this.key.position.set(h.x - 6, 14, h.y + 5);
        this.key.target.position.set(h.x, 0, h.y);
        this.heroLight.position.set(h.x, 2.4, h.y + 0.4);
        this.poolT -= dt;
        const srcs = this.level.lightSources;
        if (this.poolT <= 0) {
            this.poolT = 0.2;
            const sorted = srcs.map((s) => ({ s, d: (s.x - h.x) ** 2 + (s.z - h.y) ** 2 })).filter((o) => o.d < 18 * 18).sort((a, b) => a.d - b.d);
            const fl = this.fx.flashes;
            this.poolAssign = [...fl.map((f) => ({ flash: f })), ...sorted.map((o) => ({ s: o.s }))].slice(0, this.pool.length);
        }
        this.pool.forEach((l, i) => {
            const a = this.poolAssign && this.poolAssign[i];
            if (!a) { l.intensity = 0; return; }
            if (a.flash) {
                const f = a.flash; const k = 1 - f.t / f.dur;
                l.position.set(f.x, f.y, f.z); l.color.set(f.color); l.intensity = f.k * Math.max(0, k) * 3; l.distance = 9;
            } else {
                const s = a.s;
                const fl = s.flicker ? 0.85 + Math.sin(time * 11 + s.x * 3) * 0.08 + Math.sin(time * 23 + s.z) * 0.07 : 1;
                l.position.set(s.x, s.y, s.z); l.color.set(s.color); l.intensity = 2.2 * s.k * fl; l.distance = world.town ? 7 : 8;
            }
        });

        // Low-health pulse, flashes.
        const grade = this.r.grade.uniforms;
        const hpf = h.hp / h.maxHp;
        grade.uHurt.value = h.dead ? 0 : Math.max(0, (0.35 - hpf) / 0.35);
        grade.uDesat.value += ((h.dead ? 0.85 : 0) - grade.uDesat.value) * Math.min(1, dt * 2);
        this.flash.a = Math.max(0, this.flash.a - dt * 3);
        grade.uFlash.value.set(this.flash.r, this.flash.g, this.flash.b, this.flash.a);

        this.updateFloaters(dt);
        this.updateBars(world);
        this.r.render(dt);
    }

    doFlash(color, a) { const c = new THREE.Color(color); this.flash = { r: c.r, g: c.g, b: c.b, a }; }

    // ------------------------------------------------------------------ events → effects
    onEvent(e, world) {
        const fx = this.fx;
        const actor = (id) => this.actors.get(id);
        switch (e.type) {
            case 'hit': {
                const m = world.monById(e.id);
                const a = actor(e.id);
                if (a) a.trigger('hit', { big: e.crit });
                if (!e.dot) fx.hitSpray(e.x, e.y, JUICE[m ? m.def.model : 'grape'] || 0xff4a4a, e.crit, e.elem);
                this.floater(e.x, e.y, (a ? a.height : 1) + 0.2, String(e.n), e.crit ? 'crit' : e.dot ? 'dot' : e.elem !== 'phys' ? 'elem-' + e.elem : 'dmg');
                if (e.crit) this.hitStop = Math.max(this.hitStop, 0.035);
                break;
            }
            case 'death': {
                const m = world.monById(e.id);
                const col = JUICE[m ? m.def.model : 'grape'] || 0xff4a4a;
                const size = m ? Math.max(0.7, (m.r / 0.34) * (m.boss ? 1.6 : 1)) : 1;
                fx.splatDeath(e.x, e.y, col, size, e.boss);
                if (e.boss) { this.shake = 1.2; this.doFlash(0xffffff, 0.7); this.hitStop = 0.25; }
                else { this.shake = Math.max(this.shake, e.elite ? 0.35 : 0.12); this.hitStop = Math.max(this.hitStop, e.elite ? 0.08 : 0.02); }
                const b = this.bars.get(e.id); if (b) { b.el.remove(); this.bars.delete(e.id); }
                break;
            }
            case 'heroHit': {
                const a = actor(world.hero.id); if (a) a.trigger('hit', { big: e.big });
                fx.burst(e.x, 0.6, e.y, JUICE.hero, e.big ? 10 : 5, 2.5, 0.045);
                this.floater(e.x, e.y, 1.4, String(e.n), 'hurt');
                this.shake = Math.max(this.shake, e.big ? 0.4 : 0.15);
                if (e.big) this.doFlash(0xff2030, 0.25);
                break;
            }
            case 'dodge': this.floater(e.x, e.y, 1.4, 'DODGE', 'info'); break;
            case 'swing': { const a = actor(world.hero.id); if (a) a.trigger('swing', { dur: e.dur }); break; }
            case 'cast': { const a = actor(world.hero.id); if (a) a.trigger(e.kind === 'shot' || e.kind === 'fan' ? 'shoot' : 'cast', { dur: e.dur }); if (e.kind !== 'shot' && e.kind !== 'fan') fx.sparks(e.x, 1.0, e.y, 0xffe08a, 6, 1.5, 0.35, 0.35); break; }
            case 'slash': fx.slash(e.x, e.y, e.face, e.arc, e.range, e.skill === 'bigslice' ? 0xffd27a : e.skill === 'bash' ? 0x9ad8ff : 0xffffff); break;
            case 'monAttack': {
                const a = actor(e.id);
                if (a) { if (e.kind === 'melee' || e.kind === 'shoot') a.trigger(e.kind === 'melee' ? 'swing' : 'shoot', { dur: e.windup + 0.25 }); else a.trigger('windup', { dur: e.windup, kind: e.kind }); if (e.kind === 'cast' || e.kind === 'spray' || e.kind === 'nova') a.trigger('cast', { dur: e.windup + 0.3 }); }
                break;
            }
            case 'monSwing': if (e.big) { fx.ring(e.x, e.y, 2.5, 0xffffff, 0.35); this.shake = Math.max(this.shake, 0.35); } break;
            case 'impact': if (!e.expire) { const c = { fire: 0xff7a2a, zest: 0xd8ff5a, acid: 0x9aff3a, ember: 0xff7a2a, chutney: 0xff8a1a, juice: 0xffa01a, spore: 0xb06aff, pome: 0xff3a4a }[e.proj] || 0xffffff; fx.sparks(e.x, 0.6, e.y, c, 6, 2, 0.35, 0.25); if (e.proj === 'juice' || e.proj === 'pome') fx.burst(e.x, 0.6, e.y, c, 5, 2, 0.04); } break;
            case 'explode': fx.explosion(e.x, e.y, e.r, e.elem, { big: e.big, splat: e.splat }); if (e.meteor) { fx.melonChunks(e.x, e.y, e.r); this.shake = Math.max(this.shake, 0.7); } else this.shake = Math.max(this.shake, e.big ? 0.5 : 0.25); break;
            case 'chain': fx.lightning(e.pts); break;
            case 'nova': fx.nova(e.x, e.y, e.r, e.elem); this.shake = Math.max(this.shake, 0.2); break;
            case 'land': fx.ring(e.x, e.y, e.r, 0xffe0a0, 0.45, { grow: 1.1, opacity: 1 }); fx.burst(e.x, 0.2, e.y, 0x8a6a4a, 16, 3, 0.05); this.shake = Math.max(this.shake, 0.5); break;
            case 'spin': break;
            case 'buff': fx.swirl(e.x, e.y, 0xff9a2a, 30, 2); fx.ring(e.x, e.y, 1.8, 0xff9a2a, 0.6); break;
            case 'teleport': fx.swirl(e.fx, e.fy, 0xf6ff6a, 20); fx.swirl(e.tx, e.ty, 0xf6ff6a, 20); fx.flashLight(e.tx, 1, e.ty, 0xf6ff6a, 2, 0.3); break;
            case 'dash': fx.burst(e.x, 0.1, e.y, 0xc8b090, 8, 2, 0.04); break;
            case 'trapSet': this.traps = this.traps || new Map(); this.traps.set(e.id, fx.trap(e.x, e.y)); break;
            case 'trapFire': { const t = this.traps && this.traps.get(e.id); if (t) t.t = t.dur; fx.ring(e.x, e.y, e.r, 0xfff06a, 0.4); fx.sparks(e.x, 0.3, e.y, 0xfff06a, 14, 3); break; }
            case 'rain': fx.raisins(e.x, e.y, e.r, e.dur); break;
            case 'meteor': fx.meteor(e.x, e.y, e.r, e.delay); break;
            case 'groundFire': fx.groundArea(e.x, e.y, e.r, e.dur, 'fire'); break;
            case 'stink': fx.groundArea(e.x, e.y, e.r, e.dur, 'stink'); break;
            case 'jamtrail': fx.groundArea(e.x, e.y, e.r, e.dur, 'jamtrail'); break;
            case 'telegraph': fx.telegraph(e.x, e.y, e.r, e.dur, e.elem); break;
            case 'telegraphLine': fx.telegraphLine(e.x, e.y, e.ang, e.len, e.w, e.dur); break;
            case 'freeze': { const m = world.monById(e.id); if (m) fx.sparks(m.x, 0.6, m.y, 0xbff4ff, 8, 1.5, 0.35, 0.5); break; }
            case 'levelup': fx.levelUp(e.x, e.y); this.doFlash(0xffe08a, 0.35); this.floater(e.x, e.y, 2.0, `LEVEL ${e.level}!`, 'level'); break;
            case 'break': fx.burst(e.x, 0.4, e.y, e.obj === 'jar' ? 0xb0103a : e.obj === 'keg' ? 0x7ac8ff : 0xb0864a, 14, 3, 0.05, { stick: e.obj === 'jar' ? 1 : 0 }); fx.sparks(e.x, 0.4, e.y, 0xffe0b0, 6, 2.5, 0.3, 0.3); if (e.obj === 'jar') fx.decal(e.x, e.y, 0xb0103a, 0.9); break;
            case 'open': fx.sparks(e.x, 0.6, e.y, 0xffe08a, e.big ? 26 : 14, 2.5, 0.45, 0.6); fx.flashLight(e.x, 1, e.y, 0xffd08a, 2, 0.4); break;
            case 'shrine': fx.swirl(e.x, e.y, 0xff9ae8, 36, 2.2); this.doFlash(0xffb0e0, 0.25); this.floater(e.x, e.y, 2.2, e.text, 'info'); break;
            case 'drop': if (e.rarity === 'legendary') { this.doFlash(0xffb040, 0.3); fx.sparks(e.x, 0.6, e.y, 0xffc23a, 24, 3, 0.6, 0.8); } break;
            case 'pickup': if (e.what === 'sugar') { this.floater(e.x, e.y, 0.8, `+${e.n} sugar`, 'sugar'); fx.sparks(e.x, 0.3, e.y, 0xffffff, 5, 1.5, 0.3, 0.3); } break;
            case 'drink': { const h = world.hero; fx.swirl(h.x, h.y, e.kind === 'hp' ? 0xff4a6a : 0xffa02a, 14, 1.5); break; }
            case 'pie': fx.swirl(e.x, e.y, 0xff9a5a, 30, 2); break;
            case 'revive': fx.swirl(e.x, e.y, 0xb06aff, 24, 1.5); fx.ring(e.x, e.y, 1.4, 0xb06aff, 0.5); break;
            case 'healMon': fx.swirl(e.x, e.y, 0x7aff8a, 14, 1.2); break;
            case 'summon': fx.swirl(e.x, e.y, 0xff6a3a, 16, 1); fx.ring(e.x, e.y, 1, 0xff6a3a, 0.4); break;
            case 'blink': fx.swirl(e.fx, e.fy, 0xff8a2a, 14); fx.swirl(e.tx, e.ty, 0xff8a2a, 14); break;
            case 'surface': case 'burrow': fx.burst(e.x, 0.1, e.y, 0x6a4a2a, 12, 2.5, 0.05); break;
            case 'mimicWake': this.floater(e.x, e.y, 1.2, 'SURPRISE!', 'crit'); this.shake = 0.3; break;
            case 'bossWake': this.shake = 0.8; this.doFlash(0xff3020, 0.2); break;
            case 'bossPhase': this.shake = 0.6; { const m = world.monById(e.id); if (m) fx.ring(m.x, m.y, 4, 0xff4a2a, 0.6); } break;
            case 'stairsOpen': fx.swirl(e.x, e.y, 0x9a8aff, 30, 2); fx.ring(e.x, e.y, 2, 0x9a8aff, 0.8); break;
            case 'healed': { const h = world.hero; fx.swirl(h.x, h.y, 0x7aff8a, 24, 2); break; }
        }
    }

    // ------------------------------------------------------------------ floating text & bars
    project(x, y, z) { _v.set(x, y, z).project(this.camera); return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h, behind: _v.z > 1 }; }

    floater(x, z, y, text, cls) {
        let f = this.floaters.find((o) => !o.live);
        if (!f) {
            if (this.floaters.length > 60) return;
            const el = document.createElement('div');
            el.className = 'floater';
            this.layers.floaters.appendChild(el);
            f = { el };
            this.floaters.push(f);
        }
        f.live = true; f.t = 0; f.x = x + (Math.random() - 0.5) * 0.3; f.z = z; f.y = y; f.dur = cls === 'level' || cls === 'info' ? 1.8 : 0.9;
        f.el.textContent = text;
        f.el.className = 'floater ' + cls;
        f.el.style.display = 'block';
    }
    updateFloaters(dt) {
        for (const f of this.floaters) {
            if (!f.live) continue;
            f.t += dt;
            if (f.t >= f.dur) { f.live = false; f.el.style.display = 'none'; continue; }
            const k = f.t / f.dur;
            const p = this.project(f.x, f.y + k * 0.9, f.z);
            const s = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - Math.min(0.2, (k - 0.15));
            f.el.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px) translate(-50%, -50%) scale(${s.toFixed(2)})`;
            f.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
        }
    }

    updateBars(world) {
        const seen = new Set();
        for (const m of world.mons) {
            if (m.dead || m.boss) continue;
            const a = this.actors.get(m.id);
            if (!a || !a.root.visible) continue;
            const show = m.hp < m.maxHp || m.elite || (this.hover && this.hover.id === m.id);
            if (!show) continue;
            seen.add(m.id);
            let b = this.bars.get(m.id);
            if (!b) {
                const el = document.createElement('div');
                el.className = 'mbar' + (m.elite ? ' elite ' + m.elite : '');
                el.innerHTML = `${m.elite ? `<span class="mname">${m.name}</span>` : ''}<i><b></b></i>`;
                this.layers.bars.appendChild(el);
                b = { el, fill: el.querySelector('b') };
                this.bars.set(m.id, b);
            }
            const p = this.project(m.x, a.height + 0.35 + (m.flying ? 0.75 : 0), m.y);
            b.el.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px)`;
            b.fill.style.width = `${Math.max(0, (m.hp / m.maxHp) * 100).toFixed(1)}%`;
        }
        for (const [id, b] of this.bars) if (!seen.has(id)) { b.el.remove(); this.bars.delete(id); }
    }

    // ------------------------------------------------------------------ picking
    /** What's under the screen point? Returns { kind, id, ent } or a ground point { kind: 'ground', x, y }. */
    pick(sx, sy, world, { touch = false } = {}) {
        const R = (touch ? 46 : 30) * Math.min(1.4, Math.max(0.7, this.h / 800));
        let best = null, bd = Infinity;
        const consider = (ent, kind, y, r, bias = 0) => {
            const p = this.project(ent.x, y, ent.y);
            if (p.behind) return;
            const d = Math.hypot(p.x - sx, p.y - sy) - bias;
            const lim = R * Math.max(0.8, r / 0.35);
            if (d < lim && d < bd) { bd = d; best = { kind, id: ent.id, ent }; }
        };
        for (const m of world.mons) {
            if (m.dead || m.burrowed || m.state === 'disguised') continue;
            if (!world.visibleTile(m.x, m.y) && !world.town) continue;
            const a = this.actors.get(m.id);
            consider(m, 'mon', a ? a.height * 0.55 + (m.flying ? 0.75 : 0) : 0.5, m.r * (m.boss ? 1.5 : 1), 8);
        }
        for (const n of world.npcs) consider(n, 'npc', 0.6, 0.45, 4);
        for (const o of world.objs) {
            if (!(o.click || (o.breakable && o.state !== 'broken'))) continue;
            if (!world.town && !world.seen[Math.floor(o.y) * world.map.w + Math.floor(o.x)]) continue;
            if (o.state !== 'idle' && (o.type === 'chest' || o.type === 'bigchest')) continue;
            consider(o, 'obj', 0.4, o.r, 0);
        }
        for (const it of world.items) if (world.visibleTile(it.x, it.y) || world.town) consider(it, 'item', 0.15, 0.3, -2);
        if (best) return best;
        const g = this.groundPoint(sx, sy);
        return g ? { kind: 'ground', x: g.x, y: g.z } : null;
    }

    groundPoint(sx, sy) {
        const ndc = new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, this.camera);
        const t = -ray.ray.origin.y / ray.ray.direction.y;
        if (!(t > 0)) return null;
        return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
    }

    setHover(target) {
        const prevId = this.hover && this.hover.id;
        const id = target && target.id;
        if (prevId === id) return;
        if (this.hover) this.highlight(this.hover, false);
        this.hover = target && target.kind !== 'ground' ? target : null;
        if (this.hover) this.highlight(this.hover, true);
    }
    highlight(t, on) {
        if (t.kind === 'mon' || t.kind === 'npc') {
            const a = this.actors.get(t.id);
            if (!a) return;
            for (const m of a.flashMats) { if (!m.emissive) continue; if (on) { m.userData.hoverSave = m.userData.baseEmissive.clone(); m.userData.baseEmissive = m.userData.baseEmissive.clone().add(new THREE.Color(t.kind === 'mon' ? 0x3a0808 : 0x1a2a10)); } else if (m.userData.hoverSave) m.userData.baseEmissive = m.userData.hoverSave; }
        } else if (t.kind === 'obj') {
            const v = this.level.objViews.get(t.id);
            if (!v) return;
            v.g.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && !o.material.userData.shared) { if (on) { o.material.userData.hs = o.material.emissive.getHex(); o.material.emissive.setHex(0x3a2a10); } else if (o.material.userData.hs !== undefined) o.material.emissive.setHex(o.material.userData.hs); } });
        }
    }
}

export { RARITY, ELEM_COL };
