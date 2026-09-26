// ============================================================
// Item icons: 16x16, one painter per `ic` shape, coloured by hue.
// ============================================================

import { Pix, ramp, hsl, OUTLINE, shade } from './core.js';

const WOOD = ramp(28, 0.45, 0.42), METAL = ramp(220, 0.08, 0.62), LEAF = ramp(110, 0.55, 0.4), PAPER = ramp(45, 0.45, 0.8);
const DARK = [40, 30, 44, 255], WHITE = [250, 248, 240, 255];

function handle(p, x0, y0, x1, y1) { p.line(x0, y0, x1, y1, WOOD[1]); p.line(x0 + 1, y0, x1 + 1, y1, WOOD[0]); }
const leafTop = (p, x, y) => { p.set(x, y, LEAF[1]); p.set(x - 1, y - 1, LEAF[2]); p.set(x + 1, y - 1, LEAF[1]); p.set(x, y - 2, LEAF[2]); };

export const ITEM_PAINTERS = {
    hoe(p, r) { handle(p, 3, 14, 11, 4); p.rect(9, 2, 5, 2, METAL[1]); p.rect(12, 4, 2, 2, METAL[0]); p.set(9, 2, METAL[3]); },
    can(p, r) { p.rect(3, 6, 8, 7, r[1]); p.rect(3, 6, 8, 1, r[2]); p.rect(3, 12, 8, 1, r[0]); p.line(11, 8, 14, 5, r[1]); p.set(14, 4, r[2]); p.rect(5, 4, 4, 1, r[0]); p.set(4, 5, r[0]); p.set(9, 5, r[0]); },
    axe(p, r) { handle(p, 4, 14, 10, 3); p.rect(9, 2, 4, 5, METAL[1]); p.vline(13, 2, 6, METAL[0]); p.vline(9, 2, 6, METAL[3]); },
    pick(p, r) { handle(p, 7, 14, 8, 4); p.line(2, 5, 7, 2, METAL[1]); p.line(8, 2, 13, 5, METAL[1]); p.line(2, 6, 7, 3, METAL[0]); p.line(8, 3, 13, 6, METAL[0]); p.set(7, 2, METAL[3]); },
    scythe(p, r) { handle(p, 5, 15, 7, 3); p.line(7, 3, 13, 4, METAL[1]); p.line(13, 4, 14, 7, METAL[1]); p.line(8, 4, 12, 5, METAL[3]); },
    sickle(p, r) { handle(p, 3, 14, 6, 10); for (let a = 0; a < 3.2; a += 0.12) p.set(9 + Math.cos(a + 2.4) * 5, 7 - Math.sin(a + 2.4) * 5, METAL[a < 1.6 ? 3 : 1]); },
    seed(p, r) { p.ellipse(8, 9.5, 5, 5.5, PAPER[1], (x, y) => (y < -0.4 ? PAPER[2] : x > 0.5 ? PAPER[0] : PAPER[1])); p.rect(5, 3, 6, 2, PAPER[0]); p.circle(8, 10, 2.2, r[1]); p.set(7, 9, r[3]); },
    root(p, r) { p.ellipse(8, 10, 4.5, 4, r[1], (x, y) => (x < -0.3 && y < 0 ? r[3] : y > 0.5 ? r[0] : r[1])); p.line(8, 14, 8, 15, r[0]); leafTop(p, 8, 5); leafTop(p, 6, 5); leafTop(p, 10, 5); },
    round(p, r) { p.circle(8, 9, 5.5, r[1], (x, y) => (x < -0.3 && y < -0.2 ? r[3] : x + y > 0.8 ? r[0] : r[1])); leafTop(p, 8, 4); },
    berry(p, r) { for (const [x, y] of [[6, 10], [10, 10], [8, 7]]) p.circle(x, y, 2.8, r[1], (dx, dy) => (dx < -0.2 && dy < -0.2 ? r[3] : dx + dy > 0.7 ? r[0] : r[1])); p.set(8, 4, LEAF[1]); p.set(7, 3, LEAF[2]); p.set(9, 3, LEAF[1]); },
    leafy(p, r) { p.circle(8, 10, 5.5, LEAF[1], (x, y) => (y > 0.3 ? LEAF[0] : LEAF[1])); p.circle(8, 8, 3.5, r[2], (x, y) => ((x * 7 + y * 5) % 1 > 0.5 ? r[3] : r[2])); },
    grain(p, r) { for (let k = 0; k < 3; k++) { const x = 5 + k * 3; p.vline(x, 6, 14, LEAF[0]); for (let y = 2; y < 8; y += 2) { p.set(x - 1, y + k % 2, r[2]); p.set(x, y + k % 2, r[1]); p.set(x + 1, y + 1 + k % 2, r[1]); } } },
    corn(p, r) { p.ellipse(8, 8, 3, 6, r[1], (x, y) => ((Math.round((y + 1) * 6) + Math.round((x + 1) * 3)) % 2 ? r[2] : r[1])); p.line(4, 14, 7, 5, LEAF[1]); p.line(12, 14, 9, 5, LEAF[0]); },
    melon(p, r) { p.circle(8, 9, 6, r[1], (x, y) => (Math.abs(Math.sin(x * 5)) > 0.8 ? r[0] : x < -0.3 && y < -0.3 ? r[3] : r[1])); p.set(8, 2, WOOD[0]); },
    pumpkin(p, r) { p.ellipse(8, 10, 6.5, 4.8, r[1], (x, y) => (Math.abs(x) > 0.35 && Math.abs(x) < 0.45 ? r[0] : x < -0.5 && y < 0 ? r[3] : r[1])); p.rect(7, 3, 2, 3, LEAF[0]); },
    star(p, r) { for (let a = 0; a < 5; a++) { const t = -Math.PI / 2 + a * Math.PI * 2 / 5; p.line(8, 8, 8 + Math.cos(t) * 6.5, 8 + Math.sin(t) * 6.5, r[2]); } p.circle(8, 8, 3, r[3]); p.set(8, 8, WHITE); },
    egg(p, r) { p.ellipse(8, 9, 4.2, 5.5, r[2], (x, y) => (x < -0.3 && y < -0.3 ? r[3] : x + y > 0.7 ? r[1] : r[2])); },
    feather(p, r) { p.line(4, 14, 12, 2, r[0]); for (let k = 0; k < 9; k++) { p.line(5 + k, 12 - k * 1.2, 3 + k, 10 - k * 1.2, r[k % 2 ? 1 : 2]); p.line(5 + k, 12 - k * 1.2, 8 + k, 12 - k * 1.2, r[k % 2 ? 2 : 3]); } },
    milk(p, r) { p.rect(5, 5, 6, 10, WHITE); p.rect(5, 5, 1, 10, [220, 220, 230, 255]); p.rect(6, 2, 4, 3, WHITE); p.rect(5, 8, 6, 3, r[1]); },
    wool(p, r) { for (const [x, y] of [[5, 9], [11, 9], [8, 7], [8, 11], [6, 12], [10, 12]]) p.circle(x, y, 3, r[2], (dx, dy) => (dy < -0.2 ? r[3] : r[2])); },
    hay(p, r) { p.rect(3, 6, 10, 8, r[1]); for (let x = 3; x < 13; x += 2) p.vline(x, 6, 13, r[2]); p.hline(3, 12, 9, WOOD[0]); p.hline(3, 12, 10, WOOD[1]); },
    mushroom(p, r) { p.rect(6, 9, 4, 5, PAPER[2]); p.ellipse(8, 8, 6, 4, r[1], (x, y) => (y > 0.5 ? r[0] : x < -0.3 && y < 0 ? r[3] : r[1])); p.set(6, 6, WHITE); p.set(10, 7, WHITE); },
    herb(p, r) { p.line(8, 15, 8, 5, LEAF[0]); for (let k = 0; k < 4; k++) { const y = 12 - k * 2.5; p.ellipse(8 - 2.5, y, 2.4, 1.2, r[1 + (k % 2)]); p.ellipse(8 + 2.5, y - 1, 2.4, 1.2, r[1 + ((k + 1) % 2)]); } },
    flower(p, r) { p.line(8, 15, 8, 8, LEAF[0]); p.set(7, 12, LEAF[1]); p.set(9, 11, LEAF[1]); for (let a = 0; a < 5; a++) { const t = a * Math.PI * 2 / 5; p.circle(8 + Math.cos(t) * 3, 6 + Math.sin(t) * 3, 2, r[2]); } p.circle(8, 6, 1.6, hsl(50, 0.8, 0.55)); },
    nut(p, r) { p.ellipse(8, 10, 4.5, 4.5, r[1], (x, y) => (x < -0.3 && y < -0.3 ? r[2] : r[1])); p.ellipse(8, 6.5, 4.5, 2, r[0]); p.set(8, 3, r[0]); },
    honey(p, r) { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const cx = 4 + x * 4 + (y % 2) * 2, cy = 5 + y * 3.5; p.circle(cx, cy, 2, r[1], (dx, dy) => (dy < -0.3 ? r[3] : r[1])); } },
    shell(p, r) { p.ellipse(8, 10, 6, 4.5, r[2], (x, y) => (Math.abs(Math.sin(Math.atan2(y, x) * 4)) > 0.85 ? r[0] : y < 0 ? r[3] : r[2])); p.rect(7, 13, 3, 2, r[1]); },
    pepper(p, r) { p.ellipse(8, 10, 3, 5.5, r[1], (x, y) => (x < -0.2 ? r[3] : r[1])); p.rect(7, 3, 2, 2, LEAF[0]); p.set(9, 2, LEAF[1]); },
    crystal(p, r) { for (const [x, h] of [[5, 8], [8, 11], [11, 7]]) { p.rect(x - 1, 15 - h, 3, h, r[1]); p.vline(x - 1, 15 - h, 14, r[3]); p.set(x, 14 - h, r[2]); } },
    wood(p, r) { for (const [x, y] of [[3, 9], [9, 9], [6, 5]]) { p.rect(x, y, 5, 4, r[1]); p.hline(x, x + 4, y, r[2]); p.circle(x + 4.5, y + 2, 1.9, shade(r[2], 0.3)); p.set(x + 4, y + 2, r[0]); } },
    stone(p, r) { p.ellipse(8, 10, 6, 4.5, r[1], (x, y) => (x < -0.3 && y < -0.2 ? r[3] : y > 0.4 ? r[0] : r[1])); p.set(10, 9, r[0]); p.set(6, 11, r[0]); },
    clay(p, r) { p.ellipse(8, 10, 6, 4, hsl(18, 0.45, 0.5), (x, y) => (y < -0.2 ? hsl(18, 0.45, 0.62) : hsl(18, 0.45, 0.48))); },
    coal(p, r) { p.ellipse(8, 10, 5.5, 4.5, [50, 48, 56, 255], (x, y) => (x < -0.2 && y < -0.2 ? [90, 88, 100, 255] : [40, 38, 46, 255])); p.set(6, 9, [140, 140, 160, 255]); },
    fiber(p, r) { for (let k = 0; k < 5; k++) p.line(4 + k * 2, 14, 6 + k, 3, r[1 + (k % 2)]); p.hline(5, 11, 10, WOOD[1]); },
    drop(p, r) { p.circle(8, 10, 4, r[1], (x, y) => (x < -0.2 && y < -0.2 ? r[3] : r[1])); p.line(8, 3, 6, 8, r[1]); p.line(8, 3, 10, 8, r[1]); p.set(8, 5, r[1]); p.rect(7, 5, 3, 3, r[1]); },
    ore(p, r) { const g = ramp(30, 0.1, 0.45); p.ellipse(8, 10, 6, 4.5, g[1], (x, y) => (x < -0.3 && y < -0.2 ? g[2] : y > 0.4 ? g[0] : g[1])); for (const [x, y] of [[6, 9], [9, 11], [10, 8], [5, 11]]) { p.set(x, y, r[2]); p.set(x + 1, y, r[1]); } },
    bar(p, r) { for (let y = 0; y < 5; y++) p.hline(3 + y, 12 - y + 1, 12 - y, y === 4 ? r[3] : y > 2 ? r[2] : r[1]); p.hline(3, 13, 12, r[0]); },
    gem(p, r, it) { const L = it.dark ? -0.2 : it.pale ? 0.2 : 0; const g = ramp(r.h, 0.6, 0.5 + L); p.line(4, 7, 8, 3, g[2]); p.line(8, 3, 12, 7, g[1]); for (let y = 7; y < 14; y++) p.hline(4 + (y - 7) * 4 / 7, 12 - (y - 7) * 4 / 7, y, y < 9 ? g[2] : g[1]); for (let y = 4; y < 7; y++) p.hline(8 - (y - 3), 8 + (y - 3), y, g[3]); p.set(6, 6, WHITE); },
    gel(p, r) { p.ellipse(8, 11, 6, 4, r[1], (x, y) => (x < -0.3 && y < -0.2 ? r[3] : r[1])); p.circle(8, 8, 3, r[1]); p.set(7, 7, WHITE); },
    fur(p, r) { for (let k = 0; k < 14; k++) p.line(3 + k % 7 * 1.6, 13 - (k > 6 ? 2 : 0), 4 + k % 7 * 1.6 + 1, 5 + (k > 6 ? 2 : 0), r[(k % 3)]); },
    dust(p, r) { for (let k = 0; k < 16; k++) { const a = k * 2.4, d = 1 + (k % 5); p.set(8 + Math.cos(a) * d, 8 + Math.sin(a) * d, r[k % 2 ? 2 : 3]); } p.circle(8, 8, 1.5, WHITE); },
    gear(p, r) { const g = ramp(40, 0.3, 0.45); p.circle(8, 8, 5, g[1]); for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; p.rect(8 + Math.cos(t) * 5.5 - 1, 8 + Math.sin(t) * 5.5 - 1, 2, 2, g[1]); } p.circle(8, 8, 2, [0, 0, 0, 0]); for (let y = 6; y < 11; y++) for (let x = 6; x < 11; x++) if ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 3) p.d[(y * 16 + x) * 4 + 3] = 0; },
    bone(p, r) { p.line(4, 12, 12, 4, WHITE); p.line(4, 11, 11, 4, [230, 225, 210, 255]); for (const [x, y] of [[3, 12], [4, 13], [12, 3], [13, 4]]) p.circle(x, y, 1.4, WHITE); },
    plank(p, r) { for (let k = 0; k < 3; k++) { p.rect(2, 4 + k * 3.5, 12, 3, r[1 + (k % 2)]); p.hline(2, 13, 4 + k * 3.5, r[2]); } p.set(4, 5, r[0]); p.set(11, 9, r[0]); },
    brick(p, r) { const b = ramp(8, 0.55, 0.45); for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) { const bx = 2 + x * 6 + (y % 2) * 3, by = 4 + y * 3.5; p.rect(bx, by, 5, 3, b[1]); p.hline(bx, bx + 4, by, b[2]); } },
    rope(p, r) { for (let a = 0; a < 6.3 * 2; a += 0.3) { const rr = 2 + a * 0.35; p.set(8 + Math.cos(a) * rr, 8 + Math.sin(a) * rr * 0.8, a % 1 > 0.5 ? r[1] : r[2]); } },
    cloth(p, r) { p.rect(3, 4, 10, 9, r[1]); for (let y = 4; y < 13; y += 2) p.hline(3, 12, y, r[2]); p.vline(12, 4, 12, r[0]); p.rect(3, 12, 10, 1, r[0]); },
    sack(p, r, it) { const s = it.pale ? ramp(40, 0.1, 0.85) : ramp(40, 0.35, 0.72); p.ellipse(8, 10, 5.5, 5, s[1], (x, y) => (x < -0.3 && y < -0.2 ? s[3] : y > 0.5 ? s[0] : s[1])); p.rect(6, 3, 4, 3, s[1]); p.hline(5, 10, 5, WOOD[0]); },
    cheese(p, r) { for (let y = 0; y < 7; y++) p.hline(3, 3 + (y + 1) * 1.5, 12 - y, r[y < 1 ? 0 : 2]); p.hline(3, 13, 12, r[1]); p.set(6, 10, r[1]); p.set(5, 8, r[1]); },
    jar(p, r) { p.rect(4, 5, 8, 9, [220, 235, 240, 160]); p.rect(5, 7, 6, 6, r[1]); p.rect(5, 7, 6, 1, r[2]); p.rect(4, 3, 8, 2, WOOD[1]); p.set(5, 8, WHITE); },
    potion(p, r) { p.circle(8, 10, 4.5, r[1], (x, y) => (x < -0.3 && y < -0.3 ? r[3] : y < -0.4 ? [220, 235, 240, 180] : r[1])); p.rect(7, 3, 3, 4, [220, 235, 240, 200]); p.rect(6, 2, 5, 2, WOOD[1]); p.set(6, 8, WHITE); },
    sword(p, r) { p.line(4, 11, 12, 3, r[2]); p.line(5, 11, 13, 3, r[1]); p.line(4, 10, 12, 2, r[3]); p.line(3, 9, 7, 13, METAL[0]); p.line(2, 14, 4, 12, WOOD[1]); p.set(2, 14, WOOD[0]); },
    armor(p, r) { p.rect(4, 4, 8, 9, r[1]); p.rect(2, 4, 3, 4, r[1]); p.rect(11, 4, 3, 4, r[1]); p.rect(6, 4, 4, 2, [0, 0, 0, 0]); for (let x = 6; x < 10; x++) for (let y = 4; y < 6; y++) p.d[(y * 16 + x) * 4 + 3] = 0; p.vline(4, 6, 12, r[2]); p.hline(4, 11, 12, r[0]); p.hline(5, 10, 8, r[2]); },
    ring(p, r) { const g = ramp(48, 0.7, 0.55); for (let a = 0; a < 6.3; a += 0.2) p.set(8 + Math.cos(a) * 4.5, 10 + Math.sin(a) * 3, a > 3.3 ? g[1] : g[2]); p.circle(8, 6, 2.2, r[2]); p.set(7, 5, WHITE); },
    gauntlet(p, r) { p.rect(4, 6, 8, 7, r[1]); p.rect(4, 3, 2, 4, r[2]); p.rect(6, 2, 2, 5, r[2]); p.rect(8, 2, 2, 5, r[2]); p.rect(10, 3, 2, 4, r[2]); p.rect(3, 12, 10, 3, METAL[1]); },
    lily(p, r) { p.ellipse(8, 10, 6.5, 4, LEAF[1], (x, y) => (x > 0.1 && y < -0.1 && x < 0.5 ? [0, 0, 0, 0] : LEAF[1])); for (let a = 0; a < 5; a++) { const t = a * 1.25; p.circle(8 + Math.cos(t) * 2, 7 + Math.sin(t) * 1.5, 1.6, hsl(330, 0.6, 0.8)); } p.set(8, 7, hsl(50, 0.9, 0.6)); },
    lantern(p, r) { p.rect(5, 5, 6, 8, [255, 220, 120, 255]); p.rect(6, 6, 4, 6, [255, 245, 190, 255]); p.rect(4, 4, 8, 1, METAL[0]); p.rect(4, 13, 8, 1, METAL[0]); p.vline(4, 5, 12, METAL[0]); p.vline(11, 5, 12, METAL[0]); p.line(6, 3, 8, 1, METAL[0]); p.line(10, 3, 8, 1, METAL[0]); },
    shard(p, r) { for (let y = 2; y < 15; y++) { const w = y < 8 ? (y - 2) * 0.7 : (15 - y) * 0.55; p.hline(8 - w, 8 + w, y, y < 7 ? r[3] : r[2]); } p.vline(8, 3, 13, WHITE); p.set(6, 7, r[1]); p.set(10, 10, r[1]); },
    key(p, r) { const g = ramp(45, 0.7, 0.55); p.circle(5, 6, 3, g[2]); p.circle(5, 6, 1.2, [0, 0, 0, 0]); p.d[(6 * 16 + 5) * 4 + 3] = 0; p.line(7, 8, 13, 14, g[1]); p.set(12, 11, g[1]); p.set(11, 12, g[1]); p.set(13, 12, g[1]); },
    bag(p, r) { p.ellipse(8, 10, 6, 5, r[1], (x, y) => (x < -0.3 && y < -0.2 ? r[2] : r[1])); p.rect(5, 3, 6, 2, r[0]); p.rect(6, 8, 4, 3, r[2]); },
    locket(p, r) { const g = ramp(45, 0.7, 0.55); p.line(8, 1, 4, 6, g[0]); p.line(8, 1, 12, 6, g[0]); p.circle(8, 10, 4, g[2], (x, y) => (x < -0.3 && y < -0.3 ? g[3] : g[2])); p.circle(8, 10, 1.5, r[1]); },
    sprinkler(p, r) { p.rect(5, 9, 6, 5, r[1]); p.rect(5, 9, 6, 1, r[2]); p.rect(7, 5, 2, 4, METAL[1]); p.set(4, 4, [120, 190, 255, 255]); p.set(11, 4, [120, 190, 255, 255]); p.set(8, 3, [120, 190, 255, 255]); },
    furnace(p, r) { const s = ramp(20, 0.25, 0.5); p.rect(3, 4, 10, 10, s[1]); p.rect(3, 4, 10, 1, s[2]); p.rect(6, 8, 4, 4, [255, 140, 40, 255]); p.rect(7, 9, 2, 2, [255, 230, 120, 255]); p.rect(9, 1, 2, 3, s[0]); },
    chest(p, r) { p.rect(2, 6, 12, 8, WOOD[1]); p.rect(2, 6, 12, 3, WOOD[2]); p.hline(2, 13, 9, WOOD[0]); p.rect(7, 8, 2, 3, hsl(45, 0.7, 0.55)); },
    lamp(p, r) { p.vline(8, 5, 14, [60, 60, 70, 255]); p.rect(6, 14, 5, 1, [60, 60, 70, 255]); p.rect(6, 2, 5, 4, [255, 230, 140, 255]); p.rect(5, 1, 7, 1, [60, 60, 70, 255]); },
    bench(p, r) { p.rect(2, 6, 12, 2, WOOD[2]); p.rect(2, 9, 12, 2, WOOD[1]); p.vline(3, 11, 14, WOOD[0]); p.vline(12, 11, 14, WOOD[0]); },
    planter(p, r) { p.rect(3, 10, 10, 4, WOOD[1]); p.hline(3, 12, 10, WOOD[2]); for (let k = 0; k < 4; k++) p.circle(4.5 + k * 2.3, 8, 1.6, hsl(r.h + k * 40, 0.7, 0.65)); },
    fence(p, r) { for (const x of [3, 8, 13]) p.rect(x - 1, 4, 2, 10, WOOD[2]); p.hline(2, 14, 7, WOOD[1]); p.hline(2, 14, 11, WOOD[1]); },
    statue(p, r) { const s = ramp(220, 0.05, 0.7); p.rect(4, 12, 8, 3, s[0]); p.rect(6, 6, 4, 6, s[1]); p.circle(8, 4, 2.2, s[2]); p.set(7, 3, WHITE); },
    beehive(p, r) { const s = ramp(40, 0.6, 0.55); for (let y = 0; y < 4; y++) p.rect(4 + (y % 2), 4 + y * 2.5, 8 - (y % 2) * 2, 2.5, s[y % 2 ? 1 : 2]); p.rect(7, 12, 2, 2, DARK); p.rect(3, 14, 10, 1, WOOD[0]); },
    plate(p, r) { p.ellipse(8, 11, 7, 3.2, [235, 235, 240, 255]); p.ellipse(8, 10.5, 5, 2, [210, 210, 220, 255]); p.ellipse(8, 9, 3.5, 2.5, r[1], (x, y) => (x < -0.2 && y < -0.2 ? r[3] : r[1])); },
    bowl(p, r) { p.ellipse(8, 8, 6, 2.2, r[1], (x, y) => (x < -0.4 ? r[3] : r[1])); for (let y = 8; y < 13; y++) p.hline(2 + (y - 8), 14 - (y - 8), y, y < 9 ? [240, 238, 230, 255] : [215, 210, 200, 255]); p.set(6, 7, r[3]); },
    cup(p, r) { p.rect(4, 6, 7, 7, [240, 238, 230, 255]); p.rect(4, 6, 7, 1, r[1]); p.rect(5, 7, 5, 1, r[2]); p.vline(12, 8, 10, [240, 238, 230, 255]); p.set(11, 8, [240, 238, 230, 255]); p.set(11, 10, [240, 238, 230, 255]); p.set(6, 3, [255, 255, 255, 120]); p.set(8, 4, [255, 255, 255, 120]); },
    bread(p, r) { const b = ramp(32, 0.6, 0.55); p.ellipse(8, 10, 6.5, 4, b[1], (x, y) => (y < -0.2 ? b[2] : b[1])); p.line(5, 9, 6, 8, b[0]); p.line(8, 9, 9, 8, b[0]); p.line(11, 9, 12, 8, b[0]); if (r.h !== 35) p.ellipse(8, 7, 4, 1.5, r[2]); },
    pie(p, r) { const b = ramp(35, 0.55, 0.6); p.ellipse(8, 10, 7, 3.5, b[1]); p.ellipse(8, 9, 6, 2.6, r[1], (x, y) => (x < -0.3 ? r[2] : r[1])); p.line(3, 9, 13, 9, b[2]); p.line(8, 6, 8, 12, b[2]); },
    skewer(p, r) { p.line(2, 14, 14, 2, WOOD[1]); for (let k = 0; k < 3; k++) p.circle(5 + k * 3, 11 - k * 3, 2, r[1 + (k % 2)]); },
    cake(p, r) { p.rect(3, 8, 10, 6, [245, 235, 220, 255]); p.rect(3, 7, 10, 2, r[2]); p.set(4, 9, r[1]); p.set(8, 9, r[1]); p.set(12, 9, r[1]); p.rect(7, 3, 2, 4, [250, 250, 250, 255]); p.set(8, 2, [255, 200, 80, 255]); },
    scroll(p, r) { p.rect(4, 3, 8, 10, PAPER[2]); p.rect(3, 2, 10, 2, PAPER[1]); p.rect(3, 12, 10, 2, PAPER[1]); for (let y = 5; y < 11; y += 2) p.hline(5, 10, y, PAPER[0]); p.circle(11, 12, 1.8, r[1]); },
};

export function paintItem(it) {
    const p = new Pix(16, 16);
    const r = ramp(it.hue ?? 0, 0.6, 0.5); r.h = it.hue ?? 0;
    const fn = ITEM_PAINTERS[it.ic] ?? ITEM_PAINTERS.stone;
    fn(p, r, it);
    p.outline(OUTLINE);
    return p;
}
