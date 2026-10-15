// The battle scene: a backdrop for where you are, the foes in a row, you (from behind) and Wick.
// It draws a *display* copy of the battle that the UI's director updates event by event, so hits
// land when they're shown, not all at once when the sim resolves the round.

import { FOE } from '../sim/data/enemies.js';
import { GRIMOIRE } from '../sim/data/books.js';
import { ZONES } from '../sim/data/world.js';
import { foeFrame, personFrame, wickFrame, PLAYER_LOOK, icon } from './sprites.js';

const ELEM_COL = {
    light: '#ffe58a', wind: '#bff0ee', fire: '#ff9a4a', stone: '#c8b49a', frost: '#cfeeff', water: '#6ab8f0',
    small: '#f2b8de', growth: '#8fe07a', echo: '#d8c8ff', unbind: '#f0d070', sky: '#ffffff', star: '#a8a8ff',
};

const BACKDROP = {
    farm: ['#9fd4f0', '#d8f0f8', '#7cba54', '#5a9a40'], meadow: ['#9fd4f0', '#e0f4fa', '#7cba54', '#5a9a40'],
    village: ['#9fd4f0', '#e0f4fa', '#7cba54', '#5a9a40'], wood: ['#6aa86a', '#a8d4a0', '#4f8a3c', '#3a6a2a'],
    hill: ['#a8d8f4', '#e8f6fc', '#82b65a', '#5e943e'], moor: ['#a8acb4', '#d8dce0', '#8e9460', '#6a704a'],
    abbeyg: ['#7a7488', '#b8b2c8', '#7c8460', '#5a6248'], thorn: ['#5a7a4a', '#9ab88a', '#557a3c', '#3e5c2c'],
    quarry: ['#c8c0b0', '#e8e0d0', '#a8a294', '#888072'], peak: ['#b8d8f0', '#f4faff', '#eef4fa', '#c8d8e8'],
    coast: ['#8ad0f4', '#e8f8ff', '#ecd9a0', '#c8b07a'], lake: ['#8ac8f0', '#d8f0fc', '#4a90cc', '#3474ac'],
    willow: ['#8cc8d8', '#d0ecf0', '#64a65c', '#4a8a48'], sky: ['#9ab8f0', '#e8f0ff', '#c8c4dc', '#a8a4c4'],
    green: ['#9fd4c0', '#e0f8f0', '#74b85c', '#5a9a48'],
};
const ROOMDROP = {
    bark: ['#3a2a1a', '#6a4a2a', '#8a6038', '#6a4428'], cave: ['#1e1a24', '#3a3444', '#6a6070', '#4a4452'],
    brick: ['#3a2420', '#6a3a2a', '#9a7a64', '#7a5a48'], rock: ['#3a342e', '#6a6054', '#9a9080', '#7a7064'],
    ice: ['#4a7a9a', '#a8d4ec', '#cfe8f4', '#a0c8e0'], burrow: ['#3a2a1e', '#6a4a32', '#9a7452', '#7a5a3e'],
    glass: ['#3a6a4a', '#a8d8c8', '#6a9a5a', '#4a7a40'], coral: ['#1e3a44', '#4a7a8a', '#7aa0a8', '#5a8890'],
    abbey: ['#26222e', '#4a4458', '#8a8494', '#6a6474'], castle: ['#3e3a44', '#6a6474', '#b8b0a0', '#9a9284'],
    sky: ['#2e2a5a', '#6a66a4', '#c8c4dc', '#a8a4c4'], ink: ['#06040c', '#1a1428', '#3a3448', '#2a2438'],
    library: ['#3a2618', '#6a4a32', '#a87a4e', '#8a643e'],
};

export class BattleView {
    constructor() { this.disp = null; this.t = 0; this.fx = []; this.shake = 0; }

