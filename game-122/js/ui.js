// The DOM layer: screens, the HUD, toasts, settings, postcards and the album. Reads the sim;
// never changes it.

import { VERSION, PANE } from './config.js';
import { STATIONS, CURIOS, CURIO_COUNT, paneCurios } from './sim/scenes.js';
import { clearedFrac, albumCount } from './sim/game.js';
import { paintScene } from './view/painter.js';

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.hudKey = '';
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
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), rain = $('set-rain'), touch = $('set-touch'), grain = $('set-grain');
        sfx.value = settings.sfx; music.value = settings.music; rain.value = settings.rain; touch.value = settings.touch; grain.checked = !!settings.grain;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, rain: +rain.value, touch: touch.value, grain: grain.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, rain, touch]) { el.addEventListener('change', changed); el.addEventListener('input', changed); }
        grain.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Journey and album deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        el.style.zIndex = 50 + this.stack.length;      // a screen opened from another goes on top of it
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
    isOpen(id) { return this.stack.includes(id); }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter and Space are the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); if (!on) $('journal').hidden = true; }
    hud(G, view) {
        // portrait phones have room under the window for the station's line and its curios
        const p = view?.pane;
        const room = p ? view.h - (p.y + p.h + p.sill + 16) - 110 : 0;
        const jr = $('journal');
        jr.hidden = !(p && view.h > view.w && room > 90);
        if (!jr.hidden) {
            jr.style.top = `${Math.round(p.y + p.h + p.sill + 14)}px`;
            const jkey = `${G.station}:${G.late}:${G.found.join()}`;
            if (jkey !== this.jkey) {
                this.jkey = jkey;
                $('jr-line').textContent = G.late ? 'Back round in the small hours. Something new is out there.' : STATIONS[G.station].line;
                $('jr-list').innerHTML = paneCurios(G.station, G.late).map((c) => G.found.includes(c.id)
                    ? `<li class="on">${c.name}</li>` : `<li>${c === STATIONS[G.station].rare ? '☾ something rare' : 'something out there…'}</li>`).join('');
            }
        }
        const s = STATIONS[G.station];
        const list = paneCurios(G.station, G.late);
        const key = `${G.station}:${G.late}:${G.found.length}:${G.flowLevel}`;
        if (key !== this.hudKey) {
            this.hudKey = key;
            $('hud-station').textContent = s.name + (G.late ? ' · small hours' : '');
            $('hud-pips').innerHTML = list.map((c) => `<span class="${G.found.includes(c.id) ? 'on' : ''}${c === s.rare ? ' rare' : ''}">${c === s.rare ? '☾' : '●'}</span>`).join('');
            $('hud-flow').innerHTML = [1, 2, 3].map((i) => `<span class="${G.flowLevel >= i ? 'on' : ''}">~</span>`).join('');
        }
        $('hud-clear-fill').style.width = `${Math.min(100, clearedFrac(G) / PANE.complete * 100)}%`;
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
        setTimeout(() => el.remove(), 3100);
        window.A11Y?.announce?.(text);
    }
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'pane') this.newIds = [];
            if (e.type === 'spot' && e.fresh) (this.newIds ||= []).push(e.id);
            // the view writes spotted curios on the glass; this only reads them out
            if (e.type === 'spot') window.A11Y?.announce?.(`Spotted ${e.name}`);
            else if (e.type === 'flow' && e.level === 3) this.toast('in the flow');
            else if (e.type === 'albumComplete') this.toast('The album is complete. Every curio, every station.');
        }
    }

    // ------------------------------------------------------------------ postcard
    showPostcard(G, e) {
        const s = STATIONS[e.station];
        const art = $('pc-art').getContext('2d');
        art.drawImage(paintScene(e.station, e.late, (G.paneSeed % 97) + 1), 0, 0);
        $('pc-name').textContent = s.name + (e.late ? ' · small hours' : '');
        $('pc-line').textContent = e.late ? 'The train came back round. Something new was out there.' : s.line;
        $('pc-seal').hidden = !e.seal;
        const list = paneCurios(e.station, e.late);
        $('pc-found').innerHTML = list.map((c) => {
            const self = e.selfFound.includes(c.id);
            const isNew = this.newIds?.includes(c.id);
            return `<li class="${self ? 'self' : ''} ${isNew ? 'new' : ''}">${c.name}</li>`;
        }).join('');
        $('pc-stats').textContent = `${fmtTime(e.time)} at the window · ${G.stats.drops} drop${G.stats.drops === 1 ? '' : 's'} · ${e.seal ? 'gold seal: you spotted everything yourself' : `${e.selfFound.length} of ${list.length} spotted before the mist melted`}`;
        $('pc-next').textContent = e.last ? 'Arrive' : 'Next station';
        this.openScreen('postcard');
    }

    showEnding(G) {
        $('end-head').textContent = 'Morning';
        $('end-text').textContent = `Dawn Terminus. The rain has thinned to nothing and the light comes in gold. Eight postcards, written and stamped, ${albumCount(G)} curios between them. The guard says the train runs back round tonight, through the small hours, past every station again. There are things out there you have not seen yet.`;
        this.openScreen('ending');
    }

    // ------------------------------------------------------------------ album
    showAlbum(G) {
        const album = G?.album || {};
        $('album-count').textContent = `${G ? albumCount(G) : 0} / ${CURIO_COUNT} curios`;
        const grid = $('album-grid');
        grid.innerHTML = '';
        STATIONS.forEach((s, i) => {
            const a = album[s.id];
            const card = document.createElement('div');
            card.className = 'acard' + (a ? '' : ' locked');
            if (!a) {
                card.innerHTML = `<div class="mist">misted</div><div class="an">Stop ${i + 1}</div><ul><li class="no">· · ·</li></ul>`;
            } else {
                const c = document.createElement('canvas');
                c.width = 240; c.height = 180;
                c.getContext('2d').drawImage(paintScene(i, false, 1), 0, 0, 240, 180);
                card.appendChild(c);
                const name = document.createElement('div');
                name.className = 'an'; name.textContent = s.name;
                card.appendChild(name);
                const ul = document.createElement('ul');
                for (const cu of [...s.curios, s.rare]) {
                    const li = document.createElement('li');
                    const got = a.found.includes(cu.id);
                    const rare = cu === s.rare;
                    li.className = (got ? '' : 'no') + (rare ? ' rare' : '');
                    li.textContent = got ? (rare ? '☾ ' : '') + CURIOS[cu.id].name : rare ? '☾ only in the small hours' : '· · ·';
                    ul.appendChild(li);
                }
                card.appendChild(ul);
                if (a.seal) { const seal = document.createElement('div'); seal.className = 'seal'; seal.textContent = '✦'; card.appendChild(seal); }
            }
            grid.appendChild(card);
        });
        this.openScreen('album');
    }
}
