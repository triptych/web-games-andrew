// DOM UI: the fitted 16:9 frame, the HUD, menus (keyboard, gamepad, mouse
// and touch), banners, toasts, Vesper's in-flight comms and the story box.

import { CAST } from './sim/story.js';
import { ITEM_NAMES } from './config.js';

const $ = (id) => document.getElementById(id);

export class UI {
    constructor() {
        this.frame = $('frame');
        this.canvas = $('gl');
        this.playArea = $('play-area');
        this.hud = $('hud');
        this.screens = [...document.querySelectorAll('.screen')];
        this.active = null;
        this.focus = 0;
        this.onAction = () => {};
        this.cache = {};
        this.typing = null;
        this.commsT = 0;
        this.bannerT = 0;
        for (const b of document.querySelectorAll('.screen button[data-act]')) {
            b.addEventListener('click', (e) => {
                if (b.disabled) return;
                e.stopPropagation();
                this.onAction(b.dataset.act, b);
            });
            b.addEventListener('pointerenter', (e) => {
                if (e.pointerType !== 'mouse' || !this.active) return;
                const list = this.buttons();
                const i = list.indexOf(b);
                if (i >= 0) this.setFocus(i);
            });
        }
        $('s-story').addEventListener('click', (e) => { if (!e.target.closest('button')) this.onAction('story-next'); });
    }

    el(id) { return $(id); }

    // ---------------------------------------------------------------- layout
    layout() {
        const vv = window.visualViewport;
        const vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
        let w = vw, h = Math.round(vw * 9 / 16);
        if (h > vh) { h = vh; w = Math.round(vh * 16 / 9); }
        const x = Math.floor((vw - w) / 2), y = Math.floor((vh - h) / 2);
        const s = document.documentElement.style;
        s.setProperty('--fw', w + 'px'); s.setProperty('--fh', h + 'px');
        s.setProperty('--fx', x + 'px'); s.setProperty('--fy', y + 'px');
        this.fw = w; this.fh = h; this.fx = x; this.fy = y;
        return { w, h };
    }

    setTouch(on) {
        document.body.classList.toggle('touch', on);
        $('touch').hidden = !(on && this.playing);
    }

    setPlaying(on) {
        this.playing = on;
        document.body.classList.toggle('playing', on);
        this.hud.hidden = !on;
        $('touch').hidden = !(on && document.body.classList.contains('touch'));
        if (!on) { $('comms').hidden = true; }
    }

    // ---------------------------------------------------------------- screens & menus
    show(id) {
        for (const s of this.screens) s.hidden = s.id !== id;
        this.active = id ? $(id) : null;
        $('boot').hidden = true;
        if (this.active) {
            const list = this.buttons();
            const pref = list.findIndex((b) => b.dataset.focus === '1');
            this.setFocus(pref >= 0 ? pref : 0);
        }
    }

    buttons() {
        if (!this.active) return [];
        return [...this.active.querySelectorAll('nav.menu button')].filter((b) => !b.disabled && b.offsetParent !== null);
    }

    setFocus(i) {
        const list = this.buttons();
        if (!list.length) return;
        this.focus = (i + list.length) % list.length;
        list.forEach((b, k) => b.classList.toggle('focus', k === this.focus));
    }

    /** Keyboard / gamepad menu navigation. Returns true if it used the input. */
    nav(snap, audio) {
        if (!this.active) return false;
        const list = this.buttons();
        if (!list.length) return false;
        if (snap.up || (snap.left && !this.isOpt(list))) { this.setFocus(this.focus - 1); audio?.ui('move'); return true; }
        if (snap.down || (snap.right && !this.isOpt(list))) { this.setFocus(this.focus + 1); audio?.ui('move'); return true; }
        const cur = list[this.focus];
        if ((snap.left || snap.right) && cur && cur.dataset.opt) { this.onAction('opt', cur, snap.left ? -1 : 1); return true; }
        if (snap.confirm && cur) { cur.click(); return true; }
        if (snap.back) {
            const back = this.active.querySelector('button[data-act="back"]');
            if (back) { back.click(); return true; }
            this.onAction('esc');
            return true;
        }
        return false;
    }

    isOpt(list) { return list[this.focus] && list[this.focus].dataset.opt; }

    // ---------------------------------------------------------------- HUD
    set(id, v) {
        if (this.cache[id] === v) return;
        this.cache[id] = v;
        $(id).textContent = v;
    }

