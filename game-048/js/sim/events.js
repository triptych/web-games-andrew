/**
 * events.js — "Signal" nodes. Small choices with consequences. Each choice's
 * `go(c)` mutates the profile/sector and returns { text, battle?, mini? }.
 * c = { p, s, rng, x, maxHp }.
 */

import { rewardScale } from './enemies.js';
import { addMod, newMod, addXp } from './profile.js';
import { BOOSTERS, BOOSTER_IDS } from './boosters.js';
import { MODS, RARITIES } from './mods.js';
import { fmt } from './format.js';

const scrapN = (c, base) => Math.round(base * rewardScale(c.x) * c.rng.range(0.85, 1.2));
function hurt(c, pct) {
    const d = Math.round(c.maxHp * pct);
    c.s.hp = Math.max(1, c.s.hp - d);
    return d;
}
function heal(c, pct) {
    const before = c.s.hp;
    c.s.hp = Math.min(c.maxHp, c.s.hp + Math.round(c.maxHp * pct));
    return c.s.hp - before;
}
function giveMod(c, luck) {
    const m = addMod(c.p, newMod(c.p, luck));
    return `${RARITIES[m.rar].name} module: ${MODS[m.id].name}.`;
}
function giveBooster(c, id, n = 1) {
    c.p.boosters[id] = (c.p.boosters[id] ?? 0) + n;
    return `${n > 1 ? `${n}× ` : ''}${BOOSTERS[id].name}`;
}

