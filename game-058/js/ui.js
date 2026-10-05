/**
 * ui.js — the DOM side: HUD (moves, tickets, jars, score), screens (title,
 * map, level card, sense card, pause, win, out-of-moves, picnic, album,
 * settings) and floating labels over the 3D scene.
 */

import {
    KINDS, COLOURS, FAMILIES, SIZES, SENSES, POWERS, GARDENS, LEVELS,
    GARDEN_STARTS, albumVariants, KIND_IDS, FAMILY_IDS, SIZE_IDS, VERSION,
} from './config.js';
import { fruitThumb } from './view/thumbs.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const SCREENS = ['title-screen', 'map-screen', 'intro-screen', 'sense-screen', 'pause-screen', 'win-screen', 'lose-screen', 'picnic-screen', 'album-screen', 'settings-screen'];

export function showScreen(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
}
export function hideScreens() { for (const s of SCREENS) $(s).classList.add('hidden'); }
export function showOverlay(id, on = true) { $(id).classList.toggle('hidden', !on); }
export function setHud(on) { $('hud').classList.toggle('hidden', !on); document.body.classList.toggle('playing', on); }

// ------------------------------------------------------------
// Icons & labels
// ------------------------------------------------------------

export function traitIcon(t, v) {
    switch (t) {
        case 'kind':   return `<span class="ico"><img alt="" src="${fruitThumb(v, KINDS[v].colours[0])}"></span>`;
        case 'colour': return `<span class="ico colour" style="--c:${COLOURS[v].css}"></span>`;
        case 'size': {
            const px = { S: 9, M: 15, L: 22 }[v];
            return `<span class="ico size"><i style="display:block;width:${px}px;height:${px}px;border-radius:50%;background:#fff;box-shadow:inset -2px -2px 0 rgba(0,0,0,0.15)"></i></span>`;
        }
        case 'family': return `<span class="ico family" style="--c:${FAMILIES[v].css}">${FAMILIES[v].icon}</span>`;
        case 'golden': return `<span class="ico golden"><img alt="" src="${fruitThumb('apple', 'red', true)}"></span>`;
        case 'leaf':   return `<span class="ico">🍂</span>`;
        case 'frost':  return `<span class="ico">🧊</span>`;
        case 'any':    return `<span class="ico">🧺</span>`;
        default:       return `<span class="ico">?</span>`;
    }
}

export function traitLabel(t, v, n = 2) {
    switch (t) {
        case 'kind':   return n === 1 ? KINDS[v].label.toLowerCase() : KINDS[v].plural;
        case 'colour': return COLOURS[v].label;
        case 'size':   return SIZES[v].label;
        case 'family': return FAMILIES[v].label;
        case 'golden': return 'golden';
        case 'leaf':   return 'leaf piles';
        case 'frost':  return 'frosted';
        case 'any':    return 'any fruit';
        default:       return '';
    }
}

