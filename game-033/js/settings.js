/**
 * settings.js — user preferences that live outside the save file (Phase 4).
 * Text speed and volume should persist across "New Game" the way a real
 * settings menu would, so they're stored under their own localStorage key
 * rather than inside state.js's save payload.
 */

import { events } from './events.js';
import { setVolume as applyVolume } from './sounds.js';

const SETTINGS_KEY = 'hearthbound-settings-v1';

// Text speed is expressed as ms-per-character for the typewriter effect;
// lower is faster. These are the three notches the slider snaps to.
export const TEXT_SPEEDS = { slow: 34, normal: 18, fast: 6, instant: 0 };

const DEFAULTS = {
    textSpeedMsPerChar: TEXT_SPEEDS.normal,
    volume: 0.25,
};

class Settings {
    constructor() {
        this._values = { ...DEFAULTS };
        this._load();
        applyVolume(this._values.volume);
    }

    get textSpeedMsPerChar() { return this._values.textSpeedMsPerChar; }
    get volume() { return this._values.volume; }

    setTextSpeed(msPerChar) {
        this._values.textSpeedMsPerChar = msPerChar;
        this._save();
        events.emit('settingsChanged', this._values);
    }

    setVolume(vol) {
        this._values.volume = Math.max(0, Math.min(1, vol));
        applyVolume(this._values.volume);
        this._save();
        events.emit('settingsChanged', this._values);
    }

    _save() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._values));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    _load() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            this._values = { ...DEFAULTS, ...parsed };
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

export const settings = new Settings();
