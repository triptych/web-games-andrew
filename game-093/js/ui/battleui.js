// The battle interface: the command window, skill and item lists, targeting, Boost, the party panel, the turn order, enemy shields
// and weaknesses floating over the foes, damage numbers, banners and the results.

import { h, focusables, moveFocus, typeChip, bar, $ } from './dom.js';
import { SKILLS, CHARS, TYPE_INFO, STATUS_INFO } from '../sim/data/classes.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { ITEMS } from '../sim/data/items.js';
import { legalSkills, living } from '../sim/battle.js';
import { MAX_BOOST } from '../config.js';

export class BattleUI {
    constructor(ui) { this.ui = ui; this.root = null; this.mode = 'none'; this.boost = 0; this.shown = ''; this.cmd = null; this.targets = []; this.ti = 0; this.labels = new Map(); this.order = []; this.resultsOpen = false; }
    get G() { return this.ui.G; }
    get view() { return this.ui.env.view; }
    get bv() { return this.ui.env.view.battle; }

    begin(ev) {
        this.end();
        this.root = h('div', { id: 'battle' });
        this.ui.root.append(this.root);
        this.partyEl = h('div', { id: 'party-hud', class: 'win' });
        this.orderEl = h('div', { id: 'order', class: 'win' });
        this.labelsEl = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
        this.speedBtn = h('button', { class: 'btn center win', style: 'position:absolute;right:calc(8px + env(safe-area-inset-right,0px));top:calc(8px + env(safe-area-inset-top,0px));min-height:34px;font-size:12px', onclick: () => this.toggleSpeed() }, '▶ ×1');
        this.autoBtn = h('button', { class: 'btn center win', style: 'position:absolute;right:calc(8px + env(safe-area-inset-right,0px));top:calc(48px + env(safe-area-inset-top,0px));min-height:34px;font-size:12px', onclick: () => this.toggleAuto() }, 'Auto: off');
        this.autoBtn.classList.add('autob');
        this.root.append(this.labelsEl, this.partyEl, this.orderEl, this.speedBtn, this.autoBtn);
        this.mode = 'none'; this.shown = ''; this.boost = 0; this.labels.clear(); this.resultsOpen = false; this.order = [];
        this.speed = 1; this.auto = false;
    }
    end() { this.root?.remove(); this.root = null; this.mode = 'none'; this.closeWin(); }
    toggleAuto() { this.auto = !this.auto; this.autoBtn.textContent = this.auto ? 'Auto: ON' : 'Auto: off'; this.autoBtn.classList.toggle('primary', this.auto); this.ui.env.audio.ui('click'); if (this.auto) this.closeWin(); else this.shown = ''; }
    toggleSpeed() { this.speed = this.speed === 1 ? 2.6 : 1; this.speedBtn.textContent = this.speed === 1 ? '▶ ×1' : '▶▶ ×2.6'; if (this.bv) this.bv.speed = this.speed * (this.ui.env.fast || 1); }

    // ------------------------------------------------------------------ pieces fed by the director
    popup(x, y, text, cls) {
        if (!this.root) return;
        const el = h('div', { class: `pop ${cls}`, style: `left:${x}px;top:${y}px` }, text);
        this.root.append(el); setTimeout(() => el.remove(), 1200);
    }
    skillBanner(text, cls) { if (!this.root) return; $('skillbanner')?.remove(); const el = h('div', { id: 'skillbanner', class: `win ${cls || ''}` }, text); this.root.append(el); setTimeout(() => el.remove(), 1600); }
    bigBanner(text, cls) { if (!this.root) return; if (cls === 'boost') { $('boostb')?.remove(); const e = h('div', { id: 'boostb' }, text); this.root.append(e); setTimeout(() => e.remove(), 1400); return; } $('bigbanner')?.remove(); const el = h('div', { id: 'bigbanner', class: cls || '' }, text); this.root.append(el); setTimeout(() => el.remove(), 1600); }
    turn(ev) { this.order = [ev.actor, ...(ev.order || [])].slice(0, 9); this._osig = ''; this.boost = 0; this.shown = ''; }

