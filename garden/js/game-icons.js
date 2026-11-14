// Each game's painted icon (game-NNN/icons/, made with fal; see dev/make-icons.py),
// for the canvases and panels of the Garden. Canvas textures are drawn once, so
// a texture drawn before an icon has loaded shows the game's emoji instead and
// is redrawn when iconsReady() resolves.
import { gameIcon } from '../../js/gamedata.js';

const cache = new Map();

/** The <img> for a game's icon, loading or loaded. size: 96, 192 or 512. */
export function iconImage(game, size = 96) {
    const key = `${game.folder}@${size}`;
    let img = cache.get(key);
    if (!img) {
        img = new Image();
        img.decoding = 'async';
        img.src = gameIcon(game, size);
        cache.set(key, img);
    }
    return img;
}

export const iconLoaded = (game, size = 96) => {
    const img = iconImage(game, size);
    return img.complete && img.naturalWidth > 0;
};

/** Resolves once every listed game's icon has loaded (or failed, which leaves the emoji). */
export function iconsReady(games, size = 96) {
    return Promise.all(games.map((g) => {
        const img = iconImage(g, size);
        if (img.complete) return null;
        return new Promise((done) => {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
        });
    }));
}

/**
 * Draws a game's icon centred on (cx, cy), d pixels across, clipped to a
 * circle ('circle') or a rounded square ('round'). Until it has loaded, the
 * game's emoji is drawn in its place. Returns true when the painting was drawn.
 */
export function drawGameIcon(ctx, game, cx, cy, d, { size = 96, shape = 'round' } = {}) {
    if (!iconLoaded(game, size)) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${d * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.fillText(game.icon || '🎮', cx, cy + d * 0.05);
        ctx.restore();
        return false;
    }
    const x = cx - d / 2, y = cy - d / 2;
    ctx.save();
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    else if (ctx.roundRect) ctx.roundRect(x, y, d, d, d * 0.22);
    else ctx.rect(x, y, d, d);
    ctx.clip();
    ctx.drawImage(iconImage(game, size), x, y, d, d);
    ctx.restore();
    return true;
}

/** HTML for a game's icon as an <img>, for panels and lists (styled by .game-icon-img). */
export function iconHTML(game, size = 96, cls = '') {
    return `<img class="game-icon-img${cls ? ' ' + cls : ''}" src="${gameIcon(game, size)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}