    begin(G, M) {
        const B = G.battle;
        let back;
        if (M.kind === 'world') back = BACKDROP[ZONES[M.zoneOf[Math.floor(G.p.y) * M.w + Math.floor(G.p.x)]].biome] || BACKDROP.meadow;
        else back = ROOMDROP[M.style] || ROOMDROP.cave;
        this.back = back;
        this.indoor = M.kind !== 'world';
        this.final = !!(B.boss && FOE[B.boss].final);
        this.disp = {
            foes: B.foes.map((f) => ({ n: f.n, id: f.id, hp: f.max, max: f.max, calm: false, flash: 0, shake: 0, appear: 0, gone: 0, book: null, charge: false, name: f.name })),
        };
        this.fx.length = 0;
        this.t = 0;
        this.you = { flash: 0, shake: 0, act: 0 };
        this.wickAct = 0;
    }

    end() { this.disp = null; }

    layout(vw, vh) {
        const live = this.disp.foes.filter((f) => !f.gone || f.gone < 1.2);
        const n = live.length;
        const pos = {};
        live.forEach((f, i) => {
            const big = FOE[f.id].boss;
            const spread = Math.min(vw * 0.78, 80 * n);
            const x = n === 1 ? vw / 2 : vw / 2 - spread / 2 + spread * i / (n - 1);
            pos[f.n] = { x: Math.round(x), y: Math.round(vh * (big ? 0.34 : 0.37)), s: big ? (this.final ? 96 : 72) : 40 };
        });
        return pos;
    }

    foePos(n, vw, vh) { return this.layout(vw, vh)[n] || { x: vw / 2, y: vh * 0.4, s: 32 }; }
    youPos(vw, vh) { return { x: Math.round(Math.max(26, vw * 0.14)), y: Math.round(vh * 0.56) }; }

    // ---- effects the director asks for
    hit(n, elem, weak) {
        const f = this.disp.foes.find((x) => x.n === n);
        if (!f) return;
        f.flash = 0.25; f.shake = weak ? 0.4 : 0.25;
        this.fx.push({ kind: 'burst', n, c: ELEM_COL[elem] || '#ffffff', t: 0, life: 0.5 });
    }
    cast(elem, n) { this.fx.push({ kind: 'bolt', n, c: ELEM_COL[elem] || '#ffffff', t: 0, life: 0.45, from: 'you' }); this.you.act = 0.4; }
    wick(n) { this.fx.push({ kind: 'bolt', n, c: '#ffb03a', t: 0, life: 0.4, from: 'wick' }); this.wickAct = 0.4; }
    ouch() { this.you.flash = 0.3; this.shake = 0.3; }
    heal() { this.fx.push({ kind: 'heal', t: 0, life: 0.8 }); }
    calm(n, book) {
        const f = this.disp.foes.find((x) => x.n === n);
        if (!f) return;
        f.calm = true; f.gone = 0.001; f.book = book;
        this.fx.push({ kind: 'calm', n, t: 0, life: 1.4 });
    }
    join(n, id, name) { this.disp.foes.push({ n, id, hp: 0, max: 1, calm: false, flash: 0, shake: 0, appear: 0.001, gone: 0, book: null, name }); }
    charge(n, on) { const f = this.disp.foes.find((x) => x.n === n); if (f) f.charge = on; }

