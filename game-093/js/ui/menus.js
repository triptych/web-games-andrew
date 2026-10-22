// The pause menu and its pages, the shop and the notice board.

import { $, h, focusables, bar, typeChip, fmtTime } from './dom.js';
import { CHARS, SKILLS, TYPE_INFO, STATUS_INFO, skillsAt, xpToNext } from '../sim/data/classes.js';
import { ITEMS } from '../sim/data/items.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { LOCS } from '../sim/world/locations.js';
import { BEATS } from '../sim/data/story.js';
import { memberStats, canEquip, count } from '../sim/party.js';
import * as Q from '../sim/quests.js';
import { MAX_LEVEL } from '../config.js';

const STAT_NAMES = [['mhp', 'HP'], ['mmp', 'MP'], ['atk', 'Attack'], ['mag', 'Magic'], ['def', 'Defence'], ['res', 'Resist'], ['spd', 'Speed']];

export function statsOf(m) { return memberStats(m); }
function chipsFor(types, known) { return types.map((t) => typeChip(TYPE_INFO[t].code, known ? TYPE_INFO[t].color : '#586080')); }

function itemStatText(it) {
    if (!it.stats) return '';
    const n = { hp: 'HP', mp: 'MP', atk: 'ATK', mag: 'MAG', def: 'DEF', res: 'RES', spd: 'SPD' };
    return Object.entries(it.stats).map(([k, v]) => `${n[k]} ${v > 0 ? '+' : ''}${v}`).join('  ');
}

export class PauseMenu {
    constructor(ui) { this.ui = ui; this.scr = null; this.tab = null; this.pending = null; }
    get G() { return this.ui.G; }
    get open_() { return !!this.scr; }

    open(tab = null) {
        if (this.scr) return;
        const ui = this.ui;
        const tabs = [['items', 'Items'], ['abilities', 'Abilities'], ['equip', 'Equip'], ['status', 'Status'], ['party', 'Party'], ['quests', 'Quests'], ['bestiary', 'Bestiary'], ['save', 'Save'], ['settings', 'Settings'], ['title', 'Quit']];
        this.col = h('div', { class: 'col win' }, h('button', { class: 'btn center', 'data-close': '1', onclick: () => this.close() }, '✕ Close'), tabs.map(([id, label]) => h('button', { class: 'btn', 'data-tab': id, onclick: () => { ui.env.audio.ui('click'); this.show(id); } }, label)));
        this.main = h('div', { class: 'main win' });
        this.party = h('div', { class: 'party' });
        this.scr = ui.open(h('div', { style: 'display:contents' }, this.col, this.main, this.party), { id: 'menu', back: () => this.close(), cls: '' });
        this.scr.style.cssText += ';align-items:stretch';
        this.renderParty();
        this.show(tab || 'items');
        this.col.querySelector(`[data-tab="${tab || 'items'}"]`)?.focus();
    }
    close() { if (!this.scr) return; this.ui.close(this.scr); this.scr = null; this.pending = null; this.ui.env.onMenuClosed?.(); }

    renderParty(onPick) {
        const G = this.G; this.party.innerHTML = '';
        const add = (id, reserve) => {
            const m = G.party.members[id], s = memberStats(m), c = CHARS[id];
            const face = this.ui.env.lib.portrait({ char: id }, 2);
            const card = h('button', { class: `btn pcard win ${reserve ? 'reserve' : ''}`, 'data-id': id, onclick: () => this.pick(id) },
                face, h('div', { style: 'flex:1;min-width:0' },
                    h('div', { class: 'nm' }, c.name, h('span', {}, `Lv ${m.lvl}`)),
                    bar(m.hp / s.mhp < 0.25 ? 'hp low' : 'hp', m.hp / s.mhp), h('div', { class: 'num' }, h('span', {}, `${m.hp}/${s.mhp}`), h('span', {}, `${m.mp}/${s.mmp} MP`)), bar('mp', m.mp / Math.max(1, s.mmp)),
                    reserve ? h('div', { class: 'num' }, 'Reserve') : null));
            if (m.hp <= 0) card.style.opacity = '0.55';
            this.party.append(card);
        };
        for (const id of G.party.active) add(id, false);
        for (const id of G.party.reserve) add(id, true);
        this.party.append(h('div', { class: 'win', style: 'font-size:13px;padding:6px 10px' }, `Gold  `, h('b', { style: 'color:var(--gold)' }, `${G.gold} G`), h('br'), `Time  ${fmtTime(G.stats.playtime)}`, h('br'), `Where  ${LOCS[G.map]?.name || 'the open road'}`));
    }

