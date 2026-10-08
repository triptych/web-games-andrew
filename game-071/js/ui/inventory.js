/**
 * inventory.js — the item menus: inventory (categories, compare, equip, use, drop, favourite),
 * containers and corpses (take / store), barter with merchants, and pickpocketing.
 * Item cards show stats against what is equipped and a slowly turning 3D model.
 */
import * as THREE from 'three';
import { h, Panel, ListView } from './ui.js';
import { itemDef, itemName, itemValue, weaponDamage, armorRating, category, ITEMS } from '../sim/items.js';
import { addItem, removeItem, equip, isEquipped, carryWeight, unequipEntry } from '../sim/inventory.js';
import { effectText, EFFECTS } from '../sim/effects.js';
import { SPELLS } from '../sim/magic.js';
import { price, merchantBuys, buy, sell, pickpocketChance } from '../sim/crafting.js';
import { weaponMesh } from '../view/humanoid.js';
import { makeCharacterMaterial } from '../view/rig.js';

const CATS = [['all', 'All'], ['weapons', 'Weapons'], ['apparel', 'Apparel'], ['potions', 'Potions'], ['food', 'Food'], ['ingredients', 'Ingredients'], ['books', 'Books'], ['scrolls', 'Scrolls'], ['keys', 'Keys'], ['misc', 'Misc']];
const SLOT_OF = (d) => (d.type === 'weapon' ? 'right' : d.slot === 'shield' ? 'left' : d.slot);

// ------------------------------------------------------------------ the turning model
let preview = null;
function getPreview() {
    if (preview) return preview;
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    let r;
    try { r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return null; }
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdde4ee, 0x2a241c, 1.2));
    const d = new THREE.DirectionalLight(0xfff2e0, 2.4); d.position.set(1, 2, 2); scene.add(d);
    const cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 20);
    const holder = new THREE.Group(); scene.add(holder);
    const mat = makeCharacterMaterial();
    preview = { canvas, r, scene, cam, holder, mat, mesh: null, id: null, t: 0 };
    const tick = () => {
        if (!preview.canvas.isConnected) { preview.raf = null; return; }
        preview.t += 0.016;
        holder.rotation.y = preview.t * 0.6;
        r.render(scene, cam);
        preview.raf = requestAnimationFrame(tick);
    };
    preview.start = () => { if (!preview.raf) preview.raf = requestAnimationFrame(tick); };
    return preview;
}
function showModel(id) {
    const P = getPreview();
    if (!P) return null;
    if (P.id !== id) {
        if (P.mesh) { P.holder.remove(P.mesh); P.mesh.geometry.dispose(); }
        P.mesh = weaponMesh(id, P.mat);
        P.id = id;
        if (P.mesh) {
            P.mesh.geometry.computeBoundingSphere();
            const bs = P.mesh.geometry.boundingSphere;
            P.mesh.position.set(-bs.center.x, -bs.center.y, -bs.center.z);
            const d = ITEMS[id];
            P.holder.rotation.z = d?.slot === 'shield' ? 0 : d?.bow ? 0 : 0.9;
            P.holder.rotation.x = d?.slot === 'shield' ? Math.PI / 2 - 0.3 : 0;
            P.holder.add(P.mesh);
            P.cam.position.set(0, 0, bs.radius * 3.4);
            P.cam.lookAt(0, 0, 0);
        }
    }
    P.start();
    return P.mesh ? P.canvas : null;
}

