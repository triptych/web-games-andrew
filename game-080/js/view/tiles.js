// Tile art: ground, walls, water and the scenery that stands on tiles (trees, shelves, chests).
// Painted in code into 16 × 16 (or taller, for things that stand up) canvases and cached by
// (tile, style, variant, frame). `style` is the zone's biome outdoors, the map's style indoors.

import { canvas, painter, outline, shade, nz, mix } from './paint.js';

const cache = new Map();
const OUT = '#2a2226';

// ------------------------------------------------------------------ palettes
export const GRASS = {
    village: ['#74b252', '#62a046', '#8cc866'], farm: ['#7bb655', '#69a349', '#93ca6a'],
    meadow: ['#7cba54', '#6aa748', '#96d06a'], wood: ['#5b9a46', '#4b873b', '#6dac55'],
    hill: ['#82b65a', '#70a24c', '#98c86c'], castle: ['#72ae52', '#609a46', '#8ac466'],
    willow: ['#64a65c', '#54924e', '#78ba6c'], mouse: ['#80bc58', '#6ea84a', '#9ad46e'],
    green: ['#74b85c', '#62a44e', '#8ccc70'], coast: ['#8cba62', '#7aa654', '#a2cc74'],
    thorn: ['#557a3c', '#476a32', '#678c4a'], moor: ['#8e9460', '#7c8252', '#a0a670'],
    abbeyg: ['#7c8460', '#6a7252', '#8e9670'], peak: ['#7aa060', '#688c50', '#8eb472'],
    quarry: ['#8a9a60', '#788650', '#9cac70'], sky: ['#88b868', '#76a45a', '#9cca7c'], lake: ['#7cba54', '#6aa748', '#96d06a'],
};

// interior and dungeon styles: [floor, floor dark, wall top, wall face, wall face dark, trim]
export const ROOM = {
    library: ['#a87a4e', '#8e643e', '#4a3226', '#7a4e32', '#5a3826', '#c89a5a'],
    shop:    ['#b08458', '#946c46', '#4a3a2e', '#d8c49a', '#b8a47a', '#8a5a3a'],
    house:   ['#ac8054', '#916a44', '#4a3a2e', '#e2cfa6', '#c4b086', '#9a6a44'],
    bakery:  ['#b8885a', '#9a7048', '#4a3a2e', '#f0dcb4', '#d0bc94', '#c0392b'],
    inn:     ['#a67a4c', '#8a643e', '#3e2e24', '#c89a6a', '#a87a4e', '#6a4a2e'],
    hut:     ['#8a6a4a', '#74583c', '#3a2e24', '#9a7a52', '#7a5e40', '#5a4a3a'],
    cabin:   ['#9a7048', '#805a3a', '#3e2e22', '#a0703e', '#80562e', '#5a3a22'],
    lodge:   ['#9a7048', '#805a3a', '#3e2e22', '#b0804e', '#8e643a', '#c0392b'],
    mill:    ['#b08a5c', '#94704a', '#4a3a2e', '#d8c8a0', '#b8a880', '#8a6a44'],
    castle:  ['#b8b0a0', '#9c9484', '#3e3a44', '#8a8494', '#6a6474', '#c0392b'],
    bark:    ['#8a6038', '#704c2c', '#3a2a1a', '#6a4a2a', '#4e3620', '#9ac060'],
    cave:    ['#6a6070', '#565060', '#26222c', '#4a4452', '#3a3440', '#8de0ff'],
    brick:   ['#9a7a64', '#806450', '#3a2a24', '#a05a3a', '#7a442c', '#e0a050'],
    rock:    ['#9a9080', '#82786a', '#3a342e', '#7a7064', '#5e564c', '#c0a070'],
    ice:     ['#cfe8f4', '#b0d4e8', '#3a5a74', '#8ec4e0', '#6aa4c8', '#ffffff'],
    burrow:  ['#9a7452', '#805e40', '#3a2a1e', '#7a5a3e', '#5e442e', '#e8b7d6'],
    glass:   ['#6a9a5a', '#58864a', '#2a3a2a', '#a8d8c8', '#88b8a8', '#ffffff'],
    coral:   ['#7aa0a8', '#648890', '#1e3a44', '#5a8a9a', '#406e7e', '#f0a08a'],
    abbey:   ['#8a8494', '#746e80', '#26222e', '#5a5468', '#443e52', '#c9b6ff'],
    sky:     ['#c8c4dc', '#aca8c4', '#2e2a4a', '#8a86b4', '#6c689a', '#ffe08a'],
    ink:     ['#3a3448', '#2e2a3a', '#0e0c14', '#2a2438', '#1a1626', '#8a6aff'],
};

const T16 = 16;

function get(key, w, h, draw) {
    let c = cache.get(key);
    if (c) return c;
    const cv = canvas(w, h);
    draw(painter(cv.g), cv.g, cv.c);
    cache.set(key, cv.c);
    return cv.c;
}

// ------------------------------------------------------------------ ground
function speckle(P, base, cols, density, seed) {
    P.R(0, 0, 16, 16, base);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const r = nz(x, y, seed);
        if (r < density) P.px(x, y, cols[Math.floor(r / density * cols.length)]);
    }
}

