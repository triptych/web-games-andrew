/**
 * npcs.js — the cast, drawn directly into the frame each tick.
 *
 * Every character is a handful of rectangles in palette colours, so they stay
 * crisp without a quantize pass and can animate cheaply: breathing, blinking,
 * a rocking chair, a wagging tail. `talk` is true while that character's line
 * is on screen, and opens and shuts their mouth.
 */

function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

const blink = (t, seed = 0) => ((t + seed) % 4.3) < 0.13;
const mouth = (t, talk) => talk && Math.floor(t * 9) % 2 === 0;

/** Gran Mab in her rocking chair. (x, y) = floor under the chair's centre. */
export function mab(g, x, y, t, talk = false) {
    const rock = Math.sin(t * 1.6) * 1.2;
    const ox = x + rock, oy = y;
    // rockers
    px(g, x - 14, oy - 1, 28, 2, '#3a2418');
    px(g, x - 15 + rock, oy - 2, 2, 1, '#3a2418');
    // chair back
    px(g, ox + 6, oy - 34, 3, 32, '#6b4226');
    px(g, ox + 6, oy - 34, 3, 2, '#a0703c');
    for (let i = 0; i < 3; i++) px(g, ox + 5, oy - 30 + i * 7, 1, 4, '#3a2418');
    // seat + legs
    px(g, ox - 9, oy - 14, 17, 3, '#6b4226');
    px(g, ox - 8, oy - 11, 2, 10, '#3a2418');
    px(g, ox + 5, oy - 11, 2, 10, '#3a2418');
    // skirt over knees, feet
    px(g, ox - 12, oy - 18, 16, 6, '#4a2f5a');
    px(g, ox - 12, oy - 12, 5, 9, '#4a2f5a');
    px(g, ox - 13, oy - 3, 5, 2, '#1c2029');
    // body + shawl
    px(g, ox - 5, oy - 30, 10, 14, '#4a2f5a');
    px(g, ox - 6, oy - 30, 12, 7, '#7d4a78');
    px(g, ox - 7, oy - 25, 3, 5, '#7d4a78');
    px(g, ox - 3, oy - 24, 2, 4, '#c86f8f');
    // hands in lap, holding the empty book
    px(g, ox - 11, oy - 20, 7, 4, '#b8332f');
    px(g, ox - 11, oy - 20, 2, 2, '#e8b89a');
    // head (facing left, towards the room)
    px(g, ox - 5, oy - 39, 8, 9, '#e8b89a');
    px(g, ox - 6, oy - 35, 1, 2, '#e8b89a');
    px(g, ox - 2, oy - 41, 7, 5, '#c3c7d0');
    px(g, ox + 2, oy - 43, 5, 4, '#ffffff');          // bun
    px(g, ox + 1, oy - 39, 3, 6, '#c3c7d0');
    if (!blink(t, 1)) px(g, ox - 4, oy - 36, 1, 1, '#1b1f3b');
    px(g, ox - 5, oy - 33, 2, mouth(t, talk) ? 2 : 1, '#6e1f24');
    // spectacles glint
    px(g, ox - 5, oy - 37, 3, 1, '#a8c8e8');
}

/** Pell, sitting cross-legged with her rag doll. (x, y) = ground. */
export function pell(g, x, y, t, talk = false, happy = false) {
    const b = Math.sin(t * 2) > 0.9 ? 1 : 0;
    px(g, x - 8, y - 5, 16, 5, '#c86f8f');            // skirt/legs
    px(g, x - 9, y - 2, 4, 2, '#3a2418');
    px(g, x + 5, y - 2, 4, 2, '#3a2418');
    px(g, x - 5, y - 16 + b, 10, 12, '#c86f8f');     // dress
    px(g, x - 5, y - 16 + b, 10, 2, '#f4ecd8');
    px(g, x - 4, y - 24 + b, 8, 8, '#e8b89a');       // face
    px(g, x - 5, y - 26 + b, 10, 4, '#6b4226');      // hair
    px(g, x - 7, y - 23 + b, 2, 6, '#6b4226');       // pigtails
    px(g, x + 5, y - 23 + b, 2, 6, '#6b4226');
    px(g, x - 7, y - 18 + b, 2, 1, '#b8332f');
    px(g, x + 5, y - 18 + b, 2, 1, '#b8332f');
    if (!blink(t, 2.2)) { px(g, x - 2, y - 21 + b, 1, 1, '#1b1f3b'); px(g, x + 1, y - 21 + b, 1, 1, '#1b1f3b'); }
    if (happy) px(g, x - 1, y - 18 + b, 3, 1, '#6e1f24');
    else px(g, x - 1, y - 18 + b, 2, mouth(t, talk) ? 2 : 1, '#6e1f24');
    // rag doll in lap
    px(g, x + 3, y - 11, 5, 6, '#f0a878');
    px(g, x + 4, y - 14, 3, 3, '#f4ecd8');
    px(g, x + 4, y - 15, 3, 1, '#f4c542');
    px(g, x + 4, y - 16, 1, 1, '#f4c542'); px(g, x + 6, y - 16, 1, 1, '#f4c542');
}

