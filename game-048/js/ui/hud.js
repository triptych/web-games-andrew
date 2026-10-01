/**
 * hud.js — the in-run HUD and the minimap. Called every frame; writes the DOM
 * only when a value actually changed.
 */

import { CLASSES, SKILLS, xpToNext } from '../sim/classes.js';
import { WORLDS, worldOf, floorInWorld } from '../sim/worlds.js';
import { STATUS } from '../sim/combat.js';
import { T } from '../sim/tiles.js';
import { pstats, skillState, alive } from '../sim/game.js';

export const $ = (id) => document.getElementById(id);
const memo = new Map();
function set(id, prop, v) {
    const k = id + '|' + prop;
    if (memo.get(k) === v) return;
    memo.set(k, v);
    const e = $(id);
    if (!e) return;
    if (prop === 'text') e.textContent = v;
    else if (prop === 'html') e.innerHTML = v;
    else if (prop === 'hidden') e.hidden = v;
    else if (prop === 'cls') e.className = v;
    else e.style[prop] = v;
}
export function resetHudMemo() { memo.clear(); }

const ST_COL = { burn: '#ff8a40', poison: '#8aff6a', bleed: '#ff5a6a', frozen: '#9ae0ff', stun: '#ffe06a', root: '#c8a070', weak: '#b0a0c0', mark: '#ff5a8a', haste: '#6ad0ff', shield: '#80c0ff', fear: '#d0d0d0', evade: '#a0ffd0' };

let logSig = '';
export function updateHud(run, ui) {
    const p = run.p;
    const s = pstats(run);
    const C = CLASSES[p.cls];
    set('hero-cls', 'text', C.name);
    set('hero-lvl', 'text', `Lv ${p.lvl}`);
    const hpf = Math.max(0, p.hp / s.hpMax);
    set('hp-fill', 'width', `${(hpf * 100).toFixed(1)}%`);
    set('hp-lag', 'width', `${(hpf * 100).toFixed(1)}%`);
    set('hp-text', 'text', `${Math.max(0, Math.ceil(p.hp))} / ${s.hpMax}`);
    set('oil-fill', 'width', `${(p.oil / p.oilMax * 100).toFixed(1)}%`);
    set('oil-text', 'text', p.oil <= 0 ? 'The Hush gathers…' : `Oil ${Math.ceil(p.oil)} · light ${s.light}`);
    set('oil-bar', 'cls', p.oil < 25 ? 'bar low' : 'bar');
    set('xp-fill', 'width', `${(p.xp / xpToNext(p.lvl) * 100).toFixed(1)}%`);
    const sts = Object.keys(p.st).map((k) => `<span class="st" style="color:${ST_COL[k] || '#fff'}">${STATUS[k] ? STATUS[k].n : k} ${p.st[k].t}</span>`).join('');
    set('statuses', 'html', sts);
    const w = worldOf(run.floor);
    set('floor-label', 'text', run.lv.boss ? `Floor ${run.floor} · Warden` : `Floor ${run.floor}`);
    set('world-label', 'text', `${WORLDS[w].name} · ${floorInWorld(run.floor)}/10`);
    set('gold', 'text', String(p.gold));
    set('ember-n', 'text', `${Math.min(9, p.embers)}/9`);
    // Boss bar.
    const boss = run.mons.find((m) => m.boss && alive(m) && m.awake);
    set('boss-bar', 'hidden', !boss);
    $('hud-center').classList.toggle('boss-on', !!boss);
    if (boss) {
        set('boss-name', 'text', boss.name);
        const f = Math.max(0, boss.hp / boss.hpMax) * 100;
        set('boss-fill', 'width', `${f.toFixed(1)}%`);
        set('boss-lag', 'width', `${f.toFixed(1)}%`);
    }
    // Log: the last five lines.
    const tail = run.log.slice(-5);
    const sig = run.log.length + '|' + (tail.length ? tail[tail.length - 1].text : '');
    if (sig !== logSig) {
        logSig = sig;
        $('log').innerHTML = tail.map((l, i) => `<div class="line ${l.cls}${i < tail.length - 2 ? ' old' : ''}">${escapeHtml(l.text)}</div>`).join('');
    }
    // Skills.
    const skills = C.skills;
    document.querySelectorAll('#skill-row .skill').forEach((b, i) => {
        const id = skills[i];
        const S = SKILLS[id];
        const st = skillState(run, id);
        const ico = b.querySelector('.ico'), cd = b.querySelector('.cd');
        if (ico.textContent !== S.icon) ico.textContent = S.icon;
        const cdT = st.unlocked ? (st.cd > 0 ? String(st.cd) : '') : `L${S.lvl}`;
        if (cd.textContent !== cdT) cd.textContent = cdT;
        b.classList.toggle('locked', !st.unlocked);
        b.classList.toggle('cooling', st.unlocked && st.cd > 0);
        b.classList.toggle('armed', ui.targeting && ui.targeting.skill === id);
        b.title = `${S.n} — ${S.d} (cooldown ${S.cd})`;
    });
    const heals = p.inv.filter((it) => it.b === 'heal' || it.b === 'heal2').reduce((n, it) => n + (it.n || 1), 0);
    set('heal-n', 'text', String(heals));
    const onStairs = run.lv.tiles[p.y * run.lv.w + p.x] === T.STAIRS_DOWN;
    $('btn-stairs').classList.toggle('pulse', onStairs);
    $('btn-heal').classList.toggle('pulse', heals > 0 && p.hp < s.hpMax * 0.3);
}

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// ------------------------------------------------------------------ Map

