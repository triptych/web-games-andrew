// ============================================================
// data/quests.js - the main chain and the authored side quests (GDD 11)
// A goal is DATA. game/quests.js is the only thing that evaluates it, so a
// quest can never silently depend on a system that is not watching it.
//
// goal kinds:
//   reach {node} · boss {bossId} · capture {count, element?, lineage?, ashbound?}
//   defeat {count, element?, lineage?} · own {count, lineage?, stage?, generation?, element?}
//   hatch {count} · breed {count, generation?} · item {itemId, count}
//   flag {key} · level {n} · broodex {count} · bond {n} · visitAll {nodes}
// ============================================================

export const MAIN_CHAIN = [
  { id: 'm01', act: 1, title: 'The Warm Room',
    detail: 'Take the dragon Maerin left you, and give it a name to answer to.',
    goal: { kind: 'own', count: 1 },
    scene: 'first_dragon', reward: { items: ['ember_salve', 'ember_salve', 'rune_cord', 'rune_cord', 'hearth_bread'] } },

  { id: 'm02', act: 1, title: 'Out Past the Gate',
    detail: 'Walk down into the Low Fields and find out what is still living there.',
    goal: { kind: 'defeat', count: 2 },
    reward: { coin: 90, items: ['rune_cord'] } },

  { id: 'm03', act: 1, title: 'The Method',
    detail: 'Bind a wild dragon with a Rune Cord. Weaken it first — a binding will not hold a healthy animal.',
    goal: { kind: 'capture', count: 1 },
    reward: { coin: 120, items: ['ember_salve', 'sunmelon'] } },

  { id: 'm04', act: 1, title: 'What She Wrote Down',
    detail: 'An ashbound dragon can be brought back. Cleanse one with a Clearwater Draught, in battle, and see what is under the grey.',
    goal: { kind: 'flag', key: 'cleansed_one' },
    scene: 'vale_ashbound', reward: { coin: 150, items: ['clearwater', 'bind_chain'] } },

  { id: 'm05', act: 1, title: 'The Guttering Roost',
    detail: 'Cinderfang has been eating the light out of the valley since spring. Maerin lost a hatchling to it. Go up the chimney.',
    goal: { kind: 'boss', bossId: 'cinderfang' },
    scene: 'cinderfang_pre', after: 'cinderfang_post',
    reward: { coin: 400, items: ['greater_salve', 'greater_salve', 'sigil_snare', 'warmth_stone'] } },

  { id: 'm06', act: 2, title: 'The Letter from Saltley',
    detail: 'The Tide line is failing and the chorus-hall has gone quiet. Get to Saltley.',
    goal: { kind: 'reach', node: 'saltley' },
    reward: { coin: 120, items: ['salt_cod', 'ley_tonic'] } },

  { id: 'm07', act: 2, title: 'A Brood of Your Own',
    detail: 'Pair two dragons at the Broodwell and hatch the egg. A line that has thinned to one animal needs more than one animal.',
    goal: { kind: 'hatch', count: 1 },
    reward: { coin: 250, items: ['warmth_stone', 'heartseed'] } },

  { id: 'm08', act: 2, title: 'The Concord Warden',
    detail: 'Someone from the Concord is waiting at Tidewatch and has read all of Maerin’s papers.',
    goal: { kind: 'reach', node: 'tidewatch' },
    scene: 'kessa_meet', reward: { coin: 150 } },

  { id: 'm09', act: 2, title: 'The Sunken Chorus-Hall',
    detail: 'Morvaleth has been singing the Tide line to an empty hall for a century. Go down and stop it, one way or another.',
    goal: { kind: 'boss', bossId: 'morvaleth' },
    scene: 'morvaleth_pre', after: 'morvaleth_post',
    reward: { coin: 600, items: ['wardens_salve', 'tidesong', 'soulglass'] } },

  { id: 'm10', act: 3, title: 'Through the Slag Gate',
    detail: 'Kessa has signed you through. See Cindermarch rather than imagine it.',
    goal: { kind: 'reach', node: 'cindermarch' },
    scene: 'cindermarch_arrive', reward: { coin: 200, items: ['deep_ley'] } },

  { id: 'm11', act: 3, title: 'What the Furnace Eats',
    detail: 'The Ashfields are ankle-deep in a hundred years of Spire-fall, and full of dragons that came there to forget faster. Bring three of them back.',
    goal: { kind: 'capture', count: 3, ashbound: true },
    reward: { coin: 500, items: ['clearwater', 'clearwater', 'panacea'] } },

  { id: 'm12', act: 3, title: 'The Concord Hall',
    detail: 'Kessa will not stand aside, and says so plainly. Show her you can hold what you are asking for.',
    goal: { kind: 'boss', bossId: 'kessa' },
    scene: 'kessa_fight_pre', after: 'kessa_fight_post',
    reward: { coin: 900, items: ['hearth_ember', 'brood_incense', 'lineage_charm'] } },

  { id: 'm13', act: 4, title: 'Windward Camp',
    detail: 'The Gale and Stone lines are the thinnest of the five. Get up into the Peaks.',
    goal: { kind: 'reach', node: 'windward' },
    scene: 'peaks_arrive', reward: { coin: 250, items: ['skyberry', 'windfeather'] } },

  { id: 'm14', act: 4, title: 'Make One',
    detail: 'There is no living keeper that remembers the Skyward line. So breed one: second generation or better, and grown past hatchling.',
    goal: { kind: 'own', count: 1, generation: 2, stage: 'drake' },
    reward: { coin: 600, items: ['ember_yolk', 'brood_ledger'] } },

  { id: 'm15', act: 4, title: 'The Riven Throne',
    detail: 'Ythrax has held a split peak alone for ninety years, guarding nothing. Go up before the afternoon wind.',
    goal: { kind: 'boss', bossId: 'ythrax' },
    after: 'ythrax_post',
    reward: { coin: 1200, items: ['full_salve', 'dawn_collar', 'elder_snare'] } },

  { id: 'm16', act: 5, title: 'Eleven Hundred Steps',
    detail: 'Down the Long Stair, into the Hollow Sun.',
    goal: { kind: 'reach', node: 'spire_stair' },
    scene: 'spire_descent', reward: { items: ['line_draught', 'phoenix_cinder'] } },

  { id: 'm17', act: 5, title: 'The Thing in the Furnace',
    detail: 'Vaelorax has been awake, and listening, for some time.',
    goal: { kind: 'reach', node: 'hollow_sun' },
    scene: 'vaelorax_meet', reward: {} },

  { id: 'm18', act: 5, title: 'Properly',
    detail: 'Finish it, and then choose what the five lines do next.',
    goal: { kind: 'boss', bossId: 'vaelorax' },
    after: 'ending_choice', reward: {} },
];

