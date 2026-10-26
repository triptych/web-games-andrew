// Moving through the dungeon, the things you find there (chests, traps, strangers, shrines), taking
// the stairs, and what a battle's end does to the world. Pure. Dialogs live in G.dialog: the view
// shows them and sends back { t: 'dlg', id }.

import { seeded } from '../rng.js';
import { DIRS, FLOOR_CACHE, STEPS_PER_DAY } from '../config.js';
import { say, ev, clamp, avgLvl } from './core.js';
import { genFloor, getEdge, setEdge, reveal, featAt, inb, cellIdx, passable, distMap } from './dungeon.js';
import { genEncounter, genMonster, genBoss } from './monsters.js';
import { startBattle } from './battle.js';
import { calc, healMember, makeMember, CLASS_IDS, CLASSES, xpNeed, gainXp, fullHeal } from './party.js';
import { genChest, genCollectible, genGear, genPotion, genScroll, genWand, priceOf, itemLabel } from './items.js';
import { give, take } from './inv.js';
import { rec, misc, miscMax } from './journal.js';
import { questReach, questBoss, questRelic, activeRelicFor, genQuest } from './quests.js';
import { advanceDay, kitOut, churchPrice, restock } from './town.js';
import { personName, RUMORS } from './names.js';

const livingParty = (G) => G.party.filter((m) => m.hp > 0);
const bestFind = (G) => Math.max(0, ...livingParty(G).map((m) => calc(m).find));
const hasClass = (G, c) => livingParty(G).some((m) => m.cls === c);

// ------------------------------------------------------------------ dialogs
export function dlg(G, kind, title, lines, opts, extra = {}) {
    G.dialog = { kind, title, lines: Array.isArray(lines) ? lines : [lines], opts, ...extra };
    ev(G, 'dialog', { kind });
}
const OK = [{ id: 'ok', label: 'OK' }];
const closeDlg = (G) => { G.dialog = null; };

// ------------------------------------------------------------------ floors
export function enterFloor(G, depth, from = 'up') {
    let f = G.floors[depth];
    if (!f) {
        f = genFloor(G.seed, depth, activeRelicFor(G, depth));
        if (f.bossFloor) {
            const r = seeded(G.seed, depth, 5);
            f.feat[`${f.down.x},${f.down.y}`].guard = genBoss(r, depth, avgLvl(G), G.party.length);
        }
        G.floors[depth] = f;
    } else {
        const q = activeRelicFor(G, depth);
        if (q && !Object.values(f.feat).some((x) => x.type === 'relic' && x.qid === q.id)) {
            // drop the relic in a reachable, empty cell
            const dm = distMap(f, f.start.x, f.start.y);
            for (let tries = 0; tries < 200; tries++) {
                const i = G.rng.int(0, f.w * f.h - 1);
                const k = `${i % f.w},${(i / f.w) | 0}`;
                if (dm[i] > 1 && !f.feat[k]) { f.feat[k] = { type: 'relic', qid: q.id, name: q.relicName, taken: false }; break; }
            }
        }
    }
    G.floorOrder = (G.floorOrder || []).filter((d) => d !== depth);
    G.floorOrder.push(depth);
    while (G.floorOrder.length > FLOOR_CACHE) delete G.floors[G.floorOrder.shift()];
    G.floor = f;
    G.depth = depth;
    if (depth > G.maxDepth) { G.maxDepth = depth; restock(G); }
    const at = from === 'up' ? f.start : f.down;
    let d = 0;
    for (let k = 0; k < 4; k++) if (passable(getEdge(f, at.x, at.y, k))) { d = k; break; }
    G.pos = { x: at.x, y: at.y, d };
    G.arrived = true;
    G.danger = -8;
    reveal(f, at.x, at.y, d);
    miscMax(G, 'deepest', depth);
    questReach(G, depth);
    ev(G, 'floor', { depth, name: f.name, theme: f.theme });
    say(G, `${f.name}${f.bossFloor ? ' - a guardian waits below' : ''}`, 11);
}
export function returnToTown(G, why = 'return') {
    G.depth = 0; G.floor = null; G.dialog = null;
    ev(G, 'town', { why });
    say(G, why === 'wipe' ? 'You wake in town, battered.' : 'Back in town.', 11);
}
export function enterDungeon(G, depth) {
    if (!checkpoints(G).includes(depth)) return false;
    enterFloor(G, depth, 'up');
    return true;
}
export const checkpoints = (G) => {
    const out = [1];
    for (let d = 6; d - 1 <= G.cleared; d += 5) out.push(d);
    return out;
};

