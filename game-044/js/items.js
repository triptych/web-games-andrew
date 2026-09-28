/**
 * items.js — everything Rowan can carry: names, descriptions and icons.
 *
 * Icons are drawn with a few shapes at 16×16, snapped to the palette, then
 * given a 1px dark outline — which is most of what makes a 16px icon read as
 * pixel art instead of a blurry thumbnail.
 */

import { makeCanvas, rect, circle, ellipse, poly, line } from './paint.js';
import { quantize } from './palette.js';

export const ITEMS = {
    book: {
        name: 'Book of Tales',
        desc: "Gran's Book of Tales: red leather, gold clasp, and — since this morning — nothing but empty pages. Or almost nothing. Something has started writing in it, in a hand you don't recognise.",
    },
    penny: {
        name: 'Lucky Penny',
        desc: "Gran's lucky penny, worn smooth by sixty years of thumbs. Grandad gave it to her. It shines like it's proud of something.",
    },
    cake: {
        name: 'Honey Cake',
        desc: 'A honey cake, sticky and still faintly warm. Gran baked it this morning, before she forgot the recipe.',
    },
    rope: {
        name: 'Coil of Rope',
        desc: 'Thirty feet of good hemp rope. Gran used it to hang washing; you are planning something more heroic.',
    },
    poker: {
        name: 'Iron Poker',
        desc: 'A black iron fire-poker with a hooked end. Heavy, blunt and oddly reassuring.',
    },
    brasskey: {
        name: 'Little Brass Key',
        desc: 'A tiny brass key, too small for any door — the kind that winds a clock, or a toy. A thread of blue ribbon is still knotted through its bow.',
    },
    button: {
        name: 'Red Button',
        desc: "A shiny red button with four holes. It came off a very small coat.",
    },
    moonbells: {
        name: 'Moonbells',
        desc: 'A posy of moonbells, glowing faintly blue. They smell like cold air and clean sheets — like the moment just before sleep.',
    },
    quill: {
        name: 'Golden Quill',
        desc: 'A quill of real gold, its feather stiff with old ink. Tiny letters run along the shaft: C.H. — FOR ENDINGS.',
    },
    bone: {
        name: 'Soup Bone',
        desc: "A large bone, boiled clean of soup but very much not of smell.",
    },
    draught: {
        name: 'Sleeping Draught',
        desc: "A blue vial of Wenna's sleeping draught. \"Three drops for a hound,\" she said. \"And don't you go drinking it.\"",
    },
    drowsybone: {
        name: 'Drowsy Bone',
        desc: 'The soup bone, generously dosed with sleeping draught. It smells of soup, moonbells and poor decisions — irresistible to a hound.',
    },
    silverkey: {
        name: 'Silver Key',
        desc: 'A slender silver key with a lighthouse worked into its bow.',
    },
    bottle: {
        name: "Mab's Bottle",
        desc: 'A stoppered bottle glowing the exact gold of Gran\'s hearth. The label reads MAB ASHBY, BRACKENFORD — ALL OF THEM. It is warm, and very faintly, it hums.',
    },
    tale: {
        name: 'The Unfinished Tale',
        desc: 'A thin, hand-sewn booklet: "The Lighthouse at the End of the World — for Elsie, by Papa."',
    },
};

const K = '#0d0b14';

