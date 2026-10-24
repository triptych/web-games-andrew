// Palettes and moods for the five worlds and the final reef. Pure data for the view.

const T = {
    beach: {
        name: 'Sunny Shallows',
        sky: [0x3aa7ff, 0x8fdcff, 0xfff1d0], sun: 0xfff1c0, sunDir: [-0.5, 0.8, 0.35], sunI: 2.1,
        hemi: [0xbfe6ff, 0xf3d9a0, 0.95], fog: 0xcdeeff, fogN: 70, fogF: 260,
        water: [0x2fe0e6, 0x1585c8, 0xffffff], waterAlpha: 0.86, waveH: 0.18,
        slab: { ground: [0xf0d49a, 0xfff0b8], wood: [0xb98552, 0xe0b074], plank: [0xb58250, 0xdcae72], stone: [0x9aa3ad, 0xcfd6dc], raft: [0xa8754a, 0xd9a86e], crumble: [0xe4c386, 0xf7de9f], coral: [0xff9db4, 0xffd0dc], arena: [0xe8c98c, 0xfbe5aa] },
        decor: 'beach', clouds: 0xffffff, music: 0,
    },
    jungle: {
        name: 'Coconut Cove',
        sky: [0x42b8c8, 0x9ae6d4, 0xf4ffdc], sun: 0xfff6c6, sunDir: [-0.4, 0.85, 0.3], sunI: 1.9,
        hemi: [0xc4f2d8, 0x8a6a3e, 0.95], fog: 0xbfeee0, fogN: 55, fogF: 220,
        water: [0x28d6a8, 0x0f8f86, 0xeaffe8], waterAlpha: 0.88, waveH: 0.14,
        slab: { ground: [0x9a6a3c, 0x6fd05a], wood: [0x8a5a34, 0xb88050], plank: [0x9a6a3c, 0xc79058], stone: [0x8f9a8e, 0xc4d0c2], raft: [0x8a5a34, 0xb88050], crumble: [0x8a6a44, 0xa3d070], coral: [0xff9db4, 0xffd0dc], arena: [0x9a6a3c, 0x7be064] },
        decor: 'jungle', clouds: 0xf4fff0, music: 1,
    },
    pier: {
        name: 'Rustwater Docks',
        sky: [0x7a6ee0, 0xff9a8a, 0xffe0a8], sun: 0xffc98a, sunDir: [-0.7, 0.45, 0.4], sunI: 2.0,
        hemi: [0xffd0c0, 0x5a4a6a, 0.9], fog: 0xffc9b0, fogN: 50, fogF: 200,
        water: [0x4c8fe0, 0x2a4f9c, 0xffe8d0], waterAlpha: 0.9, waveH: 0.22,
        slab: { ground: [0x9c7c62, 0xc4a07a], wood: [0xa6764a, 0xd4a468], plank: [0xa6764a, 0xd9a86a], stone: [0x8a8f9a, 0xc0c6d0], raft: [0x8a5e3a, 0xc08a58], crumble: [0xb28a5a, 0xdfb27a], coral: [0xff9db4, 0xffd0dc], arena: [0x9c7c62, 0xd4b08a] },
        decor: 'pier', clouds: 0xffe6e0, music: 2,
    },
    castle: {
        name: 'Sandcastle Kingdom',
        sky: [0x58b8ff, 0xaee4ff, 0xfff6dc], sun: 0xfffbe0, sunDir: [-0.35, 0.9, 0.25], sunI: 2.2,
        hemi: [0xd0efff, 0xf6e2b0, 1.0], fog: 0xdaf2ff, fogN: 70, fogF: 260,
        water: [0x7be8f0, 0x3aa8e0, 0xffffff], waterAlpha: 0.82, waveH: 0.12,
        slab: { ground: [0xe9c982, 0xfbe8b0], wood: [0xb98552, 0xe0b074], plank: [0xb58250, 0xdcae72], stone: [0xe2c07a, 0xf8e2aa], raft: [0xa8754a, 0xd9a86e], crumble: [0xe0bd78, 0xf6dc9c], coral: [0xff9db4, 0xffd0dc], arena: [0xe0bc76, 0xf8e0a2] },
        decor: 'castle', clouds: 0xffffff, music: 3,
    },
    storm: {
        name: 'Stormbreak Point',
        sky: [0x5c5fb8, 0xb08ad0, 0xffc8a8], sun: 0xffd9a8, sunDir: [-0.6, 0.5, 0.5], sunI: 1.7,
        hemi: [0xc8b8f0, 0x4a4468, 0.9], fog: 0xc8b0d8, fogN: 45, fogF: 190,
        water: [0x6a78d8, 0x2c3a8a, 0xf0e8ff], waterAlpha: 0.9, waveH: 0.34,
        slab: { ground: [0x8a8fa8, 0xb8bedc], wood: [0x8a6a58, 0xb48c74], plank: [0x8a6a58, 0xb48c74], stone: [0x8a90aa, 0xc0c6e4], raft: [0x7a5a48, 0xa8806a], crumble: [0x9a90a8, 0xc8bcd4], coral: [0xff9db4, 0xffd0dc], arena: [0x8a8fa8, 0xbcc2e0] },
        decor: 'storm', clouds: 0xd8cce8, music: 4,
    },
    reef: {
        name: 'Home Sweet Reef',
        sky: [0x6bd4ff, 0xb8f2ff, 0xfff0e8], sun: 0xfff6d8, sunDir: [-0.3, 0.9, 0.3], sunI: 2.2,
        hemi: [0xd8f8ff, 0xffc4d8, 1.0], fog: 0xd6f6ff, fogN: 70, fogF: 260,
        water: [0x40f0e0, 0x1aa0e0, 0xffffff], waterAlpha: 0.8, waveH: 0.16,
        slab: { ground: [0xff9db4, 0xffd0dc], wood: [0xb98552, 0xe0b074], plank: [0xb58250, 0xdcae72], stone: [0xc9a8e8, 0xe6d4f8], raft: [0xa8754a, 0xd9a86e], crumble: [0xffc0a0, 0xffe0c8], coral: [0xff9db4, 0xffd0dc], arena: [0xffb0c4, 0xffd8e2] },
        decor: 'reef', clouds: 0xffffff, music: 5,
    },
};

export const themeOf = (name) => T[name] || T.beach;
export default T;
