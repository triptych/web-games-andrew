// GIANT'S VAULT: Ember the lynx-wolf. Follows, fights, carries 16 things, runs to town to sell them, casts its own
// spells. Never dies: at 0 life it is downed for a while and gets up. Pure.

import { PET, POTION } from '../config.js';
import { hitMonster, weaponRoll, heal } from './combat.js';
import { moveBody, fits, downhill, los, clearPath } from './world.js';
import { sellPrice } from './loot.js';

const alive = (m) => m.life > 0 && m.state !== 'dead';

export function newPet() {
    return { id: -1, x: 0, y: 0, face: 0, life: 1, max: 1, state: 'follow', t: 0, bag: new Array(PET.bag).fill(null), cd: 0, howl: 4, mend: 0, pounce: 0, tripGold: 0 };
}

export function petMaxLife(G) { return Math.round(G.player.stats.maxLife * PET.life); }

/** Put the pet beside the player (entering an area, coming back from town, getting up after being downed). */
export function placePet(G) {
    const P = G.player, pet = G.pet;
    for (let k = 0; k < 8; k++) {
        const a = P.face + Math.PI + (k - 4) * 0.5, x = P.x + Math.cos(a) * 1.4, y = P.y + Math.sin(a) * 1.4;
        if (fits(G.area, x, y, PET.radius)) { pet.x = x; pet.y = y; return; }
    }
    pet.x = P.x; pet.y = P.y;
}

/** Send the pet to town: it leaves, sells everything in its bag, refills the potion and returns with the gold. */
export function sendPetToTown(G) {
    const pet = G.pet;
    if (pet.state === 'away') return 'already on its way';
    if (pet.state === 'down') return 'Ember is hurt';
    let gold = 0, n = 0;
    for (let i = 0; i < pet.bag.length; i++) {
        const id = pet.bag[i];
        if (!id) continue;
        gold += sellPrice(G.items[id]);
        delete G.items[id];
        pet.bag[i] = null;
        n++;
    }
    pet.tripGold = gold;
    pet.state = 'away'; pet.t = PET.townTrip;
    G.events.push({ type: 'petTrip', sold: n, gold });
    return '';
}

export function stepPet(G, dt) {
    const pet = G.pet, P = G.player, A = G.area;
    pet.max = petMaxLife(G);
    if (pet.state === 'away') {
        pet.t -= dt;
        if (pet.t <= 0) {
            P.gold += pet.tripGold;
            P.potion.charges = POTION.charges;
            G.events.push({ type: 'petBack', gold: pet.tripGold });
            pet.tripGold = 0;
            pet.state = 'follow'; pet.life = pet.max;
            placePet(G);
        }
        return;
    }
    if (pet.state === 'down') {
        pet.t -= dt;
        if (pet.t <= 0) { pet.state = 'follow'; pet.life = pet.max * 0.5; G.events.push({ type: 'petUp' }); }
        return;
    }
    if (pet.life <= 0) { pet.state = 'down'; pet.t = PET.downTime; G.events.push({ type: 'petDown' }); return; }
    pet.cd -= dt; pet.howl -= dt; pet.mend -= dt; pet.pounce -= dt;
    const s = P.stats;
    const furyMult = s.powers.petFury ? 2 : 1;

    // pet spells cast themselves
    if (P.level >= PET.mendLevel && pet.mend <= 0 && P.life > 0 && P.life < P.stats.maxLife * PET.mendAt && G.area.kind !== 'town') {
        pet.mend = PET.mendCd; heal(G, P.stats.maxLife * PET.mend); G.events.push({ type: 'petSpell', spell: 'mend' });
    }
    // the target: what the player last hit, else the nearest monster near the player
    let tgt = null, bd = 10;
    for (const m of G.mons) {
        if (!alive(m) || !m.aggro) continue;
        const d = Math.hypot(m.x - P.x, m.y - P.y);
        if (d < bd) { bd = d; tgt = m; }
    }
    if (tgt && pet.howl <= 0) {
        const near = G.mons.filter((m) => alive(m) && Math.hypot(m.x - pet.x, m.y - pet.y) < 5);
        if (near.length >= 3) { pet.howl = PET.howlCd; for (const m of near) { m.taunt = 3; m.tauntBy = pet.id; } G.events.push({ type: 'petSpell', spell: 'howl', x: pet.x, y: pet.y }); }
    }
    if (tgt && P.level >= PET.pounceLevel && pet.pounce <= 0) {
        const d = Math.hypot(tgt.x - pet.x, tgt.y - pet.y);
        if (d > 3 && d < 9 && los(A, pet.x, pet.y, tgt.x, tgt.y)) {
            pet.pounce = PET.pounceCd;
            pet.x = tgt.x - ((tgt.x - pet.x) / d) * (tgt.radius + 0.6); pet.y = tgt.y - ((tgt.y - pet.y) / d) * (tgt.radius + 0.6);
            if (!fits(A, pet.x, pet.y, PET.radius)) placePet(G);
            hitMonster(G, tgt, weaponRoll(G) * PET.dmg * 2 * furyMult, { src: 'pet', stagger: 2, proc: true });
            G.events.push({ type: 'petSpell', spell: 'pounce', x: pet.x, y: pet.y });
        }
    }
    let gx = P.x, gy = P.y, want = 1.8;
    pet.state = 'follow';
    if (tgt) { gx = tgt.x; gy = tgt.y; want = PET.reach + tgt.radius * 0.5; pet.state = 'fight'; }
    const d = Math.hypot(gx - pet.x, gy - pet.y);
    if (d > want) {
        let mx = (gx - pet.x) / d, my = (gy - pet.y) / d;
        if (!clearPath(A, pet.x, pet.y, gx, gy, PET.radius * 0.8) && G._flow?.area === A.uid) {
            // the player's flow field is cached by the monsters' step; a pet heading anywhere near the player can use it
            const n = downhill(A, G._flow.d, pet.x, pet.y);
            if (n) { const ex = n.cx - pet.x, ey = n.cy - pet.y, el = Math.hypot(ex, ey) || 1; mx = ex / el; my = ey / el; }
        }
        const sp = PET.speed * (d > 8 ? 1.4 : 1);
        moveBody(A, pet, mx * sp * dt, my * sp * dt, PET.radius * 0.8);
        pet.face = Math.atan2(my, mx);
    } else if (tgt && pet.cd <= 0) {
        pet.cd = PET.atk;
        pet.face = Math.atan2(tgt.y - pet.y, tgt.x - pet.x);
        hitMonster(G, tgt, weaponRoll(G) * PET.dmg * furyMult, { src: 'pet', el: s.powers.petFury ? 'fire' : 'phys', proc: true });
        G.events.push({ type: 'petBite', id: tgt.id });
    }
    if (Math.hypot(pet.x - P.x, pet.y - P.y) > 18) placePet(G);
}
