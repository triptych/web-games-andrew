/**
 * Save and restore a run in localStorage.
 *
 * Levels are not serialised whole. Every floor is a pure function of
 * (depth, seed), so a save only needs the parts the player has changed:
 * which tiles are now open, what has been seen, what is still lying
 * around and which monsters are still alive. Everything else — rooms,
 * stairs, torches, wall textures — is regenerated on load.
 */

const KEY = 'grimhold-abyss-save';
const VERSION = 3;

const toB64 = (arr) => {
    let s = '';
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
};

const fromB64 = (str) => {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
};

export function hasSave() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return false;
        return JSON.parse(raw).version === VERSION;
    } catch {
        return false;
    }
}

export function clearSave() {
    try { localStorage.removeItem(KEY); } catch { /* storage disabled */ }
}

export function writeSave(game) {
    const data = {
        version: VERSION,
        seed: game.seed,
        depth: game.depth,
        deepest: game.deepest,
        time: game.time,
        stats: game.stats,
        player: {
            x: game.player.cellX, y: game.player.cellY, facing: game.player.facing
        },
        levels: [...game.levels.entries()].map(([depth, level]) => ({
            depth,
            tiles: toB64(level.tiles),
            seen: toB64(level.seen),
            items: level.items,
            monsters: level.monsters.filter(m => m.alive).map(m => ({
                id: m.id, x: m.cellX, y: m.cellY, hp: m.hp, awake: m.awake
            }))
        }))
    };
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
    } catch {
        return false;   // private mode, or quota
    }
}

export function readSave() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.version !== VERSION) return null;
        for (const lv of data.levels) {
            lv.tiles = fromB64(lv.tiles);
            lv.seen = fromB64(lv.seen);
        }
        return data;
    } catch {
        return null;
    }
}
