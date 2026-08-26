/**
 * Hand-authored pixel art.
 *
 * Sprites are written as rows of colour letters so they can be read and
 * edited as pictures in the source. `compile()` checks that every row of a
 * sprite is the same width and throws otherwise, which turns a miscounted
 * row — the classic way to ruin pixel art in a text editor — into a loud
 * failure at startup instead of a subtly skewed monster.
 */

import { TRANSPARENT } from './framebuffer.js';

const CODES = {
    '.': TRANSPARENT,
    'k': 0, 'b': 1, 'g': 2, 'c': 3, 'r': 4, 'm': 5, 'n': 6, 'l': 7,
    'd': 8, 'B': 9, 'G': 10, 'C': 11, 'R': 12, 'M': 13, 'y': 14, 'w': 15
};

export function compile(name, rows) {
    const w = rows[0].length;
    rows.forEach((row, i) => {
        if (row.length !== w) {
            throw new Error(`sprite "${name}" row ${i} is ${row.length} wide, expected ${w}`);
        }
    });
    const data = new Uint8Array(w * rows.length);
    rows.forEach((row, y) => {
        for (let x = 0; x < w; x++) {
            const c = CODES[row[x]];
            if (c === undefined) throw new Error(`sprite "${name}" row ${y} has unknown colour "${row[x]}"`);
            data[y * w + x] = c;
        }
    });
    return { w, h: rows.length, data, name };
}

/**
 * A second animation frame, derived rather than drawn: the lower body
 * leans one pixel and the whole figure settles by a row. Two frames of
 * this at a slow rate is exactly how much animation a 1991 crawler had.
 */
export function lurchFrame(bmp) {
    const { w, h, data } = bmp;
    const out = new Uint8Array(w * h).fill(TRANSPARENT);
    for (let y = 0; y < h; y++) {
        const shift = y > h * 0.6 ? 1 : (y > h * 0.35 ? 0 : -1);
        const src = Math.min(h - 1, y + (y > h * 0.5 ? 1 : 0));
        for (let x = 0; x < w; x++) {
            const sx = x - shift;
            if (sx < 0 || sx >= w) continue;
            out[y * w + x] = data[src * w + sx];
        }
    }
    return { w, h, data: out, name: bmp.name + ':lurch' };
}

/**
 * Paste one bitmap onto another on a fresh canvas of the given size, so a
 * pose can be assembled from parts already drawn instead of redrawn.
 */
export function composite(name, w, h, parts) {
    const data = new Uint8Array(w * h).fill(TRANSPARENT);
    for (const { bmp, x: ox, y: oy } of parts) {
        for (let y = 0; y < bmp.h; y++) {
            const dy = y + oy;
            if (dy < 0 || dy >= h) continue;
            for (let x = 0; x < bmp.w; x++) {
                const dx = x + ox;
                if (dx < 0 || dx >= w) continue;
                const c = bmp.data[y * bmp.w + x];
                if (c === TRANSPARENT) continue;
                data[dy * w + dx] = c;
            }
        }
    }
    return { w, h, data, name };
}

// --- monsters ------------------------------------------------------------

export const SKELETON = compile('skeleton', [
    '.......wwwwwwwwww.......',
    '......wwwwwwwwwwww......',
    '......wwkkwwwwkkww......',
    '......wwkkwwwwkkww......',
    '......wwwwwkkwwwww......',
    '.......wwwwwwwwww.......',
    '........wkwkwkww........',
    '.........wwwwww.........',
    '...........ww...........',
    '.......wwwwwwwwww.......',
    '....w..wwwwwwwwww..w....',
    '....w...wwwwwwww...w....',
    '....w..wwwwwwwwww..w....',
    '....w...wwwwwwww...w....',
    '....ww..wwwwwwww..ww....',
    '.....w...wwwwww...w.....',
    '.....ww..wwwwww..ww.....',
    '......ww..wwww..ww......',
    '..........wwww..........',
    '.........wwwwww.........',
    '.........ww..ww.........',
    '........ww....ww........',
    '........ww....ww........',
    '........ww....ww........',
    '........ww....ww........',
    '.......www....www.......',
    '......wwww....wwww......',
    '......wwww....wwww......'
]);

