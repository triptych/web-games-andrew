/**
 * emoji.js — Draw emoji as sprites instead of Kaplay text.
 *
 * Kaplay's text atlas places every glyph using the ascent of the ASCII
 * characters. Colour emoji (e.g. Noto Color Emoji on Android) rise above that
 * line, so the top of each emoji gets sliced off — very visible on the round
 * top of 🥚. Here the browser draws each emoji onto its own padded canvas,
 * which is then loaded as a sprite, so nothing is cropped.
 *
 * Usage (drop-in for k.text on emoji-only labels):
 *   const label = k.add([k.pos(x, y), emoji(k, '🥚', { size: 96 }), k.anchor('center')]);
 *   label.text = '🐣';
 */

const RENDER_SIZE = 128;   // px the emoji is rasterised at before scaling
const PAD         = 4;     // px of breathing room around the glyph's bounds
const FONT        = `${RENDER_SIZE}px sans-serif`;

const _cache = new Map();  // text → { name, w, h } (w/h relative to font size)

function _rasterise(k, text) {
    let entry = _cache.get(text);
    if (entry) return entry;

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    ctx.font = FONT;
    const m = ctx.measureText(text);
    const left    = Math.ceil(m.actualBoundingBoxLeft);
    const right   = Math.ceil(m.actualBoundingBoxRight);
    const ascent  = Math.ceil(m.actualBoundingBoxAscent);
    const descent = Math.ceil(m.actualBoundingBoxDescent);

    canvas.width  = Math.max(1, left + right + PAD * 2);
    canvas.height = Math.max(1, ascent + descent + PAD * 2);
    ctx.font      = FONT;   // resizing the canvas resets context state
    ctx.fillStyle = '#fff'; // white so a color component can tint non-emoji glyphs
    ctx.fillText(text, PAD + left, PAD + ascent);

    entry = {
        name: `emoji:${text}`,
        w:    canvas.width  / RENDER_SIZE,
        h:    canvas.height / RENDER_SIZE,
    };
    k.loadSprite(entry.name, canvas);
    _cache.set(text, entry);
    return entry;
}

/**
 * Component that renders `text` (emoji, optionally with spaces/arrows) at
 * roughly the same visual size k.text would at `size`. Respects anchor,
 * opacity and color components. Set `.text` to change it.
 */
export function emoji(k, text, opt = {}) {
    let _text = text ?? '';
    return {
        id:   'emoji',
        size: opt.size ?? 36,
        get text() { return _text; },
        set text(v) { _text = v ?? ''; },
        draw() {
            if (!_text) return;
            const g = _rasterise(k, _text);
            k.drawSprite({
                sprite:  g.name,
                width:   g.w * this.size,
                height:  g.h * this.size,
                anchor:  this.anchor ?? 'topleft',
                opacity: this.opacity ?? 1,
                color:   this.color,
            });
        },
    };
}
