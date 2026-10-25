// The DOM layer shared by every mode: the screen stack, toasts, settings and the touch deck.
// Reads the sim; never changes it.

import { VERSION } from '../config.js';

export const $ = (id) => document.getElementById(id);

export class UI {
    constructor({ audio, settings, onSettings, onDeleteAll }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.touchWanted = false;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
            for (const b of el.querySelectorAll('[data-close]')) {
                b.addEventListener('click', () => { audio.ui('close'); this.closeScreen(el.id); });
            }
        }

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; calm.checked = !!settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, calm: calm.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => {
            if (!confirm('Delete every cartridge you made on this device?')) return;
            onDeleteAll();
            this.toast('All carts deleted.');
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another appears on top of it
        el.style.zIndex = String(50 + this.stack.length);
        this.focusFirst(id);
        this.onChange?.();
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        this.onChange?.();
    }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input, textarea')].filter((b) => !b.hidden && !b.closest('[hidden]') && !b.disabled); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const top = this.top();
        if (!top) return;
        const list = this.buttons(top).filter((b) => b.tagName !== 'TEXTAREA');
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
        window.A11Y?.announce?.(text);
    }

    setTouch(on) {
        this.touchWanted = on;
        this.refreshTouch();
    }
    /** The deck shows only while a stage is running and the player wants it. */
    refreshTouch(running = this.running) {
        this.running = running;
        $('touch').hidden = !(this.touchWanted && running);
    }

    version() { return VERSION; }
}
