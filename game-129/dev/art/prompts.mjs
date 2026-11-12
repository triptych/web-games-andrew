/**
 * prompts.mjs — every fal request for HOLLOWDEEP's art, built from the game's own data tables.
 *
 *   node game-129/dev/art/prompts.mjs                 # print all requests as JSON
 *   node game-129/dev/art/prompts.mjs sheet-catacombs boss-ossuary_knight   # just these
 *
 * Each request: { name, input } where input is a fal-ai/nano-banana-2 input. The raw image is saved as raw/<name>.png
 * (grab.py) and export.py turns it into art/. See README.md.
 */
import { STRATA, MONSTERS } from '../../js/sim/data/monsters.js';
import { PORTRAITS } from '../../js/sim/data/classes.js';
import { PLACES, NPCS } from '../../js/sim/data/town.js';

export const SYSTEM = 'You are the art director of HOLLOWDEEP, a dark-fantasy first-person dungeon-crawler RPG of the PlayStation 2 era (2003). '
    + 'Every image is painted, semi-realistic CG-style fantasy illustration like the monster art and character portraits of early-2000s '
    + 'Japanese dungeon RPGs: rich painterly detail, dramatic rim lighting, deep shadows, muted earthy palettes with glowing accents, '
    + 'a slightly soft finish. Never include any text, letters, numbers, logos, watermarks, signatures, borders, frames, grid lines '
    + 'or user-interface elements.';

const KEY = { magenta: 'plain flat solid magenta (#ff00ff)', green: 'plain flat solid pure green (#00ff00)' };
const ORD = ['1)', '2)', '3)', '4)', '5)', '6)'];

// the 4x4 icon atlases, cell by cell (items.js `icon` is [sheet, cell])
export const ICONS = {
    gear: ['a steel longsword', 'a double-bladed battle axe', 'a curved dagger', 'a flanged iron mace', 'a wizard staff topped with a blue crystal', 'a recurve longbow',
        'a suit of steel plate armour', 'a brown leather jerkin', 'a purple mage robe', 'a round kite shield with a crest',
        'a gold ring with a red gem', 'a silver amulet with a blue gem', 'a red potion in a round flask', 'a blue potion in a slim vial',
        'a glowing orange phoenix feather', 'a spool of golden thread'],
    misc: ['a bundle of green bitter herbs', 'a golden elixir in an ornate bottle', 'a corked flask of liquid fire', 'a pile of gold coins',
        'a lucky gold coin with a four-leaf clover', 'a tarnished silver locket on a chain', 'a pale glowing moon-white flower',
        'a lump of dark ore with glowing star flecks', 'a rolled water-stained parchment map', 'a jagged pale blue ice crystal',
        'a torn silver war banner on a pole', 'a small brass music box', 'a silver reliquary holding a bone', 'an iron key',
        'a lit brass lantern', 'a skull with a candle on it'],
};

// Grid sheets: several subjects per request at 2K, so each cell comes back at about the size of a 1K single image.
// export.py cuts them in the same order. BOSS_SHEETS and TEX_SHEETS name what is in each cell, in reading order.
export const BOSS_SHEETS = [
    ['ossuary_knight', 'mother_mycelia', 'brine_leviathan', 'forgefather'],
    ['winter_lich', 'elder_briar', 'orrery_engine', 'hollow_king'],
];
export const TEX_SHEETS = [['catacombs', 'grotto'], ['drowned', 'foundry'], ['ossuary', 'thornwood'], ['clockwork', 'sanctum']];
export const POR_SHEETS = [PORTRAITS.slice(0, 6).map((p) => p.id), PORTRAITS.slice(6).map((p) => p.id)];
export const BG_SHEETS = [['square', 'inn', 'shop', 'guild'], ['temple', 'tavern', 'gate', 'deeps']];
const EXTRA_BG = { deeps: 'a vast dark chasm inside the earth with ruined stairways spiralling down into a faint violet glow far below' };

const list = (arr) => arr.map((t, i) => `${i + 1}) ${t}`).join('; ');