function grassTile(P, pal, v, flowers) {
    speckle(P, pal[0], [pal[1], pal[2]], 0.18, v * 7 + 1);
    // blades
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(nz(i, v, 3) * 15), y = 2 + Math.floor(nz(i, v, 4) * 13);
        P.px(x, y, pal[1]); P.px(x, y - 1, pal[2]);
    }
    if (flowers) {
        const cols = ['#ffffff', '#ffe066', '#f5a3c7', '#9fc8ff', '#ff9a6a'];
        for (let i = 0; i < 3; i++) {
            const x = 2 + Math.floor(nz(i, v, 9) * 12), y = 2 + Math.floor(nz(i, v, 10) * 12);
            const c = cols[Math.floor(nz(i, v, 11) * cols.length)];
            P.px(x, y, c); P.px(x + 1, y, c); P.px(x, y + 1, c); P.px(x + 1, y + 1, shade(c, -0.2));
            P.px(x, y + 2, pal[1]);
        }
    }
}

export function ground(name, style, v) {
    v &= 3;
    return get(`g:${name}:${style}:${v}`, 16, 16, (P) => {
        const pal = GRASS[style] || GRASS.village;
        const room = ROOM[style];
        switch (name) {
            case 'grass': grassTile(P, pal, v, false); break;
            case 'flowers': grassTile(P, pal, v, true); break;
            case 'path': speckle(P, '#c9a66c', ['#b8955c', '#d8b880', '#a8865a'], 0.22, v + 20);
                for (let i = 0; i < 3; i++) P.px(nz(i, v, 5) * 15, nz(i, v, 6) * 15, '#9a7a50'); break;
            case 'cobble': {
                P.R(0, 0, 16, 16, '#9a8e7e');
                const st = ['#c8bca8', '#bcb09c', '#d2c6b2'];
                for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) {
                    const ox = (r % 2) * 3 + c * 6, oy = r * 4;
                    const sc = st[(((r + c + v) % 3) + 3) % 3]; P.R(ox + 1, oy + 1, 5, 3, sc); P.R(ox + 1, oy + 3, 5, 1, shade(sc, -0.12));
                }
                break;
            }
            case 'sand': speckle(P, '#ecd9a0', ['#dcc78c', '#f6e8bc', '#d0b87c'], 0.2, v + 30); break;
            case 'snow': speckle(P, '#eef4fa', ['#dce8f4', '#ffffff', '#cfdcec'], 0.14, v + 40);
                if (v === 1) { P.px(4, 6, '#c8d8e8'); P.px(5, 6, '#c8d8e8'); } break;
            case 'moor': speckle(P, pal[0], [pal[1], pal[2], '#8a6a8a'], 0.22, v + 50);
                for (let i = 0; i < 2; i++) P.px(nz(i, v, 51) * 15, nz(i, v, 52) * 15, '#a07aa8'); break;
            case 'farm': P.R(0, 0, 16, 16, '#8a6440');
                for (let y = 1; y < 16; y += 4) { P.R(0, y, 16, 2, '#7a5634'); P.R(0, y + 2, 16, 1, '#9a7450'); } break;
            case 'stone': speckle(P, '#a8a294', ['#989284', '#b8b2a4', '#8a8478'], 0.2, v + 60);
                if (v === 2) P.line(3, 5, 7, 8, '#888072'); break;
            case 'moss': speckle(P, '#557a3c', ['#476a32', '#678c4a', '#3e5c2c'], 0.25, v + 70); break;
            case 'ash': speckle(P, '#5a5450', ['#4a4440', '#6a6460', '#3a3430'], 0.3, v + 80);
                P.px(4 + v, 9, '#e8823a'); P.px(11 - v, 4, '#c05a2a'); break;
            case 'rubble': grassLike(P, style, v); for (let i = 0; i < 5; i++) { const x = nz(i, v, 91) * 13, y = nz(i, v, 92) * 13; P.R(x, y, 2, 2, '#9a9284'); P.px(x, y, '#c0b8a8'); } break;
            case 'ice': P.R(0, 0, 16, 16, '#bfe2f4'); P.R(0, 0, 16, 1, '#e6f6ff'); P.line(2, 4, 8, 9, '#9ccbe4'); P.line(10, 2, 13, 12, '#d8f0ff'); P.px(5, 12, '#ffffff'); break;
            case 'bridge': P.R(0, 0, 16, 16, '#9a6a3e');
                for (let x = 0; x < 16; x += 4) { P.R(x, 0, 1, 16, '#7a4e2c'); P.R(x + 1, 0, 1, 16, '#b07e4e'); }
                P.R(0, 0, 16, 1, '#6a4428'); P.R(0, 15, 16, 1, '#6a4428'); break;
            case 'vineup': P.R(0, 0, 16, 16, '#8a7a64'); P.R(0, 0, 16, 2, '#a0907a');
                for (let y = 0; y < 16; y += 3) { P.R(3, y, 2, 2, '#4f9a3c'); P.R(11, y + 1, 2, 2, '#5fae4a'); P.px(7, y + 2, '#7fd36a'); }
                P.R(7, 0, 2, 16, '#3e7a2e'); break;
            case 'ghostfloor': floorTile(P, room || ROOM.abbey, v); P.px(7, 7, '#c9b6ff'); P.px(8, 8, '#c9b6ff'); break;
            case 'opendoor': floorTile(P, room || ROOM.castle, v); P.R(2, 0, 12, 2, '#3a3440'); break;
            case 'starfloor': P.R(0, 0, 16, 16, '#14102a');
                for (let i = 0; i < 6; i++) P.px(nz(i, v, 3) * 16, nz(i, v, 4) * 16, '#ffe08a'); P.R(4, 4, 8, 8, '#2a2050'); P.R(6, 6, 4, 4, '#4a3a8a'); break;
            case 'door': case 'stairs': floorTile(P, room || ROOM.house, v); break;
            case 'mark': floorTile(P, room || ROOM.abbey, v); P.disc(7, 7, 5, mix((room || ROOM.abbey)[0], '#c9b6ff', 0.5)); P.disc(7, 7, 3, (room || ROOM.abbey)[0]); break;
            case 'rug': {
                const r = style === 'library' ? ['#8a3040', '#a84858', '#e0b050'] : style === 'castle' ? ['#9a2030', '#b83848', '#e8c040'] : ['#4a6a9a', '#5a7aaa', '#e0c070'];
                P.R(0, 0, 16, 16, r[0]);
                for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 * 2; x < 16; x += 4) P.R(x, y, 2, 2, r[1]);
                P.px(8, 8, r[2]); break;
            }
            case 'carpet': P.R(0, 0, 16, 16, '#7a3a4a'); P.R(0, 0, 16, 1, '#9a5a6a'); break;
            case 'wood': case 'tile': case 'cave': case 'hall': default:
                floorTile(P, room || ROOM.house, v, name);
        }
    });
}

