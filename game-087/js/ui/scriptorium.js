// The Scriptorium: the binder of chapters and scenes, the page, and the inspector (scene notes, the Lens,
// drafts and tools). Typing is saved in batches through actions.writeScene, which credits new words.

import { h, rich, fmt, toast, confirmBox, promptBox, debounce, grow } from './dom.js';
import { thalionSvg } from '../view/portrait.js';
import * as A from '../sim/actions.js';
import { bookWords, chapterWords, findChapterOf, sceneList } from '../sim/state.js';
import { hasTalent } from '../sim/progress.js';
import { parseBlocks, inlineHtml, analyze, verdicts, countWords } from '../sim/text.js';
import { askThalion } from './hall.js';

const STATUS = [['idea', 'Idea'], ['draft', 'Draft'], ['revised', 'Revised'], ['final', 'Final']];

export function scriptoriumView(app, root) {
    const S = app.S;
    const P = app.P();
    if (!P) { root.append(h('p', {}, 'No novel yet. Open the Charter in the Great Hall.')); return null; }
    const ids = sceneList(P).map(({ sc }) => sc.id);
    let sid = ids.includes(P.lastScene) ? P.lastScene : ids[0];
    if (!sid) { const { sc } = A.addChapter(S, '', app.ctx()); sid = sc.id; app.after(); }
    app.session ||= { start: 0, words: 0, vow: 0 };

    const binder = h('aside', { class: 'binder', id: 'binder', 'aria-label': 'Chapters and scenes' });
    const inspector = h('aside', { class: 'inspector', id: 'inspector', 'aria-label': 'Scene details' });
    const titleIn = h('input', { class: 'scene-title-in', id: 'scene-title', type: 'text', maxlength: 120, 'aria-label': 'Scene title' });
    const ta = h('textarea', { class: 'page-text', id: 'page', spellcheck: 'true', 'aria-label': 'The page', placeholder: 'Begin anywhere. *Stars* for italics, **two** for bold, a line of * * * for a scene break.' });
    const reader = h('div', { class: 'reader', id: 'reader', hidden: true });
    const status = h('div', { class: 'statusbar', id: 'statusbar' });
    const vowRing = h('span', { class: 'vow', hidden: true });

    // ------------------------------------------------------------------ writing
    let lastWords = 0;
    const cur = () => P.scenes[sid];
    const flush = () => {
        if (!cur()) return;
        if (ta.value === cur().text) return;
        const before = cur().words;
        A.writeScene(S, sid, ta.value, app.ctx());
        const gained = cur().words - before;
        if (gained > 0) app.session.words += gained;
        app.after();
        paintStatus();
        paintBinderCounts();
    };
    const queue = debounce(flush, 450);
    app.flushWriting = () => queue.flush();
    ta.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') queue.flush();
    });
    ta.addEventListener('input', (e) => {
        if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
            A.writeScene(S, sid, ta.value, app.ctx(), { pasted: true });
            app.after();
            paintStatus();
            return;
        }
        app.sound.scratch();
        if (!app.session.start) app.session.start = Date.now();
        queue();
        // live counts without waiting for the save
        const w = countWords(ta.value);
        if (w !== lastWords) { lastWords = w; paintStatus(w); }
    });
    ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            const k = e.key.toLowerCase();
            if (k === 'b') { e.preventDefault(); wrap('**'); }
            else if (k === 'i') { e.preventDefault(); wrap('*'); }
        }
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey) { /* let Tab leave the page */ }
    });

    function wrap(mark) {
        const a = ta.selectionStart, b = ta.selectionEnd;
        const v = ta.value;
        const sel = v.slice(a, b) || 'text';
        ta.setRangeText(mark + sel + mark, a, b, 'end');
        if (a === b) { ta.selectionStart = a + mark.length; ta.selectionEnd = a + mark.length + sel.length; }
        ta.focus();
        ta.dispatchEvent(new Event('input'));
    }
    function insert(text) {
        ta.focus();
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
    }

    // ------------------------------------------------------------------ binder
    function paintBinder() {
        binder.innerHTML = '';
        binder.append(h('div', { class: 'binder-head' }, h('strong', {}, P.title), h('span', { class: 'muted', id: 'book-words' }, `${fmt(bookWords(P))} words`)));
        const list = h('ol', { class: 'chapters' });
        P.chapters.forEach((ch, ci) => {
            const scenes = h('ol', { class: 'scenes' }, ch.scenes.map((id) => {
                const sc = P.scenes[id];
                return h('li', { class: `scene-item${id === sid ? ' on' : ''}`, dataset: { scene: id } },
                    h('button', { class: 'scene-open', onclick: () => openScene(id), 'aria-current': id === sid ? 'true' : null },
                        h('span', { class: `dot st-${sc.status}`, title: sc.status }), h('span', { class: 'scene-name' }, sc.title || 'Untitled scene'), h('span', { class: 'wc', dataset: { wc: id } }, fmt(sc.words))),
                    h('span', { class: 'mini' },
                        h('button', { class: 'icon-btn', title: 'Move up', 'aria-label': 'Move scene up', onclick: () => { A.moveScene(S, id, -1, app.ctx()); app.after(); paintBinder(); } }, '↑'),
                        h('button', { class: 'icon-btn', title: 'Move down', 'aria-label': 'Move scene down', onclick: () => { A.moveScene(S, id, 1, app.ctx()); app.after(); paintBinder(); } }, '↓'),
                        h('button', { class: 'icon-btn', title: 'Delete scene', 'aria-label': 'Delete scene', onclick: async () => {
                            if (sceneList(P).length <= 1) { toast('A book needs at least one scene.'); return; }
                            if (sc.words && !(await confirmBox('Delete this scene?', `“${sc.title || 'Untitled'}” and its ${fmt(sc.words)} words will be gone for good.`, { ok: 'Delete', danger: true }))) return;
                            A.deleteScene(S, id, app.ctx()); app.after();
                            if (id === sid) sid = sceneList(P)[0].sc.id;
                            loadScene(); paintBinder();
                        } }, '×')));
            }));
            list.append(h('li', { class: 'chapter-item', dataset: { chapter: ch.id } },
                h('div', { class: 'chapter-row' },
                    h('button', { class: 'chapter-name', title: 'Rename chapter', onclick: async () => { const t = await promptBox('Rename the chapter', { value: ch.title }); if (t !== null) { A.renameChapter(S, ch.id, t, app.ctx()); app.after(); paintBinder(); } } }, ch.title || `Chapter ${ci + 1}`),
                    h('span', { class: 'wc' }, fmt(chapterWords(P, ch))),
                    h('span', { class: 'mini' },
                        h('button', { class: 'icon-btn', 'aria-label': 'Move chapter up', title: 'Move up', onclick: () => { A.moveChapter(S, ch.id, -1, app.ctx()); app.after(); paintBinder(); } }, '↑'),
                        h('button', { class: 'icon-btn', 'aria-label': 'Move chapter down', title: 'Move down', onclick: () => { A.moveChapter(S, ch.id, 1, app.ctx()); app.after(); paintBinder(); } }, '↓'),
                        h('button', { class: 'icon-btn', 'aria-label': 'Delete chapter', title: 'Delete chapter', onclick: async () => {
                            if (P.chapters.length <= 1) { toast('A book needs at least one chapter.'); return; }
                            const w = chapterWords(P, ch);
                            if (!(await confirmBox('Delete this chapter?', `“${ch.title}”, its ${ch.scenes.length} scene(s) and ${fmt(w)} words will be gone for good.`, { ok: 'Delete', danger: true }))) return;
                            A.deleteChapter(S, ch.id, app.ctx()); app.after();
                            if (!P.scenes[sid]) sid = sceneList(P)[0].sc.id;
                            loadScene(); paintBinder();
                        } }, '×'))),
                scenes,
                h('button', { class: 'btn small ghost add-scene', onclick: () => { flush(); const sc = A.addScene(S, ch.id, '', app.ctx()); app.after(); openScene(sc.id); } }, '+ Scene')));
        });
        binder.append(list, h('button', { class: 'btn small', id: 'add-chapter', onclick: () => { flush(); const { sc } = A.addChapter(S, '', app.ctx()); app.after(); openScene(sc.id); } }, '+ Chapter'));
    }
    function paintBinderCounts() {
        for (const el of binder.querySelectorAll('[data-wc]')) el.textContent = fmt(P.scenes[el.dataset.wc]?.words || 0);
        const bw = binder.querySelector('#book-words');
        if (bw) bw.textContent = `${fmt(bookWords(P))} words`;
        const chs = binder.querySelectorAll('.chapter-row .wc');
        P.chapters.forEach((ch, i) => { if (chs[i]) chs[i].textContent = fmt(chapterWords(P, ch)); });
    }

    // ------------------------------------------------------------------ status bar
    function paintStatus(live) {
        const sc = cur();
        if (!sc) return;
        const w = live ?? sc.words;
        const ch = findChapterOf(P, sid);
        const ctx = app.ctx();
        const today = S.player.today.date === ctx.today ? S.player.today.words : 0;
        status.innerHTML = '';
        status.append(...[
            h('span', {}, h('b', { id: 'scene-wc' }, fmt(w)), ' in scene'),
            h('span', {}, h('b', {}, fmt(chapterWords(P, ch) - sc.words + w)), ' in chapter'),
            h('span', {}, h('b', {}, fmt(bookWords(P) - sc.words + w)), ' in book'),
            h('span', { class: today >= S.player.dailyGoal ? 'met' : '' }, h('b', {}, fmt(today)), ` / ${fmt(S.player.dailyGoal)} today`),
            app.session.words ? h('span', {}, h('b', {}, fmt(app.session.words)), ' this sitting') : null].filter(Boolean));
        if (app.session.vow) {
            const f = Math.min(1, app.session.words / app.session.vow);
            vowRing.hidden = false;
            vowRing.style.setProperty('--p', f);
            vowRing.title = `Session vow: ${fmt(app.session.words)} of ${fmt(app.session.vow)}`;
            vowRing.textContent = f >= 1 ? '✓' : `${Math.round(f * 100)}%`;
            if (f >= 1 && !app.session.kept) { app.session.kept = true; toast(`Vow kept: ${fmt(app.session.vow)} words this sitting.`, { kind: 'gold', icon: '✓' }); app.sound.fanfare(); }
        }
    }

    // ------------------------------------------------------------------ scene
    function openScene(id) {
        queue.flush();
        sid = id;
        loadScene();
        paintBinder();
        document.body.classList.remove('show-binder');
        if (!readMode) ta.focus({ preventScroll: true });
    }
    function loadScene() {
        const sc = cur();
        P.lastScene = sid;
        titleIn.value = sc.title;
        ta.value = sc.text;
        lastWords = sc.words;
        paintStatus();
        paintInspector();
        if (readMode) paintReader();
    }
    titleIn.addEventListener('input', () => { A.editScene(S, sid, { title: titleIn.value }, app.ctx()); app.after(); const n = binder.querySelector(`[data-scene="${sid}"] .scene-name`); if (n) n.textContent = titleIn.value || 'Untitled scene'; });

    // ------------------------------------------------------------------ reading view
    let readMode = false;
    function paintReader() {
        const lantern = hasTalent(S, 'q_dialogue');
        const blocks = parseBlocks(cur().text);
        reader.innerHTML = '';
        reader.append(h('h2', { class: 'reader-title' }, cur().title || 'Untitled scene'));
        let first = true;
        for (const b of blocks) {
            if (b.type === 'break') { reader.append(h('p', { class: 'break' }, '❦')); first = true; continue; }
            if (b.type === 'quote') { reader.append(h('blockquote', { html: b.lines.map((l) => inlineHtml(l)).join('<br>') })); continue; }
            let html = inlineHtml(b.text);
            if (lantern) html = html.replace(/(“[^”]*”)/g, '<span class="speech-glow">$1</span>');
            reader.append(h('p', { class: first ? 'first' : '', html }));
            first = false;
        }
        if (!blocks.length) reader.append(h('p', { class: 'muted' }, 'Nothing on this page yet.'));
        if (lantern) {
            const r = analyze(cur().text);
            reader.append(h('p', { class: 'hint lantern-meter' }, `Dialogue Lantern: ${Math.round(r.dialogue * 100)}% of this scene is speech.`));
        }
    }
    const readBtn = h('button', { class: 'tool', id: 'tool-read', title: 'Reading view', 'aria-pressed': 'false', onclick: () => {
        readMode = !readMode;
        readBtn.setAttribute('aria-pressed', String(readMode));
        queue.flush();
        ta.hidden = readMode; reader.hidden = !readMode;
        if (readMode) paintReader(); else ta.focus();
    } }, 'Read');

    // ------------------------------------------------------------------ inspector
    let tab = 'scene';
    function paintInspector() {
        const sc = cur();
        inspector.innerHTML = '';
        const tabs = [['scene', 'Scene'], ['lens', 'Lens'], ['drafts', 'Drafts'], ['tools', 'Tools']];
        inspector.append(h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, name]) => h('button', { class: `tab${tab === id ? ' on' : ''}`, role: 'tab', 'aria-selected': String(tab === id), dataset: { tab: id }, onclick: () => { tab = id; paintInspector(); } }, name))));
        const body = h('div', { class: 'tab-body' });
        inspector.append(body);
        if (tab === 'scene') {
            const pov = h('select', { id: 'scene-pov', 'aria-label': 'Point of view' }, h('option', { value: '' }, '—'), P.characters.map((c) => h('option', { value: c.id, selected: sc.pov === c.id }, `${c.name} (${c.role})`)));
            const place = h('select', { id: 'scene-place', 'aria-label': 'Where' }, h('option', { value: '' }, '—'), P.world.filter((e) => e.kind === 'place').map((e) => h('option', { value: e.id, selected: sc.place === e.id }, e.name)));
            const st = h('select', { id: 'scene-status', 'aria-label': 'Status' }, STATUS.map(([v, n]) => h('option', { value: v, selected: sc.status === v }, n)));
            const sum = grow(h('textarea', { rows: 3, id: 'scene-summary', placeholder: 'What happens, in a sentence or two. (Goal, conflict, disaster.)', value: sc.summary }));
            const notes = grow(h('textarea', { rows: 4, id: 'scene-notes', placeholder: 'Notes for yourself. They never go in the book.', value: sc.notes }));
            const save = () => { A.editScene(S, sid, { pov: pov.value, place: place.value, status: st.value, summary: sum.value, notes: notes.value }, app.ctx()); app.after(); const d = binder.querySelector(`[data-scene="${sid}"] .dot`); if (d) d.className = `dot st-${st.value}`; };
            for (const el of [pov, place, st, sum, notes]) { el.addEventListener('change', save); el.addEventListener('input', debounce(save, 400)); }
            body.append(
                h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Point of view'), pov),
                h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Where'), place),
                h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Status'), st),
                h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Summary'), sum),
                h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Notes'), notes),
                !P.characters.length ? h('p', { class: 'hint' }, 'Characters from the Hall of Faces appear here as points of view.') : null,
                h('button', { class: 'btn small', onclick: () => askThalion(app, 'scriptorium') }, 'Ask Thalion about writing'));
        } else if (tab === 'lens') {
            if (!hasTalent(S, 'l_one')) {
                body.append(h('p', { class: 'hint' }, 'The Scribe’s Lens is a talent. Learn it on your Sheet, and Thalion will read your scenes with a cold, kind eye.'), h('button', { class: 'btn small', onclick: () => app.go('sheet') }, 'Open your Sheet'));
            } else {
                body.append(h('button', { class: 'btn small primary', id: 'lens-read', onclick: () => {
                    queue.flush();
                    A.noteLens(S, app.ctx()); app.after();
                    const r = analyze(ta.value);
                    const tier = hasTalent(S, 'l_three') ? 3 : hasTalent(S, 'l_two') ? 2 : 1;
                    const out = h('div', { class: 'lens-out', id: 'lens-out' });
                    const nums = [['Words', r.words], ['Sentences', r.sentences], ['Avg sentence', r.avgSentence], ['Adverbs /1k', r.adverbs.per1k], ['Filter words', r.filters.count], ['Said-bookisms', r.bookisms.count]];
                    if (tier >= 2) nums.push(['Passive', r.passive], ['Echoes', r.echoes.count], ['Clichés', r.cliches.length]);
                    if (tier >= 3) nums.push(['Rhythm (±)', r.rhythm], ['Dialogue', `${Math.round(r.dialogue * 100)}%`], ['Reading ease', r.readingEase]);
                    out.append(h('dl', { class: 'lens-nums' }, nums.map(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])));
                    if (tier >= 3 && r.lengths.length > 2) {
                        const max = Math.max(...r.lengths);
                        out.append(h('div', { class: 'rhythm', title: 'Sentence lengths, in order', 'aria-label': 'Sentence rhythm chart' }, r.lengths.slice(0, 80).map((n) => h('i', { style: { height: `${(n / max) * 100}%` } }))));
                    }
                    for (const [t, mood, line] of verdicts(r)) if (t <= tier) out.append(h('div', { class: 'verdict' }, h('span', { class: 'mini-face', html: thalionSvg(mood) }), h('p', { html: rich(line) })));
                    if (tier < 3) out.append(h('p', { class: 'hint' }, `The ${tier === 1 ? 'Lens of Echoes' : 'Lens of Rhythm'} talent shows more.`));
                    body.querySelector('#lens-out')?.remove();
                    body.append(out);
                } }, 'Have Thalion read this scene'));
            }
        } else if (tab === 'drafts') {
            if (!hasTalent(S, 'q_snap')) {
                body.append(h('p', { class: 'hint' }, 'The Chronicle of Drafts is a talent: keep snapshots of a scene, compare them and restore any one. Learn it on your Sheet.'));
            } else {
                body.append(h('button', { class: 'btn small primary', id: 'snap-take', onclick: async () => {
                    queue.flush();
                    const label = await promptBox('Name this snapshot', { value: `Draft ${sc.snaps.length + 1}`, ok: 'Keep it' });
                    if (label === null) return;
                    A.snapshot(S, sid, label, app.ctx()); app.after(); paintInspector();
                } }, 'Keep a snapshot'));
                if (!sc.snaps.length) body.append(h('p', { class: 'hint' }, 'No snapshots of this scene yet.'));
                sc.snaps.forEach((s, i) => body.append(h('div', { class: 'snap' },
                    h('div', {}, h('strong', {}, s.label), h('span', { class: 'muted' }, ` · ${fmt(s.words)} words · ${new Date(s.t).toLocaleString()}`)),
                    h('div', { class: 'row-wrap' },
                        h('button', { class: 'btn small', onclick: () => showDiff(s) }, 'Compare'),
                        h('button', { class: 'btn small', onclick: async () => { if (await confirmBox('Restore this snapshot?', 'What is on the page now will be kept as a snapshot first, so nothing is lost.', { ok: 'Restore' })) { queue.flush(); A.restoreSnapshot(S, sid, i, app.ctx()); app.after(); loadScene(); } } }, 'Restore'),
                        h('button', { class: 'btn small ghost', 'aria-label': 'Delete snapshot', onclick: () => { A.deleteSnapshot(S, sid, i, app.ctx()); app.after(); paintInspector(); } }, '×')))));
            }
        } else if (tab === 'tools') {
            // session vow
            if (hasTalent(S, 'q_goal')) {
                const n = h('input', { type: 'number', min: 50, max: 10000, step: 50, value: app.session.vow || 500, id: 'vow-n', 'aria-label': 'Words this sitting' });
                body.append(h('h3', {}, 'Session vow'), h('div', { class: 'row-wrap' }, n, h('button', { class: 'btn small', id: 'vow-set', onclick: () => { app.session.vow = Math.max(50, +n.value || 500); app.session.words = 0; app.session.kept = false; paintStatus(); toast(`Sworn: ${fmt(app.session.vow)} words this sitting.`); } }, 'Swear it')));
            } else body.append(h('p', { class: 'hint' }, 'Session Vow (a talent): swear a word count for this sitting.'));
            // focus
            body.append(h('h3', {}, 'Focus'), hasTalent(S, 'q_focus') ? h('button', { class: 'btn small', id: 'focus-on', onclick: () => enterFocus() }, 'Enter the Focus Trance (Esc to leave)') : h('p', { class: 'hint' }, 'Focus Trance (a talent): a quiet, full-window page.'));
            // find and replace
            body.append(h('h3', {}, 'Find and replace'));
            if (hasTalent(S, 'q_find')) {
                const f = h('input', { type: 'text', placeholder: 'Find', id: 'find-in', 'aria-label': 'Find' });
                const r = h('input', { type: 'text', placeholder: 'Replace with', id: 'repl-in', 'aria-label': 'Replace with' });
                const mc = h('input', { type: 'checkbox', id: 'find-case' });
                const ww = h('input', { type: 'checkbox', id: 'find-word', checked: true });
                const res = h('p', { class: 'hint' });
                body.append(f, r, h('label', { class: 'check' }, mc, ' Match case'), h('label', { class: 'check' }, ww, ' Whole words'),
                    h('div', { class: 'row-wrap' },
                        h('button', { class: 'btn small', onclick: () => {
                            if (!f.value) return;
                            const esc = f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const re = new RegExp(ww.checked ? `\\b${esc}\\b` : esc, mc.checked ? 'g' : 'gi');
                            const hits = sceneList(P).map(({ sc: s }) => [s, (s.text.match(re) || []).length]).filter(([, n]) => n);
                            res.textContent = hits.length ? `${hits.reduce((a, [, n]) => a + n, 0)} found in ${hits.length} scene(s): ${hits.slice(0, 6).map(([s]) => s.title).join(', ')}` : 'Not found.';
                        } }, 'Count'),
                        h('button', { class: 'btn small', id: 'repl-go', onclick: async () => {
                            if (!f.value) return;
                            queue.flush();
                            if (!(await confirmBox('Replace everywhere?', `Replace “${f.value}” with “${r.value}” in every scene of the book?`, { ok: 'Replace all' }))) return;
                            const n = A.replaceAll(S, f.value, r.value, { matchCase: mc.checked, wholeWord: ww.checked }, app.ctx());
                            app.after(); loadScene(); paintBinderCounts();
                            res.textContent = `${n} replaced.`;
                        } }, 'Replace all')), res);
            } else body.append(h('p', { class: 'hint' }, 'Seeker’s Glass (a talent): find and replace across the whole manuscript.'));
            body.append(h('h3', {}, 'Book'), h('p', { class: 'hint' }, 'Ctrl+S saves now (it also saves by itself as you write). Ctrl+B bold, Ctrl+I italic.'));
        }
    }

    function showDiff(snap) {
        import('./dom.js').then(({ modal }) => modal((card, close) => {
            const a = snap.text.split(/\n/), b = ta.value.split(/\n/);
            const sa = new Set(a), sb = new Set(b);
            card.append(h('h2', {}, `“${snap.label}” and the page now`), h('p', { class: 'hint' }, 'Paragraphs only in the snapshot are struck through; paragraphs only on the page now are underlined.'),
                h('div', { class: 'diff' }, [...a.filter((p) => !sb.has(p) && p.trim()).map((p) => h('p', { class: 'del' }, p)), ...b.filter((p) => !sa.has(p) && p.trim()).map((p) => h('p', { class: 'ins' }, p))]),
                h('div', { class: 'row-end' }, h('button', { class: 'btn primary', onclick: close }, 'Close')));
        }, { wide: true, label: 'Compare drafts' }));
    }

    // ------------------------------------------------------------------ focus trance
    function enterFocus() {
        document.body.classList.add('focus-mode');
        ta.focus();
        toast('The Focus Trance. Esc to leave.', { ms: 2200 });
    }
    app.exitFocus = () => document.body.classList.remove('focus-mode');

    // ------------------------------------------------------------------ toolbar and layout
    const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Writing tools' },
        h('button', { class: 'tool only-narrow', id: 'tool-binder', 'aria-label': 'Chapters', onclick: () => { document.body.classList.toggle('show-binder'); document.body.classList.remove('show-inspector'); } }, '☰'),
        h('button', { class: 'tool', title: 'Bold (Ctrl+B)', 'aria-label': 'Bold', onclick: () => wrap('**') }, h('b', {}, 'B')),
        h('button', { class: 'tool', title: 'Italic (Ctrl+I)', 'aria-label': 'Italic', onclick: () => wrap('*') }, h('i', {}, 'I')),
        h('button', { class: 'tool', title: 'Scene break', 'aria-label': 'Scene break', onclick: () => insert('\n* * *\n') }, '❦'),
        h('button', { class: 'tool', title: 'Em dash', 'aria-label': 'Em dash', onclick: () => insert('—') }, '—'),
        h('button', { class: 'tool', title: 'Quotation (a letter, a song)', 'aria-label': 'Quotation', onclick: () => insert('\n> ') }, '❝'),
        readBtn,
        hasTalent(S, 'q_focus') ? h('button', { class: 'tool', id: 'tool-focus', title: 'Focus Trance', onclick: () => document.body.classList.contains('focus-mode') ? app.exitFocus() : enterFocus() }, 'Focus') : null,
        vowRing,
        h('span', { class: 'grow' }),
        h('button', { class: 'tool only-narrow', id: 'tool-inspector', 'aria-label': 'Scene details', onclick: () => { document.body.classList.toggle('show-inspector'); document.body.classList.remove('show-binder'); } }, 'ⓘ'));

    const page = h('section', { class: 'desk' }, toolbar, h('div', { class: 'paper' }, titleIn, ta, reader), status);
    root.append(h('div', { class: 'scriptorium' }, binder, page, inspector, h('div', { class: 'drawer-scrim', onclick: () => document.body.classList.remove('show-binder', 'show-inspector') })));
    paintBinder();
    loadScene();
    if (!('ontouchstart' in window)) setTimeout(() => ta.focus({ preventScroll: true }), 30);

    return () => { queue.flush(); app.flushWriting = null; document.body.classList.remove('show-binder', 'show-inspector', 'focus-mode'); };
}
