// Everyone who speaks. `moods` are the extra portrait expressions painted for them (art/por/<id>-<mood>.webp);
// `voice` is the ElevenLabs voice that reads their lines (dev/audio/README.md). 'n' is the narrator.

export const CAST = {
    n: { name: '', color: '#cfc6ea', voice: 'River' },
    lyra: { name: 'Lyra', color: '#c4a4ff', moods: ['happy', 'sad', 'fierce'], voice: 'Lily', sprite: true },
    orin: { name: 'Orin', color: '#8cc8ff', moods: ['angry'], voice: 'Daniel', sprite: true },
    sera: { name: 'Sera', color: '#8be0a6', moods: ['smile'], voice: 'Laura', sprite: true },
    thane: { name: 'Thane', color: '#ff9a6c', moods: ['sad'], voice: 'Callum', sprite: true },
    varec: { name: 'Elder Varec', color: '#e0c08a', moods: ['worried'], voice: 'George', sprite: true },
    holt: { name: 'Farmer Holt', color: '#c8dc8a', voice: 'Bill', sprite: true },
    borin: { name: 'Borin', color: '#e8b070', voice: 'Charlie', sprite: true },
    marta: { name: 'Marta', color: '#f09060', voice: 'Aria', sprite: true },
    aldric: { name: 'Aldric', color: '#f0c070', voice: 'Eric', sprite: true },
    sylvara: { name: 'Sylvara', color: '#a8f0b0', moods: ['sad'], voice: 'Matilda', sprite: true },
    aneth: { name: 'Scholar Aneth', color: '#a8b8ff', voice: 'Alice', sprite: true },
    korvas: { name: 'Korvas', color: '#c890ff', voice: 'Brian' },
    vaelthas: { name: 'Vaelthas', color: '#80f0ff', voice: 'Roger' },
};