    // ------------------------------------------------------------------ per frame
    update(G, dt) {
        const bv = this.bv; if (!this.root || !bv?.active) return;
        const B = G.battle; if (!B) return;
        this.updateLabels(); this.updateParty(); this.updateOrder();
        bv.speed = this.speed * (this.ui.env.fast || 1);
        // Auto battle: the bot's battle logic gives the commands while the director plays them
        if (this.auto && B.phase === 'cmd' && !bv.busy && !this.resultsOpen) { this.ui.env.autoStep(); return; }
        // open the command window once the director is idle and it is a hero's turn
        if (B.phase === 'cmd' && !bv.busy && this.mode === 'none' && !this.resultsOpen) {
            const key = `${B.actor}:${B.round}:${G.stats.battles}:${B.units.find((u) => u.id === B.actor)?.bp}`;
            if (key !== this.shown) { this.shown = key; this.boost = 0; this.openMain(); }
        }
        if (B.phase !== 'cmd' && this.mode !== 'none') this.closeWin();
    }

    updateLabels() {
        const bv = this.bv, G = this.G;
        for (const u of bv.units.values()) {
            if (u.side !== 'enemy') continue;
            let l = this.labels.get(u.id);
            if (!l) {
                l = { el: h('div', { class: 'elabel', onclick: () => this.pickTarget(u.id) }), sh: h('div', { class: 'sh' }), chips: h('div', { class: 'chips' }), hp: h('div', { class: 'hpb' }, h('i')), nm: h('div', { class: 'nm' }, u.name) };
                l.el.append(l.nm, l.sh, l.chips, l.hp); l.el.style.pointerEvents = 'none';
                this.labelsEl.append(l.el); this.labels.set(u.id, l);
            }
            const p = bv.screenPos(u.id, 2.4);
            if (!p) continue;
            l.el.style.left = `${p.x}px`; l.el.style.top = `${Math.max(64, p.y - 6)}px`;
            const dead = u.dead;
            l.el.classList.toggle('dead', dead); l.el.classList.toggle('brk', u.br); l.el.classList.toggle('tgt', this.mode === 'target' && this.targets[this.ti] === u.id);
            l.el.style.pointerEvents = this.mode === 'target' && !dead ? 'auto' : 'none';
            const sig = `${u.sh}|${u.br}|${u.rev?.join()}|${u.nw}|${u.ch}`;
            if (l.sig !== sig) {
                l.sig = sig; l.sh.innerHTML = '';
                l.sh.append(h('b', {}, u.br ? '✕' : String(u.sh)), u.br ? 'BREAK' : u.ch > 0 ? 'CHARGING' : '');
                l.chips.innerHTML = '';
                for (let i = 0; i < u.nw; i++) { const t = u.rev?.[i]; l.chips.append(t ? typeChip(TYPE_INFO[t].code, TYPE_INFO[t].color) : typeChip('?', '#586080')); }
            }
            l.hp.firstChild.style.width = `${Math.max(0, u.hp / u.mhp) * 100}%`;
        }
    }

