// The battle controller: turns taps, clicks and keys into commands, and keeps the highlights, hints,
// forecast and hand in step with what is chosen.
//
//   deploy   tap one of your stacks, then a hex in your two columns
//   idle     tap your stack to select it (gold hexes: its free move), any stack to inspect it
//   card     a card is chosen: tap who carries it out (green), then its target (red/blue)
//   confirm  an attack or spell is aimed: the forecast is up; tap the target again (or Enter) to do it
//
// Nothing that costs ink or hurts anyone happens on the first tap: an aimed order shows its
// forecast first. Movement is free and can't be undone, but it is one tap on a highlighted hex.

import { cardDef, needs, cardActors, cardTargets, playable, orphaned, moveTargets, canMove, stackAt, stackById, preview, unitDef, reachOf, deploySlots, mine, foes } from './sim/battle.js';
import { CREATURES } from './sim/data.js';
import { unkey, key as hkey, dist, pathTo } from './sim/hex.js';
import { hexPos } from './view/stage.js';

const same = (a, c, r) => a && a[0] === c && a[1] === r;
const CONFIRM = new Set(['attack', 'spell', 'special']);

export class Play {
    constructor({ view, ui, audio, getG, send }) {
        Object.assign(this, { view, ui, audio, getG, send });
        this.reset();
    }

    get G() { return this.getG(); }
    get B() { return this.G.battle; }
    /** Events the sim has queued but the view has not been handed yet count as busy. */
    get busy() { return this.view.busy || this.G.events.length > 0; }
    canAct() { const B = this.B; return !!B && !B.over && B.phase === 'player' && !this.busy; }

    reset() {
        this.card = null;      // uid
        this.actor = null;     // stack id carrying the card out
        this.sel = null;       // your selected stack (free move)
        this.insp = null;      // any stack being inspected
        this.pending = null;   // { at } aimed, waiting for confirmation
        this.cur = null;       // keyboard cursor [c, r]
        this.hover = null;
        this.handSeen = new Set();
        this.ui.hideForecast();
        this.ui.hideInfo();
    }

    cardObj() { return this.card != null ? this.B?.hand.find((c) => c.uid === this.card) || null : null; }

    // ------------------------------------------------------------------ input
    onTile(c, r) {
        const B = this.B;
        if (!B || c == null) return;
        const u = stackAt(B, c, r);
        if (B.phase === 'deploy') {
            if (u && u.side === 'p') { this.sel = this.sel === u.id ? null : u.id; this.audio.ui('select'); return this.refresh(); }
            if (this.sel != null && deploySlots(B).has(hkey(c, r))) { this.send({ t: 'place', id: this.sel, at: [c, r] }); return this.refresh(); }
            if (u) { this.inspect(u.id); return; }
            this.sel = null;
            return this.refresh();
        }
        if (!this.canAct()) { if (u) this.inspect(u.id); return; }
        const card = this.cardObj();
        if (card) return this.onTileCard(card, c, r, u);
        // no card: select, move, inspect
        const s = this.sel != null ? stackById(B, this.sel) : null;
        if (s && moveTargets(B, s).some(([x, y]) => x === c && y === r)) {
            this.send({ t: 'move', id: s.id, at: [c, r] });
            this.audio.ui('click');
            return this.refresh();
        }
        if (u && u.side === 'p') {
            if (this.sel === u.id) { this.sel = null; this.insp = null; this.ui.hideInfo(); }
            else { this.sel = u.id; this.insp = u.id; this.audio.ui('select'); }
            return this.refresh();
        }
        if (u) { this.sel = null; this.inspect(u.id); return; }
        this.sel = null; this.insp = null; this.ui.hideInfo();
        this.refresh();
    }

