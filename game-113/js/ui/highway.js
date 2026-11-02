// The note highway: a Canvas 2D overlay. One lane per princess in the band (packed together, left to right), notes falling
// to a glowing hit line above the touch pads. The band's notes are gems in the lane's colour (sung notes carry their
// syllable); the enemy's are dark spiky stars; holds have tails; the Colossus's notes are gold bars across every lane.
// It also draws the judgments, the combo, the phrase banners and the count-in. Reads G only.

import { CHARS } from '../sim/data/chars.js';
import { WINDOWS } from '../config.js';

const LANE_COL = ['#ff6fa6', '#46e0cf', '#ffc23d', '#9b8cff'];
const ROLE_GLYPH = ['●', '♪', '', '◆'];
const KEYS = [['D', '←'], ['F', '↓'], ['J', '↑'], ['K', '→']];
export const LEAD_BEATS = [0, 4, 3.2, 2.6, 2.1, 1.7];       // note speed setting 1..5

export class Highway {
    constructor(canvas) {
        this.c = canvas;
        this.x = canvas.getContext('2d');
        this.flash = [0, 0, 0, 0];
        this.pops = [];
        this.banner = null;
        this.comboPop = 0;
        this.layout = null;
        this.speed = 3;
        this.showKeys = true;
        this.offset = 0;
    }

