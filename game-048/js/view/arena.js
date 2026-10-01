/**
 * arena.js — the fight above the reels: your frame on the left, the
 * Determinant's units on the right, HP/shield bars with lag, intents, the
 * target bracket, hit flashes, lunges, deaths and spawn-ins.
 */

import { drawPlayerMech, drawEnemy, bodyTop, hexA, rrect, iconCanvas } from './art.js';
import { intentLabel } from '../sim/combat.js';
import { fmt } from '../sim/format.js';

const TAU = Math.PI * 2;

export class ArenaView {
    constructor() {
        this.rect = null;
        this.enemies = new Map();
        this.player = null;
        this.target = -1;
        this.hover = -1;
        this.time = 0;
        this.chapter = 0;
        this.mech = null;
        this.cols = 3;
    }

    setup(st, mech, chapter) {
        this.enemies.clear();
        this.mech = mech;
        this.chapter = chapter;
        this.cols = st.cols;
        const p = st.player;
        this.player = { hp: p.hp, maxHp: p.maxHp, shield: p.shield, hpLag: p.hp, flash: 0, recoil: 0, slash: 0, charge: 0, x: 0, y: 0, h: 100, spinning: false, bubble: 0, hurt: 0 };
        for (const e of st.enemies) this.addEnemy(e, false);
        this.target = st.target;
    }

    addEnemy(e, spawn = true) {
        const d = {
            id: e.id, name: e.name, body: e.body, seed: e.seed, boss: e.boss, elite: e.elite, affixes: e.affixes,
            hp: e.hp, maxHp: e.maxHp, shield: e.shield, hpLag: e.hp, intent: e.intent,
            x: 0, y: 0, h: 80, tx: null, ty: null, flash: 0, lunge: 0, dead: false, deathT: 0, spawnT: spawn ? 0 : 1, shake: 0,
        };
        this.enemies.set(e.id, d);
        return d;
    }

    layout(rect) {
        this.rect = rect;
        this.place(true);
    }

