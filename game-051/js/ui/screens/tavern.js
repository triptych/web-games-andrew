/**
 * tavern.js — the expedition board: send parties exploring for loot.
 */

import { h, app, btn, icon, elIcon, clsIcon, num, toast, modal, heroCard, bar, showRewards, rewardGrid } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { refreshBoard, sendExpedition, claimExpedition, successChance, expeditionSlots, boardSize } from '../../sim/expeditions.js';
import { heroById, spend } from '../../sim/state.js';
import { heroBusy } from '../../sim/idle.js';
import { CLASSES } from '../../data/classes.js';
import { ELEMENT } from '../../data/core.js';
import { now } from '../../core/time.js';
import { dur } from '../../core/fmt.js';
import { sfx } from '../../audio.js';

const LOOT_ICON = { gold: 'gold', ore: 'ore', jewel: 'jewel', essence: 'essence', gear: 'sword', seeds: 'seed', shards: 'shard', elixir: 'elixir' };

export const tavernScreen = {
    id: 'tavern',
    stage: 'citadel',
    enter(root) { this.root = root; refreshBoard(G.S); this.render(); },
    render() {
        const S = G.S, root = this.root, t = now();
        root.innerHTML = '';
        const wrap = h('div.wrap');
        app(wrap, h('p.muted.small', 'Send idle heroes to explore. Parties with more power, the favoured elements and the right class succeed more often; great successes bring double loot. Heroes on expeditions can still fight.'));
        app(wrap, h('h2.sec', 'Out Exploring', h('span.aside', `${S.expeditions.active.length}/${expeditionSlots(S)}`)));
        if (!S.expeditions.active.length) app(wrap, h('p.muted.small', 'No parties out.'));
        for (const e of S.expeditions.active) {
            const left = e.endsAt - t;
            const done = left <= 0;
            const party = h('div.row', { style: { gap: '4px' } }, e.heroes.map((id) => { const x = heroById(S, id); return x ? h('div', { style: { width: '48px' } }, heroCard(x, { compact: true })) : null; }));
            app(wrap, h('div.card',
                h('div.row', h('b.grow', e.name), h('span.chip', `${Math.round(e.chance * 100)}%`)),
                party,
                h('div', { style: { marginTop: '6px' } }, bar(1 - Math.max(0, left) / (e.mins * 60000), done ? 'green' : 'gold', done ? 'Returned!' : dur(left))),
                done ? btn('See what they found', () => this.claim(e.id), 'gold small wide') : null));
        }
        app(wrap, h('h2.sec', 'Expedition Board', h('span.aside', btn(`New board ${icon('gem')}30`, () => { if (!spend(S, { gems: 30 })) { toast('Not enough gems.'); return; } refreshBoard(S, true); changed('board'); this.render(); }, 'ghost small'))));
        for (const e of S.expeditions.board) {
            app(wrap, h('div.card',
                h('div.row', h('b.grow', { html: `${e.rare ? '<span style="color:#ffc94a">★ </span>' : ''}${e.name}` }), h('span.chip', { html: `${icon('clock')} ${dur(e.mins * 60000)}` })),
                h('div.small.muted', { html: `Recommended power ${num(e.rec)} · Bonus: ${e.els.map((x) => elIcon(x)).join('')} ${clsIcon(e.cls)} ${CLASSES[e.cls].name}` }),
                h('div.chips', { style: { margin: '6px 0' } }, e.loot.map((l) => h('span.chip', { html: `${icon(LOOT_ICON[l])} ${l[0].toUpperCase() + l.slice(1)}` }))),
                btn('Choose Party', () => this.party(e), 'small wide', { disabled: S.expeditions.active.length >= expeditionSlots(S) })));
        }
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', 'Tavern · Expeditions')), h('div.sheet-body', wrap)));
    },
    party(exp) {
        const S = G.S;
        const sel = [];
        const cands = S.heroes.filter((x) => !S.expeditions.active.some((a) => a.heroes.includes(x.id)))
            .sort((a, b) => (exp.els.includes(b.el) ? 1 : 0) + (b.cls === exp.cls ? 1 : 0) - ((exp.els.includes(a.el) ? 1 : 0) + (a.cls === exp.cls ? 1 : 0)) || b.star - a.star || b.level - a.level);
        const grid = h('div.hero-grid');
        const info = h('div.notice');
        const go2 = btn('Send', () => {
            if (!sendExpedition(S, exp.id, sel)) { toast('Could not send that party.'); return false; }
            sfx('page'); toast(`${exp.name}: the party sets out!`, 'good'); changed('expedition'); this.render();
        }, 'gold', { disabled: true });
        const draw = () => {
            grid.innerHTML = '';
            for (const c of cands) {
                const good = exp.els.includes(c.el) || c.cls === exp.cls;
                grid.append(heroCard(c, { selected: sel.includes(c.id), tag: good ? 'BONUS' : null, onClick: () => { const i = sel.indexOf(c.id); if (i >= 0) sel.splice(i, 1); else if (sel.length < 4) sel.push(c.id); draw(); } }));
            }
            const ch = sel.length ? successChance(S, exp, sel) : 0;
            info.innerHTML = `Party ${sel.length}/4 · Success chance <b>${Math.round(ch * 100)}%</b>`;
            go2.disabled = !sel.length;
        };
        draw();
        const m = modal({ title: exp.name, body: h('div', info, h('div', { style: { height: '8px' } }), grid), cls: 'wide' });
        m.el.append(h('div.modal-btns', go2));
        go2.addEventListener('click', () => m.close());
    },
    claim(id) {
        const r = claimExpedition(G.S, id);
        if (!r) return;
        changed('expedition');
        sfx(r.great ? 'reveal4' : r.ok ? 'reward' : 'defeat');
        showRewards(r.great ? 'Great Success!' : r.ok ? 'Success' : 'The party returned empty-handed', r.items, h('div', h('p', r.story), h('p.muted.small', `Each hero gained ${num(r.xp)} XP.`)));
        this.render();
    },
    tick() { this.render(); },
    refresh(what) { if (what !== 'tick') this.render(); },
};
