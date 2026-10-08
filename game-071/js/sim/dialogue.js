/**
 * dialogue.js — what people say, and what you can say back. Builds a conversation node for an
 * actor: a greeting, then options (quest topics first, then services: barter, training, rooms,
 * carriage rides, hiring followers, rumours). Options return a result the UI acts on:
 *   { reply }                 — show their answer and rebuild the menu
 *   { reply, close: true }    — answer, then end the conversation
 *   { panel: [name, ...args] } — hand over to another menu (barter, training)
 * Pure sim: no DOM.
 */
import { LOC, LOCATIONS } from './geography.js';
import { NPC } from './actors.js';
import { merchantOf, trainCost, townOf } from './crafting.js';
import { SKILLS } from './stats.js';
import { hashStr } from './rng.js';

// ------------------------------------------------------------------ greetings
const ROLE_GREET = {
    smith: ['Need something hammered? Steel takes patience.', 'Mind the sparks.', "If it's sharp, I made it. Or I can."],
    merchant: ['Take a look. Everything has a price, and most of them are fair.', 'Welcome, welcome. Coin talks, friend.', 'Buying or selling?'],
    innkeeper: ['Warm fire, cold mead. What can I get you?', 'Rooms upstairs, ten gold the night.', 'Sit, sit. Road dust comes off with ale.'],
    alchemist: ['Careful, that one bites.', 'Herbs, tinctures, remedies. Nothing that explodes. Usually.'],
    wizard: ['Mm? Yes? Be quick, I have a theorem cooling.', 'Magic is a discipline, not a party trick.'],
    warden: ['Speak your piece.', 'The town is listening. So am I.'],
    steward: ['The Warden is busy. I am also busy, but less so.', 'State your business.'],
    priest: ['The Sky-Mother keep you.', 'Be well, traveller. Do you need mending?'],
    guildmaster: ['Well, well.', "Looking for work? I don't hand it out to just anyone."],
    elder: ['The wind speaks of you.', 'Sit. Breathe. Listen.'],
    scholar: ['Fascinating times, these. Terrible, but fascinating.'],
    companion: ["Ready when you are.", 'Lead on.'],
    mercenary: ['My sword is for hire. Not cheap, but worth it.'],
    sworn: ['I go where you go, Shieldfriend.', 'Stay sharp.'],
    stablemaster: ['Horses are honest. More honest than people.'],
    driver: ['Need a ride? The cart leaves when you pay.'],
    citizen: ['Hm? Oh. Hello.', 'Fine weather. Or not. Hard to tell anymore.', 'Strange times.', "Don't mind me."],
    guard: ['Keep your nose clean.', 'Move along, citizen.', 'No trouble on my watch.', "I'm watching you."],
};
const NPC_GREET = {
    ragna: 'Halvard told me stories about couriers. None of them good.',
    hakon: "Iron's honest. People, less so.",
    orla: 'Welcome to the Sleeping Elk. Best stew this side of the river. Only stew this side of the river.',
    ivo: 'The heavens are unusually talkative lately.',
    warden_sigrun: 'Courier. Or should I say Stormsworn, now?',
    ulfar: 'The Lodge looks after its own.',
    rook: 'No lamps down here. We like it that way.',
    ostvald: 'The storm remembers its children.',
    celestine: 'The Frostspire welcomes the curious. Mostly.',
    thurnvaal: 'Little storm. Come closer; my chains do not reach so far.',
};

const RUMOURS = [
    (L) => `They say there's old treasure in ${L.name}. And older things guarding it.`,
    (L) => `A hunter came back from ${L.name} white as snow. Wouldn't say what he saw.`,
    (L) => `If you're looking for trouble, try ${L.name}. Trouble's always home there.`,
    (L) => `My cousin swears ${L.name} has a sigil stone in it. My cousin also swears at goats.`,
];

const stormsworn = (w) => !!w.flags.stormsworn;
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

/** Spending in town (carriage destinations). */
const CARRIAGE = ['brightwater', 'hrimvik', 'stonecleft', 'mirefen', 'pinebrook', 'kelvik'];

