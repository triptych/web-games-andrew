// The story: every puzzle, scene and consequence, as rules over the engine's verbs. A rule is
// rule(verbs, a, b, run, { t }): when the player's verb matches, and the first and second noun
// are those ids (an array means any of them, '*' anything, null "no noun"), run(G, c) acts. It may
// return false to pass. `t` is how many moves it costs (default 1). Pure: reads and writes G only.

import { VAULT_CLOCK } from '../config.js';
import * as K from './core.js';
import { ROOMS } from './data/rooms.js';
import { NPCS } from './data/npcs.js';
import { STOCK, RECIPES, SPELLS } from './data/lore.js';

const { say, has, stock, addStock, spend, points, clue, evidence, kill, after, levelUp, learnSpell, addDread, sfx, ev } = K;

export const RULES = [];
const rule = (verbs, a, b, run, opts = {}) => RULES.push({ verbs: [].concat(verbs), a, b, run, ...opts });
const N = 'narr', M = 'magic', SP = 'speech';

const WITCHES = ['marga', 'dunmore', 'harrow', 'twins'];
const WITCH_NAME = { marga: 'Marga', dunmore: 'Granny Dunmore', harrow: 'Widow Harrow', twins: 'The Pennywhistle sisters' };

// ------------------------------------------------------------------ hooks the engine calls
const CHAPTERS = {
    lane: [2, 'The Road to Foxglove', 'Before dawn'],
    gate: [3, 'The Town of Ashwick', 'The second night'],
    infirmary: [4, 'The Cray Infirmary', 'The eve of the Hollow Moon'],
    tunnel: [5, 'The Salt Road', 'The Hollow Moon'],
    vaults: [6, 'Under Gallows Hill', 'Eleven bells'],
};

K.hooks.enter = (G, id) => {
    for (const n of G.party) G.npcLoc[n] = id;
    const first = !G.visited[id];
    G.visited[id] = true;
    const ch = CHAPTERS[id];
    if (first && ch && ch[0] > G.chapter) {
        G.chapter = ch[0];
        ev(G, { type: 'chapter', n: ch[0], title: ch[1], sub: ch[2] });
    }
    if (id === 'vaults' && G.clock === null && !G.flags.wagons) {
        G.clock = VAULT_CLOCK;
        say(G, 'Far above you, through two hundred feet of rock, a bell begins to toll: eleven. The wagons come at midnight.', 'danger');
        sfx(G, 'bell');
    }
};

/** After the room has been described: scenes that play on arrival. */
export function arrived(G, id) {
    const first = G.visited[id] && !G.flags['seen_' + id];
    G.flags['seen_' + id] = true;
    if (!first) return;
    switch (id) {
        case 'lane':
            say(G, 'Corvin the crow lifts off the gatepost as you pass, circles once, and settles on a fence further up the lane. He is, you realise, leading the way.', N);
            break;
        case 'mill':
            say(G, 'The door scrapes shut behind you. A girl\'s voice says, very quietly, from the dark: "Stay where you are." Something small and metallic clicks. You raise your hands, slowly, and the moon through the slit shows you a crossbow, a green cloak, and a face as white and as fierce as a candle flame.', N);
            break;
        case 'oak':
            say(G, 'The wind drops as you reach the foot of the oak. Every hair on your arms stands up. Somewhere in the tree, a rope creaks.', N);
            break;
        case 'gate':
            say(G, 'The lights of Ashwick are very bright after the dark road, and not at all welcoming.', N);
            break;
        case 'infirmary':
            say(G, 'The doors close behind you with a hiss, like the lid of a jar.' + (G.party.includes('bryony') ? ' Bryony keeps to your shadow, a step behind, never quite in the lamplight, and says nothing at all, which is not like her.' : ''), N);
            break;
        case 'works':
            overhear(G);
            break;
        case 'tunnel':
            say(G, 'The dark has a taste: salt and iron, and something older, like the inside of a bell.', N);
            break;
        default:
    }
}

function overhear(G) {
    say(G, 'You slip in under the veil, between the furnaces, and no one turns. You can hear the table clearly. Dr. Vesper is dictating to a bailiff with a clipboard, in a voice as even as a ruled line.', N);
    say(G, '"The Governor arrives at midnight to see the wagons loaded. Eleven in all. Mistress Thistle still refuses the Wintergreen Rite; she may refuse until the Hollow Moon, and after that it will not matter. The ward-stone will take what she will not give. Once the Edict is posted, every farmer in the county will pay the Infirmary for every cough, and the Infirmary will pay the Governor. My mistress taught me that a cure is a gift. I find a gift is only a debt that has not been named."', SP);
    say(G, 'She lifts her cup, sips, and sets it down exactly level. You notice the white teapot at her elbow, and that nobody is watching it.', N);
    clue(G, 'vesper', 'In the Works, Dr. Cordelia Vesper calls Marga "my mistress." The Governor rides out to the Vaults at midnight; once the Edict is posted, the farmers must pay for every cure. Vesper must not see you: Veil, and something in her tea.');
}

export function veilEnded(G) {
    if (G.room === 'works' && !G.flags.vesper_asleep) {
        kill(G, 'THE CURE IS WORSE THAN THE DISEASE', 'Your veil thins just as Dr. Vesper reaches for the teapot. She looks up, directly at you, and her expression does not change at all. "Elspeth Thorne," she says, almost gently. "Marga\'s little sparrow. I wondered when you would come." She does not raise her voice. She does not need to. Three bailiffs materialise from the furnace-smoke, and Marga\'s apprentice joins her mistress in the cells, which is, in a way, what she came for.');
    }
}

export function taken(G, id) {
    switch (id) {
        case 'purse': G.silver += 8; G.loc.purse = 'gone'; say(G, '[You now have 8 silver.]', 'clue'); break;
        case 'chart':
            evidence(G, 'chart', 'Mr. Alder\'s chart: a healthy man kept sick, in Vesper\'s own hand.');
            points(G, 'ev_chart', 3);
            clue(G, 'chart', 'Mr. Alder, a farmer, has been kept "ill" for six weeks, drugged on the grey syrup and charted "fit for discharge" every day.');
            break;
        case 'letter':
            evidence(G, 'letter', 'the Governor\'s own letter to Vesper.');
            points(G, 'ev_letter', 3);
            clue(G, 'letter', 'Governor Cray\'s letter to Vesper: the Edict, the kitchen witches, and a midnight ride to the Vaults.');
            break;
        case 'iron_key': points(G, 'ironkey', 1); break;
        default:
    }
}

