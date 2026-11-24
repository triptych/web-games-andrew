// The Lounge: a little JRPG bar inside the handheld. You are the bartender;
// the characters of the games you have played (or have a save in) drop by,
// wander about on eight-way walking sprites, sit at the tables, chat, and
// come up to the bar to order. Walk over (arrow keys or WASD, a tap on the
// floor, or turn the wheel to pick someone and press ●), take the order in a
// dialog box, then make it: pick the ingredients off the shelf in order and
// stop the needle in the sweet spot. Serving someone grows your friendship
// hearts with them (the same hearts as Messages), more for their favourite,
// more again when they asked for it in Messages. A while later they text you
// to say thanks, and now and then a friend texts to ask for something and
// the message has a button that brings you here with them at the bar.
//
// The walking sprites are painted with ElevenLabs (dev/sprite-style.json)
// and live with their games: game-NNN/avatar/sprite.png, five facings (S,
// SE, E, NE, N; the left-facing ones are mirrored) by three walk frames. The
// room, its furniture and the bubbles are drawn here, a pixel at a time.
// What the Lounge remembers is in ./lounge-data.js.

import { View } from './views.js';
import { sfx } from './sound.js';
import { esc, clamp } from './util.js';
import { currentMem } from './pet.js';
import { sprite as dfSprite, icon as pxIcon, lookOf, W as DFW, H as DFH } from './pixel-dragonfly.js';
import {
    MENU, INGREDIENTS, itemOf, ingredientOf, favOf, itemWords, loungeState, updateLounge, pendingOrder,
    ORDER_LINES, SERVED_LINES, FAV_LINES, HANG_LINES, ASK_DONE,
} from './lounge-data.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const GARDEN = 'garden';

// ---------------------------------------------------------------- the room

const T = 16;
/**
 * W wall · b behind the bar (only the bartender walks there) · # counter · s stool ·
 * c chair · T table · F sofa · P plant · J jukebox · D the door · . floor
 */
const MAP = [
    'WWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWW',
    'bbbbbbb.......J',
    '#######.......P',
    '.s.s.s.........',
    '...............',
    '.cTc.....cTc...',
    '...............',
    'P...cTc....FFF.',
    '...............',
    '.......D.......',
];
const COLS = MAP[0].length;
const ROWS = MAP.length;
const RW = COLS * T;
const RH = ROWS * T;
const at = (x, y) => (y >= 0 && y < ROWS && x >= 0 && x < COLS ? MAP[y][x] : 'W');
const DOOR = { x: 7, y: 10 };
const MAX_GUESTS = 6;

/** Where people sit: stools face the bar, chairs face their table, the sofa faces the room. */
const SEATS = [];
for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
        const c = at(x, y);
        if (c === 's') SEATS.push({ x, y, face: 'n', bar: true });
        else if (c === 'c') SEATS.push({ x, y, face: at(x + 1, y) === 'T' ? 'e' : 'w' });
        else if (c === 'F') SEATS.push({ x, y, face: 's', sofa: true });
    }
}

const cx = (tx) => tx * T + T / 2;
const fy = (ty) => ty * T + 12;
const tileOf = (px, py) => ({ x: Math.floor(px / T), y: Math.floor((py - 2) / T) });

