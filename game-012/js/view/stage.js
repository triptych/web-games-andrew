// The battle stage. The sim settles a battle at once and hands back its timeline (sim/battle.js); the stage replays
// it: cards lunge, numbers float, bars drain, shields shimmer, burns flicker, the fallen crack and grey, and a Canvas 2D
// layer over the cards throws sparks, rings and bolts in each element's colour. Speed 1×, 2× or 4×, and Skip.
// Everything is DOM + one canvas: no framework.

import { ELEMENTS, CARDS } from '../sim/data/cards.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { cardEl, foeEl, elGlyph } from './cards.js';

const STAT_WORD = { atk: 'ATK', def: 'DEF', spd: 'SPD', blind: 'Veiled', delay: 'Delayed', dodge: 'Evasive' };

export class Stage {
    constructor(root, canvas, audio) {
        this.root = root;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audio = audio;
        this.units = {};
        this.parts = [];
        this.running = false;
        this.speed = 2;
        this.motion = true;
        this.t = 0;
        this.i = 0;
        this.log = [];
        this.onDone = null;
        this.onLine = null;          // (text) for the caption under the stage
        this.onVoice = null;         // (id) for The World's lines
        this.shake = 0;
    }

    /** Build the two lines of cards and start the replay. */
    play(ev, { speed = 2, motion = true } = {}) {
        this.speed = speed;
        this.motion = motion;
        this.log = ev.log;
        this.result = ev.result;
        this.i = 0;
        this.t = -0.6;               // a beat before the first blow
        this.running = true;
        this.parts = [];
        this.units = {};
        this.bossVoiced = {};
        const party = this.root.querySelector('.side.party');
        const foes = this.root.querySelector('.side.foes');
        party.innerHTML = '';
        foes.innerHTML = '';
        for (const u of ev.start.allies) party.append(this.unitEl(u, 0));
        for (const u of ev.start.foes) foes.append(this.unitEl(u, 1));
        this.resize();
    }

    unitEl(u, side) {
        const wrap = document.createElement('div');
        wrap.className = 'unit ' + (side === 0 ? 'ally' : 'enemy');
        wrap.dataset.key = u.key;
        const face = side === 0 ? cardEl(u.id, {}) : foeEl(u.id);
        wrap.append(face);
        wrap.insertAdjacentHTML('beforeend',
            '<div class="ubars"><div class="hpbar"><i class="hp"></i><i class="sh"></i></div><b class="hpn"></b></div>'
            + `<div class="pips">${'<i></i>'.repeat(Math.max(0, u.cost))}</div><div class="ustat"></div>`);
        const st = { ...u, maxHp: u.hp, side, el: u.el, alive: true, buffs: {}, burning: 0, stunned: false, wrap };
        this.units[u.key] = st;
        this.draw(st);
        return wrap;
    }

    draw(u) {
        const hp = Math.max(0, u.hp) / u.maxHp;
        const sh = Math.min(1, u.shield / u.maxHp);
        const w = u.wrap;
        w.querySelector('.hp').style.width = (hp * 100).toFixed(1) + '%';
        w.querySelector('.sh').style.width = (sh * 100).toFixed(1) + '%';
        w.querySelector('.hpn').textContent = Math.max(0, Math.round(u.hp)) + (u.shield > 0 ? ` +${Math.round(u.shield)}` : '');
        w.classList.toggle('low', hp < 0.3 && u.alive);
        w.classList.toggle('dead', !u.alive);
        w.classList.toggle('shielded', u.shield > 0);
        w.classList.toggle('burning', u.burning > 0);
        w.classList.toggle('stunned', u.stunned);
        const pips = w.querySelectorAll('.pips i');
        pips.forEach((p, k) => p.classList.toggle('on', k < u.charge));
        const s = [];
        for (const [k, v] of Object.entries(u.buffs)) if (v) s.push(`<span class="${v > 0 ? 'up' : 'down'}">${STAT_WORD[k] || k}${v > 0 ? '▲' : '▼'}</span>`);
        w.querySelector('.ustat').innerHTML = s.join('');
    }

