// Colours, light and atmosphere for each realm (index = realm id), plus the title/map/clubhouse sets.

export const PALETTES = [
    { // Meadowmere: a bright spring noon
        key: 'meadow',
        skyTop: '#3f8fe6', skyMid: '#8cc8f4', horizon: '#dff4ff', ground: '#9ad08a', fog: '#cfeefc', fogNear: 140, fogFar: 520,
        sun: '#fff1c8', sunDir: [0.45, 0.8, -0.35], sunI: 2.6, hemiSky: '#cfe8ff', hemiGround: '#6a8a4a', hemiI: 1.15,
        rough: ['#4f9a34', '#64ad3c'], oob: '#3d7a2a', fairway: ['#7fd04c', '#6dbd42'], green: ['#92e060', '#84d454'], tee: '#8ad85a',
        sand: '#f2dca2', ice: '#d4f0ff', snow: '#f8fbff', quick: '#b8925a', stone: '#d8c8a8', cloud: '#ffffff', cliff: '#9a8a74',
        water: '#3ab4ec', waterDeep: '#1a6ec8', foam: '#ffffff', lava: false,
        grass: ['#4f9a34', '#9ad85a'], leaves: ['#4fae44', '#7fd05a'], trunk: '#7a5a3a', flowers: ['#ff6a8a', '#ffd84a', '#ffffff', '#b07aff'],
        mountains: ['#8ab8d8', '#a8cce0'], rim: '#fff6e0', rimK: 0.32, bloom: 0.35, clouds: 1, stars: 0, aurora: 0, embers: 0,
    },
    { // Sandsea Dunes: hot, hazy gold
        key: 'sand',
        skyTop: '#3a9ad8', skyMid: '#9ad0e8', horizon: '#ffe8b4', ground: '#e8c078', fog: '#f8e0ac', fogNear: 120, fogFar: 480,
        sun: '#fff0c0', sunDir: [-0.4, 0.75, -0.5], sunI: 2.9, hemiSky: '#ffe8c0', hemiGround: '#a87a40', hemiI: 1.1,
        rough: ['#e2b46a', '#eec27a'], oob: '#d0a058', fairway: ['#b4c85a', '#a4ba4c'], green: ['#8ccc56', '#7ec04a'], tee: '#a8c858',
        sand: '#fae4ae', ice: '#d4f0ff', snow: '#f8fbff', quick: '#a8743a', stone: '#e8cf94', cloud: '#ffffff', cliff: '#c8945a',
        water: '#2ac4c4', waterDeep: '#108a9a', foam: '#ffffff', lava: false,
        grass: ['#a8a040', '#d0c060'], leaves: ['#3a9a4a', '#6ac05a'], trunk: '#9a6a3a', flowers: ['#ff8a4a', '#ffd84a'],
        mountains: ['#e0b080', '#f0c898'], rim: '#fff0d0', rimK: 0.34, bloom: 0.35, clouds: 0.4, stars: 0, aurora: 0, embers: 0,
    },
    { // Frostpeak: crisp, with an aurora
        key: 'frost',
        skyTop: '#2a4aa8', skyMid: '#7aa0e0', horizon: '#e8f4ff', ground: '#e8f0fa', fog: '#e4f0fc', fogNear: 120, fogFar: 460,
        sun: '#fff8f0', sunDir: [0.3, 0.6, -0.6], sunI: 1.75, hemiSky: '#cfe0ff', hemiGround: '#7a8aa8', hemiI: 1.0,
        rough: ['#dfe8f4', '#eef4fc'], oob: '#d0dcec', fairway: ['#a8d4b0', '#98c8a4'], green: ['#9ce0a8', '#8ed49c'], tee: '#a8dcb4',
        sand: '#ffffff', ice: '#bfe8ff', snow: '#ffffff', quick: '#b8925a', stone: '#c8d0dc', cloud: '#ffffff', cliff: '#8a96a8',
        water: '#2a84c8', waterDeep: '#103a8a', foam: '#f0f8ff', lava: false,
        grass: ['#9ab8a0', '#d8e8e0'], leaves: ['#2a6a4a', '#3a8a5a'], trunk: '#6a4a34', flowers: [],
        mountains: ['#a8b8e0', '#c8d6f0'], rim: '#e8f4ff', rimK: 0.3, bloom: 0.25, clouds: 0.6, stars: 0.15, aurora: 1, embers: 0, snowfall: 1,
    },
    { // Cinder Caldera: red-black, glowing
        key: 'cinder',
        skyTop: '#16060e', skyMid: '#4a1218', horizon: '#d8562a', ground: '#3a2a2a', fog: '#5a2420', fogNear: 90, fogFar: 380,
        sun: '#ffb070', sunDir: [0.2, 0.55, -0.8], sunI: 2.1, hemiSky: '#ff9a6a', hemiGround: '#3a1a1a', hemiI: 0.95,
        rough: ['#4a3a38', '#5a4644'], oob: '#2e2424', fairway: ['#7a8a3a', '#6c7c34'], green: ['#8aa84a', '#7c9a40'], tee: '#7a8a3a',
        sand: '#2e2a34', ice: '#d4f0ff', snow: '#f8fbff', quick: '#6a4a2a', stone: '#6a5a58', cloud: '#ffffff', cliff: '#3a2e2e',
        water: '#ff6a1a', waterDeep: '#c82a08', foam: '#ffe070', lava: true,
        grass: ['#5a5a2a', '#8a8a3a'], leaves: ['#2a1a2a', '#4a2a3a'], trunk: '#2a1e24', flowers: [],
        mountains: ['#3a1a1a', '#5a2a22'], rim: '#ff9a5a', rimK: 0.45, bloom: 0.45, clouds: 0.3, stars: 0.4, aurora: 0, embers: 1,
    },
    { // Sky Citadel: dusk above the clouds
        key: 'sky',
        skyTop: '#140a3a', skyMid: '#5a3a9a', horizon: '#ffa8c8', ground: '#c8b0f0', fog: '#c8a8e8', fogNear: 150, fogFar: 560,
        sun: '#ffd8e8', sunDir: [-0.5, 0.45, -0.6], sunI: 2.3, hemiSky: '#e0c8ff', hemiGround: '#6a4a8a', hemiI: 1.2,
        rough: ['#6ac87a', '#7ad88a'], oob: '#5ab06a', fairway: ['#8ae08a', '#7cd47c'], green: ['#a0f09a', '#90e48c'], tee: '#8ae08a',
        sand: '#f0e0c0', ice: '#d4f0ff', snow: '#f8fbff', quick: '#b8925a', stone: '#ece4f4', cloud: '#ffffff', cliff: '#8a7aa8',
        water: '#3ab4ec', waterDeep: '#1a6ec8', foam: '#ffffff', lava: false,
        grass: ['#5ab06a', '#a0f0a0'], leaves: ['#5ac87a', '#8ae09a'], trunk: '#7a6a8a', flowers: ['#ff9ad8', '#ffe8a0', '#a0e0ff'],
        mountains: ['#8a6ab8', '#b090d8'], rim: '#ffd8f0', rimK: 0.4, bloom: 0.5, clouds: 1, stars: 1, aurora: 0, embers: 0, cloudSea: 1,
    },
];

export const MAP_PALETTE = { ...PALETTES[0], skyTop: '#5aa8f0', horizon: '#e8f8ff', fog: '#d8f0ff', fogNear: 200, fogFar: 700 };
