// The DOM layer: screens, the HUD, banners, settings and the touch deck. Reads the sim; never changes it.

import { VERSION, LIVES } from './config.js';
import { LEVELS, PERKS, CHARS, CHAR_IDS } from './sim/data.js';
import { destroyedFrac } from './sim/game.js';
import { loadBest } from './save.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const CHAIN_WORDS = ['NICE!', 'SMASH!', 'RAMPAGE!', 'MAYHEM!', 'KAIJU!', 'UNSTOPPABLE!'];

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.lastCombo = 0;
        this.lastHp = 0;
        this.waveSeen = {};
        $('version').textContent = 'v' + VERSION;
        this.refreshBest();

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

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), shake = $('set-shake'), outline = $('set-outline');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; shake.value = String(settings.shake); outline.value = settings.outline === false ? '0' : '1';
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, shake: +shake.value, outline: outline.value === '1' });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, shake, outline]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    refreshBest() {
        const b = loadBest();
        $('best').textContent = b.score ? `Best: ${fmt(b.score)}  ·  City ${b.level + 1}` : '';
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another stacks on top of it: later in the stack, higher z-index
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        $(id).style.zIndex = '';
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        else document.activeElement?.blur?.();       // a focused button would swallow Space for the whole game
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on;
        this.setTouch(this.touchOn, on);
        if (!on) { $('arrow').hidden = true; $('banner').textContent = ''; }
    }

    hud(G, view) {
        const b = G.ball, L = LEVELS[G.level];
        $('hud-score').textContent = fmt(G.score);
        const hpPct = Math.max(0, b.hp / b.maxHp);
        $('bar-hp').style.width = (hpPct * 100).toFixed(1) + '%';
        $('hp-text').textContent = Math.ceil(b.hp);
        document.querySelector('.bar.hp').classList.toggle('low', hpPct < 0.3);
        $('lives').textContent = '♥'.repeat(Math.max(0, G.lives)) + '♡'.repeat(Math.max(0, LIVES - G.lives));
        $('hud-size').textContent = Math.round(b.r * 12) + ' m';
        const frac = destroyedFrac(G);
        $('bar-city').style.width = (Math.min(1, frac) * 100).toFixed(1) + '%';
        $('goal-mark').style.left = `calc(${L.goal * 100}% - 1px)`;
        $('city-text').textContent = `City ${Math.round(frac * 100)}%  ·  goal ${Math.round(L.goal * 100)}%`;
        const c = $('hud-combo');
        if (G.combo.n >= 5) {
            const mult = Math.min(6, 1 + Math.floor(G.combo.n / 10));
            c.hidden = false;
            c.textContent = `x${mult} · ${Math.min(999, Math.floor(G.combo.n))}`;
            c.title = 'Chain';
            if (Math.floor(G.combo.n) !== this.lastCombo) { c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
        } else c.hidden = true;
        this.lastCombo = Math.floor(G.combo.n);
        const pw = [];
        if (G.power.fire > 0) pw.push(`🔥 ${Math.ceil(G.power.fire)}`);
        if (G.power.magnet > 0) pw.push(`🧲 ${Math.ceil(G.power.magnet)}`);
        if (G.power.shield > 0) pw.push(`🛡️ ${Math.ceil(G.power.shield)}`);
        const html = pw.map((s) => `<span>${s}</span>`).join('');
        if (this.pwHtml !== html) { $('powers').innerHTML = html; this.pwHtml = html; }
        // pounce cooldown on the touch button
        const cd = Math.min(1, b.cd / 1.05);
        $('cd-ring').style.strokeDashoffset = String(226 * cd);
        $('btn-a').classList.toggle('cool', cd > 0.02);
        this.arrow(G, view, frac, L);
    }

    /** An arrow to the nearest standing building when none is on screen. */
    arrow(G, view, frac, L) {
        const el = $('arrow');
        if (!view || frac < 0.45 || G.phase !== 'play') { el.hidden = true; return; }
        const b = G.ball;
        let best = null, bd = Infinity;
        for (const o of G.buildings) {
            if (o.dead || o.t === 'deck') continue;
            const d = Math.hypot(o.x - b.x, o.y - b.y);
            if (d < bd) { bd = d; best = o; }
        }
        if (!best) { el.hidden = true; return; }
        const p = view.worldToScreen(best.x, best.y, 1);
        const w = innerWidth, h = innerHeight;
        const inside = p.x > 30 && p.x < w - 30 && p.y > 110 && p.y < h - 40 && !p.behind;
        if (inside) { el.hidden = true; return; }
        const c = view.worldToScreen(b.x, b.y, 1);
        let dx = p.x - c.x, dy = p.y - c.y;
        if (p.behind) { dx = -dx; dy = -dy; }
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        // walk from the monster along the ray until the screen edge (inset)
        const x0 = 36, x1 = w - 36, y0 = 120, y1 = h - 70;
        let t = Infinity;
        if (dx > 0) t = Math.min(t, (x1 - c.x) / dx); else if (dx < 0) t = Math.min(t, (x0 - c.x) / dx);
        if (dy > 0) t = Math.min(t, (y1 - c.y) / dy); else if (dy < 0) t = Math.min(t, (y0 - c.y) / dy);
        el.hidden = false;
        el.style.left = (c.x + dx * t) + 'px';
        el.style.top = (c.y + dy * t) + 'px';
        el.firstElementChild.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI + 90}deg)`;
        $('arrow-dist').textContent = Math.round(bd) + ' m';
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
    banner(text, cls = '') {
        const el = $('banner');
        el.innerHTML = '';
        const b = document.createElement('b');
        b.textContent = text;
        if (cls) b.className = cls;
        el.appendChild(b);
        // announce for screen readers, too
        window.A11Y?.announce?.(text);
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'combo': this.banner(CHAIN_WORDS[Math.min(CHAIN_WORDS.length - 1, Math.floor(e.n / 10) - 1)], 'gold'); break;
                case 'wave':
                    if (e.k === 'tank' && !this.waveSeen.tank) { this.waveSeen.tank = 1; this.banner('THE ARMY ARRIVES!', 'warn'); }
                    else if (e.k === 'heli' && !this.waveSeen.heli) { this.waveSeen.heli = 1; this.banner('CHOPPERS! POUNCE THEM!', 'warn'); }
                    break;
                case 'warn': this.banner('BOMBER INCOMING!', 'warn'); break;
                case 'hurt': { const h = $('hurt'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); break; }
                case 'die': this.banner('OUCH!', 'warn'); break;
                case 'respawn': this.banner('BACK IN THE BALL!', 'good'); break;
                case 'power': break;
                case 'level': this.waveSeen = {}; break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ choose a monster
    /** thumbs: { id: dataURL }. onPick(id) is called when a card is chosen. last: the one chosen last time. */
    showChoose(thumbs, onPick, last = 'reptile') {
        const rate = (v) => Math.max(1, Math.min(5, Math.round(3 + (v - 1) * 8)));
        const dots = (n) => '●'.repeat(n) + '<s>' + '●'.repeat(5 - n) + '</s>';
        const host = $('chars');
        host.innerHTML = '';
        for (const id of CHAR_IDS) {
            const C = CHARS[id];
            const btn = document.createElement('button');
            btn.className = 'char' + (id === last ? ' last' : '');
            btn.dataset.id = id;
            btn.innerHTML = `<img alt="" src="${thumbs?.[id] || ''}"><b>${C.name}</b><i>${C.kind}</i><em>${C.blurb}</em>`
                + `<div class="stats"><div class="stat"><span>Tough</span><span class="dots">${dots(rate(1 + C.hp / 100 * 2))}</span></div>`
                + `<div class="stat"><span>Agile</span><span class="dots">${dots(rate(C.accel))}</span></div>`
                + `<div class="stat"><span>Power</span><span class="dots">${dots(rate(C.dmg))}</span></div>`
                + `<div class="stat"><span>Pounce</span><span class="dots">${dots(rate(1 / C.cd))}</span></div></div>`;
            btn.addEventListener('click', () => { this.audio.ui('click'); onPick(id); });
            host.appendChild(btn);
        }
        this.openScreen('choose');
        host.querySelector(`[data-id="${last}"]`)?.focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ level screens
    showIntro(G) {
        const L = LEVELS[G.level];
        $('intro-num').textContent = `City ${G.level + 1} of ${LEVELS.length}`;
        $('intro-name').textContent = L.name;
        $('intro-blurb').textContent = L.blurb;
        const army = [];
        if (L.mil.tank[2]) army.push('tanks');
        if (L.mil.heli[2]) army.push('helicopters');
        if (L.mil.jet[0] < 9000) army.push('bombers');
        $('intro-goal').textContent = `Flatten ${Math.round(L.goal * 100)}% of the city. Expect ${army.join(', ')}. Par time ${clock(L.par)}.`;
        this.openScreen('intro');
    }

    /** Fill and open the "city flattened" sheet. onPerk(id) is called once, when a gift is chosen. */
    showClear(G, onPerk) {
        const c = G.clear, L = LEVELS[c.level];
        $('clear-name').textContent = L.name;
        $('clear-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < c.stars ? 'on' : 'off'}" style="animation-delay:${i * 0.18}s">★</span>`).join('');
        const rows = [
            ['Time', `${clock(c.time)}  (par ${clock(L.par)})`],
            ['City destroyed', `${Math.round(c.frac * 100)}%`],
            ['Things swallowed', fmt(G.stats.eaten)],
            ['Army smashed', fmt(G.stats.smashed)],
            ['Best chain', fmt(c.best)],
            ['Score this city', fmt(c.score)],
            ['Total score', fmt(G.score)],
        ];
        $('clear-stats').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
        const perks = $('perks');
        perks.classList.remove('done');
        perks.innerHTML = '';
        $('clear-next').disabled = true;
        for (let i = 0; i < 3; i++) {
            const P = PERKS[(c.level * 2 + i) % PERKS.length];
            const btn = document.createElement('button');
            btn.className = 'perk';
            btn.dataset.id = P.id;
            btn.innerHTML = `<span>${P.icon}</span><b>${P.name}</b><em>${P.desc}</em>`;
            btn.addEventListener('click', () => {
                if (perks.classList.contains('done')) return;
                perks.classList.add('done');
                btn.classList.add('picked');
                $('clear-next').disabled = false;
                this.audio.ui('perk');
                onPerk(P.id);
                this.focusFirst('clear');
                $('clear-next').focus();
            });
            perks.appendChild(btn);
        }
        this.openScreen('clear');
    }

    showOver(G, won, newBest) {
        $('over-title').textContent = won ? 'KAIJU CHAMPION!' : 'Out of lives';
        const reached = LEVELS[Math.min(G.level, LEVELS.length - 1)].name;
        $('over-text').textContent = won
            ? `Every city is rubble and the army has gone home. Final score ${fmt(G.score)}.${newBest ? ' A new best!' : ''}`
            : `You rolled as far as ${reached} (city ${G.level + 1} of ${LEVELS.length}) and scored ${fmt(G.score)}.${newBest ? ' A new best!' : ''}`;
        this.openScreen('over');
    }
}