function goalHtml(g, showHave = false) {
    const left = Math.max(0, g.n - (g.have ?? 0));
    const done = showHave && left === 0;
    return `<div class="goal${done ? ' done' : ''}">${traitIcon(g.t, g.v)}<div><span class="glabel">${esc(traitLabel(g.t, g.v))}</span>${showHave ? (done ? '✓' : left) : g.n}</div></div>`;
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------

let ticketCache = [];
export function buildTickets(game) {
    const box = $('tickets');
    box.innerHTML = '';
    ticketCache = game.goals.map(g => {
        const el = document.createElement('div');
        el.className = 'ticket';
        el.title = `${g.n} ${traitLabel(g.t, g.v)}`;
        el.innerHTML = `${traitIcon(g.t, g.v)}<span class="tnum"></span>`;
        box.appendChild(el);
        return { el, num: el.querySelector('.tnum'), last: -1 };
    });
    updateTickets(game);
}

export function updateTickets(game) {
    game.goals.forEach((g, i) => {
        const tc = ticketCache[i];
        if (!tc) return;
        const left = Math.max(0, g.n - g.have);
        if (left !== tc.last) {
            tc.num.textContent = left > 0 ? left : '';
            tc.el.classList.toggle('done', left === 0);
            if (tc.last !== -1) { tc.el.classList.add('bump'); setTimeout(() => tc.el.classList.remove('bump'), 160); }
            tc.last = left;
        }
    });
}

export function updateMoves(game) {
    const box = $('moves-box');
    if (game.picnic) {
        box.classList.add('picnic');
        box.classList.remove('low');
        $('moves-val').textContent = `🧺${game.basket + 1}`;
        $('moves-lbl').textContent = `${game.basketFill}/40`;
        return;
    }
    box.classList.remove('picnic');
    const left = Math.max(0, game.movesLeft());
    $('moves-val').textContent = left;
    $('moves-lbl').textContent = left === 1 ? 'move' : 'moves';
    box.classList.toggle('low', left <= 3 && game.status === 'playing');
}

export function updateScore(score) { $('score-val').textContent = score.toLocaleString(); }

let jarEls = [];
export function buildJars(game, onTap) {
    const bar = $('jarbar');
    bar.innerHTML = '';
    jarEls = game.jars.map((jar, i) => {
        const el = document.createElement('button');
        el.className = 'jar';
        el.setAttribute('aria-label', `${SENSES[jar.sense].label} jar: ${POWERS[jar.power].label}`);
        el.innerHTML = `<div class="liquid"></div><div class="jtarget"></div><div class="jcharges"><i></i><i></i></div><div class="jpower">${POWERS[jar.power].icon}</div><div class="jsense">${SENSES[jar.sense].label}</div><div class="jcount"></div>`;
        el.addEventListener('click', (e) => { e.stopPropagation(); onTap(i); });
        bar.appendChild(el);
        return { el, liquid: el.querySelector('.liquid'), target: el.querySelector('.jtarget'), count: el.querySelector('.jcount'), pips: el.querySelectorAll('.jcharges i'), lastTarget: null };
    });
    updateJars(game, -1);
}

const JAR_TINT = { kind: ['#ffb72b', '#ffd86a'], colour: ['#ff6fb0', '#ffb0d4'], size: ['#5aa8ff', '#a8d4ff'], family: ['#3ac8a0', '#9af0d0'] };
function jarTint(jar) {
    if (jar.sense === 'colour' && jar.target) { const c = COLOURS[jar.target].css; return [c, c + 'aa']; }
    if (jar.sense === 'family' && jar.target) { const c = FAMILIES[jar.target].css; return [c, c + 'aa']; }
    return JAR_TINT[jar.sense];
}

export function updateJars(game, armed, filled = []) {
    game.jars.forEach((jar, i) => {
        const j = jarEls[i];
        if (!j) return;
        const full = jar.charges >= 2;
        const pct = full ? 100 : Math.min(100, (jar.fill / jar.need) * 100);
        j.liquid.style.height = `${Math.max(4, pct * 0.78)}%`;
        const [c, c2] = jarTint(jar);
        j.el.style.setProperty('--c', c);
        j.el.style.setProperty('--c2', c2);
        if (jar.target !== j.lastTarget) {
            j.target.innerHTML = jar.target != null ? traitIcon(jar.sense, jar.target) : '';
            j.lastTarget = jar.target;
        }
        j.count.textContent = full ? 'full!' : `${jar.fill}/${jar.need}`;
        j.pips.forEach((p, k) => p.classList.toggle('on', k < jar.charges));
        const usable = jar.charges > 0 && game.status === 'playing' && !(jar.power === 'rainbow' && (game.wild || game.movesLeft() <= 0));
        j.el.classList.toggle('ready', usable && armed !== i);
        j.el.classList.toggle('armed', armed === i || (jar.power === 'rainbow' && game.wild));
        if (filled.includes(i)) {
            j.el.classList.remove('fill-pop');
            void j.el.offsetWidth;
            j.el.classList.add('fill-pop');
        }
    });
}

export function jarRect(i) { return jarEls[i]?.el.getBoundingClientRect(); }

export function powerHint(text) {
    const el = $('power-hint');
    el.textContent = text ?? '';
    el.classList.toggle('hidden', !text);
}

let toastTimer = 0;
export function toast(text, ms = 1100) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function linkTag(text, colour, x, y) {
    const el = document.createElement('div');
    el.className = 'linktag';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--c', colour);
    $('labels').appendChild(el);
    setTimeout(() => el.remove(), 950);
}

export function floater(text, x, y) {
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $('labels').appendChild(el);
    setTimeout(() => el.remove(), 1150);
}

/** The screen rect left free for the blanket, given the HUD's layout. */
export function freeRect() {
    const W = window.innerWidth, H = window.innerHeight;
    const top = $('topbar').getBoundingClientRect();
    const jar = $('jarbar').getBoundingClientRect();
    const side = jar.height > jar.width * 1.3 && jar.left > W * 0.5;
    const r = { left: 6, top: top.bottom + 4, right: W - 6, bottom: H - 6 };
    if (side) r.right = jar.left - 2;
    else r.bottom = jar.top + 6;
    return r;
}

// ------------------------------------------------------------
// Map
// ------------------------------------------------------------

export function renderMap(save, onPick) {
    const list = $('map-list');
    list.innerHTML = '';
    let total = 0;
    for (const n of Object.values(save.stars)) total += n;
    $('map-stars').textContent = `★ ${total} / ${LEVELS.length * 3}`;
    GARDENS.forEach((G, gi) => {
        const start = GARDEN_STARTS[gi];
        const locked = start > save.unlocked;
        const sec = document.createElement('section');
        sec.className = `garden${locked ? ' locked' : ''}`;
        sec.style.background = `linear-gradient(160deg, ${G.sky[1]}, ${G.sky[0]}66)`;
        const senses = G.senses.map((s, i) => `<span class="sense-chip${i === G.senses.length - 1 && gi > 0 ? ' new' : ''}">${SENSES[s].icon} ${SENSES[s].label}</span>`).join('');
        sec.innerHTML = `<div class="garden-head"><h3>${esc(G.name)}</h3><div class="garden-senses">${senses}</div></div><div class="path"></div>`;
        const path = sec.querySelector('.path');
        LEVELS.forEach((L, li) => {
            if (L.g !== gi) return;
            const b = document.createElement('button');
            const st = save.stars[li] ?? 0;
            b.className = `node${L.finale ? ' finale' : ''}${li > save.unlocked ? ' locked' : ''}${li === save.unlocked && !save.stars[li] ? ' current' : ''}`;
            b.innerHTML = `${li + 1}<span class="nstars">${[0, 1, 2].map(k => `<span class="${k < st ? '' : 'off'}">★</span>`).join('')}</span>${L.finale ? '<span class="nset">🧺</span>' : ''}`;
            b.setAttribute('aria-label', `Level ${li + 1}: ${L.name}`);
            b.dataset.level = li;
            b.addEventListener('click', () => onPick(li));
            path.appendChild(b);
        });
        list.appendChild(sec);
    });
    $('map-picnic').disabled = !save.picnicOpen;
    requestAnimationFrame(() => {
        const cur = list.querySelector('.node.current') ?? list.querySelector(`.node[data-level="${Math.min(save.unlocked, LEVELS.length - 1)}"]`);
        if (cur) cur.scrollIntoView({ block: 'center' });
    });
}

// ------------------------------------------------------------
// Level card
// ------------------------------------------------------------

export function renderIntro(li, level) {
    const G = GARDENS[level.g];
    $('intro-garden').textContent = `${G.name} · Level ${li + 1}`;
    $('intro-title').textContent = level.name;
    $('intro-goals').innerHTML = level.goals.map(g => goalHtml(g)).join('');
    $('intro-moves').textContent = `${level.moves} moves`;
    $('intro-senses').innerHTML = `<span class="small">Link by:</span> ` + G.senses.map(s => `<span class="sense-chip">${SENSES[s].icon} ${SENSES[s].label}</span>`).join('');
    $('intro-tip').textContent = level.tip ?? '';
}

export function renderSense(sense) {
    const S = SENSES[sense];
    $('sense-icon').textContent = S.icon;
    $('sense-title').textContent = `${S.label} sense`;
    $('sense-blurb').textContent = S.blurb;
    const ex = {
        kind:   [['apple', 'red'], ['apple', 'red']],
        colour: [['apple', 'red'], ['strawberry', 'red']],
        size:   [['lemon', 'yellow', 'L'], ['grape', 'purple', 'L']],
        family: [['lemon', 'yellow'], ['lime', 'green']],
    }[sense];
    const imgs = ex.map(([k, c]) => `<span class="ico"><img alt="" src="${fruitThumb(k, c)}"></span>`);
    $('sense-example').innerHTML = `${imgs[0]}<span>→</span>${imgs[1]}<span class="sense-chip">${S.hop}</span>`;
    const jar = { kind: 'honey', colour: 'paint', size: 'bomb', family: 'rainbow' }[sense];
    $('sense-jar').innerHTML = `New jar: fill it with a ${S.label.toLowerCase()} set to earn <b>${POWERS[jar].icon} ${POWERS[jar].label}</b> — ${esc(POWERS[jar].tip)}`;
}

export function renderGoalsInto(id, game) {
    $(id).innerHTML = game.goals.map(g => goalHtml(g, true)).join('');
}

// ------------------------------------------------------------
// Results
// ------------------------------------------------------------

function stampsHtml(keys) {
    if (!keys.length) return '';
    const shown = keys.slice(0, 10).map(k => { const [kind, colour] = k.split('|'); return `<span class="ico"><img alt="" src="${fruitThumb(kind, colour)}"></span>`; }).join('');
    return `<span>New album stamps:</span> ${shown}${keys.length > 10 ? ` +${keys.length - 10}` : ''}`;
}

export function renderWin(game, li, newStamps, onStar) {
    const titles = ['Lovely picking!', 'Berry nice!', 'Un-bee-lievable!', 'Juicy work!', 'Sweet as honey!', 'Pear-fect!'];
    $('win-title').textContent = titles[(li * 7 + game.stars) % titles.length];
    $('win-eyebrow').textContent = LEVELS[li]?.finale ? 'Set complete!' : 'Basket full!';
    $('win-score').textContent = game.score.toLocaleString();
    $('win-longest').textContent = game.stats.longest;
    $('win-golden').textContent = game.stats.golden;
    $('win-bonus').textContent = game.leftoverBonus ? `Sweet finish: ${game.movesLeft()} moves left → +${game.leftoverBonus}` : '';
    $('win-stamps').innerHTML = stampsHtml(newStamps);
    $('win-next').textContent = li >= LEVELS.length - 1 ? 'Picnic!' : 'Next';
    const stars = $('win-stars').children;
    for (const s of stars) s.classList.remove('on');
    for (let i = 0; i < game.stars; i++) {
        setTimeout(() => { stars[i].classList.add('on'); onStar?.(i); }, 350 + i * 320);
    }
}

export function renderPicnicEnd(game, best, newStamps) {
    $('picnic-score').textContent = game.score.toLocaleString();
    $('picnic-baskets').textContent = game.basket;
    $('picnic-best').textContent = best.toLocaleString();
    $('picnic-title').textContent = game.score >= best && game.score > 0 ? 'A new best picnic!' : 'What a feast!';
    $('picnic-stamps').innerHTML = stampsHtml(newStamps);
}

// ------------------------------------------------------------
// Album
// ------------------------------------------------------------

export function renderAlbum(save) {
    const list = $('album-list');
    const vars = albumVariants();
    const found = vars.filter(v => save.album[v.key]).length;
    $('album-count').textContent = `${found} / ${vars.length}`;
    list.innerHTML = '';
    for (const fam of FAMILY_IDS) {
        const kinds = KIND_IDS.filter(k => KINDS[k].family === fam);
        const famVars = vars.filter(v => KINDS[v.kind].family === fam);
        const famFound = famVars.filter(v => save.album[v.key]).length;
        const sec = document.createElement('section');
        sec.className = 'fam';
        let html = `<h3>${FAMILIES[fam].icon} ${FAMILIES[fam].label}<small>${famFound}/${famVars.length}</small></h3>`;
        for (const k of kinds) {
            html += `<div class="kindrow"><div class="kname">${esc(KINDS[k].label)}</div><div class="vars">`;
            for (const c of KINDS[k].colours) {
                const url = fruitThumb(k, c);
                html += `<div class="stamp" title="${esc(KINDS[k].label)} · ${c}">` + SIZE_IDS.map(s => {
                    const have = save.album[`${k}|${c}|${s}`];
                    return `<img alt="${s}" class="${s}${have ? '' : ' no'}" src="${url}">`;
                }).join('') + `</div>`;
            }
            html += `</div></div>`;
        }
        sec.innerHTML = html;
        list.appendChild(sec);
    }
}

export function setToggle(id, on) { $(id).classList.toggle('on', !!on); }
export function setVersion() { $('version').textContent = `v${VERSION}`; }

/** Trail-length bubble that follows the newest fruit while dragging. */
export function chainCount(n, note, x, y, golden = false, ready = false) {
    const el = $('chain-count');
    if (n == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.classList.toggle('golden', golden);
    el.classList.toggle('ready', ready);
    const key = `${n}|${note}`;
    if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.innerHTML = `<b>${n}</b>${note ? `<span>${note}</span>` : ''}`;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
}

// ------------------------------------------------------------
// Tutorial hand
// ------------------------------------------------------------

export function hand(x, y) {
    const el = $('hand');
    if (x == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
}