    pick(id) {
        const ui = this.ui, G = this.G;
        if (this.pending?.item) {
            const ok = ui.env.act({ type: 'useItem', item: this.pending.item, target: id });
            ui.env.audio.ui(ok ? 'buy' : 'error');
            if (!count(G, this.pending.item)) this.pending = null;
            this.renderParty(); this.show('items', true); return;
        }
        if (this.tab === 'equip') return this.equipPane(id);
        if (this.tab === 'status') return this.statusPane(id);
        if (this.tab === 'abilities') return this.abilitiesPane(id);
        if (this.tab === 'party') return this.partyPick(id);
    }

    show(tab, keepFocus = false) {
        const G = this.G, ui = this.ui; this.tab = tab; this.main.innerHTML = '';
        for (const b of this.col.children) b.classList.toggle('focus', b.dataset.tab === tab);
        const M = this.main;
        switch (tab) {
            case 'items': this.itemsPane(); break;
            case 'abilities': M.append(h('h2', { class: 't' }, 'Abilities'), h('p', { class: 'desc' }, 'Choose a hero.')); this.abilitiesPane(G.party.active[0]); break;
            case 'equip': M.append(h('h2', { class: 't' }, 'Equipment'), h('p', { class: 'desc' }, 'Choose a hero.')); this.equipPane(G.party.active[0]); break;
            case 'status': this.statusPane(G.party.active[0]); break;
            case 'party': this.partyPane(); break;
            case 'quests': this.questsPane(); break;
            case 'bestiary': this.bestiaryPane(); break;
            case 'save': this.savePane(); break;
            case 'settings': ui.settingsSheet(() => this.show('items')); break;
            case 'title': M.append(h('h2', { class: 't' }, 'Quit to title?'), h('p', {}, 'Your progress is saved before you leave.'), h('button', { class: 'btn primary center', onclick: () => { ui.env.doSave(); this.close(); ui.env.toTitle(); } }, 'Save and quit'), h('button', { class: 'btn center', onclick: () => this.show('items') }, 'Cancel')); break;
        }
    }

    itemsPane() {
        const G = this.G, M = this.main, ui = this.ui;
        const ids = Object.keys(G.inv).filter((id) => ITEMS[id]);
        const groups = [['Consumables', ids.filter((i) => ITEMS[i].use)], ['Materials', ids.filter((i) => ITEMS[i].type === 'mat')], ['Equipment', ids.filter((i) => ['weapon', 'armor', 'charm'].includes(ITEMS[i].type))], ['Key Items', ids.filter((i) => ITEMS[i].type === 'key')]];
        const desc = h('div', { class: 'desc' }, this.pending?.item ? `Use ${ITEMS[this.pending.item].name} on whom? Pick a hero →` : 'Select an item.');
        M.append(h('h2', { class: 't' }, 'Items'), desc);
        for (const [label, list] of groups) {
            if (!list.length) continue;
            M.append(h('div', { style: 'color:var(--dim);font-size:11px;letter-spacing:0.15em;margin:6px 0 2px' }, label.toUpperCase()));
            const box = h('div', { class: 'list' }); M.append(box);
            for (const id of list) {
                const it = ITEMS[id];
                const usable = it.use && !it.battleOnly;
                box.append(h('button', { class: `btn ${usable ? '' : 'off'}`, onfocus: () => { desc.textContent = `${it.desc}${it.stats ? '  ' + itemStatText(it) : ''}${it.price ? `  (sells for ${Math.floor(it.price / 2)} G)` : ''}`; }, onclick: () => {
                    if (!usable) { ui.env.audio.ui('error'); desc.textContent = it.battleOnly ? 'Only usable in battle.' : it.desc; return; }
                    if (it.tgt === 'none') { ui.env.act({ type: 'useItem', item: id }); ui.env.audio.ui('buy'); this.renderParty(); this.show('items', true); }
                    else { this.pending = { item: id }; desc.textContent = `Use ${it.name} on whom? Pick a hero →`; this.party.querySelector('.pcard')?.focus(); }
                } }, it.name, h('span', { class: 'r' }, `×${G.inv[id]}`)));
            }
        }
        if (!ids.length) M.append(h('p', {}, 'Your pack is empty.'));
        if (!keepFocusSkip) focusables(M)[0]?.focus();
    }