/** Gubbins the bridge troll, standing. (x, y) = feet. */
export function gubbins(g, x, y, t, talk = false, sitting = false, munch = false) {
    const br = Math.round(Math.sin(t * 1.3));
    const Y = sitting ? y + 10 : y;
    // legs
    if (!sitting) {
        px(g, x - 10, Y - 14, 7, 14, '#255b33');
        px(g, x + 3, Y - 14, 7, 14, '#255b33');
        px(g, x - 12, Y - 3, 10, 3, '#3f8a3a');
        px(g, x + 2, Y - 3, 10, 3, '#3f8a3a');
    } else {
        px(g, x - 16, Y - 12, 14, 6, '#255b33');
        px(g, x + 2, Y - 12, 14, 6, '#255b33');
        px(g, x - 19, Y - 9, 5, 4, '#3f8a3a');
        px(g, x + 14, Y - 9, 5, 4, '#3f8a3a');
    }
    // body: patched sack tunic
    px(g, x - 15, Y - 42 + br, 30, 30, '#6b4226');
    px(g, x - 15, Y - 42 + br, 30, 4, '#3a2418');
    px(g, x - 6, Y - 30 + br, 7, 6, '#a0703c');       // patch
    px(g, x + 6, Y - 22 + br, 5, 5, '#2b3a67');       // patch
    px(g, x - 15, Y - 16 + br, 30, 3, '#3a2418');
    // arms
    px(g, x - 21, Y - 40 + br, 7, 22, '#3f8a3a');
    px(g, x + 14, Y - 40 + br, 7, 22, '#3f8a3a');
    px(g, x - 22, Y - 19 + br, 9, 6, '#255b33');
    px(g, x + 13, Y - 19 + br, 9, 6, '#255b33');
    if (munch) px(g, x - 6, Y - 42 + br, 10, 6, '#f4c542');
    // head
    px(g, x - 11, Y - 60 + br, 22, 20, '#3f8a3a');
    px(g, x - 13, Y - 54 + br, 2, 6, '#3f8a3a');      // ears
    px(g, x + 11, Y - 54 + br, 2, 6, '#3f8a3a');
    px(g, x - 11, Y - 62 + br, 22, 4, '#255b33');     // brow ridge / moss
    px(g, x - 7, Y - 64 + br, 3, 2, '#74b94a');
    px(g, x + 3, Y - 65 + br, 4, 3, '#74b94a');
    if (!blink(t, 0.5)) {
        px(g, x - 7, Y - 55 + br, 3, 2, '#f4c542');
        px(g, x + 4, Y - 55 + br, 3, 2, '#f4c542');
        px(g, x - 6, Y - 55 + br, 1, 1, '#0d0b14');
        px(g, x + 5, Y - 55 + br, 1, 1, '#0d0b14');
    }
    px(g, x - 3, Y - 53 + br, 6, 7, '#74b94a');       // nose
    px(g, x - 2, Y - 47 + br, 5, 1, '#255b33');
    const open = mouth(t, talk) || (munch && Math.floor(t * 6) % 2 === 0);
    px(g, x - 7, Y - 44 + br, 14, open ? 3 : 1, '#16301f');
    px(g, x - 6, Y - 45 + br, 2, 2, '#f4ecd8');       // tusks
    px(g, x + 4, Y - 45 + br, 2, 2, '#f4ecd8');
}

/** Filled pixel ellipse, row by row — hard edges, no anti-aliasing. */
function ell(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (let yy = -ry; yy <= ry; yy++) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))));
        g.fillRect(Math.round(cx - half), Math.round(cy + yy), half * 2 + 1, 1);
    }
}

