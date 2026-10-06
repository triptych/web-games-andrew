// hud.js — DOM bindings for the HUD, setup screen and dialogs. No game logic:
// main.js calls these with the match and the player's choices.

import { THUMBS } from './thumbs.js';
import { SEA_STATES, SEA_EVENTS, EVENT_IDS, PIECE_NAMES } from '../sim/seaEvents.js';
import { LEVELS, material } from '../sim/ai.js';
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE } from '../sim/chess.js';

const $ = (id) => document.getElementById(id);
export { $ };

const CHESS_NAME = ['', 'Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'];
const PIECE_BLURB = {
    [PAWN]: 'A rowboat with a stubby sail. Rows one square forward, two from home, boards diagonally.',
    [KNIGHT]: 'A seahorse-prowed longship that leaps in an L, over anything.',
    [BISHOP]: 'A swift schooner that tacks diagonally as far as the wind allows.',
    [ROOK]: 'A lighthouse on its islet. Glides in straight lines, and the sea can never shift it.',
    [QUEEN]: "Three masts, two gun decks: the Man-o'-War sails any straight line.",
    [KING]: 'The crowned Flagship: one square at a time. Lose it and the war is lost. The sea will never take it.',
};
const LEVEL_DESC = [
    '',
    'Daydreams in the crow\'s nest. Blunders often. A gentle first voyage.',
    'Knows the ropes, still misses things.',
    'A steady sailor who spots most tricks.',
    'Thinks several moves ahead. A real fight.',
    'Ruthless. Reads the sea five to eight moves deep.',
];
export const sideName = (c) => (c === WHITE ? 'Navy' : 'Pirates');

// ---------------------------------------------------------------- toast + tip
let toastTimer = 0;
export function toast(msg, ms = 2200) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
export function tip(text, x, y) {
    const t = $('tip');
    if (!text) { t.hidden = true; return; }
    t.textContent = text;
    t.style.left = `${x}px`; t.style.top = `${y}px`;
    t.hidden = false;
}
export const pieceTitle = (piece) => `${sideName(Math.sign(piece))} ${PIECE_NAMES[Math.abs(piece)]} (${CHESS_NAME[Math.abs(piece)]})`;

// ---------------------------------------------------------------- top bar
export function setTurn(match, opts) {
    const pill = $('turn-pill'), flag = $('turn-flag'), text = $('turn-text');
    const c = match.turn;
    flag.className = 'flagdot' + (c === WHITE ? '' : ' b');
    const check = match.pos.inCheck();
    pill.classList.toggle('check', check && !match.result);
    if (match.result) {
        text.textContent = match.result.winner === 0 ? 'Drawn' : `${sideName(match.result.winner)} win!`;
        return;
    }
    let who = sideName(c);
    if (opts.mode === 'ai') who = c === opts.human ? 'Your move' : `${sideName(c)} thinking`;
    else who = `${sideName(c)} to move`;
    text.textContent = who + (check ? ' · CHECK!' : '');
}

export function setSea(opts) {
    const s = SEA_STATES[opts.sea];
    const on = opts.events.length;
    $('sea-text').textContent = s.chance ? `${s.name} · ${Math.round(s.chance * 100)}%` : s.name;
    $('sea-pill').title = s.chance ? `${s.desc} ${on} of ${EVENT_IDS.length} events enabled.` : s.desc;
}

export function thinking(on, text) {
    $('thinking').hidden = !on;
    if (text) $('thinking-text').textContent = text;
}

// ---------------------------------------------------------------- locker + log
const ORDER = [QUEEN, ROOK, BISHOP, KNIGHT, PAWN];
function lockerRow(el, types, color) {
    el.innerHTML = '';
    const sorted = [...types].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    for (const t of sorted) {
        const img = document.createElement('img');
        img.src = THUMBS[t * color] || '';
        img.alt = PIECE_NAMES[t];
        img.title = pieceTitle(t * color);
        el.append(img);
    }
}
export function setLocker(match) {
    lockerRow($('lost-w'), match.captured.w, 1);
    lockerRow($('lost-b'), match.captured.b, -1);
    const m = material(match.pos);
    $('balance').textContent = m === 0 ? 'Fleets are level' : `${m > 0 ? 'Navy' : 'Pirates'} ahead by ${Math.abs(m / 100).toFixed(0)}`;
}

