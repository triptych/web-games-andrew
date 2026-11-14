// Photos: put a rendered diorama in a frame (an instant photo with a written caption, a postcard
// with a stamp, or none), then save it as a file, hand it to the system share sheet, copy a link
// that rebuilds the diorama, or keep a small copy in the album.

import { PHOTO } from './config.js';

export const ASPECTS = { '4:3': [PHOTO.w, PHOTO.h], '1:1': [1400, 1400], '9:16': [1080, 1920] };
const HAND = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';

function fitText(g, text, max, size, weight = 600) {
    let s = size;
    g.font = `${weight} ${s}px ${HAND}`;
    while (g.measureText(text).width > max && s > 12) g.font = `${weight} ${--s}px ${HAND}`;
    return s;
}

function stars(g, n, x, y, r) {
    for (let i = 0; i < 3; i++) {
        const cx = x + i * r * 2.4;
        g.beginPath();
        for (let k = 0; k < 10; k++) {
            const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
            g.lineTo(cx + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = i < n ? '#f2b51e' : 'rgba(74,52,40,0.15)';
        g.fill();
    }
}

/** Frame a rendered photo. meta: { caption, room, stars, date }. Returns a new canvas. */
export function frame(shot, kind, meta = {}) {
    const w = shot.width, h = shot.height;
    if (kind === 'none') return shot;
    const out = document.createElement('canvas');
    const g = out.getContext('2d');
    if (kind === 'postcard') {
        const m = Math.round(w * 0.035);
        out.width = w + m * 2; out.height = h + m * 2 + Math.round(h * 0.12);
        g.fillStyle = '#f7ecd6'; g.fillRect(0, 0, out.width, out.height);
        g.drawImage(shot, m, m);
        g.strokeStyle = 'rgba(74,52,40,0.25)'; g.lineWidth = 2; g.strokeRect(m, m, w, h);
        const by = h + m * 2, bh = out.height - by;
        g.fillStyle = '#4a3428';
        const s = fitText(g, meta.caption || meta.room || 'Greetings from my room', w * 0.62, Math.round(bh * 0.42), 700);
        g.textBaseline = 'middle';
        g.fillText(meta.caption || meta.room || 'Greetings from my room', m, by + bh * 0.42);
        g.font = `400 ${Math.round(s * 0.5)}px ${HAND}`;
        g.fillStyle = '#8a6f5c';
        g.fillText(`${meta.room || ''}${meta.date ? ' · ' + meta.date : ''}`, m, by + bh * 0.78);
        // a stamp
        const sw = bh * 0.8, sx = out.width - m - sw, sy = by + bh * 0.1;
        g.fillStyle = '#e8553f'; g.fillRect(sx, sy, sw, sw);
        g.fillStyle = '#fff7ea'; g.fillRect(sx + sw * 0.08, sy + sw * 0.08, sw * 0.84, sw * 0.84);
        g.fillStyle = '#e8553f';
        g.font = `700 ${Math.round(sw * 0.2)}px ${HAND}`; g.textAlign = 'center';
        g.fillText('Pinch', sx + sw / 2, sy + sw * 0.36); g.fillText('& Place', sx + sw / 2, sy + sw * 0.62);
        if (meta.stars != null) stars(g, meta.stars, sx + sw * 0.22, sy + sw * 0.82, sw * 0.07);
        g.textAlign = 'left';
        return out;
    }
    // instant photo: white border, a deep bottom with a hand-written caption
    const m = Math.round(w * 0.045);
    out.width = w + m * 2; out.height = h + m + Math.round(h * 0.2);
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(shot, m, m);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(m, m, w, 3);
    const by = h + m, bh = out.height - by;
    g.fillStyle = '#3d3a6b';
    g.textBaseline = 'middle';
    const cap = meta.caption || meta.room || '';
    fitText(g, cap, w * (meta.stars != null ? 0.7 : 0.94), Math.round(bh * 0.4), 600);
    g.fillText(cap, m + 4, by + bh * 0.42);
    g.font = `400 ${Math.round(bh * 0.18)}px ${HAND}`;
    g.fillStyle = '#8a8aa0';
    g.fillText(meta.date || '', m + 4, by + bh * 0.76);
    if (meta.stars != null) stars(g, meta.stars, out.width - m - bh * 0.95, by + bh * 0.42, bh * 0.14);
    return out;
}

const toBlob = (c, type = 'image/png', q) => new Promise((res) => c.toBlob((b) => res(b), type, q));

export async function download(canvas, name) {
    const b = await toBlob(canvas);
    if (!b) return false;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
}

/** The system share sheet with the picture (and the link). Returns 'shared', 'cancelled' or 'unsupported'. */
export async function share(canvas, { title, text, url, name }) {
    try {
        const b = await toBlob(canvas);
        const file = b && new File([b], name, { type: 'image/png' });
        if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title, text: `${text} ${url}` }); return 'shared'; }
        if (navigator.share) { await navigator.share({ title, text, url }); return 'shared'; }
    } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
    return 'unsupported';
}

export async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch { return false; }
}

/** A small JPEG of a framed photo for the album (localStorage holds a few MB at most). */
export function thumb(canvas, width = 560) {
    const k = width / canvas.width;
    const c = document.createElement('canvas');
    c.width = width; c.height = Math.round(canvas.height * k);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
}