// sprites: 32×40 cells, rows S, SE, E, NE, N; the west-facing ones are mirrored
const CW = 32;
const CH = 40;
const ROW = { s: 0, se: 1, e: 2, ne: 3, n: 4, sw: 1, w: 2, nw: 3 };
const FLIP = { sw: 1, w: 1, nw: 1 };
const DIR8 = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
function dirOf(dx, dy) {
    if (!dx && !dy) return null;
    const a = Math.atan2(dy, dx);
    return DIR8[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
const VEC = { e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1], n: [0, -1], ne: [1, -1] };

/** Who can stand on a tile: the bartender anywhere on the floor and behind the bar, guests on the floor. */
const walkable = (x, y, who) => {
    const c = at(x, y);
    return c === '.' || c === 'D' || (who === 'me' && c === 'b');
};

/** Eight-way shortest path over tiles (no cutting corners); `goal` itself may be a seat. */
function findPath(from, goal, who) {
    if (from.x === goal.x && from.y === goal.y) return [];
    const key = (x, y) => y * COLS + x;
    const prev = new Map([[key(from.x, from.y), null]]);
    const q = [from];
    const ok = (x, y) => (x === goal.x && y === goal.y) || walkable(x, y, who);
    while (q.length) {
        const n = q.shift();
        if (n.x === goal.x && n.y === goal.y) break;
        for (const [dx, dy] of Object.values(VEC)) {
            const x = n.x + dx, y = n.y + dy;
            if (!ok(x, y) || prev.has(key(x, y))) continue;
            if (dx && dy && (!walkable(n.x + dx, n.y, who) || !walkable(n.x, n.y + dy, who))) continue;
            prev.set(key(x, y), n);
            q.push({ x, y });
        }
    }
    if (!prev.has(key(goal.x, goal.y))) return null;
    const out = [];
    for (let n = goal; n && !(n.x === from.x && n.y === from.y); n = prev.get(key(n.x, n.y))) out.unshift(n);
    return out;
}

// ---------------------------------------------------------------- pictures

const images = new Map();
function loadImage(src) {
    if (images.has(src)) return images.get(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    images.set(src, img);
    return img;
}

/** An emoji drawn small onto its own canvas, so it can be blitted (and pixelated) like the rest. */
const emojiCache = new Map();
function emoji(ch, size = 11) {
    const k = ch + size;
    if (emojiCache.has(k)) return emojiCache.get(k);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size + 3;
    const c = cv.getContext('2d');
    c.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(ch, cv.width / 2, cv.height / 2 + 1);
    emojiCache.set(k, cv);
    return cv;
}

// palette
const P = {
    wall: '#3a2840', wallHi: '#4a3452', trim: '#6b4630', trimHi: '#8c5f3f', shelf: '#5a3b26',
    floorA: '#7d5236', floorB: '#73492f', floorLine: '#5a3825', rug: '#7e2f45', rugEdge: '#c99b4a', rugIn: '#963a52',
    counterTop: '#c48a55', counterHi: '#e0ad73', counterFront: '#6a3f24', counterLine: '#55311b',
    wood: '#8a5734', woodDark: '#5e3a22', cushion: '#b8434f', cushionHi: '#d8606b', metal: '#3a2c2c',
    leaf: '#3f8f4f', leafHi: '#6cc06a', pot: '#b0603a', glass: '#1d2a54', star: '#fff6b0', neon: '#ff6fb5', neonGlow: 'rgba(255,111,181,0.35)',
};

/** The room without its furniture: walls, shelves, window, sign, floor, rug, door mat. */
function paintRoom() {
    const cv = document.createElement('canvas');
    cv.width = RW;
    cv.height = RH;
    const c = cv.getContext('2d');
    const r = (x, y, w, h, col) => {
        c.fillStyle = col;
        c.fillRect(x, y, w, h);
    };
    // floor planks
    for (let y = 2 * T; y < RH; y += 4) {
        r(0, y, RW, 4, (y / 4) % 2 ? P.floorA : P.floorB);
        const off = ((y / 4) * 23) % 37;
        for (let x = -off; x < RW; x += 37) r(x, y, 1, 4, P.floorLine);
    }
    r(0, 2 * T, RW, 1, P.floorLine);
    // behind the bar: darker boards
    c.globalAlpha = 0.25;
    r(0, 2 * T, 7 * T, T, '#000');
    c.globalAlpha = 1;
    // rug in the middle of the room
    r(4 * T + 4, 5 * T + 2, 7 * T - 8, 4 * T - 2, P.rugEdge);
    r(4 * T + 6, 5 * T + 4, 7 * T - 12, 4 * T - 6, P.rug);
    r(4 * T + 10, 5 * T + 8, 7 * T - 20, 4 * T - 14, P.rugIn);
    for (let x = 4 * T + 6; x < 11 * T - 6; x += 6) r(x, 5 * T + 1, 2, 1, P.rugEdge), r(x, 9 * T - 1, 2, 1, P.rugEdge);
    // door mat
    r(DOOR.x * T - 4, DOOR.y * T + 2, T + 8, 12, '#5e7a3a');
    r(DOOR.x * T - 2, DOOR.y * T + 4, T + 4, 8, '#759648');
    // back wall
    r(0, 0, RW, 2 * T, P.wall);
    for (let x = 0; x < RW; x += 8) r(x, 0, 1, 2 * T - 6, P.wallHi);
    r(0, 2 * T - 6, RW, 6, P.trim);
    r(0, 2 * T - 6, RW, 1, P.trimHi);
    // bottle shelves behind the bar
    const bottles = ['#6ad1a0', '#e0b04a', '#c0403a', '#7aa6ff', '#b07ad8', '#f0e0b0', '#3a8a5a', '#d86a2a'];
    for (const sy of [7, 17]) {
        r(4, sy + 7, 7 * T - 8, 2, P.shelf);
        for (let x = 8, i = sy; x < 7 * T - 10; x += 6 + (i % 3), i++) {
            const h = 5 + (i % 3);
            const col = bottles[(i * 5) % bottles.length];
            r(x, sy + 7 - h, 3, h, col);
            r(x + 1, sy + 7 - h - 2, 1, 2, col);
            r(x, sy + 7 - h + 1, 1, 2, 'rgba(255,255,255,0.35)');
        }
    }
    // the window (night sky, moon, stars; the sky is redrawn by the hour in the live view)
    r(8 * T + 2, 3, 3 * T - 4, 2 * T - 12, P.trimHi);
    // a little framed poster
    r(7 * T + 1, 6, 10, 13, '#d8c79a');
    r(7 * T + 2, 7, 8, 11, '#3a6a8a');
    r(7 * T + 4, 10, 4, 4, '#ffd27e');
    // a clock
    r(13 * T - 4, 5, 9, 9, P.trimHi);
    r(13 * T - 3, 6, 7, 7, '#f3ead2');
    return cv;
}

/** The window's glass: sun or moon by the hour. */
function paintWindow(c, t) {
    const x0 = 8 * T + 4, y0 = 5, w = 3 * T - 8, h = 2 * T - 16;
    const hour = new Date().getHours();
    const day = hour >= 7 && hour < 18;
    const dusk = hour >= 18 && hour < 20;
    c.fillStyle = day ? '#7ec8f0' : dusk ? '#c0607a' : P.glass;
    c.fillRect(x0, y0, w, h);
    if (day) {
        c.fillStyle = '#fff3a0';
        c.fillRect(x0 + w - 10, y0 + 3, 5, 5);
        c.fillStyle = '#ffffff';
        c.fillRect(x0 + 4 + Math.floor(t * 2) % 30, y0 + 9, 7, 2);
    } else {
        c.fillStyle = '#f3ead2';
        c.fillRect(x0 + w - 10, y0 + 3, 4, 4);
        c.fillStyle = P.glass;
        c.fillRect(x0 + w - 9, y0 + 3, 2, 2);
        c.fillStyle = P.star;
        for (const [sx, sy, k] of [[3, 3, 0], [11, 7, 1], [19, 2, 2], [25, 9, 0], [7, 11, 1]]) if ((Math.floor(t * 1.3) + k) % 3) c.fillRect(x0 + sx, y0 + sy, 1, 1);
    }
    // the mullions
    c.fillStyle = P.trimHi;
    c.fillRect(x0 + Math.floor(w / 2), y0, 1, h);
    c.fillRect(x0, y0 + Math.floor(h / 2), w, 1);
    // the neon sign: a cocktail glass that flickers now and then
    const on = Math.floor(t * 7) % 53 !== 0;
    const nx = 11 * T + 6, ny = 6;
    if (on) {
        c.fillStyle = P.neonGlow;
        c.fillRect(nx - 2, ny - 2, 15, 15);
    }
    c.fillStyle = on ? P.neon : '#6a3550';
    for (let i = 0; i < 6; i++) c.fillRect(nx + i, ny + i, 11 - i * 2, 1);
    c.fillRect(nx + 5, ny + 6, 1, 4);
    c.fillRect(nx + 2, ny + 10, 7, 1);
    c.fillStyle = on ? '#9af0ff' : '#355';
    c.fillRect(nx + 8, ny - 1, 2, 2);
    // the clock's hands
    const now = new Date();
    const ccx = 13 * T, ccy = 9;
    c.fillStyle = '#3a2a2a';
    const hh = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2;
    const mm = (now.getMinutes() / 60) * Math.PI * 2;
    c.fillRect(Math.round(ccx + Math.sin(hh) * 2), Math.round(ccy - Math.cos(hh) * 2), 1, 1);
    c.fillRect(Math.round(ccx + Math.sin(mm) * 3), Math.round(ccy - Math.cos(mm) * 3), 1, 1);
    c.fillRect(ccx, ccy, 1, 1);
}

/** Furniture, each drawn in depth order with the people (sorted by the y of its front edge). */
function props() {
    const out = [];
    const add = (y, draw) => out.push({ y, draw });
    // the counter: one long piece, with a hatch at its open end
    add(4 * T - 1, (c) => {
        c.fillStyle = P.counterFront;
        c.fillRect(0, 3 * T + 4, 7 * T, T - 4);
        c.fillStyle = P.counterLine;
        for (let x = 6; x < 7 * T; x += 10) c.fillRect(x, 3 * T + 6, 1, T - 7);
        c.fillStyle = P.counterTop;
        c.fillRect(0, 3 * T - 2, 7 * T + 2, 7);
        c.fillStyle = P.counterHi;
        c.fillRect(0, 3 * T - 2, 7 * T + 2, 1);
        c.fillStyle = P.counterLine;
        c.fillRect(0, 3 * T + 5, 7 * T + 2, 1);
        // the coffee machine and a tip jar on the bar
        c.fillStyle = '#a8b0b8';
        c.fillRect(2, 3 * T - 12, 10, 10);
        c.fillStyle = '#5a646c';
        c.fillRect(4, 3 * T - 9, 6, 3);
        c.fillStyle = '#d0e8f0';
        c.fillRect(6 * T + 4, 3 * T - 8, 6, 6);
        c.fillStyle = '#e0b04a';
        c.fillRect(6 * T + 5, 3 * T - 5, 4, 2);
    });
    for (const s of SEATS) {
        const x = s.x * T, y = s.y * T;
        if (s.bar) {
            add(y + 9, (c) => {
                c.fillStyle = P.metal;
                c.fillRect(x + 7, y + 7, 2, 8);
                c.fillRect(x + 4, y + 14, 8, 1);
                c.fillStyle = P.cushion;
                c.fillRect(x + 3, y + 4, 10, 4);
                c.fillStyle = P.cushionHi;
                c.fillRect(x + 4, y + 4, 8, 1);
            });
        } else if (s.sofa) {
            const first = at(s.x - 1, s.y) !== 'F';
            const last = at(s.x + 1, s.y) !== 'F';
            add(y + 2, (c) => {
                c.fillStyle = '#7a3a5a';
                c.fillRect(x, y - 4, T, 9);
                c.fillStyle = '#93466c';
                c.fillRect(x, y - 4, T, 2);
            });
            add(y + 14, (c) => {
                c.fillStyle = '#93466c';
                c.fillRect(x, y + 6, T, 6);
                c.fillStyle = '#5e2c46';
                c.fillRect(x, y + 12, T, 2);
                if (first) (c.fillStyle = '#7a3a5a'), c.fillRect(x - 2, y + 1, 4, 12);
                if (last) (c.fillStyle = '#7a3a5a'), c.fillRect(x + T - 2, y + 1, 4, 12);
            });
        } else {
            // a chair: its back on the side away from the table
            const back = s.face === 'e' ? x + 2 : x + T - 5;
            add(y + 4, (c) => {
                c.fillStyle = P.woodDark;
                c.fillRect(back, y - 6, 3, 14);
                c.fillStyle = P.wood;
                c.fillRect(back, y - 6, 3, 2);
            });
            add(y + 13, (c) => {
                c.fillStyle = P.wood;
                c.fillRect(x + 3, y + 7, 10, 4);
                c.fillStyle = P.woodDark;
                c.fillRect(x + 3, y + 11, 2, 4);
                c.fillRect(x + 11, y + 11, 2, 4);
            });
        }
    }
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const ch = at(x, y), px = x * T, py = y * T;
            if (ch === 'T') {
                add(py + 13, (c, t, view) => {
                    c.fillStyle = P.woodDark;
                    c.fillRect(px + 7, py + 8, 2, 7);
                    c.fillRect(px + 4, py + 14, 8, 1);
                    c.fillStyle = P.wood;
                    c.fillRect(px - 1, py + 2, T + 2, 7);
                    c.fillStyle = '#a56a40';
                    c.fillRect(px, py + 2, T, 1);
                    // a candle, or what was served at this table
                    const dish = view?.dishAt(x, y);
                    if (dish) c.drawImage(emoji(dish, 9), px + 2, py - 7);
                    else {
                        c.fillStyle = '#f3ead2';
                        c.fillRect(px + 7, py, 2, 3);
                        c.fillStyle = Math.floor(t * 6) % 2 ? '#ffd27e' : '#ff9a4a';
                        c.fillRect(px + 7, py - 2, 2, 2);
                    }
                });
            } else if (ch === 'P') {
                add(py + 15, (c, t) => {
                    c.fillStyle = P.pot;
                    c.fillRect(px + 4, py + 9, 8, 6);
                    c.fillStyle = '#8a4a2a';
                    c.fillRect(px + 4, py + 9, 8, 1);
                    const sway = Math.round(Math.sin(t * 1.2 + px) * 0.6);
                    c.fillStyle = P.leaf;
                    c.fillRect(px + 2 + sway, py - 4, 4, 13);
                    c.fillRect(px + 10 + sway, py - 2, 4, 11);
                    c.fillRect(px + 6 + sway, py - 9, 4, 18);
                    c.fillStyle = P.leafHi;
                    c.fillRect(px + 7 + sway, py - 8, 1, 10);
                    c.fillRect(px + 3 + sway, py - 3, 1, 6);
                });
            } else if (ch === 'J') {
                add(py + 15, (c, t) => {
                    c.fillStyle = '#5a2a3a';
                    c.fillRect(px + 1, py - 12, 14, 27);
                    c.fillStyle = '#ffcf6a';
                    c.fillRect(px + 3, py - 10, 10, 6);
                    const k = Math.floor(t * 4) % 3;
                    for (let i = 0; i < 3; i++) {
                        c.fillStyle = ['#ff6fb5', '#6ad1ff', '#a8ff7a'][(i + k) % 3];
                        c.fillRect(px + 3 + i * 4, py - 2, 2, 8);
                    }
                    c.fillStyle = '#2a1a22';
                    c.fillRect(px + 3, py + 8, 10, 4);
                });
            }
        }
    }
    return out;
}

