// The battle stage in Canvas 2D: the place's painting behind, the foes standing in a row, and the sim's battle
// events played back one at a time (lunges, flashes, numbers, particles) so the player can follow what happened.
// While events are playing `busy` is true and the menu waits. The party's cards are DOM (js/ui.js); this module
// tells the UI what to show through the `hooks` it is given. Reads G; never writes it.

import { MAPS } from '../sim/data/maps.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { PARTY } from '../sim/data/party.js';
import { ITEMS } from '../sim/data/items.js';
import { STATUS_NAMES } from '../sim/battle.js';
import { img } from './assets.js';

const SCALE = { cogsprite: 0.6, rustcrab: 0.78, gearwolf: 0.95, bandit: 0.95, bigbertha: 1.0 };
const FX = {
    spark: ['#9fe8ff', '#fff6a8', '#ffffff'], gears: ['#e8b86a', '#c9873a', '#fff1c8'], heal: ['#9dffb2', '#e9ffd8'], slash: ['#ffffff'], bash: ['#ffd9a0'],
    claw: ['#ffffff'], steam: ['#e8f0f5', '#b8c8d0'], quake: ['#c8a878', '#7a6240'], rust: ['#c8693a', '#8a4a22'], tune: ['#ffe58a', '#fff'],
    shield: ['#ffd9a0', '#fff1c8'], raise: ['#e8b86a', '#fff1c8'], howl: ['#ff9a9a'], flicker: ['#9fe8ff'], item: ['#fff1a8', '#9dffb2'],
};
const SFX_OF = { spark: 'spark', gears: 'gears', heal: 'heal', slash: 'slash', bash: 'clang', claw: 'slash', steam: 'steam', quake: 'quake', rust: 'steam', tune: 'quest', shield: 'shield', howl: 'quake', flicker: 'spark', item: 'heal' };

export class BattleView {
    constructor(canvas, hooks) {
        this.cv = canvas;
        this.ctx = canvas.getContext('2d');
        this.hooks = hooks;           // { log, pop, cardFx, sfx, bark, music, result, refresh }
        this.queue = [];
        this.wait = 0;
        this.parts = [];
        this.nums = [];
        this.time = 0;
        this.shake = 0;
        this.disp = null;             // what the player has seen: hp per unit index
        this.speed = 1;
    }

    resize(w, h, dpr) { this.w = w; this.h = h; this.dpr = dpr; }

    get busy() { return this.queue.length > 0 || this.wait > 0; }

    /** A new battle: everything starts as it stood before the first event. */
    begin(G) {
        const B = G.battle;
        this.bg = img('bg', MAPS[G.map].bg);
        this.disp = B.units.map((u) => ({ hp: u.side === 'p' ? B.snap.hp[u.id] : u.mhp, mp: u.side === 'p' ? B.snap.mp[u.id] : 0, mhp: u.mhp, mmp: u.mmp, alive: true, flash: 0, lunge: 0, fade: 1 }));
        for (const [i, u] of B.units.entries()) if (u.side === 'p' && this.disp[i].hp <= 0) this.disp[i].alive = false;
        this.queue = []; this.parts = []; this.nums = []; this.wait = 0.6; this.intro = 1;
        this.layout(G);
    }

    layout(G) {
        const B = G.battle;
        const foes = B.units.map((u, i) => [u, i]).filter(([u, i]) => u.side === 'e' && this.disp?.[i]);
        const portrait = this.h > this.w;
        const baseH = Math.min(this.h * (portrait ? 0.24 : 0.36), this.w * (portrait ? 0.42 : 0.24));
        const n = foes.length;
        this.spots = {};
        foes.forEach(([u, i], k) => {
            const boss = ENEMIES[u.id].boss;
            const x = this.w * (n === 1 ? 0.5 : 0.18 + 0.64 * (k / (n - 1)));
            const s = (boss ? 1.5 : SCALE[u.id] || 1) * baseH;
            const foot = this.h * (portrait ? 0.52 : 0.62) + (k % 2 ? baseH * 0.05 : 0);
            this.spots[i] = { x, foot, h: s, boss };
        });
    }