    draw(ctx, vw, vh, dt) {
        if (!this.disp) return;
        this.t += dt;
        const [sky, haze, gnd, gndD] = this.back;
        let sx = 0, sy = 0;
        if (this.shake > 0) { this.shake -= dt; sx = Math.round((Math.random() - 0.5) * 4); sy = Math.round((Math.random() - 0.5) * 3); }
        ctx.save();
        ctx.translate(sx, sy);
        // backdrop
        const gr = ctx.createLinearGradient(0, 0, 0, vh * 0.6);
        gr.addColorStop(0, sky); gr.addColorStop(1, haze);
        ctx.fillStyle = gr; ctx.fillRect(-4, -4, vw + 8, vh + 8);
        if (!this.indoor) {
            // soft hills and clouds
            ctx.fillStyle = mixA(gnd, 0.55);
            for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(vw * (i / 4), vh * 0.48, vw * 0.22, vh * 0.12, 0, Math.PI, 0); ctx.fill(); }
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (let i = 0; i < 4; i++) { const x = ((i * 97 + this.t * 6) % (vw + 80)) - 40; ctx.beginPath(); ctx.ellipse(x, vh * (0.1 + i * 0.06), 22, 6, 0, 0, Math.PI * 2); ctx.fill(); }
        } else {
            // shelves or rock walls in the dark
            ctx.fillStyle = mixA(gndD, 0.5);
            for (let x = 0; x < vw; x += 24) ctx.fillRect(x + 4, vh * 0.08, 16, vh * 0.42);
            ctx.fillStyle = mixA(sky, 0.6);
            for (let x = 0; x < vw; x += 24) for (let y = 0; y < 4; y++) ctx.fillRect(x + 6, vh * 0.12 + y * vh * 0.1, 12, 2);
        }
        if (this.final) {
            ctx.fillStyle = 'rgba(40,20,80,0.35)'; ctx.fillRect(0, 0, vw, vh);
            for (let i = 0; i < 20; i++) { const x = (i * 53 + this.t * 10) % vw, y = (i * 37) % (vh * 0.5); ctx.fillStyle = i % 3 ? '#8a6aff' : '#ffe08a'; ctx.fillRect(x, y, 1, 1); }
        }
        ctx.fillStyle = gnd;
        ctx.fillRect(-4, vh * 0.47, vw + 8, vh * 0.6);
        ctx.fillStyle = gndD;
        ctx.beginPath(); ctx.ellipse(vw / 2, vh * 0.44, vw * 0.42, vh * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = mixA(gndD, 0.5);
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % vw, vh * 0.5 + ((i * 53) % (vh * 0.48)), 2, 1);
        if (!this.indoor) for (let i = 0; i < 14; i++) { ctx.fillStyle = ['#fff4c0', '#f5a3c7', '#9fc8ff'][i % 3]; ctx.fillRect((i * 71 + 13) % vw, vh * 0.52 + ((i * 41) % (vh * 0.44)), 1, 1); }

