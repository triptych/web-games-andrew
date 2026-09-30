/**
 * run.js — a whole journey through the ten realms. Pure and seeded; the UI
 * calls these functions and persists `run` as JSON.
 *
 * run.phase: 'map' (choose a node) | 'node' (inside run.pending) | 'dead' | 'ending' | 'done'
 * run.pending: what the current node is waiting on:
 *   { type:'combat', kind, nodeId, species, seed }        → UI plays combat.js, then finishCombat()
 *   { type:'reward', gold, cards[], relic, elixir, crown } → takeReward…/skipReward, then leaveNode()
 *   { type:'event', ev, done?, log? }                      → chooseEvent()
 *   { type:'shop', stock }                                 → buy*, purge, leaveNode()
 *   { type:'rest', done? }                                 → rest()/temper()
 *   { type:'treasure', relic, gold }                       → openTreasure()
 * run.picks: queue of card choices the UI must ask for: {kind:'remove'|'upgrade'|'enchant'|'duplicate', ench?, upgradeToo?}
 * run.story: queue of story beats the UI must show before continuing.
 */

import { makeStateRng, hashSeed, makeRng } from './rng.js';
import { WORLDS, FLOORS, ELIXIR_SLOTS, HANDS, rankLabel } from './rules.js';
import { WORLD_DEFS } from './worlds.js';
import { HEROES, heroIdentity, starterDeck } from './heroes.js';
import { generateMap, reachable } from './map.js';
import { encounterFor } from './monsters.js';
import { makeEvent } from './events.js';
import { RELICS, rollRelic, relicName, relicPrice, ELIXIR_KEYS, ELIXIRS, elixirPrice } from './relics.js';
import {
    rollRewardCard, cardValue, cardName, playCard, jokerCard, arcanaCard, ashCard, ENCHANT_KEYS, ARCANA, ARCANA_KEYS,
} from './cards.js';
import { CHAPTERS, ENDINGS } from './story.js';
import { evaluate } from './poker.js';

export const SAVE_VERSION = 1;

// ------------------------------------------------------------------ creation

export function newRun(seed, cls, identity = null) {
    const h = HEROES[cls];
    const id = identity ?? heroIdentity(seed, cls);
    const run = {
        v: SAVE_VERSION, seed: seed >>> 0, rngState: { s: hashSeed(seed, 1) },
        cls, name: id.name, epithet: id.epithet, look: id.look,
        hp: h.hp, maxHp: h.hp, gold: h.gold,
        deck: [], relics: [h.relic], elixirs: Array(ELIXIR_SLOTS).fill(null), uid: 0,
        world: 0, nodeId: null, floor: 0, path: [], phase: 'map', pending: null, picks: [], story: [],
        checkpoint: null, chronicle: [], seenEvents: [], flags: {}, nextMight: 0, purgeCost: 75,
        stats: { kills: 0, elites: 0, bosses: 0, lines: 0, crosses: 0, bestHand: null, goldEarned: 0, floors: 0, deaths: 0, hands: {}, turns: 0 },
        ending: null, started: 0,
    };
    run.deck = starterDeck(cls, uidFn(run));
    run.elixirs[0] = 'heal';
    run.story.push({ kind: 'opening' });
    enterWorld(run, 0, true);
    return run;
}

export const uidFn = (run) => () => (run.uid = (run.uid ?? 0) + 1);
export const runRng = (run) => makeStateRng(run.rngState);

export function mapOf(run) {
    if (!run._map || run._map.world !== run.world || run._map.seed !== run.seed) {
        Object.defineProperty(run, '_map', { value: { ...generateMap(run.seed, run.world), seed: run.seed }, enumerable: false, writable: true, configurable: true });
    }
    return run._map;
}

export function level(run, floor = run.floor) { return run.world * FLOORS + floor; }

function enterWorld(run, w, first = false) {
    run.world = w;
    run.nodeId = null;
    run.floor = 0;
    run.path = [];
    run.phase = 'map';
    if (!first) run.hp = run.maxHp;
    run.checkpoint = snapshot(run);
    run.story.push({ kind: 'chapter', world: w });
    chron(run, `You came to ${WORLD_DEFS[w].name}.`);
}

