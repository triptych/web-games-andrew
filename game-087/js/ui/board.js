// The Quest Board: the guild's road (main quests), side errands and the day's three bounties.

import { h, fmt } from './dom.js';
import { MAIN, mainReady, progressOf, sideAvailable, sideReady, BOUNTY_BY_ID, SIDE_BY_ID } from '../sim/quests.js';
import * as A from '../sim/actions.js';

export function boardView(app, root) {
    const S = app.S, ctx = app.ctx();
    A.settle(S, ctx);
    app.after({ dirty: false });

    const road = h('section', { class: 'card' }, h('h2', {}, 'The Guild’s Road'),
        h('ol', { class: 'road-list' }, MAIN.map((m, i) => {
            const state = i < S.player.main ? 'done' : i === S.player.main ? 'now' : 'later';
            const steps = state === 'now' ? progressOf(m.steps, S, ctx) : null;
            return h('li', { class: `road-item ${state}`, dataset: { quest: m.id } },
                h('div', { class: 'road-line' }, h('span', { class: 'tick' }, state === 'done' ? '✓' : String(i + 1)), h('strong', {}, state === 'later' ? '· · ·' : m.title)),
                state !== 'later' ? h('p', { class: 'muted' }, m.blurb) : null,
                steps ? h('ul', { class: 'steps' }, steps.map((st) => h('li', { class: st.full ? 'done' : '' }, h('span', { class: 'tick' }, st.full ? '✓' : ''), h('span', {}, st.label),
                    st.of > 1 ? h('span', { class: 'num' }, `${fmt(st.done)} / ${fmt(st.of)}`) : null))) : null,
                state === 'now' && mainReady(S, ctx) ? h('button', { class: 'btn primary small', onclick: () => app.go('hall') }, 'Tell Thalion') : null);
        })));

    const avail = sideAvailable(S);
    const side = h('section', { class: 'card' }, h('h2', {}, 'Errands'),
        avail.length ? h('div', { class: 'errands' }, avail.map((sq) => {
            const [d, of] = sq.check(S, ctx);
            const ready = sideReady(S, sq.id, ctx);
            return h('article', { class: `errand${ready ? ' ready' : ''}`, dataset: { side: sq.id } },
                h('div', { class: 'card-head' }, h('strong', {}, sq.title), h('span', { class: 'chip' }, `${fmt(sq.xp)} XP`)),
                h('p', { class: 'muted' }, sq.blurb),
                h('div', { class: 'row-wrap' }, h('span', { class: 'meter' }, h('i', { style: { width: `${Math.min(100, (d / of) * 100)}%` } })), h('span', { class: 'num' }, `${fmt(d)} / ${fmt(of)}`)),
                ready ? h('button', { class: 'btn small primary', onclick: () => { A.turnInSide(S, sq.id, ctx); app.after(); app.sound.fanfare(); app.refresh(); } }, 'Turn in') : null);
        })) : h('p', { class: 'muted' }, 'No errands posted yet. They appear as you walk the guild’s road.'),
        S.player.sideDone.length ? h('p', { class: 'hint' }, `Done: ${S.player.sideDone.map((id) => SIDE_BY_ID[id]?.title).filter(Boolean).join(', ')}.`) : null);

    const b = S.player.bounty;
    const bounties = h('section', { class: 'card bounties' }, h('h2', {}, 'Today’s bounties'),
        b.date === ctx.today && b.ids.length ? h('ul', { class: 'bounty-list' }, b.ids.map((id) => {
            const t = BOUNTY_BY_ID[id];
            const [d, of] = t.check(S);
            const done = b.done.includes(id);
            return h('li', { class: done ? 'done' : '', dataset: { bounty: id } }, h('span', { class: 'tick' }, done ? '✓' : ''), h('span', {}, t.text(S)), h('span', { class: 'num' }, done ? `+${t.xp} XP` : `${fmt(d)} / ${fmt(of)}`));
        })) : h('p', { class: 'muted' }, 'Bounties are posted once you have written your first ink.'),
        h('p', { class: 'hint' }, 'New bounties every morning. They complete themselves.'));

    root.append(h('div', { class: 'room-head' }, h('h1', {}, 'The Quest Board')), h('div', { class: 'board' }, h('div', {}, bounties, side), road));
    return null;
}