// ------------------------------------------------------------------ movement
export function move(G, m) {
    const f = G.floor, p = G.pos;
    if (!f) return;
    if (m === 'l' || m === 'r') {
        p.d = (p.d + (m === 'l' ? 3 : 1)) % 4;
        reveal(f, p.x, p.y, p.d);
        ev(G, 'turn', { d: p.d, dir: m });
        return;
    }
    const dir = m === 'f' ? p.d : m === 'b' ? (p.d + 2) % 4 : m === 'sl' ? (p.d + 3) % 4 : (p.d + 1) % 4;
    const t = getEdge(f, p.x, p.y, dir);
    if (t === 1 || t === 3) { ev(G, 'bump'); return; }
    if (t === 2) { setEdge(f, p.x, p.y, dir, 4); ev(G, 'door'); }
    p.x += DIRS[dir].dx; p.y += DIRS[dir].dy;
    G.arrived = false;
    G.steps++; G.stepAcc++; G.stats.steps++;
    reveal(f, p.x, p.y, p.d);
    ev(G, 'step', { x: p.x, y: p.y, d: p.d });
    if (G.steps % 6 === 0) poisonTick(G);
    if (G.stepAcc >= STEPS_PER_DAY) { G.stepAcc = 0; advanceDay(G); say(G, `A day passes. (Day ${G.day})`, 7); }
    if (onEnterCell(G)) return;
    // random encounters
    G.danger += 1;
    if (G.danger > 0 && G.rng() < 0.02 + G.danger * 0.0038) randomEncounter(G);
}
function poisonTick(G) {
    for (const m of G.party) if (m.hp > 1 && m.st.poison) {
        m.hp = Math.max(1, m.hp - Math.max(1, Math.round(calc(m).maxhp * 0.02)));
        ev(G, 'hurt');
    }
}
export function randomEncounter(G, o = {}) {
    G.danger = 0;
    const enc = genEncounter(G.rng, G.depth, avgLvl(G), G.party.length, o);
    startBattle(G, enc, { ambush: o.ambush ?? G.rng() < 0.08, ctx: o.ctx || { kind: 'random' } });
}

function onEnterCell(G) {
    const f = G.floor, p = G.pos;
    const ft = featAt(f, p.x, p.y);
    if (!ft) return false;
    if (ft.type === 'trap') {
        if (ft.sprung || ft.found) return false;
        if (G.rng() < bestFind(G) * 0.45) { ft.found = true; ft.hid = false; say(G, 'You spot a trap and step around it.', 11); rec(G, 'trap', ft.kind, 'found'); return false; }
        springTrap(G, ft);
        return true;
    }
    if (ft.type === 'down' && ft.guard) {
        startBattle(G, [{ ...ft.guard, hp: ft.guard.mhp }], { boss: true, ctx: { kind: 'boss', x: p.x, y: p.y } });
        return true;
    }
    if (G.arrived && (ft.type === 'up' || ft.type === 'down')) return false;
    return openFeature(G, ft);
}