function snapshot(run) {
    return JSON.parse(JSON.stringify({
        deck: run.deck, relics: run.relics, gold: run.gold, maxHp: run.maxHp, elixirs: run.elixirs, uid: run.uid,
        purgeCost: run.purgeCost, flags: run.flags, stats: run.stats,
    }));
}

/** After death: restart the current world from its checkpoint. */
export function rekindle(run) {
    const c = run.checkpoint;
    const deaths = run.stats.deaths;
    Object.assign(run, JSON.parse(JSON.stringify(c)));
    run.stats.deaths = deaths;
    run.hp = run.maxHp;
    run.nodeId = null;
    run.floor = 0;
    run.path = [];
    run.phase = 'map';
    run.pending = null;
    run.picks = [];
    run.story = [{ kind: 'rekindle', world: run.world }];
    run.rngState.s = hashSeed(run.seed, run.world, deaths, 77);
    chron(run, `An ember caught. You rose again at the edge of ${WORLD_DEFS[run.world].name}.`);
}

export function chron(run, text) {
    run.chronicle.push({ w: run.world, f: run.floor, text });
    if (run.chronicle.length > 400) run.chronicle.shift();
}

// ------------------------------------------------------------------ map

export function availableNodes(run) {
    if (run.phase !== 'map') return [];
    return reachable(mapOf(run), run.nodeId);
}

export function enterNode(run, nodeId) {
    if (!availableNodes(run).includes(nodeId)) return null;
    const map = mapOf(run);
    const node = map.nodes[nodeId];
    const rng = runRng(run);
    run.cur = nodeId;
    run.phase = 'node';
    // the interlude of each world plays on arriving at floor 6
    if (node.floor === 6 && !run.flags[`interlude${run.world}`]) {
        run.flags[`interlude${run.world}`] = true;
        run.story.push({ kind: 'interlude', world: run.world });
    }
    if (node.type === 'boss') run.story.push({ kind: 'bossIntro', world: run.world });
    switch (node.type) {
        case 'battle':
        case 'elite':
        case 'boss':
            run.pending = combatPending(run, node, node.type);
            break;
        case 'event': {
            const ev = makeEvent(run.seed, run.world, node, run);
            run.seenEvents.push(ev.key);
            if (run.seenEvents.length > 12) run.seenEvents.shift();
            run.pending = { type: 'event', ev, done: false, log: [] };
            break;
        }
        case 'shop': run.pending = { type: 'shop', stock: makeShop(run, rng) }; break;
        case 'rest': run.pending = { type: 'rest', done: false }; break;
        case 'treasure': run.pending = { type: 'treasure', relic: rollRelic(rng, run.relics), gold: rng.int(25, 45) + run.world * 5, opened: false }; break;
        default: break;
    }
    return run.pending;
}

function combatPending(run, node, kind, extra = {}) {
    const seed = hashSeed(run.seed, run.world, node.floor, node.col, run.stats.deaths, kind === 'boss' ? 9 : 1);
    return { type: 'combat', kind, nodeId: node.id, floor: node.floor, species: encounterFor(run.seed, run.world, node.floor, kind, node.seed + run.stats.deaths), seed, ...extra };
}

/** Options for combat.createCombat() from the pending combat. */
export function combatOptions(run) {
    const p = run.pending;
    const o = {
        deck: run.deck, relics: run.relics, hp: run.hp, maxHp: run.maxHp, elixirs: [...run.elixirs],
        species: p.species, world: run.world, floor: p.floor, kind: p.kind, seed: p.seed, gold: run.gold, might: run.nextMight,
    };
    return o;
}

// ------------------------------------------------------------------ combat results & rewards