export function setLog(match) {
    const ol = $('log-list');
    ol.innerHTML = '';
    let row = null;
    for (const e of match.log) {
        if (e.color === WHITE || !row) {
            row = document.createElement('li');
            const n = document.createElement('span'); n.className = 'n'; n.textContent = `${Math.ceil(e.ply / 2)}.`;
            const w = document.createElement('span'); w.className = 'mv';
            const b = document.createElement('span'); b.className = 'mv';
            row.append(n, w, b);
            ol.append(row);
            if (e.color !== WHITE) w.textContent = '…';
        }
        row.children[e.color === WHITE ? 1 : 2].textContent = e.san;
        if (e.event) {
            const li = document.createElement('li');
            li.className = 'ev';
            li.textContent = `${e.event.icon} ${e.event.text}`;
            ol.append(li);
            row = e.color === WHITE ? null : row;
            if (e.color === WHITE) {
                // Black's reply goes on a continuation row after the event.
                row = document.createElement('li');
                const n = document.createElement('span'); n.className = 'n'; n.textContent = '';
                const w = document.createElement('span'); w.className = 'mv'; w.textContent = '…';
                const b = document.createElement('span'); b.className = 'mv';
                row.append(n, w, b);
                ol.append(row);
                row.dataset.pending = '1';
            }
        }
    }
    // Drop an empty trailing continuation row.
    const last = ol.lastElementChild;
    if (last && last.dataset.pending && !last.children[2].textContent) last.remove();
    if (match.result) {
        const li = document.createElement('li');
        li.className = 'res';
        li.textContent = match.result.winner === 0 ? `½-½ ${match.result.reason}` : `${sideName(match.result.winner)} win · ${match.result.reason}`;
        ol.append(li);
    }
    ol.scrollTop = ol.scrollHeight;
}

// ---------------------------------------------------------------- banner
let bannerTimer = 0;
export function showBanner(ev) {
    const b = $('banner');
    const def = SEA_EVENTS[ev.type];
    $('banner-icon').textContent = ev.icon;
    $('banner-title').textContent = ev.name;
    $('banner-text').textContent = ev.text;
    b.className = def.good === true ? 'good' : def.good === false ? 'bad' : '';
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(bannerTimer);
}
export function hideBanner(delay = 0) {
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { $('banner').hidden = true; }, delay);
}

// ---------------------------------------------------------------- setup screen
function chips(el, items, get, set) {
    el.innerHTML = '';
    for (const it of items) {
        const b = document.createElement('button');
        b.className = 'chip';
        b.innerHTML = it.html;
        b.dataset.v = it.v;
        b.addEventListener('click', () => { set(it.v); refresh(); });
        el.append(b);
    }
    const refresh = () => { for (const b of el.children) b.classList.toggle('on', String(get()) === b.dataset.v); };
    refresh();
    return refresh;
}

export function buildSetup(setup, onChange) {
    const refreshers = [];
    const all = () => { refreshers.forEach((r) => r()); sync(); onChange?.(); };
    const bind = (el) => {
        for (const b of el.querySelectorAll('.chip')) b.addEventListener('click', () => { all(); });
    };
    refreshers.push(chips($('opt-mode'), [{ v: 'ai', html: '🧭 vs Computer' }, { v: 'pvp', html: '👥 Two Captains' }], () => setup.mode, (v) => { setup.mode = v; }));
    refreshers.push(chips($('opt-side'), [
        { v: '1', html: `<img alt="" src="${THUMBS[KING] || ''}"> Royal Navy <small>moves first</small>` },
        { v: '-1', html: `<img alt="" src="${THUMBS[-KING] || ''}"> Pirates` },
        { v: '0', html: '🎲 Random' },
    ], () => setup.side, (v) => { setup.side = +v; }));
    refreshers.push(chips($('opt-level'), LEVELS.slice(1).map((l, i) => ({ v: String(i + 1), html: `${'★'.repeat(i + 1)} ${l.name}` })), () => setup.level, (v) => { setup.level = +v; }));
    refreshers.push(chips($('opt-sea'), Object.entries(SEA_STATES).map(([k, s]) => ({ v: k, html: `${{ off: '🪞', calm: '🌤️', choppy: '🌊', tempest: '🌪️' }[k]} ${s.name}` })), () => setup.sea, (v) => { setup.sea = v; }));
    const evEl = $('opt-events');
    evEl.innerHTML = '';
    for (const id of EVENT_IDS) {
        const d = SEA_EVENTS[id];
        const b = document.createElement('button');
        b.className = 'chip';
        b.textContent = `${d.icon} ${d.name}`;
        b.title = d.desc;
        b.addEventListener('click', () => {
            const i = setup.events.indexOf(id);
            if (i >= 0) setup.events.splice(i, 1); else setup.events.push(id);
            all();
        });
        evEl.append(b);
    }
    refreshers.push(() => { [...evEl.children].forEach((b, i) => b.classList.toggle('on', setup.events.includes(EVENT_IDS[i]))); });
    $('ev-all').onclick = () => { setup.events = [...EVENT_IDS]; all(); };
    $('ev-none').onclick = () => { setup.events = []; all(); };
    for (const id of ['opt-mode', 'opt-side', 'opt-level', 'opt-sea']) bind($(id));
    function sync() {
        const ai = setup.mode === 'ai';
        $('field-side').hidden = !ai;
        $('field-level').hidden = !ai;
        $('field-auto').hidden = ai;
        $('field-events').hidden = setup.sea === 'off';
        $('level-desc').textContent = LEVEL_DESC[setup.level];
        $('sea-desc').textContent = SEA_STATES[setup.sea].desc;
    }
    all();
}

