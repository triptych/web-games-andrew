// The DOM layer: screens, the HUD, toasts and settings. Reads the sim; never changes it.

import { VERSION, ITEMS } from './config.js';
import { paintIcon } from './view/items.js';

const $ = (id) => document.getElementById(id);

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.shownNext = -1;
        this.shownScore = -1;
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

        const sfx = $('set-sfx'), music = $('set-music'), snow = $('set-snow');
        sfx.value = settings.sfx; music.value = settings.music; snow.value = settings.snow;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, snow: snow.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, snow]) { el.addEventListener('change', changed); el.addEventListener('input', changed); }
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        this.buildChains();
    }

    /** The merge ladder on the title and in How to Play. */
    buildChains() {
        const small = $('title-chain');
        ITEMS.forEach((it, i) => {
            const c = document.createElement('canvas');
            paintIcon(c, i, 26);
            small.appendChild(c);
        });
        const big = $('howto-chain');
        ITEMS.forEach((it, i) => {
            const d = document.createElement('div');
            d.className = 'link';
            const c = document.createElement('canvas');
            paintIcon(c, i, 40);
            d.appendChild(c);
            d.appendChild(document.createTextNode(it.name));
            big.appendChild(d);
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.offsetParent !== null); }
    focusFirst(id) {
        const list = this.buttons(id);
        (list.find((b) => b.hasAttribute('data-focus')) || list[0])?.focus({ preventScroll: true });
    }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.shownNext = -1; this.shownScore = -1; }
    hud(G, best) {
        if (G.score !== this.shownScore) {
            this.shownScore = G.score;
            $('hud-score').textContent = G.score;
            $('hud-best').textContent = 'Best ' + Math.max(best.score, G.score);
        }
        if (G.next !== this.shownNext) {
            this.shownNext = G.next;
            paintIcon($('hud-next-icon'), G.next, 40);
        }
    }
    setBest(best) {
        $('title-best').textContent = best.score ? `Best: ${best.score} · biggest treat: ${ITEMS[best.tier].name}` : '';
    }
    toast(text) {
        // one at a time, so a run of merges never stacks notes over the jar
        $('toasts').replaceChildren();
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'newtop' && e.tier >= 5) this.toast(`New treat: ${ITEMS[e.tier].name}!`);
        }
    }
    showOver(G, best, isNew) {
        $('over-score').textContent = G.score;
        $('over-best').textContent = isNew ? 'New best score!' : `Best ${best.score}`;
        $('over-text').textContent = `Biggest treat: ${ITEMS[G.topTier].name}`;
        paintIcon($('over-icon'), G.topTier, 56);
    }
}
