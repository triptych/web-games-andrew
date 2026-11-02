// Curl Up & Dye: the salon screen. A 128×128 Canvas 2D chair, painted with the same pixel painter as every other
// sprite, where the client's own sprite (hats off) gets new hair: sixteen strands that can be washed, cut, grown, dyed
// one by one, combed, waved, curled, crimped and sprayed big, a fringe, make-up, face stickers and an accessory or two.
//
// It reads the sim and never changes it: seating a client, leaving and finishing go out through send() as commands,
// and the sim judges the finished look (salon.js score()) and pays for it. Everything in between lives here.

import { Px, mix } from './view/pixel.js';
import { drawOverlord, drawMinion, drawVisitor, drawHenchman } from './view/art.js';
import { hash3 } from './rng.js';
import { fmt } from './fmt.js';
import {
    COLOURS, COLOUR_IDS, CLIENTS, CLIENT, STRANDS, BANGS, TOPS, CLIPS, startLook, score, askText, askIcon,
} from './sim/salon.js';

const N = 128;                 // the canvas, in salon pixels
const HX = 64, HY = 46;        // where the client's head sits
const MAXLEN = 60;             // a strand at full length, in pixels below the ears
const SHRINK = { straight: 1, wavy: 0.92, curly: 0.68, crimp: 0.84 };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Where everyone's head, eyes, mouth and cheeks are on their own sprite, in sprite pixels, and how big they sit in the
// chair. head: [x, y, rx, ry]; eyes and mouth: [x, y, w, h] rectangles; face: draw a face on (the cauldron has none).
const PERSON = { head: [11, 9, 5.5, 5.5], eyes: [[8, 9, 2, 2], [12, 9, 2, 2]], mouth: [9, 13, 4, 1], cheeks: [[7, 12], [15, 12]], s: 3 };
const ANCHOR = {
    noxia: { head: [17, 15, 8.5, 7.8], eyes: [[12, 13, 3, 4], [20, 13, 3, 4]], mouth: [16, 19, 3, 1], cheeks: [[11, 18.5], [23, 18.5]], s: 2 },
    imp: { head: [11, 11, 6, 5.5], eyes: [[8, 11, 2, 2], [13, 11, 2, 2]], mouth: [9, 14, 5, 1], cheeks: [[6.5, 13.5], [16.5, 13.5]], s: 3 },
    cauldron: { head: [14, 9, 10, 5], eyes: [[9, 12, 2, 2], [17, 12, 2, 2]], mouth: [12, 16, 4, 1], cheeks: [[7, 15], [21, 15]], s: 2, face: true },
    golem: { head: [14, 9, 7.5, 7], eyes: [[10, 7, 2, 3], [16, 7, 2, 3]], mouth: [11, 12, 6, 2], cheeks: [[8, 11], [20, 11]], s: 2 },
    spider: { head: [15, 8, 5, 4.5], eyes: [[11, 6, 3, 4], [16, 6, 3, 4]], mouth: [14, 11, 2, 1], cheeks: [[11, 10], [19, 10]], s: 3 },
    loom: { head: [22, 6, 4, 4], eyes: [[21, 6, 1, 1], [24, 6, 1, 1]], mouth: [22, 8, 2, 1], cheeks: [[19.5, 8], [25.5, 8]], s: 3 },
    bat: { head: [15, 11, 4.5, 5], eyes: [[13, 10, 1, 2], [17, 10, 1, 2]], mouth: [14, 13, 3, 1], cheeks: [[12, 13], [18, 13]], s: 3 },
    gargoyle: { head: [13, 11, 6, 5.5], eyes: [[10, 10, 2, 2], [15, 10, 2, 2]], mouth: [10, 14, 7, 1], cheeks: [[8.5, 13], [18, 13]], s: 3 },
    wraith: { head: [11, 12, 7, 8], eyes: [[8, 10, 2, 3], [13, 10, 2, 3]], mouth: [10, 15, 3, 2], cheeks: [[6.5, 14], [16, 14]], s: 3 },
    portrait: { head: [13, 13, 5, 5.5], eyes: [[10, 12, 2, 2], [14, 12, 2, 2]], mouth: [12, 16, 3, 1], cheeks: [[9.5, 15], [17, 15]], s: 3 },
    skeleton: { head: [12, 8, 5.5, 5.5], eyes: [[9, 7, 2, 3], [13, 7, 2, 3]], mouth: [10, 12, 4, 1], cheeks: [[8, 10.5], [16.5, 10.5]], s: 3 },
    mimic: { head: [15, 12, 12, 6], eyes: [[10, 15, 2, 2], [18, 15, 2, 2]], mouth: [12, 12, 6, 2], cheeks: [[7, 18], [23, 18]], s: 2 },
    lich: { head: [13, 10, 5, 5], eyes: [[10, 9, 2, 2], [14, 9, 2, 2]], mouth: [11, 13, 4, 1], cheeks: [[9, 12], [17, 12]], s: 3 },
    kitten: { head: [6, 7, 4.5, 4], eyes: [[4, 6, 1, 2], [7, 6, 1, 2]], mouth: [6, 9, 1, 1], cheeks: [[3.5, 8.5], [8.5, 8.5]], s: 4 },
    critic: PERSON, bard: PERSON, hero: PERSON,
    henchman: { head: [9, 8, 5, 5], eyes: [[7, 8, 1, 1], [11, 8, 1, 1]], mouth: [7, 11, 4, 1], cheeks: [[5.5, 10], [12.5, 10]], s: 3 },
};
const VISITOR_IDS = new Set(['kitten', 'critic', 'bard', 'hero']);
const spriteOf = (id) => (id === 'noxia' ? drawOverlord('idle', 'party', { bald: true }) : VISITOR_IDS.has(id) ? drawVisitor(id, { salon: true })
    : id === 'henchman' ? drawHenchman({ salon: true }) : drawMinion(id, { salon: true }));
/** The icon in the gallery: the client as they walk in, hat and all. */
export const iconOf = (sprites, id, scale = 2) => (id === 'noxia' ? sprites.icon('overlord', 'party', scale) : VISITOR_IDS.has(id) ? sprites.icon('visitor', id, scale)
    : id === 'henchman' ? sprites.icon('henchman', '', scale) : sprites.icon('minion', id, scale));

