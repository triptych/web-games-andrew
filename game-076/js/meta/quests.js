// Quests: four or five per chapter. Each is a pure check against the project,
// the lifetime stats and the playtest hooks seen so far; once done, done.
// `show` names the tool a "Show me" button highlights.

const cmds = (p, pred) => { let n = 0; walkAll(p, (c, ctx) => { if (pred(c, ctx)) n++; }); return n; };
function walkAll(p, fn) {
    const visit = (list, ctx) => {
        for (const c of list || []) {
            if (!c) continue;
            fn(c, ctx);
            for (const k of ['then', 'else', 'win', 'loseList']) if (c[k]) visit(c[k], ctx);
            if (c.branches) for (const b of c.branches) visit(b, ctx);
        }
    };
    for (const m of p.maps) for (const e of m.events) for (const pg of e.pages) visit(pg.list, { map: m, event: e, page: pg });
}
const pages = (p, pred) => { for (const m of p.maps) for (const e of m.events) for (const pg of e.pages) if (pred(pg, e, m)) return true; return false; };
/** Cells a player has painted on a map: ground that isn't the blank fill, or anything on the decor and over layers. */
const painted = (m) => { let n = 0; for (let i = 0; i < m.w * m.h; i++) if (m.layers[0][i] !== 1 || m.layers[1][i] || m.layers[2][i]) n++; return n; };
const prog = (n, goal) => ({ progress: Math.min(n, goal), goal, done: n >= goal });
const yes = (b) => ({ progress: b ? 1 : 0, goal: 1, done: !!b });
const hooked = (ctx, name) => !!ctx.flags['hook.' + name];