    abilitiesPane(id) {
        const G = this.G, M = this.main, c = CHARS[id], m = G.party.members[id];
        M.innerHTML = ''; M.append(h('h2', { class: 't' }, `${c.name} — ${c.cls}`));
        const desc = h('div', { class: 'desc' }, 'Select a skill to read about it.');
        M.append(desc);
        const box = h('div', { class: 'list' }); M.append(box);
        for (const s of c.skills) {
            const sk = SKILLS[s.id], known = s.lvl <= m.lvl;
            box.append(h('button', { class: `btn ${known ? '' : 'off'}`, onfocus: () => { desc.textContent = known ? `${sk.desc} ${sk.sh ? `(+${sk.sh} shield damage on weakness)` : ''}` : `Learned at level ${s.lvl}.`; } },
                known ? sk.name : '???', sk.type && known ? typeChip(TYPE_INFO[sk.type]?.code || 'ANY', TYPE_INFO[sk.type]?.color || '#9aa') : null,
                h('span', { class: 'r' }, known ? `${sk.mp} MP` : `Lv ${s.lvl}`)));
        }
        this.selected = id;
    }

    equipPane(id) {
        const G = this.G, M = this.main, ui = this.ui, c = CHARS[id], m = G.party.members[id];
        M.innerHTML = ''; M.append(h('h2', { class: 't' }, `${c.name} — Equipment`));
        const desc = h('div', { class: 'desc' }, 'Choose a slot.');
        const st = memberStats(m);
        M.append(h('div', { class: 'stat' }, STAT_NAMES.map(([k, n]) => h('div', {}, n, h('b', {}, st[k]))))); M.append(desc);
        const slots = [['weapon', 'Weapon'], ['armor', 'Armour'], ['charm', 'Charm']];
        const box = h('div', { class: 'list' }); M.append(box);
        for (const [slot, label] of slots) {
            const cur = ITEMS[m.equip[slot]];
            box.append(h('button', { class: 'btn', onfocus: () => { desc.textContent = cur ? `${cur.desc} ${itemStatText(cur)}` : 'Nothing equipped.'; }, onclick: () => this.equipList(id, slot) }, h('small', { style: 'width:62px' }, label), cur ? cur.name : '— none —'));
        }
        this.selected = id;
        focusables(box)[0]?.focus();
    }
    equipList(id, slot) {
        const G = this.G, M = this.main, ui = this.ui, c = CHARS[id], m = G.party.members[id];
        M.innerHTML = ''; M.append(h('h2', { class: 't' }, `${c.name} — ${slot[0].toUpperCase() + slot.slice(1)}`));
        const base = memberStats(m);
        const desc = h('div', { class: 'desc' }, ''); const diff = h('div', { class: 'stat' });
        M.append(diff, desc);
        const box = h('div', { class: 'list' }); M.append(box);
        const preview = (it) => {
            const cur = ITEMS[m.equip[slot]];
            const sim = { ...m, equip: { ...m.equip, [slot]: it ? it.id : null } };
            const ns = memberStats(sim);
            diff.innerHTML = ''; for (const [k, n] of STAT_NAMES) { const d = ns[k] - base[k]; diff.append(h('div', {}, n, h('b', { class: d > 0 ? 'up' : d < 0 ? 'dn' : '' }, `${ns[k]}${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}`))); }
            desc.textContent = it ? `${it.desc} ${itemStatText(it)}` : 'Unequip.';
        };
        const cands = Object.keys(G.inv).filter((i) => ITEMS[i].type === slot && canEquip(id, i)).sort((a, b) => (ITEMS[b].tier || 0) - (ITEMS[a].tier || 0));
        if (m.equip[slot]) box.append(h('button', { class: 'btn', onfocus: () => preview(null), onclick: () => { ui.env.act({ type: 'unequip', id, slot }); ui.env.audio.ui('click'); this.renderParty(); this.equipPane(id); } }, 'Remove'));
        for (const i of cands) box.append(h('button', { class: 'btn', onfocus: () => preview(ITEMS[i]), onclick: () => { ui.env.act({ type: 'equip', id, item: i }); ui.env.audio.ui('buy'); this.renderParty(); this.equipPane(id); } }, ITEMS[i].name, h('span', { class: 'r' }, `×${G.inv[i]}`)));
        if (!cands.length && !m.equip[slot]) box.append(h('p', { class: 'desc' }, 'Nothing to equip. Shops and chests have more.'));
        focusables(box)[0]?.focus();
    }

