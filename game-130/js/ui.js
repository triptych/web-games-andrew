// Starbase Spooky — the DOM layer: screens, the HUD, the dialogue box, the quiz, the puzzle bar, the Notebook, the
// night card and the certificate. Reads the sim; never changes it (it calls back into main.js for that).

import { VERSION } from './config.js';
import { CAST } from './sim/data/cast.js';
import { LINES, shown, CLUES, CLUE_ORDER, ITEMS, DEDUCE, DAYS, DAYS_TOTAL } from './sim/data/story.js';
import { QUESTION } from './sim/data/questions.js';
import { jobs, front } from './sim/game.js';
import { iconStyle } from './view/assets.js';

const $ = (id) => document.getElementById(id);

const PZ_TEXT = {
    wires: 'Tap a wire on the left, then the plug with the same colour on the right.',
    battery: 'Tap batteries so their numbers add up to the POWER number. Tap again to take one out.',
    planets: 'Tap the planets in order, starting with the one closest to the Sun.',
    sequence: 'Watch the fuse lights, then tap them in the same order.',
    song: 'Watch the stars light up with Wisp\'s song, then tap them in the same order.',
};

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onAnswer, onNext, onSolve }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.shownKey = null;          // what the dialogue/quiz box is showing
        this.lineAt = 0;
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen (the finger that opened it) must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const vo = $('set-voice'), sfx = $('set-sfx'), music = $('set-music'), auto = $('set-auto');
        vo.value = settings.voice; sfx.value = settings.sfx; music.value = settings.music; auto.value = settings.auto;
        const changed = () => {
            Object.assign(settings, { voice: +vo.value, sfx: +sfx.value, music: +music.value, auto: auto.value });
            onSettings(settings);
        };
        for (const el of [vo, sfx, music, auto]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // the dialogue box: a tap anywhere on it is "next" (on finger-down, so it never feels late)
        $('talk').addEventListener('pointerdown', (e) => {
            if (e.target.closest('#talk-again')) return;
            e.preventDefault();
            onNext();
        });
        // the keyboard's own click on the focused ▶ (a pointer already advanced on pointerdown above)
        $('talk-next').addEventListener('click', (e) => { if (e.detail === 0) onNext(); });
        $('talk-again').addEventListener('click', () => this.replay());
        $('quiz-again').addEventListener('click', () => this.replay());
        $('pz-again').addEventListener('click', () => this.replay());
        // an answer can't be picked in the first 0.4 s: a quick double tap on ▶ must not land on the button that
        // just appeared under the finger
        for (const b of document.querySelectorAll('#quiz-answers .ans')) b.addEventListener('click', () => { if (performance.now() - this.quizAt > 400) onAnswer(+b.dataset.i); });
        $('nb-solve').addEventListener('click', () => { this.closeScreen('notebook'); onSolve(); });
        for (const t of document.querySelectorAll('#notebook .tab')) t.addEventListener('click', () => this.tab(t.dataset.tab));
        $('btn-jobs').addEventListener('click', () => { $('jobs').hidden = !$('jobs').hidden; audio.ui('click'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another appears on top of it
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; if (!on) $('jobs').hidden = true; }
    hud(G, nudge) {
        $('hud-day').textContent = `Day ${G.day}`;
        const n = String(G.stickers);
        if ($('hud-sticker-n').textContent !== n) {
            $('hud-sticker-n').textContent = n;
            $('hud-stickers').classList.remove('pop'); void $('hud-stickers').offsetWidth; $('hud-stickers').classList.add('pop');
        }
        $('btn-hint').classList.toggle('nudge', !!nudge);
        const list = jobs(G);
        const html = list.map((j) => `<li class="${j.done ? 'done' : j.ready ? '' : 'wait'}"><span class="box">${j.done ? '✅' : j.ready ? '⬜' : '⏳'}</span><span>${esc(j.label)}</span></li>`).join('')
            + (G.day < DAYS_TOTAL ? `<li class="${list.every((j) => j.done) ? '' : 'wait'}"><span class="box">🛏️</span><span>Go to bed in Crew Quarters</span></li>` : '');
        if ($('jobs-list').innerHTML !== html) $('jobs-list').innerHTML = html;
    }

    // ------------------------------------------------------------------ dialogue, quiz, puzzle bar
    /** Show whatever the story is waiting on. Called every frame; only touches the DOM when it changes. */
    sync(G) {
        const f = front(G);
        const key = f ? JSON.stringify(f) + '|' + G.queue.length + '|' + G.wrong.join() : null;
        if (key === this.shownKey) return;
        this.shownKey = key;
        $('talk').hidden = !(f && f.say);
        $('quiz').hidden = !(f && (f.ask || f.ded !== undefined));
        $('pz-bar').hidden = !(f && f.puzzle);
        if (f?.say) this.showLine(f.say);
        else if (f?.ask) this.showQuiz(QUESTION[f.ask].who, QUESTION[f.ask], G.wrong, `${QUESTION[f.ask].who}.${f.ask}`);
        else if (f?.ded !== undefined) this.showQuiz('orby', DEDUCE[f.ded], G.wrong, DEDUCE[f.ded].say);
        else if (f?.puzzle) { $('pz-text').textContent = PZ_TEXT[f.puzzle]; this.lastLine = null; }
        if (f?.night) this.showNight(G); else if (!$('night').hidden) this.closeScreen('night');
        if (f?.end) this.showEnd(G);
    }

    showLine(id) {
        const l = LINES[id];
        const c = CAST[l.who];
        $('talk-name').textContent = c.name;
        $('talk-text').textContent = shown(l.text);
        const img = $('talk-img');
        img.src = `art/spr/${l.who}.webp`;
        img.className = ['orby', 'wisp', 'mama', 'ghost'].includes(l.who) ? 'whole' : '';
        this.lastLine = id;
        this.lineAt = performance.now();
        $('talk-next').focus({ preventScroll: true });
    }

    showQuiz(who, q, wrong, line) {
        $('quiz-img').src = `art/spr/${who}.webp`;
        $('quiz-q').textContent = q.q;
        this.lastLine = line;
        this.quizAt = performance.now();
        document.querySelectorAll('#quiz-answers .ans').forEach((b, i) => {
            b.querySelector('.txt').textContent = q.a[i];
            b.disabled = wrong.includes(i);
        });
        const first = [...document.querySelectorAll('#quiz-answers .ans')].find((b) => !b.disabled);
        first?.focus({ preventScroll: true });
    }

    replay() { if (this.lastLine) this.audio.say(this.lastLine); }
    get talking() { return !$('talk').hidden; }
    get quizzing() { return !$('quiz').hidden; }

    // ------------------------------------------------------------------ notebook
    renderNotebook(G) {
        const card = (sheet, icon, title, text, have) => `<div class="card${have ? '' : ' missing'}"><div class="ic" style="${iconStyle(sheet, icon)}"></div><div><b>${esc(title)}</b><br>${esc(text)}</div></div>`;
        $('nb-clues').innerHTML = CLUE_ORDER.map((id) => {
            const c = CLUES[id];
            return G.clues.includes(id) ? card('items', c.icon, c.name, c.text, true) : card('items', c.icon, '???', 'A clue still to find.', false);
        }).join('') + `<p class="empty">${G.clues.length} of ${CLUE_ORDER.length} clues found.</p>`;
        $('nb-facts').innerHTML = G.facts.length
            ? G.facts.map((qid) => card('items', 13, QUESTION[qid].q, QUESTION[qid].fact, true)).join('')
            : '<p class="empty">Answer the visitors\' questions, and every space fact you learn goes in here.</p>';
        $('nb-items').innerHTML = G.items.length
            ? G.items.map((id) => card('items', ITEMS[id].icon, ITEMS[id].name, ITEMS[id].text, true)).join('')
            : '<p class="empty">Nothing yet. Visitors sometimes lend you things!</p>';
        $('nb-solve').hidden = !(G.day === DAYS_TOTAL && !G.done.solve);
    }
    tab(name) {
        for (const t of document.querySelectorAll('#notebook .tab')) t.classList.toggle('on', t.dataset.tab === name);
        for (const p of ['clues', 'facts', 'items']) $('nb-' + p).hidden = p !== name;
    }

    // ------------------------------------------------------------------ night, end
    showNight(G) {
        const n = jobs(G).length;
        $('night-head').textContent = `Day ${G.day} done!`;
        $('night-stats').innerHTML = `✅ ${n} jobs done<br>★ ${G.stickers} star stickers<br>🔍 ${G.clues.length} of 6 clues<br>📘 ${G.facts.length} space facts`;
        $('night-text').textContent = DAYS[G.day - 1].night || '';
        this.openScreen('night');
    }
    showEnd(G) {
        $('end-text').textContent = 'for running Starbase Nine, fixing everything that broke, and helping Wisp the Glimmerling find her way home.';
        $('end-stats').innerHTML = `★ ${G.stickers} star stickers<br>📘 ${G.facts.length} space facts learned (${G.firstTry} right first time)<br>🔍 6 of 6 clues · mystery solved!`;
        if ($('end').hidden) this.openScreen('end');
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();   // never a pile of them
        setTimeout(() => el.remove(), 2700);
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'clue') this.toast(`🔍 New clue: ${CLUES[e.id].name}`);
            else if (e.type === 'item') this.toast(`🎒 You got: ${ITEMS[e.id].name}`);
            else if (e.type === 'fixed') this.toast('🔧 Fixed!');
            else if (e.type === 'fact') this.toast('📘 New fact in your Space Book');
            else if (e.type === 'job' && e.id !== 'home') this.toast('✅ Job done!');
            if (e.type === 'clue' || e.type === 'job') window.A11Y?.announce?.(e.type === 'clue' ? `New clue: ${CLUES[e.id].name}` : 'Job done');
        }
    }
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