// ---------------------------------------------------------------- people

class Actor {
    constructor({ id, img, x, y, dir = 's', speed = 34 }) {
        Object.assign(this, { id, img, x, y, dir, speed });
        this.path = [];
        this.moving = false;
        this.walkT = 0;
        this.bubble = null;
        this.seat = null;
        this.sitY = 0;
    }
    get tile() {
        return tileOf(this.x, this.y);
    }
    /** Follow the path, a tile centre at a time. Returns true while walking. */
    walk(dt) {
        const n = this.path[0];
        if (!n) {
            this.moving = false;
            return false;
        }
        const tx = cx(n.x), ty = fy(n.y);
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
        const step = this.speed * dt;
        if (d <= step) {
            this.x = tx;
            this.y = ty;
            this.path.shift();
        } else {
            this.x += (dx / d) * step;
            this.y += (dy / d) * step;
        }
        const dir = dirOf(dx, dy);
        if (dir) this.dir = dir;
        this.moving = true;
        this.walkT += dt;
        return true;
    }
    goTo(goal, who = 'guest') {
        const p = findPath(this.tile, goal, who);
        if (!p) return false;
        this.path = p;
        return true;
    }
    say(icon, life = 2.2) {
        this.bubble = { icon, t: 0, life };
    }
    draw(c) {
        const img = this.img;
        if (!img?.complete || !img.naturalWidth) return;
        const frame = this.moving ? [0, 1, 2, 1][Math.floor(this.walkT * 7) % 4] : 1;
        const row = ROW[this.dir] ?? 0;
        const x = Math.round(this.x), y = Math.round(this.y - this.sitY);
        if (FLIP[this.dir]) {
            c.save();
            c.scale(-1, 1);
            c.drawImage(img, frame * CW, row * CH, CW, CH, -x - CW / 2, y - CH + 2, CW, CH);
            c.restore();
        } else c.drawImage(img, frame * CW, row * CH, CW, CH, x - CW / 2, y - CH + 2, CW, CH);
    }
    /** Shadow under the feet (drawn before everyone). */
    shadow(c) {
        c.fillStyle = 'rgba(20,10,20,0.28)';
        c.fillRect(Math.round(this.x) - 6, Math.round(this.y - this.sitY) + 1, 12, 2);
        c.fillRect(Math.round(this.x) - 4, Math.round(this.y - this.sitY), 8, 4);
    }
    /** A speech bubble above the head with an emoji in it (or …). */
    drawBubble(c, t) {
        const b = this.bubble;
        if (!b) return;
        const x = Math.round(this.x), y = Math.round(this.y - this.sitY) - CH + 2;
        const pop = Math.min(1, b.t * 6);
        if (pop < 0.3) return;
        const w = 16, h = 14, bx = x - w / 2, by = y - h + 2 + Math.round(Math.sin(t * 3) * 0.7);
        c.fillStyle = '#2a1a2a';
        c.fillRect(bx - 1, by, w + 2, h);
        c.fillRect(bx, by - 1, w, h + 2);
        c.fillStyle = b.order ? '#fff7d6' : '#ffffff';
        c.fillRect(bx, by, w, h);
        c.fillStyle = '#2a1a2a';
        c.fillRect(x - 1, by + h, 3, 1);
        c.fillRect(x, by + h + 1, 1, 1);
        c.fillStyle = b.order ? '#fff7d6' : '#ffffff';
        c.fillRect(x, by + h, 1, 1);
        if (b.icon === '…') {
            c.fillStyle = '#2a1a2a';
            for (let i = 0; i < 3; i++) if (Math.floor(t * 3) % 4 > i) c.fillRect(bx + 4 + i * 3, by + 7, 2, 2);
        } else c.drawImage(emoji(b.icon, 10), bx + 1, by);
        if (b.order) {
            // the order "!" blinks beside it
            if (Math.floor(t * 2) % 2) {
                c.fillStyle = '#ff5a5a';
                c.fillRect(bx + w + 2, by, 2, 6);
                c.fillRect(bx + w + 2, by + 8, 2, 2);
            }
        }
    }
}

// ---------------------------------------------------------------- the screen

export class LoungeView extends View {
    /** opts: { guest } a friend who asked for something in Messages (they will be at the bar). */
    constructor(app, { m, cast, byId, guest = null }) {
        super(app, 'Lounge');
        this.m = m;
        this.cast = cast;
        this.byId = byId;
        this.want = guest;
        this.guests = [];
        this.parts = [];
        this.focus = 0;
        this.t = 0;
        this.keys = new Set();
        this.dishes = new Map();
        this.arrivals = 0;
    }
    get type() {
        return 'lounge';
    }
    statusTitle() {
        return 'Lounge';
    }
    currentGame() {
        const g = this.guests[this.focus];
        return g ? this.byId.get(g.id) || null : null;
    }

