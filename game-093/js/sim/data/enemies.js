// Monsters, bosses, their moves and where they roam. Pure data plus the stat curve.

const M = (id, name, o) => ({ id, name, mp: 0, tgt: 'one', kind: 'phys', pow: 1, type: null, hits: 1, sh: 0, enemy: true, ...o });

export const MOVES = Object.fromEntries([
    M('tackle', 'Tackle', { pow: 1.0 }), M('bite', 'Bite', { pow: 1.1, vfx: 'claw' }), M('claw', 'Claw', { pow: 1.15, vfx: 'claw' }),
    M('club', 'Club Smash', { pow: 1.25, vfx: 'impact' }), M('slam', 'Slam', { pow: 1.45, vfx: 'impact' }),
    M('poisonBite', 'Venom Bite', { pow: 0.9, st: [['poison', 0.55, 4]], vfx: 'claw' }), M('sting', 'Sting', { pow: 0.9, st: [['poison', 0.6, 4]], vfx: 'claw' }),
    M('howl', 'Howl', { kind: 'buff', tgt: 'self', st: [['atkUp', 1, 3]], vfx: 'buff' }),
    M('spores', 'Spore Cloud', { kind: 'mag', tgt: 'all', pow: 0.55, st: [['poison', 0.45, 4]], vfx: 'poison' }),
    M('sonic', 'Sonic Wail', { kind: 'mag', tgt: 'all', pow: 0.5, st: [['sleep', 0.35, 2]], vfx: 'wind' }),
    M('fireball', 'Fireball', { kind: 'mag', pow: 1.4, type: 'fire', vfx: 'fire' }), M('iceShard', 'Ice Shard', { kind: 'mag', pow: 1.4, type: 'ice', vfx: 'ice' }),
    M('zap', 'Zap', { kind: 'mag', pow: 1.4, type: 'thunder', vfx: 'thunder' }), M('windBlade', 'Wind Blade', { kind: 'mag', pow: 1.4, type: 'wind', vfx: 'wind' }),
    M('shadowBolt', 'Shadow Bolt', { kind: 'mag', pow: 1.5, type: 'dark', vfx: 'dark' }),
    M('fireBreath', 'Fire Breath', { kind: 'mag', tgt: 'all', pow: 1.0, type: 'fire', vfx: 'fire' }), M('frostBreath', 'Frost Breath', { kind: 'mag', tgt: 'all', pow: 1.0, type: 'ice', vfx: 'ice' }),
    M('leech', 'Life Leech', { kind: 'mag', pow: 1.2, type: 'dark', fx: 'drain', vfx: 'dark' }),
    M('curse', 'Curse', { kind: 'util', st: [['atkDown', 0.8, 3]], vfx: 'debuff' }), M('weaken', 'Weaken', { kind: 'util', st: [['defDown', 0.8, 3]], vfx: 'debuff' }),
    M('lullabye', 'Lullaby', { kind: 'util', tgt: 'all', st: [['sleep', 0.4, 2]], vfx: 'sleep' }),
    M('stoneSkin', 'Stoneskin', { kind: 'buff', tgt: 'self', st: [['defUp', 1, 3]], vfx: 'buff' }),
    M('guardUp', 'Brace', { kind: 'buff', tgt: 'self', st: [['defUp', 1, 2]], vfx: 'buff' }),
    M('rend', 'Rend', { pow: 1.0, hits: 2, vfx: 'claw' }), M('flurryClaws', 'Flurry', { pow: 0.7, hits: 3, vfx: 'claw' }),
    M('mark', 'Hunter\'s Mark', { kind: 'util', st: [['mark', 1, 3]], vfx: 'debuff' }),
    // bosses
    M('rootBind', 'Root Bind', { kind: 'util', tgt: 'all', st: [['slow', 0.8, 3]], vfx: 'debuff' }), M('thornVolley', 'Thorn Volley', { tgt: 'all', pow: 0.8, vfx: 'arrow' }),
    M('barkSmash', 'Bark Smash', { pow: 1.7, vfx: 'impact' }), M('naturesWrath', 'Nature\'s Wrath', { kind: 'mag', tgt: 'all', pow: 1.7, type: 'wind', charge: 1, vfx: 'wind', warn: 'Roots writhe beneath the party...' }),
    M('rockThrow', 'Boulder Throw', { pow: 1.6, vfx: 'impact' }), M('earthSlam', 'Earth Slam', { tgt: 'all', pow: 1.0, vfx: 'quake' }),
    M('boulderRain', 'Boulder Rain', { tgt: 'all', pow: 1.9, charge: 1, vfx: 'quake', warn: 'The ceiling shudders...' }),
    M('lash', 'Tentacle Lash', { pow: 0.85, hits: 3, vfx: 'claw' }), M('inkCloud', 'Ink Cloud', { kind: 'util', tgt: 'all', st: [['atkDown', 0.9, 3]], vfx: 'debuff' }),
    M('tidalCrush', 'Tidal Crush', { kind: 'mag', pow: 1.9, type: 'ice', vfx: 'ice' }),
    M('whirlpool', 'Maelstrom', { kind: 'mag', tgt: 'all', pow: 1.9, type: 'ice', charge: 1, vfx: 'ice', warn: 'The sea itself coils...' }),
    M('sandBlast', 'Sand Blast', { kind: 'mag', tgt: 'all', pow: 1.0, type: 'wind', vfx: 'wind' }), M('curseOfRa', 'Curse of Ra', { kind: 'util', tgt: 'all', st: [['atkDown', 0.8, 3], ['defDown', 0.5, 3]], vfx: 'debuff' }),
    M('sunBeam', 'Sun Beam', { kind: 'mag', pow: 2.0, type: 'fire', vfx: 'fire' }), M('mummyWrap', 'Mummy Wrap', { pow: 0.8, st: [['sleep', 0.6, 2]], vfx: 'claw' }),
    M('solarFlare', 'Solar Flare', { kind: 'mag', tgt: 'all', pow: 2.1, type: 'fire', charge: 1, vfx: 'sun', warn: 'The Sun-King raises his scepter to the sky...' }),
    M('wingGale', 'Wing Gale', { kind: 'mag', tgt: 'all', pow: 1.1, type: 'wind', vfx: 'wind' }), M('frostBite', 'Frostbite', { pow: 1.7, type: 'ice', st: [['slow', 0.5, 3]], vfx: 'claw' }),
    M('blizzardStorm', 'Blizzard Storm', { kind: 'mag', tgt: 'all', pow: 2.2, type: 'ice', charge: 2, vfx: 'ice', warn: 'A white storm gathers above the wyrm...' }),
    M('shadowSlash', 'Shadow Slash', { pow: 1.6, type: 'dark', vfx: 'slash' }), M('hollowStrike', 'Hollow Strike', { pow: 2.0, hits: 2, vfx: 'slash' }),
    M('soulDrain', 'Soul Drain', { kind: 'mag', tgt: 'all', pow: 0.9, type: 'dark', fx: 'drain', vfx: 'dark' }),
    M('darkBlades', 'Dark Blades', { kind: 'mag', tgt: 'rand', hits: 4, pow: 0.9, type: 'dark', vfx: 'dark' }),
    M('voidNova', 'Void Nova', { kind: 'mag', tgt: 'all', pow: 2.4, type: 'dark', charge: 2, vfx: 'rift', warn: 'Malachar gathers the void into his palm...' }),
    M('ruin', 'Ruin', { kind: 'mag', tgt: 'all', pow: 1.5, type: 'dark', vfx: 'dark' }),
    M('heraldStrike', 'Herald\'s Judgment', { pow: 1.5, vfx: 'slash' }),
    M('meteorStrike', 'Meteor Strike', { kind: 'mag', tgt: 'all', pow: 2.3, type: 'fire', charge: 1, vfx: 'meteor', warn: 'The sky glows red...' }),
    M('inferno', 'Inferno', { kind: 'mag', tgt: 'all', pow: 1.7, type: 'fire', vfx: 'fire' }), M('magmaFist', 'Magma Fist', { pow: 2.0, type: 'fire', vfx: 'impact' }),
].map((m) => [m.id, m]));

