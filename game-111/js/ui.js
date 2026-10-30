// The DOM layer: screens, the HUD, the powers bar, banners, the deck of cards, toasts and settings.
// Reads the sim; never changes it (powers are commands sent back through onPower).

import { VERSION, CREEP_EVERY, goalFor } from './config.js';
import { ARCANA, POWERS, omensFor } from './sim/arcana.js';
import { powerUsable } from './sim/game.js';
import { paintCard } from './view/cardart.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onPower }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.cardArc = -1;
        this.last = {};
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

        const sfx = $('set-sfx'), music = $('set-music'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; calm.value = settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, calm: calm.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => {
            if (this.confirmDelete) { onDeleteSave(); this.toast('All progress forgotten. The world is dark again.'); this.confirmDelete = false; $('set-delete').textContent = 'Forget all progress'; return; }
            this.confirmDelete = true;
            $('set-delete').textContent = 'Press again to forget everything';
        });

        // powers act on finger-down: a click waits for the lift and feels late
        for (const b of document.querySelectorAll('.pwr')) {
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); onPower(b.dataset.power); });
            b.addEventListener('click', (e) => { if (e.detail === 0) onPower(b.dataset.power); });
        }

        this.buildDeck();
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // screens opened from another stack on top of it
        this.stack.forEach((s, k) => { $(s).style.zIndex = String(50 + k); });
        if (id === 'deck') this.showDeck();
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'settings') { this.confirmDelete = false; $('set-delete').textContent = 'Forget all progress'; }
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) {
        return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length > 0 && !b.closest('[hidden]'));
    }
    /** Focus a screen's primary button if it has one, else its first control. */
    focusFirst(id) {
        const list = this.buttons(id);
        (list.find((b) => b.classList.contains('primary')) || list[0])?.focus({ preventScroll: true });
    }
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
        $('powers').hidden = !on;
        if (!on) for (const id of ['resonance', 'creep', 'stuck', 'hint']) $(id).hidden = true;
    }

    hud(G, ctl) {
        const arc = Math.min(G.arc, 21);
        const after = G.won;
        const name = G.won ? 'Afterglow' : `${G.mode === 'endless' ? 'Omen ' : ''}${ARCANA[arc].numeral} · ${ARCANA[arc].name}`;
        this.set('hud-arc-name', name);
        this.set('hud-light', `${fmt(G.light)} / ${fmt(G.goal)}`);
        const w = `${Math.min(100, (G.light / G.goal) * 100).toFixed(1)}%`;
        if (this.last.bar !== w) { $('hud-bar').style.width = w; this.last.bar = w; }
        this.set('hud-score', fmt(G.score));
        this.set('hud-sparks', `✦ ${G.sparks}`);
        if (this.cardArc !== arc + (after ? 100 : 0)) {
            this.cardArc = arc + (after ? 100 : 0);
            const g = $('hud-card').getContext('2d');
            g.clearRect(0, 0, 60, 100);
            paintCard(g, arc, 60, 100, { lit: G.won || G.restored.includes(arc), glow: false });
        }
        // resonance and the creeping void
        const res = G.resonance > 0 ? `Resonance ×${(1 + 0.5 * G.resonance).toFixed(1)}` : '';
        this.set('resonance', res);
        $('resonance').hidden = !res;
        const creep = omensFor(arc).creep && !G.over;
        const left = CREEP_EVERY - (G.misses % CREEP_EVERY);
        this.set('creep', `The Void creeps in ${left}`);
        $('creep').hidden = !creep;
        // powers
        for (const b of document.querySelectorAll('.pwr')) {
            const p = b.dataset.power;
            const owned = G.owned.includes(p);
            const usable = owned && powerUsable(G, p);
            const key = `${owned}${usable}${G.stuck}${ctl.target === p}`;
            if (b.dataset.k === key) continue;
            b.dataset.k = key;
            b.classList.toggle('locked', !owned);
            b.classList.toggle('ready', usable);
            b.classList.toggle('urge', usable && G.stuck);
            b.classList.toggle('active', ctl.target === p);
            b.disabled = !usable && ctl.target !== p;
            const P = POWERS[p];
            b.querySelector('.cost').textContent = owned ? `✦${P.cost}` : ARCANA[P.from].numeral;
            b.title = owned ? `${P.name} (✦${P.cost}): ${P.text}` : `Rekindle ${ARCANA[P.from].name} to awaken ${P.name}`;
            b.setAttribute('aria-label', b.title);
        }
        $('stuck').hidden = !G.stuck || G.over;
    }

    set(id, text) {
        if (this.last[id] === text) return;
        this.last[id] = text;
        $(id).textContent = text;
    }

    hint(text) {
        const el = $('hint');
        if (!text) { el.hidden = true; return; }
        el.textContent = text;
        el.hidden = false;
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
        window.A11Y?.announce?.(text);
    }

    /** The banner when a new arcanum's omens arrive. */
    omen(arc, mode) {
        const a = ARCANA[Math.min(arc, 21)];
        $('omen-num').textContent = mode === 'endless' ? `OMEN ${a.numeral}` : `ARCANUM ${a.numeral}`;
        $('omen-name').textContent = a.name;
        $('omen-line').textContent = a.line;
        const el = $('omen');
        el.hidden = true;
        void el.offsetWidth;                // restart the animation
        el.hidden = false;
        clearTimeout(this.omenT);
        this.omenT = setTimeout(() => { el.hidden = true; }, 4300);
    }

    rekindle(arc, power) {
        $('rk-name').textContent = ARCANA[arc].name;
        $('rk-power').textContent = power ? `Power awakened: ${POWERS[power].name} — ${POWERS[power].text}` : '';
        const el = $('rekindle');
        el.hidden = true;
        void el.offsetWidth;
        el.hidden = false;
        clearTimeout(this.rkT);
        this.rkT = setTimeout(() => { el.hidden = true; }, 3100);
        window.A11Y?.announce?.(`${ARCANA[arc].name} rekindled.${power ? ` ${POWERS[power].name} awakened.` : ''}`);
    }

    // ------------------------------------------------------------------ title, over, ending
    title(meta, save) {
        const n = meta.restored.length;
        $('progress').textContent = n === 22 ? '✦ All 22 Arcana rekindled — the world is whole ✦'
            : n ? `✦ ${n} of 22 Arcana rekindled ✦` : 'The sky is dark. No arcana yet rekindled.';
        $('btn-continue').hidden = !save;
        const q = $('btn-quest');
        q.hidden = n === 22;
        q.textContent = n === 0 ? 'Begin the Restoration' : `New Reading: ${ARCANA[n].numeral} · ${ARCANA[n].name}`;
        q.classList.toggle('primary', !save);
    }

    over(G, meta) {
        const quest = G.mode === 'quest';
        $('over-head').textContent = G.won ? 'The Afterglow Fades' : 'The Reading Ends';
        const n = G.restored.length;
        $('over-text').textContent = `${fmt(G.score)} light gathered in ${G.moves} moves, ${G.lines} ${G.lines === 1 ? 'line' : 'lines'} cleared, best resonance ×${(1 + 0.5 * G.bestResonance).toFixed(1)}.` +
            (quest ? (n ? ` You rekindled ${n} ${n === 1 ? 'arcanum' : 'arcana'}.` : '') : ` Best free reading: ${fmt(meta.bestFree)}.`);
        const box = $('over-cards');
        box.innerHTML = '';
        for (const i of G.restored) {
            const cv = document.createElement('canvas');
            cv.width = 84; cv.height = 140;
            paintCard(cv.getContext('2d'), i, 84, 140, { lit: true, glow: false });
            cv.title = ARCANA[i].name;
            box.appendChild(cv);
        }
        $('over-embers').textContent = quest && !G.won && G.light > 0
            ? `Embers kept: ${fmt(G.light)} of ${fmt(G.goal)} light toward ${ARCANA[G.arc].name}. The next reading begins there.`
            : '';
    }

    // ------------------------------------------------------------------ the deck
    buildDeck() {
        const grid = $('deck-grid');
        this.deckCards = ARCANA.map((a, i) => {
            const b = document.createElement('button');
            b.setAttribute('aria-label', `${a.numeral} ${a.name}`);
            b.setAttribute('aria-pressed', 'false');
            const cv = document.createElement('canvas');
            cv.width = 120; cv.height = 200;
            b.appendChild(cv);
            b.addEventListener('click', () => this.deckDetail(i));
            grid.appendChild(b);
            return { b, cv, lit: null };
        });
    }
    setDeckState(restored) { this.deckRestored = new Set(restored); }
    showDeck() {
        const set = this.deckRestored || new Set();
        this.deckCards.forEach((d, i) => {
            const lit = set.has(i);
            if (d.lit !== lit || this.repaintDeck) {
                d.lit = lit;
                const g = d.cv.getContext('2d');
                g.clearRect(0, 0, 120, 200);
                paintCard(g, i, 120, 200, { lit, glow: true });
            }
        });
        this.repaintDeck = false;
        $('deck-sub').textContent = `${set.size} of 22 rekindled. Tap a card to read it.`;
        this.deckDetail(Math.min(21, set.size));
    }
    deckDetail(i) {
        const a = ARCANA[i];
        const lit = this.deckRestored?.has(i);
        this.deckCards.forEach((d, k) => d.b.setAttribute('aria-pressed', String(k === i)));
        const P = a.power ? POWERS[a.power] : null;
        const o = omensFor(i);
        const omen = [o.sigils && `${o.sigils} sigil${o.sigils > 1 ? 's' : ''}`, o.blight && `${o.blight} blight (${o.blightHp} hits)`, o.creep && 'the creeping Void', o.harmony && 'harmony bonus'].filter(Boolean).join(', ');
        $('deck-detail').innerHTML = '';
        const head = document.createElement('div');
        head.innerHTML = `<b>${a.numeral} · ${a.name}</b> — ${lit ? 'rekindled' : 'still dark'}`;
        const line = document.createElement('div');
        line.textContent = a.line;
        const extra = document.createElement('div');
        extra.className = 'dim';
        extra.textContent = `Light to rekindle: ${fmt(goalFor(i))}.${omen ? ` Omens: ${omen}.` : ''}${P ? ` Grants ${P.name}: ${P.text}` : ''}`;
        $('deck-detail').append(head, line, extra);
    }
}
