// Every generated media file the game ships, so it never asks for one that isn't there.
// Art: fal (dev/art/). Sound: ElevenLabs (dev/audio/). Anything missing falls back to code:
// a plain panel for art, Web Audio blips for effects, silence for music and voices.

import { RIVALS } from './sim/data/rivals.js';
import { NARRATOR } from './sim/data/inn.js';

/** The game folder, from this module's own URL, so dev pages in dev/ load the same files. */
export const ROOT = new URL('../', import.meta.url).href;

export const ART = {
    title: 'art/title.webp', table: 'art/table.webp', ending: 'art/ending.webp', over: 'art/over.webp',
    rival: (id) => `art/rival-${id}.webp`,
    card: (id) => `art/card-${id}.webp`,
};

export const MUSIC = { day: 'audio/music-day.mp3', night: 'audio/music-night.mp3', boss: 'audio/music-boss.mp3', ending: 'audio/music-ending.mp3' };

export const SFX = ['flip', 'deal', 'settle', 'cut', 'hit', 'block', 'heal', 'coins', 'shuffle', 'lock', 'grudge', 'cleared', 'defeat', 'door', 'pour', 'build'];

export const VOICES = [
    ...Object.values(RIVALS).flatMap((r) => (r.final ? [`${r.id}-arrive`, `${r.id}-cleared`] : [`${r.id}-arrive`, `${r.id}-accept`])),
    ...Object.keys(NARRATOR).map((k) => `narrator-${k}`),
];
