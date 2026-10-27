// The battle controller: turns taps, clicks and keys into sim commands, and tells the view which
// tiles to light up. It only ever calls act(); the sim decides what is legal.
//
// Select-then-confirm: the first tap on a tile sets the cursor and previews it, a second tap on the
// same tile does it. A mouse already hovers the tile, so there a single click confirms.

import { CHAPTERS, CLASSES, ITEMS, MAX_ITEMS, SKILLS, itemAmount } from './sim/data.js';
import { act } from './sim/game.js';
import {
    aoeTiles, basicOf, calcDamage, healAmount, isFoe, pathTo, rangeTiles, reach, skillsOf, standable, unitAt, validTarget, affected,
} from './sim/core.js';

const KEY = (B, x, y) => y * B.w + x;
// arrow keys move the cursor along the screen's own directions: a screen vector for each key
const ARROWS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };

export class Play {
    constructor({ view, ui, audio, getG, isAuto }) {
        Object.assign(this, { view, ui, audio, getG, isAuto });
        this.mode = 'free';               // free | skill | item
        this.item = null;                 // { slot, kind: 'use' | 'give' } while choosing who gets an item
        this.skillId = null;
        this.cursor = null;
        this.turnId = null;
        this.sig = '';
        this.info = '';
        this.ov = {};
        this.last = null;
    }

    get G() { return this.getG(); }

    /** True when a person may give the active unit commands right now. */
    canAct() {
        const G = this.G, B = G.B;
        if (G.phase !== 'battle' || !B || B.over || !B.turn) return false;
        const u = B.units.find((o) => o.id === B.turn.id);
        return u.team === 'p' && !this.isAuto() && !this.view.busy && G.events.length === 0 && !this.ui.anyScreen();
    }

    unit() { const B = this.G.B; return B.units.find((o) => o.id === B.turn.id); }

    reset() { this.mode = 'free'; this.skillId = null; this.item = null; this.cursor = null; this.sig = ''; }

    // ------------------------------------------------------------------ per-frame state → view and HUD
    update() {
        const G = this.G, B = G.B;
        this.view.ghost = false;
        if (!B || G.phase !== 'battle') { this.view.ov = {}; return; }
        if (!B.turn || B.over) { this.ui.prompt(''); this.ui.commands({ mode: 'free' }); this.view.ov = {}; return; }
        const u = this.unit();
        if (B.turn.id !== this.turnId) {
            this.turnId = B.turn.id;
            this.reset();
            if (u.team === 'p') this.cursor = { x: u.x, y: u.y };
        }
        // on a student's turn the others turn see-through, so a bunched-up cell can be clicked
        this.view.ghost = u.team === 'p' && !this.isAuto();
        const can = this.canAct();
        const T = B.turn;
        // the card shows whoever the cursor is on, or the active unit
        const cu = this.cursor ? unitAt(B, this.cursor.x, this.cursor.y) : null;
        const shown = cu || u;
        this.ui.card(shown, this.view.vis.get(shown.id));
        if (!can) {
            this.view.ov = {};
            this.ui.commands({ mode: 'free' });
            this.ui.prompt(u.team === 'p' ? (this.view.busy || G.events.length ? '' : '') : `${CLASSES[u.key].name} is thinking…`);
            if (u.team === 'p' && this.isAuto()) this.ui.prompt(`${CLASSES[u.key].name} (auto)`);
            return;
        }
        const sig = [this.turnId, T.moved, T.acted, this.mode, this.skillId, this.item?.slot, this.item?.kind, T.gave, u.items?.length, this.cursor?.x, this.cursor?.y, u.x, u.y, u.mp, B.units.filter((o) => o.alive).map((o) => `${o.x}${o.y}`).join('')].join();
        if (sig !== this.sig) { this.sig = sig; this._compute(u, T); }
        this.view.ov = this.ov;
        this.ui.prompt(this.info);
        const basic = SKILLS[basicOf(u)];
        const hasTarget = (sk) => rangeTiles(B, sk, u.x, u.y).some((t) => validTarget(B, u, sk, t.x, t.y));
        const free = this.mode === 'free';
        this.ui.commands({
            mode: this.mode,
            attack: !T.acted && hasTarget(basic),
            skills: !T.acted && skillsOf(u).length > 1,
            items: (u.items?.length || 0) > 0 && (!T.acted || !T.gave),
            wait: true,
            undo: T.moved && !T.acted,
            go: !free && this.skillOk,
        });
    }

