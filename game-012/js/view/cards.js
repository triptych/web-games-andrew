// Card faces as DOM: the fal painting framed by rarity, with the numeral, name, element and stars drawn over it in
// code, so a card always reads even if its picture is missing (then a gradient in its suit's colour stands in).
// Hollows use the same frame in a darker, cracked style. Pure DOM: no canvas, no framework.

import { CARDS, SUIT_INFO, ELEMENTS, RARITIES } from '../sim/data/cards.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { ART, ROOT } from '../media.js';

const EL_GLYPH = { fire: '🜂', water: '🜄', air: '🜁', earth: '🜃', spirit: '✦' };
export const elGlyph = (el) => EL_GLYPH[el] || '✦';

function img(src, alt) {
    const i = document.createElement('img');
    i.src = ROOT + src;
    i.alt = alt;
    i.loading = 'lazy';
    i.decoding = 'async';
    i.draggable = false;
    i.addEventListener('error', () => i.classList.add('missing'));
    return i;
}

/** A card face. opts: { star, copies, small, unknown, badge } */
export function cardEl(id, opts = {}) {
    const c = CARDS[id];
    const el = document.createElement('div');
    el.className = `card r-${c.rarity} s-${c.suit}${opts.small ? ' small' : ''}${opts.unknown ? ' unknown' : ''}`;
    el.dataset.id = id;
    el.style.setProperty('--suit', SUIT_INFO[c.suit].color);
    el.style.setProperty('--rar', RARITIES[c.rarity].color);
    if (opts.unknown) {
        el.append(img(ART.back, ''));
        const q = document.createElement('div');
        q.className = 'cf-unknown';
        q.textContent = c.suit === 'major' ? c.numeral : c.numeral;
        el.append(q);
        el.setAttribute('aria-label', 'Not yet drawn');
        return el;
    }
    const art = document.createElement('div');
    art.className = 'cf-art';
    art.append(img(ART.card(id), c.name));
    el.append(art);
    el.insertAdjacentHTML('beforeend',
        `<div class="cf-num">${c.numeral}</div>`
        + `<div class="cf-el" title="${ELEMENTS[c.el].name}" style="--elc:${ELEMENTS[c.el].color}">${elGlyph(c.el)}</div>`
        + `<div class="cf-name">${c.name}</div>`
        + (opts.star ? `<div class="cf-stars" aria-label="${opts.star} stars">${'★'.repeat(opts.star)}</div>` : '')
        + (opts.badge ? `<div class="cf-badge">${opts.badge}</div>` : ''));
    el.setAttribute('aria-label', `${c.name}, ${RARITIES[c.rarity].name} ${SUIT_INFO[c.suit].name}${opts.star ? `, ${opts.star} stars` : ''}`);
    return el;
}

/** A Hollow's face. */
export function foeEl(id) {
    const e = ENEMIES[id];
    const el = document.createElement('div');
    el.className = `card foe${e.elite ? ' elite' : ''}${e.boss ? ' boss' : ''}`;
    el.dataset.id = id;
    const art = document.createElement('div');
    art.className = 'cf-art';
    art.append(img(ART.foe(id), e.name));
    el.append(art);
    el.insertAdjacentHTML('beforeend',
        `<div class="cf-el" title="${ELEMENTS[e.el].name}" style="--elc:${ELEMENTS[e.el].color}">${elGlyph(e.el)}</div>`
        + `<div class="cf-name">${e.name}</div>`
        + (e.elite ? '<div class="cf-badge">Elite</div>' : e.boss ? '<div class="cf-badge">Boss</div>' : ''));
    el.setAttribute('aria-label', `${e.name}${e.elite ? ', elite' : ''}${e.boss ? ', boss' : ''}, ${ELEMENTS[e.el].name}`);
    return el;
}

/** A card back (for the Well's reveal and the Reading). */
export function backEl() {
    const el = document.createElement('div');
    el.className = 'card back';
    el.append(img(ART.back, 'A card, face down'));
    return el;
}