// ------------------------------------------------------------------ building a conversation
export function greeting(w, a) {
    const seed = hashStr(a.id) + Math.floor(w.time.total);
    if (a.npcId && NPC_GREET[a.npcId] && !(w.flags[`met:${a.npcId}`])) return NPC_GREET[a.npcId];
    if (a.tpl === 'thurnvaal') return NPC_GREET.thurnvaal;
    if (a.follower) return pick(['Yes?', 'What do you need?', 'Lead the way.'], seed);
    if (stormsworn(w) && (seed % 4 === 0)) return pick(["Stormsworn! I've heard the stories. Are they true?", 'They say the sky answers you. Is that so?', 'Gods. You are the one who eats dragon fire.'], seed);
    const role = a.tpl === 'guard' ? 'guard' : a.role || 'citizen';
    return pick(ROLE_GREET[role] || ROLE_GREET.citizen, seed);
}

/** Every option this actor has for you, in order. */
export function optionsFor(w, a) {
    const out = [];
    const p = w.player;
    const n = a.npcId ? NPC[a.npcId] : null;
    // quests come first
    for (const t of w.quests.topicsFor(a)) out.push({ text: t.text, cls: t.offer ? 'quest' : 'quest', disabled: t.disabled, run: () => { if (t.action) t.action(); return { reply: t.reply }; } });
    if (a.tpl === 'thurnvaal') { out.push({ text: 'Goodbye.', run: () => ({ close: true }) }); return out; }
    // services
    if (n?.merchant && n.merchant !== 'horses') out.push({ text: n.merchant === 'inn' ? 'What do you have to eat and drink?' : n.merchant === 'fence' ? "Let's see what you'll take off my hands." : 'What have you got for sale?', run: () => ({ panel: ['barter', a, merchantOf(w, a)] }) });
    if (n?.merchant === 'inn') {
        const rented = (w.flags.rented || 0) > w.time.total;
        out.push({ text: rented ? 'About my room...' : 'I need a room for the night. (10 gold)', disabled: !rented && p.gold < 10, run: () => {
            if (rented) return { reply: 'Upstairs, the one with the good blanket. It\'s yours until morning.' };
            p.gold -= 10; w.flags.rented = w.time.total + 24; w.flags.rentedAt = a.npcId;
            return { reply: "Here's the key. Sleep well." };
        } });
    }
    if (n?.trains) {
        const sk = n.trains, L = p.sheet.skills[sk];
        const cap = Math.min(90, (n.lvl || 10) * 3 + 30);
        out.push({ text: `Teach me about ${SKILLS[sk].name}. (${trainCost(L)} gold)`, disabled: L >= cap, run: () => { a.trainMax = cap; return { panel: ['train', { npc: a, skill: sk }] }; } });
    }
    if (n?.role === 'driver') {
        for (const id of CARRIAGE) {
            const L = LOC[id];
            if (!L || Math.hypot(L.x - a.pos.x, L.z - a.pos.z) < 200) continue;
            const cost = Math.round(20 + Math.hypot(L.x - a.pos.x, L.z - a.pos.z) / 30);
            out.push({ text: `Take me to ${L.name}. (${cost} gold)`, disabled: p.gold < cost, run: () => {
                p.gold -= cost; w.discovered.add(id);
                return { reply: 'Climb aboard. Mind the chickens.', close: true, fade: true, after: () => { w.flags.prologueDone = true; w.fastTravel(id); } };
            } });
        }
    }
    if (n?.merchant === 'healer') out.push({ text: 'Can you heal me?', run: () => { p.hp = p.hpMax; p.effects = p.effects.filter((e) => !['poison', 'burning', 'slow', 'disease'].includes(e.id)); p.dirty = true; return { reply: 'There. The Sky-Mother mends what she can.' }; } });
    // followers
    if (a.follower && a.npcId) {
        out.push({ text: 'Let me see what you are carrying.', run: () => ({ panel: ['trade', a] }) });
        out.push({ text: a.ai.waiting ? 'Follow me.' : 'Wait here.', run: () => { a.ai.waiting = !a.ai.waiting; return { reply: a.ai.waiting ? "I'll be here." : 'Right behind you.' }; } });
        out.push({ text: 'I need to go on alone.', run: () => { dismiss(w, a); return { reply: "As you wish. You know where to find me.", close: true }; } });
    } else if (n?.followable && !a.follower && (n.role !== 'sworn' || w.flags[`hire:${a.npcId}`])) {
        const cost = n.hire || 0;
        const already = w.actors.some((o) => o.follower && o.npcId && !o.dead);
        out.push({ text: cost && !w.flags[`hired:${a.npcId}`] ? `Come with me. (${cost} gold)` : 'Come with me.', disabled: already || p.gold < (w.flags[`hired:${a.npcId}`] ? 0 : cost), run: () => {
            if (cost && !w.flags[`hired:${a.npcId}`]) { p.gold -= cost; w.flags[`hired:${a.npcId}`] = true; }
            recruit(w, a);
            return { reply: 'Lead the way.', close: true };
        } });
    }
    // rumours
    if (a.rig === 'humanoid' && a.npcId && (n?.role === 'innkeeper' || n?.role === 'citizen' || n?.role === 'merchant')) {
        out.push({ text: 'Heard any rumours?', run: () => {
            const unk = LOCATIONS.filter((L) => L.dungeon && !w.discovered.has(L.id) && !w.flags[`told:${L.id}`] && L.id !== 'undercroft');
            if (!unk.length) return { reply: "Nothing you haven't heard already." };
            const L = unk.reduce((b, c) => (Math.hypot(c.x - a.pos.x, c.z - a.pos.z) < Math.hypot(b.x - a.pos.x, b.z - a.pos.z) ? c : b));
            w.flags[`told:${L.id}`] = true;
            w.emit('mapMarked', { loc: L.id });
            return { reply: pick(RUMOURS, hashStr(L.id))(L) + ' (Added to your map.)' };
        } });
    }
    out.push({ text: 'Goodbye.', run: () => ({ close: true }) });
    if (a.npcId) w.flags[`met:${a.npcId}`] = true;
    return out;
}

