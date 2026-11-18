// Every generated media file the game ships, so it never asks for one that isn't there.
// Art: fal (dev/art/). Sound: ElevenLabs (dev/audio/). Anything missing falls back to code: a gradient panel with the
// card's numeral for art, a Web Audio blip for an effect, silence for music and voices.

import { CARD_IDS } from './sim/data/cards.js';
import { ENEMIES } from './sim/data/enemies.js';
import { LINE_IDS } from './sim/data/lines.js';

/** The game folder, from this module's own URL, so dev pages in dev/ load the same files. */
export const ROOT = new URL('../', import.meta.url).href;

export const ART = {
    card: (id) => `art/card-${id}.webp`,
    foe: (id) => `art/foe-${id}.webp`,
    realm: (n) => `art/realm-${n}.webp`,
    back: 'art/cardback.webp',
    title: 'art/title.webp', parlour: 'art/parlour.webp', reading: 'art/reading.webp', ending: 'art/ending.webp', over: 'art/over.webp',
};
export const ALL_ART = [
    ...CARD_IDS.map(ART.card), ...Object.keys(ENEMIES).map(ART.foe), ...Array.from({ length: 10 }, (_, i) => ART.realm(i + 1)),
    ART.back, ART.title, ART.parlour, ART.reading, ART.ending, ART.over,
];

export const SFX = ['pull', 'flip', 'reveal', 'rare', 'legend', 'star', 'click', 'deny', 'hit', 'crit', 'spell', 'heal', 'shield',
    'burn', 'stun', 'curse', 'die', 'rise', 'victory', 'defeat', 'dust', 'omen', 'phase', 'whoosh'];
export const MUSIC = { parlour: 'audio/music-parlour.mp3', battle: 'audio/music-battle.mp3', boss: 'audio/music-boss.mp3', reading: 'audio/music-reading.mp3' };
export const VOICES = LINE_IDS;
