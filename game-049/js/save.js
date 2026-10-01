/**
 * save.js — localStorage: the current run, lifetime records and settings.
 * Every key is game-prefixed; every access is wrapped (private windows,
 * blocked storage and full quotas must never break the game).
 */

import { serialize, deserialize } from './sim/game.js';

const RUN = 'lanterndeep_run_v1';
const REC = 'lanterndeep_records_v1';
const SET = 'lanterndeep_settings_v1';

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const del = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

export function saveRun(run) {
    if (!run || (run.over && !run.dead)) return false;
    return put(RUN, serialize(run));
}
export function loadRun() {
    const s = get(RUN);
    if (!s) return null;
    try { return deserialize(s); } catch (e) { console.warn('Lanterndeep: save unreadable', e); return null; }
}
export function hasRun() { return !!get(RUN); }
export function clearRun() { del(RUN); }

export function records() {
    try { return { deepest: 0, wins: 0, endings: [], deaths: 0, runs: 0, ...JSON.parse(get(REC) || '{}') }; }
    catch { return { deepest: 0, wins: 0, endings: [], deaths: 0, runs: 0 }; }
}
export function updateRecords(fn) {
    const r = records();
    fn(r);
    put(REC, JSON.stringify(r));
    return r;
}

export function settings() {
    try { return { sound: true, quality: null, zoom: 1, ...JSON.parse(get(SET) || '{}') }; }
    catch { return { sound: true, quality: null, zoom: 1 }; }
}
export function saveSettings(s) { put(SET, JSON.stringify(s)); }
