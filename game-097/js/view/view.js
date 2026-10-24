// The view: reads the board and plays the sim's events as animation. Never changes G.
//
// The sim resolves an action instantly and pushes events; this view queues them and plays them one
// at a time (a piece gliding, the cut to the duel arena, a spell). While anything plays, `busy` is
// true: the controller ignores taps and the enemy waits its turn. When the queue is empty every
// mesh is snapped to the board, so a missed animation can never leave the picture wrong.

import * as THREE from 'three';
import { ELEMENTS, UNITS } from '../sim/data.js';
import { Stage } from './stage.js';
import { Timeline, Bursts, Floats, ease } from './fx.js';
import { makePiece, setHp, setSpent, disposeTree } from './models.js';

const ABORT = Symbol('abort');
const lerp = (a, b, k) => a + (b - a) * k;
const ARC = new Set(['leap', 'hop', 'ride', 'cannon']);
const PIECE = 1.2;                 // pieces are drawn a little over a square wide so they read from the camera

const HL = {
    move:    { color: 0x4aa8ff, op: 0.8 },
    cap:     { color: 0xff3a4a, op: 0.95 },
    ability: { color: 0x5aff90, op: 0.85 },
    target:  { color: 0xffd45a, op: 1 },
    danger:  { color: 0xff2a2a, op: 0.42 },
    area:    { color: 0xff8a2a, op: 0.8 },
};

