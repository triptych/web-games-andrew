// The fight engine. LoGD's arithmetic, with buffs, skills and a few modern
// touches (power moves, the Wyrm's breath, auto-fight that stops when you're
// badly hurt). Pure logic: it mutates the player and fight objects and returns
// coded log lines plus event records the UI uses for animation.

import { R } from '../rng.js';
import { attack, defense, maxHp, race, spec, guild } from './state.js';
import { SPECIALTIES } from '../data/classes.js';

// Attack rolls are scaled so a fight at your own level lasts about seven rounds:
// your swings count for more than a creature's (it's your story, after all).
const P_MULT = 1.6, F_MULT = 1.3;

/** Start a fight. foe: {name, weapon, kind, color, level, maxhp, atk, def, ...} */
export function startFight(p, type, foe, extra = {}) {
    p.fight = {
        type, foe: { ...foe, hp: foe.hp ?? foe.maxhp }, round: 0, taken: 0,
        log: [], over: false, result: null, ...extra,
    };
    return p.fight;
}

function mult(p, key) {
    let m = 1;
    for (const b of p.buffs) if (b[key] != null) m *= b[key];
    return m;
}

function pAtk(p) {
    let a = attack(p) * mult(p, 'atk');
    const g = guild(p); if (g && g.perk === 'atk') a *= 1.05;
    return a;
}
function pDef(p) {
    let d = defense(p) * mult(p, 'def');
    const g = guild(p); if (g && g.perk === 'def') d *= 1.05;
    return d;
}

const sub = (s, f, extra = {}) => s.replace(/\{foe\}/g, f.name).replace(/\{(\w+)\}/g, (m, k) => (extra[k] != null ? extra[k] : m));

/** Play one round. Returns { lines, events }. events: {who:'you'|'foe', type:'hit'|'miss'|'power'|'heal'|'breath'|'minion', dmg} */
export function playRound(p, opts = {}) {
    const f = p.fight; if (!f || f.over) return { lines: [], events: [] };
    const foe = f.foe;
    const lines = [], events = [];
    f.round++;

    // --- start of round: regen, minions, damage over time
    const regenRace = race(p).regen || 0;
    let regen = regenRace;
    for (const b of p.buffs) if (b.regen) regen += typeof b.regen === 'number' ? b.regen : Math.round(maxHp(p) * b.regenPct);
    if (regen > 0 && p.hp < maxHp(p)) {
        const h = Math.min(regen, maxHp(p) - p.hp);
        p.hp += h;
        if (h > 0) { lines.push(`\`@You regenerate \`^${h}\`@ hit point${h === 1 ? '' : 's'}.`); events.push({ who: 'you', type: 'heal', dmg: h }); }
    }
    for (const b of p.buffs) {
        if (b.minion && foe.hp > 0) {
            for (let i = 0; i < (b.minion.count || 1); i++) {
                const d = R.i(b.minion.min, b.minion.max);
                if (d > 0) { foe.hp -= d; lines.push('`)' + sub(b.minion.msg, foe, { dmg: d })); events.push({ who: 'foe', type: 'minion', dmg: d }); }
                else lines.push('`7' + sub(b.minion.miss || '{foe} evades your ally.', foe));
            }
        }
        if (b.dot && foe.hp > 0) {
            const d = Math.max(1, Math.round(b.dot));
            foe.hp -= d; lines.push(`\`2${sub(b.dotMsg || '{foe} suffers {dmg} damage.', foe, { dmg: '`^' + d + '`2' })}`);
            events.push({ who: 'foe', type: 'minion', dmg: d });
        }
    }

    // --- your attack (skipped if the foe ambushed you this round)
    if (foe.hp > 0 && !opts.skipYou) {
        const a = pAtk(p);
        const fd = foe.def * mult(p, 'foeDef');
        let dmg = Math.round(R.bell(0, a) * P_MULT - R.bell(0, fd));
        let power = false;
        if (f.firstStrike || R.chance(0.05)) {
            f.firstStrike = false; power = true; dmg = Math.max(dmg, Math.round(a * 0.6)) * R.i(2, 3); }
        if (foe.breathing) { dmg = Math.max(1, dmg) + Math.round(a * 0.5); }
        if (dmg > 0) {
            foe.hp -= dmg;
            if (power) lines.push('`&`b~~ POWER MOVE! ~~`b');
            lines.push(`\`4You hit \`^${foe.name}\`4 for \`$${dmg}\`4 point${dmg === 1 ? '' : 's'} of damage!`);
            events.push({ who: 'foe', type: power ? 'power' : 'hit', dmg });
            p.stats.bestHit = Math.max(p.stats.bestHit, dmg);
            const drain = p.buffs.reduce((s, b) => s + (b.drain || 0), 0);
            if (drain > 0) {
                const h = Math.min(Math.round(dmg * drain), maxHp(p) - p.hp);
                if (h > 0) { p.hp += h; lines.push(`\`5Stolen life floods into you: +\`^${h}\`5 HP.`); events.push({ who: 'you', type: 'heal', dmg: h }); }
            }
        } else {
            lines.push(`\`4You try to hit \`^${foe.name}\`4 but \`$MISS!`);
            events.push({ who: 'foe', type: 'miss', dmg: 0 });
        }
    }

    // --- foe's attack
    if (foe.hp > 0) {
        const fa = foe.atk * mult(p, 'foeAtk');
        const d = pDef(p);
        let dmg;
        if (f.type === 'wyrm' && f.round % 4 === 0) {
            dmg = R.i(12, 24) + Math.round(foe.level * 0.5);
            dmg = Math.round(dmg * mult(p, 'foeAtk'));
            lines.push(`\`@\`bThe Jade Wyrm rears back and breathes a torrent of jade fire!\`b`);
            p.hp -= dmg; f.taken += dmg;
            lines.push(`\`2The flames sear you for \`$${dmg}\`2 points of damage!`);
            events.push({ who: 'you', type: 'breath', dmg });
            foe.breathing = false;
        } else {
            if (f.type === 'wyrm' && f.round % 4 === 3) { foe.breathing = true; lines.push('`2The Wyrm\'s chest swells with green light. It is drawing breath...'); }
            dmg = Math.round(R.bell(0, fa) * F_MULT - R.bell(0, d));
            if (dmg > 0) {
                p.hp -= dmg; f.taken += dmg;
                lines.push(`\`^${foe.name}\`4 hits you with ${foe.weapon} for \`$${dmg}\`4 point${dmg === 1 ? '' : 's'} of damage!`);
                events.push({ who: 'you', type: 'hit', dmg });
                const reflect = p.buffs.reduce((s, b) => s + (b.reflect || 0), 0);
                if (reflect > 0 && foe.hp > 0) {
                    const r = Math.max(1, Math.round(dmg * reflect));
                    foe.hp -= r; lines.push(`\`#Lightning lashes back at ${foe.name} for \`^${r}\`# damage!`);
                    events.push({ who: 'foe', type: 'minion', dmg: r });
                }
            } else {
                lines.push(`\`^${foe.name}\`4 tries to hit you but \`@MISSES!`);
                events.push({ who: 'you', type: 'miss', dmg: 0 });
            }
        }
    }

    // --- buffs tick down
    for (const b of p.buffs) {
        if (b.rounds != null) b.rounds--;
    }
    const expired = p.buffs.filter((b) => b.rounds != null && b.rounds <= 0);
    for (const b of expired) lines.push(`\`7${b.wear || b.name + ' fades.'}`);
    p.buffs = p.buffs.filter((b) => !(b.rounds != null && b.rounds <= 0));

    if (foe.hp <= 0) { foe.hp = 0; f.over = true; f.result = 'win'; }
    else if (p.hp <= 0) { p.hp = 0; f.over = true; f.result = 'lose'; }
    f.log.push(...lines.map((l) => ({ r: f.round, l })));
    if (f.log.length > 80) f.log.splice(0, f.log.length - 80);
    return { lines, events };
}