export function finishCombat(run, res) {
    const p = run.pending;
    run.nextMight = 0;
    run.hp = res.hp;
    run.gold = Math.max(0, run.gold + res.goldGained - res.goldLost);
    run.stats.goldEarned += res.goldGained;
    run.elixirs = res.elixirs;
    if (res.shattered.length) {
        run.deck = run.deck.filter((c) => !res.shattered.includes(c.uid));
        chron(run, `${res.shattered.length > 1 ? 'Glass cards' : 'A glass card'} shattered in your hand.`);
    }
    run.relics = run.relics.filter((r) => !res.relicsLost.includes(r));
    const s = res.stats;
    run.stats.lines += s.lines;
    run.stats.crosses += s.crosses;
    run.stats.turns += s.turns;
    for (const k in s.hands) run.stats.hands[k] = (run.stats.hands[k] ?? 0) + s.hands[k];
    if (s.bestHand && (!run.stats.bestHand || HANDS[s.bestHand].tier > HANDS[run.stats.bestHand].tier)) run.stats.bestHand = s.bestHand;
    run.stats.kills += res.killed.length;
    const node = mapOf(run).nodes[p.nodeId];
    const place = node?.name ?? 'the wilds';
    if (!res.won) {
        run.phase = 'dead';
        run.stats.deaths++;
        const foe = p.species[0]?.name ?? 'something in the dark';
        chron(run, `You fell in ${place}, to ${article(foe)}.`);
        run.pending = null;
        return;
    }
    const rng = runRng(run);
    const best = s.bestHand ? HANDS[s.bestHand].name : 'sheer stubbornness';
    const names = res.killed.map((k) => k.name);
    if (p.kind === 'boss') {
        run.stats.bosses++;
        const wd = WORLD_DEFS[run.world];
        chron(run, `In the heart of ${wd.name} you broke ${wd.warden} with ${article(best)}${run.world < 9 ? ' and took the Crown' : ''}.`);
        run.story.push({ kind: 'bossDefeat', world: run.world });
    } else if (p.kind === 'elite') {
        run.stats.elites++;
        const e = p.species[0];
        chron(run, `At ${place} you felled ${e.name} ${e.title} with ${article(best)}.`);
    } else if (rng.chance(0.55) || names.length > 1) {
        const verb = rng.pick(['broke', 'scattered', 'put down', 'outplayed', 'drove off', 'dealt with']);
        chron(run, `At ${place} you ${verb} ${listNames(names)} with ${article(best)}.`);
    }
    // rewards
    const w = run.world;
    const goldMul = (run.relics.includes('loadedDie') ? 1.15 : 1) * (run.relics.includes('crownMammon') ? 1.5 : 1);
    const baseGold = p.kind === 'boss' ? 95 : p.kind === 'elite' ? rng.int(35, 50) : rng.int(14, 24);
    const gold = Math.round((baseGold + w * 3) * goldMul);
    const nCards = run.relics.includes('clover') ? 4 : 3;
    const cards = [];
    for (let i = 0; i < nCards; i++) cards.push(rollRewardCard(rng, uidFn(run)(), w, { rare: p.kind !== 'battle', bias: HEROES[run.cls].bias }));
    const reward = { type: 'reward', gold, cards, cardTaken: false, relic: null, elixir: null, crown: null, kind: p.kind };
    if (p.kind === 'elite') reward.relic = rollRelic(rng, run.relics);
    if (p.kind === 'boss') {
        const crown = WORLD_DEFS[w].crown;
        if (crown && !run.relics.includes(crown)) reward.crown = crown;
    }
    if (rng.chance(p.kind === 'battle' ? 0.3 : 0.6)) reward.elixir = rng.pick(ELIXIR_KEYS);
    run.gold += gold;
    run.stats.goldEarned += gold;
    run.pending = reward;
}