/** A square with a bright border and a soft fill, tinted per highlight kind. */
function highlightTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.38)'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
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
        this.boost = false;         // a tap while something plays hurries it along until the queue is empty
        this.calm = false;
        this.time = 0;
        this.selected = null;
        this.cursor = null;

        // highlight pool, one flat plane per square
        this.hl = [];
        this.hlTex = highlightTexture();
        this.hlGroup = new THREE.Group();
        this.scene.add(this.hlGroup);
        this.selRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: 0x9ae8ff }));
        this.selRing.rotation.x = Math.PI / 2; this.selRing.visible = false;
        this.curBox = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9, depthWrite: false }));
        this.curBox.rotation.x = -Math.PI / 2; this.curBox.visible = false;
        this.curBox.scale.setScalar(1.42);
        this.scene.add(this.selRing, this.curBox);
    }

    get busy() { return this.pumping || this.q.length > 0 || this.tl.busy; }
    setCalm(v) { this.calm = v; this.stage.calm = v; this.fx.calm = v; }

    // ------------------------------------------------------------------ the board and its pieces
    /** Show a board and its pieces. B is a live battle or a preview of a chapter. */
    showBoard(B, theme, { orbit = false } = {}) {
        this.reset();
        this.B = B;
        this.stage.orbit = orbit;
        this.stage.buildBoard(B, theme);
        for (const m of this.meshes.values()) { this.units.remove(m); disposeTree(m); }
        this.meshes.clear();
        for (const u of B.units) this._addUnit(u);
        this.setHighlights([]);
        this.setSelected(null);
        this.setCursor(null);
        for (const h of this.hl) h.visible = false;
        this.syncUnits();
    }

    setOrbit(on) { if (this.stage.orbit !== on) { this.stage.orbit = on; this.stage.fit(); } }
    setPad(p) { this.stage.setPad(p); }

    _addUnit(u) {
        const m = makePiece(u.key, u.team);
        const p = this.stage.tilePos(u.x, u.y);
        m.position.copy(p);
        m.scale.setScalar(PIECE);
        m.userData.id = u.id;
        this.units.add(m);
        this.meshes.set(u.id, m);
        return m;
    }

    /** Snap every mesh to the board: position, health, spent. */
    syncUnits() {
        const B = this.B;
        if (!B) return;
        const live = new Set(B.units.map((u) => u.id));
        for (const [id, m] of [...this.meshes]) if (!live.has(id)) { this.units.remove(m); disposeTree(m); this.meshes.delete(id); }
        for (const u of B.units) {
            const m = this.meshes.get(u.id) || this._addUnit(u);
            const p = this.stage.tilePos(u.x, u.y);
            m.position.copy(p);
            m.scale.setScalar(PIECE);
            m.userData.rig.rotation.y = u.team === 'e' ? Math.PI : 0;
            m.userData.hp.visible = true;
            setHp(m, u.hp / u.hpMax);
            setSpent(m, !!u.acted && u.team === B.phase);
        }
        this._placeSel();
    }

    // ------------------------------------------------------------------ highlights
    setHighlights(list) {
        const B = this.B;
        for (const h of this.hl) h.visible = false;
        if (!B) return;
        list.forEach((it, i) => {
            let h = this.hl[i];
            if (!h) {
                h = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ map: this.hlTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
                h.rotation.x = -Math.PI / 2;
                this.hlGroup.add(h);
                this.hl[i] = h;
            }
            const s = HL[it.kind] || HL.move;
            const p = this.stage.tilePos(it.x, it.y);
            h.position.set(p.x, 0.03, p.z);
            h.material.color.setHex(s.color);
            h.userData.op = s.op;
            h.visible = true;
        });
    }

    setSelected(id) { this.selected = id; this._placeSel(); }
    _placeSel() {
        const m = this.selected != null ? this.meshes.get(this.selected) : null;
        this.selRing.visible = !!m;
        if (m) this.selRing.position.set(m.position.x, 0.12, m.position.z);
    }
    setCursor(pos) {
        this.cursor = pos;
        this.curBox.visible = !!pos && !!this.B;
        if (pos && this.B) { const p = this.stage.tilePos(pos.x, pos.y); this.curBox.position.set(p.x, 0.05, p.z); }
    }

    pick(cx, cy) { return this.B ? this.stage.pick(cx, cy) : null; }
    /** Screen position of a square or unit, for anchoring DOM. */
    screenOf(x, y, h = 1) { const p = this.stage.tilePos(x, y); p.y = h; return this.stage.project(p); }

    // ------------------------------------------------------------------ the event queue
    onEvents(G, events) {
        for (const e of events) if (!['summon'].includes(e.type)) this.q.push(e);
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
            if (ep === this.epoch) { this.skipping = false; this.syncUnits(); }
            else if (this.q.length) this._pump();
        }
    }

    /** Drop everything that is playing or waiting. */
    reset() {
        this.epoch++;
        this.q.length = 0;
        this.tl.finishAll();
        this.fx.clear();
        this.floats.clear();
        if (this.stage.arenaOn) this._closeArena();
    }

    /** Finish at once: for tests, for Skip, and for the bot's fast-forward. */
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

    async _play(ev) {
        switch (ev.type) {
            case 'phase': return this._phase(ev);
            case 'move': return this._move(ev);
            case 'battle': return this._battle(ev);
            case 'ability': return this._ability(ev);
            case 'death': return this._death(ev);
            case 'levelup': this.audio?.levelup(); this.hooks.levelup?.(ev); return this.sleep(1.1);
            case 'win': case 'lose':
                await this.sleep(0.4);
                if (ev.type === 'win') this.audio?.win(); else this.audio?.lose();
                this.hooks.result?.(ev);
                return;
        }
    }

    async _phase(ev) {
        this.syncUnits();
        this.audio?.toll(ev.phase === 'e');
        this.hooks.banner?.(ev.phase === 'e' ? 'Enemy Phase' : ev.start ? 'Your Phase' : `Turn ${ev.turn}`, ev.phase, ev);
        await this.sleep(ev.start ? 1.1 : 0.9);
    }

    // ------------------------------------------------------------------ moving
    async _glide(m, from, to, how = 'slide') {
        const a = this.stage.tilePos(from[0], from[1]), b = this.stage.tilePos(to[0], to[1]);
        const dist = Math.max(Math.abs(from[0] - to[0]), Math.abs(from[1] - to[1]));
        if (!dist) return;
        const arc = ARC.has(how);
        const dx = b.x - a.x, dz = b.z - a.z;
        m.userData.rig.rotation.y = Math.atan2(-dx, -dz);
        if (arc) this.audio?.swish(); else this.audio?.step();
        const dur = arc ? 0.5 : Math.min(0.75, 0.14 + 0.1 * dist);
        await this.tw(dur, (k) => {
            m.position.set(lerp(a.x, b.x, k), arc ? Math.sin(k * Math.PI) * (0.55 + 0.15 * dist) : 0, lerp(a.z, b.z, k));
        }, ease.inOut);
        m.position.set(b.x, 0, b.z);
        if (!arc) this.audio?.step();
    }

    _face(m, team) { m.userData.rig.rotation.y = team === 'e' ? Math.PI : 0; }

    async _move(ev) {
        const m = this.meshes.get(ev.id);
        if (!m) return;
        await this._glide(m, ev.from, ev.to, ev.how);
        this._face(m, m.userData.team);
        setSpent(m, true);
    }

    async _death(ev) {
        const m = this.meshes.get(ev.id);
        if (!m) return;
        await this._die(m, ev.key);
    }

    async _die(m, key) {
        const el = ELEMENTS[UNITS[key].el];
        const id = m.userData.id;
        this.audio?.death();
        m.userData.hp.visible = false;
        this.fx.burst(new THREE.Vector3(m.position.x, 0.6, m.position.z), el.color, { n: 36, speed: 2.4, life: 0.9 });
        await this.tw(0.55, (k) => { m.scale.setScalar(PIECE * (1 - k * 0.95)); m.position.y = -k * 0.5; m.rotation.y = k * 3; });
        this.units.remove(m); disposeTree(m);
        if (this.meshes.get(id) === m) this.meshes.delete(id);
    }

    // ------------------------------------------------------------------ the duel
    async _battle(ev) {
        const a = this.meshes.get(ev.a.id), d = this.meshes.get(ev.d.id);
        if (!a || !d) return;
        // the attacker closes in to the square it fights from
        if (ev.stop[0] !== ev.from[0] || ev.stop[1] !== ev.from[1]) await this._glide(a, ev.from, ev.stop, 'slide');
        const dp = this.stage.tilePos(ev.to[0], ev.to[1]), ap = this.stage.tilePos(ev.stop[0], ev.stop[1]);
        a.userData.rig.rotation.y = Math.atan2(-(dp.x - ap.x), -(dp.z - ap.z));
        d.userData.rig.rotation.y = Math.atan2(-(ap.x - dp.x), -(ap.z - dp.z));
        await this.sleep(0.15);

        await this._arena(ev);

        const last = ev.strikes[ev.strikes.length - 1];
        const aSnap = ev.a, dSnap = ev.d;
        if (last) {
            setHp(a, last.hpA / aSnap.hpMax);
            setHp(d, last.hpD / dSnap.hpMax);
        }
        if (ev.kill === 'd') {
            await this._die(d, dSnap.key);
            if (ev.end && (ev.end[0] !== ev.stop[0] || ev.end[1] !== ev.stop[1])) await this._glide(a, ev.stop, ev.end, 'slide');
        } else if (ev.kill === 'a') await this._die(a, aSnap.key);
        for (const m of [a, d]) if (this.meshes.has(m.userData.id)) this._face(m, m.userData.team);
        if (this.meshes.has(a.userData.id)) setSpent(a, true);
    }

    async _arena(ev) {
        if (this.skipping) return;
        const st = this.stage;
        st.arenaTheme(ELEMENTS[ev.a.el].color);
        const A = makePiece(ev.a.key, ev.a.team, { bar: false }), D = makePiece(ev.d.key, ev.d.team, { bar: false });
        for (const [P, side, rot] of [[A, 'a', -Math.PI / 2], [D, 'd', Math.PI / 2]]) {
            P.scale.setScalar(2.1);
            P.position.copy(st.arenaPos(side));
            P.userData.rig.rotation.y = rot;
            P.userData.base = P.position.x;
            this.scene.add(P);
        }
        this.arenaPieces = [A, D];
        st.setArena(true);
        this.hooks.battleOpen?.(ev);
        this._flash(ELEMENTS[ev.a.el].css);
        this.audio?.toll(true);
        await this.sleep(0.7);

        for (const s of ev.strikes) {
            const atk = s.by === 'a' ? A : D, def = s.by === 'a' ? D : A;
            const dir = s.by === 'a' ? 1 : -1;
            const side = s.by === 'a' ? 'd' : 'a';
            this.audio?.swish();
            await this.tw(0.2, (k) => { atk.position.x = atk.userData.base + dir * 1.9 * k; }, ease.out);
            const head = new THREE.Vector3(def.position.x, 2.6, 0);
            if (s.hit) {
                this.audio?.hit(s.crit);
                st.shake = s.crit ? 1.4 : 0.7;
                this.fx.burst(new THREE.Vector3(def.position.x - dir * 0.4, 1.3, 0.3), s.crit ? 0xffe27a : ELEMENTS[s.by === 'a' ? ev.a.el : ev.d.el].color, { n: s.crit ? 46 : 24, speed: s.crit ? 4 : 2.6, life: 0.7 });
                const sp = st.project(head);
                this.floats.add(s.crit ? `${s.dmg}!` : String(s.dmg), sp.x, sp.y, s.crit ? 'crit' : 'dmg');
                this._flash(s.crit ? '#fff1b0' : '#ff4a5a', s.crit ? 0.5 : 0.25);
                this.hooks.battleHp?.(side, side === 'a' ? s.hpA : s.hpD);
                await Promise.all([
                    this.tw(0.26, (k) => { atk.position.x = atk.userData.base + dir * 1.9 * (1 - k); }, ease.inOut),
                    this.tw(0.26, (k) => { def.position.x = def.userData.base + dir * 0.55 * Math.sin(k * Math.PI); def.rotation.z = -dir * 0.18 * Math.sin(k * Math.PI); }),
                ]);
                def.rotation.z = 0;
            } else {
                this.audio?.miss();
                const sp = st.project(head);
                this.floats.add('MISS', sp.x, sp.y, 'miss');
                await Promise.all([
                    this.tw(0.26, (k) => { atk.position.x = atk.userData.base + dir * 1.9 * (1 - k); }, ease.inOut),
                    this.tw(0.26, (k) => { def.position.z = Math.sin(k * Math.PI) * 0.9; def.position.y = Math.sin(k * Math.PI) * 0.4; }),
                ]);
                def.position.z = 0; def.position.y = 0;
            }
            await this.sleep(0.16);
        }

        if (ev.kill) {
            const loser = ev.kill === 'd' ? D : A, dir = ev.kill === 'd' ? 1 : -1;
            this.audio?.death();
            this.fx.burst(new THREE.Vector3(loser.position.x, 1.2, 0), 0xffffff, { n: 40, speed: 3, life: 1 });
            await this.tw(0.7, (k) => { loser.rotation.z = -dir * 1.4 * k; loser.position.y = -0.5 * k; });
        }
        await this.sleep(0.45);
        this._closeArena();
        await this.sleep(0.15);
    }

    _closeArena() {
        this.hooks.battleClose?.();
        for (const P of this.arenaPieces || []) { this.scene.remove(P); disposeTree(P); }
        this.arenaPieces = [];
        this.stage.setArena(false);
        this.floats.clear();
    }

    _flash(css, op = 0.45) {
        const el = document.getElementById('flash');
        if (!el || this.calm) return;
        el.style.background = css;
        el.style.opacity = String(op);
        this.tl.tween(0.35, (k) => { el.style.opacity = String(op * (1 - k)); }, ease.out);
    }

    // ------------------------------------------------------------------ abilities
    async _ability(ev) {
        const c = this.meshes.get(ev.id);
        const el = ELEMENTS[ev.el];
        const from = this.stage.tilePos(ev.from[0], ev.from[1]);
        const to = this.stage.tilePos(ev.to[0], ev.to[1]);
        if (!c) return;
        const hi = (p, y = 0.7) => new THREE.Vector3(p.x, y, p.z);
        this.hooks.banner?.(ev.name, 'ability', ev);
        this.audio?.cast(ev.el);
        this.fx.burst(hi(from), el.color, { n: 30, speed: 1.6, life: 0.7 });
        await this.sleep(0.35);

        const shot = async (color, arc = 0, dur = 0.38) => {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color }));
            this.scene.add(ball);
            await this.tw(dur, (k) => {
                ball.position.set(lerp(from.x, to.x, k), 0.9 + Math.sin(k * Math.PI) * arc, lerp(from.z, to.z, k));
                if (!this.calm && Math.random() < 0.5) this.fx.burst(ball.position, color, { n: 2, speed: 0.4, life: 0.35, gravity: 0 });
            }, ease.inOut);
            this.scene.remove(ball); ball.geometry.dispose(); ball.material.dispose();
        };
        switch (ev.ab) {
            case 'smite': await shot(el.color); break;
            case 'drain': await shot(0xd23a5a); break;
            case 'hook': await shot(0xcfcfdf, 0.2, 0.3); break;
            case 'flame': await shot(el.color, 1.6, 0.55); this.audio?.boom(); this.stage.shake = 1; this.fx.burst(hi(to, 0.5), 0xff7a2a, { n: 70, speed: 3.5, life: 0.9 }); break;
            case 'heal': this.audio?.heal(); break;
            case 'blink': await this.tw(0.25, (k) => { c.scale.set(PIECE * (1 - k * 0.9), PIECE * (1 + k * 1.5), PIECE * (1 - k * 0.9)); }); break;
            case 'shove': c.userData.rig.rotation.y = Math.atan2(-(to.x - from.x), -(to.z - from.z)); this.fx.burst(hi(to), 0xffffff, { n: 18, speed: 2, life: 0.4 }); this.audio?.hit(false); break;
            default: this.fx.burst(hi(to), el.color, { n: 24, speed: 1.4, life: 0.8 });
        }

        const moves = [];
        for (const f of ev.fx) {
            const m = this.meshes.get(f.id);
            if (!m) continue;
            const pos = this.stage.project(new THREE.Vector3(m.position.x, 1.7, m.position.z));
            if (f.dmg) {
                if (ev.ab !== 'shove') this.audio?.hit(false);
                this.fx.burst(hi(m.position, 0.8), 0xff5a5a, { n: 20, speed: 2, life: 0.6 });
                this.floats.add(f.fell ? 'FALLS' : String(f.dmg), pos.x, pos.y, 'dmg');
            }
            if (f.heal) { this.floats.add('+' + f.heal, pos.x, pos.y, 'heal'); this.fx.burst(hi(m.position, 0.4), 0x8dffb0, { n: 24, speed: 1, life: 0.9, gravity: 1 }); }
            if (f.mod) { this.floats.add(f.mod, pos.x, pos.y, 'mod'); this.fx.burst(hi(m.position, 0.9), el.color, { n: 18, speed: 1.2, life: 0.8 }); }
            if (f.hp != null) setHp(m, f.hp / this._hpMaxOf(f.id));
            if (f.moved) {
                const cur = this.stage.tilePos(f.moved[0], f.moved[1]);
                const start = m.position.clone();
                moves.push(this.tw(f.fell ? 0.5 : 0.35, (k) => {
                    m.position.set(lerp(start.x, cur.x, k), f.fell ? -k * 1.2 : 0, lerp(start.z, cur.z, k));
                    if (ev.ab === 'blink') m.scale.set(PIECE * (0.1 + 0.9 * k), PIECE * (2.5 - 1.5 * k), PIECE * (0.1 + 0.9 * k));
                }, ease.inOut));
            }
        }
        await Promise.all(moves);
        if (ev.ab === 'blink') c.scale.setScalar(PIECE);
        c.userData.rig.rotation.y = c.userData.team === 'e' ? Math.PI : 0;
        setSpent(c, true);
        await this.sleep(0.35);
    }

    _hpMaxOf(id) { return this.B?.units.find((u) => u.id === id)?.hpMax || 1; }

    // ------------------------------------------------------------------ per frame
    frame(G, dt, time) {
        this.time = time;
        this.stage.resize();
        const sdt = dt * this.speed * (this.boost ? 3 : 1);
        if (this.boost && !this.busy) this.boost = false;
        this.tl.update(sdt);
        this.fx.update(sdt);
        this.stage.update(dt, time);
        if (!this.pumping && !this.q.length && !this.tl.busy) this.syncUnits();
        // idle life: gems turn and bob, ring and highlights pulse
        for (const m of this.meshes.values()) {
            const { gem, top } = m.userData;
            const id = m.userData.id;
            if (!this.calm) { gem.position.y = top + 0.22 + Math.sin(time * 2 + id) * 0.05; gem.rotation.y = time * 1.4 + id; }
            m.userData.hp.quaternion.copy(this.stage.camera.quaternion);
        }
        const pulse = this.calm ? 0.9 : 0.78 + Math.sin(time * 4) * 0.22;
        for (const h of this.hl) if (h.visible) h.material.opacity = h.userData.op * pulse;
        if (this.selRing.visible) this.selRing.scale.setScalar(this.calm ? 1 : 1 + Math.sin(time * 5) * 0.05);
        this.stage.render(time);
    }
}