export function talked(G, id, topic) {
    if (id === 'gammer' && G.flags.gammer_sight && !G.spells.includes('sight')) {
        learnSpell(G, 'sight');
        levelUp(G, 'You have the Sight now, and your ember is stronger for it: a good deal stronger, and a little colder. (Craft level 3. Try CAST SIGHT, or CAST SIGHT ON <something>.)');
        points(G, 'sight', 5);
        clue(G, 'sight', 'Mother Gammer gave you the Sight. Look at suspicious things with it: CAST SIGHT ON <thing>.');
    }
    if (id === 'gammer' && /salt|road|tunnel|vault|hill/.test(topic || '')) clue(G, 'saltroad', 'Under Gallows Hill the old salt mines hold a cathedral of salt. The Salt Road once ran to it from Ashwick. Cold iron, white salt, and a hum that dulls a witch.');
    if (id === 'moll' && /salt|road|tunnel|crypt|door|iron/.test(topic || '')) clue(G, 'saltroad2', 'Moll: the Salt Road runs from the Infirmary cellar to the Vaults; a branch opens at the salters\' door in the chapel crypt. The key is at the Infirmary. Bar it on the inside, and the tunnel side opens.');
    if (id === 'hob' && /bailiff|brask|crow/.test(topic || '')) clue(G, 'hob', 'Hob says two of Brask\'s bailiffs drink at the Rat and talk. (LISTEN there.)');
    if (id === 'tanner') clue(G, 'tanner', 'Mrs. Tanner scrubs Pell\'s scullery by night. She has a key to the back door.');
    if (id === 'bryony' && G.flags.bryony_healed) points(G, 'bry_talk', 0);
    if (id === 'marga' && G.flags.ready_marga) clue(G, 'marga', 'Marga: Cordelia Vesper was her first apprentice. The ward-stone in the Works holds all the witches\' power in iron. Break it with vervain, salt and rue upon its foot, and the Unbind, spoken by someone who loves the bound.');
}

export function brewed(G, id) {
    const table = { salve: 2, draught: 2 };
    if (table[id]) points(G, 'brew_' + id, table[id]);
}

export function tasteDeadly(G, id) {
    const text = {
        nightshade: 'You nip a single glossy berry between your teeth. It is sweet. The sweetness goes on for a very long time. The moon swells and swells above the trees, and then there is only the moon. Elspeth, you were told.',
        hemlock: 'You touch a leaf to the tip of your tongue. It tastes of nothing much: parsley, a little mouse. A pleasant coldness begins in your feet and climbs, very politely, all the way up. Marga always said hemlock was the best-mannered poison.',
        poison: 'You raise the vial and drink. You have, as you realise with great clarity, never been so stupid. The black dew is quite tasteless. The last thing you taste is the floor.',
    };
    kill(G, 'A POOR CHOICE OF SUPPER', text[id] || 'You should not have eaten that.');
}

export function listen(G) {
    switch (G.room) {
        case 'inn':
            if (!G.flags.heard_inn) {
                G.flags.heard_inn = true;
                points(G, 'listen', 1);
                clue(G, 'inn', 'Two bailiffs at the Rat: "Eleven in the wagon, and the old one still won\'t sing." "Midnight on the Hollow Moon. The Governor himself is coming up to see them loaded." "Under Gallows Hill, where the Salt Road ends."');
                return 'You turn your good ear to the corner. The bailiffs have been drinking steadily since sundown. "Eleven in the wagon, and the old one still won\'t sing," says one. "Midnight on the Hollow Moon," says the other, thickly. "The Governor himself is coming up to see them loaded. Under Gallows Hill. The Vaults." "Salt Road ends there, don\'t it?" "Don\'t you tell nobody." A pause, a hiccup. "Who\'d I tell?"';
            }
            return 'The bailiffs have drunk themselves into snoring. You hear nothing new.';
        case 'chapel': return 'The chapel is utterly quiet, except for a faint sound from far below the crypt: a regular, slow, iron clank, like a very distant forge.';
        case 'infirmary': return 'Under the hush you can feel it more than hear it: a low grey hum, rising through the floor, like a hive under the foundations.';
        case 'ward': return 'The sleepers breathe in unison. Under the breathing, so low you could be imagining it, there is a humming.';
        case 'tunnel': return 'From beyond the vault door comes a steady clank of iron, and a hiss of steam, and, very faintly, women\'s voices.';
        case 'store': return 'Upstairs, a floorboard creaks. Pell is awake.';
        default: return null;
    }
}

// ------------------------------------------------------------------ timers and the clock
export function timer(G, id) {
    if (id === 'dray_sleeps') {
        G.flags.gate_open = true;
        points(G, 'gate', 4);
        if (G.room === 'gate') say(G, 'Dray takes a long pull from the flask, grimaces, takes another, and sets it down. "Funny taste," he says. Then his eyelids begin to droop. He sags against the brazier, and slides slowly sideways onto the barrel. In a moment he is snoring, a long loose rumble like a cart on a bridge. Bryony looks at you and raises both eyebrows. The way is clear.', N);
        else say(G, 'Somewhere behind you, at the gate, a large man begins to snore.', N);
        sfx(G, 'clue');
    } else if (id === 'bryony_dies') {
        kill(G, 'THE STING OF THE MONKSHOOD', 'Bryony\'s breathing slows, and slows, and stops. Her hand is very cold in yours. The vault door is still open, and the dark behind it is still full of the sound of the forge, but there is no sound at all in the little pocket of the tunnel where you kneel. You did not have what you needed, or not in time. Marga would have known the cure: rue, comfrey, salt. You will remember it for the rest of your life, however long that is.');
    } else if (id === 'vesper_sleeps') {
        G.flags.vesper_asleep = true;
        points(G, 'vesper', 4);
        say(G, 'Dr. Vesper lifts her cup, frowns very slightly at the taste, and finishes it anyway, since she is a woman who finishes things. A moment later her eyelids droop. Her head tilts. She sets the cup down, exactly level, and then she is asleep with her cheek on the ledger and her mask slipping up her forehead, and the whole Works goes on roaring around her as if nothing had happened.', N);
        sfx(G, 'clue');
        say(G, 'The stokers are still bent to their pans. The bailiff on the pillar has dozed off. The ward-stone stands in front of you, humming.', N);
    }
}

export function clock(G, left) {
    if (left === 60) say(G, 'Somewhere above, deep in the rock, the great bell tolls the quarter. You have an hour, at the outside.', 'danger');
    else if (left === 30) say(G, 'A distant rumble, felt in your feet: a heavy cart on a hard road, coming nearer.', 'danger');
    else if (left === 14) say(G, 'You hear horses. The wagons are at the head of the Salt Road. You haven\'t long.', 'danger');
    else if (left === 6) say(G, 'Voices in the tunnel: men, laughing, lantern-light. They are almost here.', 'danger');
    else if (left === 0) {
        G.flags.wagons = true;
        G.clock = null;
        for (const w of WITCHES) if (!G.rescued.includes(w)) { G.flags['lost_' + w] = true; G.npcLoc[w] = 'gone'; }
        if (['vaults', 'cells', 'works'].includes(G.room)) {
            kill(G, 'THE WAGONS ARE HERE', 'The great vault door crashes open and the Vaults fill with lanterns and boots and brass. There is no way out. They take you with the rest, to the Infirmary, and the Edict is posted in the morning. They say it was a very quiet Hollow Moon.');
        } else {
            say(G, 'Behind you, deep in the rock, the wagons arrive with a roar of boots and iron. Anyone you have not freed will ride on them tonight. The Vaults are crawling with bailiffs now.', 'danger');
        }
    }
}

