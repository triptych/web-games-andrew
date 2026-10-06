// DOM helpers, item icons and the item tooltip (with a comparison against what's equipped).

import { STAT_LABEL } from '../sim/data/items.js';
import { CLASSES } from '../sim/data/classes.js';
import { RARITY } from '../config.js';
import { displayName, sellPrice, buyPrice } from '../sim/items.js';
import { whyNot, itemScore } from '../sim/hero.js';

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const FRUIT_EMOJI = { apple: '🍎', orange: '🍊', lemon: '🍋', pear: '🍐', strawberry: '🍓', watermelon: '🍉', grape: '🍇', peach: '🍑', cherry: '🍒', banana: '🍌', pineapple: '🍍', coconut: '🥥', kiwi: '🥝', plum: '🟣', blueberry: '🫐', mango: '🥭' };
const FAMILY_EMOJI = {
    'Butter Knife': '🔪', Spork: '🍴', Cleaver: '🪓', 'Bread Knife': '🗡️', 'Pizza Wheel': '🍕', "Chef's Cleaver": '🪓', Santoku: '🗡️', 'Mythril Mandoline': '🗡️', 'Obsidian Peeler': '🌀',
    'Rolling Pin': '🪵', Baguette: '🥖', 'Giant Spatula': '🍳', 'Garden Hoe': '⛏️', 'Cast-Iron Skillet': '🍳', 'Grand Cleaver': '🪓', 'Meat-Free Tenderiser': '🔨',
    'Straw Shooter': '🥤', Slingshot: '🪃', 'Rubber-band Bow': '🏹', 'Licorice Longbow': '🏹', 'Bamboo Bow': '🏹', 'Crossbow of Crumbs': '🏹', Seedcannon: '💥', 'Harpoon of Plenty': '🔱',
    'Pretzel Wand': '🥨', Chopstick: '🥢', 'Cinnamon Stick': '🪄', 'Vanilla Pod': '🪄', 'Star-Anise Wand': '⭐', 'Saffron Scepter': '⭐', 'Truffle Baton': '🪄',
    'Celery Staff': '🥬', 'Licorice Staff': '🦯', 'Candy-Cane Staff': '🍭', 'Rhubarb Rod': '🦯', 'Sugarcane Stave': '🍭', 'Bamboo of Ages': '🎋',
    'Pot Lid': '🛡️', 'Pie Tin': '🥧', 'Cutting Board': '🟫', 'Trash-Can Lid': '🛡️', Wok: '🥘', 'Paella Pan': '🥘', 'Cauldron Lid': '🛡️',
    'Seed Pouch': '👝', 'Seed Satchel': '👝', 'Bottomless Bag': '🎒', Cornucopia: '🌽', Gumball: '🍬', Jawbreaker: '🍬', 'Snow Globe': '🔮', 'Crystal Melon': '🔮',
};
const SLOT_EMOJI = { head: '⛑️', body: '👕', hands: '🧤', feet: '👢', neck: '📿', ring: '💍' };
export function itemIcon(it) { return FAMILY_EMOJI[it.base] || SLOT_EMOJI[it.slot] || '❔'; }
export const SLOT_NAMES = { weapon: 'Weapon', offhand: 'Offhand', head: 'Head', body: 'Body', hands: 'Hands', feet: 'Feet', neck: 'Neck', ring1: 'Ring', ring2: 'Ring', ring: 'Ring' };
const KIND_NAMES = { melee1: 'One-hand Weapon', melee2: 'Two-hand Weapon', bow: 'Bow', wand: 'Wand', staff: 'Staff', shield: 'Shield', pouch: 'Seed Pouch', orb: 'Orb', head: 'Helm', body: 'Armour', hands: 'Gloves', feet: 'Boots', neck: 'Amulet', ring: 'Ring' };

export function statLine(s, v) {
    const L = STAT_LABEL[s];
    if (!L) return `${s} ${v}`;
    return `${L[0](v)} ${L[1]}`;
}

export const dps = (it) => (it && it.dmg ? ((it.dmg[0] + it.dmg[1]) / 2) * it.aps : 0);

