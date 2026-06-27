/**
 * maps.js — Map definitions for the overworld and dungeon scenes.
 *
 * Each map has:
 *   id, name, width, height (in tiles)
 *   tiles — flat array of tile ids (length = width * height)
 *   npcs  — array of { id, treeId, tx, ty }
 *   exits — array of { tx, ty, toMap, toTx, toTy, condition? }
 *   encounters — { rate (0-1), group } (null if no random battles)
 *   events — array of { tx, ty, type, payload, condition?, once? }
 *
 * Tile ids:
 *   0 = grass,  1 = floor (stone),  2 = wall,   3 = water,
 *   4 = tree,   5 = path,           6 = door,   7 = ruins floor,
 *   8 = void
 *
 * Walkable tiles: 0, 1, 5, 6, 7
 */

export const TILE_SOLID = new Set([2, 3, 4, 8]);

export const MAP_DEFS = {
    // ---- Thornhaven Village ----
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
            { id: 'blacksmith',  treeId: 'blacksmith_shop',  tx: 16, ty: 8 },
            { id: 'innkeeper',   treeId: 'innkeeper_rest',   tx: 4,  ty: 8 },
        ],
        exits: [
            { tx: 6, ty: 13, toMap: 'thornwood', toTx: 10, toTy: 2,  label: 'Thornwood Forest' },
        ],
        encounters: null,
        events: [],
    },

    // ---- Thornwood Forest ----
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
            { id: 'npc_dryad', treeId: 'npc_dryad_ch2', tx: 9, ty: 13, condition: 'chapter_2' },
            { id: 'borin',     treeId: 'borin_found',    tx: 9, ty: 5,  condition: 'quest_active_the_missing_merchant' },
        ],
        exits: [
            { tx: 9, ty: 2,  toMap: 'thornhaven', toTx: 6,  toTy: 12, label: 'Back to Thornhaven' },
            { tx: 9, ty: 18, toMap: 'map_ruins',  toTx: 10, toTy: 2,  label: 'Aethermoor Ruins', condition: 'chapter_3' },
        ],
        encounters: { rate: 0.15, groups: { 1: 'thornwood_easy', 2: 'thornwood_hard', 3: 'thornwood_hard' } },
        events: [
            { tx: 11, ty: 11, type: 'lore', payload: { text: 'The trees here bear scorched marks. Something powerful passed through recently.' }, once: true },
        ],
    },

    // ---- Aethermoor Ruins ----
    map_ruins: {
        id: 'map_ruins',
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
        ],
        exits: [
            { tx: 10, ty: 2, toMap: 'thornwood', toTx: 9, toTy: 17, label: 'Back to Thornwood' },
        ],
        encounters: { rate: 0.2, groups: { 2: 'ruins_normal', 3: 'ruins_normal', 4: 'ruins_hard' } },
        events: [
            { tx: 10, ty: 10, type: 'treasure', payload: { itemId: 'elder_scroll' }, once: true, condition: 'quest_active_lyras_past' },
            { tx: 10, ty: 18, type: 'boss',     payload: { enemyGroup: 'final_boss' }, once: true, condition: 'flag_seal_broken' },
        ],
    },
};

export function getMap(id) { return MAP_DEFS[id]; }

/** Returns true if tile is walkable */
export function isWalkable(tileId) { return !TILE_SOLID.has(tileId); }
