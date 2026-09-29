/**
 * ui.js — DOM HUD, banners and screens. The markup lives in index.html; this
 * module only reads the world each frame (with dirty checks) and toggles CSS.
 *
 * Public API:
 *   initUI(handlers)               — wire buttons: { start, resume, quit, again, menu, mute, pause }
 *   showScreen(name)               — 'title' | 'pause' | 'over' | null
 *   updateHUD(w, dt, playing)
 *   banner(text, opts)             — big centre text: { sub, color, life, small, glitch }
 *   showGameOver(w, best, isNew)
 *   setBest(n), setMuted(bool)
 */

import { PICKUPS, POWER_DURATION, RULES } from './config.js';
import { comboMult } from './sim/world.js';

const $ = (id) => document.getElementById(id);
let el;
let shownScore = 0;
let last = {};
const powerEls = new Map();

export function initUI(h) {
    el = {
        hud: $('hud'), score: $('score-val'), waveNum: $('wave-num'), waveName: $('wave-name'),
        brickFill: $('brick-fill'), balls: $('balls-val'),
        combo: $('combo'), comboMult: $('combo-mult'), comboCount: $('combo-count'), comboFill: $('combo-timer-fill'),
        powers: $('powers'), save: $('save-lamp'), plunger: $('plunger-hint'), plungerFill: $('plunger-fill'),
        plungerText: $('plunger-text'),
        banners: $('banners'),
        title: $('title'), pause: $('pause'), over: $('over'),
        best: $('best-val'), finalScore: $('final-score'), finalNew: $('final-new'), finalStats: $('final-stats'),
        mute: $('mute-btn'), pauseBtn: $('pause-btn'),
    };
    const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    on('start-btn', h.start);
    on('resume-btn', h.resume);
    on('quit-btn', h.quit);
    on('again-btn', h.again);
    on('menu-btn', h.menu);
    on('mute-btn', h.mute);
    on('pause-btn', h.pause);
    // Keep taps on buttons from also reaching the flipper handlers.
    for (const b of document.querySelectorAll('button')) {
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    if (window.matchMedia?.('(pointer: coarse)').matches) {
        el.plungerText.textContent = 'HOLD · RELEASE TO LAUNCH';
    }
}

export function showScreen(name) {
    el.title.classList.toggle('hidden', name !== 'title');
    el.pause.classList.toggle('hidden', name !== 'pause');
    el.over.classList.toggle('hidden', name !== 'over');
    el.hud.classList.toggle('hidden', name === 'title');
    el.pauseBtn.classList.toggle('hidden', name !== null);
    const btn = { title: 'start-btn', pause: 'resume-btn', over: 'again-btn' }[name];
    if (btn) setTimeout(() => $(btn)?.focus({ preventScroll: true }), 50);
}

export function setBest(n) { el.best.textContent = n.toLocaleString('en-US'); }
export function setMuted(m) { el.mute.classList.toggle('off', m); }

export function resetHUD() {
    shownScore = 0;
    last = {};
    for (const [, e] of powerEls) e.remove();
    powerEls.clear();
    el.banners.innerHTML = '';
}

export function updateHUD(w, dt) {
    // Score counts up quickly toward the real value.
    if (shownScore !== w.score) {
        const diff = w.score - shownScore;
        shownScore += Math.ceil(Math.abs(diff) * Math.min(1, dt * 12)) * Math.sign(diff);
        if (Math.abs(w.score - shownScore) < 3) shownScore = w.score;
        el.score.textContent = shownScore.toLocaleString('en-US');
    }

    if (last.wave !== w.wave) {
        last.wave = w.wave;
        el.waveNum.textContent = `WAVE ${w.wave}`;
        el.waveName.textContent = w.waveName;
        last.total = w.bricks.length;
    }
    const frac = last.total ? w.bricksLeft / last.total : 0;
    if (last.frac !== frac) { last.frac = frac; el.brickFill.style.width = `${(frac * 100).toFixed(1)}%`; }

    if (last.lives !== w.lives) {
        const prev = last.lives ?? w.lives;
        last.lives = w.lives;
        el.balls.innerHTML = '';
        for (let i = 0; i < Math.max(w.lives, prev); i++) {
            const d = document.createElement('div');
            d.className = 'ball-dot' + (i >= w.lives ? ' lost' : '');
            el.balls.appendChild(d);
        }
    }

    // Combo meter
    const mult = comboMult(w);
    const showCombo = w.combo >= 2;
    el.combo.classList.toggle('hidden', !showCombo);
    if (showCombo) {
        if (last.mult !== mult) {
            el.comboMult.textContent = `×${mult}`;
            el.comboMult.classList.remove('pop');
            void el.comboMult.offsetWidth;          // restart the CSS animation
            el.comboMult.classList.add('pop');
        }
        if (last.combo !== w.combo) el.comboCount.textContent = `${w.combo} CHAIN`;
        el.comboFill.style.width = `${Math.max(0, w.comboTimer / RULES.comboWindow) * 100}%`;
    }
    last.mult = mult;
    last.combo = w.combo;

    // Power-up timers
    for (const k of Object.keys(w.power)) {
        const t = w.power[k];
        let e = powerEls.get(k);
        if (t > 0 && !e) {
            e = document.createElement('div');
            e.className = 'power';
            e.style.setProperty('--c', PICKUPS[k].color);
            e.innerHTML = `${PICKUPS[k].label}<div class="bar"></div>`;
            el.powers.appendChild(e);
            powerEls.set(k, e);
        }
        if (e) {
            if (t <= 0) { e.remove(); powerEls.delete(k); continue; }
            e.querySelector('.bar').style.transform = `scaleX(${t / POWER_DURATION[k]})`;
            e.classList.toggle('ending', t < 3);
        }
    }

    el.save.classList.toggle('hidden', !(w.ballSave > 0 && !w.over));
    const held = w.balls.some((b) => b.held) && w.autoLaunch < 0;
    el.plunger.classList.toggle('hidden', !held);
    if (held) el.plungerFill.style.height = `${w.plunger * 100}%`;
}

export function bumpScore() {
    el.score.classList.remove('bump');
    void el.score.offsetWidth;
    el.score.classList.add('bump');
}

export function banner(text, opts = {}) {
    const b = document.createElement('div');
    b.className = 'banner' + (opts.small ? ' small' : '') + (opts.glitch ? ' glitch' : '');
    b.style.setProperty('--c', opts.color ?? '#ff2fa8');
    const life = opts.life ?? 1.6;
    b.style.setProperty('--life', `${life}s`);
    b.textContent = text;
    if (opts.sub) {
        const s = document.createElement('span');
        s.className = 'sub';
        s.textContent = opts.sub;
        b.appendChild(s);
    }
    // Keep at most three stacked banners.
    while (el.banners.children.length >= 3) el.banners.firstChild.remove();
    el.banners.appendChild(b);
    setTimeout(() => b.remove(), life * 1000 + 50);
}

export function showGameOver(w, best, isNew) {
    el.finalScore.textContent = w.score.toLocaleString('en-US');
    el.finalNew.classList.toggle('hidden', !isNew);
    const s = w.stats;
    el.finalStats.innerHTML = [
        `WAVE REACHED · ${w.wave}`,
        `BRICKS SMASHED · ${s.bricks}`,
        `BUMPER HITS · ${s.bumpers}`,
        `BEST CHAIN · ${w.bestCombo}`,
        `HIGH SCORE · ${best.toLocaleString('en-US')}`,
    ].join('<br>');
}
