// The view: reads the battle and plays the sim's events as animation. Never changes G.
//
// The sim resolves a card at once and pushes events; the view queues them and plays them in order (a
// stack marching hex by hex, a lunge and the strike back, a spell). While anything plays, `busy` is
// true: the controller ignores the board and the foe waits. When the queue empties every figure is
// snapped to the battle, so a missed animation can never leave the picture wrong.
//
// Each stack shows 1-3 miniatures and a tag under them (count, ward, ailments); a foe's tag also shows
// its intent above it. Tags and floating numbers are DOM, so text stays crisp.

import * as THREE from 'three';
import { Stage, hexPos, FX_LAYER, BOARD_CENTER } from './stage.js';
import { figure, FIGURE } from './models.js';
import { washMaterial, spriteTex, ownMaterial, PALETTE, inkMaterial } from './ink.js';
import { CREATURES, FOES } from '../sim/data.js';
import { unitDef, totalHp, stackById } from '../sim/battle.js';
import { key as hkey } from '../sim/hex.js';

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const out = (k) => 1 - (1 - k) ** 3;

const HL = {
    move: 0xd8a530, attack: 0xb5532d, target: 0x3f7f96, deploy: 0x6b8a4a, area: 0xe2702c, threat: 0xa83a2a, ally: 0x6b8a4a, hover: 0x231b14,
};
const ST_GLYPH = { weak: 'Wk', vuln: 'Vu', root: 'Rt', stun: 'Zz', burn: 'Bn', might: 'Mt', haste: 'Hs', brace: 'Br', taunt: 'Ch' };
const ST_NAME = { weak: 'Weak', vuln: 'Vulnerable', root: 'Rooted', stun: 'Stunned', burn: 'Burning', might: 'Might', haste: 'Haste', brace: 'Braced', taunt: 'Challenging' };
export { ST_NAME };

class Tweens {
    constructor() { this.list = []; }
    add(dur, fn, done) { const t = { t: 0, dur: Math.max(0.0001, dur), fn, done }; this.list.push(t); return t; }
    update(dt) {
        for (const t of this.list.slice()) {
            t.t += dt;
            const k = Math.min(1, t.t / t.dur);
            t.fn?.(k);
            if (k >= 1) { this.list.splice(this.list.indexOf(t), 1); t.done?.(); }
        }
    }
    clear() { for (const t of this.list) { t.fn?.(1); t.done?.(); } this.list = []; }
}

