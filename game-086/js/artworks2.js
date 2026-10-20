/**
 * artworks2.js — Book Two (The Far Shore) and the Postcards bonus pages, drawn with pixelart.js.
 * Pure data: no DOM. artworks.js gathers these into ARTWORKS. Judge art in dev/gallery.html.
 */
import { defineArt } from './pixelart.js';

const STAR = '#fff6dc';

/** A wiggly one-pixel tentacle or strand hanging down from (x0, y0). */
const strand = (x0, y0, len, phase = 0) => Array.from({ length: len }, (_, k) => [x0 + (((k + phase) >> 1) & 1), y0 + k]);

/* ───────────────────────── Chapter 6 · Coral Lanterns ───────────────────────── */

export const jellies = defineArt({
    id: 'jellies', title: 'Lantern Jellies', w: 24, h: 24,
    blurb: 'They light the reef at night, bobbing like paper lanterns.',
    colors: {
        d: ['#0f2a4a', 'Deep Sea'], s: ['#1f5b7a', 'Shallows'], j: ['#ff9ad5', 'Jelly Pink'], J: ['#c45aa8', 'Jelly Plum'],
        t: ['#ffd6f0', 'Tentacle'], y: ['#ffe58a', 'Glow'], b: ['#7ff0e0', 'Bubble'],
        a: ['#d8b878', 'Sand'], c: ['#ff7a5a', 'Coral'],
    },
    draw(P) {
        P.fill('d');
        P.poly('s', [[3, 0], [8, 0], [6, 24], [0, 24], [0, 10]]);
        P.poly('s', [[14, 0], [17, 0], [21, 24], [16, 24]]);
        P.scatter('b', 6, 61, ['d']);
        // sea floor and coral
        P.ellipse('a', 12, 28, 16, 5);
        P.line('c', 2, 23, 2, 19); P.line('c', 2, 21, 4, 19); P.line('c', 1, 20, 0, 19);
        P.line('c', 21, 23, 21, 20); P.line('c', 21, 21, 23, 19);
        // the jellies: a flat-bottomed bell, a rim, a glow and tentacles
        const jelly = (cx, cy, rx, ry, rim, tent) => {
            P.within(0, 0, 24, cy, () => P.ellipse('j', cx, cy, rx, ry));
            P.edge('J', 'j', -1, 0);
            P.rect('J', rim[0], cy, rim[1], 1);
            for (const [x, len, ph] of tent) P.dots('t', strand(x, cy + 1, len, ph));
        };
        jelly(8.5, 9, 4.6, 5.4, [4, 9], [[4, 6, 0], [6, 8, 1], [9, 7, 0], [11, 5, 1]]);
        P.ellipse('y', 9, 6.5, 1.6, 1.4);
        jelly(17.5, 15, 3.8, 4.2, [14, 8], [[14, 5, 1], [16, 7, 0], [19, 6, 1]]);
        P.dots('y', [[18, 13], [17, 13], [18, 12]]);
        jelly(19.5, 5, 2.6, 2.8, [17, 6], [[17, 4, 0], [20, 3, 1]]);
        P.dots('y', [[20, 3]]);
        // bubbles
        P.dots('b', [[1, 15], [2, 13], [1, 11], [12, 19], [13, 21], [12, 16], [23, 9], [22, 11], [6, 1]]);
    },
});

export const pip = defineArt({
    id: 'pip', title: 'Pip the Pufferfish', w: 28, h: 28,
    blurb: 'The reef\'s lantern-keeper. Gold, round, and finally un-puffed.',
    colors: {
        d: ['#123a5c', 'Deep Water'], s: ['#2a6f8f', 'Current'], y: ['#ffd34f', 'Puffer Gold'], Y: ['#d1842a', 'Amber'],
        c: ['#fff3c4', 'Belly'], k: ['#1a1424', 'Ink'], p: ['#ff7fa8', 'Cheek'],
        l: ['#7ff0e0', 'Lantern Glow'], g: ['#5fbf74', 'Seaweed'], G: ['#2f7d4a', 'Kelp'], a: ['#b89a6a', 'Sand'],
    },
    draw(P) {
        P.fill('d');
        P.poly('s', [[16, 0], [22, 0], [28, 14], [28, 22]]);
        P.poly('s', [[0, 4], [5, 0], [9, 0], [0, 14]]);
        // sand and seaweed
        P.ellipse('a', 14, 31, 18, 5);
        for (const [x, top, ph] of [[2, 14, 0], [4, 18, 1], [24, 16, 1], [26, 20, 0]]) {
            P.dots('g', strand(x, top, 28 - top, ph));
            P.dots('G', strand(x + 1, top + 2, 26 - top, ph));
        }
        // spines and tail fin first, so the body sits on top
        for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            P.dots('Y', [[Math.floor(14 + Math.cos(a) * 9.3), Math.floor(15.5 + Math.sin(a) * 9.3)]]);
        }
        P.poly('Y', [[23, 15.5], [27, 11.5], [26.4, 15.5], [27, 19.5]]);
        // body and belly
        P.circle('y', 14, 15.5, 8.2);
        P.clip(['y'], () => P.ellipse('c', 13.5, 20.5, 6.5, 4));
        P.edge('Y', 'y', 1, 1);
        // side fin
        P.poly('Y', [[18, 16], [21.5, 14], [21.5, 18.5]]);
        // face
        P.stamp(9, 11, ['kk...kk', 'kc...kc', 'kk...kk']);
        P.dots('p', [[8, 15], [9, 15], [17, 15], [18, 15]]);
        P.dots('k', [[12, 17], [13, 18], [14, 17]]);
        P.dots('Y', [[11, 8], [14, 7], [17, 8], [20, 11], [19, 21], [9, 22]]);
        // the lantern on its stalk
        P.line('Y', 14, 7, 14, 5); P.line('Y', 14, 5, 16, 3); P.line('Y', 16, 3, 18, 3);
        P.circle('l', 20, 3.5, 1.9);
        P.dots('c', [[20, 3]]);
        P.outline('k', ['y', 'Y', 'c', 'p']);
        // bubbles
        P.dots('l', [[5, 6], [6, 4], [5, 2], [24, 7], [25, 5]]);
    },
});

