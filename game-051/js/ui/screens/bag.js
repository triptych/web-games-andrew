/**
 * bag.js — everything you own that is not a hero or a Sigilstone.
 */

import { h, app, btn, icon, num, toast, showRewards, rewardChip, describe } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { openChest } from '../../sim/shop.js';
import { openSeedPack } from '../../sim/farm.js';
import { ORE_IDS, JEWEL_IDS, CROP_IDS, ITEMS, ESSENCE_TIERS } from '../../data/items.js';
import { ELEMENTS } from '../../data/core.js';
import { SIGIL_IDS } from '../../sim/summon.js';
import { sfx } from '../../audio.js';

export const bagScreen = {
    id: 'bag',
    stage: 'citadel',
    enter(root) { this.root = root; this.render(); },
    render() {
        const S = G.S, R = S.res, root = this.root;
        root.innerHTML = '';
        const wrap = h('div.wrap');
        const grid = (entries, onTap) => {
            const g = h('div.reward-grid');
            for (const e of entries) {
                if (!e.n) continue;
                const c = rewardChip(e);
                c.style.animation = 'none';
                if (onTap) { c.style.cursor = 'pointer'; c.addEventListener('click', () => onTap(e)); }
                g.append(c);
            }
            return g.children.length ? g : h('p.muted.small', 'Nothing yet.');
        };
        app(wrap,
            h('h2.sec', 'Currencies'),
            grid([{ kind: 'gold', n: R.gold }, { kind: 'gems', n: R.gems }, { kind: 'dust', n: R.dust }, { kind: 'shards', n: R.shards }, { kind: 'tomes', n: R.tomes }, { kind: 'arenaTokens', n: R.arenaTokens }, { kind: 'spireTokens', n: R.spireTokens }]),
            h('h2.sec', 'Sigils', h('span.aside', 'tap to summon')),
            grid(SIGIL_IDS.map((id) => ({ kind: 'sigils', id, n: R.sigils[id] })), () => go('summon')),
            h('h2.sec', 'Items', h('span.aside', 'tap chests and packs to open')),
            grid(Object.keys(ITEMS).map((id) => ({ kind: 'items', id, n: R.items[id] || 0 })), (e) => this.use(e.id)),
            h('h2.sec', 'Essences'),
            grid(ELEMENTS.flatMap((el) => ESSENCE_TIERS.map((t) => ({ kind: 'essences', id: el, tier: t, n: R.essences[el][t] })))),
            h('h2.sec', 'Ores & Jewels'),
            grid([...ORE_IDS.map((id) => ({ kind: 'ores', id, n: R.ores[id] })), ...JEWEL_IDS.map((id) => ({ kind: 'jewels', id, n: R.jewels[id] }))], () => go('forge', { tab: 'craft' })),
            h('h2.sec', 'Crops & Seeds'),
            grid([...CROP_IDS.map((id) => ({ kind: 'crops', id, n: R.crops[id] })), ...CROP_IDS.map((id) => ({ kind: 'seeds', id, n: R.seeds[id] }))], () => go('farm')),
            h('div', { style: { marginTop: '12px' } }, btn(`${icon('hammer')} Sigilstones (${S.gear.length})`, () => go('forge', { tab: 'inventory' }), 'wide')));
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', 'Bag')), h('div.sheet-body', wrap)));
    },
    use(id) {
        const S = G.S;
        if (id === 'chest') {
            const r = openChest(S);
            if (!r) return;
            sfx(r.tier === 'legend' ? 'reveal5' : r.tier === 'epic' ? 'reveal4' : 'reward');
            changed('bag');
            showRewards({ common: 'Mystery Chest', rare: 'A Rare Find!', epic: 'An Epic Find!', legend: 'LEGENDARY!' }[r.tier], r.items);
        } else if (id === 'seedPack') {
            const r = openSeedPack(S);
            if (!r) return;
            changed('bag');
            showRewards('Seed Pack', r);
        } else if (ITEMS[id].xp) {
            toast('Use XP Elixirs from a hero\'s Grow tab.');
            return;
        } else if (id === 'tome') { toast('Use Skill Tomes from a hero\'s Skills tab.'); return; }
        this.render();
    },
    refresh(what) { if (what !== 'tick') this.render(); },
};
