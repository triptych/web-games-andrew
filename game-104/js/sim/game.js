// The simulation. Pure: no DOM, no renderer, no Math.random, no clock. A typed line goes in
// through act(G, line); what the player should read comes out as events on G.events
// ({ type: 'say', text, cls }, { type: 'room' }, { type: 'dead' }, ...). The view reads G and
// drains the events; the tests and the walkthrough bot call act() directly.

import { makeRng } from '../rng.js';
import { EMBER_BASE, LIGHT_TICKS, VEIL_TICKS, MAX_SCORE } from '../config.js';
import * as K from './core.js';
import { ROOMS } from './data/rooms.js';
import { ITEMS } from './data/items.js';
import { STOCK, RECIPES, SPELLS } from './data/lore.js';
import { NPCS } from './data/npcs.js';
import { OBJECTIVES, nextObjective } from './data/objectives.js';
import { parse, matches, exact, DIRS } from './parser.js';
import * as Story from './story.js';

const { say, has, flag, stock, addStock, spend, lit, points, addDread, kill, moveTo, ev } = K;

const DIR_NAME = { n: 'north', s: 'south', e: 'east', w: 'west', ne: 'north-east', nw: 'north-west', se: 'south-east', sw: 'south-west', u: 'up', d: 'down', in: 'in', out: 'out' };
const pick = (G, arr) => arr[Math.floor(G.rng() * arr.length)];
const txt = (v, G) => (typeof v === 'function' ? v(G) : v);

