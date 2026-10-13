/* TALEWRIGHT runtime — interpreter: runs an event's command tree. A stack of
 * { list, i } frames; a command that has to wait returns a handle whose `done`
 * flag the interpreter polls. Branches are just pushed lists. */
(window.TW_MODULES = window.TW_MODULES || []).push(['interp', function (TW) {
    'use strict';
    const U = TW.util;
    const LOOP_LIMIT = 10000;

    function compare(a, op, b) {
        switch (op) {
            case '=': case '==': return a === b;
            case '!=': return a !== b;
            case '>': return a > b;
            case '<': return a < b;
            case '<=': return a <= b;
            default: return a >= b;
        }
    }

    /** Evaluate a Conditional Branch condition. */
    function test(game, ev, c) {
        const st = game.state;
        if (!c) return false;
        switch (c.kind) {
            case 'switch': return st.sw(c.id) === (c.value !== false);
            case 'var': {
                const rhs = c.src === 'var' ? st.v(c.value) : (c.value | 0);
                return compare(st.v(c.id), c.op || '>=', rhs);
            }
            case 'self': return !!ev && st.selfSw(game.mapId(), ev.id, c.key || 'A') === (c.value !== false);
            case 'item': return st.has(c.id) === (c.value !== false);
            case 'gold': return compare(st.gold, c.op || '>=', c.value | 0);
            case 'actor': return st.inParty(c.id) === (c.value !== false);
            default: return false;
        }
    }

    class Interpreter {
        /**
         * @param game  the running game (state, ui, map, screen, hooks)
         * @param ev    the event definition running this list, or null
         * @param list  the command list
         * @param opts  { parallel }
         */
        constructor(game, ev, list, opts) {
            this.game = game;
            this.ev = ev;
            this.stack = [{ list: list || [], i: 0 }];
            this.wait = 0;
            this.handle = null;
            this.done = false;
            this.parallel = !!(opts && opts.parallel);
        }

        update(dt) {
            if (this.done) return;
            if (this.wait > 0) { this.wait -= dt; if (this.wait > 0) return; }
            if (this.handle) { if (!this.handle.done) return; this.after(this.handle); this.handle = null; }
            let n = 0;
            while (this.stack.length && !this.done) {
                const fr = this.stack[this.stack.length - 1];
                if (fr.i >= fr.list.length) { this.stack.pop(); continue; }
                const cmd = fr.list[fr.i++];
                if (!cmd || typeof cmd !== 'object') continue;
                this.cmd = cmd;
                if (this.exec(cmd)) return;
                if (++n > LOOP_LIMIT) {
                    this.done = true;
                    this.game.warn && this.game.warn('An event ran ' + LOOP_LIMIT + ' commands without waiting, so it was stopped. Is an Autorun event missing a switch?');
                    return;
                }
            }
            this.done = true;
        }

        push(list) { if (list && list.length) this.stack.push({ list, i: 0 }); }

        /** Called when a waited-on handle finishes, to follow its branch. */
        after(h) {
            if (h.kind === 'choice') {
                const cmd = h.cmd, r = h.result;
                this.game.hook('choice', { index: r, option: cmd.options && cmd.options[r] });
                if (r >= 0 && cmd.branches) this.push(cmd.branches[r]);
            } else if (h.kind === 'battle') {
                const cmd = h.cmd;
                if (h.result === 'win') this.push(cmd.win);
                else if (h.result === 'lose') this.push(cmd.loseList);
            }
        }

        exec(c) {
            const g = this.game, st = g.state, ev = this.ev;
            switch (c.t) {
                case 'text': {
                    const next = this.peek();
                    this.handle = g.ui.message(c, { holdForChoice: !!(next && next.t === 'choice') });
                    g.hook('text', { speaker: c.speaker || '', event: ev ? ev.id : 0, trigger: this.trigger });
                    return true;
                }
                case 'choice': {
                    const opts = (c.options || []).filter((o) => o !== undefined);
                    if (!opts.length) return false;
                    this.handle = g.ui.choice(opts, c.cancel === undefined ? -1 : c.cancel);
                    this.handle.kind = 'choice'; this.handle.cmd = c;
                    return true;
                }
                case 'if': {
                    if (test(g, ev, c.cond)) this.push(c.then);
                    else if (c.else) this.push(c.else);
                    return false;
                }
                case 'wait': this.wait = Math.max(0, +c.sec || 0); return this.wait > 0;
                case 'erase': if (ev && g.map) g.map.eraseEvent(ev.id); if (this.parallel) this.done = true; return false;
                case 'switch': {
                    const ids = c.to && c.to > c.id ? range(c.id, c.to) : [c.id];
                    for (const id of ids) {
                        const v = c.value === 'toggle' ? !st.sw(id) : c.value !== 'off' && c.value !== false;
                        st.setSw(id, v);
                        g.hook('switch', { id, value: v });
                    }
                    g.refresh();
                    return false;
                }
                case 'var': {
                    let val;
                    if (c.src === 'var') val = st.v(c.value);
                    else if (c.src === 'rand') { const lo = Math.min(c.value | 0, c.max | 0), hi = Math.max(c.value | 0, c.max | 0); val = lo + Math.floor(g.random() * (hi - lo + 1)); }
                    else val = c.value | 0;
                    const cur = st.v(c.id);
                    let out = val;
                    switch (c.op) {
                        case 'add': out = cur + val; break;
                        case 'sub': out = cur - val; break;
                        case 'mul': out = cur * val; break;
                        case 'div': out = val ? Math.trunc(cur / val) : cur; break;
                        case 'mod': out = val ? cur % val : cur; break;
                    }
                    st.setV(c.id, out);
                    g.hook('variable', { id: c.id, value: st.v(c.id) });
                    g.refresh();
                    return false;
                }
                case 'self': if (ev) { st.setSelf(g.mapId(), ev.id, c.key || 'A', c.value !== false && c.value !== 'off'); g.refresh(); } return false;
                case 'gold': st.gainGold(c.amount | 0); g.hook('gold', { amount: c.amount | 0 }); return false;
                case 'item': {
                    const n = st.gainItem(c.item, c.amount | 0);
                    if (n > 0) g.hook('item', { id: c.item, n });
                    g.refresh();
                    return false;
                }
                case 'party': {
                    if (c.op === 'remove') st.removeActor(c.actor); else st.addActor(c.actor);
                    g.hook('party', { actor: c.actor, op: c.op || 'add' });
                    g.refresh();
                    return false;
                }
                case 'exp': {
                    const who = c.actor ? st.party.filter((a) => a.id === c.actor) : st.party;
                    let ups = [];
                    for (const a of who) ups = ups.concat(st.gainExp(a, c.amount | 0));
                    for (const u of ups) g.hook('levelUp', { actor: u.actor.id, level: u.level });
                    if (ups.length && g.ui.levelUps) { this.handle = g.ui.levelUps(ups); return true; }
                    return false;
                }
                case 'heal': st.recoverAll(); return false;
                case 'transfer': {
                    if (!U.byId(g.project.maps, c.map)) return false;
                    this.handle = g.transfer(c.map, c.x | 0, c.y | 0, c.dir || 0, c.fade !== false);
                    return true;
                }
                case 'route': {
                    if (!g.map) return false;
                    const target = c.target === 'this' ? (ev ? ev.id : 'player') : c.target || 'player';
                    const h = g.map.setRoute(target, c.steps || []);
                    if (c.wait !== false && h) { this.handle = h; return true; }
                    return false;
                }
                case 'battle': {
                    if (!st.troopDb(c.troop)) return false;
                    this.handle = g.startBattle(c.troop, { escape: c.escape !== false, canLose: c.lose === 'continue' });
                    this.handle.kind = 'battle'; this.handle.cmd = c;
                    return true;
                }
                case 'shop': this.handle = g.shop((c.goods || []).filter((id) => st.itemDb(id))); return true;
                case 'gameover': g.gameOver(); this.done = true; return true;
                case 'end': g.theEnd(c.text || ''); this.done = true; return true;
                case 'fadeout': this.handle = g.screen.fade(1, c.sec === undefined ? 0.5 : +c.sec); return true;
                case 'fadein': this.handle = g.screen.fade(0, c.sec === undefined ? 0.5 : +c.sec); return true;
                case 'flash': g.screen.flash(c.color || '#ffffff', c.sec === undefined ? 0.4 : +c.sec); return false;
                case 'shake': g.screen.shake(c.power || 4, c.sec === undefined ? 0.6 : +c.sec); g.hook('shake', {}); return false;
                case 'tint': g.screen.tint(c.color || '#00000000', c.sec === undefined ? 1 : +c.sec); return false;
                case 'sfx': if (g.sfx) g.sfx(c.name); return false;
                case 'bgm': if (g.bgm) g.bgm(c.name); return false;
                case 'comment': return false;
                default: return false;
            }
        }

        peek() {
            const fr = this.stack[this.stack.length - 1];
            return fr && fr.list[fr.i];
        }
    }

    function range(a, b) { const out = []; for (let i = a; i <= b && out.length < 100; i++) out.push(i); return out; }

    /** The active page of an event: the last page whose conditions all hold. */
    function activePage(game, mapId, ev) {
        const st = game.state;
        const pages = ev.pages || [];
        for (let i = pages.length - 1; i >= 0; i--) {
            const c = pages[i].cond || {};
            if (c.sw1 && !st.sw(c.sw1)) continue;
            if (c.sw2 && !st.sw(c.sw2)) continue;
            if (c.var && !compare(st.v(c.var), c.varOp || '>=', c.varVal | 0)) continue;
            if (c.item && !st.has(c.item)) continue;
            if (c.actor && !st.inParty(c.actor)) continue;
            if (c.self && !st.selfSw(mapId, ev.id, c.self)) continue;
            return pages[i];
        }
        return null;
    }

    TW.Interpreter = Interpreter;
    TW.activePage = activePage;
    TW.testCond = test;
}]);
