/**
 * training.js — the Training Grounds: heroes level up on their own, idle or not.
 */

import { h, app, btn, icon, num, bar, heroCard, modal, toast } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { heroById } from '../../sim/state.js';
import { trainingSlots, trainingRate, trainingPending, setTrainee, tickTraining, heroBusy, buildingCost } from '../../sim/idle.js';
import { maxLevel, xpToNext } from '../../sim/heroes.js';
import { sfx } from '../../audio.js';

export const trainingScreen = {
    id: 'training',
    stage: 'citadel',
    enter(root) { this.root = root; this.render(); },
    render() {
        const S = G.S, root = this.root;
        tickTraining(S);
        root.innerHTML = '';
        const wrap = h('div.wrap');
        app(wrap, h('p.muted.small', `Heroes in training gain ${Math.round(trainingRate(S))} XP a minute each, around the clock, up to a day at a time. A great way to grow evolution fodder. Upgrade the Training Grounds for more slots.`));
        const n = trainingSlots(S);
        for (let i = 0; i < n; i++) {
            const slot = S.training.slots[i];
            const hero = slot && heroById(S, slot.heroId);
            if (hero) {
                const full = hero.level >= maxLevel(hero);
                app(wrap, h('div.card.row',
                    h('div', { style: { width: '72px', flex: 'none' } }, heroCard(hero, { compact: true, onClick: () => go('hero', { id: hero.id }) })),
                    h('div.grow', h('b', hero.name), h('div.small.muted', full ? 'Max level reached — swap in someone new!' : `Lv ${hero.level}/${maxLevel(hero)} · ${num(hero.xp)}/${num(xpToNext(hero.level, hero.star))} XP`), bar(hero.level / maxLevel(hero), full ? 'green' : 'gold')),
                    btn('Remove', () => { S.training.slots.splice(i, 1); changed('train'); this.render(); }, 'ghost small')));
            } else {
                app(wrap, h('div.card.row', h('div.grow.muted', `Slot ${i + 1} is empty`), btn('Assign', () => this.pick(i), 'gold small')));
            }
        }
        app(wrap, btn(`Upgrade Training Grounds`, () => go('treasury', { tab: 'build' }), 'ghost wide'));
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', 'Training Grounds'), h('span.chip', `${S.training.slots.length}/${n}`)), h('div.sheet-body', wrap)));
    },
    pick(i) {
        const S = G.S;
        const cands = S.heroes.filter((x) => !heroBusy(S, x.id) && x.level < maxLevel(x)).sort((a, b) => b.star - a.star || b.level - a.level);
        const grid = h('div.hero-grid');
        let m;
        for (const c of cands) grid.append(heroCard(c, { onClick: () => { setTrainee(S, i, c.id); sfx('buff'); changed('train'); m.close(); this.render(); } }));
        if (!cands.length) grid.append(h('p.muted', 'No idle heroes below max level.'));
        m = modal({ title: 'Choose a trainee', body: grid, cls: 'wide' });
    },
    tick() { this.render(); },
    refresh(what) { if (what !== 'tick') this.render(); },
};
