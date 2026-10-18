// The realm map, drawn into the Map tab's own canvas. Reads G; a tap is mapped back to a town through the
// canvas's own bounding rect.

import { TOWNS, TOWN, ROADS, REGIONS } from '../sim/data.js';
import { isOpen, regionOpen, mapPos } from '../sim/world.js';
import { allQuests } from '../sim/economy.js';
import { hash3 } from '../rng.js';

const MW = 1000, MH = 700;

export class MapView {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sel = null;
    }

    fit() {
        const w = Math.max(100, Math.round(this.canvas.parentElement.clientWidth));
        const h = Math.round(w * (MH / MW));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w !== this.w || dpr !== this.dpr) {
            this.w = w; this.h = h; this.dpr = dpr;
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
        }
        this.k = w / MW;
    }

    /** Client px → the nearest town within reach of a fingertip, or null. */
    townAt(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const x = (clientX - r.left) / (r.width / MW), y = (clientY - r.top) / (r.height / MH);
        let best = null, bd = (34 / (r.width / MW)) ** 2;
        for (const t of TOWNS) {
            const d = (t.x - x) ** 2 + (t.y - y) ** 2;
            if (d < bd) { bd = d; best = t.id; }
        }
        return best;
    }

    draw(G, time) {
        this.fit();
        const { ctx, k } = this;
        ctx.setTransform(this.dpr * k, 0, 0, this.dpr * k, 0, 0);
        // parchment
        ctx.fillStyle = '#e6d6b0';
        ctx.fillRect(0, 0, MW, MH);
        for (let i = 0; i < 160; i++) {
            ctx.fillStyle = `rgba(120,90,50,${0.03 + hash3(i, 1, 4) * 0.05})`;
            ctx.beginPath(); ctx.arc(hash3(i, 2, 4) * MW, hash3(i, 3, 4) * MH, 10 + hash3(i, 4, 4) * 40, 0, Math.PI * 2); ctx.fill();
        }
        // regions as soft washes around their towns
        for (const R of REGIONS) {
            const open = regionOpen(G, R.id);
            for (const t of TOWNS.filter((x) => x.region === R.id)) {
                const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 150);
                g.addColorStop(0, hexA(R.color, open ? 0.55 : 0.18)); g.addColorStop(1, hexA(R.color, 0));
                ctx.fillStyle = g; ctx.fillRect(t.x - 150, t.y - 150, 300, 300);
            }
        }
        // the fog over regions still dark
        ctx.font = '700 22px Cinzel, Georgia, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const R of REGIONS) {
            const ts = TOWNS.filter((x) => x.region === R.id);
            const cx = ts.reduce((a, t) => a + t.x, 0) / ts.length, cy = ts.reduce((a, t) => a + t.y, 0) / ts.length;
            ctx.fillStyle = regionOpen(G, R.id) ? 'rgba(70,45,20,0.45)' : 'rgba(70,45,20,0.2)';
            ctx.fillText(R.name, cx, cy - 58);
        }
        // roads
        for (const r of ROADS) {
            const A = TOWN[r.a], B = TOWN[r.b], open = isOpen(G, r);
            ctx.strokeStyle = open ? '#7a5a34' : 'rgba(80,60,40,0.35)';
            ctx.lineWidth = open ? 5 : 3;
            ctx.setLineDash(open ? [] : [8, 10]);
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        }
        ctx.setLineDash([]);
        // the course
        if (G.course) {
            ctx.strokeStyle = 'rgba(200,80,40,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
            const p = mapPos(G), T = TOWN[G.course];
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(T.x, T.y); ctx.stroke(); ctx.setLineDash([]);
        }
        // towns
        const qt = new Set();
        for (const q of allQuests(G)) if (q.town && !q.done) qt.add(q.town);
        ctx.font = '800 17px Nunito, system-ui, sans-serif';
        for (const t of TOWNS) {
            const open = regionOpen(G, t.region);
            const visited = G.towns[t.id].visits > 0;
            if (t.capital) {
                const lit = G.lit[t.region];
                if (lit) {
                    const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 44);
                    g.addColorStop(0, 'rgba(255,210,100,0.8)'); g.addColorStop(1, 'rgba(255,210,100,0)');
                    ctx.fillStyle = g; ctx.fillRect(t.x - 44, t.y - 44, 88, 88);
                }
                ctx.fillStyle = lit ? '#ffcc4a' : open ? '#4a3a2a' : '#8a7a62';
                ctx.beginPath(); ctx.moveTo(t.x, t.y - 22); ctx.lineTo(t.x + 12, t.y + 12); ctx.lineTo(t.x - 12, t.y + 12); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.stroke();
            } else {
                ctx.fillStyle = open ? (visited ? '#5a3a1a' : '#a07a4a') : '#b0a080';
                ctx.beginPath(); ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#f0e2c0'; ctx.lineWidth = 3; ctx.stroke();
            }
            if (this.sel === t.id) { ctx.strokeStyle = '#c84a20'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(t.x, t.y, 22, 0, Math.PI * 2); ctx.stroke(); }
            ctx.fillStyle = open ? '#2a1a0a' : 'rgba(60,40,20,0.45)';
            ctx.fillText(t.name, t.x, t.y + 30);
            if (qt.has(t.id)) {
                ctx.fillStyle = '#c83a20';
                ctx.beginPath(); ctx.arc(t.x + 16, t.y - 16, 10, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = '900 14px Nunito, system-ui, sans-serif'; ctx.fillText('!', t.x + 16, t.y - 15);
                ctx.font = '800 17px Nunito, system-ui, sans-serif';
            }
        }
        // the caravan: a lantern that bobs
        const p = mapPos(G), bob = Math.sin(time * 4) * 3;
        const g = ctx.createRadialGradient(p.x, p.y - 26 + bob, 0, p.x, p.y - 26 + bob, 40);
        g.addColorStop(0, 'rgba(255,200,90,0.9)'); g.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 40, p.y - 66 + bob, 80, 80);
        ctx.fillStyle = '#8a4a20'; ctx.fillRect(p.x - 12, p.y - 18 + bob, 24, 14);
        ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 30 + bob, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 2; ctx.stroke();
    }
}

function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
