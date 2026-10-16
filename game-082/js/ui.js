// The DOM layer: screens, the HUD, banners, toasts, settings, high scores and the ending.
// Reads the sim; never changes it.

import { VERSION, LETTERS, POWERS, BOSS } from './config.js';
import { LEVELS, LAST } from './sim/levels.js';
import { loadScores } from './save.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const POWER_ICON = { boots: '👟', long: '🍬', rapid: '🍭' };

export const ENDING = [
    'The last bubble pops, and the Void Baron spins away into the dark like a lost balloon.',
    'Out of his hat tumbles every star he ever bottled. They drift up through the station, sector by sector, and the Bubble Nebula lights up again: cyan, pink, gold.',
    'Much later, a small dark shape is found floating by the docking ring. It is the Baron, about the size of a plum, and very sorry. Pip blows him a bubble to sit in.',
    'He lives on the mantelpiece now. He has promised to be good.',
];

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.closedAt = 0;
        this.cache = {};
        this.bannerT = 0;
        $('version').textContent = 'v' + VERSION;
        $('hud-letters').innerHTML = LETTERS.map((l) => `<span>${l}</span>`).join('');

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count (game-071).
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const ids = ['sfx', 'music', 'quality', 'touch'];
        const els = Object.fromEntries(ids.map((k) => [k, $('set-' + k)]));
        els.sfx.value = settings.sfx; els.music.value = settings.music; els.quality.value = String(settings.quality); els.touch.value = settings.touch;
        const changed = () => {
            Object.assign(settings, { sfx: +els.sfx.value, music: +els.music.value, quality: +els.quality.value, touch: els.touch.value });
            onSettings(settings);
        };
        for (const el of Object.values(els)) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (id === 'scores') this.renderScores();
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        if ($(id).hidden) return;
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        this.closedAt = performance.now();
        if (this.top()) this.focusFirst(this.top());
        else document.activeElement?.blur?.();
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.offsetParent !== null); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }
    /** An action press that isn't the browser's own button press: press the focused button, or the first (game-080). */
    pressFocused() {
        const list = this.buttons(this.top());
        const el = list.includes(document.activeElement) ? document.activeElement : list[0];
        if (el && el.tagName === 'BUTTON') el.click();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on;
        $('btn-pause').hidden = !on;
        if (!on) { $('bossbar').hidden = true; this.banner(null); }
        this.setTouch(this.touchOn, on);
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    set(key, el, val, html = false) {
        if (this.cache[key] === val) return;
        this.cache[key] = val;
        if (html) $(el).innerHTML = val; else $(el).textContent = val;
    }
    hud(G, hi) {
        this.set('score', 'hud-score', String(G.score));
        this.set('hi', 'hud-hi', String(Math.max(hi, G.score)));
        this.set('sector', 'hud-sector', LEVELS[G.level].boss ? 'THE CORE' : `SECTOR ${G.level + 1}`);
        const letters = G.letters.map(Number).join('');
        if (this.cache.letters !== letters) {
            this.cache.letters = letters;
            [...$('hud-letters').children].forEach((s, i) => s.classList.toggle('on', G.letters[i]));
        }
        this.set('lives', 'hud-lives', G.lives > 6 ? `🐉×${G.lives}` : '🐉'.repeat(G.lives));
        this.set('powers', 'hud-powers', Object.entries(G.player.powers).filter(([, v]) => v).map(([k]) => POWER_ICON[k]).join('') + (G.freezeT > 0 ? '⏱️' : ''));
        const B = G.boss;
        $('bossbar').hidden = !B || B.st === 'enter';
        if (B) $('boss-fill').style.width = `${(100 * Math.max(0, B.hp)) / BOSS.hp}%`;
    }

    banner(text, sub = '', cls = '', secs = 1.6) {
        const el = $('banner');
        if (!text) { el.hidden = true; this.bannerT = 0; return; }
        el.className = cls;
        el.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
        el.hidden = false;
        // restart the pop animation
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        this.bannerT = secs;
    }
    tick(dt) {
        if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').hidden = true; }
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'level':
                    if (e.boss) this.banner('THE VOID BARON', "Pop the zap bubbles. The bolts find him.", 'hurry', 2.4);
                    else this.banner(`SECTOR ${e.idx + 1}`, e.name, '', 1.6);
                    break;
                case 'go': if (!LEVELS[G.level].boss) this.banner('GO!', '', '', 0.6); break;
                case 'hurry': this.banner('HURRY UP!', '', 'hurry', 2); break;
                case 'wraith': this.banner('THE WRAITH IS COMING', '', 'hurry', 1.6); break;
                case 'extend': this.banner('EXTEND!', 'N·E·B·U·L·A — an extra life and a free sector', 'extend', 2.6); break;
                case 'clear': this.banner('SECTOR CLEAR', '', '', 1.4); break;
                case 'bossTrap': this.banner('POP HIM!', '', 'extend', 1.6); break;
                case 'power': this.toast(`${POWERS[e.kind].name}: ${POWERS[e.kind].text}`); break;
                case 'respawn': this.banner('READY', '', '', 0.9); break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ end screens
    showOver(G, qualifies) {
        $('over-text').innerHTML = `${G.score.toLocaleString()} points · ${LEVELS[G.level].boss ? 'the Core' : 'sector ' + (G.level + 1)}`;
        $('over-name').hidden = !qualifies;
        if (qualifies) $('name-input').value = this.settings.name || 'PIP';
        $('over-continue').textContent = `Continue from ${LEVELS[G.level].boss ? 'the Core' : 'sector ' + (G.level + 1)}`;
        this.openScreen('over');
    }
    showEnding(G, qualifies) {
        $('ending-text').innerHTML = ENDING.map((p) => `<p>${esc(p)}</p>`).join('');
        $('ending-score').innerHTML = `Final score <b>${G.score.toLocaleString()}</b>${G.continues ? ` · ${G.continues} continue${G.continues > 1 ? 's' : ''}` : ' · no continues!'}`;
        $('ending-name').hidden = !qualifies;
        if (qualifies) $('name-input2').value = this.settings.name || 'PIP';
        this.openScreen('ending');
    }
    renderScores() {
        $('score-list').innerHTML = loadScores().map((r) => `<li>${esc(r.name)} <span>${r.sector > LAST ? 'beat the Baron' : 'sector ' + r.sector}</span><b>${r.score.toLocaleString()}</b></li>`).join('');
    }
}
