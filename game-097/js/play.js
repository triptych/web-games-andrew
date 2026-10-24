// The battle controller: turns taps, clicks and keys into commands for the sim and keeps the board
// highlights, the unit card and the action buttons in step with what is selected.
//
//   idle     nothing selected; tap one of your pieces to select it, any piece to inspect it
//   move     a piece is selected: blue squares to move to, red squares to capture
//   ability  aiming the selected piece's special ability (green squares)
//   confirm  a capture is chosen and the duel forecast is up; tap it again or press Strike
//
// A tap on a capture never strikes straight away: the forecast comes first, because a fight cannot
// be taken back.

import { genMoves, unitAt, threatSquares } from './sim/moves.js';
import { abilityTargets } from './sim/abilities.js';
import { ABILITIES, UNITS } from './sim/data.js';

export class Play {
    constructor({ view, ui, audio, getG, act }) {
        Object.assign(this, { view, ui, audio, getG, act });
        this.reset();
    }

    get B() { return this.getG().battle; }

    reset() {
        this.sel = null;
        this.mode = 'idle';
        this.pending = null;
        this.insp = null;
        this.danger = false;
        this.cur = { x: 3, y: 5 };
        this.showCursor = false;
        this._sig = '';
        this.view.setCursor(null);
        this.ui.hideForecast?.();
    }

    unit(id) { return this.B?.units.find((u) => u.id === id) || null; }
    /** Events the sim has queued but the view has not been handed yet count as "still playing": for that
     *  one frame the board is already in its new state while nothing on screen has moved. */
    get busy() { return this.view.busy || this.getG().events.length > 0; }
    canAct() { const B = this.B; return !!B && !B.over && B.phase === 'p' && !this.busy; }

    // ------------------------------------------------------------------ input
    onTile(x, y) {
        const B = this.B;
        if (!B || x == null) return;
        if (!this.canAct()) { this.insp = (unitAt(B, x, y) || {}).id ?? null; this.refresh(); return; }
        const u = unitAt(B, x, y);
        const sel = this.sel != null ? this.unit(this.sel) : null;

        if (this.mode === 'confirm') {
            if (this.pending && x === this.pending.cmd.to[0] && y === this.pending.cmd.to[1]) return this.confirm();
            this.mode = 'move'; this.pending = null; this.ui.hideForecast();
        }
        if (this.mode === 'ability' && sel) {
            if (abilityTargets(B, sel).some((t) => t[0] === x && t[1] === y)) return this.send({ t: 'ability', id: sel.id, to: [x, y] });
            this.mode = 'move';
        }
        if (this.mode === 'move' && sel) {
            const mv = genMoves(B, sel).find((m) => m.to[0] === x && m.to[1] === y);
            if (mv) {
                if (mv.kind === 'move') return this.send({ t: 'move', id: sel.id, to: [x, y] });
                const d = unitAt(B, x, y);
                this.mode = 'confirm';
                this.pending = { cmd: { t: 'move', id: sel.id, to: [x, y] }, stop: mv.stop };
                this.ui.showForecast(B, sel, d, mv.stop);
                this.audio.ui('select');
                return this.refresh();
            }
            if (u === sel) { this.deselect(); return; }
        }
        if (u && u.team === 'p' && !u.acted) { this.select(u); return; }
        if (u) { this.sel = null; this.mode = 'idle'; this.insp = u.id; this.audio.ui('click'); this.refresh(); return; }
        this.deselect();
    }

    select(u) {
        this.sel = u.id; this.mode = 'move'; this.insp = null; this.pending = null;
        this.ui.hideForecast();
        this.audio.ui('select');
        this.cur = { x: u.x, y: u.y };
        this.refresh();
    }

    deselect() {
        this.sel = null; this.mode = 'idle'; this.pending = null; this.insp = null;
        this.ui.hideForecast();
        this.refresh();
    }

    hover(x, y) {
        this.cur = { x, y };
        this.showCursor = true;
        const u = this.B ? unitAt(this.B, x, y) : null;
        const want = u && this.sel == null ? u.id : this.insp;
        if (this.sel == null && want !== this.insp) this.insp = want;
        this.view.setCursor(this.cur);
        this.refresh();
    }

    send(cmd) {
        const r = this.act(cmd);
        if (!r.ok) { this.audio.ui('deny'); this.ui.toast('Not possible: ' + r.err); this.refresh(); return false; }
        this.sel = null; this.mode = 'idle'; this.pending = null; this.insp = null;
        this.ui.hideForecast();
        this.refresh();
        return true;
    }

    confirm() { if (this.pending) this.send(this.pending.cmd); }

    cancel() {
        if (this.mode === 'confirm') { this.mode = 'move'; this.pending = null; this.ui.hideForecast(); this.audio.ui('close'); this.refresh(); return true; }
        if (this.mode === 'ability') { this.mode = 'move'; this.audio.ui('close'); this.refresh(); return true; }
        if (this.sel != null || this.insp != null) { this.deselect(); this.audio.ui('close'); return true; }
        return false;
    }

    abilityButton() {
        const sel = this.sel != null ? this.unit(this.sel) : null;
        if (!sel || !this.canAct()) return;
        const t = abilityTargets(this.B, sel);
        if (!t.length) { this.audio.ui('deny'); return; }
        this.mode = this.mode === 'ability' ? 'move' : 'ability';
        this.ui.hideForecast(); this.pending = null;
        this.audio.ui('select');
        // an ability that needs no aim (a hymn, a vigil) fires at once; the rest wait for a tap
        if (this.mode === 'ability' && t.length === 1 && t[0][0] === sel.x && t[0][1] === sel.y) return this.send({ t: 'ability', id: sel.id, to: t[0] });
        this.refresh();
    }