    updateParty() {
        const bv = this.bv, B = this.G.battle;
        const rows = [...bv.units.values()].filter((u) => u.side === 'party');
        if (this.partyEl.children.length !== rows.length) { this.partyEl.innerHTML = ''; for (const u of rows) this.partyEl.append(h('div', { class: 'pr', 'data-id': u.id }, h('div', { class: 'n' }), h('div', {}, h('div', { class: 'hpn num' }), bar('hp', 1)), h('div', {}, h('div', { class: 'mpn num' }), bar('mp', 1)), h('div', { class: 'st' }))); }
        rows.forEach((u, i) => {
            const r = this.partyEl.children[i];
            r.classList.toggle('act', u.id === B.actor && B.phase === 'cmd'); r.classList.toggle('ko', u.dead || u.hp <= 0);
            r.querySelector('.n').textContent = u.name;
            r.querySelector('.hpn').textContent = `${Math.max(0, Math.round(u.hp))}/${u.mhp}`; r.querySelector('.mpn').textContent = `${u.mp} MP`;
            const bars = r.querySelectorAll('.bar i'); bars[0].style.width = `${Math.max(0, u.hp / u.mhp) * 100}%`; bars[0].parentNode.classList.toggle('low', u.hp / u.mhp < 0.25);
            bars[1].style.width = `${Math.max(0, u.mp / u.d.mmp) * 100}%`;
            const st = r.querySelector('.st'); const sig = u.st.join(',') + '|' + u.bp;
            if (r._sig !== sig) { r._sig = sig; st.innerHTML = ''; for (let k = 0; k < 5; k++) st.append(h('span', { class: `gem ${k < u.bp ? 'on' : ''}`, style: 'width:8px;height:8px;border-width:1px;margin-right:3px' })); for (const s of u.st) { const si = STATUS_INFO[s]; if (si) st.append(h('span', { class: 'st-ic', style: `background:${si.color}` }, si.name)); } }
        });
    }

    updateOrder() {
        const bv = this.bv, B = this.G.battle; if (!B) return;
        const ids = this.order.length ? this.order : [];
        const sig = ids.join(',') + B.round + [...bv.units.values()].map((u) => (u.dead ? 'x' : '')).join('');
        if (this._osig === sig) return; this._osig = sig;
        this.orderEl.innerHTML = ''; this.orderEl.append(h('span', { class: 'rd' }, `RD ${B.round}`));
        ids.forEach((id, i) => {
            const u = bv.units.get(id); if (!u || u.dead) return;
            this.orderEl.append(h('div', { class: `oi ${u.side === 'party' ? 'p' : 'e'} ${i === 0 ? 'first' : ''}`, title: u.name }, u.name.slice(0, 2)));
        });
    }

    // ------------------------------------------------------------------ command windows
    closeWin() { this.win?.remove(); this.win = null; this.mode = 'none'; this.cursorEl?.remove(); this.cursorEl = null; this.clearTarget(); }
    unit() { const B = this.G.battle; return B?.units.find((u) => u.id === B.actor); }

    bpGems(u, withBoost) {
        const g = h('div', { id: 'bp' });
        for (let i = 0; i < 5; i++) g.append(h('span', { class: `gem ${i < u.bp ? 'on' : ''} ${withBoost && i >= u.bp - this.boost && i < u.bp ? 'sel' : ''}` }));
        return g;
    }

    openMain() {
        const u = this.unit(), B = this.G.battle; if (!u) return;
        this.closeWin(); this.mode = 'main'; this.cmd = null;
        const mk = (label, fn, o = {}) => h('button', { class: `btn ${o.off ? 'off' : ''}`, onclick: () => { if (o.off) { this.ui.env.audio.ui('error'); return; } this.ui.env.audio.ui('click'); fn(); } }, label, o.r ? h('span', { class: 'r' }, o.r) : null);
        const bu = this.boostEl = h('div', { id: 'boost' }, h('button', { class: 'btn center', onclick: () => this.setBoost(this.boost - 1) }, '−'), h('span', { id: 'boostn' }, `Boost ×${this.boost}`), h('button', { class: 'btn center', onclick: () => this.setBoost(this.boost + 1) }, '+'), h('small', {}, '(R)'));
        const name = h('div', { class: 'who' }, CHARS[u.ref].name, this.gemsEl = this.bpGems(u, true));
        this.win = h('div', { id: 'cmd', class: 'win' }, name, bu,
            mk('Attack', () => this.chooseAttack()), mk('Skills', () => this.openSkills()), mk('Items', () => this.openItems()), mk('Defend', () => this.submit({ type: 'defend' })), B.noFlee ? null : mk('Flee', () => this.submit({ type: 'flee' })));
        this.root.append(this.win);
        focusables(this.win).find((b) => b.textContent.startsWith('Attack'))?.focus();
    }
    setBoost(n) {
        const u = this.unit(); if (!u) return;
        const max = Math.min(MAX_BOOST, u.bp);
        this.boost = ((n % (max + 1)) + (max + 1)) % (max + 1);
        $('boostn').textContent = `Boost ×${this.boost}`; this.ui.env.audio.ui('move');
        const g = this.gemsEl; const nu = this.bpGems(u, true); g.replaceWith(nu); this.gemsEl = nu;
    }

