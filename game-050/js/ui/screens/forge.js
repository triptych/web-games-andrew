/**
 * forge.js — Sigilstone inventory, enhancing (+0 → +15), reforging, crafting.
 */

import { h, app, btn, icon, num, toast, modal, gearCard, gearIcon, statLine, costLine, confirmBox, showRewards, bar } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { gearById, heroById, canAfford } from '../../sim/state.js';
import { enhance, reforgeGear, sellGear, craft, craftAffordable, unequip } from '../../sim/actions.js';
import { upgradeCost, upgradeChance, mainValue, reforgeCost, craftCost, sellValue, gearScore } from '../../sim/gear.js';
import { SLOTS, SLOT, SETS, SET_IDS, GEAR_RARITY, JEWELS, JEWEL_IDS, ORES, MAX_GEAR_LEVEL } from '../../data/items.js';
import { sfx } from '../../audio.js';

let tab = 'inventory';
const F = { slot: null, set: null, sort: 'score', owner: 'all' };

export const forgeScreen = {
    id: 'forge',
    stage: 'citadel',
    enter(root, params) {
        this.root = root;
        if (params.tab) tab = params.tab;
        if (params.gear) { tab = 'enhance'; this.sel = params.gear; }
        this.craftTier = this.craftTier || 1;
        this.craftJewel = null;
        this.craftSlot = null;
        this.selling = null;
        this.render();
    },
    render() {
        const S = G.S, root = this.root;
        root.innerHTML = '';
        const tabs = h('div.tabs', ...[['inventory', 'Sigilstones'], ['enhance', 'Enhance'], ['reforge', 'Reforge'], ['craft', 'Craft']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        const wrap = h('div.wrap');
        body.append(wrap);
        ({ inventory: () => this.inventory(wrap), enhance: () => this.enhance(wrap), reforge: () => this.reforge(wrap), craft: () => this.craftTab(wrap) })[tab]();
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', 'Forge'), h('span.chip', { html: `${icon('gold')} ${num(S.res.gold)}` })), tabs, body));
    },
    filtered() {
        const S = G.S;
        let list = S.gear.filter((g) => (!F.slot || g.slot === F.slot) && (!F.set || g.set === F.set) && (F.owner === 'all' || (F.owner === 'free' ? !g.owner : !!g.owner)));
        const by = { score: (a, b) => gearScore(b) - gearScore(a), level: (a, b) => b.level - a.level, rarity: (a, b) => b.rarity - a.rarity || b.tier - a.tier, newest: (a, b) => b.id - a.id };
        return list.sort(by[F.sort]);
    },
    filters() {
        return h('div.chips', { style: { marginBottom: '8px' } },
            h('select.sel', { 'aria-label': 'Slot', onchange: (e) => { F.slot = e.target.value || null; this.render(); } }, h('option', { value: '' }, 'All slots'), ...SLOTS.map((s) => h('option', { value: s, selected: F.slot === s ? true : null }, SLOT[s].name))),
            h('select.sel', { 'aria-label': 'Set', onchange: (e) => { F.set = e.target.value || null; this.render(); } }, h('option', { value: '' }, 'All sets'), ...SET_IDS.map((s) => h('option', { value: s, selected: F.set === s ? true : null }, `${SETS[s].name} (${SETS[s].n})`))),
            h('select.sel', { 'aria-label': 'Owner', onchange: (e) => { F.owner = e.target.value; this.render(); } }, ...[['all', 'All'], ['free', 'Unequipped'], ['worn', 'Equipped']].map(([v, l]) => h('option', { value: v, selected: F.owner === v ? true : null }, l))),
            h('select.sel', { 'aria-label': 'Sort', onchange: (e) => { F.sort = e.target.value; this.render(); } }, ...[['score', 'Best'], ['level', 'Level'], ['rarity', 'Rarity'], ['newest', 'Newest']].map(([v, l]) => h('option', { value: v, selected: F.sort === v ? true : null }, l))));
    },
    inventory(wrap) {
        const S = G.S;
        const sell = this.selling;
        app(wrap, h('div.row', { style: { marginBottom: '8px' } }, h('div.grow.muted.small', `${S.gear.length} Sigilstones`),
            sell ? btn('Cancel', () => { this.selling = null; this.render(); }, 'ghost small') : btn(`${icon('trash')} Sell`, () => { this.selling = new Set(); this.render(); }, 'ghost small')), this.filters());
        const grid = h('div.gear-grid');
        for (const g of this.filtered().slice(0, 150)) {
            const owner = g.owner ? heroById(S, g.owner) : null;
            grid.append(gearCard(g, { selected: sell && sell.has(g.id), ownerName: owner ? `on ${owner.name}` : null, onClick: () => {
                if (sell) { if (sell.has(g.id)) sell.delete(g.id); else sell.add(g.id); this.render(); return; }
                this.sel = g.id; tab = 'enhance'; this.render();
            } }));
        }
        app(wrap, grid.children.length ? grid : h('div.empty', 'No Sigilstones here yet. Win battles, collect the Treasury, or craft some.'));
        if (sell) {
            let gold = 0;
            for (const id of sell) gold += sellValue(gearById(S, id));
            app(wrap, h('div.sheet-foot', { style: { position: 'sticky', bottom: '-12px', margin: '10px -12px -12px' } }, h('div.row',
                h('div.grow.small', { html: `${sell.size} selected · ${icon('gold')} ${num(gold)}` }),
                btn('Common/Magic', () => { for (const g of S.gear) if (g.rarity <= 2 && !g.owner && g.level === 0) sell.add(g.id); this.render(); }, 'ghost small'),
                btn('Sell', async () => {
                    if (!sell.size) return;
                    if ([...sell].some((id) => gearById(S, id).owner) && !(await confirmBox('Some selected Sigilstones are equipped. Sell anyway?', 'Sell', 'Cancel', 'red'))) return;
                    const r = sellGear(S, [...sell]);
                    sfx('coin'); toast(`Sold ${r.n} for ${num(r.gold)} gold.`, 'good');
                    this.selling = null; changed('sell'); this.render();
                }, 'red small', { disabled: !sell.size }))));
        }
    },
    pickGear(title, then) {
        const S = G.S;
        const grid = h('div.gear-grid');
        let m;
        for (const g of this.filtered().slice(0, 120)) {
            const owner = g.owner ? heroById(S, g.owner) : null;
            grid.append(gearCard(g, { ownerName: owner ? `on ${owner.name}` : null, onClick: () => { m.close(); then(g); } }));
        }
        m = modal({ title, body: h('div', this.filters(), grid), cls: 'wide' });
    },
    enhance(wrap) {
        const S = G.S;
        const g = this.sel ? gearById(S, this.sel) : null;
        if (!g) { app(wrap, h('div.empty', 'Choose a Sigilstone to enhance.'), btn('Choose', () => this.pickGear('Enhance which?', (x) => { this.sel = x.id; this.render(); }), 'gold wide')); return; }
        const owner = g.owner ? heroById(S, g.owner) : null;
        const cost = upgradeCost(g, S.buildings.forge);
        const chance = upgradeChance(g, 0.01 * (S.buildings.forge - 1));
        const maxed = g.level >= MAX_GEAR_LEVEL;
        app(wrap,
            h('div.row', { style: { marginBottom: '8px' } }, h('div.grow.muted.small', owner ? `Equipped on ${owner.name}` : 'Not equipped'), btn('Change', () => this.pickGear('Enhance which?', (x) => { this.sel = x.id; this.render(); }), 'ghost small')),
            gearCard(g),
            h('div.card', { style: { marginTop: '10px' } },
                h('div', bar(g.level / MAX_GEAR_LEVEL, 'gold tall', `+${g.level} / +${MAX_GEAR_LEVEL}`)),
                h('p.small.muted', 'Every +3 adds a new substat, or boosts one once all four are revealed. Each attempt costs gold; failing keeps the level. Higher levels are harder.'),
                maxed ? h('div.chip.on', 'Fully enhanced') : h('div.row',
                    h('div.grow', { html: `Success <b style="color:${chance > 0.6 ? 'var(--good)' : chance > 0.3 ? 'var(--gold-2)' : 'var(--bad)'}">${Math.round(chance * 100)}%</b>` }),
                    btn(`Enhance · ${costLine({ gold: cost }, S)}`, () => this.doEnhance(g), 'gold', { disabled: S.res.gold < cost })),
                maxed ? null : btn('Enhance ×5', async () => { for (let i = 0; i < 5 && g.level < MAX_GEAR_LEVEL && S.res.gold >= upgradeCost(g, S.buildings.forge); i++) { await this.doEnhance(g, true); } this.render(); }, 'ghost small wide')));
    },
    async doEnhance(g, quiet = false) {
        const S = G.S;
        const before = g.level;
        const r = enhance(S, g.id);
        if (!r) { sfx('error'); toast('Not enough gold.'); return; }
        changed('enhance');
        if (r.ok) {
            sfx(g.level % 3 === 0 ? 'levelup' : 'coin');
            if (!quiet) toast(r.sub ? (r.sub.added ? `+${g.level}! New substat revealed.` : `+${g.level}! A substat grew.`) : `Success: +${g.level}`, 'good');
        } else { sfx('error'); if (!quiet) toast(`Failed at +${before}. Try again!`, 'bad'); }
        if (!quiet) this.render();
        await new Promise((res) => setTimeout(res, 120));
    },
    reforge(wrap) {
        const S = G.S;
        const g = this.sel ? gearById(S, this.sel) : null;
        app(wrap, h('p.muted.small', 'Reforging rerolls one substat into a different random stat, keeping any boosts it earned from enhancing. Costs gold and Soul Dust.'));
        if (!g) { app(wrap, btn('Choose a Sigilstone', () => this.pickGear('Reforge which?', (x) => { this.sel = x.id; this.render(); }), 'gold wide')); return; }
        const c = reforgeCost(g);
        app(wrap, h('div.row', { style: { marginBottom: '8px' } }, h('div.grow'), btn('Change', () => this.pickGear('Reforge which?', (x) => { this.sel = x.id; this.render(); }), 'ghost small')), gearCard(g));
        if (!g.subs.length) { app(wrap, h('p.muted', 'This one has no substats to reforge yet — enhance it to +3.')); return; }
        g.subs.forEach((s, i) => {
            app(wrap, h('div.card.row', h('div.grow', { html: statLine(s.s, s.v) }), btn(`Reforge · ${costLine(c, S)}`, () => {
                const r = reforgeGear(S, g.id, i);
                if (!r) { sfx('error'); toast('Not enough gold or Soul Dust.'); return; }
                sfx('magic'); toast(`Rerolled into ${statLine(r.s, r.v).replace(/<[^>]+>/g, ' ')}`, 'good'); changed('reforge'); this.render();
            }, canAfford(S, c) ? 'blue small' : 'small')));
        });
    },
    craftTab(wrap) {
        const S = G.S;
        const T = this.craftTier;
        const c = craftCost(T);
        app(wrap, h('p.muted.small', 'Forge a new Sigilstone from ore. Higher tiers need rarer ore from deeper in the Mine. Add a jewel to steer the set or raise the rarity; choosing a slot costs 50% more gold.'));
        app(wrap, h('div.opt-group', h('div.opt-label', 'Tier (ore)'), h('div.opt-row', ...[1, 2, 3, 4, 5, 6].map((t) => { const cc = craftCost(t); return h('button.opt', { type: 'button', class: t === T ? 'on' : '', onclick: () => { this.craftTier = t; this.render(); } }, `T${t} · ${ORES[cc.ore].name.replace(' Ore', '')} ${S.res.ores[cc.ore]}/${cc.n}`); }))));
        app(wrap, h('div.opt-group', h('div.opt-label', 'Jewel (optional)'), h('div.opt-row',
            h('button.opt', { type: 'button', class: !this.craftJewel ? 'on' : '', onclick: () => { this.craftJewel = null; this.render(); } }, 'None'),
            ...JEWEL_IDS.map((j) => h('button.opt', { type: 'button', class: this.craftJewel === j ? 'on' : '', style: { color: JEWELS[j].color }, onclick: () => { this.craftJewel = j; this.render(); } }, `${JEWELS[j].name} ×${S.res.jewels[j]}`))),
            this.craftJewel ? h('div.small.muted', JEWELS[this.craftJewel].desc + (JEWELS[this.craftJewel].sets ? `: ${JEWELS[this.craftJewel].sets.map((s) => SETS[s].name).join(', ')}` : '')) : null));
        app(wrap, h('div.opt-group', h('div.opt-label', 'Slot'), h('div.opt-row',
            h('button.opt', { type: 'button', class: !this.craftSlot ? 'on' : '', onclick: () => { this.craftSlot = null; this.render(); } }, 'Random'),
            ...SLOTS.map((s) => h('button.opt', { type: 'button', class: this.craftSlot === s ? 'on' : '', onclick: () => { this.craftSlot = s; this.render(); } }, SLOT[s].name)))));
        const cost = { gold: this.craftSlot ? Math.round(c.gold * 1.5) : c.gold, ores: { [c.ore]: c.n }, ...(this.craftJewel ? { jewels: { [this.craftJewel]: 1 } } : {}) };
        app(wrap, btn(`Craft · ${costLine(cost, S)}`, () => {
            const g = craft(S, T, this.craftJewel, this.craftSlot);
            if (!g) { sfx('error'); toast('Missing ore, jewel or gold. Dig in the Mine!'); return; }
            sfx(g.rarity >= 5 ? 'reveal5' : g.rarity >= 4 ? 'reveal4' : 'reward');
            changed('craft');
            showRewards(`${GEAR_RARITY[g.rarity].name} Sigilstone!`, [{ kind: 'gear', gear: g, n: 1 }], gearCard(g));
            if (this.craftJewel && !S.res.jewels[this.craftJewel]) this.craftJewel = null;
            this.render();
        }, craftAffordable(S, T, this.craftJewel, this.craftSlot) ? 'gold wide' : 'wide'));
    },
    refresh(what) { if (what !== 'tick' && what !== 'enhance') this.render(); },
};
