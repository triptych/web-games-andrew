// Everyone who speaks. `moods` are the extra portrait expressions painted for them (art/por/<id>-<mood>.webp);
// `voice` is the ElevenLabs voice that reads their lines (dev/audio/README.md). 'n' is the narrator (text only).

export const CAST = {
    n: { name: '', color: '#f0dcb4' },
    wick: { name: 'Wick', color: '#8fd0c8', voice: 'Lily', sprite: true },
    trina: { name: 'Trina', color: '#f2a860', moods: ['excited'], voice: 'Jessica', sprite: true },
    mabel: { name: 'Mabel', color: '#f0b8c0', voice: 'Matilda', sprite: true },
    pilcrow: { name: 'Mayor Pilcrow', color: '#e8cf7a', voice: 'George', sprite: true },
    bertram: { name: 'Bertram', color: '#b8c89a', voice: 'Bill', sprite: true },
    bertha: { name: 'Big Bertha', color: '#e08a6a', voice: 'Brian' },
};
