// Card faces, drawn into canvases once per design and cached: the fal illustration, the rank, the name and the
// rules text for your cards; a big rank, the rival's sign and their trait marks for rival cards. Reads data only.

import * as THREE from 'three';
import { CARDS, SUITS, RANK_LABEL, cardText } from '../sim/data/cards.js';
import { RIVALS } from '../sim/data/rivals.js';
import { ROOT } from '../media.js';

export const CW = 256, CH = 384;            // canvas size of one face (2:3)
const SERIF = "'IM Fell English', 'Georgia', 'Times New Roman', serif";

const images = {};
/** An <img> for a path under the game folder; calls back once it has loaded (or failed). */
export function image(path, cb) {
    let im = images[path];
    if (!im) {
        im = images[path] = new Image();
        im.decoding = 'async';
        im.cbs = [];
        im.onload = () => { im.ready = true; im.cbs.splice(0).forEach((f) => f()); };
        im.onerror = () => { im.failed = true; im.cbs.splice(0).forEach((f) => f()); };
        im.src = ROOT + path;
    }
    if (cb) { if (im.ready || im.failed) cb(); else im.cbs.push(cb); }
    return im;
}

function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function wrap(ctx, text, x, y, maxW, lh, maxLines = 5) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

function fitFont(ctx, text, maxW, size, weight = 'bold') {
    let s = size;
    do { ctx.font = `${weight} ${s}px ${SERIF}`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 10);
}

function canvasTexture(draw) {
    const c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const redraw = () => { draw(c.getContext('2d')); tex.needsUpdate = true; };
    redraw();
    tex.redraw = redraw;
    return tex;
}

/** The face of one of your cards. up = Polished. */
function drawOwn(ctx, id, up) {
    const d = CARDS[id], S = SUITS[d.suit];
    const art = image(d.partner ? `art/rival-${d.partner}.webp` : `art/card-${d.id}.webp`);
    ctx.clearRect(0, 0, CW, CH);
    rounded(ctx, 2, 2, CW - 4, CH - 4, 18);
    ctx.fillStyle = d.junk ? '#2a2133' : '#efe3c6'; ctx.fill();
    ctx.lineWidth = up ? 10 : 8; ctx.strokeStyle = up ? '#f2c94c' : S.color; ctx.stroke();
    // the picture
    const ax = 16, ay = 44, aw = CW - 32, ah = 170;
    ctx.save(); rounded(ctx, ax, ay, aw, ah, 8); ctx.clip();
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(ax, ay, aw, ah);
    if (art.ready) {
        const iw = art.naturalWidth, ih = art.naturalHeight;
        const k = Math.max(aw / iw, ah / ih);
        const sw = aw / k, sh = ah / k;
        ctx.drawImage(art, (iw - sw) / 2, d.partner ? ih * 0.06 : (ih - sh) / 2, sw, sh, ax, ay, aw, ah);
    }
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,24,10,0.6)'; rounded(ctx, ax, ay, aw, ah, 8); ctx.stroke();
    // name
    ctx.fillStyle = d.junk ? '#e8dcff' : S.ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, d.name + (up ? ' +' : ''), CW - 110, 24);
    ctx.fillText(d.name + (up ? ' +' : ''), CW / 2 + 12, 25);
    // rank badge
    ctx.beginPath(); ctx.arc(40, 40, 30, 0, Math.PI * 2);
    ctx.fillStyle = S.color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff7e0'; ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    const label = d.trick ? '⚔' : d.junk ? '✶' : RANK_LABEL[d.rank];
    ctx.font = `bold ${label.length > 1 ? 28 : 36}px ${SERIF}`;
    ctx.fillText(label, 40, 42);
    // suit
    ctx.font = `30px ${SERIF}`; ctx.fillStyle = S.color;
    ctx.fillText(S.glyph, CW - 30, 26);
    // rules text
    ctx.fillStyle = d.junk ? '#d9ccef' : '#2a1d12';
    ctx.font = `20px ${SERIF}`;
    const text = cardText(d, up).replace(/ · /g, ' · ');
    wrap(ctx, text, CW / 2, 246, CW - 34, 25, 5);
    ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = d.junk ? '#a898c4' : S.color;
    ctx.fillText(d.partner ? `Partner: ${RIVALS[d.partner].name}` : S.name, CW / 2, CH - 20);
}

/** A rival card: big rank, the rival's sign, marks for taint and bounty. */
function drawRival(ctx, rid, rank, taint, bounty) {
    const R = RIVALS[rid];
    ctx.clearRect(0, 0, CW, CH);
    rounded(ctx, 2, 2, CW - 4, CH - 4, 18);
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, '#f4ead2'); g.addColorStop(1, '#e2d2ae');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = taint ? '#5aa63c' : R.color; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const red = rank % 2 === 0;
    ctx.fillStyle = red ? '#8e1f1f' : '#1d1a2a';
    ctx.font = `bold ${rank === 10 ? 150 : 180}px ${SERIF}`;
    ctx.fillText(RANK_LABEL[rank], CW / 2, CH / 2 + 8);
    ctx.font = `bold 40px ${SERIF}`;
    ctx.fillText(RANK_LABEL[rank], 34, 38);
    ctx.save(); ctx.translate(CW - 34, CH - 38); ctx.rotate(Math.PI); ctx.fillText(RANK_LABEL[rank], 0, 0); ctx.restore();
    ctx.fillStyle = R.color; ctx.font = `34px ${SERIF}`;
    ctx.fillText(R.glyph, CW - 34, 38);
    ctx.fillText(R.glyph, 34, CH - 38);
    if (taint) { ctx.fillStyle = '#3f8a24'; ctx.font = `bold 44px ${SERIF}`; ctx.fillText('☠', CW / 2, CH - 46); }
    if (bounty) { ctx.fillStyle = '#c99a1c'; ctx.font = `bold 44px ${SERIF}`; ctx.fillText('◆', CW / 2, 50); }
}

const faces = {};
export function ownFace(id, up = false) {
    const key = id + (up ? '+' : '');
    if (!faces[key]) {
        const d = CARDS[id];
        const tex = faces[key] = canvasTexture((ctx) => drawOwn(ctx, id, up));
        image(d.partner ? `art/rival-${d.partner}.webp` : `art/card-${d.id}.webp`, () => tex.redraw());
    }
    return faces[key];
}
export function rivalFace(rid, rank, taint, bounty) {
    const key = `${rid}:${rank}:${taint ? 1 : 0}${bounty ? 1 : 0}`;
    return (faces[key] ||= canvasTexture((ctx) => drawRival(ctx, rid, rank, taint, bounty)));
}
/** Redraw every face (after the web font arrives). */
export function redrawAll() { for (const t of Object.values(faces)) t.redraw(); }

const backs = {};
export function backTexture(which) {
    if (backs[which]) return backs[which];
    const tex = backs[which] = new THREE.TextureLoader().load(ROOT + `art/${which}.webp`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}