function article(s) { return /^[AEIOU]/i.test(s) ? `an ${s}` : `a ${s}`; }
function listNames(names) {
    const uniq = {};
    for (const n of names) uniq[n] = (uniq[n] ?? 0) + 1;
    const parts = Object.entries(uniq).map(([n, k]) => (k > 1 ? `${k} ${n}s` : article(n)));
    if (parts.length <= 1) return parts[0] ?? 'the foe';
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

export function takeRewardCard(run, idx) {
    const r = run.pending;
    if (r?.type !== 'reward' || r.cardTaken || !r.cards[idx]) return false;
    run.deck.push(r.cards[idx]);
    r.cardTaken = true;
    return true;
}
export function skipRewardCard(run) { if (run.pending?.type === 'reward') run.pending.cardTaken = true; }

export function takeRewardRelic(run) {
    const r = run.pending;
    if (r?.type !== 'reward') return false;
    if (r.crown) { addRelic(run, r.crown); r.crown = null; return true; }
    if (r.relic) { addRelic(run, r.relic); r.relic = null; return true; }
    return false;
}

export function takeRewardElixir(run) {
    const r = run.pending;
    if (r?.type !== 'reward' || !r.elixir) return false;
    if (!addElixir(run, r.elixir)) return false;
    r.elixir = null;
    return true;
}

export function elixirSlots(run) { return ELIXIR_SLOTS + (run.relics.includes('satchel') ? 1 : 0); }

export function addElixir(run, id) {
    while (run.elixirs.length < elixirSlots(run)) run.elixirs.push(null);
    const i = run.elixirs.indexOf(null);
    if (i < 0) return false;
    run.elixirs[i] = id;
    return true;
}
export function discardElixir(run, slot) { if (run.elixirs[slot]) { run.elixirs[slot] = null; return true; } return false; }

export function addRelic(run, id) {
    if (!id || run.relics.includes(id)) return;
    run.relics.push(id);
    if (id === 'satchel') while (run.elixirs.length < elixirSlots(run)) run.elixirs.push(null);
    const place = mapOf(run).nodes[run.cur]?.name;
    chron(run, `You took up ${relicName(id, run.seed)}${place ? ` at ${place}` : ''}.`);
}

// ------------------------------------------------------------------ leaving nodes

/** Finish the current node and return to the map (or the next world). */
export function leaveNode(run) {
    const p = run.pending;
    if (!p || run.phase !== 'node') return false;
    if (p.type === 'reward' && p.crown) takeRewardRelic(run); // never leave a Crown behind
    const node = mapOf(run).nodes[run.cur];
    run.pending = null;
    run.picks = [];
    run.nodeId = run.cur;
    run.floor = node.floor;
    run.path.push(run.cur);
    run.stats.floors++;
    run.phase = 'map';
    if (node.type === 'boss') {
        if (run.world >= WORLDS - 1) { run.phase = 'ending'; return true; }
        run.story.push({ kind: 'epilogue', world: run.world });
        enterWorld(run, run.world + 1);
    }
    return true;
}

// ------------------------------------------------------------------ card operations

export function canUpgrade(c) {
    if (c.kind === 'arcana') return !c.up;
    if (c.kind !== 'play' || c.joker) return false;
    return c.rank < 14 || !c.ench;
}

export function upgradeCard(c) {
    if (c.kind === 'arcana') { c.up = true; return; }
    if (c.rank < 14) c.rank++;
    else if (!c.ench) c.ench = 'keen';
}

export function canEnchant(c) { return c.kind === 'play' && !c.joker && !c.ench; }

export function findCard(run, uid) { return run.deck.find((c) => c.uid === uid); }

/** Resolve the first queued pick with the chosen card uid (null = skip if allowed). */
export function resolvePick(run, uid) {
    const pk = run.picks[0];
    if (!pk) return false;
    const c = findCard(run, uid);
    if (!c) return false;
    switch (pk.kind) {
        case 'remove':
            run.deck = run.deck.filter((x) => x.uid !== uid);
            chron(run, `You let go of the ${cardName(c)}.`);
            break;
        case 'upgrade':
            if (!canUpgrade(c)) return false;
            upgradeCard(c);
            break;
        case 'enchant': {
            if (!canEnchant(c)) return false;
            c.ench = pk.ench && pk.ench !== 'random' ? pk.ench : runRng(run).pick(ENCHANT_KEYS);
            if (pk.upgradeToo && canUpgrade(c)) upgradeCard(c);
            pk.result = c.ench;
            break;
        }
        case 'duplicate': run.deck.push({ ...JSON.parse(JSON.stringify(c)), uid: uidFn(run)() }); break;
        default: break;
    }
    pk.count = (pk.count ?? 1) - 1;
    if (pk.count <= 0) run.picks.shift();
    return true;
}
export function skipPick(run) { run.picks.shift(); }

export function pickable(run, pk = run.picks[0]) {
    if (!pk) return [];
    if (pk.kind === 'upgrade') return run.deck.filter(canUpgrade);
    if (pk.kind === 'enchant') return run.deck.filter(canEnchant);
    return run.deck.slice();
}

// ------------------------------------------------------------------ effects (events, interludes)

function specCard(run, spec) {
    const uid = uidFn(run)();
    if (spec.joker) return jokerCard(uid);
    if (spec.arcana) return arcanaCard(uid, spec.arcana, !!spec.up);
    return playCard(uid, spec.rank, spec.suit, spec.ench ?? null);
}

/**
 * Apply an effect list. Card choices are queued onto run.picks; a card choice
 * from a set goes to run.pending.cardOffer; a fight turns the node into combat.
 * Returns a list of human-readable outcome lines.
 */
export function applyEffects(run, effects) {
    const rng = runRng(run);
    const log = [];
    const w = run.world;
    const bias = HEROES[run.cls].bias;
    for (const e of effects) {
        if (e.chance !== undefined) {
            const ok = rng.chance(e.chance);
            log.push(...applyEffects(run, ok ? e.then : e.else));
            continue;
        }
        if (e.gold) { run.gold = Math.max(0, run.gold + e.gold); log.push(e.gold > 0 ? `+${e.gold} gold.` : `${e.gold} gold.`); }
        if (e.goldAll) { log.push(`You paid ${run.gold} gold.`); run.gold = 0; }
        if (e.hp) {
            if (e.hp > 0) { const b = run.hp; run.hp = Math.min(run.maxHp, run.hp + e.hp); log.push(`Healed ${run.hp - b}.`); } else { run.hp = Math.max(1, run.hp + e.hp); log.push(`Lost ${-e.hp} HP.`); }
        }
        if (e.healPct) { const b = run.hp; run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * e.healPct)); log.push(`Healed ${run.hp - b}.`); }
        if (e.maxHp) { run.maxHp = Math.max(10, run.maxHp + e.maxHp); run.hp = Math.max(1, Math.min(run.maxHp, run.hp + Math.max(0, e.maxHp))); log.push(`${e.maxHp > 0 ? '+' : ''}${e.maxHp} max HP.`); }
        if (e.card) {
            let c;
            if (e.card === 'random') c = rollRewardCard(rng, uidFn(run)(), w, { bias });
            else if (e.card === 'rare') c = rollRewardCard(rng, uidFn(run)(), w, { rare: true, bias });
            else if (e.card === 'arcana') c = arcanaCard(uidFn(run)(), rng.pick(ARCANA_KEYS), rng.chance(0.3));
            else c = specCard(run, e.card);
            run.deck.push(c);
            log.push(`Gained ${cardName(c)}.`);
        }
        if (e.cardChoice) {
            const cards = [];
            for (let i = 0; i < e.cardChoice; i++) cards.push(rollRewardCard(rng, uidFn(run)(), w, { rare: !!e.rare, bias }));
            run.pending.cardOffer = cards;
        }
        if (e.relic) {
            const id = e.relic === 'random' ? rollRelic(rng, run.relics) : e.relic === 'rare' ? rollRelic(rng, run.relics, { rarity: 3 }) : typeof e.relic === 'number' ? rollRelic(rng, run.relics, { rarity: e.relic }) : e.relic;
            if (id) { addRelic(run, id); log.push(`Gained ${relicName(id, run.seed)}.`); }
        }
        if (e.elixir) { const id = rng.pick(ELIXIR_KEYS); if (addElixir(run, id)) log.push(`Gained ${ELIXIRS[id].name}.`); else log.push('Your elixir belt is full.'); }
        if (e.elixirId) { if (addElixir(run, e.elixirId)) log.push(`Gained ${ELIXIRS[e.elixirId].name}.`); }
        if (e.ash) { for (let i = 0; i < e.ash; i++) run.deck.push({ ...ashCard(uidFn(run)()), temp: false }); log.push(`${e.ash} Ash ${e.ash > 1 ? 'were' : 'was'} shuffled into your deck.`); }
        if (e.removeAsh) { const n = run.deck.filter((c) => c.kind === 'ash').length; run.deck = run.deck.filter((c) => c.kind !== 'ash'); if (n) log.push(`${n} Ash washed away.`); }
        if (e.remove) run.picks.push({ kind: 'remove', count: e.remove });
        if (e.upgrade) run.picks.push({ kind: 'upgrade', count: e.upgrade });
        if (e.duplicate) run.picks.push({ kind: 'duplicate', count: e.duplicate });
        if (e.enchant) run.picks.push({ kind: 'enchant', ench: e.enchant, upgradeToo: !!e.upgradeToo, count: 1 });
        if (e.upgradeRandom) {
            const cands = rng.shuffle(run.deck.filter(canUpgrade)).slice(0, e.upgradeRandom);
            for (const c of cands) upgradeCard(c);
            if (cands.length) log.push(`Upgraded ${cands.map(cardName).join(', ')}.`);
        }
        if (e.transmuteSuit) {
            const cands = rng.shuffle(run.deck.filter((c) => c.kind === 'play' && !c.joker && c.suit !== e.transmuteSuit)).slice(0, e.count);
            for (const c of cands) c.suit = e.transmuteSuit;
            if (cands.length) log.push(`${cands.length} cards changed suit.`);
        }
        if (e.gamble) log.push(...gamble(run, rng, e.gamble));
        if (e.flag) run.flags[e.flag] = true;
        if (e.nextMight) run.nextMight += e.nextMight;
        if (e.chron) chron(run, `You ${e.chron}.`);
        if (e.fight) {
            const node = mapOf(run).nodes[run.cur];
            run.pendingFight = e.fight;
            log.push(e.fight === 'elite' ? 'Something enormous turns towards you.' : 'Shapes move in the dark.');
            void node;
        }
    }
    return log;
}