// ------------------------------------------------------------------ rules: the cottage and the garden
rule('read', 'note', undefined, (G) => {
    say(G, '"Elsie: if you are reading this, I did not come back in time, and I am sorry for it. Take my satchel. Take the kettle: a witch without a kettle is only a woman with opinions. Go to Bryony at Foxglove Mill, west of the crossroads. The mill answers to a password: say, rue for regret, rosemary for remembering. Trust no coat with a brass crow. The hearth keeps what the house forgets. — M."', N);
    if (!G.flags.read_note) {
        G.flags.read_note = true;
        points(G, 'note', 2);
        clue(G, 'note', 'Marga\'s note: take her satchel and kettle; go to Bryony at Foxglove Mill (password: "rue for regret, rosemary for remembering"); trust no coat with a brass crow; the hearth keeps what the house forgot.');
    }
});
rule('look', 'note', undefined, (G) => { say(G, 'A sheet of coarse paper, folded once, in Marga\'s looping hand. (READ it.)', N); });

rule(['search', 'look'], 'floor', undefined, (G, c) => {
    if (c.verb === 'look' && !G.flags.found_button) { say(G, 'Heavy, iron-shod bootprints cross the dust, heading for the door. Something small and bright is caught in a crack between two floorboards. (SEARCH the floor.)', N); return true; }
    if (c.verb === 'look') return false;
    if (G.flags.found_button) { say(G, 'You find nothing more but dust and bootprints.', N); return true; }
    G.flags.found_button = true;
    G.loc.button = 'cottage';
    points(G, 'button', 2);
    say(G, 'You kneel and run a finger along the crack. Something catches: a heavy brass button, stamped with a crow in flight, torn from a coat with a scrap of black thread still in its eye. A bailiff\'s button. They were here.', N);
    clue(G, 'button', 'A brass crow button from the cottage floor: the badge of the Governor\'s bailiffs. They took Marga.');
    sfx(G, 'clue');
});

rule(['search', 'push', 'open', 'take', 'use'], 'hearth', undefined, (G, c) => {
    if (c.verb === 'use' || c.verb === 'take') { if (!(c.b === null || c.b === undefined)) return false; }
    if (G.flags.found_purse) { say(G, 'The hearthstone sits back in its place. There is nothing more under it.', N); return true; }
    G.flags.found_purse = true;
    G.loc.purse = 'cottage';
    points(G, 'purse', 1);
    say(G, 'You kneel at the hearth and press the proud stone. It rocks, lifts, and under it, in a little hollow lined with a bit of waxed cloth, lies a small cloth purse that clinks. Marga\'s savings: the money she hid from the Governor\'s tax-man. You can take it.', N);
    sfx(G, 'clue');
});

rule('cast', 'kindle', 'lantern', (G, c) => {
    if (!has(G, 'lantern')) { say(G, 'You will have to be holding the lantern.', N); c.free = true; return true; }
    if (G.flags.lantern_lit) { say(G, 'The lantern is already lit.', N); c.free = true; return true; }
    G.flags.lantern_lit = true;
    points(G, 'kindle', 1);
    say(G, 'You hold your palm over the lantern and breathe a word into the wick. A small, steady flame blooms there, white and cool, and the dark draws back.', M);
});

// the stillroom
rule(['read', 'look', 'study'], 'herbal', undefined, (G, c) => {
    if (c.verb === 'look') return false;
    const first = !G.flags.read_herbal;
    for (const h of ['yarrow', 'plantain', 'rue', 'sage', 'rosemary']) K.learnHerb(G, h);
    K.learnRecipe(G, 'salve'); K.learnRecipe(G, 'antidote');
    if (first) {
        G.flags.read_herbal = true;
        points(G, 'herbal', 3);
        say(G, 'You open Marga\'s Herbal on the lectern. Her looping hand runs down every page, in three colours of ink, around pressed leaves gone brown as tea. You find the first friends of any hedge witch:', N);
        say(G, `• ${STOCK.yarrow.lore}`, 'clue'); say(G, `• ${STOCK.plantain.lore}`, 'clue'); say(G, `• ${STOCK.rue.lore}`, 'clue');
        say(G, `• ${STOCK.sage.lore}`, 'clue'); say(G, `• ${STOCK.rosemary.lore}`, 'clue');
        say(G, 'Two recipes are marked in the margin: "SALVE: yarrow and plantain, pounded to a paste." And in a darker ink: "For the sting of monkshood: rue to slow the blood, comfrey to bind it, salt to wake the heart. Be quick. Be quicker."', 'clue');
        say(G, 'Near the back, a stub of torn paper shows where three pages have been ripped out, neatly, by someone who knew which ones. (You can STUDY any plant you find, with the Herbal in your satchel. BREW and RECIPES show what you can make.)', N);
        clue(G, 'herbal', 'Marga\'s Herbal: salve is yarrow + plantain. Monkshood\'s antidote is rue + comfrey + salt, and must be quick. Three pages have been torn from the back.');
        sfx(G, 'clue');
    } else say(G, 'You leaf through the Herbal. You know the yarrow, plantain, rue, sage and rosemary, and you can STUDY any new plant for more. RECIPES shows what you can brew.', N);
});

// the garden: a very deep well
rule(['go', 'taste', 'push', 'use'], 'well', undefined, (G) => {
    kill(G, 'WELL, THAT WAS DEEP', 'You lean over the curb to look at the moon in the water, and then to drink, and then to see better, and the curb is wet, and Elspeth Thorne learns the oldest lesson of the countryside: that wells are bottomless exactly when you need to climb out of them.');
});

// the lane
rule('search', 'hedges', undefined, (G) => {
    say(G, 'You work along the hedge at shoulder height and find a thorn with a scrap of black wool caught on it, and in the wool, a thread of brass wire: a bailiff\'s coat. Two of them. One tall, one with a limp: the stride is uneven.', N);
    clue(G, 'cloth', 'A scrap of black wool with brass thread on the hedge: a bailiff\'s coat. They took a cart north.');
});

// ------------------------------------------------------------------ rules: the wood, the crossroads
rule(['go', 'push', 'use', 'take'], 'bog', undefined, (G) => {
    kill(G, 'THE BOG HAS YOU', 'You step onto the green moss. It is not ground. It is very nearly water, and very nearly mud, and almost entirely hunger. You go in to the knee, then the waist; the heron, a long way out, watches with a sort of professional interest. By the time you think to say a spell, you have no breath to say it with.');
});
rule(['taste'], 'mushrooms', undefined, (G) => {
    kill(G, 'A POOR CHOICE OF SUPPER', 'You pick the pale cap, sniff it (almonds), and, because it is a very long night and you are very hungry, eat it. It is the last mushroom you ever eat. Marga used to call them destroying angels. They are exactly as kind as that sounds.');
});

rule('read', ['signpost', 'notice', 'statue', 'tallies', 'bar', 'banners', 'carvings', 'portrait', 'chart'], undefined, (G, c) => {
    const t = c.a.def.look;
    say(G, typeof t === 'function' ? t(G) : t, N);
});

