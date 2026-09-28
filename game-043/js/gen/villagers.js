// ============================================================
// Villagers and the Mayor, generated from the seed.
// ============================================================

import { rngFor } from '../core/rng.js';
import { JOBS, PERSONALITIES } from '../data/jobs.js';
import { ITEMS } from '../data/items.js';
import { randomLook, HAIR_COLORS } from '../data/look.js';
import { personName, surname, townName } from './names.js';

const PRONOUN_KEYS = ['they', 'she', 'he'];

export function generateVillager(seed, job) {
    const rng = rngFor(seed, 'villager', job);
    const J = JOBS[job];
    const name = personName(rng);
    // a couple of personal favourites on top of the job's tastes
    const pool = ITEMS.filter(i => ['crop', 'forage', 'dish', 'refined', 'gem', 'animal'].includes(i.cat) && i.sell > 20);
    const personalLoves = [rng.pick(pool).id];
    const personalLikes = [rng.pick(pool).id, rng.pick(pool).id];
    const look = randomLook(rng);
    if (job === 'guard') look.acc = 0;
    return {
        id: job, job, name, surname: surname(rng), pronoun: rng.pick(PRONOUN_KEYS),
        look, personality: rng.pick(PERSONALITIES), town: townName(rng),
        rival: personName(rng), friend: personName(rng),
        loves: [...J.loves, ...personalLoves], likes: [...J.likes, ...personalLikes], hates: J.hates.slice(),
        birthday: { season: rng.int(0, 3), day: rng.int(1, 12) },
    };
}

export function generateMayor(seed) {
    const rng = rngFor(seed, 'mayor');
    const look = randomLook(rng);
    look.hairColor = rng.pick([6, 6, 5, 0]);       // mostly grey — they've been here forty years
    return { id: 'mayor', name: personName(rng), surname: surname(rng), pronoun: rng.pick(PRONOUN_KEYS), look, aunt: personName(rng) };
}

export const glimName = seed => ['Glim', 'Glimmet', 'Twinkle', 'Flick', 'Wisp', 'Lumen'][rngFor(seed, 'glim').int(0, 5)];
export { HAIR_COLORS };
