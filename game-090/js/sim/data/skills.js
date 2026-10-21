// Every skill in the game. A skill is data: the battle engine reads these fields.
//   kind  atk | heal | revive | cure | buff | debuff | ail | scan | charge | focus | dispel | pass
//   el    strike gun pyre rime volt gale lumen hex root (atk only)
//   pow   atk: power (40 is a plain hit); heal: percent of max HP
//   mp / hp  cost: MP, or a percent of max HP (physical skills bleed the user)
//   tgt   one | all | rand | self | ally | allies   (one/all/rand are foes; ally/allies are the user's side)
//   hits  [min, max] for rand / multi-hit
//   acc   accuracy %, crit bonus crit %, ail {k, p}: an ailment and its chance %
//   stat  atk | def | agi with stage ±1 for buff / debuff, pass {k, el, v} for passives
//   unique: cannot be passed on by splicing (boss and signature skills)

export const SKILLS = {};
const add = (id, name, o) => { SKILLS[id] = { id, name, acc: 95, crit: 0, hits: [1, 1], mp: 0, hp: 0, ...o }; };

// ---------------------------------------------------------------- physical and gun
add('attack', 'Attack', { kind: 'atk', el: 'strike', pow: 28, tgt: 'one', acc: 96, desc: 'A plain strike.' });
add('slash', 'Slash', { kind: 'atk', el: 'strike', pow: 30, tgt: 'one', desc: 'A plain blade cut.' });
add('bash', 'Bash', { kind: 'atk', el: 'strike', pow: 36, tgt: 'one', hp: 3, acc: 92, desc: 'A hard shoulder-charge.' });
add('heavyswing', 'Heavy Swing', { kind: 'atk', el: 'strike', pow: 62, tgt: 'one', hp: 6, acc: 88, desc: 'A wide, slow blow.' });
add('cleave', 'Cleave', { kind: 'atk', el: 'strike', pow: 44, tgt: 'all', hp: 9, acc: 92, desc: 'Cuts every foe.' });
add('twinfang', 'Twin Fang', { kind: 'atk', el: 'strike', pow: 26, tgt: 'rand', hits: [2, 3], hp: 7, desc: 'Two or three quick bites at random foes.' });
add('rampage', 'Rampage', { kind: 'atk', el: 'strike', pow: 24, tgt: 'rand', hits: [3, 5], hp: 12, acc: 90, desc: 'Three to five wild blows.' });
add('rend', 'Rend', { kind: 'atk', el: 'strike', pow: 98, tgt: 'one', hp: 15, acc: 85, crit: 12, desc: 'Tears through armor and code.' });
add('quake', 'Quake Stomp', { kind: 'atk', el: 'strike', pow: 70, tgt: 'all', hp: 16, acc: 90, desc: 'The floor itself hits every foe.' });
add('pierce', 'Pierce', { kind: 'atk', el: 'strike', pow: 52, tgt: 'one', hp: 5, crit: 25, desc: 'A thrust that finds the seam.' });
add('snapshot', 'Snap Shot', { kind: 'atk', el: 'gun', pow: 28, tgt: 'one', acc: 96, desc: 'A quick shot from the sidearm.' });
add('burstfire', 'Burst Fire', { kind: 'atk', el: 'gun', pow: 22, tgt: 'rand', hits: [3, 4], hp: 6, acc: 90, desc: 'Sprays three or four rounds.' });
add('deadeye', 'Dead Eye', { kind: 'atk', el: 'gun', pow: 84, tgt: 'one', hp: 10, acc: 90, crit: 30, desc: 'One careful, ruinous shot.' });
add('suppress', 'Suppress', { kind: 'atk', el: 'gun', pow: 38, tgt: 'all', hp: 8, acc: 92, desc: 'Pins down every foe.' });