    /** Where a foe stands (CSS px), for target buttons and damage numbers. */
    spot(i) { return this.spots?.[i]; }

    feed(events) { for (const e of events) this.queue.push(e); }

    tick(G, dt) {
        this.time += dt;
        const sp = this.speed;
        if (this.intro > 0) this.intro = Math.max(0, this.intro - dt * 1.5);
        if (this.wait > 0) { this.wait -= dt * sp; return; }
        while (this.queue.length && this.wait <= 0) this.play(G, this.queue.shift());
    }

    play(G, e) {
        const B = G.battle;
        const H = this.hooks;
        const unit = (i) => B?.units[i];
        const name = (i) => unit(i)?.name || '';
        const d = (i) => this.disp?.[i];
        switch (e.type) {
            case 'battleStart': H.sfx('encounter'); this.wait = 0.5; break;
            case 'round': H.order(e.order); break;
            case 'yourTurn': H.turn(e.who); break;
            case 'act': {
                const u = unit(e.who);
                let text = `${name(e.who)}: ${e.name}`;
                if (e.item) text = `${name(e.who)} uses ${ITEMS[e.item].name}`;
                H.log(text);
                if (d(e.who)) {
                    d(e.who).lunge = 1;
                    if (u.side === 'p' && e.ability) { const ab = PARTY[u.id].abilities.find((a) => a.id === e.ability); if (ab?.mp) d(e.who).mp -= ab.mp; }
                }
                this.anim = e.anim;
                H.sfx(SFX_OF[e.anim] || 'slash');
                H.bark(u, e.ability);
                if (u.side === 'p') H.cardFx(e.who, 'act');
                for (const t of e.targets) this.burst(G, t, e.anim, u.side === 'e' && unit(t)?.side === 'e');
                this.wait = 0.45;
                break;
            }
            case 'hit': {
                const v = d(e.target);
                if (v) v.hp = Math.max(0, v.hp - e.dmg);
                const u = unit(e.target);
                const txt = e.miss ? 'Miss' : `${e.dmg}${e.crit ? '!' : ''}`;
                const col = e.miss ? '#cfd8ff' : e.poison ? '#b8ff7a' : e.crit ? '#ffd24a' : u?.side === 'p' ? '#ff8a9a' : '#ffffff';
                if (u?.side === 'e') { this.number(e.target, txt, col, e.crit); if (!e.miss) { v.flash = 1; this.shake = e.crit ? 0.35 : 0.15; } }
                else { H.pop(e.target, txt, col); if (!e.miss && !e.self) { H.cardFx(e.target, 'hit'); this.shake = 0.2; } }
                if (!e.miss && !e.self && !e.poison) H.sfx('hit');
                H.refresh(this.disp);
                this.wait = e.poison ? 0.45 : 0.28;
                break;
            }
            case 'heal': case 'mpGain': case 'mpLoss': {
                const v = d(e.target);
                const u = unit(e.target);
                if (v) { if (e.type === 'heal') v.hp = Math.min(v.mhp, v.hp + e.amt); else if (e.type === 'mpGain') v.mp = Math.min(v.mmp, v.mp + e.amt); else v.mp = Math.max(0, v.mp - e.amt); }
                const txt = e.type === 'heal' ? `+${e.amt}` : e.type === 'mpGain' ? `+${e.amt} MP` : `-${e.amt} MP`;
                const col = e.type === 'heal' ? '#8dffa8' : '#8fb8ff';
                if (u?.side === 'p') { H.pop(e.target, txt, col); if (e.type === 'heal') H.cardFx(e.target, 'healed'); } else this.number(e.target, txt, col);
                H.refresh(this.disp);
                this.wait = 0.3;
                break;
            }
            case 'status': {
                const u = unit(e.target);
                const label = STATUS_NAMES[e.s];
                if (u?.side === 'e') this.number(e.target, label, '#ffd77a'); else H.pop(e.target, label, '#ffd77a');
                H.log(`${name(e.target)}: ${label}!`);
                this.wait = 0.35;
                break;
            }
            case 'resist': this.number(e.target, 'Resists!', '#cfd8ff'); this.wait = 0.3; break;
            case 'statusEnd': break;
            case 'cure': H.pop(e.target, 'Cured', '#8dffa8'); this.wait = 0.3; break;
            case 'stunned': H.log(`${name(e.target)} is stunned!`); this.wait = 0.6; break;
            case 'ko': {
                const v = d(e.target); if (v) { v.alive = false; v.hp = 0; }
                const u = unit(e.target);
                H.sfx('ko');
                if (u?.side === 'e') { this.burst(G, e.target, 'raise', false, 26); H.log(`${name(e.target)} is defeated.`); }
                else { H.log(`${name(e.target)} falls!`); H.bark(u, 'ko'); }
                H.refresh(this.disp);
                this.wait = 0.5;
                break;
            }
            case 'raise': { const v = d(e.target); const u = unit(e.target); if (v) { v.alive = true; v.fade = 0; v.hp = u.side === 'e' ? Math.round(u.mhp * 0.5) : Math.max(v.hp, 1); } H.sfx('heal'); H.log(`${name(e.target)} is back on their feet!`); H.refresh(this.disp); this.wait = 0.6; break; }
            case 'tell': H.log(e.text, true); H.sfx('quake'); H.bark(unit(e.who), 'gear_slam'); this.shake = 0.4; this.wait = 1.4; break;
            case 'steal': H.log(`${name(e.who)} snatches ${e.amt} gold!`); H.pop(0, `-${e.amt} g`, '#ffd24a'); H.sfx('coin'); this.wait = 0.5; break;
            case 'recover': H.log(`${e.amt} gold jingles back into the purse.`); H.sfx('coin'); this.wait = 0.5; break;
            case 'summon': {
                for (const i of e.targets) this.disp[i] = { hp: B.units[i].mhp, mp: 0, mhp: B.units[i].mhp, mmp: 0, alive: true, flash: 0, lunge: 0, fade: 0 };
                this.layout(G);
                H.sfx('gears');
                H.log('Cogs scatter out of Big Bertha\'s joints and buzz to her side!');
                for (const i of e.targets) this.burst(G, i, 'gears', false, 14);
                H.order(B.order);
                this.wait = 0.8;
                break;
            }
            case 'fleeFail': H.log('Could not get away!'); this.wait = 0.6; break;
            case 'fled': H.log('You got away.'); H.sfx('step'); this.wait = 0.5; H.result('fled'); break;
            case 'victory': H.sfx('victory'); H.music(null); H.bark(B.units.find((u) => u.side === 'p' && u.hp > 0), 'win'); this.wait = 0.9; H.result('win', e); break;
            case 'defeat': H.sfx('defeat'); H.music(null); this.wait = 1; H.result('lose'); break;
            default: H.other?.(e); break;
        }
    }