    waitButton() {
        const sel = this.sel != null ? this.unit(this.sel) : null;
        if (sel && this.canAct()) this.send({ t: 'wait', id: sel.id });
    }

    endButton() { if (this.canAct()) { this.audio.ui('click'); this.send({ t: 'end' }); } }

    toggleDanger() {
        this.danger = !this.danger;
        document.getElementById('btn-danger').setAttribute('aria-pressed', String(this.danger));
        this.audio.ui('click');
        this.refresh();
    }

    nextPiece(dir = 1) {
        const B = this.B;
        if (!B || !this.canAct()) return;
        const mine = B.units.filter((u) => u.team === 'p' && !u.acted).sort((a, b) => a.id - b.id);
        if (!mine.length) return;
        const i = mine.findIndex((u) => u.id === this.sel);
        this.select(mine[(i + dir + mine.length) % mine.length]);
        this.showCursor = true;
        this.view.setCursor(this.cur);
    }

    /** One key from the queue. Returns true when the board used it. */
    onKey(key) {
        const B = this.B;
        if (!B) return false;
        const move = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
        if (move) {
            this.showCursor = true;
            this.cur = { x: Math.max(0, Math.min(B.w - 1, this.cur.x + move[0])), y: Math.max(0, Math.min(B.h - 1, this.cur.y + move[1])) };
            const u = unitAt(B, this.cur.x, this.cur.y);
            if (this.sel == null) this.insp = u ? u.id : null;
            this.view.setCursor(this.cur);
            this.audio.ui('click');
            this.refresh();
            return true;
        }
        switch (key) {
            case 'Enter': case 'Space': this.showCursor = true; this.view.setCursor(this.cur); this.onTile(this.cur.x, this.cur.y); return true;
            case 'Escape': return this.cancel();
            case 'KeyE': this.abilityButton(); return true;
            case 'KeyW': this.waitButton(); return true;
            case 'KeyT': this.endButton(); return true;
            case 'KeyD': this.toggleDanger(); return true;
            case 'Tab': this.nextPiece(1); return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ keeping the screen in step
    /** Called every frame: redraw only when something that shows has changed. */
    sync() {
        const B = this.B;
        if (!B) return;
        const sig = [B.phase, B.turn, B.over, this.busy, this.sel, this.mode, this.insp, B.units.map((u) => `${u.id}:${u.x}${u.y}${u.hp}${u.acted ? 1 : 0}${u.cd}`).join()].join('|');
        if (sig !== this._sig) this.refresh();
    }

    refresh() {
        const B = this.B;
        if (!B) return;
        const busy = this.busy;
        const mine = B.phase === 'p' && !B.over && !busy;
        let sel = this.sel != null ? this.unit(this.sel) : null;
        if (sel && (sel.acted || !mine)) { this.sel = null; this.mode = 'idle'; this.pending = null; this.ui.hideForecast(); sel = null; }
        const insp = this.insp != null ? this.unit(this.insp) : null;

        const hl = [];
        if (this.danger) for (const s of threatSquares(B, 'e')) { const [x, y] = s.split(',').map(Number); hl.push({ x, y, kind: 'danger' }); }
        if (!sel && insp && insp.team === 'e') for (const s of threatSquares(B, 'e', insp)) { const [x, y] = s.split(',').map(Number); hl.push({ x, y, kind: 'danger' }); }
        if (sel && this.mode === 'move') for (const m of genMoves(B, sel)) hl.push({ x: m.to[0], y: m.to[1], kind: m.kind === 'cap' ? 'cap' : 'move' });
        if (sel && this.mode === 'ability') for (const t of abilityTargets(B, sel)) hl.push({ x: t[0], y: t[1], kind: sel.ability === 'flame' ? 'area' : 'ability' });
        if (sel && this.mode === 'confirm' && this.pending) hl.push({ x: this.pending.cmd.to[0], y: this.pending.cmd.to[1], kind: 'target' });
        this.view.setHighlights(hl);
        this.view.setSelected(sel ? sel.id : null);
        this.view.setCursor(this.showCursor ? this.cur : null);

        const shown = sel || insp || (this.showCursor ? unitAt(B, this.cur.x, this.cur.y) : null);
        this.ui.showCard(shown);
        this.ui.setHeader(B, this.getG());
        let ability = null;
        if (sel && sel.ability) {
            const ab = ABILITIES[sel.ability];
            ability = { label: `${ab.icon} ${UNITS[sel.key].abilityName || ab.name}${sel.cd > 0 ? ` (${sel.cd})` : ''}`, enabled: mine && abilityTargets(B, sel).length > 0 };
        }
        this.ui.setActions({ ability, wait: mine && !!sel, end: mine, abilityOn: this.mode === 'ability' });
        document.getElementById('bh-phase').classList.toggle('busy', busy);
        this._sig = [B.phase, B.turn, B.over, busy, this.sel, this.mode, this.insp, B.units.map((u) => `${u.id}:${u.x}${u.y}${u.hp}${u.acted ? 1 : 0}${u.cd}`).join()].join('|');
    }
}