// ------------------------------------------------------------------ item card
export function itemCard(app, entry, opts = {}) {
    const p = app.world.player;
    const d = itemDef(entry);
    const card = h('div.card');
    if (!d) return card;
    const model = (d.type === 'weapon' || d.slot === 'shield' || d.type === 'torch') ? showModel(d.id) : null;
    if (model) card.appendChild(model);
    card.appendChild(h('h3', { text: itemName(entry) + (entry.n > 1 ? ` (${entry.n})` : '') }));
    const stats = h('div.stats');
    const stat = (label, v, cmp = null) => {
        const b = h('b', { text: String(v) });
        if (cmp != null && cmp !== v) b.className = v > cmp ? 'up' : 'down';
        stats.appendChild(h('div', {}, b, label));
    };
    if (d.type === 'weapon') {
        const cur = p.equip.right ? itemDef(p.equip.right) : null;
        stat('Damage', weaponDamage(entry), cur?.type === 'weapon' ? weaponDamage(p.equip.right) : null);
    } else if (d.type === 'armor') {
        const slot = SLOT_OF(d);
        const cur = p.equip[slot];
        stat('Armour', Math.round(armorRating(entry)), cur && cur !== entry ? Math.round(armorRating(cur)) : null);
    }
    stat('Weight', d.weight ?? 0);
    stat('Value', opts.price ?? itemValue(entry));
    card.appendChild(stats);
    const lines = [];
    const ench = entry.ench || d.ench;
    if (ench) lines.push(effectText(ench.id, ench.mag, ench.dur));
    for (const ef of [...(d.effects || []).filter(() => d.type !== 'ingredient'), ...(entry.effects || [])]) lines.push(effectText(ef.id, ef.mag, ef.dur));
    if (d.type === 'ingredient') {
        const k = app.world.alchemyKnown[d.id] || {};
        lines.push(`Essence: ${k.essence ? EFFECTS[d.essence]?.name : '?'} · Note: ${k.note ? EFFECTS[d.note]?.name : '?'}`);
    }
    if (d.type === 'spelltome') lines.push(`Teaches the spell ${SPELLS[d.spell]?.name}.${p.spells.includes(d.spell) ? ' (Known)' : ''}`);
    if (d.rune) lines.push(`Teaches the rune of ${EFFECTS[d.rune]?.name}.`);
    if (entry.chargeMax) lines.push(`Charge ${Math.round(entry.charge || 0)} / ${entry.chargeMax}`);
    if (entry.poison) lines.push(`Poisoned: ${entry.poison.name}`);
    if (d.desc) lines.push(d.desc);
    if (d.essence && d.type !== 'ingredient') lines.push('');
    if (entry.stolen) lines.push('Stolen.');
    if (d.type === 'essence') lines.push('Fuel for runecraft and for recharging enchanted weapons.');
    for (const l of lines) if (l) card.appendChild(h('p', { text: l }));
    return card;
}

function rowsFor(app, inv, cat, valueFn = null, filter = null) {
    const p = app.world.player;
    const list = inv.filter((e) => (cat === 'all' || category(e) === cat) && (!filter || filter(e)));
    list.sort((a, b) => category(a).localeCompare(category(b)) || itemName(a).localeCompare(itemName(b)));
    return list.map((e) => {
        const d = itemDef(e);
        const eq = inv === p.inv && isEquipped(p, e);
        const fav = p.favorites.includes(e.id);
        return { key: `${e.id}:${e.name || ''}:${e.temper || 0}:${e.ench?.id || ''}`, label: `${itemName(e)}${e.n > 1 ? ` (${e.n})` : ''}`, value: valueFn ? valueFn(e) : '', mark: eq ? '◆' : fav ? '★' : '', cls: `${e.stolen ? 'stolen' : ''} ${e.ench || d?.ench ? 'ench' : ''}`, data: e };
    });
}

