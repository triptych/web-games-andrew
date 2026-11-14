// Every generated media file the game ships, so it never requests one that isn't there.
// Art: fal (dev/art/). Sound: ElevenLabs (dev/audio/). Anything missing falls back to code:
// the portraits to an emoji, the wall paintings to clay shapes, the sounds to Web Audio blips.

/** The game folder, from this module's own URL, so dev pages in dev/ load the same files. */
export const ROOT = new URL('../', import.meta.url).href;

export const ART = {
    title: 'art/title.webp',
    portraits: ['pip', 'mo', 'twins', 'nonna', 'biscuit', 'juno', 'fern', 'cabin'],   // art/por-<id>.webp
    motifs: ['sun', 'flower', 'cat', 'hills', 'heart', 'boat'],                        // art/motif-<m>.webp, in catalogue order
};

export const MUSIC = { title: 'audio/music-title.mp3', build: ['audio/music-build1.mp3', 'audio/music-build2.mp3'] };

export const SFX = ['craft', 'squish', 'plop', 'lift', 'rotate', 'stow', 'undo', 'nope', 'click', 'open', 'shutter', 'star', 'goal', 'fanfare', 'cheer', 'unlock', 'fire'];
