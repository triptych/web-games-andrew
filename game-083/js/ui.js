// The DOM layer: screens, toasts, settings and the touch deck. The HUD itself is drawn in beams
// by js/view/hud.js. Reads the sim; never changes it.

import { VERSION } from './config.js';
import { STAGES } from './sim/data.js';

const $ = (id) => document.getElementById(id);

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

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), crt = $('set-crt'), inv = $('set-invert'), look = $('set-look');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; look.value = settings.look;
        crt.checked = !!settings.crt; inv.checked = !!settings.invert;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, crt: crt.checked, invert: inv.checked, look: +look.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, crt, inv, look]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
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
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ play chrome
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    /** The touch deck's labels follow the act: walk and turn on foot, aim in the air. */
    setMode(mode) {
        $('touch').dataset.mode = mode;
        $('stick-label').textContent = mode === 'flight' ? 'AIM' : 'WALK';
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    setBest(n) { $('title-best').textContent = n ? `Best ${String(n).padStart(6, '0')}` : ''; }

    /** Fill in the game-over (or homecoming) sheet. */
    showOver(G, best) {
        const won = G.won;
        $('over-title').textContent = won ? 'Home' : 'The Dragon Falls';
        $('over-text').textContent = won
            ? `The ward stone shatters and the kingdom's barrier breaks. Beyond the mountains the volcano of your homeland smoulders, and you fly home. Score ${G.score}${G.loop ? `, cycle ${G.loop + 1}` : ''}.`
            : `Fallen at ${stageName(G)}. Score ${G.score}.`;
        $('over-best').textContent = G.score >= best && G.score > 0 ? 'A new best!' : `Best ${best}`;
        $('over-continue').hidden = won;
        $('over-cycle').hidden = !won;
        this.openScreen('over');
    }
}

function stageName(G) {
    const name = STAGES[G.stageIdx].name.toLowerCase().replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
    return name.replace(/^The /, 'the ');
}