    statusPane(id) {
        const G = this.G, M = this.main, c = CHARS[id], m = G.party.members[id], s = memberStats(m);
        M.innerHTML = '';
        M.append(h('h2', { class: 't' }, `${c.name}  ·  ${c.title}`), h('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:6px' }, this.ui.env.lib.portrait({ char: id }, 3), h('div', {}, h('div', {}, `${c.cls} — Level ${m.lvl}`), h('div', { class: 'desc' }, c.bio))));
        M.append(h('div', { class: 'stat' }, STAT_NAMES.map(([k, n]) => h('div', {}, n, h('b', {}, k === 'mhp' ? `${m.hp} / ${s.mhp}` : k === 'mmp' ? `${m.mp} / ${s.mmp}` : s[k])))));
        const next = xpToNext(m.lvl);
        M.append(h('div', { style: 'margin-top:8px;font-size:13px' }, m.lvl >= MAX_LEVEL ? 'Max level' : `Next level: ${next - m.xp} XP`), bar('xp', m.lvl >= MAX_LEVEL ? 1 : m.xp / next));
        M.append(h('div', { class: 'desc' }, `Weapon: ${ITEMS[m.equip.weapon]?.name || '—'} · Armour: ${ITEMS[m.equip.armor]?.name || '—'} · Charm: ${ITEMS[m.equip.charm]?.name || '—'}`));
        M.append(h('div', { class: 'desc' }, `Foes felled: ${m.kills}`));
    }

    partyPane() {
        const M = this.main; M.innerHTML = '';
        M.append(h('h2', { class: 't' }, 'Party'), h('p', { class: 'desc' }, 'Pick a hero in the active party, then a reserve hero to swap places. Reserve heroes earn 60% of the experience.'));
        this.swapSel = null;
    }
    partyPick(id) {
        const G = this.G, ui = this.ui;
        if (!this.swapSel) { this.swapSel = id; this.party.querySelector(`[data-id="${id}"]`)?.classList.add('focus'); return; }
        const a = this.swapSel, b = id; this.swapSel = null;
        const aAct = G.party.active.includes(a), bAct = G.party.active.includes(b);
        if (aAct && !bAct) ui.env.act({ type: 'swap', out: a, in: b }); else if (!aAct && bAct) ui.env.act({ type: 'swap', out: b, in: a }); else if (aAct && bAct) { const i = G.party.active.indexOf(a), j = G.party.active.indexOf(b);[G.party.active[i], G.party.active[j]] = [G.party.active[j], G.party.active[i]]; } else ui.env.audio.ui('error');
        ui.env.audio.ui('click'); this.renderParty(); this.show('party');
    }

    questsPane() {
        const G = this.G, M = this.main, Qs = G.quests;
        M.innerHTML = ''; M.append(h('h2', { class: 't' }, 'Quest Log'));
        const b = BEATS[G.story.i];
        M.append(h('div', { class: 'quest' }, h('b', {}, 'MAIN STORY'), b ? b.obj.text : 'The dawn has come. The world is yours.', b?.hint ? h('div', { class: 'desc' }, b.hint) : null));
        if (!Qs.active.length) M.append(h('p', { class: 'desc' }, 'No side quests. Read the notice board in a town, or talk to the villagers.'));
        for (const q of Qs.active) {
            const st = Q.status(G, q);
            M.append(h('div', { class: `quest ${st.ready ? 'done' : ''}` }, h('b', {}, `${q.title}${st.ready ? '  ✓ ready' : ''}`), h('div', {}, q.text), h('div', { class: 'desc' }, `${LOCS[q.town].name}  ·  ${st.have}/${st.need}  ·  Reward ${q.reward.gold} G${q.reward.items?.length ? ' + ' + q.reward.items.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ') : ''}`), h('button', { class: 'btn', style: 'min-height:34px', onclick: () => { this.ui.env.act({ type: 'abandon', id: q.id }); this.show('quests'); } }, 'Abandon')));
        }
        M.append(h('div', { class: 'desc' }, `Completed: ${Qs.completed}`));
        focusables(M)[0]?.focus();
    }

    bestiaryPane() {
        const G = this.G, M = this.main; M.innerHTML = ''; M.append(h('h2', { class: 't' }, 'Bestiary'));
        const seen = Object.entries(G.bestiary).filter(([k]) => ENEMIES[k]);
        if (!seen.length) M.append(h('p', { class: 'desc' }, 'No foes met yet. Strike a weakness (or use Analyze / Beast Lore) to record it here.'));
        for (const [k, b] of seen) {
            const e = ENEMIES[k];
            M.append(h('div', { class: 'quest' }, h('b', {}, `${e.name}   ×${b.seen}`), h('div', { class: 'chips' }, e.weak.map((w) => typeChip(b.weak.includes(w) ? TYPE_INFO[w].code : '?', b.weak.includes(w) ? TYPE_INFO[w].color : '#586080'))), h('div', { class: 'desc' }, `Shield ${e.shield}${e.boss ? ' · Boss' : ''}${e.mat ? ' · drops ' + ITEMS[e.mat].name : ''}`)));
        }
    }

    savePane() {
        const G = this.G, M = this.main, ui = this.ui; M.innerHTML = '';
        const info = ui.env.saveInfo();
        M.append(h('h2', { class: 't' }, 'Save'), h('p', {}, info ? `Last save: Lv ${info.lvl}, ${LOCS[info.map]?.name || 'the road'}, ${fmtTime(info.playtime)}.` : 'No save yet.'),
            h('button', { class: 'btn primary center', onclick: () => { const ok = ui.env.doSave(); ui.toast(ok ? 'Game saved.' : 'Could not save (storage blocked).'); ui.env.audio.play('save'); this.savePane(); } }, 'Save game'));
        focusables(M)[0]?.focus();
    }
}
const keepFocusSkip = false;

