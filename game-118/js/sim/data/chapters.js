// The Dinner Plan: five courses of three goals each. Finish them all and the kids' table is invited to the big one.
//
// Goal types:  make  {c, t}  have ever made tier t of chain c
//              serve {n}     served n guests
//              merge {n}     merged n times
//              table {n}     reached table level n

import { tierName } from './items.js';

export const CHAPTERS = [
    {
        name: 'Set the Table',
        blurb: 'Grandma says the big table is full this year. Show everyone the kids can set a lovely one.',
        goals: [
            { type: 'make', c: 'craft', t: 3 },
            { type: 'make', c: 'craft', t: 4 },
            { type: 'serve', n: 3 },
        ],
        reward: { coins: 25, stars: 1 },
    },
    {
        name: 'Pumpkin Season',
        blurb: 'The patch is ripe. Everyone is asking about pie, and a bigger table would help.',
        goals: [
            { type: 'make', c: 'pumpkin', t: 4 },
            { type: 'make', c: 'pumpkin', t: 5 },
            { type: 'table', n: 1 },
        ],
        reward: { coins: 30, stars: 1 },
    },
    {
        name: 'The Bird',
        blurb: 'A rumor says there is a turkey in the coop. The grown-ups are starting to notice.',
        goals: [
            { type: 'make', c: 'turkey', t: 4 },
            { type: 'merge', n: 120 },
            { type: 'serve', n: 10 },
        ],
        reward: { coins: 40, stars: 2 },
    },
    {
        name: 'Bread and Trimmings',
        blurb: 'Rolls, a roast and a bigger table. Now it is starting to look like a real dinner.',
        goals: [
            { type: 'table', n: 2 },
            { type: 'make', c: 'grain', t: 5 },
            { type: 'make', c: 'turkey', t: 5 },
        ],
        reward: { coins: 50, stars: 2 },
    },
    {
        name: 'The Big Dinner',
        blurb: 'One last push. Make the showpieces and take your seat at the head of the table.',
        goals: [
            { type: 'make', c: 'turkey', t: 6 },
            { type: 'make', c: 'pumpkin', t: 6 },
            { type: 'make', c: 'craft', t: 6 },
        ],
        reward: { coins: 80, stars: 3 },
    },
];

export function goalLabel(g) {
    if (g.type === 'make') return `Make a ${tierName(g.c, g.t)}`;
    if (g.type === 'serve') return `Serve ${g.n} guests`;
    if (g.type === 'merge') return `Merge ${g.n} times`;
    if (g.type === 'table') return g.n === 1 ? 'Move up to the Card Table' : g.n === 2 ? 'Move up to the Dining Table' : 'Take the head of the table';
    return '?';
}