function hurtAll(G, frac, label) {
    for (const m of livingParty(G)) {
        const d = Math.max(1, Math.round(calc(m).maxhp * frac));
        m.hp = Math.max(1, m.hp - d);
    }
    ev(G, 'hurt');
    say(G, label, 12);
}
function springTrap(G, ft) {
    ft.sprung = true; ft.hid = false;
    rec(G, 'trap', ft.kind, 'triggered');
    misc(G, 'trapsSprung');
    ev(G, 'trap', { kind: ft.kind });
    const f = G.floor;
    switch (ft.kind) {
        case 'dart': {
            const L = livingParty(G);
            const m = L[Math.floor(G.rng() * L.length)];
            if (m) { m.st.poison = true; m.hp = Math.max(1, m.hp - Math.round(calc(m).maxhp * 0.08)); }
            say(G, `A dart hits ${m?.name}! Poisoned!`, 12);
            dlg(G, 'result', 'Poison Dart', ['A hidden dart whistles out of the wall.', `${m?.name} is poisoned.`], OK);
            break;
        }
        case 'pit': hurtAll(G, 0.12, 'The floor gives way! Everyone is bruised.'); dlg(G, 'result', 'Pit Trap', 'The floor drops away. A bruising fall.', OK); break;
        case 'rune': hurtAll(G, 0.14, 'A fire rune flares!'); dlg(G, 'result', 'Fire Rune', 'A rune flares under your boots. Singed.', OK); break;
        case 'gas': {
            for (const m of livingParty(G)) if (G.rng() < 0.5) m.st.poison = true;
            hurtAll(G, 0.05, 'Gas billows out!');
            dlg(G, 'result', 'Gas Trap', 'Foul gas hisses from the walls. Some of you cough and stagger.', OK);
            break;
        }
        case 'alarm':
            say(G, 'A bell clangs! Something comes running.', 12);
            randomEncounter(G, { ambush: true, ctx: { kind: 'random' } });
            break;
        case 'tele': {
            const dm = distMap(f, f.start.x, f.start.y);
            const cands = [];
            for (let i = 0; i < dm.length; i++) if (dm[i] >= 0) cands.push(i);
            const c = cands[Math.floor(G.rng() * cands.length)];
            G.pos.x = c % f.w; G.pos.y = (c / f.w) | 0;
            reveal(f, G.pos.x, G.pos.y, G.pos.d);
            ev(G, 'teleport');
            dlg(G, 'result', 'Teleporter', 'The world lurches. You are somewhere else.', OK);
            break;
        }
        case 'spin':
            G.pos.d = Math.floor(G.rng() * 4);
            reveal(f, G.pos.x, G.pos.y, G.pos.d);
            ev(G, 'spin');
            dlg(G, 'result', 'Spinner', 'The floor spins you around. Which way were you facing?', OK);
            break;
    }
}

export function search(G) {
    const f = G.floor, p = G.pos;
    if (!f) return;
    const best = bestFind(G);
    const found = [];
    for (let d = 0; d < 4; d++) {
        if (getEdge(f, p.x, p.y, d) === 3 && G.rng() < best + 0.15) {
            setEdge(f, p.x, p.y, d, 2); found.push('a secret door'); ev(G, 'secret'); misc(G, 'secretsFound');
        }
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ft = featAt(f, p.x + dx, p.y + dy);
        if (ft && ft.type === 'trap' && !ft.found && !ft.sprung && G.rng() < best + 0.1) {
            ft.found = true; ft.hid = false; found.push('a trap'); rec(G, 'trap', ft.kind, 'found');
        }
    }
    G.danger += 0.5;
    if (found.length) { say(G, `You find ${found.join(' and ')}!`, 11); ev(G, 'found'); } else say(G, 'You search carefully, and find nothing.', 7);
    ev(G, 'search');
}

export function interact(G) {
    const f = G.floor, p = G.pos;
    if (!f) return;
    const ft = featAt(f, p.x, p.y);
    if (ft && ft.type !== 'trap' && !(ft.type === 'down' && ft.guard)) {
        const prev = G.arrived; G.arrived = false;
        if (openFeature(G, ft)) return;
        G.arrived = prev;
    }
    search(G);
}

