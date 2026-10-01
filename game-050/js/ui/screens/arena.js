/**
 * arena.js — fight procedurally generated rival Overlords for rank and tokens.
 */

import { h, app, btn, icon, num, toast, heroCard, portrait } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { ensureRivals, rivalPower, arenaRank, teamPower } from '../../sim/content.js';
import { ARENA_TICKET_MAX, ARENA_TICKET_MINS } from '../../sim/idle.js';
import { generateHero } from '../../sim/heroes.js';
import { ARENA_RANKS } from '../../data/world.js';
import { spend } from '../../sim/state.js';
import { msToNextDay, now, MIN } from '../../core/time.js';
import { dur } from '../../core/fmt.js';

export const arenaScreen = {
    id: 'arena',
    stage: 'citadel',
    enter(root) { this.root = root; ensureRivals(G.S); this.render(); },
    render() {
        const S = G.S, A = S.arena, root = this.root;
        root.innerHTML = '';
        const rank = arenaRank(A.points);
        const next = ARENA_RANKS.find((r) => r.min > A.points);
        const wrap = h('div.wrap');
        const nextTicket = A.tickets >= ARENA_TICKET_MAX ? 'full' : dur(A.ticketAt + ARENA_TICKET_MINS * MIN - now());
        app(wrap,
            h('div.card.row', h('div.grow', h('div', { style: { fontFamily: 'var(--title)', fontSize: '22px', color: rank.color } }, rank.name), h('div.small.muted', `${A.points} points${next ? ` · ${next.min - A.points} to ${next.name}` : ''} · ${A.wins}W ${A.losses}L`)),
                h('div', { style: { textAlign: 'right' } }, h('div', { html: `${icon('arena')} <b>${A.tickets}/${ARENA_TICKET_MAX}</b> tickets` }), h('div.small.muted', `next: ${nextTicket}`))),
            h('p.muted.small', 'Rival Overlords from across the planes. Their teams are generated each day near your strength. Winning earns points and Arena tokens (spend them in the Market).'),
            h('div.row', { style: { margin: '6px 0' } }, h('div.grow.small.muted', `New rivals in ${dur(msToNextDay())}`),
                btn(`New rivals ${icon('gem')}20`, () => { if (!spend(S, { gems: 20 })) { toast('Not enough gems.'); return; } ensureRivals(S, true); changed('arena'); this.render(); }, 'ghost small')));
        const mine = teamPower(S, S.teams.arena.length ? S.teams.arena : S.teams.main);
        A.rivals.forEach((rv, i) => {
            const pw = rivalPower(rv);
            const team = h('div.row', { style: { gap: '4px', flexWrap: 'wrap' } }, rv.team.map((m) => { const hero = generateHero({ seed: m.seed, rarity: m.rarity }); hero.star = m.star; hero.level = m.level; hero.isNew = false; return h('div', { style: { width: '52px' } }, heroCard(hero, { compact: true })); }));
            const diff = pw / Math.max(1, mine);
            const col = diff > 1.25 ? 'var(--bad)' : diff > 0.95 ? 'var(--gold-2)' : 'var(--good)';
            app(wrap, h('div.card', { style: { opacity: rv.beaten ? 0.55 : 1 } },
                h('div.row', h('div', { style: { width: '54px', height: '54px', borderRadius: '50%', overflow: 'hidden', flex: 'none', border: '2px solid var(--line)' } }, portrait({ seed: 900 + i, look: rv.look })),
                    h('div.grow', h('b', rv.name), h('div.small', { html: `Power <b style="color:${col}">${num(pw)}</b> · ${rv.points} pts` })),
                    rv.beaten ? h('span.chip', 'Defeated') : btn('Fight', () => { if (A.tickets < 1) { toast('No tickets — one returns every hour.'); return; } go('team', { mode: 'arena', rival: i }); }, 'gold small')),
                h('div', { style: { marginTop: '6px' } }, team)));
        });
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', 'Arena')), h('div.sheet-body', wrap)));
    },
    tick() { },
    refresh(what) { if (what !== 'tick') this.render(); },
};
