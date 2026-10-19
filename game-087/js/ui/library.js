// The Library: the Tomes of Craft (lessons Thalion has taught), laurels, the bestiary, the ledger of days
// and the shelf of novels (switch, begin or remove a book).

import { h, rich, fmt, toast, confirmBox, modal } from './dom.js';
import { thalionSvg } from '../view/portrait.js';
import { foeSvg } from '../view/art.js';
import { LESSONS, LESSON_BY_ID } from '../sim/data/lessons.js';
import { FOES, ROOM_BY_ID, GENRE_BY_ID } from '../sim/data/guild.js';
import { LAURELS } from '../sim/progress.js';
import { bookWords, dayOffset, streak } from '../sim/state.js';
import { NOVEL_WORDS } from '../config.js';
import * as A from '../sim/actions.js';
import { lengthName } from '../sim/actions.js';
import { openCharter } from './hall.js';

export function libraryView(app, root) {
    const S = app.S;
    let tab = app.libTab || 'tomes';
    const tabs = h('div', { class: 'tabs wrap', role: 'tablist' });
    const body = h('div', { class: 'lib-body' });
    root.append(h('div', { class: 'room-head' }, h('h1', {}, 'The Library')), tabs, body);

    const TABS = [['tomes', 'Tomes of Craft'], ['shelf', 'Your Shelf'], ['laurels', 'Laurels'], ['bestiary', 'Bestiary'], ['ledger', 'Ledger of Days']];
    function paint() {
        tabs.innerHTML = '';
        for (const [id, name] of TABS) tabs.append(h('button', { class: `tab${tab === id ? ' on' : ''}`, role: 'tab', 'aria-selected': String(tab === id), dataset: { tab: id }, onclick: () => { tab = id; app.libTab = id; paint(); } }, name));
        body.innerHTML = '';
        ({ tomes, shelf, laurels, bestiary, ledger })[tab]();
    }

    function tomes() {
        const known = S.player.lessons;
        body.append(h('p', { class: 'muted' }, `${known.length} of ${LESSONS.length} lessons. Ask Thalion in any room to learn the ones from that room.`));
        const rooms = [...new Set(LESSONS.map((l) => l.room))];
        for (const r of rooms) {
            body.append(h('h2', { class: 'section-title' }, ROOM_BY_ID[r].name),
                h('div', { class: 'tomes' }, LESSONS.filter((l) => l.room === r).map((l) => {
                    const has = known.includes(l.id);
                    return h('button', { class: `tome${has ? '' : ' locked'}`, dataset: { lesson: l.id }, disabled: !has, onclick: () => read(l.id) },
                        h('strong', {}, has ? l.title : '? ? ?'), h('span', { class: 'muted' }, has ? l.text.split(/\n/)[0].replace(/\*/g, '').slice(0, 90) + '…' : 'Not yet taught.'));
                })));
        }
    }
    function read(id) {
        const l = LESSON_BY_ID[id];
        modal((card, close) => {
            card.classList.add('lesson-card');
            card.append(h('div', { class: 'lesson-face', html: thalionSvg(l.mood) }), h('div', {}, h('h2', {}, l.title), ...l.text.split(/\n\n/).map((p) => h('p', { html: rich(p) })), h('div', { class: 'row-end' }, h('button', { class: 'btn primary', onclick: close }, 'Close'))));
        }, { wide: true, label: l.title });
    }

    function shelf() {
        body.append(h('div', { class: 'row-wrap' }, h('button', { class: 'btn primary', id: 'novel-new', onclick: async () => {
            A.createProject(S, { title: 'Untitled' }, app.ctx());
            app.after();
            app.dirty.add(S.activeId);
            toast('A new book. Name it in the Charter.');
            openCharter(app);
        } }, '+ Begin a new book')));
        const books = h('div', { class: 'shelf' }, S.order.map((id) => {
            const P = S.projects[id];
            const w = bookWords(P);
            const isActive = id === S.activeId;
            return h('article', { class: `book${isActive ? ' on' : ''}${P.status === 'complete' ? ' done' : ''}`, dataset: { project: id } },
                h('div', { class: 'spine', style: { '--h': `${120 + Math.min(80, w / 1000)}px` } }, h('span', {}, P.title || 'Untitled')),
                h('div', { class: 'book-text' }, h('h3', {}, P.title || 'Untitled', P.status === 'complete' ? h('span', { class: 'lamp lit', title: 'Finished' }, ' ✺') : null),
                    h('p', { class: 'muted' }, `${GENRE_BY_ID[P.genre]?.name || ''} · ${fmt(w)} words · ${P.status === 'complete' ? `a finished ${lengthName(w)}` : `${Math.round(Math.min(1, w / NOVEL_WORDS) * 100)}% of a novel`}`),
                    P.logline ? h('p', { html: rich(P.logline) }) : null,
                    h('div', { class: 'row-wrap' },
                        isActive ? h('span', { class: 'chip' }, 'On your desk') : h('button', { class: 'btn small primary', onclick: () => { app.flushWriting?.(); A.selectProject(S, id, app.ctx()); app.after(); toast(`“${P.title}” is on your desk.`); paint(); app.topbar(); } }, 'Put on the desk'),
                        h('button', { class: 'btn small ghost', onclick: async () => {
                            if (S.order.length <= 1) { toast('This is your only book. Begin another before removing it.'); return; }
                            if (!(await confirmBox(`Remove “${P.title}”?`, `Its ${fmt(w)} words, characters and world will be deleted from this browser. Bind it or download a backup first if you want to keep it.`, { ok: 'Remove it', danger: true }))) return;
                            A.deleteProject(S, id, app.ctx());
                            app.dirty.add(id);
                            app.after();
                            paint();
                        } }, 'Remove'))));
        }));
        body.append(books);
    }

    function laurels() {
        const got = S.player.laurels;
        body.append(h('p', { class: 'muted' }, `${Object.keys(got).length} of ${LAURELS.length} laurels.`),
            h('div', { class: 'laurels' }, LAURELS.map((l) => h('div', { class: `laurel${got[l.id] ? ' got' : ''}`, dataset: { laurel: l.id } }, h('span', { class: 'wreath', 'aria-hidden': 'true' }, got[l.id] ? '❦' : '○'), h('strong', {}, l.name), h('span', { class: 'muted' }, l.blurb), got[l.id] && got[l.id].length === 10 ? h('span', { class: 'hint' }, got[l.id]) : null))));
    }

    function bestiary() {
        body.append(h('div', { class: 'foes' }, FOES.filter((f) => !f.training).map((f) => {
            const r = S.player.bestiary[f.id];
            const seen = !!r;
            return h('div', { class: `foe-card static${r?.wins ? ' beaten' : ''}${seen ? '' : ' locked'}` },
                h('span', { class: 'foe-art', html: foeSvg(f.id, f.name) }),
                h('span', { class: 'foe-text' }, h('strong', {}, seen ? f.name : '???'), h('span', { class: 'muted' }, seen ? f.blurb : 'Not yet faced.'),
                    r ? h('span', { class: 'rec' }, `${r.wins} won · ${r.losses} lost${r.best ? ` · best ${Math.floor(r.best / 60)}:${String(r.best % 60).padStart(2, '0')}` : ''}`) : null));
        })));
    }

    function ledger() {
        const ctx = app.ctx();
        const p = S.player;
        const weeks = 26;
        // start on the Monday 25 weeks before this week
        const [y, m, d] = ctx.today.split('-').map(Number);
        const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
        const start = dayOffset(ctx.today, -dow - (weeks - 1) * 7);
        const grid = h('div', { class: 'heat', role: 'img', 'aria-label': 'Words written each day for the last 26 weeks' });
        for (let k = 0; k < weeks * 7; k++) {
            const day = dayOffset(start, k);
            if (day > ctx.today) { grid.append(h('i', { class: 'future' })); continue; }
            const n = p.days[day] || 0;
            const lv = n === 0 ? 0 : n >= p.dailyGoal ? (n >= p.dailyGoal * 2 ? 4 : 3) : n >= p.dailyGoal / 2 ? 2 : 1;
            grid.append(h('i', { class: `l${lv}`, title: `${day}: ${fmt(n)} words` }));
        }
        const total = Object.values(p.days).reduce((a, b) => a + b, 0);
        const daysWritten = Object.values(p.days).filter((n) => n > 0).length;
        body.append(h('section', { class: 'card' }, h('h2', {}, 'The Ledger of Days'), h('div', { class: 'heat-wrap' }, grid),
            h('p', { class: 'hint' }, 'Each square is a day: pale for a little, gold for your goal met, bright gold for twice it.'),
            h('dl', { class: 'stats' }, [
                ['Words written', fmt(p.stats.words)], ['Words pasted (no XP)', fmt(p.stats.pasted)], ['Days with words', fmt(daysWritten)], ['Average on those days', fmt(daysWritten ? total / daysWritten : 0)],
                ['Current streak', `${streak(p, ctx.today)} days`], ['Best streak', `${p.stats.bestStreak} days`], ['Duels won / lost', `${p.stats.duelsWon} / ${p.stats.duelsLost}`],
                ['Draws from the Well', fmt(p.stats.oracle)], ['Snapshots kept', fmt(p.stats.snapshots)], ['Books finished', fmt(p.stats.booksDone)],
            ].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))));
    }

    paint();
    return null;
}