const DRAW = {
    book(g) {
        rect(g, 3, 2, 10, 12, '#b8332f');
        rect(g, 3, 2, 2, 12, '#6e1f24');
        rect(g, 12, 3, 2, 11, '#f4ecd8');
        rect(g, 6, 4, 5, 4, '#f4c542');
        rect(g, 7, 5, 3, 2, '#b8332f');
        rect(g, 12, 7, 3, 2, '#f4c542');
    },
    penny(g) {
        circle(g, 8, 8, 5.5, '#a0703c');
        circle(g, 8, 8, 4.5, '#e0782c');
        circle(g, 7, 7, 2.5, '#f0a878');
        rect(g, 6, 6, 1, 1, '#fbe7a1');
    },
    cake(g) {
        ellipse(g, 8, 11, 6.5, 3, '#a0703c');
        rect(g, 1.5, 7, 13, 4, '#cfa168');
        ellipse(g, 8, 7, 6.5, 3, '#f4c542');
        ellipse(g, 7, 6.5, 3, 1.2, '#fbe7a1');
        rect(g, 4, 9, 1, 2, '#f4c542');
        rect(g, 10, 9, 1, 3, '#f4c542');
    },
    rope(g) {
        for (let i = 0; i < 3; i++) {
            g.strokeStyle = i % 2 ? '#cfa168' : '#a0703c';
            g.lineWidth = 1.6;
            g.beginPath();
            g.ellipse(8, 8, 6 - i * 1.8, 5 - i * 1.5, 0, 0, Math.PI * 2);
            g.stroke();
        }
        line(g, 12, 11, 14, 15, '#a0703c', 1.5);
    },
    poker(g) {
        line(g, 3, 14, 12, 3, '#555c6a', 2);
        line(g, 12, 3, 14, 5, '#555c6a', 2);
        line(g, 4, 12, 6, 10, '#2e3440', 3);
        rect(g, 11, 2, 1, 1, '#8a90a0');
    },
    brasskey(g) {
        circle(g, 5, 5, 3.5, '#f4c542');
        circle(g, 5, 5, 1.5, 'rgba(0,0,0,0)');
        g.clearRect(4, 4, 2, 2);
        line(g, 7, 7, 13, 13, '#e0782c', 2);
        rect(g, 11, 12, 2, 3, '#e0782c');
        rect(g, 9, 11, 2, 2, '#e0782c');
        rect(g, 1, 1, 3, 1, '#3f5f9a');
    },
    button(g) {
        circle(g, 8, 8, 5, '#b8332f');
        circle(g, 8, 8, 3.5, '#c86f8f');
        rect(g, 6, 6, 1, 1, K); rect(g, 9, 6, 1, 1, K);
        rect(g, 6, 9, 1, 1, K); rect(g, 9, 9, 1, 1, K);
    },
    moonbells(g) {
        line(g, 8, 15, 8, 6, '#3f8a3a', 1);
        line(g, 8, 10, 4, 6, '#3f8a3a', 1);
        line(g, 8, 9, 12, 5, '#3f8a3a', 1);
        for (const [x, y] of [[4, 5], [8, 4], [12, 4]]) {
            ellipse(g, x, y, 2.2, 2, '#a8c8e8');
            rect(g, x - 2, y + 1, 4, 1, '#6d93c9');
        }
        rect(g, 7, 12, 3, 2, '#74b94a');
    },
    quill(g) {
        g.save();
        g.translate(8, 8);
        g.rotate(-0.8);
        ellipse(g, 0, -1, 2.6, 6.5, '#f4c542');
        rect(g, -0.5, -6, 1, 12, '#e0782c');
        ellipse(g, 0.8, -2, 1, 4, '#fbe7a1');
        g.restore();
        line(g, 3, 13, 5, 11, '#e0782c', 1);
        rect(g, 2, 14, 1, 1, K);
    },
    bone(g) {
        line(g, 4, 12, 12, 4, '#f4ecd8', 3);
        circle(g, 3, 11, 1.8, '#f4ecd8'); circle(g, 5, 13, 1.8, '#f4ecd8');
        circle(g, 11, 3, 1.8, '#f4ecd8'); circle(g, 13, 5, 1.8, '#f4ecd8');
        line(g, 6, 11, 11, 6, '#c3c7d0', 1);
    },
    draught(g) {
        ellipse(g, 8, 10, 4.5, 4.5, '#3f5f9a');
        rect(g, 6.5, 2, 3, 5, '#a8c8e8');
        rect(g, 6, 1, 4, 2, '#a0703c');
        ellipse(g, 8, 11, 3.2, 2.8, '#6d93c9');
        rect(g, 6, 8, 1, 2, '#ffffff');
    },
    drowsybone(g) {
        DRAW.bone(g);
        rect(g, 7, 7, 2, 2, '#6d93c9');
        rect(g, 10, 6, 1, 1, '#6d93c9');
        rect(g, 4, 9, 1, 1, '#6d93c9');
        rect(g, 11, 11, 3, 1, '#a8c8e8'); rect(g, 13, 10, 1, 1, '#a8c8e8');
        rect(g, 11, 12, 3, 1, '#a8c8e8'); rect(g, 11, 13, 1, 1, '#a8c8e8');
    },
    silverkey(g) {
        circle(g, 5, 5, 3.5, '#c3c7d0');
        g.clearRect(4, 4, 2, 2);
        rect(g, 4, 2, 2, 2, '#ffffff');
        line(g, 7, 7, 13, 13, '#8a90a0', 2);
        rect(g, 11, 12, 2, 3, '#8a90a0');
        rect(g, 9, 11, 2, 2, '#8a90a0');
    },
    bottle(g) {
        ellipse(g, 8, 10, 5, 5, '#e0782c');
        ellipse(g, 8, 10, 3.8, 3.8, '#f4c542');
        ellipse(g, 7, 9, 1.8, 1.8, '#fbe7a1');
        rect(g, 6.5, 2, 3, 4, '#f4c542');
        rect(g, 6, 1, 4, 2, '#6b4226');
        rect(g, 4, 10, 8, 2, '#f4ecd8');
    },
    tale(g) {
        poly(g, [[3, 3], [12, 2], [13, 13], [4, 14]], '#f4ecd8');
        poly(g, [[3, 3], [5, 3], [6, 14], [4, 14]], '#cfa168');
        line(g, 7, 5, 11, 5, '#6d93c9', 1);
        line(g, 7, 7, 11, 7, '#8a90a0', 1);
        line(g, 7, 9, 11, 9, '#8a90a0', 1);
        line(g, 7, 11, 9, 11, '#8a90a0', 1);
        rect(g, 10, 10, 1, 3, '#2b3a67');
    },
};