// ---------------------------------------------------------------------------------------------------- tools
const TABS = [
    { id: 'wash', icon: '🫧', name: 'Wash' }, { id: 'cut', icon: '✂️', name: 'Cut' }, { id: 'dye', icon: '🎨', name: 'Dye' },
    { id: 'style', icon: '💫', name: 'Style' }, { id: 'face', icon: '💄', name: 'Make-up' }, { id: 'extra', icon: '🎀', name: 'Extras' },
];
// brush: drag over the hair; all: what the "whole head" button does; colour: uses the palette
const TOOLS = [
    { id: 'shampoo', tab: 'wash', icon: '🧴', name: 'Shampoo', brush: true, all: 'Lather all' },
    { id: 'rinse', tab: 'wash', icon: '🚿', name: 'Rinse', brush: true, all: 'Rinse all' },
    { id: 'scissors', tab: 'cut', icon: '✂️', name: 'Scissors', brush: true, all: 'Trim all' },
    { id: 'grow', tab: 'cut', icon: '🧪', name: 'Grow tonic', act: true },
    { id: 'dye', tab: 'dye', icon: '🖌️', name: 'Dye brush', brush: true, colour: true, all: 'Dye all' },
    { id: 'comb', tab: 'style', icon: '🪮', name: 'Straighten', brush: true, tex: 'straight', all: 'All over' },
    { id: 'wave', tab: 'style', icon: '〰️', name: 'Waver', brush: true, tex: 'wavy', all: 'All over' },
    { id: 'curl', tab: 'style', icon: '➰', name: 'Curler', brush: true, tex: 'curly', all: 'All over' },
    { id: 'crimp', tab: 'style', icon: '⚡', name: 'Crimper', brush: true, tex: 'crimp', all: 'All over' },
    { id: 'spray', tab: 'style', icon: '💨', name: 'Hairspray', brush: true, all: 'Big hair!' },
    { id: 'lips', tab: 'face', icon: '💋', name: 'Lipstick', colour: true, act: true },
    { id: 'shadow', tab: 'face', icon: '👁️', name: 'Eyeshadow', colour: true, act: true },
    { id: 'blush', tab: 'face', icon: '🌸', name: 'Blush', act: true },
    { id: 'lashes', tab: 'face', icon: '🦋', name: 'Lashes', act: true },
    { id: 'glitter', tab: 'face', icon: '✨', name: 'Glitter', act: true },
    { id: 'sticker', tab: 'face', icon: '⭐', name: 'Stickers', stamp: true },
    { id: 'wipe', tab: 'face', icon: '🧽', name: 'Wipe off', act: true },
];
const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
const STICKERS = [['heart', '❤️'], ['star', '⭐'], ['bat', '🦇'], ['stitch', '🧵'], ['tear', '💧']];
const BANG_NAME = { none: 'No fringe', blunt: 'Blunt', side: 'Side-swept', curtain: 'Curtain', wisp: 'Wispy' };
const TOP_ICON = { tiara: ['👑', 'Tiara'], witch: ['🧙', 'Witch hat'], flowers: ['🌹', 'Roses'], ears: ['🐱', 'Cat ears'], veil: ['👰', 'Veil'] };
const CLIP_ICON = { bow: ['🎀', 'Bow'], bat: ['🦇', 'Bat clip'], spider: ['🕷️', 'Spider'], skull: ['💀', 'Skull'], rose: ['🥀', 'Rose'] };

// ---------------------------------------------------------------------------------------------------- little sprites
function dirtSprite(kind) {
    const P = new Px(9, 9);
    if (kind === 'web') {
        for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8], [4, 0], [0, 4]]) P.mline(4, 4, x, y, 1);
        for (let a = 0; a < 8; a++) P.mp(4 + Math.round(Math.cos(a * 0.785) * 2.6), 4 + Math.round(Math.sin(a * 0.785) * 2.6));
        P.fill('#e4def0');
        return P;
    }
    if (kind === 'leaf') { P.mpoly([[1, 6], [4, 1], [8, 3], [6, 7]]).paint('#c8702a'); P.mline(2, 6, 6, 3, 1).fill('#7a3a12'); }
    else if (kind === 'bone') { P.mrect(2, 4, 5, 2).mell(1.5, 3.5, 1.4, 1.4).mell(1.5, 6, 1.4, 1.4).mell(7.5, 3.5, 1.4, 1.4).mell(7.5, 6, 1.4, 1.4).paint('#f2ecdc'); }
    else if (kind === 'beetle') { P.mline(1, 3, 7, 7, 1).mline(7, 3, 1, 7, 1).fill('#2a1838'); P.mell(4.5, 5, 2.4, 2.8).paint('#5a2a8a', { hi: 1.5 }); }
    else { P.mell(3, 5, 2.4, 2).mell(6, 4.5, 2.2, 2).paint('#9a92a8', { soft: true }); }
    P.outline('#1a1024', 0.7);
    return P;
}
function bubbleSprite(r) {
    const P = new Px(r * 2 + 3, r * 2 + 3);
    P.mell(r + 1.5, r + 1.5, r + 0.5, r + 0.5).paint('#f4f8ff', { soft: true });
    P.mp(r, r - 1).fill('#ffffff');
    P.outline('#8ab0e0', 0.4);
    return P;
}
function stickerPx(P, k, x, y) {
    x = Math.round(x); y = Math.round(y);
    if (k === 'heart') { P.mell(x - 1.5, y - 1, 2, 2).mell(x + 1.5, y - 1, 2, 2).mpoly([[x - 3.5, y - 0.5], [x + 3.5, y - 0.5], [x, y + 3.5]]).paint('#ff4f86'); P.mp(x - 2, y - 2).fill('#ffc4dc'); }
    else if (k === 'star') { P.mpoly([[x, y - 4], [x + 1.2, y - 1.2], [x + 4, y - 1], [x + 1.8, y + 1], [x + 2.6, y + 4], [x, y + 2.2], [x - 2.6, y + 4], [x - 1.8, y + 1], [x - 4, y - 1], [x - 1.2, y - 1.2]]).paint('#ffd84a', { hi: 1.3 }); }
    else if (k === 'bat') { P.mpoly([[x, y - 1], [x - 5, y - 3], [x - 4, y + 1], [x - 2, y], [x, y + 2], [x + 2, y], [x + 4, y + 1], [x + 5, y - 3]]).paint('#2c2438'); P.mp(x - 1, y - 1).mp(x + 1, y - 1).fill('#ff4f86'); }
    else if (k === 'stitch') { P.mline(x - 4, y, x + 4, y, 1).fill('#3a1830'); for (const dx of [-3, 0, 3]) P.mline(x + dx, y - 2, x + dx, y + 2, 1).fill('#3a1830'); return; }
    else { P.mell(x, y + 1, 2, 2.4).mpoly([[x - 1.6, y], [x + 1.6, y], [x, y - 3.5]]).paint('#7ad0ff', { soft: true }); P.mp(x - 1, y).fill('#ffffff'); }
}

