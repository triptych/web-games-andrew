// Every generated media file the game ships, so it never requests one that isn't there.
// Art: fal (dev/art/). Sound: ElevenLabs (dev/audio/). Anything missing falls back to code:
// a coloured panel for art, Web Audio blips for effects, silence for music and voices.

/** The game folder, from this module's own URL, so dev pages in dev/ load the same files. */
export const ROOT = new URL('../', import.meta.url).href;

export const ART = {
    title: 'art/title.webp', hangar: 'art/hangar.webp', ending: 'art/ending.webp',
    sector: (id) => `art/sector-${id}.webp`,
    crew: (id) => `art/crew-${id}.webp`,
    cast: (id) => `art/cast-${id}.webp`,
    intro: [1, 2, 3, 4, 5, 6].map((n) => `art/intro-${n}.webp`),
};

export const MUSIC = {
    title: 'audio/music-title.mp3', hangar: 'audio/music-hangar.mp3', boss: 'audio/music-boss.mp3',
    battle: ['audio/music-battle1.mp3', 'audio/music-battle2.mp3'],
};

export const SFX = ['vulcan', 'rocket', 'laser', 'mortar', 'boom', 'bigboom', 'shatter', 'crumble', 'pickup', 'levelup', 'overdrive',
    'hurt', 'shield', 'stomp', 'step', 'rescue', 'roar', 'alarm', 'click', 'open', 'buy', 'gift', 'clear', 'fail', 'spit', 'hatch', 'beam'];

export const VOICES = ['kai-launch', 'kai-overdrive', 'kai-levelup', 'kai-boss', 'kai-lowhp',
    'mirei-launch', 'mirei-rescue', 'mirei-evac', 'mirei-boss', 'mirei-clear', 'mirei-down',
    'intro-1', 'intro-2', 'intro-3', 'intro-4', 'intro-5', 'intro-6'];