export const reef = defineArt({
    id: 'reef', title: 'Coral Lantern City', w: 36, h: 36,
    blurb: 'Shell houses, coral gardens, and a lantern on every door.',
    colors: {
        d: ['#0e2346', 'Abyss'], s: ['#1d4f7a', 'Sea'], S: ['#3a8aa8', 'Sunlit Water'], a: ['#e8cf98', 'Sand'],
        c: ['#ff7a6a', 'Coral'], C: ['#b8405a', 'Deep Coral'], h: ['#f4e6ff', 'Shell'], H: ['#a898cc', 'Shell Shade'],
        y: ['#ffd45a', 'Lantern'], g: ['#5fcf8a', 'Kelp'], p: ['#ff9ad5', 'Anemone'],
    },
    draw(P) {
        P.fill('s');
        P.rect('S', 0, 0, 36, 5);
        P.dots('S', [[1, 5], [4, 5], [8, 5], [13, 5], [17, 5], [22, 5], [26, 5], [31, 5], [34, 5], [6, 6], [20, 6], [29, 6]]);
        P.rect('d', 0, 22, 36, 14);
        P.dots('d', [[2, 21], [7, 21], [12, 21], [19, 21], [25, 21], [30, 21], [34, 21], [16, 20], [5, 20]]);
        // sunbeams
        P.poly('S', [[7, 0], [11, 0], [17, 21], [14, 21]]);
        P.poly('S', [[24, 0], [26, 0], [30, 18], [28, 18]]);
        // kelp forest behind
        for (const [x, top, ph] of [[20, 14, 0], [21, 17, 1], [33, 12, 1], [34, 16, 0], [14, 18, 1]]) P.dots('g', strand(x, top, 32 - top, ph));
        // sand
        P.ellipse('a', 18, 40, 26, 9);
        // a string of lanterns between the houses
        P.line('H', 4, 18, 13, 21);
        P.line('H', 13, 21, 25, 15);
        for (const [x, y] of [[6, 19], [10, 21], [16, 20], [20, 18], [23, 17]]) P.dots('y', [[x, y], [x, y + 1]]);
        // shell houses
        const dome = (cx, base, rx, ry) => {
            P.within(0, 0, 36, base, () => P.ellipse('h', cx, base, rx, ry));
        };
        dome(8, 32, 6.2, 7.4);
        dome(17, 33, 3.6, 4.2);
        P.poly('h', [[22.5, 32], [26.5, 10], [30.5, 32]]);
        P.edge('H', 'h', 1, 0);
        // ribs on the big dome, spiral bands on the tower
        P.clip(['h'], () => {
            P.line('H', 8, 25, 8, 31); P.line('H', 5, 26, 4, 31); P.line('H', 11, 26, 12, 31);
            for (let y = 14; y < 32; y += 4) P.line('H', 22, y + 3, 31, y - 1);
        });
        // doors and windows
        P.rect('d', 7, 29, 2, 3); P.dots('y', [[6, 27], [10, 27]]);
        P.rect('d', 26, 29, 2, 3); P.dots('y', [[26, 18], [27, 23], [25, 26]]);
        P.dots('d', [[17, 31], [17, 32]]); P.dots('y', [[16, 30]]);
        // coral
        P.line('c', 1, 33, 1, 25); P.line('c', 1, 28, 3, 26); P.line('c', 1, 30, 0, 28);
        P.line('C', 2, 33, 3, 30);
        P.line('c', 33, 34, 33, 27); P.line('c', 33, 29, 35, 27); P.line('c', 33, 31, 31, 28);
        P.line('C', 34, 34, 35, 31);
        P.line('C', 13, 34, 13, 31); P.line('C', 13, 32, 14, 30); P.line('C', 13, 32, 12, 31);
        // anemones on the sand
        P.stamp(19, 33, ['p.p.p', '.ppp.']);
        P.stamp(28, 34, ['p.p', 'ppp']);
        // little fish
        P.stamp(28, 6, ['pp.p', 'pppp', 'pp.p']);
        P.stamp(3, 9, ['c.cc', 'cccc', 'c.cc']);
        P.stamp(13, 12, ['y.yy', 'yyyy', 'y.yy']);
        // bubbles
        P.dots('h', [[18, 11], [19, 9], [18, 7], [32, 9], [31, 7], [2, 16], [3, 14]]);
    },
});

/* ───────────────────────── Chapter 7 · Emberpeak ───────────────────────── */

export const buns = defineArt({
    id: 'buns', title: 'Volcano Buns', w: 24, h: 24,
    blurb: 'Golden crust, cherry lava jam, still steaming from the mountain.',
    colors: {
        b: ['#3a1f2e', 'Hearth Dark'], B: ['#66333e', 'Hearth Brick'], m: ['#c4bfd4', 'Tin'], M: ['#6e6a86', 'Tin Shade'],
        u: ['#eaa85a', 'Bun'], U: ['#a8602c', 'Crust'], l: ['#ff4a3a', 'Lava Jam'], L: ['#ffd04a', 'Ember Glaze'],
        s: ['#f2e6e0', 'Steam'],
    },
    draw(P) {
        P.fill('b');
        for (let y = 0; y < 18; y += 3) {
            const off = (y / 3) % 2 ? 2 : 0;
            for (let x = -off; x < 24; x += 5) P.rect('B', x, y, 4, 2);
        }
        // tray
        P.rect('m', 0, 19, 24, 3);
        P.rect('M', 0, 21, 24, 1);
        P.rect('M', 0, 22, 24, 2);
        P.dots('m', [[3, 23], [11, 23], [19, 23]]);
        // buns, back two then the big one in front
        const bun = (x, base, hw, h) => {
            P.poly('u', [[x - hw, base], [x - 1.6, base - h], [x + 1.6, base - h], [x + hw, base]]);
            P.edge('U', 'u', 0, 1);
            P.edge('U', 'u', -1, 0);
            const top = Math.round(base - h);
            P.rect('l', Math.floor(x) - 1, top, 3, 1);
            P.dots('l', [[Math.floor(x) - 2, top + 1], [Math.floor(x) - 2, top + 2], [Math.floor(x) + 2, top + 1], [Math.floor(x) + 2, top + 2], [Math.floor(x) + 2, top + 3], [Math.floor(x), top + 1]]);
            P.dots('L', [[Math.floor(x), top]]);
        };
        bun(5.5, 19, 5, 7);
        bun(18.5, 19, 5, 7);
        bun(12, 20, 6, 9);
        P.dots('L', [[4, 16], [7, 17], [17, 16], [20, 17], [10, 18], [14, 17], [12, 15]]);
        // steam
        for (const [x, y, ph] of [[5, 6, 0], [12, 3, 1], [19, 6, 1]]) P.dots('s', strand(x, y, 5, ph));
    },
});