    openSkills() {
        const u = this.unit(); this.mode = 'skills'; this.win?.remove();
        const desc = h('div', { class: 'desc', style: 'min-height:34px;font-size:12px' }, '');
        const skills = legalSkills(this.G, u);
        const list = skills.map((s) => {
            const ok = u.mp >= s.mp;
            return h('button', { class: `btn ${ok ? '' : 'off'}`, onfocus: () => { desc.textContent = s.desc + (s.sh ? `  (+${s.sh} shield dmg)` : ''); }, onclick: () => { if (!ok) { this.ui.env.audio.ui('error'); return; } this.ui.env.audio.ui('click'); this.chooseSkill(s); } },
                s.name, s.type ? typeChip(TYPE_INFO[s.type]?.code || 'AUTO', TYPE_INFO[s.type]?.color || '#c8d4f4') : null, h('span', { class: 'r' }, `${s.mp} MP`));
        });
        this.win = h('div', { id: 'sub', class: 'win' }, h('div', { class: 'who', style: 'font-family:var(--title);color:var(--gold)' }, 'Skills', h('span', { style: 'float:right;font-size:12px;color:#7fb8ff' }, `${u.mp} MP`)), desc, ...list, h('button', { class: 'btn center', onclick: () => this.openMain() }, 'Back'));
        this.root.append(this.win);
        focusables(this.win)[0]?.focus();
    }
    openItems() {
        const G = this.G; this.mode = 'items'; this.win?.remove();
        const desc = h('div', { class: 'desc', style: 'min-height:30px;font-size:12px' }, '');
        const ids = Object.keys(G.inv).filter((i) => ITEMS[i]?.use && !ITEMS[i].fieldOnly);
        const list = ids.map((i) => h('button', { class: 'btn', onfocus: () => { desc.textContent = ITEMS[i].desc; }, onclick: () => { this.ui.env.audio.ui('click'); this.chooseItem(i); } }, ITEMS[i].name, h('span', { class: 'r' }, `×${G.inv[i]}`)));
        this.win = h('div', { id: 'sub', class: 'win' }, h('div', { class: 'who', style: 'font-family:var(--title);color:var(--gold)' }, 'Items'), desc, ...(list.length ? list : [h('p', { class: 'desc' }, 'No usable items.')]), h('button', { class: 'btn center', onclick: () => this.openMain() }, 'Back'));
        this.root.append(this.win);
        focusables(this.win)[0]?.focus();
    }

