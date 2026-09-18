// ============================================================
// data/bosses.js - the five act bosses and their fixed genomes (GDD 2.2)
// Bosses are hand-built dragons: the generator makes the world, but the
// things the story turns on are authored.
// ============================================================

export const BOSSES = {
  cinderfang: {
    id: 'cinderfang', name: 'Cinderfang', title: 'the Unfed', lineageId: 'ashbound', level: 11,
    elements: ['gloam', 'ember'], node: 'cinder_roost', act: 1,
    genes: { body: 'drake', wings: 'membrane', horns: 'swept', tail: 'spikes', crest: 'plates',
             pattern: 'mottled', hue: 276, hue2: 18, sat: 0.3, light: 0.4, eye: 12, size: 1.18 },
    essence: { hp: 12, mp: 6, atk: 13, mag: 8, def: 9, res: 7, spd: 10 },
    moves: ['strike_claw', 'ash_roar', 'gloamspit', 'cinder_spit', 'fearful_screech', 'stitched_howl'],
    traits: ['hollowed', 'keenhunter'], ashbound: true, hpMult: 2.7,
    intro: 'It has been eating the light out of this chimney for two years. It does not look up when you come in.',
    defeat: 'It goes down in the ash it made, and breathes, and does not get up. Whatever it was called, it is not called that now.',
    bindable: true,
  },
  morvaleth: {
    id: 'morvaleth', name: 'Morvaleth', title: 'of the Sunken Hall', lineageId: 'tidechorus', level: 22,
    elements: ['tide', 'gloam'], node: 'chorus_hall', act: 2,
    genes: { body: 'serpent', wings: 'finned', horns: 'spiral', tail: 'fan', crest: 'sail',
             pattern: 'gradient', hue: 198, hue2: 262, sat: 0.55, light: 0.42, eye: 190, size: 1.22 },
    essence: { hp: 14, mp: 14, atk: 10, mag: 15, def: 11, res: 14, spd: 11 },
    moves: ['strike_fang', 'chorus_song', 'undertow', 'lull', 'mend_scale', 'drowned_chorus'],
    traits: ['saltmemory', 'linewalker'], hpMult: 3.4,
    intro: 'It is singing when you arrive. It does not stop for you, and the water in the hall moves with it.',
    defeat: 'The singing stops. In the quiet you can hear the hall dripping, and something under the floor letting go.',
    bindable: true,
  },
  kessa: {
    id: 'kessa', name: 'Aurex', title: "Kessa Vane's chimera", lineageId: 'stormcaller', level: 33,
    elements: ['storm', 'radiant'], node: 'concord_hall', act: 3,
    genes: { body: 'wyvern', wings: 'twin', horns: 'crown', tail: 'spikes', crest: 'mane',
             pattern: 'veined', hue: 54, hue2: 200, sat: 0.7, light: 0.5, eye: 50, size: 1.15 },
    essence: { hp: 13, mp: 14, atk: 13, mag: 15, def: 12, res: 13, spd: 15 },
    moves: ['strike_talon', 'thunderhead', 'overcharge', 'sunlance', 'static_field', 'riven_bolt'],
    traits: ['stormborn', 'brightscale'], hpMult: 3.8,
    intro: '"You want me to unmake a hundred years of light," Kessa says, "on the word of a dead woman and a bag of eggs." She is not angry. That is the worst of it.',
    defeat: 'Aurex kneels, and Kessa puts her hand flat on its neck, and says nothing for a long time.',
    bindable: false,
  },
  ythrax: {
    id: 'ythrax', name: 'Ythrax', title: 'of the Riven Throne', lineageId: 'skyward', level: 42,
    elements: ['gale', 'storm'], node: 'riven_throne', act: 4,
    genes: { body: 'wyvern', wings: 'feathered', horns: 'antler', tail: 'fan', crest: 'mane',
             pattern: 'banded', hue: 168, hue2: 58, sat: 0.62, light: 0.55, eye: 160, size: 1.25 },
    essence: { hp: 14, mp: 13, atk: 15, mag: 14, def: 12, res: 13, spd: 15 },
    moves: ['strike_talon', 'skysunder', 'cyclone', 'thunderhead', 'quicken', 'riven_bolt'],
    traits: ['swiftwing', 'keenhunter'], hpMult: 3.9,
    intro: 'It has held this peak alone since the Gale line thinned. It is not defending a nest. There is no nest.',
    defeat: 'It folds onto the stone, enormous and tired, and lets you close enough to touch it.',
    bindable: true,
  },
  vaelorax: {
    id: 'vaelorax', name: 'Vaelorax', title: 'the Sundrake', lineageId: 'emberwyrm', level: 52,
    elements: ['radiant', 'ember'], node: 'hollow_sun', act: 5, final: true,
    genes: { body: 'quad', wings: 'membrane', horns: 'crown', tail: 'club', crest: 'sail',
             pattern: 'veined', hue: 40, hue2: 20, sat: 0.78, light: 0.58, eye: 42, size: 1.28 },
    essence: { hp: 15, mp: 15, atk: 15, mag: 15, def: 14, res: 14, spd: 12 },
    moves: ['strike_tail', 'dawnbreak', 'immolate', 'bind_the_line', 'emberlash', 'sundering_flame'],
    traits: ['forgeheart', 'bedrock', 'linewalker'], hpMult: 3.2,
    intro: '"Warden," it says, without moving. "You have been carrying my brood around in your pockets for a season. I have been listening. Say what you came to say, and then we will do this properly."',
    defeat: 'It lets the fire out slowly, the way you would put down something heavy you had been holding for a hundred years.',
    bindable: false,
    phases: [
      { at: 1.0, say: 'It does not hurry. It has had a century to think about this.' },
      { at: 0.65, say: 'The chamber brightens. Five lines are being pulled somewhere they do not want to go.' },
      { at: 0.30, say: '"Enough," it says, almost kindly, and the light goes white.' },
    ],
  },
};

export const BOSS_IDS = Object.keys(BOSSES);
export const boss = id => BOSSES[id] || null;