    onTileCard(card, c, r, u) {
        const B = this.B;
        const need = needs(card);
        const actors = cardActors(B, card);
        if (need === 'actor' || (need === 'actor+hex' && this.actor == null)) {
            if (u && actors.includes(u.id)) {
                if (need === 'actor') return this.play({ uid: card.uid, actor: u.id });
                this.actor = u.id; this.audio.ui('select');
                return this.refresh();
            }
            if (u) { this.inspect(u.id); return; }
            return this.cancel();
        }
        const actor = need === 'actor+hex' ? this.actor : actors[0];
        const targets = cardTargets(B, card, actor);
        if (targets.some(([x, y]) => x === c && y === r)) {
            const d = cardDef(card);
            const cmd = { uid: card.uid, actor, at: [c, r] };
            if (CONFIRM.has(d.kind) && !same(this.pending?.at, c, r)) {
                this.pending = { at: [c, r] };
                this.showForecast(cmd);
                this.audio.ui('select');
                return this.refresh();
            }
            return this.play(cmd);
        }
        if (need === 'actor+hex' && u && actors.includes(u.id)) { this.actor = u.id; this.pending = null; this.ui.hideForecast(); this.audio.ui('select'); return this.refresh(); }
        if (u) { this.inspect(u.id); return; }
        this.cancel();
    }

    inspect(id) {
        this.insp = id;
        this.ui.renderInfo(this.G, id);
        this.audio.ui('click');
        this.refresh();
    }

    onCard(uid) {
        const B = this.B;
        if (!B || B.phase !== 'player' || B.over) return;
        const card = B.hand.find((c) => c.uid === uid);
        if (!card) return;
        if (this.card === uid) {
            // a second tap on a card that needs no target plays it
            if (needs(card) === 'none' && playable(B, card) && this.canAct()) return this.play({ uid });
            if (this.pending) { const at = this.pending.at; return this.onTile(at[0], at[1]); }
            return this.cancel();
        }
        if (!playable(B, card)) {
            const d = cardDef(card);
            const why = d.unplayable ? `${d.name} cannot be played.` : orphaned(B, card) ? `The ${CREATURES[d.actor].name} are not on the field.` : (card && B.ink < (d.cost ?? 0)) ? 'Not enough ink.' : 'No one can carry that out now.';
            this.ui.toast(why);
            this.audio.ui('deny');
            const el = document.querySelector(`#hand .card[data-uid="${uid}"]`);
            el?.classList.remove('shake'); void el?.offsetWidth; el?.classList.add('shake');
            return;
        }
        this.card = uid;
        this.pending = null;
        this.ui.hideForecast();
        const need = needs(card);
        const actors = cardActors(B, card);
        this.actor = need === 'actor+hex' && actors.length === 1 ? actors[0] : need === 'actor+hex' && this.sel != null && actors.includes(this.sel) ? this.sel : null;
        this.audio.ui('card');
        this.refresh();
    }

    play(cmd) {
        const r = this.send({ t: 'play', ...cmd });
        if (r && !r.ok) { this.ui.toast(r.err); this.audio.ui('deny'); }
        else this.audio.ui('card');
        this.card = null; this.actor = null; this.pending = null;
        this.ui.hideForecast();
        this.refresh();
    }

    cancel() {
        if (this.card == null && this.sel == null && this.insp == null) return false;
        if (this.card != null) { this.card = null; this.actor = null; this.pending = null; }
        else { this.sel = null; this.insp = null; this.ui.hideInfo(); }
        this.ui.hideForecast();
        this.audio.ui('close');
        this.refresh();
        return true;
    }

    endTurn() {
        if (!this.canAct()) return;
        this.card = null; this.actor = null; this.pending = null; this.sel = null;
        this.ui.hideForecast();
        this.send({ t: 'end' });
        this.refresh();
    }

    onHover(c, r) {
        if (same(this.hover, c, r)) return;
        this.hover = c == null ? null : [c, r];
        const B = this.B;
        if (!B || !this.canAct() || this.pending) { this.paint(); return; }
        const card = this.cardObj();
        if (card && c != null) {
            const need = needs(card);
            const actor = need === 'actor+hex' ? this.actor : cardActors(B, card)[0];
            if (need !== 'actor' && !(need === 'actor+hex' && actor == null) && cardTargets(B, card, actor).some(([x, y]) => x === c && y === r) && CONFIRM.has(cardDef(card).kind)) this.showForecast({ uid: card.uid, actor, at: [c, r] });
            else this.ui.hideForecast();
        }
        this.paint();
    }

