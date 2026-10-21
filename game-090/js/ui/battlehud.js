// The battle interface: the Press Turn icon bar, a marker over every foe (name, health, what you
// know of its weaknesses), the party cards, the command menus, the target picker and the recoding
// terminal. It keeps its own picture of the battle that the events update as they play, so what
// is on screen is what the animation has shown so far, not the sim's final state.

import { h, $, clear, bar, elChip, affRow, skillTag, skillCost, portraitImg } from './dom.js';
import { SKILLS } from '../sim/data/skills.js';
import { ITEMS } from '../sim/data/items.js';
import { DAEMONS, PERSONALITIES, SCRIPTS, SCRIPT_INFO, RAPPORT } from '../sim/data/daemons.js';
import { usable, recodeInfo, alive } from '../sim/battle.js';
import { bestScript } from '../sim/recode.js';
import { TIDES, tideOf, EL } from '../config.js';

export class BattleHud {
    constructor(ui) {
        this.ui = ui;
        this.units = new Map();
        this.icons = { f: 0, h: 0 };
        this.side = 'p';
        this.round = 1;
        this.marks = new Map();
        this.cmd = { mode: 'root' };
        this.targeting = null;
        this.key = '';
        this.dirtyCards = true;
        this.line = null;
        $('target-cancel').addEventListener('click', () => this.cancelTarget());
    }

    reset() { this.units.clear(); this.marks.clear(); clear($('markers')); clear($('party-cards')); clear($('icons')); this.cmd = { mode: 'root' }; this.targeting = null; this.key = ''; this.dirtyCards = true; clear($('cmd')); $('cmd').hidden = true; $('bt-log').replaceChildren(); this.hideRecode(); }

    // ------------------------------------------------------------ display state from events
    get B() { return this.ui.G.battle; }
    unit(id) { return this.units.get(id); }

