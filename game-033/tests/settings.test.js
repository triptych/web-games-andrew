import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// settings.js persists to localStorage; Node has no global localStorage, so
// provide a minimal in-memory shim before importing (mirrors state.test.js).
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
}

globalThis.localStorage.clear();

const { settings, TEXT_SPEEDS } = await import('../js/settings.js');
const { events } = await import('../js/events.js');

beforeEach(() => {
    events.clearAll();
});

describe('settings — text speed', () => {
    test('defaults to the "normal" speed', () => {
        assert.equal(settings.textSpeedMsPerChar, TEXT_SPEEDS.normal);
    });

    test('setTextSpeed updates the value and emits settingsChanged', () => {
        let emitted = null;
        events.on('settingsChanged', (values) => { emitted = values; });
        settings.setTextSpeed(TEXT_SPEEDS.instant);
        assert.equal(settings.textSpeedMsPerChar, TEXT_SPEEDS.instant);
        assert.equal(emitted.textSpeedMsPerChar, TEXT_SPEEDS.instant);
        settings.setTextSpeed(TEXT_SPEEDS.normal); // reset for other tests
    });

    test('persists across a fresh load from localStorage', async () => {
        settings.setTextSpeed(TEXT_SPEEDS.fast);
        // Re-import isn't possible for a singleton module within one process,
        // so exercise the persistence path directly via the stored payload.
        const raw = JSON.parse(globalThis.localStorage.getItem('hearthbound-settings-v1'));
        assert.equal(raw.textSpeedMsPerChar, TEXT_SPEEDS.fast);
        settings.setTextSpeed(TEXT_SPEEDS.normal); // reset for other tests
    });
});

describe('settings — volume', () => {
    test('defaults to 0.25', () => {
        assert.equal(settings.volume, 0.25);
    });

    test('setVolume clamps to the 0..1 range', () => {
        settings.setVolume(5);
        assert.equal(settings.volume, 1);
        settings.setVolume(-5);
        assert.equal(settings.volume, 0);
        settings.setVolume(0.25); // reset for other tests
    });

    test('setVolume emits settingsChanged', () => {
        let emitted = null;
        events.on('settingsChanged', (values) => { emitted = values; });
        settings.setVolume(0.6);
        assert.equal(emitted.volume, 0.6);
        settings.setVolume(0.25); // reset for other tests
    });
});