    build() {
        this.el.innerHTML = `
            <div class="lg-stage"><canvas class="lg-cv" aria-label="The Lounge: a little bar where your friends hang out" role="img"></canvas></div>
            <div class="lg-hud" aria-live="polite"></div>
            <div class="lg-dlg" hidden><div class="lg-face"></div><div class="lg-body"><p class="lg-name"></p><p class="lg-text"></p><div class="lg-choices" role="listbox"></div></div><i class="lg-more" aria-hidden="true">▼</i></div>
            <div class="lg-craft" hidden role="dialog" aria-label="Make the order"></div>`;
        this.stage = this.el.querySelector('.lg-stage');
        this.cv = this.el.querySelector('.lg-cv');
        this.cx = this.cv.getContext('2d');
        this.cv.width = RW;
        this.cv.height = RH;
        this.hud = this.el.querySelector('.lg-hud');
        this.dlgEl = this.el.querySelector('.lg-dlg');
        this.craftEl = this.el.querySelector('.lg-craft');
        this.room = paintRoom();
        this.furniture = props();
        this.me = new Actor({ id: 'me', img: loadImage('img/bartender.png'), x: cx(3), y: fy(2), dir: 's', speed: 56 });
        this.ro = new ResizeObserver(() => this.size());
        this.ro.observe(this.stage);
        this.cv.addEventListener('pointerdown', (e) => this.tap(e));
        this.dlgEl.addEventListener('click', (e) => {
            const ch = e.target.closest('[data-c]');
            if (ch) {
                this.dlg.ci = +ch.dataset.c;
                this.app.feedback();
            }
            this.advance();
        });
        this.craftEl.addEventListener('click', (e) => this.craftClick(e));
        updateLounge((s) => (s.seen = Date.now()));
        this.pool = this.poolIds();
        this.openingLine();
        this.scheduleArrivals();
        this.renderHud();
    }

    // ----- who comes

    /** Friends (not the dragonfly) and games with a save on this device, each with a sprite. */
    poolIds() {
        const ids = new Set(this.m.friendIds().filter((id) => id !== GARDEN && this.cast[id] && this.byId.has(id)));
        for (const [id, c] of Object.entries(this.cast)) {
            if (!this.byId.has(id) || ids.has(id)) continue;
            if (hasSave(c.keys)) ids.add(id);
        }
        return [...ids];
    }

    /** Recently played first, then a shuffle; anyone who asked for something comes first of all. */
    nextGuestId() {
        const here = new Set(this.guests.map((g) => g.id));
        const recent = this.app.store.recent.map((r) => r.id);
        const pool = this.pool.filter((id) => !here.has(id) && !this.left?.has(id));
        if (!pool.length) {
            this.left = new Set();
            return null;
        }
        const asked = pool.find((id) => pendingOrder(id));
        if (asked) return asked;
        const weight = (id) => {
            const i = recent.indexOf(id);
            const lvl = this.m.isFriend(id) ? this.m.levelOf(id) : 0;
            return (i >= 0 ? 3 + Math.max(0, 10 - i) * 0.4 : 1) + lvl * 0.5;
        };
        let r = Math.random() * pool.reduce((s, id) => s + weight(id), 0);
        return pool.find((id) => (r -= weight(id)) < 0) || pool[0];
    }

    scheduleArrivals() {
        // the one who asked walks in first; a couple more come in close behind
        const first = this.want && this.cast[this.want] ? this.want : null;
        if (first && !this.pool.includes(first)) this.pool.push(first);
        const n = Math.min(this.pool.length, 3);
        for (let i = 0; i < n; i++) {
            const id = i === 0 && first ? first : null;
            setTimeout(() => this.app.top === this && this.arrive(id), 500 + i * (reduceMotion.matches ? 300 : 1600));
        }
        this.nextArrival = 14;
    }

    async arrive(id = null) {
        if (this.guests.length >= MAX_GUESTS) return;
        id ||= this.nextGuestId();
        if (!id || this.guests.some((g) => g.id === id)) return;
        const d = await this.m.load(id);
        if (!this.el?.isConnected || this.guests.some((g) => g.id === id)) return;
        // a game you have saved but never opened from here: they become a friend as they walk in
        if (!this.m.isFriend(id)) this.m.befriend(id, { why: 'lounge', quiet: true });
        const g = this.byId.get(id);
        const a = new Actor({ id, img: loadImage(`../${g?.folder || id}/avatar/sprite.png`), x: cx(DOOR.x), y: fy(DOOR.y) + 10, dir: 'n' });
        a.d = d;
        a.name = this.m.contact(id).name;
        a.color = this.m.contact(id).color;
        a.fav = favOf(id, d);
        a.since = this.t;
        a.state = 'enter';
        a.timer = 0;
        a.order = null;
        const asked = pendingOrder(id);
        if (asked) {
            a.wants = asked.item;
            a.asked = asked.via || 'msg';
        } else a.orderAt = this.t + rnd(6, 26);
        a.path = [{ x: DOOR.x, y: DOOR.y }];
        this.guests.push(a);
        this.arrivals++;
        sfx.door?.();
        setTimeout(() => a.state !== 'gone' && a.say(pick(['👋', '😊', '✨', '🎵']), 1.8), 600);
        this.app.say(`${a.name} walks into the Lounge`);
        this.seatGuest(a, a.wants ? 'bar' : null);
        this.renderHud();
    }

    freeSeats(bar = null) {
        const taken = new Set(this.guests.filter((g) => g.seat).map((g) => g.seat));
        return SEATS.filter((s) => !taken.has(s) && (bar === null || !!s.bar === bar));
    }

    /** Send a guest to a seat: 'bar' for a stool, false for anywhere else, null for any. */
    seatGuest(a, where = null) {
        let seats = this.freeSeats(where === 'bar' ? true : where === false ? false : null);
        if (!seats.length && where === 'bar') seats = this.freeSeats(false);
        if (!seats.length) {
            this.wander(a);
            return;
        }
        const s = pick(seats);
        if (a.seat) this.stand(a);
        a.seat = s;
        a.state = 'toSeat';
        const from = a.path.length ? a.path[a.path.length - 1] : a.tile;
        const p = findPath(from, s, 'guest');
        if (p) a.path.push(...p);
        else a.path.push({ x: s.x, y: s.y });
    }

    stand(a) {
        a.seat = null;
        a.sitY = 0;
    }

    wander(a) {
        if (a.seat) this.stand(a);
        for (let i = 0; i < 20; i++) {
            const x = Math.floor(rnd(0, COLS)), y = Math.floor(rnd(4, ROWS - 1));
            if (walkable(x, y, 'guest') && a.goTo({ x, y })) break;
        }
        a.state = 'wander';
        a.timer = rnd(2, 5);
    }

    leave(a) {
        if (a.order) return;
        this.stand(a);
        a.state = 'leave';
        a.goTo(DOOR);
        a.say(pick(['👋', '💤', '🌙', '✨']), 1.6);
        (this.left ||= new Set()).add(a.id);
    }

    // ----- the clock

    update(dt) {
        this.t += dt;
        const me = this.me;
        // the bartender: held keys walk eight ways, otherwise a tapped path
        let vx = 0, vy = 0;
        const k = this.keys;
        if (!this.busyUI()) {
            if (k.has('left')) vx -= 1;
            if (k.has('right')) vx += 1;
            if (k.has('up')) vy -= 1;
            if (k.has('down')) vy += 1;
        }
        if (vx || vy) {
            me.path = [];
            this.target = null;
            const d = Math.hypot(vx, vy);
            const sx = (vx / d) * me.speed * dt, sy = (vy / d) * me.speed * dt;
            if (this.free(me.x + sx, me.y)) me.x += sx;
            if (this.free(me.x, me.y + sy)) me.y += sy;
            me.dir = dirOf(vx, vy);
            me.moving = true;
            me.walkT += dt;
        } else if (!me.walk(dt)) {
            me.moving = false;
            if (this.target) {
                const g = this.target;
                this.target = null;
                if (this.guests.includes(g)) this.faceAndTalk(g);
            }
        }
        if (me.moving) {
            this.stepT = (this.stepT || 0) + dt;
            if (this.stepT > 0.28) {
                this.stepT = 0;
                sfx.step?.();
            }
        }

        // the guests
        for (const a of this.guests) this.think(a, dt);
        this.guests = this.guests.filter((a) => a.state !== 'gone');
        this.focus = clamp(this.focus, 0, Math.max(0, this.guests.length - 1));

        // more people come and go while it is open
        this.nextArrival -= dt;
        if (this.nextArrival <= 0) {
            this.nextArrival = rnd(18, 40);
            if (this.guests.length < Math.min(MAX_GUESTS, this.pool.length)) this.arrive();
            else {
                const old = this.guests.filter((a) => a.state === 'sit' && !a.order && !a.wants && this.t - a.since > 70);
                if (old.length && this.pool.length > this.guests.length) this.leave(pick(old));
            }
        }
        for (const q of this.parts) {
            q.age += dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
        }
        this.parts = this.parts.filter((q) => q.age < q.life);
        this.typeDialog(dt);
        this.craftTick(dt);
        this.hudT = (this.hudT || 0) + dt;
        if (this.hudT > 0.5) {
            this.hudT = 0;
            this.renderHud();
        }
    }