    onEvent(e, G) {
        const U = (id) => this.units.get(id);
        switch (e.type) {
            case 'b_start':
                this.reset();
                for (const u of e.units) this.units.set(u.id, { ...u, ail: null, buff: { atk: 0, def: 0, agi: 0 } });
                this.round = 1; this.dirtyCards = true;
                if (e.kind === 'boss' || e.kind === 'final') this.ui.banner(e.kind === 'final' ? 'MERIDIAN' : 'BOSS BATTLE', e.kind === 'final' ? 'the lattice wakes' : 'no running from this');
                else if (e.ambush === 'player') this.ui.banner('AMBUSH', 'the Hexes are caught flat');
                else if (e.ambush === 'enemy') this.ui.banner('AMBUSHED', 'they struck first');
                break;
            case 'b_phase': this.side = e.side; this.round = e.round; this.setIcons(e.icons, true); $('turn-side').textContent = e.side === 'p' ? 'YOUR TURN' : 'ENEMY TURN'; $('turnbar').classList.toggle('foe', e.side !== 'p'); $('bt-round').textContent = 'R' + e.round; break;
            case 'b_icons': this.setIcons(e.icons); break;
            case 'b_act': { const a = U(e.actor); if (a) { const s = SKILLS[e.skill]; this.log(`${a.name} ${e.skill === 'attack' ? 'attacks' : e.kind === 'item' ? 'uses ' + e.name : 'uses ' + e.name}`, a.side); } break; }
            case 'b_hit': { const t = U(e.id); if (t && e.hp != null) { t.hp = e.hp; if (e.killed) { t.alive = false; } } if (t && t.side === 'e' && e.el && e.el !== 'root') { /* the marker re-reads the dex */ } this.dirtyCards = true; break; }
            case 'b_heal': { const t = U(e.id); if (t) t.hp = e.hp; this.dirtyCards = true; break; }
            case 'b_cost': { const t = U(e.id); if (t) t.hp = e.hp; this.dirtyCards = true; break; }
            case 'b_dot': { const t = U(e.id); if (t) t.hp = e.hp; this.dirtyCards = true; break; }
            case 'b_mp': { const t = U(e.id); if (t) t.mp = e.mp; this.dirtyCards = true; break; }
            case 'b_dead': { const t = U(e.id); if (t) { t.alive = false; t.hp = 0; t.down = false; t.ail = null; } this.dirtyCards = true; break; }
            case 'b_revive': { const t = U(e.id); if (t) { t.alive = true; t.hp = e.hp; t.down = false; } this.dirtyCards = true; break; }
            case 'b_down': { const t = U(e.id); if (t) t.down = true; this.dirtyCards = true; break; }
            case 'b_stand': { const t = U(e.id); if (t) t.down = false; this.dirtyCards = true; break; }
            case 'b_ail': { const t = U(e.id); if (t) t.ail = e.k; this.dirtyCards = true; break; }
            case 'b_ailend': { const t = U(e.id); if (t) t.ail = null; this.dirtyCards = true; break; }
            case 'b_buff': { const t = U(e.id); if (t) { if (e.stat === 'all') t.buff = { atk: 0, def: 0, agi: 0 }; else t.buff[e.stat] = e.stage; } this.dirtyCards = true; break; }
            case 'b_swap': this.units.set(e.id, { ...e.unit, ail: null, buff: { atk: 0, def: 0, agi: 0 } }); this.dirtyCards = true; break;
            case 'b_join': this.units.set(e.unit.id, { ...e.unit, ail: null, buff: { atk: 0, def: 0, agi: 0 } }); this.log(`${e.unit.name} joins the fight!`, 'e'); break;
            case 'b_recoded': { const t = U(e.id); if (t) t.alive = false; this.ui.banner('RECODED', e.name); this.log(`${e.name} accepts the patch and joins you!`, 'p'); break; }
            case 'b_flee': { const t = U(e.id); if (t) t.alive = false; this.log(`${t ? t.name : 'It'} loses interest and wanders off.`, 'e'); break; }
            case 'b_skip': { const t = U(e.id); if (t) this.log(`${t.name} is lagging and loses the turn.`, t.side); break; }
            case 'b_rage': { const t = U(e.id); if (t) { this.ui.splash(t.name, 'ENRAGED'); } break; }
            case 'b_allout': this.ui.splash('ALL-OUT ATTACK', 'everyone, together'); break;
            case 'b_msg': this.log(e.text, 'p'); break;
            case 'b_wave': this.ui.banner('IT WAKES', e.text || ''); break;
            case 'b_scan': { const t = U(e.id); if (t) this.log(`Scanned ${t.name}: affinities and temper revealed.`, 'p'); break; }
            case 'b_neg': this.negEvent(e); break;
            case 'b_end': this.ui.battleEnd(e); this.cmd = { mode: 'root' }; this.hideCmd(); this.hideRecode(); break;
            default: break;
        }
    }

    setIcons(ic, fresh = false) {
        const cur = this.icons;
        this.icons = { f: ic.f, h: ic.h };
        const wrap = $('icons');
        clear(wrap);
        for (let i = 0; i < ic.f; i++) wrap.append(h('span.pt'));
        for (let i = 0; i < ic.h; i++) wrap.append(h('span.pt.half'));
        if (!fresh && cur.f + cur.h * 0.5 > ic.f + ic.h * 0.5) this.ui.audio.ok && this.ui.audio.tone?.({ f: 700, to: 500, dur: 0.08, vol: 0.05, type: 'triangle' });
    }

    log(text, side) {
        const el = h('div', { text, style: side === 'e' ? 'box-shadow: inset 2px 0 0 #ff4ad8' : '' });
        const log = $('bt-log');
        log.append(el);
        while (log.children.length > 4) log.firstChild.remove();
        setTimeout(() => el.remove(), 4200);
    }

    /** From the sim, when nothing is animating: make the picture exact. */
    sync(G) {
        const B = G.battle;
        if (!B) return;
        for (const u of B.units) {
            const d = this.units.get(u.id) || {};
            this.units.set(u.id, { ...d, id: u.id, side: u.side, sp: u.sp, name: u.name, lv: u.lv, hp: u.hp, maxhp: u.maxhp, mp: u.mp, maxmp: u.maxmp, boss: u.boss, elite: u.elite, alive: u.alive && !u.recoded && !u.fled, down: u.down, agent: u.agent, ail: u.ail ? u.ail.k : null, buff: { ...u.buff } });
        }
        this.setIcons(B.icons);
        this.side = B.phase;
        $('turn-side').textContent = B.phase === 'p' ? 'YOUR TURN' : 'ENEMY TURN';
        $('turnbar').classList.toggle('foe', B.phase !== 'p');
        $('bt-round').textContent = 'R' + B.round;
        this.dirtyCards = true;
    }