function gamble(run, rng, bet) {
    if (run.gold < bet) return ['You cannot cover the bet.'];
    run.gold -= bet;
    const suits = ['S', 'C', 'D', 'H'];
    const deck = [];
    for (const s of suits) for (let r = 2; r <= 14; r++) deck.push({ kind: 'play', rank: r, suit: s });
    rng.shuffle(deck);
    const hand = deck.slice(0, 5);
    const k = evaluate(hand);
    const txt = hand.map((c) => rankLabel(c.rank) + { S: '♠', C: '♣', D: '♦', H: '♥' }[c.suit]).join(' ');
    const tier = HANDS[k].tier;
    let win = 0;
    if (tier >= 4 && bet >= 75) win = bet * 3;
    else if (tier >= 2) win = bet * 2;
    run.gold += win;
    return [`The hand: ${txt} — ${HANDS[k].name}.`, win ? `You win ${win} gold!` : 'The house wins.'];
}

// ------------------------------------------------------------------ events

export function chooseEvent(run, idx) {
    const p = run.pending;
    if (p?.type !== 'event' || p.done) return null;
    const ch = p.ev.choices[idx];
    if (!ch) return null;
    if (ch.cost && run.gold < ch.cost) return null;
    p.done = true;
    p.choice = idx;
    p.log = applyEffects(run, ch.effects);
    if (run.pendingFight) {
        const node = mapOf(run).nodes[run.cur];
        const kind = run.pendingFight;
        run.pendingFight = null;
        p.fight = kind;
        p.after = combatPending(run, node, kind);
    }
    return p.log;
}