    /** Can the bartender's feet stand here? */
    free(x, y) {
        for (const [ox, oy] of [[-4, 0], [4, 0], [-4, -3], [4, -3]]) {
            const t = tileOf(x + ox, y + oy);
            if (!walkable(t.x, t.y, 'me')) return false;
        }
        return y > 2 * T + 6 && y < RH - 1;
    }

    think(a, dt) {
        a.timer -= dt;
        if (a.bubble) {
            a.bubble.t += dt;
            if (a.bubble.life && a.bubble.t > a.bubble.life) a.bubble = null;
        }
        const walking = a.walk(dt);
        if (walking) {
            a.sitY = 0;
            return;
        }
        if (a.state === 'leave') {
            a.state = 'gone';
            sfx.door?.();
            this.renderHud();
            return;
        }
        if (a.state === 'toSeat' && a.seat) {
            a.state = 'sit';
            a.dir = a.seat.face;
            a.sitY = a.seat.bar ? 3 : 2;
            a.timer = rnd(8, 20);
            // someone who asked in Messages orders wherever they sit
            if (a.wants) this.placeOrder(a, a.wants);
            return;
        }
        if (a.state === 'wander' && a.timer <= 0) {
            this.seatGuest(a, Math.random() < 0.4 && !a.served ? 'bar' : false);
            return;
        }
        if (a.state === 'order') {
            // they wait patiently; the patience only runs while you are not making something
            if (!this.craft && !this.dlg) a.patience -= dt;
            if (a.patience <= 0) {
                a.order = null;
                a.bubble = null;
                a.say('💭', 2);
                a.state = 'sit';
                a.timer = rnd(4, 8);
                a.orderAt = this.t + rnd(30, 60);
            }
            return;
        }
        if (a.state === 'eat') {
            a.eatT -= dt;
            if (a.bubble?.icon && a.eatT < 3 && a.bubble.icon !== '❤️') a.bubble = null;
            if (a.eatT <= 0) {
                a.state = 'sit';
                a.timer = rnd(5, 10);
                this.dishes.delete(a.dishKey);
            }
            return;
        }
        if (a.state !== 'sit') return;
        // at the bar with nothing ordered yet: time to order
        if (a.seat?.bar && !a.served && !a.order && this.t >= (a.orderAt ?? Infinity)) {
            this.placeOrder(a, Math.random() < 0.5 ? a.fav : pick(MENU).id);
            return;
        }
        if (a.timer > 0) {
            // now and then a little something: a note, a laugh, a chat with whoever shares the table
            if (!a.bubble && Math.random() < dt * 0.06) {
                const mate = this.tablemate(a);
                if (mate && !mate.bubble) {
                    a.say('💬', 1.6);
                    setTimeout(() => !mate.bubble && mate.state === 'sit' && mate.say(pick(['😄', '💬', '😂', '❤️']), 1.6), 900);
                } else a.say(pick(['🎵', '😊', '…', '☕', '✨']), 1.8);
            }
            return;
        }
        // done sitting: off to the bar (to order), somewhere else, or home
        const r = Math.random();
        if (!a.served && !a.seat?.bar && r < 0.55 && this.freeSeats(true).length) {
            a.orderAt = this.t + rnd(2, 8);
            this.seatGuest(a, 'bar');
        } else if (a.seat?.bar && a.served) this.seatGuest(a, false);
        else if (this.t - a.since > 90 && r < 0.4 && this.pool.length > this.guests.length) this.leave(a);
        else if (r < 0.75) a.timer = rnd(6, 16);
        else this.wander(a);
    }

    /** Another guest seated at the same table. */
    tablemate(a) {
        if (!a.seat || a.seat.bar) return null;
        return this.guests.find((b) => b !== a && b.seat && !b.seat.bar && Math.abs(b.seat.y - a.seat.y) <= 0 && Math.abs(b.seat.x - a.seat.x) <= 2);
    }

    placeOrder(a, item) {
        a.order = item;
        a.state = 'order';
        a.patience = a.asked ? 1e9 : 120;
        a.bubble = { icon: itemOf(item).icon, t: 0, life: 0, order: true };
        sfx.pop?.();
        this.app.say(`${a.name} would like ${itemWords(item, { article: true })}`);
        this.renderHud();
    }

    /** What's on a table (a served dish sits in front of whoever is eating it). */
    dishAt(x, y) {
        return this.dishes.get(`${x},${y}`) || null;
    }

    // ----- painting

    draw() {
        const c = this.cx;
        c.imageSmoothingEnabled = false;
        c.drawImage(this.room, 0, 0);
        paintWindow(c, this.t);
        // shadows first, then furniture and people by depth
        for (const a of [this.me, ...this.guests]) a.shadow(c);
        const list = [
            ...this.furniture.map((f) => ({ y: f.y, draw: () => f.draw(c, this.t, this) })),
            ...[this.me, ...this.guests].map((a) => ({ y: a.y - a.sitY + (a.seat ? 1 : 0), draw: () => a.draw(c) })),
        ];
        list.sort((p, q) => p.y - q.y);
        for (const it of list) it.draw();
        // served things on the counter
        for (const a of this.guests) {
            if (a.state === 'eat' && a.seat?.bar && a.dishIcon) c.drawImage(emoji(a.dishIcon, 9), cx(a.seat.x) - 6, 3 * T - 10);
        }
        // the dragonfly, if you've met it, loops about the window
        const mem = currentMem();
        if (mem?.met) {
            const look = lookOf(mem);
            const img = dfSprite({ look, frame: [0, 1, 2, 1][Math.floor(this.t * 16) % 4], face: 'open', paper: false });
            const x = 9.5 * T + Math.sin(this.t * 0.5) * 30, y = 2.6 * T + Math.sin(this.t * 1.1) * 6;
            const dir = Math.cos(this.t * 0.5) >= 0 ? 1 : -1;
            c.save();
            c.translate(Math.round(x), Math.round(y));
            c.scale(dir * 0.5, 0.5);
            c.drawImage(img, -DFW / 2, -DFH / 2);
            c.restore();
        }
        // bubbles, the focus arrow, hearts
        for (const a of this.guests) a.drawBubble(c, this.t);
        const f = this.guests[this.focus];
        if (f && !this.craft && f.state !== 'leave') {
            const x = Math.round(f.x), y = Math.round(f.y - f.sitY) - CH - (f.bubble ? 16 : 2) + Math.round(Math.sin(this.t * 5) * 1.5);
            c.fillStyle = '#ffe14a';
            c.fillRect(x - 3, y, 7, 1);
            c.fillRect(x - 2, y + 1, 5, 1);
            c.fillRect(x - 1, y + 2, 3, 1);
            c.fillRect(x, y + 3, 1, 1);
        }
        for (const q of this.parts) {
            if (q.age < 0) continue;
            if (q.age > q.life - 0.3 && Math.floor(q.age * 12) % 2) continue;
            const ic = q.kind === 'heart' ? pxIcon('heart') : emoji(q.icon, 9);
            c.drawImage(ic, Math.round(q.x - ic.width / 2), Math.round(q.y - ic.height / 2));
        }
    }