export function recruit(w, a) {
    a.follower = true;
    a.ai.kind = 'follower'; a.ai.leader = w.player.id; a.ai.waiting = false; a.ai.dest = null;
    a.faction = 'friend';
    if (a.npcId) w.pop.state[a.npcId] = { ...(w.pop.state[a.npcId] || {}), following: true };
    w.emit('recruit', { actor: a });
}
export function dismiss(w, a) {
    a.follower = false;
    const n = NPC[a.npcId];
    a.ai.kind = n?.ai === 'follower' ? 'civilian' : (n?.ai || 'civilian');
    a.ai.leader = null; a.ai.waiting = false;
    if (a.npcId) w.pop.state[a.npcId] = { ...(w.pop.state[a.npcId] || {}), following: false };
    w.emit('dismiss', { actor: a });
}

/** A guard stops you: pay, go quietly, or fight. */
export function arrestNode(w, guard, town) {
    const p = w.player, b = p.bounty[town] || 0;
    const name = LOC[town]?.name || town;
    return {
        who: guard.name,
        line: `Stop right there, criminal! You have committed crimes against ${name}. Your bounty is ${b} gold. Pay your fine or serve your time.`,
        options: [
            { text: `Pay the fine. (${b} gold)`, disabled: p.gold < b, run: () => { w.payFine(town); return { reply: 'Good. Now keep your hands where I can see them.', close: true }; } },
            { text: 'I will go quietly. (Serve your sentence)', run: () => ({ reply: 'Smart choice. Come along.', close: true, after: () => w.serveTime(town), fade: true }) },
            { text: 'Never! (Resist arrest)', run: () => { w.resistArrest(town); return { reply: 'Then pay with your blood!', close: true }; } },
        ],
    };
}

export { townOf };