export const GHOUL = compile('ghoul', [
    '..........gggg..........',
    '........gggggggg........',
    '.......gggggggggg.......',
    '.......ggrrggrrgg.......',
    '.......gggggggggg.......',
    '........gGGGGGGg........',
    '........gwwwwwwg........',
    '.........gggggg.........',
    '......gggggggggggg......',
    '....gggggggggggggggg....',
    '....gggggggggggggggg....',
    '...gg.gggggggggggg.gg...',
    '..gg..gggggggggggg..gg..',
    '..gg...gggggggggg...gg..',
    '.GG....gggggggggg....GG.',
    '.GG.....gggggggg.....GG.',
    '........gggggggg........',
    '........gggggggg........',
    '........gg....gg........',
    '.......gg......gg.......',
    '.......gg......gg.......',
    '.......gg......gg.......',
    '......gg........gg......',
    '......gg........gg......',
    '.....ggg........ggg.....',
    '....gggg........gggg....',
    '....GGGG........GGGG....',
    '........................'
]);

export const BAT = compile('bat', [
    '........................',
    '..dd................dd..',
    '..ddd..............ddd..',
    '..dddd....nnnn....dddd..',
    '..dddddd..nnnn..dddddd..',
    '...dddddddnnnnddddddd...',
    '....ddddnnnnnnnndddd....',
    '.....dddnnrrrrnnddd.....',
    '......ddnnnnnnnndd......',
    '.......dnnwwwwnnd.......',
    '........nnnnnnnn........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '..........nnnn..........',
    '..........nn.nn.........',
    '..........n...n.........',
    '........................',
    '........................'
]);

export const WRAITH = compile('wraith', [
    '.........cccccc.........',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '......ccckkkkkkccc......',
    '......cckkkkkkkkcc......',
    '.....cckkCCkkCCkkcc.....',
    '......cckkkkkkkkcc......',
    '......cccckkkkcccc......',
    '.....cccccccccccccc.....',
    '....cccccccccccccccc....',
    '...cc.cccccccccccc.cc...',
    '..cc..cccccccccccc..cc..',
    '..CC...cccccccccc...CC..',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '......cccccccccccc......',
    '.......cccccccccc.......',
    '.......cc.cccc.cc.......',
    '........c..cc..c........',
    '........b..bb..b........',
    '.........b.bb.b.........',
    '..........b..b..........',
    '........................',
    '........................'
]);

export const GARGOYLE = compile('gargoyle', [
    '......ll........ll......',
    '......ll........ll......',
    '.......llllllllll.......',
    '......llllllllllll......',
    '......llrrllllrrll......',
    '......llllllllllll......',
    '.......llwwwwwwll.......',
    '........llllllll........',
    '..dd....llllllll....dd..',
    '.dddd..llllllllll..dddd.',
    '.ddddd.llllllllll.ddddd.',
    '.dddddllllllllllllddddd.',
    '.ddddd.llllllllll.ddddd.',
    '..dddd.llllllllll.dddd..',
    '...dd..llllllllll..dd...',
    '.......llllllllll.......',
    '........llllllll........',
    '........ll....ll........',
    '.......ll......ll.......',
    '.......ll......ll.......',
    '......lll......lll......',
    '.....llll......llll.....',
    '.....dddd......dddd.....',
    '........................'
]);

export const DEMON = compile('demon', [
    '......rr........rr......',
    '......rr........rr......',
    '.......RRRRRRRRRR.......',
    '......RRRRRRRRRRRR......',
    '......RRyyRRRRyyRR......',
    '......RRRRRRRRRRRR......',
    '.......RRyyyyyyRR.......',
    '........RRRRRRRR........',
    '.....RRRRRRRRRRRRRR.....',
    '....RRRRRRRRRRRRRRRR....',
    '...RR.RRRRRRRRRRRR.RR...',
    '..RR..RRRRRRRRRRRR..RR..',
    '..yy...RRRRRRRRRR...yy..',
    '.......RRRRRRRRRR.......',
    '......RRRRRRRRRRRR......',
    '......RRRRRRRRRRRR......',
    '.......RRRRRRRRRR.......',
    '.......RRR....RRR.......',
    '......RRR......RRR......',
    '......RRR......RRR......',
    '.....RRR........RRR.....',
    '.....RRR........RRR.....',
    '....yyyy........yyyy....',
    '....yyyy........yyyy....'
]);

