/**
 * maps.js — Map definitions for the overworld and dungeon scenes.
 *
 * Each map has:
 *   id, name, width, height (in tiles)
 *   tiles — flat array of tile ids (length = width * height)
 *   npcs  — array of { id, treeId, tx, ty, condition? }
 *   exits — array of { tx, ty, toMap, toTx, toTy, condition?, label?, blockedMsg? }
 *   encounters — { rate (0-1), groups: {chapter: groupKey} } (null if no random battles)
 *   events — array of { tx, ty, type, payload, condition?, once? }
 *
 * Tile ids:
 *   0 = grass,  1 = floor (stone),  2 = wall,   3 = water,
 *   4 = tree,   5 = path,           6 = door,   7 = ruins floor,
 *   8 = void
 *
 * Walkable tiles: 0, 1, 5, 6, 7
 *
 * World map (Chapter reachability):
 *   thornhaven <-> blacksmith_interior / inn_interior           (Ch1+)
 *   thornhaven <-> thornwood                                    (Ch1+)
 *   thornwood  <-> academy_ruins                                (Ch1+, Lyra's past)
 *   thornwood  <-> world_tree_grove                              (Ch2+, Sylvara)
 *   world_tree_grove <-> korvas_chapel                           (Ch2+, after 3 soul gems delivered)
 *   thornwood  <-> aethermoor_ruins                              (Ch3+, Scholar Aneth)
 *   aethermoor_ruins <-> aethermoor_sanctum                      (after flag_seal_broken)
 */

export const TILE_SOLID = new Set([2, 3, 4, 8]);

