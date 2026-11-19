// The DOM layer: screens, the map of castles, the HUD, the ammo rack, toasts and settings.
// Reads the sim; never changes it (the rack and the buttons go through callbacks to main.js).

import { VERSION, AMMO, AMMO_ORDER } from './config.js';
import { LEVELS, REGIONS } from './sim/levels.js';
import { loadProgress, unlocked, totalStars } from './save.js';

const $ = (id) => document.getElementById(id);
const PORTRAIT = { knight: 'cast-knight', king: 'cast-king', wizard: 'cast-wizard', prince: 'cast-prince', pip: 'cast-pip' };
const ICON = { knight: '🛡️', king: '👑', wizard: '🧙' };

/** Who stars on a castle's intro card: its most important resident. */
export function castleStar(level) {
    const L = LEVELS[level];
    if (L.id === 'palace') return 'prince';
    const src = L.build.toString();
    if (src.includes("'king'")) return 'king';
    if (src.includes("'wizard'")) return 'wizard';
    return 'knight';
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onAmmo, onPickLevel }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.onAmmo = onAmmo;
        this.onPickLevel = onPickLevel;
        $('version').textContent = 'v' + VERSION + ' · art by fal · sound by ElevenLabs';

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

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), follow = $('set-follow'), touch = $('set-touch');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; follow.checked = settings.follow; touch.value = settings.touch;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, follow: follow.checked, touch: touch.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, follow, touch]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game and stars forgotten.'); });

        // the ammo rack: built once, refreshed from G
        this.rackBtns = {};
        for (const k of AMMO_ORDER) {
            const b = document.createElement('button');
            b.className = 'rack-btn';
            b.dataset.ammo = k;
            b.setAttribute('aria-label', AMMO[k].name);
            b.title = AMMO[k].name;
            b.innerHTML = `<span class="ball ${k}"></span><span class="n">0</span>`;
            // finger-down picks at once; the click from the same press is ignored
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); onAmmo(k); });
            b.addEventListener('click', (e) => { if (!e.detail) onAmmo(k); });
            $('rack').appendChild(b);
            this.rackBtns[k] = b;
        }
        this.hudKey = '';
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another screen goes on top of it
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0); }
    focusFirst(id) {
        const list = this.buttons(id);
        const pick = list.find((b) => b.classList.contains('primary')) || list[0];
        pick?.focus({ preventScroll: true });
    }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ map and intro
    buildMap() {
        const P = loadProgress();
        const list = $('map-list');
        list.innerHTML = '';
        for (const [rid, R] of Object.entries(REGIONS)) {
            const sec = document.createElement('section');
            sec.className = 'region';
            sec.innerHTML = `<div class="region-banner" style="background-image:url('art/region-${rid}.webp')"><h3 class="outline">${R.name}</h3></div><div class="region-levels"></div>`;
            const box = sec.querySelector('.region-levels');
            LEVELS.forEach((L, i) => {
                if (L.region !== rid) return;
                const st = P.stars[L.id] || 0;
                const b = document.createElement('button');
                b.className = 'lvl';
                b.dataset.level = String(i);
                b.disabled = !unlocked(i);
                b.innerHTML = `<span class="num">Castle ${i + 1}${b.disabled ? ' · 🔒' : ''}</span><b>${L.name}</b><span class="st">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span>`;
                b.addEventListener('click', () => { this.audio.ui('click'); this.onPickLevel(i); });
                box.appendChild(b);
            });
            list.appendChild(sec);
        }
        $('map-stars').textContent = `★ ${totalStars()} / ${LEVELS.length * 3}`;
    }

    showIntro(level) {
        const L = LEVELS[level];
        const who = castleStar(level);
        $('intro-portrait').src = `art/${PORTRAIT[who]}.webp`;
        $('intro-portrait').alt = who;
        $('intro-region').textContent = `${REGIONS[L.region].name} · Castle ${level + 1}`;
        $('intro-name').textContent = L.name;
        $('intro-text').textContent = L.intro;
        $('intro-ammo').innerHTML = AMMO_ORDER.filter((k) => L.ammo[k]).map((k) => `<span><i class="ball ${k}"></i>${L.ammo[k]} × ${AMMO[k].name}</span>`).join('');
        this.openScreen('intro');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on) { this.touchOn = on; }

    hud(G) {
        const chars = G.W.bodies.filter((b) => b.kind === 'char');
        const key = `${G.score}|${G.level}|${G.sel}|${JSON.stringify(G.ammo)}|${chars.map((c) => c.role[0] + (c.bonked ? 0 : 1)).join('')}|${G.targets - G.bonked}`;
        if (key !== this.hudKey) {
            this.hudKey = key;
            $('hud-score').textContent = G.score.toLocaleString();
            $('hud-castle').textContent = LEVELS[G.level].name;
            // one token per resident: standing ones bright, bonked ones faded
            const standing = chars.filter((c) => !c.bonked);
            const down = G.targets - standing.length;
            $('hud-knights').innerHTML = standing.map((c) => `<span>${ICON[c.role]}</span>`).join('') + '<span class="down">🛡️</span>'.repeat(Math.max(0, Math.min(6, down)));
            for (const k of AMMO_ORDER) {
                const b = this.rackBtns[k], n = G.ammo[k] || 0;
                b.hidden = !(k in LEVELS[G.level].ammo);
                b.disabled = n === 0;
                b.classList.toggle('sel', G.sel === k);
                b.querySelector('.n').textContent = n;
            }
        }
        // the fire button says what a tap does right now
        const trick = G.W.bodies.find((b) => b.kind === 'ball' && b.live && !b.tricked && AMMO[b.ammo].special);
        const fire = $('btn-fire');
        let hint = '';
        if (trick) {
            fire.textContent = AMMO[trick.ammo].special === 'split' ? 'SPLIT!' : 'BOOM!';
            fire.className = 'fire trick';
            hint = AMMO[trick.ammo].special === 'split' ? 'Tap to split!' : 'Tap to go off early!';
        } else {
            fire.textContent = 'FIRE';
            fire.className = G.reload > 0 || G.state !== 'aim' || !G.sel ? 'fire wait' : 'fire';
            if (G.shots === 0) hint = this.touchOn ? 'Drag to aim · tap to fire' : 'Drag or arrows to aim · Space to fire';
        }
        const h = $('hud-hint');
        if (h.textContent !== hint) h.textContent = hint;
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    // ------------------------------------------------------------------ results
    showResult(G, e, best) {
        const won = e.won;
        $('res-head').textContent = won ? 'Castle Cleared!' : 'Out of Cannonballs!';
        $('res-portrait').src = `art/${won ? 'cast-pip' : PORTRAIT[castleStar(G.level)]}.webp`;
        $('res-text').textContent = won
            ? (e.spare ? `${e.spare} spare ball${e.spare > 1 ? 's' : ''}: +${e.bonus.toLocaleString()}!` : 'Every last one of them bonked!') + (best ? ' New best!' : '')
            : `${G.targets - G.bonked} still standing. Have another go!`;
        $('res-score').textContent = G.score.toLocaleString();
        $('res-stars').hidden = !won;
        const stars = [...$('res-stars').children];
        stars.forEach((s) => s.classList.remove('on'));
        if (won) stars.forEach((s, i) => { if (i < e.stars) setTimeout(() => { s.classList.add('on'); this.audio.play('star', { vol: 0.7, rate: 1 + i * 0.12, gap: 0 }); }, 500 + i * 380); });
        const next = $('res-next');
        next.hidden = !won || G.level >= LEVELS.length - 1;
        $('over-again').classList.toggle('primary', !won || next.hidden);
        this.openScreen('over');
    }

    onEvents() { /* results come through showResult */ }
}
