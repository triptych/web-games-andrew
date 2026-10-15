// Turn-based squabbles. Nobody is hurt: you lower each foe's MISCHIEF to zero and it settles
// back into a book or a treat. If your COMPOSURE runs out you're simply overwhelmed, and Wick
// leads you home for a cup of tea.
//
// A round: your action, then Wick's, then each foe's antic, then statuses tick. Everything that
// happens is pushed to G.events as a `b_*` event, in order, for the view and the UI to play back.

import { FOE, ANTICS, statsFor } from './data/enemies.js';
import { GRIMOIRE, COMMON_BOOKS } from './data/books.js';
import { ITEMS } from './data/items.js';
import { maxHp, maxInk, focus, poise, hasCharm, wickPower, gainXp, addItem, takeItem, count } from './rules.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function makeFoe(id, G, n) {
    const d = FOE[id];
    const s = statsFor(d.tier);
    return {
        id, n, name: d.name,
        hp: Math.round(s.hp * d.hpMul), max: Math.round(s.hp * d.hpMul),
        pow: Math.round(s.pow * d.powMul), poise: Math.round(s.poise * d.poiseMul),
        xp: Math.round(s.xp * (d.boss ? 4 : 1)), coins: Math.round(s.coins * (d.boss ? 5 : 1)),
        guard: 0, drowsy: 0, shrunk: 0, understood: false, charging: false, calm: false,
        boss: !!d.boss,
    };
}

/** Begin a battle with these foe ids. opts: { spawn, boss } */
export function startBattle(G, ids, opts = {}) {
    const foes = ids.map((id, n) => makeFoe(id, G, n));
    // the same name twice reads badly: number them
    const tally = {};
    for (const f of foes) tally[f.id] = (tally[f.id] || 0) + 1;
    const seen = {};
    for (const f of foes) if (tally[f.id] > 1) f.name += ' ' + 'ABC'[(seen[f.id] = (seen[f.id] || 0) + 1) - 1];
    G.battle = {
        foes, round: 1, phase: 'choose',
        st: { muddled: 0, smudged: 0, steady: 0, dodge: 0, regen: 0, guard: 0 },
        spawn: opts.spawn || null, boss: opts.boss || null, dungeon: opts.dungeon || null,
        lastSpell: null,
        result: null,
        nextN: foes.length,
    };
    G.mode = 'battle';
    G.stats.battles++;
    G.events.push({ type: 'b_start', foes: foes.map((f) => f.id), boss: !!opts.boss, final: !!(opts.boss && FOE[opts.boss]?.final) });
}

const say = (G, text, extra = {}) => G.events.push({ type: 'b_say', text, ...extra });

function liveFoes(B) { return B.foes.filter((f) => !f.calm); }

function pickTarget(B, t) {
    const live = liveFoes(B);
    return live.find((f) => f.n === t) || live[0];
}

function elemMul(foeId, elem) {
    const d = FOE[foeId];
    if (!elem) return 1;
    if (d.weak.includes(elem)) return 1.75;
    if (d.resist.includes(elem)) return 0.5;
    return 1;
}

function calmFoe(G, f, by) {
    const B = G.battle;
    f.calm = true;
    f.hp = 0;
    const d = FOE[f.id];
    // what it turns back into
    let book = null, item = null;
    if (!d.boss && d.genre) {
        const missing = COMMON_BOOKS.filter((b) => b.genre === d.genre && !G.common[b.id]);
        // the first of each kind is a sure thing; after that, a good chance
        const chance = G.stats.calmed < 3 ? 1 : 0.42;
        if (missing.length && G.rng() < chance) {
            book = missing[Math.floor(G.rng() * missing.length)].id;
            G.common[book] = 1;
        }
    }
    if (d.drop && G.rng() < d.drop[1]) { item = d.drop[0]; addItem(G, item, 1); }
    G.stats.calmed++;
    G.events.push({ type: 'b_calm', foe: f.n, id: f.id, book, item, by });
}

function dealCalm(G, f, amount, info) {
    amount = Math.max(1, Math.round(amount));
    f.hp = Math.max(0, f.hp - amount);
    G.events.push({ type: 'b_hit', foe: f.n, amount, ...info });
    if (f.hp <= 0) calmFoe(G, f, info.by);
}

function shushDamage(G, f) {
    const B = G.battle;
    let base = focus(G) * (0.9 + G.rng() * 0.2);
    const fp = f.poise * (f.guard ? 1.6 : 1);
    base *= 20 / (20 + fp);
    if (f.understood) base *= 1.25;
    if (B.st.muddled) base *= 0.7;
    const crit = G.rng() < (hasCharm(G, 'glasses') ? 0.13 : 0.07);
    if (crit) base *= 1.6;
    return { amount: base, crit };
}

