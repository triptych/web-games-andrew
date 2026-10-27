// The DOM layer: screens, the HUD, floating score text, toasts, settings and the touch deck.
// Reads the sim; never changes it.

import { VERSION, AMMO } from './config.js';
import { LEVELS } from './sim/levels.js';

const $ = (id) => document.getElementById(id);
const SPECIAL = { boost: 'BURN', slam: 'DIVE', split: 'SPLIT', blast: 'BLAST' };

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.project = null;               // set by main: (x, y) → client px, for floating text
        this.hudKey = '';
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

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game and stars deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another sits on top of it: same z-index stacks in page order
        $(id).style.zIndex = String(50 + this.stack.length);
        this.syncUnder();
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        $(id).style.zIndex = '';
        this.stack = this.stack.filter((s) => s !== id);
        this.syncUnder();
        if (this.top()) this.focusFirst(this.top());
    }
    /** Only the top sheet shows its panel; the ones beneath it would ghost through. */
    syncUnder() { for (const s of this.stack) $(s).classList.toggle('under', s !== this.top()); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ sector list
    renderLevels(progress, isOpen, onPick) {
        const grid = $('level-grid');
        grid.textContent = '';
        LEVELS.forEach((lv, i) => {
            const b = document.createElement('button');
            b.className = 'btn lvl';
            b.disabled = !isOpen(i);
            const n = document.createElement('span'); n.className = 'n'; n.textContent = `SECTOR ${i + 1}`;
            const t = document.createElement('span'); t.className = 't'; t.textContent = b.disabled ? 'Locked' : lv.name;
            const s = document.createElement('span'); s.className = 's';
            const got = progress.stars[i] || 0;
            s.textContent = b.disabled ? '' : '★'.repeat(got) + '☆'.repeat(3 - got);
            b.append(n, t, s);
            b.addEventListener('click', () => onPick(i));
            grid.appendChild(b);
        });
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on; $('hint').hidden = !on;
        this.hudKey = '';
        this.setTouch(this.touchOn, on);
    }
    hud(G) {
        $('hud-score').textContent = G.score;
        $('hud-robots').textContent = G.robots;
        const type = G.ammo[0];
        const key = G.level + '|' + G.ammo.join() + '|' + G.state;
        if (key === this.hudKey) return;
        this.hudKey = key;
        $('hud-level').textContent = `SECTOR ${G.level + 1} · ${LEVELS[G.level].name}`;
        const pips = $('hud-ammo');
        pips.textContent = '';
        G.ammo.forEach((a, i) => {
            const p = document.createElement('span');
            p.className = `pip ${a}${i === 0 ? ' next' : ''}`;
            p.title = AMMO[a].label;
            pips.appendChild(p);
        });
        const btn = $('btn-a');
        if (G.state === 'ready' && type) {
            $('hint').textContent = `${AMMO[type].label.toUpperCase()} · ${AMMO[type].hint} · drag back to aim`;
            btn.textContent = 'FIRE';
        } else if (G.state === 'flight') {
            const flying = G.bodies.find((b) => b.id === G.proj);
            const kind = flying ? AMMO[flying.ammo] : null;
            $('hint').textContent = kind && !flying.spent ? kind.hint : 'Watch it go';
            btn.textContent = kind && !flying.spent ? SPECIAL[kind.special] : '…';
        } else {
            $('hint').textContent = G.state === 'clear' ? 'Station scrapped!' : '';
            btn.textContent = '…';
        }
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }

    // ------------------------------------------------------------------ text
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
    pop(x, y, text, big = false) {
        if (!this.project) return;
        const p = this.project(x, y);
        const host = $('pops');
        if (host.childElementCount > 14) return;
        const el = document.createElement('div');
        el.className = 'pop' + (big ? ' big' : '');
        el.textContent = text;
        el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
        host.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'robot') this.pop(e.x, e.y, `ROBOT DOWN +${e.value}`, true);
            else if (e.type === 'break' && e.value >= 80) this.pop(e.x, e.y, `+${e.value}`);
            else if (e.type === 'ready') this.hudKey = '';
        }
    }

    /** The end-of-sector sheet. */
    showOver(G, { hasNext, best }) {
        $('over-title').textContent = G.won ? 'Sector cleared' : 'Out of asteroids';
        $('over-stars').innerHTML = G.won
            ? [1, 2, 3].map((i) => `<span class="${i <= G.stars ? '' : 'off'}">★</span>`).join('')
            : '';
        const spare = G.ammo.length;
        $('over-text').textContent = G.won
            ? `${G.score} points${spare ? ` · ${spare} spare ${spare > 1 ? 'asteroids' : 'asteroid'} banked` : ''}${best ? ' · new best!' : ''}`
            : `${G.robots} ${G.robots === 1 ? 'robot' : 'robots'} survived. Try another angle.`;
        $('over-next').hidden = !(G.won && hasNext);
        this.openScreen('over');
    }
}