// ------------------------------------------------------------------ rules: Foxglove Mill
rule('knock', 'mill_door', undefined, (G) => {
    if (G.flags.mill_open) { say(G, 'The door is open.', N); return true; }
    G.flags.knocked = true;
    say(G, 'You knock three times, softly. Behind the door something shifts, and a girl\'s voice, hard and young and very tired, says through the slit: "Not a word of Ashwick, not one step closer. Who sent you? Say the words, or I\'ll put a bolt through the door and your hat."', SP);
    clue(G, 'knock', 'Someone inside Foxglove Mill demands the words. (Marga\'s note has the password; SAY it.)');
});
rule('say', undefined, undefined, (G, c) => {
    if (G.room === 'millyard' && !G.flags.mill_open) {
        const t = c.text;
        if (/\brue\b/.test(t) && /\brosemary\b/.test(t)) {
            G.flags.mill_open = true;
            points(G, 'mill', 3);
            say(G, 'A long pause. Then the bar scrapes, the bolts draw, and the door opens a hand\'s breadth on a dark and flour-smelling gloom. A single eye regards you. "Rue for regret, rosemary for remembering. Well. Get in, then, before the whole parish sees."', SP);
            sfx(G, 'clue');
            return true;
        }
        say(G, 'There is a long, scornful snort from behind the door. "Wrong. Try again, and make it count." (Marga\'s note has the words.)', SP);
        return true;
    }
    if (G.room === 'oak' && /gammer/.test(c.text)) {
        if (G.npcLoc.gammer === 'oak') { say(G, 'Mother Gammer inclines her head, politely.', N); return true; }
        if (!G.flags.offered_rue) {
            say(G, 'Your voice goes out across the bare hill and is swallowed by the oak. Nothing answers. The dead, Marga always says, expect manners. Perhaps an offering first.', N);
            return true;
        }
        G.npcLoc.gammer = 'oak';
        points(G, 'summon', 1);
        say(G, 'The word hangs in the air. The ropes on the lowest boughs stop swaying. The cold drops, all at once, as if a door had been opened onto winter, and a pale figure steps out of the trunk of the oak as easily as stepping out of a doorway: a gaunt old woman in a grey shawl, a noose loose about her neck, looking at you with her head on one side.', M);
        sfx(G, 'spell');
        return true;
    }
    return false;
});
rule('search', 'sacks', undefined, (G) => {
    if (G.loc.manifest === 'limbo') {
        G.loc.manifest = 'inv';
        say(G, 'You sift the white drifts and your fingers close on a stiff, torn corner of paper: a cart manifest. [You take the torn manifest.]', N);
        clue(G, 'manifest', 'A torn manifest from the mill: "Salt Wagon No. 7 ... to the Brine Vaults, Gallows Hill, by the Salt Road..."');
    } else say(G, 'Only flour.', N);
});

rule(['use', 'give'], 'salve', 'bryony', (G) => {
    if (G.flags.bryony_healed) { say(G, 'Her side is already dressed.', N); return true; }
    spend(G, 'salve', 1);
    G.flags.bryony_healed = true;
    G.party.push('bryony');
    points(G, 'bryony', 5);
    say(G, 'You kneel, peel back the stiff rag, and press the cool green paste into the long cut along her ribs. Bryony hisses between her teeth, then goes quiet, and her shoulders drop an inch. After a minute she lets out a long breath. "That doesn\'t hurt," she says, in a faintly outraged voice. She lowers the crossbow.', N);
    say(G, '"Marga\'s girl, then. Fine. I\'m Bryony Wick. Granny Dunmore was my mistress: the bailiffs took her two nights ago, and they\'ll have taken yours tonight, and I\'ve been sitting in a mill with a crossbow ever since like a fool. You can\'t do it alone, and I can\'t do it alone. Shall we be two fools?" She holds out a hand. "I\'ll teach you Loosen. It\'s the one thing I can do that you can\'t."', SP);
    learnSpell(G, 'loosen');
    levelUp(G, 'Bryony takes your palm and presses a thumb into it, and you feel the little hot knot of the Loosen spell unfold there like a seed in water. Your ember burns brighter. (Craft level 2. CAST LOOSEN ON a lock, a latch or a knot. It will not touch cold iron.)');
    clue(G, 'bryony', 'Bryony Wick has joined you. Her mistress, Granny Dunmore, was taken two nights ago. Bryony taught you Loosen.');
    sfx(G, 'level');
});

// ------------------------------------------------------------------ rules: the Hanged Oak
rule(['use', 'give', 'kneel'], 'rue', ['roots', 'oak_tree', 'ropes'], (G) => {
    if (G.flags.offered_rue) { say(G, 'There is already rue on the roots.', N); return true; }
    spend(G, 'rue', 1);
    G.flags.offered_rue = true;
    points(G, 'offer', 2);
    say(G, 'You kneel among the great knuckled roots and lay a sprig of rue in the hollow, beside the withered offerings. The wind, which had stopped, begins again, very softly, as if something somewhere were drawing breath to speak.', N);
});

// ------------------------------------------------------------------ rules: Ashwick gate
rule(['use', 'give'], ['draught', 'salve', 'fever_tea', 'eyewash', 'waking_tea', 'tincture', 'antidote', 'poison', 'hemlock', 'nightshade', 'valerian', 'elderflower'], ['dray_flask', 'dray'], (G, c) => {
    if (G.flags.gate_open) { say(G, 'Dray is snoring. There is no need.', N); return true; }
    const id = c.a.id;
    if (id === 'poison' || id === 'hemlock' || id === 'nightshade') {
        kill(G, 'A CORVINE VERDICT', 'You tip the black dew into the flask. Dray drinks it a minute later. He is dead before he has finished falling, and the second sentry, who was in the gatehouse, finishes the thought for you. The brass crows are on you before you have stopped shaking. They hang murderers in Ashwick; the Governor has made a point of it.');
        return true;
    }
    if (id !== 'draught') { say(G, 'Dray would notice. He is a drinker: he knows what his flask should taste of.', N); return true; }
    if (!G.party.includes('bryony')) { say(G, 'Dray watches that flask the way a hawk watches a mouse. You would need something to draw his eyes away.', N); return true; }
    if (G.flags.dray_dosed) { say(G, 'It is done. Wait.', N); return true; }
    spend(G, 'draught', 1);
    G.flags.dray_dosed = true;
    points(G, 'dose', 2);
    after(G, 'dray_sleeps', 3);
    say(G, 'Bryony catches your eye, nods, and marches up to Dray in a perfect imitation of a lost and weeping kitchen-maid. "Oh, sir, oh, sir, my cat, my poor cat, she\'s run under the wall, will you help me look?" Dray has opened his mouth to say no. In the same moment you slip the stopper from his flask and tip the draught in, quick as a thief. Bryony wails; he gives her a clap on the shoulder and a gruff "Now, now"; the stopper is back; you are three steps away, whistling. Dray, rattled, takes a long pull on the flask to steady his nerves.', N);
});
rule('give', 'purse', 'dray', (G) => {
    say(G, 'Dray looks at the purse as though it were something stuck to his boot. "Offering a bailiff a bribe. That\'s a flogging, that is." He does not take it. He does write something in his book, slowly.', SP);
    addDread(G, 20);
});

// ------------------------------------------------------------------ rules: the square, the inn, the shop
rule('read', 'board', undefined, (G) => {
    say(G, 'The newest sheet, in thick black type: "HEALING EDICT. By order of Governor A. Cray. FROM THE HOLLOW MOON, no cure may be sold, given or administered in this county save by a licensed practitioner of the Cray Infirmary or its appointed apothecary, Master Pell. UNLICENSED HEALERS (so-called \"hedge\" practitioners) are to be placed in the Governor\'s custody for their own protection. Information leading to the discovery of any such person will be rewarded: ten silver. Licence, two silver. Assessment, six."', N);
    say(G, 'Below it, in a child\'s hand, someone has pinned a scrap: "Who will heal my mother when the witches are gone?"', N);
    clue(G, 'edict', 'The Healing Edict: from the Hollow Moon no cure may be given save through the Infirmary or Pell. Unlicensed healers are to be taken into "custody."');
});

