/**
 * artworks.js — every mosaic in Colorverse, drawn in code with the pixelart.js language.
 * Pure data: no DOM. The dev gallery (dev/gallery.html) shows them all; judge art there.
 */
import { defineArt } from './pixelart.js';

const STAR = '#fff6dc';

/* ───────────────────────── Chapter 1 · The Lighthouse Ship ───────────────────────── */

const wick = defineArt({
    id: 'wick', title: 'Wick', w: 16, h: 16,
    blurb: 'The lamplighter of the Prism, back to a cheerful glow.',
    colors: {
        n: ['#1d2150', 'Midnight'], h: ['#4251a6', 'Glow'], c: ['#8f4f36', 'Copper'], g: ['#f2b84b', 'Brass'],
        y: ['#ffe58a', 'Lamplight'], f: ['#ff7a3d', 'Flame'], w: [STAR, 'Starlight'],
    },
    draw(P) {
        P.fill('n');
        P.stamp(4, 1, [
            '...gg...',
            '..g..g..',
            '..g..g..',
            '.cccccc.',
            'cccccccc',
            'gyyyyyyg',
            'gycyycyg',
            'gyyffyyg',
            'gyfwwfyg',
            'gyfwwfyg',
            'gyyffyyg',
            'cccccccc',
            '.gggggg.',
        ]);
        P.outline('h', ['c', 'g', 'y', 'f', 'w']);
        P.dots('w', [[1, 1], [13, 0], [14, 7], [1, 10], [13, 13], [2, 15], [10, 15]]);
    },
});

const comet = defineArt({
    id: 'comet', title: 'Comet the Cat', w: 20, h: 20,
    blurb: 'The ship\'s cat, orange again and still asleep.',
    colors: {
        b: ['#2a2452', 'Dusk'], t: ['#56c4b4', 'Teal'], T: ['#2c8582', 'Deep Teal'], o: ['#f39a3d', 'Marmalade'],
        d: ['#c4612a', 'Ginger'], c: ['#ffe2b8', 'Cream'], p: ['#ff8fae', 'Rose'], k: ['#3b1f2b', 'Ink'], w: [STAR, 'Starlight'],
    },
    draw(P) {
        P.fill('b');
        P.dots('w', [[2, 2], [16, 1], [18, 5], [1, 6], [14, 4]]);
        // cushion
        P.ellipse('t', 10, 16, 9.6, 3.6);
        P.edge('T', 't', 0, 1);
        P.dots('T', [[4, 15], [10, 14], [16, 15]]);
        // body and tail
        P.ellipse('o', 11, 11.6, 6.8, 3.9);
        P.ellipse('o', 13, 14.4, 5.2, 1.6);
        P.circle('o', 6.2, 10.2, 3.6);
        P.poly('o', [[3, 8], [3.2, 4.6], [6, 7]]);
        P.poly('o', [[6.6, 6.8], [9, 4.8], [9.4, 8.2]]);
        P.dots('p', [[4, 7], [8, 7]]);
        // stripes
        P.dots('d', [[11, 8], [12, 9], [14, 8], [15, 9], [17, 10], [16, 11], [17, 13], [18, 14], [9, 15], [11, 15]]);
        // muzzle and face
        P.ellipse('c', 5.2, 11.6, 1.9, 1.3);
        P.dots('k', [[4, 9], [5, 9], [7, 9], [8, 9]]);
        P.dots('p', [[5, 11]]);
        P.outline('k', ['o', 'd', 'c', 'p']);
        // zzz
        P.circle('c', 17, 2.5, 1.6);
        P.stamp(9, 1, ['www', '.w.', 'www']);
        P.stamp(7, 5, ['ww', 'ww']);
    },
});

