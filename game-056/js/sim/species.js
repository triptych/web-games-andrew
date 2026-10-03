/**
 * species.js — procedural monster species.
 *
 * A region's roster names a body *family* for each archetype ("goblin" for
 * grunts in the Greenmarch). Each run rolls one species per roster entry from
 * the run seed: proportions, palette, features, weapon, a name and a voice.
 * The result is plain data; js/view/models.js turns it into meshes.
 *
 * Pure: no three.js, no DOM, no Math.random.
 */

import { makeRng, hashSeed } from './rng.js';
import { REGIONS, ARCH } from '../config.js';

// [min, max] → rolled number; array → picked; anything else → as is.
const R = (rng, v) => Array.isArray(v)
    ? (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' ? rng.range(v[0], v[1]) : rng.pick(v))
    : v;

/** Body families. Colours are hex strings. Fields map to models.js params. */
const FAMILIES = {
    // ---------------------------------------------------------- Greenmarch
    goblin:       { plan: 'biped', noun: ['Goblin', 'Gob', 'Snatcher'], h: [0.62, 0.72], girth: [0.85, 1.05], head: [1.2, 1.4], hunch: [0.15, 0.3],
                    skin: ['#6a9a3a', '#7aa844', '#5e8a34', '#8aa83e'], cloth: ['#7a5a3a', '#6a4a2a', '#8a6a3a'], ears: 'long', eyes: 2, eyeColor: ['#ffd24a', '#ff4a2a'],
                    weapon: ['club', 'dagger', 'club'], helmet: [null, null, 'cap'], voice: 'squeak' },
    goblinArcher: { plan: 'biped', noun: ['Goblin Archer', 'Sniper', 'Stinger'], h: [0.6, 0.7], girth: [0.8, 0.95], head: [1.2, 1.35], hunch: [0.1, 0.2],
                    skin: ['#6a9a3a', '#7aa844', '#5e8a34'], cloth: ['#4a5a2a', '#5a4a2a'], ears: 'long', eyes: 2, eyeColor: '#ffd24a',
                    weapon: 'bow', helmet: 'hood', backpack: 'quiver', voice: 'squeak' },
    goblinSapper: { plan: 'biped', noun: ['Sapper', 'Boomer', 'Fusebiter'], h: [0.58, 0.66], girth: [0.85, 1.0], head: [1.25, 1.4], hunch: [0.25, 0.35],
                    skin: ['#7aa844', '#8aa83e'], cloth: '#8a3a2a', ears: 'long', eyes: 2, eyeColor: '#ffea4a',
                    weapon: 'bomb', helmet: 'cap', backpack: 'bomb', voice: 'squeak' },
    hobgoblin:    { plan: 'biped', noun: ['Hobgoblin', 'Shieldgob', 'Bulwark'], h: [0.86, 0.95], girth: [1.05, 1.2], head: [1.0, 1.1], hunch: [0.05, 0.12],
                    skin: ['#b8642a', '#a85a2a', '#c87a3a'], cloth: '#5a2a1a', armor: 'leather', armorColor: '#6a4a2a', ears: 'pointy', eyes: 2, eyeColor: '#ffea4a',
                    weapon: ['sword', 'spear'], shieldItem: true, helmet: ['cap', 'horned'], voice: 'growl' },
    troll:        { plan: 'biped', noun: ['Troll', 'Bridgetroll', 'Mossback'], h: [1.25, 1.4], girth: [1.35, 1.6], head: [0.8, 0.95], hunch: [0.25, 0.4], armLen: [1.25, 1.4],
                    skin: ['#5a7a5a', '#6a8a6a', '#4a6a5a'], cloth: '#5a4a3a', ears: 'pointy', tusks: true, eyes: 2, eyeColor: '#ffaa2a',
                    weapon: ['club', 'club', 'none'], voice: 'roar', moss: true },
    wolf:         { plan: 'quad', noun: ['Wolf', 'Warg', 'Prowler'], len: [0.85, 1.0], legH: [0.38, 0.46], girth: [0.75, 0.9], head: [0.9, 1.05], snout: [0.9, 1.2],
                    skin: ['#6a6a6a', '#7a6a5a', '#5a5a5a', '#8a7a6a'], belly: '#b8b0a0', ears: 'pointy', tail: 'bushy', eyes: 2, eyeColor: '#ffd24a', mane: [true, false], voice: 'growl' },
    bat:          { plan: 'flyer', noun: ['Bat', 'Flitter', 'Nightwing'], body: [0.55, 0.7], head: [0.9, 1.1], wing: 'bat', span: [1.1, 1.4],
                    skin: ['#4a3a4a', '#5a4a3a', '#3a3040'], wingColor: ['#6a4a5a', '#5a3a4a'], ears: 'long', eyes: 2, eyeColor: '#ff4a2a', voice: 'squeak' },
    // ---------------------------------------------------------- Mirefen
    bogGhoul:     { plan: 'biped', noun: ['Bog Ghoul', 'Drowner', 'Mudwalker'], h: [0.82, 0.92], girth: [0.85, 1.0], head: [0.95, 1.05], hunch: [0.25, 0.4], armLen: [1.15, 1.3],
                    skin: ['#5a6a4a', '#4a5a4a', '#6a7a5a'], cloth: '#3a4a2a', eyes: 2, eyeColor: '#d8ff6a', glow: true, weapon: 'none', moss: true, voice: 'moan' },
    marshLizard:  { plan: 'quad', noun: ['Marsh Lizard', 'Skink', 'Reedrunner'], len: [0.95, 1.1], legH: [0.22, 0.28], girth: [0.7, 0.85], head: [0.9, 1.0], snout: [1.1, 1.4],
                    skin: ['#4a7a4a', '#3a6a5a', '#5a8a4a'], belly: '#c8c87a', tail: 'long', eyes: 2, eyeColor: '#ffea4a', spikes: true, voice: 'hiss' },
    slime:        { plan: 'blob', noun: ['Slime', 'Ooze', 'Gloop'], r: [0.42, 0.5], skin: ['#6ad04a', '#4ab87a', '#8ad84a'], core: '#2a5a1a', eyes: 2, eyeColor: '#1a1a1a', voice: 'squelch' },
    lizardfolk:   { plan: 'biped', noun: ['Lizardfolk', 'Scalewarden', 'Fen Guard'], h: [0.92, 1.0], girth: [0.95, 1.05], head: [0.95, 1.05], hunch: [0.08, 0.15], snout: true,
                    skin: ['#3a7a5a', '#4a8a4a', '#2a6a5a'], cloth: '#5a4a2a', armor: 'leather', armorColor: '#7a6a3a', eyes: 2, eyeColor: '#ffea4a',
                    weapon: 'spear', shieldItem: true, tail: true, spikes: true, voice: 'hiss' },
    wisp:         { plan: 'wraith', noun: ["Will-o'-Wisp", 'Marshlight', 'Lurelamp'], h: [0.55, 0.65], robe: '#3a6a5a', glowColor: ['#a8ff6a', '#6affd8'], hood: false, wisp: true, eyes: 2, voice: 'chime' },
    mudLurker:    { plan: 'biped', noun: ['Mud Lurker', 'Silt Crawler', 'Sinker'], h: [0.8, 0.9], girth: [1.0, 1.15], head: [1.0, 1.1], hunch: [0.3, 0.4], armLen: [1.2, 1.35],
                    skin: ['#6a5a3a', '#5a4a2a'], cloth: '#4a3a2a', eyes: 3, eyeColor: '#ffaa2a', glow: true, weapon: 'none', claws: true, voice: 'growl' },
    bogHag:       { plan: 'biped', noun: ['Bog Hag', 'Mirewitch', 'Fen Crone'], h: [0.82, 0.9], girth: [0.85, 0.95], head: [1.0, 1.1], hunch: [0.35, 0.45],
                    skin: ['#7a8a5a', '#6a7a6a'], cloth: ['#3a2a3a', '#2a3a2a'], helmet: 'hood', eyes: 2, eyeColor: '#d8ff6a', glow: true, weapon: 'staff', staffGlow: '#a8ff6a', voice: 'cackle' },
    bogTroll:     { plan: 'biped', noun: ['Bog Troll', 'Fenmaw', 'Mirehulk'], h: [1.3, 1.45], girth: [1.45, 1.7], head: [0.8, 0.9], hunch: [0.3, 0.4], armLen: [1.3, 1.45],
                    skin: ['#4a5a3a', '#3a5a4a'], cloth: '#3a2a1a', tusks: true, eyes: 2, eyeColor: '#ffea4a', weapon: ['club', 'none'], moss: true, voice: 'roar' },
    // ---------------------------------------------------------- Ashen Pass
    orc:          { plan: 'biped', noun: ['Orc', 'Ashblade', 'Grunt'], h: [0.92, 1.02], girth: [1.1, 1.25], head: [0.95, 1.05], hunch: [0.1, 0.2],
                    skin: ['#5a7a3a', '#4a6a3a', '#6a6a3a'], cloth: '#4a2a1a', armor: ['leather', 'plate'], armorColor: ['#4a3a3a', '#5a4a4a'], tusks: true, ears: 'pointy', eyes: 2, eyeColor: '#ff3a1a',
                    weapon: ['axe', 'sword', 'axe'], helmet: [null, 'horned', 'cap'], voice: 'growl' },
    hellhound:    { plan: 'quad', noun: ['Hellhound', 'Cinderhound', 'Ashjaw'], len: [0.9, 1.0], legH: [0.4, 0.48], girth: [0.8, 0.9], head: [1.0, 1.1], snout: [0.9, 1.1],
                    skin: ['#2a1a1a', '#3a1a14'], belly: '#5a2a1a', ears: 'pointy', horns: 2, hornColor: '#2a2020', tail: 'thin', eyes: 2, eyeColor: '#ffaa1a', glow: true, fire: true, spikes: true, voice: 'growl' },
    orcWarlock:   { plan: 'biped', noun: ['Orc Warlock', 'Flamecaller', 'Hexer'], h: [0.92, 1.0], girth: [1.0, 1.1], head: [0.95, 1.05], hunch: [0.12, 0.2],
                    skin: ['#5a7a3a', '#6a6a3a'], cloth: ['#5a1a1a', '#3a1a2a'], tusks: true, ears: 'pointy', eyes: 2, eyeColor: '#ff6a1a', glow: true,
                    weapon: 'staff', staffGlow: '#ff6a1a', helmet: ['hood', 'horned'], voice: 'growl' },
    imp:          { plan: 'flyer', noun: ['Imp', 'Cinderling', 'Sootwing'], body: [0.55, 0.65], head: [1.0, 1.15], wing: 'bat', span: [0.9, 1.1], legs: true, horns: 2,
                    skin: ['#c83a2a', '#a82a2a', '#d84a2a'], wingColor: '#5a1a1a', eyes: 2, eyeColor: '#ffea4a', glow: true, tail: true, voice: 'cackle' },
    orcReaver:    { plan: 'biped', noun: ['Reaver', 'Leapblade', 'Skullhopper'], h: [0.95, 1.02], girth: [0.95, 1.05], head: [0.95, 1.05], hunch: [0.15, 0.25],
                    skin: ['#4a6a3a', '#5a6a3a'], cloth: '#2a1a1a', armor: 'leather', armorColor: '#3a2a2a', tusks: true, ears: 'pointy', eyes: 2, eyeColor: '#ff3a1a',
                    weapon: 'scythe', helmet: 'skull', voice: 'growl' },
    koboldSapper: { plan: 'biped', noun: ['Kobold Sapper', 'Blastling', 'Fusetail'], h: [0.56, 0.64], girth: [0.85, 0.95], head: [1.15, 1.3], hunch: [0.2, 0.3], snout: true,
                    skin: ['#b85a2a', '#a84a2a'], cloth: '#4a3a2a', horns: 2, hornColor: '#e8d8b8', eyes: 2, eyeColor: '#ffea4a', tail: true,
                    weapon: 'bomb', backpack: 'bomb', helmet: 'cap', voice: 'squeak' },
    orcCatapult:  { plan: 'siege', noun: ['War Catapult', 'Gatebreaker', 'Skullflinger'], wood: ['#5a3a2a', '#4a3020'], metal: '#3a3a3a', crew: 'orc', ammo: '#5a5050', voice: 'creak' },
    ogre:         { plan: 'biped', noun: ['Ogre', 'Gutbelly', 'Mauler'], h: [1.35, 1.5], girth: [1.6, 1.85], head: [0.85, 0.95], hunch: [0.15, 0.25], armLen: [1.2, 1.3],
                    skin: ['#a87a5a', '#9a7a4a', '#b88a6a'], cloth: '#5a3a1a', armor: 'leather', armorColor: '#4a3a2a', tusks: true, eyes: [1, 2], eyeColor: '#ff6a1a', weapon: 'club', voice: 'roar' },
    // ---------------------------------------------------------- Frostfell
    frostkin:     { plan: 'biped', noun: ['Frostkin', 'Rimeling', 'Icebiter'], h: [0.72, 0.82], girth: [0.9, 1.0], head: [1.1, 1.2], hunch: [0.1, 0.2],
                    skin: ['#8ab8d8', '#a8c8e8', '#7aa8c8'], cloth: '#e8f0f8', ears: 'pointy', eyes: 2, eyeColor: '#2a6aff', glow: true, weapon: ['spear', 'axe'], helmet: ['cap', null], fur: true, voice: 'squeak' },
    snowWolf:     { plan: 'quad', noun: ['Snow Wolf', 'Whitefang', 'Driftstalker'], len: [0.9, 1.0], legH: [0.4, 0.46], girth: [0.8, 0.9], head: [0.95, 1.05], snout: [1.0, 1.15],
                    skin: ['#e8eef4', '#d8e0e8'], belly: '#ffffff', ears: 'pointy', tail: 'bushy', eyes: 2, eyeColor: '#4ad8ff', glow: true, mane: true, voice: 'growl' },
    iceKnight:    { plan: 'biped', noun: ['Ice Knight', 'Rimeguard', 'Glacier Sworn'], h: [0.98, 1.05], girth: [1.05, 1.15], head: [0.95, 1.0], hunch: [0, 0.06],
                    skin: '#a8d8f8', cloth: '#4a6a9a', armor: 'plate', armorColor: ['#b8e0ff', '#9ac8f0'], eyes: 2, eyeColor: '#2a8aff', glow: true,
                    weapon: 'sword', shieldItem: true, helmet: 'horned', crystal: true, voice: 'growl' },
    frostWraith:  { plan: 'wraith', noun: ['Frost Wraith', 'Sleetghost', 'Whitewail'], h: [0.85, 0.95], robe: ['#c8e0f8', '#a8c8e8'], glowColor: '#4ad8ff', hood: true, eyes: 2, arms: true, voice: 'moan' },
    frostShaman:  { plan: 'biped', noun: ['Frost Shaman', 'Rimecaller', 'Snowseer'], h: [0.8, 0.88], girth: [0.95, 1.05], head: [1.05, 1.15], hunch: [0.15, 0.25],
                    skin: ['#8ab8d8', '#a8c8e8'], cloth: '#3a5a8a', helmet: 'skull', eyes: 2, eyeColor: '#4ad8ff', glow: true, weapon: 'staff', staffGlow: '#8fd8ff', fur: true, voice: 'chant' },
    iceWorm:      { plan: 'quad', noun: ['Ice Worm', 'Frostburrower', 'Tunnelmaw'], len: [1.2, 1.4], legH: [0.08, 0.1], girth: [0.75, 0.85], head: [1.0, 1.1], snout: [0.6, 0.7],
                    skin: ['#c8e0f0', '#b8d0e8'], belly: '#e8f0ff', eyes: 0, eyeColor: '#2a6aff', worm: true, spikes: true, voice: 'hiss' },
    frostGiant:   { plan: 'biped', noun: ['Frost Giant', 'Hoarfather', 'Glacierback'], h: [1.45, 1.6], girth: [1.4, 1.55], head: [0.85, 0.95], hunch: [0.08, 0.15],
                    skin: ['#9ac0e0', '#8ab0d8'], cloth: '#4a5a7a', beard: '#e8f4ff', eyes: 2, eyeColor: '#4ad8ff', glow: true, weapon: 'boulder', helmet: 'horned', crystal: true, fur: true, voice: 'roar' },
    yeti:         { plan: 'biped', noun: ['Yeti', 'Snowmauler', 'Abominable'], h: [1.35, 1.5], girth: [1.6, 1.8], head: [0.9, 1.0], hunch: [0.2, 0.3], armLen: [1.3, 1.45],
                    skin: ['#f0f4f8', '#e0e8f0'], cloth: '#e0e8f0', horns: 2, hornColor: '#c8c0a8', eyes: 2, eyeColor: '#2a6aff', fur: true, weapon: 'none', claws: true, voice: 'roar' },
    // ---------------------------------------------------------- Gloamhold
    skeleton:     { plan: 'biped', noun: ['Skeleton', 'Rattler', 'Bonewalker'], h: [0.88, 0.95], girth: [0.7, 0.8], head: [1.0, 1.05], hunch: [0.05, 0.15],
                    skin: '#e8e0c8', cloth: '#3a3030', skeleton: true, eyes: 2, eyeColor: '#6aff6a', glow: true, weapon: ['sword', 'axe', 'spear'], helmet: [null, 'cap'], voice: 'rattle' },
    ghoulHound:   { plan: 'quad', noun: ['Ghoul Hound', 'Cryptdog', 'Barghest'], len: [0.85, 0.95], legH: [0.38, 0.44], girth: [0.7, 0.8], head: [0.95, 1.05], snout: [1.0, 1.2],
                    skin: ['#5a5a4a', '#4a4a3a'], belly: '#8a8a6a', ears: 'pointy', tail: 'thin', eyes: 2, eyeColor: '#6aff6a', glow: true, ribs: true, voice: 'growl' },
    skeletonArcher:{ plan: 'biped', noun: ['Bone Archer', 'Deadeye', 'Quiverbones'], h: [0.86, 0.92], girth: [0.7, 0.78], head: [1.0, 1.05], hunch: [0.05, 0.1],
                    skin: '#e8e0c8', cloth: '#2a3a2a', skeleton: true, eyes: 2, eyeColor: '#6aff6a', glow: true, weapon: 'bow', helmet: 'hood', backpack: 'quiver', voice: 'rattle' },
    deathKnight:  { plan: 'biped', noun: ['Death Knight', 'Grave Warden', 'Barrow Lord'], h: [1.0, 1.08], girth: [1.1, 1.2], head: [0.95, 1.0], hunch: [0, 0.06],
                    skin: '#d8d0b8', cloth: '#2a1a2a', skeleton: true, armor: 'plate', armorColor: ['#3a3a4a', '#2a2a3a'], eyes: 2, eyeColor: '#6aff6a', glow: true,
                    weapon: 'sword', shieldItem: true, helmet: 'horned', voice: 'rattle' },
    banshee:      { plan: 'wraith', noun: ['Banshee', 'Keener', 'Wailing Shade'], h: [0.85, 0.95], robe: ['#4a5a5a', '#3a4a4a'], glowColor: '#8aff8a', hood: false, hair: true, eyes: 2, arms: true, voice: 'wail' },
    ghoul:        { plan: 'biped', noun: ['Ghoul', 'Gravecrawler', 'Fleshrender'], h: [0.82, 0.9], girth: [0.8, 0.9], head: [0.95, 1.05], hunch: [0.35, 0.45], armLen: [1.25, 1.4],
                    skin: ['#8a9a7a', '#7a8a7a'], cloth: '#3a3a2a', ears: 'pointy', eyes: 2, eyeColor: '#ffea4a', glow: true, weapon: 'none', claws: true, voice: 'moan' },
    necromancer:  { plan: 'biped', noun: ['Necromancer', 'Bonecaller', 'Gravespeaker'], h: [0.92, 1.0], girth: [0.85, 0.95], head: [1.0, 1.05], hunch: [0.1, 0.2],
                    skin: '#c8c8b8', cloth: ['#2a1a3a', '#1a1a2a'], helmet: 'hood', eyes: 2, eyeColor: '#8aff8a', glow: true, weapon: 'staff', staffGlow: '#8aff8a', skullStaff: true, voice: 'chant' },
    plagueBlob:   { plan: 'blob', noun: ['Plague Blob', 'Rotmass', 'Pestilent Ooze'], r: [0.46, 0.54], skin: ['#7a8a3a', '#8a7a3a'], core: '#3a2a1a', eyes: 3, eyeColor: '#ffea4a', bones: true, voice: 'squelch' },
    boneGiant:    { plan: 'biped', noun: ['Bone Giant', 'Ossuary', 'Charnel Hulk'], h: [1.4, 1.55], girth: [1.3, 1.45], head: [0.9, 1.0], hunch: [0.15, 0.25], armLen: [1.25, 1.35],
                    skin: '#e0d8c0', cloth: '#2a2a2a', skeleton: true, eyes: 2, eyeColor: '#6aff6a', glow: true, weapon: 'club', spikes: true, voice: 'roar' },
    // ---------------------------------------------------------- Dragonspire
    kobold:       { plan: 'biped', noun: ['Kobold', 'Scaleling', 'Yipper'], h: [0.6, 0.68], girth: [0.85, 0.95], head: [1.15, 1.25], hunch: [0.15, 0.25], snout: true,
                    skin: ['#a83a2a', '#8a3a3a', '#b84a2a'], cloth: '#3a2a2a', horns: 2, hornColor: '#e8d8b8', eyes: 2, eyeColor: '#ffea4a', tail: true, weapon: ['spear', 'dagger'], voice: 'squeak' },
    drakeling:    { plan: 'quad', noun: ['Drakeling', 'Ashraptor', 'Scuttlewyrm'], len: [0.9, 1.0], legH: [0.32, 0.38], girth: [0.7, 0.8], head: [0.95, 1.05], snout: [1.1, 1.3],
                    skin: ['#5a1a1a', '#3a2a2a', '#6a2a1a'], belly: '#c8823a', horns: 2, hornColor: '#e8d8b8', tail: 'long', eyes: 2, eyeColor: '#ffaa1a', glow: true, spikes: true, voice: 'hiss' },
    dragonguard:  { plan: 'biped', noun: ['Dragonguard', 'Scalebound', 'Wyrmshield'], h: [1.0, 1.08], girth: [1.1, 1.2], head: [0.95, 1.0], hunch: [0, 0.06], snout: true,
                    skin: ['#5a1a1a', '#3a1a1a'], cloth: '#1a0a0a', armor: 'plate', armorColor: ['#2a2020', '#3a2a1a'], horns: 2, hornColor: '#c8a87a', eyes: 2, eyeColor: '#ffaa1a', glow: true,
                    weapon: ['spear', 'sword'], shieldItem: true, tail: true, voice: 'growl' },
    cultist:      { plan: 'biped', noun: ['Cultist', 'Sun-eater', 'Ashpriest'], h: [0.92, 1.0], girth: [0.85, 0.95], head: [1.0, 1.05], hunch: [0.05, 0.12],
                    skin: '#c8a88a', cloth: ['#1a0a0a', '#3a0a0a'], helmet: 'hood', eyes: 2, eyeColor: '#ff3a1a', glow: true, weapon: 'staff', staffGlow: '#ff3a1a', voice: 'chant' },
    drake:        { plan: 'flyer', noun: ['Drake', 'Skywyrm', 'Cindertalon'], body: [0.75, 0.85], head: [0.95, 1.05], wing: 'drake', span: [1.4, 1.7], legs: true, horns: 2, tail: true,
                    skin: ['#6a1a1a', '#3a1a2a', '#7a2a1a'], wingColor: ['#2a0a0a', '#4a1a1a'], hornColor: '#e8d8b8', eyes: 2, eyeColor: '#ffaa1a', glow: true, voice: 'roar' },
    dragonkin:    { plan: 'biped', noun: ['Dragonkin', 'Wyrmblood', 'Scaled Reaver'], h: [1.0, 1.08], girth: [1.0, 1.1], head: [0.95, 1.05], hunch: [0.1, 0.2], snout: true,
                    skin: ['#7a2a1a', '#5a2a3a'], cloth: '#1a0a0a', armor: 'leather', armorColor: '#2a1a1a', horns: 2, hornColor: '#e8d8b8', eyes: 2, eyeColor: '#ffaa1a', glow: true,
                    weapon: 'scythe', tail: true, wingsSmall: true, voice: 'growl' },
    koboldBomber: { plan: 'biped', noun: ['Firebomber', 'Kegkobold', 'Blazetail'], h: [0.56, 0.64], girth: [0.85, 0.95], head: [1.15, 1.25], hunch: [0.2, 0.3], snout: true,
                    skin: ['#a83a2a', '#b84a2a'], cloth: '#4a2a1a', horns: 2, hornColor: '#e8d8b8', eyes: 2, eyeColor: '#ffea4a', tail: true, weapon: 'bomb', backpack: 'bomb', voice: 'squeak' },
    koboldBallista:{ plan: 'siege', noun: ['Scorpion Engine', 'Wyrmbow', 'Spitfire'], wood: ['#3a2a2a', '#2a2020'], metal: '#8a5a2a', crew: 'kobold', ammo: '#ff6a1a', ballista: true, voice: 'creak' },
    wyrmspawn:    { plan: 'biped', noun: ['Wyrmspawn', 'Brood Hulk', 'Scalebrute'], h: [1.35, 1.5], girth: [1.55, 1.75], head: [0.9, 1.0], hunch: [0.2, 0.3], armLen: [1.25, 1.35], snout: true,
                    skin: ['#4a1a1a', '#5a2a1a'], cloth: '#1a0a0a', horns: 2, hornColor: '#e8d8b8', eyes: 2, eyeColor: '#ffaa1a', glow: true, weapon: 'none', claws: true, tail: true, spikes: true, voice: 'roar' },
};

const ADJ = {
    greenmarch: ['Bramble', 'Moss', 'Thorn', 'Hill', 'Briar', 'Ditch', 'Hedge', 'Clover', 'Muck', 'Stump', 'Nettle', 'Barrow'],
    mirefen: ['Bog', 'Mire', 'Rot', 'Reed', 'Murk', 'Silt', 'Fen', 'Leech', 'Sludge', 'Brack', 'Peat', 'Sedge'],
    ashen: ['Ash', 'Cinder', 'Ember', 'Slag', 'Soot', 'Scorch', 'Char', 'Blaze', 'Brand', 'Flint', 'Pyre', 'Smelt'],
    frostfell: ['Rime', 'Frost', 'Hoar', 'Sleet', 'Glacier', 'Snow', 'Ice', 'Winter', 'Pale', 'Drift', 'Chill', 'Floe'],
    gloamhold: ['Grave', 'Bone', 'Gloom', 'Hollow', 'Dread', 'Crypt', 'Wight', 'Barrow', 'Ghast', 'Shroud', 'Tomb', 'Wither'],
    dragonspire: ['Scale', 'Wyrm', 'Obsidian', 'Black', 'Fang', 'Smoulder', 'Drake', 'Ruin', 'Spire', 'Eclipse', 'Basalt', 'Magma'],
};
const PART = ['back', 'jaw', 'fang', 'claw', 'tooth', 'maw', 'hide', 'skull', 'eye', 'gut', 'horn', 'tusk', 'spine', 'hand'];

function jitterHex(rng, hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + rng.range(-amt, amt)))));
    return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** Roll one species. Deterministic from (seed, region, arch, fam). */
