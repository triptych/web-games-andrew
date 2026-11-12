// Starbase Spooky — the DOM layer: screens, the HUD, the dialogue box, the quiz, the puzzle bar, the Notebook, the
// night card and the certificate. Reads the sim; never changes it (it calls back into main.js for that).

import { VERSION } from './config.js';
import { CAST } from './sim/data/cast.js';
import { LINES, shown, CLUES, CLUE_ORDER, ITEMS, DEDUCE, DAYS, DAYS_TOTAL } from './sim/data/story.js';
import { QUESTION } from './sim/data/questions.js';
import { jobs, front, objective } from './sim/game.js';
import { ROOMS, neighbor, wayTo } from './sim/data/rooms.js';
import { iconStyle } from './view/assets.js';

const $ = (id) => document.getElementById(id);

// what plays when you tap 🔊 on a thing in the backpack (clues replay Orby's line from when you found them)
const BAG_LINES = { meter: 'quasar.bye', cookie: 'orby.cookie', star: 'mama.gift' };

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
        // the toolbar: today's jobs (shown in the strip under the toolbar unless you put them away) and the backpack
        this.jobsWanted = null;           // null: on where there's room for them, off on a short landscape phone
        this.bagOpen = null;              // { kind, id } on show, or 'list' for the folded backpack's grid
        this.bagKey = null;
        this.G = null;
        $('btn-jobs').addEventListener('click', () => { this.toggleJobs(); audio.ui('click'); });
        $('btn-bag').addEventListener('click', () => { this.toggleBag(this.G); audio.ui('click'); });
        $('bag-pop-close').addEventListener('click', () => { this.closeBag(); audio.ui('close'); });
        $('bag-pop-say').addEventListener('click', () => { if (this.bagLine) audio.say(this.bagLine); });
        const onSlot = (e) => {
            const b = e.target.closest('.slot');
            if (!b) return;
            audio.ui('click');
            this.openBag(b.dataset.kind, b.dataset.id);
        };
        $('bag').addEventListener('click', onSlot);
        $('bag-pop-items').addEventListener('click', onSlot);
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
    showHud(on) {
        $('bar').hidden = !on;
        if (!on) { $('jobs').hidden = true; this.closeBag(); }
    }
    /** The toolbar and the job list. Called every frame; only touches the DOM when something changed. */
    hud(G, nudge, map) {
        this.G = G;
        $('hud-day').textContent = `Day ${G.day}`;
        const n = String(G.stickers);
        if ($('hud-sticker-n').textContent !== n) {
            $('hud-sticker-n').textContent = n;
            $('hud-stickers').classList.remove('pop'); void $('hud-stickers').offsetWidth; $('hud-stickers').classList.add('pop');
        }
        $('btn-hint').classList.toggle('nudge', !!nudge);
        const busy = !!front(G);

        // rooms to the left and right; the button toward the next job glows
        const o = objective(G);
        const goal = o && !(o.id === 'find' && G.room === 'vents') ? o.room : null;
        const way = wayTo(G.room, goal);
        for (const [btn, name, dir] of [['nav-prev', 'nav-prev-name', -1], ['nav-next', 'nav-next-name', 1]]) {
            const to = neighbor(G.room, dir);
            const label = to ? ROOMS[to].name : '';
            if ($(name).textContent !== label) $(name).textContent = label;
            $(btn).disabled = !to || busy || map;
            $(btn).classList.toggle('way', !!to && way === dir && !busy);
            $(btn).setAttribute('aria-label', to ? `Go ${dir < 0 ? 'left' : 'right'} to the ${label}` : 'No way out this side');
        }
        $('nav-here').querySelector('b').textContent = ROOMS[G.room].name;
        $('btn-map').disabled = busy;
        $('btn-hint').disabled = busy;

        // the backpack: things first, then the six clues (a "?" until found)
        const key = G.items.join() + '|' + G.clues.join();
        if (key !== this.bagKey) {
            const fresh = this.bagKey !== null;
            const had = new Set((this.bagKey || '').split(/[|,]/));
            this.bagKey = key;
            const slots = this.bagSlots(G).map((x) => {
                const isNew = fresh && x.have && !had.has(x.id);
                return x.have
                    ? `<button class="slot ${x.kind === 'item' ? 'item' : ''}${isNew ? ' new' : ''}" data-kind="${x.kind}" data-id="${x.id}" title="${esc(x.name)}" aria-label="${esc(x.name)}"><span class="ic" style="${iconStyle('items', x.icon, 38)}"></span></button>`
                    : `<button class="slot empty" data-kind="clue" data-id="${x.id}" title="A clue still to find" aria-label="A clue still to find">?</button>`;
            }).join('');
            $('bag').innerHTML = slots;
            $('bag-pop-items').innerHTML = slots;
            $('bag-n').textContent = String(G.items.length + G.clues.length);
            if (this.bagOpen && this.bagOpen !== 'list') this.openBag(this.bagOpen.kind, this.bagOpen.id);
        }

        // today's jobs: where there's room, they fill the strip under the toolbar whenever nobody is talking
        const below = document.body.classList.contains('below');
        const want = this.jobsWanted ?? below;
        $('jobs').hidden = !(want && !busy && !map && !this.bagOpen);
        $('btn-jobs').classList.toggle('on', want);
        $('btn-bag').classList.toggle('on', !!this.bagOpen);
        const list = jobs(G);
        const next = o ? o.id : null;
        const html = list.map((j) => `<li class="${j.done ? 'done' : !j.ready ? 'wait' : j.id === next ? 'next' : ''}"><span class="box">${j.done ? '✅' : j.ready ? (j.id === next ? '👉' : '⬜') : '⏳'}</span><span>${esc(j.label)}</span></li>`).join('')
            + (G.day < DAYS_TOTAL ? `<li class="${list.every((j) => j.done) ? 'next' : 'wait'}"><span class="box">🛏️</span><span>Go to bed in Crew Quarters</span></li>` : '');
        if ($('jobs-list').innerHTML !== html) $('jobs-list').innerHTML = html;
    }

    toggleJobs() {
        const below = document.body.classList.contains('below');
        this.jobsWanted = !(this.jobsWanted ?? below);
    }

    // ------------------------------------------------------------------ the backpack
    bagSlots(G) {
        return [
            ...G.items.map((id) => ({ kind: 'item', id, have: true, name: ITEMS[id].name, icon: ITEMS[id].icon })),
            ...CLUE_ORDER.map((id) => ({ kind: 'clue', id, have: G.clues.includes(id), name: CLUES[id].name, icon: CLUES[id].icon })),
        ];
    }
    /** Show one thing from the backpack (its picture, what it is, and its voice line on 🔊). */
    openBag(kind, id) {
        const G = this.G;
        if (!G) return;
        const have = kind === 'item' ? G.items.includes(id) : G.clues.includes(id);
        const d = kind === 'item' ? ITEMS[id] : CLUES[id];
        $('bag-pop-ic').setAttribute('style', have ? iconStyle('items', d.icon, 64) : '');
        $('bag-pop-name').textContent = have ? d.name : 'A clue still to find';
        $('bag-pop-text').textContent = have ? d.text : `Look around the station. ${G.clues.length} of 6 clues found so far.`;
        this.bagLine = have ? (kind === 'clue' ? `orby.clue.${id}` : BAG_LINES[id]) : null;
        $('bag-pop-say').hidden = !this.bagLine;
        $('bag-pop-detail').hidden = false;
        for (const el of document.querySelectorAll('.slot')) el.classList.toggle('on', el.dataset.id === id);
        this.bagOpen = { kind, id };
        $('bag-pop').hidden = false;
    }
    /** The 🎒 button: on a short phone it opens the grid of everything carried; elsewhere it shows the first thing. */
    toggleBag(G) {
        if (this.bagOpen) { this.closeBag(); return; }
        if (!G || front(G)) return;
        this.G = G;
        const first = this.bagSlots(G).find((x) => x.have) || this.bagSlots(G)[0];
        this.openBag(first.kind, first.id);
        if (!document.body.classList.contains('below')) this.bagOpen = { ...this.bagOpen, list: true };
    }
    closeBag() {
        this.bagOpen = null;
        $('bag-pop').hidden = true;
        for (const el of document.querySelectorAll('.slot.on')) el.classList.remove('on');
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