// ------------------------------------------------------------------------------------------------ shop
export class Shop {
    constructor(ui) { this.ui = ui; this.scr = null; this.qty = 1; this.tab = 'buy'; }
    get G() { return this.ui.G; }
    open() {
        const G = this.G, ui = this.ui; this.tab = 'buy';
        this.body = h('div', { class: 'sheet win', style: 'width:min(640px,100%)' });
        this.scr = ui.open(this.body, { id: 'shop', back: () => this.close() });
        this.render();
    }
    close() { if (!this.scr) return; this.ui.close(this.scr); this.scr = null; this.ui.env.act({ type: 'closeShop' }); }
    render() {
        const G = this.G, ui = this.ui, B = this.body; B.innerHTML = '';
        const shop = G.shop; if (!shop) return;
        const desc = h('div', { class: 'desc' }, 'Select an item.');
        B.append(h('h2', { class: 't' }, shop.name, h('span', { style: 'float:right;font-size:14px' }, `${G.gold} G`)),
            h('div', { style: 'display:flex;gap:6px;margin-bottom:6px' }, ['buy', 'sell'].map((t) => h('button', { class: `btn center ${this.tab === t ? 'focus' : ''}`, style: 'flex:1', onclick: () => { this.tab = t; this.render(); } }, t === 'buy' ? 'Buy' : 'Sell')),
                [1, 5, 10].map((n) => h('button', { class: `btn center ${this.qty === n ? 'focus' : ''}`, style: 'width:56px', onclick: () => { this.qty = n; this.render(); } }, `×${n}`))), desc);
        const box = h('div', { class: 'list', style: 'max-height:46vh;overflow-y:auto' }); B.append(box);
        const list = this.tab === 'buy' ? shop.stock : Object.keys(G.inv).filter((i) => ITEMS[i] && ITEMS[i].type !== 'key' && ITEMS[i].price > 0);
        for (const id of list) {
            const it = ITEMS[id], price = this.tab === 'buy' ? it.price : Math.floor(it.price / 2);
            const can = this.tab === 'buy' ? G.gold >= price * this.qty : (G.inv[id] || 0) >= this.qty;
            box.append(h('button', { class: `btn ${can ? '' : 'off'}`, onfocus: () => { desc.textContent = `${it.desc} ${itemStatText(it)}`; desc.innerHTML = ''; desc.append(`${it.desc}  ${itemStatText(it)}`, ...this.equipHints(it)); }, onclick: () => {
                if (!can) { ui.env.audio.ui('error'); return; }
                const ok = ui.env.act({ type: this.tab === 'buy' ? 'buy' : 'sell', item: id, n: this.qty });
                ui.env.audio.ui(ok ? 'buy' : 'error'); const idx = [...box.children].indexOf(document.activeElement); this.render(); (box.children[Math.min(idx, box.children.length - 1)])?.focus();
            } }, it.name, h('small', {}, this.tab === 'sell' || G.inv[id] ? `(have ${G.inv[id] || 0})` : ''), h('span', { class: 'r' }, `${price} G`)));
        }
        if (!list.length) box.append(h('p', { class: 'desc' }, this.tab === 'buy' ? 'Sold out.' : 'You have nothing to sell.'));
        B.append(h('div', { class: 'foot' }, h('button', { class: 'btn primary center', onclick: () => this.close() }, 'Leave')));
        if (!box.contains(document.activeElement)) focusables(box)[0]?.focus();
    }
    equipHints(it) {
        if (!['weapon', 'armor', 'charm'].includes(it.type)) return [];
        const G = this.G, out = [];
        for (const id of [...G.party.active, ...G.party.reserve]) {
            if (!canEquip(id, it.id)) continue;
            const m = G.party.members[id], cur = memberStats(m), ns = memberStats({ ...m, equip: { ...m.equip, [it.type]: it.id } });
            const main = it.type === 'weapon' ? (ns.mag - cur.mag) + (ns.atk - cur.atk) : (ns.def - cur.def) + (ns.res - cur.res) + Math.round((ns.mhp - cur.mhp) / 8);
            out.push(h('span', { style: `margin-left:8px;color:${main > 0 ? 'var(--good)' : main < 0 ? 'var(--bad)' : 'var(--dim)'}` }, `${CHARS[id].name} ${main > 0 ? '▲' : main < 0 ? '▼' : '='}`));
        }
        return out;
    }
}