    hearts(a, n = 4) {
        for (let i = 0; i < n; i++) this.parts.push({ kind: 'heart', x: a.x + rnd(-8, 8), y: a.y - a.sitY - CH + 8, vx: rnd(-6, 6), vy: rnd(-22, -14), life: 1.4, age: -i * 0.15 });
    }

    size() {
        const w = this.stage.clientWidth, h = this.stage.clientHeight;
        if (!w || !h) return;
        // whole pixels when there's room for 2× or more; otherwise fill the screen (CSS keeps it pixelated)
        const fit = Math.min(w / RW, h / RH);
        const s = fit >= 2.5 ? Math.floor(fit) : fit;
        this.cv.style.width = `${Math.floor(RW * s)}px`;
        this.cv.style.height = `${Math.floor(RH * s)}px`;
    }

    // ----- the HUD: who is focused, their hearts and what they want

    renderHud() {
        const f = this.guests[this.focus];
        const n = this.guests.length;
        let html;
        if (!this.pool.length) html = `<span class="lg-tip">🍹 Play a game and its character will drop by</span>`;
        else if (!f) html = `<span class="lg-tip">🍹 Opening up… ${this.pool.length} friend${this.pool.length === 1 ? '' : 's'} might stop by</span>`;
        else {
            const want = f.order ? `<span class="lg-want">${itemOf(f.order).icon} ${esc(itemOf(f.order).name)}</span>` : f.state === 'eat' ? '<span class="lg-want">😋</span>' : '';
            html = `<span class="lg-who" style="--c:${esc(f.color || '#ffd27e')}"><b>${esc(f.name)}</b><i>${this.m.hearts(f.id)}</i></span>${want}<span class="lg-count">${n} here</span>`;
        }
        if (html !== this.hudHTML) {
            this.hudHTML = html;
            this.hud.innerHTML = html;
        }
        // the box art beside the console follows whoever you're looking at
        const g = f && this.byId.get(f.id);
        if (g && this.shownFocus !== g && this.app.top === this) {
            this.shownFocus = g;
            this.app.focusGame(g);
        }
    }

    // ----- talking (JRPG dialog boxes)

    busyUI() {
        return !!(this.dlg || this.craft);
    }

    /** Show a dialog: pages of text from someone, then maybe a choice. */
    dialog({ who = null, pages, choices = null, then = null }) {
        const name = who ? who.name : 'You';
        this.dlg = { who, pages: pages.filter(Boolean), page: 0, shown: 0, choices, ci: 0, then };
        const face = this.dlgEl.querySelector('.lg-face');
        if (who) {
            face.hidden = false;
            face.style.backgroundImage = `url('${this.m.img(who.id, false)}')`;
            face.style.setProperty('--c', who.color || '#ffd27e');
        } else face.hidden = true;
        this.dlgEl.querySelector('.lg-name').textContent = name;
        this.dlgEl.hidden = false;
        this.dlgEl.classList.remove('in');
        void this.dlgEl.offsetWidth;
        this.dlgEl.classList.add('in');
        this.paintDialog();
    }

    paintDialog() {
        const d = this.dlg;
        if (!d) return;
        const text = d.pages[d.page] || '';
        this.dlgEl.querySelector('.lg-text').textContent = text.slice(0, Math.floor(d.shown));
        const done = d.shown >= text.length;
        const last = d.page >= d.pages.length - 1;
        const ch = this.dlgEl.querySelector('.lg-choices');
        if (done && last && d.choices) {
            ch.innerHTML = d.choices.map((c, i) => `<button type="button" class="lg-choice${i === d.ci ? ' sel' : ''}" data-c="${i}" role="option" aria-selected="${i === d.ci}">${esc(c)}</button>`).join('');
            ch.hidden = false;
        } else {
            ch.innerHTML = '';
            ch.hidden = true;
        }
        this.dlgEl.querySelector('.lg-more').hidden = !done || (last && !!d.choices);
        if (done && d.said !== d.page) {
            d.said = d.page;
            this.app.say(`${d.who ? d.who.name : 'You'}: ${text}`);
        }
    }

    typeDialog(dt) {
        const d = this.dlg;
        if (!d) return;
        const text = d.pages[d.page] || '';
        if (d.shown < text.length) {
            const before = Math.floor(d.shown);
            d.shown = reduceMotion.matches ? text.length : Math.min(text.length, d.shown + dt * 45);
            if (Math.floor(d.shown) !== before && before % 3 === 0) sfx.blip?.();
            this.paintDialog();
        }
    }

    /** ● on a dialog: finish the line, next page, or pick the choice. */
    advance() {
        const d = this.dlg;
        if (!d) return false;
        const text = d.pages[d.page] || '';
        if (d.shown < text.length) {
            d.shown = text.length;
            this.paintDialog();
            return true;
        }
        if (d.page < d.pages.length - 1) {
            d.page++;
            d.shown = 0;
            this.paintDialog();
            return true;
        }
        const choice = d.choices ? d.ci : null;
        this.closeDialog();
        d.then?.(choice);
        return true;
    }

    closeDialog() {
        this.dlg = null;
        this.dlgEl.hidden = true;
    }

    fill(a, text, extra = {}) {
        if (!a) return text.replace(/\{you\}/gi, this.m.state.me || 'friend');
        return this.m.fillFor(a.id, text, extra) || text;
    }

    openingLine() {
        const n = this.pool.length;
        const orders = this.want ? this.m.contact(this.want).name : null;
        setTimeout(() => {
            if (this.app.top !== this || this.dlg) return;
            if (!n) {
                this.dialog({ pages: ['It is quiet tonight… just me and the jukebox.', 'Play a game and its character will start dropping by the Lounge. Then I can make them something!'] });
            } else if (orders) {
                this.dialog({ pages: [`${orders} said they were on the way. Better get the bar ready!`] });
            }
        }, 450);
    }

    // ----- serving

    /** Walk to someone (across the bar for the stools), then talk. */
    approach(a) {
        if (!a || a.state === 'leave') return this.app.deny();
        const goal = this.serviceSpot(a);
        if (!goal) return this.faceAndTalk(a);
        const here = tileOf(this.me.x, this.me.y);
        const p = findPath(here, goal, 'me');
        if (!p) return this.faceAndTalk(a);
        this.me.path = p;
        this.target = a;
        if (!p.length) this.faceAndTalk(a);
    }

    /** Where the bartender stands to serve someone. */
    serviceSpot(a) {
        const t = a.seat || a.tile;
        if (a.seat?.bar) return { x: t.x, y: 2 };
        const here = tileOf(this.me.x, this.me.y);
        let best = null;
        for (const [dx, dy] of Object.values(VEC)) {
            const x = t.x + dx, y = t.y + dy;
            if (!walkable(x, y, 'me') || this.guests.some((g) => g !== a && !g.seat && g.tile.x === x && g.tile.y === y)) continue;
            const d = Math.hypot(x - here.x, y - here.y);
            if (!best || d < best.d) best = { x, y, d };
        }
        return best;
    }

    /** Close enough (or across the counter) to talk to? */
    near(a) {
        const dx = a.x - this.me.x, dy = a.y - this.me.y;
        if (a.seat?.bar && tileOf(this.me.x, this.me.y).y === 2 && Math.abs(dx) < 14) return true;
        return Math.hypot(dx, dy) < 26;
    }

    faceAndTalk(a) {
        if (!this.guests.includes(a)) return;
        const d = dirOf(a.x - this.me.x, a.y - this.me.y);
        if (d) this.me.dir = d;
        if (a.state === 'toSeat' || a.state === 'wander') {
            // still walking: wave and wait
            a.say('👋', 1.2);
            return;
        }
        if (a.state === 'sit' || a.state === 'eat' || a.state === 'order') {
            const d2 = dirOf(this.me.x - a.x, this.me.y - a.y);
            if (d2 && !a.seat) a.dir = d2;
        }
        this.talk(a);
    }