/** Tatters the magpie, perched. (x, y) = feet on branch. */
export function tatters(g, x, y, t, talk = false) {
    const hop = Math.floor(t * 0.8) % 5 === 0 ? -1 : 0;
    const look = Math.floor(t * 0.6) % 3 === 1;
    const Y = y + hop;
    // long tail with a blue-green sheen
    px(g, x - 17, Y - 7, 12, 3, '#1b1f3b');
    px(g, x - 19, Y - 6, 4, 2, '#1e4a50');
    px(g, x - 15, Y - 7, 8, 1, '#2f8a8a');
    // moonlit rim, so a black bird reads against a night sky
    ell(g, x - 1, Y - 9, 8, 5, '#8a90a0');
    ell(g, x + 6, Y - 15, 4, 4, '#8a90a0');
    // body
    ell(g, x - 1, Y - 8, 7, 4, '#0d0b14');
    ell(g, x + 1, Y - 6, 4, 2, '#ffffff');           // white belly
    px(g, x - 6, Y - 10, 6, 2, '#ffffff');           // white shoulder patch
    px(g, x - 7, Y - 8, 6, 1, '#3f5f9a');            // wing sheen
    // head
    ell(g, x + 6, Y - 14, 3, 3, '#0d0b14');
    const bx = look ? x + 3 : x + 9;
    px(g, bx, Y - 14, 3, 1, '#2e3440');              // beak
    if (mouth(t, talk)) px(g, bx, Y - 13, 2, 1, '#2e3440');
    px(g, look ? x + 5 : x + 7, Y - 15, 1, 1, '#f4c542');   // bright eye
    // feet
    px(g, x - 1, Y - 3, 1, 3, '#2e3440');
    px(g, x + 2, Y - 3, 1, 3, '#2e3440');
}

/** Old Wenna knitting in her chair. (x, y) = floor. */
export function wenna(g, x, y, t, talk = false) {
    const k = Math.floor(t * 4) % 2;
    // chair
    px(g, x + 5, y - 36, 4, 34, '#3a2418');
    px(g, x - 10, y - 15, 18, 3, '#6b4226');
    px(g, x - 9, y - 12, 2, 12, '#3a2418');
    px(g, x + 5, y - 12, 2, 12, '#3a2418');
    // skirt
    px(g, x - 13, y - 18, 17, 7, '#255b33');
    px(g, x - 13, y - 12, 6, 10, '#255b33');
    px(g, x - 14, y - 3, 6, 2, '#1c2029');
    // body, shawl
    px(g, x - 6, y - 32, 11, 15, '#3f8a3a');
    px(g, x - 7, y - 32, 13, 6, '#b6d97a');
    // knitting: needles + a growing red scarf
    px(g, x - 14, y - 22, 9, 4, '#b8332f');
    px(g, x - 15, y - 26 + k, 1, 7, '#c3c7d0');
    px(g, x - 9, y - 26 - k, 1, 7, '#c3c7d0');
    px(g, x - 12, y - 18, 3, 6, '#b8332f');
    px(g, x - 12, y - 23, 2, 2, '#e8b89a');
    px(g, x - 8, y - 23, 2, 2, '#e8b89a');
    // head
    px(g, x - 6, y - 41, 9, 9, '#e8b89a');
    px(g, x - 7, y - 37, 1, 2, '#e8b89a');
    px(g, x - 5, y - 44, 10, 5, '#ffffff');
    px(g, x + 1, y - 40, 3, 7, '#ffffff');
    px(g, x - 7, y - 45, 12, 2, '#6b4226');           // headscarf band
    if (!blink(t, 3)) px(g, x - 5, y - 38, 1, 1, '#1b1f3b');
    px(g, x - 6, y - 34, 3, mouth(t, talk) ? 2 : 1, '#6e1f24');
}

/** Graniteface's eyes and mouth — drawn over the painted door. (x, y) = mouth centre. */
export function graniteface(g, x, y, t, talk = false, open = false) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    const eye = open ? '#f4c542' : pulse > 0.5 ? '#6fc7c0' : '#2f8a8a';
    if (!(blink(t, 1.7) && !talk)) {
        px(g, x - 16, y - 26, 6, 4, eye);
        px(g, x + 10, y - 26, 6, 4, eye);
        px(g, x - 14, y - 25, 2, 2, '#ffffff');
        px(g, x + 12, y - 25, 2, 2, '#ffffff');
    } else {
        px(g, x - 16, y - 24, 6, 1, '#2e3440');
        px(g, x + 10, y - 24, 6, 1, '#2e3440');
    }
    const m = talk ? (Math.floor(t * 7) % 3) * 2 : 0;
    px(g, x - 12, y - 2 - m / 2, 24, 3 + m, '#0d0b14');
    if (m) px(g, x - 10, y - 1 - m / 2 + 1, 20, 1, '#6e1f24');
}