const TILE_COL = {
    [T.WALL]: '#3a3440', [T.FLOOR]: '#6a6258', [T.MOSS]: '#5a6a4a', [T.RUBBLE]: '#5a5248', [T.DOOR]: '#a07040', [T.DOOR_OPEN]: '#8a6040',
    [T.STAIRS_DOWN]: '#ffcf6a', [T.STAIRS_UP]: '#9a9080', [T.SHALLOW]: '#3a6a9a', [T.DEEP]: '#1a3a6a', [T.LAVA]: '#ff5010', [T.CHASM]: '#000000',
    [T.BRIDGE]: '#8a6a40', [T.PILLAR]: '#4a4450', [T.VAULT_DOOR]: '#ffd040', [T.PROP]: '#5a4a3a', [T.ICE]: '#9ad0f0', [T.SEALED]: '#6a6258',
};

/** Draw the floor (seen tiles), the hero, visible foes, items and people. */
export function drawMap(canvas, run, opts = {}) {
    const lv = run.lv;
    const big = !!opts.big;
    if (big) { canvas.width = lv.w * 12; canvas.height = lv.h * 12; }
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const sc = Math.min(W / lv.w, H / lv.h);
    const ox = (W - lv.w * sc) / 2, oy = (H - lv.h * sc) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const vis = run._t.vis;
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
        const i = y * lv.w + x;
        if (!lv.seen[i]) continue;
        const t = lv.tiles[i];
        ctx.fillStyle = TILE_COL[t] || '#555';
        ctx.globalAlpha = vis[i] ? 1 : 0.55;
        ctx.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc));
    }
    ctx.globalAlpha = 1;
    const dot = (x, y, col, r = 0.45) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox + (x + 0.5) * sc, oy + (y + 0.5) * sc, Math.max(1.5, sc * r), 0, 7); ctx.fill(); };
    for (const fi of run.items) if (lv.seen[fi.y * lv.w + fi.x]) dot(fi.x, fi.y, fi.it.k === 'gold' ? '#ffcf6a' : '#6ac8ff', 0.3);
    for (const o of run.objs) {
        if (o.gone || !lv.seen[o.y * lv.w + o.x]) continue;
        if (o.k === 'trap') { if (!o.hidden) dot(o.x, o.y, '#ff3030', 0.25); continue; }
        if (o.k === 'npc' || o.k === 'merchant' || o.k === 'captive') { if (big) { ctx.fillStyle = '#ffd040'; ctx.font = `bold ${sc * 1.1}px sans-serif`; ctx.fillText('!', ox + x(o) * sc + sc * 0.3, oy + (o.y + 0.9) * sc); } else dot(o.x, o.y, '#ffd040', 0.4); continue; }
        if (o.k === 'chest' && !o.open) dot(o.x, o.y, '#d0a040', 0.35);
        if (o.k === 'brazier') dot(o.x, o.y, o.lit ? '#ff9040' : '#6a4a30', 0.35);
        if (o.k === 'shrine' || o.k === 'fountain') dot(o.x, o.y, o.used ? '#666' : '#a0e0ff', 0.35);
    }
    for (const m of run.mons) if (alive(m) && !m.dormant && vis[m.y * lv.w + m.x]) dot(m.x, m.y, m.ally ? '#60ff90' : m.boss ? '#ff40ff' : '#ff4a4a', m.boss ? 0.8 : 0.42);
    // Stairs marker.
    if (lv.seen[lv.down.y * lv.w + lv.down.x] && lv.tiles[lv.down.y * lv.w + lv.down.x] === T.STAIRS_DOWN) {
        ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = Math.max(1, sc * 0.2);
        ctx.strokeRect(ox + lv.down.x * sc - sc * 0.3, oy + lv.down.y * sc - sc * 0.3, sc * 1.6, sc * 1.6);
    }
    dot(run.p.x, run.p.y, '#ffffff', 0.6);
    if (big) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + (run.p.x + 0.5) * sc, oy + (run.p.y + 0.5) * sc, sc * 1.4, 0, 7); ctx.stroke(); }
}
const x = (o) => o.x;