    _compute(u, T) {
        const B = this.G.B;
        const ov = { cursor: this.cursor };
        const cur = this.cursor;
        const curKey = cur ? KEY(B, cur.x, cur.y) : -1;
        this.skillOk = false;
        if (this.mode === 'free') {
            const basic = SKILLS[basicOf(u)];
            if (!T.moved) {
                const r = reach(B, u);
                const spots = standable(B, u, r).filter((n) => !(n.x === u.x && n.y === u.y));
                ov.move = new Set(spots.map((n) => KEY(B, n.x, n.y)));
                if (cur && ov.move.has(curKey)) {
                    ov.path = new Set(pathTo(B, r, cur.x, cur.y).slice(1, -1).map(([x, y]) => KEY(B, x, y)));
                    this.info = `Walk here (${r.get(curKey).cost} steps). Tap again to go.`;
                }
            }
            if (!T.acted) {
                ov.atk = new Set(rangeTiles(B, basic, u.x, u.y).filter((t) => validTarget(B, u, basic, t.x, t.y)).map((t) => KEY(B, t.x, t.y)));
                if (cur && ov.atk.has(curKey)) {
                    const d = unitAt(B, cur.x, cur.y);
                    const clumsy = u.key === 'pip' ? ' (Pip might trip!)' : '';
                    this.info = `${basic.name} on ${CLASSES[d.key].name}: about ${calcDamage(B, u, d, basic)} damage${clumsy}. Tap again.`;
                }
            }
            if (!this.info || !((ov.move && ov.move.has(curKey)) || (ov.atk && ov.atk.has(curKey)))) {
                const d = cur ? unitAt(B, cur.x, cur.y) : null;
                if (d && d.id !== u.id && d.team === 'e') this.info = `${CLASSES[d.key].name}: ${isFoe(u, d) && !(ov.atk && ov.atk.has(curKey)) ? 'out of reach from here.' : ''}`;
                else if (T.moved && T.acted) this.info = '';
                else if (this.G.chapter === 0 && B.turnNo <= 6 && !T.moved && !T.acted) this.info = CHAPTERS[0].hint;
                else this.info = `${CLASSES[u.key].name}'s turn: ${T.moved ? '' : 'move, '}${T.acted ? '' : 'act, '}then Wait.`;
            }
        } else if (this.mode === 'item') {
            const it = u.items[this.item.slot];
            const who = this._itemTargets(u, this.item.kind);
            ov.tgt = new Set(who.map((o) => KEY(B, o.x, o.y)));
            const o = cur && who.find((w) => w.x === cur.x && w.y === cur.y);
            if (it && o) {
                ov.aoe = new Set([curKey]);
                this.skillOk = true;
                const me = ITEMS[it];
                const hp = Math.min(o.maxhp - o.hp, itemAmount(it, 'hp', o.lvl)), mp = Math.min(Math.max(0, o.maxmp - o.mp), itemAmount(it, 'mp', o.lvl));
                const fx = [hp > 0 ? `+${hp} hp` : '', mp > 0 ? `+${mp} MP` : ''].filter(Boolean).join(', ');
                this.info = this.item.kind === 'give' ? `Give ${me.name} to ${CLASSES[o.key].name}. Tap again or Go!` : `${me.name} on ${CLASSES[o.key].name} (${fx}). Tap again or Go!`;
            } else this.info = `${it ? ITEMS[it].name : 'Item'}: ${who.length ? 'choose a glowing friend.' : 'no one next to you can take it.'}`;
        } else {
            const sk = SKILLS[this.skillId];
            const ok = (t) => validTarget(B, u, sk, t.x, t.y);
            const tiles = sk.range[1] === 0 ? [{ x: u.x, y: u.y }] : rangeTiles(B, sk, u.x, u.y).filter(ok);
            ov.tgt = new Set(tiles.map((t) => KEY(B, t.x, t.y)));
            if (cur && ov.tgt.has(curKey)) {
                const hit = affected(B, u, sk, cur.x, cur.y);
                ov.aoe = new Set(aoeTiles(B, sk, cur.x, cur.y).map((t) => KEY(B, t.x, t.y)));
                this.skillOk = true;
                const names = hit.map((d) => CLASSES[d.key].name).join(', ');
                if (sk.kind === 'phys' || sk.kind === 'mag') {
                    const total = hit.reduce((a, d) => a + calcDamage(B, u, d, sk) * (sk.hits || 1), 0);
                    this.info = `${sk.name}: ${names} (about ${total} damage). Tap again or Go!`;
                } else if (sk.kind === 'heal') this.info = `${sk.name}: heals ${names}. Tap again or Go!`;
                else this.info = `${sk.name}: ${names}. Tap again or Go!`;
            } else this.info = `${sk.name}: ${tiles.length ? 'choose a glowing tile.' : 'no valid target from here.'}`;
        }
        this.ov = ov;
    }