    place(snap = false) {
        const A = this.rect;
        if (!A) return;
        const ground = A.y + A.h * 0.9;
        const P = this.player;
        P.h = Math.min(A.h * 0.72, A.w * 0.32);
        P.x = A.x + A.w * 0.2;
        P.y = ground;
        const live = [...this.enemies.values()].filter((e) => !e.dead || e.deathT < 0.6);
        live.sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || a.id - b.id);
        const n = live.length;
        const x0 = A.x + A.w * 0.52, x1 = A.x + A.w * 0.92;
        live.forEach((e, i) => {
            const small = e.body === 'mite' ? 0.55 : e.body === 'crawler' || e.body === 'spider' ? 0.8 : 1;
            const back = n > 2 && i % 2 === 1;
            e.h = Math.min(A.h * 0.5, A.w * 0.2) * (e.boss ? 1.45 : 1) * small * (back ? 0.86 : 1);
            const tx = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
            const ty = ground - (back ? A.h * 0.1 : 0);
            if (snap || e.tx === null) { e.x = tx; e.y = ty; }
            e.tx = tx; e.ty = ty;
        });
    }

    /** Point helpers for effects. */
    enemyCenter(id) {
        const e = this.enemies.get(id);
        if (!e) return { x: this.rect.x + this.rect.w * 0.75, y: this.rect.y + this.rect.h * 0.5 };
        return { x: e.x, y: e.y - e.h * bodyTop(e.body) * 0.55 };
    }
    enemyTop(id) {
        const e = this.enemies.get(id);
        return { x: e.x, y: e.y - e.h * bodyTop(e.body) - 8 };
    }
    muzzle() { const P = this.player; return { x: P.x + P.h * 0.48, y: P.y - P.h * 0.8 }; }
    chest() { const P = this.player; return { x: P.x, y: P.y - P.h * 0.72 }; }
    pod() { const P = this.player; return { x: P.x - P.h * 0.07, y: P.y - P.h * 1.05 }; }

    hitTest(x, y) {
        let best = -1, bd = Infinity;
        for (const e of this.enemies.values()) {
            if (e.dead) continue;
            const top = e.y - e.h * bodyTop(e.body) - 40;
            if (x < e.x - e.h * 0.55 || x > e.x + e.h * 0.55 || y < top || y > e.y + 10) continue;
            const d = Math.abs(x - e.x);
            if (d < bd) { bd = d; best = e.id; }
        }
        return best;
    }

    update(dt) {
        this.time += dt;
        const P = this.player;
        if (!P) return;
        P.flash = Math.max(0, P.flash - dt * 5);
        P.recoil = Math.max(0, P.recoil - dt * 5);
        P.slash = Math.max(0, P.slash - dt * 4);
        P.bubble = Math.max(0, P.bubble - dt * 1.5);
        P.hurt = Math.max(0, P.hurt - dt * 3);
        P.hpLag += (P.hp - P.hpLag) * Math.min(1, dt * (P.hpLag > P.hp ? 2.2 : 8));
        for (const e of this.enemies.values()) {
            e.flash = Math.max(0, e.flash - dt * 6);
            e.lunge = Math.max(0, e.lunge - dt * 4);
            e.shake = Math.max(0, e.shake - dt * 4);
            e.spawnT = Math.min(1, e.spawnT + dt * 2.5);
            e.hpLag += (e.hp - e.hpLag) * Math.min(1, dt * (e.hpLag > e.hp ? 2.2 : 8));
            if (e.dead) e.deathT += dt;
            if (e.tx !== null) { e.x += (e.tx - e.x) * Math.min(1, dt * 5); e.y += (e.ty - e.y) * Math.min(1, dt * 5); }
        }
        for (const [id, e] of this.enemies) if (e.dead && e.deathT > 1.2) this.enemies.delete(id);
    }

    draw(ctx, opts = {}) {
        const t = this.time;
        const P = this.player;
        if (!P || !this.rect) return;
        // player
        drawPlayerMech(ctx, P.x, P.y, P.h, { mech: this.mech, t, recoil: P.recoil, slash: P.slash, flash: P.flash, charge: P.charge, cols: this.cols, spinning: P.spinning });
        if (P.bubble > 0 || P.shield > 0) {
            const a = Math.max(P.bubble, P.shield > 0 ? 0.35 : 0);
            const c = this.chest();
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const r = P.h * 0.62;
            const g = ctx.createRadialGradient(c.x, c.y, r * 0.6, c.x, c.y, r);
            g.addColorStop(0, hexA('#4d8dff', 0)); g.addColorStop(0.85, hexA('#4d8dff', 0.18 * a)); g.addColorStop(1, hexA('#9cc4ff', 0.6 * a));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
            // hex shimmer
            ctx.strokeStyle = hexA('#9cc4ff', 0.25 * a);
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) { const ang = t * 0.8 + (i * TAU) / 6; ctx.beginPath(); ctx.arc(c.x + Math.cos(ang) * r * 0.5, c.y + Math.sin(ang) * r * 0.5, r * 0.22, 0, TAU); ctx.stroke(); }
            ctx.restore();
        }
        this.drawPlayerBar(ctx);
        // enemies (back row first)
        const list = [...this.enemies.values()].sort((a, b) => a.y - b.y);
        for (const e of list) {
            ctx.save();
            const s = e.spawnT < 1 ? e.spawnT : 1;
            let alpha = s;
            if (e.dead) alpha = Math.max(0, 1 - e.deathT / 0.5);
            if (alpha <= 0) { ctx.restore(); continue; }
            ctx.globalAlpha = alpha;
            const jx = e.shake ? (Math.random() - 0.5) * e.shake * 10 : 0;
            if (s < 1) {
                // materialise: scanline wipe
                ctx.beginPath(); ctx.rect(e.x - e.h, e.y - e.h * 2 * s, e.h * 2, e.h * 2 * s + 10); ctx.clip();
            }
            drawEnemy(ctx, e, e.x + jx, e.y, e.h, { t, flash: e.dead ? 1 : e.flash, lunge: e.lunge, chapter: this.chapter });
            ctx.restore();
            if (!e.dead) this.drawEnemyUi(ctx, e, opts);
        }
    }

    drawPlayerBar(ctx) {
        const P = this.player;
        const w = Math.max(110, P.h * 0.85), h = 12;
        const x = P.x - w / 2, y = P.y + 8;
        if (y + h + 6 > this.rect.y + this.rect.h + 4) return this.drawBar(ctx, x, this.rect.y + this.rect.h - h - 6, w, h, P, '#46ff9a', true);
        this.drawBar(ctx, x, y, w, h, P, '#46ff9a', true);
    }

    drawBar(ctx, x, y, w, h, o, color, big) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        rrect(ctx, x - 2, y - 2, w + 4, h + 4, 4); ctx.fill();
        const f = Math.max(0, o.hp / o.maxHp), lag = Math.max(0, o.hpLag / o.maxHp);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, w * Math.min(1, lag), h);
        const low = f < 0.3;
        ctx.fillStyle = low ? (Math.sin(this.time * 10) > 0 ? '#ff3355' : '#ff7a90') : color;
        ctx.fillRect(x, y, w * f, h);
        if (o.shield > 0) {
            const sf = Math.min(1, o.shield / o.maxHp);
            ctx.fillStyle = 'rgba(77,141,255,0.75)';
            ctx.fillRect(x, y, w * sf, h * 0.45);
        }
        ctx.font = `800 ${big ? 11 : 10}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
        const label = `${fmt(Math.ceil(o.hp))}/${fmt(o.maxHp)}`;
        ctx.strokeText(label, x + w / 2, y + h / 2 + 0.5);
        ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
        if (o.shield > 0) {
            const sx = x - 4, sy = y + h / 2;
            ctx.fillStyle = '#4d8dff';
            ctx.beginPath(); ctx.moveTo(sx, sy - 11); ctx.lineTo(sx + 9, sy - 7); ctx.lineTo(sx + 8, sy + 4); ctx.lineTo(sx, sy + 10); ctx.lineTo(sx - 8, sy + 4); ctx.lineTo(sx - 9, sy - 7); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.font = '800 9px system-ui';
            ctx.fillText(fmt(o.shield), sx, sy);
        }
        ctx.restore();
    }

    drawEnemyUi(ctx, e, opts) {
        const top = e.y - e.h * bodyTop(e.body);
        const w = Math.max(64, Math.min(140, e.h * 0.8)) * (e.boss ? 1.4 : 1);
        const x = e.x - w / 2, y = Math.max(this.rect.y + 30, top - 14);
        this.drawBar(ctx, x, y, w, 9, e, e.boss ? '#ff4d6d' : '#ff6a6a', false);
        // name
        if (e.boss || e.elite || this.hover === e.id || opts.names) {
            ctx.font = `700 ${e.boss ? 11 : 10}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = e.elite ? '#ffc843' : e.boss ? '#ffb0b8' : 'rgba(220,230,255,0.8)';
            ctx.fillText(e.name, e.x, y + 21);
        }
        // intent
        const it = e.intent;
        if (it) {
            const L = intentLabel(it);
            const col = it.k === 'atk' ? '#ff5a6e' : it.k === 'jam' || it.k === 'glitch' || it.k === 'zero' || it.k === 'certainty' ? '#ff4dff' : it.k === 'shield' ? '#4d8dff' : it.k === 'heal' ? '#46ff9a' : '#ffe14d';
            const ic = iconCanvas(L.icon, col, 22);
            const bob = Math.sin(this.time * 3 + e.id) * 2;
            const ix = e.x - (L.value ? 12 : 0), iy = y - 18 + bob;
            ctx.drawImage(ic, ix - 11, iy - 11, 22, 22);
            if (L.value) {
                ctx.font = '900 13px system-ui, sans-serif';
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
                ctx.strokeText(L.value, ix + 12, iy);
                ctx.fillStyle = col;
                ctx.fillText(L.value, ix + 12, iy);
            }
        }
        // target bracket
        if (this.target === e.id) {
            const r = e.h * 0.42;
            const cy = e.y - e.h * bodyTop(e.body) * 0.5;
            ctx.save();
            ctx.translate(e.x, cy);
            ctx.rotate(this.time * 0.8);
            ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2.5;
            for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.arc(0, 0, r + 4 * Math.sin(this.time * 4), -0.35, 0.35); ctx.stroke(); }
            ctx.restore();
        }
        // affix pips
        if (e.affixes?.length) {
            ctx.font = '700 9px system-ui'; ctx.textAlign = 'center';
            ctx.fillStyle = '#ffc843';
            ctx.fillText(e.affixes.map((a) => a.slice(0, 3).toUpperCase()).join(' · '), e.x, e.y + 14);
        }
    }

    sync(st) {
        const P = this.player;
        P.hp = st.player.hp; P.maxHp = st.player.maxHp; P.shield = st.player.shield;
        for (const e of st.enemies) {
            let d = this.enemies.get(e.id);
            if (!d && e.hp > 0) d = this.addEnemy(e, false);
            if (!d) continue;
            d.hp = e.hp; d.maxHp = e.maxHp; d.shield = e.shield; d.intent = e.intent;
            if (e.hp <= 0 && !d.dead) { d.dead = true; d.deathT = 0.5; }
        }
        this.target = st.target;
        this.place();
    }
}