const prism = defineArt({
    id: 'prism', title: 'The Prism', w: 24, h: 24,
    blurb: 'A lighthouse that learned to sail, rainbow beam and all.',
    colors: {
        n: ['#1b1f4b', 'Night'], w: [STAR, 'Starlight'], c: ['#b8b4e0', 'Cloud'], h: ['#9a6140', 'Oak'], H: ['#5a3726', 'Walnut'],
        r: ['#e8525a', 'Cherry'], o: ['#ff9f43', 'Tangerine'], y: ['#ffdb5c', 'Sunbeam'], g: ['#5fd38a', 'Mint'],
        b: ['#4fa3ff', 'Sky'], v: ['#a77bf2', 'Violet'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('w', 16, 7, ['n']);
        // rainbow beam fanning out to the right
        const bands = ['v', 'b', 'g', 'y', 'o', 'r'];
        bands.forEach((k, i) => {
            P.poly(k, [[13, 3.6 + i * 0.4], [13, 4 + i * 0.4], [24, 1 + (i + 1) * 2.2], [24, 1 + i * 2.2]]);
        });
        // tower
        P.rect('w', 9, 7, 5, 10);
        P.rect('r', 9, 9, 5, 2);
        P.rect('r', 9, 13, 5, 2);
        P.rect('H', 8, 6, 7, 1);
        P.rect('y', 9, 3, 5, 3);
        P.dots('w', [[11, 4]]);
        P.poly('H', [[8, 3], [11.5, 0], [15, 3]]);
        P.rect('H', 10, 3, 1, 3);
        P.rect('H', 12, 3, 1, 3);
        // hull
        P.poly('h', [[2, 16], [22, 16], [19, 20.5], [5, 20.5]]);
        P.rect('H', 2, 16, 20, 1);
        P.dots('H', [[6, 18], [9, 18], [12, 18], [15, 18], [18, 18]]);
        P.edge('H', 'h', 0, 1);
        // clouds
        P.ellipse('c', 3, 22.5, 4.5, 2);
        P.ellipse('c', 11, 23.2, 5, 2);
        P.ellipse('c', 20, 22.6, 5, 2.2);
    },
});

/* ───────────────────────── Chapter 2 · Moonberry Grove ───────────────────────── */

const moonberry = defineArt({
    id: 'moonberry', title: 'Moonberries', w: 20, h: 20,
    blurb: 'They glow at night. They taste like blue.',
    colors: {
        n: ['#1f1f48', 'Night'], m: ['#fff0b3', 'Moon'], t: ['#7a5236', 'Twig'], g: ['#5fcf8a', 'Leaf'], G: ['#2b8a5e', 'Moss'],
        p: ['#7b5cff', 'Moonberry'], P: ['#4630a8', 'Deep Berry'], l: ['#cdbdff', 'Shine'],
    },
    draw(P) {
        P.fill('n');
        // crescent moon
        P.circle('m', 15.5, 4, 3);
        P.circle('n', 17, 3, 2.6);
        P.dots('m', [[3, 2], [8, 1], [2, 8]]);
        // twig and leaves
        P.line('t', 2, 5, 10, 8);
        P.line('t', 10, 8, 9, 11);
        P.line('t', 10, 8, 13, 11);
        P.poly('g', [[5, 6.3], [8, 2.5], [9.5, 6]]);
        P.poly('g', [[11, 8], [16, 6.5], [18, 9.5], [13, 10]]);
        P.edge('G', 'g', 0, 1);
        // berries
        for (const [x, y] of [[11, 12], [7.5, 15], [14, 15.5]]) {
            P.circle('P', x, y, 3.4);
            P.circle('p', x - 0.3, y - 0.3, 2.7);
            P.dots('l', [[Math.floor(x) - 2, Math.floor(y) - 1], [Math.floor(x) - 1, Math.floor(y) - 2]]);
        }
        P.dots('l', [[3, 15], [17, 12], [16, 18]]);
    },
});

const glowcaps = defineArt({
    id: 'glowcaps', title: 'Glowcaps', w: 24, h: 24,
    blurb: 'Mushrooms that hum very quietly, in the key of teal.',
    colors: {
        n: ['#16213e', 'Deep Night'], d: ['#2e4a3a', 'Loam'], g: ['#4fae6a', 'Clover'], w: ['#f3ead2', 'Bone'], W: ['#c2b294', 'Driftwood'],
        t: ['#3fd6c6', 'Glowcap'], T: ['#1d8597', 'Lagoon'], p: ['#ff7fbf', 'Bubblegum'], y: ['#ffd84f', 'Firefly'],
    },
    draw(P) {
        P.fill('n');
        // ground with a grassy rim and tufts
        P.ellipse('d', 12, 27, 17, 7);
        P.edge('g', 'd', 0, -1);
        P.dots('g', [[1, 19], [3, 19], [7, 19], [16, 19], [21, 19], [22, 19]]);
        // caps, cut flat underneath
        P.ellipse('t', 11, 11, 8.6, 6);
        P.within(0, 11, 24, 13, () => P.clip(['t'], () => P.fill('n')));
        P.within(0, 10, 24, 1, () => P.clip(['t'], () => P.fill('T')));
        P.ellipse('p', 18, 15, 3.9, 3);
        P.within(0, 15, 24, 9, () => P.clip(['p'], () => P.fill('n')));
        P.ellipse('y', 4.5, 18, 2.4, 2);
        P.within(0, 18, 24, 6, () => P.clip(['y'], () => P.fill('n')));
        // stems
        P.rect('w', 9, 11, 4, 9);
        P.rect('w', 17, 15, 2, 5);
        P.rect('w', 4, 18, 1, 2);
        P.edge('W', 'w', 1, 0);
        P.dots('W', [[9, 11], [10, 11], [11, 11], [12, 11]]);
        // spots and fireflies
        P.dots('w', [[6, 8], [10, 6], [14, 7], [8, 9], [16, 9], [12, 9], [17, 13], [19, 14]]);
        P.dots('y', [[2, 4], [19, 2], [21, 9], [3, 13], [16, 3], [22, 15]]);
    },
});

const dragon = defineArt({
    id: 'dragon', title: 'Moonberry Dragon', w: 32, h: 32,
    blurb: 'Mira. Very purple. Terrifyingly purple.',
    colors: {
        b: ['#2a2d5c', 'Twilight'], w: [STAR, 'Starlight'], h: ['#3d7a5e', 'Hillside'], H: ['#2a5a48', 'Fern Shade'],
        p: ['#9b6bff', 'Dragon'], P: ['#5e3fb8', 'Deep Dragon'], c: ['#ffd6a8', 'Peach'], m: ['#ff8fc8', 'Wing Pink'],
        y: ['#ffc94a', 'Horn'], k: ['#1b1530', 'Ink'], B: ['#55b8ff', 'Berry Blue'],
    },
    draw(P) {
        P.fill('b');
        P.scatter('w', 18, 11, ['b']);
        P.ellipse('h', 16, 36, 24, 10);
        P.edge('H', 'h', 0, -1);
        // wings
        P.poly('P', [[9, 15], [2, 6], [4, 12], [1, 13], [5, 17], [10, 19]]);
        P.poly('m', [[9, 15.6], [4, 9.5], [5.2, 13], [3, 14], [6, 16.5], [9.6, 18]]);
        P.poly('P', [[23, 15], [30, 6], [28, 12], [31, 13], [27, 17], [22, 19]]);
        P.poly('m', [[23, 15.6], [28, 9.5], [26.8, 13], [29, 14], [26, 16.5], [22.4, 18]]);
        // tail
        P.poly('p', [[20, 26], [27, 27], [29, 24], [30, 26], [28, 29], [19, 29]]);
        P.poly('m', [[29, 24], [31, 22], [30.6, 26]]);
        // body
        P.ellipse('p', 16, 23, 7.5, 6.5);
        P.ellipse('c', 16, 24, 4.2, 4.5);
        P.dots('y', [[15, 22], [16, 22], [14, 24], [17, 24], [15, 26], [16, 26]]);
        // feet
        P.ellipse('p', 11.5, 29, 3, 1.8);
        P.ellipse('p', 20.5, 29, 3, 1.8);
        P.dots('c', [[10, 29], [12, 29], [19, 29], [21, 29]]);
        // head
        P.ellipse('p', 16, 11, 8, 6.4);
        P.ellipse('p', 16, 14.5, 5.2, 3.2);
        P.poly('y', [[9.5, 7], [7, 1.5], [12.5, 5.5]]);
        P.poly('y', [[22.5, 7], [25, 1.5], [19.5, 5.5]]);
        P.poly('p', [[14, 5], [16, 2.6], [18, 5]]);
        // face
        P.stamp(11, 9, ['kk......kk', 'kw......wk', 'kk......kk']);
        P.dots('m', [[10, 13], [11, 13], [21, 13], [22, 13]]);
        P.dots('P', [[14, 15], [17, 15]]);
        P.dots('k', [[15, 16], [16, 16]]);
        // berry held in arms
        P.circle('B', 16, 21.4, 2.3);
        P.dots('w', [[15, 20]]);
        P.ellipse('p', 12.6, 21.5, 1.6, 1.3);
        P.ellipse('p', 19.4, 21.5, 1.6, 1.3);
        P.edge('P', 'p', 0, 1);
        P.outline('k', ['p', 'P', 'c', 'm', 'y', 'B'], false);
    },
});

/* ───────────────────────── Chapter 3 · Starship Sprout ───────────────────────── */

const seedpod = defineArt({
    id: 'seedpod', title: 'Seedling Pod', w: 24, h: 24,
    blurb: 'Something green, sprouting on the hull of a lost ship.',
    colors: {
        n: ['#141a3a', 'Void'], w: [STAR, 'Starlight'], o: ['#ff9f6b', 'Apricot'], r: ['#ffd59a', 'Ring Gold'],
        m: ['#a7b4d6', 'Silver'], M: ['#5e6a92', 'Gunmetal'], c: ['#7ff0e0', 'Glass'], g: ['#7ee07a', 'Sprout'], G: ['#2fa25a', 'Stem'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('w', 14, 3, ['n']);
        // planet with ring
        P.circle('o', 20.5, 20.5, 2.5);
        P.ring('r', 20.5, 20.5, 3.4, 4.2, 0.32);
        P.clip(['r'], () => P.rect('o', 18, 20, 5, 1));
        // pod body
        P.ellipse('m', 10, 15.5, 7, 6.5);
        P.edge('M', 'm', 1, 1);
        P.edge('M', 'm', 0, 1);
        P.rect('M', 4, 15, 15, 1);
        P.circle('c', 8.5, 17.5, 1.7);
        P.circle('c', 13.5, 17.5, 1.7);
        P.dots('w', [[8, 17], [13, 17]]);
        // crack and sprout
        P.poly('n', [[6, 10.6], [9, 12], [11, 10], [13, 12], [16, 10.6], [16, 9], [6, 9]]);
        P.rect('G', 11, 5, 1, 7);
        P.poly('g', [[11, 7], [6, 4], [8.5, 8.5]]);
        P.poly('g', [[12, 5], [17, 2.5], [15, 7]]);
        P.dots('G', [[8, 6], [9, 7], [14, 5], [15, 4]]);
        // little flames
        P.dots('o', [[10, 22], [12, 22], [11, 23]]);
    },
});

const bolt = defineArt({
    id: 'bolt', title: 'Bolt the Gardener', w: 28, h: 28,
    blurb: 'Beige purged. Bolt is very happy about it.',
    colors: {
        b: ['#1e3346', 'Greenhouse'], l: ['#335272', 'Pane'], r: ['#ff8c5a', 'Rust Red'], R: ['#bb502c', 'Brick'],
        k: ['#1b1a2c', 'Screen'], c: ['#7ff0e0', 'Signal'], m: ['#cbd3e3', 'Chrome'], p: ['#ff6fae', 'Blossom'],
        g: ['#5fcf6a', 'Leaf'], y: ['#ffd45a', 'Watering Can'],
    },
    draw(P) {
        P.fill('b');
        for (let x = 3; x < 28; x += 7) P.rect('l', x, 0, 1, 28);
        P.rect('l', 0, 7, 28, 1);
        // floor
        P.rect('m', 0, 25, 28, 3);
        P.rect('l', 0, 25, 28, 1);
        // body
        P.ellipse('r', 12, 19, 7, 5.6);
        P.edge('R', 'r', 0, 1);
        P.edge('R', 'r', 1, 0);
        P.rect('m', 8, 24, 2, 2);
        P.rect('m', 14, 24, 2, 2);
        P.rect('R', 7, 25, 4, 1);
        P.rect('R', 13, 25, 4, 1);
        P.circle('y', 12, 19, 1.6);
        // head
        P.ellipse('r', 12, 9.6, 6.6, 5);
        P.edge('R', 'r', 0, 1);
        P.ellipse('k', 12, 9.8, 4.6, 3);
        P.stamp(9, 9, ['cc..cc', 'cc..cc']);
        P.dots('c', [[11, 11], [12, 11]]);
        P.rect('m', 11, 2, 2, 3);
        P.circle('p', 12, 1.6, 1.4);
        P.rect('m', 5, 8, 1, 4);
        P.rect('m', 18, 8, 1, 4);
        // arm and watering can
        P.line('m', 18, 17, 21, 15);
        P.rect('y', 20, 12, 5, 5);
        P.line('y', 24, 13, 27, 10);
        P.rect('y', 21, 11, 3, 1);
        P.edge('R', 'y', 0, 1);
        P.dots('c', [[26, 12], [27, 14], [25, 15], [26, 17]]);
        // flower pot
        P.rect('R', 2, 21, 5, 4);
        P.rect('r', 1, 20, 7, 1);
        P.line('g', 4, 19, 4, 14);
        P.dots('g', [[3, 16], [5, 17], [2, 15], [6, 16]]);
        P.twinkle('p', 4, 13, 1);
        P.dots('y', [[4, 13]]);
        P.line('m', 6, 18, 4, 20);
    },
});

const sprout = defineArt({
    id: 'sprout', title: 'Starship Sprout', w: 32, h: 32,
    blurb: 'A seedship that grows on light. Engines green, leaves green, everything green.',
    colors: {
        n: ['#10163a', 'Deep Space'], v: ['#3b2b6e', 'Nebula'], w: [STAR, 'Starlight'], h: ['#ece5d0', 'Shell'], H: ['#a89f88', 'Shell Shade'],
        d: ['#a9e8ff', 'Dome'], t: ['#8a5a3a', 'Trunk'], g: ['#4fcf6a', 'Canopy'], G: ['#25804a', 'Deep Canopy'],
        f: ['#c4ff6a', 'Leaf Flame'], o: ['#ffb84f', 'Porthole'],
    },
    draw(P) {
        P.fill('n');
        P.ellipse('v', 6, 7, 9, 5);
        P.ellipse('v', 28, 27, 9, 6);
        P.scatter('w', 22, 5, ['n', 'v']);
        // engine flame
        P.poly('f', [[6, 20], [0, 16.5], [3, 21], [0, 25.5], [6, 23]]);
        // hull: a long seed shape
        P.ellipse('h', 17, 21.5, 12, 4.8);
        P.poly('h', [[26, 18], [31.5, 21.5], [26, 25]]);
        P.edge('H', 'h', 0, 1);
        P.edge('H', 'h', 0, 1, 2);
        P.rect('H', 6, 20, 2, 4);
        for (const x of [12, 17, 22]) { P.circle('o', x, 22.3, 1.2); }
        // glass dome
        P.clip(['n', 'v', 'w'], () => P.ellipse('d', 16, 17, 8, 7.4));
        // tree inside dome
        P.clip(['d'], () => {
            P.rect('t', 15, 12, 2, 6);
            P.line('t', 15, 15, 12, 13);
            P.ellipse('g', 16, 10.5, 5.8, 3.6);
            P.ellipse('g', 12, 12.5, 3, 2.2);
            P.ellipse('g', 20, 12.4, 3, 2.2);
            P.edge('G', 'g', 0, 1);
            P.dots('G', [[14, 9], [18, 10], [16, 8]]);
        });
        P.dots('w', [[11, 13], [10, 14]]);
        P.rect('H', 8, 17, 16, 1);
        P.dots('d', [[9, 15], [10, 13]]);
    },
});

/* ───────────────────────── Chapter 4 · Cloudtop Castle ───────────────────────── */

const sheep = defineArt({
    id: 'sheep', title: 'Cloud Sheep', w: 28, h: 28,
    blurb: 'Woolly and white, and a little bit pink at sunset.',
    colors: {
        s: ['#7fb3ff', 'Sky'], S: ['#ffc2d4', 'Sunset'], y: ['#ffe18a', 'Sun'], w: ['#ffffff', 'Wool'],
        W: ['#cdd5ef', 'Wool Shade'], k: ['#4a3a5a', 'Charcoal'], p: ['#ff92b8', 'Blush'],
    },
    draw(P) {
        P.fill('s');
        P.rect('S', 0, 15, 28, 13);
        P.clip(['s'], () => P.dots('S', [[2, 14], [6, 14], [9, 14], [14, 14], [19, 14], [24, 14], [26, 14], [0, 13], [12, 13], [22, 13]]));
        P.circle('y', 22, 7, 3.5);
        // little cloud
        P.ellipse('w', 5, 6, 3.2, 1.4);
        P.ellipse('w', 7, 5, 2.2, 1.6);
        P.edge('W', 'w', 0, 1);
        // fluffy body
        for (const [x, y, r] of [[10, 13, 3.4], [14, 12, 3.6], [18, 13, 3.4], [8, 16.5, 3.2], [20, 16.5, 3.2], [11, 19, 3.2], [17, 19, 3.2], [14, 16, 4.4]]) P.circle('w', x, y, r);
        P.edge('W', 'w', 0, 1);
        P.edge('W', 'w', 1, 0);
        // legs
        for (const x of [10, 13, 16, 19]) P.rect('k', x, 21, 1, 4);
        // head: a woolly tuft, floppy ears, a soft dark face
        P.stamp(2, 10, [
            '..www..',
            '.wwwww.',
            'kkwwwkk',
            'k.kkk.k',
            '.kkkkk.',
            '.kwkwk.',
            '.kkkkk.',
            '.pkkkp.',
            '..kkk..',
        ]);
        // ground puffs
        P.ellipse('w', 5, 27, 6, 2.3);
        P.ellipse('w', 15, 27.4, 6, 2);
        P.ellipse('w', 25, 27, 5, 2.4);
        P.clip(['w'], () => P.rect('W', 0, 27, 28, 1));
        P.dots('p', [[3, 25], [12, 26], [22, 25], [26, 26]]);
    },
});

const griffin = defineArt({
    id: 'griffin', title: 'Sunwing', w: 32, h: 32,
    blurb: 'A griffin who flew too close to the Hush, and heard it crying.',
    colors: {
        s: ['#94ceff', 'Sky'], S: ['#cbe8ff', 'Pale Sky'], w: ['#ffffff', 'Cloud'], f: ['#f6e3c0', 'Feather'],
        y: ['#ffc23f', 'Beak'], o: ['#e8a33c', 'Lion Gold'], O: ['#a8641f', 'Bronze'], r: ['#d8643a', 'Rust Wing'],
        R: ['#8a3a2a', 'Ember'], k: ['#2a1a1a', 'Ink'],
    },
    draw(P) {
        P.fill('s');
        P.rect('S', 0, 20, 32, 12);
        P.ellipse('w', 5, 27, 7, 2.6);
        P.ellipse('w', 25, 28, 8, 2.6);
        P.ellipse('w', 25, 5, 4, 1.4);
        // raised wing behind
        P.poly('R', [[12, 15], [16, 2], [19, 4], [22, 3], [24, 7], [27, 6], [26, 12], [20, 17]]);
        P.poly('r', [[13, 15], [17, 4], [19, 6], [22, 5], [23, 9], [26, 8], [24, 12], [19, 16]]);
        // lion body
        P.ellipse('o', 18, 19, 8.5, 4.8);
        P.rect('o', 11, 21, 3, 5);
        P.rect('o', 22, 21, 3, 5);
        P.rect('O', 15, 22, 2, 4);
        P.rect('O', 25, 21, 2, 5);
        P.edge('O', 'o', 0, 1);
        // tail
        P.line('o', 26, 17, 29, 13);
        P.line('o', 27, 17, 30, 13);
        P.circle('O', 29.5, 12, 1.6);
        // eagle head and chest
        P.ellipse('f', 11, 16, 4, 5);
        P.circle('f', 9, 10, 4);
        P.poly('f', [[10, 6.6], [13, 4], [12.4, 8]]);
        P.poly('y', [[5.6, 9], [2, 11.5], [5.4, 12.4]]);
        P.dots('k', [[8, 9]]);
        P.dots('O', [[10, 13], [12, 15], [10, 17], [12, 19]]);
        // talons
        P.dots('y', [[10, 26], [11, 26], [13, 26], [21, 26], [22, 26], [24, 26]]);
        // front wing
        P.poly('r', [[13, 16], [20, 12], [25, 14], [22, 16], [17, 19]]);
        P.line('R', 16, 17, 23, 14);
        P.outline('k', ['f', 'y', 'o', 'O', 'r', 'R']);
    },
});

const castle = defineArt({
    id: 'castle', title: 'Cloudtop Castle', w: 40, h: 40,
    blurb: 'Where the bells ring, and where the Hush finally came to listen.',
    colors: {
        s: ['#8fc6ff', 'Sky'], S: ['#c6e3ff', 'Pale Sky'], o: ['#fff2a3', 'Sun'], w: ['#ffffff', 'Cloud'], W: ['#a9b8ea', 'Cloud Shade'],
        g: ['#e8def0', 'Moonstone'], G: ['#9b8dbd', 'Slate'], r: ['#5d6cff', 'Roof'], R: ['#3639a8', 'Indigo'],
        y: ['#ffd45a', 'Lit Window'], d: ['#7a4a3a', 'Door'], p: ['#ff6f9f', 'Pennant'],
    },
    draw(P) {
        P.fill('s');
        P.rect('S', 0, 22, 40, 18);
        P.circle('o', 32, 7, 4);
        P.ellipse('w', 8, 8, 5, 1.6);
        P.ellipse('w', 10, 7, 3, 1.6);
        P.edge('W', 'w', 0, 1);
        // cloud island
        for (const [x, y, rx, ry] of [[20, 33, 17, 5], [8, 31, 6, 4], [32, 31, 6, 4], [14, 30, 5, 3.5], [26, 30, 5, 3.5], [20, 37, 11, 3]]) P.ellipse('w', x, y, rx, ry);
        P.edge('W', 'w', 0, 1);
        P.edge('W', 'w', 0, 1, 2);
        // walls
        P.rect('g', 9, 20, 22, 10);
        for (let x = 9; x < 31; x += 3) P.rect('g', x, 19, 2, 1);
        // towers
        const tower = (x, w, top, roofH) => {
            P.rect('g', x, top, w, 30 - top);
            P.edge('G', 'g', 1, 0);
            const cx = x + w / 2;
            P.poly('r', [[x - 1, top + 0.5], [cx, top - roofH], [x + w + 1, top + 0.5]]);
            P.clip(['r'], () => P.poly('R', [[cx, top - roofH], [x + w + 1, top + 0.5], [cx, top + 0.5]]));
            P.line('G', Math.floor(cx), Math.floor(top - roofH) - 3, Math.floor(cx), Math.floor(top - roofH) - 1);
            P.rect('p', Math.floor(cx) + 1, Math.floor(top - roofH) - 3, 2, 1);
            P.dots('p', [[Math.floor(cx) + 1, Math.floor(top - roofH) - 2]]);
        };
        tower(5, 5, 16, 6);
        tower(30, 5, 16, 6);
        tower(16, 8, 11, 8);
        // windows and door
        P.stamp(18, 14, ['y..y', 'y..y']);
        P.dots('y', [[7, 19], [7, 20], [32, 19], [32, 20], [12, 23], [27, 23], [12, 22], [27, 22]]);
        P.rect('d', 18, 25, 4, 5);
        P.dots('d', [[19, 24], [20, 24]]);
        P.dots('y', [[21, 27]]);
        P.rect('G', 9, 29, 22, 1);
        // birds
        P.dots('G', [[14, 4], [15, 5], [16, 4], [22, 3], [23, 4], [24, 3]]);
    },
});

/* ───────────────────────── Chapter 5 · The Grey Hush ───────────────────────── */

const hush = defineArt({
    id: 'hush', title: 'The Grey Hush', w: 32, h: 32,
    blurb: 'Silver, pewter, smoke, dove and ash. It had names all along.',
    colors: {
        n: ['#3a3450', 'Dusk'], N: ['#2a2540', 'Deep Dusk'], d: ['#ece9f2', 'Dove'], a: ['#c4c3d4', 'Silver'], b: ['#8d8ca3', 'Pewter'],
        c: ['#5d5c72', 'Smoke'], e: ['#76707f', 'Ash'], f: ['#bbaee0', 'Lavender Grey'], k: ['#16131f', 'Soot'], w: [STAR, 'Starlight'],
    },
    draw(P) {
        P.fill('n');
        P.ellipse('N', 16, 34, 26, 10);
        // left wings, mirrored
        P.poly('b', [[15, 9], [3, 3], [0.5, 9], [2, 15], [15, 16]]);
        P.poly('a', [[14, 10], [4, 5], [2.5, 9.5], [4, 14], [14, 15]]);
        P.poly('b', [[15, 16], [4, 17], [3, 23], [7, 27], [15, 21]]);
        P.poly('d', [[14, 17.4], [6, 18.4], [5, 22.6], [8, 25.2], [14, 20.6]]);
        P.circle('f', 7.5, 10, 2.4);
        P.circle('c', 7.5, 10, 1.1);
        P.circle('f', 9, 21.4, 1.6);
        P.line('c', 4, 6, 7, 7);
        P.line('c', 11, 6, 13, 9);
        P.dots('c', [[3, 12], [5, 15], [10, 14]]);
        P.mirror();
        // body
        P.ellipse('e', 16, 15, 1.8, 8);
        P.circle('e', 16, 7.2, 2.2);
        P.dots('d', [[15, 7], [17, 7]]);
        P.dots('c', [[16, 11], [16, 14], [16, 17], [16, 20]]);
        // antennae
        P.line('k', 15, 5, 12, 1);
        P.line('k', 17, 5, 20, 1);
        P.dots('d', [[11, 1], [21, 1]]);
        P.outline('k', ['a', 'b', 'd', 'e', 'f', 'c']);
        P.scatter('w', 12, 21, ['n']);
    },
});

const colorverse = defineArt({
    id: 'colorverse', title: 'The Colorverse', w: 48, h: 48,
    blurb: 'Every world and everyone in it, together in one picture.',
    colors: {
        n: ['#141535', 'Space'], w: [STAR, 'Starlight'], a: ['#c4c3d4', 'Silver'], c: ['#6e6c86', 'Smoke'],
        r: ['#e8525a', 'Cherry'], o: ['#ff9f43', 'Tangerine'], y: ['#ffdb5c', 'Sunbeam'], g: ['#5fd38a', 'Mint'],
        b: ['#4fa3ff', 'Sky'], v: ['#a77bf2', 'Violet'], P: ['#5e3fb8', 'Deep Dragon'], h: ['#9a6140', 'Oak'], k: ['#ffffff', 'Cloud White'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('w', 40, 48, ['n']);
        // the Hush, now silver, watching over everyone
        P.poly('a', [[23, 6], [12, 1], [10, 6], [12, 11], [23, 10]]);
        P.poly('a', [[25, 6], [36, 1], [38, 6], [36, 11], [25, 10]]);
        P.poly('c', [[23, 10], [15, 11], [16, 15], [23, 12]]);
        P.poly('c', [[25, 10], [33, 11], [32, 15], [25, 12]]);
        P.rect('c', 23, 3, 2, 11);
        P.circle('c', 15, 6, 1.6);
        P.circle('c', 33, 6, 1.6);
        P.dots('v', [[15, 6], [33, 6]]);
        P.line('a', 23, 3, 21, 0);
        P.line('a', 24, 3, 26, 0);
        P.edge('c', 'a', 0, -1);
        // Moonberry world
        P.circle('v', 7, 19, 6);
        P.clip(['v'], () => { P.circle('P', 9, 21, 6); P.circle('v', 6, 17.5, 5); });
        P.dots('w', [[4, 16]]);
        // Sprout world
        P.circle('g', 41, 21, 5.5);
        P.clip(['g'], () => { P.ellipse('b', 41, 24, 7, 1.5); });
        P.ring('y', 41, 21, 7, 7.9, 0.3);
        P.clip(['y'], () => P.rect('n', 37, 18, 9, 2));
        // Cloudtop world
        P.circle('b', 9, 40, 6);
        P.ellipse('k', 9, 43, 6, 2.5);
        P.rect('k', 7, 34, 4, 5);
        P.poly('v', [[6, 34.5], [9, 30], [12, 34.5]]);
        P.clip(['b'], () => P.dots('k', [[6, 37], [13, 38]]));
        // the rainbow beam
        const bands = ['v', 'b', 'g', 'y', 'o', 'r'];
        bands.forEach((k, i) => {
            P.poly(k, [[25, 21 + i * 0.3], [25, 21.3 + i * 0.3], [48, 30 + i * 2.3], [48, 28 + i * 2.3]]);
        });
        // the Prism
        P.rect('k', 20, 21, 6, 13);
        P.rect('r', 20, 24, 6, 2);
        P.rect('r', 20, 29, 6, 2);
        P.rect('y', 20, 17, 6, 4);
        P.poly('h', [[19, 17], [23, 12.5], [27, 17]]);
        P.rect('h', 22, 17, 1, 4);
        P.rect('h', 19, 21, 8, 1);
        P.poly('h', [[12, 34], [34, 34], [30, 40], [16, 40]]);
        P.dots('y', [[17, 36], [21, 36], [25, 36], [29, 36]]);
        // a tiny purple dragon riding on the bow
        P.rect('v', 31, 32, 2, 2);
        P.dots('v', [[33, 31], [30, 33]]);
        P.dots('y', [[33, 30]]);
        // clouds below
        P.ellipse('k', 23, 44, 9, 2.4);
        P.ellipse('k', 36, 46, 8, 2);
        P.edge('a', 'k', 0, 1);
        P.dots('w', [[40, 40], [44, 6], [3, 3], [30, 44]]);
    },
});

/* ───────────────────────── Hidden Sketches (bonus pages) ───────────────────────── */

const snail = defineArt({
    id: 'snail', title: 'Space Snail', w: 24, h: 24,
    blurb: 'Carries a whole galaxy on its back. In no hurry at all.',
    colors: {
        n: ['#22285a', 'Void'], w: [STAR, 'Starlight'], m: ['#7a5ad8', 'Galaxy'], M: ['#3d2a8a', 'Deep Galaxy'], p: ['#ff8fd0', 'Nebula Pink'],
        s: ['#9ee6b0', 'Snail'], S: ['#4fa77a', 'Snail Shade'], k: ['#0a0812', 'Ink'], r: ['#6a6c9a', 'Asteroid'],
    },
    draw(P) {
        P.fill('n');
        P.scatter('w', 14, 9, ['n']);
        P.ellipse('r', 12, 25, 15, 5);
        P.edge('M', 'r', 0, -1);
        // body
        P.ellipse('s', 12, 18.5, 10, 2.5);
        P.rect('s', 18, 12, 3, 6);
        P.circle('s', 19.5, 11.5, 2);
        P.edge('S', 's', 0, 1);
        P.line('s', 19, 10, 18, 6);
        P.line('s', 21, 10, 22, 6);
        P.dots('k', [[20, 11]]);
        // galaxy shell
        P.circle('m', 10, 12, 6.5);
        P.clip(['m'], () => {
            P.ring('M', 10, 12, 4.6, 5.6);
            P.ring('p', 10.6, 12.4, 2.6, 3.4);
            P.ring('M', 10.2, 12, 0, 1.2);
        });
        P.dots('w', [[8, 9], [13, 10], [7, 14], [12, 15]]);
        P.outline('k', ['m', 'M', 'p', 's', 'S']);
        P.twinkle('w', 3, 3, 1);
    },
});

const teacup = defineArt({
    id: 'teacup', title: 'Teacup Planet', w: 28, h: 28,
    blurb: 'Steeped for exactly four minutes. Ringed for exactly ever.',
    colors: {
        b: ['#2c2350', 'Plum Dark'], w: [STAR, 'Starlight'], c: ['#f6f0ff', 'Porcelain'], C: ['#b9addb', 'China Blue'],
        t: ['#c77a3a', 'Tea'], o: ['#ffb36b', 'Planet'], O: ['#e8577a', 'Planet Band'], r: ['#9be3e3', 'Ring'], s: ['#ffd9ec', 'Steam'],
    },
    draw(P) {
        P.fill('b');
        P.scatter('w', 12, 13, ['b']);
        // steam
        P.line('s', 9, 6, 8, 3);
        P.line('s', 8, 3, 9, 1);
        P.line('s', 19, 5, 20, 2);
        P.line('s', 20, 2, 19, 0);
        // cup
        P.poly('c', [[4, 15], [24, 15], [21, 24], [7, 24]]);
        P.ring('c', 24.5, 18.5, 1.6, 3.2);
        P.ellipse('C', 14, 25, 11, 1.8);
        P.edge('C', 'c', 0, 1);
        P.rect('C', 7, 19, 15, 1);
        // tea surface
        P.ellipse('t', 14, 15, 10, 1.6);
        // the planet bobbing in the tea
        P.ellipse('r', 14, 11, 8.4, 2.2);
        P.circle('o', 14, 10, 4.8);
        P.clip(['o'], () => { P.rect('O', 8, 8, 12, 1); P.rect('O', 8, 12, 12, 1); });
        P.within(0, 11, 28, 4, () => P.clip(['o'], () => P.ellipse('r', 14, 11, 8.4, 2.2)));
        P.within(0, 11, 28, 4, () => P.clip(['r'], () => P.ellipse('o', 14, 10.5, 4.6, 0.9)));
    },
});

const koi = defineArt({
    id: 'koi', title: 'Robot Koi', w: 32, h: 32,
    blurb: 'Clockwork fins, lantern eyes, and a pond full of lily pads.',
    colors: {
        t: ['#24557a', 'Pond'], T: ['#173d5e', 'Deep Pond'], l: ['#5fbf74', 'Lily Pad'], L: ['#317d4a', 'Pad Shade'], p: ['#ffb3d1', 'Lotus'],
        k: ['#f2f0ea', 'Koi White'], o: ['#ff7a3d', 'Koi Orange'], m: ['#9aa8c4', 'Clockwork'], y: ['#ffe066', 'Lantern Eye'],
        r: ['#7fd0f0', 'Ripple'],
    },
    draw(P) {
        P.fill('t');
        P.ellipse('T', 6, 26, 9, 7);
        P.ellipse('T', 28, 4, 8, 6);
        P.ring('r', 22, 23, 4, 4.9, 0.5);
        P.ring('r', 8, 7, 3, 3.8, 0.5);
        // lily pads
        for (const [x, y, r] of [[5, 6, 4], [26, 25, 5], [27, 9, 3]]) {
            P.circle('l', x, y, r);
            P.poly('t', [[x, y], [x + r + 1, y - 1.5], [x + r + 1, y + 1]]);
            P.edge('L', 'l', 0, 1);
        }
        P.twinkle('p', 5, 5, 1);
        P.dots('y', [[5, 5]]);
        P.twinkle('p', 25, 24, 1);
        P.dots('y', [[25, 24]]);
        // the koi, swimming diagonally
        P.poly('k', [[8, 24], [13, 15], [19, 9], [23, 8], [24, 11], [19, 17], [11, 25]]);
        P.poly('m', [[8, 24], [3, 28], [5, 23], [3, 20], [9, 22]]);
        P.poly('m', [[14, 17], [10, 14], [14, 14.4]]);
        P.poly('m', [[19, 16], [21, 20], [17.5, 18.5]]);
        P.clip(['k'], () => { P.circle('o', 20, 11, 2.6); P.circle('o', 13, 19, 2.4); P.circle('o', 10, 23, 1.4); });
        P.dots('y', [[22, 9]]);
        P.dots('T', [[24, 9]]);
        P.dots('m', [[16, 15], [17, 14], [15, 16]]);
    },
});

/* ───────────────────────── Portraits for the dialogue ───────────────────────── */

const portraitFern = defineArt({
    id: 'p-fern', title: 'Captain Fern', w: 16, h: 16,
    colors: {
        b: ['#22344a', 'Bridge'], g: ['#5fcf6a', 'Leaf'], G: ['#2a8a4a', 'Deep Leaf'], s: ['#e6b98c', 'Skin'],
        k: ['#2a1a1a', 'Ink'], u: ['#f2f0ea', 'Uniform'], y: ['#ffd45a', 'Badge'], p: ['#ff92b8', 'Blush'],
    },
    draw(P) {
        P.fill('b');
        P.ellipse('u', 8, 17, 7, 4.6);
        P.dots('y', [[5, 15]]);
        P.ellipse('s', 8, 9, 4.2, 4.6);
        P.rect('s', 7, 12, 3, 2);
        P.poly('g', [[3, 8], [4, 2], [8, 4]]);
        P.poly('g', [[6, 4], [9, 0], [11, 4.6]]);
        P.poly('g', [[9, 4.6], [14, 2], [13, 8]]);
        P.edge('G', 'g', 0, 1);
        P.dots('k', [[6, 9], [10, 9]]);
        P.dots('p', [[5, 11], [11, 11]]);
        P.dots('k', [[7, 12], [8, 12], [9, 12]]);
    },
});

const portraitAurelle = defineArt({
    id: 'p-aurelle', title: 'Lady Aurelle', w: 16, h: 16,
    colors: {
        s: ['#8fc6ff', 'Sky'], m: ['#cbd3e3', 'Steel'], M: ['#7d86a6', 'Steel Shade'], p: ['#ff6f9f', 'Plume'],
        f: ['#f2c8a0', 'Skin'], k: ['#2a1a2a', 'Ink'], y: ['#ffd45a', 'Gold Trim'],
    },
    draw(P) {
        P.fill('s');
        P.ellipse('m', 8, 17, 7, 4.5);
        P.ellipse('m', 8, 8.5, 5, 5.4);
        P.edge('M', 'm', 1, 0);
        P.rect('f', 5, 8, 6, 4);
        P.rect('y', 4, 7, 8, 1);
        P.dots('k', [[6, 9], [9, 9]]);
        P.dots('k', [[7, 11], [8, 11]]);
        P.poly('p', [[8, 3.5], [11, 0], [15, 1], [11, 3], [9, 4]]);
        P.rect('y', 7, 13, 2, 1);
    },
});

export const ARTWORKS = [wick, comet, prism, moonberry, glowcaps, dragon, seedpod, bolt, sprout, sheep, griffin, castle, hush, colorverse, snail, teacup, koi];
export const PORTRAIT_ART = [portraitFern, portraitAurelle];
export const ART_BY_ID = Object.fromEntries([...ARTWORKS, ...PORTRAIT_ART].map((a) => [a.id, a]));

/**
 * Who appears in the dialogue, and where their face comes from: a crop of a mosaic, or a portrait.
 * `art` is drawn grey until `colorAfter` (an artwork id) is restored.
 */
export const PORTRAITS = {
    wick: { art: 'wick', x: 0, y: 0, size: 16, colorAfter: 'wick' },
    comet: { art: 'comet', x: 0, y: 3, size: 13, colorAfter: 'comet' },
    mira: { art: 'dragon', x: 6, y: 1, size: 20, colorAfter: 'dragon' },
    fern: { art: 'p-fern', x: 0, y: 0, size: 16, colorAfter: 'sprout' },
    bolt: { art: 'bolt', x: 4, y: 0, size: 16, colorAfter: 'bolt' },
    aurelle: { art: 'p-aurelle', x: 0, y: 0, size: 16, colorAfter: 'castle' },
    sunwing: { art: 'griffin', x: 1, y: 4, size: 14, colorAfter: 'griffin' },
    hush: { art: 'hush', x: 4, y: 0, size: 24, colorAfter: 'hush' },
};
