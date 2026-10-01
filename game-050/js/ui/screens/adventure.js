/**
 * adventure.js — the campaign map, the Rifts, and doors to the Spire,
 * the Arena and the expedition board.
 */

import { h, app, btn, icon, elIcon, num, toast, modal, stars, rewardGrid } from '../dom.js';
import { G } from '../../game.js';
import { go } from '../app.js';
import { REGIONS, STAGES_PER_REGION, TOTAL_STAGES, RIFTS, RIFT_TIERS, BOSSES } from '../../data/world.js';
import { stageInfo, riftInfo, isRiftUnlocked, isStageUnlocked } from '../../sim/content.js';
import { ELEMENT } from '../../data/core.js';
import { sfx } from '../../audio.js';

let tab = 'campaign';
const REGION_BG = {
    verdant: 'linear-gradient(135deg, #3a8a3a, #1a4a2a)', ember: 'linear-gradient(135deg, #a8421a, #3a1410)', tide: 'linear-gradient(135deg, #2a8ac8, #0a3a5a)', sunspire: 'linear-gradient(135deg, #c8961a, #5a3a10)',
    gloom: 'linear-gradient(135deg, #4a2a7a, #140a24)', frost: 'linear-gradient(135deg, #6aa8d8, #2a4a6a)', crystal: 'linear-gradient(135deg, #7a4ad0, #24104a)', throne: 'linear-gradient(135deg, #8a1a4a, #1a0814)',
};