    // ------------------------------------------------------------------ input
    setCursor(x, y) {
        this.cursor = { x, y };
        this.audio.ui('tick');
    }

    tap(x, y) {
        if (!this.canAct()) return;
        if (x === null) { this.cursor = null; return; }          // a tap on empty sky clears the preview
        if (this.cursor && this.cursor.x === x && this.cursor.y === y) this.confirm();
        else this.setCursor(x, y);
    }

    hover(x, y) {
        if (!this.canAct() || x === null) return;
        if (!this.cursor || this.cursor.x !== x || this.cursor.y !== y) this.cursor = { x, y };
    }

    confirm() {
        if (!this.canAct()) return;
        const G = this.G, B = G.B, u = this.unit(), T = B.turn;
        const cur = this.cursor;
        if (!cur) { this.cursor = { x: u.x, y: u.y }; return; }
        if (this.mode === 'item') {
            const kind = this.item.kind;
            if (this._do({ t: kind === 'give' ? 'give' : 'item', slot: this.item.slot, x: cur.x, y: cur.y })) { this.mode = 'free'; this.item = null; }
            else this.audio.ui('no');
            return;
        }
        if (this.mode === 'skill') {
            const sk = SKILLS[this.skillId];
            if (this._do({ t: 'skill', id: this.skillId, x: cur.x, y: cur.y })) { this.mode = 'free'; this.skillId = null; }
            else if (sk) this.audio.ui('no');
            return;
        }
        const k = KEY(B, cur.x, cur.y);
        if (!T.moved && this.ov.move?.has(k)) { this._do({ t: 'move', x: cur.x, y: cur.y }); return; }
        if (!T.acted && this.ov.atk?.has(k)) { this._do({ t: 'attack', x: cur.x, y: cur.y }); return; }
        this.audio.ui('no');
    }

    _do(cmd) {
        const r = act(this.G, cmd);
        if (!r.ok) { this.ui.toast(r.why.charAt(0).toUpperCase() + r.why.slice(1) + '.'); return false; }
        this.sig = '';
        return true;
    }

    command(name) {
        if (!this.canAct()) return;
        const G = this.G, B = G.B, u = this.unit();
        this.audio.ui('click');
        if (name === 'wait') { this._do({ t: 'wait' }); return; }
        if (name === 'undo') { this._do({ t: 'undo' }); this.cursor = { x: u.x, y: u.y }; return; }
        if (name === 'cancel') { this.mode = 'free'; this.skillId = null; this.item = null; return; }
        if (name === 'items') { this.openItems(); return; }
        if (name === 'go') { this.confirm(); return; }
        if (name === 'attack') { this.enterSkill(basicOf(u)); return; }
        if (name === 'skills') {
            const T = B.turn;
            const list = skillsOf(u).map((id) => {
                const sk = SKILLS[id];
                const has = sk.range[1] === 0 ? validTarget(B, u, sk, u.x, u.y) : rangeTiles(B, sk, u.x, u.y).some((t) => validTarget(B, u, sk, t.x, t.y));
                const why = T.acted ? 'already acted' : u.mp < sk.cost ? 'not enough MP' : !has ? 'no target in range from here' : '';
                return { id, ok: !why, why };
            });
            this.ui.openSkills(u, list, (id) => this.enterSkill(id));
        }
    }