// ------------------------------------------------------------------ features
function openFeature(G, ft) {
    const p = G.pos;
    switch (ft.type) {
        case 'chest': {
            if (ft.opened) return false;
            dlg(G, 'chest', 'A Treasure Chest', [ft.tier >= 2 ? 'An ornate chest, bound in metal.' : 'A weathered chest.', ft.trap ? 'It looks... suspicious.' : ''].filter(Boolean),
                [{ id: 'open', label: 'Open it' }, ...(ft.trap ? [{ id: 'disarm', label: 'Try to disarm' }] : []), { id: 'leave', label: 'Leave it' }], { key: `${p.x},${p.y}` });
            return true;
        }
        case 'up': {
            const town = G.depth === 1;
            dlg(G, 'stairs', town ? 'The Way Out' : 'Stairs Up', town ? 'Daylight filters down the stairs. Return to town?' : `Climb to floor ${G.depth - 1}?`, [{ id: 'go', label: town ? 'Return to town' : 'Ascend' }, { id: 'stay', label: 'Stay' }], { dir: 'up' });
            return true;
        }
        case 'down': {
            dlg(G, 'stairs', 'Stairs Down', `Descend to floor ${G.depth + 1}?`, [{ id: 'go', label: 'Descend' }, { id: 'stay', label: 'Stay' }], { dir: 'down' });
            return true;
        }
        case 'gather': {
            if (ft.left <= 0) return false;
            const nm = { herb: 'a patch of herbs', ore: 'an ore seam', bug: 'a nest of crawling things', relic: 'a mound of old things' }[ft.kind];
            dlg(G, 'gather', 'Gathering Point', `You find ${nm}. (${ft.left} left)`, [{ id: 'gather', label: 'Gather' }, { id: 'leave', label: 'Leave' }]);
            rec(G, 'gather', ft.kind, 'met');
            return true;
        }
        case 'spring': {
            if (ft.left <= 0) return false;
            dlg(G, 'spring', 'A Clear Spring', 'Cold water bubbles up from the rock, humming softly.', [{ id: 'drink', label: 'Drink' }, { id: 'leave', label: 'Leave' }]);
            return true;
        }
        case 'altar': {
            if (ft.used) return false;
            if (ft.kind === 'shrine') {
                const cost = 60 + G.depth * 40;
                dlg(G, 'altar', 'A Small Shrine', 'A stone shrine with a bowl for offerings.', [{ id: 'give', label: `Offer ${cost}g`, off: G.gold < cost }, { id: 'leave', label: 'Leave' }], { cost });
            } else dlg(G, 'altar', 'A Blood Altar', 'The stone is stained dark. It wants something of you.', [{ id: 'bleed', label: 'Offer your blood (-30% HP)' }, { id: 'leave', label: 'Leave' }]);
            return true;
        }
        case 'sign': dlg(G, 'result', 'Scratched Words', ft.text, OK); return true;
        case 'relic': {
            if (ft.taken) return false;
            ft.taken = true;
            questRelic(G, ft.qid);
            dlg(G, 'result', 'Found!', `Beneath the dust lies ${ft.name}. This is what the Guild wants.`, OK);
            ev(G, 'item');
            return true;
        }
        case 'den': {
            if (ft.done) return false;
            say(G, 'You blunder into a den!', 12);
            randomEncounter(G, { ambush: false, lvlBoost: 2, ctx: { kind: 'den', key: `${p.x},${p.y}` } });
            return true;
        }
        case 'npc': return openNpc(G, ft);
    }
    return false;
}