export const cinder = defineArt({
    id: 'cinder', title: 'Granny Cinder', w: 28, h: 28,
    blurb: 'Head baker of Emberpeak. Red as a coal and twice as cheerful.',
    colors: {
        b: ['#4a2a3e', 'Bakery Dark'], B: ['#8a4a48', 'Brick'], g: ['#ffb066', 'Oven Glow'], o: ['#ff6a3d', 'Salamander'],
        O: ['#b8402a', 'Deep Ember'], y: ['#ffe066', 'Spots'], w: ['#ffffff', 'Chef White'], W: ['#bdb4d6', 'Apron Shade'],
        k: ['#140a14', 'Ink'], p: ['#ff9ad0', 'Blush'], l: ['#d8984a', 'Loaf'], L: ['#9a5a1a', 'Loaf Crust'],
    },
    draw(P) {
        P.fill('b');
        for (let y = 1; y < 28; y += 3) {
            const off = ((y - 1) / 3) % 2 ? 2 : 0;
            for (let x = -off; x < 28; x += 5) P.rect('B', x, y, 4, 2);
        }
        // the oven mouth glowing behind her
        P.within(0, 0, 28, 20, () => P.ellipse('b', 23, 20, 5.5, 9));
        P.within(0, 0, 28, 20, () => P.ellipse('g', 23, 20, 4, 7.5));
        // tail
        P.poly('o', [[19, 25], [24, 25], [27, 21], [26, 25.5], [22, 27.5], [19, 27.5]]);
        // body and apron
        P.ellipse('o', 14, 23, 8, 6.5);
        P.clip(['o'], () => P.rect('w', 9, 18, 10, 10));
        P.edge('W', 'w', 1, 0);
        // head
        P.ellipse('o', 14, 11.5, 7.6, 5.6);
        // chef hat
        P.circle('w', 10.5, 3.5, 2.6); P.circle('w', 14, 2.6, 3); P.circle('w', 17.5, 3.5, 2.6);
        P.rect('w', 9, 4, 10, 3);
        P.rect('W', 9, 6, 10, 1);
        // eyes, smile, blush, spots
        P.dots('k', [[10, 9], [11, 9], [10, 10], [17, 9], [18, 9], [17, 10]]);
        P.dots('w', [[11, 10], [18, 10]]);
        P.dots('k', [[12, 13], [13, 14], [14, 14], [15, 14], [16, 13]]);
        P.dots('p', [[8, 12], [9, 12], [19, 12], [20, 12]]);
        P.dots('y', [[7, 9], [21, 10], [8, 21], [20, 21], [21, 24], [7, 25], [24, 23]]);
        // the loaf in her arms
        P.ellipse('l', 14, 19.5, 4.6, 2);
        P.edge('L', 'l', 0, 1);
        P.dots('L', [[12, 19], [14, 19], [16, 19]]);
        P.circle('o', 9.5, 19.5, 1.4);
        P.circle('o', 18.5, 19.5, 1.4);
        P.edge('O', 'o', 0, 1);
        P.outline('k', ['o', 'O', 'w', 'W', 'l', 'L', 'y', 'p']);
    },
});

export const emberpeak = defineArt({
    id: 'emberpeak', title: 'Emberpeak', w: 36, h: 36,
    blurb: 'A volcano with a bakery on every ledge. The whole mountain is an oven.',
    colors: {
        s: ['#2a2a6a', 'Dusk Blue'], S: ['#8a3a6a', 'Sunset Mauve'], o: ['#ff9a5a', 'Sunset Orange'], m: ['#6a4040', 'Rock'],
        M: ['#2a1814', 'Basalt'], l: ['#ff3a2a', 'Lava'], L: ['#ffc23a', 'Molten Gold'], h: ['#f2d8b0', 'Plaster'],
        r: ['#c05a9a', 'Roof Tile'], y: ['#fff27a', 'Window'], k: ['#a898b0', 'Smoke'], g: ['#4f8a4a', 'Moss'],
    },
    draw(P) {
        P.fill('s');
        P.rect('S', 0, 12, 36, 8);
        P.rect('o', 0, 20, 36, 16);
        P.dots('S', [[1, 11], [5, 11], [9, 11], [14, 11], [23, 11], [28, 11], [33, 11]]);
        P.dots('o', [[2, 19], [7, 19], [12, 19], [26, 19], [31, 19], [35, 19]]);
        P.dots('L', [[3, 3], [9, 6], [30, 4], [33, 9], [26, 2]]);
        // smoke rising from the crater
        P.circle('k', 18, 7.6, 2.4); P.circle('k', 15.5, 4.4, 2.6); P.circle('k', 19.5, 1.4, 2.8);
        // the mountain
        P.poly('m', [[2, 36], [14, 10], [22, 10], [34, 36]]);
        P.clip(['m'], () => P.poly('M', [[19, 10], [22, 10], [34, 36], [25, 36]]));
        P.rect('M', 14, 10, 8, 1);
        P.rect('l', 15, 10, 6, 1);
        // a lava river winding down into the village ovens
        P.line('l', 17, 11, 16, 15); P.line('l', 16, 15, 19, 20); P.line('l', 19, 20, 17, 25); P.line('l', 17, 25, 18, 28);
        P.dots('L', [[17, 12], [16, 14], [18, 18], [18, 22], [17, 26]]);
        // moss on the lower slopes
        P.clip(['m', 'M'], () => P.rect('g', 0, 33, 36, 3));
        P.dots('g', [[8, 30], [6, 32], [27, 31], [29, 32], [11, 28]]);
        // houses
        const house = (x, y, w, h) => {
            P.rect('h', x, y, w, h);
            P.poly('r', [[x - 1, y + 0.5], [x + w / 2, y - 2.6], [x + w + 1, y + 0.5]]);
            P.rect('M', x + Math.floor(w / 2), y + h - 2, 1, 2);
            P.dots('y', [[x + 1, y + 1], [x + w - 2, y + 1]]);
        };
        house(3, 29, 6, 5);
        house(26, 29, 7, 5);
        house(11, 22, 5, 4);
        house(21, 20, 4, 4);
        // bread ovens glowing where the lava meets the village
        P.within(0, 0, 36, 31, () => P.ellipse('h', 18, 31, 3, 2.6));
        P.within(0, 0, 36, 31, () => P.ellipse('L', 18, 31, 1.6, 1.6));
        P.rect('m', 15, 31, 7, 1);
    },
});

/* ───────────────────────── Chapter 8 · Frostbloom ───────────────────────── */

export const fox = defineArt({
    id: 'fox', title: 'Snow Fox', w: 28, h: 28,
    blurb: 'Curled up in a snowdrift, tail for a blanket, fast asleep.',
    colors: {
        n: ['#16224a', 'Polar Night'], N: ['#2c3f78', 'Night Blue'], a: ['#6ff0b8', 'Aurora Mint'], y: ['#ffe58a', 'Moon'],
        w: ['#ffffff', 'Snow'], W: ['#a8b8e0', 'Snow Shade'], o: ['#ff8a3d', 'Fox'], O: ['#b04e1f', 'Russet'],
        c: ['#ffd8a8', 'Cream'], p: ['#ff8fb8', 'Pink'],
    },
    draw(P) {
        P.fill('n');
        P.rect('N', 0, 0, 28, 9);
        P.poly('a', [[0, 6], [7, 3], [15, 6], [28, 2], [28, 4], [15, 8.5], [7, 5.4], [0, 8.4]]);
        P.circle('y', 22, 13, 2.5);
        P.scatter('y', 7, 88, ['n', 'N']);
        // snow
        P.ellipse('w', 14, 34, 21, 11);
        P.edge('W', 'w', 0, -1);
        P.dots('W', [[3, 26], [9, 25], [20, 27], [25, 25]]);
        // body, then the tail curled round the front
        P.ellipse('o', 14, 19.6, 8, 4.4);
        P.ellipse('o', 12, 22.2, 7.4, 2.4);
        P.clip(['o'], () => P.ellipse('c', 5.2, 22.2, 2.6, 2.6));
        P.edge('O', 'o', 0, 1);
        P.line('O', 9, 20, 17, 20);
        // head resting on the tail
        P.circle('o', 20.5, 17.6, 3.6);
        P.poly('o', [[17, 15], [17.5, 10.5], [20.4, 14]]);
        P.poly('o', [[21, 14], [23.8, 10.5], [24, 15.5]]);
        P.dots('p', [[18, 13], [23, 13]]);
        P.ellipse('c', 22.4, 19.6, 2.6, 1.5);
        P.dots('n', [[24, 19], [18, 17], [19, 17], [21, 17], [22, 17]]);
        P.dots('p', [[17, 19]]);
        P.outline('n', ['o', 'O', 'c', 'p']);
        // falling snow
        for (const [x, y] of [[3, 12], [8, 15], [12, 10], [26, 18], [5, 18]]) P.twinkle('w', x, y, 0);
        P.dots('w', [[2, 15], [14, 13], [10, 7], [25, 8]]);
    },
});

