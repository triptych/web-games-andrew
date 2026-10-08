/**
 * craftui.js — crafting stations (smelter, tanning frame, forge, cooking pot), honing at the
 * whetstone and armourer's bench, the alchemy still (lead + supports, study), the rune table
 * (inscribe, recharge), the pin-tumbler lockpicking game, the book reader and favourites.
 */
import { h, Panel, ListView } from './ui.js';
import { itemDef, itemName, ITEMS, TEMPER } from '../sim/items.js';
import { countItem } from '../sim/inventory.js';
import { EFFECTS, effectText } from '../sim/effects.js';
import { STATION_RECIPES, STATION_NAMES, canMake, make, canHone, hone, honeMax, honeMaterial, previewBrew, brew, study, brewText, knownOf, runesKnown, runeFits, inscribePreview, inscribe, recharge, ESSENCE_FACTOR, lockParams, LOCKS } from '../sim/crafting.js';
import { itemCard } from './inventory.js';
import { BOOKS } from '../sim/books.js';
import { SPELLS } from '../sim/magic.js';

// ------------------------------------------------------------------ recipe stations
export class StationPanel extends Panel {
    constructor(ui, station) {
        super(ui);
        this.st = station;
        this.type = station.type;
        this.title(STATION_NAMES[this.type] || 'Crafting');
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.go(r) });
        this.detail = h('div.detail.scroll');
        this.foot = h('div.foot');
        this.box.append(h('div.split', {}, this.list.el, this.detail), this.foot);
        this.onlyMakeable = false;
        this.refresh();
    }
    get honing() { return this.type === 'grindstone' || this.type === 'workbench'; }
    refresh() {
        const p = this.app.world.player;
        const rows = [];
        if (this.honing) {
            for (const e of p.inv) {
                const d = itemDef(e);
                if (!d || (this.type === 'grindstone' ? d.type !== 'weapon' : d.type !== 'armor') || d.clothing) continue;
                const ok = canHone(p, e, this.type);
                rows.push({ key: `${e.id}:${e.name || ''}:${e.temper || 0}`, label: itemName(e), value: ok ? '' : '—', cls: ok ? '' : 'dim', data: { entry: e } });
            }
            if (!rows.length) rows.push({ key: 'none', label: this.type === 'grindstone' ? 'You carry no weapons to hone.' : 'You carry no armour to hone.', cls: 'dim' });
        } else {
            const recipes = STATION_RECIPES[this.type] || [];
            let group = null;
            for (const r of recipes) {
                const ok = canMake(p, r);
                if (this.onlyMakeable && !ok) continue;
                if (r.perk && !p.sheet.perks[r.perk] && !ok) continue;
                if (r.group && r.group !== group) { rows.push({ key: `g${r.group}`, label: r.group, head: true }); group = r.group; }
                rows.push({ key: r.out + r.need.map((x) => x[0]).join(), label: `${ITEMS[r.out]?.name || r.out}${r.n > 1 ? ` ×${r.n}` : ''}`, cls: ok ? '' : 'dim', value: ok ? '✓' : '', data: { recipe: r } });
            }
            if (!rows.length) rows.push({ key: 'none', label: 'Nothing you can make here.', cls: 'dim' });
        }
        this.list.set(rows);
        this.foot.innerHTML = '';
        this.foot.append(h('span.stat', { html: `Smithing <b>${p.sheet.skills.smithing}</b>` }), h('span.sp'));
        if (!this.honing) this.foot.appendChild(h('button.mbtn', { text: this.onlyMakeable ? 'Show all' : 'Only what I can make', on: { click: () => { this.onlyMakeable = !this.onlyMakeable; this.refresh(); } } }));
        this.foot.appendChild(h('button.mbtn.gold', { text: this.honing ? 'Hone' : 'Make', on: { click: () => this.go(this.list.current) } }));
    }
    show(r) {
        this.detail.innerHTML = '';
        if (!r?.data) return;
        const p = this.app.world.player;
        if (r.data.recipe) {
            const rc = r.data.recipe;
            this.detail.appendChild(itemCard(this.app, { id: rc.out, n: rc.n }));
            const need = h('div.card', {}, h('p', { html: '<b>Needs</b>' }));
            for (const [id, n] of rc.need) { const have = countItem(p, id); need.appendChild(h('p', { cls: have >= n ? '' : 'redt', text: `${ITEMS[id]?.name || id}: ${have} / ${n}` })); }
            if (rc.perk) need.appendChild(h('p', { cls: p.sheet.perks[rc.perk] ? 'faint' : 'redt', text: `Requires the ${rc.perk.replace('smith_', '')} smithing perk` }));
            this.detail.appendChild(need);
        } else {
            const e = r.data.entry, d = itemDef(e);
            this.detail.appendChild(itemCard(this.app, e));
            const max = honeMax(p.sheet, d);
            this.detail.appendChild(h('div.card', {}, h('p', { text: `Current grade: ${TEMPER[e.temper || 0] || 'Plain'} · Best you can manage: ${TEMPER[max]}` }), h('p', { text: `Uses one ${ITEMS[honeMaterial(d)]?.name} (you have ${countItem(p, honeMaterial(d))}).` })));
        }
    }
    go(r) {
        if (!r?.data) return;
        const w = this.app.world;
        const ok = r.data.recipe ? make(w, r.data.recipe, this.type) : hone(w, r.data.entry, this.type);
        if (!ok) this.ui.toast(r.data.recipe ? 'You lack what this needs.' : 'You cannot improve that further here.');
        else this.app.audio?.craft(this.type);
        this.refresh();
    }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.go(this.list.current); return true; }
        return false;
    }
}