const RIDDLES = [
    { q: 'I have cities but no houses, forests but no trees, water but no fish. What am I?', a: ['A map', 'A dream', 'A painting'], r: 0 },
    { q: 'The more you take, the more you leave behind. What am I?', a: ['Footsteps', 'Time', 'Gold'], r: 0 },
    { q: 'What has a head and a tail but no body?', a: ['A snake', 'A coin', 'A comet'], r: 1 },
    { q: 'I speak without a mouth and hear without ears. What am I?', a: ['A ghost', 'An echo', 'A bell'], r: 1 },
    { q: 'What gets wetter the more it dries?', a: ['A sponge', 'A towel', 'A river'], r: 1 },
    { q: 'What can you break without ever touching it?', a: ['A promise', 'Glass', 'A shadow'], r: 0 },
    { q: 'Forward I am heavy. Backward I am not. What am I?', a: ['A ton', 'Lead', 'A stone'], r: 0 },
    { q: 'What has keys but opens no locks?', a: ['A piano', 'A map', 'A prison'], r: 0 },
];
const NPC_TEXT = {
    merchant: ['"Psst! Fine wares, fine prices. Well, prices."', 'A pedlar sits among sacks, unbothered by the dark.'],
    hermit: ['"Haven\'t seen the sun in years. Or has it been days?"', 'A hermit hums to himself over a dead fire.'],
    adventurer: ['"Please... I was separated from my party. I can hardly stand."', 'An adventurer slumps against the wall, bleeding.'],
    gambler: ['"Feeling lucky? Everyone down here is, right before."', 'A gambler shuffles knucklebones on a crate.'],
    riddler: ['"Answer me this, little lights..."', 'A masked figure blocks the corridor, grinning.'],
    healer: ['"Aches? Sores? Holes? I can mend most things."', 'A traveling healer tends a tiny lantern.'],
    questgiver: ['"The Guild sent me. Do you have a moment?"', 'A Guild runner in a rumpled tabard checks a ledger.'],
};
function openNpc(G, ft) {
    if (ft.done) return false;
    const r = seeded(ft.seed, 1, 2);
    rec(G, 'npc', ft.kind, ft.met ? 'talked' : 'met');
    ft.met = true;
    const lines = [r.pick(NPC_TEXT[ft.kind])];
    const key = `${G.pos.x},${G.pos.y}`;
    const base = { key, npc: ft.kind, seed: ft.seed };
    switch (ft.kind) {
        case 'merchant': {
            if (!ft.stock) {
                const rr = seeded(ft.seed, G.depth, 3), il = G.depth;
                ft.stock = [genPotion(rr, il, 'heal'), genPotion(rr, il + 6, 'heal'), genPotion(rr, il, 'mana'), genGear(rr, il + 1, { luck: 1, noCurse: true }), genGear(rr, il + 1, { noCurse: true }), genScroll(rr, il), genWand(rr, il)];
                ft.stock.forEach((it, i) => { it.sid = i + 1; it.price = Math.round(priceOf(it) * 1.3); });
            }
            dlg(G, 'merchant', 'Wandering Merchant', lines, [...ft.stock.filter((it) => !it.bought).map((it) => ({ id: 'buy' + it.sid, label: `${it.name}  ${it.price}g`, off: G.gold < it.price })), { id: 'leave', label: 'Farewell' }], base);
            break;
        }
        case 'hermit':
            dlg(G, 'npc', 'Hermit', lines, [{ id: 'guide', label: 'Ask for directions' }, { id: 'rumor', label: 'Ask for news' }, { id: 'leave', label: 'Leave' }], base);
            break;
        case 'adventurer': {
            if (!ft.adv) ft.adv = { cls: seeded(ft.seed, 4, 4).pick(CLASS_IDS), lvl: Math.max(1, Math.round(G.depth + seeded(ft.seed, 5, 5).int(-1, 2))), name: personName(seeded(ft.seed, 6, 6)) };
            const hasPot = G.inv.some((x) => x.t === 'p' && x.eff === 'heal');
            lines.push(`${ft.adv.name}, a level ${ft.adv.lvl} ${CLASSES[ft.adv.cls].name}.`);
            dlg(G, 'npc', 'Lost Adventurer', lines, [{ id: 'rescue', label: hasPot ? 'Share a healing potion' : 'Share a healing potion (none!)', off: !hasPot }, { id: 'leave', label: 'Leave them' }], base);
            break;
        }
        case 'gambler': {
            const g = G.gold;
            dlg(G, 'npc', 'Gambler', [...lines, `You have ${g}g.`], [
                { id: 'bet1', label: `Bet ${Math.max(10, Math.round(g * 0.1))}g`, off: g < 10 },
                { id: 'bet2', label: `Bet ${Math.max(25, Math.round(g * 0.3))}g`, off: g < 25 },
                { id: 'leave', label: 'Walk away' }], base);
            break;
        }
        case 'riddler': {
            const rd = RIDDLES[ft.seed % RIDDLES.length];
            dlg(G, 'npc', 'The Riddler', [...lines, rd.q], [...rd.a.map((a, i) => ({ id: 'ans' + i, label: a })), { id: 'leave', label: 'Decline' }], { ...base, rd: ft.seed % RIDDLES.length });
            break;
        }
        case 'healer': {
            const c = Math.round(churchPrice(G, 'heal') * 0.4 * G.party.length);
            dlg(G, 'npc', 'Wayside Healer', [...lines, `Full mending for ${c}g.`], [{ id: 'heal', label: `Mend the party  ${c}g`, off: G.gold < c }, { id: 'leave', label: 'Leave' }], { ...base, c });
            break;
        }
        case 'questgiver': {
            if (!ft.quest) { ft.quest = genQuest(G, seeded(ft.seed, G.depth, 8)); ft.quest.state = 'active'; ft.quest.id = 0; }
            const q = ft.quest;
            dlg(G, 'npc', 'Guild Runner', [...lines, `"${q.title}"`, q.desc, `Reward: ${q.gold}g, ${q.xp} XP.`], [{ id: 'accept', label: 'Accept', off: G.quests.active.length >= 5 }, { id: 'leave', label: 'Not now' }], base);
            break;
        }
    }
    return true;
}