rule('buy', undefined, undefined, (G, c) => {
    const t = c.text;
    if (G.room === 'inn' && /room|bed|rest|sleep|night/.test(t)) {
        if (G.silver < 2) { say(G, 'Hob holds out a hand and looks at your empty palm, and says nothing at all, which is eloquent.', N); return true; }
        G.silver -= 2;
        G.ember = K.emberMax(G);
        G.dread = 0;
        say(G, 'Hob takes two silver and a long look at your shawl, and gives you a key without a word. The room is small, warm and dry, with a bolt on the inside. You lie down in your boots. You dream of Marga\'s kettle, singing, and wake with the ember in your chest banked up and your nerves unstrung, which is the nearest thing to a miracle the Drowned Rat has ever sold.', N);
        ev(G, { type: 'sfx', name: 'rest' });
        c.t = 8;
        return true;
    }
    if (G.room === 'apothecary' && /tonic|bottle|cure/.test(t)) {
        if (has(G, 'tonic')) { say(G, 'Pell raises an eyebrow. "One per customer, I think. We wouldn\'t want you to be too well."', SP); return true; }
        if (G.silver < 3) { say(G, 'Pell\'s smile does not waver by a hair. "Three silver, my dear. No credit. No cures on account."', SP); return true; }
        G.silver -= 3;
        G.loc.tonic = 'inv';
        say(G, 'Pell takes your three silver, with a little flourish, and wraps a squat brown bottle in tissue paper as if it were the Holy Grail. "Take one teaspoon at bedtime," he says warmly. "It makes the whole world feel a good deal better." [You buy a bottle of Tonic No. 9.]', SP);
        return true;
    }
    if (G.room === 'inn') { say(G, 'Hob shakes his head. "I\'d not eat that stew. Room\'s two silver, if you want it."', SP); return true; }
    return false;
}, { t: 1 });

rule('cast', 'sight', ['tonic', 'shelves'], (G, c) => {
    if (c.b.id === 'shelves') { say(G, 'You look at the bottles with your second sight: every one of them hums with the same low grey note. Buy one, and you can look at it properly.', M); return true; }
    say(G, 'You hold the little brown bottle up and look at it with your second sight. For a moment it is only a bottle. Then the grey note rises, and you see it: a bound hum wound through the liquid like a hair through a pearl, a knot a hedge witch ties when she is forced to brew against her will. You know that twist. You have seen Marga tie it, in thread, a hundred times. Whoever brewed this was made to.', M);
    evidence(G, 'tonic', 'Tonic No. 9 is brewed by bound hedge witches.');
    points(G, 'ev_tonic', 3);
    clue(G, 'tonic', 'Seen with Sight, Tonic No. 9 carries the bound knot of a hedge witch forced to brew: the tonic is made by the Governor\'s captives.');
});
rule('taste', 'tonic', undefined, (G) => {
    say(G, 'You put a single drop on your tongue. Sweet, then flat, then very cold, then faintly numb. For a moment the corners of the room go soft and everything feels reasonably all right. You spit.', N);
});
rule('take', 'shelves', undefined, (G) => {
    say(G, 'Pell clears his throat, delicately. "Three silver, my dear. BUY TONIC."', SP);
});

// ------------------------------------------------------------------ rules: Tanner's Row
rule(['use', 'give'], 'fever_tea', ['tobias', 'tanner'], (G) => {
    if (G.flags.tobias_healed) { say(G, 'The boy is sleeping peacefully. He doesn\'t need any more.', N); return true; }
    spend(G, 'fever_tea', 1);
    G.flags.tobias_healed = true;
    points(G, 'tobias', 5);
    say(G, 'You lift the child\'s head and trickle the bitter tea between his lips, a spoon at a time, as Marga taught you. Mrs. Tanner holds her breath. Half an hour goes by, and the flush ebbs from his cheeks like a tide, and then he opens his eyes, quite clear, and asks if there is any bread.', N);
    say(G, 'Mrs. Tanner weeps, once, hard, and then wipes her face on her apron and becomes a practical woman again. "Take them," she says, pressing a bundle into your hands. "My sister\'s old nurse\'s apron and cap from the Infirmary: she left them with me. And Pell\'s scullery key; I\'ll say I lost it. I\'ve seen what comes off those wagons at night, miss. Whatever you\'re doing, God speed you. Mind yourself in that place."', SP);
    G.loc.apron = 'inv'; G.loc.cap = 'inv'; G.loc.scullery_key = 'inv';
    say(G, '[You receive a nurse\'s apron, a nurse\'s cap and a scullery key.]', 'clue');
    clue(G, 'tobias', 'Healed Tobias with fever tea. Mrs. Tanner gave you a nurse\'s apron and cap (WEAR them) and the key to Pell\'s scullery.');
    sfx(G, 'level');
});

rule(['use'], 'scullery_key', 'scullery_door', (G) => {
    if (G.flags.scullery_open) { say(G, 'The door is already unlocked.', N); return true; }
    G.flags.scullery_open = true;
    say(G, 'The key turns with a well-oiled click. The green door swings inward on a dark, brine-smelling room.', N);
});
rule('cast', 'loosen', 'scullery_door', (G) => {
    if (G.flags.scullery_open) { say(G, 'It is already unlocked.', M); return true; }
    G.flags.scullery_open = true;
    say(G, 'The lock sighs, and gives. The green door swings inward.', M);
});
rule('open', 'scullery_door', undefined, (G) => {
    if (G.flags.scullery_open) { say(G, 'The door stands ajar already. You can go in.', N); return true; }
    say(G, 'Locked. Mrs. Tanner has the key; or you could talk it round with a spell.', N);
});

rule('search', 'crates', undefined, (G) => {
    if (G.room !== 'store') return false;
    if (G.evidence.includes('slip')) { say(G, 'Nothing else. Upstairs, the floorboard creaks again.', N); return true; }
    G.loc.slip = 'inv';
    say(G, 'You work the loose lid up a finger-width with a hairpin, and there, wedged under it, a crumpled paper: a delivery docket. [You take the delivery slip.] Upstairs, a floorboard creaks, and falls silent.', N);
    evidence(G, 'slip', 'a delivery docket from the Infirmary to Pell: base tonic, and "eleven persons, quiet."');
    points(G, 'ev_slip', 3);
    clue(G, 'slip', 'A docket in Pell\'s storeroom: base tonic from the Brine Works, Gallows Hill; and "Hollow Moon cargo, eleven persons, quiet," on Salt Wagon No. 7.');
});

// ------------------------------------------------------------------ rules: the chapel
rule('give', ['mugwort'], 'moll', (G) => {
    if (G.flags.veil_learned) { say(G, '"Keep it, child. I\'ve got my knees back."', SP); return true; }
    spend(G, 'mugwort', 1);
    G.flags.veil_learned = true;
    say(G, 'Moll takes the sprig, rolls it between her broad palms, and touches it to the altar candle. A thread of sweet, dreamy smoke rises. She breathes it in, shuts her eyes, and when she opens them, they are twenty years younger. "Ah. That\'s it. That\'s the one." She leans close. "The Veil. You gather the shadows round you like a shawl, so, and the eye slides off. You will not be seen, for a dozen heartbeats, by anyone not looking very hard. Do it in a hurry, and for love, and you\'ll find it holds longer than it should."', SP);
    learnSpell(G, 'veil');
    levelUp(G, 'You hold the smoke in your lungs, and the Veil unfolds in you like a cloak shaken out. (Craft level 4. CAST VEIL: 2 ember, a dozen moves, and no one will see you.)');
    points(G, 'veil', 5);
    clue(G, 'veil', 'Moll taught you Veil: 2 ember, hides you for twelve moves.');
});