    // ------------------------------------------------------------------ choosing a target
    chooseAttack() { this.cmd = { type: 'attack', boost: this.boost }; this.needTarget('one'); }
    chooseSkill(s) {
        this.cmd = { type: 'skill', skill: s.id, boost: this.boost };
        this.needTarget(s.tgt);
    }
    chooseItem(id) {
        const it = ITEMS[id]; this.cmd = { type: 'item', item: id, boost: 0 };
        this.needTarget(it.tgt === 'foe' ? 'one' : it.tgt === 'none' ? 'self' : it.tgt);
    }
    needTarget(kind) {
        const B = this.G.battle, u = this.unit();
        if (kind === 'all' || kind === 'allies' || kind === 'rand' || kind === 'self') { this.submit({ ...this.cmd, target: kind === 'self' ? u.id : undefined }); return; }
        const side = kind === 'one' ? 'enemy' : 'party';
        let cand = B.units.filter((x) => x.side === side && (kind === 'dead' ? x.hp <= 0 : x.hp > 0));
        if (!cand.length) { this.ui.env.audio.ui('error'); return; }
        this.targets = cand.map((x) => x.id); this.ti = 0;
        // the first target is the one in front of the last choice, if it still stands
        this.mode = 'target'; this.win?.remove(); this.win = h('div', { id: 'sub', class: 'win', style: 'width:auto' }, h('div', { style: 'font-size:13px' }, side === 'enemy' ? 'Choose a target — ◀ ▶ then confirm' : 'Choose an ally — ◀ ▶ then confirm'), h('div', { style: 'display:flex;gap:6px;margin-top:4px' }, h('button', { class: 'btn center', onclick: () => this.cycle(-1) }, '◀'), h('button', { class: 'btn primary center', onclick: () => this.confirmTarget() }, 'OK'), h('button', { class: 'btn center', onclick: () => this.cycle(1) }, '▶'), h('button', { class: 'btn center', onclick: () => this.backFromTarget() }, 'Back')));
        this.root.append(this.win);
        this.showTarget();
    }
    cycle(d) { this.ti = (this.ti + d + this.targets.length) % this.targets.length; this.ui.env.audio.ui('move'); this.showTarget(); }
    pickTarget(id) { if (this.mode !== 'target') return; const i = this.targets.indexOf(id); if (i < 0) return; if (this.ti === i) this.confirmTarget(); else { this.ti = i; this.showTarget(); this.ui.env.audio.ui('move'); } }
    showTarget() {
        const bv = this.bv, id = this.targets[this.ti], u = bv.units.get(id);
        this.clearTarget();
        if (u?.side === 'party') this.partyEl.querySelector(`[data-id="${id}"]`)?.classList.add('act');
        this.cursorEl?.remove();
        this.targetId = id; bv.targetId = id;
        // a pointer above a party member (foes have theirs in the label)
        if (u?.side === 'party') { const p = bv.screenPos(id, 2.2); this.cursorEl = h('div', { id: 'cursor', style: `display:block;left:${p.x}px;top:${p.y}px` }, '▼'); this.root.append(this.cursorEl); }
    }
    clearTarget() { this.targetId = null; if (this.bv) this.bv.targetId = null; }
    confirmTarget() { const id = this.targets[this.ti]; this.submit({ ...this.cmd, target: id }); }
    backFromTarget() { this.cursorEl?.remove(); this.clearTarget(); if (this.cmd?.type === 'skill') this.openSkills(); else if (this.cmd?.type === 'item') this.openItems(); else this.openMain(); }

    submit(cmd) {
        const ok = this.ui.env.act({ type: 'b', cmd: { ...cmd, boost: cmd.boost ?? 0 } });
        if (!ok) { this.ui.env.audio.ui('error'); this.openMain(); return; }
        this.closeWin();
    }