export const SIDE_QUESTS = [
  { id: 's01', act: 1, giver: 'tolm', node: 'broodwell', title: 'Something to Eat',
    detail: "Tolm will not stop worrying about what your dragons are living on. Feed one of them until it actually likes you.",
    goal: { kind: 'bond', n: 40 }, reward: { coin: 120, items: ['gilded_haunch', 'char_root'] },
    done: "“There. Now it'll come when you call, which is half of everything.”" },

  { id: 's02', act: 1, giver: 'bryd', node: 'hollowbridge', title: 'The Hedge at Thornwatch',
    detail: 'Something green has been living in the hedgerow since the line went out, and Bryd’s sheep have opinions.',
    goal: { kind: 'defeat', count: 3, element: 'verdant' }, reward: { coin: 180, items: ['venomdraw', 'braveleaf'] },
    done: "“Sheep are content. Sheep are rarely content. Take the coin.”" },

  { id: 's03', act: 1, giver: 'bryd', node: 'hollowbridge', title: 'Four Names for the Ledger',
    detail: 'Bryd keeps a ledger of every lineage that comes through the valley, and it is four short.',
    goal: { kind: 'broodex', count: 4 }, reward: { coin: 260, items: ['memory_stone'] },
    done: "“Four more lines written down that weren't. That's not nothing.”" },

  { id: 's04', act: 2, giver: 'ilsa', node: 'saltley', title: 'Salt in the Water',
    detail: 'The Reed Flats have gone sour and the market wants to know why. Thin out what is breeding in there.',
    goal: { kind: 'defeat', count: 5, element: 'tide' }, reward: { coin: 340, items: ['saltcloth', 'tidesong'] },
    done: "“Water's clearing already. Come back when you want something expensive.”" },

  { id: 's05', act: 2, giver: 'ilsa', node: 'saltley', title: 'Grey in the Reeds',
    detail: 'Two ashbound dragons have come down out of the marsh and are sitting in the shallows, forgetting. Ilsa would rather you took them than the Concord did.',
    goal: { kind: 'capture', count: 2, ashbound: true }, reward: { coin: 420, items: ['clearwater', 'ash_pear', 'moonlit_snare'] },
    done: "“They've got names again. I heard one of them answer to it. That's worth more than the coin, but take that too.”" },

  { id: 's06', act: 2, giver: 'tolm', node: 'broodwell', title: 'The Warm Room, Again',
    detail: 'Tolm has cleaned out the second nest and would like to see something in it.',
    goal: { kind: 'hatch', count: 2 }, reward: { coin: 400, items: ['warmth_stone', 'brood_incense'] },
    done: "“Two of them in there now, arguing. She'd have liked the noise.”" },

  { id: 's07', act: 3, giver: 'darrow', node: 'cindermarch', title: 'Parts',
    detail: 'Darrow will make you anything once, for parts. Bring six scale shards and two lengths of sinew.',
    goal: { kind: 'item', items: { scale_shard: 6, sinew: 2 } }, reward: { coin: 200, items: ['bulwark_rig'] },
    consumes: true,
    done: "“Good scale. Come back with better and I'll do better.”" },

  { id: 's08', act: 3, giver: 'kessa', node: 'cindermarch', title: 'A Census of Dragons',
    detail: 'Kessa is trying to get dragons counted in the Concord census, and needs eight lineages on paper to do it.',
    goal: { kind: 'broodex', count: 8 }, reward: { coin: 700, items: ['quiet_bell', 'brood_ledger'] },
    done: "“Eight lines, documented, in a warden's own hand. They'll hate it. Thank you.”" },

  { id: 's09', act: 3, giver: 'darrow', node: 'cindermarch', title: 'Ash and Glass',
    detail: 'The Slagways make a particular kind of ashsalt that Darrow cannot get any other way. Four measures.',
    goal: { kind: 'item', items: { ashsalt: 4, cinder_glass: 2 } }, reward: { coin: 450, items: ['emberheart'] },
    consumes: true,
    done: "“That's the stuff. Don't ask what I'm making.”" },

  { id: 's10', act: 4, giver: 'halla', node: 'windward', title: 'Thin Air',
    detail: 'Halla will not go above the Screes with the storm-things nesting there. Six of them, she says, and she has counted.',
    goal: { kind: 'defeat', count: 6, element: 'storm' }, reward: { coin: 800, items: ['stormring', 'panacea'] },
    done: "“Six. You counted the same as me. I like that in a person.”" },

  { id: 's11', act: 4, giver: 'halla', node: 'windward', title: 'Something That Remembers',
    detail: 'Halla has never seen a Skyward up close and does not believe you have one. Show her a Skyward grown to Wyrm.',
    goal: { kind: 'own', count: 1, lineage: 'skyward', stage: 'wyrm' }, reward: { coin: 900, items: ['surge_idol'] },
    done: "“Right. Well. I've been wrong about one thing today, which is my limit.”" },

  { id: 's12', act: 5, giver: 'kessa', node: 'cindermarch', title: 'For Afterwards',
    detail: 'Whatever you decide down there, Kessa wants the five Elder lines alive and in your hands first. All five.',
    goal: { kind: 'own', count: 5, elderSpread: true }, reward: { coin: 2000, items: ['hearth_ember', 'full_salve', 'elder_snare'] },
    done: "“Five lines, alive, in one place, for the first time in a hundred and four years. Whatever you choose now, that stands.”" },
];

export const questById = id =>
  MAIN_CHAIN.find(q => q.id === id) || SIDE_QUESTS.find(q => q.id === id) || null;