export class View {
    constructor(canvas, { labels, floats, audio, hooks = {} } = {}) {
        this.stage = new Stage(canvas);
        this.scene = this.stage.scene;
        this.labels = labels;
        this.floats = floats;
        this.audio = audio;
        this.hooks = hooks;
        this.tw = new Tweens();
        this.q = [];
        this.waitT = 0;
        this.speed = 1;
        this.calm = false;
        this.B = null;
        this.figs = new Map();       // stack id → { grp, key, side, disp, tag, figs }
        this.units = new THREE.Group();
        this.scene.add(this.units);
        this.fx = new THREE.Group();
        this.scene.add(this.fx);
        this.time = 0;
        this.visible = true;

        // highlight pool: a watercolour blot per hex
        this.hlGroup = new THREE.Group();
        this.scene.add(this.hlGroup);
        this.hlGeo = new THREE.CircleGeometry(0.86, 6);
        this.hlGeo.rotateX(-Math.PI / 2);
        this.hlGeo.rotateY(Math.PI / 6);
        this.hl = [];
        // the selection: an inked ring on the ground
        this.ring = this.sprite('ward', 1.9);
        this.ring.material.rotation = 0;
        this.ring.visible = false;
        this.ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 6, 1), new THREE.MeshBasicMaterial({ color: 0x231b14, transparent: true, opacity: 0.9, depthWrite: false }));
        this.ringMesh.geometry.rotateX(-Math.PI / 2);
        this.ringMesh.geometry.rotateY(Math.PI / 6);
        this.ringMesh.layers.set(FX_LAYER);
        this.ringMesh.visible = false;
        this.scene.add(this.ringMesh);
        this.path = [];
    }

    get busy() { return this.q.length > 0 || this.waitT > 0; }
    setCalm(v) { this.calm = v; this.stage.calm = v; }

    // ------------------------------------------------------------------ showing a battle
    showBattle(B, act = 0, { orbit = false } = {}) {
        this.clear();
        this.B = B;
        this.act = act;
        this.stage.orbit = orbit ? 0.12 : 0;
        const wash = [PALETTE.olive, 0x4f7a6e, 0xa8502e][act] ?? PALETTE.olive;
        this.stage.buildGround(wash);
        this.stage.buildDecor(B.rocks.reduce((a, k) => a * 31 + k, 7 + act), act);
        this.stage.setRocks(B.rocks, act + 1);
        for (const s of B.stacks) this.addStack(s);
        this.sync();
    }

    clear() {
        this.q = []; this.waitT = 0; this.tw.clear();
        for (const f of this.figs.values()) { this.units.remove(f.grp); f.tag.remove(); }
        this.figs.clear();
        for (const c of [...this.fx.children]) this.fx.remove(c);
        this.setHighlights([]);
        this.select(null);
        this.B = null;
    }

    addStack(s) {
        const def = unitDef(s);
        const [scale, maxN] = FIGURE[s.key] || [0.45, 3];
        const grp = new THREE.Group();
        const figs = [];
        for (let i = 0; i < maxN; i++) {
            const f = figure(s.key, s.side);
            f.scale.setScalar(scale);
            grp.add(f);
            figs.push(f);
        }
        grp.position.copy(hexPos(s.c, s.r));
        grp.rotation.y = s.side === 'p' ? Math.PI / 2 : -Math.PI / 2;
        this.units.add(grp);
        const tag = document.createElement('div');
        tag.className = 'tag ' + (s.side === 'p' ? 'you' : 'foe') + (def.boss ? ' boss' : '');
        tag.innerHTML = '<div class="intent"></div><div class="plate"><b class="n"></b><i class="w"></i></div><div class="sts"></div>';
        this.labels.appendChild(tag);
        const f = { grp, figs, key: s.key, side: s.side, tag, maxN, scale, disp: { count: s.count, ward: s.ward, c: s.c, r: s.r }, dead: false, mats: null };
        this.figs.set(s.id, f);
        this.layoutFigs(f, s.count, s.start);
        return f;
    }

    /** How many miniatures a stack shows, and where they stand in its hex. */
    layoutFigs(f, count, start) {
        const n = f.maxN === 1 ? 1 : Math.max(1, Math.min(f.maxN, count >= 6 || count >= start * 0.66 ? f.maxN : count >= 2 ? Math.min(2, f.maxN) : 1));
        const spots = n === 1 ? [[0, 0]] : n === 2 ? [[-0.22, 0.2], [0.24, -0.18]] : [[0.28, 0], [-0.22, -0.32], [-0.22, 0.32]];
        f.figs.forEach((m, i) => {
            m.visible = i < n;
            if (i < n) m.position.set(spots[i][1], 0, spots[i][0]);
        });
    }

    /** Snap everything to the battle as it stands. */
    sync() {
        const B = this.B;
        if (!B) return;
        const live = new Set(B.stacks.map((s) => s.id));
        for (const [id, f] of [...this.figs]) if (!live.has(id)) { this.units.remove(f.grp); f.tag.remove(); this.figs.delete(id); }
        for (const s of B.stacks) {
            const f = this.figs.get(s.id) || this.addStack(s);
            f.disp = { count: s.count, ward: s.ward, c: s.c, r: s.r };
            f.grp.position.copy(hexPos(s.c, s.r));
            f.grp.rotation.set(0, s.side === 'p' ? Math.PI / 2 : -Math.PI / 2, 0);
            f.grp.scale.setScalar(1);
            for (const m of f.figs) { m.rotation.set(0, 0, 0); }
            this.layoutFigs(f, s.count, s.start);
            this.setFade(f, 1);
        }
        this.stage.setRocks(B.rocks, (this.act || 0) + 1);
    }

    setFade(f, a) {
        if (a >= 1 && !f.mats) return;
        if (!f.mats) {
            f.mats = new Map();
            f.grp.traverse((o) => { if (o.isMesh) { if (!f.mats.has(o.material)) f.mats.set(o.material, ownMaterial(o.material)); o.material = f.mats.get(o.material); } });
        }
        for (const m of f.mats.values()) m.uniforms.uAlpha.value = a;
    }
    flash(f, k, col = [0.71, 0.33, 0.18]) {
        if (!f.mats) this.setFade(f, 0.999);
        for (const m of f.mats.values()) { m.uniforms.uFlash.value = k; m.uniforms.uFlashCol.value.set(...col); }
    }

    // ------------------------------------------------------------------ highlights, selection
    /** list: [{ c, r, kind }] */
    setHighlights(list) {
        while (this.hl.length < list.length) {
            const m = new THREE.Mesh(this.hlGeo, washMaterial(0xffffff));
            m.layers.set(FX_LAYER);
            m.renderOrder = 1;
            this.hlGroup.add(m);
            this.hl.push(m);
        }
        this.hl.forEach((m, i) => {
            const h = list[i];
            m.visible = !!h;
            if (!h) return;
            m.position.copy(hexPos(h.c, h.r, 0.03 + (h.kind === 'hover' ? 0.01 : 0)));
            const col = HL[h.kind] ?? HL.move;
            m.material.uniforms.uWash.value.set(((col >> 16) & 255) / 255, ((col >> 8) & 255) / 255, (col & 255) / 255);
            m.material.uniforms.uAlpha.value = h.kind === 'threat' ? 0.35 : h.kind === 'hover' ? 0.3 : 0.85;
            m.userData.kind = h.kind;
        });
    }

    select(id) {
        this.selected = id;
        const f = id != null ? this.figs.get(id) : null;
        this.ringMesh.visible = !!f;
    }

    /** A dotted path drawn for a planned move. */
    showPath(path) {
        for (const p of this.path) this.fx.remove(p);
        this.path = [];
        if (!path) return;
        for (let i = 1; i < path.length; i++) {
            const a = hexPos(...path[i - 1], 0.06), b = hexPos(...path[i], 0.06);
            for (let k = 0.2; k < 1; k += 0.3) {
                const s = this.sprite('splat', 0.16);
                s.position.copy(a).lerp(b, k);
                this.fx.add(s);
                this.path.push(s);
            }
        }
    }

    // ------------------------------------------------------------------ effects
    sprite(kind, size = 1) {
        const m = new THREE.SpriteMaterial({ map: spriteTex(kind), transparent: true, depthWrite: false, depthTest: true });
        const s = new THREE.Sprite(m);
        s.scale.setScalar(size);
        s.layers.set(FX_LAYER);
        return s;
    }

    burst(kind, at, { n = 6, size = 0.5, spread = 0.7, rise = 0.6, dur = 0.6, y = 0.5 } = {}) {
        if (this.calm) n = Math.ceil(n / 2);
        for (let i = 0; i < n; i++) {
            const s = this.sprite(kind, size * (0.6 + Math.random() * 0.6));
            const a = Math.random() * Math.PI * 2, d = spread * (0.3 + Math.random() * 0.7);
            const from = at.clone().add(new THREE.Vector3(0, y, 0));
            const to = from.clone().add(new THREE.Vector3(Math.cos(a) * d, rise * (0.4 + Math.random()), Math.sin(a) * d));
            s.material.rotation = Math.random() * 6;
            this.fx.add(s);
            this.tw.add(dur * (0.7 + Math.random() * 0.5), (k) => {
                s.position.lerpVectors(from, to, out(k));
                s.material.opacity = 1 - k * k;
            }, () => this.fx.remove(s));
        }
    }

    projectile(kind, from, to, dur, { arc = 1.2, size = 0.5, spin = 0 } = {}) {
        let obj;
        if (kind === 'arrow') {
            obj = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0x231b14 }));
            shaft.rotation.x = Math.PI / 2;
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), new THREE.MeshBasicMaterial({ color: 0x231b14 }));
            tip.rotation.x = Math.PI / 2; tip.position.z = 0.34;
            obj.add(shaft, tip);
            obj.traverse((o) => o.layers.set(FX_LAYER));
        } else obj = this.sprite(kind, size);
        const a = from.clone(), b = to.clone();
        this.fx.add(obj);
        let prev = a.clone();
        this.tw.add(dur, (k) => {
            const p = a.clone().lerp(b, k);
            p.y += Math.sin(k * Math.PI) * arc;
            obj.position.copy(p);
            if (kind === 'arrow') { obj.lookAt(p.clone().add(p.clone().sub(prev))); prev = p.clone(); }
            if (obj.material && spin) obj.material.rotation += spin * 0.1;
        }, () => this.fx.remove(obj));
    }

    float(at, text, cls = '') {
        if (!this.floats) return;
        const p = this.stage.toScreen(at.clone().add(new THREE.Vector3(0, 1.2, 0)));
        const el = document.createElement('div');
        el.className = 'float ' + cls;
        el.textContent = text;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        this.floats.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    // ------------------------------------------------------------------ the event queue
    onEvents(events) { for (const e of events) this.q.push(e); }

    /** Skip whatever is playing: clear the queue and snap to the battle. */
    skip() { this.q = []; this.waitT = 0; this.tw.clear(); this.sync(); }

    pump(dt) {
        const k = dt * this.speed;
        if (this.waitT > 0) { this.waitT -= k; if (this.waitT > 0) return; this.waitT = 0; }
        let guard = 0;
        while (this.q.length && this.waitT <= 0 && guard++ < 40) {
            const e = this.q.shift();
            this.waitT = Math.max(0, this.play(e) || 0);
        }
        if (!this.q.length && this.waitT <= 0 && this.wasBusy) { this.sync(); this.hooks.idle?.(); }
        this.wasBusy = this.busy;
    }

    figOf(id) { return this.figs.get(id) || null; }
    posOf(id) { const f = this.figOf(id); return f ? f.grp.position.clone() : BOARD_CENTER.clone(); }

    face(f, toPos) {
        const d = toPos.clone().sub(f.grp.position);
        if (d.lengthSq() < 1e-4) return;
        f.grp.rotation.y = Math.atan2(d.x, d.z);
    }

    /** Play one event; returns how long to wait before the next. */
    play(e) {
        const A = this.audio;
        const sp = 1;
        switch (e.type) {
            case 'deploy': {
                const f = this.figOf(e.id);
                if (f) { f.grp.position.copy(hexPos(e.c, e.r)); f.disp.c = e.c; f.disp.r = e.r; }
                if (e.swap != null) { const o = this.figOf(e.swap); const s = stackById(this.B, e.swap); if (o && s) o.grp.position.copy(hexPos(s.c, s.r)); }
                A?.sfx('step');
                return 0;
            }
            case 'begin': this.hooks.banner?.('To Battle!', 'big'); A?.sfx('horn'); return 0.6;
            case 'turn':
                this.hooks.turn?.(e.side, e.n);
                if (e.side === 'p') { this.hooks.banner?.(`Turn ${e.n}`); A?.sfx('drum'); return 0.45; }
                this.hooks.banner?.('The Foe Moves', 'foe'); A?.sfx('drum2'); return 0.55;
            case 'move': {
                const f = this.figOf(e.id);
                if (!f) return 0;
                const pts = e.path.map(([c, r]) => hexPos(c, r));
                const steps = Math.max(1, pts.length - 1);
                const per = e.fly ? 0.5 : 0.17;
                const dur = e.fly ? 0.55 : per * steps;
                this.face(f, pts[pts.length - 1]);
                this.tw.add(dur / sp, (k) => {
                    if (e.fly) {
                        const p = pts[0].clone().lerp(pts[pts.length - 1], ease(k));
                        p.y = Math.sin(k * Math.PI) * 1.4;
                        f.grp.position.copy(p);
                    } else {
                        const t = k * steps, i = Math.min(steps - 1, Math.floor(t)), kk = t - i;
                        const p = pts[i].clone().lerp(pts[i + 1], kk);
                        p.y = Math.abs(Math.sin(kk * Math.PI)) * 0.18;
                        f.grp.position.copy(p);
                    }
                }, () => { f.grp.position.copy(pts[pts.length - 1]); });
                const [c, r] = e.path[e.path.length - 1];
                f.disp.c = c; f.disp.r = r;
                A?.sfx(e.fly ? 'wings' : 'march');
                return dur + 0.04;
            }
            case 'attack': {
                const a = this.figOf(e.id), t = this.figOf(e.target);
                if (!a || !t) return 0;
                const from = a.grp.position.clone(), to = t.grp.position.clone();
                this.face(a, to);
                if (e.shot) {
                    const ranged = unitDef(stackById(this.B, e.id) || { side: a.side, key: a.key });
                    const isMage = a.key === 'mages' || a.key === 'cultists' || a.key === 'shamans' || a.key === 'murkwater' || a.key === 'gloomeye';
                    const fire = a.key === 'salamanders';
                    void ranged;
                    if (isMage || fire) this.projectile(fire ? 'flame' : a.key === 'gloomeye' ? 'hex' : 'spark', from.clone().setY(0.9), to.clone().setY(0.5), 0.4, { arc: 0.6, size: 0.55 });
                    else for (let i = 0; i < 3; i++) this.projectile('arrow', from.clone().add(new THREE.Vector3((i - 1) * 0.15, 0.8, 0)), to.clone().add(new THREE.Vector3((i - 1) * 0.2, 0.4, 0)), 0.42 + i * 0.04, { arc: 1.4 });
                    A?.sfx(isMage ? 'zap' : fire ? 'fire' : 'bow');
                    this.tw.add(0.44, null, () => this.impact(t, e));
                    return 0.62;
                }
                const lunge = to.clone().sub(from).multiplyScalar(0.4).add(from);
                this.tw.add(0.16, (k) => f2(k), () => this.impact(t, e));
                const f2 = (k) => a.grp.position.lerpVectors(from, lunge, out(k));
                this.tw.add(0.34, (k) => { if (k > 0.47) a.grp.position.lerpVectors(lunge, from, ease((k - 0.47) / 0.53)); });
                if (e.retal) A?.sfx('parry');
                return e.retal ? 0.5 : 0.42;
            }
            case 'hit': {
                const f = this.figOf(e.id);
                if (!f) return 0;
                f.disp.count = e.count;
                f.disp.ward = Math.max(0, f.disp.ward - e.ward);
                const st = stackById(this.B, e.id);
                this.layoutFigs(f, e.count, st ? st.start : e.count);
                if (e.src === 'spell' || e.src === 'burn') this.impact(f, { dmg: e.dmg, quiet: true });
                const at = f.grp.position.clone();
                if (e.ward) this.float(at, `◈${e.ward}`, 'ward');
                if (e.lost) this.float(at.clone().add(new THREE.Vector3(0, 0.25, 0)), `−${e.lost}`, f.side === 'p' ? 'hurt you' : 'hurt');
                if (e.killed) this.float(at.clone().add(new THREE.Vector3(0, 0.55, 0)), `${e.killed} slain`, 'slain');
                return 0.06;
            }
            case 'death': {
                const f = this.figOf(e.id);
                if (!f || f.dead) return 0;
                f.dead = true;
                f.tag.classList.add('gone');
                const at = f.grp.position.clone();
                this.burst('splat', at, { n: 4, size: 0.7, spread: 0.6, rise: 0.05, y: 0.1, dur: 0.9 });
                this.setFade(f, 1);
                this.tw.add(0.7, (k) => {
                    for (const m of f.figs) m.rotation.z = -k * 1.4;
                    f.grp.position.y = -k * 0.3;
                    this.setFade(f, 1 - k);
                }, () => { this.units.remove(f.grp); f.tag.remove(); this.figs.delete(e.id); });
                A?.sfx('death');
                return 0.5;
            }
            case 'ward': {
                const f = this.figOf(e.id);
                if (!f) return 0;
                f.disp.ward += e.amt;
                const s = this.sprite('ward', 1.6);
                s.position.copy(f.grp.position).setY(0.7);
                this.fx.add(s);
                this.tw.add(0.5, (k) => { s.scale.setScalar(1.6 + k * 0.5); s.material.opacity = 1 - k; }, () => this.fx.remove(s));
                A?.sfx('ward');
                return 0.2;
            }
            case 'heal': {
                const f = this.figOf(e.id);
                if (!f) return 0;
                f.disp.count = e.count;
                const st = stackById(this.B, e.id);
                this.layoutFigs(f, e.count, st ? st.start : e.count);
                this.burst('heal', f.grp.position, { n: 6, size: 0.3, rise: 1.0, spread: 0.4 });
                if (e.n) this.float(f.grp.position.clone(), `+${e.n} rise`, 'heal');
                A?.sfx('heal');
                return 0.3;
            }
            case 'status': {
                const f = this.figOf(e.id);
                if (f && ['weak', 'vuln', 'root', 'stun', 'burn'].includes(e.k)) this.float(f.grp.position.clone().add(new THREE.Vector3(0, 0.8, 0)), ST_NAME[e.k], 'status');
                return 0.05;
            }
            case 'spell': return this.spell(e);
            case 'rock': {
                this.stage.setRocks(this.B.rocks, (this.act || 0) + 1);
                const m = this.stage.rockMeshes?.get(hkey(e.at[0], e.at[1]));
                if (m) this.tw.add(0.4, (k) => { m.position.y = -0.6 * (1 - out(k)); });
                this.burst('puff', hexPos(...e.at), { n: 5, size: 0.6, rise: 0.4, y: 0.2 });
                A?.sfx('rock');
                return 0.4;
            }
            case 'knock': {
                const f = this.figOf(e.id);
                if (!f) return 0;
                const a = hexPos(...e.from), b = hexPos(...e.to);
                this.tw.add(0.25, (k) => f.grp.position.lerpVectors(a, b, out(k)));
                f.disp.c = e.to[0]; f.disp.r = e.to[1];
                return 0.25;
            }
            case 'summon': {
                const s = stackById(this.B, e.id);
                if (!s) return 0;
                const f = this.figOf(e.id) || this.addStack(s);
                f.grp.position.copy(hexPos(...e.at));
                this.tw.add(0.5, (k) => { f.grp.position.y = -0.6 * (1 - out(k)); });
                this.burst('puff', hexPos(...e.at), { n: 6, size: 0.6, rise: 0.5, y: 0.2 });
                A?.sfx('summon');
                return 0.55;
            }
            case 'cry': {
                const f = this.figOf(e.id);
                if (!f) return 0;
                this.burst(e.roar ? 'star' : 'note', f.grp.position, { n: 7, size: 0.4, rise: 1.2, spread: 0.9 });
                this.tw.add(0.4, (k) => f.grp.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.15));
                if (e.roar) this.stage.shake = 0.6;
                A?.sfx(e.roar ? 'roar' : 'cry');
                return 0.5;
            }
            case 'curse': {
                const f = this.figOf(e.id);
                if (f) this.burst('hex', f.grp.position, { n: 4, size: 0.6, rise: 1 });
                this.hooks.curse?.(e.card);
                A?.sfx('curse');
                return 0.45;
            }
            case 'stunned': { const f = this.figOf(e.id); if (f) this.float(f.grp.position.clone(), 'Zzz…', 'status'); return 0.35; }
            case 'act': { const f = this.figOf(e.id); if (f) this.pulseTag(f); return 0.08; }
            case 'flee': {
                const f = this.figOf(e.id);
                if (!f) return 0;
                f.dead = true;
                f.tag.classList.add('gone');
                const a = f.grp.position.clone(), b = a.clone().add(new THREE.Vector3(6, 0, 0));
                this.setFade(f, 1);
                this.tw.add(0.8, (k) => { f.grp.position.lerpVectors(a, b, k); this.setFade(f, 1 - k); }, () => { this.units.remove(f.grp); f.tag.remove(); this.figs.delete(e.id); });
                return 0.1;
            }
            case 'won': A?.sfx('victory'); this.hooks.banner?.('Victory!', 'big'); return 1.2;
            case 'lost': A?.sfx('defeat'); this.hooks.banner?.('The Legion Falls', 'foe big'); return 1.4;
            case 'd20': { const f = this.figOf(e.id); if (f) this.float(f.grp.position.clone().add(new THREE.Vector3(0, 1, 0)), `d20: ${e.roll}${e.roll === 20 ? '!' : ''}`, e.roll === 20 ? 'crit' : 'status'); return e.roll === 20 ? 0.4 : 0.05; }
            case 'card': this.hooks.card?.(e); return 0.12;
            case 'ink': return 0;
            case 'draw': case 'reshuffle': this.hooks.draw?.(e); return 0;
            case 'burn': { const f = this.figOf(e.id); if (f) this.burst('flame', f.grp.position, { n: 4, size: 0.4, rise: 0.8, spread: 0.3 }); A?.sfx('fire'); return 0.25; }
            default: return 0;
        }
    }

    impact(t, e) {
        if (!t || t.dead) return;
        const at = t.grp.position.clone();
        if (!e.quiet) {
            this.burst('splat', at, { n: 3, size: 0.45, spread: 0.5, rise: 0.4, y: 0.5, dur: 0.5 });
            this.audio?.sfx(e.nat20 ? 'crit' : 'hit');
        }
        if (e.nat20) { this.stage.shake = 0.8; this.burst('star', at, { n: 8, size: 0.5, rise: 0.8 }); }
        const base = t.grp.position.clone();
        this.flash(t, 0.6);
        this.tw.add(0.28, (k) => {
            const s = Math.sin(k * Math.PI * 6) * (1 - k) * 0.12;
            t.grp.position.set(base.x + s, base.y, base.z);
            this.flash(t, 0.6 * (1 - k));
        }, () => { t.grp.position.copy(base); this.flash(t, 0); });
    }

    spell(e) {
        const A = this.audio;
        const at = e.at ? hexPos(...e.at) : BOARD_CENTER.clone();
        const from = e.from ? hexPos(...e.from).setY(0.9) : at.clone().add(new THREE.Vector3(-5, 6, 2));
        switch (e.fx) {
            case 'fire':
                this.projectile('flame', from, at.clone().setY(0.5), 0.45, { arc: 0.5, size: 0.8 });
                this.tw.add(0.45, null, () => this.burst('flame', at, { n: 7, size: 0.5, rise: 0.8 }));
                A?.sfx('fire'); return 0.6;
            case 'frost':
                this.projectile('frost', from, at.clone().setY(0.5), 0.4, { arc: 0.3, size: 0.6, spin: 1 });
                this.tw.add(0.4, null, () => this.burst('frost', at, { n: 6, size: 0.4, rise: 0.3 }));
                A?.sfx('frost'); return 0.55;
            case 'bolt': {
                // a zig-zag of sparks along the line
                const a = e.from ? hexPos(...e.from).setY(0.7) : at.clone().add(new THREE.Vector3(0, 6, 0));
                for (let i = 0; i <= 6; i++) {
                    const s = this.sprite('spark', 0.35);
                    s.position.lerpVectors(a, at.clone().setY(0.5), i / 6).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4));
                    this.fx.add(s);
                    this.tw.add(0.35, (k) => { s.material.opacity = 1 - k; }, () => this.fx.remove(s));
                }
                A?.sfx('zap'); return 0.35;
            }
            case 'meteor':
                this.projectile('rock', at.clone().add(new THREE.Vector3(-2, 9, 0)), at.clone().setY(0.3), 0.55, { arc: 0, size: 1.4, spin: 2 });
                this.tw.add(0.55, null, () => { this.burst('flame', at, { n: 12, size: 0.7, spread: 1.8, rise: 0.8 }); this.burst('puff', at, { n: 6, size: 1, spread: 1.6, rise: 0.4 }); this.stage.shake = 1; A?.sfx('boom'); });
                A?.sfx('whoosh'); return 0.85;
            case 'sparks':
                for (const id of e.ids) { const p = this.posOf(id); this.projectile('spark', p.clone().add(new THREE.Vector3(0, 5, 0)), p.clone().setY(0.5), 0.35 + Math.random() * 0.15, { arc: 0, size: 0.45 }); }
                A?.sfx('zap'); return 0.5;
            case 'hex': case 'gaze':
                if (e.fx === 'gaze' && e.from) this.projectile('hex', from, at.clone().setY(0.6), 0.35, { arc: 0.1, size: 0.6 });
                for (const id of e.ids.length ? e.ids : []) this.burst('hex', this.posOf(id), { n: 3, size: 0.6, rise: 0.6, spread: 0.2 });
                if (!e.ids.length) this.burst('hex', at, { n: 3, size: 0.6, rise: 0.6 });
                A?.sfx('curse'); return 0.45;
            case 'roots':
                for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.projectile('splat', at.clone().setY(0.1), at.clone().add(new THREE.Vector3(Math.cos(a) * 2.6, 0.1, Math.sin(a) * 2.6)), 0.5, { arc: 0.2, size: 0.3 }); }
                A?.sfx('rock'); return 0.6;
            case 'moon':
                this.burst('heal', at, { n: 12, size: 0.35, spread: 2.5, rise: 1.2 });
                this.burst('star', at, { n: 6, size: 0.5, spread: 1.5, rise: 1.6 });
                A?.sfx('heal'); return 0.6;
            case 'sun':
                for (const id of e.ids) this.burst('flame', this.posOf(id), { n: 5, size: 0.55, rise: 1 });
                this.burst('star', at, { n: 10, size: 0.8, spread: 1, rise: 2 });
                this.stage.shake = 0.8;
                A?.sfx('boom'); return 0.8;
            case 'breath': {
                const a = from.clone(), dir = at.clone().sub(e.from ? hexPos(...e.from) : at).setY(0).normalize();
                for (let i = 0; i < 14; i++) {
                    const b = at.clone().addScaledVector(dir, Math.random() * 3.2).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.4, (Math.random() - 0.5) * 1.2));
                    this.tw.add(i * 0.025, null, () => this.projectile('flame', a, b, 0.35, { arc: 0.3, size: 0.6 }));
                }
                this.stage.shake = 0.5;
                A?.sfx('breath'); return 0.7;
            }
            default:
                this.burst('spark', at, { n: 5, size: 0.4 });
                return 0.3;
        }
    }

    pulseTag(f) { f.tag.classList.remove('pulse'); void f.tag.offsetWidth; f.tag.classList.add('pulse'); }

    // ------------------------------------------------------------------ the frame
    frame(dt, time) {
        this.time = time;
        this.pump(dt);
        this.tw.update(dt * this.speed);
        // idle life: a slow breath, the selection ring, the highlight pulse
        for (const f of this.figs.values()) {
            if (f.dead) continue;
            f.figs.forEach((m, i) => { m.position.y = Math.max(0, Math.sin(time * 1.6 + i * 1.7 + f.grp.id) * 0.01); });
        }
        if (this.ringMesh.visible) {
            const f = this.figs.get(this.selected);
            if (f) this.ringMesh.position.copy(f.grp.position).setY(0.045);
            this.ringMesh.rotation.y = time * 0.6;
        }
        const pulse = (Math.sin(time * 4) + 1) / 2;
        for (const h of this.hl) if (h.visible) h.material.uniforms.uPulse.value = pulse;
        if (this.visible) this.stage.render(time, dt);
        this.updateTags();
    }

    /** Tags follow their stacks on screen: count, ward, ailments and (for a foe) its intent. */
    updateTags() {
        const B = this.B;
        for (const [id, f] of this.figs) {
            const p = this.stage.toScreen(f.grp.position.clone().add(new THREE.Vector3(0, -0.05, 0.62)));
            const top = this.stage.toScreen(f.grp.position.clone().add(new THREE.Vector3(0, (f.scale || 0.45) * 2.6 + 0.2, 0)));
            f.tag.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px)`;
            f.tag.style.setProperty('--up', `${Math.min(140, Math.max(40, p.y - top.y)) | 0}px`);
            const s = B ? stackById(B, id) : null;
            const sig = s ? `${f.disp.count}|${f.disp.ward}|${JSON.stringify(s.st)}|${s.intent ? s.intent.k + s.intent.est + (s.intent.reach ? 1 : 0) : ''}|${this.selected === id}|${s.moved}${s.attacked}` : 'x';
            if (sig === f.sig) continue;
            f.sig = sig;
            f.tag.querySelector('.n').textContent = f.disp.count;
            const w = f.tag.querySelector('.w');
            w.textContent = f.disp.ward > 0 ? `◈${f.disp.ward}` : '';
            w.hidden = !(f.disp.ward > 0);
            f.tag.classList.toggle('sel', this.selected === id);
            f.tag.classList.toggle('spent', !!(s && s.side === 'p' && s.moved && s.attacked));
            const sts = f.tag.querySelector('.sts');
            sts.innerHTML = '';
            if (s) for (const [k, n] of Object.entries(s.st)) {
                if (!ST_GLYPH[k]) continue;
                const b = document.createElement('span');
                b.className = 'st st-' + k;
                b.textContent = ST_GLYPH[k];
                b.title = `${ST_NAME[k]} (${n})`;
                sts.appendChild(b);
            }
            const it = f.tag.querySelector('.intent');
            if (s && s.side === 'e' && s.intent && B.phase !== 'deploy') {
                it.hidden = false;
                it.className = 'intent i-' + s.intent.k + (s.intent.reach === false ? ' far' : '');
                const num = s.intent.est && s.intent.k !== 'hex' ? s.intent.est : '';
                it.innerHTML = `<span class="ig"></span>${num ? `<span class="iv">${num}</span>` : ''}`;
            } else it.hidden = true;
        }
    }

    /** A creature's portrait, drawn by the same ink pipeline. Cached; returns a data URL. */
    portrait(key, side = 'p') {
        this.portraits = this.portraits || new Map();
        const k = `${key}:${side}`;
        if (this.portraits.has(k)) return this.portraits.get(k);
        const url = this.stage.renderPortrait(figure(key, side), FIGURE[key]?.[0] || 0.45, key);
        this.portraits.set(k, url);
        return url;
    }
}

export { CREATURES, FOES, totalHp, inkMaterial };