function grassLike(P, style, v) {
    if (style === 'quarry' || style === 'sky') speckle(P, '#a8a294', ['#989284', '#b8b2a4'], 0.2, v + 60);
    else if (style === 'peak') speckle(P, '#eef4fa', ['#dce8f4', '#ffffff'], 0.14, v + 40);
    else grassTile(P, GRASS[style] || GRASS.village, v, false);
}

function floorTile(P, room, v, name) {
    const [f, fd, , , , trim] = room;
    if (name === 'wood' || (!name && false)) {
        P.R(0, 0, 16, 16, f);
        for (let y = 0; y < 16; y += 4) { P.R(0, y + 3, 16, 1, fd); const s = ((y / 4) * 7 + v * 3) % 16; P.R(s, y, 1, 3, fd); }
        P.px((v * 5) % 16, 1 + v, shade(f, 0.12));
        return;
    }
    if (name === 'tile') {
        P.R(0, 0, 16, 16, f);
        P.R(0, 7, 16, 1, fd); P.R(0, 15, 16, 1, fd); P.R(7, 0, 1, 8, fd); P.R(15, 8, 1, 8, fd);
        P.px(2 + v, 3, shade(f, 0.12)); P.px(10, 11 - v, shade(f, 0.12));
        return;
    }
    if (name === 'cave') {
        speckle(P, f, [fd, shade(f, 0.1)], 0.3, v + 101);
        if (v === 3) { P.R(5, 9, 3, 2, fd); }
        return;
    }
    // dungeon hall / generic: flagstones in the room's colours
    P.R(0, 0, 16, 16, f);
    const off = v % 2 ? 4 : 0;
    P.R(0, 7, 16, 1, fd); P.R(0, 15, 16, 1, fd); P.R((3 + off) % 16, 0, 1, 7, fd); P.R((11 + off) % 16, 8, 1, 7, fd);
    if (v === 2) P.px(6, 11, trim);
}

// ------------------------------------------------------------------ walls and cliffs (they know their neighbours)
// face: the tile below is open, so we see the wall's front.
export function wallTile(name, style, face, v) {
    v &= 1;
    return get(`w:${name}:${style}:${face}:${v}`, 16, 16, (P) => {
        if (name === 'cliff' || name === 'stonewall' || name === 'pit' || name === 'reef' || name === 'rapids') return outdoorWall(P, name, style, face, v);
        const room = ROOM[style] || ROOM.house;
        const [, , top, fc, fcd, trim] = room;
        if (!face) {
            P.R(0, 0, 16, 16, top);
            P.px(3 + v * 7, 5, shade(top, 0.08)); P.px(11 - v * 5, 12, shade(top, 0.08));
            return;
        }
        P.R(0, 0, 16, 4, top);
        P.R(0, 4, 16, 12, fc);
        P.R(0, 4, 16, 1, shade(fc, 0.15));
        P.R(0, 14, 16, 2, fcd);
        switch (style) {
            case 'library': case 'inn': case 'cabin': case 'lodge': case 'hut':
                for (let x = 0; x < 16; x += 5) P.R(x, 5, 1, 9, fcd);
                P.R(0, 10, 16, 1, trim);
                break;
            case 'shop': case 'house': case 'bakery': case 'mill':
                for (let x = 1; x < 16; x += 4) for (let y = 6; y < 13; y += 3) P.px(x + (y % 2), y, fcd);
                P.R(0, 12, 16, 1, trim);
                break;
            case 'castle': case 'brick': case 'abbey': case 'rock': case 'burrow': case 'coral': case 'ink': case 'sky': case 'bark': case 'ice': case 'glass': case 'cave':
            default:
                for (let y = 5; y < 14; y += 3) {
                    P.R(0, y + 2, 16, 1, fcd);
                    for (let x = ((y / 3) % 2) * 3; x < 16; x += 6) P.R(x, y, 1, 2, fcd);
                }
                if (style === 'glass') { P.R(2, 5, 12, 8, '#cfeee6'); P.R(2, 5, 12, 1, '#ffffff'); P.R(7, 5, 1, 8, '#88b8a8'); }
                if (style === 'ice') { P.R(4, 5, 2, 7, '#ffffff'); }
                if (style === 'ink') { P.px(5, 9, trim); }
        }
    });
}

