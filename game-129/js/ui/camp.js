// HOLLOWDEEP — the camp menu: each hero's stats, gear and skills; the pack; the quest log; save and settings.
// Works in town and in the dungeon (not in battle). Goes through send() like everything else.

import { $, el, porUrl, icon, itemName, gearLine } from './common.js';
import { CLASSES } from '../sim/data/classes.js';
import { itemDef, gearStats, CONSUMABLES } from '../sim/data/items.js';
import { heroStats, knownSkills, canEquip, xpNext } from '../sim/stats.js';
import { isComplete } from '../sim/game.js';
import { progressText } from '../sim/quests.js';
import { NPCS } from '../sim/data/town.js';
import { FRONT } from '../config.js';

const SLOTS = [['weapon', 'Weapon'], ['armor', 'Armour'], ['shield', 'Shield'], ['acc', 'Accessory']];

export class CampUI {
    constructor({ audio, send, onSystem }) {
        this.audio = audio; this.send = send; this.onSystem = onSystem;
        this.tab = 'party';
        this.sel = null;          // selected hero id
        this.pick = null;         // { kind: 'use'|'equip', inv } waiting for a hero
        for (const b of document.querySelectorAll('#camp-tabs .tab')) b.addEventListener('click', () => { this.tab = b.dataset.tab; this.pick = null; this.audio.ui('move'); this.render(this.G); });
    }

    open(G) { this.G = G; this.pick = null; this.render(G); }

    render(G) {
        this.G = G;
        if (!G || $('camp').hidden) return;
        for (const b of document.querySelectorAll('#camp-tabs .tab')) b.classList.toggle('on', b.dataset.tab === this.tab);
        const body = $('camp-body');
        body.textContent = '';
        this[`_${this.tab}`](G, body);
    }

    _btn(label, sub, fn, opts = {}) {
        const b = el('button.btn' + (opts.cls ? '.' + opts.cls : ''), { onclick: fn }, [label, sub ? el('small', { text: sub }) : null]);
        if (opts.disabled) b.disabled = true;
        return b;
    }

