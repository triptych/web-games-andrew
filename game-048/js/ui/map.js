/**
 * map.js — the sector map. The boss sits at the top; you climb from the
 * bottom row. Edges are SVG, nodes are buttons.
 */

import { $, el } from './dom.js';
import { NODE_TYPES, nextNodes } from '../sim/sector.js';
import { CHAPTER_INFO } from '../sim/story.js';
import { iconURL } from '../view/art.js';
import { fmt } from '../sim/format.js';
import { sound } from '../audio.js';

export const NODE_ICON = {
    battle: ['blade', '#45f3ff'], elite: ['heavy', '#ffc843'], event: ['quest', '#c49cff'], salvage: ['scrap', '#d6a46a'],
    depot: ['chassis', '#ffd36a'], rest: ['repair', '#46ff9a'], boss: ['core', '#ff4d6d'],
};

export function renderMap(p, maxHp, onPick) {
    const s = p.sector;
    const info = CHAPTER_INFO[s.chapter];
    $('#map-kicker').textContent = `Chapter ${s.chapter}${s.threat ? ` · Threat ${s.threat}` : ''} · ${info.place}`;
    $('#map-title').textContent = info.name;
    $('#map-hp').style.width = `${Math.max(0, (100 * s.hp) / maxHp)}%`;
    $('#map-hp-t').textContent = `${fmt(s.hp)} / ${fmt(maxHp)}`;
    const scroll = $('#map-scroll');
    const W = Math.min(820, window.innerWidth - 24);
    const gap = window.innerHeight < 560 ? 84 : 104;
    const Hh = (s.rows - 1) * gap + 140;
    const canvas = $('#map-canvas');
    canvas.style.width = `${W}px`;
    canvas.style.height = `${Hh}px`;
    const pos = (n) => ({ x: n.x * W, y: Hh - 70 - n.r * gap });
    const avail = new Set(nextNodes(s).map((n) => n.id));
    const svg = $('#map-svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    svg.innerHTML = '';
    const NS = 'http://www.w3.org/2000/svg';
    for (const n of s.nodes) {
        for (const id of n.edges) {
            const m = s.nodes.find((q) => q.id === id);
            const a = pos(n), b = pos(m);
            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
            line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
            const walked = s.done.includes(n.id) && s.done.includes(id);
            const next = n.id === s.at && avail.has(id);
            line.setAttribute('stroke', walked ? '#45f3ff' : next ? '#ffd36a' : 'rgba(120,150,220,0.28)');
            line.setAttribute('stroke-width', walked || next ? 3 : 2);
            if (!walked) line.setAttribute('stroke-dasharray', '6 6');
            svg.append(line);
        }
    }
    const nodes = $('#map-nodes');
    nodes.innerHTML = '';
    for (const n of s.nodes) {
        const [ic, col] = NODE_ICON[n.type];
        const P = pos(n);
        const isAvail = avail.has(n.id);
        const done = s.done.includes(n.id);
        const b = el('button', {
            class: `node ${n.type === 'boss' ? 'boss' : ''} ${isAvail ? 'avail' : ''} ${done ? 'done' : ''} ${s.at === n.id ? 'here' : ''} ${!isAvail && !done ? 'locked' : ''}`,
            style: { left: `${P.x}px`, top: `${P.y}px` },
            title: `${NODE_TYPES[n.type].name}: ${NODE_TYPES[n.type].desc}`,
            'data-type': n.type, 'data-id': n.id,
            disabled: !isAvail,
            onclick: () => { sound.click(); onPick(n.id); },
        }, el('img', { src: iconURL(ic, col, 72), alt: '' }), isAvail || n.type === 'boss' ? el('span', { class: 'lbl' }, NODE_TYPES[n.type].name) : null);
        nodes.append(b);
    }
    const legend = $('#map-legend');
    legend.innerHTML = '';
    for (const t in NODE_ICON) legend.append(el('span', {}, el('img', { src: iconURL(NODE_ICON[t][0], NODE_ICON[t][1], 36), alt: '' }), NODE_TYPES[t].name));
    // scroll so the next row is in view
    const nextRow = s.at === null ? 0 : (s.nodes.find((q) => q.id === s.at)?.r ?? 0) + 1;
    requestAnimationFrame(() => { scroll.scrollTop = Math.max(0, Hh - 70 - nextRow * gap - scroll.clientHeight * 0.65); });
}
