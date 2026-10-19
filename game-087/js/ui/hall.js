// The Great Hall: Thalion by the fire, the guild's road, your novel, and the doors to every room.
// Also the Novel Charter, the form where a novel is founded and, at the end, marked complete.

import { h, rich, fmt, modal, toast, confirmBox, field, grow } from './dom.js';
import { thalionSvg } from '../view/portrait.js';
import { playScene } from './dialogue.js';
import { icon } from '../view/art.js';
import { ROOMS, GENRES, GENRE_BY_ID } from '../sim/data/guild.js';
import { LESSON_BY_ID } from '../sim/data/lessons.js';
import { mainQuest, mainReady, progressOf } from '../sim/quests.js';
import { roomOpen, askLesson } from '../sim/progress.js';
import { bookWords, streak } from '../sim/state.js';
import { countWords } from '../sim/text.js';
import { NOVEL_WORDS, FIELD } from '../config.js';
import * as A from '../sim/actions.js';
import { lengthName } from '../sim/actions.js';

function greeting(app) {
    const S = app.S, ctx = app.ctx(), p = S.player;
    const part = ctx.hour < 5 ? 'It is very late' : ctx.hour < 12 ? 'Good morning' : ctx.hour < 18 ? 'Good afternoon' : 'Good evening';
    const today = p.today.date === ctx.today ? p.today.words : 0;
    const st = streak(p, ctx.today);
    if (p.finale && !mainQuest(S)) return [`${part}, Master ${p.name}. The fire is warm and the shelves have room. What will the next book be?`, 'smile'];
    if (mainReady(S, ctx)) return [`${part}, ${p.name}. You look like someone with news. Come, tell me.`, 'proud'];
    if (ctx.hour < 5) return [`${part}, ${p.name}. The owls and I are the only ones awake. And you, apparently. Write; I won’t tell.`, 'wry'];
    if (today >= p.dailyGoal) return [`${fmt(today)} words today. The day’s fire is lit${st > 1 ? `, ${st} days running` : ''}. Anything more is a gift.`, 'proud'];
    if (today > 0) return [`${fmt(today)} words so far today. ${fmt(p.dailyGoal - today)} more and the day’s fire is lit.`, 'smile'];
    if (st > 0) return [`${part}, ${p.name}. ${st} day${st > 1 ? 's' : ''} in a row. Don’t let the fire go out today.`, 'thoughtful'];
    return [`${part}, ${p.name}. The page is waiting. It always is.`, 'smile'];
}

