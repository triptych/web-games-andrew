// The battle arena: a floating diorama island (sunny meadow, mushroom grove, crystal cave) in a fixed 3/4 isometric
// view, heroes lower-left, monsters upper-right. The sim resolves each action at once; this module plays the events
// as a queue (run in, swing, hits land, numbers pop, run back) and reports `busy` so the AI waits for the show.
// It also keeps the HP each unit *shows*, so the bars drop when a blow lands, not when the sim decided it.

import * as THREE from 'three';
import { Actor, RAMP } from './assets.js';
import { FX } from './fx.js';
import { MONSTERS, HEROES, SKILLS, REGIONS, CHAINS } from '../sim/data.js';

const mat = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: RAMP });
const HERO_SPOTS = [[-2.3, 1.7], [-3.4, 0.5], [-2.1, -0.6], [-3.3, -1.7]];
// spread across the screen as well as the ground: the camera looks along (0.55, 0.62, 1), so spots that differ only
// along that line overlap in the picture
const ENEMY_SPOTS = [[1.7, -2.2], [3.7, -0.9], [2.0, 1.0], [4.1, 1.7]];
const THEMES = {
    meadow: { top: 0x93d66d, side: 0xb4875a, props: 'flowers' },
    grove: { top: 0x6cbf86, side: 0x8a6a8f, props: 'mushrooms' },
    cave: { top: 0xa5b2e0, side: 0x7c80b0, props: 'crystals' },
};