function outdoorWall(P, name, style, face, v) {
    if (name === 'cliff') {
        const snowy = style === 'peak';
        const base = snowy ? '#9aa6b4' : style === 'quarry' ? '#9a8a70' : '#8a7e6c';
        P.R(0, 0, 16, 16, shade(base, -0.05));
        if (face) {
            P.R(0, 0, 16, 3, snowy ? '#eef4fa' : GRASS[style]?.[0] || '#7ab058');
            P.R(0, 3, 16, 13, base);
            for (let i = 0; i < 4; i++) P.R(1 + i * 4 + v, 5 + (i % 2) * 3, 1, 7, shade(base, -0.25));
            P.R(0, 3, 16, 1, shade(base, 0.2)); P.R(0, 15, 16, 1, shade(base, -0.35));
        } else {
            P.R(0, 0, 16, 16, snowy ? '#e2eaf2' : shade(base, 0.08));
            P.px(4 + v * 5, 6, shade(base, -0.15)); P.px(11, 11 - v, shade(base, -0.15));
        }
        return;
    }
    if (name === 'stonewall') {
        const base = '#9a94a0';
        P.R(0, 0, 16, 16, face ? base : '#7a7484');
        for (let y = face ? 3 : 0; y < 16; y += 4) {
            P.R(0, y + 3, 16, 1, '#5e5868');
            for (let x = ((y / 4) % 2) * 4; x < 16; x += 8) P.R(x, y, 1, 3, '#6e6878');
        }
        if (face) { P.R(0, 0, 16, 3, '#b0aab8'); P.R(0, 2, 16, 1, '#6a6474'); }
        return;
    }
    if (name === 'reef') {
        P.R(0, 0, 16, 16, '#3f86c8');
        P.ellipse(5 + v * 4, 8, 5, 4, '#7a7468'); P.ellipse(5 + v * 4, 7, 4, 3, '#9a9488'); P.px(4 + v * 4, 5, '#b8b2a6');
        P.ellipse(12 - v * 6, 12, 3, 2, '#7a7468');
        return;
    }
    if (name === 'pit') {
        const sky = style === 'sky';
        P.R(0, 0, 16, 16, sky ? '#bcd4f0' : '#0e0a12');
        if (sky) { P.ellipse(4 + v * 6, 9, 5, 3, '#e8f2fc'); P.ellipse(10 - v * 3, 13, 4, 2, '#ffffff'); }
        if (face && !sky) P.R(0, 0, 16, 2, '#3a3040');
        if (face && sky) P.R(0, 0, 16, 3, '#9a9488');
        return;
    }
    if (name === 'rapids') {
        P.R(0, 0, 16, 16, '#4a92cf');
        for (let i = 0; i < 5; i++) P.R(nz(i, v, 3) * 12, 2 + i * 3, 4, 1, '#d8eefc');
    }
}

// ------------------------------------------------------------------ animated tiles
export function waterTile(frame, style = '', edges = 0) {
    // edges: bit 1 land above, 2 right, 4 below, 8 left
    return get(`wa:${frame & 3}:${style}:${edges}`, 16, 16, (P) => {
        const sea = style === 'coast' || style === 'lake';
        const base = style === 'cave' || style === 'coral' ? '#2f6a9a' : sea ? '#3c82c4' : '#4590cc';
        P.R(0, 0, 16, 16, base);
        for (let i = 0; i < 4; i++) {
            const x = (Math.floor(nz(i, 1, 5) * 16) + frame * 2) % 16, y = Math.floor(nz(i, 2, 5) * 14) + 1;
            P.R(x, y, 3, 1, shade(base, 0.25)); P.px((x + 3) % 16, y, shade(base, 0.12));
        }
        const foam = '#d8eefc';
        if (edges & 1) { P.R(0, 0, 16, 2, foam); P.R(0, 2, 16, 1, shade(base, 0.3)); for (let x = frame % 2; x < 16; x += 3) P.px(x, 2, foam); }
        if (edges & 4) { P.R(0, 15, 16, 1, shade(base, -0.2)); }
        if (edges & 8) { P.R(0, 0, 2, 16, foam); for (let y = frame % 2; y < 16; y += 3) P.px(2, y, foam); }
        if (edges & 2) { P.R(14, 0, 2, 16, foam); for (let y = (frame + 1) % 2; y < 16; y += 3) P.px(13, y, foam); }
    });
}