/** Brimble, the warlock's hound — enormous, delighted, lying down facing left. (x, y) = floor under his chest. */
export function brimble(g, x, y, t, asleep = false, talk = false) {
    const c = '#8a90a0', d = '#555c6a', l = '#c3c7d0', k = '#0d0b14';
    const breathe = asleep ? Math.round(Math.sin(t * 1.2)) : Math.round(Math.sin(t * 3) * 0.6);
    // tail: curled and still when asleep, a blur of wagging when not
    if (asleep) {
        px(g, x + 44, y - 8, 12, 4, c);
        px(g, x + 54, y - 10, 4, 4, l);
    } else {
        const w = Math.round(Math.sin(t * 14) * 5);
        px(g, x + 42, y - 18, 5, 6, c);
        px(g, x + 45 + w * 0.4, y - 26, 4, 9, c);
        px(g, x + 47 + w, y - 34, 4, 9, l);
    }
    // hind haunch and paw
    ell(g, x + 32, y - 11 - breathe, 12, 10, d);
    px(g, x + 22, y - 4, 20, 4, d);
    px(g, x + 18, y - 3, 7, 3, l);
    // the body: a big shaggy loaf
    ell(g, x + 14, y - 13 - breathe, 26, 12 + breathe, c);
    for (let i = 0; i < 12; i++) px(g, x - 8 + i * 4, y - 25 - breathe + (i % 2) - Math.round(Math.sin(i) * 1), 3, 3, c);  // shaggy back
    for (let i = 0; i < 10; i++) px(g, x - 4 + i * 5, y - 20 - breathe + (i % 3), 2, 4, d);       // fur tufts
    ell(g, x + 14, y - 5, 22, 3, d);                // belly shadow
    // forelegs stretched forward
    px(g, x - 30, y - 6, 26, 5, c);
    px(g, x - 30, y - 2, 26, 2, d);
    px(g, x - 34, y - 5, 6, 5, l);
    px(g, x - 27, y - 2, 3, 2, k); px(g, x - 31, y - 1, 1, 1, k);
    // head: long wolfhound skull, beard, floppy ear
    const hy = asleep ? y - 16 : y - 32 + Math.round(Math.sin(t * 5) * 0.8);
    const hx = asleep ? x - 22 : x - 20;
    ell(g, hx + 4, hy + 6, 10, 9, c);                // skull
    px(g, hx - 16, hy + 5, 16, 9, c);               // muzzle
    px(g, hx - 16, hy + 5, 16, 2, l);
    px(g, hx - 18, hy + 5, 4, 4, k);                // nose
    px(g, hx - 16, hy + 13, 18, 4, l);              // shaggy beard
    for (let i = 0; i < 6; i++) px(g, hx - 15 + i * 3, hy + 16 + (i % 2), 2, 2, l);
    px(g, hx - 2, hy - 2, 8, 4, l);                 // wiry brows
    ell(g, hx + 10, hy + 7, 4, 8, d);                // floppy ear
    px(g, hx + 8, hy + 14, 5, 2, d);
    if (asleep) {
        px(g, hx - 2, hy + 4, 5, 1, k);
        const z = (t * 0.7) % 1;
        const zx = hx - 12 - z * 8, zy = hy - 10 - z * 16;
        if (z < 0.85) {
            px(g, zx, zy, 4, 1, '#a8c8e8'); px(g, zx + 2, zy + 1, 1, 1, '#a8c8e8');
            px(g, zx + 1, zy + 2, 1, 1, '#a8c8e8'); px(g, zx, zy + 3, 4, 1, '#a8c8e8');
        }
    } else {
        px(g, hx - 2, hy + 2, 3, 3, k);
        px(g, hx - 1, hy + 2, 1, 1, '#ffffff');
        // open, happy mouth and tongue
        const tongue = talk ? 6 : 3 + Math.round(Math.abs(Math.sin(t * 6)) * 2);
        px(g, hx - 15, hy + 12, 12, 2, k);
        px(g, hx - 11, hy + 13, 4, tongue, '#c86f8f');
    }
    // collar and tag
    px(g, hx + 3, hy + 14, 10, 3, '#b8332f');
    px(g, hx + 6, hy + 17, 3, 3, '#f4c542');
}