    // ------------------------------------------------------------ per-frame: markers and cards
    frame(G) {
        const B = G.battle;
        const w = this.ui.view.stage.w, hgt = this.ui.view.stage.h;
        const bv = this.ui.view.battle;
        const wrap = $('markers');
        for (const u of this.units.values()) {
            if (u.side !== 'e') continue;
            let m = this.marks.get(u.id);
            if (!m) {
                m = { el: h('div.mk', h('div.nm'), h('div.hpb'), h('div.aff'), h('div.ail')), lastKey: '' };
                m.el.append(h('div.hit'));
                m.el.addEventListener('click', () => { if (this.targeting && this.targeting.side === 'e' && m.el.classList.contains('pick')) this.targeting.pick(u.id); });
                wrap.append(m.el);
                this.marks.set(u.id, m);
            }
            const p = bv.project(u.id, w, hgt, 1.15);
            const dead = !u.alive;
            m.el.classList.toggle('dead', dead);
            m.el.classList.toggle('down', !!u.down && !dead);
            if (p && p.visible && !dead) {
                m.el.style.left = p.x + 'px'; m.el.style.top = p.y + 'px';
                const k = `${u.hp}|${u.maxhp}|${u.ail}|${u.down}|${u.lv}|${JSON.stringify(G.dex[u.sp]?.aff)}|${G.dex[u.sp]?.scanned}`;
                if (k !== m.lastKey) {
                    m.lastKey = k;
                    m.el.querySelector('.nm').replaceChildren(...(u.boss ? [h('i', { text: '★' })] : u.elite ? [h('i', { text: '◆' })] : []), `${u.name} `, h('span', { text: `Lv${u.lv}`, style: 'color:var(--gold);font-weight:600' }));
                    m.el.querySelector('.hpb').replaceChildren(bar(u.hp / u.maxhp));
                    m.el.querySelector('.aff').replaceChildren(...this.affChips(G, u));
                    m.el.querySelector('.ail').textContent = u.ail ? u.ail.toUpperCase() : '';
                }
                m.el.style.display = '';
            } else m.el.style.display = dead ? 'none' : 'none';
        }
        if (this.dirtyCards) { this.dirtyCards = false; this.renderCards(G); }
    }

    affChips(G, u) {
        const sp = DAEMONS[u.sp];
        const dex = G.dex[u.sp];
        const out = [];
        const any = !!dex && (dex.scanned || Object.keys(dex.aff).length);
        if (!any) return [h('span.chip.unk', { text: 'AFFINITY ???' })];
        for (const el of ['strike', 'gun', 'pyre', 'rime', 'volt', 'gale', 'lumen', 'hex']) {
            const known = !!(dex && (dex.aff[el] || dex.scanned));
            const k = sp.aff[el];
            if (known && k) {
                const col = { w: '#ffd86a', r: '#8fb0c0', n: '#cfe8ff', d: '#9dffb0', p: '#ff7ae0' }[k];
                out.push(h('span.chip' + (k === 'w' ? '.w' : ''), { text: EL[el].tag + k.toUpperCase(), style: `color:${col};background:${col}22` }));
            } else if (!known) out.push(h('span.chip.unk', { text: '?' }));
        }
        return out.slice(0, 8);
    }