export function lockTile(name, frame, style, v) {
    frame &= 3;
    return get(`l:${name}:${frame}:${style}:${v & 3}`, 16, 16, (P, g, c) => {
        switch (name) {
            case 'fog': {
                // drawn over the ground already baked beneath it
                for (let i = 0; i < 6; i++) {
                    const x = (nz(i, v, 1) * 16 + frame * 1.5) % 18 - 2, y = nz(i, v, 2) * 14;
                    P.ellipse(x, y, 5, 3, i % 2 ? 'rgba(240,244,248,0.9)' : 'rgba(220,228,236,0.92)');
                }
                P.R(0, 0, 16, 16, 'rgba(232,238,244,0.6)');
                break;
            }
            case 'thorn': {
                const st = ['#3e6a2a', '#2f5a22', '#4f7a3a'];
                P.ellipse(8, 9, 7, 6, 'rgba(40,70,30,0.55)');
                for (let i = 0; i < 11; i++) {
                    const x0 = nz(i, v, 3) * 16, y0 = 2 + nz(i, v, 4) * 13;
                    P.line(x0, y0, x0 + (nz(i, v, 5) - 0.5) * 12, y0 + (nz(i, v, 6) - 0.5) * 12, st[i % 3]);
                }
                for (let i = 0; i < 7; i++) P.px(nz(i, v, 7) * 15, 1 + nz(i, v, 8) * 14, '#d8e0b0');
                P.px(5, 6, '#e05a7a'); P.px(11, 11, '#e05a7a'); P.px(12, 4, '#f08aa0');
                break;
            }
            case 'stream': {
                g.drawImage(waterTile(frame, 'river'), 0, 0);
                for (let i = 0; i < 4; i++) P.R(((i * 5 + frame * 4) % 18) - 2, 2 + i * 4, 5, 1, '#e6f4ff');
                break;
            }
            case 'tiny': {
                P.R(0, 0, 16, 16, '#3e7a32');
                for (let i = 0; i < 12; i++) P.px(nz(i, v, 2) * 16, nz(i, v, 3) * 16, '#5a9a44');
                P.R(5, 7, 6, 9, '#6a4428'); P.R(6, 6, 4, 1, '#6a4428'); P.R(6, 8, 4, 8, '#8a5a32'); P.px(9, 12, '#e8c040');
                break;
            }
            case 'sprout': {
                g.drawImage(wallTile('cliff', style, true, v), 0, 0);
                P.R(7, 10, 1, 6, '#5fae4a'); P.R(5, 9, 2, 2, '#7fd36a'); P.R(8, 8 + frame % 2, 2, 2, '#7fd36a');
                break;
            }
            case 'ghost': {
                for (let x = 1; x < 16; x += 4) {
                    const a = 0.45 + 0.25 * Math.sin(frame * 1.6 + x);
                    P.R(x, 0, 2, 16, `rgba(201,182,255,${a.toFixed(2)})`);
                    P.px(x, (frame * 4 + x) % 16, '#ffffff');
                }
                P.R(0, 6, 16, 1, 'rgba(201,182,255,0.35)');
                break;
            }
            case 'rune': {
                P.R(0, 0, 16, 16, '#5a5468'); P.R(1, 1, 14, 15, '#6e6880'); P.R(7, 1, 1, 15, '#4a4458');
                const glow = ['#e0c060', '#f4dc80', '#ffe8a0', '#f4dc80'][frame];
                P.px(3, 4, glow); P.px(4, 5, glow); P.px(3, 6, glow); P.px(11, 4, glow); P.px(12, 5, glow); P.px(11, 7, glow); P.px(4, 10, glow); P.px(11, 11, glow); P.R(5, 13, 6, 1, glow);
                break;
            }
            case 'chasm': {
                P.R(0, 0, 16, 16, '#a8c4e8');
                for (let i = 0; i < 4; i++) P.R(((i * 7 + frame * 3) % 20) - 4, 3 + i * 3, 6, 1, '#e8f2fc');
                P.ellipse(8, 14, 6, 2, '#d8e8f8');
                break;
            }
            case 'starseal': {
                P.R(0, 0, 16, 16, '#2a2050');
                P.disc(7, 7, 7, '#3a2a70'); P.disc(7, 7, 5, '#4a3a8a');
                const tw = ['#ffe08a', '#fff4c0', '#ffe08a', '#c8a8ff'][frame];
                P.R(7, 2, 1, 11, tw); P.R(2, 7, 11, 1, tw); P.px(4, 4, tw); P.px(10, 10, tw); P.px(10, 4, tw); P.px(4, 10, tw);
                break;
            }
            case 'dark': P.R(0, 0, 16, 16, '#050407'); break;
            case 'locked': {
                const room = ROOM[style] || ROOM.castle;
                P.R(0, 0, 16, 16, room[2]);
                P.R(2, 1, 12, 15, '#7a4e2c'); P.R(2, 1, 12, 1, '#a06a3e'); P.R(7, 1, 1, 15, '#5a3820');
                P.R(3, 5, 10, 1, '#3a3a44'); P.R(3, 11, 10, 1, '#3a3a44');
                P.R(9, 7, 3, 3, '#e8c040'); P.px(10, 8, '#2a2a2a'); P.px(10, 9, '#2a2a2a');
                break;
            }
            default: P.R(0, 0, 16, 16, '#ff00ff');
        }
        void c;
    });
}