    /** Client-space centre of a unit (for particles and floating text). */
    centre(key) {
        const u = this.units[key];
        if (!u) return null;
        const r = u.wrap.querySelector('.card').getBoundingClientRect();
        const c = this.canvas.getBoundingClientRect();
        return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2, w: r.width, h: r.height };
    }

    float(key, text, cls) {
        const u = this.units[key];
        if (!u) return;
        const f = document.createElement('div');
        f.className = 'float ' + cls;
        f.textContent = text;
        f.style.left = (35 + Math.random() * 30) + '%';
        u.wrap.append(f);
        setTimeout(() => f.remove(), 1100);
    }

    flash(key, cls, ms = 380) {
        const u = this.units[key];
        if (!u) return;
        u.wrap.classList.remove(cls);
        void u.wrap.offsetWidth;
        u.wrap.classList.add(cls);
        setTimeout(() => u.wrap.classList.remove(cls), ms);
    }

    // ------------------------------------------------------------------ particles
    burst(key, color, n = 14, speed = 160, life = 0.6) {
        if (!this.motion) n = Math.ceil(n / 3);
        const c = this.centre(key);
        if (!c) return;
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
            this.parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, r: 2 + Math.random() * 3, kind: 'spark' });
        }
    }
    ring(key, color) {
        const c = this.centre(key);
        if (c) this.parts.push({ x: c.x, y: c.y, life: 0.5, max: 0.5, color, r: c.w * 0.3, grow: c.w * 1.4, kind: 'ring' });
    }
    bolt(fromKey, toKey, color) {
        const a = this.centre(fromKey), b = this.centre(toKey);
        if (a && b) this.parts.push({ x: a.x, y: a.y, x2: b.x, y2: b.y, life: 0.28, max: 0.28, color, kind: 'bolt' });
    }
    rise(key, color) {
        const c = this.centre(key);
        if (!c) return;
        for (let k = 0; k < (this.motion ? 10 : 4); k++) {
            this.parts.push({ x: c.x + (Math.random() - 0.5) * c.w * 0.8, y: c.y + c.h * 0.3, vx: 0, vy: -60 - Math.random() * 60, life: 0.9, max: 0.9, color, r: 2 + Math.random() * 2, kind: 'spark' });
        }
    }

    resize() {
        const r = this.canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ------------------------------------------------------------------ playback
    update(dt) {
        if (this.running) {
            this.t += dt * this.speed;
            while (this.i < this.log.length && this.log[this.i].t <= this.t) this.apply(this.log[this.i++], true);
            if (this.i >= this.log.length) this.finish();
        }
        this.drawParts(dt);
    }

    skip() {
        if (!this.running) return;
        while (this.i < this.log.length) this.apply(this.log[this.i++], false);
        this.finish();
    }

    finish() {
        if (!this.running) return;
        this.running = false;
        setTimeout(() => this.onDone?.(this.result), this.motion ? 650 : 250);
    }

    nameOf(key) {
        const u = this.units[key];
        if (!u) return '';
        return u.side === 0 ? CARDS[u.id].name : ENEMIES[u.id].name;
    }

    apply(e, fx) {
        const A = this.units[e.a], B = this.units[e.b];
        const sfx = (n, o) => fx && this.audio.play(n, o);
        switch (e.e) {
            case 'act':
                if (!A) break;
                if (e.skill) {
                    A.charge = 0;
                    if (fx) {
                        this.flash(e.a, 'casting', 600);
                        this.ring(e.a, ELEMENTS[A.el]?.color || '#fff');
                        this.onLine?.(`${this.nameOf(e.a)} · ${e.skill}`, A.side);
                    }
                    sfx('spell', { rate: 0.9 + Math.random() * 0.2, gap: 0.08 });
                } else {
                    A.charge = Math.min(A.cost, A.charge + 1);
                    if (fx) this.flash(e.a, A.side === 0 ? 'lunge-a' : 'lunge-f', 320);
                    sfx('whoosh', { rate: 0.9 + Math.random() * 0.3, vol: 0.5, gap: 0.06 });
                }
                this.draw(A);
                break;
            case 'hit': {
                if (!B) break;
                const left = Math.max(0, e.v - B.shield);
                B.shield = Math.max(0, B.shield - e.v);
                B.hp -= left;
                if (fx) {
                    const col = A ? ELEMENTS[A.el]?.color || '#fff' : '#ff9a3c';
                    if (e.dot) { this.float(e.b, '-' + e.v, e.poison ? 'poison' : 'burn'); sfx('burn', { vol: 0.4, gap: 0.12 }); }
                    else {
                        this.float(e.b, (e.crit ? '!' : '') + '-' + e.v + (e.adv > 0 ? ' ▲' : e.adv < 0 ? ' ▼' : ''), e.crit ? 'crit' : e.adv > 0 ? 'strong' : e.adv < 0 ? 'weak' : 'dmg');
                        if (A && A !== B && !e.thorns) this.bolt(e.a, e.b, col);
                        this.burst(e.b, col, e.crit ? 22 : 12, e.crit ? 230 : 160);
                        this.flash(e.b, 'hurt', 300);
                        sfx(e.crit ? 'crit' : 'hit', { rate: 0.85 + Math.random() * 0.3, gap: 0.05, vol: e.blast ? 0.7 : 1 });
                        if (e.crit || e.execute) this.shake = Math.max(this.shake, 0.25);
                    }
                }
                this.draw(B);
                break;
            }
            case 'miss': if (fx) { this.float(e.b, 'Miss', 'info'); } break;
            case 'dodge': if (fx) { this.float(e.b, 'Dodge', 'info'); sfx('whoosh', { rate: 1.4, gap: 0.08 }); } break;
            case 'heal':
                if (!B) break;
                B.hp = Math.min(B.maxHp, B.hp + e.v);
                if (fx && e.v > 0) { this.float(e.b, '+' + e.v, 'heal'); this.rise(e.b, '#7dffb0'); sfx('heal', { gap: 0.1, vol: e.regen ? 0.3 : 1 }); }
                this.draw(B);
                break;
            case 'shield':
                if (!B) break;
                B.shield += e.v;
                if (fx && e.v > 0) { this.float(e.b, '+' + e.v + ' ◈', 'shield'); this.ring(e.b, '#9fd8ff'); sfx('shield', { gap: 0.1 }); }
                this.draw(B);
                break;
            case 'burn':
                if (!B) break;
                B.burning = 3;
                if (fx) { this.burst(e.b, '#ff7a3d', 10, 90); sfx('burn', { gap: 0.1 }); }
                this.draw(B);
                break;
            case 'stun':
                if (!B) break;
                B.stunned = true;
                if (fx) { this.float(e.b, 'Stunned', 'info'); sfx('stun', { gap: 0.1 }); }
                this.draw(B);
                break;
            case 'stunned': if (A) { A.stunned = false; this.draw(A); } break;
            case 'buff': case 'debuff':
                if (!B) break;
                B.buffs[e.stat] = e.e === 'buff' ? 1 : -1;
                if (fx) {
                    this.float(e.b, (STAT_WORD[e.stat] || e.stat) + (e.e === 'buff' ? ' ▲' : ' ▼'), e.e === 'buff' ? 'up' : 'down');
                    sfx(e.e === 'buff' ? 'star' : 'curse', { gap: 0.15, vol: 0.6 });
                }
                this.draw(B);
                break;
            case 'cleanse':
                if (!B) break;
                B.burning = 0; B.stunned = false;
                for (const k in B.buffs) if (B.buffs[k] < 0) B.buffs[k] = 0;
                if (fx) this.rise(e.b, '#fff6c8');
                this.draw(B);
                break;
            case 'taunt': if (A && fx) { this.float(e.a, 'Taunt', 'info'); this.flash(e.a, 'taunting', 700); } break;
            case 'die':
                if (!B) break;
                B.alive = false; B.hp = 0; B.shield = 0; B.burning = 0; B.stunned = false; B.buffs = {};
                if (fx) {
                    this.burst(e.b, '#d9c6ff', 26, 200, 0.9);
                    sfx('die');
                    if (B.id === 'the_world') this.onVoice?.('wfall');
                }
                this.draw(B);
                break;
            case 'rise':
                if (!B) break;
                B.alive = true; B.hp = e.v;
                if (fx) { this.float(e.b, 'Rises!', 'heal'); this.rise(e.b, '#ffe9a8'); sfx('rise'); }
                this.draw(B);
                break;
            case 'phase':
                if (!A) break;
                A.el = e.el;
                if (fx) {
                    this.onLine?.(`${this.nameOf(e.a)} · ${e.name}`, 1);
                    this.ring(e.a, ELEMENTS[e.el].color);
                    this.burst(e.a, ELEMENTS[e.el].color, 40, 300, 1);
                    this.shake = 0.5;
                    sfx('phase');
                    if (!this.bossVoiced.phase) { this.bossVoiced.phase = true; this.onVoice?.('wphase'); }
                    const badge = A.wrap.querySelector('.cf-el');
                    if (badge) { badge.textContent = elGlyph(e.el); badge.style.setProperty('--elc', ELEMENTS[e.el].color); }
                }
                break;
            case 'wheel': if (A && fx) this.float(e.a, ['Fortune strikes!', 'Fortune heals!', 'Fortune binds!'][e.v], 'info'); break;
            case 'timeout': if (fx) this.onLine?.('The candle burns out…', 1); break;
            default: break;
        }
    }

    drawParts(dt) {
        const ctx = this.ctx;
        const r = this.canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, r.width, r.height);
        if (this.shake > 0) {
            this.shake = Math.max(0, this.shake - dt);
            const k = this.motion ? this.shake * 14 : 0;
            this.root.style.transform = k ? `translate(${(Math.random() - 0.5) * k}px, ${(Math.random() - 0.5) * k}px)` : '';
        } else if (this.root.style.transform) this.root.style.transform = '';
        ctx.globalCompositeOperation = 'lighter';
        const keep = [];
        for (const p of this.parts) {
            p.life -= dt;
            if (p.life <= 0) continue;
            keep.push(p);
            const a = p.life / p.max;
            if (p.kind === 'spark') {
                p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy = p.vy * 0.94 + 30 * dt;
                ctx.globalAlpha = a;
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
            } else if (p.kind === 'ring') {
                ctx.globalAlpha = a * 0.8;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 3 * a + 1;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r + p.grow * (1 - a), 0, Math.PI * 2); ctx.stroke();
            } else if (p.kind === 'bolt') {
                const k = 1 - a;
                const hx = p.x + (p.x2 - p.x) * Math.min(1, k * 1.6), hy = p.y + (p.y2 - p.y) * Math.min(1, k * 1.6);
                const tx = p.x + (p.x2 - p.x) * Math.max(0, k * 1.6 - 0.45), ty = p.y + (p.y2 - p.y) * Math.max(0, k * 1.6 - 0.45);
                const g = ctx.createLinearGradient(tx, ty, hx, hy);
                g.addColorStop(0, 'rgba(255,255,255,0)');
                g.addColorStop(1, p.color);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = g;
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
            }
        }
        this.parts = keep;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
}