    /** Keyboard and gamepad. Returns true if the press was used. */
    key(p) {
        const B = this.B;
        if (!B) return false;
        const k = p.key;
        if (/^Digit[1-9]$/.test(k)) { const c = B.hand[+k.slice(5) - 1]; if (c) this.onCard(c.uid); return true; }
        if (k === 'KeyE') { this.endTurn(); return true; }
        if (k === 'Tab') {
            const own = mine(B);
            if (!own.length) return true;
            const i = own.findIndex((s) => s.id === this.sel);
            const s = own[(i + (p.shift ? own.length - 1 : 1)) % own.length];
            this.cur = [s.c, s.r];
            this.onTile(s.c, s.r);
            return true;
        }
        if (k === 'BracketLeft' || k === 'BracketRight' || k === 'KeyQ') {
            if (!B.hand.length) return true;
            const i = B.hand.findIndex((c) => c.uid === this.card);
            const n = B.hand.length;
            const j = i < 0 ? 0 : (i + (k === 'BracketLeft' ? n - 1 : 1)) % n;
            this.card = null;
            this.onCard(B.hand[j].uid);
            return true;
        }
        if (k.startsWith('Arrow')) {
            if (!this.cur) { const s = mine(B)[0]; this.cur = s ? [s.c, s.r] : [1, 2]; }
            let [c, r] = this.cur;
            if (k === 'ArrowLeft') c--; else if (k === 'ArrowRight') c++;
            else if (k === 'ArrowUp') r--; else r++;
            // on a portrait phone the field is turned: up the screen is toward the foe
            if (this.view.stage.portrait) { [c, r] = [this.cur[0] + (k === 'ArrowUp' ? 1 : k === 'ArrowDown' ? -1 : 0), this.cur[1] + (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0)]; }
            this.cur = [Math.max(0, Math.min(B.cols - 1, c)), Math.max(0, Math.min(B.rows - 1, r))];
            this.hover = null;
            this.onHover(...this.cur);
            return true;
        }
        if (k === 'Enter' || k === 'Space') {
            if (this.cur) this.onTile(...this.cur);
            else if (this.card != null) this.onCard(this.card);
            else if (B.phase === 'deploy') this.send({ t: 'begin' });
            return true;
        }
        if (k === 'Escape' || k === 'KeyX') return B.phase === 'player' && !this.busy ? this.cancel() : false;
        return false;
    }

    // ------------------------------------------------------------------ what the board shows
    showForecast(cmd) {
        const B = this.B;
        const ev = preview(B, cmd);
        if (!ev) { this.ui.hideForecast(); return; }
        const per = new Map();
        const name = (id) => { const s = stackById(B, id); return s ? unitDef(s).name : ''; };
        for (const e of ev) {
            if (e.type !== 'hit') continue;
            const o = per.get(e.id) || { lost: 0, killed: 0, ward: 0, dead: false };
            o.lost += e.lost; o.killed += e.killed; o.ward += e.ward; o.dead = o.dead || e.count === 0;
            per.set(e.id, o);
        }
        const rows = [];
        for (const [id, o] of per) {
            const s = stackById(B, id);
            const mineS = s?.side === 'p';
            rows.push(`<div${mineS ? ' class="back"' : ''}>${mineS ? 'Your ' : ''}${name(id)}: <b>−${o.lost}</b>${o.ward ? ` (Ward soaks ${o.ward})` : ''}${o.killed ? `, ${o.killed} slain` : ''}${o.dead ? ' · <b>destroyed</b>' : ''}</div>`);
        }
        const sts = ev.filter((e) => e.type === 'status').map((e) => e.k);
        if (sts.length) rows.push(`<div>${[...new Set(sts)].join(', ')}</div>`);
        if (!rows.length) rows.push('<div>No damage.</div>');
        const p = this.view.stage.toScreen(hexPos(...cmd.at, 1.6));
        this.ui.showForecast(p.x, p.y, rows.join('') + `<div class="dim" style="font-size:11px">${'ontouchstart' in window ? 'Tap again' : 'Click again or Enter'} to give the order</div>`);
    }

    /** Recompute every highlight, the hint and the hand. */
    refresh() {
        const B = this.B;
        if (!B) return;
        if (this.lastPhase === 'deploy' && B.phase !== 'deploy') { this.sel = null; this.insp = null; this.ui.hideInfo(); }
        this.lastPhase = B.phase;
        if (this.card != null && !this.cardObj()) { this.card = null; this.actor = null; this.pending = null; }
        if (this.sel != null && !stackById(B, this.sel)) this.sel = null;
        if (this.insp != null && !stackById(B, this.insp)) { this.insp = null; this.ui.hideInfo(); }
        if (this.insp != null) this.ui.renderInfo(this.G, this.insp);
        const fresh = new Set(B.hand.filter((c) => !this.handSeen.has(c.uid)).map((c) => c.uid));
        this.handSeen = new Set(B.hand.map((c) => c.uid));
        this.ui.renderHand(this.G, { sel: this.card, busy: this.busy, enemy: B.phase === 'enemy', fresh });
        this.ui.renderHud(this.G);
        this.paint();
    }