        // foes
        const pos = this.layout(vw, vh);
        for (const f of this.disp.foes) {
            const p = pos[f.n];
            if (!p) continue;
            const look = FOE[f.id].look;
            const fr = Math.floor(this.t * 3 + f.n) % 2;
            const img = foeFrame(look, fr, p.s);
            let x = p.x - p.s / 2, y = p.y - p.s / 2 + Math.sin(this.t * 2.2 + f.n) * 2;
            if (f.shake > 0) { f.shake -= dt; x += Math.round(Math.sin(this.t * 60) * 3); }
            if (f.charge) { x += Math.round(Math.sin(this.t * 40)); }
            if (f.appear) { f.appear += dt; if (f.appear > 0.5) f.appear = 0; }
            ctx.fillStyle = 'rgba(20,14,24,0.3)';
            ctx.beginPath(); ctx.ellipse(p.x, p.y + p.s * 0.48, p.s * 0.35, p.s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
            if (f.gone) {
                f.gone += dt;
                const k = Math.min(1, f.gone / 0.7);
                ctx.globalAlpha = 1 - k;
                ctx.drawImage(img, Math.round(x), Math.round(y - k * 6));
                ctx.globalAlpha = 1;
                // it becomes a book (or a treat) and floats up
                const bk = icon(f.book ? 'book' : 'coin', f.book ? '#c8a060' : null, 2);
                ctx.globalAlpha = Math.min(1, k * 1.5) * (f.gone > 1.6 ? Math.max(0, 1 - (f.gone - 1.6) * 2) : 1);
                ctx.drawImage(bk, Math.round(p.x - 12), Math.round(p.y - 12 - (f.gone > 0.8 ? (f.gone - 0.8) * 20 : 0)));
                ctx.globalAlpha = 1;
                continue;
            }
            if (f.appear) ctx.globalAlpha = f.appear * 2;
            ctx.drawImage(img, Math.round(x), Math.round(y));
            if (f.flash > 0) {
                f.flash -= dt;
                ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
                ctx.drawImage(img, Math.round(x), Math.round(y));
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.globalAlpha = 1;
        }

        // you and Wick, from behind
        const you = this.youPos(vw, vh);
        const youImg = personFrame(PLAYER_LOOK, 'up', this.you.act > 0 ? 1 : 0, 'player');
        if (this.you.act > 0) this.you.act -= dt;
        ctx.fillStyle = 'rgba(20,14,24,0.3)';
        ctx.beginPath(); ctx.ellipse(you.x, you.y + 22, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.drawImage(youImg, you.x - 16, you.y - 24, 32, 48);
        if (this.you.flash > 0) {
            this.you.flash -= dt;
            ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff6a6a'; ctx.fillRect(you.x - 14, you.y - 22, 28, 44); ctx.globalAlpha = 1;
        }
        const wx = you.x + 30 + Math.sin(this.t * 1.7) * 3, wy = you.y - 22 + Math.sin(this.t * 2.6) * 3 - (this.wickAct > 0 ? 6 : 0);
        if (this.wickAct > 0) this.wickAct -= dt;
        ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffb03a'; ctx.beginPath(); ctx.arc(wx, wy + 10, 13, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.drawImage(wickFrame((this.t * 1.2) % 1), Math.round(wx - 14), Math.round(wy - 6), 28, 32);

        // effects
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const e = this.fx[i];
            e.t += dt;
            if (e.t > e.life) { this.fx.splice(i, 1); continue; }
            const k = e.t / e.life;
            const tp = pos[e.n] || { x: vw / 2, y: vh * 0.4, s: 32 };
            if (e.kind === 'bolt') {
                const fx0 = e.from === 'wick' ? wx : you.x, fy0 = e.from === 'wick' ? wy + 8 : you.y - 10;
                const x = fx0 + (tp.x - fx0) * k, y = fy0 + (tp.y - fy0) * k - Math.sin(k * Math.PI) * 20;
                ctx.fillStyle = e.c;
                for (let j = 0; j < 6; j++) ctx.fillRect(Math.round(x - (tp.x - fx0) * 0.03 * j), Math.round(y - (tp.y - fy0) * 0.03 * j), 3 - (j > 2), 3 - (j > 2));
            } else if (e.kind === 'burst') {
                for (let j = 0; j < 12; j++) {
                    const a = j / 12 * Math.PI * 2, r = 4 + k * tp.s * 0.6;
                    ctx.fillStyle = j % 2 ? e.c : '#ffffff';
                    ctx.globalAlpha = 1 - k;
                    ctx.fillRect(Math.round(tp.x + Math.cos(a) * r), Math.round(tp.y + Math.sin(a) * r), 2, 2);
                }
                ctx.globalAlpha = 1;
            } else if (e.kind === 'calm') {
                for (let j = 0; j < 16; j++) {
                    const a = j / 16 * Math.PI * 2 + k * 3, r = tp.s * 0.4 * (1 - k * 0.5);
                    ctx.fillStyle = j % 3 ? '#fff4c0' : '#ffd0e8';
                    ctx.globalAlpha = 1 - k;
                    ctx.fillRect(Math.round(tp.x + Math.cos(a) * r), Math.round(tp.y + Math.sin(a) * r - k * 10), 1 + (j % 2), 1 + (j % 2));
                }
                ctx.globalAlpha = 1;
            } else if (e.kind === 'heal') {
                for (let j = 0; j < 10; j++) {
                    ctx.fillStyle = j % 2 ? '#8fe07a' : '#e8ffd8';
                    ctx.globalAlpha = 1 - k;
                    ctx.fillRect(Math.round(you.x - 14 + j * 3), Math.round(you.y + 10 - k * 40 - (j % 3) * 6), 2, 2);
                }
                ctx.globalAlpha = 1;
            }
        }
        ctx.restore();
    }
}

function mixA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export { ELEM_COL };
void GRIMOIRE;