    renderCards(G) {
        const B = G.battle;
        const wrap = $('party-cards');
        clear(wrap);
        const party = [...this.units.values()].filter((u) => u.side === 'p').sort((a, b) => a.id - b.id);
        for (const u of party) {
            const act = B && B.phase === 'p' && B.actor === u.id && !this.ui.view.busy;
            const buffs = ['atk', 'def', 'agi'].map((k, i) => (u.buff[k] ? `${u.buff[k] > 0 ? '▲' : '▼'}${'ADS'[i]}` : '')).filter(Boolean).join(' ');
            const card = h('div.pcard' + (act ? '.act' : '') + (u.alive ? '' : '.dead'), { 'data-id': u.id, onclick: () => { if (this.targeting && this.targeting.side === 'p') this.targeting.pick(u.id); } },
                h('div.badges', h('div', { text: u.down ? 'DOWN' : '' }), h('div', { text: u.ail ? u.ail.toUpperCase() : '' })),
                h('div.top', this.cardPortrait(u), h('div', h('div.nm', { text: u.name }), h('div.lv', { text: `Lv ${u.lv}` }))),
                bar(u.hp / u.maxhp), bar(u.mp / Math.max(1, u.maxmp), 'mp'),
                h('div.num', h('span', { text: `${Math.max(0, u.hp)}` }), h('span', { text: `${u.mp}MP` })),
                h('div.buffs', { text: buffs }));
            if (this.targeting && this.targeting.side === 'p' && this.targeting.filter(u)) { card.style.boxShadow = 'inset 0 0 0 2px var(--accent)'; card.style.cursor = 'pointer'; }
            wrap.append(card);
        }
    }

    cardPortrait(u) {
        const v = this.ui.view;
        if (u.agent) return portraitImg(`pc:agent:${this.ui.G.look || 0}`, () => v.portraits.person('agent', 'neutral', this.ui.G.look || 0));
        return portraitImg(`pc:${u.sp}`, () => v.portraits.daemon(u.sp, 80, 100));
    }

    // ------------------------------------------------------------ commands
    hideCmd() { const c = $('cmd'); c.hidden = true; clear(c); $('target-bar').hidden = true; }

    present(G) {
        const B = G.battle;
        if (!B || B.result) return;
        const k = `${B.phase}:${B.actor}:${B.round}:${B.icons.f}.${B.icons.h}:${B.allOut}:${B.neg ? `${B.neg.rapport}.${B.neg.tries}.${JSON.stringify(B.neg.demand)}` : ''}:${this.cmd.mode}:${this.targeting ? 't' : ''}:${G.items.patch}`;
        if (k === this.key) return;
        this.key = k;
        this.dirtyCards = true;
        if (B.neg) { this.hideCmd(); this.showRecode(G); return; }
        this.hideRecode();
        if (B.phase !== 'p' || B.actor < 0) { this.hideCmd(); return; }
        if (this.targeting) return;
        if (this.cmd.mode === 'root') this.showRoot(G);
        else if (this.cmd.mode === 'skill') this.showSkills(G);
        else if (this.cmd.mode === 'item') this.showItems(G);
        else if (this.cmd.mode === 'swap') this.showSwap(G);
    }

    refresh() { this.key = ''; }

    run(cmd) {
        this.cancelTarget();
        const err = this.ui.doAct(cmd);
        this.cmd = { mode: 'root' };
        this.refresh();
        return err;
    }

    showRoot(G) {
        const B = G.battle, a = B.units[B.actor];
        const c = $('cmd'); clear(c); c.className = 'cmd'; c.hidden = false;
        c.append(h('div.actor', { text: a.name }));
        const btn = (label, small, fn, cls = '') => c.append(h('button.btn' + cls, { onclick: () => { this.ui.audio.ui('click'); fn(); } }, h('span', { text: label }), small ? h('small', { text: small }) : null));
        if (B.allOut) btn('ALL-OUT', '全', () => this.run({ kind: 'allout' }), '.primary');
        btn('Attack', '', () => this.pickFoe('Choose a target', (id) => this.run({ kind: 'attack', target: id })));
        btn('Skill', '', () => { this.cmd = { mode: 'skill' }; this.refresh(); });
        btn('Item', '', () => { this.cmd = { mode: 'item' }; this.refresh(); });
        btn('Recode', '', () => this.pickFoe('Choose a Hex to recode', (id) => { this.run({ kind: 'recode', target: id }); }, (u) => { const info = recodeInfo(G, B, B.units[u.id]); return info.ok ? '' : info.why; }));
        btn('Guard', '', () => this.run({ kind: 'guard' }));
        if (G.stock.length > G.party.length) btn('Swap', '', () => { this.cmd = { mode: 'swap' }; this.refresh(); });
        if (B.canFlee) btn('Run', '', () => this.run({ kind: 'flee' }));
        c.querySelector('button')?.focus({ preventScroll: true });
    }