export const EVENTS = {
    derelict: {
        title: 'Derelict Frame', art: 'derelict',
        text: 'A training frame drifts dead in the dark, canopy open, reels frozen mid-spin. The serial on its shoulder is from your academy — three classes back.',
        choices: [
            { label: 'Strip it for scrap', go: (c) => { const n = scrapN(c, 70); c.p.scrap += n; return { text: `You cut ${fmt(n)} scrap from the hull. KISMET is quiet the whole time.` }; } },
            { label: 'Pull its module (risky)', go: (c) => {
                if (c.rng.chance(0.6)) return { text: `The housing comes away clean. ${giveMod(c, 0.4)}` };
                const d = hurt(c, 0.2);
                return { text: `The frame was rigged. A Null spike detonates as the module comes free — ${d} hull damage, and nothing to show for it.` };
            } },
            { label: 'Log the serial and leave', go: (c) => { addXp(c.p, Math.round(30 * Math.pow(1.6, c.x))); return { text: '"Someone should know where they ended up," KISMET says, and files it. You feel steadier for it. (+XP)' }; } },
        ],
    },
    beacon: {
        title: 'Distress Beacon', art: 'beacon',
        text: 'A civilian hauler, the Patience of Orrin, is broadcasting on every band. Null units are carving into its engine block. The pilot is begging.',
        choices: [
            { label: 'Intervene', go: () => ({ text: 'You burn hard toward the hauler. Weapons free.', battle: 'battle', bonus: 'beacon' }) },
            { label: 'Relay their position to the fleet', go: (c) => { const n = scrapN(c, 25); c.p.scrap += n; return { text: `Fleet command thanks you for the relay and logs a finder's fee: ${fmt(n)} scrap. You do not hear what happens to the Patience.` }; } },
        ],
    },
    gambler: {
        title: "The Gambler's Wreck", art: 'casino',
        text: 'Half a pleasure liner, still lit. In its lounge a slot cabinet hums on emergency power, three reels behind cracked glass. KISMET is very interested.',
        choices: [
            { label: 'Pull the lever', cost: (c) => Math.round(30 * rewardScale(c.x)), go: (c, cost) => {
                c.p.scrap -= cost;
                const faces = ['core', 'blade', 'scrap', 'wild', 'glitch'];
                const reels = [c.rng.pick(faces), c.rng.pick(faces), c.rng.pick(faces)];
                if (c.rng.chance(0.18)) reels[1] = reels[2] = reels[0];
                const same = reels[0] === reels[1] && reels[1] === reels[2];
                const pair = !same && (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]);
                let text;
                if (same && reels[0] === 'glitch') { const d = hurt(c, 0.15); text = `Three Glitches. The cabinet shorts out into your hand — ${d} hull damage. KISMET: "That one was personal."`; }
                else if (same && reels[0] === 'core') { c.p.cores += 3; text = 'JACKPOT. Three Cores. The cabinet coughs up three raw Probability Cores. (+3 cores)'; }
                else if (same) { text = `Three of a kind! It pays out a ${giveMod(c, 1.2)}`; }
                else if (pair) { const n = cost * 3; c.p.scrap += n; text = `A pair. The tray rattles: ${fmt(n)} scrap.`; }
                else text = 'Nothing. The reels settle on nothing at all. KISMET: "Again?"';
                return { text, mini: reels };
            } },
            { label: 'Walk away', go: () => ({ text: 'KISMET sulks for the next three minutes.' }) },
        ],
    },
    market: {
        title: 'Black-Market Drone', art: 'market',
        text: 'A courier drone flashes a smuggler\'s handshake. Its manifest lists modules "liberated" from a fleet depot. It will take payment in scrap — or in hull plating.',
        choices: [
            { label: 'Trade 25% hull for a rare-or-better module', go: (c) => { const d = hurt(c, 0.25); return { text: `It unbolts ${d} hull worth of plating with a polite whirr. ${giveMod(c, 2.5)}` }; } },
            { label: 'Buy a booster crate', cost: (c) => Math.round(70 * rewardScale(c.x)), go: (c, cost) => {
                c.p.scrap -= cost;
                const a = c.rng.pick(BOOSTER_IDS), b = c.rng.pick(BOOSTER_IDS);
                return { text: `The crate holds ${giveBooster(c, a)} and ${giveBooster(c, b)}.` };
            } },
            { label: 'Report it', go: (c) => { const n = scrapN(c, 20); c.p.scrap += n; return { text: `Fleet security pays a ${fmt(n)}-scrap bounty. The drone, sensing the mood, has already gone.` }; } },
        ],
    },
    anomaly: {
        title: 'Reactor Anomaly', art: 'anomaly',
        text: 'Your reactor sings a note it has never sung before. Probability foam is condensing on the canopy. KISMET suggests either venting it or drinking it.',
        choices: [
            { label: 'Absorb it', go: (c) => { const h = heal(c, 0.3); return { text: `The foam soaks into the plating. +${h} hull, and a ${giveBooster(c, 'battery')} condenses in the tray.` }; } },
            { label: 'Vent it into the reels', go: (c) => {
                if (c.rng.chance(0.5)) return { text: `The reels spin by themselves for a second and stop on three Cores. ${giveBooster(c, 'chip')} recovered.` };
                return { text: `The reels spin by themselves and stop on three Glitches. Nothing happens. Then ${giveBooster(c, 'patch')} pops out, apologetically.` };
            } },
        ],
    },
    cache: {
        title: 'Null Data Spike', art: 'spike',
        text: 'A black monolith the size of your hand, humming at exactly 60 hertz. Determinant data. Encrypted, perfectly regular, and very valuable to Signals.',
        choices: [
            { label: 'Decrypt it', go: (c) => {
                if (c.rng.chance(0.55)) { c.p.cores += 1; return { text: 'The spike cracks open. Inside: a lattice of crystallised certainty that KISMET turns into one raw Core. (+1 core)' }; }
                const d = hurt(c, 0.12);
                return { text: `It was bait. The spike screams on every band and the backwash fries a coupling — ${d} hull damage.` };
            } },
            { label: 'Hand it to Signals', go: (c) => { addXp(c.p, Math.round(40 * Math.pow(1.6, c.x))); const n = scrapN(c, 30); c.p.scrap += n; return { text: `Signals Officer Pell is delighted. +${fmt(n)} scrap and a commendation in your file (+XP).` }; } },
        ],
    },
    medic: {
        title: 'Field Hospital', art: 'medic',
        text: 'A fleet hospital ship has its bay doors open for any frame that needs it. The deck chief waves you in.',
        choices: [
            { label: 'Take a free patch-up (40%)', go: (c) => ({ text: `They work fast. +${heal(c, 0.4)} hull.` }) },
            { label: 'Pay for a full rebuild', cost: (c) => Math.round(45 * rewardScale(c.x)), go: (c, cost) => { c.p.scrap -= cost; return { text: `Every plate replaced. +${heal(c, 1)} hull.` }; } },
        ],
    },
    cadet: {
        title: 'Stranded Cadet', art: 'cadet',
        text: 'A cadet from Blue Flight, frame dead, floating in a pressure suit and trying very hard to sound calm on the radio.',
        choices: [
            { label: 'Tow them home', go: (c) => { addXp(c.p, Math.round(50 * Math.pow(1.6, c.x))); return { text: `It costs you time, not much else. They press a ${giveBooster(c, 'nanite', 2)} into your hand at the airlock. (+XP)` }; } },
            { label: 'Mark them for pickup', go: () => ({ text: 'Search and rescue confirms the pickup an hour later. You check twice.' }) },
        ],
    },
    rift: {
        title: 'Probability Rift', art: 'rift',
        text: 'Space folds here like a card. On the other side, every version of this moment you did not choose. KISMET says stepping through is "statistically survivable".',
        choices: [
            { label: 'Step through', go: (c) => { const d = hurt(c, 0.15); return { text: `It takes ${d} hull out of you. You come back holding something that was never yours: ${giveMod(c, 1)}` }; } },
            { label: 'Hold position', go: (c) => ({ text: `You wait it out. The rift closes. Somehow you feel rested: +${heal(c, 0.15)} hull.` }) },
        ],
    },
    tuning: {
        title: 'Tuning Bay', art: 'tuning',
        text: 'An automated tuning bay, still powered, still calibrated. It can push one of your equipped modules past its factory setting.',
        choices: [
            { label: 'Tune an equipped module', req: (c) => c.p.equipped.some((u) => { const m = c.p.mods.find((x) => x.uid === u); return m && m.lv < RARITIES[m.rar].maxLv; }), go: (c) => {
                const opts = c.p.equipped.map((u) => c.p.mods.find((x) => x.uid === u)).filter((m) => m && m.lv < RARITIES[m.rar].maxLv);
                const m = c.rng.pick(opts);
                m.lv++;
                return { text: `${MODS[m.id].name} hums up to level ${m.lv}.` };
            } },
            { label: 'Strip the bay for parts', go: (c) => { const n = scrapN(c, 50); c.p.scrap += n; return { text: `${fmt(n)} scrap of precision parts.` }; } },
        ],
    },
    ambush: {
        title: 'Silent Wreckfield', art: 'wreck',
        text: 'Too quiet. The wrecks here are arranged in a perfect grid, every hull exactly forty meters apart. Determinant work. Something is waiting.',
        choices: [
            { label: 'Spring the trap (elite fight, better loot)', go: () => ({ text: 'You light your reactor and every wreck in the grid turns to face you.', battle: 'elite' }) },
            { label: 'Go around (lose 10% hull to debris)', go: (c) => ({ text: `The long way costs you ${hurt(c, 0.1)} hull in micro-debris.` }) },
        ],
    },
    juno: {
        title: 'Comm from Halo', art: 'juno',
        text: '"Hey, ace." Juno Okafor, callsign Halo, on a private channel. "Blue Flight\'s got spares. Don\'t tell Varga. What do you need?"',
        choices: [
            { label: '"Something that goes boom."', go: (c) => ({ text: `"Knew you'd say that." ${giveBooster(c, 'emp')} and a wink emoji.` }) },
            { label: '"Honestly? A repair."', go: (c) => ({ text: `"Look at you, being sensible." ${giveBooster(c, 'nanite')}, and +${heal(c, 0.15)} hull from the drone that brings it.` }) },
            { label: '"Luck."', go: (c) => ({ text: `"Ha. Here." A ${giveBooster(c, 'coin')} — she has scratched a smiley on it.` }) },
        ],
    },
};
export const EVENT_IDS = Object.keys(EVENTS);

export function pickEvent(rng, chapter) {
    const pool = EVENT_IDS.filter((id) => !(chapter === 0 && (id === 'ambush' || id === 'market' || id === 'cache')));
    return rng.pick(pool);
}

export function choiceCost(c, ch) {
    return ch.cost ? ch.cost(c) : 0;
}
export function choiceOk(c, ch) {
    if (ch.req && !ch.req(c)) return false;
    if (ch.cost && c.p.scrap < ch.cost(c)) return false;
    return true;
}
export function resolveChoice(c, ch) {
    return ch.go(c, choiceCost(c, ch));
}
