/**
 * summon.js — choose a sigil, summon ×1 / ×10, watch the reveal.
 */

import { h, app, btn, icon, elIcon, clsIcon, stars, num, toast, modal, heroCard, bar, elBadge, clsBadge, $ } from '../dom.js';
import { G, changed } from '../../game.js';
import { go } from '../app.js';
import { peekStage } from '../stages.js';
import { SIGILS, SIGIL_IDS, summon, canSummon, featured, HARD_PITY, SOFT_PITY, SHARDS_PER_SIGIL, GEMS_PER_MYSTIC, GEMS_PER_TEN, craftSigil, currentFiveRate } from '../../sim/summon.js';
import { ELEMENT, RARITY, TRAITS } from '../../data/core.js';
import { CLASSES } from '../../data/classes.js';
import { RARITY_COLOR } from '../../view/summonScene.js';
import { sfx, playMusic } from '../../audio.js';

let current = 'mystic';

export const summonScreen = {
    id: 'summon',
    tab: 'summon',
    stage: 'summon',
    enter(root) {
        this.root = root;
        this.busy = false;
        peekStage('summon').reset();
        playMusic('summon');
        this.render();
    },
    render() {
        const S = G.S;
        const root = this.root;
        root.innerHTML = '';
        if (this.busy) return;
        const feat = featured();
        app(root, h('div.featured', h('div.featured-card', { html: `This week: <b>${ELEMENT[feat.el].name} ${CLASSES[feat.cls].name}s</b> ${elIcon(feat.el)}${clsIcon(feat.cls)}<br><span class="muted small">Half of all 4★–5★ Mystic results are the featured pair</span>` })));
        const ui = h('div.summon-ui');
        const tabs = h('div.sigil-tabs');
        for (const id of SIGIL_IDS) {
            const n = S.res.sigils[id] || 0;
            if (!n && !['mystic', 'common'].includes(id) && current !== id) continue;
            app(tabs, h('button.sigil-tab', { type: 'button', class: current === id ? 'on' : '', onclick: () => { current = id; sfx('tab'); this.render(); } },
                h('span', { style: { color: SIGILS[id].color }, html: icon('sigil') }), h('span', SIGILS[id].name.replace(' Sigil', '').replace('Light & Dark', 'L&D')), h('span.cnt', `×${n}`)));
        }
        const def = SIGILS[current];
        const have = S.res.sigils[current] || 0;
        const odds = def.odds.map(([r, w]) => `<span>${stars(r)} ${w}%</span>`).join('');
        const info = h('div.summon-info',
            h('div.row', h('h3.grow', { style: { color: def.color } }, def.name), h('span.chip', `Owned ×${have}`)),
            h('div.small.muted', def.desc),
            h('div.odds', { html: odds }),
            def.pity ? h('div.pity', bar(S.summon.pity / HARD_PITY, 'purple', `Pity ${S.summon.pity} / ${HARD_PITY} · 5★ chance now ${(currentFiveRate(S, current) * 100).toFixed(1)}%`)) : null,
        );
        const row = h('div.btn-row',
            btn(`Summon ×1`, () => this.doSummon(1), 'gold', { disabled: !canSummon(S, current, 1) }),
            btn(`Summon ×10`, () => this.doSummon(10), 'gold', { disabled: !canSummon(S, current, 10) }));
        const extra = h('div.btn-row');
        if (current === 'mystic') {
            app(extra, btn(`${icon('gem')} ${GEMS_PER_MYSTIC} ×1`, () => this.doSummon(1, 'gems'), 'blue small', { disabled: !canSummon(S, 'mystic', 1, 'gems') }),
                btn(`${icon('gem')} ${GEMS_PER_TEN} ×10`, () => this.doSummon(10, 'gems'), 'blue small', { disabled: !canSummon(S, 'mystic', 10, 'gems') }));
        }
        app(extra, btn(`${icon('shard')} ${S.res.shards}/${SHARDS_PER_SIGIL} → Mystic`, () => { if (craftSigil(S)) { sfx('reward'); toast('Crafted a Mystic Sigil from shards.', 'good'); changed('sigil'); this.render(); } else toast(`Collect ${SHARDS_PER_SIGIL} Sigil Shards from battles and the Treasury.`); }, 'ghost small', { disabled: S.res.shards < SHARDS_PER_SIGIL }));
        app(ui, tabs, info, row, extra);
        app(root, ui);
    },
    async doSummon(n, pay = 'sigil') {
        if (this.busy) return;
        const S = G.S;
        const out = summon(S, current, n, pay);
        if (!out) { sfx('error'); toast('Not enough sigils.'); return; }
        changed('summon');
        this.busy = true;
        this.root.innerHTML = '';
        const st = peekStage('summon');
        const best = out.reduce((a, b) => (b.nat > a.nat || (b.nat === a.nat && b.radiant) ? b : a), out[0]);
        let skipped = false;
        const skip = btn('Skip ›', () => { skipped = true; }, 'ghost small skip-btn');
        this.root.append(skip);
        sfx('charge');
        await st.charge(best.nat, best.radiant, () => (skipped ? 8 : 1));
        sfx(best.nat >= 5 ? 'reveal5' : best.nat >= 4 ? 'reveal4' : 'reveal3');
        skip.remove();
        await new Promise((r) => setTimeout(r, skipped ? 150 : 650)); // let the light pillar burn down first
        if (n === 1) { st.showHero(best); this.reveal(best, () => this.done()); }
        else this.revealMany(out, best);
    },
    reveal(hero, next, label = 'Continue') {
        const wrap = h('div.reveal');
        const card = h('div.reveal-card',
            hero.radiant ? h('div.reveal-radiant', '★ RADIANT ★') : null,
            h('div.reveal-stars', { html: stars(hero.nat), style: { color: RARITY_COLOR[hero.nat] } }),
            h('div.reveal-name', { style: { color: hero.nat >= 5 ? '#ffe08a' : '#fff' } }, hero.name),
            h('div.reveal-sub', `${RARITY[hero.nat].name} · ${hero.epithet}`),
            h('div.chips', { style: { justifyContent: 'center' } }, h('span', { html: elBadge(hero.el) }), h('span', { html: clsBadge(hero.cls) }), h('span.chip', `Grade ${hero.grade}`), ...hero.traits.map((t) => h('span.chip', TRAITS[t].name))),
            h('div.btn-row', { style: { marginTop: '12px', justifyContent: 'center' } },
                btn('View Hero', () => { this.busy = false; go('hero', { id: hero.id }); }, 'ghost'),
                btn(label, () => { wrap.remove(); next(); }, 'gold')));
        app(wrap, card);
        this.root.append(wrap);
    },
    revealMany(list, best) {
        const st = peekStage('summon');
        st.showHero(best);
        const wrap = h('div.reveal');
        const grid = h('div.reveal-grid');
        list.forEach((hero, i) => {
            const c = heroCard(hero, { compact: true, onClick: () => { st.showHero(hero); } });
            c.style.animationDelay = i * 90 + 'ms';
            app(grid, c);
        });
        const top = list.filter((x) => x.nat >= 4).length;
        app(wrap, h('div.reveal-card',
            h('div.reveal-name', `${top ? `${top} hero${top > 1 ? 'es' : ''} of 4★+` : 'Ten new heroes'}!`),
            h('div.reveal-sub', 'Tap a hero to see them on the circle'),
            grid,
            h('div.btn-row', { style: { justifyContent: 'center' } }, btn('Continue', () => { wrap.remove(); this.done(); }, 'gold'))));
        this.root.append(wrap);
    },
    done() {
        this.busy = false;
        peekStage('summon').reset();
        this.render();
    },
    refresh(what) { if (!this.busy && what !== 'tick') this.render(); },
};
