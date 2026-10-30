// The DOM layer: screens, the pause button, toasts, settings, the high-score tables and the touch deck.
// (The HUD itself is drawn into the pixel buffer by the view.) Reads the sim; never changes it.

import { VERSION } from './config.js';

const $ = (id) => document.getElementById(id);
const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const els = { sfx: $('set-sfx'), music: $('set-music'), touch: $('set-touch'), autofire: $('set-autofire'), effects: $('set-effects'), crt: $('set-crt'), voice: $('set-voice') };
        for (const [k, el] of Object.entries(els)) el.value = settings[k];
        const changed = () => {
            for (const [k, el] of Object.entries(els)) settings[k] = el.type === 'range' ? +el.value : el.value;
            onSettings(settings);
        };
        for (const el of Object.values(els)) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another sits on top of it, whatever the page order
        el.style.zIndex = String(50 + this.stack.length);
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.closest('[hidden]') && b.offsetParent !== null); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ play chrome
    showHud(on) { $('btn-pause').hidden = !on; this.setTouch(this.touchOn, on, this.autofire); }
    /** on: show the deck while playing; auto: fire is automatic, so the FIRE button is hidden. */
    setTouch(on, playing = !$('btn-pause').hidden, auto = this.autofire) {
        this.touchOn = on;
        this.autofire = auto;
        $('touch').hidden = !(on && playing);
        $('touch').classList.toggle('auto', !!auto);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    // ------------------------------------------------------------------ scores
    setHi(score) { $('hiscore').textContent = pad6(score); }
    /** Fill an <ol> with the table; `rank` (0-based) highlights a new entry. */
    renderTable(ol, table, rank = -1) {
        ol.textContent = '';
        table.forEach((r, i) => {
            const li = document.createElement('li');
            if (i === rank) li.className = 'me';
            for (const [cls, text] of [['n', r.n], ['s', pad6(r.s)], ['w', 'W' + r.w]]) {
                const sp = document.createElement('span');
                sp.className = cls; sp.textContent = text;
                li.appendChild(sp);
            }
            // columns: rank (css counter), name, score, wave
            li.children[1].style.textAlign = 'left';
            ol.appendChild(li);
        });
    }
    showScores(table) { this.renderTable($('score-table'), table); this.openScreen('scores'); }

    /** The game-over sheet. `entry`: the score made the table, so ask for initials. */
    showOver(G, entry, name = 'AAA', table = null) {
        $('over-text').innerHTML = `SCORE <b>${pad6(G.score)}</b><br>WAVE <b>${G.wave}</b>`;
        $('over-entry').hidden = !entry;
        $('over-table').hidden = entry;
        if (entry) $('over-name').value = name;
        else if (table) this.renderTable($('over-table'), table);
        this.openScreen('over');
    }
    showOverTable(table, rank) {
        $('over-entry').hidden = true;
        $('over-table').hidden = false;
        this.renderTable($('over-table'), table, rank);
        this.focusFirst('over');
    }
}
