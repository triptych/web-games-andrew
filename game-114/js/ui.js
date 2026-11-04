// The DOM layer: screens, the HUD, banners, toasts, settings and the touch deck. Reads the sim;
// never changes it.

import { VERSION, WEAPONS, BOSSES } from './config.js';
import { LEVELS, LARDER_COLONISTS } from './sim/levels.js';
import { maxHp } from './sim/game.js';
import { INTRO, BRIEFS, ending } from './sim/data/story.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.hudKey = '';
        $('version').textContent = 'v' + VERSION + ' · a run-and-gun in three.js';

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

        const ids = ['sfx', 'music', 'touch', 'quality', 'shake', 'autofire', 'hard'];
        const el = Object.fromEntries(ids.map((k) => [k, $('set-' + k)]));
        for (const k of ids) el[k].value = String(settings[k]);
        const changed = () => {
            Object.assign(settings, {
                sfx: +el.sfx.value, music: +el.music.value, touch: el.touch.value, quality: +el.quality.value,
                shake: el.shake.value, autofire: el.autofire.value, hard: el.hard.value,
            });
            onSettings(settings);
        };
        for (const k of ids) el[k].addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another one sits on top of it
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
        el.querySelector('.sheet')?.scrollTo?.(0, 0);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ story screens
    showStory() {
        $('story-text').innerHTML = INTRO.map((p) => `<p>${esc(p)}</p>`).join('');
        this.openScreen('story');
    }
    showBrief(idx) {
        const L = LEVELS[idx], B = BRIEFS[idx];
        $('brief-place').textContent = `SECTOR ${idx + 1} OF ${LEVELS.length} · ${L.place}`;
        $('brief-name').textContent = L.name;
        $('brief-speaker').textContent = B.speaker + ':';
        $('brief-text').innerHTML = `<p>${esc(B.text)}</p><p class="sub">Colonist pods in this sector: ${L.pods}.${L.end !== 'exit' ? ' Something big is waiting at the end.' : ''}</p>`;
        this.openScreen('brief');
    }
    showClear(t) {
        $('clear-name').textContent = t.name;
        const row = (a, b) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`;
        $('clear-table').innerHTML = [
            row('Colonists freed', `${t.pods} / ${t.podsTotal}`),
            row('Time', `${Math.floor(t.time / 60)}:${String(t.time % 60).padStart(2, '0')}`),
            row('Sector clear', `+${t.clear}`),
            t.podBonus ? row('Every pod opened', `+${t.podBonus}`) : '',
            t.noDeath ? row('No lives lost', `+${t.noDeath}`) : '',
            `<tr class="total"><td>Bonus</td><td class="num">+${t.total}</td></tr>`,
        ].join('');
        this.openScreen('clear');
    }
    showOver(G) {
        $('over-text').textContent = `You fell in ${LEVELS[G.levelIdx].name}. Score ${G.score.toLocaleString()}. Continue from the start of the sector with the score you entered it with.`;
        this.openScreen('over');
    }
    showEnding(G) {
        const total = G.rescued.reduce((a, b) => a + b, 0);
        const all = LEVELS.reduce((a, l) => a + l.pods, 0);
        const E = ending(total, all);
        $('ending-head').textContent = E.title;
        $('ending-text').innerHTML = E.text.map((p) => `<p>${esc(p)}</p>`).join('');
        const row = (a, b) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`;
        $('ending-table').innerHTML = [
            row('Colonists freed on the way', `${total} / ${all}`),
            row('Freed from the Larder', LARDER_COLONISTS),
            row('Hive creatures destroyed', G.stats.kills),
            row('Lives lost', G.stats.deaths),
            row('Continues', G.stats.continues),
            `<tr class="total"><td>Final score${G.hard ? ' (Hard)' : ''}</td><td class="num">${G.score.toLocaleString()}</td></tr>`,
        ].join('');
        this.openScreen('ending');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; if (!on) { $('boss').hidden = true; } this.setTouch(this.touchOn, on); }
    hud(G) {
        const p = G.player;
        const max = maxHp(G);
        const key = [p.hp, max, G.lives, p.weapon, p.flares, G.score, G.rescued[G.levelIdx], G.pods.length].join('|');
        if (key !== this.hudKey) {
            this.hudKey = key;
            let pips = '';
            for (let i = 0; i < max; i++) pips += `<span class="pip${i < p.hp ? '' : ' off'}"></span>`;
            $('hud-hp').innerHTML = pips;
            $('hud-lives').textContent = '♥×' + Math.max(0, G.lives);
            const w = $('hud-weapon');
            w.textContent = WEAPONS[p.weapon].name.toUpperCase();
            w.className = 'chip ' + p.weapon;
            $('hud-flares').textContent = '✦' + p.flares;
            $('hud-score').textContent = G.score.toLocaleString();
            $('hud-pods').textContent = `◉ ${G.rescued[G.levelIdx]}/${G.pods.length}`;
        }
        const B = G.boss;
        const show = !!B && !B.dead && B.state !== 'intro' || (B && B.state === 'intro' && B.st < 1);
        $('boss').hidden = !show;
        if (show) {
            $('boss-name').textContent = BOSSES[B.k].name;
            $('boss-fill').style.width = `${Math.max(0, B.hp / B.maxHp) * 100}%`;
        }
    }
    banner(a, b, cls = '') {
        const el = $('banner');
        el.hidden = true;
        void el.offsetWidth;          // restart the animation
        el.className = cls;
        $('banner-a').textContent = a;
        $('banner-b').textContent = b;
        el.hidden = false;
        clearTimeout(this.bannerT);
        this.bannerT = setTimeout(() => { el.hidden = true; }, 3000);
        window.A11Y?.announce?.(`${a}. ${b}`);
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
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 2500);
    }
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'pickup':
                    if (e.k === 'med') this.toast('Med kit: health restored');
                    else if (e.k === 'flare') this.toast('+2 flares');
                    else this.toast(`${WEAPONS[e.k].name} picked up`);
                    break;
                case 'rescue': this.toast(`Colonist freed (${e.n}/${G.pods.length})`); break;
                case 'checkpoint': this.toast('Checkpoint'); break;
                case 'extraLife': this.toast('Extra life!'); break;
                case 'bossIntro': this.banner(e.name, 'WARNING', 'boss'); break;
                case 'supply': this.toast('KESTREL: med kit incoming!'); break;
                default: break;
            }
        }
    }
}