// ------------------------------------------------------------------ the alchemy still
export class AlchemyPanel extends Panel {
    constructor(ui) {
        super(ui);
        this.title('Alchemy Still');
        this.lead = null; this.supports = [];
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.pick(r) });
        this.detail = h('div.detail.scroll');
        this.foot = h('div.foot');
        this.box.append(h('div.split', {}, this.list.el, this.detail), this.foot);
        this.refresh();
    }
    refresh() {
        const w = this.app.world, p = w.player;
        const rows = p.inv.filter((e) => itemDef(e)?.type === 'ingredient').sort((a, b) => itemName(a).localeCompare(itemName(b))).map((e) => {
            const k = knownOf(w, e.id);
            const role = this.lead === e ? 'LEAD' : this.supports.includes(e) ? '+' : '';
            return { key: e.id, label: `${itemName(e)} (${e.n})`, value: `${k.essence ? EFFECTS[itemDef(e).essence].name : '?'}`, mark: role === 'LEAD' ? '◆' : role, data: e };
        });
        if (!rows.length) rows.push({ key: 'none', label: 'You carry no ingredients.', cls: 'dim' });
        this.list.set(rows);
        this.renderBrew();
    }
    show(r) { this.list.current; this.renderBrew(r?.data); }
    renderBrew(hover = null) {
        const w = this.app.world;
        this.detail.innerHTML = '';
        if (hover) this.detail.appendChild(itemCard(this.app, hover));
        const card = h('div.card', {}, h('h3', { text: 'The brew' }));
        card.appendChild(h('p', { text: `Lead: ${this.lead ? itemName(this.lead) : '— choose a lead ingredient —'}` }));
        card.appendChild(h('p', { text: `Supports: ${this.supports.map((s) => itemName(s)).join(', ') || '—'}` }));
        if (this.lead) {
            const pv = previewBrew(w, this.lead, this.supports);
            if (pv) card.append(h('p', { cls: 'goldt', text: pv.name }), h('p', { text: brewText(pv) }), h('p.faint', { text: `Worth about ${pv.value} gold` }));
        }
        card.appendChild(h('p.faint', { text: 'The lead gives its essence; supports with a matching note strengthen it, others add their note as a weaker second effect.' }));
        this.detail.appendChild(card);
        this.foot.innerHTML = '';
        this.foot.append(h('span.stat', { html: `Alchemy <b>${w.player.sheet.skills.alchemy}</b>` }), h('span.sp'),
            h('button.mbtn', { text: 'Study', on: { click: () => this.study() } }), h('button.mbtn', { text: 'Clear', on: { click: () => { this.lead = null; this.supports = []; this.refresh(); } } }),
            h('button.mbtn.gold', { text: 'Brew', disabled: this.lead ? null : '', on: { click: () => this.brew() } }));
    }
    pick(r) {
        if (!r?.data) return;
        const e = r.data;
        if (this.lead === e) { this.lead = null; }
        else if (this.supports.includes(e)) this.supports = this.supports.filter((s) => s !== e);
        else if (!this.lead) this.lead = e;
        else if (this.supports.length < 2) this.supports.push(e);
        this.refresh();
    }
    study() {
        const e = this.list.current?.data; if (!e) return;
        const id = study(this.app.world, e);
        this.ui.toast(id ? `You learn something: ${EFFECTS[id]?.name}.` : 'You know all this ingredient can teach.');
        if (this.lead === e && !this.app.world.player.inv.includes(e)) this.lead = null;
        this.supports = this.supports.filter((s) => this.app.world.player.inv.includes(s));
        this.refresh();
    }
    brew() {
        if (!this.lead) return;
        const out = brew(this.app.world, this.lead, this.supports);
        if (out) { this.app.audio?.craft('alchemy'); this.ui.toast(`Brewed ${out.name}`); }
        const inv = this.app.world.player.inv;
        if (!inv.includes(this.lead)) this.lead = null;
        this.supports = this.supports.filter((s) => inv.includes(s));
        this.refresh();
    }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.pick(this.list.current); return true; }
        if (a === 'take' || a === 'alt2') { this.brew(); return true; }
        if (a === 'alt') { this.study(); return true; }
        return false;
    }
}

