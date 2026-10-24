// The DOM layer: HUD, pack, dialogue box, talk choices, the two puzzle overlays, the journal,
// screens and toasts. Reads the sim (it needs the clue and item tables); changes it only by
// handing actions to main.js through `onAct`.

import { VERSION, EVIDENCE_NEEDED } from './config.js';
import { ITEMS, ROOMS, CLUES, SUSPECTS, TALK, EPILOGUE, NOTE_NAMES } from './sim/data.js';
import { objective } from './sim/game.js';
import { roomOpen, evidenceCount } from './sim/world.js';
import { drawItem, drawFace } from './view/icons.js';

const $ = (id) => document.getElementById(id);
const NOTE_HEX = ['#ff6b8b', '#ffb43a', '#4fd6a0', '#56b8ff', '#a57bff'];
const SPEED = { normal: 55, fast: 140, instant: 1e6 };

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onAct }) {
        this.audio = audio;
        this.settings = settings;
        this.onAct = onAct;
        this.G = null;
        this.stack = [];                   // open screens, top last
        this.held = null;                  // the pack item that is selected
        this.queue = [];                   // dialogue lines waiting
        this.line = null;                  // the line on screen
        this.shown = 0;
        this.pending = [];                 // overlays to open when the dialogue finishes
        this.packKey = '';
        this.tab = 'goal';
        this.digits = [0, 0, 0];
        this.onDialogueEnd = null;
        this.melodyT = 0;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const el of document.querySelectorAll('.screen [data-close]')) {
            el.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }
        // a mouse click leaves focus on the button, and then Space would press it again
        document.addEventListener('click', (e) => { if (e.detail && e.target.closest?.('button') && !e.target.closest('.slot')) e.target.closest('button').blur(); });

        // settings
        const sfx = $('set-sfx'), music = $('set-music'), q = $('set-quality'), calm = $('set-calm'), text = $('set-text');
        sfx.value = settings.sfx; music.value = settings.music; q.value = settings.quality; calm.checked = !!settings.calm; text.value = settings.text;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, quality: q.value, calm: calm.checked, text: text.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, q, calm, text]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // dialogue: tap anywhere on the box
        $('dialogue').addEventListener('click', () => this.advance());

        // pack
        $('using-cancel').addEventListener('click', () => this.select(null));

        // lock overlay
        for (const b of document.querySelectorAll('.wheel button')) {
            b.addEventListener('click', () => {
                const w = +b.dataset.w;
                this.digits[w] = (this.digits[w] + +b.dataset.d + 10) % 10;
                $('w' + w).textContent = this.digits[w];
                audio.ui('select');
            });
        }
        $('lock-try').addEventListener('click', () => this.onAct({ type: 'code', id: 'pantry', digits: this.digits.slice() }));

        // melody overlay
        for (const b of document.querySelectorAll('.mkey')) {
            b.addEventListener('click', () => { const n = +b.dataset.n; audio.note(n); this.onAct({ type: 'note', n }); });
        }
        $('melody-reset').addEventListener('click', () => { this.onAct({ type: 'noteReset' }); audio.ui('click'); });

        // journal tabs
        for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => { audio.ui('page'); this.setTab(b.dataset.tab); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // each screen opened from another sits above it, whatever the page order
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        $(id).hidden = false;
        if (id === 'journal') this.renderJournal();
        if (id === 'lock') this.renderLock();
        if (id === 'melody') this.renderMelody();
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
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on;
        $('pack').hidden = !on;
        if (!on) { this.hideDialogue(); $('choices').hidden = true; this.select(null); this.setTip(null); }
    }
    setRoom(room) {
        $('room-name').textContent = ROOMS[room].name;
        $('room-icon').textContent = ROOMS[room].icon;
    }
    setGoal(G) { $('goal').textContent = objective(G); }
    glow(on) { $('btn-hint').classList.toggle('glow', on); }

    // ------------------------------------------------------------------ the pack
    syncPack(G) {
        const key = G.inv.join(',') + '|' + this.held;
        if (key === this.packKey) return;
        this.packKey = key;
        const slots = $('slots');
        const before = new Set([...slots.children].map((c) => c.dataset.item));
        slots.textContent = '';
        G.inv.forEach((id, i) => {
            const b = document.createElement('button');
            b.className = 'slot' + (id === this.held ? ' sel' : '');
            b.dataset.item = id;
            b.setAttribute('role', 'listitem');
            b.setAttribute('aria-label', ITEMS[id].name + (id === this.held ? ' (selected)' : ''));
            b.title = ITEMS[id].name;
            if (before.has(id)) b.style.animation = 'none';
            const c = document.createElement('canvas'); c.width = c.height = 92;
            drawItem(c, id);
            b.appendChild(c);
            const n = document.createElement('span'); n.className = 'n'; n.textContent = i + 1; b.appendChild(n);
            b.addEventListener('click', () => this.clickItem(id));
            slots.appendChild(b);
        });
        if (this.held && !G.inv.includes(this.held)) this.select(null);
    }
    clickItem(id) {
        this.audio.ui('select');
        if (this.held && this.held !== id) {
            const a = this.held;
            this.select(null);
            this.onAct({ type: 'combine', a, b: id });
        } else if (this.held === id) this.select(null);
        else { this.select(id); this.toast(`<b>${ITEMS[id].name}</b> ${ITEMS[id].desc}`); }
    }
    select(id) {
        this.held = id;
        this.packKey = '';
        $('using').hidden = !id;
        if (id) $('using-text').textContent = `Using ${ITEMS[id].name}: tap something`;
        if (this.G) this.syncPack(this.G);
    }
    selectIndex(i) { const id = this.G?.inv[i]; if (id) this.clickItem(id); }

    setTip(name, x, y, verb = '') {
        const t = $('tip');
        if (!name) { t.hidden = true; return; }
        t.hidden = false;
        t.innerHTML = verb ? `<small>${verb}</small>${name}` : name;
        t.style.left = Math.max(60, Math.min(innerWidth - 60, x)) + 'px';
        t.style.top = Math.max(60, y) + 'px';
    }

    // ------------------------------------------------------------------ dialogue
    onEvents(G, events) {
        const made = new Set(events.filter((e) => e.type === 'combine').map((e) => e.out));   // "Made X" says it, not "Picked up X"
        for (const e of events) {
            if (e.type === 'say') this.queue.push({ who: e.who, text: e.text });
            else if (e.type === 'open') this.pending.push(e.ui);
            else if (e.type === 'room') this.setRoom(e.room);
            else if (e.type === 'give') { if (!made.has(e.item)) this.toast(`Picked up <b>${ITEMS[e.item].name}</b>`); }
            else if (e.type === 'combine') this.toast(`Made <b>${ITEMS[e.out].name}</b>`);
            else if (e.type === 'clue') this.toast(`New ${e.kind === 'evidence' ? 'evidence' : 'clue'}: <b>${CLUES[e.id].title}</b>`);
            else if (e.type === 'wisp') this.toast(`Found a shy ghost! <b>${G.stats.wisps} of ${Object.keys(ROOMS).length}</b>`);
            else if (e.type === 'code' && e.ok) this.closeScreen('lock');
            else if (e.type === 'note') this.onNote(G, e);
            else if (e.type === 'solved') this.glow(false);
        }
        if (this.G) this.setGoal(G);
        if (this.top() === 'journal') this.renderJournal();
        if (this.top() === 'melody') this.renderMelody();
        // an overlay asked for with nothing to read first (tapping a wound music box) opens at once
        if (!this.hasWords()) this.runPending();
    }
    active() { return !$('dialogue').hidden; }
    hasWords() { return this.active() || this.queue.length > 0; }

    showLine(l) {
        this.line = l; this.shown = 0;
        $('dialogue').hidden = false;
        const narr = !l.who;
        $('say-who').textContent = narr ? '' : l.who;
        $('say-who').hidden = narr;
        $('say-text').classList.toggle('narr', narr);
        $('say-text').textContent = '';
        drawFace($('face'), l.who);
        $('say-more').style.visibility = 'hidden';
    }
    hideDialogue() { $('dialogue').hidden = true; this.line = null; this.queue.length = 0; }
    advance() {
        if (!this.line) return;
        if (this.shown < this.line.text.length) { this.shown = this.line.text.length; this.renderText(); return; }
        this.audio.ui('click');
        this.nextLine();
    }
    nextLine() {
        const l = this.queue.shift();
        if (l) this.showLine(l);
        else { $('dialogue').hidden = true; this.line = null; this.onDialogueEnd?.(); }
    }
    renderText() {
        const t = this.line.text.slice(0, this.shown);
        $('say-text').textContent = t;
        $('say-more').style.visibility = this.shown >= this.line.text.length ? 'visible' : 'hidden';
    }
    /** Typewriter, and start the next line when the box is empty. */
    update(dt) {
        if (!this.line && this.queue.length) this.nextLine();
        if (this.line && this.shown < this.line.text.length) {
            const before = Math.floor(this.shown / 3);
            this.shown = Math.min(this.line.text.length, this.shown + dt * SPEED[this.settings.text]);
            if (Math.floor(this.shown / 3) !== before && this.line.who) this.audio.ui('text');
            this.renderText();
        }
    }

    /** Overlays asked for by an action open once its lines have been read. */
    runPending() {
        while (this.pending.length) { const id = this.pending.shift(); if (id === 'lock' || id === 'melody') this.openScreen(id); }
    }

    // ------------------------------------------------------------------ talk choices
    refreshTalk(G) {
        const box = $('choices');
        const node = G.talk ? TALK[G.talk.node] : null;
        const want = !!node && node.choices.length > 0 && !this.hasWords() && !this.anyScreen();
        if (!want) { if (!box.hidden && !(G.talk && this.hasWords())) { box.hidden = true; box.dataset.node = ''; } return; }
        if (box.dataset.node === G.talk.node && !box.hidden) return;
        box.textContent = '';
        box.dataset.node = G.talk.node;
        node.choices.forEach((c, i) => {
            const b = document.createElement('button');
            b.className = 'btn'; b.textContent = c.text;
            b.addEventListener('click', () => { box.hidden = true; box.dataset.node = ''; this.audio.ui('click'); this.onAct({ type: 'choose', i }); });
            box.appendChild(b);
        });
        box.hidden = false;
        box.firstChild.focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ the pantry lock
    renderLock() {
        const G = this.G;
        this.digits = [0, 0, 0];
        for (let i = 0; i < 3; i++) $('w' + i).textContent = 0;
        let memo = $('lock-memo');
        if (!memo) { memo = document.createElement('p'); memo.id = 'lock-memo'; memo.className = 'dim'; $('lock').querySelector('.wheels').after(memo); }
        const L = G.layout, has = (c) => G.clues.includes(c);
        memo.textContent = `Your notes: age ${has('portrait') ? L.age : '?'} · party day ${has('partyday') ? L.day : '?'} · guests ${has('guests') ? L.guests : '?'}`;
    }

    // ------------------------------------------------------------------ the music box
    renderMelody() {
        const G = this.G, dots = $('melody-dots').children;
        for (let i = 0; i < 4; i++) {
            const n = G.notes[i];
            dots[i].style.background = n === undefined ? '' : NOTE_HEX[n];
            dots[i].style.borderColor = n === undefined ? '' : '#fff';
        }
    }
    onNote(G, e) {
        this.renderMelody();
        if (e.ok === true) setTimeout(() => { this.closeScreen('melody'); }, 1400);
        else if (e.ok === false) { const dots = $('melody-dots').children; for (const d of dots) d.style.background = '#ff5a5a'; setTimeout(() => this.renderMelody(), 500); }
    }

    // ------------------------------------------------------------------ the journal
    setTab(t) { this.tab = t; this.renderJournal(); }
    renderJournal() {
        const G = this.G, body = $('journal-body');
        for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', b.dataset.tab === this.tab ? 'true' : 'false');
        body.textContent = '';
        const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
        const richText = (s) => s.replace(/\{\{n:(\d)\}\}/g, (m, n) => `<span class="dot" style="background:${NOTE_HEX[+n]}"></span>`);
        if (this.tab === 'goal') {
            body.append(el('p', 'goal-big', objective(G)));
            const wisps = G.stats.wisps, total = Object.keys(ROOMS).length;
            body.append(el('p', 'dim', `Clues found: ${G.clues.length} of ${Object.keys(CLUES).length}. Shy ghosts spotted: ${wisps} of ${total}.`));
            const hb = el('button', 'btn primary', '💡 I need a hint'); hb.addEventListener('click', () => { this.closeScreen('journal'); this.onAct({ type: 'hint' }); });
            body.append(hb);
        } else if (this.tab === 'clues') {
            const groups = [['evidence', 'Evidence', 'ev'], ['code', 'Codes', 'code'], ['diary', 'Diary pages', 'diary'], ['clue', 'Other clues', '']];
            if (!G.clues.length) body.append(el('p', 'empty', 'Nothing yet. Look around the house and tap things.'));
            for (const [kind, label, cls] of groups) {
                const list = G.clues.filter((c) => CLUES[c].kind === kind);
                if (!list.length) continue;
                body.append(el('div', 'group-h', label));
                for (const c of list) body.append(el('div', 'entry ' + cls, `<b>${CLUES[c].title}</b>${richText(CLUES[c].text(G.layout))}`));
            }
        } else if (this.tab === 'case') {
            const ev = evidenceCount(G);
            body.append(el('p', null, G.f.case_solved ? '<b>Case closed.</b> It was Winnie, a lonely ghost who only wanted friends. 👻' : `What is haunting Hauntly Manor? You need ${EVIDENCE_NEEDED} pieces of evidence before you decide.`));
            const m = el('div', 'meter');
            for (const c of Object.keys(CLUES).filter((k) => CLUES[k].kind === 'evidence')) m.append(el('span', 'pip' + (G.clues.includes(c) ? ' on' : ''), G.clues.includes(c) ? CLUES[c].title : '???'));
            body.append(m);
            if (!G.f.case_solved) {
                const s = el('div', 'suspects');
                for (const [id, sus] of Object.entries(SUSPECTS)) {
                    const b = el('button', 'btn suspect', `<span class="ico">${sus.icon}</span><span>${sus.name}</span>`);
                    b.disabled = ev < EVIDENCE_NEEDED;
                    b.addEventListener('click', () => { this.closeScreen('journal'); this.onAct({ type: 'accuse', who: id }); });
                    s.append(b);
                }
                body.append(s);
            }
        } else if (this.tab === 'map') {
            const g = el('div', 'rooms');
            for (const [id, r] of Object.entries(ROOMS)) {
                const open = roomOpen(G, id), seen = !!G.visited[id];
                const b = el('button', 'btn room-btn' + (id === G.room ? ' here' : ''), `<span class="ico">${open ? r.icon : '🔒'}</span>${open && seen ? r.name : open ? r.name : '???'}<small>${id === G.room ? 'You are here' : open ? (seen ? 'Go' : 'New!') : 'Locked'}</small>`);
                b.disabled = !open || id === G.room;
                b.addEventListener('click', () => { this.closeScreen('journal'); this.onAct({ type: 'go', room: id }); });
                g.append(b);
            }
            body.append(g);
        }
    }

    // ------------------------------------------------------------------ the end
    showEnding(G) {
        $('over-text').textContent = EPILOGUE[G.ending];
        const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60);
        $('over-stats').textContent = `Clues found: ${G.clues.length} of ${Object.keys(CLUES).length} · shy ghosts spotted: ${G.stats.wisps} of ${Object.keys(ROOMS).length} · hints used: ${G.stats.hints} · time: ${m}:${String(s).padStart(2, '0')}`;
        this.openScreen('over');
    }

    toast(html) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = html;
        const box = $('toasts');
        while (box.children.length > 2) box.firstChild.remove();
        box.appendChild(el);
        setTimeout(() => el.remove(), 3300);
    }
}