    back(G) { this.cmd = { mode: 'root' }; this.cancelTarget(); this.refresh(); }

    showSkills(G) {
        const B = G.battle, a = B.units[B.actor];
        const c = $('cmd'); clear(c); c.className = 'cmd list'; c.hidden = false;
        c.append(h('div.actor', { text: `${a.name} · skills` }));
        const ids = a.skills.filter((id) => SKILLS[id].kind !== 'pass');
        if (!ids.length) c.append(h('div', { text: 'No skills yet.', style: 'padding:8px;color:var(--dim)' }));
        for (const id of ids) {
            const sk = SKILLS[id];
            const why = usable(B, a, sk);
            const b = h('button.btn.sk' + (sk.hp ? '.hp' : ''), { disabled: !!why, title: why, onclick: () => { this.ui.audio.ui('click'); this.useSkill(G, a, sk); } },
                skillTag(sk), h('span', { text: sk.name }), h('span.cost', { text: skillCost(sk) }), h('span.desc', { text: why ? `(${why}) ${sk.desc}` : sk.desc }));
            c.append(b);
        }
        c.append(h('button.btn.mini', { text: '‹ Back', onclick: () => this.back(G) }));
        c.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    }

    useSkill(G, a, sk) {
        const B = G.battle;
        if (sk.tgt === 'one') return this.pickFoe(`${sk.name}: choose a target`, (id) => this.run({ kind: 'skill', skill: sk.id, target: id }), null, sk);
        if (sk.tgt === 'ally') {
            const dead = sk.kind === 'revive';
            return this.pickAlly(`${sk.name}: choose an ally`, (u) => (dead ? !u.alive : u.alive), (id) => this.run({ kind: 'skill', skill: sk.id, target: id }));
        }
        return this.run({ kind: 'skill', skill: sk.id, target: a.id });
    }

    showItems(G) {
        const c = $('cmd'); clear(c); c.className = 'cmd list'; c.hidden = false;
        c.append(h('div.actor', { text: 'Items' }));
        const list = Object.keys(G.items).filter((id) => G.items[id] > 0 && ITEMS[id] && ITEMS[id].use !== 'field' && !['chip', 'seed', 'gift', 'key'].includes(ITEMS[id].kind));
        if (!list.length) c.append(h('div', { text: 'Nothing to use.', style: 'padding:8px;color:var(--dim)' }));
        for (const id of list) {
            const it = ITEMS[id];
            c.append(h('button.btn.sk', { onclick: () => { this.ui.audio.ui('click'); this.useItem(G, it); } }, h('span.chip', { text: 'ITEM' }), h('span', { text: it.name }), h('span.cost', { text: `×${G.items[id]}` }), h('span.desc', { text: it.desc })));
        }
        c.append(h('button.btn.mini', { text: '‹ Back', onclick: () => this.back(G) }));
        c.querySelector('button')?.focus({ preventScroll: true });
    }

    useItem(G, it) {
        if (it.kind === 'heal' || it.kind === 'mp' || it.kind === 'cure') return this.pickAlly(`${it.name}: choose an ally`, (u) => u.alive, (id) => this.run({ kind: 'item', item: it.id, target: id }));
        if (it.kind === 'revive') return this.pickAlly(`${it.name}: choose a fallen ally`, (u) => !u.alive, (id) => this.run({ kind: 'item', item: it.id, target: id }));
        return this.run({ kind: 'item', item: it.id, target: -1 });
    }