export const nook = defineArt({
    id: 'nook', title: 'Nook the Yeti', w: 32, h: 32,
    blurb: 'Not scary at all. Blue-faced, red-scarfed, and very fond of cocoa.',
    colors: {
        s: ['#7aa6e8', 'Frost Sky'], S: ['#c4dcff', 'Pale Peaks'], w: ['#ffffff', 'Fur'], W: ['#b8acd8', 'Fur Shade'],
        f: ['#3a5ad0', 'Ice Blue'], k: ['#1a1a2e', 'Ink'], r: ['#ff4a5e', 'Scarf Red'], R: ['#ffd45a', 'Scarf Gold'],
        m: ['#ff9f43', 'Mug'], c: ['#6a3a2a', 'Cocoa'], p: ['#ff9ad8', 'Blush'], g: ['#3a8a5a', 'Pine'], G: ['#1f5a3e', 'Deep Pine'],
    },
    draw(P) {
        P.fill('s');
        P.poly('S', [[0, 21], [6, 12], [11, 17], [18, 7], [25, 16], [32, 10], [32, 24], [0, 24]]);
        const pine = (x, y, h) => { P.poly('g', [[x - 2.6, y], [x, y - h], [x + 2.6, y]]); };
        pine(3, 26, 9); pine(28.5, 26, 10); pine(25, 25, 6);
        P.edge('G', 'g', 1, 0);
        P.rect('G', 3, 26, 1, 2); P.rect('G', 28, 26, 1, 2);
        // snow
        P.ellipse('w', 16, 37, 22, 10);
        P.edge('W', 'w', 0, -1);
        // yeti
        P.ellipse('w', 16, 23.5, 9, 7.4);
        P.circle('w', 16, 12, 7);
        P.poly('w', [[12.5, 6.5], [15, 3], [16, 5.4], [18, 3.4], [19.5, 6.5]]);
        P.ellipse('w', 7.4, 23, 2.6, 4);
        P.ellipse('w', 24.6, 23, 2.6, 4);
        P.ellipse('W', 12, 30.4, 3, 1.6);
        P.ellipse('W', 20, 30.4, 3, 1.6);
        P.edge('W', 'w', 1, 0);
        // face
        P.ellipse('f', 16, 13, 4.6, 3.6);
        P.dots('k', [[14, 12], [18, 12], [15, 15], [16, 15], [17, 15], [14, 14], [18, 14]]);
        P.dots('w', [[14, 11], [18, 11]]);
        P.dots('p', [[11, 14], [21, 14], [12, 15], [20, 15]]);
        // scarf
        P.rect('r', 9, 18, 14, 2);
        for (let x = 10; x < 23; x += 3) P.rect('R', x, 18, 1, 2);
        P.rect('r', 19, 20, 3, 5);
        P.rect('R', 19, 22, 3, 1);
        // the mug of cocoa, held in both paws
        P.rect('m', 13, 22, 5, 5);
        P.rect('c', 13, 22, 5, 1);
        P.dots('m', [[18, 23], [19, 24], [18, 25]]);
        P.circle('W', 12, 24.5, 1.4);
        P.circle('W', 18.5, 26, 1.2);
        P.dots('S', [[15, 20], [14, 21]]);
        P.outline('k', ['w', 'W', 'f', 'r', 'R', 'm', 'c', 'p']);
    },
});

export const aurora = defineArt({
    id: 'aurora', title: 'Aurora Lights', w: 40, h: 40,
    blurb: 'Green, violet and pink, rippling like a curtain lifted by a warm breath.',
    colors: {
        n: ['#0c1430', 'Arctic Night'], N: ['#1e2c60', 'Deep Blue'], v: ['#c47bff', 'Aurora Violet'], a: ['#5ff0a8', 'Aurora Green'],
        A: ['#2a9a8a', 'Aurora Teal'], p: ['#ff8fd0', 'Aurora Pink'], k: ['#5a4a7e', 'Ridge'],
        w: ['#ffffff', 'Snow'], W: ['#9aaad8', 'Snow Shade'], y: ['#ffc94a', 'Igloo Glow'], g: ['#2f6a4a', 'Pine'],
    },
    draw(P) {
        P.fill('n');
        P.rect('N', 0, 0, 40, 5);
        P.dots('N', [[1, 5], [6, 5], [11, 5], [17, 5], [24, 5], [30, 5], [36, 5], [3, 6], [21, 6], [33, 6]]);
        P.scatter('W', 26, 40, ['n', 'N']);
        // the aurora: a rippling curtain, brightest at its lower hem
        for (let x = 0; x < 40; x++) {
            const t = Math.round(11 + 3.6 * Math.sin(x * 0.27) + 1.6 * Math.sin(x * 0.71 + 1));
            const len = 4 + ((x * 7) % 5);
            P.rect('v', x, t - len - 2, 1, 2);
            if (x % 2 === 0) P.rect('p', x, t - len - 4, 1, 2);
            P.rect('A', x, t - len, 1, len - 1);
            P.rect('a', x, t - 1, 1, 3);
        }
        // mountain ridge
        P.poly('k', [[0, 28], [6, 22], [11, 26], [17, 20], [24, 27], [30, 21], [40, 27], [40, 31], [0, 31]]);
        P.dots('W', [[17, 20], [16, 21], [18, 21], [30, 21], [29, 22], [31, 22], [6, 22]]);
        // snowfield
        P.poly('w', [[0, 30], [10, 28], [22, 30], [32, 28], [40, 29], [40, 40], [0, 40]]);
        P.edge('W', 'w', 0, -1);
        // pines
        for (const [x, y, h] of [[35, 33, 7], [38, 34, 5], [2, 32, 6]]) P.poly('g', [[x - 2.2, y], [x, y - h], [x + 2.2, y]]);
        // igloos with warm doors
        const igloo = (cx, base, r) => {
            P.within(0, 0, 40, base, () => P.ellipse('w', cx, base, r, r * 0.8));
            P.clip(['w'], () => {
                for (let y = base - 2; y > base - r * 0.8; y -= 2) P.within(0, y, 40, 1, () => P.ellipse('W', cx, base, r, r * 0.8));
            });
            P.within(0, 0, 40, base, () => P.ellipse('y', cx, base, r * 0.32, r * 0.48));
        };
        igloo(13, 37, 6.4);
        igloo(27, 36, 4.6);
        P.dots('y', [[12, 37], [13, 37], [14, 37], [11, 38], [15, 38], [27, 36], [26, 37], [28, 37]]);
        P.dots('W', [[5, 37], [21, 38], [33, 37], [37, 39]]);
    },
});

/* ───────────────────────── Chapter 9 · Clockwork Carnival ───────────────────────── */