export function hallView(app, root) {
    const S = app.S, ctx = app.ctx();
    const P = app.P();
    const q = mainQuest(S);
    const [line, mood] = greeting(app);
    const ready = mainReady(S, ctx);

    const speak = h('button', { class: `btn ${ready ? 'primary glow' : ''}`, id: 'btn-speak', onclick: async () => { await app.speak(); } }, ready ? `Tell Thalion: ${q.title} is done` : 'Speak with Thalion');
    if (!ready) speak.onclick = () => {
        const lines = q ? [{ who: 'thalion', mood: 'thoughtful', text: `Your task now: **${q.title}**. ${q.blurb} ${q.where}` }] : [{ who: 'thalion', mood: 'smile', text: 'The road is walked, and the Hall is yours. Begin another book whenever you like; I will be by the fire.' }];
        playScene(lines, app);
    };
    const ask = h('button', { class: 'btn', id: 'btn-ask', onclick: () => askThalion(app, 'hall') }, 'Ask for wisdom');

    const hero = h('section', { class: 'hall-hero card' },
        h('div', { class: 'hall-portrait', html: thalionSvg(mood) }),
        h('div', { class: 'hall-talk' },
            h('p', { class: 'eyebrow' }, 'Thalion Silverquill · Master of the Guild'),
            h('p', { class: 'speech', html: rich(line) }),
            h('div', { class: 'row-wrap' }, speak, ask, h('button', { class: 'btn', id: 'btn-charter', onclick: () => openCharter(app) }, 'Novel Charter'))));

    // the road
    let road = null;
    if (q) {
        const steps = progressOf(q.steps, S, ctx);
        road = h('section', { class: 'card road' },
            h('div', { class: 'card-head' }, h('h2', {}, q.title), h('span', { class: 'chip' }, `The guild’s road · ${S.player.main + 1} of 12`)),
            h('p', { class: 'muted' }, q.blurb),
            h('ul', { class: 'steps' }, steps.map((st) => h('li', { class: st.full ? 'done' : '' },
                h('span', { class: 'tick', 'aria-hidden': 'true' }, st.full ? '✓' : ''), h('span', {}, st.label),
                st.of > 1 ? h('span', { class: 'meter' }, h('i', { style: { width: `${(st.done / st.of) * 100}%` } })) : null,
                st.of > 1 ? h('span', { class: 'num' }, `${fmt(st.done)} / ${fmt(st.of)}`) : null))),
            h('p', { class: 'hint' }, ready ? 'Ready: speak with Thalion above.' : q.where));
    }

    // the novel
    let novel = null;
    if (P) {
        const w = bookWords(P);
        const g = GENRE_BY_ID[P.genre];
        novel = h('section', { class: 'card novel-card' },
            h('div', { class: 'card-head' }, h('h2', {}, P.title || 'Untitled'), h('span', { class: 'chip' }, P.status === 'complete' ? `A finished ${lengthName(w)}` : g?.name || 'Fantasy')),
            P.logline ? h('p', { class: 'logline', html: rich(P.logline) }) : h('p', { class: 'muted' }, 'No logline yet. Open the Charter.'),
            h('div', { class: 'lamp-meter', title: `${fmt(w)} of ${fmt(NOVEL_WORDS)} words` },
                h('span', { class: 'lamp' + (w >= NOVEL_WORDS ? ' lit' : '') }, '✺'),
                h('span', { class: 'meter big' }, h('i', { style: { width: `${Math.min(100, (w / NOVEL_WORDS) * 100)}%` } })),
                h('span', { class: 'num' }, `${fmt(w)} words`)),
            h('p', { class: 'hint' }, `${P.chapters.length} chapter${P.chapters.length === 1 ? '' : 's'} · ${P.characters.length} character${P.characters.length === 1 ? '' : 's'} · ${P.world.length} world entr${P.world.length === 1 ? 'y' : 'ies'}`),
            roomOpen(S, 'scriptorium') ? h('button', { class: 'btn primary', onclick: () => app.go('scriptorium') }, 'Write') : null);
    }

    // the doors
    const doors = h('section', { class: 'doors', 'aria-label': 'Rooms of the guild' }, ROOMS.filter((r) => r.id !== 'hall').map((r) => {
        const open = roomOpen(S, r.id);
        return h('button', { class: `door${open ? '' : ' locked'}`, dataset: { room: r.id }, 'aria-label': open ? r.name : `${r.name}, locked`, onclick: () => { if (open) app.go(r.id); else toast(`${r.name} is still locked. Keep to the guild’s road.`); } },
            h('span', { class: 'door-arch' }, h('span', { class: 'door-ic', html: icon(open ? r.id : 'lock') })),
            h('span', { class: 'door-name' }, r.name), h('span', { class: 'door-blurb' }, open ? r.blurb : 'Not yet open.'));
    }));

    root.append(h('div', { class: 'hall' }, hero, h('div', { class: 'hall-cols' }, road, novel), h('h2', { class: 'section-title' }, 'The rooms of the guild'), doors));
}

/** Ask Thalion for a lesson in a room; shows it in a modal and counts toward bounties. */
export function askThalion(app, room) {
    const r = askLesson(app.S, room, app.ctx());
    app.after();
    const l = LESSON_BY_ID[r.id];
    modal((card, close) => {
        card.classList.add('lesson-card');
        card.append(h('div', { class: 'lesson-face', html: thalionSvg(l.mood) }),
            h('div', {}, h('p', { class: 'eyebrow' }, r.fresh ? 'A new lesson' : 'A lesson, again'), h('h2', {}, l.title),
                ...l.text.split(/\n\n/).map((p) => h('p', { html: rich(p) })),
                h('div', { class: 'row-end' }, h('button', { class: 'btn primary', onclick: close }, 'Thank you'))));
    }, { label: l.title, wide: true });
}

// ------------------------------------------------------------------ the charter