export const QUESTS = [
    // 0 — The Blank Page
    { ch: 0, id: 'paint', title: 'First Strokes', desc: 'Paint 40 tiles on your map.', hint: 'Pick a tile in the palette on the left, then click and drag on the map. Grass is a fine beginning.', show: 'tool-pencil', check: (x) => prog(x.stats.painted, 40) },
    { ch: 0, id: 'variety', title: 'A Little Variety', desc: 'Use at least 5 different tiles.', hint: 'Water, sand, a path, flowers, trees. Decor tiles (marked D) go on the Decor layer, above the ground.', show: 'palette', check: (x) => { const s = new Set(); for (const m of x.p.maps) for (let li = 0; li < 3; li++) for (const t of m.layers[li]) if (t) s.add(li + ':' + t); return prog(s.size, 5); } },
    { ch: 0, id: 'start', title: 'Where It Begins', desc: 'Place the hero\'s starting position.', hint: 'Choose the ⚑ Start tool and click where your hero should first stand.', show: 'tool-start', check: (x) => yes(x.p.system.startSet) },
    { ch: 0, id: 'walk', title: 'Take a Step', desc: 'Playtest your world.', hint: 'Press ▶ Playtest at the top (or F5). Walk around with the arrow keys, then close it with ✕.', show: 'btn-playtest', check: (x) => prog(x.stats.playtests, 1) },
    // 1 — Words
    { ch: 1, id: 'npc', title: 'Someone to Talk To', desc: 'Make an event with a character graphic.', hint: 'Switch to the Events layer and double-click an empty tile, or right-click and choose NPC. Then choose a Graphic.', show: 'layer-3', check: (x) => yes(pages(x.p, (pg) => pg.gfx.kind === 'char')) },
    { ch: 1, id: 'speaker', title: 'Say Something', desc: 'Add a Show Text with a speaker\'s name.', hint: 'In the event editor, select the ◆ row and press Insert. Choose Show Text and fill in Speaker and Text.', show: 'layer-3', check: (x) => yes(cmds(x.p, (c) => c.t === 'text' && c.speaker && c.text)) },
    { ch: 1, id: 'texts', title: 'Wordsmith', desc: 'Write 3 messages.', hint: 'Every Show Text is one box. Give your villagers something to say.', check: (x) => prog(cmds(x.p, (c) => c.t === 'text' && c.text), 3) },
    { ch: 1, id: 'talk', title: 'Conversation', desc: 'Talk to someone in a playtest.', hint: 'Playtest, walk up to your character, face them and press Z or Enter.', show: 'btn-playtest', check: (x) => yes(hooked(x, 'talk')) },
    // 2 — Things
    { ch: 2, id: 'item', title: 'Make Something', desc: 'Create an item in the Database.', hint: 'Open the Database, go to Items and press + New. A potion is traditional.', show: 'btn-db', check: (x) => prog(x.p.items.length, 1) },
    { ch: 2, id: 'chest', title: 'Treasure!', desc: 'Make an event that gives an item.', hint: 'Right-click the map and choose Treasure Chest, or add a Change Items command to any event.', show: 'layer-3', check: (x) => yes(cmds(x.p, (c) => c.t === 'item' && c.amount > 0 && c.item)) },
    { ch: 2, id: 'loot', title: 'Finders Keepers', desc: 'Get an item during a playtest.', hint: 'Playtest and open your chest.', show: 'btn-playtest', check: (x) => yes(hooked(x, 'item')) },
    { ch: 2, id: 'gold', title: 'Pocket Money', desc: 'Give the party gold with a command.', hint: 'Insert Change Gold with a positive amount: a reward, a found purse, a tip.', check: (x) => yes(cmds(x.p, (c) => c.t === 'gold' && c.amount > 0)) },
    // 3 — Places
    { ch: 3, id: 'map2', title: 'New Horizons', desc: 'Create a second map.', hint: 'Press + New above the map list.', show: 'maps', check: (x) => prog(x.p.maps.length, 2) },
    { ch: 3, id: 'door', title: 'A Door Opens', desc: 'Make a Transfer Player to another map.', hint: 'Right-click where the door is and choose Door / Exit, then click the spot on the other map.', show: 'layer-3', check: (x) => yes(cmds(x.p, (c, ctx) => c.t === 'transfer' && c.map && c.map !== ctx.map.id)) },
    { ch: 3, id: 'travel', title: 'Journey', desc: 'Travel between maps in a playtest.', hint: 'Playtest and walk through your door.', show: 'btn-playtest', check: (x) => yes(hooked(x, 'transfer')) },
    { ch: 3, id: 'indoors', title: 'Home, Sweet Home', desc: 'Build a room on a map with the Interior tileset (paint 10 tiles).', hint: 'Make a new map (or open a map\'s ⋯ menu ▸ Properties) and choose Interior. Then paint walls, floors and furniture: a cottage, an inn, a shop.', show: 'maps', check: (x) => prog(Math.max(0, ...x.p.maps.filter((m) => m.tileset === 'interior').map(painted)), 10) },
    // 4 — Choices
    { ch: 4, id: 'choice', title: 'Fork in the Road', desc: 'Use Show Choices.', hint: 'Put Show Choices after a Show Text: the question appears with the message.', check: (x) => yes(cmds(x.p, (c) => c.t === 'choice')) },
    { ch: 4, id: 'switchpage', title: 'Flip the Switch', desc: 'Give an event a page that needs a switch, and turn that switch on with a command.', hint: 'Turn a switch ON with Control Switch in one event. In another (or the same), add a page whose condition is that switch.', check: (x) => { const on = new Set(); walkAll(x.p, (c) => { if (c.t === 'switch' && c.value !== 'off') on.add(c.id); }); return yes(pages(x.p, (pg) => (pg.cond.sw1 && on.has(pg.cond.sw1)) || (pg.cond.sw2 && on.has(pg.cond.sw2)))); } },
    { ch: 4, id: 'var', title: 'Keeping Count', desc: 'Change a variable with a command.', hint: 'Control Variable: add 1 to "Apples collected" every time the hero picks one.', check: (x) => yes(cmds(x.p, (c) => c.t === 'var')) },
    { ch: 4, id: 'if', title: 'If So', desc: 'Use a Conditional Branch.', hint: '"If the party has the Key, open the door. Else, say it\'s locked."', check: (x) => yes(cmds(x.p, (c) => c.t === 'if')) },
    { ch: 4, id: 'decide', title: 'Consequences', desc: 'Make a choice during a playtest.', hint: 'Playtest and answer your own question.', show: 'btn-playtest', check: (x) => yes(hooked(x, 'choice')) },
    // 5 — Conflict
    { ch: 5, id: 'enemy', title: 'Here Be Monsters', desc: 'Create an enemy.', hint: 'Database ▸ Enemies ▸ + New. Pick a family, colours and size.', show: 'btn-db', check: (x) => prog(x.p.enemies.length, 1) },
    { ch: 5, id: 'fight', title: 'Ambush', desc: 'Set up a battle: a Battle Processing command, or random encounters on a map.', hint: 'Make a troop in Database ▸ Troops, then use the Monster template, or add the troop to a map\'s encounters.', check: (x) => yes(cmds(x.p, (c) => c.t === 'battle' && c.troop) || x.p.maps.some((m) => m.encRate > 0 && m.encounters.length)) },
    { ch: 5, id: 'win', title: 'Victory!', desc: 'Win a battle in a playtest.', hint: 'Playtest and fight. Attack, attack, attack.', show: 'btn-playtest', check: (x) => yes(hooked(x, 'battleWin')) },
    { ch: 5, id: 'skill', title: 'Arcane Arts', desc: 'Give a hero a skill.', hint: 'Make a skill in Database ▸ Skills, then add it to a hero in Heroes ▸ Skills.', show: 'btn-db', check: (x) => yes(x.p.actors.some((a) => a.skills.some((s) => x.p.skills.some((k) => k.id === s.skill)))) },
    // 6 — Commerce & Care
    { ch: 6, id: 'shop', title: 'Open for Business', desc: 'Make a shop with at least 3 goods.', hint: 'Right-click ▸ Shopkeeper, then edit its Shop Processing to choose the goods.', check: (x) => yes(cmds(x.p, (c) => c.t === 'shop' && (c.goods || []).length >= 3)) },
    { ch: 6, id: 'buy', title: 'Customer', desc: 'Buy something in a playtest.', hint: 'Playtest, visit your shop and buy something.', show: 'btn-playtest', check: (x) => yes(hooked(x, 'shopBuy')) },
    { ch: 6, id: 'gear', title: 'Well Equipped', desc: 'Make a weapon and an armour.', hint: 'Items of kind Weapon and Armour. Give them ATK and DEF bonuses.', show: 'btn-db', check: (x) => yes(x.p.items.some((i) => i.kind === 'weapon') && x.p.items.some((i) => i.kind === 'armor')) },
    { ch: 6, id: 'friends', title: 'Fellowship', desc: 'Have a party of two: start with two heroes, or add one with Change Party.', hint: 'Make a second hero, then tick them in System ▸ Party, or recruit them with Change Party.', check: (x) => yes(x.p.system.party.length >= 2 || cmds(x.p, (c) => c.t === 'party' && c.op !== 'remove' && c.actor)) },
    // 7 — The Living World
    { ch: 7, id: 'autorun', title: 'Lights, Camera', desc: 'Make an Autorun event.', hint: 'A cutscene that plays when the hero arrives. End it with a switch so it doesn\'t repeat.', check: (x) => yes(pages(x.p, (pg) => pg.trigger === 'autorun' && pg.list.length)) },
    { ch: 7, id: 'wander', title: 'Wanderers', desc: 'Give a character Random movement.', hint: 'In an NPC\'s page, set Movement to Random.', check: (x) => yes(pages(x.p, (pg) => pg.move === 'random' && pg.gfx.kind === 'char')) },
    { ch: 7, id: 'shake', title: 'Rumble', desc: 'Shake the screen.', hint: 'Shake Screen, in a cutscene, at the worst possible moment.', check: (x) => yes(cmds(x.p, (c) => c.t === 'shake')) },
    { ch: 7, id: 'music', title: 'Soundtrack', desc: 'Give two maps their own music.', hint: 'Map ⋯ ▸ Properties ▸ Music. Press ▶ to listen first.', show: 'maps', check: (x) => prog(x.p.maps.filter((m) => m.music && m.music !== 'none').length, 2) },
    { ch: 7, id: 'forge', title: 'Original Character', desc: 'Make a sprite in the Sprite Forge.', hint: 'Open Forge, press + New sprite and dress them up.', show: 'btn-forge', check: (x) => prog(x.p.sprites.length, 1) },
    // 8 — The Worldbook
    { ch: 8, id: 'title', title: 'A Name for It', desc: 'Give your game a title.', hint: 'Database ▸ System ▸ Game title.', show: 'btn-db', check: (x) => yes(x.p.system.title && !/^untitled tale$/i.test(x.p.system.title) && !/^my first tale$/i.test(x.p.system.title)) },
    { ch: 8, id: 'theend', title: 'Happily Ever After', desc: 'Add The End command.', hint: 'Put The End at the end of your last cutscene, with a few closing words.', check: (x) => yes(cmds(x.p, (c) => c.t === 'end')) },
    { ch: 8, id: 'finish', title: 'The End?', desc: 'Reach your ending in a playtest.', hint: 'Play your game all the way through. Use "Playtest from here" (right-click) to skip ahead.', show: 'btn-playtest', check: (x) => yes(hooked(x, 'ending')) },
    { ch: 8, id: 'export', title: 'Bound', desc: 'Export your game.', hint: 'Press Export and download the standalone game.', show: 'btn-export', check: (x) => prog(x.stats.exports, 1) },
];

export function questsFor(ch) { return QUESTS.filter((q) => q.ch === ch); }
export const qid = (q) => 'ch' + q.ch + '.' + q.id;

/** Evaluate one quest safely. */
export function evaluate(q, ctx) {
    try { return q.check(ctx); } catch { return { progress: 0, goal: 1, done: false }; }
}
export { walkAll, cmds };