    resize(w, h, touch) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w !== this.w || h !== this.h || dpr !== this.dpr || touch !== this.touch) {
            this.w = w; this.h = h; this.dpr = dpr; this.touch = touch;
            this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
            this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
            this.layoutFor = null;
        }
    }

    /** Lane columns for the band now: { lanes: [{ lane, x, w }], hitY, topY, padH }. */
    computeLayout(B) {
        const key = B.lanes.map((l) => (l ? 1 : 0)).join('') + this.w + 'x' + this.h + this.touch;
        if (this.layoutFor === key) return this.layout;
        const present = B.lanes.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
        const n = Math.max(1, present.length);
        const portrait = this.h > this.w;
        const maxW = portrait ? this.w - 20 : Math.min(this.w * 0.5, 120 * Math.max(n, 2));
        const lw = Math.min(portrait ? 120 : 104, maxW / n);
        const total = lw * n;
        const x0 = (this.w - total) / 2;
        const padH = this.touch ? Math.min(110, Math.max(84, this.h * 0.12)) : 46;
        const bottom = this.h - padH - (this.touch ? 18 : 22) - (portrait ? 0 : 0);
        const travel = portrait ? Math.min(this.h * 0.46, 480) : Math.min(this.h * 0.58, 470);
        this.layout = { lanes: present.map((lane, i) => ({ lane, x: x0 + i * lw, w: lw })), hitY: bottom, topY: bottom - travel, padH, x0, total, lw };
        this.layoutFor = key;
        return this.layout;
    }

    onEvents(G, events) {
        const B = G.battle;
        for (const e of events) {
            if (e.type === 'tap') this.flash[e.lane] = 1;
            else if (e.type === 'judge') {
                this.flash[e.lane] = 1;
                const label = e.side === 'enemy' ? (e.j === 'perfect' ? 'PARRY!' : e.j === 'good' ? 'GRAZE' : 'BLOCK') : e.j === 'perfect' ? 'PERFECT' : e.j === 'great' ? 'GREAT' : 'GOOD';
                this.pop(e.lane, label, e.side === 'enemy' ? '#ffffff' : e.j === 'perfect' ? '#fff6a8' : e.j === 'great' ? '#9affd8' : '#c8d0ff', e.j === 'perfect' ? 1.15 : 1);
                if (B && B.combo > 4 && B.combo % 10 === 0) this.comboPop = 1;
            } else if (e.type === 'miss') {
                if (e.lane >= 0) this.pop(e.lane, 'MISS', '#ff6a7a', 0.9);
            } else if (e.type === 'hurt' && e.dmg > 0) this.pop(e.lane, 'OUCH', '#ff4a5a', 0.9);
            else if (e.type === 'colossusHit') this.pop(-1, e.j === 'perfect' ? 'AURELIAN CANNON!' : 'CANNON!', '#ffe27a', 1.3);
            else if (e.type === 'phrase') {
                if (e.kind === 'play') this.banner = { text: '♪ YOUR TURN — PLAY!', col: '#fff1c4', t: 0, sub: 'Hit the notes in your lanes' };
                else if (e.kind === 'guard') this.banner = { text: '⚔ GUARD!', col: '#ffb0c0', t: 0, sub: 'Block the spiky notes' };
                else if (e.kind === 'solo') this.banner = { text: '♥ KEEP THE BEAT', col: '#ffb3cf', t: 0, sub: '' };
            } else if (e.type === 'crescendo') this.banner = { text: '✦ CRESCENDO ✦', col: '#ffffff', t: 0, sub: 'Double damage!', big: true };
            else if (e.type === 'enemyDown') this.banner = { text: 'VICTORY', col: '#ffe27a', t: 0, sub: '', big: true };
            else if (e.type === 'bandDown') this.banner = { text: 'THE SONG FADES…', col: '#c8b8ff', t: 0, sub: '' };
            else if (e.type === 'ko') this.pop(e.lane, 'SILENCED', '#a8a8c8', 1);
            else if (e.type === 'revive') this.pop(CHARS[e.who].lane, 'BACK!', '#ffe27a', 1);
        }
    }
    pop(lane, text, col, scale = 1) {
        this.pops.push({ lane, text, col, t: 0, scale });
        if (this.pops.length > 14) this.pops.shift();
    }

    draw(G, dt, time) {
        const x = this.x, B = G.battle;
        x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        x.clearRect(0, 0, this.w, this.h);
        if (!B) return;
        const L = this.computeLayout(B);
        const lead = (LEAD_BEATS[this.speed] || 2.6) * B.spb;
        const now = B.t + this.offset;
        const span = L.hitY - L.topY;
        const yOf = (t) => L.hitY - ((t - now) / lead) * span;
        const guard = B.ph.kind === 'guard';
        const talk = B.state === 'talk';
        const fadeAll = talk ? 0.35 : 1;
        x.globalAlpha = fadeAll;

        // ---- lanes
        const beatPh = B.t >= 0 ? (B.t / B.spb) % 1 : 1;
        const pulse = Math.exp(-beatPh * 5);
        for (const ln of L.lanes) {
            const id = B.lanes[ln.lane], down = G.party.st[id].hp <= 0;
            const g = x.createLinearGradient(0, L.topY - 40, 0, L.hitY + 30);
            const col = down ? '#5a5a6a' : LANE_COL[ln.lane];
            g.addColorStop(0, 'rgba(10,8,20,0)');
            g.addColorStop(0.35, guard ? 'rgba(60,10,30,0.42)' : 'rgba(12,10,28,0.42)');
            g.addColorStop(1, guard ? 'rgba(80,10,40,0.62)' : 'rgba(14,12,34,0.62)');
            x.fillStyle = g;
            x.fillRect(ln.x + 2, L.topY - 40, ln.w - 4, L.hitY - L.topY + 70);
            // lane edges in the princess's colour
            x.fillStyle = hexA(col, 0.25 + this.flash[ln.lane] * 0.5);
            x.fillRect(ln.x + 2, L.topY - 40, 2, L.hitY - L.topY + 70);
            x.fillRect(ln.x + ln.w - 4, L.topY - 40, 2, L.hitY - L.topY + 70);
            // a press lights the lane up
            if (this.flash[ln.lane] > 0) {
                const fg = x.createLinearGradient(0, L.hitY - 160, 0, L.hitY);
                fg.addColorStop(0, hexA(col, 0)); fg.addColorStop(1, hexA(col, 0.45 * this.flash[ln.lane]));
                x.fillStyle = fg; x.fillRect(ln.x + 4, L.hitY - 160, ln.w - 8, 160);
            }
            // beat lines
            if (B.t >= -4 * B.spb) {
                const b0 = Math.ceil(now / B.spb);
                for (let b = b0; b * B.spb < now + lead; b++) {
                    const y = yOf(b * B.spb);
                    x.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
                    x.fillRect(ln.x + 4, y, ln.w - 8, b % 4 === 0 ? 2 : 1);
                }
            }
            // the receptor
            const ry = L.hitY;
            x.save();
            x.shadowColor = col; x.shadowBlur = 14 + pulse * 10 + this.flash[ln.lane] * 16;
            x.strokeStyle = hexA(col, down ? 0.4 : 0.85); x.lineWidth = 3;
            roundRect(x, ln.x + 8, ry - 14, ln.w - 16, 28, 12); x.stroke();
            x.restore();
            x.fillStyle = hexA(col, 0.12 + this.flash[ln.lane] * 0.35 + pulse * 0.08);
            roundRect(x, ln.x + 8, ry - 14, ln.w - 16, 28, 12); x.fill();
            if (down) { x.fillStyle = '#c8c8d8'; x.font = 'bold 22px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✕', ln.x + ln.w / 2, ry); }
            // key caps under the lanes on a keyboard
            if (!this.touch && this.showKeys) {
                x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = '600 13px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
                x.fillText(`${KEYS[ln.lane][0]}  ${KEYS[ln.lane][1]}`, ln.x + ln.w / 2, ry + 30);
            }
            this.flash[ln.lane] = Math.max(0, this.flash[ln.lane] - dt * 6);
        }
        // the hit line
        x.fillStyle = `rgba(255,255,255,${0.35 + pulse * 0.35})`;
        x.fillRect(L.x0, L.hitY - 1, L.total, 2);

        // ---- notes: tails first, then heads
        const laneX = new Map(L.lanes.map((ln) => [ln.lane, ln]));
        const vis = [];
        for (const n of B.notes) {
            if (n.t - now > lead * 1.05) break;
            if (n.j === 'gone') continue;
            const end = n.t + n.len;
            if (n.j && !n.holding && (n.kind !== 'hold' || end < now - 0.1) && n.t < now - 0.02) continue;
            if (!n.j && n.t < now - 0.25) continue;
            if (n.kind === 'colossus') { vis.push(n); continue; }
            if (!laneX.has(n.lane)) continue;
            vis.push(n);
            if (n.kind === 'hold') {
                const ln = laneX.get(n.lane);
                const yHead = n.holding ? L.hitY : yOf(n.t), yTail = Math.max(L.topY - 30, yOf(end));
                if (yHead > yTail) {
                    const col = n.side === 'enemy' ? '#ff3a6a' : LANE_COL[n.lane];
                    x.fillStyle = hexA(col, n.holding ? 0.7 : n.dropped ? 0.15 : 0.42);
                    roundRect(x, ln.x + ln.w / 2 - 9, yTail, 18, yHead - yTail, 9); x.fill();
                    if (n.holding) { x.fillStyle = hexA('#ffffff', 0.35 + Math.sin(time * 30) * 0.15); roundRect(x, ln.x + ln.w / 2 - 4, yTail, 8, yHead - yTail, 4); x.fill(); }
                }
            }
        }
        for (const n of vis) {
            if (n.j && n.kind !== 'hold' && n.kind !== 'colossus') continue;
            if (n.holding) continue;
            const y = yOf(n.t);
            if (y < L.topY - 40) continue;
            const a = Math.min(1, (y - (L.topY - 40)) / 50);
            x.globalAlpha = a * fadeAll;
            if (n.kind === 'colossus') { if (!n.j) drawColossus(x, L.x0 - 6, y, L.total + 12, time); continue; }
            const ln = laneX.get(n.lane);
            const cx = ln.x + ln.w / 2;
            if (n.side === 'enemy') drawSpike(x, cx, y, Math.min(24, ln.w * 0.26), time + n.id);
            else drawGem(x, cx, y, ln.w, n, B);
        }
        x.globalAlpha = fadeAll;

        // ---- judgments
        for (let i = this.pops.length - 1; i >= 0; i--) {
            const p = this.pops[i];
            p.t += dt;
            if (p.t > 0.7) { this.pops.splice(i, 1); continue; }
            const ln = laneX.get(p.lane);
            const cx = p.lane < 0 ? L.x0 + L.total / 2 : ln ? ln.x + ln.w / 2 : L.x0 + L.total / 2;
            const y = L.hitY - 44 - p.t * 50;
            x.globalAlpha = Math.min(1, (0.7 - p.t) * 4) * fadeAll;
            x.font = `900 ${Math.round((p.lane < 0 ? 22 : 15) * p.scale * (1 + Math.max(0, 0.15 - p.t)))}px system-ui, sans-serif`;
            x.textAlign = 'center'; x.textBaseline = 'middle';
            outlined(x, p.text, cx, y, p.col);
        }
        x.globalAlpha = fadeAll;

        // ---- combo
        if (B.combo >= 4 && B.state === 'run') {
            this.comboPop = Math.max(0, this.comboPop - dt * 3);
            const s = 1 + this.comboPop * 0.4;
            x.font = `900 ${Math.round(30 * s)}px system-ui, sans-serif`; x.textAlign = 'center';
            outlined(x, String(B.combo), L.x0 + L.total / 2, L.topY - 14, '#ffffff');
            x.font = '700 11px system-ui, sans-serif';
            outlined(x, 'COMBO', L.x0 + L.total / 2, L.topY + 8, '#ffe27a');
        }

        // ---- banners and the count-in
        if (B.t < 0 && B.state === 'run') {
            const n = Math.ceil(-B.t / B.spb);
            const f = (-B.t / B.spb) % 1;
            x.globalAlpha = Math.min(1, f * 3);
            x.font = `900 ${Math.round(64 + (1 - f) * 20)}px system-ui, sans-serif`; x.textAlign = 'center';
            outlined(x, n <= 4 ? String(n) : '', this.w / 2, (L.topY + L.hitY) / 2, '#ffffff');
            x.globalAlpha = 1;
        }
        if (this.banner) {
            const b = this.banner;
            b.t += dt;
            if (b.t > 1.4) this.banner = null;
            else {
                const k = b.t < 0.15 ? b.t / 0.15 : b.t > 1.1 ? (1.4 - b.t) / 0.3 : 1;
                x.globalAlpha = k * fadeAll;
                const y = L.topY + (L.hitY - L.topY) * 0.35;
                x.font = `900 ${b.big ? 40 : 28}px system-ui, sans-serif`; x.textAlign = 'center';
                outlined(x, b.text, this.w / 2, y, b.col);
                if (b.sub) { x.font = '600 14px system-ui, sans-serif'; outlined(x, b.sub, this.w / 2, y + 28, '#ffffff'); }
            }
        }
        x.globalAlpha = 1;
    }
}

