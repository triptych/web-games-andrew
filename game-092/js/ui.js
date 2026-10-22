// The DOM layer: screens, the HUD, settings and the touch deck. Reads the sim; never changes it.

import { VERSION, TREASURES, LIVES_MAX } from './config.js';

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.shownScore = 0;
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
            b.addEventListener('click', () => { audio.sfx('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), crt = $('set-crt'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch;
        crt.checked = !!settings.crt; calm.checked = !!settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, crt: crt.checked, calm: calm.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, crt, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // each screen opens above the one before it, whatever the page order
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.closest('[hidden]')); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    setBest(best) {
        $('best').textContent = best.score ? `BEST ${String(best.score).padStart(6, '0')}  ·  ${best.treasures}/${TREASURES} TREASURES` : '';
    }

    showOver(G, best, newBest) {
        const n = G.got.reduce((a, b) => a + b, 0);
        const titles = { won: 'Jungle conquered!', time: 'Time!', lives: 'Out of lives' };
        $('over-title').textContent = titles[G.reason] || 'Expedition over';
        $('over-text').textContent = G.reason === 'won'
            ? `All ${TREASURES} treasures with ${fmtTime(G.left)} to spare.`
            : G.reason === 'time' ? 'The sun set on the jungle.' : 'The jungle keeps its secrets.';
        const rows = [['Score', String(G.score).padStart(6, '0') + (newBest ? ' NEW BEST!' : '')], ['Treasures', `${n} / ${TREASURES}`],
            ['Time used', fmtTime(Math.round(1200 - G.left))], ['Screens crossed', G.stats.screens], ['Deaths', G.stats.deaths], ['Best', String(best.score).padStart(6, '0')]];
        $('over-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
        this.openScreen('over');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    hud(G, dt) {
        // the score counts up
        if (this.shownScore !== G.score) {
            const d = G.score - this.shownScore;
            this.shownScore += Math.abs(d) < 8 ? d : Math.sign(d) * Math.max(7, Math.abs(d) * Math.min(1, dt * 9));
            if (Math.abs(G.score - this.shownScore) < 1) this.shownScore = G.score;
        }
        $('hud-score').textContent = String(Math.round(this.shownScore)).padStart(6, '0');
        const tl = $('hud-time');
        tl.textContent = fmtTime(Math.ceil(G.left));
        tl.classList.toggle('low', G.left < 60);
        const lv = Math.max(0, Math.min(LIVES_MAX, G.lives));
        const lives = $('hud-lives');
        if (lives.dataset.n !== String(lv)) { lives.dataset.n = lv; lives.textContent = '♥'.repeat(lv) || '-'; }
        $('hud-loot').textContent = `${G.got.reduce((a, b) => a + b, 0)}/${TREASURES}`;
    }

    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
}