    paint() {
        const B = this.B;
        if (!B) return;
        const hl = [];
        const add = (list, kind) => { for (const [c, r] of list) hl.push({ c, r, kind }); };
        let hint = '';
        let path = null;
        if (B.phase === 'deploy') {
            add(mine(B).map((s) => [s.c, s.r]), 'ally');
            if (this.sel != null) { add([...deploySlots(B)].map(unkey).filter(([c, r]) => !stackAt(B, c, r) || stackAt(B, c, r).side === 'p'), 'deploy'); hint = 'Tap a hex in your columns to place it there.'; }
            else hint = '';
        } else if (B.phase === 'player' && !B.over) {
            const card = this.cardObj();
            if (card) {
                const d = cardDef(card);
                const need = needs(card);
                const actors = cardActors(B, card);
                if (need === 'none') hint = `${d.name}: tap the card again to play it.`;
                else if (need === 'actor' || (need === 'actor+hex' && this.actor == null)) {
                    add(actors.map((id) => { const s = stackById(B, id); return [s.c, s.r]; }), 'ally');
                    hint = `${d.name}: choose which of your stacks carries it out.`;
                } else {
                    const actor = need === 'actor+hex' ? this.actor : actors[0];
                    const tg = cardTargets(B, card, actor);
                    const kind = d.kind === 'move' ? 'move' : d.target === 'ally' ? 'target' : d.kind === 'earthwork' || d.target === 'hex' ? 'area' : 'attack';
                    add(tg, kind);
                    if (actor != null) { const s = stackById(B, actor); add([[s.c, s.r]], 'ally'); }
                    hint = this.pending ? 'Tap the target again to give the order. Tap elsewhere to cancel.' : `${d.name}: choose the target.`;
                    if (this.pending && d.area) add(B.stacks.filter((s) => dist(s.c, s.r, ...this.pending.at) <= d.area).map((s) => [s.c, s.r]), 'area');
                    if (d.kind === 'move' && this.hover && actor != null && tg.some(([x, y]) => same(this.hover, x, y)) && !d.tele) path = pathTo(reachOf(B, stackById(B, actor), d.bonus || 0), hkey(...this.hover));
                }
            } else if (this.sel != null) {
                const s = stackById(B, this.sel);
                if (s && canMove(B, s)) {
                    const mt = moveTargets(B, s);
                    add(mt, 'move');
                    hint = `${unitDef(s).name}: tap a gold hex to move (free, once a turn), or play a card.`;
                    if (this.hover && mt.some(([x, y]) => same(this.hover, x, y))) path = unitDef(s).fly ? [[s.c, s.r], this.hover] : pathTo(reachOf(B, s), hkey(...this.hover));
                } else if (s) hint = `${unitDef(s).name} ${s.moved ? 'has already moved' : 'cannot move'} this turn.`;
            } else if (this.insp != null) {
                const e = stackById(B, this.insp);
                if (e && e.side === 'e') {
                    const reach = [...reachOf(B, e).keys()].map(unkey);
                    add(reach, 'threat');
                }
            } else {
                const anyMove = mine(B).some((s) => canMove(B, s));
                hint = anyMove ? 'Tap a stack to move it, or a card to give an order.' : 'Play your cards, or end the turn.';
            }
        }
        if (this.cur && B.phase !== 'enemy') hl.push({ c: this.cur[0], r: this.cur[1], kind: 'hover' });
        else if (this.hover && B.phase !== 'enemy' && !('ontouchstart' in window)) hl.push({ c: this.hover[0], r: this.hover[1], kind: 'hover' });
        this.view.setHighlights(hl);
        this.view.select(this.actor ?? this.sel);
        this.view.showPath(path);
        if (B.phase === 'enemy') hint = 'The foe moves…';
        this.ui.setHint(B.over ? '' : hint);
    }
}

export { foes };
