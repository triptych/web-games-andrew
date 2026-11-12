// HOLLOWDEEP — the party bar, the dungeon HUD (floor, danger gauge, compass, minimap, stairs prompt) and the full map.

import { $, el, porUrl, statusText } from './common.js';
import { CLASSES } from '../sim/data/classes.js';
import { heroStats } from '../sim/stats.js';
import { getFloor, open } from '../sim/dungeon.js';
import { stratumOf } from '../sim/data/monsters.js';
import { isSeen, tileAt, floorState } from '../sim/game.js';
import { FRONT, PARTY_MAX } from '../config.js';

const DIRS = ['N', 'E', 'S', 'W'];

export class Hud {
    constructor() {
        this.cards = {};
        this.onPrompt = null;
    }

    // ------------------------------------------------------------ party
    party(G, { active = null } = {}) {
        const box = $('party');
        const ids = G.party.slice(0, PARTY_MAX);
        const key = ids.join(',');
        if (key !== this.key) {
            this.key = key;
            box.textContent = '';
            this.cards = {};
            for (const [i, id] of ids.entries()) {
                const c = G.roster.find((x) => x.id === id);
                const card = el('div.pc' + (i >= FRONT ? '.back' : ''), { 'data-cid': id }, [
                    el('div.face', { style: `background-image:url(${porUrl(c.por)})` }),
                    el('div.stats', {}, [
                        el('div.nm'), el('div.cl'),
                        el('div.bar.hp', {}, el('i')), el('div.num.hpn'),
                        el('div.bar.mp', {}, el('i')),
                    ]),
                    el('div.st'),
                ]);
                box.append(card);
                this.cards[id] = card;
            }
            for (let i = ids.length; i < PARTY_MAX; i++) box.append(el('div.pc.empty', { text: 'empty' }));
        }
        for (const id of ids) {
            const c = G.roster.find((x) => x.id === id), card = this.cards[id];
            if (!c || !card) continue;
            const s = heroStats(c);
            card.querySelector('.nm').textContent = c.name;
            card.querySelector('.cl').textContent = `${CLASSES[c.cls].name} ${c.lv}`;
            card.querySelector('.hp i').style.width = `${Math.max(0, (c.hp / s.hp) * 100)}%`;
            card.querySelector('.mp i').style.width = s.mp ? `${(c.mp / s.mp) * 100}%` : '0%';
            card.querySelector('.mp').style.visibility = s.mp ? 'visible' : 'hidden';
            card.querySelector('.hpn').textContent = `${c.hp}/${s.hp}` + (s.mp ? `  ${c.mp}/${s.mp}` : '');
            card.querySelector('.st').textContent = statusText(c.st);
            card.classList.toggle('dead', c.hp <= 0);
            card.classList.toggle('active', id === active);
        }
    }

    cardRect(cid) { return this.cards[cid]?.getBoundingClientRect(); }
    flashCard(cid, cls) {
        const c = this.cards[cid];
        if (!c) return;
        c.classList.remove(cls); void c.offsetWidth; c.classList.add(cls);
        setTimeout(() => c.classList.remove(cls), 400);
    }

    // ------------------------------------------------------------ dungeon HUD
    dungeon(G) {
        const { stratum, cycle } = stratumOf(G.floor);
        $('hud-stratum').textContent = (cycle ? 'Echoing ' : '') + stratum.name;
        $('hud-depth').textContent = `B${G.floor}F`;
        $('hud-compass').textContent = DIRS[G.pos.d];
        const g = Math.min(1, Math.max(0, G.danger));
        const gi = $('hud-gauge').firstElementChild;
        gi.style.width = `${g * 100}%`;
        gi.style.background = g < 0.45 ? '#59c46a' : g < 0.75 ? '#e2b33c' : '#e2493c';
        const t = tileAt(G, G.pos.x, G.pos.y);
        const prompt = t === 'down' ? `Descend to B${G.floor + 1}F` : t === 'up' ? (G.floor === 1 ? 'Climb back to Brindlemoor' : `Climb to B${G.floor - 1}F`) : null;
        const p = $('hud-prompt');
        if (prompt !== this.prompt) {
            this.prompt = prompt;
            p.textContent = '';
            p.hidden = !prompt;
            if (prompt) p.append(el('button.btn', { text: `${prompt}  ⏎`, onclick: () => this.onPrompt?.() }));
        }
        this.minimap(G);
    }

    minimap(G) {
        const cv = $('minimap');
        const r = 6;
        this._map(G, cv, G.pos.x - r, G.pos.y - r, r * 2 + 1, true);
    }

    bigmap(G) {
        const f = getFloor(G.seed, G.floor);
        $('map-title').textContent = `B${G.floor}F — ${stratumOf(G.floor).stratum.name}`;
        this._map(G, $('bigmap'), 0, 0, Math.max(f.w, f.h), false);
    }

    _map(G, cv, ox, oy, n, rotate) {
        const ctx = cv.getContext('2d');
        const W = cv.width;
        const c = W / n;
        const f = getFloor(G.seed, G.floor);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#07070c';
        ctx.fillRect(0, 0, W, W);
        if (rotate) {
            // the minimap turns with the party: up is the way you face
            ctx.translate(W / 2, W / 2);
            ctx.rotate(-G.pos.d * Math.PI / 2);
            ctx.translate(-W / 2, -W / 2);
        }
        const st = floorState(G, G.floor);
        for (let y = oy; y < oy + n; y++) {
            for (let x = ox; x < ox + n; x++) {
                if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
                const i = y * f.w + x;
                if (!isSeen(G, G.floor, i)) continue;
                const px = (x - ox) * c, py = (y - oy) * c;
                if (open(f, x, y)) {
                    ctx.fillStyle = '#3a3448';
                    ctx.fillRect(px, py, c, c);
                    const t = tileAt(G, x, y);
                    const mark = { down: ['#ffcf5a', '▼'], up: ['#9fe0ff', '▲'], boss: ['#c48cff', '◆'], chest: ['#e8b04a', '■'], chest_open: ['#6d5a3a', '□'], fountain: ['#5fd0ff', '◎'], glint: ['#fff3a0', '✦'], delver: ['#9fd0ff', '☺'] }[t];
                    if (mark) {
                        ctx.fillStyle = mark[0];
                        ctx.font = `${Math.max(8, c * 0.8)}px sans-serif`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.save();
                        ctx.translate(px + c / 2, py + c / 2);
                        if (rotate) ctx.rotate(G.pos.d * Math.PI / 2);
                        ctx.fillText(mark[1], 0, 0);
                        ctx.restore();
                    }
                } else {
                    ctx.fillStyle = '#a38f5e';
                    ctx.fillRect(px + c * 0.1, py + c * 0.1, c * 0.8, c * 0.8);
                }
            }
        }
        // the reaper, if it can be seen
        if (st.reaper && isSeen(G, G.floor, st.reaper.y * f.w + st.reaper.x)) {
            ctx.fillStyle = '#6dff9a';
            ctx.beginPath(); ctx.arc((st.reaper.x - ox + 0.5) * c, (st.reaper.y - oy + 0.5) * c, c * 0.35, 0, Math.PI * 2); ctx.fill();
        }
        // the party: an arrow
        const px = (G.pos.x - ox + 0.5) * c, py = (G.pos.y - oy + 0.5) * c;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(G.pos.d * Math.PI / 2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(0, -c * 0.45); ctx.lineTo(c * 0.35, c * 0.35); ctx.lineTo(-c * 0.35, c * 0.35); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
}
