// prompts.mjs — every fal prompt for GIANT'S VAULT, built from the game's own data tables, so the art matches the
// game and can be regenerated. `node game-132/dev/art/prompts.mjs [group]` prints a JSON array of
// { name, system_prompt, prompt, aspect_ratio, resolution }; groups: pilot, title, cards, portraits, icons, tex, refs.
// The jobs were sent with fal-ai/nano-banana-2 (PNG). See README.md.

import { CLASSES, SKILLS, MASTERIES, HYBRIDS } from '../../js/sim/data/masteries.js';
import { MONSTERS, BOSSES } from '../../js/sim/data/monsters.js';
import { LEGENDARIES, SETS, BASES, GEMS } from '../../js/sim/data/items.js';
import { CARDS, NPCS } from '../../js/sim/data/world.js';

const STYLE = 'GIANT\'S VAULT, a dark mythic action RPG: gothic-mythic fusion of ruined Greek temples, drowned marshes, shadow-drenched crypts and giant forges of bronze and fire.';
export const SYS = {
    paint: `You are the art director of ${STYLE} Every image is lush painterly dark-fantasy concept art: deep shadows, dramatic rim light, saturated accent glows (teal, violet, molten orange) against dark stone, rich texture, cinematic composition. Never include any text, letters, logos, watermarks, frames, borders or user-interface elements.`,
    icon: `You are the icon painter of ${STYLE} You paint sheets of game icons: a perfectly even 4 by 4 grid of 16 square icons filling the whole image edge to edge, each a bold, readable painted emblem centred in its own cell on a dark smoky background, glowing accents, strong silhouette, consistent lighting from the top left. No grid lines, no borders between cells, no text, no letters, no numbers, no captions.`,
    ref: `You are the 3D character artist of ${STYLE} Every image is a stylised hand-painted 3D game model render with clean readable shapes and rich painted textures, in the look of a modern isometric action RPG. Always: ONE subject only, the whole subject visible from top to bottom, three-quarter front view, centred, on a plain flat light-grey background, soft even studio lighting, no cast shadow, no floor, no scenery, no text, no logos, no frame.`,
    tex: `You are the environment texture artist of ${STYLE} Every image is a seamless tileable texture seen straight from above, flat even lighting with no shadows cast across it, no perspective, no objects standing up, no text, no border, edges that wrap perfectly.`,
};

const job = (name, sys, prompt, aspect_ratio = '1:1', resolution = '1K') => ({ name, system_prompt: SYS[sys], prompt, aspect_ratio, resolution });

// ----------------------------------------------------------------------------------------------------- title, cards
const title = [job('title', 'paint', 'Key art for the title screen: a lone armoured warden with a glowing sword stands on a cliff edge at the bottom left, looking down into a colossal underground vault where an enormous chained stone giant with molten cracks strains against golden chains. Violet and orange light. The upper third of the picture is the shadowy cavern ceiling far above, dim and calm, with soft violet haze.', '16:9', '2K')];
const cards = Object.entries(CARDS).map(([id, c]) => job(`card-${id}`, 'paint', `${c.title}. ${c.art}.`, '16:9', '1K'));
const portraits = [
    ...Object.entries(CLASSES).map(([id, c]) => job(`portrait-${id}`, 'paint', `Heroic waist-up portrait of the ${c.name}: ${c.art}. Facing the viewer, ${MASTERIES[c.mastery].name.toLowerCase()} magic glowing in the background.`, '3:4')),
    ...Object.entries(NPCS).map(([id, n]) => job(`portrait-${id}`, 'paint', `Warm waist-up portrait of ${n.name}, the ${n.role} of a lantern-lit fortress town: ${n.art}. Facing the viewer.`, '3:4')),
    job('portrait-pet', 'paint', 'Waist-up portrait of a loyal companion beast: a large ash-grey lynx-wolf with glowing ember-orange eyes, tufted ears and a bronze collar with a lantern charm. Facing the viewer, friendly and fierce.', '3:4'),
];

// ----------------------------------------------------------------------------------------------------------- icons
const sheet = (name, items) => job(name, 'icon', `Sixteen icons, in reading order (left to right, top to bottom): ${items.map((t, i) => `${i + 1}. ${t}`).join('; ')}.`, '1:1', '2K');
const skillList = Object.values(SKILLS).sort((a, b) => a.icon - b.icon).map((s) => `${s.art} (${MASTERIES[s.mastery].name.toLowerCase()} colours)`);
const icons = [
    sheet('icons-skills-a', skillList.slice(0, 16)),
    sheet('icons-skills-b', [
        ...skillList.slice(16),
        ...Object.values(MASTERIES).map((m) => m.art),
        'a red healing potion flask with a cork, glowing',
        'a swirling blue town portal doorway of light',
        'a grey lynx-wolf head howling, companion spell',
        'a lynx-wolf carrying a sack of gold, running',
        'a bandaged paw with a green healing glow',
        'a pile of gold coins with a glint',
        'a scroll with a wax seal and a quill',
        'an open leather satchel bag',
    ]),
    sheet('icons-items', [
        ...['sword', 'axe', 'mace', 'staff', 'wand'].map((b) => `a ${BASES[b].name.toLowerCase()} weapon, bronze and steel`),
        'a bronze crested helmet', 'a bronze breastplate cuirass', 'bronze gauntlets', 'bronze greaves boots',
        'a bronze torc amulet with a gem', 'a gold ring with a small gem',
        ...Object.values(GEMS).map((g) => `a cut faceted ${g.name.toLowerCase()} gemstone`),
        'a glowing violet rift key shard',
    ]),
    sheet('icons-legendary', [
        ...Object.values(LEGENDARIES).map((l) => l.art),
        ...['helm', 'chest', 'gloves', 'boots'].map((p) => `${SETS.asters.art}: the ${p} piece`),
    ]),
    sheet('icons-sets', [
        ...['hood', 'robe', 'gloves', 'star-shaped amulet'].map((p) => `${SETS.skythief.art}: the ${p} piece`),
        ...Object.values(HYBRIDS).map((h) => `an emblem for the ${h.name} hybrid class: two crossed symbols of power fused together`),
        'a golden chain link breaking', 'a violet crack in reality', 'a skull with a crown', 'a bronze key with a wave pattern',
        'a key made of ghostly violet bone', 'a flaming key of molten bronze', 'a red heart orb health globe', 'a blue sparkle orb',
        'a bronze shield with a lion',
    ]),
];