rule('use', 'iron_key', 'crypt_door', (G) => {
    if (G.flags.crypt_open) { say(G, 'It is already unbarred.', N); return true; }
    G.flags.crypt_open = true;
    points(G, 'crypt', 1);
    say(G, 'The great iron key goes into the lock with a sound like a coffin lid. You turn it, with both hands, and the bolts draw back one after another, and the salters\' door swings in on a black, brine-smelling cold.', N);
});
rule('cast', 'loosen', ['crypt_door', 'iron_door'], (G, c) => {
    say(G, 'The spell slides off the door like water off a stone. Cold iron: it will not listen to anybody.', M);
    c.free = true;
});
rule('use', 'iron_key', 'iron_door', (G) => {
    if (G.flags.iron_door_open) { say(G, 'It is already open.', N); return true; }
    G.flags.iron_door_open = true;
    points(G, 'irondoor', 1);
    say(G, 'The big key turns with a clank that echoes down the cellar. The iron door swings inward on a long black tunnel, and a wind comes out of it: cold, salt and old.', N);
});
rule('use', 'iron_key', 'vault_door', (G) => { say(G, 'The key is far too big: it belongs to a different door entirely.', N); });

// ------------------------------------------------------------------ rules: the Infirmary
rule(['take', 'search', 'open'], 'drawer', undefined, (G) => {
    if (G.flags.drawer_open) { say(G, 'The drawer is empty now.', N); return true; }
    G.flags.drawer_open = true;
    G.loc.pages = G.room;
    G.loc.iron_key = G.room;
    say(G, 'The drawer slides out without a sound. In it lie a heavy black iron key with a luggage tag in a doctor\'s hand, SALTERS\' DOOR, and, folded small and held with a bit of green cord, three pages torn from a book. You know that cord. You know that book.', N);
    sfx(G, 'clue');
});
rule('search', 'desk', undefined, (G) => {
    if (G.room !== 'office') return false;
    if (G.flags.found_letter) { say(G, 'Nothing else but blotting paper.', N); return true; }
    G.flags.found_letter = true;
    G.loc.letter = 'office';
    say(G, 'Under a squared sheaf of blotting paper, you find an envelope, slit open, with a broken seal of black wax: a crow in flight. A letter, in a large, florid hand. Take it.', N);
});
rule(['search', 'take', 'read'], 'ledger', undefined, (G, c) => {
    if (G.room !== 'dispensary') return false;
    if (G.evidence.includes('ledger')) { say(G, 'You have the page already. There\'s a ragged gap where it was.', N); return true; }
    if (c.verb === 'read') {
        say(G, 'The page lists names, villages and notes in a doctor\'s hand: "M. Thistle, Hollow Lane. REFUSES." "A. Dunmore, Foxglove Mill, blinded in transport." Page after page of them. Take it: it is proof.', N);
        return true;
    }
    G.loc.ledger_page = 'inv';
    say(G, 'You slide a thumbnail under the stitching and tear out the page with a long, slow rip. It sounds like a scream in the silence. [You take the ledger page.]', N);
    evidence(G, 'ledger', 'the Infirmary\'s Acquisitions Ledger: a list of captured healers, with a quota.');
    points(G, 'ev_ledger', 3);
    clue(G, 'ledger', 'The Acquisitions Ledger lists captured healers, including "M. Thistle, Hollow Lane: REFUSES." Quota to the Governor by the Hollow Moon: eleven.');
});
rule('cast', 'loosen', 'office_door', (G) => {
    if (G.flags.office_open) { say(G, 'It is already open.', M); return true; }
    G.flags.office_open = true;
    points(G, 'office', 1);
    say(G, 'You lay your palm on the lock and whisper a word. The tumblers turn one by one, with the slowness of a sleeper rolling over, and the door clicks open an inch.', M);
});
rule('open', 'office_door', undefined, (G) => {
    if (G.flags.office_open) { say(G, 'It is open.', N); return true; }
    say(G, 'Locked. It is only an ordinary lock, and a spell can talk to an ordinary lock.', N);
}, { t: 0 });
rule('take', 'monkshood', undefined, (G) => {
    say(G, 'You reach for it, and stop. The touch of the hood alone can numb a finger for an hour. You leave it where it is.', N);
}, { t: 0 });
rule('read', 'pages', undefined, (G) => {
    if (G.spells.includes('unbind')) { say(G, 'You know the Wintergreen Rite now: vervain, salt and rue upon the stone, and the Unbind spoken by one who loves the bound.', N); return true; }
    say(G, 'Three pages in Marga\'s looping hand: THE WINTERGREEN RITE. "To unbind a thing that was bound against its will. Take vervain, salt and rue, steeped together; pour it at the foot of whatever holds the hum. Then speak the Unbind. It must be spoken by one who loves the bound, or it takes a price: the speaker\'s own power, for a time. Ward-stones and collars of iron answer to this and to nothing else." In the margin, in a different, smaller hand: "I should have burned the recipe. — M."', N);
    learnSpell(G, 'unbind');
    K.learnRecipe(G, 'tincture');
    K.learnHerb(G, 'vervain');
    levelUp(G, 'The words go into you like a bell struck in an empty church. You can feel the shape of the Unbind forming in your chest: vast, quiet and heavy. (Craft level 5. CAST UNBIND: 3 ember, and an unbinding tincture of vervain, salt and rue, brewed with the kettle.)');
    points(G, 'pages', 3);
    clue(G, 'pages', 'The Wintergreen Rite: pour an unbinding tincture (vervain + salt + rue) at the foot of a ward-stone or collar, then CAST UNBIND, spoken by one who loves the bound.');
});
rule('cast', 'sight', 'portrait', (G) => {
    say(G, 'You lay your second sight on the portrait, and the pencil lines glow. In the corner, in the young woman\'s hand, you can read what the picture remembers: "To Marga, with love, from your first and best. C." It is dated eleven years ago. The girl\'s hand is the same one that signed the charts downstairs. C. Vesper.', M);
    clue(G, 'portrait', 'The portrait in Vesper\'s office: Marga with a young woman, signed "To Marga, with love, from your first and best. C." Dr. Cordelia Vesper was Marga\'s apprentice.');
    points(G, 'portrait', 1);
});