// ------------------------------------------------------------------ the rune table
export class RunePanel extends Panel {
    constructor(ui) {
        super(ui);
        this.title('Rune Table');
        this.step = 'item'; this.item = null; this.rune = null; this.ess = null;
        this.list = new ListView({ onSelect: () => this.render(), onActivate: (r) => this.pick(r) });
        this.detail = h('div.detail.scroll');
        this.foot = h('div.foot');
        this.box.append(h('div.split', {}, this.list.el, this.detail), this.foot);
        this.refresh();
    }
    refresh() {
        const w = this.app.world, p = w.player;
        const rows = [];
        if (this.step === 'item') {
            rows.push({ key: 'h1', label: 'Inscribe', head: true });
            for (const e of p.inv) { const d = itemDef(e); if (!d || e.ench || d.ench || !['weapon', 'armor', 'jewelry'].includes(d.type) || d.wtype === 'staff' || d.bow && false) continue; rows.push({ key: `i${e.id}${e.temper || 0}${p.inv.indexOf(e)}`, label: itemName(e), data: { item: e } }); }
            const charged = p.inv.filter((e) => e.chargeMax && e.charge < e.chargeMax);
            if (charged.length) { rows.push({ key: 'h2', label: 'Recharge', head: true }); for (const e of charged) rows.push({ key: `c${p.inv.indexOf(e)}`, label: `${itemName(e)} (${Math.round(e.charge)}/${e.chargeMax})`, data: { recharge: e } }); }
        } else if (this.step === 'rune') {
            const d = itemDef(this.item);
            for (const id of runesKnown(w)) if (runeFits(d, id)) rows.push({ key: id, label: EFFECTS[id]?.name || id, data: { rune: id } });
            if (!rows.length) rows.push({ key: 'none', label: 'You know no runes that fit this. Study rune-books.', cls: 'dim' });
        } else if (this.step === 'ess' || this.step === 'rechargeEss') {
            for (const e of p.inv) if (ESSENCE_FACTOR[e.id]) rows.push({ key: e.id, label: `${itemName(e)} (${e.n})`, data: { ess: e } });
            if (!rows.length) rows.push({ key: 'none', label: 'You carry no essences.', cls: 'dim' });
        }
        if (rows.length === 0 || rows.every((r) => r.head)) rows.push({ key: 'none2', label: 'Nothing to work on.', cls: 'dim' });
        this.list.set(rows);
        this.render();
    }
    render() {
        const w = this.app.world;
        this.detail.innerHTML = '';
        const card = h('div.card', {}, h('h3', { text: { item: 'Choose an item', rune: 'Choose a rune', ess: 'Choose an essence', rechargeEss: 'Choose an essence' }[this.step] }));
        if (this.item) card.appendChild(h('p', { text: `Item: ${itemName(this.item)}` }));
        if (this.rune) card.appendChild(h('p', { text: `Rune: ${EFFECTS[this.rune].name}` }));
        const cur = this.list.current?.data;
        const essId = this.step === 'ess' ? cur?.ess?.id : this.ess?.id;
        if (this.item && this.rune && essId) {
            const pv = inscribePreview(w, this.item, this.rune, essId);
            card.append(h('p.goldt', { text: pv.name }), h('p', { text: effectText(pv.ench.id, pv.ench.mag, pv.ench.dur) }));
            if (pv.charge) card.appendChild(h('p.faint', { text: `${pv.charge} charge` }));
        }
        card.appendChild(h('p.faint', { text: `Known runes: ${runesKnown(w).length}. Runecraft ${w.player.sheet.skills.enchanting}.` }));
        this.detail.appendChild(card);
        this.foot.innerHTML = '';
        this.foot.append(h('span.sp'), this.step !== 'item' ? h('button.mbtn', { text: 'Back', on: { click: () => this.back() } }) : null);
    }
    pick(r) {
        if (!r?.data) return;
        const w = this.app.world;
        if (r.data.item) { this.item = r.data.item; this.step = 'rune'; }
        else if (r.data.recharge) { this.item = r.data.recharge; this.step = 'rechargeEss'; }
        else if (r.data.rune) { this.rune = r.data.rune; this.step = 'ess'; }
        else if (r.data.ess) {
            if (this.step === 'rechargeEss') { recharge(w, this.item, r.data.ess); this.ui.toast('Recharged.'); }
            else { const out = inscribe(w, this.item, this.rune, r.data.ess); if (out) { this.ui.toast(`Inscribed ${out.name}`); this.app.audio?.craft('runetable'); } }
            this.item = this.rune = null; this.step = 'item';
        }
        this.refresh();
    }
    back() { if (this.step === 'ess') { this.rune = null; this.step = 'rune'; } else { this.item = null; this.rune = null; this.step = 'item'; } this.refresh(); }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.pick(this.list.current); return true; }
        if (a === 'back' && this.step !== 'item') { this.back(); return true; }
        return false;
    }
}