// ---------------------------------------------------------------- help legend
export function buildHelp() {
    const lg = $('legend');
    lg.innerHTML = '';
    for (const t of [KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN]) {
        const d = document.createElement('div');
        d.className = 'item';
        d.innerHTML = `<span class="pair"><img alt="" src="${THUMBS[t] || ''}"><img alt="" src="${THUMBS[-t] || ''}"></span><div><b>${PIECE_NAMES[t]}</b> <small>${CHESS_NAME[t]}</small><br>${PIECE_BLURB[t]}</div>`;
        lg.append(d);
    }
    const el = $('event-legend');
    el.innerHTML = '';
    for (const id of EVENT_IDS) {
        const ev = SEA_EVENTS[id];
        const d = document.createElement('div');
        d.className = 'item';
        d.innerHTML = `<span class="big-ico">${ev.icon}</span><div><b>${ev.name}</b>${ev.desc}</div>`;
        el.append(d);
    }
}

// ---------------------------------------------------------------- promotion picker
export function pickPromotion(color) {
    return new Promise((resolve) => {
        const box = $('promo-choices');
        box.innerHTML = '';
        for (const t of [QUEEN, ROOK, BISHOP, KNIGHT]) {
            const b = document.createElement('button');
            b.innerHTML = `<img alt="" src="${THUMBS[t * color] || ''}">${PIECE_NAMES[t]}<small>${CHESS_NAME[t]}</small>`;
            b.dataset.type = t;
            b.addEventListener('click', () => { $('promo').hidden = true; resolve(t); });
            box.append(b);
        }
        $('promo').hidden = false;
    });
}

// ---------------------------------------------------------------- game over
export function showOver(match, opts) {
    const r = match.result;
    let icon = '⚖️', title = 'A Draw';
    if (r.winner !== 0) {
        if (opts.mode === 'ai') {
            const won = r.winner === opts.human;
            icon = won ? '🏆' : '☠️';
            title = won ? 'Victory!' : 'Sunk!';
        } else {
            icon = r.winner === WHITE ? '⚓' : '🏴‍☠️';
            title = `${sideName(r.winner)} Win!`;
        }
    }
    $('over-icon').textContent = icon;
    $('over-title').textContent = title;
    const how = {
        checkmate: 'by checkmate', stalemate: 'by stalemate', resignation: 'by resignation',
        'insufficient material': 'with too few ships left to force a mate', 'fifty-move rule': 'by the fifty-move rule',
        'threefold repetition': 'by threefold repetition',
    }[r.reason] || r.reason;
    $('over-text').textContent = r.winner === 0 ? `The battle ends in a draw ${how}.` : `The ${sideName(r.winner)} win ${how}.`;
    const events = match.log.filter((e) => e.event).length;
    $('over-stats').textContent = `${Math.ceil(match.ply / 2)} moves · ${events} sea event${events === 1 ? '' : 's'} · ${match.captured.w.length + match.captured.b.length} ships sunk`;
    $('over').hidden = false;
}

export function setToolState(id, on) { $(id).classList.toggle('off', !on); }