// ------------------------------------------------------------------ things that stand on tiles
// Returns { c, ox, oy }: draw at (tileX*16 + ox, tileY*16 + oy). Most are 16 wide; trees are tall.
export function prop(name, style, v, extra = 0) {
    const key = `p:${name}:${style}:${v & 3}:${extra}`;
    if (cache.has(key)) return cache.get(key);
    let w = 16, h = 16, oy = 0, ox = 0;
    const tall = { tree: 30, pine: 30, snowpine: 30, deadtree: 26, palm: 30, shelf: 24, lamp: 28, statue: 26, pillar: 26, hedge: 18, telescope: 22, kiln: 22, well: 20, lectern: 20, snowman: 22, flowerbox: 16 };
    if (tall[name]) { h = tall[name]; oy = 16 - h; }
    if (name === 'tree' || name === 'pine' || name === 'snowpine' || name === 'palm' || name === 'deadtree') { w = 22; ox = -3; }
    const cv = canvas(w, h);
    const P = painter(cv.g);
    const g = cv.g;
    drawProp(P, g, name, style, v & 3, w, h, extra);
    if (!['crop', 'farm', 'bed', 'counter', 'table', 'clutter', 'hedge'].includes(name)) outline(cv.c, OUT);
    const out = { c: cv.c, ox, oy };
    cache.set(key, out);
    return out;
}