// ------------------------------------------------------------------------------------------------ notice board
export class Board {
    constructor(ui) { this.ui = ui; this.scr = null; }
    get G() { return this.ui.G; }
    open() {
        this.body = h('div', { class: 'sheet win', style: 'width:min(660px,100%)' });
        this.scr = this.ui.open(this.body, { id: 'board', back: () => this.close() });
        this.render();
    }
    close() { if (!this.scr) return; this.ui.close(this.scr); this.scr = null; this.ui.env.act({ type: 'closeBoard' }); }
    render() {
        const G = this.G, ui = this.ui, B = this.body, town = G.board?.town || G.map; B.innerHTML = '';
        const avail = Q.ensureBoard(G, town);
        B.append(h('h2', { class: 't' }, `Notice Board — ${LOCS[town]?.name}`));
        const row = (q, ctl) => h('div', { class: 'quest' }, h('b', {}, q.title), h('div', {}, q.text), h('div', { class: 'desc' }, `Reward: ${q.reward.gold} G${q.reward.items?.length ? ' + ' + q.reward.items.map(([i, n]) => `${n}× ${ITEMS[i].name}`).join(', ') : ''}`), ctl);
        B.append(h('div', { style: 'color:var(--dim);font-size:11px;letter-spacing:0.15em;margin:2px 0' }, 'AVAILABLE'));
        avail.forEach((q, i) => B.append(row(q, h('button', { class: 'btn center', style: 'min-height:34px', onclick: () => { ui.env.act({ type: 'acceptQuest', idx: i }); ui.env.audio.play('quest'); this.render(); } }, 'Accept'))));
        if (!avail.length) B.append(h('p', { class: 'desc' }, 'The board is bare. Come back after you have seen more of the world.'));
        const mine = G.quests.active.filter((q) => q.from === 'board' && q.town === town);
        if (mine.length) {
            B.append(h('div', { style: 'color:var(--dim);font-size:11px;letter-spacing:0.15em;margin:8px 0 2px' }, 'YOUR JOBS HERE'));
            for (const q of mine) {
                const st = Q.status(G, q);
                B.append(row(q, h('button', { class: `btn center ${st.ready ? 'primary' : 'off'}`, style: 'min-height:34px', onclick: () => { if (!st.ready) { ui.env.audio.ui('error'); return; } ui.env.act({ type: 'turnIn', id: q.id }); ui.env.audio.play('questdone'); this.render(); } }, st.ready ? 'Turn in' : `${st.have}/${st.need}`)));
            }
        }
        B.append(h('div', { class: 'foot' }, h('button', { class: 'btn primary center', onclick: () => this.close() }, 'Close')));
        focusables(B)[0]?.focus();
    }
}
