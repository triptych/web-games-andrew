// Ink duels: a timed writing sprint against a foe whose health is the words you must write. Pure: the UI
// passes the word count of the duel pad and the time (ms) on every call.
//
// Each new word strikes for 1 (more with relics); words deleted and retyped don't strike twice. Pause for
// longer than DUEL.idleGrace and the foe recovers at its regen rate. Run out of time and it escapes, but
// every word you wrote is still yours: the UI puts it in the book either way.

import { DUEL } from '../config.js';
import { FOE_BY_ID } from './data/guild.js';
import { bonuses, hasTalent, gainXp, giveRelic, touchToday } from './progress.js';
import { hash3 } from '../rng.js';
import { MAIN_BY_ID } from './quests.js';

const emit = (S, e) => S.events.push(e);

export function foeOpen(S, id) {
    const f = FOE_BY_ID[id];
    if (!f) return false;
    if (S.player.freePen) return true;
    return S.player.main > MAIN_BY_ID[f.after].index;
}

export function newDuel(S, foeId, now, { words = 200, minutes = 10 } = {}) {
    const f = FOE_BY_ID[foeId];
    if (!f) return null;
    const b = bonuses(S);
    const hp = f.training ? Math.max(10, Math.round(words)) : f.hp;
    const secs = (f.training ? Math.max(1, minutes) : f.time) * 60 * (1 + b.duelTime);
    return {
        foe: foeId, hp, max: hp, time: Math.round(secs), start: now, last: now, tick: now,
        words: 0, peak: 0, dealt: 0, state: 'on', lastTaunt: now, taunts: 0, healed: 0,
        dmg: 1 + b.duelDamage, regen: f.regen * Math.max(0, 1 + b.duelRegen), surge: hasTalent(S, 'd_surge'),
    };
}

export const timeLeft = (D, now) => Math.max(0, D.time - (now - D.start) / 1000);

/** The pad now holds `words` words. */
export function duelWrite(S, D, words, now) {
    if (D.state !== 'on') return 0;
    duelTick(S, D, now);
    if (D.state !== 'on') return 0;
    if (words <= D.peak) { D.words = words; return 0; }
    const fresh = words - D.peak;
    let dmg = fresh * D.dmg;
    if (D.surge) dmg += (Math.floor(words / 100) - Math.floor(D.peak / 100)) * 10;
    D.peak = words;
    D.words = words;
    D.last = now;
    D.hp = Math.max(0, D.hp - dmg);
    D.dealt += dmg;
    emit(S, { type: 'duel-hit', dmg: Math.round(dmg * 10) / 10, hp: D.hp });
    if (D.hp <= 0) win(S, D, now);
    return dmg;
}

/** Advance the clock: recovery while idle, taunts, and the end of time. */
export function duelTick(S, D, now) {
    if (D.state !== 'on') return;
    const dt = Math.max(0, (now - D.tick) / 1000);
    D.tick = now;
    const idle = (now - D.last) / 1000;
    if (idle > DUEL.idleGrace && D.regen > 0 && D.hp < D.max) {
        const h = Math.min(D.max - D.hp, D.regen * Math.min(dt, idle - DUEL.idleGrace));
        D.hp += h;
        D.healed += h;
    }
    if (idle > DUEL.idleGrace && (now - D.lastTaunt) / 1000 > DUEL.taunt) {
        D.lastTaunt = now;
        const f = FOE_BY_ID[D.foe];
        const line = f.taunts[Math.floor(hash3(D.start | 0, D.taunts++, 7) * f.taunts.length)];
        emit(S, { type: 'taunt', text: line });
    }
    if (timeLeft(D, now) <= 0) lose(S, D);
}

export function duelYield(S, D) {
    if (D.state === 'on') lose(S, D);
}

function record(S, id) {
    return (S.player.bestiary[id] ||= { wins: 0, losses: 0, best: 0 });
}

function win(S, D, now) {
    D.state = 'won';
    const f = FOE_BY_ID[D.foe];
    const r = record(S, D.foe);
    const first = r.wins === 0;
    r.wins++;
    const secs = Math.round((now - D.start) / 1000);
    if (!f.training) r.best = r.best ? Math.min(r.best, secs) : secs;
    S.player.stats.duelsWon += f.training ? 0 : 1;
    if (!f.training) touchToday(S, { today: S.player.today.date }).duels++;
    emit(S, { type: 'duel-won', foe: D.foe, first, secs });
    const xp = f.training ? Math.round(D.max * 0.25) : first ? f.xp : Math.round(f.xp * 0.4);
    gainXp(S, xp, `Defeated: ${f.name}`, 'plain');
    if (first && f.drop) giveRelic(S, f.drop);
}

function lose(S, D) {
    D.state = 'lost';
    record(S, D.foe).losses++;
    S.player.stats.duelsLost++;
    emit(S, { type: 'duel-lost', foe: D.foe });
}