// -------------------------------------------------------------------------------------------------------- textures
const tex = [
    job('tex-town', 'tex', 'Old worn cobblestone town square paving with moss in the cracks, warm grey stone.'),
    job('tex-wilds', 'tex', 'Marshy ground: wet dark mud, short sedge grass, small puddles and scattered pebbles, teal-green tones.'),
    job('tex-temple', 'tex', 'Cracked pale marble floor tiles of a drowned sea temple, teal water stains, barnacles and seaweed in the seams, a faint wave mosaic pattern.'),
    job('tex-crypt', 'tex', 'Ancient dark grey crypt flagstones, ash dust, bone fragments in the cracks, faint violet lichen.'),
    job('tex-vault', 'tex', 'Huge bronze floor plates riveted together, scorched, with thin glowing orange cracks of heat between some plates.'),
    job('tex-rift', 'tex', 'Shattered obsidian floor with veins of glowing violet and gold energy and tiny star specks inside the stone.'),
    job('tex-wall', 'tex', 'A rough wall of large dark stone blocks with mortar, weathered, seen straight on.'),
];

// ----------------------------------------------------------------------------------------- Meshy reference renders
const human = 'standing in a relaxed A-pose, arms slightly out from the body, hands open and empty, nothing held, full body from head to feet';
const refs = [
    ...Object.entries(CLASSES).map(([id, c]) => job(`ref-${c.model}`, 'ref', `A hero character: ${c.art}, ${human}, front view.`, '2:3')),
    job('ref-pet', 'ref', 'A large ash-grey lynx-wolf companion beast with tufted ears, a thick ruff, glowing ember-orange eyes and a bronze collar with a small lantern charm, standing on all four legs, side three-quarter view, whole body visible.', '1:1'),
    ...Object.entries(MONSTERS).map(([id, m]) => job(`ref-${m.model}`, 'ref', `A monster: ${m.art}, standing ready to fight, whole body visible.`, m.h > 1.2 ? '2:3' : '1:1')),
    ...Object.entries(BOSSES).map(([id, b]) => job(`ref-${b.model}`, 'ref', `A boss monster: ${b.art}, imposing, whole body visible.`, '1:1')),
    ...Object.entries(NPCS).map(([id, n]) => job(`ref-${n.model}`, 'ref', `A town character: ${n.art}, ${human}, front view.`, '2:3')),
    job('ref-prop-waystone', 'ref', 'A waystone: a tall carved standing stone obelisk with a glowing blue spiral rune, on a round stone base, Greek meander carvings.'),
    job('ref-prop-portal', 'ref', 'A ruined stone archway portal with a glowing swirling violet energy surface filling the arch, broken columns either side.'),
    job('ref-prop-chest', 'ref', 'An ornate bronze-bound wooden treasure chest, closed, with a lion-head lock.'),
    job('ref-prop-brazier', 'ref', 'A bronze tripod brazier bowl on three clawed legs, filled with burning coals, no flames rising high.'),
    job('ref-prop-column', 'ref', 'A broken ancient Greek marble column, fluted, snapped off halfway up, with moss on it, standing on a square plinth.'),
    job('ref-prop-sarcophagus', 'ref', 'A stone sarcophagus with a carved warden lying on the lid, cracked, violet glow from the crack.'),
    job('ref-prop-obelisk', 'ref', 'A tall black obsidian obelisk with glowing violet and gold cracks and floating rock shards around its top.'),
    job('ref-prop-statue', 'ref', 'A weathered stone statue of a helmeted Greek warrior god holding a spear and shield, on a plinth, one arm broken off.'),
    job('ref-prop-tree', 'ref', 'A gnarled dead swamp tree with twisted grey bark, hanging moss and a few teal leaves, roots spreading at the base.'),
    job('ref-prop-stall', 'ref', 'A small merchant market stall with a striped red canvas awning, a wooden counter with pots, scales and cloth bundles.'),
];

export const GROUPS = {
    pilot: [title[0], icons[0], refs[0], refs[3], tex[1]],
    title, cards, portraits, icons, tex, refs,
};

if (import.meta.url === `file://${process.argv[1]}`) {
    const g = process.argv[2] || 'pilot';
    const list = g === 'all' ? Object.entries(GROUPS).filter(([k]) => k !== 'pilot').flatMap(([, v]) => v) : GROUPS[g];
    console.log(JSON.stringify(list, null, 1));
    console.error(`${list.length} jobs`);
}
