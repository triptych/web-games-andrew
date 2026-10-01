/**
 * quests.js — main questline, dailies, weeklies and achievements.
 */

import { h, app, btn, icon, num, bar, showRewards, rewardGrid, toast } from '../dom.js';
import { G, changed } from '../../game.js';
import { go } from '../app.js';
import { ensureQuests, questView, claimQuest, claimChest, DAILY_CHESTS, WEEKLY_CHESTS, mainQuest, claimMain, MAIN_QUESTS, ACHIEVEMENTS, achievementView, claimAchievement } from '../../sim/quests.js';
import { grant } from '../../sim/state.js';
import { msToNextDay } from '../../core/time.js';
import { dur } from '../../core/fmt.js';
import { sfx } from '../../audio.js';

let tab = 'daily';

function describeReward(b) {
    // quick preview without granting: a fake grant list
    const out = [];
    for (const [k, v] of Object.entries(b)) {
        if (typeof v === 'number') out.push({ kind: k === 'xp' ? 'xp' : k, n: v });
        else if (k === 'essences') for (const [el, t] of Object.entries(v)) for (const [tier, n] of Object.entries(t)) out.push({ kind: 'essences', id: el, tier, n });
        else for (const [id, n] of Object.entries(v)) out.push({ kind: k, id, n });
    }
    return out;
}

export const questsScreen = {
    id: 'quests',
    tab: 'quests',
    stage: 'citadel',
    enter(root, params) {
        this.root = root;
        if (params.tab) tab = params.tab;
        ensureQuests(G.S);
        this.render();
    },
    render() {
        const S = G.S;
        const root = this.root;
        root.innerHTML = '';
        const tabs = h('div.tabs', ...[['main', 'Story'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['ach', 'Feats']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        const wrap = h('div.wrap');
        app(body, wrap);
        if (tab === 'main') this.main(wrap);
        else if (tab === 'daily') this.list(wrap, false);
        else if (tab === 'weekly') this.list(wrap, true);
        else this.ach(wrap);
        app(root, h('div.sheet', h('div.sheet-head', h('h1', 'Quests'), tab === 'daily' ? h('span.muted.small', `Resets in ${dur(msToNextDay())}`) : null), tabs, body));
    },
    main(wrap) {
        const S = G.S;
        const q = mainQuest(S);
        if (!q) { app(wrap, h('div.empty', 'Every chapter of the main quest is complete. The throne is yours, Overlord.')); return; }
        app(wrap, h('p.muted.small', `Chapter ${q.idx + 1} of ${MAIN_QUESTS.length}`), bar(q.idx / MAIN_QUESTS.length, 'gold'));
        const card = h('div.quest', { class: q.done ? 'done' : '', style: { marginTop: '10px' } }, h('div.q-body', h('div.q-text', q.text), h('div.small.muted', 'Reward:')),
            q.done ? btn('Claim', () => { const got = claimMain(S); changed('quest'); showRewards('Quest Complete!', got); this.render(); }, 'gold small') : btn('Go', () => { const t = { summon: 'summon', adventure: 'adventure', team: 'adventure', heroes: 'heroes', treasury: 'treasury', farm: 'farm', mine: 'mine', forge: 'forge', market: 'market', spire: 'spire', tavern: 'tavern', kitchen: 'farm', arena: 'arena', rifts: 'adventure', overlord: 'overlord', citadel: 'treasury' }[q.hint]; if (t) go(t, t === 'adventure' && q.hint === 'rifts' ? { tab: 'rifts' } : {}); }, 'small'));
        card.querySelector('.q-body').append(rewardGrid(describeReward(q.reward)));
        app(wrap, card);
        app(wrap, h('h2.sec', 'Coming up'));
        for (const n of MAIN_QUESTS.slice(q.idx + 1, q.idx + 5)) app(wrap, h('div.quest.claimed', h('div.q-body', h('div.q-text', n.text))));
    },
    list(wrap, weekly) {
        const S = G.S;
        const pts = weekly ? S.quests.weeklyPts : S.quests.dailyPts;
        const chests = weekly ? WEEKLY_CHESTS : DAILY_CHESTS;
        const got = weekly ? S.quests.weeklyChests : S.quests.dailyChests;
        const max = chests[chests.length - 1].at;
        app(wrap, h('div', bar(pts / max, 'gold tall', `${pts} / ${max} activity`)));
        const row = h('div.chest-row');
        chests.forEach((c, i) => {
            const ready = pts >= c.at && !got.includes(i);
            app(row, h('button.chest-btn', { type: 'button', class: got.includes(i) ? 'got' : ready ? 'ready' : '', onclick: () => {
                if (!ready) { showRewards(`Chest at ${c.at}`, describeReward(c.reward)); return; }
                const r = claimChest(S, i, weekly); changed('quest'); showRewards('Activity Chest', r); this.render();
            } }, h('span', { html: icon('chest') }), `${c.at}`));
        });
        app(wrap, row);
        const list = weekly ? S.quests.weekly : S.quests.daily;
        list.forEach((q, i) => {
            const v = questView(S, q, weekly);
            app(wrap, h('div.quest', { class: q.claimed ? 'claimed' : v.done ? 'done' : '' },
                h('div.q-body', h('div.q-text', v.text), bar(v.prog / v.target, v.done ? 'green' : '', `${v.prog}/${v.target}`)),
                q.claimed ? h('span', { html: icon('check') }) : btn(v.done ? 'Claim' : `+20`, () => { if (!v.done) return; const r = claimQuest(S, i, weekly); changed('quest'); sfx('coin'); toast(`+20 activity`, 'good'); this.render(); }, v.done ? 'gold small' : 'ghost small', { disabled: !v.done })));
        });
    },
    ach(wrap) {
        const S = G.S;
        for (const a of ACHIEVEMENTS) {
            const v = achievementView(S, a);
            const target = v.maxed ? a.tiers[a.tiers.length - 1] : v.next;
            app(wrap, h('div.quest', { class: v.maxed ? 'claimed' : v.done ? 'done' : '' },
                h('div.q-body', h('div.q-text', `${a.name} ${'I'.repeat(Math.min(v.tier + 1, a.tiers.length))}`), h('div.small.muted', v.maxed ? 'Mastered' : `Reach ${num(target)}${a.title && v.tier + 1 === a.tiers.length ? ` · title “${a.title}”` : ''}`), bar(Math.min(1, v.value / target), v.done ? 'green' : '', `${num(Math.min(v.value, target))}/${num(target)}`)),
                v.maxed ? h('span', { html: icon('crown') }) : btn(v.done ? `Claim ${icon('gem')}${a.gems[v.tier]}` : `${icon('gem')}${a.gems[v.tier]}`, () => { if (!v.done) return; const r = claimAchievement(S, a.id); changed('quest'); showRewards('Feat Accomplished!', r); this.render(); }, v.done ? 'gold small' : 'ghost small', { disabled: !v.done })));
        }
    },
    refresh(what) { if (what !== 'tick') this.render(); },
};

export { describeReward };