/** After an event that started a fight: swap the pending node into combat. */
export function beginEventFight(run) {
    const p = run.pending;
    if (p?.type !== 'event' || !p.after) return false;
    run.pending = p.after;
    return true;
}

export function takeOfferCard(run, idx) {
    const p = run.pending;
    if (!p?.cardOffer) return false;
    if (idx !== null && p.cardOffer[idx]) run.deck.push(p.cardOffer[idx]);
    p.cardOffer = null;
    return true;
}

/** Interlude choice (story event on floor 6). */
export function chooseInterlude(run, idx) {
    const ch = CHAPTERS[run.world].interlude.choices[idx];
    if (!ch) return null;
    if (ch.cost && run.gold < ch.cost) return null;
    run.pending = run.pending ?? null;
    const holder = run.pending;
    // interludes can offer cards via cardOffer: park them on a temporary holder
    const log = applyEffects(run, ch.effects);
    chron(run, `${CHAPTERS[run.world].interlude.title}: you chose to ${ch.label.toLowerCase()}.`);
    void holder;
    return log;
}

// ------------------------------------------------------------------ shop

export function priceMul(run) { return run.relics.includes('badge') ? 0.8 : 1; }

function makeShop(run, rng) {
    const w = run.world;
    const bias = HEROES[run.cls].bias;
    const cards = [];
    for (let i = 0; i < 3; i++) cards.push(rollRewardCard(rng, uidFn(run)(), w, { arcanaChance: 0, bias, rare: i === 2 }));
    for (let i = 0; i < 2; i++) cards.push(rollRewardCard(rng, uidFn(run)(), w, { arcanaChance: 1, rare: i === 1 }));
    const pm = priceMul(run);
    const stock = {
        cards: cards.map((c) => ({ card: c, price: Math.round((cardValue(c) + rng.int(-6, 10)) * (1 + 0.04 * w) * pm), sold: false })),
        relics: [],
        elixirs: [],
        purge: Math.round(run.purgeCost * pm),
        purged: false,
    };
    const owned = [...run.relics];
    for (let i = 0; i < 3; i++) {
        const id = rollRelic(rng, owned, { rarity: i + 1 });
        if (!id) continue;
        owned.push(id);
        stock.relics.push({ id, price: Math.round((relicPrice(id) + rng.int(-10, 15)) * pm), sold: false });
    }
    for (let i = 0; i < 3; i++) stock.elixirs.push({ id: rng.pick(ELIXIR_KEYS), price: Math.round((elixirPrice() + rng.int(-5, 10)) * pm), sold: false });
    return stock;
}

