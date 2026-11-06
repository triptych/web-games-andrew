// Per-biome look: sky, fog, light and ground colours. Colours are 0xRRGGBB integers.

export const BIOMES = {
    scorched: {
        sky: [0x24355c, 0xe8a060], fog: 0xb88458, fogNear: 70, fogFar: 270, sun: 0xffd6a0, sunI: 2.3, sunDir: [-0.5, 0.55, -0.6], hemi: [0x9db4d8, 0x3d2c24, 0.85],
        ground: { lo: 0x4b3d2d, mid: 0x6f5d46, hi: 0x8d7d66, rock: 0x3a3430, scorch: 0x15110e }, rock: 0x6e6256, wreck: 0x5c6168, wreckBurn: 0x2a2420, spire: 0x2c2723,
        dust: 0xc9a47c, hazard: 0xff6a1a, hazardGlow: 0xff9a40, decor: 'dry', ambient: 0.35, wind: 0.4,
    },
    marsh: {
        sky: [0x1d3b30, 0xb4d89c], fog: 0x6f9b78, fogNear: 45, fogFar: 200, sun: 0xe6ffc8, sunI: 1.7, sunDir: [0.4, 0.5, -0.7], hemi: [0xa6e6b8, 0x1f2d1c, 0.9],
        ground: { lo: 0x2c3a22, mid: 0x4b5a30, hi: 0x6e7a46, rock: 0x3a3a30, scorch: 0x0f120c }, rock: 0x555a48, wreck: 0x4d5a50, wreckBurn: 0x1e241c, spire: 0x3c8a6a,
        dust: 0x9ccf7c, hazard: 0x80ff40, hazardGlow: 0xb6ff5a, decor: 'moss', ambient: 0.45, wind: 0.2,
    },
    canyon: {
        sky: [0x3f6ca6, 0xf4bc80], fog: 0xd49a68, fogNear: 80, fogFar: 300, sun: 0xfff0d0, sunI: 2.6, sunDir: [-0.6, 0.6, -0.4], hemi: [0xb0c8f0, 0x6a3220, 0.8],
        ground: { lo: 0x9a4a2a, mid: 0xc27a46, hi: 0xdea66a, rock: 0x6e3520, scorch: 0x1a0f0a }, rock: 0x8b4a2e, wreck: 0x6b5a50, wreckBurn: 0x2a1e18, spire: 0xa85a36,
        dust: 0xe0b080, hazard: 0xd8a860, hazardGlow: 0xffd08a, decor: 'dry', ambient: 0.4, wind: 0.5,
    },
    ice: {
        sky: [0x3a68a8, 0xe0efff], fog: 0xbfd6ee, fogNear: 55, fogFar: 230, sun: 0xeaf4ff, sunI: 2.1, sunDir: [0.3, 0.45, -0.8], hemi: [0xc8e0ff, 0x7088a8, 1.0],
        ground: { lo: 0xaec4dc, mid: 0xd4e4f4, hi: 0xf4faff, rock: 0x5c6e86, scorch: 0x232b36 }, rock: 0x7f93ad, wreck: 0x6a7682, wreckBurn: 0x1c222a, spire: 0x9fd8ff,
        dust: 0xffffff, hazard: 0x1a2a4a, hazardGlow: 0x4a7ac0, decor: 'snow', ambient: 0.5, wind: 0.9,
    },
    volcanic: {
        sky: [0x120808, 0x8a3412], fog: 0x4a1c10, fogNear: 50, fogFar: 220, sun: 0xff9a60, sunI: 1.9, sunDir: [0.4, 0.4, -0.6], hemi: [0xd08060, 0x24100a, 0.75],
        ground: { lo: 0x1b1816, mid: 0x2c2724, hi: 0x4a403a, rock: 0x161212, scorch: 0x050303 }, rock: 0x2c2522, wreck: 0x4a4038, wreckBurn: 0x120c0a, spire: 0x1a1412,
        dust: 0x6a4a3a, hazard: 0xff4a08, hazardGlow: 0xffa030, decor: 'ash', ambient: 0.3, wind: 0.5,
    },
    hive: {
        sky: [0x120620, 0x7a2870], fog: 0x4a1c4a, fogNear: 45, fogFar: 210, sun: 0xff9ae0, sunI: 1.6, sunDir: [-0.3, 0.5, -0.7], hemi: [0xc890e0, 0x2a1030, 0.9],
        ground: { lo: 0x3a1c3e, mid: 0x5c2c56, hi: 0x84447a, rock: 0x22102a, scorch: 0x0a040c }, rock: 0x4e2a54, wreck: 0x5a3a60, wreckBurn: 0x150a1a, spire: 0xb04ac0,
        dust: 0xc080d0, hazard: 0xb0ff50, hazardGlow: 0xd0ff90, decor: 'spore', ambient: 0.4, wind: 0.3,
    },
};
export const BIOME_OF = ['scorched', 'marsh', 'canyon', 'ice', 'volcanic', 'hive'];
