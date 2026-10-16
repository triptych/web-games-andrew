// The researcher's progress: which cartridges are open or restored, what VESTA has remembered,
// what the Studio holds, commendations and stats. Plain JSON, pure functions, saved as one object.

import { V } from '../runtime/index.js';
import { MISSIONS, missionById, taskStates, repair } from './missions.js';

export const PROGRESS_V = 1;

// Each hardware feature comes back when a mission opens ('start') or is restored ('done').
export const FEATURES = {
    sprites: { label: 'Sprite editor' },
    objects: { label: 'Object inspector' },
    map: { label: 'Map editor', start: 'brick' },
    code: { label: 'VESTA SCRIPT editor', start: 'brick' },
    pal8: { label: 'Colour DAC: 8 colours', done: 'rally' },
    sound: { label: 'Sound chip: effects editor', done: 'rally' },
    export: { label: 'Cartridge burner: export to HTML', done: 'rally' },
    pal16: { label: 'Colour DAC: 16 colours', done: 'brick' },
    frames: { label: 'Animation frames', start: 'invasion' },
    music: { label: 'Music tracker', done: 'invasion' },
    ai: { label: 'AI controls: chase, homing, patrol, wander', start: 'munch' },
    grid: { label: 'Grid and maze controls', start: 'munch' },
    flags: { label: 'Tile flags: hazard, ladder, one-way', start: 'hop' },
    platform: { label: 'Platform physics: jump & gravity', start: 'girder' },
    bigmap: { label: 'Big maps and the scrolling camera', start: 'run' },
    levels: { label: 'Up to four levels per cart', start: 'dungeon' },
};

export const ACHIEVEMENTS = [
    { id: 'first_light', icon: '☀', name: 'First Light', text: 'Restore your first cartridge.' },
    { id: 'full_colour', icon: '🌈', name: 'Full Colour', text: 'Bring back all sixteen colours.' },
    { id: 'hands_on', icon: '✋', name: 'Hands On', text: 'Restore a cartridge without asking VESTA to repair anything.' },
    { id: 'purist', icon: '🔧', name: 'Purist', text: 'Restore all eight historic cartridges with your own hands.' },
    { id: 'pixel_pusher', icon: '🖌', name: 'Pixel Pusher', text: 'Draw 500 pixels.' },
    { id: 'cartographer', icon: '🗺', name: 'Cartographer', text: 'Paint 300 map tiles.' },
    { id: 'debugger', icon: '🐞', name: 'Debugger', text: 'Hit a script error, then run that cart cleanly.' },
    { id: 'composer', icon: '♫', name: 'Composer', text: 'Place 32 notes in the music tracker.' },
    { id: 'foley', icon: '🔊', name: 'Foley Artist', text: 'Shape 5 sound effects.' },
    { id: 'burner', icon: '🔥', name: 'Cartridge Burner', text: 'Export a game as a standalone HTML file.' },
    { id: 'perfect_rally', icon: '🏓', name: 'Shut Out', text: 'Win RALLY three points to nil.' },
    { id: 'creator', icon: '✨', name: 'Creator', text: 'Win a game you made in the Studio.' },
    { id: 'archivist', icon: '📦', name: 'Archivist', text: 'Restore all eight historic cartridges.' },
    { id: 'romancer', icon: '💜', name: 'Romancer', text: 'Finish the last cartridge.' },
];

export function newProgress(name = 'ORI') {
    const P = {
        v: PROGRESS_V,
        name: String(name || 'ORI').slice(0, 14),
        missions: {},
        creative: [],
        ach: {},
        stats: { pixels: 0, tiles: 0, notes: 0, sfx: 0, plays: 0, exports: 0, repairs: 0, errors: 0, wins: 0 },
        scenes: {},
        ended: false,
        nextId: 1,
    };
    for (const m of MISSIONS) P.missions[m.id] = { state: 'locked', cart: null, play: { maxG: {}, wins: 0 }, repaired: [], errored: false };
    openMission(P, MISSIONS[0].id);
    return P;
}

export function openMission(P, id) {
    const s = P.missions[id];
    if (!s || s.state !== 'locked') return false;
    s.state = 'open';
    s.cart = missionById(id).build();
    return true;
}

export const isDone = (P, id) => P.missions[id] && P.missions[id].state === 'done';
export const isOpen = (P, id) => P.missions[id] && P.missions[id].state !== 'locked';
export const doneCount = (P) => MISSIONS.filter((m) => isDone(P, m.id)).length;
export const historicDone = (P) => MISSIONS.filter((m) => !m.final && isDone(P, m.id)).length;
/** VESTA's memory, 0–100. */
export const memory = (P) => Math.round((doneCount(P) / MISSIONS.length) * 100);
/** The cartridge the story is waiting on, or null when everything is restored. */
export const currentMission = (P) => MISSIONS.find((m) => P.missions[m.id].state === 'open') || null;

export function hasFeature(P, f, openAll = false) {
    if (openAll) return true;
    const F = FEATURES[f];
    if (!F) return false;
    if (F.start) return isOpen(P, F.start);
    if (F.done) return isDone(P, F.done);
    return true;
}
export const paletteSize = (P, openAll) => (hasFeature(P, 'pal16', openAll) ? 16 : hasFeature(P, 'pal8', openAll) ? 8 : 4);
/** Features that came on because of this mission opening or finishing. */
export function featuresFor(id, when) {
    return Object.entries(FEATURES).filter(([, F]) => F[when] === id).map(([k, F]) => ({ id: k, label: F.label }));
}