export const balloon = defineArt({
    id: 'balloon', title: 'Hot-Air Balloon', w: 28, h: 28,
    blurb: 'The carnival\'s first wind-up of the morning: up, up and away.',
    colors: {
        s: ['#8ad0ff', 'Morning Sky'], S: ['#ffc8d8', 'Dawn Pink'], c: ['#ffffff', 'Cloud'], r: ['#ff4a6a', 'Stripe Red'],
        y: ['#ffd84a', 'Stripe Gold'], b: ['#3a5aef', 'Stripe Blue'], t: ['#c07a3a', 'Basket'], T: ['#6e4224', 'Wicker'],
        k: ['#4a3a5a', 'Rope'], g: ['#5fcf6a', 'Meadow'], G: ['#2f8a4a', 'Hedge'], f: ['#ff8a3a', 'Burner Flame'],
    },
    draw(P) {
        P.fill('s');
        P.rect('S', 0, 17, 28, 8);
        P.dots('S', [[1, 16], [5, 16], [10, 16], [16, 16], [21, 16], [26, 16], [3, 15], [24, 15]]);
        // clouds
        P.ellipse('c', 3.5, 5, 3.4, 1.4); P.ellipse('c', 5, 4, 2, 1.4);
        P.ellipse('c', 24, 14, 4, 1.4); P.ellipse('c', 22.5, 13, 2, 1.4);
        // balloon
        P.ellipse('r', 14, 9.5, 8, 8.4);
        P.poly('r', [[7.4, 13], [20.6, 13], [16.6, 20], [11.4, 20]]);
        P.clip(['r'], () => {
            P.ellipse('y', 14, 10, 5.2, 12);
            P.ellipse('b', 14, 10, 2.2, 12);
            P.rect('r', 0, 18, 28, 2);
        });
        P.dots('c', [[9, 5], [10, 4], [9, 6]]);
        // ropes, burner and basket
        P.line('k', 12, 20, 12, 22); P.line('k', 16, 20, 16, 22);
        P.dots('f', [[13, 20], [14, 20], [14, 21], [13, 21]]);
        P.rect('t', 11, 22, 6, 3);
        P.edge('T', 't', 0, 1);
        P.dots('T', [[12, 23], [14, 23], [16, 23]]);
        // meadow and tents
        P.rect('g', 0, 25, 28, 3);
        P.dots('G', [[0, 25], [1, 25], [5, 25], [6, 25], [20, 25], [21, 25], [27, 25], [9, 27], [18, 27]]);
        P.poly('y', [[1, 25.5], [4.5, 20.5], [8, 25.5]]);
        P.line('r', 4, 21, 4, 25); P.dots('r', [[4, 20]]);
        P.poly('b', [[20, 25.5], [23.5, 20.5], [27, 25.5]]);
        P.line('c', 23, 21, 23, 25); P.dots('y', [[23, 20]]);
    },
});

export const tock = defineArt({
    id: 'tock', title: 'Tock the Ringmaster', w: 32, h: 32,
    blurb: 'Brass polished, coat scarlet, moustache magnificent. TICK, TOCK.',
    colors: {
        b: ['#3a1f4a', 'Tent Plum'], B: ['#a83a7a', 'Tent Stripe'], y: ['#fff27a', 'Bulb'], m: ['#d8a040', 'Brass'],
        M: ['#8a5a2a', 'Bronze'], k: ['#1a1424', 'Ink'], h: ['#5a3aaa', 'Hat Violet'], r: ['#e8424a', 'Coat Red'],
        R: ['#7a1f3a', 'Coat Shade'], c: ['#fff3d6', 'Clock Face'], w: ['#7ff0e0', 'Eye Glow'], g: ['#3fae8a', 'Ring Green'],
    },
    draw(P) {
        P.fill('b');
        for (let x = 1; x < 32; x += 5) P.rect('B', x, 0, 2, 27);
        for (let x = 1; x < 32; x += 3) P.dots('y', [[x, 1]]);
        P.rect('b', 0, 2, 32, 1);
        // the circus ring
        P.ellipse('g', 16, 33, 20, 6);
        P.ellipse('R', 16, 34, 17, 5.4);
        // coat
        P.poly('r', [[10, 14], [22, 14], [25, 28], [7, 28]]);
        P.poly('R', [[16, 21], [25, 28], [19, 28]]);
        P.edge('R', 'r', 0, 1);
        // clock belly
        P.circle('c', 16, 19.5, 3.8);
        P.outline('M', ['c'], true);
        P.dots('k', [[16, 17], [16, 18], [16, 19], [17, 19], [18, 20]]);
        P.dots('M', [[16, 16], [19, 19], [16, 22], [13, 19]]);
        // head
        P.ellipse('m', 16, 10.5, 5.6, 4);
        P.edge('M', 'm', 1, 0);
        P.dots('w', [[13, 10], [14, 10], [18, 10], [19, 10]]);
        P.stamp(11, 12, ['kkk..kkk', '..kkkk..']);
        // top hat
        P.rect('h', 12, 1, 8, 5);
        P.rect('h', 10, 6, 12, 1);
        P.rect('r', 12, 5, 8, 1);
        P.edge('k', 'h', 1, 0);
        // arms: one on the cane, one waving
        P.line('M', 9, 15, 5, 20);
        P.line('M', 23, 15, 27, 11);
        P.circle('m', 27.5, 10.5, 1.4);
        P.line('k', 5, 20, 5, 29);
        P.circle('y', 5, 19.5, 1.2);
        // legs and the wind-up key
        P.rect('M', 12, 28, 2, 3);
        P.rect('M', 18, 28, 2, 3);
        P.rect('k', 11, 30, 3, 1);
        P.rect('k', 18, 30, 3, 1);
        P.rect('m', 25, 18, 3, 1);
        P.stamp(27, 16, ['mm', 'm.', 'm.', 'mm']);
        P.outline('k', ['m', 'M', 'r', 'R', 'c', 'w', 'h', 'y']);
    },
});