// ------------------------------------------------------------------ inventory
export class InventoryPanel extends Panel {
    constructor(ui) {
        super(ui);
        this.cat = 'all';
        this.title('Items');
        this.tabs = h('div.tabs');
        CATS.forEach(([k, t]) => this.tabs.appendChild(h('button.tab', { text: t, 'data-k': k, on: { click: () => this.setCat(k) } })));
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.use(r), onAlt: (r) => this.drop(r) });
        this.detail = h('div.detail.scroll');
        this.foot = h('div.foot');
        this.box.append(this.tabs, h('div.split', {}, this.list.el, this.detail), this.foot);
        this.setCat('all');
    }
    setCat(k) { this.cat = k; [...this.tabs.children].forEach((t) => t.classList.toggle('on', t.dataset.k === k)); this.refresh(); }
    refresh() {
        const p = this.app.world.player;
        const rows = rowsFor(this.app, p.inv, this.cat, (e) => itemDef(e)?.weight ? `${itemDef(e).weight}` : '');
        if (!rows.length) rows.push({ key: 'empty', label: 'Nothing here', cls: 'dim' });
        this.list.set(rows);
        this.foot.innerHTML = '';
        const cw = carryWeight(p);
        this.foot.append(h('span.stat', { html: `Gold <b>${p.gold}</b>` }), h('span.stat', { html: `Carry <b class="${cw > p.stats.carry ? 'redt' : ''}">${Math.round(cw)}</b> / ${Math.round(p.stats.carry)}` }), h('span.stat', { html: `Armour <b>${Math.round(p.stats.armor)}</b>` }),
            h('span.sp'), h('span.hint2', { text: 'E use/equip · X left hand · R drop · F favourite' }));
    }
    show(r) {
        this.detail.innerHTML = '';
        if (!r?.data) return;
        this.detail.appendChild(itemCard(this.app, r.data));
        const d = itemDef(r.data);
        const btns = h('div.row');
        const verb = d.type === 'weapon' || d.type === 'armor' || d.type === 'jewelry' || d.type === 'ammo' || d.type === 'torch' ? (isEquipped(this.app.world.player, r.data) ? 'Unequip' : 'Equip') : d.type === 'book' || d.type === 'spelltome' ? 'Read' : d.type === 'poison' ? 'Apply' : ['potion', 'food', 'ingredient'].includes(d.type) ? 'Use' : null;
        if (verb) btns.appendChild(h('button.mbtn.gold', { text: verb, on: { click: () => this.use(r) } }));
        if (d.type === 'weapon' && !d.two) btns.appendChild(h('button.mbtn', { text: 'Left hand', on: { click: () => this.use(r, 'left') } }));
        if (!d.quest) btns.appendChild(h('button.mbtn', { text: 'Drop', on: { click: () => this.drop(r) } }));
        btns.appendChild(h('button.mbtn', { text: this.app.world.player.favorites.includes(d.id) ? 'Unfavourite' : 'Favourite', on: { click: () => this.fav(r) } }));
        this.detail.appendChild(btns);
    }
    use(r, hand = 'right') {
        if (!r?.data) return;
        const w = this.app.world, p = w.player, e = r.data, d = itemDef(e);
        if (['weapon', 'armor', 'jewelry', 'ammo', 'torch'].includes(d.type)) {
            equip(p, e, hand);
            if (d.type === 'weapon') p.hands[hand] = null;
            p.dirty = true;
            this.app.audio?.ui(d.type === 'weapon' ? 'equipWeapon' : 'equipArmor');
        } else if (d.type === 'book' && !d.rune && !d.spell) { this.ui.show('book', e); return; }
        else w.useItem(e);
        this.refresh();
    }
    drop(r) {
        if (!r?.data) return;
        const w = this.app.world, p = w.player, e = r.data, d = itemDef(e);
        if (d.quest) { this.ui.toast('You cannot drop that.'); return; }
        const n = e.n > 1 ? (e.n > 5 ? 1 : e.n) : 1;
        if (isEquipped(p, e)) unequipEntry(p, e);
        const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        w.dropItem({ ...e, n: undefined }, n, { x: p.pos.x + fx * 0.8, y: w.space.ground(p.pos.x + fx * 0.8, p.pos.z + fz * 0.8, p.pos.y + 1) + 0.05, z: p.pos.z + fz * 0.8 });
        removeItem(p, e, n);
        p.dirty = true;
        this.refresh();
    }
    fav(r) {
        if (!r?.data) return;
        const f = this.app.world.player.favorites, id = r.data.id;
        const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id);
        this.refresh();
    }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.use(this.list.current); return true; }
        if (a === 'alt') { this.drop(this.list.current); return true; }
        if (a === 'alt2') { this.use(this.list.current, 'left'); return true; }
        if (a === 'fav') { this.fav(this.list.current); return true; }
        const i = CATS.findIndex(([k]) => k === this.cat);
        if (a === 'right' || a === 'nextTab') { this.setCat(CATS[(i + 1) % CATS.length][0]); return true; }
        if (a === 'left' || a === 'prevTab') { this.setCat(CATS[(i - 1 + CATS.length) % CATS.length][0]); return true; }
        return false;
    }
}