    number(i, text, col, big) {
        const s = this.spots?.[i];
        if (!s) return;
        this.nums.push({ x: s.x + (Math.random() - 0.5) * s.h * 0.2, y: s.foot - s.h * 0.6, text, col, t: 0, big });
    }

    burst(G, i, anim, quiet, n = 18) {
        const cols = FX[anim] || FX.slash;
        let x, y;
        const s = this.spots?.[i];
        if (s) { x = s.x; y = s.foot - s.h * 0.45; }
        else { const r = this.hooks.cardPos?.(i); if (!r) return; x = r.x; y = r.y; }
        if (quiet) n = 8;
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220;
            this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: 0.5 + Math.random() * 0.5, c: cols[k % cols.length], r: 2 + Math.random() * 4 });
        }
        if (anim === 'slash' || anim === 'claw') this.parts.push({ slash: true, x, y, t: 0, life: 0.25, c: '#fff' });
    }

    draw(G, dt) {
        const ctx = this.ctx, d = this.dpr, W = this.w, H = this.h;
        this.tick(G, dt);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 22 : 0;
        this.shake = Math.max(0, this.shake - dt);
        ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, W, H);
        if (this.bg) {
            const s = Math.max(W / this.bg.width, H / this.bg.height) * 1.04;
            const bw = this.bg.width * s, bh = this.bg.height * s;
            ctx.drawImage(this.bg, (W - bw) / 2 + sh, (H - bh) / 2 + Math.sin(this.time * 0.3) * 4, bw, bh);
        }
        const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
        g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(1, 'rgba(10,6,4,0.85)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(30,12,4,0.18)'; ctx.fillRect(0, 0, W, H);
        const B = G.battle;
        if (B && this.disp) {
            for (const [k, s] of Object.entries(this.spots)) {
                const i = +k, u = B.units[i], v = this.disp[i];
                const im = img('enemy', u.id);
                if (!im) continue;
                v.fade = v.alive ? Math.min(1, v.fade + dt * 3) : Math.max(0, v.fade - dt * 1.6);
                if (v.fade <= 0) continue;
                v.flash = Math.max(0, v.flash - dt * 4);
                v.lunge = Math.max(0, v.lunge - dt * 2.5);
                const hh = s.h * (1 + v.lunge * 0.08), ww = hh * im.width / im.height;
                const bob = Math.sin(this.time * 2 + i) * hh * 0.015;
                const x = s.x + sh, foot = s.foot + bob + v.lunge * 16 + (1 - (1 - this.intro) ** 2) * 30;
                ctx.globalAlpha = v.fade * (1 - this.intro * 0.8);
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath(); ctx.ellipse(x, s.foot + 4, ww * 0.35, hh * 0.05, 0, 0, Math.PI * 2); ctx.fill();
                ctx.drawImage(im, x - ww / 2, foot - hh, ww, hh);
                if (v.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = v.flash * 0.7 * v.fade; ctx.drawImage(im, x - ww / 2, foot - hh, ww, hh); ctx.globalCompositeOperation = 'source-over'; }
                ctx.globalAlpha = 1;
                if (v.alive) this.bar(ctx, x, foot + 12, Math.min(150, ww * 0.6), v.hp / v.mhp, u, s.boss);
                if (u.charge && v.alive) { ctx.strokeStyle = `rgba(255,190,90,${0.4 + 0.4 * Math.sin(this.time * 8)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, foot - hh * 0.5, ww * 0.55, hh * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
            }
        }
        // particles
        for (const p of this.parts) {
            p.t += dt;
            if (p.slash) {
                const a = p.t / p.life;
                ctx.strokeStyle = `rgba(255,255,255,${1 - a})`; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.arc(p.x, p.y, 40 + a * 30, -2.3 + a, -0.6 + a); ctx.stroke();
                continue;
            }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
            ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        this.parts = this.parts.filter((p) => p.t < p.life);
        // numbers
        ctx.textAlign = 'center';
        for (const n of this.nums) {
            n.t += dt;
            const a = Math.min(1, 2 - n.t * 2);
            ctx.globalAlpha = Math.max(0, a);
            ctx.font = `800 ${n.big ? 34 : 26}px 'Nunito', sans-serif`;
            ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            const y = n.y - n.t * 50;
            ctx.strokeText(n.text, n.x, y); ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, y);
        }
        ctx.globalAlpha = 1;
        this.nums = this.nums.filter((n) => n.t < 1);
    }

    bar(ctx, x, y, w, f, u, boss) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
        ctx.fillStyle = f > 0.5 ? '#e05a6e' : f > 0.25 ? '#ff9a4a' : '#ff4a5a';
        ctx.fillRect(x - w / 2, y, w * Math.max(0, f), 6);
        ctx.font = `700 ${boss ? 16 : 14}px 'Nunito', sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(u.name, x, y + 24); ctx.fillStyle = boss ? '#ffd77a' : '#f2eaff'; ctx.fillText(u.name, x, y + 24);
        const st = Object.keys(u.st || {}).map((k) => STATUS_NAMES[k]).join(' · ');
        if (st) { ctx.font = '700 12px "Nunito", sans-serif'; ctx.strokeText(st, x, y + 40); ctx.fillStyle = '#ffd77a'; ctx.fillText(st, x, y + 40); }
    }
}
