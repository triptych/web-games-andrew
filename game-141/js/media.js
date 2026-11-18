// Every generated media file the game ships, so it never asks for one that isn't there.
// Art: fal (dev/art/). Models: Meshy (dev/models/). Sound: ElevenLabs (dev/audio/). Anything missing falls back
// to code: a plain panel for art, a code-built stand-in for a model, a Web Audio blip for an effect, silence for
// music and voices.

import { ARTIFACTS } from './sim/data/artifacts.js';
import { LINES } from './sim/data/story.js';

/** The game folder, from this module's own URL, so dev pages in dev/ load the same files. */
export const ROOT = new URL('../', import.meta.url).href;

export const ART = {
    tiles: 'art/tiles.webp', monsters: 'art/monsters.webp', boss: 'art/boss.webp',
    items: 'art/items.webp', skills: 'art/skills.webp', arts: 'art/arts.webp',
    por: (who) => `art/por-${who}.webp`,
};
export const MODEL = (id) => `models/${id}.glb`;
export const MODELS = ARTIFACTS.map((a) => a.id);

export const SFX = ['dig-soft', 'dig-stone', 'dig-crystal', 'break-soft', 'break-stone', 'break-crystal', 'trap', 'monster',
    'mhit', 'hurt', 'coin', 'gem', 'artifact', 'levelup', 'rune', 'solve', 'chest', 'press', 'descend', 'potion', 'disarm',
    'mark', 'deny', 'rotate', 'power', 'blast', 'click'];
export const MUSIC = { dig: 'audio/music-dig.mp3', camp: 'audio/music-camp.mp3', treasure: 'audio/music-treasure.mp3', ending: 'audio/music-ending.mp3' };
export const VOICES = Object.keys(LINES);

/** A 4x4 atlas cell as a CSS background-position. */
export const cell = (i, cols = 4, rows = 4) => `${(i % cols) * (100 / (cols - 1))}% ${Math.floor(i / cols) * (100 / (rows - 1))}%`;
