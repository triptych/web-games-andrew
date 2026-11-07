// The DOM layer: screens, the HUD, toasts, settings and the touch deck. Reads the sim; never changes it.

import { VERSION } from './config.js';
import { current, totalStars } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const stars = (n) => '★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span>';

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.hudIdx = -1;
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
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // each screen opened from another sits on top of it
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        $(id).style.zIndex = '';
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

    // ------------------------------------------------------------------ commission screens
    showBrief(G, first) {
        const c = current(G);
        $('brief-emoji').textContent = c.client.emoji;
        $('brief-name').textContent = c.client.name;
        $('brief-role').textContent = c.client.role;
        $('brief-count').textContent = `Commission ${G.idx + 1} of ${G.commissions.length}`;
        $('brief-heading').textContent = c.title;
        $('brief-quote').textContent = `“${c.quote}”`;
        $('brief-text').textContent = c.brief;
        $('brief-judged').textContent = c.judged;
        const r = c.region;
        $('brief-facts').textContent = `The shaded country is ${r.w} × ${r.h} cells. You have ${c.time} seconds.`;
        $('brief-go').textContent = first ? 'Begin' : 'Back to the map';
    }

    showConfirm(G) {
        const c = current(G);
        $('confirm-text').textContent = `${c.client.name} will use the chart exactly as it stands, with ${Math.ceil(G.timeLeft)} seconds still on the clock.`;
    }

    showResult(G) {
        const r = G.result;
        $('result-stars').innerHTML = stars(r.stars);
        $('result-stars').setAttribute('aria-label', `${r.stars} of 3 stars`);
        $('result-heading').textContent = r.headline;
        const ul = $('result-lines');
        ul.textContent = '';
        for (const line of r.lines) { const li = document.createElement('li'); li.textContent = line; ul.appendChild(li); }
        $('result-points').textContent = r.stars ? `+${r.points} points (${r.timeLeft}s left)` : 'No payment this time.';
        $('result-next').textContent = G.idx + 1 >= G.commissions.length ? 'Finish the season' : `Next: ${G.commissions[G.idx + 1].client.name}`;
    }

    showOver(G, rank, isBest) {
        const ev = totalStars(G);
        $('over-rank').textContent = rank || '';
        $('over-text').textContent = `${ev} of ${G.commissions.length * 3} stars · ${G.points} points${isBest ? ' · a new best!' : ''}`;
        const ol = $('over-list');
        ol.textContent = '';
        G.commissions.forEach((c, i) => {
            const li = document.createElement('li');
            const r = G.results[i];
            li.textContent = `${c.client.name}: ${'★'.repeat(r ? r.stars : 0)}${'☆'.repeat(3 - (r ? r.stars : 0))} ${c.title}`;
            ol.appendChild(li);
        });
    }

    showBest(best) {
        const el = $('best');
        el.hidden = !best;
        if (best) el.textContent = `Best season: ${best.points} points · ${best.rank}`;
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    hud(G) {
        if (this.hudIdx !== G.idx) {
            this.hudIdx = G.idx;
            const c = current(G);
            $('hud-title').textContent = c.title;
        }
        const c = current(G);
        const t = Math.max(0, Math.ceil(G.timeLeft));
        const el = $('hud-time');
        if (el.textContent !== String(t)) el.textContent = t;
        el.classList.toggle('low', t <= 10);
        const found = $('hud-found');
        const txt = c.targets ? `${c.targets.filter((id) => G.found.includes(id)).length}/${c.targets.length}` : '';
        if (found.textContent !== txt) found.textContent = txt;
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
}
