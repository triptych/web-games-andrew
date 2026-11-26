// The six mini-games, drawn in Canvas 2D from G.mini.M (read only). Sized in px from visualViewport, drawn at device
// resolution. Each game fits a square-ish play field centred on the screen, leaving room for the touch pad.

import { MINIS, CAST } from '../sim/data.js';
import { GRADES } from '../sim/minis.js';

const $ = (id) => document.getElementById(id);
const DIRS = ['up', 'right', 'down', 'left'];
const ARROW = { up: '▲', right: '▶', down: '▼', left: '◀' };
const CRYSTAL = ['#ff7a8a', '#ffd56b', '#6fe0ff', '#9f8aff'];
const HELP = {
    echo: 'Watch the crystals sing, then repeat the song with the arrows.',
    runes: 'Enter the rune\'s strokes in order with the arrows before it fades.',
    potion: 'Press A (Space) as the needle crosses the glow. Dead centre is perfect.',
    stars: 'Move ◀ ▶ to catch falling stars. Gold stars are worth three. Dodge the dark comets!',
    rings: 'Steer with the arrows and fly through every ring.',
    fireball: 'Fire into a lane: ◀ left, ▲ middle, ▶ right (or tap the lane). Masks good, Mochi plushies bad!',
};

export class MiniView {
    constructor(audio) {
        this.audio = audio;
        this.canvas = $('mini-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.icons = {};
        for (const k of ['charm', 'moonpetal', 'mochitreat', 'maskshard', 'healing', 'mana', 'gears', 'honeybun', 'moonflower', 'fireopal']) { const im = new Image(); im.src = `art/icons/${k}.webp`; this.icons[k] = im; }
        this.mochi = new Image(); this.mochi.src = 'art/spr/mochi.webp';
        this.flash = 0; this.shake = 0; this.fx = [];
        this.resize();
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth)), h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    }

    /** The play field: a box below the HUD, above the touch pad on phones. */
    field() {
        // a touch screen keeps the pad clear: below the field in portrait, beside it in landscape
        if (this.touch && this.w > this.h) {
            const x0 = 236, x1 = this.w - 120, top = 70;
            const H = Math.max(120, this.h - top - 12), W = Math.min(x1 - x0, H * 1.5);
            return { x: x0 + (x1 - x0 - W) / 2, y: top, w: W, h: H };
        }
        const top = 84, padH = this.touch ? 224 : 20;
        const H = Math.max(160, this.h - top - padH), W = Math.min(this.w - 24, H * 1.35);
        return { x: (this.w - W) / 2, y: top, w: W, h: H };
    }

    onEvent(game, e) {
        const A = this.audio;
        switch (e.type) {
            case 'note': A.note(e.n); break;
            case 'good': A.note(e.n); break;
            case 'miss': case 'fizzle': case 'missRing': case 'comet': case 'oops': A.ui('bad'); this.shake = 0.3; this.flash = -1; break;
            case 'round': case 'rune': A.sfx('charm', { gain: 0.6 }); this.flash = 1; break;
            case 'stroke': A.tone({ freq: 500 + e.i * 90, dur: 0.08, type: 'triangle', vol: 0.12 }); break;
            case 'perfect': A.sfx('water', { gain: 0.8 }); this.flash = 1; this.fx.push({ t: 0, text: 'Perfect!' }); break;
            case 'good': break;
            case 'star': A.tone({ freq: 1200, to: 1600, dur: 0.08, type: 'triangle', vol: 0.12 }); break;
            case 'gold': A.sfx('star', { gain: 0.7 }); this.flash = 1; break;
            case 'ring': A.sfx('wind', { gain: 0.5, rate: 1.3 }); this.flash = 0.6; break;
            case 'hit': A.sfx('fire', { gain: 0.5, rate: 1.3 }); break;
            case 'shot': A.tone({ freq: 300, to: 600, dur: 0.06, type: 'square', vol: 0.05 }); break;
            case 'fade': A.ui('bad'); break;
        }
        if (e.type === 'good' && game === 'potion') this.fx.push({ t: 0, text: 'Good' });
        if (e.type === 'fizzle') this.fx.push({ t: 0, text: 'Fizzle…' });
    }

    hud(S) {
        const M = S.M;
        $('m-name').textContent = MINIS[S.game].name + (S.partner ? ` · with ${CAST[S.partner].name}` : '');
        $('m-score').textContent = `★ ${M.score} / ${M.goal}`;
        const left = M.time ? Math.max(0, Math.ceil(M.time - M.t)) : null;
        $('m-time').textContent = S.game === 'echo' ? `♥ ${M.lives}` : S.game === 'potion' ? `${Math.min(M.k + 1, M.n)} / ${M.n}` : S.game === 'rings' ? `${M.passed} / ${M.rings.length}` : `⏱ ${left}`;
        $('m-help').textContent = M.t < 6 ? HELP[S.game] : '';
        $('m-a').hidden = S.game !== 'potion';
    }

    draw(G, dt, time) {
        this.resize();
        const S = G.mini, M = S.M, c = this.ctx;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        // background
        const g = c.createLinearGradient(0, 0, 0, this.h);
        const bg = { echo: ['#221a52', '#3a2a7a'], runes: ['#1a2450', '#2a3c78'], potion: ['#1a3a40', '#2a5a5a'], stars: ['#0c1030', '#2a1f5a'], rings: ['#5aa8ff', '#cfe8ff'], fireball: ['#3a1a20', '#6a2a2a'] }[S.game];
        g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
        c.fillStyle = g; c.fillRect(0, 0, this.w, this.h);
        if (S.game === 'stars' || S.game === 'echo') for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * ((i * 37) % 7) / 7})`; c.fillRect((i * 151) % this.w, (i * 97) % this.h, 2, 2); }
        this.shake = Math.max(0, this.shake - dt);
        const F = this.field();
        c.save();
        if (this.shake) c.translate((Math.random() - 0.5) * 10 * this.shake, 0);
        this[S.game](c, M, F, time);
        c.restore();
        // flash and floating words
        if (this.flash) {
            c.fillStyle = this.flash > 0 ? `rgba(255,240,180,${this.flash * 0.18})` : `rgba(255,60,80,${-this.flash * 0.18})`;
            c.fillRect(0, 0, this.w, this.h);
            this.flash = this.flash > 0 ? Math.max(0, this.flash - dt * 3) : Math.min(0, this.flash + dt * 3);
        }
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i]; f.t += dt;
            c.globalAlpha = Math.max(0, 1 - f.t);
            c.font = '800 34px "M PLUS Rounded 1c", system-ui'; c.textAlign = 'center'; c.fillStyle = '#ffe38f';
            c.fillText(f.text, this.w / 2, F.y + F.h * 0.25 - f.t * 30);
            c.globalAlpha = 1;
            if (f.t > 1) this.fx.splice(i, 1);
        }
        this.hud(S);
        if (S.result) {
            $('m-grade').textContent = GRADES[S.result.grade];
            $('m-result-text').textContent = `Score ${S.result.score} of ${M.goal}. +${S.result.lumens} lumens${S.partner ? ` · ${CAST[S.partner].name} had fun!` : ''}`;
        }
    }

    // ------------------------------------------------------------------ each game
    echo(c, M, F, time) {
        const cx = F.x + F.w / 2, cy = F.y + F.h / 2, R = Math.min(F.w, F.h) * 0.3;
        const pos = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        // the Prism in the middle
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.arc(cx, cy, R * 0.5, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 4; i++) {
            const x = cx + pos[i][0] * R, y = cy + pos[i][1] * R, lit = M.lit === i;
            const s = R * (lit ? 0.42 : 0.34);
            c.save(); c.translate(x, y);
            if (lit) { c.shadowColor = CRYSTAL[i]; c.shadowBlur = 40; }
            c.fillStyle = lit ? CRYSTAL[i] : CRYSTAL[i] + '66';
            c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.62, 0); c.lineTo(0, s); c.lineTo(-s * 0.62, 0); c.closePath(); c.fill();
            c.shadowBlur = 0; c.fillStyle = '#fff'; c.font = `800 ${Math.round(s * 0.5)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(ARROW[DIRS[i]], 0, 2);
            c.restore();
        }
        c.fillStyle = '#fff'; c.font = '700 18px "M PLUS Rounded 1c", system-ui'; c.textAlign = 'center';
        const seq = M.seqs[Math.min(M.round, M.seqs.length - 1)];
        c.fillText(M.phase === 'show' ? 'Listen…' : M.phase === 'input' ? `Your turn! ${M.i} / ${seq.length}` : M.done ? 'Done!' : `Round ${M.round + 1} of ${M.seqs.length}`, cx, F.y + F.h - 8);
    }

    runes(c, M, F) {
        const cx = F.x + F.w / 2, cy = F.y + F.h * 0.46;
        const n = M.rune.length, size = Math.min(70, (F.w - 40) / n);
        // the rune: a glowing path of its strokes
        let x = 0, y = 0; const pts = [[0, 0]];
        const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        for (const d of M.rune) { x += step[d][0]; y += step[d][1]; pts.push([x, y]); }
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
        const sc = Math.min(F.w * 0.5 / Math.max(1, maxx - minx), F.h * 0.32 / Math.max(1, maxy - miny), 60);
        const ox = cx - (minx + maxx) / 2 * sc, oy = cy - F.h * 0.1 - (miny + maxy) / 2 * sc;
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (let i = 0; i < n; i++) {
            c.strokeStyle = i < M.i ? '#ffe38f' : 'rgba(160,200,255,0.5)'; c.lineWidth = i < M.i ? 10 : 6;
            c.shadowColor = '#9fd8ff'; c.shadowBlur = i < M.i ? 20 : 0;
            c.beginPath(); c.moveTo(ox + pts[i][0] * sc, oy + pts[i][1] * sc); c.lineTo(ox + pts[i + 1][0] * sc, oy + pts[i + 1][1] * sc); c.stroke();
        }
        c.shadowBlur = 0;
        // the strokes as arrows
        const y0 = F.y + F.h * 0.78;
        M.rune.forEach((d, i) => {
            const bx = cx + (i - (n - 1) / 2) * (size + 8);
            c.fillStyle = i < M.i ? '#ffd56b' : i === M.i ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)';
            c.beginPath(); c.roundRect(bx - size / 2, y0 - size / 2, size, size, 12); c.fill();
            c.fillStyle = i < M.i ? '#3a2208' : '#fff'; c.font = `800 ${Math.round(size * 0.5)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(ARROW[d], bx, y0 + 2);
        });
        // the fade timer
        const k = Math.max(0, M.runeT / M.runeMax);
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(F.x + 20, F.y + F.h - 10, F.w - 40, 6);
        c.fillStyle = k > 0.3 ? '#9fd8ff' : '#ff8a8a'; c.fillRect(F.x + 20, F.y + F.h - 10, (F.w - 40) * k, 6);
    }

    potion(c, M, F, time) {
        const cx = F.x + F.w / 2;
        // the cauldron
        const cy = F.y + F.h * 0.42, r = Math.min(F.w, F.h) * 0.22;
        c.fillStyle = '#3a2a2a'; c.beginPath(); c.ellipse(cx, cy + r * 0.4, r * 1.2, r, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = `hsl(${170 + M.k * 25}, 80%, 55%)`; c.beginPath(); c.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 6; i++) { const t = (time * 0.8 + i / 6) % 1; c.fillStyle = `rgba(200,255,250,${1 - t})`; c.beginPath(); c.arc(cx + Math.sin(i * 2.1 + time) * r * 0.6, cy - t * r * 1.4, 4 + t * 8, 0, Math.PI * 2); c.fill(); }
        // the ingredients still to go
        const ing = ['moonpetal', 'honeybun', 'gears', 'moonflower', 'fireopal', 'healing', 'mana', 'charm'];
        for (let i = M.k; i < M.n; i++) { const im = this.icons[ing[i % ing.length]]; if (im.complete) c.drawImage(im, F.x + 10 + (i - M.k) * 44, F.y + 4, 40, 40); }
        // the gauge
        const gx = F.x + 30, gw = F.w - 60, gy = F.y + F.h * 0.78, gh = 30;
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.roundRect(gx, gy, gw, gh, 15); c.fill();
        c.fillStyle = 'rgba(120,255,200,0.55)'; c.fillRect(gx + (M.c - M.w / 2) * gw, gy, M.w * gw, gh);
        c.fillStyle = 'rgba(255,240,160,0.9)'; c.fillRect(gx + (M.c - M.w / 6) * gw, gy, M.w / 3 * gw, gh);
        const nx = gx + M.needle * gw;
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(nx, gy - 6); c.lineTo(nx - 8, gy - 18); c.lineTo(nx + 8, gy - 18); c.closePath(); c.fill();
        c.fillRect(nx - 2, gy - 6, 4, gh + 12);
    }

    stars(c, M, F) {
        const X = (x) => F.x + x * F.w, Y = (y) => F.y + y * F.h;
        for (const s of M.items) {
            const x = X(s.x), y = Y(s.y);
            if (s.kind === 'comet') {
                c.fillStyle = 'rgba(120,60,180,0.35)'; c.beginPath(); c.moveTo(x - 6, y - 40); c.lineTo(x + 6, y - 40); c.lineTo(x, y); c.fill();
                c.fillStyle = '#3a1a5a'; c.beginPath(); c.arc(x, y, 13, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#b070ff'; c.lineWidth = 3; c.stroke();
            } else {
                const r = s.kind === 'gold' ? 16 : 11;
                c.fillStyle = s.kind === 'gold' ? '#ffd56b' : '#e8e0ff'; c.shadowColor = c.fillStyle; c.shadowBlur = 16;
                c.beginPath();
                for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
                c.closePath(); c.fill(); c.shadowBlur = 0;
            }
        }
        // the basket (Lys's star net)
        const bx = X(M.x), by = Y(0.93), bw = M.w * F.w;
        c.fillStyle = M.stun > 0 ? '#ff8a8a' : '#b9a6ff';
        c.beginPath(); c.roundRect(bx - bw / 2, by - 10, bw, 22, 10); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(F.x, Y(0.97), F.w, 2);
    }

    rings(c, M, F, time) {
        const cx = F.x + F.w / 2, cy = F.y + F.h / 2, S = Math.min(F.w, F.h) * 0.5;
        // clouds rushing by
        for (let i = 0; i < 8; i++) { const t = (time * 0.4 + i / 8) % 1, s = 0.2 + t * 2; c.fillStyle = `rgba(255,255,255,${0.35 * t})`; c.beginPath(); c.arc(cx + Math.cos(i * 2.4) * S * s, cy + Math.sin(i * 1.7) * S * 0.6 * s, 30 * s, 0, Math.PI * 2); c.fill(); }
        // rings, far first (perspective: smaller and closer to the centre further away)
        const vis = M.rings.filter((r) => !r.done && r.z < 3).sort((a, b) => b.z - a.z);
        for (const r of vis) {
            const k = 1 / (0.35 + r.z * 1.4);
            const x = cx + r.x * S * k, y = cy + r.y * S * k, rad = M.r * S * k;
            c.strokeStyle = r === vis[vis.length - 1] ? '#ffd56b' : 'rgba(255,213,107,0.6)'; c.lineWidth = Math.max(2, 10 * k);
            c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.stroke();
        }
        // the player on the broom (Kai, from behind)
        const px = cx + M.x * S * 2.2, py = cy + M.y * S * 2.2;
        c.fillStyle = '#8a5a3a'; c.fillRect(px - 34, py + 10, 68, 7);
        c.fillStyle = '#2a3a6a'; c.beginPath(); c.arc(px, py, 18, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1a1a2a'; c.beginPath(); c.arc(px, py - 22, 12, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c8d0e0'; c.fillRect(px - 2, py - 34, 4, 8);
    }

    fireball(c, M, F, time) {
        const lw = F.w / 3;
        for (let l = 0; l < 3; l++) {
            c.fillStyle = l % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)';
            c.fillRect(F.x + l * lw + 4, F.y, lw - 8, F.h);
            c.fillStyle = 'rgba(255,255,255,0.4)'; c.font = '800 22px system-ui'; c.textAlign = 'center';
            c.fillText(['◀', '▲', '▶'][l], F.x + l * lw + lw / 2, F.y + F.h - 12);
        }
        for (const t of M.targets) {
            const x = F.x + t.lane * lw + lw / 2, y = F.y + F.h * 0.42;
            const k = Math.min(1, (M.life - t.t) * 6, t.t * 6);
            const s = Math.min(lw * 0.7, F.h * 0.45) * k;
            if (t.kind === 'mochi') { if (this.mochi.complete) c.drawImage(this.mochi, x - s / 2, y - s / 2, s, s); }
            else {
                c.fillStyle = '#f4f2ff'; c.beginPath(); c.ellipse(x, y, s * 0.34, s * 0.44, 0, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#2a1a3a'; c.beginPath(); c.ellipse(x - s * 0.12, y - s * 0.08, s * 0.06, s * 0.09, 0, 0, Math.PI * 2); c.ellipse(x + s * 0.12, y - s * 0.08, s * 0.06, s * 0.09, 0, 0, Math.PI * 2); c.fill();
                c.beginPath(); c.arc(x, y + s * 0.17, s * 0.08, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#b070ff'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, s * 0.34, s * 0.44, 0, 0, Math.PI * 2); c.stroke();
            }
            c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x - lw * 0.3, y + s * 0.6, lw * 0.6 * (t.t / M.life), 4);
        }
        // Hana's flame at the bottom
        c.fillStyle = '#ff7a3a'; c.shadowColor = '#ff7a3a'; c.shadowBlur = 30;
        c.beginPath(); c.arc(F.x + F.w / 2, F.y + F.h * 0.86 + Math.sin(time * 9) * 3, 14, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    }
}
