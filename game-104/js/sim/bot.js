// The walkthrough bot. It plays the whole story through the same act() the player uses, so the tests,
// the debug autoplay and the proof that the game can be won all exercise the real rules. It plays
// like a careful person: it hides when it hears boots, and waits out a patrol before walking into it.
// Pure, like the rest of js/sim.

import { act } from './game.js';
import { ROOMS } from './data/rooms.js';
import { parse } from './parser.js';
import { disguised } from './core.js';

/** One step is a command, ['wait*', flag] (wait until a flag is set), ['rest*', n] (rest until ember n),
 *  or ['assert', fn, message]. */
export const WALKTHROUGH = [
    // ---- the empty cottage
    'take satchel', 'take kettle', 'take lantern', 'read note', 'search floor', 'take button',
    'search hearth', 'take purse', 'cast kindle on lantern', 'take salt', 'take salt',
    'down', 'take herbal', 'read herbal', 'up', 'out',
    ['assert', (G) => G.score > 0 && G.recipes.includes('salve'), 'read the herbal'],
    // ---- the garden
    'take yarrow', 'take plantain', 'take rue', 'take rue', 'take rue', 'take rosemary',
    'study yarrow', 'smell rue', 'brew salve',
    ['assert', (G) => G.stock.salve === 1, 'brewed a salve'],
    // ---- the lane and the Whisperwood
    'n', 'w', 'take valerian', 'take valerian', 'take elderflower', 'take elderflower', 'take wormwood', 'take mugwort',
    'study valerian', 'study elderflower', 'study wormwood', 'study mugwort',
    'brew valerian and elderflower', 'brew sleeping draught', 'e', 'n',
    // ---- Foxglove Mill
    'w', 'take comfrey', 'take eyebright', 'take willow bark', 'take willow bark',
    'knock door', 'say rue for regret, rosemary for remembering', 'in', 'search sacks',
    'use salve on bryony', 'out', 'e',
    ['assert', (G) => G.party.includes('bryony') && G.spells.includes('loosen'), 'Bryony joined'],
    // ---- the Hanged Oak
    'e', 'read carvings', 'use rue on roots', 'say gammer', 'talk to gammer', 'ask gammer about sight', 'ask gammer about vervain',
    'take vervain', 'take vervain',
    ['assert', (G) => G.spells.includes('sight') && G.level === 3, 'learned Sight'],
    'w',
    // ---- Ashwick's gate
    'n', 'pour draught in flask', ['wait*', 'gate_open'],
    ['assert', (G) => G.flags.gate_open, 'Dray is asleep'],
    'n',
    // ---- the square, the inn, Pell's, the Row, the chapel
    'read board', 'e', 'listen', 'w',
    'w', 'buy tonic', 'cast sight on tonic', 'e',
    'se', 'take feverfew', 'take feverfew', 'take feverfew', 'brew feverfew and willow bark', 'brew fever tea',
    'give fever tea to tobias', 'use scullery key on scullery door', 'in', 'search crates', 'out', 'nw',
    'nw', 'give mugwort to moll', 'se',
    ['assert', (G) => G.spells.includes('veil') && G.level === 4 && G.evidence.length === 2, 'Veil, and two pieces of evidence'],
    // ---- brew everything for the vaults
    'brew eyebright and elderflower', 'brew rosemary and wormwood', 'brew tincture', 'brew tincture',
    ['assert', (G) => G.stock.eyewash && G.stock.waking_tea && G.stock.tincture === 2 && G.stock.draught === 1 && G.stock.fever_tea === 1, 'everything brewed'],
    // ---- the Infirmary
    'wear apron', 'wear cap', 'n', 'n', 'take chart', 'e', 'take ledger', 'cast loosen on office door', 'n',
    'search desk', 'take letter', 'open drawer', 'take pages', 'take iron key', 'read pages', 'cast sight on portrait', 's',
    ['assert', (G) => G.evidence.length === 5 && G.spells.includes('unbind'), 'five pieces of evidence, and Unbind'],
    'd', 'use iron key on iron door', 'e',
    // ---- the Salt Road
    'cast sight on vault door', 'use button on vault door', 'cast loosen on vault door', 'open salters door',
    ['assert', (G) => G.flags.vault_open && !G.flags.bryony_poisoned, 'vault door opened safely'],
    ['rest*', 7],
    // ---- the Brine Vaults (the clock is running)
    'e', 'take keys', 'use keys on gate', 'n',
    'give waking tea to marga', 'give eyewash to dunmore', 'give fever tea to harrow', 'use tincture on collars', 's',
    'cast veil', 'e', 'pour draught in teapot', ['wait*', 'vesper_asleep'],
    'use tincture on stone', 'cast unbind on stone',
    ['assert', (G) => G.rescued.length === 4, 'all four freed'],
    'w', 'w', 'n', 'u',
    ['assert', (G) => G.room === 'chapel' && G.party.length === 5, 'everyone reached the chapel'],
    'ring bell',
];

const immuneNow = (G, p) => G.hidden || G.veil > 0 || (p.disguise && disguised(G));

/** Run one command the way a careful player would. Returns the events it produced. */
export function play(G, cmd, log) {
    const out = [];
    const take = () => { const e = G.events.splice(0); out.push(...e); if (log) log(e); };
    // do not walk into a patrol that is already at the door
    const p = parse(cmd);
    if (p.verb === 'go') {
        const r = ROOMS[G.room];
        let ex = p.dir ? r.exits[p.dir] : null;
        if (!ex && p.a) for (const d in r.exits) if ((r.exits[d].names || []).includes(p.a)) ex = r.exits[d];
        const dest = ex && !ex.block?.(G) ? ROOMS[ex.to] : null;
        for (let n = 0; dest?.patrol && n < 3; n++) {
            const ph = (G.turn + 1) % dest.patrol.period;
            if (ph >= dest.patrol.at && ph < dest.patrol.at + (dest.patrol.len || 2) && !immuneNow(G, dest.patrol)) { act(G, 'wait'); take(); } else break;
        }
    }
    act(G, cmd);
    take();
    // boots: hide until it has gone by
    for (let n = 0; n < 2 && !G.dead && !G.ending; n++) {
        const warned = out.some((e) => e.type === 'sfx' && e.name === 'patrol');
        const pt = ROOMS[G.room].patrol;
        if (!warned || !pt || immuneNow(G, pt) || !ROOMS[G.room].hide) break;
        out.length = 0;
        act(G, 'hide'); take();
        act(G, 'wait'); take();
        break;
    }
    return out;
}

/** Play a whole script. Returns { ok, failed, step, G }. */
export function runScript(G, steps = WALKTHROUGH, log) {
    for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (G.dead) return { ok: false, step: i, why: `died: ${G.dead.title}` };
        if (G.ending) return { ok: i >= steps.length - 1, step: i, why: 'ended early' };
        if (typeof s === 'string') play(G, s, log);
        else if (s[0] === 'wait*') { for (let n = 0; n < 12 && !G.flags[s[1]] && !G.dead; n++) play(G, 'wait', log); }
        else if (s[0] === 'rest*') { for (let n = 0; n < 8 && G.ember < s[1] && !G.dead; n++) play(G, 'rest', log); }
        else if (s[0] === 'assert') { if (!s[1](G)) return { ok: false, step: i, why: `assertion failed: ${s[2]}` }; }
    }
    return { ok: !G.dead && !!G.ending, step: steps.length, why: G.dead ? `died: ${G.dead.title}` : G.ending ? 'won' : 'not finished' };
}