export const carousel = defineArt({
    id: 'carousel', title: 'The Carousel', w: 40, h: 40,
    blurb: 'Round and round, all night, to a tune like the inside of a music box.',
    colors: {
        n: ['#1e1640', 'Carnival Night'], y: ['#fff27a', 'Bulb'], r: ['#ff4a6a', 'Canopy Red'], c: ['#ffffff', 'Canopy White'],
        m: ['#d8a040', 'Brass Pole'], M: ['#8a5a2a', 'Bronze'], t: ['#6ff0d8', 'Mint Horse'], p: ['#ff9ad5', 'Pink Horse'],
        v: ['#a77bf2', 'Violet'], b: ['#3a5aef', 'Blue Horse'], k: ['#6a3aa0', 'Platform'], g: ['#2a6a5a', 'Grass'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('y', 14, 12, ['n']);
        // canopy cone with white wedges
        P.poly('r', [[2, 14], [20, 2], [38, 14]]);
        P.clip(['r'], () => {
            for (const x0 of [4, 11, 18, 25, 32]) P.poly('c', [[20, 2], [x0, 14], [x0 + 3.5, 14]]);
        });
        P.line('M', 20, 0, 20, 2);
        P.dots('v', [[21, 0], [22, 0], [21, 1]]);
        // scalloped valance with bulbs
        for (let x = 2, k = 0; x < 38; x += 4, k++) P.within(0, 14, 40, 3, () => P.ellipse(k % 2 ? 'c' : 'r', x + 2, 14, 2, 2.4));
        P.rect('v', 2, 14, 36, 1);
        for (let x = 3; x < 38; x += 4) P.dots('y', [[x, 14]]);
        // centre column and the dark inside
        P.rect('v', 17, 17, 6, 13);
        P.rect('M', 19, 17, 2, 13);
        P.dots('y', [[18, 19], [21, 22], [18, 25], [21, 28]]);
        // horses
        const horse = (x0, y0, c) => {
            P.stamp(x0, y0, [
                '.cc.....',
                'cccc....',
                'cc.ccccc',
                '...ccccc',
                '...c...c',
                '...c...c',
            ], { c });
            P.dots('r', [[x0 + 5, y0 + 2]]);
            P.dots('n', [[x0 + 1, y0 + 1]]);
        };
        horse(4, 21, 'p');
        horse(10, 24, 't');
        horse(24, 20, 'b');
        horse(30, 23, 'p');
        // brass poles through the horses
        for (const x of [8, 14, 27, 33]) P.rect('m', x, 17, 1, 13);
        // platform
        P.rect('k', 2, 30, 36, 3);
        P.rect('M', 2, 30, 36, 1);
        for (let x = 4; x < 38; x += 4) P.dots('y', [[x, 32]]);
        // ground
        P.rect('g', 0, 33, 40, 7);
        P.dots('t', [[3, 36], [9, 38], [16, 35], [24, 37], [31, 36], [37, 38], [12, 34]]);
        P.dots('y', [[6, 38], [20, 39], [34, 35]]);
    },
});

/* ───────────────────────── Chapter 10 · The Blank Page ───────────────────────── */

export const sketch = defineArt({
    id: 'sketch', title: 'The First Sketch', w: 32, h: 32,
    blurb: 'Pencil on paper, very old: the Prism, before anyone coloured her in.',
    colors: {
        p: ['#f6efdc', 'Paper'], P: ['#d8c8a4', 'Paper Shade'], b: ['#9ac8ec', 'Blue Line'], r: ['#ff7a8a', 'Margin Red'],
        l: ['#a8a6b8', 'Pencil Light'], L: ['#4d4c62', 'Graphite'], y: ['#ffcf4a', 'Pencil Yellow'], Y: ['#c8862a', 'Pencil Shade'],
        e: ['#ff9ad0', 'Eraser'], m: ['#7ad8b0', 'Ferrule'], k: ['#1a1820', 'Lead'], w: ['#e8a878', 'Wood'],
    },
    draw(P) {
        P.fill('p');
        for (let y = 3; y < 32; y += 4) P.rect('b', 0, y, 32, 1);
        P.rect('r', 4, 0, 1, 32);
        // the sketch of the Prism: lantern, tower, hull, waves and a dashed beam
        P.poly('L', [[11, 6], [15, 2], [19, 6]]);
        P.clip(['L'], () => P.poly('l', [[12.4, 5.6], [15, 3.2], [17.6, 5.6]]));
        P.line('L', 12, 6, 12, 9); P.line('L', 18, 6, 18, 9); P.line('L', 11, 9, 19, 9);
        P.dots('l', [[14, 7], [15, 7], [16, 7], [15, 8]]);
        P.line('L', 12, 10, 11, 21); P.line('L', 18, 10, 19, 21);
        P.line('l', 12, 13, 18, 13); P.line('l', 12, 14, 18, 14);
        P.line('l', 11, 18, 19, 18); P.line('l', 11, 19, 19, 19);
        P.line('L', 5, 22, 26, 22);
        P.line('L', 5, 22, 8, 26); P.line('L', 26, 22, 23, 26); P.line('L', 8, 26, 23, 26);
        P.dots('l', [[10, 24], [13, 24], [16, 24], [19, 24], [22, 24]]);
        for (const [x0, x1, y] of [[20, 22, 7], [24, 26, 8], [28, 30, 9], [20, 22, 5], [24, 26, 4], [28, 30, 3]]) P.line('l', x0, y, x1, y);
        for (let x = 6; x < 24; x += 4) P.dots('L', [[x, 28], [x + 1, 29], [x + 2, 28]]);
        // the pencil that drew it, lying across the corner
        P.poly('y', [[18, 31.5], [21, 31.5], [32, 20.5], [32, 17.5]]);
        P.edge('Y', 'y', 1, 1);
        P.poly('w', [[14.5, 32], [18, 31.5], [21, 31.5], [19, 32]]);
        P.dots('w', [[16, 31], [17, 31], [17, 30]]);
        P.dots('k', [[14, 31], [15, 31], [14, 30]]);
        P.within(28, 0, 4, 32, () => P.clip(['y', 'Y'], () => P.fill('m')));
        P.within(30, 0, 2, 32, () => P.clip(['m'], () => P.fill('e')));
        // a dog-eared corner
        P.poly('P', [[0, 26], [0, 32], [6, 32]]);
        P.line('L', 0, 26, 5, 31);
    },
});

export const dusk = defineArt({
    id: 'dusk', title: 'The Silver Dusk', w: 40, h: 40,
    blurb: 'Peach, rose and lavender: the colour of the end of the day.',
    colors: {
        n: ['#2a2350', 'Twilight'], N: ['#4e3a7e', 'Evening Violet'], o: ['#ffb38a', 'Peach Glow'], a: ['#cfcbe6', 'Silver'],
        b: ['#9a96b8', 'Pewter'], f: ['#c4a0ff', 'Lavender'], r: ['#ff8fb0', 'Rose'], d: [STAR, 'Starlight'],
        k: ['#16121f', 'Soot'], e: ['#6e6488', 'Ash'], m: ['#ffe08a', 'Moonlight'],
    },
    draw(P) {
        P.fill('n');
        P.rect('N', 0, 20, 40, 9);
        P.dots('N', [[1, 19], [5, 19], [10, 19], [29, 19], [34, 19], [38, 19]]);
        P.rect('o', 0, 29, 40, 11);
        P.dots('o', [[2, 28], [7, 28], [12, 28], [27, 28], [32, 28], [37, 28]]);
        // hills with one lit window
        P.poly('k', [[0, 35], [8, 32], [16, 35], [26, 33], [34, 31], [40, 33], [40, 40], [0, 40]]);
        // left wings, then mirrored
        P.poly('b', [[19, 11], [5, 3], [1, 10], [3, 19], [19, 20]]);
        P.poly('a', [[18, 12.4], [6, 5.6], [3.4, 10.6], [5, 17.6], [18, 18.6]]);
        P.clip(['a'], () => P.ellipse('r', 4, 13, 4, 6));
        P.circle('f', 10, 11.6, 3.2);
        P.circle('r', 10, 11.6, 1.7);
        P.dots('d', [[9, 11]]);
        P.poly('b', [[19, 20], [6, 21], [4, 28], [9, 33], [19, 26]]);
        P.poly('f', [[18, 21.6], [7.6, 22.6], [6, 27.6], [9.6, 31], [18, 25.4]]);
        P.circle('r', 11, 26, 1.9);
        P.clip(['f'], () => P.ellipse('o', 9, 30, 3, 2));
        P.line('e', 6, 5, 9, 7); P.line('e', 13, 6, 16, 10); P.line('e', 13, 22, 16, 23);
        P.mirror();
        // body
        P.ellipse('e', 20, 19, 2, 10);
        P.circle('e', 20, 8.8, 2.6);
        P.dots('d', [[18, 8], [21, 8]]);
        P.rect('b', 18, 14, 4, 1); P.rect('b', 18, 18, 4, 1); P.rect('b', 18, 22, 4, 1);
        // antennae
        P.line('k', 18, 6, 15, 2); P.line('k', 21, 6, 24, 2);
        P.dots('m', [[14, 1], [25, 1]]);
        P.outline('k', ['a', 'b', 'f', 'r', 'e', 'o']);
        // moon and first stars
        P.circle('m', 35, 4, 2.4);
        P.circle('n', 36.2, 3.2, 2);
        P.scatter('d', 12, 77, ['n']);
        P.dots('m', [[24, 36], [25, 36]]);
    },
});

export const farshore = defineArt({
    id: 'farshore', title: 'The Far Shore', w: 56, h: 56,
    blurb: 'Every world from the Far Shore, the Prism, and the Silver Dusk watching over them all.',
    colors: {
        n: ['#141535', 'Space'], a: ['#c4c3d4', 'Silver'], c: ['#6e6c86', 'Smoke'],
        r: ['#e8525a', 'Cherry'], o: ['#ff9f43', 'Tangerine'], y: ['#ffdb5c', 'Sunbeam'], g: ['#5fd38a', 'Mint'],
        b: ['#4f8fff', 'Sky'], v: ['#b07bf2', 'Violet'], h: ['#9a6140', 'Oak'], k: ['#ffffff', 'Cloud White'], t: ['#3fd0d8', 'Sea Teal'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('y', 48, 56, ['n']);
        // the Silver Dusk across the top, with sunset spots on its wings
        P.poly('a', [[27, 7], [14, 1], [11, 7], [14, 13], [27, 12]]);
        P.poly('c', [[27, 12], [17, 13], [18, 18], [27, 14]]);
        P.circle('v', 17, 7, 2);
        P.dots('o', [[17, 7]]);
        P.dots('r', [[21, 15]]);
        P.mirror();
        P.rect('c', 27, 4, 2, 12);
        P.line('a', 27, 4, 25, 0); P.line('a', 28, 4, 30, 0);
        P.edge('c', 'a', 0, -1);
        // the rainbow beam from the Prism's lantern
        ['v', 'b', 'g', 'y', 'o', 'r'].forEach((k, i) => {
            P.poly(k, [[31, 27 + i * 0.3], [31, 27.3 + i * 0.3], [56, 33 + i * 2.2], [56, 31 + i * 2.2]]);
        });
        // Coral Lanterns: a sea world with coral
        P.circle('t', 7, 9, 5.5);
        P.clip(['t'], () => { P.ellipse('b', 7, 13.5, 6, 2.4); P.dots('r', [[5, 12], [6, 11], [9, 12], [9, 11]]); });
        P.dots('y', [[5, 6], [9, 7]]);
        // Emberpeak: a volcano world
        P.circle('h', 7, 28, 5.2);
        P.clip(['h'], () => { P.poly('c', [[3, 34], [6, 25], [8, 25], [11, 34]]); P.rect('r', 6, 25, 2, 1); P.line('o', 7, 26, 6, 30); });
        P.circle('a', 9, 21, 1.2);
        // Frostbloom: a snowball with an aurora band
        P.circle('k', 9, 46, 5.6);
        P.clip(['k'], () => { P.rect('g', 0, 43, 20, 1); P.rect('v', 0, 44, 20, 1); });
        P.dots('a', [[7, 49], [11, 48], [9, 50]]);
        // Clockwork Carnival: a striped balloon
        P.ellipse('r', 48, 9, 4.6, 5);
        P.clip(['r'], () => { P.ellipse('y', 48, 9, 2.6, 6); P.ellipse('b', 48, 9, 1, 6); });
        P.line('h', 46, 14, 47, 16); P.line('h', 50, 14, 49, 16);
        P.rect('h', 46, 16, 5, 2);
        // the Blank Page: a paper world with ruled lines
        P.rect('k', 44, 46, 9, 8);
        P.clip(['k'], () => { P.rect('b', 44, 48, 9, 1); P.rect('b', 44, 51, 9, 1); P.rect('r', 46, 46, 1, 8); });
        P.dots('c', [[51, 46], [52, 47], [52, 46]]);
        // the old worlds, small and far away
        P.circle('v', 19, 22, 2.6); P.dots('k', [[18, 21]]);
        P.circle('g', 41, 21, 2.6); P.dots('y', [[37, 22], [38, 22], [44, 21], [45, 21]]);
        // the Prism
        P.rect('k', 25, 27, 6, 13);
        P.rect('r', 25, 30, 6, 2);
        P.rect('r', 25, 35, 6, 2);
        P.rect('y', 25, 23, 6, 4);
        P.dots('o', [[27, 24], [28, 24], [27, 25], [28, 25]]);
        P.poly('h', [[24, 23], [28, 18.5], [32, 23]]);
        P.rect('h', 24, 27, 8, 1);
        P.poly('h', [[16, 40], [40, 40], [36, 46], [20, 46]]);
        P.dots('y', [[21, 42], [25, 42], [29, 42], [33, 42]]);
        // friends on deck: a purple dragon and a yeti
        P.rect('v', 36, 38, 2, 2); P.dots('v', [[38, 37], [35, 39]]); P.dots('y', [[38, 36]]);
        P.rect('k', 19, 37, 2, 3); P.dots('b', [[19, 37]]);
        // clouds below
        P.ellipse('k', 28, 50, 11, 2.6);
        P.ellipse('k', 37, 53, 7, 2);
        P.ellipse('k', 18, 54, 6, 1.8);
        P.edge('a', 'k', 0, 1);
    },
});

/* ───────────────────────── Postcards from the Far Shore (bonus) ───────────────────────── */

export const rabbit = defineArt({
    id: 'rabbit', title: 'Moon Rabbit', w: 28, h: 28,
    blurb: 'Pounding mochi on the moon. Wishes you were here.',
    colors: {
        n: ['#1e2050', 'Night'], m: ['#ffe28a', 'Moon'], M: ['#d0a050', 'Moon Shade'],
        w: ['#ffffff', 'Rabbit'], W: ['#bab0dc', 'Rabbit Shade'], p: ['#ff8fb4', 'Ear Pink'],
        h: ['#9a6140', 'Mallet'], c: ['#ffbcdc', 'Mochi'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('m', 14, 31, ['n']);
        // a crescent moon to sit in
        P.circle('m', 12, 16, 10);
        P.circle('n', 16.5, 12, 9);
        P.edge('M', 'm', -1, 1);
        P.dots('M', [[5, 18], [7, 22], [11, 24]]);
        // the rabbit
        P.ellipse('w', 15, 19, 3.6, 3.4);
        P.circle('w', 16.5, 13.4, 2.8);
        P.ellipse('w', 15.2, 8.6, 0.9, 3);
        P.ellipse('w', 17.6, 8.8, 0.9, 3);
        P.dots('p', [[15, 8], [15, 9], [17, 8], [17, 9]]);
        P.edge('W', 'w', -1, 1);
        P.dots('n', [[17, 13]]);
        P.dots('p', [[19, 14], [16, 15]]);
        // mallet and the bowl of mochi
        P.line('h', 18, 19, 22, 14);
        P.rect('h', 21, 12, 3, 2);
        P.within(0, 21, 28, 4, () => P.ellipse('M', 23, 21, 3, 2.4));
        P.ellipse('c', 23, 20.6, 2.4, 1.1);
        P.outline('n', ['w', 'W', 'p']);
    },
});

export const rocket = defineArt({
    id: 'rocket', title: 'Cactus Rocket', w: 28, h: 28,
    blurb: 'Waters itself on the way up. Flowers at the top, flames at the bottom.',
    colors: {
        n: ['#24204a', 'Space'], w: [STAR, 'Starlight'], g: ['#5fcf6a', 'Cactus'], G: ['#2a7a44', 'Cactus Shade'],
        p: ['#ff5fa8', 'Flower'], y: ['#ffd84a', 'Flame Gold'], o: ['#ff6a3d', 'Flame Orange'], s: ['#e8b878', 'Desert'],
        S: ['#a8683a', 'Dune'], c: ['#7ff0e0', 'Window'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('w', 16, 17, ['n']);
        // desert planet below
        P.ellipse('s', 14, 36, 22, 10);
        P.clip(['s'], () => { P.ellipse('S', 5, 28, 4, 1); P.ellipse('S', 22, 30, 5, 1); P.ellipse('S', 13, 27, 3, 0.8); });
        // flames
        P.poly('o', [[10.5, 20], [17.5, 20], [14, 27]]);
        P.poly('y', [[12, 20], [16, 20], [14, 24.5]]);
        // body and arms
        P.rect('g', 11, 6, 6, 14);
        P.ellipse('g', 14, 6.4, 3, 3.2);
        P.rect('g', 7, 10, 2, 6); P.rect('g', 8, 15, 3, 2);
        P.rect('g', 19, 8, 2, 6); P.rect('g', 17, 13, 3, 2);
        P.edge('G', 'g', 1, 0);
        P.line('G', 13, 12, 13, 19);
        // window, spines, flower
        P.circle('c', 14.5, 9, 1.7);
        P.dots('w', [[14, 8]]);
        P.outline('G', ['g', 'c']);
        P.dots('w', [[10, 13], [10, 17], [18, 15], [18, 18], [6, 12], [21, 10]]);
        P.twinkle('p', 14, 2, 1);
        P.dots('y', [[14, 2]]);
    },
});

export const owl = defineArt({
    id: 'owl', title: 'Sleepy Owl', w: 32, h: 32,
    blurb: 'Nightcap on, eyes shut, perched on the last branch before the moon.',
    colors: {
        n: ['#1c2448', 'Night'], N: ['#34407a', 'Night Haze'], m: ['#ffe070', 'Moon'], b: ['#a8724a', 'Owl Brown'],
        B: ['#5a3a2a', 'Feather Shade'], c: ['#f2dcb8', 'Owl Face'], y: ['#ff9a3f', 'Beak'],
        r: ['#ff4a6e', 'Nightcap'], w: ['#ffffff', 'Pom'], t: ['#7a5a3a', 'Twig'], g: ['#5fbf74', 'Leaf'],
    },
    draw(P) {
        P.fill('n');
        P.ellipse('N', 25, 7, 9, 7);
        P.circle('m', 25, 7, 4);
        P.dots('m', [[3, 3], [9, 6], [5, 12], [14, 2], [30, 18], [2, 20]]);
        // branch and leaves
        P.line('t', 0, 27, 31, 24); P.line('t', 0, 28, 31, 25);
        P.line('t', 24, 25, 28, 29);
        P.ellipse('g', 3, 25, 2.4, 1.2); P.ellipse('g', 28, 22, 2.4, 1.2); P.ellipse('g', 29, 29, 1.6, 1.2);
        // body
        P.ellipse('b', 15, 18, 7, 7.6);
        P.ellipse('B', 8.6, 19, 2.2, 5);
        P.ellipse('B', 21.4, 19, 2.2, 5);
        P.ellipse('c', 15, 21, 3.8, 3.6);
        P.dots('B', [[14, 20], [16, 20], [15, 22], [13, 23], [17, 23]]);
        // face: two discs, shut eyes, beak
        P.circle('c', 12.5, 13.6, 2.8);
        P.circle('c', 17.5, 13.6, 2.8);
        P.dots('B', [[11, 13], [12, 14], [13, 14], [14, 13], [16, 13], [17, 14], [18, 14], [19, 13]]);
        P.poly('y', [[14, 15], [16, 15], [15, 17.4]]);
        // nightcap with a pom-pom
        P.poly('r', [[9, 10.5], [21, 10.5], [16, 3.4]]);
        P.poly('r', [[15.4, 4], [20.4, 5], [24, 8.4], [22, 9.4], [18, 7.6]]);
        P.rect('w', 9, 10, 12, 1);
        P.circle('w', 24, 9.4, 1.5);
        // feet
        P.dots('y', [[12, 25], [13, 25], [17, 25], [18, 25]]);
        P.outline('B', ['b', 'c', 'r', 'w', 'y']);
        // zzz
        P.stamp(4, 5, ['www', '.w.', 'www']);
        P.dots('w', [[8, 3], [9, 3]]);
    },
});

/* ───────────────────────── Portraits ───────────────────────── */

export const portraitSmudge = defineArt({
    id: 'p-smudge', title: 'Smudge', w: 16, h: 16,
    colors: {
        p: ['#f6efdc', 'Paper'], b: ['#9ac8ec', 'Blue Line'], e: ['#ff9ad0', 'Eraser'], E: ['#c85a8a', 'Eraser Shade'],
        l: ['#a8a6b8', 'Graphite'], k: ['#2a2830', 'Lead'],
    },
    draw(P) {
        P.fill('p');
        for (let y = 2; y < 16; y += 4) P.rect('b', 0, y, 16, 1);
        P.rect('e', 4, 4, 8, 9);
        P.rect('l', 4, 4, 8, 2);
        P.edge('E', 'e', 1, 0);
        P.rect('E', 4, 12, 8, 1);
        P.dots('k', [[6, 8], [9, 8], [7, 10], [8, 10]]);
        P.dots('l', [[10, 10], [11, 9]]);
        P.line('k', 3, 9, 1, 11); P.line('k', 12, 9, 14, 7);
        P.dots('k', [[5, 13], [5, 14], [10, 13], [10, 14]]);
    },
});

export const BOOK_TWO = [jellies, pip, reef, buns, cinder, emberpeak, fox, nook, aurora, balloon, tock, carousel, sketch, dusk, farshore];
export const POSTCARDS = [rabbit, rocket, owl];