export function dlgChoose(G, id) {
    const D = G.dialog;
    if (!D) return;
    const f = G.floor, p = G.pos;
    const ft = D.key ? f.feat[D.key] : featAt(f, p.x, p.y);
    if (id === 'ok' || id === 'leave' || id === 'stay') { closeDlg(G); return; }
    switch (D.kind) {
        case 'stairs':
            closeDlg(G);
            if (id !== 'go') return;
            if (D.dir === 'up') { if (G.depth === 1) returnToTown(G); else enterFloor(G, G.depth - 1, 'down'); } else enterFloor(G, G.depth + 1, 'up');
            ev(G, 'stairs');
            return;
        case 'chest': return chestChoose(G, ft, id);
        case 'gather': {
            const bonus = hasClass(G, 'ranger') || hasClass(G, 'rogue') ? 0.1 : 0;
            ft.left--;
            if (G.rng() < 0.8 + bonus) {
                const its = [genCollectible(G.rng, G.depth, ft.kind)];
                if (G.rng() < 0.3 + bonus) its.push(genCollectible(G.rng, G.depth, ft.kind));
                for (const it of its) give(G, it, 'found');
                rec(G, 'gather', ft.kind, 'gathered', its.length);
                say(G, `Gathered ${its.map(itemLabel).join(' and ')}.`, 10);
                ev(G, 'item');
            } else say(G, 'You come away empty-handed.', 7);
            if (ft.left <= 0) { delete f.feat[`${p.x},${p.y}`]; closeDlg(G); return; }
            if (G.rng() < 0.1) { closeDlg(G); say(G, 'The commotion draws attention!', 12); randomEncounter(G, { ambush: true }); return; }
            openFeature(G, ft);
            return;
        }
        case 'spring':
            ft.left--;
            for (const m of livingParty(G)) { const s = calc(m); healMember(m, Math.round(s.maxhp * 0.5), Math.round(s.maxmp * 0.5)); delete m.st.poison; }
            say(G, 'The cool water restores the party.', 10);
            ev(G, 'heal');
            closeDlg(G);
            return;
        case 'altar':
            if (id === 'give') { G.gold -= D.cost; G.stats.goldSpent += D.cost; G.bless = { left: 10 }; ft.used = true; say(G, 'A warm light settles on you. (+20% gold, 10 battles)', 10); ev(G, 'bless'); }
            if (id === 'bleed') {
                for (const m of livingParty(G)) { m.hp = Math.max(1, m.hp - Math.round(calc(m).maxhp * 0.3)); gainXp(m, Math.round(xpNeed(m.lvl) * 0.3)); }
                ft.used = true; say(G, 'The altar drinks. Power surges through you.', 13); ev(G, 'hurt');
            }
            closeDlg(G);
            return;
        case 'merchant': {
            const sid = +id.replace('buy', '');
            const it = ft.stock.find((x) => x.sid === sid);
            if (!it || G.gold < it.price) return;
            G.gold -= it.price; G.stats.goldSpent += it.price;
            const copy = JSON.parse(JSON.stringify(it)); delete copy.sid;
            give(G, copy, 'bought');
            it.bought = true;
            say(G, `Bought ${it.name}.`, 14);
            ev(G, 'buy');
            openNpc(G, ft);
            return;
        }
        case 'npc': return npcChoose(G, ft, id);
    }
    closeDlg(G);
}