export function openCharter(app) {
    const S = app.S;
    let P = app.P();
    if (!P) P = A.createProject(S, {}, app.ctx());
    modal((card, close) => {
        const title = h('input', { type: 'text', value: P.title === 'Untitled' ? '' : P.title, placeholder: 'The title of your novel', maxlength: 120, id: 'ch-title' });
        const subtitle = h('input', { type: 'text', value: P.subtitle, placeholder: 'Book One of the …', maxlength: 120, id: 'ch-subtitle' });
        const genre = h('select', { id: 'ch-genre' }, GENRES.map((g) => h('option', { value: g.id, selected: g.id === P.genre }, g.name)));
        const gnote = h('p', { class: 'hint' });
        const logline = grow(h('textarea', { rows: 2, id: 'ch-logline', placeholder: 'When …, a … must …, or else …', value: P.logline }));
        const lcount = h('span', { class: 'count' });
        const premise = grow(h('textarea', { rows: 5, id: 'ch-premise', placeholder: 'Who, where, what goes wrong, what is at stake, and roughly how it might end.', value: P.premise }));
        const pcount = h('span', { class: 'count' });
        const theme = h('input', { type: 'text', id: 'ch-theme', value: P.theme, placeholder: 'What the book is really about (you may not know yet)', maxlength: 200 });
        const notes = grow(h('textarea', { rows: 3, id: 'ch-notes', placeholder: 'Ideas, kept things from the Well, anything.', value: P.notes || '' }));
        const update = () => {
            gnote.innerHTML = rich(`*${GENRE_BY_ID[genre.value].blurb}* Thalion: “${GENRE_BY_ID[genre.value].thalion}”`);
            const lw = countWords(logline.value), pw = countWords(premise.value);
            lcount.textContent = `${lw} / ${FIELD.loglineWords}+ words`; lcount.classList.toggle('ok', lw >= FIELD.loglineWords);
            pcount.textContent = `${pw} / ${FIELD.premiseWords}+ words`; pcount.classList.toggle('ok', pw >= FIELD.premiseWords);
        };
        const save = () => {
            A.editCharter(S, { title: title.value.trim() || 'Untitled', subtitle: subtitle.value, genre: genre.value, logline: logline.value, premise: premise.value, theme: theme.value, notes: notes.value }, app.ctx());
            app.after();
        };
        for (const el of [title, subtitle, genre, logline, premise, theme, notes]) { el.addEventListener('input', () => { update(); save(); }); el.addEventListener('change', save); }
        update();

        const w = bookWords(P);
        const done = P.status === 'complete';
        const finish = h('button', { class: `btn ${done ? '' : 'gold'}`, id: 'ch-complete', onclick: async () => {
            if (done) { A.setComplete(S, false, app.ctx()); app.after(); close(); toast('The book is open again. Revise away.'); app.refresh(); return; }
            if (w < 100) { toast('Write at least a hundred words before you call it finished.'); return; }
            const kind = lengthName(w);
            if (!(await confirmBox('Is it finished?', `Mark **${P.title}** complete, a ${kind} of ${fmt(w)} words? You can still revise it afterwards.`, { ok: 'It is finished' }))) return;
            A.setComplete(S, true, app.ctx());
            app.after();
            close();
            app.refresh();
        } }, done ? 'Reopen for revision' : 'Mark the book complete');

        card.append(
            h('h2', {}, 'The Novel Charter'),
            h('p', { class: 'muted' }, 'Every book begins here. Thalion keeps a copy.'),
            field('Title', title), field('Subtitle (optional)', subtitle),
            field('Kind of fantasy', genre), gnote,
            field('Logline', logline, 'One breath: *When* [something happens], *a* [someone] *must* [do something], *or else* [something terrible].'), lcount,
            field('Premise', premise, 'A paragraph: the people, the place, the trouble, the stakes.'), pcount,
            field('Theme', theme),
            field('Notes', notes),
            h('div', { class: 'row-end charter-foot' }, h('span', { class: 'muted' }, `${fmt(w)} words written`), finish, h('button', { class: 'btn primary', id: 'ch-done', onclick: () => { save(); close(); app.refresh(); } }, 'Done')));
    }, { wide: true, label: 'Novel Charter', onClose: () => app.refresh() });
}