    /** Friends an item could go to right now: for Use, yourself and anyone next to you it would help; for Give, anyone next to you with room. */
    _itemTargets(u, kind) {
        const B = this.G.B, it = u.items[this.item?.slot ?? 0];
        const near = B.units.filter((o) => o.alive && o.team === u.team && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) <= 1);
        if (kind === 'give') return near.filter((o) => o.id !== u.id && o.items.length < MAX_ITEMS);
        if (!it) return [];
        return near.filter((o) => Math.min(o.maxhp - o.hp, itemAmount(it, 'hp', o.lvl)) > 0 || Math.min(Math.max(0, o.maxmp - o.mp), itemAmount(it, 'mp', o.lvl)) > 0);
    }

    openItems() {
        const B = this.G.B, u = this.unit(), T = B.turn;
        const rows = u.items.map((id, slot) => {
            this.item = { slot, kind: 'use' };
            const use = this._itemTargets(u, 'use').length > 0, give = this._itemTargets(u, 'give').length > 0;
            const why = [];
            if (T.acted) why.push('already acted'); else if (!use) why.push('nobody who needs it is next to you');
            if (T.gave) why.push('already handed one over'); else if (!give && use === false) why.push('no free hands next to you');
            return { slot, name: ITEMS[id].name, desc: ITEMS[id].desc, canUse: !T.acted && use, canGive: !T.gave && give, why: why.join('; ') };
        });
        this.item = null;
        this.ui.openItems(u, rows, (slot, kind) => this.enterItem(slot, kind));
    }

    enterItem(slot, kind) {
        const u = this.unit();
        this.mode = 'item'; this.item = { slot, kind };
        const first = this._itemTargets(u, kind)[0];
        this.cursor = first ? { x: first.x, y: first.y } : { x: u.x, y: u.y };
        this.sig = '';
    }

    enterSkill(id) {
        const B = this.G.B, u = this.unit();
        const sk = SKILLS[id];
        this.mode = 'skill'; this.skillId = id;
        if (sk.range[1] === 0) this.cursor = { x: u.x, y: u.y };
        else {
            const first = rangeTiles(B, sk, u.x, u.y).find((t) => validTarget(B, u, sk, t.x, t.y));
            this.cursor = first ? { x: first.x, y: first.y } : { x: u.x, y: u.y };
        }
        this.sig = '';
    }

    /** Arrow keys: the neighbour tile whose screen position best matches the direction. */
    moveCursor(key) {
        const B = this.G.B;
        const [dx, dy] = ARROWS[key];
        const cur = this.cursor || { x: this.unit().x, y: this.unit().y };
        const px = (x, y) => [(x - y) * 32, (x + y) * 16];
        const [cx, cy] = px(cur.x, cur.y);
        let best = null, bs = 1e9;
        for (let y = 0; y < B.h; y++) {
            for (let x = 0; x < B.w; x++) {
                if (x === cur.x && y === cur.y) continue;
                const [sx, sy] = px(x, y);
                const vx = sx - cx, vy = sy - cy;
                const d = Math.hypot(vx, vy);
                const dot = (vx * dx + vy * dy) / d;
                if (dot < 0.5) continue;                      // within about 60° of the key's direction
                const score = d * (2 - dot);
                if (score < bs) { bs = score; best = { x, y }; }
            }
        }
        if (best) this.setCursor(best.x, best.y);
    }

    /** Cycle the cursor over units (Tab): friends then foes in order. */
    cycle(dir) {
        const B = this.G.B;
        const list = B.units.filter((o) => o.alive && o.team !== 'g').sort((a, b) => (a.team === b.team ? a.id - b.id : a.team === 'p' ? -1 : 1));
        const i = list.findIndex((o) => this.cursor && o.x === this.cursor.x && o.y === this.cursor.y);
        const n = list[(i + dir + list.length) % list.length];
        this.setCursor(n.x, n.y);
    }

    /** Returns true if the key was used. */
    press(key, shift) {
        if (!this.canAct()) return false;
        if (key in ARROWS) { this.moveCursor(key); return true; }
        if (key === 'Enter' || key === 'Space' || key === 'KeyZ') { this.confirm(); return true; }
        if (key === 'Escape' || key === 'KeyX') {
            if (this.mode !== 'free') { this.mode = 'free'; this.skillId = null; this.item = null; this.audio.ui('close'); return true; }
            return false;                                    // let main open the pause menu
        }
        if (key === 'Tab') { this.cycle(shift ? -1 : 1); return true; }
        if (key === 'Digit1') { this.command('attack'); return true; }
        if (key === 'Digit2') { this.command('skills'); return true; }
        if (key === 'Digit5' || key === 'KeyI') { this.command('items'); return true; }
        if (key === 'Digit3') { this.command('wait'); return true; }
        if (key === 'Digit4') { this.command('undo'); return true; }
        return false;
    }
}