/** Tooltip HTML for an item. ctx: { hero, price: 'buy'|'sell'|null } */
export function itemTip(it, ctx = {}) {
    const hero = ctx.hero;
    const R = RARITY[it.rarity] || RARITY.normal;
    let html = `<div class="tn" style="color:${R.color}">${esc(displayName(it))}</div>`;
    html += `<div class="tb2">${it.rarity !== 'normal' ? `${R.name} ` : ''}${KIND_NAMES[it.kind] || ''}${it.identified && it.rarity === 'rare' ? ` · ${esc(it.base)}` : ''}</div>`;
    if (it.dmg) html += `<div class="big">${dps(it).toFixed(1)} <small style="font-size:12px;color:#c9a8bc">damage per second</small></div><div>${it.dmg[0]}–${it.dmg[1]} damage · ${it.aps.toFixed(2)} attacks/s</div>`;
    if (it.armor) html += `<div class="big">${it.armor} <small style="font-size:12px;color:#c9a8bc">armour</small></div>`;
    if (it.implicit) for (const [k, v] of Object.entries(it.implicit)) html += `<div>${statLine(k, v)}</div>`;
    if (!it.identified) html += `<div class="af">??? Unidentified properties — show Deckard Cane</div>`;
    else for (const a of it.affixes) html += `<div class="af"${it.rarity === 'legendary' ? ' style="color:#ffb86a"' : ''}>${statLine(a.s, a.v)}</div>`;
    if (it.flavour) html += `<div class="fl">“${esc(it.flavour)}”</div>`;
    if (hero) {
        const why = whyNot(hero, it);
        html += `<div class="${it.lvl > hero.level ? 'req' : ''}" style="margin-top:6px">Requires level ${it.lvl}</div>`;
        if (why && it.lvl <= hero.level) html += `<div class="req">${esc(why)}</div>`;
        // Compare with the equipped item in the same slot.
        const slot = it.slot === 'ring' ? (hero.equip.ring1 ? 'ring1' : 'ring1') : it.slot;
        const cur = hero.equip[slot];
        if (cur && cur !== it && !ctx.equipped) {
            const lines = [];
            if (it.dmg && cur.dmg) { const d = dps(it) - dps(cur); lines.push(`<span class="${d >= 0 ? 'better' : 'worse'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)} DPS</span>`); }
            if (it.armor || cur.armor) { const d = (it.armor || 0) - (cur.armor || 0); if (d) lines.push(`<span class="${d >= 0 ? 'better' : 'worse'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)} armour</span>`); }
            const sa = itemScore(hero, it), sb = itemScore(hero, cur);
            if (sa >= 0) lines.push(`<span class="${sa >= sb ? 'better' : 'worse'}">${sa >= sb ? 'Upgrade' : 'Downgrade'} overall</span>`);
            html += `<div class="cmp">vs ${esc(displayName(cur))}: ${lines.join(' · ')}</div>`;
        }
    }
    if (ctx.price === 'buy') html += `<div style="margin-top:6px" class="sugar">Price: ${buyPrice(it)} sugar</div>`;
    if (ctx.price === 'sell') html += `<div style="margin-top:6px" class="sugar">Sells for ${sellPrice(it)} sugar</div>`;
    return { html, cls: it.rarity };
}

export const tooltip = {
    el: null,
    show(html, x, y, cls = '') {
        if (!this.el) this.el = $('tooltip');
        const el = this.el;
        el.innerHTML = html;
        el.className = cls;
        el.classList.remove('hidden');
        const w = el.offsetWidth, h = el.offsetHeight;
        let tx = x + 18, ty = y + 12;
        if (tx + w > innerWidth - 8) tx = x - w - 18;
        if (tx < 8) tx = 8;
        if (ty + h > innerHeight - 8) ty = innerHeight - h - 8;
        if (ty < 8) ty = 8;
        el.style.left = `${tx}px`; el.style.top = `${ty}px`;
    },
    hide() { if (!this.el) this.el = $('tooltip'); this.el.classList.add('hidden'); },
};

export function classOf(hero) { return CLASSES[hero.cls]; }