const iconCache = new Map();

export function itemIcon(id) {
    if (iconCache.has(id)) return iconCache.get(id);
    const c = makeCanvas(16, 16);
    const g = c.getContext('2d');
    (DRAW[id] || DRAW.book)(g);
    quantize(c, 10);
    outline(c);
    iconCache.set(id, c);
    return c;
}

/** Add a 1px dark border around opaque pixels. */
export function outline(c, color = [13, 11, 20]) {
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data, w = c.width, h = c.height;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push((y * w + x) * 4);
    }
    for (const i of add) { d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    return c;
}

// --- verb icons (same pipeline as items) ------------------------------------

const VERB_DRAW = {
    walk(g) {
        // a boot mid-stride
        poly(g, [[4, 3], [9, 3], [9, 10], [14, 11], [14, 14], [4, 14]], '#6b4226');
        rect(g, 4, 3, 5, 2, '#a0703c');
        rect(g, 4, 13, 10, 1, '#3a2418');
        rect(g, 10, 11, 1, 1, '#cfa168');
    },
    look(g) {
        ellipse(g, 8, 8, 7, 4.5, '#f4ecd8');
        circle(g, 8, 8, 3, '#2f8a8a');
        circle(g, 8, 8, 1.5, '#0d0b14');
        rect(g, 9, 6, 1, 1, '#ffffff');
    },
    use(g) {
        // an open hand
        rect(g, 4, 7, 9, 7, '#e8b89a');
        for (let i = 0; i < 4; i++) rect(g, 4 + i * 2.3, 2 + (i === 0 || i === 3 ? 1 : 0), 1.8, 6, '#e8b89a');
        poly(g, [[12, 9], [15, 6], [15, 8], [13, 11]], '#e8b89a');
        rect(g, 4, 12, 9, 2, '#b07a5a');
    },
    talk(g) {
        ellipse(g, 8, 7, 7, 5, '#f4ecd8');
        poly(g, [[4, 10], [7, 11], [3, 15]], '#f4ecd8');
        rect(g, 5, 7, 1, 1, '#2b3a67'); rect(g, 8, 7, 1, 1, '#2b3a67'); rect(g, 11, 7, 1, 1, '#2b3a67');
    },
};

export function verbIcon(verb) {
    const key = 'verb:' + verb;
    if (iconCache.has(key)) return iconCache.get(key);
    const c = makeCanvas(16, 16);
    VERB_DRAW[verb](c.getContext('2d'));
    quantize(c, 8);
    outline(c);
    iconCache.set(key, c);
    return c;
}

/** A CSS cursor value built from an icon, scaled up 2× with hard pixels. */
export function cursorFor(icon, fallback = 'pointer') {
    try {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(icon, 0, 0, 32, 32);
        return `url(${c.toDataURL()}) 16 16, ${fallback}`;
    } catch {
        return fallback;
    }
}