function chestChoose(G, ft, id) {
    if (id === 'leave') { closeDlg(G); return; }
    const luckF = calc(G.party[0]).luk * 0.02;
    if (id === 'disarm') {
        const ok = G.rng() < clamp(bestFind(G) + 0.25, 0.2, 0.95);
        if (ok) { say(G, 'Click. The trap is disarmed.', 11); ft.trap = null; misc(G, 'disarmed'); ev(G, 'found'); chestChoose(G, ft, 'open'); return; }
        say(G, 'Your hand slips!', 12);
    }
    if (ft.trap) {
        const kind = ft.trap;
        ft.trap = null;
        ev(G, 'trap', { kind });
        misc(G, 'trapsSprung');
        if (kind === 'mimic') {
            delete G.floor.feat[`${G.pos.x},${G.pos.y}`];
            closeDlg(G);
            say(G, 'The chest has teeth!', 12);
            const mim = genMonster(G.rng, G.depth, avgLvl(G), 'mimic', { noVariant: true });
            startBattle(G, [mim], { ctx: { kind: 'mimic' } });
            return;
        }
        if (kind === 'alarm') { closeDlg(G); say(G, 'A bell clangs!', 12); randomEncounter(G, { ambush: true }); ft.pendingLoot = true; return; }
        if (kind === 'needle') { const L = livingParty(G); const m = L[Math.floor(G.rng() * L.length)]; m.st.poison = true; say(G, `A needle pricks ${m.name}! Poisoned!`, 12); }
        if (kind === 'gas') { for (const m of livingParty(G)) if (G.rng() < 0.5) m.st.poison = true; hurtAll(G, 0.04, 'Gas hisses out of the chest!'); }
        if (kind === 'blast') hurtAll(G, 0.14, 'The chest explodes!');
    }
    const loot = genChest(G.rng, G.depth, ft.tier, luckF);
    G.gold += loot.gold; G.stats.goldEarned += loot.gold;
    const lines = [`${loot.gold} gold`];
    for (const it of loot.items) { give(G, it, 'found'); lines.push(itemLabel(it)); }
    ft.opened = true;
    misc(G, 'chests');
    ev(G, 'chest');
    dlg(G, 'result', 'Treasure!', lines, OK);
}

function npcChoose(G, ft, id) {
    const p = G.pos;
    switch (ft.kind) {
        case 'hermit':
            if (id === 'guide') {
                const f = G.floor;
                f.seen[cellIdx(f, f.down.x, f.down.y)] = Math.max(1, f.seen[cellIdx(f, f.down.x, f.down.y)]);
                // reveal the shortest path as seen cells
                const dm = distMap(f, f.down.x, f.down.y);
                let x = p.x, y = p.y;
                for (let g = 0; g < 400 && !(x === f.down.x && y === f.down.y); g++) {
                    let moved = false;
                    for (let d = 0; d < 4 && !moved; d++) {
                        if (!passable(getEdge(f, x, y, d))) continue;
                        const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
                        if (inb(f, nx, ny) && dm[cellIdx(f, nx, ny)] === dm[cellIdx(f, x, y)] - 1) { x = nx; y = ny; if (!f.seen[cellIdx(f, x, y)]) f.seen[cellIdx(f, x, y)] = 1; moved = true; }
                    }
                    if (!moved) break;
                }
                ft.done = true;
                say(G, 'The hermit draws a path in the dust. You memorise it.', 11);
                dlg(G, 'result', 'Hermit', '"Down is that way. Mind the guardian, if there is one."', OK);
                return;
            }
            if (id === 'rumor') { dlg(G, 'result', 'Hermit', `"${RUMORS[G.rng.int(0, RUMORS.length - 1)]}"`, OK); return; }
            break;
        case 'adventurer':
            if (id === 'rescue') {
                const pot = G.inv.find((x) => x.t === 'p' && x.eff === 'heal');
                take(G, pot.id, 1);
                ft.done = true;
                if (G.party.length < 6) {
                    const rr = seeded(ft.seed, 9, 9);
                    const m = makeMember(rr, ft.adv.cls, ft.adv.lvl, ft.adv.name);
                    kitOut(rr, m, Math.max(1, ft.adv.lvl));
                    for (const s of Object.keys(m.eq)) m.eq[s].id = ++G.uid;
                    G.party.push(m);
                    misc(G, 'rescued');
                    say(G, `${m.name} joins the party!`, 10);
                    ev(G, 'recruit');
                    dlg(G, 'result', 'Rescued', `"You saved my life! Let me fight beside you."\n${m.name} the ${CLASSES[m.cls].name} joins the party.`, OK);
                } else {
                    const loot = genChest(G.rng, G.depth, 1, 0);
                    G.gold += loot.gold; G.stats.goldEarned += loot.gold;
                    for (const it of loot.items) give(G, it, 'found');
                    dlg(G, 'result', 'Rescued', `"Thank you! I cannot join you, but take this." (+${loot.gold}g and ${loot.items.length} items)`, OK);
                }
                return;
            }
            break;
        case 'gambler': {
            if (id === 'bet1' || id === 'bet2') {
                const bet = id === 'bet1' ? Math.max(10, Math.round(G.gold * 0.1)) : Math.max(25, Math.round(G.gold * 0.3));
                if (G.gold < bet) return;
                if (G.rng() < 0.45) { G.gold += bet; G.stats.goldEarned += bet; say(G, `You win ${bet}g!`, 14); ev(G, 'gold'); } else { G.gold -= bet; G.stats.goldSpent += bet; say(G, `You lose ${bet}g.`, 12); }
                openNpc(G, ft);
                return;
            }
            break;
        }
        case 'riddler':
            if (id.startsWith('ans')) {
                const rd = RIDDLES[ft.seed % RIDDLES.length];
                ft.done = true;
                if (+id.slice(3) === rd.r) {
                    const it = genGear(G.rng, G.depth + 2, { minRarity: 2, luck: 1 });
                    give(G, it, 'found');
                    say(G, `"Correct!" You receive ${it.name}.`, 13);
                    dlg(G, 'result', 'The Riddler', `"Correct! Clever lights."\nYou receive ${it.name}.`, OK);
                } else {
                    delete G.floor.feat[`${p.x},${p.y}`];
                    closeDlg(G);
                    say(G, '"WRONG!" The riddler lunges!', 12);
                    randomEncounter(G, { ambush: false, ctx: { kind: 'random' } });
                }
                return;
            }
            break;
        case 'healer':
            if (id === 'heal') {
                const c = G.dialog.c;
                if (G.gold < c) return;
                G.gold -= c; G.stats.goldSpent += c;
                for (const m of livingParty(G)) { const keep = m.st.curse; fullHeal(m); if (keep) m.st.curse = keep; }
                say(G, 'The party is mended.', 10);
                ev(G, 'heal');
                closeDlg(G);
                return;
            }
            break;
        case 'questgiver':
            if (id === 'accept') {
                const q = ft.quest;
                q.id = G.quests.nextId++;
                G.quests.active.push(q);
                ft.done = true;
                say(G, `Quest accepted: ${q.title}`, 11);
                closeDlg(G);
                return;
            }
            break;
    }
    closeDlg(G);
}