export function requests() {
    const out = [];
    for (const s of STRATA) {
        const ms = s.monsters.map((id, i) => `${ORD[i]} ${MONSTERS[id].art}`);
        out.push({ name: `sheet-${s.id}`, input: {
            prompt: `A sprite sheet for a dungeon RPG: six different monsters from the ${s.name} (${s.art}) arranged in a 3 by 2 grid, `
                + 'evenly spaced, each one complete and fully inside its own cell with clear empty space around it, nothing overlapping. '
                + 'Every monster is a full-body view facing the viewer, as the player would meet it in a corridor. '
                + `Top row, left to right: ${ms.slice(0, 3).join(' ')} Bottom row, left to right: ${ms.slice(3).join(' ')} `
                + `${KEY[s.key]} background everywhere, no shadows, no ground, no labels, no text.`,
            resolution: '2K', aspect_ratio: '3:2' } });
    }
    for (const [i, ids] of BOSS_SHEETS.entries()) {
        out.push({ name: `bosses-${i + 1}`, input: {
            prompt: 'A sprite sheet of four imposing boss monsters for a dungeon RPG in a 2 by 2 grid, each complete and fully inside its own cell '
                + 'with clear empty space around it, nothing overlapping, each a full-body view facing the viewer and filling most of its cell. '
                + `In reading order: ${list(ids.map((id) => MONSTERS[id].art))}. `
                + 'Plain flat solid pure green (#00ff00) background everywhere, no shadows, no ground, no labels, no text.',
            resolution: '2K', aspect_ratio: '1:1' } });
    }
    out.push({ name: 'reaper', input: {
        prompt: `A single monster for a dungeon RPG, full body, facing the viewer: ${MONSTERS.reaper.art}. Plain flat solid magenta (#ff00ff) background, no shadow, no ground, no text.`,
        resolution: '1K', aspect_ratio: '1:1' } });
    for (const [i, pair] of TEX_SHEETS.entries()) {
        const cells = [];
        for (const id of pair) {
            const s = STRATA.find((x) => x.id === id);
            cells.push(`a dungeon WALL texture, flat orthographic front view of the wall surface: ${s.art}`);
            cells.push(`a dungeon FLOOR texture, seen straight from above: ${s.floor}`);
        }
        out.push({ name: `tex-${i + 1}`, input: {
            prompt: 'Four separate seamless tileable square textures for a 3D dungeon game in a 2 by 2 grid, each filling its whole quarter edge to edge, '
                + `evenly lit with no vignette, no perspective and no objects in front. In reading order: ${list(cells)}.`,
            resolution: '2K', aspect_ratio: '1:1' } });
    }
    for (const [i, ids] of POR_SHEETS.entries()) {
        const ps = ids.map((id) => PORTRAITS.find((p) => p.id === id));
        out.push({ name: `portraits-${i + 1}`, input: {
            prompt: 'Six separate head-and-shoulders character portraits of fantasy adventurers in a 3 by 2 grid, each square and facing the viewer, '
                + 'each on its own dark smoky painted background with a faint warm glow behind the head, separated by thin black gutters. '
                + `In reading order: ${list(ps.map((p) => `a ${p.cls}: ${p.art}`))}.`,
            resolution: '2K', aspect_ratio: '3:2' } });
    }
    const npcs = Object.values(NPCS);
    out.push({ name: 'portraits-npc', input: {
        prompt: 'Six separate head-and-shoulders character portraits of the townsfolk of a dungeon town in a 3 by 2 grid, each square and facing the viewer, '
            + 'friendly, each on its own softly blurred painted background of their workplace, separated by thin black gutters. '
            + `In reading order: ${list(npcs.map((n) => `${n.role.toLowerCase()}: ${n.art}`))}.`,
        resolution: '2K', aspect_ratio: '3:2' } });
    for (const [i, ids] of BG_SHEETS.entries()) {
        out.push({ name: `bgs-${i + 1}`, input: {
            prompt: 'Four separate wide establishing background paintings for a dungeon RPG town menu in a 2 by 2 grid, each 16:9, '
                + 'separated by thin black gutters, no people in the foreground, atmospheric, painted. '
                + `In reading order: ${list(ids.map((id) => (PLACES[id] || { art: EXTRA_BG[id] }).art))}.`,
            resolution: '2K', aspect_ratio: '16:9' } });
    }
    out.push({ name: 'bg-title', input: {
        prompt: 'The key art for HOLLOWDEEP: a party of five adventurers (a fighter, a knight, a thief, a mage and a priest, seen from behind) '
            + 'standing at the top of a vast spiral stair that descends into a glowing abyss of ruined dungeon levels, crystals and ruins and stars below, '
            + 'lantern light, epic scale. Leave the upper third as darker cave space.',
        resolution: '2K', aspect_ratio: '16:9' } });
    for (const [sheet, cells] of Object.entries(ICONS)) {
        out.push({ name: `icons-${sheet}`, input: {
            prompt: 'A 4 by 4 grid of sixteen fantasy RPG inventory item icons, each centred in its own cell with empty space around it, nothing overlapping, '
                + `painted with a dark outline. In reading order: ${list(cells)}. `
                + 'Plain flat solid magenta (#ff00ff) background everywhere, no shadows, no labels, no text.',
            resolution: '2K', aspect_ratio: '1:1' } });
    }
    for (const r of out) r.input = { ...r.input, system_prompt: SYSTEM, output_format: 'png' };
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const want = process.argv.slice(2);
    const list = requests().filter((r) => !want.length || want.includes(r.name));
    console.log(JSON.stringify(list, null, 1));
    console.error(`${list.length} requests`);
}