export class Battle3D {
    constructor(stage, audio) {
        this.stage = stage;
        this.audio = audio;
        this.scene = stage.makeScene('battle', { sky: 0xe6f2ff, ground: 0x9a8a7a });
        this.cam = stage.makeIso('battle', { at: [0, 0.5, 0], dir: [0.55, 0.62, 1], span: 10.5, tall: 0.42, narrow: 8.5 });
        this.fx = new FX(this.scene);
        this.island = new THREE.Group();
        this.scene.add(this.island);
        this.units = {};         // id → { actor, home: Vector3, face }
        this.shownHp = {};
        this.queue = [];
        this.running = false;
        this.waits = [];
        this.time = 0;
        this.ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 40), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
        this.ringMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.ringMesh);
        this.pop = () => {};      // set by main: (worldPos, text, cls) → a floating number
        this.banner = () => {};   // set by main: (text, cls) → a big banner (chain names)
        this.region = null;
    }

    get busy() { return this.running || this.queue.length > 0; }

    // ------------------------------------------------------------------ the island
    buildIsland(region) {
        if (this.region === region) return;
        this.region = region;
        this.island.clear();
        const T = THEMES[region];
        const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 5.6, 0.5, 48), mat(T.top));
        top.position.y = -0.25; top.receiveShadow = true; this.island.add(top);
        const rock = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.2, 40), mat(T.side));
        rock.rotation.x = Math.PI; rock.position.y = -2.1; this.island.add(rock);
        const r = (a) => { let x = Math.sin(a * 12.9898) * 43758.5453; return x - Math.floor(x); };
        // scenery stays on the rim, and anything tall stays on the far side, so nothing stands between the camera and
        // the fighters (the camera looks from +x, +z)
        const far = (x, z) => (x * 0.48 + z * 0.88) < -1.2;
        for (let i = 0; i < 46; i++) {
            const a = r(i) * Math.PI * 2, d = 4.5 + r(i + 50) * 1.3;
            const x = Math.cos(a) * d, z = Math.sin(a) * d;
            const tall = (T.props === 'flowers' && i % 7 === 0) || (T.props === 'mushrooms' && i % 6 === 0) || (T.props === 'crystals' && i % 5 === 0);
            if (tall && !far(x, z)) continue;
            let o;
            if (T.props === 'flowers') {
                o = new THREE.Group();
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3), mat(0x4f9d4a)); stem.position.y = 0.15; o.add(stem);
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat([0xfff27a, 0xffffff, 0xffa6c9, 0xb39dff][i % 4])); head.position.y = 0.32; o.add(head);
                if (i % 7 === 0) { const tree = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), mat(0x6cc35a)); tree.position.y = 1.4; o.add(tree); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1), mat(0x9b6a3f)); tr.position.y = 0.55; o.add(tr); }
            } else if (T.props === 'mushrooms') {
                o = new THREE.Group();
                const h = 0.3 + r(i + 9) * (i % 6 === 0 ? 1.6 : 0.4);
                const st = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.18, h * 0.22, h), mat(0xfff1e0)); st.position.y = h / 2; o.add(st);
                const cap = new THREE.Mesh(new THREE.SphereGeometry(h * 0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat([0xff7aa8, 0xd9a1ff, 0xff9b6b][i % 3])); cap.position.y = h; o.add(cap);
            } else {
                o = new THREE.Group();
                const n = 1 + (i % 3);
                for (let k = 0; k < n; k++) { const h = 0.4 + r(i * 3 + k) * (i % 5 === 0 ? 1.8 : 0.6); const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.22, h, 6), new THREE.MeshToonMaterial({ color: [0xffb3e6, 0x9fefff, 0xc9b3ff][(i + k) % 3], gradientMap: RAMP, emissive: 0x332244 })); c.position.set((k - 1) * 0.18, h / 2, 0); c.rotation.z = (k - 1) * 0.3; o.add(c); }
            }
            o.position.set(x, 0, z);
            o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
            this.island.add(o);
        }
    }

    // ------------------------------------------------------------------ units
    setup(G) {
        const B = G.battle;
        this.buildIsland(B.region);
        this.stage.setBackdrop(B.region);
        for (const u of Object.values(this.units)) this.scene.remove(u.actor.root);
        this.units = {}; this.shownHp = {};
        let hi = 0, ei = 0;
        for (const u of B.units) {
            const isHero = u.side === 'hero';
            const spot = isHero ? HERO_SPOTS[hi++] : ENEMY_SPOTS[ei++];
            const home = new THREE.Vector3(spot[0], 0, spot[1]);
            const M = MONSTERS[u.key];
            const h = isHero ? 1.3 : (M.scale || 1) * 1.1;
            const actor = new Actor(u.key, { height: h, color: isHero ? new THREE.Color(HEROES[u.key].color).getHex() : 0xd0c0ff });
            // face the other side, turned a little toward the camera (which looks from +z) so faces read in the 3/4 view
            const face = isHero ? Math.atan2(1, 0.45) : Math.atan2(-0.8, 1);
            actor.root.rotation.y = face;
            actor.setBase(actor.rigged ? 'battleIdle' : 'idle');
            // heroes run in from the left; monsters pop in
            actor.root.position.copy(isHero ? home.clone().add(new THREE.Vector3(-4, 0, 2)) : home);
            this.scene.add(actor.root);
            this.units[u.id] = { actor, home, face, side: u.side, key: u.key, h, alive: u.alive };
            this.shownHp[u.id] = u.hp;
            if (!isHero) this.fx.burst(home.clone().setY(0.4), 'dust', 1.4);
        }
        this.queue = []; this.running = false; this.waits = [];
        this.run(async () => {
            const heroes = Object.values(this.units).filter((x) => x.side === 'hero');
            await Promise.all(heroes.map((x) => this.moveTo(x, x.home, 4.5)));
        });
    }

    // ------------------------------------------------------------------ the event queue
    onEvents(G, events) {
        for (const e of events) {
            // a battleStart read late (many events flushed at once) may describe a fight that has already ended
            if (e.type === 'battleStart') { if (G.battle) this.setup(G); continue; }
            if (['act', 'chain', 'fled', 'fleeFail', 'victory', 'defeat', 'recover', 'turn', 'regen'].includes(e.type)) this.queue.push(e);
        }
        if (!this.running) this._next();
    }

    run(fn) { this.queue.push({ type: 'fn', fn }); if (!this.running) this._next(); }

    async _next() {
        if (this.running) return;
        const e = this.queue.shift();
        if (!e) return;
        this.running = true;
        try { await this.play(e); } catch (err) { console.warn('[battle view]', err); }
        this.running = false;
        this._next();
    }

    wait(sec) { return new Promise((res) => this.waits.push({ t: this.time + sec, res })); }

    async moveTo(u, dest, speed = 4) {
        const a = u.actor, p = a.root.position;
        a.setBase('run');
        const d = dest.clone().sub(p);
        a.root.rotation.y = Math.atan2(d.x, d.z);
        const dist = d.length();
        const t = dist / speed;
        const from = p.clone();
        const t0 = this.time;
        await new Promise((res) => this.waits.push({ t: t0 + t, res, tick: () => { const k = Math.min(1, (this.time - t0) / t); p.lerpVectors(from, dest, k); } }));
        p.copy(dest);
        a.root.rotation.y = u.face;
        a.setBase(a.rigged ? 'battleIdle' : 'idle');
    }

    _hitAt(rec, el) {
        const u = this.units[rec.id];
        if (!u) return;
        const pos = u.actor.root.position.clone().setY(u.h * 0.8);
        if (rec.miss) { this.pop(pos, 'Miss!', 'miss'); return; }
        if (rec.heal) { this.shownHp[rec.id] = Math.min(this.shownHp[rec.id] + rec.heal, 1e9); this.fx.burst(pos, 'heal', 1); this.pop(pos, '+' + rec.heal, 'heal'); if (rec.revive) { u.alive = true; u.actor.root.visible = true; u.actor.setBase(u.actor.rigged ? 'battleIdle' : 'idle'); } return; }
        if (rec.mpHeal) { this.pop(pos, '+' + rec.mpHeal + ' MP', 'mp'); return; }
        if (rec.buff) { this.fx.burst(pos, 'buff', 1); this.pop(pos, Object.keys(rec.buff).map((k) => k.toUpperCase() + '↑').join(' '), 'buff'); return; }
        if (rec.debuff) { this.fx.burst(pos, 'dust', 0.8); this.pop(pos, Object.keys(rec.debuff).map((k) => k.toUpperCase() + '↓').join(' '), 'debuff'); return; }
        if (rec.dmg == null) return;
        this.fx.burst(pos, el || 'none', rec.crit ? 1.5 : 1);
        this.shownHp[rec.id] = Math.max(0, this.shownHp[rec.id] - rec.dmg - (rec.comboDmg || 0));
        this.pop(pos, String(rec.dmg), (rec.crit ? 'crit ' : '') + (rec.weak ? 'weak' : rec.resist ? 'resist' : ''));
        if (rec.weak) this.pop(pos.clone().setY(pos.y + 0.5), 'WEAK!', 'tag');
        if (rec.comboDmg) { this.pop(pos.clone().setY(pos.y + 0.9), `${rec.combo.name}! +${rec.comboDmg}`, 'combo'); this.fx.ring(u.actor.root.position, 0xffd166, 2); }
        if (rec.stagger) { this.pop(pos.clone().setY(pos.y + 1.2), 'STAGGER!', 'stagger'); this.fx.burst(pos.clone().setY(pos.y + 0.5), 'star', 1.2); }
        u.actor.hitFlash();
        this.audio?.sfx(rec.crit ? 'crit' : 'hit');
        if (rec.stagger) this.audio?.sfx('stagger');
        if (rec.ko) {
            u.alive = false;
            const d = u.actor.play('faint', { hold: true });
            if (u.side === 'enemy') { this.audio?.sfx('defeat'); this.wait(d + 0.2).then(() => { this.fx.burst(u.actor.root.position.clone().setY(0.4), 'dust', 1.6); u.actor.root.visible = false; }); }
        } else u.actor.play('hit');
    }

    async play(e) {
        if (e.type === 'fn') return e.fn();
        if (e.type === 'turn') {
            const u = this.units[e.id];
            if (u) { this.ringMesh.position.copy(u.home).setY(0.03); this.ringMesh.material.color.setHex(u.side === 'hero' ? 0xffe066 : 0xff8a8a); }
            return;
        }
        if (e.type === 'regen') { const u = this.units[e.id]; if (u) { this.shownHp[e.id] += e.n; this.fx.burst(u.actor.root.position.clone().setY(0.8), 'heal', 0.6); } return; }
        if (e.type === 'recover') { const u = this.units[e.id]; if (u) this.pop(u.actor.root.position.clone().setY(u.h), 'Recovered', 'buff'); return; }
        if (e.type === 'act') return this.playAct(e);
        if (e.type === 'chain') return this.playChain(e);
        if (e.type === 'fleeFail') {
            const u = this.units[e.actor];
            if (!u || e.boss) { this.pop(u ? u.actor.root.position.clone().setY(1.4) : new THREE.Vector3(), 'Can\'t run from a boss!', 'tag'); return this.wait(0.6); }
            await this.moveTo(u, u.home.clone().add(new THREE.Vector3(-1.6, 0, 1.2)), 5);
            u.actor.play('hit'); this.pop(u.actor.root.position.clone().setY(1.3), 'Tripped!', 'tag'); this.audio?.sfx('hit');
            await this.wait(0.6);
            return this.moveTo(u, u.home, 4);
        }
        if (e.type === 'fled') {
            this.audio?.sfx('flee');
            const hs = Object.values(this.units).filter((x) => x.side === 'hero' && x.alive);
            await Promise.all(hs.map(async (u, i) => {
                await this.wait(i * 0.12);
                if (i === 1) { u.actor.play('hit'); this.pop(u.actor.root.position.clone().setY(1.3), 'Wait for me!', 'tag'); await this.wait(0.5); }
                const dest = u.home.clone().add(new THREE.Vector3(-7, 0, 5));
                this.fx.burst(u.actor.root.position.clone().setY(0.2), 'dust', 1);
                return this.moveTo(u, dest, 7);
            }));
            return this.wait(0.3);
        }
        if (e.type === 'victory') {
            for (const u of Object.values(this.units)) if (u.side === 'hero' && u.alive) u.actor.play('victory', { hold: true });
            this.fx.burst(new THREE.Vector3(-2.5, 1.2, 0), 'coin', 1.6);
            return this.wait(1.2);
        }
        if (e.type === 'defeat') {
            for (const u of Object.values(this.units)) if (u.side === 'hero') u.actor.play('faint', { hold: true });
            return this.wait(1.2);
        }
    }

    async playAct(e) {
        const a = this.units[e.actor];
        if (!a) return;
        const S = SKILLS[e.skill] || {};
        const hits = e.hits || [];
        const firstT = hits.find((h) => h.dmg != null || h.miss)?.id;
        const tgt = firstT && this.units[firstT];
        const melee = (e.kind === 'dmg' || e.kind === 'steal') && S.stat === 'atk' && S.target === 'one' && tgt;
        if (e.kind === 'defend') { this.fx.ring(a.actor.root.position, 0x9fd8ff, 1.2); this.pop(a.actor.root.position.clone().setY(1.3), 'Guard', 'buff'); return this.wait(0.4); }
        if (a.side === 'hero') this.audio?.voice(a.key, e.skill === 'attack' ? null : e.kind === 'heal' ? 'heal' : 'skill', 0.35);
        if (melee) {
            const dir = tgt.actor.root.position.clone().sub(a.actor.root.position).setY(0);
            const stop = tgt.actor.root.position.clone().addScaledVector(dir.normalize(), -0.95 * (tgt.h > 1.3 ? 1.4 : 1));
            await this.moveTo(a, stop, 6);
            a.actor.root.rotation.y = Math.atan2(dir.x, dir.z);
            const clip = e.skill === 'attack' ? 'attack' : a.actor.has('skill') ? 'skill' : 'attack';
            const d = a.actor.play(clip);
            this.audio?.sfx(e.el && e.el !== 'none' ? e.el : 'slash');
            await this.wait(Math.min(0.55, d * 0.45));
            const per = Math.max(1, hits.length);
            for (let i = 0; i < hits.length; i++) { this._hitAt(hits[i], e.el); if (i < hits.length - 1) await this.wait(0.18); }
            if (e.stole) this.pop(tgt.actor.root.position.clone().setY(1.5), 'Got it!', 'tag');
            if (e.stoleGold) this.pop(tgt.actor.root.position.clone().setY(1.5), `+${e.stoleGold} G`, 'heal');
            await this.wait(Math.max(0.2, d * 0.55 - 0.18 * (per - 1)));
            if (a.alive !== false) await this.moveTo(a, a.home, 6);
            return;
        }
        // in place: a cast, a buff, a heal, an item, a monster's breath
        const clip = e.kind === 'item' ? 'wave' : (e.skill === 'attack' ? 'attack' : a.actor.has('skill') ? 'skill' : 'attack');
        const d = a.actor.play(clip);
        this.audio?.sfx(e.kind === 'heal' ? 'heal' : e.kind === 'buff' ? 'buff' : e.el && e.el !== 'none' ? e.el : 'slash');
        if (a.side === 'enemy' && !a.actor.rigged) await this.wait(0.25);
        else await this.wait(Math.min(0.7, d * 0.5));
        // a projectile of the element towards each target
        if (e.kind === 'dmg' || e.kind === 'debuff' || e.kind === 'item') {
            for (const id of new Set(hits.map((h) => h.id))) {
                const t = this.units[id];
                if (t) this.fx.burst(a.actor.root.position.clone().lerp(t.actor.root.position, 0.5).setY(1), e.el || 'none', 0.7);
            }
            await this.wait(0.15);
        }
        for (const h of hits) this._hitAt(h, e.el);
        await this.wait(Math.max(0.25, d * 0.4));
    }

    async playChain(e) {
        const C = CHAINS[e.chain];
        this.audio?.sfx('chain');
        this.audio?.voice(e.actor, 'chain', 1);
        this.banner(e.name, C.members.length > 2 ? 'trio' : C.members.length > 1 ? 'duo' : 'solo');
        const cu = this.cam.userData;
        cu.zoom = 1.25; this.stage.fitCam(this.cam);
        this.fx.ring(new THREE.Vector3(0, 0, 0), 0xffe066, 6);
        await this.wait(0.6);
        // each member leaps in for their hits
        const byHero = {};
        for (const h of e.hits) (byHero[h.by] ||= []).push(h);
        for (const [hero, hs] of Object.entries(byHero)) {
            const u = this.units[hero];
            if (!u) continue;
            const t = this.units[hs[0].id];
            const stop = t ? t.actor.root.position.clone().lerp(u.home, 0.35) : u.home;
            await this.moveTo(u, stop, 9);
            const d = u.actor.play(u.actor.has('chain') ? 'chain' : 'attack');
            this.audio?.sfx(hs[0].el || 'slash');
            await this.wait(Math.min(0.6, d * 0.5));
            for (const h of hs) this._hitAt(h, h.el);
            await this.wait(0.35);
            this.moveTo(u, u.home, 8);
        }
        await this.wait(0.5);
        cu.zoom = 1; this.stage.fitCam(this.cam);
    }

    // ------------------------------------------------------------------ per frame
    update(G, dt) {
        this.time += dt;
        for (let i = this.waits.length - 1; i >= 0; i--) {
            const w = this.waits[i];
            w.tick?.();
            if (this.time >= w.t) { this.waits.splice(i, 1); w.res(); }
        }
        for (const u of Object.values(this.units)) u.actor.update(dt);
        this.ringMesh.rotation.z += dt;
        this.ringMesh.visible = !!G.battle && ['command', 'ai'].includes(G.battle.phase) && !this.busy;
        if (this.ringMesh.visible && G.battle) { const u = this.units[G.battle.actor]; if (u) this.ringMesh.position.copy(u.home).setY(0.03); }
        this.fx.update(dt);
    }

    unitScreen(id) {
        const u = this.units[id];
        if (!u) return null;
        return this.stage.toScreen(u.actor.root.position.clone().setY(u.h + 0.35), 'battle');
    }

    pickUnit(clientX, clientY) {
        const rc = this.stage.ray(clientX, clientY, 'battle');
        let best = null, bd = 0.8;
        for (const [id, u] of Object.entries(this.units)) {
            if (!u.alive) continue;
            const d = rc.ray.distanceToPoint(u.actor.root.position.clone().setY(u.h * 0.5));
            if (d < bd) { bd = d; best = id; }
        }
        return best;
    }

    render() { this.stage.render('battle', 'battle'); }
}