export function genSpecies(seed, regionIdx, arch, fam) {
    const region = REGIONS[regionIdx];
    const F = FAMILIES[fam];
    if (!F) throw new Error(`unknown family ${fam}`);
    const rng = makeRng(hashSeed(seed, regionIdx * 97 + 13, fam.length * 31 + fam.charCodeAt(0) * 7 + fam.charCodeAt(fam.length - 1), arch.charCodeAt(0)));
    const p = {};
    for (const k in F) {
        if (k === 'noun' || k === 'voice') continue;
        p[k] = R(rng, F[k]);
    }
    for (const c of ['skin', 'cloth', 'belly', 'wingColor', 'armorColor', 'robe', 'wood']) if (typeof p[c] === 'string' && p[c][0] === '#') p[c] = jitterHex(rng, p[c], 0.1);
    // A little extra flavour so two runs never quite look the same.
    if (p.plan === 'biped') {
        if (p.horns === undefined && !p.skeleton && rng.chance(0.18)) { p.horns = 2; p.hornColor = rng.pick(['#e8d8b8', '#5a4a3a', '#c8c0a8']); }
        if (p.spikes === undefined && rng.chance(0.15)) p.spikes = true;
        p.armLen = p.armLen ?? rng.range(0.95, 1.08);
        p.legLen = rng.range(0.9, 1.08);
        p.shoulder = rng.range(0.9, 1.15);
    }
    if (p.plan === 'quad') {
        if (p.horns === undefined && rng.chance(0.2)) { p.horns = 2; p.hornColor = '#e8d8b8'; }
    }
    p.eyes = p.eyes ?? 2;
    p.hornCurl = rng.range(0.2, 1);
    p.stripe = rng.chance(0.3);
    const adj = rng.pick(ADJ[region.id]);
    const noun = rng.pick(F.noun);
    const part = rng.pick(PART);
    const name = rng.chance(0.5) ? `${adj}${part} ${noun}` : `${adj} ${noun}`;
    const a = ARCH[arch];
    const resist = { ...region.resist };
    if (F.plan === 'blob') resist.phys = (resist.phys ?? 1) * 0.85;
    if (fam === 'wisp' || F.plan === 'wraith') resist.phys = (resist.phys ?? 1) * 0.8;
    const undead = !!region.undead && F.plan !== 'siege';
    return {
        id: `${region.id}:${arch}:${fam}`,
        name, arch, fam, plan: F.plan, region: region.id, regionIdx,
        size: a.size * (p.plan === 'biped' ? 1 : 1),
        params: p,
        resist, undead,
        voice: { kind: F.voice, pitch: rng.range(0.85, 1.15) / Math.sqrt(a.size) },
        fly: !!a.fly,
    };
}

/** Every species a run will meet, keyed by region then archetype. */
export function genBestiary(seed) {
    const out = [];
    REGIONS.forEach((region, ri) => {
        const byArch = {};
        for (const [arch, fam] of region.roster) byArch[arch] = genSpecies(seed, ri, arch, fam);
        // Treasure carriers wear the region's grunt body with a chest on its back.
        const g = region.roster[0];
        const t = genSpecies(seed ^ 0x5eed, ri, 'treasure', g[1]);
        t.params.backpack = 'chest';
        t.params.weapon = 'none';
        t.params.helmet = 'cap';
        t.name = `Loot-laden ${FAMILIES[g[1]].noun[0]}`;
        t.id = `${region.id}:treasure`;
        byArch.treasure = t;
        out.push(byArch);
    });
    return out;
}

export const FAMILY_KEYS = Object.keys(FAMILIES);