    hudUpdate(w, hi) {
        const S = w.S, pw = S.power, p = w.player;
        this.set('score', S.score.toLocaleString());
        this.set('hiscore', Math.max(hi, S.score).toLocaleString());
        const lives = '✦'.repeat(Math.min(6, S.lives)) + (S.lives > 6 ? `×${S.lives}` : '');
        this.set('lives', lives || '·');
        this.set('health', w.D.health > 1 ? '♥'.repeat(Math.max(0, S.health)) + '♡'.repeat(Math.max(0, w.D.health - S.health)) : '');
        const prog = `${Math.round(w.progress * 100)}%`;
        if (this.cache.prog !== prog) { this.cache.prog = prog; $('progress').firstElementChild.style.width = prog; }
        const hc = w.dawn ? 'dawn' : pw.halo ? pw.halo.c : '';
        const haloTxt = w.dawn ? 'Dawn' : pw.halo ? `${{ red: 'Flame', blue: 'Lance', gold: 'Choir' }[pw.halo.c]} ${pw.halo.lvl >= 2 ? 'II' : 'I'}` : 'No Halo';
        if (this.cache.hc !== hc + haloTxt) { this.cache.hc = hc + haloTxt; const e = $('pw-halo'); e.className = 'chip ' + hc + (pw.halo ? '' : ' off'); e.textContent = '◯ ' + haloTxt; }
        this.set('pw-speed', '➹ ' + '▮'.repeat(pw.speed) + '▯'.repeat(4 - pw.speed));
        const echo = pw.echoes ? '◌'.repeat(pw.echoes) : '◌';
        if (this.cache.echo !== echo) { this.cache.echo = echo; const e = $('pw-echo'); e.textContent = 'Echo ' + echo; e.classList.toggle('off', !pw.echoes); }
        if (this.cache.seek !== pw.seeker) { this.cache.seek = pw.seeker; $('pw-seek').classList.toggle('off', !pw.seeker); }
        const ae = pw.aegis ? '⛨'.repeat(pw.aegis) : '⛨';
        if (this.cache.ae !== ae) { this.cache.ae = ae; const e = $('pw-aegis'); e.textContent = ae; e.classList.toggle('off', !pw.aegis); }
        const ch = p.charging ? p.charge : 0;
        const cw = `${Math.round(ch * 100)}%`;
        if (this.cache.cw !== cw) { this.cache.cw = cw; $('beam-gauge').querySelector('i').style.width = cw; $('beam-gauge').classList.toggle('full', ch >= 1); }
        const bossOn = !!(w.boss && w.boss.st === 'fight');
        if (this.cache.bossOn !== bossOn) { this.cache.bossOn = bossOn; $('bossbar').hidden = !bossOn; if (bossOn) $('boss-name').textContent = w.boss.def.name; }
        if (bossOn) {
            const bw = `${Math.max(0, w.bossFrac() * 100).toFixed(1)}%`;
            if (this.cache.bw !== bw) { this.cache.bw = bw; $('bossbar').querySelector('i').style.width = bw; }
        }
    }

    setStageName(text) { $('stage-name').textContent = text; }
    resetHud() { this.cache = {}; }

    // ---------------------------------------------------------------- banners, toasts, comms
    banner(lines, cls = '', dur = 3) {
        const b = $('banner');
        b.className = cls;
        b.innerHTML = '';
        lines.forEach((t, i) => { if (!t) return; const d = document.createElement('div'); d.className = 'b' + (i + 1); d.textContent = t; b.appendChild(d); });
        b.hidden = false;
        void b.offsetWidth;
        b.classList.add('show');
        this.bannerT = dur;
    }

    hideBanner() { $('banner').hidden = true; this.bannerT = 0; }

    toast(text, color = null) {
        const t = document.createElement('div');
        t.className = 'toast';
        if (color) t.style.setProperty('--c', color);
        t.textContent = text;
        $('toasts').appendChild(t);
        setTimeout(() => t.remove(), 1900);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    }

    pickupToast(kind, bonus) {
        const colors = { red: '#ff7a4a', blue: '#7ac8ff', gold: '#ffd860', aegis: '#88ffd8', life: '#ffb0d0', echo: '#ffe0a0', seeker: '#b0e0ff', wing: '#ffffff' };
        if (kind === 'shard') return;
        this.toast(bonus ? `${ITEM_NAMES[kind]} · +${bonus}` : ITEM_NAMES[kind], colors[kind]);
    }

    comms(who, text) {
        const c = $('comms');
        const cast = CAST[who] || CAST.vesper;
        c.querySelector('.who').textContent = cast.name;
        c.querySelector('.who').style.color = cast.color;
        c.querySelector('.txt').textContent = text;
        c.hidden = false;
        c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
        this.commsT = 3.2 + text.length * 0.035;
    }

    tick(dt) {
        if (this.commsT > 0) { this.commsT -= dt; if (this.commsT <= 0) $('comms').hidden = true; }
        if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').hidden = true; }
        if (this.typing) {
            const ty = this.typing;
            ty.n = Math.min(ty.text.length, ty.n + dt * 55);
            ty.el.textContent = ty.text.slice(0, Math.floor(ty.n));
            if (ty.n >= ty.text.length) this.typing = null;
        }
    }

    // ---------------------------------------------------------------- story box
    storyTitle(t) { $('s-story').querySelector('.scene-title').textContent = t; }

    storyLine(who, text, freed = false) {
        const cast = CAST[who] || CAST.narrator;
        const n = $('s-story').querySelector('.name');
        n.innerHTML = '';
        if (cast.name) {
            n.textContent = cast.name;
            const sm = document.createElement('small'); sm.textContent = freed && who === 'vesper' ? 'the evening star' : cast.title; n.appendChild(sm);
        }
        n.style.color = cast.color;
        const el = $('s-story').querySelector('.text');
        el.classList.toggle('narr', who === 'narrator');
        el.textContent = '';
        this.typing = { el, text, n: 0 };
    }

    /** Finish the typewriter; returns true if it was still typing. */
    storyRush() {
        if (!this.typing) return false;
        this.typing.el.textContent = this.typing.text;
        this.typing = null;
        return true;
    }
}