/** Elsie asleep (or awake, sitting up) in her bed. (x, y) = pillow. */
export function elsie(g, x, y, t, awake = false, talk = false) {
    if (!awake) {
        const br = Math.sin(t * 1.1) * 0.8;
        px(g, x - 4, y - 7, 11, 9, '#e8b89a');
        px(g, x - 6, y - 9, 15, 5, '#f4c542');
        px(g, x - 8, y - 5, 4, 10, '#f4c542');
        px(g, x + 7, y - 5, 3, 8, '#f4c542');
        px(g, x - 1, y - 3, 2, 1, '#b07a5a');
        px(g, x + 3, y - 3, 2, 1, '#b07a5a');
        px(g, x + 1, y, 2, 1, '#c86f8f');
        // quilt rises and falls
        px(g, x - 10, y + 3 - br, 16, 2, '#f4ecd8');
        return;
    }
    // sitting up
    px(g, x - 5, y - 20, 12, 16, '#f4ecd8');          // nightgown
    px(g, x - 4, y - 30, 10, 10, '#e8b89a');
    px(g, x - 6, y - 32, 14, 5, '#f4c542');
    px(g, x - 7, y - 28, 3, 12, '#f4c542');
    px(g, x + 6, y - 28, 3, 12, '#f4c542');
    if (!blink(t, 0.3)) { px(g, x - 2, y - 26, 1, 1, '#1b1f3b'); px(g, x + 3, y - 26, 1, 1, '#1b1f3b'); }
    px(g, x, y - 23, 2, mouth(t, talk) ? 2 : 1, '#6e1f24');
    px(g, x - 3, y - 24, 1, 1, '#c86f8f'); px(g, x + 5, y - 24, 1, 1, '#c86f8f');
}

/** Corvin Hale, the Warlock. (x, y) = feet. `face` 'left' or 'right'. */
export function corvin(g, x, y, t, talk = false, face = 'left', kneel = false) {
    const f = face === 'left' ? -1 : 1;
    const sway = Math.round(Math.sin(t * 0.9) * 0.6);
    const Y = kneel ? y + 12 : y;
    // coat (long, dark blue, stitched with stars)
    if (!kneel) {
        px(g, x - 8, Y - 32, 16, 32, '#1b1f3b');
        px(g, x - 9, Y - 6, 18, 6, '#1b1f3b');
        px(g, x - 5, Y - 2, 4, 2, '#0d0b14');
        px(g, x + 1, Y - 2, 4, 2, '#0d0b14');
    } else {
        px(g, x - 10, Y - 26, 20, 18, '#1b1f3b');
        px(g, x - 12, Y - 10, 24, 6, '#1b1f3b');
    }
    px(g, x - 7, Y - 44, 14, 14, '#2b3a67');
    px(g, x - 2 * f - 1, Y - 44, 3, 40 - (kneel ? 14 : 0), '#1b1f3b');
    const stars = [[-5, 38], [4, 30], [-3, 20], [5, 14], [-6, 8], [2, 40]];
    for (const [sx, sy] of stars) if (sy < 44 - (kneel ? 16 : 0)) px(g, x + sx, Y - sy, 1, 1, '#f4c542');
    // arm reaching toward the loom (or hanging)
    px(g, x + f * 6, Y - 42, 4, 16, '#2b3a67');
    px(g, x + f * 6, Y - 27, 4, 3, '#e8b89a');
    // head
    const hx = x + f * 1;
    px(g, hx - 5, Y - 55 + sway, 10, 11, '#e8b89a');
    px(g, hx - 6, Y - 58 + sway, 12, 5, '#8a90a0');
    px(g, hx - f * 6 - (f > 0 ? 0 : -1), Y - 55 + sway, 2, 9, '#8a90a0');
    px(g, hx - 5, Y - 47 + sway, 10, 5, '#c3c7d0');   // beard
    px(g, hx - 3, Y - 43 + sway, 6, 3, '#c3c7d0');
    if (!blink(t, 2.6)) px(g, hx + f * 2, Y - 52 + sway, 1, 1, '#1b1f3b');
    px(g, hx + f * 2 - 1, Y - 48 + sway, 3, mouth(t, talk) ? 2 : 1, '#6e1f24');
    px(g, hx + f * 4, Y - 51 + sway, 1, 2, '#b07a5a'); // nose
}

/** Button the cat, asleep on the rug. */
export function cat(g, x, y, t) {
    const br = Math.round(Math.sin(t * 1.5) * 0.6);
    px(g, x - 8, y - 6 - br, 14, 6 + br, '#e0782c');
    px(g, x - 8, y - 6 - br, 14, 2, '#f0a878');
    px(g, x + 4, y - 8, 6, 6, '#e0782c');
    px(g, x + 4, y - 10, 2, 2, '#e0782c');
    px(g, x + 8, y - 10, 2, 2, '#e0782c');
    px(g, x + 6, y - 5, 2, 1, '#3a2418');
    px(g, x - 11, y - 3, 6, 2, '#e0782c');
    px(g, x - 3, y - 4 - br, 2, 3, '#a0703c');
}
