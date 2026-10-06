// The in-hole HUD: hole card and stroke pips, boss bar, wind compass, MP, coins, lie line, the
// minimap, spell and item buttons, club selector, swing meter, toasts, banners and damage numbers.

import { SURF } from '../sim/realms.js';
import { SPELLS, SPELL_ORDER, ITEMS, ITEM_ORDER } from '../sim/rpg.js';
import { CLUBS } from '../sim/clubs.js';
import { REALMS } from '../sim/realms.js';
import { OVER } from './swing.js';

const $ = (id) => document.getElementById(id);
const MINI_COL = { [SURF.rough]: '#4a8a34', [SURF.fairway]: '#7ccc4a', [SURF.green]: '#a0f070', [SURF.tee]: '#a0e070', [SURF.sand]: '#f2dca2', [SURF.water]: '#3a9ae0', [SURF.lava]: '#ff6a2a', [SURF.ice]: '#d4f0ff', [SURF.snow]: '#ffffff', [SURF.quick]: '#a87a4a', [SURF.ash]: '#5a4a48', [SURF.cloud]: '#ffffff', [SURF.stone]: '#d8c8a8', [SURF.oob]: '#2a4a2a', [SURF.void]: '#1a1030', [SURF.dune]: '#e2b46a' };
const SPELL_ICON = { mulligan: '⟲', ward: '🌀', fire: '🔥', frost: '❄', seek: '✦' };

export class Hud {
    constructor(app) {
        this.app = app;
        this.el = $('hud');
        this.mini = $('minimap');
        this.mctx = this.mini.getContext('2d');
        this.cache = {};
        this.toasts = $('toasts');
    }

    show(on) { this.el.classList.toggle('hidden', !on); document.body.classList.toggle('in-hole', on); }

    setHole(world, profile) {
        this.world = world;
        const h = world.hole;
        this.cache = {};
        $('hud-boss').classList.toggle('hidden', !h.boss);
        if (h.boss) $('boss-name').textContent = REALMS[h.realm].bossName;
        // minimap base layer
        this.buildMini(world.course);
        // spells and items
        const box = $('hud-spells');
        box.innerHTML = '';
        for (const id of SPELL_ORDER) {
            if (!world.s.spells.includes(id)) continue;
            const S = SPELLS[id];
            const b = document.createElement('button');
            b.className = 'spell'; b.style.setProperty('--c', S.color);
            b.dataset.act = 'spell'; b.dataset.id = id;
            b.title = `${S.name} (${S.mp} MP): ${S.desc}`;
            b.setAttribute('aria-label', S.name);
            b.innerHTML = `<span class="k">${S.key}</span>${SPELL_ICON[id]}<span class="c">${id === 'mulligan' ? world.d.mulliganCost : S.mp}</span>`;
            box.appendChild(b);
        }
        const it = document.createElement('button');
        it.className = 'spell'; it.style.setProperty('--c', '#ffd8a0');
        it.dataset.act = 'items'; it.title = 'Items (Q)'; it.setAttribute('aria-label', 'Items');
        it.innerHTML = '<span class="k">Q</span>🎒<span class="c" id="item-count"></span>';
        box.appendChild(it);
        this.itemMenu = null;
    }

