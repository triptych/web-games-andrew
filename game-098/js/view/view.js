// The view: reads the battle and plays the sim's events as animation. Never changes G.
//
// The sim resolves an action at once and pushes events; this view queues them and plays them one
// at a time (a dragon walking its path, the cut to the close-up arena, a skill, a claim, a song).
// While anything plays, `busy` is true: the controller ignores taps and the Chain waits its turn.
// When the queue is empty every mesh is snapped to the board, so a missed animation can never leave
// the picture wrong.

import * as THREE from 'three';
import { ELEMENTS, SPECIES, SKILLS } from '../sim/data.js';
import { STAGE_SCALE } from '../sim/dragons.js';
import { Stage, tileTop } from './stage.js';
import { Timeline, Bursts, Floats, ease, BREATH } from './fx.js';
import { makeUnitModel, setSpent, setFlash, disposeTree, makeEgg, TEAM_COLORS } from './models.js';
import { canvasTex } from './paint.js';

const ABORT = Symbol('abort');
const lerp = (a, b, k) => a + (b - a) * k;
const UNIT = 0.95;                 // a unit is drawn about a tile wide

const HL = {
    move:   { color: 0x4aa8ff, op: 0.75 },
    attack: { color: 0xff3a3a, op: 0.9 },
    skill:  { color: 0x5aff90, op: 0.85 },
    area:   { color: 0xffa040, op: 0.8 },
    target: { color: 0xffe070, op: 1 },
    danger: { color: 0xff2a2a, op: 0.38 },
    call:   { color: 0xa070ff, op: 0.9 },
    claim:  { color: 0xffe070, op: 0.7 },
};

const BADGES = new Map();
/** An Advance Wars HP badge: health in tenths, white on dark. */
function badgeTex(n) {
    if (BADGES.has(n)) return BADGES.get(n);
    const t = canvasTex(64, 64, (g) => {
        g.fillStyle = 'rgba(20,16,30,0.9)';
        g.beginPath(); g.roundRect(6, 6, 52, 52, 12); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
        g.fillStyle = '#fff'; g.font = 'bold 40px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), 32, 35);
    });
    BADGES.set(n, t);
    return t;
}
const ICONS = {};
function iconTex(kind) {
    if (ICONS[kind]) return ICONS[kind];
    ICONS[kind] = canvasTex(64, 64, (g) => {
        g.lineWidth = 6; g.lineCap = 'round';
        if (kind === 'stun') { g.strokeStyle = '#ffe04a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(20 + i * 12, 32, 9, 0, Math.PI * 1.5); g.stroke(); } }
        if (kind === 'ward') { g.fillStyle = 'rgba(90,180,255,0.9)'; g.beginPath(); g.moveTo(32, 6); g.lineTo(56, 16); g.lineTo(52, 42); g.lineTo(32, 58); g.lineTo(12, 42); g.lineTo(8, 16); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); }
        if (kind === 'rally') { g.fillStyle = '#ff7a3a'; g.beginPath(); g.moveTo(32, 4); g.lineTo(50, 34); g.lineTo(38, 34); g.lineTo(44, 60); g.lineTo(18, 28); g.lineTo(30, 28); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
        if (kind === 'chain') { g.strokeStyle = '#c8a0ff'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(16 + i * 16, 32, 10, 6, 0, 0, Math.PI * 2); g.stroke(); } }
    });
    return ICONS[kind];
}

export class View {
    constructor(canvas, { floats, audio, hooks = {} } = {}) {
        this.stage = new Stage(canvas);
        this.scene = this.stage.scene;
        this.audio = audio;
        this.hooks = hooks;
        this.tl = new Timeline();
        this.fx = new Bursts(this.scene);
        this.floats = new Floats(floats);
        this.units = new THREE.Group();
        this.scene.add(this.units);
        this.meshes = new Map();
        this.B = null;
        this.q = [];
        this.pumping = false;
        this.skipping = false;
        this.epoch = 0;
        this.speed = 1;
        this.boost = false;
        this.calm = false;
        this.quickFights = false;
        this.time = 0;
        this.selected = null;
        this.previewed = null;
        this.roostDragons = [];
        this.roostEggs = [];

        this.selRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        this.selRing.rotation.x = Math.PI / 2;
        this.selRing.visible = false;
        this.scene.add(this.selRing);
    }

    get busy() { return this.pumping || this.q.length > 0 || this.tl.busy; }
    setCalm(v) { this.calm = v; this.stage.calm = v; this.fx.calm = v; }

    // ------------------------------------------------------------------ the board and its units
    showBoard(B, theme) {
        this.reset();
        this.clearRoost();
        this.B = B;
        this.stage.setMode('board');
        this.stage.buildBoard(B, theme);
        for (const m of this.meshes.values()) { this.units.remove(m); disposeTree(m); }
        this.meshes.clear();
        for (const u of B.units) if (u.hp > 0) this._addUnit(u);
        this.units.visible = true;
        this.setSelected(null);
        this.syncUnits();
    }

    setPad(p) { this.stage.setPad(p); }

