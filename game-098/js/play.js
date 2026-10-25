// The battle controller: turns taps, clicks and keys into commands for the sim, and keeps the map
// highlights, the path arrow, the cards and the action menu in step with what is selected.
//
//   idle    nothing selected. Tap a ready unit to select it, any unit to inspect it, an empty roost
//           you hold to call a dragon.
//   move    a unit is selected: blue tiles to move to, red for enemies it can reach. Tap a blue
//           tile (or the unit itself) to stand there; tap a red enemy to attack it from the best
//           tile in reach.
//   menu    the unit stands at its new tile (only on screen: the sim hasn't moved it) and the
//           action menu is up: Attack, Skill, Claim, Unchain, Wait.
//   target  choosing what to attack, cast at, or unchain. A forecast comes before any fight.
// Back steps out one level at a time; nothing is sent to the sim until an action is chosen.

import { SKILLS, TERRAIN, SPECIES } from './sim/data.js';
import { unitAt, idx, dist, destinations, pathTo, ring, canStand } from './sim/map.js';
import { reachOf, forecast, skillTargets, canCapture, unchainTargets, unchainChance, reserve, callCost, blow } from './sim/battle.js';

const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export class Play {
    constructor({ view, ui, roostUi, audio, getG, act }) {
        Object.assign(this, { view, ui, roostUi, audio, getG, act });
        this.reset();
    }

    get B() { return this.getG().battle; }

    reset() {
        this.sel = null;
        this.mode = 'idle';
        this.dest = null;        // [x, y] the selected unit will act from
        this.R = null;
        this.insp = null;
        this.targetKind = null;
        this.cur = null;
        this.showCursor = false;
        this._sig = '';
        this.ui.hidePopups();
        this.view.preview(null);
    }

    unit(id) { return this.B?.units.find((u) => u.id === id && u.hp > 0) || null; }
    /** Events the sim has queued but the view has not been handed yet count as "still playing". */
    get busy() { return this.view.busy || this.getG().events.length > 0 || !!this.ui.talking; }
    canAct() { const B = this.B; return !!B && !B.over && B.phase === 'p' && !this.busy; }

    // ------------------------------------------------------------------ taps
    onTile(x, y) {
        const B = this.B;
        if (!B || x == null) return;
        this.cur = { x, y };
        const u = unitAt(B, x, y);
        if (!this.canAct()) { this.insp = u?.id ?? null; this.refresh(); return; }
        const sel = this.sel != null ? this.unit(this.sel) : null;

        if (this.mode === 'target' && sel) {
            const tg = this.targets();
            if (tg.some((t) => t[0] === x && t[1] === y)) return this.chooseTarget(x, y);
            return this.back();
        }
        if (this.mode === 'menu') return this.back();
        if (this.mode === 'move' && sel) {
            const R = this.R;
            const r = R.get(idx(B, x, y));
            if (r && (!r.occ || (x === sel.x && y === sel.y))) return this.moveTo(x, y);
            // tapping an enemy it can reach: pick the best tile to strike from
            if (u && u.team !== sel.team) {
                const from = this.bestFrom(sel, u);
                if (from) { this.moveTo(from[0], from[1], true); return this.chooseAttack(u); }
            }
            if (u && u.team === 'p' && !u.acted && u !== sel) return this.select(u);
            return this.deselect();
        }
        // idle
        if (u && u.team === 'p' && !u.acted && u.stun <= 0) return this.select(u);
        if (!u) {
            const i = idx(B, x, y);
            if (TERRAIN[B.tiles[i]].deploy && B.own[i] === 'p') return this.openCall(x, y);
        }
        this.insp = u ? u.id : null;
        this.audio.ui('click');
        this.refresh();
    }

    select(u) {
        this.sel = u.id; this.mode = 'move'; this.insp = null; this.dest = null;
        this.R = reachOf(this.B, u);
        this.ui.hidePopups();
        this.view.preview(null);
        this.audio.ui('select');
        this.cur = { x: u.x, y: u.y };
        this.view.stage.focus(u.x, u.y);
        this.refresh();
    }

    deselect() {
        this.sel = null; this.mode = 'idle'; this.dest = null; this.insp = null; this.R = null;
        this.ui.hidePopups();
        this.view.preview(null);
        this.refresh();
    }

    /** Stand the selected unit on (x, y) on screen and open the action menu. */
    moveTo(x, y, silent = false) {
        const sel = this.unit(this.sel);
        if (!sel) return;
        this.dest = [x, y];
        this.view.preview(sel.id, x, y);
        this.mode = 'menu';
        if (!silent) { this.audio.ui('click'); this.openMenu(); }
        this.refresh();
    }

    /** Where to stand to hit u: the reachable tile in range with the most cover, then the nearest. */
    bestFrom(sel, u) {
        const B = this.B;
        if (sel.indirect) { const d = dist(sel.x, sel.y, u.x, u.y); return d >= sel.rng[0] && d <= sel.rng[1] ? [sel.x, sel.y] : null; }
        let best = null;
        for (const [x, y, i] of destinations(B, sel, this.R)) {
            const d = dist(x, y, u.x, u.y);
            if (d < sel.rng[0] || d > sel.rng[1]) continue;
            const score = (TERRAIN[B.tiles[i]].def * 10) - this.R.get(i).cost + (x === sel.x && y === sel.y ? 5 : 0);
            if (!best || score > best.score) best = { at: [x, y], score };
        }
        return best?.at || null;
    }

    /** What the unit could do from where it now stands. */
    options() {
        const B = this.B, u = this.unit(this.sel);
        if (!u || !this.dest) return [];
        const [x, y] = this.dest;
        const moved = x !== u.x || y !== u.y;
        const opts = [];
        const foes = this._attackable(u, x, y, moved);
        if (foes.length) opts.push({ act: 'attack', label: '⚔️ Attack', primary: true });
        if (u.skill) {
            const S = SKILLS[u.skill];
            const t = skillTargets(B, u, x, y);
            opts.push({ act: 'skill', label: `${S.icon} ${S.name}${u.cd > 0 ? ` (rests ${u.cd})` : ''}`, disabled: !t.length });
        }
        if (canCapture(B, u, x, y)) {
            const i = idx(B, x, y);
            opts.push({ act: 'capture', label: `🚩 Claim ${TERRAIN[B.tiles[i]].name}${B.capt[i] < 20 && B.capBy[i] === u.id ? ` (${B.capt[i]} left)` : ''}`, primary: true });
        }
        if (unchainTargets(B, u, x, y).length) opts.push({ act: 'unchain', label: '🎵 Unchain', primary: true });
        opts.push({ act: 'wait', label: '⏸ Wait' });
        opts.push({ act: 'cancel', label: '↩ Back' });
        return opts;
    }

    _attackable(u, x, y, moved = x !== u.x || y !== u.y) {
        const B = this.B;
        if (u.atk <= 0 || (u.indirect && moved)) return [];
        const out = [];
        for (const [tx, ty] of ring(B, x, y, u.rng[0], u.rng[1])) {
            const t = unitAt(B, tx, ty);
            if (!t || t.team === u.team) continue;
            const ox = u.x, oy = u.y;
            u.x = x; u.y = y;
            const b = blow(B, u, t);
            u.x = ox; u.y = oy;
            if (b > 0) out.push([tx, ty]);
        }
        return out;
    }

    openMenu() {
        const opts = this.options();
        const [x, y] = this.dest;
        const at = this.view.screenOf(x, y, 0.6);
        this.ui.actMenu(opts, at, (a) => this.pick(a));
    }

    pick(a) {
        const u = this.unit(this.sel);
        if (!u || !this.canAct()) return;
        this.audio.ui('click');
        if (a === 'cancel') return this.back();
        if (a === 'wait') return this.send({ t: 'act', id: u.id, to: this.dest, do: 'wait' });
        if (a === 'capture') return this.send({ t: 'act', id: u.id, to: this.dest, do: 'capture' });
        this.ui.hidePopups();
        this.mode = 'target';
        this.targetKind = a;
        const tg = this.targets();
        // a skill with only its caster as target (a war cry, a quake) asks once and fires
        if (a === 'skill' && tg.length === 1 && tg[0][0] === this.dest[0] && tg[0][1] === this.dest[1]) return this.chooseTarget(tg[0][0], tg[0][1]);
        if (tg.length === 1 && a !== 'skill') return this.chooseTarget(tg[0][0], tg[0][1]);
        this.ui.toast(a === 'attack' ? 'Tap a red target.' : a === 'unchain' ? 'Tap the chained dragon.' : `Tap where to use ${SKILLS[u.skill].name}.`);
        this.refresh();
    }

    targets() {
        const u = this.unit(this.sel);
        if (!u || !this.dest) return [];
        const [x, y] = this.dest;
        if (this.targetKind === 'attack') return this._attackable(u, x, y);
        if (this.targetKind === 'skill') return skillTargets(this.B, u, x, y);
        if (this.targetKind === 'unchain') return unchainTargets(this.B, u, x, y);
        return [];
    }

    chooseAttack(t) {
        this.mode = 'target';
        this.targetKind = 'attack';
        this.chooseTarget(t.x, t.y);
    }

    chooseTarget(x, y) {
        const B = this.B, u = this.unit(this.sel);
        if (!u) return;
        const [fx, fy] = this.dest;
        const at = this.view.screenOf(x, y, 0.6);
        const t = unitAt(B, x, y);
        this.cur = { x, y };
        this.refresh();
        if (this.targetKind === 'attack') {
            const f = forecast(B, u, t, fx, fy);
            const note = t.chained && f.hpD <= 0 && !t.target ? '⚠️ This would knock out a dragon you could free!' : '';
            this.ui.forecast(B, u, t, f, at, { note, onYes: () => this.send({ t: 'act', id: u.id, to: this.dest, do: 'attack', target: [x, y] }), onNo: () => { this.ui.hidePopups(); this.mode = 'target'; this.refresh(); } });
        } else if (this.targetKind === 'unchain') {
            const c = unchainChance(B, t, u);
            this.ui.confirmPop(`<b>Sing ${t.name} free?</b><p>Chance: <b>${Math.round(c * 100)}%</b>${c < 1 ? ' (certain below a quarter health)' : ''}. Freed, it joins you at once and comes home to your roost.</p>`, '🎵 Unchain', at, {
                onYes: () => this.send({ t: 'act', id: u.id, to: this.dest, do: 'unchain', target: [x, y] }),
                onNo: () => { this.ui.hidePopups(); this.refresh(); },
            });
        } else {
            const S = SKILLS[u.skill];
            this.ui.confirmPop(`<b>${S.icon} ${S.name}</b><p>${S.desc}</p>`, `${S.icon} Use`, at, {
                onYes: () => this.send({ t: 'act', id: u.id, to: this.dest, do: 'skill', target: [x, y] }),
                onNo: () => { this.ui.hidePopups(); this.refresh(); },
            });
        }
    }

    send(cmd) {
        const r = this.act(cmd);
        if (!r.ok) { this.audio.ui('deny'); this.ui.toast('Not possible: ' + r.err); this.refresh(); return false; }
        this.sel = null; this.mode = 'idle'; this.dest = null; this.R = null; this.insp = null; this.targetKind = null;
        this.ui.hidePopups();
        this.view.preview(null);
        this.refresh();
        return true;
    }

    /** Back one level. Returns true if there was anything to back out of. */
    back() {
        const u = this.unit(this.sel);
        if (this.mode === 'target' && u) {
            this.ui.hidePopups();
            this.mode = 'menu'; this.targetKind = null;
            this.openMenu(); this.audio.ui('close'); this.refresh(); return true;
        }
        if (this.mode === 'menu' && u) {
            this.ui.hidePopups(); this.view.preview(null);
            this.mode = 'move'; this.dest = null;
            this.audio.ui('close'); this.refresh(); return true;
        }
        if (this.sel != null || this.insp != null) { this.deselect(); this.audio.ui('close'); return true; }
        return false;
    }

    openCall(x, y) {
        const G = this.getG(), B = this.B;
        if (!reserve(G, B).length) { this.ui.toast('No one left in the stable to call.'); return; }
        this.roostUi.openCall([x, y], (rid, at) => {
            const d = G.meta.dragons.find((r) => r.rid === rid);
            if (callCost(G, rid) > B.funds.p) { this.audio.ui('deny'); this.ui.toast('Not enough gold.'); return; }
            if (!canStand(B, { mt: SPECIES[d.sp].mt, traits: d.traits }, at[0], at[1])) { this.ui.toast(`${d.name} can't stand there.`); return; }
            this.ui.closeScreen('callmenu');
            this.send({ t: 'call', at, rid });
        });
    }

    powerButton() { if (this.canAct()) { const r = this.act({ t: 'power', team: 'p' }); if (!r.ok) this.ui.toast('The song isn\'t ready.'); this.refresh(); } }
    endButton() {
        if (!this.canAct()) return;
        const left = this.B.units.filter((u) => u.team === 'p' && u.hp > 0 && !u.acted && u.kind !== 'structure').length;
        this.audio.ui('click');
        this.send({ t: 'end' });
        void left;
    }

    nextUnit(dir = 1) {
        const B = this.B;
        if (!B || !this.canAct()) return;
        const mine = B.units.filter((u) => u.team === 'p' && u.hp > 0 && !u.acted && u.stun <= 0).sort((a, b) => a.id - b.id);
        if (!mine.length) { this.ui.toast('Everyone has acted. End the turn when ready.'); return; }
        const i = mine.findIndex((u) => u.id === this.sel);
        if (this.mode !== 'move' && this.mode !== 'idle') this.back();
        this.select(mine[(i + dir + mine.length) % mine.length]);
        this.showCursor = true;
    }

    hover(x, y) {
        this.cur = { x, y };
        this.showCursor = true;
        if (this.mode === 'move' && this.sel != null) this.refresh();
        else if (this.mode === 'idle') { const u = unitAt(this.B, x, y); this.insp = u?.id ?? null; this.refresh(); }
        else this.view.setCursor(this.cur);
    }

    /** One key from the queue. Returns true when the battle used it. */
    onKey(key) {
        const B = this.B;
        if (!B) return false;
        if (this.mode === 'menu' || (!document.getElementById('forecast').hidden)) {
            const pop = !document.getElementById('forecast').hidden ? 'forecast' : 'actmenu';
            if (key === 'ArrowDown' || key === 'ArrowRight') { this.ui.moveFocus(1, pop); return true; }
            if (key === 'ArrowUp' || key === 'ArrowLeft') { this.ui.moveFocus(-1, pop); return true; }
            if (key === 'Escape') { this.back(); if (!document.getElementById('forecast').hidden) { this.ui.hidePopups(); this.refresh(); } return true; }
            if (key === 'Enter' || key === 'Space') { const a = document.activeElement; if (a && a.closest('.popup')) { a.click(); return true; } }
        }
        const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
        if (mv) {
            if (!this.cur) { const t = B.units.find((u) => u.tamer && u.hp > 0); this.cur = t ? { x: t.x, y: t.y } : { x: 0, y: 0 }; }
            this.showCursor = true;
            this.cur = { x: Math.max(0, Math.min(B.w - 1, this.cur.x + mv[0])), y: Math.max(0, Math.min(B.h - 1, this.cur.y + mv[1])) };
            if (this.mode === 'idle') { const u = unitAt(B, this.cur.x, this.cur.y); this.insp = u?.id ?? null; }
            this.view.stage.focus(this.cur.x, this.cur.y);
            this.audio.ui('tick');
            this.refresh();
            return true;
        }
        switch (key) {
            case 'Enter': case 'Space':
                if (!this.cur) { this.nextUnit(1); return true; }
                this.showCursor = true; this.onTile(this.cur.x, this.cur.y); return true;
            case 'Escape': return this.back();
            case 'Tab': this.nextUnit(1); return true;
            case 'KeyE': this.endButton(); return true;
            case 'KeyQ': this.powerButton(); return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ keeping the screen in step
    sync() {
        const B = this.B;
        if (!B) return;
        const sig = this._sigOf();
        if (sig !== this._sig) this.refresh();
    }
    _sigOf() {
        const B = this.B;
        return [B.phase, B.turn, B.over ? 1 : 0, this.busy, this.sel, this.mode, this.insp, this.dest, B.funds.p, Math.round(B.power.p.meter), Math.round(B.power.e.meter), B.units.map((u) => `${u.id}:${u.x},${u.y},${u.hp},${u.acted ? 1 : 0},${u.team}`).join()].join('|');
    }

    refresh() {
        const B = this.B;
        if (!B) return;
        const busy = this.busy;
        const mine = B.phase === 'p' && !B.over && !busy;
        let sel = this.sel != null ? this.unit(this.sel) : null;
        if (sel && (sel.acted || !mine)) { this.sel = null; this.mode = 'idle'; this.dest = null; this.R = null; this.ui.hidePopups(); this.view.preview(null); sel = null; }
        const insp = this.insp != null ? this.unit(this.insp) : null;
        const hl = [];
        let path = null;
        if (sel && this.mode === 'move') {
            for (const [x, y] of destinations(B, sel, this.R)) hl.push({ x, y, kind: 'move' });
            // enemies it could strike after moving
            const seen = new Set();
            const origins = sel.indirect ? [[sel.x, sel.y]] : destinations(B, sel, this.R);
            for (const [ox, oy] of origins) for (const [tx, ty] of this._attackable(sel, ox, oy, ox !== sel.x || oy !== sel.y)) { const k = tx + ',' + ty; if (!seen.has(k)) { seen.add(k); hl.push({ x: tx, y: ty, kind: 'attack' }); } }
            if (this.cur && this.showCursor) {
                const r = this.R.get(idx(B, this.cur.x, this.cur.y));
                if (r && !r.occ) path = pathTo(B, this.R, this.cur.x, this.cur.y);
            }
        }
        if (sel && (this.mode === 'menu' || this.mode === 'target') && this.dest) {
            path = pathTo(B, this.R, this.dest[0], this.dest[1]);
            if (this.mode === 'target') {
                const S = SKILLS[sel.skill];
                for (const [x, y] of this.targets()) hl.push({ x, y, kind: this.targetKind === 'attack' ? 'attack' : this.targetKind === 'unchain' ? 'call' : 'skill' });
                if (this.targetKind === 'skill' && S?.area && this.cur) {
                    for (let dy = -S.area; dy <= S.area; dy++) for (let dx = -S.area; dx <= S.area; dx++) {
                        const x = this.cur.x + dx, y = this.cur.y + dy;
                        if (x >= 0 && y >= 0 && x < B.w && y < B.h && this.targets().some((t) => t[0] === this.cur.x && t[1] === this.cur.y)) hl.push({ x, y, kind: 'area' });
                    }
                }
            }
        }
        if (!sel && insp && insp.team !== 'p' && !insp.bound && insp.kind !== 'structure') {
            // an enemy's reach: where it could move and strike
            const R = reachOf(B, insp);
            const tiles = new Set();
            const origins = insp.indirect ? [[insp.x, insp.y]] : destinations(B, insp, R).concat([[insp.x, insp.y]]);
            for (const [ox, oy] of origins) for (const [tx, ty] of ring(B, ox, oy, insp.rng[0], insp.rng[1])) tiles.add(tx + ',' + ty);
            for (const k of tiles) { const [x, y] = k.split(',').map(Number); hl.push({ x, y, kind: 'danger' }); }
        }
        if (!sel && mine) {
            // claimable roosts glow so you know you can call from them
            for (let i = 0; i < B.tiles.length; i++) if (TERRAIN[B.tiles[i]].deploy && B.own[i] === 'p' && !unitAt(B, i % B.w, (i / B.w) | 0)) hl.push({ x: i % B.w, y: (i / B.w) | 0, kind: 'call' });
        }
        this.view.setHighlights(hl);
        this.view.setPath(path);
        this.view.setSelected(sel ? sel.id : null);
        this.view.setCursor(this.showCursor && this.cur ? this.cur : null);

        const at = this.cur || (sel ? { x: sel.x, y: sel.y } : null);
        const shown = sel || insp || (at ? unitAt(B, at.x, at.y) : null);
        this.ui.unitCard(shown, B);
        if (at) this.ui.tileCard(B, at.x, at.y); else this.ui.tileCard(B, null);
        this.ui.setHeader(B, this.getG());
        document.getElementById('btn-next').disabled = !mine;
        this._sig = this._sigOf();
        void cheb;
    }
}
