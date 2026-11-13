// The 2D layer over the 3D view: floating combat numbers, monster health bars and elite names, item labels (Alt),
// town names. Drawn on its own canvas at device resolution, so text stays sharp.
//
// Numbers: white physical, blue lightning, violet shadow, orange fire; crits bigger and gold; numbers on one
// enemy within 0.15 s merge into one, so a storm of hits stays readable. Damage to the player is red.

import { RARITIES } from '../sim/data/items.js';
import { MONSTERS, ELITE_AFFIXES } from '../sim/data/monsters.js';
import { NPCS } from '../sim/data/world.js';
import { passesFilter } from '../sim/act.js';

const EL = { phys: '#f4ead8', lightning: '#8ad8ff', shadow: '#c890ff', fire: '#ffa050', cold: '#90e8ff' };

export class Overlay {
    constructor(view, canvas) {
        this.view = view; this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nums = [];           // { x, y, h, text, color, size, t, life, vx, id }
        this.labels = [];         // { x, y, w, h, id } for clicks
        this.numbers = true;
    }

    resize(w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;
        this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    }

    onEvents(G, events) {
        if (!this.numbers) return;
        for (const e of events) {
            if (e.type === 'hit') {
                // merge rapid hits on one target
                const last = this.nums.find((n) => n.id === e.id && n.t < 0.15 && !n.crit && !e.crit);
                if (last) { last.amt += e.amt; last.text = String(last.amt); continue; }
                this.nums.push({ id: e.id, x: e.x, y: e.y, h: 2.0, amt: e.amt, text: String(e.amt), crit: e.crit, color: e.crit ? '#ffd84a' : EL[e.el] || '#fff', size: e.crit ? 24 : 16, t: 0, life: 0.9, vx: (Math.random() - 0.5) * 30 });
            } else if (e.type === 'hurt') {
                const P = G.player;
                this.nums.push({ id: -1, x: P.x, y: P.y, h: 2.2, text: '-' + e.amt, color: '#ff5050', size: 18, t: 0, life: 1.0, vx: -20 });
            } else if (e.type === 'heal' && e.amt >= 5) {
                const P = G.player;
                this.nums.push({ id: -2, x: P.x, y: P.y, h: 2.4, text: '+' + e.amt, color: '#70ff90', size: 15, t: 0, life: 0.9, vx: 20 });
            } else if (e.type === 'gold') {
                this.nums.push({ id: -3, x: e.x, y: e.y, h: 1.0, text: '+' + e.amt + 'g', color: '#ffd060', size: 14, t: 0, life: 0.9, vx: 0 });
            }
        }
        if (this.nums.length > 160) this.nums.splice(0, this.nums.length - 160);
    }

