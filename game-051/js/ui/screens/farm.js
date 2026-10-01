/**
 * farm.js — plant, water and harvest; buy seeds; cook in the Kitchen;
 * assign farmers.
 */

import * as THREE from 'three';
import { h, app, btn, icon, num, toast, modal, heroCard, showRewards, rewardGrid, costLine, describe, $ } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { gestures, canvasEl } from '../input.js';
import { toScreen } from '../../view/engine.js';
import { ensurePlots, plotCount, plant, water, canWater, harvest, harvestAll, plotProgress, buySeeds, cropUnlocked, openSeedPack, setFarmers, farmerSlots, farmerBonus, cook, canCook, sellCrop } from '../../sim/farm.js';
import { heroById } from '../../sim/state.js';
import { heroBusy } from '../../sim/idle.js';
import { CROPS, CROP_IDS, RECIPES } from '../../data/items.js';
import { now } from '../../core/time.js';
import { dur } from '../../core/fmt.js';
import { sfx } from '../../audio.js';
import { describeReward } from './quests.js';

let mode = 'field';
const _v = new THREE.Vector3();

export const farmScreen = {
    id: 'farm',
    stage: 'farm',
    enter(root, params) {
        this.root = root;
        if (params.tab) mode = params.tab;
        const S = G.S;
        ensurePlots(S);
        const st = peekStage('farm');
        st.applyTime();
        st.setFarmers(S.farm.farmers.map((id) => heroById(S, id)).filter(Boolean).map((x) => x.look));
        this.detach = gestures(canvasEl(), { onTap: (x, y) => this.tap(x, y) });
        this.labels = [];
        this.render();
    },
    exit() { if (this.detach) this.detach(); for (const l of this.labels) l.remove(); this.labels = []; },
    sync() { const S = G.S; peekStage('farm').sync(S.farm.plots, plotCount(S), now()); },
    render() {
        const S = G.S, root = this.root;
        this.sync();
        root.innerHTML = '';
        for (const l of this.labels) l.remove();
        this.labels = [];
        const tabs = h('div.tabs', { style: { padding: '0' } }, ...[['field', 'Field'], ['seeds', 'Seeds'], ['kitchen', 'Kitchen']].map(([k, l]) => h('button.tbtn', { class: mode === k ? 'on' : '', style: { borderRadius: '10px' }, onclick: () => { mode = k; sfx('tab'); this.render(); } }, l)));
        const hud = h('div.scene-hud',
            h('div.hud-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('div.grow', h('div.hud-title', 'The Farm'), h('div.small', `${plotCount(S)} plots · farmers +${Math.round(farmerBonus(S) * 100)}% yield`))));
        if (mode === 'field') {
            const ready = S.farm.plots.filter((p) => p.crop && now() >= p.readyAt).length;
            const wet = S.farm.plots.filter((p) => canWater(p)).length;
            app(hud, h('div.hud-bottom', tabs,
                h('div.btn-row',
                    btn(`Harvest all${ready ? ` (${ready})` : ''}`, () => this.harvestAll(), ready ? 'gold' : '', { disabled: !ready }),
                    btn(`${icon('water')} Water all`, () => { let n = 0; S.farm.plots.forEach((p, i) => { if (canWater(p) && water(S, i)) { n++; peekStage('farm').waterFx(i); } }); if (n) { sfx('splash'); changed('farm'); this.render(); } }, 'blue', { disabled: !wet }),
                    btn('Farmers', () => this.farmerPicker(), 'ghost'))));
            this.plotLabels();
        } else {
            const panel = h('div.sheet', { style: { top: '38%', bottom: '0', paddingBottom: '0' } }, h('div', { style: { padding: '8px 12px 0' } }, tabs), h('div.sheet-body', mode === 'seeds' ? this.seeds() : this.kitchen()));
            app(hud, panel);
        }
        root.append(hud);
        if (!S.story.tips.farm) {
            S.story.tips.farm = 1;
            modal({ title: 'The Farm', body: h('div', h('p', 'Tap an empty plot to plant a seed. Crops grow in real time — even while you are away.'), h('p.muted.small', 'Water each growth stage once to cut 20% off the remaining time. Some crops turn golden: triple harvest and gems! Cook harvests in the Kitchen into XP elixirs and timed buffs.')), buttons: [{ label: 'Got it', cls: 'gold' }] });
        }
    },
    plotLabels() {
        const S = G.S, t = now();
        const st = peekStage('farm');
        for (let i = 0; i < 12; i++) {
            const p = S.farm.plots[i];
            let html = '';
            if (i >= plotCount(S)) html = `<div class="pl-t">${icon('lock')} Farm Lv ${i - 2}</div>`;
            else if (!p.crop) html = `<div class="pl-t">Plant</div>`;
            else if (t >= p.readyAt) html = `<div class="pl-t ${p.golden ? 'golden' : 'ready'}">${p.golden ? 'Golden ' : ''}${CROPS[p.crop].name}!</div>`;
            else html = `<div class="pl-t">${CROPS[p.crop].name} <span class="timer">${dur(p.readyAt - t)}</span></div>${canWater(p) ? `<div class="pl-w">${icon('water')}</div>` : ''}`;
            const el = h('div.plot-label', { html });
            $('#labels').append(el);
            this.labels.push(el);
            el.dataset.i = i;
        }
        this.placeLabels();
    },
    placeLabels() {
        const st = peekStage('farm');
        for (const el of this.labels) {
            const s = toScreen(st.plotPos(+el.dataset.i, _v), st.camera);
            if (!s) continue;
            el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
        }
    },
    update() { if (this.labels && this.labels.length) this.placeLabels(); },
    tap(x, y) {
        if (mode !== 'field') return;
        const S = G.S;
        const st = peekStage('farm');
        const i = st.plotAt(x, y);
        if (i === null) return;
        if (i >= plotCount(S)) { toast('Upgrade the Farm to unlock more plots.'); return; }
        const p = S.farm.plots[i];
        if (!p.crop) { this.seedPicker(i); return; }
        if (now() >= p.readyAt) {
            const r = harvest(S, i);
            if (r) { sfx(r.golden ? 'reveal4' : 'harvest'); st.harvestFx(i, r.golden); this.pop(i, r.items); changed('farm'); this.render(); }
            return;
        }
        if (canWater(p)) { water(S, i); sfx('splash'); st.waterFx(i); changed('farm'); this.render(); return; }
        toast(`${CROPS[p.crop].name}: ${dur(p.readyAt - now())} left. Already watered this stage.`);
    },
    pop(i, items) {
        const s = toScreen(peekStage('farm').plotPos(i, _v), peekStage('farm').camera);
        if (!s) return;
        items.forEach((e, k) => {
            const d = describe(e);
            const el = h('div.loot-pop', { html: `${d.ico}+${num(d.n)}` });
            el.style.left = s.x + 'px'; el.style.top = s.y - k * 26 + 'px';
            $('#labels').append(el);
            setTimeout(() => el.remove(), 1400);
        });
    },
    harvestAll() {
        const S = G.S;
        const st = peekStage('farm');
        const idx = S.farm.plots.map((p, i) => (p.crop && now() >= p.readyAt ? i : -1)).filter((i) => i >= 0);
        const res = harvestAll(S);
        if (!res.length) return;
        idx.forEach((i, k) => st.harvestFx(i, res[k] && res[k].golden));
        sfx('harvest');
        changed('farm');
        showRewards(res.some((r) => r.golden) ? 'Golden Harvest!' : 'Harvest', res.flatMap((r) => r.items));
        this.render();
    },
    seedPicker(i) {
        const S = G.S;
        const list = h('div.list');
        let m;
        const owned = CROP_IDS.filter((c) => S.res.seeds[c] > 0);
        if (!owned.length) list.append(h('p.muted', 'No seeds. Buy some in the Seeds tab, or open a Seed Pack.'));
        for (const c of owned) {
            const C = CROPS[c];
            list.append(h('div.card.row', h('span', { html: `<span class="tint" style="--c:${C.color}">${icon('crop')}</span>` }), h('div.grow', h('b', `${C.name} ×${S.res.seeds[c]}`), h('div.small.muted', `${dur(C.mins * 60000)} · yields ${C.yield[0]}–${C.yield[1]}`)),
                btn('Plant', () => { if (plant(S, i, c)) { sfx('plant'); peekStage('farm').plantFx(i); changed('farm'); m.close(); this.render(); } }, 'gold small')));
        }
        if (owned.length > 1) list.append(btn('Plant this in every empty plot', () => {
            const c = owned[0];
            S.farm.plots.forEach((p, k) => { if (k < plotCount(S) && !p.crop && S.res.seeds[c] > 0) { plant(S, k, c); peekStage('farm').plantFx(k); } });
            sfx('plant'); changed('farm'); m.close(); this.render();
        }, 'ghost small wide'));
        m = modal({ title: 'Plant a seed', body: list, buttons: [{ label: 'Seed Shop', cls: 'ghost', onClick: () => { mode = 'seeds'; this.render(); } }] });
    },
    seeds() {
        const S = G.S;
        const wrap = h('div.wrap');
        app(wrap, h('div.card.row', h('div.grow', { html: `${icon('seed')} <b>Seed Packs ×${S.res.items.seedPack || 0}</b><div class="small muted">3–5 random seeds, rare ones included</div>` }),
            btn('Open', () => { const r = openSeedPack(S); if (!r) { toast('No seed packs.'); return; } changed('seed'); showRewards('Seed Pack', r); this.render(); }, 'gold small', { disabled: !S.res.items.seedPack })));
        for (const c of CROP_IDS) {
            const C = CROPS[c];
            const ok = cropUnlocked(S, c);
            app(wrap, h('div.card.row', { style: { opacity: ok ? 1 : 0.55 } },
                h('span', { html: `<span class="tint" style="--c:${C.color}">${icon('crop')}</span>` }),
                h('div.grow', h('b', `${C.name}`), h('div.small.muted', ok ? `${dur(C.mins * 60000)} · owned ${S.res.seeds[c]} · sells for ${C.sell}` : `Unlocks at Farm level ${C.unlock}`)),
                ok ? h('div.row', { style: { gap: '4px' } },
                    btn(`×1 ${costLine({ gold: C.seedCost }, S)}`, () => { if (buySeeds(S, c, 1)) { sfx('coin'); changed('seed'); this.render(); } else toast('Not enough gold.'); }, 'small'),
                    btn(`×5`, () => { if (buySeeds(S, c, 5)) { sfx('coin'); changed('seed'); this.render(); } else toast('Not enough gold.'); }, 'small')) : h('span', { html: icon('lock') })));
        }
        app(wrap, h('h2.sec', 'Sell crops'));
        const sellable = CROP_IDS.filter((c) => S.res.crops[c] > 0);
        if (!sellable.length) app(wrap, h('p.muted.small', 'No crops in the barn.'));
        for (const c of sellable) app(wrap, h('div.card.row', h('b.grow', `${CROPS[c].name} ×${S.res.crops[c]}`), btn(`Sell all · ${icon('gold')}${num(CROPS[c].sell * S.res.crops[c])}`, () => { sellCrop(S, c, S.res.crops[c]); sfx('coin'); changed('sell'); this.render(); }, 'small')));
        return wrap;
    },
    kitchen() {
        const S = G.S;
        const wrap = h('div.wrap');
        app(wrap, h('p.muted.small', 'Cook your harvest into XP Elixirs, or into feasts that buff your whole citadel for 30 minutes.'));
        for (const [id, R] of Object.entries(RECIPES)) {
            const ok = canCook(S, id);
            app(wrap, h('div.card',
                h('div.row', h('b.grow', R.name), btn('Cook', () => {
                    const r = cook(S, id);
                    if (!r) { sfx('error'); toast('Missing ingredients.'); return; }
                    sfx('levelup'); changed('cook');
                    showRewards(R.name, r);
                    this.render();
                }, ok ? 'gold small' : 'small', { disabled: !ok })),
                h('div.small.muted', R.desc),
                h('div', { style: { marginTop: '4px' }, html: costLine({ crops: R.needs }, S) })));
        }
        return wrap;
    },
    farmerPicker() {
        const S = G.S;
        const sel = S.farm.farmers.slice();
        const slots = farmerSlots(S);
        const cands = S.heroes.filter((x) => !heroBusy(S, x.id) || S.farm.farmers.includes(x.id)).sort((a, b) => (b.traits.includes('greenthumb') ? 1 : 0) - (a.traits.includes('greenthumb') ? 1 : 0) || a.star - b.star);
        const grid = h('div.hero-grid');
        const draw = () => {
            grid.innerHTML = '';
            for (const c of cands) grid.append(heroCard(c, { selected: sel.includes(c.id), tag: c.traits.includes('greenthumb') ? 'GREEN THUMB' : null, onClick: () => { const i = sel.indexOf(c.id); if (i >= 0) sel.splice(i, 1); else if (sel.length < slots) sel.push(c.id); else toast(`Only ${slots} farmer slot${slots > 1 ? 's' : ''} — upgrade the Farm.`); draw(); } }));
        };
        draw();
        modal({ title: `Farmers (${slots} slot${slots > 1 ? 's' : ''})`, body: h('div', h('p.muted.small', 'Each farmer adds 20% to every harvest (Green Thumb: 40%). Farmers can still fight.'), grid), cls: 'wide', buttons: [{ label: 'Save', cls: 'gold', onClick: () => { setFarmers(S, sel); changed('farm'); peekStage('farm').setFarmers(sel.map((id) => heroById(S, id)).filter(Boolean).map((x) => x.look)); this.render(); } }] });
    },
    tick() { if (mode === 'field') this.render(); else this.sync(); },
    refresh(what) { if (what !== 'tick') this.render(); },
};