    talk(a) {
        const lvl = this.m.levelOf(a.id);
        if (a.state === 'order' && a.order) {
            const item = a.order;
            const words = itemWords(item, { article: true });
            const cap = words.charAt(0).toUpperCase() + words.slice(1);
            let line = this.fill(a, pick(ORDER_LINES[clamp(lvl, 0, ORDER_LINES.length - 1)]), { item: words, Item: cap });
            if (a.asked === 'msg') line = this.fill(a, pick(['Thanks for coming! Like I said in my message: {item}, please!', 'You got my message! {Item}, please! 😊']), { item: words, Item: cap });
            this.dialog({
                who: a,
                pages: [line],
                choices: ['Coming right up!', 'Just a moment…'],
                then: (c) => {
                    if (c === 0) this.startCraft(a);
                    else a.say('😊', 1.2);
                },
            });
            return;
        }
        if (a.state === 'eat') {
            this.dialog({ who: a, pages: [this.fill(a, pick(['Mmm! *happy munching*', 'So good. You have a gift, {you}.', 'Mmmph! (mouth full) Thank you!']))] });
            return;
        }
        // just hanging out: something in their own voice from their game
        const own = this.m.draw?.(a.id, 'chat');
        const first = a.talked ? null : this.fill(a, pick(['Oh, hi {you}!', 'Hey, it is the bartender! Hi {you}!', 'Evening, {you}!']));
        const pages = [first, Math.random() < 0.7 && own ? own : this.fill(a, pick(HANG_LINES))].filter(Boolean);
        if (!a.served && !a.seat?.bar && Math.random() < 0.5) pages.push(this.fill(a, 'Maybe I will grab something from the bar in a bit.'));
        a.talked = true;
        this.dialog({
            who: a,
            pages,
            then: () => {
                this.m.grow(a.id, 1, 'talk');
                if (lvl >= 2) {
                    a.say('❤️', 1.4);
                    this.hearts(a, 2);
                }
            },
        });
    }

    // ----- making it (the mini game)

    startCraft(a) {
        const item = itemOf(a.order);
        const shelf = [...INGREDIENTS];
        this.craft = { a, item, step: 0, misses: 0, phase: 'pick', cursor: 0, shelf, needle: 0, dirN: 1, t: 0, speed: 1.15 + this.m.levelOf(a.id) * 0.08 };
        this.paintCraft();
        this.craftEl.hidden = false;
        this.craftEl.classList.remove('in');
        void this.craftEl.offsetWidth;
        this.craftEl.classList.add('in');
        this.app.say(`Make ${item.name}: ${item.steps.map((s) => ingredientOf(s).name).join(', then ')}. Then ${item.finish}.`);
    }

    paintCraft() {
        const k = this.craft;
        if (!k) return;
        const { item, a } = k;
        const steps = item.steps
            .map((s, i) => {
                const ing = ingredientOf(s);
                const done = i < k.step;
                const next = i === k.step && k.phase === 'pick';
                return `<span class="lg-step${done ? ' done' : ''}${next ? ' next' : ''}" title="${esc(ing.name)}"><i>${ing.icon}</i><small>${esc(ing.name)}</small></span>`;
            })
            .join('<b class="lg-arrow">›</b>');
        const fin = `<b class="lg-arrow">›</b><span class="lg-step fin${k.phase === 'time' ? ' next' : ''}${k.phase === 'done' ? ' done' : ''}"><i>⏱️</i><small>${esc(item.finish)}</small></span>`;
        let body;
        if (k.phase === 'pick') {
            body = `<div class="lg-shelf" role="listbox" aria-label="Shelf">${k.shelf
                .map((s, i) => `<button type="button" class="lg-ing${i === k.cursor ? ' sel' : ''}" data-i="${i}" role="option" aria-selected="${i === k.cursor}" aria-label="${esc(s.name)}"><i>${s.icon}</i></button>`)
                .join('')}</div><p class="lg-help">${esc(`Pick ${ingredientOf(item.steps[k.step]).name.toLowerCase()} · ${k.shelf[k.cursor].name}`)}</p>`;
        } else {
            body = `<div class="lg-meter" aria-label="Timing"><span class="lg-zone ok"></span><span class="lg-zone good"></span><span class="lg-zone best"></span><i class="lg-needle"></i></div>
                <button type="button" class="lg-go" data-go>${esc(item.finish)}!</button><p class="lg-help">Stop the needle in the gold</p>`;
        }
        this.craftEl.innerHTML = `
            <div class="lg-win">
                <p class="lg-ctitle"><span>${item.icon}</span> ${esc(item.name)} <small>for ${esc(a.name)}${a.fav === item.id ? ' · ★ favourite' : ''}</small></p>
                <div class="lg-recipe">${steps}${fin}</div>
                ${body}
                ${k.misses ? `<p class="lg-miss">${'✗'.repeat(Math.min(3, k.misses))} oops</p>` : ''}
            </div>`;
        this.needleEl = this.craftEl.querySelector('.lg-needle');
    }

    craftClick(e) {
        const k = this.craft;
        if (!k) return;
        const b = e.target.closest('[data-i]');
        if (b && k.phase === 'pick') {
            k.cursor = +b.dataset.i;
            this.pickIngredient();
            return;
        }
        if (e.target.closest('[data-go]') || e.target.closest('.lg-meter')) this.stopNeedle();
    }

    craftMove(d, grid = false) {
        const k = this.craft;
        if (!k || k.phase !== 'pick') return false;
        const n = k.shelf.length, cols = 4;
        let i = k.cursor;
        if (grid) {
            const [dx, dy] = d;
            const x = (i % cols) + dx, y = Math.floor(i / cols) + dy;
            if (x < 0 || x >= cols || y < 0 || y >= Math.ceil(n / cols)) return false;
            i = y * cols + x;
        } else i = clamp(i + d, 0, n - 1);
        if (i === k.cursor) return false;
        k.cursor = i;
        this.paintCraft();
        this.app.say(k.shelf[i].name);
        return true;
    }

    pickIngredient() {
        const k = this.craft;
        const want = k.item.steps[k.step];
        const got = k.shelf[k.cursor];
        if (got.id === want) {
            k.step++;
            sfx.pick?.();
            if (k.step >= k.item.steps.length) {
                k.phase = 'time';
                k.needle = 0;
                k.dirN = 1;
            }
        } else {
            k.misses++;
            this.app.deny();
            this.app.say(`Not ${got.name.toLowerCase()}. ${ingredientOf(want).name} next.`);
        }
        this.paintCraft();
    }

    craftTick(dt) {
        const k = this.craft;
        if (!k || k.phase !== 'time') return;
        k.needle += k.dirN * dt * k.speed;
        if (k.needle >= 1) (k.needle = 1), (k.dirN = -1);
        if (k.needle <= 0) (k.needle = 0), (k.dirN = 1);
        if (this.needleEl) this.needleEl.style.left = `${(k.needle * 100).toFixed(2)}%`;
    }

    stopNeedle() {
        const k = this.craft;
        if (!k || k.phase !== 'time') return;
        const off = Math.abs(k.needle - 0.5);
        const timing = off < 0.07 ? 3 : off < 0.2 ? 2 : 1;
        const stars = clamp(timing - Math.min(2, k.misses), 1, 3);
        k.phase = 'done';
        sfx.pour?.();
        this.paintCraft();
        this.craftEl.querySelector('.lg-win')?.insertAdjacentHTML('beforeend', `<p class="lg-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} <span>${['', 'Okay', 'Great', 'Perfect!'][stars]}</span></p>`);
        setTimeout(() => this.serve(k, stars), reduceMotion.matches ? 300 : 900);
    }

    cancelCraft() {
        if (!this.craft) return false;
        this.craft = null;
        this.craftEl.hidden = true;
        return true;
    }