// ---------------------------------------------------------------- elemental spells: four tiers each
const line = (el, names) => {
    const [a, b, c, d] = names;
    add(a[0], a[1], { kind: 'atk', el, pow: 36, mp: 4, tgt: 'one', desc: a[2] });
    add(b[0], b[1], { kind: 'atk', el, pow: 62, mp: 9, tgt: 'one', desc: b[2] });
    add(c[0], c[1], { kind: 'atk', el, pow: 52, mp: 16, tgt: 'all', desc: c[2] });
    add(d[0], d[1], { kind: 'atk', el, pow: 108, mp: 24, tgt: 'one', desc: d[2] });
};
line('pyre', [['cinder', 'Cinder', 'A spit of flame.'], ['blaze', 'Blaze', 'A roaring column of fire.'], ['pyrewave', 'Pyrewave', 'Fire washes over every foe.'], ['inferno', 'Inferno', 'The world burns for a moment.']]);
line('rime', [['frostbite', 'Frostbite', 'A snap of cold.'], ['glacier', 'Glacier', 'A spear of ice.'], ['whiteout', 'Whiteout', 'A blizzard for every foe.'], ['zerohour', 'Zero Hour', 'Everything stops moving.']]);
line('volt', [['spark', 'Spark', 'A crack of current.'], ['arclance', 'Arc Lance', 'A lance of lightning.'], ['stormfront', 'Stormfront', 'Lightning finds every foe.'], ['thunderprotocol', 'Thunder Protocol', 'The grid answers in full.']]);
line('gale', [['gust', 'Gust', 'A cutting breeze.'], ['cutter', 'Cutter', 'A blade of wind.'], ['cyclone', 'Cyclone', 'A whirlwind round every foe.'], ['tempestcore', 'Tempest Core', 'The sky comes down.']]);
line('lumen', [['glimmer', 'Glimmer', 'A flash of clean light.'], ['radiance', 'Radiance', 'A beam of morning.'], ['sunburst', 'Sunburst', 'Dawn on every foe.'], ['daybreak', 'Daybreak', 'The sun, briefly, indoors.']]);
line('hex', [['glitch', 'Glitch', 'A stutter in the code.'], ['corrupt', 'Corrupt', 'Rewrites a foe badly.'], ['blight', 'Blight', 'Rot spreads to every foe.'], ['nullpointer', 'Null Pointer', 'Points at nothing, and nothing answers.']]);
SKILLS.glitch.ail = { k: 'lag', p: 8 };
SKILLS.corrupt.ail = { k: 'rot', p: 15 };
SKILLS.blight.ail = { k: 'rot', p: 15 };
SKILLS.frostbite.ail = { k: 'lag', p: 6 };
SKILLS.zerohour.ail = { k: 'lag', p: 25 };
SKILLS.spark.ail = { k: 'hush', p: 8 };
SKILLS.arclance.ail = { k: 'hush', p: 12 };
SKILLS.glimmer.ail = { k: 'panic', p: 6 };
add('rootburst', 'Root Burst', { kind: 'atk', el: 'root', pow: 60, mp: 14, tgt: 'one', acc: 100, desc: 'Raw root access. Nothing resists it.' });
add('overwrite', 'Overwrite', { kind: 'atk', el: 'root', pow: 80, mp: 22, tgt: 'all', acc: 100, desc: 'Rewrites everything in reach.' });

// ---------------------------------------------------------------- healing
add('mend', 'Mend', { kind: 'heal', pow: 30, mp: 5, tgt: 'ally', desc: 'Heals one ally by 30%.' });
add('mendplus', 'Mend Plus', { kind: 'heal', pow: 60, mp: 11, tgt: 'ally', desc: 'Heals one ally by 60%.' });
add('mendall', 'Mend All', { kind: 'heal', pow: 30, mp: 15, tgt: 'allies', desc: 'Heals the whole party by 30%.' });
add('fullbloom', 'Full Bloom', { kind: 'heal', pow: 100, mp: 22, tgt: 'ally', desc: 'Restores one ally.' });
add('wholegrove', 'Whole Grove', { kind: 'heal', pow: 70, mp: 30, tgt: 'allies', desc: 'Heals the party by 70%.' });
add('reseed', 'Reseed', { kind: 'revive', pow: 50, mp: 18, tgt: 'ally', desc: 'Revives a fallen ally at half HP.' });
add('rebloom', 'Rebloom', { kind: 'revive', pow: 100, mp: 34, tgt: 'ally', desc: 'Revives a fallen ally fully.' });
add('purge', 'Purge', { kind: 'cure', mp: 6, tgt: 'ally', desc: 'Clears an ally of ailments.' });
add('dispel', 'Dispel', { kind: 'dispel', mp: 6, tgt: 'one', desc: 'Strips every buff and debuff from a foe.' });

