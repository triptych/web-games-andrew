/**
 * treasury.js — collect idle loot, and upgrade the citadel's buildings.
 * training.js-style trainee management lives in training.js.
 */

import { h, app, btn, icon, num, bar, showRewards, toast, costLine } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { treasuryPending, treasuryRate, treasuryCapHours, collectTreasury, buildingCost, upgradeBuilding, canUpgradeBuilding, trainingSlots, trainingRate } from '../../sim/idle.js';
import { maxEnergy, minerSlots, pickPower, energyMins } from '../../sim/mine.js';
import { plotCount, farmerSlots, growthMult } from '../../sim/farm.js';
import { expeditionSlots, boardSize } from '../../sim/expeditions.js';
import { BUILDINGS } from '../../data/world.js';
import { dur } from '../../core/fmt.js';
import { HOUR, now } from '../../core/time.js';
import { sfx } from '../../audio.js';

let tab = 'treasury';

const EFFECT = {
    treasury: (S) => `Cap ${treasuryCapHours(S).toFixed(1)}h · rate ×${(1 + 0.12 * (S.buildings.treasury - 1)).toFixed(2)}`,
    mine: (S) => `${maxEnergy(S)} pick energy · +1 every ${energyMins(S).toFixed(1)}m · ${minerSlots(S)} miner${minerSlots(S) > 1 ? 's' : ''} · pick power ${pickPower(S)}`,
    farm: (S) => `${plotCount(S)} plots · growth ×${(1 / growthMult(S)).toFixed(2)} speed · ${farmerSlots(S)} farmer${farmerSlots(S) > 1 ? 's' : ''}`,
    forge: (S) => `Enhance cost −${4 * (S.buildings.forge - 1)}% · +${S.buildings.forge - 1}% success · craft quality +${Math.floor((S.buildings.forge - 1) / 3)}`,
    training: (S) => `${trainingSlots(S)} slots · ${Math.round(trainingRate(S))} XP/min each`,
    tavern: (S) => `${expeditionSlots(S)} expedition slots · board of ${boardSize(S)}`,
};

export const treasuryScreen = {
    id: 'treasury',
    stage: 'citadel',
    enter(root, params) {
        this.root = root;
        if (params.tab) tab = params.tab;
        this.render();
    },
    render() {
        const S = G.S, root = this.root;
        root.innerHTML = '';
        const tabs = h('div.tabs', ...[['treasury', 'Treasury'], ['build', 'Buildings']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        const wrap = h('div.wrap');
        body.append(wrap);
        if (tab === 'treasury') this.treasury(wrap); else this.build(wrap);
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', tab === 'treasury' ? 'Treasury' : 'Buildings')), tabs, body));
    },
    treasury(wrap) {
        const S = G.S;
        const p = treasuryPending(S);
        const r = treasuryRate(S);
        const cap = treasuryCapHours(S);
        app(wrap,
            h('p.muted.small', 'Your heroes keep patrolling the regions you have conquered. Gold, hero XP, Sigilstones and shards pile up here by the minute — up to the cap — even while the game is closed. Push the campaign further to raise the rates.'),
            h('div.card',
                h('div', bar(p.mins / (cap * 60), 'gold tall', `${dur(p.mins * 60000)} / ${cap.toFixed(1)}h stored`)),
                h('div.kv', { style: { marginTop: '10px' } },
                    h('span.k', 'Gold'), h('span.v', { html: `${icon('gold')} ${num(p.gold)} <span class="muted small">(${num(r.gold * 60)}/h)</span>` }),
                    h('span.k', 'Hero XP (as elixirs)'), h('span.v', { html: `${icon('elixir')} ${num(p.heroXp)} <span class="muted small">(${num(r.xp * 60)}/h)</span>` }),
                    h('span.k', 'Overlord XP'), h('span.v', `${num(p.olXp)}`),
                    h('span.k', 'Sigilstones'), h('span.v', `~${(r.gearPerHour).toFixed(1)}/h · tier ${r.tier}`),
                    h('span.k', 'Sigil Shards'), h('span.v', '~1.2/h'),
                    h('span.k', 'Bonus'), h('span.v', 'Gems after 2h, chests after 4h')),
                h('div', { style: { marginTop: '12px' } }, btn(`Collect`, () => {
                    const got = collectTreasury(S);
                    if (!got) { toast('Nothing stored yet — come back in a few minutes.'); return; }
                    sfx('coin');
                    changed('treasury');
                    showRewards('Treasury Collected', got);
                    this.render();
                }, 'gold wide', { disabled: p.mins < 1 }))),
            h('div.notice', { style: { marginTop: '10px' } }, `Upgrade the Treasury to raise the cap (now ${cap.toFixed(1)}h) and the rates.`),
        );
    },
    build(wrap) {
        const S = G.S;
        for (const [id, B] of Object.entries(BUILDINGS)) {
            const lvl = S.buildings[id];
            const cost = buildingCost(S, id);
            app(wrap, h('div.card',
                h('div.row', h('b.grow', `${B.name}`), h('span.chip', `Lv ${lvl}/${B.max}`)),
                h('p.muted.small', B.desc),
                h('div.small', { style: { color: 'var(--gold-2)', marginBottom: '8px' } }, EFFECT[id](S)),
                cost ? btn(`Upgrade · ${costLine(cost, S)}`, () => {
                    if (!upgradeBuilding(S, id)) { sfx('error'); toast('Not enough gold or ore. Dig in the Mine for ore.'); return; }
                    sfx('levelup'); toast(`${B.name} upgraded to level ${lvl + 1}!`, 'good'); changed('build'); this.render();
                }, canUpgradeBuilding(S, id) ? 'gold small' : 'small', {}) : h('div.chip.on', 'Max level')));
        }
    },
    tick() { if (tab === 'treasury') this.render(); },
    refresh(what) { if (what !== 'tick') this.render(); },
};