    showSwap(G) {
        const c = $('cmd'); clear(c); c.className = 'cmd list'; c.hidden = false;
        c.append(h('div.actor', { text: 'Swap in' }));
        const v = this.ui.view;
        for (const u of G.stock.filter((x) => !G.party.includes(x.uid))) {
            c.append(h('button.btn.sk' + (u.hp <= 0 ? '' : ''), { disabled: u.hp <= 0, onclick: () => { this.ui.audio.ui('click'); this.pickAlly(`Replace which daemon with ${u.name}?`, (x) => !x.agent, (id) => this.run({ kind: 'swap', out: id, uid: u.uid })); } },
                portraitImg(`pc:${u.sp}`, () => v.portraits.daemon(u.sp, 80, 100)), h('span', { text: `${u.name} Lv${u.lv}` }), h('span.cost', { text: u.hp <= 0 ? 'FALLEN' : `${u.hp}hp` })));
        }
        c.append(h('button.btn.mini', { text: '‹ Back', onclick: () => this.back(G) }));
    }

    // ------------------------------------------------------------ targets
    foesAlive() { return [...this.units.values()].filter((u) => u.side === 'e' && u.alive); }

    pickFoe(label, done, why = null, skill = null) {
        const foes = this.foesAlive();
        if (foes.length === 1 && !why) { done(foes[0].id); return; }
        this.startTarget({ side: 'e', label, filter: (u) => u.alive, pick: (id) => { const u = this.units.get(id); const r = why ? why(u) : ''; if (r) { this.ui.toast(r[0].toUpperCase() + r.slice(1) + '.'); this.ui.audio.ui('error'); return; } this.cancelTarget(); done(id); }, skill });
    }
    pickAlly(label, filter, done) {
        this.startTarget({ side: 'p', label, filter, pick: (id) => { this.cancelTarget(); done(id); } });
    }
    startTarget(t) {
        this.targeting = t;
        this.targetList = [...this.units.values()].filter((u) => u.side === t.side && t.filter(u)).map((u) => u.id);
        this.tIndex = 0;
        $('cmd').hidden = true;
        $('target-bar').hidden = false;
        $('target-text').textContent = t.label;
        for (const [id, m] of this.marks) { const u = this.units.get(id); m.el.classList.toggle('pick', t.side === 'e' && !!u && u.alive); }
        this.markCurrent();
        this.dirtyCards = true;
        // a weakness hint for the skill being aimed
        if (t.skill && t.skill.el && t.skill.el !== 'root') this.hintWeakness(t.skill.el);
    }
    hintWeakness(el) {
        for (const [id, m] of this.marks) {
            const u = this.units.get(id), sp = u && DAEMONS[u.sp];
            const known = !!(sp && (this.ui.G.dex[u.sp]?.aff[el] || this.ui.G.dex[u.sp]?.scanned));
            if (known && sp.aff[el] === 'w') m.el.querySelector('.nm').append(h('b', { text: ' WEAK', style: 'color:var(--gold)' }));
        }
    }
    markCurrent() {
        const t = this.targeting;
        if (!t) return;
        const id = this.targetList[this.tIndex];
        this.ui.view.battle.markTargets(id != null ? [id] : [], t.side === 'e' ? '#ff4a6a' : '#7affd0');
        for (const [mid, m] of this.marks) m.el.classList.toggle('sel', mid === id);
    }
    cancelTarget() {
        if (!this.targeting) return;
        this.targeting = null;
        $('target-bar').hidden = true;
        for (const m of this.marks.values()) { m.el.classList.remove('pick', 'sel'); }
        this.ui.view.battle.markTargets([]);
        this.dirtyCards = true;
        this.refresh();
    }

    /** Keyboard in battle. Returns true if the key was used. */
    key_(k, G) {
        if (this.targeting) {
            const n = this.targetList.length;
            if (k === 'ArrowLeft' || k === 'ArrowUp') { this.tIndex = (this.tIndex + n - 1) % n; this.markCurrent(); return true; }
            if (k === 'ArrowRight' || k === 'ArrowDown') { this.tIndex = (this.tIndex + 1) % n; this.markCurrent(); return true; }
            if (k === 'Enter' || k === 'Space') { this.targeting.pick(this.targetList[this.tIndex]); return true; }
            if (k === 'Escape') { this.cancelTarget(); return true; }
            return true;
        }
        if (k === 'Escape') { if (this.cmd.mode !== 'root') { this.back(G); return true; } }
        return false;
    }