    serve(k, stars) {
        if (this.craft !== k) return;
        this.craft = null;
        this.craftEl.hidden = true;
        const a = k.a;
        if (!this.guests.includes(a)) return;
        const item = k.item;
        const fav = a.fav === item.id;
        const asked = a.asked;
        a.order = null;
        a.served = true;
        a.wants = null;
        a.state = 'eat';
        a.eatT = 7;
        a.dishIcon = item.icon;
        a.bubble = { icon: '❤️', t: 0, life: 1.6 };
        if (!a.seat?.bar && a.seat) {
            a.dishKey = `${a.seat.x + (a.seat.face === 'e' ? 1 : -1)},${a.seat.y}`;
            this.dishes.set(a.dishKey, item.icon);
        }
        sfx.ding?.();
        this.hearts(a, 2 + stars);
        // friendship: by how well it came out, more for a favourite, more again if they asked for it
        const pts = [0, 2, 4, 6][stars] + (fav ? 3 : 0) + (asked ? 4 : 0);
        const before = this.m.levelOf(a.id);
        this.m.grow(a.id, pts, 'serve');
        const s = updateLounge((st) => {
            st.served[a.id] = { t: Date.now(), item: item.id, q: stars, thanked: !!asked };
            st.count = (st.count || 0) + 1;
            st.best[item.id] = Math.max(st.best[item.id] || 0, stars);
            delete st.orders[a.id];
        });
        const words = itemWords(item.id);
        const pages = [this.fill(a, pick(SERVED_LINES[stars]), { item: words })];
        if (fav) pages.push(this.fill(a, pick(FAV_LINES)));
        this.dialog({
            who: a,
            pages,
            then: () => {
                const after = this.m.levelOf(a.id);
                this.app.toast(after > before ? `💖 ${a.name} likes you more!` : `💖 +${pts} with ${a.name}`);
                if (asked) {
                    // they say it in Messages too, since that's where they asked
                    this.m.deliver(a.id, { x: this.fill(a, pick(ASK_DONE), { item: words }), k: 'lounge' }, { notify: false, read: true });
                }
                if (s.count === 1) setTimeout(() => this.app.top === this && !this.dlg && this.dialog({ pages: ['My first order! Everyone I serve will remember it… and they might text me about it later.'] }), 600);
            },
        });
        this.renderHud();
    }

    // ----- input

    tap(e) {
        if (this.app.swiped) return;
        if (this.dlg) return this.advance();
        if (this.craft) return;
        const r = this.cv.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * RW, y = ((e.clientY - r.top) / r.height) * RH;
        // a person? (their whole sprite is the target)
        const hit = [...this.guests].reverse().find((a) => Math.abs(a.x - x) < 10 && y < a.y - a.sitY + 2 && y > a.y - a.sitY - CH + 6);
        if (hit) {
            this.focus = this.guests.indexOf(hit);
            this.app.feedback();
            this.renderHud();
            if (this.near(hit)) this.faceAndTalk(hit);
            else this.approach(hit);
            return;
        }
        const t = tileOf(x, y + 2);
        const p = findPath(tileOf(this.me.x, this.me.y), t, 'me');
        if (p && walkable(t.x, t.y, 'me')) {
            this.me.path = p;
            this.target = null;
        }
    }

    /** Keys the lounge handles itself (walking, talking); the rest go to the console. */
    onKey(e, down) {
        const k = e.key;
        const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' }[k];
        if (!down) {
            if (dir) this.keys.delete(dir);
            return !!dir;
        }
        if (this.craft) {
            if (dir) {
                if (this.craft.phase === 'pick') {
                    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
                    if (this.craftMove(v, true)) sfx.tick();
                    else this.app.bump(this.craftEl.querySelector('.lg-shelf'), v[1] || v[0]);
                }
                return true;
            }
            if (k === 'Enter' || k === ' ' || k === 'z' || k === 'e') {
                this.onSelect();
                return true;
            }
            return false;
        }
        if (this.dlg) {
            if (dir && this.dlg.choices) {
                if (dir === 'up' || dir === 'left') this.onTick(-1);
                else this.onTick(1);
                return true;
            }
            if (k === 'Enter' || k === ' ' || k === 'z' || k === 'e') {
                this.app.feedback();
                this.advance();
                return true;
            }
            return !!dir;
        }
        if (dir) {
            this.keys.add(dir);
            return true;
        }
        if (k === 'Enter' || k === ' ' || k === 'z' || k === 'e') {
            this.interactHere();
            return true;
        }
        return false;
    }

    /** Talk to whoever is right in front of you (or the nearest, if no one is). */
    interactHere() {
        const near = this.guests.filter((a) => this.near(a));
        if (near.length) {
            near.sort((p, q) => Math.hypot(p.x - this.me.x, p.y - this.me.y) - Math.hypot(q.x - this.me.x, q.y - this.me.y));
            this.app.feedback();
            this.focus = this.guests.indexOf(near[0]);
            this.faceAndTalk(near[0]);
        } else this.onSelect();
    }

    onTick(d) {
        if (this.craft) return this.craftMove(d);
        if (this.dlg) {
            const n = this.dlg.choices?.length || 0;
            const done = this.dlg.page >= this.dlg.pages.length - 1 && this.dlg.shown >= (this.dlg.pages[this.dlg.page] || '').length;
            if (!n || !done) return false;
            const ci = clamp(this.dlg.ci + d, 0, n - 1);
            if (ci === this.dlg.ci) return false;
            this.dlg.ci = ci;
            this.paintDialog();
            this.app.say(this.dlg.choices[ci]);
            return true;
        }
        const n = this.guests.length;
        if (!n) return false;
        this.focus = (this.focus + d + n) % n;
        const f = this.guests[this.focus];
        this.app.say(`${f.name}${f.order ? `, wants ${itemOf(f.order).name}` : ''}`);
        this.renderHud();
        return true;
    }

    onSelect() {
        if (this.craft) {
            if (this.craft.phase === 'pick') this.pickIngredient();
            else this.stopNeedle();
            return;
        }
        if (this.dlg) return void this.advance();
        const f = this.guests[this.focus];
        if (!f) {
            this.dialog({ pages: [this.pool.length ? 'Nobody at the bar yet. They will be along soon!' : 'It is quiet tonight. Play a game and its character will drop by!'] });
            return;
        }
        if (this.near(f)) this.faceAndTalk(f);
        else this.approach(f);
    }

    onPlay() {
        this.onSelect();
    }

    onPrev() {
        if (!this.onTick(-1)) this.app.deny();
    }

    onNext() {
        if (!this.onTick(1)) this.app.deny();
    }

    onHold() {
        // a wave to whoever you've picked: they wave back
        const f = this.guests[this.focus];
        if (!f) return this.app.deny();
        f.say('👋', 1.4);
        this.me.say('👋', 1.2);
        this.app.buzz([8, 40, 8]);
    }

    onBack() {
        if (this.craft) {
            this.cancelCraft();
            this.craft = null;
            this.app.toast('Order on hold');
            return true;
        }
        if (this.dlg) {
            this.closeDialog();
            return true;
        }
        return false;
    }

    onSwipe() {
        /* the floor is for walking: swipes don't go back here (MENU does) */
    }

    // ----- lifecycle

    shown() {
        this.size();
        this.keys.clear();
        cancelAnimationFrame(this.raf);
        let last = performance.now();
        const loop = (now) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            this.update(dt);
            this.draw();
            this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
    }

    hidden() {
        cancelAnimationFrame(this.raf);
        this.keys.clear();
    }

    destroy() {
        super.destroy();
        this.ro?.disconnect();
    }
}

/** Is any of a game's save keys in this browser? (a trailing * is a prefix) */
function hasSave(keys) {
    if (!keys?.length) return false;
    try {
        for (const k of keys) {
            if (k.endsWith('*')) {
                const pre = k.slice(0, -1);
                for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith(pre)) return true;
            } else if (localStorage.getItem(k) !== null) return true;
        }
    } catch {
        /* storage blocked */
    }
    return false;
}

/** For the home menu: who is waiting at the bar (friends who asked for something in Messages). */
export function loungeCaption(m) {
    const s = loungeState();
    const asks = Object.entries(s.orders).filter(([, o]) => o && Date.now() - o.t < 48 * 36e5);
    if (asks.length) return `🍹 ${m.contact(asks[0][0]).name} is waiting for ${itemOf(asks[0][1].item).name.toLowerCase()}`;
    return s.count ? `${s.count} served · your friends hang out here` : 'Make drinks for your friends';
}