export const LICH = compile('lich', [
    '.......y.y.y.y.y........',
    '.......yyyyyyyyy........',
    '........wwwwwww.........',
    '.......wwwwwwwww........',
    '.......wwMMwwMMww.......',
    '.......wwwwwwwwww.......',
    '........wwwwwwww........',
    '........wkwkwkww........',
    '......mmmmmmmmmmmm......',
    '.....mmmmmmmmmmmmmm.....',
    '...mm.mmmmmmmmmmmm.mm...',
    '..mm..mmmmmmmmmmmm..mm..',
    '..ww...mmmmmmmmmm...ww..',
    '.......mmmmmmmmmm.......',
    '......mmmmmmmmmmmm......',
    '......mmmMMMMMMmmm......',
    '......mmmMwwwwMmmm......',
    '......mmmMMMMMMmmm......',
    '......mmmmmmmmmmmm......',
    '.....mmmmmmmmmmmmmm.....',
    '.....mmmmmmmmmmmmmm.....',
    '....mmmmmmmmmmmmmmmm....',
    '....mmmmmmmmmmmmmmmm....',
    '...mmmmmmmmmmmmmmmmmm...',
    '...mmmmmmmmmmmmmmmmmm...',
    '..MMMMMMMMMMMMMMMMMMMM..',
    '..MMMMMMMMMMMMMMMMMMMM..',
    '........................'
]);

// --- items and props -----------------------------------------------------

export const POTION = compile('potion', [
    '......llll......',
    '......lccl......',
    '......lccl......',
    '.....llccll.....',
    '.....lRRRRl.....',
    '....lRRRRRRl....',
    '....lRRRRRRl....',
    '....lRwRRRRl....',
    '....lRwRRRRl....',
    '....lRRRRRRl....',
    '....lRRRRRRl....',
    '....lRRRRRRl....',
    '.....llllll.....',
    '................'
]);

export const SCROLL = compile('scroll', [
    '................',
    '..nnnnnnnnnnnn..',
    '..nllllllllllnn.',
    '..nlkkkkkkkklnn.',
    '..nlllllllllln..',
    '..nlkkkkkkkkln..',
    '..nlllllllllln..',
    '..nlkkkkkkkkln..',
    '..nlllllllllln..',
    '..nlkkkkkkkkln..',
    '..nllllllllllnn.',
    '..nnnnnnnnnnnn..',
    '................',
    '................'
]);

export const GOLD = compile('gold', [
    '................',
    '................',
    '................',
    '.......yy.......',
    '......yyyy......',
    '.....yywwyy.....',
    '....yyyyyyyy....',
    '...yyyywwyyyy...',
    '..yynyyyyyynyy..',
    '..ynnyyyyyynny..',
    '.ynnnyyyyyynnny.',
    '.nnnnnnnnnnnnnn.',
    '..nnnnnnnnnnnn..',
    '................'
]);

export const KEY = compile('key', [
    '................',
    '................',
    '.....yyyy.......',
    '....yy..yy......',
    '....y....y......',
    '....yy..yy......',
    '.....yyyy.......',
    '......yy........',
    '......yy........',
    '......yyy.......',
    '......yy........',
    '......yyy.......',
    '................',
    '................'
]);

export const CHEST = compile('chest', [
    '................',
    '...nnnnnnnnnn...',
    '..nllllllllllnn.',
    '..nlnnnnnnnnln..',
    '..nnnnnnnnnnnn..',
    '..nllllllllllnn.',
    '..nlnnnnyynnln..',
    '..nlnnnnyynnln..',
    '..nlnnnnnnnnln..',
    '..nllllllllllnn.',
    '..nnnnnnnnnnnn..',
    '................',
    '................',
    '................'
]);

export const TORCH = compile('torch', [
    '......yy........',
    '.....yyyy.......',
    '....yyRRyy......',
    '....yRRRRy......',
    '....yRRRRy......',
    '.....yRRy.......',
    '......yy........',
    '......dd........',
    '......nn........',
    '......nn........',
    '......nn........',
    '.....dnnd.......',
    '......nn........',
    '................'
]);

export const BONES = compile('bones', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..ll........ll..',
    '...llllllllll...',
    '..llllllllllll..',
    '.ll.llllllll.ll.',
    '.ll..llllll..ll.',
    '......llll......',
    '................',
    '................'
]);

export const FIREBALL = compile('fireball', [
    '......yyyy......',
    '....yyyyyyyy....',
    '...yyyyyyyyyy...',
    '..yyyywwwwyyyy..',
    '..yyywwwwwwyyy..',
    '.RRyywwwwwwyyRR.',
    '.RRyywwwwwwyyRR.',
    '.RRyyywwwwyyyRR.',
    '..RRyyyyyyyyRR..',
    '..RRRyyyyyyRRR..',
    '...RRRRyyRRRR...',
    '....rRRRRRRr....',
    '.....rrRRrr.....',
    '......rrrr......'
]);

/**
 * The player's own hand, thrust into the bottom of the view. This is the
 * single most recognisable thing about the Catacomb games and it is drawn
 * as screen furniture, not as a billboard in the world.
 */