function drawProp(P, g, name, style, v, w, h, extra) {
    const pal = GRASS[style] || GRASS.village;
    switch (name) {
        case 'tree': {
            const leaf = style === 'thorn' ? '#3e6a30' : style === 'willow' ? '#5aa25a' : style === 'wood' ? '#3f8a3e' : '#4f9a40';
            const autumn = style === 'hill' && v === 2;
            const lc = autumn ? '#d8903a' : leaf;
            P.R(9, h - 10, 4, 10, '#7a5232'); P.R(9, h - 10, 1, 10, '#9a6a42'); P.R(8, h - 2, 6, 2, '#5a3a22');
            P.ellipse(11, 10, 10, 9, shade(lc, -0.2));
            P.ellipse(10, 8, 9, 8, lc);
            P.ellipse(8, 6, 5, 4, shade(lc, 0.18));
            for (let i = 0; i < 6; i++) P.px(4 + nz(i, v, 2) * 14, 3 + nz(i, v, 3) * 12, shade(lc, 0.3));
            if (v === 1 && style !== 'thorn') { P.px(6, 10, '#e05a5a'); P.px(14, 7, '#e05a5a'); P.px(11, 13, '#e05a5a'); }
            if (style === 'willow') for (let x = 3; x < 20; x += 3) P.R(x, 12, 1, 6 + (x % 2) * 3, shade(lc, -0.1));
            break;
        }
        case 'pine': case 'snowpine': {
            const c = '#2f6a46', snow = name === 'snowpine';
            P.R(10, h - 7, 3, 7, '#6a4428');
            for (let i = 0; i < 4; i++) {
                const y = 2 + i * 6, ww = 3 + i * 2;
                P.R(11 - ww, y, ww * 2 + 1, 6, shade(c, -0.05 * i));
                P.R(11 - ww, y + 5, ww * 2 + 1, 1, shade(c, -0.3));
                if (snow) P.R(12 - ww, y, ww * 2 - 1, 2, '#f4f8ff');
            }
            P.R(11, 0, 1, 3, snow ? '#f4f8ff' : c);
            break;
        }
        case 'deadtree': {
            P.R(10, 6, 3, h - 6, '#5a4a3e'); P.line(11, 10, 4, 3, '#5a4a3e'); P.line(12, 8, 18, 2, '#5a4a3e'); P.line(11, 14, 17, 10, '#5a4a3e');
            P.px(5, 2, '#6a5a4e'); P.px(19, 1, '#6a5a4e');
            break;
        }
        case 'palm': {
            P.line(11, h - 1, 13, 10, '#9a7044'); P.line(12, h - 1, 14, 10, '#b88a54');
            for (const [dx, dy] of [[-9, 2], [9, 1], [-6, 6], [7, 7], [0, -4]]) P.line(13, 9, 13 + dx, 9 + dy, '#3e9a4a');
            P.disc(13, 10, 2, '#7a5a32');
            break;
        }
        case 'bush': {
            const c = style === 'moor' || style === 'abbeyg' ? '#6a7a4a' : style === 'peak' ? '#5a8a6a' : '#4f9a40';
            P.ellipse(8, 10, 7, 5, shade(c, -0.2)); P.ellipse(7, 9, 6, 4, c); P.px(5, 7, shade(c, 0.3)); P.px(9, 8, shade(c, 0.3));
            if (v === 1) { P.px(4, 10, '#e05a7a'); P.px(10, 9, '#e05a7a'); }
            if (v === 2) { P.px(5, 9, '#7aa0e0'); P.px(10, 11, '#7aa0e0'); }
            break;
        }
        case 'rock': {
            const c = style === 'peak' ? '#a4acb6' : style === 'coast' ? '#b0a48a' : '#9a9286';
            P.ellipse(8, 10, 6, 5, shade(c, -0.25)); P.ellipse(7, 9, 5, 4, c); P.px(5, 7, shade(c, 0.35)); P.px(6, 7, shade(c, 0.2));
            if (style === 'peak') P.R(4, 5, 6, 2, '#f4f8ff');
            break;
        }
        case 'boulder': {
            P.ellipse(8, 9, 7, 6, '#6e665c'); P.ellipse(7, 8, 6, 5, '#8a8274'); P.px(5, 5, '#b0a898'); P.px(6, 5, '#a09888');
            P.line(9, 6, 11, 11, '#5e564c'); P.px(4, 11, '#5e564c');
            break;
        }
        case 'hedge': {
            P.R(0, 4, 16, 14, '#3a7a32');
            for (let x = 0; x < 16; x += 4) P.ellipse(x + 2, 4, 2, 2, '#4f9a40');
            P.R(0, 4, 16, 2, '#4f9a40');
            for (let i = 0; i < 14; i++) P.px(nz(i, v, 2) * 16, 5 + nz(i, v, 3) * 11, i % 2 ? '#5aa548' : '#2f6a28');
            for (let x = 1; x < 16; x += 4) P.px(x + (v & 1), 2, '#7abd5e');
            P.R(0, 16, 16, 2, '#24521e');
            if (v === 3) { P.px(4, 9, '#f2efe2'); P.px(11, 12, '#f2efe2'); }
            break;
        }
        case 'fence': {
            P.R(1, 4, 2, 12, '#a07040'); P.R(13, 4, 2, 12, '#a07040'); P.R(0, 6, 16, 2, '#b88050'); P.R(0, 11, 16, 2, '#b88050');
            break;
        }
        case 'crop': {
            g.drawImage(ground('farm', style, v), 0, 0);
            const cc = ['#5fae4a', '#e0a030', '#d06a2a', '#7fbf4a'][v];
            for (let x = 2; x < 16; x += 4) { P.R(x, 4, 2, 6, '#4a8a3a'); P.disc(x + 1, 4, 2, cc); }
            break;
        }
        case 'stump': P.ellipse(8, 10, 5, 4, '#7a5232'); P.ellipse(8, 9, 4, 3, '#c89a6a'); P.px(8, 9, '#9a6a42'); break;
        case 'mushroom': P.R(7, 9, 2, 5, '#f2e8d8'); P.ellipse(8, 8, 4, 3, '#d04a3a'); P.px(6, 7, '#ffffff'); P.px(9, 6, '#ffffff'); break;
        case 'shelf': {
            const wood = style === 'library' ? '#6a4228' : '#7a5232';
            P.R(1, 0, 14, 24, wood); P.R(1, 0, 14, 2, shade(wood, 0.2));
            P.R(2, 2, 12, 21, shade(wood, -0.35));
            for (let row = 0; row < 3; row++) {
                const y = 3 + row * 7;
                P.R(1, y + 6, 14, 1, shade(wood, 0.1));
                const n = extra < 0 ? 4 : Math.min(4, Math.max(0, extra - row * 0)); // extra: books on this shelf (filled by view)
                void n;
            }
            break;
        }
        case 'table': P.R(1, 3, 14, 9, '#8a5a32'); P.R(1, 3, 14, 2, '#a87444'); P.R(2, 12, 2, 4, '#6a4428'); P.R(12, 12, 2, 4, '#6a4428');
            if (v === 1) { P.R(4, 5, 3, 3, '#f2efe2'); P.px(5, 4, '#ffffff'); }
            if (v === 2) { P.R(9, 4, 4, 3, '#c0392b'); P.R(9, 4, 4, 1, '#e05a4a'); }
            break;
        case 'counter': P.R(0, 2, 16, 12, '#8a5a32'); P.R(0, 2, 16, 3, '#b07848'); P.R(0, 13, 16, 3, '#5a3a22'); P.R(3, 7, 10, 1, '#6a4428'); break;
        case 'bed': P.R(1, 0, 14, 16, '#7a5232'); P.R(2, 1, 12, 4, '#f2efe2'); P.R(2, 5, 12, 10, '#5a8ac8'); P.R(2, 5, 12, 1, '#7aa8e0');
            for (let x = 3; x < 14; x += 4) P.px(x, 9, '#e0c060');
            break;
        case 'statue': {
            P.R(3, h - 6, 10, 6, '#8a8494'); P.R(3, h - 6, 10, 1, '#aaa4b4');
            P.R(5, 6, 6, h - 12, '#b8b2c2'); P.disc(8, 4, 3, '#c8c2d2'); P.R(5, 9, 6, 1, '#9a94a4');
            if (style === 'castle' || style === 'village') { P.R(4, h - 9, 8, 3, '#5a8ac8'); P.px(6, h - 9, '#cfe8ff'); }
            break;
        }
        case 'well': P.R(2, h - 9, 12, 9, '#8a8494'); P.R(3, h - 8, 10, 3, '#3a6a9a'); P.R(2, 2, 2, h - 10, '#7a5232'); P.R(12, 2, 2, h - 10, '#7a5232'); P.R(1, 1, 14, 3, '#a05a3a'); P.R(7, 4, 1, 6, '#c8b890'); break;
        case 'lamp': P.R(7, 8, 2, h - 8, '#3a3a44'); P.R(5, h - 2, 6, 2, '#3a3a44'); P.R(5, 2, 6, 6, '#3a3a44'); P.R(6, 3, 4, 4, '#ffe08a'); P.R(4, 1, 8, 1, '#3a3a44'); break;
        case 'crate': P.R(1, 2, 14, 13, '#a87444'); P.R(1, 2, 14, 2, '#c08a54'); P.line(2, 4, 13, 14, '#8a5a32'); P.R(1, 8, 14, 1, '#8a5a32'); break;
        case 'barrel': P.ellipse(8, 9, 6, 7, '#9a6a3e'); P.R(2, 5, 12, 1, '#5a5a64'); P.R(2, 12, 12, 1, '#5a5a64'); P.ellipse(8, 3, 5, 2, '#b88050'); break;
        case 'sign': P.R(7, 8, 2, 8, '#7a5232'); P.R(2, 2, 12, 7, '#b88050'); P.R(2, 2, 12, 1, '#d0a068'); P.R(4, 4, 8, 1, '#7a5232'); P.R(4, 6, 6, 1, '#7a5232'); break;
        case 'chest': {
            const open = extra === 1;
            P.R(1, 5, 14, 10, '#a0602e'); P.R(1, 5, 14, 2, '#c07a3e'); P.R(1, 14, 14, 1, '#6a3e1e');
            P.R(1, 9, 14, 1, '#e8c040'); P.R(7, 8, 2, 3, '#e8c040');
            if (open) { P.R(1, 1, 14, 5, '#7a4422'); P.R(2, 5, 12, 2, '#2a1a12'); P.px(5, 4, '#ffe08a'); }
            else { P.R(1, 3, 14, 3, '#b06a34'); P.R(1, 3, 14, 1, '#d08a4a'); }
            break;
        }
        case 'lectern': {
            P.R(6, 8, 4, h - 8, '#6a4228'); P.R(4, h - 3, 8, 3, '#5a3820');
            P.R(2, 4, 12, 5, '#8a5a32'); P.R(2, 4, 12, 1, '#a87444');
            if (extra) { const col = extra; P.R(3, 2, 10, 4, '#f2ead6'); P.R(3, 2, 10, 1, col); P.R(7, 2, 2, 4, shade(col, -0.2)); }
            break;
        }
        case 'hearth': {
            P.R(0, 2, 16, 14, '#8a5a4a'); P.R(1, 2, 14, 2, '#a06a5a');
            for (let y = 4; y < 16; y += 3) P.R(0, y, 16, 1, '#6a4038');
            P.R(3, 7, 10, 9, '#1e1416'); P.R(4, 13, 8, 2, '#5a3a2a');
            break;
        }
        case 'pillar': P.R(4, 2, 8, h - 4, '#c8c2d2'); P.R(3, 0, 10, 3, '#e0dae8'); P.R(3, h - 3, 10, 3, '#a8a2b2'); P.R(6, 3, 1, h - 7, '#e8e4f0'); P.R(10, 3, 1, h - 7, '#a8a2b2'); break;
        case 'clutter': {
            for (let i = 0; i < 9; i++) {
                const x = 1 + nz(i, v, 1) * 10, y = 4 + nz(i, v, 2) * 8;
                P.R(x, y, 5, 3, i % 3 ? '#f2ead6' : '#e0d4b8');
                P.px(x + 1, y + 1, '#b0a080');
            }
            P.R(4, 2, 7, 3, '#8a5a3a'); P.R(4, 2, 7, 1, '#a07040');
            break;
        }
        case 'telescope': P.R(7, 12, 2, h - 12, '#5a5a6a'); P.line(4, 14, 7, 12, '#5a5a6a'); P.line(11, 14, 8, 12, '#5a5a6a'); P.R(3, 3, 12, 4, '#b8a060'); P.R(13, 2, 2, 6, '#8a7a4a'); P.px(3, 4, '#cfe8ff'); break;
        case 'pedestal': P.R(3, 6, 10, 10, '#8a8494'); P.R(2, 5, 12, 2, '#aaa4b4'); P.R(2, 14, 12, 2, '#6a6474'); break;
        case 'snowman': P.disc(8, h - 6, 5, '#f4f8ff'); P.disc(8, h - 14, 4, '#ffffff'); break;
        case 'anvil': P.R(3, 6, 10, 3, '#4a4a54'); P.R(6, 9, 4, 4, '#3a3a44'); P.R(4, 13, 8, 2, '#3a3a44'); break;
        case 'flowerbox': {
            P.R(1, 9, 14, 6, '#9a6a3e'); P.R(1, 9, 14, 1, '#b88050');
            const fl = ['#ff9a6a', '#ffe066', '#f5a3c7', '#e8913a'];
            for (let x = 2; x < 14; x += 3) { P.R(x, 6, 2, 3, '#4f9a40'); P.R(x, 4, 2, 2, fl[(x + v) % 4]); }
            break;
        }
        case 'kiln': P.ellipse(8, h - 8, 7, 7, '#a05a3a'); P.R(2, h - 8, 12, 8, '#a05a3a'); P.R(5, h - 7, 6, 5, '#2a1a12'); P.R(6, h - 5, 4, 3, '#e8823a'); P.R(10, 1, 3, 8, '#8a4a2a'); break;
        default: P.R(2, 2, 12, 12, '#ff00ff');
    }
    void pal; void w;
}
