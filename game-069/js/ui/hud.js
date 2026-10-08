/**
 * hud.js — the race HUD: position, the standings ticker, lap and time, coins, a minimap of the
 * track with every car on it, a speedometer with the nitro gauge round its rim, the countdown,
 * pop-up messages ("FINAL LAP", "+5", "ELIMINATED"), Rowdy Rex on the PA and the wrong-way sign.
 */

import { cssHex } from '../view/textures.js';

const $ = (id) => document.getElementById(id);
export const fmtTime = (t) => {
    if (!isFinite(t) || t <= 0) return '–:––.––';
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};
export const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

export class Hud {
    constructor() {
        this.el = $('hud');
        this.posn = $('h-posn'); this.suf = $('h-suf'); this.of = $('h-of');
        this.board = $('h-board');
        this.lap = $('h-lap'); this.time = $('h-time'); this.best = $('h-best'); this.coins = $('h-coins');
        this.map = $('h-map'); this.mg = this.map.getContext('2d');
        this.speedo = $('h-speedo-cv'); this.sg = this.speedo.getContext('2d');
        this.center = $('h-center'); this.msgBox = $('h-msg'); this.rexEl = $('h-rex'); this.wrongEl = $('h-wrong');
        this.boardT = 0; this.speedT = 0;
        this.rexTimer = 0;
    }

    show(on) { this.el.classList.toggle('hidden', !on); document.body.classList.toggle('racing', on); }

    setup(race, colors, ev) {
        this.race = race;
        this.colors = colors;
        this.ev = ev;
        const tr = race.track;
        // Minimap: fit the track into the canvas once and keep the outline as an image.
        const W = this.map.width, pad = 16;
        const b = tr.bounds;
        const s = (W - pad * 2) / Math.max(b.x1 - b.x0, b.z1 - b.z0);
        const ox = (W - (b.x1 - b.x0) * s) / 2, oz = (W - (b.z1 - b.z0) * s) / 2;
        // Seen from above: +x to the right, +z down the canvas (not mirrored).
        this.mapXf = (x, z) => [ox + (x - b.x0) * s, oz + (z - b.z0) * s];
        const base = document.createElement('canvas');
        base.width = base.height = W;
        const g = base.getContext('2d');
        g.lineJoin = 'round'; g.lineCap = 'round';
        const path = () => {
            g.beginPath();
            for (let i = 0; i <= tr.N; i++) {
                const [x, y] = this.mapXf(tr.px[i % tr.N], tr.pz[i % tr.N]);
                i ? g.lineTo(x, y) : g.moveTo(x, y);
            }
        };
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 9; path(); g.stroke();
        g.strokeStyle = '#e8d4b0'; g.lineWidth = 4.5; path(); g.stroke();
        const [sx, sy] = this.mapXf(tr.px[tr.startI], tr.pz[tr.startI]);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke();
        this.mapBase = base;
        this.of.textContent = race.type === 'tt' ? '' : `/${race.cars.length}`;
        this.coins.textContent = '0';
        this.best.textContent = race.type === 'tt' && race.targets ? `🥇 ${fmtTime(race.targets[0])}` : '';
        this.center.innerHTML = '';
        this.msgBox.innerHTML = '';
        this.wrongEl.classList.add('hidden');
        this.boardT = 0;
        this.renderBoard(true);
    }

    renderBoard(force) {
        const r = this.race;
        if (r.type === 'tt') { this.board.innerHTML = ''; return; }
        const order = r.order;
        const key = order.map((c) => c.id + (c.out ? 'x' : '')).join(',');
        if (!force && key === this.boardKey) return;
        this.boardKey = key;
        this.board.innerHTML = order.map((c, k) => `<li class="${c.id === 0 ? 'me' : ''} ${c.out ? 'out' : ''}"><i>${k + 1}</i><span class="dot" style="background:${cssHex(this.colors[c.id])}"></span><span>${escapeHtml(c.name)}</span></li>`).join('');
    }

    update(dt) {
        const r = this.race, P = r.player;
        const pos = r.posOf(P);
        if (r.type === 'tt') {
            const medal = r.targets ? (r.t <= r.targets[0] ? '🥇' : r.t <= r.targets[1] ? '🥈' : r.t <= r.targets[2] ? '🥉' : '') : '';
            this.posn.textContent = medal || '—'; this.suf.textContent = '';
        } else {
            this.posn.textContent = pos; this.suf.textContent = ordinal(pos);
        }
        const lap = Math.min(r.laps, P.lap + 1);
        this.lap.textContent = `${Math.max(1, lap)}/${r.laps}`;
        const t = r.phase === 'countdown' ? 0 : (P.finished ? P.finishT : r.t);
        this.time.textContent = fmtTime(t);
        if (r.type !== 'tt' && P.best < Infinity) this.best.textContent = `best ${fmtTime(P.best)}`;
        this.coins.textContent = r.coinsGot;
        this.boardT -= dt;
        if (this.boardT <= 0) { this.boardT = 0.25; this.renderBoard(false); }
        this.drawMap();
        this.speedT -= dt;
        if (this.speedT <= 0) { this.speedT = 1 / 30; this.drawSpeedo(P); }
        this.wrongEl.classList.toggle('hidden', !(P.wrongT > 1.2 && !P.finished));
        if (this.rexTimer > 0) { this.rexTimer -= dt; if (this.rexTimer <= 0) this.rexEl.classList.remove('on'); }
    }