/** Merge a playtest's stats into the mission's record. */
export function recordPlay(P, id, stats) {
    const s = P.missions[id];
    P.stats.plays++;
    if (!s) return;
    for (const k in stats.maxG) if (!(s.play.maxG[k] >= stats.maxG[k])) s.play.maxG[k] = stats.maxG[k];
    s.play.wins += stats.wins || 0;
    if (stats.wins) P.stats.wins++;
}

export function missionTasks(P, id) {
    const m = missionById(id), s = P.missions[id];
    return taskStates(m, s.cart, s.play);
}

/** Use VESTA's repair for one task. */
export function repairTask(P, id, taskId) {
    const m = missionById(id), s = P.missions[id];
    s.cart = repair(m, s.cart, taskId);
    if (!s.repaired.includes(taskId)) s.repaired.push(taskId);
    P.stats.repairs++;
}

/** If every task is done, restore the cartridge and open the next. Returns what changed, or null. */
export function tryComplete(P, id) {
    const s = P.missions[id];
    if (!s || s.state !== 'open') return null;
    if (!missionTasks(P, id).every((t) => t.done)) return null;
    s.state = 'done';
    const i = MISSIONS.findIndex((m) => m.id === id);
    const next = MISSIONS[i + 1];
    const unlocked = featuresFor(id, 'done');
    if (next && openMission(P, next.id)) unlocked.push(...featuresFor(next.id, 'start'));
    if (MISSIONS[i].final) P.ended = true;
    return { id, next: next ? next.id : null, unlocked };
}

/** Commendations earned now that weren't before. */
export function checkAchievements(P) {
    const got = [];
    const give = (id) => { if (!P.ach[id]) { P.ach[id] = true; got.push(ACHIEVEMENTS.find((a) => a.id === id)); } };
    const historic = MISSIONS.filter((m) => !m.final);
    if (doneCount(P) >= 1) give('first_light');
    if (isDone(P, 'brick')) give('full_colour');
    if (historic.some((m) => isDone(P, m.id) && !P.missions[m.id].repaired.length)) give('hands_on');
    if (historic.every((m) => isDone(P, m.id) && !P.missions[m.id].repaired.length)) give('purist');
    if (P.stats.pixels >= 500) give('pixel_pusher');
    if (P.stats.tiles >= 300) give('cartographer');
    if (P.stats.notes >= 32) give('composer');
    if (P.stats.sfx >= 5) give('foley');
    if (P.stats.exports >= 1) give('burner');
    if (P.stats.debugged) give('debugger');
    if (P.stats.shutout) give('perfect_rally');
    if (P.stats.creatorWin) give('creator');
    if (historic.every((m) => isDone(P, m.id))) give('archivist');
    if (P.ended) give('romancer');
    return got;
}

// ------------------------------------------------------------------ the Studio
export function addCreative(P, cart, title) {
    const c = V.normalize(cart);
    if (title) c.title = title;
    const entry = { id: 'c' + (P.nextId++), cart: c, made: P.nextId };
    P.creative.unshift(entry);
    if (P.creative.length > 40) P.creative.length = 40;
    return entry;
}
export const creativeById = (P, id) => P.creative.find((e) => e.id === id) || null;
export function removeCreative(P, id) { P.creative = P.creative.filter((e) => e.id !== id); }

/** Starting points for a new Studio cart: blank, plus every restored cartridge. */
export function templates(P) {
    const out = [{ id: 'blank', title: 'Blank cartridge', cart: () => V.blankCart() }];
    for (const m of MISSIONS) {
        if (m.final || !isDone(P, m.id)) continue;
        out.push({ id: m.id, title: `${m.title} (${m.year})`, cart: () => JSON.parse(JSON.stringify(P.missions[m.id].cart)) });
    }
    if (isDone(P, 'last')) out.push({ id: 'last', title: P.missions.last.cart.title, cart: () => JSON.parse(JSON.stringify(P.missions.last.cart)) });
    return out;
}

// ------------------------------------------------------------------ saving
export function serializeProgress(P) { return JSON.parse(JSON.stringify(P)); }

export function deserializeProgress(d) {
    if (!d || d.v !== PROGRESS_V || typeof d.missions !== 'object') throw new Error('unknown save version');
    const P = newProgress(d.name);
    P.missions = {};
    for (const m of MISSIONS) {
        const s = d.missions[m.id] || {};
        P.missions[m.id] = {
            state: ['locked', 'open', 'done'].includes(s.state) ? s.state : 'locked',
            cart: s.cart ? V.normalize(s.cart) : null,
            play: { maxG: { ...((s.play && s.play.maxG) || {}) }, wins: (s.play && s.play.wins) | 0 },
            repaired: Array.isArray(s.repaired) ? s.repaired.filter((x) => typeof x === 'string') : [],
            errored: !!s.errored,
        };
        if (P.missions[m.id].state !== 'locked' && !P.missions[m.id].cart) P.missions[m.id].cart = m.build();
    }
    if (!MISSIONS.some((m) => P.missions[m.id].state !== 'locked')) openMission(P, MISSIONS[0].id);
    P.creative = (Array.isArray(d.creative) ? d.creative : []).filter((e) => e && e.cart).map((e) => ({ id: String(e.id), cart: V.normalize(e.cart), made: e.made | 0 }));
    P.ach = { ...(d.ach || {}) };
    P.stats = { ...P.stats, ...(d.stats || {}) };
    P.scenes = { ...(d.scenes || {}) };
    P.ended = !!d.ended;
    P.nextId = Math.max(d.nextId | 0, P.creative.length + 1);
    return P;
}