// ------------------------------------------------------------------ new game and saves
export function newGame(seed = 1) {
    const G = {
        v: 1, seed, rng: makeRng(seed),
        turn: 0, room: 'cottage', prev: null,
        flags: {}, loc: {}, stock: {}, plants: {}, npcLoc: {},
        lore: [], recipes: [], spells: ['kindle'],
        level: 1, ember: EMBER_BASE + 1, dread: 0, score: 0, pts: {}, silver: 0,
        party: [], timers: [], clock: null, veil: 0, witchlight: 0, hidden: false,
        journal: [], evidence: [], rescued: [], visited: {}, chapter: 1,
        dead: null, ending: null, events: [],
    };
    for (const id in ITEMS) G.loc[id] = ITEMS[id].at;
    for (const id in NPCS) G.npcLoc[id] = NPCS[id].at;
    for (const id in ROOMS) G.plants[id] = { ...(ROOMS[id].plants || {}) };
    G.visited.cottage = true;
    ev(G, { type: 'chapter', n: 1, title: 'The Empty Cottage', sub: 'The first night' });
    ev(G, { type: 'room', id: 'cottage' });
    say(G, 'You wake to a crash, and a cold draught, and the sound of iron-rimmed wheels going away down the lane.', 'narr');
    say(G, 'By the time you reach the door, Marga is gone.', 'narr');
    say(G, '(Type commands like LOOK, TAKE SATCHEL, GO NORTH, ASK BRYONY ABOUT MARGA. Type HELP for more, HINT if you are stuck.)', 'sys');
    describeRoom(G);
    return G;
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

// ------------------------------------------------------------------ the world around you
const dark = (G) => !!ROOMS[G.room].dark && !lit(G);

function worldEntities(G) {
    const r = ROOMS[G.room];
    const out = [];
    for (const id in ITEMS) {
        const l = G.loc[id];
        if (l === 'inv' || l === 'worn') out.push({ kind: 'item', id, names: ITEMS[id].names, def: ITEMS[id], where: l });
    }
    for (const id in G.stock) if (G.stock[id] > 0) out.push({ kind: 'stock', id, names: STOCK[id].names, def: STOCK[id] });
    for (const dir in r.exits) {
        const ex = r.exits[dir];
        out.push({ kind: 'exit', id: `exit:${dir}`, names: ex.names || [], dir, ex });
    }
    if (dark(G)) return out;
    for (const id in ITEMS) if (G.loc[id] === G.room) out.push({ kind: 'item', id, names: ITEMS[id].names, def: ITEMS[id], where: 'room' });
    for (const id in (r.things || {})) out.push({ kind: 'thing', id, names: r.things[id].names, def: r.things[id] });
    for (const h in G.plants[G.room]) if (G.plants[G.room][h] > 0) out.push({ kind: 'plant', id: h, names: STOCK[h].names, def: STOCK[h] });
    for (const id in NPCS) if (G.npcLoc[id] === G.room) out.push({ kind: 'npc', id, names: NPCS[id].names, def: NPCS[id] });
    return out;
}

const PREFER = {
    take: ['plant', 'item', 'thing', 'npc', 'stock', 'exit'],
    study: ['plant', 'stock', 'item', 'thing', 'npc', 'exit'],
    smell: ['plant', 'stock', 'item', 'thing', 'npc', 'exit'],
    taste: ['stock', 'plant', 'item', 'thing', 'npc', 'exit'],
    look: ['thing', 'npc', 'item', 'plant', 'stock', 'exit'],
    go: ['exit', 'thing', 'npc', 'item'],
    DEFAULT: ['item', 'stock', 'npc', 'thing', 'plant', 'exit'],
};

/** Find the entity a phrase names. Returns { ent } or { msg }. */
function resolve(G, phrase, verb, only) {
    const all = worldEntities(G).filter((e) => !only || only.includes(e.kind));
    const hits = all.filter((e) => matches(phrase, e.names));
    if (!hits.length) return { msg: `You don't see any "${phrase}" here.` };
    if (hits.length === 1) return { ent: hits[0] };
    const ex = hits.filter((e) => exact(phrase, e.names));
    const pool = ex.length ? ex : hits;
    const order = PREFER[verb] || PREFER.DEFAULT;
    pool.sort((p, q) => order.indexOf(p.kind) - order.indexOf(q.kind));
    // same-kind ties: ask, unless it is the same thing in two places
    const top = pool.filter((e) => e.kind === pool[0].kind);
    if (top.length > 1 && !top.every((e) => e.id === top[0].id)) {
        return { msg: `Which do you mean: ${top.slice(0, 3).map((e) => displayName(e)).join(' or ')}?` };
    }
    return { ent: pool[0] };
}

function displayName(e) {
    if (e.kind === 'npc') return e.def.name;
    if (e.kind === 'item' || e.kind === 'stock') return e.def.name;
    if (e.kind === 'exit') return `the way ${DIR_NAME[e.dir]}`;
    return e.def.names?.[0] || e.names[0] || e.id;
}

function describeRoom(G) {
    const r = ROOMS[G.room];
    say(G, r.name, 'room');
    if (dark(G)) {
        say(G, `It is pitch dark. Cold stone, dripping water, and the sense of a great deal of nothing around you. You cannot see a thing. (A light would help: CAST KINDLE with the lantern in your satchel.)`, 'narr');
    } else {
        say(G, txt(r.desc, G), 'narr');
        const items = Object.keys(ITEMS).filter((id) => G.loc[id] === G.room).map((id) => ITEMS[id].name);
        if (items.length) say(G, `You see here: ${items.join(', ')}.`, 'sys');
        const folks = Object.keys(NPCS).filter((id) => G.npcLoc[id] === G.room && !G.party.includes(id));
        if (folks.length) say(G, `Here: ${folks.map((id) => NPCS[id].name).join(', ')}.`, 'sys');
    }
    const withYou = G.party.filter((id) => G.npcLoc[id] === G.room);
    if (withYou.length) say(G, `With you: ${withYou.map((id) => NPCS[id].name).join(', ')}.`, 'sys');
    const exits = Object.entries(r.exits).filter(([, e]) => !e.solid).map(([d, e]) => `${DIR_NAME[d]} (${ROOMS[e.to].name.replace(/^The /, 'the ')})`);
    if (exits.length) say(G, `Exits: ${exits.join(', ')}.`, 'sys');
}

function describeEntity(G, e) {
    switch (e.kind) {
        case 'item': { say(G, txt(e.def.look, G), 'narr'); return; }
        case 'thing': { say(G, txt(e.def.look, G), 'narr'); return; }
        case 'npc': { say(G, txt(e.def.look, G), 'narr'); return; }
        case 'stock': case 'plant': {
            const h = STOCK[e.id];
            say(G, h.look, 'narr');
            if (G.lore.includes(e.id) && h.lore) say(G, `From the Herbal: ${h.lore}`, 'clue');
            else if (h.lore && h.kind === 'herb') say(G, '(You are not sure what it does. STUDY it with Marga\'s Herbal, or ask someone who knows.)', 'sys');
            if (e.kind === 'plant') say(G, `There ${G.plants[G.room][e.id] > 1 ? 'is more' : 'is a little'} to pick.`, 'sys');
            return;
        }
        case 'exit': say(G, `That way lies ${ROOMS[e.ex.to]?.name || 'somewhere you cannot go'}.`, 'narr'); return;
        default:
    }
}

// ------------------------------------------------------------------ time
export function tick(G, n = 1) {
    for (let i = 0; i < n; i++) {
        if (G.dead || G.ending) return;
        G.turn++;
        if (G.veil > 0) {
            G.veil--;
            if (G.veil === 0) { say(G, 'The shimmer of your veil thins, and is gone.', 'magic'); Story.veilEnded(G); }
        }
        if (G.witchlight > 0) {
            G.witchlight--;
            if (G.witchlight === 0) say(G, `Your witchlight gutters and goes out.${dark(G) ? ' The dark closes in.' : ''}`, 'magic');
        }
        const due = G.timers.filter((t) => t.at <= G.turn);
        if (due.length) {
            G.timers = G.timers.filter((t) => t.at > G.turn);
            for (const t of due) Story.timer(G, t.id);
        }
        if (G.dead || G.ending) return;
        if (G.clock != null) { G.clock--; Story.clock(G, G.clock); }
        if (G.dead || G.ending) return;
        const hit = patrol(G);
        if (!hit && G.dread > 0 && ROOMS[G.room].safe && G.turn % 2 === 0) addDread(G, -1);
        if (G.dread >= 100 && !G.dead) kill(G, 'THE CROWS HAVE YOU', 'Too many eyes, too many questions. A hand closes on your collar from behind, and another on your satchel, and a voice you do not know says, almost kindly, "Quiet now, miss." Somewhere a brass crow glints in the lantern-light. They take you out of the room, and Marga\'s apprentice is not seen again until the Hollow Moon.');
    }
}

function immune(G, p) {
    return G.hidden || G.veil > 0 || (p.disguise && K.disguised(G));
}

function patrol(G) {
    const p = ROOMS[G.room].patrol;
    if (!p) return false;
    const ph = G.turn % p.period;
    const warnAt = (p.at - 1 + p.period) % p.period;
    if (ph === warnAt) { say(G, p.warn, 'danger'); ev(G, { type: 'sfx', name: 'patrol' }); return false; }
    if (ph >= p.at && ph < p.at + (p.len || 2)) {
        if (immune(G, p)) { if (ph === p.at) say(G, p.pass, 'narr'); return false; }
        say(G, p.hit, 'danger');
        addDread(G, p.dread);
        ev(G, { type: 'sfx', name: 'hit' });
        return true;
    }
    return false;
}

// ------------------------------------------------------------------ movement
function go(G, p) {
    const r = ROOMS[G.room];
    let ex = null, dir = p.dir;
    if (dir) {
        ex = r.exits[dir];
        if (!ex && dir === 'out') {
            const only = Object.entries(r.exits);
            if (only.length === 1) { dir = only[0][0]; ex = only[0][1]; }
        }
        if (!ex && dir === 'in') {
            const cand = Object.entries(r.exits).filter(([, e]) => (e.names || []).includes('in'));
            if (cand.length) { dir = cand[0][0]; ex = cand[0][1]; }
        }
        if (!ex) { say(G, dir === 'u' || dir === 'd' ? 'There is no way up or down here.' : 'You can\'t go that way.', 'narr'); return; }
    } else if (p.a) {
        for (const d in r.exits) if (matches(p.a, r.exits[d].names || []) && !ex) { ex = r.exits[d]; dir = d; }
        if (!ex) return false;
    }
    if (ex.solid) { const b = ex.block?.(G); if (b) say(G, b, 'narr'); return; }
    const blocked = ex.block?.(G);
    if (blocked) { say(G, blocked, 'narr'); return; }
    // leaving the Vaults with captives unfreed: ask once
    if (G.room === 'vaults' && dir === 'w' && G.clock != null && G.rescued.length < 4 && !G.flags.leave_ok) {
        G.flags.leave_ok = true;
        say(G, `If you leave now, the captives you have not freed will be carried off on the wagons at midnight. (Go west again to leave anyway.)`, 'danger');
        return;
    }
    const from = G.room;
    moveTo(G, ex.to);
    describeRoom(G);
    Story.arrived(G, ex.to, from);
    ev(G, { type: 'checkpoint' });
    tick(G, 1);
    return true;
}

// ------------------------------------------------------------------ rules
function runRules(G, c) {
    for (const rule of Story.RULES) {
        if (!rule.verbs.includes(c.verb)) continue;
        if (rule.a !== undefined && rule.a !== '*') {
            if (rule.a === null ? c.a : (!c.a || ![].concat(rule.a).includes(c.a.id))) continue;
        }
        if (rule.b !== undefined && rule.b !== '*') {
            if (rule.b === null ? c.b : (!c.b || ![].concat(rule.b).includes(c.b.id))) continue;
        }
        if (rule.when && !rule.when(G, c)) continue;
        const r = rule.run(G, c);
        if (r === false) continue;
        return { t: c.t !== undefined ? c.t : (rule.t === undefined ? 1 : rule.t) };
    }
    return null;
}

// ------------------------------------------------------------------ verbs
const FAIL = {
    take: ["You can't take that.", "That isn't something you can carry off."],
    open: ["It doesn't open."],
    read: ['There is nothing to read there.'],
    use: ['You can\'t think how to use that here.'],
    give: ['They don\'t seem to want it.'],
    knock: ['Nobody answers.'],
    push: ['It doesn\'t budge.'],
    ring: ['There is nothing to ring.'],
    wear: ['You can\'t wear that.'],
    search: ['You search carefully and find nothing you didn\'t already know about.'],
    kneel: ['You kneel for a moment. Nothing in particular happens, but the ground is cold.'],
    close: ['You can\'t close that.'],
    light: ['You can\'t light that.'],
};

export function act(G, line) {
    if (G.dead || G.ending) return;
    const p = parse(line);
    if (p.empty) return;
    if (p.unknown) { say(G, pick(G, [`You don't know how to "${p.unknown}".`, `"${p.unknown}"? Elspeth has never heard of it.`, `Hm. "${p.unknown}" is not something a witch can do, at least not that way. (Type HELP.)`]), 'narr'); return; }
    const v = p.verb;
    const meta = META[v];
    if (meta) { meta(G, p); return; }
    let cost = 1;
    let did = false;

    if (v === 'go') {
        const r = go(G, p);
        if (r !== false) return;
        // "enter well" / "climb tree" etc: an object, not an exit
    }
    if (v === 'look' && !p.a) { dark(G) ? describeRoom(G) : describeRoom(G); return; }
    if (v === 'look' && /^(me|myself|self|elspeth|apprentice)$/.test(p.a)) { say(G, 'Elspeth Thorne, hedge witch\'s apprentice, with a green shawl, a pointed hat that never stays on straight, and a look of someone who has not slept and does not expect to. You look a good deal braver than you feel.', 'narr'); return; }
    if (v === 'search' && !p.a && !p.text) { const r = Story.searchRoom?.(G); if (r) { tick(G, 1); return; } }

    if (v === 'listen' && !p.a) { const r = Story.listen(G); say(G, r || 'You listen. Dripping, wind, and your own heartbeat.', 'narr'); tick(G, 1); return; }
    if (v === 'hide') return hide(G);
    if (v === 'rest') return rest(G);
    if (v === 'wait') { say(G, pick(G, ['Time passes.', 'You wait. The night goes on without you.', 'You hold still and let the minutes go by.']), 'narr'); tick(G, 1); return; }
    if (v === 'brew') return brew(G, p.text);
    if (v === 'say') return sayWords(G, p);
    if (v === 'buy') { const c = { verb: 'buy', text: p.text, a: null, b: null }; const r = runRules(G, c); if (r) { tick(G, r.t); return; } say(G, p.text ? 'Nobody here is selling that.' : 'Buy what?', 'narr'); return; }
    if (v === 'cast') return cast(G, p);
    if (v === 'kneel' || v === 'listen' && p.a) { /* falls to entity handling */ }

    // resolve nouns
    let a = null, b = null;
    if (p.a) {
        let only;
        if (v === 'talk' || v === 'ask' || v === 'give' && false) only = ['npc'];
        const r = resolve(G, p.a, v, only);
        if (r.msg) {
            if (v === 'talk' || v === 'ask') { /* maybe a topic with no npc */ if (v === 'ask') { a = null; p.b = p.b || p.a; } else { say(G, r.msg, 'narr'); return; } } else { say(G, dark(G) && !/exit/.test(r.msg) ? 'It is too dark to see.' : r.msg, 'narr'); return; }
        } else a = r.ent;
    }
    if (p.b && v !== 'ask') {
        const r = resolve(G, p.b, v);
        if (r.msg) { say(G, r.msg, 'narr'); return; }
        b = r.ent;
    }
    const c = { verb: v, a, b, text: p.b || '', raw: p.raw };
    // the topic after "ask X about Y" stays a string
    const done = runRules(G, c);
    if (done) { tick(G, done.t); return; }
    cost = defaults(G, p, c);
    if (cost > 0) tick(G, cost);
}

const META = {
    inventory: (G) => {
        const items = Object.keys(ITEMS).filter((id) => G.loc[id] === 'inv' || G.loc[id] === 'worn').map((id) => ITEMS[id].name + (G.loc[id] === 'worn' ? ' (worn)' : ''));
        say(G, items.length ? `You are carrying: ${items.join(', ')}.` : 'You are carrying nothing at all but your shawl and your worries.', 'sys');
        say(G, `Silver: ${G.silver}.`, 'sys');
        const st = Object.keys(G.stock).filter((id) => G.stock[id] > 0).map((id) => `${STOCK[id].name} ×${G.stock[id]}`);
        say(G, st.length ? `In the satchel: ${st.join(', ')}.` : 'The satchel holds no herbs or brews.', 'sys');
    },
    herbs: (G) => {
        const st = Object.keys(G.stock).filter((id) => G.stock[id] > 0);
        say(G, st.length ? `In the satchel: ${st.map((id) => `${STOCK[id].name} ×${G.stock[id]}`).join(', ')}.` : 'The satchel holds no herbs or brews.', 'sys');
        if (G.lore.length) {
            say(G, 'What you know of herbs:', 'room');
            for (const h of G.lore) say(G, `• ${STOCK[h].lore}`, 'clue');
        } else say(G, 'You have not learned anything about herbs yet. Marga\'s Herbal would be a start.', 'sys');
    },
    journal: (G) => {
        say(G, 'Your journal', 'room');
        if (!G.journal.length) say(G, 'Empty, so far.', 'sys');
        for (const j of G.journal) say(G, `• ${j.text}`, 'clue');
        say(G, `Evidence gathered: ${G.evidence.length} of 5.`, 'sys');
    },
    spells: (G) => {
        say(G, `Ember: ${G.ember} of ${K.emberMax(G)}. Craft level ${G.level}.`, 'sys');
        for (const s of G.spells) say(G, `${SPELLS[s].name} (${SPELLS[s].cost} ember): ${SPELLS[s].text}`, 'magic');
        say(G, 'CAST <spell> [on <thing>]. REST restores ember.', 'sys');
    },
    recipes: (G) => {
        if (!G.recipes.length) { say(G, 'You don\'t know any recipes yet. Marga\'s Herbal has a few.', 'sys'); return; }
        for (const id of G.recipes) { const r = RECIPES[id]; say(G, `${r.name}: ${r.needs.map((n) => STOCK[n].name).join(' + ')}.`, 'clue'); }
        say(G, 'BREW <recipe>, or BREW <herb> and <herb>, with the kettle.', 'sys');
    },
    score: (G) => say(G, `Score: ${G.score} of ${MAX_SCORE}. Evidence ${G.evidence.length} of 5. Craft level ${G.level}. Captives freed: ${G.rescued.length} of 4.`, 'sys'),
    hint: (G) => say(G, nextObjective(G).hint, 'hint'),
    help: (G) => {
        say(G, 'How to play', 'room');
        say(G, 'Type short commands: LOOK, EXAMINE DOOR, TAKE SATCHEL, GO NORTH (or N), TALK TO BRYONY, ASK MOLL ABOUT MARGA, USE SALVE ON BRYONY, GIVE MUGWORT TO MOLL, READ NOTE, KNOCK, HIDE, REST, WAIT.', 'sys');
        say(G, 'Herb-craft: SMELL or STUDY a plant, PICK it, BREW a recipe with the kettle (BREW SALVE, or BREW YARROW AND PLANTAIN). HERBS, RECIPES, SPELLS, JOURNAL, INVENTORY and SCORE show what you know. CAST <spell> [on <thing>].', 'sys');
        say(G, 'Suspense: DREAD rises when you are noticed and falls when you are somewhere safe. At 100 the Crows take you. HIDE when you hear boots. SAVE, RESTORE and RESTART work any time. HINT shows the next step.', 'sys');
    },
    save: (G) => ev(G, { type: 'meta', cmd: 'save' }),
    restore: (G) => ev(G, { type: 'meta', cmd: 'restore' }),
    restart: (G) => ev(G, { type: 'meta', cmd: 'restart' }),
    quit: (G) => ev(G, { type: 'meta', cmd: 'quit' }),
    wake: (G) => say(G, 'You are awake. More awake than you have ever been.', 'narr'),
};

function hide(G) {
    const r = ROOMS[G.room];
    if (!r.hide) { say(G, 'There is nowhere to hide here.', 'narr'); return; }
    G.hidden = true;
    say(G, r.hide, 'narr');
    tick(G, 1);
}

function rest(G) {
    const r = ROOMS[G.room];
    if (r.patrol && !G.hidden && G.veil <= 0) say(G, 'Resting where you can be seen is a poor idea, but you try.', 'narr');
    const mx = K.emberMax(G);
    if (G.ember >= mx) { say(G, 'You rest a moment, but you are not tired. Your ember is already full.', 'narr'); tick(G, 1); return; }
    say(G, 'You sit very still, breathe slowly, and let the ember in your chest bank back up.', 'narr');
    G.ember = Math.min(mx, G.ember + 2);
    tick(G, 3);
}

function sayWords(G, p) {
    if (!p.text) { say(G, 'Say what?', 'narr'); return; }
    say(G, `You say, "${p.text}".`, 'speech');
    const c = { verb: 'say', text: p.text, a: null, b: null };
    const r = runRules(G, c);
    if (r) { tick(G, r.t); return; }
    say(G, pick(G, ['Nobody answers.', 'Your voice is the only voice.', 'The silence takes it.']), 'narr');
    tick(G, 1);
}

// ---- brewing
const splitList = (s) => s.split(/\band\b|,|\bwith\b|\bplus\b|\+/).map((x) => x.trim()).filter(Boolean);
function brew(G, text) {
    if (!has(G, 'kettle')) { say(G, 'You have nothing to brew in. Marga\'s copper kettle is what you need.', 'narr'); return; }
    if (!text) {
        if (!G.recipes.length) { say(G, 'You don\'t know any recipes yet. (Try reading Marga\'s Herbal, or experimenting: BREW <herb> AND <herb>.)', 'narr'); return; }
        say(G, `You know how to brew: ${G.recipes.map((id) => RECIPES[id].name).join(', ')}. (RECIPES shows what each needs.)`, 'sys');
        return;
    }
    const norm = text.replace(/^(a|some|the)\s+/, '');
    let id = Object.keys(RECIPES).find((rid) => RECIPES[rid].names.some((n) => n === norm || n.replace(/ /g, '') === norm.replace(/ /g, '')));
    let byName = !!id;
    if (!id) {
        const parts = splitList(norm);
        const herbs = [];
        for (const part of parts) {
            const hit = Object.keys(STOCK).filter((h) => STOCK[h].kind === 'herb' && matches(part, STOCK[h].names));
            if (hit.length !== 1) { say(G, `You can't think what "${part}" is meant to be.`, 'narr'); return; }
            herbs.push(hit[0]);
        }
        id = Object.keys(RECIPES).find((rid) => RECIPES[rid].needs.length === herbs.length && RECIPES[rid].needs.every((n) => herbs.includes(n)));
        if (!id) { say(G, 'You can\'t think what those would make together, and you are not going to waste good herbs finding out.', 'narr'); return; }
    }
    const r = RECIPES[id];
    if (byName && !G.recipes.includes(id)) { say(G, `You don't know how to make ${r.name}. (You might work it out by experiment: BREW <herb> AND <herb>.)`, 'narr'); return; }
    const miss = r.needs.filter((n) => stock(G, n) < 1);
    if (miss.length) { say(G, `You would need ${r.needs.map((n) => STOCK[n].name).join(' and ')}, and you are short of ${miss.map((n) => STOCK[n].name).join(' and ')}.`, 'narr'); return; }
    for (const n of r.needs) spend(G, n, 1);
    addStock(G, r.makes, 1);
    K.learnRecipe(G, id);
    for (const n of r.needs) K.learnHerb(G, n);
    say(G, r.text, 'narr');
    say(G, `[You have made ${STOCK[r.makes].name}.]`, 'clue');
    K.sfx(G, 'brew');
    Story.brewed(G, id);
    tick(G, 2);
}

// ---- spells
function cast(G, p) {
    if (!p.a) { say(G, 'Cast what? (SPELLS shows what you know.)', 'narr'); return; }
    const id = Object.keys(SPELLS).find((s) => matches(p.a, [SPELLS[s].name, s]));
    if (!id) { say(G, `You don't know any spell called "${p.a}".`, 'narr'); return; }
    if (!G.spells.includes(id)) { say(G, `You haven't learned ${SPELLS[id].name} yet.`, 'narr'); return; }
    const S = SPELLS[id];
    if (G.ember < S.cost) { say(G, `You reach for the ember and find only ash. ${S.name} needs ${S.cost}; you have ${G.ember}. (REST to recover.)`, 'narr'); return; }
    let target = null;
    if (p.b) {
        const r = resolve(G, p.b, 'cast');
        if (r.msg) { say(G, r.msg, 'narr'); return; }
        target = r.ent;
    }
    const c = { verb: 'cast', spell: id, a: { id, kind: 'spell' }, b: target, text: '', free: false };
    let handled = runRules(G, c);
    if (!handled) handled = castDefault(G, c);
    if (!handled) { say(G, `You speak the words of ${S.name}, but the working finds nothing to hold. ${target ? '' : ''}Nothing happens.`, 'magic'); return; }
    if (!c.free) {
        G.ember -= S.cost;
        ev(G, { type: 'sfx', name: 'spell' });
        if (!ROOMS[G.room].safe && !G.hidden && id !== 'sight') addDread(G, 4);
    }
    tick(G, 1);
}

function castDefault(G, c) {
    const id = c.spell, r = ROOMS[G.room];
    if (id === 'kindle' && !c.b) {
        if (lit(G) && !(has(G, 'lantern') && !G.flags.lantern_lit)) { say(G, 'You already have light.', 'narr'); c.free = true; return true; }
        if (has(G, 'lantern')) { G.flags.lantern_lit = true; say(G, 'You hold your palm over the lantern and breathe a word into the wick. A small, steady flame blooms there, white and cool, and the dark draws back.', 'magic'); points(G, 'kindle', 2); }
        else { G.witchlight = LIGHT_TICKS; say(G, 'A pale witchlight opens in your cupped hand, a fragile little star that will not last long.', 'magic'); }
        return true;
    }
    if (id === 'sight' && !c.b) {
        const s = txt(r.sight, G);
        say(G, s ? `You let your eyes go soft and look past the surface of things. ${s}` : 'You look with your second sight, and see only the ordinary grain of the world.', 'magic');
        return true;
    }
    if (id === 'sight' && c.b) { say(G, `You look at ${displayName(c.b)} with your second sight, and see nothing out of the ordinary.`, 'magic'); return true; }
    if (id === 'veil' && !c.b) {
        G.veil = VEIL_TICKS;
        G.hidden = false;
        say(G, 'You draw the shadows round you like a cloak. The edges of you blur, and the eye slides off. You will not be seen, for a while, by anyone who is not looking very hard.', 'magic');
        K.sfx(G, 'veil');
        return true;
    }
    return false;
}

// ---- defaults for each verb when no rule has dealt with it
function defaults(G, p, c) {
    const v = c.verb, a = c.a, b = c.b;
    switch (v) {
        case 'look': {
            if (!a) return 0;
            describeEntity(G, a);
            return 0;
        }
        case 'search': {
            if (!a) { say(G, FAIL.search[0], 'narr'); return 1; }
            say(G, a.kind === 'plant' ? 'You push the leaves apart and find nothing but more leaves.' : FAIL.search[0], 'narr');
            return 1;
        }
        case 'take': {
            if (!a) { say(G, 'Take what?', 'narr'); return 0; }
            return take(G, a);
        }
        case 'drop': {
            if (!a) { say(G, 'Drop what?', 'narr'); return 0; }
            if (a.kind === 'item' && a.where !== 'room') { G.loc[a.id] = G.room; say(G, `You put down ${a.def.name}.`, 'narr'); return 1; }
            say(G, 'You can\'t drop that.', 'narr'); return 0;
        }
        case 'read': {
            if (!a) { say(G, 'Read what?', 'narr'); return 0; }
            if (a.kind === 'item' && a.def.readText) { say(G, a.def.readText, 'narr'); return 1; }
            say(G, FAIL.read[0], 'narr'); return 0;
        }
        case 'smell': {
            if (!a) { say(G, 'It smells of the night.', 'narr'); return 0; }
            if (a.kind === 'plant' || a.kind === 'stock') { say(G, STOCK[a.id].smell, 'narr'); return 0; }
            say(G, 'You sniff. Nothing remarkable.', 'narr'); return 0;
        }
        case 'taste': {
            if (!a) { say(G, 'Taste what?', 'narr'); return 0; }
            if (a.kind === 'plant' || a.kind === 'stock') {
                const h = STOCK[a.id];
                if (h.taste === null) { Story.tasteDeadly(G, a.id); return 0; }
                say(G, h.taste, 'narr'); return 1;
            }
            say(G, 'You decide against it.', 'narr'); return 0;
        }
        case 'study': {
            if (!a) { say(G, 'Study what?', 'narr'); return 0; }
            if (a.kind === 'plant' || a.kind === 'stock') {
                const h = STOCK[a.id];
                if (!h.lore) { say(G, `${h.look} There is nothing more to learn from it.`, 'narr'); return 0; }
                if (G.lore.includes(a.id)) { say(G, `From the Herbal: ${h.lore}`, 'clue'); return 0; }
                if (!has(G, 'herbal')) { say(G, 'You turn it over and sniff it, but without Marga\'s Herbal you can\'t be sure what it does.', 'narr'); return 0; }
                K.learnHerb(G, a.id);
                say(G, `You match it to a page of Marga's Herbal. ${h.lore}`, 'clue');
                K.sfx(G, 'clue');
                if (G.lore.length >= 8) points(G, 'lore8', 3);
                return 1;
            }
            describeEntity(G, a); return 0;
        }
        case 'wear': {
            if (!a) { say(G, 'Wear what?', 'narr'); return 0; }
            if (a.kind === 'item' && (a.id === 'apron' || a.id === 'cap')) {
                if (G.loc[a.id] === 'worn') { say(G, 'You are already wearing it.', 'narr'); return 0; }
                G.loc[a.id] = 'worn';
                say(G, `You put on the ${a.id === 'apron' ? 'starched apron' : 'stiff white cap'}. ${K.disguised(G) ? 'Together, they change you: you stand straighter, and your face goes blank and polite. You look exactly like someone who belongs here and is a little tired of it.' : 'Nearly there; you still need the other half of the uniform.'}`, 'narr');
                return 1;
            }
            say(G, FAIL.wear[0], 'narr'); return 0;
        }
        case 'remove': {
            if (a && a.kind === 'item' && G.loc[a.id] === 'worn') { G.loc[a.id] = 'inv'; say(G, `You take off the ${a.def.name}.`, 'narr'); return 1; }
            say(G, 'You aren\'t wearing that.', 'narr'); return 0;
        }
        case 'talk': {
            const n = a || soleNpc(G);
            if (!n || n.kind !== 'npc') { say(G, 'There is no one to talk to.', 'narr'); return 0; }
            n.def.talk(G);
            Story.talked(G, n.id);
            return 1;
        }
        case 'ask': {
            const n = a || soleNpc(G);
            if (!n || n.kind !== 'npc') { say(G, 'There is no one here to ask.', 'narr'); return 0; }
            const topic = c.text || p.b || '';
            if (!topic) { n.def.talk(G); Story.talked(G, n.id); return 1; }
            const tw = topic.split(' ');
            const t = (n.def.topics || []).find((tp) => tp.k.some((k) => tw.some((w) => w === k || (w.length >= 4 && k.startsWith(w)))));
            if (t) t.say(G); else say(G, n.def.fallback || 'They don\'t know.', 'speech');
            Story.talked(G, n.id, topic);
            return 1;
        }
        case 'give': case 'show': {
            if (!a || !b) { say(G, `${v === 'give' ? 'Give' : 'Show'} what to whom? (e.g. ${v.toUpperCase()} SALVE TO BRYONY)`, 'narr'); return 0; }
            if (b.kind !== 'npc') { say(G, 'That would be a strange thing to do.', 'narr'); return 0; }
            say(G, v === 'give' ? `${b.def.name} doesn't seem to want it.` : `${b.def.name} glances at it and shrugs.`, 'narr');
            return 0;
        }
        case 'open': {
            if (!a) { say(G, 'Open what?', 'narr'); return 0; }
            say(G, a.kind === 'exit' ? 'You can just walk that way.' : FAIL.open[0], 'narr'); return 0;
        }
        case 'close': say(G, FAIL.close[0], 'narr'); return 0;
        case 'knock': say(G, a ? 'You knock. Nobody answers.' : 'Knock on what?', 'narr'); return 1;
        case 'ring': say(G, FAIL.ring[0], 'narr'); return 0;
        case 'kneel': say(G, FAIL.kneel[0], 'narr'); return 1;
        case 'push': say(G, a ? FAIL.push[0] : 'Push what?', 'narr'); return 0;
        case 'listen': say(G, 'You listen. Nothing that matters.', 'narr'); return 1;
        case 'light': {
            if (a && a.id === 'lantern') {
                say(G, G.flags.lantern_lit ? 'The lantern is already lit.' : 'You have no flame to light it with. Elspeth\'s one reliable spell is CAST KINDLE.', 'narr'); return 0;
            }
            say(G, FAIL.light[0], 'narr'); return 0;
        }
        case 'use': {
            if (!a) { say(G, 'Use what?', 'narr'); return 0; }
            if (!b) {
                if (a.id === 'lantern') { say(G, 'The lantern needs a flame: CAST KINDLE.', 'narr'); return 0; }
                if (a.id === 'kettle') { say(G, 'BREW something in it. (RECIPES shows what you can make.)', 'narr'); return 0; }
                if (a.id === 'herbal' || a.id === 'note') { say(G, `You could READ ${a.def.name}.`, 'narr'); return 0; }
                if (a.kind === 'stock' && a.def.kind === 'potion') { say(G, `Use it on whom or what? (e.g. USE ${a.def.name.toUpperCase()} ON <someone>.)`, 'narr'); return 0; }
                if (a.kind === 'exit') { say(G, 'You can just walk that way.', 'narr'); return 0; }
                say(G, FAIL.use[0], 'narr'); return 0;
            }
            say(G, 'That doesn\'t seem to do anything.', 'narr'); return 0;
        }
        default:
            say(G, 'You can\'t do that.', 'narr'); return 0;
    }
}

function soleNpc(G) {
    const here = worldEntities(G).filter((e) => e.kind === 'npc');
    if (here.length === 1) return here[0];
    const comp = here.find((e) => G.party.includes(e.id));
    return comp || null;
}

function take(G, e) {
    switch (e.kind) {
        case 'item':
            if (e.where !== 'room') { say(G, 'You already have it.', 'narr'); return 0; }
            G.loc[e.id] = 'inv';
            say(G, e.def.takeText || `You take the ${e.def.name}.`, 'narr');
            Story.taken(G, e.id);
            return 1;
        case 'plant': {
            if (!has(G, 'satchel')) { say(G, 'You have nothing to carry it in. Marga\'s satchel is what you need.', 'narr'); return 0; }
            const h = STOCK[e.id];
            const room = ROOMS[G.room];
            G.plants[G.room][e.id]--;
            addStock(G, e.id, h.pick);
            say(G, room.plantNames?.[e.id] ? `You take some ${h.name} from ${room.plantNames[e.id]}. [${h.name} ×${stock(G, e.id)}]` : `You pick ${h.name}${h.deadly ? ', carefully, by the very tips of your fingers' : ''}. [${h.name} ×${stock(G, e.id)}]`, 'narr');
            if (!G.lore.includes(e.id) && has(G, 'herbal') && h.kind === 'herb' && !G.flags['sh_' + e.id]) { G.flags['sh_' + e.id] = true; say(G, '(STUDY it to learn what it does.)', 'sys'); }
            return 1;
        }
        case 'stock': say(G, 'You already have it in the satchel.', 'narr'); return 0;
        case 'npc': say(G, 'You can hardly pick up a person.', 'narr'); return 0;
        case 'exit': say(G, 'You can\'t take that. You can walk that way.', 'narr'); return 0;
        default: say(G, FAIL.take[0], 'narr'); return 0;
    }
}

// ------------------------------------------------------------------ for the view and the UI
export function statusOf(G) {
    return { score: G.score, ember: G.ember, emberMax: K.emberMax(G), dread: G.dread, silver: G.silver, level: G.level, turn: G.turn, room: ROOMS[G.room].name, chapter: G.chapter, clock: G.clock };
}

/** What a scene drawing needs. */
export function sceneOf(G) {
    const r = ROOMS[G.room];
    return {
        art: r.art, room: G.room,
        dark: dark(G),
        npcs: Object.keys(NPCS).filter((id) => G.npcLoc[id] === G.room && !(id === 'gammer' && G.flags.gammer_gone)).map((id) => ({ id, kind: NPCS[id].kind, x: NPCS[id].x, party: G.party.includes(id) })),
        lantern: has(G, 'lantern') && !!G.flags.lantern_lit,
        hidden: G.hidden, veil: G.veil > 0, dread: G.dread,
        gateOpen: !!G.flags.gate_open, millOpen: !!G.flags.mill_open,
    };
}

/** Clickable shortcuts for the room: what a phone player can tap instead of typing. */
export function suggestions(G) {
    const r = ROOMS[G.room];
    const ents = worldEntities(G);
    const label = (e) => (e.kind === 'npc' ? e.def.name.replace(/^(the|Sexton|Mrs\.|Mr\.|Master|Dr\.|Corporal|Matron|Mother|Granny|Widow) /, '') : (e.names[0] || e.id));
    const uniq = (arr) => [...new Map(arr.map((x) => [x.cmd, x])).values()];
    return {
        exits: Object.entries(r.exits).filter(([, e]) => !e.solid).map(([dir, e]) => ({ dir, label: DIR_NAME[dir], to: ROOMS[e.to].name })),
        npcs: uniq(ents.filter((e) => e.kind === 'npc').map((e) => ({ cmd: (e.names[0]), label: label(e) }))),
        things: uniq(ents.filter((e) => e.kind === 'thing' || (e.kind === 'item' && e.where === 'room') || e.kind === 'plant').map((e) => ({ cmd: e.names[0], label: label(e), kind: e.kind }))),
        inv: uniq(ents.filter((e) => e.kind === 'item' && e.where !== 'room' || e.kind === 'stock').map((e) => ({ cmd: e.names[0], label: label(e) }))),
        spells: G.spells.map((s) => ({ cmd: s, label: SPELLS[s].name, cost: SPELLS[s].cost })),
    };
}

export { ROOMS, ITEMS, NPCS, STOCK, RECIPES, SPELLS, OBJECTIVES };