// ------------------------------------------------------------------ two-sided transfer panels
class TransferPanel extends Panel {
    constructor(ui, title) {
        super(ui);
        this.title(title);
        this.side = 0;   // 0 = theirs, 1 = mine
        this.tabs = h('div.tabs');
        this.tabTheirs = h('button.tab.on', { text: 'Theirs', on: { click: () => this.setSide(0) } });
        this.tabMine = h('button.tab', { text: 'Yours', on: { click: () => this.setSide(1) } });
        this.tabs.append(this.tabTheirs, this.tabMine);
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.move(r) });
        this.detail = h('div.detail.scroll');
        this.foot = h('div.foot');
        this.box.append(this.tabs, h('div.split', {}, this.list.el, this.detail), this.foot);
    }
    setSide(s) { this.side = s; this.tabTheirs.classList.toggle('on', s === 0); this.tabMine.classList.toggle('on', s === 1); this.refresh(); }
    show(r) { this.detail.innerHTML = ''; if (r?.data) this.detail.appendChild(itemCard(this.app, r.data, { price: this.priceOf?.(r.data) })); }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'left' || a === 'prevTab') { this.setSide(0); return true; }
        if (a === 'right' || a === 'nextTab') { this.setSide(1); return true; }
        if (a === 'ok') { this.move(this.list.current); return true; }
        if (a === 'take') { this.takeAll?.(); return true; }
        return false;
    }
}

export class ContainerPanel extends TransferPanel {
    /** src: { inv, gold?, name, owner, actor? } */
    constructor(ui, src) {
        super(ui, src.name || 'Container');
        this.src = src;
        this.tabTheirs.textContent = src.actor ? src.name : 'Contents';
        this.refresh();
    }
    stealing() { const w = this.app.world; return this.src.owner && !w.isOwnerOk(this.src.owner); }
    refresh() {
        const p = this.app.world.player, s = this.src;
        const inv = this.side === 0 ? s.inv : p.inv;
        const rows = rowsFor(this.app, inv, 'all', (e) => itemDef(e)?.value);
        if (this.side === 0 && s.gold > 0) rows.unshift({ key: 'gold', label: `Gold (${s.gold})`, data: null, gold: true });
        if (!rows.length) rows.push({ key: 'empty', label: 'Empty', cls: 'dim' });
        this.list.set(rows);
        this.foot.innerHTML = '';
        this.foot.append(h('span.stat', { html: `Carry <b>${Math.round(carryWeight(p))}</b> / ${Math.round(p.stats.carry)}` }), h('span.sp'),
            this.stealing() ? h('span.redt', { text: 'Owned — taking is theft' }) : null,
            h('button.mbtn', { text: 'Take all', on: { click: () => this.takeAll() } }), h('button.mbtn.gold', { text: this.side ? 'Store' : 'Take', on: { click: () => this.move(this.list.current) } }));
    }
    move(r) {
        if (!r) return;
        const w = this.app.world, p = w.player, s = this.src;
        if (r.gold) { p.gold += s.gold; if (this.stealing()) w.crime('theft', s.owner, s.gold); s.gold = 0; this.refresh(); return; }
        if (!r.data) return;
        const e = r.data, n = e.n || 1;
        if (this.side === 0) {
            const taken = { ...e, n: undefined };
            if (this.stealing()) { taken.stolen = true; w.crime('theft', s.owner, itemValue(e) * n); }
            if (s.actor && isEquipped(s.actor, e)) unequipEntry(s.actor, e);
            removeItem(s, e, n); addItem(p, taken, n);
            if (itemDef(e)?.quest) w.emit('itemTaken', { item: { entry: e } });
            w.emit('pickup', { entry: e, n, quiet: true });
        } else {
            if (itemDef(e)?.quest) { this.ui.toast('You keep that.'); return; }
            if (isEquipped(p, e)) unequipEntry(p, e);
            removeItem(p, e, n); addItem(s, { ...e, n: undefined }, n);
        }
        p.dirty = true;
        this.app.audio?.ui('take');
        this.refresh();
    }
    takeAll() { const save = this.side; this.side = 0; while (this.src.inv.length || this.src.gold > 0) { const r = this.src.gold > 0 ? { gold: true } : { data: this.src.inv[0] }; this.move(r); if (this.src.inv.length > 200) break; } this.side = save; this.refresh(); if (!this.src.actor) this.ui.pop(); }
}