const E = (id, name, o) => ({
    id, name, sprite: id, pal: 'base', hpm: 1, atkm: 1, magm: 1, defm: 1, resm: 1, spdm: 1, shield: 2, weak: [], resist: [], moves: [], xpm: 1, gold: 1,
    mat: null, drops: [], steal: null, scale: 1, boss: false, aggro: 1, ...o,
});
const mv = (...a) => a.map(([m, w, c]) => ({ m, w, c }));

export const ENEMIES = Object.fromEntries([
    E('slime', 'Green Slime', { hpm: 0.8, atkm: 0.8, shield: 2, weak: ['fire', 'axe'], resist: ['ice'], moves: mv(['tackle', 3], ['spores', 1]), mat: 'slimeGel', drops: [['potion', 0.12]], steal: 'potion', xpm: 0.8, gold: 0.7 }),
    E('slimeBlue', 'Blue Slime', { sprite: 'slime', pal: 'blue', hpm: 0.9, atkm: 0.9, shield: 2, weak: ['fire', 'thunder'], resist: ['ice'], moves: mv(['tackle', 3], ['iceShard', 1]), mat: 'slimeGel', drops: [['ether', 0.08]], xpm: 0.9 }),
    E('bat', 'Cave Bat', { hpm: 0.7, atkm: 0.9, spdm: 1.5, shield: 2, weak: ['thunder', 'wind', 'bow'], moves: mv(['bite', 3], ['sonic', 1]), mat: 'batWing', xpm: 0.8, scale: 0.85 }),
    E('wolf', 'Dire Wolf', { hpm: 1.0, atkm: 1.15, spdm: 1.3, shield: 3, weak: ['fire', 'spear', 'ice'], moves: mv(['bite', 3], ['howl', 1, 'noBuff'], ['rend', 1]), mat: 'wolfPelt', drops: [['wolfPelt', 0.3]], steal: 'wolfPelt', xpm: 1.1 }),
    E('goblin', 'Goblin', { hpm: 1.0, atkm: 1.05, shield: 3, weak: ['sword', 'axe', 'dark'], moves: mv(['club', 3], ['tackle', 2]), mat: 'goblinEar', drops: [['potion', 0.15], ['goblinEar', 0.35]], steal: 'hiPotion', xpm: 1.0, gold: 1.3 }),
    E('goblinChief', 'Goblin Brute', { sprite: 'goblin', pal: 'red', hpm: 1.6, atkm: 1.25, shield: 4, weak: ['sword', 'ice'], moves: mv(['club', 3], ['slam', 2], ['howl', 1, 'noBuff']), mat: 'goblinEar', drops: [['hiPotion', 0.15]], xpm: 1.6, gold: 2, scale: 1.15 }),
    E('shroom', 'Spore Cap', { hpm: 1.1, atkm: 0.9, magm: 1.1, shield: 3, weak: ['fire', 'axe', 'wind'], resist: ['dark'], moves: mv(['tackle', 2], ['spores', 2]), mat: 'spore', drops: [['antidote', 0.2], ['spore', 0.3]], steal: 'antidote', xpm: 1.0 }),
    E('sapling', 'Thorn Sapling', { hpm: 1.4, defm: 1.1, shield: 3, weak: ['fire', 'axe'], resist: ['thunder'], moves: mv(['thornVolley', 1], ['tackle', 2]), mat: 'herbBundle', drops: [['herbBundle', 0.3]], xpm: 1.2, scale: 1.1 }),
    E('skeleton', 'Skeleton', { hpm: 1.0, atkm: 1.15, defm: 1.0, shield: 3, weak: ['holy', 'fire', 'axe'], resist: ['dark', 'dagger', 'bow'], moves: mv(['rend', 3], ['curse', 1]), mat: 'boneDust', drops: [['boneDust', 0.4]], steal: 'phoenixDown', xpm: 1.1 }),
    E('golem', 'Rock Golem', { hpm: 2.0, atkm: 1.2, defm: 1.7, resm: 0.8, spdm: 0.55, shield: 4, weak: ['ice', 'wind', 'axe'], resist: ['sword', 'dagger', 'bow', 'fire'], moves: mv(['slam', 3], ['stoneSkin', 1, 'noBuff'], ['rockThrow', 1]), mat: 'stoneHeart', drops: [['stoneHeart', 0.3]], xpm: 1.7, gold: 1.4, scale: 1.3 }),
    E('kobold', 'Mine Kobold', { sprite: 'goblin', pal: 'blue', hpm: 0.9, atkm: 1.1, spdm: 1.2, shield: 3, weak: ['holy', 'spear', 'fire'], moves: mv(['club', 2], ['flurryClaws', 2]), mat: 'goblinEar', drops: [['gleamStone', 0.04], ['ether', 0.1]], steal: 'ether', xpm: 1.1 }),
    E('crab', 'Rock Crab', { hpm: 1.2, defm: 1.5, shield: 4, weak: ['thunder', 'spear', 'ice'], resist: ['fire', 'sword'], moves: mv(['claw', 3], ['guardUp', 1, 'noBuff'], ['rend', 1]), mat: 'crabClaw', drops: [['crabClaw', 0.4]], xpm: 1.2 }),
    E('jelly', 'Drift Jelly', { hpm: 1.0, magm: 1.3, shield: 3, weak: ['thunder', 'fire', 'wind'], resist: ['ice'], moves: mv(['zap', 2], ['sting', 2]), mat: 'slimeGel', drops: [['ether', 0.12]], xpm: 1.1 }),
    E('naga', 'Tide Naga', { hpm: 1.3, atkm: 1.15, magm: 1.2, shield: 4, weak: ['thunder', 'spear', 'wind'], resist: ['ice'], moves: mv(['claw', 2], ['iceShard', 2], ['lullabye', 1]), mat: 'crabClaw', drops: [['hiPotion', 0.15]], steal: 'hiEther', xpm: 1.5, scale: 1.15 }),
    E('wisp', 'Will-o-Wisp', { hpm: 0.8, magm: 1.4, defm: 0.6, resm: 1.2, shield: 2, weak: ['holy', 'wind', 'dark'], resist: ['sword', 'axe', 'dagger', 'spear', 'bow', 'fire'], moves: mv(['fireball', 3], ['curse', 1]), mat: 'wispDust', drops: [['wispDust', 0.4]], xpm: 1.3, scale: 0.9 }),
    E('scorpion', 'Sand Scorpion', { hpm: 1.2, atkm: 1.25, defm: 1.3, shield: 3, weak: ['ice', 'bow', 'wind'], moves: mv(['sting', 3], ['claw', 2]), mat: 'scorpTail', drops: [['scorpTail', 0.35], ['antidote', 0.15]], xpm: 1.3 }),
    E('cobra', 'Dune Cobra', { hpm: 0.9, atkm: 1.2, spdm: 1.4, shield: 3, weak: ['ice', 'spear', 'axe'], moves: mv(['poisonBite', 3], ['lullabye', 1]), mat: 'scorpTail', xpm: 1.2 }),
    E('mummy', 'Linen Mummy', { hpm: 1.5, atkm: 1.1, magm: 1.0, shield: 4, weak: ['fire', 'holy'], resist: ['dark', 'ice'], moves: mv(['mummyWrap', 2], ['curse', 1], ['club', 2]), mat: 'boneDust', drops: [['ancientCoin', 0.1], ['phoenixDown', 0.1]], steal: 'ancientCoin', xpm: 1.5, gold: 1.8 }),
    E('harpy', 'Harpy', { hpm: 0.9, atkm: 1.1, spdm: 1.45, shield: 2, weak: ['bow', 'thunder', 'ice'], moves: mv(['claw', 2], ['windBlade', 2], ['sonic', 1]), mat: 'harpyFeather', drops: [['harpyFeather', 0.35]], xpm: 1.2 }),
    E('yeti', 'Frost Yeti', { hpm: 1.8, atkm: 1.3, defm: 1.2, spdm: 0.8, shield: 4, weak: ['fire', 'holy', 'axe'], resist: ['ice'], moves: mv(['slam', 3], ['frostBreath', 1], ['howl', 1, 'noBuff']), mat: 'frostShard', drops: [['frostShard', 0.35]], xpm: 1.7, gold: 1.4, scale: 1.25 }),
    E('iceSprite', 'Ice Sprite', { sprite: 'wisp', pal: 'ice', hpm: 0.9, magm: 1.4, shield: 3, weak: ['fire', 'holy'], resist: ['ice'], moves: mv(['iceShard', 3], ['frostBreath', 1]), mat: 'frostShard', drops: [['frostShard', 0.35], ['hiEther', 0.04]], xpm: 1.4 }),
    E('frostWolf', 'Frost Wolf', { sprite: 'wolf', pal: 'ice', hpm: 1.2, atkm: 1.3, spdm: 1.3, shield: 4, weak: ['fire', 'spear', 'holy'], resist: ['ice'], moves: mv(['bite', 3], ['frostBite', 2], ['howl', 1, 'noBuff']), mat: 'wolfPelt', drops: [['wolfPelt', 0.3]], xpm: 1.4 }),
    E('hollowKnight', 'Hollow Knight', { sprite: 'knight', hpm: 1.7, atkm: 1.35, defm: 1.5, shield: 5, weak: ['thunder', 'holy', 'axe'], resist: ['sword', 'spear', 'dark'], moves: mv(['hollowStrike', 2], ['shadowSlash', 2], ['guardUp', 1, 'noBuff']), mat: 'boneDust', drops: [['hiPotion', 0.2], ['phoenixDown', 0.1]], xpm: 2.0, gold: 2, scale: 1.2 }),
    E('imp', 'Hollow Imp', { hpm: 0.9, magm: 1.4, spdm: 1.35, shield: 3, weak: ['holy', 'sword', 'wind'], resist: ['dark', 'fire'], moves: mv(['fireball', 2], ['shadowBolt', 2], ['curse', 1]), mat: 'emberCore', drops: [['emberCore', 0.3], ['hiEther', 0.06]], steal: 'hiEther', xpm: 1.5 }),
    E('drake', 'Ashen Drakeling', { hpm: 1.7, atkm: 1.3, magm: 1.2, defm: 1.2, shield: 4, weak: ['ice', 'bow', 'spear'], resist: ['fire'], moves: mv(['claw', 2], ['fireBreath', 2], ['slam', 1]), mat: 'drakeScale', drops: [['drakeScale', 0.3], ['xPotion', 0.08]], xpm: 2.2, gold: 2, scale: 1.3 }),
    E('shade', 'Hollow Shade', { hpm: 1.1, magm: 1.4, defm: 0.8, resm: 1.3, shield: 3, weak: ['holy'], resist: ['dark', 'sword', 'axe', 'spear', 'dagger'], moves: mv(['shadowBolt', 3], ['leech', 2], ['curse', 1]), mat: 'wispDust', drops: [['wispDust', 0.3], ['hiEther', 0.08]], xpm: 1.8 }),
    E('gargoyle', 'Gargoyle', { hpm: 1.6, atkm: 1.35, defm: 1.6, spdm: 0.9, shield: 4, weak: ['axe', 'thunder', 'ice'], resist: ['sword', 'dark', 'fire'], moves: mv(['slam', 3], ['claw', 2], ['stoneSkin', 1, 'noBuff']), mat: 'stoneHeart', drops: [['stoneHeart', 0.3], ['xPotion', 0.06]], xpm: 2.0, scale: 1.2 }),
    E('fiend', 'Hollow Fiend', { hpm: 2.0, atkm: 1.4, magm: 1.3, shield: 5, weak: ['holy', 'thunder'], resist: ['dark'], moves: mv(['hollowStrike', 2], ['ruin', 1], ['shadowBolt', 2], ['mark', 1, 'noMark']), mat: 'emberCore', drops: [['xPotion', 0.15], ['hiEther', 0.12], ['elixir', 0.03]], steal: 'elixir', xpm: 2.6, gold: 2.5, scale: 1.3 }),
    E('lavaSlime', 'Magma Slime', { sprite: 'slime', pal: 'red', hpm: 1.4, atkm: 1.2, shield: 3, weak: ['ice', 'wind'], resist: ['fire'], moves: mv(['tackle', 2], ['fireBreath', 1]), mat: 'emberCore', drops: [['emberCore', 0.3]], xpm: 1.5 }),
    E('salamander', 'Salamander', { sprite: 'drake', pal: 'red', hpm: 1.5, atkm: 1.4, shield: 4, weak: ['ice', 'bow'], resist: ['fire'], moves: mv(['claw', 2], ['inferno', 2]), mat: 'emberCore', drops: [['emberCore', 0.35], ['xPotion', 0.1]], xpm: 2.0 }),
    E('treeMinion', 'Rootling', { sprite: 'sapling', hpm: 0.6, atkm: 0.8, shield: 1, weak: ['fire', 'axe'], moves: mv(['tackle', 1]), mat: 'herbBundle', xpm: 0.3, gold: 0.2, scale: 0.8 }),
    // ---- bosses
    E('herald', 'Hollow Herald', { sprite: 'knight', pal: 'void', boss: true, hpm: 40, atkm: 0.7, magm: 0.7, defm: 1.5, resm: 1.5, spdm: 1.1, shield: 8, weak: ['holy'], moves: mv(['heraldStrike', 1], ['shadowBolt', 2], ['soulDrain', 1]), scale: 1.5, xpm: 0, gold: 0 }),
    E('gnarlroot', 'Gnarlroot, Elder Treant', { sprite: 'treant', boss: true, hpm: 7.5, atkm: 1.1, magm: 1.1, defm: 1.1, spdm: 0.8, shield: 6, weak: ['fire', 'axe', 'ice'], resist: ['thunder'], moves: mv(['barkSmash', 3], ['thornVolley', 2], ['rootBind', 1, 'noRoot'], ['naturesWrath', 2, 'phase2'], ['spores', 1]), xpm: 7, gold: 9, scale: 2.1, drops: [['hpSeed', 1]], phases: [{ hp: 0.5, say: 'THE WOODS... REMEMBER...', summon: ['treeMinion', 'treeMinion'], buff: ['atkUp'] }] }),
    E('boldur', 'Boldur, Granite Titan', { sprite: 'colossus', boss: true, hpm: 8.5, atkm: 1.15, defm: 1.6, resm: 1.0, spdm: 0.6, shield: 8, weak: ['wind', 'ice', 'axe'], resist: ['sword', 'dagger', 'fire'], moves: mv(['rockThrow', 2], ['earthSlam', 2], ['stoneSkin', 1, 'noBuff'], ['boulderRain', 2, 'phase2']), xpm: 7, gold: 12, scale: 2.3, drops: [['powerSeed', 1]], phases: [{ hp: 0.5, say: 'MOUNTAIN... DOES NOT... BREAK!', buff: ['atkUp'] }] }),
    E('kraken', 'Nerezza, the Abyssal Kraken', { sprite: 'kraken', boss: true, hpm: 8, magm: 1.25, atkm: 1.1, spdm: 1.0, shield: 8, weak: ['thunder', 'spear', 'wind'], resist: ['ice', 'fire'], moves: mv(['lash', 3], ['inkCloud', 1, 'noInk'], ['tidalCrush', 2], ['whirlpool', 2, 'phase2']), xpm: 7, gold: 14, scale: 2.4, drops: [['mpSeed', 1]], phases: [{ hp: 0.5, say: 'THE DEEP HUNGERS.', buff: ['atkUp'] }] }),
    E('pharaoh', 'Ra\'Khet, the Sun-King', { sprite: 'pharaoh', boss: true, hpm: 8, magm: 1.3, atkm: 1.1, shield: 9, weak: ['ice', 'holy', 'wind'], resist: ['fire', 'dark'], moves: mv(['sunBeam', 2], ['sandBlast', 2], ['mummyWrap', 1], ['curseOfRa', 1, 'noCurse'], ['solarFlare', 2, 'phase2']), xpm: 7, gold: 16, scale: 1.9, drops: [['hpSeed', 1]], phases: [{ hp: 0.5, say: 'KNEEL BEFORE THE SUN!', summon: ['mummy'], buff: ['atkUp'] }] }),
    E('wyrm', 'Glacivar, the Rime Wyrm', { sprite: 'wyrm', boss: true, hpm: 9, atkm: 1.2, magm: 1.25, defm: 1.2, shield: 10, weak: ['fire', 'bow', 'spear'], resist: ['ice', 'wind'], moves: mv(['frostBite', 2], ['wingGale', 2], ['frostBreath', 2], ['blizzardStorm', 2, 'phase2']), xpm: 7, gold: 18, scale: 2.5, drops: [['powerSeed', 1]], phases: [{ hp: 0.5, say: 'THE WINTER NEVER ENDS!', buff: ['atkUp'] }] }),
    E('warden', 'Warden Vael', { sprite: 'knight', pal: 'gold', boss: true, hpm: 6, atkm: 1.3, magm: 1.1, defm: 1.4, shield: 8, weak: ['thunder', 'holy'], resist: ['dark'], moves: mv(['hollowStrike', 3], ['shadowSlash', 2], ['mark', 1, 'noMark'], ['soulDrain', 1]), xpm: 5, gold: 10, scale: 1.7, drops: [['lanternKey', 1]] }),
    E('malachar', 'Malachar, the Hollow King', { sprite: 'king', boss: true, hpm: 11, atkm: 1.3, magm: 1.35, defm: 1.3, resm: 1.2, spdm: 1.1, shield: 10, weak: ['holy', 'thunder', 'fire'], resist: ['dark'], moves: mv(['shadowSlash', 2], ['hollowStrike', 2], ['darkBlades', 2], ['soulDrain', 1], ['voidNova', 2, 'phase2'], ['ruin', 1, 'phase2']), xpm: 20, gold: 50, scale: 2.4, phases: [{ hp: 0.66, say: 'You cannot kill what was never alive.', buff: ['atkUp'], shield: 10 }, { hp: 0.33, say: 'THEN LET THE LIGHT GO OUT FOR GOOD!', buff: ['atkUp', 'haste'], shield: 12 }] }),
    E('pyrelord', 'Ignaroth, the Pyrelord', { sprite: 'drake', pal: 'void', boss: true, hpm: 16, atkm: 1.5, magm: 1.5, defm: 1.5, shield: 14, weak: ['ice', 'bow', 'wind'], resist: ['fire', 'dark'], moves: mv(['magmaFist', 3], ['inferno', 2], ['fireBreath', 2], ['meteorStrike', 2, 'phase2']), xpm: 25, gold: 90, scale: 2.7, drops: [['c_dawn', 1]], phases: [{ hp: 0.5, say: 'BURN. BURN. BURN.', buff: ['atkUp', 'haste'] }] }),
    E('shadeLord', 'Hollow Shade Queen', { sprite: 'shade', pal: 'void', boss: true, hpm: 5, magm: 1.3, shield: 6, weak: ['holy'], resist: ['dark', 'sword', 'dagger'], moves: mv(['shadowBolt', 3], ['leech', 2], ['darkBlades', 1], ['curse', 1]), xpm: 4, gold: 6, scale: 1.8 }),
    E('docksBrute', 'Harbor Enforcer', { sprite: 'goblin', pal: 'red', boss: true, hpm: 5, atkm: 1.2, shield: 5, weak: ['dagger', 'thunder'], moves: mv(['club', 3], ['slam', 2], ['howl', 1, 'noBuff']), xpm: 3, gold: 8, scale: 1.5 }),
].map((e) => [e.id, e]));