    drawMap() {
        const g = this.mg, W = this.map.width;
        g.clearRect(0, 0, W, W);
        g.drawImage(this.mapBase, 0, 0);
        const r = this.race;
        for (let k = r.cars.length - 1; k >= 0; k--) {
            const c = r.cars[k];
            if (c.out && c.parked && r.t - (c.outT || 0) > 2) continue;
            if (r.type === 'tt' && k) continue;
            const [x, y] = this.mapXf(c.x, c.z);
            g.fillStyle = cssHex(this.colors[k]);
            g.strokeStyle = k === 0 ? '#fff' : '#111';
            g.lineWidth = k === 0 ? 2.5 : 1.5;
            g.beginPath(); g.arc(x, y, k === 0 ? 6.5 : 4.5, 0, 7); g.fill(); g.stroke();
        }
    }

    drawSpeedo(P) {
        const g = this.sg, W = this.speedo.width, cx = W / 2, cy = W / 2, R = W * 0.42;
        g.clearRect(0, 0, W, W);
        const kmh = P.speed * 3.6;
        const max = 200;
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        // Dial face.
        const bg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.15);
        bg.addColorStop(0, 'rgba(40,28,18,0.85)'); bg.addColorStop(1, 'rgba(14,9,6,0.85)');
        g.fillStyle = bg;
        g.beginPath(); g.arc(cx, cy, R * 1.12, 0, Math.PI * 2); g.fill();
        // Ticks.
        g.strokeStyle = 'rgba(246,236,216,0.6)';
        for (let v = 0; v <= max; v += 10) {
            const a = a0 + (a1 - a0) * (v / max);
            const big = v % 50 === 0;
            g.lineWidth = big ? 3 : 1.5;
            g.beginPath();
            g.moveTo(cx + Math.cos(a) * R * (big ? 0.78 : 0.85), cy + Math.sin(a) * R * (big ? 0.78 : 0.85));
            g.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95);
            g.stroke();
        }
        // Speed arc.
        const f = Math.min(1, kmh / max);
        const grad = g.createLinearGradient(0, W, W, 0);
        grad.addColorStop(0, '#ffd27a'); grad.addColorStop(1, '#ff5a1a');
        g.strokeStyle = grad; g.lineWidth = W * 0.05; g.lineCap = 'round';
        g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * f); g.stroke();
        // Nitro ring.
        const nf = P.nitro / P.spec.nitroCap;
        g.strokeStyle = 'rgba(74,176,255,0.2)'; g.lineWidth = W * 0.035;
        g.beginPath(); g.arc(cx, cy, R * 0.66, a0, a1); g.stroke();
        g.strokeStyle = P.boosting ? '#e8fbff' : nf > 0.98 ? '#8ae0ff' : '#4ab0ff';
        if (P.boosting || nf > 0.98) { g.shadowColor = '#4ab0ff'; g.shadowBlur = 12; }
        g.beginPath(); g.arc(cx, cy, R * 0.66, a0, a0 + (a1 - a0) * nf); g.stroke();
        g.shadowBlur = 0;
        // Needle.
        const an = a0 + (a1 - a0) * f;
        g.strokeStyle = '#ff3a2a'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(cx - Math.cos(an) * R * 0.1, cy - Math.sin(an) * R * 0.1); g.lineTo(cx + Math.cos(an) * R * 0.9, cy + Math.sin(an) * R * 0.9); g.stroke();
        g.fillStyle = '#2a1a0c'; g.beginPath(); g.arc(cx, cy, W * 0.04, 0, 7); g.fill();
        // Digits.
        g.fillStyle = '#f6ecd8';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `900 ${W * 0.2}px Bungee, Impact, sans-serif`;
        g.fillText(String(Math.round(kmh)), cx, cy + R * 0.42);
        g.font = `700 ${W * 0.065}px Rubik, Arial, sans-serif`;
        g.fillStyle = '#c9b89a';
        g.fillText('KM/H', cx, cy + R * 0.7);
        g.fillStyle = '#8ae0ff';
        g.fillText('N₂O', cx, cy - R * 0.38);
    }

    countdown(n) {
        this.center.innerHTML = `<div class="big-msg">${n}</div>`;
    }
    go() {
        this.center.innerHTML = '<div class="big-msg go">GO!</div>';
        setTimeout(() => { if (this.center.firstChild && this.center.firstChild.classList.contains('go')) this.center.innerHTML = ''; }, 900);
    }
    big(text, sub = '', cls = '') {
        this.center.innerHTML = `<div class="big-msg ${cls}">${text}${sub ? `<small>${sub}</small>` : ''}</div>`;
    }
    clearBig() { this.center.innerHTML = ''; }

    msg(text, cls = '') {
        const d = document.createElement('div');
        d.className = `hmsg ${cls}`;
        d.textContent = text;
        this.msgBox.appendChild(d);
        while (this.msgBox.children.length > 3) this.msgBox.firstChild.remove();
        setTimeout(() => d.remove(), 1900);
    }

    rex(text, t = 4.5) {
        this.rexEl.innerHTML = `<b>📣 Rowdy Rex:</b> ${escapeHtml(text)}`;
        this.rexEl.classList.add('on');
        this.rexTimer = t;
    }
}

export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
