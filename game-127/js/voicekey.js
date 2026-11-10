// Which recorded voice clip a line of dialogue plays: a short hash of speaker and text. Lines that change with the
// save (the player's names) are never voiced. Used by the UI and by dev/audio/voices.mjs, which writes the takes.

/** FNV-1a 32-bit of `who|text`, as 8 hex digits. */
export function voiceKey(who, text) {
    let h = 0x811c9dc5;
    const s = who + '|' + text;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/** Whether a line can have a recording: not the player, no names filled in at runtime. */
export function voiceable(who, text) {
    return who !== 'you' && !text.includes('{');
}