    frame(G, dt, time, ui) {
        const c = this.ctx, v = this.view, P = G.player;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.clearRect(0, 0, v.w, v.h);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineJoin = 'round';
        const text = (s, x, y, size, color, weight = 700, stroke = 3) => {
            c.font = `${weight} ${size}px 'Alegreya Sans', system-ui, sans-serif`;
            c.lineWidth = stroke; c.strokeStyle = 'rgba(0,0,0,0.85)';
            c.strokeText(s, x, y); c.fillStyle = color; c.fillText(s, x, y);
        };
        // monster bars and names
        for (const m of G.mons) {
            if (m.life <= 0 || m.boss) continue;
            if (!(m.elite || m.life < m.max) || Math.abs(m.x - P.x) > 22 || Math.abs(m.y - P.y) > 18) continue;
            const def = MONSTERS[m.kind];
            const s = v.screenOf(m.x, m.y, def.h * (m.elite ? 1.25 : 1.1));
            const w = m.elite && !m.elite.minion ? 70 : 40;
            c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(s.x - w / 2, s.y, w, 5);
            c.fillStyle = m.elite?.tier === 'rare' ? '#ffd84a' : m.elite?.tier === 'champion' ? '#5b8cff' : '#d0303a';
            c.fillRect(s.x - w / 2, s.y, (w * m.life) / m.max, 5);
            if (m.elite && !m.elite.minion) {
                const name = m.elite.tier === 'rare' ? m.elite.name : `${m.elite.affixes.map((a) => ELITE_AFFIXES[a].name).join(' ')} ${def.name}`;
                text(name, s.x, s.y - 9, 13, m.elite.tier === 'rare' ? '#ffd84a' : '#8ab0ff');
                if (m.elite.tier === 'rare') text(m.elite.affixes.map((a) => ELITE_AFFIXES[a].name).join(' · '), s.x, s.y - 23, 11, '#d8c8a0', 400, 2);
            }
        }
        // town names
        if (G.area.kind === 'town') {
            for (const f of G.features) {
                const name = f.kind === 'npc' ? NPCS[f.id].name : { stash: 'Stash', waystone: 'Waystone', obelisk: f.locked ? 'Rift Obelisk (dormant)' : 'Rift Obelisk', shrine: 'Shrine of Oaths', portal: 'Portal' }[f.kind];
                if (!name) continue;
                const s = v.screenOf(f.x, f.y, f.kind === 'npc' ? 2.3 : 3.0);
                text(name, s.x, s.y, 14, G.near === f.id ? '#ffe08a' : '#e8dcc4');
            }
        }
        const pet = G.pet;
        if (pet.state !== 'away') { const s = v.screenOf(pet.x, pet.y, 1.35); text('Ember', s.x, s.y, 12, pet.state === 'down' ? '#ff7070' : '#c8e8c8', 700, 2); }
        // item labels: legendaries always; everything that passes the filter while Alt is held
        this.labels.length = 0;
        const placed = [];
        for (const d of G.drops) {
            if (!d.item) continue;
            const it = G.items[d.item];
            if (!it) continue;
            const big = it.rarity === 'legendary' || it.rarity === 'mythic' || it.rarity === 'set';
            if (!(ui.labels && (passesFilter(G, it) || ui.allLabels)) && !big) continue;
            if (Math.abs(d.x - P.x) > 22 || Math.abs(d.y - P.y) > 18) continue;
            const s = v.screenOf(d.x, d.y, 0.6);
            c.font = `700 13px 'Alegreya Sans', system-ui, sans-serif`;
            const w = c.measureText(it.name).width + 12, h = 20;
            let y = s.y - 14;
            // push labels apart so they never overlap
            for (let k = 0; k < 12 && placed.some((p) => Math.abs(p.x - s.x) < (p.w + w) / 2 && Math.abs(p.y - y) < h); k++) y -= h + 2;
            placed.push({ x: s.x, y, w });
            c.fillStyle = 'rgba(8,6,10,0.82)'; c.fillRect(s.x - w / 2, y - h / 2, w, h);
            c.strokeStyle = RARITIES[it.rarity]?.color || '#888'; c.lineWidth = 1; c.strokeRect(s.x - w / 2 + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
            c.fillStyle = it.gem ? '#e0c0ff' : RARITIES[it.rarity]?.color || '#ddd'; c.fillText(it.name, s.x, y + 1);
            this.labels.push({ x: s.x - w / 2, y: y - h / 2, w, h, id: d.id });
        }
        // floating numbers
        for (let i = this.nums.length - 1; i >= 0; i--) {
            const n = this.nums[i];
            n.t += dt;
            if (n.t >= n.life) { this.nums.splice(i, 1); continue; }
            const k = n.t / n.life;
            const s = v.screenOf(n.x, n.y, n.h + k * 1.2);
            c.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
            text(n.text, s.x + n.vx * k, s.y, n.size * (n.crit ? 1 + (1 - k) * 0.4 : 1), n.color, 800, 3);
            c.globalAlpha = 1;
        }
        // portal channel bar over the player
        if (P.portalCast > 0) {
            const s = v.screenOf(P.x, P.y, 2.4);
            c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(s.x - 30, s.y, 60, 6);
            c.fillStyle = '#5ab0ff'; c.fillRect(s.x - 30, s.y, 60 * (1 - P.portalCast / 1.2), 6);
        }
    }

    /** The drop whose label is under a client point, or null. */
    labelAt(x, y) {
        for (const l of this.labels) if (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) return l.id;
        return null;
    }
}