// ---------------------------------------------------------------- buffs and debuffs
add('overclock', 'Overclock', { kind: 'buff', stat: 'atk', stage: 1, mp: 6, tgt: 'ally', desc: 'Raises an ally\'s attack.' });
add('fortify', 'Fortify', { kind: 'buff', stat: 'def', stage: 1, mp: 6, tgt: 'ally', desc: 'Raises an ally\'s defense.' });
add('sync', 'Sync', { kind: 'buff', stat: 'agi', stage: 1, mp: 6, tgt: 'ally', desc: 'Raises an ally\'s speed and aim.' });
add('surge', 'Surge', { kind: 'buff', stat: 'atk', stage: 1, mp: 14, tgt: 'allies', desc: 'Raises the party\'s attack.' });
add('hardwall', 'Hardwall', { kind: 'buff', stat: 'def', stage: 1, mp: 14, tgt: 'allies', desc: 'Raises the party\'s defense.' });
add('hyperspeed', 'Hyperspeed', { kind: 'buff', stat: 'agi', stage: 1, mp: 14, tgt: 'allies', desc: 'Raises the party\'s speed.' });
add('throttle', 'Throttle', { kind: 'debuff', stat: 'atk', stage: -1, mp: 6, tgt: 'one', desc: 'Lowers a foe\'s attack.' });
add('corrode', 'Corrode', { kind: 'debuff', stat: 'def', stage: -1, mp: 6, tgt: 'one', desc: 'Lowers a foe\'s defense.' });
add('jam', 'Jam', { kind: 'debuff', stat: 'agi', stage: -1, mp: 6, tgt: 'one', desc: 'Lowers a foe\'s speed and aim.' });
add('nerfall', 'Nerf All', { kind: 'debuff', stat: 'def', stage: -1, mp: 14, tgt: 'all', desc: 'Lowers every foe\'s defense.' });

// ---------------------------------------------------------------- ailments
add('lagspike', 'Lagspike', { kind: 'ail', ail: { k: 'lag', p: 45 }, mp: 7, tgt: 'one', desc: 'May freeze a foe\'s next turn.' });
add('masslag', 'Mass Lag', { kind: 'ail', ail: { k: 'lag', p: 25 }, mp: 16, tgt: 'all', desc: 'May freeze every foe.' });
add('rotseed', 'Rotseed', { kind: 'ail', ail: { k: 'rot', p: 55 }, mp: 7, tgt: 'one', desc: 'Plants a rot that bleeds HP each turn.' });
add('hushfield', 'Hush Field', { kind: 'ail', ail: { k: 'hush', p: 55 }, mp: 7, tgt: 'one', desc: 'Seals a foe\'s skills.' });
add('fogbomb', 'Fog Bomb', { kind: 'ail', ail: { k: 'panic', p: 55 }, mp: 7, tgt: 'one', desc: 'A foe lashes out at random.' });

// ---------------------------------------------------------------- support
add('scan', 'Scan', { kind: 'scan', mp: 3, tgt: 'one', acc: 100, desc: 'Reveals a foe\'s affinities and personality.' });
add('charge', 'Charge', { kind: 'charge', mp: 6, tgt: 'self', desc: 'The next physical hit does 2.2×.' });
add('focus', 'Focus', { kind: 'focus', mp: 6, tgt: 'self', desc: 'The next spell does 2.2×.' });