    _addUnit(u) {
        const g = new THREE.Group();
        const model = makeUnitModel(u);
        const size = (SPECIES[u.key] ? STAGE_SCALE[u.stage] || 1 : model.userData.kind === 'human' ? 1.3 : 1) * UNIT * (model.userData.big || 1);
        model.scale.multiplyScalar(size);
        g.add(model);
        // the team disc under every unit
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshBasicMaterial({ color: u.chained ? TEAM_COLORS.chained : TEAM_COLORS[u.team], transparent: true, opacity: 0.6, depthWrite: false }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.015;
        disc.scale.setScalar(model.userData.big ? 1.6 : 1);
        g.add(disc);
        const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex(9), depthTest: false, transparent: true }));
        badge.scale.setScalar(0.26);
        badge.position.set(0.3, 0.2, 0.3);
        badge.renderOrder = 10;
        g.add(badge);
        const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex('stun'), depthTest: false, transparent: true }));
        icon.scale.setScalar(0.24);
        icon.position.set(-0.28, 0.85 * (model.userData.big || 1), 0);
        icon.renderOrder = 10;
        icon.visible = false;
        g.add(icon);
        g.userData = { id: u.id, model, disc, badge, icon, team: u.team, phase: Math.random() * 10, chained: u.chained, key: u.key };
        this.units.add(g);
        this.meshes.set(u.id, g);
        return g;
    }

    _facing(team) { return team === 'p' ? Math.PI : 0; }

    /** Snap every mesh to the board: position, health, spent, team colour. */
    syncUnits() {
        const B = this.B;
        if (!B || this.stage.mode !== 'board') return;
        const live = new Set(B.units.filter((u) => u.hp > 0).map((u) => u.id));
        for (const [id, m] of [...this.meshes]) if (!live.has(id)) { this.units.remove(m); disposeTree(m); this.meshes.delete(id); }
        for (const u of B.units) {
            if (u.hp <= 0) continue;
            let m = this.meshes.get(u.id);
            if (m && (m.userData.team !== u.team || m.userData.chained !== u.chained)) { this.units.remove(m); disposeTree(m); this.meshes.delete(u.id); m = null; }
            if (!m) m = this._addUnit(u);
            const pv = this.previewed && this.previewed.id === u.id ? this.previewed : null;
            const p = this.stage.tilePos(pv ? pv.x : u.x, pv ? pv.y : u.y);
            m.position.set(p.x, Math.max(p.y, 0.02), p.z);
            if (!pv) m.userData.model.userData.rig.rotation.y = this._facing(u.team);
            this._badge(m, u);
            setSpent(m.userData.model, !!u.acted && u.team === B.phase && !pv);
            const ic = m.userData.icon;
            ic.visible = u.stun > 0 || u.ward > 0 || u.rally > 0;
            if (ic.visible) ic.material.map = iconTex(u.stun > 0 ? 'stun' : u.ward > 0 ? 'ward' : 'rally');
        }
        for (let i = 0; i < B.tiles.length; i++) this.stage.setOwner(i, B.own[i]);
        this._placeSel();
    }

    _badge(m, u) {
        const n = Math.max(1, Math.ceil((u.hp / u.hpMax) * 10));
        const b = m.userData.badge;
        b.visible = u.hp < u.hpMax && u.hp > 0;
        if (b.visible) b.material.map = badgeTex(Math.min(9, n));
    }
    _badgeHp(id, hp, hpMax) {
        const m = this.meshes.get(id);
        if (m) this._badge(m, { hp, hpMax });
    }

    // ------------------------------------------------------------------ selection helpers (for the controller)
    setHighlights(list) { this.stage.setHighlights(list.map((it) => ({ x: it.x, y: it.y, ...(HL[it.kind] || HL.move) }))); }
    setPath(path) { this.stage.setPath(path); }
    setCursor(pos) { this.stage.setCursor(pos); }
    setSelected(id) { this.selected = id; this._placeSel(); }
    _placeSel() {
        const m = this.selected != null ? this.meshes.get(this.selected) : null;
        this.selRing.visible = !!m && this.stage.mode === 'board';
        if (m) this.selRing.position.set(m.position.x, m.position.y + 0.04, m.position.z);
    }
    /** Show a unit where it would move, before the action is chosen. The sim is untouched. */
    preview(id, x, y) {
        this.previewed = id == null ? null : { id, x, y };
        const u = this.B?.units.find((v) => v.id === id);
        const m = this.meshes.get(id);
        if (u && m && (x !== u.x || y !== u.y)) {
            const a = this.stage.tilePos(u.x, u.y), b = this.stage.tilePos(x, y);
            m.userData.model.userData.rig.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        }
        this.syncUnits();
    }
    pick(cx, cy) { return this.B ? this.stage.pick(cx, cy) : null; }
    screenOf(x, y, h = 0.6) { const p = this.stage.tilePos(x, y); p.y += h; return this.stage.project(p); }

    // ------------------------------------------------------------------ the event queue
    onEvents(G, events) {
        if (!this.B || G.battle !== this.B) return;
        for (const e of events) this.q.push(e);
        if (!this.pumping && this.q.length) this._pump();
    }

    async _pump() {
        this.pumping = true;
        const ep = this.epoch;
        try {
            while (this.q.length && ep === this.epoch) {
                const ev = this.q.shift();
                await this._play(ev);
            }
        } catch (err) {
            if (err !== ABORT) console.error('[view]', err);
        } finally {
            this.pumping = false;
            if (ep === this.epoch) {
                this.skipping = false;
                if (this.stage.mode === 'arena') this._closeArena();
                this.syncUnits();
            } else if (this.q.length) this._pump();
        }
    }

    reset() {
        this.epoch++;
        this.q.length = 0;
        this.tl.finishAll();
        this.fx.clear();
        this.floats.clear();
        this.previewed = null;
        if (this.stage.mode === 'arena') this._closeArena();
        this.hooks.talkCancel?.();
    }

    /** Finish at once: for tests, Skip, and the bot's fast-forward. */
    skipAll() {
        this.skipping = true;
        this.tl.finishAll();
        if (!this.pumping) { this.skipping = false; this.q.length = 0; this.syncUnits(); }
    }

    async tw(dur, fn, e = ease.out) {
        const ep = this.epoch;
        if (this.skipping) { fn?.(1); await Promise.resolve(); } else await this.tl.tween(dur, fn, e);
        if (ep !== this.epoch) throw ABORT;
    }
    sleep(s) { return this.tw(s, null); }

    _float(text, x, y, cls, h = 0.9) {
        if (this.skipping) return;
        const p = this.screenOf(x, y, h);
        this.floats.add(text, p.x, p.y, cls);
    }
    _floatAt(id, text, cls, h = 0.9) {
        const m = this.meshes.get(id);
        if (!m || this.skipping) return;
        const p = this.stage.project(new THREE.Vector3(m.position.x, m.position.y + h, m.position.z));
        this.floats.add(text, p.x, p.y, cls);
    }

    async _play(ev) {
        switch (ev.type) {
            case 'phase': return this._phase(ev);
            case 'move': return this._move(ev);
            case 'attack': return this._attack(ev);
            case 'skill': return this._skill(ev);
            case 'capture': return this._capture(ev);
            case 'unchain': return this._unchain(ev);
            case 'death': return this._death(ev);
            case 'call': case 'build': return this._spawn(ev);
            case 'power': return this._power(ev);
            case 'levelup':
                this.audio?.levelup();
                this._floatAt(ev.id, ev.stage ? `GREW: ${ev.stage.toUpperCase()}!` : `LEVEL ${ev.lv}!`, 'lvl', 1.2);
                if (ev.stage) this._regrow(ev.id);
                return this.sleep(this.skipping ? 0 : 0.6);
            case 'heal':
                for (const h of ev.list) { this._floatAt(h.id, '+' + h.amt, 'heal'); this._badgeHp(h.id, h.hp, h.hpMax); const m = this.meshes.get(h.id); if (m && !this.skipping) this.fx.burst(m.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0x8dffb0, { n: 14, speed: 0.8, life: 0.8, gravity: 1 }); }
                if (ev.list.length) this.audio?.heal();
                return this.sleep(this.skipping ? 0 : 0.5);
            case 'income': return;
            case 'treasure':
                this.audio?.chime();
                this._float('🥚 An egg!', ev.at[0], ev.at[1], 'lvl', 1.1);
                if (!this.skipping) this.fx.burst(this.stage.tilePos(ev.at[0], ev.at[1]).add(new THREE.Vector3(0, 0.4, 0)), 0xfff0a0, { n: 40, speed: 1.6, life: 1 });
                return this.sleep(this.skipping ? 0 : 0.6);
            case 'talk':
                if (this.skipping || !this.hooks.talk) return;
                await this.hooks.talk(ev.lines);
                return;
            case 'win': case 'lose':
                await this.sleep(this.skipping ? 0 : 0.4);
                this.hooks.result?.(ev);
                return;
        }
    }

    async _phase(ev) {
        this.syncUnits();
        if (this.skipping) return;
        this.audio?.phase(ev.team);
        this.hooks.banner?.(ev.team === 'p' ? `Turn ${ev.turn} · Your Move` : 'The Chain Moves', ev.team);
        await this.sleep(ev.team === 'p' ? 1.0 : 0.8);
    }

    // ------------------------------------------------------------------ moving
    async _move(ev) {
        const m = this.meshes.get(ev.id);
        if (!m) return;
        this.previewed = null;
        const path = ev.path;
        const model = m.userData.model;
        const fly = SPECIES[m.userData.key]?.mt === 'fly' || m.userData.key === 'sera' || m.userData.key === 'nyxara';
        if (this.skipping) { const e = this.stage.tilePos(...path[path.length - 1]); m.position.set(e.x, Math.max(e.y, 0.02), e.z); return; }
        this.stage.focus(...path[path.length - 1]);
        this.audio?.step(fly);
        for (let i = 1; i < path.length; i++) {
            const a = this.stage.tilePos(...path[i - 1]), b = this.stage.tilePos(...path[i]);
            model.userData.rig.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
            m.userData.walk = 1;
            await this.tw(0.13, (k) => {
                m.position.set(lerp(a.x, b.x, k), Math.max(lerp(a.y, b.y, k), 0.02) + (fly ? Math.sin(((i - 1 + k) / (path.length - 1)) * Math.PI) * 0.5 : 0), lerp(a.z, b.z, k));
            }, ease.lin);
        }
        m.userData.walk = 0;
        const e = this.stage.tilePos(...path[path.length - 1]);
        m.position.set(e.x, Math.max(e.y, 0.02), e.z);
    }

    // ------------------------------------------------------------------ the close-up battle
    async _attack(ev) {
        const a = this.meshes.get(ev.aid), d = this.meshes.get(ev.did);
        if (a && d) {
            // turn to face each other on the board
            a.userData.model.userData.rig.rotation.y = Math.atan2(d.position.x - a.position.x, d.position.z - a.position.z);
            d.userData.model.userData.rig.rotation.y = Math.atan2(a.position.x - d.position.x, a.position.z - d.position.z);
        }
        if (!this.skipping && !this.quickFights) await this._arena(ev);
        else if (!this.skipping) await this._quickFight(ev);
        const last = ev.strikes[ev.strikes.length - 1];
        if (last) { this._badgeHp(ev.aid, last.hpA, ev.a.hpMax); this._badgeHp(ev.did, last.hpD, ev.d.hpMax); }
    }

    async _quickFight(ev) {
        for (const s of ev.strikes) {
            const tid = s.by === 'a' ? ev.did : ev.aid;
            this.audio?.hit(s.crit, s.by === 'a' ? ev.a.el : ev.d.el);
            const m = this.meshes.get(tid);
            if (m) { setFlash(m.userData.model, 1); this.fx.burst(m.position.clone().add(new THREE.Vector3(0, 0.4, 0)), ELEMENTS[s.by === 'a' ? ev.a.el : ev.d.el].color, { n: 20, speed: 1.6, life: 0.5 }); }
            this._floatAt(tid, s.crit ? `${s.dmg}!` : String(s.dmg), s.crit ? 'crit' : 'dmg');
            await this.sleep(0.3);
            if (m) setFlash(m.userData.model, 0);
        }
    }

    _bigModel(snap) {
        const m = makeUnitModel(snap);
        const sc = (SPECIES[snap.key] ? STAGE_SCALE[snap.stage] || 1 : 1) * 2.3 * (m.userData.big ? 1.25 : 1);
        m.scale.multiplyScalar(sc);
        return m;
    }

    async _arena(ev) {
        const st = this.stage;
        const theme = st.themeName;
        const [L, R] = st.buildArena(theme, ev.tA, ev.tD);
        const A = this._bigModel(ev.a), D = this._bigModel(ev.d);
        A.position.copy(L); D.position.copy(R);
        A.userData.rig.rotation.y = Math.PI / 2;
        D.userData.rig.rotation.y = -Math.PI / 2;
        A.userData.base = A.position.x; D.userData.base = D.position.x;
        this.scene.add(A, D);
        this.arenaPieces = [A, D];
        this.units.visible = false;
        this.selRing.visible = false;
        st.setMode('arena');
        this.hooks.battleOpen?.(ev);
        this.audio?.roar(ev.a);
        // slide in from the sides
        await this.tw(0.45, (k) => { A.position.x = A.userData.base - (1 - k) * 4; D.position.x = D.userData.base + (1 - k) * 4; }, ease.back);
        await this.sleep(0.25);
        const tick = (P, k) => { P.userData.pose = k; };
        for (const s of ev.strikes) {
            const atk = s.by === 'a' ? A : D, def = s.by === 'a' ? D : A;
            const snapA = s.by === 'a' ? ev.a : ev.d;
            const dir = s.by === 'a' ? 1 : -1;
            const side = s.by === 'a' ? 'd' : 'a';
            const kind = snapA.kind;
            const ranged = snapA.cls === 'siege' || snapA.cls === 'mage' || (kind === 'dragon' && (SPECIES[snapA.key]?.rng?.[1] || 1) >= 1);
            // wind up
            await this.tw(0.18, (k) => { atk.position.x = atk.userData.base - dir * 0.25 * k; tick(atk, { roar: k, lunge: -k * 0.3, flap: k }); });
            if (kind === 'dragon') {
                await this._breath(atk, def, snapA.el, dir);
            } else if (snapA.cls === 'siege') {
                await this._bolt(atk, def, dir);
            } else if (snapA.cls === 'mage') {
                await this._orb(atk, def, ELEMENTS[snapA.el].color);
            } else {
                await this.tw(0.16, (k) => { atk.position.x = atk.userData.base + dir * 2.2 * k; tick(atk, { lunge: k, walk: 1 }); }, ease.in);
            }
            void ranged;
            const head = new THREE.Vector3(def.position.x, 2.3, 0.3);
            if (s.dmg > 0) {
                this.audio?.hit(s.crit, snapA.el);
                st.shake = s.crit ? 1.6 : 0.8;
                setFlash(def, 1);
                this.fx.burst(new THREE.Vector3(def.position.x - dir * 0.5, 1.1, 0.4), s.crit ? 0xffe27a : ELEMENTS[snapA.el].color, { n: s.crit ? 60 : 30, speed: s.crit ? 4 : 2.6, life: 0.7 });
                const sp = st.project(head);
                this.floats.add(s.crit ? `${s.dmg}!` : String(s.dmg), sp.x, sp.y, s.crit ? 'crit' : 'dmg');
                if (s.crit) this.floats.add('CRITICAL!', sp.x, sp.y - 40, 'critword');
                this._flash(s.crit ? '#fff1b0' : '#ffffff', s.crit ? 0.55 : 0.2);
                this.hooks.battleHp?.(side, side === 'a' ? s.hpA : s.hpD, s);
            }
            if (s.thorn) {
                const sp = st.project(new THREE.Vector3(atk.position.x, 2.1, 0.3));
                this.floats.add('🌵' + s.thorn, sp.x, sp.y, 'dmg');
                this.hooks.battleHp?.(s.by, s.by === 'a' ? s.hpA : s.hpD, s);
            }
            await Promise.all([
                this.tw(0.3, (k) => { atk.position.x = lerp(atk.position.x, atk.userData.base, k); tick(atk, { roar: 1 - k }); }, ease.inOut),
                this.tw(0.3, (k) => { def.position.x = def.userData.base + dir * 0.5 * Math.sin(k * Math.PI); def.rotation.z = -dir * 0.12 * Math.sin(k * Math.PI); }),
            ]);
            setFlash(def, 0);
            def.rotation.z = 0;
            atk.userData.pose = {};
            await this.sleep(0.18);
        }
        if (ev.kill) {
            const loser = ev.kill === 'd' ? D : A, dir = ev.kill === 'd' ? 1 : -1;
            this.audio?.faint();
            this.fx.burst(new THREE.Vector3(loser.position.x, 1.2, 0), 0xffffff, { n: 50, speed: 3, life: 1 });
            await this.tw(0.7, (k) => { loser.rotation.z = -dir * 1.3 * k; loser.position.y = -0.6 * k; });
        }
        await this.sleep(0.45);
        this._closeArena();
        await this.sleep(0.1);
    }

    /** A stream of breath from one fighter's mouth to the other. */
    async _breath(atk, def, el, dir) {
        const [core, edge] = BREATH[el] || BREATH.ember;
        const head = new THREE.Vector3();
        (atk.userData.head || atk).getWorldPosition(head);
        const tgt = new THREE.Vector3(def.position.x, 1.0, def.position.z + 0.2);
        const d = tgt.clone().sub(head);
        const len = d.length();
        d.normalize();
        this.audio?.breath(el);
        if (el === 'storm') this._flash('#fffbe0', 0.18);      // one flash, never a strobe
        await this.tw(0.45, (k) => {
            atk.userData.pose = { roar: 1, lunge: 0.4, flap: 0.6 };
            if (Math.random() < 0.9) {
                this.fx.burst(head.clone().add(d.clone().multiplyScalar(0.3)), Math.random() < 0.5 ? core : edge, { n: 6, speed: len * 1.4, life: 0.5, gravity: el === 'tide' ? -3 : el === 'ember' ? 1.5 : 0, dir: d, spread: el === 'storm' ? 0.2 : 0.5, size: 0.4 });
            }
        }, ease.lin);
        void dir;
    }

    async _bolt(atk, def, dir) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0x5a5a68 }));
        bolt.rotation.z = Math.PI / 2;
        this.scene.add(bolt);
        this.audio?.twang();
        const a = atk.position.clone().add(new THREE.Vector3(dir * 0.6, 1.2, 0)), b = def.position.clone().add(new THREE.Vector3(-dir * 0.3, 1.1, 0));
        await this.tw(0.28, (k) => { bolt.position.lerpVectors(a, b, k); bolt.position.y += Math.sin(k * Math.PI) * 0.6; }, ease.lin);
        this.scene.remove(bolt); bolt.geometry.dispose(); bolt.material.dispose();
    }

    async _orb(atk, def, color) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), new THREE.MeshBasicMaterial({ color }));
        this.scene.add(orb);
        this.audio?.cast('umbra');
        const a = atk.position.clone().add(new THREE.Vector3(0, 1.6, 0)), b = def.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        await this.tw(0.4, (k) => { orb.position.lerpVectors(a, b, k); orb.position.y += Math.sin(k * Math.PI) * 0.8; if (Math.random() < 0.6) this.fx.burst(orb.position, color, { n: 3, speed: 0.4, life: 0.4, gravity: 0 }); }, ease.inOut);
        this.scene.remove(orb); orb.geometry.dispose(); orb.material.dispose();
    }

    _closeArena() {
        this.hooks.battleClose?.();
        for (const P of this.arenaPieces || []) { this.scene.remove(P); disposeTree(P); }
        this.arenaPieces = [];
        this.stage.setMode(this.B ? 'board' : 'roost');
        this.units.visible = true;
        this.floats.clear();
        this._placeSel();
    }

    _flash(color, op = 0.45) {
        const el = document.getElementById('flash');
        if (!el || this.calm || this.skipping) return;
        el.style.background = color;
        el.style.opacity = String(op);
        this.tl.tween(0.35, (k) => { el.style.opacity = String(op * (1 - k)); }, ease.out);
    }

    // ------------------------------------------------------------------ skills
    async _skill(ev) {
        const c = this.meshes.get(ev.id);
        const S = SKILLS[ev.skill];
        const el = ELEMENTS[ev.el] || ELEMENTS.aether;
        const from = this.stage.tilePos(ev.from[0], ev.from[1]);
        const to = this.stage.tilePos(ev.at[0], ev.at[1]);
        if (!this.skipping) {
            this.hooks.banner?.(`${S.icon} ${ev.name}`, 'skill');
            this.audio?.cast(ev.el);
            if (c) c.userData.model.userData.rig.rotation.y = from.distanceTo(to) > 0.1 ? Math.atan2(to.x - from.x, to.z - from.z) : c.userData.model.userData.rig.rotation.y;
            this.fx.burst(from.clone().add(new THREE.Vector3(0, 0.5, 0)), el.color, { n: 30, speed: 1.4, life: 0.7 });
            if (c) c.userData.roar = 1;
            await this.sleep(0.3);
            const hi = (p, y = 0.6) => new THREE.Vector3(p.x, p.y + y, p.z);
            const shot = async (color, arc = 0.3, dur = 0.36) => {
                const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color }));
                this.scene.add(ball);
                await this.tw(dur, (k) => {
                    ball.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k) + 0.6 + Math.sin(k * Math.PI) * arc, lerp(from.z, to.z, k));
                    if (!this.calm && Math.random() < 0.6) this.fx.burst(ball.position, color, { n: 2, speed: 0.3, life: 0.35, gravity: 0 });
                }, ease.inOut);
                this.scene.remove(ball); ball.geometry.dispose(); ball.material.dispose();
            };
            switch (S.kind) {
                case 'bolt': case 'drain': case 'stun': case 'chain': await shot(el.color, S.kind === 'chain' ? 0.1 : 0.5); break;
                case 'blast': await shot(el.color, 1.6, 0.5); this.audio?.boom(); this.stage.shake = 1.2; this.fx.burst(hi(to, 0.3), el.color, { n: 80, speed: 3.2, life: 0.9 }); this._flash(el.css, 0.25); break;
                case 'push': this.fx.burst(hi(to), 0xc8f4ff, { n: 30, speed: 2.2, life: 0.5 }); this.audio?.splash(); break;
                case 'heal': case 'nova': this.audio?.heal(); this.fx.burst(hi(to, 0.2), 0x8dffb0, { n: 40, speed: 1.2, life: 1, gravity: 1 }); break;
                case 'ward': case 'rally': case 'refresh': this.fx.burst(hi(to, 0.3), el.color, { n: 30, speed: 1, life: 0.9, gravity: 0.6 }); this.audio?.chime(); break;
            }
        }
        const moves = [];
        for (const f of ev.fx) {
            const m = this.meshes.get(f.id);
            if (!m) continue;
            if (f.dmg) {
                if (!this.skipping) { setFlash(m.userData.model, 1); this.fx.burst(m.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff6a5a, { n: 18, speed: 1.8, life: 0.5 }); }
                this._floatAt(f.id, f.crit ? `${f.dmg}!` : String(f.dmg), f.crit ? 'crit' : 'dmg');
            }
            if (f.heal) this._floatAt(f.id, '+' + f.heal, 'heal');
            if (f.stun) this._floatAt(f.id, 'STUNNED', 'mod', 1.2);
            if (f.ward) this._floatAt(f.id, 'WARDED', 'mod', 1.2);
            if (f.rally) this._floatAt(f.id, 'RALLIED', 'mod', 1.2);
            if (f.refresh) this._floatAt(f.id, 'AGAIN!', 'mod', 1.2);
            if (f.hp != null) this._badgeHp(f.id, f.hp, f.hpMax);
            if (f.moved) {
                const end = this.stage.tilePos(f.moved[0], f.moved[1]);
                const start = m.position.clone();
                moves.push(this.tw(0.3, (k) => { m.position.set(lerp(start.x, end.x, k), Math.max(lerp(start.y, end.y, k), 0.02), lerp(start.z, end.z, k)); }));
            }
        }
        await Promise.all(moves);
        if (!this.skipping) { await this.sleep(0.3); for (const f of ev.fx) { const m = this.meshes.get(f.id); if (m) setFlash(m.userData.model, 0); } }
        if (c) c.userData.roar = 0;
    }

    // ------------------------------------------------------------------ claims, freedom, arrivals
    async _capture(ev) {
        if (ev.done) this.stage.setOwner(ev.at[1] * this.B.w + ev.at[0], ev.team);
        if (this.skipping) return;
        this.audio?.claim(ev.done);
        const prop = { village: 'Village', roost: 'Roost', hq: 'Stronghold' }[ev.prop] || 'Land';
        this._float(ev.done ? `${prop} claimed!` : `Claiming… ${ev.left}`, ev.at[0], ev.at[1], ev.done ? 'lvl' : 'mod', 1.1);
        if (ev.done) this.fx.burst(this.stage.tilePos(ev.at[0], ev.at[1]).add(new THREE.Vector3(0, 0.5, 0)), ev.team === 'p' ? 0x6ab0ff : 0xff6a5a, { n: 40, speed: 1.6, life: 0.9 });
        await this.sleep(0.6);
    }

    async _unchain(ev) {
        const t = this.meshes.get(ev.tid);
        if (this.skipping) return;
        if (t) {
            this.audio?.song(ev.ok);
            const p = t.position.clone().add(new THREE.Vector3(0, 0.5, 0));
            for (let i = 0; i < 3; i++) { this.fx.burst(p, ev.ok ? 0xfff0a0 : 0x9a5aff, { n: 24, speed: 1.2 + i * 0.5, life: 0.8 }); await this.sleep(0.2); }
            if (ev.ok) { this.fx.burst(p, 0x9aa4b4, { n: 40, speed: 3, life: 0.7, size: 0.1 }); this._flash('#fff8d0', 0.4); }
            this._floatAt(ev.tid, ev.ok ? `${ev.name} is free!` : `The chain holds… (${Math.round(ev.chance * 100)}%)`, ev.ok ? 'lvl' : 'mod', 1.2);
        }
        await this.sleep(0.7);
        if (ev.ok) this.syncUnits();
        this.hooks.unchained?.(ev);
    }

    async _death(ev) {
        const m = this.meshes.get(ev.id);
        if (!m) return;
        if (this.skipping) { this.units.remove(m); disposeTree(m); this.meshes.delete(ev.id); return; }
        this.audio?.faint();
        this.fx.burst(m.position.clone().add(new THREE.Vector3(0, 0.4, 0)), ev.faint ? 0xc8e8ff : 0xffffff, { n: 30, speed: 2, life: 0.8 });
        if (ev.faint) this._floatAt(ev.id, `${ev.name} retreats!`, 'mod', 1);
        await this.tw(0.5, (k) => { m.scale.setScalar(1 - k * 0.9); m.position.y += ev.faint ? 0.04 : -0.01; m.rotation.y += 0.2; });
        this.units.remove(m); disposeTree(m);
        this.meshes.delete(ev.id);
    }

    async _spawn(ev) {
        const u = this.B.units.find((v) => v.id === ev.id);
        if (!u) return;
        const m = this.meshes.get(u.id) || this._addUnit(u);
        const p = this.stage.tilePos(ev.at[0], ev.at[1]);
        m.position.set(p.x, Math.max(p.y, 0.02), p.z);
        if (this.skipping) return;
        this.audio?.chime();
        this.fx.burst(p.clone().add(new THREE.Vector3(0, 0.5, 0)), ev.type === 'call' ? 0xc8a0ff : 0xff8a6a, { n: 50, speed: 1.4, life: 1, gravity: 1.5 });
        if (ev.type === 'call') this._float(`${u.name} answers!`, ev.at[0], ev.at[1], 'lvl', 1.1);
        await this.tw(0.4, (k) => { m.scale.setScalar(ease.back(k)); });
        m.scale.setScalar(1);
    }

    async _power(ev) {
        for (const f of ev.fx || []) { if (f.heal) this._floatAt(f.id, '+' + f.heal, 'heal'); if (f.dmg) this._floatAt(f.id, '-' + f.dmg, 'dmg'); this._badgeHp(f.id, f.hp, this.B.units.find((u) => u.id === f.id)?.hpMax || 1); }
        if (this.skipping) return;
        this.audio?.power(ev.team);
        this.hooks.power?.(ev);
        this._flash(ev.team === 'p' ? '#ffe9a0' : '#ff6a8a', 0.6);
        this.stage.shake = 1;
        for (const m of this.meshes.values()) if (m.userData.team === ev.team) this.fx.burst(m.position.clone().add(new THREE.Vector3(0, 0.4, 0)), ev.team === 'p' ? 0xffe070 : 0xff4a6a, { n: 16, speed: 1.2, life: 0.9, gravity: 1 });
        await this.sleep(1.6);
    }

    _regrow(id) {
        const u = this.B?.units.find((v) => v.id === id);
        const m = this.meshes.get(id);
        if (!u || !m) return;
        this.units.remove(m); disposeTree(m); this.meshes.delete(id);
        this._addUnit(u);
        this.syncUnits();
    }

    // ------------------------------------------------------------------ the roost diorama
    showRoost(G) {
        this.reset();
        this.B = null;
        for (const m of this.meshes.values()) { this.units.remove(m); disposeTree(m); }
        this.meshes.clear();
        this.setSelected(null);
        this.stage.buildRoost();
        this.stage.setTheme('roost');
        this.stage.setMode('roost');
        this.refreshRoost(G);
    }

    clearRoost() {
        for (const d of this.roostDragons) { this.stage.roost.remove(d.m); disposeTree(d.m); }
        for (const e of this.roostEggs) if (e) { this.stage.roost.remove(e); disposeTree(e); }
        this.roostDragons = []; this.roostEggs = [];
        this.roostSig = '';
    }

    /** Put the flock and the eggs in the diorama; cheap to call often, rebuilds only on change. */
    refreshRoost(G) {
        if (this.stage.mode !== 'roost') return;
        const M = G.meta;
        const show = M.dragons.slice().sort((a, b) => (M.party.includes(b.rid) - M.party.includes(a.rid)) || b.lv - a.lv).slice(0, 8);
        const sig = show.map((d) => `${d.rid}:${d.lv}:${d.sp}`).join() + '|' + M.incub.join() + '|' + M.training.join();
        if (sig !== this.roostSig) {
            this.clearRoost();
            this.roostSig = sig;
            show.forEach((d, i) => {
                const m = makeUnitModel({ key: d.sp, team: 'p', hue: d.hue, gilded: d.gilded });
                const st = { hatchling: 0.62, juvenile: 0.8, adult: 1, elder: 1.12 }[d.lv >= 25 ? 'elder' : d.lv >= 12 ? 'adult' : d.lv >= 6 ? 'juvenile' : 'hatchling'];
                m.scale.multiplyScalar(1.5 * st);
                const training = M.training.includes(d.rid);
                const a = (i / show.length) * Math.PI * 2;
                const home = training ? this.stage.ringSpot.clone().add(new THREE.Vector3(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7)) : new THREE.Vector3(Math.cos(a) * 3.2 + 0.4, 0, Math.sin(a) * 2.2 - 0.4);
                m.position.copy(home);
                this.stage.roost.add(m);
                this.roostDragons.push({ m, home, goal: home.clone(), t: Math.random() * 4, training });
            });
            M.incub.forEach((eid, i) => {
                const e = M.eggs.find((x) => x.eid === eid);
                if (!e) { this.roostEggs[i] = null; return; }
                const egg = makeEgg(e.sp, { gilded: e.gilded, hue: e.hue });
                egg.scale.setScalar(0.55);
                egg.position.copy(this.stage.hearths[i].position).add(new THREE.Vector3(0, 0.05, 0));
                egg.userData.eid = eid;
                this.stage.roost.add(egg);
                this.roostEggs[i] = egg;
            });
        }
        this.stage.hearths.forEach((h, i) => {
            const has = i < M.incub.length;
            h.visible = has;
            const e = M.eggs.find((x) => x.eid === M.incub[i]);
            h.userData.light.intensity = e ? 1.2 : 0;
            h.userData.coal.material.color.set(e ? 0xff7a2a : 0x5a4a40);
            const egg = this.roostEggs[i];
            if (egg && e) egg.userData.ready = e.prog >= e.need;
        });
    }

    _roostFrame(dt, time) {
        for (const d of this.roostDragons) {
            const m = d.m;
            d.t -= dt;
            if (d.t <= 0) {
                d.t = 2 + Math.random() * 4;
                d.goal = d.home.clone().add(new THREE.Vector3((Math.random() - 0.5) * (d.training ? 0.8 : 2.4), 0, (Math.random() - 0.5) * (d.training ? 0.8 : 1.6)));
            }
            const to = d.goal.clone().sub(m.position);
            const dist = to.length();
            let walk = 0;
            if (dist > 0.05) {
                to.normalize();
                m.position.addScaledVector(to, Math.min(dist, dt * (d.training ? 1.2 : 0.6)));
                const want = Math.atan2(to.x, to.z);
                const r = m.userData.rig;
                let dy = want - r.rotation.y;
                while (dy > Math.PI) dy -= Math.PI * 2;
                while (dy < -Math.PI) dy += Math.PI * 2;
                r.rotation.y += dy * Math.min(1, dt * 5);
                walk = 1;
            }
            m.userData.anim?.(time + d.home.x, { walk, flap: d.training ? 0.3 : 0 });
        }
        for (const e of this.roostEggs) {
            if (!e) continue;
            const wob = e.userData.ready ? Math.sin(time * 14) * 0.18 * (Math.sin(time * 2) > 0.3 ? 1 : 0) : Math.sin(time * 1.5) * 0.03;
            e.userData.egg.rotation.z = this.calm ? 0 : wob;
            e.userData.mat.emissiveIntensity = e.userData.ready ? 0.35 + Math.sin(time * 4) * 0.2 : 0.06;
        }
        for (const h of this.stage.hearths || []) if (h.userData.light.intensity > 0) h.userData.light.intensity = 1 + Math.sin(time * 9 + h.position.x) * 0.2;
    }

    // ------------------------------------------------------------------ portraits of the flock
    /** A rendered picture of a dragon for the DOM panels, cached by look. */
    thumb({ sp, hue = 0, gilded = false, lv = 12 }, size = 128) {
        this.thumbs = this.thumbs || new Map();
        const stage = lv >= 25 ? 'elder' : lv >= 12 ? 'adult' : lv >= 6 ? 'juvenile' : 'hatchling';
        const key = `${sp}|${hue}|${gilded}|${stage}|${size}`;
        if (this.thumbs.has(key)) return this.thumbs.get(key);
        const R = this.stage.renderer;
        if (!this.thumbScene) {
            this.thumbScene = new THREE.Scene();
            this.thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.6));
            const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(2, 4, 4);
            this.thumbScene.add(sun);
            this.thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
        }
        const m = makeUnitModel({ key: sp, team: 'p', hue, gilded });
        m.userData.anim?.(1.2, {});
        m.userData.rig.rotation.y = 0.75;
        const sc = STAGE_SCALE[stage];
        m.scale.setScalar(sc);
        this.thumbScene.add(m);
        const cam = this.thumbCam;
        cam.position.set(0, 0.95 * sc + 0.3, 2.4 * Math.max(sc, 0.8));
        cam.lookAt(0, 0.45 * sc, 0);
        const rt = new THREE.WebGLRenderTarget(size, size);
        rt.texture.colorSpace = THREE.SRGBColorSpace;
        const prev = R.getRenderTarget();
        const clear = R.getClearColor(new THREE.Color()), alpha = R.getClearAlpha();
        R.setRenderTarget(rt);
        R.setClearColor(0x000000, 0);
        R.clear();
        R.render(this.thumbScene, cam);
        const px = new Uint8Array(size * size * 4);
        R.readRenderTargetPixels(rt, 0, 0, size, size, px);
        R.setRenderTarget(prev);
        R.setClearColor(clear, alpha);
        rt.dispose();
        this.thumbScene.remove(m);
        disposeTree(m);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        const img = g.createImageData(size, size);
        for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
        g.putImageData(img, 0, 0);
        const url = c.toDataURL();
        this.thumbs.set(key, url);
        return url;
    }

    // ------------------------------------------------------------------ per frame
    frame(G, dt, time) {
        this.time = time;
        this.stage.resize();
        const sdt = dt * this.speed * (this.boost ? 3 : 1);
        if (this.boost && !this.busy) this.boost = false;
        this.tl.update(sdt);
        this.fx.update(sdt);
        this.stage.update(dt, time);
        if (this.stage.mode === 'roost') this._roostFrame(dt, time);
        if (this.stage.mode === 'board' && !this.pumping && !this.q.length && !this.tl.busy) this.syncUnits();
        if (this.stage.mode === 'board') {
            for (const m of this.meshes.values()) {
                const md = m.userData.model;
                md.userData.anim?.(this.calm ? 0 : time + m.userData.phase, { walk: m.userData.walk || 0, roar: m.userData.roar || 0 });
            }
            if (this.selRing.visible) this.selRing.scale.setScalar(this.calm ? 1 : 1 + Math.sin(time * 5) * 0.06);
        } else if (this.stage.mode === 'arena') {
            for (const P of this.arenaPieces || []) P.userData.anim?.(time, P.userData.pose || {});
        }
        this.stage.render();
    }
}

void tileTop;
