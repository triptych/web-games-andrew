// The Plot Loom: choose a structure and fill its beats (each can point at chapters), then weave threads,
// your subplots, across the chapters on the loom itself.

import { h, rich, confirmBox, debounce, grow, promptBox } from './dom.js';
import { STRUCTURES, STRUCTURE_BY_ID } from '../sim/data/guild.js';
import { beatFilled } from '../sim/progress.js';
import { countWords } from '../sim/text.js';
import { FIELD } from '../config.js';
import * as A from '../sim/actions.js';
import { askThalion } from './hall.js';

export function loomView(app, root) {
    const S = app.S, P = app.P();
    const st = STRUCTURE_BY_ID[P.outline.structure];
    root.append(h('div', { class: 'room-head' }, h('h1', {}, 'The Plot Loom'),
        h('div', { class: 'row-wrap' }, st ? h('button', { class: 'btn small', id: 'loom-change', onclick: () => pick(true) }, `Structure: ${st.name} ▾`) : null, h('button', { class: 'btn small ghost', onclick: () => askThalion(app, 'loom') }, 'Ask Thalion'))));

    function pick(changing) {
        const box = h('div', { class: 'structures', id: 'structures' }, STRUCTURES.map((s) => h('button', { class: `structure${P.outline.structure === s.id ? ' on' : ''}`, dataset: { structure: s.id }, onclick: async () => {
            if (changing && P.outline.structure && P.outline.structure !== s.id && !(await confirmBox(`Change to ${s.name}?`, 'Your notes on the old beats are kept, and come back if you change back.', { ok: 'Change' }))) return;
            A.chooseStructure(S, s.id, app.ctx()); app.after(); app.refresh();
        } }, h('strong', {}, s.name), h('span', {}, s.blurb), h('em', {}, `${s.beats.length} beats`))));
        if (changing) import('./dom.js').then(({ modal }) => modal((card, close) => { card.append(h('h2', {}, 'Choose a structure'), box, h('div', { class: 'row-end' }, h('button', { class: 'btn', onclick: close }, 'Keep this one'))); }, { wide: true, label: 'Choose a structure' }));
        return box;
    }

    if (!st) {
        root.append(h('section', { class: 'card' }, h('p', { html: rich('Thalion: “Every tale has a shape, even the ones that pretend not to. Choose one to start; you can change it later, and your notes are kept.”') }), pick(false)));
        root.append(threads());
        return null;
    }

    const filled = st.beats.filter((b) => beatFilled(P.outline.beats[`${st.id}:${b.id}`])).length;
    const acts = [...new Set(st.beats.map((b) => b.act))];
    root.append(h('p', { class: 'muted' }, `${filled} of ${st.beats.length} beats filled · ${st.blurb}`));
    const board = h('div', { class: 'beats', id: 'beats' }, acts.map((act) => h('section', { class: 'act' }, h('h2', { class: 'act-name' }, st.id === 'kishotenketsu' ? st.beats.find((b) => b.act === act).name.split(':')[0] : `Act ${['', 'I', 'II', 'III', 'IV'][act]}`),
        st.beats.filter((b) => b.act === act).map((b) => {
            const key = `${st.id}:${b.id}`;
            const data = P.outline.beats[key] || { notes: '', chapters: [] };
            const card = h('article', { class: `beat${beatFilled(data) ? ' filled' : ''}`, dataset: { beat: key } });
            const notes = grow(h('textarea', { rows: 3, placeholder: 'What happens here, in your book?', value: data.notes, 'aria-label': `${b.name}: notes` }));
            const count = h('span', { class: 'count' });
            const paintCount = () => { const n = countWords(notes.value); count.textContent = n >= FIELD.beatWords ? '✓' : `${n}/${FIELD.beatWords}`; count.classList.toggle('ok', n >= FIELD.beatWords); card.classList.toggle('filled', n >= FIELD.beatWords); };
            const save = debounce(() => { A.editBeat(S, key, { notes: notes.value }, app.ctx()); app.after(); }, 400);
            notes.addEventListener('input', () => { paintCount(); save(); });
            notes.addEventListener('blur', () => save.flush());
            paintCount();
            const chips = h('div', { class: 'chips' }, P.chapters.map((ch, i) => {
                const on = (data.chapters || []).includes(ch.id);
                return h('button', { class: `chip-btn${on ? ' on' : ''}`, 'aria-pressed': String(on), title: ch.title, onclick: (e) => {
                    const cur = P.outline.beats[key]?.chapters || [];
                    const next = cur.includes(ch.id) ? cur.filter((x) => x !== ch.id) : [...cur, ch.id];
                    A.editBeat(S, key, { notes: notes.value, chapters: next }, app.ctx()); app.after();
                    e.currentTarget.classList.toggle('on'); e.currentTarget.setAttribute('aria-pressed', String(next.includes(ch.id)));
                } }, String(i + 1));
            }));
            card.append(h('div', { class: 'beat-head' }, h('strong', {}, b.name), h('span', { class: 'pct' }, `${b.pct}%`), count),
                h('p', { class: 'guide', html: rich(b.guide) }), notes, h('div', { class: 'chips-row' }, h('span', { class: 'lbl' }, 'Chapters'), chips));
            return card;
        }))));
    root.append(board, threads());

    function threads() {
        const box = h('section', { class: 'card loom', id: 'loom' }, h('div', { class: 'card-head' }, h('h2', {}, 'The Loom'),
            h('button', { class: 'btn small', id: 'thread-new', onclick: async () => { const n = await promptBox('Name the thread', { placeholder: 'The romance, the curse, the stolen crown…', ok: 'Add thread' }); if (n) { A.addThread(S, n, app.ctx()); app.after(); app.refresh(); } } }, '+ Thread')),
        h('p', { class: 'hint' }, 'Each row is a thread (a subplot, a mystery, a relationship). Tap a chapter to weave the thread through it. A thread that vanishes for half the book is a thread the reader will miss.'));
        if (!P.threads.length) { box.append(h('p', { class: 'muted' }, 'No threads yet.')); return box; }
        const table = h('div', { class: 'loom-grid', style: { gridTemplateColumns: `minmax(120px, 180px) repeat(${P.chapters.length}, minmax(34px, 1fr))` }, role: 'grid', 'aria-label': 'Threads by chapter' });
        table.append(h('span', { class: 'lg-corner' }, 'Thread · chapter'), ...P.chapters.map((ch, i) => h('span', { class: 'lg-col', title: ch.title }, String(i + 1))));
        for (const t of P.threads) {
            const name = h('button', { class: 'lg-name', style: { '--c': t.color }, onclick: async () => {
                const n = await promptBox('Rename the thread (empty to remove it)', { value: t.name });
                if (n === null) return;
                if (!n) { if (await confirmBox('Remove this thread?', `“${t.name}” will be unwoven from every chapter.`, { ok: 'Remove', danger: true })) { A.deleteThread(S, t.id, app.ctx()); app.after(); app.refresh(); } return; }
                A.editThread(S, t.id, { name: n }, app.ctx()); app.after(); app.refresh();
            } }, t.name);
            table.append(name, ...P.chapters.map((ch) => h('button', { class: `lg-cell${t.cells[ch.id] ? ' on' : ''}`, style: { '--c': t.color }, 'aria-label': `${t.name} in ${ch.title}`, 'aria-pressed': String(!!t.cells[ch.id]), dataset: { thread: t.id, chapter: ch.id }, onclick: (e) => {
                A.toggleWeave(S, t.id, ch.id, app.ctx()); app.after();
                e.currentTarget.classList.toggle('on', !!t.cells[ch.id]);
                e.currentTarget.setAttribute('aria-pressed', String(!!t.cells[ch.id]));
                app.sound.blip();
            } })));
        }
        const gaps = P.threads.filter((t) => { const idx = P.chapters.map((c) => !!t.cells[c.id]); const first = idx.indexOf(true), last = idx.lastIndexOf(true); let run = 0, worst = 0; for (let i = first; i <= last && first >= 0; i++) { run = idx[i] ? 0 : run + 1; worst = Math.max(worst, run); } return worst >= 4; });
        box.append(h('div', { class: 'loom-scroll' }, table));
        if (gaps.length) box.append(h('p', { class: 'hint warn' }, `Thalion: “${gaps.map((t) => t.name).join(', ')} disappear${gaps.length === 1 ? 's' : ''} for four chapters or more. Did you forget, or is the silence the point?”`));
        return box;
    }
    return null;
}