// ---------------------------------------------------------------- unique (boss and signature) skills
add('railcollapse', 'Rail Collapse', { kind: 'atk', el: 'strike', pow: 54, tgt: 'all', acc: 95, unique: true, desc: 'The ceiling comes down.' });
add('overgrowth', 'Overgrowth', { kind: 'atk', el: 'gale', pow: 58, mp: 16, tgt: 'all', unique: true, ail: { k: 'rot', p: 25 }, desc: 'Vines everywhere, all at once.' });
add('verdictbeam', 'Verdict Beam', { kind: 'atk', el: 'lumen', pow: 96, mp: 20, tgt: 'one', unique: true, ail: { k: 'hush', p: 25 }, desc: 'Judgement, in a single colour.' });
add('undertow', 'Undertow', { kind: 'atk', el: 'rime', pow: 74, mp: 18, tgt: 'all', unique: true, desc: 'The flood remembers every door.' });
add('windshear', 'Windshear', { kind: 'atk', el: 'gale', pow: 100, mp: 22, tgt: 'one', unique: true, crit: 20, desc: 'A turbine blade of pure air.' });
add('prune', 'Prune', { kind: 'atk', el: 'hex', pow: 92, mp: 20, tgt: 'one', unique: true, ail: { k: 'lag', p: 30 }, desc: 'Cuts away whatever is not essential.' });
add('meridianbeam', 'Meridian Beam', { kind: 'atk', el: 'root', pow: 86, mp: 30, tgt: 'all', unique: true, desc: 'The lattice fires.' });
add('hexfall', 'Hexfall', { kind: 'atk', el: 'hex', pow: 70, mp: 26, tgt: 'all', unique: true, ail: { k: 'panic', p: 25 }, desc: 'The corruption comes down like rain.' });
add('garden', 'Garden of Static', { kind: 'heal', pow: 40, mp: 20, tgt: 'allies', unique: true, desc: 'Heals everyone, even the broken.' });
add('checksum', 'Checksum', { kind: 'atk', el: 'volt', pow: 66, mp: 14, tgt: 'one', unique: true, ail: { k: 'hush', p: 35 }, desc: 'Verifies you. Badly.' });
add('lullaby', 'Lullaby', { kind: 'ail', ail: { k: 'lag', p: 60 }, mp: 12, tgt: 'all', unique: true, desc: 'An old tune; everyone loses the thread.' });

// ---------------------------------------------------------------- passives
const pass = (id, name, desc, p) => add(id, name, { kind: 'pass', pass: p, desc, tgt: 'self' });
for (const [el, nm] of [['strike', 'Strike'], ['gun', 'Gun'], ['pyre', 'Pyre'], ['rime', 'Rime'], ['volt', 'Volt'], ['gale', 'Gale'], ['lumen', 'Lumen'], ['hex', 'Hex']]) {
    pass('amp' + el, nm + ' Amp', `${nm} skills hit 25% harder.`, { k: 'amp', el });
}
for (const [el, nm] of [['pyre', 'Pyre'], ['rime', 'Rime'], ['volt', 'Volt'], ['gale', 'Gale'], ['lumen', 'Lumen'], ['hex', 'Hex'], ['strike', 'Strike']]) {
    pass('ward' + el, nm + ' Ward', `Takes less ${nm} damage (one step: weak → neutral → resist → null).`, { k: 'ward', el });
}
pass('photosynth', 'Photosynth', 'Heals 5% HP at the start of its turn.', { k: 'regen', v: 0.05 });
pass('endure', 'Endure', 'Survives one lethal blow per battle with 1 HP.', { k: 'endure' });
pass('counter', 'Counter', '25% chance to strike back at a physical hit.', { k: 'counter', v: 0.25 });
pass('vital', 'Vital', '+15% max HP.', { k: 'vital', v: 0.15 });
pass('keeneye', 'Keen Eye', 'Critical hits come more often.', { k: 'keen', v: 12 });
pass('dodge', 'Dodge', 'Enemy attacks miss more often.', { k: 'dodge', v: 10 });
pass('mindsap', 'Mind Sap', 'Regains 2 MP at the start of its turn.', { k: 'mpregen', v: 2 });

export const AILMENTS = {
    lag: { name: 'Lag', desc: 'Loses its next action.', turns: 1 },
    rot: { name: 'Rot', desc: 'Loses 6% HP each turn.', turns: 4 },
    hush: { name: 'Hush', desc: 'Cannot use skills.', turns: 3 },
    panic: { name: 'Panic', desc: 'Attacks at random.', turns: 3 },
};

export const skillList = () => Object.values(SKILLS);