export function buyCard(run, i) {
    const s = run.pending?.stock, it = s?.cards[i];
    if (!it || it.sold || run.gold < it.price) return false;
    run.gold -= it.price; it.sold = true; run.deck.push(it.card);
    return true;
}
export function buyRelic(run, i) {
    const s = run.pending?.stock, it = s?.relics[i];
    if (!it || it.sold || run.gold < it.price) return false;
    run.gold -= it.price; it.sold = true; addRelic(run, it.id);
    return true;
}
export function buyElixir(run, i) {
    const s = run.pending?.stock, it = s?.elixirs[i];
    if (!it || it.sold || run.gold < it.price) return false;
    if (!addElixir(run, it.id)) return false;
    run.gold -= it.price; it.sold = true;
    return true;
}
export function buyPurge(run) {
    const s = run.pending?.stock;
    if (!s || s.purged || run.gold < s.purge) return false;
    run.gold -= s.purge; s.purged = true; run.purgeCost += 25;
    run.picks.push({ kind: 'remove', count: 1 });
    return true;
}

// ------------------------------------------------------------------ rest & treasure

export function restHeal(run) { return Math.round(run.maxHp * (0.3 + (run.relics.includes('pillow') ? 0.15 : 0))); }

export function rest(run) {
    const p = run.pending;
    if (p?.type !== 'rest' || p.done) return false;
    run.hp = Math.min(run.maxHp, run.hp + restHeal(run));
    p.done = 'rest';
    return true;
}
export function temper(run) {
    const p = run.pending;
    if (p?.type !== 'rest' || p.done) return false;
    p.done = 'temper';
    run.picks.push({ kind: 'upgrade', count: 1 });
    return true;
}

export function openTreasure(run) {
    const p = run.pending;
    if (p?.type !== 'treasure' || p.opened) return false;
    p.opened = true;
    run.gold += p.gold;
    if (p.relic) addRelic(run, p.relic);
    return true;
}

// ------------------------------------------------------------------ endings

export function availableEndings(run) {
    return Object.entries(ENDINGS).filter(([, e]) => !e.requires || run.relics.includes(e.requires)).map(([k]) => k);
}

export function chooseEnding(run, key) {
    if (run.phase !== 'ending' || !availableEndings(run).includes(key)) return false;
    run.ending = key;
    run.phase = 'done';
    chron(run, `At the gods' table, you chose: ${ENDINGS[key].label}.`);
    return true;
}

// ------------------------------------------------------------------ misc

export function deckSummary(run) {
    const suits = { S: 0, C: 0, D: 0, H: 0 };
    let arc = 0, ash = 0, jok = 0;
    for (const c of run.deck) {
        if (c.kind === 'arcana') arc++;
        else if (c.kind === 'ash') ash++;
        else if (c.joker) jok++;
        else suits[c.suit]++;
    }
    return { suits, arcana: arc, ash, jokers: jok, total: run.deck.length };
}

export function relicInfo(run, id) {
    return { id, name: relicName(id, run.seed), text: RELICS[id]?.text ?? '', rarity: RELICS[id]?.rarity, icon: RELICS[id]?.icon ?? 'relic' };
}

export function validateRun(run) {
    return run && run.v === SAVE_VERSION && Array.isArray(run.deck) && typeof run.world === 'number';
}

export { ARCANA, makeRng };