export const adventureScreen = {
    id: 'adventure',
    tab: 'adventure',
    stage: 'citadel',
    enter(root, params) {
        this.root = root;
        if (params.tab) tab = params.tab;
        this.render();
        if (tab === 'campaign') {
            const el = root.querySelector('.stage-btn.next');
            if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 50);
        }
    },
    render() {
        const S = G.S;
        const root = this.root;
        root.innerHTML = '';
        const tabs = h('div.tabs', ...[['campaign', 'Campaign'], ['rifts', 'Rifts'], ['modes', 'More']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        if (tab === 'campaign') this.campaign(body);
        else if (tab === 'rifts') this.rifts(body);
        else this.modes(body);
        app(root, h('div.sheet', h('div.sheet-head', h('h1', 'Adventure'), h('span.chip', { html: `${icon('stamina')} ${S.res.stamina}` })), tabs, body));
    },
    campaign(body) {
        const S = G.S;
        const wrap = h('div.wrap');
        const stars3 = Object.values(S.campaign.stars).reduce((a, b) => a + b, 0);
        app(wrap, h('div.row', { style: { marginBottom: '10px' } }, h('div.chip', `Cleared ${S.campaign.cleared}/${TOTAL_STAGES}`), h('div.chip', { html: `<span class="star">★</span> ${stars3}/${TOTAL_STAGES * 3}` }), h('div.grow'), btn('Modes ›', () => { tab = 'modes'; this.render(); }, 'ghost small')));
        REGIONS.forEach((reg, r) => {
            const first = r * STAGES_PER_REGION;
            const locked = first > S.campaign.cleared;
            const card = h('div.region-card', { style: locked ? { opacity: 0.55 } : {} });
            app(card, h('div.region-head', { style: { '--rbg': REGION_BG[reg.id] } },
                h('h3', { html: `${elIcon(reg.element)} ${r + 1}. ${reg.name}` }),
                h('p', locked ? `Locked — clear stage ${r}-8 to enter.` : reg.blurb),
                h('p.small', { style: { opacity: 0.85 } }, `Boss: ${BOSSES[reg.boss].name}`)));
            if (!locked) {
                const row = h('div.stage-row');
                for (let n = 0; n < STAGES_PER_REGION; n++) {
                    const idx = first + n;
                    const info = stageInfo(idx);
                    const st = S.campaign.stars[String(idx)] || 0;
                    const open = isStageUnlocked(S, idx);
                    const b = h('button.stage-btn', { type: 'button', class: `${info.boss ? 'boss' : ''}${idx === S.campaign.cleared ? ' next' : ''}`, disabled: open ? null : true, onclick: () => this.stagePopup(idx) },
                        h('span', info.boss ? `${info.label} Boss` : info.label),
                        h('span.ss', { html: [1, 2, 3].map((i) => `<span class="star${i <= st ? '' : ' off'}">★</span>`).join('') }));
                    app(row, b);
                }
                app(card, row);
            }
            app(wrap, card);
        });
        app(body, wrap);
    },
    stagePopup(idx) {
        const S = G.S;
        const info = stageInfo(idx);
        const st = S.campaign.stars[String(idx)] || 0;
        const body = h('div',
            h('p', { html: `${info.region.blurb}` }),
            h('div.kv', h('span.k', 'Enemies'), h('span.v', `${info.star}★ around level ${info.level}`), h('span.k', 'Stamina'), h('span.v', { html: `${icon('stamina')} ${info.stamina}` }), h('span.k', 'Gold'), h('span.v', `~${num(info.gold)}`), h('span.k', 'Hero XP'), h('span.v', `${num(info.heroXp)} each`), h('span.k', 'Stars'), h('span.v', { html: [1, 2, 3].map((i) => `<span class="star${i <= st ? '' : ' off'}">★</span>`).join('') })),
            !st ? h('div.notice', { style: { marginTop: '8px' }, html: `First clear: ${icon('gem')} ${info.firstGems}${info.boss ? ` + ${icon('sigil')} Mystic Sigil` : ''}` }) : null,
            h('p.muted.small', 'Drops: Sigilstones, Sigil Shards, essences, sometimes seeds and sigils.'));
        modal({ title: `${info.label} · ${info.boss ? BOSSES[info.region.boss].name : info.region.name}`, body, buttons: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Prepare', cls: 'gold', onClick: () => go('team', { mode: 'campaign', idx }) }] });
    },
    rifts(body) {
        const S = G.S;
        const wrap = h('div.wrap');
        if (S.campaign.cleared < 4) app(wrap, h('div.notice', 'Rifts open after you clear stage 1-4.'));
        app(wrap, h('p.muted.small', 'Rifts are farms for materials: Essence Halls drop the essences heroes need to Awaken; the Gilded Vault drops gold; the Armory drops Sigilstones. Each tier unlocks after the one before.'));
        for (const [id, R] of Object.entries(RIFTS)) {
            const best = S.rifts.best[id] || 0;
            const card = h('div.card');
            app(card, h('div.row', h('b.grow', { html: `${R.element ? elIcon(R.element) : icon(R.kind === 'gold' ? 'gold' : 'sword')} ${R.name}` }), h('span.muted.small', `Best: ${best ? 'Tier ' + best : '—'}`)));
            const row = h('div.stage-row', { style: { gridTemplateColumns: 'repeat(5, 1fr)', padding: '8px 0 0' } });
            for (let t = 1; t <= RIFT_TIERS; t++) {
                const open = isRiftUnlocked(S, id, t);
                const info = riftInfo(id, t);
                app(row, h('button.stage-btn', { type: 'button', class: t === best + 1 ? 'next' : '', disabled: open ? null : true, onclick: () => go('team', { mode: 'rift', id, tier: t }) },
                    h('span', `T${t}`), h('span.ss', { html: `${icon('stamina')}${info.stamina}` })));
            }
            app(card, row);
            app(wrap, card);
        }
        app(body, wrap);
    },
    modes(body) {
        const S = G.S;
        const tile = (name, sub, ico, bg, fn, locked) => h('button.mode-tile', { type: 'button', class: locked ? 'locked' : '', style: { '--tile': bg }, onclick: () => { if (locked) { toast(locked); return; } sfx('click'); fn(); } },
            h('div.mt-ico', { html: icon(ico) }), h('div.mt-name', name), h('div.mt-sub', sub));
        app(body, h('div.wrap', h('div.mode-grid',
            tile('Campaign', `Stage ${stageInfo(Math.min(63, S.campaign.cleared)).label}`, 'map', 'linear-gradient(160deg, #3a8a3a, #14301a)', () => { tab = 'campaign'; this.render(); }),
            tile('Endless Spire', `Floor ${S.spire.floor} · best ${S.spire.best}`, 'spire', 'linear-gradient(160deg, #6a4ad0, #1a1040)', () => go('spire'), S.campaign.cleared < 2 ? 'Clear stage 1-2 first.' : null),
            tile('Arena', `${S.arena.tickets} tickets · ${S.arena.points} pts`, 'arena', 'linear-gradient(160deg, #c84a3a, #3a1010)', () => go('arena'), S.campaign.cleared < 6 ? 'Clear stage 1-6 first.' : null),
            tile('Rifts', 'Essences · gold · gear', 'essence', 'linear-gradient(160deg, #2a8ac8, #0a2a4a)', () => { tab = 'rifts'; this.render(); }),
            tile('Expeditions', `${S.expeditions.active.length} out`, 'map', 'linear-gradient(160deg, #a8742a, #3a2410)', () => go('tavern')),
            tile('Mine', `Depth ${S.mine.depth}`, 'pick', 'linear-gradient(160deg, #6a6a7a, #20202a)', () => go('mine')),
        )));
    },
    refresh(what) { if (what !== 'tick') this.render(); },
};