// ------------------------------------------------------------------ after a battle
export function endBattle(G) {
    const B = G.battle;
    if (!B || !B.over) return;
    const f = G.floor, ctx = B.ctx || {};
    G.battle = null;
    G.danger = -2;
    if (B.over === 'lose') { wipe(G); return; }
    if (B.over === 'win') {
        if (ctx.kind === 'boss' && f) {
            const dn = f.feat[`${f.down.x},${f.down.y}`];
            dn.guard = null;
            G.cleared = Math.max(G.cleared, G.depth);
            questBoss(G, G.depth);
            say(G, 'The guardian is slain. The way down is open.', 14);
            ev(G, 'bossDown');
        } else if (ctx.kind === 'den' && f) {
            const ft = f.feat[ctx.key];
            if (ft) ft.done = true;
            const loot = genChest(G.rng, G.depth, 1, 0);
            G.gold += loot.gold;
            for (const it of loot.items) give(G, it, 'found');
            say(G, `The den holds a hoard: ${loot.gold}g and ${loot.items.length} items.`, 14);
        } else if (ctx.kind === 'mimic') {
            const loot = genChest(G.rng, G.depth, 2, 0);
            G.gold += loot.gold;
            for (const it of loot.items) give(G, it, 'found');
            say(G, 'The mimic spits up its meals.', 14);
        }
    }
}
export function wipe(G) {
    G.stats.deaths++;
    misc(G, 'wipes');
    const lost = Math.floor(G.gold * 0.1);
    G.gold -= lost;
    for (const m of G.party) { const s = calc(m); m.hp = Math.max(1, Math.round(s.maxhp * 0.3)); m.mp = Math.round(s.maxmp * 0.3); delete m.st.poison; delete m.st.sleep; delete m.st.stun; delete m.cb; }
    G.dialog = null;
    returnToTown(G, 'wipe');
    say(G, `The Guild hauled you out. You lost ${lost}g.`, 12);
    ev(G, 'wipe');
}