export const HAND = compile('hand', [
    '....nn...nn...nn...nn.....',
    '...nlln.nlln.nlln.nlld....',
    '...nlln.nlln.nlld.nlld....',
    '...nllnnnlldnnlldnnlld....',
    '..nnlllldllllddlllldd.....',
    '..nlllllllllllllllllddn...',
    '.nnllllllllllllllllllldn..',
    '.nllllwwlllllllllllllldn..',
    'nnlllwwwllllllllllllllddn.',
    'nlllllwwlllllllllllllllddn',
    'nllllllllllllllllllllllddn',
    'nnlllllllllllllllllllllddn',
    '.nnllllllllllllllllllllddn',
    '..nlllllllllllllllllllddn.',
    '..nnlllllllllllllllllddn..',
    '...nnlllllllllllllllddn...',
    '....nnllllllllllllldddn...',
    '.....nnnlllllllllddddn....',
    '.......nnnnnnnnnnnnnn.....',
    '..........................'
]);

export const HAND_CAST = composite('hand-cast', 26, 32, [
    { bmp: HAND, x: 0, y: 12 },
    { bmp: FIREBALL, x: 5, y: 0 }
]);

// --- status-bar portrait -------------------------------------------------

export const FACE_OK = compile('face-ok', [
    '......nnnnnnnnnnnn......',
    '....nnnnnnnnnnnnnnnn....',
    '...nnnnnnnnnnnnnnnnnn...',
    '...nnllllllllllllllnn...',
    '...nlllllllllllllllllnn.',
    '..nnllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nllkkkkllllllkkkklln..',
    '..nllkwwkllllllkwwklln..',
    '..nllkkkkllllllkkkklln..',
    '..nlllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllllllnnlllllllln..',
    '..nllllllllnnlllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllnnnnnnnnnnlllln..',
    '..nlllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nnllllllllllllllllln..',
    '...nnllllllllllllllnn...',
    '....nnnnnnnnnnnnnnnn....',
    '......nnnnnnnnnnnn......'
]);

export const FACE_HURT = compile('face-hurt', [
    '......nnnnnnnnnnnn......',
    '....nnnnnnnnnnnnnnnn....',
    '...nnnnnnnnnnnnnnnnnn...',
    '...nnllllllllllllllnn...',
    '...nlllllllllllllllllnn.',
    '..nnllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllllllllllkkkklln..',
    '..nllkkkkllllllkwwklln..',
    '..nllllllllllllkkkklln..',
    '..nlllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllllllnnlllllllln..',
    '..nllllllllnnlllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllnnnnnnnnnnlllln..',
    '..nllllwwwwwwwwwwlllln..',
    '..nlllllllllllllllllln..',
    '..nnllllllllllllllllln..',
    '...nnllllllllllllllnn...',
    '....nnnnnnnnnnnnnnnn....',
    '......nnnnnnnnnnnn......'
]);

export const FACE_BAD = compile('face-bad', [
    '......nnnnnnnnnnnn......',
    '....nnnnnnnnnnnnnnnn....',
    '...nnnnnnnnnnnnnnnnnn...',
    '...nnllllllllllllllnn...',
    '...nlllllllllllllllllnn.',
    '..nnllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nllkkkkllllllkkkklln..',
    '..nllkrrkllllllkrrklln..',
    '..nllkkkkllllllkkkklln..',
    '..nllllllllllllrllllln..',
    '..nllllllllllllrllllln..',
    '..nllllllllnnlllllllln..',
    '..nllllllllnnlllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllnnnnnnnnnnlllln..',
    '..nllllwwwwwwwwwwlllln..',
    '..nlllllllllllllllllln..',
    '..nnllllllllllllllllln..',
    '...nnllllllllllllllnn...',
    '....nnnnnnnnnnnnnnnn....',
    '......nnnnnnnnnnnn......'
]);

export const FACE_DEAD = compile('face-dead', [
    '......nnnnnnnnnnnn......',
    '....nnnnnnnnnnnnnnnn....',
    '...nnnnnnnnnnnnnnnnnn...',
    '...nnllllllrrllllllnn...',
    '...nlllllllllllllllllnn.',
    '..nnllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nllklllllllllkllllln..',
    '..nlllkkllllllllkkllln..',
    '..nllllklllllllllkllln..',
    '..nlllllllllllllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllllllnnlllllllln..',
    '..nllllllllnnlllllllln..',
    '..nlllllllllllllllllln..',
    '..nllllkkkkkkkkkklllln..',
    '..nllllkkkkkkkkkklllln..',
    '..nlllllllllllllllllln..',
    '..nnllllllllllllllllln..',
    '...nnllllllllllllllnn...',
    '....nnnnnnnnnnnnnnnn....',
    '......nnnnnnnnnnnn......'
]);
