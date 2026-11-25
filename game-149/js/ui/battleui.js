// The battle HUD: party and foe bars, the command menu (Strike, Skills, Items, Defend), target picking, Auto, and the
// victory / defeat card. Reads G.battle; commands go through send().

import { SKILLS, ITEMS, HEROES, ICON } from '../sim/data.js';
import { canUse, skillCost, echoTarget } from '../sim/battle.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BATTLE_ITEMS = ['healing', 'candy', 'mana', 'tart', 'chime', 'phoenix'];

export class BattleUI {
    constructor({ audio, send }) {
        this.audio = audio;
        this.send = send;
        this.sub = null;              // null | 'skills' | 'items' | { pick: cmd }
        this.turnKey = null;
        $('b-main').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-cmd]');
            if (!b || b.disabled) return;
            audio.ui('click');
            const c = b.dataset.cmd;
            if (c === 'attack') this.pickTarget({ t: 'attack' }, 'foe');
            else if (c === 'defend') this.send({ t: 'defend' });
            else { this.sub = c; this.renderSub(); }
        });
        $('b-sub').addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b || b.disabled) return;
            audio.ui('click');
            if (b.dataset.back) { this.sub = null; this.renderSub(); return; }
            if (b.dataset.skill) {
                const sk = SKILLS[b.dataset.skill];
                const tgt = b.dataset.skill === 'echo' ? SKILLS[echoTarget(this.G.battle)].target : sk.target;
                if (tgt === 'foe') this.pickTarget({ t: 'skill', id: b.dataset.skill }, 'foe');
                else this.send({ t: 'skill', id: b.dataset.skill });
                return;
            }
            if (b.dataset.item) {
                const it = ITEMS[b.dataset.item];
                if (it.kind === 'healall' || it.kind === 'mpall') this.send({ t: 'item', item: b.dataset.item });
                else this.pickTarget({ t: 'item', item: b.dataset.item }, it.kind === 'revive' ? 'down' : 'ally');
                return;
            }
            if (b.dataset.target) this.send({ ...this.sub.pick, target: b.dataset.target });
        });
        $('b-auto').addEventListener('click', () => { const on = $('b-auto').getAttribute('aria-pressed') !== 'true'; this.send({ t: 'auto', on }); });
        $('b-end-foot').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-end]');
            if (!b) return;
            audio.ui('click');
            this.send({ t: b.dataset.end });
        });
    }

    pickTarget(cmd, kind) {
        const B = this.G.battle;
        const list = B.actors.filter((a) => (kind === 'foe' ? a.side === 'foe' && a.alive : kind === 'down' ? a.side === 'hero' && !a.alive : a.side === 'hero' && a.alive));
        if (list.length === 1 && kind === 'foe') { this.send({ ...cmd, target: list[0].id }); return; }
        this.sub = { pick: cmd, list: list.map((a) => a.id) };
        this.renderSub();
    }

    show(on) {
        $('battle-ui').hidden = !on;
        if (!on) { $('b-end').hidden = true; this.sub = null; this.turnKey = null; }
    }

    render(G, busy) {
        this.G = G;
        const B = G.battle;
        if (!B) return;
        const cur = B.actors[B.cur];
        // bars
        $('b-party').innerHTML = B.actors.filter((a) => a.side === 'hero').map((a) => `<div class="hero-row${a.alive ? '' : ' down'}${B.phase === 'cmd' && cur === a ? ' now' : ''}">${esc(a.name)} <span class="nums">${a.hp}/${a.mhp} · ${a.mp} MP</span><div class="bar"><i style="width:${(100 * a.hp / a.mhp).toFixed(1)}%"></i></div><div class="bar mp"><i style="width:${a.mmp ? (100 * a.mp / a.mmp).toFixed(1) : 0}%"></i></div></div>`).join('');
        $('b-foes').innerHTML = B.actors.filter((a) => a.side === 'foe').map((a) => `<div class="foe-row${a.alive ? '' : ' down'}">${esc(a.name)} <span class="nums">Lv ${a.lv}</span><div class="bar foe"><i style="width:${(100 * a.hp / a.mhp).toFixed(1)}%"></i></div></div>`).join('');
        $('b-auto').setAttribute('aria-pressed', String(!!G.auto));
        // whose turn
        const myTurn = B.phase === 'cmd' && !busy;
        $('b-turn').textContent = myTurn ? `${cur.name}'s turn` : B.phase === 'won' || B.phase === 'lost' ? '' : '';
        $('b-menu').hidden = !myTurn;
        if (myTurn) {
            const key = B.turn + ':' + cur.id;
            if (key !== this.turnKey) {
                this.turnKey = key;
                this.sub = null;
                this.renderSub();
                $('b-main').querySelector('button')?.focus({ preventScroll: true });
            }
            const skills = HEROES[cur.kind]?.skills || [];
            $('b-main').querySelector('[data-cmd="skills"]').disabled = !skills.some((s) => canUse(G, B, cur, s));
            $('b-main').querySelector('[data-cmd="items"]').disabled = !BATTLE_ITEMS.some((i) => G.inv[i] > 0);
        }
        // the end card
        const end = (B.phase === 'won' || B.phase === 'lost') && !busy;
        $('b-end').hidden = !end;
        if (end && $('b-end').dataset.k !== B.phase + B.turn) {
            $('b-end').dataset.k = B.phase + B.turn;
            if (B.phase === 'won') {
                $('b-end-title').textContent = '✦ Victory! ✦';
                $('b-end-text').textContent = `+${B.result.xp} XP for everyone · +${B.result.lumens} lumens`;
                $('b-end-foot').innerHTML = '<button class="btn primary" data-end="battleDone">Continue</button>';
            } else {
                $('b-end-title').textContent = 'Knocked out…';
                $('b-end-text').textContent = B.optional ? 'Everyone is fine, just a little dizzy. Try again, or call it a day.' : 'Don\'t give up! Your friends are right here. (Each retry, the enemy\'s stolen magic wears a little thinner.)';
                $('b-end-foot').innerHTML = (B.optional ? '<button class="btn" data-end="leave">Call it a day</button>' : '') + '<button class="btn primary" data-end="retry">Try again</button>';
            }
            $('b-end-foot').querySelector('.primary')?.focus({ preventScroll: true });
        }
    }

    renderSub() {
        const G = this.G, B = G.battle, cur = B.actors[B.cur];
        const sub = $('b-sub'), main = $('b-main');
        if (!this.sub) { sub.hidden = true; main.hidden = false; return; }
        main.hidden = true; sub.hidden = false;
        let html = '';
        if (this.sub === 'skills') {
            for (const id of HEROES[cur.kind].skills) {
                const sk = SKILLS[id], cost = skillCost(G, cur, id);
                let desc = sk.desc || '';
                if (id === 'echo') { const e = echoTarget(B); desc = e === 'sonic' ? 'Nothing to copy yet: a sonic burst.' : `Echo ${SKILLS[e].name} at 125%!`; }
                html += `<button class="cmd" data-skill="${id}" ${canUse(G, B, cur, id) ? '' : 'disabled'}>${sk.name} <span class="nums">${cost} MP</span><small>${esc(desc)}</small></button>`;
            }
        } else if (this.sub === 'items') {
            for (const id of BATTLE_ITEMS) if (G.inv[id] > 0) html += `<button class="cmd" data-item="${id}"><img src="art/icons/${ICON[id]}.webp" alt="" width="22" height="22" style="vertical-align:middle"> ${ITEMS[id].name} ×${G.inv[id]}<small>${esc(ITEMS[id].desc)}</small></button>`;
        } else if (this.sub.pick) {
            for (const id of this.sub.list) {
                const a = B.actors.find((x) => x.id === id);
                html += `<button class="cmd" data-target="${id}">${esc(a.name)} <span class="nums">${a.hp}/${a.mhp}</span></button>`;
            }
        }
        html += '<button class="cmd" data-back="1">↩ Back</button>';
        sub.innerHTML = html;
        sub.querySelector('button')?.focus({ preventScroll: true });
    }

    /** Escape / B: back out of a submenu. */
    back() {
        if (!this.sub || $('b-menu').hidden) return false;
        this.sub = null; this.renderSub();
        $('b-main').querySelector('button')?.focus({ preventScroll: true });
        return true;
    }
}
