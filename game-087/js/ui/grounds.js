// The Proving Grounds: ink duels. Pick a foe and where the words should go, then write against the clock;
// every word strikes. The words go into the chosen scene as you write, so nothing is ever lost.

import { h, rich, fmt, toast, confirmBox, debounce } from './dom.js';
import { foeSvg } from '../view/art.js';
import { FOES, FOE_BY_ID, RELIC_BY_ID } from '../sim/data/guild.js';
import { MAIN_BY_ID } from '../sim/quests.js';
import { foeOpen, newDuel, duelWrite, duelTick, duelYield, timeLeft } from '../sim/duel.js';
import { sceneList, findChapterOf } from '../sim/state.js';
import { countWords } from '../sim/text.js';
import * as A from '../sim/actions.js';
import { askThalion } from './hall.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function groundsView(app, root) {
    const S = app.S;
    let timer = 0;
    let D = null;

    function list() {
        root.innerHTML = '';
        root.append(h('div', { class: 'room-head' }, h('h1', {}, 'The Proving Grounds'), h('button', { class: 'btn small ghost', onclick: () => askThalion(app, 'grounds') }, 'Ask Thalion')),
            h('p', { class: 'muted', html: rich('Thalion: “Every foe here is a sprint. Write as fast as the words come and *do not go back*. Pause too long and they recover. Whatever happens, the words are yours.”') }),
            h('div', { class: 'foes' }, FOES.map((f) => {
                const open = foeOpen(S, f.id);
                const rec = S.player.bestiary[f.id];
                return h('button', { class: `foe-card${open ? '' : ' locked'}${rec?.wins ? ' beaten' : ''}`, dataset: { foe: f.id }, disabled: !open, onclick: () => setup(f.id) },
                    h('span', { class: 'foe-art', html: foeSvg(f.id, f.name) }),
                    h('span', { class: 'foe-text' }, h('strong', {}, open ? f.name : '???'),
                        h('span', { class: 'muted' }, open ? (f.training ? 'Your words, your minutes' : `${fmt(f.hp)} words in ${f.time} minutes`) : `Appears after “${MAIN_BY_ID[f.after].title}”`),
                        rec ? h('span', { class: 'rec' }, `${rec.wins} won · ${rec.losses} lost${rec.best ? ` · best ${mmss(rec.best)}` : ''}`) : null));
            })));
    }

    function setup(id) {
        const f = FOE_BY_ID[id];
        const P = app.P();
        const scenes = sceneList(P);
        const target = h('select', { id: 'duel-target', 'aria-label': 'Where the words go' },
            h('option', { value: '__new' }, 'A new scene at the end of the book'),
            scenes.map(({ ch, sc }) => h('option', { value: sc.id, selected: sc.id === P.lastScene }, `${ch.title} › ${sc.title || 'Untitled'} (${fmt(sc.words)} words)`)));
        const words = h('input', { type: 'number', min: 10, max: 5000, step: 10, value: 300, id: 'duel-words', 'aria-label': 'Words' });
        const mins = h('input', { type: 'number', min: 1, max: 120, value: 10, id: 'duel-mins', 'aria-label': 'Minutes' });
        root.innerHTML = '';
        root.append(h('div', { class: 'room-head' }, h('button', { class: 'btn small ghost', onclick: list }, '← All foes')),
            h('section', { class: 'card duel-setup' },
                h('div', { class: 'foe-big', html: foeSvg(f.id, f.name) }),
                h('div', {}, h('h2', {}, f.name), h('p', { class: 'muted' }, f.blurb),
                    f.training ? h('div', { class: 'row-wrap' }, h('label', { class: 'field inline' }, h('span', { class: 'lbl' }, 'Words'), words), h('label', { class: 'field inline' }, h('span', { class: 'lbl' }, 'Minutes'), mins))
                        : h('p', {}, h('strong', {}, `${fmt(f.hp)} words`), ` in ${f.time} minutes. Recovers ${f.regen}/s after ${15} s of silence.`),
                    f.drop && !S.player.bestiary[f.id]?.wins ? h('p', { class: 'hint' }, `First victory: the ${RELIC_BY_ID[f.drop].name}.`) : null,
                    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'The words go into'), target),
                    h('button', { class: 'btn primary big', id: 'duel-begin', onclick: () => begin(f.id, target.value, { words: +words.value, minutes: +mins.value }) }, 'Begin the duel'))));
    }

    function begin(id, targetId, opts) {
        const f = FOE_BY_ID[id];
        const P = app.P();
        let sid = targetId;
        if (sid === '__new') {
            const last = P.chapters[P.chapters.length - 1];
            sid = A.addScene(S, last.id, `After the ${f.name.replace(/^The /, '')}`, app.ctx()).id;
            app.after();
        }
        const sc = P.scenes[sid];
        const base = sc.text.replace(/\s+$/, '');
        D = newDuel(S, id, app.ctx().now, opts);
        app.duel = D;
        const pad = h('textarea', { class: 'duel-pad', id: 'duel-pad', spellcheck: 'true', 'aria-label': 'Write here', placeholder: 'Write. Don’t look back.' });
        const hp = h('div', { class: 'hp' }, h('i', {}));
        const hpText = h('span', { class: 'hp-text' });
        const clock = h('span', { class: 'clock', id: 'duel-clock' });
        const taunt = h('p', { class: 'taunt', 'aria-live': 'polite' });
        const art = h('div', { class: 'foe-big fighting', html: foeSvg(f.id, f.name) });
        const yieldBtn = h('button', { class: 'btn ghost small', id: 'duel-yield', onclick: async () => { if (await confirmBox('Yield?', 'The foe escapes, but every word you wrote stays in the book.', { ok: 'Yield' })) { duelYield(S, D); end(); } } }, 'Yield');
        const save = debounce(() => {
            A.writeScene(S, sid, base + (base && pad.value ? '\n' : '') + pad.value, app.ctx());
            app.after();
        }, 500);
        app.flushWriting = () => save.flush();
        const paint = () => {
            const now = app.ctx().now;
            hp.firstChild.style.width = `${(D.hp / D.max) * 100}%`;
            hpText.textContent = `${fmt(Math.ceil(D.hp))} / ${fmt(D.max)}`;
            const left = timeLeft(D, now);
            clock.textContent = mmss(left);
            clock.classList.toggle('low', left < 60);
        };
        const onEvents = (ev) => {
            for (const e of ev) {
                if (e.type === 'duel-hit') { art.classList.remove('hit'); void art.offsetWidth; art.classList.add('hit'); if (Math.random() < 0.35) app.sound.hit(); }
                if (e.type === 'taunt') { taunt.textContent = `“${e.text}”`; taunt.classList.remove('show'); void taunt.offsetWidth; taunt.classList.add('show'); app.sound.heal(); }
            }
        };
        pad.addEventListener('input', () => {
            const n = countWords(pad.value);
            duelWrite(S, D, n, app.ctx().now);
            onEvents(S.events.filter((e) => e.type === 'duel-hit' || e.type === 'taunt'));
            S.events = S.events.filter((e) => e.type !== 'duel-hit' && e.type !== 'taunt');
            app.sound.scratch();
            save();
            paint();
            if (D.state !== 'on') end();
        });
        timer = setInterval(() => {
            if (!D || D.state !== 'on') return;
            duelTick(S, D, app.ctx().now);
            onEvents(S.events.filter((e) => e.type === 'duel-hit' || e.type === 'taunt'));
            S.events = S.events.filter((e) => e.type !== 'duel-hit' && e.type !== 'taunt');
            paint();
            if (D.state !== 'on') end();
        }, 250);

        function end() {
            clearInterval(timer);
            timer = 0;
            save.flush();
            app.flushWriting = null;
            const won = D.state === 'won';
            const ev = app.after();
            const n = countWords(pad.value);
            won ? app.sound.win() : app.sound.lose();
            app.duel = null;
            const drop = ev.find((e) => e.type === 'relic');
            const scn = P.scenes[sid];
            root.innerHTML = '';
            root.append(h('section', { class: `card duel-result ${won ? 'won' : 'lost'}`, id: 'duel-result' },
                h('div', { class: `foe-big ${won ? 'defeated' : ''}`, html: foeSvg(f.id, f.name) }),
                h('div', {}, h('h2', {}, won ? 'Victory!' : `${f.name} escapes`),
                    h('p', { html: rich(won ? f.defeat : 'It slips away into the dark, laughing. It will be back. So will you.') }),
                    h('p', {}, h('strong', {}, `${fmt(n)} words`), ` went into “${scn?.title || 'the scene'}” in ${findChapterOf(P, sid)?.title || 'the book'}.`),
                    drop ? h('p', { class: 'hint ok' }, `It left something behind: the ${RELIC_BY_ID[drop.id].name}.`) : null,
                    h('div', { class: 'row-wrap' }, h('button', { class: 'btn primary', id: 'duel-again', onclick: list }, 'Back to the Grounds'), h('button', { class: 'btn', onclick: () => { P.lastScene = sid; app.go('scriptorium'); } }, 'Open the scene')))));
        }

        root.innerHTML = '';
        root.append(h('section', { class: 'duel', id: 'duel' },
            h('div', { class: 'duel-top' }, art, h('div', { class: 'duel-stats' }, h('h2', {}, f.name), hp, hpText, h('div', { class: 'row-wrap' }, clock, yieldBtn), taunt)),
            pad,
            h('p', { class: 'hint' }, `Every word strikes. The words go into “${sc.title || 'the scene'}”.`)));
        paint();
        pad.focus();
        app.sound.fanfare();
    }

    list();
    return () => {
        if (timer) clearInterval(timer);
        app.flushWriting?.();
        app.flushWriting = null;
        if (D && D.state === 'on') { duelYield(S, D); app.after(); toast(`You left the duel; ${FOE_BY_ID[D.foe].name} escapes. Your words are kept.`); }
        app.duel = null;
    };
}
