// ============================================================
// Crops. seasons: 0 spring, 1 summer, 2 fall, 3 winter; 'any' grows year round.
// days = days of watered growth to ripen; regrow = days between later harvests.
// ============================================================

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const DAYS_PER_SEASON = 12;

export const CROPS = [
    { id: 'turnip',      name: 'Turnip',      seasons: [0],       days: 4,  regrow: 0, seed: 20,  sell: 35,  yield: 1, hue: 300, shape: 'root',    tags: ['vegetable'] },
    { id: 'potato',      name: 'Potato',      seasons: [0],       days: 6,  regrow: 0, seed: 40,  sell: 80,  yield: 1, hue: 35,  shape: 'round',   tags: ['vegetable'] },
    { id: 'strawberry',  name: 'Strawberry',  seasons: [0],       days: 8,  regrow: 4, seed: 80,  sell: 60,  yield: 1, hue: 355, shape: 'berry',   tags: ['fruit', 'sweet'] },
    { id: 'cauliflower', name: 'Cauliflower', seasons: [0],       days: 10, regrow: 0, seed: 70,  sell: 175, yield: 1, hue: 60,  shape: 'leafy',   tags: ['vegetable'] },
    { id: 'wheat',       name: 'Wheat',       seasons: [0, 1, 2], days: 4,  regrow: 0, seed: 10,  sell: 25,  yield: 1, hue: 45,  shape: 'grain',   tags: ['grain'] },
    { id: 'tomato',      name: 'Tomato',      seasons: [1],       days: 9,  regrow: 4, seed: 50,  sell: 60,  yield: 1, hue: 5,   shape: 'round',   tags: ['vegetable', 'fruit'] },
    { id: 'corn',        name: 'Corn',        seasons: [1, 2],    days: 12, regrow: 4, seed: 60,  sell: 50,  yield: 1, hue: 50,  shape: 'corn',    tags: ['vegetable', 'grain'] },
    { id: 'melon',       name: 'Melon',       seasons: [1],       days: 10, regrow: 0, seed: 80,  sell: 250, yield: 1, hue: 110, shape: 'melon',   tags: ['fruit', 'sweet'] },
    { id: 'blueberry',   name: 'Blueberry',   seasons: [1],       days: 11, regrow: 4, seed: 80,  sell: 50,  yield: 3, hue: 230, shape: 'berry',   tags: ['fruit', 'sweet'] },
    { id: 'pumpkin',     name: 'Pumpkin',     seasons: [2],       days: 11, regrow: 0, seed: 100, sell: 320, yield: 1, hue: 28,  shape: 'pumpkin', tags: ['vegetable'] },
    { id: 'yam',         name: 'Yam',         seasons: [2],       days: 8,  regrow: 0, seed: 60,  sell: 150, yield: 1, hue: 20,  shape: 'root',    tags: ['vegetable'] },
    { id: 'cranberry',   name: 'Cranberry',   seasons: [2],       days: 7,  regrow: 5, seed: 120, sell: 75,  yield: 2, hue: 345, shape: 'berry',   tags: ['fruit'] },
    { id: 'beet',        name: 'Beet',        seasons: [2],       days: 6,  regrow: 0, seed: 20,  sell: 60,  yield: 1, hue: 330, shape: 'root',    tags: ['vegetable'] },
    { id: 'snowroot',    name: 'Snowroot',    seasons: [3],       days: 7,  regrow: 0, seed: 60,  sell: 140, yield: 1, hue: 200, shape: 'root',    tags: ['vegetable'] },
    { id: 'frostberry',  name: 'Frostberry',  seasons: [3],       days: 9,  regrow: 4, seed: 90,  sell: 70,  yield: 1, hue: 190, shape: 'berry',   tags: ['fruit', 'sweet'] },
    { id: 'starbloom',   name: 'Starbloom',   seasons: 'any',     days: 12, regrow: 0, seed: 0,   sell: 600, yield: 1, hue: 275, shape: 'star',    tags: ['fruit', 'sweet', 'magic'] },
];

export const CROP = Object.fromEntries(CROPS.map(c => [c.id, c]));

export const cropInSeason = (c, season) => c.seasons === 'any' || c.seasons.includes(season);

/** Growth stage 0..3 from age (3 = ripe). */
export function cropStage(c, age) {
    if (age >= c.days) return 3;
    return Math.min(2, Math.floor((age / c.days) * 3));
}