/** Combat stats of a monster of this kind at this level. */
export function enemyStats(kind, lvl) {
    const e = ENEMIES[kind];
    return {
        hp: Math.round((20 + lvl * 14 + lvl * lvl * 0.62) * e.hpm),
        atk: Math.round((8 + lvl * 3.0) * e.atkm), mag: Math.round((8 + lvl * 2.9) * e.magm),
        def: Math.round((6 + lvl * 1.8) * e.defm), res: Math.round((6 + lvl * 1.7) * e.resm), spd: Math.round((8 + lvl * 0.55) * e.spdm),
    };
}
export function enemyXp(kind, lvl) { return Math.round((7 + lvl * 3.4 + lvl * lvl * 0.07) * ENEMIES[kind].xpm); }
export function enemyGold(kind, lvl) { return Math.round((4 + lvl * 2.1) * ENEMIES[kind].gold); }

/** Encounter zones: formations are lists of kinds; the level is picked from the zone's range. */
export const ZONES = {
    grass: { lvl: [2, 5], forms: [['slime', 'slime'], ['wolf'], ['goblin', 'goblin'], ['slime', 'bat'], ['wolf', 'wolf'], ['goblin', 'slime', 'slime']] },
    forest: { lvl: [3, 7], forms: [['wolf', 'wolf'], ['shroom', 'shroom'], ['goblin', 'wolf'], ['bat', 'bat', 'shroom'], ['sapling'], ['goblin', 'goblin', 'shroom']] },
    plains: { lvl: [6, 10], forms: [['wolf', 'wolf', 'goblin'], ['goblin', 'goblin', 'goblin'], ['shroom', 'slimeBlue', 'slimeBlue'], ['goblinChief', 'goblin'], ['harpy', 'harpy']] },
    mountain: { lvl: [9, 14], forms: [['golem'], ['kobold', 'kobold', 'bat'], ['harpy', 'harpy', 'kobold'], ['golem', 'kobold'], ['goblinChief', 'kobold', 'kobold']] },
    coast: { lvl: [13, 18], forms: [['crab', 'crab'], ['jelly', 'jelly', 'crab'], ['naga'], ['harpy', 'harpy', 'jelly'], ['naga', 'crab']] },
    desert: { lvl: [18, 24], forms: [['scorpion', 'scorpion'], ['cobra', 'cobra', 'scorpion'], ['mummy', 'scorpion'], ['harpy', 'harpy', 'cobra'], ['wisp', 'wisp', 'cobra']] },
    snow: { lvl: [24, 30], forms: [['frostWolf', 'frostWolf'], ['yeti'], ['iceSprite', 'iceSprite', 'frostWolf'], ['yeti', 'iceSprite'], ['frostWolf', 'frostWolf', 'iceSprite']] },
    ash: { lvl: [32, 38], forms: [['imp', 'imp', 'hollowKnight'], ['drake'], ['shade', 'shade', 'imp'], ['hollowKnight', 'gargoyle'], ['fiend']] },
    volcano: { lvl: [44, 50], forms: [['salamander', 'salamander'], ['lavaSlime', 'lavaSlime', 'salamander'], ['drake', 'drake'], ['fiend', 'salamander'], ['imp', 'imp', 'fiend']] },
    woods: { lvl: [4, 7], forms: [['wolf', 'shroom'], ['sapling', 'shroom'], ['goblin', 'goblin', 'wolf'], ['bat', 'bat', 'sapling'], ['shroom', 'shroom', 'shroom']] },
    mines: { lvl: [9, 13], forms: [['kobold', 'kobold', 'kobold'], ['golem', 'bat'], ['bat', 'bat', 'kobold'], ['skeleton', 'kobold'], ['goblinChief', 'kobold']] },
    temple: { lvl: [14, 18], forms: [['crab', 'jelly'], ['naga', 'jelly'], ['jelly', 'jelly', 'crab'], ['naga', 'naga'], ['skeleton', 'skeleton', 'jelly']] },
    pyramid: { lvl: [20, 25], forms: [['mummy', 'mummy'], ['scorpion', 'cobra', 'cobra'], ['skeleton', 'mummy'], ['wisp', 'wisp', 'mummy'], ['mummy', 'scorpion']] },
    glacier: { lvl: [26, 31], forms: [['yeti', 'iceSprite'], ['frostWolf', 'frostWolf', 'iceSprite'], ['hollowKnight'], ['iceSprite', 'iceSprite', 'iceSprite'], ['yeti', 'frostWolf']] },
    spire: { lvl: [34, 40], forms: [['hollowKnight', 'imp', 'imp'], ['fiend'], ['gargoyle', 'gargoyle'], ['shade', 'shade', 'hollowKnight'], ['drake', 'imp'], ['fiend', 'shade']] },
    maw: { lvl: [44, 50], forms: [['salamander', 'salamander', 'lavaSlime'], ['drake', 'drake'], ['fiend', 'fiend'], ['salamander', 'lavaSlime', 'lavaSlime', 'imp']] },
};