// ------------------------------------------------------------------ rules: the Salt Road and the vault door
rule('cast', 'sight', 'vault_door', (G) => {
    G.flags.saw_needle = true;
    points(G, 'needle', 1);
    say(G, 'You lay your second sight on the keyhole, and your blood runs cold. Inside the brass collar, coiled in the dark, sits a little spring-loaded needle, its tip greened with something, and monkshood. Whoever turns that lock without drawing the spring first will be stung by it. You could jam the spring with something small and hard.', M);
    clue(G, 'needle', 'The vault door\'s keyhole hides a monkshood-tipped needle. Jam the spring (with the brass crow button?) before opening it, or have the antidote ready (rue + comfrey + salt).');
});
rule('use', 'button', 'vault_door', (G) => {
    if (!G.flags.saw_needle) { say(G, 'You look at the keyhole and at the button, and can\'t see what you\'d be doing. (You wonder what is in the lock.)', N); return true; }
    if (G.flags.needle_jammed) { say(G, 'The spring is jammed already.', N); return true; }
    G.flags.needle_jammed = true;
    points(G, 'jam', 2);
    say(G, 'You push the brass crow into the keyhole with the tip of your hairpin, and it settles against the spring with a tiny click: the Governor\'s own badge, choking the Governor\'s own trap. Bryony grins at it, which you have not seen her do before.', N);
});
rule('cast', 'loosen', 'vault_door', (G) => {
    if (G.flags.vault_open) { say(G, 'It is open.', M); return true; }
    G.flags.vault_open = true;
    if (G.flags.needle_jammed) {
        points(G, 'vault', 2);
        say(G, 'The lock turns under your spell, and the tumblers fall. The spring, jammed by the brass crow, snaps against it with a harmless clack. The great door swings inward on a red glow and a wave of hot salt air, and the clank of a forge. Beyond: the Vaults.', M);
    } else {
        G.flags.bryony_poisoned = true;
        after(G, 'bryony_dies', 12);
        say(G, 'The lock turns under your spell with a click, and Bryony, who has been leaning in to watch, takes a hiss of breath: a tiny spring in the keyhole has fired a needle into the ball of her thumb. She stares at it. "Oh," she says, in a small voice. "Oh, that\'s monkshood," and she sits down very suddenly in the tunnel, grey in the face. Her lips are already going blue.', N);
        say(G, 'Marga\'s margin note. Rue to slow the blood, comfrey to bind it, salt to wake the heart. Be quick. Be quicker.', 'danger');
        ev(G, { type: 'sfx', name: 'warn' });
    }
});
rule(['use', 'give'], 'antidote', 'bryony', (G) => {
    if (!G.flags.bryony_poisoned) { say(G, 'Bryony looks at the bottle, then at you. "I\'m not poisoned," she says. "Yet."', SP); return true; }
    if (G.flags.bryony_cured) { say(G, 'She is already recovering.', N); return true; }
    spend(G, 'antidote', 1);
    G.flags.bryony_cured = true;
    G.timers = G.timers.filter((t) => t.id !== 'bryony_dies');
    points(G, 'cure', 3);
    say(G, 'You tilt the foul green draught between her blue lips. For a long moment nothing happens at all. Then she coughs, hard, and her chest heaves, and the colour comes back into her cheeks in a rush, like a lamp turned up. "Never," she gasps, "do that again." You laugh, shakily. You can\'t help it.', N);
    clue(G, 'cure', 'The antidote worked: Bryony is alive.');
});
rule(['open', 'push', 'use'], 'salters_door', undefined, (G, c) => {
    if (c.verb === 'use' && c.a && c.b && c.b.id !== 'salters_door') return false;
    if (G.flags.crypt_open) { say(G, 'It is already unbarred.', N); return true; }
    G.flags.crypt_open = true;
    points(G, 'crypt', 1);
    say(G, 'You heave up the great iron bar with a grunt and set it aside, and the salters\' door swings inward. Beyond, a stair leads up into the cold. You are standing under St. Agnes\'s chapel.', N);
});

// ------------------------------------------------------------------ rules: the Vaults and the cells
rule(['use'], 'cell_keys', 'cells_gate', (G) => openCells(G, false));
rule('cast', 'loosen', 'cells_gate', (G) => openCells(G, true));
function openCells(G, magic) {
    if (G.flags.cells_open) { say(G, 'The cell gate is open already.', N); return true; }
    G.flags.cells_open = true;
    points(G, 'cells', 2);
    say(G, magic ? 'The great lock gives with a sigh under your spell.' : 'The key turns with a groan of old iron that goes echoing down the pillars.', magic ? M : N);
    say(G, 'The gate swings open on a row of low cells and the smell of sickness. Someone inside says, hoarsely: "Marga?" and then, in a different voice, "No. Not Marga."', N);
    return true;
}

const cure = (potion, witch, text) => rule(['use', 'give'], potion, witch === 'twins' ? ['twins', 'collars'] : witch, (G) => {
    if (G.flags['ready_' + witch]) { say(G, 'She is tended already.', N); return true; }
    if (witch === 'twins' && !G.flags.cells_open) return false;
    spend(G, potion, 1);
    G.flags['ready_' + witch] = true;
        say(G, text, N);
    sfx(G, 'level');
    checkRescues(G);
});
cure('waking_tea', 'marga', 'You lift Marga\'s head against your knee and put the flask to her lips. She chokes, coughs, and swallows. The bitter steam of wormwood fills the cell. For a long, long moment she does not move. Then her eyes open, grey, clear and startlingly sharp, and she says, in a rusty whisper, "Elspeth Thorne. What is that in your hair?" She has never looked so alive. You find you cannot speak.');
cure('eyewash', 'dunmore', 'You tilt Granny Dunmore\'s head back and bathe her clouded eyes with the cool eyewash, dabbing it away with a corner of your shawl. She blinks, and blinks again, and looks, sharp as a hawk, straight at your face. "Well," she says. "A good deal shorter than I imagined."');
cure('fever_tea', 'harrow', 'Widow Harrow sips the fever tea with both hands round the flask, like a child. The rattle in her chest softens, and the flush ebbs. "That," she says, "is feverfew and willow bark. Your mother\'s mother taught you right."');
cure('tincture', 'twins', 'You pour the violet tincture over the iron collars, one after the other, and the runes hiss, and spit grey light, and the iron goes soft and black and brittle as burnt sugar. One collar cracks across; then the other. The Misses Pennywhistle gasp together, like women surfacing from a pond, and both begin to speak at once.');

export function checkRescues(G) {
    if (!G.flags.stone_broken) return;
    for (const w of WITCHES) {
        if (G.flags['ready_' + w] && !G.rescued.includes(w)) {
            G.rescued.push(w);
            G.party.push(w);
            G.npcLoc[w] = G.room;
            points(G, 'rescue_' + w, 2);
            say(G, `${WITCH_NAME[w]} ${w === 'twins' ? 'are' : 'is'} on ${w === 'twins' ? 'their' : 'her'} feet. ${w === 'twins' ? 'They' : 'She'} will follow you out.`, 'clue');
        }
    }
}

