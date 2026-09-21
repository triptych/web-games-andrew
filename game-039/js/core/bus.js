/**
 * Minimal event bus. Modules never import each other's mutators; they emit and
 * listen. `clearAll()` runs on run teardown so listeners never stack up.
 */

const listeners = new Map();

export const bus = {
    on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
        return () => bus.off(event, fn);
    },
    off(event, fn) {
        const set = listeners.get(event);
        if (set) set.delete(fn);
    },
    emit(event, payload) {
        const set = listeners.get(event);
        if (!set) return;
        for (const fn of Array.from(set)) fn(payload);
    },
    clearAll() {
        listeners.clear();
    }
};

export const EV = {
    MOTE_ABSORBED: 'mote:absorbed',
    MOTE_SPLIT: 'mote:split',
    MOTE_HIT_CORE: 'mote:hitCore',
    ECHO_SHED: 'echo:shed',
    ECHO_RECLAIMED: 'echo:reclaimed',
    ECHO_EATEN: 'echo:eaten',
    POLARITY_FLIP: 'probe:flip',
    FLUX_EMPTY: 'probe:fluxEmpty',
    CHAIN_UP: 'score:chainUp',
    CHAIN_BREAK: 'score:chainBreak',
    WAVE_START: 'wave:start',
    WAVE_CLEAR: 'wave:clear',
    SURGE: 'wave:surge',
    CONTAINMENT_LOST: 'run:containmentLost',
    GAME_OVER: 'run:gameOver'
};