    // ------------------------------------------------------------ recoding terminal
    hideRecode() { document.querySelector('.recode')?.remove(); }

    negEvent(e) {
        // while the terminal is up, its line follows the events
        this.line = e.neg.line;
        if (e.neg.ended) { this.hideRecode(); }
    }

    showRecode(G) {
        const B = G.battle, neg = B.neg;
        const t = B.units[neg.tid];
        const dex = G.dex[t.sp];
        const pers = PERSONALITIES[neg.pers];
        const known = !!dex.pers;
        let wrap = document.querySelector('.recode');
        if (wrap) wrap.remove();
        wrap = h('div.recode');
        const term = h('div.term');
        const v = this.ui.view;
        const need = neg.need;
        const rap = h('div.rapport');
        for (let i = 0; i < need; i++) rap.append(h('i' + (neg.rapport > i ? '.on' : '')));
        if (neg.rapport < 0) rap.append(...Array.from({ length: -neg.rapport }, () => h('i.neg')));
        const pat = h('div.patience', h('span', { text: 'PATIENCE' }), ...Array.from({ length: neg.patience }, (_, i) => h('b' + (i < neg.tries ? '.used' : ''))));
        term.append(
            h('h4', { text: `// RECODE  ${t.name.toUpperCase()}  Lv${t.lv}` }),
            h('div.who', portraitImg(`pd:${t.sp}`, () => v.portraits.daemon(t.sp, 80, 100), 'pf'), h('div', h('div', { text: known ? `Temper: ${pers.name}` : 'Temper: ???', style: 'color:var(--gold);font-size:12px;letter-spacing:0.12em' }), rap, pat)),
            h('div.line', { text: neg.line }),
        );
        if (neg.demand) {
            const d = neg.demand;
            const can = d.kind === 'item' ? (G.items[d.id] || 0) > 0 : d.kind === 'scrap' ? G.scrap >= d.n : d.kind === 'hp' ? B.units.find((u) => u.agent).hp > Math.ceil(B.units.find((u) => u.agent).maxhp * d.n / 100) : B.units.find((u) => u.agent).mp >= d.n;
            term.append(h('div.scripts',
                h('button.btn', { disabled: !can, onclick: () => this.neg({ op: 'accept' }) }, h('span', { text: 'Give it' }), h('small', { text: d.kind === 'item' ? `${ITEMS[d.id].name} (you have ${G.items[d.id] || 0})` : d.kind === 'scrap' ? `${d.n} Scrap` : d.kind === 'hp' ? `${d.n}% of your HP` : `${d.n} MP` })),
                h('button.btn', { onclick: () => this.neg({ op: 'refuse' }) }, h('span', { text: 'Refuse' }), h('small', { text: 'It will take offense' }))));
        } else {
            const best = known ? bestScript(neg.pers) : -1;
            const sc = h('div.scripts');
            SCRIPTS.forEach((id, i) => sc.append(h('button.btn' + (i === best ? '.best' : ''), { onclick: () => this.neg({ op: 'script', i }) }, h('span', { text: (i === best ? '★ ' : '') + SCRIPT_INFO[id].name }), h('small', { text: SCRIPT_INFO[id].hint }))));
            term.append(sc);
            const gifts = Object.keys(G.items).filter((id) => ITEMS[id] && ITEMS[id].kind === 'gift' && G.items[id] > 0);
            if (gifts.length) term.append(h('div.gifts', ...gifts.map((id) => h('button.btn.mini' + (known && PERSONALITIES[neg.pers].likes === id ? '.primary' : ''), { text: `${ITEMS[id].name} ×${G.items[id]}`, onclick: () => this.neg({ op: 'gift', item: id }) }))));
        }
        term.append(h('div.sheet-foot', h('button.btn.mini', { text: 'Walk away', onclick: () => this.neg({ op: 'leave' }) })));
        wrap.append(term);
        document.body.append(wrap);
        term.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    }

    neg(o) {
        this.ui.audio.ui('click');
        const err = this.ui.doAct({ kind: 'neg', ...o });
        this.refresh();
    }
}