// ------------------------------------------------------------------ rules: the Works
rule(['use', 'give'], ['draught', 'poison', 'salve', 'fever_tea', 'eyewash', 'waking_tea', 'tincture', 'antidote'], 'teapot', (G, c) => {
    if (G.flags.vesper_asleep) { say(G, 'She is asleep already.', N); return true; }
    const id = c.a.id;
    if (id === 'poison') {
        kill(G, 'THE WRONG KIND OF CURE', 'The black dew vanishes into the white china. Vesper takes one sip, stiffens, and falls forward with her face in the ledger. A moment later, the whole Works goes still: every stoker, every furnace, every eye in the Vaults. You have just killed Marga\'s first apprentice. The bailiff by the pillar has seen it too. Whatever you do next, you will do it as a murderer, in the dark, in the Governor\'s own cathedral.');
        return true;
    }
    if (id !== 'draught') { say(G, 'She would taste it. Only the sweet, drowsy draught will pass.', N); return true; }
    if (G.flags.vesper_dosed) { say(G, 'It is done. Wait.', N); return true; }
    spend(G, 'draught', 1);
    G.flags.vesper_dosed = true;
    after(G, 'vesper_sleeps', 2);
    say(G, 'Vesper has turned her head to the bailiff. You reach between the furnace-light and the tea-tray, under your veil, and slip the vial\'s stopper out and tip the draught into the white teapot. It goes in without a ripple. You are three paces away before she turns back. She pours herself a fresh cup and sips.', N);
});
rule(['use', 'give'], 'tincture', 'stone', (G) => {
    if (G.flags.stone_broken) { say(G, 'The stone is cracked already.', N); return true; }
    if (!G.flags.vesper_asleep) { say(G, 'Not with Dr. Vesper wide awake and two yards from you.', N); return true; }
    if (G.flags.tincture_poured) { say(G, 'The tincture has been poured. Now the Unbind.', N); return true; }
    spend(G, 'tincture', 1);
    G.flags.tincture_poured = true;
    say(G, 'You kneel at the foot of the great grey crystal and pour out the violet tincture in a ring. It hisses, steams, and sinks into the salt, and you feel the hum of the stone falter, like a singer losing the thread of a song. Now it needs the Unbind.', N);
});
rule('cast', 'unbind', 'stone', (G, c) => {
    if (G.flags.stone_broken) { say(G, 'It is broken already.', M); c.free = true; return true; }
    if (!G.flags.vesper_asleep) { say(G, 'It would be heard in the next county, and Vesper is two yards away. Not yet.', M); c.free = true; return true; }
    if (!G.flags.tincture_poured) { say(G, 'The binding is too tight to move. It needs something to loosen it first: the tincture, poured at the stone\'s foot.', M); c.free = true; return true; }
    G.flags.stone_broken = true;
    points(G, 'stone', 5);
    say(G, 'You lay both hands on the cold crystal and speak the Unbind, for Marga, and Bryony, and Dunmore, and Harrow, and the Pennywhistle sisters, and eleven other names you do not know yet, and love comes up in you like water in a well. The stone sings: a long, rising note, grey turning to white. Iron rings burst from it, one after another, with a sound like a church full of breaking bells. Then the crystal splits from top to bottom, and the hum of the whole Vaults stops, and the silence rings like a struck bell. Down in the cells, someone begins to shout.', M);
    ev(G, { type: 'sfx', name: 'stone' });
    G.flags.leave_ok = false;
    if (G.clock != null && G.clock > 14) { G.clock = 14; say(G, 'The noise will have carried. Every bailiff in the Vaults is on his feet. The wagons will not be long.', 'danger'); }
    checkRescues(G);
});

// ------------------------------------------------------------------ the bell, and the ending
rule(['ring', 'push', 'use', 'take'], ['bell_rope'], undefined, (G, c) => {
    if (G.room !== 'chapel') return false;
    if (c.verb === 'use' && c.b) return false;
    if (!G.flags.stone_broken) {
        say(G, 'Moll catches your wrist, gently but with a gravedigger\'s grip. "Not yet, my dear. A bell rung for nothing summons only bailiffs. When you have something to ring for, you\'ll know it." Her eyes are very bright.', SP);
        addDread(G, 10);
        return true;
    }
    finale(G);
});

function finale(G) {
    const R = G.rescued.length, E = G.evidence.length;
    points(G, 'bell', 5);
    sfx(G, 'bell');
    const names = G.rescued.map((w) => WITCH_NAME[w]);
    say(G, 'You take the rope in both hands, and Moll puts her broad hands over yours, and together you pull. The first stroke of the great bell of St. Agnes rolls out over Ashwick for the first time in thirty years, and the whole town sits up in bed.', N);
    say(G, 'Doors open. Lamps are lit. Shutters bang back. In the square, farmers who came in with their carts and sat on them, afraid, for months, climb down. Women appear on thresholds. Tobias\'s mother is among them, with a lantern, with the boy on her hip, and she is already asking the way to the chapel. The bailiffs, who have never in their lives been rung awake, stand in the middle of the square with their lanterns, looking at a crowd.', N);
    let ending, title, text;
    if (R >= 4 && E >= 4) {
        ending = 'dawn'; title = 'Dawn Over Ashwick';
        text = `By dawn the square is full. You stand on the plinth of the Governor's statue, with Bryony at one elbow and Marga, upright and indomitable, at the other, and read the evidence aloud: the docket, the chart, the ledger page, the Governor's own letter in his own hand. You hold up a bottle of Tonic No. 9, and let the grey hum rise in it, for everyone to see. The farmers do not shout. They simply stop moving, one by one, and turn, and look at the Governor's carriage as it rolls into the square. Governor Aldous Cray gets out into a silence in which a pin could be heard. Moll, who has waited thirty years, rings the bell one more time. Granny Dunmore, Widow Harrow and the Misses Pennywhistle each, in their own ways, begin to say what they think of him. The Edict is torn down before noon. Dr. Vesper wakes in a cell of her own. Marga goes to see her, alone, with a kettle.\n\nIn spring the hedge witches of Ashwick open a free house of healing in the Infirmary's old west wing. Mrs. Tanner scrubs its floors, for wages, and Tobias carries the herbs. Over its door someone has hung a small brass crow, upside down, to remind everyone of where it came from. Bryony says it's tasteless. She stands under it every morning anyway.`;
    } else if (R >= 2 && E >= 3) {
        ending = 'ashes'; title = 'Ash and Salt';
        text = `By dawn the square is full, and Governor Cray's carriage arrives to find the whole of Ashwick holding up whatever evidence you could lay your hands on. It is enough to cancel the Edict, and to bring the magistrate from the county town. It is not enough to hang a man like Cray, who has too many friends and too many creditors, and who retires to his estate, wounded and furious and very rich. You have freed ${names.join(', ') || 'no one'}. The others rode the wagons, that night, to a place you will have to find. Marga says it is not over. Marga is right. Bryony kicks the plinth of the Governor's statue, and then, to her own surprise, cries on your shoulder.\n\nYou set out in the spring, the three of you, with a kettle and a map of the salt roads, and a long list of names.`;
    } else {
        ending = 'winter'; title = 'The Long Winter';
        text = `You do what you can. The bell wakes the town, and you stand in the square with your hands empty and nothing to show anyone, and the Governor arrives in his carriage and tells the people, in a reasonable voice, that a hedge witch has broken into a hospital and a chapel and caused a public disturbance. The Edict is posted at dawn. ${R ? `You have freed ${names.join(', ')}, and they melt away into the hills with you before the bailiffs can reach the chapel.` : 'You escape with your life, which is something.'} The rest of the story is a long cold winter in the hills, and every farmer in the county paying the Infirmary for every cough.\n\nBut the bell has rung. Thirty years of silence are broken, and Moll, who stayed behind and was not taken, keeps on ringing it every night.`;
    }
    say(G, text, 'end');
    G.ending = ending;
    ev(G, { type: 'end', ending, title, score: G.score });
}
