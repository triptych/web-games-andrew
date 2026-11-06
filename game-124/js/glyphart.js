// Drawing a glyph from its strokes, onto any 2D canvas. Shared by the book, the HUD and the view
// (which turns the drawings into textures for carvings and seals). Shape glyphs wear a ring.

const ANCHOR = (i) => [(i % 3) - 1, Math.floor(i / 3) - 1];

/**
 * draw(ctx, glyph, cx, cy, size, opts)
 * glyph = { strokes, kind }; opts = { color, width, glow, ring (default: kind === 'shape') }
 */
export function drawGlyph(ctx, glyph, cx, cy, size, opts = {}) {
    const color = opts.color || '#2a1d10';
    const s = size * (glyph.kind === 'shape' ? 0.27 : 0.34);
    const w = opts.width || Math.max(1.5, size * 0.065);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = w;
    if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = size * 0.12; }
    for (const st of glyph.strokes) {
        ctx.beginPath();
        if (st[0] === 'line') {
            const [ax, ay] = ANCHOR(st[1]), [bx, by] = ANCHOR(st[2]);
            ctx.moveTo(ax * s, ay * s);
            // a slight bow, so the marks look carved by hand rather than ruled
            const mx = (ax + bx) / 2 * s, my = (ay + by) / 2 * s;
            const nx = -(by - ay) * s * 0.06, ny = (bx - ax) * s * 0.06;
            ctx.quadraticCurveTo(mx + nx, my + ny, bx * s, by * s);
            ctx.stroke();
        } else if (st[0] === 'arc') {
            const [ax, ay] = ANCHOR(st[1]);
            const a0 = st[3] * Math.PI / 2;
            ctx.arc(ax * s, ay * s, st[2] * s, a0, a0 + st[4] * Math.PI / 2);
            ctx.stroke();
        } else if (st[0] === 'dot') {
            const [ax, ay] = ANCHOR(st[1]);
            ctx.arc(ax * s, ay * s, w * 0.95, 0, Math.PI * 2);
            ctx.fill();
        } else if (st[0] === 'ring') {
            const [ax, ay] = ANCHOR(st[1]);
            ctx.arc(ax * s, ay * s, st[2] * s, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    if (opts.ring ?? glyph.kind === 'shape') {
        ctx.lineWidth = w * 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2);
        ctx.stroke();
        // four small ticks on the ring, like a compass rose
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * size * 0.40, Math.sin(a) * size * 0.40);
            ctx.lineTo(Math.cos(a) * size * 0.48, Math.sin(a) * size * 0.48);
            ctx.stroke();
        }
    }
    ctx.restore();
}

/** A data URL of a glyph, for <img> tags in the book. Cached. */
const cache = new Map();
export function glyphURL(glyph, size = 96, color = '#2a1d10', glow = null) {
    const key = glyph.id + size + color + glow;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    drawGlyph(c.getContext('2d'), glyph, size / 2, size / 2, size * 0.92, { color, glow });
    const url = c.toDataURL();
    cache.set(key, url);
    return url;
}

// Small icons for the six essences and three forms, once the notebook knows them.
export const ESSENCE_ICON = {
    kindle: 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 2 2 3 3 3 0-3-1-5 0-7z',
    rime: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2 3M12 2l2 3M12 22l-2-3M12 22l2-3',
    lumen: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
    bloom: 'M12 22V11M12 11c-5 0-8-3-8-8 5 0 8 3 8 8zM12 14c4 0 7-2 7-6-4 0-7 2-7 6z',
    gale: 'M3 8h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 18h7',
    still: 'M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10',
    unweave: 'M4 4l16 16M20 4L4 20M12 2v4M12 18v4',
};
export const FORM_ICON = {
    bolt: 'M3 12h14M13 7l5 5-5 5M3 9h6M3 15h6',
    ward: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
    seal: 'M3 19h18M6 19l6-9 6 9M12 4v6',
};
export const icon = (path, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