    buildMini(c) {
        const W = 150, H = 210;
        // fit the course bounds (rotated so the hole runs up the map)
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        const yaw = Math.atan2(c.cup.x - c.tee.x, c.cup.z - c.tee.z);
        const cs = Math.cos(yaw), sn = Math.sin(yaw);
        // project: rotate so tee→cup is "up"
        const rot = (x, z) => [x * cs - z * sn, x * sn + z * cs];
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let j = 0; j < c.nz; j += 6) for (let i = 0; i < c.nx; i += 6) {
            const s = c.S[j * c.nx + i];
            if (s === SURF.oob || s === SURF.void) continue;
            const [u, v] = rot(c.x0 + i * c.cell, c.z0 + j * c.cell);
            x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v);
        }
        const pad = 6;
        const sc = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0));
        const ox = W / 2 - ((x0 + x1) / 2) * sc, oy = H / 2 + ((y0 + y1) / 2) * sc;
        this.miniT = (x, z) => { const [u, v] = rot(x, z); return [ox + u * sc, oy - v * sc]; };
        g.fillStyle = c.sky ? '#1a1030' : '#2a4a2a';
        g.fillRect(0, 0, W, H);
        const img = g.getImageData(0, 0, W, H);
        // inverse map each pixel back to the course
        for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
            const u = (px - ox) / sc, v = (oy - py) / sc;
            const x = u * cs + v * sn, z = -u * sn + v * cs;
            const s = c.surfAt(x, z);
            const col = MINI_COL[s] ?? '#ff00ff';
            const k = (py * W + px) * 4;
            img.data[k] = parseInt(col.slice(1, 3), 16); img.data[k + 1] = parseInt(col.slice(3, 5), 16); img.data[k + 2] = parseInt(col.slice(5, 7), 16); img.data[k + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        this.miniBase = cv;
        this.miniYaw = yaw;
    }

    drawMini(w) {
        const g = this.mctx, s = w.s;
        g.drawImage(this.miniBase, 0, 0);
        const T = this.miniT;
        const c = w.course;
        // aim line
        if (s.phase === 'aim') {
            const B = s.ball;
            const [bx, by] = T(B.x, B.z);
            const L = 40 + (s.club === 'driver' ? 150 : s.club === 'iron' ? 100 : s.club === 'wedge' ? 55 : 15);
            const [ax, ay] = T(B.x + Math.sin(s.aimYaw) * L, B.z + Math.cos(s.aimYaw) * L);
            g.strokeStyle = 'rgba(255,255,255,0.9)'; g.setLineDash([4, 3]); g.lineWidth = 2;
            g.beginPath(); g.moveTo(bx, by); g.lineTo(ax, ay); g.stroke(); g.setLineDash([]);
        }
        // monsters
        g.fillStyle = '#ff5a5a';
        for (const m of s.mons) if (m.alive) { const [x, y] = T(m.x, m.z); g.fillRect(x - 1.5, y - 1.5, 3, 3); }
        // cup
        const [cx, cy] = T(c.cup.x, c.cup.z);
        g.fillStyle = s.sealed ? '#c040ff' : '#ff3a4a';
        g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
        // boss
        if (s.boss && s.boss.hp > 0) { const Tg = w.target(); const [x, y] = T(Tg.x, Tg.z); g.fillStyle = '#ffd040'; g.font = 'bold 12px sans-serif'; g.fillText('☠', x - 5, y + 4); }
        // ball
        const [bx, by] = T(s.ball.x, s.ball.z);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 3.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#000'; g.stroke();
    }

    update(w, swing, camYaw, dt) {
        const s = w.s, h = w.hole, c = this.cache;
        // hole line + pips
        const key = `${s.strokes}|${s.limit}`;
        if (c.hole !== key) {
            c.hole = key;
            let pips = '';
            for (let i = 1; i <= s.limit; i++) pips += `<i class="pip${i <= s.strokes ? ' used' : ''}${i === h.par ? ' par' : ''}${i > h.par && i <= s.strokes ? ' over' : ''}"></i>`;
            $('hud-hole').innerHTML = `<div class="hn">${h.id} · ${h.name}</div><div>Par ${h.par} · Stroke ${Math.min(s.limit, s.strokes + (s.phase === 'aim' ? 1 : 0))}</div><div class="pips">${pips}</div>`;
        }
        // boss
        if (s.boss) {
            const nm = s.boss.kind === 'bogey' && s.boss.phase === 2 ? 'Triple Bogey' : REALMS[h.realm].bossName;
            if (c.bossName !== nm) { c.bossName = nm; $('boss-name').textContent = nm; }
            const pct = Math.max(0, s.boss.hp / s.boss.max) * 100;
            if (c.boss !== pct) { c.boss = pct; $('boss-fill').style.width = pct + '%'; }
        }
        // wind relative to the camera
        const rel = Math.atan2(s.wind.x, s.wind.z) - camYaw;
        const wkey = `${rel.toFixed(2)}|${s.wind.speed}`;
        if (c.wind !== wkey) {
            c.wind = wkey;
            $('wind-arrow').style.transform = `rotate(${(-rel * 180) / Math.PI - 90}deg)`;
            $('wind-sp').textContent = s.wind.speed < 0.3 ? 'Calm' : `${s.wind.speed.toFixed(1)} mph`;
            $('wind-arrow').style.opacity = s.wind.speed < 0.3 ? 0.3 : 1;
        }
        const mpk = `${s.mp}|${s.maxMp}`;
        if (c.mp !== mpk) { c.mp = mpk; $('mp-fill').style.width = (s.mp / s.maxMp) * 100 + '%'; $('mp-num').textContent = `${s.mp}/${s.maxMp}`; }
        const coins = s.stats.coins + s.stats.gems * 10;
        if (c.coins !== coins) { c.coins = coins; $('hud-coins').textContent = `🪙 ${coins}  ⭐ ${s.stats.monsters}`; }
        // lie line
        if (s.phase === 'aim') {
            const L = w.lieInfo();
            const lk = `${L.label}|${Math.round(L.dist)}|${Math.round(L.elev)}|${s.club}`;
            if (c.lie !== lk) {
                c.lie = lk;
                const el = Math.round(L.elev);
                $('hud-lie').innerHTML = `<b>${Math.round(L.dist)} yd</b> to ${s.sealed ? 'the boss' : 'the pin'}${Math.abs(el) >= 1 ? ` · ${el > 0 ? '▲' : '▼'}${Math.abs(el)}` : ''} · Lie: <b>${L.label}</b>`;
            }
        }
        $('hud-lie').style.visibility = s.phase === 'aim' ? 'visible' : 'hidden';
        // club
        if (c.club !== s.club) { c.club = s.club; $('club-name').textContent = CLUBS[s.club].name; }
        // spells
        const sk = `${s.mp}|${s.armed.spell}|${s.armed.item}|${s.phase}|${!!s.prev}|${Object.values(s.items).join(',')}`;
        if (c.spells !== sk) {
            c.spells = sk;
            for (const b of document.querySelectorAll('#hud-spells .spell[data-act="spell"]')) {
                const id = b.dataset.id;
                const cost = id === 'mulligan' ? w.d.mulliganCost : SPELLS[id].mp;
                b.disabled = s.phase !== 'aim' || s.mp < cost || (id === 'mulligan' && !s.prev);
                b.classList.toggle('armed', s.armed.spell === id);
            }
            const n = ITEM_ORDER.reduce((a, k) => a + (s.items[k] || 0), 0);
            const ic = document.getElementById('item-count');
            if (ic) ic.textContent = s.armed.item ? ITEMS[s.armed.item].icon : n;
            const ib = document.querySelector('#hud-spells .spell[data-act="items"]');
            if (ib) { ib.disabled = s.phase !== 'aim' || n === 0; ib.classList.toggle('armed', !!s.armed.item); }
        }
        // swing meter
        this.drawMeter(swing, w);
        $('btn-swing').disabled = s.phase !== 'aim';
        $('btn-swing').textContent = swing.state === 'idle' ? 'SWING' : swing.state === 'power' ? 'POWER!' : 'AIM!';
        this.drawMini(w);
    }

    drawMeter(swing, w) {
        // the bar maps m ∈ [−OVER, 1] onto [0%, 100%]
        const pos = (m) => ((m + OVER) / (1 + OVER)) * 100;
        const zone = swing.state === 'idle' ? w.d.perfectZone * (this.app.settings.gentle ? 1.6 : 1) : swing.zone;
        const zk = zone.toFixed(3);
        if (this.cache.zone !== zk) { this.cache.zone = zk; const z = document.getElementById('meter-zone'); z.style.left = pos(-zone) + '%'; z.style.width = pos(zone) - pos(-zone) + '%'; }
        document.getElementById('meter-mark').style.left = pos(swing.m) + '%';
        const fill = document.getElementById('meter-fill');
        fill.style.left = pos(0) + '%';
        fill.style.width = Math.max(0, pos(swing.state === 'acc' ? swing.power : Math.max(0, swing.m)) - pos(0)) + '%';
        const pw = document.getElementById('meter-power');
        pw.style.display = swing.state === 'acc' ? 'block' : 'none';
        pw.style.left = pos(swing.power) + '%';
    }

    toast(text, img = null, ms = 3200) {
        const d = document.createElement('div');
        d.className = 'toast';
        d.innerHTML = (img ? `<img src="${img}" alt="">` : '') + `<span>${text}</span>`;
        this.toasts.appendChild(d);
        while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
        setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 450); }, ms);
    }

    banner(text, sub = '', sad = false, ms = 1800) {
        const b = $('banner');
        b.className = 'big-banner' + (sad ? ' sad' : '');
        b.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
        clearTimeout(this.bannerT);
        this.bannerT = setTimeout(() => b.classList.add('hidden'), ms);
    }

    dmg(x, y, text, color = '#fff') {
        const d = document.createElement('div');
        d.className = 'dmg'; d.textContent = text; d.style.left = x - 20 + 'px'; d.style.top = y - 30 + 'px'; d.style.color = color;
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 1150);
    }

    holeCard(world, on) {
        const el = $('hole-card');
        if (!on) { el.classList.add('hidden'); return; }
        const h = world.hole;
        el.innerHTML = `<div class="realm">${REALMS[h.realm].name} · Hole ${h.id}</div><div class="nm">${h.name}</div><div class="par">Par ${h.par} · ${Math.round(Math.hypot(world.course.cup.x - world.course.tee.x, world.course.cup.z - world.course.tee.z))} yd · Wind ${world.s.wind.speed.toFixed(0)} mph</div><div class="blurb">${h.blurb ?? ''}</div><div class="skip">tap or press Space to skip</div>`;
        el.classList.remove('hidden');
    }

    itemPicker(world, onPick) {
        const s = world.s;
        const opts = ITEM_ORDER.filter((k) => s.items[k] > 0);
        if (!opts.length) return;
        // a small inline row of choices in a toast-like strip
        const strip = document.createElement('div');
        strip.className = 'toast';
        strip.style.pointerEvents = 'auto';
        strip.innerHTML = opts.map((k) => `<button class="btn small${s.armed.item === k ? ' on' : ''}" data-item="${k}" title="${ITEMS[k].desc}">${ITEMS[k].icon} ${ITEMS[k].name} ×${s.items[k]}</button>`).join(' ') + ' <button class="btn small ghost" data-item="">✕</button>';
        strip.style.flexWrap = 'wrap';
        strip.addEventListener('click', (e) => { const b = e.target.closest('[data-item]'); if (!b) return; onPick(b.dataset.item); strip.remove(); });
        this.toasts.appendChild(strip);
        this.itemMenu = strip;
    }
    closeItems() { if (this.itemMenu) { this.itemMenu.remove(); this.itemMenu = null; } }
}