    // ------------------------------------------------------------------ keys
    press(p) {
        if (this.mode === 'none' || !this.root) {
            if (this.root && p.key === 'KeyF') { this.toggleSpeed(); return true; }
            if (this.root && p.key === 'KeyT') { this.toggleAuto(); return true; }
            return false;
        }
        const key = p.key, audio = this.ui.env.audio;
        if (key === 'KeyF') { this.toggleSpeed(); return true; }
        if (key === 'KeyT') { this.toggleAuto(); return true; }
        if (key === 'KeyR' && this.mode === 'main') { this.setBoost(this.boost + 1); return true; }
        if (this.mode === 'target') {
            if (['ArrowLeft', 'ArrowUp'].includes(key)) { this.cycle(-1); return true; }
            if (['ArrowRight', 'ArrowDown'].includes(key)) { this.cycle(1); return true; }
            if (key === 'Enter' || key === 'Space' || key === 'KeyZ') { this.confirmTarget(); return true; }
            if (key === 'Escape' || key === 'KeyX' || key === 'Backspace') { this.backFromTarget(); return true; }
            return true;
        }
        const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[key];
        if (dir && this.win) { moveFocus(this.win, dir); audio.ui('move'); return true; }
        if (this.ui.confirmPress(p)) { document.activeElement?.click?.(); return true; }
        if (key === 'Escape' || key === 'KeyX' || key === 'Backspace') { if (this.mode === 'skills' || this.mode === 'items') this.openMain(); return true; }
        return true;
    }

    // ------------------------------------------------------------------ the end of a fight
    ended(ev) {
        const ui = this.ui;
        if (ev.result === 'victory') return this.results(ev);
        ui.env.act({ type: 'battleDone' });   // a defeat becomes the game-over mode, and the 'gameover' event opens the screen
    }

    results(ev) {
        const ui = this.ui, G = this.G, r = ev.rewards || { xp: 0, gold: 0, drops: [], levelups: [] };
        this.resultsOpen = true; this.closeWin();
        const el = h('div', { class: 'win results' },
            h('h1', {}, 'VICTORY'),
            h('div', { class: 'line' }, h('span', {}, 'Experience'), h('b', {}, `${r.xp} XP`)), h('div', { class: 'line' }, h('span', {}, 'Gold'), h('b', { style: 'color:var(--gold)' }, `${r.gold} G`)),
            r.drops.length ? h('div', { class: 'line' }, h('span', {}, 'Spoils'), h('b', {}, summarize(r.drops))) : null,
            ...r.levelups.map((l) => h('div', { class: 'lv' }, `★ ${CHARS[l.id].name} reached Level ${l.lvl}!  HP +${l.gain.hp}  ATK +${l.gain.atk}  MAG +${l.gain.mag}  DEF +${l.gain.def}`, l.learned.length ? h('div', { style: 'color:var(--gold)' }, '✦ Learned ' + l.learned.map((s) => SKILLS[s].name).join(', ')) : null)),
            h('div', { class: 'foot', style: 'justify-content:center' }, h('button', { class: 'btn primary center', onclick: (e) => { ui.close(e.target.closest('.screen'), true); this.resultsOpen = false; ui.env.act({ type: 'battleDone' }); } }, 'Continue')));
        if (r.levelups.length) ui.env.audio.play('levelup');
        ui.open(el, { id: 'results', back: null });
    }

    gameOver() {
        const ui = this.ui; this.resultsOpen = true;
        const hasSave = ui.env.hasSave();
        const el = h('div', { class: 'win results over' }, h('h1', {}, 'DEFEATED'), h('p', {}, 'The party has fallen... but the shards are patient.'),
            h('button', { class: 'btn primary center', onclick: (e) => { ui.close(e.target.closest('.screen'), true); this.resultsOpen = false; ui.env.act({ type: 'retry' }); } }, 'Retry the battle'),
            hasSave ? h('button', { class: 'btn center', onclick: (e) => { ui.close(e.target.closest('.screen'), true); this.resultsOpen = false; ui.env.doLoad(); } }, 'Load last save') : null,
            h('button', { class: 'btn center', onclick: (e) => { ui.close(e.target.closest('.screen'), true); this.resultsOpen = false; ui.env.toTitle(); } }, 'Return to title'));
        ui.open(el, { id: 'gameover', back: null });
    }
}

function summarize(list) {
    const c = {}; for (const i of list) c[i] = (c[i] || 0) + 1;
    return Object.entries(c).map(([i, n]) => `${ITEMS[i].name}${n > 1 ? ' ×' + n : ''}`).join(', ');
}