function drawGem(x, cx, y, lw, n, B) {
    const col = LANE_COL[n.lane];
    const w = Math.min(lw - 18, 76), h = n.syl ? 26 : 22;
    x.save();
    x.shadowColor = col; x.shadowBlur = 12;
    const g = x.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, col); g.addColorStop(1, shade(col, -0.35));
    x.fillStyle = g;
    if (n.lane === 3) { x.beginPath(); x.moveTo(cx - w / 2, y); x.lineTo(cx, y - h / 2 - 2); x.lineTo(cx + w / 2, y); x.lineTo(cx, y + h / 2 + 2); x.closePath(); x.fill(); }
    else { roundRect(x, cx - w / 2, y - h / 2, w, h, h / 2); x.fill(); }
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1.5;
    if (n.lane !== 3) { roundRect(x, cx - w / 2, y - h / 2, w, h, h / 2); x.stroke(); }
    x.fillStyle = '#1a1028'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (n.syl) { x.font = `800 ${Math.min(15, Math.floor(w / Math.max(3, n.syl.length) * 1.5))}px system-ui, sans-serif`; x.fillText(n.syl.replace(/-$/, '–'), cx, y + 1); }
    else { x.font = '900 14px serif'; x.fillText(n.lane === 0 && n.drum === 'T' ? '◉' : ROLE_GLYPH[n.lane] || '●', cx, y + 1); }
}
function drawSpike(x, cx, y, r, seed) {
    x.save();
    x.shadowColor = '#ff2a5a'; x.shadowBlur = 16;
    x.beginPath();
    const k = 8, rot = seed * 0.7;
    for (let i = 0; i < k * 2; i++) { const a = rot + (i / (k * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r; x.lineTo(cx + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    x.closePath();
    const g = x.createRadialGradient(cx, y, 2, cx, y, r);
    g.addColorStop(0, '#ffd0e0'); g.addColorStop(0.35, '#d8285a'); g.addColorStop(1, '#3a0a2a');
    x.fillStyle = g; x.fill();
    x.restore();
    x.strokeStyle = '#ffb0c8'; x.lineWidth = 1.2; x.stroke();
}
function drawColossus(x, x0, y, w, time) {
    x.save();
    x.shadowColor = '#ffd35c'; x.shadowBlur = 24;
    const g = x.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#a8701a'); g.addColorStop(0.5, '#fff1a0'); g.addColorStop(1, '#a8701a');
    x.fillStyle = g; roundRect(x, x0, y - 13, w, 26, 13); x.fill();
    x.restore();
    x.fillStyle = '#3a2408'; x.font = '900 15px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('★  SPACE / ★  ★', x0 + w / 2, y + 1);
}
function outlined(x, text, cx, y, col) {
    x.lineJoin = 'round'; x.lineWidth = 5; x.strokeStyle = 'rgba(10,6,20,0.9)';
    x.strokeText(text, cx, y); x.fillStyle = col; x.fillText(text, cx, y);
}
function roundRect(x, X, Y, W, H, r) {
    r = Math.min(r, W / 2, H / 2);
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}
function hexA(hex, a) { const v = parseInt(hex.slice(1), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${Math.max(0, Math.min(1, a))})`; }
function shade(hex, t) { const v = parseInt(hex.slice(1), 16); const f = (c) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t); return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`; }
export { LANE_COL };
void WINDOWS;