// ---------------------------------------------------------------------------------------------------- the view
export class SalonView {
    constructor({ audio, send, sprites, onClose }) {
        this.audio = audio;
        this.send = send;
        this.sprites = sprites;
        this.onClose = onClose;
        this.$ = (id) => document.getElementById(id);
        this.canvas = this.$('salon-canvas');
        this.canvas.width = N; this.canvas.height = N;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.layers = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = N; return c; });
        this.bg = this.paintBackground();
        this.figs = new Map();
        this.dirtImg = Object.fromEntries(['web', 'leaf', 'bone', 'beetle', 'dust'].map((k) => [k, dirtSprite(k).toCanvas()]));
        this.bubImg = [2, 3, 4].map((r) => bubbleSprite(r).toCanvas());
        this.parts = [];
        this.st = null;
        this.appt = null;
        this.mode = 'pick';
        this.tab = 'wash';
        this.tool = 'shampoo';
        this.colour = 'pink';
        this.sticker = 'heart';
        this.down = null;
        this.sfxT = 0;
        this.liveT = 0;
        this.ended = null;
        this.buildDom();
        const c = this.canvas;
        c.addEventListener('pointerdown', (e) => this.pdown(e));
        c.addEventListener('pointermove', (e) => this.pmove(e));
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) c.addEventListener(ev, () => { this.down = null; });
    }

    // ------------------------------------------------------------------ the sheet's controls
    buildDom() {
        const $ = this.$;
        $('salon-clients').innerHTML = CLIENTS.map((c) => `<button class="salon-client" data-id="${c.id}" title="${esc(c.name)}"><img alt="" src="${iconOf(this.sprites, c.id, 3)}"><b>${esc(c.name)}</b><span class="salon-best" data-best="${c.id}"></span></button>`).join('');
        $('salon-clients').addEventListener('click', (e) => {
            const b = e.target.closest('.salon-client');
            if (!b) return;
            this.audio.ui('click');
            this.send({ t: 'salonSeat', client: b.dataset.id }, (ok) => { if (ok) this.seat(this.G.yard.salon.appt); });
        });
        $('salon-tabs').innerHTML = TABS.map((t) => `<button role="tab" data-tab="${t.id}" aria-selected="false"><span aria-hidden="true">${t.icon}</span><b>${t.name}</b></button>`).join('');
        $('salon-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.audio.ui('click'); this.setTab(b.dataset.tab); } });
        $('salon-tools').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.toolButton(b); });
        $('salon-pal').innerHTML = COLOUR_IDS.map((c) => `<button class="swatch" data-c="${c}" style="--c:${COLOURS[c]}" aria-label="${c}" title="${c}"></button>`).join('');
        $('salon-pal').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) this.pickColour(b.dataset.c); });
        $('salon-done').addEventListener('click', () => this.finish());
        $('salon-change').addEventListener('click', () => { this.audio.ui('click'); this.send({ t: 'salonLeave' }); this.showPick(); });
        $('salon-next').addEventListener('click', () => { this.audio.ui('click'); this.showPick(); });
        $('salon-back').addEventListener('click', () => { this.audio.ui('close'); this.onClose(); });
    }

    setTab(tab) {
        this.tab = tab;
        for (const b of this.$('salon-tabs').children) { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.classList.toggle('on', on); }
        const first = { wash: 'shampoo', cut: 'scissors', dye: 'dye', style: 'comb', face: 'lips', extra: null }[tab];
        if (!TOOL[this.tool] || TOOL[this.tool].tab !== tab) this.tool = first;
        this.drawTools();
    }
    /** The tool row for the open tab, with the palette under it when the tool takes a colour. */
    drawTools() {
        const st = this.st, t = TOOL[this.tool];
        let h = '';
        const btn = (attrs, icon, name, on) => `<button ${attrs} class="tool${on ? ' on' : ''}" aria-pressed="${!!on}"><span aria-hidden="true">${icon}</span><b>${name}</b></button>`;
        if (this.tab === 'extra') {
            h += `<div class="tool-row">${TOPS.map((k) => btn(`data-top="${k}"`, TOP_ICON[k][0], TOP_ICON[k][1], st?.top === k)).join('')}</div>`;
            h += `<div class="tool-row">${CLIPS.map((k) => btn(`data-clip="${k}"`, CLIP_ICON[k][0], CLIP_ICON[k][1], st?.clip === k)).join('')}</div>`;
        } else {
            const on = (x) => x.id === this.tool && !x.act;
            const lit = (x) => (x.id === 'lips' && st?.lips) || (x.id === 'shadow' && st?.shadow) || (x.id === 'blush' && st?.blush) || (x.id === 'lashes' && st?.lashes) || (x.id === 'glitter' && st?.glitter);
            h += `<div class="tool-row">${TOOLS.filter((x) => x.tab === this.tab).map((x) => btn(`data-tool="${x.id}"`, x.icon, x.name, on(x) || lit(x))).join('')}</div>`;
            if (t?.all) h += `<div class="tool-row"><button data-all class="tool wide"><span aria-hidden="true">${t.icon}</span><b>${t.all}</b></button></div>`;
            if (this.tab === 'style') h += `<div class="tool-row">${BANGS.map((k) => btn(`data-bangs="${k}"`, k === 'none' ? '🚫' : '💇', BANG_NAME[k], st?.bangs === k)).join('')}</div>`;
            if (this.tool === 'sticker') h += `<div class="tool-row">${STICKERS.map(([k, ic]) => btn(`data-sticker="${k}"`, ic, k, this.sticker === k)).join('')}<button data-peel class="tool"><span aria-hidden="true">🧽</span><b>Peel off</b></button></div>`;
        }
        this.$('salon-tools').innerHTML = h;
        const wantPal = (t && t.colour) || (this.tab === 'extra' && st?.clip === 'bow');
        this.$('salon-pal').hidden = !wantPal;
        for (const b of this.$('salon-pal').children) b.classList.toggle('on', b.dataset.c === this.colour);
        this.canvas.style.cursor = t?.brush || t?.stamp ? 'crosshair' : 'default';
    }
    toolButton(b) {
        const st = this.st;
        if (!st || this.ended) return;
        const d = b.dataset;
        if (d.top) { st.top = st.top === d.top ? null : d.top; this.sfx('pick'); this.sparkleHead(); }
        else if (d.clip) { st.clip = st.clip === d.clip ? null : d.clip; if (st.clip === 'bow') st.bow = this.colour; this.sfx('pick'); this.sparkleHead(); }
        else if (d.bangs) { st.bangs = d.bangs; this.sfx('snip'); }
        else if (d.sticker) { this.sticker = d.sticker; this.audio.ui('click'); }
        else if ('peel' in d) { st.stickers.length = 0; this.sfx('pick'); }
        else if ('all' in d) this.applyAll(this.tool);
        else if (d.tool) {
            const t = TOOL[d.tool];
            if (t.act) this.act(t.id);
            if (!t.act || t.colour) this.tool = t.id;
            if (!t.act) this.audio.ui('click');
        }
        this.dirty = true;
        this.drawTools();
        const again = this.$('salon-tools').querySelector(`[data-${Object.keys(d)[0]}${Object.values(d)[0] !== '' ? `="${Object.values(d)[0]}"` : ''}]`);
        again?.focus({ preventScroll: true });
    }
    pickColour(c) {
        this.colour = c;
        this.audio.ui('click');
        const st = this.st;
        if (st && !this.ended) {
            if (this.tool === 'lips' && st.lips) st.lips = c;
            else if (this.tool === 'shadow' && st.shadow) st.shadow = c;
            if (this.tab === 'extra' && st.clip === 'bow') st.bow = c;
            this.dirty = true;
        }
        this.drawTools();
    }

    // ------------------------------------------------------------------ opening, seating, finishing
    /** The sheet opens on the client in the chair, or on the gallery when the chair is empty. */
    open(G) {
        this.G = G;
        const A = G.yard.salon.appt;
        if (A) this.seat(A); else this.showPick();
    }
    showPick() {
        this.mode = 'pick';
        this.appt = null;
        this.st = null;
        this.ended = null;
        this.$('salon-pick').hidden = false;
        this.$('salon-chair').hidden = true;
        this.$('salon-done').hidden = true;
        this.$('salon-change').hidden = true;
        this.$('salon-end').hidden = true;
        const best = this.G?.yard.salon.best || {};
        for (const el of document.querySelectorAll('[data-best]')) { const n = best[el.dataset.best] || 0; el.textContent = n ? '★'.repeat(n) + '☆'.repeat(3 - n) : ''; }
        this.status();
        this.$('salon-clients').querySelector('button')?.focus({ preventScroll: true });
    }
    /** A client sits down: their own hair as they came in, a little grubby from the crypt. */
    seat(A) {
        if (!A) return;
        this.mode = 'chair';
        this.ended = null;
        this.$('salon-pick').hidden = true;
        this.$('salon-chair').hidden = false;
        this.$('salon-done').hidden = false;
        this.$('salon-change').hidden = false;
        this.$('salon-end').hidden = true;
        if (!this.st || this.st.n !== A.n) {
            const L = startLook(A);
            const st = {
                n: A.n, client: A.client, cap: L.cap, vol: 0, bangs: L.bangs, lips: null, shadow: null, blush: false, lashes: false, glitter: false,
                stickers: [], top: null, clip: null, bow: 'pink', foam: [], dirt: [], wet: 0,
                strands: L.strands.map((s, i) => ({ ...s, len: Math.max(0, Math.min(1, s.len + (hash3(A.n, i, 3) - 0.5) * 0.08)) })),
            };
            this.st = st;
            this.geom();
            const kinds = ['web', 'leaf', 'bone', 'beetle', 'dust'];
            const nd = 6 + Math.floor(hash3(A.n, 9, 1) * 4);
            for (let i = 0; i < nd; i++) {
                const kind = kinds[Math.floor(hash3(A.n, i, 7) * kinds.length)];
                const r = hash3(A.n, i, 11);
                if (r < 0.45) st.dirt.push({ kind, on: -1, dx: (hash3(A.n, i, 13) - 0.5) * 1.5, dy: -0.4 - hash3(A.n, i, 17) * 0.5, loose: false, ph: r * 6 });
                else st.dirt.push({ kind, on: Math.floor(hash3(A.n, i, 19) * STRANDS), d: 3 + hash3(A.n, i, 23) * 14, loose: false, ph: r * 6 });
            }
            st.dirt0 = st.dirt.length;
            this.parts.length = 0;
            this.tab = 'wash'; this.tool = 'shampoo';
        }
        this.appt = A;
        this.geom();
        const C = CLIENT[A.client];
        this.$('salon-face').src = iconOf(this.sprites, A.client, 2);
        this.$('salon-who').textContent = C.name;
        this.$('salon-line').textContent = `“${C.line}”`;
        this.$('salon-asks').innerHTML = A.wish.map((a, i) => `<span class="ask" data-ask="${i}">${askIcon(a)} ${esc(askText(a))}</span>`).join('')
            + '<span class="ask clean" data-ask="clean">🫧 clean hair <small>(for the third star)</small></span>';
        this.dirty = true;
        this.setTab(this.tab);
        this.live();
        this.status();
        this.canvas.focus?.({ preventScroll: true });
    }
    finish() {
        if (!this.st || this.ended) return;
        this.audio.ui('click');
        this.send({ t: 'salonDone', look: this.look() });
    }
    /** The sim has judged the look: the result over the mirror. */
    onEnd(e) {
        if (!this.st || e.n !== this.st.n) return;
        this.ended = e;
        const C = CLIENT[e.client];
        const head = ['A disaster!', 'Hmm. It’ll grow back.', 'Lovely!', 'Drop-dead gorgeous!'][e.stars];
        const line = [`${C.name} storms out without a word.`, `${C.name} pays, and puts on a hat.`, `${C.name} is very pleased. Mostly.`, `${C.name} can’t stop looking in the mirror.`][e.stars];
        const stars = [1, 2, 3].map((n) => `<span class="${n <= e.stars ? '' : 'off'}">⭐</span>`).join('');
        const pay = !e.paid ? '<p class="dim">A practice cut: no fee.</p>' : e.stars ? `<p>💗 +${fmt(e.charm)} · 🪙 +${fmt(e.gold, 0)}</p>` : '<p class="dim">No fee for that.</p>';
        const dirty = !e.clean && e.met.every(Boolean) ? '<p class="dim">(There was still something crawling in it.)</p>' : '';
        this.$('salon-end-text').innerHTML = `<h3>${head}</h3><div class="stars">${stars}</div><p>${esc(line)}</p>${dirty}${pay}`;
        this.$('salon-end').hidden = false;
        this.$('salon-done').hidden = true;
        this.$('salon-change').hidden = true;
        if (e.stars >= 2) for (let i = 0; i < 40; i++) this.parts.push({ x: HX + (Math.random() - 0.5) * 80, y: HY + (Math.random() - 0.5) * 50, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 25, life: 1.6, t: 0, col: ['#ff4f86', '#ffd36b', '#ffffff', '#b48cff'][i % 4], k: i % 3 ? 'spark' : 'heart' });
        this.flash = 1;
        this.status();
        this.$('salon-next').focus({ preventScroll: true });
    }

    status() {
        const S = this.G?.yard.salon;
        if (!S) return;
        let t;
        if (this.mode === 'chair' && this.appt) t = this.appt.paid ? '💗 A paying client' : '✂️ Practice cut — no fee';
        else if (S.wait <= 0) t = '💗 A paying client is waiting!';
        else { const s = Math.ceil(S.wait); t = `Next paying client in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · practise for free`; }
        const el = this.$('salon-status');
        if (el.textContent !== t) el.textContent = t;
    }

    // ------------------------------------------------------------------ the look, as the sim will judge it
    look() {
        const st = this.st;
        const clean = !st.dirt.length && !st.foam.length ? 1 : 0.5 * (1 - st.dirt.length / Math.max(1, st.dirt0));
        return {
            strands: st.strands.map((s) => ({ c: s.c, len: s.len, tex: s.tex })), cap: st.cap, vol: st.vol, bangs: st.bangs, clean,
            lips: st.lips, shadow: st.shadow, blush: st.blush, lashes: st.lashes, glitter: st.glitter, stickers: st.stickers.length, top: st.top, clip: st.clip,
        };
    }
    /** The wish chips light up as each one comes true. */
    live() {
        if (!this.st || !this.appt) return;
        const r = score(this.appt.wish, this.look());
        for (const el of this.$('salon-asks').children) {
            const k = el.dataset.ask;
            el.classList.toggle('met', k === 'clean' ? r.clean : r.met[+k]);
        }
    }

    // ------------------------------------------------------------------ geometry
    geom() {
        const st = this.st, a = ANCHOR[st.client];
        const s = a.s;
        const [hx, hy, rx, ry] = a.head;
        this.g = { s, ox: Math.round(HX - hx * s), oy: Math.round(HY - hy * s), cx: HX, cy: HY, RX: rx * s, RY: ry * s, a };
        const { oy } = this.g;
        this.g.eyeTop = Math.min(...a.eyes.map((e) => oy + e[1] * s));
        this.paths = st.strands.map((_, i) => this.strandPath(i));
    }
    /** A strand: from its root on the scalp out to the side of the head, then hanging down as long as it is. */
    strandPath(i) {
        const { cx, cy, RX, RY } = this.g, st = this.st, S = st.strands[i];
        const side = i < STRANDS / 2 ? -1 : 1, k = i % (STRANDS / 2), K = STRANDS / 2 - 1;
        const vol = st.vol;
        const th = ((80 - 68 * k / K) * Math.PI) / 180;
        const rx0 = cx + side * RX * Math.sin(th), ry0 = cy - RY * Math.cos(th);
        const off = 1 + k * 2.3 * (1 + vol * 0.9);
        const sx = cx + side * (RX * 0.92 + off), sy = cy - RY * 0.25 + (K - k) * 0.5 - vol * 2;
        const pts = [];
        const n0 = Math.max(2, Math.ceil(Math.hypot(sx - rx0, sy - ry0)));
        for (let j = 0; j < n0; j++) { const t = j / n0; pts.push([rx0 + (sx - rx0) * t, ry0 + (sy - ry0) * t - Math.sin(t * Math.PI) * 2]); }
        const hang = pts.length;
        const L = S.len * MAXLEN * SHRINK[S.tex];
        for (let d = 0; d <= L; d++) {
            const p = d / MAXLEN;
            let x = sx + side * (vol * p * 16 + k * p * 1.6);
            if (S.tex === 'wavy') x += 1.8 * Math.sin(d / 5 + i * 0.7);
            else if (S.tex === 'curly') x += 2.6 * Math.sin(d / 2.2 + i * 1.3);
            else if (S.tex === 'crimp') { const u = (d / 4 + i * 0.25) % 1; x += 1.7 * (Math.abs(u * 2 - 1) * 2 - 1); }
            pts.push([x, sy + d]);
        }
        return { pts, hang, side, k };
    }
    inCap(x, y) {
        const { cx, cy, RX, RY } = this.g, vol = this.st.vol;
        const ex = (x - cx) / (RX * 1.12 + vol * 3), ey = (y - (cy - vol * 2)) / (RY * 1.1 + vol * 5);
        if (ex * ex + ey * ey > 1 || y > cy + RY * 0.15) return false;
        const fx = (x - cx) / (RX * 0.88), fy = (y - (cy + RY * 0.3)) / (RY * 0.78);
        return fx * fx + fy * fy > 1;
    }
    capMask(P) {
        const { cx, cy, RX, RY } = this.g, vol = this.st.vol;
        P.mell(cx, cy - vol * 2, RX * 1.12 + vol * 3, RY * 1.1 + vol * 5);
        P.msub((q) => q.mell(cx, cy + RY * 0.3, RX * 0.88, RY * 0.78).mrect(0, Math.floor(cy + RY * 0.15), N, N));
    }
    capTop() { const { cy, RY } = this.g, vol = this.st.vol; return cy - vol * 2 - (RY * 1.1 + vol * 5); }

    // ------------------------------------------------------------------ painting
    figure(id) {
        let f = this.figs.get(id);
        if (f) return f;
        const src = spriteOf(id), { s, ox, oy, a } = this.g;
        const P = new Px(N, N);
        for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
            const i = (y * src.w + x) * 4;
            if (!src.d[i + 3]) continue;
            const c = [src.d[i], src.d[i + 1], src.d[i + 2]];
            for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) P.set(ox + x * s + dx, oy + y * s + dy, c);
        }
        if (a.face) {
            // a face, so the cauldron has somewhere to put its lipstick
            for (const [ex, ey, ew, eh] of a.eyes) {
                const x = ox + (ex + ew / 2) * s, y = oy + (ey + eh / 2) * s;
                P.mell(x, y, ew * s * 0.7, eh * s * 0.75).paint('#f4eefa', { noline: true });
                P.mell(x + 0.5, y + 0.5, ew * s * 0.35, eh * s * 0.45).fill('#1a1020');
                P.mp(x - 1, y - 1).fill('#ffffff');
            }
            const [mx, my, mw] = a.mouth;
            P.mline(ox + mx * s, oy + my * s, ox + (mx + mw / 2) * s, oy + my * s + 2, 1).mline(ox + (mx + mw / 2) * s, oy + my * s + 2, ox + (mx + mw) * s, oy + my * s, 1).fill('#ff9cc0');
        }
        f = P;
        this.figs.set(id, f);
        return f;
    }
    build() {
        const st = this.st, { s, ox, oy, cx, cy, RX, RY, a } = this.g;
        this.paths = st.strands.map((_, i) => this.strandPath(i));
        // ----- the face: a copy of the client, with make-up
        const F = new Px(N, N);
        F.d.set(this.figure(st.client).d);
        if (st.blush) for (const [x, y] of a.cheeks) { F.mell(ox + x * s, oy + y * s, s * 1.5, s * 0.85); F.tint((c) => mix(c, '#ff6fa5', 0.45)); }
        if (st.shadow) {
            for (const [ex, ey, ew, eh] of a.eyes) {
                const X = ox + ex * s, Y = oy + ey * s, W = ew * s, H = eh * s;
                F.mell(X + W / 2, Y - s * 0.3, W / 2 + s * 0.9, s * 1.05).msub((q) => q.mrect(X, Y, W, H));
                F.paint(COLOURS[st.shadow], { soft: true, noline: true });
            }
        }
        if (st.lashes) {
            for (const [ex, ey, ew] of a.eyes) {
                const X = ox + ex * s, Y = oy + ey * s, W = ew * s;
                const out = X + W / 2 < cx ? -1 : 1, xo = out < 0 ? X - 1 : X + W;
                F.mrect(X - 1, Y - 1, W + 2, 1).mline(xo, Y - 1, xo + out * s, Y - 1 - s, 1).mline(xo - out * 2, Y - 1, xo - out * 2 + out * s * 0.6, Y - 2 - s * 0.8, 1);
                F.fill('#140a1a');
            }
        }
        if (st.lips) {
            const [mx, my, mw, mh] = a.mouth;
            const X = ox + mx * s, Y = oy + my * s, W = mw * s, H = mh * s;
            F.mell(X + W / 2, Y + H / 2, W / 2 + s * 0.6, Math.max(H / 2, s * 0.5) + s * 0.45).paint(COLOURS[st.lips], { hi: 1.3 });
            F.mrect(Math.round(X - s * 0.3), Math.round(Y + H / 2), Math.round(W + s * 0.6), 1).tint((c) => mix(c, '#1a0a14', 0.45));
            F.mp(X + W / 2 - 1, Y + H / 2 - 2).fill(mix(COLOURS[st.lips], '#ffffff', 0.6));
        }
        if (st.glitter) {
            for (let i = 0; i < 14; i++) {
                const ch = a.cheeks[i % 2], e = a.eyes[i % 2];
                const [bx, by] = i < 8 ? [ox + ch[0] * s, oy + ch[1] * s] : [ox + (e[0] + e[2] / 2) * s, oy + e[1] * s - s];
                F.mp(bx + (hash3(i, 3, st.n) - 0.5) * s * 4, by + (hash3(i, 5, st.n) - 0.5) * s * 2);
            }
            F.fill('#fff6c8');
        }
        // ----- the hair: strands, then the top of the head and the fringe
        const H = new Px(N, N);
        const wet = Math.ceil(st.wet * 3) / 3;
        const shade = (c) => (wet > 0 ? mix(COLOURS[c], '#1a1030', 0.3 * wet) : COLOURS[c]);
        const order = st.strands.map((_, i) => i).sort((p, q) => this.paths[q].k - this.paths[p].k);
        for (const i of order) {
            const { pts } = this.paths[i], S = st.strands[i];
            const t = S.tex === 'curly' ? 4 : 3;
            for (let j = 1; j < pts.length; j++) H.mline(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], t);
            // the cut end tapers to a point
            const end = pts[pts.length - 1];
            H.mp(end[0], end[1] + 1);
            H.paint(shade(S.c), { hi: 1.2 });
        }
        this.capMask(H);
        H.paint(shade(st.cap), { hi: 1.1 });
        const top = cy - RY * 0.6 - st.vol * 2, by = Math.floor(this.g.eyeTop - 1);
        if (st.bangs !== 'none' && by - top >= 2) {
            if (st.bangs === 'blunt') { H.mrect(cx - RX * 0.82, top, RX * 1.64, by - top + 1); H.msub((q) => { for (let x = Math.round(cx - RX * 0.8) + 2; x < cx + RX * 0.8; x += 4) q.mp(x, by); }); }
            else if (st.bangs === 'side') H.mpoly([[cx - RX * 0.9, top], [cx + RX * 0.9, top], [cx + RX * 0.9, top + 2], [cx - RX * 0.15, by + 1], [cx - RX * 0.9, by - 1]]);
            else if (st.bangs === 'curtain') { H.mpoly([[cx - 1, top], [cx - RX * 0.9, top], [cx - RX * 0.85, by + 1], [cx - RX * 0.45, by - 2]]); H.mpoly([[cx + 1, top], [cx + RX * 0.9, top], [cx + RX * 0.85, by + 1], [cx + RX * 0.45, by - 2]]); }
            else for (let j = 0; j < 5; j++) { const x = cx - RX * 0.7 + j * RX * 0.35; H.mpoly([[x - RX * 0.22, top], [x + RX * 0.22, top], [x + (j - 2) * 0.6, by + 1]]); }
            H.paint(shade(st.cap), { hi: 1.1 });
        }
        // a shine across the crown
        H.mell(cx - RX * 0.4, this.capTop() + RY * 0.35, RX * 0.32, Math.max(1, RY * 0.1));
        H.tint((c) => mix(c, '#ffffff', 0.35));
        H.outline('#160d22', 0.85);
        // ----- accessories and stickers
        const A = new Px(N, N);
        const ct = this.capTop();
        if (st.top === 'tiara') {
            A.mrect(cx - RX * 0.55, ct + 1, RX * 1.1, 2);
            for (const [dx, h] of [[-0.4, 4], [0, 7], [0.4, 4]]) A.mpoly([[cx + dx * RX - 2.5, ct + 2], [cx + dx * RX + 2.5, ct + 2], [cx + dx * RX, ct + 1 - h]]);
            A.paint('#ffd36b', { hi: 1.4 });
            A.mp(cx, ct - 1).mp(cx, ct).fill('#ff4f86'); A.mp(cx - RX * 0.4, ct).mp(cx + RX * 0.4, ct).fill('#7ad0ff');
        } else if (st.top === 'witch') {
            A.mpoly([[cx - RX * 0.62, ct + 3], [cx + RX * 0.62, ct + 3], [cx + RX * 0.2, ct - RY * 1.2], [cx + RX * 0.85, ct - RY * 1.65], [cx - RX * 0.1, ct - RY * 1.15]]).paint('#3a2a5a', { lo: 1.2 });
            A.mell(cx, ct + 3, RX * 1.45, 2.6).paint('#2a2238');
            A.mrect(cx - RX * 0.56, ct - 1, RX * 1.12, 3).paint('#ff6fa5');
            A.mrect(cx - 1, ct - 1, 3, 3).fill('#ffd36b');
        } else if (st.top === 'flowers') {
            for (let j = 0; j < 7; j++) {
                const an = Math.PI * (1.12 + 0.76 * j / 6);
                const x = cx + (RX * 1.02 + st.vol * 3) * Math.cos(an), y = cy - st.vol * 2 + (RY * 1.02 + st.vol * 5) * Math.sin(an);
                A.mell(x + 2, y + 1, 1.6, 1.2).paint('#3a7a3a');
                A.mell(x, y, 2.6, 2.4).paint(j % 2 ? '#c0306a' : '#5a0a2a', { hi: 1.4 });
                A.mp(x, y).fill(j % 2 ? '#ff8ab0' : '#a02a5a');
            }
        } else if (st.top === 'ears') {
            for (const sd of [-1, 1]) {
                const x = cx + sd * RX * 0.6;
                A.mpoly([[x - RX * 0.32, ct + RY * 0.35], [x + RX * 0.32, ct + RY * 0.35], [x + sd * RX * 0.12, ct - RY * 0.55]]).paint('#2c2438');
                A.mpoly([[x - RX * 0.15, ct + RY * 0.3], [x + RX * 0.15, ct + RY * 0.3], [x + sd * RX * 0.08, ct - RY * 0.25]]).paint('#ff9cc0', { noline: true });
            }
        }
        if (st.clip) {
            const x = Math.round(cx + RX * 0.8 + st.vol * 2), y = Math.round(cy - RY * 0.72 - st.vol * 3);
            if (st.clip === 'bow') {
                A.mpoly([[x, y], [x - 5, y - 3], [x - 5, y + 3]]).mpoly([[x, y], [x + 5, y - 3], [x + 5, y + 3]]).paint(COLOURS[st.bow]);
                A.mline(x - 1, y + 1, x - 3, y + 5, 1).mline(x + 1, y + 1, x + 3, y + 5, 1).paint(COLOURS[st.bow]);
                A.mell(x, y, 1.6, 1.6).paint(mix(COLOURS[st.bow], '#ffffff', 0.25));
            } else if (st.clip === 'bat') {
                A.mpoly([[x, y - 1], [x - 6, y - 4], [x - 5, y + 1], [x - 3, y], [x, y + 3], [x + 3, y], [x + 5, y + 1], [x + 6, y - 4]]).paint('#3a2a52');
                A.mp(x - 1, y).mp(x + 1, y).fill('#ffd84a');
            } else if (st.clip === 'spider') {
                for (const sd of [-1, 1]) for (let l = 0; l < 3; l++) A.mline(x, y, x + sd * 4, y - 2 + l * 2.5, 1);
                A.fill('#2a1838');
                A.mell(x, y, 2.4, 2.2).paint('#5a2a8a', { hi: 1.4 }); A.mp(x, y).fill('#ff4f86');
            } else if (st.clip === 'skull') {
                A.mell(x, y - 0.5, 3.2, 2.8).mrect(x - 2, y + 1, 4, 2).paint('#f4eefa', { hi: 0.6 });
                A.mp(x - 1, y - 1).mp(x + 1, y - 1).fill('#2a1838');
            } else {
                A.mpoly([[x - 1, y + 2], [x - 5, y + 4], [x - 2, y + 5]]).paint('#3a7a3a');
                A.mell(x, y, 3, 2.8).paint('#5a0a2a', { hi: 1.5 }); A.mp(x, y).mp(x - 1, y - 1).fill('#a02a5a');
            }
        }
        for (const k of st.stickers) stickerPx(A, k.k, k.x, k.y);
        A.outline('#160d22', 0.8);
        if (st.top === 'veil') {
            // a veil of tulle: see-through, falling from a band of tiny white flowers past the shoulders
            const P = new Px(N, N);
            P.mpoly([[cx - RX * 0.8, ct + 2], [cx + RX * 0.8, ct + 2], [cx + RX * 2.3, N], [cx - RX * 2.3, N]]);
            P.msub((q) => q.mell(cx, cy + RY * 0.3, RX * 0.95, RY * 0.9));
            for (let i = 0; i < N * N; i++) if (P.m[i]) { const x = i % N, y = (i / N) | 0; if (!A.d[i * 4 + 3]) A.set(x, y, (x + y) % 5 ? '#f4f0ff' : '#ffffff', (x * 3 + y) % 7 ? 95 : 150); }
            for (let j = 0; j < 7; j++) { const x = cx - RX * 0.7 + j * RX * 0.233; A.set(x, ct + 2, '#ffffff'); A.set(x + 1, ct + 1, '#ffe0ee'); A.set(x, ct + 1, '#ffffff'); }
        }
        // ----- into the three layer canvases
        [F, H, A].forEach((P, i) => this.layers[i].getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(P.d), N, N), 0, 0));
        this.hairA = H.d;
    }

    paintBackground() {
        const P = new Px(N, N);
        // damask wallpaper in two plums, a mirror behind the chair, the chair's tufted back
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const stripe = ((x / 8) | 0) % 2;
            let c = stripe ? '#3a2050' : '#33194a';
            const u = x % 16 - 8, v = (y % 20) - 10;
            if (Math.abs(u) + Math.abs(v) * 0.7 < 3) c = '#4a2a62';
            P.set(x, y, c);
        }
        P.mrect(0, 104, N, 24).paint('#2a1636', { lo: 1.3 });
        P.mrect(0, 103, N, 2).fill('#c9a24a');
        P.mell(64, 52, 46, 50).msub((q) => q.mell(64, 52, 41, 45)).paint('#d4a03a', { hi: 1.4 });
        P.mell(64, 52, 41, 45).paint('#5a4a7a', { soft: true });
        P.mell(52, 30, 12, 20).tint((c) => mix(c, '#8a7aaa', 0.4));
        for (const a of [0.5, 1.6, 2.6, 3.7, 4.7, 5.8]) P.mell(64 + Math.cos(a) * 44, 52 + Math.sin(a) * 48, 2.5, 2.5).paint('#ffd36b', { hi: 1.5 });
        P.mrect(30, 88, 68, 40).mell(64, 88, 34, 10).paint('#c2367a', { lo: 1.2 });
        for (const [x, y] of [[44, 92], [64, 90], [84, 92], [54, 102], [74, 102]]) P.mp(x, y).fill('#7a1a4a');
        // candle sconces either side
        for (const x of [10, 118]) { P.mrect(x - 3, 40, 6, 3).paint('#c9a24a'); P.mrect(x - 1, 32, 3, 8).paint('#fff3d6'); P.mell(x + 0.5, 29, 1.5, 2.5).paint('#ffcf4a', { soft: true }); }
        // a cobweb in the corner, naturally
        for (const [x, y] of [[0, 18], [18, 0], [12, 12], [4, 16], [16, 4]]) P.mline(0, 0, x, y, 1);
        for (let r = 5; r < 18; r += 5) for (let a = 0; a <= 8; a++) P.mp(Math.cos(a * 0.196) * r, Math.sin(a * 0.196) * r);
        P.fill('#7a6a9a');
        return P.toCanvas();
    }

    // ------------------------------------------------------------------ brushes
    at(e) {
        const r = this.canvas.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * N, ((e.clientY - r.top) / r.height) * N];
    }
    pdown(e) {
        e.preventDefault();
        if (!this.st || this.ended) return;
        this.canvas.setPointerCapture?.(e.pointerId);
        const [x, y] = this.at(e);
        const t = TOOL[this.tool];
        if (t?.stamp) {
            if (this.st.stickers.length >= 12) this.st.stickers.shift();
            this.st.stickers.push({ k: this.sticker, x, y });
            this.sfx('pick');
            this.spark(x, y, 6);
            this.dirty = true;
            return;
        }
        if (!t?.brush) return;
        this.down = { x, y };
        this.brush(x, y);
    }
    pmove(e) {
        const [x, y] = this.at(e);
        this.pointer = [x, y];
        if (!this.down) return;
        const d = this.down, n = Math.max(1, Math.ceil(Math.hypot(x - d.x, y - d.y) / 2));
        for (let i = 1; i <= n; i++) this.brush(d.x + (x - d.x) * i / n, d.y + (y - d.y) * i / n);
        this.down = { x, y };
    }
    near(x, y, r) {
        const out = [];
        this.paths.forEach((p, i) => {
            let best = -1, bd = r * r;
            for (let j = 0; j < p.pts.length; j++) { const dx = p.pts[j][0] - x, dy = p.pts[j][1] - y, d = dx * dx + dy * dy; if (d <= bd) { bd = d; best = j; } }
            if (best >= 0) out.push({ i, j: best });
        });
        return out;
    }
    onHair(x, y) { const i = ((y | 0) * N + (x | 0)) * 4; return x >= 0 && y >= 0 && x < N && y < N && !!this.hairA?.[i + 3]; }
    brush(x, y) {
        const st = this.st, tool = this.tool;
        if (tool === 'shampoo') {
            if (!this.onHair(x, y) && !this.inCap(x, y)) return;
            if (st.foam.length < 260 && !st.foam.some((b) => Math.abs(b.x - x) < 2.2 && Math.abs(b.y - y) < 2.2)) {
                st.foam.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, r: Math.floor(Math.random() * 3), ph: Math.random() * 6 });
                this.sfx('bubble');
            }
            for (const d of st.dirt) { const [dx, dy] = this.dirtAt(d); if (Math.hypot(dx - x, dy - y) < 7) d.loose = true; }
        } else if (tool === 'rinse') {
            for (let k = 0; k < 2; k++) this.parts.push({ x: x + (Math.random() - 0.5) * 6, y, vx: 0, vy: 30 + Math.random() * 30, life: 0.6, t: 0, col: '#9ad0ff', k: 'drop' });
            const before = st.foam.length;
            st.foam = st.foam.filter((b) => Math.hypot(b.x - x, b.y - y) > 7);
            st.dirt = st.dirt.filter((d) => { const [dx, dy] = this.dirtAt(d); if (d.loose && Math.hypot(dx - x, dy - y) < 8) { this.fall(d, dx, dy); return false; } return true; });
            if (this.onHair(x, y) || before !== st.foam.length) { st.wet = 1; this.dirty = true; }
            this.sfx('water');
        } else if (tool === 'scissors') {
            for (const { i, j } of this.near(x, y, 3)) this.cut(i, j);
        } else if (tool === 'dye') {
            let hit = false;
            for (const { i } of this.near(x, y, 4.5)) if (st.strands[i].c !== this.colour) { st.strands[i].c = this.colour; hit = true; }
            if (this.inCap(x, y) && st.cap !== this.colour) { st.cap = this.colour; hit = true; }
            if (hit) { this.dirty = true; this.sfx('dye'); this.parts.push({ x, y, vx: 0, vy: 18, life: 0.5, t: 0, col: COLOURS[this.colour], k: 'drop' }); }
        } else if (TOOL[tool]?.tex) {
            const tex = TOOL[tool].tex;
            let hit = false;
            for (const { i } of this.near(x, y, 5)) if (st.strands[i].tex !== tex) { st.strands[i].tex = tex; hit = true; }
            if (hit) { this.dirty = true; this.sfx(tex === 'straight' ? 'comb' : 'iron'); this.spark(x, y, 3); }
        }
    }
    /** Snip strand i at point j; the piece that comes away falls to the floor. */
    cut(i, j) {
        const st = this.st, S = st.strands[i], p = this.paths[i];
        const nl = j <= p.hang ? 0 : Math.max(0, (j - p.hang) / (MAXLEN * SHRINK[S.tex]));
        if (nl >= S.len - 0.01) return;
        for (let q = Math.max(j, p.hang); q < p.pts.length; q += 2) this.parts.push({ x: p.pts[q][0], y: p.pts[q][1], vx: (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 6, g: 60, life: 1.1, t: 0, col: COLOURS[S.c], k: 'hair' });
        S.len = nl;
        st.dirt = st.dirt.filter((d) => { if (d.on !== i || d.d * SHRINK[S.tex] < nl * MAXLEN * SHRINK[S.tex]) return true; const [dx, dy] = this.dirtAt(d); this.fall(d, dx, dy); return false; });
        this.dirty = true;
        this.sfx('snip');
    }
    applyAll(tool) {
        const st = this.st;
        if (tool === 'shampoo') {
            for (const p of this.paths) for (let j = 0; j < p.pts.length; j += 4) if (st.foam.length < 260) st.foam.push({ x: p.pts[j][0] + (Math.random() - 0.5) * 3, y: p.pts[j][1], r: Math.floor(Math.random() * 3), ph: Math.random() * 6 });
            const { cx, RX } = this.g, ct = this.capTop();
            for (let k = 0; k < 24; k++) st.foam.push({ x: cx + (Math.random() - 0.5) * RX * 2, y: ct + 2 + Math.random() * 6, r: Math.floor(Math.random() * 3), ph: Math.random() * 6 });
            for (const d of st.dirt) d.loose = true;
            this.sfx('bubble');
        } else if (tool === 'rinse') {
            for (let k = 0; k < 40; k++) this.parts.push({ x: this.g.cx + (Math.random() - 0.5) * 70, y: this.capTop() + Math.random() * 20, vx: 0, vy: 40 + Math.random() * 30, life: 0.9, t: 0, col: '#9ad0ff', k: 'drop' });
            st.foam = [];
            st.dirt = st.dirt.filter((d) => { if (!d.loose) return true; const [x, y] = this.dirtAt(d); this.fall(d, x, y); return false; });
            st.wet = 1;
            this.sfx('water');
        } else if (tool === 'scissors') {
            st.strands.forEach((S, i) => { const p = this.paths[i]; const j = Math.round(p.hang + Math.max(0, S.len - 0.15) * MAXLEN * SHRINK[S.tex]); if (S.len > 0) this.cut(i, Math.min(j, p.pts.length - 1)); });
        } else if (tool === 'dye') {
            for (const S of st.strands) S.c = this.colour;
            st.cap = this.colour;
            this.sfx('dye');
            this.sparkleHead();
        } else if (TOOL[tool]?.tex) {
            for (const S of st.strands) S.tex = TOOL[tool].tex;
            this.sfx('iron');
            this.sparkleHead();
        } else if (tool === 'spray') {
            st.vol = Math.min(1, st.vol + 0.35);
            this.mist(30);
            this.sfx('spray');
        }
        this.dirty = true;
    }
    /** The buttons that do something at once: grow tonic and the make-up. */
    act(id) {
        const st = this.st;
        if (id === 'grow') { for (const S of st.strands) S.len = Math.min(1, S.len + 0.3); this.sfx('grow'); this.sparkleHead(); }
        else if (id === 'lips') { st.lips = st.lips === this.colour ? null : this.colour; this.sfx('pick'); }
        else if (id === 'shadow') { st.shadow = st.shadow === this.colour ? null : this.colour; this.sfx('pick'); }
        else if (id === 'blush') { st.blush = !st.blush; this.sfx('pick'); }
        else if (id === 'lashes') { st.lashes = !st.lashes; this.sfx('pick'); }
        else if (id === 'glitter') { st.glitter = !st.glitter; this.sfx('grow'); }
        else if (id === 'wipe') { st.lips = st.shadow = null; st.blush = st.lashes = st.glitter = false; st.stickers.length = 0; this.sfx('water'); }
        if (id !== 'grow') this.spark(this.g.cx, this.g.cy + this.g.RY * 0.4, 8);
        this.dirty = true;
    }
    dirtAt(d) {
        if (d.on < 0) { const { cx, RX, RY } = this.g; return [cx + d.dx * RX, this.g.cy - this.st.vol * 2 + d.dy * RY * 1.1]; }
        const p = this.paths[d.on], q = p.pts[Math.min(p.pts.length - 1, p.hang + Math.round(d.d * SHRINK[this.st.strands[d.on].tex]))];
        return [q[0], q[1]];
    }
    fall(d, x, y) { this.parts.push({ x, y, vx: (Math.random() - 0.5) * 20, vy: -10, g: 120, life: 1.2, t: 0, img: this.dirtImg[d.kind], k: 'img' }); }
    spark(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.5, t: 0, col: ['#ffffff', '#ffd36b', '#ff9cc0'][i % 3], k: 'spark' }); }
    sparkleHead() { const { cx, cy, RX, RY } = this.g; for (let i = 0; i < 18; i++) this.spark(cx + (Math.random() - 0.5) * RX * 3, cy + (Math.random() - 0.7) * RY * 2.5, 1); }
    mist(n) { const { cx, cy, RX } = this.g; for (let i = 0; i < n; i++) this.parts.push({ x: cx + (Math.random() - 0.5) * RX * 3, y: cy - 10 + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 10, vy: -4, life: 0.8, t: 0, col: '#e8f0ff', k: 'mist' }); }
    sfx(kind) {
        const now = performance.now();
        if (kind !== 'pick' && now - this.sfxT < 70) return;
        this.sfxT = now;
        this.audio.salon?.(kind);
    }

    // ------------------------------------------------------------------ the frame
    frame(dt, G) {
        this.G = G;
        this.liveT -= dt;
        if (this.liveT <= 0) { this.liveT = 0.25; this.status(); if (this.mode === 'chair') this.live(); }
        if (this.mode !== 'chair' || !this.st) return;
        const st = this.st;
        // hairspray works while the button is held
        if (this.down && this.tool === 'spray' && !this.ended) {
            if (st.vol < 1) { st.vol = Math.min(1, st.vol + dt * 0.45); this.dirty = true; }
            if (Math.random() < dt * 30) this.parts.push({ x: this.down.x + (Math.random() - 0.5) * 10, y: this.down.y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 12, vy: -6, life: 0.7, t: 0, col: '#e8f0ff', k: 'mist' });
            this.sfx('spray');
        }
        if (st.wet > 0) { const q = Math.ceil(st.wet * 3); st.wet = Math.max(0, st.wet - dt / 9); if (Math.ceil(st.wet * 3) !== q) this.dirty = true; }
        if (this.dirty) { this.build(); this.dirty = false; this.liveT = Math.min(this.liveT, 0.05); }
        const x = this.ctx;
        x.clearRect(0, 0, N, N);
        x.drawImage(this.bg, 0, 0);
        for (const c of this.layers) x.drawImage(c, 0, 0);
        const time = performance.now() / 1000;
        // grime from the crypt: loose bits wriggle
        for (const d of st.dirt) {
            const [dx, dy] = this.dirtAt(d), img = this.dirtImg[d.kind];
            const w = d.loose ? Math.round(Math.sin(time * 14 + d.ph)) : 0;
            x.drawImage(img, Math.round(dx - img.width / 2 + w), Math.round(dy - img.height / 2));
        }
        for (const b of st.foam) { const img = this.bubImg[b.r]; x.drawImage(img, Math.round(b.x - img.width / 2), Math.round(b.y - img.height / 2 + Math.sin(time * 3 + b.ph) * 0.6)); }
        if (st.glitter) for (let i = 0; i < 6; i++) {
            const p = this.paths[(i * 5 + Math.floor(time * 2)) % STRANDS], q = p.pts[Math.floor(hash3(i, Math.floor(time * 2), st.n) * p.pts.length)];
            if (q) { x.fillStyle = '#ffffff'; x.fillRect(Math.round(q[0]), Math.round(q[1]) - 1, 1, 3); x.fillRect(Math.round(q[0]) - 1, Math.round(q[1]), 3, 1); }
        }
        // particles: snipped hair, water, sparkles, mist
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.t += dt;
            if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
            p.vy += (p.g || 0) * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            const a = 1 - p.t / p.life;
            x.globalAlpha = Math.min(1, a * 1.5);
            if (p.k === 'img') x.drawImage(p.img, Math.round(p.x - p.img.width / 2), Math.round(p.y));
            else if (p.k === 'hair') { x.fillStyle = p.col; x.fillRect(Math.round(p.x), Math.round(p.y), 2, 3); }
            else if (p.k === 'heart') { x.fillStyle = p.col; const X = Math.round(p.x), Y = Math.round(p.y); x.fillRect(X - 2, Y - 1, 2, 2); x.fillRect(X + 1, Y - 1, 2, 2); x.fillRect(X - 2, Y, 5, 1); x.fillRect(X - 1, Y + 1, 3, 1); x.fillRect(X, Y + 2, 1, 1); }
            else if (p.k === 'spark') { x.fillStyle = p.col; const X = Math.round(p.x), Y = Math.round(p.y); x.fillRect(X, Y - 1, 1, 3); x.fillRect(X - 1, Y, 3, 1); }
            else { x.fillStyle = p.col; x.fillRect(Math.round(p.x), Math.round(p.y), p.k === 'mist' ? 2 : 1, p.k === 'drop' ? 2 : 2); }
        }
        x.globalAlpha = 1;
        // the brush under the pointer
        const t = TOOL[this.tool];
        if (this.pointer && t?.brush && !this.ended) {
            const r = this.tool === 'scissors' ? 3 : this.tool === 'dye' ? 4.5 : 5;
            x.strokeStyle = this.tool === 'dye' ? COLOURS[this.colour] : 'rgba(255,255,255,0.7)';
            x.lineWidth = 1;
            x.beginPath(); x.arc(Math.round(this.pointer[0]) + 0.5, Math.round(this.pointer[1]) + 0.5, r, 0, Math.PI * 2); x.stroke();
        }
        if (this.flash > 0) { x.fillStyle = `rgba(255,255,255,${this.flash * 0.8})`; x.fillRect(0, 0, N, N); this.flash = Math.max(0, this.flash - dt * 2.5); }
    }
}
