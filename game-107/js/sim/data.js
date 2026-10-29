// Tables: buildings, things you can swallow, cities, power-ups and perks. Pure data.

import { FLOOR_H, DECK_H } from '../config.js';

/** Building kinds. fl = floors, w/d = footprint ranges, fh = hit points per floor, sc = score per floor. */
export const BTYPES = {
    house:   { fl: [1, 2],   w: [3, 4.4],   d: [3, 4.2],   fh: 5,  sc: 10, roofs: ['pitched', 'pitched', 'cone', 'balloon'] },
    shop:    { fl: [2, 3],   w: [4, 6.2],   d: [3.6, 5],   fh: 6,  sc: 14, roofs: ['flat', 'awning', 'donut', 'dome'] },
    block:   { fl: [4, 6],   w: [5, 7.4],   d: [4.6, 6.8], fh: 9,  sc: 20, roofs: ['flat', 'flat', 'teapot', 'dome', 'pitched'] },
    tower:   { fl: [7, 9],   w: [4.4, 6],   d: [4.4, 6],   fh: 12, sc: 30, roofs: ['flat', 'teapot', 'cone', 'balloon', 'dome'] },
    sky:     { fl: [10, 13], w: [4.4, 5.8], d: [4.4, 5.8], fh: 15, sc: 40, roofs: ['spire', 'dome', 'flat', 'balloon'] },
    spire:   { fl: [12, 15], w: [3.2, 4.2], d: [3.2, 4.2], fh: 16, sc: 45, roofs: ['spire', 'spire', 'cone'] },
    pylon:   { fl: [6, 6],   w: [0.6, 0.6], d: [0.6, 0.6], fh: 14, sc: 25, roofs: ['cap'] },
    deck:    { fl: [1, 1],   w: [2, 3],     d: [2, 3],     fh: 14, sc: 12, roofs: ['none'], low: true },
    gas:     { fl: [2, 2],   r: 1.7,  fh: 9,  sc: 18, roofs: ['dome'], circle: true, explosive: true },
    ferris:  { fl: [5, 5],   r: 3.2,  fh: 9,  sc: 26, roofs: ['none'], circle: true },
    statue:  { fl: [4, 4],   r: 1.0,  fh: 7,  sc: 22, roofs: ['none'], circle: true },
};

/** Height of a building as it stands now. */
export const bHeight = (b) => b.fl * (b.t === 'deck' ? DECK_H : FLOOR_H);
export const floorH = (b) => (b.t === 'deck' ? DECK_H : FLOOR_H);

/**
 * Small things. size = radius-ish, swallowed when size <= ABSORB × ball radius.
 * vol = volume added to the ball, sc = score, heal = hit points, tough = ball speed that flattens it
 * when it is too big to swallow.
 */
export const THINGS = {
    person: { size: 0.2,  vol: 0.012, sc: 5,  loose: true, stick: true, tough: 0 },
    car:    { size: 0.62, vol: 0.08,  sc: 15, loose: true, stick: true, tough: 3 },
    bus:    { size: 0.95, vol: 0.2,   sc: 30, loose: true, stick: true, tough: 4 },
    cart:   { size: 0.45, vol: 0.04,  sc: 10, loose: true, stick: true, tough: 2, heal: 8 },
    pizza:  { size: 0.8,  vol: 0.12,  sc: 25, loose: true, stick: true, tough: 3, heal: 14 },
    tree:   { size: 0.75, vol: 0.07,  sc: 6,  stick: true, tough: 3 },
    pine:   { size: 0.95, vol: 0.1,   sc: 8,  stick: true, tough: 3.5 },
    oak:    { size: 1.5,  vol: 0.3,   sc: 14, stick: true, tough: 5.5 },
    lamp:   { size: 0.35, vol: 0.025, sc: 4,  stick: true, tough: 2 },
};

/** Military. */
export const FOES = {
    tank: { size: 1.0, hp: 3, sc: 120 },
    heli: { size: 0.9, hp: 1, sc: 150, z: 4.4 },
    jet:  { size: 1.2, hp: 99, sc: 0, z: 9 },
};

export const POWERS = {
    fire:   { time: 12, label: 'Atomic Breath', icon: '🔥' },
    magnet: { time: 12, label: 'Snack Magnet', icon: '🧲' },
    shield: { time: 10, label: 'Jelly Shield', icon: '🛡️' },
    meal:   { time: 0,  label: 'Mega Meal', icon: '🍔' },
    heart:  { time: 0,  label: 'Big Hug', icon: '💖' },
};
export const POWER_KINDS = ['fire', 'magnet', 'shield', 'meal', 'heart'];

/** Chosen after each city is flattened. */
export const PERKS = [
    { id: 'hp',   name: 'Thick Hide',   desc: '+25 max health, and heal fully.', icon: '🛡️' },
    { id: 'cd',   name: 'Springy Legs', desc: 'Pounce recovers 25% faster.', icon: '🦵' },
    { id: 'size', name: 'Big Bones',    desc: 'Start every city a little bigger.', icon: '🦴' },
    { id: 'dmg',  name: 'Spiky Scales', desc: '+20% damage to buildings.', icon: '🦔' },
    { id: 'pow',  name: 'Long Burps',   desc: 'Power-ups last 35% longer.', icon: '⏱️' },
];

/**
 * The cities. cols × rows of blocks; r0 = the ball's starting radius; goal = share of the city's
 * strength to destroy; par = seconds for the time star. mil: [first at s, then every s, max alive].
 */
export const LEVELS = [
    { name: 'Pastel Bay', blurb: 'A sleepy toy town by the sea. Nobody is expecting you.',
      cols: 3, rows: 4, river: true, goal: 0.8, r0: 1.2, hpMul: 1.0, par: 120,
      mix: { house: 5, shop: 4, block: 3, tower: 1 },
      mil: { tank: [8, 14, 2], heli: [9999, 30, 0], jet: [9999, 40] } },
    { name: 'Harbor Town', blurb: 'Cranes, bridges and a very nervous navy.',
      cols: 3, rows: 5, river: true, goal: 0.82, r0: 1.5, hpMul: 1.1, par: 150,
      mix: { house: 3, shop: 4, block: 4, tower: 2 },
      mil: { tank: [6, 12, 3], heli: [30, 26, 1], jet: [9999, 40] } },
    { name: 'Neon Heights', blurb: 'Skyscrapers glowing after dark. Tall, shiny, delicious.',
      cols: 4, rows: 5, river: true, goal: 0.84, r0: 1.8, hpMul: 1.2, par: 230,
      mix: { shop: 2, block: 4, tower: 4, sky: 3 },
      mil: { tank: [6, 11, 3], heli: [24, 22, 2], jet: [45, 30] } },
    { name: 'Frostport', blurb: 'Snowy spires and snowier tanks. The army has brought snowplows.',
      cols: 4, rows: 5, river: true, goal: 0.86, r0: 2.1, hpMul: 1.3, par: 230,
      mix: { house: 2, shop: 2, block: 4, tower: 4, sky: 4, spire: 2 },
      mil: { tank: [5, 10, 4], heli: [20, 18, 2], jet: [35, 26] } },
    { name: 'Fort Fortissimo', blurb: 'The capital. Every gun in the country is pointed at you.',
      cols: 4, rows: 6, river: true, goal: 0.88, r0: 2.4, hpMul: 1.4, par: 300,
      mix: { block: 3, tower: 4, sky: 5, spire: 3 },
      mil: { tank: [4, 9, 5], heli: [16, 15, 3], jet: [28, 22] } },
];
