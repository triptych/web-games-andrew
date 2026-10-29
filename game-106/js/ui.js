// The DOM layer: screens, the HUD, banners, level-up cards, settings and the touch deck.
// Reads the sim; never changes it (a level-up card calls back into main, which calls choose()).

import { VERSION, UPGRADES, ROUND } from './config.js';
import { xpNeed } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onChoose }) {
        this.audio = audio;
        this.settings = settings;
        this.onChoose = onChoose;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.last = {};                    // last HUD values, so the DOM is only touched on change
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

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), voice = $('set-voice');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; voice.value = settings.voice;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, voice: voice.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, voice]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        $('levelup-menu').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-i]');
            if (b) this.onChoose(+b.dataset.i);
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        const el = $(id);
        el.hidden = false;
        // a screen opened from another screen sits on top of it, whatever the page order
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.offsetParent !== null); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter and Space are the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ level up
    showChoice(G) {
        const menu = $('levelup-menu');
        menu.innerHTML = '';
        G.choice.options.forEach((id, i) => {
            const U = UPGRADES[id], lv = G.up[id];
            const b = document.createElement('button');
            b.className = 'btn';
            b.dataset.i = i;
            b.dataset.id = id;
            b.innerHTML = `<span class="k">[${i + 1}]</span><span class="n"></span><span class="d"></span><span class="lv"></span>`;
            b.querySelector('.n').textContent = U.name;
            b.querySelector('.d').textContent = U.desc;
            b.querySelector('.lv').textContent = id === 'repair' ? '' : lv ? `LV ${lv} → ${lv + 1}` : 'NEW';
            menu.appendChild(b);
        });
        this.openScreen('levelup');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on;
        $('btn-pause').hidden = !on;
        this.setTouch(this.touchOn, on);
    }
    hud(G) {
        const p = G.player;
        const set = (k, v, fn) => { if (this.last[k] !== v) { this.last[k] = v; fn(v); } };
        set('score', G.score, (v) => { $('hud-score').textContent = String(v).padStart(6, '0'); });
        set('time', Math.floor(G.t), (v) => { $('hud-time').textContent = clock(v); });
        set('lv', G.level, (v) => { $('hud-lv').textContent = 'LV' + v; });
        set('hp', Math.round((p.hp / p.maxHp) * 100), (v) => { $('hud-hp').firstChild.style.transform = `scaleX(${v / 100})`; });
        set('xp', Math.round((G.xp / xpNeed(G.level)) * 100), (v) => { $('hud-xp').firstChild.style.transform = `scaleX(${Math.min(1, v / 100)})`; });
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
    banner(text, tone = '') {
        const el = $('banner');
        el.hidden = true;
        el.className = tone;
        el.textContent = text;
        void el.offsetWidth;               // restart the animation
        el.hidden = false;
        clearTimeout(this.bannerT);
        this.bannerT = setTimeout(() => { el.hidden = true; }, 2300);
    }
    setHiscore(n) { $('hiscore').textContent = String(n).padStart(6, '0'); }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'sector') this.banner(e.sector === 5 ? 'FINAL SECTOR' : `SECTOR ${e.sector}`, 'cyan');
            else if (e.type === 'grinner') this.banner('THE GRINNER!');
            else if (e.type === 'over') {
                $('over-title').textContent = e.win ? 'You Escaped!' : 'Game Over';
                $('over-text').innerHTML = '';
                const lines = [
                    ['Score', String(G.score).padStart(6, '0')],
                    ['Survived', `${clock(Math.min(G.t, ROUND.seconds))} · sector ${G.sector}`],
                    ['Robots wrecked', String(G.kills)],
                    ['Level', String(G.level)],
                ];
                for (const [k, v] of lines) {
                    const row = document.createElement('div');
                    row.className = 'row';
                    row.innerHTML = '<span class="dim"></span><b></b>';
                    row.firstChild.textContent = k;
                    row.lastChild.textContent = v;
                    $('over-text').appendChild(row);
                }
            }
        }
    }
}