/** Attempt to flee. */
export function tryRun(p) {
    const f = p.fight;
    if (R.chance(0.4)) {
        f.over = true; f.result = 'fled';
        return { ok: true, lines: ['`@You flee, crashing through the undergrowth, and escape!'] };
    }
    const r = playRound(p, { skipYou: true });
    return { ok: false, lines: ['`$You try to flee but ' + f.foe.name + ' blocks your way!', ...r.lines], events: r.events };
}

/** Use a specialty skill. Returns { lines, events } including the round played. */
export function useSkill(p, skillId) {
    const sp = SPECIALTIES[p.spec];
    const sk = sp.skills.find((s) => s.id === skillId);
    const f = p.fight;
    if (!sk || p.specLevel < sk.need || p.specUses < sk.cost) return { lines: ['`7You cannot do that right now.'], events: [] };
    p.specUses -= sk.cost;
    const L = p.level + p.dk;
    const lines = [], events = [];
    const add = (b) => { p.buffs = p.buffs.filter((x) => x.id !== b.id); p.buffs.push(b); };
    switch (sk.id) {
        case 'bones': add({ id: 'bones', name: 'Bone Servants', rounds: 5, fightOnly: true, minion: { count: 1 + Math.floor(p.specLevel / 4), min: 1, max: 2 + p.level, msg: 'A bone servant claws {foe} for `^{dmg}`) damage!', miss: 'A bone servant stumbles and misses {foe}.' }, wear: 'Your bone servants crumble back into the earth.' });
            lines.push('`5You speak a word that should not be spoken. Skeletal hands claw up out of the forest floor!'); break;
        case 'hex': add({ id: 'hex', name: 'Hex of Rot', rounds: 5, fightOnly: true, foeAtk: 0.6, dot: 1 + L * 0.6, dotMsg: '{foe} festers for {dmg} damage.', wear: 'The hex of rot lifts.' });
            lines.push(`\`5You hiss a hex at ${f.foe.name}. Its flesh begins to rot.`); break;
        case 'wither': add({ id: 'wither', name: 'Withering Curse', rounds: 5, fightOnly: true, foeDef: 0.4, wear: 'The withering curse fades.' });
            lines.push(`\`5The withering curse settles on ${f.foe.name}; its guard crumbles like old parchment.`); break;
        case 'soulrend': {
            const dmg = Math.round(L * 3 + R.i(5, 15) + attack(p));
            f.foe.hp -= dmg; const h = Math.min(Math.round(dmg / 3), maxHp(p) - p.hp); p.hp += h;
            lines.push(`\`5\`bYou reach into ${f.foe.name} and tear at its soul for \`$${dmg}\`5 damage!\`b`);
            if (h > 0) lines.push(`\`5You drink \`^${h}\`5 HP from what spills out.`);
            events.push({ who: 'foe', type: 'power', dmg }); break;
        }
        case 'mend': add({ id: 'mend', name: 'Mending Light', rounds: 5, regen: Math.max(2, Math.round(maxHp(p) * 0.08)), wear: 'The mending light fades.' });
            lines.push('`#Warm golden light wells up around your wounds.'); break;
        case 'stonefist': add({ id: 'stonefist', name: 'Stonefist', rounds: 5, atk: 2, wear: 'Your fists soften back into flesh.' });
            lines.push('`#Your fists grind and crack as they turn to granite!'); break;
        case 'drain': add({ id: 'drain', name: 'Lifedrain', rounds: 5, drain: 0.5, wear: 'The hunger in your strikes fades.' });
            lines.push('`#A violet hunger spreads into your weapon.'); break;
        case 'aegis': add({ id: 'aegis', name: 'Storm Aegis', rounds: 6, def: 1.5, reflect: 0.5, wear: 'The storm aegis crackles out.' });
            lines.push('`#Thunder rolls as a crackling ward of lightning wraps around you!'); break;
        case 'taunt': add({ id: 'taunt', name: 'Cutting Taunt', rounds: 5, fightOnly: true, foeAtk: 0.8, foeDef: 0.8, wear: `${f.foe.name} recovers from your insult.` });
            lines.push(`\`^You tell ${f.foe.name} exactly what its mother thought of it. It flinches.`); break;
        case 'venom': add({ id: 'venom', name: 'Venom Blade', rounds: 5, atk: 1.6, dot: 1 + L * 0.4, fightOnly: true, dotMsg: 'Poison burns in {foe}\'s veins for {dmg}.', wear: 'The venom on your blade dries.' });
            lines.push('`^You slick your blade with something green and evil-smelling.'); break;
        case 'vanish': add({ id: 'vanish', name: 'Vanish', rounds: 5, foeAtk: 0.3, fightOnly: true, wear: 'You step back out of the shadows.' });
            lines.push(`\`^You melt into the shadows. ${f.foe.name} swings wildly at nothing.`); break;
        case 'backstab': {
            const dmg = Math.round(attack(p) * R.f() * 2 + L * 3.5 + 10);
            f.foe.hp -= dmg;
            lines.push(`\`^\`bYou slip behind ${f.foe.name} and drive your blade home for \`$${dmg}\`^ damage!\`b`);
            events.push({ who: 'foe', type: 'power', dmg }); break;
        }
    }
    p.specPoints[sk.id] = (p.specPoints[sk.id] || 0) + 1;
    if (f.foe.hp <= 0) { f.foe.hp = 0; f.over = true; f.result = 'win'; f.log.push(...lines.map((l) => ({ r: f.round, l }))); return { lines, events }; }
    const r = playRound(p);
    return { lines: [...lines, ...r.lines], events: [...events, ...r.events] };
}

/** After any fight: drop fight-only buffs. */
export function endFight(p) {
    p.buffs = p.buffs.filter((b) => !b.fightOnly);
}

/** Quick simulation of a whole fight between two stat blocks (for NPC vs you while you sleep). */
export function simDuel(a, b, rounds = 60) {
    let ah = a.hp, bh = b.hp;
    for (let i = 0; i < rounds; i++) {
        const d1 = Math.round(R.bell(0, a.atk) - R.bell(0, b.def)); if (d1 > 0) bh -= d1;
        if (bh <= 0) return { winner: 'a', aHp: ah, bHp: 0 };
        const d2 = Math.round(R.bell(0, b.atk) - R.bell(0, a.def)); if (d2 > 0) ah -= d2;
        if (ah <= 0) return { winner: 'b', aHp: 0, bHp: bh };
    }
    return { winner: ah / a.hp >= bh / b.hp ? 'a' : 'b', aHp: ah, bHp: bh };
}

export function playerDuelStats(p) {
    return { hp: Math.max(1, p.hp), atk: attack(p), def: defense(p) };
}
export { spec };