function spellDamage(G, f, sp) {
    let base = (focus(G) * 0.55 + G.lvl * 1.5 + sp.power * 1.6) * (0.92 + G.rng() * 0.16);
    const fp = f.poise * (f.guard ? 1.6 : 1);
    base *= 30 / (30 + fp);
    const em = elemMul(f.id, sp.elem);
    base *= em;
    if (f.understood) base *= 1.15;
    if (sp.target === 'all') base *= 0.72;
    return { amount: base, mul: em };
}

const healCap = (G, n) => {
    const before = G.hp;
    G.hp = Math.min(maxHp(G), G.hp + Math.round(n));
    return G.hp - before;
};

// ------------------------------------------------------------------ the player's turn
/** cmd: { act: 'shush'|'read'|'spell'|'item'|'tidy'|'flee', target, id } */
export function battleAct(G, cmd) {
    const B = G.battle;
    if (!B || B.phase !== 'choose') return false;
    const st = B.st;
    let tookTurn = true;
    st.guard = 0;
    if (hasCharm(G, 'quillpin')) G.ink = Math.min(maxInk(G), G.ink + 2);

    if (cmd.act === 'shush') {
        const f = pickTarget(B, cmd.target);
        const { amount, crit } = shushDamage(G, f);
        say(G, crit ? `A perfectly timed "Shh!" — ${f.name} is spellbound!` : `You hold a finger to your lips: "Shh!"`, { who: 'you', anim: 'shush', foe: f.n });
        dealCalm(G, f, amount, { crit, by: 'shush' });
    } else if (cmd.act === 'read') {
        const f = pickTarget(B, cmd.target);
        const d = FOE[f.id];
        f.understood = true;
        say(G, `You read ${f.name}. ${d.read}`, { who: 'you', anim: 'read', foe: f.n });
        const w = d.weak.length ? 'It goes soft for ' + d.weak.map(cap).join(' and ') + '.' : '';
        const r = d.resist.length ? ' It shrugs off ' + d.resist.map(cap).join(' and ') + '.' : '';
        if (w || r) say(G, (w + r).trim(), { who: 'info', foe: f.n });
        say(G, `Understanding it, your calming words land better.`, { who: 'info' });
        if (hasCharm(G, 'glasses')) tookTurn = false;
    } else if (cmd.act === 'spell') {
        const book = GRIMOIRE[cmd.id];
        if (!book || !G.books.includes(cmd.id)) return false;
        const sp = book.spell;
        if (G.ink < sp.ink) return false;
        G.ink -= sp.ink;
        B.lastSpell = cmd.id;
        say(G, `You read aloud from ${book.title}: ${sp.name}!`, { who: 'you', anim: 'spell', book: cmd.id, elem: sp.elem, foe: cmd.target });
        if (sp.kind === 'calm') {
            const targets = sp.target === 'all' ? liveFoes(B) : [pickTarget(B, cmd.target)];
            for (const f of targets) {
                if (f.calm) continue;
                const { amount, mul } = spellDamage(G, f, sp);
                if (sp.strip && f.guard) { f.guard = 0; say(G, `${f.name}'s guard comes undone.`, { who: 'info', foe: f.n }); }
                dealCalm(G, f, amount, { by: 'spell', elem: sp.elem, weak: mul > 1, resist: mul < 1 });
                if (!f.calm && sp.drowsy && G.rng() < sp.drowsy * (mul > 1 ? 1.2 : 1)) {
                    f.drowsy = 1;
                    say(G, `${f.name} grows drowsy…`, { who: 'info', foe: f.n });
                }
            }
        } else if (sp.kind === 'guard') {
            st.steady = 3;
            say(G, 'You feel as steady as a mountain.', { who: 'info', anim: 'buff' });
            const f = pickTarget(B, cmd.target);
            if (f) dealCalm(G, f, spellDamage(G, f, sp).amount * 0.6, { by: 'spell', elem: sp.elem });
        } else if (sp.kind === 'heal') {
            const got = healCap(G, sp.power + G.lvl * 3);
            st.smudged = 0;
            G.events.push({ type: 'b_heal', amount: got, who: 'you' });
        } else if (sp.kind === 'regen') {
            st.regen = 4;
            say(G, 'Petals unfurl around you.', { who: 'info', anim: 'buff' });
        } else if (sp.kind === 'shrink') {
            const f = pickTarget(B, cmd.target);
            f.shrunk = 3;
            say(G, `${f.name} shrinks to the size of a thimble!`, { who: 'info', foe: f.n });
            dealCalm(G, f, spellDamage(G, f, sp).amount * 0.7, { by: 'spell', elem: sp.elem });
        } else if (sp.kind === 'dodge') {
            st.dodge = 1;
            say(G, 'You feel light as a feather.', { who: 'info', anim: 'buff' });
        }
    } else if (cmd.act === 'item') {
        const it = ITEMS[cmd.id];
        if (!it || it.kind !== 'use' || !count(G, cmd.id)) return false;
        if (it.flee && B.boss) { say(G, 'A guardian won\'t be slipped away from.', { who: 'info' }); return true; }
        takeItem(G, cmd.id);
        say(G, `You use the ${it.name}.`, { who: 'you', anim: 'item', item: cmd.id });
        useEffects(G, it, true);
        if (it.flee) { endBattle(G, 'fled'); return true; }
    } else if (cmd.act === 'tidy') {
        st.guard = 1;
        G.ink = Math.min(maxInk(G), G.ink + 3);
        say(G, 'You straighten your cardigan and breathe. (Guarding; ink +3)', { who: 'you', anim: 'tidy' });
    } else if (cmd.act === 'flee') {
        if (B.boss) { say(G, 'There\'s no slipping away from a guardian.', { who: 'info' }); return true; }
        const ok = hasCharm(G, 'owl') || G.rng() < 0.7;
        say(G, ok ? 'You slip quietly away.' : 'You try to slip away, but trip over a stray page!', { who: 'you', anim: ok ? 'flee' : 'trip' });
        if (ok) { endBattle(G, 'fled'); return true; }
    } else return false;

    if (!liveFoes(B).length) { endBattle(G, 'won'); return true; }
    if (!tookTurn) return true;

    wickTurn(G);
    if (!liveFoes(B).length) { endBattle(G, 'won'); return true; }
    foesTurn(G);
    if (G.hp <= 0) { endBattle(G, 'lost'); return true; }
    tick(G);
    if (G.hp <= 0) { endBattle(G, 'lost'); return true; }
    B.round++;
    G.events.push({ type: 'b_round', round: B.round });
    return true;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function useEffects(G, it, inBattle) {
    const mult = hasCharm(G, 'teacup') ? 1.5 : 1;
    if (it.heal) {
        const got = healCap(G, it.heal === 999 ? 9999 : it.heal * mult);
        G.events.push({ type: inBattle ? 'b_heal' : 'heal', amount: got, who: 'you' });
    }
    if (it.ink) {
        const before = G.ink;
        G.ink = Math.min(maxInk(G), G.ink + it.ink);
        G.events.push({ type: inBattle ? 'b_ink' : 'inkup', amount: G.ink - before });
    }
    if (it.cure && G.battle) { G.battle.st.muddled = 0; G.battle.st.smudged = 0; }
}

// Wick lends a hand: a warm crackle at a foe, or fussing over you when you're frazzled.
function wickTurn(G) {
    const B = G.battle;
    const p = wickPower(G);
    if (!G.flags.metWick) return;
    if (G.hp < maxHp(G) * 0.35 && G.rng() < 0.75) {
        const got = healCap(G, p * 2.2);
        say(G, 'Wick fusses over you, warm as a hot-water bottle.', { who: 'wick', anim: 'wickheal' });
        G.events.push({ type: 'b_heal', amount: got, who: 'wick' });
        return;
    }
    const live = liveFoes(B);
    const f = live[Math.floor(G.rng() * live.length)];
    say(G, `Wick crackles cheerfully at ${f.name}.`, { who: 'wick', anim: 'wickhit', foe: f.n });
    dealCalm(G, f, p * (0.85 + G.rng() * 0.3) * elemMul(f.id, 'fire') ** 0.5, { by: 'wick', elem: 'fire' });
}

function foesTurn(G) {
    const B = G.battle;
    const st = B.st;
    for (const f of B.foes.slice()) {
        if (f.calm || G.hp <= 0) continue;
        if (f.drowsy) { f.drowsy = 0; say(G, `${f.name} is too drowsy to do anything but yawn.`, { who: 'foe', foe: f.n, anim: 'yawn' }); continue; }
        const d = FOE[f.id];
        let key;
        if (f.charging) { key = 'slam'; f.charging = false; }
        else {
            const opts = d.antics.filter(([k]) => {
                if (k === 'tidy') return f.hp < f.max * 0.6;
                if (k === 'call') return liveFoes(B).length < 3 && (B.calls || 0) < (B.boss ? 2 : 1);
                if (k === 'rustle') return !f.guard;
                return true;
            });
            const total = opts.reduce((a, [, w]) => a + w, 0);
            let r = G.rng() * total;
            key = opts[0][0];
            for (const [k, w] of opts) { if ((r -= w) < 0) { key = k; break; } }
        }
        const a = ANTICS[key];
        const text = a.text.replace('{n}', f.name);
        if (a.charge) { f.charging = true; say(G, text, { who: 'foe', foe: f.n, anim: 'charge' }); continue; }
        if (a.self === 'guard') { f.guard = 2; say(G, text, { who: 'foe', foe: f.n, anim: 'rustle' }); continue; }
        if (a.heal) {
            const n = Math.round(f.max * a.heal);
            f.hp = Math.min(f.max, f.hp + n);
            say(G, text, { who: 'foe', foe: f.n, anim: 'tidy' });
            G.events.push({ type: 'b_foeheal', foe: f.n, amount: n });
            continue;
        }
        if (a.call) {
            const kind = d.summon || f.id;
            const nf = makeFoe(kind, G, B.nextN++);
            // a helper that's called in is a smaller one
            nf.max = nf.hp = Math.round(nf.max * 0.6);
            nf.xp = Math.round(nf.xp * 0.6);
            B.calls = (B.calls || 0) + 1;
            B.foes.push(nf);
            say(G, text, { who: 'foe', foe: f.n, anim: 'call' });
            G.events.push({ type: 'b_join', foe: nf.n, id: nf.id });
            continue;
        }
        // an antic aimed at you
        if (st.dodge) {
            st.dodge = 0;
            say(G, text, { who: 'foe', foe: f.n, anim: 'attack' });
            say(G, 'You float gently out of the way!', { who: 'info', anim: 'dodge' });
            continue;
        }
        let dmg = f.pow * a.dmg * (0.85 + G.rng() * 0.3);
        const ps = poise(G) * (st.steady ? 1.6 : 1);
        dmg *= 25 / (25 + ps);
        if (f.shrunk) dmg *= 0.6;
        if (st.guard) dmg *= 0.5;
        dmg = Math.max(1, Math.round(dmg));
        G.hp = Math.max(0, G.hp - dmg);
        say(G, text, { who: 'foe', foe: f.n, anim: 'attack' });
        G.events.push({ type: 'b_ouch', amount: dmg, foe: f.n, guard: !!st.guard });
        if (a.drainInk) G.ink = Math.max(0, G.ink - a.drainInk);
        if (a.status && G.hp > 0) {
            if (st[a.status] === 0) say(G, a.status === 'muddled' ? 'You feel muddled. (Shush is weaker for a while.)' : 'You\'re smudged with ink. (It wears at your composure.)', { who: 'info' });
            st[a.status] = a.status === 'muddled' ? 2 : 3;
        }
    }
}

function tick(G) {
    const B = G.battle;
    const st = B.st;
    if (st.smudged) {
        st.smudged--;
        const n = Math.max(1, Math.round(maxHp(G) * 0.04));
        G.hp = Math.max(0, G.hp - n);
        G.events.push({ type: 'b_ouch', amount: n, smudge: true });
    }
    if (st.regen) {
        st.regen--;
        const got = healCap(G, GRIMOIRE.verdant.spell.power + G.lvl * 1.5);
        G.events.push({ type: 'b_heal', amount: got, who: 'bloom' });
    }
    if (hasCharm(G, 'musicbox')) healCap(G, 4);
    if (st.muddled) st.muddled--;
    if (st.steady) st.steady--;
    for (const f of B.foes) {
        if (f.guard) f.guard--;
        if (f.shrunk) f.shrunk--;
    }
}

function endBattle(G, how) {
    const B = G.battle;
    B.phase = how;
    const res = { how, xp: 0, coins: 0, books: [], items: [], lvlBefore: G.lvl };
    if (how === 'won') {
        for (const f of B.foes) {
            res.xp += f.xp;
            res.coins += Math.round(f.coins * (hasCharm(G, 'acorn') ? 1.5 : 1));
        }
        G.coins += res.coins;
        gainXp(G, res.xp);
        res.lvlAfter = G.lvl;
        if (B.boss) {
            const d = FOE[B.boss];
            G.bosses[B.boss] = 1;
            if (d.book) {
                G.books.push(d.book);
                res.grimoire = d.book;
            }
        }
    }
    B.result = res;
    G.events.push({ type: 'b_end', how, result: res });
}

/** Leave the battle screen (after its result has been shown). */
export function closeBattle(G) {
    const B = G.battle;
    if (!B || B.phase === 'choose') return;
    G.battle = null;
    G.mode = 'explore';
    return B;
}

// Exposed for the tests and the bot
export { elemMul, liveFoes };
