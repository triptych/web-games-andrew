/**
 * ui.js — small DOM helpers shared by every screen: thumbnails, PNG export, toast, modal and
 * the dialogue player.
 */
import { hexToRgb, luma } from './pixelart.js';
import { ART_BY_ID, PORTRAITS } from './artworks.js';
import { SPEAKERS } from './story.js';

export const $ = (id) => document.getElementById(id);

export function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') n.className = v;
        else if (k === 'style') Object.assign(n.style, v);
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else if (k in n && typeof v !== 'string') n[k] = v;
        else n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid);
    return n;
}

/** How an unpainted pixel looks: a pale grey that keeps the picture's light and dark. */
export function greyOf(hex, lo = 170, span = 54) {
    const v = Math.round(lo + span * luma(hex));
    return [v - 3, v - 3, v + 4];
}

export function mix(hexA, rgbB, t) {
    const a = hexToRgb(hexA);
    return a.map((c, k) => Math.round(c * (1 - t) + rgbB[k] * t));
}

/**
 * Draw a mosaic into a canvas at one canvas pixel per art pixel.
 * cells: page progress (or null for the finished picture). grey: draw unpainted pixels as greys.
 */
export function drawArt(canvas, art, cells = null, { grey = 'light', freePalette = null } = {}) {
    canvas.width = art.w;
    canvas.height = art.h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(art.w, art.h);
    const rgb = art.palette.map((p) => hexToRgb(p.hex));
    const free = freePalette?.map(hexToRgb);
    for (let i = 0; i < art.total; i++) {
        const t = art.cells[i];
        let c;
        if (free) c = free[cells[i] - 1];
        else if (!cells || cells[i] === t + 1) c = rgb[t];
        else if (cells[i]) c = mix(art.palette[cells[i] - 1].hex, [190, 186, 205], 0.45);
        else c = grey === 'dark' ? greyOf(art.palette[t].hex, 60, 70) : greyOf(art.palette[t].hex);
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

/** A crisp, upscaled PNG blob of a finished mosaic (or a freestyle remix) with a soft border. */
export async function exportPng(art, freeCells = null, freePalette = null) {
    const k = Math.max(8, Math.floor(960 / Math.max(art.w, art.h)));
    const pad = Math.round(k * 1.5);
    const src = drawArt(document.createElement('canvas'), art, freeCells, { freePalette });
    const out = document.createElement('canvas');
    out.width = art.w * k + pad * 2;
    out.height = art.h * k + pad * 2 + Math.round(k * 1.6);
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#16132b';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, pad, pad, art.w * k, art.h * k);
    ctx.fillStyle = '#cbb2ff';
    ctx.font = `600 ${Math.round(k * 0.9)}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${art.title} · Colorverse`, out.width / 2, out.height - pad * 0.5 - k * 0.6);
    return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('export failed'))), 'image/png'));
}

/** Share a PNG with the Web Share API where it can take files, otherwise download it. */
export async function sharePng(blob, title) {
    const name = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title, text: `${title}, restored in Colorverse ✦` });
            return 'shared';
        } catch (e) {
            if (e.name === 'AbortError') return 'cancelled';
        }
    }
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
}

/* ───────────── toast ───────────── */

let toastTimer = 0;
export function toast(msg, ms = 2200) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ───────────── modal ───────────── */

let modalClose = null;
export function openModal(build, { onClose, dismissable = true } = {}) {
    const m = $('modal'), card = $('modal-card');
    card.replaceChildren();
    build(card);
    m.hidden = false;
    modalClose = () => { m.hidden = true; card.replaceChildren(); modalClose = null; onClose?.(); };
    m.onclick = (e) => { if (dismissable && e.target === m) closeModal(); };
    const first = card.querySelector('button.primary') ?? card.querySelector('button');
    first?.focus({ preventScroll: true, focusVisible: false });
}
export function closeModal() { modalClose?.(); }
export const modalOpen = () => !$('modal').hidden;

/* ───────────── dialogue ───────────── */

function drawPortrait(canvas, who, state) {
    const p = PORTRAITS[who];
    if (!p) return false;
    const art = ART_BY_ID[p.art];
    const colored = !!state.pages[p.colorAfter]?.done;
    const full = drawArt(document.createElement('canvas'), art, colored ? null : new Uint8Array(art.total), { grey: 'light' });
    canvas.width = p.size;
    canvas.height = p.size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, p.size, p.size);
    ctx.drawImage(full, p.x, p.y, p.size, p.size, 0, 0, p.size, p.size);
    return true;
}

/**
 * Play a scene: an array of [speaker, text]. Tap/click/Space/Enter shows the whole line or moves on.
 * Resolves when the scene is over (or skipped).
 */
export function playScene(lines, state, sound) {
    return new Promise((resolve) => {
        if (!lines?.length) { resolve(); return; }
        const root = $('dialogue'), box = root.querySelector('.dlg-box'), face = root.querySelector('.dlg-face');
        const nameEl = root.querySelector('.dlg-name'), textEl = root.querySelector('.dlg-text');
        let k = -1, typing = 0, full = '', shown = 0, done = false;
        const fast = new URLSearchParams(location.search).has('fasttext');

        const finish = () => {
            if (done) return;
            done = true;
            clearInterval(typing);
            root.hidden = true;
            root.removeEventListener('pointerup', onTap);
            document.removeEventListener('keydown', onKey, true);
            skip.removeEventListener('click', onSkip);
            resolve();
        };
        const next = () => {
            if (shown < full.length) { shown = full.length; textEl.textContent = full; clearInterval(typing); return; }
            k++;
            if (k >= lines.length) { finish(); return; }
            const [who, text] = lines[k];
            const sp = SPEAKERS[who];
            box.classList.toggle('narration', !sp);
            box.classList.toggle('hush', who === 'hush');
            box.style.setProperty('--who', sp?.color ?? '#b6acd8');
            nameEl.textContent = sp?.name ?? '';
            nameEl.hidden = !sp;
            face.hidden = !sp || !drawPortrait(face, who, state);
            full = text; shown = 0; textEl.textContent = '';
            sound?.page();
            clearInterval(typing);
            if (fast) { shown = full.length; textEl.textContent = full; return; }
            typing = setInterval(() => {
                shown = Math.min(full.length, shown + 2);
                textEl.textContent = full.slice(0, shown);
                if (shown >= full.length) clearInterval(typing);
            }, 28);
        };
        const onTap = (e) => { if (e.target.closest('.dlg-skip')) return; next(); };
        const onKey = (e) => {
            if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); next(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
        };
        const skip = root.querySelector('.dlg-skip');
        const onSkip = (e) => { e.stopPropagation(); finish(); };
        root.hidden = false;
        root.addEventListener('pointerup', onTap);
        document.addEventListener('keydown', onKey, true);
        skip.addEventListener('click', onSkip);
        next();
    });
}

export const dialogueOpen = () => !$('dialogue').hidden;