export class BarterPanel extends TransferPanel {
    constructor(ui, npc, m) {
        super(ui, `Barter — ${npc.name}`);
        this.npc = npc; this.m = m;
        this.tabTheirs.textContent = 'Buy';
        this.tabMine.textContent = 'Sell';
        this.refresh();
    }
    priceOf(e) { return price(this.app.world, e, this.side === 0); }
    refresh() {
        const w = this.app.world, p = w.player;
        const inv = this.side === 0 ? this.m.inv : p.inv;
        const rows = rowsFor(this.app, inv, 'all', (e) => this.priceOf(e), this.side === 1 ? (e) => merchantBuys(this.m.kind, e, p.sheet) && !isEquipped(p, e) : null);
        if (!rows.length) rows.push({ key: 'empty', label: this.side ? 'Nothing they will buy' : 'Nothing for sale', cls: 'dim' });
        this.list.set(rows);
        this.foot.innerHTML = '';
        this.foot.append(h('span.stat', { html: `Your gold <b>${p.gold}</b>` }), h('span.stat', { html: `${this.npc.name}'s gold <b>${this.m.gold}</b>` }), h('span.sp'), h('button.mbtn.gold', { text: this.side ? 'Sell' : 'Buy', on: { click: () => this.move(this.list.current) } }));
    }
    move(r) {
        if (!r?.data) return;
        const w = this.app.world;
        const ok = this.side === 0 ? buy(w, this.m, r.data, 1) : sell(w, this.m, r.data, 1);
        if (!ok) this.ui.toast(this.side === 0 ? 'You cannot afford that.' : 'They cannot afford that.');
        else this.app.audio?.ui('coin');
        this.refresh();
    }
}

export class PickpocketPanel extends Panel {
    constructor(ui, target) {
        super(ui, 'medium');
        this.t = target;
        this.title(`Pickpocket — ${target.name}`);
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.steal(r) });
        this.detail = h('div.detail');
        this.box.append(h('div.split', {}, this.list.el, this.detail), h('div.foot', {}, h('span.hint2', { text: 'Every attempt risks being caught.' }), h('span.sp'), h('button.mbtn.gold', { text: 'Steal', on: { click: () => this.steal(this.list.current) } })));
        this.refresh();
    }
    refresh() {
        const w = this.app.world;
        const rows = [];
        if (this.t.gold > 0) rows.push({ key: 'gold', label: `Gold (${this.t.gold})`, value: `${Math.round(pickpocketChance(w, this.t, null, this.t.gold) * 100)}%`, gold: true });
        for (const e of this.t.inv) rows.push({ key: e.id + (e.name || ''), label: itemName(e) + (e.n > 1 ? ` (${e.n})` : ''), value: `${Math.round(pickpocketChance(w, this.t, e) * 100)}%`, data: e, mark: isEquipped(this.t, e) ? '◆' : '' });
        if (!rows.length) rows.push({ key: 'empty', label: 'Empty pockets', cls: 'dim' });
        this.list.set(rows);
    }
    show(r) { this.detail.innerHTML = ''; if (r?.data) this.detail.appendChild(itemCard(this.app, r.data)); }
    steal(r) {
        if (!r || (!r.data && !r.gold)) return;
        const w = this.app.world, p = w.player;
        const chance = r.gold ? pickpocketChance(w, this.t, null, this.t.gold) : pickpocketChance(w, this.t, r.data);
        w.skillUse(p, 'pickpocket', 1 + chance * 2);
        if (w.rng.chance(chance)) {
            if (r.gold) { p.gold += this.t.gold; this.t.gold = 0; }
            else { const e = r.data; removeItem(this.t, e, e.n || 1); addItem(p, { ...e, n: undefined, stolen: true }, e.n || 1); }
            w.stats.stolen++;
            this.refresh();
        } else {
            this.ui.pop();
            w.crime('pickpocket', this.t.npcId || this.t.faction, 25);
            if (this.t.ai) { this.t.detect = 1; this.t.lastHitBy = p.id; }
            w.emit('caught', { actor: this.t });
            this.ui.toast(`${this.t.name} caught you!`);
        }
    }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.steal(this.list.current); return true; }
        return false;
    }
}
