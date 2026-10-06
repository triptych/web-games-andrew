/**
 * trainsets.js — locomotives, cars and the ready-made train sets every player starts with.
 *
 * A design (a "train set") is plain data:
 *   { id, name, engine, body, trim, face, cars: [{ type, color }] }
 * Colours are indices into PALETTE (config.js). Designs live in the player's Train Shed, shared by
 * every island; placing one on track makes a running train with its own copy.
 */

import { MAX_CARS } from '../config.js';

export const ENGINES = {
    steam: { name: 'Steam Engine', emoji: '🚂', len: 0.98, smoke: 'steam', desc: 'Puffs of steam and a chuff-chuff beat.' },
    tank: { name: 'Little Tank Engine', emoji: '🚂', len: 0.78, smoke: 'steam', desc: 'Small, cheerful and always busy.' },
    diesel: { name: 'Diesel', emoji: '🚃', len: 0.98, smoke: 'diesel', desc: 'Rumbles along with a big two-tone horn.' },
    bullet: { name: 'Bullet Train', emoji: '🚄', len: 1.02, smoke: null, desc: 'Sleek and speedy, with a pointy nose.' },
    tram: { name: 'Tram', emoji: '🚋', len: 0.9, smoke: null, desc: 'A bell-ringing town tram with big windows.' },
};

export const CARS = {
    coach: { name: 'Coach', emoji: '🚃', len: 0.86, cap: 6 },
    caboose: { name: 'Caboose', emoji: '🛤️', len: 0.7, cap: 2 },
    box: { name: 'Boxcar', emoji: '📦', len: 0.82, cap: 0 },
    tank: { name: 'Tank Car', emoji: '🛢️', len: 0.8, cap: 0 },
    logs: { name: 'Log Car', emoji: '🪵', len: 0.82, cap: 0 },
    coal: { name: 'Coal Hopper', emoji: '⛏️', len: 0.74, cap: 0 },
    mail: { name: 'Mail Van', emoji: '✉️', len: 0.78, cap: 0 },
    sheep: { name: 'Sheep Wagon', emoji: '🐑', len: 0.78, cap: 0 },
    candy: { name: 'Ice Cream Car', emoji: '🍦', len: 0.8, cap: 0 },
    circus: { name: 'Circus Car', emoji: '🎪', len: 0.82, cap: 0 },
    flat: { name: 'Toy Car Carrier', emoji: '🚗', len: 0.84, cap: 0 },
};

export const GAP = 0.07;

export function trainLength(design) {
    let L = ENGINES[design.engine]?.len ?? 1;
    for (const c of design.cars) L += GAP + (CARS[c.type]?.len ?? 0.8);
    return L;
}

export function capacity(design) {
    let c = design.engine === 'tram' ? 8 : 0;
    for (const car of design.cars) c += CARS[car.type]?.cap ?? 0;
    return c;
}

/** Make sure a design read from storage is well-formed; returns a cleaned copy or null. */
export function cleanDesign(d) {
    if (!d || typeof d !== 'object' || !ENGINES[d.engine]) return null;
    const col = (v, def) => (Number.isInteger(v) && v >= 0 && v < 16 ? v : def);
    const cars = Array.isArray(d.cars) ? d.cars.filter((c) => c && CARS[c.type]).slice(0, MAX_CARS).map((c) => ({ type: c.type, color: col(c.color, 0) })) : [];
    return {
        id: String(d.id || 'set-' + Math.floor(Math.abs(hashName(d.name || 'x')))),
        name: String(d.name || 'Train').slice(0, 28),
        engine: d.engine,
        body: col(d.body, 0),
        trim: col(d.trim, 9),
        face: !!d.face,
        cars,
    };
}

function hashName(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }

export const DEFAULT_SETS = [
    { id: 'set-puffin', name: 'Puffin Express', engine: 'steam', body: 0, trim: 9, face: false, cars: [{ type: 'coach', color: 0 }, { type: 'coach', color: 0 }, { type: 'coach', color: 1 }] },
    { id: 'set-sunny', name: 'Sunny Freight', engine: 'diesel', body: 1, trim: 9, face: false, cars: [{ type: 'box', color: 2 }, { type: 'tank', color: 8 }, { type: 'logs', color: 12 }, { type: 'coal', color: 9 }, { type: 'caboose', color: 0 }] },
    { id: 'set-zoomer', name: 'Zoomer', engine: 'bullet', body: 8, trim: 2, face: false, cars: [{ type: 'coach', color: 8 }, { type: 'coach', color: 8 }] },
    { id: 'set-tootle', name: 'Little Tootle', engine: 'tank', body: 2, trim: 1, face: true, cars: [{ type: 'coach', color: 4 }, { type: 'sheep', color: 3 }] },
    { id: 'set-candy', name: 'Candy Line', engine: 'steam', body: 5, trim: 8, face: true, cars: [{ type: 'candy', color: 13 }, { type: 'circus', color: 1 }, { type: 'candy', color: 6 }] },
    { id: 'set-clang', name: 'Harbour Tram', engine: 'tram', body: 7, trim: 8, face: false, cars: [] },
];

const NAME_A = ['Puffin', 'Sunny', 'Bramble', 'Clover', 'Pebble', 'Marigold', 'Biscuit', 'Thistle', 'Maple', 'Juniper', 'Bumble', 'Daisy', 'Pickle', 'Toffee', 'Willow', 'Comet', 'Breezy', 'Honey', 'Rusty', 'Poppy', 'Sprocket', 'Nutmeg', 'Seashell', 'Starlight'];
const NAME_B = ['Express', 'Flyer', 'Rambler', 'Special', 'Shuttle', 'Local', 'Mail', 'Limited', 'Dasher', 'Chugger', 'Line', 'Runner', 'Hopper', 'Zephyr', 'Tootler', 'Puffer'];

/** Name generator. Takes a [0,1) random function so the UI can use Math.random and tests a seeded RNG. */
export function trainName(rand) {
    return NAME_A[Math.floor(rand() * NAME_A.length)] + ' ' + NAME_B[Math.floor(rand() * NAME_B.length)];
}

const ST_A = ['Puffin', 'Seagull', 'Harbour', 'Meadow', 'Pebble', 'Cockle', 'Maple', 'Bluebell', 'Lighthouse', 'Orchard', 'Sandy', 'Mossy', 'Kipper', 'Windy', 'Primrose', 'Otter', 'Lantern', 'Bramble', 'Cobble', 'Starfish'];
const ST_B = ['Point', 'Halt', 'Junction', 'Cove', 'Green', 'Bay', 'End', 'Hill', 'Corner', 'Lane', 'Sands', 'Market', 'Crossing', 'Hollow', 'Quay'];
export function stationName(rand) {
    return ST_A[Math.floor(rand() * ST_A.length)] + ' ' + ST_B[Math.floor(rand() * ST_B.length)];
}