// ------------------------------------------------------------------ lockpicking: pin tumblers
export class LockPanel extends Panel {
    /** target: { level, onOpen } */
    constructor(ui, target) {
        super(ui, 'small');
        this.target = target;
        const p = ui.app.world.player;
        this.P = lockParams(target.level, p.sheet);
        this.title(`${LOCKS[target.level]} Lock`);
        this.pinsEl = h('div.pins');
        this.pins = [];
        for (let i = 0; i < this.P.pins; i++) {
            const el = h('div.pin', {}, h('div.shear', { style: { top: '50%' } }), h('i'));
            this.pinsEl.appendChild(el);
            this.pins.push({ el, ph: Math.random() * 6.28, sp: this.P.speed * (0.8 + Math.random() * 0.5), set: false, y: 0 });
        }
        this.cur = 0;
        this.info = h('p.dim', { style: { textAlign: 'center' } });
        this.box.appendChild(h('div.lock', {}, this.pinsEl, this.info, h('div.row', {}, h('button.mbtn.gold', { text: 'Set pin', on: { click: () => this.setPin() } }), h('button.mbtn', { text: 'Give up', on: { click: () => ui.pop() } }))));
        this.box.addEventListener('pointerdown', (e) => { if (e.target.closest('.pins')) this.setPin(); });
        this.renderInfo();
    }
    renderInfo() { const n = countItem(this.app.world.player, 'lockpick'); this.info.textContent = `Lockpicks: ${n}. Tap or press E when the gold pin crosses the blue line.`; }
    update(dt) {
        this.pins.forEach((pn, i) => {
            pn.el.classList.toggle('cur', i === this.cur);
            pn.el.classList.toggle('set', pn.set);
            if (pn.set) { pn.y = 0.5; } else { pn.ph += dt * pn.sp * 3; pn.y = 0.5 + Math.sin(pn.ph) * 0.42; }
            pn.el.lastChild.style.top = `calc(${pn.y * 100}% - 15px)`;
        });
    }
    setPin() {
        const w = this.app.world, p = w.player;
        if (countItem(p, 'lockpick') <= 0) { this.ui.toast('You have no lockpicks.'); this.ui.pop(); return; }
        const pn = this.pins[this.cur];
        if (Math.abs(pn.y - 0.5) < this.P.window) {
            pn.set = true; this.cur++;
            this.app.audio?.ui('pinSet');
            w.skillUse(p, 'lockpicking', 0.6);
            if (this.cur >= this.pins.length) {
                w.skillUse(p, 'lockpicking', 2 + this.target.level * 2);
                this.ui.pop();
                this.target.onOpen();
                return;
            }
        } else {
            this.app.audio?.ui('pinSlip');
            if (this.cur > 0) { this.cur--; this.pins[this.cur].set = false; }
            if (Math.random() < this.P.breakChance) {
                const e = p.inv.find((x) => x.id === 'lockpick');
                if (e) { e.n--; if (e.n <= 0) p.inv.splice(p.inv.indexOf(e), 1); }
                this.ui.toast('Your lockpick snaps.');
                this.app.audio?.ui('pickBreak');
                this.renderInfo();
                if (this.target.owner && !w.isOwnerOk(this.target.owner)) w.crime('lockpick', this.target.owner, 5);
            }
        }
    }
    action(a) { if (a === 'ok' || a === 'take') { this.setPin(); return true; } return false; }
}