export const MAP_DEFS = {
    // ==================================================================
    // Thornhaven Village
    // ==================================================================
    thornhaven: {
        id: 'thornhaven',
        name: 'Thornhaven Village',
        width: 20, height: 15,
        bgColor: 0x1a3010,
        tiles: [
            // Row 0
            4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
            // Row 1
            4,0,0,0,0,0,5,5,5,5,5,0,0,0,0,0,0,0,0,4,
            // Row 2
            4,0,1,1,6,1,5,0,0,0,5,0,1,1,6,1,0,0,0,4,
            // Row 3
            4,0,1,1,1,1,5,0,0,0,5,0,1,1,1,1,0,0,0,4,
            // Row 4
            4,0,0,0,0,0,5,0,0,0,5,0,0,0,0,0,0,0,0,4,
            // Row 5
            4,0,0,0,0,0,5,5,5,5,5,5,5,5,0,0,0,0,0,4,
            // Row 6
            4,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,4,
            // Row 7
            4,0,1,1,6,0,0,0,0,0,0,0,0,5,0,1,1,6,0,4,
            // Row 8
            4,0,1,1,1,0,0,0,0,0,0,0,0,5,0,1,1,1,0,4,
            // Row 9
            4,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,5,0,4,
            // Row 10
            4,0,0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,0,4,
            // Row 11
            4,0,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,0,0,4,
            // Row 12
            4,0,0,0,0,0,5,5,5,5,5,5,0,0,0,0,0,0,0,4,
            // Row 13
            4,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,4,
            // Row 14
            4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
        ],
        npcs: [
            { id: 'elder_varec', treeId: 'elder_varec_ch1', tx: 4,  ty: 3 },
            { id: 'farmer_holt', treeId: 'farmer_holt_ch1', tx: 13, ty: 3 },
            { id: 'orin',        treeId: 'orin_recruit',     tx: 9,  ty: 6, condition: 'chapter_2' },
        ],
        exits: [
            { tx: 6, ty: 13, toMap: 'thornwood', toTx: 10, toTy: 2, label: 'Thornwood Forest' },
            // Doors into small interiors — Marta's forge (west door) and the Ember Hearth Inn (east door)
            { tx: 4, ty: 7,  toMap: 'inn_interior',        toTx: 3, toTy: 4, label: 'Ember Hearth Inn' },
            { tx: 17, ty: 7, toMap: 'blacksmith_interior', toTx: 3, toTy: 4, label: "Marta's Forge" },
        ],
        encounters: null,
        events: [],
    },

    // ==================================================================
    // Marta's Forge (interior)
    // ==================================================================
    blacksmith_interior: {
        id: 'blacksmith_interior',
        name: "Marta's Forge",
        width: 7, height: 6,
        bgColor: 0x2a1810,
        tiles: [
            2,2,2,2,2,2,2,
            2,1,1,1,1,1,2,
            2,1,1,1,1,1,2,
            2,1,1,1,1,1,2,
            2,1,1,1,1,1,2,
            2,2,2,6,2,2,2,
        ],
        npcs: [
            { id: 'blacksmith', treeId: 'blacksmith_shop', tx: 3, ty: 2 },
        ],
        exits: [
            { tx: 3, ty: 5, toMap: 'thornhaven', toTx: 16, toTy: 8, label: 'Back to Thornhaven' },
        ],
        encounters: null,
        events: [],
    },

    // ==================================================================
    // Ember Hearth Inn (interior)
    // ==================================================================
    inn_interior: {
        id: 'inn_interior',
        name: 'Ember Hearth Inn',
        width: 7, height: 6,
        bgColor: 0x2a2010,
        tiles: [
            2,2,2,2,2,2,2,
            2,1,1,1,1,1,2,
            2,1,1,1,1,1,2,
            2,1,1,1,1,1,2,
            2,1,1,1,1,1,2,
            2,2,2,6,2,2,2,
        ],
        npcs: [
            { id: 'innkeeper', treeId: 'innkeeper_rest', tx: 3, ty: 2 },
        ],
        exits: [
            { tx: 3, ty: 5, toMap: 'thornhaven', toTx: 4, toTy: 8, label: 'Back to Thornhaven' },
        ],
        encounters: null,
        events: [],
    },

    // ==================================================================
    // Thornwood Forest — hub of Chapter 1-3 side paths
    // ==================================================================
    thornwood: {
        id: 'thornwood',
        name: 'Thornwood Forest',
        width: 20, height: 20,
        bgColor: 0x0d1f08,
        tiles: [
            4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
            4,0,0,0,0,0,0,0,4,4,4,0,0,0,0,0,0,0,0,4,
            4,0,0,0,0,0,0,0,4,5,5,5,0,0,0,0,0,0,0,4,
            4,0,0,4,4,0,0,0,4,5,0,5,0,0,0,4,4,4,0,4,
            4,0,0,4,0,0,0,0,4,5,0,5,0,0,0,4,0,4,0,4,
            4,0,0,0,0,0,0,0,0,5,0,5,0,0,0,0,0,0,0,4,
            4,0,0,0,0,0,0,0,0,5,0,5,0,0,0,0,0,0,0,4,
            4,4,0,0,0,0,0,0,0,5,0,5,0,0,0,0,0,4,4,4,
            4,0,0,0,0,0,0,0,0,5,0,5,0,0,0,0,0,0,0,4,
            4,0,0,0,4,4,0,0,0,5,0,5,0,0,4,4,0,0,0,4,
            4,0,0,0,0,0,0,5,5,5,0,5,5,5,0,0,0,0,0,4,
            4,0,0,0,0,0,0,5,0,0,0,0,0,5,0,0,0,0,0,4,
            4,0,4,4,0,0,0,5,0,0,0,0,0,5,0,0,4,4,0,4,
            4,0,0,0,0,0,0,5,0,0,0,0,0,5,0,0,0,0,0,4,
            4,0,0,0,0,0,0,5,0,4,0,0,0,5,0,0,0,0,0,4,
            4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
            4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
            4,0,0,4,4,0,0,0,0,0,0,0,0,0,4,4,0,0,0,4,
            4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,
            4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
        ],
        npcs: [
            { id: 'borin', treeId: 'borin_found', tx: 9, ty: 5, condition: 'quest_active_the_missing_merchant' },
            { id: 'sera',  treeId: 'sera_recruit', tx: 3, ty: 8, condition: 'chapter_2' },
        ],
        exits: [
            { tx: 9, ty: 2,  toMap: 'thornhaven', toTx: 6, toTy: 12, label: 'Back to Thornhaven' },
            { tx: 2, ty: 4,  toMap: 'academy_ruins', toTx: 5, toTy: 12, label: 'Academy Ruins' },
            { tx: 18, ty: 5, toMap: 'world_tree_grove', toTx: 5, toTy: 12, label: 'World Tree Grove',
              condition: 'chapter_2', blockedMsg: 'The path to the grove is choked with corruption. Return when you are stronger.' },
            { tx: 9, ty: 18, toMap: 'aethermoor_ruins', toTx: 10, toTy: 2, label: 'Aethermoor Ruins', condition: 'chapter_3' },
        ],
        encounters: { rate: 0.15, groups: { 1: 'thornwood_easy', 2: 'thornwood_hard', 3: 'thornwood_hard' } },
        events: [
            { tx: 11, ty: 11, type: 'lore', payload: { text: 'The trees here bear scorched marks. Something powerful passed through recently.' }, once: true },
        ],
    },

    // ==================================================================
    // Academy Ruins — Lyra's past (distinct from the Aethermoor ruins)
    // ==================================================================
    academy_ruins: {
        id: 'academy_ruins',
        name: 'Academy Ruins',
        width: 14, height: 14,
        bgColor: 0x241c38,
        tiles: [
            8,8,8,8,8,8,8,8,8,8,8,8,8,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,7,2,2,7,7,7,7,7,7,2,2,7,8,
            8,7,2,7,7,7,7,7,7,7,7,2,7,8,
            8,7,7,7,2,2,7,7,2,2,7,7,7,8,
            8,7,7,7,2,7,7,7,7,2,7,7,7,8,
            8,7,7,7,7,7,1,7,7,7,7,7,7,8,
            8,7,7,7,7,7,1,7,7,7,7,7,7,8,
            8,7,7,7,2,7,7,7,7,2,7,7,7,8,
            8,7,7,7,2,2,7,7,2,2,7,7,7,8,
            8,7,2,7,7,7,7,7,7,7,7,2,7,8,
            8,7,2,2,7,7,7,7,7,7,2,2,7,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,8,8,8,8,8,8,8,8,8,8,8,8,8,
        ],
        npcs: [],
        exits: [
            { tx: 5, ty: 12, toMap: 'thornwood', toTx: 2, toTy: 5, label: 'Back to Thornwood' },
        ],
        encounters: { rate: 0.15, groups: { 1: 'academy_easy', 2: 'academy_easy', 3: 'academy_easy', 4: 'academy_easy' } },
        events: [
            { tx: 6, ty: 2, type: 'lore',
              payload: { text: "Lyra pauses at a scorched lectern. \"This was the divination hall. I copied the prophecy scroll here, the night before I fled.\"" },
              once: true, condition: 'quest_active_lyras_past' },
            { tx: 6, ty: 11, type: 'treasure', payload: { itemId: 'elder_scroll' }, once: true, condition: 'quest_active_lyras_past' },
            { tx: 6, ty: 12, type: 'lore',
              payload: {
                  text: "Lyra clutches the scroll. \"It's real. Everything Vaelthas wrote about the Aether... it's all real. And it names me.\"",
                  onTrigger: { completeQuest: 'lyras_past' },
              },
              once: true, condition: 'has_item_elder_scroll' },
        ],
    },

    // ==================================================================
    // World Tree Grove — Sylvara's actual home; anchor points for the gems
    // ==================================================================
    world_tree_grove: {
        id: 'world_tree_grove',
        name: 'World Tree Grove',
        width: 15, height: 15,
        bgColor: 0x0a2410,
        tiles: [
            4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
            4,0,0,0,0,0,4,4,4,0,0,0,0,0,4,
            4,0,0,4,0,0,4,1,4,0,0,4,0,0,4,
            4,0,4,0,0,0,0,1,0,0,0,0,4,0,4,
            4,0,0,0,0,4,0,1,0,4,0,0,0,0,4,
            4,4,0,0,4,4,0,1,0,4,4,0,0,4,4,
            4,0,0,0,0,0,0,1,0,0,0,0,0,0,4,
            4,0,1,1,1,1,1,1,1,1,1,1,1,0,4,
            4,0,0,0,0,0,0,1,0,0,0,0,0,0,4,
            4,4,0,0,4,4,0,1,0,4,4,0,0,4,4,
            4,0,0,0,0,4,0,1,0,4,0,0,0,0,4,
            4,0,4,0,0,0,0,1,0,0,0,0,4,0,4,
            4,0,0,4,0,0,4,1,4,0,0,4,0,0,4,
            4,0,0,0,0,0,4,6,4,0,0,0,0,0,4,
            4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
        ],
        npcs: [
            { id: 'npc_dryad', treeId: 'npc_dryad_ch2', tx: 7, ty: 4, condition: 'chapter_2' },
        ],
        exits: [
            { tx: 5, ty: 12, toMap: 'thornwood', toTx: 17, toTy: 5, label: 'Back to Thornwood' },
            { tx: 7, ty: 13, toMap: 'korvas_chapel', toTx: 5, toTy: 12, label: 'Ruined Chapel',
              condition: 'all_flags:flag_grove_anchor_1,flag_grove_anchor_2,flag_grove_anchor_3',
              blockedMsg: 'The path beyond is choked with corrupted roots. Cleanse the grove\'s anchor points first.' },
        ],
        encounters: { rate: 0.12, groups: { 2: 'grove_easy', 3: 'grove_easy', 4: 'grove_easy' } },
        events: [
            // Three anchor points where a soul gem can be placed to cleanse the grove
            { tx: 7, ty: 2, type: 'anchor', payload: { anchorId: 'grove_anchor_1' }, once: true, condition: 'quest_active_spirit_of_the_wood' },
            { tx: 3, ty: 7, type: 'anchor', payload: { anchorId: 'grove_anchor_2' }, once: true, condition: 'quest_active_spirit_of_the_wood' },
            { tx: 11, ty: 7, type: 'anchor', payload: { anchorId: 'grove_anchor_3' }, once: true, condition: 'quest_active_spirit_of_the_wood' },
        ],
    },

    // ==================================================================
    // Korvas's Chapel — Orin's confrontation
    // ==================================================================
    korvas_chapel: {
        id: 'korvas_chapel',
        name: 'The Shattered Chapel',
        width: 11, height: 14,
        bgColor: 0x1c1424,
        tiles: [
            8,8,8,8,8,8,8,8,8,8,8,
            8,2,2,2,7,7,7,2,2,2,8,
            8,2,7,7,7,7,7,7,7,2,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,7,7,2,7,7,7,2,7,7,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,7,2,7,7,7,7,7,2,7,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,7,7,7,2,7,7,2,7,7,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,2,7,7,7,7,7,7,7,2,8,
            8,2,2,7,7,7,7,7,2,2,8,
            8,8,7,7,7,7,7,7,7,8,8,
            8,8,8,8,8,6,8,8,8,8,8,
        ],
        npcs: [],
        exits: [
            { tx: 5, ty: 12, toMap: 'world_tree_grove', toTx: 7, toTy: 13, label: 'Back to the Grove' },
        ],
        encounters: { rate: 0.2, groups: { 2: 'chapel_hard', 3: 'chapel_hard', 4: 'chapel_hard' } },
        events: [
            { tx: 5, ty: 2, type: 'lore',
              payload: { text: "Orin's grip tightens on his sword. \"This is where they cast me out. Korvas will be at the altar.\"" },
              once: true },
            { tx: 5, ty: 4, type: 'boss',
              payload: {
                  enemyGroup: 'boss_korvas',
                  onWin: {
                      setFlag: 'flag_korvas_confronted',
                      completeQuest: 'broken_oath',
                      giveItem: { id: 'chain_mail', qty: 1 },
                      setChapter: 3,
                  },
              },
              once: true },
        ],
    },

    // ==================================================================
    // Aethermoor Ruins — outer ring; Scholar Aneth, lich shard grinding
    // ==================================================================
    aethermoor_ruins: {
        id: 'aethermoor_ruins',
        name: 'Aethermoor Ruins',
        width: 20, height: 20,
        bgColor: 0x100818,
        tiles: [
            8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,7,2,2,2,2,7,7,7,7,7,7,7,2,2,2,2,2,7,8,
            8,7,2,7,7,2,7,7,7,7,7,7,7,2,7,7,7,2,7,8,
            8,7,2,7,7,2,7,7,7,7,7,7,7,2,7,7,7,2,7,8,
            8,7,2,7,7,6,7,7,7,7,7,7,7,6,7,7,7,2,7,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,7,2,2,2,2,7,7,7,7,7,7,7,7,7,2,2,2,7,8,
            8,7,2,7,7,2,7,7,7,7,7,7,7,7,7,2,7,2,7,8,
            8,7,2,7,7,2,7,7,7,7,7,7,7,7,7,2,7,2,7,8,
            8,7,2,7,7,6,7,7,7,7,7,7,7,7,7,6,7,2,7,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,7,7,7,7,7,7,7,2,2,2,2,7,7,7,7,7,7,7,8,
            8,7,7,7,7,7,7,7,2,7,7,2,7,7,7,7,7,7,7,8,
            8,7,7,7,7,7,7,7,2,7,7,2,7,7,7,7,7,7,7,8,
            8,7,7,7,7,7,7,7,6,7,7,6,7,7,7,7,7,7,7,8,
            8,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,8,
            8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,
        ],
        npcs: [
            { id: 'npc_scholar', treeId: 'npc_scholar_ch3', tx: 10, ty: 10, condition: 'chapter_3' },
            { id: 'thane',       treeId: 'thane_recruit',   tx: 5,  ty: 7,  condition: 'chapter_3' },
        ],
        exits: [
            { tx: 10, ty: 2, toMap: 'thornwood', toTx: 9, toTy: 17, label: 'Back to Thornwood' },
            { tx: 10, ty: 18, toMap: 'aethermoor_sanctum', toTx: 5, toTy: 11, label: 'The Sanctum Depths',
              condition: 'flag_seal_broken',
              blockedMsg: 'The sanctum doors are sealed by lich-shard resonance. Find Scholar Aneth.' },
        ],
        encounters: { rate: 0.2, groups: { 2: 'ruins_normal', 3: 'ruins_normal', 4: 'ruins_hard' } },
        events: [],
    },

    // ==================================================================
    // Aethermoor Sanctum — the true final dungeon
    // ==================================================================
    aethermoor_sanctum: {
        id: 'aethermoor_sanctum',
        name: 'Aethermoor Sanctum',
        width: 11, height: 16,
        bgColor: 0x18081c,
        tiles: [
            8,8,8,8,8,8,8,8,8,8,8,
            8,2,2,7,7,7,7,7,2,2,8,
            8,2,7,7,7,7,7,7,7,2,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,7,7,2,7,7,7,2,7,7,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,7,2,7,7,7,7,7,2,7,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,7,7,2,7,7,7,2,7,7,8,
            8,7,7,7,7,7,7,7,7,7,8,
            8,2,7,7,7,7,7,7,7,2,8,
            8,8,7,7,7,7,7,7,7,8,8,
            8,8,2,7,7,7,7,7,2,8,8,
            8,8,8,7,7,7,7,7,8,8,8,
            8,8,8,8,8,6,8,8,8,8,8,
            8,8,8,8,8,8,8,8,8,8,8,
        ],
        npcs: [],
        exits: [
            { tx: 5, ty: 14, toMap: 'aethermoor_ruins', toTx: 10, toTy: 17, label: 'Back to the Ruins' },
        ],
        encounters: { rate: 0.22, groups: { 3: 'sanctum_hard', 4: 'sanctum_hard' } },
        events: [
            { tx: 5, ty: 3, type: 'lore',
              payload: { text: 'The air itself hums with old power. Whatever sleeps below, it is close now.' },
              once: true },
            { tx: 5, ty: 11, type: 'boss', payload: { enemyGroup: 'final_boss', isFinalBoss: true }, once: true },
        ],
    },
};

export function getMap(id) { return MAP_DEFS[id]; }

/** Returns true if tile is walkable */
export function isWalkable(tileId) { return !TILE_SOLID.has(tileId); }