    // ------------------------------------------------------------ party
    _party(G, body) {
        const ids = G.party.length ? G.party : G.roster.map((c) => c.id);
        if (!this.sel || !ids.includes(this.sel)) this.sel = ids[0];
        body.append(el('div.tabs', {}, ids.map((id) => {
            const c = G.roster.find((x) => x.id === id);
            return el('button.tab' + (id === this.sel ? '.on' : ''), { text: c.name, onclick: () => { this.sel = id; this.render(G); } });
        })));
        const c = G.roster.find((x) => x.id === this.sel);
        if (!c) return;
        const s = heroStats(c), cl = CLASSES[c.cls];
        const row = G.party.indexOf(c.id);
        body.append(el('div.card', {}, [
            el('div.face', { style: `background-image:url(${porUrl(c.por)});width:84px;height:84px` }),
            el('div.info', {}, [el('b', { text: `${c.name}` }), el('small', { text: `${cl.name} · level ${c.lv} · ${row < 0 ? 'in the guild hall' : row < FRONT ? 'front row' : 'back row'}` }),
                el('small', { text: `XP ${c.xp} / ${xpNext(c.lv)} to next level` }), el('small', { text: cl.blurb })]),
        ]));
        body.append(el('div.statgrid', {}, [['HP', `${c.hp}/${s.hp}`], ['MP', `${c.mp}/${s.mp}`], ['ATK', s.atk], ['DEF', s.def], ['MAG', s.mag], ['RES', s.res], ['SPD', s.spd], ['LUK', s.luk]]
            .flatMap(([k, v]) => [el('span', { text: k }), el('b', { text: String(v) })])));
        body.append(el('h3', { text: 'Equipment' }));
        const eq = el('div.equip');
        for (const [slot, label] of SLOTS) {
            const e = c.eq[slot];
            eq.append(el('span.slot', { text: label }));
            if (e) {
                const b = this._btn(itemName(e), gearLine(e) + ' · tap to remove', () => this.send({ t: 'unequip', cid: c.id, slot }));
                b.prepend(icon(e.id));
                eq.append(b);
            } else eq.append(el('span.dim', { text: slot === 'shield' && !cl.gear.includes('shield') ? '— (cannot use)' : '—' }));
        }
        body.append(eq);
        // gear in the pack this hero could wear
        const usable = G.inv.map((e, i) => [e, i]).filter(([e]) => canEquip(c, itemDef(e.id)));
        if (usable.length) {
            body.append(el('h3', { text: 'Could wear' }));
            const list = el('div.list');
            for (const [e, i] of usable) {
                const d = itemDef(e.id);
                const cur = c.eq[d.slot] ? gearStats(c.eq[d.slot]) : {};
                const nw = gearStats(e);
                const diff = ['atk', 'def', 'mag', 'res'].map((k) => [k, (nw[k] || 0) - (cur[k] || 0)]).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(' ');
                const b = this._btn(itemName(e), diff || gearLine(e), () => this.send({ t: 'equip', cid: c.id, inv: i }));
                b.prepend(icon(e.id));
                list.append(b);
            }
            body.append(list);
        }
        body.append(el('h3', { text: 'Skills' }));
        const sk = el('div.skills');
        for (const x of cl.skills) {
            const known = x.lv <= c.lv;
            const field = known && ['heal', 'cure', 'revive'].includes(x.kind) && x.tgt !== 'self' && x.tgt !== 'allies' && G.mode !== 'battle';
            const line = el('p', {}, [el('b', { text: known ? x.name : `${x.name} (level ${x.lv})` }), ` — ${x.mp ? x.mp + ' MP. ' : ''}${x.desc}`]);
            if (!known) line.style.opacity = 0.5;
            if (field) {
                const targets = G.party.map((id) => G.roster.find((y) => y.id === id)).filter((y) => y && (x.kind === 'revive' ? y.hp <= 0 : y.hp > 0));
                const row = el('div.acts', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px' });
                for (const t of targets) row.append(this._btn(`${x.name} → ${t.name}`, null, () => this.send({ t: 'field', cid: c.id, skill: x.id, target: t.id }), { disabled: c.mp < x.mp || c.hp <= 0 }));
                line.append(row);
            }
            sk.append(line);
        }
        body.append(sk);
    }

    // ------------------------------------------------------------ items
    _items(G, body) {
        if (this.pick) {
            const e = G.inv[this.pick.inv];
            body.append(el('p', { text: `${this.pick.kind === 'use' ? 'Use' : 'Equip'} ${e ? itemName(e) : ''} on whom?` }));
            const list = el('div.list');
            for (const id of G.party) {
                const c = G.roster.find((x) => x.id === id);
                const s = heroStats(c);
                const d = e && itemDef(e.id);
                const ok = this.pick.kind === 'equip' ? canEquip(c, d) : true;
                list.append(this._btn(c.name, `HP ${c.hp}/${s.hp} · MP ${c.mp}/${s.mp}`, () => {
                    this.send(this.pick.kind === 'use' ? { t: 'use', inv: this.pick.inv, target: c.id } : { t: 'equip', cid: c.id, inv: this.pick.inv });
                    this.pick = null;
                }, { disabled: !ok }));
            }
            list.append(this._btn('← Cancel', null, () => { this.pick = null; this.render(G); }));
            body.append(list);
            return;
        }
        body.append(el('p.dim', { text: `${G.inv.length} things in the pack · ${G.gold.toLocaleString()} gold` }));
        const list = el('div.list');
        for (const [i, e] of G.inv.entries()) {
            const d = itemDef(e.id);
            if (!d) continue;
            const acts = [];
            if (d.type === 'use') {
                const it = CONSUMABLES[e.id];
                if (it.escape) acts.push(this._btn('Use', null, () => this.send({ t: 'use', inv: i }), { disabled: G.mode !== 'dungeon' }));
                else if (it.tgt !== 'enemies') acts.push(this._btn('Use', null, () => { this.pick = { kind: 'use', inv: i }; this.render(G); }));
            }
            if (d.type === 'gear') acts.push(this._btn('Equip', null, () => { this.pick = { kind: 'equip', inv: i }; this.render(G); }));
            if (d.type !== 'quest') acts.push(this._btn('Drop', null, () => this.send({ t: 'discard', inv: i }), { cls: 'danger' }));
            list.append(el('div.card', {}, [icon(e.id), el('div.info', {}, [el('b', { text: `${itemName(e)}${e.n > 1 ? ' ×' + e.n : ''}` }), el('small', { text: gearLine(e) || d.desc || '' })]), el('div.acts', {}, acts)]));
        }
        body.append(list);
    }

    // ------------------------------------------------------------ quests
    _quests(G, body) {
        if (!G.quests.active.length) body.append(el('p.dim', { text: 'No work in hand. The townsfolk and Pell\'s board in the tavern have plenty.' }));
        for (const q of G.quests.active) {
            const done = isComplete(G, q);
            body.append(el('div.quest', {}, [el('b', { text: q.title }), el('p', { text: q.text }),
                el('div.meta', {}, [done ? el('span.done-tag', { text: `Done — report to ${NPCS[q.npc]?.name || 'Pell'}` }) : el('span', { text: progressText(G, q) }), el('span', { text: `${q.gold} gold` })])]));
        }
        body.append(el('p.dim', { text: `${G.quests.done.length} quests completed. Guardians felled: ${Object.keys(G.bossDown).length}. Battles won: ${G.stats.wins}.` }));
    }

    // ------------------------------------------------------------ system
    _system(G, body) {
        const m = el('div.menu');
        m.append(this._btn('Settings', 'volume, picture, battle speed', () => this.onSystem('settings')));
        m.append(this._btn('How to Play', null, () => this.onSystem('howto')));
        m.append(this._btn('Save & Quit to Title', G.mode === 'town' ? 'your game is saved' : 'you will continue from this spot', () => this.onSystem('quit'), { cls: 'danger' }));
        body.append(m);
    }
}
