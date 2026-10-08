// ============================================================
// FROSTMARCH — configuration and quality tiers
// ============================================================

export const VERSION = '1.0.0';
export const SAVE_PREFIX = 'frostmarch.v1';

const params = new URLSearchParams(location.search);
export const DEBUG = params.has('debug');
export const FAST = Math.max(1, Math.min(16, parseInt(params.get('fast') || '1', 10) || 1));
export const FORCE_Q = params.has('q') ? parseInt(params.get('q'), 10) : null;

export const IS_TOUCH = (() => {
    try { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; } catch { return false; }
})();

// Camera
export const CAM = { fov: 70, fovPhone: 72, near: 0.25, far: 4200, eye: 1.62, thirdDist: 3.6, thirdHeight: 0.35 };

// Time: one real second = 20 game seconds (a game day lasts 72 real minutes)
export const TIMESCALE = 20;

// Quality tiers: 0 Ultra, 1 High, 2 Medium, 3 Low
export const QUALITY = [
    { name: 'Ultra',  pr: 2.0,  shadow: 2048, shadowBox: 140, grass: 70, grassDensity: 1.0, trees: [120, 420, 1700], split: 2.3, bloom: 1, msaa: 4, clouds: 6, aurora: 22, triplanar: true,  macro: true,  fxaa: false, maxLights: 6 },
    { name: 'High',   pr: 1.5,  shadow: 2048, shadowBox: 100, grass: 55, grassDensity: 0.8, trees: [100, 330, 1400], split: 2.0, bloom: 1, msaa: 4, clouds: 5, aurora: 16, triplanar: true,  macro: true,  fxaa: false, maxLights: 6 },
    { name: 'Medium', pr: 1.0,  shadow: 1024, shadowBox: 64,  grass: 36, grassDensity: 0.55, trees: [70, 210, 1000], split: 1.65, bloom: 0.5, msaa: 0, clouds: 3, aurora: 10, triplanar: true, macro: true,  fxaa: true,  maxLights: 4 },
    { name: 'Low',    pr: 0.75, shadow: 0,    shadowBox: 0,   grass: 20, grassDensity: 0.35, trees: [50, 150, 750], split: 1.35, bloom: 0, msaa: 0, clouds: 2, aurora: 6,  triplanar: false, macro: false, fxaa: true,  maxLights: 3 },
];

export const DEFAULT_SETTINGS = {
    master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.7, voice: 0.9, muted: false,
    quality: null,          // null = auto
    autoQuality: true,
    sensitivity: 1.0,
    invertY: false,
    fov: 70,
    subtitles: true,
    compass: true,
    crosshair: true,
    thirdPerson: null,      // null = phones third-person, desktop first-person
    aimAssist: true,
    difficulty: 'adept',    // novice, apprentice, adept, expert, master
};

export const DIFFICULTY = {
    novice:     { dealt: 2.0,  taken: 0.5 },
    apprentice: { dealt: 1.5,  taken: 0.75 },
    adept:      { dealt: 1.0,  taken: 1.0 },
    expert:     { dealt: 0.75, taken: 1.5 },
    master:     { dealt: 0.5,  taken: 2.0 },
};
