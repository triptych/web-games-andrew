/**
 * Dungeon themes: a set of generated textures and flat floor/ceiling
 * colours per depth band. Deeper floors get colder, then hotter.
 */

import * as T from './engine/textures.js';
import * as P from './engine/palette.js';
import { DOOR } from './dungeon.js';

const THEMES = [
    {
        name: 'the catacombs',
        tones: [P.BLACK, P.DKGRAY, P.DKGRAY, P.LTGRAY],
        mortar: P.BLACK, moss: P.GREEN, mossAmount: 1.0,
        floorColor: P.DKGRAY, ceilColor: P.BLACK,
        accent: P.LTGREEN, style: 'block'
    },
    {
        name: 'the brick vaults',
        tones: [P.BLACK, P.RED, P.BROWN, P.YELLOW],
        mortar: P.DKGRAY, moss: P.GREEN, mossAmount: 0.35,
        floorColor: P.BROWN, ceilColor: P.RED,
        accent: P.YELLOW, style: 'brick'
    },
    {
        name: 'the drowned halls',
        tones: [P.BLACK, P.BLUE, P.BLUE, P.LTBLUE],
        mortar: P.BLACK, moss: P.CYAN, mossAmount: 0.8,
        floorColor: P.BLUE, ceilColor: P.DKGRAY,
        accent: P.LTCYAN, style: 'block'
    },
    {
        name: 'the bone galleries',
        tones: [P.BROWN, P.DKGRAY, P.LTGRAY, P.WHITE],
        mortar: P.BROWN, moss: P.BROWN, mossAmount: 0.5,
        floorColor: P.LTGRAY, ceilColor: P.BROWN,
        accent: P.WHITE, style: 'rough'
    },
    {
        name: 'the ember deeps',
        tones: [P.BLACK, P.RED, P.RED, P.LTRED],
        mortar: P.BLACK, moss: P.BROWN, mossAmount: 0.4,
        floorColor: P.RED, ceilColor: P.BLACK,
        accent: P.YELLOW, style: 'rough'
    },
    {
        name: 'the abyss',
        tones: [P.BLACK, P.MAGENTA, P.MAGENTA, P.LTMAGENTA],
        mortar: P.BLACK, moss: P.BLUE, mossAmount: 0.6,
        floorColor: P.MAGENTA, ceilColor: P.BLUE,
        accent: P.LTMAGENTA, style: 'block'
    }
];

/** Cheap stable hash so a given wall always picks the same variant. */
function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return (h ^ (h >> 16)) >>> 0;
}

export function themeForDepth(depth) {
    return THEMES[Math.min(THEMES.length - 1, ((depth - 1) / 2) | 0)];
}

export function buildTheme(depth, seed) {
    const def = themeForDepth(depth);
    const base = {
        tones: def.tones, mortar: def.mortar,
        moss: def.moss, mossAmount: def.mossAmount
    };
    const make = (i) => {
        const s = seed + i * 7717 + depth * 131;
        if (def.style === 'brick') return T.brickTexture(s, base);
        if (def.style === 'rough') return T.roughTexture(s, base);
        return T.blockTexture(s, base);
    };
    return {
        name: def.name,
        depth,
        floorColor: def.floorColor,
        ceilColor: def.ceilColor,
        accent: def.accent,
        walls: [make(0), make(1), make(2)],
        door: T.doorTexture(seed + 991, {}),
        gate: T.gateTexture(seed + 992, {}),
        stairs: T.runeTexture(seed + 993, base, def.accent)
    };
}

/**
 * Adapt a Level plus its theme into the flat interface the renderer wants.
 */
export function createWorldView(level, theme) {
    return {
        width: level.width,
        height: level.height,
        floorColor: theme.floorColor,
        ceilColor: theme.ceilColor,
        solidAt: (x, y) => level.solidAt(x, y),
        wallTexture(x, y, face) {
            const t = level.at(x, y);
            if (t === DOOR) return theme.door;
            // walls next to the stairs cell get the carved rune slab
            if (level.stairs && Math.abs(x - level.stairs.x) + Math.abs(y - level.stairs.y) === 1)
                return theme.stairs;
            return theme.walls[hash2(x, y + face * 31) % theme.walls.length];
        }
    };
}