// ------------------------------------------------------------------ books
export class BookPanel extends Panel {
    constructor(ui, entry) {
        super(ui, '', '');
        this.box.className = 'book';
        const d = itemDef(entry);
        const book = BOOKS[d.book || d.id] || { title: d.name, text: d.desc || 'The pages are blank.' };
        this.pages = paginate(book.text, 1100);
        this.i = 0;
        this.title_ = book.title;
        this.left = h('div.pg'); this.right = h('div.pg');
        this.nav = h('div.nav', {}, h('button', { text: '◀ Prev', on: { click: () => this.turn(-2) } }), h('button', { text: 'Close', on: { click: () => ui.pop() } }), h('button', { text: 'Next ▶', on: { click: () => this.turn(2) } }));
        this.box.append(this.left, this.right, this.nav);
        this.render();
        // the first read of a skill book or rune-book teaches
        const w = ui.app.world;
        if (book.skill && !w.flags[`read:${d.id}`]) { w.flags[`read:${d.id}`] = true; w.skillUse(w.player, book.skill, 9999); w.emit('note', { text: `Reading ${book.title} sharpens your ${book.skill}.` }); }
        if (!w.flags[`read:${d.id}`]) w.flags[`read:${d.id}`] = true;
        w.emit('bookRead', { id: d.id });
    }
    render() {
        this.left.innerHTML = ''; this.right.innerHTML = '';
        if (this.i === 0) this.left.appendChild(h('h2', { text: this.title_ }));
        this.left.appendChild(document.createTextNode(this.pages[this.i] || ''));
        this.right.textContent = this.pages[this.i + 1] || '';
    }
    turn(d) { this.i = Math.max(0, Math.min(this.pages.length - 1 - ((this.pages.length - 1) % 2), this.i + d)); this.render(); }
    action(a) { if (a === 'right' || a === 'down') { this.turn(2); return true; } if (a === 'left' || a === 'up') { this.turn(-2); return true; } return false; }
}
function paginate(text, per) {
    const words = text.split(/(\s+)/);
    const out = []; let cur = '';
    for (const w of words) { if ((cur + w).length > per && cur.trim()) { out.push(cur.trim()); cur = ''; } cur += w; }
    if (cur.trim()) out.push(cur.trim());
    return out.length ? out : [''];
}

// ------------------------------------------------------------------ favourites (Q)
export class FavoritesPanel extends Panel {
    constructor(ui) {
        super(ui, 'small', 'clear');
        this.title('Favourites');
        const p = ui.app.world.player;
        this.list = new ListView({ onActivate: (r) => this.use(r, 'right'), onAlt: (r) => this.use(r, 'left') });
        const rows = [];
        for (const id of p.favorites) {
            if (SPELLS[id] && p.spells.includes(id)) rows.push({ key: id, label: SPELLS[id].name, value: 'spell', data: { spell: id } });
            else { const e = p.inv.find((x) => x.id === id); if (e) rows.push({ key: id, label: itemName(e), value: e.n > 1 ? e.n : '', data: { entry: e } }); }
        }
        if (!rows.length) rows.push({ key: 'none', label: 'Mark items and spells as favourites (F) in their menus.', cls: 'dim' });
        this.list.set(rows);
        this.box.append(this.list.el, h('div.foot', {}, h('span.hint2', { text: 'E: right hand / use · R: left hand' })));
        this.list.el.style.maxHeight = '50vh';
    }
    use(r, hand) {
        if (!r?.data) return;
        const app = this.app, p = app.world.player;
        if (r.data.spell) { p.hands[hand] = r.data.spell; if (p.equip[hand]?.id && itemDef(p.equip[hand])?.type === 'weapon') p.equip[hand] = null; }
        else { const d = itemDef(r.data.entry); if (['weapon', 'armor', 'jewelry', 'ammo', 'torch'].includes(d.type)) { app.equip(r.data.entry, hand); } else app.world.useItem(r.data.entry); }
        p.dirty = true;
        this.ui.pop();
    }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.use(this.list.current, 'right'); return true; }
        if (a === 'alt') { this.use(this.list.current, 'left'); return true; }
        return false;
    }
}
